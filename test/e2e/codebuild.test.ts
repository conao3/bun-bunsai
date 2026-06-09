import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchDeleteBuildsCommand,
  BatchGetBuildBatchesCommand,
  BatchGetBuildsCommand,
  BatchGetCommandExecutionsCommand,
  BatchGetFleetsCommand,
  BatchGetProjectsCommand,
  BatchGetReportGroupsCommand,
  BatchGetReportsCommand,
  BatchGetSandboxesCommand,
  CodeBuildClient,
  CreateFleetCommand,
  CreateProjectCommand,
  CreateReportGroupCommand,
  CreateWebhookCommand,
  DeleteBuildBatchCommand,
  DeleteFleetCommand,
  DeleteProjectCommand,
  DeleteReportGroupCommand,
  DeleteResourcePolicyCommand,
  DeleteSourceCredentialsCommand,
  DeleteWebhookCommand,
  DescribeCodeCoveragesCommand,
  DescribeTestCasesCommand,
  GetReportGroupTrendCommand,
  GetResourcePolicyCommand,
  ImportSourceCredentialsCommand,
  InvalidateProjectCacheCommand,
  ListBuildBatchesCommand,
  ListBuildBatchesForProjectCommand,
  ListBuildsCommand,
  ListBuildsForProjectCommand,
  ListCommandExecutionsForSandboxCommand,
  ListCuratedEnvironmentImagesCommand,
  ListFleetsCommand,
  ListProjectsCommand,
  ListReportGroupsCommand,
  ListReportsCommand,
  ListReportsForReportGroupCommand,
  ListSandboxesCommand,
  ListSandboxesForProjectCommand,
  ListSharedProjectsCommand,
  ListSharedReportGroupsCommand,
  ListSourceCredentialsCommand,
  PutResourcePolicyCommand,
  RetryBuildBatchCommand,
  RetryBuildCommand,
  StartBuildBatchCommand,
  StartBuildCommand,
  StartCommandExecutionCommand,
  StartSandboxCommand,
  StartSandboxConnectionCommand,
  StopBuildBatchCommand,
  StopBuildCommand,
  StopSandboxCommand,
  UpdateFleetCommand,
  UpdateProjectCommand,
  UpdateProjectVisibilityCommand,
  UpdateReportGroupCommand,
  UpdateWebhookCommand,
} from "@aws-sdk/client-codebuild";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const codebuild = () =>
  new CodeBuildClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("CodeBuild project and build lifecycle", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-project";

  const created = await client.send(
    new CreateProjectCommand({
      name,
      description: "bunsai e2e project",
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );
  expect(created.project?.name).toBe(name);
  expect(created.project?.arn).toContain(`project/${name}`);
  expect(created.project?.description).toBe("bunsai e2e project");

  const listed = await client.send(new ListProjectsCommand({}));
  expect(listed.projects ?? []).toContain(name);

  const fetched = await client.send(
    new BatchGetProjectsCommand({ names: [name, "missing-project"] }),
  );
  expect((fetched.projects ?? [])[0]?.name).toBe(name);
  expect(fetched.projectsNotFound ?? []).toContain("missing-project");

  const updated = await client.send(
    new UpdateProjectCommand({
      name,
      description: "updated description",
    }),
  );
  expect(updated.project?.description).toBe("updated description");

  const started = await client.send(
    new StartBuildCommand({ projectName: name }),
  );
  const buildId = started.build?.id ?? "";
  expect(buildId).toContain(name);
  expect(started.build?.projectName).toBe(name);
  expect(started.build?.buildStatus).toBe("IN_PROGRESS");
  expect(started.build?.currentPhase).toBe("SUBMITTED");
  expect(started.build?.buildComplete).toBe(false);

  const builds = await client.send(
    new BatchGetBuildsCommand({ ids: [buildId, "missing-build"] }),
  );
  expect((builds.builds ?? [])[0]?.id).toBe(buildId);
  expect(builds.buildsNotFound ?? []).toContain("missing-build");

  await client.send(new DeleteProjectCommand({ name }));
  const afterDelete = await client.send(
    new BatchGetProjectsCommand({ names: [name] }),
  );
  expect(afterDelete.projectsNotFound ?? []).toContain(name);
});

test("CodeBuild build stop, retry, list, delete", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-build-ops";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const b1 = await client.send(new StartBuildCommand({ projectName: name }));
  const id1 = b1.build?.id ?? "";

  const stopped = await client.send(new StopBuildCommand({ id: id1 }));
  expect(stopped.build?.buildStatus).toBe("STOPPED");

  const retried = await client.send(new RetryBuildCommand({ id: id1 }));
  const id2 = retried.build?.id ?? "";
  expect(id2).not.toBe(id1);
  expect(retried.build?.buildStatus).toBe("IN_PROGRESS");
  expect(retried.build?.buildComplete).toBe(false);

  const listedAll = await client.send(new ListBuildsCommand({}));
  expect(listedAll.ids ?? []).toContain(id1);
  expect(listedAll.ids ?? []).toContain(id2);

  const listedForProject = await client.send(
    new ListBuildsForProjectCommand({ projectName: name }),
  );
  expect(listedForProject.ids ?? []).toContain(id1);

  const deleted = await client.send(
    new BatchDeleteBuildsCommand({ ids: [id1, id2] }),
  );
  expect((deleted.buildsDeleted ?? []).length).toBe(2);

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild InvalidateProjectCache", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-cache";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  await client.send(new InvalidateProjectCacheCommand({ projectName: name }));

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild UpdateProjectVisibility and ListSharedProjects", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-visibility";

  const created = await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );
  const arn = created.project?.arn ?? "";

  const visibility = await client.send(
    new UpdateProjectVisibilityCommand({
      projectArn: arn,
      projectVisibility: "PUBLIC_READ",
    }),
  );
  expect(visibility.projectArn).toBe(arn);
  expect(visibility.projectVisibility).toBe("PUBLIC_READ");

  const shared = await client.send(new ListSharedProjectsCommand({}));
  expect(shared.projects).toBeDefined();

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild build batch lifecycle", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-build-batch";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const started = await client.send(
    new StartBuildBatchCommand({ projectName: name }),
  );
  const batchId = started.buildBatch?.id ?? "";
  expect(batchId).toContain(name);
  expect(started.buildBatch?.buildBatchStatus).toBe("IN_PROGRESS");
  expect(started.buildBatch?.complete).toBe(false);

  const fetched = await client.send(
    new BatchGetBuildBatchesCommand({ ids: [batchId, "missing-batch"] }),
  );
  expect((fetched.buildBatches ?? [])[0]?.id).toBe(batchId);
  expect(fetched.buildBatchesNotFound ?? []).toContain("missing-batch");

  const listed = await client.send(new ListBuildBatchesCommand({}));
  expect(listed.ids ?? []).toContain(batchId);

  const listedForProject = await client.send(
    new ListBuildBatchesForProjectCommand({ projectName: name }),
  );
  expect(listedForProject.ids ?? []).toContain(batchId);

  const stopped = await client.send(new StopBuildBatchCommand({ id: batchId }));
  expect(stopped.buildBatch?.buildBatchStatus).toBe("STOPPED");

  const retried = await client.send(
    new RetryBuildBatchCommand({ id: batchId }),
  );
  const batchId2 = retried.buildBatch?.id ?? "";
  expect(batchId2).not.toBe(batchId);

  await client.send(new DeleteBuildBatchCommand({ id: batchId2 }));

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild fleet lifecycle", async () => {
  const client = codebuild();
  const fleetName = "bunsai-e2e-fleet";

  const created = await client.send(
    new CreateFleetCommand({
      name: fleetName,
      baseCapacity: 1,
      environmentType: "LINUX_CONTAINER",
      computeType: "BUILD_GENERAL1_SMALL",
    }),
  );
  const fleetArn = created.fleet?.arn ?? "";
  expect(fleetArn).toContain(`fleet/${fleetName}`);
  expect(created.fleet?.name).toBe(fleetName);
  expect(created.fleet?.baseCapacity).toBe(1);

  const fetched = await client.send(
    new BatchGetFleetsCommand({ names: [fleetName, "missing-fleet"] }),
  );
  expect((fetched.fleets ?? [])[0]?.name).toBe(fleetName);
  expect(fetched.fleetsNotFound ?? []).toContain("missing-fleet");

  const listed = await client.send(new ListFleetsCommand({}));
  expect(listed.fleets ?? []).toContain(fleetArn);

  const updated = await client.send(
    new UpdateFleetCommand({ arn: fleetArn, baseCapacity: 2 }),
  );
  expect(updated.fleet?.baseCapacity).toBe(2);

  await client.send(new DeleteFleetCommand({ arn: fleetArn }));

  const afterDelete = await client.send(
    new BatchGetFleetsCommand({ names: [fleetName] }),
  );
  expect(afterDelete.fleetsNotFound ?? []).toContain(fleetName);
});

test("CodeBuild report group lifecycle", async () => {
  const client = codebuild();
  const rgName = "bunsai-e2e-report-group";

  const created = await client.send(
    new CreateReportGroupCommand({
      name: rgName,
      type: "TEST",
      exportConfig: { exportConfigType: "NO_EXPORT" },
    }),
  );
  const rgArn = created.reportGroup?.arn ?? "";
  expect(rgArn).toContain(`report-group/${rgName}`);
  expect(created.reportGroup?.name).toBe(rgName);
  expect(created.reportGroup?.type).toBe("TEST");

  const fetched = await client.send(
    new BatchGetReportGroupsCommand({
      reportGroupArns: [
        rgArn,
        "arn:aws:codebuild:us-east-1:000000000000:report-group/missing",
      ],
    }),
  );
  expect((fetched.reportGroups ?? [])[0]?.arn).toBe(rgArn);
  expect(fetched.reportGroupsNotFound ?? []).toContain(
    "arn:aws:codebuild:us-east-1:000000000000:report-group/missing",
  );

  const listed = await client.send(new ListReportGroupsCommand({}));
  expect(listed.reportGroups ?? []).toContain(rgArn);

  const sharedGroups = await client.send(new ListSharedReportGroupsCommand({}));
  expect(sharedGroups.reportGroups).toBeDefined();

  const trend = await client.send(
    new GetReportGroupTrendCommand({
      reportGroupArn: rgArn,
      trendField: "PASS_RATE",
    }),
  );
  expect(trend.stats).toBeDefined();
  expect(trend.rawData).toBeDefined();

  const updated = await client.send(
    new UpdateReportGroupCommand({
      arn: rgArn,
      exportConfig: { exportConfigType: "NO_EXPORT" },
    }),
  );
  expect(updated.reportGroup?.arn).toBe(rgArn);

  const reports = await client.send(
    new ListReportsForReportGroupCommand({ reportGroupArn: rgArn }),
  );
  expect(reports.reports).toBeDefined();

  const allReports = await client.send(new ListReportsCommand({}));
  expect(allReports.reports).toBeDefined();

  const batchReports = await client.send(
    new BatchGetReportsCommand({
      reportArns: ["arn:aws:codebuild:us-east-1:000000000000:report/missing"],
    }),
  );
  expect(batchReports.reportsNotFound ?? []).toContain(
    "arn:aws:codebuild:us-east-1:000000000000:report/missing",
  );

  await client.send(new DeleteReportGroupCommand({ arn: rgArn }));

  const afterDelete = await client.send(
    new BatchGetReportGroupsCommand({ reportGroupArns: [rgArn] }),
  );
  expect(afterDelete.reportGroupsNotFound ?? []).toContain(rgArn);
});

test("CodeBuild DescribeCodeCoverages and DescribeTestCases error on missing report", async () => {
  const client = codebuild();
  const missingArn =
    "arn:aws:codebuild:us-east-1:000000000000:report/missing-report";

  await expect(
    client.send(new DescribeCodeCoveragesCommand({ reportArn: missingArn })),
  ).rejects.toThrow();

  await expect(
    client.send(new DescribeTestCasesCommand({ reportArn: missingArn })),
  ).rejects.toThrow();
});

test("CodeBuild webhook lifecycle", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-webhook";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "GITHUB", location: "https://github.com/example/repo" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const created = await client.send(
    new CreateWebhookCommand({ projectName: name }),
  );
  expect(created.webhook?.payloadUrl).toContain(name);

  const updated = await client.send(
    new UpdateWebhookCommand({ projectName: name, branchFilter: "main" }),
  );
  expect(updated.webhook?.branchFilter).toBe("main");

  await client.send(new DeleteWebhookCommand({ projectName: name }));

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild sandbox lifecycle", async () => {
  const client = codebuild();

  const started = await client.send(new StartSandboxCommand({}));
  const sandboxId = started.sandbox?.id ?? "";
  expect(sandboxId).toBeTruthy();
  expect((started.sandbox?.status as { statusCode?: string })?.statusCode).toBe(
    "READY",
  );

  const fetched = await client.send(
    new BatchGetSandboxesCommand({ ids: [sandboxId, "missing-sandbox"] }),
  );
  expect((fetched.sandboxes ?? [])[0]?.id).toBe(sandboxId);
  expect(fetched.sandboxesNotFound ?? []).toContain("missing-sandbox");

  const listed = await client.send(new ListSandboxesCommand({}));
  expect(listed.ids ?? []).toContain(sandboxId);

  const connection = await client.send(
    new StartSandboxConnectionCommand({ sandboxId }),
  );
  expect(connection.ssmSession?.sessionId).toBeTruthy();

  const cmdStarted = await client.send(
    new StartCommandExecutionCommand({
      sandboxId,
      command: "echo hello",
      type: "SHELL",
    }),
  );
  const cmdId = cmdStarted.commandExecution?.id ?? "";
  expect(cmdId).toBeTruthy();
  expect(cmdStarted.commandExecution?.status).toBe("SUCCEEDED");

  const batchCmds = await client.send(
    new BatchGetCommandExecutionsCommand({
      sandboxId,
      commandExecutionIds: [cmdId, "missing-cmd"],
    }),
  );
  expect((batchCmds.commandExecutions ?? [])[0]?.id).toBe(cmdId);
  expect(batchCmds.commandExecutionsNotFound ?? []).toContain("missing-cmd");

  const listedCmds = await client.send(
    new ListCommandExecutionsForSandboxCommand({ sandboxId }),
  );
  expect((listedCmds.commandExecutions ?? []).some((c) => c.id === cmdId)).toBe(
    true,
  );

  const stopped = await client.send(new StopSandboxCommand({ id: sandboxId }));
  expect((stopped.sandbox?.status as { statusCode?: string })?.statusCode).toBe(
    "STOPPED",
  );
});

test("CodeBuild sandbox for project", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-sandbox-project";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const sb = await client.send(new StartSandboxCommand({ projectName: name }));
  const sbId = sb.sandbox?.id ?? "";

  const listedForProject = await client.send(
    new ListSandboxesForProjectCommand({ projectName: name }),
  );
  expect(listedForProject.ids ?? []).toContain(sbId);

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild source credentials lifecycle", async () => {
  const client = codebuild();

  const imported = await client.send(
    new ImportSourceCredentialsCommand({
      serverType: "GITHUB",
      authType: "PERSONAL_ACCESS_TOKEN",
      token: "fake-token",
    }),
  );
  const credArn = imported.arn ?? "";
  expect(credArn).toContain("token/github");

  const listed = await client.send(new ListSourceCredentialsCommand({}));
  expect(
    (listed.sourceCredentialsInfos ?? []).some((c) => c.arn === credArn),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteSourceCredentialsCommand({ arn: credArn }),
  );
  expect(deleted.arn).toBe(credArn);

  const afterDelete = await client.send(new ListSourceCredentialsCommand({}));
  expect(
    (afterDelete.sourceCredentialsInfos ?? []).some((c) => c.arn === credArn),
  ).toBe(false);
});

test("CodeBuild resource policy lifecycle", async () => {
  const client = codebuild();
  const rgName = "bunsai-e2e-policy-rg";

  const rg = await client.send(
    new CreateReportGroupCommand({
      name: rgName,
      type: "TEST",
      exportConfig: { exportConfigType: "NO_EXPORT" },
    }),
  );
  const rgArn = rg.reportGroup?.arn ?? "";

  const policy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "*", Resource: rgArn }],
  });

  const put = await client.send(
    new PutResourcePolicyCommand({ policy, resourceArn: rgArn }),
  );
  expect(put.resourceArn).toBe(rgArn);

  const got = await client.send(
    new GetResourcePolicyCommand({ resourceArn: rgArn }),
  );
  expect(got.policy).toBe(policy);

  await client.send(new DeleteResourcePolicyCommand({ resourceArn: rgArn }));

  await expect(
    client.send(new GetResourcePolicyCommand({ resourceArn: rgArn })),
  ).rejects.toThrow();

  await client.send(new DeleteReportGroupCommand({ arn: rgArn }));
});

test("CodeBuild ListCuratedEnvironmentImages", async () => {
  const client = codebuild();

  const result = await client.send(new ListCuratedEnvironmentImagesCommand({}));
  expect((result.platforms ?? []).length).toBeGreaterThan(0);
});

test("CodeBuild ListBuildBatches pagination", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-batch-pagination";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const b1 = await client.send(
    new StartBuildBatchCommand({ projectName: name }),
  );
  const b2 = await client.send(
    new StartBuildBatchCommand({ projectName: name }),
  );
  const b3 = await client.send(
    new StartBuildBatchCommand({ projectName: name }),
  );
  const id1 = b1.buildBatch?.id ?? "";
  const id2 = b2.buildBatch?.id ?? "";
  const id3 = b3.buildBatch?.id ?? "";

  expect(b1.buildBatch?.buildBatchStatus).toBe("IN_PROGRESS");

  const page1 = await client.send(
    new ListBuildBatchesForProjectCommand({ projectName: name, maxResults: 2 }),
  );
  expect((page1.ids ?? []).length).toBe(2);
  expect(page1.nextToken).toBeDefined();

  const page2 = await client.send(
    new ListBuildBatchesForProjectCommand({
      projectName: name,
      maxResults: 2,
      nextToken: page1.nextToken,
    }),
  );
  expect((page2.ids ?? []).length).toBe(1);
  expect(page2.nextToken).toBeUndefined();

  const allIds = [...(page1.ids ?? []), ...(page2.ids ?? [])];
  expect(allIds).toContain(id1);
  expect(allIds).toContain(id2);
  expect(allIds).toContain(id3);

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild ListBuildBatches status filter", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-batch-filter";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const batch1 = await client.send(
    new StartBuildBatchCommand({ projectName: name }),
  );
  const batchId1 = batch1.buildBatch?.id ?? "";
  expect(batch1.buildBatch?.buildBatchStatus).toBe("IN_PROGRESS");

  await client.send(new StopBuildBatchCommand({ id: batchId1 }));

  const batch2 = await client.send(
    new StartBuildBatchCommand({ projectName: name }),
  );
  const batchId2 = batch2.buildBatch?.id ?? "";

  const inProgress = await client.send(
    new ListBuildBatchesCommand({ filter: { status: "IN_PROGRESS" } }),
  );
  expect(inProgress.ids ?? []).toContain(batchId2);
  expect(inProgress.ids ?? []).not.toContain(batchId1);

  const stopped = await client.send(
    new ListBuildBatchesCommand({ filter: { status: "STOPPED" } }),
  );
  expect(stopped.ids ?? []).toContain(batchId1);
  expect(stopped.ids ?? []).not.toContain(batchId2);

  await client.send(new DeleteProjectCommand({ name }));
});

test("CodeBuild RetryBuild rejects non-retryable state", async () => {
  const client = codebuild();
  const name = "bunsai-e2e-retry-validation";

  await client.send(
    new CreateProjectCommand({
      name,
      source: { type: "NO_SOURCE", buildspec: "version: 0.2" },
      artifacts: { type: "NO_ARTIFACTS" },
      environment: {
        type: "LINUX_CONTAINER",
        image: "aws/codebuild/standard:7.0",
        computeType: "BUILD_GENERAL1_SMALL",
      },
      serviceRole: `arn:aws:iam::000000000000:role/codebuild-${name}`,
    }),
  );

  const b = await client.send(new StartBuildCommand({ projectName: name }));
  const id = b.build?.id ?? "";
  expect(b.build?.buildStatus).toBe("IN_PROGRESS");

  await expect(client.send(new RetryBuildCommand({ id }))).rejects.toThrow();

  await client.send(new DeleteProjectCommand({ name }));
});
