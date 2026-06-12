import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketEncryptionCommand,
  DeleteBucketOwnershipControlsCommand,
  GetBucketAbacCommand,
  GetBucketEncryptionCommand,
  GetBucketOwnershipControlsCommand,
  GetBucketPolicyStatusCommand,
  PutBucketAbacCommand,
  PutBucketEncryptionCommand,
  PutBucketOwnershipControlsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 ownership / abac / policy-status / delete-encryption e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-ownership-abac";

  test("ownershipControls: put, get, delete", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutBucketOwnershipControlsCommand({
        Bucket: bucket,
        OwnershipControls: {
          Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }],
        },
      }),
    );

    const getResult = await client.send(
      new GetBucketOwnershipControlsCommand({ Bucket: bucket }),
    );
    expect(getResult.OwnershipControls?.Rules?.[0]?.ObjectOwnership).toBe(
      "BucketOwnerEnforced",
    );

    await client.send(
      new DeleteBucketOwnershipControlsCommand({ Bucket: bucket }),
    );

    await expect(
      client.send(new GetBucketOwnershipControlsCommand({ Bucket: bucket })),
    ).rejects.toThrow();
  });

  test("abac: put, get", async () => {
    const client = s3();

    await client.send(
      new PutBucketAbacCommand({
        Bucket: bucket,
        AbacStatus: { Status: "Enabled" },
      }),
    );

    const result = await client.send(
      new GetBucketAbacCommand({ Bucket: bucket }),
    );
    expect(result.AbacStatus?.Status).toBe("Enabled");
  });

  test("policyStatus: get", async () => {
    const client = s3();

    const result = await client.send(
      new GetBucketPolicyStatusCommand({ Bucket: bucket }),
    );
    expect(typeof result.PolicyStatus?.IsPublic).toBe("boolean");
  });

  test("deleteBucketEncryption: put, delete, get throws", async () => {
    const client = s3();

    await client.send(
      new PutBucketEncryptionCommand({
        Bucket: bucket,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: "AES256",
              },
            },
          ],
        },
      }),
    );

    const before = await client.send(
      new GetBucketEncryptionCommand({ Bucket: bucket }),
    );
    expect(
      before.ServerSideEncryptionConfiguration?.Rules?.length,
    ).toBeGreaterThan(0);

    await client.send(new DeleteBucketEncryptionCommand({ Bucket: bucket }));

    await expect(
      client.send(new GetBucketEncryptionCommand({ Bucket: bucket })),
    ).rejects.toThrow();
  });
});
