import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const makeTable = async (ddb: DynamoDBClient, name: string): Promise<void> => {
  await ddb.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }),
  );
};

describe("DynamoDB UpdateExpression hardening (c2)", () => {
  test("SET list[farindex] beyond length appends at the end", async () => {
    const ddb = client();
    const table = "bunsai-c2-list-clamp";
    await makeTable(ddb, table);

    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "a" }, l: { L: [{ N: "1" }] } },
      }),
    );

    await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "a" } },
        UpdateExpression: "SET l[10] = :v",
        ExpressionAttributeValues: { ":v": { N: "9" } },
      }),
    );

    const after = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "a" } },
        ConsistentRead: true,
      }),
    );
    expect(after.Item?.l).toEqual({ L: [{ N: "1" }, { N: "9" }] });

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });

  test("list_append on a non-list operand raises ValidationException", async () => {
    const ddb = client();
    const table = "bunsai-c2-list-append-nonlist";
    await makeTable(ddb, table);

    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "a" }, str: { S: "hi" } },
      }),
    );

    let error: { name?: string; message?: string } | undefined;
    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: table,
          Key: { pk: { S: "a" } },
          UpdateExpression: "SET str = list_append(str, :items)",
          ExpressionAttributeValues: { ":items": { L: [{ N: "1" }] } },
        }),
      );
    } catch (caught) {
      error = caught as { name?: string; message?: string };
    }
    expect(error?.name).toBe("ValidationException");
    expect(error?.message).toBe(
      "Invalid UpdateExpression: Incorrect operand type for operator or function; operator or function: list_append, operand type: S",
    );

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });
});
