import { describe, expect, test } from "bun:test";
import {
  createTokenStream,
  tokenize,
} from "../../../apps/server/src/core/expressions/lexer.ts";

const kinds = (input: string): string[] => tokenize(input).map((t) => t.kind);

describe("lexer.tokenize", () => {
  test("longest-match for #name and :value tokens", () => {
    expect(tokenize("#foo_bar")).toEqual([
      { kind: "nameRef", text: "#foo_bar", start: 0 },
      { kind: "eof", text: "", start: 8 },
    ]);
    expect(tokenize(":v_1")).toEqual([
      { kind: "valueRef", text: ":v_1", start: 0 },
      { kind: "eof", text: "", start: 4 },
    ]);
  });

  test("comparator tokens", () => {
    expect(kinds("a <= :b")).toEqual(["ident", "le", "valueRef", "eof"]);
    expect(kinds("a <> :b")).toEqual(["ident", "ne", "valueRef", "eof"]);
    expect(kinds("a >= :b")).toEqual(["ident", "ge", "valueRef", "eof"]);
  });

  test("BETWEEN/AND/OR/NOT/IN are keywords", () => {
    expect(kinds("a BETWEEN :lo AND :hi")).toEqual([
      "ident",
      "kwBetween",
      "valueRef",
      "kwAnd",
      "valueRef",
      "eof",
    ]);
    expect(kinds("NOT a OR b")).toEqual([
      "kwNot",
      "ident",
      "kwOr",
      "ident",
      "eof",
    ]);
    expect(kinds("x IN (:a, :b)")).toEqual([
      "ident",
      "kwIn",
      "lparen",
      "valueRef",
      "comma",
      "valueRef",
      "rparen",
      "eof",
    ]);
  });

  test("path syntax tokens", () => {
    expect(kinds("a.b[0].c")).toEqual([
      "ident",
      "dot",
      "ident",
      "lbracket",
      "int",
      "rbracket",
      "dot",
      "ident",
      "eof",
    ]);
  });

  test("'< =' with whitespace tokenizes as separate lt + eq", () => {
    expect(kinds("a < = :v")).toEqual(["ident", "lt", "eq", "valueRef", "eof"]);
  });

  test("rejects bare '#' or ':'", () => {
    expect(() => tokenize("#")).toThrow();
    expect(() => tokenize(":")).toThrow();
    expect(() => tokenize("# a")).toThrow();
  });

  test("rejects unexpected character", () => {
    expect(() => tokenize("a $ b")).toThrow();
  });
});

describe("lexer.createTokenStream", () => {
  test("peek does not advance", () => {
    const stream = createTokenStream(tokenize("a = :b"));
    expect(stream.peek().kind).toBe("ident");
    expect(stream.peek().kind).toBe("ident");
    stream.consume();
    expect(stream.peek().kind).toBe("eq");
  });

  test("expect raises on mismatch", () => {
    const stream = createTokenStream(tokenize("a = :b"));
    stream.consume();
    expect(() => stream.expect("kwAnd")).toThrow(/expected kwAnd/);
  });
});
