import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DynamoDBClient,
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

describe("DynamoDB scan pagination and TTL", () => {
  test("Scan paginates with Limit / ExclusiveStartKey / LastEvaluatedKey", async () => {
    const client = ddb();
    const table = "ddb-scan-page";
    await createTable(client, table);
    for (let i = 0; i < 5; i += 1) {
      await client.send(
        new PutItemCommand({
          TableName: table,
          Item: { pk: { S: `item-${i}` } },
        }),
      );
    }

    const seen: string[] = [];
    let startKey: Record<string, unknown> | undefined;
    let pages = 0;
    do {
      const page = await client.send(
        new ScanCommand({
          TableName: table,
          Limit: 2,
          ExclusiveStartKey: startKey as never,
        }),
      );
      for (const item of page.Items ?? []) seen.push(item.pk?.S ?? "");
      startKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
      pages += 1;
    } while (startKey !== undefined && pages < 10);

    expect(pages).toBe(3);
    expect(seen.sort()).toEqual([
      "item-0",
      "item-1",
      "item-2",
      "item-3",
      "item-4",
    ]);
  });

  test("expired items are hidden from GetItem, Query, and Scan", async () => {
    const client = ddb();
    const table = "ddb-ttl";
    await createTable(client, table);
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "expiresAt" },
      }),
    );

    const past = String(Math.floor(Date.now() / 1000) - 60);
    const future = String(Math.floor(Date.now() / 1000) + 3600);
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "live" }, expiresAt: { N: future } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "dead" }, expiresAt: { N: past } },
      }),
    );

    const live = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "live" } } }),
    );
    expect(live.Item?.pk?.S).toBe("live");

    const dead = await client.send(
      new GetItemCommand({ TableName: table, Key: { pk: { S: "dead" } } }),
    );
    expect(dead.Item).toBeUndefined();

    const scanned = await client.send(new ScanCommand({ TableName: table }));
    expect((scanned.Items ?? []).map((i) => i.pk?.S)).toEqual(["live"]);

    const queried = await client.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :p",
        ExpressionAttributeValues: { ":p": { S: "dead" } },
      }),
    );
    expect(queried.Items ?? []).toEqual([]);
  });
});
