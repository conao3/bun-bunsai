import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateExperimentCommand,
  CreateImageCommand,
  CreateImageVersionCommand,
  DeleteExperimentCommand,
  DeleteImageCommand,
  DeleteImageVersionCommand,
  DescribeExperimentCommand,
  DescribeImageCommand,
  DescribeImageVersionCommand,
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

test("CreateExperiment → DescribeExperiment → DeleteExperiment lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateExperimentCommand({
      ExperimentName: "bunsai-e2e-experiment-16",
      DisplayName: "Bunsai E2E Experiment 16",
      Description: "e2e test experiment chunk 14",
    }),
  );

  expect(created.ExperimentArn).toBeDefined();
  expect(created.ExperimentArn).toContain(
    "experiment/bunsai-e2e-experiment-16",
  );

  const described = await client.send(
    new DescribeExperimentCommand({
      ExperimentName: "bunsai-e2e-experiment-16",
    }),
  );

  expect(described.ExperimentName).toBe("bunsai-e2e-experiment-16");
  expect(described.ExperimentArn).toContain(
    "experiment/bunsai-e2e-experiment-16",
  );
  expect(described.DisplayName).toBe("Bunsai E2E Experiment 16");
  expect(described.Description).toBe("e2e test experiment chunk 14");
  expect(described.CreationTime).toBeDefined();
  expect(described.LastModifiedTime).toBeDefined();

  const deleted = await client.send(
    new DeleteExperimentCommand({
      ExperimentName: "bunsai-e2e-experiment-16",
    }),
  );

  expect(deleted.ExperimentArn).toContain(
    "experiment/bunsai-e2e-experiment-16",
  );

  await expect(
    client.send(
      new DescribeExperimentCommand({
        ExperimentName: "bunsai-e2e-experiment-16",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateImage → DescribeImage → CreateImageVersion → DescribeImageVersion → cleanup", async () => {
  const client = sagemaker();

  const imageCreated = await client.send(
    new CreateImageCommand({
      ImageName: "bunsai-e2e-image-16",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
      Description: "e2e test image chunk 14",
      DisplayName: "Bunsai E2E Image 16",
    }),
  );

  expect(imageCreated.ImageArn).toBeDefined();
  expect(imageCreated.ImageArn).toContain("image/bunsai-e2e-image-16");

  const imageDescribed = await client.send(
    new DescribeImageCommand({ ImageName: "bunsai-e2e-image-16" }),
  );

  expect(imageDescribed.ImageName).toBe("bunsai-e2e-image-16");
  expect(imageDescribed.ImageArn).toContain("image/bunsai-e2e-image-16");
  expect(imageDescribed.RoleArn).toBe(
    "arn:aws:iam::123456789012:role/bunsai-e2e-role",
  );
  expect(imageDescribed.Description).toBe("e2e test image chunk 14");
  expect(imageDescribed.DisplayName).toBe("Bunsai E2E Image 16");
  expect(imageDescribed.CreationTime).toBeDefined();

  const versionCreated = await client.send(
    new CreateImageVersionCommand({
      ImageName: "bunsai-e2e-image-16",
      BaseImage:
        "123456789012.dkr.ecr.us-east-1.amazonaws.com/bunsai-base:latest",
      ClientToken: "bunsai-e2e-token-16",
    }),
  );

  expect(versionCreated.ImageVersionArn).toBeDefined();
  expect(versionCreated.ImageVersionArn).toContain(
    "image-version/bunsai-e2e-image-16/1",
  );

  const versionDescribed = await client.send(
    new DescribeImageVersionCommand({
      ImageName: "bunsai-e2e-image-16",
      Version: 1,
    }),
  );

  expect(versionDescribed.ImageVersionArn).toContain(
    "image-version/bunsai-e2e-image-16/1",
  );
  expect(versionDescribed.Version).toBe(1);
  expect(versionDescribed.BaseImage).toBe(
    "123456789012.dkr.ecr.us-east-1.amazonaws.com/bunsai-base:latest",
  );
  expect(versionDescribed.CreationTime).toBeDefined();

  await client.send(
    new DeleteImageVersionCommand({
      ImageName: "bunsai-e2e-image-16",
      Version: 1,
    }),
  );

  await client.send(
    new DeleteImageCommand({ ImageName: "bunsai-e2e-image-16" }),
  );

  await expect(
    client.send(new DescribeImageCommand({ ImageName: "bunsai-e2e-image-16" })),
  ).rejects.toThrow();
});
