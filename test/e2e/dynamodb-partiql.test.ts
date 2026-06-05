import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

describe("DynamoDB PartiQL WHERE clause", () => {
  test("supports comparators, BETWEEN, IN, AND/OR/NOT through the core evaluator", async () => {
    const client = ddb();
    const table = "bunsai-e2e-ddb-partiql-where";
    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      }),
    );

    for (const [pk, score, status] of [
      ["a", 10, "active"],
      ["b", 30, "inactive"],
      ["c", 50, "active"],
      ["d", 70, "archived"],
    ] as const) {
      await client.send(
        new PutItemCommand({
          TableName: table,
          Item: {
            pk: { S: pk },
            score: { N: String(score) },
            status: { S: status },
          },
        }),
      );
    }

    const between = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE score BETWEEN ? AND ?`,
        Parameters: [{ N: "20" }, { N: "60" }],
      }),
    );
    expect((between.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "b",
      "c",
    ]);

    const inList = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE status IN (?, ?)`,
        Parameters: [{ S: "active" }, { S: "archived" }],
      }),
    );
    expect((inList.Items ?? []).map((it) => it.pk?.S ?? "").sort()).toEqual([
      "a",
      "c",
      "d",
    ]);

    const andCondition = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE status = ? AND score > ?`,
        Parameters: [{ S: "active" }, { N: "20" }],
      }),
    );
    expect((andCondition.Items ?? []).map((it) => it.pk?.S ?? "")).toEqual([
      "c",
    ]);

    const orCondition = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE score < ? OR status = ?`,
        Parameters: [{ N: "15" }, { S: "archived" }],
      }),
    );
    expect(
      (orCondition.Items ?? []).map((it) => it.pk?.S ?? "").sort(),
    ).toEqual(["a", "d"]);

    const notCondition = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE NOT (status = ?)`,
        Parameters: [{ S: "active" }],
      }),
    );
    expect(
      (notCondition.Items ?? []).map((it) => it.pk?.S ?? "").sort(),
    ).toEqual(["b", "d"]);

    const quotedIdent = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE "pk" = ? AND "score" >= ?`,
        Parameters: [{ S: "c" }, { N: "50" }],
      }),
    );
    expect((quotedIdent.Items ?? []).map((it) => it.pk?.S ?? "")).toEqual([
      "c",
    ]);

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
