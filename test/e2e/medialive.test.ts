import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateChannelCommand,
  DeleteChannelCommand,
  DescribeChannelCommand,
  ListChannelsCommand,
  MediaLiveClient,
} from "@aws-sdk/client-medialive";

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

const medialive = () =>
  new MediaLiveClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaLive channel roundtrip", async () => {
  const client = medialive();

  const created = await client.send(
    new CreateChannelCommand({ Name: "bunsai-e2e-channel" }),
  );
  const id = created.Channel?.Id;
  expect(id).toBeDefined();
  expect(created.Channel?.Arn).toBeDefined();
  expect(created.Channel?.Name).toBe("bunsai-e2e-channel");
  expect(created.Channel?.State).toBe("IDLE");

  const described = await client.send(
    new DescribeChannelCommand({ ChannelId: id }),
  );
  expect(described.Id).toBe(id);
  expect(described.Name).toBe("bunsai-e2e-channel");

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Channels ?? []).map((c) => c.Id)).toContain(id);

  const deleted = await client.send(
    new DeleteChannelCommand({ ChannelId: id }),
  );
  expect(deleted.State).toBe("DELETING");

  await expect(
    client.send(new DescribeChannelCommand({ ChannelId: id })),
  ).rejects.toThrow();
});
