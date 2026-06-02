import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const eb = () => new EventBridgeClient({ endpoint, region, credentials });

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
