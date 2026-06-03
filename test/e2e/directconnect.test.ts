import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateConnectionCommand,
  DeleteConnectionCommand,
  DescribeConnectionsCommand,
  DirectConnectClient,
} from "@aws-sdk/client-direct-connect";

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

const directconnect = () =>
  new DirectConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("DirectConnect connection lifecycle", async () => {
  const client = directconnect();

  const created = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "bunsai-e2e-connection",
    }),
  );
  expect(created.connectionId).toMatch(/^dxcon-/);
  expect(created.connectionName).toBe("bunsai-e2e-connection");
  expect(created.connectionState).toBe("available");
  expect(created.location).toBe("EqDC2");
  expect(created.bandwidth).toBe("1Gbps");
  const connectionId = created.connectionId;
  expect(connectionId).toBeDefined();

  const described = await client.send(
    new DescribeConnectionsCommand({ connectionId }),
  );
  const ids = (described.connections ?? []).map((entry) => entry.connectionId);
  expect(ids).toContain(connectionId);

  const deleted = await client.send(
    new DeleteConnectionCommand({ connectionId: connectionId! }),
  );
  expect(deleted.connectionId).toBe(connectionId);
  expect(deleted.connectionState).toBe("deleted");

  const afterDelete = await client.send(new DescribeConnectionsCommand({}));
  const remaining = (afterDelete.connections ?? []).map(
    (entry) => entry.connectionId,
  );
  expect(remaining).not.toContain(connectionId);
});
