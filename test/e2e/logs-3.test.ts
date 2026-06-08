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
  StopQueryCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e (Insights queries)", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });

  test("StartQuery → GetQueryResults lifecycle with log events", async () => {
    const client = logs();
    const groupName = "bunsai-insights-group";
    const streamName = "bunsai-insights-stream";

    await client.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await client.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const now = Date.now();
    await client.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: now - 2000, message: "first message" },
          { timestamp: now - 1000, message: "second message" },
        ],
      }),
    );

    const startTime = Math.floor((now - 10000) / 1000);
    const endTime = Math.floor((now + 10000) / 1000);

    const startRes = await client.send(
      new StartQueryCommand({
        logGroupName: groupName,
        queryString: "fields @timestamp, @message",
        startTime,
        endTime,
      }),
    );
    expect(startRes.queryId).toBeDefined();
    const queryId = startRes.queryId!;

    const resultsRes = await client.send(
      new GetQueryResultsCommand({ queryId }),
    );
    expect(resultsRes.status).toBe("Complete");
    expect(resultsRes.results).toBeDefined();
    expect(resultsRes.results!.length).toBe(2);

    const fields0 = resultsRes.results![0]!;
    const ts0 = fields0.find((f) => f.field === "@timestamp");
    const msg0 = fields0.find((f) => f.field === "@message");
    expect(ts0).toBeDefined();
    expect(msg0).toBeDefined();

    const statistics = resultsRes.statistics;
    expect(statistics).toBeDefined();
    expect(statistics!.recordsMatched).toBe(2);
    expect(statistics!.recordsScanned).toBe(2);
  });

  test("DescribeQueries filters by logGroupName and status", async () => {
    const client = logs();
    const groupName = "bunsai-insights-group";

    const startTime = Math.floor(Date.now() / 1000) - 3600;
    const endTime = Math.floor(Date.now() / 1000) + 3600;

    await client.send(
      new StartQueryCommand({
        logGroupName: groupName,
        queryString: "fields @timestamp",
        startTime,
        endTime,
      }),
    );

    const descRes = await client.send(
      new DescribeQueriesCommand({ logGroupName: groupName }),
    );
    expect(descRes.queries).toBeDefined();
    expect(descRes.queries!.length).toBeGreaterThanOrEqual(1);

    const completeRes = await client.send(
      new DescribeQueriesCommand({ status: "Complete" }),
    );
    expect(completeRes.queries).toBeDefined();
    expect(completeRes.queries!.some((q) => q.logGroupName === groupName)).toBe(
      true,
    );
  });

  test("StopQuery cancels a running query", async () => {
    const client = logs();
    const groupName = "bunsai-insights-group";

    const startTime = Math.floor(Date.now() / 1000) - 3600;
    const endTime = Math.floor(Date.now() / 1000) + 3600;

    const startRes = await client.send(
      new StartQueryCommand({
        logGroupName: groupName,
        queryString: "fields @timestamp",
        startTime,
        endTime,
      }),
    );
    const queryId = startRes.queryId!;

    const stopRes = await client.send(new StopQueryCommand({ queryId }));
    expect(stopRes.success).toBe(true);

    const resultsRes = await client.send(
      new GetQueryResultsCommand({ queryId }),
    );
    expect(resultsRes.status).toBe("Cancelled");
  });

  test("StartQuery with missing log group throws ResourceNotFoundException", async () => {
    const client = logs();
    await expect(
      client.send(
        new StartQueryCommand({
          logGroupName: "nonexistent-insights-group",
          queryString: "fields @timestamp",
          startTime: Math.floor(Date.now() / 1000) - 3600,
          endTime: Math.floor(Date.now() / 1000) + 3600,
        }),
      ),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  });
});
