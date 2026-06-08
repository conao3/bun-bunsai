import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateManagedPrefixListCommand,
  CreateNetworkAclCommand,
  CreateNetworkInsightsPathCommand,
  CreateNetworkInterfaceCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  DescribeLocalGatewaysCommand,
  DescribeLockedSnapshotsCommand,
  DescribeMacHostsCommand,
  DescribeMacModificationTasksCommand,
  DescribeManagedPrefixListsCommand,
  DescribeMovingAddressesCommand,
  DescribeNetworkAclsCommand,
  DescribeNetworkInsightsAccessScopeAnalysesCommand,
  DescribeNetworkInsightsAccessScopesCommand,
  DescribeNetworkInsightsAnalysesCommand,
  DescribeNetworkInsightsPathsCommand,
  DescribeNetworkInterfaceAttributeCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk29 describe local-gateways/locked-snapshots/mac/prefix-lists/network-acls/network-insights e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeLocalGateways: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeLocalGatewaysCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.LocalGateways).toEqual([]);
  });

  test("DescribeLockedSnapshots: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeLockedSnapshotsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Snapshots)).toBe(true);
  });

  test("DescribeMacHosts: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeMacHostsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.MacHosts)).toBe(true);
  });

  test("DescribeMacModificationTasks: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeMacModificationTasksCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.MacModificationTasks)).toBe(true);
  });

  test("DescribeManagedPrefixLists: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(new DescribeManagedPrefixListsCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.PrefixLists).toEqual([]);

    const created = await client.send(
      new CreateManagedPrefixListCommand({
        PrefixListName: "my-pl",
        AddressFamily: "IPv4",
        MaxEntries: 5,
      }),
    );
    const plId = created.PrefixList!.PrefixListId!;
    expect(plId.startsWith("pl-")).toBe(true);

    const res = await client.send(
      new DescribeManagedPrefixListsCommand({ PrefixListIds: [plId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.PrefixLists).toHaveLength(1);
    expect(res.PrefixLists![0].PrefixListId).toBe(plId);
    expect(res.PrefixLists![0].PrefixListName).toBe("my-pl");
  });

  test("DescribeMovingAddresses: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeMovingAddressesCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.MovingAddressStatuses)).toBe(true);
  });

  test("DescribeNetworkAcls: empty then includes created", async () => {
    const client = ec2();
    const emptyRes = await client.send(new DescribeNetworkAclsCommand({}));
    expect(emptyRes.$metadata.httpStatusCode).toBe(200);
    expect(emptyRes.NetworkAcls).toEqual([]);

    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpc.Vpc!.VpcId!;

    const created = await client.send(
      new CreateNetworkAclCommand({ VpcId: vpcId }),
    );
    const aclId = created.NetworkAcl!.NetworkAclId!;
    expect(aclId.startsWith("acl-")).toBe(true);

    const res = await client.send(
      new DescribeNetworkAclsCommand({ NetworkAclIds: [aclId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.NetworkAcls).toHaveLength(1);
    expect(res.NetworkAcls![0].NetworkAclId).toBe(aclId);
    expect(res.NetworkAcls![0].VpcId).toBe(vpcId);
  });

  test("DescribeNetworkInsightsAccessScopeAnalyses: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeNetworkInsightsAccessScopeAnalysesCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.NetworkInsightsAccessScopeAnalyses)).toBe(true);
  });

  test("DescribeNetworkInsightsAccessScopes: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeNetworkInsightsAccessScopesCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.NetworkInsightsAccessScopes)).toBe(true);
  });

  test("DescribeNetworkInsightsAnalyses: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeNetworkInsightsAnalysesCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.NetworkInsightsAnalyses)).toBe(true);
  });

  test("DescribeNetworkInsightsPaths: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(
      new DescribeNetworkInsightsPathsCommand({}),
    );
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.NetworkInsightsPaths).toEqual([]);

    const created = await client.send(
      new CreateNetworkInsightsPathCommand({
        Source: "i-12345678",
        Protocol: "tcp",
      }),
    );
    const pathId = created.NetworkInsightsPath!.NetworkInsightsPathId!;
    expect(pathId.startsWith("nip-")).toBe(true);

    const res = await client.send(
      new DescribeNetworkInsightsPathsCommand({
        NetworkInsightsPathIds: [pathId],
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.NetworkInsightsPaths).toHaveLength(1);
    expect(res.NetworkInsightsPaths![0].NetworkInsightsPathId).toBe(pathId);
  });

  test("DescribeNetworkInterfaceAttribute: returns attributes for existing ENI", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
    );
    const vpcId = vpc.Vpc!.VpcId!;
    const subnet = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.1.0.0/24" }),
    );
    const subnetId = subnet.Subnet!.SubnetId!;

    const eni = await client.send(
      new CreateNetworkInterfaceCommand({
        SubnetId: subnetId,
        Description: "test-eni",
      }),
    );
    const eniId = eni.NetworkInterface!.NetworkInterfaceId!;
    expect(eniId.startsWith("eni-")).toBe(true);

    const res = await client.send(
      new DescribeNetworkInterfaceAttributeCommand({
        NetworkInterfaceId: eniId,
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.NetworkInterfaceId).toBe(eniId);
    expect(res.Description).toBeDefined();
  });
});
