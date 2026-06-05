import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateActionCommand,
  CreateArtifactCommand,
  CreateTrialCommand,
  CreateTrialComponentCommand,
  DeleteActionCommand,
  DeleteArtifactCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4913;
const uiPort = 5913;
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
