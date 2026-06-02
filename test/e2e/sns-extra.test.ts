import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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
