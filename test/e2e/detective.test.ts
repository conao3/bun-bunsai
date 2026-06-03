import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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
import { NodeHttpHandler } from "@smithy/node-http-handler";

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

const detective = () =>
  new DetectiveClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
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

  const memberId = "123456789013";
  await client.send(
    new CreateMembersCommand({
      GraphArn: graphArn,
      Accounts: [{ AccountId: memberId, EmailAddress: "inv@example.com" }],
    }),
  );

  const invitations = await client.send(new ListInvitationsCommand({}));
  expect(invitations.Invitations).toBeDefined();

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

  const adminId = "123456789014";
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
  expect((afterDisable.Administrators ?? []).length).toBe(0);

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
