import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  GetCurrentMetricDataCommand,
  GetMetricDataV2Command,
} from "@aws-sdk/client-connect";

const awsPort = 4572;
const uiPort = 5672;
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

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("GetCurrentMetricData returns empty metric results", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-cmd-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  expect(createdInstance.Arn).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const result = await client.send(
    new GetCurrentMetricDataCommand({
      InstanceId: instanceId,
      Filters: { Channels: ["VOICE"] },
      CurrentMetrics: [{ Name: "AGENTS_ONLINE", Unit: "COUNT" }],
    }),
  );
  expect(result.MetricResults).toBeDefined();
  expect(Array.isArray(result.MetricResults)).toBe(true);
  expect(result.MetricResults?.length).toBe(0);
  expect(result.ApproximateTotalCount).toBe(0);

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});

test("GetMetricDataV2 returns empty metric results", async () => {
  const client = connect();

  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000);

  const result = await client.send(
    new GetMetricDataV2Command({
      ResourceArn: "arn:aws:connect:us-east-1:123456789012:instance/test",
      StartTime: start,
      EndTime: now,
      Filters: [{ FilterKey: "QUEUE", FilterValues: ["test-queue"] }],
      Metrics: [{ Name: "CONTACTS_QUEUED" }],
    }),
  );
  expect(result.MetricResults).toBeDefined();
  expect(Array.isArray(result.MetricResults)).toBe(true);
  expect(result.MetricResults?.length).toBe(0);
});
