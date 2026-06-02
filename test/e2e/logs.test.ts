import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("logs e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials });

  test("create, describe and delete log groups", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-lifecycle";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const described = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const names = (described.logGroups ?? []).map((g) => g.logGroupName);
    expect(names).toContain(groupName);
    const group = (described.logGroups ?? []).find(
      (g) => g.logGroupName === groupName,
    );
    expect(group?.arn).toContain(groupName);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));

    const afterDelete = await client.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: groupName }),
    );
    const afterNames = (afterDelete.logGroups ?? []).map((g) => g.logGroupName);
    expect(afterNames).not.toContain(groupName);
  });

  test("put and get log events round-trip", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-events";
    const streamName = "bunsai-e2e-stream";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const baseTime = Date.now();
    const put = await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: baseTime, message: "first message" },
          { timestamp: baseTime + 1000, message: "second message" },
        ],
      }),
    );
    expect(put.nextSequenceToken).toBeDefined();

    const got = await client.send(
      new GetLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );
    const messages = (got.events ?? []).map((e) => e.message);
    expect(messages).toEqual(["first message", "second message"]);
    expect(got.events?.[0]?.timestamp).toBe(baseTime);
    expect(got.nextForwardToken).toBeDefined();

    const streams = await client.send(
      new DescribeLogStreamsCommand({ logGroupName: groupName }),
    );
    const streamNames = (streams.logStreams ?? []).map((s) => s.logStreamName);
    expect(streamNames).toContain(streamName);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("filter log events by stream and pattern", async () => {
    const client = logs();
    const groupName = "bunsai-e2e-group-filter";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "stream-a",
      }),
    );
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "stream-b",
      }),
    );

    const baseTime = Date.now();
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "stream-a",
        logEvents: [{ timestamp: baseTime, message: "alpha error here" }],
      }),
    );
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "stream-b",
        logEvents: [{ timestamp: baseTime + 500, message: "beta ok here" }],
      }),
    );

    const filtered = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "error",
      }),
    );
    const filteredMessages = (filtered.events ?? []).map((e) => e.message);
    expect(filteredMessages).toEqual(["alpha error here"]);
    expect(filtered.events?.[0]?.logStreamName).toBe("stream-a");
    expect(filtered.events?.[0]?.eventId).toBeDefined();

    const byStream = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        logStreamNames: ["stream-b"],
      }),
    );
    const byStreamMessages = (byStream.events ?? []).map((e) => e.message);
    expect(byStreamMessages).toEqual(["beta ok here"]);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
