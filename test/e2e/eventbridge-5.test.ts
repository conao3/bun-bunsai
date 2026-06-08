import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateEventBusCommand,
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

describe("Custom EventBus bus-scoped rule delivery", () => {
  test("PutEvents to custom bus delivers to bus-scoped rule, not default-bus rule", async () => {
    const eb = events();
    const q = sqs();
    const busName = "custom-scope-bus";

    await eb.send(new CreateEventBusCommand({ Name: busName }));

    await eb.send(
      new PutRuleCommand({
        Name: "custom-scope-rule",
        EventBusName: busName,
        EventPattern: JSON.stringify({ source: ["custom.scope"] }),
        State: "ENABLED",
      }),
    );

    const customQUrl = (
      await q.send(new CreateQueueCommand({ QueueName: "custom-scope-q" }))
    ).QueueUrl as string;
    const customQArn = await queueArnOf(q, customQUrl);

    await eb.send(
      new PutTargetsCommand({
        Rule: "custom-scope-rule",
        EventBusName: busName,
        Targets: [{ Id: "1", Arn: customQArn }],
      }),
    );

    const defaultQUrl = (
      await q.send(new CreateQueueCommand({ QueueName: "default-scope-q" }))
    ).QueueUrl as string;
    const defaultQArn = await queueArnOf(q, defaultQUrl);

    await eb.send(
      new PutRuleCommand({
        Name: "default-scope-rule",
        EventPattern: JSON.stringify({ source: ["custom.scope"] }),
        State: "ENABLED",
      }),
    );
    await eb.send(
      new PutTargetsCommand({
        Rule: "default-scope-rule",
        Targets: [{ Id: "1", Arn: defaultQArn }],
      }),
    );

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "custom.scope",
            DetailType: "CustomEvent",
            Detail: JSON.stringify({ value: 42 }),
            EventBusName: busName,
          },
        ],
      }),
    );

    const customGot = await q.send(
      new ReceiveMessageCommand({ QueueUrl: customQUrl }),
    );
    expect(customGot.Messages).toHaveLength(1);
    const customEvent = JSON.parse(customGot.Messages![0]!.Body!);
    expect(customEvent.source).toBe("custom.scope");
    expect(customEvent["detail-type"]).toBe("CustomEvent");
    expect(customEvent.detail.value).toBe(42);

    const defaultGot = await q.send(
      new ReceiveMessageCommand({ QueueUrl: defaultQUrl }),
    );
    expect(defaultGot.Messages ?? []).toHaveLength(0);
  });

  test("PutEvents to default bus does not deliver to custom-bus rule", async () => {
    const eb = events();
    const q = sqs();
    const busName = "custom-isolation-bus";

    await eb.send(new CreateEventBusCommand({ Name: busName }));

    await eb.send(
      new PutRuleCommand({
        Name: "custom-isolation-rule",
        EventBusName: busName,
        EventPattern: JSON.stringify({ source: ["isolation.source"] }),
        State: "ENABLED",
      }),
    );

    const customQUrl = (
      await q.send(new CreateQueueCommand({ QueueName: "custom-iso-q" }))
    ).QueueUrl as string;
    const customQArn = await queueArnOf(q, customQUrl);

    await eb.send(
      new PutTargetsCommand({
        Rule: "custom-isolation-rule",
        EventBusName: busName,
        Targets: [{ Id: "1", Arn: customQArn }],
      }),
    );

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "isolation.source",
            DetailType: "IsolationEvent",
            Detail: JSON.stringify({ value: 1 }),
          },
        ],
      }),
    );

    const got = await q.send(
      new ReceiveMessageCommand({ QueueUrl: customQUrl }),
    );
    expect(got.Messages ?? []).toHaveLength(0);
  });

  test("InputTransformer works on custom bus target", async () => {
    const eb = events();
    const q = sqs();
    const busName = "custom-transform-bus";

    await eb.send(new CreateEventBusCommand({ Name: busName }));

    await eb.send(
      new PutRuleCommand({
        Name: "custom-transform-rule",
        EventBusName: busName,
        EventPattern: JSON.stringify({ source: ["transform.source"] }),
        State: "ENABLED",
      }),
    );

    const qUrl = (
      await q.send(new CreateQueueCommand({ QueueName: "custom-transform-q" }))
    ).QueueUrl as string;
    const qArn = await queueArnOf(q, qUrl);

    await eb.send(
      new PutTargetsCommand({
        Rule: "custom-transform-rule",
        EventBusName: busName,
        Targets: [
          {
            Id: "1",
            Arn: qArn,
            InputTransformer: {
              InputPathsMap: { val: "$.detail.value" },
              InputTemplate: "transformed:<val>",
            },
          },
        ],
      }),
    );

    await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "transform.source",
            DetailType: "TransformEvent",
            Detail: JSON.stringify({ value: "hello" }),
            EventBusName: busName,
          },
        ],
      }),
    );

    const got = await q.send(new ReceiveMessageCommand({ QueueUrl: qUrl }));
    expect(got.Messages).toHaveLength(1);
    expect(got.Messages![0]!.Body).toBe("transformed:hello");
  });
});
