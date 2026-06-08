import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AllocateHostsCommand,
  CreateCapacityReservationCommand,
  CreateClientVpnEndpointCommand,
  CreateSnapshotCommand,
  CreateVolumeCommand,
  DescribeCapacityReservationsCommand,
  DescribeClientVpnEndpointsCommand,
  DescribeHostsCommand,
  DescribeLockedSnapshotsCommand,
  EC2Client,
  ListVolumesInRecycleBinCommand,
  LockSnapshotCommand,
  ModifyCapacityReservationCommand,
  ModifyClientVpnEndpointCommand,
  ModifyHostsCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("ListVolumesInRecycleBin returns empty when no volumes in bin", async () => {
  const res = await client.send(new ListVolumesInRecycleBinCommand({}));
  expect(res.Volumes ?? []).toHaveLength(0);
});

test("CreateCapacityReservation → ModifyCapacityReservation → DescribeCapacityReservations reflects update", async () => {
  const created = await client.send(
    new CreateCapacityReservationCommand({
      InstanceType: "t3.micro",
      InstancePlatform: "Linux/UNIX",
      AvailabilityZone: "us-east-1a",
      InstanceCount: 2,
    }),
  );
  const reservationId =
    created.CapacityReservation?.CapacityReservationId ?? "";
  expect(reservationId.startsWith("cr-")).toBe(true);

  const descBefore = await client.send(
    new DescribeCapacityReservationsCommand({
      CapacityReservationIds: [reservationId],
    }),
  );
  expect(descBefore.CapacityReservations?.[0]?.TotalInstanceCount).toBe(2);

  await client.send(
    new ModifyCapacityReservationCommand({
      CapacityReservationId: reservationId,
      InstanceCount: 5,
    }),
  );

  const descAfter = await client.send(
    new DescribeCapacityReservationsCommand({
      CapacityReservationIds: [reservationId],
    }),
  );
  expect(descAfter.CapacityReservations?.[0]?.TotalInstanceCount).toBe(5);
});

test("CreateSnapshot → LockSnapshot → DescribeLockedSnapshots includes it", async () => {
  const vol = await client.send(
    new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 1 }),
  );
  const volumeId = vol.VolumeId ?? "";

  const snap = await client.send(
    new CreateSnapshotCommand({
      VolumeId: volumeId,
      Description: "snap-for-lock-chunk48",
    }),
  );
  const snapshotId = snap.SnapshotId ?? "";
  expect(snapshotId.startsWith("snap-")).toBe(true);

  const lockRes = await client.send(
    new LockSnapshotCommand({
      SnapshotId: snapshotId,
      LockMode: "governance",
      LockDuration: 1,
    }),
  );
  expect(lockRes.SnapshotId).toBe(snapshotId);
  expect(lockRes.LockState).toBe("governance");

  const descLocked = await client.send(
    new DescribeLockedSnapshotsCommand({ SnapshotIds: [snapshotId] }),
  );
  const found = (descLocked.Snapshots ?? []).find(
    (s) => s.SnapshotId === snapshotId,
  );
  expect(found).toBeDefined();
  expect(found?.LockState).toBe("governance");
});

test("CreateClientVpnEndpoint → ModifyClientVpnEndpoint → DescribeClientVpnEndpoints reflects update", async () => {
  const created = await client.send(
    new CreateClientVpnEndpointCommand({
      ServerCertificateArn:
        "arn:aws:acm:us-east-1:123456789012:certificate/abc",
      ClientCidrBlock: "10.0.0.0/22",
      AuthenticationOptions: [{ Type: "certificate-authentication" }],
      ConnectionLogOptions: { Enabled: false },
    }),
  );
  const endpointId = created.ClientVpnEndpointId ?? "";
  expect(endpointId.startsWith("cvpn-")).toBe(true);

  await client.send(
    new ModifyClientVpnEndpointCommand({
      ClientVpnEndpointId: endpointId,
      Description: "modified-description-chunk48",
    }),
  );

  const described = await client.send(
    new DescribeClientVpnEndpointsCommand({
      ClientVpnEndpointIds: [endpointId],
    }),
  );
  expect(described.ClientVpnEndpoints?.[0]?.ClientVpnEndpointId).toBe(
    endpointId,
  );
});

test("AllocateHosts → ModifyHosts → DescribeHosts reflects auto-placement update", async () => {
  const allocated = await client.send(
    new AllocateHostsCommand({
      AvailabilityZone: "us-east-1a",
      InstanceType: "m5.large",
      Quantity: 1,
      AutoPlacement: "on",
    }),
  );
  const hostId = (allocated.HostIds ?? [])[0] ?? "";
  expect(hostId.startsWith("h-")).toBe(true);

  const descBefore = await client.send(
    new DescribeHostsCommand({ HostIds: [hostId] }),
  );
  expect(descBefore.Hosts?.[0]?.AutoPlacement).toBe("on");

  await client.send(
    new ModifyHostsCommand({
      HostIds: [hostId],
      AutoPlacement: "off",
    }),
  );

  const descAfter = await client.send(
    new DescribeHostsCommand({ HostIds: [hostId] }),
  );
  expect(descAfter.Hosts?.[0]?.AutoPlacement).toBe("off");
});
