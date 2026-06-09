import { gunzipSync } from "node:zlib";
import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  PutLogEventsCommand,
  PutMetricFilterCommand,
  PutSubscriptionFilterCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  CreateStreamCommand,
  DeleteStreamCommand,
  DescribeStreamCommand,
  GetRecordsCommand,
  GetShardIteratorCommand,
  KinesisClient,
} from "@aws-sdk/client-kinesis";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e (fidelity gaps — CON-1879)", () => {
  test("PutLogEvents emits CloudWatch metrics for matching metric filter", async () => {
    const logs = new CloudWatchLogsClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const cw = new CloudWatchClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const groupName = "bunsai-logs4-metric-group";
    const streamName = "bunsai-logs4-metric-stream";
    const namespace = "Bunsai/Logs4Test";
    const metricName = "ErrorCount4";

    await logs.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await logs.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    await logs.send(
      new PutMetricFilterCommand({
        logGroupName: groupName,
        filterName: "error-count-filter",
        filterPattern: "ERROR",
        metricTransformations: [
          {
            metricName,
            metricNamespace: namespace,
            metricValue: "1",
            defaultValue: 0,
          },
        ],
      }),
    );

    const now = Date.now();
    await logs.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: now - 2000, message: "INFO: normal message" },
          { timestamp: now - 1000, message: "ERROR: something failed" },
          { timestamp: now, message: "ERROR: another failure" },
        ],
      }),
    );

    const stats = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: namespace,
        MetricName: metricName,
        Dimensions: [],
        StartTime: new Date(now - 60000),
        EndTime: new Date(now + 60000),
        Period: 300,
        Statistics: ["Sum", "SampleCount"],
      }),
    );
    const points = stats.Datapoints ?? [];
    const totalSum = points.reduce((acc, p) => acc + (p.Sum ?? 0), 0);
    expect(totalSum).toBe(2);

    await logs.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("PutLogEvents delivers matching events to Kinesis subscription filter", async () => {
    const logs = new CloudWatchLogsClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const kinesis = new KinesisClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const groupName = "bunsai-logs4-sub-group";
    const streamName = "bunsai-logs4-sub-logstream";
    const kinesisStreamName = "bunsai-logs4-kinesis-stream";
    const kinesisArn = `arn:aws:kinesis:${region}:123456789012:stream/${kinesisStreamName}`;

    await kinesis.send(
      new CreateStreamCommand({
        StreamName: kinesisStreamName,
        ShardCount: 1,
      }),
    );
    await logs.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await logs.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    await logs.send(
      new PutSubscriptionFilterCommand({
        logGroupName: groupName,
        filterName: "critical-delivery",
        filterPattern: "CRITICAL",
        destinationArn: kinesisArn,
      }),
    );

    const now = Date.now();
    await logs.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: now - 1000, message: "INFO: normal message" },
          { timestamp: now, message: "CRITICAL: alert triggered" },
        ],
      }),
    );

    const described = await kinesis.send(
      new DescribeStreamCommand({ StreamName: kinesisStreamName }),
    );
    const shard = (described.StreamDescription?.Shards ?? [])[0];
    expect(shard?.ShardId).toBeDefined();

    const iterator = await kinesis.send(
      new GetShardIteratorCommand({
        StreamName: kinesisStreamName,
        ShardId: shard!.ShardId,
        ShardIteratorType: "TRIM_HORIZON",
      }),
    );

    const records = await kinesis.send(
      new GetRecordsCommand({ ShardIterator: iterator.ShardIterator }),
    );
    expect((records.Records ?? []).length).toBeGreaterThanOrEqual(1);

    const firstRecord = (records.Records ?? [])[0]!;
    const decompressed = gunzipSync(Buffer.from(firstRecord.Data!));
    const payload = JSON.parse(decompressed.toString()) as {
      messageType: string;
      owner: string;
      logGroup: string;
      logStream: string;
      subscriptionFilters: string[];
      logEvents: { id: string; timestamp: number; message: string }[];
    };
    expect(payload.messageType).toBe("DATA_MESSAGE");
    expect(payload.logGroup).toBe(groupName);
    expect(payload.logStream).toBe(streamName);
    expect(payload.subscriptionFilters).toContain("critical-delivery");
    expect(payload.logEvents.length).toBe(1);
    expect(payload.logEvents[0]!.message).toBe("CRITICAL: alert triggered");

    await logs.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
    await kinesis.send(
      new DeleteStreamCommand({ StreamName: kinesisStreamName }),
    );
  });

  test("DescribeLogGroups supports nextToken pagination", async () => {
    const logs = new CloudWatchLogsClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const prefix = "bunsai-logs4-pag-group-";

    for (let i = 0; i < 3; i++) {
      await logs.send(
        new CreateLogGroupCommand({ logGroupName: `${prefix}${i}` }),
      );
    }

    const page1 = await logs.send(
      new DescribeLogGroupsCommand({ logGroupNamePrefix: prefix, limit: 2 }),
    );
    expect((page1.logGroups ?? []).length).toBe(2);
    expect(page1.nextToken).toBeDefined();

    const page2 = await logs.send(
      new DescribeLogGroupsCommand({
        logGroupNamePrefix: prefix,
        limit: 2,
        nextToken: page1.nextToken,
      }),
    );
    expect((page2.logGroups ?? []).length).toBe(1);
    expect(page2.nextToken).toBeUndefined();

    const allNames = [
      ...(page1.logGroups ?? []).map((g) => g.logGroupName),
      ...(page2.logGroups ?? []).map((g) => g.logGroupName),
    ];
    expect(allNames).toContain(`${prefix}0`);
    expect(allNames).toContain(`${prefix}1`);
    expect(allNames).toContain(`${prefix}2`);

    for (let i = 0; i < 3; i++) {
      await logs.send(
        new DeleteLogGroupCommand({ logGroupName: `${prefix}${i}` }),
      );
    }
  });

  test("DescribeLogStreams supports nextToken pagination", async () => {
    const logs = new CloudWatchLogsClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const groupName = "bunsai-logs4-pag-stream-group";

    await logs.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    for (let i = 0; i < 3; i++) {
      await logs.send(
        new CreateLogStreamCommand({
          logGroupName: groupName,
          logStreamName: `pagstream-${i}`,
        }),
      );
    }

    const page1 = await logs.send(
      new DescribeLogStreamsCommand({ logGroupName: groupName, limit: 2 }),
    );
    expect((page1.logStreams ?? []).length).toBe(2);
    expect(page1.nextToken).toBeDefined();

    const page2 = await logs.send(
      new DescribeLogStreamsCommand({
        logGroupName: groupName,
        limit: 2,
        nextToken: page1.nextToken,
      }),
    );
    expect((page2.logStreams ?? []).length).toBe(1);
    expect(page2.nextToken).toBeUndefined();

    const allNames = [
      ...(page1.logStreams ?? []).map((s) => s.logStreamName),
      ...(page2.logStreams ?? []).map((s) => s.logStreamName),
    ];
    expect(allNames).toContain("pagstream-0");
    expect(allNames).toContain("pagstream-1");
    expect(allNames).toContain("pagstream-2");

    await logs.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
