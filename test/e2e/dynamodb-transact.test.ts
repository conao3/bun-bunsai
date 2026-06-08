import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  TransactionCanceledException,
  TransactGetItemsCommand,
  TransactWriteItemsCommand,
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

describe("DynamoDB TransactWriteItems rollback semantics", () => {
  test("commits all items when every ConditionExpression passes", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-transact-commit";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, version: { N: "1" }, balance: { N: "100" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k2" }, version: { N: "1" }, balance: { N: "50" } },
      }),
    );

    await client.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: table,
              Key: { pk: { S: "k1" } },
              UpdateExpression: "SET balance = balance - :amt",
              ConditionExpression: "version = :v AND balance >= :amt",
              ExpressionAttributeValues: {
                ":v": { N: "1" },
                ":amt": { N: "30" },
              },
            },
          },
          {
            Update: {
              TableName: table,
              Key: { pk: { S: "k2" } },
              UpdateExpression: "SET balance = balance + :amt",
              ExpressionAttributeValues: { ":amt": { N: "30" } },
            },
          },
          {
            Put: {
              TableName: table,
              Item: {
                pk: { S: "log-1" },
                from: { S: "k1" },
                to: { S: "k2" },
                amount: { N: "30" },
              },
            },
          },
        ],
      }),
    );

    const after1 = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ConsistentRead: true,
      }),
    );
    expect(after1.Item?.balance?.N).toBe("70");
    const after2 = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k2" } },
        ConsistentRead: true,
      }),
    );
    expect(after2.Item?.balance?.N).toBe("80");
    const log = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "log-1" } },
        ConsistentRead: true,
      }),
    );
    expect(log.Item?.amount?.N).toBe("30");

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("rolls back all items when one ConditionExpression fails, populates CancellationReasons", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-transact-rollback";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, balance: { N: "10" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k2" }, balance: { N: "100" } },
      }),
    );

    let caught: unknown;
    try {
      await client.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              Update: {
                TableName: table,
                Key: { pk: { S: "k1" } },
                UpdateExpression: "SET balance = balance - :amt",
                ConditionExpression: "balance >= :amt",
                ExpressionAttributeValues: { ":amt": { N: "100" } },
                ReturnValuesOnConditionCheckFailure: "ALL_OLD",
              },
            },
            {
              Put: {
                TableName: table,
                Item: { pk: { S: "k3" }, balance: { N: "999" } },
              },
            },
            {
              ConditionCheck: {
                TableName: table,
                Key: { pk: { S: "k2" } },
                ConditionExpression: "attribute_exists(missing)",
              },
            },
          ],
        }),
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TransactionCanceledException);
    const txError = caught as TransactionCanceledException;
    const reasons = txError.CancellationReasons ?? [];
    expect(reasons.length).toBe(3);
    expect(reasons[0]?.Code).toBe("ConditionalCheckFailed");
    expect(reasons[0]?.Item?.balance?.N).toBe("10");
    expect(reasons[1]?.Code).toBe("None");
    expect(reasons[2]?.Code).toBe("ConditionalCheckFailed");

    const after1 = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ConsistentRead: true,
      }),
    );
    expect(after1.Item?.balance?.N).toBe("10");
    const after3 = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k3" } },
        ConsistentRead: true,
      }),
    );
    expect(after3.Item).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});

describe("DynamoDB TransactGetItems", () => {
  test("returns consistent snapshot including missing items as empty", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-transact-get";
    await createTable(client, table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "x1" }, score: { N: "42" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "x2" }, score: { N: "99" } },
      }),
    );

    const result = await client.send(
      new TransactGetItemsCommand({
        TransactItems: [
          { Get: { TableName: table, Key: { pk: { S: "x1" } } } },
          { Get: { TableName: table, Key: { pk: { S: "x2" } } } },
          { Get: { TableName: table, Key: { pk: { S: "missing" } } } },
        ],
      }),
    );

    expect(result.Responses?.length).toBe(3);
    expect(result.Responses?.[0]?.Item?.score?.N).toBe("42");
    expect(result.Responses?.[1]?.Item?.score?.N).toBe("99");
    expect(result.Responses?.[2]?.Item).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
