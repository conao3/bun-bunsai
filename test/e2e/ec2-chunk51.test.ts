import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AuthorizeSecurityGroupIngressCommand,
  CreateNetworkInterfaceCommand,
  CreateSecurityGroupCommand,
  CreateSnapshotCommand,
  CreateSubnetCommand,
  CreateVolumeCommand,
  CreateVpcCommand,
  DescribeNetworkInterfaceAttributeCommand,
  DescribeSecurityGroupRulesCommand,
  DescribeSnapshotAttributeCommand,
  DescribeSubnetsCommand,
  EC2Client,
  ModifyNetworkInterfaceAttributeCommand,
  ModifySecurityGroupRulesCommand,
  ModifySnapshotAttributeCommand,
  ModifySubnetAttributeCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ModifySubnetAttribute MapPublicIpOnLaunch reflects in DescribeSubnets", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";
  expect(vpcId.startsWith("vpc-")).toBe(true);

  const subnet = await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.0.1.0/24" }),
  );
  const subnetId = subnet.Subnet?.SubnetId ?? "";
  expect(subnetId.startsWith("subnet-")).toBe(true);
  expect(subnet.Subnet?.MapPublicIpOnLaunch).toBe(false);

  await client.send(
    new ModifySubnetAttributeCommand({
      SubnetId: subnetId,
      MapPublicIpOnLaunch: { Value: true },
    }),
  );

  const described = await client.send(
    new DescribeSubnetsCommand({ SubnetIds: [subnetId] }),
  );
  expect(described.Subnets?.[0]?.MapPublicIpOnLaunch).toBe(true);
});

test("ModifySubnetAttribute throws InvalidSubnetID.NotFound for missing subnet", async () => {
  await expect(
    client.send(
      new ModifySubnetAttributeCommand({
        SubnetId: "subnet-nonexistent",
        MapPublicIpOnLaunch: { Value: true },
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidSubnetID.NotFound" });
});

test("ModifyNetworkInterfaceAttribute Description reflects in DescribeNetworkInterfaceAttribute", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const subnet = await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.1.1.0/24" }),
  );
  const subnetId = subnet.Subnet?.SubnetId ?? "";

  const ni = await client.send(
    new CreateNetworkInterfaceCommand({
      SubnetId: subnetId,
      Description: "original",
    }),
  );
  const niId = ni.NetworkInterface?.NetworkInterfaceId ?? "";
  expect(niId.startsWith("eni-")).toBe(true);

  await client.send(
    new ModifyNetworkInterfaceAttributeCommand({
      NetworkInterfaceId: niId,
      Description: { Value: "updated-description" },
    }),
  );

  const described = await client.send(
    new DescribeNetworkInterfaceAttributeCommand({
      NetworkInterfaceId: niId,
      Attribute: "description",
    }),
  );
  expect(described.Description?.Value).toBe("updated-description");
});

test("ModifyNetworkInterfaceAttribute SourceDestCheck reflects in DescribeNetworkInterfaceAttribute", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.2.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const subnet = await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.2.1.0/24" }),
  );
  const subnetId = subnet.Subnet?.SubnetId ?? "";

  const ni = await client.send(
    new CreateNetworkInterfaceCommand({ SubnetId: subnetId }),
  );
  const niId = ni.NetworkInterface?.NetworkInterfaceId ?? "";

  await client.send(
    new ModifyNetworkInterfaceAttributeCommand({
      NetworkInterfaceId: niId,
      SourceDestCheck: { Value: false },
    }),
  );

  const described = await client.send(
    new DescribeNetworkInterfaceAttributeCommand({
      NetworkInterfaceId: niId,
      Attribute: "sourceDestCheck",
    }),
  );
  expect(described.SourceDestCheck?.Value).toBe(false);
});

test("ModifyNetworkInterfaceAttribute throws InvalidNetworkInterfaceID.NotFound for missing NI", async () => {
  await expect(
    client.send(
      new ModifyNetworkInterfaceAttributeCommand({
        NetworkInterfaceId: "eni-nonexistent",
        Description: { Value: "x" },
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidNetworkInterfaceID.NotFound" });
});

test("ModifySnapshotAttribute CreateVolumePermissions reflects in DescribeSnapshotAttribute", async () => {
  const vol = await client.send(
    new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 1 }),
  );
  const volId = vol.VolumeId ?? "";

  const snap = await client.send(
    new CreateSnapshotCommand({ VolumeId: volId }),
  );
  const snapId = snap.SnapshotId ?? "";
  expect(snapId.startsWith("snap-")).toBe(true);

  const before = await client.send(
    new DescribeSnapshotAttributeCommand({
      SnapshotId: snapId,
      Attribute: "createVolumePermission",
    }),
  );
  expect(before.CreateVolumePermissions).toHaveLength(0);

  await client.send(
    new ModifySnapshotAttributeCommand({
      SnapshotId: snapId,
      Attribute: "createVolumePermission",
      OperationType: "add",
      UserIds: ["123456789012"],
    }),
  );

  const after = await client.send(
    new DescribeSnapshotAttributeCommand({
      SnapshotId: snapId,
      Attribute: "createVolumePermission",
    }),
  );
  expect(after.CreateVolumePermissions).toHaveLength(1);
  expect(after.CreateVolumePermissions?.[0]?.UserId).toBe("123456789012");
});

test("ModifySecurityGroupRules Description reflects in DescribeSecurityGroupRules", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.3.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const sg = await client.send(
    new CreateSecurityGroupCommand({
      GroupName: "test-sg-modify",
      Description: "test",
      VpcId: vpcId,
    }),
  );
  const groupId = sg.GroupId ?? "";

  const auth = await client.send(
    new AuthorizeSecurityGroupIngressCommand({
      GroupId: groupId,
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: 80,
          ToPort: 80,
          IpRanges: [{ CidrIp: "0.0.0.0/0" }],
        },
      ],
    }),
  );
  const ruleId = auth.SecurityGroupRules?.[0]?.SecurityGroupRuleId ?? "";
  expect(ruleId.startsWith("sgr-")).toBe(true);

  await client.send(
    new ModifySecurityGroupRulesCommand({
      GroupId: groupId,
      SecurityGroupRules: [
        {
          SecurityGroupRuleId: ruleId,
          SecurityGroupRule: {
            IpProtocol: "tcp",
            FromPort: 443,
            ToPort: 443,
            CidrIpv4: "10.0.0.0/8",
            Description: "updated",
          },
        },
      ],
    }),
  );

  const described = await client.send(
    new DescribeSecurityGroupRulesCommand({
      SecurityGroupRuleIds: [ruleId],
    }),
  );
  expect(described.SecurityGroupRules?.[0]?.FromPort).toBe(443);
  expect(described.SecurityGroupRules?.[0]?.ToPort).toBe(443);
  expect(described.SecurityGroupRules?.[0]?.Description).toBe("updated");
});
