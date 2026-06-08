import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateManagedPrefixListCommand,
  CreateNetworkInterfaceCommand,
  CreateNetworkInterfacePermissionCommand,
  CreatePlacementGroupCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  DescribeNetworkInterfacePermissionsCommand,
  DescribeNetworkInterfacesCommand,
  DescribeOutpostLagsCommand,
  DescribePlacementGroupsCommand,
  DescribePrefixListsCommand,
  DescribePrincipalIdFormatCommand,
  DescribePublicIpv4PoolsCommand,
  DescribeRegionsCommand,
  DescribeReplaceRootVolumeTasksCommand,
  DescribeReservedInstancesCommand,
  DescribeReservedInstancesListingsCommand,
  DescribeReservedInstancesModificationsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk30 describe network-interfaces/placement-groups/prefix-lists/regions/reserved-instances e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeNetworkInterfaces: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(new DescribeNetworkInterfacesCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.NetworkInterfaces).toEqual([]);

    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.30.0.0/16" }),
    );
    const vpcId = vpc.Vpc!.VpcId!;
    const subnet = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.30.0.0/24" }),
    );
    const subnetId = subnet.Subnet!.SubnetId!;

    const eni = await client.send(
      new CreateNetworkInterfaceCommand({
        SubnetId: subnetId,
        Description: "chunk30-test-eni",
      }),
    );
    const eniId = eni.NetworkInterface!.NetworkInterfaceId!;
    expect(eniId.startsWith("eni-")).toBe(true);

    const res = await client.send(
      new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [eniId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.NetworkInterfaces).toHaveLength(1);
    expect(res.NetworkInterfaces![0].NetworkInterfaceId).toBe(eniId);
    expect(res.NetworkInterfaces![0].Description).toBe("chunk30-test-eni");
  });

  test("DescribeNetworkInterfacePermissions: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(
      new DescribeNetworkInterfacePermissionsCommand({}),
    );
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.NetworkInterfacePermissions).toEqual([]);

    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.31.0.0/16" }),
    );
    const vpcId = vpc.Vpc!.VpcId!;
    const subnet = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.31.0.0/24" }),
    );
    const subnetId = subnet.Subnet!.SubnetId!;
    const eni = await client.send(
      new CreateNetworkInterfaceCommand({ SubnetId: subnetId }),
    );
    const eniId = eni.NetworkInterface!.NetworkInterfaceId!;

    const perm = await client.send(
      new CreateNetworkInterfacePermissionCommand({
        NetworkInterfaceId: eniId,
        AwsAccountId: "123456789012",
        Permission: "INSTANCE-ATTACH",
      }),
    );
    const permId = perm.InterfacePermission!.NetworkInterfacePermissionId!;
    expect(permId.startsWith("ni-perm-")).toBe(true);

    const res = await client.send(
      new DescribeNetworkInterfacePermissionsCommand({
        NetworkInterfacePermissionIds: [permId],
      }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.NetworkInterfacePermissions).toHaveLength(1);
    expect(
      res.NetworkInterfacePermissions![0].NetworkInterfacePermissionId,
    ).toBe(permId);
    expect(res.NetworkInterfacePermissions![0].NetworkInterfaceId).toBe(eniId);
  });

  test("DescribePlacementGroups: empty then includes created", async () => {
    const client = ec2();
    const empty = await client.send(new DescribePlacementGroupsCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.PlacementGroups).toEqual([]);

    const created = await client.send(
      new CreatePlacementGroupCommand({
        GroupName: "my-pg-chunk30",
        Strategy: "cluster",
      }),
    );
    const pgId = created.PlacementGroup!.GroupId!;
    expect(pgId.startsWith("pg-")).toBe(true);

    const res = await client.send(
      new DescribePlacementGroupsCommand({ GroupIds: [pgId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.PlacementGroups).toHaveLength(1);
    expect(res.PlacementGroups![0].GroupId).toBe(pgId);
    expect(res.PlacementGroups![0].GroupName).toBe("my-pg-chunk30");
    expect(res.PlacementGroups![0].Strategy).toBe("cluster");
  });

  test("DescribePrefixLists: empty then includes created managed prefix list", async () => {
    const client = ec2();
    const empty = await client.send(new DescribePrefixListsCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(empty.PrefixLists).toEqual([]);

    const created = await client.send(
      new CreateManagedPrefixListCommand({
        PrefixListName: "my-pl-chunk30",
        AddressFamily: "IPv4",
        MaxEntries: 10,
      }),
    );
    const plId = created.PrefixList!.PrefixListId!;
    expect(plId.startsWith("pl-")).toBe(true);

    const res = await client.send(
      new DescribePrefixListsCommand({ PrefixListIds: [plId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.PrefixLists).toHaveLength(1);
    expect(res.PrefixLists![0].PrefixListId).toBe(plId);
    expect(res.PrefixLists![0].PrefixListName).toBe("my-pl-chunk30");
  });

  test("DescribeRegions: returns standard AWS region set", async () => {
    const client = ec2();
    const res = await client.send(new DescribeRegionsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    const regions = res.Regions!;
    expect(regions.length).toBeGreaterThan(10);
    const usEast1 = regions.find((r) => r.RegionName === "us-east-1");
    expect(usEast1).toBeDefined();
    expect(usEast1!.Endpoint).toBe("ec2.us-east-1.amazonaws.com");
    const euWest1 = regions.find((r) => r.RegionName === "eu-west-1");
    expect(euWest1).toBeDefined();
  });

  test("DescribeOutpostLags: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeOutpostLagsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.OutpostLags)).toBe(true);
  });

  test("DescribePrincipalIdFormat: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribePrincipalIdFormatCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.Principals)).toBe(true);
  });

  test("DescribePublicIpv4Pools: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribePublicIpv4PoolsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.PublicIpv4Pools)).toBe(true);
  });

  test("DescribeReplaceRootVolumeTasks: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeReplaceRootVolumeTasksCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ReplaceRootVolumeTasks)).toBe(true);
  });

  test("DescribeReservedInstances: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeReservedInstancesCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ReservedInstances)).toBe(true);
  });

  test("DescribeReservedInstancesListings: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeReservedInstancesListingsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ReservedInstancesListings)).toBe(true);
  });

  test("DescribeReservedInstancesModifications: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeReservedInstancesModificationsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.ReservedInstancesModifications)).toBe(true);
  });
});
