import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateTrialComponentCommand,
  CreateAIBenchmarkJobCommand,
  CreateAIRecommendationJobCommand,
  CreateDeviceFleetCommand,
  CreateHubCommand,
  CreateTrialCommand,
  CreateTrialComponentCommand,
  DisableSagemakerServicecatalogPortfolioCommand,
  DisassociateTrialComponentCommand,
  EnableSagemakerServicecatalogPortfolioCommand,
  GetDeviceFleetReportCommand,
  GetSagemakerServicecatalogPortfolioStatusCommand,
  GetSearchSuggestionsCommand,
  ImportHubContentCommand,
  ListAIBenchmarkJobsCommand,
  ListAIRecommendationJobsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("EnableSagemakerServicecatalogPortfolio → GetSagemakerServicecatalogPortfolioStatus round-trip", async () => {
  const client = sagemaker();

  await client.send(new EnableSagemakerServicecatalogPortfolioCommand({}));

  const enabled = await client.send(
    new GetSagemakerServicecatalogPortfolioStatusCommand({}),
  );
  expect(enabled.Status).toBe("Enabled");

  await client.send(new DisableSagemakerServicecatalogPortfolioCommand({}));

  const disabled = await client.send(
    new GetSagemakerServicecatalogPortfolioStatusCommand({}),
  );
  expect(disabled.Status).toBe("Disabled");
});

test("AssociateTrialComponent → DisassociateTrialComponent round-trip", async () => {
  const client = sagemaker();

  await client.send(
    new CreateTrialComponentCommand({
      TrialComponentName: "bunsai-e2e-tc-19",
    }),
  );

  await client.send(
    new CreateTrialCommand({
      TrialName: "bunsai-e2e-trial-19",
      ExperimentName: "bunsai-e2e-exp-19",
    }),
  );

  const associated = await client.send(
    new AssociateTrialComponentCommand({
      TrialComponentName: "bunsai-e2e-tc-19",
      TrialName: "bunsai-e2e-trial-19",
    }),
  );
  expect(associated.TrialComponentArn).toBeDefined();
  expect(associated.TrialArn).toBeDefined();

  const disassociated = await client.send(
    new DisassociateTrialComponentCommand({
      TrialComponentName: "bunsai-e2e-tc-19",
      TrialName: "bunsai-e2e-trial-19",
    }),
  );
  expect(disassociated.TrialComponentArn).toBe(associated.TrialComponentArn);
  expect(disassociated.TrialArn).toBe(associated.TrialArn);

  await expect(
    client.send(
      new DisassociateTrialComponentCommand({
        TrialComponentName: "bunsai-e2e-tc-19",
        TrialName: "bunsai-e2e-trial-19",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateAIBenchmarkJob → ListAIBenchmarkJobs", async () => {
  const client = sagemaker();

  await client.send(
    new CreateAIBenchmarkJobCommand({
      AIBenchmarkJobName: "bunsai-e2e-benchmark-19",
      BenchmarkTarget: {
        Endpoint: { Identifier: "bunsai-endpoint" },
      },
      OutputConfig: { S3OutputLocation: "s3://bucket/output" },
      AIWorkloadConfigIdentifier: "bunsai-workload-config",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
    }),
  );

  const listed = await client.send(new ListAIBenchmarkJobsCommand({}));
  expect(listed.AIBenchmarkJobs).toBeDefined();
  const found = listed.AIBenchmarkJobs!.find(
    (j) => j.AIBenchmarkJobName === "bunsai-e2e-benchmark-19",
  );
  expect(found).toBeDefined();
  expect(found!.AIBenchmarkJobArn).toContain("ai-benchmark-job/");
});

test("CreateAIRecommendationJob → ListAIRecommendationJobs", async () => {
  const client = sagemaker();

  await client.send(
    new CreateAIRecommendationJobCommand({
      AIRecommendationJobName: "bunsai-e2e-recom-19",
      ModelSource: { S3: { S3Uri: "s3://bucket/model" } },
      OutputConfig: { S3OutputLocation: "s3://bucket/output" },
      AIWorkloadConfigIdentifier: "bunsai-workload-config",
      PerformanceTarget: { Constraints: [] },
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
    }),
  );

  const listed = await client.send(new ListAIRecommendationJobsCommand({}));
  expect(listed.AIRecommendationJobs).toBeDefined();
  const found = listed.AIRecommendationJobs!.find(
    (j) => j.AIRecommendationJobName === "bunsai-e2e-recom-19",
  );
  expect(found).toBeDefined();
  expect(found!.AIRecommendationJobArn).toContain("ai-recommendation-job/");
});

test("CreateHub → ImportHubContent", async () => {
  const client = sagemaker();

  const hub = await client.send(
    new CreateHubCommand({
      HubName: "bunsai-e2e-hub-19",
      HubDescription: "e2e test hub chunk 19",
    }),
  );
  expect(hub.HubArn).toContain("hub/bunsai-e2e-hub-19");

  const imported = await client.send(
    new ImportHubContentCommand({
      HubName: "bunsai-e2e-hub-19",
      HubContentName: "bunsai-e2e-hub-content-19",
      HubContentType: "Model",
      DocumentSchemaVersion: "1.0.0",
      HubContentDocument: "{}",
    }),
  );
  expect(imported.HubArn).toContain("hub/bunsai-e2e-hub-19");
  expect(imported.HubContentArn).toContain("hub-content/");
});

test("CreateDeviceFleet → GetDeviceFleetReport", async () => {
  const client = sagemaker();

  await client.send(
    new CreateDeviceFleetCommand({
      DeviceFleetName: "bunsai-e2e-fleet-19",
      OutputConfig: { S3OutputLocation: "s3://bucket/output" },
    }),
  );

  const report = await client.send(
    new GetDeviceFleetReportCommand({
      DeviceFleetName: "bunsai-e2e-fleet-19",
    }),
  );
  expect(report.DeviceFleetName).toBe("bunsai-e2e-fleet-19");
  expect(report.DeviceFleetArn).toContain("device-fleet/bunsai-e2e-fleet-19");
  expect(report.DeviceStats).toBeDefined();
});

test("GetSearchSuggestions returns suggestions list", async () => {
  const client = sagemaker();

  const result = await client.send(
    new GetSearchSuggestionsCommand({ Resource: "TrainingJob" }),
  );
  expect(result.PropertyNameSuggestions).toBeDefined();
  expect(Array.isArray(result.PropertyNameSuggestions)).toBe(true);
});
