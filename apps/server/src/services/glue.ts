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
  partitionIndexes: Record<string, { keys: string[]; indexStatus: string }>;
};

type StoredDatabase = {
  input: Record<string, unknown>;
  createTime: number;
  tables: Record<string, StoredTable>;
};

const crawlerPrefix = "crawler:";
const jobPrefix = "job:";
const triggerPrefix = "trigger:";
const jobRunPrefix = "jobrun:";
const jobBookmarkPrefix = "jobbookmark:";
const connPrefix = "conn:";
const classifierPrefix = "classifier:";
const catalogPrefix = "catalog:";
const partitionPrefix = "partition:";
const colstatsTPrefix = "colstats_t:";
const colstatsPPrefix = "colstats_p:";
const itpPrefix = "itp:";

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

type StoredTrigger = {
  input: Record<string, unknown>;
  createTime: number;
  state: string;
};

type StoredJobRun = {
  jobName: string;
  jobRunId: string;
  startedOn: number;
  completedOn: number | undefined;
  jobRunState: string;
  arguments: Record<string, unknown>;
};

type StoredJobBookmark = {
  jobName: string;
  run: number;
  attempt: number;
  previousRunId: string;
  runId: string;
  version: number;
  jobBookmark: string;
};

type StoredConnection = {
  input: Record<string, unknown>;
  creationTime: number;
  lastUpdatedTime: number;
};

type StoredClassifier = {
  classifierType: "grok" | "xml" | "json" | "csv";
  input: Record<string, unknown>;
  creationTime: number;
  lastUpdated: number;
};

type StoredCatalog = {
  name: string;
  input: Record<string, unknown>;
  createTime: number;
  updateTime: number;
};

type StoredPartition = {
  input: Record<string, unknown>;
  values: string[];
  databaseName: string;
  tableName: string;
  createTime: number;
  updateTime: number;
};

type StoredColumnStats = {
  columnName: string;
  columnType: string;
  analyzedTime: number;
  statisticsData: Record<string, unknown>;
};

type StoredITP = {
  resourceArn: string;
  tableName: string;
  sourceTableConfig: Record<string, unknown> | undefined;
  targetTableConfig: Record<string, unknown> | undefined;
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
        !entry.key.startsWith(jobPrefix) &&
        !entry.key.startsWith(connPrefix) &&
        !entry.key.startsWith(classifierPrefix) &&
        !entry.key.startsWith(catalogPrefix) &&
        !entry.key.startsWith(partitionPrefix) &&
        !entry.key.startsWith(colstatsTPrefix) &&
        !entry.key.startsWith(colstatsPPrefix) &&
        !entry.key.startsWith(itpPrefix),
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
    partitionIndexes: {},
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

const BatchDeleteTable: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const database = requireDatabase(ctx, databaseName);
  const tableNames = Array.isArray(input["TablesToDelete"])
    ? (input["TablesToDelete"] as string[])
    : [];
  const errors: Record<string, unknown>[] = [];
  for (const name of tableNames) {
    if (database.tables[name] !== undefined) {
      delete database.tables[name];
    } else {
      errors.push({
        TableName: name,
        ErrorDetail: {
          ErrorCode: "EntityNotFoundException",
          ErrorMessage: `Table ${name} not found.`,
        },
      });
    }
  }
  if (tableNames.length > 0) {
    ctx.store.set(databaseName, database);
  }
  return { Errors: errors };
};

const DeleteTableVersion: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName = requireName(input);
  requireTable(ctx, databaseName, tableName);
  return {};
};

const BatchDeleteTableVersion: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  return { Errors: [] };
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

const BatchGetJobs: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["JobNames"])
    ? (input["JobNames"] as string[])
    : [];
  const jobs: Record<string, unknown>[] = [];
  const jobsNotFound: string[] = [];
  for (const name of names) {
    const job = ctx.store.get<StoredJob>(`${jobPrefix}${name}`);
    if (job === undefined) {
      jobsNotFound.push(name);
    } else {
      jobs.push(jobView(name, job));
    }
  }
  return { Jobs: jobs, JobsNotFound: jobsNotFound };
};

const ListJobs: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith(jobPrefix))
    .map((e) => e.key.slice(jobPrefix.length));
  return { JobNames: list };
};

const jobRunView = (run: StoredJobRun): Record<string, unknown> => ({
  Id: run.jobRunId,
  JobName: run.jobName,
  StartedOn: run.startedOn,
  ...(run.completedOn !== undefined ? { CompletedOn: run.completedOn } : {}),
  JobRunState: run.jobRunState,
  ...(Object.keys(run.arguments).length > 0
    ? { Arguments: run.arguments }
    : {}),
});

const GetJobRun: OperationHandler = (input, ctx) => {
  const jobName = requireJobName(input);
  const runId = input["RunId"];
  if (typeof runId !== "string" || runId === "") {
    throw awsError("InvalidInputException", "RunId is required.", 400);
  }
  const key = `${jobRunPrefix}${jobName}:${runId}`;
  const run = ctx.store.get<StoredJobRun>(key);
  if (run === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Job run ${runId} not found.`,
      400,
    );
  }
  return { JobRun: jobRunView(run) };
};

const GetJobRuns: OperationHandler = (input, ctx) => {
  const jobName = requireJobName(input);
  requireJob(ctx, jobName);
  const prefix = `${jobRunPrefix}${jobName}:`;
  const runs = ctx.store
    .list<StoredJobRun>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => jobRunView(e.value));
  return { JobRuns: runs };
};

const BatchStopJobRun: OperationHandler = (input, ctx) => {
  const jobName = requireJobName(input);
  const jobRunIds = Array.isArray(input["JobRunIds"])
    ? (input["JobRunIds"] as string[])
    : [];
  const successfulSubmissions: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const jobRunId of jobRunIds) {
    const key = `${jobRunPrefix}${jobName}:${jobRunId}`;
    const run = ctx.store.get<StoredJobRun>(key);
    if (run === undefined) {
      errors.push({
        JobRunId: jobRunId,
        ErrorDetail: {
          ErrorCode: "EntityNotFoundException",
          ErrorMessage: `Job run ${jobRunId} not found.`,
        },
      });
    } else {
      const updated: StoredJobRun = { ...run, jobRunState: "STOPPING" };
      ctx.store.set(key, updated);
      successfulSubmissions.push({ JobName: jobName, JobRunId: jobRunId });
    }
  }
  return { SuccessfulSubmissions: successfulSubmissions, Errors: errors };
};

const GetJobBookmark: OperationHandler = (input, ctx) => {
  const jobName = requireJobName(input);
  requireJob(ctx, jobName);
  const key = `${jobBookmarkPrefix}${jobName}`;
  const bookmark = ctx.store.get<StoredJobBookmark>(key);
  if (bookmark === undefined) {
    return {
      JobBookmarkEntry: {
        JobName: jobName,
        Run: 0,
        Attempt: 0,
        PreviousRunId: "",
        RunId: "",
        Version: 0,
        JobBookmark: "{}",
      },
    };
  }
  return {
    JobBookmarkEntry: {
      JobName: bookmark.jobName,
      Run: bookmark.run,
      Attempt: bookmark.attempt,
      PreviousRunId: bookmark.previousRunId,
      RunId: bookmark.runId,
      Version: bookmark.version,
      JobBookmark: bookmark.jobBookmark,
    },
  };
};

const ResetJobBookmark: OperationHandler = (input, ctx) => {
  const jobName = requireJobName(input);
  requireJob(ctx, jobName);
  const key = `${jobBookmarkPrefix}${jobName}`;
  ctx.store.delete(key);
  return {
    JobBookmarkEntry: {
      JobName: jobName,
      Run: 0,
      Attempt: 0,
      PreviousRunId: "",
      RunId: "",
      Version: 0,
      JobBookmark: "{}",
    },
  };
};

const triggerView = (
  name: string,
  trigger: StoredTrigger,
): Record<string, unknown> => ({
  Name: name,
  ...(typeof trigger.input["Type"] === "string"
    ? { Type: trigger.input["Type"] }
    : {}),
  ...(typeof trigger.input["Description"] === "string"
    ? { Description: trigger.input["Description"] }
    : {}),
  ...(typeof trigger.input["Schedule"] === "string"
    ? { Schedule: trigger.input["Schedule"] }
    : {}),
  ...(Array.isArray(trigger.input["Actions"])
    ? { Actions: trigger.input["Actions"] }
    : {}),
  ...(typeof trigger.input["Predicate"] === "object" &&
  trigger.input["Predicate"] !== null
    ? { Predicate: trigger.input["Predicate"] }
    : {}),
  ...(typeof trigger.input["StartOnCreation"] === "boolean"
    ? { StartOnCreation: trigger.input["StartOnCreation"] }
    : {}),
  State: trigger.state,
  CreateTime: trigger.createTime,
});

const requireTrigger = (ctx: ServiceContext, name: string): StoredTrigger => {
  const trigger = ctx.store.get<StoredTrigger>(`${triggerPrefix}${name}`);
  if (trigger === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Trigger ${name} not found.`,
      400,
    );
  }
  return trigger;
};

const CreateTrigger: OperationHandler = (input, ctx) => {
  const record = asRecord(input);
  const name = requireName(record);
  if (ctx.store.get<StoredTrigger>(`${triggerPrefix}${name}`) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Trigger already exists. Trigger name:${name}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const trigger: StoredTrigger = {
    input: record,
    createTime: now,
    state: "CREATED",
  };
  ctx.store.set(`${triggerPrefix}${name}`, trigger);
  return { Name: name };
};

const GetTrigger: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const trigger = requireTrigger(ctx, name);
  return { Trigger: triggerView(name, trigger) };
};

const GetTriggers: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredTrigger>()
    .filter((e) => e.key.startsWith(triggerPrefix))
    .map((e) => triggerView(e.key.slice(triggerPrefix.length), e.value));
  return { Triggers: list };
};

const ListTriggers: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredTrigger>()
    .filter((e) => e.key.startsWith(triggerPrefix))
    .map((e) => e.key.slice(triggerPrefix.length));
  return { TriggerNames: list };
};

const DeleteTrigger: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireTrigger(ctx, name);
  ctx.store.delete(`${triggerPrefix}${name}`);
  return { Name: name };
};

const BatchGetTriggers: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["TriggerNames"])
    ? (input["TriggerNames"] as string[])
    : [];
  const triggers: Record<string, unknown>[] = [];
  const triggersNotFound: string[] = [];
  for (const name of names) {
    const trigger = ctx.store.get<StoredTrigger>(`${triggerPrefix}${name}`);
    if (trigger === undefined) {
      triggersNotFound.push(name);
    } else {
      triggers.push(triggerView(name, trigger));
    }
  }
  return { Triggers: triggers, TriggersNotFound: triggersNotFound };
};

const BatchGetCrawlers: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["CrawlerNames"])
    ? (input["CrawlerNames"] as string[])
    : [];
  const crawlers: Record<string, unknown>[] = [];
  const crawlersNotFound: string[] = [];
  for (const name of names) {
    const crawler = ctx.store.get<StoredCrawler>(`${crawlerPrefix}${name}`);
    if (crawler === undefined) {
      crawlersNotFound.push(name);
    } else {
      crawlers.push(crawlerView(name, crawler));
    }
  }
  return { Crawlers: crawlers, CrawlersNotFound: crawlersNotFound };
};

const ListCrawlers: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredCrawler>()
    .filter((e) => e.key.startsWith(crawlerPrefix))
    .map((e) => e.key.slice(crawlerPrefix.length));
  return { CrawlerNames: list };
};

const GetCrawlerMetrics: OperationHandler = (input, ctx) => {
  const nameList = Array.isArray(input["CrawlerNameList"])
    ? (input["CrawlerNameList"] as string[])
    : undefined;
  const all = ctx.store
    .list<StoredCrawler>()
    .filter((e) => e.key.startsWith(crawlerPrefix));
  const filtered =
    nameList !== undefined
      ? all.filter((e) => nameList.includes(e.key.slice(crawlerPrefix.length)))
      : all;
  const metrics = filtered.map((e) => ({
    CrawlerName: e.key.slice(crawlerPrefix.length),
    TimeLeftSeconds: 0,
    StillEstimating: false,
    LastRuntimeSeconds: 0,
    MedianRuntimeSeconds: 0,
    TablesCreated: 0,
    TablesUpdated: 0,
    TablesDeleted: 0,
  }));
  return { CrawlerMetricsList: metrics };
};

const partitionValuesKey = (values: string[]): string =>
  values.map((v) => encodeURIComponent(v)).join("|");

const partitionStoreKey = (
  databaseName: string,
  tableName: string,
  values: string[],
): string =>
  `${partitionPrefix}${databaseName}:${tableName}:${partitionValuesKey(values)}`;

const partitionView = (
  partition: StoredPartition,
  catalogId: string,
): Record<string, unknown> => ({
  Values: partition.values,
  DatabaseName: partition.databaseName,
  TableName: partition.tableName,
  ...(typeof partition.input["StorageDescriptor"] === "object" &&
  partition.input["StorageDescriptor"] !== null
    ? { StorageDescriptor: partition.input["StorageDescriptor"] }
    : {}),
  ...(typeof partition.input["Parameters"] === "object" &&
  partition.input["Parameters"] !== null
    ? { Parameters: partition.input["Parameters"] }
    : {}),
  CreationTime: partition.createTime,
  LastAccessTime: partition.updateTime,
  CatalogId: catalogId,
});

const requirePartitionValues = (input: Record<string, unknown>): string[] => {
  const values = input["PartitionValues"];
  if (!Array.isArray(values) || values.length === 0) {
    throw awsError(
      "InvalidInputException",
      "PartitionValues is required.",
      400,
    );
  }
  return values as string[];
};

const CreatePartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const partitionInput = asRecord(input["PartitionInput"]);
  const values = Array.isArray(partitionInput["Values"])
    ? (partitionInput["Values"] as string[])
    : [];
  const key = partitionStoreKey(databaseName, tableName, values);
  if (ctx.store.get<StoredPartition>(key) !== undefined) {
    throw awsError("AlreadyExistsException", `Partition already exists.`, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const partition: StoredPartition = {
    input: partitionInput,
    values,
    databaseName,
    tableName,
    createTime: now,
    updateTime: now,
  };
  ctx.store.set(key, partition);
  return {};
};

const GetPartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const values = requirePartitionValues(input);
  const key = partitionStoreKey(databaseName, tableName, values);
  const partition = ctx.store.get<StoredPartition>(key);
  if (partition === undefined) {
    throw awsError("EntityNotFoundException", `Partition not found.`, 400);
  }
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  return { Partition: partitionView(partition, catalogId) };
};

const GetPartitions: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const prefix = `${partitionPrefix}${databaseName}:${tableName}:`;
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  const list = ctx.store
    .list<StoredPartition>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => partitionView(entry.value, catalogId));
  return { Partitions: list };
};

const DeletePartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const values = requirePartitionValues(input);
  const key = partitionStoreKey(databaseName, tableName, values);
  if (ctx.store.get<StoredPartition>(key) === undefined) {
    throw awsError("EntityNotFoundException", `Partition not found.`, 400);
  }
  ctx.store.delete(key);
  return {};
};

const BatchCreatePartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const partitionInputList = Array.isArray(input["PartitionInputList"])
    ? (input["PartitionInputList"] as Record<string, unknown>[])
    : [];
  const errors: Record<string, unknown>[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (const partitionInput of partitionInputList) {
    const values = Array.isArray(partitionInput["Values"])
      ? (partitionInput["Values"] as string[])
      : [];
    const key = partitionStoreKey(databaseName, tableName, values);
    if (ctx.store.get<StoredPartition>(key) !== undefined) {
      errors.push({
        PartitionValues: values,
        ErrorDetail: {
          ErrorCode: "AlreadyExistsException",
          ErrorMessage: "Partition already exists.",
        },
      });
      continue;
    }
    const partition: StoredPartition = {
      input: partitionInput,
      values,
      databaseName,
      tableName,
      createTime: now,
      updateTime: now,
    };
    ctx.store.set(key, partition);
  }
  return { Errors: errors };
};

const BatchGetPartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : ctx.account;
  const partitionsToGet = Array.isArray(input["PartitionsToGet"])
    ? (input["PartitionsToGet"] as Record<string, unknown>[])
    : [];
  const partitions: Record<string, unknown>[] = [];
  const unprocessedKeys: Record<string, unknown>[] = [];
  for (const pvl of partitionsToGet) {
    const values = Array.isArray(pvl["Values"])
      ? (pvl["Values"] as string[])
      : [];
    const key = partitionStoreKey(databaseName, tableName, values);
    const partition = ctx.store.get<StoredPartition>(key);
    if (partition !== undefined) {
      partitions.push(partitionView(partition, catalogId));
    } else {
      unprocessedKeys.push({ Values: values });
    }
  }
  return { Partitions: partitions, UnprocessedKeys: unprocessedKeys };
};

const BatchDeletePartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const partitionsToDelete = Array.isArray(input["PartitionsToDelete"])
    ? (input["PartitionsToDelete"] as Record<string, unknown>[])
    : [];
  const errors: Record<string, unknown>[] = [];
  for (const pvl of partitionsToDelete) {
    const values = Array.isArray(pvl["Values"])
      ? (pvl["Values"] as string[])
      : [];
    const key = partitionStoreKey(databaseName, tableName, values);
    if (ctx.store.get<StoredPartition>(key) !== undefined) {
      ctx.store.delete(key);
    } else {
      errors.push({
        PartitionValues: values,
        ErrorDetail: {
          ErrorCode: "EntityNotFoundException",
          ErrorMessage: "Partition not found.",
        },
      });
    }
  }
  return { Errors: errors };
};

const BatchUpdatePartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const entries = Array.isArray(input["Entries"])
    ? (input["Entries"] as Record<string, unknown>[])
    : [];
  const errors: Record<string, unknown>[] = [];
  const now = Math.floor(Date.now() / 1000);
  for (const entry of entries) {
    const pvl = asRecord(entry["PartitionValueList"]);
    const oldValues = Array.isArray(pvl["Values"])
      ? (pvl["Values"] as string[])
      : [];
    const partitionInput = asRecord(entry["PartitionInput"]);
    const oldKey = partitionStoreKey(databaseName, tableName, oldValues);
    const existing = ctx.store.get<StoredPartition>(oldKey);
    if (existing === undefined) {
      errors.push({
        PartitionValueList: { Values: oldValues },
        ErrorDetail: {
          ErrorCode: "EntityNotFoundException",
          ErrorMessage: "Partition not found.",
        },
      });
      continue;
    }
    const newValues = Array.isArray(partitionInput["Values"])
      ? (partitionInput["Values"] as string[])
      : oldValues;
    ctx.store.delete(oldKey);
    const newKey = partitionStoreKey(databaseName, tableName, newValues);
    const updated: StoredPartition = {
      input: partitionInput,
      values: newValues,
      databaseName,
      tableName,
      createTime: existing.createTime,
      updateTime: now,
    };
    ctx.store.set(newKey, updated);
  }
  return { Errors: errors };
};

const CreatePartitionIndex: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const database = requireDatabase(ctx, databaseName);
  const table = requireTable(ctx, databaseName, tableName);
  const partitionIndex = asRecord(input["PartitionIndex"]);
  const indexName =
    typeof partitionIndex["IndexName"] === "string"
      ? (partitionIndex["IndexName"] as string)
      : "";
  if (!indexName) {
    throw awsError("InvalidInputException", "IndexName is required.", 400);
  }
  if (table.partitionIndexes[indexName] !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Partition index ${indexName} already exists.`,
      400,
    );
  }
  const keys = Array.isArray(partitionIndex["Keys"])
    ? (partitionIndex["Keys"] as string[])
    : [];
  table.partitionIndexes[indexName] = { keys, indexStatus: "ACTIVE" };
  ctx.store.set(databaseName, database);
  return {};
};

const DeletePartitionIndex: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const indexName =
    typeof input["IndexName"] === "string"
      ? (input["IndexName"] as string)
      : "";
  const database = requireDatabase(ctx, databaseName);
  const table = requireTable(ctx, databaseName, tableName);
  if (table.partitionIndexes[indexName] === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Partition index ${indexName} not found.`,
      400,
    );
  }
  delete table.partitionIndexes[indexName];
  ctx.store.set(databaseName, database);
  return {};
};

const GetPartitionIndexes: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const table = requireTable(ctx, databaseName, tableName);
  const list = Object.entries(table.partitionIndexes).map(([name, idx]) => ({
    IndexName: name,
    Keys: idx.keys.map((k) => ({ Name: k, Type: "string" })),
    IndexStatus: idx.indexStatus,
    BackfillErrors: [],
  }));
  return { PartitionIndexDescriptorList: list };
};

const connectionView = (
  name: string,
  conn: StoredConnection,
): Record<string, unknown> => ({
  Name: name,
  ...(typeof conn.input["Description"] === "string"
    ? { Description: conn.input["Description"] }
    : {}),
  ...(typeof conn.input["ConnectionType"] === "string"
    ? { ConnectionType: conn.input["ConnectionType"] }
    : {}),
  ...(typeof conn.input["ConnectionProperties"] === "object" &&
  conn.input["ConnectionProperties"] !== null
    ? { ConnectionProperties: conn.input["ConnectionProperties"] }
    : {}),
  ...(Array.isArray(conn.input["PhysicalConnectionRequirements"])
    ? {
        PhysicalConnectionRequirements:
          conn.input["PhysicalConnectionRequirements"],
      }
    : {}),
  CreationTime: conn.creationTime,
  LastUpdatedTime: conn.lastUpdatedTime,
});

const requireConnection = (
  ctx: ServiceContext,
  name: string,
): StoredConnection => {
  const conn = ctx.store.get<StoredConnection>(`${connPrefix}${name}`);
  if (conn === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Connection ${name} not found.`,
      400,
    );
  }
  return conn;
};

const CreateConnection: OperationHandler = (input, ctx) => {
  const connInput = asRecord(input["ConnectionInput"]);
  const name = requireName(connInput);
  if (ctx.store.get<StoredConnection>(`${connPrefix}${name}`) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Connection already exists. Connection name:${name}`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const conn: StoredConnection = {
    input: connInput,
    creationTime: now,
    lastUpdatedTime: now,
  };
  ctx.store.set(`${connPrefix}${name}`, conn);
  return { CreateConnectionStatus: "READY" };
};

const GetConnection: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const conn = requireConnection(ctx, name);
  return { Connection: connectionView(name, conn) };
};

const GetConnections: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith(connPrefix))
    .map((entry) =>
      connectionView(entry.key.slice(connPrefix.length), entry.value),
    );
  return { ConnectionList: list };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const name =
    typeof input["ConnectionName"] === "string"
      ? (input["ConnectionName"] as string)
      : "";
  if (!name) {
    throw awsError("InvalidInputException", "ConnectionName is required.", 400);
  }
  requireConnection(ctx, name);
  ctx.store.delete(`${connPrefix}${name}`);
  return {};
};

const BatchDeleteConnection: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["ConnectionNameList"])
    ? (input["ConnectionNameList"] as string[])
    : [];
  const succeeded: string[] = [];
  const errors: Record<string, Record<string, unknown>> = {};
  for (const name of names) {
    if (ctx.store.get<StoredConnection>(`${connPrefix}${name}`) !== undefined) {
      ctx.store.delete(`${connPrefix}${name}`);
      succeeded.push(name);
    } else {
      errors[name] = {
        ErrorCode: "EntityNotFoundException",
        ErrorMessage: `Connection ${name} not found.`,
      };
    }
  }
  return { Succeeded: succeeded, Errors: errors };
};

const DescribeConnectionType: OperationHandler = (input, _ctx) => {
  const connectionType =
    typeof input["ConnectionType"] === "string"
      ? (input["ConnectionType"] as string)
      : "";
  return {
    ConnectionType: connectionType,
    Description: "",
    Capabilities: {
      SupportedAuthenticationTypes: [],
      SupportedDataOperations: [],
      SupportedComputeEnvironments: [],
    },
  };
};

const DeleteConnectionType: OperationHandler = (_input, _ctx) => {
  return {};
};

const classifierName = (input: Record<string, unknown>): string => {
  for (const key of [
    "GrokClassifier",
    "XMLClassifier",
    "JsonClassifier",
    "CsvClassifier",
  ]) {
    const sub = asRecord(input[key]);
    if (sub["Name"] && typeof sub["Name"] === "string") {
      return sub["Name"] as string;
    }
  }
  throw awsError("InvalidInputException", "Classifier name is required.", 400);
};

const classifierType = (
  input: Record<string, unknown>,
): "grok" | "xml" | "json" | "csv" => {
  if (input["GrokClassifier"]) return "grok";
  if (input["XMLClassifier"]) return "xml";
  if (input["JsonClassifier"]) return "json";
  return "csv";
};

const classifierSubInput = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const sub =
    asRecord(input["GrokClassifier"]) ||
    asRecord(input["XMLClassifier"]) ||
    asRecord(input["JsonClassifier"]) ||
    asRecord(input["CsvClassifier"]);
  return sub;
};

const classifierView = (stored: StoredClassifier): Record<string, unknown> => {
  const base = {
    Name: stored.input["Name"],
    ...(typeof stored.input["Classification"] === "string"
      ? { Classification: stored.input["Classification"] }
      : {}),
    CreationTime: stored.creationTime,
    LastUpdated: stored.lastUpdated,
    Version: 1,
  };
  if (stored.classifierType === "grok") {
    return {
      GrokClassifier: {
        ...base,
        ...(typeof stored.input["GrokPattern"] === "string"
          ? { GrokPattern: stored.input["GrokPattern"] }
          : {}),
        ...(typeof stored.input["CustomPatterns"] === "string"
          ? { CustomPatterns: stored.input["CustomPatterns"] }
          : {}),
      },
    };
  }
  if (stored.classifierType === "xml") {
    return {
      XMLClassifier: {
        ...base,
        ...(typeof stored.input["RowTag"] === "string"
          ? { RowTag: stored.input["RowTag"] }
          : {}),
      },
    };
  }
  if (stored.classifierType === "json") {
    return {
      JsonClassifier: {
        ...base,
        ...(typeof stored.input["JsonPath"] === "string"
          ? { JsonPath: stored.input["JsonPath"] }
          : {}),
      },
    };
  }
  return {
    CsvClassifier: {
      ...base,
      ...(typeof stored.input["Delimiter"] === "string"
        ? { Delimiter: stored.input["Delimiter"] }
        : {}),
      ...(typeof stored.input["QuoteSymbol"] === "string"
        ? { QuoteSymbol: stored.input["QuoteSymbol"] }
        : {}),
      ...(Array.isArray(stored.input["Header"])
        ? { Header: stored.input["Header"] }
        : {}),
    },
  };
};

const requireClassifier = (
  ctx: ServiceContext,
  name: string,
): StoredClassifier => {
  const c = ctx.store.get<StoredClassifier>(`${classifierPrefix}${name}`);
  if (c === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Classifier ${name} not found.`,
      400,
    );
  }
  return c;
};

const CreateClassifier: OperationHandler = (input, ctx) => {
  const name = classifierName(input);
  if (
    ctx.store.get<StoredClassifier>(`${classifierPrefix}${name}`) !== undefined
  ) {
    throw awsError(
      "AlreadyExistsException",
      `Classifier already exists: ${name}`,
      400,
    );
  }
  const ctype = classifierType(input);
  const sub = classifierSubInput(input);
  const now = Math.floor(Date.now() / 1000);
  const stored: StoredClassifier = {
    classifierType: ctype,
    input: sub,
    creationTime: now,
    lastUpdated: now,
  };
  ctx.store.set(`${classifierPrefix}${name}`, stored);
  return {};
};

const GetClassifier: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  const stored = requireClassifier(ctx, name);
  return { Classifier: classifierView(stored) };
};

const GetClassifiers: OperationHandler = (_input, ctx) => {
  const list = ctx.store
    .list<StoredClassifier>()
    .filter((entry) => entry.key.startsWith(classifierPrefix))
    .map((entry) => classifierView(entry.value));
  return { Classifiers: list };
};

const DeleteClassifier: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  requireClassifier(ctx, name);
  ctx.store.delete(`${classifierPrefix}${name}`);
  return {};
};

const CreateCatalog: OperationHandler = (input, ctx) => {
  const name = requireName(input);
  if (ctx.store.get<StoredCatalog>(`${catalogPrefix}${name}`) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Catalog already exists: ${name}`,
      400,
    );
  }
  const catalogInput = asRecord(input["CatalogInput"]);
  const now = Math.floor(Date.now() / 1000);
  const stored: StoredCatalog = {
    name,
    input: catalogInput,
    createTime: now,
    updateTime: now,
  };
  ctx.store.set(`${catalogPrefix}${name}`, stored);
  return {};
};

const GetCatalog: OperationHandler = (input, ctx) => {
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : "";
  if (!catalogId) {
    throw awsError("InvalidInputException", "CatalogId is required.", 400);
  }
  const stored = ctx.store.get<StoredCatalog>(`${catalogPrefix}${catalogId}`);
  if (stored === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Catalog ${catalogId} not found.`,
      400,
    );
  }
  return {
    Catalog: {
      Name: stored.name,
      CatalogId: catalogId,
      ...(typeof stored.input["Description"] === "string"
        ? { Description: stored.input["Description"] }
        : {}),
      CreateTime: stored.createTime,
      UpdateTime: stored.updateTime,
    },
  };
};

const DeleteCatalog: OperationHandler = (input, ctx) => {
  const catalogId =
    typeof input["CatalogId"] === "string"
      ? (input["CatalogId"] as string)
      : "";
  if (!catalogId) {
    throw awsError("InvalidInputException", "CatalogId is required.", 400);
  }
  if (
    ctx.store.get<StoredCatalog>(`${catalogPrefix}${catalogId}`) === undefined
  ) {
    throw awsError(
      "EntityNotFoundException",
      `Catalog ${catalogId} not found.`,
      400,
    );
  }
  ctx.store.delete(`${catalogPrefix}${catalogId}`);
  return {};
};

const colstatsTKey = (
  databaseName: string,
  tableName: string,
  columnName: string,
): string => `${colstatsTPrefix}${databaseName}:${tableName}:${columnName}`;

const colstatsPKey = (
  databaseName: string,
  tableName: string,
  values: string[],
  columnName: string,
): string =>
  `${colstatsPPrefix}${databaseName}:${tableName}:${partitionValuesKey(values)}:${columnName}`;

const columnStatsView = (
  stored: StoredColumnStats,
): Record<string, unknown> => ({
  ColumnName: stored.columnName,
  ColumnType: stored.columnType,
  AnalyzedTime: stored.analyzedTime,
  StatisticsData: stored.statisticsData,
});

const GetColumnStatisticsForTable: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const columnNames = Array.isArray(input["ColumnNames"])
    ? (input["ColumnNames"] as string[])
    : [];
  const results: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const colName of columnNames) {
    const key = colstatsTKey(databaseName, tableName, colName);
    const stored = ctx.store.get<StoredColumnStats>(key);
    if (stored !== undefined) {
      results.push({
        ColumnName: colName,
        Statistics: columnStatsView(stored),
      });
    } else {
      errors.push({
        ColumnName: colName,
        Error: {
          ErrorCode: "EntityNotFoundException",
          ErrorMessage: `Column statistics for ${colName} not found.`,
        },
      });
    }
  }
  return { ColumnStatisticsList: results, Errors: errors };
};

const DeleteColumnStatisticsForTable: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const columnName =
    typeof input["ColumnName"] === "string"
      ? (input["ColumnName"] as string)
      : "";
  requireTable(ctx, databaseName, tableName);
  const key = colstatsTKey(databaseName, tableName, columnName);
  ctx.store.delete(key);
  return {};
};

const GetColumnStatisticsForPartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const partitionValues = Array.isArray(input["PartitionValues"])
    ? (input["PartitionValues"] as string[])
    : [];
  requireTable(ctx, databaseName, tableName);
  const columnNames = Array.isArray(input["ColumnNames"])
    ? (input["ColumnNames"] as string[])
    : [];
  const results: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];
  for (const colName of columnNames) {
    const key = colstatsPKey(databaseName, tableName, partitionValues, colName);
    const stored = ctx.store.get<StoredColumnStats>(key);
    if (stored !== undefined) {
      results.push({
        ColumnName: colName,
        Statistics: columnStatsView(stored),
      });
    } else {
      errors.push({
        ColumnName: colName,
        Error: {
          ErrorCode: "EntityNotFoundException",
          ErrorMessage: `Column statistics for ${colName} not found.`,
        },
      });
    }
  }
  return { ColumnStatisticsList: results, Errors: errors };
};

const DeleteColumnStatisticsForPartition: OperationHandler = (input, ctx) => {
  const databaseName =
    typeof input["DatabaseName"] === "string"
      ? (input["DatabaseName"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const columnName =
    typeof input["ColumnName"] === "string"
      ? (input["ColumnName"] as string)
      : "";
  const partitionValues = Array.isArray(input["PartitionValues"])
    ? (input["PartitionValues"] as string[])
    : [];
  requireTable(ctx, databaseName, tableName);
  const key = colstatsPKey(
    databaseName,
    tableName,
    partitionValues,
    columnName,
  );
  ctx.store.delete(key);
  return {};
};

const CreateIntegrationTableProperties: OperationHandler = (input, ctx) => {
  const resourceArn =
    typeof input["ResourceArn"] === "string"
      ? (input["ResourceArn"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const key = `${itpPrefix}${resourceArn}:${tableName}`;
  const stored: StoredITP = {
    resourceArn,
    tableName,
    sourceTableConfig:
      typeof input["SourceTableConfig"] === "object" &&
      input["SourceTableConfig"] !== null
        ? (input["SourceTableConfig"] as Record<string, unknown>)
        : undefined,
    targetTableConfig:
      typeof input["TargetTableConfig"] === "object" &&
      input["TargetTableConfig"] !== null
        ? (input["TargetTableConfig"] as Record<string, unknown>)
        : undefined,
  };
  ctx.store.set(key, stored);
  return {};
};

const GetIntegrationTableProperties: OperationHandler = (input, ctx) => {
  const resourceArn =
    typeof input["ResourceArn"] === "string"
      ? (input["ResourceArn"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const key = `${itpPrefix}${resourceArn}:${tableName}`;
  const stored = ctx.store.get<StoredITP>(key);
  if (stored === undefined) {
    throw awsError(
      "EntityNotFoundException",
      `Integration table properties not found.`,
      400,
    );
  }
  return {
    ResourceArn: stored.resourceArn,
    TableName: stored.tableName,
    ...(stored.sourceTableConfig !== undefined
      ? { SourceTableConfig: stored.sourceTableConfig }
      : {}),
    ...(stored.targetTableConfig !== undefined
      ? { TargetTableConfig: stored.targetTableConfig }
      : {}),
  };
};

const DeleteIntegrationTableProperties: OperationHandler = (input, ctx) => {
  const resourceArn =
    typeof input["ResourceArn"] === "string"
      ? (input["ResourceArn"] as string)
      : "";
  const tableName =
    typeof input["TableName"] === "string"
      ? (input["TableName"] as string)
      : "";
  const key = `${itpPrefix}${resourceArn}:${tableName}`;
  ctx.store.delete(key);
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
    BatchDeleteTable,
    DeleteTableVersion,
    BatchDeleteTableVersion,
    BatchGetCrawlers,
    CreateCrawler,
    GetCrawler,
    GetCrawlers,
    DeleteCrawler,
    ListCrawlers,
    GetCrawlerMetrics,
    BatchGetJobs,
    CreateJob,
    GetJob,
    GetJobs,
    DeleteJob,
    ListJobs,
    GetJobRun,
    GetJobRuns,
    BatchStopJobRun,
    GetJobBookmark,
    ResetJobBookmark,
    BatchGetTriggers,
    CreateTrigger,
    GetTrigger,
    GetTriggers,
    DeleteTrigger,
    ListTriggers,
    CreatePartition,
    GetPartition,
    GetPartitions,
    DeletePartition,
    BatchCreatePartition,
    BatchGetPartition,
    BatchDeletePartition,
    BatchUpdatePartition,
    CreatePartitionIndex,
    DeletePartitionIndex,
    GetPartitionIndexes,
    CreateConnection,
    GetConnection,
    GetConnections,
    DeleteConnection,
    BatchDeleteConnection,
    DescribeConnectionType,
    DeleteConnectionType,
    CreateClassifier,
    GetClassifier,
    GetClassifiers,
    DeleteClassifier,
    CreateCatalog,
    GetCatalog,
    DeleteCatalog,
    GetColumnStatisticsForTable,
    DeleteColumnStatisticsForTable,
    GetColumnStatisticsForPartition,
    DeleteColumnStatisticsForPartition,
    CreateIntegrationTableProperties,
    GetIntegrationTableProperties,
    DeleteIntegrationTableProperties,
  },
  model,
} as const;

export default glue;
