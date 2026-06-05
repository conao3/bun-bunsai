import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptHandshakeCommand,
  AttachPolicyCommand,
  CancelHandshakeCommand,
  CloseAccountCommand,
  CreateAccountCommand,
  CreateOrganizationCommand,
  CreateOrganizationalUnitCommand,
  CreatePolicyCommand,
  DeclineHandshakeCommand,
  DeleteOrganizationalUnitCommand,
  DeletePolicyCommand,
  DeleteResourcePolicyCommand,
  DeregisterDelegatedAdministratorCommand,
  DescribeAccountCommand,
  DescribeCreateAccountStatusCommand,
  DescribeHandshakeCommand,
  DescribeOrganizationCommand,
  DescribeOrganizationalUnitCommand,
  DescribePolicyCommand,
  DescribeResourcePolicyCommand,
  DetachPolicyCommand,
  DisableAWSServiceAccessCommand,
  DisablePolicyTypeCommand,
  EnableAWSServiceAccessCommand,
  EnablePolicyTypeCommand,
  InviteAccountToOrganizationCommand,
  ListAWSServiceAccessForOrganizationCommand,
  ListAccountsCommand,
  ListAccountsForParentCommand,
  ListChildrenCommand,
  ListCreateAccountStatusCommand,
  ListDelegatedAdministratorsCommand,
  ListDelegatedServicesForAccountCommand,
  ListHandshakesForOrganizationCommand,
  ListOrganizationalUnitsForParentCommand,
  ListParentsCommand,
  ListPoliciesCommand,
  ListPoliciesForTargetCommand,
  ListRootsCommand,
  ListTagsForResourceCommand,
  ListTargetsForPolicyCommand,
  MoveAccountCommand,
  OrganizationsClient,
  PutResourcePolicyCommand,
  RegisterDelegatedAdministratorCommand,
  RemoveAccountFromOrganizationCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateOrganizationalUnitCommand,
  UpdatePolicyCommand,
} from "@aws-sdk/client-organizations";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const org = () =>
  new OrganizationsClient({ endpoint, region, credentials, requestHandler });

test("Organizations org / account / ou lifecycle", async () => {
  const client = org();

  const created = await client.send(
    new CreateOrganizationCommand({ FeatureSet: "ALL" }),
  );
  expect(created.Organization?.Id).toMatch(/^o-/);
  expect(created.Organization?.FeatureSet).toBe("ALL");

  const described = await client.send(new DescribeOrganizationCommand({}));
  expect(described.Organization?.Id).toBe(created.Organization?.Id);

  const roots = await client.send(new ListRootsCommand({}));
  const rootId = (roots.Roots ?? [])[0]?.Id;
  expect(rootId).toMatch(/^r-/);

  const account = await client.send(
    new CreateAccountCommand({
      AccountName: "bunsai-e2e-account",
      Email: "bunsai-e2e@example.com",
    }),
  );
  expect(account.CreateAccountStatus?.State).toBe("SUCCEEDED");
  const accountId = account.CreateAccountStatus?.AccountId;
  expect(accountId).toBeDefined();

  const describedAccount = await client.send(
    new DescribeAccountCommand({ AccountId: accountId }),
  );
  expect(describedAccount.Account?.Name).toBe("bunsai-e2e-account");
  expect(describedAccount.Account?.Email).toBe("bunsai-e2e@example.com");

  const listed = await client.send(new ListAccountsCommand({}));
  const ids = (listed.Accounts ?? []).map((entry) => entry.Id);
  expect(ids).toContain(accountId);

  const ou = await client.send(
    new CreateOrganizationalUnitCommand({
      ParentId: rootId,
      Name: "bunsai-e2e-ou",
    }),
  );
  expect(ou.OrganizationalUnit?.Id).toMatch(/^ou-/);
  expect(ou.OrganizationalUnit?.Name).toBe("bunsai-e2e-ou");

  const ous = await client.send(
    new ListOrganizationalUnitsForParentCommand({ ParentId: rootId }),
  );
  const ouNames = (ous.OrganizationalUnits ?? []).map((entry) => entry.Name);
  expect(ouNames).toContain("bunsai-e2e-ou");
});

test("Organizations policy lifecycle", async () => {
  const client = org();

  const roots = await client.send(new ListRootsCommand({}));
  const rootId = roots.Roots?.[0]?.Id;
  expect(rootId).toBeDefined();

  const enabledPt = await client.send(
    new EnablePolicyTypeCommand({
      RootId: rootId!,
      PolicyType: "TAG_POLICY",
    }),
  );
  expect(
    enabledPt.Root?.PolicyTypes?.some(
      (pt) => pt.Type === "TAG_POLICY" && pt.Status === "ENABLED",
    ),
  ).toBe(true);

  const created = await client.send(
    new CreatePolicyCommand({
      Content: '{"tags":{}}',
      Description: "e2e tag policy",
      Name: "e2e-tag-policy",
      Type: "TAG_POLICY",
    }),
  );
  const policyId = created.Policy?.PolicySummary?.Id;
  expect(policyId).toMatch(/^p-/);

  const described = await client.send(
    new DescribePolicyCommand({ PolicyId: policyId }),
  );
  expect(described.Policy?.PolicySummary?.Name).toBe("e2e-tag-policy");
  expect(described.Policy?.Content).toBe('{"tags":{}}');

  const updated = await client.send(
    new UpdatePolicyCommand({
      PolicyId: policyId,
      Description: "updated desc",
    }),
  );
  expect(updated.Policy?.PolicySummary?.Description).toBe("updated desc");

  const listed = await client.send(
    new ListPoliciesCommand({ Filter: "TAG_POLICY" }),
  );
  expect(listed.Policies?.some((p) => p.Id === policyId)).toBe(true);

  await client.send(
    new AttachPolicyCommand({ PolicyId: policyId!, TargetId: rootId! }),
  );

  const targets = await client.send(
    new ListTargetsForPolicyCommand({ PolicyId: policyId }),
  );
  expect(targets.Targets?.some((t) => t.TargetId === rootId)).toBe(true);

  const policiesForTarget = await client.send(
    new ListPoliciesForTargetCommand({
      TargetId: rootId!,
      Filter: "TAG_POLICY",
    }),
  );
  expect(policiesForTarget.Policies?.some((p) => p.Id === policyId)).toBe(true);

  await client.send(
    new DetachPolicyCommand({ PolicyId: policyId!, TargetId: rootId! }),
  );

  await client.send(new DeletePolicyCommand({ PolicyId: policyId }));

  const listedAfterDelete = await client.send(
    new ListPoliciesCommand({ Filter: "TAG_POLICY" }),
  );
  expect(listedAfterDelete.Policies?.some((p) => p.Id === policyId)).toBe(
    false,
  );

  await client.send(
    new DisablePolicyTypeCommand({
      RootId: rootId!,
      PolicyType: "TAG_POLICY",
    }),
  );
  const rootsAfter = await client.send(new ListRootsCommand({}));
  expect(
    rootsAfter.Roots?.[0]?.PolicyTypes?.some(
      (pt) => pt.Type === "TAG_POLICY" && pt.Status === "ENABLED",
    ),
  ).toBe(false);
});

test("Organizations OU lifecycle", async () => {
  const client = org();

  const roots = await client.send(new ListRootsCommand({}));
  const rootId = roots.Roots?.[0]?.Id;

  const ouRes = await client.send(
    new CreateOrganizationalUnitCommand({ ParentId: rootId!, Name: "test-ou" }),
  );
  const ouId = ouRes.OrganizationalUnit?.Id;
  expect(ouId).toMatch(/^ou-/);

  const described = await client.send(
    new DescribeOrganizationalUnitCommand({ OrganizationalUnitId: ouId }),
  );
  expect(described.OrganizationalUnit?.Name).toBe("test-ou");

  const updated = await client.send(
    new UpdateOrganizationalUnitCommand({
      OrganizationalUnitId: ouId,
      Name: "test-ou-renamed",
    }),
  );
  expect(updated.OrganizationalUnit?.Name).toBe("test-ou-renamed");

  const children = await client.send(
    new ListChildrenCommand({
      ParentId: rootId!,
      ChildType: "ORGANIZATIONAL_UNIT",
    }),
  );
  expect(children.Children?.some((c) => c.Id === ouId)).toBe(true);

  const deleted = await client.send(
    new DeleteOrganizationalUnitCommand({ OrganizationalUnitId: ouId }),
  );
  expect(deleted).toBeDefined();
});

test("Organizations handshake / invite lifecycle", async () => {
  const client = org();

  const invited = await client.send(
    new InviteAccountToOrganizationCommand({
      Target: { Id: "111122223333", Type: "ACCOUNT" },
      Notes: "e2e invite",
    }),
  );
  const handshakeId = invited.Handshake?.Id;
  expect(handshakeId).toMatch(/^h-/);
  expect(invited.Handshake?.State).toBe("REQUESTED");
  expect(invited.Handshake?.Action).toBe("INVITE");

  const described = await client.send(
    new DescribeHandshakeCommand({ HandshakeId: handshakeId }),
  );
  expect(described.Handshake?.Id).toBe(handshakeId);

  const listed = await client.send(
    new ListHandshakesForOrganizationCommand({}),
  );
  expect(listed.Handshakes?.some((h) => h.Id === handshakeId)).toBe(true);

  const accepted = await client.send(
    new AcceptHandshakeCommand({ HandshakeId: handshakeId! }),
  );
  expect(accepted.Handshake?.State).toBe("ACCEPTED");

  const declined = await client.send(
    new InviteAccountToOrganizationCommand({
      Target: { Id: "444455556666", Type: "ACCOUNT" },
    }),
  );
  const h2 = declined.Handshake?.Id;
  const declinedRes = await client.send(
    new DeclineHandshakeCommand({ HandshakeId: h2! }),
  );
  expect(declinedRes.Handshake?.State).toBe("DECLINED");

  const canceled = await client.send(
    new InviteAccountToOrganizationCommand({
      Target: { Id: "777788889999", Type: "ACCOUNT" },
    }),
  );
  const h3 = canceled.Handshake?.Id;
  const canceledRes = await client.send(
    new CancelHandshakeCommand({ HandshakeId: h3! }),
  );
  expect(canceledRes.Handshake?.State).toBe("CANCELED");
});

test("Organizations account move / create-status / list-parents", async () => {
  const client = org();

  const roots = await client.send(new ListRootsCommand({}));
  const rootId = roots.Roots?.[0]?.Id;

  const accountRes = await client.send(
    new CreateAccountCommand({
      AccountName: "move-test-account",
      Email: "move-test@example.com",
    }),
  );
  const accountId = accountRes.CreateAccountStatus?.AccountId!;
  const statusId = accountRes.CreateAccountStatus?.Id!;

  const statusDesc = await client.send(
    new DescribeCreateAccountStatusCommand({
      CreateAccountRequestId: statusId,
    }),
  );
  expect(statusDesc.CreateAccountStatus?.State).toBe("SUCCEEDED");

  const statuses = await client.send(
    new ListCreateAccountStatusCommand({ States: ["SUCCEEDED"] }),
  );
  expect(statuses.CreateAccountStatuses?.some((s) => s.Id === statusId)).toBe(
    true,
  );

  const parents = await client.send(
    new ListParentsCommand({ ChildId: accountId }),
  );
  expect(parents.Parents?.[0]?.Id).toBe(rootId);

  const ouRes = await client.send(
    new CreateOrganizationalUnitCommand({
      ParentId: rootId!,
      Name: "move-target-ou",
    }),
  );
  const ouId = ouRes.OrganizationalUnit?.Id!;

  await client.send(
    new MoveAccountCommand({
      AccountId: accountId,
      SourceParentId: rootId!,
      DestinationParentId: ouId,
    }),
  );

  const parentsAfterMove = await client.send(
    new ListParentsCommand({ ChildId: accountId }),
  );
  expect(parentsAfterMove.Parents?.[0]?.Id).toBe(ouId);

  const accountsForParent = await client.send(
    new ListAccountsForParentCommand({ ParentId: ouId }),
  );
  expect(accountsForParent.Accounts?.some((a) => a.Id === accountId)).toBe(
    true,
  );

  const closedRes = await client.send(
    new CloseAccountCommand({ AccountId: accountId }),
  );
  expect(closedRes).toBeDefined();

  await client.send(
    new RemoveAccountFromOrganizationCommand({ AccountId: accountId }),
  );
  const listed = await client.send(new ListAccountsCommand({}));
  expect(listed.Accounts?.some((a) => a.Id === accountId)).toBe(false);
});

test("Organizations delegated administrator", async () => {
  const client = org();

  const accountRes = await client.send(
    new CreateAccountCommand({
      AccountName: "delegate-account",
      Email: "delegate@example.com",
    }),
  );
  const accountId = accountRes.CreateAccountStatus?.AccountId!;

  await client.send(
    new RegisterDelegatedAdministratorCommand({
      AccountId: accountId,
      ServicePrincipal: "ssm.amazonaws.com",
    }),
  );

  const admins = await client.send(
    new ListDelegatedAdministratorsCommand({
      ServicePrincipal: "ssm.amazonaws.com",
    }),
  );
  expect(admins.DelegatedAdministrators?.some((d) => d.Id === accountId)).toBe(
    true,
  );

  const services = await client.send(
    new ListDelegatedServicesForAccountCommand({ AccountId: accountId }),
  );
  expect(
    services.DelegatedServices?.some(
      (s) => s.ServicePrincipal === "ssm.amazonaws.com",
    ),
  ).toBe(true);

  await client.send(
    new DeregisterDelegatedAdministratorCommand({
      AccountId: accountId,
      ServicePrincipal: "ssm.amazonaws.com",
    }),
  );

  const adminsAfter = await client.send(
    new ListDelegatedAdministratorsCommand({
      ServicePrincipal: "ssm.amazonaws.com",
    }),
  );
  expect(
    adminsAfter.DelegatedAdministrators?.some((d) => d.Id === accountId),
  ).toBe(false);
});

test("Organizations service access", async () => {
  const client = org();

  await client.send(
    new EnableAWSServiceAccessCommand({
      ServicePrincipal: "config.amazonaws.com",
    }),
  );

  const listed = await client.send(
    new ListAWSServiceAccessForOrganizationCommand({}),
  );
  expect(
    listed.EnabledServicePrincipals?.some(
      (s) => s.ServicePrincipal === "config.amazonaws.com",
    ),
  ).toBe(true);

  await client.send(
    new DisableAWSServiceAccessCommand({
      ServicePrincipal: "config.amazonaws.com",
    }),
  );

  const listedAfter = await client.send(
    new ListAWSServiceAccessForOrganizationCommand({}),
  );
  expect(
    listedAfter.EnabledServicePrincipals?.some(
      (s) => s.ServicePrincipal === "config.amazonaws.com",
    ),
  ).toBe(false);
});

test("Organizations tags", async () => {
  const client = org();

  const accountRes = await client.send(
    new CreateAccountCommand({
      AccountName: "tag-test-account",
      Email: "tag-test@example.com",
    }),
  );
  const accountId = accountRes.CreateAccountStatus?.AccountId!;

  await client.send(
    new TagResourceCommand({
      ResourceId: accountId,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceId: accountId }),
  );
  expect(listed.Tags?.some((t) => t.Key === "env" && t.Value === "test")).toBe(
    true,
  );
  expect(
    listed.Tags?.some((t) => t.Key === "team" && t.Value === "platform"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({ ResourceId: accountId, TagKeys: ["team"] }),
  );

  const listedAfter = await client.send(
    new ListTagsForResourceCommand({ ResourceId: accountId }),
  );
  expect(listedAfter.Tags?.some((t) => t.Key === "env")).toBe(true);
  expect(listedAfter.Tags?.some((t) => t.Key === "team")).toBe(false);
});

test("Organizations resource policy", async () => {
  const client = org();

  const putRes = await client.send(
    new PutResourcePolicyCommand({
      Content: '{"Version":"2012-10-17","Statement":[]}',
    }),
  );
  expect(putRes.ResourcePolicy?.ResourcePolicySummary?.Id).toBeDefined();

  const described = await client.send(new DescribeResourcePolicyCommand({}));
  expect(described.ResourcePolicy?.Content).toBe(
    '{"Version":"2012-10-17","Statement":[]}',
  );

  await client.send(new DeleteResourcePolicyCommand({}));

  try {
    await client.send(new DescribeResourcePolicyCommand({}));
    expect(false).toBe(true);
  } catch (e: unknown) {
    expect((e as Error).name).toBe("ResourcePolicyNotFoundException");
  }
});
