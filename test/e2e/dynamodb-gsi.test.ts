import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("DynamoDB GSI/filter/paging e2e", () => {
  const ddb = () =>
    new DynamoDBClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("secondary indexes are stored and described", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-gsi";

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
          { AttributeName: "gsiKey", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "gsi-1",
            KeySchema: [{ AttributeName: "gsiKey", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        LocalSecondaryIndexes: [
          {
            IndexName: "lsi-1",
            KeySchema: [
              { AttributeName: "pk", KeyType: "HASH" },
              { AttributeName: "gsiKey", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "KEYS_ONLY" },
          },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    const described = await client.send(
      new DescribeTableCommand({ TableName: table }),
    );
    const gsi = described.Table?.GlobalSecondaryIndexes ?? [];
    expect(gsi.length).toBe(1);
    expect(gsi[0]?.IndexName).toBe("gsi-1");
    expect(gsi[0]?.IndexArn).toContain("/index/gsi-1");
    const lsi = described.Table?.LocalSecondaryIndexes ?? [];
    expect(lsi.length).toBe(1);
    expect(lsi[0]?.IndexName).toBe("lsi-1");

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("filter expression on Scan and Query", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-filter";

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "a" }, status: { S: "active" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "b" }, status: { S: "inactive" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "c" }, status: { S: "active" } },
      }),
    );

    const scanActive = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "#s = :v",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":v": { S: "active" } },
      }),
    );
    expect(scanActive.Count).toBe(2);
    expect(scanActive.ScannedCount).toBe(3);

    const scanNot = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "#s <> :v",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":v": { S: "active" } },
      }),
    );
    expect(scanNot.Count).toBe(1);
    expect(scanNot.Items?.[0]?.pk?.S).toBe("b");

    const queryFiltered = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditions: {
          pk: {
            ComparisonOperator: "EQ",
            AttributeValueList: [{ S: "a" }],
          },
        },
        FilterExpression: "#s = :v",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":v": { S: "active" } },
      }),
    );
    expect(queryFiltered.Count).toBe(1);
    expect(queryFiltered.Items?.[0]?.pk?.S).toBe("a");

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("ListTables paging with Limit and ExclusiveStartTableName", async () => {
    const client = ddb();
    const names = [
      "bunsai-e2e-page-1",
      "bunsai-e2e-page-2",
      "bunsai-e2e-page-3",
    ];

    for (const name of names) {
      await client.send(
        new CreateTableCommand({
          TableName: name,
          AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
          KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        }),
      );
    }

    const firstPage = await client.send(new ListTablesCommand({ Limit: 2 }));
    expect((firstPage.TableNames ?? []).length).toBe(2);
    expect(firstPage.LastEvaluatedTableName).toBeDefined();

    const secondPage = await client.send(
      new ListTablesCommand({
        Limit: 2,
        ExclusiveStartTableName: firstPage.LastEvaluatedTableName,
      }),
    );
    const firstNames = firstPage.TableNames ?? [];
    const secondNames = secondPage.TableNames ?? [];
    for (const name of secondNames) {
      expect(firstNames).not.toContain(name);
    }

    for (const name of names) {
      await client.send(new DeleteTableCommand({ TableName: name }));
    }
  });

  test("KEYS_ONLY GSI projection and index membership", async () => {
    const client = ddb();
    const table = "bunsai-e2e-gsi-proj";

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
          { AttributeName: "gsiPk", AttributeType: "S" },
          { AttributeName: "gsiSk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "gsi-keys-only",
            KeySchema: [
              { AttributeName: "gsiPk", KeyType: "HASH" },
              { AttributeName: "gsiSk", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "KEYS_ONLY" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "A" },
          sk: { S: "1" },
          gsiPk: { S: "X" },
          gsiSk: { S: "1" },
          extra: { S: "hello" },
        },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "B" },
          sk: { S: "1" },
          gsiPk: { S: "X" },
          gsiSk: { S: "2" },
          extra: { S: "world" },
        },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "C" }, sk: { S: "1" }, extra: { S: "no-gsi-key" } },
      }),
    );

    const result = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: "gsi-keys-only",
        KeyConditionExpression: "gsiPk = :v",
        ExpressionAttributeValues: { ":v": { S: "X" } },
      }),
    );

    expect(result.Count).toBe(2);
    expect(result.ScannedCount).toBe(2);

    const items = result.Items ?? [];
    expect(items.length).toBe(2);

    for (const item of items) {
      expect(item["pk"]).toBeDefined();
      expect(item["sk"]).toBeDefined();
      expect(item["gsiPk"]).toBeDefined();
      expect(item["gsiSk"]).toBeDefined();
      expect(item["extra"]).toBeUndefined();
    }

    const allProjected = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: "gsi-keys-only",
        KeyConditionExpression: "gsiPk = :v",
        ExpressionAttributeValues: { ":v": { S: "X" } },
        Select: "ALL_PROJECTED_ATTRIBUTES",
      }),
    );
    expect(allProjected.Count).toBe(2);
    expect((allProjected.Items ?? [])[0]?.["extra"]).toBeUndefined();

    await expect(
      client.send(
        new QueryCommand({
          TableName: table,
          IndexName: "gsi-keys-only",
          KeyConditionExpression: "gsiPk = :v",
          ExpressionAttributeValues: { ":v": { S: "X" } },
          Select: "ALL_ATTRIBUTES",
        }),
      ),
    ).rejects.toThrow();

    const scanResult = await client.send(
      new ScanCommand({ TableName: table, IndexName: "gsi-keys-only" }),
    );
    expect(scanResult.Count).toBe(2);
    const scanItems = scanResult.Items ?? [];
    for (const item of scanItems) {
      expect(item["extra"]).toBeUndefined();
    }

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("INCLUDE GSI projection returns keys plus NonKeyAttributes", async () => {
    const client = ddb();
    const table = "bunsai-e2e-gsi-include";

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "gsiPk", AttributeType: "S" },
        ],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "gsi-include",
            KeySchema: [{ AttributeName: "gsiPk", KeyType: "HASH" }],
            Projection: {
              ProjectionType: "INCLUDE",
              NonKeyAttributes: ["allowed"],
            },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "A" },
          gsiPk: { S: "Y" },
          allowed: { S: "yes" },
          secret: { S: "no" },
        },
      }),
    );

    const result = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: "gsi-include",
        KeyConditionExpression: "gsiPk = :v",
        ExpressionAttributeValues: { ":v": { S: "Y" } },
      }),
    );
    expect(result.Count).toBe(1);
    const item = (result.Items ?? [])[0] ?? {};
    expect(item["pk"]).toBeDefined();
    expect(item["gsiPk"]).toBeDefined();
    expect(item["allowed"]).toBeDefined();
    expect(item["secret"]).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
