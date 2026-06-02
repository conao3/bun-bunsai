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

type StoredTable = {
  TableName: string;
  AttributeDefinitions: AttributeDefinition[];
  KeySchema: KeySchemaElement[];
  CreationDateTime: number;
  items: Record<string, Item>;
  tags?: StoredTag[];
  ttl?: StoredTtl;
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

const requireTable = (ctx: ServiceContext, name: string): StoredTable => {
  const table = ctx.store.get<StoredTable>(name);
  if (table === undefined) {
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

const tableDescription = (
  ctx: ServiceContext,
  table: StoredTable,
  status: string,
): Record<string, unknown> => ({
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
});

const asItem = (value: unknown): Item =>
  typeof value === "object" && value !== null ? (value as Item) : ({} as Item);

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
  const names = ctx.store
    .list<StoredTable>()
    .map((entry) => entry.value.TableName)
    .sort();
  const exclusive = input["ExclusiveStartTableName"];
  const start =
    typeof exclusive === "string"
      ? names.findIndex((value) => value > exclusive)
      : 0;
  const sliced = start < 0 ? [] : names.slice(start);
  return { TableNames: sliced };
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

const applyUpdateExpression = (
  item: Item,
  expression: string,
  values: Record<string, AttributeValue>,
  names: Record<string, string>,
): void => {
  const clauses = expression
    .split(/\s+(?=SET|ADD|REMOVE|DELETE)\b/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause !== "");
  for (const clause of clauses) {
    const match = /^(SET|ADD|REMOVE|DELETE)\s*(.*)$/is.exec(clause);
    if (match === null) continue;
    const verb = match[1].toUpperCase();
    const body = match[2];
    const parts = body
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    for (const part of parts) {
      if (verb === "SET") {
        const assign = /^(\S+)\s*=\s*(\S+)$/.exec(part);
        if (assign === null) continue;
        const attribute = resolveName(names, assign[1]);
        const operand = values[assign[2]];
        if (operand !== undefined) item[attribute] = operand;
      } else if (verb === "REMOVE") {
        delete item[resolveName(names, part)];
      } else if (verb === "ADD") {
        const tokens = part.split(/\s+/);
        const attribute = resolveName(names, tokens[0]);
        const operand = values[tokens[1]];
        if (operand !== undefined) {
          item[attribute] = applyAddValue(item[attribute], operand);
        }
      } else if (verb === "DELETE") {
        const tokens = part.split(/\s+/);
        const attribute = resolveName(names, tokens[0]);
        const operand = values[tokens[1]];
        const current = item[attribute];
        if (
          operand !== undefined &&
          current !== undefined &&
          Array.isArray(operand["SS"]) &&
          Array.isArray(current["SS"])
        ) {
          const remove = new Set(operand["SS"] as string[]);
          item[attribute] = {
            SS: (current["SS"] as string[]).filter(
              (value) => !remove.has(value),
            ),
          };
        }
      }
    }
  }
};

const UpdateItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const existing = table.items[key] ?? { ...asItem(input["Key"]) };
  const updated: Item = { ...existing };
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
    applyUpdateExpression(updated, expression, values, exprNames);
  } else {
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

const Query: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const conditions =
    typeof input["KeyConditions"] === "object" &&
    input["KeyConditions"] !== null
      ? (input["KeyConditions"] as Record<string, Record<string, unknown>>)
      : {};
  const items = Object.values(table.items).filter((item) =>
    matchesKeyConditions(item, conditions),
  );
  return { Items: items, Count: items.length, ScannedCount: items.length };
};

const Scan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const filter =
    typeof input["ScanFilter"] === "object" && input["ScanFilter"] !== null
      ? (input["ScanFilter"] as Record<string, Record<string, unknown>>)
      : {};
  const all = Object.values(table.items);
  const items = all.filter((item) => matchesKeyConditions(item, filter));
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

const dynamodb: ServiceDefinition = {
  name: "dynamodb",
  protocol: "json",
  operations: {
    CreateTable,
    DeleteTable,
    ListTables,
    DescribeTable,
    UpdateTable,
    UpdateTimeToLive,
    DescribeTimeToLive,
    TagResource,
    UntagResource,
    ListTagsOfResource,
    PutItem,
    GetItem,
    DeleteItem,
    UpdateItem,
    Query,
    Scan,
    BatchWriteItem,
    BatchGetItem,
    TransactWriteItems,
    TransactGetItems,
  },
  model,
} as const;

export default dynamodb;
