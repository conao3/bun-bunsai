import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = (): S3Client =>
  new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });

const statusOf = async (run: Promise<unknown>): Promise<number> => {
  try {
    await run;
    return 0;
  } catch (caught) {
    return (caught as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode!;
  }
};

describe("S3 conditional requests e2e", () => {
  const bucket = "bunsai-e2e-s3-conditional";

  test("GetObject and HeadObject honor conditional headers", async () => {
    const s3 = client();
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    const put = await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: "k", Body: "hello" }),
    );
    const etag = put.ETag!;

    expect(
      await statusOf(
        s3.send(
          new GetObjectCommand({ Bucket: bucket, Key: "k", IfNoneMatch: etag }),
        ),
      ),
    ).toBe(304);

    const ok = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "k",
        IfNoneMatch: '"deadbeef"',
      }),
    );
    expect(ok.$metadata.httpStatusCode).toBe(200);

    expect(
      await statusOf(
        s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: "k",
            IfMatch: '"deadbeef"',
          }),
        ),
      ),
    ).toBe(412);

    const matched = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: "k", IfMatch: etag }),
    );
    expect(matched.$metadata.httpStatusCode).toBe(200);

    expect(
      await statusOf(
        s3.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: "k",
            IfNoneMatch: etag,
          }),
        ),
      ),
    ).toBe(304);

    expect(
      await statusOf(
        s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: "k",
            IfModifiedSince: new Date(Date.now() + 3_600_000),
          }),
        ),
      ),
    ).toBe(304);

    expect(
      await statusOf(
        s3.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: "k",
            IfUnmodifiedSince: new Date(Date.now() - 3_600_000),
          }),
        ),
      ),
    ).toBe(412);
  });
});

describe("S3 ListObjectsV2 paging e2e", () => {
  const bucket = "bunsai-e2e-s3-paging";

  test("paging, delimiter, prefix, and start-after", async () => {
    const s3 = client();
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    const keys = [
      ...Array.from({ length: 9 }, (_, i) => `a/${i + 1}`),
      ...Array.from({ length: 9 }, (_, i) => `b/${i + 1}`),
      ...Array.from({ length: 7 }, (_, i) => `c${i + 1}`),
    ];
    for (const Key of keys) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body: "x" }));
    }

    const collected: string[] = [];
    let token: string | undefined;
    let pages = 0;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 10,
          ContinuationToken: token,
        }),
      );
      pages += 1;
      for (const object of page.Contents ?? []) collected.push(object.Key!);
      token = page.NextContinuationToken;
    } while (token !== undefined);

    expect(pages).toBe(3);
    expect(collected.length).toBe(keys.length);
    expect(new Set(collected).size).toBe(keys.length);
    expect(collected).toEqual([...collected].sort());

    const delimited = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Delimiter: "/" }),
    );
    expect((delimited.CommonPrefixes ?? []).map((p) => p.Prefix)).toEqual([
      "a/",
      "b/",
    ]);
    expect((delimited.Contents ?? []).map((o) => o.Key)).toEqual([
      "c1",
      "c2",
      "c3",
      "c4",
      "c5",
      "c6",
      "c7",
    ]);
    expect(delimited.KeyCount).toBe(9);

    const prefixed = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "a/" }),
    );
    expect((prefixed.Contents ?? []).map((o) => o.Key)).toEqual(
      Array.from({ length: 9 }, (_, i) => `a/${i + 1}`),
    );

    const after = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "a/",
        StartAfter: "a/5",
      }),
    );
    expect((after.Contents ?? []).map((o) => o.Key)).toEqual([
      "a/6",
      "a/7",
      "a/8",
      "a/9",
    ]);

    const collectedPrefixes: string[] = [];
    const collectedKeys: string[] = [];
    let delimitedToken: string | undefined;
    let delimitedPages = 0;
    do {
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Delimiter: "/",
          MaxKeys: 2,
          ContinuationToken: delimitedToken,
        }),
      );
      delimitedPages += 1;
      for (const p of page.CommonPrefixes ?? [])
        collectedPrefixes.push(p.Prefix!);
      for (const object of page.Contents ?? []) collectedKeys.push(object.Key!);
      delimitedToken = page.NextContinuationToken;
    } while (delimitedToken !== undefined);

    expect(collectedPrefixes).toEqual(["a/", "b/"]);
    expect(collectedKeys).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7"]);
    expect(delimitedPages).toBe(5);

    const zero = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 0 }),
    );
    expect(zero.IsTruncated).toBe(false);
    expect(zero.KeyCount).toBe(0);
    expect(zero.Contents ?? []).toEqual([]);
    expect(zero.NextContinuationToken).toBeUndefined();
  });
});
