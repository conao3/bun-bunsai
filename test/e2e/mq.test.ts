import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateBrokerCommand,
  CreateConfigurationCommand,
  DeleteBrokerCommand,
  DescribeBrokerCommand,
  ListBrokersCommand,
  MqClient,
  UpdateBrokerCommand,
} from "@aws-sdk/client-mq";

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

const mq = () => new MqClient({ endpoint, region, credentials });

test("MQ broker and configuration roundtrip", async () => {
  const client = mq();
  const brokerName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateBrokerCommand({
      BrokerName: brokerName,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
      DeploymentMode: "SINGLE_INSTANCE",
      HostInstanceType: "mq.m5.large",
      PubliclyAccessible: false,
      AutoMinorVersionUpgrade: true,
      Users: [{ Username: "admin", Password: "supersecret123" }],
    }),
  );
  expect(created.BrokerId).toMatch(/^b-/);
  expect(created.BrokerArn).toContain("arn:aws:mq:");
  const brokerId = created.BrokerId as string;

  const described = await client.send(
    new DescribeBrokerCommand({ BrokerId: brokerId }),
  );
  expect(described.BrokerId).toBe(brokerId);
  expect(described.BrokerName).toBe(brokerName);
  expect(described.BrokerState).toBe("RUNNING");
  expect(described.EngineType).toBe("ACTIVEMQ");

  const listed = await client.send(new ListBrokersCommand({}));
  expect(
    (listed.BrokerSummaries ?? []).map((summary) => summary.BrokerId),
  ).toContain(brokerId);

  const updated = await client.send(
    new UpdateBrokerCommand({
      BrokerId: brokerId,
      AutoMinorVersionUpgrade: false,
      EngineVersion: "5.18.1",
    }),
  );
  expect(updated.BrokerId).toBe(brokerId);
  expect(updated.EngineVersion).toBe("5.18.1");
  expect(updated.AutoMinorVersionUpgrade).toBe(false);

  const configuration = await client.send(
    new CreateConfigurationCommand({
      Name: `${brokerName}-config`,
      EngineType: "ACTIVEMQ",
      EngineVersion: "5.18.0",
    }),
  );
  expect(configuration.Id).toMatch(/^c-/);
  expect(configuration.Name).toBe(`${brokerName}-config`);
  expect(configuration.LatestRevision?.Revision).toBe(1);

  const deleted = await client.send(
    new DeleteBrokerCommand({ BrokerId: brokerId }),
  );
  expect(deleted.BrokerId).toBe(brokerId);

  await expect(
    client.send(new DescribeBrokerCommand({ BrokerId: brokerId })),
  ).rejects.toThrow();
});
