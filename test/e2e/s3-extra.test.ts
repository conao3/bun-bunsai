import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteBucketCommand,
  DeleteBucketTaggingCommand,
  DeleteObjectCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
  GetObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsCommand,
  ListPartsCommand,
  PutBucketTaggingCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

type GetObjectCommandOutputBody =
  | { transformToString: () => Promise<string> }
  | undefined;

const readBody = async (body: GetObjectCommandOutputBody): Promise<string> => {
  if (body === undefined) return "";
  return body.transformToString();
};

describe("S3 extra ops e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-extra";

  test("copy, tagging, location, and list-v1 lifecycle", async () => {
    const client = s3();

    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "src/hello.txt",
        Body: "hello-world",
        ContentType: "text/plain",
      }),
    );

    const copied = await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: "dst/hello.txt",
        CopySource: `/${bucket}/src/hello.txt`,
      }),
    );
    expect(copied.CopyObjectResult?.ETag).toBeDefined();

    const fetched = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "dst/hello.txt" }),
    );
    expect(await readBody(fetched.Body as GetObjectCommandOutputBody)).toBe(
      "hello-world",
    );

    await client.send(
      new PutBucketTaggingCommand({
        Bucket: bucket,
        Tagging: {
          TagSet: [
            { Key: "env", Value: "dev" },
            { Key: "team", Value: "bunsai" },
          ],
        },
      }),
    );

    const tagging = await client.send(
      new GetBucketTaggingCommand({ Bucket: bucket }),
    );
    const tags = (tagging.TagSet ?? []).reduce<Record<string, string>>(
      (acc, tag) => {
        if (tag.Key !== undefined && tag.Value !== undefined) {
          acc[tag.Key] = tag.Value;
        }
        return acc;
      },
      {},
    );
    expect(tags).toEqual({ env: "dev", team: "bunsai" });

    await client.send(new DeleteBucketTaggingCommand({ Bucket: bucket }));

    const taggingAfter = await client.send(
      new GetBucketTaggingCommand({ Bucket: bucket }),
    );
    expect(taggingAfter.TagSet ?? []).toEqual([]);

    const location = await client.send(
      new GetBucketLocationCommand({ Bucket: bucket }),
    );
    expect(typeof location.LocationConstraint).toBe("string");

    const listed = await client.send(
      new ListObjectsCommand({ Bucket: bucket }),
    );
    const keys = (listed.Contents ?? []).map((o) => o.Key).sort();
    expect(keys).toEqual(["dst/hello.txt", "src/hello.txt"]);
    expect(listed.Name).toBe(bucket);

    const prefixed = await client.send(
      new ListObjectsCommand({ Bucket: bucket, Prefix: "dst/" }),
    );
    expect((prefixed.Contents ?? []).map((o) => o.Key)).toEqual([
      "dst/hello.txt",
    ]);

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "src/hello.txt" }),
    );
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "dst/hello.txt" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("multipart upload lifecycle: create, upload, list, complete", async () => {
    const client = s3();
    const mpBucket = "bunsai-e2e-s3-mp";
    const key = "big/object.txt";
    const part1 = "x".repeat(20);
    const part2 = "y".repeat(15);

    await client.send(new CreateBucketCommand({ Bucket: mpBucket }));

    const created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: mpBucket,
        Key: key,
        ContentType: "text/plain",
      }),
    );
    expect(created.UploadId).toBeDefined();
    const uploadId = created.UploadId as string;

    const up1 = await client.send(
      new UploadPartCommand({
        Bucket: mpBucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: 1,
        Body: part1,
      }),
    );
    expect(up1.ETag).toBeDefined();

    const up2 = await client.send(
      new UploadPartCommand({
        Bucket: mpBucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: 2,
        Body: part2,
      }),
    );
    expect(up2.ETag).toBeDefined();

    const listedParts = await client.send(
      new ListPartsCommand({ Bucket: mpBucket, Key: key, UploadId: uploadId }),
    );
    expect((listedParts.Parts ?? []).map((p) => p.PartNumber)).toEqual([1, 2]);

    const listedUploads = await client.send(
      new ListMultipartUploadsCommand({ Bucket: mpBucket }),
    );
    expect((listedUploads.Uploads ?? []).map((u) => u.UploadId)).toContain(
      uploadId,
    );

    const completed = await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: mpBucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [
            { PartNumber: 1, ETag: up1.ETag },
            { PartNumber: 2, ETag: up2.ETag },
          ],
        },
      }),
    );
    expect(completed.Key).toBe(key);
    expect(completed.ETag).toBeDefined();

    const fetched = await client.send(
      new GetObjectCommand({ Bucket: mpBucket, Key: key }),
    );
    expect(await readBody(fetched.Body as GetObjectCommandOutputBody)).toBe(
      part1 + part2,
    );

    const uploadsAfter = await client.send(
      new ListMultipartUploadsCommand({ Bucket: mpBucket }),
    );
    expect((uploadsAfter.Uploads ?? []).length).toBe(0);

    await client.send(new DeleteObjectCommand({ Bucket: mpBucket, Key: key }));
    await client.send(new DeleteBucketCommand({ Bucket: mpBucket }));
  });

  test("multipart upload abort", async () => {
    const client = s3();
    const abBucket = "bunsai-e2e-s3-mp-abort";
    const key = "abort/object.txt";

    await client.send(new CreateBucketCommand({ Bucket: abBucket }));

    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: abBucket, Key: key }),
    );
    const uploadId = created.UploadId as string;

    await client.send(
      new UploadPartCommand({
        Bucket: abBucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: 1,
        Body: "data",
      }),
    );

    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: abBucket,
        Key: key,
        UploadId: uploadId,
      }),
    );

    const uploadsAfter = await client.send(
      new ListMultipartUploadsCommand({ Bucket: abBucket }),
    );
    expect((uploadsAfter.Uploads ?? []).length).toBe(0);

    await client.send(new DeleteBucketCommand({ Bucket: abBucket }));
  });
});
