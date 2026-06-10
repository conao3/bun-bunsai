import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTopicCommand,
  DeleteTopicCommand,
  GetTopicAttributesCommand,
  ListTagsForResourceCommand,
  PublishCommand,
  SetTopicAttributesCommand,
  SNSClient,
  SubscribeCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });

test("SNS topic attributes get/set lifecycle", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-attrs" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const initial = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  expect(initial.Attributes?.TopicArn).toBe(topicArn);
  expect(initial.Attributes?.Owner).toBeDefined();

  await client.send(
    new SetTopicAttributesCommand({
      TopicArn: topicArn,
      AttributeName: "DisplayName",
      AttributeValue: "Bunsai Display",
    }),
  );

  const afterSet = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  expect(afterSet.Attributes?.DisplayName).toBe("Bunsai Display");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS tag/untag/list lifecycle", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-tags" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  await client.send(
    new TagResourceCommand({
      ResourceArn: topicArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: topicArn }),
  );
  const tagMap = new Map((listed.Tags ?? []).map((t) => [t.Key, t.Value]));
  expect(tagMap.get("env")).toBe("test");
  expect(tagMap.get("team")).toBe("platform");

  await client.send(
    new UntagResourceCommand({
      ResourceArn: topicArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: topicArn }),
  );
  const remaining = new Map(
    (afterUntag.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(remaining.has("env")).toBe(false);
  expect(remaining.get("team")).toBe("platform");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS CreateTopic with Tags round-trip", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({
      Name: "bunsai-e2e-tag-roundtrip",
      Tags: [
        { Key: "env", Value: "staging" },
        { Key: "owner", Value: "platform" },
      ],
    }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: topicArn }),
  );
  const tagMap = new Map((listed.Tags ?? []).map((t) => [t.Key, t.Value]));
  expect(tagMap.get("env")).toBe("staging");
  expect(tagMap.get("owner")).toBe("platform");

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS Subscribe ReturnSubscriptionArn=true returns ARN when pending", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({ Name: "bunsai-e2e-return-sub-arn" }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const sub = await client.send(
    new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: "https",
      Endpoint: "https://example.com/hook",
      ReturnSubscriptionArn: true,
    }),
  );
  expect(sub.SubscriptionArn).not.toBe("pending confirmation");
  expect(sub.SubscriptionArn).toMatch(/^arn:aws:sns:/);

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});

test("SNS FIFO Publish deduplicates by MessageDeduplicationId", async () => {
  const client = sns();

  const created = await client.send(
    new CreateTopicCommand({
      Name: "bunsai-e2e-fifo.fifo",
      Attributes: { FifoTopic: "true", ContentBasedDeduplication: "false" },
    }),
  );
  const topicArn = created.TopicArn;
  expect(topicArn).toBeDefined();

  const first = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: "hello",
      MessageDeduplicationId: "dedup-1",
      MessageGroupId: "group-1",
    }),
  );
  expect(first.MessageId).toBeDefined();

  const second = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: "hello again",
      MessageDeduplicationId: "dedup-1",
      MessageGroupId: "group-1",
    }),
  );
  expect(second.MessageId).toBe(first.MessageId);

  const third = await client.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: "different dedupId",
      MessageDeduplicationId: "dedup-2",
      MessageGroupId: "group-1",
    }),
  );
  expect(third.MessageId).not.toBe(first.MessageId);

  await client.send(new DeleteTopicCommand({ TopicArn: topicArn }));
});
