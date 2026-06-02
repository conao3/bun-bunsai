import type {
  Protocol,
  ShapeRegistry,
  StructureShape,
} from "../types.ts";
import { contentTypes } from "./common.ts";
import type { CodecResult } from "./common.ts";

export type SerializeErrorRequest = {
  protocol: Protocol;
  registry: ShapeRegistry;
  shape: StructureShape | undefined;
  code: string;
  message?: string;
  statusCode: number;
  data?: Record<string, unknown>;
  senderFault?: boolean;
};

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const xmlInline = (value: unknown): string => {
  if (typeof value !== "object" || value === null)
    return escapeXml(String(value));
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `<${k}>${xmlInline(v)}</${k}>`)
    .join("");
};

const dataMembersBody = (
  shape: StructureShape | undefined,
  data: Record<string, unknown>,
): string => {
  if (shape === undefined) {
    return Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `<${k}>${xmlInline(v)}</${k}>`)
      .join("");
  }
  let body = "";
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.location !== undefined) continue;
    const v = data[name];
    if (v === undefined || v === null) continue;
    const wire = member.locationName ?? name;
    body += `<${wire}>${xmlInline(v)}</${wire}>`;
  }
  for (const [k, v] of Object.entries(data)) {
    if (shape.members[k] === undefined && v !== undefined)
      body += `<${k}>${xmlInline(v)}</${k}>`;
  }
  return body;
};

const dataMembersJson = (
  shape: StructureShape | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  if (shape === undefined) return { ...data };
  const out: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(shape.members)) {
    if (member.location !== undefined) continue;
    const v = data[name];
    if (v === undefined || v === null) continue;
    out[member.jsonName ?? name] = v;
  }
  for (const [k, v] of Object.entries(data))
    if (shape.members[k] === undefined && v !== undefined) out[k] = v;
  return out;
};

export const serializeShapeError = (
  req: SerializeErrorRequest,
): CodecResult => {
  const data = req.data ?? {};
  const message = req.message;
  switch (req.protocol) {
    case "query":
    case "rest-xml": {
      const fault = req.senderFault === false ? "Receiver" : "Sender";
      let inner = `<Type>${fault}</Type><Code>${escapeXml(req.code)}</Code>`;
      if (message !== undefined && data.Message === undefined && data.message === undefined)
        inner += `<Message>${escapeXml(message)}</Message>`;
      inner += dataMembersBody(req.shape, data);
      const body = `<ErrorResponse><Error>${inner}</Error><RequestId>foo-id</RequestId></ErrorResponse>`;
      return {
        body,
        contentType: contentTypes[req.protocol],
        statusCode: req.statusCode,
      };
    }
    case "json": {
      const payload: Record<string, unknown> = { __type: req.code };
      if (message !== undefined && data.Message === undefined)
        payload.Message = message;
      Object.assign(payload, dataMembersJson(req.shape, data));
      return {
        body: JSON.stringify(payload),
        contentType: contentTypes.json,
        statusCode: req.statusCode,
      };
    }
    case "rest-json": {
      const payload: Record<string, unknown> = {};
      if (message !== undefined && data.Message === undefined)
        payload.message = message;
      Object.assign(payload, dataMembersJson(req.shape, data));
      const headers: Record<string, string> = {
        "X-Amzn-Errortype": req.code,
      };
      return {
        body: JSON.stringify(payload),
        contentType: contentTypes["rest-json"],
        headers,
        statusCode: req.statusCode,
      };
    }
  }
};
