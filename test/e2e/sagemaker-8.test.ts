import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsCommand,
  AssociateTrialComponentCommand,
  BatchDescribeModelPackageCommand,
  CreateAIBenchmarkJobCommand,
  CreateAIRecommendationJobCommand,
  CreateAIWorkloadConfigCommand,
  CreateModelPackageCommand,
  DescribeAIBenchmarkJobCommand,
  DescribeAIRecommendationJobCommand,
  DescribeAIWorkloadConfigCommand,
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

test("CreateAIBenchmarkJob → DescribeAIBenchmarkJob → AddTags lifecycle", async () => {
  const client = sagemaker();
  const jobName = "bunsai-e2e-benchmark-job";

  const created = await client.send(
    new CreateAIBenchmarkJobCommand({
      AIBenchmarkJobName: jobName,
      BenchmarkTarget: {
        BenchmarkConfig: {
          ModelId: "test-model-id",
        },
      },
      OutputConfig: {
        S3OutputLocation: "s3://bunsai-bucket/benchmark-output/",
      },
      AIWorkloadConfigIdentifier: "bunsai-workload-config",
      RoleArn: `arn:aws:iam::123456789012:role/SageMakerRole`,
    }),
  );
  expect(created.AIBenchmarkJobArn).toContain("ai-benchmark-job");
  expect(created.AIBenchmarkJobArn).toContain(jobName);

  const described = await client.send(
    new DescribeAIBenchmarkJobCommand({
      AIBenchmarkJobName: jobName,
    }),
  );
  expect(described.AIBenchmarkJobName).toBe(jobName);
  expect(described.AIBenchmarkJobArn).toBe(created.AIBenchmarkJobArn);
  expect(described.AIBenchmarkJobStatus).toBeDefined();

  const tagged = await client.send(
    new AddTagsCommand({
      ResourceArn: created.AIBenchmarkJobArn!,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "bunsai" },
      ],
    }),
  );
  expect(tagged.Tags).toHaveLength(2);
  expect(tagged.Tags![0].Key).toBe("env");
  expect(tagged.Tags![1].Key).toBe("project");

  const taggedAgain = await client.send(
    new AddTagsCommand({
      ResourceArn: created.AIBenchmarkJobArn!,
      Tags: [{ Key: "env", Value: "staging" }],
    }),
  );
  expect(taggedAgain.Tags).toHaveLength(2);
  const envTag = taggedAgain.Tags!.find((t) => t.Key === "env");
  expect(envTag?.Value).toBe("staging");
});

test("CreateAIRecommendationJob → DescribeAIRecommendationJob lifecycle", async () => {
  const client = sagemaker();
  const jobName = "bunsai-e2e-rec-job";

  const created = await client.send(
    new CreateAIRecommendationJobCommand({
      AIRecommendationJobName: jobName,
      ModelSource: {
        S3: {
          S3Uri: "s3://bunsai-bucket/model/",
        },
      },
      OutputConfig: {
        S3OutputLocation: "s3://bunsai-bucket/rec-output/",
      },
      AIWorkloadConfigIdentifier: "bunsai-workload-config",
      PerformanceTarget: {
        Constraints: {},
      },
      RoleArn: `arn:aws:iam::123456789012:role/SageMakerRole`,
    }),
  );
  expect(created.AIRecommendationJobArn).toContain("ai-recommendation-job");
  expect(created.AIRecommendationJobArn).toContain(jobName);

  const described = await client.send(
    new DescribeAIRecommendationJobCommand({
      AIRecommendationJobName: jobName,
    }),
  );
  expect(described.AIRecommendationJobName).toBe(jobName);
  expect(described.AIRecommendationJobArn).toBe(created.AIRecommendationJobArn);
});

test("CreateAIWorkloadConfig → DescribeAIWorkloadConfig lifecycle", async () => {
  const client = sagemaker();
  const configName = "bunsai-e2e-workload-config";

  const created = await client.send(
    new CreateAIWorkloadConfigCommand({
      AIWorkloadConfigName: configName,
    }),
  );
  expect(created.AIWorkloadConfigArn).toContain("ai-workload-config");
  expect(created.AIWorkloadConfigArn).toContain(configName);

  const described = await client.send(
    new DescribeAIWorkloadConfigCommand({
      AIWorkloadConfigName: configName,
    }),
  );
  expect(described.AIWorkloadConfigName).toBe(configName);
  expect(described.AIWorkloadConfigArn).toBe(created.AIWorkloadConfigArn);
});

test("AssociateTrialComponent lifecycle", async () => {
  const client = sagemaker();
  const trialComponentName = "bunsai-e2e-trial-component";
  const trialName = "bunsai-e2e-trial";

  const associated = await client.send(
    new AssociateTrialComponentCommand({
      TrialComponentName: trialComponentName,
      TrialName: trialName,
    }),
  );
  expect(associated.TrialComponentArn).toContain("experiment-trial-component");
  expect(associated.TrialComponentArn).toContain(trialComponentName);
  expect(associated.TrialArn).toContain("experiment-trial");
  expect(associated.TrialArn).toContain(trialName);
});

test("BatchDescribeModelPackage lifecycle", async () => {
  const client = sagemaker();
  const pkgName = "bunsai-e2e-model-pkg-batch";

  const createdPkg = await client.send(
    new CreateModelPackageCommand({
      ModelPackageName: pkgName,
      ModelPackageDescription: "test package for batch describe",
    }),
  );
  const pkgArn = createdPkg.ModelPackageArn!;
  expect(pkgArn).toContain("model-package");

  const batch = await client.send(
    new BatchDescribeModelPackageCommand({
      ModelPackageArnList: [pkgArn],
    }),
  );
  expect(batch.ModelPackageSummaries).toBeDefined();
  const summary = batch.ModelPackageSummaries![pkgArn];
  expect(summary).toBeDefined();
  expect(summary.ModelPackageArn).toBe(pkgArn);
  expect(summary.ModelPackageStatus).toBeDefined();
});
