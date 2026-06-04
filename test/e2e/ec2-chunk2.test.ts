import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AttachVolumeCommand,
  CreateVolumeCommand,
  DetachVolumeCommand,
  DescribeVolumesCommand,
  EC2Client,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";

const awsPort = 4579;
const uiPort = 5679;
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

describe("ec2 chunk2 attach/detach e2e", () => {
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

  test("attach and detach volume lifecycle", async () => {
    const client = ec2();

    const volumeRes = await client.send(
      new CreateVolumeCommand({
        AvailabilityZone: "us-east-1a",
        Size: 20,
        VolumeType: "gp3",
      }),
    );
    const volumeId = volumeRes.VolumeId ?? "";
    expect(volumeId.startsWith("vol-")).toBe(true);
    expect(volumeRes.State).toBe("available");

    const instanceRes = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-12345678",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = instanceRes.Instances?.[0]?.InstanceId ?? "";
    expect(instanceId.startsWith("i-")).toBe(true);

    const attached = await client.send(
      new AttachVolumeCommand({
        VolumeId: volumeId,
        InstanceId: instanceId,
        Device: "/dev/sdf",
      }),
    );
    expect(attached.VolumeId).toBe(volumeId);
    expect(attached.InstanceId).toBe(instanceId);
    expect(attached.Device).toBe("/dev/sdf");
    expect(attached.State).toBe("attached");

    const describedAfterAttach = await client.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] }),
    );
    const vol = describedAfterAttach.Volumes?.[0];
    expect(vol?.State).toBe("in-use");
    expect(vol?.Attachments?.length).toBe(1);
    expect(vol?.Attachments?.[0]?.InstanceId).toBe(instanceId);

    const detached = await client.send(
      new DetachVolumeCommand({ VolumeId: volumeId }),
    );
    expect(detached.VolumeId).toBe(volumeId);
    expect(detached.State).toBe("detached");

    const describedAfterDetach = await client.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] }),
    );
    const volAfter = describedAfterDetach.Volumes?.[0];
    expect(volAfter?.State).toBe("available");
    expect(volAfter?.Attachments?.length).toBe(0);
  });
});
