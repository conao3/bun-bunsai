import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ListMessageMoveTasksCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
  SQSClient,
  StartMessageMoveTaskCommand,
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

  test("GetQueueAttributes round-trips RedrivePolicy", async () => {
    const client = sqs();
    const dlq = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-dlq-attr-target" }),
    );
    const dlqUrl = dlq.QueueUrl ?? "";
    const dlqArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-dlq-attr-target`;

    const source = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-dlq-attr-source" }),
    );
    const sourceUrl = source.QueueUrl ?? "";

    await client.send(
      new SetQueueAttributesCommand({
        QueueUrl: sourceUrl,
        Attributes: {
          RedrivePolicy: JSON.stringify({
            deadLetterTargetArn: dlqArn,
            maxReceiveCount: 3,
          }),
        },
      }),
    );

    const attrs = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: sourceUrl,
        AttributeNames: ["RedrivePolicy"],
      }),
    );
    const got = JSON.parse(attrs.Attributes?.RedrivePolicy ?? "{}") as {
      deadLetterTargetArn: string;
      maxReceiveCount: number;
    };
    expect(got.deadLetterTargetArn).toBe(dlqArn);
    expect(got.maxReceiveCount).toBe(3);

    await client.send(new DeleteQueueCommand({ QueueUrl: sourceUrl }));
    await client.send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  });

  test("StartMessageMoveTask moves messages from DLQ back to source", async () => {
    const client = sqs();
    const dlq = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-dlq-move-target" }),
    );
    const dlqUrl = dlq.QueueUrl ?? "";
    const dlqArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-dlq-move-target`;

    const source = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-dlq-move-source" }),
    );
    const sourceUrl = source.QueueUrl ?? "";
    const sourceArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-dlq-move-source`;

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
      new SendMessageCommand({
        QueueUrl: sourceUrl,
        MessageBody: "redrive-me",
      }),
    );

    const first = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    expect(first.Messages?.length).toBe(1);

    const second = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl, VisibilityTimeout: 0 }),
    );
    expect(second.Messages ?? []).toEqual([]);

    const inDlq = await client.send(
      new ReceiveMessageCommand({ QueueUrl: dlqUrl, VisibilityTimeout: 0 }),
    );
    expect(inDlq.Messages?.length).toBe(1);
    expect(inDlq.Messages?.[0]?.Body).toBe("redrive-me");

    const moveResp = await client.send(
      new StartMessageMoveTaskCommand({
        SourceArn: dlqArn,
        DestinationArn: sourceArn,
      }),
    );
    expect(moveResp.TaskHandle).toBeDefined();

    const listResp = await client.send(
      new ListMessageMoveTasksCommand({ SourceArn: dlqArn, MaxResults: 1 }),
    );
    expect(listResp.Results?.length).toBeGreaterThanOrEqual(1);
    expect(listResp.Results?.[0]?.Status).toBe("COMPLETED");
    expect(listResp.Results?.[0]?.ApproximateNumberOfMessagesMoved).toBe(1);

    const backOnSource = await client.send(
      new ReceiveMessageCommand({ QueueUrl: sourceUrl }),
    );
    expect(backOnSource.Messages?.length).toBe(1);
    expect(backOnSource.Messages?.[0]?.Body).toBe("redrive-me");

    await client.send(new DeleteQueueCommand({ QueueUrl: sourceUrl }));
    await client.send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  });
});
