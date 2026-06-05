import { describe, expect, test } from "bun:test";
import { resolveKeyCondition } from "../../../apps/server/src/core/expressions/evaluator-key-condition.ts";
import { parseKeyConditionExpression } from "../../../apps/server/src/core/expressions/parser-key-condition.ts";
import type { AttributeBindings } from "../../../apps/server/src/core/expressions/types.ts";

const resolve = (
  expression: string,
  schema: { hash: string; range?: string },
  bindings: Partial<AttributeBindings> = {},
) => {
  const ast = parseKeyConditionExpression(expression, {
    names: bindings.names ?? {},
    values: bindings.values ?? {},
  });
  return resolveKeyCondition(ast, schema);
};

describe("KeyConditionExpression", () => {
  test("partition key only", () => {
    const out = resolve(
      "pk = :pk",
      { hash: "pk" },
      { values: { ":pk": { S: "k" } } },
    );
    expect(out).toEqual({ hash: { attribute: "pk", value: { S: "k" } } });
  });

  test("pk = :pk AND sk = :sk", () => {
    const out = resolve(
      "pk = :pk AND sk = :sk",
      { hash: "pk", range: "sk" },
      { values: { ":pk": { S: "p" }, ":sk": { S: "s" } } },
    );
    expect(out).toEqual({
      hash: { attribute: "pk", value: { S: "p" } },
      range: { attribute: "sk", op: "=", value: { S: "s" } },
    });
  });

  test("sk BETWEEN :a AND :b", () => {
    const out = resolve(
      "pk = :pk AND sk BETWEEN :a AND :b",
      { hash: "pk", range: "sk" },
      {
        values: { ":pk": { S: "p" }, ":a": { N: "1" }, ":b": { N: "10" } },
      },
    );
    expect(out.range).toEqual({
      attribute: "sk",
      op: "BETWEEN",
      lo: { N: "1" },
      hi: { N: "10" },
    });
  });

  test("begins_with(sk, :p)", () => {
    const out = resolve(
      "pk = :pk AND begins_with(sk, :p)",
      { hash: "pk", range: "sk" },
      { values: { ":pk": { S: "p" }, ":p": { S: "pre" } } },
    );
    expect(out.range).toEqual({
      attribute: "sk",
      op: "begins_with",
      prefix: { S: "pre" },
    });
  });

  test("sort key with inequality", () => {
    const out = resolve(
      "pk = :pk AND sk >= :v",
      { hash: "pk", range: "sk" },
      { values: { ":pk": { S: "p" }, ":v": { N: "100" } } },
    );
    expect(out.range).toEqual({
      attribute: "sk",
      op: ">=",
      value: { N: "100" },
    });
  });

  test("OR rejected", () => {
    expect(() =>
      parseKeyConditionExpression("pk = :pk OR sk = :sk", {
        names: {},
        values: { ":pk": { S: "x" }, ":sk": { S: "y" } },
      }),
    ).toThrow(/OR/);
  });

  test("nested path rejected", () => {
    expect(() =>
      parseKeyConditionExpression("pk.nested = :v", {
        names: {},
        values: { ":v": { S: "x" } },
      }),
    ).toThrow(/nested/);
  });

  test("schema mismatch (range key not in schema)", () => {
    expect(() =>
      resolve(
        "pk = :pk AND sk = :sk",
        { hash: "pk" },
        { values: { ":pk": { S: "x" }, ":sk": { S: "y" } } },
      ),
    ).toThrow(/range key/);
  });

  test("wrong partition key attribute rejected", () => {
    expect(() =>
      resolve("other = :pk", { hash: "pk" }, { values: { ":pk": { S: "x" } } }),
    ).toThrow(/key schema element/);
  });
});
