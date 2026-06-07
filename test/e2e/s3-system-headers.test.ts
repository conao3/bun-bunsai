import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 system metadata headers e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-system-headers";

  test("PutObject system headers round-trip via GetObject", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj1",
        Body: new Uint8Array([1, 2, 3]),
        ContentType: "text/plain",
        ContentDisposition: 'attachment; filename="file.txt"',
        CacheControl: "max-age=3600",
        ContentEncoding: "identity",
      }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "obj1" }),
    );
    expect(got.ContentDisposition).toBe('attachment; filename="file.txt"');
    expect(got.CacheControl).toBe("max-age=3600");
    expect(got.ContentEncoding).toBe("identity");
  });

  test("PutObject system headers round-trip via HeadObject", async () => {
    const client = s3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj2",
        Body: new Uint8Array([4, 5, 6]),
        ContentType: "application/json",
        ContentDisposition: "inline",
        CacheControl: "no-cache",
        ContentLanguage: "en-US",
      }),
    );

    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: "obj2" }),
    );
    expect(head.ContentDisposition).toBe("inline");
    expect(head.CacheControl).toBe("no-cache");
    expect(head.ContentLanguage).toBe("en-US");
  });

  test("objects without system headers omit them", async () => {
    const client = s3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj3",
        Body: new Uint8Array([7, 8, 9]),
      }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "obj3" }),
    );
    expect(got.ContentDisposition).toBeUndefined();
    expect(got.CacheControl).toBeUndefined();
    expect(got.ContentEncoding).toBeUndefined();
    expect(got.ContentLanguage).toBeUndefined();
    expect(got.Expires).toBeUndefined();
  });

  test("multipart upload with CacheControl returns it after complete", async () => {
    const client = s3();

    const create = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: "multipart1",
        CacheControl: "public, max-age=86400",
      }),
    );
    const uploadId = create.UploadId!;

    const part = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "multipart1",
        UploadId: uploadId,
        PartNumber: 1,
        Body: new Uint8Array(5 * 1024 * 1024),
      }),
    );

    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: "multipart1",
        UploadId: uploadId,
        MultipartUpload: { Parts: [{ PartNumber: 1, ETag: part.ETag }] },
      }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "multipart1" }),
    );
    expect(got.CacheControl).toBe("public, max-age=86400");
  });

  test("CopyObject carries system headers from source", async () => {
    const client = s3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "copy-source",
        Body: new Uint8Array([10, 11, 12]),
        ContentDisposition: "attachment",
        CacheControl: "no-store",
      }),
    );

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: "copy-dest",
        CopySource: `${bucket}/copy-source`,
      }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "copy-dest" }),
    );
    expect(got.ContentDisposition).toBe("attachment");
    expect(got.CacheControl).toBe("no-store");
  });
});
