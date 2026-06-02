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

type StoredTable = {
  TableName: string;
  AttributeDefinitions: AttributeDefinition[];
  KeySchema: KeySchemaElement[];
  CreationDateTime: number;
  items: Record<string, Item>;
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

const UpdateItem: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TableName");
  const table = requireTable(ctx, name);
  const key = keyFromKeyInput(table, asItem(input["Key"]));
  const existing = table.items[key] ?? { ...asItem(input["Key"]) };
  const updated: Item = { ...existing };
  const updates = input["AttributeUpdates"];
  if (typeof updates === "object" && updates !== null) {
    for (const [attribute, action] of Object.entries(
      updates as Record<string, Record<string, unknown>>,
    )) {
      const operation = action["Action"];
      if (operation === "DELETE") {
        delete updated[attribute];
      } else {
        const value = action["Value"];
        if (typeof value === "object" && value !== null) {
          updated[attribute] = value as AttributeValue;
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

const dynamodb: ServiceDefinition = {
  name: "dynamodb",
  protocol: "json",
  operations: {
    CreateTable,
    DeleteTable,
    ListTables,
    DescribeTable,
    PutItem,
    GetItem,
    DeleteItem,
    UpdateItem,
    Query,
    Scan,
  },
  model,
} as const;

export default dynamodb;
