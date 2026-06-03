import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  DeletePlaybackConfigurationCommand,
  GetPlaybackConfigurationCommand,
  ListPlaybackConfigurationsCommand,
  MediaTailorClient,
  PutPlaybackConfigurationCommand,
} from "@aws-sdk/client-mediatailor";

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

const mediatailor = () =>
  new MediaTailorClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("MediaTailor playback configuration roundtrip", async () => {
  const client = mediatailor();
  const name = `bunsai-e2e-${Date.now()}`;

  const put = await client.send(
    new PutPlaybackConfigurationCommand({
      Name: name,
      AdDecisionServerUrl: "https://ads.example.com/vmap",
      VideoContentSourceUrl: "https://content.example.com/master.m3u8",
    }),
  );
  expect(put.Name).toBe(name);
  expect(put.PlaybackConfigurationArn).toBeDefined();
  expect(put.AdDecisionServerUrl).toBe("https://ads.example.com/vmap");

  const got = await client.send(
    new GetPlaybackConfigurationCommand({ Name: name }),
  );
  expect(got.Name).toBe(name);
  expect(got.PlaybackConfigurationArn).toBe(put.PlaybackConfigurationArn);
  expect(got.VideoContentSourceUrl).toBe(
    "https://content.example.com/master.m3u8",
  );

  const listed = await client.send(new ListPlaybackConfigurationsCommand({}));
  expect((listed.Items ?? []).map((c) => c.Name)).toContain(name);

  await client.send(new DeletePlaybackConfigurationCommand({ Name: name }));
  await expect(
    client.send(new GetPlaybackConfigurationCommand({ Name: name })),
  ).rejects.toThrow();
});
