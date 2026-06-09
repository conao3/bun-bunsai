import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptInvitationCommand,
  BatchGetGraphMemberDatasourcesCommand,
  BatchGetMembershipDatasourcesCommand,
  CreateGraphCommand,
  CreateMembersCommand,
  DeleteGraphCommand,
  DeleteMembersCommand,
  DescribeOrganizationConfigurationCommand,
  DetectiveClient,
  DisableOrganizationAdminAccountCommand,
  DisassociateMembershipCommand,
  EnableOrganizationAdminAccountCommand,
  GetInvestigationCommand,
  GetMembersCommand,
  ListDatasourcePackagesCommand,
  ListGraphsCommand,
  ListIndicatorsCommand,
  ListInvestigationsCommand,
  ListInvitationsCommand,
  ListMembersCommand,
  ListOrganizationAdminAccountsCommand,
  ListTagsForResourceCommand,
  RejectInvitationCommand,
  StartInvestigationCommand,
  StartMonitoringMemberCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDatasourcePackagesCommand,
  UpdateInvestigationStateCommand,
  UpdateOrganizationConfigurationCommand,
} from "@aws-sdk/client-detective";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const detective = () =>
  new DetectiveClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Detective graph roundtrip", async () => {
  const client = detective();

  const created = await client.send(new CreateGraphCommand({}));
  expect(created.GraphArn).toContain(":graph:");

  const listed = await client.send(new ListGraphsCommand({}));
  expect((listed.GraphList ?? []).map((g) => g.Arn)).toContain(
    created.GraphArn,
  );

  await client.send(new DeleteGraphCommand({ GraphArn: created.GraphArn }));

  const afterDelete = await client.send(new ListGraphsCommand({}));
  expect((afterDelete.GraphList ?? []).map((g) => g.Arn)).not.toContain(
    created.GraphArn,
  );

  await expect(
    client.send(new DeleteGraphCommand({ GraphArn: created.GraphArn })),
  ).rejects.toThrow();
});

test("Detective member operations", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  const memberId = "123456789012";
  const created = await client.send(
    new CreateMembersCommand({
      GraphArn: graphArn,
      Accounts: [{ AccountId: memberId, EmailAddress: "test@example.com" }],
    }),
  );
  expect((created.Members ?? []).length).toBe(1);
  expect(created.Members![0].AccountId).toBe(memberId);
  expect(created.Members![0].Status).toBe("INVITED");

  const got = await client.send(
    new GetMembersCommand({ GraphArn: graphArn, AccountIds: [memberId] }),
  );
  expect((got.MemberDetails ?? []).length).toBe(1);
  expect(got.MemberDetails![0].AccountId).toBe(memberId);

  const listed = await client.send(
    new ListMembersCommand({ GraphArn: graphArn }),
  );
  const ids = (listed.MemberDetails ?? []).map((m) => m.AccountId);
  expect(ids).toContain(memberId);

  await client.send(
    new StartMonitoringMemberCommand({
      GraphArn: graphArn,
      AccountId: memberId,
    }),
  );

  const afterMonitor = await client.send(
    new GetMembersCommand({ GraphArn: graphArn, AccountIds: [memberId] }),
  );
  expect(afterMonitor.MemberDetails![0].Status).toBe("ENABLED");

  const deleted = await client.send(
    new DeleteMembersCommand({ GraphArn: graphArn, AccountIds: [memberId] }),
  );
  expect((deleted.AccountIds ?? []).length).toBe(1);

  const afterDelete = await client.send(
    new ListMembersCommand({ GraphArn: graphArn }),
  );
  const afterIds = (afterDelete.MemberDetails ?? []).map((m) => m.AccountId);
  expect(afterIds).not.toContain(memberId);

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective invitation operations", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  const callerAccountId = "000000000000";
  await client.send(
    new CreateMembersCommand({
      GraphArn: graphArn,
      Accounts: [
        { AccountId: callerAccountId, EmailAddress: "inv@example.com" },
      ],
    }),
  );

  const invitations = await client.send(new ListInvitationsCommand({}));
  expect(invitations.Invitations).toBeDefined();
  expect((invitations.Invitations ?? []).map((i) => i.AccountId)).toContain(
    callerAccountId,
  );

  await expect(
    client.send(new AcceptInvitationCommand({ GraphArn: graphArn })),
  ).resolves.toBeDefined();

  await expect(
    client.send(new RejectInvitationCommand({ GraphArn: graphArn })),
  ).resolves.toBeDefined();

  await expect(
    client.send(new DisassociateMembershipCommand({ GraphArn: graphArn })),
  ).resolves.toBeDefined();

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective organization operations", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  const adminId = "000000000000";
  await client.send(
    new EnableOrganizationAdminAccountCommand({ AccountId: adminId }),
  );

  const admins = await client.send(
    new ListOrganizationAdminAccountsCommand({}),
  );
  const adminIds = (admins.Administrators ?? []).map((a) => a.AccountId);
  expect(adminIds).toContain(adminId);

  await client.send(new DisableOrganizationAdminAccountCommand({}));

  const afterDisable = await client.send(
    new ListOrganizationAdminAccountsCommand({}),
  );
  expect(
    (afterDisable.Administrators ?? []).map((a) => a.AccountId),
  ).not.toContain(adminId);

  const config = await client.send(
    new DescribeOrganizationConfigurationCommand({ GraphArn: graphArn }),
  );
  expect(config.AutoEnable).toBe(false);

  await client.send(
    new UpdateOrganizationConfigurationCommand({
      GraphArn: graphArn,
      AutoEnable: true,
    }),
  );

  const updatedConfig = await client.send(
    new DescribeOrganizationConfigurationCommand({ GraphArn: graphArn }),
  );
  expect(updatedConfig.AutoEnable).toBe(true);

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective datasource operations", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  const datasources = await client.send(
    new ListDatasourcePackagesCommand({ GraphArn: graphArn }),
  );
  expect(datasources.DatasourcePackages).toBeDefined();

  await client.send(
    new UpdateDatasourcePackagesCommand({
      GraphArn: graphArn,
      DatasourcePackages: ["EKS_AUDIT"],
    }),
  );

  const updated = await client.send(
    new ListDatasourcePackagesCommand({ GraphArn: graphArn }),
  );
  expect(updated.DatasourcePackages?.["EKS_AUDIT"]).toBeDefined();

  const memberId = "123456789015";
  await client.send(
    new CreateMembersCommand({
      GraphArn: graphArn,
      Accounts: [{ AccountId: memberId, EmailAddress: "ds@example.com" }],
    }),
  );

  const memberDs = await client.send(
    new BatchGetGraphMemberDatasourcesCommand({
      GraphArn: graphArn,
      AccountIds: [memberId],
    }),
  );
  expect((memberDs.MemberDatasources ?? []).length).toBe(1);
  expect(memberDs.MemberDatasources![0].AccountId).toBe(memberId);

  const membershipDs = await client.send(
    new BatchGetMembershipDatasourcesCommand({ GraphArns: [graphArn] }),
  );
  expect((membershipDs.MembershipDatasources ?? []).length).toBe(1);
  expect(membershipDs.MembershipDatasources![0].GraphArn).toBe(graphArn);

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective investigation operations", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const started = await client.send(
    new StartInvestigationCommand({
      GraphArn: graphArn,
      EntityArn: `arn:aws:iam::123456789012:user/test-user`,
      ScopeStartTime: start,
      ScopeEndTime: now,
    }),
  );
  const investigationId = started.InvestigationId!;
  expect(investigationId).toBeDefined();

  const got = await client.send(
    new GetInvestigationCommand({
      GraphArn: graphArn,
      InvestigationId: investigationId,
    }),
  );
  expect(got.InvestigationId).toBe(investigationId);
  expect(got.GraphArn).toBe(graphArn);
  expect(got.EntityType).toBe("IAM_USER");
  expect(got.Status).toBe("RUNNING");
  expect(got.State).toBe("ACTIVE");

  const listed = await client.send(
    new ListInvestigationsCommand({ GraphArn: graphArn }),
  );
  const ids = (listed.InvestigationDetails ?? []).map((i) => i.InvestigationId);
  expect(ids).toContain(investigationId);

  await client.send(
    new UpdateInvestigationStateCommand({
      GraphArn: graphArn,
      InvestigationId: investigationId,
      State: "ARCHIVED",
    }),
  );

  const afterUpdate = await client.send(
    new GetInvestigationCommand({
      GraphArn: graphArn,
      InvestigationId: investigationId,
    }),
  );
  expect(afterUpdate.State).toBe("ARCHIVED");

  const indicators = await client.send(
    new ListIndicatorsCommand({
      GraphArn: graphArn,
      InvestigationId: investigationId,
    }),
  );
  expect(indicators.GraphArn).toBe(graphArn);
  expect(indicators.InvestigationId).toBe(investigationId);
  expect(indicators.Indicators ?? []).toBeArray();

  await expect(
    client.send(
      new GetInvestigationCommand({
        GraphArn: graphArn,
        InvestigationId: "nonexistent",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective CreateGraph idempotency", async () => {
  const client = detective();

  const first = await client.send(new CreateGraphCommand({}));
  expect(first.GraphArn).toContain(":graph:");

  const second = await client.send(new CreateGraphCommand({}));
  expect(second.GraphArn).toBe(first.GraphArn);

  await client.send(new DeleteGraphCommand({ GraphArn: first.GraphArn }));
});

test("Detective ListMembers pagination", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  const memberIds = ["111111111111", "222222222222", "333333333333"];
  await client.send(
    new CreateMembersCommand({
      GraphArn: graphArn,
      Accounts: memberIds.map((id) => ({
        AccountId: id,
        EmailAddress: `${id}@example.com`,
      })),
    }),
  );

  const page1 = await client.send(
    new ListMembersCommand({ GraphArn: graphArn, MaxResults: 2 }),
  );
  expect((page1.MemberDetails ?? []).length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListMembersCommand({
      GraphArn: graphArn,
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect((page2.MemberDetails ?? []).length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  const allIds = [
    ...(page1.MemberDetails ?? []).map((m) => m.AccountId),
    ...(page2.MemberDetails ?? []).map((m) => m.AccountId),
  ];
  for (const id of memberIds) {
    expect(allIds).toContain(id);
  }

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective AcceptInvitation wrong-state error", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const graphArn = graph.GraphArn!;

  await client.send(
    new CreateMembersCommand({
      GraphArn: graphArn,
      Accounts: [{ AccountId: "000000000000", EmailAddress: "e@example.com" }],
    }),
  );

  await expect(
    client.send(new AcceptInvitationCommand({ GraphArn: graphArn })),
  ).resolves.toBeDefined();

  await expect(
    client.send(new AcceptInvitationCommand({ GraphArn: graphArn })),
  ).rejects.toThrow();

  await client.send(new DeleteGraphCommand({ GraphArn: graphArn }));
});

test("Detective tag operations", async () => {
  const client = detective();

  const graph = await client.send(new CreateGraphCommand({}));
  const resourceArn = graph.GraphArn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: { env: "test", team: "security" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(listed.Tags?.["env"]).toBe("test");
  expect(listed.Tags?.["team"]).toBe("security");

  await client.send(
    new UntagResourceCommand({ ResourceArn: resourceArn, TagKeys: ["team"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect(afterUntag.Tags?.["env"]).toBe("test");
  expect(afterUntag.Tags?.["team"]).toBeUndefined();

  await client.send(new DeleteGraphCommand({ GraphArn: resourceArn }));
});
