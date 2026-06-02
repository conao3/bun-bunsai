import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateServerCommand,
  CreateUserCommand,
  DeleteServerCommand,
  DescribeServerCommand,
  DescribeUserCommand,
  ListServersCommand,
  ListUsersCommand,
  TransferClient,
} from "@aws-sdk/client-transfer";

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

const client = () => new TransferClient({ endpoint, region, credentials });

test("transfer server and user round-trip", async () => {
  const transfer = client();

  const created = await transfer.send(new CreateServerCommand({}));
  const serverId = created.ServerId;
  expect(serverId).toMatch(/^s-[0-9a-f]{17}$/);

  const described = await transfer.send(
    new DescribeServerCommand({ ServerId: serverId }),
  );
  expect(described.Server?.ServerId).toBe(serverId);
  expect(described.Server?.State).toBe("ONLINE");
  expect(described.Server?.Arn).toContain(`:server/${serverId}`);

  const listedServers = await transfer.send(new ListServersCommand({}));
  const serverIds = (listedServers.Servers ?? []).map(
    (entry) => entry.ServerId,
  );
  expect(serverIds).toContain(serverId);

  const userName = "bunsai-e2e-user";
  const createdUser = await transfer.send(
    new CreateUserCommand({
      ServerId: serverId,
      UserName: userName,
      Role: "arn:aws:iam::000000000000:role/transfer-role",
      HomeDirectory: "/bucket/home",
    }),
  );
  expect(createdUser.ServerId).toBe(serverId);
  expect(createdUser.UserName).toBe(userName);

  const describedUser = await transfer.send(
    new DescribeUserCommand({ ServerId: serverId, UserName: userName }),
  );
  expect(describedUser.ServerId).toBe(serverId);
  expect(describedUser.User?.UserName).toBe(userName);
  expect(describedUser.User?.HomeDirectory).toBe("/bucket/home");

  const listedUsers = await transfer.send(
    new ListUsersCommand({ ServerId: serverId }),
  );
  const userNames = (listedUsers.Users ?? []).map((entry) => entry.UserName);
  expect(userNames).toContain(userName);

  await transfer.send(new DeleteServerCommand({ ServerId: serverId }));

  await expect(
    transfer.send(new DescribeServerCommand({ ServerId: serverId })),
  ).rejects.toThrow();
});
