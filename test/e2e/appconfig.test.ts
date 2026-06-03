import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  AppConfigClient,
  CreateApplicationCommand,
  CreateEnvironmentCommand,
  DeleteApplicationCommand,
  GetApplicationCommand,
  ListApplicationsCommand,
  ListEnvironmentsCommand,
  UpdateApplicationCommand,
} from "@aws-sdk/client-appconfig";

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

const appconfig = () =>
  new AppConfigClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AppConfig application and environment roundtrip", async () => {
  const client = appconfig();
  const appName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateApplicationCommand({
      Name: appName,
      Description: "bunsai e2e application",
    }),
  );
  expect(created.Id).toBeDefined();
  expect(created.Name).toBe(appName);
  const applicationId = created.Id ?? "";

  const got = await client.send(
    new GetApplicationCommand({ ApplicationId: applicationId }),
  );
  expect(got.Id).toBe(applicationId);
  expect(got.Name).toBe(appName);
  expect(got.Description).toBe("bunsai e2e application");

  const listed = await client.send(new ListApplicationsCommand({}));
  expect((listed.Items ?? []).map((a) => a.Id)).toContain(applicationId);

  const updated = await client.send(
    new UpdateApplicationCommand({
      ApplicationId: applicationId,
      Description: "updated description",
    }),
  );
  expect(updated.Description).toBe("updated description");
  expect(updated.Name).toBe(appName);

  const envName = `bunsai-env-${Date.now()}`;
  const env = await client.send(
    new CreateEnvironmentCommand({
      ApplicationId: applicationId,
      Name: envName,
    }),
  );
  expect(env.Id).toBeDefined();
  expect(env.ApplicationId).toBe(applicationId);
  expect(env.Name).toBe(envName);
  expect(env.State).toBe("READY_FOR_DEPLOYMENT");

  const envs = await client.send(
    new ListEnvironmentsCommand({ ApplicationId: applicationId }),
  );
  expect((envs.Items ?? []).map((e) => e.Name)).toContain(envName);

  await client.send(
    new DeleteApplicationCommand({ ApplicationId: applicationId }),
  );
  await expect(
    client.send(new GetApplicationCommand({ ApplicationId: applicationId })),
  ).rejects.toThrow();
});
