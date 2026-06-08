import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  CreateTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteTransactionCommand,
  PutItemCommand,
  TransactGetItemsCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DescribeStreamCommand,
  DynamoDBStreamsClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
} from "@aws-sdk/client-dynamodb-streams";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });
const streamsClient = () =>
  new DynamoDBStreamsClient({ endpoint, region, credentials, requestHandler });

const createTable = async (
  client: DynamoDBClient,
  name: string,
  withStream = false,
) => {
  const resp = await client.send(
    new CreateTableCommand({
      TableName: name,
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
      KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
      BillingMode: "PAY_PER_REQUEST",
      ...(withStream
        ? {
            StreamSpecification: {
              StreamEnabled: true,
              StreamViewType: "NEW_AND_OLD_IMAGES",
            },
          }
        : {}),
    }),
  );
  return resp.TableDescription?.LatestStreamArn ?? "";
};

const getStreamRecords = async (streamArn: string) => {
  const sc = streamsClient();
  const desc = await sc.send(
    new DescribeStreamCommand({ StreamArn: streamArn }),
  );
  const shardId = desc.StreamDescription?.Shards?.[0]?.ShardId ?? "";
  const iter = await sc.send(
    new GetShardIteratorCommand({
      StreamArn: streamArn,
      ShardId: shardId,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );
  const resp = await sc.send(
    new GetRecordsCommand({ ShardIterator: iter.ShardIterator }),
  );
  return resp.Records ?? [];
};

describe("CON-1863: BatchWriteItem stream records", () => {
  test("BatchWriteItem PutRequest emits INSERT/MODIFY, DeleteRequest emits REMOVE", async () => {
    const client = ddb();
    const table = "con1863-batchwrite";
    const streamArn = await createTable(client, table, true);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "existing" }, v: { S: "old" } },
      }),
    );

    await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [table]: [
            {
              PutRequest: { Item: { pk: { S: "brand-new" }, v: { S: "v1" } } },
            },
            {
              PutRequest: {
                Item: { pk: { S: "existing" }, v: { S: "updated" } },
              },
            },
          ],
        },
      }),
    );

    await client.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [table]: [{ DeleteRequest: { Key: { pk: { S: "existing" } } } }],
        },
      }),
    );

    const records = await getStreamRecords(streamArn);

    const insertViaInitialPut = records.find(
      (r) =>
        r.eventName === "INSERT" &&
        r.dynamodb?.NewImage?.["pk"]?.S === "existing",
    );
    expect(insertViaInitialPut).toBeDefined();

    const insertViaBatch = records.find(
      (r) =>
        r.eventName === "INSERT" &&
        r.dynamodb?.NewImage?.["pk"]?.S === "brand-new",
    );
    expect(insertViaBatch).toBeDefined();
    expect(insertViaBatch?.dynamodb?.OldImage).toBeUndefined();

    const modifyViaBatch = records.find(
      (r) =>
        r.eventName === "MODIFY" &&
        r.dynamodb?.NewImage?.["pk"]?.S === "existing",
    );
    expect(modifyViaBatch).toBeDefined();
    expect(modifyViaBatch?.dynamodb?.OldImage?.["v"]?.S).toBe("old");
    expect(modifyViaBatch?.dynamodb?.NewImage?.["v"]?.S).toBe("updated");

    const removeViaBatch = records.find(
      (r) =>
        r.eventName === "REMOVE" &&
        r.dynamodb?.OldImage?.["pk"]?.S === "existing",
    );
    expect(removeViaBatch).toBeDefined();
    expect(removeViaBatch?.dynamodb?.NewImage).toBeUndefined();
  });
});

describe("CON-1863: PartiQL stream records", () => {
  test("ExecuteStatement INSERT/UPDATE/DELETE emit stream records", async () => {
    const client = ddb();
    const table = "con1863-partiql-streams";
    const streamArn = await createTable(client, table, true);

    await client.send(
      new ExecuteStatementCommand({
        Statement: `INSERT INTO "${table}" VALUE {'pk': 'p1', 'val': 'hello'}`,
      }),
    );
    await client.send(
      new ExecuteStatementCommand({
        Statement: `UPDATE "${table}" SET val=? WHERE pk=?`,
        Parameters: [{ S: "world" }, { S: "p1" }],
      }),
    );
    await client.send(
      new ExecuteStatementCommand({
        Statement: `DELETE FROM "${table}" WHERE pk=?`,
        Parameters: [{ S: "p1" }],
      }),
    );

    const records = await getStreamRecords(streamArn);
    expect(records).toHaveLength(3);

    expect(records[0]?.eventName).toBe("INSERT");
    expect(records[0]?.dynamodb?.NewImage?.["pk"]?.S).toBe("p1");
    expect(records[0]?.dynamodb?.OldImage).toBeUndefined();

    expect(records[1]?.eventName).toBe("MODIFY");
    expect(records[1]?.dynamodb?.NewImage?.["val"]?.S).toBe("world");
    expect(records[1]?.dynamodb?.OldImage?.["val"]?.S).toBe("hello");

    expect(records[2]?.eventName).toBe("REMOVE");
    expect(records[2]?.dynamodb?.OldImage?.["pk"]?.S).toBe("p1");
    expect(records[2]?.dynamodb?.NewImage).toBeUndefined();
  });

  test("ExecuteTransaction INSERT/UPDATE/DELETE emit stream records", async () => {
    const client = ddb();
    const table = "con1863-partiql-txn";
    const streamArn = await createTable(client, table, true);

    await client.send(
      new ExecuteTransactionCommand({
        TransactStatements: [
          { Statement: `INSERT INTO "${table}" VALUE {'pk': 'tx1', 'v': 'a'}` },
          { Statement: `INSERT INTO "${table}" VALUE {'pk': 'tx2', 'v': 'b'}` },
        ],
      }),
    );
    await client.send(
      new ExecuteTransactionCommand({
        TransactStatements: [
          {
            Statement: `UPDATE "${table}" SET v=? WHERE pk=?`,
            Parameters: [{ S: "a2" }, { S: "tx1" }],
          },
          {
            Statement: `DELETE FROM "${table}" WHERE pk=?`,
            Parameters: [{ S: "tx2" }],
          },
        ],
      }),
    );

    const records = await getStreamRecords(streamArn);
    expect(records).toHaveLength(4);

    const eventNames = records.map((r) => r.eventName);
    expect(eventNames.filter((e) => e === "INSERT")).toHaveLength(2);
    expect(eventNames.filter((e) => e === "MODIFY")).toHaveLength(1);
    expect(eventNames.filter((e) => e === "REMOVE")).toHaveLength(1);
  });
});

describe("CON-1863: BatchGetItem TTL expiry", () => {
  test("BatchGetItem hides TTL-expired items", async () => {
    const client = ddb();
    const table = "con1863-batchget-ttl";
    await createTable(client, table);
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "exp" },
      }),
    );

    const past = String(Math.floor(Date.now() / 1000) - 60);
    const future = String(Math.floor(Date.now() / 1000) + 3600);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "live" }, exp: { N: future } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "dead" }, exp: { N: past } },
      }),
    );

    const resp = await client.send(
      new BatchGetItemCommand({
        RequestItems: {
          [table]: { Keys: [{ pk: { S: "live" } }, { pk: { S: "dead" } }] },
        },
      }),
    );

    const items = resp.Responses?.[table] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.pk?.S).toBe("live");
  });
});

describe("CON-1863: TransactGetItems TTL expiry", () => {
  test("TransactGetItems hides TTL-expired items", async () => {
    const client = ddb();
    const table = "con1863-transactget-ttl";
    await createTable(client, table);
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: table,
        TimeToLiveSpecification: { Enabled: true, AttributeName: "exp" },
      }),
    );

    const past = String(Math.floor(Date.now() / 1000) - 60);
    const future = String(Math.floor(Date.now() / 1000) + 3600);

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "live" }, exp: { N: future } },
      }),
    );
    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "dead" }, exp: { N: past } },
      }),
    );

    const resp = await client.send(
      new TransactGetItemsCommand({
        TransactItems: [
          { Get: { TableName: table, Key: { pk: { S: "live" } } } },
          { Get: { TableName: table, Key: { pk: { S: "dead" } } } },
        ],
      }),
    );

    const responses = resp.Responses ?? [];
    expect(responses).toHaveLength(2);
    expect(responses[0]?.Item?.pk?.S).toBe("live");
    expect(responses[1]?.Item).toBeUndefined();
  });
});
