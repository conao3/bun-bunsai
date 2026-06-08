import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateRouteTableCommand,
  AttachInternetGatewayCommand,
  CreateInternetGatewayCommand,
  CreateRouteCommand,
  CreateRouteTableCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  DeleteRouteCommand,
  DeleteVpcCommand,
  DescribeInternetGatewaysCommand,
  DescribeRouteTablesCommand,
  DescribeSubnetsCommand,
  DisassociateRouteTableCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("VPC topology fidelity: vpc → subnet → igw → route-table association + route", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.100.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";
  expect(vpcId.startsWith("vpc-")).toBe(true);

  const subnet = await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.100.1.0/24" }),
  );
  const subnetId = subnet.Subnet?.SubnetId ?? "";
  expect(subnetId.startsWith("subnet-")).toBe(true);
  expect(subnet.Subnet?.VpcId).toBe(vpcId);

  const subnetsByVpc = await client.send(
    new DescribeSubnetsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );
  expect((subnetsByVpc.Subnets ?? []).map((s) => s.SubnetId)).toContain(
    subnetId,
  );

  const igw = await client.send(new CreateInternetGatewayCommand({}));
  const igwId = igw.InternetGateway?.InternetGatewayId ?? "";
  expect(igwId.startsWith("igw-")).toBe(true);

  await client.send(
    new AttachInternetGatewayCommand({
      InternetGatewayId: igwId,
      VpcId: vpcId,
    }),
  );

  const igwsByVpc = await client.send(
    new DescribeInternetGatewaysCommand({
      Filters: [{ Name: "attachment.vpc-id", Values: [vpcId] }],
    }),
  );
  const foundIgw = (igwsByVpc.InternetGateways ?? []).find(
    (g) => g.InternetGatewayId === igwId,
  );
  expect(foundIgw).toBeDefined();
  expect(foundIgw?.Attachments?.[0]?.VpcId).toBe(vpcId);

  const rtb = await client.send(new CreateRouteTableCommand({ VpcId: vpcId }));
  const rtbId = rtb.RouteTable?.RouteTableId ?? "";
  expect(rtbId.startsWith("rtb-")).toBe(true);

  const assoc = await client.send(
    new AssociateRouteTableCommand({ RouteTableId: rtbId, SubnetId: subnetId }),
  );
  const assocId = assoc.AssociationId ?? "";
  expect(assocId.startsWith("rtbassoc-")).toBe(true);

  await client.send(
    new CreateRouteCommand({
      RouteTableId: rtbId,
      DestinationCidrBlock: "0.0.0.0/0",
      GatewayId: igwId,
    }),
  );

  const rtbsByVpc = await client.send(
    new DescribeRouteTablesCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );
  const foundRtb = (rtbsByVpc.RouteTables ?? []).find(
    (t) => t.RouteTableId === rtbId,
  );
  expect(foundRtb).toBeDefined();
  expect(
    (foundRtb?.Routes ?? []).some(
      (r) => r.DestinationCidrBlock === "0.0.0.0/0",
    ),
  ).toBe(true);
  expect(
    (foundRtb?.Associations ?? []).some((a) => a.SubnetId === subnetId),
  ).toBe(true);

  const rtbsBySubnet = await client.send(
    new DescribeRouteTablesCommand({
      Filters: [{ Name: "association.subnet-id", Values: [subnetId] }],
    }),
  );
  expect((rtbsBySubnet.RouteTables ?? []).map((t) => t.RouteTableId)).toContain(
    rtbId,
  );

  await client.send(
    new DeleteRouteCommand({
      RouteTableId: rtbId,
      DestinationCidrBlock: "0.0.0.0/0",
    }),
  );

  const afterDeleteRoute = await client.send(
    new DescribeRouteTablesCommand({ RouteTableIds: [rtbId] }),
  );
  expect(
    ((afterDeleteRoute.RouteTables ?? [])[0]?.Routes ?? []).some(
      (r) => r.DestinationCidrBlock === "0.0.0.0/0",
    ),
  ).toBe(false);

  await client.send(
    new DisassociateRouteTableCommand({ AssociationId: assocId }),
  );

  const afterDisassoc = await client.send(
    new DescribeRouteTablesCommand({ RouteTableIds: [rtbId] }),
  );
  expect(
    ((afterDisassoc.RouteTables ?? [])[0]?.Associations ?? []).some(
      (a) => a.SubnetId === subnetId,
    ),
  ).toBe(false);
});

test("DeleteVpc with subnet dependency throws DependencyViolation", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.101.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.101.1.0/24" }),
  );

  await expect(
    client.send(new DeleteVpcCommand({ VpcId: vpcId })),
  ).rejects.toMatchObject({ name: "DependencyViolation" });
});

test("DeleteVpc with missing ID throws InvalidVpcID.NotFound", async () => {
  await expect(
    client.send(new DeleteVpcCommand({ VpcId: "vpc-nonexistent" })),
  ).rejects.toMatchObject({ name: "InvalidVpcID.NotFound" });
});
