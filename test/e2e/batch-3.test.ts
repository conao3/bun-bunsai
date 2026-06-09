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

  const statuses: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await client.send(new DescribeJobsCommand({ jobs: [jobId] }));
    statuses.push((r.jobs ?? [])[0]?.status ?? "");
  }
  const [s1, s2, s3, s4, s5] = statuses;
  expect(s1).toBe("PENDING");
  expect(s2).toBe("RUNNABLE");
  expect(s3).toBe("STARTING");
  expect(s4).toBe("RUNNING");
  expect(s5).toBe("SUCCEEDED");
  const terminal = await client.send(
    new DescribeJobsCommand({ jobs: [jobId] }),
  );
  const succeededJob = (terminal.jobs ?? [])[0];
  expect(succeededJob?.status).toBe("SUCCEEDED");
  expect(succeededJob?.stoppedAt).toBeDefined();
  expect((succeededJob?.attempts ?? []).length).toBeGreaterThan(0);
  expect(succeededJob?.isCancelled).toBe(false);
  expect(succeededJob?.isTerminated).toBe(false);

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
  expect(cancelledJob?.isCancelled).toBe(true);
  expect(cancelledJob?.isTerminated).toBe(false);
  expect(cancelledJob?.stoppedAt).toBeDefined();

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
  expect(terminatedJob?.isTerminated).toBe(true);
  expect(terminatedJob?.isCancelled).toBe(false);
  expect(terminatedJob?.stoppedAt).toBeDefined();
});

test("CancelJob and TerminateJob throw ClientException for unknown job", async () => {
  const client = batch();

  await expect(
    client.send(
      new CancelJobCommand({
        jobId: "00000000-0000-0000-0000-000000000000",
        reason: "no such job",
      }),
    ),
  ).rejects.toThrow();

  await expect(
    client.send(
      new TerminateJobCommand({
        jobId: "00000000-0000-0000-0000-000000000001",
        reason: "no such job",
      }),
    ),
  ).rejects.toThrow();
});

test("ListJobs pagination and filters", async () => {
  const client = batch();
  const jqName = "bunsai-e2e3-pag-jq";
  const jdName = "bunsai-e2e3-pag-jd";

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName: jqName,
      priority: 1,
      computeEnvironmentOrder: [],
    }),
  );

  await client.send(
    new RegisterJobDefinitionCommand({
      jobDefinitionName: jdName,
      type: "container",
      containerProperties: { image: "busybox", resourceRequirements: [] },
    }),
  );

  const jobNames = ["alpha-job", "alpha-two", "beta-job"];
  const jobIds: string[] = [];
  for (const name of jobNames) {
    const r = await client.send(
      new SubmitJobCommand({
        jobName: name,
        jobQueue: jqName,
        jobDefinition: `${jdName}:1`,
      }),
    );
    jobIds.push(r.jobId ?? "");
  }

  const page1 = await client.send(
    new ListJobsCommand({ jobQueue: jqName, maxResults: 2 }),
  );
  expect((page1.jobSummaryList ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListJobsCommand({ jobQueue: jqName, nextToken: page1.nextToken }),
  );
  expect((page2.jobSummaryList ?? []).length).toBeGreaterThanOrEqual(1);
  expect(page2.nextToken).toBeUndefined();

  const filtered = await client.send(
    new ListJobsCommand({
      jobQueue: jqName,
      filters: [{ name: "JOB_NAME", values: ["alpha*"] }],
    }),
  );
  const filteredNames = (filtered.jobSummaryList ?? []).map((j) => j.jobName);
  expect(filteredNames).toContain("alpha-job");
  expect(filteredNames).toContain("alpha-two");
  expect(filteredNames).not.toContain("beta-job");

  const byDef = await client.send(
    new ListJobsCommand({
      jobQueue: jqName,
      filters: [{ name: "JOB_DEFINITION", values: [`${jdName}:1`] }],
    }),
  );
  expect((byDef.jobSummaryList ?? []).length).toBe(3);
});
