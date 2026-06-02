import type {
  ListShape,
  MapShape,
  Member,
  Protocol,
  Shape,
  ShapeRegistry,
  StructureShape,
} from "../types.ts";
import {
  blobFromBase64,
  memberShape,
  parseScalar,
  timestampToEpochSeconds,
} from "./common.ts";

export type ParseRequest = {
  protocol: Protocol;
  registry: ShapeRegistry;
  shape: Shape | undefined;
  method: string;
  path: string;
  requestUri?: string;
  query: URLSearchParams;
  headers: Headers;
  bodyText: string;
};

const parseValueFromString = (
  shape: Shape | undefined,
  text: string,
): unknown => {
  if (shape === undefined) return text;
  if (
    shape.type === "structure" ||
    shape.type === "list" ||
    shape.type === "map"
  )
    return text;
  return parseScalar(shape, text);
};

const parseJsonValue = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  value: unknown,
): unknown => {
  if (value === null || value === undefined) return value;
  if (shape === undefined) return value;
  if (shape.type === "structure") {
    if (Object.keys(shape.members).length === 0) return value;
    return parseJsonStructure(registry, shape, value);
  }
  if (shape.type === "list") {
    if (!Array.isArray(value)) return value;
    const itemShape = memberShape(registry, shape.member);
    return value.map((item) => parseJsonValue(registry, itemShape, item));
  }
  if (shape.type === "map") {
    if (typeof value !== "object") return value;
    const valueShape = memberShape(registry, shape.value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = parseJsonValue(registry, valueShape, v);
    return out;
  }
  if (shape.type === "blob" && typeof value === "string")
    return blobFromBase64(value);
  if (shape.type === "timestamp")
    return timestampToEpochSeconds(value, shape.timestampFormat);
  return value;
};

const parseJsonStructure = (
  registry: ShapeRegistry,
  shape: StructureShape,
  value: unknown,
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null)
    return {} as Record<string, unknown>;
  const source = value as Record<string, unknown>;
  const byWire: Record<string, string> = {};
  for (const [name, member] of Object.entries(shape.members)) {
    const wire = member.jsonName ?? member.locationName ?? name;
    byWire[wire] = name;
  }
  const out: Record<string, unknown> = {};
  for (const [wire, raw] of Object.entries(source)) {
    const name = byWire[wire] ?? wire;
    const member = shape.members[name];
    const memberSh =
      member === undefined ? undefined : memberShape(registry, member);
    out[name] = parseJsonValue(registry, memberSh, raw);
  }
  return out;
};

const parseBodyJson = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  bodyText: string,
): Record<string, unknown> => {
  if (bodyText.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) return {};
  if (shape !== undefined && shape.type === "structure")
    return parseJsonStructure(registry, shape, parsed);
  return parsed as Record<string, unknown>;
};

const splitHeaderList = (text: string): string[] => {
  const result: string[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && (text[i] === " " || text[i] === ",")) i += 1;
    if (i >= text.length) break;
    if (text[i] === '"') {
      i += 1;
      let value = "";
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && i + 1 < text.length) {
          value += text[i + 1];
          i += 2;
        } else {
          value += text[i];
          i += 1;
        }
      }
      i += 1;
      result.push(value);
    } else {
      let value = "";
      while (i < text.length && text[i] !== ",") {
        value += text[i];
        i += 1;
      }
      result.push(value.trim());
    }
  }
  return result;
};

const parseHeaderValue = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  raw: string,
): unknown => {
  if (shape === undefined) return raw;
  if (shape.type === "list") {
    const itemShape = memberShape(registry, shape.member);
    return splitHeaderList(raw).map((item) =>
      parseValueFromString(itemShape, item),
    );
  }
  if (shape.type === "timestamp")
    return timestampToEpochSeconds(raw, shape.timestampFormat ?? "rfc822");
  return parseValueFromString(shape, raw);
};

const parseQueryMember = (
  registry: ShapeRegistry,
  member: Member,
  shape: Shape | undefined,
  wire: string,
  query: URLSearchParams,
): unknown => {
  if (shape !== undefined && shape.type === "list") {
    const all = query.getAll(wire);
    if (all.length === 0) return undefined;
    const itemShape = memberShape(registry, shape.member);
    return all.map((v) => parseValueFromString(itemShape, v));
  }
  const raw = query.get(wire);
  if (raw === null) return undefined;
  if (shape !== undefined && shape.type === "timestamp")
    return timestampToEpochSeconds(raw, shape.timestampFormat ?? "iso8601");
  return parseValueFromString(shape, raw);
};

const labelValues = (
  requestUri: string,
  path: string,
): Record<string, string> => {
  const out: Record<string, string> = {};
  const tmplParts = requestUri.split("?")[0].split("/");
  const pathParts = path.split("/");
  for (let i = 0; i < tmplParts.length; i += 1) {
    const seg = tmplParts[i];
    const greedy = seg.match(/^\{(.+)\+\}$/);
    if (greedy !== null) {
      const rest = pathParts.slice(i).join("/");
      out[greedy[1]] = decodeURIComponent(rest);
      break;
    }
    const simple = seg.match(/^\{(.+)\}$/);
    if (simple !== null && pathParts[i] !== undefined)
      out[simple[1]] = decodeURIComponent(pathParts[i]);
  }
  return out;
};

const parseRestStructure = (
  req: ParseRequest,
  shape: StructureShape,
): Record<string, unknown> => {
  const { registry } = req;
  const out: Record<string, unknown> = {};
  const labels =
    req.requestUri === undefined ? {} : labelValues(req.requestUri, req.path);
  let mapAllQueryMember: string | undefined;
  let payloadMember: string | undefined;
  const bodyMembers: Record<string, Member> = {};
  const boundQueryNames = new Set<string>();
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.location !== "querystring") continue;
    const memberSh = memberShape(registry, member);
    if (memberSh !== undefined && memberSh.type === "map") continue;
    boundQueryNames.add(member.locationName ?? name);
  }

  for (const [name, member] of Object.entries(shape.members)) {
    const memberSh = memberShape(registry, member);
    if (member.location === "uri") {
      const wire = member.locationName ?? name;
      const raw = labels[wire];
      if (raw !== undefined) out[name] = parseValueFromString(memberSh, raw);
      continue;
    }
    if (member.location === "querystring") {
      if (memberSh !== undefined && memberSh.type === "map") {
        mapAllQueryMember = name;
        continue;
      }
      const wire = member.locationName ?? name;
      const value = parseQueryMember(
        registry,
        member,
        memberSh,
        wire,
        req.query,
      );
      if (value !== undefined) out[name] = value;
      continue;
    }
    if (member.location === "header") {
      const wire = (member.locationName ?? name).toLowerCase();
      const raw = req.headers.get(wire);
      if (raw !== null && raw !== undefined)
        out[name] =
          member.jsonvalue === true
            ? blobFromBase64(raw)
            : parseHeaderValue(registry, memberSh, raw);
      continue;
    }
    if (member.location === "headers") {
      const prefix = (member.locationName ?? "").toLowerCase();
      const collected: Record<string, unknown> = {};
      const valueShape =
        memberSh !== undefined && memberSh.type === "map"
          ? memberShape(registry, memberSh.value)
          : undefined;
      req.headers.forEach((hv, hk) => {
        if (hk.toLowerCase().startsWith(prefix)) {
          const key = hk.toLowerCase().slice(prefix.length);
          collected[key] = parseValueFromString(valueShape, hv);
        }
      });
      out[name] = collected;
      continue;
    }
    if (shape.payload === name || member.payload === true) {
      payloadMember = name;
      continue;
    }
    bodyMembers[name] = member;
  }

  if (mapAllQueryMember !== undefined) {
    const member = shape.members[mapAllQueryMember];
    const memberSh = memberShape(registry, member) as MapShape | undefined;
    const valueShape =
      memberSh === undefined
        ? undefined
        : memberShape(registry, memberSh.value);
    const valueIsList = valueShape !== undefined && valueShape.type === "list";
    const collected: Record<string, unknown> = {};
    for (const [k, v] of req.query.entries()) {
      if (!valueIsList && boundQueryNames.has(k)) continue;
      const existing = collected[k];
      const parsed =
        valueShape !== undefined && valueShape.type === "list"
          ? parseValueFromString(memberShape(registry, valueShape.member), v)
          : v;
      if (valueShape !== undefined && valueShape.type === "list") {
        if (Array.isArray(existing)) existing.push(parsed);
        else collected[k] = [parsed];
      } else {
        collected[k] = parsed;
      }
    }
    if (Object.keys(collected).length > 0) out[mapAllQueryMember] = collected;
  }

  if (payloadMember !== undefined && req.bodyText.trim() !== "") {
    const member = shape.members[payloadMember];
    const memberSh = memberShape(registry, member);
    const isDocument =
      memberSh !== undefined &&
      memberSh.type === "structure" &&
      Object.keys(memberSh.members).length === 0;
    if (isDocument) {
      try {
        out[payloadMember] = JSON.parse(req.bodyText);
      } catch {
        out[payloadMember] = req.bodyText;
      }
    } else if (memberSh !== undefined && memberSh.type === "structure") {
      if (req.protocol === "rest-xml") {
        const root = parseXmlRoot(req.bodyText);
        out[payloadMember] = parseXmlStructure(
          registry,
          memberSh,
          root.children,
          root.attrs,
        );
      } else {
        out[payloadMember] = parseBodyJson(registry, memberSh, req.bodyText);
      }
    } else if (memberSh !== undefined && memberSh.type === "blob") {
      out[payloadMember] = req.bodyText;
    } else {
      out[payloadMember] = req.bodyText;
    }
  } else if (
    Object.keys(bodyMembers).length > 0 &&
    req.bodyText.trim() !== ""
  ) {
    const bodyShape: StructureShape = {
      type: "structure",
      members: bodyMembers,
    };
    let parsedBody: Record<string, unknown>;
    if (req.protocol === "rest-xml") {
      const root = parseXmlRoot(req.bodyText);
      parsedBody = parseXmlStructure(
        registry,
        bodyShape,
        root.children,
        root.attrs,
      );
    } else {
      parsedBody = parseBodyJson(registry, bodyShape, req.bodyText);
    }
    for (const [k, v] of Object.entries(parsedBody)) out[k] = v;
  }

  return out;
};

type XmlNode = {
  name: string;
  children: XmlNode[];
  text: string;
  attrs: Record<string, string>;
};

const parseXmlRoot = (xml: string): XmlNode => {
  const stripped = xml
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .trim();
  const node = parseXmlNodes(stripped);
  return node[0] ?? { name: "", children: [], text: "", attrs: {} };
};

const unescapeXml = (value: string): string =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&#xD;", "\r")
    .replaceAll("&#13;", "\r")
    .replaceAll("&#10;", "\n")
    .replaceAll("&amp;", "&");

const parseXmlNodes = (xml: string): XmlNode[] => {
  const nodes: XmlNode[] = [];
  const tagRe = /<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let cursor = 0;
  let match: RegExpExecArray | null = tagRe.exec(xml);
  while (match !== null) {
    const name = match[1];
    const attrs = parseAttrs(match[2]);
    if (match[3] === "/") {
      nodes.push({ name, children: [], text: "", attrs });
      cursor = tagRe.lastIndex;
      tagRe.lastIndex = cursor;
      match = tagRe.exec(xml);
      continue;
    }
    const closeRe = new RegExp(`</${name}>`, "g");
    let depth = 1;
    const innerStart = tagRe.lastIndex;
    const openRe = new RegExp(`<${name}(?:\\s[^>]*)?>`, "g");
    let scan = innerStart;
    while (depth > 0) {
      closeRe.lastIndex = scan;
      const close = closeRe.exec(xml);
      if (close === null) break;
      openRe.lastIndex = scan;
      let opens = 0;
      let om: RegExpExecArray | null = openRe.exec(xml);
      while (om !== null && om.index < close.index) {
        if (om[0].endsWith("/>") === false) opens += 1;
        om = openRe.exec(xml);
      }
      depth += opens - 1;
      scan = close.index + close[0].length;
      if (depth === 0) {
        const inner = xml.slice(innerStart, close.index);
        const children = parseXmlNodes(inner);
        const text = children.length === 0 ? unescapeXml(inner) : "";
        nodes.push({ name, children, text, attrs });
        cursor = scan;
        break;
      }
    }
    tagRe.lastIndex = cursor;
    match = tagRe.exec(xml);
  }
  return nodes;
};

const parseAttrs = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    out[m[1]] = unescapeXml(m[2]);
    m = re.exec(text);
  }
  return out;
};

const childrenByName = (node: XmlNode): Record<string, XmlNode[]> => {
  const map: Record<string, XmlNode[]> = {};
  for (const child of node.children) {
    (map[child.name] ??= []).push(child);
  }
  return map;
};

const parseXmlValue = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  node: XmlNode,
): unknown => {
  if (shape === undefined) return node.text;
  if (shape.type === "structure")
    return parseXmlStructure(registry, shape, node.children, node.attrs);
  if (shape.type === "list")
    return parseXmlListItems(registry, shape, node.children);
  if (shape.type === "map")
    return parseXmlMapEntries(registry, shape, node.children);
  if (shape.type === "blob") return blobFromBase64(node.text);
  if (shape.type === "timestamp")
    return timestampToEpochSeconds(
      node.text,
      shape.timestampFormat ?? "iso8601",
    );
  return parseScalar(shape, node.text);
};

const parseXmlListItems = (
  registry: ShapeRegistry,
  shape: ListShape,
  items: XmlNode[],
): unknown[] => {
  const itemShape = memberShape(registry, shape.member);
  return items.map((item) => parseXmlValue(registry, itemShape, item));
};

const parseXmlMapEntries = (
  registry: ShapeRegistry,
  shape: MapShape,
  entries: XmlNode[],
): Record<string, unknown> => {
  const keyName = shape.key.locationName ?? "key";
  const valueName = shape.value.locationName ?? "value";
  const valueShape = memberShape(registry, shape.value);
  const out: Record<string, unknown> = {};
  for (const entry of entries) {
    const byName = childrenByName(entry);
    const keyNode = byName[keyName]?.[0];
    const valueNode = byName[valueName]?.[0];
    if (keyNode === undefined) continue;
    out[unescapeXmlText(keyNode)] =
      valueNode === undefined
        ? undefined
        : parseXmlValue(registry, valueShape, valueNode);
  }
  return out;
};

const unescapeXmlText = (node: XmlNode): string => node.text;

const parseXmlStructure = (
  registry: ShapeRegistry,
  shape: StructureShape,
  children: XmlNode[],
  attrs: Record<string, string> = {},
): Record<string, unknown> => {
  const byWire: Record<string, string> = {};
  const flattenedLists = new Set<string>();
  const attrMembers: { name: string; wire: string; member: Member }[] = [];
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.xmlAttribute === true) {
      attrMembers.push({ name, wire: member.locationName ?? name, member });
      continue;
    }
    const memberSh = memberShape(registry, member);
    if (
      memberSh !== undefined &&
      (memberSh.type === "list" || memberSh.type === "map")
    ) {
      const flat = member.flattened === true || memberSh.flattened === true;
      if (flat) {
        const wire =
          member.locationName ??
          (memberSh.type === "list"
            ? (memberSh.member.locationName ?? name)
            : name);
        byWire[wire] = name;
        flattenedLists.add(name);
        continue;
      }
    }
    byWire[member.locationName ?? name] = name;
  }

  const tmp: Record<string, XmlNode[]> = {};
  for (const child of children) (tmp[child.name] ??= []).push(child);

  const out: Record<string, unknown> = {};
  for (const { name, wire } of attrMembers) {
    if (attrs[wire] !== undefined) out[name] = attrs[wire];
  }

  for (const [wire, nodes] of Object.entries(tmp)) {
    const name = byWire[wire];
    if (name === undefined) continue;
    const member = shape.members[name];
    const memberSh = memberShape(registry, member);
    if (flattenedLists.has(name) && memberSh !== undefined) {
      if (memberSh.type === "list") {
        const itemShape = memberShape(registry, memberSh.member);
        out[name] = nodes.map((n) => parseXmlValue(registry, itemShape, n));
      } else if (memberSh.type === "map") {
        out[name] = parseXmlMapEntries(registry, memberSh, nodes);
      }
      continue;
    }
    out[name] = parseXmlValue(registry, memberSh, nodes[0]);
  }
  return out;
};

const formToTree = (entries: [string, string][]): Record<string, unknown> => {
  const root: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    const parts = key.split(".");
    let node: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (typeof node[part] !== "object" || node[part] === null)
        node[part] = {} as Record<string, unknown>;
      node = node[part] as Record<string, unknown>;
    }
    node[parts[parts.length - 1]] = value;
  }
  return root;
};

const parseQueryNode = (
  registry: ShapeRegistry,
  shape: Shape | undefined,
  node: unknown,
): unknown => {
  if (shape === undefined) return node;
  if (shape.type === "structure")
    return parseQueryStructure(registry, shape, node);
  if (shape.type === "list") return parseQueryList(registry, shape, node);
  if (shape.type === "map") return parseQueryMap(registry, shape, node);
  if (typeof node === "string") return parseScalar(shape, node);
  return node;
};

const collectIndexed = (
  node: Record<string, unknown>,
  containerKey: string | undefined,
): unknown[] => {
  const container =
    containerKey === undefined
      ? node
      : (node[containerKey] as Record<string, unknown> | undefined);
  if (container === undefined) return [];
  const indices = Object.keys(container)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  return indices.map((i) => (container as Record<string, unknown>)[i]);
};

const parseQueryList = (
  registry: ShapeRegistry,
  shape: ListShape,
  node: unknown,
): unknown[] => {
  if (typeof node !== "object" || node === null) {
    if (node === "") return [];
    return [];
  }
  const memberName = shape.member.locationName ?? "member";
  const record = node as Record<string, unknown>;
  const isFlattened =
    record[memberName] === undefined && record.member === undefined;
  const container = isFlattened
    ? undefined
    : memberName in record
      ? memberName
      : "member";
  const items = collectIndexed(record, container);
  const itemShape = memberShape(registry, shape.member);
  return items.map((item) => parseQueryNode(registry, itemShape, item));
};

const parseQueryMap = (
  registry: ShapeRegistry,
  shape: MapShape,
  node: unknown,
): Record<string, unknown> => {
  if (typeof node !== "object" || node === null) return {};
  const record = node as Record<string, unknown>;
  const container =
    record.entry === undefined
      ? record
      : (record.entry as Record<string, unknown>);
  const keyName = shape.key.locationName ?? "key";
  const valueName = shape.value.locationName ?? "value";
  const valueShape = memberShape(registry, shape.value);
  const out: Record<string, unknown> = {};
  for (const idx of Object.keys(container).filter((k) => /^\d+$/.test(k))) {
    const entry = container[idx] as Record<string, unknown>;
    const key = entry[keyName];
    if (typeof key !== "string") continue;
    out[key] = parseQueryNode(registry, valueShape, entry[valueName]);
  }
  return out;
};

const parseQueryStructure = (
  registry: ShapeRegistry,
  shape: StructureShape,
  node: unknown,
): Record<string, unknown> => {
  if (typeof node !== "object" || node === null) return {};
  const record = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(shape.members)) {
    const memberSh = memberShape(registry, member);
    const flat =
      member.flattened === true ||
      (memberSh !== undefined &&
        (memberSh.type === "list" || memberSh.type === "map") &&
        memberSh.flattened === true);
    const wire = member.queryName ?? member.locationName ?? name;
    let raw = record[wire];
    if (raw === undefined && flat && memberSh !== undefined) {
      if (memberSh.type === "list") {
        const itemName = memberSh.member.locationName;
        if (itemName !== undefined && record[itemName] !== undefined)
          raw = { [itemName]: record[itemName] };
      }
    }
    if (raw === undefined) continue;
    out[name] = parseQueryNode(registry, memberSh, raw);
  }
  return out;
};

export const parseShapeInput = (req: ParseRequest): Record<string, unknown> => {
  const { protocol, registry, shape } = req;
  if (protocol === "rest-json" || protocol === "rest-xml") {
    if (shape !== undefined && shape.type === "structure")
      return parseRestStructure(req, shape);
    if (req.bodyText.trim() === "") return {};
    return protocol === "rest-json"
      ? parseBodyJson(registry, shape, req.bodyText)
      : parseXmlStructure(
          registry,
          shape !== undefined && shape.type === "structure"
            ? shape
            : { type: "structure", members: {} },
          parseXmlRoot(req.bodyText).children,
        );
  }
  if (protocol === "json") return parseBodyJson(registry, shape, req.bodyText);
  const form = formToTree([
    ...req.query.entries(),
    ...formEntries(req.bodyText),
  ]);
  if (shape !== undefined && shape.type === "structure")
    return parseQueryStructure(registry, shape, form);
  return form;
};

const formEntries = (bodyText: string): [string, string][] => {
  if (bodyText.trim() === "") return [];
  const params = new URLSearchParams(bodyText);
  const out: [string, string][] = [];
  for (const [k, v] of params.entries()) out.push([k, v]);
  return out;
};
