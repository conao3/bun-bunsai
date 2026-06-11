import { describe, expect, test } from "bun:test";
import { aggregateServices } from "../../../apps/dashboard/src/aggregateServices.ts";

type ServiceSummary = {
  name: string;
  protocol: "query" | "json" | "rest-json" | "rest-xml" | "unknown";
  status: "available";
  callCount: number;
  resourceCount: number;
};

const svc = (
  name: string,
  callCount: number,
  resourceCount: number,
): ServiceSummary => ({
  name,
  protocol: "json",
  status: "available",
  callCount,
  resourceCount,
});

describe("aggregateServices", () => {
  test("empty array → empty", () => {
    expect(aggregateServices([])).toEqual([]);
  });

  test("unique names → entries unchanged", () => {
    const input = [svc("s3", 10, 5), svc("sqs", 3, 2)];
    expect(aggregateServices(input)).toEqual(input);
  });

  test("duplicate name → callCount summed", () => {
    const result = aggregateServices([svc("ses", 5, 15), svc("ses", 8, 10)]);
    expect(result).toHaveLength(1);
    expect(result[0].callCount).toBe(13);
  });

  test("duplicate name → resourceCount max", () => {
    const result = aggregateServices([
      svc("bedrock", 1, 15),
      svc("bedrock", 2, 15),
    ]);
    expect(result[0].resourceCount).toBe(15);
  });

  test("duplicate name → protocol from first entry", () => {
    const a: ServiceSummary = {
      ...svc("apigateway", 1, 0),
      protocol: "rest-json",
    };
    const b: ServiceSummary = { ...svc("apigateway", 2, 0), protocol: "json" };
    expect(aggregateServices([a, b])[0].protocol).toBe("rest-json");
  });

  test("duplicate name → status available when any is available", () => {
    const result = aggregateServices([svc("ses", 1, 0), svc("ses", 2, 0)]);
    expect(result[0].status).toBe("available");
  });

  test("only unique names in result", () => {
    const input = [svc("s3", 1, 1), svc("ses", 2, 2), svc("ses", 3, 3)];
    const result = aggregateServices(input);
    expect(result.map((s) => s.name)).toEqual(["s3", "ses"]);
  });
});
