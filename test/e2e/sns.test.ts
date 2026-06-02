import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const sns = () => new SNSClient({ endpoint, region, credentials });

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
