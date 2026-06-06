import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
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
  ddb: DynamoDBClient,
  table: string,
): Promise<void> => {
  await ddb.send(
    new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }),
  );
};

describe("C5 hardening: projection compaction", () => {
  test("ProjectionExpression a[0], a[2] compacts a 4-element list", async () => {
    const ddb = client();
    const table = "c5h-list-compact";
    await createTable(ddb, table);
    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k" },
          a: { L: [{ S: "zero" }, { S: "one" }, { S: "two" }, { S: "three" }] },
        },
      }),
    );
    const got = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k" } },
        ProjectionExpression: "a[0], a[2]",
      }),
    );
    expect(got.Item).toEqual({ a: { L: [{ S: "zero" }, { S: "two" }] } });
  });

  test("ProjectionExpression a.list[1].c compacts to a one-element list", async () => {
    const ddb = client();
    const table = "c5h-nested-compact";
    await createTable(ddb, table);
    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "k" },
          a: {
            M: {
              list: {
                L: [
                  { M: { c: { S: "zero" } } },
                  { M: { c: { S: "one" } } },
                  { M: { c: { S: "two" } } },
                ],
              },
            },
          },
        },
      }),
    );
    const got = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k" } },
        ProjectionExpression: "a.list[1].c",
      }),
    );
    expect(got.Item).toEqual({
      a: { M: { list: { L: [{ M: { c: { S: "one" } } }] } } },
    });
  });
});

describe("C5 hardening: ReturnValues validation", () => {
  test("PutItem ReturnValues=ALL_NEW throws ValidationException", async () => {
    const ddb = client();
    const table = "c5h-put-allnew";
    await createTable(ddb, table);
    await expect(
      ddb.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "k" }, v: { N: "1" } },
          ReturnValues: "ALL_NEW",
        }),
      ),
    ).rejects.toMatchObject({ name: "ValidationException" });
  });

  test("DeleteItem ReturnValues=ALL_NEW throws ValidationException", async () => {
    const ddb = client();
    const table = "c5h-del-allnew";
    await createTable(ddb, table);
    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k" }, v: { N: "1" } },
      }),
    );
    await expect(
      ddb.send(
        new DeleteItemCommand({
          TableName: table,
          Key: { pk: { S: "k" } },
          ReturnValues: "ALL_NEW",
        }),
      ),
    ).rejects.toMatchObject({ name: "ValidationException" });
  });
});

describe("C5 hardening: UPDATED_OLD / UPDATED_NEW empty projection", () => {
  test("REMOVE with UPDATED_NEW omits Attributes", async () => {
    const ddb = client();
    const table = "c5h-remove-new";
    await createTable(ddb, table);
    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k" }, a: { S: "to-remove" }, b: { S: "keep" } },
      }),
    );
    const removed = await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k" } },
        UpdateExpression: "REMOVE a",
        ReturnValues: "UPDATED_NEW",
      }),
    );
    expect(removed.Attributes).toBeUndefined();
  });

  test("SET new attribute with UPDATED_OLD omits Attributes", async () => {
    const ddb = client();
    const table = "c5h-set-old";
    await createTable(ddb, table);
    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k" }, a: { S: "exists" } },
      }),
    );
    const updated = await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k" } },
        UpdateExpression: "SET newAttr = :v",
        ExpressionAttributeValues: { ":v": { S: "fresh" } },
        ReturnValues: "UPDATED_OLD",
      }),
    );
    expect(updated.Attributes).toBeUndefined();
  });
});
