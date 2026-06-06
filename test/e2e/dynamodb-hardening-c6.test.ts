import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const client = () =>
  new DynamoDBClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler,
  });

const createTable = async (
  c: DynamoDBClient,
  table: string,
): Promise<void> => {
  await c.send(
    new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }),
  );
};

describe("DynamoDB TransactWriteItems validation (c6)", () => {
  test("duplicate target keys raise ValidationException and persist nothing", async () => {
    const c = client();
    const table = "bunsai-e2e-ddb-c6-duplicate";
    await createTable(c, table);

    let caught: unknown;
    try {
      await c.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            { Put: { TableName: table, Item: { pk: { S: "dup" }, a: { N: "1" } } } },
            { Put: { TableName: table, Item: { pk: { S: "dup" }, a: { N: "2" } } } },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as Error)?.name).toBe("ValidationException");

    const after = await c.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "dup" } },
        ConsistentRead: true,
      }),
    );
    expect(after.Item).toBeUndefined();

    await c.send(new DeleteTableCommand({ TableName: table }));
  });

  test("empty TransactItems raises ValidationException", async () => {
    const c = client();
    let caught: unknown;
    try {
      await c.send(new TransactWriteItemsCommand({ TransactItems: [] }));
    } catch (error) {
      caught = error;
    }
    expect((caught as Error)?.name).toBe("ValidationException");
  });

  test("ConditionCheck without ConditionExpression raises ValidationException", async () => {
    const c = client();
    const table = "bunsai-e2e-ddb-c6-conditioncheck";
    await createTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, v: { N: "1" } },
      }),
    );

    let caught: unknown;
    try {
      await c.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName: table,
                Key: { pk: { S: "k1" } },
              },
            },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as Error)?.name).toBe("ValidationException");

    await c.send(new DeleteTableCommand({ TableName: table }));
  });

  test("normal multi-item transaction commits atomically", async () => {
    const c = client();
    const table = "bunsai-e2e-ddb-c6-commit";
    await createTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, balance: { N: "100" } },
      }),
    );

    await c.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: table,
              Key: { pk: { S: "k1" } },
              UpdateExpression: "SET balance = balance - :amt",
              ExpressionAttributeValues: { ":amt": { N: "40" } },
            },
          },
          {
            Put: {
              TableName: table,
              Item: { pk: { S: "k2" }, balance: { N: "40" } },
            },
          },
        ],
      }),
    );

    const after1 = await c.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ConsistentRead: true,
      }),
    );
    expect(after1.Item?.balance?.N).toBe("60");
    const after2 = await c.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k2" } },
        ConsistentRead: true,
      }),
    );
    expect(after2.Item?.balance?.N).toBe("40");

    await c.send(new DeleteTableCommand({ TableName: table }));
  });
});
