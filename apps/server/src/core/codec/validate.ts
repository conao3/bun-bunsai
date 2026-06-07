import type {
  Protocol,
  Shape,
  ShapeRegistry,
  StructureShape,
} from "../types.ts";

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

const constraintFor = (
  protocol: Protocol,
  member: string,
  detail: string,
): ValidationError => {
  switch (protocol) {
    case "query":
    case "ec2":
    case "rest-xml":
      return {
        code: "InvalidParameterValue",
        message: `Value for parameter ${member} is invalid: ${detail}`,
        statusCode: 400,
        senderFault: true,
      };
    case "json":
    case "rest-json":
      return {
        code: "ValidationException",
        message: `1 validation error detected: Value at '${member}' failed to satisfy constraint: ${detail}`,
        statusCode: 400,
        senderFault: true,
      };
  }
};

const isPresent = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== "";

const isNonNull = (value: unknown): boolean =>
  value !== undefined && value !== null;

const validateShapeValue = (
  protocol: Protocol,
  registry: ShapeRegistry,
  path: string,
  shape: Shape,
  value: unknown,
): ValidationError | undefined => {
  if (shape.type === "structure") {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return undefined;
    const obj = value as Record<string, unknown>;
    for (const req of shape.required ?? []) {
      if (shape.members[req] === undefined) continue;
      if (!isNonNull(obj[req])) return missingFor(protocol, `${path}.${req}`);
    }
    for (const [name, member] of Object.entries(shape.members)) {
      const child = obj[name];
      if (!isPresent(child)) continue;
      const childShape = registry.shapes[member.shape];
      if (childShape === undefined) continue;
      const err = validateShapeValue(
        protocol,
        registry,
        `${path}.${name}`,
        childShape,
        child,
      );
      if (err !== undefined) return err;
    }
    return undefined;
  }

  if (shape.type === "list") {
    if (!Array.isArray(value)) return undefined;
    const itemShape = registry.shapes[shape.member.shape];
    if (itemShape === undefined) return undefined;
    for (let i = 0; i < value.length; i++) {
      if (!isNonNull(value[i])) continue;
      const err = validateShapeValue(
        protocol,
        registry,
        `${path}[${i}]`,
        itemShape,
        value[i],
      );
      if (err !== undefined) return err;
    }
    return undefined;
  }

  if (shape.type === "map") {
    return undefined;
  }

  if (shape.type === "string") {
    if (typeof value !== "string") return undefined;
    if (shape.enum !== undefined && !shape.enum.includes(value)) {
      return constraintFor(
        protocol,
        path,
        `Member must satisfy enum value set: [${shape.enum.join(", ")}]`,
      );
    }
    return undefined;
  }

  if (
    shape.type === "integer" ||
    shape.type === "long" ||
    shape.type === "float" ||
    shape.type === "double"
  ) {
    if (typeof value !== "number") return undefined;
    if (shape.min !== undefined && value < shape.min) {
      return constraintFor(
        protocol,
        path,
        `Member must have value greater than or equal to ${shape.min}`,
      );
    }
    if (shape.max !== undefined && value > shape.max) {
      return constraintFor(
        protocol,
        path,
        `Member must have value less than or equal to ${shape.max}`,
      );
    }
    return undefined;
  }

  return undefined;
};

const validateRequiredInput = (
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

export const validateInput = (
  protocol: Protocol,
  registry: ShapeRegistry | undefined,
  shape: Shape | undefined,
  input: Record<string, unknown>,
): ValidationError | undefined => {
  const reqErr = validateRequiredInput(protocol, shape, input);
  if (reqErr !== undefined) return reqErr;
  if (
    registry === undefined ||
    shape === undefined ||
    shape.type !== "structure"
  )
    return undefined;
  for (const [memberName, member] of Object.entries(shape.members)) {
    const value = input[memberName];
    if (!isNonNull(value)) continue;
    const memberShape = registry.shapes[member.shape];
    if (memberShape === undefined) continue;
    const err = validateShapeValue(
      protocol,
      registry,
      memberName,
      memberShape,
      value,
    );
    if (err !== undefined) return err;
  }
  return undefined;
};
