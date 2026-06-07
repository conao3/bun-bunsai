import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler, gwFetch } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const authHeader = `AWS4-HMAC-SHA256 Credential=test/20260607/${region}/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=fakesig`;

test("$headers surfaces in HTTP response via rest-xml handler", async () => {
  const s3 = new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });
  const bucket = "test-core-unmodeled-headers";
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));

  const sdkResult = await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  expect(sdkResult.BucketRegion).toBe(region);

  const rawRes = await gwFetch(`http://bunsai.test/${bucket}`, {
    method: "HEAD",
    headers: { host: "bunsai.test", authorization: authHeader },
  });
  expect(rawRes.status).toBe(200);
  expect(rawRes.headers.get("x-amz-bucket-region")).toBe(region);

  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
});

test("$headers key is stripped from response body", async () => {
  const s3 = new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });
  const bucket = "test-core-unmodeled-headers-body";
  await s3.send(new CreateBucketCommand({ Bucket: bucket }));

  const rawRes = await gwFetch(`http://bunsai.test/${bucket}`, {
    method: "HEAD",
    headers: { host: "bunsai.test", authorization: authHeader },
  });
  const body = await rawRes.text();
  expect(body).not.toContain("$headers");

  await s3.send(new DeleteBucketCommand({ Bucket: bucket }));
});
