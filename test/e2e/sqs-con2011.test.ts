import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ChangeMessageVisibilityBatchCommand,
  CreateQueueCommand,
  DeleteMessageBatchCommand,
  DeleteQueueCommand,
  ListDeadLetterSourceQueuesCommand,
  ListQueuesCommand,
  SendMessageBatchCommand,
  SetQueueAttributesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("CON-2011: SQS fidelity gaps", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

  describe("HIGH-1: CreateQueue QueueNameExists", () => {
    test("same attributes returns existing queue url", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({
          QueueName: "con2011-same-attrs",
          Attributes: { VisibilityTimeout: "30" },
        }),
      );
      const second = await client.send(
        new CreateQueueCommand({
          QueueName: "con2011-same-attrs",
          Attributes: { VisibilityTimeout: "30" },
        }),
      );
      expect(second.QueueUrl).toBe(created.QueueUrl);
    });

    test("different attributes throws QueueNameExists", async () => {
      const client = sqs();
      await client.send(
        new CreateQueueCommand({
          QueueName: "con2011-diff-attrs",
          Attributes: { VisibilityTimeout: "30" },
        }),
      );
      await expect(
        client.send(
          new CreateQueueCommand({
            QueueName: "con2011-diff-attrs",
            Attributes: { VisibilityTimeout: "60" },
          }),
        ),
      ).rejects.toThrow();
    });

    test("no attributes vs attributes throws QueueNameExists", async () => {
      const client = sqs();
      await client.send(
        new CreateQueueCommand({
          QueueName: "con2011-added-attrs",
          Attributes: { VisibilityTimeout: "30" },
        }),
      );
      await expect(
        client.send(
          new CreateQueueCommand({ QueueName: "con2011-added-attrs" }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("HIGH-2: ListQueues pagination", () => {
    test("MaxResults + NextToken round-trip", async () => {
      const client = sqs();
      const prefix = "con2011-pag-";
      for (let i = 0; i < 3; i++) {
        await client.send(
          new CreateQueueCommand({ QueueName: `${prefix}${i}` }),
        );
      }

      const page1 = await client.send(
        new ListQueuesCommand({ QueueNamePrefix: prefix, MaxResults: 2 }),
      );
      expect(page1.QueueUrls?.length).toBe(2);
      expect(page1.NextToken).toBeDefined();

      const page2 = await client.send(
        new ListQueuesCommand({
          QueueNamePrefix: prefix,
          MaxResults: 2,
          NextToken: page1.NextToken,
        }),
      );
      expect(page2.QueueUrls?.length).toBe(1);
      expect(page2.NextToken).toBeUndefined();

      const allUrls = [...(page1.QueueUrls ?? []), ...(page2.QueueUrls ?? [])];
      expect(allUrls.length).toBe(3);
    });

    test("no NextToken when no MaxResults", async () => {
      const client = sqs();
      const result = await client.send(new ListQueuesCommand({}));
      expect(result.NextToken).toBeUndefined();
    });
  });

  describe("HIGH-3: ListDeadLetterSourceQueues pagination", () => {
    test("MaxResults + NextToken round-trip", async () => {
      const client = sqs();
      const dlq = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-dlq-target" }),
      );
      const dlqArn = `arn:aws:sqs:${region}:000000000000:con2011-dlq-target`;
      const srcUrls: string[] = [];
      for (let i = 0; i < 3; i++) {
        const src = await client.send(
          new CreateQueueCommand({ QueueName: `con2011-dlq-src-${i}` }),
        );
        await client.send(
          new SetQueueAttributesCommand({
            QueueUrl: src.QueueUrl,
            Attributes: {
              RedrivePolicy: JSON.stringify({
                deadLetterTargetArn: dlqArn,
                maxReceiveCount: 3,
              }),
            },
          }),
        );
        srcUrls.push(src.QueueUrl ?? "");
      }

      const page1 = await client.send(
        new ListDeadLetterSourceQueuesCommand({
          QueueUrl: dlq.QueueUrl,
          MaxResults: 2,
        }),
      );
      expect(page1.queueUrls?.length).toBe(2);
      expect(page1.NextToken).toBeDefined();

      const page2 = await client.send(
        new ListDeadLetterSourceQueuesCommand({
          QueueUrl: dlq.QueueUrl,
          MaxResults: 2,
          NextToken: page1.NextToken,
        }),
      );
      expect(page2.queueUrls?.length).toBe(1);
      expect(page2.NextToken).toBeUndefined();
    });
  });

  describe("HIGH-4/5: SendMessageBatch validation", () => {
    test("TooManyEntriesInBatchRequest (>10 entries)", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-batch-send-size" }),
      );
      const entries = Array.from({ length: 11 }, (_, i) => ({
        Id: `id${i}`,
        MessageBody: `body${i}`,
      }));
      await expect(
        client.send(
          new SendMessageBatchCommand({
            QueueUrl: created.QueueUrl,
            Entries: entries,
          }),
        ),
      ).rejects.toThrow();
    });

    test("BatchEntryIdsNotDistinct (duplicate Ids)", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-batch-send-dup" }),
      );
      await expect(
        client.send(
          new SendMessageBatchCommand({
            QueueUrl: created.QueueUrl,
            Entries: [
              { Id: "dup", MessageBody: "alpha" },
              { Id: "dup", MessageBody: "beta" },
            ],
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("HIGH-6/7: DeleteMessageBatch validation", () => {
    test("TooManyEntriesInBatchRequest (>10 entries)", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-batch-del-size" }),
      );
      const entries = Array.from({ length: 11 }, (_, i) => ({
        Id: `id${i}`,
        ReceiptHandle: `rh${i}`,
      }));
      await expect(
        client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: created.QueueUrl,
            Entries: entries,
          }),
        ),
      ).rejects.toThrow();
    });

    test("BatchEntryIdsNotDistinct (duplicate Ids)", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-batch-del-dup" }),
      );
      await expect(
        client.send(
          new DeleteMessageBatchCommand({
            QueueUrl: created.QueueUrl,
            Entries: [
              { Id: "dup", ReceiptHandle: "rh1" },
              { Id: "dup", ReceiptHandle: "rh2" },
            ],
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("HIGH-8/9: ChangeMessageVisibilityBatch validation", () => {
    test("TooManyEntriesInBatchRequest (>10 entries)", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-batch-vis-size" }),
      );
      const entries = Array.from({ length: 11 }, (_, i) => ({
        Id: `id${i}`,
        ReceiptHandle: `rh${i}`,
        VisibilityTimeout: 30,
      }));
      await expect(
        client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: created.QueueUrl,
            Entries: entries,
          }),
        ),
      ).rejects.toThrow();
    });

    test("BatchEntryIdsNotDistinct (duplicate Ids)", async () => {
      const client = sqs();
      const created = await client.send(
        new CreateQueueCommand({ QueueName: "con2011-batch-vis-dup" }),
      );
      await expect(
        client.send(
          new ChangeMessageVisibilityBatchCommand({
            QueueUrl: created.QueueUrl,
            Entries: [
              { Id: "dup", ReceiptHandle: "rh1", VisibilityTimeout: 30 },
              { Id: "dup", ReceiptHandle: "rh2", VisibilityTimeout: 30 },
            ],
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("cleanup", () => {
    test("delete all test queues", async () => {
      const client = sqs();
      const names = [
        "con2011-same-attrs",
        "con2011-diff-attrs",
        "con2011-added-attrs",
        "con2011-pag-0",
        "con2011-pag-1",
        "con2011-pag-2",
        "con2011-dlq-target",
        "con2011-dlq-src-0",
        "con2011-dlq-src-1",
        "con2011-dlq-src-2",
        "con2011-batch-send-size",
        "con2011-batch-send-dup",
        "con2011-batch-del-size",
        "con2011-batch-del-dup",
        "con2011-batch-vis-size",
        "con2011-batch-vis-dup",
      ];
      for (const name of names) {
        const url = await client
          .send(new ListQueuesCommand({ QueueNamePrefix: name }))
          .then((r) => r.QueueUrls?.[0]);
        if (url) {
          await client.send(new DeleteQueueCommand({ QueueUrl: url }));
        }
      }
      expect(true).toBe(true);
    });
  });
});
