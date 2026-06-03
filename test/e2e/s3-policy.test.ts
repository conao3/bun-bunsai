import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4575;
const uiPort = 5675;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("S3 bucket policy/access ops e2e", () => {
  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

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
