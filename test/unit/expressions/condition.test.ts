import { describe, expect, test } from "bun:test";
import { evaluateCondition } from "../../../apps/server/src/core/expressions/evaluator-condition.ts";
import { parseConditionExpression } from "../../../apps/server/src/core/expressions/parser-condition.ts";
import type {
  AttributeBindings,
  AttributeValue,
} from "../../../apps/server/src/core/expressions/types.ts";

const evaluate = (
  expression: string,
  item: Record<string, AttributeValue>,
  bindings: Partial<AttributeBindings> = {},
): boolean => {
  const ast = parseConditionExpression(expression, {
    names: bindings.names ?? {},
    values: bindings.values ?? {},
  });
  return evaluateCondition(ast, item);
};

describe("ConditionExpression evaluator", () => {
  test("basic equality on string", () => {
    expect(
      evaluate("a = :v", { a: { S: "hi" } }, { values: { ":v": { S: "hi" } } }),
    ).toBe(true);
    expect(
      evaluate(
        "a = :v",
        { a: { S: "hi" } },
        { values: { ":v": { S: "bye" } } },
      ),
    ).toBe(false);
  });

  test("numeric ordering uses decimal compare", () => {
    expect(
      evaluate("a < :v", { a: { N: "10" } }, { values: { ":v": { N: "9" } } }),
    ).toBe(false);
    expect(
      evaluate("a > :v", { a: { N: "10" } }, { values: { ":v": { N: "9" } } }),
    ).toBe(true);
  });

  test("BETWEEN inclusive", () => {
    expect(
      evaluate(
        "a BETWEEN :lo AND :hi",
        { a: { N: "5" } },
        {
          values: { ":lo": { N: "1" }, ":hi": { N: "10" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "a BETWEEN :lo AND :hi",
        { a: { N: "1" } },
        {
          values: { ":lo": { N: "1" }, ":hi": { N: "10" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "a BETWEEN :lo AND :hi",
        { a: { N: "11" } },
        {
          values: { ":lo": { N: "1" }, ":hi": { N: "10" } },
        },
      ),
    ).toBe(false);
  });

  test("IN membership", () => {
    const values = { ":x": { S: "a" }, ":y": { S: "b" }, ":z": { S: "c" } };
    expect(evaluate("a IN (:x, :y, :z)", { a: { S: "b" } }, { values })).toBe(
      true,
    );
    expect(evaluate("a IN (:x, :y, :z)", { a: { S: "d" } }, { values })).toBe(
      false,
    );
  });

  test("AND has higher precedence than OR", () => {
    const item = { a: { S: "no" }, b: { S: "no" }, c: { S: "no" } };
    const values = {
      ":x": { S: "no" },
      ":y": { S: "no" },
      ":z": { S: "yes" },
    };
    expect(evaluate("a = :x OR b = :y AND c = :z", item, { values })).toBe(
      true,
    );
  });

  test("NOT inverts result", () => {
    expect(evaluate("NOT attribute_exists(a)", {}, {})).toBe(true);
    expect(evaluate("NOT attribute_exists(a)", { a: { S: "x" } }, {})).toBe(
      false,
    );
  });

  test("attribute_exists / attribute_not_exists / attribute_type", () => {
    expect(
      evaluate(
        "attribute_exists(a) AND attribute_not_exists(b)",
        {
          a: { S: "x" },
        },
        {},
      ),
    ).toBe(true);
    expect(
      evaluate(
        "attribute_type(a, :t)",
        { a: { N: "1" } },
        {
          values: { ":t": { S: "N" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "attribute_type(a, :t)",
        { a: { S: "x" } },
        {
          values: { ":t": { S: "N" } },
        },
      ),
    ).toBe(false);
  });

  test("begins_with on string and binary", () => {
    expect(
      evaluate(
        "begins_with(#k, :p)",
        { user: { S: "alice" } },
        {
          names: { "#k": "user" },
          values: { ":p": { S: "al" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "begins_with(#k, :p)",
        { user: { S: "alice" } },
        {
          names: { "#k": "user" },
          values: { ":p": { S: "bob" } },
        },
      ),
    ).toBe(false);
  });

  test("contains on string substring and set membership", () => {
    expect(
      evaluate(
        "contains(a, :n)",
        { a: { S: "hello world" } },
        {
          values: { ":n": { S: "world" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "contains(a, :n)",
        { a: { SS: ["x", "y", "z"] } },
        {
          values: { ":n": { S: "y" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "contains(a, :n)",
        { a: { SS: ["x", "y", "z"] } },
        {
          values: { ":n": { S: "missing" } },
        },
      ),
    ).toBe(false);
  });

  test("size operand in comparison", () => {
    expect(
      evaluate(
        "size(tags) > :n",
        { tags: { SS: ["a", "b", "c"] } },
        {
          values: { ":n": { N: "2" } },
        },
      ),
    ).toBe(true);
    expect(
      evaluate(
        "size(tags) = :n",
        { tags: { SS: ["a", "b", "c"] } },
        {
          values: { ":n": { N: "3" } },
        },
      ),
    ).toBe(true);
  });

  test("type mismatch returns false (no throw)", () => {
    expect(
      evaluate("a < :v", { a: { N: "5" } }, { values: { ":v": { S: "5" } } }),
    ).toBe(false);
  });

  test("parentheses override precedence", () => {
    expect(
      evaluate(
        "(a = :x OR b = :y) AND c = :z",
        {
          a: { S: "no" },
          b: { S: "no" },
          c: { S: "yes" },
        },
        {
          values: {
            ":x": { S: "no" },
            ":y": { S: "no" },
            ":z": { S: "yes" },
          },
        },
      ),
    ).toBe(true);
  });

  test("syntax error: unbalanced parenthesis", () => {
    expect(() =>
      parseConditionExpression("(a = :x", {
        names: {},
        values: { ":x": { S: "v" } },
      }),
    ).toThrow(/expected '\)'/);
  });

  test("undefined name reference rejected at parse time", () => {
    expect(() =>
      parseConditionExpression("#missing = :v", {
        names: {},
        values: { ":v": { S: "x" } },
      }),
    ).toThrow(/attribute name/);
  });

  test("undefined value reference rejected at parse time", () => {
    expect(() =>
      parseConditionExpression("a = :unset", {
        names: {},
        values: {},
      }),
    ).toThrow(/attribute value/);
  });

  test("trailing tokens rejected", () => {
    expect(() =>
      parseConditionExpression("a = :v garbage", {
        names: {},
        values: { ":v": { S: "x" } },
      }),
    ).toThrow(/Unexpected token/);
  });
});
