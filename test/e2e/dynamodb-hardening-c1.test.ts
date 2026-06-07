import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConditionalCheckFailedException,
  CreateTableCommand,
  DeleteItemCommand,
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

describe("DynamoDB conditional write hardening (c1)", () => {
  test("ReturnValuesOnConditionCheckFailure=ALL_OLD carries the existing item", async () => {
    const ddb = client();
    const table = "bunsai-c1-allold";
    await makeTable(ddb, table);

    const stored = { pk: { S: "x" }, version: { N: "1" }, name: { S: "orig" } };
    await ddb.send(new PutItemCommand({ TableName: table, Item: stored }));

    let putError: ConditionalCheckFailedException | undefined;
    try {
      await ddb.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "x" }, version: { N: "2" } },
          ConditionExpression: "attribute_not_exists(pk)",
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        }),
      );
    } catch (caught) {
      putError = caught as ConditionalCheckFailedException;
    }
    expect(putError).toBeInstanceOf(ConditionalCheckFailedException);
    expect(putError?.Item).toEqual(stored);

    let updateError: ConditionalCheckFailedException | undefined;
    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: table,
          Key: { pk: { S: "x" } },
          UpdateExpression: "SET version = :v",
          ConditionExpression: "version = :wrong",
          ExpressionAttributeValues: {
            ":v": { N: "9" },
            ":wrong": { N: "5" },
          },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        }),
      );
    } catch (caught) {
      updateError = caught as ConditionalCheckFailedException;
    }
    expect(updateError).toBeInstanceOf(ConditionalCheckFailedException);
    expect(updateError?.Item).toEqual(stored);

    let deleteError: ConditionalCheckFailedException | undefined;
    try {
      await ddb.send(
        new DeleteItemCommand({
          TableName: table,
          Key: { pk: { S: "x" } },
          ConditionExpression: "version = :wrong",
          ExpressionAttributeValues: { ":wrong": { N: "5" } },
          ReturnValuesOnConditionCheckFailure: "ALL_OLD",
        }),
      );
    } catch (caught) {
      deleteError = caught as ConditionalCheckFailedException;
    }
    expect(deleteError).toBeInstanceOf(ConditionalCheckFailedException);
    expect(deleteError?.Item).toEqual(stored);

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });

  test("failed conditional write without the ALL_OLD flag omits the item", async () => {
    const ddb = client();
    const table = "bunsai-c1-noitem";
    await makeTable(ddb, table);

    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "x" }, version: { N: "1" } },
      }),
    );

    let error: ConditionalCheckFailedException | undefined;
    try {
      await ddb.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "x" }, version: { N: "2" } },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
    } catch (caught) {
      error = caught as ConditionalCheckFailedException;
    }
    expect(error).toBeInstanceOf(ConditionalCheckFailedException);
    expect(error?.Item).toBeUndefined();

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });

  test("legacy Expected={pk:{Exists:false}} on an existing key throws", async () => {
    const ddb = client();
    const table = "bunsai-c1-expected-exists";
    await makeTable(ddb, table);

    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "lk" }, version: { N: "1" } },
        Expected: { pk: { Exists: false } },
      }),
    );

    let error: unknown;
    try {
      await ddb.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "lk" }, version: { N: "2" } },
          Expected: { pk: { Exists: false } },
        }),
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConditionalCheckFailedException);

    const after = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "lk" } },
        ConsistentRead: true,
      }),
    );
    expect(after.Item?.version?.N).toBe("1");

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });

  test("legacy Expected with Value+EQ mismatch throws", async () => {
    const ddb = client();
    const table = "bunsai-c1-expected-value";
    await makeTable(ddb, table);

    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "lk" }, version: { N: "1" } },
      }),
    );

    let error: unknown;
    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: table,
          Key: { pk: { S: "lk" } },
          UpdateExpression: "SET #n = :nm",
          ExpressionAttributeNames: { "#n": "name" },
          ExpressionAttributeValues: { ":nm": { S: "new" } },
          Expected: {
            version: { Value: { N: "99" }, ComparisonOperator: "EQ" },
          },
        }),
      );
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ConditionalCheckFailedException);

    await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "lk" } },
        UpdateExpression: "SET #n = :nm",
        ExpressionAttributeNames: { "#n": "name" },
        ExpressionAttributeValues: { ":nm": { S: "new" } },
        Expected: {
          version: { Value: { N: "1" }, ComparisonOperator: "EQ" },
        },
      }),
    );

    const after = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "lk" } },
        ConsistentRead: true,
      }),
    );
    expect(after.Item?.name?.S).toBe("new");

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });
});
