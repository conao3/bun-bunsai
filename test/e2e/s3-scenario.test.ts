import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  GetBucketCorsCommand,
  GetBucketVersioningCommand,
  GetBucketWebsiteCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutBucketVersioningCommand,
  PutBucketWebsiteCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const statusOf = async (run: Promise<unknown>): Promise<number> => {
  try {
    await run;
    return 0;
  } catch (caught) {
    return (caught as { $metadata?: { httpStatusCode?: number } }).$metadata
      ?.httpStatusCode!;
  }
};

describe("S3 static-site hosting scenario e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });

  test("bucket setup, website/cors, prefixed assets, versioned overwrite, conditional GET, bulk delete, teardown", async () => {
    const client = s3();
    const bucket = "bunsai-e2e-s3-scenario";

    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    const head = await client.send(new HeadBucketCommand({ Bucket: bucket }));
    expect(head.$metadata.httpStatusCode).toBe(200);

    await client.send(
      new PutBucketWebsiteCommand({
        Bucket: bucket,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: "index.html" },
          ErrorDocument: { Key: "404.html" },
        },
      }),
    );
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedMethods: ["GET"],
              AllowedOrigins: ["https://example.com"],
            },
          ],
        },
      }),
    );
    const website = await client.send(
      new GetBucketWebsiteCommand({ Bucket: bucket }),
    );
    expect(website.IndexDocument?.Suffix).toBe("index.html");
    expect(website.ErrorDocument?.Key).toBe("404.html");
    const cors = await client.send(
      new GetBucketCorsCommand({ Bucket: bucket }),
    );
    expect((cors.CORSRules ?? [])[0]?.AllowedOrigins).toEqual([
      "https://example.com",
    ]);

    for (const [key, body, contentType] of [
      ["index.html", "<html>initial</html>", "text/html"],
      ["assets/css/site.css", "body{color:red}", "text/css"],
      ["assets/js/app.js", "var app={};", "application/javascript"],
      ["img/logo.png", "pngbytes", "image/png"],
    ] as [string, string, string][]) {
      const put = await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: new TextEncoder().encode(body),
          ContentType: contentType,
        }),
      );
      expect(put.ETag).toBeDefined();
    }

    const byPrefix = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: "assets/" }),
    );
    expect(byPrefix.KeyCount).toBe(2);
    expect((byPrefix.Contents ?? []).map((o) => o.Key).sort()).toEqual([
      "assets/css/site.css",
      "assets/js/app.js",
    ]);

    const withDelimiter = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Delimiter: "/" }),
    );
    expect(
      (withDelimiter.CommonPrefixes ?? []).map((p) => p.Prefix).sort(),
    ).toEqual(["assets/", "img/"]);
    expect((withDelimiter.Contents ?? []).map((o) => o.Key)).toEqual([
      "index.html",
    ]);
    expect(withDelimiter.KeyCount).toBe(3);

    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: "Enabled" },
      }),
    );
    const versioning = await client.send(
      new GetBucketVersioningCommand({ Bucket: bucket }),
    );
    expect(versioning.Status).toBe("Enabled");

    const put1 = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "index.html",
        Body: new TextEncoder().encode("<html>v1</html>"),
        ContentType: "text/html",
      }),
    );
    expect(put1.VersionId).toBeDefined();
    const v1Id = put1.VersionId!;

    const put2 = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "index.html",
        Body: new TextEncoder().encode("<html>v2</html>"),
        ContentType: "text/html",
      }),
    );
    expect(put2.VersionId).toBeDefined();
    expect(put2.VersionId).not.toBe(v1Id);
    const v2Id = put2.VersionId!;

    const getOld = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: "index.html",
        VersionId: v1Id,
      }),
    );
    expect(await new Response(getOld.Body as ReadableStream).text()).toBe(
      "<html>v1</html>",
    );

    const getLatest = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: "index.html" }),
    );
    expect(await new Response(getLatest.Body as ReadableStream).text()).toBe(
      "<html>v2</html>",
    );
    expect(getLatest.VersionId).toBe(v2Id);

    expect(
      await statusOf(
        client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: "index.html",
            IfNoneMatch: getLatest.ETag,
          }),
        ),
      ),
    ).toBe(304);

    const versions = await client.send(
      new ListObjectVersionsCommand({ Bucket: bucket }),
    );
    const indexVersions = (versions.Versions ?? []).filter(
      (v) => v.Key === "index.html",
    );
    expect(indexVersions.length).toBeGreaterThanOrEqual(2);

    const allToDelete = [
      ...(versions.Versions ?? []).map((v) => ({
        Key: v.Key!,
        VersionId: v.VersionId,
      })),
      ...(versions.DeleteMarkers ?? []).map((m) => ({
        Key: m.Key!,
        VersionId: m.VersionId,
      })),
    ];
    const deleteResult = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: allToDelete },
      }),
    );
    expect((deleteResult.Deleted ?? []).length).toBeGreaterThan(0);

    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: "Suspended" },
      }),
    );
    const remaining = await client.send(
      new ListObjectsV2Command({ Bucket: bucket }),
    );
    const keysToClean = (remaining.Contents ?? []).map((o) => ({
      Key: o.Key!,
    }));
    if (keysToClean.length > 0) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keysToClean },
        }),
      );
    }

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    expect(
      await statusOf(client.send(new HeadBucketCommand({ Bucket: bucket }))),
    ).toBe(404);
  });
});
