import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateActionCommand,
  CreateArtifactCommand,
  CreateTrialCommand,
  CreateTrialComponentCommand,
  DeleteActionCommand,
  DeleteArtifactCommand,
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

test("CreateTrial returns TrialArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateTrialCommand({
      TrialName: "bunsai-e2e-trial",
      ExperimentName: "bunsai-e2e-experiment",
      DisplayName: "Bunsai E2E Trial",
    }),
  );
  expect(result.TrialArn).toBeDefined();
  expect(result.TrialArn).toContain("experiment-trial/bunsai-e2e-trial");
});

test("CreateTrialComponent returns TrialComponentArn", async () => {
  const client = sagemaker();
  const result = await client.send(
    new CreateTrialComponentCommand({
      TrialComponentName: "bunsai-e2e-trial-component",
      DisplayName: "Bunsai E2E Trial Component",
    }),
  );
  expect(result.TrialComponentArn).toBeDefined();
  expect(result.TrialComponentArn).toContain(
    "experiment-trial-component/bunsai-e2e-trial-component",
  );
});

test("CreateAction → DeleteAction lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateActionCommand({
      ActionName: "bunsai-e2e-action",
      ActionType: "ModelDeployment",
      Source: {
        SourceUri: "s3://bunsai/action-source",
        SourceType: "S3Uri",
      },
      Description: "e2e test action",
    }),
  );

  expect(created.ActionArn).toBeDefined();
  expect(created.ActionArn).toContain("action/bunsai-e2e-action");

  const deleted = await client.send(
    new DeleteActionCommand({
      ActionName: "bunsai-e2e-action",
    }),
  );

  expect(deleted.ActionArn).toContain("action/bunsai-e2e-action");
  expect(deleted.$metadata.httpStatusCode).toBe(200);
});

test("CreateAction duplicate throws ResourceInUse", async () => {
  const client = sagemaker();

  await client.send(
    new CreateActionCommand({
      ActionName: "bunsai-e2e-action-dup",
      ActionType: "ModelDeployment",
      Source: { SourceUri: "s3://bunsai/dup", SourceType: "S3Uri" },
    }),
  );

  await expect(
    client.send(
      new CreateActionCommand({
        ActionName: "bunsai-e2e-action-dup",
        ActionType: "ModelDeployment",
        Source: { SourceUri: "s3://bunsai/dup", SourceType: "S3Uri" },
      }),
    ),
  ).rejects.toThrow();
});

test("DeleteAction not-found throws ResourceNotFound", async () => {
  const client = sagemaker();

  await expect(
    client.send(
      new DeleteActionCommand({
        ActionName: "bunsai-e2e-action-missing",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateArtifact → DeleteArtifact lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateArtifactCommand({
      ArtifactName: "bunsai-e2e-artifact",
      ArtifactType: "DataSet",
      Source: {
        SourceUri: "s3://bunsai/artifact-source",
        SourceTypes: [{ SourceIdType: "S3ETag", SourceId: "abc123" }],
      },
    }),
  );

  expect(created.ArtifactArn).toBeDefined();
  expect(created.ArtifactArn).toContain("artifact/");

  const artifactArn = created.ArtifactArn!;

  const deleted = await client.send(
    new DeleteArtifactCommand({
      ArtifactArn: artifactArn,
    }),
  );

  expect(deleted.ArtifactArn).toBe(artifactArn);
  expect(deleted.$metadata.httpStatusCode).toBe(200);
});
