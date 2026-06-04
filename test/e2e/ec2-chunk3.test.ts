import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateCapacityReservationCommand,
  CreateCarrierGatewayCommand,
  CreateClientVpnEndpointCommand,
  CreateClientVpnRouteCommand,
  CreateCoipCidrCommand,
  CreateCoipPoolCommand,
  CreateCustomerGatewayCommand,
  CreateDefaultVpcCommand,
  CreateVpcCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const awsPort = 4580;
const uiPort = 5680;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

describe("ec2 chunk3 create e2e", () => {
  let proc: ReturnType<typeof spawn> | undefined;

  beforeAll(async () => {
    proc = spawn({
      cmd: ["bun", serverEntry],
      env: {
        ...process.env,
        BUNSAI_PORT: String(awsPort),
        BUNSAI_UI_PORT: String(uiPort),
        NODE_ENV: "production",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
    await waitForServer();
  });

  afterAll(() => {
    proc?.kill();
  });

  const ec2 = () => new EC2Client({ endpoint, region, credentials });

  test("create-capacity-reservation: create and verify id", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateCapacityReservationCommand({
        InstanceType: "m5.large",
        InstancePlatform: "Linux/UNIX",
        InstanceCount: 3,
        AvailabilityZone: "us-east-1a",
      }),
    );
    const cr = result.CapacityReservation;
    expect(cr?.CapacityReservationId?.startsWith("cr-")).toBe(true);
    expect(cr?.InstanceType).toBe("m5.large");
    expect(cr?.InstancePlatform).toBe("Linux/UNIX");
    expect(cr?.TotalInstanceCount).toBe(3);
    expect(cr?.AvailableInstanceCount).toBe(3);
    expect(cr?.State).toBe("active");
    expect(cr?.OwnerId).toBeTruthy();
    expect(cr?.CapacityReservationArn).toContain("capacity-reservation");
  });

  test("create-customer-gateway: create and verify", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateCustomerGatewayCommand({
        Type: "ipsec.1",
        IpAddress: "203.0.113.42",
        BgpAsn: 65000,
      }),
    );
    const cgw = result.CustomerGateway;
    expect(cgw?.CustomerGatewayId?.startsWith("cgw-")).toBe(true);
    expect(cgw?.Type).toBe("ipsec.1");
    expect(cgw?.IpAddress).toBe("203.0.113.42");
    expect(cgw?.BgpAsn).toBe("65000");
    expect(cgw?.State).toBe("available");
  });

  test("create-carrier-gateway: create with vpc", async () => {
    const client = ec2();
    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.20.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const result = await client.send(
      new CreateCarrierGatewayCommand({ VpcId: vpcId }),
    );
    const cgw = result.CarrierGateway;
    expect(cgw?.CarrierGatewayId?.startsWith("cagw-")).toBe(true);
    expect(cgw?.VpcId).toBe(vpcId);
    expect(cgw?.State).toBe("available");
  });

  test("create-client-vpn-endpoint: create and verify", async () => {
    const client = ec2();
    const result = await client.send(
      new CreateClientVpnEndpointCommand({
        ServerCertificateArn:
          "arn:aws:acm:us-east-1:000000000000:certificate/test",
        AuthenticationOptions: [
          { Type: "certificate-authentication" as const },
        ],
        ConnectionLogOptions: { Enabled: false },
        ClientCidrBlock: "10.100.0.0/16",
      }),
    );
    expect(result.ClientVpnEndpointId?.startsWith("cvpn-")).toBe(true);
    expect(result.Status?.Code).toBe("available");
    expect(result.DnsName).toContain("clientvpn");
  });

  test("create-client-vpn-route: create route for endpoint", async () => {
    const client = ec2();
    const epResult = await client.send(
      new CreateClientVpnEndpointCommand({
        ServerCertificateArn:
          "arn:aws:acm:us-east-1:000000000000:certificate/test2",
        AuthenticationOptions: [
          { Type: "certificate-authentication" as const },
        ],
        ConnectionLogOptions: { Enabled: false },
        ClientCidrBlock: "10.101.0.0/16",
      }),
    );
    const endpointId = epResult.ClientVpnEndpointId ?? "";
    expect(endpointId.startsWith("cvpn-")).toBe(true);

    const routeResult = await client.send(
      new CreateClientVpnRouteCommand({
        ClientVpnEndpointId: endpointId,
        DestinationCidrBlock: "0.0.0.0/0",
        TargetVpcSubnetId: "local",
      }),
    );
    expect(routeResult.Status?.Code).toBe("creating");
  });

  test("create-coip-pool and create-coip-cidr: full lifecycle", async () => {
    const client = ec2();
    const poolResult = await client.send(
      new CreateCoipPoolCommand({
        LocalGatewayRouteTableId: "lgw-rtb-12345678",
      }),
    );
    const pool = poolResult.CoipPool;
    expect(pool?.PoolId?.startsWith("ipv4pool-coip-")).toBe(true);
    expect(pool?.LocalGatewayRouteTableId).toBe("lgw-rtb-12345678");
    expect(pool?.PoolArn).toContain("coip-pool");

    const cidrResult = await client.send(
      new CreateCoipCidrCommand({
        Cidr: "192.168.100.0/24",
        CoipPoolId: pool?.PoolId ?? "",
      }),
    );
    const coipCidr = cidrResult.CoipCidr;
    expect(coipCidr?.Cidr).toBe("192.168.100.0/24");
    expect(coipCidr?.CoipPoolId).toBe(pool?.PoolId);
    expect(coipCidr?.LocalGatewayRouteTableId).toBe("lgw-rtb-12345678");
  });

  test("create-default-vpc: creates a default VPC", async () => {
    const client = ec2();
    const result = await client.send(new CreateDefaultVpcCommand({}));
    const vpc = result.Vpc;
    expect(vpc?.VpcId?.startsWith("vpc-")).toBe(true);
    expect(vpc?.IsDefault).toBe(true);
    expect(vpc?.CidrBlock).toBe("172.31.0.0/16");
    expect(vpc?.State).toBe("available");
  });
});
