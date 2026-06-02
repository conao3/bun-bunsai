import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  ListSecretsCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
  UpdateSecretCommand,
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

test("Secrets Manager secret lifecycle", async () => {
  const client = sm();
  const name = "bunsai-e2e-secret";
  const initial = "initial-secret-value";
  const updated = "updated-secret-value";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: initial }),
  );
  expect(created.ARN).toBeDefined();
  expect(created.Name).toBe(name);
  expect(created.VersionId).toBeDefined();

  const got = await client.send(new GetSecretValueCommand({ SecretId: name }));
  expect(got.SecretString).toBe(initial);
  expect(got.ARN).toBe(created.ARN);
  expect(got.VersionStages).toContain("AWSCURRENT");

  const put = await client.send(
    new PutSecretValueCommand({ SecretId: name, SecretString: updated }),
  );
  expect(put.VersionId).toBeDefined();
  expect(put.VersionId).not.toBe(created.VersionId);

  const afterPut = await client.send(
    new GetSecretValueCommand({ SecretId: name }),
  );
  expect(afterPut.SecretString).toBe(updated);

  const described = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(described.Name).toBe(name);
  expect(described.ARN).toBe(created.ARN);

  const listed = await client.send(new ListSecretsCommand({}));
  const names = (listed.SecretList ?? []).map((entry) => entry.Name);
  expect(names).toContain(name);

  const updatedResult = await client.send(
    new UpdateSecretCommand({
      SecretId: name,
      Description: "bunsai e2e description",
    }),
  );
  expect(updatedResult.ARN).toBe(created.ARN);

  const reDescribed = await client.send(
    new DescribeSecretCommand({ SecretId: name }),
  );
  expect(reDescribed.Description).toBe("bunsai e2e description");

  const deleted = await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
  expect(deleted.ARN).toBe(created.ARN);

  await expect(
    client.send(new GetSecretValueCommand({ SecretId: name })),
  ).rejects.toThrow();
});
