import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetRandomPasswordCommand,
  GetSecretValueCommand,
  ListSecretVersionIdsCommand,
  PutSecretValueCommand,
  RestoreSecretCommand,
  SecretsManagerClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateSecretVersionStageCommand,
} from "@aws-sdk/client-secrets-manager";

const awsPort = 4567;
const uiPort = 5667;
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

test("TagResource and UntagResource", async () => {
  const client = sm();
  const name = "tagging-test-secret";

  await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "value" }),
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
    new TagResourceCommand({
      SecretId: name,
      Tags: [{ Key: "env", Value: "production" }],
    }),
  );

  await client.send(
    new UntagResourceCommand({
      SecretId: name,
      TagKeys: ["team"],
    }),
  );

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("RestoreSecret", async () => {
  const client = sm();
  const name = "restore-test-secret";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "restore-me" }),
  );

  await client.send(new DeleteSecretCommand({ SecretId: name }));

  const restored = await client.send(
    new RestoreSecretCommand({ SecretId: name }),
  );
  expect(restored.ARN).toBe(created.ARN);
  expect(restored.Name).toBe(name);

  const got = await client.send(new GetSecretValueCommand({ SecretId: name }));
  expect(got.SecretString).toBe("restore-me");

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("GetRandomPassword", async () => {
  const client = sm();

  const result = await client.send(new GetRandomPasswordCommand({}));
  expect(typeof result.RandomPassword).toBe("string");
  expect(result.RandomPassword!.length).toBe(32);

  const custom = await client.send(
    new GetRandomPasswordCommand({ PasswordLength: 16 }),
  );
  expect(custom.RandomPassword!.length).toBe(16);

  const noDigits = await client.send(
    new GetRandomPasswordCommand({ ExcludeNumbers: true }),
  );
  expect(noDigits.RandomPassword).not.toMatch(/[0-9]/);
});

test("ListSecretVersionIds", async () => {
  const client = sm();
  const name = "versions-test-secret";

  const created = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "v1" }),
  );

  await client.send(
    new PutSecretValueCommand({ SecretId: name, SecretString: "v2" }),
  );

  const listed = await client.send(
    new ListSecretVersionIdsCommand({
      SecretId: name,
      IncludeDeprecated: true,
    }),
  );
  expect(listed.ARN).toBe(created.ARN);
  expect(listed.Name).toBe(name);
  expect(listed.Versions!.length).toBeGreaterThanOrEqual(2);
  const versionIds = listed.Versions!.map((v) => v.VersionId);
  expect(versionIds).toContain(created.VersionId);

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});

test("UpdateSecretVersionStage", async () => {
  const client = sm();
  const name = "stage-test-secret";

  const v1 = await client.send(
    new CreateSecretCommand({ Name: name, SecretString: "v1" }),
  );

  const v2 = await client.send(
    new PutSecretValueCommand({ SecretId: name, SecretString: "v2" }),
  );

  const result = await client.send(
    new UpdateSecretVersionStageCommand({
      SecretId: name,
      VersionStage: "AWSCURRENT",
      RemoveFromVersionId: v2.VersionId,
      MoveToVersionId: v1.VersionId,
    }),
  );
  expect(result.ARN).toBeDefined();
  expect(result.Name).toBe(name);

  const got = await client.send(new GetSecretValueCommand({ SecretId: name }));
  expect(got.SecretString).toBe("v1");

  await client.send(
    new DeleteSecretCommand({
      SecretId: name,
      ForceDeleteWithoutRecovery: true,
    }),
  );
});
