import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateUserCommand,
  DeleteUserCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("User create and delete lifecycle", async () => {
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
        DeskPhoneNumber: "",
      },
      RoutingProfileId: "00000000-0000-0000-0000-000000000000",
      SecurityProfileIds: [],
    }),
  );
  expect(createdUser.UserId).toBeDefined();
  expect(createdUser.UserArn).toBeDefined();
  expect(createdUser.UserArn).toContain("agent");
  const userId = createdUser.UserId ?? "";

  await expect(
    client.send(
      new DeleteUserCommand({ InstanceId: instanceId, UserId: userId }),
    ),
  ).resolves.toBeDefined();

  await expect(
    client.send(
      new DeleteUserCommand({ InstanceId: instanceId, UserId: userId }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteInstanceCommand({ InstanceId: instanceId }));
});
