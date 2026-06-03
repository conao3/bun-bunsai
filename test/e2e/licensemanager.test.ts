import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateLicenseConfigurationCommand,
  DeleteLicenseConfigurationCommand,
  GetLicenseConfigurationCommand,
  LicenseManagerClient,
  ListLicenseConfigurationsCommand,
} from "@aws-sdk/client-license-manager";
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

const licensemanager = () =>
  new LicenseManagerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("LicenseManager license configuration lifecycle", async () => {
  const client = licensemanager();
  const name = "bunsai-e2e-license-config";

  const created = await client.send(
    new CreateLicenseConfigurationCommand({
      Name: name,
      LicenseCountingType: "vCPU",
      Description: "bunsai e2e",
      LicenseCount: 10,
      LicenseCountHardLimit: true,
    }),
  );
  const arn = created.LicenseConfigurationArn;
  expect(typeof arn).toBe("string");
  expect(arn).toContain("license-configuration:");

  const got = await client.send(
    new GetLicenseConfigurationCommand({
      LicenseConfigurationArn: arn,
    }),
  );
  expect(got.Name).toBe(name);
  expect(got.LicenseCountingType).toBe("vCPU");
  expect(got.LicenseCount).toBe(10);
  expect(got.LicenseCountHardLimit).toBe(true);
  expect(got.LicenseConfigurationArn).toBe(arn);

  const listed = await client.send(new ListLicenseConfigurationsCommand({}));
  expect(
    (listed.LicenseConfigurations ?? []).some(
      (config) => config.LicenseConfigurationArn === arn,
    ),
  ).toBe(true);

  await client.send(
    new DeleteLicenseConfigurationCommand({
      LicenseConfigurationArn: arn,
    }),
  );

  const afterDelete = await client.send(
    new ListLicenseConfigurationsCommand({}),
  );
  expect(
    (afterDelete.LicenseConfigurations ?? []).some(
      (config) => config.LicenseConfigurationArn === arn,
    ),
  ).toBe(false);
});
