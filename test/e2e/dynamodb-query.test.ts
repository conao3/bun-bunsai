import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const seed = async (
  client: DynamoDBClient,
  table: string,
  pk: string,
  skValues: string[],
): Promise<void> => {
  for (const sk of skValues) {
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: pk },
          sk: { S: sk },
          payload: { S: `${pk}#${sk}` },
        },
      }),
    );
  }
};

describe("DynamoDB Query with KeyConditionExpression", () => {
  test("BETWEEN, begins_with, comparators, ScanIndexForward, Limit/ExclusiveStartKey", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-query-sk";
    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );
    await seed(client, table, "user-1", [
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
    ]);
    await seed(client, table, "user-2", ["only"]);

    const eq = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: {
          ":pk": { S: "user-1" },
          ":sk": { S: "alpha" },
        },
      }),
    );
    expect(eq.Count).toBe(1);
    expect(eq.Items?.[0]?.payload?.S).toBe("user-1#alpha");

    const between = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :a AND :b",
        ExpressionAttributeValues: {
          ":pk": { S: "user-1" },
          ":a": { S: "beta" },
          ":b": { S: "epsilon" },
        },
      }),
    );
    const betweenSks = (between.Items ?? []).map((it) => it.sk?.S ?? "");
    expect(betweenSks).toEqual(["beta", "delta", "epsilon"]);

    const beginsWith = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :p)",
        ExpressionAttributeValues: {
          ":pk": { S: "user-1" },
          ":p": { S: "e" },
        },
      }),
    );
    expect((beginsWith.Items ?? []).map((it) => it.sk?.S ?? "")).toEqual([
      "epsilon",
    ]);

    const reversed = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: "user-1" } },
        ScanIndexForward: false,
      }),
    );
    const reversedSks = (reversed.Items ?? []).map((it) => it.sk?.S ?? "");
    expect(reversedSks).toEqual(["gamma", "epsilon", "delta", "beta", "alpha"]);

    const first = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: "user-1" } },
        Limit: 2,
      }),
    );
    expect((first.Items ?? []).map((it) => it.sk?.S ?? "")).toEqual([
      "alpha",
      "beta",
    ]);
    expect(first.LastEvaluatedKey?.sk?.S).toBe("beta");

    const second = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: "user-1" } },
        Limit: 2,
        ExclusiveStartKey: first.LastEvaluatedKey,
      }),
    );
    expect((second.Items ?? []).map((it) => it.sk?.S ?? "")).toEqual([
      "delta",
      "epsilon",
    ]);
    expect(second.LastEvaluatedKey?.sk?.S).toBe("epsilon");

    const tail = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: "user-1" } },
        Limit: 2,
        ExclusiveStartKey: second.LastEvaluatedKey,
      }),
    );
    expect((tail.Items ?? []).map((it) => it.sk?.S ?? "")).toEqual(["gamma"]);
    expect(tail.LastEvaluatedKey).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("Query on GSI with KeyConditionExpression", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-query-gsi";
    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "category", AttributeType: "S" },
          { AttributeName: "score", AttributeType: "N" },
        ],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "by-category",
            KeySchema: [
              { AttributeName: "category", KeyType: "HASH" },
              { AttributeName: "score", KeyType: "RANGE" },
            ],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    for (const [pk, category, score] of [
      ["a", "fruit", "10"],
      ["b", "fruit", "5"],
      ["c", "fruit", "20"],
      ["d", "veggie", "1"],
    ] as const) {
      await client.send(
        new PutItemCommand({
          TableName: table,
          Item: {
            pk: { S: pk },
            category: { S: category },
            score: { N: score },
          },
        }),
      );
    }

    const ascending = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: "by-category",
        KeyConditionExpression: "category = :c AND score >= :min",
        ExpressionAttributeValues: {
          ":c": { S: "fruit" },
          ":min": { N: "10" },
        },
      }),
    );
    expect((ascending.Items ?? []).map((it) => it.score?.N ?? "")).toEqual([
      "10",
      "20",
    ]);

    const descending = await client.send(
      new QueryCommand({
        TableName: table,
        IndexName: "by-category",
        KeyConditionExpression: "category = :c",
        ExpressionAttributeValues: { ":c": { S: "fruit" } },
        ScanIndexForward: false,
      }),
    );
    expect((descending.Items ?? []).map((it) => it.score?.N ?? "")).toEqual([
      "20",
      "10",
      "5",
    ]);

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
