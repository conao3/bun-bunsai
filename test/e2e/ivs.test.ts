import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateChannelCommand,
  DeleteChannelCommand,
  GetChannelCommand,
  IvsClient,
  ListChannelsCommand,
} from "@aws-sdk/client-ivs";

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

const ivs = () =>
  new IvsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("IVS channel roundtrip", async () => {
  const client = ivs();
  const channelName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateChannelCommand({ name: channelName }),
  );
  expect(created.channel?.arn).toBeDefined();
  expect(created.channel?.name).toBe(channelName);
  expect(created.channel?.ingestEndpoint).toBeDefined();
  expect(created.channel?.playbackUrl).toBeDefined();
  const arn = created.channel?.arn ?? "";

  const got = await client.send(new GetChannelCommand({ arn }));
  expect(got.channel?.arn).toBe(arn);
  expect(got.channel?.name).toBe(channelName);

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.channels ?? []).map((c) => c.arn)).toContain(arn);

  await client.send(new DeleteChannelCommand({ arn }));
  await expect(client.send(new GetChannelCommand({ arn }))).rejects.toThrow();
});
