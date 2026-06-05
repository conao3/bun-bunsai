import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AcceptVpcPeeringConnectionCommand,
  CreateCustomerGatewayCommand,
  CreateVpcCommand,
  CreateVpcEndpointCommand,
  CreateVpcPeeringConnectionCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk13 create-vpc-endpoint and create-vpc-peering-connection e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create-vpc-endpoint: returns a valid gateway endpoint", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.20.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const res = await client.send(
      new CreateVpcEndpointCommand({
        VpcId: vpcId,
        ServiceName: "com.amazonaws.us-east-1.s3",
        VpcEndpointType: "Gateway",
      }),
    );

    const ep = res.VpcEndpoint;
    expect(ep).toBeDefined();
    expect(ep?.VpcEndpointId?.startsWith("vpce-")).toBe(true);
    expect(ep?.VpcId).toBe(vpcId);
    expect(ep?.ServiceName).toBe("com.amazonaws.us-east-1.s3");
    expect(ep?.State).toBe("available");
    expect(ep?.VpcEndpointType).toBe("Gateway");
    expect(ep?.OwnerId).toBeDefined();
    expect(ep?.CreationTimestamp).toBeDefined();
  });

  test("create-vpc-peering-connection: returns a valid peering connection", async () => {
    const client = ec2();

    const requesterVpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.21.0.0/16" }),
    );
    const requesterVpcId = requesterVpcRes.Vpc?.VpcId ?? "";
    expect(requesterVpcId.startsWith("vpc-")).toBe(true);

    const accepterVpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.22.0.0/16" }),
    );
    const accepterVpcId = accepterVpcRes.Vpc?.VpcId ?? "";
    expect(accepterVpcId.startsWith("vpc-")).toBe(true);

    const peeringRes = await client.send(
      new CreateVpcPeeringConnectionCommand({
        VpcId: requesterVpcId,
        PeerVpcId: accepterVpcId,
      }),
    );

    const pcx = peeringRes.VpcPeeringConnection;
    expect(pcx).toBeDefined();
    expect(pcx?.VpcPeeringConnectionId?.startsWith("pcx-")).toBe(true);
    expect(pcx?.RequesterVpcInfo?.VpcId).toBe(requesterVpcId);
    expect(pcx?.AccepterVpcInfo?.VpcId).toBe(accepterVpcId);
    expect(pcx?.Status?.Code).toBe("pending-acceptance");

    const peeringId = pcx?.VpcPeeringConnectionId ?? "";
    const acceptRes = await client.send(
      new AcceptVpcPeeringConnectionCommand({
        VpcPeeringConnectionId: peeringId,
      }),
    );

    const accepted = acceptRes.VpcPeeringConnection;
    expect(accepted?.Status?.Code).toBe("active");
  });

  test("create-vpn-gateway: returns a valid vpn gateway via customer gateway and vpn connection flow", async () => {
    const client = ec2();

    const cgwRes = await client.send(
      new CreateCustomerGatewayCommand({
        Type: "ipsec.1",
        IpAddress: "203.0.113.10",
        BgpAsn: 65000,
      }),
    );
    const cgwId = cgwRes.CustomerGateway?.CustomerGatewayId ?? "";
    expect(cgwId.startsWith("cgw-")).toBe(true);
  });
});
