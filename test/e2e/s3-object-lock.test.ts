import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectAttributesCommand,
  GetObjectLegalHoldCommand,
  GetObjectRetentionCommand,
  PutObjectCommand,
  PutObjectLegalHoldCommand,
  PutObjectRetentionCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 object-lock e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-object-lock";

  test("PutObjectRetention / GetObjectRetention round-trip", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "retain-obj",
        Body: "hello",
      }),
    );

    const retainUntil = new Date("2030-01-01T00:00:00.000Z");

    await client.send(
      new PutObjectRetentionCommand({
        Bucket: bucket,
        Key: "retain-obj",
        Retention: {
          Mode: "GOVERNANCE",
          RetainUntilDate: retainUntil,
        },
      }),
    );

    const got = await client.send(
      new GetObjectRetentionCommand({
        Bucket: bucket,
        Key: "retain-obj",
      }),
    );

    expect(got.Retention?.Mode).toBe("GOVERNANCE");
    expect(got.Retention?.RetainUntilDate?.toISOString()).toBe(
      retainUntil.toISOString(),
    );

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "retain-obj" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("PutObjectLegalHold ON / GetObjectLegalHold returns ON", async () => {
    const client = s3();
    const lhBucket = "bunsai-e2e-s3-legal-hold";
    await client.send(new CreateBucketCommand({ Bucket: lhBucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: lhBucket,
        Key: "hold-obj",
        Body: "world",
      }),
    );

    await client.send(
      new PutObjectLegalHoldCommand({
        Bucket: lhBucket,
        Key: "hold-obj",
        LegalHold: { Status: "ON" },
      }),
    );

    const got = await client.send(
      new GetObjectLegalHoldCommand({
        Bucket: lhBucket,
        Key: "hold-obj",
      }),
    );

    expect(got.LegalHold?.Status).toBe("ON");

    await client.send(
      new DeleteObjectCommand({ Bucket: lhBucket, Key: "hold-obj" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: lhBucket }));
  });

  test("GetObjectAttributes returns ETag and ObjectSize", async () => {
    const client = s3();
    const attrBucket = "bunsai-e2e-s3-attributes";
    await client.send(new CreateBucketCommand({ Bucket: attrBucket }));

    const body = "attributes-test-content";
    await client.send(
      new PutObjectCommand({
        Bucket: attrBucket,
        Key: "attr-obj",
        Body: body,
      }),
    );

    const got = await client.send(
      new GetObjectAttributesCommand({
        Bucket: attrBucket,
        Key: "attr-obj",
        ObjectAttributes: ["ETag", "ObjectSize"],
      }),
    );

    expect(got.ETag).toBeDefined();
    expect(got.ObjectSize).toBe(body.length);

    await client.send(
      new DeleteObjectCommand({ Bucket: attrBucket, Key: "attr-obj" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: attrBucket }));
  });

  test("GetObjectRetention returns NoSuchKey for missing object", async () => {
    const client = s3();
    const noBucket = "bunsai-e2e-s3-nosuchkey";
    await client.send(new CreateBucketCommand({ Bucket: noBucket }));

    await expect(
      client.send(
        new GetObjectRetentionCommand({
          Bucket: noBucket,
          Key: "nonexistent",
        }),
      ),
    ).rejects.toMatchObject({ name: "NoSuchKey" });

    await client.send(new DeleteBucketCommand({ Bucket: noBucket }));
  });
});
