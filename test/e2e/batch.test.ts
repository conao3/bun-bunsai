import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  BatchClient,
  CreateComputeEnvironmentCommand,
  CreateJobQueueCommand,
  DescribeComputeEnvironmentsCommand,
  DescribeJobDefinitionsCommand,
  DescribeJobQueuesCommand,
  DescribeJobsCommand,
  RegisterJobDefinitionCommand,
  SubmitJobCommand,
} from "@aws-sdk/client-batch";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const batch = () =>
  new BatchClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Batch compute environment, job queue, job definition and job lifecycle", async () => {
  const client = batch();
  const computeEnvironmentName = "bunsai-e2e-ce";
  const jobQueueName = "bunsai-e2e-jq";
  const jobDefinitionName = "bunsai-e2e-jd";

  const createdCe = await client.send(
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
  expect(createdCe.computeEnvironmentName).toBe(computeEnvironmentName);
  expect(createdCe.computeEnvironmentArn).toBeDefined();

  const describedCe = await client.send(
    new DescribeComputeEnvironmentsCommand({
      computeEnvironments: [computeEnvironmentName],
    }),
  );
  const ce = (describedCe.computeEnvironments ?? [])[0];
  expect(ce?.computeEnvironmentName).toBe(computeEnvironmentName);
  expect(ce?.status).toBe("VALID");
  expect(ce?.state).toBe("ENABLED");

  const createdJq = await client.send(
    new CreateJobQueueCommand({
      jobQueueName,
      priority: 1,
      computeEnvironmentOrder: [
        { order: 1, computeEnvironment: computeEnvironmentName },
      ],
    }),
  );
  expect(createdJq.jobQueueName).toBe(jobQueueName);
  expect(createdJq.jobQueueArn).toBeDefined();

  const describedJq = await client.send(
    new DescribeJobQueuesCommand({ jobQueues: [jobQueueName] }),
  );
  const jq = (describedJq.jobQueues ?? [])[0];
  expect(jq?.jobQueueName).toBe(jobQueueName);
  expect(jq?.priority).toBe(1);
  expect(jq?.status).toBe("VALID");

  const registered = await client.send(
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
  expect(registered.jobDefinitionName).toBe(jobDefinitionName);
  expect(registered.revision).toBe(1);
  expect(registered.jobDefinitionArn).toContain(`${jobDefinitionName}:1`);

  const describedJd = await client.send(
    new DescribeJobDefinitionsCommand({
      jobDefinitionName,
    }),
  );
  const jd = (describedJd.jobDefinitions ?? [])[0];
  expect(jd?.jobDefinitionName).toBe(jobDefinitionName);
  expect(jd?.revision).toBe(1);
  expect(jd?.status).toBe("ACTIVE");
  expect(jd?.type).toBe("container");

  const submitted = await client.send(
    new SubmitJobCommand({
      jobName: "bunsai-e2e-job",
      jobQueue: jobQueueName,
      jobDefinition: `${jobDefinitionName}:1`,
    }),
  );
  expect(submitted.jobName).toBe("bunsai-e2e-job");
  expect(submitted.jobId).toBeDefined();
  expect(submitted.jobArn).toBeDefined();

  const describedJobs = await client.send(
    new DescribeJobsCommand({ jobs: [submitted.jobId ?? ""] }),
  );
  const job = (describedJobs.jobs ?? [])[0];
  expect(job?.jobId).toBe(submitted.jobId);
  expect(job?.jobName).toBe("bunsai-e2e-job");
  expect(job?.jobQueue).toBe(jobQueueName);
  expect(job?.status).toBe("SUBMITTED");
});
