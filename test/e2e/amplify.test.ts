import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AmplifyClient,
  CreateAppCommand,
  CreateBackendEnvironmentCommand,
  CreateBranchCommand,
  CreateDeploymentCommand,
  CreateDomainAssociationCommand,
  CreateWebhookCommand,
  DeleteAppCommand,
  DeleteBackendEnvironmentCommand,
  DeleteBranchCommand,
  DeleteDomainAssociationCommand,
  DeleteJobCommand,
  DeleteWebhookCommand,
  GenerateAccessLogsCommand,
  GetAppCommand,
  GetArtifactUrlCommand,
  GetBackendEnvironmentCommand,
  GetBranchCommand,
  GetDomainAssociationCommand,
  GetJobCommand,
  GetWebhookCommand,
  ListAppsCommand,
  ListArtifactsCommand,
  ListBackendEnvironmentsCommand,
  ListBranchesCommand,
  ListDomainAssociationsCommand,
  ListJobsCommand,
  ListTagsForResourceCommand,
  ListWebhooksCommand,
  StartDeploymentCommand,
  StartJobCommand,
  StopJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAppCommand,
  UpdateBranchCommand,
  UpdateDomainAssociationCommand,
  UpdateWebhookCommand,
} from "@aws-sdk/client-amplify";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const amplify = () =>
  new AmplifyClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("Amplify app and branch roundtrip", async () => {
  const client = amplify();
  const appName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateAppCommand({
      name: appName,
      repository: "https://github.com/example/repo",
      platform: "WEB",
      environmentVariables: { STAGE: "dev" },
    }),
  );
  const appId = created.app?.appId;
  expect(appId).toBeDefined();
  expect(created.app?.name).toBe(appName);
  expect(created.app?.appArn).toContain(`apps/${appId}`);
  expect(created.app?.defaultDomain).toBeDefined();

  const got = await client.send(new GetAppCommand({ appId }));
  expect(got.app?.appId).toBe(appId);
  expect(got.app?.name).toBe(appName);

  const listed = await client.send(new ListAppsCommand({}));
  expect((listed.apps ?? []).map((app) => app.appId)).toContain(appId);

  const updated = await client.send(
    new UpdateAppCommand({ appId, description: "updated by bunsai" }),
  );
  expect(updated.app?.description).toBe("updated by bunsai");

  const branchName = `feat-${Date.now()}`;
  const branch = await client.send(
    new CreateBranchCommand({
      appId,
      branchName,
      stage: "DEVELOPMENT",
      environmentVariables: { KEY: "value" },
    }),
  );
  expect(branch.branch?.branchName).toBe(branchName);
  expect(branch.branch?.branchArn).toContain(
    `apps/${appId}/branches/${branchName}`,
  );
  expect(branch.branch?.stage).toBe("DEVELOPMENT");

  const gotBranch = await client.send(
    new GetBranchCommand({ appId, branchName }),
  );
  expect(gotBranch.branch?.branchName).toBe(branchName);

  const listedBranches = await client.send(new ListBranchesCommand({ appId }));
  expect((listedBranches.branches ?? []).map((b) => b.branchName)).toContain(
    branchName,
  );

  const deleted = await client.send(new DeleteAppCommand({ appId }));
  expect(deleted.app?.appId).toBe(appId);

  await expect(client.send(new GetAppCommand({ appId }))).rejects.toThrow();
});

test("Amplify backend environment operations", async () => {
  const client = amplify();
  const appName = `bunsai-be-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  expect(appId).toBeTruthy();

  const envName = `staging-${Date.now()}`;
  const created = await client.send(
    new CreateBackendEnvironmentCommand({
      appId,
      environmentName: envName,
      stackName: "my-stack",
      deploymentArtifacts: "artifacts-bucket",
    }),
  );
  expect(created.backendEnvironment?.environmentName).toBe(envName);
  expect(created.backendEnvironment?.stackName).toBe("my-stack");
  expect(created.backendEnvironment?.backendEnvironmentArn).toContain(envName);

  const got = await client.send(
    new GetBackendEnvironmentCommand({ appId, environmentName: envName }),
  );
  expect(got.backendEnvironment?.environmentName).toBe(envName);

  const listed = await client.send(
    new ListBackendEnvironmentsCommand({ appId }),
  );
  expect(
    (listed.backendEnvironments ?? []).map((e) => e.environmentName),
  ).toContain(envName);

  const deleted = await client.send(
    new DeleteBackendEnvironmentCommand({ appId, environmentName: envName }),
  );
  expect(deleted.backendEnvironment?.environmentName).toBe(envName);

  const listedAfter = await client.send(
    new ListBackendEnvironmentsCommand({ appId }),
  );
  expect(
    (listedAfter.backendEnvironments ?? []).map((e) => e.environmentName),
  ).not.toContain(envName);

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify domain association operations", async () => {
  const client = amplify();
  const appName = `bunsai-domain-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `main-${Date.now()}`;
  await client.send(new CreateBranchCommand({ appId, branchName }));

  const domainName = `example-${Date.now()}.com`;
  const created = await client.send(
    new CreateDomainAssociationCommand({
      appId,
      domainName,
      enableAutoSubDomain: false,
      subDomainSettings: [{ prefix: "", branchName }],
    }),
  );
  expect(created.domainAssociation?.domainName).toBe(domainName);
  expect(created.domainAssociation?.domainAssociationArn).toContain(domainName);
  expect(created.domainAssociation?.subDomains?.length).toBeGreaterThan(0);

  const got = await client.send(
    new GetDomainAssociationCommand({ appId, domainName }),
  );
  expect(got.domainAssociation?.domainName).toBe(domainName);

  const listed = await client.send(
    new ListDomainAssociationsCommand({ appId }),
  );
  expect((listed.domainAssociations ?? []).map((d) => d.domainName)).toContain(
    domainName,
  );

  const updated = await client.send(
    new UpdateDomainAssociationCommand({
      appId,
      domainName,
      enableAutoSubDomain: true,
    }),
  );
  expect(updated.domainAssociation?.enableAutoSubDomain).toBe(true);

  const deleted = await client.send(
    new DeleteDomainAssociationCommand({ appId, domainName }),
  );
  expect(deleted.domainAssociation?.domainName).toBe(domainName);

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify webhook operations", async () => {
  const client = amplify();
  const appName = `bunsai-wh-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `main-${Date.now()}`;
  await client.send(new CreateBranchCommand({ appId, branchName }));

  const created = await client.send(
    new CreateWebhookCommand({
      appId,
      branchName,
      description: "test webhook",
    }),
  );
  const webhookId = created.webhook?.webhookId ?? "";
  expect(webhookId).toBeTruthy();
  expect(created.webhook?.branchName).toBe(branchName);
  expect(created.webhook?.webhookUrl).toContain(webhookId);

  const got = await client.send(new GetWebhookCommand({ webhookId }));
  expect(got.webhook?.webhookId).toBe(webhookId);
  expect(got.webhook?.appId).toBe(appId);

  const listed = await client.send(new ListWebhooksCommand({ appId }));
  expect((listed.webhooks ?? []).map((w) => w.webhookId)).toContain(webhookId);

  const updated = await client.send(
    new UpdateWebhookCommand({ webhookId, description: "updated webhook" }),
  );
  expect(updated.webhook?.description).toBe("updated webhook");

  const deleted = await client.send(new DeleteWebhookCommand({ webhookId }));
  expect(deleted.webhook?.webhookId).toBe(webhookId);

  await expect(
    client.send(new GetWebhookCommand({ webhookId })),
  ).rejects.toThrow();

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify branch update and delete", async () => {
  const client = amplify();
  const appName = `bunsai-br-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `feat-${Date.now()}`;
  await client.send(
    new CreateBranchCommand({ appId, branchName, stage: "DEVELOPMENT" }),
  );

  const updated = await client.send(
    new UpdateBranchCommand({
      appId,
      branchName,
      description: "updated branch",
      framework: "React",
    }),
  );
  expect(updated.branch?.description).toBe("updated branch");
  expect(updated.branch?.framework).toBe("React");

  const deleted = await client.send(
    new DeleteBranchCommand({ appId, branchName }),
  );
  expect(deleted.branch?.branchName).toBe(branchName);

  const listed = await client.send(new ListBranchesCommand({ appId }));
  expect((listed.branches ?? []).map((b) => b.branchName)).not.toContain(
    branchName,
  );

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify job operations", async () => {
  const client = amplify();
  const appName = `bunsai-job-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `main-${Date.now()}`;
  await client.send(new CreateBranchCommand({ appId, branchName }));

  const started = await client.send(
    new StartJobCommand({
      appId,
      branchName,
      jobType: "RELEASE",
      commitId: "abc123",
      commitMessage: "test commit",
    }),
  );
  const jobId = started.jobSummary?.jobId ?? "";
  expect(jobId).toBeTruthy();
  expect(started.jobSummary?.status).toBe("PENDING");
  expect(started.jobSummary?.jobType).toBe("RELEASE");

  const got = await client.send(
    new GetJobCommand({ appId, branchName, jobId }),
  );
  expect(got.job?.summary?.jobId).toBe(jobId);
  expect(got.job?.steps?.length).toBeGreaterThan(0);

  const listed = await client.send(new ListJobsCommand({ appId, branchName }));
  expect((listed.jobSummaries ?? []).map((j) => j.jobId)).toContain(jobId);

  const artifacts = await client.send(
    new ListArtifactsCommand({ appId, branchName, jobId }),
  );
  expect(artifacts.artifacts).toBeDefined();

  if ((artifacts.artifacts?.length ?? 0) > 0) {
    const artifactId = artifacts.artifacts![0].artifactId ?? "";
    const artifactUrl = await client.send(
      new GetArtifactUrlCommand({ artifactId }),
    );
    expect(artifactUrl.artifactId).toBe(artifactId);
    expect(artifactUrl.artifactUrl).toContain(artifactId);
  }

  const stopped = await client.send(
    new StopJobCommand({ appId, branchName, jobId }),
  );
  expect(stopped.jobSummary?.status).toBe("CANCELLING");

  const startedJob2 = await client.send(
    new StartJobCommand({ appId, branchName, jobType: "MANUAL" }),
  );
  const jobId2 = startedJob2.jobSummary?.jobId ?? "";
  const deleted = await client.send(
    new DeleteJobCommand({ appId, branchName, jobId: jobId2 }),
  );
  expect(deleted.jobSummary?.jobId).toBe(jobId2);

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify deployment operations", async () => {
  const client = amplify();
  const appName = `bunsai-deploy-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `main-${Date.now()}`;
  await client.send(new CreateBranchCommand({ appId, branchName }));

  const deployment = await client.send(
    new CreateDeploymentCommand({
      appId,
      branchName,
      fileMap: { "index.html": "d41d8cd98f00b204e9800998ecf8427e" },
    }),
  );
  expect(deployment.zipUploadUrl).toContain("amazonaws.com");
  expect(deployment.fileUploadUrls?.["index.html"]).toContain("index.html");

  const started = await client.send(
    new StartDeploymentCommand({
      appId,
      branchName,
      sourceUrl: "https://example.com/deploy.zip",
    }),
  );
  expect(started.jobSummary?.status).toBe("RUNNING");

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify generate access logs", async () => {
  const client = amplify();
  const appName = `bunsai-logs-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";

  const result = await client.send(
    new GenerateAccessLogsCommand({
      appId,
      domainName: "example.com",
    }),
  );
  expect(result.logUrl).toContain("amazonaws.com");

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify ListApps pagination", async () => {
  const client = amplify();
  const prefix = `bunsai-page-${Date.now()}`;
  const appIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { app } = await client.send(
      new CreateAppCommand({ name: `${prefix}-${i}`, platform: "WEB" }),
    );
    appIds.push(app?.appId ?? "");
  }

  const page1 = await client.send(new ListAppsCommand({ maxResults: 2 }));
  expect((page1.apps ?? []).length).toBeGreaterThanOrEqual(2);
  const token = page1.nextToken;

  if (token !== undefined) {
    const page2 = await client.send(
      new ListAppsCommand({ maxResults: 2, nextToken: token }),
    );
    const allIds = [
      ...(page1.apps ?? []).map((a) => a.appId ?? ""),
      ...(page2.apps ?? []).map((a) => a.appId ?? ""),
    ];
    for (const id of appIds) {
      expect(allIds).toContain(id);
    }
  }

  for (const id of appIds) {
    await client.send(new DeleteAppCommand({ appId: id }));
  }
});

test("Amplify unified tag store via GetApp", async () => {
  const client = amplify();
  const appName = `bunsai-utag-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({
      name: appName,
      platform: "WEB",
      tags: { initial: "yes" },
    }),
  );
  const appId = app?.appId ?? "";
  const resourceArn = app?.appArn ?? "";

  await client.send(
    new TagResourceCommand({ resourceArn, tags: { added: "later" } }),
  );

  const got = await client.send(new GetAppCommand({ appId }));
  expect(got.app?.tags?.["initial"]).toBe("yes");
  expect(got.app?.tags?.["added"]).toBe("later");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["initial"] }),
  );

  const got2 = await client.send(new GetAppCommand({ appId }));
  expect(got2.app?.tags?.["initial"]).toBe("yes");
  expect(got2.app?.tags?.["added"]).toBe("later");

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify domain lifecycle", async () => {
  const client = amplify();
  const appName = `bunsai-dlc-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `main-${Date.now()}`;
  await client.send(new CreateBranchCommand({ appId, branchName }));

  const domainName = `lifecycle-${Date.now()}.com`;
  const created = await client.send(
    new CreateDomainAssociationCommand({
      appId,
      domainName,
      subDomainSettings: [{ prefix: "", branchName }],
    }),
  );
  expect(created.domainAssociation?.domainStatus).toBe("PENDING_VERIFICATION");

  const got1 = await client.send(
    new GetDomainAssociationCommand({ appId, domainName }),
  );
  expect(got1.domainAssociation?.domainStatus).toBe("IN_PROGRESS");

  const got2 = await client.send(
    new GetDomainAssociationCommand({ appId, domainName }),
  );
  expect(got2.domainAssociation?.domainStatus).toBe("AVAILABLE");

  const got3 = await client.send(
    new GetDomainAssociationCommand({ appId, domainName }),
  );
  expect(got3.domainAssociation?.domainStatus).toBe("AVAILABLE");

  await client.send(new DeleteDomainAssociationCommand({ appId, domainName }));
  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify job lifecycle", async () => {
  const client = amplify();
  const appName = `bunsai-jlc-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const branchName = `main-${Date.now()}`;
  await client.send(new CreateBranchCommand({ appId, branchName }));

  const { jobSummary } = await client.send(
    new StartJobCommand({ appId, branchName, jobType: "RELEASE" }),
  );
  const jobId = jobSummary?.jobId ?? "";
  expect(jobSummary?.status).toBe("PENDING");

  const step1 = await client.send(
    new GetJobCommand({ appId, branchName, jobId }),
  );
  expect(step1.job?.summary?.status).toBe("PROVISIONING");

  const step2 = await client.send(
    new GetJobCommand({ appId, branchName, jobId }),
  );
  expect(step2.job?.summary?.status).toBe("RUNNING");

  const step3 = await client.send(
    new GetJobCommand({ appId, branchName, jobId }),
  );
  expect(step3.job?.summary?.status).toBe("RUNNING");

  const { jobSummary: stopResult } = await client.send(
    new StopJobCommand({ appId, branchName, jobId }),
  );
  expect(stopResult?.status).toBe("CANCELLING");

  const cancelled = await client.send(
    new GetJobCommand({ appId, branchName, jobId }),
  );
  expect(cancelled.job?.summary?.status).toBe("CANCELLED");

  await client.send(new DeleteAppCommand({ appId }));
});

test("Amplify tag operations", async () => {
  const client = amplify();
  const appName = `bunsai-tags-${Date.now()}`;
  const { app } = await client.send(
    new CreateAppCommand({ name: appName, platform: "WEB" }),
  );
  const appId = app?.appId ?? "";
  const resourceArn = app?.appArn ?? "";
  expect(resourceArn).toContain(`apps/${appId}`);

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "infra" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags?.["env"]).toBe("test");
  expect(listed.tags?.["team"]).toBe("infra");

  await client.send(
    new UntagResourceCommand({ resourceArn, tagKeys: ["env"] }),
  );

  const listedAfter = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listedAfter.tags?.["env"]).toBeUndefined();
  expect(listedAfter.tags?.["team"]).toBe("infra");

  await client.send(new DeleteAppCommand({ appId }));
});
