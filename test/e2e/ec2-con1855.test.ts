import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AllocateAddressCommand,
  AssociateAddressCommand,
  CreateNatGatewayCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  CreateVpcEndpointCommand,
  DeleteNatGatewayCommand,
  DeleteVpcEndpointsCommand,
  DescribeAddressesCommand,
  DescribeNatGatewaysCommand,
  DescribeVpcEndpointsCommand,
  DisassociateAddressCommand,
  EC2Client,
  ReleaseAddressCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("Elastic IP allocate/associate/release lifecycle", async () => {
  const alloc = await client.send(
    new AllocateAddressCommand({ Domain: "vpc" }),
  );
  const allocId = alloc.AllocationId ?? "";
  expect(allocId.startsWith("eipalloc-")).toBe(true);
  expect(alloc.PublicIp).toBeDefined();

  const assoc = await client.send(
    new AssociateAddressCommand({
      AllocationId: allocId,
      InstanceId: "i-test123",
    }),
  );
  const assocId = assoc.AssociationId ?? "";
  expect(assocId.startsWith("eipassoc-")).toBe(true);

  const afterAssoc = await client.send(
    new DescribeAddressesCommand({ AllocationIds: [allocId] }),
  );
  const addr = (afterAssoc.Addresses ?? [])[0];
  expect(addr?.AssociationId).toBe(assocId);
  expect(addr?.InstanceId).toBe("i-test123");

  await client.send(new DisassociateAddressCommand({ AssociationId: assocId }));

  const afterDisassoc = await client.send(
    new DescribeAddressesCommand({ AllocationIds: [allocId] }),
  );
  const addrAfter = (afterDisassoc.Addresses ?? [])[0];
  expect(addrAfter?.AssociationId).toBeUndefined();

  await client.send(new ReleaseAddressCommand({ AllocationId: allocId }));

  await expect(
    client.send(new ReleaseAddressCommand({ AllocationId: allocId })),
  ).rejects.toMatchObject({ name: "InvalidAllocationID.NotFound" });
});

test("NAT gateway create/describe/delete lifecycle", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.200.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const subnet = await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.200.1.0/24" }),
  );
  const subnetId = subnet.Subnet?.SubnetId ?? "";

  const eip = await client.send(new AllocateAddressCommand({ Domain: "vpc" }));
  const eipAllocId = eip.AllocationId ?? "";

  const nat = await client.send(
    new CreateNatGatewayCommand({
      SubnetId: subnetId,
      AllocationId: eipAllocId,
    }),
  );
  const natId = nat.NatGateway?.NatGatewayId ?? "";
  expect(natId.startsWith("nat-")).toBe(true);
  expect(nat.NatGateway?.State).toBe("available");

  const described = await client.send(
    new DescribeNatGatewaysCommand({ NatGatewayIds: [natId] }),
  );
  const gw = (described.NatGateways ?? [])[0];
  expect(gw?.State).toBe("available");
  expect(gw?.VpcId).toBe(vpcId);

  const del = await client.send(
    new DeleteNatGatewayCommand({ NatGatewayId: natId }),
  );
  expect(del.NatGatewayId).toBe(natId);

  const afterDelete = await client.send(
    new DescribeNatGatewaysCommand({ NatGatewayIds: [natId] }),
  );
  expect((afterDelete.NatGateways ?? [])[0]?.State).toBe("deleted");
});

test("VPC endpoint create/describe/delete lifecycle", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.201.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const ep = await client.send(
    new CreateVpcEndpointCommand({
      VpcId: vpcId,
      ServiceName: "com.amazonaws.us-east-1.s3",
      VpcEndpointType: "Gateway",
    }),
  );
  const epId = ep.VpcEndpoint?.VpcEndpointId ?? "";
  expect(epId.startsWith("vpce-")).toBe(true);
  expect(ep.VpcEndpoint?.VpcId).toBe(vpcId);

  const byVpc = await client.send(
    new DescribeVpcEndpointsCommand({
      Filters: [{ Name: "vpc-id", Values: [vpcId] }],
    }),
  );
  expect((byVpc.VpcEndpoints ?? []).map((e) => e.VpcEndpointId)).toContain(
    epId,
  );

  const delResult = await client.send(
    new DeleteVpcEndpointsCommand({ VpcEndpointIds: [epId] }),
  );
  expect((delResult.Unsuccessful ?? []).length).toBe(0);

  const afterDelete = await client.send(
    new DescribeVpcEndpointsCommand({ VpcEndpointIds: [epId] }),
  );
  expect(afterDelete.VpcEndpoints ?? []).toHaveLength(0);
});
