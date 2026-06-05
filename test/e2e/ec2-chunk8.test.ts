import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelSpotInstanceRequestsCommand,
  CopySnapshotCommand,
  CreateSnapshotCommand,
  CreateVolumeCommand,
  DescribeSnapshotsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk8 copy-snapshot and cancel-spot-instance-requests e2e", () => {
  const ec2 = () =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("copy-snapshot: copies a snapshot and returns a new SnapshotId", async () => {
    const client = ec2();

    const volRes = await client.send(
      new CreateVolumeCommand({ AvailabilityZone: "us-east-1a", Size: 10 }),
    );
    const volumeId = volRes.VolumeId ?? "";
    expect(volumeId.startsWith("vol-")).toBe(true);

    const snapRes = await client.send(
      new CreateSnapshotCommand({
        VolumeId: volumeId,
        Description: "original-snapshot",
      }),
    );
    const sourceSnapshotId = snapRes.SnapshotId ?? "";
    expect(sourceSnapshotId.startsWith("snap-")).toBe(true);
    expect(snapRes.State).toBe("completed");

    const copyRes = await client.send(
      new CopySnapshotCommand({
        SourceSnapshotId: sourceSnapshotId,
        SourceRegion: "us-east-1",
        Description: "copied-snapshot",
      }),
    );
    const copiedSnapshotId = copyRes.SnapshotId ?? "";
    expect(copiedSnapshotId.startsWith("snap-")).toBe(true);
    expect(copiedSnapshotId).not.toBe(sourceSnapshotId);

    const descRes = await client.send(
      new DescribeSnapshotsCommand({
        SnapshotIds: [copiedSnapshotId],
      }),
    );
    const snapshot = descRes.Snapshots?.[0];
    expect(snapshot).toBeDefined();
    expect(snapshot?.SnapshotId).toBe(copiedSnapshotId);
    expect(snapshot?.VolumeId).toBe(volumeId);
    expect(snapshot?.State).toBe("completed");
    expect(snapshot?.Description).toBe("copied-snapshot");
  });

  test("cancel-spot-instance-requests: returns cancelled state for each id", async () => {
    const client = ec2();

    const id1 = "sir-12345678";
    const id2 = "sir-87654321";
    const result = await client.send(
      new CancelSpotInstanceRequestsCommand({
        SpotInstanceRequestIds: [id1, id2],
      }),
    );
    const cancelled = result.CancelledSpotInstanceRequests ?? [];
    expect(cancelled).toHaveLength(2);

    const r1 = cancelled.find((r) => r.SpotInstanceRequestId === id1);
    expect(r1).toBeDefined();
    expect(r1?.State).toBe("cancelled");

    const r2 = cancelled.find((r) => r.SpotInstanceRequestId === id2);
    expect(r2).toBeDefined();
    expect(r2?.State).toBe("cancelled");
  });
});
