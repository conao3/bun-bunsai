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

const subscribeWithFilter = async (name: string, filterPolicy: object) => {
  const created = await sqs().send(new CreateQueueCommand({ QueueName: name }));
  const queueUrl = created.QueueUrl ?? "";
  const attrs = await sqs().send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["QueueArn"],
    }),
  );
  const topic = await sns().send(new CreateTopicCommand({ Name: `${name}-t` }));
  const topicArn = topic.TopicArn ?? "";
  const sub = await sns().send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: attrs.Attributes?.QueueArn ?? "",
    }),
  );
  await sns().send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: sub.SubscriptionArn ?? "",
      AttributeName: "FilterPolicy",
      AttributeValue: JSON.stringify(filterPolicy),
    }),
  );
  await sns().send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: sub.SubscriptionArn ?? "",
      AttributeName: "RawMessageDelivery",
      AttributeValue: "true",
    }),
  );
  return { queueUrl, topicArn };
};

const receive = async (queueUrl: string, wait: number) =>
  (
    await sqs().send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: wait }),
    )
  ).Messages ?? [];

describe("SNS to SQS filter policy e2e", () => {
  test("exact-match filter delivers only matching messages", async () => {
    const { queueUrl, topicArn } = await subscribeWithFilter(
      "bunsai-e2e-filter-exact",
      { event: ["order_placed"] },
    );

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "match",
        MessageAttributes: {
          event: { DataType: "String", StringValue: "order_placed" },
        },
      }),
    );
    const matched = await receive(queueUrl, 1);
    expect(matched.length).toBe(1);
    expect(matched[0]?.Body).toBe("match");

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "skip",
        MessageAttributes: {
          event: { DataType: "String", StringValue: "order_cancelled" },
        },
      }),
    );
    const filtered = await receive(queueUrl, 1);
    expect(filtered).toEqual([]);

    await sqs().send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });

  test("exists and anything-but operators are honoured", async () => {
    const { queueUrl, topicArn } = await subscribeWithFilter(
      "bunsai-e2e-filter-ops",
      { customerId: [{ exists: true }], region: [{ "anything-but": "eu" }] },
    );

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "ok",
        MessageAttributes: {
          customerId: { DataType: "String", StringValue: "c-1" },
          region: { DataType: "String", StringValue: "us" },
        },
      }),
    );
    expect((await receive(queueUrl, 1)).length).toBe(1);

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "wrong-region",
        MessageAttributes: {
          customerId: { DataType: "String", StringValue: "c-2" },
          region: { DataType: "String", StringValue: "eu" },
        },
      }),
    );
    expect(await receive(queueUrl, 1)).toEqual([]);

    await sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: "missing-customer",
        MessageAttributes: {
          region: { DataType: "String", StringValue: "us" },
        },
      }),
    );
    expect(await receive(queueUrl, 1)).toEqual([]);

    await sqs().send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
