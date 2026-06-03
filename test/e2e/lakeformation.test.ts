import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeregisterResourceCommand,
  DescribeResourceCommand,
  LakeFormationClient,
  ListResourcesCommand,
  RegisterResourceCommand,
} from "@aws-sdk/client-lakeformation";

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

const lakeformation = () =>
  new LakeFormationClient({ endpoint, region, credentials });

test("LakeFormation resource roundtrip", async () => {
  const client = lakeformation();
  const resourceArn = `arn:aws:s3:::bunsai-e2e-${Date.now()}`;

  await client.send(new RegisterResourceCommand({ ResourceArn: resourceArn }));

  const described = await client.send(
    new DescribeResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(described.ResourceInfo?.ResourceArn).toBe(resourceArn);

  const listed = await client.send(new ListResourcesCommand({}));
  expect(
    (listed.ResourceInfoList ?? []).map((info) => info.ResourceArn),
  ).toContain(resourceArn);

  await client.send(
    new DeregisterResourceCommand({ ResourceArn: resourceArn }),
  );

  await expect(
    client.send(new DescribeResourceCommand({ ResourceArn: resourceArn })),
  ).rejects.toThrow();
});
