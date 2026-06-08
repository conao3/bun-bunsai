import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  DescribeStreamCommand,
  DescribeStreamSummaryCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  KinesisClient,
  ListShardsCommand,
  MergeShardsCommand,
  PutRecordCommand,
  PutRecordsCommand,
  SplitShardCommand,
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

const decode = (data: Uint8Array | undefined): string =>
  new TextDecoder().decode(data ?? new Uint8Array());

test("PutRecord SequenceNumber matches GetRecords SequenceNumber end-to-end", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-seqnum-fidelity";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const shards = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const shardId = shards.Shards?.[0]?.ShardId!;

  const put1 = await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      Data: new TextEncoder().encode("first"),
      PartitionKey: "pk-1",
    }),
  );
  const put2 = await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      Data: new TextEncoder().encode("second"),
      PartitionKey: "pk-1",
    }),
  );
  expect(put1.SequenceNumber).toBeDefined();
  expect(put2.SequenceNumber).toBeDefined();
  expect(put1.SequenceNumber).not.toBe(put2.SequenceNumber);

  const iter = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );

  const records = await client.send(
    new GetRecordsCommand({ ShardIterator: iter.ShardIterator }),
  );
  const seqNums = (records.Records ?? []).map((r) => r.SequenceNumber);
  expect(seqNums).toContain(put1.SequenceNumber);
  expect(seqNums).toContain(put2.SequenceNumber);
  expect(seqNums.indexOf(put1.SequenceNumber!)).toBeLessThan(
    seqNums.indexOf(put2.SequenceNumber!),
  );

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("GetShardIterator AT_SEQUENCE_NUMBER, AFTER_SEQUENCE_NUMBER, AT_TIMESTAMP position correctly", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-iterator-positions";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const shards = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const shardId = shards.Shards?.[0]?.ShardId!;

  const pastTs = Math.floor(Date.now() / 1000) - 3600;

  const putResult = await client.send(
    new PutRecordsCommand({
      StreamName: streamName,
      Records: [
        { Data: new TextEncoder().encode("rec-0"), PartitionKey: "pk-0" },
        { Data: new TextEncoder().encode("rec-1"), PartitionKey: "pk-0" },
        { Data: new TextEncoder().encode("rec-2"), PartitionKey: "pk-0" },
      ],
    }),
  );
  const seqNums = (putResult.Records ?? []).map((r) => r.SequenceNumber!);
  expect(seqNums.length).toBe(3);

  const iterAt = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "AT_SEQUENCE_NUMBER",
      StartingSequenceNumber: seqNums[1],
    }),
  );
  const recsAt = await client.send(
    new GetRecordsCommand({ ShardIterator: iterAt.ShardIterator }),
  );
  const payloadsAt = (recsAt.Records ?? []).map((r) => decode(r.Data));
  expect(payloadsAt).not.toContain("rec-0");
  expect(payloadsAt).toContain("rec-1");
  expect(payloadsAt).toContain("rec-2");

  const iterAfter = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "AFTER_SEQUENCE_NUMBER",
      StartingSequenceNumber: seqNums[1],
    }),
  );
  const recsAfter = await client.send(
    new GetRecordsCommand({ ShardIterator: iterAfter.ShardIterator }),
  );
  const payloadsAfter = (recsAfter.Records ?? []).map((r) => decode(r.Data));
  expect(payloadsAfter).not.toContain("rec-0");
  expect(payloadsAfter).not.toContain("rec-1");
  expect(payloadsAfter).toContain("rec-2");

  const iterPast = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "AT_TIMESTAMP",
      Timestamp: new Date(pastTs * 1000),
    }),
  );
  const recsPast = await client.send(
    new GetRecordsCommand({ ShardIterator: iterPast.ShardIterator }),
  );
  const payloadsPast = (recsPast.Records ?? []).map((r) => decode(r.Data));
  expect(payloadsPast).toContain("rec-0");
  expect(payloadsPast).toContain("rec-1");
  expect(payloadsPast).toContain("rec-2");

  const futureTs = Math.floor(Date.now() / 1000) + 3600;
  const iterFuture = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shardId,
      ShardIteratorType: "AT_TIMESTAMP",
      Timestamp: new Date(futureTs * 1000),
    }),
  );
  const recsFuture = await client.send(
    new GetRecordsCommand({ ShardIterator: iterFuture.ShardIterator }),
  );
  expect((recsFuture.Records ?? []).length).toBe(0);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("DescribeStreamSummary OpenShardCount and DescribeStream topology after SplitShard and MergeShards", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-summary-topology";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const summaryInitial = await client.send(
    new DescribeStreamSummaryCommand({ StreamName: streamName }),
  );
  expect(summaryInitial.StreamDescriptionSummary?.StreamStatus).toBe("ACTIVE");
  expect(summaryInitial.StreamDescriptionSummary?.OpenShardCount).toBe(1);

  const shards = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const parentShardId = shards.Shards?.[0]?.ShardId!;

  await client.send(
    new SplitShardCommand({
      StreamName: streamName,
      ShardToSplit: parentShardId,
      NewStartingHashKey: "170141183460469231731687303715884105728",
    }),
  );

  const summaryAfterSplit = await client.send(
    new DescribeStreamSummaryCommand({ StreamName: streamName }),
  );
  expect(summaryAfterSplit.StreamDescriptionSummary?.OpenShardCount).toBe(2);

  const descAfterSplit = await client.send(
    new DescribeStreamCommand({ StreamName: streamName }),
  );
  const allShards = descAfterSplit.StreamDescription?.Shards ?? [];
  expect(allShards.length).toBe(3);

  const closedInDesc = allShards.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber !== undefined,
  );
  expect(closedInDesc.length).toBe(1);
  expect(closedInDesc[0]?.ShardId).toBe(parentShardId);

  const openInDesc = allShards.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openInDesc.length).toBe(2);
  for (const s of openInDesc) {
    expect(s.ParentShardId).toBe(parentShardId);
  }

  await client.send(
    new MergeShardsCommand({
      StreamName: streamName,
      ShardToMerge: openInDesc[0]!.ShardId!,
      AdjacentShardToMerge: openInDesc[1]!.ShardId!,
    }),
  );

  const summaryAfterMerge = await client.send(
    new DescribeStreamSummaryCommand({ StreamName: streamName }),
  );
  expect(summaryAfterMerge.StreamDescriptionSummary?.OpenShardCount).toBe(1);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
