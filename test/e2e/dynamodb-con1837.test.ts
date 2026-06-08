import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchExecuteStatementCommand,
  CreateTableCommand,
  DescribeTimeToLiveCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteTransactionCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const createTable = async (client: DynamoDBClient, name: string) => {
  await client.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
    }),
  );
};

describe("DynamoDB TTL round-trip", () => {
  test("UpdateTimeToLive / DescribeTimeToLive / expiry on read", async () => {
    const client = ddb();
    const table = "con1837-ttl";
    await createTable(client, table);

    const updateRes = await client.send(
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "exp" },
      }),
    );
    expect(updateRes.TimeToLiveSpecification?.Enabled).toBe(true);
    expect(updateRes.TimeToLiveSpecification?.AttributeName).toBe("exp");

    const descRes = await client.send(
      new DescribeTimeToLiveCommand({ TableName: table }),
    );
    expect(descRes.TimeToLiveDescription?.TimeToLiveStatus).toBe("ENABLED");
    expect(descRes.TimeToLiveDescription?.AttributeName).toBe("exp");

    const past = String(Math.floor(Date.now() / 1000) - 60);
    const future = String(Math.floor(Date.now() / 1000) + 3600);
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "alive" }, exp: { N: future } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "gone" }, exp: { N: past } },
      }),
    );

    const getAlive = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "alive" } } }),
    );
    expect(getAlive.Item?.pk?.S).toBe("alive");

    const getGone = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "gone" } } }),
    );
    expect(getGone.Item).toBeUndefined();

    const scan = await client.send(new ScanCommand({ TableName: table }));
    expect((scan.Items ?? []).map((i) => i.pk?.S)).toEqual(["alive"]);

    const query = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :p",
        ExpressionAttributeValues: { ":p": { S: "gone" } },
      }),
    );
    expect(query.Items ?? []).toEqual([]);
  });
});

describe("DynamoDB PartiQL ExecuteStatement", () => {
  test("INSERT then SELECT then UPDATE then DELETE round-trip", async () => {
    const client = ddb();
    const table = "con1837-partiql";
    await createTable(client, table);

    await client.send(
      new ExecuteStatementCommand({
        Statement: `INSERT INTO "${table}" VALUE {'pk': 'r1', 'val': 'hello'}`,
      }),
    );

    const sel = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}" WHERE pk = ?`,
        Parameters: [{ S: "r1" }],
      }),
    );
    expect(sel.Items?.length).toBe(1);
    expect(sel.Items?.[0]?.pk?.S).toBe("r1");
    expect(sel.Items?.[0]?.val?.S).toBe("hello");

    await client.send(
      new ExecuteStatementCommand({
        Statement: `UPDATE "${table}" SET val=? WHERE pk=?`,
        Parameters: [{ S: "world" }, { S: "r1" }],
      }),
    );

    const getUpdated = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "r1" } } }),
    );
    expect(getUpdated.Item?.val?.S).toBe("world");

    await client.send(
      new ExecuteStatementCommand({
        Statement: `DELETE FROM "${table}" WHERE pk=?`,
        Parameters: [{ S: "r1" }],
      }),
    );

    const selAfterDel = await client.send(
      new ExecuteStatementCommand({
        Statement: `SELECT * FROM "${table}"`,
      }),
    );
    expect(selAfterDel.Items ?? []).toEqual([]);
  });

  test("BatchExecuteStatement runs multiple statements", async () => {
    const client = ddb();
    const table = "con1837-batch";
    await createTable(client, table);
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "x" }, v: { N: "1" } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "y" }, v: { N: "2" } },
      }),
    );

    const batch = await client.send(
      new BatchExecuteStatementCommand({
        Statements: [
          {
            Statement: `SELECT * FROM "${table}" WHERE pk=?`,
            Parameters: [{ S: "x" }],
          },
          {
            Statement: `SELECT * FROM "${table}" WHERE pk=?`,
            Parameters: [{ S: "y" }],
          },
        ],
      }),
    );
    expect(batch.Responses?.length).toBe(2);
    expect(batch.Responses?.[0]?.Item?.pk?.S).toBe("x");
    expect(batch.Responses?.[1]?.Item?.pk?.S).toBe("y");
  });

  test("ExecuteTransaction applies atomically and rolls back on error", async () => {
    const client = ddb();
    const table = "con1837-txn";
    await createTable(client, table);

    await client.send(
      new ExecuteTransactionCommand({
        TransactStatements: [
          {
            Statement: `INSERT INTO "${table}" VALUE {'pk': 'a', 'val': '1'}`,
          },
          {
            Statement: `INSERT INTO "${table}" VALUE {'pk': 'b', 'val': '2'}`,
          },
        ],
      }),
    );

    const scanAfter = await client.send(new ScanCommand({ TableName: table }));
    expect((scanAfter.Items ?? []).map((i) => i.pk?.S).sort()).toEqual([
      "a",
      "b",
    ]);

    await expect(
      client.send(
        new ExecuteTransactionCommand({
          TransactStatements: [
            {
              Statement: `INSERT INTO "${table}" VALUE {'pk': 'c', 'val': '3'}`,
            },
            {
              Statement: `INSERT INTO "${table}" VALUE {'pk': 'a', 'val': 'dup'}`,
            },
          ],
        }),
      ),
    ).rejects.toThrow();

    const scanRolledBack = await client.send(
      new ScanCommand({ TableName: table }),
    );
    expect((scanRolledBack.Items ?? []).map((i) => i.pk?.S).sort()).toEqual([
      "a",
      "b",
    ]);
  });
});
