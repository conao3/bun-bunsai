import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DeleteRuleCommand,
  DisableRuleCommand,
  EnableRuleCommand,
  EventBridgeClient,
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

test("scheduled rule fires immediately and delivers to SQS target", async () => {
  const q = sqs();
  const client = eb();

  const qUrl = (await q.send(new CreateQueueCommand({ QueueName: "sched-q" })))
    .QueueUrl as string;
  const qArn = await queueArnOf(q, qUrl);

  const putRule = await client.send(
    new PutRuleCommand({
      Name: "sched-rule",
      ScheduleExpression: "rate(1 minute)",
      State: "ENABLED",
    }),
  );
  expect(putRule.RuleArn).toContain("rule/default/sched-rule");

  await client.send(
    new PutTargetsCommand({
      Rule: "sched-rule",
      Targets: [{ Id: "t1", Arn: qArn }],
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 200));

  const got = await q.send(new ReceiveMessageCommand({ QueueUrl: qUrl }));
  expect(got.Messages).toHaveLength(1);
  const body = JSON.parse(got.Messages![0]!.Body!);
  expect(body.source).toBe("aws.events");
  expect(body["detail-type"]).toBe("Scheduled Event");
  expect(body.resources).toContain(putRule.RuleArn);
  expect(body.account).toBeDefined();
  expect(body.region).toBe(region);
  expect(body.detail).toEqual({});

  await client.send(new DeleteRuleCommand({ Name: "sched-rule" }));

  await new Promise((resolve) => setTimeout(resolve, 200));

  const after = await q.send(new ReceiveMessageCommand({ QueueUrl: qUrl }));
  expect(after.Messages ?? []).toHaveLength(0);
});

test("DisableRule stops delivery, EnableRule resumes it", async () => {
  const q = sqs();
  const client = eb();

  const qUrl = (await q.send(new CreateQueueCommand({ QueueName: "sched-q2" })))
    .QueueUrl as string;
  const qArn = await queueArnOf(q, qUrl);

  await client.send(
    new PutRuleCommand({
      Name: "sched-rule2",
      ScheduleExpression: "rate(1 minute)",
      State: "ENABLED",
    }),
  );
  await client.send(
    new PutTargetsCommand({
      Rule: "sched-rule2",
      Targets: [{ Id: "t1", Arn: qArn }],
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 200));

  const got = await q.send(new ReceiveMessageCommand({ QueueUrl: qUrl }));
  expect(got.Messages).toHaveLength(1);

  await client.send(new DisableRuleCommand({ Name: "sched-rule2" }));

  await new Promise((resolve) => setTimeout(resolve, 200));

  const afterDisable = await q.send(
    new ReceiveMessageCommand({ QueueUrl: qUrl }),
  );
  expect(afterDisable.Messages ?? []).toHaveLength(0);

  await client.send(new EnableRuleCommand({ Name: "sched-rule2" }));

  await new Promise((resolve) => setTimeout(resolve, 200));

  const afterEnable = await q.send(
    new ReceiveMessageCommand({ QueueUrl: qUrl }),
  );
  expect(afterEnable.Messages).toHaveLength(1);
  const body = JSON.parse(afterEnable.Messages![0]!.Body!);
  expect(body.source).toBe("aws.events");
  expect(body["detail-type"]).toBe("Scheduled Event");

  await client.send(new DeleteRuleCommand({ Name: "sched-rule2" }));
});
