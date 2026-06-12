import { awsError } from "../framework.ts";
import { resolveValue } from "./bindings.ts";
import { createTokenStream, tokenize } from "./lexer.ts";
import type { TokenStream } from "./lexer.ts";
import { parseAttributePath } from "./paths.ts";
import type {
  AttributeBindings,
  KeyConditionAST,
  Operand,
  RangePredicateAST,
} from "./types.ts";

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const parseValueOperand = (
  stream: TokenStream,
  bindings: AttributeBindings,
): Operand => {
  const tok = stream.peek();
  if (tok.kind !== "valueRef") {
    failValidation(
      `KeyConditionExpression operands must be value references; found '${tok.text || tok.kind}'`,
    );
  }
  stream.consume();
  return {
    kind: "value",
    ref: tok.text,
    value: resolveValue(tok.text, bindings),
  };
};

const requireBareKeyPath = (
  stream: TokenStream,
  bindings: Pick<AttributeBindings, "names" | "allowReservedWords">,
): { path: ReturnType<typeof parseAttributePath> } => {
  const path = parseAttributePath(stream, bindings);
  if (path.steps.length > 0) {
    failValidation("KeyConditionExpression cannot reference nested attributes");
  }
  return { path };
};

const parseRangePredicate = (
  stream: TokenStream,
  bindings: AttributeBindings,
): {
  path: ReturnType<typeof parseAttributePath>;
  predicate: RangePredicateAST;
} => {
  const head = stream.peek();
  if (
    head.kind === "ident" &&
    head.text === "begins_with" &&
    stream.peek(1).kind === "lparen"
  ) {
    stream.consume();
    stream.expect("lparen", "expected '(' after begins_with");
    const { path } = requireBareKeyPath(stream, bindings);
    stream.expect("comma", "expected ',' in begins_with");
    const prefix = parseValueOperand(stream, bindings);
    stream.expect("rparen", "expected ')' after begins_with");
    return { path, predicate: { kind: "begins_with", prefix } };
  }
  const { path } = requireBareKeyPath(stream, bindings);
  const op = stream.peek();
  if (op.kind === "eq") {
    stream.consume();
    const value = parseValueOperand(stream, bindings);
    return { path, predicate: { kind: "cmp", op: "=", value } };
  }
  if (
    op.kind === "lt" ||
    op.kind === "le" ||
    op.kind === "gt" ||
    op.kind === "ge"
  ) {
    stream.consume();
    const cmpOp =
      op.kind === "lt"
        ? "<"
        : op.kind === "le"
          ? "<="
          : op.kind === "gt"
            ? ">"
            : ">=";
    const value = parseValueOperand(stream, bindings);
    return { path, predicate: { kind: "cmp", op: cmpOp, value } };
  }
  if (op.kind === "kwBetween") {
    stream.consume();
    const low = parseValueOperand(stream, bindings);
    stream.expect("kwAnd", "expected 'AND' in BETWEEN");
    const high = parseValueOperand(stream, bindings);
    return { path, predicate: { kind: "between", low, high } };
  }
  return failValidation(
    `Unsupported operator in KeyConditionExpression: '${op.text || op.kind}'`,
  );
};

export const parseKeyConditionExpression = (
  expression: string,
  bindings: AttributeBindings,
): KeyConditionAST => {
  const stream = createTokenStream(tokenize(expression));
  const head = stream.peek();
  if (head.kind === "kwNot" || head.kind === "lparen") {
    failValidation("KeyConditionExpression does not allow NOT or parentheses");
  }
  const { path: hashPath } = requireBareKeyPath(stream, bindings);
  stream.expect("eq", "expected '=' after partition key path");
  const hashValue = parseValueOperand(stream, bindings);
  let range:
    | {
        path: ReturnType<typeof parseAttributePath>;
        predicate: RangePredicateAST;
      }
    | undefined;
  if (stream.peek().kind === "kwAnd") {
    stream.consume();
    range = parseRangePredicate(stream, bindings);
  }
  if (stream.peek().kind === "kwOr") {
    failValidation("KeyConditionExpression does not allow OR");
  }
  const trailing = stream.peek();
  if (trailing.kind !== "eof") {
    failValidation(
      `Unexpected token '${trailing.text || trailing.kind}' in KeyConditionExpression`,
    );
  }
  return {
    hash: { path: hashPath, value: hashValue },
    range,
  };
};
