import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  KinesisClient,
  ListShardsCommand,
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

const decode = (data: Uint8Array | undefined): string =>
  new TextDecoder().decode(data ?? new Uint8Array());

test("ShardCount=2 partitions records across shards with no duplication", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-multishard";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 2 }),
  );

  const listed = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  expect((listed.Shards ?? []).length).toBe(2);

  const shard0Id = listed.Shards?.[0]?.ShardId;
  const shard1Id = listed.Shards?.[1]?.ShardId;
  expect(shard0Id).toBeDefined();
  expect(shard1Id).toBeDefined();
  expect(shard0Id).not.toBe(shard1Id);

  const putResult = await client.send(
    new PutRecordsCommand({
      StreamName: streamName,
      Records: [
        {
          Data: new TextEncoder().encode("record-a"),
          PartitionKey: "pk-alpha",
        },
        { Data: new TextEncoder().encode("record-b"), PartitionKey: "pk-beta" },
        {
          Data: new TextEncoder().encode("record-c"),
          PartitionKey: "pk-gamma",
        },
        {
          Data: new TextEncoder().encode("record-d"),
          PartitionKey: "pk-delta",
        },
      ],
    }),
  );
  expect(putResult.FailedRecordCount).toBe(0);
  expect((putResult.Records ?? []).length).toBe(4);

  const shardIds = (putResult.Records ?? []).map((r) => r.ShardId);
  const usedShards = new Set(shardIds);
  expect(usedShards.size).toBeGreaterThanOrEqual(2);

  const iter0 = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shard0Id,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );
  const iter1 = await client.send(
    new GetShardIteratorCommand({
      StreamName: streamName,
      ShardId: shard1Id,
      ShardIteratorType: "TRIM_HORIZON",
    }),
  );

  const records0 = await client.send(
    new GetRecordsCommand({ ShardIterator: iter0.ShardIterator }),
  );
  const records1 = await client.send(
    new GetRecordsCommand({ ShardIterator: iter1.ShardIterator }),
  );

  const payloads0 = (records0.Records ?? []).map((r) => decode(r.Data));
  const payloads1 = (records1.Records ?? []).map((r) => decode(r.Data));

  const allPayloads = [...payloads0, ...payloads1].sort();
  expect(allPayloads).toEqual(
    ["record-a", "record-b", "record-c", "record-d"].sort(),
  );

  const overlap = payloads0.filter((p) => payloads1.includes(p));
  expect(overlap.length).toBe(0);

  expect(records0.NextShardIterator).toBeDefined();
  expect(records1.NextShardIterator).toBeDefined();

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
