import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateStreamCommand,
  DeleteResourcePolicyCommand,
  DeleteStreamCommand,
  DeregisterStreamConsumerCommand,
  DescribeAccountSettingsCommand,
  DescribeLimitsCommand,
  DescribeStreamConsumerCommand,
  GetResourcePolicyCommand,
  KinesisClient,
  ListShardsCommand,
  ListStreamConsumersCommand,
  ListTagsForResourceCommand,
  MergeShardsCommand,
  PutResourcePolicyCommand,
  RegisterStreamConsumerCommand,
  SplitShardCommand,
  StartStreamEncryptionCommand,
  StopStreamEncryptionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAccountSettingsCommand,
  UpdateShardCountCommand,
  UpdateStreamModeCommand,
  UpdateStreamWarmThroughputCommand,
} from "@aws-sdk/client-kinesis";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4882;
const uiPort = 5882;
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

test("ListShards returns shards for a stream", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-shards";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const listed = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  expect((listed.Shards ?? []).length).toBeGreaterThanOrEqual(1);
  expect(listed.Shards?.[0]?.ShardId).toBeDefined();
  expect(listed.Shards?.[0]?.HashKeyRange).toBeDefined();

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("SplitShard and MergeShards mutate shard list", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-split-merge";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const initial = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const originalShard = initial.Shards?.[0];
  expect(originalShard?.ShardId).toBeDefined();

  await client.send(
    new SplitShardCommand({
      StreamName: streamName,
      ShardToSplit: originalShard!.ShardId!,
      NewStartingHashKey: "170141183460469231731687303715884105728",
    }),
  );

  const afterSplit = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const openAfterSplit = (afterSplit.Shards ?? []).filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openAfterSplit.length).toBe(2);

  await client.send(
    new MergeShardsCommand({
      StreamName: streamName,
      ShardToMerge: openAfterSplit[0]!.ShardId!,
      AdjacentShardToMerge: openAfterSplit[1]!.ShardId!,
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

test("UpdateShardCount changes the open shard count", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-update-shard-count";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const result = await client.send(
    new UpdateShardCountCommand({
      StreamName: streamName,
      TargetShardCount: 2,
      ScalingType: "UNIFORM_SCALING",
    }),
  );
  expect(result.TargetShardCount).toBe(2);
  expect(result.StreamName).toBe(streamName);

  const listed = await client.send(
    new ListShardsCommand({ StreamName: streamName }),
  );
  const openShards = (listed.Shards ?? []).filter(
    (s) => s.SequenceNumberRange?.EndingSequenceNumber === undefined,
  );
  expect(openShards.length).toBe(2);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("RegisterStreamConsumer, DescribeStreamConsumer, ListStreamConsumers, DeregisterStreamConsumer", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-consumers";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const streamArn = `arn:aws:kinesis:${region}:000000000000:stream/${streamName}`;

  const registered = await client.send(
    new RegisterStreamConsumerCommand({
      StreamARN: streamArn,
      ConsumerName: "my-consumer",
    }),
  );
  expect(registered.Consumer?.ConsumerName).toBe("my-consumer");
  expect(registered.Consumer?.ConsumerARN).toBeDefined();
  expect(registered.Consumer?.ConsumerStatus).toBeDefined();

  const described = await client.send(
    new DescribeStreamConsumerCommand({
      StreamARN: streamArn,
      ConsumerName: "my-consumer",
    }),
  );
  expect(described.ConsumerDescription?.ConsumerName).toBe("my-consumer");
  expect(described.ConsumerDescription?.StreamARN).toBe(streamArn);

  const listed = await client.send(
    new ListStreamConsumersCommand({ StreamARN: streamArn }),
  );
  const names = (listed.Consumers ?? []).map((c) => c.ConsumerName);
  expect(names).toContain("my-consumer");

  await client.send(
    new DeregisterStreamConsumerCommand({
      StreamARN: streamArn,
      ConsumerName: "my-consumer",
    }),
  );

  const afterDeregister = await client.send(
    new ListStreamConsumersCommand({ StreamARN: streamArn }),
  );
  expect((afterDeregister.Consumers ?? []).length).toBe(0);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("StartStreamEncryption and StopStreamEncryption", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-encryption";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  await client.send(
    new StartStreamEncryptionCommand({
      StreamName: streamName,
      EncryptionType: "KMS",
      KeyId: "alias/aws/kinesis",
    }),
  );

  await client.send(
    new StopStreamEncryptionCommand({
      StreamName: streamName,
      EncryptionType: "KMS",
      KeyId: "alias/aws/kinesis",
    }),
  );

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("UpdateStreamMode changes the stream capacity mode", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-stream-mode";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const streamArn = `arn:aws:kinesis:${region}:000000000000:stream/${streamName}`;

  await client.send(
    new UpdateStreamModeCommand({
      StreamARN: streamArn,
      StreamModeDetails: { StreamMode: "ON_DEMAND" },
    }),
  );

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("UpdateStreamWarmThroughput returns updated throughput", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-warm-throughput";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const result = await client.send(
    new UpdateStreamWarmThroughputCommand({
      StreamName: streamName,
      WarmThroughputMiBps: 10,
    }),
  );
  expect(result.StreamName).toBe(streamName);
  expect(result.WarmThroughput?.TargetMiBps).toBe(10);

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("DescribeLimits returns account-level shard limits", async () => {
  const client = kinesis();

  const result = await client.send(new DescribeLimitsCommand({}));
  expect(result.ShardLimit).toBeGreaterThan(0);
  expect(typeof result.OpenShardCount).toBe("number");
  expect(typeof result.OnDemandStreamCount).toBe("number");
  expect(typeof result.OnDemandStreamCountLimit).toBe("number");
});

test("DescribeAccountSettings and UpdateAccountSettings", async () => {
  const client = kinesis();

  const initial = await client.send(new DescribeAccountSettingsCommand({}));
  expect(initial.MinimumThroughputBillingCommitment?.Status).toBeDefined();

  await client.send(
    new UpdateAccountSettingsCommand({
      MinimumThroughputBillingCommitment: { Status: "ENABLED" },
    }),
  );

  const updated = await client.send(new DescribeAccountSettingsCommand({}));
  expect(updated.MinimumThroughputBillingCommitment?.Status).toBe("ENABLED");
});

test("PutResourcePolicy, GetResourcePolicy, DeleteResourcePolicy", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-resource-policy";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const streamArn = `arn:aws:kinesis:${region}:000000000000:stream/${streamName}`;
  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Principal: "*", Action: "kinesis:*" }],
  });

  await client.send(
    new PutResourcePolicyCommand({ ResourceARN: streamArn, Policy: policy }),
  );

  const got = await client.send(
    new GetResourcePolicyCommand({ ResourceARN: streamArn }),
  );
  expect(got.Policy).toBe(policy);

  await client.send(
    new DeleteResourcePolicyCommand({ ResourceARN: streamArn }),
  );

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});

test("TagResource, UntagResource, ListTagsForResource", async () => {
  const client = kinesis();
  const streamName = "bunsai-e2e-tag-resource";

  await client.send(
    new CreateStreamCommand({ StreamName: streamName, ShardCount: 1 }),
  );

  const streamArn = `arn:aws:kinesis:${region}:000000000000:stream/${streamName}`;

  await client.send(
    new TagResourceCommand({
      ResourceARN: streamArn,
      Tags: { team: "bunsai", env: "test" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: streamArn }),
  );
  const tagMap = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagMap["team"]).toBe("bunsai");
  expect(tagMap["env"]).toBe("test");

  await client.send(
    new UntagResourceCommand({ ResourceARN: streamArn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: streamArn }),
  );
  const remainingKeys = (afterUntag.Tags ?? []).map((t) => t.Key);
  expect(remainingKeys).toContain("team");
  expect(remainingKeys).not.toContain("env");

  await client.send(new DeleteStreamCommand({ StreamName: streamName }));
});
