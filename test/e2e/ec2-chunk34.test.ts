import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTransitGatewayCommand,
  CreateVerifiedAccessInstanceCommand,
  CreateVolumeCommand,
  CreateVpcCommand,
  DescribeTransitGatewayVpcAttachmentsCommand,
  DescribeTransitGatewaysCommand,
  DescribeTrunkInterfaceAssociationsCommand,
  DescribeVerifiedAccessInstanceLoggingConfigurationsCommand,
  DescribeVerifiedAccessInstancesCommand,
  DescribeVolumeAttributeCommand,
  DescribeVolumeStatusCommand,
  DescribeVolumesModificationsCommand,
  DescribeVpcAttributeCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk34 describe transit-gateways, trunk, verified-access, volumes, vpc-attribute e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeTransitGateways empty list then create and describe", async () => {
    const client = ec2();

    const empty = await client.send(new DescribeTransitGatewaysCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(empty.TransitGateways)).toBe(true);

    const created = await client.send(
      new CreateTransitGatewayCommand({ Description: "chunk34-tgw" }),
    );
    const tgwId = created.TransitGateway!.TransitGatewayId!;
    expect(tgwId.startsWith("tgw-")).toBe(true);

    const all = await client.send(new DescribeTransitGatewaysCommand({}));
    const found = all.TransitGateways!.find(
      (g) => g.TransitGatewayId === tgwId,
    );
    expect(found).toBeDefined();
    expect(found!.Description).toBe("chunk34-tgw");

    const byId = await client.send(
      new DescribeTransitGatewaysCommand({ TransitGatewayIds: [tgwId] }),
    );
    expect(byId.TransitGateways).toHaveLength(1);
    expect(byId.TransitGateways![0].TransitGatewayId).toBe(tgwId);
  });

  test("DescribeTransitGatewayVpcAttachments returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeTransitGatewayVpcAttachmentsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.TransitGatewayVpcAttachments)).toBe(true);
  });

  test("DescribeTrunkInterfaceAssociations returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeTrunkInterfaceAssociationsCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.InterfaceAssociations)).toBe(true);
  });

  test("CreateVolume then DescribeVolumeStatus returns it", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 20 }),
    );
    const volId = created.VolumeId!;
    expect(volId.startsWith("vol-")).toBe(true);

    const status = await client.send(
      new DescribeVolumeStatusCommand({ VolumeIds: [volId] }),
    );
    expect(status.$metadata.httpStatusCode).toBe(200);
    const vs = status.VolumeStatuses!.find((s) => s.VolumeId === volId);
    expect(vs).toBeDefined();
    expect(vs!.VolumeStatus!.Status).toBe("ok");
  });

  test("DescribeVolumeAttribute returns autoEnableIO attribute", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateVolumeCommand({ AvailabilityZone: "us-east-1b", Size: 10 }),
    );
    const volId = created.VolumeId!;

    const attr = await client.send(
      new DescribeVolumeAttributeCommand({
        VolumeId: volId,
        Attribute: "autoEnableIO",
      }),
    );
    expect(attr.$metadata.httpStatusCode).toBe(200);
    expect(attr.VolumeId).toBe(volId);
    expect(attr.AutoEnableIO).toBeDefined();
  });

  test("DescribeVolumesModifications returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeVolumesModificationsCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.VolumesModifications)).toBe(true);
  });

  test("CreateVpc then DescribeVpcAttribute returns attribute", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.34.0.0/16" }),
    );
    const vpcId = created.Vpc!.VpcId!;
    expect(vpcId.startsWith("vpc-")).toBe(true);

    const dns = await client.send(
      new DescribeVpcAttributeCommand({
        VpcId: vpcId,
        Attribute: "enableDnsSupport",
      }),
    );
    expect(dns.$metadata.httpStatusCode).toBe(200);
    expect(dns.VpcId).toBe(vpcId);
    expect(dns.EnableDnsSupport).toBeDefined();
    expect(dns.EnableDnsSupport!.Value).toBe(true);
  });

  test("CreateVerifiedAccessInstance then DescribeVerifiedAccessInstances includes it", async () => {
    const client = ec2();

    const created = await client.send(
      new CreateVerifiedAccessInstanceCommand({
        Description: "chunk34-vai",
      }),
    );
    const vaiId = created.VerifiedAccessInstance!.VerifiedAccessInstanceId!;
    expect(vaiId.startsWith("vai-")).toBe(true);

    const all = await client.send(
      new DescribeVerifiedAccessInstancesCommand({}),
    );
    const found = all.VerifiedAccessInstances!.find(
      (i) => i.VerifiedAccessInstanceId === vaiId,
    );
    expect(found).toBeDefined();
    expect(found!.Description).toBe("chunk34-vai");

    const logs = await client.send(
      new DescribeVerifiedAccessInstanceLoggingConfigurationsCommand({
        VerifiedAccessInstanceIds: [vaiId],
      }),
    );
    expect(logs.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(logs.LoggingConfigurations)).toBe(true);
    const logFound = logs.LoggingConfigurations!.find(
      (l) => l.VerifiedAccessInstanceId === vaiId,
    );
    expect(logFound).toBeDefined();
  });
});
