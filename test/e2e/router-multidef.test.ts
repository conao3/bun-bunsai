import { describe, expect, test } from "bun:test";
import { pickService } from "../../apps/server/src/core/router.ts";
import type {
  ParsedRequest,
  ServiceDefinition,
} from "../../apps/server/src/core/types.ts";

const makeService = (
  name: string,
  matches?: (req: ParsedRequest) => boolean,
): ServiceDefinition => ({
  name,
  protocol: "rest-json",
  operations: {},
  ...(matches !== undefined ? { matches } : {}),
});

describe("pickService", () => {
  test("returns undefined for empty candidates", () => {
    expect(pickService([], "/v2/apis")).toBeUndefined();
  });

  test("returns the single candidate regardless of path", () => {
    const svc = makeService("apigateway");
    expect(pickService([svc], "/restapis")).toBe(svc);
    expect(pickService([svc], "/v2/apis")).toBe(svc);
  });

  test("prefers matched candidate over no-matches fallback", () => {
    const v1 = makeService("apigateway");
    const v2 = makeService("apigateway", (req) => req.path.startsWith("/v2/"));

    expect(pickService([v1, v2], "/v2/apis")).toBe(v2);
    expect(pickService([v2, v1], "/v2/apis")).toBe(v2);
  });

  test("falls back to no-matches definition when no match", () => {
    const v1 = makeService("apigateway");
    const v2 = makeService("apigateway", (req) => req.path.startsWith("/v2/"));

    expect(pickService([v1, v2], "/restapis")).toBe(v1);
    expect(pickService([v2, v1], "/restapis")).toBe(v1);
  });

  test("returns undefined when all candidates have matches but none match", () => {
    const v2 = makeService("apigateway", (req) => req.path.startsWith("/v2/"));
    const v3 = makeService("apigateway", (req) => req.path.startsWith("/v3/"));

    expect(pickService([v2, v3], "/restapis")).toBeUndefined();
  });

  test("first matching candidate wins when multiple match", () => {
    const v1 = makeService("apigateway");
    const v2a = makeService("apigateway", (req) => req.path.startsWith("/v2/"));
    const v2b = makeService("apigateway", (req) => req.path.startsWith("/v2/"));

    expect(pickService([v1, v2a, v2b], "/v2/apis")).toBe(v2a);
  });

  test("apigatewayv2 vs v1 path discrimination", () => {
    const v1 = makeService("apigateway");
    const v2 = makeService("apigateway", (req) => req.path.startsWith("/v2/"));

    expect(pickService([v1, v2], "/v2/apis/abc123")).toBe(v2);
    expect(pickService([v1, v2], "/restapis/abc123")).toBe(v1);
  });

  test("ses v2 path discrimination", () => {
    const v1 = makeService("ses");
    const v2 = makeService("ses", (req) => req.path.startsWith("/v2/email/"));

    expect(pickService([v1, v2], "/v2/email/outbound-emails")).toBe(v2);
    expect(pickService([v1, v2], "/?Action=SendEmail")).toBe(v1);
  });

  test("bedrock-runtime path discrimination", () => {
    const base = makeService("bedrock");
    const runtime = makeService("bedrock", (req) =>
      req.path.startsWith("/model/"),
    );

    expect(
      pickService([base, runtime], "/model/anthropic.claude-v2/invoke"),
    ).toBe(runtime);
    expect(pickService([base, runtime], "/foundation-models")).toBe(base);
  });
});
