import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler, uiFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const allBytes = (): Uint8Array => {
  const block = new Uint8Array(Array.from({ length: 256 }, (_, i) => i));
  const out = new Uint8Array(block.byteLength * 16);
  for (let i = 0; i < 16; i += 1) out.set(block, i * block.byteLength);
  return out;
};

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

describe("S3 binary payload e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-binary";

  test("put and get binary object round-trips every byte", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const payload = allBytes();
    expect(payload[255]).toBe(255);
    expect(payload[254]).toBe(254);

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "blob", Body: payload }),
    );
    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "blob" }),
    );
    const bytes = await got.Body!.transformToByteArray();
    expect(sameBytes(bytes, payload)).toBe(true);
  });

  test("multipart upload preserves combined binary bytes", async () => {
    const client = s3();
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: "multi" }),
    );
    const uploadId = created.UploadId!;
    const partOne = allBytes();
    const partTwo = new Uint8Array([255, 254, 0, 1, 128, 127, 255]);

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

    await client.send(
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

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "multi" }),
    );
    const bytes = await got.Body!.transformToByteArray();
    const expected = new Uint8Array(partOne.byteLength + partTwo.byteLength);
    expected.set(partOne, 0);
    expected.set(partTwo, partOne.byteLength);
    expect(sameBytes(bytes, expected)).toBe(true);
  });

  test("text object still round-trips as string", async () => {
    const client = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "text",
        Body: "hello bunsai",
      }),
    );
    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "text" }),
    );
    expect(await got.Body!.transformToString()).toBe("hello bunsai");
  });

  test("binary put log summarizes request body", async () => {
    const client = s3();
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "logged", Body: allBytes() }),
    );
    const res = await uiFetch("/__bunsai/logs");
    const logs = (await res.json()) as {
      operation: string;
      requestBodyText: string;
    }[];
    const entry = logs.find(
      (e) =>
        e.operation === "PutObject" && e.requestBodyText.startsWith("(binary"),
    );
    expect(entry).toBeDefined();
  });
});
