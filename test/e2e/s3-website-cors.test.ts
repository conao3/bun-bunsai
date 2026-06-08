import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteBucketCorsCommand,
  DeleteBucketWebsiteCommand,
  GetBucketCorsCommand,
  GetBucketWebsiteCommand,
  PutBucketCorsCommand,
  PutBucketWebsiteCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 website and CORS round-trip e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-website-cors";

  test("website lifecycle: put, get, delete, NoSuchWebsiteConfiguration", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutBucketWebsiteCommand({
        Bucket: bucket,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: "index.html" },
          ErrorDocument: { Key: "error.html" },
          RoutingRules: [
            {
              Condition: { KeyPrefixEquals: "old/" },
              Redirect: { ReplaceKeyPrefixWith: "new/" },
            },
          ],
        },
      }),
    );

    const got = await client.send(
      new GetBucketWebsiteCommand({ Bucket: bucket }),
    );
    expect(got.IndexDocument?.Suffix).toBe("index.html");
    expect(got.ErrorDocument?.Key).toBe("error.html");
    expect((got.RoutingRules ?? []).length).toBe(1);
    expect((got.RoutingRules ?? [])[0]?.Condition?.KeyPrefixEquals).toBe(
      "old/",
    );

    await client.send(new DeleteBucketWebsiteCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketWebsiteCommand({ Bucket: bucket })),
    ).rejects.toMatchObject({ name: "NoSuchWebsiteConfiguration" });
  });

  test("cors lifecycle: put, get, delete, NoSuchCORSConfiguration", async () => {
    const client = s3();

    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedMethods: ["GET", "PUT"],
              AllowedOrigins: ["https://example.com"],
              AllowedHeaders: ["Authorization"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );

    const got = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    expect((got.CORSRules ?? []).length).toBe(1);
    expect((got.CORSRules ?? [])[0]?.AllowedMethods).toEqual(["GET", "PUT"]);
    expect((got.CORSRules ?? [])[0]?.AllowedOrigins).toEqual([
      "https://example.com",
    ]);
    expect((got.CORSRules ?? [])[0]?.AllowedHeaders).toEqual(["Authorization"]);
    expect((got.CORSRules ?? [])[0]?.MaxAgeSeconds).toBe(3600);

    await client.send(new DeleteBucketCorsCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketCorsCommand({ Bucket: bucket })),
    ).rejects.toMatchObject({ name: "NoSuchCORSConfiguration" });

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });
});
