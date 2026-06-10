import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeQueriesCommand,
  GetQueryResultsCommand,
  PutLogEventsCommand,
  StartQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs Insights scenario", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });

  test("filter @message like + sort @timestamp desc + limit 2", async () => {
    const client = logs();
    const groupName = "insights-scenario-group";
    const streamName = "insights-scenario-stream";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const base = Date.now();
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          {
            timestamp: base + 100,
            message: '{"level":"info","message":"INFO event one"}',
          },
          {
            timestamp: base + 200,
            message: '{"level":"error","message":"ERROR event two"}',
          },
          {
            timestamp: base + 300,
            message: '{"level":"info","message":"INFO event three"}',
          },
          {
            timestamp: base + 400,
            message: '{"level":"error","message":"ERROR event four"}',
          },
          {
            timestamp: base + 500,
            message: '{"level":"error","message":"ERROR event five"}',
          },
        ],
      }),
    );

    const startTime = Math.floor((base - 5000) / 1000);
    const endTime = Math.floor((base + 10000) / 1000);

    const { queryId } = await client.send(
      new StartQueryCommand({
        logGroupName: groupName,
        queryString:
          "fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 2",
        startTime,
        endTime,
      }),
    );
    expect(queryId).toBeDefined();

    const res = await client.send(
      new GetQueryResultsCommand({ queryId: queryId! }),
    );
    expect(res.status).toBe("Complete");

    const rows = res.results ?? [];
    expect(rows.length).toBe(2);

    const messages = rows.map(
      (row) => row.find((f) => f.field === "@message")?.value ?? "",
    );
    for (const msg of messages) {
      expect(msg).toMatch(/ERROR/);
    }

    const timestamps = rows.map((row) => {
      const ts = row.find((f) => f.field === "@timestamp")?.value ?? "0";
      return Number(ts);
    });
    expect(timestamps[0]!).toBeGreaterThanOrEqual(timestamps[1]!);
  });

  test("filter level = 'error' via JSON field extraction", async () => {
    const client = logs();
    const groupName = "insights-scenario-group-eq";
    const streamName = "insights-scenario-stream-eq";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const base = Date.now();
    const startTime = Math.floor((base - 1000) / 1000);
    const endTime = Math.floor((base + 10000) / 1000);

    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          {
            timestamp: base + 1000,
            message: '{"level":"info","message":"INFO only"}',
          },
          {
            timestamp: base + 2000,
            message: '{"level":"error","message":"JSON error row"}',
          },
        ],
      }),
    );

    const { queryId } = await client.send(
      new StartQueryCommand({
        logGroupName: groupName,
        queryString: 'fields @timestamp, @message | filter level = "error"',
        startTime,
        endTime,
      }),
    );
    expect(queryId).toBeDefined();

    const res = await client.send(
      new GetQueryResultsCommand({ queryId: queryId! }),
    );
    expect(res.status).toBe("Complete");

    const rows = res.results ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (const row of rows) {
      const msg = row.find((f) => f.field === "@message")?.value ?? "";
      expect(msg).toContain("JSON error row");
    }
  });

  test("DescribeQueries shows execution history", async () => {
    const client = logs();
    const groupName = "insights-scenario-group-desc";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));

    const startTime = Math.floor(Date.now() / 1000) - 3600;
    const endTime = Math.floor(Date.now() / 1000) + 3600;

    await client.send(
      new StartQueryCommand({
        logGroupName: groupName,
        queryString: "fields @timestamp, @message | limit 1",
        startTime,
        endTime,
      }),
    );

    const descRes = await client.send(
      new DescribeQueriesCommand({ logGroupName: groupName }),
    );
    expect(descRes.queries).toBeDefined();
    expect(descRes.queries!.length).toBeGreaterThanOrEqual(1);

    const q = descRes.queries!.find((q) => q.logGroupName === groupName);
    expect(q).toBeDefined();
    expect(q!.queryString).toBeDefined();
    expect(q!.status).toBeDefined();
  });
});
