import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CopyObjectCommand,
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 CopyObject MetadataDirective e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-copy-metadata";

  test("MetadataDirective=REPLACE rewrites metadata on self-copy", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj",
        Body: new Uint8Array([1, 2, 3]),
        ContentType: "image/png",
        Metadata: { foo: "original" },
        CacheControl: "no-store",
        ContentDisposition: "attachment",
      }),
    );

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: "obj",
        CopySource: `${bucket}/obj`,
        MetadataDirective: "REPLACE",
        ContentType: "text/plain",
        Metadata: { foo: "replaced", bar: "new" },
        CacheControl: "max-age=3600",
        ContentLanguage: "en-US",
      }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "obj" }),
    );
    expect(got.ContentType).toBe("text/plain");
    expect(got.Metadata).toEqual({ foo: "replaced", bar: "new" });
    expect(got.CacheControl).toBe("max-age=3600");
    expect(got.ContentLanguage).toBe("en-US");
    expect(got.ContentDisposition).toBeUndefined();

    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: "obj" }),
    );
    expect(head.ContentType).toBe("text/plain");
    expect(head.Metadata).toEqual({ foo: "replaced", bar: "new" });
    expect(head.CacheControl).toBe("max-age=3600");
  });

  test("CopyObject without directive preserves source metadata", async () => {
    const client = s3();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "src",
        Body: new Uint8Array([4, 5, 6]),
        ContentType: "application/json",
        Metadata: { source: "yes" },
        ContentDisposition: "inline",
      }),
    );

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: "dst",
        CopySource: `${bucket}/src`,
      }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "dst" }),
    );
    expect(got.ContentType).toBe("application/json");
    expect(got.Metadata).toEqual({ source: "yes" });
    expect(got.ContentDisposition).toBe("inline");
  });
});
