import { compareAV, equalsAV } from "../core/expressions/attribute.ts";
import { evaluateCondition } from "../core/expressions/evaluator-condition.ts";
import { resolveKeyCondition } from "../core/expressions/evaluator-key-condition.ts";
import { applyUpdate } from "../core/expressions/evaluator-update.ts";
import { parseConditionExpression } from "../core/expressions/parser-condition.ts";
import { parseKeyConditionExpression } from "../core/expressions/parser-key-condition.ts";
import { parseUpdateExpression } from "../core/expressions/parser-update.ts";
import type { KeyConditionResult } from "../core/expressions/types.ts";
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

type SecondaryIndex = {
  IndexName: string;
  KeySchema: KeySchemaElement[];
  Projection: Record<string, unknown>;
};

type StoredTable = {
  TableName: string;
  AttributeDefinitions: AttributeDefinition[];
  KeySchema: KeySchemaElement[];
  CreationDateTime: number;
  items: Record<string, Item>;
  tags?: StoredTag[];
  ttl?: StoredTtl;
  pointInTimeRecovery?: boolean;
  globalSecondaryIndexes?: SecondaryIndex[];
  localSecondaryIndexes?: SecondaryIndex[];
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

const tableArn = (region: string, account: string, name: string): string =>
  `arn:aws:dynamodb:${region}:${account}:table/${name}`;

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
    ReadCapacityUnits: 0,
    WriteCapacityUnits: 0,
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
      ReadCapacityUnits: 0,
      WriteCapacityUnits: 0,
      NumberOfDecreasesToday: 0,
    },
  };
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
  return description;
};

const asItem = (value: unknown): Item =>
  typeof value === "object" && value !== null ? (value as Item) : ({} as Item);

const ensureConditionPasses = (
  input: Record<string, unknown>,
  current: Item | undefined,
): void => {
  const expression = input["ConditionExpression"];
  if (typeof expression !== "string" || expression === "") return;
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
  const item = current ?? {};
  if (!evaluateCondition(ast, item)) {
    throw awsError(
      "ConditionalCheckFailedException",
      "The conditional request failed",
      400,
    );
  }
};

const parseSecondaryIndexes = (value: unknown): SecondaryIndex[] =>
  (Array.isArray(value) ? (value as Record<string, unknown>[]) : []).map(
    (entry) => ({
      IndexName:
        typeof entry["IndexName"] === "string" ? entry["IndexName"] : "",
      KeySchema: Array.isArray(entry["KeySchema"])
        ? (entry["KeySchema"] as KeySchemaElement[])
        : [],
      Projection:
        typeof entry["Projection"] === "object" && entry["Projection"] !== null
          ? (entry["Projection"] as Record<string, unknown>)
          : { ProjectionType: "ALL" },
    }),
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
  const gsi = parseSecondaryIndexes(input["GlobalSecondaryIndexes"]);
  if (gsi.length > 0) table.globalSecondaryIndexes = gsi;
  const lsi = parseSecondaryIndexes(input["LocalSecondaryIndexes"]);
  if (lsi.length > 0) table.localSecondaryIndexes = lsi;
  ctx.store.set(name, table);
  return { TableDescription: tableDescription(ctx, table, "ACTIVE") };
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
  return { Table: tableDescription(ctx, table, "ACTIVE") };
};

const PutItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const item = asItem(input["Item"]);
  const key = keyOf(table, item);
  const previous = table.items[key];
  ensureConditionPasses(input, previous);
  table.items[key] = item;
  ctx.store.set(name, table);
  return input["ReturnValues"] === "ALL_OLD" && previous !== undefined
    ? { Attributes: previous }
    : {};
};

const GetItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const item = table.items[key];
  return item === undefined ? {} : { Item: item };
};

const DeleteItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const previous = table.items[key];
  ensureConditionPasses(input, previous);
  if (previous !== undefined) {
    delete table.items[key];
    ctx.store.set(name, table);
  }
  return input["ReturnValues"] === "ALL_OLD" && previous !== undefined
    ? { Attributes: previous }
    : {};
};

const resolveName = (names: Record<string, string>, token: string): string =>
  names[token] ?? token;

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

const UpdateItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const previous = table.items[key];
  ensureConditionPasses(input, previous);
  const existing = previous ?? { ...asItem(input["Key"]) };
  let updated: Item;
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
  } else {
    updated = { ...existing };
    const updates = input["AttributeUpdates"];
    if (typeof updates === "object" && updates !== null) {
      for (const [attribute, action] of Object.entries(
        updates as Record<string, Record<string, unknown>>,
      )) {
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
  return input["ReturnValues"] === "ALL_NEW" ? { Attributes: updated } : {};
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
  const comparison = /^\s*(\S+)\s*(=|<>)\s*(\S+)\s*$/.exec(expression);
  if (comparison === null) return true;
  const attribute = resolveName(names, comparison[1]);
  const operator = comparison[2];
  const operand = values[comparison[3]];
  if (operand === undefined) return true;
  const actual = item[attribute];
  const equal = actual !== undefined && scalarOf(actual) === scalarOf(operand);
  return operator === "=" ? equal : !equal;
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
): { hash: string; range?: string } => {
  let hash = "";
  let range: string | undefined;
  for (const element of elements) {
    if (element.KeyType === "HASH") hash = element.AttributeName;
    else if (element.KeyType === "RANGE") range = element.AttributeName;
  }
  return range === undefined ? { hash } : { hash, range };
};

const indexKeySchema = (
  table: StoredTable,
  indexName: string | undefined,
): { hash: string; range?: string } => {
  if (indexName === undefined) return keySchemaShape(table.KeySchema);
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
  return keySchemaShape(index.KeySchema);
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

const Query: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const indexName =
    typeof input["IndexName"] === "string" ? input["IndexName"] : undefined;
  if (indexName !== undefined) requireIndex(table, indexName);
  const schema = indexKeySchema(table, indexName);
  const baseSchema = keySchemaShape(table.KeySchema);
  const expression = input["KeyConditionExpression"];
  let candidates = Object.values(table.items);
  if (indexName !== undefined && schema.range !== undefined) {
    candidates = candidates.filter(
      (item) => item[schema.range as string] !== undefined,
    );
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
        return cmp ?? 0;
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
    const found = matched.findIndex((item) => keysEqual(item, start, schema));
    if (found >= 0) startIndex = found + 1;
  }
  const remainder = matched.slice(startIndex);
  const rawLimit = input["Limit"];
  const limit =
    typeof rawLimit === "number" && rawLimit > 0
      ? Math.min(rawLimit, remainder.length)
      : remainder.length;
  const window = remainder.slice(0, limit);
  const filtered = filterByExpression(window, input);
  const result: Record<string, unknown> = {
    Items: filtered,
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
  const filter =
    typeof input["ScanFilter"] === "object" && input["ScanFilter"] !== null
      ? (input["ScanFilter"] as Record<string, Record<string, unknown>>)
      : {};
  const all = Object.values(table.items);
  const matched = all.filter((item) => matchesKeyConditions(item, filter));
  const items = filterByExpression(matched, input);
  return {
    Items: items,
    Count: items.length,
    ScannedCount: all.length,
  };
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
    table.items[keyOf(table, item)] = item;
    ctx.store.set(name, table);
    return;
  }
  if (del !== undefined) {
    const key = keyFromKeyInput(table, asItem(asRecord(del)["Key"]));
    if (table.items[key] !== undefined) {
      delete table.items[key];
      ctx.store.set(name, table);
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
    const keys = Array.isArray(asRecord(spec)["Keys"])
      ? (asRecord(spec)["Keys"] as Item[])
      : [];
    const found: Item[] = [];
    for (const key of keys) {
      const item = table.items[keyFromKeyInput(table, asItem(key))];
      if (item !== undefined) found.push(item);
    }
    responses[name] = found;
  }
  return { Responses: responses, UnprocessedKeys: {} };
};

const TransactWriteItems: OperationHandler = (input, ctx) => {
  const transactItems = Array.isArray(input["TransactItems"])
    ? (input["TransactItems"] as Record<string, unknown>[])
    : [];
  const snapshots = new Map<string, StoredTable>();
  const tableFor = (name: string): StoredTable => {
    const existing = snapshots.get(name);
    if (existing !== undefined) return existing;
    const table = requireTable(ctx, name);
    snapshots.set(name, {
      ...table,
      items: { ...table.items },
    });
    return snapshots.get(name) as StoredTable;
  };
  for (const entry of transactItems) {
    const item = asRecord(entry);
    const put = item["Put"];
    const del = item["Delete"];
    const update = item["Update"];
    if (put !== undefined) {
      const spec = asRecord(put);
      const table = tableFor(requireString(spec, "TableName"));
      const value = asItem(spec["Item"]);
      table.items[keyOf(table, value)] = value;
    } else if (del !== undefined) {
      const spec = asRecord(del);
      const table = tableFor(requireString(spec, "TableName"));
      delete table.items[keyFromKeyInput(table, asItem(spec["Key"]))];
    } else if (update !== undefined) {
      const spec = asRecord(update);
      const table = tableFor(requireString(spec, "TableName"));
      const key = keyFromKeyInput(table, asItem(spec["Key"]));
      const existing = table.items[key] ?? { ...asItem(spec["Key"]) };
      const values = asRecord(spec["ExpressionAttributeValues"]);
      table.items[key] = { ...existing, ...(values as Item) };
    }
  }
  for (const [name, table] of snapshots) {
    ctx.store.set(name, table);
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
    responses.push(item === undefined ? {} : { Item: item });
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
  let paramIdx = 0;
  const conditions = whereClause.trim().split(/\s+AND\s+/i);
  for (const condition of conditions) {
    const m = /^"?(\w+)"?\s*(=|<>)\s*\?/.exec(condition.trim());
    if (m === null) continue;
    const attrName = m[1];
    const op = m[2];
    const param = params[paramIdx++] ?? {};
    const actual = item[attrName];
    if (actual === undefined) {
      if (op === "=") return false;
      continue;
    }
    const equal = scalarOf(actual) === scalarOf(param);
    if (op === "=" && !equal) return false;
    if (op === "<>" && equal) return false;
  }
  return true;
};

const parsePartiQLValue = (expr: string, params: AttributeValue[]): Item => {
  const item: Item = {};
  let paramIdx = 0;
  const inner = expr.slice(1, -1);
  const pattern = /'([^']+)'\s*:\s*(\?|'[^']*'|-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(inner)) !== null) {
    const fieldName = m[1];
    const valueToken = m[2];
    if (valueToken === "?") {
      const param = params[paramIdx++];
      if (param !== undefined) item[fieldName] = param;
    } else if (valueToken.startsWith("'")) {
      item[fieldName] = { S: valueToken.slice(1, -1) };
    } else {
      item[fieldName] = { N: valueToken };
    }
  }
  return item;
};

const parsePartiQLSets = (
  setClause: string,
  params: AttributeValue[],
): Item => {
  const result: Item = {};
  let paramIdx = 0;
  for (const assignment of setClause.split(",").map((s) => s.trim())) {
    const m = /^"?(\w+)"?\s*=\s*\?/.exec(assignment);
    if (m !== null) {
      const param = params[paramIdx++];
      if (param !== undefined) result[m[1]] = param;
    }
  }
  return result;
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
      table.items[keyOf(table, item)] = item;
      ctx.store.set(tableName, table);
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
    const setValues = parsePartiQLSets(setClause, parameters);
    const whereParams = parameters.slice(setParamCount);
    const allItems = Object.values(table.items);
    const matched =
      whereClause !== undefined
        ? allItems.filter((item) =>
            partiQLWhereMatch(item, whereClause, whereParams),
          )
        : allItems;
    for (const item of matched) {
      const key = keyFromKeyInput(table, item);
      table.items[key] = { ...item, ...setValues };
    }
    if (matched.length > 0) ctx.store.set(tableName, table);
    return matched.map((item) => ({ ...item, ...setValues }));
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
  const responses: Record<string, unknown>[] = [];
  for (const stmt of transactStatements) {
    const statement =
      typeof stmt["Statement"] === "string" ? stmt["Statement"] : "";
    const parameters = Array.isArray(stmt["Parameters"])
      ? (stmt["Parameters"] as AttributeValue[])
      : [];
    const items = executePartiQL(statement, parameters, ctx);
    responses.push(items[0] !== undefined ? { Item: items[0] } : {});
  }
  return { Responses: responses };
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
    DescribeTable,
    DescribeTableReplicaAutoScaling,
    DescribeTimeToLive,
    DisableKinesisStreamingDestination,
    EnableKinesisStreamingDestination,
    ExecuteStatement,
    ExecuteTransaction,
    ExportTableToPointInTime,
    GetItem,
    GetResourcePolicy,
    ImportTable,
    ListBackups,
    ListContributorInsights,
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
