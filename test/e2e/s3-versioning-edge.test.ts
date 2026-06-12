import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  S3Client,
  CreateBucketCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  CopyObjectCommand,
  PutObjectLockConfigurationCommand,
  PutObjectRetentionCommand,
  PutObjectLegalHoldCommand,
  GetObjectLegalHoldCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new S3Client({
  endpoint,
  region: "us-east-1",
  credentials,
  requestHandler,
  forcePathStyle: true,
});

const setVersioning = (Bucket: string, Status: "Enabled" | "Suspended") =>
  client.send(
    new PutBucketVersioningCommand({
      Bucket,
      VersioningConfiguration: { Status },
    }),
  );

test("suspended versioning overwrites the null version", async () => {
  const Bucket = "edge-suspend";
  await client.send(new CreateBucketCommand({ Bucket }));
  await client.send(
    new PutObjectCommand({ Bucket, Key: "k", Body: "pre-versioning" }),
  );
  await setVersioning(Bucket, "Enabled");
  await client.send(
    new PutObjectCommand({ Bucket, Key: "k", Body: "versioned" }),
  );
  await setVersioning(Bucket, "Suspended");
  await client.send(
    new PutObjectCommand({ Bucket, Key: "k", Body: "suspended-write" }),
  );

  const versions = await client.send(new ListObjectVersionsCommand({ Bucket }));
  const nullVersions = (versions.Versions ?? []).filter(
    (v) => v.VersionId === "null",
  );
  expect(nullVersions.length).toBe(1);

  const got = await client.send(
    new GetObjectCommand({ Bucket, Key: "k", VersionId: "null" }),
  );
  expect(await got.Body?.transformToString()).toBe("suspended-write");
});

test("delete marker semantics", async () => {
  const Bucket = "edge-marker";
  await client.send(new CreateBucketCommand({ Bucket }));
  await setVersioning(Bucket, "Enabled");
  await client.send(new PutObjectCommand({ Bucket, Key: "k", Body: "v1" }));

  const del = await client.send(new DeleteObjectCommand({ Bucket, Key: "k" }));
  expect(del.DeleteMarker).toBe(true);
  const markerId = del.VersionId as string;
  expect(markerId).toBeDefined();

  let threw: { name?: string; $metadata?: { httpStatusCode?: number } } = {};
  try {
    await client.send(new GetObjectCommand({ Bucket, Key: "k" }));
  } catch (e) {
    threw = e as typeof threw;
  }
  expect(threw.$metadata?.httpStatusCode).toBe(404);

  const versions = await client.send(new ListObjectVersionsCommand({ Bucket }));
  expect(versions.DeleteMarkers?.length).toBe(1);
  expect(versions.DeleteMarkers?.[0]?.IsLatest).toBe(true);
  expect(versions.Versions?.length).toBe(1);
  expect(versions.Versions?.[0]?.IsLatest).toBe(false);

  await client.send(
    new DeleteObjectCommand({ Bucket, Key: "k", VersionId: markerId }),
  );
  const restored = await client.send(
    new GetObjectCommand({ Bucket, Key: "k" }),
  );
  expect(await restored.Body?.transformToString()).toBe("v1");
});

test("copy object from a specific source version", async () => {
  const Bucket = "edge-copysrc";
  await client.send(new CreateBucketCommand({ Bucket }));
  await setVersioning(Bucket, "Enabled");
  const first = await client.send(
    new PutObjectCommand({ Bucket, Key: "src", Body: "first" }),
  );
  await client.send(
    new PutObjectCommand({ Bucket, Key: "src", Body: "second" }),
  );

  await client.send(
    new CopyObjectCommand({
      Bucket,
      Key: "dst",
      CopySource: `${Bucket}/src?versionId=${first.VersionId}`,
    }),
  );
  const got = await client.send(new GetObjectCommand({ Bucket, Key: "dst" }));
  expect(await got.Body?.transformToString()).toBe("first");
});

test("object lock retention and legal hold", async () => {
  const Bucket = "edge-lock";
  await client.send(
    new CreateBucketCommand({
      Bucket,
      ObjectLockEnabledForBucket: true,
    }),
  );
  await client.send(
    new PutObjectLockConfigurationCommand({
      Bucket,
      ObjectLockConfiguration: { ObjectLockEnabled: "Enabled" },
    }),
  );
  const v1 = await client.send(
    new PutObjectCommand({ Bucket, Key: "doc", Body: "v1" }),
  );
  const until = new Date(Date.now() + 60 * 60 * 1000);
  await client.send(
    new PutObjectRetentionCommand({
      Bucket,
      Key: "doc",
      VersionId: v1.VersionId,
      Retention: { Mode: "COMPLIANCE", RetainUntilDate: until },
    }),
  );

  const v2 = await client.send(
    new PutObjectCommand({ Bucket, Key: "doc", Body: "v2" }),
  );
  expect(v2.VersionId).toBeDefined();
  expect(v2.VersionId).not.toBe(v1.VersionId);

  expect(
    client.send(
      new DeleteObjectCommand({
        Bucket,
        Key: "doc",
        VersionId: v1.VersionId,
      }),
    ),
  ).rejects.toMatchObject({ name: "AccessDenied" });

  await client.send(
    new PutObjectLegalHoldCommand({
      Bucket,
      Key: "doc",
      VersionId: v2.VersionId,
      LegalHold: { Status: "ON" },
    }),
  );
  const hold = await client.send(
    new GetObjectLegalHoldCommand({
      Bucket,
      Key: "doc",
      VersionId: v2.VersionId,
    }),
  );
  expect(hold.LegalHold?.Status).toBe("ON");
  expect(
    client.send(
      new DeleteObjectCommand({
        Bucket,
        Key: "doc",
        VersionId: v2.VersionId,
      }),
    ),
  ).rejects.toMatchObject({ name: "AccessDenied" });
  await client.send(
    new PutObjectLegalHoldCommand({
      Bucket,
      Key: "doc",
      VersionId: v2.VersionId,
      LegalHold: { Status: "OFF" },
    }),
  );
});

test("multipart part boundaries", async () => {
  const Bucket = "edge-mp";
  await client.send(new CreateBucketCommand({ Bucket }));
  const mp = await client.send(
    new CreateMultipartUploadCommand({ Bucket, Key: "big" }),
  );
  const UploadId = mp.UploadId as string;

  const partA = "a".repeat(5 * 1024 * 1024);
  await client.send(
    new UploadPartCommand({
      Bucket,
      Key: "big",
      UploadId,
      PartNumber: 1,
      Body: partA,
    }),
  );
  const partB = "b".repeat(5 * 1024 * 1024);
  const replaced = await client.send(
    new UploadPartCommand({
      Bucket,
      Key: "big",
      UploadId,
      PartNumber: 1,
      Body: partB,
    }),
  );
  const parts = await client.send(
    new ListPartsCommand({ Bucket, Key: "big", UploadId }),
  );
  expect(parts.Parts?.length).toBe(1);
  expect(parts.Parts?.[0]?.ETag).toBe(replaced.ETag);

  expect(
    client.send(
      new CompleteMultipartUploadCommand({
        Bucket,
        Key: "big",
        UploadId,
        MultipartUpload: { Parts: [{ PartNumber: 2, ETag: replaced.ETag }] },
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidPart" });

  await client.send(
    new AbortMultipartUploadCommand({ Bucket, Key: "big", UploadId }),
  );
  expect(
    client.send(new ListPartsCommand({ Bucket, Key: "big", UploadId })),
  ).rejects.toMatchObject({ name: "NoSuchUpload" });
});
