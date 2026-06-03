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

const appKey = (appId: string): string => `app/${appId}`;

const branchKey = (appId: string, branchName: string): string =>
  `branch/${appId}/${branchName}`;

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

const defaultDomainOf = (ctx: ServiceContext, appId: string): string =>
  `${appId}.amplifyapp.com.${ctx.region}`;

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

const CreateApp: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const appId = crypto.randomUUID().replaceAll("-", "").slice(0, 14);
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
  return { app: appView(app) };
};

const GetApp: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  return { app: appView(requireApp(ctx, appId)) };
};

const ListApps: OperationHandler = (_input, ctx) => {
  const apps = ctx.store
    .list<StoredApp>()
    .filter((entry) => entry.key.startsWith("app/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.createTime - b.createTime);
  return { apps: apps.map((app) => appView(app)) };
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
      ctx.store.delete(entry.key);
    }
  }
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
  return { branch: branchView(stored) };
};

const ListBranches: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "appId");
  requireApp(ctx, appId);
  const branches = ctx.store
    .list<StoredBranch>()
    .filter((entry) => entry.key.startsWith(`branch/${appId}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.branchName.localeCompare(b.branchName));
  return { branches: branches.map((branch) => branchView(branch)) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const amplify = {
  name: "amplify",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
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
      if (parts.length === 4 && req.method === "GET") return "GetBranch";
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
  },
  model,
} as const satisfies ServiceDefinition;

export default amplify;
