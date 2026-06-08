import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketLifecycleCommand,
  DeleteObjectCommand,
  GetBucketLifecycleConfigurationCommand,
  GetObjectCommand,
  ListObjectVersionsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 versioning e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("versioning lifecycle", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-versioning";
    const key = "test-object.txt";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: "Enabled" },
      }),
    );

    const put1 = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new TextEncoder().encode("version-1"),
        ContentType: "text/plain",
      }),
    );
    expect(put1.VersionId).toBeDefined();
    const v1Id = put1.VersionId!;

    const put2 = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: new TextEncoder().encode("version-2"),
        ContentType: "text/plain",
      }),
    );
    expect(put2.VersionId).toBeDefined();
    expect(put2.VersionId).not.toBe(v1Id);
    const v2Id = put2.VersionId!;

    const getLatest = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const latestBody = await new Response(
      getLatest.Body as ReadableStream,
    ).text();
    expect(latestBody).toBe("version-2");
    expect(getLatest.VersionId).toBe(v2Id);

    const getOld = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, VersionId: v1Id }),
    );
    const oldBody = await new Response(getOld.Body as ReadableStream).text();
    expect(oldBody).toBe("version-1");
    expect(getOld.VersionId).toBe(v1Id);

    const del = await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
    expect(del.DeleteMarker).toBe(true);
    expect(del.VersionId).toBeDefined();
    const markerId = del.VersionId!;

    try {
      await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      throw new Error("should have thrown");
    } catch (err: unknown) {
      expect((err as { name: string }).name).toBe("NoSuchKey");
    }

    const list = await client.send(
      new ListObjectVersionsCommand({ Bucket: bucket }),
    );
    expect(list.Versions?.length).toBe(2);
    expect(list.DeleteMarkers?.length).toBe(1);
    const marker = list.DeleteMarkers![0];
    expect(marker.VersionId).toBe(markerId);
    expect(marker.IsLatest).toBe(true);

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
        VersionId: markerId,
      }),
    );

    const restored = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const restoredBody = await new Response(
      restored.Body as ReadableStream,
    ).text();
    expect(restoredBody).toBe("version-2");
  });

  test("lifecycle configuration round-trip", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-lifecycle";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    const rules = [
      {
        ID: "expire-old",
        Status: "Enabled" as const,
        Filter: { Prefix: "logs/" },
        Expiration: { Days: 30 },
      },
    ];
    await client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: bucket,
        LifecycleConfiguration: { Rules: rules },
      }),
    );

    const got = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
    );
    expect(got.Rules?.length).toBe(1);
    expect(got.Rules![0].ID).toBe("expire-old");
    expect(got.Rules![0].Status).toBe("Enabled");

    await client.send(new DeleteBucketLifecycleCommand({ Bucket: bucket }));

    try {
      await client.send(
        new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }),
      );
      throw new Error("should have thrown");
    } catch (err: unknown) {
      expect((err as { name: string }).name).toBe(
        "NoSuchLifecycleConfiguration",
      );
    }
  });
});
