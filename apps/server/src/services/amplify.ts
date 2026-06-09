import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import amplifyModel from "../../../../test/vendor/aws-models/amplify.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(amplifyModel);

type StoredApp = {
  appId: string;
  appArn: string;
  name: string;
  description: string;
  repository: string;
  platform: string;
  computeRoleArn: string | undefined;
  iamServiceRoleArn: string | undefined;
  createTime: number;
  updateTime: number;
  environmentVariables: Record<string, string>;
  defaultDomain: string;
  enableBranchAutoBuild: boolean;
  enableBranchAutoDeletion: boolean;
  enableBasicAuth: boolean;
  basicAuthCredentials: string | undefined;
  buildSpec: string | undefined;
  customHeaders: string | undefined;
  enableAutoBranchCreation: boolean;
  tags: Record<string, string>;
};

type StoredBranch = {
  appId: string;
  branchArn: string;
  branchName: string;
  description: string;
  stage: string;
  displayName: string;
  enableNotification: boolean;
  createTime: number;
  updateTime: number;
  environmentVariables: Record<string, string>;
  enableAutoBuild: boolean;
  customDomains: string[];
  framework: string;
  activeJobId: string;
  totalNumberOfJobs: string;
  enableBasicAuth: boolean;
  basicAuthCredentials: string | undefined;
  buildSpec: string | undefined;
  ttl: string;
  enablePullRequestPreview: boolean;
  tags: Record<string, string>;
};

type StoredBackendEnvironment = {
  appId: string;
  backendEnvironmentArn: string;
  environmentName: string;
  stackName: string | undefined;
  deploymentArtifacts: string | undefined;
  createTime: number;
  updateTime: number;
};

type StoredSubDomain = {
  prefix: string;
  branchName: string;
  verified: boolean;
  dnsRecord: string;
};

type StoredDomainAssociation = {
  appId: string;
  domainAssociationArn: string;
  domainName: string;
  enableAutoSubDomain: boolean;
  autoSubDomainCreationPatterns: string[];
  autoSubDomainIAMRole: string | undefined;
  domainStatus: string;
  updateStatus: string | undefined;
  statusReason: string;
  certificateVerificationDNSRecord: string | undefined;
  subDomains: StoredSubDomain[];
  createTime: number;
  updateTime: number;
};

type StoredWebhook = {
  webhookId: string;
  webhookArn: string;
  webhookUrl: string;
  appId: string;
  branchName: string;
  description: string;
  createTime: number;
  updateTime: number;
};

type StoredJob = {
  appId: string;
  branchName: string;
  jobId: string;
  jobArn: string;
  commitId: string;
  commitMessage: string;
  commitTime: number;
  startTime: number;
  status: string;
  endTime: number | undefined;
  jobType: string;
  sourceUrl: string | undefined;
  sourceUrlType: string | undefined;
};

type StoredArtifact = {
  appId: string;
  branchName: string;
  jobId: string;
  artifactId: string;
  artifactFileName: string;
};

const appKey = (appId: string): string => `app/${appId}`;

const branchKey = (appId: string, branchName: string): string =>
  `branch/${appId}/${branchName}`;

const backendEnvKey = (appId: string, environmentName: string): string =>
  `backendenvironment/${appId}/${environmentName}`;

const domainKey = (appId: string, domainName: string): string =>
  `domain/${appId}/${domainName}`;

const webhookKey = (webhookId: string): string => `webhook/${webhookId}`;

const jobKey = (appId: string, branchName: string, jobId: string): string =>
  `job/${appId}/${branchName}/${jobId}`;

const artifactKey = (
  appId: string,
  branchName: string,
  jobId: string,
  artifactId: string,
): string => `artifact/${appId}/${branchName}/${jobId}/${artifactId}`;

const tagKey = (resourceArn: string): string => `tags/${resourceArn}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const booleanOr = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const advanceDomainStatus = (status: string): string => {
  if (status === "PENDING_VERIFICATION") return "IN_PROGRESS";
  if (status === "IN_PROGRESS") return "AVAILABLE";
  return status;
};

const advanceJobStatus = (status: string): string => {
  if (status === "PENDING") return "PROVISIONING";
  if (status === "PROVISIONING") return "RUNNING";
  if (status === "RUNNING") return "SUCCEED";
  if (status === "CANCELLING") return "CANCELLED";
  return status;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const appArnOf = (ctx: ServiceContext, appId: string): string =>
  `arn:aws:amplify:${ctx.region}:${ctx.account}:apps/${appId}`;

const branchArnOf = (
  ctx: ServiceContext,
  appId: string,
  branchName: string,
): string =>
  `arn:aws:amplify:${ctx.region}:${ctx.account}:apps/${appId}/branches/${branchName}`;

const backendEnvArnOf = (
  ctx: ServiceContext,
  appId: string,
  environmentName: string,
): string =>
  `arn:aws:amplify:${ctx.region}:${ctx.account}:apps/${appId}/backendenvironments/${environmentName}`;

const domainArnOf = (
  ctx: ServiceContext,
  appId: string,
  domainName: string,
): string =>
  `arn:aws:amplify:${ctx.region}:${ctx.account}:apps/${appId}/domains/${domainName}`;

const webhookArnOf = (ctx: ServiceContext, webhookId: string): string =>
  `arn:aws:amplify:${ctx.region}:${ctx.account}:webhooks/${webhookId}`;

const jobArnOf = (
  ctx: ServiceContext,
  appId: string,
  branchName: string,
  jobId: string,
): string =>
  `arn:aws:amplify:${ctx.region}:${ctx.account}:apps/${appId}/branches/${branchName}/jobs/${jobId}`;

const defaultDomainOf = (ctx: ServiceContext, appId: string): string =>
  `${appId}.amplifyapp.com.${ctx.region}`;

const newShortId = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 14);

const appView = (app: StoredApp): Record<string, unknown> => ({
  appId: app.appId,
  appArn: app.appArn,
  name: app.name,
  tags: app.tags,
  description: app.description,
  repository: app.repository,
  platform: app.platform,
  computeRoleArn: app.computeRoleArn,
  iamServiceRoleArn: app.iamServiceRoleArn,
  createTime: app.createTime,
  updateTime: app.updateTime,
  environmentVariables: app.environmentVariables,
  defaultDomain: app.defaultDomain,
  enableBranchAutoBuild: app.enableBranchAutoBuild,
  enableBranchAutoDeletion: app.enableBranchAutoDeletion,
  enableBasicAuth: app.enableBasicAuth,
  basicAuthCredentials: app.basicAuthCredentials,
  buildSpec: app.buildSpec,
  customHeaders: app.customHeaders,
  enableAutoBranchCreation: app.enableAutoBranchCreation,
});

const branchView = (branch: StoredBranch): Record<string, unknown> => ({
  branchArn: branch.branchArn,
  branchName: branch.branchName,
  description: branch.description,
  tags: branch.tags,
  stage: branch.stage,
  displayName: branch.displayName,
  enableNotification: branch.enableNotification,
  createTime: branch.createTime,
  updateTime: branch.updateTime,
  environmentVariables: branch.environmentVariables,
  enableAutoBuild: branch.enableAutoBuild,
  customDomains: branch.customDomains,
  framework: branch.framework,
  activeJobId: branch.activeJobId,
  totalNumberOfJobs: branch.totalNumberOfJobs,
  enableBasicAuth: branch.enableBasicAuth,
  basicAuthCredentials: branch.basicAuthCredentials,
  buildSpec: branch.buildSpec,
  ttl: branch.ttl,
  enablePullRequestPreview: branch.enablePullRequestPreview,
});

const backendEnvView = (
  env: StoredBackendEnvironment,
): Record<string, unknown> => ({
  backendEnvironmentArn: env.backendEnvironmentArn,
  environmentName: env.environmentName,
  stackName: env.stackName,
  deploymentArtifacts: env.deploymentArtifacts,
  createTime: env.createTime,
  updateTime: env.updateTime,
});

const subDomainView = (sd: StoredSubDomain): Record<string, unknown> => ({
  subDomainSetting: { prefix: sd.prefix, branchName: sd.branchName },
  verified: sd.verified,
  dnsRecord: sd.dnsRecord,
});

const domainAssociationView = (
  domain: StoredDomainAssociation,
): Record<string, unknown> => ({
  domainAssociationArn: domain.domainAssociationArn,
  domainName: domain.domainName,
  enableAutoSubDomain: domain.enableAutoSubDomain,
  autoSubDomainCreationPatterns: domain.autoSubDomainCreationPatterns,
  autoSubDomainIAMRole: domain.autoSubDomainIAMRole,
  domainStatus: domain.domainStatus,
  updateStatus: domain.updateStatus,
  statusReason: domain.statusReason,
  certificateVerificationDNSRecord: domain.certificateVerificationDNSRecord,
  subDomains: domain.subDomains.map(subDomainView),
});

const webhookView = (webhook: StoredWebhook): Record<string, unknown> => ({
  webhookArn: webhook.webhookArn,
  webhookId: webhook.webhookId,
  webhookUrl: webhook.webhookUrl,
  appId: webhook.appId,
  branchName: webhook.branchName,
  description: webhook.description,
  createTime: webhook.createTime,
  updateTime: webhook.updateTime,
});

const jobSummaryView = (job: StoredJob): Record<string, unknown> => ({
  jobArn: job.jobArn,
  jobId: job.jobId,
  commitId: job.commitId,
  commitMessage: job.commitMessage,
  commitTime: job.commitTime,
  startTime: job.startTime,
  status: job.status,
  endTime: job.endTime,
  jobType: job.jobType,
  sourceUrl: job.sourceUrl,
  sourceUrlType: job.sourceUrlType,
});

const jobView = (job: StoredJob): Record<string, unknown> => ({
  summary: jobSummaryView(job),
  steps: [
    {
      stepName: "BUILD",
      startTime: job.startTime,
      status: job.status === "RUNNING" ? "RUNNING" : job.status,
      endTime: job.endTime ?? job.startTime,
    },
  ],
});

const artifactView = (artifact: StoredArtifact): Record<string, unknown> => ({
  artifactFileName: artifact.artifactFileName,
  artifactId: artifact.artifactId,
});

const requireApp = (ctx: ServiceContext, appId: string): StoredApp => {
  const stored = ctx.store.get<StoredApp>(appKey(appId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `App ${appId} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireBranch = (
  ctx: ServiceContext,
  appId: string,
  branchName: string,
): StoredBranch => {
  const stored = ctx.store.get<StoredBranch>(branchKey(appId, branchName));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Branch ${branchName} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireBackendEnv = (
  ctx: ServiceContext,
  appId: string,
  environmentName: string,
): StoredBackendEnvironment => {
  const stored = ctx.store.get<StoredBackendEnvironment>(
    backendEnvKey(appId, environmentName),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `BackendEnvironment ${environmentName} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireDomain = (
  ctx: ServiceContext,
  appId: string,
  domainName: string,
): StoredDomainAssociation => {
  const stored = ctx.store.get<StoredDomainAssociation>(
    domainKey(appId, domainName),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `DomainAssociation ${domainName} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireWebhook = (
  ctx: ServiceContext,
  webhookId: string,
): StoredWebhook => {
  const stored = ctx.store.get<StoredWebhook>(webhookKey(webhookId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Webhook ${webhookId} could not be found.`,
      404,
    );
  }
  return stored;
};

const requireJob = (
  ctx: ServiceContext,
  appId: string,
  branchName: string,
  jobId: string,
): StoredJob => {
  const stored = ctx.store.get<StoredJob>(jobKey(appId, branchName, jobId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Job ${jobId} could not be found.`,
      404,
    );
  }
  return stored;
};

const parseSubDomainSettings = (value: unknown): StoredSubDomain[] => {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).map((item) => {
    const rec = asRecord(item) ?? {};
    return {
      prefix: typeof rec["prefix"] === "string" ? rec["prefix"] : "",
      branchName:
        typeof rec["branchName"] === "string" ? rec["branchName"] : "",
      verified: false,
      dnsRecord: "",
    };
  });
};

const CreateApp: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const appId = newShortId();
  const at = nowSeconds();
  const app: StoredApp = {
    appId,
    appArn: appArnOf(ctx, appId),
    name,
    description: stringOrUndefined(input["description"]) ?? "",
    repository: stringOrUndefined(input["repository"]) ?? "",
    platform: stringOrUndefined(input["platform"]) ?? "WEB",
    computeRoleArn: stringOrUndefined(input["computeRoleArn"]),
    iamServiceRoleArn: stringOrUndefined(input["iamServiceRoleArn"]),
    createTime: at,
    updateTime: at,
    environmentVariables: stringMapFrom(input["environmentVariables"]),
    defaultDomain: defaultDomainOf(ctx, appId),
    enableBranchAutoBuild: booleanOr(input["enableBranchAutoBuild"], true),
    enableBranchAutoDeletion: booleanOr(
      input["enableBranchAutoDeletion"],
      false,
    ),
    enableBasicAuth: booleanOr(input["enableBasicAuth"], false),
    basicAuthCredentials: stringOrUndefined(input["basicAuthCredentials"]),
    buildSpec: stringOrUndefined(input["buildSpec"]),
    customHeaders: stringOrUndefined(input["customHeaders"]),
    enableAutoBranchCreation: booleanOr(
      input["enableAutoBranchCreation"],
      false,
    ),
    tags: stringMapFrom(input["tags"]),
  };
  ctx.store.set(appKey(appId), app);
  if (Object.keys(app.tags).length > 0) {
    ctx.store.set(tagKey(app.appArn), app.tags);
  }
  return { app: appView(app) };
};

const GetApp: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const app = requireApp(ctx, appId);
  const tags = ctx.store.get<Record<string, string>>(tagKey(app.appArn)) ?? {};
  return { app: appView({ ...app, tags }) };
};

const ListApps: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredApp>()
    .filter((entry) => entry.key.startsWith("app/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.createTime - b.createTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    apps: items.map((app) => appView(app)),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const UpdateApp: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const existing = requireApp(ctx, appId);
  const updated: StoredApp = {
    ...existing,
    name: stringOrUndefined(input["name"]) ?? existing.name,
    description:
      stringOrUndefined(input["description"]) ?? existing.description,
    repository: stringOrUndefined(input["repository"]) ?? existing.repository,
    platform: stringOrUndefined(input["platform"]) ?? existing.platform,
    computeRoleArn:
      stringOrUndefined(input["computeRoleArn"]) ?? existing.computeRoleArn,
    iamServiceRoleArn:
      stringOrUndefined(input["iamServiceRoleArn"]) ??
      existing.iamServiceRoleArn,
    environmentVariables:
      asRecord(input["environmentVariables"]) === undefined
        ? existing.environmentVariables
        : stringMapFrom(input["environmentVariables"]),
    enableBranchAutoBuild: booleanOr(
      input["enableBranchAutoBuild"],
      existing.enableBranchAutoBuild,
    ),
    enableBranchAutoDeletion: booleanOr(
      input["enableBranchAutoDeletion"],
      existing.enableBranchAutoDeletion,
    ),
    enableBasicAuth: booleanOr(
      input["enableBasicAuth"],
      existing.enableBasicAuth,
    ),
    basicAuthCredentials:
      stringOrUndefined(input["basicAuthCredentials"]) ??
      existing.basicAuthCredentials,
    buildSpec: stringOrUndefined(input["buildSpec"]) ?? existing.buildSpec,
    customHeaders:
      stringOrUndefined(input["customHeaders"]) ?? existing.customHeaders,
    enableAutoBranchCreation: booleanOr(
      input["enableAutoBranchCreation"],
      existing.enableAutoBranchCreation,
    ),
    updateTime: nowSeconds(),
  };
  ctx.store.set(appKey(appId), updated);
  return { app: appView(updated) };
};

const DeleteApp: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const app = requireApp(ctx, appId);
  for (const entry of ctx.store.list<StoredBranch>()) {
    if (entry.key.startsWith(`branch/${appId}/`)) {
      ctx.store.delete(tagKey(entry.value.branchArn));
      ctx.store.delete(entry.key);
    }
  }
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith(`job/${appId}/`) ||
      entry.key.startsWith(`artifact/${appId}/`) ||
      entry.key.startsWith(`domain/${appId}/`) ||
      entry.key.startsWith(`backendenvironment/${appId}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  for (const entry of ctx.store.list<StoredWebhook>()) {
    if (entry.key.startsWith("webhook/") && entry.value.appId === appId) {
      ctx.store.delete(entry.key);
    }
  }
  ctx.store.delete(tagKey(app.appArn));
  ctx.store.delete(appKey(appId));
  return { app: appView(app) };
};

const CreateBranch: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const branchName = requireString(input, "branchName");
  if (ctx.store.get<StoredBranch>(branchKey(appId, branchName)) !== undefined) {
    throw awsError(
      "DependentServiceFailureException",
      `Branch ${branchName} already exists.`,
      400,
    );
  }
  const at = nowSeconds();
  const branch: StoredBranch = {
    appId,
    branchArn: branchArnOf(ctx, appId, branchName),
    branchName,
    description: stringOrUndefined(input["description"]) ?? "",
    stage: stringOrUndefined(input["stage"]) ?? "NONE",
    displayName: stringOrUndefined(input["displayName"]) ?? branchName,
    enableNotification: booleanOr(input["enableNotification"], false),
    createTime: at,
    updateTime: at,
    environmentVariables: stringMapFrom(input["environmentVariables"]),
    enableAutoBuild: booleanOr(input["enableAutoBuild"], true),
    customDomains: [],
    framework: stringOrUndefined(input["framework"]) ?? "",
    activeJobId: "",
    totalNumberOfJobs: "0",
    enableBasicAuth: booleanOr(input["enableBasicAuth"], false),
    basicAuthCredentials: stringOrUndefined(input["basicAuthCredentials"]),
    buildSpec: stringOrUndefined(input["buildSpec"]),
    ttl: stringOrUndefined(input["ttl"]) ?? "5",
    enablePullRequestPreview: booleanOr(
      input["enablePullRequestPreview"],
      false,
    ),
    tags: stringMapFrom(input["tags"]),
  };
  ctx.store.set(branchKey(appId, branchName), branch);
  if (Object.keys(branch.tags).length > 0) {
    ctx.store.set(tagKey(branch.branchArn), branch.tags);
  }
  return { branch: branchView(branch) };
};

const GetBranch: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const stored = ctx.store.get<StoredBranch>(branchKey(appId, branchName));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Branch ${branchName} could not be found.`,
      404,
    );
  }
  const tags =
    ctx.store.get<Record<string, string>>(tagKey(stored.branchArn)) ?? {};
  return {
    branch: branchView({ ...stored, tags }),
  };
};

const ListBranches: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const all = ctx.store
    .list<StoredBranch>()
    .filter((entry) => entry.key.startsWith(`branch/${appId}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.branchName.localeCompare(b.branchName));
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    branches: items.map((branch) => branchView(branch)),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteBranch: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const branch = requireBranch(ctx, appId, branchName);
  ctx.store.delete(branchKey(appId, branchName));
  ctx.store.delete(tagKey(branch.branchArn));
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith(`job/${appId}/${branchName}/`) ||
      entry.key.startsWith(`artifact/${appId}/${branchName}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return { branch: branchView(branch) };
};

const UpdateBranch: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const existing = requireBranch(ctx, appId, branchName);
  const updated: StoredBranch = {
    ...existing,
    description:
      stringOrUndefined(input["description"]) ?? existing.description,
    framework: stringOrUndefined(input["framework"]) ?? existing.framework,
    stage: stringOrUndefined(input["stage"]) ?? existing.stage,
    displayName:
      stringOrUndefined(input["displayName"]) ?? existing.displayName,
    enableNotification: booleanOr(
      input["enableNotification"],
      existing.enableNotification,
    ),
    enableAutoBuild: booleanOr(
      input["enableAutoBuild"],
      existing.enableAutoBuild,
    ),
    environmentVariables:
      asRecord(input["environmentVariables"]) === undefined
        ? existing.environmentVariables
        : stringMapFrom(input["environmentVariables"]),
    basicAuthCredentials:
      stringOrUndefined(input["basicAuthCredentials"]) ??
      existing.basicAuthCredentials,
    enableBasicAuth: booleanOr(
      input["enableBasicAuth"],
      existing.enableBasicAuth,
    ),
    buildSpec: stringOrUndefined(input["buildSpec"]) ?? existing.buildSpec,
    ttl: stringOrUndefined(input["ttl"]) ?? existing.ttl,
    enablePullRequestPreview: booleanOr(
      input["enablePullRequestPreview"],
      existing.enablePullRequestPreview,
    ),
    updateTime: nowSeconds(),
  };
  ctx.store.set(branchKey(appId, branchName), updated);
  return { branch: branchView(updated) };
};

const CreateBackendEnvironment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const environmentName = requireString(input, "environmentName");
  if (
    ctx.store.get<StoredBackendEnvironment>(
      backendEnvKey(appId, environmentName),
    ) !== undefined
  ) {
    throw awsError(
      "BadRequestException",
      `BackendEnvironment ${environmentName} already exists.`,
      400,
    );
  }
  const at = nowSeconds();
  const env: StoredBackendEnvironment = {
    appId,
    backendEnvironmentArn: backendEnvArnOf(ctx, appId, environmentName),
    environmentName,
    stackName: stringOrUndefined(input["stackName"]),
    deploymentArtifacts: stringOrUndefined(input["deploymentArtifacts"]),
    createTime: at,
    updateTime: at,
  };
  ctx.store.set(backendEnvKey(appId, environmentName), env);
  return { backendEnvironment: backendEnvView(env) };
};

const GetBackendEnvironment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const environmentName = requireString(input, "environmentName");
  return {
    backendEnvironment: backendEnvView(
      requireBackendEnv(ctx, appId, environmentName),
    ),
  };
};

const ListBackendEnvironments: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const envNameFilter = stringOrUndefined(input["environmentName"]);
  const all = ctx.store
    .list<StoredBackendEnvironment>()
    .filter((entry) => entry.key.startsWith(`backendenvironment/${appId}/`))
    .map((entry) => entry.value)
    .filter(
      (env) =>
        envNameFilter === undefined || env.environmentName === envNameFilter,
    )
    .sort((a, b) => a.createTime - b.createTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    backendEnvironments: items.map(backendEnvView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteBackendEnvironment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const environmentName = requireString(input, "environmentName");
  const env = requireBackendEnv(ctx, appId, environmentName);
  ctx.store.delete(backendEnvKey(appId, environmentName));
  return { backendEnvironment: backendEnvView(env) };
};

const CreateDomainAssociation: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const domainName = requireString(input, "domainName");
  if (
    ctx.store.get<StoredDomainAssociation>(domainKey(appId, domainName)) !==
    undefined
  ) {
    throw awsError(
      "BadRequestException",
      `DomainAssociation ${domainName} already exists.`,
      400,
    );
  }
  const at = nowSeconds();
  const rawPatterns = input["autoSubDomainCreationPatterns"];
  const autoSubDomainCreationPatterns = Array.isArray(rawPatterns)
    ? (rawPatterns as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const domain: StoredDomainAssociation = {
    appId,
    domainAssociationArn: domainArnOf(ctx, appId, domainName),
    domainName,
    enableAutoSubDomain: booleanOr(input["enableAutoSubDomain"], false),
    autoSubDomainCreationPatterns,
    autoSubDomainIAMRole: stringOrUndefined(input["autoSubDomainIAMRole"]),
    domainStatus: "PENDING_VERIFICATION",
    updateStatus: undefined,
    statusReason: "",
    certificateVerificationDNSRecord: undefined,
    subDomains: parseSubDomainSettings(input["subDomainSettings"]),
    createTime: at,
    updateTime: at,
  };
  ctx.store.set(domainKey(appId, domainName), domain);
  return { domainAssociation: domainAssociationView(domain) };
};

const GetDomainAssociation: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const domainName = requireString(input, "domainName");
  const domain = requireDomain(ctx, appId, domainName);
  const newStatus = advanceDomainStatus(domain.domainStatus);
  const advanced: StoredDomainAssociation =
    newStatus !== domain.domainStatus
      ? { ...domain, domainStatus: newStatus }
      : domain;
  if (newStatus !== domain.domainStatus) {
    ctx.store.set(domainKey(appId, domainName), advanced);
  }
  return { domainAssociation: domainAssociationView(advanced) };
};

const ListDomainAssociations: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const all = ctx.store
    .list<StoredDomainAssociation>()
    .filter((entry) => entry.key.startsWith(`domain/${appId}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.createTime - b.createTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    domainAssociations: items.map(domainAssociationView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteDomainAssociation: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const domainName = requireString(input, "domainName");
  const domain = requireDomain(ctx, appId, domainName);
  ctx.store.delete(domainKey(appId, domainName));
  return { domainAssociation: domainAssociationView(domain) };
};

const UpdateDomainAssociation: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const domainName = requireString(input, "domainName");
  const existing = requireDomain(ctx, appId, domainName);
  const rawPatterns = input["autoSubDomainCreationPatterns"];
  const autoSubDomainCreationPatterns = Array.isArray(rawPatterns)
    ? (rawPatterns as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : existing.autoSubDomainCreationPatterns;
  const updated: StoredDomainAssociation = {
    ...existing,
    enableAutoSubDomain: booleanOr(
      input["enableAutoSubDomain"],
      existing.enableAutoSubDomain,
    ),
    autoSubDomainCreationPatterns,
    autoSubDomainIAMRole:
      stringOrUndefined(input["autoSubDomainIAMRole"]) ??
      existing.autoSubDomainIAMRole,
    subDomains: Array.isArray(input["subDomainSettings"])
      ? parseSubDomainSettings(input["subDomainSettings"])
      : existing.subDomains,
    updateTime: nowSeconds(),
  };
  ctx.store.set(domainKey(appId, domainName), updated);
  return { domainAssociation: domainAssociationView(updated) };
};

const CreateWebhook: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const branchName = requireString(input, "branchName");
  const webhookId = newShortId();
  const at = nowSeconds();
  const webhook: StoredWebhook = {
    webhookId,
    webhookArn: webhookArnOf(ctx, webhookId),
    webhookUrl: `https://webhooks.amplify.${ctx.region}.amazonaws.com/prod/${webhookId}`,
    appId,
    branchName,
    description: stringOrUndefined(input["description"]) ?? "",
    createTime: at,
    updateTime: at,
  };
  ctx.store.set(webhookKey(webhookId), webhook);
  return { webhook: webhookView(webhook) };
};

const GetWebhook: OperationHandler = (input, ctx) => {
  const webhookId = requireString(input, "webhookId");
  return { webhook: webhookView(requireWebhook(ctx, webhookId)) };
};

const ListWebhooks: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const all = ctx.store
    .list<StoredWebhook>()
    .filter(
      (entry) =>
        entry.key.startsWith("webhook/") && entry.value.appId === appId,
    )
    .map((entry) => entry.value)
    .sort((a, b) => a.createTime - b.createTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    webhooks: items.map(webhookView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteWebhook: OperationHandler = (input, ctx) => {
  const webhookId = requireString(input, "webhookId");
  const webhook = requireWebhook(ctx, webhookId);
  ctx.store.delete(webhookKey(webhookId));
  return { webhook: webhookView(webhook) };
};

const UpdateWebhook: OperationHandler = (input, ctx) => {
  const webhookId = requireString(input, "webhookId");
  const existing = requireWebhook(ctx, webhookId);
  const updated: StoredWebhook = {
    ...existing,
    branchName: stringOrUndefined(input["branchName"]) ?? existing.branchName,
    description:
      stringOrUndefined(input["description"]) ?? existing.description,
    updateTime: nowSeconds(),
  };
  ctx.store.set(webhookKey(webhookId), updated);
  return { webhook: webhookView(updated) };
};

const StartJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  requireApp(ctx, appId);
  requireBranch(ctx, appId, branchName);
  const jobType = requireString(input, "jobType");
  const jobId = newShortId();
  const at = nowSeconds();
  const job: StoredJob = {
    appId,
    branchName,
    jobId,
    jobArn: jobArnOf(ctx, appId, branchName, jobId),
    commitId: stringOrUndefined(input["commitId"]) ?? "HEAD",
    commitMessage: stringOrUndefined(input["commitMessage"]) ?? "",
    commitTime:
      typeof input["commitTime"] === "number" ? input["commitTime"] : at,
    startTime: at,
    status: "PENDING",
    endTime: undefined,
    jobType,
    sourceUrl: stringOrUndefined(input["sourceUrl"]),
    sourceUrlType: stringOrUndefined(input["sourceUrlType"]),
  };
  ctx.store.set(jobKey(appId, branchName, jobId), job);
  const artifactId = newShortId();
  const artifact: StoredArtifact = {
    appId,
    branchName,
    jobId,
    artifactId,
    artifactFileName: "build.zip",
  };
  ctx.store.set(artifactKey(appId, branchName, jobId, artifactId), artifact);
  const branch = requireBranch(ctx, appId, branchName);
  const updatedBranch: StoredBranch = {
    ...branch,
    activeJobId: jobId,
    totalNumberOfJobs: String(Number(branch.totalNumberOfJobs) + 1),
    updateTime: at,
  };
  ctx.store.set(branchKey(appId, branchName), updatedBranch);
  return { jobSummary: jobSummaryView(job) };
};

const GetJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const jobId = requireString(input, "jobId");
  const job = requireJob(ctx, appId, branchName, jobId);
  const newStatus = advanceJobStatus(job.status);
  const terminalStatuses = ["CANCELLED", "SUCCEED", "FAILED"] as const;
  const isTerminal = (s: string): boolean =>
    (terminalStatuses as readonly string[]).includes(s);
  const advanced: StoredJob =
    newStatus !== job.status
      ? {
          ...job,
          status: newStatus,
          endTime: isTerminal(newStatus) ? nowSeconds() : job.endTime,
        }
      : job;
  if (newStatus !== job.status) {
    ctx.store.set(jobKey(appId, branchName, jobId), advanced);
  }
  return { job: jobView(advanced) };
};

const ListJobs: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  requireApp(ctx, appId);
  requireBranch(ctx, appId, branchName);
  const prefix = `job/${appId}/${branchName}/`;
  const all = ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .sort((a, b) => b.startTime - a.startTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    jobSummaries: items.map(jobSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const jobId = requireString(input, "jobId");
  const job = requireJob(ctx, appId, branchName, jobId);
  ctx.store.delete(jobKey(appId, branchName, jobId));
  return { jobSummary: jobSummaryView(job) };
};

const StopJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const jobId = requireString(input, "jobId");
  const job = requireJob(ctx, appId, branchName, jobId);
  const terminalStatuses = ["CANCELLED", "SUCCEED", "FAILED"] as const;
  if ((terminalStatuses as readonly string[]).includes(job.status)) {
    throw awsError(
      "BadRequestException",
      `Job ${jobId} is already in a terminal state.`,
      400,
    );
  }
  const cancelling: StoredJob = { ...job, status: "CANCELLING" };
  ctx.store.set(jobKey(appId, branchName, jobId), cancelling);
  return { jobSummary: jobSummaryView(cancelling) };
};

const ListArtifacts: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  const jobId = requireString(input, "jobId");
  requireJob(ctx, appId, branchName, jobId);
  const prefix = `artifact/${appId}/${branchName}/${jobId}/`;
  const artifacts = ctx.store
    .list<StoredArtifact>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  return { artifacts: artifacts.map(artifactView) };
};

const CreateDeployment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  requireApp(ctx, appId);
  requireBranch(ctx, appId, branchName);
  const jobId = newShortId();
  const at = nowSeconds();
  const fileMap = stringMapFrom(input["fileMap"]);
  const fileUploadUrls: Record<string, string> = {};
  for (const fileName of Object.keys(fileMap)) {
    fileUploadUrls[fileName] =
      `https://artifacts.amplify.${ctx.region}.amazonaws.com/upload/${jobId}/${fileName}`;
  }
  const zipUploadUrl = `https://artifacts.amplify.${ctx.region}.amazonaws.com/upload/${jobId}/deployment.zip`;
  const job: StoredJob = {
    appId,
    branchName,
    jobId,
    jobArn: jobArnOf(ctx, appId, branchName, jobId),
    commitId: "DEPLOYMENT",
    commitMessage: "manual deployment",
    commitTime: at,
    startTime: at,
    status: "PENDING",
    endTime: undefined,
    jobType: "MANUAL",
    sourceUrl: undefined,
    sourceUrlType: undefined,
  };
  ctx.store.set(jobKey(appId, branchName, jobId), job);
  return { jobId, fileUploadUrls, zipUploadUrl };
};

const StartDeployment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  const branchName = requireString(input, "branchName");
  requireApp(ctx, appId);
  requireBranch(ctx, appId, branchName);
  const inputJobId = stringOrUndefined(input["jobId"]);
  const at = nowSeconds();
  if (inputJobId !== undefined) {
    const job = requireJob(ctx, appId, branchName, inputJobId);
    const started: StoredJob = {
      ...job,
      status: "RUNNING",
      startTime: at,
    };
    ctx.store.set(jobKey(appId, branchName, inputJobId), started);
    return { jobSummary: jobSummaryView(started) };
  }
  const jobId = newShortId();
  const sourceUrl = stringOrUndefined(input["sourceUrl"]) ?? "";
  const job: StoredJob = {
    appId,
    branchName,
    jobId,
    jobArn: jobArnOf(ctx, appId, branchName, jobId),
    commitId: "DEPLOYMENT",
    commitMessage: "manual deployment",
    commitTime: at,
    startTime: at,
    status: "RUNNING",
    endTime: undefined,
    jobType: "MANUAL",
    sourceUrl,
    sourceUrlType: stringOrUndefined(input["sourceUrlType"]),
  };
  ctx.store.set(jobKey(appId, branchName, jobId), job);
  return { jobSummary: jobSummaryView(job) };
};

const GenerateAccessLogs: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const domainName = requireString(input, "domainName");
  const logUrl = `https://logs.amplify.${ctx.region}.amazonaws.com/${appId}/${domainName}/access.log`;
  return { logUrl };
};

const GetArtifactUrl: OperationHandler = (input, ctx) => {
  const artifactId = requireString(input, "artifactId");
  const artifactUrl = `https://artifacts.amplify.${ctx.region}.amazonaws.com/${artifactId}`;
  return { artifactId, artifactUrl };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = stringMapFrom(input["tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  ctx.store.set(tagKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const updated = { ...existing };
  for (const key of tagKeys) delete updated[key];
  ctx.store.set(tagKey(resourceArn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const amplify = {
  name: "amplify",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "webhooks") {
      if (parts.length !== 2) return undefined;
      if (req.method === "GET") return "GetWebhook";
      if (req.method === "POST") return "UpdateWebhook";
      if (req.method === "DELETE") return "DeleteWebhook";
      return undefined;
    }

    if (parts[0] === "artifacts") {
      if (parts.length === 2 && req.method === "GET") return "GetArtifactUrl";
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts.length < 2) return undefined;
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    if (parts[0] !== "apps") return undefined;

    if (parts.length === 1) {
      if (req.method === "POST") return "CreateApp";
      if (req.method === "GET") return "ListApps";
      return undefined;
    }

    if (parts.length === 2) {
      if (req.method === "GET") return "GetApp";
      if (req.method === "POST") return "UpdateApp";
      if (req.method === "DELETE") return "DeleteApp";
      return undefined;
    }

    if (parts[2] === "branches") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateBranch";
        if (req.method === "GET") return "ListBranches";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetBranch";
        if (req.method === "POST") return "UpdateBranch";
        if (req.method === "DELETE") return "DeleteBranch";
        return undefined;
      }
      if (parts.length === 5) {
        if (parts[4] === "jobs") {
          if (req.method === "POST") return "StartJob";
          if (req.method === "GET") return "ListJobs";
        }
        if (parts[4] === "deployments" && req.method === "POST")
          return "CreateDeployment";
        return undefined;
      }
      if (parts.length === 6) {
        if (parts[4] === "jobs") {
          if (req.method === "GET") return "GetJob";
          if (req.method === "DELETE") return "DeleteJob";
        }
        if (
          parts[4] === "deployments" &&
          parts[5] === "start" &&
          req.method === "POST"
        )
          return "StartDeployment";
        return undefined;
      }
      if (parts.length === 7) {
        if (parts[4] === "jobs") {
          if (parts[6] === "stop" && req.method === "DELETE") return "StopJob";
          if (parts[6] === "artifacts" && req.method === "GET")
            return "ListArtifacts";
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[2] === "backendenvironments") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateBackendEnvironment";
        if (req.method === "GET") return "ListBackendEnvironments";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetBackendEnvironment";
        if (req.method === "DELETE") return "DeleteBackendEnvironment";
        return undefined;
      }
      return undefined;
    }

    if (parts[2] === "domains") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateDomainAssociation";
        if (req.method === "GET") return "ListDomainAssociations";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetDomainAssociation";
        if (req.method === "DELETE") return "DeleteDomainAssociation";
        if (req.method === "POST") return "UpdateDomainAssociation";
        return undefined;
      }
      return undefined;
    }

    if (parts[2] === "webhooks") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateWebhook";
        if (req.method === "GET") return "ListWebhooks";
        return undefined;
      }
      return undefined;
    }

    if (parts[2] === "accesslogs") {
      if (parts.length === 3 && req.method === "POST")
        return "GenerateAccessLogs";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateApp,
    GetApp,
    ListApps,
    UpdateApp,
    DeleteApp,
    CreateBranch,
    GetBranch,
    ListBranches,
    DeleteBranch,
    UpdateBranch,
    CreateBackendEnvironment,
    GetBackendEnvironment,
    ListBackendEnvironments,
    DeleteBackendEnvironment,
    CreateDomainAssociation,
    GetDomainAssociation,
    ListDomainAssociations,
    DeleteDomainAssociation,
    UpdateDomainAssociation,
    CreateWebhook,
    GetWebhook,
    ListWebhooks,
    DeleteWebhook,
    UpdateWebhook,
    StartJob,
    GetJob,
    ListJobs,
    DeleteJob,
    StopJob,
    ListArtifacts,
    CreateDeployment,
    StartDeployment,
    GenerateAccessLogs,
    GetArtifactUrl,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default amplify;
