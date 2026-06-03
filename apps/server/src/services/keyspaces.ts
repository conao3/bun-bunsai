import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import keyspacesModel from "../../../../test/vendor/aws-models/keyspaces.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(keyspacesModel);

type StoredKeyspace = {
  keyspaceName: string;
  resourceArn: string;
  replicationStrategy: string;
};

type StoredTable = {
  keyspaceName: string;
  tableName: string;
  resourceArn: string;
  creationTimestamp: number;
  status: string;
  schemaDefinition: unknown;
};

type StoredType = {
  keyspaceName: string;
  typeName: string;
  keyspaceArn: string;
  fieldDefinitions: unknown;
  lastModifiedTimestamp: number;
  status: string;
};

type StoredTag = { key: string; value: string };

const keyspaceKey = (name: string): string => `keyspace/${name}`;
const tableKey = (keyspace: string, table: string): string =>
  `table/${keyspace}/${table}`;
const typeKey = (keyspace: string, type: string): string =>
  `type/${keyspace}/${type}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const keyspaceArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:cassandra:${ctx.region}:${ctx.account}:/keyspace/${name}/`;

const tableArn = (
  ctx: ServiceContext,
  keyspace: string,
  table: string,
): string =>
  `arn:aws:cassandra:${ctx.region}:${ctx.account}:/keyspace/${keyspace}/table/${table}/`;

const requireKeyspace = (ctx: ServiceContext, name: string): StoredKeyspace => {
  const keyspace = ctx.store.get<StoredKeyspace>(keyspaceKey(name));
  if (keyspace === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Keyspace not found: ${name}`,
      400,
    );
  }
  return keyspace;
};

const requireTable = (
  ctx: ServiceContext,
  keyspaceName: string,
  tableName: string,
): StoredTable => {
  const table = ctx.store.get<StoredTable>(tableKey(keyspaceName, tableName));
  if (table === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Table not found: ${tableName}`,
      400,
    );
  }
  return table;
};

const requireType = (
  ctx: ServiceContext,
  keyspaceName: string,
  typeName: string,
): StoredType => {
  const stored = ctx.store.get<StoredType>(typeKey(keyspaceName, typeName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Type not found: ${typeName}`,
      400,
    );
  }
  return stored;
};

const CreateKeyspace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "keyspaceName");
  if (ctx.store.get<StoredKeyspace>(keyspaceKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Keyspace already exists: ${name}`,
      400,
    );
  }
  const keyspace: StoredKeyspace = {
    keyspaceName: name,
    resourceArn: keyspaceArn(ctx, name),
    replicationStrategy: "SINGLE_REGION",
  };
  ctx.store.set(keyspaceKey(name), keyspace);
  return { resourceArn: keyspace.resourceArn };
};

const GetKeyspace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "keyspaceName");
  const keyspace = requireKeyspace(ctx, name);
  return {
    keyspaceName: keyspace.keyspaceName,
    resourceArn: keyspace.resourceArn,
    replicationStrategy: keyspace.replicationStrategy,
  };
};

const ListKeyspaces: OperationHandler = (_input, ctx) => {
  const keyspaces = ctx.store
    .list<StoredKeyspace>()
    .filter((entry) => entry.key.startsWith("keyspace/"))
    .map((entry) => ({
      keyspaceName: entry.value.keyspaceName,
      resourceArn: entry.value.resourceArn,
      replicationStrategy: entry.value.replicationStrategy,
    }));
  return { keyspaces };
};

const DeleteKeyspace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "keyspaceName");
  requireKeyspace(ctx, name);
  ctx.store.delete(keyspaceKey(name));
  return {};
};

const CreateTable: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const tableName = requireString(input, "tableName");
  requireKeyspace(ctx, keyspaceName);
  if (
    ctx.store.get<StoredTable>(tableKey(keyspaceName, tableName)) !== undefined
  ) {
    throw awsError(
      "ConflictException",
      `Table already exists: ${tableName}`,
      400,
    );
  }
  const table: StoredTable = {
    keyspaceName,
    tableName,
    resourceArn: tableArn(ctx, keyspaceName, tableName),
    creationTimestamp: Date.now(),
    status: "ACTIVE",
    schemaDefinition: input["schemaDefinition"],
  };
  ctx.store.set(tableKey(keyspaceName, tableName), table);
  return { resourceArn: table.resourceArn };
};

const GetTable: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const tableName = requireString(input, "tableName");
  const table = ctx.store.get<StoredTable>(tableKey(keyspaceName, tableName));
  if (table === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Table not found: ${tableName}`,
      400,
    );
  }
  return {
    keyspaceName: table.keyspaceName,
    tableName: table.tableName,
    resourceArn: table.resourceArn,
    creationTimestamp: table.creationTimestamp,
    status: table.status,
    schemaDefinition: table.schemaDefinition,
  };
};

const ListTables: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const tables = ctx.store
    .list<StoredTable>()
    .filter((entry) => entry.key.startsWith(`table/${keyspaceName}/`))
    .map((entry) => ({
      keyspaceName: entry.value.keyspaceName,
      tableName: entry.value.tableName,
      resourceArn: entry.value.resourceArn,
    }));
  return { tables };
};

const DeleteTable: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const tableName = requireString(input, "tableName");
  ctx.store.delete(tableKey(keyspaceName, tableName));
  return {};
};

const UpdateKeyspace: OperationHandler = (input, ctx) => {
  const name = requireString(input, "keyspaceName");
  const keyspace = requireKeyspace(ctx, name);
  const spec = input["replicationSpecification"] as
    | Record<string, unknown>
    | undefined;
  const updated: StoredKeyspace = {
    ...keyspace,
    replicationStrategy:
      typeof spec?.["replicationStrategy"] === "string"
        ? spec["replicationStrategy"]
        : keyspace.replicationStrategy,
  };
  ctx.store.set(keyspaceKey(name), updated);
  return { resourceArn: updated.resourceArn };
};

const UpdateTable: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const tableName = requireString(input, "tableName");
  const table = requireTable(ctx, keyspaceName, tableName);
  ctx.store.set(tableKey(keyspaceName, tableName), table);
  return { resourceArn: table.resourceArn };
};

const RestoreTable: OperationHandler = (input, ctx) => {
  const sourceKeyspaceName = requireString(input, "sourceKeyspaceName");
  const sourceTableName = requireString(input, "sourceTableName");
  const targetKeyspaceName = requireString(input, "targetKeyspaceName");
  const targetTableName = requireString(input, "targetTableName");
  requireKeyspace(ctx, targetKeyspaceName);
  const source = requireTable(ctx, sourceKeyspaceName, sourceTableName);
  const restored: StoredTable = {
    keyspaceName: targetKeyspaceName,
    tableName: targetTableName,
    resourceArn: tableArn(ctx, targetKeyspaceName, targetTableName),
    creationTimestamp: Date.now(),
    status: "RESTORING",
    schemaDefinition: source.schemaDefinition,
  };
  ctx.store.set(tableKey(targetKeyspaceName, targetTableName), restored);
  return { restoredTableARN: restored.resourceArn };
};

const GetTableAutoScalingSettings: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const tableName = requireString(input, "tableName");
  const table = requireTable(ctx, keyspaceName, tableName);
  return {
    keyspaceName: table.keyspaceName,
    tableName: table.tableName,
    resourceArn: table.resourceArn,
  };
};

const CreateType: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const typeName = requireString(input, "typeName");
  requireKeyspace(ctx, keyspaceName);
  if (ctx.store.get(typeKey(keyspaceName, typeName)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Type already exists: ${typeName}`,
      400,
    );
  }
  const ksArn = keyspaceArn(ctx, keyspaceName);
  const stored: StoredType = {
    keyspaceName,
    typeName,
    keyspaceArn: ksArn,
    fieldDefinitions: input["fieldDefinitions"],
    lastModifiedTimestamp: Date.now(),
    status: "ACTIVE",
  };
  ctx.store.set(typeKey(keyspaceName, typeName), stored);
  return { keyspaceArn: ksArn, typeName };
};

const GetType: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const typeName = requireString(input, "typeName");
  const stored = requireType(ctx, keyspaceName, typeName);
  return {
    keyspaceName: stored.keyspaceName,
    typeName: stored.typeName,
    keyspaceArn: stored.keyspaceArn,
    fieldDefinitions: stored.fieldDefinitions,
    lastModifiedTimestamp: stored.lastModifiedTimestamp,
    status: stored.status,
    directReferringTables: [],
    directParentTypes: [],
    maxNestingDepth: 0,
  };
};

const ListTypes: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  requireKeyspace(ctx, keyspaceName);
  const types = ctx.store
    .list<StoredType>()
    .filter((entry) => entry.key.startsWith(`type/${keyspaceName}/`))
    .map((entry) => entry.value.typeName);
  return { types };
};

const DeleteType: OperationHandler = (input, ctx) => {
  const keyspaceName = requireString(input, "keyspaceName");
  const typeName = requireString(input, "typeName");
  const stored = requireType(ctx, keyspaceName, typeName);
  ctx.store.delete(typeKey(keyspaceName, typeName));
  return { keyspaceArn: stored.keyspaceArn, typeName };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const incoming = (input["tags"] as StoredTag[] | undefined) ?? [];
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceArn)) ?? [];
  const merged = new Map<string, string>(existing.map((t) => [t.key, t.value]));
  for (const tag of incoming) {
    merged.set(tag.key, tag.value);
  }
  ctx.store.set(
    tagsKey(resourceArn),
    Array.from(merged.entries()).map(([key, value]) => ({ key, value })),
  );
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const toRemove = new Set(
    ((input["tags"] as StoredTag[] | undefined) ?? []).map((t) => t.key),
  );
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceArn)) ?? [];
  ctx.store.set(
    tagsKey(resourceArn),
    existing.filter((t) => !toRemove.has(t.key)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<StoredTag[]>(tagsKey(resourceArn)) ?? [];
  return { tags };
};

const keyspaces = {
  name: "cassandra",
  protocol: "json",
  operations: {
    CreateKeyspace,
    GetKeyspace,
    ListKeyspaces,
    DeleteKeyspace,
    UpdateKeyspace,
    CreateTable,
    GetTable,
    ListTables,
    DeleteTable,
    UpdateTable,
    RestoreTable,
    GetTableAutoScalingSettings,
    CreateType,
    GetType,
    ListTypes,
    DeleteType,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default keyspaces;
