import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateFirewallRuleGroupCommand,
  AssociateResolverQueryLogConfigCommand,
  BatchCreateFirewallRuleCommand,
  BatchDeleteFirewallRuleCommand,
  BatchUpdateFirewallRuleCommand,
  CreateFirewallDomainListCommand,
  CreateFirewallRuleCommand,
  CreateFirewallRuleGroupCommand,
  CreateOutpostResolverCommand,
  CreateResolverQueryLogConfigCommand,
  DeleteFirewallDomainListCommand,
  DeleteFirewallRuleCommand,
  DeleteFirewallRuleGroupCommand,
  DeleteOutpostResolverCommand,
  DeleteResolverQueryLogConfigCommand,
  DisassociateFirewallRuleGroupCommand,
  DisassociateResolverQueryLogConfigCommand,
  GetFirewallConfigCommand,
  GetFirewallDomainListCommand,
  GetFirewallRuleGroupAssociationCommand,
  GetFirewallRuleGroupCommand,
  GetFirewallRuleGroupPolicyCommand,
  GetOutpostResolverCommand,
  GetResolverConfigCommand,
  GetResolverDnssecConfigCommand,
  GetResolverQueryLogConfigAssociationCommand,
  GetResolverQueryLogConfigCommand,
  GetResolverQueryLogConfigPolicyCommand,
  GetResolverRulePolicyCommand,
  ImportFirewallDomainsCommand,
  ListFirewallConfigsCommand,
  ListFirewallDomainListsCommand,
  ListFirewallDomainsCommand,
  ListFirewallRuleGroupAssociationsCommand,
  ListFirewallRuleGroupsCommand,
  ListFirewallRuleTypesCommand,
  ListFirewallRulesCommand,
  ListOutpostResolversCommand,
  ListResolverConfigsCommand,
  ListResolverDnssecConfigsCommand,
  ListResolverQueryLogConfigAssociationsCommand,
  ListResolverQueryLogConfigsCommand,
  PutFirewallRuleGroupPolicyCommand,
  PutResolverQueryLogConfigPolicyCommand,
  PutResolverRulePolicyCommand,
  Route53ResolverClient,
  UpdateFirewallConfigCommand,
  UpdateFirewallDomainsCommand,
  UpdateFirewallRuleCommand,
  UpdateFirewallRuleGroupAssociationCommand,
  UpdateOutpostResolverCommand,
  UpdateResolverConfigCommand,
  UpdateResolverDnssecConfigCommand,
} from "@aws-sdk/client-route53resolver";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new Route53ResolverClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("DNS Firewall lifecycle", async () => {
  const r53 = client();

  const rg = await r53.send(
    new CreateFirewallRuleGroupCommand({
      CreatorRequestId: "fw-rg-1",
      Name: "test-rule-group",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  expect(rg.FirewallRuleGroup?.Id).toBeDefined();
  expect(rg.FirewallRuleGroup?.Status).toBe("COMPLETE");
  const rgId = rg.FirewallRuleGroup?.Id ?? "";

  const rgIdempotent = await r53.send(
    new CreateFirewallRuleGroupCommand({
      CreatorRequestId: "fw-rg-1",
      Name: "different-name",
    }),
  );
  expect(rgIdempotent.FirewallRuleGroup?.Id).toBe(rgId);

  const gotRg = await r53.send(
    new GetFirewallRuleGroupCommand({ FirewallRuleGroupId: rgId }),
  );
  expect(gotRg.FirewallRuleGroup?.Name).toBe("test-rule-group");

  const listedRg = await r53.send(new ListFirewallRuleGroupsCommand({}));
  expect((listedRg.FirewallRuleGroups ?? []).map((g) => g.Id)).toContain(rgId);

  const dl = await r53.send(
    new CreateFirewallDomainListCommand({
      CreatorRequestId: "fw-dl-1",
      Name: "test-domain-list",
    }),
  );
  expect(dl.FirewallDomainList?.Id).toBeDefined();
  const dlId = dl.FirewallDomainList?.Id ?? "";

  const gotDl = await r53.send(
    new GetFirewallDomainListCommand({ FirewallDomainListId: dlId }),
  );
  expect(gotDl.FirewallDomainList?.Name).toBe("test-domain-list");

  await r53.send(
    new UpdateFirewallDomainsCommand({
      FirewallDomainListId: dlId,
      Operation: "ADD",
      Domains: ["example.com", "test.org"],
    }),
  );

  const listedDomains = await r53.send(
    new ListFirewallDomainsCommand({ FirewallDomainListId: dlId }),
  );
  expect(listedDomains.Domains).toContain("example.com");
  expect(listedDomains.Domains).toContain("test.org");

  await r53.send(
    new ImportFirewallDomainsCommand({
      FirewallDomainListId: dlId,
      Operation: "REPLACE",
      DomainFileUrl: "s3://mybucket/domains.txt",
    }),
  );

  const listedDls = await r53.send(new ListFirewallDomainListsCommand({}));
  expect((listedDls.FirewallDomainLists ?? []).map((d) => d.Id)).toContain(
    dlId,
  );

  const rule = await r53.send(
    new CreateFirewallRuleCommand({
      CreatorRequestId: "fw-rule-1",
      FirewallRuleGroupId: rgId,
      FirewallDomainListId: dlId,
      Priority: 100,
      Action: "BLOCK",
      BlockResponse: "NXDOMAIN",
      Name: "block-rule",
    }),
  );
  expect(rule.FirewallRule?.Action).toBe("BLOCK");
  expect(rule.FirewallRule?.Priority).toBe(100);

  await r53.send(
    new UpdateFirewallRuleCommand({
      FirewallRuleGroupId: rgId,
      FirewallDomainListId: dlId,
      Priority: 200,
    }),
  );

  const listedRules = await r53.send(
    new ListFirewallRulesCommand({ FirewallRuleGroupId: rgId }),
  );
  expect(listedRules.FirewallRules?.length).toBeGreaterThanOrEqual(1);

  const dl2 = await r53.send(
    new CreateFirewallDomainListCommand({
      CreatorRequestId: "fw-dl-batch",
      Name: "batch-domain-list",
    }),
  );
  const dl2Id = dl2.FirewallDomainList?.Id ?? "";

  const batchCreated = await r53.send(
    new BatchCreateFirewallRuleCommand({
      CreateFirewallRuleEntries: [
        {
          FirewallRuleGroupId: rgId,
          FirewallDomainListId: dl2Id,
          Priority: 300,
          Action: "ALLOW",
          Name: "allow-rule",
          CreatorRequestId: "fw-rule-batch-1",
        },
      ],
    }),
  );
  expect(batchCreated.CreatedFirewallRules?.length).toBe(1);

  await r53.send(
    new BatchUpdateFirewallRuleCommand({
      UpdateFirewallRuleEntries: [
        {
          FirewallRuleGroupId: rgId,
          FirewallDomainListId: dl2Id,
          Priority: 350,
          Action: "ALLOW",
          Name: "allow-rule-updated",
        },
      ],
    }),
  );

  await r53.send(
    new BatchDeleteFirewallRuleCommand({
      DeleteFirewallRuleEntries: [
        { FirewallRuleGroupId: rgId, FirewallDomainListId: dl2Id },
      ],
    }),
  );

  const assoc = await r53.send(
    new AssociateFirewallRuleGroupCommand({
      CreatorRequestId: "fw-assoc-1",
      FirewallRuleGroupId: rgId,
      VpcId: "vpc-abc123",
      Priority: 101,
      Name: "test-assoc",
    }),
  );
  expect(assoc.FirewallRuleGroupAssociation?.Id).toBeDefined();
  const assocId = assoc.FirewallRuleGroupAssociation?.Id ?? "";

  const gotAssoc = await r53.send(
    new GetFirewallRuleGroupAssociationCommand({
      FirewallRuleGroupAssociationId: assocId,
    }),
  );
  expect(gotAssoc.FirewallRuleGroupAssociation?.VpcId).toBe("vpc-abc123");

  const listedAssocs = await r53.send(
    new ListFirewallRuleGroupAssociationsCommand({ VpcId: "vpc-abc123" }),
  );
  expect(
    (listedAssocs.FirewallRuleGroupAssociations ?? []).map((a) => a.Id),
  ).toContain(assocId);

  await r53.send(
    new UpdateFirewallRuleGroupAssociationCommand({
      FirewallRuleGroupAssociationId: assocId,
      Priority: 200,
    }),
  );

  await r53.send(
    new DisassociateFirewallRuleGroupCommand({
      FirewallRuleGroupAssociationId: assocId,
    }),
  );

  const listedAssocsAfter = await r53.send(
    new ListFirewallRuleGroupAssociationsCommand({}),
  );
  expect(
    (listedAssocsAfter.FirewallRuleGroupAssociations ?? []).map((a) => a.Id),
  ).not.toContain(assocId);

  const rgArn = rg.FirewallRuleGroup?.Arn ?? "";
  await r53.send(
    new PutFirewallRuleGroupPolicyCommand({
      Arn: rgArn,
      FirewallRuleGroupPolicy: '{"Version":"2012-10-17","Statement":[]}',
    }),
  );

  const policy = await r53.send(
    new GetFirewallRuleGroupPolicyCommand({ Arn: rgArn }),
  );
  expect(policy.FirewallRuleGroupPolicy).toContain("2012-10-17");

  const fwConfig = await r53.send(
    new GetFirewallConfigCommand({ ResourceId: "vpc-abc123" }),
  );
  expect(fwConfig.FirewallConfig?.FirewallFailOpen).toBe("DISABLED");

  await r53.send(
    new UpdateFirewallConfigCommand({
      ResourceId: "vpc-abc123",
      FirewallFailOpen: "ENABLED",
    }),
  );

  const fwConfigUpdated = await r53.send(
    new GetFirewallConfigCommand({ ResourceId: "vpc-abc123" }),
  );
  expect(fwConfigUpdated.FirewallConfig?.FirewallFailOpen).toBe("ENABLED");

  const listedFwConfigs = await r53.send(new ListFirewallConfigsCommand({}));
  expect(listedFwConfigs.FirewallConfigs?.length).toBeGreaterThanOrEqual(1);

  const ruleTypes = await r53.send(new ListFirewallRuleTypesCommand({}));
  expect(ruleTypes.FirewallRuleTypes).toBeDefined();

  await r53.send(
    new DeleteFirewallRuleCommand({
      FirewallRuleGroupId: rgId,
      FirewallDomainListId: dlId,
    }),
  );

  await expect(
    r53.send(
      new DeleteFirewallDomainListCommand({ FirewallDomainListId: dl2Id }),
    ),
  ).resolves.toBeDefined();

  await r53.send(
    new DeleteFirewallDomainListCommand({ FirewallDomainListId: dlId }),
  );

  await r53.send(
    new DeleteFirewallRuleGroupCommand({ FirewallRuleGroupId: rgId }),
  );

  await expect(
    r53.send(new GetFirewallRuleGroupCommand({ FirewallRuleGroupId: rgId })),
  ).rejects.toThrow();
});

test("Query log config lifecycle", async () => {
  const r53 = client();

  const cfg = await r53.send(
    new CreateResolverQueryLogConfigCommand({
      Name: "test-qlconfig",
      DestinationArn: "arn:aws:s3:::my-log-bucket",
      CreatorRequestId: "ql-cfg-1",
    }),
  );
  expect(cfg.ResolverQueryLogConfig?.Id).toBeDefined();
  expect(cfg.ResolverQueryLogConfig?.Status).toBe("CREATED");
  const cfgId = cfg.ResolverQueryLogConfig?.Id ?? "";

  const cfgIdempotent = await r53.send(
    new CreateResolverQueryLogConfigCommand({
      Name: "different-name",
      DestinationArn: "arn:aws:s3:::my-log-bucket",
      CreatorRequestId: "ql-cfg-1",
    }),
  );
  expect(cfgIdempotent.ResolverQueryLogConfig?.Id).toBe(cfgId);

  const gotCfg = await r53.send(
    new GetResolverQueryLogConfigCommand({
      ResolverQueryLogConfigId: cfgId,
    }),
  );
  expect(gotCfg.ResolverQueryLogConfig?.Name).toBe("test-qlconfig");

  const listedCfgs = await r53.send(new ListResolverQueryLogConfigsCommand({}));
  expect((listedCfgs.ResolverQueryLogConfigs ?? []).map((c) => c.Id)).toContain(
    cfgId,
  );

  const assoc = await r53.send(
    new AssociateResolverQueryLogConfigCommand({
      ResolverQueryLogConfigId: cfgId,
      ResourceId: "vpc-log-001",
    }),
  );
  expect(assoc.ResolverQueryLogConfigAssociation?.Id).toBeDefined();
  const assocId = assoc.ResolverQueryLogConfigAssociation?.Id ?? "";

  await expect(
    r53.send(
      new AssociateResolverQueryLogConfigCommand({
        ResolverQueryLogConfigId: cfgId,
        ResourceId: "vpc-log-001",
      }),
    ),
  ).rejects.toThrow();

  const gotAssoc = await r53.send(
    new GetResolverQueryLogConfigAssociationCommand({
      ResolverQueryLogConfigAssociationId: assocId,
    }),
  );
  expect(gotAssoc.ResolverQueryLogConfigAssociation?.ResourceId).toBe(
    "vpc-log-001",
  );

  const listedAssocs = await r53.send(
    new ListResolverQueryLogConfigAssociationsCommand({}),
  );
  expect(
    (listedAssocs.ResolverQueryLogConfigAssociations ?? []).map((a) => a.Id),
  ).toContain(assocId);

  const cfgArn = cfg.ResolverQueryLogConfig?.Arn ?? "";
  await r53.send(
    new PutResolverQueryLogConfigPolicyCommand({
      Arn: cfgArn,
      ResolverQueryLogConfigPolicy: '{"Version":"2012-10-17","Statement":[]}',
    }),
  );

  const qlPolicy = await r53.send(
    new GetResolverQueryLogConfigPolicyCommand({ Arn: cfgArn }),
  );
  expect(qlPolicy.ResolverQueryLogConfigPolicy).toContain("2012-10-17");

  await r53.send(
    new DisassociateResolverQueryLogConfigCommand({
      ResolverQueryLogConfigId: cfgId,
      ResourceId: "vpc-log-001",
    }),
  );

  await r53.send(
    new DeleteResolverQueryLogConfigCommand({
      ResolverQueryLogConfigId: cfgId,
    }),
  );

  await expect(
    r53.send(
      new GetResolverQueryLogConfigCommand({
        ResolverQueryLogConfigId: cfgId,
      }),
    ),
  ).rejects.toThrow();
});

test("per-VPC singleton configs", async () => {
  const r53 = client();

  const resolverCfg = await r53.send(
    new GetResolverConfigCommand({ ResourceId: "vpc-singleton-1" }),
  );
  expect(resolverCfg.ResolverConfig?.AutodefinedReverse).toBe("ENABLED");

  await r53.send(
    new UpdateResolverConfigCommand({
      ResourceId: "vpc-singleton-1",
      AutodefinedReverseFlag: "DISABLE",
    }),
  );

  const updatedResolverCfg = await r53.send(
    new GetResolverConfigCommand({ ResourceId: "vpc-singleton-1" }),
  );
  expect(updatedResolverCfg.ResolverConfig?.AutodefinedReverse).toBe(
    "DISABLED",
  );

  const listedResolverCfgs = await r53.send(new ListResolverConfigsCommand({}));
  expect(listedResolverCfgs.ResolverConfigs?.length).toBeGreaterThanOrEqual(1);

  const dnssecCfg = await r53.send(
    new GetResolverDnssecConfigCommand({ ResourceId: "vpc-singleton-2" }),
  );
  expect(dnssecCfg.ResolverDNSSECConfig?.ValidationStatus).toBe("ENABLED");

  const updatedDnssec = await r53.send(
    new UpdateResolverDnssecConfigCommand({
      ResourceId: "vpc-singleton-2",
      Validation: "DISABLE",
    }),
  );
  expect(updatedDnssec.ResolverDNSSECConfig?.ValidationStatus).toBe(
    "DISABLING",
  );

  const listedDnssec = await r53.send(new ListResolverDnssecConfigsCommand({}));
  expect(listedDnssec.ResolverDnssecConfigs?.length).toBeGreaterThanOrEqual(1);
});

test("Outpost resolver lifecycle", async () => {
  const r53 = client();

  const outpost = await r53.send(
    new CreateOutpostResolverCommand({
      CreatorRequestId: "outpost-1",
      Name: "test-outpost",
      PreferredInstanceType: "m5.large",
      OutpostArn: "arn:aws:outposts:us-east-1:123456789012:outpost/op-abc123",
    }),
  );
  expect(outpost.OutpostResolver?.Id).toBeDefined();
  expect(outpost.OutpostResolver?.Status).toBe("OPERATIONAL");
  const outpostId = outpost.OutpostResolver?.Id ?? "";

  const outpostIdempotent = await r53.send(
    new CreateOutpostResolverCommand({
      CreatorRequestId: "outpost-1",
      Name: "different-name",
      PreferredInstanceType: "m5.large",
      OutpostArn: "arn:aws:outposts:us-east-1:123456789012:outpost/op-abc123",
    }),
  );
  expect(outpostIdempotent.OutpostResolver?.Id).toBe(outpostId);

  const gotOutpost = await r53.send(
    new GetOutpostResolverCommand({ Id: outpostId }),
  );
  expect(gotOutpost.OutpostResolver?.Name).toBe("test-outpost");

  const listed = await r53.send(new ListOutpostResolversCommand({}));
  expect((listed.OutpostResolvers ?? []).map((o) => o.Id)).toContain(outpostId);

  await r53.send(
    new UpdateOutpostResolverCommand({
      Id: outpostId,
      Name: "updated-outpost",
      InstanceCount: 6,
    }),
  );

  await r53.send(new DeleteOutpostResolverCommand({ Id: outpostId }));

  await expect(
    r53.send(new GetOutpostResolverCommand({ Id: outpostId })),
  ).rejects.toThrow();
});

test("Resolver rule policy", async () => {
  const r53 = client();

  const arn =
    "arn:aws:route53resolver:us-east-1:123456789012:resolver-rule/rslvr-00000001";

  await r53.send(
    new PutResolverRulePolicyCommand({
      Arn: arn,
      ResolverRulePolicy: '{"Version":"2012-10-17","Statement":[]}',
    }),
  );

  const pol = await r53.send(new GetResolverRulePolicyCommand({ Arn: arn }));
  expect(pol.ResolverRulePolicy).toContain("2012-10-17");
});
