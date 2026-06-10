import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateEventBusCommand,
  EventBridgeClient,
  PutEventsCommand,
  PutRuleCommand,
  PutTargetsCommand,
  TestEventPatternCommand,
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

const eb = () =>
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

describe("EventBridge pattern routing — detail field matching", () => {
  test("detail exact match and numeric: rule A (status=RUNNING) and rule B (severity>5) route independently", async () => {
    const client = eb();
    const q = sqs();
    const busName = "pattern-bus";

    await client.send(new CreateEventBusCommand({ Name: busName }));

    const urlA = (
      await q.send(new CreateQueueCommand({ QueueName: "pattern-q-a" }))
    ).QueueUrl as string;
    const urlB = (
      await q.send(new CreateQueueCommand({ QueueName: "pattern-q-b" }))
    ).QueueUrl as string;
    const arnA = await queueArnOf(q, urlA);
    const arnB = await queueArnOf(q, urlB);

    await client.send(
      new PutRuleCommand({
        Name: "rule-a",
        EventBusName: busName,
        EventPattern: JSON.stringify({
          source: ["myapp.jobs"],
          "detail-type": ["JobStateChange"],
          detail: { status: ["RUNNING"] },
        }),
      }),
    );
    await client.send(
      new PutTargetsCommand({
        Rule: "rule-a",
        EventBusName: busName,
        Targets: [{ Id: "a1", Arn: arnA }],
      }),
    );

    await client.send(
      new PutRuleCommand({
        Name: "rule-b",
        EventBusName: busName,
        EventPattern: JSON.stringify({
          detail: { severity: [{ numeric: [">", 5] }] },
        }),
      }),
    );
    await client.send(
      new PutTargetsCommand({
        Rule: "rule-b",
        EventBusName: busName,
        Targets: [{ Id: "b1", Arn: arnB }],
      }),
    );

    await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: "myapp.jobs",
            DetailType: "JobStateChange",
            Detail: JSON.stringify({ status: "RUNNING", severity: 2 }),
          },
          {
            EventBusName: busName,
            Source: "myapp.jobs",
            DetailType: "JobStateChange",
            Detail: JSON.stringify({ status: "STOPPED", severity: 8 }),
          },
          {
            EventBusName: busName,
            Source: "myapp.jobs",
            DetailType: "JobStateChange",
            Detail: JSON.stringify({ status: "STOPPED", severity: 2 }),
          },
        ],
      }),
    );

    const recvA = await q.send(new ReceiveMessageCommand({ QueueUrl: urlA }));
    expect(recvA.Messages).toHaveLength(1);
    const eventA = JSON.parse(recvA.Messages![0]!.Body!);
    expect(eventA.detail.status).toBe("RUNNING");

    const recvB = await q.send(new ReceiveMessageCommand({ QueueUrl: urlB }));
    expect(recvB.Messages).toHaveLength(1);
    const eventB = JSON.parse(recvB.Messages![0]!.Body!);
    expect(eventB.detail.severity).toBe(8);

    const recvA2 = await q.send(new ReceiveMessageCommand({ QueueUrl: urlA }));
    expect(recvA2.Messages ?? []).toHaveLength(0);

    const recvB2 = await q.send(new ReceiveMessageCommand({ QueueUrl: urlB }));
    expect(recvB2.Messages ?? []).toHaveLength(0);
  });

  test("nested detail object match: detail.state.name=[ok]", async () => {
    const client = eb();
    const q = sqs();
    const busName = "nested-bus";

    await client.send(new CreateEventBusCommand({ Name: busName }));

    const url = (
      await q.send(new CreateQueueCommand({ QueueName: "nested-q" }))
    ).QueueUrl as string;
    const arn = await queueArnOf(q, url);

    await client.send(
      new PutRuleCommand({
        Name: "nested-rule",
        EventBusName: busName,
        EventPattern: JSON.stringify({
          detail: { state: { name: ["ok"] } },
        }),
      }),
    );
    await client.send(
      new PutTargetsCommand({
        Rule: "nested-rule",
        EventBusName: busName,
        Targets: [{ Id: "n1", Arn: arn }],
      }),
    );

    await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: "svc",
            DetailType: "StateEvent",
            Detail: JSON.stringify({ state: { name: "ok", code: 200 } }),
          },
        ],
      }),
    );
    const recv = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(recv.Messages).toHaveLength(1);
    const delivered = JSON.parse(recv.Messages![0]!.Body!);
    expect(delivered.detail.state.name).toBe("ok");

    await client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: busName,
            Source: "svc",
            DetailType: "StateEvent",
            Detail: JSON.stringify({ state: { name: "error", code: 500 } }),
          },
        ],
      }),
    );
    const recv2 = await q.send(new ReceiveMessageCommand({ QueueUrl: url }));
    expect(recv2.Messages ?? []).toHaveLength(0);
  });

  test("TestEventPattern asserts pattern matching result", async () => {
    const client = eb();

    const runningPattern = JSON.stringify({
      source: ["myapp.jobs"],
      "detail-type": ["JobStateChange"],
      detail: { status: ["RUNNING"] },
    });
    const matchingEvent = JSON.stringify({
      source: "myapp.jobs",
      "detail-type": "JobStateChange",
      detail: { status: "RUNNING" },
    });
    const nonMatchingEvent = JSON.stringify({
      source: "myapp.jobs",
      "detail-type": "JobStateChange",
      detail: { status: "STOPPED" },
    });

    const matchResult = await client.send(
      new TestEventPatternCommand({
        EventPattern: runningPattern,
        Event: matchingEvent,
      }),
    );
    expect(matchResult.Result).toBe(true);

    const noMatchResult = await client.send(
      new TestEventPatternCommand({
        EventPattern: runningPattern,
        Event: nonMatchingEvent,
      }),
    );
    expect(noMatchResult.Result).toBe(false);

    const numericPattern = JSON.stringify({
      detail: { severity: [{ numeric: [">", 5] }] },
    });
    const highSeverityEvent = JSON.stringify({
      detail: { severity: 9 },
    });
    const lowSeverityEvent = JSON.stringify({
      detail: { severity: 3 },
    });

    const numericMatch = await client.send(
      new TestEventPatternCommand({
        EventPattern: numericPattern,
        Event: highSeverityEvent,
      }),
    );
    expect(numericMatch.Result).toBe(true);

    const numericNoMatch = await client.send(
      new TestEventPatternCommand({
        EventPattern: numericPattern,
        Event: lowSeverityEvent,
      }),
    );
    expect(numericNoMatch.Result).toBe(false);
  });
});
