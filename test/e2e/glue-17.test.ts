import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateJobCommand,
  GlueClient,
  GetJobRunCommand,
  GetJobRunsCommand,
  StartJobRunCommand,
} from "@aws-sdk/client-glue";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new GlueClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("StartJobRun on missing job throws EntityNotFoundException", async () => {
  await expect(
    client.send(new StartJobRunCommand({ JobName: "no-such-job-con1686" })),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("CreateJob -> StartJobRun -> GetJobRun round-trip", async () => {
  const jobName = "test-job-con1686";

  await client.send(
    new CreateJobCommand({
      Name: jobName,
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
    }),
  );

  const startResp = await client.send(
    new StartJobRunCommand({ JobName: jobName }),
  );
  expect(startResp.JobRunId).toBeDefined();
  expect(typeof startResp.JobRunId).toBe("string");
  expect(startResp.JobRunId!.length).toBeGreaterThan(0);

  const runId = startResp.JobRunId!;

  const getResp = await client.send(
    new GetJobRunCommand({ JobName: jobName, RunId: runId }),
  );
  expect(getResp.JobRun).toBeDefined();
  expect(getResp.JobRun!.Id).toBe(runId);
  expect(getResp.JobRun!.JobName).toBe(jobName);
  expect(getResp.JobRun!.JobRunState).toBe("SUCCEEDED");

  const listResp = await client.send(
    new GetJobRunsCommand({ JobName: jobName }),
  );
  expect(listResp.JobRuns).toBeDefined();
  expect(listResp.JobRuns!.length).toBeGreaterThanOrEqual(1);
  const found = listResp.JobRuns!.find((r) => r.Id === runId);
  expect(found).toBeDefined();
  expect(found!.JobRunState).toBe("SUCCEEDED");
});
