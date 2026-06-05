import { awsError } from "../framework.ts";
import type { Token, TokenKind } from "./types.ts";

const KEYWORDS: Record<string, TokenKind> = {
  SET: "kwSet",
  REMOVE: "kwRemove",
  ADD: "kwAdd",
  DELETE: "kwDelete",
  BETWEEN: "kwBetween",
  IN: "kwIn",
  AND: "kwAnd",
  OR: "kwOr",
  NOT: "kwNot",
};

const isIdentStart = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";

const isIdentCont = (c: string): boolean =>
  isIdentStart(c) || (c >= "0" && c <= "9");

const isDigit = (c: string): boolean => c >= "0" && c <= "9";

export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;
  const fail = (start: number, message: string): never => {
    throw awsError(
      "ValidationException",
      `Invalid expression at position ${start}: ${message}`,
      400,
    );
  };
  while (i < len) {
    const c = input[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    const start = i;
    if (c === "(") {
      tokens.push({ kind: "lparen", text: "(", start });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "rparen", text: ")", start });
      i++;
      continue;
    }
    if (c === "[") {
      tokens.push({ kind: "lbracket", text: "[", start });
      i++;
      continue;
    }
    if (c === "]") {
      tokens.push({ kind: "rbracket", text: "]", start });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ kind: "comma", text: ",", start });
      i++;
      continue;
    }
    if (c === ".") {
      tokens.push({ kind: "dot", text: ".", start });
      i++;
      continue;
    }
    if (c === "+") {
      tokens.push({ kind: "plus", text: "+", start });
      i++;
      continue;
    }
    if (c === "-") {
      tokens.push({ kind: "minus", text: "-", start });
      i++;
      continue;
    }
    if (c === "=") {
      tokens.push({ kind: "eq", text: "=", start });
      i++;
      continue;
    }
    if (c === "<") {
      if (input[i + 1] === "=") {
        tokens.push({ kind: "le", text: "<=", start });
        i += 2;
        continue;
      }
      if (input[i + 1] === ">") {
        tokens.push({ kind: "ne", text: "<>", start });
        i += 2;
        continue;
      }
      tokens.push({ kind: "lt", text: "<", start });
      i++;
      continue;
    }
    if (c === ">") {
      if (input[i + 1] === "=") {
        tokens.push({ kind: "ge", text: ">=", start });
        i += 2;
        continue;
      }
      tokens.push({ kind: "gt", text: ">", start });
      i++;
      continue;
    }
    if (c === "#") {
      let j = i + 1;
      while (j < len && isIdentCont(input[j]!)) j++;
      if (j === i + 1) {
        fail(start, "Expected name reference after '#'");
      }
      tokens.push({
        kind: "nameRef",
        text: input.slice(i, j),
        start,
      });
      i = j;
      continue;
    }
    if (c === ":") {
      let j = i + 1;
      while (j < len && isIdentCont(input[j]!)) j++;
      if (j === i + 1) {
        fail(start, "Expected value reference after ':'");
      }
      tokens.push({
        kind: "valueRef",
        text: input.slice(i, j),
        start,
      });
      i = j;
      continue;
    }
    if (isDigit(c)) {
      let j = i + 1;
      while (j < len && isDigit(input[j]!)) j++;
      tokens.push({ kind: "int", text: input.slice(i, j), start });
      i = j;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < len && isIdentCont(input[j]!)) j++;
      const text = input.slice(i, j);
      const kw = KEYWORDS[text];
      if (kw !== undefined) {
        tokens.push({ kind: kw, text, start });
      } else {
        tokens.push({ kind: "ident", text, start });
      }
      i = j;
      continue;
    }
    fail(start, `Unexpected character '${c}'`);
  }
  tokens.push({ kind: "eof", text: "", start: len });
  return tokens;
};

export type TokenStream = {
  peek: (offset?: number) => Token;
  consume: () => Token;
  expect: (kind: TokenKind, message?: string) => Token;
  match: (...kinds: TokenKind[]) => boolean;
  position: () => number;
};

export const createTokenStream = (tokens: Token[]): TokenStream => {
  let i = 0;
  const peek = (offset = 0): Token => {
    const idx = i + offset;
    return tokens[idx] ?? tokens[tokens.length - 1]!;
  };
  const consume = (): Token => {
    const t = tokens[i] ?? tokens[tokens.length - 1]!;
    if (t.kind !== "eof") i++;
    return t;
  };
  const expect = (kind: TokenKind, message?: string): Token => {
    const t = peek();
    if (t.kind !== kind) {
      throw awsError(
        "ValidationException",
        `Invalid expression: ${message ?? `expected ${kind} but got '${t.text || t.kind}'`}`,
        400,
      );
    }
    return consume();
  };
  const match = (...kinds: TokenKind[]): boolean => kinds.includes(peek().kind);
  const position = (): number => i;
  return { peek, consume, expect, match, position };
};
