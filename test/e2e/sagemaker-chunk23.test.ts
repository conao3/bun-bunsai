import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddTagsCommand,
  CreateDomainCommand,
  CreateExperimentCommand,
  CreateProjectCommand,
  CreateSpaceCommand,
  CreateStudioLifecycleConfigCommand,
  CreateTrainingPlanCommand,
  CreateTransformJobCommand,
  CreateTrialCommand,
  CreateTrialComponentCommand,
  ListProjectsCommand,
  ListResourceCatalogsCommand,
  ListSpacesCommand,
  ListStudioLifecycleConfigsCommand,
  ListSubscribedWorkteamsCommand,
  ListTagsCommand,
  ListTrainingPlansCommand,
  ListTransformJobsCommand,
  ListTrialComponentsCommand,
  ListTrialsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("CreateProject → ListProjects includes it", async () => {
  const client = sagemaker();
  const projectName = `proj-chunk23-${Date.now()}`;
  await client.send(new CreateProjectCommand({ ProjectName: projectName }));
  const res = await client.send(new ListProjectsCommand({}));
  expect(res.ProjectSummaryList).toBeDefined();
  expect(Array.isArray(res.ProjectSummaryList)).toBe(true);
  const found = res.ProjectSummaryList!.find(
    (p) => p.ProjectName === projectName,
  );
  expect(found).toBeDefined();
  expect(found!.ProjectArn).toBeTruthy();
});

test("ListProjects NameContains filter", async () => {
  const client = sagemaker();
  const projectName = `proj-filter-chunk23-${Date.now()}`;
  await client.send(new CreateProjectCommand({ ProjectName: projectName }));
  const res = await client.send(
    new ListProjectsCommand({ NameContains: "filter-chunk23" }),
  );
  expect(
    res.ProjectSummaryList!.every((p) =>
      p.ProjectName!.includes("filter-chunk23"),
    ),
  ).toBe(true);
});

test("ListResourceCatalogs returns empty list", async () => {
  const client = sagemaker();
  const res = await client.send(new ListResourceCatalogsCommand({}));
  expect(Array.isArray(res.ResourceCatalogs)).toBe(true);
  expect(res.ResourceCatalogs!.length).toBe(0);
});

test("CreateDomain + CreateSpace → ListSpaces includes it", async () => {
  const client = sagemaker();
  const domainRes = await client.send(
    new CreateDomainCommand({
      DomainName: `domain-chunk23-${Date.now()}`,
      AuthMode: "IAM",
      DefaultUserSettings: {},
    }),
  );
  const domainId = domainRes.DomainId!;
  const spaceName = `space-chunk23-${Date.now()}`;
  await client.send(
    new CreateSpaceCommand({ DomainId: domainId, SpaceName: spaceName }),
  );
  const res = await client.send(
    new ListSpacesCommand({ DomainIdEquals: domainId }),
  );
  expect(Array.isArray(res.Spaces)).toBe(true);
  const found = res.Spaces!.find((s) => s.SpaceName === spaceName);
  expect(found).toBeDefined();
  expect(found!.DomainId).toBe(domainId);
});

test("ListSubscribedWorkteams returns empty list", async () => {
  const client = sagemaker();
  const res = await client.send(new ListSubscribedWorkteamsCommand({}));
  expect(Array.isArray(res.SubscribedWorkteams)).toBe(true);
  expect(res.SubscribedWorkteams!.length).toBe(0);
});

test("AddTags → ListTags round-trip", async () => {
  const client = sagemaker();
  const projectName = `proj-tags-chunk23-${Date.now()}`;
  const createRes = await client.send(
    new CreateProjectCommand({ ProjectName: projectName }),
  );
  const arn = createRes.ProjectArn!;
  await client.send(
    new AddTagsCommand({
      ResourceArn: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "ml" },
      ],
    }),
  );
  const res = await client.send(new ListTagsCommand({ ResourceArn: arn }));
  expect(Array.isArray(res.Tags)).toBe(true);
  expect(res.Tags!.length).toBe(2);
  expect(res.Tags!.find((t) => t.Key === "env")?.Value).toBe("test");
  expect(res.Tags!.find((t) => t.Key === "team")?.Value).toBe("ml");
});

test("CreateStudioLifecycleConfig → ListStudioLifecycleConfigs includes it", async () => {
  const client = sagemaker();
  const name = `slc-chunk23-${Date.now()}`;
  await client.send(
    new CreateStudioLifecycleConfigCommand({
      StudioLifecycleConfigName: name,
      StudioLifecycleConfigAppType: "JupyterServer",
      StudioLifecycleConfigContent: "IyBzY3JpcHQ=",
    }),
  );
  const res = await client.send(new ListStudioLifecycleConfigsCommand({}));
  expect(Array.isArray(res.StudioLifecycleConfigs)).toBe(true);
  const found = res.StudioLifecycleConfigs!.find(
    (c) => c.StudioLifecycleConfigName === name,
  );
  expect(found).toBeDefined();
  expect(found!.StudioLifecycleConfigAppType).toBe("JupyterServer");
});

test("CreateTrainingPlan → ListTrainingPlans includes it", async () => {
  const client = sagemaker();
  const name = `tp-chunk23-${Date.now()}`;
  await client.send(
    new CreateTrainingPlanCommand({
      TrainingPlanName: name,
      TrainingPlanOfferingId: "offering-test-id",
    }),
  );
  const res = await client.send(new ListTrainingPlansCommand({}));
  expect(Array.isArray(res.TrainingPlanSummaries)).toBe(true);
  const found = res.TrainingPlanSummaries!.find(
    (p) => p.TrainingPlanName === name,
  );
  expect(found).toBeDefined();
  expect(found!.TrainingPlanArn).toBeTruthy();
});

test("CreateTransformJob → ListTransformJobs includes it", async () => {
  const client = sagemaker();
  const name = `tj-chunk23-${Date.now()}`;
  await client.send(
    new CreateTransformJobCommand({
      TransformJobName: name,
      ModelName: "my-model",
      TransformInput: {
        DataSource: {
          S3DataSource: { S3DataType: "S3Prefix", S3Uri: "s3://bucket/input" },
        },
      },
      TransformOutput: { S3OutputPath: "s3://bucket/output" },
      TransformResources: { InstanceType: "ml.m5.large", InstanceCount: 1 },
    }),
  );
  const res = await client.send(new ListTransformJobsCommand({}));
  expect(Array.isArray(res.TransformJobSummaries)).toBe(true);
  const found = res.TransformJobSummaries!.find(
    (j) => j.TransformJobName === name,
  );
  expect(found).toBeDefined();
  expect(found!.TransformJobStatus).toBe("InProgress");
});

test("CreateTrial → ListTrials includes it; ExperimentName filter works", async () => {
  const client = sagemaker();
  const expName = `exp-chunk23-${Date.now()}`;
  await client.send(new CreateExperimentCommand({ ExperimentName: expName }));
  const trialName = `trial-chunk23-${Date.now()}`;
  await client.send(
    new CreateTrialCommand({ TrialName: trialName, ExperimentName: expName }),
  );
  const all = await client.send(new ListTrialsCommand({}));
  expect(Array.isArray(all.TrialSummaries)).toBe(true);
  const found = all.TrialSummaries!.find((t) => t.TrialName === trialName);
  expect(found).toBeDefined();
  expect(found!.TrialArn).toBeTruthy();

  const filtered = await client.send(
    new ListTrialsCommand({ ExperimentName: expName }),
  );
  expect(Array.isArray(filtered.TrialSummaries)).toBe(true);
  expect(
    filtered.TrialSummaries!.find((t) => t.TrialName === trialName),
  ).toBeDefined();
});

test("CreateTrialComponent → ListTrialComponents includes it", async () => {
  const client = sagemaker();
  const name = `tc-chunk23-${Date.now()}`;
  await client.send(
    new CreateTrialComponentCommand({ TrialComponentName: name }),
  );
  const res = await client.send(new ListTrialComponentsCommand({}));
  expect(Array.isArray(res.TrialComponentSummaries)).toBe(true);
  const found = res.TrialComponentSummaries!.find(
    (c) => c.TrialComponentName === name,
  );
  expect(found).toBeDefined();
  expect(found!.TrialComponentArn).toBeTruthy();
});
