import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AssumeRoleCommand,
  GetFederationTokenCommand,
  GetSessionTokenCommand,
  STSClient,
} from "@aws-sdk/client-sts";

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

const sts = () => new STSClient({ endpoint, region, credentials });

test("STS AssumeRole returns Credentials and AssumedRoleUser", async () => {
  const client = sts();
  const out = await client.send(
    new AssumeRoleCommand({
      RoleArn: "arn:aws:iam::000000000000:role/bunsai-e2e",
      RoleSessionName: "bunsai-e2e-session",
    }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
  expect(out.AssumedRoleUser?.Arn).toContain(
    "assumed-role/bunsai-e2e/bunsai-e2e-session",
  );
  expect(out.AssumedRoleUser?.AssumedRoleId).toContain("bunsai-e2e-session");
});

test("STS GetSessionToken returns Credentials", async () => {
  const client = sts();
  const out = await client.send(
    new GetSessionTokenCommand({ DurationSeconds: 3600 }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.Credentials?.SecretAccessKey).toBeDefined();
  expect(out.Credentials?.SessionToken).toBeDefined();
  expect(out.Credentials?.Expiration).toBeInstanceOf(Date);
});

test("STS GetFederationToken returns Credentials and FederatedUser", async () => {
  const client = sts();
  const out = await client.send(
    new GetFederationTokenCommand({ Name: "bunsai-e2e-user" }),
  );
  expect(out.Credentials?.AccessKeyId).toBeDefined();
  expect(out.FederatedUser?.Arn).toContain("federated-user/bunsai-e2e-user");
  expect(out.FederatedUser?.FederatedUserId).toContain("bunsai-e2e-user");
});
