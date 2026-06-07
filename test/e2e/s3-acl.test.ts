import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  GetObjectAclCommand,
  PutObjectAclCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 object ACL ops e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-acl";

  test("setup: create bucket", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  });

  test("default ACL: owner FULL_CONTROL only", async () => {
    const client = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj-default",
        Body: new Uint8Array([1, 2, 3]),
      }),
    );

    const got = await client.send(
      new GetObjectAclCommand({ Bucket: bucket, Key: "obj-default" }),
    );
    expect(got.Owner?.ID).toBe("bunsai");
    expect((got.Grants ?? []).length).toBe(1);
    expect((got.Grants ?? [])[0]?.Permission).toBe("FULL_CONTROL");
    expect((got.Grants ?? [])[0]?.Grantee?.ID).toBe("bunsai");
  });

  test("PutObject with ACL=public-read: AllUsers READ grant present", async () => {
    const client = s3();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "obj-public",
        Body: new Uint8Array([4, 5, 6]),
        ACL: "public-read",
      }),
    );

    const got = await client.send(
      new GetObjectAclCommand({ Bucket: bucket, Key: "obj-public" }),
    );
    expect(got.Owner?.ID).toBe("bunsai");
    const grants = got.Grants ?? [];
    expect(grants.length).toBe(2);
    const fullCtrl = grants.find((g) => g.Permission === "FULL_CONTROL");
    expect(fullCtrl?.Grantee?.ID).toBe("bunsai");
    const readGrant = grants.find((g) => g.Permission === "READ");
    expect(readGrant?.Grantee?.URI).toBe(
      "http://acs.amazonaws.com/groups/global/AllUsers",
    );
  });

  test("PutObjectAcl private: reverts to owner FULL_CONTROL only", async () => {
    const client = s3();
    await client.send(
      new PutObjectAclCommand({
        Bucket: bucket,
        Key: "obj-public",
        ACL: "private",
      }),
    );

    const got = await client.send(
      new GetObjectAclCommand({ Bucket: bucket, Key: "obj-public" }),
    );
    const grants = got.Grants ?? [];
    expect(grants.length).toBe(1);
    expect(grants[0]?.Permission).toBe("FULL_CONTROL");
    expect(grants[0]?.Grantee?.ID).toBe("bunsai");
  });

  test("GetObjectAcl on missing key: NoSuchKey error", async () => {
    const client = s3();
    await expect(
      client.send(
        new GetObjectAclCommand({ Bucket: bucket, Key: "nonexistent-key" }),
      ),
    ).rejects.toThrow();
  });

  test("PutObjectAcl on missing key: NoSuchKey error", async () => {
    const client = s3();
    await expect(
      client.send(
        new PutObjectAclCommand({
          Bucket: bucket,
          Key: "nonexistent-key",
          ACL: "private",
        }),
      ),
    ).rejects.toThrow();
  });
});
