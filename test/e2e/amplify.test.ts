import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AmplifyClient,
  CreateAppCommand,
  CreateBranchCommand,
  DeleteAppCommand,
  GetAppCommand,
  GetBranchCommand,
  ListAppsCommand,
  ListBranchesCommand,
  UpdateAppCommand,
} from "@aws-sdk/client-amplify";
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

const amplify = () =>
  new AmplifyClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Amplify app and branch roundtrip", async () => {
  const client = amplify();
  const appName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateAppCommand({
      name: appName,
      repository: "https://github.com/example/repo",
      platform: "WEB",
      environmentVariables: { STAGE: "dev" },
    }),
  );
  const appId = created.app?.appId;
  expect(appId).toBeDefined();
  expect(created.app?.name).toBe(appName);
  expect(created.app?.appArn).toContain(`apps/${appId}`);
  expect(created.app?.defaultDomain).toBeDefined();

  const got = await client.send(new GetAppCommand({ appId }));
  expect(got.app?.appId).toBe(appId);
  expect(got.app?.name).toBe(appName);

  const listed = await client.send(new ListAppsCommand({}));
  expect((listed.apps ?? []).map((app) => app.appId)).toContain(appId);

  const updated = await client.send(
    new UpdateAppCommand({ appId, description: "updated by bunsai" }),
  );
  expect(updated.app?.description).toBe("updated by bunsai");

  const branchName = `feat-${Date.now()}`;
  const branch = await client.send(
    new CreateBranchCommand({
      appId,
      branchName,
      stage: "DEVELOPMENT",
      environmentVariables: { KEY: "value" },
    }),
  );
  expect(branch.branch?.branchName).toBe(branchName);
  expect(branch.branch?.branchArn).toContain(
    `apps/${appId}/branches/${branchName}`,
  );
  expect(branch.branch?.stage).toBe("DEVELOPMENT");

  const gotBranch = await client.send(
    new GetBranchCommand({ appId, branchName }),
  );
  expect(gotBranch.branch?.branchName).toBe(branchName);

  const listedBranches = await client.send(new ListBranchesCommand({ appId }));
  expect((listedBranches.branches ?? []).map((b) => b.branchName)).toContain(
    branchName,
  );

  const deleted = await client.send(new DeleteAppCommand({ appId }));
  expect(deleted.app?.appId).toBe(appId);

  await expect(client.send(new GetAppCommand({ appId }))).rejects.toThrow();
});
