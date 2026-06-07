import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
import { makeZip, markerHandler } from "./event-helpers.ts";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  EventBridgeClient,
  PutEventsCommand,
  PutRuleCommand,
  PutTargetsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const events = () =>
  new EventBridgeClient({ endpoint, region, credentials, requestHandler });
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

describe("EventBridge PutEvents delivery", () => {
  test("delivers matching events to SQS and Lambda targets", async () => {
    const eb = events();
    const q = sqs();
    const l = lambda();
    const marker = join(mkdtempSync(join(tmpdir(), "bunsai-eb-")), "out.json");
    const url = (await q.send(new CreateQueueCommand({ QueueName: "eb-q" })))
      .QueueUrl as string;
    const fn = await l.send(
      new CreateFunctionCommand({
        FunctionName: "eb-fn",
        Runtime: "nodejs20.x",
        Role: "arn:aws:iam::000000000000:role/r",
        Handler: "index.handler",
        Code: { ZipFile: makeZip({ "index.js": markerHandler }) },
        Environment: { Variables: { MARKER_PATH: marker } },
      }),
    );

    await eb.send(
      new PutRuleCommand({
        Name: "order-rule",
        EventPattern: JSON.stringify({
          source: ["my.orders"],
          "detail-type": ["OrderPlaced"],
        }),
      }),
    );
    await eb.send(
      new PutTargetsCommand({
        Rule: "order-rule",
        Targets: [
          { Id: "1", Arn: await queueArnOf(q, url) },
          { Id: "2", Arn: fn.FunctionArn },
        ],
      }),
    );

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "my.orders",
            DetailType: "OrderPlaced",
            Detail: JSON.stringify({ orderId: "o-1", total: 42 }),
          },
        ],
      }),
    );

    const got = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(got.Messages).toHaveLength(1);
    const event = JSON.parse(got.Messages![0]!.Body!);
    expect(event.source).toBe("my.orders");
    expect(event["detail-type"]).toBe("OrderPlaced");
    expect(event.detail.orderId).toBe("o-1");

    const lambdaEvent = JSON.parse(readFileSync(marker, "utf8").trim());
    expect(lambdaEvent.detail.total).toBe(42);
  });

  test("does not deliver events that do not match the pattern", async () => {
    const eb = events();
    const q = sqs();
    const url = (await q.send(new CreateQueueCommand({ QueueName: "eb-q2" })))
      .QueueUrl as string;
    await eb.send(
      new PutRuleCommand({
        Name: "strict-rule",
        EventPattern: JSON.stringify({ source: ["only.this"] }),
      }),
    );
    await eb.send(
      new PutTargetsCommand({
        Rule: "strict-rule",
        Targets: [{ Id: "1", Arn: await queueArnOf(q, url) }],
      }),
    );
    await eb.send(
      new PutEventsCommand({
        Entries: [{ Source: "other.source", DetailType: "X", Detail: "{}" }],
      }),
    );
    expect(
      (await q.send(new ReceiveMessageCommand({ QueueUrl: url }))).Messages ??
        [],
    ).toHaveLength(0);
  });
});
