import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
import {
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  DeleteEventSourceMappingCommand,
  GetEventSourceMappingCommand,
  LambdaClient,
  ListEventSourceMappingsCommand,
  UpdateEventSourceMappingCommand,
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

describe("EventSourceMapping lifecycle + SQS poll-to-invoke", () => {
  test("ESM round-trip and SQS message triggers Lambda invocation", async () => {
    const l = lambda();
    const q = sqs();
    const dir = mkdtempSync(join(tmpdir(), "bunsai-esm-rt-"));
    const marker = join(dir, "out.json");

    const createdQueue = await q.send(
      new CreateQueueCommand({ QueueName: "esm-rt-queue" }),
    );
    const queueUrl = createdQueue.QueueUrl as string;
    const attrs = await q.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn"],
      }),
    );
    const queueArn = attrs.Attributes?.QueueArn as string;

    await l.send(
      new CreateFunctionCommand({
        FunctionName: "esm-rt-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );

    const esm = await l.send(
      new CreateEventSourceMappingCommand({
        FunctionName: "esm-rt-fn",
        EventSourceArn: queueArn,
        BatchSize: 3,
        Enabled: true,
      }),
    );
    expect(esm.UUID).toBeDefined();
    expect(esm.EventSourceArn).toBe(queueArn);
    expect(esm.FunctionArn).toContain("esm-rt-fn");
    expect(esm.State).toBe("Enabled");
    expect(esm.BatchSize).toBe(3);

    const uuid = esm.UUID!;

    const got = await l.send(new GetEventSourceMappingCommand({ UUID: uuid }));
    expect(got.UUID).toBe(uuid);

    const updated = await l.send(
      new UpdateEventSourceMappingCommand({ UUID: uuid, BatchSize: 5 }),
    );
    expect(updated.BatchSize).toBe(5);

    const listed = await l.send(
      new ListEventSourceMappingsCommand({ FunctionName: "esm-rt-fn" }),
    );
    expect(listed.EventSourceMappings?.map((m) => m.UUID)).toContain(uuid);

    await q.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "hello esm" }),
    );
    const event = JSON.parse(readFileSync(marker, "utf8"));
    expect(event.Records[0].body).toBe("hello esm");
    expect(event.Records[0].eventSource).toBe("aws:sqs");
    expect(event.Records[0].eventSourceARN).toBe(queueArn);

    const recv = await q.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(recv.Messages ?? []).toHaveLength(0);

    await l.send(
      new UpdateEventSourceMappingCommand({ UUID: uuid, Enabled: false }),
    );
    const disabled = await l.send(
      new GetEventSourceMappingCommand({ UUID: uuid }),
    );
    expect(disabled.State).toBe("Disabled");

    await l.send(new DeleteEventSourceMappingCommand({ UUID: uuid }));
    await expect(
      l.send(new GetEventSourceMappingCommand({ UUID: uuid })),
    ).rejects.toThrow();
  });
});
