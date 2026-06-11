import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachPolicyCommand,
  CreateAccountCommand,
  CreateOrganizationCommand,
  CreateOrganizationalUnitCommand,
  CreatePolicyCommand,
  DeleteOrganizationalUnitCommand,
  DescribeCreateAccountStatusCommand,
  DetachPolicyCommand,
  EnablePolicyTypeCommand,
  ListAccountsForParentCommand,
  ListPoliciesForTargetCommand,
  ListRootsCommand,
  MoveAccountCommand,
  OrganizationsClient,
} from "@aws-sdk/client-organizations";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("Organizations scenario e2e", () => {
  const org = () =>
    new OrganizationsClient({ endpoint, region, credentials, requestHandler });

  test("multi-account org management: org → OU → account move → SCP attach/detach → OU delete guard", async () => {
    const client = org();

    const created = await client.send(
      new CreateOrganizationCommand({ FeatureSet: "ALL" }),
    );
    expect(created.Organization?.Id).toMatch(/^o-/);
    expect(created.Organization?.FeatureSet).toBe("ALL");

    const roots = await client.send(new ListRootsCommand({}));
    const rootId = roots.Roots?.[0]?.Id ?? "";
    expect(rootId).toMatch(/^r-/);

    const ouRes = await client.send(
      new CreateOrganizationalUnitCommand({
        ParentId: rootId,
        Name: "workloads",
      }),
    );
    const ouId = ouRes.OrganizationalUnit?.Id ?? "";
    expect(ouId).toMatch(/^ou-/);
    expect(ouRes.OrganizationalUnit?.Name).toBe("workloads");

    const accountRes = await client.send(
      new CreateAccountCommand({
        AccountName: "scenario-workload-account",
        Email: "scenario-workload@example.com",
      }),
    );
    expect(accountRes.CreateAccountStatus?.State).toBe("IN_PROGRESS");
    const requestId = accountRes.CreateAccountStatus?.Id ?? "";

    const statusRes = await client.send(
      new DescribeCreateAccountStatusCommand({
        CreateAccountRequestId: requestId,
      }),
    );
    expect(statusRes.CreateAccountStatus?.State).toBe("SUCCEEDED");
    const accountId = statusRes.CreateAccountStatus?.AccountId ?? "";
    expect(accountId).toBeTruthy();

    await client.send(
      new MoveAccountCommand({
        AccountId: accountId,
        SourceParentId: rootId,
        DestinationParentId: ouId,
      }),
    );

    const ouAccounts = await client.send(
      new ListAccountsForParentCommand({ ParentId: ouId }),
    );
    expect(ouAccounts.Accounts?.some((a) => a.Id === accountId)).toBe(true);

    const rootAccounts = await client.send(
      new ListAccountsForParentCommand({ ParentId: rootId }),
    );
    expect(rootAccounts.Accounts?.some((a) => a.Id === accountId)).toBe(false);

    try {
      await client.send(
        new EnablePolicyTypeCommand({
          RootId: rootId,
          PolicyType: "SERVICE_CONTROL_POLICY",
        }),
      );
    } catch {
      /* empty */
    }

    const policyRes = await client.send(
      new CreatePolicyCommand({
        Content:
          '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"*","Resource":"*"}]}',
        Description: "scenario scp",
        Name: "scenario-scp",
        Type: "SERVICE_CONTROL_POLICY",
      }),
    );
    const policyId = policyRes.Policy?.PolicySummary?.Id ?? "";
    expect(policyId).toMatch(/^p-/);

    await client.send(
      new AttachPolicyCommand({ PolicyId: policyId, TargetId: ouId }),
    );

    const policiesForOu = await client.send(
      new ListPoliciesForTargetCommand({
        TargetId: ouId,
        Filter: "SERVICE_CONTROL_POLICY",
      }),
    );
    expect(policiesForOu.Policies?.some((p) => p.Id === policyId)).toBe(true);

    await client.send(
      new DetachPolicyCommand({ PolicyId: policyId, TargetId: ouId }),
    );

    const policiesAfterDetach = await client.send(
      new ListPoliciesForTargetCommand({
        TargetId: ouId,
        Filter: "SERVICE_CONTROL_POLICY",
      }),
    );
    expect(policiesAfterDetach.Policies?.some((p) => p.Id === policyId)).toBe(
      false,
    );

    try {
      await client.send(
        new DeleteOrganizationalUnitCommand({ OrganizationalUnitId: ouId }),
      );
      expect(false).toBe(true);
    } catch (e: unknown) {
      expect((e as Error).name).toBe("OrganizationalUnitNotEmptyException");
    }

    await client.send(
      new MoveAccountCommand({
        AccountId: accountId,
        SourceParentId: ouId,
        DestinationParentId: rootId,
      }),
    );

    const deleted = await client.send(
      new DeleteOrganizationalUnitCommand({ OrganizationalUnitId: ouId }),
    );
    expect(deleted).toBeDefined();
  });
});
