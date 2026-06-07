import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteBucketPolicyCommand,
  DeleteObjectCommand,
  DeleteObjectTaggingCommand,
  GetBucketAclCommand,
  PutBucketAclCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  GetObjectTaggingCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 ops e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-ops";

  test("bucket versioning put and get", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

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

    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  });

  test("bucket policy put, get, and delete", async () => {
    const client = s3();
    const policyBucket = "bunsai-e2e-s3-policy";
    await client.send(new CreateBucketCommand({ Bucket: policyBucket }));

    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AllowAll",
          Effect: "Allow",
          Principal: "*",
          Action: "s3:GetObject",
          Resource: `arn:aws:s3:::${policyBucket}/*`,
        },
      ],
    });

    await client.send(
      new PutBucketPolicyCommand({ Bucket: policyBucket, Policy: policy }),
    );

    const got = await client.send(
      new GetBucketPolicyCommand({ Bucket: policyBucket }),
    );
    expect(JSON.parse(got.Policy ?? "{}")).toEqual(JSON.parse(policy));

    await client.send(new DeleteBucketPolicyCommand({ Bucket: policyBucket }));

    await expect(
      client.send(new GetBucketPolicyCommand({ Bucket: policyBucket })),
    ).rejects.toThrow();

    await client.send(new DeleteBucketCommand({ Bucket: policyBucket }));
  });

  test("object tagging put, get, and delete", async () => {
    const client = s3();
    const tagBucket = "bunsai-e2e-s3-objtag";
    const key = "doc/file.txt";
    await client.send(new CreateBucketCommand({ Bucket: tagBucket }));
    await client.send(
      new PutObjectCommand({ Bucket: tagBucket, Key: key, Body: "data" }),
    );

    await client.send(
      new PutObjectTaggingCommand({
        Bucket: tagBucket,
        Key: key,
        Tagging: {
          TagSet: [
            { Key: "owner", Value: "bunsai" },
            { Key: "stage", Value: "test" },
          ],
        },
      }),
    );

    const tagging = await client.send(
      new GetObjectTaggingCommand({ Bucket: tagBucket, Key: key }),
    );
    const tags = (tagging.TagSet ?? []).reduce<Record<string, string>>(
      (acc, tag) => {
        if (tag.Key !== undefined && tag.Value !== undefined) {
          acc[tag.Key] = tag.Value;
        }
        return acc;
      },
      {},
    );
    expect(tags).toEqual({ owner: "bunsai", stage: "test" });

    await client.send(
      new DeleteObjectTaggingCommand({ Bucket: tagBucket, Key: key }),
    );

    const taggingAfter = await client.send(
      new GetObjectTaggingCommand({ Bucket: tagBucket, Key: key }),
    );
    expect(taggingAfter.TagSet ?? []).toEqual([]);

    await client.send(new DeleteObjectCommand({ Bucket: tagBucket, Key: key }));
    await client.send(new DeleteBucketCommand({ Bucket: tagBucket }));
  });

  test("bucket acl round-trip", async () => {
    const client = s3();
    const aclBucket = "bunsai-e2e-s3-acl";
    await client.send(new CreateBucketCommand({ Bucket: aclBucket }));

    const defaultAcl = await client.send(
      new GetBucketAclCommand({ Bucket: aclBucket }),
    );
    expect(defaultAcl.Owner?.ID).toBeDefined();
    expect((defaultAcl.Grants ?? []).length).toBe(1);
    expect(defaultAcl.Grants?.[0]?.Permission).toBe("FULL_CONTROL");

    await client.send(
      new PutBucketAclCommand({ Bucket: aclBucket, ACL: "public-read" }),
    );

    const publicAcl = await client.send(
      new GetBucketAclCommand({ Bucket: aclBucket }),
    );
    expect(publicAcl.Owner?.ID).toBeDefined();
    const grants = publicAcl.Grants ?? [];
    expect(grants.length).toBe(2);
    const allUsersGrant = grants.find(
      (g) =>
        g.Grantee?.URI === "http://acs.amazonaws.com/groups/global/AllUsers",
    );
    expect(allUsersGrant).toBeDefined();
    expect(allUsersGrant?.Permission).toBe("READ");

    const noSuchErr = await client
      .send(new GetBucketAclCommand({ Bucket: "bunsai-e2e-s3-no-such-bucket" }))
      .catch((e: unknown) => e);
    expect((noSuchErr as { name?: string }).name).toBe("NoSuchBucket");

    await client.send(new DeleteBucketCommand({ Bucket: aclBucket }));
  });

  test("bucket lifecycle configuration put and get", async () => {
    const client = s3();
    const lcBucket = "bunsai-e2e-s3-lifecycle";
    await client.send(new CreateBucketCommand({ Bucket: lcBucket }));

    await client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: lcBucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "expire-logs",
              Status: "Enabled",
              Filter: { Prefix: "logs/" },
              Expiration: { Days: 30 },
            },
          ],
        },
      }),
    );

    const lifecycle = await client.send(
      new GetBucketLifecycleConfigurationCommand({ Bucket: lcBucket }),
    );
    expect((lifecycle.Rules ?? []).length).toBe(1);
    expect(lifecycle.Rules?.[0]?.ID).toBe("expire-logs");
    expect(lifecycle.Rules?.[0]?.Status).toBe("Enabled");
    expect(lifecycle.Rules?.[0]?.Expiration?.Days).toBe(30);

    await client.send(new DeleteBucketCommand({ Bucket: lcBucket }));
  });
});
