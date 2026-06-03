import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateProtectionCommand,
  DeleteProtectionCommand,
  DescribeProtectionCommand,
  ListProtectionsCommand,
  ShieldClient,
} from "@aws-sdk/client-shield";
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

const shield = () =>
  new ShieldClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Shield protection lifecycle", async () => {
  const client = shield();
  const resourceArn = `arn:aws:cloudfront::000000000000:distribution/E1BUNSAI`;

  const created = await client.send(
    new CreateProtectionCommand({
      Name: "bunsai-e2e-protection",
      ResourceArn: resourceArn,
    }),
  );
  expect(typeof created.ProtectionId).toBe("string");
  const protectionId = created.ProtectionId ?? "";

  const described = await client.send(
    new DescribeProtectionCommand({ ProtectionId: protectionId }),
  );
  expect(described.Protection?.Id).toBe(protectionId);
  expect(described.Protection?.Name).toBe("bunsai-e2e-protection");
  expect(described.Protection?.ResourceArn).toBe(resourceArn);
  expect(described.Protection?.ProtectionArn).toContain(protectionId);

  const listed = await client.send(new ListProtectionsCommand({}));
  expect((listed.Protections ?? []).some((p) => p.Id === protectionId)).toBe(
    true,
  );

  await client.send(
    new DeleteProtectionCommand({ ProtectionId: protectionId }),
  );

  await expect(
    client.send(new DescribeProtectionCommand({ ProtectionId: protectionId })),
  ).rejects.toThrow();
});
