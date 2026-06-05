import { awsError } from "../framework.ts";
import type { AttributeBindings, AttributeValue } from "./types.ts";

export const resolveName = (
  ref: string,
  bindings: Pick<AttributeBindings, "names">,
): string => {
  const actual = bindings.names[ref];
  if (actual === undefined) {
    throw awsError(
      "ValidationException",
      `An expression attribute name used in the expression is not defined; attribute name: ${ref}`,
      400,
    );
  }
  return actual;
};

export const resolveValue = (
  ref: string,
  bindings: Pick<AttributeBindings, "values">,
): AttributeValue => {
  const value = bindings.values[ref];
  if (value === undefined) {
    throw awsError(
      "ValidationException",
      `An expression attribute value used in expression is not defined; attribute value: ${ref}`,
      400,
    );
  }
  return value;
};
