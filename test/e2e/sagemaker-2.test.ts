import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateNotebookInstanceCommand,
  CreateTrainingJobCommand,
  DescribeNotebookInstanceCommand,
  DescribeTrainingJobCommand,
  ListNotebookInstancesCommand,
  ListTrainingJobsCommand,
  SageMakerClient,
  StopTrainingJobCommand,
} from "@aws-sdk/client-sagemaker";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4621;
const uiPort = 5721;
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

test("SageMaker training job lifecycle", async () => {
  const client = sagemaker();
  const jobName = "bunsai-e2e-training-job";

  const created = await client.send(
    new CreateTrainingJobCommand({
      TrainingJobName: jobName,
      RoleArn: "arn:aws:iam::000000000000:role/bunsai",
      AlgorithmSpecification: {
        TrainingImage:
          "000000000000.dkr.ecr.us-east-1.amazonaws.com/bunsai:latest",
        TrainingInputMode: "File",
      },
      OutputDataConfig: { S3OutputPath: "s3://bunsai-e2e/output" },
      ResourceConfig: {
        InstanceType: "ml.m5.large",
        InstanceCount: 1,
        VolumeSizeInGB: 10,
      },
      StoppingCondition: { MaxRuntimeInSeconds: 3600 },
    }),
  );
  expect(created.TrainingJobArn).toContain(`training-job/${jobName}`);

  const described = await client.send(
    new DescribeTrainingJobCommand({ TrainingJobName: jobName }),
  );
  expect(described.TrainingJobName).toBe(jobName);
  expect(described.TrainingJobArn).toBe(created.TrainingJobArn);
  expect(described.TrainingJobStatus).toBe("InProgress");
  expect(described.ModelArtifacts?.S3ModelArtifacts).toBeDefined();

  const listed = await client.send(new ListTrainingJobsCommand({}));
  expect(
    (listed.TrainingJobSummaries ?? []).map((j) => j.TrainingJobName),
  ).toContain(jobName);

  await client.send(new StopTrainingJobCommand({ TrainingJobName: jobName }));
  const afterStop = await client.send(
    new DescribeTrainingJobCommand({ TrainingJobName: jobName }),
  );
  expect(afterStop.TrainingJobStatus).toBe("Stopping");
});

test("SageMaker notebook instance lifecycle", async () => {
  const client = sagemaker();
  const instanceName = "bunsai-e2e-notebook";

  const created = await client.send(
    new CreateNotebookInstanceCommand({
      NotebookInstanceName: instanceName,
      InstanceType: "ml.t3.medium",
      RoleArn: "arn:aws:iam::000000000000:role/bunsai",
    }),
  );
  expect(created.NotebookInstanceArn).toContain(
    `notebook-instance/${instanceName}`,
  );

  const described = await client.send(
    new DescribeNotebookInstanceCommand({
      NotebookInstanceName: instanceName,
    }),
  );
  expect(described.NotebookInstanceName).toBe(instanceName);
  expect(described.NotebookInstanceStatus).toBe("InService");
  expect(described.InstanceType).toBe("ml.t3.medium");

  const listed = await client.send(new ListNotebookInstancesCommand({}));
  expect(
    (listed.NotebookInstances ?? []).map((n) => n.NotebookInstanceName),
  ).toContain(instanceName);
});
