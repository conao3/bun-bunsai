import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 GetObject response-* override query params e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-response-override";

  test("response overrides take precedence over stored values", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj1",
        Body: new Uint8Array([1, 2, 3]),
        ContentType: "application/octet-stream",
        ContentDisposition: 'attachment; filename="original.bin"',
        CacheControl: "no-store",
        ContentEncoding: "identity",
        ContentLanguage: "en",
      }),
    );

    const got = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "obj1",
        ResponseContentType: "text/plain",
        ResponseContentDisposition: 'attachment; filename="override.txt"',
        ResponseCacheControl: "max-age=3600",
        ResponseContentEncoding: "gzip",
        ResponseContentLanguage: "ja",
      }),
    );

    expect(got.ContentType).toBe("text/plain");
    expect(got.ContentDisposition).toBe('attachment; filename="override.txt"');
    expect(got.CacheControl).toBe("max-age=3600");
    expect(got.ContentEncoding).toBe("gzip");
    expect(got.ContentLanguage).toBe("ja");
  });

  test("stored values returned when no override params present", async () => {
    const client = s3();

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "obj1" }),
    );

    expect(got.ContentType).toBe("application/octet-stream");
    expect(got.ContentDisposition).toBe('attachment; filename="original.bin"');
    expect(got.CacheControl).toBe("no-store");
    expect(got.ContentEncoding).toBe("identity");
    expect(got.ContentLanguage).toBe("en");
  });

  test("partial overrides only change specified headers", async () => {
    const client = s3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj2",
        Body: new Uint8Array([4, 5, 6]),
        ContentType: "image/png",
        ContentDisposition: "inline",
      }),
    );

    const got = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "obj2",
        ResponseContentType: "application/json",
      }),
    );

    expect(got.ContentType).toBe("application/json");
    expect(got.ContentDisposition).toBe("inline");
  });
});
