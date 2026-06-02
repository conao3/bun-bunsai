import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CodePipelineClient,
  CreatePipelineCommand,
  DeletePipelineCommand,
  GetPipelineCommand,
  ListPipelinesCommand,
  StartPipelineExecutionCommand,
  UpdatePipelineCommand,
} from "@aws-sdk/client-codepipeline";

const awsPort = 4566;
const uiPort = 5666;
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

const codepipeline = () =>
  new CodePipelineClient({ endpoint, region, credentials });

test("CodePipeline pipeline lifecycle roundtrip", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-${Date.now()}`;
  const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-codepipeline";
  const stages = [
    {
      name: "Source",
      actions: [
        {
          name: "Source",
          actionTypeId: {
            category: "Source",
            owner: "AWS",
            provider: "S3",
            version: "1",
          },
          configuration: {
            S3Bucket: "bunsai-e2e-bucket",
            S3ObjectKey: "source.zip",
          },
          outputArtifacts: [{ name: "SourceArtifact" }],
        },
      ],
    },
    {
      name: "Build",
      actions: [
        {
          name: "Build",
          actionTypeId: {
            category: "Build",
            owner: "AWS",
            provider: "CodeBuild",
            version: "1",
          },
          configuration: { ProjectName: "bunsai-e2e-project" },
          inputArtifacts: [{ name: "SourceArtifact" }],
        },
      ],
    },
  ];
  const artifactStore = {
    type: "S3",
    location: "bunsai-e2e-artifacts",
  };

  const created = await client.send(
    new CreatePipelineCommand({
      pipeline: { name, roleArn, artifactStore, stages },
    }),
  );
  expect(created.pipeline?.name).toBe(name);
  expect(created.pipeline?.version).toBe(1);

  const got = await client.send(new GetPipelineCommand({ name }));
  expect(got.pipeline?.name).toBe(name);
  expect(got.pipeline?.roleArn).toBe(roleArn);
  expect(got.metadata?.pipelineArn).toContain(`:${name}`);

  const listed = await client.send(new ListPipelinesCommand({}));
  expect(listed.pipelines?.some((p) => p.name === name)).toBe(true);

  const updated = await client.send(
    new UpdatePipelineCommand({
      pipeline: {
        name,
        roleArn,
        artifactStore,
        stages,
        executionMode: "QUEUED",
      },
    }),
  );
  expect(updated.pipeline?.version).toBe(2);

  const started = await client.send(
    new StartPipelineExecutionCommand({ name }),
  );
  expect(typeof started.pipelineExecutionId).toBe("string");

  await client.send(new DeletePipelineCommand({ name }));

  await expect(client.send(new GetPipelineCommand({ name }))).rejects.toThrow();
});
