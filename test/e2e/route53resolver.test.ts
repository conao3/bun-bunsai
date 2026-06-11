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
  DisassociateResolverRuleCommand,
  GetResolverEndpointCommand,
  GetResolverRuleAssociationCommand,
  GetResolverRuleCommand,
  ListResolverEndpointIpAddressesCommand,
  ListResolverEndpointsCommand,
  ListResolverRuleAssociationsCommand,
  ListResolverRulesCommand,
  ListTagsForResourceCommand,
  Route53ResolverClient,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateResolverEndpointCommand,
  UpdateResolverRuleCommand,
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

test("Route53Resolver endpoint lifecycle", async () => {
  const r53 = client();

  const created = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "e2e-endpoint-create-1",
      Name: "my-inbound-endpoint",
      SecurityGroupIds: ["sg-0123456789abcdef0"],
      Direction: "INBOUND",
      IpAddresses: [
        { SubnetId: "subnet-aaa", Ip: "10.0.1.10" },
        { SubnetId: "subnet-bbb", Ip: "10.0.2.10" },
      ],
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  expect(created.ResolverEndpoint?.Id).toBeDefined();
  expect(created.ResolverEndpoint?.Status).toBe("OPERATIONAL");
  expect(created.ResolverEndpoint?.Direction).toBe("INBOUND");
  const endpointId = created.ResolverEndpoint?.Id ?? "";
  const endpointArn = created.ResolverEndpoint?.Arn ?? "";

  const idempotent = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "e2e-endpoint-create-1",
      Name: "different-name",
      SecurityGroupIds: ["sg-0123456789abcdef0"],
      Direction: "INBOUND",
      IpAddresses: [{ SubnetId: "subnet-aaa", Ip: "10.0.1.10" }],
    }),
  );
  expect(idempotent.ResolverEndpoint?.Id).toBe(endpointId);

  const got = await r53.send(
    new GetResolverEndpointCommand({ ResolverEndpointId: endpointId }),
  );
  expect(got.ResolverEndpoint?.Name).toBe("my-inbound-endpoint");
  expect(got.ResolverEndpoint?.Status).toBe("OPERATIONAL");

  const listed = await r53.send(new ListResolverEndpointsCommand({}));
  expect((listed.ResolverEndpoints ?? []).map((e) => e.Id)).toContain(
    endpointId,
  );

  const updated = await r53.send(
    new UpdateResolverEndpointCommand({
      ResolverEndpointId: endpointId,
      Name: "updated-endpoint",
    }),
  );
  expect(updated.ResolverEndpoint?.Name).toBe("updated-endpoint");

  const tags = await r53.send(
    new ListTagsForResourceCommand({ ResourceArn: endpointArn }),
  );
  expect((tags.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe("test");

  await r53.send(
    new TagResourceCommand({
      ResourceArn: endpointArn,
      Tags: [{ Key: "team", Value: "platform" }],
    }),
  );
  await r53.send(
    new UntagResourceCommand({ ResourceArn: endpointArn, TagKeys: ["env"] }),
  );
  const updatedTags = await r53.send(
    new ListTagsForResourceCommand({ ResourceArn: endpointArn }),
  );
  const tagKeys = (updatedTags.Tags ?? []).map((t) => t.Key);
  expect(tagKeys).toContain("team");
  expect(tagKeys).not.toContain("env");

  const ipList = await r53.send(
    new ListResolverEndpointIpAddressesCommand({
      ResolverEndpointId: endpointId,
    }),
  );
  expect((ipList.IpAddresses ?? []).length).toBe(2);

  const associated = await r53.send(
    new AssociateResolverEndpointIpAddressCommand({
      ResolverEndpointId: endpointId,
      IpAddress: { SubnetId: "subnet-ccc", Ip: "10.0.3.10" },
    }),
  );
  expect(associated.ResolverEndpoint?.IpAddressCount).toBe(3);

  const ipListAfter = await r53.send(
    new ListResolverEndpointIpAddressesCommand({
      ResolverEndpointId: endpointId,
    }),
  );
  const ipId = (ipListAfter.IpAddresses ?? []).find(
    (ip) => ip.Ip === "10.0.3.10",
  )?.IpId;
  expect(ipId).toBeDefined();

  await r53.send(
    new DisassociateResolverEndpointIpAddressCommand({
      ResolverEndpointId: endpointId,
      IpAddress: { IpId: ipId },
    }),
  );
  const ipListFinal = await r53.send(
    new ListResolverEndpointIpAddressesCommand({
      ResolverEndpointId: endpointId,
    }),
  );
  expect((ipListFinal.IpAddresses ?? []).length).toBe(2);

  await r53.send(
    new DeleteResolverEndpointCommand({ ResolverEndpointId: endpointId }),
  );

  await expect(
    r53.send(
      new GetResolverEndpointCommand({ ResolverEndpointId: endpointId }),
    ),
  ).rejects.toThrow();
});

test("Route53Resolver rule CRUD and association lifecycle", async () => {
  const r53 = client();

  const outboundEp = await r53.send(
    new CreateResolverEndpointCommand({
      CreatorRequestId: "e2e-outbound-ep-1",
      Name: "my-outbound-endpoint",
      SecurityGroupIds: ["sg-0000000000000001"],
      Direction: "OUTBOUND",
      IpAddresses: [
        { SubnetId: "subnet-out1", Ip: "10.1.1.10" },
        { SubnetId: "subnet-out2", Ip: "10.1.2.10" },
      ],
    }),
  );
  const epId = outboundEp.ResolverEndpoint?.Id ?? "";

  const ruleCreated = await r53.send(
    new CreateResolverRuleCommand({
      CreatorRequestId: "e2e-rule-create-1",
      Name: "forward-example-com",
      RuleType: "FORWARD",
      DomainName: "example.com",
      ResolverEndpointId: epId,
      TargetIps: [{ Ip: "8.8.8.8", Port: 53 }],
      Tags: [{ Key: "env", Value: "e2e" }],
    }),
  );
  expect(ruleCreated.ResolverRule?.Id).toBeDefined();
  expect(ruleCreated.ResolverRule?.Status).toBe("COMPLETE");
  expect(ruleCreated.ResolverRule?.DomainName).toBe("example.com");
  const ruleId = ruleCreated.ResolverRule?.Id ?? "";
  const ruleArn = ruleCreated.ResolverRule?.Arn ?? "";

  const ruleIdempotent = await r53.send(
    new CreateResolverRuleCommand({
      CreatorRequestId: "e2e-rule-create-1",
      Name: "different-name",
      RuleType: "FORWARD",
    }),
  );
  expect(ruleIdempotent.ResolverRule?.Id).toBe(ruleId);

  const ruleGot = await r53.send(
    new GetResolverRuleCommand({ ResolverRuleId: ruleId }),
  );
  expect(ruleGot.ResolverRule?.Name).toBe("forward-example-com");

  const rulesListed = await r53.send(new ListResolverRulesCommand({}));
  expect((rulesListed.ResolverRules ?? []).map((r) => r.Id)).toContain(ruleId);

  const ruleUpdated = await r53.send(
    new UpdateResolverRuleCommand({
      ResolverRuleId: ruleId,
      Config: {
        Name: "updated-forward-rule",
        TargetIps: [{ Ip: "8.8.4.4", Port: 53 }],
      },
    }),
  );
  expect(ruleUpdated.ResolverRule?.Name).toBe("updated-forward-rule");

  const ruleTags = await r53.send(
    new ListTagsForResourceCommand({ ResourceArn: ruleArn }),
  );
  expect((ruleTags.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe("e2e");

  const assocCreated = await r53.send(
    new AssociateResolverRuleCommand({
      ResolverRuleId: ruleId,
      VPCId: "vpc-00001111aaaabbbb1",
      Name: "my-association",
    }),
  );
  expect(assocCreated.ResolverRuleAssociation?.Status).toBe("COMPLETE");
  expect(assocCreated.ResolverRuleAssociation?.VPCId).toBe(
    "vpc-00001111aaaabbbb1",
  );
  const assocId = assocCreated.ResolverRuleAssociation?.Id ?? "";

  await expect(
    r53.send(
      new AssociateResolverRuleCommand({
        ResolverRuleId: ruleId,
        VPCId: "vpc-00001111aaaabbbb1",
      }),
    ),
  ).rejects.toThrow();

  const assocGot = await r53.send(
    new GetResolverRuleAssociationCommand({
      ResolverRuleAssociationId: assocId,
    }),
  );
  expect(assocGot.ResolverRuleAssociation?.ResolverRuleId).toBe(ruleId);

  const assocListed = await r53.send(
    new ListResolverRuleAssociationsCommand({}),
  );
  expect(
    (assocListed.ResolverRuleAssociations ?? []).map((a) => a.Id),
  ).toContain(assocId);

  await expect(
    r53.send(new DeleteResolverRuleCommand({ ResolverRuleId: ruleId })),
  ).rejects.toThrow();

  await r53.send(
    new DisassociateResolverRuleCommand({
      ResolverRuleId: ruleId,
      VPCId: "vpc-00001111aaaabbbb1",
    }),
  );

  const assocListedAfter = await r53.send(
    new ListResolverRuleAssociationsCommand({}),
  );
  expect(
    (assocListedAfter.ResolverRuleAssociations ?? []).map((a) => a.Id),
  ).not.toContain(assocId);

  await r53.send(new DeleteResolverRuleCommand({ ResolverRuleId: ruleId }));

  await expect(
    r53.send(new GetResolverRuleCommand({ ResolverRuleId: ruleId })),
  ).rejects.toThrow();
});
