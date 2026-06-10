import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelExportTaskCommand,
  CloudWatchLogsClient,
  CreateExportTaskCommand,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  DescribeExportTasksCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e (MEDIUM gaps — CON-2050)", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });

  test("MEDIUM-1: GetLogEvents nextToken pagination", async () => {
    const client = logs();
    const groupName = "bunsai-logs6-med1-group";
    const streamName = "bunsai-logs6-med1-stream";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const baseTime = 1700000000000;
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: baseTime, message: "evt-1" },
          { timestamp: baseTime + 1000, message: "evt-2" },
          { timestamp: baseTime + 2000, message: "evt-3" },
        ],
      }),
    );

    const page1 = await client.send(
      new GetLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        limit: 1,
        startFromHead: true,
      }),
    );
    expect(page1.events?.map((e) => e.message)).toEqual(["evt-1"]);
    expect(page1.nextForwardToken).toBeDefined();

    const page2 = await client.send(
      new GetLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        limit: 1,
        startFromHead: true,
        nextToken: page1.nextForwardToken,
      }),
    );
    expect(page2.events?.map((e) => e.message)).toEqual(["evt-2"]);

    const page3 = await client.send(
      new GetLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        limit: 1,
        startFromHead: true,
        nextToken: page2.nextForwardToken,
      }),
    );
    expect(page3.events?.map((e) => e.message)).toEqual(["evt-3"]);

    const eosPage = await client.send(
      new GetLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        limit: 1,
        startFromHead: true,
        nextToken: page3.nextForwardToken,
      }),
    );
    expect(eosPage.events).toHaveLength(0);
    expect(eosPage.nextForwardToken).toBe(page3.nextForwardToken);

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("MEDIUM-2: FilterLogEvents limit, nextToken, logStreamNamePrefix, and conflict error", async () => {
    const client = logs();
    const groupName = "bunsai-logs6-med2-group";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "app-stream-1",
      }),
    );
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "app-stream-2",
      }),
    );
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: "other-stream",
      }),
    );

    const baseTime = 1700000000000;
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "app-stream-1",
        logEvents: [
          { timestamp: baseTime, message: "msg-1" },
          { timestamp: baseTime + 1000, message: "msg-2" },
        ],
      }),
    );
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "app-stream-2",
        logEvents: [
          { timestamp: baseTime + 2000, message: "msg-3" },
          { timestamp: baseTime + 3000, message: "msg-4" },
          { timestamp: baseTime + 4000, message: "msg-5" },
        ],
      }),
    );
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: "other-stream",
        logEvents: [{ timestamp: baseTime + 5000, message: "other-msg" }],
      }),
    );

    const fPage1 = await client.send(
      new FilterLogEventsCommand({ logGroupName: groupName, limit: 2 }),
    );
    expect(fPage1.events).toHaveLength(2);
    expect(fPage1.nextToken).toBeDefined();

    const fPage2 = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        limit: 2,
        nextToken: fPage1.nextToken,
      }),
    );
    expect(fPage2.events).toHaveLength(2);
    expect(fPage2.nextToken).toBeDefined();

    const fPage3 = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        limit: 2,
        nextToken: fPage2.nextToken,
      }),
    );
    expect(fPage3.events).toHaveLength(2);
    expect(fPage3.nextToken).toBeUndefined();

    const prefixResult = await client.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        logStreamNamePrefix: "app-",
      }),
    );
    const prefixMessages = (prefixResult.events ?? []).map((e) => e.message);
    expect(prefixMessages).not.toContain("other-msg");
    expect(prefixMessages).toContain("msg-1");

    await expect(
      client.send(
        new FilterLogEventsCommand({
          logGroupName: groupName,
          logStreamNames: ["app-stream-1"],
          logStreamNamePrefix: "app-",
        }),
      ),
    ).rejects.toThrow();

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("MEDIUM-3: CreateExportTask lifecycle — PENDING, COMPLETED after describe, CancelExportTask guards", async () => {
    const client = logs();
    const groupName = "bunsai-logs6-med3-group";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const created = await client.send(
      new CreateExportTaskCommand({
        logGroupName: groupName,
        from: Date.now() - 3600_000,
        to: Date.now(),
        destination: "bunsai-export-bucket",
      }),
    );
    expect(created.taskId).toBeDefined();

    await client.send(new CancelExportTaskCommand({ taskId: created.taskId! }));

    const afterCancel = await client.send(
      new DescribeExportTasksCommand({ taskId: created.taskId }),
    );
    expect(afterCancel.exportTasks?.[0]?.status?.code).toBe("CANCELLED");

    await expect(
      client.send(new CancelExportTaskCommand({ taskId: created.taskId! })),
    ).rejects.toThrow();

    const created2 = await client.send(
      new CreateExportTaskCommand({
        logGroupName: groupName,
        from: Date.now() - 3600_000,
        to: Date.now(),
        destination: "bunsai-export-bucket",
      }),
    );
    expect(created2.taskId).toBeDefined();

    await expect(
      client.send(
        new CreateExportTaskCommand({
          logGroupName: groupName,
          from: Date.now() - 3600_000,
          to: Date.now(),
          destination: "bunsai-export-bucket",
        }),
      ),
    ).rejects.toThrow();

    const described = await client.send(
      new DescribeExportTasksCommand({ taskId: created2.taskId }),
    );
    expect(described.exportTasks?.[0]?.status?.code).toBe("COMPLETED");

    await client.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
