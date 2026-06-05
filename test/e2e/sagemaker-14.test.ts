import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddTagsCommand,
  CreateExperimentCommand,
  CreateMlflowTrackingServerCommand,
  CreateProjectCommand,
  CreateTrialCommand,
  DeleteMlflowTrackingServerCommand,
  DeleteProjectCommand,
  DeleteTagsCommand,
  DeleteTrialCommand,
  SageMakerClient,
} from "@aws-sdk/client-sagemaker";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4916;
const uiPort = 5916;
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

test("Trial create and delete lifecycle", async () => {
  const client = sagemaker();

  await client.send(
    new CreateExperimentCommand({ ExperimentName: "bunsai-e2e-exp-14" }),
  );

  const created = await client.send(
    new CreateTrialCommand({
      TrialName: "bunsai-e2e-trial-14",
      ExperimentName: "bunsai-e2e-exp-14",
    }),
  );
  expect(created.TrialArn).toContain("bunsai-e2e-trial-14");

  const deleted = await client.send(
    new DeleteTrialCommand({ TrialName: "bunsai-e2e-trial-14" }),
  );
  expect(deleted.TrialArn).toContain("bunsai-e2e-trial-14");

  await expect(
    client.send(new DeleteTrialCommand({ TrialName: "bunsai-e2e-trial-14" })),
  ).rejects.toThrow();
});

test("Project create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateProjectCommand({ ProjectName: "bunsai-e2e-proj-14" }),
  );
  expect(created.ProjectArn).toContain("bunsai-e2e-proj-14");

  await client.send(
    new DeleteProjectCommand({ ProjectName: "bunsai-e2e-proj-14" }),
  );

  await expect(
    client.send(
      new DeleteProjectCommand({ ProjectName: "bunsai-e2e-proj-14" }),
    ),
  ).rejects.toThrow();
});

test("MlflowTrackingServer create and delete lifecycle", async () => {
  const client = sagemaker();

  const created = await client.send(
    new CreateMlflowTrackingServerCommand({
      TrackingServerName: "bunsai-e2e-mlflow-14",
      ArtifactStoreUri: "s3://bucket/mlflow",
      RoleArn: "arn:aws:iam::123456789012:role/SageMakerRole",
    }),
  );
  expect(created.TrackingServerArn).toContain("bunsai-e2e-mlflow-14");

  const deleted = await client.send(
    new DeleteMlflowTrackingServerCommand({
      TrackingServerName: "bunsai-e2e-mlflow-14",
    }),
  );
  expect(deleted.TrackingServerArn).toContain("bunsai-e2e-mlflow-14");

  await expect(
    client.send(
      new DeleteMlflowTrackingServerCommand({
        TrackingServerName: "bunsai-e2e-mlflow-14",
      }),
    ),
  ).rejects.toThrow();
});

test("DeleteTags removes specified keys", async () => {
  const client = sagemaker();

  const resourceArn =
    "arn:aws:sagemaker:us-east-1:123456789012:experiment/bunsai-e2e-tags-14";

  const added = await client.send(
    new AddTagsCommand({
      ResourceArn: resourceArn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );
  expect(added.Tags).toHaveLength(2);

  await client.send(
    new DeleteTagsCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env"],
    }),
  );

  await client.send(
    new AddTagsCommand({
      ResourceArn: resourceArn,
      Tags: [{ Key: "env", Value: "prod" }],
    }),
  );

  await client.send(
    new DeleteTagsCommand({
      ResourceArn: resourceArn,
      TagKeys: ["env", "owner"],
    }),
  );
});
