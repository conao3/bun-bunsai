import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AuthorizeSecurityGroupIngressCommand,
  CreateRouteServerCommand,
  CreateSecurityGroupCommand,
  CreateVpcCommand,
  DescribeReservedInstancesOfferingsCommand,
  DescribeRouteServersCommand,
  DescribeScheduledInstanceAvailabilityCommand,
  DescribeScheduledInstancesCommand,
  DescribeSecondaryInterfacesCommand,
  DescribeSecondaryNetworksCommand,
  DescribeSecondarySubnetsCommand,
  DescribeSecurityGroupReferencesCommand,
  DescribeSecurityGroupRulesCommand,
  DescribeSecurityGroupVpcAssociationsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk31 describe reserved-offerings/route-servers/scheduled/secondary-net/security-group-rules e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeSecurityGroupRules: create SG + authorize rule then includes it", async () => {
    const client = ec2();

    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.31.0.0/16" }),
    );
    const vpcId = vpc.Vpc!.VpcId!;

    const sg = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: "chunk31-sg",
        Description: "chunk31 test sg",
        VpcId: vpcId,
      }),
    );
    const sgId = sg.GroupId!;
    expect(sgId.startsWith("sg-")).toBe(true);

    const auth = await client.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: sgId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 443,
            ToPort: 443,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
          },
        ],
      }),
    );
    expect(auth.$metadata.httpStatusCode).toBe(200);
    const ruleId = auth.SecurityGroupRules![0].SecurityGroupRuleId!;
    expect(ruleId.startsWith("sgr-")).toBe(true);

    const byId = await client.send(
      new DescribeSecurityGroupRulesCommand({ SecurityGroupRuleIds: [ruleId] }),
    );
    expect(byId.$metadata.httpStatusCode).toBe(200);
    expect(byId.SecurityGroupRules).toHaveLength(1);
    expect(byId.SecurityGroupRules![0].SecurityGroupRuleId).toBe(ruleId);
    expect(byId.SecurityGroupRules![0].GroupId).toBe(sgId);
    expect(byId.SecurityGroupRules![0].IsEgress).toBe(false);
    expect(byId.SecurityGroupRules![0].IpProtocol).toBe("tcp");

    const byFilter = await client.send(
      new DescribeSecurityGroupRulesCommand({
        Filters: [{ Name: "group-id", Values: [sgId] }],
      }),
    );
    expect(byFilter.$metadata.httpStatusCode).toBe(200);
    const found = byFilter.SecurityGroupRules!.find(
      (r) => r.SecurityGroupRuleId === ruleId,
    );
    expect(found).toBeDefined();
  });

  test("DescribeRouteServers: create then includes it", async () => {
    const client = ec2();

    const empty = await client.send(new DescribeRouteServersCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    const initialCount = empty.RouteServers!.length;

    const created = await client.send(
      new CreateRouteServerCommand({ AmazonSideAsn: 64512 }),
    );
    const rsId = created.RouteServer!.RouteServerId!;
    expect(rsId.startsWith("rs-")).toBe(true);

    const res = await client.send(
      new DescribeRouteServersCommand({ RouteServerIds: [rsId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.RouteServers).toHaveLength(1);
    expect(res.RouteServers![0].RouteServerId).toBe(rsId);
    expect(res.RouteServers![0].AmazonSideAsn).toBe(64512);

    const all = await client.send(new DescribeRouteServersCommand({}));
    expect(all.RouteServers!.length).toBe(initialCount + 1);
  });

  test("DescribeReservedInstancesOfferings: returns synthetic offerings", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeReservedInstancesOfferingsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ReservedInstancesOfferings)).toBe(true);
    expect(res.ReservedInstancesOfferings!.length).toBeGreaterThan(0);
    expect(res.ReservedInstancesOfferings![0].InstanceType).toBeDefined();
  });

  test("DescribeScheduledInstanceAvailability: returns synthetic availability", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeScheduledInstanceAvailabilityCommand({
        FirstSlotStartTimeRange: {
          EarliestTime: new Date("2026-01-01T00:00:00Z"),
          LatestTime: new Date("2026-01-31T00:00:00Z"),
        },
        Recurrence: { Frequency: "Daily" },
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ScheduledInstanceAvailabilitySet)).toBe(true);
    expect(res.ScheduledInstanceAvailabilitySet!.length).toBeGreaterThan(0);
  });

  test("DescribeScheduledInstances: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeScheduledInstancesCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ScheduledInstanceSet)).toBe(true);
  });

  test("DescribeSecondaryInterfaces: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeSecondaryInterfacesCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.SecondaryInterfaces)).toBe(true);
  });

  test("DescribeSecondaryNetworks: returns empty list when none created", async () => {
    const client = ec2();
    const res = await client.send(new DescribeSecondaryNetworksCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.SecondaryNetworks)).toBe(true);
  });

  test("DescribeSecondarySubnets: returns empty list when none created", async () => {
    const client = ec2();
    const res = await client.send(new DescribeSecondarySubnetsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.SecondarySubnets)).toBe(true);
  });

  test("DescribeSecurityGroupReferences: returns empty references", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.32.0.0/16" }),
    );
    const vpcId = vpc.Vpc!.VpcId!;
    const sg = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: "chunk31-sg-ref",
        Description: "chunk31 ref test",
        VpcId: vpcId,
      }),
    );
    const sgId = sg.GroupId!;
    const res = await client.send(
      new DescribeSecurityGroupReferencesCommand({ GroupId: [sgId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.SecurityGroupReferenceSet)).toBe(true);
  });

  test("DescribeSecurityGroupVpcAssociations: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeSecurityGroupVpcAssociationsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.SecurityGroupVpcAssociations)).toBe(true);
  });
});
