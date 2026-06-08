import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateModelCardCommand,
  CreateMonitoringScheduleCommand,
  CreateMlflowTrackingServerCommand,
  CreateNotebookInstanceCommand,
  DescribeModelCardCommand,
  DescribeMlflowTrackingServerCommand,
  DescribeMonitoringScheduleCommand,
  DescribeNotebookInstanceCommand,
  SageMakerClient,
  UpdateModelCardCommand,
  UpdateMlflowTrackingServerCommand,
  UpdateMonitoringScheduleCommand,
  UpdateNotebookInstanceCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("UpdateNotebookInstance → DescribeNotebookInstance reflects update", async () => {
  const client = sagemaker();
  const name = `nb-chunk29-${Date.now()}`;

  const created = await client.send(
    new CreateNotebookInstanceCommand({
      NotebookInstanceName: name,
      InstanceType: "ml.t2.medium",
      RoleArn: "arn:aws:iam::123456789012:role/original-role",
    }),
  );
  expect(created.NotebookInstanceArn).toContain("notebook-instance");

  await client.send(
    new UpdateNotebookInstanceCommand({
      NotebookInstanceName: name,
      InstanceType: "ml.t3.medium",
      RoleArn: "arn:aws:iam::123456789012:role/updated-role",
    }),
  );

  const described = await client.send(
    new DescribeNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  expect(described.NotebookInstanceName).toBe(name);
  expect(described.InstanceType).toBe("ml.t3.medium");
  expect(described.RoleArn).toBe("arn:aws:iam::123456789012:role/updated-role");
});

test("UpdateModelCard → DescribeModelCard reflects update", async () => {
  const client = sagemaker();
  const name = `mc-chunk29-${Date.now()}`;

  const created = await client.send(
    new CreateModelCardCommand({
      ModelCardName: name,
      ModelCardStatus: "Draft",
      Content: JSON.stringify({ model_overview: { model_id: "original" } }),
    }),
  );
  expect(created.ModelCardArn).toContain("model-card");

  const updated = await client.send(
    new UpdateModelCardCommand({
      ModelCardName: name,
      ModelCardStatus: "PendingReview",
      Content: JSON.stringify({ model_overview: { model_id: "updated" } }),
    }),
  );
  expect(updated.ModelCardArn).toContain("model-card");

  const described = await client.send(
    new DescribeModelCardCommand({ ModelCardName: name }),
  );
  expect(described.ModelCardName).toBe(name);
  expect(described.ModelCardStatus).toBe("PendingReview");
  expect(described.ModelCardVersion).toBe(2);
});

test("UpdateMlflowTrackingServer → DescribeMlflowTrackingServer reflects update", async () => {
  const client = sagemaker();
  const name = `mlts-chunk29-${Date.now()}`;

  await client.send(
    new CreateMlflowTrackingServerCommand({
      TrackingServerName: name,
      ArtifactStoreUri: "s3://original-bucket/prefix",
      RoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );

  const updated = await client.send(
    new UpdateMlflowTrackingServerCommand({
      TrackingServerName: name,
      ArtifactStoreUri: "s3://updated-bucket/prefix",
      TrackingServerSize: "Medium",
    }),
  );
  expect(updated.TrackingServerArn).toContain("mlflow-tracking-server");

  const described = await client.send(
    new DescribeMlflowTrackingServerCommand({ TrackingServerName: name }),
  );
  expect(described.TrackingServerName).toBe(name);
  expect(described.ArtifactStoreUri).toBe("s3://updated-bucket/prefix");
  expect(described.TrackingServerSize).toBe("Medium");
});

test("UpdateMonitoringSchedule → DescribeMonitoringSchedule reflects update", async () => {
  const client = sagemaker();
  const name = `ms-chunk29-${Date.now()}`;

  await client.send(
    new CreateMonitoringScheduleCommand({
      MonitoringScheduleName: name,
      MonitoringScheduleConfig: {
        MonitoringType: "DataQuality",
      },
    }),
  );

  const updated = await client.send(
    new UpdateMonitoringScheduleCommand({
      MonitoringScheduleName: name,
      MonitoringScheduleConfig: {
        MonitoringType: "ModelQuality",
      },
    }),
  );
  expect(updated.MonitoringScheduleArn).toContain("monitoring-schedule");

  const described = await client.send(
    new DescribeMonitoringScheduleCommand({
      MonitoringScheduleName: name,
    }),
  );
  expect(described.MonitoringScheduleName).toBe(name);
  const config = described.MonitoringScheduleConfig as
    | { MonitoringType?: string }
    | undefined;
  expect(config?.MonitoringType).toBe("ModelQuality");
});

test("UpdateMlflowTrackingServer → ResourceNotFound for missing server", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new UpdateMlflowTrackingServerCommand({
        TrackingServerName: "no-such-server-chunk29",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFound" });
});

test("UpdateModelCard → ResourceNotFound for missing card", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new UpdateModelCardCommand({
        ModelCardName: "no-such-card-chunk29",
        ModelCardStatus: "Draft",
      }),
    ),
  ).rejects.toMatchObject({ name: "ValidationException" });
});
