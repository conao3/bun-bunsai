import {
  compareAV,
  containsAV,
  equalsAV,
  matchesAttributeType,
  sizeOf,
  typeOfAV,
} from "./attribute.ts";
import { getAtPath } from "./paths.ts";
import type { AttributeValue, ConditionAST, Operand } from "./types.ts";

export const evaluateOperand = (
  operand: Operand,
  item: Record<string, AttributeValue>,
): AttributeValue | undefined => {
  if (operand.kind === "value") return operand.value;
  if (operand.kind === "path") return getAtPath(item, operand.path);
  const inner = getAtPath(item, operand.path);
  if (inner === undefined) return undefined;
  const n = sizeOf(inner);
  if (n === undefined) return undefined;
  return { N: String(n) };
};

const cmpResultOk = (
  result: -1 | 0 | 1 | undefined,
  op: "=" | "<>" | "<" | "<=" | ">" | ">=",
): boolean => {
  if (result === undefined) return false;
  switch (op) {
    case "=":
      return result === 0;
    case "<>":
      return result !== 0;
    case "<":
      return result === -1;
    case "<=":
      return result !== 1;
    case ">":
      return result === 1;
    case ">=":
      return result !== -1;
  }
};

export const evaluateCondition = (
  ast: ConditionAST,
  item: Record<string, AttributeValue>,
): boolean => {
  if (ast.kind === "and") {
    return (
      evaluateCondition(ast.left, item) && evaluateCondition(ast.right, item)
    );
  }
  if (ast.kind === "or") {
    return (
      evaluateCondition(ast.left, item) || evaluateCondition(ast.right, item)
    );
  }
  if (ast.kind === "not") {
    return !evaluateCondition(ast.expr, item);
  }
  if (ast.kind === "cmp") {
    const left = evaluateOperand(ast.left, item);
    const right = evaluateOperand(ast.right, item);
    if (left === undefined || right === undefined) return false;
    if (ast.op === "=") return equalsAV(left, right);
    if (ast.op === "<>") return !equalsAV(left, right);
    return cmpResultOk(compareAV(left, right), ast.op);
  }
  if (ast.kind === "between") {
    const target = evaluateOperand(ast.target, item);
    const low = evaluateOperand(ast.low, item);
    const high = evaluateOperand(ast.high, item);
    if (target === undefined || low === undefined || high === undefined)
      return false;
    const lowOk = cmpResultOk(compareAV(target, low), ">=");
    const highOk = cmpResultOk(compareAV(target, high), "<=");
    return lowOk && highOk;
  }
  if (ast.kind === "in") {
    const target = evaluateOperand(ast.target, item);
    if (target === undefined) return false;
    for (const candidate of ast.list) {
      const c = evaluateOperand(candidate, item);
      if (c !== undefined && equalsAV(target, c)) return true;
    }
    return false;
  }
  switch (ast.name) {
    case "attribute_exists":
      return getAtPath(item, ast.path) !== undefined;
    case "attribute_not_exists":
      return getAtPath(item, ast.path) === undefined;
    case "attribute_type": {
      const value = getAtPath(item, ast.path);
      if (value === undefined) return false;
      return matchesAttributeType(value, ast.typeCode);
    }
    case "begins_with": {
      const value = getAtPath(item, ast.path);
      const prefix = evaluateOperand(ast.prefix, item);
      if (value === undefined || prefix === undefined) return false;
      const vt = typeOfAV(value);
      const pt = typeOfAV(prefix);
      if (vt !== pt) return false;
      if (vt === "S") {
        return (value["S"] as string).startsWith(prefix["S"] as string);
      }
      if (vt === "B") {
        return (value["B"] as string).startsWith(prefix["B"] as string);
      }
      return false;
    }
    case "contains": {
      const value = getAtPath(item, ast.path);
      const needle = evaluateOperand(ast.operand, item);
      if (value === undefined || needle === undefined) return false;
      return containsAV(value, needle);
    }
  }
};
