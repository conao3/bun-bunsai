import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateMlflowTrackingServerCommand,
  CreateProjectCommand,
  DescribeMlflowTrackingServerCommand,
  DescribeProjectCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("CreateProject → DescribeProject lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateProjectCommand({
      ProjectName: "bunsai-e2e-project-17",
      ProjectDescription: "e2e test project chunk 15",
    }),
  );

  expect(created.ProjectArn).toBeDefined();
  expect(created.ProjectArn).toContain("project/bunsai-e2e-project-17");
  expect(created.ProjectId).toBeDefined();

  const described = await client.send(
    new DescribeProjectCommand({ ProjectName: "bunsai-e2e-project-17" }),
  );

  expect(described.ProjectName).toBe("bunsai-e2e-project-17");
  expect(described.ProjectArn).toContain("project/bunsai-e2e-project-17");
  expect(described.ProjectDescription).toBe("e2e test project chunk 15");
  expect(described.ProjectStatus).toBe("Pending");
  expect(described.CreationTime).toBeDefined();

  await expect(
    client.send(
      new DescribeProjectCommand({ ProjectName: "bunsai-e2e-project-17-nope" }),
    ),
  ).rejects.toThrow();
});

test("CreateMlflowTrackingServer �� DescribeMlflowTrackingServer lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateMlflowTrackingServerCommand({
      TrackingServerName: "bunsai-e2e-mlflow-17",
      ArtifactStoreUri: "s3://bunsai-e2e-bucket/mlflow",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
      TrackingServerSize: "Small",
      MlflowVersion: "2.13.0",
    }),
  );

  expect(created.TrackingServerArn).toBeDefined();
  expect(created.TrackingServerArn).toContain(
    "mlflow-tracking-server/bunsai-e2e-mlflow-17",
  );

  const described = await client.send(
    new DescribeMlflowTrackingServerCommand({
      TrackingServerName: "bunsai-e2e-mlflow-17",
    }),
  );

  expect(described.TrackingServerName).toBe("bunsai-e2e-mlflow-17");
  expect(described.TrackingServerArn).toContain(
    "mlflow-tracking-server/bunsai-e2e-mlflow-17",
  );
  expect(described.ArtifactStoreUri).toBe("s3://bunsai-e2e-bucket/mlflow");
  expect(described.RoleArn).toBe(
    "arn:aws:iam::123456789012:role/bunsai-e2e-role",
  );
  expect(described.TrackingServerSize).toBe("Small");
  expect(described.MlflowVersion).toBe("2.13.0");
  expect(described.TrackingServerStatus).toBe("Created");
  expect(described.CreationTime).toBeDefined();

  await expect(
    client.send(
      new DescribeMlflowTrackingServerCommand({
        TrackingServerName: "bunsai-e2e-mlflow-17-nope",
      }),
    ),
  ).rejects.toThrow();
});
