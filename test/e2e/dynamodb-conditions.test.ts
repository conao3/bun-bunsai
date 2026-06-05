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

describe("DynamoDB ConditionExpression integration", () => {
  const table = "bunsai-e2e-ddb-conditions";

  test("ConditionExpression on PutItem / UpdateItem / DeleteItem", async () => {
    const ddb = client();

    await ddb.send(
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

    await ddb.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" }, version: { N: "1" } },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );

    let duplicateError: unknown;
    try {
      await ddb.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "k1" }, version: { N: "2" } },
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
    } catch (caught) {
      duplicateError = caught;
    }
    expect(duplicateError).toBeInstanceOf(ConditionalCheckFailedException);

    const stillFirstVersion = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ConsistentRead: true,
      }),
    );
    expect(stillFirstVersion.Item?.version?.N).toBe("1");

    await ddb.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET version = :next",
        ConditionExpression: "version = :current",
        ExpressionAttributeValues: {
          ":next": { N: "2" },
          ":current": { N: "1" },
        },
      }),
    );

    let staleError: unknown;
    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: table,
          Key: { pk: { S: "k1" } },
          UpdateExpression: "SET version = :next",
          ConditionExpression: "version = :current",
          ExpressionAttributeValues: {
            ":next": { N: "3" },
            ":current": { N: "1" },
          },
        }),
      );
    } catch (caught) {
      staleError = caught;
    }
    expect(staleError).toBeInstanceOf(ConditionalCheckFailedException);

    let earlyDeleteError: unknown;
    try {
      await ddb.send(
        new DeleteItemCommand({
          TableName: table,
          Key: { pk: { S: "k1" } },
          ConditionExpression: "version = :v",
          ExpressionAttributeValues: { ":v": { N: "99" } },
        }),
      );
    } catch (caught) {
      earlyDeleteError = caught;
    }
    expect(earlyDeleteError).toBeInstanceOf(ConditionalCheckFailedException);

    await ddb.send(
      new DeleteItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ConditionExpression: "version = :v",
        ExpressionAttributeValues: { ":v": { N: "2" } },
      }),
    );

    const gone = await ddb.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "k1" } },
        ConsistentRead: true,
      }),
    );
    expect(gone.Item).toBeUndefined();

    await ddb.send(new DeleteTableCommand({ TableName: table }));
  });

  test("ConditionExpression with size, BETWEEN, AND/OR", async () => {
    const ddb = client();
    const tableName = `${table}-rich`;

    await ddb.send(
      new CreateTableCommand({
        TableName: tableName,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    await ddb.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          pk: { S: "k1" },
          score: { N: "50" },
          tags: { SS: ["alpha", "beta", "gamma"] },
        },
      }),
    );

    await ddb.send(
      new UpdateItemCommand({
        TableName: tableName,
        Key: { pk: { S: "k1" } },
        UpdateExpression: "SET label = :v",
        ConditionExpression: "score BETWEEN :lo AND :hi AND size(tags) > :n",
        ExpressionAttributeValues: {
          ":v": { S: "ok" },
          ":lo": { N: "10" },
          ":hi": { N: "100" },
          ":n": { N: "2" },
        },
      }),
    );

    const after = await ddb.send(
      new GetItemCommand({
        TableName: tableName,
        Key: { pk: { S: "k1" } },
        ConsistentRead: true,
      }),
    );
    expect(after.Item?.label?.S).toBe("ok");

    let outOfRange: unknown;
    try {
      await ddb.send(
        new UpdateItemCommand({
          TableName: tableName,
          Key: { pk: { S: "k1" } },
          UpdateExpression: "SET label = :v",
          ConditionExpression: "score < :tiny OR contains(tags, :missing)",
          ExpressionAttributeValues: {
            ":v": { S: "no" },
            ":tiny": { N: "1" },
            ":missing": { S: "delta" },
          },
        }),
      );
    } catch (caught) {
      outOfRange = caught;
    }
    expect(outOfRange).toBeInstanceOf(ConditionalCheckFailedException);

    await ddb.send(new DeleteTableCommand({ TableName: tableName }));
  });
});
