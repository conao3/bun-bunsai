import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchStopJobRunCommand,
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

test("StartJobRun on missing job -> EntityNotFoundException", async () => {
  await expect(
    client.send(new StartJobRunCommand({ JobName: "no-such-job-con1839" })),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("GetJobRun on missing run -> EntityNotFoundException", async () => {
  await client.send(
    new CreateJobCommand({
      Name: "job-missingrun-con1839",
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
    }),
  );
  await expect(
    client.send(
      new GetJobRunCommand({
        JobName: "job-missingrun-con1839",
        RunId: "no-such-run",
      }),
    ),
  ).rejects.toMatchObject({ name: "EntityNotFoundException" });
});

test("CreateJob -> StartJobRun -> GetJobRun SUCCEEDED lifecycle", async () => {
  const jobName = "job-lifecycle-con1839";

  await client.send(
    new CreateJobCommand({
      Name: jobName,
      Role: "arn:aws:iam::123456789012:role/GlueRole",
      Command: { Name: "glueetl", ScriptLocation: "s3://bucket/script.py" },
      DefaultArguments: { "--job-language": "python" },
    }),
  );

  const startResp = await client.send(
    new StartJobRunCommand({
      JobName: jobName,
      Arguments: { "--custom-arg": "value1" },
    }),
  );
  expect(startResp.JobRunId).toBeDefined();
  const runId = startResp.JobRunId!;

  const earlyResp = await client.send(
    new GetJobRunCommand({ JobName: jobName, RunId: runId }),
  );
  expect(["STARTING", "RUNNING"]).toContain(earlyResp.JobRun!.JobRunState!);

  await Bun.sleep(300);

  const getResp = await client.send(
    new GetJobRunCommand({ JobName: jobName, RunId: runId }),
  );
  expect(getResp.JobRun!.JobRunState).toBe("SUCCEEDED");
  expect(getResp.JobRun!.CompletedOn).toBeDefined();
  expect(getResp.JobRun!.Arguments?.["--custom-arg"]).toBe("value1");

  const runsResp = await client.send(
    new GetJobRunsCommand({ JobName: jobName }),
  );
  const found = runsResp.JobRuns!.find((r) => r.Id === runId);
  expect(found).toBeDefined();
  expect(found!.JobRunState).toBe("SUCCEEDED");
});

test("BatchStopJobRun on running job -> STOPPED", async () => {
  const jobName = "job-stop-con1839";

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
  const runId = startResp.JobRunId!;

  const stopResp = await client.send(
    new BatchStopJobRunCommand({ JobName: jobName, JobRunIds: [runId] }),
  );
  expect(stopResp.SuccessfulSubmissions).toBeDefined();
  expect(stopResp.SuccessfulSubmissions![0].JobRunId).toBe(runId);

  const getResp = await client.send(
    new GetJobRunCommand({ JobName: jobName, RunId: runId }),
  );
  expect(getResp.JobRun!.JobRunState).toBe("STOPPED");
});
