import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

describe("S3 presigned URL e2e", () => {
  const pathStyle = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-presigned";

  test("presigned PUT then GET round-trips binary body", async () => {
    const client = pathStyle();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const payload = new Uint8Array([0, 1, 2, 255, 254, 128, 127, 64]);
    const putUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: "signed" }),
      { expiresIn: 900 },
    );
    expect(putUrl).toContain("X-Amz-Credential");
    const putRes = await gwFetch(putUrl, { method: "PUT", body: payload });
    expect(putRes.status).toBe(200);

    const getUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: "signed" }),
      { expiresIn: 900 },
    );
    const getRes = await gwFetch(getUrl, { method: "GET" });
    expect(getRes.status).toBe(200);
    const bytes = new Uint8Array(await getRes.arrayBuffer());
    expect(sameBytes(bytes, payload)).toBe(true);
  });

  test("expired presigned URL is rejected with 403", async () => {
    const client = pathStyle();
    const getUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: "signed" }),
      { expiresIn: 1 },
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const res = await gwFetch(getUrl, { method: "GET" });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("AccessDenied");
  });
});

describe("S3 virtual-host style e2e", () => {
  const virtualHost = () =>
    new S3Client({ endpoint, region, credentials, requestHandler });
  const bucket = "bunsai-e2e-s3-vhost";

  test("CreateBucket, PutObject, GetObject, ListObjectsV2 over virtual-host", async () => {
    const client = virtualHost();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const payload = new Uint8Array([5, 6, 7, 8]);
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "vh/obj", Body: payload }),
    );

    const got = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "vh/obj" }),
    );
    const bytes = await got.Body!.transformToByteArray();
    expect(sameBytes(bytes, payload)).toBe(true);

    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket }),
    );
    expect(listed.Contents?.map((c) => c.Key)).toContain("vh/obj");
    expect(listed.Name).toBe(bucket);
  });
});
