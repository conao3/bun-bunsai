import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SQS MessageAttributes fidelity e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  test("String/Number/Binary attributes round-trip with MessageAttributeNames All", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-msgattr-roundtrip" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const binaryData = new Uint8Array([1, 2, 3, 4]);
    const sent = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "hello",
        MessageAttributes: {
          strAttr: { DataType: "String", StringValue: "ada" },
          numAttr: { DataType: "Number", StringValue: "42" },
          binAttr: { DataType: "Binary", BinaryValue: binaryData },
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
    expect(message?.MessageAttributes?.strAttr?.StringValue).toBe("ada");
    expect(message?.MessageAttributes?.numAttr?.StringValue).toBe("42");
    expect(message?.MessageAttributes?.binAttr?.BinaryValue).toBeDefined();
    expect(message?.MD5OfMessageAttributes).toBe(sent.MD5OfMessageAttributes);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("MessageAttributeNames filters to specific names only", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-msgattr-filter" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "hello",
        MessageAttributes: {
          alpha: { DataType: "String", StringValue: "a" },
          beta: { DataType: "String", StringValue: "b" },
        },
      }),
    );

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MessageAttributeNames: ["alpha"],
      }),
    );
    const message = received.Messages?.[0];
    expect(message?.MessageAttributes?.alpha?.StringValue).toBe("a");
    expect(message?.MessageAttributes?.beta).toBeUndefined();

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("no MessageAttributeNames returns no attributes", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-msgattr-nonames" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "hello",
        MessageAttributes: {
          hidden: { DataType: "String", StringValue: "secret" },
        },
      }),
    );

    const received = await client.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl }),
    );
    const message = received.Messages?.[0];
    expect(message?.MessageAttributes).toBeUndefined();
    expect(message?.MD5OfMessageAttributes).toBeUndefined();

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("SendMessageBatch attributes round-trip", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-msgattr-batch" }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const batchResult = await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: [
          {
            Id: "1",
            MessageBody: "first",
            MessageAttributes: {
              tag: { DataType: "String", StringValue: "one" },
            },
          },
          {
            Id: "2",
            MessageBody: "second",
            MessageAttributes: {
              tag: { DataType: "String", StringValue: "two" },
            },
          },
        ],
      }),
    );
    expect(batchResult.Successful?.length).toBe(2);
    expect(batchResult.Successful?.every((s) => s.MD5OfMessageAttributes)).toBe(
      true,
    );

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ["All"],
      }),
    );
    const tags = (received.Messages ?? [])
      .map((m) => m.MessageAttributes?.tag?.StringValue)
      .sort();
    expect(tags).toEqual(["one", "two"]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("FIFO attributes round-trip with ContentBasedDeduplication", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({
        QueueName: "bunsai-e2e-msgattr-fifo.fifo",
        Attributes: {
          FifoQueue: "true",
          ContentBasedDeduplication: "true",
        },
      }),
    );
    const queueUrl = created.QueueUrl ?? "";

    const sent = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "fifo-body",
        MessageGroupId: "g1",
        MessageAttributes: {
          env: { DataType: "String", StringValue: "prod" },
        },
      }),
    );
    expect(sent.SequenceNumber).toBeDefined();
    expect(sent.MD5OfMessageAttributes).toBeDefined();

    const dup = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: "fifo-body",
        MessageGroupId: "g1",
      }),
    );
    expect(dup.MessageId).toBe(sent.MessageId);

    const received = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MessageAttributeNames: ["All"],
      }),
    );
    const message = received.Messages?.[0];
    expect(message?.MessageAttributes?.env?.StringValue).toBe("prod");
    expect(message?.MD5OfMessageAttributes).toBe(sent.MD5OfMessageAttributes);

    await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message?.ReceiptHandle ?? "",
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
});
