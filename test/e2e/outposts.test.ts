import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateOutpostCommand,
  DeleteOutpostCommand,
  GetOutpostCommand,
  ListOutpostsCommand,
  OutpostsClient,
} from "@aws-sdk/client-outposts";

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

const outposts = () => new OutpostsClient({ endpoint, region, credentials });

test("Outposts outpost roundtrip", async () => {
  const client = outposts();
  const name = `bunsai_e2e_${Date.now()}`;
  const siteId = "os-1234567890abcdef0";

  const created = await client.send(
    new CreateOutpostCommand({ Name: name, SiteId: siteId }),
  );
  const id = created.Outpost?.OutpostId;
  expect(typeof id).toBe("string");
  expect(created.Outpost?.Name).toBe(name);
  expect(created.Outpost?.SiteId).toBe(siteId);
  expect(created.Outpost?.OutpostArn).toContain(`outpost/${id}`);

  const got = await client.send(
    new GetOutpostCommand({ OutpostId: id as string }),
  );
  expect(got.Outpost?.OutpostId).toBe(id);
  expect(got.Outpost?.Name).toBe(name);
  expect(got.Outpost?.LifeCycleStatus).toBe("ACTIVE");

  const listed = await client.send(new ListOutpostsCommand({}));
  expect((listed.Outposts ?? []).map((o) => o.OutpostId)).toContain(id);

  await client.send(new DeleteOutpostCommand({ OutpostId: id as string }));
  await expect(
    client.send(new GetOutpostCommand({ OutpostId: id as string })),
  ).rejects.toThrow();
});
