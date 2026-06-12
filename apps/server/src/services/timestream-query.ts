import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import timestreamQueryModel from "../../models/timestream-query.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { recordPrefix, type StoredRecord } from "./timestream-write.ts";

const model = loadServiceModel(timestreamQueryModel);

const scheduledQueryPrefix = "scheduled-query:" as const;
const sqTokenPrefix = "sq-token:" as const;
const queryPagePrefix = "query-page:" as const;
const queryTokenPrefix = "query-token:" as const;
const tagPrefix = "tags:" as const;
const accountSettingsKey = "account-settings" as const;
const tableStorePrefix = "table:" as const;
const dbStorePrefix = "db:" as const;

type StoredScheduledQuery = {
  Arn: string;
  Name: string;
  QueryString: string;
  CreationTime: string;
  State: "ENABLED" | "DISABLED";
  ScheduleConfiguration: unknown;
  NotificationConfiguration: unknown;
  ScheduledQueryExecutionRoleArn: string;
  ErrorReportConfiguration: unknown;
  TargetConfiguration?: unknown;
  KmsKeyId?: string;
};

type QueryPageCursor = {
  QueryId: string;
  pq: ParsedQuery;
  offset: number;
};

type StoredAccountSettings = {
  MaxQueryTCU: number;
  QueryPricingModel: string;
};

const defaultAccountSettings: StoredAccountSettings = {
  MaxQueryTCU: 1000,
  QueryPricingModel: "BYTES_SCANNED",
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

const requireScheduledQuery = (
  ctx: ServiceContext,
  arn: string,
): StoredScheduledQuery => {
  const sq = ctx.store.get<StoredScheduledQuery>(
    `${scheduledQueryPrefix}${arn}`,
  );
  if (sq === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Scheduled query ${arn} not found.`,
      400,
      { ScheduledQueryArn: arn },
    );
  }
  return sq;
};

const DescribeEndpoints: OperationHandler = (_input, ctx) => ({
  Endpoints: [
    {
      Address: `cell1.timestream.${ctx.region}.amazonaws.com`,
      CachePeriodInMinutes: 10080,
    },
  ],
});

type ParsedQuery = {
  dbName: string;
  tableName: string;
  whereColumn?: string;
  whereOp?: string;
  whereValue?: string;
  limit?: number;
};

const SELECT_RE =
  /^\s*SELECT\s+\*\s+FROM\s+"([^"]+)"\."([^"]+)"(?:\s+WHERE\s+(\w+)\s*(=|!=|<>|<|>|<=|>=)\s*'([^']*)')?(?:\s+LIMIT\s+(\d+))?\s*$/i;

const parseQuery = (sql: string): ParsedQuery => {
  const m = SELECT_RE.exec(sql);
  if (m === null) {
    throw awsError(
      "ValidationException",
      'Only SELECT * FROM "db"."table" [WHERE col op \'val\'] [LIMIT n] is supported. ' +
        "Unsupported SQL syntax.",
      400,
    );
  }
  return {
    dbName: m[1] as string,
    tableName: m[2] as string,
    whereColumn: m[3],
    whereOp: m[4],
    whereValue: m[5],
    limit: m[6] !== undefined ? parseInt(m[6], 10) : undefined,
  };
};

const compareValues = (a: string, op: string, b: string): boolean => {
  switch (op) {
    case "=":
      return a === b;
    case "!=":
    case "<>":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case ">=":
      return a >= b;
    default:
      return false;
  }
};

const recordMatchesWhere = (
  rec: StoredRecord,
  col: string,
  op: string,
  val: string,
): boolean => {
  if (col === "measure_name") {
    return compareValues(rec.MeasureName ?? "", op, val);
  }
  if (col === "measure_value") {
    return compareValues(rec.MeasureValue ?? "", op, val);
  }
  const dim = rec.Dimensions.find((d) => d.Name === col);
  if (dim !== undefined) {
    return compareValues(dim.Value, op, val);
  }
  return false;
};

type ColumnDef = { name: string; type: string };

const buildColumns = (records: StoredRecord[]): ColumnDef[] => {
  const dimNames = new Set<string>();
  let hasMeasureName = false;
  let hasMeasureValue = false;
  let hasMeasureValues = false;

  for (const rec of records) {
    for (const d of rec.Dimensions) dimNames.add(d.Name);
    if (rec.MeasureName !== undefined) hasMeasureName = true;
    if (rec.MeasureValue !== undefined) hasMeasureValue = true;
    if (rec.MeasureValues !== undefined && rec.MeasureValues.length > 0)
      hasMeasureValues = true;
  }

  const cols: ColumnDef[] = [{ name: "time", type: "TIMESTAMP" }];
  for (const name of dimNames) cols.push({ name, type: "VARCHAR" });
  if (hasMeasureName) cols.push({ name: "measure_name", type: "VARCHAR" });
  if (hasMeasureValue) cols.push({ name: "measure_value", type: "DOUBLE" });
  if (hasMeasureValues) cols.push({ name: "measure_values", type: "VARCHAR" });
  return cols;
};

const recordToRow = (
  rec: StoredRecord,
  cols: ColumnDef[],
): Array<{ ScalarValue?: string }> =>
  cols.map((col) => {
    if (col.name === "time") {
      return { ScalarValue: rec.Time };
    }
    if (col.name === "measure_name") {
      return { ScalarValue: rec.MeasureName ?? "" };
    }
    if (col.name === "measure_value") {
      return { ScalarValue: rec.MeasureValue ?? "" };
    }
    if (col.name === "measure_values") {
      return {
        ScalarValue: rec.MeasureValues ? JSON.stringify(rec.MeasureValues) : "",
      };
    }
    const dim = rec.Dimensions.find((d) => d.Name === col.name);
    return { ScalarValue: dim?.Value ?? "" };
  });

const executeParsedQuery = (
  pq: ParsedQuery,
  ctx: ServiceContext,
): { rows: StoredRecord[]; columns: ColumnDef[] } => {
  const tableKey = `${recordPrefix}${pq.dbName}/${pq.tableName}:`;
  let records = ctx.store
    .list<StoredRecord>()
    .filter((e) => e.key.startsWith(tableKey))
    .map((e) => e.value);

  if (
    pq.whereColumn !== undefined &&
    pq.whereOp !== undefined &&
    pq.whereValue !== undefined
  ) {
    records = records.filter((r) =>
      recordMatchesWhere(r, pq.whereColumn!, pq.whereOp!, pq.whereValue!),
    );
  }

  if (pq.limit !== undefined) {
    records = records.slice(0, pq.limit);
  }

  const columns = buildColumns(records);
  return { rows: records, columns };
};

const Query: OperationHandler = (input, ctx) => {
  const QueryString = requireString(input, "QueryString");
  const MaxRows =
    typeof input["MaxRows"] === "number"
      ? (input["MaxRows"] as number)
      : undefined;
  const ClientToken =
    typeof input["ClientToken"] === "string"
      ? (input["ClientToken"] as string)
      : undefined;
  const NextToken =
    typeof input["NextToken"] === "string"
      ? (input["NextToken"] as string)
      : undefined;

  if (ClientToken !== undefined && NextToken === undefined) {
    const cacheKey = `${queryTokenPrefix}${ClientToken}:${QueryString}`;
    const cached = ctx.store.get<Record<string, unknown>>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }

  let pq: ParsedQuery;
  let QueryId: string;
  let pageOffset = 0;

  if (NextToken !== undefined) {
    const cursor = ctx.store.get<QueryPageCursor>(
      `${queryPagePrefix}${NextToken}`,
    );
    if (cursor === undefined) {
      throw awsError("ValidationException", "Invalid pagination token.", 400);
    }
    pq = cursor.pq;
    QueryId = cursor.QueryId;
    pageOffset = cursor.offset;
  } else {
    pq = parseQuery(QueryString);
    QueryId = crypto.randomUUID();

    if (
      ctx.store.get(`${tableStorePrefix}${pq.dbName}/${pq.tableName}`) ===
      undefined
    ) {
      throw awsError(
        "ValidationException",
        `Table ${pq.tableName} does not exist in database ${pq.dbName}.`,
        400,
      );
    }
  }

  const { rows: allRows, columns } = executeParsedQuery(pq, ctx);

  const pageRows =
    MaxRows !== undefined
      ? allRows.slice(pageOffset, pageOffset + MaxRows)
      : allRows.slice(pageOffset);

  let returnNextToken: string | undefined;
  if (MaxRows !== undefined && pageOffset + MaxRows < allRows.length) {
    returnNextToken = crypto.randomUUID();
    const cursor: QueryPageCursor = {
      QueryId,
      pq,
      offset: pageOffset + MaxRows,
    };
    ctx.store.set(`${queryPagePrefix}${returnNextToken}`, cursor);
  }

  const ColumnInfo = columns.map((col) => ({
    Name: col.name,
    Type: { ScalarType: col.type },
  }));

  const Rows = pageRows.map((rec) => ({
    Data: recordToRow(rec, columns),
  }));

  const result: Record<string, unknown> = {
    QueryId,
    Rows,
    ColumnInfo,
    QueryStatus: {
      ProgressPercentage: 100,
      CumulativeBytesScanned: allRows.length * 100,
      CumulativeBytesMetered: allRows.length * 100,
    },
  };
  if (returnNextToken !== undefined) {
    result["NextToken"] = returnNextToken;
  }

  if (ClientToken !== undefined && NextToken === undefined) {
    const cacheKey = `${queryTokenPrefix}${ClientToken}:${QueryString}`;
    ctx.store.set(cacheKey, result);
  }

  return result;
};

const PrepareQuery: OperationHandler = (input, ctx) => {
  const QueryString = requireString(input, "QueryString");
  const pq = parseQuery(QueryString);

  let columns: ColumnDef[];
  try {
    const result = executeParsedQuery(pq, ctx);
    columns =
      result.columns.length > 0
        ? result.columns
        : [{ name: "time", type: "TIMESTAMP" }];
  } catch {
    columns = [{ name: "time", type: "TIMESTAMP" }];
  }

  return {
    QueryString,
    Columns: columns.map((col) => ({
      Name: col.name,
      Type: { ScalarType: col.type },
      Aliased: false,
    })),
    Parameters: [],
  };
};

const CancelQuery: OperationHandler = (input, _ctx) => {
  requireString(input, "QueryId");
  return {
    CancellationMessage: "Query successfully cancelled.",
  };
};

const DescribeAccountSettings: OperationHandler = (_input, ctx) => {
  return (
    ctx.store.get<StoredAccountSettings>(accountSettingsKey) ??
    defaultAccountSettings
  );
};

const UpdateAccountSettings: OperationHandler = (input, ctx) => {
  const current = {
    ...(ctx.store.get<StoredAccountSettings>(accountSettingsKey) ??
      defaultAccountSettings),
  };

  if (input["QueryPricingModel"] !== undefined) {
    if (input["QueryPricingModel"] !== "COMPUTE_UNITS") {
      throw awsError(
        "ValidationException",
        "QueryPricingModel must be COMPUTE_UNITS.",
        400,
      );
    }
    current.QueryPricingModel = "COMPUTE_UNITS";
  }
  if (typeof input["MaxQueryTCU"] === "number") {
    current.MaxQueryTCU = input["MaxQueryTCU"] as number;
  }

  ctx.store.set(accountSettingsKey, current);
  return current;
};

const ListScheduledQueries: OperationHandler = (input, ctx) => {
  const MaxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const inputNextToken =
    typeof input["NextToken"] === "string"
      ? (input["NextToken"] as string)
      : undefined;

  const all = ctx.store
    .list<StoredScheduledQuery>()
    .filter((e) => e.key.startsWith(scheduledQueryPrefix))
    .map((e) => e.value);

  let offset = 0;
  if (inputNextToken !== undefined) {
    const cursor = ctx.store.get<number>(`sq-list-cursor:${inputNextToken}`);
    if (cursor !== undefined) {
      offset = cursor;
    }
  }

  const page =
    MaxResults !== undefined
      ? all.slice(offset, offset + MaxResults)
      : all.slice(offset);

  let returnNextToken: string | undefined;
  if (MaxResults !== undefined && offset + MaxResults < all.length) {
    returnNextToken = crypto.randomUUID();
    ctx.store.set(`sq-list-cursor:${returnNextToken}`, offset + MaxResults);
  }

  const result: Record<string, unknown> = {
    ScheduledQueries: page.map((sq) => ({
      Arn: sq.Arn,
      Name: sq.Name,
      CreationTime: sq.CreationTime,
      State: sq.State,
    })),
  };
  if (returnNextToken !== undefined) {
    result["NextToken"] = returnNextToken;
  }
  return result;
};

const CreateScheduledQuery: OperationHandler = (input, ctx) => {
  const Name = requireString(input, "Name");
  const QueryString = requireString(input, "QueryString");
  const ScheduledQueryExecutionRoleArn = requireString(
    input,
    "ScheduledQueryExecutionRoleArn",
  );

  if (input["ScheduleConfiguration"] === undefined) {
    throw awsError(
      "ValidationException",
      "ScheduleConfiguration is required.",
      400,
    );
  }
  if (input["NotificationConfiguration"] === undefined) {
    throw awsError(
      "ValidationException",
      "NotificationConfiguration is required.",
      400,
    );
  }
  if (input["ErrorReportConfiguration"] === undefined) {
    throw awsError(
      "ValidationException",
      "ErrorReportConfiguration is required.",
      400,
    );
  }

  const ClientToken =
    typeof input["ClientToken"] === "string"
      ? (input["ClientToken"] as string)
      : undefined;

  if (ClientToken !== undefined) {
    const cached = ctx.store.get<string>(`${sqTokenPrefix}${ClientToken}`);
    if (cached !== undefined) {
      return { Arn: cached };
    }
  }

  const existingByName = ctx.store
    .list<StoredScheduledQuery>()
    .filter((e) => e.key.startsWith(scheduledQueryPrefix))
    .find((e) => e.value.Name === Name);
  if (existingByName !== undefined) {
    throw awsError(
      "ConflictException",
      `Scheduled query with name ${Name} already exists.`,
      409,
    );
  }

  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const Arn = `arn:aws:timestream:${ctx.region}:${ctx.account}:scheduled-query/${Name}-${suffix}`;
  const now = new Date().toISOString();

  const sq: StoredScheduledQuery = {
    Arn,
    Name,
    QueryString,
    CreationTime: now,
    State: "ENABLED",
    ScheduleConfiguration: input["ScheduleConfiguration"],
    NotificationConfiguration: input["NotificationConfiguration"],
    ScheduledQueryExecutionRoleArn,
    ErrorReportConfiguration: input["ErrorReportConfiguration"],
  };
  if (input["TargetConfiguration"] !== undefined) {
    sq.TargetConfiguration = input["TargetConfiguration"];
  }
  if (typeof input["KmsKeyId"] === "string") {
    sq.KmsKeyId = input["KmsKeyId"] as string;
  }

  ctx.store.set(`${scheduledQueryPrefix}${Arn}`, sq);

  if (Array.isArray(input["Tags"])) {
    const tagMap: Record<string, string> = {};
    for (const t of input["Tags"] as Array<{ Key: string; Value: string }>) {
      tagMap[t.Key] = t.Value;
    }
    ctx.store.set(`${tagPrefix}${Arn}`, tagMap);
  }

  if (ClientToken !== undefined) {
    ctx.store.set(`${sqTokenPrefix}${ClientToken}`, Arn);
  }

  return { Arn };
};

const DeleteScheduledQuery: OperationHandler = (input, ctx) => {
  const ScheduledQueryArn = requireString(input, "ScheduledQueryArn");
  requireScheduledQuery(ctx, ScheduledQueryArn);
  ctx.store.delete(`${scheduledQueryPrefix}${ScheduledQueryArn}`);
  ctx.store.delete(`${tagPrefix}${ScheduledQueryArn}`);
  return {};
};

const DescribeScheduledQuery: OperationHandler = (input, ctx) => {
  const ScheduledQueryArn = requireString(input, "ScheduledQueryArn");
  const sq = requireScheduledQuery(ctx, ScheduledQueryArn);
  const description: Record<string, unknown> = {
    Arn: sq.Arn,
    Name: sq.Name,
    QueryString: sq.QueryString,
    CreationTime: sq.CreationTime,
    State: sq.State,
    ScheduleConfiguration: sq.ScheduleConfiguration,
    NotificationConfiguration: sq.NotificationConfiguration,
    ScheduledQueryExecutionRoleArn: sq.ScheduledQueryExecutionRoleArn,
    ErrorReportConfiguration: sq.ErrorReportConfiguration,
  };
  if (sq.TargetConfiguration !== undefined) {
    description["TargetConfiguration"] = sq.TargetConfiguration;
  }
  if (sq.KmsKeyId !== undefined) {
    description["KmsKeyId"] = sq.KmsKeyId;
  }
  return { ScheduledQuery: description };
};

const ExecuteScheduledQuery: OperationHandler = (input, ctx) => {
  const ScheduledQueryArn = requireString(input, "ScheduledQueryArn");
  requireScheduledQuery(ctx, ScheduledQueryArn);
  return {};
};

const UpdateScheduledQuery: OperationHandler = (input, ctx) => {
  const ScheduledQueryArn = requireString(input, "ScheduledQueryArn");
  const State = requireString(input, "State");
  const sq = requireScheduledQuery(ctx, ScheduledQueryArn);
  sq.State = State as "ENABLED" | "DISABLED";
  ctx.store.set(`${scheduledQueryPrefix}${ScheduledQueryArn}`, sq);
  return {};
};

const validateTagArn = (ctx: ServiceContext, arn: string): void => {
  if (/^arn:aws:timestream:[^:]+:[^:]+:scheduled-query\//.test(arn)) {
    requireScheduledQuery(ctx, arn);
    return;
  }
  const tableMatch = arn.match(
    /^arn:aws:timestream:[^:]+:[^:]+:database:([^:]+):table\/(.+)$/,
  );
  if (tableMatch) {
    if (ctx.store.get(`${dbStorePrefix}${tableMatch[1]}`) === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Database ${tableMatch[1]} not found.`,
        404,
      );
    }
    if (
      ctx.store.get(`${tableStorePrefix}${tableMatch[1]}/${tableMatch[2]}`) ===
      undefined
    ) {
      throw awsError(
        "ResourceNotFoundException",
        `Table ${tableMatch[2]} not found.`,
        404,
      );
    }
    return;
  }
  const dbMatch = arn.match(
    /^arn:aws:timestream:[^:]+:[^:]+:database\/([^:/]+)$/,
  );
  if (dbMatch) {
    if (ctx.store.get(`${dbStorePrefix}${dbMatch[1]}`) === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `Database ${dbMatch[1]} not found.`,
        404,
      );
    }
    return;
  }
  throw awsError("ValidationException", `Invalid ARN: ${arn}`, 400);
};

const TagResource: OperationHandler = (input, ctx) => {
  const ResourceARN = requireString(input, "ResourceARN");
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  validateTagArn(ctx, ResourceARN);
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
  validateTagArn(ctx, ResourceARN);
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
  validateTagArn(ctx, ResourceARN);
  const existing =
    ctx.store.get<Record<string, string>>(`${tagPrefix}${ResourceARN}`) ?? {};
  const Tags = Object.entries(existing).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { Tags };
};

const QUERY_OPERATIONS = new Set([
  "Timestream_20181101.CancelQuery",
  "Timestream_20181101.CreateScheduledQuery",
  "Timestream_20181101.DeleteScheduledQuery",
  "Timestream_20181101.DescribeAccountSettings",
  "Timestream_20181101.DescribeScheduledQuery",
  "Timestream_20181101.ExecuteScheduledQuery",
  "Timestream_20181101.ListScheduledQueries",
  "Timestream_20181101.ListTagsForResource",
  "Timestream_20181101.PrepareQuery",
  "Timestream_20181101.Query",
  "Timestream_20181101.TagResource",
  "Timestream_20181101.UntagResource",
  "Timestream_20181101.UpdateAccountSettings",
  "Timestream_20181101.UpdateScheduledQuery",
]);

const timestreamQuery: ServiceDefinition = {
  name: "timestream",
  protocol: "json",
  operations: {
    CancelQuery,
    CreateScheduledQuery,
    DeleteScheduledQuery,
    DescribeAccountSettings,
    DescribeEndpoints,
    DescribeScheduledQuery,
    ExecuteScheduledQuery,
    ListScheduledQueries,
    ListTagsForResource,
    PrepareQuery,
    Query,
    TagResource,
    UntagResource,
    UpdateAccountSettings,
    UpdateScheduledQuery,
  },
  model,
  matches: (req: ParsedRequest): boolean =>
    req.target !== undefined && QUERY_OPERATIONS.has(req.target),
} as const;

export default timestreamQuery;
