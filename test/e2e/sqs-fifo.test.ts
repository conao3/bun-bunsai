import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SQS FIFO e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  const createFifo = async (client: SQSClient, name: string) => {
    const created = await client.send(
      new CreateQueueCommand({
        QueueName: name,
        Attributes: { FifoQueue: "true" },
      }),
    );
    return created.QueueUrl ?? "";
  };

  test("rejects FifoQueue=true without a .fifo name", async () => {
    const client = sqs();
    await expect(
      client.send(
        new CreateQueueCommand({
          QueueName: "bunsai-e2e-fifo-badname",
          Attributes: { FifoQueue: "true" },
        }),
      ),
    ).rejects.toThrow();
  });

  test("preserves per-group order and assigns sequence numbers", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "bunsai-e2e-order.fifo");

    for (const body of ["m1", "m2", "m3"]) {
      const sent = await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: body,
          MessageGroupId: "g1",
          MessageDeduplicationId: body,
        }),
      );
      expect(sent.SequenceNumber).toBeDefined();
    }

    const bodies: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const received = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MessageSystemAttributeNames: ["All"],
        }),
      );
      const message = received.Messages?.[0];
      expect(message).toBeDefined();
      expect(message?.Attributes?.SequenceNumber).toBeDefined();
      expect(message?.Attributes?.MessageGroupId).toBe("g1");
      bodies.push(message?.Body ?? "");
      await client.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message?.ReceiptHandle ?? "",
        }),
      );
    }
    expect(bodies).toEqual(["m1", "m2", "m3"]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("deduplicates messages with the same deduplication id", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "bunsai-e2e-dedup.fifo");

    const first = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "once",
        MessageGroupId: "g1",
        MessageDeduplicationId: "dup-1",
      }),
    );
    const second = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "once",
        MessageGroupId: "g1",
        MessageDeduplicationId: "dup-1",
      }),
    );
    expect(second.MessageId).toBe(first.MessageId);
    expect(second.SequenceNumber).toBe(first.SequenceNumber);

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
      }),
    );
    expect(received.Messages?.length).toBe(1);
    expect(received.Messages?.[0]?.Body).toBe("once");
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: received.Messages?.[0]?.ReceiptHandle ?? "",
      }),
    );

    const drained = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
      }),
    );
    expect(drained.Messages ?? []).toEqual([]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("locks an in-flight group but serves other groups", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "bunsai-e2e-grouplock.fifo");

    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "a1",
        MessageGroupId: "ga",
        MessageDeduplicationId: "a1",
      }),
    );
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "a2",
        MessageGroupId: "ga",
        MessageDeduplicationId: "a2",
      }),
    );
    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "b1",
        MessageGroupId: "gb",
        MessageDeduplicationId: "b1",
      }),
    );

    const first = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, VisibilityTimeout: 30 }),
    );
    expect(first.Messages?.[0]?.Body).toBe("a1");

    const second = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, VisibilityTimeout: 30 }),
    );
    expect(second.Messages?.[0]?.Body).toBe("b1");

    await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: first.Messages?.[0]?.ReceiptHandle ?? "",
      }),
    );

    const third = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, VisibilityTimeout: 30 }),
    );
    expect(third.Messages?.[0]?.Body).toBe("a2");

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
