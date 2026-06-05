import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  DeleteRuleCommand,
  DescribeRuleCommand,
  EventBridgeClient,
  ListRulesCommand,
  ListTargetsByRuleCommand,
  PutEventsCommand,
  PutRuleCommand,
  PutTargetsCommand,
  RemoveTargetsCommand,
} from "@aws-sdk/client-eventbridge";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const eb = () =>
  new EventBridgeClient({ endpoint, region, credentials, requestHandler });

test("EventBridge rule and target lifecycle", async () => {
  const client = eb();
  const ruleName = "bunsai-e2e-rule";
  const targetId = "bunsai-e2e-target";

  const putRule = await client.send(
    new PutRuleCommand({
      Name: ruleName,
      ScheduleExpression: "rate(5 minutes)",
      Description: "bunsai e2e rule",
      State: "ENABLED",
    }),
  );
  expect(putRule.RuleArn).toContain(`rule/default/${ruleName}`);

  const described = await client.send(
    new DescribeRuleCommand({ Name: ruleName }),
  );
  expect(described.Name).toBe(ruleName);
  expect(described.Arn).toBe(putRule.RuleArn);
  expect(described.ScheduleExpression).toBe("rate(5 minutes)");
  expect(described.State).toBe("ENABLED");
  expect(described.Description).toBe("bunsai e2e rule");

  const listed = await client.send(new ListRulesCommand({}));
  const ruleNames = (listed.Rules ?? []).map((rule) => rule.Name);
  expect(ruleNames).toContain(ruleName);

  const putTargets = await client.send(
    new PutTargetsCommand({
      Rule: ruleName,
      Targets: [
        {
          Id: targetId,
          Arn: `arn:aws:sqs:${region}:000000000000:bunsai-e2e-queue`,
          Input: '{"hello":"world"}',
        },
      ],
    }),
  );
  expect(putTargets.FailedEntryCount).toBe(0);

  const targets = await client.send(
    new ListTargetsByRuleCommand({ Rule: ruleName }),
  );
  const targetIds = (targets.Targets ?? []).map((target) => target.Id);
  expect(targetIds).toContain(targetId);

  const events = await client.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "bunsai.e2e",
          DetailType: "test",
          Detail: '{"value":1}',
        },
        {
          Source: "bunsai.e2e",
          DetailType: "test",
          Detail: '{"value":2}',
        },
      ],
    }),
  );
  expect(events.FailedEntryCount).toBe(0);
  expect(events.Entries).toHaveLength(2);
  for (const entry of events.Entries ?? []) {
    expect(entry.EventId).toBeDefined();
  }

  const removed = await client.send(
    new RemoveTargetsCommand({ Rule: ruleName, Ids: [targetId] }),
  );
  expect(removed.FailedEntryCount).toBe(0);

  const afterRemove = await client.send(
    new ListTargetsByRuleCommand({ Rule: ruleName }),
  );
  expect(afterRemove.Targets ?? []).toHaveLength(0);

  await client.send(new DeleteRuleCommand({ Name: ruleName }));

  await expect(
    client.send(new DescribeRuleCommand({ Name: ruleName })),
  ).rejects.toThrow();
});
