import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  PutBucketNotificationConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateTopicCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";
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
const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });

describe("S3 -> SNS -> SQS fan-out", () => {
  test("an S3 upload notifies a topic that fans out to a subscribed queue", async () => {
    const c = s3();
    const t = sns();
    const q = sqs();

    const queueUrl = (
      await q.send(new CreateQueueCommand({ QueueName: "s3-sns-q" }))
    ).QueueUrl as string;
    const queueArn = (
      await q.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ["QueueArn"],
        }),
      )
    ).Attributes?.QueueArn as string;

    const topicArn = (
      await t.send(new CreateTopicCommand({ Name: "s3-events-topic" }))
    ).TopicArn as string;
    await t.send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "sqs",
        Endpoint: queueArn,
      }),
    );

    await c.send(new CreateBucketCommand({ Bucket: "s3-sns-bucket" }));
    await c.send(
      new PutBucketNotificationConfigurationCommand({
        Bucket: "s3-sns-bucket",
        NotificationConfiguration: {
          TopicConfigurations: [
            { TopicArn: topicArn, Events: ["s3:ObjectCreated:*"] },
          ],
        },
      }),
    );

    await c.send(
      new PutObjectCommand({
        Bucket: "s3-sns-bucket",
        Key: "uploads/photo.jpg",
        Body: "bytes",
      }),
    );

    const received = await q.send(
      new ReceiveMessageCommand({ QueueUrl: queueUrl, WaitTimeSeconds: 1 }),
    );
    expect(received.Messages).toHaveLength(1);
    const envelope = JSON.parse(received.Messages![0]!.Body!);
    expect(envelope.Type).toBe("Notification");
    expect(envelope.TopicArn).toBe(topicArn);
    const s3Event = JSON.parse(envelope.Message);
    expect(s3Event.Records[0].s3.object.key).toBe("uploads/photo.jpg");
    expect(s3Event.Records[0].s3.bucket.name).toBe("s3-sns-bucket");
  });
});
