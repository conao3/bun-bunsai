import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateClusterCommand,
  CreateClusterSchedulerConfigCommand,
  CreateCodeRepositoryCommand,
  CreateCompilationJobCommand,
  CreateContextCommand,
  CreateDataQualityJobDefinitionCommand,
  CreateDeviceFleetCommand,
  CreateEdgeDeploymentPlanCommand,
  DeleteClusterCommand,
  DeleteClusterSchedulerConfigCommand,
  DeleteCodeRepositoryCommand,
  DeleteCompilationJobCommand,
  DeleteContextCommand,
  DeleteDataQualityJobDefinitionCommand,
  DeleteDeviceFleetCommand,
  DeleteEdgeDeploymentPlanCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Cluster create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateClusterCommand({
      ClusterName: "bunsai-e2e-cluster",
      InstanceGroups: [
        {
          InstanceGroupName: "group1",
          InstanceType: "ml.t3.medium",
          InstanceCount: 1,
          LifeCycleConfig: {
            SourceS3Uri: "s3://bucket/lcc",
            OnCreate: "on_create.sh",
          },
        },
      ],
    }),
  );
  expect(created.ClusterArn).toContain("bunsai-e2e-cluster");

  const deleted = await client.send(
    new DeleteClusterCommand({ ClusterName: "bunsai-e2e-cluster" }),
  );
  expect(deleted.ClusterArn).toContain("bunsai-e2e-cluster");

  await expect(
    client.send(
      new DeleteClusterCommand({ ClusterName: "bunsai-e2e-cluster" }),
    ),
  ).rejects.toThrow();
});

test("Context create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateContextCommand({
      ContextName: "bunsai-e2e-context",
      ContextType: "Experiment",
      Source: { SourceUri: "s3://bucket/source", SourceType: "S3Object" },
    }),
  );
  expect(created.ContextArn).toContain("bunsai-e2e-context");

  const deleted = await client.send(
    new DeleteContextCommand({ ContextName: "bunsai-e2e-context" }),
  );
  expect(deleted.ContextArn).toContain("bunsai-e2e-context");

  await expect(
    client.send(
      new DeleteContextCommand({ ContextName: "bunsai-e2e-context" }),
    ),
  ).rejects.toThrow();
});

test("CodeRepository create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-code-repo",
      GitConfig: { RepositoryUrl: "https://github.com/example/repo" },
    }),
  );
  expect(created.CodeRepositoryArn).toContain("bunsai-e2e-code-repo");

  await client.send(
    new DeleteCodeRepositoryCommand({
      CodeRepositoryName: "bunsai-e2e-code-repo",
    }),
  );

  await expect(
    client.send(
      new DeleteCodeRepositoryCommand({
        CodeRepositoryName: "bunsai-e2e-code-repo",
      }),
    ),
  ).rejects.toThrow();
});

test("CompilationJob create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateCompilationJobCommand({
      CompilationJobName: "bunsai-e2e-compilation-job",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      InputConfig: {
        S3Uri: "s3://bucket/input",
        DataInputConfig: '{"input":[[1,224,224,3]]}',
        Framework: "TENSORFLOW",
      },
      OutputConfig: {
        S3OutputLocation: "s3://bucket/output",
        TargetDevice: "ml_c5",
      },
      StoppingCondition: { MaxRuntimeInSeconds: 900 },
    }),
  );
  expect(created.CompilationJobArn).toContain("bunsai-e2e-compilation-job");

  await client.send(
    new DeleteCompilationJobCommand({
      CompilationJobName: "bunsai-e2e-compilation-job",
    }),
  );

  await expect(
    client.send(
      new DeleteCompilationJobCommand({
        CompilationJobName: "bunsai-e2e-compilation-job",
      }),
    ),
  ).rejects.toThrow();
});

test("DataQualityJobDefinition create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateDataQualityJobDefinitionCommand({
      JobDefinitionName: "bunsai-e2e-dq-job",
      DataQualityAppSpecification: {
        ImageUri:
          "123456789012.dkr.ecr.us-east-1.amazonaws.com/sagemaker-model-monitor-analyzer",
      },
      DataQualityJobInput: {
        EndpointInput: {
          EndpointName: "my-endpoint",
          LocalPath: "/opt/ml/processing/endpointdata",
        },
      },
      DataQualityJobOutputConfig: {
        MonitoringOutputs: [
          {
            S3Output: {
              S3Uri: "s3://bucket/output",
              LocalPath: "/opt/ml/processing/output",
              S3UploadMode: "EndOfJob",
            },
          },
        ],
      },
      JobResources: {
        ClusterConfig: {
          InstanceCount: 1,
          InstanceType: "ml.t3.medium",
          VolumeSizeInGB: 20,
        },
      },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );
  expect(created.JobDefinitionArn).toContain("bunsai-e2e-dq-job");

  await client.send(
    new DeleteDataQualityJobDefinitionCommand({
      JobDefinitionName: "bunsai-e2e-dq-job",
    }),
  );

  await expect(
    client.send(
      new DeleteDataQualityJobDefinitionCommand({
        JobDefinitionName: "bunsai-e2e-dq-job",
      }),
    ),
  ).rejects.toThrow();
});

test("DeviceFleet and EdgeDeploymentPlan create and delete lifecycle", async () => {
  const client = sagemaker();

  await client.send(
    new CreateDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-device-fleet-del",
      OutputConfig: { S3OutputLocation: "s3://bucket/device-fleet" },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );

  await client.send(
    new DeleteDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-device-fleet-del",
    }),
  );

  await expect(
    client.send(
      new DeleteDeviceFleetCommand({
        DeviceFleetName: "bunsai-e2e-device-fleet-del",
      }),
    ),
  ).rejects.toThrow();

  const plan = await client.send(
    new CreateEdgeDeploymentPlanCommand({
      EdgeDeploymentPlanName: "bunsai-e2e-edge-plan",
      DeviceFleetName: "some-fleet",
      ModelConfigs: [
        { ModelHandle: "model-handle", EdgePackagingJobName: "pkg-job" },
      ],
    }),
  );
  expect(plan.EdgeDeploymentPlanArn).toContain("bunsai-e2e-edge-plan");

  await client.send(
    new DeleteEdgeDeploymentPlanCommand({
      EdgeDeploymentPlanName: "bunsai-e2e-edge-plan",
    }),
  );

  await expect(
    client.send(
      new DeleteEdgeDeploymentPlanCommand({
        EdgeDeploymentPlanName: "bunsai-e2e-edge-plan",
      }),
    ),
  ).rejects.toThrow();
});

test("ClusterSchedulerConfig create and delete lifecycle", async () => {
  const client = sagemaker();

  const clusterCreated = await client.send(
    new CreateClusterCommand({
      ClusterName: "bunsai-e2e-cluster-sched",
      InstanceGroups: [
        {
          InstanceGroupName: "group1",
          InstanceType: "ml.t3.medium",
          InstanceCount: 1,
          LifeCycleConfig: {
            SourceS3Uri: "s3://bucket/lcc",
            OnCreate: "on_create.sh",
          },
        },
      ],
    }),
  );

  const created = await client.send(
    new CreateClusterSchedulerConfigCommand({
      Name: "bunsai-e2e-sched-config",
      ClusterArn: clusterCreated.ClusterArn,
      SchedulerConfig: { PriorityClasses: [], FairShare: "Enabled" },
    }),
  );
  expect(created.ClusterSchedulerConfigArn).toContain(
    "bunsai-e2e-sched-config",
  );

  await client.send(
    new DeleteClusterSchedulerConfigCommand({
      ClusterSchedulerConfigId: created.ClusterSchedulerConfigId,
    }),
  );

  await expect(
    client.send(
      new DeleteClusterSchedulerConfigCommand({
        ClusterSchedulerConfigId: created.ClusterSchedulerConfigId,
      }),
    ),
  ).rejects.toThrow();
});
