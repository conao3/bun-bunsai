import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ChangeMessageVisibilityCommand,
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("SQS message lifecycle e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  test("visibility timeout hides then re-exposes a message", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-visibility" }),
    );
    const queueUrl = created.QueueUrl ?? "";
    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "hello" }),
    );

    const first = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, VisibilityTimeout: 30 }),
    );
    expect(first.Messages?.length).toBe(1);
    const receipt = first.Messages?.[0]?.ReceiptHandle ?? "";

    const hidden = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(hidden.Messages ?? []).toEqual([]);

    await client.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receipt,
        VisibilityTimeout: 0,
      }),
    );

    const again = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(again.Messages?.length).toBe(1);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("delayed message is invisible until the delay elapses", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-delay" }),
    );
    const queueUrl = created.QueueUrl ?? "";
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "later",
        DelaySeconds: 1,
      }),
    );

    const early = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(early.Messages ?? []).toEqual([]);

    await sleep(1200);

    const late = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(late.Messages?.length).toBe(1);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("system attributes are returned when requested", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-sysattr" }),
    );
    const queueUrl = created.QueueUrl ?? "";
    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "meta" }),
    );

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MessageSystemAttributeNames: ["All"],
        VisibilityTimeout: 0,
      }),
    );
    const attributes = received.Messages?.[0]?.Attributes ?? {};
    expect(attributes.ApproximateReceiveCount).toBe("1");
    expect(Number(attributes.SentTimestamp)).toBeGreaterThan(0);
    expect(Number(attributes.ApproximateFirstReceiveTimestamp)).toBeGreaterThan(
      0,
    );
    expect(attributes.SenderId).toBeDefined();

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("message attributes round trip with a valid MD5 digest", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-msgattr" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const sent = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "with-attrs",
        MessageAttributes: {
          author: { DataType: "String", StringValue: "ada" },
          count: { DataType: "Number", StringValue: "42" },
        },
      }),
    );
    expect(sent.MD5OfMessageAttributes).toBeDefined();

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MessageAttributeNames: ["All"],
      }),
    );
    const message = received.Messages?.[0];
    expect(message?.MessageAttributes?.author?.StringValue).toBe("ada");
    expect(message?.MessageAttributes?.count?.StringValue).toBe("42");
    expect(message?.MD5OfMessageAttributes).toBe(sent.MD5OfMessageAttributes);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
