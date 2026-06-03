import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateMissionProfileCommand,
  DeleteMissionProfileCommand,
  GetMissionProfileCommand,
  GroundStationClient,
  ListMissionProfilesCommand,
} from "@aws-sdk/client-groundstation";

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

const groundstation = () =>
  new GroundStationClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("GroundStation mission profile roundtrip", async () => {
  const client = groundstation();
  const profileName = `bunsai-e2e-${Date.now()}`;
  const trackingConfigArn = `arn:aws:groundstation:${region}:000000000000:config/tracking/${Date.now()}`;
  const dataflowConfigArn = `arn:aws:groundstation:${region}:000000000000:config/antenna-downlink/${Date.now()}`;

  const created = await client.send(
    new CreateMissionProfileCommand({
      name: profileName,
      minimumViableContactDurationSeconds: 180,
      dataflowEdges: [[dataflowConfigArn, dataflowConfigArn]],
      trackingConfigArn,
    }),
  );
  expect(created.missionProfileId).toBeDefined();
  const missionProfileId = created.missionProfileId ?? "";

  const got = await client.send(
    new GetMissionProfileCommand({ missionProfileId }),
  );
  expect(got.missionProfileId).toBe(missionProfileId);
  expect(got.name).toBe(profileName);
  expect(got.minimumViableContactDurationSeconds).toBe(180);
  expect(got.trackingConfigArn).toBe(trackingConfigArn);
  expect(got.missionProfileArn).toBeDefined();

  const listed = await client.send(new ListMissionProfilesCommand({}));
  expect(
    (listed.missionProfileList ?? []).map((p) => p.missionProfileId),
  ).toContain(missionProfileId);

  const deleted = await client.send(
    new DeleteMissionProfileCommand({ missionProfileId }),
  );
  expect(deleted.missionProfileId).toBe(missionProfileId);

  await expect(
    client.send(new GetMissionProfileCommand({ missionProfileId })),
  ).rejects.toThrow();
});
