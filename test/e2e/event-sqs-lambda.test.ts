import { describe, expect, test } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import {
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });

const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number): number[] => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >> 16) & 0xff,
  (n >> 24) & 0xff,
];

const makeZip = (name: string, source: string): Uint8Array => {
  const encoder = new TextEncoder();
  const nameBytes = [...encoder.encode(name)];
  const content = encoder.encode(source);
  const compressed = [...deflateRawSync(content)];
  const local = [
    ...u32(0x04034b50),
    ...u16(20),
    ...u16(0),
    ...u16(8),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(compressed.length),
    ...u32(content.length),
    ...u16(nameBytes.length),
    ...u16(0),
    ...nameBytes,
    ...compressed,
  ];
  const central = [
    ...u32(0x02014b50),
    ...u16(20),
    ...u16(20),
    ...u16(0),
    ...u16(8),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(compressed.length),
    ...u32(content.length),
    ...u16(nameBytes.length),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u16(0),
    ...u32(0),
    ...u32(0),
    ...nameBytes,
  ];
  const eocd = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(1),
    ...u16(1),
    ...u32(central.length),
    ...u32(local.length),
    ...u16(0),
  ];
  return new Uint8Array([...local, ...central, ...eocd]);
};

const markerHandler =
  "const fs = require('fs'); exports.handler = async (event) => { fs.writeFileSync(process.env.MARKER_PATH, JSON.stringify(event)); return { ok: true }; };";

describe("SQS event source mapping triggers Lambda", () => {
  test("SendMessage invokes the mapped function and consumes the message", async () => {
    const l = lambda();
    const q = sqs();
    const dir = mkdtempSync(join(tmpdir(), "bunsai-esm-"));
    const marker = join(dir, "out.json");

    const created = await q.send(
      new CreateQueueCommand({ QueueName: "esm-queue" }),
    );
    const queueUrl = created.QueueUrl as string;
    const attrs = await q.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn"],
      }),
    );
    const queueArn = attrs.Attributes?.QueueArn as string;

    await l.send(
      new CreateFunctionCommand({
        FunctionName: "esm-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip("index.js", markerHandler) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );
    await l.send(
      new CreateEventSourceMappingCommand({
        FunctionName: "esm-fn",
        EventSourceArn: queueArn,
        Enabled: true,
      }),
    );

    await q.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "hello-esm" }),
    );

    const event = JSON.parse(readFileSync(marker, "utf8"));
    expect(event.Records).toHaveLength(1);
    expect(event.Records[0].body).toBe("hello-esm");
    expect(event.Records[0].eventSource).toBe("aws:sqs");
    expect(event.Records[0].eventSourceARN).toBe(queueArn);

    const received = await q.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(received.Messages ?? []).toHaveLength(0);
  });
});
