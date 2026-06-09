import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddInstanceFleetCommand,
  AddInstanceGroupsCommand,
  AddJobFlowStepsCommand,
  AddTagsCommand,
  CancelStepsCommand,
  CreatePersistentAppUICommand,
  CreateSecurityConfigurationCommand,
  CreateStudioCommand,
  CreateStudioSessionMappingCommand,
  DeleteSecurityConfigurationCommand,
  DeleteStudioCommand,
  DeleteStudioSessionMappingCommand,
  DescribeClusterCommand,
  DescribeJobFlowsCommand,
  DescribeNotebookExecutionCommand,
  DescribePersistentAppUICommand,
  DescribeReleaseLabelCommand,
  DescribeSecurityConfigurationCommand,
  DescribeStepCommand,
  DescribeStudioCommand,
  EMRClient,
  GetAutoTerminationPolicyCommand,
  GetBlockPublicAccessConfigurationCommand,
  GetClusterSessionCredentialsCommand,
  GetManagedScalingPolicyCommand,
  GetOnClusterAppUIPresignedURLCommand,
  GetPersistentAppUIPresignedURLCommand,
  GetStudioSessionMappingCommand,
  ListBootstrapActionsCommand,
  ListClustersCommand,
  ListInstanceFleetsCommand,
  ListInstanceGroupsCommand,
  ListInstancesCommand,
  ListNotebookExecutionsCommand,
  ListReleaseLabelsCommand,
  ListSecurityConfigurationsCommand,
  ListStepsCommand,
  ListStudioSessionMappingsCommand,
  ListStudiosCommand,
  ListSupportedInstanceTypesCommand,
  ModifyClusterCommand,
  ModifyInstanceFleetCommand,
  ModifyInstanceGroupsCommand,
  PutAutoScalingPolicyCommand,
  PutAutoTerminationPolicyCommand,
  PutBlockPublicAccessConfigurationCommand,
  PutManagedScalingPolicyCommand,
  RemoveAutoScalingPolicyCommand,
  RemoveAutoTerminationPolicyCommand,
  RemoveManagedScalingPolicyCommand,
  RemoveTagsCommand,
  RunJobFlowCommand,
  SetKeepJobFlowAliveWhenNoStepsCommand,
  SetTerminationProtectionCommand,
  SetUnhealthyNodeReplacementCommand,
  SetVisibleToAllUsersCommand,
  StartNotebookExecutionCommand,
  StopNotebookExecutionCommand,
  TerminateJobFlowsCommand,
  UpdateStudioCommand,
  UpdateStudioSessionMappingCommand,
} from "@aws-sdk/client-emr";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const emr = () =>
  new EMRClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("EMR job flow lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "bunsai-e2e-emr",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const id = run.JobFlowId;
  expect(id).toBeTruthy();
  expect(run.ClusterArn).toContain(id ?? "");

  const described = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  expect(described.Cluster?.Name).toBe("bunsai-e2e-emr");
  expect(described.Cluster?.Status?.State).toBe("WAITING");

  const steps = await client.send(
    new AddJobFlowStepsCommand({
      JobFlowId: id,
      Steps: [{ Name: "step1", HadoopJarStep: { Jar: "command-runner.jar" } }],
    }),
  );
  expect((steps.StepIds ?? []).length).toBe(1);

  const listed = await client.send(new ListClustersCommand({}));
  expect((listed.Clusters ?? []).some((c) => c.Id === id)).toBe(true);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id ?? ""] }));
});

test("EMR tags lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-tags-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const id = run.JobFlowId ?? "";

  await client.send(
    new AddTagsCommand({
      ResourceId: id,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "e2e" },
      ],
    }),
  );

  const described = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  const tags = described.Cluster?.Tags ?? [];
  expect(tags.some((t) => t.Key === "env" && t.Value === "test")).toBe(true);
  expect(tags.some((t) => t.Key === "owner" && t.Value === "e2e")).toBe(true);

  await client.send(
    new RemoveTagsCommand({ ResourceId: id, TagKeys: ["owner"] }),
  );

  const described2 = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  const tags2 = described2.Cluster?.Tags ?? [];
  expect(tags2.some((t) => t.Key === "env")).toBe(true);
  expect(tags2.some((t) => t.Key === "owner")).toBe(false);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id] }));
});

test("EMR security configuration lifecycle", async () => {
  const client = emr();

  const created = await client.send(
    new CreateSecurityConfigurationCommand({
      Name: "test-sec-config",
      SecurityConfiguration: JSON.stringify({ EncryptionConfiguration: {} }),
    }),
  );
  expect(created.Name).toBe("test-sec-config");
  expect(created.CreationDateTime).toBeTruthy();

  const described = await client.send(
    new DescribeSecurityConfigurationCommand({ Name: "test-sec-config" }),
  );
  expect(described.Name).toBe("test-sec-config");
  expect(described.SecurityConfiguration).toContain("EncryptionConfiguration");

  const listed = await client.send(new ListSecurityConfigurationsCommand({}));
  expect(
    (listed.SecurityConfigurations ?? []).some(
      (c) => c.Name === "test-sec-config",
    ),
  ).toBe(true);

  await client.send(
    new DeleteSecurityConfigurationCommand({ Name: "test-sec-config" }),
  );

  const listed2 = await client.send(new ListSecurityConfigurationsCommand({}));
  expect(
    (listed2.SecurityConfigurations ?? []).some(
      (c) => c.Name === "test-sec-config",
    ),
  ).toBe(false);
});

test("EMR studio lifecycle", async () => {
  const client = emr();

  const created = await client.send(
    new CreateStudioCommand({
      Name: "test-studio",
      AuthMode: "IAM",
      VpcId: "vpc-12345",
      SubnetIds: ["subnet-abc"],
      ServiceRole: "arn:aws:iam::123456789012:role/EMRStudio_Service_Role",
      WorkspaceSecurityGroupId: "sg-workspace",
      EngineSecurityGroupId: "sg-engine",
      DefaultS3Location: "s3://my-bucket/studio",
    }),
  );
  const studioId = created.StudioId ?? "";
  expect(studioId).toBeTruthy();
  expect(created.Url).toContain(studioId);

  const described = await client.send(
    new DescribeStudioCommand({ StudioId: studioId }),
  );
  expect(described.Studio?.Name).toBe("test-studio");
  expect(described.Studio?.AuthMode).toBe("IAM");

  await client.send(
    new UpdateStudioCommand({
      StudioId: studioId,
      Name: "updated-studio",
      Description: "updated desc",
    }),
  );

  const described2 = await client.send(
    new DescribeStudioCommand({ StudioId: studioId }),
  );
  expect(described2.Studio?.Name).toBe("updated-studio");
  expect(described2.Studio?.Description).toBe("updated desc");

  const listed = await client.send(new ListStudiosCommand({}));
  expect((listed.Studios ?? []).some((s) => s.StudioId === studioId)).toBe(
    true,
  );

  await client.send(new DeleteStudioCommand({ StudioId: studioId }));

  const listed2 = await client.send(new ListStudiosCommand({}));
  expect((listed2.Studios ?? []).some((s) => s.StudioId === studioId)).toBe(
    false,
  );
});

test("EMR studio session mapping lifecycle", async () => {
  const client = emr();

  const created = await client.send(
    new CreateStudioCommand({
      Name: "mapping-studio",
      AuthMode: "IAM",
      VpcId: "vpc-99999",
      SubnetIds: ["subnet-xyz"],
      ServiceRole: "arn:aws:iam::123456789012:role/EMRStudio_Service_Role",
      WorkspaceSecurityGroupId: "sg-ws2",
      EngineSecurityGroupId: "sg-eng2",
      DefaultS3Location: "s3://my-bucket/mapping-studio",
    }),
  );
  const studioId = created.StudioId ?? "";

  await client.send(
    new CreateStudioSessionMappingCommand({
      StudioId: studioId,
      IdentityId: "user-123",
      IdentityType: "USER",
      SessionPolicyArn:
        "arn:aws:iam::123456789012:policy/EMRStudio_Basic_User_Policy",
    }),
  );

  const got = await client.send(
    new GetStudioSessionMappingCommand({
      StudioId: studioId,
      IdentityId: "user-123",
      IdentityType: "USER",
    }),
  );
  expect(got.SessionMapping?.IdentityId).toBe("user-123");
  expect(got.SessionMapping?.IdentityType).toBe("USER");

  await client.send(
    new UpdateStudioSessionMappingCommand({
      StudioId: studioId,
      IdentityId: "user-123",
      IdentityType: "USER",
      SessionPolicyArn:
        "arn:aws:iam::123456789012:policy/EMRStudio_Advanced_User_Policy",
    }),
  );

  const got2 = await client.send(
    new GetStudioSessionMappingCommand({
      StudioId: studioId,
      IdentityId: "user-123",
      IdentityType: "USER",
    }),
  );
  expect(got2.SessionMapping?.SessionPolicyArn).toContain("Advanced");

  const listed = await client.send(
    new ListStudioSessionMappingsCommand({ StudioId: studioId }),
  );
  expect((listed.SessionMappings ?? []).length).toBeGreaterThan(0);

  await client.send(
    new DeleteStudioSessionMappingCommand({
      StudioId: studioId,
      IdentityId: "user-123",
      IdentityType: "USER",
    }),
  );

  const listed2 = await client.send(
    new ListStudioSessionMappingsCommand({ StudioId: studioId }),
  );
  expect(
    (listed2.SessionMappings ?? []).some((m) => m.IdentityId === "user-123"),
  ).toBe(false);

  await client.send(new DeleteStudioCommand({ StudioId: studioId }));
});

test("EMR instance fleet lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-fleet-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const added = await client.send(
    new AddInstanceFleetCommand({
      ClusterId: clusterId,
      InstanceFleet: {
        InstanceFleetType: "CORE",
        Name: "core-fleet",
        TargetOnDemandCapacity: 2,
      },
    }),
  );
  const fleetId = added.InstanceFleetId ?? "";
  expect(fleetId).toBeTruthy();
  expect(added.ClusterId).toBe(clusterId);

  const listed = await client.send(
    new ListInstanceFleetsCommand({ ClusterId: clusterId }),
  );
  expect((listed.InstanceFleets ?? []).some((f) => f.Id === fleetId)).toBe(
    true,
  );

  await client.send(
    new ModifyInstanceFleetCommand({
      ClusterId: clusterId,
      InstanceFleet: {
        InstanceFleetId: fleetId,
        TargetOnDemandCapacity: 4,
      },
    }),
  );

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR instance group lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-group-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const added = await client.send(
    new AddInstanceGroupsCommand({
      JobFlowId: clusterId,
      InstanceGroups: [
        {
          Name: "task-group",
          InstanceRole: "TASK",
          InstanceType: "m5.large",
          InstanceCount: 2,
        },
      ],
    }),
  );
  expect((added.InstanceGroupIds ?? []).length).toBe(1);
  const groupId = (added.InstanceGroupIds ?? [])[0] ?? "";

  const listed = await client.send(
    new ListInstanceGroupsCommand({ ClusterId: clusterId }),
  );
  expect((listed.InstanceGroups ?? []).some((g) => g.Id === groupId)).toBe(
    true,
  );

  await client.send(
    new ModifyInstanceGroupsCommand({
      ClusterId: clusterId,
      InstanceGroups: [{ InstanceGroupId: groupId, InstanceCount: 4 }],
    }),
  );

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR step operations", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-steps-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const addedSteps = await client.send(
    new AddJobFlowStepsCommand({
      JobFlowId: clusterId,
      Steps: [
        { Name: "step-a", HadoopJarStep: { Jar: "command-runner.jar" } },
        { Name: "step-b", HadoopJarStep: { Jar: "s3-dist-cp.jar" } },
      ],
    }),
  );
  const stepIds = addedSteps.StepIds ?? [];
  expect(stepIds.length).toBe(2);

  const described = await client.send(
    new DescribeStepCommand({ ClusterId: clusterId, StepId: stepIds[0] }),
  );
  expect(described.Step?.Name).toBe("step-a");
  expect(described.Step?.Status?.State).toBe("PENDING");

  const listed = await client.send(
    new ListStepsCommand({ ClusterId: clusterId }),
  );
  expect((listed.Steps ?? []).length).toBe(2);

  const cancelled = await client.send(
    new CancelStepsCommand({
      ClusterId: clusterId,
      StepIds: [stepIds[0] ?? ""],
    }),
  );
  expect((cancelled.CancelStepsInfoList ?? []).length).toBe(1);

  const listed2 = await client.send(
    new ListStepsCommand({ ClusterId: clusterId, StepStates: ["CANCELLED"] }),
  );
  expect((listed2.Steps ?? []).length).toBe(1);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR DescribeJobFlows", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-describe-jobflows",
      Instances: {
        InstanceCount: 3,
        MasterInstanceType: "m5.xlarge",
        SlaveInstanceType: "m5.large",
      },
    }),
  );
  const id = run.JobFlowId ?? "";

  const described = await client.send(
    new DescribeJobFlowsCommand({ JobFlowIds: [id] }),
  );
  const flow = (described.JobFlows ?? []).find((j) => j.JobFlowId === id);
  expect(flow).toBeTruthy();
  expect(flow?.Name).toBe("emr-describe-jobflows");
  expect(flow?.Instances?.MasterInstanceType).toBe("m5.xlarge");
  expect(flow?.Instances?.InstanceCount).toBe(3);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id] }));
});

test("EMR notebook execution lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-notebook-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const started = await client.send(
    new StartNotebookExecutionCommand({
      ExecutionEngine: { Id: clusterId },
      ServiceRole: "arn:aws:iam::123456789012:role/EMRRole",
      NotebookExecutionName: "test-execution",
    }),
  );
  const execId = started.NotebookExecutionId ?? "";
  expect(execId).toBeTruthy();

  const described = await client.send(
    new DescribeNotebookExecutionCommand({ NotebookExecutionId: execId }),
  );
  expect(described.NotebookExecution?.Status).toBe("RUNNING");
  expect(described.NotebookExecution?.NotebookExecutionId).toBe(execId);

  const listed = await client.send(new ListNotebookExecutionsCommand({}));
  expect(
    (listed.NotebookExecutions ?? []).some(
      (e) => e.NotebookExecutionId === execId,
    ),
  ).toBe(true);

  await client.send(
    new StopNotebookExecutionCommand({ NotebookExecutionId: execId }),
  );

  const described2 = await client.send(
    new DescribeNotebookExecutionCommand({ NotebookExecutionId: execId }),
  );
  expect(described2.NotebookExecution?.Status).toBe("STOPPING");

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR auto termination policy lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-autotermination-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  await client.send(
    new PutAutoTerminationPolicyCommand({
      ClusterId: clusterId,
      AutoTerminationPolicy: { IdleTimeout: 3600 },
    }),
  );

  const got = await client.send(
    new GetAutoTerminationPolicyCommand({ ClusterId: clusterId }),
  );
  expect(got.AutoTerminationPolicy?.IdleTimeout).toBe(3600);

  await client.send(
    new RemoveAutoTerminationPolicyCommand({ ClusterId: clusterId }),
  );

  const got2 = await client.send(
    new GetAutoTerminationPolicyCommand({ ClusterId: clusterId }),
  );
  expect(got2.AutoTerminationPolicy?.IdleTimeout).toBeUndefined();

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR block public access configuration", async () => {
  const client = emr();

  const got = await client.send(
    new GetBlockPublicAccessConfigurationCommand({}),
  );
  expect(
    got.BlockPublicAccessConfiguration?.BlockPublicSecurityGroupRules,
  ).toBeDefined();
  expect(got.BlockPublicAccessConfigurationMetadata?.CreatedByArn).toContain(
    "arn:aws:",
  );

  await client.send(
    new PutBlockPublicAccessConfigurationCommand({
      BlockPublicAccessConfiguration: { BlockPublicSecurityGroupRules: true },
    }),
  );

  const got2 = await client.send(
    new GetBlockPublicAccessConfigurationCommand({}),
  );
  expect(
    got2.BlockPublicAccessConfiguration?.BlockPublicSecurityGroupRules,
  ).toBe(true);
});

test("EMR managed scaling policy lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-managedscaling-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  await client.send(
    new PutManagedScalingPolicyCommand({
      ClusterId: clusterId,
      ManagedScalingPolicy: {
        ComputeLimits: {
          UnitType: "InstanceFleetUnits",
          MinimumCapacityUnits: 1,
          MaximumCapacityUnits: 10,
        },
      },
    }),
  );

  const got = await client.send(
    new GetManagedScalingPolicyCommand({ ClusterId: clusterId }),
  );
  expect(got.ManagedScalingPolicy).toBeDefined();

  await client.send(
    new RemoveManagedScalingPolicyCommand({ ClusterId: clusterId }),
  );

  const got2 = await client.send(
    new GetManagedScalingPolicyCommand({ ClusterId: clusterId }),
  );
  expect(got2.ManagedScalingPolicy?.ComputeLimits).toBeUndefined();

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR auto scaling policy lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-autoscaling-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const added = await client.send(
    new AddInstanceGroupsCommand({
      JobFlowId: clusterId,
      InstanceGroups: [
        {
          InstanceRole: "CORE",
          InstanceType: "m5.large",
          InstanceCount: 2,
        },
      ],
    }),
  );
  const groupId = (added.InstanceGroupIds ?? [])[0] ?? "";

  const put = await client.send(
    new PutAutoScalingPolicyCommand({
      ClusterId: clusterId,
      InstanceGroupId: groupId,
      AutoScalingPolicy: {
        Constraints: { MinCapacity: 1, MaxCapacity: 10 },
        Rules: [],
      },
    }),
  );
  expect(put.ClusterId).toBe(clusterId);
  expect(put.InstanceGroupId).toBe(groupId);

  await client.send(
    new RemoveAutoScalingPolicyCommand({
      ClusterId: clusterId,
      InstanceGroupId: groupId,
    }),
  );

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR modify cluster", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-modify-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const modified = await client.send(
    new ModifyClusterCommand({ ClusterId: clusterId, StepConcurrencyLevel: 5 }),
  );
  expect(modified.StepConcurrencyLevel).toBe(5);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR cluster flag mutations", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-flags-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const id = run.JobFlowId ?? "";

  await client.send(
    new SetTerminationProtectionCommand({
      JobFlowIds: [id],
      TerminationProtected: true,
    }),
  );
  const desc1 = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  expect(desc1.Cluster?.TerminationProtected).toBe(true);

  await client.send(
    new SetVisibleToAllUsersCommand({
      JobFlowIds: [id],
      VisibleToAllUsers: false,
    }),
  );
  const desc2 = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  expect(desc2.Cluster?.VisibleToAllUsers).toBe(false);

  await client.send(
    new SetKeepJobFlowAliveWhenNoStepsCommand({
      JobFlowIds: [id],
      KeepJobFlowAliveWhenNoSteps: true,
    }),
  );

  await client.send(
    new SetUnhealthyNodeReplacementCommand({
      JobFlowIds: [id],
      UnhealthyNodeReplacement: true,
    }),
  );

  await client.send(
    new SetTerminationProtectionCommand({
      JobFlowIds: [id],
      TerminationProtected: false,
    }),
  );
  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id] }));
});

test("EMR list operations on cluster", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-list-ops-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const bootstrapActions = await client.send(
    new ListBootstrapActionsCommand({ ClusterId: clusterId }),
  );
  expect(Array.isArray(bootstrapActions.BootstrapActions)).toBe(true);

  const instances = await client.send(
    new ListInstancesCommand({ ClusterId: clusterId }),
  );
  expect(Array.isArray(instances.Instances)).toBe(true);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR release label and supported instance types", async () => {
  const client = emr();

  const releaseLabels = await client.send(new ListReleaseLabelsCommand({}));
  expect((releaseLabels.ReleaseLabels ?? []).length).toBeGreaterThan(0);

  const described = await client.send(
    new DescribeReleaseLabelCommand({ ReleaseLabel: "emr-6.9.0" }),
  );
  expect(described.ReleaseLabel).toBe("emr-6.9.0");
  expect((described.Applications ?? []).length).toBeGreaterThan(0);

  const instanceTypes = await client.send(
    new ListSupportedInstanceTypesCommand({ ReleaseLabel: "emr-6.9.0" }),
  );
  expect((instanceTypes.SupportedInstanceTypes ?? []).length).toBeGreaterThan(
    0,
  );
});

test("EMR session credentials", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-creds-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const creds = await client.send(
    new GetClusterSessionCredentialsCommand({
      ClusterId: clusterId,
      ExecutionRoleArn: "arn:aws:iam::123456789012:role/EMRRole",
    }),
  );
  expect(creds.Credentials?.UsernamePassword?.Username).toBe("hadoop");
  expect(creds.Credentials?.UsernamePassword?.Password).toBeTruthy();

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR persistent app UI lifecycle", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-pui-test",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";
  const clusterArn = run.ClusterArn ?? "";

  const created = await client.send(
    new CreatePersistentAppUICommand({
      TargetResourceArn: clusterArn,
    }),
  );
  const puiId = created.PersistentAppUIId ?? "";
  expect(puiId).toBeTruthy();

  const described = await client.send(
    new DescribePersistentAppUICommand({ PersistentAppUIId: puiId }),
  );
  expect(described.PersistentAppUI?.PersistentAppUIId).toBe(puiId);

  const presigned = await client.send(
    new GetPersistentAppUIPresignedURLCommand({
      PersistentAppUIId: puiId,
    }),
  );
  expect(presigned.PresignedURLReady).toBe(true);
  expect(presigned.PresignedURL).toBeTruthy();

  const onCluster = await client.send(
    new GetOnClusterAppUIPresignedURLCommand({
      ClusterId: clusterId,
      OnClusterAppUIType: "SparkHistoryServer",
    }),
  );
  expect(onCluster.PresignedURLReady).toBe(true);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});

test("EMR termination lifecycle fidelity", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-terminate-fidelity",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const id = run.JobFlowId ?? "";

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id] }));

  const described = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  expect(described.Cluster?.Status?.State).toBe("TERMINATED");

  const listedTerminated = await client.send(
    new ListClustersCommand({ ClusterStates: ["TERMINATED"] }),
  );
  expect((listedTerminated.Clusters ?? []).some((c) => c.Id === id)).toBe(true);

  const listedWaiting = await client.send(
    new ListClustersCommand({ ClusterStates: ["WAITING"] }),
  );
  expect((listedWaiting.Clusters ?? []).some((c) => c.Id === id)).toBe(false);
});

test("EMR termination protection blocks terminate", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-protection-fidelity",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const id = run.JobFlowId ?? "";

  await client.send(
    new SetTerminationProtectionCommand({
      JobFlowIds: [id],
      TerminationProtected: true,
    }),
  );

  await expect(
    client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id] })),
  ).rejects.toThrow();

  const described = await client.send(
    new DescribeClusterCommand({ ClusterId: id }),
  );
  expect(described.Cluster?.Status?.State).toBe("WAITING");

  await client.send(
    new SetTerminationProtectionCommand({
      JobFlowIds: [id],
      TerminationProtected: false,
    }),
  );
  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [id] }));
});

test("EMR ModifyInstanceFleet persists capacity", async () => {
  const client = emr();

  const run = await client.send(
    new RunJobFlowCommand({
      Name: "emr-fleet-capacity-fidelity",
      Instances: { InstanceCount: 1, MasterInstanceType: "m5.xlarge" },
    }),
  );
  const clusterId = run.JobFlowId ?? "";

  const added = await client.send(
    new AddInstanceFleetCommand({
      ClusterId: clusterId,
      InstanceFleet: {
        InstanceFleetType: "CORE",
        Name: "capacity-fleet",
        TargetOnDemandCapacity: 2,
      },
    }),
  );
  const fleetId = added.InstanceFleetId ?? "";

  const beforeModify = await client.send(
    new ListInstanceFleetsCommand({ ClusterId: clusterId }),
  );
  const fleetBefore = (beforeModify.InstanceFleets ?? []).find(
    (f) => f.Id === fleetId,
  );
  expect(fleetBefore?.TargetOnDemandCapacity).toBe(2);
  expect(fleetBefore?.Status?.State).toBe("PROVISIONING");

  await client.send(
    new ModifyInstanceFleetCommand({
      ClusterId: clusterId,
      InstanceFleet: {
        InstanceFleetId: fleetId,
        TargetOnDemandCapacity: 5,
        TargetSpotCapacity: 3,
      },
    }),
  );

  const afterModify = await client.send(
    new ListInstanceFleetsCommand({ ClusterId: clusterId }),
  );
  const fleetAfter = (afterModify.InstanceFleets ?? []).find(
    (f) => f.Id === fleetId,
  );
  expect(fleetAfter?.TargetOnDemandCapacity).toBe(5);
  expect(fleetAfter?.TargetSpotCapacity).toBe(3);

  await client.send(new TerminateJobFlowsCommand({ JobFlowIds: [clusterId] }));
});
