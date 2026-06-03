import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateRegistryCommand,
  DeleteRegistryCommand,
  DescribeRegistryCommand,
  ListRegistriesCommand,
  SchemasClient,
} from "@aws-sdk/client-schemas";

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

const schemas = () => new SchemasClient({ endpoint, region, credentials });

test("schemas registry round trip", async () => {
  const client = schemas();
  const name = `bunsai-reg-${Date.now()}`;

  const created = await client.send(
    new CreateRegistryCommand({
      RegistryName: name,
      Description: "bunsai e2e registry",
    }),
  );
  expect(created.RegistryName).toBe(name);
  expect(created.RegistryArn).toContain(`registry/${name}`);

  const described = await client.send(
    new DescribeRegistryCommand({ RegistryName: name }),
  );
  expect(described.RegistryName).toBe(name);
  expect(described.RegistryArn).toBe(created.RegistryArn);
  expect(described.Description).toBe("bunsai e2e registry");

  const listed = await client.send(new ListRegistriesCommand({}));
  expect((listed.Registries ?? []).map((r) => r.RegistryName)).toContain(name);

  await client.send(new DeleteRegistryCommand({ RegistryName: name }));
  await expect(
    client.send(new DescribeRegistryCommand({ RegistryName: name })),
  ).rejects.toThrow();
});
