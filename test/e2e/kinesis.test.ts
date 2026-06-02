import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

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
