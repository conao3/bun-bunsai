import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTopicCommand,
  DeleteTopicCommand,
  ListSubscriptionsByTopicCommand,
  ListSubscriptionsCommand,
  ListTopicsCommand,
  PublishCommand,
  SNSClient,
  SubscribeCommand,
  UnsubscribeCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });

test("SNS topic, subscription and publish lifecycle", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-topic" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();
  expect(topicArn).toContain(":bunsai-e2e-topic");

  const listed = await client.send(new ListTopicsCommand({}));
  const arns = (listed.Topics ?? []).map((t) => t.TopicArn);
  expect(arns).toContain(topicArn);

  const subscribed = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "email",
      Endpoint: "e2e@example.com",
    }),
  );
  const subscriptionArn = subscribed.SubscriptionArn;
  expect(subscriptionArn).toBeDefined();

  const byTopic = await client.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }),
  );
  const byTopicArns = (byTopic.Subscriptions ?? []).map(
    (s) => s.SubscriptionArn,
  );
  expect(byTopicArns).toContain(subscriptionArn);

  const allSubs = await client.send(new ListSubscriptionsCommand({}));
  const allArns = (allSubs.Subscriptions ?? []).map((s) => s.SubscriptionArn);
  expect(allArns).toContain(subscriptionArn);

  const published = await client.send(
    new PublishCommand({ TopicArn: topicArn, Message: "hello bunsai sns" }),
  );
  expect(published.MessageId).toBeDefined();
  expect(typeof published.MessageId).toBe("string");
  expect((published.MessageId ?? "").length).toBeGreaterThan(0);

  await client.send(
    new UnsubscribeCommand({ SubscriptionArn: subscriptionArn }),
  );
  const afterUnsub = await client.send(
    new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }),
  );
  const remaining = (afterUnsub.Subscriptions ?? []).map(
    (s) => s.SubscriptionArn,
  );
  expect(remaining).not.toContain(subscriptionArn);

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
  const afterDelete = await client.send(new ListTopicsCommand({}));
  const afterArns = (afterDelete.Topics ?? []).map((t) => t.TopicArn);
  expect(afterArns).not.toContain(topicArn);
});
