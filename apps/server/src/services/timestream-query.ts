import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import timestreamQueryModel from "../../../../test/vendor/aws-models/timestream-query.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { recordPrefix, type StoredRecord } from "./timestream-write.ts";

const model = loadServiceModel(timestreamQueryModel);

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

  const pq = parseQuery(QueryString);
  if (MaxRows !== undefined && (pq.limit === undefined || MaxRows < pq.limit)) {
    pq.limit = MaxRows;
  }

  const { rows, columns } = executeParsedQuery(pq, ctx);

  const QueryId = crypto.randomUUID();

  const ColumnInfo = columns.map((col) => ({
    Name: col.name,
    Type: { ScalarType: col.type },
  }));

  const Rows = rows.map((rec) => ({
    Data: recordToRow(rec, columns),
  }));

  return {
    QueryId,
    Rows,
    ColumnInfo,
    QueryStatus: {
      ProgressPercentage: 100,
      CumulativeBytesScanned: rows.length * 100,
      CumulativeBytesMetered: rows.length * 100,
    },
  };
};

const PrepareQuery: OperationHandler = (input, _ctx) => {
  const QueryString = requireString(input, "QueryString");
  const pq = parseQuery(QueryString);
  return {
    QueryString,
    Columns: [
      {
        Name: "time",
        Type: { ScalarType: "TIMESTAMP" },
        Aliased: false,
      },
    ],
    Parameters: [],
    _pq: pq,
  };
};

const CancelQuery: OperationHandler = (_input, _ctx) => ({
  CancellationMessage: "Query successfully cancelled.",
});

const DescribeAccountSettings: OperationHandler = (_input, _ctx) => ({
  MaxQueryTCU: 1000,
  QueryPricingModel: "BYTES_SCANNED",
});

const UpdateAccountSettings: OperationHandler = (_input, _ctx) => ({
  MaxQueryTCU: 1000,
  QueryPricingModel: "BYTES_SCANNED",
});

const ListScheduledQueries: OperationHandler = (_input, _ctx) => ({
  ScheduledQueries: [],
});

const CreateScheduledQuery: OperationHandler = (_input, _ctx) => {
  throw awsError(
    "ValidationException",
    "CreateScheduledQuery is not supported in this emulator.",
    400,
  );
};

const DeleteScheduledQuery: OperationHandler = (_input, _ctx) => ({});

const DescribeScheduledQuery: OperationHandler = (_input, _ctx) => {
  throw awsError(
    "ResourceNotFoundException",
    "Scheduled query not found.",
    400,
  );
};

const ExecuteScheduledQuery: OperationHandler = (_input, _ctx) => {
  throw awsError(
    "ValidationException",
    "ExecuteScheduledQuery is not supported in this emulator.",
    400,
  );
};

const UpdateScheduledQuery: OperationHandler = (_input, _ctx) => ({});

const TagResource: OperationHandler = (_input, _ctx) => ({});
const UntagResource: OperationHandler = (_input, _ctx) => ({});
const ListTagsForResource: OperationHandler = (_input, _ctx) => ({
  Tags: [],
});

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
