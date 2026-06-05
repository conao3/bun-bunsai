import { awsError } from "../framework.ts";
import { resolveValue } from "./bindings.ts";
import { createTokenStream, tokenize } from "./lexer.ts";
import type { TokenStream } from "./lexer.ts";
import { parseAttributePath } from "./paths.ts";
import type {
  AttributeBindings,
  AttributeTypeCode,
  ConditionAST,
  Operand,
} from "./types.ts";

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const CONDITION_FN_NAMES = new Set([
  "attribute_exists",
  "attribute_not_exists",
  "attribute_type",
  "begins_with",
  "contains",
]);

const ATTRIBUTE_TYPE_CODES = new Set<AttributeTypeCode>([
  "S",
  "SS",
  "N",
  "NS",
  "B",
  "BS",
  "BOOL",
  "NULL",
  "L",
  "M",
]);

const looksLikeConditionFunction = (stream: TokenStream): boolean => {
  const head = stream.peek();
  const next = stream.peek(1);
  if (head.kind !== "ident") return false;
  if (next.kind !== "lparen") return false;
  return CONDITION_FN_NAMES.has(head.text);
};

const parseOperand = (
  stream: TokenStream,
  bindings: AttributeBindings,
): Operand => {
  const head = stream.peek();
  if (head.kind === "valueRef") {
    stream.consume();
    const value = resolveValue(head.text, bindings);
    return { kind: "value", ref: head.text, value };
  }
  if (
    head.kind === "ident" &&
    head.text === "size" &&
    stream.peek(1).kind === "lparen"
  ) {
    stream.consume();
    stream.expect("lparen", "expected '(' after 'size'");
    const path = parseAttributePath(stream, bindings);
    stream.expect("rparen", "expected ')' after size argument");
    return { kind: "size", path };
  }
  if (head.kind === "ident" || head.kind === "nameRef") {
    const path = parseAttributePath(stream, bindings);
    return { kind: "path", path };
  }
  return failValidation(
    `Expected an operand but found '${head.text || head.kind}'`,
  );
};

const COMPARATOR_TOKENS = new Set(["eq", "ne", "lt", "le", "gt", "ge"]);

const tokenToCmp = (kind: string): "=" | "<>" | "<" | "<=" | ">" | ">=" => {
  if (kind === "eq") return "=";
  if (kind === "ne") return "<>";
  if (kind === "lt") return "<";
  if (kind === "le") return "<=";
  if (kind === "gt") return ">";
  return ">=";
};

const parseFunction = (
  stream: TokenStream,
  bindings: AttributeBindings,
): ConditionAST => {
  const head = stream.consume();
  stream.expect("lparen", `expected '(' after ${head.text}`);
  if (
    head.text === "attribute_exists" ||
    head.text === "attribute_not_exists"
  ) {
    const path = parseAttributePath(stream, bindings);
    stream.expect("rparen", "expected ')'");
    return { kind: "fn", name: head.text, path };
  }
  if (head.text === "attribute_type") {
    const path = parseAttributePath(stream, bindings);
    stream.expect("comma", "expected ',' in attribute_type");
    const valTok = stream.peek();
    if (valTok.kind !== "valueRef") {
      failValidation(
        "attribute_type expects a value reference as the second argument",
      );
    }
    stream.consume();
    const value = resolveValue(valTok.text, bindings);
    const code = value["S"];
    if (
      typeof code !== "string" ||
      !ATTRIBUTE_TYPE_CODES.has(code as AttributeTypeCode)
    ) {
      failValidation(
        `attribute_type expects a type code (S/SS/N/NS/B/BS/BOOL/NULL/L/M)`,
      );
    }
    stream.expect("rparen", "expected ')'");
    return {
      kind: "fn",
      name: "attribute_type",
      path,
      typeCode: code as AttributeTypeCode,
    };
  }
  if (head.text === "begins_with") {
    const path = parseAttributePath(stream, bindings);
    stream.expect("comma", "expected ',' in begins_with");
    const prefix = parseOperand(stream, bindings);
    stream.expect("rparen", "expected ')'");
    return { kind: "fn", name: "begins_with", path, prefix };
  }
  const path = parseAttributePath(stream, bindings);
  stream.expect("comma", "expected ',' in contains");
  const operand = parseOperand(stream, bindings);
  stream.expect("rparen", "expected ')'");
  return { kind: "fn", name: "contains", path, operand };
};

const parseOr = (
  stream: TokenStream,
  bindings: AttributeBindings,
): ConditionAST => {
  let left = parseAnd(stream, bindings);
  while (stream.peek().kind === "kwOr") {
    stream.consume();
    const right = parseAnd(stream, bindings);
    left = { kind: "or", left, right };
  }
  return left;
};

const parseAnd = (
  stream: TokenStream,
  bindings: AttributeBindings,
): ConditionAST => {
  let left = parseNot(stream, bindings);
  while (stream.peek().kind === "kwAnd") {
    stream.consume();
    const right = parseNot(stream, bindings);
    left = { kind: "and", left, right };
  }
  return left;
};

const parseNot = (
  stream: TokenStream,
  bindings: AttributeBindings,
): ConditionAST => {
  if (stream.peek().kind === "kwNot") {
    stream.consume();
    return { kind: "not", expr: parseNot(stream, bindings) };
  }
  return parsePrimary(stream, bindings);
};

const parsePrimary = (
  stream: TokenStream,
  bindings: AttributeBindings,
): ConditionAST => {
  if (stream.peek().kind === "lparen") {
    stream.consume();
    const inner = parseOr(stream, bindings);
    stream.expect("rparen", "expected ')'");
    return inner;
  }
  if (looksLikeConditionFunction(stream)) {
    return parseFunction(stream, bindings);
  }
  const left = parseOperand(stream, bindings);
  const tok = stream.peek();
  if (COMPARATOR_TOKENS.has(tok.kind)) {
    stream.consume();
    const right = parseOperand(stream, bindings);
    return { kind: "cmp", op: tokenToCmp(tok.kind), left, right };
  }
  if (tok.kind === "kwBetween") {
    stream.consume();
    const low = parseOperand(stream, bindings);
    stream.expect("kwAnd", "expected 'AND' in BETWEEN");
    const high = parseOperand(stream, bindings);
    return { kind: "between", target: left, low, high };
  }
  if (tok.kind === "kwIn") {
    stream.consume();
    stream.expect("lparen", "expected '(' after IN");
    const list: Operand[] = [parseOperand(stream, bindings)];
    while (stream.peek().kind === "comma") {
      stream.consume();
      list.push(parseOperand(stream, bindings));
    }
    stream.expect("rparen", "expected ')' in IN list");
    if (list.length > 100) {
      failValidation("IN list size cannot exceed 100");
    }
    return { kind: "in", target: left, list };
  }
  return failValidation(
    `Expected a condition operator or function after operand`,
  );
};

export const parseConditionExpression = (
  expression: string,
  bindings: AttributeBindings,
): ConditionAST => {
  const stream = createTokenStream(tokenize(expression));
  const ast = parseOr(stream, bindings);
  const trailing = stream.peek();
  if (trailing.kind !== "eof") {
    failValidation(
      `Unexpected token '${trailing.text || trailing.kind}' after expression`,
    );
  }
  return ast;
};
