import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

describe("DynamoDB FilterExpression with full operator coverage", () => {
  test("comparators, BETWEEN, IN, contains, begins_with, size, attribute_*", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-filter-rich";

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    const items = [
      { pk: "a", score: 10, status: "active", tags: ["red", "blue"] },
      { pk: "b", score: 30, status: "inactive", tags: ["red"] },
      { pk: "c", score: 50, status: "active", tags: ["blue", "green", "red"] },
      { pk: "d", score: 70, status: "archived", tags: ["green"] },
    ];

    for (const item of items) {
      await client.send(
        new PutItemCommand({
          TableName: table,
          Item: {
            pk: { S: item.pk },
            score: { N: String(item.score) },
            status: { S: item.status },
            tags: { SS: item.tags },
          },
        }),
      );
    }

    const between = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "score BETWEEN :lo AND :hi",
        ExpressionAttributeValues: {
          ":lo": { N: "20" },
          ":hi": { N: "60" },
        },
      }),
    );
    const betweenPks = (between.Items ?? []).map((it) => it.pk?.S ?? "").sort();
    expect(betweenPks).toEqual(["b", "c"]);

    const inList = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "#s IN (:a, :b)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":a": { S: "active" },
          ":b": { S: "archived" },
        },
      }),
    );
    expect((inList.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "a",
      "c",
      "d",
    ]);

    const compoundAnd = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "#s = :active AND score > :n",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":active": { S: "active" },
          ":n": { N: "20" },
        },
      }),
    );
    expect(
      (compoundAnd.Items ?? []).map((it) => it.pk?.S ?? "").sort(),
    ).toEqual(["c"]);

    const orAndNot = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "score < :tiny OR (NOT (#s = :a))",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":tiny": { N: "15" },
          ":a": { S: "active" },
        },
      }),
    );
    expect((orAndNot.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "a",
      "b",
      "d",
    ]);

    const containsTag = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "contains(tags, :t)",
        ExpressionAttributeValues: { ":t": { S: "blue" } },
      }),
    );
    expect(
      (containsTag.Items ?? []).map((it) => it.pk?.S ?? "").sort(),
    ).toEqual(["a", "c"]);

    const sized = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "size(tags) >= :n",
        ExpressionAttributeValues: { ":n": { N: "2" } },
      }),
    );
    expect((sized.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "a",
      "c",
    ]);

    const exists = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression:
          "attribute_exists(tags) AND attribute_not_exists(#missing)",
        ExpressionAttributeNames: { "#missing": "missing" },
      }),
    );
    expect((exists.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);

    const beginsWith = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "begins_with(#s, :p)",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":p": { S: "in" } },
      }),
    );
    expect((beginsWith.Items ?? []).map((it) => it.pk?.S ?? "")).toEqual(["b"]);

    const typed = await client.send(
      new ScanCommand({
        TableName: table,
        FilterExpression: "attribute_type(score, :t)",
        ExpressionAttributeValues: { ":t": { S: "N" } },
      }),
    );
    expect((typed.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("Query FilterExpression layered on KeyConditionExpression", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-query-filter";
    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "N" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    for (let i = 1; i <= 5; i++) {
      await client.send(
        new PutItemCommand({
          TableName: table,
          Item: {
            pk: { S: "p" },
            sk: { N: String(i) },
            kind: { S: i % 2 === 0 ? "even" : "odd" },
          },
        }),
      );
    }

    const out = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk AND sk BETWEEN :lo AND :hi",
        FilterExpression: "kind = :k",
        ExpressionAttributeValues: {
          ":pk": { S: "p" },
          ":lo": { N: "2" },
          ":hi": { N: "5" },
          ":k": { S: "even" },
        },
      }),
    );
    expect(out.ScannedCount).toBe(4);
    expect(out.Count).toBe(2);
    expect((out.Items ?? []).map((it) => it.sk?.N ?? "")).toEqual(["2", "4"]);

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
