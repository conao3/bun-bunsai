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

const receiveOne = async (queueUrl: string) =>
  (
    await sqs().send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        WaitTimeSeconds: 1,
        MessageAttributeNames: ["All"],
      }),
    )
  ).Messages?.[0];

describe("SNS to SQS delivery e2e", () => {
  test("publish delivers a notification envelope to the subscribed queue", async () => {
    const { queueUrl, queueArn } = await makeQueue("bunsai-e2e-snssqs-env");
    const topic = await sns().send(
      new CreateTopicCommand({ Name: "bunsai-e2e-snssqs-env-topic" }),
    );
    const topicArn = topic.TopicArn ?? "";
    await sns().send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "sqs",
        Endpoint: queueArn,
      }),
    );

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "hello-fanout",
        Subject: "greeting",
      }),
    );

    const message = await receiveOne(queueUrl);
    expect(message).toBeDefined();
    const envelope = JSON.parse(message?.Body ?? "{}");
    expect(envelope.Type).toBe("Notification");
    expect(envelope.TopicArn).toBe(topicArn);
    expect(envelope.Message).toBe("hello-fanout");
    expect(envelope.Subject).toBe("greeting");
    expect(envelope.MessageId).toBeDefined();

    await sqs().send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("raw message delivery skips the envelope and forwards attributes", async () => {
    const { queueUrl, queueArn } = await makeQueue("bunsai-e2e-snssqs-raw");
    const topic = await sns().send(
      new CreateTopicCommand({ Name: "bunsai-e2e-snssqs-raw-topic" }),
    );
    const topicArn = topic.TopicArn ?? "";
    const sub = await sns().send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "sqs",
        Endpoint: queueArn,
      }),
    );
    await sns().send(
      new SetSubscriptionAttributesCommand({
        SubscriptionArn: sub.SubscriptionArn ?? "",
        AttributeName: "RawMessageDelivery",
        AttributeValue: "true",
      }),
    );

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "raw-body",
        MessageAttributes: {
          team: { DataType: "String", StringValue: "core" },
        },
      }),
    );

    const message = await receiveOne(queueUrl);
    expect(message?.Body).toBe("raw-body");
    expect(message?.MessageAttributes?.team?.StringValue).toBe("core");

    await sqs().send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("fan-out delivers to every subscribed queue", async () => {
    const a = await makeQueue("bunsai-e2e-snssqs-fan-a");
    const b = await makeQueue("bunsai-e2e-snssqs-fan-b");
    const c = await makeQueue("bunsai-e2e-snssqs-fan-c");
    const topic = await sns().send(
      new CreateTopicCommand({ Name: "bunsai-e2e-snssqs-fan-topic" }),
    );
    const topicArn = topic.TopicArn ?? "";
    for (const queue of [a, b]) {
      await sns().send(
        new SubscribeCommand({
          TopicArn: topicArn,
          Protocol: "sqs",
          Endpoint: queue.queueArn,
        }),
      );
    }

    await sns().send(
      new PublishCommand({ TopicArn: topicArn, Message: "broadcast" }),
    );

    const ma = await receiveOne(a.queueUrl);
    const mb = await receiveOne(b.queueUrl);
    const mc = await receiveOne(c.queueUrl);
    expect(JSON.parse(ma?.Body ?? "{}").Message).toBe("broadcast");
    expect(JSON.parse(mb?.Body ?? "{}").Message).toBe("broadcast");
    expect(mc).toBeUndefined();

    for (const queue of [a, b, c]) {
      await sqs().send(new DeleteQueueCommand({ QueueUrl: queue.queueUrl }));
    }
  });
});
