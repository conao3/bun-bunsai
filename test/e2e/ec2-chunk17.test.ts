import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateNetworkInsightsPathCommand,
  CreateNetworkInterfaceCommand,
  CreateNetworkInterfacePermissionCommand,
  CreatePlacementGroupCommand,
  CreatePublicIpv4PoolCommand,
  CreateRouteServerCommand,
  CreateRouteTableCommand,
  CreateRouteCommand,
  CreateVpcCommand,
  DeleteNetworkInsightsAccessScopeAnalysisCommand,
  DeleteNetworkInsightsAnalysisCommand,
  DeleteNetworkInsightsPathCommand,
  DeleteNetworkInterfaceCommand,
  DeleteNetworkInterfacePermissionCommand,
  DeletePlacementGroupCommand,
  DeletePublicIpv4PoolCommand,
  DeleteQueuedReservedInstancesCommand,
  DeleteRouteCommand,
  DeleteRouteServerCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk17 delete (network-insights, network-interface, placement-group, route, route-server) e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create network-interface then delete: lifecycle succeeds and re-delete throws", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateNetworkInterfaceCommand({ SubnetId: "subnet-test" }),
    );
    const ni = createRes.NetworkInterface;
    expect(ni).toBeDefined();
    expect(ni?.NetworkInterfaceId?.startsWith("eni-")).toBe(true);
    const niId = ni?.NetworkInterfaceId ?? "";

    const deleteRes = await client.send(
      new DeleteNetworkInterfaceCommand({ NetworkInterfaceId: niId }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);

    await expect(
      client.send(
        new DeleteNetworkInterfaceCommand({ NetworkInterfaceId: niId }),
      ),
    ).rejects.toThrow();
  });

  test("delete non-existent network-interface: throws InvalidNetworkInterfaceID.NotFound", async () => {
    const client = ec2();

    const err = await client
      .send(
        new DeleteNetworkInterfaceCommand({
          NetworkInterfaceId: "eni-nonexistent",
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidNetworkInterfaceID.NotFound",
    );
  });

  test("create network-interface-permission then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const niRes = await client.send(
      new CreateNetworkInterfaceCommand({ SubnetId: "subnet-test2" }),
    );
    const niId = niRes.NetworkInterface?.NetworkInterfaceId ?? "";

    const permRes = await client.send(
      new CreateNetworkInterfacePermissionCommand({
        NetworkInterfaceId: niId,
        AwsAccountId: "123456789012",
        Permission: "INSTANCE-ATTACH",
      }),
    );
    const permId =
      permRes.InterfacePermission?.NetworkInterfacePermissionId ?? "";
    expect(permId.startsWith("ni-perm-")).toBe(true);

    const deletePermRes = await client.send(
      new DeleteNetworkInterfacePermissionCommand({
        NetworkInterfacePermissionId: permId,
      }),
    );
    expect(deletePermRes.Return).toBe(true);
  });

  test("create network-insights-path then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateNetworkInsightsPathCommand({
        Source: "eni-source",
        Protocol: "tcp",
      }),
    );
    const pathId = createRes.NetworkInsightsPath?.NetworkInsightsPathId ?? "";
    expect(pathId.startsWith("nip-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteNetworkInsightsPathCommand({ NetworkInsightsPathId: pathId }),
    );
    expect(deleteRes.NetworkInsightsPathId).toBe(pathId);
  });

  test("delete non-existent network-insights-analysis: throws", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteNetworkInsightsAnalysisCommand({
          NetworkInsightsAnalysisId: "nia-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });

  test("delete non-existent network-insights-access-scope-analysis: throws", async () => {
    const client = ec2();

    await expect(
      client.send(
        new DeleteNetworkInsightsAccessScopeAnalysisCommand({
          NetworkInsightsAccessScopeAnalysisId: "nisa-nonexistent",
        }),
      ),
    ).rejects.toThrow();
  });

  test("create placement-group then delete by name: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreatePlacementGroupCommand({
        GroupName: "test-pg-chunk17",
        Strategy: "cluster",
      }),
    );
    expect(createRes.PlacementGroup?.GroupId?.startsWith("pg-")).toBe(true);

    const deleteRes = await client.send(
      new DeletePlacementGroupCommand({ GroupName: "test-pg-chunk17" }),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);

    await expect(
      client.send(
        new DeletePlacementGroupCommand({ GroupName: "test-pg-chunk17" }),
      ),
    ).rejects.toThrow();
  });

  test("create public-ipv4-pool then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(new CreatePublicIpv4PoolCommand({}));
    const poolId = createRes.PoolId ?? "";
    expect(poolId.startsWith("ipv4pool-ec2-")).toBe(true);

    const deleteRes = await client.send(
      new DeletePublicIpv4PoolCommand({ PoolId: poolId }),
    );
    expect(deleteRes.ReturnValue).toBe(true);
  });

  test("delete-queued-reserved-instances: succeeds with provided ids", async () => {
    const client = ec2();

    const res = await client.send(
      new DeleteQueuedReservedInstancesCommand({
        ReservedInstancesIds: ["ri-abc123", "ri-def456"],
      }),
    );
    expect(res.SuccessfulQueuedPurchaseDeletions).toHaveLength(2);
    expect(res.FailedQueuedPurchaseDeletions).toHaveLength(0);
  });

  test("create route-table then route then delete route: lifecycle succeeds", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.100.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const rtbRes = await client.send(
      new CreateRouteTableCommand({ VpcId: vpcId }),
    );
    const rtbId = rtbRes.RouteTable?.RouteTableId ?? "";
    expect(rtbId.startsWith("rtb-")).toBe(true);

    await client.send(
      new CreateRouteCommand({
        RouteTableId: rtbId,
        DestinationCidrBlock: "10.200.0.0/24",
        GatewayId: "igw-test",
      }),
    );

    const deleteRouteRes = await client.send(
      new DeleteRouteCommand({
        RouteTableId: rtbId,
        DestinationCidrBlock: "10.200.0.0/24",
      }),
    );
    expect(deleteRouteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("create route-server then delete: lifecycle succeeds", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateRouteServerCommand({ AmazonSideAsn: 64512 }),
    );
    const rsId = createRes.RouteServer?.RouteServerId ?? "";
    expect(rsId.startsWith("rs-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteRouteServerCommand({ RouteServerId: rsId }),
    );
    expect(deleteRes.RouteServer?.RouteServerId).toBe(rsId);

    await expect(
      client.send(new DeleteRouteServerCommand({ RouteServerId: rsId })),
    ).rejects.toThrow();
  });
});
