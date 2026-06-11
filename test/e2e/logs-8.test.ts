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

describe("logs e2e (CON-2188 — JSON filter pattern)", () => {
  const logs = () =>
    new CloudWatchLogsClient({ endpoint, region, credentials, requestHandler });
  const lambda = () =>
    new LambdaClient({ endpoint, region, credentials, requestHandler });

  test('FilterLogEvents: { $.level = "error" } returns only matching JSON lines', async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-str-group";
    const streamName = "bunsai-logs8-json-str-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({ level: "info", msg: "all good" }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({
              level: "error",
              msg: "something failed",
            }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({ level: "error", msg: "another failure" }),
          },
          {
            timestamp: baseTime + 3000,
            message: JSON.stringify({ level: "warn", msg: "watch out" }),
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: '{ $.level = "error" }',
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m?.includes("something failed"))).toBe(true);
    expect(messages.some((m) => m?.includes("another failure"))).toBe(true);
    expect(messages.some((m) => m?.includes("all good"))).toBe(false);

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: { $.status >= 500 } returns numeric comparison matches", async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-num-group";
    const streamName = "bunsai-logs8-json-num-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({ status: 200, path: "/ok" }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({ status: 404, path: "/not-found" }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({ status: 500, path: "/error" }),
          },
          {
            timestamp: baseTime + 3000,
            message: JSON.stringify({ status: 503, path: "/unavailable" }),
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "{ $.status >= 500 }",
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m?.includes("/error"))).toBe(true);
    expect(messages.some((m) => m?.includes("/unavailable"))).toBe(true);
    expect(messages.some((m) => m?.includes("/ok"))).toBe(false);
    expect(messages.some((m) => m?.includes("/not-found"))).toBe(false);

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: && compound condition matches only both-true rows", async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-and-group";
    const streamName = "bunsai-logs8-json-and-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({
              level: "error",
              code: "E001",
              msg: "match both",
            }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({
              level: "error",
              code: "E002",
              msg: "wrong code",
            }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({
              level: "info",
              code: "E001",
              msg: "wrong level",
            }),
          },
          {
            timestamp: baseTime + 3000,
            message: JSON.stringify({
              level: "info",
              code: "E002",
              msg: "neither",
            }),
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: '{ $.level = "error" && $.code = "E001" }',
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("match both");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: JSON pattern excludes non-JSON lines", async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-nonjson-group";
    const streamName = "bunsai-logs8-json-nonjson-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({ level: "error", msg: "json error" }),
          },
          {
            timestamp: baseTime + 1000,
            message: "plain text error line",
          },
          {
            timestamp: baseTime + 2000,
            message: "ERROR: not json at all",
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: '{ $.level = "error" }',
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("json error");
    expect(messages.some((m) => m?.includes("plain text"))).toBe(false);
    expect(messages.some((m) => m?.includes("not json"))).toBe(false);

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: IS NULL matches null field, not missing field", async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-isnull-group";
    const streamName = "bunsai-logs8-json-isnull-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({ foo: null, tag: "has-null" }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({ tag: "missing-foo" }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({ foo: "value", tag: "has-value" }),
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "{ $.foo IS NULL }",
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("has-null");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: NOT EXISTS matches missing field, not null field", async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-notexists-group";
    const streamName = "bunsai-logs8-json-notexists-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({ tag: "missing-foo" }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({ foo: null, tag: "has-null" }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({ foo: "value", tag: "has-value" }),
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "{ $.foo NOT EXISTS }",
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("missing-foo");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test('FilterLogEvents: IS TRUE / IS FALSE matches boolean only, not string "true"', async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-istrue-group";
    const streamName = "bunsai-logs8-json-istrue-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({ flag: true, tag: "bool-true" }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({ flag: false, tag: "bool-false" }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({ flag: "true", tag: "str-true" }),
          },
          {
            timestamp: baseTime + 3000,
            message: JSON.stringify({ flag: "false", tag: "str-false" }),
          },
        ],
      }),
    );

    const trueResult = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "{ $.flag IS TRUE }",
      }),
    );
    const trueMessages = (trueResult.events ?? []).map((e) => e.message);
    expect(trueMessages).toHaveLength(1);
    expect(trueMessages[0]).toContain("bool-true");

    const falseResult = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: "{ $.flag IS FALSE }",
      }),
    );
    const falseMessages = (falseResult.events ?? []).map((e) => e.message);
    expect(falseMessages).toHaveLength(1);
    expect(falseMessages[0]).toContain("bool-false");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("FilterLogEvents: IS NULL && compound condition", async () => {
    const c = logs();
    const groupName = "bunsai-logs8-json-isnull-and-group";
    const streamName = "bunsai-logs8-json-isnull-and-stream";

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
          {
            timestamp: baseTime,
            message: JSON.stringify({
              foo: null,
              level: "error",
              tag: "null+error",
            }),
          },
          {
            timestamp: baseTime + 1000,
            message: JSON.stringify({
              foo: null,
              level: "info",
              tag: "null+info",
            }),
          },
          {
            timestamp: baseTime + 2000,
            message: JSON.stringify({ level: "error", tag: "missing+error" }),
          },
        ],
      }),
    );

    const result = await c.send(
      new FilterLogEventsCommand({
        logGroupName: groupName,
        filterPattern: '{ $.foo IS NULL && $.level = "error" }',
      }),
    );
    const messages = (result.events ?? []).map((e) => e.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("null+error");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });

  test("PutLogEvents delivers JSON-matching events to Lambda subscription filter", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunsai-logs8-"));
    const marker = join(dir, "out.json");

    const l = lambda();
    const c = logs();

    const groupName = "bunsai-logs8-lambda-group";
    const streamName = "bunsai-logs8-lambda-stream";
    const fnName = "bunsai-logs8-fn";
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
        filterName: "json-error-delivery",
        filterPattern: '{ $.level = "error" }',
        destinationArn: fnArn,
      }),
    );

    const now = Date.now();
    await c.send(
      new PutLogEventsCommand({
        logGroupName: groupName,
        logStreamName: streamName,
        logEvents: [
          {
            timestamp: now - 1000,
            message: JSON.stringify({ level: "info", msg: "normal" }),
          },
          {
            timestamp: now,
            message: JSON.stringify({
              level: "error",
              msg: "critical failure",
            }),
          },
        ],
      }),
    );

    const raw = readFileSync(marker, "utf8");
    const event = JSON.parse(raw) as {
      awslogs: { data: string };
    };
    expect(event.awslogs).toBeDefined();

    const decompressed = gunzipSync(Buffer.from(event.awslogs.data, "base64"));
    const payload = JSON.parse(decompressed.toString()) as {
      messageType: string;
      logGroup: string;
      logStream: string;
      subscriptionFilters: string[];
      logEvents: { id: string; timestamp: number; message: string }[];
    };

    expect(payload.messageType).toBe("DATA_MESSAGE");
    expect(payload.logGroup).toBe(groupName);
    expect(payload.logStream).toBe(streamName);
    expect(payload.subscriptionFilters).toContain("json-error-delivery");
    expect(payload.logEvents).toHaveLength(1);
    expect(payload.logEvents[0]!.message).toContain("critical failure");

    await c.send(new DeleteLogGroupCommand({ logGroupName: groupName }));
  });
});
