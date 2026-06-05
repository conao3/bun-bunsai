import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateManagedPrefixListCommand,
  CreateNetworkAclCommand,
  CreateNetworkAclEntryCommand,
  CreateNetworkInsightsPathCommand,
  CreateNetworkInterfaceCommand,
  CreateNetworkInterfacePermissionCommand,
  CreateVpcCommand,
  CreateSubnetCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk5 create e2e", () => {
  const ec2 = () =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create-managed-prefix-list: creates prefix list", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateManagedPrefixListCommand({
        PrefixListName: "test-pl",
        AddressFamily: "IPv4",
        MaxEntries: 20,
      }),
    );
    const pl = result.PrefixList;
    expect(pl?.PrefixListId?.startsWith("pl-")).toBe(true);
    expect(pl?.PrefixListName).toBe("test-pl");
    expect(pl?.AddressFamily).toBe("IPv4");
    expect(pl?.MaxEntries).toBe(20);
    expect(pl?.State).toBe("create-complete");
    expect(pl?.Version).toBe(1);
    expect(pl?.PrefixListArn).toContain("managed-prefix-list");
    expect(pl?.OwnerId).toBeTruthy();
  });

  test("create-network-acl: creates acl for vpc", async () => {
    const client = ec2();
    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const aclRes = await client.send(
      new CreateNetworkAclCommand({ VpcId: vpcId }),
    );
    const acl = aclRes.NetworkAcl;
    expect(acl?.NetworkAclId?.startsWith("acl-")).toBe(true);
    expect(acl?.VpcId).toBe(vpcId);
    expect(acl?.IsDefault).toBe(false);
    expect(acl?.OwnerId).toBeTruthy();
    expect(Array.isArray(acl?.Entries)).toBe(true);
  });

  test("create-network-acl-entry: adds rule to acl", async () => {
    const client = ec2();
    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.2.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const aclRes = await client.send(
      new CreateNetworkAclCommand({ VpcId: vpcId }),
    );
    const aclId = aclRes.NetworkAcl?.NetworkAclId ?? "";
    expect(aclId.startsWith("acl-")).toBe(true);

    await client.send(
      new CreateNetworkAclEntryCommand({
        NetworkAclId: aclId,
        RuleNumber: 100,
        Protocol: "6",
        RuleAction: "allow",
        Egress: false,
        CidrBlock: "0.0.0.0/0",
      }),
    );
  });

  test("create-network-insights-path: creates path between endpoints", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateNetworkInsightsPathCommand({
        Source: "eni-0123456789abcdef0",
        Destination: "eni-abcdef0123456789",
        Protocol: "tcp",
        DestinationPort: 443,
      }),
    );
    const path = result.NetworkInsightsPath;
    expect(path?.NetworkInsightsPathId?.startsWith("nip-")).toBe(true);
    expect(path?.Source).toBe("eni-0123456789abcdef0");
    expect(path?.Destination).toBe("eni-abcdef0123456789");
    expect(path?.Protocol).toBe("tcp");
    expect(path?.DestinationPort).toBe(443);
    expect(path?.NetworkInsightsPathArn).toContain("network-insights-path");
    expect(path?.CreatedDate).toBeTruthy();
  });

  test("create-network-interface: creates eni in subnet", async () => {
    const client = ec2();
    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.3.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const subnetRes = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.3.1.0/24" }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";
    expect(subnetId.startsWith("subnet-")).toBe(true);

    const niRes = await client.send(
      new CreateNetworkInterfaceCommand({
        SubnetId: subnetId,
        Description: "test-eni",
      }),
    );
    const ni = niRes.NetworkInterface;
    expect(ni?.NetworkInterfaceId?.startsWith("eni-")).toBe(true);
    expect(ni?.SubnetId).toBe(subnetId);
    expect(ni?.VpcId).toBe(vpcId);
    expect(ni?.Description).toBe("test-eni");
    expect(ni?.Status).toBe("available");
    expect(ni?.SourceDestCheck).toBe(true);
    expect(ni?.MacAddress).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
    expect(ni?.PrivateIpAddress).toBeTruthy();
    expect(ni?.OwnerId).toBeTruthy();
  });

  test("create-network-interface-permission: grants permission", async () => {
    const client = ec2();
    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.4.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    const subnetRes = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.4.1.0/24" }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";
    const niRes = await client.send(
      new CreateNetworkInterfaceCommand({ SubnetId: subnetId }),
    );
    const eniId = niRes.NetworkInterface?.NetworkInterfaceId ?? "";

    const permRes = await client.send(
      new CreateNetworkInterfacePermissionCommand({
        NetworkInterfaceId: eniId,
        AwsAccountId: "123456789012",
        Permission: "INSTANCE-ATTACH",
      }),
    );
    const perm = permRes.InterfacePermission;
    expect(perm?.NetworkInterfacePermissionId?.startsWith("ni-perm-")).toBe(
      true,
    );
    expect(perm?.NetworkInterfaceId).toBe(eniId);
    expect(perm?.AwsAccountId).toBe("123456789012");
    expect(perm?.Permission).toBe("INSTANCE-ATTACH");
    expect(perm?.PermissionState?.State).toBe("granted");
  });
});
