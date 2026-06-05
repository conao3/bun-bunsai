import { expect, test } from "bun:test";
import { startServer } from "./e2e/harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  DeleteQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

const { endpoint, uiEndpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sts = () => new STSClient({ endpoint, region, credentials });
const s3 = () =>
  new S3Client({ endpoint, region, credentials, forcePathStyle: true });
const sqs = () => new SQSClient({ endpoint, region, credentials });

test("STS GetCallerIdentity returns an Account", async () => {
  const client = sts();
  const out = await client.send(new GetCallerIdentityCommand({}));
  expect(out.Account).toBeDefined();
  expect(typeof out.Account).toBe("string");
  expect((out.Account ?? "").length).toBeGreaterThan(0);
});

test("S3 bucket and object lifecycle", async () => {
  const client = s3();
  const bucket = "bunsai-e2e-bucket";
  const key = "folder/object.txt";
  const payload = "hello bunsai e2e";

  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: payload }),
  );

  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const text = await got.Body?.transformToString();
  expect(text).toBe(payload);

  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: bucket }),
  );
  const keys = (listed.Contents ?? []).map((c) => c.Key);
  expect(keys).toContain(key);

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  await client.send(new DeleteBucketCommand({ Bucket: bucket }));
});

test("SQS queue and message lifecycle", async () => {
  const client = sqs();
  const body = "bunsai-e2e-message";

  const created = await client.send(
    new CreateQueueCommand({ QueueName: "bunsai-e2e-queue" }),
  );
  const queueUrl = created.QueueUrl;
  expect(queueUrl).toBeDefined();

  await client.send(
    new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: body }),
  );

  const received = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 0,
    }),
  );
  const message = (received.Messages ?? [])[0];
  expect(message).toBeDefined();
  expect(message?.Body).toBe(body);

  await client.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message?.ReceiptHandle,
    }),
  );
  await client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }));
});

test("management logs recorded the SDK calls", async () => {
  const res = await fetch(`${uiEndpoint}/__bunsai/logs`);
  expect(res.ok).toBe(true);
  const logs = (await res.json()) as { service: string; operation: string }[];
  const seen = new Set(logs.map((l) => `${l.service}:${l.operation}`));
  const expected = [
    "sts:GetCallerIdentity",
    "s3:CreateBucket",
    "s3:PutObject",
    "s3:GetObject",
    "s3:ListObjectsV2",
    "s3:DeleteObject",
    "s3:DeleteBucket",
    "sqs:CreateQueue",
    "sqs:SendMessage",
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:DeleteQueue",
  ] as const;
  for (const entry of expected) {
    expect(seen.has(entry)).toBe(true);
  }
});
