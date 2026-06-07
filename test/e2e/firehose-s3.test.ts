import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDeliveryStreamCommand,
  FirehoseClient,
  PutRecordBatchCommand,
  PutRecordCommand,
} from "@aws-sdk/client-firehose";
import {
  CreateBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("firehose S3 delivery e2e", () => {
  const firehose = () =>
    new FirehoseClient({ endpoint, region, credentials, requestHandler });
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("PutRecord delivers to S3 bucket via S3DestinationConfiguration", async () => {
    const fh = firehose();
    const s3c = s3();
    const bucket = `fh-s3-${Date.now()}`;
    const streamName = `fh-stream-${Date.now()}`;

    await s3c.send(new CreateBucketCommand({ Bucket: bucket }));

    const created = await fh.send(
      new CreateDeliveryStreamCommand({
        DeliveryStreamName: streamName,
        S3DestinationConfiguration: {
          BucketARN: `arn:aws:s3:::${bucket}`,
          RoleARN: "arn:aws:iam::123456789012:role/test",
          Prefix: "records/",
        },
      }),
    );
    expect(created.DeliveryStreamARN).toContain(streamName);

    const payload = new TextEncoder().encode("hello-firehose");
    const put = await fh.send(
      new PutRecordCommand({
        DeliveryStreamName: streamName,
        Record: { Data: payload },
      }),
    );
    expect(put.RecordId).toBeDefined();
    expect(typeof put.RecordId).toBe("string");

    const listed = await s3c.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "records/" }),
    );
    expect(listed.KeyCount).toBe(1);
    const objectKey = listed.Contents?.[0]?.Key;
    expect(objectKey).toMatch(/^records\//);

    const got = await s3c.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey! }),
    );
    const body = await got.Body?.transformToByteArray();
    expect(body).toEqual(payload);
  });

  test("PutRecord delivers to S3 via ExtendedS3DestinationConfiguration", async () => {
    const fh = firehose();
    const s3c = s3();
    const bucket = `fh-ext-${Date.now()}`;
    const streamName = `fh-ext-stream-${Date.now()}`;

    await s3c.send(new CreateBucketCommand({ Bucket: bucket }));

    await fh.send(
      new CreateDeliveryStreamCommand({
        DeliveryStreamName: streamName,
        ExtendedS3DestinationConfiguration: {
          BucketARN: `arn:aws:s3:::${bucket}`,
          RoleARN: "arn:aws:iam::123456789012:role/test",
          Prefix: "ext/",
        },
      }),
    );

    const payload = new TextEncoder().encode("extended-delivery");
    await fh.send(
      new PutRecordCommand({
        DeliveryStreamName: streamName,
        Record: { Data: payload },
      }),
    );

    const listed = await s3c.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "ext/" }),
    );
    expect(listed.KeyCount).toBe(1);
    const got = await s3c.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: listed.Contents![0]!.Key!,
      }),
    );
    const body = await got.Body?.transformToByteArray();
    expect(body).toEqual(payload);
  });

  test("PutRecordBatch delivers all records to S3", async () => {
    const fh = firehose();
    const s3c = s3();
    const bucket = `fh-batch-${Date.now()}`;
    const streamName = `fh-batch-stream-${Date.now()}`;

    await s3c.send(new CreateBucketCommand({ Bucket: bucket }));

    await fh.send(
      new CreateDeliveryStreamCommand({
        DeliveryStreamName: streamName,
        S3DestinationConfiguration: {
          BucketARN: `arn:aws:s3:::${bucket}`,
          RoleARN: "arn:aws:iam::123456789012:role/test",
          Prefix: "batch/",
        },
      }),
    );

    const payloads = ["alpha", "beta", "gamma"].map((s) =>
      new TextEncoder().encode(s),
    );
    const batch = await fh.send(
      new PutRecordBatchCommand({
        DeliveryStreamName: streamName,
        Records: payloads.map((p) => ({ Data: p })),
      }),
    );
    expect(batch.FailedPutCount).toBe(0);
    expect(batch.RequestResponses?.length).toBe(3);
    for (const r of batch.RequestResponses ?? []) {
      expect(r.RecordId).toBeDefined();
    }

    const listed = await s3c.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "batch/" }),
    );
    expect(listed.KeyCount).toBe(3);

    const keys = (listed.Contents ?? []).map((c) => c.Key!);
    const bodies = await Promise.all(
      keys.map(async (key) => {
        const obj = await s3c.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        return obj.Body?.transformToByteArray();
      }),
    );
    const decoded = bodies.map((b) => new TextDecoder().decode(b));
    expect(decoded.sort()).toEqual(["alpha", "beta", "gamma"].sort());
  });
});
