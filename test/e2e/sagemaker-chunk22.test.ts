import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateModelPackageGroupCommand,
  CreateMonitoringScheduleCommand,
  CreateOptimizationJobCommand,
  CreatePartnerAppCommand,
  CreatePipelineCommand,
  CreateProcessingJobCommand,
  ListModelMetadataCommand,
  ListModelPackageGroupsCommand,
  ListModelPackagesCommand,
  ListMonitoringAlertHistoryCommand,
  ListMonitoringAlertsCommand,
  ListMonitoringExecutionsCommand,
  ListMonitoringSchedulesCommand,
  ListOptimizationJobsCommand,
  ListPartnerAppsCommand,
  ListPipelinesCommand,
  ListProcessingJobsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("ListModelMetadata returns empty list", async () => {
  const client = sagemaker();
  const res = await client.send(new ListModelMetadataCommand({}));
  expect(res.ModelMetadataSummaries).toBeDefined();
  expect(Array.isArray(res.ModelMetadataSummaries)).toBe(true);
});

test("CreateModelPackageGroup → ListModelPackageGroups includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListModelPackageGroupsCommand({}));
  expect(empty.ModelPackageGroupSummaryList).toBeDefined();

  await client.send(
    new CreateModelPackageGroupCommand({
      ModelPackageGroupName: "bunsai-e2e-mpg-22",
      ModelPackageGroupDescription: "chunk22 test group",
    }),
  );

  const listed = await client.send(new ListModelPackageGroupsCommand({}));
  const found = listed.ModelPackageGroupSummaryList!.find(
    (g) => g.ModelPackageGroupName === "bunsai-e2e-mpg-22",
  );
  expect(found).toBeDefined();
  expect(found!.ModelPackageGroupArn).toContain(
    "model-package-group/bunsai-e2e-mpg-22",
  );
  expect(found!.ModelPackageGroupStatus).toBe("Completed");
});

test("ListModelPackages returns empty list", async () => {
  const client = sagemaker();
  const res = await client.send(new ListModelPackagesCommand({}));
  expect(res.ModelPackageSummaryList).toBeDefined();
  expect(Array.isArray(res.ModelPackageSummaryList)).toBe(true);
});

test("CreatePipeline → ListPipelines includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListPipelinesCommand({}));
  expect(empty.PipelineSummaries).toBeDefined();

  await client.send(
    new CreatePipelineCommand({
      PipelineName: "bunsai-e2e-pl-22",
      PipelineDefinition: JSON.stringify({ Version: "2020-12-01", Steps: [] }),
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
    }),
  );

  const listed = await client.send(new ListPipelinesCommand({}));
  const found = listed.PipelineSummaries!.find(
    (p) => p.PipelineName === "bunsai-e2e-pl-22",
  );
  expect(found).toBeDefined();
  expect(found!.PipelineArn).toContain("pipeline/bunsai-e2e-pl-22");
});

test("CreateMonitoringSchedule → ListMonitoringSchedules includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListMonitoringSchedulesCommand({}));
  expect(empty.MonitoringScheduleSummaries).toBeDefined();

  await client.send(
    new CreateMonitoringScheduleCommand({
      MonitoringScheduleName: "bunsai-e2e-ms-22",
      MonitoringScheduleConfig: {
        MonitoringJobDefinitionName: "bunsai-e2e-mj-22",
        MonitoringType: "DataQuality",
        ScheduleConfig: { ScheduleExpression: "cron(0 * ? * * *)" },
      },
    }),
  );

  const listed = await client.send(new ListMonitoringSchedulesCommand({}));
  const found = listed.MonitoringScheduleSummaries!.find(
    (s) => s.MonitoringScheduleName === "bunsai-e2e-ms-22",
  );
  expect(found).toBeDefined();
  expect(found!.MonitoringScheduleArn).toContain(
    "monitoring-schedule/bunsai-e2e-ms-22",
  );
});

test("ListMonitoringAlerts requires schedule to exist", async () => {
  const client = sagemaker();

  await client.send(
    new CreateMonitoringScheduleCommand({
      MonitoringScheduleName: "bunsai-e2e-ms-alert-22",
      MonitoringScheduleConfig: {
        MonitoringJobDefinitionName: "bunsai-e2e-mj-alert-22",
        MonitoringType: "DataQuality",
        ScheduleConfig: { ScheduleExpression: "cron(0 * ? * * *)" },
      },
    }),
  );

  const res = await client.send(
    new ListMonitoringAlertsCommand({
      MonitoringScheduleName: "bunsai-e2e-ms-alert-22",
    }),
  );
  expect(res.MonitoringAlertSummaries).toBeDefined();
});

test("ListMonitoringAlertHistory returns empty list", async () => {
  const client = sagemaker();
  const res = await client.send(new ListMonitoringAlertHistoryCommand({}));
  expect(res.MonitoringAlertHistory).toBeDefined();
  expect(Array.isArray(res.MonitoringAlertHistory)).toBe(true);
});

test("ListMonitoringExecutions returns empty list", async () => {
  const client = sagemaker();
  const res = await client.send(new ListMonitoringExecutionsCommand({}));
  expect(res.MonitoringExecutionSummaries).toBeDefined();
  expect(Array.isArray(res.MonitoringExecutionSummaries)).toBe(true);
});

test("CreateOptimizationJob → ListOptimizationJobs includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListOptimizationJobsCommand({}));
  expect(empty.OptimizationJobSummaries).toBeDefined();

  await client.send(
    new CreateOptimizationJobCommand({
      OptimizationJobName: "bunsai-e2e-oj-22",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
      ModelSource: {
        S3: {
          S3Uri: "s3://bunsai-bucket/model/",
          ModelAccessConfig: { AcceptEula: true },
        },
      },
      DeploymentInstanceType: "ml.g5.xlarge",
      OptimizationConfigs: [{ ModelQuantizationConfig: {} }],
      OutputConfig: { S3OutputLocation: "s3://bunsai-bucket/output/" },
      StoppingCondition: { MaxRuntimeInSeconds: 3600 },
    }),
  );

  const listed = await client.send(new ListOptimizationJobsCommand({}));
  const found = listed.OptimizationJobSummaries!.find(
    (j) => j.OptimizationJobName === "bunsai-e2e-oj-22",
  );
  expect(found).toBeDefined();
  expect(found!.OptimizationJobArn).toContain(
    "optimization-job/bunsai-e2e-oj-22",
  );
});

test("CreatePartnerApp → ListPartnerApps includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListPartnerAppsCommand({}));
  expect(empty.Summaries).toBeDefined();

  await client.send(
    new CreatePartnerAppCommand({
      Name: "bunsai-e2e-pa-22",
      Type: "lakera-guard",
      ExecutionRoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
      Tier: "Advanced",
      AuthType: "IAM",
    }),
  );

  const listed = await client.send(new ListPartnerAppsCommand({}));
  const found = listed.Summaries!.find((a) => a.Name === "bunsai-e2e-pa-22");
  expect(found).toBeDefined();
  expect(found!.Arn).toContain("partner-app/bunsai-e2e-pa-22");
  expect(found!.Type).toBe("lakera-guard");
});

test("CreateProcessingJob → ListProcessingJobs includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListProcessingJobsCommand({}));
  expect(empty.ProcessingJobSummaries).toBeDefined();

  await client.send(
    new CreateProcessingJobCommand({
      ProcessingJobName: "bunsai-e2e-pj-22",
      AppSpecification: {
        ImageUri:
          "123456789012.dkr.ecr.us-east-1.amazonaws.com/bunsai-processing:latest",
      },
      ProcessingResources: {
        ClusterConfig: {
          InstanceCount: 1,
          InstanceType: "ml.m5.large",
          VolumeSizeInGB: 30,
        },
      },
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
    }),
  );

  const listed = await client.send(new ListProcessingJobsCommand({}));
  const found = listed.ProcessingJobSummaries!.find(
    (j) => j.ProcessingJobName === "bunsai-e2e-pj-22",
  );
  expect(found).toBeDefined();
  expect(found!.ProcessingJobArn).toContain("processing-job/bunsai-e2e-pj-22");
  expect(found!.ProcessingJobStatus).toBe("InProgress");
});
