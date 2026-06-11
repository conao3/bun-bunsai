import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchClient,
  CreateComputeEnvironmentCommand,
  CreateJobQueueCommand,
  DeleteComputeEnvironmentCommand,
  DeleteJobQueueCommand,
  DeregisterJobDefinitionCommand,
  DescribeComputeEnvironmentsCommand,
  DescribeJobDefinitionsCommand,
  DescribeJobQueuesCommand,
  DescribeJobsCommand,
  ListJobsCommand,
  RegisterJobDefinitionCommand,
  SubmitJobCommand,
  TerminateJobCommand,
  UpdateComputeEnvironmentCommand,
  UpdateJobQueueCommand,
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

test("Batch job pipeline: compute env → queue → job def → submit/track → terminate → DISABLED-guard cleanup", async () => {
  const client = batch();
  const ceName = "bunsai-scenario-batch-ce";
  const jqName = "bunsai-scenario-batch-jq";
  const jdName = "bunsai-scenario-batch-jd";

  const createdCe = await client.send(
    new CreateComputeEnvironmentCommand({
      computeEnvironmentName: ceName,
      type: "MANAGED",
      state: "ENABLED",
      computeResources: {
        type: "FARGATE",
        maxvCpus: 16,
        subnets: ["subnet-12345678"],
        securityGroupIds: ["sg-12345678"],
      },
    }),
  );
  const ceArn = createdCe.computeEnvironmentArn as string;
  expect(ceArn).toContain(`compute-environment/${ceName}`);

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName: jqName,
      priority: 10,
      computeEnvironmentOrder: [{ order: 1, computeEnvironment: ceArn }],
    }),
  );

  const describedJq = await client.send(
    new DescribeJobQueuesCommand({ jobQueues: [jqName] }),
  );
  const jq = (describedJq.jobQueues ?? [])[0];
  expect(jq?.state).toBe("ENABLED");
  expect(jq?.status).toBe("VALID");

  const registered = await client.send(
    new RegisterJobDefinitionCommand({
      jobDefinitionName: jdName,
      type: "container",
      containerProperties: {
        image: "busybox",
        command: ["echo", "pipeline"],
        resourceRequirements: [
          { type: "VCPU", value: "0.25" },
          { type: "MEMORY", value: "512" },
        ],
      },
    }),
  );
  const revision = registered.revision as number;
  expect(revision).toBeGreaterThan(0);

  const describedJd = await client.send(
    new DescribeJobDefinitionsCommand({ jobDefinitionName: jdName }),
  );
  expect((describedJd.jobDefinitions ?? [])[0]?.status).toBe("ACTIVE");

  const submittedA = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-scenario-batch-job-a",
      jobQueue: jqName,
      jobDefinition: `${jdName}:${revision}`,
    }),
  );
  const jobAId = submittedA.jobId as string;
  expect(jobAId).toBeDefined();

  const submittedB = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-scenario-batch-job-b",
      jobQueue: jqName,
      jobDefinition: `${jdName}:${revision}`,
    }),
  );
  const jobBId = submittedB.jobId as string;
  expect(jobBId).toBeDefined();

  const call1 = await client.send(new DescribeJobsCommand({ jobs: [jobAId] }));
  expect((call1.jobs ?? [])[0]?.status).toBe("PENDING");

  for (let i = 0; i < 3; i++) {
    await client.send(new DescribeJobsCommand({ jobs: [jobAId] }));
  }

  const finalA = await client.send(new DescribeJobsCommand({ jobs: [jobAId] }));
  const jobA = (finalA.jobs ?? [])[0];
  expect(jobA?.status).toBe("SUCCEEDED");
  expect(jobA?.stoppedAt).toBeDefined();
  expect((jobA?.attempts ?? [])[0]?.container?.exitCode).toBe(0);

  const listed = await client.send(
    new ListJobsCommand({ jobQueue: jqName, jobStatus: "SUBMITTED" }),
  );
  const listedIds = (listed.jobSummaryList ?? []).map((j) => j.jobId);
  expect(listedIds).toContain(jobBId);

  await client.send(
    new TerminateJobCommand({ jobId: jobBId, reason: "pipeline-cleanup" }),
  );

  const finalB = await client.send(new DescribeJobsCommand({ jobs: [jobBId] }));
  const jobB = (finalB.jobs ?? [])[0];
  expect(jobB?.status).toBe("FAILED");
  expect(jobB?.statusReason).toBe("pipeline-cleanup");
  expect((jobB?.attempts ?? [])[0]?.container?.exitCode).toBe(1);

  await client.send(
    new DeregisterJobDefinitionCommand({
      jobDefinition: `${jdName}:${revision}`,
    }),
  );
  const afterDereg = await client.send(
    new DescribeJobDefinitionsCommand({
      jobDefinitionName: jdName,
      status: "INACTIVE",
    }),
  );
  expect((afterDereg.jobDefinitions ?? [])[0]?.status).toBe("INACTIVE");

  await expect(
    client.send(new DeleteJobQueueCommand({ jobQueue: jqName })),
  ).rejects.toThrow(/DISABLED/);

  await client.send(
    new UpdateJobQueueCommand({ jobQueue: jqName, state: "DISABLED" }),
  );
  await client.send(new DeleteJobQueueCommand({ jobQueue: jqName }));

  await expect(
    client.send(
      new DeleteComputeEnvironmentCommand({ computeEnvironment: ceName }),
    ),
  ).rejects.toThrow(/DISABLED/);

  await client.send(
    new UpdateComputeEnvironmentCommand({
      computeEnvironment: ceName,
      state: "DISABLED",
    }),
  );
  await client.send(
    new DeleteComputeEnvironmentCommand({ computeEnvironment: ceName }),
  );

  const afterDeleteJq = await client.send(
    new DescribeJobQueuesCommand({ jobQueues: [jqName] }),
  );
  expect(afterDeleteJq.jobQueues ?? []).toHaveLength(0);

  const afterDeleteCe = await client.send(
    new DescribeComputeEnvironmentsCommand({
      computeEnvironments: [ceName],
    }),
  );
  expect(afterDeleteCe.computeEnvironments ?? []).toHaveLength(0);
});
