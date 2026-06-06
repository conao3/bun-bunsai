import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SQS long polling e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  test("long poll returns as soon as a message arrives", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-longpoll" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const receivePromise = client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: 3 }),
    );

    setTimeout(() => {
      void client.send(
        new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "arrived" }),
      );
    }, 400);

    const started = Date.now();
    const received = await receivePromise;
    const elapsed = Date.now() - started;

    expect(received.Messages?.length).toBe(1);
    expect(received.Messages?.[0]?.Body).toBe("arrived");
    expect(elapsed).toBeLessThan(3000);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("long poll on an empty queue returns empty after the wait", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-longpoll-empty" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const started = Date.now();
    const received = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: 1 }),
    );
    const elapsed = Date.now() - started;

    expect(received.Messages ?? []).toEqual([]);
    expect(elapsed).toBeGreaterThanOrEqual(900);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("queue default ReceiveMessageWaitTimeSeconds drives long polling", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({
        QueueName: "bunsai-e2e-sqs-longpoll-default",
        Attributes: { ReceiveMessageWaitTimeSeconds: "1" },
      }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const started = Date.now();
    const received = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    const elapsed = Date.now() - started;

    expect(received.Messages ?? []).toEqual([]);
    expect(elapsed).toBeGreaterThanOrEqual(900);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
