import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new S3Client({
  endpoint,
  region: "us-east-1",
  credentials,
  requestHandler,
  forcePathStyle: true,
});

test("CreateBucket rejects LocationConstraint us-east-1 with InvalidLocationConstraint", async () => {
  expect(
    client.send(
      new CreateBucketCommand({
        Bucket: "loc-invalid",
        CreateBucketConfiguration: {
          LocationConstraint:
            "us-east-1" as unknown as import("@aws-sdk/client-s3").BucketLocationConstraint,
        },
      }),
    ),
  ).rejects.toMatchObject({
    name: "InvalidLocationConstraint",
    $metadata: { httpStatusCode: 400 },
  });
});
