import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAlgorithmCommand,
  CreateAppCommand,
  CreateAutoMLJobCommand,
  CreateDomainCommand,
  ListActionsCommand,
  ListAlgorithmsCommand,
  ListAppImageConfigsCommand,
  ListAppsCommand,
  ListAutoMLJobsCommand,
  ListCandidatesForAutoMLJobCommand,
  ListClusterEventsCommand,
  ListClusterNodesCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("ListAlgorithms empty then CreateAlgorithm → listed", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListAlgorithmsCommand({}));
  expect(Array.isArray(empty.AlgorithmSummaryList)).toBe(true);

  await client.send(
    new CreateAlgorithmCommand({
      AlgorithmName: "bunsai-e2e-algo-20",
      TrainingSpecification: {
        TrainingImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/trainer",
        SupportedTrainingInstanceTypes: ["ml.m5.xlarge"],
        TrainingChannels: [],
      },
    }),
  );

  const listed = await client.send(new ListAlgorithmsCommand({}));
  const found = listed.AlgorithmSummaryList!.find(
    (a) => a.AlgorithmName === "bunsai-e2e-algo-20",
  );
  expect(found).toBeDefined();
  expect(found!.AlgorithmArn).toContain("algorithm/bunsai-e2e-algo-20");
});

test("CreateDomain → CreateApp → ListApps includes it", async () => {
  const client = sagemaker();

  const domain = await client.send(
    new CreateDomainCommand({
      DomainName: "bunsai-e2e-domain-20",
      AuthMode: "IAM",
      DefaultUserSettings: {},
      SubnetIds: ["subnet-00000020"],
      VpcId: "vpc-00000020",
    }),
  );
  const domainId = domain.DomainId!;

  await client.send(
    new CreateAppCommand({
      DomainId: domainId,
      AppType: "JupyterServer",
      AppName: "bunsai-e2e-app-20",
    }),
  );

  const listed = await client.send(new ListAppsCommand({}));
  expect(Array.isArray(listed.Apps)).toBe(true);
  const found = listed.Apps!.find((a) => a.AppName === "bunsai-e2e-app-20");
  expect(found).toBeDefined();
  expect(found!.DomainId).toBe(domainId);
  expect(found!.AppType).toBe("JupyterServer");
});

test("CreateAutoMLJob → ListAutoMLJobs → ListCandidatesForAutoMLJob", async () => {
  const client = sagemaker();

  await client.send(
    new CreateAutoMLJobCommand({
      AutoMLJobName: "bunsai-e2e-automl-20",
      InputDataConfig: [
        {
          DataSource: {
            S3DataSource: {
              S3Uri: "s3://bucket/data",
              S3DataType: "S3Prefix",
            },
          },
          TargetAttributeName: "target",
        },
      ],
      OutputDataConfig: { S3OutputPath: "s3://bucket/output" },
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
    }),
  );

  const listed = await client.send(new ListAutoMLJobsCommand({}));
  const found = listed.AutoMLJobSummaries!.find(
    (j) => j.AutoMLJobName === "bunsai-e2e-automl-20",
  );
  expect(found).toBeDefined();
  expect(found!.AutoMLJobArn).toContain("automl-job/");

  const candidates = await client.send(
    new ListCandidatesForAutoMLJobCommand({
      AutoMLJobName: "bunsai-e2e-automl-20",
    }),
  );
  expect(Array.isArray(candidates.Candidates)).toBe(true);
});

test("ListActions empty list", async () => {
  const client = sagemaker();
  const result = await client.send(new ListActionsCommand({}));
  expect(Array.isArray(result.ActionSummaries)).toBe(true);
});

test("ListAppImageConfigs empty list", async () => {
  const client = sagemaker();
  const result = await client.send(new ListAppImageConfigsCommand({}));
  expect(Array.isArray(result.AppImageConfigs)).toBe(true);
});
