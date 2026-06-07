import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTopicCommand,
  PublishCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });

const makeQueue = async (name: string) => {
  const created = await sqs().send(new CreateQueueCommand({ QueueName: name }));
  const queueUrl = created.QueueUrl ?? "";
  const attrs = await sqs().send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["QueueArn"],
    }),
  );
  return { queueUrl, queueArn: attrs.Attributes?.QueueArn ?? "" };
};

const subscribe = async (
  topicArn: string,
  queueArn: string,
  options: { raw?: boolean; filterPolicy?: object } = {},
) => {
  const sub = await sns().send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: queueArn,
    }),
  );
  const arn = sub.SubscriptionArn ?? "";
  if (options.raw) {
    await sns().send(
      new SetSubscriptionAttributesCommand({
        SubscriptionArn: arn,
        AttributeName: "RawMessageDelivery",
        AttributeValue: "true",
      }),
    );
  }
  if (options.filterPolicy) {
    await sns().send(
      new SetSubscriptionAttributesCommand({
        SubscriptionArn: arn,
        AttributeName: "FilterPolicy",
        AttributeValue: JSON.stringify(options.filterPolicy),
      }),
    );
  }
};

const drain = async (queueUrl: string): Promise<string[]> => {
  const bodies: string[] = [];
  for (;;) {
    const received = await sqs().send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 1,
      }),
    );
    const messages = received.Messages ?? [];
    if (messages.length === 0) break;
    for (const message of messages) {
      bodies.push(message.Body ?? "");
      await sqs().send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle ?? "",
        }),
      );
    }
  }
  return bodies;
};

describe("SNS to SQS fan-out scenario e2e", () => {
  test("an order event fans out with raw, envelope, and filtered consumers", async () => {
    const topic = await sns().send(
      new CreateTopicCommand({ Name: "bunsai-e2e-orders" }),
    );
    const topicArn = topic.TopicArn ?? "";

    const fulfillment = await makeQueue("bunsai-e2e-orders-fulfillment");
    const audit = await makeQueue("bunsai-e2e-orders-audit");
    const priorityShipping = await makeQueue("bunsai-e2e-orders-priority");

    await subscribe(topicArn, fulfillment.queueArn, { raw: true });
    await subscribe(topicArn, audit.queueArn);
    await subscribe(topicArn, priorityShipping.queueArn, {
      raw: true,
      filterPolicy: { priority: ["high"] },
    });

    const publishOrder = (id: string, priority: string) =>
      sns().send(
        new PublishCommand({
          TopicArn: topicArn,
          Message: JSON.stringify({ orderId: id, priority }),
          MessageAttributes: {
            priority: { DataType: "String", StringValue: priority },
          },
        }),
      );

    await publishOrder("o-1", "high");
    await publishOrder("o-2", "low");

    const fulfillmentBodies = await drain(fulfillment.queueUrl);
    const auditBodies = await drain(audit.queueUrl);
    const priorityBodies = await drain(priorityShipping.queueUrl);

    expect(fulfillmentBodies.length).toBe(2);
    expect(fulfillmentBodies.map((b) => JSON.parse(b).orderId).sort()).toEqual([
      "o-1",
      "o-2",
    ]);

    expect(auditBodies.length).toBe(2);
    for (const body of auditBodies) {
      const envelope = JSON.parse(body);
      expect(envelope.Type).toBe("Notification");
      expect(envelope.TopicArn).toBe(topicArn);
    }

    expect(priorityBodies.length).toBe(1);
    expect(JSON.parse(priorityBodies[0] ?? "{}").orderId).toBe("o-1");

    for (const queue of [fulfillment, audit, priorityShipping]) {
      await sqs().send(new DeleteQueueCommand({ QueueUrl: queue.queueUrl }));
    }
  });
});
