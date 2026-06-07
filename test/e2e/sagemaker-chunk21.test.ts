import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateLabelingJobCommand,
  CreateMlflowTrackingServerCommand,
  CreateModelCardCommand,
  CreateModelCardExportJobCommand,
  ListLabelingJobsCommand,
  ListLabelingJobsForWorkteamCommand,
  ListLineageGroupsCommand,
  ListMlflowTrackingServersCommand,
  ListModelCardVersionsCommand,
  ListModelCardsCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("ListModelCards empty then CreateModelCard → listed", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListModelCardsCommand({}));
  expect(empty.ModelCardSummaries).toBeDefined();

  await client.send(
    new CreateModelCardCommand({
      ModelCardName: "bunsai-e2e-mc-21",
      ModelCardStatus: "Draft",
      Content: "{}",
    }),
  );

  const listed = await client.send(new ListModelCardsCommand({}));
  const found = listed.ModelCardSummaries!.find(
    (c) => c.ModelCardName === "bunsai-e2e-mc-21",
  );
  expect(found).toBeDefined();
  expect(found!.ModelCardArn).toContain("model-card/bunsai-e2e-mc-21");
  expect(found!.ModelCardStatus).toBe("Draft");
});

test("ListModelCardVersions returns version for existing card", async () => {
  const client = sagemaker();

  await client.send(
    new CreateModelCardCommand({
      ModelCardName: "bunsai-e2e-mcv-21",
      ModelCardStatus: "Draft",
      Content: "{}",
    }),
  );

  const listed = await client.send(
    new ListModelCardVersionsCommand({ ModelCardName: "bunsai-e2e-mcv-21" }),
  );
  expect(listed.ModelCardVersionSummaryList).toBeDefined();
  expect(listed.ModelCardVersionSummaryList!.length).toBe(1);
  expect(listed.ModelCardVersionSummaryList![0].ModelCardVersion).toBe(1);
  expect(listed.ModelCardVersionSummaryList![0].ModelCardName).toBe(
    "bunsai-e2e-mcv-21",
  );
});

test("CreateModelCardExportJob → listed under ModelCardName", async () => {
  const client = sagemaker();

  await client.send(
    new CreateModelCardCommand({
      ModelCardName: "bunsai-e2e-mcex-21",
      ModelCardStatus: "Draft",
      Content: "{}",
    }),
  );

  await client.send(
    new CreateModelCardExportJobCommand({
      ModelCardName: "bunsai-e2e-mcex-21",
      ModelCardExportJobName: "bunsai-e2e-mcexj-21",
      OutputConfig: {
        S3OutputPath: "s3://bunsai-bucket/exports/",
      },
    }),
  );

  const listed = await client.send(new ListModelCardsCommand({}));
  const card = listed.ModelCardSummaries!.find(
    (c) => c.ModelCardName === "bunsai-e2e-mcex-21",
  );
  expect(card).toBeDefined();
});

test("CreateMlflowTrackingServer → ListMlflowTrackingServers includes it", async () => {
  const client = sagemaker();

  const empty = await client.send(new ListMlflowTrackingServersCommand({}));
  expect(empty.TrackingServerSummaries).toBeDefined();

  await client.send(
    new CreateMlflowTrackingServerCommand({
      TrackingServerName: "bunsai-e2e-ts-21",
      ArtifactStoreUri: "s3://bunsai-bucket/mlflow/",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
    }),
  );

  const listed = await client.send(new ListMlflowTrackingServersCommand({}));
  const found = listed.TrackingServerSummaries!.find(
    (s) => s.TrackingServerName === "bunsai-e2e-ts-21",
  );
  expect(found).toBeDefined();
  expect(found!.TrackingServerArn).toContain(
    "mlflow-tracking-server/bunsai-e2e-ts-21",
  );
});

test("CreateLabelingJob → ListLabelingJobs includes it", async () => {
  const client = sagemaker();

  await client.send(
    new CreateLabelingJobCommand({
      LabelingJobName: "bunsai-e2e-lj-21",
      LabelAttributeName: "label",
      InputConfig: {
        DataSource: {
          S3DataSource: { ManifestS3Uri: "s3://bunsai-bucket/manifest.json" },
        },
      },
      OutputConfig: { S3OutputPath: "s3://bunsai-bucket/output/" },
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-role",
      HumanTaskConfig: {
        WorkteamArn:
          "arn:aws:sagemaker:us-east-1:123456789012:workteam/private-crowd/test",
        UiConfig: {
          UiTemplateS3Uri: "s3://bunsai-bucket/template.html",
        },
        PreHumanTaskLambdaArn:
          "arn:aws:lambda:us-east-1:432418664414:function:PRE-BoundingBox",
        TaskTitle: "Labeling task",
        TaskDescription: "Label the data",
        NumberOfHumanWorkersPerDataObject: 1,
        TaskTimeLimitInSeconds: 3600,
        AnnotationConsolidationConfig: {
          AnnotationConsolidationLambdaArn:
            "arn:aws:lambda:us-east-1:432418664414:function:ACS-BoundingBox",
        },
      },
    }),
  );

  const listed = await client.send(new ListLabelingJobsCommand({}));
  const found = listed.LabelingJobSummaryList!.find(
    (j) => j.LabelingJobName === "bunsai-e2e-lj-21",
  );
  expect(found).toBeDefined();
  expect(found!.LabelingJobArn).toContain("labeling-job/bunsai-e2e-lj-21");
  expect(found!.LabelingJobStatus).toBe("InProgress");
});

test("ListLabelingJobsForWorkteam returns list", async () => {
  const client = sagemaker();
  const listed = await client.send(
    new ListLabelingJobsForWorkteamCommand({
      WorkteamArn:
        "arn:aws:sagemaker:us-east-1:123456789012:workteam/private-crowd/test",
    }),
  );
  expect(listed.LabelingJobSummaryList).toBeDefined();
});

test("ListLineageGroups returns empty list", async () => {
  const client = sagemaker();
  const listed = await client.send(new ListLineageGroupsCommand({}));
  expect(listed.LineageGroupSummaries).toBeDefined();
});
