import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const s3 = () =>
  new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });

describe("S3 batch delete and ranged GET", () => {
  test("DeleteObjects removes multiple keys", async () => {
    const client = s3();
    const Bucket = "bunsai-e2e-delete-objects";
    await client.send(new CreateBucketCommand({ Bucket }));
    for (const Key of ["a.txt", "b.txt", "c.txt"]) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body: "x" }));
    }

    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: [{ Key: "a.txt" }, { Key: "b.txt" }] },
      }),
    );
    const deleted = (result.Deleted ?? []).map((d) => d.Key).sort();
    expect(deleted).toEqual(["a.txt", "b.txt"]);

    const listed = await client.send(new ListObjectsV2Command({ Bucket }));
    expect((listed.Contents ?? []).map((o) => o.Key)).toEqual(["c.txt"]);
  });

  test("GetObject honours a byte Range with 206 + Content-Range", async () => {
    const client = s3();
    const Bucket = "bunsai-e2e-range";
    await client.send(new CreateBucketCommand({ Bucket }));
    await client.send(
      new PutObjectCommand({ Bucket, Key: "data", Body: "0123456789" }),
    );

    const ranged = await client.send(
      new GetObjectCommand({ Bucket, Key: "data", Range: "bytes=2-5" }),
    );
    expect(ranged.ContentRange).toBe("bytes 2-5/10");
    expect(ranged.ContentLength).toBe(4);
    expect(await ranged.Body?.transformToString()).toBe("2345");

    const suffix = await client.send(
      new GetObjectCommand({ Bucket, Key: "data", Range: "bytes=-3" }),
    );
    expect(await suffix.Body?.transformToString()).toBe("789");
  });
});
