import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreatePlacementGroupCommand,
  CreatePublicIpv4PoolCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk10 create-placement-group and create-public-ipv4-pool e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials });

  test("create-placement-group: cluster strategy returns valid group", async () => {
    const client = ec2();

    const res = await client.send(
      new CreatePlacementGroupCommand({
        GroupName: "test-cluster-group",
        Strategy: "cluster",
      }),
    );

    const group = res.PlacementGroup;
    expect(group).toBeDefined();
    expect(group?.GroupId?.startsWith("pg-")).toBe(true);
    expect(group?.GroupName).toBe("test-cluster-group");
    expect(group?.Strategy).toBe("cluster");
    expect(group?.State).toBe("available");
    expect(group?.GroupArn).toContain("placement-group/test-cluster-group");
  });

  test("create-placement-group: partition strategy includes PartitionCount", async () => {
    const client = ec2();

    const res = await client.send(
      new CreatePlacementGroupCommand({
        GroupName: "test-partition-group",
        Strategy: "partition",
        PartitionCount: 3,
      }),
    );

    const group = res.PlacementGroup;
    expect(group).toBeDefined();
    expect(group?.GroupId?.startsWith("pg-")).toBe(true);
    expect(group?.Strategy).toBe("partition");
    expect(group?.PartitionCount).toBe(3);
  });

  test("create-placement-group: two groups get distinct IDs", async () => {
    const client = ec2();

    const res1 = await client.send(
      new CreatePlacementGroupCommand({
        GroupName: "group-a",
        Strategy: "spread",
      }),
    );
    const res2 = await client.send(
      new CreatePlacementGroupCommand({
        GroupName: "group-b",
        Strategy: "spread",
      }),
    );

    const id1 = res1.PlacementGroup?.GroupId;
    const id2 = res2.PlacementGroup?.GroupId;
    expect(id1).not.toBe(id2);
    expect(id1?.startsWith("pg-")).toBe(true);
    expect(id2?.startsWith("pg-")).toBe(true);
  });

  test("create-public-ipv4-pool: returns a pool ID", async () => {
    const client = ec2();

    const res = await client.send(new CreatePublicIpv4PoolCommand({}));

    expect(res.PoolId).toBeDefined();
    expect(res.PoolId?.startsWith("ipv4pool-ec2-")).toBe(true);
  });

  test("create-public-ipv4-pool: two pools get distinct IDs", async () => {
    const client = ec2();

    const res1 = await client.send(new CreatePublicIpv4PoolCommand({}));
    const res2 = await client.send(new CreatePublicIpv4PoolCommand({}));

    expect(res1.PoolId).not.toBe(res2.PoolId);
    expect(res1.PoolId?.startsWith("ipv4pool-ec2-")).toBe(true);
    expect(res2.PoolId?.startsWith("ipv4pool-ec2-")).toBe(true);
  });
});
