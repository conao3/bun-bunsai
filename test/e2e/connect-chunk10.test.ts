import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateUserCommand,
  DescribeUserCommand,
  DeleteUserCommand,
} from "@aws-sdk/client-connect";

const awsPort = 4570;
const uiPort = 5670;
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

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("User create and describe lifecycle", async () => {
  const client = connect();

  const createdInstance = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-user-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  expect(createdInstance.Id).toBeDefined();
  expect(createdInstance.Arn).toBeDefined();
  const instanceId = createdInstance.Id ?? "";

  const createdUser = await client.send(
    new CreateUserCommand({
      InstanceId: instanceId,
      Username: "test-user",
      PhoneConfig: {
        PhoneType: "SOFT_PHONE",
        AutoAccept: false,
        AfterContactWorkTimeLimit: 0,
        DeskPhoneNumber: undefined,
      },
      RoutingProfileId: "00000000-0000-0000-0000-000000000000",
      SecurityProfileIds: ["00000000-0000-0000-0000-000000000000"],
    }),
  );
  expect(createdUser.UserId).toBeDefined();
  expect(createdUser.UserArn).toBeDefined();
  expect(createdUser.UserArn).toContain("agent");
  const userId = createdUser.UserId ?? "";

  const describedUser = await client.send(
    new DescribeUserCommand({
      InstanceId: instanceId,
      UserId: userId,
    }),
  );
  expect(describedUser.User).toBeDefined();
  expect(describedUser.User?.Id).toBe(userId);
  expect(describedUser.User?.Arn).toBe(createdUser.UserArn);
  expect(describedUser.User?.Username).toBe("test-user");

  await client.send(
    new DeleteUserCommand({
      InstanceId: instanceId,
      UserId: userId,
    }),
  );

  await expect(
    client.send(
      new DescribeUserCommand({
        InstanceId: instanceId,
        UserId: userId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
