import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetRandomPasswordCommand,
  ListSecretVersionIdsCommand,
  RestoreSecretCommand,
  SecretsManagerClient,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-secrets-manager";

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

const sm = () => new SecretsManagerClient({ endpoint, region, credentials });

test("Secrets Manager GetRandomPassword honors length and exclusions", async () => {
  const client = sm();

  const generated = await client.send(
    new GetRandomPasswordCommand({
      PasswordLength: 24,
      ExcludePunctuation: true,
      ExcludeUppercase: true,
    }),
  );
  expect(generated.RandomPassword).toBeDefined();
  expect(generated.RandomPassword?.length).toBe(24);
  expect(generated.RandomPassword).toMatch(/^[a-z0-9]+$/);

  const second = await client.send(new GetRandomPasswordCommand({}));
  expect(second.RandomPassword?.length).toBe(32);
  expect(second.RandomPassword).not.toBe(generated.RandomPassword);
});

test("Secrets Manager Tag and Untag a secret", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-tags";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "tag-value" }),
  );

  await client.send(
    new TagResourceCommand({
      SecretId: name,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  await client.send(
    new UntagResourceCommand({ SecretId: name, TagKeys: ["team"] }),
  );

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager ListSecretVersionIds returns versions", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-versions";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "version-value" }),
  );

  const listed = await client.send(
    new ListSecretVersionIdsCommand({ SecretId: name }),
  );
  expect(listed.ARN).toBe(created.ARN);
  expect(listed.Name).toBe(name);
  expect(listed.Versions?.length).toBeGreaterThanOrEqual(1);
  expect(
    listed.Versions?.some((version) => version.VersionId === created.VersionId),
  ).toBe(true);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("Secrets Manager RestoreSecret cancels deletion", async () => {
  const client = sm();
  const name = "bunsai-e2e-ops-restore";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "restore-value" }),
  );

  await client.send(new DeleteSecretCommand({ SecretId: name }));

  const restored = await client.send(
    new RestoreSecretCommand({ SecretId: name }),
  );
  expect(restored.ARN).toBe(created.ARN);
  expect(restored.Name).toBe(name);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});
