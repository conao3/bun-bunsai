import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachInstancesCommand,
  AutoScalingClient,
  CreateAutoScalingGroupCommand,
  CreateLaunchConfigurationCommand,
  CreateOrUpdateTagsCommand,
  DeleteAutoScalingGroupCommand,
  DeleteLaunchConfigurationCommand,
  DeletePolicyCommand,
  DeleteTagsCommand,
  DescribeAutoScalingGroupsCommand,
  DescribeAutoScalingInstancesCommand,
  DescribeLaunchConfigurationsCommand,
  DescribePoliciesCommand,
  DescribeTagsCommand,
  DetachInstancesCommand,
  PutScalingPolicyCommand,
  SetDesiredCapacityCommand,
  TerminateInstanceInAutoScalingGroupCommand,
  UpdateAutoScalingGroupCommand,
} from "@aws-sdk/client-auto-scaling";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new AutoScalingClient({ endpoint, region, credentials, requestHandler });

test("Launch Configuration lifecycle", async () => {
  const asc = client();
  const lcName = "e2e-lc-basic";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-12345678",
      InstanceType: "t3.micro",
    }),
  );

  const described = await asc.send(
    new DescribeLaunchConfigurationsCommand({
      LaunchConfigurationNames: [lcName],
    }),
  );
  expect(described.LaunchConfigurations).toHaveLength(1);
  expect(described.LaunchConfigurations![0]!.LaunchConfigurationName).toBe(
    lcName,
  );
  expect(described.LaunchConfigurations![0]!.ImageId).toBe("ami-12345678");
  expect(described.LaunchConfigurations![0]!.InstanceType).toBe("t3.micro");

  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
  const afterDelete = await asc.send(
    new DescribeLaunchConfigurationsCommand({
      LaunchConfigurationNames: [lcName],
    }),
  );
  expect(afterDelete.LaunchConfigurations).toHaveLength(0);
});

test("Auto Scaling Group lifecycle with instance management", async () => {
  const asc = client();
  const lcName = "e2e-lc-asg";
  const asgName = "e2e-asg";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000001",
      InstanceType: "t3.small",
    }),
  );

  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 1,
      MaxSize: 5,
      DesiredCapacity: 2,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  const described = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(described.AutoScalingGroups).toHaveLength(1);
  const asg = described.AutoScalingGroups![0]!;
  expect(asg.AutoScalingGroupName).toBe(asgName);
  expect(asg.MinSize).toBe(1);
  expect(asg.MaxSize).toBe(5);
  expect(asg.DesiredCapacity).toBe(2);
  expect(asg.Instances).toHaveLength(2);

  const instIds = asg.Instances!.map((i) => i.InstanceId!);

  const instDesc = await asc.send(new DescribeAutoScalingInstancesCommand({}));
  const myInsts = instDesc.AutoScalingInstances!.filter(
    (i) => i.AutoScalingGroupName === asgName,
  );
  expect(myInsts).toHaveLength(2);

  await asc.send(
    new SetDesiredCapacityCommand({
      AutoScalingGroupName: asgName,
      DesiredCapacity: 4,
    }),
  );

  const afterScale = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterScale.AutoScalingGroups![0]!.DesiredCapacity).toBe(4);
  expect(afterScale.AutoScalingGroups![0]!.Instances).toHaveLength(4);

  await asc.send(
    new SetDesiredCapacityCommand({
      AutoScalingGroupName: asgName,
      DesiredCapacity: 2,
    }),
  );
  const afterShrink = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterShrink.AutoScalingGroups![0]!.Instances).toHaveLength(2);

  await asc.send(
    new UpdateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      MaxSize: 10,
    }),
  );
  const afterUpdate = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterUpdate.AutoScalingGroups![0]!.MaxSize).toBe(10);

  const firstId = instIds[0]!;
  await asc.send(
    new TerminateInstanceInAutoScalingGroupCommand({
      InstanceId: firstId,
      ShouldDecrementDesiredCapacity: true,
    }),
  );
  const afterTerminate = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterTerminate.AutoScalingGroups![0]!.DesiredCapacity).toBe(1);
  expect(afterTerminate.AutoScalingGroups![0]!.Instances).toHaveLength(1);

  await expect(
    asc.send(
      new DeleteAutoScalingGroupCommand({ AutoScalingGroupName: asgName }),
    ),
  ).rejects.toThrow();

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  const afterDeleteAsg = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterDeleteAsg.AutoScalingGroups).toHaveLength(0);

  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
});

test("Scaling policy CRUD", async () => {
  const asc = client();
  const lcName = "e2e-lc-policy";
  const asgName = "e2e-asg-policy";
  const policyName = "e2e-scale-out";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000002",
      InstanceType: "t3.micro",
    }),
  );
  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 1,
      MaxSize: 5,
      DesiredCapacity: 1,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  const putResult = await asc.send(
    new PutScalingPolicyCommand({
      AutoScalingGroupName: asgName,
      PolicyName: policyName,
      PolicyType: "SimpleScaling",
      AdjustmentType: "ChangeInCapacity",
      ScalingAdjustment: 1,
      Cooldown: 300,
    }),
  );
  expect(putResult.PolicyARN).toBeDefined();
  expect(putResult.PolicyARN).toContain(asgName);

  const described = await asc.send(
    new DescribePoliciesCommand({ AutoScalingGroupName: asgName }),
  );
  expect(described.ScalingPolicies).toHaveLength(1);
  expect(described.ScalingPolicies![0]!.PolicyName).toBe(policyName);
  expect(described.ScalingPolicies![0]!.AdjustmentType).toBe(
    "ChangeInCapacity",
  );

  await asc.send(
    new DeletePolicyCommand({
      AutoScalingGroupName: asgName,
      PolicyName: policyName,
    }),
  );
  const afterDelete = await asc.send(
    new DescribePoliciesCommand({ AutoScalingGroupName: asgName }),
  );
  expect(afterDelete.ScalingPolicies).toHaveLength(0);

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
});

test("Tags CRUD", async () => {
  const asc = client();
  const lcName = "e2e-lc-tags";
  const asgName = "e2e-asg-tags";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000003",
      InstanceType: "t3.micro",
    }),
  );
  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 0,
      MaxSize: 3,
      DesiredCapacity: 0,
      AvailabilityZones: ["us-east-1a"],
      Tags: [{ Key: "Env", Value: "test", PropagateAtLaunch: true }],
    }),
  );

  const described = await asc.send(
    new DescribeTagsCommand({
      Filters: [{ Name: "auto-scaling-group", Values: [asgName] }],
    }),
  );
  expect(described.Tags).toHaveLength(1);
  expect(described.Tags![0]!.Key).toBe("Env");
  expect(described.Tags![0]!.Value).toBe("test");

  await asc.send(
    new CreateOrUpdateTagsCommand({
      Tags: [
        {
          ResourceId: asgName,
          ResourceType: "auto-scaling-group",
          Key: "Team",
          Value: "platform",
          PropagateAtLaunch: false,
        },
      ],
    }),
  );
  const afterUpsert = await asc.send(
    new DescribeTagsCommand({
      Filters: [{ Name: "auto-scaling-group", Values: [asgName] }],
    }),
  );
  expect(afterUpsert.Tags).toHaveLength(2);

  await asc.send(
    new DeleteTagsCommand({
      Tags: [
        {
          ResourceId: asgName,
          ResourceType: "auto-scaling-group",
          Key: "Team",
          Value: "platform",
        },
      ],
    }),
  );
  const afterDeleteTag = await asc.send(
    new DescribeTagsCommand({
      Filters: [{ Name: "auto-scaling-group", Values: [asgName] }],
    }),
  );
  expect(afterDeleteTag.Tags).toHaveLength(1);

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
});

test("AttachInstances / DetachInstances", async () => {
  const asc = client();
  const lcName = "e2e-lc-attach";
  const asgName = "e2e-asg-attach";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000004",
      InstanceType: "t3.micro",
    }),
  );
  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 0,
      MaxSize: 5,
      DesiredCapacity: 0,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  await asc.send(
    new AttachInstancesCommand({
      AutoScalingGroupName: asgName,
      InstanceIds: ["i-attach001", "i-attach002"],
    }),
  );
  const afterAttach = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterAttach.AutoScalingGroups![0]!.Instances).toHaveLength(2);

  await asc.send(
    new DetachInstancesCommand({
      AutoScalingGroupName: asgName,
      InstanceIds: ["i-attach001"],
      ShouldDecrementDesiredCapacity: false,
    }),
  );
  const afterDetach = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(afterDetach.AutoScalingGroups![0]!.DesiredCapacity).toBe(2);
  expect(afterDetach.AutoScalingGroups![0]!.Instances).toHaveLength(2);

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
});

test("AlreadyExistsFault for duplicate names", async () => {
  const asc = client();
  const lcName = "e2e-lc-dup";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000005",
      InstanceType: "t3.micro",
    }),
  );
  await expect(
    asc.send(
      new CreateLaunchConfigurationCommand({
        LaunchConfigurationName: lcName,
        ImageId: "ami-99999999",
        InstanceType: "t3.micro",
      }),
    ),
  ).rejects.toThrow();

  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
});

test("DeleteLaunchConfiguration ResourceInUseFault", async () => {
  const asc = client();
  const lcName = "e2e-lc-inuse";
  const asgName = "e2e-asg-inuse";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000006",
      InstanceType: "t3.micro",
    }),
  );
  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 0,
      MaxSize: 1,
      DesiredCapacity: 0,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  await expect(
    asc.send(
      new DeleteLaunchConfigurationCommand({
        LaunchConfigurationName: lcName,
      }),
    ),
  ).rejects.toThrow();

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
});

test("AS-2: LaunchTemplate round-trip and no-launch-source ValidationError", async () => {
  const asc = client();
  const asgName = "e2e-asg-lt";

  await expect(
    asc.send(
      new CreateAutoScalingGroupCommand({
        AutoScalingGroupName: asgName,
        MinSize: 0,
        MaxSize: 2,
        DesiredCapacity: 0,
        AvailabilityZones: ["us-east-1a"],
      }),
    ),
  ).rejects.toThrow();

  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchTemplate: {
        LaunchTemplateId: "lt-0123456789abcdef0",
        Version: "$Latest",
      },
      MinSize: 0,
      MaxSize: 2,
      DesiredCapacity: 0,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  const described = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  expect(described.AutoScalingGroups).toHaveLength(1);
  expect(
    described.AutoScalingGroups![0]!.LaunchTemplate?.LaunchTemplateId,
  ).toBe("lt-0123456789abcdef0");
  expect(described.AutoScalingGroups![0]!.LaunchTemplate?.Version).toBe(
    "$Latest",
  );

  await asc.send(
    new UpdateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchTemplate: {
        LaunchTemplateId: "lt-0123456789abcdef0",
        Version: "2",
      },
    }),
  );
  const afterUpdate = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  expect(afterUpdate.AutoScalingGroups![0]!.LaunchTemplate?.Version).toBe("2");

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
});

test("AS-3: bounds validation and DesiredCapacity clamp", async () => {
  const asc = client();
  const lcName = "e2e-lc-bounds";
  const asgName = "e2e-asg-bounds";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000010",
      InstanceType: "t3.micro",
    }),
  );

  await expect(
    asc.send(
      new CreateAutoScalingGroupCommand({
        AutoScalingGroupName: asgName,
        LaunchConfigurationName: lcName,
        MinSize: 3,
        MaxSize: 1,
        AvailabilityZones: ["us-east-1a"],
      }),
    ),
  ).rejects.toThrow();

  await expect(
    asc.send(
      new CreateAutoScalingGroupCommand({
        AutoScalingGroupName: asgName,
        LaunchConfigurationName: lcName,
        MinSize: 0,
        MaxSize: 2,
        DesiredCapacity: 5,
        AvailabilityZones: ["us-east-1a"],
      }),
    ),
  ).rejects.toThrow();

  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 1,
      MaxSize: 3,
      DesiredCapacity: 2,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  await asc.send(
    new UpdateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      MaxSize: 1,
    }),
  );
  const afterShrink = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  expect(afterShrink.AutoScalingGroups![0]!.DesiredCapacity).toBe(1);

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({ LaunchConfigurationName: lcName }),
  );
});

test("AS-4: AttachInstances increments DesiredCapacity and enforces MaxSize", async () => {
  const asc = client();
  const lcName = "e2e-lc-attach2";
  const asgName = "e2e-asg-attach2";

  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-00000011",
      InstanceType: "t3.micro",
    }),
  );
  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 0,
      MaxSize: 2,
      DesiredCapacity: 0,
      AvailabilityZones: ["us-east-1a"],
    }),
  );

  await asc.send(
    new AttachInstancesCommand({
      AutoScalingGroupName: asgName,
      InstanceIds: ["i-as4001", "i-as4002"],
    }),
  );
  const afterAttach = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  expect(afterAttach.AutoScalingGroups![0]!.DesiredCapacity).toBe(2);
  expect(afterAttach.AutoScalingGroups![0]!.Instances).toHaveLength(2);

  await expect(
    asc.send(
      new AttachInstancesCommand({
        AutoScalingGroupName: asgName,
        InstanceIds: ["i-as4003"],
      }),
    ),
  ).rejects.toThrow();

  await asc.send(
    new DeleteAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      ForceDelete: true,
    }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({ LaunchConfigurationName: lcName }),
  );
});
