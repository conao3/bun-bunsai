import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTopicCommand,
  DeleteTopicCommand,
  GetSubscriptionAttributesCommand,
  GetTopicAttributesCommand,
  ListSubscriptionsByTopicCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
  UnsubscribeCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });

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
