import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
  StartMessageMoveTaskCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SQS scenario e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  test("producer/consumer drain via long polling", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-scenario-work" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: [
          { Id: "1", MessageBody: "task-1" },
          { Id: "2", MessageBody: "task-2" },
          { Id: "3", MessageBody: "task-3" },
        ],
      }),
    );

    const processed: string[] = [];
    while (processed.length < 3) {
      const received = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 1,
        }),
      );
      const messages = received.Messages ?? [];
      if (messages.length === 0) break;
      for (const message of messages) {
        processed.push(message.Body ?? "");
        await client.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle ?? "",
          }),
        );
      }
    }
    expect(processed.sort()).toEqual(["task-1", "task-2", "task-3"]);

    const drained = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    expect(drained.Messages ?? []).toEqual([]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("dead-letter redrive task moves messages back to the source", async () => {
    const client = sqs();
    const dlq = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-scenario-dlq" }),
    );
    const dlqUrl = dlq.QueueUrl ?? "";
    const dlqArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-scenario-dlq`;

    const source = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-scenario-src" }),
    );
    const sourceUrl = source.QueueUrl ?? "";
    await client.send(
      new SetQueueAttributesCommand({
        QueueUrl: sourceUrl,
        Attributes: {
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 1,
          }),
        },
      }),
    );

    await client.send(
      new SendMessageCommand({ QueueUrl: sourceUrl, MessageBody: "retry-me" }),
    );
    await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    const intoDlq = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    expect(intoDlq.Messages ?? []).toEqual([]);

    const inDlq = await client.send(
      new ReceiveMessageCommand({ QueueUrl: dlqUrl }),
    );
    expect(inDlq.Messages?.length).toBe(1);

    const moveTask = await client.send(
      new StartMessageMoveTaskCommand({ SourceArn: dlqArn }),
    );
    expect(moveTask.TaskHandle).toBeDefined();

    const backInSource = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: sourceUrl,
        WaitTimeSeconds: 1,
      }),
    );
    expect(backInSource.Messages?.length).toBe(1);
    expect(backInSource.Messages?.[0]?.Body).toBe("retry-me");

    await client.send(new DeleteQueueCommand({ QueueUrl: sourceUrl }));
    await client.send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  });
});
