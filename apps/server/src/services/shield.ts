import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import shieldModel from "../../../../test/vendor/aws-models/shield.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(shieldModel);

type StoredProtection = {
  Id: string;
  Name: string;
  ResourceArn: string;
  HealthCheckIds: string[];
  ProtectionArn: string;
};

const protectionKey = (id: string): string => `protection/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const protectionArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:shield::${ctx.account}:protection/${id}`;

const requireProtection = (
  ctx: ServiceContext,
  id: string,
): StoredProtection => {
  const protection = ctx.store.get<StoredProtection>(protectionKey(id));
  if (protection === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protection not found: ${id}`,
      400,
    );
  }
  return protection;
};

const CreateProtection: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const resourceArn = requireString(input, "ResourceArn");
  const existing = ctx.store
    .list<StoredProtection>()
    .filter((entry) => entry.key.startsWith("protection/"))
    .map((entry) => entry.value)
    .find((protection) => protection.ResourceArn === resourceArn);
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Protection already exists for resource: ${resourceArn}`,
      400,
    );
  }
  const id = crypto.randomUUID();
  const protection: StoredProtection = {
    Id: id,
    Name: name,
    ResourceArn: resourceArn,
    HealthCheckIds: [],
    ProtectionArn: protectionArn(ctx, id),
  };
  ctx.store.set(protectionKey(id), protection);
  return { ProtectionId: id };
};

const DescribeProtection: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["ProtectionId"]);
  const resourceArn = stringOrUndefined(input["ResourceArn"]);
  if (id !== undefined) {
    return { Protection: requireProtection(ctx, id) };
  }
  if (resourceArn !== undefined) {
    const protection = ctx.store
      .list<StoredProtection>()
      .filter((entry) => entry.key.startsWith("protection/"))
      .map((entry) => entry.value)
      .find((value) => value.ResourceArn === resourceArn);
    if (protection === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Protection not found for resource: ${resourceArn}`,
        400,
      );
    }
    return { Protection: protection };
  }
  throw awsError(
    "InvalidParameterException",
    "You must provide either ProtectionId or ResourceArn.",
    400,
  );
};

const ListProtections: OperationHandler = (_input, ctx) => {
  const protections = ctx.store
    .list<StoredProtection>()
    .filter((entry) => entry.key.startsWith("protection/"))
    .map((entry) => entry.value);
  return { Protections: protections };
};

const DeleteProtection: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ProtectionId");
  requireProtection(ctx, id);
  ctx.store.delete(protectionKey(id));
  return {};
};

const shield = {
  name: "shield",
  protocol: "json",
  operations: {
    CreateProtection,
    DescribeProtection,
    ListProtections,
    DeleteProtection,
  },
  model,
} as const satisfies ServiceDefinition;

export default shield;
