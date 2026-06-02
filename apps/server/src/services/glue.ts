import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import glueModel from "../../../../test/vendor/aws-models/glue.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(glueModel);

type StoredTable = {
  input: Record<string, unknown>;
  databaseName: string;
  createTime: number;
  updateTime: number;
};

type StoredDatabase = {
  input: Record<string, unknown>;
  createTime: number;
  tables: Record<string, StoredTable>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const requireName = (input: Record<string, unknown>): string => {
  const value = input["Name"];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidInputException", "Name is required.", 400);
  }
  return value;
};

const requireDatabase = (ctx: ServiceContext, name: string): StoredDatabase => {
  const database = ctx.store.get<StoredDatabase>(name);
  if (database === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Database ${name} not found.`,
      400,
    );
  }
  return database;
};

const databaseView = (
  name: string,
  database: StoredDatabase,
  catalogId: string,
): Record<string, unknown> => ({
  Name: name,
  ...(typeof database.input["Description"] === "string"
    ? { Description: database.input["Description"] }
    : {}),
  ...(typeof database.input["LocationUri"] === "string"
    ? { LocationUri: database.input["LocationUri"] }
    : {}),
  ...(typeof database.input["Parameters"] === "object" &&
  database.input["Parameters"] !== null
    ? { Parameters: database.input["Parameters"] }
    : {}),
  CreateTime: database.createTime,
  CatalogId: catalogId,
});

const tableView = (
  name: string,
  table: StoredTable,
  catalogId: string,
): Record<string, unknown> => ({
  Name: name,
  DatabaseName: table.databaseName,
  ...(typeof table.input["Description"] === "string"
    ? { Description: table.input["Description"] }
    : {}),
  ...(typeof table.input["Owner"] === "string"
    ? { Owner: table.input["Owner"] }
    : {}),
  ...(typeof table.input["TableType"] === "string"
    ? { TableType: table.input["TableType"] }
    : {}),
  ...(typeof table.input["StorageDescriptor"] === "object" &&
  table.input["StorageDescriptor"] !== null
    ? { StorageDescriptor: table.input["StorageDescriptor"] }
    : {}),
  ...(Array.isArray(table.input["PartitionKeys"])
    ? { PartitionKeys: table.input["PartitionKeys"] }
    : {}),
  ...(typeof table.input["Parameters"] === "object" &&
  table.input["Parameters"] !== null
    ? { Parameters: table.input["Parameters"] }
    : {}),
  CreateTime: table.createTime,
  UpdateTime: table.updateTime,
  CatalogId: catalogId,
});

const CreateDatabase: OperationHandler = (input, ctx) => {
  const databaseInput = asRecord(input["DatabaseInput"]);
  const name = requireName(databaseInput);
  if (ctx.store.get<StoredDatabase>(name) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Database already exists. Database name:${name}`,
      400,
    );
  }
  const database: StoredDatabase = {
    input: databaseInput,
    createTime: Math.floor(Date.now() / 1000),
    tables: {},
  };
  ctx.store.set(name, database);
  return {};
};

const GetDatabase: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const database = requireDatabase(ctx, name);
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  return { Database: databaseView(name, database, catalogId) };
};

const GetDatabases: OperationHandler = (input, ctx) => {
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  const list = ctx.store
    .list<StoredDatabase>()
    .map((entry) => databaseView(entry.key, entry.value, catalogId));
  return { DatabaseList: list };
};

const DeleteDatabase: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireDatabase(ctx, name);
  ctx.store.delete(name);
  return {};
};

const CreateTable: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const database = requireDatabase(ctx, databaseName);
  const tableInput = asRecord(input["TableInput"]);
  const name = requireName(tableInput);
  if (database.tables[name] !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Table already exists. Table name:${name}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  database.tables[name] = {
    input: tableInput,
    databaseName,
    createTime: now,
    updateTime: now,
  };
  ctx.store.set(databaseName, database);
  return {};
};

const requireTable = (
  ctx: ServiceContext,
  databaseName: string,
  name: string,
): StoredTable => {
  const database = requireDatabase(ctx, databaseName);
  const table = database.tables[name];
  if (table === undefined) {
    throw awsError("EntityNotFoundException", `Table ${name} not found.`, 400);
  }
  return table;
};

const GetTable: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const name = requireName(input);
  const table = requireTable(ctx, databaseName, name);
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  return { Table: tableView(name, table, catalogId) };
};

const GetTables: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const database = requireDatabase(ctx, databaseName);
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  const list = Object.entries(database.tables).map(([name, table]) =>
    tableView(name, table, catalogId),
  );
  return { TableList: list };
};

const DeleteTable: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const name = requireName(input);
  const database = requireDatabase(ctx, databaseName);
  if (database.tables[name] === undefined) {
    throw awsError("EntityNotFoundException", `Table ${name} not found.`, 400);
  }
  delete database.tables[name];
  ctx.store.set(databaseName, database);
  return {};
};

const glue: ServiceDefinition = {
  name: "glue",
  protocol: "json",
  operations: {
    CreateDatabase,
    GetDatabase,
    GetDatabases,
    DeleteDatabase,
    CreateTable,
    GetTable,
    GetTables,
    DeleteTable,
  },
  model,
} as const;

export default glue;
