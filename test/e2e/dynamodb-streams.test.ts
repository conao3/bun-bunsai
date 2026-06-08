import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTableCommand,
  DeleteItemCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DescribeStreamCommand,
  DynamoDBStreamsClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListStreamsCommand,
} from "@aws-sdk/client-dynamodb-streams";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("DynamoDB Streams e2e", () => {
  const ddb = () =>
    new DynamoDBClient({ endpoint, region, credentials, requestHandler });
  const streams = () =>
    new DynamoDBStreamsClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
  const table = "bunsai-e2e-ddb-streams";

  test("stream round-trip: INSERT/MODIFY/REMOVE records", async () => {
    const client = ddb();
    const streamsClient = streams();

    await client.send(
      new CreateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: "NEW_AND_OLD_IMAGES",
        },
      }),
    );

    const describeResp = await client.send(
      new DescribeTableCommand({ TableName: table }),
    );
    expect(describeResp.Table?.StreamSpecification?.StreamEnabled).toBe(true);
    expect(describeResp.Table?.StreamSpecification?.StreamViewType).toBe(
      "NEW_AND_OLD_IMAGES",
    );
    const streamArn = describeResp.Table?.LatestStreamArn;
    expect(typeof streamArn).toBe("string");

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "item1" }, data: { S: "hello" } },
      }),
    );

    await client.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { pk: { S: "item1" } },
        UpdateExpression: "SET #d = :v",
        ExpressionAttributeNames: { "#d": "data" },
        ExpressionAttributeValues: { ":v": { S: "world" } },
      }),
    );

    await client.send(
      new DeleteItemCommand({
        TableName: table,
        Key: { pk: { S: "item1" } },
      }),
    );

    const listResp = await streamsClient.send(
      new ListStreamsCommand({ TableName: table }),
    );
    expect(listResp.Streams).toHaveLength(1);
    expect(listResp.Streams?.[0]?.StreamArn).toBe(streamArn);

    const descStreamResp = await streamsClient.send(
      new DescribeStreamCommand({ StreamArn: streamArn }),
    );
    expect(descStreamResp.StreamDescription?.StreamArn).toBe(streamArn);
    expect(descStreamResp.StreamDescription?.StreamStatus).toBe("ENABLED");
    expect(descStreamResp.StreamDescription?.StreamViewType).toBe(
      "NEW_AND_OLD_IMAGES",
    );
    const shards = descStreamResp.StreamDescription?.Shards ?? [];
    expect(shards.length).toBeGreaterThan(0);
    const shardId = shards[0]?.ShardId ?? "";

    const iterResp = await streamsClient.send(
      new GetShardIteratorCommand({
        StreamArn: streamArn,
        ShardId: shardId,
        ShardIteratorType: "TRIM_HORIZON",
      }),
    );
    expect(typeof iterResp.ShardIterator).toBe("string");

    const recordsResp = await streamsClient.send(
      new GetRecordsCommand({ ShardIterator: iterResp.ShardIterator }),
    );
    const records = recordsResp.Records ?? [];
    expect(records).toHaveLength(3);

    const insertRec = records[0];
    expect(insertRec?.eventName).toBe("INSERT");
    expect(insertRec?.dynamodb?.NewImage?.["pk"]?.S).toBe("item1");
    expect(insertRec?.dynamodb?.NewImage?.["data"]?.S).toBe("hello");
    expect(insertRec?.dynamodb?.OldImage).toBeUndefined();

    const modifyRec = records[1];
    expect(modifyRec?.eventName).toBe("MODIFY");
    expect(modifyRec?.dynamodb?.NewImage?.["data"]?.S).toBe("world");
    expect(modifyRec?.dynamodb?.OldImage?.["data"]?.S).toBe("hello");

    const removeRec = records[2];
    expect(removeRec?.eventName).toBe("REMOVE");
    expect(removeRec?.dynamodb?.OldImage?.["pk"]?.S).toBe("item1");
    expect(removeRec?.dynamodb?.NewImage).toBeUndefined();

    expect(typeof recordsResp.NextShardIterator).toBe("string");

    await client.send(new DeleteTableCommand({ TableName: table }));
  });

  test("StreamViewType: KEYS_ONLY emits only keys", async () => {
    const client = ddb();
    const streamsClient = streams();
    const keysTable = "bunsai-e2e-ddb-streams-keys";

    await client.send(
      new CreateTableCommand({
        TableName: keysTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: "KEYS_ONLY",
        },
      }),
    );

    await client.send(
      new PutItemCommand({
        TableName: keysTable,
        Item: { pk: { S: "k1" }, extra: { S: "ignored" } },
      }),
    );

    const descTableResp = await client.send(
      new DescribeTableCommand({ TableName: keysTable }),
    );
    const arn = descTableResp.Table?.LatestStreamArn ?? "";
    const shardId =
      (await streamsClient.send(new DescribeStreamCommand({ StreamArn: arn })))
        .StreamDescription?.Shards?.[0]?.ShardId ?? "";
    const iterator = (
      await streamsClient.send(
        new GetShardIteratorCommand({
          StreamArn: arn,
          ShardId: shardId,
          ShardIteratorType: "TRIM_HORIZON",
        }),
      )
    ).ShardIterator;
    const records =
      (
        await streamsClient.send(
          new GetRecordsCommand({ ShardIterator: iterator }),
        )
      ).Records ?? [];

    expect(records).toHaveLength(1);
    expect(records[0]?.dynamodb?.Keys?.["pk"]?.S).toBe("k1");
    expect(records[0]?.dynamodb?.NewImage).toBeUndefined();
    expect(records[0]?.dynamodb?.OldImage).toBeUndefined();

    await client.send(new DeleteTableCommand({ TableName: keysTable }));
  });

  test("UpdateTable can enable stream", async () => {
    const client = ddb();
    const streamsClient = streams();
    const updateTable = "bunsai-e2e-ddb-streams-update";

    await client.send(
      new CreateTableCommand({
        TableName: updateTable,
        AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );

    const descBefore = await client.send(
      new DescribeTableCommand({ TableName: updateTable }),
    );
    expect(descBefore.Table?.LatestStreamArn).toBeUndefined();

    await client.send(
      new UpdateTableCommand({
        TableName: updateTable,
        StreamSpecification: {
          StreamEnabled: true,
          StreamViewType: "NEW_IMAGE",
        },
      }),
    );

    const descAfter = await client.send(
      new DescribeTableCommand({ TableName: updateTable }),
    );
    expect(descAfter.Table?.StreamSpecification?.StreamEnabled).toBe(true);
    const arn = descAfter.Table?.LatestStreamArn ?? "";
    expect(arn).toContain("/stream/");

    const listResp = await streamsClient.send(new ListStreamsCommand({}));
    expect(listResp.Streams?.some((s) => s.StreamArn === arn)).toBe(true);

    await client.send(new DeleteTableCommand({ TableName: updateTable }));
  });
});
