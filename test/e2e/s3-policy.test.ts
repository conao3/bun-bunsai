import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeletePublicAccessBlockCommand,
  GetBucketAccelerateConfigurationCommand,
  GetBucketLoggingCommand,
  GetObjectLockConfigurationCommand,
  GetPublicAccessBlockCommand,
  PutBucketAccelerateConfigurationCommand,
  PutBucketLoggingCommand,
  PutObjectLockConfigurationCommand,
  PutPublicAccessBlockCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 bucket policy/access ops e2e", () => {
  const s3 = () =>
    new S3Client({ endpoint, region, credentials, forcePathStyle: true });
  const bucket = "bunsai-e2e-s3-policy";

  test("public access block lifecycle: put, get, delete", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }),
    );

    const got = await client.send(
      new GetPublicAccessBlockCommand({ Bucket: bucket }),
    );
    expect(got.PublicAccessBlockConfiguration?.BlockPublicAcls).toBe(true);
    expect(got.PublicAccessBlockConfiguration?.RestrictPublicBuckets).toBe(
      true,
    );

    await client.send(new DeletePublicAccessBlockCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetPublicAccessBlockCommand({ Bucket: bucket })),
    ).rejects.toThrow();
  });

  test("logging: put then get", async () => {
    const client = s3();

    await client.send(
      new PutBucketLoggingCommand({
        Bucket: bucket,
        BucketLoggingStatus: {
          LoggingEnabled: {
            TargetBucket: bucket,
            TargetPrefix: "logs/",
          },
        },
      }),
    );

    const got = await client.send(
      new GetBucketLoggingCommand({ Bucket: bucket }),
    );
    expect(got.LoggingEnabled?.TargetBucket).toBe(bucket);
    expect(got.LoggingEnabled?.TargetPrefix).toBe("logs/");
  });

  test("accelerate configuration: put then get", async () => {
    const client = s3();

    await client.send(
      new PutBucketAccelerateConfigurationCommand({
        Bucket: bucket,
        AccelerateConfiguration: { Status: "Enabled" },
      }),
    );

    const got = await client.send(
      new GetBucketAccelerateConfigurationCommand({ Bucket: bucket }),
    );
    expect(got.Status).toBe("Enabled");
  });

  test("object lock configuration: put then get", async () => {
    const client = s3();

    await client.send(
      new PutObjectLockConfigurationCommand({
        Bucket: bucket,
        ObjectLockConfiguration: {
          ObjectLockEnabled: "Enabled",
          Rule: {
            DefaultRetention: { Mode: "GOVERNANCE", Days: 30 },
          },
        },
      }),
    );

    const got = await client.send(
      new GetObjectLockConfigurationCommand({ Bucket: bucket }),
    );
    expect(got.ObjectLockConfiguration?.ObjectLockEnabled).toBe("Enabled");
    expect(got.ObjectLockConfiguration?.Rule?.DefaultRetention?.Mode).toBe(
      "GOVERNANCE",
    );

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });
});
