import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  TransactGetItemsCommand,
  TransactWriteItemsCommand,
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

describe("DynamoDB extra ops e2e", () => {
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
  const table = "bunsai-e2e-ddb-extra";

  test("batch and transact ops", async () => {
    const client = ddb();

    await client.send(
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

    const batchWrite = await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [table]: [
            { PutRequest: { Item: { pk: { S: "a" }, n: { N: "1" } } } },
            { PutRequest: { Item: { pk: { S: "b" }, n: { N: "2" } } } },
            { PutRequest: { Item: { pk: { S: "c" }, n: { N: "3" } } } },
          ],
        },
      }),
    );
    expect(batchWrite.UnprocessedItems).toEqual({});

    const batchGet = await client.send(
      new BatchGetItemCommand({
        RequestItems: {
          [table]: {
            Keys: [{ pk: { S: "a" } }, { pk: { S: "c" } }, { pk: { S: "z" } }],
          },
        },
      }),
    );
    const fetched = batchGet.Responses?.[table] ?? [];
    expect(fetched.length).toBe(2);
    const byPk = new Map(fetched.map((item) => [item.pk?.S, item.n?.N]));
    expect(byPk.get("a")).toBe("1");
    expect(byPk.get("c")).toBe("3");

    await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [table]: [{ DeleteRequest: { Key: { pk: { S: "b" } } } }],
        },
      }),
    );

    const afterDelete = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "b" } } }),
    );
    expect(afterDelete.Item).toBeUndefined();

    await client.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName: table,
              Item: { pk: { S: "t1" }, label: { S: "first" } },
            },
          },
          {
            Put: {
              TableName: table,
              Item: { pk: { S: "t2" }, label: { S: "second" } },
            },
          },
          { Delete: { TableName: table, Key: { pk: { S: "a" } } } },
        ],
      }),
    );

    const gone = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "a" } } }),
    );
    expect(gone.Item).toBeUndefined();

    const transactGet = await client.send(
      new TransactGetItemsCommand({
        TransactItems: [
          { Get: { TableName: table, Key: { pk: { S: "t1" } } } },
          { Get: { TableName: table, Key: { pk: { S: "t2" } } } },
        ],
      }),
    );
    expect(transactGet.Responses?.[0]?.Item?.label?.S).toBe("first");
    expect(transactGet.Responses?.[1]?.Item?.label?.S).toBe("second");

    await expect(
      client.send(
        new TransactWriteItemsCommand({
          TransactItems: [
            {
              Put: {
                TableName: table,
                Item: { pk: { S: "t3" }, label: { S: "third" } },
              },
            },
            {
              Put: {
                TableName: "bunsai-e2e-ddb-missing",
                Item: { pk: { S: "x" } },
              },
            },
          ],
        }),
      ),
    ).rejects.toThrow();

    const notWritten = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "t3" } } }),
    );
    expect(notWritten.Item).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
