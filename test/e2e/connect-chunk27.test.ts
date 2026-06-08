import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateUserCommand,
  CreateUserHierarchyGroupCommand,
  CreateViewCommand,
  DescribeUserCommand,
  DescribeUserHierarchyGroupCommand,
  DescribeViewCommand,
  UpdateUserHierarchyGroupNameCommand,
  UpdateUserIdentityInfoCommand,
  UpdateUserPhoneConfigCommand,
  UpdateUserRoutingProfileCommand,
  UpdateUserSecurityProfilesCommand,
  UpdateViewContentCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("chunk27: user update ops mutate DescribeUser; view update reflects in DescribeView", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk27-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = inst.Id!;
  expect(instanceId).toBeDefined();

  const user = await client.send(
    new CreateUserCommand({
      InstanceId: instanceId,
      Username: "chunk27.user",
      SecurityProfileIds: [crypto.randomUUID()],
      RoutingProfileId: crypto.randomUUID(),
      PhoneConfig: { PhoneType: "SOFT_PHONE" },
    }),
  );
  const userId = user.UserId!;
  expect(userId).toBeDefined();

  await client.send(
    new UpdateUserPhoneConfigCommand({
      InstanceId: instanceId,
      UserId: userId,
      PhoneConfig: { PhoneType: "DESK_PHONE", DeskPhoneNumber: "+15555550100" },
    }),
  );
  const desc1 = await client.send(
    new DescribeUserCommand({ InstanceId: instanceId, UserId: userId }),
  );
  expect((desc1.User?.PhoneConfig as { PhoneType?: string })?.PhoneType).toBe(
    "DESK_PHONE",
  );

  await client.send(
    new UpdateUserIdentityInfoCommand({
      InstanceId: instanceId,
      UserId: userId,
      IdentityInfo: { FirstName: "Jane", LastName: "Doe" },
    }),
  );
  const desc2 = await client.send(
    new DescribeUserCommand({ InstanceId: instanceId, UserId: userId }),
  );
  expect((desc2.User?.IdentityInfo as { FirstName?: string })?.FirstName).toBe(
    "Jane",
  );

  const newRoutingProfileId = crypto.randomUUID();
  await client.send(
    new UpdateUserRoutingProfileCommand({
      InstanceId: instanceId,
      UserId: userId,
      RoutingProfileId: newRoutingProfileId,
    }),
  );
  const desc3 = await client.send(
    new DescribeUserCommand({ InstanceId: instanceId, UserId: userId }),
  );
  expect(desc3.User?.RoutingProfileId).toBe(newRoutingProfileId);

  const spId1 = crypto.randomUUID();
  const spId2 = crypto.randomUUID();
  await client.send(
    new UpdateUserSecurityProfilesCommand({
      InstanceId: instanceId,
      UserId: userId,
      SecurityProfileIds: [spId1, spId2],
    }),
  );
  const desc4 = await client.send(
    new DescribeUserCommand({ InstanceId: instanceId, UserId: userId }),
  );
  expect(desc4.User?.SecurityProfileIds).toEqual([spId1, spId2]);

  const hg = await client.send(
    new CreateUserHierarchyGroupCommand({
      InstanceId: instanceId,
      Name: "group-original",
    }),
  );
  const hgId = hg.HierarchyGroupId!;

  await client.send(
    new UpdateUserHierarchyGroupNameCommand({
      InstanceId: instanceId,
      HierarchyGroupId: hgId,
      Name: "group-updated",
    }),
  );
  const hgDesc = await client.send(
    new DescribeUserHierarchyGroupCommand({
      InstanceId: instanceId,
      HierarchyGroupId: hgId,
    }),
  );
  expect(hgDesc.HierarchyGroup?.Name).toBe("group-updated");

  const view = await client.send(
    new CreateViewCommand({
      InstanceId: instanceId,
      Name: "MyView",
      Status: "SAVED",
      Content: { Template: "{}" },
    }),
  );
  const viewId = view.View?.Id!;
  expect(viewId).toBeDefined();

  await client.send(
    new UpdateViewContentCommand({
      InstanceId: instanceId,
      ViewId: viewId,
      Status: "PUBLISHED",
      Content: { Template: '{"key":"value"}' },
    }),
  );
  const vDesc = await client.send(
    new DescribeViewCommand({ InstanceId: instanceId, ViewId: viewId }),
  );
  expect(vDesc.View?.Status).toBe("PUBLISHED");
  expect(
    (vDesc.View?.Content as { Template?: string } | undefined)?.Template,
  ).toBe('{"key":"value"}');
});
