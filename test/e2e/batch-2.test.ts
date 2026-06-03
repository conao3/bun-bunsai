import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BatchClient,
  CancelJobCommand,
  CreateComputeEnvironmentCommand,
  CreateJobQueueCommand,
  DeleteComputeEnvironmentCommand,
  DeleteJobQueueCommand,
  DescribeComputeEnvironmentsCommand,
  DescribeJobQueuesCommand,
  ListJobsCommand,
  RegisterJobDefinitionCommand,
  SubmitJobCommand,
  TerminateJobCommand,
  UpdateComputeEnvironmentCommand,
  UpdateJobQueueCommand,
} from "@aws-sdk/client-batch";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4744;
const uiPort = 5744;
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

const batch = () =>
  new BatchClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Batch job listing, cancel and terminate", async () => {
  const client = batch();
  const jobQueueName = "bunsai-e2e2-jq";
  const jobDefinitionName = "bunsai-e2e2-jd";

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [],
    }),
  );

  await client.send(
    new RegisterJobDefinitionCommand({
      jobDefinitionName,
      type: "container",
      containerProperties: {
        image: "busybox",
        command: ["echo", "hello"],
        resourceRequirements: [
          { type: "VCPU", value: "0.25" },
          { type: "MEMORY", value: "512" },
        ],
      },
    }),
  );

  const first = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-e2e2-job-1",
      jobQueue: jobQueueName,
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );
  const second = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-e2e2-job-2",
      jobQueue: jobQueueName,
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );

  const listed = await client.send(
    new ListJobsCommand({ jobQueue: jobQueueName }),
  );
  const summaries = listed.jobSummaryList ?? [];
  const listedIds = summaries.map((entry) => entry.jobId);
  expect(listedIds).toContain(first.jobId);
  expect(listedIds).toContain(second.jobId);

  const cancelled = await client.send(
    new CancelJobCommand({ jobId: first.jobId ?? "", reason: "no longer" }),
  );
  expect(cancelled.$metadata.httpStatusCode).toBe(200);

  const afterCancel = await client.send(
    new ListJobsCommand({ jobQueue: jobQueueName, jobStatus: "CANCELLED" }),
  );
  const cancelledIds = (afterCancel.jobSummaryList ?? []).map(
    (entry) => entry.jobId,
  );
  expect(cancelledIds).toContain(first.jobId);

  const terminated = await client.send(
    new TerminateJobCommand({ jobId: second.jobId ?? "", reason: "stop" }),
  );
  expect(terminated.$metadata.httpStatusCode).toBe(200);

  const afterTerminate = await client.send(
    new ListJobsCommand({ jobQueue: jobQueueName, jobStatus: "FAILED" }),
  );
  const failedIds = (afterTerminate.jobSummaryList ?? []).map(
    (entry) => entry.jobId,
  );
  expect(failedIds).toContain(second.jobId);
});

test("Batch job queue and compute environment update and delete", async () => {
  const client = batch();
  const computeEnvironmentName = "bunsai-e2e2-ce";
  const jobQueueName = "bunsai-e2e2-jq-mutate";

  await client.send(
    new CreateComputeEnvironmentCommand({
      computeEnvironmentName,
      type: "MANAGED",
      computeResources: {
        type: "FARGATE",
        maxvCpus: 16,
        subnets: ["subnet-12345678"],
        securityGroupIds: ["sg-12345678"],
      },
    }),
  );

  const updatedCe = await client.send(
    new UpdateComputeEnvironmentCommand({
      computeEnvironment: computeEnvironmentName,
      state: "DISABLED",
    }),
  );
  expect(updatedCe.computeEnvironmentName).toBe(computeEnvironmentName);
  expect(updatedCe.computeEnvironmentArn).toBeDefined();

  const describedCe = await client.send(
    new DescribeComputeEnvironmentsCommand({
      computeEnvironments: [computeEnvironmentName],
    }),
  );
  expect((describedCe.computeEnvironments ?? [])[0]?.state).toBe("DISABLED");

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [],
    }),
  );

  const updatedJq = await client.send(
    new UpdateJobQueueCommand({
      jobQueue: jobQueueName,
      priority: 5,
      state: "DISABLED",
    }),
  );
  expect(updatedJq.jobQueueName).toBe(jobQueueName);
  expect(updatedJq.jobQueueArn).toBeDefined();

  const describedJq = await client.send(
    new DescribeJobQueuesCommand({ jobQueues: [jobQueueName] }),
  );
  const jq = (describedJq.jobQueues ?? [])[0];
  expect(jq?.priority).toBe(5);
  expect(jq?.state).toBe("DISABLED");

  const deletedJq = await client.send(
    new DeleteJobQueueCommand({ jobQueue: jobQueueName }),
  );
  expect(deletedJq.$metadata.httpStatusCode).toBe(200);

  const afterDeleteJq = await client.send(
    new DescribeJobQueuesCommand({ jobQueues: [jobQueueName] }),
  );
  expect(afterDeleteJq.jobQueues ?? []).toHaveLength(0);

  const deletedCe = await client.send(
    new DeleteComputeEnvironmentCommand({
      computeEnvironment: computeEnvironmentName,
    }),
  );
  expect(deletedCe.$metadata.httpStatusCode).toBe(200);

  const afterDeleteCe = await client.send(
    new DescribeComputeEnvironmentsCommand({
      computeEnvironments: [computeEnvironmentName],
    }),
  );
  expect(afterDeleteCe.computeEnvironments ?? []).toHaveLength(0);
});
