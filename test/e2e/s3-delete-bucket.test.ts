import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AbortMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 DeleteBucket BucketNotEmpty guard e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("rejects non-empty bucket with BucketNotEmpty, succeeds after object deleted", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-delete-bucket-objects";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    const head = await client.send(new HeadBucketCommand({ Bucket: bucket }));
    expect(head.$metadata.httpStatusCode).toBe(200);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "test-object",
        Body: new TextEncoder().encode("hello"),
      }),
    );

    let caughtError: S3ServiceException | undefined;
    try {
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    } catch (err) {
      if (err instanceof S3ServiceException) caughtError = err;
    }
    expect(caughtError?.name).toBe("BucketNotEmpty");
    expect(caughtError?.$metadata.httpStatusCode).toBe(409);

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "test-object" }),
    );

    const res = await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    expect(res.$metadata.httpStatusCode).toBe(204);
  });

  test("rejects bucket with in-progress multipart upload, succeeds after abort", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-delete-bucket-uploads";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const upload = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "mpu-object" }),
    );
    const uploadId = upload.UploadId!;
    expect(typeof uploadId).toBe("string");

    let caughtError: S3ServiceException | undefined;
    try {
      await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    } catch (err) {
      if (err instanceof S3ServiceException) caughtError = err;
    }
    expect(caughtError?.name).toBe("BucketNotEmpty");
    expect(caughtError?.$metadata.httpStatusCode).toBe(409);

    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: "mpu-object",
        UploadId: uploadId,
      }),
    );

    const res = await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    expect(res.$metadata.httpStatusCode).toBe(204);
  });
});
