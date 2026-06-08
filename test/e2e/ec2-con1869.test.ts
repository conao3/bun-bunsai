import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachVolumeCommand,
  CreateTagsCommand,
  CreateVolumeCommand,
  DeleteTagsCommand,
  DeleteVolumeCommand,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
  DetachVolumeCommand,
  EC2Client,
  RunInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 CON-1869 fidelity gaps", () => {
  const ec2 = () =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("instance lifecycle: state transitions persist in DescribeInstances", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-con1869",
        InstanceType: "t2.micro",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const id = run.Instances?.[0]?.InstanceId ?? "";
    expect(id.startsWith("i-")).toBe(true);
    expect(run.Instances?.[0]?.State?.Name).toBe("running");

    const afterRun = await client.send(
      new DescribeInstancesCommand({ InstanceIds: [id] }),
    );
    const inst0 = afterRun.Reservations?.[0]?.Instances?.[0];
    expect(inst0?.State?.Name).toBe("running");

    await client.send(new StopInstancesCommand({ InstanceIds: [id] }));
    const afterStop = await client.send(
      new DescribeInstancesCommand({ InstanceIds: [id] }),
    );
    expect(afterStop.Reservations?.[0]?.Instances?.[0]?.State?.Name).toBe(
      "stopped",
    );

    await client.send(new StartInstancesCommand({ InstanceIds: [id] }));
    const afterStart = await client.send(
      new DescribeInstancesCommand({ InstanceIds: [id] }),
    );
    expect(afterStart.Reservations?.[0]?.Instances?.[0]?.State?.Name).toBe(
      "running",
    );

    const terminated = await client.send(
      new TerminateInstancesCommand({ InstanceIds: [id] }),
    );
    expect(terminated.TerminatingInstances?.[0]?.CurrentState?.Name).toBe(
      "terminated",
    );

    const defaultList = await client.send(new DescribeInstancesCommand({}));
    const defaultIds = (defaultList.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(defaultIds).not.toContain(id);

    const terminatedList = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "instance-state-name", Values: ["terminated"] }],
      }),
    );
    const terminatedIds = (terminatedList.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(terminatedIds).toContain(id);
  });

  test("DescribeInstances filter: instance-state-name", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-con1869b",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const id = run.Instances?.[0]?.InstanceId ?? "";
    await client.send(new StopInstancesCommand({ InstanceIds: [id] }));

    const stoppedList = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "instance-state-name", Values: ["stopped"] }],
      }),
    );
    const stoppedIds = (stoppedList.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(stoppedIds).toContain(id);

    const runningList = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "instance-state-name", Values: ["running"] }],
      }),
    );
    const runningIds = (runningList.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(runningIds).not.toContain(id);

    await client.send(new TerminateInstancesCommand({ InstanceIds: [id] }));
  });

  test("DescribeInstances filter: instance-id", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-con1869c",
        MinCount: 2,
        MaxCount: 2,
      }),
    );
    const ids = (run.Instances ?? []).map((i) => i.InstanceId ?? "");
    expect(ids.length).toBe(2);

    const filtered = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "instance-id", Values: [ids[0] ?? ""] }],
      }),
    );
    const filteredIds = (filtered.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(filteredIds).toContain(ids[0]);
    expect(filteredIds).not.toContain(ids[1]);

    await client.send(new TerminateInstancesCommand({ InstanceIds: ids }));
  });

  test("CreateTags/DeleteTags: round-trip + tag filter in DescribeInstances", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-con1869d",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const id = run.Instances?.[0]?.InstanceId ?? "";

    await client.send(
      new CreateTagsCommand({
        Resources: [id],
        Tags: [{ Key: "Env", Value: "test-con1869" }],
      }),
    );

    const tagFiltered = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "tag:Env", Values: ["test-con1869"] }],
      }),
    );
    const tagFilteredIds = (tagFiltered.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(tagFilteredIds).toContain(id);

    const tagMismatch = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "tag:Env", Values: ["other-value"] }],
      }),
    );
    const mismatchIds = (tagMismatch.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(mismatchIds).not.toContain(id);

    await client.send(
      new DeleteTagsCommand({
        Resources: [id],
        Tags: [{ Key: "Env", Value: "test-con1869" }],
      }),
    );

    const afterDelete = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "tag:Env", Values: ["test-con1869"] }],
      }),
    );
    const afterDeleteIds = (afterDelete.Reservations ?? []).flatMap((r) =>
      (r.Instances ?? []).map((i) => i.InstanceId),
    );
    expect(afterDeleteIds).not.toContain(id);

    const describeInst = await client.send(
      new DescribeInstancesCommand({ InstanceIds: [id] }),
    );
    const tags = describeInst.Reservations?.[0]?.Instances?.[0]?.Tags ?? [];
    expect(tags.find((t) => t.Key === "Env")).toBeUndefined();

    await client.send(new TerminateInstancesCommand({ InstanceIds: [id] }));
  });

  test("EBS attach/detach: volume state transitions", async () => {
    const client = ec2();
    const volRes = await client.send(
      new CreateVolumeCommand({
        AvailabilityZone: "us-east-1a",
        Size: 8,
        VolumeType: "gp3",
      }),
    );
    const volumeId = volRes.VolumeId ?? "";
    expect(volRes.State).toBe("available");

    const instRes = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-con1869e",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = instRes.Instances?.[0]?.InstanceId ?? "";

    const attached = await client.send(
      new AttachVolumeCommand({
        VolumeId: volumeId,
        InstanceId: instanceId,
        Device: "/dev/xvdf",
      }),
    );
    expect(attached.State).toBe("attached");

    const inUse = await client.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] }),
    );
    expect(inUse.Volumes?.[0]?.State).toBe("in-use");
    expect(inUse.Volumes?.[0]?.Attachments?.[0]?.InstanceId).toBe(instanceId);

    const detached = await client.send(
      new DetachVolumeCommand({ VolumeId: volumeId }),
    );
    expect(detached.State).toBe("detached");

    const available = await client.send(
      new DescribeVolumesCommand({ VolumeIds: [volumeId] }),
    );
    expect(available.Volumes?.[0]?.State).toBe("available");
    expect(available.Volumes?.[0]?.Attachments?.length).toBe(0);

    await client.send(new DeleteVolumeCommand({ VolumeId: volumeId }));
    await client.send(
      new TerminateInstancesCommand({ InstanceIds: [instanceId] }),
    );
  });
});
