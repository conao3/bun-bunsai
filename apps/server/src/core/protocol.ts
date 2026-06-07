import type {
  AwsError,
  ParsedRequest,
  Protocol,
  Shape,
  ShapeRegistry,
  StructureShape,
} from "./types.ts";
import { parseShapeInput } from "./codec/parse.ts";
import { serializeShapeOutput } from "./codec/serialize.ts";
import { serializeShapeError } from "./codec/error.ts";
import type { CodecResult } from "./codec/common.ts";

const contentTypes = {
  query: "text/xml",
  ec2: "text/xml;charset=UTF-8",
  json: "application/x-amz-json-1.1",
  "rest-json": "application/json",
  "rest-xml": "application/xml",
} as const satisfies Record<Protocol, string>;

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const unescapeXml = (value: string): string =>
  value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");

const toXmlBody = (value: unknown, indent: string): string => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => `${indent}<member>${toXmlInline(item, indent)}</member>`)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${indent}<${k}>${toXmlInline(v, indent)}</${k}>`)
      .join("\n");
  }
  return escapeXml(String(value));
};

const toXmlInline = (value: unknown, indent: string): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    return `\n${toXmlBody(value, `${indent}  `)}\n${indent}`;
  }
  return escapeXml(String(value));
};

const buildXml = (
  rootName: string,
  body: Record<string, unknown>,
  attributes: Record<string, string> = {},
): string => {
  const attrs = Object.entries(attributes)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join("");
  const inner = toXmlBody(body, "  ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}${attrs}>\n${inner}\n</${rootName}>`;
};

const parseXml = (xml: string): Record<string, unknown> => {
  const stripped = xml.replace(/<\?xml[^?]*\?>/, "").trim();
  const rootMatch = stripped.match(/^<([\w:.-]+)[^>]*>([\s\S]*)<\/\1>\s*$/);
  if (!rootMatch) return {};
  return parseXmlNode(rootMatch[2]) as Record<string, unknown>;
};

const parseXmlNode = (xml: string): unknown => {
  const children: { tag: string; value: unknown }[] = [];
  const tagRe = /<([\w:.-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null = tagRe.exec(xml);
  let cursor = 0;
  while (match !== null) {
    cursor = tagRe.lastIndex;
    children.push({ tag: match[1], value: parseXmlNode(match[2]) });
    match = tagRe.exec(xml);
  }
  if (children.length === 0) {
    return unescapeXml(xml.trim());
  }
  if (children.every((c) => c.tag === "member")) {
    return children.map((c) => c.value);
  }
  const result: Record<string, unknown> = {};
  for (const child of children) {
    const existing = result[child.tag];
    if (existing === undefined) {
      result[child.tag] = child.value;
    } else if (Array.isArray(existing)) {
      existing.push(child.value);
    } else {
      result[child.tag] = [existing, child.value];
    }
    void cursor;
  }
  return result;
};

const parseFormBody = (bodyText: string): Record<string, unknown> => {
  const params = new URLSearchParams(bodyText);
  const result: Record<string, unknown> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
};

export type ParseOptions = {
  registry?: ShapeRegistry;
  shape?: Shape;
  requestUri?: string;
};

export type SerializeOptions = {
  registry?: ShapeRegistry;
  shape?: Shape;
  resultWrapper?: string;
  xmlNamespace?: string;
  outputShapeName?: string;
  jsonVersion?: string;
};

export type SerializeErrorOptions = {
  registry?: ShapeRegistry;
  shape?: StructureShape;
  code?: string;
  senderFault?: boolean;
  data?: Record<string, unknown>;
  jsonVersion?: string;
  requestId?: string;
};

const fallbackParseInput = (req: ParsedRequest): Record<string, unknown> => {
  switch (req.protocol) {
    case "query":
    case "ec2": {
      const form = parseFormBody(req.bodyText);
      if (req.query.size > 0) {
        for (const [key, value] of req.query.entries()) form[key] = value;
      }
      return form;
    }
    case "json":
    case "rest-json": {
      if (req.bodyText.trim() === "") return {};
      try {
        const parsed = JSON.parse(req.bodyText);
        return typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    case "rest-xml": {
      if (req.bodyText.trim() === "") return {};
      return parseXml(req.bodyText);
    }
  }
};

export const parseInput = (
  req: ParsedRequest,
  opts?: ParseOptions,
): Record<string, unknown> => {
  if (opts?.registry !== undefined) {
    return parseShapeInput({
      protocol: req.protocol,
      registry: opts.registry,
      shape: opts.shape,
      method: req.method,
      path: req.path,
      requestUri: opts.requestUri,
      query: req.query,
      headers: req.headers,
      bodyText: req.bodyText,
      bodyBytes: req.bodyBytes,
    });
  }
  return fallbackParseInput(req);
};

const fallbackSerializeOutput = (
  protocol: Protocol,
  operation: string,
  result: unknown,
): CodecResult => {
  switch (protocol) {
    case "query":
    case "ec2": {
      const body = (result ?? {}) as Record<string, unknown>;
      return {
        body: buildXml(`${operation}Response`, body, {
          xmlns: "http://queue.amazonaws.com/doc/2012-11-05/",
        }),
        contentType: contentTypes[protocol],
      };
    }
    case "json":
      return {
        body: JSON.stringify(result ?? {}),
        contentType: contentTypes.json,
      };
    case "rest-json":
      return {
        body: result === undefined ? "" : JSON.stringify(result),
        contentType: contentTypes["rest-json"],
      };
    case "rest-xml": {
      if (
        typeof result === "object" &&
        result !== null &&
        "__xml" in (result as Record<string, unknown>)
      ) {
        const tagged = result as { __xml: string };
        return { body: tagged.__xml, contentType: contentTypes["rest-xml"] };
      }
      const body = (result ?? {}) as Record<string, unknown>;
      return {
        body: buildXml(`${operation}Response`, body),
        contentType: contentTypes["rest-xml"],
      };
    }
  }
};

export const serializeOutput = (
  protocol: Protocol,
  operation: string,
  result: unknown,
  opts?: SerializeOptions,
): CodecResult => {
  const isXmlEscapeHatch =
    typeof result === "object" &&
    result !== null &&
    "__xml" in (result as Record<string, unknown>);
  if (opts?.registry !== undefined && !isXmlEscapeHatch) {
    return serializeShapeOutput({
      protocol,
      registry: opts.registry,
      shape: opts.shape,
      operation,
      result,
      resultWrapper: opts.resultWrapper,
      xmlNamespace: opts.xmlNamespace,
      outputShapeName: opts.outputShapeName,
      jsonVersion: opts.jsonVersion,
    });
  }
  return fallbackSerializeOutput(protocol, operation, result);
};

const fallbackSerializeError = (
  protocol: Protocol,
  error: AwsError,
  requestId?: string,
): CodecResult => {
  switch (protocol) {
    case "ec2":
      return {
        body: buildXml("Response", {
          Errors: { Error: { Code: error.code, Message: error.message } },
          RequestID: requestId ?? "foo-id",
        }),
        contentType: contentTypes.ec2,
        statusCode: error.statusCode,
      };
    case "query":
    case "rest-xml":
      return {
        body: buildXml("ErrorResponse", {
          Error: { Code: error.code, Message: error.message },
          RequestId: requestId ?? "foo-id",
        }),
        contentType: contentTypes[protocol],
        statusCode: error.statusCode,
      };
    case "json":
      return {
        body: JSON.stringify({
          __type: error.code,
          message: error.message,
        }),
        contentType: contentTypes.json,
        statusCode: error.statusCode,
      };
    case "rest-json":
      return {
        body: JSON.stringify({ code: error.code, message: error.message }),
        contentType: contentTypes["rest-json"],
        statusCode: error.statusCode,
      };
  }
};

export const serializeError = (
  protocol: Protocol,
  error: AwsError,
  opts?: SerializeErrorOptions,
): CodecResult => {
  if (opts?.registry !== undefined) {
    return serializeShapeError({
      protocol,
      registry: opts.registry,
      shape: opts.shape,
      code: opts.code ?? error.code,
      message: error.message,
      statusCode: error.statusCode,
      senderFault: opts.senderFault,
      data: opts.data,
      jsonVersion: opts.jsonVersion,
      requestId: opts.requestId,
    });
  }
  return fallbackSerializeError(protocol, error, opts?.requestId);
};
