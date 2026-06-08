import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  DeregisterStreamConsumerCommand,
  DescribeStreamConsumerCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  KinesisClient,
  ListShardsCommand,
  ListStreamConsumersCommand,
  MergeShardsCommand,
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

const decode = (data: Uint8Array | undefined): string =>
  new TextDecoder().decode(data ?? new Uint8Array());

test("SplitShard closes parent, creates 2 open children; MergeShards closes children; records readable from open shards", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-split-merge-fidelity";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const initial = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const parentShard = initial.Shards?.[0];
  expect(parentShard?.ShardId).toBeDefined();

  await client.send(
    new SplitShardCommand({
      StreamName: streamName,
      ShardToSplit: parentShard!.ShardId!,
      NewStartingHashKey: "170141183460469231731687303715884105728",
    }),
  );

  const afterSplit = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const allShardsAfterSplit = afterSplit.Shards ?? [];
  expect(allShardsAfterSplit.length).toBe(3);

  const closedShards = allShardsAfterSplit.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber !== undefined,
  );
  expect(closedShards.length).toBe(1);
  expect(closedShards[0]?.ShardId).toBe(parentShard!.ShardId);

  const openShards = allShardsAfterSplit.filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openShards.length).toBe(2);

  await client.send(
    new PutRecordsCommand({
      StreamName: streamName,
      Records: [
        { Data: new TextEncoder().encode("rec-alpha"), PartitionKey: "pk-a" },
        { Data: new TextEncoder().encode("rec-beta"), PartitionKey: "pk-b" },
      ],
    }),
  );

  const iter0 = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: openShards[0]!.ShardId!,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );
  const iter1 = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: openShards[1]!.ShardId!,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );

  const recs0 = await client.send(
    new GetRecordsCommand({ ShardIterator: iter0.ShardIterator }),
  );
  const recs1 = await client.send(
    new GetRecordsCommand({ ShardIterator: iter1.ShardIterator }),
  );

  const allDecoded = [
    ...(recs0.Records ?? []).map((r) => decode(r.Data)),
    ...(recs1.Records ?? []).map((r) => decode(r.Data)),
  ].sort();
  expect(allDecoded).toEqual(["rec-alpha", "rec-beta"].sort());

  await client.send(
    new MergeShardsCommand({
      StreamName: streamName,
      ShardToMerge: openShards[0]!.ShardId!,
      AdjacentShardToMerge: openShards[1]!.ShardId!,
    }),
  );

  const afterMerge = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const openAfterMerge = (afterMerge.Shards ?? []).filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openAfterMerge.length).toBe(1);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("RegisterStreamConsumer ACTIVE, DescribeStreamConsumer, Deregister; missing consumer throws ResourceNotFoundException", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-consumer-fidelity";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const streamArn = `arn:aws:kinesis:${region}:000000000000:stream/${streamName}`;

  const registered = await client.send(
    new RegisterStreamConsumerCommand({
      StreamARN: streamArn,
      ConsumerName: "fidelity-consumer",
    }),
  );
  expect(registered.Consumer?.ConsumerName).toBe("fidelity-consumer");
  expect(registered.Consumer?.ConsumerARN).toBeDefined();
  expect(registered.Consumer?.ConsumerStatus).toBe("ACTIVE");

  const described = await client.send(
    new DescribeStreamConsumerCommand({
      StreamARN: streamArn,
      ConsumerName: "fidelity-consumer",
    }),
  );
  expect(described.ConsumerDescription?.ConsumerStatus).toBe("ACTIVE");
  expect(described.ConsumerDescription?.StreamARN).toBe(streamArn);
  expect(described.ConsumerDescription?.ConsumerARN).toBe(
    registered.Consumer?.ConsumerARN,
  );

  const listed = await client.send(
    new ListStreamConsumersCommand({ StreamARN: streamArn }),
  );
  expect((listed.Consumers ?? []).map((c) => c.ConsumerName)).toContain(
    "fidelity-consumer",
  );

  await client.send(
    new DeregisterStreamConsumerCommand({
      StreamARN: streamArn,
      ConsumerName: "fidelity-consumer",
    }),
  );

  const afterDeregister = await client.send(
    new ListStreamConsumersCommand({ StreamARN: streamArn }),
  );
  expect((afterDeregister.Consumers ?? []).length).toBe(0);

  await expect(
    client.send(
      new DescribeStreamConsumerCommand({
        StreamARN: streamArn,
        ConsumerName: "fidelity-consumer",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
