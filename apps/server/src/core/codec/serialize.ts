import type {
  ListShape,
  MapShape,
  Member,
  Protocol,
  Shape,
  ShapeRegistry,
  StructureShape,
  XmlNamespace,
} from "../types.ts";
import {
  blobToBase64,
  contentTypes,
  epochSecondsToTimestamp,
  memberShape,
  scalarToWireString,
} from "./common.ts";
import type { CodecResult } from "./common.ts";

export type SerializeRequest = {
  protocol: Protocol;
  registry: ShapeRegistry;
  shape: Shape | undefined;
  operation: string;
  result: unknown;
  resultWrapper?: string;
  xmlNamespace?: string;
  outputShapeName?: string;
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const nsAttr = (ns: XmlNamespace | undefined): string => {
  if (ns === undefined) return "";
  const attr = ns.prefix === undefined ? "xmlns" : `xmlns:${ns.prefix}`;
  return ` ${attr}="${escapeXml(ns.uri)}"`;
};

const jsonValue = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  value: unknown,
): unknown => {
  if (value === null || value === undefined) return value;
  if (shape === undefined) return value;
  if (shape.type === "structure") {
    if (Object.keys(shape.members).length === 0) return value;
    return jsonStructure(registry, shape, value);
  }
  if (shape.type === "list") {
    if (!Array.isArray(value)) return value;
    const itemShape = memberShape(registry, shape.member);
    return value.map((item) => jsonValue(registry, itemShape, item));
  }
  if (shape.type === "map") {
    if (typeof value !== "object") return value;
    const valueShape = memberShape(registry, shape.value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = jsonValue(registry, valueShape, v);
    return out;
  }
  if (shape.type === "blob") return blobToBase64(value);
  if (shape.type === "timestamp") {
    const fmt = shape.timestampFormat;
    if (fmt === undefined || fmt === "unixTimestamp")
      return typeof value === "number" ? value : Number(value);
    return epochSecondsToTimestamp(value, fmt);
  }
  return value;
};

const jsonStructure = (
  registry: ShapeRegistry,
  shape: StructureShape,
  value: unknown,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return {};
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.location !== undefined) continue;
    const v = source[name];
    if (v === undefined) continue;
    const wire = member.jsonName ?? member.locationName ?? name;
    out[wire] = jsonValue(registry, memberShape(registry, member), v);
  }
  for (const [k, v] of Object.entries(source)) {
    if (shape.members[k] === undefined && v !== undefined) out[k] = v;
  }
  return out;
};

const xmlValue = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  member: Member | undefined,
  value: unknown,
): string => {
  if (shape === undefined) {
    if (typeof value === "object" && value !== null)
      return xmlInline(registry, value);
    return escapeXml(String(value));
  }
  if (shape.type === "structure")
    return xmlStructureBody(registry, shape, value);
  if (shape.type === "list" || shape.type === "map") return "";
  if (shape.type === "timestamp")
    return escapeXml(
      epochSecondsToTimestamp(value, member?.timestampFormat ?? shape.timestampFormat),
    );
  if (shape.type === "blob") return escapeXml(blobToBase64(value));
  if (shape.type === "boolean") return value === true ? "true" : "false";
  return escapeXml(typeof value === "string" ? value : String(value));
};

const xmlInline = (registry: ShapeRegistry, value: unknown): string => {
  if (typeof value !== "object" || value === null)
    return escapeXml(String(value));
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) =>
      typeof v === "object" && v !== null
        ? `<${k}>${xmlInline(registry, v)}</${k}>`
        : `<${k}>${escapeXml(String(v))}</${k}>`,
    )
    .join("");
};

const xmlElement = (
  registry: ShapeRegistry,
  name: string,
  shape: Shape | undefined,
  member: Member | undefined,
  value: unknown,
  ns: XmlNamespace | undefined,
): string => {
  if (value === undefined || value === null) return "";
  if (shape !== undefined && shape.type === "list") {
    return xmlListElements(registry, name, shape, member, value, ns);
  }
  if (shape !== undefined && shape.type === "map") {
    return xmlMapElement(registry, name, shape, member, value, ns);
  }
  if (shape !== undefined && shape.type === "structure") {
    const attrParts = structureAttributes(registry, shape, value);
    return `<${name}${nsAttr(ns ?? shape.xmlNamespace)}${attrParts}>${xmlStructureBody(registry, shape, value)}</${name}>`;
  }
  const inner = xmlValue(registry, shape, member, value);
  if (inner === "") return `<${name}${nsAttr(ns)}/>`;
  return `<${name}${nsAttr(ns)}>${inner}</${name}>`;
};

const structureAttributes = (
  registry: ShapeRegistry,
  shape: StructureShape,
  value: unknown,
): string => {
  if (typeof value !== "object" || value === null) return "";
  const source = value as Record<string, unknown>;
  let attrs = "";
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.xmlAttribute === true && source[name] !== undefined) {
      const wire = member.locationName ?? name;
      attrs += ` ${wire}="${escapeXml(String(source[name]))}"`;
    }
  }
  return attrs;
};

const xmlListElements = (
  registry: ShapeRegistry,
  name: string,
  shape: ListShape,
  member: Member | undefined,
  value: unknown,
  ns: XmlNamespace | undefined,
): string => {
  if (!Array.isArray(value)) return "";
  const itemShape = memberShape(registry, shape.member);
  const itemNs = shape.member.xmlNamespace;
  const flattened = member?.flattened === true || shape.flattened === true;
  if (flattened) {
    return value
      .map((item) =>
        xmlElement(registry, name, itemShape, shape.member, item, ns ?? itemNs),
      )
      .join("");
  }
  const itemName = shape.member.locationName ?? "member";
  if (value.length === 0) return `<${name}${nsAttr(ns)}/>`;
  const inner = value
    .map((item) =>
      xmlElement(registry, itemName, itemShape, shape.member, item, itemNs),
    )
    .join("");
  return `<${name}${nsAttr(ns)}>${inner}</${name}>`;
};

const xmlMapElement = (
  registry: ShapeRegistry,
  name: string,
  shape: MapShape,
  member: Member | undefined,
  value: unknown,
  ns: XmlNamespace | undefined,
): string => {
  if (typeof value !== "object" || value === null) return "";
  const source = value as Record<string, unknown>;
  const keyName = shape.key.locationName ?? "key";
  const valueName = shape.value.locationName ?? "value";
  const valueShape = memberShape(registry, shape.value);
  const flattened = member?.flattened === true || shape.flattened === true;
  const entries = Object.entries(source).map(([k, v]) => {
    const keyEl = `<${keyName}${nsAttr(shape.key.xmlNamespace)}>${escapeXml(k)}</${keyName}>`;
    const valEl = xmlElement(
      registry,
      valueName,
      valueShape,
      shape.value,
      v,
      shape.value.xmlNamespace,
    );
    return `${keyEl}${valEl}`;
  });
  if (flattened) {
    return entries.map((e) => `<${name}${nsAttr(ns)}>${e}</${name}>`).join("");
  }
  const inner = entries.map((e) => `<entry>${e}</entry>`).join("");
  return `<${name}${nsAttr(ns)}>${inner}</${name}>`;
};

const xmlStructureBody = (
  registry: ShapeRegistry,
  shape: StructureShape,
  value: unknown,
): string => {
  if (typeof value !== "object" || value === null) return "";
  const source = value as Record<string, unknown>;
  let body = "";
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.location !== undefined || member.xmlAttribute === true) continue;
    const v = source[name];
    if (v === undefined || v === null) continue;
    const memberSh = memberShape(registry, member);
    const elName = member.locationName ?? name;
    body += xmlElement(registry, elName, memberSh, member, v, member.xmlNamespace);
  }
  return body;
};

const serializeRestHeaders = (
  registry: ShapeRegistry,
  shape: StructureShape,
  source: Record<string, unknown>,
  headers: Record<string, string>,
): void => {
  for (const [name, member] of Object.entries(shape.members)) {
    const v = source[name];
    if (v === undefined || v === null) continue;
    if (member.location === "header") {
      const memberSh = memberShape(registry, member);
      headers[member.locationName ?? name] = headerString(registry, memberSh, member, v);
    } else if (member.location === "headers") {
      const prefix = member.locationName ?? "";
      if (typeof v === "object")
        for (const [k, hv] of Object.entries(v as Record<string, unknown>))
          headers[`${prefix}${k}`] = String(hv);
    }
  }
};

const headerString = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  member: Member,
  value: unknown,
): string => {
  if (shape !== undefined && shape.type === "list" && Array.isArray(value)) {
    const itemShape = memberShape(registry, shape.member);
    return value
      .map((item) => headerString(registry, itemShape, shape.member, item))
      .join(", ");
  }
  if (shape !== undefined && shape.type === "timestamp")
    return epochSecondsToTimestamp(value, member.timestampFormat ?? shape.timestampFormat ?? "rfc822");
  if (shape !== undefined && shape.type === "structure") return String(value);
  if (shape !== undefined && shape.type === "map") return String(value);
  if (shape !== undefined) return scalarToWireString(shape, value, member.timestampFormat);
  return String(value);
};

const restStatusCode = (
  shape: StructureShape,
  source: Record<string, unknown>,
): number | undefined => {
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.location === "statusCode" && source[name] !== undefined)
      return Number(source[name]);
  }
  return undefined;
};

const bodyMembersOf = (shape: StructureShape): StructureShape => {
  const members: Record<string, Member> = {};
  for (const [name, member] of Object.entries(shape.members))
    if (member.location === undefined && member.xmlAttribute !== true)
      members[name] = member;
  const out: StructureShape = { type: "structure", members };
  if (shape.xmlNamespace !== undefined) out.xmlNamespace = shape.xmlNamespace;
  return out;
};

const serializeRest = (req: SerializeRequest): CodecResult => {
  const { protocol, registry, shape } = req;
  const isXml = protocol === "rest-xml";
  const contentType = isXml ? contentTypes["rest-xml"] : contentTypes["rest-json"];
  const headers: Record<string, string> = {};
  if (shape === undefined || shape.type !== "structure") {
    const body =
      req.result === undefined || req.result === null
        ? ""
        : isXml
          ? ""
          : JSON.stringify(req.result);
    return { body, contentType, headers };
  }
  const source =
    typeof req.result === "object" && req.result !== null
      ? (req.result as Record<string, unknown>)
      : {};
  serializeRestHeaders(registry, shape, source, headers);
  const statusCode = restStatusCode(shape, source);
  const payloadName = shape.payload;
  const payloadMemberName =
    payloadName ??
    Object.entries(shape.members).find(([, m]) => m.payload === true)?.[0];

  if (payloadMemberName !== undefined) {
    const member = shape.members[payloadMemberName];
    const memberSh = memberShape(registry, member);
    const v = source[payloadMemberName];
    if (v === undefined || v === null)
      return { body: "", contentType, headers, ...(statusCode !== undefined ? { statusCode } : {}) };
    if (
      memberSh !== undefined &&
      memberSh.type === "structure" &&
      Object.keys(memberSh.members).length === 0 &&
      !isXml
    )
      return {
        body: JSON.stringify(v),
        contentType,
        headers,
        ...(statusCode !== undefined ? { statusCode } : {}),
      };
    if (memberSh !== undefined && memberSh.type === "structure") {
      if (isXml) {
        const explicitName =
          member.locationName !== undefined &&
          member.locationName !== payloadMemberName
            ? member.locationName
            : undefined;
        const rootName =
          explicitName ?? memberSh.locationName ?? payloadMemberName;
        const attrParts = structureAttributes(registry, memberSh, v);
        const body = `<${rootName}${nsAttr(memberSh.xmlNamespace ?? member.xmlNamespace)}${attrParts}>${xmlStructureBody(registry, memberSh, v)}</${rootName}>`;
        return { body, contentType, headers, ...(statusCode !== undefined ? { statusCode } : {}) };
      }
      return {
        body: JSON.stringify(jsonStructure(registry, memberSh, v)),
        contentType,
        headers,
        ...(statusCode !== undefined ? { statusCode } : {}),
      };
    }
    if (memberSh !== undefined && memberSh.type === "blob")
      return { body: typeof v === "string" ? v : blobToBase64(v), contentType: "application/octet-stream", headers, ...(statusCode !== undefined ? { statusCode } : {}) };
    if (memberSh !== undefined && memberSh.type === "string")
      return { body: String(v), contentType: "text/plain", headers, ...(statusCode !== undefined ? { statusCode } : {}) };
    return {
      body: JSON.stringify(jsonValue(registry, memberSh, v)),
      contentType,
      headers,
      ...(statusCode !== undefined ? { statusCode } : {}),
    };
  }

  const bodyShape = bodyMembersOf(shape);
  const hasBody = Object.keys(bodyShape.members).some(
    (k) => source[k] !== undefined && source[k] !== null,
  );
  if (isXml) {
    if (!hasBody)
      return { body: "", contentType, headers, ...(statusCode !== undefined ? { statusCode } : {}) };
    const rootName =
      shape.locationName ?? req.outputShapeName ?? `${req.operation}Response`;
    const attrParts = structureAttributes(registry, shape, source);
    const body = `<${rootName}${nsAttr(shape.xmlNamespace)}${attrParts}>${xmlStructureBody(registry, bodyShape, source)}</${rootName}>`;
    return { body, contentType, headers, ...(statusCode !== undefined ? { statusCode } : {}) };
  }
  const body = hasBody ? JSON.stringify(jsonStructure(registry, bodyShape, source)) : "{}";
  return { body, contentType, headers, ...(statusCode !== undefined ? { statusCode } : {}) };
};

const serializeQuery = (req: SerializeRequest): CodecResult => {
  const { registry, shape } = req;
  const wrapper = req.resultWrapper ?? `${req.operation}Result`;
  const ns = req.xmlNamespace;
  const nsString = ns === undefined ? "" : ` xmlns="${escapeXml(ns)}"`;
  const inner =
    shape !== undefined && shape.type === "structure"
      ? xmlStructureBody(registry, shape, req.result ?? {})
      : "";
  const body = `<${req.operation}Response${nsString}><${wrapper}>${inner}</${wrapper}></${req.operation}Response>`;
  return { body, contentType: contentTypes.query };
};

const serializeJson = (req: SerializeRequest): CodecResult => {
  const { registry, shape } = req;
  const value =
    shape !== undefined && shape.type === "structure"
      ? jsonStructure(registry, shape, req.result ?? {})
      : (req.result ?? {});
  return { body: JSON.stringify(value), contentType: contentTypes.json };
};

export const serializeShapeOutput = (req: SerializeRequest): CodecResult => {
  switch (req.protocol) {
    case "query":
      return serializeQuery(req);
    case "json":
      return serializeJson(req);
    case "rest-json":
    case "rest-xml":
      return serializeRest(req);
  }
};
