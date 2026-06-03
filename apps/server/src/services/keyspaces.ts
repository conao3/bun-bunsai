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

const keyspaceKey = (name: string): string => `keyspace/${name}`;
const tableKey = (keyspace: string, table: string): string =>
  `table/${keyspace}/${table}`;

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

const keyspaces = {
  name: "cassandra",
  protocol: "json",
  operations: {
    CreateKeyspace,
    GetKeyspace,
    ListKeyspaces,
    DeleteKeyspace,
    CreateTable,
    GetTable,
    ListTables,
    DeleteTable,
  },
  model,
} as const satisfies ServiceDefinition;

export default keyspaces;
