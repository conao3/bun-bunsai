import { describe, expect, test } from "bun:test";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DescribeStreamCommand,
  DynamoDBStreamsClient,
  GetRecordsCommand,
  GetShardIteratorCommand,
  ListStreamsCommand,
} from "@aws-sdk/client-dynamodb-streams";
import { startApp } from "./harness.ts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("DynamoDBStreams skeleton e2e", () => {
  const ddb = (): DynamoDBClient =>
    new DynamoDBClient({ endpoint, region, credentials, requestHandler });
  const streams = (): DynamoDBStreamsClient =>
    new DynamoDBStreamsClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
  const table = "bunsai-e2e-dynamodbstreams";

  test("ListStreams, DescribeStream, GetShardIterator, GetRecords roundtrip", async () => {
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

    const desc = await client.send(
      new DescribeTableCommand({ TableName: table }),
    );
    const streamArn = desc.Table?.LatestStreamArn;
    expect(typeof streamArn).toBe("string");

    const listed = await streamsClient.send(
      new ListStreamsCommand({ TableName: table }),
    );
    const arns = (listed.Streams ?? []).map((s) => s.StreamArn);
    expect(arns).toContain(streamArn);

    const described = await streamsClient.send(
      new DescribeStreamCommand({ StreamArn: streamArn }),
    );
    const shardId = described.StreamDescription?.Shards?.[0]?.ShardId;
    expect(typeof shardId).toBe("string");
    expect(described.StreamDescription?.TableName).toBe(table);

    const iter = await streamsClient.send(
      new GetShardIteratorCommand({
        StreamArn: streamArn,
        ShardId: shardId!,
        ShardIteratorType: "TRIM_HORIZON",
      }),
    );
    expect(typeof iter.ShardIterator).toBe("string");

    await client.send(
      new PutItemCommand({
        TableName: table,
        Item: { pk: { S: "k1" } },
      }),
    );

    const recs = await streamsClient.send(
      new GetRecordsCommand({ ShardIterator: iter.ShardIterator! }),
    );
    expect(Array.isArray(recs.Records)).toBe(true);
    expect(typeof recs.NextShardIterator).toBe("string");
    expect(recs.Records?.length).toBeGreaterThan(0);

    await client.send(new DeleteTableCommand({ TableName: table }));
  });
});
