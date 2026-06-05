import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptAddressTransferCommand,
  AcceptCapacityReservationBillingOwnershipCommand,
  AcceptVpcEndpointConnectionsCommand,
  AllocateAddressCommand,
  AllocateHostsCommand,
  AssignPrivateNatGatewayAddressCommand,
  AssociateAddressCommand,
  CreateNatGatewayCommand,
  CreateSubnetCommand,
  CreateVpcCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk1 e2e", () => {
  const ec2 = () =>
    new EC2Client({
      endpoint,
      region,
      credentials,
      requestHandler,
    });

  test("associate-address: allocate EIP, run instance, associate", async () => {
    const client = ec2();

    const allocated = await client.send(
      new AllocateAddressCommand({ Domain: "vpc" }),
    );
    const allocationId = allocated.AllocationId ?? "";
    expect(allocationId.startsWith("eipalloc-")).toBe(true);
    expect(allocated.PublicIp).toBeTruthy();
    expect(allocated.Domain).toBe("vpc");

    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-12345678",
        InstanceType: "t2.micro",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = run.Instances?.[0]?.InstanceId ?? "";
    expect(instanceId.startsWith("i-")).toBe(true);

    const associated = await client.send(
      new AssociateAddressCommand({
        AllocationId: allocationId,
        InstanceId: instanceId,
      }),
    );
    const associationId = associated.AssociationId ?? "";
    expect(associationId.startsWith("eipassoc-")).toBe(true);
  });

  test("allocate-hosts: create dedicated hosts", async () => {
    const client = ec2();

    const result = await client.send(
      new AllocateHostsCommand({
        AvailabilityZone: "us-east-1a",
        InstanceType: "m5.large",
        Quantity: 2,
        AutoPlacement: "on",
      }),
    );
    const hostIds = result.HostIds ?? [];
    expect(hostIds.length).toBe(2);
    for (const id of hostIds) {
      expect(id.startsWith("h-")).toBe(true);
    }
  });

  test("accept-address-transfer: accept EIP transfer", async () => {
    const client = ec2();

    const allocated = await client.send(
      new AllocateAddressCommand({ Domain: "vpc" }),
    );
    const publicIp = allocated.PublicIp ?? "";
    expect(publicIp).toBeTruthy();

    const result = await client.send(
      new AcceptAddressTransferCommand({ Address: publicIp }),
    );
    expect(result.AddressTransfer?.PublicIp).toBe(publicIp);
    expect(result.AddressTransfer?.AddressTransferStatus).toBe("accepted");
    expect(result.AddressTransfer?.AllocationId).toBe(allocated.AllocationId);
  });

  test("accept-capacity-reservation-billing-ownership", async () => {
    const client = ec2();
    const result = await client.send(
      new AcceptCapacityReservationBillingOwnershipCommand({
        CapacityReservationId: "cr-12345678",
      }),
    );
    expect(result.Return).toBe(true);
  });

  test("accept-vpc-endpoint-connections: returns empty unsuccessful", async () => {
    const client = ec2();
    const result = await client.send(
      new AcceptVpcEndpointConnectionsCommand({
        ServiceId: "vpce-svc-12345",
        VpcEndpointIds: ["vpce-12345"],
      }),
    );
    expect(result.Unsuccessful).toBeDefined();
    expect(Array.isArray(result.Unsuccessful)).toBe(true);
    expect(result.Unsuccessful?.length).toBe(0);
  });

  test("assign-private-nat-gateway-address", async () => {
    const client = ec2();

    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.9.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId ?? "";
    const subnet = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.9.1.0/24" }),
    );
    const subnetId = subnet.Subnet?.SubnetId ?? "";

    const natGw = await client.send(
      new CreateNatGatewayCommand({
        SubnetId: subnetId,
        ConnectivityType: "private",
      }),
    );
    const natGatewayId = natGw.NatGateway?.NatGatewayId ?? "";
    expect(natGatewayId.startsWith("nat-")).toBe(true);

    const result = await client.send(
      new AssignPrivateNatGatewayAddressCommand({
        NatGatewayId: natGatewayId,
        PrivateIpAddressCount: 1,
      }),
    );
    expect(result.NatGatewayId).toBe(natGatewayId);
    const addresses = result.NatGatewayAddresses ?? [];
    expect(addresses.length).toBeGreaterThanOrEqual(1);
  });
});
