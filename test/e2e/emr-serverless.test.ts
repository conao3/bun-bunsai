import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelJobRunCommand,
  CreateApplicationCommand,
  DeleteApplicationCommand,
  EMRServerlessClient,
  GetApplicationCommand,
  GetDashboardForJobRunCommand,
  GetJobRunCommand,
  GetResourceDashboardCommand,
  GetSessionCommand,
  GetSessionEndpointCommand,
  ListApplicationsCommand,
  ListJobRunAttemptsCommand,
  ListJobRunsCommand,
  ListSessionsCommand,
  ListTagsForResourceCommand,
  StartApplicationCommand,
  StartJobRunCommand,
  StartSessionCommand,
  StopApplicationCommand,
  TagResourceCommand,
  TerminateSessionCommand,
  UntagResourceCommand,
  UpdateApplicationCommand,
} from "@aws-sdk/client-emr-serverless";
import type { SessionState } from "@aws-sdk/client-emr-serverless";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const emr = () =>
  new EMRServerlessClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("EMR Serverless application roundtrip", async () => {
  const client = emr();
  const appName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateApplicationCommand({
      name: appName,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  expect(created.applicationId).toBeDefined();
  expect(created.arn).toBeDefined();
  expect(created.name).toBe(appName);
  const applicationId = created.applicationId ?? "";

  const got = await client.send(new GetApplicationCommand({ applicationId }));
  expect(got.application?.applicationId).toBe(applicationId);
  expect(got.application?.name).toBe(appName);
  expect(got.application?.releaseLabel).toBe("emr-7.1.0");
  expect(got.application?.type).toBe("SPARK");
  expect(got.application?.state).toBe("CREATED");

  const listed = await client.send(new ListApplicationsCommand({}));
  expect((listed.applications ?? []).map((a) => a.id)).toContain(applicationId);

  await client.send(new DeleteApplicationCommand({ applicationId }));
  await expect(
    client.send(new GetApplicationCommand({ applicationId })),
  ).rejects.toThrow();
});

test("EMR Serverless application lifecycle: start and stop", async () => {
  const client = emr();
  const created = await client.send(
    new CreateApplicationCommand({
      name: `lifecycle-${Date.now()}`,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  const applicationId = created.applicationId ?? "";

  await client.send(new StartApplicationCommand({ applicationId }));
  const started = await client.send(
    new GetApplicationCommand({ applicationId }),
  );
  expect(started.application?.state).toBe("STARTED");

  await client.send(new StopApplicationCommand({ applicationId }));
  const stopped = await client.send(
    new GetApplicationCommand({ applicationId }),
  );
  expect(stopped.application?.state).toBe("STOPPED");

  await client.send(new DeleteApplicationCommand({ applicationId }));
});

test("EMR Serverless UpdateApplication", async () => {
  const client = emr();
  const created = await client.send(
    new CreateApplicationCommand({
      name: `update-${Date.now()}`,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  const applicationId = created.applicationId ?? "";

  const updated = await client.send(
    new UpdateApplicationCommand({
      applicationId,
      clientToken: crypto.randomUUID(),
      architecture: "ARM64",
    }),
  );
  expect(updated.application?.applicationId).toBe(applicationId);
  expect(updated.application?.architecture).toBe("ARM64");

  await client.send(new DeleteApplicationCommand({ applicationId }));
});

test("EMR Serverless job run lifecycle", async () => {
  const client = emr();
  const app = await client.send(
    new CreateApplicationCommand({
      name: `jobrun-app-${Date.now()}`,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  const applicationId = app.applicationId ?? "";

  const started = await client.send(
    new StartJobRunCommand({
      applicationId,
      clientToken: crypto.randomUUID(),
      executionRoleArn: "arn:aws:iam::123456789012:role/EMRServerlessRole",
      name: "test-job",
    }),
  );
  expect(started.applicationId).toBe(applicationId);
  expect(started.jobRunId).toBeDefined();
  expect(started.arn).toBeDefined();
  const jobRunId = started.jobRunId ?? "";

  const got = await client.send(
    new GetJobRunCommand({ applicationId, jobRunId }),
  );
  expect(got.jobRun?.applicationId).toBe(applicationId);
  expect(got.jobRun?.jobRunId).toBe(jobRunId);
  expect(got.jobRun?.state).toBe("SUBMITTED");

  const listed = await client.send(new ListJobRunsCommand({ applicationId }));
  expect((listed.jobRuns ?? []).map((r) => r.id)).toContain(jobRunId);

  const attempts = await client.send(
    new ListJobRunAttemptsCommand({ applicationId, jobRunId }),
  );
  expect((attempts.jobRunAttempts ?? []).length).toBeGreaterThan(0);
  expect(attempts.jobRunAttempts?.[0]?.id).toBe(jobRunId);

  const dashboard = await client.send(
    new GetDashboardForJobRunCommand({ applicationId, jobRunId }),
  );
  expect(dashboard.url).toBeDefined();

  const cancelled = await client.send(
    new CancelJobRunCommand({ applicationId, jobRunId }),
  );
  expect(cancelled.applicationId).toBe(applicationId);
  expect(cancelled.jobRunId).toBe(jobRunId);

  const cancelledRun = await client.send(
    new GetJobRunCommand({ applicationId, jobRunId }),
  );
  expect(cancelledRun.jobRun?.state).toBe("CANCELLED");

  await client.send(new DeleteApplicationCommand({ applicationId }));
});

test("EMR Serverless GetResourceDashboard", async () => {
  const client = emr();
  const app = await client.send(
    new CreateApplicationCommand({
      name: `dashboard-app-${Date.now()}`,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  const applicationId = app.applicationId ?? "";

  const session = await client.send(
    new StartSessionCommand({
      applicationId,
      clientToken: crypto.randomUUID(),
      executionRoleArn: "arn:aws:iam::123456789012:role/EMRServerlessRole",
    }),
  );
  const sessionId = session.sessionId ?? "";

  const dashboard = await client.send(
    new GetResourceDashboardCommand({
      applicationId,
      resourceId: sessionId,
      resourceType: "SESSION",
    }),
  );
  expect(dashboard.url).toBeDefined();

  await client.send(new DeleteApplicationCommand({ applicationId }));
});

test("EMR Serverless session lifecycle", async () => {
  const client = emr();
  const app = await client.send(
    new CreateApplicationCommand({
      name: `session-app-${Date.now()}`,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  const applicationId = app.applicationId ?? "";

  const started = await client.send(
    new StartSessionCommand({
      applicationId,
      clientToken: crypto.randomUUID(),
      executionRoleArn: "arn:aws:iam::123456789012:role/EMRServerlessRole",
      name: "test-session",
    }),
  );
  expect(started.applicationId).toBe(applicationId);
  expect(started.sessionId).toBeDefined();
  expect(started.arn).toBeDefined();
  const sessionId = started.sessionId ?? "";

  const got = await client.send(
    new GetSessionCommand({ applicationId, sessionId }),
  );
  expect(got.session?.applicationId).toBe(applicationId);
  expect(got.session?.sessionId).toBe(sessionId);
  expect(got.session?.state).toBe("CREATING" as SessionState);

  const listed = await client.send(new ListSessionsCommand({ applicationId }));
  expect((listed.sessions ?? []).map((s) => s.sessionId)).toContain(sessionId);

  const ep = await client.send(
    new GetSessionEndpointCommand({ applicationId, sessionId }),
  );
  expect(ep.applicationId).toBe(applicationId);
  expect(ep.sessionId).toBe(sessionId);
  expect(ep.endpoint).toBeDefined();
  expect(ep.authToken).toBeDefined();
  expect(ep.authTokenExpiresAt).toBeDefined();

  const terminated = await client.send(
    new TerminateSessionCommand({ applicationId, sessionId }),
  );
  expect(terminated.applicationId).toBe(applicationId);
  expect(terminated.sessionId).toBe(sessionId);

  const terminatedSession = await client.send(
    new GetSessionCommand({ applicationId, sessionId }),
  );
  expect(terminatedSession.session?.state).toBe("TERMINATING");

  await client.send(new DeleteApplicationCommand({ applicationId }));
});

test("EMR Serverless tag operations", async () => {
  const client = emr();
  const app = await client.send(
    new CreateApplicationCommand({
      name: `tag-app-${Date.now()}`,
      releaseLabel: "emr-7.1.0",
      type: "SPARK",
      clientToken: crypto.randomUUID(),
    }),
  );
  const resourceArn = app.arn ?? "";

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", owner: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.env).toBe("test");
  expect(listed.tags?.owner).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["owner"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(afterUntag.tags?.env).toBe("test");
  expect(afterUntag.tags?.owner).toBeUndefined();

  const applicationId = app.applicationId ?? "";
  await client.send(new DeleteApplicationCommand({ applicationId }));
});
