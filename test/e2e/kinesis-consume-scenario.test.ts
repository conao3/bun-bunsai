import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  KinesisClient,
  ListShardsCommand,
  PutRecordCommand,
  PutRecordsCommand,
} from "@aws-sdk/client-kinesis";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const kinesis = () =>
  new KinesisClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Kinesis consumer loop: PutRecords batch, TRIM_HORIZON consume, NextShardIterator tracking, paging", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-consume-loop";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const shards = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const shardId = shards.Shards?.[0]?.ShardId!;
  expect(shardId).toBeDefined();

  const payloads = [
    new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    new TextEncoder().encode("hello-1"),
    new TextEncoder().encode("hello-2"),
    new TextEncoder().encode("hello-3"),
    new Uint8Array([0xff, 0xfe, 0xfd]),
  ];

  const putResult = await client.send(
    new PutRecordsCommand({
      StreamName: streamName,
      Records: payloads.map((data) => ({
        Data: data,
        PartitionKey: "pk-loop",
      })),
    }),
  );

  expect(putResult.FailedRecordCount).toBe(0);
  const putSeqNums = (putResult.Records ?? []).map((r) => r.SequenceNumber!);
  expect(putSeqNums.length).toBe(5);
  for (let i = 1; i < putSeqNums.length; i++) {
    expect(Number(putSeqNums[i])).toBeGreaterThan(Number(putSeqNums[i - 1]));
  }

  const iterTrim = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );
  expect(iterTrim.ShardIterator).toBeDefined();

  const batch = await client.send(
    new GetRecordsCommand({ ShardIterator: iterTrim.ShardIterator }),
  );
  expect((batch.Records ?? []).length).toBe(5);
  expect(batch.NextShardIterator).toBeDefined();

  const batchSeqNums = (batch.Records ?? []).map((r) =>
    Number(r.SequenceNumber),
  );
  for (let i = 1; i < batchSeqNums.length; i++) {
    expect(batchSeqNums[i]).toBeGreaterThan(batchSeqNums[i - 1]);
  }

  const batchData = (batch.Records ?? []).map((r) => r.Data!);
  expect(batchData[0]).toEqual(new Uint8Array([0x00, 0x01, 0x02, 0x03]));
  expect(batchData[1]).toEqual(new TextEncoder().encode("hello-1"));
  expect(batchData[2]).toEqual(new TextEncoder().encode("hello-2"));
  expect(batchData[3]).toEqual(new TextEncoder().encode("hello-3"));
  expect(batchData[4]).toEqual(new Uint8Array([0xff, 0xfe, 0xfd]));

  const emptyBatch = await client.send(
    new GetRecordsCommand({ ShardIterator: batch.NextShardIterator }),
  );
  expect((emptyBatch.Records ?? []).length).toBe(0);
  expect(emptyBatch.NextShardIterator).toBeDefined();

  const newData = new TextEncoder().encode("new-arrival");
  const putNew = await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      Data: newData,
      PartitionKey: "pk-loop",
    }),
  );
  expect(putNew.SequenceNumber).toBeDefined();

  const trackingBatch = await client.send(
    new GetRecordsCommand({ ShardIterator: emptyBatch.NextShardIterator }),
  );
  expect((trackingBatch.Records ?? []).length).toBe(1);
  expect(trackingBatch.Records?.[0]?.Data).toEqual(newData);

  const iterAt = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "AT_SEQUENCE_NUMBER",
      StartingSequenceNumber: putSeqNums[2],
    }),
  );
  const recsAt = await client.send(
    new GetRecordsCommand({ ShardIterator: iterAt.ShardIterator }),
  );
  expect(recsAt.Records?.[0]?.SequenceNumber).toBe(putSeqNums[2]);
  expect((recsAt.Records ?? []).length).toBeGreaterThanOrEqual(3);

  const iterAfter = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
      StartingSequenceNumber: putSeqNums[2],
    }),
  );
  const recsAfter = await client.send(
    new GetRecordsCommand({ ShardIterator: iterAfter.ShardIterator }),
  );
  expect(recsAfter.Records?.[0]?.SequenceNumber).toBe(putSeqNums[3]);

  const iterPage = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );

  const page1 = await client.send(
    new GetRecordsCommand({ ShardIterator: iterPage.ShardIterator, Limit: 3 }),
  );
  expect((page1.Records ?? []).length).toBe(3);
  expect(page1.NextShardIterator).toBeDefined();

  const page2 = await client.send(
    new GetRecordsCommand({ ShardIterator: page1.NextShardIterator, Limit: 3 }),
  );
  expect((page2.Records ?? []).length).toBe(3);
  expect(page2.NextShardIterator).toBeDefined();

  const page3 = await client.send(
    new GetRecordsCommand({ ShardIterator: page2.NextShardIterator, Limit: 3 }),
  );
  expect((page3.Records ?? []).length).toBe(0);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
