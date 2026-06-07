import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  CreateTopicCommand,
  PublishCommand,
  SNSClient,
  SubscribeCommand,
} from "@aws-sdk/client-sns";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const sns = () =>
  new SNSClient({ endpoint, region, credentials, requestHandler });
const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

describe("SNS Publish to Lambda subscriptions", () => {
  test("invokes a subscribed Lambda with the SNS event shape", async () => {
    const s = sns();
    const l = lambda();
    const marker = join(
      mkdtempSync(join(tmpdir(), "bunsai-snsl-")),
      "out.json",
    );
    const topic = await s.send(
      new CreateTopicCommand({ Name: "lambda-topic" }),
    );
    const fn = await l.send(
      new CreateFunctionCommand({
        FunctionName: "sns-lambda-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );
    await s.send(
      new SubscribeCommand({
        TopicArn: topic.TopicArn,
        Protocol: "lambda",
        Endpoint: fn.FunctionArn,
      }),
    );
    await s.send(
      new PublishCommand({
        TopicArn: topic.TopicArn,
        Subject: "greeting",
        Message: "to-lambda",
      }),
    );
    const event = JSON.parse(readFileSync(marker, "utf8").trim());
    expect(event.Records[0].EventSource).toBe("aws:sns");
    expect(event.Records[0].Sns.Message).toBe("to-lambda");
    expect(event.Records[0].Sns.Subject).toBe("greeting");
  });
});
