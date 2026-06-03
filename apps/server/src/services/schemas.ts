import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import schemasModel from "../../../../test/vendor/aws-models/schemas.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(schemasModel);

const registryPrefix = "registry:" as const;

type StoredRegistry = {
  RegistryName: string;
  RegistryArn: string;
  Description: string | undefined;
  Tags: Record<string, string>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asTags = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") result[key] = raw;
  }
  return result;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const registryKey = (name: string): string => `${registryPrefix}${name}`;

const registryArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:schemas:${ctx.region}:${ctx.account}:registry/${name}`;

const registryView = (registry: StoredRegistry): Record<string, unknown> => ({
  RegistryArn: registry.RegistryArn,
  RegistryName: registry.RegistryName,
  Description: registry.Description,
  Tags: registry.Tags,
});

const registrySummary = (
  registry: StoredRegistry,
): Record<string, unknown> => ({
  RegistryArn: registry.RegistryArn,
  RegistryName: registry.RegistryName,
  Tags: registry.Tags,
});

const CreateRegistry: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RegistryName");
  if (ctx.store.get<StoredRegistry>(registryKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Registry ${name} already exists.`,
      409,
    );
  }
  const registry: StoredRegistry = {
    RegistryName: name,
    RegistryArn: registryArn(ctx, name),
    Description: stringOrUndefined(input["Description"]),
    Tags: asTags(input["Tags"]),
  };
  ctx.store.set(registryKey(name), registry);
  return registryView(registry);
};

const DescribeRegistry: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RegistryName");
  const registry = ctx.store.get<StoredRegistry>(registryKey(name));
  if (registry === undefined) {
    throw awsError("NotFoundException", `Registry ${name} not found.`, 404);
  }
  return registryView(registry);
};

const ListRegistries: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["RegistryNamePrefix"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 100;
  const registries = ctx.store
    .list<StoredRegistry>()
    .filter((entry) => entry.key.startsWith(registryPrefix))
    .map((entry) => entry.value)
    .filter(
      (registry) =>
        prefix === undefined || registry.RegistryName.startsWith(prefix),
    )
    .sort((a, b) =>
      a.RegistryName < b.RegistryName
        ? -1
        : a.RegistryName > b.RegistryName
          ? 1
          : 0,
    );
  const page = registries.slice(0, limit);
  return { Registries: page.map(registrySummary) };
};

const DeleteRegistry: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RegistryName");
  if (ctx.store.get<StoredRegistry>(registryKey(name)) === undefined) {
    throw awsError("NotFoundException", `Registry ${name} not found.`, 404);
  }
  ctx.store.delete(registryKey(name));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const schemas = {
  name: "schemas",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1" || parts[1] !== "registries") return undefined;
    if (parts.length === 2) {
      if (req.method === "GET") return "ListRegistries";
      return undefined;
    }
    if (parts.length === 4 && parts[2] === "name") {
      if (req.method === "POST") return "CreateRegistry";
      if (req.method === "GET") return "DescribeRegistry";
      if (req.method === "DELETE") return "DeleteRegistry";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateRegistry,
    DescribeRegistry,
    ListRegistries,
    DeleteRegistry,
  },
  model,
} as const satisfies ServiceDefinition;

export default schemas;
