import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AutoScalingClient,
  BatchDeleteScheduledActionCommand,
  BatchPutScheduledUpdateGroupActionCommand,
  CancelInstanceRefreshCommand,
  CompleteLifecycleActionCommand,
  CreateAutoScalingGroupCommand,
  CreateLaunchConfigurationCommand,
  DeleteAutoScalingGroupCommand,
  DeleteLaunchConfigurationCommand,
  DeleteLifecycleHookCommand,
  DeleteScheduledActionCommand,
  DeleteWarmPoolCommand,
  DescribeAccountLimitsCommand,
  DescribeAdjustmentTypesCommand,
  DescribeAutoScalingGroupsCommand,
  DescribeAutoScalingNotificationTypesCommand,
  DescribeInstanceRefreshesCommand,
  DescribeLifecycleHookTypesCommand,
  DescribeLifecycleHooksCommand,
  DescribeMetricCollectionTypesCommand,
  DescribeNotificationConfigurationsCommand,
  DescribeScalingActivitiesCommand,
  DescribeScalingProcessTypesCommand,
  DescribeScheduledActionsCommand,
  DescribeTerminationPolicyTypesCommand,
  DescribeWarmPoolCommand,
  DisableMetricsCollectionCommand,
  EnableMetricsCollectionCommand,
  EnterStandbyCommand,
  ExecutePolicyCommand,
  ExitStandbyCommand,
  PutLifecycleHookCommand,
  PutNotificationConfigurationCommand,
  PutScalingPolicyCommand,
  PutScheduledUpdateGroupActionCommand,
  PutWarmPoolCommand,
  RecordLifecycleActionHeartbeatCommand,
  ResumeProcessesCommand,
  RollbackInstanceRefreshCommand,
  SetDesiredCapacityCommand,
  SetInstanceHealthCommand,
  SetInstanceProtectionCommand,
  StartInstanceRefreshCommand,
  SuspendProcessesCommand,
} from "@aws-sdk/client-auto-scaling";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new AutoScalingClient({ endpoint, region, credentials, requestHandler });

const setupAsg = async (
  asc: AutoScalingClient,
  lcName: string,
  asgName: string,
  desiredCapacity = 2,
) => {
  await asc.send(
    new CreateLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
      ImageId: "ami-11111111",
      InstanceType: "t3.micro",
    }),
  );
  await asc.send(
    new CreateAutoScalingGroupCommand({
      AutoScalingGroupName: asgName,
      LaunchConfigurationName: lcName,
      MinSize: 0,
      MaxSize: 10,
      DesiredCapacity: desiredCapacity,
      AvailabilityZones: ["us-east-1a"],
    }),
  );
};

const teardownAsg = async (
  asc: AutoScalingClient,
  lcName: string,
  asgName: string,
) => {
  await asc.send(
    new SetDesiredCapacityCommand({
      AutoScalingGroupName: asgName,
      DesiredCapacity: 0,
    }),
  );
  await asc.send(
    new DeleteAutoScalingGroupCommand({ AutoScalingGroupName: asgName }),
  );
  await asc.send(
    new DeleteLaunchConfigurationCommand({
      LaunchConfigurationName: lcName,
    }),
  );
};

test("static describe operations return expected shapes", async () => {
  const asc = client();

  const limits = await asc.send(new DescribeAccountLimitsCommand({}));
  expect(limits.MaxNumberOfAutoScalingGroups).toBeGreaterThan(0);

  const adjTypes = await asc.send(new DescribeAdjustmentTypesCommand({}));
  expect(adjTypes.AdjustmentTypes).toContainEqual(
    expect.objectContaining({ AdjustmentType: "ChangeInCapacity" }),
  );

  const notifTypes = await asc.send(
    new DescribeAutoScalingNotificationTypesCommand({}),
  );
  expect(notifTypes.AutoScalingNotificationTypes).toContain(
    "autoscaling:EC2_INSTANCE_LAUNCH",
  );

  const lcHookTypes = await asc.send(new DescribeLifecycleHookTypesCommand({}));
  expect(lcHookTypes.LifecycleHookTypes).toContain(
    "autoscaling:EC2_INSTANCE_LAUNCHING",
  );

  const metrics = await asc.send(new DescribeMetricCollectionTypesCommand({}));
  expect(metrics.Metrics?.length).toBeGreaterThan(0);
  expect(metrics.Granularities).toHaveLength(1);

  const processTypes = await asc.send(
    new DescribeScalingProcessTypesCommand({}),
  );
  expect(processTypes.Processes).toContainEqual(
    expect.objectContaining({ ProcessName: "Launch" }),
  );

  const termPolicies = await asc.send(
    new DescribeTerminationPolicyTypesCommand({}),
  );
  expect(termPolicies.TerminationPolicyTypes).toContain("Default");
});

test("scheduled action lifecycle", async () => {
  const asc = client();
  const lcName = "e2e2-lc-sched";
  const asgName = "e2e2-asg-sched";
  await setupAsg(asc, lcName, asgName, 0);

  await asc.send(
    new PutScheduledUpdateGroupActionCommand({
      AutoScalingGroupName: asgName,
      ScheduledActionName: "scale-up",
      Recurrence: "0 9 * * 1-5",
      DesiredCapacity: 3,
    }),
  );

  const described = await asc.send(
    new DescribeScheduledActionsCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(described.ScheduledUpdateGroupActions).toHaveLength(1);
  expect(described.ScheduledUpdateGroupActions![0]!.ScheduledActionName).toBe(
    "scale-up",
  );
  expect(described.ScheduledUpdateGroupActions![0]!.DesiredCapacity).toBe(3);

  await asc.send(
    new BatchPutScheduledUpdateGroupActionCommand({
      AutoScalingGroupName: asgName,
      ScheduledUpdateGroupActions: [
        {
          ScheduledActionName: "scale-down",
          Recurrence: "0 18 * * 1-5",
          DesiredCapacity: 1,
        },
        {
          ScheduledActionName: "weekend",
          Recurrence: "0 0 * * 6",
          DesiredCapacity: 0,
        },
      ],
    }),
  );

  const after = await asc.send(
    new DescribeScheduledActionsCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(after.ScheduledUpdateGroupActions).toHaveLength(3);

  await asc.send(
    new DeleteScheduledActionCommand({
      AutoScalingGroupName: asgName,
      ScheduledActionName: "weekend",
    }),
  );

  await asc.send(
    new BatchDeleteScheduledActionCommand({
      AutoScalingGroupName: asgName,
      ScheduledActionNames: ["scale-up", "scale-down"],
    }),
  );

  const empty = await asc.send(
    new DescribeScheduledActionsCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(empty.ScheduledUpdateGroupActions).toHaveLength(0);

  await teardownAsg(asc, lcName, asgName);
});

test("lifecycle hook lifecycle", async () => {
  const asc = client();
  const lcName = "e2e2-lc-hook";
  const asgName = "e2e2-asg-hook";
  await setupAsg(asc, lcName, asgName, 0);

  await asc.send(
    new PutLifecycleHookCommand({
      LifecycleHookName: "launch-hook",
      AutoScalingGroupName: asgName,
      LifecycleTransition: "autoscaling:EC2_INSTANCE_LAUNCHING",
      HeartbeatTimeout: 300,
      DefaultResult: "CONTINUE",
    }),
  );

  const described = await asc.send(
    new DescribeLifecycleHooksCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(described.LifecycleHooks).toHaveLength(1);
  expect(described.LifecycleHooks![0]!.LifecycleHookName).toBe("launch-hook");
  expect(described.LifecycleHooks![0]!.DefaultResult).toBe("CONTINUE");
  expect(described.LifecycleHooks![0]!.HeartbeatTimeout).toBe(300);

  await asc.send(
    new RecordLifecycleActionHeartbeatCommand({
      LifecycleHookName: "launch-hook",
      AutoScalingGroupName: asgName,
      InstanceId: "i-12345678",
    }),
  );

  await asc.send(
    new CompleteLifecycleActionCommand({
      LifecycleHookName: "launch-hook",
      AutoScalingGroupName: asgName,
      LifecycleActionResult: "CONTINUE",
      InstanceId: "i-12345678",
    }),
  );

  await asc.send(
    new DeleteLifecycleHookCommand({
      LifecycleHookName: "launch-hook",
      AutoScalingGroupName: asgName,
    }),
  );

  const empty = await asc.send(
    new DescribeLifecycleHooksCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(empty.LifecycleHooks).toHaveLength(0);

  await teardownAsg(asc, lcName, asgName);
});

test("suspend and resume processes", async () => {
  const asc = client();
  const lcName = "e2e2-lc-suspend";
  const asgName = "e2e2-asg-suspend";
  await setupAsg(asc, lcName, asgName, 0);

  await asc.send(
    new SuspendProcessesCommand({
      AutoScalingGroupName: asgName,
      ScalingProcesses: ["Launch", "Terminate"],
    }),
  );

  const { AutoScalingGroups: asgsSuspended } = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  const suspendedNames = (asgsSuspended![0]!.SuspendedProcesses ?? []).map(
    (p) => p.ProcessName,
  );
  expect(suspendedNames).toContain("Launch");
  expect(suspendedNames).toContain("Terminate");

  await asc.send(
    new ResumeProcessesCommand({
      AutoScalingGroupName: asgName,
      ScalingProcesses: ["Launch"],
    }),
  );

  const { AutoScalingGroups: asgsAfter } = await asc.send(
    new DescribeAutoScalingGroupsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  const resumedNames = (asgsAfter![0]!.SuspendedProcesses ?? []).map(
    (p) => p.ProcessName,
  );
  expect(resumedNames).not.toContain("Launch");
  expect(resumedNames).toContain("Terminate");

  await teardownAsg(asc, lcName, asgName);
});

test("instance refresh lifecycle", async () => {
  const asc = client();
  const lcName = "e2e2-lc-refresh";
  const asgName = "e2e2-asg-refresh";
  await setupAsg(asc, lcName, asgName, 1);

  const startResult = await asc.send(
    new StartInstanceRefreshCommand({
      AutoScalingGroupName: asgName,
      Strategy: "Rolling",
    }),
  );
  expect(startResult.InstanceRefreshId).toBeDefined();
  const refreshId = startResult.InstanceRefreshId!;

  const described = await asc.send(
    new DescribeInstanceRefreshesCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(described.InstanceRefreshes).toHaveLength(1);
  expect(described.InstanceRefreshes![0]!.InstanceRefreshId).toBe(refreshId);
  expect(described.InstanceRefreshes![0]!.Status).toBe("Successful");

  const rollback = await asc.send(
    new RollbackInstanceRefreshCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(rollback.InstanceRefreshId).toBe(refreshId);

  const startResult2 = await asc.send(
    new StartInstanceRefreshCommand({ AutoScalingGroupName: asgName }),
  );
  const cancel = await asc.send(
    new CancelInstanceRefreshCommand({ AutoScalingGroupName: asgName }),
  );
  expect(cancel.InstanceRefreshId).toBe(startResult2.InstanceRefreshId);

  await teardownAsg(asc, lcName, asgName);
});

test("standby enter and exit", async () => {
  const asc = client();
  const lcName = "e2e2-lc-standby";
  const asgName = "e2e2-asg-standby";
  await setupAsg(asc, lcName, asgName, 2);

  const dagResult = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  const asgBefore = dagResult.AutoScalingGroups![0]!;
  const instanceIds = asgBefore.Instances!.map((i) => i.InstanceId!);
  expect(instanceIds).toHaveLength(2);

  const enterResult = await asc.send(
    new EnterStandbyCommand({
      AutoScalingGroupName: asgName,
      InstanceIds: [instanceIds[0]!],
      ShouldDecrementDesiredCapacity: false,
    }),
  );
  expect(enterResult.Activities).toHaveLength(1);

  const exitResult = await asc.send(
    new ExitStandbyCommand({
      AutoScalingGroupName: asgName,
      InstanceIds: [instanceIds[0]!],
    }),
  );
  expect(exitResult.Activities).toHaveLength(1);

  await teardownAsg(asc, lcName, asgName);
});

test("set instance health and protection", async () => {
  const asc = client();
  const lcName = "e2e2-lc-health";
  const asgName = "e2e2-asg-health";
  await setupAsg(asc, lcName, asgName, 1);

  const { AutoScalingGroups: asgsHealth } = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  const instanceId = asgsHealth![0]!.Instances![0]!.InstanceId!;

  await asc.send(
    new SetInstanceHealthCommand({
      InstanceId: instanceId,
      HealthStatus: "Unhealthy",
    }),
  );

  await asc.send(
    new SetInstanceProtectionCommand({
      AutoScalingGroupName: asgName,
      InstanceIds: [instanceId],
      ProtectedFromScaleIn: true,
    }),
  );

  await teardownAsg(asc, lcName, asgName);
});

test("warm pool lifecycle", async () => {
  const asc = client();
  const lcName = "e2e2-lc-warm";
  const asgName = "e2e2-asg-warm";
  await setupAsg(asc, lcName, asgName, 0);

  await asc.send(
    new PutWarmPoolCommand({
      AutoScalingGroupName: asgName,
      MinSize: 2,
      MaxGroupPreparedCapacity: 5,
      PoolState: "Stopped",
    }),
  );

  const described = await asc.send(
    new DescribeWarmPoolCommand({ AutoScalingGroupName: asgName }),
  );
  expect(described.WarmPoolConfiguration?.MinSize).toBe(2);
  expect(described.WarmPoolConfiguration?.MaxGroupPreparedCapacity).toBe(5);
  expect(described.WarmPoolConfiguration?.PoolState).toBe("Stopped");

  await asc.send(new DeleteWarmPoolCommand({ AutoScalingGroupName: asgName }));

  const empty = await asc.send(
    new DescribeWarmPoolCommand({ AutoScalingGroupName: asgName }),
  );
  expect(empty.WarmPoolConfiguration?.MinSize).toBeUndefined();

  await teardownAsg(asc, lcName, asgName);
});

test("notification configuration lifecycle", async () => {
  const asc = client();
  const lcName = "e2e2-lc-notif";
  const asgName = "e2e2-asg-notif";
  await setupAsg(asc, lcName, asgName, 0);

  const topicArn = "arn:aws:sns:us-east-1:123456789012:my-topic";
  await asc.send(
    new PutNotificationConfigurationCommand({
      AutoScalingGroupName: asgName,
      TopicARN: topicArn,
      NotificationTypes: [
        "autoscaling:EC2_INSTANCE_LAUNCH",
        "autoscaling:EC2_INSTANCE_TERMINATE",
      ],
    }),
  );

  const described = await asc.send(
    new DescribeNotificationConfigurationsCommand({
      AutoScalingGroupNames: [asgName],
    }),
  );
  expect(described.NotificationConfigurations).toHaveLength(2);

  await teardownAsg(asc, lcName, asgName);
});

test("metrics collection enable and disable", async () => {
  const asc = client();
  const lcName = "e2e2-lc-metrics";
  const asgName = "e2e2-asg-metrics";
  await setupAsg(asc, lcName, asgName, 0);

  await asc.send(
    new EnableMetricsCollectionCommand({
      AutoScalingGroupName: asgName,
      Metrics: ["GroupMinSize", "GroupMaxSize"],
      Granularity: "1Minute",
    }),
  );

  const { AutoScalingGroups: asgsEnabled } = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  const asgEnabled = asgsEnabled![0]!;
  const metrics = (asgEnabled.EnabledMetrics ?? []).map(
    (m: { Metric?: string }) => m.Metric,
  );
  expect(metrics).toContain("GroupMinSize");
  expect(metrics).toContain("GroupMaxSize");

  await asc.send(
    new DisableMetricsCollectionCommand({
      AutoScalingGroupName: asgName,
      Metrics: ["GroupMinSize"],
    }),
  );

  const { AutoScalingGroups: asgsDisabled } = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  const asgDisabled = asgsDisabled![0]!;
  const metricsAfter = (asgDisabled.EnabledMetrics ?? []).map(
    (m: { Metric?: string }) => m.Metric,
  );
  expect(metricsAfter).not.toContain("GroupMinSize");
  expect(metricsAfter).toContain("GroupMaxSize");

  await teardownAsg(asc, lcName, asgName);
});

test("execute policy applies capacity change", async () => {
  const asc = client();
  const lcName = "e2e2-lc-policy";
  const asgName = "e2e2-asg-policy";
  await setupAsg(asc, lcName, asgName, 2);

  await asc.send(
    new PutScalingPolicyCommand({
      AutoScalingGroupName: asgName,
      PolicyName: "scale-out",
      PolicyType: "SimpleScaling",
      AdjustmentType: "ChangeInCapacity",
      ScalingAdjustment: 2,
    }),
  );

  await asc.send(
    new ExecutePolicyCommand({
      AutoScalingGroupName: asgName,
      PolicyName: "scale-out",
    }),
  );

  const descResult = await asc.send(
    new DescribeAutoScalingGroupsCommand({ AutoScalingGroupNames: [asgName] }),
  );
  const asg = descResult.AutoScalingGroups?.[0];
  expect(asg!.DesiredCapacity).toBe(4);

  const activities = await asc.send(
    new DescribeScalingActivitiesCommand({
      AutoScalingGroupName: asgName,
    }),
  );
  expect(activities.Activities!.length).toBeGreaterThan(0);

  await teardownAsg(asc, lcName, asgName);
});
