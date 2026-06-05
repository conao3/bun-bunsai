import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AllocateAddressCommand,
  AttachInternetGatewayCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateInternetGatewayCommand,
  CreateKeyPairCommand,
  CreateRouteTableCommand,
  CreateSecurityGroupCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  DeleteSubnetCommand,
  DescribeAddressesCommand,
  DescribeAvailabilityZonesCommand,
  DescribeInternetGatewaysCommand,
  DescribeKeyPairsCommand,
  DescribeRouteTablesCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  EC2Client,
  ReleaseAddressCommand,
  RevokeSecurityGroupIngressCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 net e2e", () => {
  const ec2 = () =>
    new EC2Client({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("create, describe and delete subnet", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.5.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const created = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.5.1.0/24" }),
    );
    const subnetId = created.Subnet?.SubnetId ?? "";
    expect(subnetId.startsWith("subnet-")).toBe(true);
    expect(created.Subnet?.VpcId).toBe(vpcId);
    expect(created.Subnet?.CidrBlock).toBe("10.5.1.0/24");
    expect(created.Subnet?.State).toBe("available");

    const described = await client.send(
      new DescribeSubnetsCommand({ SubnetIds: [subnetId] }),
    );
    const found = (described.Subnets ?? []).map((subnet) => subnet.SubnetId);
    expect(found).toContain(subnetId);

    await client.send(new DeleteSubnetCommand({ SubnetId: subnetId }));

    const afterDelete = await client.send(new DescribeSubnetsCommand({}));
    const remaining = (afterDelete.Subnets ?? []).map(
      (subnet) => subnet.SubnetId,
    );
    expect(remaining).not.toContain(subnetId);
  });

  test("create and describe route table", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.6.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId ?? "";

    const created = await client.send(
      new CreateRouteTableCommand({ VpcId: vpcId }),
    );
    const routeTableId = created.RouteTable?.RouteTableId ?? "";
    expect(routeTableId.startsWith("rtb-")).toBe(true);
    expect(created.RouteTable?.VpcId).toBe(vpcId);

    const described = await client.send(
      new DescribeRouteTablesCommand({ RouteTableIds: [routeTableId] }),
    );
    const found = (described.RouteTables ?? []).map(
      (table) => table.RouteTableId,
    );
    expect(found).toContain(routeTableId);
  });

  test("create, attach and describe internet gateway", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.7.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId ?? "";

    const created = await client.send(new CreateInternetGatewayCommand({}));
    const igwId = created.InternetGateway?.InternetGatewayId ?? "";
    expect(igwId.startsWith("igw-")).toBe(true);

    await client.send(
      new AttachInternetGatewayCommand({
        InternetGatewayId: igwId,
        VpcId: vpcId,
      }),
    );

    const described = await client.send(
      new DescribeInternetGatewaysCommand({ InternetGatewayIds: [igwId] }),
    );
    const gateway = (described.InternetGateways ?? []).find(
      (item) => item.InternetGatewayId === igwId,
    );
    expect(gateway?.Attachments?.[0]?.VpcId).toBe(vpcId);
    expect(gateway?.Attachments?.[0]?.State).toBe("available");
  });

  test("allocate, describe and release elastic ip", async () => {
    const client = ec2();
    const allocated = await client.send(
      new AllocateAddressCommand({ Domain: "vpc" }),
    );
    const allocationId = allocated.AllocationId ?? "";
    expect(allocationId.startsWith("eipalloc-")).toBe(true);
    expect(allocated.PublicIp).toBeDefined();

    const described = await client.send(
      new DescribeAddressesCommand({ AllocationIds: [allocationId] }),
    );
    const found = (described.Addresses ?? []).map(
      (address) => address.AllocationId,
    );
    expect(found).toContain(allocationId);

    await client.send(
      new ReleaseAddressCommand({ AllocationId: allocationId }),
    );

    const afterRelease = await client.send(new DescribeAddressesCommand({}));
    const remaining = (afterRelease.Addresses ?? []).map(
      (address) => address.AllocationId,
    );
    expect(remaining).not.toContain(allocationId);
  });

  test("create and describe key pair", async () => {
    const client = ec2();
    const keyName = `bunsai-e2e-${Date.now()}`;
    const created = await client.send(
      new CreateKeyPairCommand({ KeyName: keyName }),
    );
    expect(created.KeyName).toBe(keyName);
    expect((created.KeyPairId ?? "").startsWith("key-")).toBe(true);
    expect(created.KeyFingerprint).toBeDefined();
    expect(created.KeyMaterial).toContain("PRIVATE KEY");

    const described = await client.send(
      new DescribeKeyPairsCommand({ KeyNames: [keyName] }),
    );
    const found = (described.KeyPairs ?? []).find(
      (item) => item.KeyName === keyName,
    );
    expect(found?.KeyName).toBe(keyName);
  });

  test("describe availability zones", async () => {
    const client = ec2();
    const described = await client.send(
      new DescribeAvailabilityZonesCommand({}),
    );
    const zones = described.AvailabilityZones ?? [];
    expect(zones.length).toBeGreaterThan(0);
    expect(zones[0]?.RegionName).toBe(region);
    expect(zones[0]?.State).toBe("available");
    expect(zones[0]?.ZoneName?.startsWith(region)).toBe(true);
  });

  test("authorize and revoke security group ingress", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.8.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId;
    const sg = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: `bunsai-ingress-${Date.now()}`,
        Description: "bunsai ingress test",
        VpcId: vpcId,
      }),
    );
    const groupId = sg.GroupId ?? "";
    expect(groupId.startsWith("sg-")).toBe(true);

    const authorized = await client.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
          },
        ],
      }),
    );
    expect(authorized.Return).toBe(true);
    const rules = authorized.SecurityGroupRules ?? [];
    expect(rules.length).toBe(1);
    expect(rules[0]?.IpProtocol).toBe("tcp");
    expect(rules[0]?.FromPort).toBe(22);
    expect(rules[0]?.CidrIpv4).toBe("0.0.0.0/0");

    const revoked = await client.send(
      new RevokeSecurityGroupIngressCommand({
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: "0.0.0.0/0" }],
          },
        ],
      }),
    );
    expect(revoked.Return).toBe(true);

    const described = await client.send(
      new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
    );
    expect(
      (described.SecurityGroups ?? []).some(
        (group) => group.GroupId === groupId,
      ),
    ).toBe(true);
  });
});
