import { expect, it } from "bun:test";
import {
  parseInput,
  serializeError,
  serializeOutput,
} from "../../apps/server/src/core/protocol.ts";
import { getShape, loadRegistry } from "../../apps/server/src/core/shapes.ts";
import type {
  AwsError,
  ParsedRequest,
  Protocol,
  ShapeRegistry,
  StructureShape,
} from "../../apps/server/src/core/types.ts";
import { knownGaps } from "./known-gaps.ts";

export type VendorHttp = {
  method: string;
  requestUri: string;
  responseCode?: number;
};

export type VendorGiven = {
  name: string;
  http: VendorHttp;
  input?: { shape: string };
  output?: { shape: string };
  errors?: { shape: string }[];
  documentation?: string;
  idempotent?: boolean;
};

export type VendorSerialized = {
  method?: string;
  uri?: string;
  body?: string;
  headers?: Record<string, string>;
};

export type VendorResponse = {
  status_code?: number;
  headers?: Record<string, string>;
  body?: string;
};

export type VendorCase = {
  id: string;
  given: VendorGiven;
  description?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  serialized?: VendorSerialized;
  response?: VendorResponse;
};

export type VendorMetadata = {
  protocol: string;
  protocols?: string[];
  apiVersion?: string;
  jsonVersion?: string;
  targetPrefix?: string;
};

export type VendorSuite = {
  description?: string;
  metadata: VendorMetadata;
  shapes?: Record<string, unknown>;
  cases: VendorCase[];
};

const supportedProtocols = ["query", "json", "rest-json", "rest-xml"] as const;

const isSupportedProtocol = (value: string): value is Protocol =>
  (supportedProtocols as readonly string[]).includes(value);

const stripMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripMetadata);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (key === "$metadata") continue;
      if (entry === undefined) continue;
      result[key] = stripMetadata(entry);
    }
    return result;
  }
  return value;
};

const deepEqualNormalized = (a: unknown, b: unknown): boolean => {
  const left = stripMetadata(a);
  const right = stripMetadata(b);
  return JSON.stringify(sortKeys(left)) === JSON.stringify(sortKeys(right));
};

const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, sortKeys(v)] as const)
      .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
    return Object.fromEntries(entries);
  }
  return value;
};

const parseFormSet = (text: string): Record<string, string> => {
  const params = new URLSearchParams(text);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) result[key] = value;
  return result;
};

const normalizeXml = (text: string): string =>
  text
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();

const compareBody = (
  protocol: Protocol,
  actual: string,
  expected: string,
): void => {
  switch (protocol) {
    case "json":
    case "rest-json": {
      const actualJson = actual.trim() === "" ? {} : JSON.parse(actual);
      const expectedJson = expected.trim() === "" ? {} : JSON.parse(expected);
      expect(sortKeys(actualJson)).toEqual(sortKeys(expectedJson));
      return;
    }
    case "rest-xml":
      expect(normalizeXml(actual)).toBe(normalizeXml(expected));
      return;
    case "query":
      expect(parseFormSet(actual)).toEqual(parseFormSet(expected));
      return;
  }
};

const compareHeaders = (
  actual: Record<string, string>,
  expected: Record<string, string> | undefined,
): void => {
  if (expected === undefined) return;
  const lowered: Record<string, string> = {};
  for (const [key, value] of Object.entries(actual))
    lowered[key.toLowerCase()] = value;
  for (const [key, value] of Object.entries(expected)) {
    expect(lowered[key.toLowerCase()]).toBe(value);
  }
};

const buildRequest = (
  protocol: Protocol,
  given: VendorGiven,
  serialized: VendorSerialized,
): ParsedRequest => {
  const uri = serialized.uri ?? given.http.requestUri ?? "/";
  const url = new URL(`http://localhost${uri}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(serialized.headers ?? {})) {
    headers.set(key, value);
  }
  const target = headers.get("X-Amz-Target") ?? undefined;
  return {
    method: serialized.method ?? given.http.method ?? "POST",
    url,
    path: url.pathname,
    query: url.searchParams,
    headers,
    bodyText: serialized.body ?? "",
    service: "conformance",
    region: "us-east-1",
    account: "000000000000",
    protocol,
    target,
  };
};

const toAwsError = (vcase: VendorCase): AwsError => {
  const code = vcase.errorCode ?? "UnknownError";
  const message =
    vcase.errorMessage ??
    (typeof vcase.error?.Message === "string"
      ? (vcase.error.Message as string)
      : "");
  return {
    __awsError: true,
    code,
    message,
    statusCode: vcase.response?.status_code ?? 400,
  };
};

const runInputCase = (
  protocol: Protocol,
  vcase: VendorCase,
  registry: ShapeRegistry,
): void => {
  const serialized = vcase.serialized ?? {};
  const request = buildRequest(protocol, vcase.given, serialized);
  const shapeName = vcase.given.input?.shape;
  const shape =
    shapeName === undefined ? undefined : getShape(registry, shapeName);
  const actual = parseInput(request, {
    registry,
    shape,
    requestUri: vcase.given.http.requestUri,
  });
  expect(deepEqualNormalized(actual, vcase.params ?? {})).toBe(true);
};

const runOutputCase = (
  protocol: Protocol,
  vcase: VendorCase,
  registry: ShapeRegistry,
): void => {
  const response = vcase.response ?? {};
  if (vcase.error !== undefined || vcase.errorCode !== undefined) {
    const errShapeName = vcase.given.errors?.[0]?.shape;
    const errShape =
      errShapeName === undefined ? undefined : getShape(registry, errShapeName);
    const serialized = serializeError(protocol, toAwsError(vcase), {
      registry,
      shape:
        errShape !== undefined && errShape.type === "structure"
          ? (errShape as StructureShape)
          : undefined,
      code: vcase.errorCode,
    });
    if (response.body !== undefined)
      compareBody(protocol, serialized.body, response.body);
    compareHeaders(
      { "Content-Type": serialized.contentType, ...serialized.headers },
      response.headers,
    );
    return;
  }
  const outShapeName = vcase.given.output?.shape;
  const outShape =
    outShapeName === undefined ? undefined : getShape(registry, outShapeName);
  const serialized = serializeOutput(protocol, vcase.given.name, vcase.result ?? {}, {
    registry,
    shape: outShape,
    outputShapeName: outShapeName,
  });
  if (response.body !== undefined)
    compareBody(protocol, serialized.body, response.body);
  compareHeaders(
    { "Content-Type": serialized.contentType, ...serialized.headers },
    response.headers,
  );
};

const isGap = (
  id: string,
  direction: "input" | "output",
): boolean =>
  knownGaps.includes(id) ||
  knownGaps.includes(`${id}:${direction}`);

export const runSuites = (
  direction: "input" | "output",
  suites: VendorSuite[],
): void => {
  for (const suite of suites) {
    const rawProtocol = suite.metadata.protocol;
    if (!isSupportedProtocol(rawProtocol)) {
      it.skip(`[${rawProtocol}] ${suite.description ?? "suite"}`, () => {});
      continue;
    }
    const protocol = rawProtocol;
    const registry = loadRegistry(
      suite.shapes as Parameters<typeof loadRegistry>[0],
    );
    for (const vcase of suite.cases) {
      const label = `${vcase.id} (${vcase.description ?? vcase.given.name})`;
      if (isGap(vcase.id, direction)) {
        it.skip(label, () => {});
        continue;
      }
      it(label, () => {
        if (direction === "input") {
          runInputCase(protocol, vcase, registry);
        } else {
          runOutputCase(protocol, vcase, registry);
        }
      });
    }
  }
};

export const loadSuites = async (path: string): Promise<VendorSuite[]> => {
  const url = new URL(path, import.meta.url);
  return (await Bun.file(url).json()) as VendorSuite[];
};
