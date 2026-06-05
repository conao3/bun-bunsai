import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteBucketCorsCommand,
  DeleteBucketWebsiteCommand,
  GetBucketCorsCommand,
  GetBucketEncryptionCommand,
  GetBucketNotificationConfigurationCommand,
  GetBucketWebsiteCommand,
  PutBucketCorsCommand,
  PutBucketEncryptionCommand,
  PutBucketNotificationConfigurationCommand,
  PutBucketWebsiteCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 bucket config ops e2e", () => {
  const s3 = () =>
    new S3Client({ endpoint, region, credentials, forcePathStyle: true });
  const bucket = "bunsai-e2e-s3-config";

  test("cors lifecycle: put, get, delete", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedMethods: ["GET", "PUT"],
              AllowedOrigins: ["https://example.com"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3000,
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

    await client.send(new DeleteBucketCorsCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketCorsCommand({ Bucket: bucket })),
    ).rejects.toThrow();
  });

  test("website lifecycle: put, get, delete", async () => {
    const client = s3();

    await client.send(
      new PutBucketWebsiteCommand({
        Bucket: bucket,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: "index.html" },
          ErrorDocument: { Key: "error.html" },
        },
      }),
    );

    const got = await client.send(
      new GetBucketWebsiteCommand({ Bucket: bucket }),
    );
    expect(got.IndexDocument?.Suffix).toBe("index.html");
    expect(got.ErrorDocument?.Key).toBe("error.html");

    await client.send(new DeleteBucketWebsiteCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketWebsiteCommand({ Bucket: bucket })),
    ).rejects.toThrow();
  });

  test("encryption: put then get", async () => {
    const client = s3();

    await client.send(
      new PutBucketEncryptionCommand({
        Bucket: bucket,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
              BucketKeyEnabled: true,
            },
          ],
        },
      }),
    );

    const got = await client.send(
      new GetBucketEncryptionCommand({ Bucket: bucket }),
    );
    const rules = got.ServerSideEncryptionConfiguration?.Rules ?? [];
    expect(rules.length).toBe(1);
    expect(rules[0]?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm).toBe(
      "AES256",
    );
  });

  test("notification: put then get", async () => {
    const client = s3();

    await client.send(
      new PutBucketNotificationConfigurationCommand({
        Bucket: bucket,
        NotificationConfiguration: {
          TopicConfigurations: [
            {
              Id: "topic-1",
              TopicArn: "arn:aws:sns:us-east-1:000000000000:bunsai-topic",
              Events: ["s3:ObjectCreated:*"],
            },
          ],
        },
      }),
    );

    const got = await client.send(
      new GetBucketNotificationConfigurationCommand({ Bucket: bucket }),
    );
    expect((got.TopicConfigurations ?? []).length).toBe(1);
    expect((got.TopicConfigurations ?? [])[0]?.Id).toBe("topic-1");
    expect((got.TopicConfigurations ?? [])[0]?.Events).toEqual([
      "s3:ObjectCreated:*",
    ]);

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });
});
