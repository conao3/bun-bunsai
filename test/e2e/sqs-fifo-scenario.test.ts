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

describe("SQS FIFO scenario e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  const createFifo = async (
    client: SQSClient,
    name: string,
    extraAttrs: Record<string, string> = {},
  ) => {
    const created = await client.send(
      new CreateQueueCommand({
        QueueName: name,
        Attributes: { FifoQueue: "true", ...extraAttrs },
      }),
    );
    return created.QueueUrl ?? "";
  };

  test("scenario 1: rejects FifoQueue=true without .fifo suffix", async () => {
    const client = sqs();
    await expect(
      client.send(
        new CreateQueueCommand({
          QueueName: "fifo-scenario-no-suffix",
          Attributes: { FifoQueue: "true" },
        }),
      ),
    ).rejects.toMatchObject({ name: "InvalidParameterValue" });
  });

  test("scenario 2: 5 messages in same group are received in send order", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "fifo-scen-ordering.fifo");

    for (let i = 1; i <= 5; i++) {
      await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: `msg-${i}`,
          MessageGroupId: "g1",
          MessageDeduplicationId: `id-${i}`,
        }),
      );
    }

    const received: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await client.send(
        new ReceiveMessageCommand({ QueueUrl: queueUrl }),
      );
      const msg = res.Messages?.[0];
      expect(msg).toBeDefined();
      received.push(msg?.Body ?? "");
      await client.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: msg?.ReceiptHandle ?? "",
        }),
      );
    }
    expect(received).toEqual(["msg-1", "msg-2", "msg-3", "msg-4", "msg-5"]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("scenario 3: retransmit with same MessageDeduplicationId is silently deduped", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "fifo-scen-dedup.fifo");

    const first = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "payload",
        MessageGroupId: "g1",
        MessageDeduplicationId: "dedup-key",
      }),
    );
    const second = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "payload",
        MessageGroupId: "g1",
        MessageDeduplicationId: "dedup-key",
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
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: received.Messages?.[0]?.ReceiptHandle ?? "",
      }),
    );

    const empty = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
      }),
    );
    expect(empty.Messages ?? []).toHaveLength(0);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("scenario 4: ContentBasedDeduplication dedupes same body, delivers different bodies", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "fifo-scen-cbd.fifo", {
      ContentBasedDeduplication: "true",
    });

    const a1 = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "same-body",
        MessageGroupId: "g1",
      }),
    );
    const a2 = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "same-body",
        MessageGroupId: "g1",
      }),
    );
    expect(a2.MessageId).toBe(a1.MessageId);

    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "different-body",
        MessageGroupId: "g1",
      }),
    );

    const msgs: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
        }),
      );
      const batch = res.Messages ?? [];
      if (batch.length === 0) break;
      for (const m of batch) {
        msgs.push(m.Body ?? "");
        await client.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: m.ReceiptHandle ?? "",
          }),
        );
      }
    }
    expect(msgs).toContain("same-body");
    expect(msgs).toContain("different-body");
    expect(msgs.filter((b) => b === "same-body").length).toBe(1);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("scenario 5: different MessageGroupIds are consumed independently", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "fifo-scen-groups.fifo");

    for (const [group, body, dedup] of [
      ["ga", "a1", "ga-1"],
      ["ga", "a2", "ga-2"],
      ["gb", "b1", "gb-1"],
    ] as const) {
      await client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: body,
          MessageGroupId: group,
          MessageDeduplicationId: dedup,
        }),
      );
    }

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

  test("scenario 6: send to FIFO queue without MessageGroupId returns MissingParameter", async () => {
    const client = sqs();
    const queueUrl = await createFifo(client, "fifo-scen-nogroup.fifo");

    await expect(
      client.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: "no-group",
          MessageDeduplicationId: "some-dedup",
        }),
      ),
    ).rejects.toMatchObject({ name: "MissingParameter" });

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
