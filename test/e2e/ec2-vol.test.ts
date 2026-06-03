import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4577;
const uiPort = 5677;
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

describe("ec2 volume snapshot natgateway e2e", () => {
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
