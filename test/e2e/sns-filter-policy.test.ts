import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  PublishCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
  CreateTopicCommand,
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

const subscribeSqs = async (
  topicArn: string,
  queueArn: string,
  policy: object,
  scope?: string,
) => {
  const sub = await sns().send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: queueArn,
    }),
  );
  const arn = sub.SubscriptionArn ?? "";
  await sns().send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: arn,
      AttributeName: "FilterPolicy",
      AttributeValue: JSON.stringify(policy),
    }),
  );
  if (scope !== undefined) {
    await sns().send(
      new SetSubscriptionAttributesCommand({
        SubscriptionArn: arn,
        AttributeName: "FilterPolicyScope",
        AttributeValue: scope,
      }),
    );
  }
  await sns().send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: arn,
      AttributeName: "RawMessageDelivery",
      AttributeValue: "true",
    }),
  );
};

test("SNS FilterPolicy: numeric range filter", async () => {
  const topic = await sns().send(
    new CreateTopicCommand({ Name: "fp-numeric-range" }),
  );
  const topicArn = topic.TopicArn ?? "";
  const queue = await makeQueue("fp-numeric-range-q");

  await subscribeSqs(topicArn, queue.queueArn, {
    price: [{ numeric: [">=", 10, "<", 100] }],
  });

  const pub = (price: number) =>
    sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ price }),
        MessageAttributes: {
          price: { DataType: "Number", StringValue: String(price) },
        },
      }),
    );

  await pub(50);
  await pub(5);
  await pub(100);
  await pub(10);

  const bodies = await drain(queue.queueUrl);
  expect(bodies.length).toBe(2);
  const prices = bodies.map((b) => JSON.parse(b).price).sort((a, b) => a - b);
  expect(prices).toEqual([10, 50]);

  await sqs().send(new DeleteQueueCommand({ QueueUrl: queue.queueUrl }));
});

test("SNS FilterPolicy: suffix operator", async () => {
  const topic = await sns().send(new CreateTopicCommand({ Name: "fp-suffix" }));
  const topicArn = topic.TopicArn ?? "";
  const queue = await makeQueue("fp-suffix-q");

  await subscribeSqs(topicArn, queue.queueArn, {
    filename: [{ suffix: ".jpg" }],
  });

  const pub = (filename: string) =>
    sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ filename }),
        MessageAttributes: {
          filename: { DataType: "String", StringValue: filename },
        },
      }),
    );

  await pub("photo.jpg");
  await pub("document.pdf");
  await pub("image.jpg");

  const bodies = await drain(queue.queueUrl);
  expect(bodies.length).toBe(2);

  await sqs().send(new DeleteQueueCommand({ QueueUrl: queue.queueUrl }));
});

test("SNS FilterPolicy: equals-ignore-case operator", async () => {
  const topic = await sns().send(new CreateTopicCommand({ Name: "fp-eic" }));
  const topicArn = topic.TopicArn ?? "";
  const queue = await makeQueue("fp-eic-q");

  await subscribeSqs(topicArn, queue.queueArn, {
    env: [{ "equals-ignore-case": "PROD" }],
  });

  const pub = (env: string) =>
    sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ env }),
        MessageAttributes: {
          env: { DataType: "String", StringValue: env },
        },
      }),
    );

  await pub("prod");
  await pub("Prod");
  await pub("dev");
  await pub("PROD");

  const bodies = await drain(queue.queueUrl);
  expect(bodies.length).toBe(3);

  await sqs().send(new DeleteQueueCommand({ QueueUrl: queue.queueUrl }));
});

test("SNS FilterPolicy: cidr operator", async () => {
  const topic = await sns().send(new CreateTopicCommand({ Name: "fp-cidr" }));
  const topicArn = topic.TopicArn ?? "";
  const queue = await makeQueue("fp-cidr-q");

  await subscribeSqs(topicArn, queue.queueArn, {
    ip: [{ cidr: "10.0.0.0/8" }],
  });

  const pub = (ip: string) =>
    sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({ ip }),
        MessageAttributes: {
          ip: { DataType: "String", StringValue: ip },
        },
      }),
    );

  await pub("10.1.2.3");
  await pub("192.168.1.1");
  await pub("10.255.0.0");

  const bodies = await drain(queue.queueUrl);
  expect(bodies.length).toBe(2);

  await sqs().send(new DeleteQueueCommand({ QueueUrl: queue.queueUrl }));
});

test("SNS FilterPolicy: FilterPolicyScope=MessageBody", async () => {
  const topic = await sns().send(
    new CreateTopicCommand({ Name: "fp-body-scope" }),
  );
  const topicArn = topic.TopicArn ?? "";
  const matchQueue = await makeQueue("fp-body-match-q");
  const noMatchQueue = await makeQueue("fp-body-nomatch-q");

  await subscribeSqs(
    topicArn,
    matchQueue.queueArn,
    { category: [{ prefix: "order" }], amount: [{ numeric: [">=", 50] }] },
    "MessageBody",
  );
  await subscribeSqs(
    topicArn,
    noMatchQueue.queueArn,
    { category: ["payment"] },
    "MessageBody",
  );

  const pub = (body: object) =>
    sns().send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(body),
      }),
    );

  await pub({ category: "order-new", amount: 100 });
  await pub({ category: "order-update", amount: 30 });
  await pub({ category: "payment", amount: 200 });

  const matchBodies = await drain(matchQueue.queueUrl);
  const noMatchBodies = await drain(noMatchQueue.queueUrl);

  expect(matchBodies.length).toBe(1);
  expect(JSON.parse(matchBodies[0] ?? "{}").category).toBe("order-new");

  expect(noMatchBodies.length).toBe(1);
  expect(JSON.parse(noMatchBodies[0] ?? "{}").category).toBe("payment");

  await sqs().send(new DeleteQueueCommand({ QueueUrl: matchQueue.queueUrl }));
  await sqs().send(new DeleteQueueCommand({ QueueUrl: noMatchQueue.queueUrl }));
});
