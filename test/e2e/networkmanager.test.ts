import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateGlobalNetworkCommand,
  DeleteGlobalNetworkCommand,
  DescribeGlobalNetworksCommand,
  NetworkManagerClient,
} from "@aws-sdk/client-networkmanager";

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

const networkmanager = () =>
  new NetworkManagerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("NetworkManager global network roundtrip", async () => {
  const client = networkmanager();

  const created = await client.send(
    new CreateGlobalNetworkCommand({
      Description: "bunsai-e2e",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const id = created.GlobalNetwork?.GlobalNetworkId;
  expect(id).toBeDefined();
  expect(created.GlobalNetwork?.GlobalNetworkArn).toContain("global-network/");
  expect(created.GlobalNetwork?.State).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeGlobalNetworksCommand({ GlobalNetworkIds: [id ?? ""] }),
  );
  expect(
    described.GlobalNetworks?.some((network) => network.GlobalNetworkId === id),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteGlobalNetworkCommand({ GlobalNetworkId: id ?? "" }),
  );
  expect(deleted.GlobalNetwork?.GlobalNetworkId).toBe(id);
  expect(deleted.GlobalNetwork?.State).toBe("DELETING");

  const after = await client.send(new DescribeGlobalNetworksCommand({}));
  expect(
    after.GlobalNetworks?.some((network) => network.GlobalNetworkId === id),
  ).toBe(false);
});
