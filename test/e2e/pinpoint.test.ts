import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateAppCommand,
  DeleteAppCommand,
  GetAppCommand,
  GetAppsCommand,
  PinpointClient,
} from "@aws-sdk/client-pinpoint";
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

const pinpoint = () =>
  new PinpointClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Pinpoint app roundtrip", async () => {
  const client = pinpoint();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateAppCommand({
      CreateApplicationRequest: { Name: name, tags: { env: "test" } },
    }),
  );
  expect(created.ApplicationResponse?.Name).toBe(name);
  expect(created.ApplicationResponse?.Id).toBeDefined();
  expect(created.ApplicationResponse?.Arn).toContain("apps/");

  const appId = created.ApplicationResponse?.Id ?? "";

  const got = await client.send(new GetAppCommand({ ApplicationId: appId }));
  expect(got.ApplicationResponse?.Id).toBe(appId);
  expect(got.ApplicationResponse?.Name).toBe(name);

  const listed = await client.send(new GetAppsCommand({}));
  expect(
    (listed.ApplicationsResponse?.Item ?? []).some((app) => app.Id === appId),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteAppCommand({ ApplicationId: appId }),
  );
  expect(deleted.ApplicationResponse?.Id).toBe(appId);

  await expect(
    client.send(new GetAppCommand({ ApplicationId: appId })),
  ).rejects.toThrow();
});
