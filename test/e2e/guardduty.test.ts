import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDetectorCommand,
  DeleteDetectorCommand,
  GetDetectorCommand,
  GuardDutyClient,
  ListDetectorsCommand,
  UpdateDetectorCommand,
} from "@aws-sdk/client-guardduty";
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const guardduty = () =>
  new GuardDutyClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("GuardDuty detector lifecycle", async () => {
  const client = guardduty();

  const created = await client.send(
    new CreateDetectorCommand({
      Enable: true,
      FindingPublishingFrequency: "ONE_HOUR",
    }),
  );
  expect(created.DetectorId).toBeDefined();
  const detectorId = created.DetectorId as string;

  const got = await client.send(
    new GetDetectorCommand({ DetectorId: detectorId }),
  );
  expect(got.Status).toBe("ENABLED");
  expect(got.FindingPublishingFrequency).toBe("ONE_HOUR");
  expect(got.ServiceRole).toBeDefined();

  const listed = await client.send(new ListDetectorsCommand({}));
  expect(listed.DetectorIds).toContain(detectorId);

  await client.send(
    new UpdateDetectorCommand({
      DetectorId: detectorId,
      Enable: false,
      FindingPublishingFrequency: "SIX_HOURS",
    }),
  );

  const updated = await client.send(
    new GetDetectorCommand({ DetectorId: detectorId }),
  );
  expect(updated.Status).toBe("DISABLED");
  expect(updated.FindingPublishingFrequency).toBe("SIX_HOURS");

  await client.send(new DeleteDetectorCommand({ DetectorId: detectorId }));

  const afterDelete = await client.send(new ListDetectorsCommand({}));
  expect(afterDelete.DetectorIds ?? []).not.toContain(detectorId);
});
