import { describe, expect, test } from "bun:test";
import {
  createTokenStream,
  tokenize,
} from "../../../apps/server/src/core/expressions/lexer.ts";
import {
  cloneItem,
  formatPath,
  getAtPath,
  parseAttributePath,
  pathsOverlap,
  removeAtPath,
  setAtPath,
} from "../../../apps/server/src/core/expressions/paths.ts";
import type { AttributeValue } from "../../../apps/server/src/core/expressions/types.ts";

const parse = (expression: string, names: Record<string, string> = {}) => {
  const stream = createTokenStream(tokenize(expression));
  const path = parseAttributePath(stream, { names, allowReservedWords: true });
  return { path, rest: stream.peek().kind };
};

describe("parseAttributePath", () => {
  test("plain identifier", () => {
    const { path } = parse("name");
    expect(path).toEqual({ root: "name", steps: [] });
  });

  test("name reference resolves via bindings", () => {
    const { path } = parse("#root.#child", {
      "#root": "actual",
      "#child": "leaf",
    });
    expect(path).toEqual({
      root: "actual",
      steps: [{ kind: "field", name: "leaf" }],
    });
  });

  test("mixed dot and index", () => {
    const { path } = parse("a.b[0].c");
    expect(path.root).toBe("a");
    expect(path.steps).toEqual([
      { kind: "field", name: "b" },
      { kind: "index", index: 0 },
      { kind: "field", name: "c" },
    ]);
  });

  test("rejects depth > 32", () => {
    const expr = "root" + ".step".repeat(32);
    expect(() => parse(expr)).toThrow(/depth/);
  });

  test("formatPath round-trip", () => {
    const { path } = parse("a.b[2].c");
    expect(formatPath(path)).toBe("a.b[2].c");
  });
});

describe("get/set/remove at path", () => {
  const item: Record<string, AttributeValue> = {
    a: {
      M: {
        b: {
          L: [{ M: { c: { S: "deep" } } }, { M: { c: { S: "second" } } }],
        },
      },
    },
    list: { L: [{ N: "1" }, { N: "2" }, { N: "3" }] },
    flat: { S: "x" },
  };

  test("getAtPath traverses map+list nesting", () => {
    const { path } = parse("a.b[0].c");
    expect(getAtPath(item, path)).toEqual({ S: "deep" });
  });

  test("setAtPath returns new item, leaves original intact", () => {
    const { path } = parse("a.b[1].c");
    const next = setAtPath(item, path, { S: "changed" });
    expect(getAtPath(next, path)).toEqual({ S: "changed" });
    expect(getAtPath(item, path)).toEqual({ S: "second" });
  });

  test("removeAtPath splices list element", () => {
    const { path } = parse("list[1]");
    const next = removeAtPath(item, path);
    expect(next["list"]).toEqual({ L: [{ N: "1" }, { N: "3" }] });
  });

  test("removeAtPath on missing returns same shape", () => {
    const { path } = parse("missing");
    expect(removeAtPath(item, path)).toBe(item);
  });

  test("setAtPath on missing parent throws ValidationException", () => {
    const { path } = parse("ghost.child");
    expect(() => setAtPath(item, path, { S: "v" })).toThrow(/document path/);
  });
});

describe("cloneItem", () => {
  test("deeply copies map and list", () => {
    const original: Record<string, AttributeValue> = {
      a: { M: { b: { L: [{ S: "x" }] } } },
    };
    const copy = cloneItem(original);
    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy["a"]).not.toBe(original["a"]);
  });
});

describe("pathsOverlap", () => {
  test("identical paths overlap", () => {
    const a = parse("a.b").path;
    const b = parse("a.b").path;
    expect(pathsOverlap(a, b)).toBe(true);
  });

  test("prefix relationship overlaps", () => {
    const a = parse("a").path;
    const b = parse("a.b.c").path;
    expect(pathsOverlap(a, b)).toBe(true);
  });

  test("sibling paths do not overlap", () => {
    const a = parse("a.b").path;
    const b = parse("a.c").path;
    expect(pathsOverlap(a, b)).toBe(false);
  });

  test("different root never overlaps", () => {
    const a = parse("a").path;
    const b = parse("b").path;
    expect(pathsOverlap(a, b)).toBe(false);
  });

  test("differing list index does not overlap", () => {
    const a = parse("a[0]").path;
    const b = parse("a[1]").path;
    expect(pathsOverlap(a, b)).toBe(false);
  });
});

describe("reserved words", () => {
  test("bare reserved word is rejected", () => {
    const stream = createTokenStream(tokenize("size"));
    expect(() => parseAttributePath(stream, { names: {} })).toThrow(
      /reserved keyword: size/,
    );
  });

  test("aliased reserved word resolves", () => {
    const stream = createTokenStream(tokenize("#s"));
    const path = parseAttributePath(stream, { names: { "#s": "size" } });
    expect(path.root).toBe("size");
  });

  test("allowReservedWords bypasses the check", () => {
    const stream = createTokenStream(tokenize("size"));
    const path = parseAttributePath(stream, {
      names: {},
      allowReservedWords: true,
    });
    expect(path.root).toBe("size");
  });
});
