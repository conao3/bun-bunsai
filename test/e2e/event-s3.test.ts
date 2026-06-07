import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  PutBucketNotificationConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const s3 = () =>
  new S3Client({
    endpoint,
    region,
    credentials,
    requestHandler,
    forcePathStyle: true,
  });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });
const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const queueArnOf = async (q: SQSClient, url: string): Promise<string> => {
  const attrs = await q.send(
    new GetQueueAttributesCommand({
      QueueUrl: url,
      AttributeNames: ["QueueArn"],
    }),
  );
  return attrs.Attributes?.QueueArn as string;
};

describe("S3 event notifications", () => {
  test("delivers ObjectCreated to a queue, honoring the prefix filter", async () => {
    const c = s3();
    const q = sqs();
    const url = (await q.send(new CreateQueueCommand({ QueueName: "s3-q" })))
      .QueueUrl as string;
    await c.send(new CreateBucketCommand({ Bucket: "notify-bucket" }));
    await c.send(
      new PutBucketNotificationConfigurationCommand({
        Bucket: "notify-bucket",
        NotificationConfiguration: {
          QueueConfigurations: [
            {
              QueueArn: await queueArnOf(q, url),
              Events: ["s3:ObjectCreated:*"],
              Filter: {
                Key: { FilterRules: [{ Name: "prefix", Value: "uploads/" }] },
              },
            },
          ],
        },
      }),
    );

    await c.send(
      new PutObjectCommand({
        Bucket: "notify-bucket",
        Key: "ignored/skip.txt",
        Body: "x",
      }),
    );
    expect(
      (await q.send(new ReceiveMessageCommand({ QueueUrl: url }))).Messages ??
        [],
    ).toHaveLength(0);

    await c.send(
      new PutObjectCommand({
        Bucket: "notify-bucket",
        Key: "uploads/photo.png",
        Body: "imagedata",
      }),
    );
    const got = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(got.Messages).toHaveLength(1);
    const event = JSON.parse(got.Messages![0]!.Body!);
    expect(event.Records[0].eventSource).toBe("aws:s3");
    expect(event.Records[0].eventName).toBe("ObjectCreated:Put");
    expect(event.Records[0].s3.bucket.name).toBe("notify-bucket");
    expect(event.Records[0].s3.object.key).toBe("uploads/photo.png");
  });

  test("delivers ObjectRemoved to a Lambda function", async () => {
    const c = s3();
    const l = lambda();
    const marker = join(mkdtempSync(join(tmpdir(), "bunsai-s3l-")), "out.json");
    const fn = await l.send(
      new CreateFunctionCommand({
        FunctionName: "s3-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );
    await c.send(new CreateBucketCommand({ Bucket: "del-bucket" }));
    await c.send(
      new PutObjectCommand({ Bucket: "del-bucket", Key: "a.txt", Body: "a" }),
    );
    await c.send(
      new PutBucketNotificationConfigurationCommand({
        Bucket: "del-bucket",
        NotificationConfiguration: {
          LambdaFunctionConfigurations: [
            {
              LambdaFunctionArn: fn.FunctionArn,
              Events: ["s3:ObjectRemoved:*"],
            },
          ],
        },
      }),
    );
    await c.send(
      new DeleteObjectCommand({ Bucket: "del-bucket", Key: "a.txt" }),
    );
    const event = JSON.parse(readFileSync(marker, "utf8").trim());
    expect(event.Records[0].eventName).toBe("ObjectRemoved:Delete");
    expect(event.Records[0].s3.object.key).toBe("a.txt");
  });
});
