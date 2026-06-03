import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateRuleGroupCommand,
  DeleteRuleGroupCommand,
  GetRuleGroupCommand,
  ListRuleGroupsCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateRuleGroupCommand,
  WAFV2Client,
} from "@aws-sdk/client-wafv2";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4609;
const uiPort = 5709;
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

const wafv2 = () =>
  new WAFV2Client({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

const visibilityConfig = {
  SampledRequestsEnabled: true,
  CloudWatchMetricsEnabled: true,
  MetricName: "bunsai-e2e-rg-metric",
} as const;

test("WAFv2 RuleGroup lifecycle and tagging", async () => {
  const client = wafv2();
  const name = "bunsai-e2e-rulegroup";

  const created = await client.send(
    new CreateRuleGroupCommand({
      Name: name,
      Scope: "REGIONAL",
      Capacity: 50,
      VisibilityConfig: visibilityConfig,
      Rules: [],
    }),
  );
  expect(created.Summary?.Id).toBeDefined();
  expect(created.Summary?.ARN).toBeDefined();
  const groupId = created.Summary?.Id ?? "";
  const groupArn = created.Summary?.ARN ?? "";

  const listed = await client.send(
    new ListRuleGroupsCommand({ Scope: "REGIONAL" }),
  );
  expect((listed.RuleGroups ?? []).map((group) => group.Name)).toContain(name);

  const got = await client.send(
    new GetRuleGroupCommand({ Scope: "REGIONAL", Name: name, Id: groupId }),
  );
  expect(got.RuleGroup?.Name).toBe(name);
  expect(got.RuleGroup?.Capacity).toBe(50);
  expect(got.LockToken).toBeDefined();
  const lockToken = got.LockToken ?? "";

  const updated = await client.send(
    new UpdateRuleGroupCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: groupId,
      VisibilityConfig: visibilityConfig,
      LockToken: lockToken,
      Description: "updated rule group",
      Rules: [],
    }),
  );
  expect(updated.NextLockToken).toBeDefined();
  expect(updated.NextLockToken).not.toBe(lockToken);
  const nextToken = updated.NextLockToken ?? "";

  const afterUpdate = await client.send(
    new GetRuleGroupCommand({ Scope: "REGIONAL", Name: name, Id: groupId }),
  );
  expect(afterUpdate.RuleGroup?.Description).toBe("updated rule group");

  await client.send(
    new TagResourceCommand({
      ResourceARN: groupArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const tags = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: groupArn }),
  );
  const tagPairs = (tags.TagInfoForResource?.TagList ?? []).map(
    (tag) => `${tag.Key}=${tag.Value}`,
  );
  expect(tagPairs).toContain("env=test");
  expect(tagPairs).toContain("team=bunsai");

  await client.send(
    new UntagResourceCommand({
      ResourceARN: groupArn,
      TagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceARN: groupArn }),
  );
  const afterKeys = (afterUntag.TagInfoForResource?.TagList ?? []).map(
    (tag) => tag.Key,
  );
  expect(afterKeys).not.toContain("env");
  expect(afterKeys).toContain("team");

  await client.send(
    new DeleteRuleGroupCommand({
      Name: name,
      Scope: "REGIONAL",
      Id: groupId,
      LockToken: nextToken,
    }),
  );

  const afterDelete = await client.send(
    new ListRuleGroupsCommand({ Scope: "REGIONAL" }),
  );
  expect(
    (afterDelete.RuleGroups ?? []).map((group) => group.Name),
  ).not.toContain(name);
});
