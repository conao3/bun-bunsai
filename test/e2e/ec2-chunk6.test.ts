import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AssociateRouteTableCommand,
  AssociateDhcpOptionsCommand,
  CreateVpcCommand,
  CreateSubnetCommand,
  CreateRouteTableCommand,
  DescribeRouteTablesCommand,
  DescribeVpcsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk6 associate e2e", () => {
  const ec2 = () => new EC2Client({ endpoint, region, credentials });

  test("associate-route-table: associates subnet with route table", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const subnetRes = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.0.1.0/24" }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";
    expect(subnetId.startsWith("subnet-")).toBe(true);

    const rtbRes = await client.send(
      new CreateRouteTableCommand({ VpcId: vpcId }),
    );
    const routeTableId = rtbRes.RouteTable?.RouteTableId ?? "";
    expect(routeTableId.startsWith("rtb-")).toBe(true);

    const assocRes = await client.send(
      new AssociateRouteTableCommand({
        RouteTableId: routeTableId,
        SubnetId: subnetId,
      }),
    );
    const assocId = assocRes.AssociationId ?? "";
    expect(assocId.startsWith("rtbassoc-")).toBe(true);
    expect(assocRes.AssociationState?.State).toBe("associated");

    const descRes = await client.send(
      new DescribeRouteTablesCommand({ RouteTableIds: [routeTableId] }),
    );
    const table = descRes.RouteTables?.[0];
    expect(table?.RouteTableId).toBe(routeTableId);
    const storedAssoc = table?.Associations?.find(
      (a) => a.RouteTableAssociationId === assocId,
    );
    expect(storedAssoc).toBeDefined();
    expect(storedAssoc?.SubnetId).toBe(subnetId);
    expect(storedAssoc?.AssociationState?.State).toBe("associated");
  });

  test("associate-dhcp-options: updates vpc dhcp options", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);
    const originalDhcpId = vpcRes.Vpc?.DhcpOptionsId ?? "";
    expect(originalDhcpId.startsWith("dopt-")).toBe(true);

    const newDhcpId = "dopt-custom12345678";
    await client.send(
      new AssociateDhcpOptionsCommand({
        DhcpOptionsId: newDhcpId,
        VpcId: vpcId,
      }),
    );

    const descRes = await client.send(
      new DescribeVpcsCommand({ VpcIds: [vpcId] }),
    );
    const vpc = descRes.Vpcs?.[0];
    expect(vpc?.VpcId).toBe(vpcId);
    expect(vpc?.DhcpOptionsId).toBe(newDhcpId);
  });
});
