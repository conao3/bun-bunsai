import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateFirewallPolicyCommand,
  CreateFirewallCommand,
  CreateFirewallPolicyCommand,
  CreateProxyRuleGroupCommand,
  CreateProxyRulesCommand,
  CreateRuleGroupCommand,
  CreateTLSInspectionConfigurationCommand,
  DeleteFirewallCommand,
  DeleteFirewallPolicyCommand,
  DeleteProxyRuleGroupCommand,
  DeleteResourcePolicyCommand,
  DeleteRuleGroupCommand,
  DeleteTLSInspectionConfigurationCommand,
  DescribeFirewallCommand,
  DescribeFirewallPolicyCommand,
  DescribeLoggingConfigurationCommand,
  DescribeProxyRuleCommand,
  DescribeResourcePolicyCommand,
  DescribeRuleGroupCommand,
  DescribeTLSInspectionConfigurationCommand,
  ListFirewallPoliciesCommand,
  ListFirewallsCommand,
  ListRuleGroupsCommand,
  ListTLSInspectionConfigurationsCommand,
  ListTagsForResourceCommand,
  NetworkFirewallClient,
  PutResourcePolicyCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateFirewallDeleteProtectionCommand,
  UpdateFirewallPolicyCommand,
  UpdateLoggingConfigurationCommand,
  UpdateProxyRuleCommand,
  UpdateRuleGroupCommand,
  UpdateTLSInspectionConfigurationCommand,
} from "@aws-sdk/client-network-firewall";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("network-firewall e2e", () => {
  const firewall = () =>
    new NetworkFirewallClient({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("create, describe, list and delete a firewall", async () => {
    const client = firewall();
    const name = `bunsai-fw-${Date.now()}`;
    const policyArn =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall-policy/bunsai";

    const created = await client.send(
      new CreateFirewallCommand({
        FirewallName: name,
        FirewallPolicyArn: policyArn,
        VpcId: "vpc-0123456789abcdef0",
        SubnetMappings: [{ SubnetId: "subnet-0123456789abcdef0" }],
      }),
    );
    expect(created.Firewall?.FirewallName).toBe(name);
    expect(created.Firewall?.FirewallArn).toContain(name);
    expect(created.Firewall?.FirewallPolicyArn).toBe(policyArn);
    expect(created.Firewall?.FirewallId).toBeDefined();
    expect(created.FirewallStatus?.Status).toBe("READY");

    const described = await client.send(
      new DescribeFirewallCommand({ FirewallName: name }),
    );
    expect(described.Firewall?.FirewallName).toBe(name);
    expect(described.Firewall?.VpcId).toBe("vpc-0123456789abcdef0");
    expect(described.FirewallStatus?.Status).toBe("READY");
    expect(described.UpdateToken).toBeDefined();

    const arn = created.Firewall?.FirewallArn;
    const describedByArn = await client.send(
      new DescribeFirewallCommand({ FirewallArn: arn }),
    );
    expect(describedByArn.Firewall?.FirewallName).toBe(name);

    const listed = await client.send(new ListFirewallsCommand({}));
    const names = (listed.Firewalls ?? []).map((entry) => entry.FirewallName);
    expect(names).toContain(name);

    const deleted = await client.send(
      new DeleteFirewallCommand({ FirewallName: name }),
    );
    expect(deleted.Firewall?.FirewallName).toBe(name);
    expect(deleted.FirewallStatus?.Status).toBe("DELETING");

    const afterDelete = await client.send(new ListFirewallsCommand({}));
    const afterNames = (afterDelete.Firewalls ?? []).map(
      (entry) => entry.FirewallName,
    );
    expect(afterNames).not.toContain(name);
  });

  test("firewall-policy lifecycle: create, describe, list, update, delete", async () => {
    const client = firewall();
    const name = `bunsai-fp-${Date.now()}`;

    const created = await client.send(
      new CreateFirewallPolicyCommand({
        FirewallPolicyName: name,
        FirewallPolicy: {
          StatelessDefaultActions: ["aws:drop"],
          StatelessFragmentDefaultActions: ["aws:drop"],
        },
        Description: "initial",
      }),
    );
    expect(created.FirewallPolicyResponse?.FirewallPolicyName).toBe(name);
    expect(created.FirewallPolicyResponse?.FirewallPolicyArn).toContain(name);
    expect(created.UpdateToken).toBeDefined();

    const described = await client.send(
      new DescribeFirewallPolicyCommand({ FirewallPolicyName: name }),
    );
    expect(described.FirewallPolicyResponse?.FirewallPolicyStatus).toBe(
      "ACTIVE",
    );
    expect(described.UpdateToken).toBeDefined();

    const listed = await client.send(new ListFirewallPoliciesCommand({}));
    const policyNames = (listed.FirewallPolicies ?? []).map(
      (entry) => entry.Name,
    );
    expect(policyNames).toContain(name);

    const updated = await client.send(
      new UpdateFirewallPolicyCommand({
        FirewallPolicyName: name,
        FirewallPolicy: {
          StatelessDefaultActions: ["aws:pass"],
          StatelessFragmentDefaultActions: ["aws:pass"],
        },
        UpdateToken: created.UpdateToken,
      }),
    );
    expect(updated.UpdateToken).not.toBe(created.UpdateToken);

    const deleted = await client.send(
      new DeleteFirewallPolicyCommand({ FirewallPolicyName: name }),
    );
    expect(deleted.FirewallPolicyResponse?.FirewallPolicyStatus).toBe(
      "DELETING",
    );
  });

  test("rule-group lifecycle: create, describe, list, update, delete", async () => {
    const client = firewall();
    const name = `bunsai-rg-${Date.now()}`;

    const created = await client.send(
      new CreateRuleGroupCommand({
        RuleGroupName: name,
        Type: "STATELESS",
        Capacity: 100,
        Description: "initial",
      }),
    );
    expect(created.RuleGroupResponse?.RuleGroupName).toBe(name);
    expect(created.RuleGroupResponse?.RuleGroupStatus).toBe("ACTIVE");
    expect(created.UpdateToken).toBeDefined();

    const described = await client.send(
      new DescribeRuleGroupCommand({ RuleGroupName: name }),
    );
    expect(described.RuleGroupResponse?.Type).toBe("STATELESS");
    expect(described.RuleGroupResponse?.Capacity).toBe(100);

    const listed = await client.send(new ListRuleGroupsCommand({}));
    const groupNames = (listed.RuleGroups ?? []).map((entry) => entry.Name);
    expect(groupNames).toContain(name);

    const updated = await client.send(
      new UpdateRuleGroupCommand({
        RuleGroupName: name,
        Description: "updated",
        UpdateToken: created.UpdateToken,
      }),
    );
    expect(updated.UpdateToken).not.toBe(created.UpdateToken);

    const deleted = await client.send(
      new DeleteRuleGroupCommand({ RuleGroupName: name }),
    );
    expect(deleted.RuleGroupResponse?.RuleGroupStatus).toBe("DELETING");
  });

  test("TLS-inspection-config lifecycle: create, describe, list, update, delete", async () => {
    const client = firewall();
    const name = `bunsai-tls-${Date.now()}`;

    const created = await client.send(
      new CreateTLSInspectionConfigurationCommand({
        TLSInspectionConfigurationName: name,
        TLSInspectionConfiguration: { ServerCertificateConfigurations: [] },
      }),
    );
    expect(
      created.TLSInspectionConfigurationResponse
        ?.TLSInspectionConfigurationName,
    ).toBe(name);
    expect(
      created.TLSInspectionConfigurationResponse
        ?.TLSInspectionConfigurationStatus,
    ).toBe("ACTIVE");
    expect(created.UpdateToken).toBeDefined();

    const described = await client.send(
      new DescribeTLSInspectionConfigurationCommand({
        TLSInspectionConfigurationName: name,
      }),
    );
    expect(
      described.TLSInspectionConfigurationResponse
        ?.TLSInspectionConfigurationArn,
    ).toContain(name);

    const listed = await client.send(
      new ListTLSInspectionConfigurationsCommand({}),
    );
    const configNames = (listed.TLSInspectionConfigurations ?? []).map(
      (entry) => entry.Name,
    );
    expect(configNames).toContain(name);

    const updated = await client.send(
      new UpdateTLSInspectionConfigurationCommand({
        TLSInspectionConfigurationName: name,
        TLSInspectionConfiguration: { ServerCertificateConfigurations: [] },
        UpdateToken: created.UpdateToken,
      }),
    );
    expect(updated.UpdateToken).not.toBe(created.UpdateToken);

    const deleted = await client.send(
      new DeleteTLSInspectionConfigurationCommand({
        TLSInspectionConfigurationName: name,
      }),
    );
    expect(
      deleted.TLSInspectionConfigurationResponse
        ?.TLSInspectionConfigurationStatus,
    ).toBe("DELETING");
  });

  test("firewall: associate-policy, update-delete-protection, logging-config", async () => {
    const client = firewall();
    const fwName = `bunsai-fw2-${Date.now()}`;
    const oldPolicy =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall-policy/old";
    const newPolicy =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall-policy/new";

    await client.send(
      new CreateFirewallCommand({
        FirewallName: fwName,
        FirewallPolicyArn: oldPolicy,
        VpcId: "vpc-aabbccdd",
        SubnetMappings: [{ SubnetId: "subnet-aabbccdd" }],
      }),
    );

    const associated = await client.send(
      new AssociateFirewallPolicyCommand({
        FirewallName: fwName,
        FirewallPolicyArn: newPolicy,
      }),
    );
    expect(associated.FirewallPolicyArn).toBe(newPolicy);

    const protection = await client.send(
      new UpdateFirewallDeleteProtectionCommand({
        FirewallName: fwName,
        DeleteProtection: true,
      }),
    );
    expect(protection.DeleteProtection).toBe(true);

    const loggingConfig = {
      LogDestinationConfigs: [
        {
          LogType: "ALERT" as const,
          LogDestinationType: "CloudWatchLogs" as const,
          LogDestination: { logGroup: "/aws/network-firewall/alerts" },
        },
      ],
    };
    const logging = await client.send(
      new UpdateLoggingConfigurationCommand({
        FirewallName: fwName,
        LoggingConfiguration: loggingConfig,
      }),
    );
    expect(logging.FirewallName).toBe(fwName);

    const described = await client.send(
      new DescribeLoggingConfigurationCommand({ FirewallName: fwName }),
    );
    expect(described.FirewallArn).toContain(fwName);

    await client.send(
      new UpdateFirewallDeleteProtectionCommand({
        FirewallName: fwName,
        DeleteProtection: false,
      }),
    );
    await client.send(new DeleteFirewallCommand({ FirewallName: fwName }));
  });

  test("resource-policy: put, describe, delete", async () => {
    const client = firewall();
    const resourceArn =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall-policy/shared";
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }],
    });

    await client.send(
      new PutResourcePolicyCommand({
        ResourceArn: resourceArn,
        Policy: policy,
      }),
    );

    const described = await client.send(
      new DescribeResourcePolicyCommand({ ResourceArn: resourceArn }),
    );
    expect(described.Policy).toBe(policy);

    await client.send(
      new DeleteResourcePolicyCommand({ ResourceArn: resourceArn }),
    );
  });

  test("ListFirewalls: pagination and VpcIds filter", async () => {
    const client = firewall();
    const policyArn =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall-policy/pag-test";
    const prefix = `bunsai-pag-${Date.now()}`;
    const vpcA = "vpc-aaa0000000000000a";
    const vpcB = "vpc-bbb0000000000000b";

    const nameA = `${prefix}-a`;
    const nameB = `${prefix}-b`;
    await client.send(
      new CreateFirewallCommand({
        FirewallName: nameA,
        FirewallPolicyArn: policyArn,
        VpcId: vpcA,
        SubnetMappings: [{ SubnetId: "subnet-aa" }],
      }),
    );
    await client.send(
      new CreateFirewallCommand({
        FirewallName: nameB,
        FirewallPolicyArn: policyArn,
        VpcId: vpcB,
        SubnetMappings: [{ SubnetId: "subnet-bb" }],
      }),
    );

    const page1 = await client.send(
      new ListFirewallsCommand({ MaxResults: 1 }),
    );
    expect((page1.Firewalls ?? []).length).toBe(1);
    expect(page1.NextToken).toBeDefined();

    const page2 = await client.send(
      new ListFirewallsCommand({ NextToken: page1.NextToken }),
    );
    expect((page2.Firewalls ?? []).length).toBeGreaterThanOrEqual(1);

    const filtered = await client.send(
      new ListFirewallsCommand({ VpcIds: [vpcA] }),
    );
    const filteredNames = (filtered.Firewalls ?? []).map((f) => f.FirewallName);
    expect(filteredNames).toContain(nameA);
    expect(filteredNames).not.toContain(nameB);

    await client.send(new DeleteFirewallCommand({ FirewallName: nameA }));
    await client.send(new DeleteFirewallCommand({ FirewallName: nameB }));
  });

  test("UpdateFirewallPolicy: stale UpdateToken → InvalidTokenException", async () => {
    const client = firewall();
    const name = `bunsai-fp-tok-${Date.now()}`;

    const created = await client.send(
      new CreateFirewallPolicyCommand({
        FirewallPolicyName: name,
        FirewallPolicy: {
          StatelessDefaultActions: ["aws:drop"],
          StatelessFragmentDefaultActions: ["aws:drop"],
        },
      }),
    );
    expect(created.UpdateToken).toBeDefined();

    const staleToken = "stale-token-xyz";
    await expect(
      client.send(
        new UpdateFirewallPolicyCommand({
          FirewallPolicyName: name,
          FirewallPolicy: {
            StatelessDefaultActions: ["aws:pass"],
            StatelessFragmentDefaultActions: ["aws:pass"],
          },
          UpdateToken: staleToken,
        }),
      ),
    ).rejects.toThrow();

    await client.send(
      new DeleteFirewallPolicyCommand({ FirewallPolicyName: name }),
    );
  });

  test("proxy rule group: create rules, describe, update, delete round-trip", async () => {
    const client = firewall();
    const groupName = `bunsai-prg-${Date.now()}`;
    const ruleName = "test-rule";

    const createdGroup = await client.send(
      new CreateProxyRuleGroupCommand({ ProxyRuleGroupName: groupName }),
    );
    expect(createdGroup.ProxyRuleGroup?.ProxyRuleGroupName).toBe(groupName);
    expect(createdGroup.UpdateToken).toBeDefined();

    const createdRules = await client.send(
      new CreateProxyRulesCommand({
        ProxyRuleGroupName: groupName,
        Rules: {
          PreDNS: [
            {
              ProxyRuleName: ruleName,
              Action: "ALLOW",
              Conditions: [],
            },
          ],
        },
      }),
    );
    expect(createdRules.ProxyRuleGroup?.ProxyRuleGroupName).toBe(groupName);

    const described = await client.send(
      new DescribeProxyRuleCommand({
        ProxyRuleGroupName: groupName,
        ProxyRuleName: ruleName,
      }),
    );
    expect(described.ProxyRule?.ProxyRuleName).toBe(ruleName);
    expect(described.ProxyRule?.Action).toBe("ALLOW");
    expect(described.UpdateToken).toBeDefined();

    const updated = await client.send(
      new UpdateProxyRuleCommand({
        ProxyRuleGroupName: groupName,
        ProxyRuleName: ruleName,
        Action: "DENY",
        UpdateToken: described.UpdateToken,
      }),
    );
    expect(updated.ProxyRule?.Action).toBe("DENY");
    expect(updated.UpdateToken).not.toBe(described.UpdateToken);

    await expect(
      client.send(
        new UpdateProxyRuleCommand({
          ProxyRuleGroupName: groupName,
          ProxyRuleName: ruleName,
          Action: "ALLOW",
          UpdateToken: described.UpdateToken,
        }),
      ),
    ).rejects.toThrow();

    await client.send(
      new DeleteProxyRuleGroupCommand({ ProxyRuleGroupName: groupName }),
    );
  });

  test("tags: tag, list, untag", async () => {
    const client = firewall();
    const resourceArn =
      "arn:aws:network-firewall:us-east-1:000000000000:firewall/tagged";

    await client.send(
      new TagResourceCommand({
        ResourceArn: resourceArn,
        Tags: [
          { Key: "Env", Value: "test" },
          { Key: "Owner", Value: "bunsai" },
        ],
      }),
    );

    const listed = await client.send(
      new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
    );
    const tagKeys = (listed.Tags ?? []).map((t) => t.Key);
    expect(tagKeys).toContain("Env");
    expect(tagKeys).toContain("Owner");

    await client.send(
      new UntagResourceCommand({
        ResourceArn: resourceArn,
        TagKeys: ["Owner"],
      }),
    );

    const afterUntag = await client.send(
      new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
    );
    const afterKeys = (afterUntag.Tags ?? []).map((t) => t.Key);
    expect(afterKeys).toContain("Env");
    expect(afterKeys).not.toContain("Owner");
  });
});
