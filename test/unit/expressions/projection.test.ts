import { describe, expect, test } from "bun:test";
import { projectItem } from "../../../apps/server/src/core/expressions/evaluator-projection.ts";
import { parseProjectionExpression } from "../../../apps/server/src/core/expressions/parser-projection.ts";
import type { AttributeValue } from "../../../apps/server/src/core/expressions/types.ts";

const project = (
  expression: string,
  item: Record<string, AttributeValue>,
  names: Record<string, string> = {},
): Record<string, AttributeValue> => {
  const ast = parseProjectionExpression(expression, { names });
  return projectItem(ast, item);
};

describe("ProjectionExpression", () => {
  test("single attribute", () => {
    const out = project("a", { a: { S: "X" }, b: { S: "Y" } });
    expect(out).toEqual({ a: { S: "X" } });
  });

  test("multiple comma-separated attributes", () => {
    const out = project("a, c", {
      a: { S: "A" },
      b: { S: "B" },
      c: { S: "C" },
    });
    expect(out).toEqual({ a: { S: "A" }, c: { S: "C" } });
  });

  test("nested path keeps only requested branch", () => {
    const out = project("a.b", {
      a: { M: { b: { S: "BC" }, x: { S: "XX" } } },
      other: { S: "no" },
    });
    expect(out).toEqual({ a: { M: { b: { S: "BC" } } } });
  });

  test("alias and index path", () => {
    const out = project(
      "#d[0]",
      {
        d: { L: [{ S: "first" }, { S: "second" }] },
      },
      { "#d": "d" },
    );
    expect(out).toEqual({ d: { L: [{ S: "first" }] } });
  });

  test("missing path is silently skipped", () => {
    const out = project("ghost, a", { a: { S: "A" } });
    expect(out).toEqual({ a: { S: "A" } });
  });

  test("duplicate path rejected", () => {
    expect(() => parseProjectionExpression("a, a", { names: {} })).toThrow(
      /document paths overlap/,
    );
  });

  test("empty expression rejected", () => {
    expect(() => parseProjectionExpression("", { names: {} })).toThrow(
      /at least one attribute/,
    );
  });
});
