import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptAccountLinkInvitationCommand,
  AssociateConnectionAliasCommand,
  AssociateIpGroupsCommand,
  AuthorizeIpRulesCommand,
  CreateAccountLinkInvitationCommand,
  CreateConnectClientAddInCommand,
  CreateConnectionAliasCommand,
  CreateIpGroupCommand,
  CreateTagsCommand,
  CreateWorkspaceBundleCommand,
  CreateWorkspaceImageCommand,
  CreateWorkspacesCommand,
  CreateWorkspacesPoolCommand,
  DeleteTagsCommand,
  DeleteWorkspaceBundleCommand,
  DeregisterWorkspaceDirectoryCommand,
  DescribeAccountCommand,
  DescribeClientBrandingCommand,
  DescribeConnectClientAddInsCommand,
  DescribeConnectionAliasesCommand,
  DescribeIpGroupsCommand,
  DescribeTagsCommand,
  DescribeWorkspaceBundlesCommand,
  DescribeWorkspaceDirectoriesCommand,
  DescribeWorkspaceImagesCommand,
  DescribeWorkspacesCommand,
  DescribeWorkspacesConnectionStatusCommand,
  DescribeWorkspacesPoolsCommand,
  DisassociateConnectionAliasCommand,
  GetAccountLinkCommand,
  ImportClientBrandingCommand,
  ListAccountLinksCommand,
  ModifyWorkspacePropertiesCommand,
  RebootWorkspacesCommand,
  RegisterWorkspaceDirectoryCommand,
  StartWorkspacesCommand,
  StartWorkspacesPoolCommand,
  StopWorkspacesCommand,
  StopWorkspacesPoolCommand,
  TerminateWorkspacesCommand,
  TerminateWorkspacesPoolCommand,
  UpdateConnectClientAddInCommand,
  UpdateWorkspaceBundleCommand,
  WorkSpacesClient,
} from "@aws-sdk/client-workspaces";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const workspaces = () =>
  new WorkSpacesClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("WorkSpaces lifecycle", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        {
          DirectoryId: "d-1234567890",
          UserName: "bunsai-user",
          BundleId: "wsb-bunsai01",
        },
      ],
    }),
  );
  expect(created.FailedRequests?.length).toBe(0);
  const workspaceId = created.PendingRequests?.[0]?.WorkspaceId;
  expect(workspaceId).toBeDefined();
  expect(created.PendingRequests?.[0]?.State).toBe("PENDING");

  const described = await client.send(
    new DescribeWorkspacesCommand({
      WorkspaceIds: [workspaceId as string],
    }),
  );
  expect(described.Workspaces?.[0]?.WorkspaceId).toBe(workspaceId);
  expect(described.Workspaces?.[0]?.State).toBe("AVAILABLE");

  await client.send(
    new CreateTagsCommand({
      ResourceId: workspaceId as string,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const tags = await client.send(
    new DescribeTagsCommand({ ResourceId: workspaceId as string }),
  );
  expect(tags.TagList?.some((tag) => tag.Key === "env")).toBe(true);

  const terminated = await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [{ WorkspaceId: workspaceId as string }],
    }),
  );
  expect(terminated.FailedRequests?.length).toBe(0);

  const afterTerminate = await client.send(new DescribeWorkspacesCommand({}));
  expect(
    (afterTerminate.Workspaces ?? []).some(
      (w) => w.WorkspaceId === workspaceId,
    ),
  ).toBe(false);
});

test("WorkSpaces workspace start/stop/reboot", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        {
          DirectoryId: "d-lifecycle",
          UserName: "lc-user",
          BundleId: "wsb-lc01",
        },
      ],
    }),
  );
  const wsId = created.PendingRequests?.[0]?.WorkspaceId as string;

  const stopped = await client.send(
    new StopWorkspacesCommand({
      StopWorkspaceRequests: [{ WorkspaceId: wsId }],
    }),
  );
  expect(stopped.FailedRequests?.length).toBe(0);

  const afterStop = await client.send(
    new DescribeWorkspacesCommand({ WorkspaceIds: [wsId] }),
  );
  expect(afterStop.Workspaces?.[0]?.State).toBe("STOPPED");

  const started = await client.send(
    new StartWorkspacesCommand({
      StartWorkspaceRequests: [{ WorkspaceId: wsId }],
    }),
  );
  expect(started.FailedRequests?.length).toBe(0);

  const afterStart = await client.send(
    new DescribeWorkspacesCommand({ WorkspaceIds: [wsId] }),
  );
  expect(afterStart.Workspaces?.[0]?.State).toBe("AVAILABLE");

  const rebooted = await client.send(
    new RebootWorkspacesCommand({
      RebootWorkspaceRequests: [{ WorkspaceId: wsId }],
    }),
  );
  expect(rebooted.FailedRequests?.length).toBe(0);

  const connStatus = await client.send(
    new DescribeWorkspacesConnectionStatusCommand({ WorkspaceIds: [wsId] }),
  );
  expect(connStatus.WorkspacesConnectionStatus?.length).toBeGreaterThan(0);

  await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [{ WorkspaceId: wsId }],
    }),
  );
});

test("WorkSpaces directory register/describe/deregister", async () => {
  const client = workspaces();

  const registered = await client.send(
    new RegisterWorkspaceDirectoryCommand({
      DirectoryId: "d-testdir001",
      SubnetIds: ["subnet-aaa", "subnet-bbb"],
      WorkspaceDirectoryName: "TestDir",
    }),
  );
  expect(registered.DirectoryId).toBe("d-testdir001");
  expect(registered.State).toBe("REGISTERED");

  const described = await client.send(
    new DescribeWorkspaceDirectoriesCommand({ DirectoryIds: ["d-testdir001"] }),
  );
  expect(described.Directories?.length).toBe(1);
  expect(described.Directories?.[0]?.DirectoryId).toBe("d-testdir001");

  await client.send(
    new DeregisterWorkspaceDirectoryCommand({ DirectoryId: "d-testdir001" }),
  );

  const afterDereg = await client.send(
    new DescribeWorkspaceDirectoriesCommand({ DirectoryIds: ["d-testdir001"] }),
  );
  expect(afterDereg.Directories?.length).toBe(0);
});

test("WorkSpaces bundle create/describe/update/delete", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateWorkspaceBundleCommand({
      BundleName: "TestBundle",
      BundleDescription: "A test bundle",
      ImageId: "wsi-test001",
      ComputeType: { Name: "VALUE" },
      UserStorage: { Capacity: "50" },
      RootStorage: { Capacity: "80" },
    }),
  );
  expect(created.WorkspaceBundle?.BundleId).toBeDefined();
  const bundleId = created.WorkspaceBundle?.BundleId as string;

  const described = await client.send(
    new DescribeWorkspaceBundlesCommand({ BundleIds: [bundleId] }),
  );
  expect(described.Bundles?.length).toBe(1);
  expect(described.Bundles?.[0]?.Name).toBe("TestBundle");

  await client.send(
    new UpdateWorkspaceBundleCommand({
      BundleId: bundleId,
      ImageId: "wsi-test002",
    }),
  );

  await client.send(new DeleteWorkspaceBundleCommand({ BundleId: bundleId }));

  const afterDelete = await client.send(
    new DescribeWorkspaceBundlesCommand({ BundleIds: [bundleId] }),
  );
  expect(afterDelete.Bundles?.length).toBe(0);
});

test("WorkSpaces image create/describe", async () => {
  const client = workspaces();

  const wsCreated = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        {
          DirectoryId: "d-img001",
          UserName: "img-user",
          BundleId: "wsb-img01",
        },
      ],
    }),
  );
  const wsId = wsCreated.PendingRequests?.[0]?.WorkspaceId as string;

  const created = await client.send(
    new CreateWorkspaceImageCommand({
      Name: "TestImage",
      Description: "A test image",
      WorkspaceId: wsId,
    }),
  );
  expect(created.ImageId).toBeDefined();
  expect(created.State).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeWorkspaceImagesCommand({
      ImageIds: [created.ImageId as string],
    }),
  );
  expect(described.Images?.length).toBe(1);
  expect(described.Images?.[0]?.Name).toBe("TestImage");

  await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [{ WorkspaceId: wsId }],
    }),
  );
});

test("WorkSpaces ip-group create/authorize/describe/delete", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateIpGroupCommand({
      GroupName: "TestGroup",
      GroupDesc: "A test ip group",
      UserRules: [{ ipRule: "10.0.0.0/8", ruleDesc: "internal" }],
    }),
  );
  expect(created.GroupId).toBeDefined();
  const groupId = created.GroupId as string;

  await client.send(
    new AuthorizeIpRulesCommand({
      GroupId: groupId,
      UserRules: [{ ipRule: "192.168.0.0/16", ruleDesc: "corp" }],
    }),
  );

  const described = await client.send(
    new DescribeIpGroupsCommand({ GroupIds: [groupId] }),
  );
  expect(described.Result?.length).toBe(1);
  expect(described.Result?.[0]?.userRules?.length).toBe(2);

  const registered = await client.send(
    new RegisterWorkspaceDirectoryCommand({
      DirectoryId: "d-iptest001",
      SubnetIds: ["subnet-ccc"],
    }),
  );
  expect(registered.State).toBe("REGISTERED");

  await client.send(
    new AssociateIpGroupsCommand({
      DirectoryId: "d-iptest001",
      GroupIds: [groupId],
    }),
  );

  const dirAfterAssoc = await client.send(
    new DescribeWorkspaceDirectoriesCommand({ DirectoryIds: ["d-iptest001"] }),
  );
  expect(dirAfterAssoc.Directories?.[0]?.ipGroupIds).toContain(groupId);

  await client.send(
    new DeregisterWorkspaceDirectoryCommand({ DirectoryId: "d-iptest001" }),
  );
});

test("WorkSpaces connection-alias create/associate/describe/delete", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateConnectionAliasCommand({ ConnectionString: "test.example.com" }),
  );
  expect(created.AliasId).toBeDefined();
  const aliasId = created.AliasId as string;

  await client.send(
    new RegisterWorkspaceDirectoryCommand({
      DirectoryId: "d-alias001",
      SubnetIds: ["subnet-ddd"],
    }),
  );

  const assoc = await client.send(
    new AssociateConnectionAliasCommand({
      AliasId: aliasId,
      ResourceId: "d-alias001",
    }),
  );
  expect(assoc.ConnectionIdentifier).toBeDefined();

  const described = await client.send(
    new DescribeConnectionAliasesCommand({ AliasIds: [aliasId] }),
  );
  expect(described.ConnectionAliases?.length).toBe(1);
  expect(described.ConnectionAliases?.[0]?.Associations?.length).toBe(1);

  await client.send(
    new DisassociateConnectionAliasCommand({ AliasId: aliasId }),
  );

  const afterDisassoc = await client.send(
    new DescribeConnectionAliasesCommand({ AliasIds: [aliasId] }),
  );
  expect(afterDisassoc.ConnectionAliases?.[0]?.Associations?.length).toBe(0);

  await client.send(
    new DeregisterWorkspaceDirectoryCommand({ DirectoryId: "d-alias001" }),
  );
});

test("WorkSpaces connect-client-add-in create/describe/update/delete", async () => {
  const client = workspaces();

  await client.send(
    new RegisterWorkspaceDirectoryCommand({
      DirectoryId: "d-addon001",
      SubnetIds: ["subnet-eee"],
    }),
  );

  const created = await client.send(
    new CreateConnectClientAddInCommand({
      ResourceId: "d-addon001",
      Name: "TestAddIn",
      URL: "https://connect.example.com",
    }),
  );
  expect(created.AddInId).toBeDefined();
  const addInId = created.AddInId as string;

  const described = await client.send(
    new DescribeConnectClientAddInsCommand({ ResourceId: "d-addon001" }),
  );
  expect(described.AddIns?.length).toBe(1);
  expect(described.AddIns?.[0]?.Name).toBe("TestAddIn");

  await client.send(
    new UpdateConnectClientAddInCommand({
      AddInId: addInId,
      ResourceId: "d-addon001",
      Name: "UpdatedAddIn",
    }),
  );

  const afterUpdate = await client.send(
    new DescribeConnectClientAddInsCommand({ ResourceId: "d-addon001" }),
  );
  expect(afterUpdate.AddIns?.[0]?.Name).toBe("UpdatedAddIn");

  await client.send(
    new DeregisterWorkspaceDirectoryCommand({ DirectoryId: "d-addon001" }),
  );
});

test("WorkSpaces pool create/start/stop/terminate", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateWorkspacesPoolCommand({
      PoolName: "TestPool",
      Description: "A test pool",
      BundleId: "wsb-pool01",
      DirectoryId: "d-pool001",
      Capacity: { DesiredUserSessions: 5 },
    }),
  );
  expect(created.WorkspacesPool?.PoolId).toBeDefined();
  const poolId = created.WorkspacesPool?.PoolId as string;
  expect(created.WorkspacesPool?.State as string).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeWorkspacesPoolsCommand({ PoolIds: [poolId] }),
  );
  expect(described.WorkspacesPools?.length).toBe(1);
  expect(described.WorkspacesPools?.[0]?.PoolName).toBe("TestPool");

  await client.send(new StopWorkspacesPoolCommand({ PoolId: poolId }));

  const afterStop = await client.send(
    new DescribeWorkspacesPoolsCommand({ PoolIds: [poolId] }),
  );
  expect(afterStop.WorkspacesPools?.[0]?.State).toBe("STOPPED");

  await client.send(new StartWorkspacesPoolCommand({ PoolId: poolId }));

  const afterStart = await client.send(
    new DescribeWorkspacesPoolsCommand({ PoolIds: [poolId] }),
  );
  expect(afterStart.WorkspacesPools?.[0]?.State as string).toBe("AVAILABLE");

  await client.send(new TerminateWorkspacesPoolCommand({ PoolId: poolId }));

  const afterTerminate = await client.send(
    new DescribeWorkspacesPoolsCommand({ PoolIds: [poolId] }),
  );
  expect(afterTerminate.WorkspacesPools?.length).toBe(0);
});

test("WorkSpaces account-link invite/accept/list", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateAccountLinkInvitationCommand({ TargetAccountId: "123456789012" }),
  );
  expect(created.AccountLink?.AccountLinkId).toBeDefined();
  const linkId = created.AccountLink?.AccountLinkId as string;
  expect(created.AccountLink?.AccountLinkStatus as string).toBe(
    "PENDING_ACCEPTANCE",
  );

  const listed = await client.send(new ListAccountLinksCommand({}));
  expect(listed.AccountLinks?.some((l) => l.AccountLinkId === linkId)).toBe(
    true,
  );

  const got = await client.send(new GetAccountLinkCommand({ LinkId: linkId }));
  expect(got.AccountLink?.AccountLinkId).toBe(linkId);

  const accepted = await client.send(
    new AcceptAccountLinkInvitationCommand({ LinkId: linkId }),
  );
  expect(accepted.AccountLink?.AccountLinkStatus).toBe("LINKED");
});

test("WorkSpaces describe account / client branding", async () => {
  const client = workspaces();

  const account = await client.send(new DescribeAccountCommand({}));
  expect(account.DedicatedTenancySupport).toBeDefined();

  await client.send(
    new RegisterWorkspaceDirectoryCommand({
      DirectoryId: "d-brand001",
      SubnetIds: ["subnet-fff"],
    }),
  );

  await client.send(
    new ImportClientBrandingCommand({
      ResourceId: "d-brand001",
      DeviceTypeWindows: {
        Logo: undefined,
        SupportEmail: "support@example.com",
      },
    }),
  );

  const branding = await client.send(
    new DescribeClientBrandingCommand({ ResourceId: "d-brand001" }),
  );
  expect(branding.DeviceTypeWindows).toBeDefined();

  await client.send(
    new DeregisterWorkspaceDirectoryCommand({ DirectoryId: "d-brand001" }),
  );
});

test("WorkSpaces delete tags", async () => {
  const client = workspaces();

  const created = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        {
          DirectoryId: "d-dtags",
          UserName: "dtags-user",
          BundleId: "wsb-dtags",
        },
      ],
    }),
  );
  const wsId = created.PendingRequests?.[0]?.WorkspaceId as string;

  await client.send(
    new CreateTagsCommand({
      ResourceId: wsId,
      Tags: [
        { Key: "key1", Value: "v1" },
        { Key: "key2", Value: "v2" },
      ],
    }),
  );

  await client.send(
    new DeleteTagsCommand({ ResourceId: wsId, TagKeys: ["key1"] }),
  );

  const tags = await client.send(new DescribeTagsCommand({ ResourceId: wsId }));
  expect(tags.TagList?.some((t) => t.Key === "key1")).toBe(false);
  expect(tags.TagList?.some((t) => t.Key === "key2")).toBe(true);

  await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [{ WorkspaceId: wsId }],
    }),
  );
});

test("WorkSpaces fidelity: PENDING state, unique IP, ConnectionStatus, ModifyWorkspaceProperties, pagination, TerminateWorkspaces FailedRequests", async () => {
  const client = workspaces();

  const c1 = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        { DirectoryId: "d-fidelity", UserName: "fuser1", BundleId: "wsb-f1" },
      ],
    }),
  );
  const c2 = await client.send(
    new CreateWorkspacesCommand({
      Workspaces: [
        { DirectoryId: "d-fidelity", UserName: "fuser2", BundleId: "wsb-f1" },
      ],
    }),
  );

  const wsId1 = c1.PendingRequests?.[0]?.WorkspaceId as string;
  const wsId2 = c2.PendingRequests?.[0]?.WorkspaceId as string;

  expect(c1.PendingRequests?.[0]?.State).toBe("PENDING");

  const d1 = await client.send(
    new DescribeWorkspacesCommand({ WorkspaceIds: [wsId1] }),
  );
  const d2 = await client.send(
    new DescribeWorkspacesCommand({ WorkspaceIds: [wsId2] }),
  );
  expect(d1.Workspaces?.[0]?.State).toBe("AVAILABLE");
  expect(d1.Workspaces?.[0]?.IpAddress).not.toBe(d2.Workspaces?.[0]?.IpAddress);

  const connAvailable = await client.send(
    new DescribeWorkspacesConnectionStatusCommand({ WorkspaceIds: [wsId1] }),
  );
  expect(connAvailable.WorkspacesConnectionStatus?.[0]?.ConnectionState).toBe(
    "CONNECTED",
  );

  await client.send(
    new StopWorkspacesCommand({
      StopWorkspaceRequests: [{ WorkspaceId: wsId1 }],
    }),
  );
  const connStopped = await client.send(
    new DescribeWorkspacesConnectionStatusCommand({ WorkspaceIds: [wsId1] }),
  );
  expect(connStopped.WorkspacesConnectionStatus?.[0]?.ConnectionState).toBe(
    "DISCONNECTED",
  );

  await client.send(
    new StartWorkspacesCommand({
      StartWorkspaceRequests: [{ WorkspaceId: wsId1 }],
    }),
  );

  await client.send(
    new ModifyWorkspacePropertiesCommand({
      WorkspaceId: wsId1,
      WorkspaceProperties: {
        ComputeTypeName: "PERFORMANCE",
        RunningMode: "AUTO_STOP",
        UserVolumeSizeGib: 100,
        RootVolumeSizeGib: 80,
      },
    }),
  );

  const afterModify = await client.send(
    new DescribeWorkspacesCommand({ WorkspaceIds: [wsId1] }),
  );
  expect(
    afterModify.Workspaces?.[0]?.WorkspaceProperties?.ComputeTypeName,
  ).toBe("PERFORMANCE");
  expect(afterModify.Workspaces?.[0]?.WorkspaceProperties?.RunningMode).toBe(
    "AUTO_STOP",
  );
  expect(
    afterModify.Workspaces?.[0]?.WorkspaceProperties?.UserVolumeSizeGib,
  ).toBe(100);
  expect(
    afterModify.Workspaces?.[0]?.WorkspaceProperties?.RootVolumeSizeGib,
  ).toBe(80);

  const allInDir = await client.send(
    new DescribeWorkspacesCommand({ DirectoryId: "d-fidelity" }),
  );
  expect(allInDir.Workspaces?.length ?? 0).toBeGreaterThanOrEqual(2);

  const page1 = await client.send(
    new DescribeWorkspacesCommand({ DirectoryId: "d-fidelity", Limit: 1 }),
  );
  expect(page1.Workspaces?.length).toBe(1);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new DescribeWorkspacesCommand({
      DirectoryId: "d-fidelity",
      Limit: 1,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.Workspaces?.length).toBe(1);

  const termFailed = await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [{ WorkspaceId: "ws-nonexistent" }],
    }),
  );
  expect(termFailed.FailedRequests?.length).toBe(1);
  expect(termFailed.FailedRequests?.[0]?.WorkspaceId).toBe("ws-nonexistent");

  await client.send(
    new TerminateWorkspacesCommand({
      TerminateWorkspaceRequests: [
        { WorkspaceId: wsId1 },
        { WorkspaceId: wsId2 },
      ],
    }),
  );
});
