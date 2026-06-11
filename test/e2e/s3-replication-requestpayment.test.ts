import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketReplicationCommand,
  GetBucketReplicationCommand,
  GetBucketRequestPaymentCommand,
  PutBucketReplicationCommand,
  PutBucketRequestPaymentCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 replication and requestPayment e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-replication-rp";

  test("replication round-trip: 404 → put → get → delete → 404", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketReplicationCommand({ Bucket: bucket })),
    ).rejects.toMatchObject({ name: "ReplicationConfigurationNotFoundError" });

    await client.send(
      new PutBucketReplicationCommand({
        Bucket: bucket,
        ReplicationConfiguration: {
          Role: "arn:aws:iam::123456789012:role/replication-role",
          Rules: [
            {
              ID: "rule-1",
              Status: "Enabled",
              Filter: { Prefix: "" },
              Destination: {
                Bucket: "arn:aws:s3:::destination-bucket",
              },
            },
          ],
        },
      }),
    );

    const got = await client.send(
      new GetBucketReplicationCommand({ Bucket: bucket }),
    );
    expect(got.ReplicationConfiguration?.Role).toBe(
      "arn:aws:iam::123456789012:role/replication-role",
    );
    expect((got.ReplicationConfiguration?.Rules ?? []).length).toBe(1);
    expect((got.ReplicationConfiguration?.Rules ?? [])[0]?.ID).toBe("rule-1");

    await client.send(new DeleteBucketReplicationCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketReplicationCommand({ Bucket: bucket })),
    ).rejects.toMatchObject({ name: "ReplicationConfigurationNotFoundError" });
  });

  test("requestPayment default BucketOwner and put Requester", async () => {
    const client = s3();

    const defaultPayer = await client.send(
      new GetBucketRequestPaymentCommand({ Bucket: bucket }),
    );
    expect(defaultPayer.Payer).toBe("BucketOwner");

    await client.send(
      new PutBucketRequestPaymentCommand({
        Bucket: bucket,
        RequestPaymentConfiguration: { Payer: "Requester" },
      }),
    );

    const updated = await client.send(
      new GetBucketRequestPaymentCommand({ Bucket: bucket }),
    );
    expect(updated.Payer).toBe("Requester");

    await client.send(
      new PutBucketRequestPaymentCommand({
        Bucket: bucket,
        RequestPaymentConfiguration: { Payer: "BucketOwner" },
      }),
    );

    const restored = await client.send(
      new GetBucketRequestPaymentCommand({ Bucket: bucket }),
    );
    expect(restored.Payer).toBe("BucketOwner");
  });
});
