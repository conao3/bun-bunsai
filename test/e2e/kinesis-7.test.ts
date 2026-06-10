import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  KinesisClient,
  ListShardsCommand,
  ListTagsForStreamCommand,
  MergeShardsCommand,
  PutRecordCommand,
  PutRecordsCommand,
  RegisterStreamConsumerCommand,
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

test("CreateStream with Tags — tag round-trip via ListTagsForStream", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-kinesis7-tags";

  await client.send(
    new CreateStreamCommand({
      StreamName: streamName,
      ShardCount: 1,
      Tags: { env: "e2e", owner: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForStreamCommand({ StreamName: streamName }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["env"]).toBe("e2e");
  expect(tagMap["owner"]).toBe("bunsai");
  expect(listed.HasMoreTags).toBe(false);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("DeleteStream with registered consumer — EnforceConsumerDeletion=false throws, true succeeds", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-kinesis7-enforce-del";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const described = await client.send(
    new RegisterStreamConsumerCommand({
      StreamARN: `arn:aws:kinesis:${region}:000000000000:stream/${streamName}`,
      ConsumerName: "consumer-1",
    }),
  );
  expect(described.Consumer?.ConsumerName).toBe("consumer-1");

  await expect(
    client.send(
      new DeleteStreamCommand({
        StreamName: streamName,
        EnforceConsumerDeletion: false,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceInUseException" });

  await client.send(
    new DeleteStreamCommand({
      StreamName: streamName,
      EnforceConsumerDeletion: true,
    }),
  );
});

test("PutRecord ExplicitHashKey routes to correct shard", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-kinesis7-hashkey";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 2 }),
  );

  const shards = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  expect(shards.Shards?.length).toBe(2);

  const shard0 = shards.Shards![0]!;
  const shard1 = shards.Shards![1]!;
  const hashKey0 = shard0.HashKeyRange!.StartingHashKey!;
  const hashKey1 = shard1.HashKeyRange!.StartingHashKey!;

  const result0 = await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      PartitionKey: "ignored",
      Data: new TextEncoder().encode("data0"),
      ExplicitHashKey: hashKey0,
    }),
  );
  expect(result0.ShardId).toBe(shard0.ShardId);

  const result1 = await client.send(
    new PutRecordCommand({
      StreamName: streamName,
      PartitionKey: "ignored",
      Data: new TextEncoder().encode("data1"),
      ExplicitHashKey: hashKey1,
    }),
  );
  expect(result1.ShardId).toBe(shard1.ShardId);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("PutRecords per-record ExplicitHashKey routes to correct shard", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-kinesis7-putrecords-hashkey";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 2 }),
  );

  const shards = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const shard0 = shards.Shards![0]!;
  const shard1 = shards.Shards![1]!;

  const result = await client.send(
    new PutRecordsCommand({
      StreamName: streamName,
      Records: [
        {
          PartitionKey: "ignored",
          Data: new TextEncoder().encode("a"),
          ExplicitHashKey: shard0.HashKeyRange!.StartingHashKey!,
        },
        {
          PartitionKey: "ignored",
          Data: new TextEncoder().encode("b"),
          ExplicitHashKey: shard1.HashKeyRange!.StartingHashKey!,
        },
      ],
    }),
  );

  expect(result.Records?.[0]?.ShardId).toBe(shard0.ShardId);
  expect(result.Records?.[1]?.ShardId).toBe(shard1.ShardId);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("MergeShards and SplitShard work on ACTIVE stream", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-kinesis7-shardops";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 2 }),
  );

  const shardsBefore = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const openBefore = shardsBefore.Shards!.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openBefore.length).toBe(2);

  const shard0 = openBefore[0]!;
  const midHashKey = String(
    (BigInt(shard0.HashKeyRange!.StartingHashKey!) +
      BigInt(shard0.HashKeyRange!.EndingHashKey!)) /
      2n,
  );

  await client.send(
    new SplitShardCommand({
      StreamName: streamName,
      ShardToSplit: shard0.ShardId!,
      NewStartingHashKey: midHashKey,
    }),
  );

  const shardsAfterSplit = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const openAfterSplit = shardsAfterSplit.Shards!.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openAfterSplit.length).toBe(3);

  await client.send(
    new MergeShardsCommand({
      StreamName: streamName,
      ShardToMerge: openAfterSplit[0]!.ShardId!,
      AdjacentShardToMerge: openAfterSplit[1]!.ShardId!,
    }),
  );

  const shardsAfterMerge = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const openAfterMerge = shardsAfterMerge.Shards!.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openAfterMerge.length).toBe(2);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
