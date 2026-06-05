import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateTransitGatewayCommand,
  CreateTransitGatewayRouteTableCommand,
  CreateTransitGatewayRouteCommand,
  CreateTransitGatewayVpcAttachmentCommand,
  CreateTransitGatewayMulticastDomainCommand,
  CreateTransitGatewayPolicyTableCommand,
  CreateVerifiedAccessInstanceCommand,
  CreateVerifiedAccessGroupCommand,
  CreateVpcCommand,
  CreateSubnetCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const awsPort = 4590;
const uiPort = 5690;
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

describe("ec2 chunk12 create-transit-gateway-route-table and create-verified-access-instance e2e", () => {
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

  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials });

  test("create-transit-gateway-route-table: returns a valid route table", async () => {
    const client = ec2();

    const tgwRes = await client.send(
      new CreateTransitGatewayCommand({ Description: "tgw-for-rtb" }),
    );
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const res = await client.send(
      new CreateTransitGatewayRouteTableCommand({
        TransitGatewayId: tgwId,
      }),
    );

    const rtb = res.TransitGatewayRouteTable;
    expect(rtb).toBeDefined();
    expect(rtb?.TransitGatewayRouteTableId?.startsWith("tgw-rtb-")).toBe(true);
    expect(rtb?.TransitGatewayId).toBe(tgwId);
    expect(rtb?.State).toBe("available");
    expect(rtb?.DefaultAssociationRouteTable).toBe(false);
    expect(rtb?.DefaultPropagationRouteTable).toBe(false);
    expect(rtb?.CreationTime).toBeDefined();
  });

  test("create-transit-gateway-route: returns a valid static route", async () => {
    const client = ec2();

    const tgwRes = await client.send(new CreateTransitGatewayCommand({}));
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const rtbRes = await client.send(
      new CreateTransitGatewayRouteTableCommand({
        TransitGatewayId: tgwId,
      }),
    );
    const rtbId =
      rtbRes.TransitGatewayRouteTable?.TransitGatewayRouteTableId ?? "";

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.10.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const subnetRes = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.10.1.0/24" }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";

    const attachRes = await client.send(
      new CreateTransitGatewayVpcAttachmentCommand({
        TransitGatewayId: tgwId,
        VpcId: vpcId,
        SubnetIds: [subnetId],
      }),
    );
    const attachId =
      attachRes.TransitGatewayVpcAttachment?.TransitGatewayAttachmentId ?? "";

    const routeRes = await client.send(
      new CreateTransitGatewayRouteCommand({
        TransitGatewayRouteTableId: rtbId,
        DestinationCidrBlock: "192.168.0.0/16",
        TransitGatewayAttachmentId: attachId,
      }),
    );

    const route = routeRes.Route;
    expect(route).toBeDefined();
    expect(route?.DestinationCidrBlock).toBe("192.168.0.0/16");
    expect(route?.Type).toBe("static");
    expect(route?.State).toBe("active");
  });

  test("create-transit-gateway-vpc-attachment: returns a valid attachment", async () => {
    const client = ec2();

    const tgwRes = await client.send(new CreateTransitGatewayCommand({}));
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "172.16.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const subnetRes = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "172.16.1.0/24" }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";

    const res = await client.send(
      new CreateTransitGatewayVpcAttachmentCommand({
        TransitGatewayId: tgwId,
        VpcId: vpcId,
        SubnetIds: [subnetId],
      }),
    );

    const att = res.TransitGatewayVpcAttachment;
    expect(att).toBeDefined();
    expect(att?.TransitGatewayAttachmentId?.startsWith("tgw-attach-")).toBe(
      true,
    );
    expect(att?.TransitGatewayId).toBe(tgwId);
    expect(att?.VpcId).toBe(vpcId);
    expect(att?.State).toBe("available");
    expect(att?.SubnetIds).toContain(subnetId);
  });

  test("create-transit-gateway-multicast-domain: returns a valid domain", async () => {
    const client = ec2();

    const tgwRes = await client.send(new CreateTransitGatewayCommand({}));
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const res = await client.send(
      new CreateTransitGatewayMulticastDomainCommand({
        TransitGatewayId: tgwId,
      }),
    );

    const domain = res.TransitGatewayMulticastDomain;
    expect(domain).toBeDefined();
    expect(
      domain?.TransitGatewayMulticastDomainId?.startsWith("tgw-mcast-"),
    ).toBe(true);
    expect(domain?.TransitGatewayId).toBe(tgwId);
    expect(domain?.State).toBe("available");
  });

  test("create-transit-gateway-policy-table: returns a valid policy table", async () => {
    const client = ec2();

    const tgwRes = await client.send(new CreateTransitGatewayCommand({}));
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const res = await client.send(
      new CreateTransitGatewayPolicyTableCommand({
        TransitGatewayId: tgwId,
      }),
    );

    const pt = res.TransitGatewayPolicyTable;
    expect(pt).toBeDefined();
    expect(pt?.TransitGatewayPolicyTableId?.startsWith("tgw-pt-")).toBe(true);
    expect(pt?.TransitGatewayId).toBe(tgwId);
    expect(pt?.State).toBe("available");
  });

  test("create-verified-access-instance: returns a valid instance", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateVerifiedAccessInstanceCommand({
        Description: "test-vai",
      }),
    );

    const instance = res.VerifiedAccessInstance;
    expect(instance).toBeDefined();
    expect(instance?.VerifiedAccessInstanceId?.startsWith("vai-")).toBe(true);
    expect(instance?.Description).toBe("test-vai");
    expect(instance?.CreationTime).toBeDefined();
    expect(instance?.LastUpdatedTime).toBeDefined();
    expect(instance?.FipsEnabled).toBe(false);
    expect(Array.isArray(instance?.VerifiedAccessTrustProviders)).toBe(true);
  });

  test("create-verified-access-instance: two instances get distinct IDs", async () => {
    const client = ec2();

    const res1 = await client.send(new CreateVerifiedAccessInstanceCommand({}));
    const res2 = await client.send(new CreateVerifiedAccessInstanceCommand({}));

    expect(res1.VerifiedAccessInstance?.VerifiedAccessInstanceId).not.toBe(
      res2.VerifiedAccessInstance?.VerifiedAccessInstanceId,
    );
  });

  test("create-verified-access-group: returns a valid group linked to instance", async () => {
    const client = ec2();

    const instRes = await client.send(
      new CreateVerifiedAccessInstanceCommand({
        Description: "vai-for-group",
      }),
    );
    const instId =
      instRes.VerifiedAccessInstance?.VerifiedAccessInstanceId ?? "";

    const res = await client.send(
      new CreateVerifiedAccessGroupCommand({
        VerifiedAccessInstanceId: instId,
        Description: "test-group",
      }),
    );

    const group = res.VerifiedAccessGroup;
    expect(group).toBeDefined();
    expect(group?.VerifiedAccessGroupId?.startsWith("vagr-")).toBe(true);
    expect(group?.VerifiedAccessInstanceId).toBe(instId);
    expect(group?.Description).toBe("test-group");
    expect(group?.Owner).toBe("000000000000");
    expect(group?.VerifiedAccessGroupArn).toContain(
      "verified-access-group/vagr-",
    );
    expect(group?.CreationTime).toBeDefined();
    expect(group?.LastUpdatedTime).toBeDefined();
  });
});
