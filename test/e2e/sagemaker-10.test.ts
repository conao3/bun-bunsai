import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateDeviceFleetCommand,
  CreateEdgeDeploymentPlanCommand,
  CreateEdgeDeploymentStageCommand,
  CreateEdgePackagingJobCommand,
  CreateExperimentCommand,
  CreateFlowDefinitionCommand,
  CreateHumanTaskUiCommand,
  CreateHyperParameterTuningJobCommand,
  CreateLabelingJobCommand,
  CreateMlflowTrackingServerCommand,
  CreateOptimizationJobCommand,
  CreatePresignedMlflowTrackingServerUrlCommand,
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

test("CreateDeviceFleet returns empty response", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-device-fleet",
      OutputConfig: { S3OutputLocation: "s3://bunsai/device-fleet-output" },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );
  expect(result.$metadata.httpStatusCode).toBe(200);
});

test("CreateEdgeDeploymentPlan returns EdgeDeploymentPlanArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateEdgeDeploymentPlanCommand({
      EdgeDeploymentPlanName: "bunsai-e2e-edge-plan",
      DeviceFleetName: "bunsai-e2e-device-fleet",
      ModelConfigs: [
        {
          ModelHandle: "handle1",
          EdgePackagingJobName: "bunsai-e2e-pkg",
        },
      ],
    }),
  );
  expect(result.EdgeDeploymentPlanArn).toContain(
    "edge-deployment-plan/bunsai-e2e-edge-plan",
  );
});

test("CreateEdgeDeploymentStage appends stage", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateEdgeDeploymentStageCommand({
      EdgeDeploymentPlanName: "bunsai-e2e-edge-plan",
      Stages: [
        {
          StageName: "stage1",
          DeviceSelectionConfig: {
            DeviceSubsetType: "PERCENTAGE",
            Percentage: 10,
          },
        },
      ],
    }),
  );
  expect(result.$metadata.httpStatusCode).toBe(200);
});

test("CreateEdgePackagingJob returns empty response", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateEdgePackagingJobCommand({
      EdgePackagingJobName: "bunsai-e2e-edge-pkg",
      CompilationJobName: "bunsai-e2e-compilation",
      ModelName: "bunsai-model",
      ModelVersion: "1.0",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      OutputConfig: { S3OutputLocation: "s3://bunsai/pkg-output" },
    }),
  );
  expect(result.$metadata.httpStatusCode).toBe(200);
});

test("CreateExperiment → CreatePresignedMlflowTrackingServerUrl lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateExperimentCommand({
      ExperimentName: "bunsai-e2e-experiment",
      DisplayName: "Bunsai E2E Experiment",
      Description: "e2e test experiment",
    }),
  );

  expect(created.ExperimentArn).toBeDefined();
  expect(created.ExperimentArn).toContain("experiment/bunsai-e2e-experiment");

  const server = await client.send(
    new CreateMlflowTrackingServerCommand({
      TrackingServerName: "bunsai-e2e-tracking",
      ArtifactStoreUri: "s3://bunsai/mlflow-artifacts",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );

  expect(server.TrackingServerArn).toContain(
    "mlflow-tracking-server/bunsai-e2e-tracking",
  );

  const presigned = await client.send(
    new CreatePresignedMlflowTrackingServerUrlCommand({
      TrackingServerName: "bunsai-e2e-tracking",
    }),
  );

  expect(presigned.AuthorizedUrl).toContain("bunsai-e2e-tracking");
  expect(presigned.AuthorizedUrl).toContain("bunsai-presigned-token");
});

test("CreateFlowDefinition returns FlowDefinitionArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateFlowDefinitionCommand({
      FlowDefinitionName: "bunsai-e2e-flow",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      OutputConfig: { S3OutputPath: "s3://bunsai/flow-output" },
    }),
  );
  expect(result.FlowDefinitionArn).toContain("flow-definition/bunsai-e2e-flow");
});

test("CreateHumanTaskUi returns HumanTaskUiArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateHumanTaskUiCommand({
      HumanTaskUiName: "bunsai-e2e-human-task-ui",
      UiTemplate: { Content: "<html></html>" },
    }),
  );
  expect(result.HumanTaskUiArn).toContain(
    "human-task-ui/bunsai-e2e-human-task-ui",
  );
});

test("CreateHyperParameterTuningJob returns HyperParameterTuningJobArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateHyperParameterTuningJobCommand({
      HyperParameterTuningJobName: "bunsai-e2e-hpt",
      HyperParameterTuningJobConfig: {
        Strategy: "Bayesian",
        ResourceLimits: {
          MaxNumberOfTrainingJobs: 10,
          MaxParallelTrainingJobs: 2,
        },
      },
    }),
  );
  expect(result.HyperParameterTuningJobArn).toContain(
    "hyper-parameter-tuning-job/bunsai-e2e-hpt",
  );
});

test("CreateLabelingJob returns LabelingJobArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateLabelingJobCommand({
      LabelingJobName: "bunsai-e2e-labeling",
      LabelAttributeName: "label",
      InputConfig: {
        DataSource: {
          S3DataSource: { ManifestS3Uri: "s3://bunsai/labeling-input" },
        },
      },
      OutputConfig: { S3OutputPath: "s3://bunsai/labeling-output" },
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      HumanTaskConfig: {
        WorkteamArn:
          "arn:aws:sagemaker:us-east-1:123456789012:workteam/private-crowd/team",
        UiConfig: { UiTemplateS3Uri: "s3://bunsai/template.html" },
        PreHumanTaskLambdaArn:
          "arn:aws:lambda:us-east-1:432418664414:function:PRE-BoundingBox",
        TaskTitle: "Label",
        TaskDescription: "Desc",
        NumberOfHumanWorkersPerDataObject: 1,
        TaskTimeLimitInSeconds: 3600,
        AnnotationConsolidationConfig: {
          AnnotationConsolidationLambdaArn:
            "arn:aws:lambda:us-east-1:432418664414:function:ACS-BoundingBox",
        },
      },
    }),
  );
  expect(result.LabelingJobArn).toContain("labeling-job/bunsai-e2e-labeling");
});

test("CreateOptimizationJob returns OptimizationJobArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateOptimizationJobCommand({
      OptimizationJobName: "bunsai-e2e-optimization",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      ModelSource: {
        S3: {
          S3Uri: "s3://bunsai/model",
          ModelAccessConfig: { AcceptEula: true },
        },
      },
      DeploymentInstanceType: "ml.g5.xlarge",
      OptimizationConfigs: [{ ModelQuantizationConfig: { Image: "img" } }],
      OutputConfig: { S3OutputLocation: "s3://bunsai/opt-output" },
      StoppingCondition: { MaxRuntimeInSeconds: 3600 },
    }),
  );
  expect(result.OptimizationJobArn).toContain(
    "optimization-job/bunsai-e2e-optimization",
  );
});
