import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConfirmSubscriptionCommand,
  CreatePlatformApplicationCommand,
  CreateTopicCommand,
  DeleteTopicCommand,
  GetSubscriptionAttributesCommand,
  ListPlatformApplicationsCommand,
  ListSubscriptionsCommand,
  PublishCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });

test("SNS subscription attributes get/set lifecycle", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-subattrs" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const subscribed = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "sqs",
      Endpoint: "arn:aws:sqs:us-east-1:000000000000:bunsai-sub-attrs",
    }),
  );
  const subscriptionArn = subscribed.SubscriptionArn;
  expect(subscriptionArn).toBeDefined();

  const initial = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(initial.Attributes?.SubscriptionArn).toBe(subscriptionArn);
  expect(initial.Attributes?.TopicArn).toBe(topicArn);
  expect(initial.Attributes?.Owner).toBeDefined();

  await client.send(
    new SetSubscriptionAttributesCommand({
      SubscriptionArn: subscriptionArn,
      AttributeName: "RawMessageDelivery",
      AttributeValue: "true",
    }),
  );

  const afterSet = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(afterSet.Attributes?.RawMessageDelivery).toBe("true");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS confirm subscription returns a subscription arn", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-confirm" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const confirmed = await client.send(
    new ConfirmSubscriptionCommand({
      TopicArn: topicArn,
      Token: "bunsai-confirm-token",
    }),
  );
  const subscriptionArn = confirmed.SubscriptionArn;
  expect(subscriptionArn).toBeDefined();
  expect(subscriptionArn).toContain(topicArn);

  const attrs = await client.send(
    new GetSubscriptionAttributesCommand({ SubscriptionArn: subscriptionArn }),
  );
  expect(attrs.Attributes?.ConfirmationWasAuthenticated).toBe("true");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS platform application create/list lifecycle", async () => {
  const client = sns();

  const created = await client.send(
    new CreatePlatformApplicationCommand({
      Name: "bunsai-e2e-app",
      Platform: "GCM",
      Attributes: { PlatformCredential: "fake-key" },
    }),
  );
  const arn = created.PlatformApplicationArn;
  expect(arn).toBeDefined();
  expect(arn).toContain("app/GCM/bunsai-e2e-app");

  const listed = await client.send(new ListPlatformApplicationsCommand({}));
  const arns = (listed.PlatformApplications ?? []).map(
    (a) => a.PlatformApplicationArn,
  );
  expect(arns).toContain(arn);
});

test("SNS publish with message attributes and json structure", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-publish-attrs" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const withAttrs = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: "hello with attributes",
      MessageAttributes: {
        priority: { DataType: "String", StringValue: "high" },
        count: { DataType: "Number", StringValue: "5" },
      },
    }),
  );
  expect(withAttrs.MessageId).toBeDefined();

  const withJson = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      MessageStructure: "json",
      Message: JSON.stringify({
        default: "default message",
        sqs: "sqs message",
      }),
    }),
  );
  expect(withJson.MessageId).toBeDefined();

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS list subscriptions paginates", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-paging" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  for (let i = 0; i < 120; i += 1) {
    await client.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "email",
        Endpoint: `paging-${i}@example.com`,
      }),
    );
  }

  const firstPage = await client.send(new ListSubscriptionsCommand({}));
  expect((firstPage.Subscriptions ?? []).length).toBe(100);
  expect(firstPage.NextToken).toBeDefined();

  const secondPage = await client.send(
    new ListSubscriptionsCommand({ NextToken: firstPage.NextToken }),
  );
  expect((secondPage.Subscriptions ?? []).length).toBeGreaterThanOrEqual(20);

  const firstArns = new Set(
    (firstPage.Subscriptions ?? []).map((s) => s.SubscriptionArn),
  );
  for (const sub of secondPage.Subscriptions ?? []) {
    expect(firstArns.has(sub.SubscriptionArn)).toBe(false);
  }

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});
