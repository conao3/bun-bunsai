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
});
