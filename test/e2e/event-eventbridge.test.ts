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

describe("EventBridge detail-content pattern matching", () => {
  test("delivers matching events with detail-only pattern and skips non-matching", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "detail-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await eb.send(
      new PutRuleCommand({
        Name: "detail-rule",
        EventPattern: JSON.stringify({ detail: { status: ["completed"] } }),
      }),
    );
    await eb.send(
      new PutTargetsCommand({
        Rule: "detail-rule",
        Targets: [{ Id: "1", Arn: queueArn }],
      }),
    );

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "any.source",
            DetailType: "AnyType",
            Detail: JSON.stringify({ status: "completed", id: "e1" }),
          },
        ],
      }),
    );
    const got = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(got.Messages).toHaveLength(1);
    const delivered = JSON.parse(got.Messages![0]!.Body!);
    expect(delivered.detail.status).toBe("completed");
    expect(delivered.detail.id).toBe("e1");

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "any.source",
            DetailType: "AnyType",
            Detail: JSON.stringify({ status: "pending", id: "e2" }),
          },
        ],
      }),
    );
    const got2 = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(got2.Messages ?? []).toHaveLength(0);
  });

  test("prefix operator delivers matching and skips non-matching", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "prefix-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await eb.send(
      new PutRuleCommand({
        Name: "prefix-rule",
        EventPattern: JSON.stringify({
          detail: { code: [{ prefix: "200" }] },
        }),
      }),
    );
    await eb.send(
      new PutTargetsCommand({
        Rule: "prefix-rule",
        Targets: [{ Id: "1", Arn: queueArn }],
      }),
    );

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "svc",
            DetailType: "T",
            Detail: JSON.stringify({ code: "200-OK" }),
          },
        ],
      }),
    );
    const got = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(got.Messages).toHaveLength(1);
    const delivered = JSON.parse(got.Messages![0]!.Body!);
    expect(delivered.detail.code).toBe("200-OK");

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "svc",
            DetailType: "T",
            Detail: JSON.stringify({ code: "404-Not Found" }),
          },
        ],
      }),
    );
    const got2 = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(got2.Messages ?? []).toHaveLength(0);
  });
});
