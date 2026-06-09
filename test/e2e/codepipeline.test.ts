import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { createBunsaiApp } from "../../apps/server/src/server.ts";
import {
  AcknowledgeJobCommand,
  CodePipelineClient,
  CreateCustomActionTypeCommand,
  CreatePipelineCommand,
  DeleteCustomActionTypeCommand,
  DeletePipelineCommand,
  DeleteWebhookCommand,
  DeregisterWebhookWithThirdPartyCommand,
  DisableStageTransitionCommand,
  EnableStageTransitionCommand,
  GetActionTypeCommand,
  GetPipelineCommand,
  GetPipelineExecutionCommand,
  GetPipelineStateCommand,
  ListActionExecutionsCommand,
  ListActionTypesCommand,
  ListDeployActionExecutionTargetsCommand,
  ListPipelineExecutionsCommand,
  ListPipelinesCommand,
  ListRuleExecutionsCommand,
  ListRuleTypesCommand,
  ListTagsForResourceCommand,
  ListWebhooksCommand,
  PollForJobsCommand,
  PollForThirdPartyJobsCommand,
  PutApprovalResultCommand,
  PutWebhookCommand,
  RegisterWebhookWithThirdPartyCommand,
  RetryStageExecutionCommand,
  RollbackStageCommand,
  StartPipelineExecutionCommand,
  StopPipelineExecutionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateActionTypeCommand,
  UpdatePipelineCommand,
} from "@aws-sdk/client-codepipeline";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const codepipeline = () =>
  new CodePipelineClient({ endpoint, region, credentials, requestHandler });

const makePipeline = (name: string) => ({
  name,
  roleArn: "arn:aws:iam::000000000000:role/bunsai-e2e-codepipeline",
  artifactStore: { type: "S3" as const, location: "bunsai-e2e-artifacts" },
  stages: [
    {
      name: "Source",
      actions: [
        {
          name: "Source",
          actionTypeId: {
            category: "Source" as const,
            owner: "AWS" as const,
            provider: "S3",
            version: "1",
          },
          configuration: {
            S3Bucket: "bunsai-e2e-bucket",
            S3ObjectKey: "source.zip",
          },
          outputArtifacts: [{ name: "SourceArtifact" }],
        },
      ],
    },
    {
      name: "Build",
      actions: [
        {
          name: "Build",
          actionTypeId: {
            category: "Build" as const,
            owner: "AWS" as const,
            provider: "CodeBuild",
            version: "1",
          },
          configuration: { ProjectName: "bunsai-e2e-project" },
          inputArtifacts: [{ name: "SourceArtifact" }],
        },
      ],
    },
  ],
});

test("CodePipeline pipeline lifecycle roundtrip", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-${Date.now()}`;
  const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-codepipeline";
  const stages = [
    {
      name: "Source",
      actions: [
        {
          name: "Source",
          actionTypeId: {
            category: "Source" as const,
            owner: "AWS" as const,
            provider: "S3",
            version: "1",
          },
          configuration: {
            S3Bucket: "bunsai-e2e-bucket",
            S3ObjectKey: "source.zip",
          },
          outputArtifacts: [{ name: "SourceArtifact" }],
        },
      ],
    },
    {
      name: "Build",
      actions: [
        {
          name: "Build",
          actionTypeId: {
            category: "Build" as const,
            owner: "AWS" as const,
            provider: "CodeBuild",
            version: "1",
          },
          configuration: { ProjectName: "bunsai-e2e-project" },
          inputArtifacts: [{ name: "SourceArtifact" }],
        },
      ],
    },
  ];
  const artifactStore = {
    type: "S3" as const,
    location: "bunsai-e2e-artifacts",
  };

  const created = await client.send(
    new CreatePipelineCommand({
      pipeline: { name, roleArn, artifactStore, stages },
    }),
  );
  expect(created.pipeline?.name).toBe(name);
  expect(created.pipeline?.version).toBe(1);

  const got = await client.send(new GetPipelineCommand({ name }));
  expect(got.pipeline?.name).toBe(name);
  expect(got.pipeline?.roleArn).toBe(roleArn);
  expect(got.metadata?.pipelineArn).toContain(`:${name}`);

  const listed = await client.send(new ListPipelinesCommand({}));
  expect(listed.pipelines?.some((p) => p.name === name)).toBe(true);

  const updated = await client.send(
    new UpdatePipelineCommand({
      pipeline: {
        name,
        roleArn,
        artifactStore,
        stages,
        executionMode: "QUEUED",
      },
    }),
  );
  expect(updated.pipeline?.version).toBe(2);

  const started = await client.send(
    new StartPipelineExecutionCommand({ name }),
  );
  expect(typeof started.pipelineExecutionId).toBe("string");

  await client.send(new DeletePipelineCommand({ name }));

  await expect(client.send(new GetPipelineCommand({ name }))).rejects.toThrow();
});

test("CodePipeline GetPipelineState and stage transitions", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-state-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const state = await client.send(new GetPipelineStateCommand({ name }));
  expect(state.pipelineName).toBe(name);
  expect(state.pipelineVersion).toBe(1);
  expect(Array.isArray(state.stageStates)).toBe(true);
  expect(state.stageStates?.length).toBe(2);
  expect(state.stageStates?.[0]?.stageName).toBe("Source");

  await client.send(
    new DisableStageTransitionCommand({
      pipelineName: name,
      stageName: "Build",
      transitionType: "Inbound",
      reason: "testing",
    }),
  );

  const stateAfterDisable = await client.send(
    new GetPipelineStateCommand({ name }),
  );
  const buildStage = stateAfterDisable.stageStates?.find(
    (s) => s.stageName === "Build",
  );
  expect(buildStage?.inboundTransitionState?.enabled).toBe(false);

  await client.send(
    new EnableStageTransitionCommand({
      pipelineName: name,
      stageName: "Build",
      transitionType: "Inbound",
    }),
  );

  const stateAfterEnable = await client.send(
    new GetPipelineStateCommand({ name }),
  );
  const buildStageEnabled = stateAfterEnable.stageStates?.find(
    (s) => s.stageName === "Build",
  );
  expect(buildStageEnabled?.inboundTransitionState?.enabled).toBe(true);

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline GetPipelineExecution and execution listing", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-exec-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const started = await client.send(
    new StartPipelineExecutionCommand({ name }),
  );
  const execId = started.pipelineExecutionId!;

  const execDetail = await client.send(
    new GetPipelineExecutionCommand({
      pipelineName: name,
      pipelineExecutionId: execId,
    }),
  );
  expect(execDetail.pipelineExecution?.pipelineExecutionId).toBe(execId);
  expect(execDetail.pipelineExecution?.pipelineName).toBe(name);
  expect(execDetail.pipelineExecution?.status).toBe("InProgress");

  const execList = await client.send(
    new ListPipelineExecutionsCommand({ pipelineName: name }),
  );
  expect(
    execList.pipelineExecutionSummaries?.some(
      (e) => e.pipelineExecutionId === execId,
    ),
  ).toBe(true);

  const actionExecs = await client.send(
    new ListActionExecutionsCommand({ pipelineName: name }),
  );
  expect(Array.isArray(actionExecs.actionExecutionDetails)).toBe(true);

  const ruleExecs = await client.send(
    new ListRuleExecutionsCommand({ pipelineName: name }),
  );
  expect(Array.isArray(ruleExecs.ruleExecutionDetails)).toBe(true);

  const stopped = await client.send(
    new StopPipelineExecutionCommand({
      pipelineName: name,
      pipelineExecutionId: execId,
      abandon: true,
    }),
  );
  expect(stopped.pipelineExecutionId).toBe(execId);

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline custom action type lifecycle", async () => {
  const client = codepipeline();
  const provider = `BunsaiE2E${Date.now()}`;

  const created = await client.send(
    new CreateCustomActionTypeCommand({
      category: "Build",
      provider,
      version: "1",
      inputArtifactDetails: { minimumCount: 0, maximumCount: 1 },
      outputArtifactDetails: { minimumCount: 0, maximumCount: 1 },
    }),
  );
  expect(created.actionType?.id?.provider).toBe(provider);

  const got = await client.send(
    new GetActionTypeCommand({
      category: "Build",
      owner: "Custom",
      provider,
      version: "1",
    }),
  );
  expect(got.actionType?.id?.provider).toBe(provider);

  const listed = await client.send(
    new ListActionTypesCommand({ actionOwnerFilter: "Custom" }),
  );
  expect(listed.actionTypes?.some((at) => at.id?.provider === provider)).toBe(
    true,
  );

  await client.send(
    new UpdateActionTypeCommand({
      actionType: {
        id: { category: "Build", owner: "Custom", provider, version: "1" },
        executor: {
          configuration: {
            lambdaExecutorConfiguration: {
              lambdaFunctionArn:
                "arn:aws:lambda:us-east-1:123456789012:function:bunsai-e2e",
            },
          },
          type: "Lambda",
        },
        inputArtifactDetails: { minimumCount: 0, maximumCount: 2 },
        outputArtifactDetails: { minimumCount: 0, maximumCount: 2 },
      },
    }),
  );

  const gotUpdated = await client.send(
    new GetActionTypeCommand({
      category: "Build",
      owner: "Custom",
      provider,
      version: "1",
    }),
  );
  expect(gotUpdated.actionType?.inputArtifactDetails?.maximumCount).toBe(2);

  await client.send(
    new DeleteCustomActionTypeCommand({
      category: "Build",
      provider,
      version: "1",
    }),
  );

  await expect(
    client.send(
      new GetActionTypeCommand({
        category: "Build",
        owner: "Custom",
        provider,
        version: "1",
      }),
    ),
  ).rejects.toThrow();
});

test("CodePipeline webhook lifecycle", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-pipeline-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const webhookName = `bunsai-webhook-${Date.now()}`;
  const putResult = await client.send(
    new PutWebhookCommand({
      webhook: {
        name: webhookName,
        targetPipeline: name,
        targetAction: "Source",
        filters: [{ jsonPath: "$.ref", matchEquals: "refs/heads/main" }],
        authentication: "UNAUTHENTICATED",
        authenticationConfiguration: {},
      },
    }),
  );
  expect(putResult.webhook?.definition?.name).toBe(webhookName);
  expect(typeof putResult.webhook?.url).toBe("string");

  const listed = await client.send(new ListWebhooksCommand({}));
  expect(listed.webhooks?.some((w) => w.definition?.name === webhookName)).toBe(
    true,
  );

  await client.send(new RegisterWebhookWithThirdPartyCommand({ webhookName }));

  await client.send(
    new DeregisterWebhookWithThirdPartyCommand({ webhookName }),
  );

  await client.send(new DeleteWebhookCommand({ name: webhookName }));

  const listedAfterDelete = await client.send(new ListWebhooksCommand({}));
  expect(
    listedAfterDelete.webhooks?.some((w) => w.definition?.name === webhookName),
  ).toBe(false);

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline tagging", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-tag-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const arn = `arn:aws:codepipeline:${region}:000000000000:${name}`;

  await client.send(
    new TagResourceCommand({
      resourceArn: arn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(listed.tags?.some((t) => t.key === "env" && t.value === "test")).toBe(
    true,
  );
  expect(
    listed.tags?.some((t) => t.key === "team" && t.value === "bunsai"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["team"] }),
  );

  const listedAfterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(listedAfterUntag.tags?.some((t) => t.key === "team")).toBe(false);
  expect(listedAfterUntag.tags?.some((t) => t.key === "env")).toBe(true);

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline PollForJobs and PollForThirdPartyJobs return empty lists", async () => {
  const client = codepipeline();

  const jobs = await client.send(
    new PollForJobsCommand({
      actionTypeId: {
        category: "Build",
        owner: "Custom",
        provider: "BunsaiProvider",
        version: "1",
      },
      maxBatchSize: 5,
    }),
  );
  expect(Array.isArray(jobs.jobs)).toBe(true);

  const tpJobs = await client.send(
    new PollForThirdPartyJobsCommand({
      actionTypeId: {
        category: "Build",
        owner: "ThirdParty",
        provider: "BunsaiTPProvider",
        version: "1",
      },
      maxBatchSize: 5,
    }),
  );
  expect(Array.isArray(tpJobs.jobs)).toBe(true);
});

test("CodePipeline RetryStageExecution and RollbackStage", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-retry-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const started = await client.send(
    new StartPipelineExecutionCommand({ name }),
  );
  const execId = started.pipelineExecutionId!;

  const retried = await client.send(
    new RetryStageExecutionCommand({
      pipelineName: name,
      stageName: "Build",
      pipelineExecutionId: execId,
      retryMode: "FAILED_ACTIONS",
    }),
  );
  expect(typeof retried.pipelineExecutionId).toBe("string");

  const rolledBack = await client.send(
    new RollbackStageCommand({
      pipelineName: name,
      stageName: "Build",
      targetPipelineExecutionId: execId,
    }),
  );
  expect(typeof rolledBack.pipelineExecutionId).toBe("string");

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline PutApprovalResult", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-approval-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const result = await client.send(
    new PutApprovalResultCommand({
      pipelineName: name,
      stageName: "Build",
      actionName: "Build",
      result: { status: "Approved", summary: "LGTM" },
      token: "test-token",
    }),
  );
  expect(typeof result.approvedAt).toBeDefined();

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline ListRuleTypes and ListDeployActionExecutionTargets", async () => {
  const client = codepipeline();

  const ruleTypes = await client.send(new ListRuleTypesCommand({}));
  expect(Array.isArray(ruleTypes.ruleTypes)).toBe(true);

  const name = `bunsai-e2e-targets-${Date.now()}`;
  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );
  const started = await client.send(
    new StartPipelineExecutionCommand({ name }),
  );

  const targets = await client.send(
    new ListDeployActionExecutionTargetsCommand({
      pipelineName: name,
      actionExecutionId: `ae-${started.pipelineExecutionId}`,
    }),
  );
  expect(Array.isArray(targets.targets)).toBe(true);

  await client.send(new DeletePipelineCommand({ name }));
});

test("CodePipeline ListPipelines pagination", async () => {
  const client = codepipeline();
  const prefix = `bunsai-e2e-pg-${Date.now()}`;
  const names = [`${prefix}-a`, `${prefix}-b`, `${prefix}-c`];

  for (const n of names) {
    await client.send(new CreatePipelineCommand({ pipeline: makePipeline(n) }));
  }

  const page1 = await client.send(new ListPipelinesCommand({ maxResults: 1 }));
  expect(Array.isArray(page1.pipelines)).toBe(true);
  expect(page1.pipelines!.length).toBe(1);
  expect(typeof page1.nextToken).toBe("string");

  const page2 = await client.send(
    new ListPipelinesCommand({ maxResults: 1, nextToken: page1.nextToken }),
  );
  expect(Array.isArray(page2.pipelines)).toBe(true);
  expect(page2.pipelines!.length).toBe(1);

  for (const n of names) {
    await client.send(new DeletePipelineCommand({ name: n }));
  }
});

test("CodePipeline AcknowledgeJob nonce validation", async () => {
  const app = createBunsaiApp();
  const origin = "http://bunsai.test";
  const rh = {
    async handle(request: {
      method: string;
      protocol: string;
      hostname: string;
      port?: number;
      path: string;
      query?: Record<string, string | string[] | null>;
      headers: Record<string, string>;
      body?: RequestInit["body"];
    }) {
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(request.query ?? {})) {
        if (Array.isArray(v)) {
          v.forEach((s) => search.append(k, s));
        } else if (v !== null) {
          search.append(k, v);
        }
      }
      const qs = search.size ? `?${search}` : "";
      const res = await app.gatewayFetch(
        new Request(`${origin}${request.path}${qs}`, {
          method: request.method,
          headers: { ...request.headers, host: request.hostname },
          body: request.body,
        }),
      );
      return {
        response: {
          statusCode: res.status,
          headers: Object.fromEntries(res.headers),
          body:
            res.body ??
            new ReadableStream({
              start(c) {
                c.close();
              },
            }),
        },
      };
    },
    updateHttpClientConfig() {},
    httpHandlerConfigs(): Record<string, never> {
      return {};
    },
  };

  const client = new CodePipelineClient({
    endpoint: origin,
    region,
    credentials,
    requestHandler: rh,
  });

  const jobId = "e2e-nonce-job";
  const validNonce = "nonce-valid-xyz";
  const scopeKey = "000000000000/us-east-1/codepipeline";
  if (!app.store.data.has(scopeKey)) {
    app.store.data.set(scopeKey, new Map());
  }
  app.store.data.get(scopeKey)!.set(`job:${jobId}`, {
    id: jobId,
    nonce: validNonce,
    data: {},
    accountId: "000000000000",
    status: "Queued",
    actionTypeId: { category: "Build", provider: "TestProvider", version: "1" },
  });

  await expect(
    client.send(new AcknowledgeJobCommand({ jobId, nonce: "wrong-nonce" })),
  ).rejects.toMatchObject({ name: "InvalidNonceException" });

  const ack = await client.send(
    new AcknowledgeJobCommand({ jobId, nonce: validNonce }),
  );
  expect(ack.status).toBe("InProgress");
});

test("CodePipeline GetPipeline version history", async () => {
  const client = codepipeline();
  const name = `bunsai-e2e-ver-${Date.now()}`;

  await client.send(
    new CreatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const v1 = await client.send(new GetPipelineCommand({ name, version: 1 }));
  expect(v1.pipeline?.version).toBe(1);

  await client.send(
    new UpdatePipelineCommand({ pipeline: makePipeline(name) }),
  );

  const current = await client.send(new GetPipelineCommand({ name }));
  expect(current.pipeline?.version).toBe(2);

  const historical = await client.send(
    new GetPipelineCommand({ name, version: 1 }),
  );
  expect(historical.pipeline?.version).toBe(1);

  await expect(
    client.send(new GetPipelineCommand({ name, version: 99 })),
  ).rejects.toMatchObject({ name: "PipelineVersionNotFoundException" });

  await client.send(new DeletePipelineCommand({ name }));
});
