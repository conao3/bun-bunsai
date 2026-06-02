import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ListQueueTagsCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
  SQSClient,
  TagQueueCommand,
  UntagQueueCommand,
} from "@aws-sdk/client-sqs";

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

describe("SQS extra ops e2e", () => {
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

  const sqs = () => new SQSClient({ endpoint, region, credentials });
  const queueName = "bunsai-e2e-sqs-extra";

  test("tags, attributes, and purge", async () => {
    const client = sqs();

    const created = await client.send(
      new CreateQueueCommand({ QueueName: queueName }),
    );
    const queueUrl = created.QueueUrl ?? "";
    expect(queueUrl).not.toBe("");

    await client.send(
      new TagQueueCommand({
        QueueUrl: queueUrl,
        Tags: { team: "core", env: "test" },
      }),
    );

    const tagged = await client.send(
      new ListQueueTagsCommand({ QueueUrl: queueUrl }),
    );
    expect(tagged.Tags?.team).toBe("core");
    expect(tagged.Tags?.env).toBe("test");

    await client.send(
      new UntagQueueCommand({ QueueUrl: queueUrl, TagKeys: ["env"] }),
    );

    const afterUntag = await client.send(
      new ListQueueTagsCommand({ QueueUrl: queueUrl }),
    );
    expect(afterUntag.Tags?.team).toBe("core");
    expect(afterUntag.Tags?.env).toBeUndefined();

    await client.send(
      new SetQueueAttributesCommand({
        QueueUrl: queueUrl,
        Attributes: { VisibilityTimeout: "45", DelaySeconds: "5" },
      }),
    );

    const attrs = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["VisibilityTimeout", "DelaySeconds"],
      }),
    );
    expect(attrs.Attributes?.VisibilityTimeout).toBe("45");
    expect(attrs.Attributes?.DelaySeconds).toBe("5");

    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "one" }),
    );
    await client.send(
      new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: "two" }),
    );

    const beforePurge = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      }),
    );
    expect(beforePurge.Attributes?.ApproximateNumberOfMessages).toBe("2");

    await client.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));

    const afterPurge = await client.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      }),
    );
    expect(afterPurge.Attributes?.ApproximateNumberOfMessages).toBe("0");

    const drained = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
      }),
    );
    expect(drained.Messages ?? []).toEqual([]);

    await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
  });
});
