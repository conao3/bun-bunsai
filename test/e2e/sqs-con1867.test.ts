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

describe("SQS CON-1867: visibility timeout, long polling, ChangeMessageVisibility", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  test("received message is invisible until VisibilityTimeout elapses", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "con1867-visibility" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "msg" }),
    );

    const first = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, VisibilityTimeout: 30 }),
    );
    expect(first.Messages?.length).toBe(1);

    const hidden = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(hidden.Messages ?? []).toEqual([]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("ChangeMessageVisibility=0 makes message immediately receivable again", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "con1867-change-visibility" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "msg" }),
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

    const visible = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(visible.Messages?.length).toBe(1);
    expect(visible.Messages?.[0]?.Body).toBe("msg");

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("long polling returns immediately when message is already present", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "con1867-longpoll-immediate" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "ready" }),
    );

    const started = Date.now();
    const received = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: 5 }),
    );
    const elapsed = Date.now() - started;

    expect(received.Messages?.length).toBe(1);
    expect(received.Messages?.[0]?.Body).toBe("ready");
    expect(elapsed).toBeLessThan(2000);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
