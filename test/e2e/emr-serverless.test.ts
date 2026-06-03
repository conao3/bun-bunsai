import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateApplicationCommand,
  DeleteApplicationCommand,
  EMRServerlessClient,
  GetApplicationCommand,
  ListApplicationsCommand,
} from "@aws-sdk/client-emr-serverless";

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

const emr = () =>
  new EMRServerlessClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("EMR Serverless application roundtrip", async () => {
  const client = emr();
  const appName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateApplicationCommand({
      name: appName,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.applicationId).toBeDefined();
  expect(created.arn).toBeDefined();
  expect(created.name).toBe(appName);
  const applicationId = created.applicationId ?? "";

  const got = await client.send(new GetApplicationCommand({ applicationId }));
  expect(got.application?.applicationId).toBe(applicationId);
  expect(got.application?.name).toBe(appName);
  expect(got.application?.releaseLabel).toBe("emr-7.1.0");
  expect(got.application?.type).toBe("SPARK");
  expect(got.application?.state).toBe("CREATED");

  const listed = await client.send(new ListApplicationsCommand({}));
  expect((listed.applications ?? []).map((a) => a.id)).toContain(applicationId);

  await client.send(new DeleteApplicationCommand({ applicationId }));
  await expect(
    client.send(new GetApplicationCommand({ applicationId })),
  ).rejects.toThrow();
});
