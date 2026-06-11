import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  ListObjectVersionsCommand,
  NoSuchKey,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 fidelity gaps e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("CopyObject TaggingDirective: COPY copies source tags, REPLACE applies x-amz-tagging", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-fidelity-copy-tags";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "src", Body: "body" }),
    );
    await client.send(
      new PutObjectTaggingCommand({
        Bucket: bucket,
        Key: "src",
        Tagging: { TagSet: [{ Key: "env", Value: "prod" }] },
      }),
    );

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: "dst-copy",
        CopySource: `${bucket}/src`,
      }),
    );
    const copyTags = await client.send(
      new GetObjectTaggingCommand({ Bucket: bucket, Key: "dst-copy" }),
    );
    expect(copyTags.TagSet).toEqual([{ Key: "env", Value: "prod" }]);

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: "dst-replace",
        CopySource: `${bucket}/src`,
        TaggingDirective: "REPLACE",
        Tagging: "team=infra&tier=2",
      }),
    );
    const replaceTags = await client.send(
      new GetObjectTaggingCommand({ Bucket: bucket, Key: "dst-replace" }),
    );
    expect(replaceTags.TagSet).toEqual(
      expect.arrayContaining([
        { Key: "team", Value: "infra" },
        { Key: "tier", Value: "2" },
      ]),
    );

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: "src" }));
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "dst-copy" }),
    );
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: "dst-replace" }),
    );
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("CopyObject CopySourceIfMatch: 412 on etag mismatch", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-fidelity-copy-cond";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "src", Body: "body" }),
    );

    await expect(
      client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: "dst",
          CopySource: `${bucket}/src`,
          CopySourceIfMatch: '"nonexistent-etag"',
        }),
      ),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: "src" }));
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("ListObjectVersions: pagination via max-keys", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-fidelity-lov";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: "Enabled" },
      }),
    );

    for (const key of ["a", "b", "c"]) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: key }),
      );
    }

    const page1 = await client.send(
      new ListObjectVersionsCommand({ Bucket: bucket, MaxKeys: 2 }),
    );
    expect(page1.IsTruncated).toBe(true);
    expect(
      (page1.Versions ?? []).length + (page1.DeleteMarkers ?? []).length,
    ).toBe(2);
    expect(page1.NextKeyMarker).toBeDefined();

    const page2 = await client.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        MaxKeys: 2,
        KeyMarker: page1.NextKeyMarker,
        VersionIdMarker: page1.NextVersionIdMarker,
      }),
    );
    expect((page2.Versions ?? []).length).toBeGreaterThan(0);

    const allVersions = await client.send(
      new ListObjectVersionsCommand({ Bucket: bucket }),
    );
    for (const v of [
      ...(allVersions.Versions ?? []),
      ...(allVersions.DeleteMarkers ?? []),
    ]) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: v.Key,
          VersionId: v.VersionId,
        }),
      );
    }
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("ListObjectVersions: delimiter CommonPrefixes", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-fidelity-lov-delim";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    for (const key of ["a/x", "a/y", "b/z"]) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: key }),
      );
    }

    const result = await client.send(
      new ListObjectVersionsCommand({ Bucket: bucket, Delimiter: "/" }),
    );
    const prefixes = (result.CommonPrefixes ?? []).map((p) => p.Prefix);
    expect(prefixes).toEqual(expect.arrayContaining(["a/", "b/"]));
    expect(result.Versions ?? []).toHaveLength(0);

    for (const key of ["a/x", "a/y", "b/z"]) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("ListObjects V1: pagination via max-keys and NextMarker", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-fidelity-lo-v1";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    for (const key of ["a", "b", "c"]) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: key }),
      );
    }

    const page1 = await client.send(
      new ListObjectsCommand({ Bucket: bucket, MaxKeys: 2 }),
    );
    expect(page1.IsTruncated).toBe(true);
    expect((page1.Contents ?? []).length).toBe(2);
    expect(page1.NextMarker).toBeDefined();

    const page2 = await client.send(
      new ListObjectsCommand({
        Bucket: bucket,
        MaxKeys: 2,
        Marker: page1.NextMarker,
      }),
    );
    expect((page2.Contents ?? []).length).toBe(1);
    expect(page2.IsTruncated).toBe(false);

    for (const key of ["a", "b", "c"]) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("ListObjects V1: delimiter CommonPrefixes", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-fidelity-lo-delim";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    for (const key of ["a/x", "a/y", "b/z"]) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: key }),
      );
    }

    const result = await client.send(
      new ListObjectsCommand({ Bucket: bucket, Delimiter: "/" }),
    );
    const prefixes = (result.CommonPrefixes ?? []).map((p) => p.Prefix);
    expect(prefixes).toEqual(expect.arrayContaining(["a/", "b/"]));
    expect(result.Contents ?? []).toHaveLength(0);

    for (const key of ["a/x", "a/y", "b/z"]) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("null-versioned object: DeleteObject with VersionId null removes pre-versioning object", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-null-version-delete";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "obj", Body: "data" }),
    );

    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: "Enabled" },
      }),
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: "obj",
        VersionId: "null",
      }),
    );

    let caught: unknown;
    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key: "obj" }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(NoSuchKey);

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("null-versioned object: DeleteObjects with VersionId null removes pre-versioning object", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-null-version-delete-objects";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "obj", Body: "data" }),
    );

    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: "Enabled" },
      }),
    );

    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: [{ Key: "obj", VersionId: "null" }] },
      }),
    );

    let caught: unknown;
    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key: "obj" }));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(NoSuchKey);

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("GetObject response includes ServerSideEncryption AES256", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-sse-header";
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: "obj", Body: "data" }),
    );

    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "obj" }),
    );
    expect(result.ServerSideEncryption).toBe("AES256");

    const headResult = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: "obj" }),
    );
    expect(headResult.ServerSideEncryption).toBe("AES256");

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: "obj" }));
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("CreateBucket response includes Location header", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-create-location";
    const result = await client.send(
      new CreateBucketCommand({ Bucket: bucket }),
    );
    expect(result.Location).toBe(`/${bucket}`);
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });
});
