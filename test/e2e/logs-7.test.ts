import { gunzipSync } from "node:zlib";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DeleteLogGroupCommand,
  FilterLogEventsCommand,
  PutLogEventsCommand,
  PutSubscriptionFilterCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { makeZip, markerHandler } from "./event-helpers.ts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("logs e2e (CON-2180 — lambda subscription + filter pattern)", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });
  const lambda = () =>
    new LambdaClient({ endpoint, region, credentials, requestHandler });

  test("PutLogEvents delivers matching events to Lambda subscription filter", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunsai-logs7-"));
    const marker = join(dir, "out.json");

    const l = lambda();
    const c = logs();

    const groupName = "bunsai-logs7-lambda-group";
    const streamName = "bunsai-logs7-lambda-stream";
    const fnName = "bunsai-logs7-fn";
    const fnArn = `arn:aws:lambda:${region}:123456789012:function:${fnName}`;

    await l.send(
      new CreateFunctionCommand({
        FunctionName: fnName,
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::123456789012:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );

    await c.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await c.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    await c.send(
      new PutSubscriptionFilterCommand({
        logGroupName: groupName,
        filterName: "lambda-delivery",
        filterPattern: "CRITICAL",
        destinationArn: fnArn,
      }),
    );

    const now = Date.now();
    await c.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: now - 1000, message: "INFO: normal message" },
          { timestamp: now, message: "CRITICAL: alert triggered" },
        ],
      }),
    );

    const raw = readFileSync(marker, "utf8");
    const event = JSON.parse(raw) as {
      awslogs: { data: string };
    };
    expect(event.awslogs).toBeDefined();
    expect(typeof event.awslogs.data).toBe("string");

    const decompressed = gunzipSync(Buffer.from(event.awslogs.data, "base64"));
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
    expect(payload.subscriptionFilters).toContain("lambda-delivery");
    expect(payload.logEvents).toHaveLength(1);
    expect(payload.logEvents[0]!.message).toBe("CRITICAL: alert triggered");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: OR pattern ?a ?b matches either term", async () => {
    const c = logs();
    const groupName = "bunsai-logs7-or-group";
    const streamName = "bunsai-logs7-or-stream";

    await c.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await c.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const baseTime = 1700000000000;
    await c.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: baseTime, message: "alpha only" },
          { timestamp: baseTime + 1000, message: "beta only" },
          { timestamp: baseTime + 2000, message: "neither" },
          { timestamp: baseTime + 3000, message: "alpha and beta" },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "?alpha ?beta",
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toContain("alpha only");
    expect(messages).toContain("beta only");
    expect(messages).toContain("alpha and beta");
    expect(messages).not.toContain("neither");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: exclusion pattern -x removes matching messages", async () => {
    const c = logs();
    const groupName = "bunsai-logs7-excl-group";
    const streamName = "bunsai-logs7-excl-stream";

    await c.send(new CreateLogGroupCommand({ logGroupName: groupName }));
    await c.send(
      new CreateLogStreamCommand({
        logGroupName: groupName,
        logStreamName: streamName,
      }),
    );

    const baseTime = 1700000000000;
    await c.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          { timestamp: baseTime, message: "INFO: all good" },
          { timestamp: baseTime + 1000, message: "ERROR: something failed" },
          { timestamp: baseTime + 2000, message: "INFO: still running" },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "INFO -failed",
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toContain("INFO: all good");
    expect(messages).toContain("INFO: still running");
    expect(messages).not.toContain("ERROR: something failed");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
