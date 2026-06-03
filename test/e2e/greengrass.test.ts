import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateGroupCommand,
  DeleteGroupCommand,
  GetGroupCommand,
  GreengrassClient,
  ListGroupsCommand,
} from "@aws-sdk/client-greengrass";

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

const greengrass = () =>
  new GreengrassClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Greengrass group roundtrip", async () => {
  const client = greengrass();
  const name = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(new CreateGroupCommand({ Name: name }));
  const groupId = created.Id;
  expect(groupId).toBeDefined();
  expect(created.Name).toBe(name);
  expect(created.Arn).toContain(`groups/${groupId}`);

  const got = await client.send(new GetGroupCommand({ GroupId: groupId }));
  expect(got.Id).toBe(groupId);
  expect(got.Name).toBe(name);

  const listed = await client.send(new ListGroupsCommand({}));
  expect((listed.Groups ?? []).map((g) => g.Id)).toContain(groupId);

  await client.send(new DeleteGroupCommand({ GroupId: groupId }));

  await expect(
    client.send(new GetGroupCommand({ GroupId: groupId })),
  ).rejects.toThrow();
});
