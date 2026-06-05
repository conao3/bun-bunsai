import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateDeliveryStreamCommand,
  DeleteDeliveryStreamCommand,
  DescribeDeliveryStreamCommand,
  FirehoseClient,
  ListDeliveryStreamsCommand,
  PutRecordBatchCommand,
  PutRecordCommand,
} from "@aws-sdk/client-firehose";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("firehose e2e", () => {
  const firehose = () => new FirehoseClient({ endpoint, region, credentials });

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
});
