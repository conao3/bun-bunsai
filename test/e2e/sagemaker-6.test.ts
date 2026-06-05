import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateFeatureGroupCommand,
  CreateHubCommand,
  CreateHubContentPresignedUrlsCommand,
  CreateHubContentReferenceCommand,
  CreateImageCommand,
  CreateImageVersionCommand,
  CreateMonitoringScheduleCommand,
  DeleteFeatureGroupCommand,
  DeleteMonitoringScheduleCommand,
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

test("SageMaker feature-group create → delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateFeatureGroupCommand({
      FeatureGroupName: "bunsai-e2e-fg",
      RecordIdentifierFeatureName: "record-id",
      EventTimeFeatureName: "event-time",
      FeatureDefinitions: [
        { FeatureName: "record-id", FeatureType: "String" },
        { FeatureName: "event-time", FeatureType: "String" },
        { FeatureName: "value", FeatureType: "Fractional" },
      ],
      OnlineStoreConfig: { EnableOnlineStore: true },
    }),
  );
  expect(created.FeatureGroupArn).toContain("feature-group/bunsai-e2e-fg");

  await client.send(
    new DeleteFeatureGroupCommand({ FeatureGroupName: "bunsai-e2e-fg" }),
  );
});

test("SageMaker hub create and hub-content operations", async () => {
  const client = sagemaker();

  const createdHub = await client.send(
    new CreateHubCommand({
      HubName: "bunsai-e2e-hub",
      HubDescription: "E2E test hub",
      HubDisplayName: "BunSai E2E Hub",
    }),
  );
  expect(createdHub.HubArn).toContain("hub/bunsai-e2e-hub");

  const presigned = await client.send(
    new CreateHubContentPresignedUrlsCommand({
      HubName: "bunsai-e2e-hub",
      HubContentType: "Model",
      HubContentName: "bunsai-e2e-model",
    }),
  );
  expect(presigned.AuthorizedUrlConfigs).toBeDefined();
  expect(presigned.AuthorizedUrlConfigs!.length).toBeGreaterThan(0);
  expect(presigned.AuthorizedUrlConfigs![0].Url).toContain("bunsai-e2e-hub");

  const reference = await client.send(
    new CreateHubContentReferenceCommand({
      HubName: "bunsai-e2e-hub",
      SageMakerPublicHubContentArn:
        "arn:aws:sagemaker:us-east-1::hub-content/SageMakerPublicHub/Model/meta-textgeneration-llama-2-7b/1.0.0",
      HubContentName: "llama-2-7b",
    }),
  );
  expect(reference.HubArn).toContain("hub/bunsai-e2e-hub");
  expect(reference.HubContentArn).toContain("hub-content/bunsai-e2e-hub");
});

test("SageMaker image and image-version lifecycle", async () => {
  const client = sagemaker();

  const createdImage = await client.send(
    new CreateImageCommand({
      ImageName: "bunsai-e2e-image",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
      Description: "E2E test image",
    }),
  );
  expect(createdImage.ImageArn).toContain("image/bunsai-e2e-image");

  const createdVersion = await client.send(
    new CreateImageVersionCommand({
      ImageName: "bunsai-e2e-image",
      BaseImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/myimage:latest",
      ClientToken: "bunsai-e2e-token-1",
    }),
  );
  expect(createdVersion.ImageVersionArn).toContain(
    "image-version/bunsai-e2e-image/1",
  );
});

test("SageMaker monitoring-schedule create → delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateMonitoringScheduleCommand({
      MonitoringScheduleName: "bunsai-e2e-schedule",
      MonitoringScheduleConfig: {
        MonitoringType: "DataQuality",
        ScheduleConfig: { ScheduleExpression: "cron(0 * ? * * *)" },
      },
    }),
  );
  expect(created.MonitoringScheduleArn).toContain(
    "monitoring-schedule/bunsai-e2e-schedule",
  );

  await client.send(
    new DeleteMonitoringScheduleCommand({
      MonitoringScheduleName: "bunsai-e2e-schedule",
    }),
  );
});
