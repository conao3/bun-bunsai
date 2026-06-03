import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddTagsToStreamCommand,
  CreateStreamCommand,
  DecreaseStreamRetentionPeriodCommand,
  DeleteStreamCommand,
  DescribeStreamSummaryCommand,
  DisableEnhancedMonitoringCommand,
  EnableEnhancedMonitoringCommand,
  IncreaseStreamRetentionPeriodCommand,
  KinesisClient,
  ListTagsForStreamCommand,
  RemoveTagsFromStreamCommand,
} from "@aws-sdk/client-kinesis";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4881;
const uiPort = 5881;
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

test("Kinesis retention period, tags and enhanced monitoring", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-stream-2";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  await client.send(
    new IncreaseStreamRetentionPeriodCommand({
      StreamName: streamName,
      RetentionPeriodHours: 48,
    }),
  );

  const afterIncrease = await client.send(
    new DescribeStreamSummaryCommand({ StreamName: streamName }),
  );
  expect(afterIncrease.StreamDescriptionSummary?.RetentionPeriodHours).toBe(48);

  await client.send(
    new DecreaseStreamRetentionPeriodCommand({
      StreamName: streamName,
      RetentionPeriodHours: 36,
    }),
  );

  const afterDecrease = await client.send(
    new DescribeStreamSummaryCommand({ StreamName: streamName }),
  );
  expect(afterDecrease.StreamDescriptionSummary?.RetentionPeriodHours).toBe(36);

  await client.send(
    new AddTagsToStreamCommand({
      StreamName: streamName,
      Tags: { env: "test", owner: "bunsai" },
    }),
  );

  const tagged = await client.send(
    new ListTagsForStreamCommand({ StreamName: streamName }),
  );
  expect(tagged.HasMoreTags).toBe(false);
  const tagMap = Object.fromEntries(
    (tagged.Tags ?? []).map((tag) => [tag.Key, tag.Value]),
  );
  expect(tagMap["env"]).toBe("test");
  expect(tagMap["owner"]).toBe("bunsai");

  await client.send(
    new RemoveTagsFromStreamCommand({
      StreamName: streamName,
      TagKeys: ["env"],
    }),
  );

  const afterRemove = await client.send(
    new ListTagsForStreamCommand({ StreamName: streamName }),
  );
  const remainingKeys = (afterRemove.Tags ?? []).map((tag) => tag.Key);
  expect(remainingKeys).toContain("owner");
  expect(remainingKeys).not.toContain("env");

  const enabled = await client.send(
    new EnableEnhancedMonitoringCommand({
      StreamName: streamName,
      ShardLevelMetrics: ["IncomingBytes", "IncomingRecords"],
    }),
  );
  expect(enabled.CurrentShardLevelMetrics).toEqual([]);
  expect(enabled.DesiredShardLevelMetrics).toContain("IncomingBytes");
  expect(enabled.DesiredShardLevelMetrics).toContain("IncomingRecords");

  const disabled = await client.send(
    new DisableEnhancedMonitoringCommand({
      StreamName: streamName,
      ShardLevelMetrics: ["IncomingBytes"],
    }),
  );
  expect(disabled.CurrentShardLevelMetrics).toContain("IncomingBytes");
  expect(disabled.DesiredShardLevelMetrics).not.toContain("IncomingBytes");
  expect(disabled.DesiredShardLevelMetrics).toContain("IncomingRecords");

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
