import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDeliveryStreamCommand,
  DeleteDeliveryStreamCommand,
  DescribeDeliveryStreamCommand,
  FirehoseClient,
  ListDeliveryStreamsCommand,
  PutRecordBatchCommand,
  PutRecordCommand,
  StartDeliveryStreamEncryptionCommand,
  StopDeliveryStreamEncryptionCommand,
} from "@aws-sdk/client-firehose";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("firehose e2e", () => {
  const firehose = () =>
    new FirehoseClient({ endpoint, region, credentials, requestHandler });

  test("create, describe, list, put and delete a delivery stream", async () => {
    const client = firehose();
    const name = `bunsai-e2e-${Date.now()}`;

    const created = await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(created.DeliveryStreamARN).toContain(name);

    const described = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(described.DeliveryStreamDescription?.DeliveryStreamName).toBe(name);
    expect(described.DeliveryStreamDescription?.DeliveryStreamStatus).toBe(
      "ACTIVE",
    );
    expect(described.DeliveryStreamDescription?.DeliveryStreamType).toBe(
      "DirectPut",
    );

    const listed = await client.send(new ListDeliveryStreamsCommand({}));
    expect(listed.DeliveryStreamNames ?? []).toContain(name);

    const put = await client.send(
      new PutRecordCommand({
        DeliveryStreamName: name,
        Record: { Data: new TextEncoder().encode("hello") },
      }),
    );
    expect(put.RecordId).toBeDefined();

    const batch = await client.send(
      new PutRecordBatchCommand({
        DeliveryStreamName: name,
        Records: [
          { Data: new TextEncoder().encode("a") },
          { Data: new TextEncoder().encode("b") },
        ],
      }),
    );
    expect(batch.FailedPutCount).toBe(0);
    expect((batch.RequestResponses ?? []).length).toBe(2);
    expect(batch.RequestResponses?.[0]?.RecordId).toBeDefined();

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    const afterDelete = await client.send(new ListDeliveryStreamsCommand({}));
    expect(afterDelete.DeliveryStreamNames ?? []).not.toContain(name);
  });

  test("CREATING→ACTIVE lifecycle: PutRecord rejected before first Describe, succeeds after", async () => {
    const client = firehose();
    const name = `bunsai-lifecycle-${Date.now()}`;

    await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    await expect(
      client.send(
        new PutRecordCommand({
          DeliveryStreamName: name,
          Record: { Data: new TextEncoder().encode("test") },
        }),
      ),
    ).rejects.toMatchObject({ name: "ServiceUnavailableException" });

    const described = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(described.DeliveryStreamDescription?.DeliveryStreamStatus).toBe(
      "ACTIVE",
    );

    const put = await client.send(
      new PutRecordCommand({
        DeliveryStreamName: name,
        Record: { Data: new TextEncoder().encode("test") },
      }),
    );
    expect(put.RecordId).toBeDefined();

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
  });

  test("Delete→DELETING: stream queryable once then gone; rejects puts in DELETING state", async () => {
    const client = firehose();
    const name = `bunsai-delete-${Date.now()}`;

    await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    await expect(
      client.send(
        new PutRecordCommand({
          DeliveryStreamName: name,
          Record: { Data: new TextEncoder().encode("test") },
        }),
      ),
    ).rejects.toMatchObject({ name: "ServiceUnavailableException" });

    const deleting = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(deleting.DeliveryStreamDescription?.DeliveryStreamStatus).toBe(
      "DELETING",
    );

    await expect(
      client.send(
        new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
      ),
    ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
  });

  test("encryption interim states: ENABLING→ENABLED, DISABLING→DISABLED", async () => {
    const client = firehose();
    const name = `bunsai-enc-${Date.now()}`;

    await client.send(
      new CreateDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );

    await client.send(
      new StartDeliveryStreamEncryptionCommand({
        DeliveryStreamName: name,
        DeliveryStreamEncryptionConfigurationInput: {
          KeyType: "AWS_OWNED_CMK",
        },
      }),
    );

    const enabling = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(
      enabling.DeliveryStreamDescription?.DeliveryStreamEncryptionConfiguration
        ?.Status,
    ).toBe("ENABLED");

    await client.send(
      new StopDeliveryStreamEncryptionCommand({ DeliveryStreamName: name }),
    );

    const disabling = await client.send(
      new DescribeDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
    expect(
      disabling.DeliveryStreamDescription?.DeliveryStreamEncryptionConfiguration
        ?.Status,
    ).toBe("DISABLED");

    await client.send(
      new DeleteDeliveryStreamCommand({ DeliveryStreamName: name }),
    );
  });
});
