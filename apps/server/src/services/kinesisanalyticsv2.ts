import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import kinesisanalyticsv2Model from "../../../../test/vendor/aws-models/kinesisanalyticsv2.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(kinesisanalyticsv2Model);

type ApplicationStatus =
  | "DELETING"
  | "STARTING"
  | "STOPPING"
  | "READY"
  | "RUNNING"
  | "UPDATING"
  | "AUTOSCALING"
  | "FORCE_STOPPING"
  | "ROLLING_BACK"
  | "MAINTENANCE"
  | "ROLLED_BACK";

type StoredCwLoggingOption = {
  cloudWatchLoggingOptionId: string;
  logStreamArn: string;
};

type StoredVpcConfig = {
  vpcConfigurationId: string;
  vpcId: string;
  subnetIds: string[];
  securityGroupIds: string[];
};

type StoredApplication = {
  applicationName: string;
  applicationArn: string;
  applicationStatus: ApplicationStatus;
  applicationVersionId: number;
  conditionalToken: string;
  createTimestamp: number;
  lastUpdateTimestamp: number;
  runtimeEnvironment: string;
  serviceExecutionRole: string;
  applicationDescription: string | undefined;
  applicationMode: string;
  applicationConfiguration: Record<string, unknown> | undefined;
  cloudWatchLoggingOptionDescriptions: StoredCwLoggingOption[];
  maintenanceWindowStartTime: string | undefined;
  tags: Record<string, string>;
  vpcConfigurationDescriptions: StoredVpcConfig[];
  inputDescriptions: Array<Record<string, unknown>>;
  outputDescriptions: Array<Record<string, unknown>>;
  referenceDataSourceDescriptions: Array<Record<string, unknown>>;
  operationIds: string[];
};

type StoredSnapshot = {
  applicationName: string;
  snapshotName: string;
  snapshotStatus: "CREATING" | "READY" | "DELETING" | "FAILED";
  runtimeEnvironment: string;
  applicationVersionId: number;
  snapshotCreationTimestamp: number;
};

const appKey = (name: string) => `app/${name}`;
const snapshotKey = (appName: string, snapshotName: string) =>
  `snapshot/${appName}/${snapshotName}`;

const appArn = (region: string, account: string, name: string) =>
  `arn:aws:kinesisanalytics:${region}:${account}:application/${name}`;

const requireApp = (ctx: ServiceContext, name: string): StoredApplication => {
  const app = ctx.store.get<StoredApplication>(appKey(name));
  if (app === undefined)
    throw awsError(
      "ResourceNotFoundException",
      `Application ${name} not found.`,
      400,
    );
  return app;
};

const resolveVersionCheck = (
  app: StoredApplication,
  currentVersionId: unknown,
  conditionalToken: unknown,
): void => {
  if (conditionalToken !== undefined) {
    if (conditionalToken !== app.conditionalToken) {
      throw awsError(
        "ConcurrentModificationException",
        "The conditional token does not match.",
        400,
      );
    }
    return;
  }
  if (currentVersionId !== undefined) {
    const vId = Number(currentVersionId);
    if (vId !== app.applicationVersionId) {
      throw awsError(
        "ConcurrentModificationException",
        `Application version ${vId} does not match current version ${app.applicationVersionId}.`,
        400,
      );
    }
  }
};

const bumpVersion = (app: StoredApplication, now: number): void => {
  app.applicationVersionId += 1;
  app.conditionalToken = crypto.randomUUID();
  app.lastUpdateTimestamp = now;
};

const toApplicationDetail = (app: StoredApplication) => ({
  ApplicationARN: app.applicationArn,
  ApplicationName: app.applicationName,
  RuntimeEnvironment: app.runtimeEnvironment,
  ServiceExecutionRole: app.serviceExecutionRole,
  ApplicationStatus: app.applicationStatus,
  ApplicationVersionId: app.applicationVersionId,
  CreateTimestamp: app.createTimestamp,
  LastUpdateTimestamp: app.lastUpdateTimestamp,
  ApplicationDescription: app.applicationDescription,
  ApplicationMode: app.applicationMode,
  ConditionalToken: app.conditionalToken,
  ApplicationConfigurationDescription: app.applicationConfiguration,
  CloudWatchLoggingOptionDescriptions:
    app.cloudWatchLoggingOptionDescriptions.map((o) => ({
      CloudWatchLoggingOptionId: o.cloudWatchLoggingOptionId,
      LogStreamARN: o.logStreamArn,
    })),
  VpcConfigurationDescriptions: app.vpcConfigurationDescriptions.map((v) => ({
    VpcConfigurationId: v.vpcConfigurationId,
    VpcId: v.vpcId,
    SubnetIds: v.subnetIds,
    SecurityGroupIds: v.securityGroupIds,
  })),
  ...(app.maintenanceWindowStartTime !== undefined
    ? {
        ApplicationMaintenanceConfigurationDescription: {
          ApplicationMaintenanceWindowStartTime: app.maintenanceWindowStartTime,
          ApplicationMaintenanceWindowEndTime: app.maintenanceWindowStartTime,
        },
      }
    : {}),
});

const toApplicationSummary = (app: StoredApplication) => ({
  ApplicationName: app.applicationName,
  ApplicationARN: app.applicationArn,
  ApplicationStatus: app.applicationStatus,
  ApplicationVersionId: app.applicationVersionId,
  RuntimeEnvironment: app.runtimeEnvironment,
  ApplicationMode: app.applicationMode,
});

const toSnapshotDetails = (s: StoredSnapshot) => ({
  SnapshotName: s.snapshotName,
  SnapshotStatus: s.snapshotStatus,
  ApplicationVersionId: s.applicationVersionId,
  SnapshotCreationTimestamp: s.snapshotCreationTimestamp,
  RuntimeEnvironment: s.runtimeEnvironment,
});

const applyReadTimeTransition = (
  ctx: ServiceContext,
  app: StoredApplication,
): StoredApplication => {
  if (app.applicationStatus === "STARTING") {
    app.applicationStatus = "RUNNING";
    ctx.store.set(appKey(app.applicationName), app);
  } else if (app.applicationStatus === "STOPPING") {
    app.applicationStatus = "READY";
    ctx.store.set(appKey(app.applicationName), app);
  }
  return app;
};

const CreateApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  if (ctx.store.get<StoredApplication>(appKey(name)) !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Application ${name} already exists.`,
      400,
    );
  }
  const now = Date.now() / 1000;
  const arn = appArn(ctx.region, ctx.account, name);
  const tags: Record<string, string> = {};
  const inputTags = input.Tags as
    | Array<{ Key: string; Value: string }>
    | undefined;
  if (inputTags) {
    for (const { Key, Value } of inputTags) tags[Key] = Value;
  }
  const app: StoredApplication = {
    applicationName: name,
    applicationArn: arn,
    applicationStatus: "READY",
    applicationVersionId: 1,
    conditionalToken: crypto.randomUUID(),
    createTimestamp: now,
    lastUpdateTimestamp: now,
    runtimeEnvironment: input.RuntimeEnvironment as string,
    serviceExecutionRole: input.ServiceExecutionRole as string,
    applicationDescription: input.ApplicationDescription as string | undefined,
    applicationMode:
      (input.ApplicationMode as string | undefined) ?? "STREAMING",
    applicationConfiguration: input.ApplicationConfiguration as
      | Record<string, unknown>
      | undefined,
    cloudWatchLoggingOptionDescriptions: [],
    maintenanceWindowStartTime: undefined,
    tags,
    vpcConfigurationDescriptions: [],
    inputDescriptions: [],
    outputDescriptions: [],
    referenceDataSourceDescriptions: [],
    operationIds: [],
  };
  const cwOptions = input.CloudWatchLoggingOptions as
    | Array<{ LogStreamARN: string }>
    | undefined;
  if (cwOptions) {
    for (const opt of cwOptions) {
      app.cloudWatchLoggingOptionDescriptions.push({
        cloudWatchLoggingOptionId: crypto.randomUUID(),
        logStreamArn: opt.LogStreamARN,
      });
    }
  }
  ctx.store.set(appKey(name), app);
  return { ApplicationDetail: toApplicationDetail(app) };
};

const DescribeApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = applyReadTimeTransition(ctx, requireApp(ctx, name));
  return { ApplicationDetail: toApplicationDetail(app) };
};

const ListApplications: OperationHandler = (input, ctx) => {
  const limit = (input.Limit as number | undefined) ?? 100;
  const nextToken = input.NextToken as string | undefined;
  const allApps = ctx.store
    .list<StoredApplication>()
    .filter((e) => e.key.startsWith("app/"))
    .map((e) => e.value)
    .sort((a, b) => a.applicationName.localeCompare(b.applicationName));
  let startIdx = 0;
  if (nextToken !== undefined) {
    const idx = allApps.findIndex((a) => a.applicationName === nextToken);
    if (idx >= 0) startIdx = idx;
  }
  const page = allApps.slice(startIdx, startIdx + limit);
  const newNextToken =
    startIdx + limit < allApps.length
      ? allApps[startIdx + limit]?.applicationName
      : undefined;
  return {
    ApplicationSummaries: page.map(toApplicationSummary),
    NextToken: newNextToken,
  };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  if (
    app.applicationStatus === "RUNNING" ||
    app.applicationStatus === "STARTING"
  ) {
    throw awsError(
      "ResourceInUseException",
      `Application ${name} is currently running.`,
      400,
    );
  }
  ctx.store.delete(appKey(name));
  for (const { key } of ctx.store
    .list<StoredSnapshot>()
    .filter((e) => e.key.startsWith(`snapshot/${name}/`))) {
    ctx.store.delete(key);
  }
  return {};
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(
    app,
    input.CurrentApplicationVersionId,
    input.ConditionalToken,
  );
  if (input.ApplicationConfigurationUpdate !== undefined) {
    app.applicationConfiguration =
      input.ApplicationConfigurationUpdate as Record<string, unknown>;
  }
  if (input.ServiceExecutionRoleUpdate !== undefined) {
    app.serviceExecutionRole = input.ServiceExecutionRoleUpdate as string;
  }
  if (input.RuntimeEnvironmentUpdate !== undefined) {
    app.runtimeEnvironment = input.RuntimeEnvironmentUpdate as string;
  }
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationDetail: toApplicationDetail(app),
    OperationId: crypto.randomUUID(),
  };
};

const StartApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  if (app.applicationStatus !== "READY") {
    throw awsError(
      "ResourceInUseException",
      `Application ${name} is not in READY state.`,
      400,
    );
  }
  app.applicationStatus = "STARTING";
  app.lastUpdateTimestamp = Date.now() / 1000;
  ctx.store.set(appKey(name), app);
  return { OperationId: crypto.randomUUID() };
};

const StopApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  if (
    app.applicationStatus !== "RUNNING" &&
    app.applicationStatus !== "STARTING"
  ) {
    throw awsError(
      "ResourceInUseException",
      `Application ${name} is not in a running state.`,
      400,
    );
  }
  app.applicationStatus = "STOPPING";
  app.lastUpdateTimestamp = Date.now() / 1000;
  ctx.store.set(appKey(name), app);
  return { OperationId: crypto.randomUUID() };
};

const AddApplicationCloudWatchLoggingOption: OperationHandler = (
  input,
  ctx,
) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(
    app,
    input.CurrentApplicationVersionId,
    input.ConditionalToken,
  );
  const opt = input.CloudWatchLoggingOption as { LogStreamARN: string };
  const id = crypto.randomUUID();
  app.cloudWatchLoggingOptionDescriptions.push({
    cloudWatchLoggingOptionId: id,
    logStreamArn: opt.LogStreamARN,
  });
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    CloudWatchLoggingOptionDescriptions:
      app.cloudWatchLoggingOptionDescriptions.map((o) => ({
        CloudWatchLoggingOptionId: o.cloudWatchLoggingOptionId,
        LogStreamARN: o.logStreamArn,
      })),
    OperationId: crypto.randomUUID(),
  };
};

const DeleteApplicationCloudWatchLoggingOption: OperationHandler = (
  input,
  ctx,
) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(
    app,
    input.CurrentApplicationVersionId,
    input.ConditionalToken,
  );
  const optId = input.CloudWatchLoggingOptionId as string;
  const idx = app.cloudWatchLoggingOptionDescriptions.findIndex(
    (o) => o.cloudWatchLoggingOptionId === optId,
  );
  if (idx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `CloudWatch logging option ${optId} not found.`,
      400,
    );
  }
  app.cloudWatchLoggingOptionDescriptions.splice(idx, 1);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    CloudWatchLoggingOptionDescriptions:
      app.cloudWatchLoggingOptionDescriptions.map((o) => ({
        CloudWatchLoggingOptionId: o.cloudWatchLoggingOptionId,
        LogStreamARN: o.logStreamArn,
      })),
    OperationId: crypto.randomUUID(),
  };
};

const AddApplicationInput: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const inp = (input.Input ?? {}) as Record<string, unknown>;
  const inputId = `${app.inputDescriptions.length + 1}.1`;
  const desc = {
    InputId: inputId,
    NamePrefix: inp.NamePrefix ?? "SOURCE",
    KinesisStreamsInputDescription: inp.KinesisStreamsInput,
    KinesisFirehoseInputDescription: inp.KinesisFirehoseInput,
    InputSchema: inp.InputSchema,
    InputParallelism: inp.InputParallelism ?? { Count: 1 },
  };
  app.inputDescriptions.push(desc);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    InputDescriptions: app.inputDescriptions,
  };
};

const AddApplicationInputProcessingConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const inputId = input.InputId as string;
  const idx = app.inputDescriptions.findIndex(
    (d) => (d as Record<string, unknown>).InputId === inputId,
  );
  if (idx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `Input ${inputId} not found.`,
      400,
    );
  }
  (
    app.inputDescriptions[idx] as Record<string, unknown>
  ).InputProcessingConfigurationDescription = {
    InputLambdaProcessorDescription: (
      input.InputProcessingConfiguration as Record<string, unknown>
    )?.InputLambdaProcessor,
  };
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    InputId: inputId,
    InputProcessingConfigurationDescription: (
      app.inputDescriptions[idx] as Record<string, unknown>
    ).InputProcessingConfigurationDescription,
  };
};

const DeleteApplicationInputProcessingConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const inputId = input.InputId as string;
  const idx = app.inputDescriptions.findIndex(
    (d) => (d as Record<string, unknown>).InputId === inputId,
  );
  if (idx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `Input ${inputId} not found.`,
      400,
    );
  }
  delete (app.inputDescriptions[idx] as Record<string, unknown>)
    .InputProcessingConfigurationDescription;
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
  };
};

const AddApplicationOutput: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const out = (input.Output ?? {}) as Record<string, unknown>;
  const outputId = `${app.outputDescriptions.length + 1}.1`;
  const desc = {
    OutputId: outputId,
    Name: out.Name,
    KinesisStreamsOutputDescription: out.KinesisStreamsOutput,
    KinesisFirehoseOutputDescription: out.KinesisFirehoseOutput,
    LambdaOutputDescription: out.LambdaOutput,
    DestinationSchema: out.DestinationSchema,
  };
  app.outputDescriptions.push(desc);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    OutputDescriptions: app.outputDescriptions,
  };
};

const DeleteApplicationOutput: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const outputId = input.OutputId as string;
  const idx = app.outputDescriptions.findIndex(
    (d) => (d as Record<string, unknown>).OutputId === outputId,
  );
  if (idx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `Output ${outputId} not found.`,
      400,
    );
  }
  app.outputDescriptions.splice(idx, 1);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
  };
};

const AddApplicationReferenceDataSource: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const ref = (input.ReferenceDataSource ?? {}) as Record<string, unknown>;
  const refId = `${app.referenceDataSourceDescriptions.length + 1}.1`;
  const desc = {
    ReferenceId: refId,
    TableName: ref.TableName,
    S3ReferenceDataSourceDescription: ref.S3ReferenceDataSource,
    ReferenceSchema: ref.ReferenceSchema,
  };
  app.referenceDataSourceDescriptions.push(desc);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    ReferenceDataSourceDescriptions: app.referenceDataSourceDescriptions,
  };
};

const DeleteApplicationReferenceDataSource: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const refId = input.ReferenceId as string;
  const idx = app.referenceDataSourceDescriptions.findIndex(
    (d) => (d as Record<string, unknown>).ReferenceId === refId,
  );
  if (idx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `Reference data source ${refId} not found.`,
      400,
    );
  }
  app.referenceDataSourceDescriptions.splice(idx, 1);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
  };
};

const AddApplicationVpcConfiguration: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(
    app,
    input.CurrentApplicationVersionId,
    input.ConditionalToken,
  );
  const vpc = (input.VpcConfiguration ?? {}) as {
    SubnetIds: string[];
    SecurityGroupIds: string[];
  };
  const vpcId = `vpc-${crypto.randomUUID().slice(0, 8)}`;
  const vpcConfigId = `vpc-${crypto.randomUUID().slice(0, 8)}`;
  const vpcConfig: StoredVpcConfig = {
    vpcConfigurationId: vpcConfigId,
    vpcId,
    subnetIds: vpc.SubnetIds ?? [],
    securityGroupIds: vpc.SecurityGroupIds ?? [],
  };
  app.vpcConfigurationDescriptions.push(vpcConfig);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  const desc = {
    VpcConfigurationId: vpcConfig.vpcConfigurationId,
    VpcId: vpcConfig.vpcId,
    SubnetIds: vpcConfig.subnetIds,
    SecurityGroupIds: vpcConfig.securityGroupIds,
  };
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    VpcConfigurationDescription: desc,
    OperationId: crypto.randomUUID(),
  };
};

const DeleteApplicationVpcConfiguration: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(
    app,
    input.CurrentApplicationVersionId,
    input.ConditionalToken,
  );
  const vpcConfigId = input.VpcConfigurationId as string;
  const idx = app.vpcConfigurationDescriptions.findIndex(
    (v) => v.vpcConfigurationId === vpcConfigId,
  );
  if (idx < 0) {
    throw awsError(
      "ResourceNotFoundException",
      `VPC configuration ${vpcConfigId} not found.`,
      400,
    );
  }
  app.vpcConfigurationDescriptions.splice(idx, 1);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationVersionId: app.applicationVersionId,
    OperationId: crypto.randomUUID(),
  };
};

const CreateApplicationSnapshot: OperationHandler = (input, ctx) => {
  const appName = input.ApplicationName as string;
  const app = requireApp(ctx, appName);
  if (
    app.applicationStatus !== "RUNNING" &&
    app.applicationStatus !== "STARTING" &&
    app.applicationStatus !== "READY"
  ) {
    throw awsError(
      "ResourceInUseException",
      `Application ${appName} is not in a valid state for snapshot creation.`,
      400,
    );
  }
  const snapshotName = input.SnapshotName as string;
  const key = snapshotKey(appName, snapshotName);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Snapshot ${snapshotName} already exists.`,
      400,
    );
  }
  const snapshot: StoredSnapshot = {
    applicationName: appName,
    snapshotName,
    snapshotStatus: "READY",
    runtimeEnvironment: app.runtimeEnvironment,
    applicationVersionId: app.applicationVersionId,
    snapshotCreationTimestamp: Date.now() / 1000,
  };
  ctx.store.set(key, snapshot);
  return {};
};

const DescribeApplicationSnapshot: OperationHandler = (input, ctx) => {
  const appName = input.ApplicationName as string;
  requireApp(ctx, appName);
  const snapshotName = input.SnapshotName as string;
  const snapshot = ctx.store.get<StoredSnapshot>(
    snapshotKey(appName, snapshotName),
  );
  if (snapshot === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Snapshot ${snapshotName} not found.`,
      400,
    );
  }
  return { SnapshotDetails: toSnapshotDetails(snapshot) };
};

const ListApplicationSnapshots: OperationHandler = (input, ctx) => {
  const appName = input.ApplicationName as string;
  requireApp(ctx, appName);
  const limit = (input.Limit as number | undefined) ?? 50;
  const nextToken = input.NextToken as string | undefined;
  const prefix = `snapshot/${appName}/`;
  const allSnapshots = ctx.store
    .list<StoredSnapshot>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.snapshotName.localeCompare(b.snapshotName));
  let startIdx = 0;
  if (nextToken !== undefined) {
    const idx = allSnapshots.findIndex((s) => s.snapshotName === nextToken);
    if (idx >= 0) startIdx = idx;
  }
  const page = allSnapshots.slice(startIdx, startIdx + limit);
  const newNextToken =
    startIdx + limit < allSnapshots.length
      ? allSnapshots[startIdx + limit]?.snapshotName
      : undefined;
  return {
    SnapshotSummaries: page.map(toSnapshotDetails),
    NextToken: newNextToken,
  };
};

const DeleteApplicationSnapshot: OperationHandler = (input, ctx) => {
  const appName = input.ApplicationName as string;
  requireApp(ctx, appName);
  const snapshotName = input.SnapshotName as string;
  const key = snapshotKey(appName, snapshotName);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Snapshot ${snapshotName} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input.ResourceARN as string;
  const namePart = arn.split("/").at(-1);
  if (namePart === undefined || !arn.includes(":application/")) {
    throw awsError("InvalidArgumentException", "Invalid resource ARN.", 400);
  }
  const app = requireApp(ctx, namePart);
  const tags = input.Tags as Array<{ Key: string; Value: string }>;
  for (const { Key, Value } of tags) app.tags[Key] = Value;
  ctx.store.set(appKey(namePart), app);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = input.ResourceARN as string;
  const namePart = arn.split("/").at(-1);
  if (namePart === undefined || !arn.includes(":application/")) {
    throw awsError("InvalidArgumentException", "Invalid resource ARN.", 400);
  }
  const app = requireApp(ctx, namePart);
  const tagKeys = input.TagKeys as string[];
  for (const key of tagKeys) delete app.tags[key];
  ctx.store.set(appKey(namePart), app);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input.ResourceARN as string;
  const namePart = arn.split("/").at(-1);
  if (namePart === undefined || !arn.includes(":application/")) {
    throw awsError("InvalidArgumentException", "Invalid resource ARN.", 400);
  }
  const app = requireApp(ctx, namePart);
  return {
    Tags: Object.entries(app.tags).map(([Key, Value]) => ({ Key, Value })),
  };
};

const UpdateApplicationMaintenanceConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  const update = (input.ApplicationMaintenanceConfigurationUpdate ??
    {}) as Record<string, unknown>;
  app.maintenanceWindowStartTime =
    (update.ApplicationMaintenanceWindowStartTimeUpdate as string) ??
    app.maintenanceWindowStartTime;
  ctx.store.set(appKey(name), app);
  return {
    ApplicationARN: app.applicationArn,
    ApplicationMaintenanceConfigurationDescription: {
      ApplicationMaintenanceWindowStartTime: app.maintenanceWindowStartTime,
      ApplicationMaintenanceWindowEndTime: app.maintenanceWindowStartTime,
    },
  };
};

const RollbackApplication: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  resolveVersionCheck(app, input.CurrentApplicationVersionId, undefined);
  const now = Date.now() / 1000;
  bumpVersion(app, now);
  ctx.store.set(appKey(name), app);
  return {
    ApplicationDetail: toApplicationDetail(app),
    OperationId: crypto.randomUUID(),
  };
};

const CreateApplicationPresignedUrl: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  requireApp(ctx, name);
  return {
    AuthorizedUrl: `https://bunsai.local/${ctx.region}/${name}/flink-dashboard`,
  };
};

const DiscoverInputSchema: OperationHandler = (_input, _ctx) => ({
  InputSchema: {
    RecordFormat: {
      RecordFormatType: "JSON",
      MappingParameters: { JSONMappingParameters: { RecordRowPath: "$" } },
    },
    RecordEncoding: "UTF-8",
    RecordColumns: [
      { Name: "data", SqlType: "VARCHAR(1024)", Mapping: "$.data" },
    ],
  },
  ParsedInputRecords: [["sample"]],
  ProcessedInputRecords: ["{}"],
  RawInputRecords: ["{}"],
});

const DescribeApplicationVersion: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  return { ApplicationVersionDetail: toApplicationDetail(app) };
};

const ListApplicationVersions: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  return {
    ApplicationVersionSummaries: [
      {
        ApplicationVersionId: app.applicationVersionId,
        ApplicationStatus: app.applicationStatus,
      },
    ],
  };
};

const DescribeApplicationOperation: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  const operationId = input.OperationId as string;
  if (!app.operationIds.includes(operationId)) {
    throw awsError(
      "ResourceNotFoundException",
      `Operation ${operationId} not found.`,
      400,
    );
  }
  return {
    ApplicationOperationInfoDetails: {
      Operation: "update",
      StartTime: app.lastUpdateTimestamp,
      EndTime: app.lastUpdateTimestamp,
      ApplicationVersionChangeDetails: {
        ApplicationVersionUpdatedFrom: app.applicationVersionId - 1,
        ApplicationVersionUpdatedTo: app.applicationVersionId,
      },
      OperationStatus: "SUCCESSFUL",
    },
  };
};

const ListApplicationOperations: OperationHandler = (input, ctx) => {
  const name = input.ApplicationName as string;
  const app = requireApp(ctx, name);
  return {
    ApplicationOperationInfoList: app.operationIds.map((id) => ({
      Operation: "update",
      OperationId: id,
      StartTime: app.lastUpdateTimestamp,
      EndTime: app.lastUpdateTimestamp,
      OperationStatus: "SUCCESSFUL",
    })),
  };
};

const kinesisanalyticsv2: ServiceDefinition = {
  name: "kinesisanalytics",
  protocol: "json",
  operations: {
    CreateApplication,
    DescribeApplication,
    ListApplications,
    DeleteApplication,
    UpdateApplication,
    StartApplication,
    StopApplication,
    AddApplicationCloudWatchLoggingOption,
    DeleteApplicationCloudWatchLoggingOption,
    AddApplicationInput,
    AddApplicationInputProcessingConfiguration,
    DeleteApplicationInputProcessingConfiguration,
    AddApplicationOutput,
    DeleteApplicationOutput,
    AddApplicationReferenceDataSource,
    DeleteApplicationReferenceDataSource,
    AddApplicationVpcConfiguration,
    DeleteApplicationVpcConfiguration,
    CreateApplicationSnapshot,
    DescribeApplicationSnapshot,
    ListApplicationSnapshots,
    DeleteApplicationSnapshot,
    TagResource,
    UntagResource,
    ListTagsForResource,
    UpdateApplicationMaintenanceConfiguration,
    RollbackApplication,
    CreateApplicationPresignedUrl,
    DiscoverInputSchema,
    DescribeApplicationVersion,
    ListApplicationVersions,
    DescribeApplicationOperation,
    ListApplicationOperations,
  },
  model,
};

export default kinesisanalyticsv2;
