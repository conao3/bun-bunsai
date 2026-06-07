import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchClient,
  CancelJobCommand,
  CreateComputeEnvironmentCommand,
  CreateConsumableResourceCommand,
  CreateJobQueueCommand,
  CreateQuotaShareCommand,
  CreateSchedulingPolicyCommand,
  CreateServiceEnvironmentCommand,
  DeleteComputeEnvironmentCommand,
  DeleteConsumableResourceCommand,
  DeleteJobQueueCommand,
  DeleteQuotaShareCommand,
  DeleteSchedulingPolicyCommand,
  DeleteServiceEnvironmentCommand,
  DeregisterJobDefinitionCommand,
  DescribeComputeEnvironmentsCommand,
  DescribeConsumableResourceCommand,
  DescribeJobDefinitionsCommand,
  DescribeJobQueuesCommand,
  DescribeQuotaShareCommand,
  DescribeSchedulingPoliciesCommand,
  DescribeServiceEnvironmentsCommand,
  DescribeServiceJobCommand,
  GetJobQueueSnapshotCommand,
  ListConsumableResourcesCommand,
  ListJobsCommand,
  ListJobsByConsumableResourceCommand,
  ListQuotaSharesCommand,
  ListSchedulingPoliciesCommand,
  ListServiceJobsCommand,
  ListTagsForResourceCommand,
  RegisterJobDefinitionCommand,
  SubmitJobCommand,
  SubmitServiceJobCommand,
  TagResourceCommand,
  TerminateJobCommand,
  TerminateServiceJobCommand,
  UntagResourceCommand,
  UpdateComputeEnvironmentCommand,
  UpdateConsumableResourceCommand,
  UpdateJobQueueCommand,
  UpdateQuotaShareCommand,
  UpdateSchedulingPolicyCommand,
  UpdateServiceEnvironmentCommand,
  UpdateServiceJobCommand,
} from "@aws-sdk/client-batch";
import type { JobStatus } from "@aws-sdk/client-batch";

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
    new ListJobsCommand({
      jobQueue: jobQueueName,
      jobStatus: "FAILED",
    }),
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

test("Scheduling policy CRUD", async () => {
  const client = batch();
  const name = "bunsai-e2e2-sp";

  const created = await client.send(
    new CreateSchedulingPolicyCommand({
      name,
      fairsharePolicy: { shareDecaySeconds: 300, computeReservation: 0 },
      tags: { env: "test" },
    }),
  );
  expect(created.name).toBe(name);
  expect(created.arn).toContain(`scheduling-policy/${name}`);

  const arn = created.arn ?? "";

  const described = await client.send(
    new DescribeSchedulingPoliciesCommand({ arns: [arn] }),
  );
  const sp = (described.schedulingPolicies ?? [])[0];
  expect(sp?.name).toBe(name);
  expect(sp?.arn).toBe(arn);

  const listed = await client.send(new ListSchedulingPoliciesCommand({}));
  const arns = (listed.schedulingPolicies ?? []).map((p) => p.arn);
  expect(arns).toContain(arn);

  await client.send(new UpdateSchedulingPolicyCommand({ arn }));

  const deleted = await client.send(new DeleteSchedulingPolicyCommand({ arn }));
  expect(deleted.$metadata.httpStatusCode).toBe(200);

  const afterDelete = await client.send(
    new DescribeSchedulingPoliciesCommand({ arns: [arn] }),
  );
  expect(afterDelete.schedulingPolicies ?? []).toHaveLength(0);
});

test("Consumable resource CRUD", async () => {
  const client = batch();
  const consumableResourceName = "bunsai-e2e2-cr";

  const created = await client.send(
    new CreateConsumableResourceCommand({
      consumableResourceName,
      totalQuantity: 100,
      resourceType: "NON_REPLENISHABLE",
    }),
  );
  expect(created.consumableResourceName).toBe(consumableResourceName);
  expect(created.consumableResourceArn).toContain(
    `consumable-resource/${consumableResourceName}`,
  );

  const arn = created.consumableResourceArn ?? "";

  const described = await client.send(
    new DescribeConsumableResourceCommand({ consumableResource: arn }),
  );
  expect(described.consumableResourceName).toBe(consumableResourceName);
  expect(described.totalQuantity).toBe(100);

  const listed = await client.send(new ListConsumableResourcesCommand({}));
  const names = (listed.consumableResources ?? []).map(
    (r) => r.consumableResourceName,
  );
  expect(names).toContain(consumableResourceName);

  const updated = await client.send(
    new UpdateConsumableResourceCommand({
      consumableResource: arn,
      operation: "ADD",
      quantity: 50,
    }),
  );
  expect(updated.totalQuantity).toBe(150);

  const listedJobs = await client.send(
    new ListJobsByConsumableResourceCommand({ consumableResource: arn }),
  );
  expect(listedJobs.jobs ?? []).toHaveLength(0);

  await client.send(
    new DeleteConsumableResourceCommand({ consumableResource: arn }),
  );
  await expect(
    client.send(
      new DescribeConsumableResourceCommand({ consumableResource: arn }),
    ),
  ).rejects.toThrow();
});

test("Service environment CRUD", async () => {
  const client = batch();
  const serviceEnvironmentName = "bunsai-e2e2-se";

  const created = await client.send(
    new CreateServiceEnvironmentCommand({
      serviceEnvironmentName,
      serviceEnvironmentType: "SAGEMAKER_TRAINING",
      capacityLimits: [],
    }),
  );
  expect(created.serviceEnvironmentName).toBe(serviceEnvironmentName);
  expect(created.serviceEnvironmentArn).toContain(
    `service-environment/${serviceEnvironmentName}`,
  );

  const arn = created.serviceEnvironmentArn ?? "";

  const described = await client.send(
    new DescribeServiceEnvironmentsCommand({
      serviceEnvironments: [serviceEnvironmentName],
    }),
  );
  const se = (described.serviceEnvironments ?? [])[0];
  expect(se?.serviceEnvironmentName).toBe(serviceEnvironmentName);
  expect(se?.status).toBe("VALID");

  const updated = await client.send(
    new UpdateServiceEnvironmentCommand({
      serviceEnvironment: arn,
      state: "DISABLED",
    }),
  );
  expect(updated.serviceEnvironmentName).toBe(serviceEnvironmentName);

  await client.send(
    new DeleteServiceEnvironmentCommand({ serviceEnvironment: arn }),
  );
  const afterDelete = await client.send(
    new DescribeServiceEnvironmentsCommand({
      serviceEnvironments: [serviceEnvironmentName],
    }),
  );
  expect(afterDelete.serviceEnvironments ?? []).toHaveLength(0);
});

test("Quota share CRUD", async () => {
  const client = batch();
  const jobQueueName = "bunsai-e2e2-jq-qs";
  const quotaShareName = "bunsai-e2e2-qs";

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [],
    }),
  );

  const created = await client.send(
    new CreateQuotaShareCommand({
      quotaShareName,
      jobQueue: jobQueueName,
      capacityLimits: [],
      resourceSharingConfiguration: { strategy: "RESERVE" },
      preemptionConfiguration: { inSharePreemption: "DISABLED" },
    }),
  );
  expect(created.quotaShareName).toBe(quotaShareName);
  expect(created.quotaShareArn).toContain(`quota-share/${quotaShareName}`);

  const arn = created.quotaShareArn ?? "";

  const described = await client.send(
    new DescribeQuotaShareCommand({ quotaShareArn: arn }),
  );
  expect(described.quotaShareName).toBe(quotaShareName);
  expect(described.state).toBe("ENABLED");

  const listed = await client.send(
    new ListQuotaSharesCommand({ jobQueue: jobQueueName }),
  );
  const arns = (listed.quotaShares ?? []).map((q) => q.quotaShareArn);
  expect(arns).toContain(arn);

  const updated = await client.send(
    new UpdateQuotaShareCommand({ quotaShareArn: arn, state: "DISABLED" }),
  );
  expect(updated.quotaShareName).toBe(quotaShareName);

  await client.send(new DeleteQuotaShareCommand({ quotaShareArn: arn }));
  await expect(
    client.send(new DescribeQuotaShareCommand({ quotaShareArn: arn })),
  ).rejects.toThrow();
});

test("Service job lifecycle", async () => {
  const client = batch();
  const jobQueueName = "bunsai-e2e2-jq-sj";

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [],
    }),
  );

  const submitted = await client.send(
    new SubmitServiceJobCommand({
      jobName: "bunsai-e2e2-sj-1",
      jobQueue: jobQueueName,
      serviceJobType: "SAGEMAKER_TRAINING",
      serviceRequestPayload: JSON.stringify({}),
    }),
  );
  expect(submitted.jobName).toBe("bunsai-e2e2-sj-1");
  expect(submitted.jobId).toBeDefined();
  expect(submitted.jobArn).toBeDefined();

  const jobId = submitted.jobId ?? "";
  const jobArn = submitted.jobArn ?? "";

  const described = await client.send(new DescribeServiceJobCommand({ jobId }));
  expect(described.jobId).toBe(jobId);
  expect(described.status).toBe("SUBMITTED");

  const listed = await client.send(
    new ListServiceJobsCommand({ jobQueue: jobQueueName }),
  );
  const ids = (listed.jobSummaryList ?? []).map((j) => j.jobId);
  expect(ids).toContain(jobId);

  const updated = await client.send(
    new UpdateServiceJobCommand({ jobId, schedulingPriority: 5 }),
  );
  expect(updated.jobId).toBe(jobId);
  expect(updated.jobArn).toBe(jobArn);

  await client.send(
    new TerminateServiceJobCommand({ jobId, reason: "test done" }),
  );
  const afterTerminate = await client.send(
    new DescribeServiceJobCommand({ jobId }),
  );
  expect(afterTerminate.status).toBe("FAILED");
});

test("DeregisterJobDefinition", async () => {
  const client = batch();
  const jobDefinitionName = "bunsai-e2e2-jd-dereg";

  await client.send(
    new RegisterJobDefinitionCommand({
      jobDefinitionName,
      type: "container",
      containerProperties: {
        image: "busybox",
        command: ["echo"],
        resourceRequirements: [
          { type: "VCPU", value: "0.25" },
          { type: "MEMORY", value: "512" },
        ],
      },
    }),
  );

  const before = await client.send(
    new DescribeJobDefinitionsCommand({ jobDefinitionName }),
  );
  expect((before.jobDefinitions ?? [])[0]?.status).toBe("ACTIVE");

  await client.send(
    new DeregisterJobDefinitionCommand({
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );

  const after = await client.send(
    new DescribeJobDefinitionsCommand({
      jobDefinitionName,
      status: "INACTIVE",
    }),
  );
  expect((after.jobDefinitions ?? [])[0]?.status).toBe("INACTIVE");
});

test("GetJobQueueSnapshot", async () => {
  const client = batch();
  const jobQueueName = "bunsai-e2e2-jq-snapshot";

  await client.send(
    new CreateJobQueueCommand({
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [],
    }),
  );

  const snapshot = await client.send(
    new GetJobQueueSnapshotCommand({ jobQueue: jobQueueName }),
  );
  expect(snapshot.$metadata.httpStatusCode).toBe(200);
  expect(snapshot.frontOfQueue).toBeDefined();
});

test("TagResource, ListTagsForResource, UntagResource", async () => {
  const client = batch();
  const spName = "bunsai-e2e2-sp-tags";

  const created = await client.send(
    new CreateSchedulingPolicyCommand({
      name: spName,
      tags: { initial: "v1" },
    }),
  );
  const arn = created.arn ?? "";

  const beforeTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(beforeTag.tags?.["initial"]).toBe("v1");

  await client.send(
    new TagResourceCommand({ resourceArn: arn, tags: { added: "v2" } }),
  );
  const afterTag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(afterTag.tags?.["added"]).toBe("v2");
  expect(afterTag.tags?.["initial"]).toBe("v1");

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["initial"] }),
  );
  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(afterUntag.tags?.["initial"]).toBeUndefined();
  expect(afterUntag.tags?.["added"]).toBe("v2");

  await client.send(new DeleteSchedulingPolicyCommand({ arn }));
});
