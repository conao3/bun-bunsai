import type { Protocol, Shape, StructureShape } from "../types.ts";

export type ValidationError = {
  code: string;
  message: string;
  statusCode: number;
  senderFault: boolean;
};

const missingFor = (protocol: Protocol, member: string): ValidationError => {
  switch (protocol) {
    case "query":
    case "ec2":
    case "rest-xml":
      return {
        code: "MissingParameter",
        message: `The required parameter ${member} is missing.`,
        statusCode: 400,
        senderFault: true,
      };
    case "json":
    case "rest-json":
      return {
        code: "ValidationException",
        message: `1 validation error detected: Value null at '${member}' failed to satisfy constraint: Member must not be null`,
        statusCode: 400,
        senderFault: true,
      };
  }
};

const isPresent = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== "";

export const validateRequiredInput = (
  protocol: Protocol,
  shape: Shape | undefined,
  input: Record<string, unknown>,
): ValidationError | undefined => {
  if (shape === undefined || shape.type !== "structure") return undefined;
  const structure: StructureShape = shape;
  for (const member of structure.required ?? []) {
    if (structure.members[member] === undefined) continue;
    if (!isPresent(input[member])) return missingFor(protocol, member);
  }
  return undefined;
};
