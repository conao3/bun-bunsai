import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const queueArnOf = async (q: SQSClient, url: string): Promise<string> => {
  const attrs = await q.send(
    new GetQueueAttributesCommand({
      QueueUrl: url,
      AttributeNames: ["QueueArn"],
    }),
  );
  return attrs.Attributes?.QueueArn as string;
};

const putRuleAndTarget = async (
  eb: EventBridgeClient,
  ruleName: string,
  queueArn: string,
  targetExtra: Record<string, unknown> = {},
): Promise<void> => {
  await eb.send(
    new PutRuleCommand({
      Name: ruleName,
      EventPattern: JSON.stringify({ source: ["test.source"] }),
    }),
  );
  await eb.send(
    new PutTargetsCommand({
      Rule: ruleName,
      Targets: [{ Id: "1", Arn: queueArn, ...targetExtra }],
    }),
  );
};

const putEvent = async (
  eb: EventBridgeClient,
  detail: unknown,
): Promise<void> => {
  await eb.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "test.source",
          DetailType: "TestEvent",
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
};

const receiveBody = async (
  q: SQSClient,
  url: string,
): Promise<string | undefined> => {
  const got = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
  return got.Messages?.[0]?.Body;
};

describe("EventBridge target Input transformation", () => {
  test("constant Input: queue receives exactly the Input string", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "input-const-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await putRuleAndTarget(eb, "input-const-rule", queueArn, {
      Input: '{"constant":"payload","value":99}',
    });

    await putEvent(eb, { orderId: "o-1", status: "placed" });

    const body = await receiveBody(q, url);
    expect(body).toBeDefined();
    const parsed = JSON.parse(body!);
    expect(parsed).toEqual({ constant: "payload", value: 99 });
  });

  test("InputPath $.detail: queue receives just the detail subtree", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "inputpath-detail-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await putRuleAndTarget(eb, "inputpath-detail-rule", queueArn, {
      InputPath: "$.detail",
    });

    await putEvent(eb, { orderId: "o-2", status: "shipped", total: 55 });

    const body = await receiveBody(q, url);
    expect(body).toBeDefined();
    const parsed = JSON.parse(body!);
    expect(parsed).toEqual({ orderId: "o-2", status: "shipped", total: 55 });
    expect(parsed.source).toBeUndefined();
    expect(parsed.version).toBeUndefined();
  });

  test("InputPath $.detail.status: queue receives nested scalar", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "inputpath-nested-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await putRuleAndTarget(eb, "inputpath-nested-rule", queueArn, {
      InputPath: "$.detail.status",
    });

    await putEvent(eb, { status: "completed" });

    const body = await receiveBody(q, url);
    expect(body).toBeDefined();
    expect(JSON.parse(body!)).toBe("completed");
  });

  test("InputTransformer: queue receives rendered template", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "transformer-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await putRuleAndTarget(eb, "transformer-rule", queueArn, {
      InputTransformer: {
        InputPathsMap: {
          orderId: "$.detail.orderId",
          status: "$.detail.status",
        },
        InputTemplate: "Order <orderId> is now <status>",
      },
    });

    await putEvent(eb, { orderId: "o-3", status: "delivered" });

    const body = await receiveBody(q, url);
    expect(body).toBe("Order o-3 is now delivered");
  });

  test("no transformation: queue receives full event envelope", async () => {
    const eb = events();
    const q = sqs();
    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "no-transform-q" }))
    ).QueueUrl as string;
    const queueArn = await queueArnOf(q, url);

    await putRuleAndTarget(eb, "no-transform-rule", queueArn);

    await putEvent(eb, { orderId: "o-4", amount: 100 });

    const body = await receiveBody(q, url);
    expect(body).toBeDefined();
    const parsed = JSON.parse(body!);
    expect(parsed.source).toBe("test.source");
    expect(parsed["detail-type"]).toBe("TestEvent");
    expect(parsed.detail.orderId).toBe("o-4");
    expect(parsed.detail.amount).toBe(100);
    expect(parsed.version).toBe("0");
  });
});
