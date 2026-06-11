import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConfirmSubscriptionCommand,
  CreateTopicCommand,
  DeleteTopicCommand,
  GetSubscriptionAttributesCommand,
  GetTopicAttributesCommand,
  ListSubscriptionsByTopicCommand,
  PublishCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
  UnsubscribeCommand,
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

const receiveOne = async (queueUrl: string, wait = 0) =>
  (
    await sqs().send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        WaitTimeSeconds: wait,
        MessageAttributeNames: ["All"],
      }),
    )
  ).Messages?.[0];

test("SNS subscribe sqs, attributes round-trip, raw delivery, redrive, unsubscribe", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-confirmation-lifecycle" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const subscribed = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: "arn:aws:sqs:us-east-1:000000000000:confirmation-queue",
    }),
  );
  const subscriptionArn = subscribed.SubscriptionArn;
  expect(subscriptionArn).toBeDefined();
  expect(subscriptionArn).not.toBe("pending confirmation");

  const initial = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(initial.Attributes?.PendingConfirmation).toBe("false");
  expect(initial.Attributes?.RawMessageDelivery).toBe("false");

  await client.send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: "RawMessageDelivery",
      AttributeValue: "true",
    }),
  );

  const afterRaw = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(afterRaw.Attributes?.RawMessageDelivery).toBe("true");

  const dlqArn = "arn:aws:sqs:us-east-1:000000000000:confirmation-dlq";
  await client.send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: "RedrivePolicy",
      AttributeValue: JSON.stringify({ deadLetterTargetArn: dlqArn }),
    }),
  );

  const afterRedrive = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(afterRedrive.Attributes?.RedrivePolicy).toContain(dlqArn);

  const listed = await client.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }),
  );
  const arns = (listed.Subscriptions ?? []).map((s) => s.SubscriptionArn);
  expect(arns).toContain(subscriptionArn);

  await client.send(
    new UnsubscribeCommand({ SubscriptionArn: subscriptionArn }),
  );

  const afterUnsub = await client.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }),
  );
  const remainingArns = (afterUnsub.Subscriptions ?? []).map(
    (s) => s.SubscriptionArn,
  );
  expect(remainingArns).not.toContain(subscriptionArn);

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("RedrivePolicy DLQ delivery when target queue is deleted", async () => {
  const client = sns();

  const { queueUrl: targetUrl, queueArn: targetArn } = await makeQueue(
    "bunsai-e2e-redrive-target",
  );
  const { queueUrl: dlqUrl, queueArn: dlqArn } = await makeQueue(
    "bunsai-e2e-redrive-dlq",
  );

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-redrive-topic" }),
  );
  const topicArn = created.TopicArn!;

  const subscribed = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: targetArn,
    }),
  );
  const subscriptionArn = subscribed.SubscriptionArn!;

  await client.send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: "RedrivePolicy",
      AttributeValue: JSON.stringify({ deadLetterTargetArn: dlqArn }),
    }),
  );

  await sqs().send(new DeleteQueueCommand({ QueueUrl: targetUrl }));

  await client.send(
    new PublishCommand({ TopicArn: topicArn, Message: "hello-dlq" }),
  );

  const dlqMsg = await receiveOne(dlqUrl);
  expect(dlqMsg).toBeDefined();
  const envelope = JSON.parse(dlqMsg!.Body ?? "{}");
  expect(envelope.Type).toBe("Notification");
  expect(envelope.Message).toBe("hello-dlq");

  await sqs().send(new DeleteQueueCommand({ QueueUrl: dlqUrl }));
  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("http subscribe PendingToken retrieval and confirmation flow", async () => {
  const client = sns();

  const { queueUrl, queueArn } = await makeQueue(
    "bunsai-e2e-http-confirm-verify",
  );

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-http-confirm-topic" }),
  );
  const topicArn = created.TopicArn!;

  const subscribed = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "http",
      Endpoint: queueArn,
    }),
  );
  expect(subscribed.SubscriptionArn).toBe("pending confirmation");

  const listed = await client.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }),
  );
  const subscriptionArn = listed.Subscriptions![0].SubscriptionArn!;

  const pendingAttrs = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(pendingAttrs.Attributes?.PendingConfirmation).toBe("true");
  expect(pendingAttrs.Attributes?.PendingToken).toBeDefined();
  const token = pendingAttrs.Attributes!.PendingToken!;

  await client.send(
    new PublishCommand({ TopicArn: topicArn, Message: "before-confirm" }),
  );
  const beforeMsg = await receiveOne(queueUrl);
  expect(beforeMsg).toBeUndefined();

  const confirmed = await client.send(
    new ConfirmSubscriptionCommand({ TopicArn: topicArn, Token: token }),
  );
  expect(confirmed.SubscriptionArn).toBe(subscriptionArn);

  const confirmedAttrs = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(confirmedAttrs.Attributes?.PendingConfirmation).toBe("false");
  expect(confirmedAttrs.Attributes?.PendingToken).toBeUndefined();

  await client.send(
    new PublishCommand({ TopicArn: topicArn, Message: "after-confirm" }),
  );
  const afterMsg = await receiveOne(queueUrl);
  expect(afterMsg).toBeDefined();
  expect(afterMsg!.Body).toBe("after-confirm");

  await sqs().send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS subscribe email returns pending confirmation", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-confirmation-pending" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const subscribed = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "email",
      Endpoint: "test@example.com",
    }),
  );
  expect(subscribed.SubscriptionArn).toBe("pending confirmation");

  const topicAttrs = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  expect(topicAttrs.Attributes?.SubscriptionsPending).toBe("1");
  expect(topicAttrs.Attributes?.SubscriptionsConfirmed).toBe("0");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});
