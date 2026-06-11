import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  SNSClient,
  CreateTopicCommand,
  GetTopicAttributesCommand,
  SetTopicAttributesCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new SNSClient({ endpoint, region, credentials, requestHandler });

test("GetTopicAttributes returns a parseable default policy", async () => {
  const created = await client.send(
    new CreateTopicCommand({ Name: "policy-topic" }),
  );
  const topicArn = created.TopicArn!;
  const attrs = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  const policy = JSON.parse(attrs.Attributes?.Policy ?? "") as {
    Id: string;
    Statement: { Effect: string; Resource: string }[];
  };
  expect(policy.Id).toBe("__default_policy_ID");
  expect(policy.Statement[0]?.Effect).toBe("Allow");
  expect(policy.Statement[0]?.Resource).toBe(topicArn);
});

test("SetTopicAttributes overrides the default policy", async () => {
  const created = await client.send(
    new CreateTopicCommand({ Name: "policy-topic-2" }),
  );
  const topicArn = created.TopicArn!;
  const custom = JSON.stringify({
    Version: "2008-10-17",
    Id: "custom",
    Statement: [],
  });
  await client.send(
    new SetTopicAttributesCommand({
      TopicArn: topicArn,
      AttributeName: "Policy",
      AttributeValue: custom,
    }),
  );
  const attrs = await client.send(
    new GetTopicAttributesCommand({ TopicArn: topicArn }),
  );
  expect(
    (JSON.parse(attrs.Attributes?.Policy ?? "") as { Id: string }).Id,
  ).toBe("custom");
});
