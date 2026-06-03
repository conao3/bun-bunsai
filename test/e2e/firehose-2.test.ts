import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDeliveryStreamCommand,
  DeleteDeliveryStreamCommand,
  DescribeDeliveryStreamCommand,
  FirehoseClient,
  ListTagsForDeliveryStreamCommand,
  StartDeliveryStreamEncryptionCommand,
  StopDeliveryStreamEncryptionCommand,
  TagDeliveryStreamCommand,
  UntagDeliveryStreamCommand,
} from "@aws-sdk/client-firehose";

const awsPort = 4621;
const uiPort = 5721;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

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

describe("firehose tagging and encryption e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

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

  const firehose = () => new FirehoseClient({ endpoint, region, credentials });

  test("tag, list tags, untag a delivery stream", async () => {
    const client = firehose();
    const name = `bunsai-tag-${Date.now()}`;

    await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    await client.send(
      new TagDeliveryStreamCommand({
        DeliveryStreamName: name,
        Tags: [
          { Key: "env", Value: "test" },
          { Key: "team", Value: "data" },
        ],
      }),
    );

    const listed = await client.send(
      new ListTagsForDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    const tagMap = new Map(
      (listed.Tags ?? []).map((tag) => [tag.Key, tag.Value]),
    );
    expect(tagMap.get("env")).toBe("test");
    expect(tagMap.get("team")).toBe("data");
    expect(listed.HasMoreTags).toBe(false);

    await client.send(
      new UntagDeliveryStreamCommand({
        DeliveryStreamName: name,
        TagKeys: ["env"],
      }),
    );

    const afterUntag = await client.send(
      new ListTagsForDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    const remaining = (afterUntag.Tags ?? []).map((tag) => tag.Key);
    expect(remaining).toContain("team");
    expect(remaining).not.toContain("env");

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
  });

  test("start and stop delivery stream encryption", async () => {
    const client = firehose();
    const name = `bunsai-enc-${Date.now()}`;

    await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    await client.send(
      new StartDeliveryStreamEncryptionCommand({
        DeliveryStreamName: name,
        DeliveryStreamEncryptionConfigurationInput: {
          KeyType: "AWS_OWNED_CMK",
        },
      }),
    );

    const enabled = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(
      enabled.DeliveryStreamDescription?.DeliveryStreamEncryptionConfiguration
        ?.Status,
    ).toBe("ENABLED");
    expect(
      enabled.DeliveryStreamDescription?.DeliveryStreamEncryptionConfiguration
        ?.KeyType,
    ).toBe("AWS_OWNED_CMK");

    await client.send(
      new StopDeliveryStreamEncryptionCommand({ DeliveryStreamName: name }),
    );

    const disabled = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(
      disabled.DeliveryStreamDescription?.DeliveryStreamEncryptionConfiguration
        ?.Status,
    ).toBe("DISABLED");

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
  });
});
