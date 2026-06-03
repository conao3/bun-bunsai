import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateResourceShareCommand,
  DeleteResourceShareCommand,
  GetResourceSharesCommand,
  RAMClient,
  UpdateResourceShareCommand,
} from "@aws-sdk/client-ram";

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

const ram = () => new RAMClient({ endpoint, region, credentials });

test("RAM resource share roundtrip", async () => {
  const client = ram();
  const name = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(new CreateResourceShareCommand({ name }));
  const arn = created.resourceShare?.resourceShareArn;
  expect(arn).toContain("resource-share/");
  expect(created.resourceShare?.name).toBe(name);
  expect(created.resourceShare?.status).toBe("ACTIVE");

  const got = await client.send(
    new GetResourceSharesCommand({ resourceOwner: "SELF" }),
  );
  const found = (got.resourceShares ?? []).find(
    (share) => share.resourceShareArn === arn,
  );
  expect(found?.name).toBe(name);
  expect(found?.status).toBe("ACTIVE");

  const renamed = `${name}_v2`;
  const updated = await client.send(
    new UpdateResourceShareCommand({
      resourceShareArn: arn,
      name: renamed,
    }),
  );
  expect(updated.resourceShare?.name).toBe(renamed);
  expect(updated.resourceShare?.status).toBe("ACTIVE");

  const deleted = await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: arn }),
  );
  expect(deleted.returnValue).toBe(true);

  const afterDelete = await client.send(
    new GetResourceSharesCommand({ resourceOwner: "SELF" }),
  );
  expect(
    (afterDelete.resourceShares ?? []).map((share) => share.resourceShareArn),
  ).not.toContain(arn);
});
