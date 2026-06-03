import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeleteDetectorCommand,
  FraudDetectorClient,
  GetDetectorsCommand,
  PutDetectorCommand,
} from "@aws-sdk/client-frauddetector";
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

const frauddetector = () =>
  new FraudDetectorClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("FraudDetector detector lifecycle", async () => {
  const client = frauddetector();
  const detectorId = "bunsai-e2e-detector";
  const eventTypeName = "bunsai-e2e-event";

  await client.send(
    new PutDetectorCommand({
      detectorId,
      eventTypeName,
      description: "bunsai e2e detector",
    }),
  );

  const listed = await client.send(new GetDetectorsCommand({ detectorId }));
  expect(
    (listed.detectors ?? []).some((d) => d.detectorId === detectorId),
  ).toBe(true);
  expect(
    (listed.detectors ?? []).find((d) => d.detectorId === detectorId)
      ?.eventTypeName,
  ).toBe(eventTypeName);

  await client.send(new DeleteDetectorCommand({ detectorId }));

  const afterDelete = await client.send(new GetDetectorsCommand({}));
  expect(
    (afterDelete.detectors ?? []).some((d) => d.detectorId === detectorId),
  ).toBe(false);
});
