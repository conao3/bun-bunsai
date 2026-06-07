import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
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
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
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
