import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateNatGatewayCommand,
  CreateSnapshotCommand,
  CreateSubnetCommand,
  CreateVolumeCommand,
  CreateVpcCommand,
  DeleteNatGatewayCommand,
  DeleteSnapshotCommand,
  DeleteVolumeCommand,
  DescribeNatGatewaysCommand,
  DescribeSnapshotsCommand,
  DescribeVolumesCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 volume snapshot natgateway e2e", () => {
  const ec2 = () =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create, describe and delete volume", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateVolumeCommand({
        AvailabilityZone: "us-east-1a",
        Size: 16,
        VolumeType: "gp3",
      }),
    );
    const volumeId = created.VolumeId ?? "";
    expect(volumeId.startsWith("vol-")).toBe(true);
    expect(created.Size).toBe(16);
    expect(created.State).toBe("available");

    const described = await client.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] }),
    );
    const found = (described.Volumes ?? []).map((volume) => volume.VolumeId);
    expect(found).toContain(volumeId);

    await client.send(new DeleteVolumeCommand({ VolumeId: volumeId }));

    const afterDelete = await client.send(new DescribeVolumesCommand({}));
    const remaining = (afterDelete.Volumes ?? []).map(
      (volume) => volume.VolumeId,
    );
    expect(remaining).not.toContain(volumeId);
  });

  test("create, describe and delete snapshot", async () => {
    const client = ec2();
    const volume = await client.send(
      new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 8 }),
    );
    const volumeId = volume.VolumeId ?? "";

    const created = await client.send(
      new CreateSnapshotCommand({
        VolumeId: volumeId,
        Description: "test snapshot",
      }),
    );
    const snapshotId = created.SnapshotId ?? "";
    expect(snapshotId.startsWith("snap-")).toBe(true);
    expect(created.VolumeId).toBe(volumeId);
    expect(created.State).toBe("completed");
    expect(created.VolumeSize).toBe(8);

    const described = await client.send(
      new DescribeSnapshotsCommand({ SnapshotIds: [snapshotId] }),
    );
    const found = (described.Snapshots ?? []).map(
      (snapshot) => snapshot.SnapshotId,
    );
    expect(found).toContain(snapshotId);

    await client.send(new DeleteSnapshotCommand({ SnapshotId: snapshotId }));

    const afterDelete = await client.send(new DescribeSnapshotsCommand({}));
    const remaining = (afterDelete.Snapshots ?? []).map(
      (snapshot) => snapshot.SnapshotId,
    );
    expect(remaining).not.toContain(snapshotId);

    await client.send(new DeleteVolumeCommand({ VolumeId: volumeId }));
  });

  test("create, describe and delete nat gateway", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.9.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId ?? "";
    const subnet = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.9.1.0/24" }),
    );
    const subnetId = subnet.Subnet?.SubnetId ?? "";

    const created = await client.send(
      new CreateNatGatewayCommand({ SubnetId: subnetId }),
    );
    const natGatewayId = created.NatGateway?.NatGatewayId ?? "";
    expect(natGatewayId.startsWith("nat-")).toBe(true);
    expect(created.NatGateway?.SubnetId).toBe(subnetId);
    expect(created.NatGateway?.VpcId).toBe(vpcId);
    expect(created.NatGateway?.State).toBe("available");

    const described = await client.send(
      new DescribeNatGatewaysCommand({ NatGatewayIds: [natGatewayId] }),
    );
    const found = (described.NatGateways ?? []).map(
      (gateway) => gateway.NatGatewayId,
    );
    expect(found).toContain(natGatewayId);

    const deleted = await client.send(
      new DeleteNatGatewayCommand({ NatGatewayId: natGatewayId }),
    );
    expect(deleted.NatGatewayId).toBe(natGatewayId);
  });
});
