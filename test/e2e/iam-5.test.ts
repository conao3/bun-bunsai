import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DisableOrganizationsRootCredentialsManagementCommand,
  DisableOrganizationsRootSessionsCommand,
  EnableOrganizationsRootCredentialsManagementCommand,
  EnableOrganizationsRootSessionsCommand,
  GenerateOrganizationsAccessReportCommand,
  GetOrganizationsAccessReportCommand,
  IAMClient,
  ListOrganizationsFeaturesCommand,
} from "@aws-sdk/client-iam";

const awsPort = 4903;
const uiPort = 5903;
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

const iam = () => new IAMClient({ endpoint, region, credentials });

test("IAM organizations-root toggle and access-report lifecycle", async () => {
  const client = iam();

  const init = await client.send(new ListOrganizationsFeaturesCommand({}));
  expect(init.OrganizationId).toBeDefined();
  expect(Array.isArray(init.EnabledFeatures)).toBe(true);

  const enableCreds = await client.send(
    new EnableOrganizationsRootCredentialsManagementCommand({}),
  );
  expect(enableCreds.EnabledFeatures).toContain("RootCredentialsManagement");

  const enableSessions = await client.send(
    new EnableOrganizationsRootSessionsCommand({}),
  );
  expect(enableSessions.EnabledFeatures).toContain("RootSessions");
  expect(enableSessions.EnabledFeatures).toContain("RootCredentialsManagement");

  const listAfterEnable = await client.send(
    new ListOrganizationsFeaturesCommand({}),
  );
  expect(listAfterEnable.EnabledFeatures).toContain(
    "RootCredentialsManagement",
  );
  expect(listAfterEnable.EnabledFeatures).toContain("RootSessions");

  const disableCreds = await client.send(
    new DisableOrganizationsRootCredentialsManagementCommand({}),
  );
  expect(disableCreds.EnabledFeatures).not.toContain(
    "RootCredentialsManagement",
  );

  const disableSessions = await client.send(
    new DisableOrganizationsRootSessionsCommand({}),
  );
  expect(disableSessions.EnabledFeatures).not.toContain("RootSessions");

  const generated = await client.send(
    new GenerateOrganizationsAccessReportCommand({
      EntityPath: "o-exampleorgid11/r-f6g7h8i9j0example",
    }),
  );
  expect(generated.JobId).toBeDefined();

  const report = await client.send(
    new GetOrganizationsAccessReportCommand({
      JobId: generated.JobId!,
    }),
  );
  expect(report.JobStatus).toBe("COMPLETED");
  expect(report.JobCreationDate).toBeDefined();
});
