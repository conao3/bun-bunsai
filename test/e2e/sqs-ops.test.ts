import { describe, expect, test } from "bun:test";
import { serviceBaseUrl } from "../../apps/server/src/services/_endpoint.ts";
import { startApp } from "./harness.ts";
import {
  AddPermissionCommand,
  CancelMessageMoveTaskCommand,
  ChangeMessageVisibilityBatchCommand,
  ChangeMessageVisibilityCommand,
  CreateQueueCommand,
  DeleteMessageBatchCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ListDeadLetterSourceQueuesCommand,
  ListMessageMoveTasksCommand,
  ReceiveMessageCommand,
  RemovePermissionCommand,
  SendMessageBatchCommand,
  SetQueueAttributesCommand,
  SQSClient,
  StartMessageMoveTaskCommand,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("SQS batch ops e2e", () => {
  const sqs = () =>
    new SQSClient({ endpoint, region, credentials, requestHandler });

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

  test("add and remove permission", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-perm" }),
    );
    const queueUrl = created.QueueUrl ?? "";
    expect(queueUrl).not.toBe("");

    await client.send(
      new AddPermissionCommand({
        QueueUrl: queueUrl,
        Label: "AllowAlice",
        AWSAccountIds: ["123456789012"],
        Actions: ["SendMessage", "ReceiveMessage"],
      }),
    );

    const withPerm = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["Policy"],
      }),
    );
    const policy = JSON.parse(withPerm.Attributes?.Policy ?? "{}") as {
      Statement: { Sid: string }[];
    };
    expect(policy.Statement.some((s) => s.Sid === "AllowAlice")).toBe(true);

    await client.send(
      new RemovePermissionCommand({ QueueUrl: queueUrl, Label: "AllowAlice" }),
    );

    const withoutPerm = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["Policy"],
      }),
    );
    const policyAfter = JSON.parse(withoutPerm.Attributes?.Policy ?? "{}") as {
      Statement: { Sid: string }[];
    };
    expect(policyAfter.Statement.some((s) => s.Sid === "AllowAlice")).toBe(
      false,
    );

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("start, list, and cancel message move task", async () => {
    const client = sqs();
    const created = await client.send(
      new CreateQueueCommand({ QueueName: "bunsai-e2e-sqs-movetask" }),
    );
    const queueUrl = created.QueueUrl ?? "";
    const sourceArn = `arn:aws:sqs:${region}:000000000000:bunsai-e2e-sqs-movetask`;

    const started = await client.send(
      new StartMessageMoveTaskCommand({ SourceArn: sourceArn }),
    );
    const taskHandle = started.TaskHandle ?? "";
    expect(taskHandle).not.toBe("");

    const listed = await client.send(
      new ListMessageMoveTasksCommand({
        SourceArn: sourceArn,
        MaxResults: 10,
      }),
    );
    expect(listed.Results?.length).toBeGreaterThanOrEqual(1);
    const entry = listed.Results?.find((r) => r.TaskHandle === taskHandle);
    expect(entry).toBeDefined();
    expect(entry?.Status).toBe("RUNNING");
    expect(entry?.SourceArn).toBe(sourceArn);

    const cancelled = await client.send(
      new CancelMessageMoveTaskCommand({ TaskHandle: taskHandle }),
    );
    expect(cancelled.ApproximateNumberOfMessagesMoved).toBeDefined();

    const listedAfter = await client.send(
      new ListMessageMoveTasksCommand({
        SourceArn: sourceArn,
        MaxResults: 10,
      }),
    );
    const entryAfter = listedAfter.Results?.find(
      (r) => r.Status === "CANCELLED",
    );
    expect(entryAfter).toBeDefined();

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});

describe("serviceBaseUrl unit", () => {
  test("uses BUNSAI_PORT when set", () => {
    const original = process.env.BUNSAI_PORT;
    try {
      process.env.BUNSAI_PORT = "9999";
      expect(serviceBaseUrl()).toBe("http://localhost:9999");
    } finally {
      if (original === undefined) {
        delete process.env.BUNSAI_PORT;
      } else {
        process.env.BUNSAI_PORT = original;
      }
    }
  });

  test("defaults to port 4566 when BUNSAI_PORT is unset", () => {
    const original = process.env.BUNSAI_PORT;
    try {
      delete process.env.BUNSAI_PORT;
      expect(serviceBaseUrl()).toBe("http://localhost:4566");
    } finally {
      if (original !== undefined) {
        process.env.BUNSAI_PORT = original;
      }
    }
  });
});
