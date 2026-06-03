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
const schemaPrefix = "schema:" as const;
const discovererPrefix = "discoverer:" as const;
const codeBindingPrefix = "codebinding:" as const;
const policyPrefix = "policy:" as const;

type StoredRegistry = {
  RegistryName: string;
  RegistryArn: string;
  Description: string | undefined;
  Tags: Record<string, string>;
};

type StoredSchemaVersion = {
  SchemaVersion: string;
  Content: string;
  Type: string;
  VersionCreatedDate: string;
};

type StoredSchema = {
  RegistryName: string;
  SchemaName: string;
  SchemaArn: string;
  Description: string | undefined;
  Tags: Record<string, string>;
  Versions: StoredSchemaVersion[];
  LastModified: string;
};

type StoredDiscoverer = {
  DiscovererId: string;
  DiscovererArn: string;
  SourceArn: string;
  Description: string | undefined;
  CrossAccount: boolean;
  State: "STARTED" | "STOPPED";
  Tags: Record<string, string>;
};

type StoredCodeBinding = {
  RegistryName: string;
  SchemaName: string;
  Language: string;
  SchemaVersion: string;
  CreationDate: string;
  LastModified: string;
  Status: "CREATE_IN_PROGRESS" | "CREATE_COMPLETE" | "CREATE_FAILED";
};

type StoredResourcePolicy = {
  RegistryName: string | undefined;
  Policy: string;
  RevisionId: string;
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

const nowIso = (): string => new Date().toISOString();

const registryKey = (name: string): string => `${registryPrefix}${name}`;
const schemaKey = (registryName: string, schemaName: string): string =>
  `${schemaPrefix}${registryName}:${schemaName}`;
const discovererKey = (id: string): string => `${discovererPrefix}${id}`;
const codeBindingKey = (
  registryName: string,
  schemaName: string,
  language: string,
): string => `${codeBindingPrefix}${registryName}:${schemaName}:${language}`;
const policyKey = (registryName: string | undefined): string =>
  `${policyPrefix}${registryName ?? ""}`;

const registryArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:schemas:${ctx.region}:${ctx.account}:registry/${name}`;

const schemaArn = (
  ctx: ServiceContext,
  registryName: string,
  schemaName: string,
): string =>
  `arn:aws:schemas:${ctx.region}:${ctx.account}:schema/${registryName}/${schemaName}`;

const discovererArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:schemas:${ctx.region}:${ctx.account}:discoverer/${id}`;

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

const schemaView = (
  schema: StoredSchema,
  version: StoredSchemaVersion | undefined,
): Record<string, unknown> => ({
  SchemaArn: schema.SchemaArn,
  SchemaName: schema.SchemaName,
  Description: schema.Description,
  Tags: schema.Tags,
  LastModified: schema.LastModified,
  SchemaVersion: version?.SchemaVersion,
  Content: version?.Content,
  Type: version?.Type,
  VersionCreatedDate: version?.VersionCreatedDate,
});

const schemaSummary = (schema: StoredSchema): Record<string, unknown> => ({
  SchemaArn: schema.SchemaArn,
  SchemaName: schema.SchemaName,
  LastModified: schema.LastModified,
  Tags: schema.Tags,
  VersionCount: schema.Versions.length,
});

const discovererView = (d: StoredDiscoverer): Record<string, unknown> => ({
  DiscovererArn: d.DiscovererArn,
  DiscovererId: d.DiscovererId,
  SourceArn: d.SourceArn,
  Description: d.Description,
  CrossAccount: d.CrossAccount,
  State: d.State,
  Tags: d.Tags,
});

const discovererSummary = (d: StoredDiscoverer): Record<string, unknown> => ({
  DiscovererArn: d.DiscovererArn,
  DiscovererId: d.DiscovererId,
  SourceArn: d.SourceArn,
  CrossAccount: d.CrossAccount,
  State: d.State,
  Tags: d.Tags,
});

const getTagsByArn = (
  ctx: ServiceContext,
  arn: string,
): Record<string, string> | undefined => {
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith(registryPrefix) &&
      (entry.value as StoredRegistry).RegistryArn === arn
    )
      return (entry.value as StoredRegistry).Tags;
    if (
      entry.key.startsWith(schemaPrefix) &&
      (entry.value as StoredSchema).SchemaArn === arn
    )
      return (entry.value as StoredSchema).Tags;
    if (
      entry.key.startsWith(discovererPrefix) &&
      (entry.value as StoredDiscoverer).DiscovererArn === arn
    )
      return (entry.value as StoredDiscoverer).Tags;
  }
  return undefined;
};

const updateTagsByArn = (
  ctx: ServiceContext,
  arn: string,
  updater: (tags: Record<string, string>) => Record<string, string>,
): boolean => {
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith(registryPrefix) &&
      (entry.value as StoredRegistry).RegistryArn === arn
    ) {
      const r = entry.value as StoredRegistry;
      ctx.store.set(entry.key, { ...r, Tags: updater(r.Tags) });
      return true;
    }
    if (
      entry.key.startsWith(schemaPrefix) &&
      (entry.value as StoredSchema).SchemaArn === arn
    ) {
      const s = entry.value as StoredSchema;
      ctx.store.set(entry.key, { ...s, Tags: updater(s.Tags) });
      return true;
    }
    if (
      entry.key.startsWith(discovererPrefix) &&
      (entry.value as StoredDiscoverer).DiscovererArn === arn
    ) {
      const d = entry.value as StoredDiscoverer;
      ctx.store.set(entry.key, { ...d, Tags: updater(d.Tags) });
      return true;
    }
  }
  return false;
};

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

const UpdateRegistry: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RegistryName");
  const registry = ctx.store.get<StoredRegistry>(registryKey(name));
  if (registry === undefined) {
    throw awsError("NotFoundException", `Registry ${name} not found.`, 404);
  }
  const updated: StoredRegistry = {
    ...registry,
    Description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : registry.Description,
  };
  ctx.store.set(registryKey(name), updated);
  return registryView(updated);
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

const CreateSchema: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  if (ctx.store.get<StoredRegistry>(registryKey(registryName)) === undefined) {
    throw awsError(
      "NotFoundException",
      `Registry ${registryName} not found.`,
      404,
    );
  }
  const content = requireString(input, "Content");
  const type = requireString(input, "Type");
  const ts = nowIso();
  const version: StoredSchemaVersion = {
    SchemaVersion: "1",
    Content: content,
    Type: type,
    VersionCreatedDate: ts,
  };
  const schema: StoredSchema = {
    RegistryName: registryName,
    SchemaName: schemaName,
    SchemaArn: schemaArn(ctx, registryName, schemaName),
    Description: stringOrUndefined(input["Description"]),
    Tags: asTags(input["Tags"]),
    Versions: [version],
    LastModified: ts,
  };
  ctx.store.set(schemaKey(registryName, schemaName), schema);
  return schemaView(schema, version);
};

const DescribeSchema: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const schema = ctx.store.get<StoredSchema>(
    schemaKey(registryName, schemaName),
  );
  if (schema === undefined) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  const requestedVersion = stringOrUndefined(input["SchemaVersion"]);
  const version =
    requestedVersion !== undefined
      ? schema.Versions.find((v) => v.SchemaVersion === requestedVersion)
      : schema.Versions[schema.Versions.length - 1];
  if (version === undefined) {
    throw awsError("NotFoundException", `Schema version not found.`, 404);
  }
  return schemaView(schema, version);
};

const UpdateSchema: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const schema = ctx.store.get<StoredSchema>(
    schemaKey(registryName, schemaName),
  );
  if (schema === undefined) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  const ts = nowIso();
  const lastVersion = schema.Versions[schema.Versions.length - 1];
  const content =
    stringOrUndefined(input["Content"]) ?? lastVersion?.Content ?? "";
  const type =
    stringOrUndefined(input["Type"]) ?? lastVersion?.Type ?? "OpenApi3";
  const newVersion: StoredSchemaVersion = {
    SchemaVersion: String(schema.Versions.length + 1),
    Content: content,
    Type: type,
    VersionCreatedDate: ts,
  };
  const updated: StoredSchema = {
    ...schema,
    Description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : schema.Description,
    Versions: [...schema.Versions, newVersion],
    LastModified: ts,
  };
  ctx.store.set(schemaKey(registryName, schemaName), updated);
  return schemaView(updated, newVersion);
};

const DeleteSchema: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  if (
    ctx.store.get<StoredSchema>(schemaKey(registryName, schemaName)) ===
    undefined
  ) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  ctx.store.delete(schemaKey(registryName, schemaName));
  return {};
};

const ListSchemas: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  if (ctx.store.get<StoredRegistry>(registryKey(registryName)) === undefined) {
    throw awsError(
      "NotFoundException",
      `Registry ${registryName} not found.`,
      404,
    );
  }
  const prefix = stringOrUndefined(input["SchemaNamePrefix"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 100;
  const keyPrefix = `${schemaPrefix}${registryName}:`;
  const schemas = ctx.store
    .list<StoredSchema>()
    .filter((entry) => entry.key.startsWith(keyPrefix))
    .map((entry) => entry.value)
    .filter((s) => prefix === undefined || s.SchemaName.startsWith(prefix))
    .sort((a, b) =>
      a.SchemaName < b.SchemaName ? -1 : a.SchemaName > b.SchemaName ? 1 : 0,
    );
  return { Schemas: schemas.slice(0, limit).map(schemaSummary) };
};

const ListSchemaVersions: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const schema = ctx.store.get<StoredSchema>(
    schemaKey(registryName, schemaName),
  );
  if (schema === undefined) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 100;
  return {
    SchemaVersions: schema.Versions.slice(0, limit).map((v) => ({
      SchemaArn: schema.SchemaArn,
      SchemaName: schema.SchemaName,
      SchemaVersion: v.SchemaVersion,
      Type: v.Type,
    })),
  };
};

const DeleteSchemaVersion: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const schemaVersion = requireString(input, "SchemaVersion");
  const schema = ctx.store.get<StoredSchema>(
    schemaKey(registryName, schemaName),
  );
  if (schema === undefined) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  const remaining = schema.Versions.filter(
    (v) => v.SchemaVersion !== schemaVersion,
  );
  if (remaining.length === schema.Versions.length) {
    throw awsError(
      "NotFoundException",
      `Schema version ${schemaVersion} not found.`,
      404,
    );
  }
  ctx.store.set(schemaKey(registryName, schemaName), {
    ...schema,
    Versions: remaining,
  });
  return {};
};

const ExportSchema: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const schema = ctx.store.get<StoredSchema>(
    schemaKey(registryName, schemaName),
  );
  if (schema === undefined) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  const requestedVersion = stringOrUndefined(input["SchemaVersion"]);
  const version =
    requestedVersion !== undefined
      ? schema.Versions.find((v) => v.SchemaVersion === requestedVersion)
      : schema.Versions[schema.Versions.length - 1];
  if (version === undefined) {
    throw awsError("NotFoundException", `Schema version not found.`, 404);
  }
  return {
    Content: version.Content,
    SchemaArn: schema.SchemaArn,
    SchemaName: schema.SchemaName,
    SchemaVersion: version.SchemaVersion,
    Type: version.Type,
  };
};

const SearchSchemas: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const keywords = stringOrUndefined(input["Keywords"]) ?? "";
  if (ctx.store.get<StoredRegistry>(registryKey(registryName)) === undefined) {
    throw awsError(
      "NotFoundException",
      `Registry ${registryName} not found.`,
      404,
    );
  }
  const keyPrefix = `${schemaPrefix}${registryName}:`;
  const schemas = ctx.store
    .list<StoredSchema>()
    .filter((entry) => entry.key.startsWith(keyPrefix))
    .map((entry) => entry.value)
    .filter(
      (s) =>
        keywords === "" ||
        s.SchemaName.includes(keywords) ||
        s.Versions.some((v) => v.Content.includes(keywords)),
    );
  return {
    Schemas: schemas.map((s) => ({
      RegistryName: s.RegistryName,
      SchemaArn: s.SchemaArn,
      SchemaName: s.SchemaName,
      SchemaVersions: s.Versions.map((v) => ({
        CreatedDate: v.VersionCreatedDate,
        SchemaVersion: v.SchemaVersion,
        Type: v.Type,
      })),
    })),
  };
};

const CreateDiscoverer: OperationHandler = (input, ctx) => {
  const sourceArn = requireString(input, "SourceArn");
  const safeId =
    sourceArn
      .split(":")
      .pop()
      ?.replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "") ?? "default";
  const id = `auto-${safeId}-${ctx.store.list().filter((e) => e.key.startsWith(discovererPrefix)).length}`;
  const discoverer: StoredDiscoverer = {
    DiscovererId: id,
    DiscovererArn: discovererArn(ctx, id),
    SourceArn: sourceArn,
    Description: stringOrUndefined(input["Description"]),
    CrossAccount:
      typeof input["CrossAccount"] === "boolean"
        ? (input["CrossAccount"] as boolean)
        : true,
    State: "STARTED",
    Tags: asTags(input["Tags"]),
  };
  ctx.store.set(discovererKey(id), discoverer);
  return discovererView(discoverer);
};

const DescribeDiscoverer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DiscovererId");
  const discoverer = ctx.store.get<StoredDiscoverer>(discovererKey(id));
  if (discoverer === undefined) {
    throw awsError("NotFoundException", `Discoverer ${id} not found.`, 404);
  }
  return discovererView(discoverer);
};

const UpdateDiscoverer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DiscovererId");
  const discoverer = ctx.store.get<StoredDiscoverer>(discovererKey(id));
  if (discoverer === undefined) {
    throw awsError("NotFoundException", `Discoverer ${id} not found.`, 404);
  }
  const updated: StoredDiscoverer = {
    ...discoverer,
    Description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : discoverer.Description,
    CrossAccount:
      typeof input["CrossAccount"] === "boolean"
        ? (input["CrossAccount"] as boolean)
        : discoverer.CrossAccount,
  };
  ctx.store.set(discovererKey(id), updated);
  return discovererView(updated);
};

const DeleteDiscoverer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DiscovererId");
  if (ctx.store.get<StoredDiscoverer>(discovererKey(id)) === undefined) {
    throw awsError("NotFoundException", `Discoverer ${id} not found.`, 404);
  }
  ctx.store.delete(discovererKey(id));
  return {};
};

const ListDiscoverers: OperationHandler = (input, ctx) => {
  const idPrefix = stringOrUndefined(input["DiscovererIdPrefix"]);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 100;
  const discoverers = ctx.store
    .list<StoredDiscoverer>()
    .filter((entry) => entry.key.startsWith(discovererPrefix))
    .map((entry) => entry.value)
    .filter(
      (d) => idPrefix === undefined || d.DiscovererId.startsWith(idPrefix),
    );
  return { Discoverers: discoverers.slice(0, limit).map(discovererSummary) };
};

const StartDiscoverer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DiscovererId");
  const discoverer = ctx.store.get<StoredDiscoverer>(discovererKey(id));
  if (discoverer === undefined) {
    throw awsError("NotFoundException", `Discoverer ${id} not found.`, 404);
  }
  ctx.store.set(discovererKey(id), { ...discoverer, State: "STARTED" });
  return { DiscovererId: id, State: "STARTED" };
};

const StopDiscoverer: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DiscovererId");
  const discoverer = ctx.store.get<StoredDiscoverer>(discovererKey(id));
  if (discoverer === undefined) {
    throw awsError("NotFoundException", `Discoverer ${id} not found.`, 404);
  }
  ctx.store.set(discovererKey(id), { ...discoverer, State: "STOPPED" });
  return { DiscovererId: id, State: "STOPPED" };
};

const GetDiscoveredSchema: OperationHandler = (input) => {
  const type = requireString(input, "Type");
  const events = Array.isArray(input["Events"])
    ? (input["Events"] as string[])
    : [];
  const props: Record<string, unknown> = {};
  for (const e of events) {
    try {
      for (const k of Object.keys(JSON.parse(e) as Record<string, unknown>)) {
        props[k] = { type: "string" };
      }
    } catch {
      void 0;
    }
  }
  const content = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "Discovered", version: "1.0.0" },
    paths: {},
    components: { schemas: { Event: { type: "object", properties: props } } },
    "x-amazon-events-schema-type": type,
  });
  return { Content: content };
};

const PutCodeBinding: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const language = requireString(input, "Language");
  const schema = ctx.store.get<StoredSchema>(
    schemaKey(registryName, schemaName),
  );
  if (schema === undefined) {
    throw awsError("NotFoundException", `Schema ${schemaName} not found.`, 404);
  }
  const requestedVersion = stringOrUndefined(input["SchemaVersion"]);
  const version =
    requestedVersion !== undefined
      ? schema.Versions.find((v) => v.SchemaVersion === requestedVersion)
      : schema.Versions[schema.Versions.length - 1];
  if (version === undefined) {
    throw awsError("NotFoundException", `Schema version not found.`, 404);
  }
  const ts = nowIso();
  const binding: StoredCodeBinding = {
    RegistryName: registryName,
    SchemaName: schemaName,
    Language: language,
    SchemaVersion: version.SchemaVersion,
    CreationDate: ts,
    LastModified: ts,
    Status: "CREATE_COMPLETE",
  };
  ctx.store.set(codeBindingKey(registryName, schemaName, language), binding);
  return {
    CreationDate: binding.CreationDate,
    LastModified: binding.LastModified,
    SchemaVersion: binding.SchemaVersion,
    Status: binding.Status,
  };
};

const DescribeCodeBinding: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const language = requireString(input, "Language");
  const binding = ctx.store.get<StoredCodeBinding>(
    codeBindingKey(registryName, schemaName, language),
  );
  if (binding === undefined) {
    throw awsError("NotFoundException", `Code binding not found.`, 404);
  }
  return {
    CreationDate: binding.CreationDate,
    LastModified: binding.LastModified,
    SchemaVersion: binding.SchemaVersion,
    Status: binding.Status,
  };
};

const GetCodeBindingSource: OperationHandler = (input, ctx) => {
  const registryName = requireString(input, "RegistryName");
  const schemaName = requireString(input, "SchemaName");
  const language = requireString(input, "Language");
  const binding = ctx.store.get<StoredCodeBinding>(
    codeBindingKey(registryName, schemaName, language),
  );
  if (binding === undefined) {
    throw awsError("NotFoundException", `Code binding not found.`, 404);
  }
  return { Body: `// Generated ${language} code for ${schemaName}\n` };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const registryName = stringOrUndefined(input["RegistryName"]);
  const policy = requireString(input, "Policy");
  const revisionId = String(
    ctx.store
      .list<StoredResourcePolicy>()
      .filter((e) => e.key.startsWith(policyPrefix)).length + 1,
  );
  const stored: StoredResourcePolicy = {
    RegistryName: registryName,
    Policy: policy,
    RevisionId: revisionId,
  };
  ctx.store.set(policyKey(registryName), stored);
  return { Policy: policy, RevisionId: revisionId };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const registryName = stringOrUndefined(input["RegistryName"]);
  const stored = ctx.store.get<StoredResourcePolicy>(policyKey(registryName));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Resource policy not found.`, 404);
  }
  return { Policy: stored.Policy, RevisionId: stored.RevisionId };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const registryName = stringOrUndefined(input["RegistryName"]);
  if (
    ctx.store.get<StoredResourcePolicy>(policyKey(registryName)) === undefined
  ) {
    throw awsError("NotFoundException", `Resource policy not found.`, 404);
  }
  ctx.store.delete(policyKey(registryName));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = asTags(input["Tags"]);
  const found = updateTagsByArn(ctx, arn, (existing) => ({
    ...existing,
    ...newTags,
  }));
  if (!found) {
    throw awsError("NotFoundException", `Resource ${arn} not found.`, 404);
  }
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const found = updateTagsByArn(ctx, arn, (existing) => {
    const updated = { ...existing };
    for (const key of tagKeys) delete updated[key];
    return updated;
  });
  if (!found) {
    throw awsError("NotFoundException", `Resource ${arn} not found.`, 404);
  }
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = getTagsByArn(ctx, arn);
  if (tags === undefined) {
    throw awsError("NotFoundException", `Resource ${arn} not found.`, 404);
  }
  return { Tags: tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const schemas = {
  name: "schemas",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "tags" && parts.length === 2) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    if (parts[0] !== "v1") return undefined;

    if (parts[1] === "discover" && parts.length === 2) {
      if (req.method === "POST") return "GetDiscoveredSchema";
      return undefined;
    }

    if (parts[1] === "policy" && parts.length === 2) {
      if (req.method === "GET") return "GetResourcePolicy";
      if (req.method === "PUT") return "PutResourcePolicy";
      if (req.method === "DELETE") return "DeleteResourcePolicy";
      return undefined;
    }

    if (parts[1] === "discoverers") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateDiscoverer";
        if (req.method === "GET") return "ListDiscoverers";
        return undefined;
      }
      if (parts[2] === "id" && parts.length >= 4) {
        if (parts.length === 4) {
          if (req.method === "GET") return "DescribeDiscoverer";
          if (req.method === "PUT") return "UpdateDiscoverer";
          if (req.method === "DELETE") return "DeleteDiscoverer";
          return undefined;
        }
        if (parts.length === 5 && parts[4] === "start" && req.method === "POST")
          return "StartDiscoverer";
        if (parts.length === 5 && parts[4] === "stop" && req.method === "POST")
          return "StopDiscoverer";
      }
      return undefined;
    }

    if (parts[1] !== "registries") return undefined;

    if (parts.length === 2 && req.method === "GET") return "ListRegistries";

    if (parts[2] !== "name" || parts.length < 4) return undefined;

    if (parts.length === 4) {
      if (req.method === "POST") return "CreateRegistry";
      if (req.method === "GET") return "DescribeRegistry";
      if (req.method === "DELETE") return "DeleteRegistry";
      if (req.method === "PUT") return "UpdateRegistry";
      return undefined;
    }

    if (parts[4] !== "schemas") return undefined;

    if (parts.length === 5 && req.method === "GET") return "ListSchemas";

    if (parts.length === 6 && parts[5] === "search" && req.method === "GET")
      return "SearchSchemas";

    if (parts[5] !== "name" || parts.length < 7) return undefined;

    if (parts.length === 7) {
      if (req.method === "POST") return "CreateSchema";
      if (req.method === "GET") return "DescribeSchema";
      if (req.method === "PUT") return "UpdateSchema";
      if (req.method === "DELETE") return "DeleteSchema";
      return undefined;
    }

    if (parts.length === 8) {
      if (parts[7] === "versions" && req.method === "GET")
        return "ListSchemaVersions";
      if (parts[7] === "export" && req.method === "GET") return "ExportSchema";
      return undefined;
    }

    if (parts.length === 9) {
      if (parts[7] === "version" && req.method === "DELETE")
        return "DeleteSchemaVersion";
      if (parts[7] === "language") {
        if (req.method === "POST") return "PutCodeBinding";
        if (req.method === "GET") return "DescribeCodeBinding";
      }
      return undefined;
    }

    if (
      parts.length === 10 &&
      parts[7] === "language" &&
      parts[9] === "source" &&
      req.method === "GET"
    )
      return "GetCodeBindingSource";

    return undefined;
  },
  operations: {
    CreateRegistry,
    DescribeRegistry,
    UpdateRegistry,
    ListRegistries,
    DeleteRegistry,
    CreateSchema,
    DescribeSchema,
    UpdateSchema,
    DeleteSchema,
    ListSchemas,
    ListSchemaVersions,
    DeleteSchemaVersion,
    ExportSchema,
    SearchSchemas,
    CreateDiscoverer,
    DescribeDiscoverer,
    UpdateDiscoverer,
    DeleteDiscoverer,
    ListDiscoverers,
    StartDiscoverer,
    StopDiscoverer,
    GetDiscoveredSchema,
    PutCodeBinding,
    DescribeCodeBinding,
    GetCodeBindingSource,
    PutResourcePolicy,
    GetResourcePolicy,
    DeleteResourcePolicy,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default schemas;
