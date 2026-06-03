import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateChannelCommand,
  DeleteChannelCommand,
  DescribeChannelCommand,
  ListChannelsCommand,
  MediaPackageClient,
} from "@aws-sdk/client-mediapackage";

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

const mediapackage = () =>
  new MediaPackageClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaPackage channel roundtrip", async () => {
  const client = mediapackage();
  const id = "bunsai-e2e-channel";

  const created = await client.send(
    new CreateChannelCommand({ Id: id, Description: "bunsai e2e channel" }),
  );
  expect(created.Id).toBe(id);
  expect(created.Arn).toBeDefined();

  const described = await client.send(new DescribeChannelCommand({ Id: id }));
  expect(described.Id).toBe(id);
  expect(described.Description).toBe("bunsai e2e channel");

  const listed = await client.send(new ListChannelsCommand({}));
  expect((listed.Channels ?? []).map((c) => c.Id)).toContain(id);

  await client.send(new DeleteChannelCommand({ Id: id }));
  await expect(
    client.send(new DescribeChannelCommand({ Id: id })),
  ).rejects.toThrow();
});
