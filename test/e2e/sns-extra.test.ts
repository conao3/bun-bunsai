import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTopicCommand,
  DeleteTopicCommand,
  GetTopicAttributesCommand,
  ListTagsForResourceCommand,
  SetTopicAttributesCommand,
  SNSClient,
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
