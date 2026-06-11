import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import timestreamWriteModel from "../../../../test/vendor/aws-models/timestream-write.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(timestreamWriteModel);

const dbPrefix = "db:" as const;
const tablePrefix = "table:" as const;
export const recordPrefix = "record:" as const;
const tagPrefix = "tags:" as const;
const batchPrefix = "batch:" as const;

type StoredDatabase = {
  DatabaseName: string;
  Arn: string;
  CreationTime: number;
  LastUpdatedTime: number;
  KmsKeyId?: string;
};

type StoredTable = {
  DatabaseName: string;
  TableName: string;
  Arn: string;
  TableStatus: string;
  CreationTime: number;
  LastUpdatedTime: number;
  RetentionProperties: {
    MemoryStoreRetentionPeriodInHours: number;
    MagneticStoreRetentionPeriodInDays: number;
  };
};

export type StoredRecord = {
  DatabaseName: string;
  TableName: string;
  Dimensions: Array<{
    Name: string;
    Value: string;
    DimensionValueType?: string;
  }>;
  MeasureName?: string;
  MeasureValue?: string;
  MeasureValueType?: string;
  MeasureValues?: Array<{ Name: string; Value: string; Type: string }>;
  Time: string;
  TimeUnit: string;
  Version: number;
};

type StoredBatchLoadTask = {
  TaskId: string;
  TaskStatus: string;
  DatabaseName: string;
  TableName: string;
  CreationTime: number;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  field: string,
): string | undefined => {
  const value = input[field];
  return typeof value === "string" ? value : undefined;
};

const makeArn = (ctx: ServiceContext, resource: string, name: string): string =>
  `arn:aws:timestream:${ctx.region}:${ctx.account}:${resource}/${name}`;

const requireDb = (ctx: ServiceContext, dbName: string): StoredDatabase => {
  const db = ctx.store.get<StoredDatabase>(`${dbPrefix}${dbName}`);
  if (db === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The database ${dbName} does not exist.`,
      400,
    );
  }
  return db;
};

const requireTable = (
  ctx: ServiceContext,
  dbName: string,
  tableName: string,
): StoredTable => {
  requireDb(ctx, dbName);
  const table = ctx.store.get<StoredTable>(
    `${tablePrefix}${dbName}/${tableName}`,
  );
  if (table === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The table ${tableName} does not exist in database ${dbName}.`,
      400,
    );
  }
  return table;
};

const dbView = (db: StoredDatabase, ctx: ServiceContext) => {
  const tables = ctx.store
    .list<StoredTable>()
    .filter((e) => e.key.startsWith(`${tablePrefix}${db.DatabaseName}/`));
  return {
    Arn: db.Arn,
    DatabaseName: db.DatabaseName,
    TableCount: tables.length,
    KmsKeyId: db.KmsKeyId,
    CreationTime: Math.floor(db.CreationTime / 1000),
    LastUpdatedTime: Math.floor(db.LastUpdatedTime / 1000),
  };
};

const tableView = (table: StoredTable) => ({
  Arn: table.Arn,
  DatabaseName: table.DatabaseName,
  TableName: table.TableName,
  TableStatus: table.TableStatus,
  RetentionProperties: table.RetentionProperties,
  CreationTime: Math.floor(table.CreationTime / 1000),
  LastUpdatedTime: Math.floor(table.LastUpdatedTime / 1000),
});

const DescribeEndpoints: OperationHandler = (_input, ctx) => ({
  Endpoints: [
    {
      Address: `cell1.timestream.${ctx.region}.amazonaws.com`,
      CachePeriodInMinutes: 10080,
    },
  ],
});

const CreateDatabase: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  if (ctx.store.get(`${dbPrefix}${DatabaseName}`) !== undefined) {
    throw awsError(
      "ConflictException",
      `Database ${DatabaseName} already exists.`,
      409,
    );
  }
  const now = Date.now();
  const db: StoredDatabase = {
    DatabaseName,
    Arn: makeArn(ctx, "database", DatabaseName),
    CreationTime: now,
    LastUpdatedTime: now,
    KmsKeyId: optionalString(input, "KmsKeyId"),
  };
  ctx.store.set(`${dbPrefix}${DatabaseName}`, db);
  const tags = input["Tags"];
  if (Array.isArray(tags) && tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags as Array<{ Key: string; Value: string }>) {
      tagMap[t.Key] = t.Value;
    }
    ctx.store.set(`${tagPrefix}${db.Arn}`, tagMap);
  }
  return { Database: dbView(db, ctx) };
};

const DescribeDatabase: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const db = requireDb(ctx, DatabaseName);
  return { Database: dbView(db, ctx) };
};

const ListDatabases: OperationHandler = (_input, ctx) => {
  const dbs = ctx.store
    .list<StoredDatabase>()
    .filter((e) => e.key.startsWith(dbPrefix))
    .map((e) => dbView(e.value, ctx));
  return { Databases: dbs };
};

const UpdateDatabase: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const KmsKeyId = requireString(input, "KmsKeyId");
  const db = requireDb(ctx, DatabaseName);
  const updated: StoredDatabase = {
    ...db,
    KmsKeyId,
    LastUpdatedTime: Date.now(),
  };
  ctx.store.set(`${dbPrefix}${DatabaseName}`, updated);
  return { Database: dbView(updated, ctx) };
};

const DeleteDatabase: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  requireDb(ctx, DatabaseName);
  ctx.store.delete(`${dbPrefix}${DatabaseName}`);
  const tablesToDelete = ctx.store
    .list<StoredTable>()
    .filter((e) => e.key.startsWith(`${tablePrefix}${DatabaseName}/`));
  for (const t of tablesToDelete) {
    ctx.store.delete(t.key);
  }
  return {};
};

const defaultRetention = {
  MemoryStoreRetentionPeriodInHours: 6,
  MagneticStoreRetentionPeriodInDays: 73000,
};

const CreateTable: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const TableName = requireString(input, "TableName");
  requireDb(ctx, DatabaseName);
  const tableKey = `${tablePrefix}${DatabaseName}/${TableName}`;
  if (ctx.store.get(tableKey) !== undefined) {
    throw awsError(
      "ConflictException",
      `Table ${TableName} already exists in database ${DatabaseName}.`,
      409,
    );
  }
  const retention =
    typeof input["RetentionProperties"] === "object" &&
    input["RetentionProperties"] !== null
      ? (input["RetentionProperties"] as {
          MemoryStoreRetentionPeriodInHours: number;
          MagneticStoreRetentionPeriodInDays: number;
        })
      : defaultRetention;
  const now = Date.now();
  const table: StoredTable = {
    DatabaseName,
    TableName,
    Arn: makeArn(ctx, `database:${DatabaseName}:table`, TableName),
    TableStatus: "ACTIVE",
    CreationTime: now,
    LastUpdatedTime: now,
    RetentionProperties: retention,
  };
  ctx.store.set(tableKey, table);
  const tags = input["Tags"];
  if (Array.isArray(tags) && tags.length > 0) {
    const tagMap: Record<string, string> = {};
    for (const t of tags as Array<{ Key: string; Value: string }>) {
      tagMap[t.Key] = t.Value;
    }
    ctx.store.set(`${tagPrefix}${table.Arn}`, tagMap);
  }
  return { Table: tableView(table) };
};

const DescribeTable: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const TableName = requireString(input, "TableName");
  const table = requireTable(ctx, DatabaseName, TableName);
  return { Table: tableView(table) };
};

const ListTables: OperationHandler = (input, ctx) => {
  const DatabaseName = optionalString(input, "DatabaseName");
  const prefix =
    DatabaseName !== undefined ? `${tablePrefix}${DatabaseName}/` : tablePrefix;
  const tables = ctx.store
    .list<StoredTable>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => tableView(e.value));
  return { Tables: tables };
};

const UpdateTable: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const TableName = requireString(input, "TableName");
  const table = requireTable(ctx, DatabaseName, TableName);
  const retention =
    typeof input["RetentionProperties"] === "object" &&
    input["RetentionProperties"] !== null
      ? (input["RetentionProperties"] as {
          MemoryStoreRetentionPeriodInHours: number;
          MagneticStoreRetentionPeriodInDays: number;
        })
      : table.RetentionProperties;
  const updated: StoredTable = {
    ...table,
    RetentionProperties: retention,
    LastUpdatedTime: Date.now(),
  };
  ctx.store.set(`${tablePrefix}${DatabaseName}/${TableName}`, updated);
  return { Table: tableView(updated) };
};

const DeleteTable: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const TableName = requireString(input, "TableName");
  requireTable(ctx, DatabaseName, TableName);
  ctx.store.delete(`${tablePrefix}${DatabaseName}/${TableName}`);
  const recordsToDelete = ctx.store
    .list<StoredRecord>()
    .filter((e) =>
      e.key.startsWith(`${recordPrefix}${DatabaseName}/${TableName}:`),
    );
  for (const r of recordsToDelete) ctx.store.delete(r.key);
  return {};
};

const normalizeTimeMs = (time: string, timeUnit: string): number => {
  const t = parseInt(time, 10);
  switch (timeUnit.toUpperCase()) {
    case "SECONDS":
      return t * 1000;
    case "MILLISECONDS":
      return t;
    case "MICROSECONDS":
      return Math.floor(t / 1000);
    case "NANOSECONDS":
      return Math.floor(t / 1_000_000);
    default:
      return t;
  }
};

const mergeRecord = (
  common: Record<string, unknown> | undefined,
  rec: Record<string, unknown>,
  dbName: string,
  tableName: string,
): StoredRecord => {
  const dims: Array<{
    Name: string;
    Value: string;
    DimensionValueType?: string;
  }> = [];
  if (common !== undefined) {
    const cd = common["Dimensions"];
    if (Array.isArray(cd)) {
      for (const d of cd as Array<{
        Name: string;
        Value: string;
        DimensionValueType?: string;
      }>) {
        dims.push({
          Name: d.Name,
          Value: d.Value,
          DimensionValueType: d.DimensionValueType,
        });
      }
    }
  }
  const rd = rec["Dimensions"];
  if (Array.isArray(rd)) {
    for (const d of rd as Array<{
      Name: string;
      Value: string;
      DimensionValueType?: string;
    }>) {
      if (!dims.some((existing) => existing.Name === d.Name)) {
        dims.push({
          Name: d.Name,
          Value: d.Value,
          DimensionValueType: d.DimensionValueType,
        });
      }
    }
  }

  const measureName =
    (rec["MeasureName"] as string | undefined) ??
    (common?.["MeasureName"] as string | undefined);
  const measureValue =
    (rec["MeasureValue"] as string | undefined) ??
    (common?.["MeasureValue"] as string | undefined);
  const measureValueType =
    (rec["MeasureValueType"] as string | undefined) ??
    (common?.["MeasureValueType"] as string | undefined) ??
    "DOUBLE";

  const mvRaw = rec["MeasureValues"] ?? common?.["MeasureValues"];
  const measureValues = Array.isArray(mvRaw)
    ? (mvRaw as Array<{ Name: string; Value: string; Type: string }>)
    : undefined;

  const time = String(
    (rec["Time"] as string | undefined) ??
      (common?.["Time"] as string | undefined) ??
      Date.now(),
  );
  const timeUnit =
    (rec["TimeUnit"] as string | undefined) ??
    (common?.["TimeUnit"] as string | undefined) ??
    "MILLISECONDS";

  const version = (rec["Version"] as number | undefined) ?? 1;

  return {
    DatabaseName: dbName,
    TableName: tableName,
    Dimensions: dims,
    MeasureName: measureName,
    MeasureValue: measureValue,
    MeasureValueType: measureValueType,
    MeasureValues: measureValues,
    Time: time,
    TimeUnit: timeUnit,
    Version: version,
  };
};

const WriteRecords: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const TableName = requireString(input, "TableName");
  requireTable(ctx, DatabaseName, TableName);

  const rawRecords = input["Records"];
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw awsError("ValidationException", "Records is required.", 400);
  }

  const common =
    typeof input["CommonAttributes"] === "object" &&
    input["CommonAttributes"] !== null
      ? (input["CommonAttributes"] as Record<string, unknown>)
      : undefined;

  const rejected: Array<{ RecordIndex: number; Reason: string }> = [];
  let ingested = 0;

  for (let i = 0; i < (rawRecords as unknown[]).length; i++) {
    const raw = rawRecords[i] as Record<string, unknown>;
    try {
      const rec = mergeRecord(common, raw, DatabaseName, TableName);
      if (rec.MeasureName === undefined && rec.MeasureValues === undefined) {
        rejected.push({ RecordIndex: i, Reason: "MeasureName is required." });
        continue;
      }
      const timeMs = normalizeTimeMs(rec.Time, rec.TimeUnit);
      const key = `${recordPrefix}${DatabaseName}/${TableName}:${String(timeMs).padStart(16, "0")}:${crypto.randomUUID()}`;
      ctx.store.set(key, rec);
      ingested++;
    } catch {
      rejected.push({
        RecordIndex: i,
        Reason: "Record validation failed.",
      });
    }
  }

  if (rejected.length > 0) {
    throw awsError(
      "RejectedRecordsException",
      `Some records were rejected: ${rejected.length} rejected.`,
      419,
      { RejectedRecords: rejected },
    );
  }

  return {
    RecordsIngested: {
      Total: ingested,
      MemoryStore: ingested,
      MagneticStore: 0,
    },
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const ResourceARN = requireString(input, "ResourceARN");
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(`${tagPrefix}${ResourceARN}`) ?? {};
  for (const t of tags as Array<{ Key: string; Value: string }>) {
    existing[t.Key] = t.Value;
  }
  ctx.store.set(`${tagPrefix}${ResourceARN}`, existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const ResourceARN = requireString(input, "ResourceARN");
  const tagKeys = input["TagKeys"];
  if (!Array.isArray(tagKeys)) {
    throw awsError("ValidationException", "TagKeys is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(`${tagPrefix}${ResourceARN}`) ?? {};
  for (const key of tagKeys as string[]) {
    delete existing[key];
  }
  ctx.store.set(`${tagPrefix}${ResourceARN}`, existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const ResourceARN = requireString(input, "ResourceARN");
  const existing =
    ctx.store.get<Record<string, string>>(`${tagPrefix}${ResourceARN}`) ?? {};
  const Tags = Object.entries(existing).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { Tags };
};

const CreateBatchLoadTask: OperationHandler = (input, ctx) => {
  const DatabaseName = requireString(input, "DatabaseName");
  const TableName = requireString(input, "TableName");
  requireTable(ctx, DatabaseName, TableName);
  const TaskId = crypto.randomUUID();
  const task: StoredBatchLoadTask = {
    TaskId,
    TaskStatus: "CREATED",
    DatabaseName,
    TableName,
    CreationTime: Date.now(),
  };
  ctx.store.set(`${batchPrefix}${TaskId}`, task);
  return { TaskId };
};

const DescribeBatchLoadTask: OperationHandler = (input, ctx) => {
  const TaskId = requireString(input, "TaskId");
  const task = ctx.store.get<StoredBatchLoadTask>(`${batchPrefix}${TaskId}`);
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Batch load task ${TaskId} not found.`,
      400,
    );
  }
  return {
    BatchLoadTaskDescription: {
      TaskId: task.TaskId,
      TaskStatus: task.TaskStatus,
      DatabaseName: task.DatabaseName,
      TableName: task.TableName,
    },
  };
};

const ListBatchLoadTasks: OperationHandler = (_input, ctx) => {
  const tasks = ctx.store
    .list<StoredBatchLoadTask>()
    .filter((e) => e.key.startsWith(batchPrefix))
    .map((e) => ({
      TaskId: e.value.TaskId,
      TaskStatus: e.value.TaskStatus,
      DatabaseName: e.value.DatabaseName,
      TableName: e.value.TableName,
    }));
  return { BatchLoadTasks: tasks };
};

const ResumeBatchLoadTask: OperationHandler = (input, ctx) => {
  const TaskId = requireString(input, "TaskId");
  const task = ctx.store.get<StoredBatchLoadTask>(`${batchPrefix}${TaskId}`);
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Batch load task ${TaskId} not found.`,
      400,
    );
  }
  ctx.store.set(`${batchPrefix}${TaskId}`, {
    ...task,
    TaskStatus: "IN_PROGRESS",
  });
  return {};
};

const WRITE_OPERATIONS = new Set([
  "Timestream_20181101.CreateBatchLoadTask",
  "Timestream_20181101.CreateDatabase",
  "Timestream_20181101.CreateTable",
  "Timestream_20181101.DeleteDatabase",
  "Timestream_20181101.DeleteTable",
  "Timestream_20181101.DescribeBatchLoadTask",
  "Timestream_20181101.DescribeDatabase",
  "Timestream_20181101.DescribeEndpoints",
  "Timestream_20181101.DescribeTable",
  "Timestream_20181101.ListBatchLoadTasks",
  "Timestream_20181101.ListDatabases",
  "Timestream_20181101.ListTables",
  "Timestream_20181101.ListTagsForResource",
  "Timestream_20181101.ResumeBatchLoadTask",
  "Timestream_20181101.TagResource",
  "Timestream_20181101.UntagResource",
  "Timestream_20181101.UpdateDatabase",
  "Timestream_20181101.UpdateTable",
  "Timestream_20181101.WriteRecords",
]);

const timestreamWrite: ServiceDefinition = {
  name: "timestream",
  protocol: "json",
  operations: {
    CreateBatchLoadTask,
    CreateDatabase,
    CreateTable,
    DeleteDatabase,
    DeleteTable,
    DescribeBatchLoadTask,
    DescribeDatabase,
    DescribeEndpoints,
    DescribeTable,
    ListBatchLoadTasks,
    ListDatabases,
    ListTables,
    ListTagsForResource,
    ResumeBatchLoadTask,
    TagResource,
    UntagResource,
    UpdateDatabase,
    UpdateTable,
    WriteRecords,
  },
  model,
  matches: (req: ParsedRequest): boolean =>
    req.target !== undefined && WRITE_OPERATIONS.has(req.target),
} as const;

export default timestreamWrite;
