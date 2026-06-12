import { compareAV, equalsAV } from "../core/expressions/attribute.ts";
import { evaluateCondition } from "../core/expressions/evaluator-condition.ts";
import { resolveKeyCondition } from "../core/expressions/evaluator-key-condition.ts";
import { projectItem } from "../core/expressions/evaluator-projection.ts";
import { applyUpdate } from "../core/expressions/evaluator-update.ts";
import { parseConditionExpression } from "../core/expressions/parser-condition.ts";
import { parseKeyConditionExpression } from "../core/expressions/parser-key-condition.ts";
import { parseProjectionExpression } from "../core/expressions/parser-projection.ts";
import { parseUpdateExpression } from "../core/expressions/parser-update.ts";
import type {
  AttributePath,
  KeyConditionResult,
  ProjectionAST,
  UpdateAST,
} from "../core/expressions/types.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import dynamodbModel from "../../../../test/vendor/aws-models/dynamodb.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(dynamodbModel);

type AttributeValue = Record<string, unknown>;

type Item = Record<string, AttributeValue>;

type KeySchemaElement = {
  AttributeName: string;
  KeyType: string;
};

type AttributeDefinition = {
  AttributeName: string;
  AttributeType: string;
};

type StoredTag = {
  Key: string;
  Value: string;
};

type StoredTtl = {
  Enabled: boolean;
  AttributeName: string;
};

type StoredProvisionedThroughput = {
  ReadCapacityUnits: number;
  WriteCapacityUnits: number;
};

type SecondaryIndex = {
  IndexName: string;
  KeySchema: KeySchemaElement[];
  Projection: Record<string, unknown>;
  provisionedThroughput?: StoredProvisionedThroughput;
};

type StoredTable = {
  TableName: string;
  AttributeDefinitions: AttributeDefinition[];
  KeySchema: KeySchemaElement[];
  CreationDateTime: number;
  items: Record<string, Item>;
  status?: string;
  tags?: StoredTag[];
  ttl?: StoredTtl;
  pointInTimeRecovery?: boolean;
  globalSecondaryIndexes?: SecondaryIndex[];
  localSecondaryIndexes?: SecondaryIndex[];
  streamSpecification?: { StreamEnabled: boolean; StreamViewType: string };
  latestStreamArn?: string;
  latestStreamLabel?: string;
  provisionedThroughput?: StoredProvisionedThroughput;
  billingMode?: string;
};

type StoredBackup = {
  kind: "backup";
  BackupArn: string;
  BackupName: string;
  BackupStatus: string;
  BackupType: string;
  BackupCreationDateTime: number;
  BackupSizeBytes: number;
  TableName: string;
  TableId: string;
  TableArn: string;
  TableSizeBytes: number;
  KeySchema: KeySchemaElement[];
  TableCreationDateTime: number;
  ItemCount: number;
};

type StoredGlobalTable = {
  kind: "global-table";
  GlobalTableName: string;
  ReplicationGroup: { RegionName: string }[];
  CreationDateTime: number;
  GlobalTableStatus: string;
};

type StoredExport = {
  kind: "export";
  ExportArn: string;
  ExportStatus: string;
  StartTime: number;
  EndTime: number;
  TableArn: string;
  TableId: string;
  S3Bucket: string;
  S3Prefix: string;
  ExportFormat: string;
  ExportType: string;
  BilledSizeBytes: number;
  ItemCount: number;
};

type StoredImport = {
  kind: "import";
  ImportArn: string;
  ImportStatus: string;
  TableArn: string;
  TableId: string;
  TableName: string;
  S3BucketSource: Record<string, unknown>;
  InputFormat: string;
  StartTime: number;
  EndTime: number;
  ProcessedItemCount: number;
  ImportedItemCount: number;
};

type KinesisDestinationEntry = {
  StreamArn: string;
  DestinationStatus: string;
  ApproximateCreationDateTimePrecision?: string;
};

type StoredKinesisDestinations = {
  kind: "kinesis";
  TableName: string;
  destinations: KinesisDestinationEntry[];
};

type StoredContributorInsights = {
  kind: "contributor-insights";
  TableName: string;
  IndexName?: string;
  ContributorInsightsStatus: string;
  ContributorInsightsMode: string;
};

type StoredResourcePolicy = {
  kind: "resource-policy";
  ResourceArn: string;
  Policy: string;
  RevisionId: string;
};

type StoredStreamRecord = {
  eventID: string;
  eventVersion: string;
  eventSource: string;
  awsRegion: string;
  eventName: "INSERT" | "MODIFY" | "REMOVE";
  dynamodb: {
    ApproximateCreationDateTime: number;
    Keys: Item;
    NewImage?: Item;
    OldImage?: Item;
    SequenceNumber: string;
    SizeBytes: number;
    StreamViewType: string;
  };
};

type StoredStream = {
  kind: "stream";
  streamArn: string;
  tableName: string;
  shardId: string;
  records: StoredStreamRecord[];
  sequenceNumber: number;
};

type StoredTransactToken = {
  kind: "transact-token";
};

const tableArn = (region: string, account: string, name: string): string =>
  `arn:aws:dynamodb:${region}:${account}:table/${name}`;

const streamArnFor = (
  region: string,
  account: string,
  name: string,
  label: string,
): string =>
  `arn:aws:dynamodb:${region}:${account}:table/${name}/stream/${label}`;

const streamKey = (arn: string): string => `stream:${arn}`;

const shardIdFor = (label: string): string =>
  `shardId-00000001234567890123-${label.replace(/[^0-9a-z]/gi, "").slice(0, 8)}`;

const encodeIterator = (arn: string, shard: string, position: number): string =>
  btoa(JSON.stringify({ arn, shard, position }));

const decodeIterator = (
  iterator: string,
): { arn: string; shard: string; position: number } => {
  try {
    return JSON.parse(atob(iterator)) as {
      arn: string;
      shard: string;
      position: number;
    };
  } catch {
    throw awsError("InvalidParameterException", "Invalid ShardIterator", 400);
  }
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const tableNameFromArn = (value: string): string => {
  const marker = ":table/";
  const index = value.indexOf(marker);
  return index < 0 ? value : value.slice(index + marker.length);
};

const backupKey = (backupArn: string): string => `backup:${backupArn}`;

const transactTokenKey = (token: string): string => `transact-token:${token}`;

const isBackupEntry = (value: unknown): value is StoredBackup =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>)["kind"] === "backup";

const hasKind = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>)["kind"] === "string";

const listTables = (ctx: ServiceContext): StoredTable[] =>
  ctx.store
    .list<StoredTable>()
    .filter((entry) => !hasKind(entry.value))
    .map((entry) => entry.value);

const listBackups = (ctx: ServiceContext): StoredBackup[] =>
  ctx.store
    .list<StoredBackup>()
    .map((entry) => entry.value)
    .filter((value): value is StoredBackup => isBackupEntry(value));

const requireTable = (ctx: ServiceContext, name: string): StoredTable => {
  const table = ctx.store.get<StoredTable>(name);
  if (table === undefined || isBackupEntry(table)) {
    throw awsError(
      "ResourceNotFoundException",
      `Requested resource not found: Table: ${name} not found`,
      400,
    );
  }
  return table;
};

const scalarOf = (value: AttributeValue): string => {
  for (const tag of ["S", "N", "B", "BOOL", "NULL"] as const) {
    const inner = value[tag];
    if (inner !== undefined) return `${tag}:${String(inner)}`;
  }
  return JSON.stringify(value);
};

const keyOf = (table: StoredTable, item: Item): string =>
  table.KeySchema.map((element) => {
    const attribute = item[element.AttributeName];
    if (attribute === undefined) {
      throw awsError(
        "ValidationException",
        `Missing the key ${element.AttributeName} in the item`,
        400,
      );
    }
    return `${element.AttributeName}=${scalarOf(attribute)}`;
  }).join("&");

const keyFromKeyInput = (table: StoredTable, key: Item): string =>
  table.KeySchema.map((element) => {
    const attribute = key[element.AttributeName];
    if (attribute === undefined) {
      throw awsError(
        "ValidationException",
        `The provided key element does not match the schema`,
        400,
      );
    }
    return `${element.AttributeName}=${scalarOf(attribute)}`;
  }).join("&");

const indexArn = (
  region: string,
  account: string,
  table: string,
  index: string,
): string =>
  `arn:aws:dynamodb:${region}:${account}:table/${table}/index/${index}`;

const gsiDescription = (
  ctx: ServiceContext,
  table: StoredTable,
  index: SecondaryIndex,
): Record<string, unknown> => ({
  IndexName: index.IndexName,
  KeySchema: index.KeySchema,
  Projection: index.Projection,
  IndexStatus: "ACTIVE",
  IndexSizeBytes: 0,
  ItemCount: Object.keys(table.items).length,
  IndexArn: indexArn(ctx.region, ctx.account, table.TableName, index.IndexName),
  ProvisionedThroughput: {
    ReadCapacityUnits: index.provisionedThroughput?.ReadCapacityUnits ?? 0,
    WriteCapacityUnits: index.provisionedThroughput?.WriteCapacityUnits ?? 0,
    NumberOfDecreasesToday: 0,
  },
});

const lsiDescription = (
  ctx: ServiceContext,
  table: StoredTable,
  index: SecondaryIndex,
): Record<string, unknown> => ({
  IndexName: index.IndexName,
  KeySchema: index.KeySchema,
  Projection: index.Projection,
  IndexSizeBytes: 0,
  ItemCount: Object.keys(table.items).length,
  IndexArn: indexArn(ctx.region, ctx.account, table.TableName, index.IndexName),
});

const tableDescription = (
  ctx: ServiceContext,
  table: StoredTable,
  status: string,
): Record<string, unknown> => {
  const isPPR = table.billingMode === "PAY_PER_REQUEST";
  const description: Record<string, unknown> = {
    TableName: table.TableName,
    AttributeDefinitions: table.AttributeDefinitions,
    KeySchema: table.KeySchema,
    TableStatus: status,
    CreationDateTime: table.CreationDateTime,
    ItemCount: Object.keys(table.items).length,
    TableSizeBytes: 0,
    TableArn: tableArn(ctx.region, ctx.account, table.TableName),
    ProvisionedThroughput: {
      ReadCapacityUnits: isPPR
        ? 0
        : (table.provisionedThroughput?.ReadCapacityUnits ?? 0),
      WriteCapacityUnits: isPPR
        ? 0
        : (table.provisionedThroughput?.WriteCapacityUnits ?? 0),
      NumberOfDecreasesToday: 0,
    },
  };
  if (isPPR) {
    description["BillingModeSummary"] = {
      BillingMode: "PAY_PER_REQUEST",
    };
  }
  if (table.globalSecondaryIndexes !== undefined) {
    description["GlobalSecondaryIndexes"] = table.globalSecondaryIndexes.map(
      (index) => gsiDescription(ctx, table, index),
    );
  }
  if (table.localSecondaryIndexes !== undefined) {
    description["LocalSecondaryIndexes"] = table.localSecondaryIndexes.map(
      (index) => lsiDescription(ctx, table, index),
    );
  }
  if (table.streamSpecification !== undefined) {
    description["StreamSpecification"] = table.streamSpecification;
  }
  if (table.latestStreamArn !== undefined) {
    description["LatestStreamArn"] = table.latestStreamArn;
    description["LatestStreamLabel"] = table.latestStreamLabel;
  }
  return description;
};

const asItem = (value: unknown): Item =>
  typeof value === "object" && value !== null ? (value as Item) : ({} as Item);

const buildProjection = (
  input: Record<string, unknown>,
): ProjectionAST | undefined => {
  const expression = input["ProjectionExpression"];
  if (typeof expression !== "string" || expression === "") return undefined;
  const names = asRecord(input["ExpressionAttributeNames"]) as Record<
    string,
    string
  >;
  return parseProjectionExpression(expression, { names });
};

const applyProjection = (ast: ProjectionAST | undefined, item: Item): Item =>
  ast === undefined ? item : projectItem(ast, item);

const collectUpdatePaths = (ast: UpdateAST): AttributePath[] => {
  const out: AttributePath[] = [];
  for (const section of ast.sections) {
    for (const action of section.actions) {
      out.push(action.target);
    }
  }
  return out;
};

const updateReturnAttributes = (
  returnValues: unknown,
  previous: Item | undefined,
  updated: Item,
  updatedPaths: AttributePath[],
): { Attributes?: Item } => {
  if (
    typeof returnValues !== "string" ||
    returnValues === "" ||
    returnValues === "NONE"
  ) {
    return {};
  }
  if (returnValues === "ALL_NEW") {
    return { Attributes: updated };
  }
  if (returnValues === "ALL_OLD") {
    return previous === undefined ? {} : { Attributes: previous };
  }
  if (returnValues === "UPDATED_NEW") {
    const projected = projectItem({ paths: updatedPaths }, updated);
    return Object.keys(projected).length === 0 ? {} : { Attributes: projected };
  }
  if (returnValues === "UPDATED_OLD") {
    if (previous === undefined) return {};
    const projected = projectItem({ paths: updatedPaths }, previous);
    return Object.keys(projected).length === 0 ? {} : { Attributes: projected };
  }
  return {};
};

const ensurePutDeleteReturnValues = (input: Record<string, unknown>): void => {
  const returnValues = input["ReturnValues"];
  if (
    returnValues !== undefined &&
    returnValues !== "NONE" &&
    returnValues !== "ALL_OLD"
  ) {
    throw awsError(
      "ValidationException",
      "ReturnValues can only be ALL_OLD or NONE",
      400,
    );
  }
};

const conditionFailure = (
  input: Record<string, unknown>,
  current: Item | undefined,
): never => {
  const data =
    input["ReturnValuesOnConditionCheckFailure"] === "ALL_OLD" &&
    current !== undefined
      ? { Item: current }
      : undefined;
  throw awsError(
    "ConditionalCheckFailedException",
    "The conditional request failed",
    400,
    data,
  );
};

const compareExpected = (
  actual: AttributeValue,
  operator: string,
  list: AttributeValue[],
): boolean => {
  const target = list[0];
  if (operator === "EQ")
    return target !== undefined && equalsAV(actual, target);
  if (operator === "NE")
    return target !== undefined && !equalsAV(actual, target);
  if (operator === "BETWEEN") {
    const lo = list[0];
    const hi = list[1];
    if (lo === undefined || hi === undefined) return false;
    const cmpLo = compareAV(actual, lo);
    const cmpHi = compareAV(actual, hi);
    return (
      cmpLo !== undefined && cmpHi !== undefined && cmpLo >= 0 && cmpHi <= 0
    );
  }
  if (target === undefined) return false;
  const cmp = compareAV(actual, target);
  if (cmp === undefined) return false;
  if (operator === "LE") return cmp <= 0;
  if (operator === "LT") return cmp < 0;
  if (operator === "GE") return cmp >= 0;
  if (operator === "GT") return cmp > 0;
  return false;
};

const evaluateExpectedEntry = (
  entry: Record<string, unknown>,
  actual: AttributeValue | undefined,
): boolean => {
  const exists = entry["Exists"];
  if (exists === false) return actual === undefined;
  const value = entry["Value"];
  const list = Array.isArray(entry["AttributeValueList"])
    ? (entry["AttributeValueList"] as AttributeValue[])
    : value !== undefined
      ? [value as AttributeValue]
      : [];
  if (list.length === 0) return actual !== undefined;
  if (actual === undefined) return false;
  const operator =
    typeof entry["ComparisonOperator"] === "string"
      ? entry["ComparisonOperator"]
      : "EQ";
  return compareExpected(actual, operator, list);
};

const evaluateExpected = (
  expected: Record<string, Record<string, unknown>>,
  current: Item | undefined,
  conditionalOperator: unknown,
): boolean => {
  const item = current ?? {};
  const orMode = conditionalOperator === "OR";
  let result = !orMode;
  for (const [attribute, entry] of Object.entries(expected)) {
    const passed = evaluateExpectedEntry(entry, item[attribute]);
    result = orMode ? result || passed : result && passed;
  }
  return result;
};

const ensureConditionPasses = (
  input: Record<string, unknown>,
  current: Item | undefined,
): void => {
  const expression = input["ConditionExpression"];
  if (typeof expression === "string" && expression !== "") {
    const values = (
      typeof input["ExpressionAttributeValues"] === "object" &&
      input["ExpressionAttributeValues"] !== null
        ? (input["ExpressionAttributeValues"] as Record<string, AttributeValue>)
        : {}
    ) as Record<string, AttributeValue>;
    const names = (
      typeof input["ExpressionAttributeNames"] === "object" &&
      input["ExpressionAttributeNames"] !== null
        ? (input["ExpressionAttributeNames"] as Record<string, string>)
        : {}
    ) as Record<string, string>;
    const ast = parseConditionExpression(expression, { names, values });
    if (!evaluateCondition(ast, current ?? {})) {
      conditionFailure(input, current);
    }
    return;
  }
  const expected = input["Expected"];
  if (typeof expected === "object" && expected !== null) {
    const passed = evaluateExpected(
      expected as Record<string, Record<string, unknown>>,
      current,
      input["ConditionalOperator"],
    );
    if (!passed) {
      conditionFailure(input, current);
    }
  }
};

const parseSecondaryIndexes = (value: unknown): SecondaryIndex[] =>
  (Array.isArray(value) ? (value as Record<string, unknown>[]) : []).map(
    (entry) => {
      const index: SecondaryIndex = {
        IndexName:
          typeof entry["IndexName"] === "string" ? entry["IndexName"] : "",
        KeySchema: Array.isArray(entry["KeySchema"])
          ? (entry["KeySchema"] as KeySchemaElement[])
          : [],
        Projection:
          typeof entry["Projection"] === "object" &&
          entry["Projection"] !== null
            ? (entry["Projection"] as Record<string, unknown>)
            : { ProjectionType: "ALL" },
      };
      const pt = entry["ProvisionedThroughput"];
      if (typeof pt === "object" && pt !== null) {
        const raw = pt as Record<string, unknown>;
        index.provisionedThroughput = {
          ReadCapacityUnits:
            typeof raw["ReadCapacityUnits"] === "number"
              ? raw["ReadCapacityUnits"]
              : 0,
          WriteCapacityUnits:
            typeof raw["WriteCapacityUnits"] === "number"
              ? raw["WriteCapacityUnits"]
              : 0,
        };
      }
      return index;
    },
  );

const CreateTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  if (ctx.store.get<StoredTable>(name) !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Table already exists: ${name}`,
      400,
    );
  }
  const attributeDefinitions = Array.isArray(input["AttributeDefinitions"])
    ? (input["AttributeDefinitions"] as AttributeDefinition[])
    : [];
  const keySchema = Array.isArray(input["KeySchema"])
    ? (input["KeySchema"] as KeySchemaElement[])
    : [];
  const table: StoredTable = {
    TableName: name,
    AttributeDefinitions: attributeDefinitions,
    KeySchema: keySchema,
    CreationDateTime: Math.floor(Date.now() / 1000),
    items: {},
  };
  const billingMode =
    typeof input["BillingMode"] === "string" ? input["BillingMode"] : undefined;
  if (billingMode !== undefined) table.billingMode = billingMode;
  if (billingMode !== "PAY_PER_REQUEST") {
    const pt = input["ProvisionedThroughput"];
    if (typeof pt === "object" && pt !== null) {
      const raw = pt as Record<string, unknown>;
      table.provisionedThroughput = {
        ReadCapacityUnits:
          typeof raw["ReadCapacityUnits"] === "number"
            ? raw["ReadCapacityUnits"]
            : 0,
        WriteCapacityUnits:
          typeof raw["WriteCapacityUnits"] === "number"
            ? raw["WriteCapacityUnits"]
            : 0,
      };
    }
  }
  const gsi = parseSecondaryIndexes(input["GlobalSecondaryIndexes"]);
  if (gsi.length > 0) table.globalSecondaryIndexes = gsi;
  const lsi = parseSecondaryIndexes(input["LocalSecondaryIndexes"]);
  if (lsi.length > 0) table.localSecondaryIndexes = lsi;
  const inputTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as StoredTag[])
    : [];
  if (inputTags.length > 0) table.tags = inputTags;
  const streamSpec = asRecord(input["StreamSpecification"]);
  if (streamSpec["StreamEnabled"] === true) {
    const viewType =
      typeof streamSpec["StreamViewType"] === "string"
        ? streamSpec["StreamViewType"]
        : "NEW_IMAGE";
    const label = new Date().toISOString().replace(/[:.]/g, "");
    table.streamSpecification = {
      StreamEnabled: true,
      StreamViewType: viewType,
    };
    table.latestStreamArn = streamArnFor(ctx.region, ctx.account, name, label);
    table.latestStreamLabel = label;
    const stream: StoredStream = {
      kind: "stream",
      streamArn: table.latestStreamArn,
      tableName: name,
      shardId: shardIdFor(label),
      records: [],
      sequenceNumber: 0,
    };
    ctx.store.set(streamKey(table.latestStreamArn), stream);
  }
  table.status = "CREATING";
  ctx.store.set(name, table);
  setTimeout(() => {
    const stored = ctx.store.get<StoredTable>(name);
    if (
      stored !== undefined &&
      !hasKind(stored) &&
      stored.status === "CREATING"
    ) {
      ctx.store.set(name, { ...stored, status: "ACTIVE" });
    }
  }, 0);
  return { TableDescription: tableDescription(ctx, table, "CREATING") };
};

const DeleteTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  ctx.store.delete(name);
  return { TableDescription: tableDescription(ctx, table, "DELETING") };
};

const ListTables: OperationHandler = (input, ctx) => {
  const names = listTables(ctx)
    .map((table) => table.TableName)
    .sort();
  const exclusive = input["ExclusiveStartTableName"];
  const start =
    typeof exclusive === "string"
      ? names.findIndex((value) => value > exclusive)
      : 0;
  const remaining = start < 0 ? [] : names.slice(start);
  const limit =
    typeof input["Limit"] === "number" && input["Limit"] > 0
      ? input["Limit"]
      : remaining.length;
  const sliced = remaining.slice(0, limit);
  const result: Record<string, unknown> = { TableNames: sliced };
  if (sliced.length === limit && sliced.length < remaining.length) {
    result["LastEvaluatedTableName"] = sliced[sliced.length - 1];
  }
  return result;
};

const DescribeTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  return { Table: tableDescription(ctx, table, table.status ?? "ACTIVE") };
};

const keyProjection = (table: StoredTable, item: Item): Item => {
  const result: Item = {};
  for (const element of table.KeySchema) {
    const av = item[element.AttributeName];
    if (av !== undefined) result[element.AttributeName] = av;
  }
  return result;
};

const appendStreamRecord = (
  ctx: ServiceContext,
  table: StoredTable,
  eventName: "INSERT" | "MODIFY" | "REMOVE",
  newImage: Item | undefined,
  oldImage: Item | undefined,
): void => {
  const spec = table.streamSpecification;
  if (
    spec === undefined ||
    !spec.StreamEnabled ||
    table.latestStreamArn === undefined
  )
    return;
  const key = streamKey(table.latestStreamArn);
  const stream = ctx.store.get<StoredStream>(key);
  if (stream === undefined) return;
  const seqNum = stream.sequenceNumber + 1;
  const source = newImage ?? oldImage ?? {};
  const keys = keyProjection(table, source);
  const rec: StoredStreamRecord = {
    eventID: crypto.randomUUID(),
    eventVersion: "1.1",
    eventSource: "aws:dynamodb",
    awsRegion: ctx.region,
    eventName,
    dynamodb: {
      ApproximateCreationDateTime: Math.floor(Date.now() / 1000),
      Keys: keys,
      SequenceNumber: String(seqNum).padStart(21, "0"),
      SizeBytes: 1,
      StreamViewType: spec.StreamViewType,
    },
  };
  if (
    spec.StreamViewType === "NEW_IMAGE" ||
    spec.StreamViewType === "NEW_AND_OLD_IMAGES"
  ) {
    if (newImage !== undefined) rec.dynamodb.NewImage = newImage;
  }
  if (
    spec.StreamViewType === "OLD_IMAGE" ||
    spec.StreamViewType === "NEW_AND_OLD_IMAGES"
  ) {
    if (oldImage !== undefined) rec.dynamodb.OldImage = oldImage;
  }
  stream.records.push(rec);
  stream.sequenceNumber = seqNum;
  ctx.store.set(key, stream);
};

const PutItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  ensurePutDeleteReturnValues(input);
  const item = asItem(input["Item"]);
  const key = keyOf(table, item);
  const previous = table.items[key];
  ensureConditionPasses(input, previous);
  table.items[key] = item;
  ctx.store.set(name, table);
  const eventName = previous === undefined ? "INSERT" : "MODIFY";
  appendStreamRecord(ctx, table, eventName, item, previous);
  return input["ReturnValues"] === "ALL_OLD" && previous !== undefined
    ? { Attributes: previous }
    : {};
};

const isExpired = (table: StoredTable, item: Item): boolean => {
  const ttl = table.ttl;
  if (ttl === undefined || !ttl.Enabled) return false;
  const av = item[ttl.AttributeName];
  if (av === undefined) return false;
  const raw = av["N"];
  if (typeof raw !== "string") return false;
  const expires = Number(raw);
  return Number.isFinite(expires) && expires <= Math.floor(Date.now() / 1000);
};

const liveItems = (table: StoredTable): Item[] =>
  Object.values(table.items).filter((item) => !isExpired(table, item));

const GetItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const item = table.items[key];
  if (item === undefined || isExpired(table, item)) return {};
  const projection = buildProjection(input);
  return { Item: applyProjection(projection, item) };
};

const DeleteItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  ensurePutDeleteReturnValues(input);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const previous = table.items[key];
  ensureConditionPasses(input, previous);
  if (previous !== undefined) {
    delete table.items[key];
    ctx.store.set(name, table);
    appendStreamRecord(ctx, table, "REMOVE", undefined, previous);
  }
  return input["ReturnValues"] === "ALL_OLD" && previous !== undefined
    ? { Attributes: previous }
    : {};
};

const numberOf = (value: AttributeValue): number => {
  const inner = value["N"];
  return typeof inner === "string" ? Number(inner) : 0;
};

const applyAddValue = (
  current: AttributeValue | undefined,
  operand: AttributeValue,
): AttributeValue => {
  if (operand["N"] !== undefined) {
    const sum =
      (current === undefined ? 0 : numberOf(current)) + numberOf(operand);
    return { N: String(sum) };
  }
  if (Array.isArray(operand["SS"])) {
    const existing = Array.isArray(current?.["SS"])
      ? (current?.["SS"] as string[])
      : [];
    const merged = [...new Set([...existing, ...(operand["SS"] as string[])])];
    return { SS: merged };
  }
  if (Array.isArray(operand["NS"])) {
    const existing = Array.isArray(current?.["NS"])
      ? (current?.["NS"] as string[])
      : [];
    const merged = [...new Set([...existing, ...(operand["NS"] as string[])])];
    return { NS: merged };
  }
  return operand;
};

const ensureValuesUsed = (input: Record<string, unknown>): void => {
  const rawValues = input["ExpressionAttributeValues"];
  const provided =
    typeof rawValues === "object" && rawValues !== null
      ? Object.keys(rawValues)
      : [];
  if (provided.length === 0) return;
  const used = new Set<string>();
  for (const field of [
    "UpdateExpression",
    "ConditionExpression",
    "FilterExpression",
    "KeyConditionExpression",
  ]) {
    const expr = input[field];
    if (typeof expr !== "string") continue;
    for (const match of expr.matchAll(/:[A-Za-z0-9_]+/g)) used.add(match[0]);
  }
  const unused = provided.filter((key) => !used.has(key));
  if (unused.length > 0) {
    throw awsError(
      "ValidationException",
      `Value provided in ExpressionAttributeValues unused in expressions: keys: {${unused.join(", ")}}`,
      400,
    );
  }
};

const UpdateItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  ensureValuesUsed(input);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const previous = table.items[key];
  ensureConditionPasses(input, previous);
  const existing = previous ?? { ...asItem(input["Key"]) };
  let updated: Item;
  let touchedPaths: AttributePath[] = [];
  const expression = input["UpdateExpression"];
  if (typeof expression === "string" && expression !== "") {
    const values = asRecord(input["ExpressionAttributeValues"]) as Record<
      string,
      AttributeValue
    >;
    const exprNames = asRecord(input["ExpressionAttributeNames"]) as Record<
      string,
      string
    >;
    const ast = parseUpdateExpression(expression, {
      names: exprNames,
      values,
    });
    updated = applyUpdate(ast, existing);
    touchedPaths = collectUpdatePaths(ast);
  } else {
    updated = { ...existing };
    const updates = input["AttributeUpdates"];
    if (typeof updates === "object" && updates !== null) {
      for (const [attribute, action] of Object.entries(
        updates as Record<string, Record<string, unknown>>,
      )) {
        touchedPaths.push({ root: attribute, steps: [] });
        const operation = action["Action"];
        if (operation === "DELETE") {
          delete updated[attribute];
        } else if (operation === "ADD") {
          const value = action["Value"];
          if (typeof value === "object" && value !== null) {
            updated[attribute] = applyAddValue(
              updated[attribute],
              value as AttributeValue,
            );
          }
        } else {
          const value = action["Value"];
          if (typeof value === "object" && value !== null) {
            updated[attribute] = value as AttributeValue;
          }
        }
      }
    }
  }
  table.items[key] = updated;
  ctx.store.set(name, table);
  appendStreamRecord(ctx, table, "MODIFY", updated, previous);
  return updateReturnAttributes(
    input["ReturnValues"],
    previous,
    updated,
    touchedPaths,
  );
};

const matchesKeyConditions = (
  item: Item,
  conditions: Record<string, Record<string, unknown>>,
): boolean => {
  for (const [attribute, condition] of Object.entries(conditions)) {
    const operator = condition["ComparisonOperator"];
    const valueList = Array.isArray(condition["AttributeValueList"])
      ? (condition["AttributeValueList"] as AttributeValue[])
      : [];
    const target = valueList[0];
    const actual = item[attribute];
    if (operator === "EQ") {
      if (
        actual === undefined ||
        target === undefined ||
        scalarOf(actual) !== scalarOf(target)
      ) {
        return false;
      }
    }
  }
  return true;
};

const matchesFilterExpression = (
  item: Item,
  expression: string,
  values: Record<string, AttributeValue>,
  names: Record<string, string>,
): boolean => {
  const ast = parseConditionExpression(expression, { names, values });
  return evaluateCondition(ast, item);
};

const requireIndex = (table: StoredTable, indexName: string): void => {
  const indexes = [
    ...(table.globalSecondaryIndexes ?? []),
    ...(table.localSecondaryIndexes ?? []),
  ];
  if (!indexes.some((index) => index.IndexName === indexName)) {
    throw awsError(
      "ValidationException",
      `The table does not have the specified index: ${indexName}`,
      400,
    );
  }
};

const filterByExpression = (
  items: Item[],
  input: Record<string, unknown>,
): Item[] => {
  const expression = input["FilterExpression"];
  if (typeof expression !== "string" || expression === "") return items;
  const values = asRecord(input["ExpressionAttributeValues"]) as Record<
    string,
    AttributeValue
  >;
  const names = asRecord(input["ExpressionAttributeNames"]) as Record<
    string,
    string
  >;
  return items.filter((item) =>
    matchesFilterExpression(item, expression, values, names),
  );
};

const keySchemaShape = (
  elements: KeySchemaElement[],
  definitions: AttributeDefinition[] = [],
): { hash: string; range?: string; rangeType?: string } => {
  let hash = "";
  let range: string | undefined;
  for (const element of elements) {
    if (element.KeyType === "HASH") hash = element.AttributeName;
    else if (element.KeyType === "RANGE") range = element.AttributeName;
  }
  if (range === undefined) return { hash };
  const rangeType = definitions.find(
    (def) => def.AttributeName === range,
  )?.AttributeType;
  return { hash, range, rangeType };
};

const indexKeySchema = (
  table: StoredTable,
  indexName: string | undefined,
): { hash: string; range?: string; rangeType?: string } => {
  if (indexName === undefined) {
    return keySchemaShape(table.KeySchema, table.AttributeDefinitions);
  }
  const candidates = [
    ...(table.globalSecondaryIndexes ?? []),
    ...(table.localSecondaryIndexes ?? []),
  ];
  const index = candidates.find((entry) => entry.IndexName === indexName);
  if (index === undefined) {
    throw awsError(
      "ValidationException",
      `The table does not have the specified index: ${indexName}`,
      400,
    );
  }
  return keySchemaShape(index.KeySchema, table.AttributeDefinitions);
};

const matchesResolvedKeyCondition = (
  item: Item,
  cond: KeyConditionResult,
): boolean => {
  const hashVal = item[cond.hash.attribute];
  if (hashVal === undefined) return false;
  if (!equalsAV(hashVal, cond.hash.value)) return false;
  if (cond.range === undefined) return true;
  const rangeVal = item[cond.range.attribute];
  if (rangeVal === undefined) return false;
  if (cond.range.op === "BETWEEN") {
    const lo = compareAV(rangeVal, cond.range.lo);
    const hi = compareAV(rangeVal, cond.range.hi);
    return lo !== undefined && hi !== undefined && lo >= 0 && hi <= 0;
  }
  if (cond.range.op === "begins_with") {
    const value = rangeVal["S"];
    const prefix = cond.range.prefix["S"];
    if (typeof value !== "string" || typeof prefix !== "string") {
      const valueBytes = rangeVal["B"];
      const prefixBytes = cond.range.prefix["B"];
      if (typeof valueBytes === "string" && typeof prefixBytes === "string") {
        return valueBytes.startsWith(prefixBytes);
      }
      return false;
    }
    return value.startsWith(prefix);
  }
  const cmp = compareAV(rangeVal, cond.range.value);
  if (cmp === undefined) return false;
  switch (cond.range.op) {
    case "=":
      return cmp === 0;
    case "<":
      return cmp === -1;
    case "<=":
      return cmp !== 1;
    case ">":
      return cmp === 1;
    case ">=":
      return cmp !== -1;
  }
};

const projectKey = (
  item: Item,
  schema: { hash: string; range?: string },
  baseSchema: { hash: string; range?: string },
): Item => {
  const out: Item = {};
  const include = (attr: string): void => {
    const v = item[attr];
    if (v !== undefined) out[attr] = v;
  };
  include(schema.hash);
  if (schema.range !== undefined) include(schema.range);
  include(baseSchema.hash);
  if (baseSchema.range !== undefined) include(baseSchema.range);
  return out;
};

const keysEqual = (
  a: Item,
  b: Item,
  schema: { hash: string; range?: string },
): boolean => {
  const aHash = a[schema.hash];
  const bHash = b[schema.hash];
  if (aHash === undefined || bHash === undefined || !equalsAV(aHash, bHash)) {
    return false;
  }
  if (schema.range === undefined) return true;
  const aRange = a[schema.range];
  const bRange = b[schema.range];
  if (aRange === undefined || bRange === undefined) return false;
  return equalsAV(aRange, bRange);
};

const getIndex = (
  table: StoredTable,
  indexName: string,
): SecondaryIndex | undefined => {
  const candidates = [
    ...(table.globalSecondaryIndexes ?? []),
    ...(table.localSecondaryIndexes ?? []),
  ];
  return candidates.find((entry) => entry.IndexName === indexName);
};

const applyIndexProjection = (
  item: Item,
  index: SecondaryIndex,
  baseSchema: { hash: string; range?: string },
): Item => {
  const projType = index.Projection["ProjectionType"] as string | undefined;
  if (projType === "ALL" || projType === undefined) return item;
  const out: Item = {};
  const include = (attr: string): void => {
    const v = item[attr];
    if (v !== undefined) out[attr] = v;
  };
  include(baseSchema.hash);
  if (baseSchema.range !== undefined) include(baseSchema.range);
  const indexSchema = keySchemaShape(index.KeySchema);
  include(indexSchema.hash);
  if (indexSchema.range !== undefined) include(indexSchema.range);
  if (projType === "INCLUDE") {
    const nonKeyAttrs = index.Projection["NonKeyAttributes"];
    if (Array.isArray(nonKeyAttrs)) {
      for (const attr of nonKeyAttrs as string[]) {
        include(attr);
      }
    }
  }
  return out;
};

const validateSelectForIndex = (
  select: unknown,
  index: SecondaryIndex | undefined,
  indexName: string | undefined,
): void => {
  if (select === "ALL_ATTRIBUTES" && index !== undefined) {
    const projType = index.Projection["ProjectionType"];
    if (projType !== "ALL") {
      throw awsError(
        "ValidationException",
        `One or more parameter values were invalid: Select type ALL_ATTRIBUTES is not supported for global secondary index ${indexName ?? ""} unless the index's projection includes all attributes.`,
        400,
      );
    }
  }
};

const Query: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const indexName =
    typeof input["IndexName"] === "string" ? input["IndexName"] : undefined;
  if (indexName !== undefined) requireIndex(table, indexName);
  const index =
    indexName !== undefined ? getIndex(table, indexName) : undefined;
  const select = input["Select"];
  validateSelectForIndex(select, index, indexName);
  const schema = indexKeySchema(table, indexName);
  const baseSchema = keySchemaShape(table.KeySchema);
  const expression = input["KeyConditionExpression"];
  let candidates = liveItems(table);
  if (indexName !== undefined) {
    candidates = candidates.filter((item) => item[schema.hash] !== undefined);
    if (schema.range !== undefined) {
      candidates = candidates.filter(
        (item) => item[schema.range as string] !== undefined,
      );
    }
  }
  let matched: Item[];
  if (typeof expression === "string" && expression !== "") {
    const values = asRecord(input["ExpressionAttributeValues"]) as Record<
      string,
      AttributeValue
    >;
    const names = asRecord(input["ExpressionAttributeNames"]) as Record<
      string,
      string
    >;
    const ast = parseKeyConditionExpression(expression, { names, values });
    const cond = resolveKeyCondition(ast, schema);
    matched = candidates.filter((item) =>
      matchesResolvedKeyCondition(item, cond),
    );
    if (schema.range !== undefined) {
      const rangeAttr = schema.range;
      matched.sort((a, b) => {
        const cmp = compareAV(a[rangeAttr] ?? {}, b[rangeAttr] ?? {});
        if (cmp !== undefined && cmp !== 0) return cmp;
        const hashCmp = compareAV(
          a[baseSchema.hash] ?? {},
          b[baseSchema.hash] ?? {},
        );
        if (hashCmp !== undefined && hashCmp !== 0) return hashCmp;
        if (baseSchema.range === undefined) return 0;
        return (
          compareAV(a[baseSchema.range] ?? {}, b[baseSchema.range] ?? {}) ?? 0
        );
      });
    }
  } else {
    const conditions =
      typeof input["KeyConditions"] === "object" &&
      input["KeyConditions"] !== null
        ? (input["KeyConditions"] as Record<string, Record<string, unknown>>)
        : {};
    matched = candidates.filter((item) =>
      matchesKeyConditions(item, conditions),
    );
  }
  if (input["ScanIndexForward"] === false) {
    matched.reverse();
  }
  let startIndex = 0;
  const startKey = input["ExclusiveStartKey"];
  if (typeof startKey === "object" && startKey !== null) {
    const start = startKey as Item;
    const found = matched.findIndex(
      (item) =>
        keysEqual(item, start, schema) && keysEqual(item, start, baseSchema),
    );
    if (found >= 0) {
      startIndex = found + 1;
    } else if (
      schema.range !== undefined &&
      start[schema.range] !== undefined
    ) {
      const forward = input["ScanIndexForward"] !== false;
      const startRange = start[schema.range] as AttributeValue;
      const pos = matched.findIndex((item) => {
        const cmp = compareAV(item[schema.range as string] ?? {}, startRange);
        if (cmp === undefined) return false;
        return forward ? cmp > 0 : cmp < 0;
      });
      startIndex = pos >= 0 ? pos : matched.length;
    }
  }
  const remainder = matched.slice(startIndex);
  const rawLimit = input["Limit"];
  const limit =
    typeof rawLimit === "number" && rawLimit > 0
      ? Math.min(rawLimit, remainder.length)
      : remainder.length;
  const window = remainder.slice(0, limit);
  const filtered = filterByExpression(window, input);
  const userProjection = buildProjection(input);
  const applyProjections = (item: Item): Item => {
    const projected =
      index !== undefined
        ? applyIndexProjection(item, index, baseSchema)
        : item;
    return applyProjection(userProjection, projected);
  };
  const result: Record<string, unknown> = {
    Items: filtered.map(applyProjections),
    Count: filtered.length,
    ScannedCount: window.length,
  };
  if (limit < remainder.length) {
    const last = window[window.length - 1];
    if (last !== undefined) {
      result["LastEvaluatedKey"] = projectKey(last, schema, baseSchema);
    }
  }
  return result;
};

const Scan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  if (typeof input["IndexName"] === "string") {
    requireIndex(table, input["IndexName"]);
  }
  const segment = input["Segment"];
  const totalSegments = input["TotalSegments"];
  if ((segment === undefined) !== (totalSegments === undefined)) {
    throw awsError(
      "ValidationException",
      segment === undefined
        ? "The Segment parameter is required but was not present in the request when TotalSegments parameter is present"
        : "The TotalSegments parameter is required but was not present in the request when Segment parameter is present",
      400,
    );
  }
  if (typeof segment === "number" && typeof totalSegments === "number") {
    if (
      !Number.isInteger(totalSegments) ||
      totalSegments < 1 ||
      totalSegments > 1000000
    ) {
      throw awsError(
        "ValidationException",
        "TotalSegments must be a value between 1 and 1000000.",
        400,
      );
    }
    if (!Number.isInteger(segment) || segment < 0 || segment >= totalSegments) {
      throw awsError(
        "ValidationException",
        `The Segment parameter is zero-based and must be less than parameter TotalSegments: Segment: ${segment} is not less than TotalSegments: ${totalSegments}`,
        400,
      );
    }
  }
  const filter =
    typeof input["ScanFilter"] === "object" && input["ScanFilter"] !== null
      ? (input["ScanFilter"] as Record<string, Record<string, unknown>>)
      : {};
  const indexName =
    typeof input["IndexName"] === "string" ? input["IndexName"] : undefined;
  const index =
    indexName !== undefined ? getIndex(table, indexName) : undefined;
  const select = input["Select"];
  validateSelectForIndex(select, index, indexName);
  const schema = indexKeySchema(table, indexName);
  const baseSchema = keySchemaShape(table.KeySchema);
  const allItems = liveItems(table).sort((a, b) => {
    const hashCmp = compareAV(
      a[baseSchema.hash] ?? {},
      b[baseSchema.hash] ?? {},
    );
    if (hashCmp !== undefined && hashCmp !== 0) return hashCmp;
    if (baseSchema.range === undefined) return 0;
    return compareAV(a[baseSchema.range] ?? {}, b[baseSchema.range] ?? {}) ?? 0;
  });
  const ordered =
    indexName !== undefined
      ? allItems.filter((item) => {
          if (item[schema.hash] === undefined) return false;
          if (schema.range !== undefined && item[schema.range] === undefined)
            return false;
          return true;
        })
      : allItems;
  let startIndex = 0;
  const startKey = input["ExclusiveStartKey"];
  if (typeof startKey === "object" && startKey !== null) {
    const found = ordered.findIndex((item) =>
      keysEqual(item, startKey as Item, baseSchema),
    );
    if (found >= 0) startIndex = found + 1;
  }
  const remainder = ordered.slice(startIndex);
  const rawLimit = input["Limit"];
  const limit =
    typeof rawLimit === "number" && rawLimit > 0
      ? Math.min(rawLimit, remainder.length)
      : remainder.length;
  const scanned = remainder.slice(0, limit);
  const matched = scanned.filter((item) => matchesKeyConditions(item, filter));
  const items = filterByExpression(matched, input);
  const userProjection = buildProjection(input);
  const applyProjections = (item: Item): Item => {
    const projected =
      index !== undefined
        ? applyIndexProjection(item, index, baseSchema)
        : item;
    return applyProjection(userProjection, projected);
  };
  const result: Record<string, unknown> = {
    Items: items.map(applyProjections),
    Count: items.length,
    ScannedCount: scanned.length,
  };
  if (limit < remainder.length) {
    const last = scanned[scanned.length - 1];
    if (last !== undefined) {
      result["LastEvaluatedKey"] = projectKey(last, schema, baseSchema);
    }
  }
  return result;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const applyWriteRequest = (
  ctx: ServiceContext,
  name: string,
  request: Record<string, unknown>,
): void => {
  const table = requireTable(ctx, name);
  const put = request["PutRequest"];
  const del = request["DeleteRequest"];
  if (put !== undefined) {
    const item = asItem(asRecord(put)["Item"]);
    const key = keyOf(table, item);
    const previous = table.items[key];
    table.items[key] = item;
    ctx.store.set(name, table);
    appendStreamRecord(
      ctx,
      table,
      previous === undefined ? "INSERT" : "MODIFY",
      item,
      previous,
    );
    return;
  }
  if (del !== undefined) {
    const key = keyFromKeyInput(table, asItem(asRecord(del)["Key"]));
    const previous = table.items[key];
    if (previous !== undefined) {
      delete table.items[key];
      ctx.store.set(name, table);
      appendStreamRecord(ctx, table, "REMOVE", undefined, previous);
    }
  }
};

const BatchWriteItem: OperationHandler = (input, ctx) => {
  const requestItems = asRecord(input["RequestItems"]);
  for (const [name, requests] of Object.entries(requestItems)) {
    const list = Array.isArray(requests)
      ? (requests as Record<string, unknown>[])
      : [];
    for (const request of list) {
      applyWriteRequest(ctx, name, asRecord(request));
    }
  }
  return { UnprocessedItems: {} };
};

const BatchGetItem: OperationHandler = (input, ctx) => {
  const requestItems = asRecord(input["RequestItems"]);
  const responses: Record<string, Item[]> = {};
  for (const [name, spec] of Object.entries(requestItems)) {
    const table = requireTable(ctx, name);
    const specRecord = asRecord(spec);
    const keys = Array.isArray(specRecord["Keys"])
      ? (specRecord["Keys"] as Item[])
      : [];
    const projection = buildProjection(specRecord);
    const found: Item[] = [];
    for (const key of keys) {
      const item = table.items[keyFromKeyInput(table, asItem(key))];
      if (item !== undefined && !isExpired(table, item))
        found.push(applyProjection(projection, item));
    }
    responses[name] = found;
  }
  return { Responses: responses, UnprocessedKeys: {} };
};

type CancellationReason = {
  Code: string;
  Message?: string;
  Item?: Item;
};

const NONE_REASON: CancellationReason = { Code: "None" };

const evaluateOptionalCondition = (
  spec: Record<string, unknown>,
  current: Item | undefined,
): { ok: true } | { ok: false; reason: CancellationReason } => {
  const expression = spec["ConditionExpression"];
  if (typeof expression !== "string" || expression === "") return { ok: true };
  const values = asRecord(spec["ExpressionAttributeValues"]) as Record<
    string,
    AttributeValue
  >;
  const names = asRecord(spec["ExpressionAttributeNames"]) as Record<
    string,
    string
  >;
  const ast = parseConditionExpression(expression, { names, values });
  if (evaluateCondition(ast, current ?? {})) return { ok: true };
  const reason: CancellationReason = {
    Code: "ConditionalCheckFailed",
    Message: "The conditional request failed",
  };
  if (
    current !== undefined &&
    spec["ReturnValuesOnConditionCheckFailure"] === "ALL_OLD"
  ) {
    reason.Item = current;
  }
  return { ok: false, reason };
};

type TransactPlan =
  | { kind: "Put"; table: StoredTable; key: string; value: Item }
  | { kind: "Update"; table: StoredTable; key: string; value: Item }
  | { kind: "Delete"; table: StoredTable; key: string }
  | { kind: "Skip" };

const TransactWriteItems: OperationHandler = (input, ctx) => {
  const clientRequestToken =
    typeof input["ClientRequestToken"] === "string"
      ? input["ClientRequestToken"]
      : undefined;
  if (clientRequestToken !== undefined) {
    if (
      ctx.store.get<StoredTransactToken>(
        transactTokenKey(clientRequestToken),
      ) !== undefined
    ) {
      return {};
    }
  }
  const transactItems = Array.isArray(input["TransactItems"])
    ? (input["TransactItems"] as Record<string, unknown>[])
    : [];
  if (transactItems.length < 1) {
    throw awsError(
      "ValidationException",
      "1 validation error detected: Value '[]' at 'transactItems' failed to satisfy constraint: Member must have length greater than or equal to 1",
      400,
    );
  }
  if (transactItems.length > 100) {
    throw awsError(
      "ValidationException",
      "1 validation error detected: Value at 'transactItems' failed to satisfy constraint: Member must have length less than or equal to 100",
      400,
    );
  }
  const targets = new Set<string>();
  const ensureUniqueTarget = (name: string, key: string): void => {
    const identifier = `${name} ${key}`;
    if (targets.has(identifier)) {
      throw awsError(
        "ValidationException",
        "Transaction request cannot include multiple operations on one item",
        400,
      );
    }
    targets.add(identifier);
  };
  const snapshots = new Map<string, StoredTable>();
  const tableFor = (name: string): StoredTable => {
    const existing = snapshots.get(name);
    if (existing !== undefined) return existing;
    const table = requireTable(ctx, name);
    snapshots.set(name, { ...table, items: { ...table.items } });
    return snapshots.get(name) as StoredTable;
  };
  const reasons: CancellationReason[] = new Array(transactItems.length).fill(
    NONE_REASON,
  );
  const plans: TransactPlan[] = new Array(transactItems.length).fill({
    kind: "Skip",
  });
  let hasFailure = false;
  for (let i = 0; i < transactItems.length; i++) {
    const entry = asRecord(transactItems[i]);
    const conditionCheck = entry["ConditionCheck"];
    const put = entry["Put"];
    const del = entry["Delete"];
    const update = entry["Update"];
    if (conditionCheck !== undefined) {
      const spec = asRecord(conditionCheck);
      const expression = spec["ConditionExpression"];
      if (typeof expression !== "string" || expression === "") {
        throw awsError(
          "ValidationException",
          "ConditionExpression is required for ConditionCheck",
          400,
        );
      }
      const name = requireString(spec, "TableName");
      const table = tableFor(name);
      const key = keyFromKeyInput(table, asItem(spec["Key"]));
      ensureUniqueTarget(name, key);
      const current = table.items[key];
      const verdict = evaluateOptionalCondition(spec, current);
      if (!verdict.ok) {
        reasons[i] = verdict.reason;
        hasFailure = true;
      }
      continue;
    }
    if (put !== undefined) {
      const spec = asRecord(put);
      const name = requireString(spec, "TableName");
      const table = tableFor(name);
      const value = asItem(spec["Item"]);
      const key = keyOf(table, value);
      ensureUniqueTarget(name, key);
      const current = table.items[key];
      const verdict = evaluateOptionalCondition(spec, current);
      if (!verdict.ok) {
        reasons[i] = verdict.reason;
        hasFailure = true;
      }
      plans[i] = { kind: "Put", table, key, value };
      continue;
    }
    if (del !== undefined) {
      const spec = asRecord(del);
      const name = requireString(spec, "TableName");
      const table = tableFor(name);
      const key = keyFromKeyInput(table, asItem(spec["Key"]));
      ensureUniqueTarget(name, key);
      const current = table.items[key];
      const verdict = evaluateOptionalCondition(spec, current);
      if (!verdict.ok) {
        reasons[i] = verdict.reason;
        hasFailure = true;
      }
      plans[i] = { kind: "Delete", table, key };
      continue;
    }
    if (update !== undefined) {
      const spec = asRecord(update);
      const name = requireString(spec, "TableName");
      const table = tableFor(name);
      const key = keyFromKeyInput(table, asItem(spec["Key"]));
      ensureUniqueTarget(name, key);
      const current = table.items[key];
      const verdict = evaluateOptionalCondition(spec, current);
      if (!verdict.ok) {
        reasons[i] = verdict.reason;
        hasFailure = true;
      }
      const existing = current ?? { ...asItem(spec["Key"]) };
      const expression = spec["UpdateExpression"];
      let updated: Item;
      if (typeof expression === "string" && expression !== "") {
        const values = asRecord(spec["ExpressionAttributeValues"]) as Record<
          string,
          AttributeValue
        >;
        const names = asRecord(spec["ExpressionAttributeNames"]) as Record<
          string,
          string
        >;
        const ast = parseUpdateExpression(expression, { names, values });
        updated = applyUpdate(ast, existing);
      } else {
        updated = existing;
      }
      plans[i] = { kind: "Update", table, key, value: updated };
      continue;
    }
  }
  if (hasFailure) {
    throw awsError(
      "TransactionCanceledException",
      "Transaction cancelled, please refer cancellation reasons for specific reasons [" +
        reasons.map((r) => r.Code).join(", ") +
        "]",
      400,
      { CancellationReasons: reasons },
    );
  }
  for (const plan of plans) {
    if (plan.kind === "Skip") continue;
    if (plan.kind === "Put") {
      const previous = plan.table.items[plan.key];
      plan.table.items[plan.key] = plan.value;
      appendStreamRecord(
        ctx,
        plan.table,
        previous === undefined ? "INSERT" : "MODIFY",
        plan.value,
        previous,
      );
    } else if (plan.kind === "Update") {
      const previous = plan.table.items[plan.key];
      plan.table.items[plan.key] = plan.value;
      appendStreamRecord(
        ctx,
        plan.table,
        previous === undefined ? "INSERT" : "MODIFY",
        plan.value,
        previous,
      );
    } else {
      const previous = plan.table.items[plan.key];
      delete plan.table.items[plan.key];
      if (previous !== undefined) {
        appendStreamRecord(ctx, plan.table, "REMOVE", undefined, previous);
      }
    }
  }
  for (const [name, table] of snapshots) {
    ctx.store.set(name, table);
  }
  if (clientRequestToken !== undefined) {
    ctx.store.set<StoredTransactToken>(transactTokenKey(clientRequestToken), {
      kind: "transact-token",
    });
  }
  return {};
};

const TransactGetItems: OperationHandler = (input, ctx) => {
  const transactItems = Array.isArray(input["TransactItems"])
    ? (input["TransactItems"] as Record<string, unknown>[])
    : [];
  const responses: Record<string, unknown>[] = [];
  for (const entry of transactItems) {
    const get = asRecord(asRecord(entry)["Get"]);
    const table = requireTable(ctx, requireString(get, "TableName"));
    const item = table.items[keyFromKeyInput(table, asItem(get["Key"]))];
    responses.push(
      item === undefined || isExpired(table, item) ? {} : { Item: item },
    );
  }
  return { Responses: responses };
};

const UpdateTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const additions = Array.isArray(input["AttributeDefinitions"])
    ? (input["AttributeDefinitions"] as AttributeDefinition[])
    : [];
  if (additions.length > 0) {
    const existing = new Map(
      table.AttributeDefinitions.map((definition) => [
        definition.AttributeName,
        definition,
      ]),
    );
    for (const definition of additions) {
      existing.set(definition.AttributeName, definition);
    }
    table.AttributeDefinitions = [...existing.values()];
    ctx.store.set(name, table);
  }
  const streamSpec = asRecord(input["StreamSpecification"]);
  if (typeof streamSpec["StreamEnabled"] === "boolean") {
    if (streamSpec["StreamEnabled"] === true) {
      const viewType =
        typeof streamSpec["StreamViewType"] === "string"
          ? streamSpec["StreamViewType"]
          : "NEW_IMAGE";
      const label = new Date().toISOString().replace(/[:.]/g, "");
      table.streamSpecification = {
        StreamEnabled: true,
        StreamViewType: viewType,
      };
      table.latestStreamArn = streamArnFor(
        ctx.region,
        ctx.account,
        name,
        label,
      );
      table.latestStreamLabel = label;
      const stream: StoredStream = {
        kind: "stream",
        streamArn: table.latestStreamArn,
        tableName: name,
        shardId: shardIdFor(label),
        records: [],
        sequenceNumber: 0,
      };
      ctx.store.set(streamKey(table.latestStreamArn), stream);
    } else {
      table.streamSpecification = {
        StreamEnabled: false,
        StreamViewType:
          table.streamSpecification?.StreamViewType ?? "NEW_IMAGE",
      };
    }
    ctx.store.set(name, table);
  }
  const newBillingMode =
    typeof input["BillingMode"] === "string" ? input["BillingMode"] : undefined;
  if (newBillingMode !== undefined) {
    table.billingMode = newBillingMode;
    ctx.store.set(name, table);
  }
  const effectiveBillingMode = newBillingMode ?? table.billingMode;
  if (effectiveBillingMode !== "PAY_PER_REQUEST") {
    const pt = input["ProvisionedThroughput"];
    if (typeof pt === "object" && pt !== null) {
      const raw = pt as Record<string, unknown>;
      table.provisionedThroughput = {
        ReadCapacityUnits:
          typeof raw["ReadCapacityUnits"] === "number"
            ? raw["ReadCapacityUnits"]
            : (table.provisionedThroughput?.ReadCapacityUnits ?? 0),
        WriteCapacityUnits:
          typeof raw["WriteCapacityUnits"] === "number"
            ? raw["WriteCapacityUnits"]
            : (table.provisionedThroughput?.WriteCapacityUnits ?? 0),
      };
      ctx.store.set(name, table);
    }
  }
  const gsiUpdates = Array.isArray(input["GlobalSecondaryIndexUpdates"])
    ? (input["GlobalSecondaryIndexUpdates"] as Record<string, unknown>[])
    : [];
  for (const update of gsiUpdates) {
    const updateOp = asRecord(update["Update"]);
    const indexName =
      typeof updateOp["IndexName"] === "string" ? updateOp["IndexName"] : "";
    const gsiPt = updateOp["ProvisionedThroughput"];
    if (
      indexName !== "" &&
      typeof gsiPt === "object" &&
      gsiPt !== null &&
      table.globalSecondaryIndexes !== undefined
    ) {
      const raw = gsiPt as Record<string, unknown>;
      table.globalSecondaryIndexes = table.globalSecondaryIndexes.map((idx) =>
        idx.IndexName === indexName
          ? {
              ...idx,
              provisionedThroughput: {
                ReadCapacityUnits:
                  typeof raw["ReadCapacityUnits"] === "number"
                    ? raw["ReadCapacityUnits"]
                    : (idx.provisionedThroughput?.ReadCapacityUnits ?? 0),
                WriteCapacityUnits:
                  typeof raw["WriteCapacityUnits"] === "number"
                    ? raw["WriteCapacityUnits"]
                    : (idx.provisionedThroughput?.WriteCapacityUnits ?? 0),
              },
            }
          : idx,
      );
      ctx.store.set(name, table);
    }
  }
  return { TableDescription: tableDescription(ctx, table, "ACTIVE") };
};

const UpdateTimeToLive: OperationHandler = (input, ctx) => {
  const name = tableNameFromArn(requireString(input, "TableName"));
  const table = requireTable(ctx, name);
  const specification = asRecord(input["TimeToLiveSpecification"]);
  const ttl: StoredTtl = {
    Enabled: specification["Enabled"] === true,
    AttributeName:
      typeof specification["AttributeName"] === "string"
        ? specification["AttributeName"]
        : "",
  };
  table.ttl = ttl;
  ctx.store.set(name, table);
  return {
    TimeToLiveSpecification: {
      Enabled: ttl.Enabled,
      AttributeName: ttl.AttributeName,
    },
  };
};

const DescribeTimeToLive: OperationHandler = (input, ctx) => {
  const name = tableNameFromArn(requireString(input, "TableName"));
  const table = requireTable(ctx, name);
  const ttl = table.ttl;
  if (ttl === undefined || !ttl.Enabled) {
    return { TimeToLiveDescription: { TimeToLiveStatus: "DISABLED" } };
  }
  return {
    TimeToLiveDescription: {
      TimeToLiveStatus: "ENABLED",
      AttributeName: ttl.AttributeName,
    },
  };
};

const resourceTable = (ctx: ServiceContext, arn: string): StoredTable =>
  requireTable(ctx, tableNameFromArn(arn));

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const table = resourceTable(ctx, arn);
  const tags = Array.isArray(input["Tags"])
    ? (input["Tags"] as StoredTag[])
    : [];
  const merged = new Map(
    (table.tags ?? []).map((tag) => [tag.Key, tag] as const),
  );
  for (const tag of tags) {
    merged.set(tag.Key, { Key: tag.Key, Value: tag.Value });
  }
  table.tags = [...merged.values()];
  ctx.store.set(table.TableName, table);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const table = resourceTable(ctx, arn);
  const keys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const remove = new Set(keys);
  table.tags = (table.tags ?? []).filter((tag) => !remove.has(tag.Key));
  ctx.store.set(table.TableName, table);
  return {};
};

const ListTagsOfResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const table = resourceTable(ctx, arn);
  return { Tags: table.tags ?? [] };
};

const backupArnOf = (
  region: string,
  account: string,
  table: string,
  timestamp: number,
): string =>
  `arn:aws:dynamodb:${region}:${account}:table/${table}/backup/${timestamp}`;

const tableIdOf = (region: string, account: string, name: string): string =>
  `${region}-${account}-${name}`;

const backupDetails = (backup: StoredBackup): Record<string, unknown> => ({
  BackupArn: backup.BackupArn,
  BackupName: backup.BackupName,
  BackupSizeBytes: backup.BackupSizeBytes,
  BackupStatus: backup.BackupStatus,
  BackupType: backup.BackupType,
  BackupCreationDateTime: backup.BackupCreationDateTime,
});

const backupSummary = (backup: StoredBackup): Record<string, unknown> => ({
  TableName: backup.TableName,
  TableId: backup.TableId,
  TableArn: backup.TableArn,
  BackupArn: backup.BackupArn,
  BackupName: backup.BackupName,
  BackupCreationDateTime: backup.BackupCreationDateTime,
  BackupStatus: backup.BackupStatus,
  BackupType: backup.BackupType,
  BackupSizeBytes: backup.BackupSizeBytes,
});

const backupDescription = (backup: StoredBackup): Record<string, unknown> => ({
  BackupDetails: backupDetails(backup),
  SourceTableDetails: {
    TableName: backup.TableName,
    TableId: backup.TableId,
    TableArn: backup.TableArn,
    TableSizeBytes: backup.TableSizeBytes,
    KeySchema: backup.KeySchema,
    TableCreationDateTime: backup.TableCreationDateTime,
    ProvisionedThroughput: {
      ReadCapacityUnits: 0,
      WriteCapacityUnits: 0,
    },
    ItemCount: backup.ItemCount,
    BillingMode: "PROVISIONED",
  },
});

const requireBackup = (ctx: ServiceContext, arn: string): StoredBackup => {
  const backup = ctx.store.get<StoredBackup>(backupKey(arn));
  if (backup === undefined || !isBackupEntry(backup)) {
    throw awsError("BackupNotFoundException", `Backup not found: ${arn}`, 400);
  }
  return backup;
};

const CreateBackup: OperationHandler = (input, ctx) => {
  const tableName = tableNameFromArn(requireString(input, "TableName"));
  const backupName = requireString(input, "BackupName");
  const table = requireTable(ctx, tableName);
  const timestamp = Date.now();
  const backup: StoredBackup = {
    kind: "backup",
    BackupArn: backupArnOf(ctx.region, ctx.account, tableName, timestamp),
    BackupName: backupName,
    BackupStatus: "AVAILABLE",
    BackupType: "USER",
    BackupCreationDateTime: Math.floor(timestamp / 1000),
    BackupSizeBytes: 0,
    TableName: tableName,
    TableId: tableIdOf(ctx.region, ctx.account, tableName),
    TableArn: tableArn(ctx.region, ctx.account, tableName),
    TableSizeBytes: 0,
    KeySchema: table.KeySchema,
    TableCreationDateTime: table.CreationDateTime,
    ItemCount: Object.keys(table.items).length,
  };
  ctx.store.set(backupKey(backup.BackupArn), backup);
  return { BackupDetails: backupDetails(backup) };
};

const ListBackups: OperationHandler = (input, ctx) => {
  const filter = input["TableName"];
  const tableName =
    typeof filter === "string" && filter !== ""
      ? tableNameFromArn(filter)
      : undefined;
  const summaries = listBackups(ctx)
    .filter(
      (backup) => tableName === undefined || backup.TableName === tableName,
    )
    .sort((left, right) => left.BackupArn.localeCompare(right.BackupArn))
    .map((backup) => backupSummary(backup));
  return { BackupSummaries: summaries };
};

const DescribeBackup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "BackupArn");
  const backup = requireBackup(ctx, arn);
  return { BackupDescription: backupDescription(backup) };
};

const DeleteBackup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "BackupArn");
  const backup = requireBackup(ctx, arn);
  ctx.store.delete(backupKey(arn));
  return {
    BackupDescription: backupDescription({
      ...backup,
      BackupStatus: "DELETED",
    }),
  };
};

const continuousBackupsDescription = (
  enabled: boolean,
): Record<string, unknown> => ({
  ContinuousBackupsStatus: "ENABLED",
  PointInTimeRecoveryDescription: {
    PointInTimeRecoveryStatus: enabled ? "ENABLED" : "DISABLED",
  },
});

const UpdateContinuousBackups: OperationHandler = (input, ctx) => {
  const tableName = tableNameFromArn(requireString(input, "TableName"));
  const table = requireTable(ctx, tableName);
  const specification = asRecord(input["PointInTimeRecoverySpecification"]);
  const enabled = specification["PointInTimeRecoveryEnabled"] === true;
  table.pointInTimeRecovery = enabled;
  ctx.store.set(tableName, table);
  return {
    ContinuousBackupsDescription: continuousBackupsDescription(enabled),
  };
};

const DescribeContinuousBackups: OperationHandler = (input, ctx) => {
  const tableName = tableNameFromArn(requireString(input, "TableName"));
  const table = requireTable(ctx, tableName);
  return {
    ContinuousBackupsDescription: continuousBackupsDescription(
      table.pointInTimeRecovery === true,
    ),
  };
};

const globalTableKey = (name: string): string => `global-table:${name}`;
const exportKey = (arn: string): string => `export:${arn}`;
const importKey = (arn: string): string => `import:${arn}`;
const kinesisKey = (tableName: string): string => `kinesis:${tableName}`;
const contributorInsightsKey = (
  tableName: string,
  indexName?: string,
): string => `contributor:${tableName}:${indexName ?? ""}`;
const resourcePolicyKey = (arn: string): string => `resource-policy:${arn}`;

const isGlobalTableEntry = (value: unknown): value is StoredGlobalTable =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>)["kind"] === "global-table";

const isExportEntry = (value: unknown): value is StoredExport =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>)["kind"] === "export";

const isImportEntry = (value: unknown): value is StoredImport =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>)["kind"] === "import";

const isContributorInsightsEntry = (
  value: unknown,
): value is StoredContributorInsights =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>)["kind"] === "contributor-insights";

const exportArn = (
  region: string,
  account: string,
  tableName: string,
  timestamp: number,
): string =>
  `arn:aws:dynamodb:${region}:${account}:table/${tableName}/export/${timestamp}`;

const importArn = (
  region: string,
  account: string,
  timestamp: number,
): string => `arn:aws:dynamodb:${region}:${account}:import/${timestamp}`;

const globalTableDescription = (
  gt: StoredGlobalTable,
): Record<string, unknown> => ({
  GlobalTableName: gt.GlobalTableName,
  ReplicationGroup: gt.ReplicationGroup.map((r) => ({
    RegionName: r.RegionName,
    ReplicaStatus: "ACTIVE",
  })),
  GlobalTableArn: `arn:aws:dynamodb::${gt.GlobalTableName}:global-table/${gt.GlobalTableName}`,
  CreationDateTime: gt.CreationDateTime,
  GlobalTableStatus: gt.GlobalTableStatus,
});

const exportDescription = (e: StoredExport): Record<string, unknown> => ({
  ExportArn: e.ExportArn,
  ExportStatus: e.ExportStatus,
  StartTime: e.StartTime,
  EndTime: e.EndTime,
  TableArn: e.TableArn,
  TableId: e.TableId,
  S3Bucket: e.S3Bucket,
  S3Prefix: e.S3Prefix,
  ExportFormat: e.ExportFormat,
  ExportType: e.ExportType,
  BilledSizeBytes: e.BilledSizeBytes,
  ItemCount: e.ItemCount,
});

const importDescription = (i: StoredImport): Record<string, unknown> => ({
  ImportArn: i.ImportArn,
  ImportStatus: i.ImportStatus,
  TableArn: i.TableArn,
  TableId: i.TableId,
  S3BucketSource: i.S3BucketSource,
  InputFormat: i.InputFormat,
  StartTime: i.StartTime,
  EndTime: i.EndTime,
  ProcessedItemCount: i.ProcessedItemCount,
  ImportedItemCount: i.ImportedItemCount,
  ErrorCount: 0,
});

const requireGlobalTable = (
  ctx: ServiceContext,
  name: string,
): StoredGlobalTable => {
  const gt = ctx.store.get<StoredGlobalTable>(globalTableKey(name));
  if (gt === undefined || !isGlobalTableEntry(gt)) {
    throw awsError(
      "GlobalTableNotFoundException",
      `Global table: ${name} not found`,
      400,
    );
  }
  return gt;
};

const partiQLWhereMatch = (
  item: Item,
  whereClause: string,
  params: AttributeValue[],
): boolean => {
  const trimmed = whereClause.trim();
  if (trimmed === "") return true;
  const values: Record<string, AttributeValue> = {};
  let counter = 0;
  let litCounter = 0;
  const replaced = trimmed
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, "$1")
    .replace(/\?/g, () => {
      const name = `:_p_${counter}`;
      const v = params[counter++];
      if (v !== undefined) values[name] = v;
      return name;
    })
    .replace(/'((?:[^']|'')*)'/g, (_full, contents: string) => {
      const name = `:_lit_${litCounter++}`;
      values[name] = { S: contents.replace(/''/g, "'") };
      return name;
    })
    .replace(/(?<![:\w.])-?\d+(?:\.\d+)?/g, (literal) => {
      const name = `:_lit_${litCounter++}`;
      values[name] = { N: literal };
      return name;
    });
  const ast = parseConditionExpression(replaced, { names: {}, values });
  return evaluateCondition(ast, item);
};

const parsePartiQLValue = (expr: string, params: AttributeValue[]): Item => {
  let pos = 0;
  let paramIdx = 0;
  const fail = (): never => {
    throw awsError(
      "ValidationException",
      "Unable to parse PartiQL statement value",
      400,
    );
  };
  const skipSpace = (): void => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };
  const readString = (): string => {
    pos++;
    let out = "";
    while (pos < expr.length) {
      const ch = expr[pos];
      if (ch === "'") {
        if (expr[pos + 1] === "'") {
          out += "'";
          pos += 2;
          continue;
        }
        pos++;
        return out;
      }
      out += ch;
      pos++;
    }
    return fail();
  };
  const parseValue = (): AttributeValue => {
    skipSpace();
    const ch = expr[pos];
    if (ch === "?") {
      pos++;
      const param = params[paramIdx++];
      return param ?? fail();
    }
    if (ch === "'") return { S: readString() };
    if (ch === "{") return { M: parseMap() };
    if (ch === "[") return { L: parseList() };
    if (expr.startsWith("true", pos)) {
      pos += 4;
      return { BOOL: true };
    }
    if (expr.startsWith("false", pos)) {
      pos += 5;
      return { BOOL: false };
    }
    if (expr.startsWith("null", pos)) {
      pos += 4;
      return { NULL: true };
    }
    const numMatch = /^-?\d+(?:\.\d+)?/.exec(expr.slice(pos));
    if (numMatch !== null) {
      pos += numMatch[0].length;
      return { N: numMatch[0] };
    }
    return fail();
  };
  const parseMap = (): Item => {
    const map: Item = {};
    pos++;
    skipSpace();
    if (expr[pos] === "}") {
      pos++;
      return map;
    }
    for (;;) {
      skipSpace();
      if (expr[pos] !== "'") return fail();
      const key = readString();
      skipSpace();
      if (expr[pos] !== ":") return fail();
      pos++;
      map[key] = parseValue();
      skipSpace();
      if (expr[pos] === ",") {
        pos++;
        continue;
      }
      if (expr[pos] === "}") {
        pos++;
        return map;
      }
      return fail();
    }
  };
  const parseList = (): AttributeValue[] => {
    const list: AttributeValue[] = [];
    pos++;
    skipSpace();
    if (expr[pos] === "]") {
      pos++;
      return list;
    }
    for (;;) {
      list.push(parseValue());
      skipSpace();
      if (expr[pos] === ",") {
        pos++;
        continue;
      }
      if (expr[pos] === "]") {
        pos++;
        return list;
      }
      return fail();
    }
  };
  skipSpace();
  return parseMap();
};

const parsePartiQLUpdate = (
  setClause: string,
  params: AttributeValue[],
): { expression: string; values: Record<string, AttributeValue> } => {
  const values: Record<string, AttributeValue> = {};
  let counter = 0;
  const expression = `SET ${setClause
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, "$1")
    .replace(/\?/g, () => {
      const name = `:_s_${counter}`;
      const v = params[counter++];
      if (v !== undefined) values[name] = v;
      return name;
    })}`;
  return { expression, values };
};

const countParams = (s: string): number => (s.match(/\?/g) ?? []).length;

const executePartiQL = (
  statement: string,
  parameters: AttributeValue[],
  ctx: ServiceContext,
): Item[] => {
  const stmt = statement.trim();

  const selectMatch =
    /^SELECT\s+.*?\s+FROM\s+"?([^"\s]+)"?(?:\s+WHERE\s+(.+))?$/is.exec(stmt);
  if (selectMatch !== null) {
    const tableName = selectMatch[1];
    const whereClause = selectMatch[2];
    const table = requireTable(ctx, tableName);
    const allItems = Object.values(table.items);
    if (whereClause === undefined) return allItems;
    return allItems.filter((item) =>
      partiQLWhereMatch(item, whereClause, parameters),
    );
  }

  const insertMatch =
    /^INSERT\s+INTO\s+"?([^"\s]+)"?\s+VALUE\s+(\{.+\})\s*$/is.exec(stmt);
  if (insertMatch !== null) {
    const tableName = insertMatch[1];
    const valueExpr = insertMatch[2];
    const table = requireTable(ctx, tableName);
    const item = parsePartiQLValue(valueExpr, parameters);
    if (Object.keys(item).length > 0) {
      const key = keyOf(table, item);
      if (table.items[key] !== undefined) {
        throw awsError(
          "DuplicateItemException",
          "Duplicate primary key exists in table",
          400,
        );
      }
      table.items[key] = item;
      ctx.store.set(tableName, table);
      appendStreamRecord(ctx, table, "INSERT", item, undefined);
    }
    return [];
  }

  const updateMatch =
    /^UPDATE\s+"?([^"\s]+)"?\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is.exec(stmt);
  if (updateMatch !== null) {
    const tableName = updateMatch[1];
    const setClause = updateMatch[2].trim();
    const whereClause = updateMatch[3];
    const table = requireTable(ctx, tableName);
    const setParamCount = countParams(setClause);
    const { expression, values } = parsePartiQLUpdate(
      setClause,
      parameters.slice(0, setParamCount),
    );
    const ast = parseUpdateExpression(expression, { names: {}, values });
    const whereParams = parameters.slice(setParamCount);
    const allItems = Object.values(table.items);
    const matched =
      whereClause !== undefined
        ? allItems.filter((item) =>
            partiQLWhereMatch(item, whereClause, whereParams),
          )
        : allItems;
    const updated = matched.map((item) => {
      const key = keyFromKeyInput(table, item);
      const next = applyUpdate(ast, item);
      table.items[key] = next;
      appendStreamRecord(ctx, table, "MODIFY", next, item);
      return next;
    });
    if (matched.length > 0) ctx.store.set(tableName, table);
    return updated;
  }

  const deleteMatch =
    /^DELETE\s+FROM\s+"?([^"\s]+)"?(?:\s+WHERE\s+(.+))?$/is.exec(stmt);
  if (deleteMatch !== null) {
    const tableName = deleteMatch[1];
    const whereClause = deleteMatch[2];
    const table = requireTable(ctx, tableName);
    const allItems = Object.values(table.items);
    const matched =
      whereClause !== undefined
        ? allItems.filter((item) =>
            partiQLWhereMatch(item, whereClause, parameters),
          )
        : allItems;
    for (const item of matched) {
      delete table.items[keyFromKeyInput(table, item)];
      appendStreamRecord(ctx, table, "REMOVE", undefined, item);
    }
    if (matched.length > 0) ctx.store.set(tableName, table);
    return [];
  }

  return [];
};

const DescribeLimits: OperationHandler = (_input, _ctx) => ({
  AccountMaxReadCapacityUnits: 80000,
  AccountMaxWriteCapacityUnits: 80000,
  TableMaxReadCapacityUnits: 40000,
  TableMaxWriteCapacityUnits: 40000,
});

const DescribeEndpoints: OperationHandler = (_input, ctx) => ({
  Endpoints: [
    {
      Address: `dynamodb.${ctx.region}.amazonaws.com`,
      CachePeriodInMinutes: 1440,
    },
  ],
});

const CreateGlobalTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GlobalTableName");
  if (ctx.store.get(globalTableKey(name)) !== undefined) {
    throw awsError(
      "GlobalTableAlreadyExistsException",
      `Global table: ${name} already exists`,
      400,
    );
  }
  const replicationGroup = Array.isArray(input["ReplicationGroup"])
    ? (input["ReplicationGroup"] as { RegionName: string }[])
    : [];
  const gt: StoredGlobalTable = {
    kind: "global-table",
    GlobalTableName: name,
    ReplicationGroup: replicationGroup,
    CreationDateTime: Math.floor(Date.now() / 1000),
    GlobalTableStatus: "ACTIVE",
  };
  ctx.store.set(globalTableKey(name), gt);
  return { GlobalTableDescription: globalTableDescription(gt) };
};

const DescribeGlobalTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GlobalTableName");
  const gt = requireGlobalTable(ctx, name);
  return { GlobalTableDescription: globalTableDescription(gt) };
};

const DescribeGlobalTableSettings: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GlobalTableName");
  const gt = requireGlobalTable(ctx, name);
  return {
    GlobalTableName: gt.GlobalTableName,
    ReplicaSettings: gt.ReplicationGroup.map((r) => ({
      RegionName: r.RegionName,
      ReplicaStatus: "ACTIVE",
      ReplicaProvisionedReadCapacityUnits: 0,
      ReplicaProvisionedWriteCapacityUnits: 0,
    })),
  };
};

const UpdateGlobalTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GlobalTableName");
  const gt = requireGlobalTable(ctx, name);
  const updates = Array.isArray(input["ReplicaUpdates"])
    ? (input["ReplicaUpdates"] as Record<string, unknown>[])
    : [];
  for (const update of updates) {
    const create = asRecord(update["Create"]);
    const del = asRecord(update["Delete"]);
    if (typeof create["RegionName"] === "string") {
      const region = create["RegionName"];
      if (!gt.ReplicationGroup.some((r) => r.RegionName === region)) {
        gt.ReplicationGroup.push({ RegionName: region });
      }
    } else if (typeof del["RegionName"] === "string") {
      const region = del["RegionName"];
      gt.ReplicationGroup = gt.ReplicationGroup.filter(
        (r) => r.RegionName !== region,
      );
    }
  }
  ctx.store.set(globalTableKey(name), gt);
  return { GlobalTableDescription: globalTableDescription(gt) };
};

const UpdateGlobalTableSettings: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GlobalTableName");
  const gt = requireGlobalTable(ctx, name);
  return {
    GlobalTableName: gt.GlobalTableName,
    ReplicaSettings: gt.ReplicationGroup.map((r) => ({
      RegionName: r.RegionName,
      ReplicaStatus: "ACTIVE",
      ReplicaProvisionedReadCapacityUnits: 0,
      ReplicaProvisionedWriteCapacityUnits: 0,
    })),
  };
};

const ListGlobalTables: OperationHandler = (_input, ctx) => {
  const tables = ctx.store
    .list<StoredGlobalTable>()
    .filter((entry) => isGlobalTableEntry(entry.value))
    .map((entry) => entry.value);
  return {
    GlobalTables: tables.map((gt) => ({
      GlobalTableName: gt.GlobalTableName,
      ReplicationGroup: gt.ReplicationGroup,
    })),
  };
};

const ExportTableToPointInTime: OperationHandler = (input, ctx) => {
  const tArn = requireString(input, "TableArn");
  const tableName = tableNameFromArn(tArn);
  const table = requireTable(ctx, tableName);
  const s3Bucket = requireString(input, "S3Bucket");
  const timestamp = Date.now();
  const arn = exportArn(ctx.region, ctx.account, tableName, timestamp);
  const stored: StoredExport = {
    kind: "export",
    ExportArn: arn,
    ExportStatus: "COMPLETED",
    StartTime: Math.floor(timestamp / 1000),
    EndTime: Math.floor(timestamp / 1000),
    TableArn: tArn,
    TableId: tableIdOf(ctx.region, ctx.account, tableName),
    S3Bucket: s3Bucket,
    S3Prefix: typeof input["S3Prefix"] === "string" ? input["S3Prefix"] : "",
    ExportFormat:
      typeof input["ExportFormat"] === "string"
        ? input["ExportFormat"]
        : "DYNAMODB_JSON",
    ExportType:
      typeof input["ExportType"] === "string"
        ? input["ExportType"]
        : "FULL_EXPORT",
    BilledSizeBytes: 0,
    ItemCount: Object.keys(table.items).length,
  };
  ctx.store.set(exportKey(arn), stored);
  return { ExportDescription: exportDescription(stored) };
};

const DescribeExport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ExportArn");
  const stored = ctx.store.get<StoredExport>(exportKey(arn));
  if (stored === undefined || !isExportEntry(stored)) {
    throw awsError("ExportNotFoundException", `Export not found: ${arn}`, 400);
  }
  return { ExportDescription: exportDescription(stored) };
};

const ListExports: OperationHandler = (input, ctx) => {
  const filterArn = input["TableArn"];
  const exports = ctx.store
    .list<StoredExport>()
    .filter((e) => isExportEntry(e.value))
    .map((e) => e.value)
    .filter((e) => typeof filterArn !== "string" || e.TableArn === filterArn);
  return {
    ExportSummaries: exports.map((e) => ({
      ExportArn: e.ExportArn,
      ExportStatus: e.ExportStatus,
      ExportType: e.ExportType,
    })),
  };
};

const ImportTable: OperationHandler = (input, ctx) => {
  const s3Source = asRecord(input["S3BucketSource"]);
  const tableCreationParams = asRecord(input["TableCreationParameters"]);
  const tableName = requireString(tableCreationParams, "TableName");
  const timestamp = Date.now();
  const arn = importArn(ctx.region, ctx.account, timestamp);
  const attrDefs = Array.isArray(tableCreationParams["AttributeDefinitions"])
    ? (tableCreationParams["AttributeDefinitions"] as AttributeDefinition[])
    : [];
  const keySchema = Array.isArray(tableCreationParams["KeySchema"])
    ? (tableCreationParams["KeySchema"] as KeySchemaElement[])
    : [];
  if (ctx.store.get(tableName) === undefined) {
    const newTable: StoredTable = {
      TableName: tableName,
      AttributeDefinitions: attrDefs,
      KeySchema: keySchema,
      CreationDateTime: Math.floor(timestamp / 1000),
      items: {},
    };
    ctx.store.set(tableName, newTable);
  }
  const tArn = tableArn(ctx.region, ctx.account, tableName);
  const stored: StoredImport = {
    kind: "import",
    ImportArn: arn,
    ImportStatus: "COMPLETED",
    TableArn: tArn,
    TableId: tableIdOf(ctx.region, ctx.account, tableName),
    TableName: tableName,
    S3BucketSource: s3Source,
    InputFormat:
      typeof input["InputFormat"] === "string"
        ? input["InputFormat"]
        : "DYNAMODB_JSON",
    StartTime: Math.floor(timestamp / 1000),
    EndTime: Math.floor(timestamp / 1000),
    ProcessedItemCount: 0,
    ImportedItemCount: 0,
  };
  ctx.store.set(importKey(arn), stored);
  return { ImportTableDescription: importDescription(stored) };
};

const DescribeImport: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ImportArn");
  const stored = ctx.store.get<StoredImport>(importKey(arn));
  if (stored === undefined || !isImportEntry(stored)) {
    throw awsError("ImportNotFoundException", `Import not found: ${arn}`, 400);
  }
  return { ImportTableDescription: importDescription(stored) };
};

const ListImports: OperationHandler = (input, ctx) => {
  const filterArn = input["TableArn"];
  const imports = ctx.store
    .list<StoredImport>()
    .filter((e) => isImportEntry(e.value))
    .map((e) => e.value)
    .filter((i) => typeof filterArn !== "string" || i.TableArn === filterArn);
  return {
    ImportSummaryList: imports.map((i) => ({
      ImportArn: i.ImportArn,
      ImportStatus: i.ImportStatus,
      TableArn: i.TableArn,
      S3BucketSource: i.S3BucketSource,
      InputFormat: i.InputFormat,
      StartTime: i.StartTime,
      EndTime: i.EndTime,
    })),
  };
};

const EnableKinesisStreamingDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const streamArn = requireString(input, "StreamArn");
  requireTable(ctx, name);
  const key = kinesisKey(name);
  const stored: StoredKinesisDestinations =
    ctx.store.get<StoredKinesisDestinations>(key) ?? {
      kind: "kinesis" as const,
      TableName: name,
      destinations: [],
    };
  if (!stored.destinations.some((d) => d.StreamArn === streamArn)) {
    stored.destinations.push({
      StreamArn: streamArn,
      DestinationStatus: "ACTIVE",
    });
    ctx.store.set(key, stored);
  }
  return {
    TableName: name,
    StreamArn: streamArn,
    DestinationStatus: "ENABLING",
    EnableKinesisStreamingConfiguration: asRecord(
      input["EnableKinesisStreamingConfiguration"],
    ),
  };
};

const DisableKinesisStreamingDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const streamArn = requireString(input, "StreamArn");
  requireTable(ctx, name);
  const key = kinesisKey(name);
  const stored = ctx.store.get<StoredKinesisDestinations>(key);
  if (stored !== undefined) {
    stored.destinations = stored.destinations.filter(
      (d) => d.StreamArn !== streamArn,
    );
    ctx.store.set(key, stored);
  }
  return {
    TableName: name,
    StreamArn: streamArn,
    DestinationStatus: "DISABLING",
    EnableKinesisStreamingConfiguration: {},
  };
};

const DescribeKinesisStreamingDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  requireTable(ctx, name);
  const stored = ctx.store.get<StoredKinesisDestinations>(kinesisKey(name));
  return {
    TableName: name,
    KinesisDataStreamDestinations: stored?.destinations ?? [],
  };
};

const UpdateKinesisStreamingDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const streamArn = requireString(input, "StreamArn");
  requireTable(ctx, name);
  const key = kinesisKey(name);
  const stored = ctx.store.get<StoredKinesisDestinations>(key);
  if (stored !== undefined) {
    const dest = stored.destinations.find((d) => d.StreamArn === streamArn);
    if (dest !== undefined) {
      const config = asRecord(input["UpdateKinesisStreamingConfiguration"]);
      if (typeof config["ApproximateCreationDateTimePrecision"] === "string") {
        dest.ApproximateCreationDateTimePrecision =
          config["ApproximateCreationDateTimePrecision"];
      }
      ctx.store.set(key, stored);
    }
  }
  return {
    TableName: name,
    StreamArn: streamArn,
    DestinationStatus: "UPDATING",
    UpdateKinesisStreamingConfiguration: asRecord(
      input["UpdateKinesisStreamingConfiguration"],
    ),
  };
};

const DescribeContributorInsights: OperationHandler = (input, ctx) => {
  const tableName = requireString(input, "TableName");
  const indexName =
    typeof input["IndexName"] === "string" ? input["IndexName"] : undefined;
  requireTable(ctx, tableName);
  const key = contributorInsightsKey(tableName, indexName);
  const stored = ctx.store.get<StoredContributorInsights>(key) ?? {
    kind: "contributor-insights" as const,
    TableName: tableName,
    IndexName: indexName,
    ContributorInsightsStatus: "DISABLED",
    ContributorInsightsMode: "PAY_PER_REQUEST",
  };
  const result: Record<string, unknown> = {
    TableName: stored.TableName,
    ContributorInsightsRuleList: [],
    ContributorInsightsStatus: stored.ContributorInsightsStatus,
    ContributorInsightsMode: stored.ContributorInsightsMode,
  };
  if (indexName !== undefined) result["IndexName"] = indexName;
  return result;
};

const UpdateContributorInsights: OperationHandler = (input, ctx) => {
  const tableName = requireString(input, "TableName");
  const indexName =
    typeof input["IndexName"] === "string" ? input["IndexName"] : undefined;
  const action =
    typeof input["ContributorInsightsAction"] === "string"
      ? input["ContributorInsightsAction"]
      : "DISABLE";
  requireTable(ctx, tableName);
  const key = contributorInsightsKey(tableName, indexName);
  const stored: StoredContributorInsights = {
    kind: "contributor-insights",
    TableName: tableName,
    IndexName: indexName,
    ContributorInsightsStatus: action === "ENABLE" ? "ENABLED" : "DISABLED",
    ContributorInsightsMode: "PAY_PER_REQUEST",
  };
  ctx.store.set(key, stored);
  const result: Record<string, unknown> = {
    TableName: tableName,
    ContributorInsightsStatus: stored.ContributorInsightsStatus,
    ContributorInsightsMode: stored.ContributorInsightsMode,
  };
  if (indexName !== undefined) result["IndexName"] = indexName;
  return result;
};

const ListContributorInsights: OperationHandler = (input, ctx) => {
  const filterTable =
    typeof input["TableName"] === "string" ? input["TableName"] : undefined;
  const entries = ctx.store
    .list<StoredContributorInsights>()
    .filter((e) => isContributorInsightsEntry(e.value))
    .map((e) => e.value)
    .filter((e) => filterTable === undefined || e.TableName === filterTable);
  return {
    ContributorInsightsSummaries: entries.map((e) => ({
      TableName: e.TableName,
      IndexName: e.IndexName,
      ContributorInsightsStatus: e.ContributorInsightsStatus,
      ContributorInsightsMode: e.ContributorInsightsMode,
    })),
  };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const stored = ctx.store.get<StoredResourcePolicy>(
    resourcePolicyKey(resourceArn),
  );
  if (stored === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No resource-based policy found for the resource: ${resourceArn}`,
      400,
    );
  }
  return { Policy: stored.Policy, RevisionId: stored.RevisionId };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const policy = requireString(input, "Policy");
  const revisionId = String(Date.now());
  const stored: StoredResourcePolicy = {
    kind: "resource-policy",
    ResourceArn: resourceArn,
    Policy: policy,
    RevisionId: revisionId,
  };
  ctx.store.set(resourcePolicyKey(resourceArn), stored);
  return { RevisionId: revisionId };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const stored = ctx.store.get<StoredResourcePolicy>(
    resourcePolicyKey(resourceArn),
  );
  const revisionId = stored?.RevisionId ?? "";
  ctx.store.delete(resourcePolicyKey(resourceArn));
  return { RevisionId: revisionId };
};

const RestoreTableFromBackup: OperationHandler = (input, ctx) => {
  const targetName = requireString(input, "TargetTableName");
  const backupArn = requireString(input, "BackupArn");
  const backup = requireBackup(ctx, backupArn);
  if (ctx.store.get(targetName) !== undefined) {
    throw awsError(
      "TableAlreadyExistsException",
      `Table already exists: ${targetName}`,
      400,
    );
  }
  const restored: StoredTable = {
    TableName: targetName,
    AttributeDefinitions: [],
    KeySchema: backup.KeySchema,
    CreationDateTime: Math.floor(Date.now() / 1000),
    items: {},
  };
  ctx.store.set(targetName, restored);
  return { TableDescription: tableDescription(ctx, restored, "ACTIVE") };
};

const RestoreTableToPointInTime: OperationHandler = (input, ctx) => {
  const sourceName = requireString(input, "SourceTableName");
  const targetName = requireString(input, "TargetTableName");
  const source = requireTable(ctx, sourceName);
  if (ctx.store.get(targetName) !== undefined) {
    throw awsError(
      "TableAlreadyExistsException",
      `Table already exists: ${targetName}`,
      400,
    );
  }
  const restored: StoredTable = {
    TableName: targetName,
    AttributeDefinitions: [...source.AttributeDefinitions],
    KeySchema: [...source.KeySchema],
    CreationDateTime: Math.floor(Date.now() / 1000),
    items: { ...source.items },
    globalSecondaryIndexes: source.globalSecondaryIndexes,
    localSecondaryIndexes: source.localSecondaryIndexes,
  };
  ctx.store.set(targetName, restored);
  return { TableDescription: tableDescription(ctx, restored, "ACTIVE") };
};

const DescribeTableReplicaAutoScaling: OperationHandler = (input, ctx) => {
  const tableName = requireString(input, "TableName");
  requireTable(ctx, tableName);
  return {
    TableAutoScalingDescription: {
      TableName: tableName,
      TableStatus: "ACTIVE",
      Replicas: [],
    },
  };
};

const UpdateTableReplicaAutoScaling: OperationHandler = (input, ctx) => {
  const tableName = requireString(input, "TableName");
  requireTable(ctx, tableName);
  return {
    TableAutoScalingDescription: {
      TableName: tableName,
      TableStatus: "ACTIVE",
      Replicas: [],
    },
  };
};

const ExecuteStatement: OperationHandler = (input, ctx) => {
  const statement = requireString(input, "Statement");
  const parameters = Array.isArray(input["Parameters"])
    ? (input["Parameters"] as AttributeValue[])
    : [];
  const items = executePartiQL(statement, parameters, ctx);
  return { Items: items };
};

const BatchExecuteStatement: OperationHandler = (input, ctx) => {
  const statements = Array.isArray(input["Statements"])
    ? (input["Statements"] as Record<string, unknown>[])
    : [];
  const responses: Record<string, unknown>[] = [];
  for (const stmt of statements) {
    const statement =
      typeof stmt["Statement"] === "string" ? stmt["Statement"] : "";
    const parameters = Array.isArray(stmt["Parameters"])
      ? (stmt["Parameters"] as AttributeValue[])
      : [];
    try {
      const items = executePartiQL(statement, parameters, ctx);
      responses.push(items[0] !== undefined ? { Item: items[0] } : {});
    } catch (err) {
      const e = err as Record<string, unknown>;
      responses.push({
        Error: {
          Code: String(e["code"] ?? "InternalServerError"),
          Message: String(e["message"] ?? ""),
        },
      });
    }
  }
  return { Responses: responses };
};

const ExecuteTransaction: OperationHandler = (input, ctx) => {
  const transactStatements = Array.isArray(input["TransactStatements"])
    ? (input["TransactStatements"] as Record<string, unknown>[])
    : [];
  const snapshots = ctx.store
    .list<StoredTable>()
    .filter(
      (entry) =>
        entry.value !== null &&
        typeof entry.value === "object" &&
        typeof entry.value.items === "object" &&
        entry.value.items !== null,
    )
    .map((entry) => ({
      key: entry.key,
      value: { ...entry.value, items: { ...entry.value.items } },
    }));
  const responses: Record<string, unknown>[] = [];
  try {
    for (const stmt of transactStatements) {
      const statement =
        typeof stmt["Statement"] === "string" ? stmt["Statement"] : "";
      const parameters = Array.isArray(stmt["Parameters"])
        ? (stmt["Parameters"] as AttributeValue[])
        : [];
      const items = executePartiQL(statement, parameters, ctx);
      responses.push(items[0] !== undefined ? { Item: items[0] } : {});
    }
  } catch (err) {
    for (const snapshot of snapshots) {
      ctx.store.set(snapshot.key, snapshot.value);
    }
    throw err;
  }
  return { Responses: responses };
};

const isStreamEntry = (value: unknown): value is StoredStream =>
  typeof value === "object" &&
  value !== null &&
  (value as Record<string, unknown>)["kind"] === "stream";

const listStreams = (ctx: ServiceContext): StoredStream[] =>
  ctx.store
    .list<StoredStream>()
    .map((entry) => entry.value)
    .filter(isStreamEntry);

const requireStream = (ctx: ServiceContext, arn: string): StoredStream => {
  const stream = ctx.store.get<StoredStream>(streamKey(arn));
  if (stream === undefined || !isStreamEntry(stream)) {
    throw awsError(
      "ResourceNotFoundException",
      `Requested resource not found: Stream: ${arn} not found`,
      400,
    );
  }
  return stream;
};

const ListStreams: OperationHandler = (input, ctx) => {
  const tableFilter =
    typeof input["TableName"] === "string" ? input["TableName"] : undefined;
  const streams = listStreams(ctx).filter(
    (s) => tableFilter === undefined || s.tableName === tableFilter,
  );
  const limit =
    typeof input["Limit"] === "number" && input["Limit"] > 0
      ? input["Limit"]
      : streams.length;
  const exclusiveStart =
    typeof input["ExclusiveStartStreamArn"] === "string"
      ? input["ExclusiveStartStreamArn"]
      : undefined;
  const startIdx =
    exclusiveStart !== undefined
      ? streams.findIndex((s) => s.streamArn === exclusiveStart) + 1
      : 0;
  const sliced = streams.slice(startIdx, startIdx + limit);
  const result: Record<string, unknown> = {
    Streams: sliced.map((s) => ({
      StreamArn: s.streamArn,
      TableName: s.tableName,
      StreamLabel: s.streamArn.split("/stream/")[1] ?? "",
    })),
  };
  if (sliced.length === limit && startIdx + limit < streams.length) {
    result["LastEvaluatedStreamArn"] =
      sliced[sliced.length - 1]?.streamArn ?? "";
  }
  return result;
};

const DescribeStream: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "StreamArn");
  const stream = requireStream(ctx, arn);
  const label = arn.split("/stream/")[1] ?? "";
  return {
    StreamDescription: {
      StreamArn: stream.streamArn,
      StreamLabel: label,
      StreamStatus: "ENABLED",
      StreamViewType:
        ctx.store.get<StoredTable>(stream.tableName)?.streamSpecification
          ?.StreamViewType ?? "NEW_IMAGE",
      CreationRequestDateTime: Math.floor(Date.now() / 1000),
      TableName: stream.tableName,
      KeySchema: ctx.store.get<StoredTable>(stream.tableName)?.KeySchema ?? [],
      Shards: [
        {
          ShardId: stream.shardId,
          SequenceNumberRange: {
            StartingSequenceNumber: "000000000000000000001",
          },
        },
      ],
    },
  };
};

const GetShardIterator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "StreamArn");
  const shardId = requireString(input, "ShardId");
  const iteratorType =
    typeof input["ShardIteratorType"] === "string"
      ? input["ShardIteratorType"]
      : "TRIM_HORIZON";
  const stream = requireStream(ctx, arn);
  if (stream.shardId !== shardId) {
    throw awsError(
      "ResourceNotFoundException",
      `Shard ${shardId} not found in stream ${arn}`,
      400,
    );
  }
  let position: number;
  if (iteratorType === "TRIM_HORIZON") {
    position = 0;
  } else if (iteratorType === "LATEST") {
    position = stream.records.length;
  } else if (
    iteratorType === "AT_SEQUENCE_NUMBER" ||
    iteratorType === "AFTER_SEQUENCE_NUMBER"
  ) {
    const seqNum =
      typeof input["SequenceNumber"] === "string"
        ? input["SequenceNumber"]
        : "";
    const idx = stream.records.findIndex(
      (r) => r.dynamodb.SequenceNumber === seqNum,
    );
    position =
      idx < 0 ? 0 : iteratorType === "AFTER_SEQUENCE_NUMBER" ? idx + 1 : idx;
  } else {
    position = 0;
  }
  return { ShardIterator: encodeIterator(arn, shardId, position) };
};

const GetRecords: OperationHandler = (input, ctx) => {
  const rawIterator = requireString(input, "ShardIterator");
  const { arn, shard, position } = decodeIterator(rawIterator);
  const stream = requireStream(ctx, arn);
  if (stream.shardId !== shard) {
    throw awsError(
      "ResourceNotFoundException",
      `Shard ${shard} not found in stream ${arn}`,
      400,
    );
  }
  const limit =
    typeof input["Limit"] === "number" && input["Limit"] > 0
      ? input["Limit"]
      : 1000;
  const slice = stream.records.slice(position, position + limit);
  const nextPosition = position + slice.length;
  return {
    Records: slice,
    NextShardIterator: encodeIterator(arn, shard, nextPosition),
    MillisBehindLatest: 0,
  };
};

const dynamodb: ServiceDefinition = {
  name: "dynamodb",
  protocol: "json",
  operations: {
    BatchExecuteStatement,
    BatchGetItem,
    BatchWriteItem,
    CreateBackup,
    CreateGlobalTable,
    CreateTable,
    DeleteBackup,
    DeleteItem,
    DeleteResourcePolicy,
    DeleteTable,
    DescribeBackup,
    DescribeContinuousBackups,
    DescribeContributorInsights,
    DescribeEndpoints,
    DescribeExport,
    DescribeGlobalTable,
    DescribeGlobalTableSettings,
    DescribeImport,
    DescribeKinesisStreamingDestination,
    DescribeLimits,
    DescribeStream,
    DescribeTable,
    DescribeTableReplicaAutoScaling,
    DescribeTimeToLive,
    DisableKinesisStreamingDestination,
    EnableKinesisStreamingDestination,
    ExecuteStatement,
    ExecuteTransaction,
    ExportTableToPointInTime,
    GetItem,
    GetRecords,
    GetResourcePolicy,
    GetShardIterator,
    ImportTable,
    ListBackups,
    ListContributorInsights,
    ListStreams,
    ListExports,
    ListGlobalTables,
    ListImports,
    ListTables,
    ListTagsOfResource,
    PutItem,
    PutResourcePolicy,
    Query,
    RestoreTableFromBackup,
    RestoreTableToPointInTime,
    Scan,
    TagResource,
    TransactGetItems,
    TransactWriteItems,
    UntagResource,
    UpdateContinuousBackups,
    UpdateContributorInsights,
    UpdateGlobalTable,
    UpdateGlobalTableSettings,
    UpdateItem,
    UpdateKinesisStreamingDestination,
    UpdateTable,
    UpdateTableReplicaAutoScaling,
    UpdateTimeToLive,
  },
  model,
} as const;

export default dynamodb;
