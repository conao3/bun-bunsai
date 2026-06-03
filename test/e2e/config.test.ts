import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConfigServiceClient,
  DeleteConfigRuleCommand,
  DeleteConfigurationRecorderCommand,
  DescribeConfigRulesCommand,
  DescribeConfigurationRecordersCommand,
  PutConfigRuleCommand,
  PutConfigurationRecorderCommand,
} from "@aws-sdk/client-config-service";

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

const config = () =>
  new ConfigServiceClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AWS Config rule lifecycle", async () => {
  const client = config();
  const ruleName = "bunsai-e2e-rule";

  await client.send(
    new PutConfigRuleCommand({
      ConfigRule: {
        ConfigRuleName: ruleName,
        Source: { Owner: "AWS", SourceIdentifier: "REQUIRED_TAGS" },
      },
    }),
  );

  const described = await client.send(
    new DescribeConfigRulesCommand({ ConfigRuleNames: [ruleName] }),
  );
  const names = (described.ConfigRules ?? []).map(
    (rule) => rule.ConfigRuleName,
  );
  expect(names).toContain(ruleName);

  await client.send(new DeleteConfigRuleCommand({ ConfigRuleName: ruleName }));

  const afterDelete = await client.send(new DescribeConfigRulesCommand({}));
  const remaining = (afterDelete.ConfigRules ?? []).map(
    (rule) => rule.ConfigRuleName,
  );
  expect(remaining).not.toContain(ruleName);
});

test("AWS Config configuration recorder lifecycle", async () => {
  const client = config();
  const recorderName = "bunsai-e2e-recorder";
  const roleARN = `arn:aws:iam::123456789012:role/config-recorder`;

  await client.send(
    new PutConfigurationRecorderCommand({
      ConfigurationRecorder: { name: recorderName, roleARN },
    }),
  );

  const described = await client.send(
    new DescribeConfigurationRecordersCommand({
      ConfigurationRecorderNames: [recorderName],
    }),
  );
  const names = (described.ConfigurationRecorders ?? []).map(
    (recorder) => recorder.name,
  );
  expect(names).toContain(recorderName);

  await client.send(
    new DeleteConfigurationRecorderCommand({
      ConfigurationRecorderName: recorderName,
    }),
  );

  const afterDelete = await client.send(
    new DescribeConfigurationRecordersCommand({}),
  );
  const remaining = (afterDelete.ConfigurationRecorders ?? []).map(
    (recorder) => recorder.name,
  );
  expect(remaining).not.toContain(recorderName);
});
