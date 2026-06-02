import type {
  Member,
  Protocol,
  ScalarShape,
  Shape,
  ShapeRegistry,
  TimestampFormat,
} from "../types.ts";

export type CodecResult = {
  body: string;
  contentType: string;
  headers?: Record<string, string>;
  statusCode?: number;
};

export const contentTypes = {
  query: "text/xml",
  ec2: "text/xml;charset=UTF-8",
  json: "application/x-amz-json-1.1",
  "rest-json": "application/json",
  "rest-xml": "application/xml",
} as const satisfies Record<Protocol, string>;

export const jsonContentType = (jsonVersion: string | undefined): string =>
  `application/x-amz-json-${jsonVersion ?? "1.1"}`;

export const memberShape = (
  registry: ShapeRegistry,
  member: Member,
): Shape | undefined => registry.shapes[member.shape];

const numberFromString = (text: string): number | string => {
  if (text === "NaN" || text === "Infinity" || text === "-Infinity")
    return text;
  const n = Number(text);
  return Number.isNaN(n) ? text : n;
};

export const parseScalar = (shape: ScalarShape, text: string): unknown => {
  switch (shape.type) {
    case "boolean":
      return text === "true";
    case "integer":
    case "long":
    case "double":
    case "float":
      return numberFromString(text);
    case "blob":
      return blobFromBase64(text);
    case "timestamp":
      return timestampToEpochSeconds(text, shape.timestampFormat);
    default:
      return text;
  }
};

export const blobFromBase64 = (text: string): string => {
  try {
    return Buffer.from(text, "base64").toString("binary");
  } catch {
    return text;
  }
};

export const blobToBase64 = (value: unknown): string => {
  if (typeof value === "string")
    return Buffer.from(value, "binary").toString("base64");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  return Buffer.from(String(value), "binary").toString("base64");
};

const epochFromDate = (date: Date): number => Math.floor(date.getTime() / 1000);

export const timestampToEpochSeconds = (
  raw: unknown,
  _format: TimestampFormat | undefined,
): number | unknown => {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Math.floor(Number(trimmed));
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return epochFromDate(new Date(parsed));
  }
  return raw;
};

const pad = (n: number): string => String(n).padStart(2, "0");

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const epochSecondsToTimestamp = (
  value: unknown,
  format: TimestampFormat | undefined,
): string => {
  if (typeof value === "string") return value;
  const seconds = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(seconds)) return String(value);
  const date = new Date(seconds * 1000);
  switch (format) {
    case "rfc822": {
      const day = days[date.getUTCDay()];
      const month = months[date.getUTCMonth()];
      return `${day}, ${pad(date.getUTCDate())} ${month} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT`;
    }
    case "unixTimestamp":
      return String(seconds);
    default:
      return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
  }
};

export const scalarToWireString = (
  shape: ScalarShape,
  value: unknown,
  format: TimestampFormat | undefined,
): string => {
  if (shape.type === "timestamp")
    return epochSecondsToTimestamp(value, format ?? shape.timestampFormat);
  if (shape.type === "blob") return blobToBase64(value);
  if (shape.type === "boolean") return value === true ? "true" : "false";
  return String(value);
};

export const wireName = (
  fallback: string,
  member: Member,
  preferQueryName: boolean,
): string => {
  if (preferQueryName && member.queryName !== undefined)
    return member.queryName;
  return member.locationName ?? fallback;
};
