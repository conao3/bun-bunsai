import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateTableCommand,
  DeleteItemCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  GetItemCommand,
  ListTablesCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("DynamoDB e2e", () => {
  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const ddb = () => new DynamoDBClient({ endpoint, region, credentials });
  const table = "bunsai-e2e-ddb";

  test("table and item lifecycle", async () => {
    const client = ddb();

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
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }),
    );

    const described = await client.send(
      new DescribeTableCommand({ TableName: table }),
    );
    expect(described.Table?.TableName).toBe(table);
    expect(described.Table?.KeySchema?.length).toBe(2);

    const listed = await client.send(new ListTablesCommand({}));
    expect(listed.TableNames ?? []).toContain(table);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "user-1" },
          sk: { N: "1" },
          name: { S: "alice" },
          active: { BOOL: true },
          tags: { SS: ["a", "b"] },
        },
      }),
    );

    const got = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "user-1" }, sk: { N: "1" } },
      }),
    );
    expect(got.Item?.name?.S).toBe("alice");
    expect(got.Item?.active?.BOOL).toBe(true);
    expect(got.Item?.tags?.SS).toEqual(["a", "b"]);

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "user-1" }, sk: { N: "1" } },
        AttributeUpdates: {
          name: { Action: "PUT", Value: { S: "alice-updated" } },
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    const afterUpdate = await client.send(
      new GetItemCommand({
        TableName: table,
        Key: { pk: { S: "user-1" }, sk: { N: "1" } },
      }),
    );
    expect(afterUpdate.Item?.name?.S).toBe("alice-updated");

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: {
          pk: { S: "user-2" },
          sk: { N: "1" },
          name: { S: "bob" },
        },
      }),
    );

    const queried = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditions: {
          pk: {
            ComparisonOperator: "EQ",
            AttributeValueList: [{ S: "user-1" }],
          },
        },
      }),
    );
    expect(queried.Count).toBe(1);
    expect(queried.Items?.[0]?.name?.S).toBe("alice-updated");

    const scanned = await client.send(new ScanCommand({ TableName: table }));
    expect(scanned.Count).toBe(2);
    expect(scanned.ScannedCount).toBe(2);

    await client.send(
      new DeleteItemCommand({
        TableName: table,
        Key: { pk: { S: "user-2" }, sk: { N: "1" } },
      }),
    );

    const afterDelete = await client.send(
      new ScanCommand({ TableName: table }),
    );
    expect(afterDelete.Count).toBe(1);

    await client.send(new DeleteTableCommand({ TableName: table }));

    const listedAfter = await client.send(new ListTablesCommand({}));
    expect(listedAfter.TableNames ?? []).not.toContain(table);
  });
});
