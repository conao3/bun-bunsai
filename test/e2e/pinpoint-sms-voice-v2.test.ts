import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateConfigurationSetCommand,
  DeleteConfigurationSetCommand,
  DescribeConfigurationSetsCommand,
  PinpointSMSVoiceV2Client,
} from "@aws-sdk/client-pinpoint-sms-voice-v2";

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

const smsVoice = () =>
  new PinpointSMSVoiceV2Client({ endpoint, region, credentials });

test("PinpointSMSVoiceV2 configuration set roundtrip", async () => {
  const client = smsVoice();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateConfigurationSetCommand({ ConfigurationSetName: name }),
  );
  expect(created.ConfigurationSetName).toBe(name);
  expect(created.ConfigurationSetArn).toContain(`configuration-set/${name}`);

  const described = await client.send(
    new DescribeConfigurationSetsCommand({ ConfigurationSetNames: [name] }),
  );
  const names = (described.ConfigurationSets ?? []).map(
    (set) => set.ConfigurationSetName,
  );
  expect(names).toContain(name);

  const deleted = await client.send(
    new DeleteConfigurationSetCommand({ ConfigurationSetName: name }),
  );
  expect(deleted.ConfigurationSetName).toBe(name);
  expect(deleted.ConfigurationSetArn).toBe(created.ConfigurationSetArn);

  const after = await client.send(
    new DescribeConfigurationSetsCommand({ ConfigurationSetNames: [name] }),
  );
  expect((after.ConfigurationSets ?? []).length).toBe(0);
});
