import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateMonitoringScheduleCommand,
  CreateNotebookInstanceCommand,
  CreatePipelineCommand,
  DescribeNotebookInstanceCommand,
  DescribePipelineExecutionCommand,
  ListPipelineExecutionsCommand,
  SageMakerClient,
  StartMonitoringScheduleCommand,
  StartNotebookInstanceCommand,
  StartPipelineExecutionCommand,
} from "@aws-sdk/client-sagemaker";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sagemaker = () =>
  new SageMakerClient({ endpoint, region, credentials, requestHandler });

test("StartNotebookInstance → DescribeNotebookInstance Status=InService", async () => {
  const client = sagemaker();
  const name = `nb-chunk25-${Date.now()}`;
  await client.send(
    new CreateNotebookInstanceCommand({
      NotebookInstanceName: name,
      InstanceType: "ml.t2.medium",
      RoleArn: "arn:aws:iam::123456789012:role/test-role",
    }),
  );
  await client.send(
    new StartNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  const desc = await client.send(
    new DescribeNotebookInstanceCommand({ NotebookInstanceName: name }),
  );
  expect(desc.NotebookInstanceName).toBe(name);
  expect(desc.NotebookInstanceStatus).toBe("InService");
  expect(desc.NotebookInstanceArn).toContain("notebook-instance");
});

test("StartNotebookInstance → ResourceNotFound for missing instance", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new StartNotebookInstanceCommand({ NotebookInstanceName: "no-such-nb" }),
    ),
  ).rejects.toMatchObject({ name: "ValidationException" });
});

test("StartMonitoringSchedule → schedule exists (no error)", async () => {
  const client = sagemaker();
  const name = `sched-chunk25-${Date.now()}`;
  await client.send(
    new CreateMonitoringScheduleCommand({
      MonitoringScheduleName: name,
      MonitoringScheduleConfig: {},
    }),
  );
  await expect(
    client.send(
      new StartMonitoringScheduleCommand({ MonitoringScheduleName: name }),
    ),
  ).resolves.toBeDefined();
});

test("StartMonitoringSchedule → ResourceNotFound for missing schedule", async () => {
  const client = sagemaker();
  await expect(
    client.send(
      new StartMonitoringScheduleCommand({
        MonitoringScheduleName: "no-such-sched",
      }),
    ),
  ).rejects.toThrow();
});

test("StartPipelineExecution → execution visible in ListPipelineExecutions and DescribePipelineExecution", async () => {
  const client = sagemaker();
  const pipelineName = `pipe-chunk25-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({
      PipelineName: pipelineName,
      PipelineDefinition: JSON.stringify({ Version: "2020-12-01", Steps: [] }),
      RoleArn: "arn:aws:iam::123456789012:role/test-role",
      ClientRequestToken: `create-${pipelineName}`,
    }),
  );
  const execRes = await client.send(
    new StartPipelineExecutionCommand({
      PipelineName: pipelineName,
      ClientRequestToken: `exec-${pipelineName}`,
      PipelineExecutionDisplayName: "chunk25-exec",
    }),
  );
  const execArn = execRes.PipelineExecutionArn!;
  expect(execArn).toContain("pipeline");
  expect(execArn).toContain(pipelineName);

  const listRes = await client.send(
    new ListPipelineExecutionsCommand({ PipelineName: pipelineName }),
  );
  expect(Array.isArray(listRes.PipelineExecutionSummaries)).toBe(true);
  const found = listRes.PipelineExecutionSummaries!.find(
    (e) => e.PipelineExecutionArn === execArn,
  );
  expect(found).toBeDefined();
  expect(found!.PipelineExecutionStatus).toBe("Executing");

  const descExec = await client.send(
    new DescribePipelineExecutionCommand({ PipelineExecutionArn: execArn }),
  );
  expect(descExec.PipelineExecutionArn).toBe(execArn);
  expect(descExec.PipelineExecutionStatus).toBe("Executing");
  expect(descExec.PipelineExecutionDisplayName).toBe("chunk25-exec");
});
