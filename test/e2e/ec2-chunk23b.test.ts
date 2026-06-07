import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateCapacityReservationCommand,
  CreateCarrierGatewayCommand,
  CreateClientVpnEndpointCommand,
  CreateClientVpnRouteCommand,
  CreateCoipPoolCommand,
  CreateVpcCommand,
  DescribeCapacityReservationBillingRequestsCommand,
  DescribeCapacityReservationFleetsCommand,
  DescribeCapacityReservationTopologyCommand,
  DescribeCapacityReservationsCommand,
  DescribeCarrierGatewaysCommand,
  DescribeClassicLinkInstancesCommand,
  DescribeClientVpnAuthorizationRulesCommand,
  DescribeClientVpnConnectionsCommand,
  DescribeClientVpnEndpointsCommand,
  DescribeClientVpnRoutesCommand,
  DescribeClientVpnTargetNetworksCommand,
  DescribeCoipPoolsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk23b describe capacity-reservations/carrier-gw/client-vpn/coip e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeCapacityReservationBillingRequests: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeCapacityReservationBillingRequestsCommand({
        Role: "odcr-owner",
      }),
    );
    expect(res.CapacityReservationBillingRequests).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeCapacityReservationFleets: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeCapacityReservationFleetsCommand({}),
    );
    expect(res.CapacityReservationFleets).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateCapacityReservation then DescribeCapacityReservations: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateCapacityReservationCommand({
        InstanceType: "t3.micro",
        InstancePlatform: "Linux/UNIX",
        InstanceCount: 2,
        AvailabilityZone: "us-east-1a",
      }),
    );
    const id = created.CapacityReservation?.CapacityReservationId;
    expect(typeof id).toBe("string");
    expect(id?.startsWith("cr-")).toBe(true);

    const listed = await client.send(
      new DescribeCapacityReservationsCommand({
        CapacityReservationIds: [id!],
      }),
    );
    expect(listed.CapacityReservations).toHaveLength(1);
    expect(listed.CapacityReservations![0].CapacityReservationId).toBe(id);
    expect(listed.CapacityReservations![0].InstanceType).toBe("t3.micro");
    expect(listed.CapacityReservations![0].TotalInstanceCount).toBe(2);
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeCapacityReservationTopology: returns empty list when no reservations filtered", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeCapacityReservationTopologyCommand({
        CapacityReservationIds: ["cr-nonexistent"],
      }),
    );
    expect(Array.isArray(res.CapacityReservations)).toBe(true);
    expect(res.CapacityReservations).toHaveLength(0);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateCarrierGateway then DescribeCarrierGateways: round-trip", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId!;

    const created = await client.send(
      new CreateCarrierGatewayCommand({ VpcId: vpcId }),
    );
    const cgwId = created.CarrierGateway?.CarrierGatewayId;
    expect(typeof cgwId).toBe("string");

    const listed = await client.send(
      new DescribeCarrierGatewaysCommand({ CarrierGatewayIds: [cgwId!] }),
    );
    expect(listed.CarrierGateways).toHaveLength(1);
    expect(listed.CarrierGateways![0].CarrierGatewayId).toBe(cgwId);
    expect(listed.CarrierGateways![0].VpcId).toBe(vpcId);
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeClassicLinkInstances: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeClassicLinkInstancesCommand({}));
    expect(res.Instances).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateClientVpnEndpoint then DescribeClientVpnEndpoints and DescribeClientVpnRoutes: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateClientVpnEndpointCommand({
        ClientCidrBlock: "10.1.0.0/16",
        ServerCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/test",
        AuthenticationOptions: [{ Type: "certificate-authentication" }],
        ConnectionLogOptions: { Enabled: false },
      }),
    );
    const endpointId = created.ClientVpnEndpointId;
    expect(typeof endpointId).toBe("string");

    const endpoints = await client.send(
      new DescribeClientVpnEndpointsCommand({
        ClientVpnEndpointIds: [endpointId!],
      }),
    );
    expect(endpoints.ClientVpnEndpoints).toHaveLength(1);
    expect(endpoints.ClientVpnEndpoints![0].ClientVpnEndpointId).toBe(
      endpointId,
    );
    expect(endpoints.$metadata.httpStatusCode).toBe(200);

    await client.send(
      new CreateClientVpnRouteCommand({
        ClientVpnEndpointId: endpointId!,
        DestinationCidrBlock: "0.0.0.0/0",
        TargetVpcSubnetId: "subnet-00000001",
      }),
    );

    const routes = await client.send(
      new DescribeClientVpnRoutesCommand({ ClientVpnEndpointId: endpointId! }),
    );
    expect(routes.Routes).toHaveLength(1);
    expect(routes.Routes![0].DestinationCidr).toBe("0.0.0.0/0");
    expect(routes.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeClientVpnAuthorizationRules: returns empty list", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateClientVpnEndpointCommand({
        ClientCidrBlock: "10.2.0.0/16",
        ServerCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/test2",
        AuthenticationOptions: [{ Type: "certificate-authentication" }],
        ConnectionLogOptions: { Enabled: false },
      }),
    );
    const res = await client.send(
      new DescribeClientVpnAuthorizationRulesCommand({
        ClientVpnEndpointId: created.ClientVpnEndpointId!,
      }),
    );
    expect(res.AuthorizationRules).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeClientVpnConnections: returns empty list", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateClientVpnEndpointCommand({
        ClientCidrBlock: "10.3.0.0/16",
        ServerCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/test3",
        AuthenticationOptions: [{ Type: "certificate-authentication" }],
        ConnectionLogOptions: { Enabled: false },
      }),
    );
    const res = await client.send(
      new DescribeClientVpnConnectionsCommand({
        ClientVpnEndpointId: created.ClientVpnEndpointId!,
      }),
    );
    expect(res.Connections).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeClientVpnTargetNetworks: returns empty list", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateClientVpnEndpointCommand({
        ClientCidrBlock: "10.4.0.0/16",
        ServerCertificateArn:
          "arn:aws:acm:us-east-1:123456789012:certificate/test4",
        AuthenticationOptions: [{ Type: "certificate-authentication" }],
        ConnectionLogOptions: { Enabled: false },
      }),
    );
    const res = await client.send(
      new DescribeClientVpnTargetNetworksCommand({
        ClientVpnEndpointId: created.ClientVpnEndpointId!,
      }),
    );
    expect(res.ClientVpnTargetNetworks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateCoipPool then DescribeCoipPools: round-trip", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateCoipPoolCommand({
        LocalGatewayRouteTableId: "lgw-rtb-00000001",
      }),
    );
    const poolId = created.CoipPool?.PoolId;
    expect(typeof poolId).toBe("string");

    const listed = await client.send(
      new DescribeCoipPoolsCommand({ PoolIds: [poolId!] }),
    );
    expect(listed.CoipPools).toHaveLength(1);
    expect(listed.CoipPools![0].PoolId).toBe(poolId);
    expect(listed.$metadata.httpStatusCode).toBe(200);
  });
});
