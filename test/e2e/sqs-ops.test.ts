import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  ChangeMessageVisibilityBatchCommand,
  ChangeMessageVisibilityCommand,
  CreateQueueCommand,
  DeleteMessageBatchCommand,
  DeleteQueueCommand,
  ListDeadLetterSourceQueuesCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("SQS batch ops e2e", () => {
  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const sqs = () => new SQSClient({ endpoint, region, credentials });

  test("send/delete/visibility batch round trip", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-batch" }),
    );
    const queueUrl = created.QueueUrl ?? "";
    expect(queueUrl).not.toBe("");

    const sent = await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: [
          { Id: "a", MessageBody: "alpha" },
          { Id: "b", MessageBody: "beta" },
          { Id: "c", MessageBody: "gamma" },
        ],
      }),
    );
    expect(sent.Successful?.length).toBe(3);
    expect(sent.Failed ?? []).toEqual([]);
    const sentIds = (sent.Successful ?? []).map((entry) => entry.Id).sort();
    expect(sentIds).toEqual(["a", "b", "c"]);

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
      }),
    );
    const messages = received.Messages ?? [];
    expect(messages.length).toBe(3);

    const changed = await client.send(
      new ChangeMessageVisibilityBatchCommand({
        QueueUrl: queueUrl,
        Entries: messages.map((message, index) => ({
          Id: String(index),
          ReceiptHandle: message.ReceiptHandle ?? "",
          VisibilityTimeout: 60,
        })),
      }),
    );
    expect(changed.Successful?.length).toBe(3);
    expect(changed.Failed ?? []).toEqual([]);

    await client.send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: messages[0]?.ReceiptHandle ?? "",
        VisibilityTimeout: 0,
      }),
    );

    const deleted = await client.send(
      new DeleteMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: messages.map((message, index) => ({
          Id: String(index),
          ReceiptHandle: message.ReceiptHandle ?? "",
        })),
      }),
    );
    expect(deleted.Successful?.length).toBe(3);
    expect(deleted.Failed ?? []).toEqual([]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("list dead letter source queues", async () => {
    const client = sqs();
    const dlq = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-dlq" }),
    );
    const dlqUrl = dlq.QueueUrl ?? "";
    expect(dlqUrl).not.toBe("");

    const source = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-source" }),
    );
    const sourceUrl = source.QueueUrl ?? "";
    const dlqArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-sqs-dlq`;

    await client.send(
      new SetQueueAttributesCommand({
        QueueUrl: sourceUrl,
        Attributes: {
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 5,
          }),
        },
      }),
    );

    const listed = await client.send(
      new ListDeadLetterSourceQueuesCommand({ QueueUrl: dlqUrl }),
    );
    expect(listed.queueUrls ?? []).toContain(sourceUrl);

    await client.send(new DeleteQueueCommand({ QueueUrl: sourceUrl }));
    await client.send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  });
});
