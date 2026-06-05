import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
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
  UpdateDestinationCommand,
} from "@aws-sdk/client-firehose";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("firehose tagging and encryption e2e", () => {
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

  test("update destination bumps version id", async () => {
    const client = firehose();
    const name = `bunsai-upd-${Date.now()}`;

    await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    const described = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    const versionId = described.DeliveryStreamDescription?.VersionId ?? "1";
    expect(versionId).toBe("1");

    await client.send(
      new UpdateDestinationCommand({
        DeliveryStreamName: name,
        CurrentDeliveryStreamVersionId: versionId,
        DestinationId: "destinationId-000000000001",
      }),
    );

    const afterUpdate = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(afterUpdate.DeliveryStreamDescription?.VersionId).toBe("2");

    await expect(
      client.send(
        new UpdateDestinationCommand({
          DeliveryStreamName: name,
          CurrentDeliveryStreamVersionId: "1",
          DestinationId: "destinationId-000000000001",
        }),
      ),
    ).rejects.toThrow();

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
  });
});
