import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler, uiFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("management resources truncation", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("5 MiB S3 object: resources response < 100 KB and value has truncated marker", async () => {
    const client = s3();
    const bucket = "truncate-test-bucket";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const bodyBytes = new Uint8Array(5 * 1024 * 1024);
    for (let i = 0; i < bodyBytes.length; i++) bodyBytes[i] = i % 256;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "large-object",
        Body: bodyBytes,
        ContentType: "application/octet-stream",
      }),
    );

    const res = await uiFetch("/__bunsai/resources?service=s3");
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text.length).toBeLessThan(100 * 1024);

    const entries = JSON.parse(text) as Array<{
      key: string;
      value: unknown;
    }>;
    const bucketEntry = entries.find((e) => e.key === bucket);
    expect(bucketEntry).toBeDefined();

    const bucketJson = JSON.stringify(bucketEntry?.value);
    expect(bucketJson).toMatch(/<binary,\s*\d+ bytes>/);
  });

  test("small S3 object: short string fields are not truncated", async () => {
    const client = s3();
    const bucket = "truncate-small-bucket";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "small-object",
        Body: "hello world",
        ContentType: "text/plain",
      }),
    );

    const res = await uiFetch("/__bunsai/resources?service=s3");
    expect(res.status).toBe(200);

    const entries = (await res.json()) as Array<{
      key: string;
      value: unknown;
    }>;
    const bucketEntry = entries.find((e) => e.key === bucket);
    expect(bucketEntry).toBeDefined();

    const bucketJson = JSON.stringify(bucketEntry?.value);
    expect(bucketJson).toContain("text/plain");
    expect(bucketJson).not.toMatch(/bytes truncated/);
  });
});
