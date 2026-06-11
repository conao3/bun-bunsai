import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateResolverEndpointIpAddressCommand,
  AssociateResolverRuleCommand,
  CreateResolverEndpointCommand,
  CreateResolverRuleCommand,
  DeleteResolverEndpointCommand,
  DeleteResolverRuleCommand,
  DisassociateResolverEndpointIpAddressCommand,
  GetResolverEndpointCommand,
  GetResolverRuleAssociationCommand,
  ListResolverEndpointIpAddressesCommand,
  ListResolverRulesCommand,
  ListTagsForResourceCommand,
  Route53ResolverClient,
  TagResourceCommand,
  UntagResourceCommand,
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

test("r53r-002: DeleteResolverEndpoint rejects when a rule references it", async () => {
  const r53 = client();

  const ep = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-002-ep-1",
      Name: "outbound-ep-in-use",
      SecurityGroupIds: ["sg-inuse"],
      Direction: "OUTBOUND",
      IpAddresses: [
        { SubnetId: "subnet-a", Ip: "10.2.1.10" },
        { SubnetId: "subnet-b", Ip: "10.2.2.10" },
      ],
    }),
  );
  const epId = ep.ResolverEndpoint?.Id ?? "";

  const rule = await r53.send(
    new CreateResolverRuleCommand({
      CreatorRequestId: "r53r-002-rule-1",
      Name: "rule-referencing-ep",
      RuleType: "FORWARD",
      DomainName: "guarded.example.com",
      ResolverEndpointId: epId,
      TargetIps: [{ Ip: "1.2.3.4", Port: 53 }],
    }),
  );
  const ruleId = rule.ResolverRule?.Id ?? "";

  await expect(
    r53.send(new DeleteResolverEndpointCommand({ ResolverEndpointId: epId })),
  ).rejects.toThrow();

  await r53.send(new DeleteResolverRuleCommand({ ResolverRuleId: ruleId }));

  await r53.send(
    new DeleteResolverEndpointCommand({ ResolverEndpointId: epId }),
  );

  await expect(
    r53.send(new GetResolverEndpointCommand({ ResolverEndpointId: epId })),
  ).rejects.toThrow();
});

test("r53r-003: FORWARD rule requires TargetIps", async () => {
  const r53 = client();

  await expect(
    r53.send(
      new CreateResolverRuleCommand({
        CreatorRequestId: "r53r-003-forward-no-targets",
        Name: "forward-no-targets",
        RuleType: "FORWARD",
        DomainName: "noop.example.com",
      }),
    ),
  ).rejects.toThrow();
});

test("r53r-003: SYSTEM rule rejects TargetIps and ResolverEndpointId", async () => {
  const r53 = client();

  await expect(
    r53.send(
      new CreateResolverRuleCommand({
        CreatorRequestId: "r53r-003-system-with-targets",
        Name: "system-with-targets",
        RuleType: "SYSTEM",
        DomainName: "local.example.com",
        TargetIps: [{ Ip: "1.2.3.4", Port: 53 }],
      }),
    ),
  ).rejects.toThrow();

  const ep = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-003-ep-for-system",
      Name: "ep-for-system-rule-test",
      SecurityGroupIds: ["sg-system"],
      Direction: "OUTBOUND",
      IpAddresses: [
        { SubnetId: "subnet-s1", Ip: "10.3.1.10" },
        { SubnetId: "subnet-s2", Ip: "10.3.2.10" },
      ],
    }),
  );
  const epId = ep.ResolverEndpoint?.Id ?? "";

  await expect(
    r53.send(
      new CreateResolverRuleCommand({
        CreatorRequestId: "r53r-003-system-with-ep",
        Name: "system-with-ep",
        RuleType: "SYSTEM",
        DomainName: "ep.example.com",
        ResolverEndpointId: epId,
      }),
    ),
  ).rejects.toThrow();
});

test("r53r-003: ResolverEndpointId must be OUTBOUND", async () => {
  const r53 = client();

  const inboundEp = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-003-inbound-ep",
      Name: "inbound-ep-for-rule",
      SecurityGroupIds: ["sg-inbound"],
      Direction: "INBOUND",
      IpAddresses: [
        { SubnetId: "subnet-i1", Ip: "10.4.1.10" },
        { SubnetId: "subnet-i2", Ip: "10.4.2.10" },
      ],
    }),
  );
  const inboundId = inboundEp.ResolverEndpoint?.Id ?? "";

  await expect(
    r53.send(
      new CreateResolverRuleCommand({
        CreatorRequestId: "r53r-003-forward-inbound-ep",
        Name: "rule-with-inbound-ep",
        RuleType: "FORWARD",
        DomainName: "check.example.com",
        ResolverEndpointId: inboundId,
        TargetIps: [{ Ip: "8.8.8.8", Port: 53 }],
      }),
    ),
  ).rejects.toThrow();
});

test("r53r-004: Create returns CREATING, Get promotes to OPERATIONAL/COMPLETE", async () => {
  const r53 = client();

  const ep = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-004-ep",
      Name: "ep-creating",
      SecurityGroupIds: ["sg-004"],
      Direction: "OUTBOUND",
      IpAddresses: [
        { SubnetId: "subnet-004a", Ip: "10.5.1.10" },
        { SubnetId: "subnet-004b", Ip: "10.5.2.10" },
      ],
    }),
  );
  expect(ep.ResolverEndpoint?.Status).toBe("CREATING");
  const epId = ep.ResolverEndpoint?.Id ?? "";

  const gotEp = await r53.send(
    new GetResolverEndpointCommand({ ResolverEndpointId: epId }),
  );
  expect(gotEp.ResolverEndpoint?.Status).toBe("OPERATIONAL");

  const rule = await r53.send(
    new CreateResolverRuleCommand({
      CreatorRequestId: "r53r-004-rule",
      Name: "rule-creating",
      RuleType: "FORWARD",
      DomainName: "creating.example.com",
      ResolverEndpointId: epId,
      TargetIps: [{ Ip: "1.1.1.1", Port: 53 }],
    }),
  );
  expect(String(rule.ResolverRule?.Status)).toBe("CREATING");
  const ruleId = rule.ResolverRule?.Id ?? "";

  const assoc = await r53.send(
    new AssociateResolverRuleCommand({
      ResolverRuleId: ruleId,
      VPCId: "vpc-004",
      Name: "assoc-creating",
    }),
  );
  expect(String(assoc.ResolverRuleAssociation?.Status)).toBe("CREATING");
  const assocId = assoc.ResolverRuleAssociation?.Id ?? "";

  const gotAssoc = await r53.send(
    new GetResolverRuleAssociationCommand({
      ResolverRuleAssociationId: assocId,
    }),
  );
  expect(gotAssoc.ResolverRuleAssociation?.Status).toBe("COMPLETE");
});

test("r53r-005: CreatorRequestId reuse throws ResourceExistsException", async () => {
  const r53 = client();

  await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-005-ep-unique",
      Name: "ep-first",
      SecurityGroupIds: ["sg-005"],
      Direction: "INBOUND",
      IpAddresses: [
        { SubnetId: "subnet-005a", Ip: "10.6.1.10" },
        { SubnetId: "subnet-005b", Ip: "10.6.2.10" },
      ],
    }),
  );

  await expect(
    r53.send(
      new CreateResolverEndpointCommand({
        CreatorRequestId: "r53r-005-ep-unique",
        Name: "ep-duplicate",
        SecurityGroupIds: ["sg-005"],
        Direction: "INBOUND",
        IpAddresses: [
          { SubnetId: "subnet-005a", Ip: "10.6.1.10" },
          { SubnetId: "subnet-005b", Ip: "10.6.2.10" },
        ],
      }),
    ),
  ).rejects.toThrow();
});

test("r53r-006: ListResolverRules filter: Type alias, case normalization, DomainName dot, unknown filter", async () => {
  const r53 = client();

  const ep = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-006-ep",
      Name: "ep-006",
      SecurityGroupIds: ["sg-006"],
      Direction: "OUTBOUND",
      IpAddresses: [
        { SubnetId: "subnet-006a", Ip: "10.7.1.10" },
        { SubnetId: "subnet-006b", Ip: "10.7.2.10" },
      ],
    }),
  );
  const epId = ep.ResolverEndpoint?.Id ?? "";

  const rule = await r53.send(
    new CreateResolverRuleCommand({
      CreatorRequestId: "r53r-006-rule",
      Name: "filter-test-rule",
      RuleType: "FORWARD",
      DomainName: "filter.example.com",
      ResolverEndpointId: epId,
      TargetIps: [{ Ip: "9.9.9.9", Port: 53 }],
    }),
  );
  const ruleId = rule.ResolverRule?.Id ?? "";

  const byTypeAlias = await r53.send(
    new ListResolverRulesCommand({
      Filters: [{ Name: "Type", Values: ["FORWARD"] }],
    }),
  );
  expect((byTypeAlias.ResolverRules ?? []).map((r) => r.Id)).toContain(ruleId);

  const byTypeLowercase = await r53.send(
    new ListResolverRulesCommand({
      Filters: [{ Name: "RuleType", Values: ["forward"] }],
    }),
  );
  expect((byTypeLowercase.ResolverRules ?? []).map((r) => r.Id)).toContain(
    ruleId,
  );

  const byDomainDot = await r53.send(
    new ListResolverRulesCommand({
      Filters: [{ Name: "DomainName", Values: ["filter.example.com."] }],
    }),
  );
  expect((byDomainDot.ResolverRules ?? []).map((r) => r.Id)).toContain(ruleId);

  const byDomainNoDot = await r53.send(
    new ListResolverRulesCommand({
      Filters: [{ Name: "DomainName", Values: ["filter.example.com"] }],
    }),
  );
  expect((byDomainNoDot.ResolverRules ?? []).map((r) => r.Id)).toContain(
    ruleId,
  );

  await expect(
    r53.send(
      new ListResolverRulesCommand({
        Filters: [{ Name: "UnknownFilter", Values: ["foo"] }],
      }),
    ),
  ).rejects.toThrow();
});

test("r53r-007: Tag ops require existing ARN; delete cleans up tags", async () => {
  const r53 = client();

  const nonExistentArn =
    "arn:aws:route53resolver:us-east-1:123456789012:resolver-endpoint/rslvr-ffffffff";

  await expect(
    r53.send(
      new TagResourceCommand({
        ResourceArn: nonExistentArn,
        Tags: [{ Key: "k", Value: "v" }],
      }),
    ),
  ).rejects.toThrow();

  await expect(
    r53.send(
      new UntagResourceCommand({
        ResourceArn: nonExistentArn,
        TagKeys: ["k"],
      }),
    ),
  ).rejects.toThrow();

  await expect(
    r53.send(new ListTagsForResourceCommand({ ResourceArn: nonExistentArn })),
  ).rejects.toThrow();

  const ep = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-007-ep",
      Name: "tagged-ep",
      SecurityGroupIds: ["sg-007"],
      Direction: "INBOUND",
      IpAddresses: [
        { SubnetId: "subnet-007a", Ip: "10.8.1.10" },
        { SubnetId: "subnet-007b", Ip: "10.8.2.10" },
      ],
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const epId = ep.ResolverEndpoint?.Id ?? "";
  const epArn = ep.ResolverEndpoint?.Arn ?? "";

  const before = await r53.send(
    new ListTagsForResourceCommand({ ResourceArn: epArn }),
  );
  expect((before.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe("test");

  await r53.send(
    new DeleteResolverEndpointCommand({ ResolverEndpointId: epId }),
  );

  await expect(
    r53.send(new ListTagsForResourceCommand({ ResourceArn: epArn })),
  ).rejects.toThrow();
});

test("r53r-008: IP association guards", async () => {
  const r53 = client();

  const ep = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "r53r-008-ep",
      Name: "ip-guard-ep",
      SecurityGroupIds: ["sg-008"],
      Direction: "OUTBOUND",
      IpAddresses: [
        { SubnetId: "subnet-008a", Ip: "10.9.1.10" },
        { SubnetId: "subnet-008b", Ip: "10.9.2.10" },
      ],
    }),
  );
  const epId = ep.ResolverEndpoint?.Id ?? "";

  await expect(
    r53.send(
      new AssociateResolverEndpointIpAddressCommand({
        ResolverEndpointId: epId,
        IpAddress: { SubnetId: "subnet-008a", Ip: "10.9.1.10" },
      }),
    ),
  ).rejects.toThrow();

  await expect(
    r53.send(
      new DisassociateResolverEndpointIpAddressCommand({
        ResolverEndpointId: epId,
        IpAddress: { Ip: "10.9.99.99" },
      }),
    ),
  ).rejects.toThrow();

  await expect(
    r53.send(
      new DisassociateResolverEndpointIpAddressCommand({
        ResolverEndpointId: epId,
        IpAddress: { Ip: "10.9.1.10" },
      }),
    ),
  ).rejects.toThrow();

  await r53.send(
    new AssociateResolverEndpointIpAddressCommand({
      ResolverEndpointId: epId,
      IpAddress: { SubnetId: "subnet-008c", Ip: "10.9.3.10" },
    }),
  );

  const ipList = await r53.send(
    new ListResolverEndpointIpAddressesCommand({
      ResolverEndpointId: epId,
    }),
  );
  expect((ipList.IpAddresses ?? []).length).toBe(3);

  await r53.send(
    new DisassociateResolverEndpointIpAddressCommand({
      ResolverEndpointId: epId,
      IpAddress: { Ip: "10.9.3.10" },
    }),
  );

  const ipListAfter = await r53.send(
    new ListResolverEndpointIpAddressesCommand({
      ResolverEndpointId: epId,
    }),
  );
  expect((ipListAfter.IpAddresses ?? []).length).toBe(2);
});
