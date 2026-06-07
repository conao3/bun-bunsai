import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
import {
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";
import {
  CreateBucketCommand,
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
import {
  CreateTableCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

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
const ddb = () =>
  new DynamoDBClient({ endpoint, region, credentials, requestHandler });

const queueArnOf = async (q: SQSClient, url: string): Promise<string> => {
  const attrs = await q.send(
    new GetQueueAttributesCommand({
      QueueUrl: url,
      AttributeNames: ["QueueArn"],
    }),
  );
  return attrs.Attributes?.QueueArn as string;
};

describe("cross-service event scenarios", () => {
  test("S3 upload notifies SQS, a worker drains it and records to DynamoDB", async () => {
    const c = s3();
    const q = sqs();
    const d = ddb();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "ingest-q" }))
    ).QueueUrl as string;
    await d.send(
      new CreateTableCommand({
        TableName: "uploads",
        AttributeDefinitions: [{ AttributeName: "key", AttributeType: "S" }],
        KeySchema: [{ AttributeName: "key", KeyType: "HASH" }],
        BillingMode: "PAY_PER_REQUEST",
      }),
    );
    await c.send(new CreateBucketCommand({ Bucket: "ingest-bucket" }));
    await c.send(
      new PutBucketNotificationConfigurationCommand({
        Bucket: "ingest-bucket",
        NotificationConfiguration: {
          QueueConfigurations: [
            {
              QueueArn: await queueArnOf(q, url),
              Events: ["s3:ObjectCreated:*"],
            },
          ],
        },
      }),
    );

    await c.send(
      new PutObjectCommand({
        Bucket: "ingest-bucket",
        Key: "incoming/report.csv",
        Body: "a,b,c",
      }),
    );

    const received = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(received.Messages).toHaveLength(1);
    const event = JSON.parse(received.Messages![0]!.Body!);
    const objectKey = event.Records[0].s3.object.key;
    expect(objectKey).toBe("incoming/report.csv");

    await d.send(
      new PutItemCommand({
        TableName: "uploads",
        Item: {
          key: { S: objectKey },
          bucket: { S: event.Records[0].s3.bucket.name },
          status: { S: "processed" },
        },
      }),
    );
    const stored = await d.send(
      new GetItemCommand({
        TableName: "uploads",
        Key: { key: { S: "incoming/report.csv" } },
      }),
    );
    expect(stored.Item?.status?.S).toBe("processed");
  });

  test("S3 upload flows through SQS into a Lambda event source mapping", async () => {
    const c = s3();
    const q = sqs();
    const l = lambda();
    const marker = join(
      mkdtempSync(join(tmpdir(), "bunsai-chain-")),
      "out.json",
    );
    const url = (await q.send(new CreateQueueCommand({ QueueName: "chain-q" })))
      .QueueUrl as string;
    const queueArn = await queueArnOf(q, url);
    await l.send(
      new CreateFunctionCommand({
        FunctionName: "chain-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );
    await l.send(
      new CreateEventSourceMappingCommand({
        FunctionName: "chain-fn",
        EventSourceArn: queueArn,
        Enabled: true,
      }),
    );
    await c.send(new CreateBucketCommand({ Bucket: "chain-bucket" }));
    await c.send(
      new PutBucketNotificationConfigurationCommand({
        Bucket: "chain-bucket",
        NotificationConfiguration: {
          QueueConfigurations: [
            { QueueArn: queueArn, Events: ["s3:ObjectCreated:*"] },
          ],
        },
      }),
    );

    await c.send(
      new PutObjectCommand({
        Bucket: "chain-bucket",
        Key: "drop/file.bin",
        Body: "payload",
      }),
    );

    const sqsEvent = JSON.parse(readFileSync(marker, "utf8").trim());
    const s3Event = JSON.parse(sqsEvent.Records[0].body);
    expect(s3Event.Records[0].s3.object.key).toBe("drop/file.bin");
    expect(
      (await q.send(new ReceiveMessageCommand({ QueueUrl: url }))).Messages ??
        [],
    ).toHaveLength(0);
  });
});
