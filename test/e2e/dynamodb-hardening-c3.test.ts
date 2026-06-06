import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const client = () =>
  new DynamoDBClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    requestHandler,
  });

const createStringSkTable = async (
  c: DynamoDBClient,
  table: string,
): Promise<void> => {
  await c.send(
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
};

const createNumericSkTable = async (
  c: DynamoDBClient,
  table: string,
): Promise<void> => {
  await c.send(
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
};

describe("dynamodb hardening c3", () => {
  test("GSI with duplicate index keys paginates through all base items", async () => {
    const c = client();
    const table = "hardening-c3-gsi-dup";
    await c.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "gpk", AttributeType: "S" },
          { AttributeName: "gsk", AttributeType: "S" },
        ],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        GlobalSecondaryIndexes: [
          {
            IndexName: "gsi1",
            KeySchema: [
              { AttributeName: "gpk", KeyType: "HASH" },
              { AttributeName: "gsk", KeyType: "RANGE" },
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
    for (const pk of ["1", "2", "3"]) {
      await c.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: pk }, gpk: { S: "g" }, gsk: { S: "dup" } },
        }),
      );
    }
    const seen: string[] = [];
    let lek: Record<string, unknown> | undefined;
    let pages = 0;
    do {
      const p = await c.send(
        new QueryCommand({
          TableName: table,
          IndexName: "gsi1",
          KeyConditionExpression: "gpk = :g AND gsk = :s",
          ExpressionAttributeValues: { ":g": { S: "g" }, ":s": { S: "dup" } },
          Limit: 1,
          ExclusiveStartKey: lek as never,
        }),
      );
      for (const it of p.Items ?? []) seen.push(it.pk?.S as string);
      lek = p.LastEvaluatedKey as Record<string, unknown> | undefined;
      pages += 1;
    } while (lek !== undefined && pages < 12);
    expect([...seen].sort()).toEqual(["1", "2", "3"]);
    expect(pages).toBe(3);
  });

  test("begins_with on a numeric sort key throws ValidationException", async () => {
    const c = client();
    const table = "hardening-c3-num-beginswith";
    await createNumericSkTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "p" }, sk: { N: "10" } },
      }),
    );
    await expect(
      c.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :pre)",
          ExpressionAttributeValues: { ":pk": { S: "p" }, ":pre": { S: "1" } },
        }),
      ),
    ).rejects.toMatchObject({ name: "ValidationException" });
  });

  test("begins_with with a numeric operand on a string sort key throws ValidationException", async () => {
    const c = client();
    const table = "hardening-c3-beginswith-nval";
    await createStringSkTable(c, table);
    await c.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "p" }, sk: { S: "abc" } },
      }),
    );
    await expect(
      c.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :pre)",
          ExpressionAttributeValues: { ":pk": { S: "p" }, ":pre": { N: "1" } },
        }),
      ),
    ).rejects.toMatchObject({ name: "ValidationException" });
  });

  test("ExclusiveStartKey not in result set resumes positionally", async () => {
    const c = client();
    const table = "hardening-c3-esk-missing";
    await createStringSkTable(c, table);
    for (const s of ["a", "c", "e", "g"]) {
      await c.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: "p" }, sk: { S: s } },
        }),
      );
    }
    const res = await c.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": { S: "p" } },
        ExclusiveStartKey: { pk: { S: "p" }, sk: { S: "d" } },
      }),
    );
    expect((res.Items ?? []).map((i) => i.sk?.S)).toEqual(["e", "g"]);
  });
});
