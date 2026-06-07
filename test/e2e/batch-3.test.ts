import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchClient,
  CancelJobCommand,
  CreateJobQueueCommand,
  DescribeJobsCommand,
  ListJobsCommand,
  RegisterJobDefinitionCommand,
  SubmitJobCommand,
  TerminateJobCommand,
} from "@aws-sdk/client-batch";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const batch = () =>
  new BatchClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Job lifecycle SUBMITTED -> SUCCEEDED via DescribeJobs advance-on-read", async () => {
  const client = batch();
  const jobQueueName = "bunsai-e2e3-jq";
  const jobDefinitionName = "bunsai-e2e3-jd";

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

  const submitted = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-e2e3-job-lifecycle",
      jobQueue: jobQueueName,
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );
  expect(submitted.jobId).toBeDefined();
  expect(submitted.jobArn).toBeDefined();

  const jobId = submitted.jobId ?? "";

  for (let i = 0; i < 3; i++) {
    await client.send(new DescribeJobsCommand({ jobs: [jobId] }));
  }
  const terminal = await client.send(
    new DescribeJobsCommand({ jobs: [jobId] }),
  );
  const succeededJob = (terminal.jobs ?? [])[0];
  expect(succeededJob?.status).toBe("SUCCEEDED");

  const listed = await client.send(
    new ListJobsCommand({ jobQueue: jobQueueName, jobStatus: "SUCCEEDED" }),
  );
  const listedIds = (listed.jobSummaryList ?? []).map((j) => j.jobId);
  expect(listedIds).toContain(jobId);

  const cancelTarget = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-e2e3-job-cancel",
      jobQueue: jobQueueName,
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );
  const cancelId = cancelTarget.jobId ?? "";

  await client.send(
    new CancelJobCommand({ jobId: cancelId, reason: "test-cancel-reason" }),
  );

  const afterCancel = await client.send(
    new DescribeJobsCommand({ jobs: [cancelId] }),
  );
  const cancelledJob = (afterCancel.jobs ?? [])[0];
  expect(cancelledJob?.status).toBe("FAILED");
  expect(cancelledJob?.statusReason).toBe("test-cancel-reason");

  const terminateTarget = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-e2e3-job-terminate",
      jobQueue: jobQueueName,
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );
  const terminateId = terminateTarget.jobId ?? "";

  await client.send(
    new TerminateJobCommand({
      jobId: terminateId,
      reason: "test-terminate-reason",
    }),
  );

  const afterTerminate = await client.send(
    new DescribeJobsCommand({ jobs: [terminateId] }),
  );
  const terminatedJob = (afterTerminate.jobs ?? [])[0];
  expect(terminatedJob?.status).toBe("FAILED");
  expect(terminatedJob?.statusReason).toBe("test-terminate-reason");
});
