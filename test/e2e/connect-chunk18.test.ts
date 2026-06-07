import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateUserCommand,
  CreateUserHierarchyGroupCommand,
  CreateViewCommand,
  ListUserHierarchyGroupsCommand,
  ListUsersCommand,
  ListViewsCommand,
  ListWorkspaceMediaCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const connect = () =>
  new ConnectClient({ endpoint, region, credentials, requestHandler });

test("ListUsers returns created user; ListViews returns created view; ListUserHierarchyGroups returns created group; empty list assertions", async () => {
  const client = connect();

  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk18-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: false,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const emptyUsers = await client.send(
    new ListUsersCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyUsers.UserSummaryList)).toBe(true);
  expect(emptyUsers.UserSummaryList?.length).toBe(0);

  const createdUser = await client.send(
    new CreateUserCommand({
      InstanceId: instanceId,
      Username: "testuser",
      PhoneConfig: { PhoneType: "SOFT_PHONE" },
      SecurityProfileIds: [],
      RoutingProfileId: "routing-profile-1",
    }),
  );
  expect(createdUser.UserId).toBeTruthy();

  const listedUsers = await client.send(
    new ListUsersCommand({ InstanceId: instanceId }),
  );
  expect(listedUsers.UserSummaryList?.length).toBe(1);
  expect(listedUsers.UserSummaryList?.[0]?.Id).toBe(createdUser.UserId);

  const emptyViews = await client.send(
    new ListViewsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyViews.ViewsSummaryList)).toBe(true);
  expect(emptyViews.ViewsSummaryList?.length).toBe(0);

  const createdView = await client.send(
    new CreateViewCommand({
      InstanceId: instanceId,
      Name: "test-view",
      Status: "SAVED",
      Content: { Template: "{}" },
    }),
  );
  expect(createdView.View?.Id).toBeTruthy();

  const listedViews = await client.send(
    new ListViewsCommand({ InstanceId: instanceId }),
  );
  expect(listedViews.ViewsSummaryList?.length).toBe(1);
  expect(listedViews.ViewsSummaryList?.[0]?.Id).toBe(createdView.View?.Id);

  const emptyGroups = await client.send(
    new ListUserHierarchyGroupsCommand({ InstanceId: instanceId }),
  );
  expect(Array.isArray(emptyGroups.UserHierarchyGroupSummaryList)).toBe(true);
  expect(emptyGroups.UserHierarchyGroupSummaryList?.length).toBe(0);

  const createdGroup = await client.send(
    new CreateUserHierarchyGroupCommand({
      InstanceId: instanceId,
      Name: "test-group",
    }),
  );
  expect(createdGroup.HierarchyGroupId).toBeTruthy();

  const listedGroups = await client.send(
    new ListUserHierarchyGroupsCommand({ InstanceId: instanceId }),
  );
  expect(listedGroups.UserHierarchyGroupSummaryList?.length).toBe(1);
  expect(listedGroups.UserHierarchyGroupSummaryList?.[0]?.Id).toBe(
    createdGroup.HierarchyGroupId,
  );

  const emptyMedia = await client.send(
    new ListWorkspaceMediaCommand({
      InstanceId: instanceId,
      WorkspaceId: "workspace-1",
    }),
  );
  expect(Array.isArray(emptyMedia.Media)).toBe(true);
  expect(emptyMedia.Media?.length).toBe(0);
});
