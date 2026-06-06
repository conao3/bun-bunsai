import { awsError } from "../framework.ts";
import { isSetType, setDifference, setUnion, typeOfAV } from "./attribute.ts";
import { addN, subN } from "./decimal.ts";
import { evaluateOperand } from "./evaluator-condition.ts";
import {
  cloneItem,
  formatPath,
  getAtPath,
  removeAtPath,
  setAtPath,
} from "./paths.ts";
import type {
  AddActionAST,
  AttributePath,
  AttributeValue,
  DeleteActionAST,
  Operand,
  RemoveActionAST,
  SetActionAST,
  SetValueAST,
  UpdateAST,
} from "./types.ts";

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const requireOperand = (
  operand: Operand,
  snapshot: Record<string, AttributeValue>,
  context: string,
): AttributeValue => {
  const result = evaluateOperand(operand, snapshot);
  if (result === undefined) {
    failValidation(
      `The provided ${context} expression refers to an attribute that does not exist in the item`,
    );
  }
  return result as AttributeValue;
};

const arithmeticN = (
  left: AttributeValue,
  right: AttributeValue,
  op: "plus" | "minus",
): AttributeValue => {
  if (typeOfAV(left) !== "N" || typeOfAV(right) !== "N") {
    failValidation(
      `An operand in the update expression has an incorrect data type`,
    );
  }
  const result =
    op === "plus"
      ? addN(left["N"] as string, right["N"] as string)
      : subN(left["N"] as string, right["N"] as string);
  return { N: result };
};

const evaluateSetValue = (
  value: SetValueAST,
  snapshot: Record<string, AttributeValue>,
  targetPath: AttributePath,
): AttributeValue => {
  if (value.kind === "operand") {
    const result = evaluateOperand(value.operand, snapshot);
    if (result === undefined) {
      failValidation(
        `The provided expression refers to an attribute that does not exist in the item: ${formatPath(targetPath)}`,
      );
    }
    return result as AttributeValue;
  }
  if (value.kind === "plus") {
    return arithmeticN(
      requireOperand(value.left, snapshot, "operand"),
      requireOperand(value.right, snapshot, "operand"),
      "plus",
    );
  }
  if (value.kind === "minus") {
    return arithmeticN(
      requireOperand(value.left, snapshot, "operand"),
      requireOperand(value.right, snapshot, "operand"),
      "minus",
    );
  }
  if (value.kind === "if_not_exists") {
    const existing = getAtPath(snapshot, value.path);
    if (existing !== undefined) return existing;
    return evaluateSetValue(value.default, snapshot, targetPath);
  }
  const left = evaluateSetValue(value.left, snapshot, targetPath);
  const right = evaluateSetValue(value.right, snapshot, targetPath);
  const badType =
    typeOfAV(left) !== "L"
      ? typeOfAV(left)
      : typeOfAV(right) !== "L"
        ? typeOfAV(right)
        : undefined;
  if (badType !== undefined) {
    failValidation(
      `Invalid UpdateExpression: Incorrect operand type for operator or function; operator or function: list_append, operand type: ${badType}`,
    );
  }
  return {
    L: [
      ...((left["L"] as AttributeValue[]) ?? []),
      ...((right["L"] as AttributeValue[]) ?? []),
    ],
  };
};

const applySet = (
  state: Record<string, AttributeValue>,
  snapshot: Record<string, AttributeValue>,
  action: SetActionAST,
): Record<string, AttributeValue> => {
  const value = evaluateSetValue(action.value, snapshot, action.target);
  return setAtPath(state, action.target, value);
};

const applyRemove = (
  state: Record<string, AttributeValue>,
  action: RemoveActionAST,
): Record<string, AttributeValue> => removeAtPath(state, action.target);

const applyAdd = (
  state: Record<string, AttributeValue>,
  snapshot: Record<string, AttributeValue>,
  action: AddActionAST,
): Record<string, AttributeValue> => {
  const operand = action.value;
  if (operand.kind !== "value") {
    return failValidation("ADD expects a value reference");
  }
  const value = operand.value;
  const valueType = typeOfAV(value);
  const existing = getAtPath(snapshot, action.target);
  if (valueType === "N") {
    const current =
      existing === undefined ? "0" : (existing["N"] as string | undefined);
    if (existing !== undefined && typeOfAV(existing) !== "N") {
      return failValidation(
        `Incorrect operand type for operator or function; operator: ADD, operand type: ${typeOfAV(existing) ?? "UNKNOWN"}`,
      );
    }
    const sum = addN(current ?? "0", value["N"] as string);
    return setAtPath(state, action.target, { N: sum });
  }
  if (!isSetType(valueType)) {
    return failValidation(
      `Incorrect operand type for operator or function; operator: ADD, operand type: ${valueType ?? "UNKNOWN"}`,
    );
  }
  if (existing === undefined) {
    return setAtPath(state, action.target, value);
  }
  const union = setUnion(existing, value);
  return setAtPath(state, action.target, union);
};

const applyDelete = (
  state: Record<string, AttributeValue>,
  snapshot: Record<string, AttributeValue>,
  action: DeleteActionAST,
): Record<string, AttributeValue> => {
  const operand = action.value;
  if (operand.kind !== "value") {
    return failValidation("DELETE expects a value reference");
  }
  const existing = getAtPath(snapshot, action.target);
  if (existing === undefined) return state;
  const diff = setDifference(existing, operand.value);
  if (diff === undefined) {
    return removeAtPath(state, action.target);
  }
  return setAtPath(state, action.target, diff);
};

export const applyUpdate = (
  ast: UpdateAST,
  item: Record<string, AttributeValue>,
): Record<string, AttributeValue> => {
  const snapshot = cloneItem(item);
  let state = cloneItem(item);
  const verbOrder: ("SET" | "REMOVE" | "ADD" | "DELETE")[] = [
    "SET",
    "REMOVE",
    "ADD",
    "DELETE",
  ];
  for (const verb of verbOrder) {
    const section = ast.sections.find((s) => s.verb === verb);
    if (section === undefined) continue;
    if (section.verb === "SET") {
      for (const action of section.actions) {
        state = applySet(state, snapshot, action);
      }
    } else if (section.verb === "REMOVE") {
      for (const action of section.actions) {
        state = applyRemove(state, action);
      }
    } else if (section.verb === "ADD") {
      for (const action of section.actions) {
        state = applyAdd(state, snapshot, action);
      }
    } else {
      for (const action of section.actions) {
        state = applyDelete(state, snapshot, action);
      }
    }
  }
  return state;
};
