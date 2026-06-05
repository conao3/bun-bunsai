import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateExperimentCommand,
  CreateHubCommand,
  CreateImageCommand,
  CreateImageVersionCommand,
  DeleteExperimentCommand,
  DeleteHubCommand,
  DeleteImageCommand,
  DeleteImageVersionCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4915;
const uiPort = 5915;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const sagemaker = () =>
  new SageMakerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("CreateExperiment → DeleteExperiment lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateExperimentCommand({
      ExperimentName: "bunsai-e2e-experiment",
      DisplayName: "Bunsai E2E Experiment",
      Description: "e2e test experiment",
    }),
  );

  expect(created.ExperimentArn).toBeDefined();
  expect(created.ExperimentArn).toContain("experiment/bunsai-e2e-experiment");

  const deleted = await client.send(
    new DeleteExperimentCommand({
      ExperimentName: "bunsai-e2e-experiment",
    }),
  );

  expect(deleted.ExperimentArn).toContain("experiment/bunsai-e2e-experiment");
  expect(deleted.$metadata.httpStatusCode).toBe(200);
});

test("DeleteExperiment not-found throws ResourceNotFound", async () => {
  const client = sagemaker();

  await expect(
    client.send(
      new DeleteExperimentCommand({
        ExperimentName: "bunsai-e2e-experiment-missing",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateHub → DeleteHub lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateHubCommand({
      HubName: "bunsai-e2e-hub",
      HubDescription: "e2e test hub",
      HubDisplayName: "Bunsai E2E Hub",
    }),
  );

  expect(created.HubArn).toBeDefined();
  expect(created.HubArn).toContain("hub/bunsai-e2e-hub");

  const deleted = await client.send(
    new DeleteHubCommand({
      HubName: "bunsai-e2e-hub",
    }),
  );

  expect(deleted.$metadata.httpStatusCode).toBe(200);
});

test("DeleteHub not-found throws ResourceNotFound", async () => {
  const client = sagemaker();

  await expect(
    client.send(
      new DeleteHubCommand({
        HubName: "bunsai-e2e-hub-missing",
      }),
    ),
  ).rejects.toThrow();
});

test("CreateImage → CreateImageVersion → DeleteImageVersion → DeleteImage lifecycle", async () => {
  const client = sagemaker();

  const imageCreated = await client.send(
    new CreateImageCommand({
      ImageName: "bunsai-e2e-image",
      RoleArn: "arn:aws:iam::123456789012:role/bunsai-e2e-role",
      Description: "e2e test image",
    }),
  );

  expect(imageCreated.ImageArn).toBeDefined();
  expect(imageCreated.ImageArn).toContain("image/bunsai-e2e-image");

  const versionCreated = await client.send(
    new CreateImageVersionCommand({
      ImageName: "bunsai-e2e-image",
      BaseImage: "123456789012.dkr.ecr.us-east-1.amazonaws.com/base:latest",
      ClientToken: "bunsai-e2e-token",
    }),
  );

  expect(versionCreated.ImageVersionArn).toBeDefined();
  expect(versionCreated.ImageVersionArn).toContain(
    "image-version/bunsai-e2e-image/1",
  );

  const versionDeleted = await client.send(
    new DeleteImageVersionCommand({
      ImageName: "bunsai-e2e-image",
      Version: 1,
    }),
  );

  expect(versionDeleted.$metadata.httpStatusCode).toBe(200);

  const imageDeleted = await client.send(
    new DeleteImageCommand({
      ImageName: "bunsai-e2e-image",
    }),
  );

  expect(imageDeleted.$metadata.httpStatusCode).toBe(200);
});

test("DeleteImage not-found throws ResourceNotFound", async () => {
  const client = sagemaker();

  await expect(
    client.send(
      new DeleteImageCommand({
        ImageName: "bunsai-e2e-image-missing",
      }),
    ),
  ).rejects.toThrow();
});
