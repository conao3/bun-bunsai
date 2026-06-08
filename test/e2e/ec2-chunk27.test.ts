import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateIpamCommand,
  CreateIpamPoolCommand,
  DescribeInstanceStatusCommand,
  DescribeInstanceTopologyCommand,
  DescribeInstanceTypeOfferingsCommand,
  DescribeInstanceTypesCommand,
  DescribeIpamByoasnCommand,
  DescribeIpamExternalResourceVerificationTokensCommand,
  DescribeIpamPoliciesCommand,
  DescribeIpamPoolAllocationsCommand,
  DescribeIpamPoolsCommand,
  DescribeIpamPrefixListResolverTargetsCommand,
  DescribeIpamPrefixListResolversCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk27 describe instance-status/types/ipam e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("RunInstances then DescribeInstanceStatus: shows running instance", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-00000001",
        InstanceType: "t3.micro",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = run.Instances![0].InstanceId!;
    expect(instanceId.startsWith("i-")).toBe(true);

    const res = await client.send(
      new DescribeInstanceStatusCommand({ InstanceIds: [instanceId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.InstanceStatuses).toHaveLength(1);
    expect(res.InstanceStatuses![0].InstanceId).toBe(instanceId);
    expect(res.InstanceStatuses![0].InstanceStatus?.Status).toBe("ok");
    expect(res.InstanceStatuses![0].SystemStatus?.Status).toBe("ok");
  });

  test("DescribeInstanceTopology: returns topology for running instances", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-00000002",
        InstanceType: "m5.large",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = run.Instances![0].InstanceId!;

    const res = await client.send(
      new DescribeInstanceTopologyCommand({ InstanceIds: [instanceId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.Instances).toHaveLength(1);
    expect(res.Instances![0].InstanceId).toBe(instanceId);
    expect(res.Instances![0].InstanceType).toBe("m5.large");
    expect(res.Instances![0].AvailabilityZone).toBeTruthy();
  });

  test("DescribeInstanceTypes: returns non-empty static catalog", async () => {
    const client = ec2();
    const res = await client.send(new DescribeInstanceTypesCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.InstanceTypes!.length).toBeGreaterThan(0);
    const types = res.InstanceTypes!.map((t) => t.InstanceType);
    expect(types).toContain("t3.micro");
  });

  test("DescribeInstanceTypeOfferings: returns region-level offerings", async () => {
    const client = ec2();
    const res = await client.send(new DescribeInstanceTypeOfferingsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.InstanceTypeOfferings!.length).toBeGreaterThan(0);
    expect(res.InstanceTypeOfferings![0].LocationType).toBe("region");
  });

  test("CreateIpam + CreateIpamPool then DescribeIpamPools: round-trip", async () => {
    const client = ec2();
    const ipam = await client.send(
      new CreateIpamCommand({ Description: "test-ipam" }),
    );
    const ipamId = ipam.Ipam!.IpamId!;
    const scopeId = ipam.Ipam!.PrivateDefaultScopeId!;

    const pool = await client.send(
      new CreateIpamPoolCommand({
        IpamScopeId: scopeId,
        AddressFamily: "ipv4",
        Description: "test-pool",
      }),
    );
    const poolId = pool.IpamPool!.IpamPoolId!;
    expect(poolId.startsWith("ipam-pool-")).toBe(true);

    const res = await client.send(
      new DescribeIpamPoolsCommand({ IpamPoolIds: [poolId] }),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamPools).toHaveLength(1);
    expect(res.IpamPools![0].IpamPoolId).toBe(poolId);
    expect(res.IpamPools![0].IpamArn).toContain(ipamId);
    expect(res.IpamPools![0].AddressFamily).toBe("ipv4");
  });

  test("DescribeIpamByoasn: empty when none", async () => {
    const client = ec2();
    const res = await client.send(new DescribeIpamByoasnCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeIpamExternalResourceVerificationTokens: empty when none", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeIpamExternalResourceVerificationTokensCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamExternalResourceVerificationTokens).toEqual([]);
  });

  test("DescribeIpamPolicies: empty when none", async () => {
    const client = ec2();
    const res = await client.send(new DescribeIpamPoliciesCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamPolicies).toEqual([]);
  });

  test("DescribeIpamPoolAllocations: empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeIpamPoolAllocationsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamPoolAllocations).toEqual([]);
  });

  test("DescribeIpamPrefixListResolvers: empty when none", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeIpamPrefixListResolversCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamPrefixListResolvers).toEqual([]);
  });

  test("DescribeIpamPrefixListResolverTargets: empty when none", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeIpamPrefixListResolverTargetsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.IpamPrefixListResolverTargets).toEqual([]);
  });
});
