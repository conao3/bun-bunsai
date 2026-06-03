import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  DescribeInstanceCommand,
  ListInstancesCommand,
} from "@aws-sdk/client-connect";

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

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Connect instance roundtrip", async () => {
  const client = connect();
  const alias = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: alias,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Arn).toBeDefined();
  const instanceId = created.Id ?? "";

  const described = await client.send(
    new DescribeInstanceCommand({ InstanceId: instanceId }),
  );
  expect(described.Instance?.Id).toBe(instanceId);
  expect(described.Instance?.IdentityManagementType).toBe("CONNECT_MANAGED");
  expect(described.Instance?.InstanceAlias).toBe(alias);
  expect(described.Instance?.InboundCallsEnabled).toBe(true);
  expect(described.Instance?.OutboundCallsEnabled).toBe(false);

  const listed = await client.send(new ListInstancesCommand({}));
  expect((listed.InstanceSummaryList ?? []).map((i) => i.Id)).toContain(
    instanceId,
  );

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
  await expect(
    client.send(new DescribeInstanceCommand({ InstanceId: instanceId })),
  ).rejects.toThrow();
});
