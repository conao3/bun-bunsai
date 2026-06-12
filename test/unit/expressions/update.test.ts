import { describe, expect, test } from "bun:test";
import { applyUpdate } from "../../../apps/server/src/core/expressions/evaluator-update.ts";
import { parseUpdateExpression } from "../../../apps/server/src/core/expressions/parser-update.ts";
import type {
  AttributeBindings,
  AttributeValue,
} from "../../../apps/server/src/core/expressions/types.ts";

const update = (
  expression: string,
  item: Record<string, AttributeValue>,
  bindings: Partial<AttributeBindings> = {},
): Record<string, AttributeValue> => {
  const ast = parseUpdateExpression(expression, {
    names: bindings.names ?? {},
    values: bindings.values ?? {},
    allowReservedWords: true,
  });
  return applyUpdate(ast, item);
};

describe("UpdateExpression evaluator", () => {
  test("basic SET", () => {
    const out = update(
      "SET a = :v",
      { pk: { S: "k" } },
      { values: { ":v": { S: "hi" } } },
    );
    expect(out).toEqual({ pk: { S: "k" }, a: { S: "hi" } });
  });

  test("SET counter = counter + :inc", () => {
    const out = update(
      "SET counter = counter + :inc",
      { counter: { N: "5" } },
      { values: { ":inc": { N: "3" } } },
    );
    expect(out["counter"]).toEqual({ N: "8" });
  });

  test("SET a = a - :n with decimal precision", () => {
    const out = update(
      "SET a = a - :n",
      { a: { N: "1.0" } },
      { values: { ":n": { N: "0.1" } } },
    );
    expect(out["a"]).toEqual({ N: "0.9" });
  });

  test("SET a = if_not_exists(a, :v) when missing", () => {
    const out = update(
      "SET a = if_not_exists(a, :v)",
      {},
      { values: { ":v": { S: "default" } } },
    );
    expect(out["a"]).toEqual({ S: "default" });
  });

  test("SET a = if_not_exists(a, :v) when present", () => {
    const out = update(
      "SET a = if_not_exists(a, :v)",
      { a: { S: "keep" } },
      { values: { ":v": { S: "default" } } },
    );
    expect(out["a"]).toEqual({ S: "keep" });
  });

  test("SET list = list_append(list, :more)", () => {
    const out = update(
      "SET #l = list_append(#l, :more)",
      { items: { L: [{ S: "a" }] } },
      {
        names: { "#l": "items" },
        values: { ":more": { L: [{ S: "b" }, { S: "c" }] } },
      },
    );
    expect(out["items"]).toEqual({
      L: [{ S: "a" }, { S: "b" }, { S: "c" }],
    });
  });

  test("SET list = list_append(:prefix, list) for left-side append", () => {
    const out = update(
      "SET list = list_append(:prefix, list)",
      { list: { L: [{ N: "3" }] } },
      { values: { ":prefix": { L: [{ N: "1" }, { N: "2" }] } } },
    );
    expect(out["list"]).toEqual({
      L: [{ N: "1" }, { N: "2" }, { N: "3" }],
    });
  });

  test("REMOVE single and list index", () => {
    const out = update("REMOVE a, b[1]", {
      a: { S: "x" },
      b: { L: [{ N: "1" }, { N: "2" }, { N: "3" }] },
    });
    expect(out["a"]).toBeUndefined();
    expect(out["b"]).toEqual({ L: [{ N: "1" }, { N: "3" }] });
  });

  test("ADD N adds with decimal precision", () => {
    const out = update(
      "ADD count :delta",
      { count: { N: "0.1" } },
      { values: { ":delta": { N: "0.2" } } },
    );
    expect(out["count"]).toEqual({ N: "0.3" });
  });

  test("ADD N creates attribute when absent", () => {
    const out = update(
      "ADD count :delta",
      {},
      { values: { ":delta": { N: "7" } } },
    );
    expect(out["count"]).toEqual({ N: "7" });
  });

  test("ADD SS unions a set", () => {
    const out = update(
      "ADD tags :more",
      { tags: { SS: ["a"] } },
      { values: { ":more": { SS: ["b", "c"] } } },
    );
    const set = (out["tags"]!["SS"] as string[]).slice().sort();
    expect(set).toEqual(["a", "b", "c"]);
  });

  test("DELETE removes set elements", () => {
    const out = update(
      "DELETE tags :rm",
      { tags: { SS: ["a", "b", "c"] } },
      { values: { ":rm": { SS: ["b"] } } },
    );
    const set = (out["tags"]!["SS"] as string[]).slice().sort();
    expect(set).toEqual(["a", "c"]);
  });

  test("DELETE all elements removes the attribute", () => {
    const out = update(
      "DELETE tags :rm",
      { tags: { SS: ["a"] } },
      { values: { ":rm": { SS: ["a"] } } },
    );
    expect(out["tags"]).toBeUndefined();
  });

  test("nested SET via document path", () => {
    const out = update(
      "SET nested.path[0].name = :v",
      {
        nested: { M: { path: { L: [{ M: { name: { S: "old" } } }] } } },
      },
      { values: { ":v": { S: "new" } } },
    );
    expect(
      (
        (
          (out["nested"]!["M"] as Record<string, AttributeValue>)["path"]![
            "L"
          ] as AttributeValue[]
        )[0]!["M"] as Record<string, AttributeValue>
      )["name"],
    ).toEqual({ S: "new" });
  });

  test("snapshot-of-original semantics: RHS reads pre-update", () => {
    const out = update(
      "SET a = b, b = :v",
      { a: { S: "A" }, b: { S: "B" } },
      { values: { ":v": { S: "NEW" } } },
    );
    expect(out["a"]).toEqual({ S: "B" });
    expect(out["b"]).toEqual({ S: "NEW" });
  });

  test("overlapping SET and REMOVE on same path rejected", () => {
    expect(() =>
      parseUpdateExpression("SET a = :x REMOVE a", {
        names: {},
        values: { ":x": { S: "v" } },
      }),
    ).toThrow(/document paths overlap/);
  });

  test("multiple sections combined", () => {
    const out = update(
      "SET a = :v ADD c :delta REMOVE b",
      { a: { S: "old" }, b: { S: "gone" }, c: { N: "1" } },
      { values: { ":v": { S: "new" }, ":delta": { N: "2" } } },
    );
    expect(out).toEqual({ a: { S: "new" }, c: { N: "3" } });
  });

  test("duplicate verb rejected", () => {
    expect(() =>
      parseUpdateExpression("SET a = :v SET b = :v", {
        names: {},
        values: { ":v": { S: "x" } },
      }),
    ).toThrow(/cannot appear more than once/);
  });

  test("ADD with non-set non-number rejected", () => {
    expect(() =>
      update("ADD a :v", { a: { S: "x" } }, { values: { ":v": { S: "y" } } }),
    ).toThrow(/Incorrect operand type/);
  });
});
