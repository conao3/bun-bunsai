import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSnapshotCommand,
  CreateVolumeCommand,
  CreateVpcCommand,
  DescribeImagesCommand,
  DescribeKeyPairsCommand,
  DescribeSnapshotsCommand,
  DescribeVolumesCommand,
  EC2Client,
  GetVpnConnectionDeviceTypesCommand,
  ImportImageCommand,
  ImportKeyPairCommand,
  ImportSnapshotCommand,
  ImportVolumeCommand,
  ListImagesInRecycleBinCommand,
  ListSnapshotsInRecycleBinCommand,
  DeregisterImageCommand,
  DeleteSnapshotCommand,
  GetVpcResourcesBlockingEncryptionEnforcementCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ImportKeyPair → DescribeKeyPairs includes it", async () => {
  const res = await client.send(
    new ImportKeyPairCommand({
      KeyName: "imported-key-chunk47",
      PublicKeyMaterial: new TextEncoder().encode("ssh-rsa AAAA..."),
    }),
  );
  expect(res.KeyPairId?.startsWith("key-")).toBe(true);
  expect(res.KeyName).toBe("imported-key-chunk47");
  expect(typeof res.KeyFingerprint).toBe("string");

  const described = await client.send(new DescribeKeyPairsCommand({}));
  const found = (described.KeyPairs ?? []).find(
    (kp) => kp.KeyName === "imported-key-chunk47",
  );
  expect(found).toBeDefined();
  expect(found?.KeyPairId).toBe(res.KeyPairId);
});

test("ImportImage → DescribeImages includes it", async () => {
  const res = await client.send(
    new ImportImageCommand({
      Description: "test-import-image-chunk47",
      Architecture: "x86_64",
      Platform: "Linux",
    }),
  );
  expect(res.ImageId?.startsWith("ami-")).toBe(true);
  expect(res.ImportTaskId?.startsWith("import-ami-")).toBe(true);
  expect(res.Status).toBe("completed");

  const described = await client.send(new DescribeImagesCommand({}));
  const found = (described.Images ?? []).find(
    (img) => img.ImageId === res.ImageId,
  );
  expect(found).toBeDefined();
  expect(found?.Description).toBe("test-import-image-chunk47");
});

test("GetVpnConnectionDeviceTypes returns non-empty catalog", async () => {
  const res = await client.send(new GetVpnConnectionDeviceTypesCommand({}));
  expect((res.VpnConnectionDeviceTypes ?? []).length).toBeGreaterThan(0);
  const first = res.VpnConnectionDeviceTypes![0];
  expect(typeof first.VpnConnectionDeviceTypeId).toBe("string");
  expect(typeof first.Vendor).toBe("string");
});

test("ImportSnapshot → DescribeSnapshots includes it", async () => {
  const res = await client.send(
    new ImportSnapshotCommand({ Description: "test-import-snap-chunk47" }),
  );
  expect(res.ImportTaskId?.startsWith("import-snap-")).toBe(true);
  expect(res.SnapshotTaskDetail?.SnapshotId?.startsWith("snap-")).toBe(true);

  const described = await client.send(new DescribeSnapshotsCommand({}));
  const snapId = res.SnapshotTaskDetail?.SnapshotId ?? "";
  const found = (described.Snapshots ?? []).find(
    (s) => s.SnapshotId === snapId,
  );
  expect(found).toBeDefined();
});

test("ImportVolume → DescribeVolumes includes it", async () => {
  const res = await client.send(
    new ImportVolumeCommand({
      AvailabilityZone: "us-east-1a",
      Image: {
        Bytes: 1073741824,
        Format: "RAW",
        ImportManifestUrl: "s3://bucket/key",
      },
      Volume: { Size: 10 },
    }),
  );
  expect(res.ConversionTask?.ConversionTaskId?.startsWith("import-vol-")).toBe(
    true,
  );
  const volId = (res.ConversionTask?.ImportVolume?.Volume as { Id?: string })
    ?.Id;
  expect(volId?.startsWith("vol-")).toBe(true);

  const described = await client.send(new DescribeVolumesCommand({}));
  const found = (described.Volumes ?? []).find((v) => v.VolumeId === volId);
  expect(found).toBeDefined();
  expect(found?.Size).toBe(10);
});

test("DeregisterImage → ListImagesInRecycleBin returns it", async () => {
  const img = await client.send(
    new ImportImageCommand({ Description: "recycle-bin-test-chunk47" }),
  );
  const imageId = img.ImageId ?? "";

  await client.send(new DeregisterImageCommand({ ImageId: imageId }));

  const binRes = await client.send(new ListImagesInRecycleBinCommand({}));
  const found = (binRes.Images ?? []).find((i) => i.ImageId === imageId);
  expect(found).toBeDefined();
});

test("DeleteSnapshot → ListSnapshotsInRecycleBin returns it", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.99.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";
  const vol = await client.send(
    new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 1 }),
  );
  const volumeId = vol.VolumeId ?? "";
  const snap = await client.send(
    new CreateSnapshotCommand({
      VolumeId: volumeId,
      Description: "snap-for-recycle-bin-chunk47",
    }),
  );
  const snapshotId = snap.SnapshotId ?? "";

  await client.send(new DeleteSnapshotCommand({ SnapshotId: snapshotId }));

  const notInDescribe = await client.send(new DescribeSnapshotsCommand({}));
  expect(
    (notInDescribe.Snapshots ?? []).map((s) => s.SnapshotId),
  ).not.toContain(snapshotId);

  const binRes = await client.send(new ListSnapshotsInRecycleBinCommand({}));
  const found = (binRes.Snapshots ?? []).find(
    (s) => s.SnapshotId === snapshotId,
  );
  expect(found).toBeDefined();

  void vpcId;
});

test("GetVpcResourcesBlockingEncryptionEnforcement returns empty for existing VPC", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.200.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId ?? "";

  const res = await client.send(
    new GetVpcResourcesBlockingEncryptionEnforcementCommand({ VpcId: vpcId }),
  );
  expect(res.NonCompliantResources ?? []).toHaveLength(0);
});
