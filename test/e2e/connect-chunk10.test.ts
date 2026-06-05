import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  DeleteInstanceCommand,
  CreateUserCommand,
  DescribeUserCommand,
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
