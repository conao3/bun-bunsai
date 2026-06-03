import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import lakeformationModel from "../../../../test/vendor/aws-models/lakeformation.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(lakeformationModel);

const resourcePrefix = "resource:" as const;

type StoredResource = {
  resourceArn: string;
  roleArn?: string;
  withFederation?: boolean;
  hybridAccessEnabled?: boolean;
  withPrivilegedAccess?: boolean;
  expectedResourceOwnerAccount?: string;
  lastModified: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const boolOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidInputException", `${field} is required.`, 400);
  }
  return value;
};

const resourceKey = (arn: string): string => `${resourcePrefix}${arn}`;

const resourceInfo = (resource: StoredResource): Record<string, unknown> => ({
  ResourceArn: resource.resourceArn,
  RoleArn: resource.roleArn,
  LastModified: resource.lastModified,
  WithFederation: resource.withFederation,
  HybridAccessEnabled: resource.hybridAccessEnabled,
  WithPrivilegedAccess: resource.withPrivilegedAccess,
  ExpectedResourceOwnerAccount: resource.expectedResourceOwnerAccount,
});

const RegisterResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  if (ctx.store.get<StoredResource>(resourceKey(resourceArn)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Resource ${resourceArn} is already registered.`,
      400,
    );
  }
  const resource: StoredResource = {
    resourceArn,
    roleArn: stringOrUndefined(input.RoleArn),
    withFederation: boolOrUndefined(input.WithFederation),
    hybridAccessEnabled: boolOrUndefined(input.HybridAccessEnabled),
    withPrivilegedAccess: boolOrUndefined(input.WithPrivilegedAccess),
    expectedResourceOwnerAccount: stringOrUndefined(
      input.ExpectedResourceOwnerAccount,
    ),
    lastModified: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(resourceKey(resourceArn), resource);
  return {};
};

const DescribeResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  const resource = ctx.store.get<StoredResource>(resourceKey(resourceArn));
  if (resource === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  return { ResourceInfo: resourceInfo(resource) };
};

const ListResources: OperationHandler = (_rawInput, ctx) => {
  const entries = ctx.store.list<StoredResource>();
  return {
    ResourceInfoList: entries.map((entry) => resourceInfo(entry.value)),
  };
};

const DeregisterResource: OperationHandler = (rawInput, ctx) => {
  const input = asRecord(rawInput);
  const resourceArn = requireString(input, "ResourceArn");
  if (ctx.store.get<StoredResource>(resourceKey(resourceArn)) === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Resource ${resourceArn} not found.`,
      404,
    );
  }
  ctx.store.delete(resourceKey(resourceArn));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const lakeformation = {
  name: "lakeformation",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.method !== "POST") return undefined;
    const parts = pathSegments(req.path);
    if (parts.length !== 1) return undefined;
    return parts[0];
  },
  operations: {
    RegisterResource,
    DescribeResource,
    ListResources,
    DeregisterResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default lakeformation;
