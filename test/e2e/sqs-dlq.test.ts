import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SQS dead-letter redrive e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  test("message exceeding maxReceiveCount moves to the dead-letter queue", async () => {
    const client = sqs();
    const dlq = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-dlq-target" }),
    );
    const dlqUrl = dlq.QueueUrl ?? "";
    const dlqArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-dlq-target`;

    const source = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-dlq-source" }),
    );
    const sourceUrl = source.QueueUrl ?? "";
    await client.send(
      new SetQueueAttributesCommand({
        QueueUrl: sourceUrl,
        Attributes: {
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 2,
          }),
        },
      }),
    );

    await client.send(
      new SendMessageCommand({
        QueueUrl: sourceUrl,
        MessageBody: "poison",
      }),
    );

    const first = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    expect(first.Messages?.length).toBe(1);
    const second = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    expect(second.Messages?.length).toBe(1);

    const third = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    expect(third.Messages ?? []).toEqual([]);

    const fromDlq = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: dlqUrl,
        MessageSystemAttributeNames: ["All"],
      }),
    );
    expect(fromDlq.Messages?.length).toBe(1);
    expect(fromDlq.Messages?.[0]?.Body).toBe("poison");
    expect(fromDlq.Messages?.[0]?.Attributes?.ApproximateReceiveCount).toBe(
      "1",
    );

    await client.send(new DeleteQueueCommand({ QueueUrl: sourceUrl }));
    await client.send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  });
});
