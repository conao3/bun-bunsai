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

const crawlerPrefix = "crawler:";
const jobPrefix = "job:";

type StoredCrawler = {
  input: Record<string, unknown>;
  creationTime: number;
  lastUpdated: number;
};

type StoredJob = {
  input: Record<string, unknown>;
  createdOn: number;
  lastModifiedOn: number;
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
    .filter(
      (entry) =>
        !entry.key.startsWith(crawlerPrefix) &&
        !entry.key.startsWith(jobPrefix),
    )
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

const crawlerView = (
  name: string,
  crawler: StoredCrawler,
): Record<string, unknown> => ({
  Name: name,
  ...(typeof crawler.input["Role"] === "string"
    ? { Role: crawler.input["Role"] }
    : {}),
  ...(typeof crawler.input["DatabaseName"] === "string"
    ? { DatabaseName: crawler.input["DatabaseName"] }
    : {}),
  ...(typeof crawler.input["Description"] === "string"
    ? { Description: crawler.input["Description"] }
    : {}),
  ...(typeof crawler.input["Targets"] === "object" &&
  crawler.input["Targets"] !== null
    ? { Targets: crawler.input["Targets"] }
    : {}),
  ...(Array.isArray(crawler.input["Classifiers"])
    ? { Classifiers: crawler.input["Classifiers"] }
    : {}),
  ...(typeof crawler.input["TablePrefix"] === "string"
    ? { TablePrefix: crawler.input["TablePrefix"] }
    : {}),
  ...(typeof crawler.input["Schedule"] === "string"
    ? { Schedule: { ScheduleExpression: crawler.input["Schedule"] } }
    : {}),
  ...(typeof crawler.input["Configuration"] === "string"
    ? { Configuration: crawler.input["Configuration"] }
    : {}),
  State: "READY",
  CreationTime: crawler.creationTime,
  LastUpdated: crawler.lastUpdated,
});

const requireCrawler = (ctx: ServiceContext, name: string): StoredCrawler => {
  const crawler = ctx.store.get<StoredCrawler>(`${crawlerPrefix}${name}`);
  if (crawler === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Crawler ${name} not found.`,
      400,
    );
  }
  return crawler;
};

const CreateCrawler: OperationHandler = (input, ctx) => {
  const record = asRecord(input);
  const name = requireName(record);
  if (ctx.store.get<StoredCrawler>(`${crawlerPrefix}${name}`) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Crawler already exists. Crawler name:${name}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const crawler: StoredCrawler = {
    input: record,
    creationTime: now,
    lastUpdated: now,
  };
  ctx.store.set(`${crawlerPrefix}${name}`, crawler);
  return {};
};

const GetCrawler: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const crawler = requireCrawler(ctx, name);
  return { Crawler: crawlerView(name, crawler) };
};

const GetCrawlers: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredCrawler>()
    .filter((entry) => entry.key.startsWith(crawlerPrefix))
    .map((entry) =>
      crawlerView(entry.key.slice(crawlerPrefix.length), entry.value),
    );
  return { Crawlers: list };
};

const DeleteCrawler: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireCrawler(ctx, name);
  ctx.store.delete(`${crawlerPrefix}${name}`);
  return {};
};

const jobView = (name: string, job: StoredJob): Record<string, unknown> => ({
  Name: name,
  ...(typeof job.input["JobMode"] === "string"
    ? { JobMode: job.input["JobMode"] }
    : {}),
  ...(typeof job.input["Description"] === "string"
    ? { Description: job.input["Description"] }
    : {}),
  ...(typeof job.input["LogUri"] === "string"
    ? { LogUri: job.input["LogUri"] }
    : {}),
  ...(typeof job.input["Role"] === "string" ? { Role: job.input["Role"] } : {}),
  ...(typeof job.input["Command"] === "object" && job.input["Command"] !== null
    ? { Command: job.input["Command"] }
    : {}),
  ...(typeof job.input["DefaultArguments"] === "object" &&
  job.input["DefaultArguments"] !== null
    ? { DefaultArguments: job.input["DefaultArguments"] }
    : {}),
  ...(typeof job.input["GlueVersion"] === "string"
    ? { GlueVersion: job.input["GlueVersion"] }
    : {}),
  ...(typeof job.input["WorkerType"] === "string"
    ? { WorkerType: job.input["WorkerType"] }
    : {}),
  ...(typeof job.input["NumberOfWorkers"] === "number"
    ? { NumberOfWorkers: job.input["NumberOfWorkers"] }
    : {}),
  ...(typeof job.input["MaxRetries"] === "number"
    ? { MaxRetries: job.input["MaxRetries"] }
    : {}),
  ...(typeof job.input["Timeout"] === "number"
    ? { Timeout: job.input["Timeout"] }
    : {}),
  CreatedOn: job.createdOn,
  LastModifiedOn: job.lastModifiedOn,
});

const requireJob = (ctx: ServiceContext, name: string): StoredJob => {
  const job = ctx.store.get<StoredJob>(`${jobPrefix}${name}`);
  if (job === undefined) {
    throw awsError("EntityNotFoundException", `Job ${name} not found.`, 400);
  }
  return job;
};

const requireJobName = (input: Record<string, unknown>): string => {
  const value = input["JobName"];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidInputException", "JobName is required.", 400);
  }
  return value;
};

const CreateJob: OperationHandler = (input, ctx) => {
  const record = asRecord(input);
  const name = requireName(record);
  if (ctx.store.get<StoredJob>(`${jobPrefix}${name}`) !== undefined) {
    throw awsError(
      "IdempotentParameterMismatchException",
      `Job already exists. Job name:${name}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const job: StoredJob = {
    input: record,
    createdOn: now,
    lastModifiedOn: now,
  };
  ctx.store.set(`${jobPrefix}${name}`, job);
  return { Name: name };
};

const GetJob: OperationHandler = (input, ctx) => {
  const name = requireJobName(input);
  const job = requireJob(ctx, name);
  return { Job: jobView(name, job) };
};

const GetJobs: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith(jobPrefix))
    .map((entry) => jobView(entry.key.slice(jobPrefix.length), entry.value));
  return { Jobs: list };
};

const DeleteJob: OperationHandler = (input, ctx) => {
  const name = requireJobName(input);
  requireJob(ctx, name);
  ctx.store.delete(`${jobPrefix}${name}`);
  return { JobName: name };
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
    CreateCrawler,
    GetCrawler,
    GetCrawlers,
    DeleteCrawler,
    CreateJob,
    GetJob,
    GetJobs,
    DeleteJob,
  },
  model,
} as const;

export default glue;
