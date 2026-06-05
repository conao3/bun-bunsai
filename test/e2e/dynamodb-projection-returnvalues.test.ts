import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetItemCommand,
  CreateTableCommand,
  DeleteItemCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const createTable = async (
  client: DynamoDBClient,
  table: string,
): Promise<void> => {
  await client.send(
    new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }),
  );
};

describe("DynamoDB ProjectionExpression", () => {
  test("GetItem / Query / Scan / BatchGetItem honour projection paths", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-projection";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k1" },
          name: { S: "Alice" },
          email: { S: "alice@example.com" },
          profile: {
            M: { age: { N: "30" }, city: { S: "Tokyo" } },
          },
          secret: { S: "do-not-leak" },
        },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k2" },
          name: { S: "Bob" },
          email: { S: "bob@example.com" },
          secret: { S: "also-secret" },
        },
      }),
    );

    const got = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ProjectionExpression: "#n, profile.city",
        ExpressionAttributeNames: { "#n": "name" },
      }),
    );
    expect(got.Item).toEqual({
      name: { S: "Alice" },
      profile: { M: { city: { S: "Tokyo" } } },
    });

    const scanned = await client.send(
      new ScanCommand({
        TableName: table,
        ProjectionExpression: "pk, #n",
        ExpressionAttributeNames: { "#n": "name" },
      }),
    );
    const scanResults = (scanned.Items ?? [])
      .map((it) => `${it.pk?.S}=${it.name?.S}`)
      .sort();
    expect(scanResults).toEqual(["k1=Alice", "k2=Bob"]);
    for (const item of scanned.Items ?? []) {
      expect(item.secret).toBeUndefined();
      expect(item.email).toBeUndefined();
    }

    const queried = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ProjectionExpression: "email",
        ExpressionAttributeValues: { ":pk": { S: "k2" } },
      }),
    );
    expect(queried.Items).toEqual([{ email: { S: "bob@example.com" } }]);

    const batched = await client.send(
      new BatchGetItemCommand({
        RequestItems: {
          [table]: {
            Keys: [{ pk: { S: "k1" } }, { pk: { S: "k2" } }],
            ProjectionExpression: "pk",
          },
        },
      }),
    );
    const batchedPks = (batched.Responses?.[table] ?? [])
      .map((it) => it.pk?.S ?? "")
      .sort();
    expect(batchedPks).toEqual(["k1", "k2"]);
    for (const item of batched.Responses?.[table] ?? []) {
      expect(Object.keys(item)).toEqual(["pk"]);
    }

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});

describe("DynamoDB UpdateItem ReturnValues variants", () => {
  test("ALL_OLD / ALL_NEW / UPDATED_OLD / UPDATED_NEW / NONE", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-return-values";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k1" },
          a: { S: "old-a" },
          b: { S: "old-b" },
          c: { S: "untouched" },
        },
      }),
    );

    const allOld = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET a = :a",
        ExpressionAttributeValues: { ":a": { S: "new-a-1" } },
        ReturnValues: "ALL_OLD",
      }),
    );
    expect(allOld.Attributes).toEqual({
      pk: { S: "k1" },
      a: { S: "old-a" },
      b: { S: "old-b" },
      c: { S: "untouched" },
    });

    const updatedNew = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET a = :a, b = :b",
        ExpressionAttributeValues: {
          ":a": { S: "new-a-2" },
          ":b": { S: "new-b" },
        },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    expect(updatedNew.Attributes).toEqual({
      a: { S: "new-a-2" },
      b: { S: "new-b" },
    });
    expect(updatedNew.Attributes?.c).toBeUndefined();

    const updatedOld = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET a = :v",
        ExpressionAttributeValues: { ":v": { S: "new-a-3" } },
        ReturnValues: "UPDATED_OLD",
      }),
    );
    expect(updatedOld.Attributes).toEqual({ a: { S: "new-a-2" } });

    const allNew = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET a = :v",
        ExpressionAttributeValues: { ":v": { S: "new-a-4" } },
        ReturnValues: "ALL_NEW",
      }),
    );
    expect(allNew.Attributes?.a).toEqual({ S: "new-a-4" });
    expect(allNew.Attributes?.c).toEqual({ S: "untouched" });

    const noResp = await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET a = :v",
        ExpressionAttributeValues: { ":v": { S: "final" } },
        ReturnValues: "NONE",
      }),
    );
    expect(noResp.Attributes).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("PutItem ALL_OLD and DeleteItem ALL_OLD", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-put-delete-old";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, version: { N: "1" } },
      }),
    );
    const putOld = await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, version: { N: "2" } },
        ReturnValues: "ALL_OLD",
      }),
    );
    expect(putOld.Attributes).toEqual({
      pk: { S: "k1" },
      version: { N: "1" },
    });

    const delOld = await client.send(
      new DeleteItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ReturnValues: "ALL_OLD",
      }),
    );
    expect(delOld.Attributes).toEqual({
      pk: { S: "k1" },
      version: { N: "2" },
    });

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
