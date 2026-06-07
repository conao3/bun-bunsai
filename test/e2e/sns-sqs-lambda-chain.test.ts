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
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  CreateTopicCommand,
  PublishCommand,
  SetSubscriptionAttributesCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });
const sqs = () =>
  new SQSClient({ endpoint, region, credentials, requestHandler });
const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });

describe("SNS to SQS to Lambda chain", () => {
  test("publishing to a topic triggers the queue's event source mapping", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunsai-sns-esm-"));
    const marker = join(dir, "out.json");

    const created = await sqs().send(
      new CreateQueueCommand({ QueueName: "sns-esm-queue" }),
    );
    const queueUrl = created.QueueUrl as string;
    const attrs = await sqs().send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ["QueueArn"],
      }),
    );
    const queueArn = attrs.Attributes?.QueueArn as string;

    await lambda().send(
      new CreateFunctionCommand({
        FunctionName: "sns-esm-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );
    await lambda().send(
      new CreateEventSourceMappingCommand({
        FunctionName: "sns-esm-fn",
        EventSourceArn: queueArn,
        Enabled: true,
      }),
    );

    const topic = await sns().send(
      new CreateTopicCommand({ Name: "sns-esm-topic" }),
    );
    const topicArn = topic.TopicArn as string;
    const sub = await sns().send(
      new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: "sqs",
        Endpoint: queueArn,
      }),
    );
    await sns().send(
      new SetSubscriptionAttributesCommand({
        SubscriptionArn: sub.SubscriptionArn ?? "",
        AttributeName: "RawMessageDelivery",
        AttributeValue: "true",
      }),
    );

    await sns().send(
      new PublishCommand({ TopicArn: topicArn, Message: "chain-payload" }),
    );

    const event = JSON.parse(readFileSync(marker, "utf8"));
    expect(event.Records).toHaveLength(1);
    expect(event.Records[0].eventSource).toBe("aws:sqs");
    expect(event.Records[0].eventSourceARN).toBe(queueArn);
    expect(event.Records[0].body).toBe("chain-payload");
  });
});
