import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4584;
const uiPort = 5684;
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

describe("ec2 chunk6 associate e2e", () => {
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
