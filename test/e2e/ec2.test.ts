import { describe, expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateSecurityGroupCommand,
  CreateTagsCommand,
  CreateVpcCommand,
  DeleteVpcCommand,
  DescribeInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeTagsCommand,
  DescribeVpcsCommand,
  EC2Client,
  RunInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 e2e", () => {
  const ec2 = () => new EC2Client({ endpoint, region, credentials });

  test("run, describe, stop, start and terminate instances", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-12345678",
        InstanceType: "t2.micro",
        MinCount: 2,
        MaxCount: 2,
      }),
    );
    const instances = run.Instances ?? [];
    expect(instances.length).toBe(2);
    const ids = instances.map((instance) => instance.InstanceId ?? "");
    for (const id of ids) expect(id.startsWith("i-")).toBe(true);
    expect(instances[0]?.State?.Name).toBe("running");
    expect(instances[0]?.ImageId).toBe("ami-12345678");

    const described = await client.send(
      new DescribeInstancesCommand({ InstanceIds: ids }),
    );
    const reservations = described.Reservations ?? [];
    const seen = reservations.flatMap((reservation) =>
      (reservation.Instances ?? []).map((instance) => instance.InstanceId),
    );
    for (const id of ids) expect(seen).toContain(id);

    const stopped = await client.send(
      new StopInstancesCommand({ InstanceIds: ids }),
    );
    expect(stopped.StoppingInstances?.[0]?.CurrentState?.Name).toBe("stopped");

    const started = await client.send(
      new StartInstancesCommand({ InstanceIds: ids }),
    );
    expect(started.StartingInstances?.[0]?.CurrentState?.Name).toBe("running");

    const terminated = await client.send(
      new TerminateInstancesCommand({ InstanceIds: ids }),
    );
    expect(terminated.TerminatingInstances?.[0]?.CurrentState?.Name).toBe(
      "terminated",
    );

    const afterTerminate = await client.send(new DescribeInstancesCommand({}));
    const remaining = (afterTerminate.Reservations ?? []).flatMap(
      (reservation) =>
        (reservation.Instances ?? []).map((instance) => instance.InstanceId),
    );
    for (const id of ids) expect(remaining).not.toContain(id);
  });

  test("create, describe and delete vpc", async () => {
    const client = ec2();
    const created = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
    );
    const vpcId = created.Vpc?.VpcId ?? "";
    expect(vpcId.startsWith("vpc-")).toBe(true);
    expect(created.Vpc?.CidrBlock).toBe("10.1.0.0/16");
    expect(created.Vpc?.State).toBe("available");

    const described = await client.send(
      new DescribeVpcsCommand({ VpcIds: [vpcId] }),
    );
    const found = (described.Vpcs ?? []).map((vpc) => vpc.VpcId);
    expect(found).toContain(vpcId);

    await client.send(new DeleteVpcCommand({ VpcId: vpcId }));

    const afterDelete = await client.send(new DescribeVpcsCommand({}));
    const remaining = (afterDelete.Vpcs ?? []).map((vpc) => vpc.VpcId);
    expect(remaining).not.toContain(vpcId);
  });

  test("create and describe security group", async () => {
    const client = ec2();
    const vpc = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.2.0.0/16" }),
    );
    const vpcId = vpc.Vpc?.VpcId;
    const created = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: "bunsai-e2e-sg",
        Description: "bunsai e2e security group",
        VpcId: vpcId,
      }),
    );
    const groupId = created.GroupId ?? "";
    expect(groupId.startsWith("sg-")).toBe(true);

    const described = await client.send(
      new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
    );
    const group = (described.SecurityGroups ?? []).find(
      (item) => item.GroupId === groupId,
    );
    expect(group?.GroupName).toBe("bunsai-e2e-sg");
    expect(group?.Description).toBe("bunsai e2e security group");
    expect(group?.VpcId).toBe(vpcId);
  });

  test("create and describe tags", async () => {
    const client = ec2();
    const run = await client.send(
      new RunInstancesCommand({
        ImageId: "ami-tagtest",
        MinCount: 1,
        MaxCount: 1,
      }),
    );
    const instanceId = run.Instances?.[0]?.InstanceId ?? "";
    expect(instanceId.startsWith("i-")).toBe(true);

    await client.send(
      new CreateTagsCommand({
        Resources: [instanceId],
        Tags: [{ Key: "Name", Value: "bunsai-e2e" }],
      }),
    );

    const described = await client.send(new DescribeInstancesCommand({}));
    const tagged = (described.Reservations ?? [])
      .flatMap((reservation) => reservation.Instances ?? [])
      .find((instance) => instance.InstanceId === instanceId);
    const nameTag = (tagged?.Tags ?? []).find((tag) => tag.Key === "Name");
    expect(nameTag?.Value).toBe("bunsai-e2e");

    const tags = await client.send(new DescribeTagsCommand({}));
    const found = (tags.Tags ?? []).find(
      (tag) => tag.ResourceId === instanceId && tag.Key === "Name",
    );
    expect(found?.Value).toBe("bunsai-e2e");
    expect(found?.ResourceType).toBe("instance");

    await client.send(
      new TerminateInstancesCommand({ InstanceIds: [instanceId] }),
    );
  });
});
