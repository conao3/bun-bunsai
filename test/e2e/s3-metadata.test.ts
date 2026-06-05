import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 object metadata e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-metadata";

  test("put object metadata round-trips through get and head", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const put = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "img",
        Body: new Uint8Array([1, 2, 3, 4]),
        ContentType: "image/png",
        Metadata: { foo: "bar" },
      }),
    );
    expect(put.ETag).toMatch(/^"[0-9a-f]{32}"$/);

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "img" }),
    );
    expect(got.ContentType).toBe("image/png");
    expect(got.ContentLength).toBe(4);
    expect(got.Metadata).toEqual({ foo: "bar" });
    expect(got.ETag).toBe(put.ETag);
    expect(got.LastModified).toBeInstanceOf(Date);

    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: "img" }),
    );
    expect(head.ContentType).toBe("image/png");
    expect(head.ContentLength).toBe(4);
    expect(head.Metadata).toEqual({ foo: "bar" });
    expect(head.ETag).toBe(put.ETag);
    expect(head.LastModified).toBeInstanceOf(Date);
  });

  test("object etag is the md5 of the body", async () => {
    const client = s3();
    const body = new Uint8Array([10, 20, 30]);
    const expected = `"${new Bun.CryptoHasher("md5").update(body).digest("hex")}"`;
    const put = await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "md5", Body: body }),
    );
    expect(put.ETag).toBe(expected);
  });

  test("multipart etag uses the part-count suffix form", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "multi" }),
    );
    const uploadId = created.UploadId!;
    const partOne = new Uint8Array(Array.from({ length: 8 }, (_, i) => i));
    const partTwo = new Uint8Array([255, 254, 253]);
    const up1 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "multi",
        UploadId: uploadId,
        PartNumber: 1,
        Body: partOne,
      }),
    );
    const up2 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "multi",
        UploadId: uploadId,
        PartNumber: 2,
        Body: partTwo,
      }),
    );
    expect(up1.ETag).toMatch(/^"[0-9a-f]{32}"$/);
    expect(up2.ETag).toMatch(/^"[0-9a-f]{32}"$/);

    const completed = await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: "multi",
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [
            { PartNumber: 1, ETag: up1.ETag },
            { PartNumber: 2, ETag: up2.ETag },
          ],
        },
      }),
    );
    expect(completed.ETag).toMatch(/^"[0-9a-f]{32}-2"$/);
  });

  test("delete object responds with 204", async () => {
    const client = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "gone",
        Body: new Uint8Array([1]),
      }),
    );
    const deleted = await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "gone" }),
    );
    expect(deleted.$metadata.httpStatusCode).toBe(204);
  });
});
