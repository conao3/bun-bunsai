import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  DescribeStreamCommand,
  DescribeStreamSummaryCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  KinesisClient,
  ListStreamsCommand,
  PutRecordCommand,
  PutRecordsCommand,
} from "@aws-sdk/client-kinesis";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const kinesis = () =>
  new KinesisClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

const decode = (data: Uint8Array | undefined): string =>
  new TextDecoder().decode(data ?? new Uint8Array());

test("Kinesis stream, record put and get lifecycle", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-stream";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const listed = await client.send(new ListStreamsCommand({}));
  expect(listed.StreamNames ?? []).toContain(streamName);

  const described = await client.send(
    new DescribeStreamCommand({ StreamName: streamName }),
  );
  expect(described.StreamDescription?.StreamName).toBe(streamName);
  expect(described.StreamDescription?.StreamStatus).toBe("ACTIVE");
  const shard = (described.StreamDescription?.Shards ?? [])[0];
  expect(shard?.ShardId).toBeDefined();

  const summary = await client.send(
    new DescribeStreamSummaryCommand({ StreamName: streamName }),
  );
  expect(summary.StreamDescriptionSummary?.StreamName).toBe(streamName);
  expect(summary.StreamDescriptionSummary?.OpenShardCount).toBe(1);

  const put = await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      Data: new TextEncoder().encode("hello bunsai kinesis"),
      PartitionKey: "pk-1",
    }),
  );
  expect(put.SequenceNumber).toBeDefined();
  expect(put.ShardId).toBe(shard?.ShardId);

  const putRecords = await client.send(
    new PutRecordsCommand({
      StreamName: streamName,
      Records: [
        {
          Data: new TextEncoder().encode("batch-1"),
          PartitionKey: "pk-2",
        },
        {
          Data: new TextEncoder().encode("batch-2"),
          PartitionKey: "pk-3",
        },
      ],
    }),
  );
  expect(putRecords.FailedRecordCount).toBe(0);
  expect((putRecords.Records ?? []).length).toBe(2);

  const iterator = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shard?.ShardId,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );
  expect(iterator.ShardIterator).toBeDefined();

  const records = await client.send(
    new GetRecordsCommand({ ShardIterator: iterator.ShardIterator }),
  );
  const payloads = (records.Records ?? []).map((record) => decode(record.Data));
  expect(payloads).toContain("hello bunsai kinesis");
  expect(payloads).toContain("batch-1");
  expect(payloads).toContain("batch-2");
  expect(records.NextShardIterator).toBeDefined();

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
  const afterDelete = await client.send(new ListStreamsCommand({}));
  expect(afterDelete.StreamNames ?? []).not.toContain(streamName);
});
