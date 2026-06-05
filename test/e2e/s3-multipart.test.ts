import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  UploadPartCopyCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const errorName = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
    return "";
  } catch (caught) {
    return caught instanceof Error ? caught.name : String(caught);
  }
};

describe("S3 multipart fidelity e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-multipart";

  test("complete rejects missing part with InvalidPart", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "missing" }),
    );
    const up1 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "missing",
        UploadId: created.UploadId!,
        PartNumber: 1,
        Body: new Uint8Array([1, 2, 3]),
      }),
    );
    expect(
      await errorName(
        client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: "missing",
            UploadId: created.UploadId!,
            MultipartUpload: {
              Parts: [
                { PartNumber: 1, ETag: up1.ETag },
                { PartNumber: 2, ETag: '"deadbeef"' },
              ],
            },
          }),
        ),
      ),
    ).toBe("InvalidPart");
  });

  test("complete rejects mismatched ETag with InvalidPart", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "badtag" }),
    );
    await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "badtag",
        UploadId: created.UploadId!,
        PartNumber: 1,
        Body: new Uint8Array([9, 9, 9]),
      }),
    );
    expect(
      await errorName(
        client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: "badtag",
            UploadId: created.UploadId!,
            MultipartUpload: {
              Parts: [
                { PartNumber: 1, ETag: '"00000000000000000000000000000000"' },
              ],
            },
          }),
        ),
      ),
    ).toBe("InvalidPart");
  });

  test("complete rejects descending part order with InvalidPartOrder", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "order" }),
    );
    const up1 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "order",
        UploadId: created.UploadId!,
        PartNumber: 1,
        Body: new Uint8Array([1]),
      }),
    );
    const up2 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "order",
        UploadId: created.UploadId!,
        PartNumber: 2,
        Body: new Uint8Array([2]),
      }),
    );
    expect(
      await errorName(
        client.send(
          new CompleteMultipartUploadCommand({
            Bucket: bucket,
            Key: "order",
            UploadId: created.UploadId!,
            MultipartUpload: {
              Parts: [
                { PartNumber: 2, ETag: up2.ETag },
                { PartNumber: 1, ETag: up1.ETag },
              ],
            },
          }),
        ),
      ),
    ).toBe("InvalidPartOrder");
  });

  test("uploaded but unlisted parts are dropped from the combined object", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "subset" }),
    );
    const up1 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "subset",
        UploadId: created.UploadId!,
        PartNumber: 1,
        Body: new Uint8Array([10, 20]),
      }),
    );
    await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "subset",
        UploadId: created.UploadId!,
        PartNumber: 2,
        Body: new Uint8Array([30, 40]),
      }),
    );
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: "subset",
        UploadId: created.UploadId!,
        MultipartUpload: { Parts: [{ PartNumber: 1, ETag: up1.ETag }] },
      }),
    );
    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "subset" }),
    );
    const bytes = await got.Body!.transformToByteArray();
    expect(sameBytes(bytes, new Uint8Array([10, 20]))).toBe(true);
  });

  test("CreateMultipartUpload ContentType and Metadata are inherited", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: "meta",
        ContentType: "application/x-bunsai",
        Metadata: { color: "blue" },
        StorageClass: "STANDARD_IA",
      }),
    );
    const up1 = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "meta",
        UploadId: created.UploadId!,
        PartNumber: 1,
        Body: new Uint8Array([7, 7, 7]),
      }),
    );
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: "meta",
        UploadId: created.UploadId!,
        MultipartUpload: { Parts: [{ PartNumber: 1, ETag: up1.ETag }] },
      }),
    );
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: "meta" }),
    );
    expect(head.ContentType).toBe("application/x-bunsai");
    expect(head.Metadata?.color).toBe("blue");
    expect(head.StorageClass).toBe("STANDARD_IA");
  });

  test("UploadPartCopy copies source bytes into a part", async () => {
    const client = s3();
    const sourceBody = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "copy-source",
        Body: sourceBody,
      }),
    );
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "copy-dest" }),
    );
    const tail = await client.send(
      new UploadPartCommand({
        Bucket: bucket,
        Key: "copy-dest",
        UploadId: created.UploadId!,
        PartNumber: 2,
        Body: new Uint8Array([200, 201]),
      }),
    );
    const copied = await client.send(
      new UploadPartCopyCommand({
        Bucket: bucket,
        Key: "copy-dest",
        UploadId: created.UploadId!,
        PartNumber: 1,
        CopySource: `${bucket}/copy-source`,
        CopySourceRange: "bytes=2-5",
      }),
    );
    expect(copied.CopyPartResult?.ETag).toBeDefined();
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: "copy-dest",
        UploadId: created.UploadId!,
        MultipartUpload: {
          Parts: [
            { PartNumber: 1, ETag: copied.CopyPartResult!.ETag },
            { PartNumber: 2, ETag: tail.ETag },
          ],
        },
      }),
    );
    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "copy-dest" }),
    );
    const bytes = await got.Body!.transformToByteArray();
    expect(sameBytes(bytes, new Uint8Array([2, 3, 4, 5, 200, 201]))).toBe(true);
  });

  test("AbortMultipartUpload removes the upload", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "abort" }),
    );
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: "abort",
        UploadId: created.UploadId!,
      }),
    );
    expect(
      await errorName(
        client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: "abort",
            UploadId: created.UploadId!,
            PartNumber: 1,
            Body: new Uint8Array([1]),
          }),
        ),
      ),
    ).toBe("NoSuchUpload");
  });
});
