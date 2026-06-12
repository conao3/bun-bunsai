import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectTorrentCommand,
  PutObjectCommand,
  RenameObjectCommand,
  RestoreObjectCommand,
  S3Client,
  UpdateObjectEncryptionCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 chunk-4 ops e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("directory-bucket ops: ListDirectoryBuckets, CreateSession", async () => {
    const { gwFetch } = startApp();
    const dirBucket = "my-dir-bucket--usw2-az1--x-s3";
    const authHdr =
      "AWS4-HMAC-SHA256 Credential=test/20260613/us-east-1/s3express/aws4_request, SignedHeaders=host;x-amz-date, Signature=abc";
    const s3AuthHdr =
      "AWS4-HMAC-SHA256 Credential=test/20260613/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=abc";
    const baseHdrs = { "x-amz-date": "20260613T000000Z" };

    await gwFetch(`http://bunsai.test/${dirBucket}`, {
      method: "PUT",
      headers: { Authorization: s3AuthHdr, ...baseHdrs },
    });

    const listRes = await gwFetch(
      "http://bunsai.test/?max-directory-buckets=1000",
      { headers: { Authorization: authHdr, ...baseHdrs } },
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.text();
    expect(listBody).toContain(dirBucket);

    const sessionRes = await gwFetch(
      `http://bunsai.test/${dirBucket}?session`,
      { headers: { Authorization: authHdr, ...baseHdrs } },
    );
    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.text();
    expect(sessionBody).toContain("AccessKeyId");
    expect(sessionBody).toContain("SecretAccessKey");

    await gwFetch(`http://bunsai.test/${dirBucket}`, {
      method: "DELETE",
      headers: { Authorization: s3AuthHdr, ...baseHdrs },
    });
  });

  test("GetObjectTorrent returns binary bencoded content", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-torrent";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "data.txt",
        Body: "hello torrent",
        ContentType: "text/plain",
      }),
    );

    const torrent = await client.send(
      new GetObjectTorrentCommand({ Bucket: bucket, Key: "data.txt" }),
    );
    expect(torrent.Body).toBeDefined();
    const bytes = await (
      torrent.Body as { transformToByteArray(): Promise<Uint8Array> }
    ).transformToByteArray();
    expect(bytes.length).toBeGreaterThan(0);
    expect(String.fromCharCode(bytes[0])).toBe("d");

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "data.txt" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("RenameObject moves object to new key", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-rename";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "src/file.txt",
        Body: "rename me",
        ContentType: "text/plain",
      }),
    );

    await client.send(
      new RenameObjectCommand({
        Bucket: bucket,
        Key: "dst/file.txt",
        RenameSource: `/${bucket}/src/file.txt`,
      }),
    );

    await expect(
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: "src/file.txt",
          Body: "new content",
        }),
      ),
    ).resolves.toBeDefined();

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "dst/file.txt" }),
    );
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "src/file.txt" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("RestoreObject errors on non-glacier object", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-restore";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "doc.txt",
        Body: "standard storage",
        ContentType: "text/plain",
      }),
    );

    await expect(
      client.send(
        new RestoreObjectCommand({
          Bucket: bucket,
          Key: "doc.txt",
          RestoreRequest: { Days: 1 },
        }),
      ),
    ).rejects.toMatchObject({ name: "ObjectAlreadyInActiveTierError" });

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "doc.txt" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("UpdateObjectEncryption changes SSE algorithm", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-encryption";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "secret.txt",
        Body: "encrypted data",
        ContentType: "text/plain",
      }),
    );

    await client.send(
      new UpdateObjectEncryptionCommand({
        Bucket: bucket,
        Key: "secret.txt",
        ObjectEncryption: {
          SSEKMS: {
            KMSKeyArn:
              "arn:aws:kms:us-east-1:123456789012:key/test-key-id-0001",
          },
        },
      }),
    );

    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "secret.txt" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("WriteGetObjectResponse accepts response payload via raw request", async () => {
    const { gwFetch } = startApp();
    const res = await gwFetch("http://bunsai.test/WriteGetObjectResponse", {
      method: "POST",
      headers: {
        Authorization:
          "AWS4-HMAC-SHA256 Credential=test/20260613/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=abc",
        "x-amz-date": "20260613T000000Z",
        "x-amz-request-route": "route-id",
        "x-amz-request-token": "token-id",
      },
    });
    expect(res.status).toBe(200);
  });
});
