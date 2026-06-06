import { awsError } from "../framework.ts";
import type { KeyConditionAST, KeyConditionResult, Operand } from "./types.ts";

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const valueOf = (operand: Operand): Record<string, unknown> => {
  if (operand.kind !== "value") {
    return failValidation(
      "KeyConditionExpression operands must be value references",
    );
  }
  return operand.value;
};

export const resolveKeyCondition = (
  ast: KeyConditionAST,
  schema: { hash: string; range?: string; rangeType?: string },
): KeyConditionResult => {
  if (ast.hash.path.root !== schema.hash) {
    failValidation(`Query condition missed key schema element: ${schema.hash}`);
  }
  const result: KeyConditionResult = {
    hash: { attribute: schema.hash, value: valueOf(ast.hash.value) },
  };
  if (ast.range === undefined) return result;
  const rangeAttr = schema.range;
  if (rangeAttr === undefined) {
    return failValidation(
      "Query condition includes a range key, but the table has no range key in its schema",
    );
  }
  if (ast.range.path.root !== rangeAttr) {
    failValidation(
      `Range key reference '${ast.range.path.root}' does not match the schema key '${rangeAttr}'`,
    );
  }
  const pred = ast.range.predicate;
  if (pred.kind === "cmp") {
    result.range = {
      attribute: rangeAttr,
      op: pred.op,
      value: valueOf(pred.value),
    };
  } else if (pred.kind === "between") {
    result.range = {
      attribute: rangeAttr,
      op: "BETWEEN",
      lo: valueOf(pred.low),
      hi: valueOf(pred.high),
    };
  } else {
    if (
      schema.rangeType !== undefined &&
      schema.rangeType !== "S" &&
      schema.rangeType !== "B"
    ) {
      failValidation(
        "Invalid KeyConditionExpression: Incorrect operand type for operator or function; operator or function: begins_with",
      );
    }
    const prefix = valueOf(pred.prefix);
    const operandType = Object.keys(prefix)[0];
    if (operandType !== "S" && operandType !== "B") {
      failValidation(
        `Invalid KeyConditionExpression: Incorrect operand type for operator or function; operator or function: begins_with, operand type: ${operandType}`,
      );
    }
    result.range = {
      attribute: rangeAttr,
      op: "begins_with",
      prefix,
    };
  }
  return result;
};
