import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codedeployModel from "../../models/codedeploy.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codedeployModel);

type StoredApplication = {
  applicationId: string;
  applicationName: string;
  arn: string;
  computePlatform: string;
  createTime: number;
  linkedToGitHub: boolean;
};

type StoredDeploymentGroup = {
  deploymentGroupId: string;
  applicationName: string;
  deploymentGroupName: string;
  arn: string;
  deploymentConfigName: string;
  serviceRoleArn: string;
  ec2TagFilters: unknown[];
  onPremisesInstanceTagFilters: unknown[];
  autoScalingGroups: string[];
  deploymentStyle: Record<string, unknown> | undefined;
  blueGreenDeploymentConfiguration: Record<string, unknown> | undefined;
  loadBalancerInfo: Record<string, unknown> | undefined;
  ec2TagSet: Record<string, unknown> | undefined;
  onPremisesTagSet: Record<string, unknown> | undefined;
  ecsServices: unknown[];
  alarmConfiguration: Record<string, unknown> | undefined;
  autoRollbackConfiguration: Record<string, unknown> | undefined;
  outdatedInstancesStrategy: string | undefined;
  terminationHookEnabled: boolean | undefined;
  triggerConfigurations: unknown[];
  createTime: number;
};

type StoredDeployment = {
  deploymentId: string;
  applicationName: string;
  deploymentGroupName: string | undefined;
  deploymentConfigName: string;
  description: string | undefined;
  revision: Record<string, unknown> | undefined;
  createTime: number;
  stoppedAt: number | undefined;
  stoppedMessage: string | undefined;
  ignoreApplicationStopFailures: boolean;
  fileExistsBehavior: string | undefined;
  creator: string;
};

type StoredDeploymentConfig = {
  deploymentConfigId: string;
  deploymentConfigName: string;
  arn: string;
  minimumHealthyHosts: Record<string, unknown> | undefined;
  trafficRoutingConfig: Record<string, unknown> | undefined;
  computePlatform: string;
  createTime: number;
  isDefault: boolean;
};

type TagEntry = { Key: string; Value: string };

type StoredOnPremisesInstance = {
  instanceName: string;
  iamUserArn: string | undefined;
  iamSessionArn: string | undefined;
  registerTime: number;
  deregisterTime: number | undefined;
  tags: TagEntry[];
};

type StoredRevision = {
  applicationName: string;
  revision: Record<string, unknown>;
  description: string | undefined;
  registerTime: number;
};

const appKey = (name: string): string => `app/${name}`;
const depGroupKey = (app: string, group: string): string =>
  `depgroup/${app}/${group}`;
const deploymentKey = (id: string): string => `deployment/${id}`;
const depConfigKey = (name: string): string => `depconfig/${name}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const onPremKey = (name: string): string => `onprem/${name}`;
const revisionKey = (app: string, hash: string): string =>
  `revision/${app}/${hash}`;

const appArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codedeploy:${ctx.region}:${ctx.account}:application:${name}`;
const depGroupArn = (ctx: ServiceContext, app: string, group: string): string =>
  `arn:aws:codedeploy:${ctx.region}:${ctx.account}:deploymentgroup:${app}/${group}`;
const depConfigArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codedeploy:${ctx.region}:${ctx.account}:deploymentconfig:${name}`;

const genDeploymentId = (): string => {
  const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 9).toUpperCase();
  return `d-${hex}`;
};

const genId = (): string => crypto.randomUUID();

const stringOrUndefined = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const boolOrUndefined = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;

const recordOrUndefined = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

const arrayOrEmpty = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const stringListFromInput = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];

const requireString = (input: Record<string, unknown>, key: string): string => {
  const v = input[key];
  if (typeof v !== "string" || v === "") {
    throw awsError("InvalidInputException", `${key} is required.`, 400);
  }
  return v;
};

const computeDeploymentStatus = (dep: StoredDeployment): string => {
  if (dep.stoppedAt !== undefined) return "Stopped";
  const elapsed = Date.now() - dep.createTime;
  if (elapsed < 1000) return "Created";
  if (elapsed < 5000) return "InProgress";
  return "Succeeded";
};

const listApplications = (ctx: ServiceContext): StoredApplication[] =>
  ctx.store
    .list<StoredApplication>()
    .filter((e) => e.key.startsWith("app/"))
    .map((e) => e.value);

const listDepGroups = (ctx: ServiceContext): StoredDeploymentGroup[] =>
  ctx.store
    .list<StoredDeploymentGroup>()
    .filter((e) => e.key.startsWith("depgroup/"))
    .map((e) => e.value);

const listDeployments = (ctx: ServiceContext): StoredDeployment[] =>
  ctx.store
    .list<StoredDeployment>()
    .filter((e) => e.key.startsWith("deployment/"))
    .map((e) => e.value);

const listDepConfigs = (ctx: ServiceContext): StoredDeploymentConfig[] =>
  ctx.store
    .list<StoredDeploymentConfig>()
    .filter((e) => e.key.startsWith("depconfig/"))
    .map((e) => e.value);

const listOnPremInstances = (ctx: ServiceContext): StoredOnPremisesInstance[] =>
  ctx.store
    .list<StoredOnPremisesInstance>()
    .filter((e) => e.key.startsWith("onprem/"))
    .map((e) => e.value);

const listRevisions = (ctx: ServiceContext, app: string): StoredRevision[] =>
  ctx.store
    .list<StoredRevision>()
    .filter((e) => e.key.startsWith(`revision/${app}/`))
    .map((e) => e.value);

const stableStringify = (v: unknown): string => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const sorted = Object.keys(v as Record<string, unknown>).sort();
  return `{${sorted
    .map(
      (k) =>
        `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`,
    )
    .join(",")}}`;
};

const revisionHash = (revision: Record<string, unknown>): string =>
  Buffer.from(stableStringify(revision)).toString("base64url");

const DEFAULT_CONFIGS: {
  name: string;
  computePlatform: string;
  minimumHealthyHosts: Record<string, unknown> | undefined;
  trafficRoutingConfig: Record<string, unknown> | undefined;
}[] = [
  {
    name: "CodeDeployDefault.AllAtOnce",
    computePlatform: "Server",
    minimumHealthyHosts: { type: "HOST_COUNT", value: 0 },
    trafficRoutingConfig: undefined,
  },
  {
    name: "CodeDeployDefault.HalfAtATime",
    computePlatform: "Server",
    minimumHealthyHosts: { type: "FLEET_PERCENT", value: 50 },
    trafficRoutingConfig: undefined,
  },
  {
    name: "CodeDeployDefault.OneAtATime",
    computePlatform: "Server",
    minimumHealthyHosts: { type: "HOST_COUNT", value: 1 },
    trafficRoutingConfig: undefined,
  },
  {
    name: "CodeDeployDefault.LambdaAllAtOnce",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: { type: "AllAtOnce" },
  },
  {
    name: "CodeDeployDefault.LambdaLinear10PercentEvery1Minute",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedLinear",
      timeBasedLinear: { linearPercentage: 10, linearInterval: 1 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaLinear10PercentEvery2Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedLinear",
      timeBasedLinear: { linearPercentage: 10, linearInterval: 2 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaLinear10PercentEvery3Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedLinear",
      timeBasedLinear: { linearPercentage: 10, linearInterval: 3 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaLinear10PercentEvery10Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedLinear",
      timeBasedLinear: { linearPercentage: 10, linearInterval: 10 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaCanary10Percent5Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedCanary",
      timeBasedCanary: { canaryPercentage: 10, canaryInterval: 5 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaCanary10Percent10Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedCanary",
      timeBasedCanary: { canaryPercentage: 10, canaryInterval: 10 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaCanary10Percent15Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedCanary",
      timeBasedCanary: { canaryPercentage: 10, canaryInterval: 15 },
    },
  },
  {
    name: "CodeDeployDefault.LambdaCanary10Percent30Minutes",
    computePlatform: "Lambda",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedCanary",
      timeBasedCanary: { canaryPercentage: 10, canaryInterval: 30 },
    },
  },
  {
    name: "CodeDeployDefault.ECSAllAtOnce",
    computePlatform: "ECS",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: { type: "AllAtOnce" },
  },
  {
    name: "CodeDeployDefault.ECSLinear10PercentEvery1Minutes",
    computePlatform: "ECS",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedLinear",
      timeBasedLinear: { linearPercentage: 10, linearInterval: 1 },
    },
  },
  {
    name: "CodeDeployDefault.ECSLinear10PercentEvery3Minutes",
    computePlatform: "ECS",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedLinear",
      timeBasedLinear: { linearPercentage: 10, linearInterval: 3 },
    },
  },
  {
    name: "CodeDeployDefault.ECSCanary10Percent5Minutes",
    computePlatform: "ECS",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedCanary",
      timeBasedCanary: { canaryPercentage: 10, canaryInterval: 5 },
    },
  },
  {
    name: "CodeDeployDefault.ECSCanary10Percent15Minutes",
    computePlatform: "ECS",
    minimumHealthyHosts: undefined,
    trafficRoutingConfig: {
      type: "TimeBasedCanary",
      timeBasedCanary: { canaryPercentage: 10, canaryInterval: 15 },
    },
  },
];

const ensureSeeded = (ctx: ServiceContext): void => {
  if (ctx.store.get<boolean>("__seeded") === true) return;
  const now = Date.now();
  for (const def of DEFAULT_CONFIGS) {
    const cfg: StoredDeploymentConfig = {
      deploymentConfigId: genId(),
      deploymentConfigName: def.name,
      arn: depConfigArn(ctx, def.name),
      minimumHealthyHosts: def.minimumHealthyHosts,
      trafficRoutingConfig: def.trafficRoutingConfig,
      computePlatform: def.computePlatform,
      createTime: now,
      isDefault: true,
    };
    ctx.store.set(depConfigKey(def.name), cfg);
  }
  ctx.store.set("__seeded", true);
};

const appView = (app: StoredApplication): Record<string, unknown> => ({
  applicationId: app.applicationId,
  applicationName: app.applicationName,
  computePlatform: app.computePlatform,
  createTime: app.createTime / 1000,
  linkedToGitHub: app.linkedToGitHub,
});

const depGroupView = (
  group: StoredDeploymentGroup,
): Record<string, unknown> => ({
  deploymentGroupId: group.deploymentGroupId,
  applicationName: group.applicationName,
  deploymentGroupName: group.deploymentGroupName,
  deploymentConfigName: group.deploymentConfigName,
  serviceRoleArn: group.serviceRoleArn,
  ec2TagFilters: group.ec2TagFilters,
  onPremisesInstanceTagFilters: group.onPremisesInstanceTagFilters,
  autoScalingGroups: group.autoScalingGroups.map((name) => ({ name })),
  deploymentStyle: group.deploymentStyle,
  blueGreenDeploymentConfiguration: group.blueGreenDeploymentConfiguration,
  loadBalancerInfo: group.loadBalancerInfo,
  ec2TagSet: group.ec2TagSet,
  onPremisesTagSet: group.onPremisesTagSet,
  ecsServices: group.ecsServices,
  alarmConfiguration: group.alarmConfiguration,
  autoRollbackConfiguration: group.autoRollbackConfiguration,
  outdatedInstancesStrategy: group.outdatedInstancesStrategy,
  terminationHookEnabled: group.terminationHookEnabled,
  triggerConfigurations: group.triggerConfigurations,
  createTime: group.createTime / 1000,
});

const deploymentView = (dep: StoredDeployment): Record<string, unknown> => {
  const status = computeDeploymentStatus(dep);
  return {
    deploymentId: dep.deploymentId,
    applicationName: dep.applicationName,
    deploymentGroupName: dep.deploymentGroupName,
    deploymentConfigName: dep.deploymentConfigName,
    description: dep.description,
    revision: dep.revision,
    status,
    createTime: dep.createTime / 1000,
    startTime: status !== "Created" ? dep.createTime / 1000 : undefined,
    completeTime:
      status === "Succeeded" || status === "Stopped"
        ? (dep.stoppedAt ?? dep.createTime + 5000) / 1000
        : undefined,
    ignoreApplicationStopFailures: dep.ignoreApplicationStopFailures,
    fileExistsBehavior: dep.fileExistsBehavior,
    creator: dep.creator,
    deploymentOverview: {
      Pending: 0,
      InProgress: status === "InProgress" ? 1 : 0,
      Succeeded: status === "Succeeded" ? 1 : 0,
      Failed: 0,
      Skipped: 0,
      Ready: 0,
    },
  };
};

const depConfigView = (
  cfg: StoredDeploymentConfig,
): Record<string, unknown> => ({
  deploymentConfigId: cfg.deploymentConfigId,
  deploymentConfigName: cfg.deploymentConfigName,
  minimumHealthyHosts: cfg.minimumHealthyHosts,
  trafficRoutingConfig: cfg.trafficRoutingConfig,
  computePlatform: cfg.computePlatform,
  createTime: cfg.createTime / 1000,
});

const onPremView = (
  inst: StoredOnPremisesInstance,
): Record<string, unknown> => ({
  instanceName: inst.instanceName,
  iamUserArn: inst.iamUserArn,
  iamSessionArn: inst.iamSessionArn,
  registerTime: inst.registerTime / 1000,
  deregisterTime:
    inst.deregisterTime !== undefined ? inst.deregisterTime / 1000 : undefined,
  tags: inst.tags,
});

const getTags = (ctx: ServiceContext, arn: string): TagEntry[] =>
  ctx.store.get<TagEntry[]>(tagsKey(arn)) ?? [];

const setTags = (ctx: ServiceContext, arn: string, tags: TagEntry[]): void =>
  ctx.store.set(tagsKey(arn), tags);

const mergeTags = (existing: TagEntry[], additions: unknown[]): TagEntry[] => {
  const map = new Map(existing.map((t) => [t.Key, t.Value]));
  for (const tag of additions) {
    const t = tag as { Key?: string; Value?: string };
    if (typeof t.Key === "string") {
      map.set(t.Key, t.Value ?? "");
    }
  }
  return Array.from(map.entries()).map(([Key, Value]) => ({ Key, Value }));
};

const removeTags = (existing: TagEntry[], keys: string[]): TagEntry[] =>
  existing.filter((t) => !keys.includes(t.Key));

const arnToResource = (
  ctx: ServiceContext,
  arn: string,
): { type: string; key: string } | undefined => {
  const appPrefix = `arn:aws:codedeploy:${ctx.region}:${ctx.account}:application:`;
  const dgPrefix = `arn:aws:codedeploy:${ctx.region}:${ctx.account}:deploymentgroup:`;
  const dcPrefix = `arn:aws:codedeploy:${ctx.region}:${ctx.account}:deploymentconfig:`;
  if (arn.startsWith(appPrefix)) {
    return { type: "application", key: arn.slice(appPrefix.length) };
  }
  if (arn.startsWith(dgPrefix)) {
    return { type: "deploymentgroup", key: arn.slice(dgPrefix.length) };
  }
  if (arn.startsWith(dcPrefix)) {
    return { type: "deploymentconfig", key: arn.slice(dcPrefix.length) };
  }
  return undefined;
};

const checkResourceExists = (
  ctx: ServiceContext,
  resource: { type: string; key: string },
): void => {
  if (resource.type === "application") {
    if (ctx.store.get(appKey(resource.key)) === undefined) {
      throw awsError(
        "ApplicationDoesNotExistException",
        `Application does not exist: ${resource.key}`,
        400,
      );
    }
  } else if (resource.type === "deploymentgroup") {
    const slashIdx = resource.key.indexOf("/");
    const appName = slashIdx >= 0 ? resource.key.slice(0, slashIdx) : "";
    const groupName = slashIdx >= 0 ? resource.key.slice(slashIdx + 1) : "";
    if (
      slashIdx < 0 ||
      ctx.store.get(depGroupKey(appName, groupName)) === undefined
    ) {
      throw awsError(
        "DeploymentGroupDoesNotExistException",
        `Deployment group does not exist: ${resource.key}`,
        400,
      );
    }
  } else if (resource.type === "deploymentconfig") {
    ensureSeeded(ctx);
    if (ctx.store.get(depConfigKey(resource.key)) === undefined) {
      throw awsError(
        "DeploymentConfigDoesNotExistException",
        `Deployment config does not exist: ${resource.key}`,
        400,
      );
    }
  }
};

const CreateApplication: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  if (ctx.store.get(appKey(applicationName)) !== undefined) {
    throw awsError(
      "ApplicationAlreadyExistsException",
      `Application already exists: ${applicationName}`,
      400,
    );
  }
  const tags = arrayOrEmpty(input["tags"]) as TagEntry[];
  const app: StoredApplication = {
    applicationId: genId(),
    applicationName,
    arn: appArn(ctx, applicationName),
    computePlatform: stringOrUndefined(input["computePlatform"]) ?? "Server",
    createTime: Date.now(),
    linkedToGitHub: false,
  };
  ctx.store.set(appKey(applicationName), app);
  if (tags.length > 0) setTags(ctx, app.arn, tags);
  return { applicationId: app.applicationId };
};

const GetApplication: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  return { application: appView(app) };
};

const ListApplications: OperationHandler = (input, ctx) => {
  const apps = listApplications(ctx)
    .map((a) => a.applicationName)
    .sort();
  const nextToken = stringOrUndefined(input["nextToken"]);
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString())
    : 0;
  const page = apps.slice(start, start + 100);
  const next =
    start + 100 < apps.length
      ? Buffer.from(String(start + 100)).toString("base64")
      : undefined;
  return { applications: page, nextToken: next };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app !== undefined) {
    ctx.store.delete(tagsKey(app.arn));
    const groups = listDepGroups(ctx).filter(
      (g) => g.applicationName === applicationName,
    );
    for (const g of groups) {
      ctx.store.delete(depGroupKey(applicationName, g.deploymentGroupName));
      ctx.store.delete(tagsKey(g.arn));
    }
  }
  ctx.store.delete(appKey(applicationName));
  return {};
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const newName = stringOrUndefined(input["newApplicationName"]);
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  if (newName !== undefined && newName !== applicationName) {
    if (ctx.store.get(appKey(newName)) !== undefined) {
      throw awsError(
        "ApplicationAlreadyExistsException",
        `Application already exists: ${newName}`,
        400,
      );
    }
    const tags = getTags(ctx, app.arn);
    const updated: StoredApplication = {
      ...app,
      applicationName: newName,
      arn: appArn(ctx, newName),
    };
    ctx.store.delete(appKey(applicationName));
    ctx.store.delete(tagsKey(app.arn));
    ctx.store.set(appKey(newName), updated);
    if (tags.length > 0) setTags(ctx, updated.arn, tags);
  }
  return {};
};

const BatchGetApplications: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["applicationNames"]);
  if (names.length > 100) {
    throw awsError(
      "BatchLimitExceededException",
      "Cannot get more than 100 applications at a time.",
      400,
    );
  }
  const infos = names
    .map((name) => {
      const app = ctx.store.get<StoredApplication>(appKey(name));
      return app ? appView(app) : undefined;
    })
    .filter((a) => a !== undefined);
  return { applicationsInfo: infos };
};

const CreateDeploymentGroup: OperationHandler = (input, ctx) => {
  ensureSeeded(ctx);
  const applicationName = requireString(input, "applicationName");
  const deploymentGroupName = requireString(input, "deploymentGroupName");
  const serviceRoleArn = requireString(input, "serviceRoleArn");

  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  if (
    ctx.store.get(depGroupKey(applicationName, deploymentGroupName)) !==
    undefined
  ) {
    throw awsError(
      "DeploymentGroupAlreadyExistsException",
      `Deployment group already exists: ${deploymentGroupName}`,
      400,
    );
  }
  const providedConfigName = stringOrUndefined(input["deploymentConfigName"]);
  if (providedConfigName !== undefined) {
    if (ctx.store.get(depConfigKey(providedConfigName)) === undefined) {
      throw awsError(
        "DeploymentConfigDoesNotExistException",
        `Deployment config does not exist: ${providedConfigName}`,
        400,
      );
    }
  }
  const configName = providedConfigName ?? "CodeDeployDefault.OneAtATime";
  const tags = arrayOrEmpty(input["tags"]) as TagEntry[];
  const group: StoredDeploymentGroup = {
    deploymentGroupId: genId(),
    applicationName,
    deploymentGroupName,
    arn: depGroupArn(ctx, applicationName, deploymentGroupName),
    deploymentConfigName: configName,
    serviceRoleArn,
    ec2TagFilters: arrayOrEmpty(input["ec2TagFilters"]),
    onPremisesInstanceTagFilters: arrayOrEmpty(
      input["onPremisesInstanceTagFilters"],
    ),
    autoScalingGroups: stringListFromInput(input["autoScalingGroups"]),
    deploymentStyle: recordOrUndefined(input["deploymentStyle"]),
    blueGreenDeploymentConfiguration: recordOrUndefined(
      input["blueGreenDeploymentConfiguration"],
    ),
    loadBalancerInfo: recordOrUndefined(input["loadBalancerInfo"]),
    ec2TagSet: recordOrUndefined(input["ec2TagSet"]),
    onPremisesTagSet: recordOrUndefined(input["onPremisesTagSet"]),
    ecsServices: arrayOrEmpty(input["ecsServices"]),
    alarmConfiguration: recordOrUndefined(input["alarmConfiguration"]),
    autoRollbackConfiguration: recordOrUndefined(
      input["autoRollbackConfiguration"],
    ),
    outdatedInstancesStrategy: stringOrUndefined(
      input["outdatedInstancesStrategy"],
    ),
    terminationHookEnabled: boolOrUndefined(input["terminationHookEnabled"]),
    triggerConfigurations: arrayOrEmpty(input["triggerConfigurations"]),
    createTime: Date.now(),
  };
  ctx.store.set(depGroupKey(applicationName, deploymentGroupName), group);
  if (tags.length > 0) setTags(ctx, group.arn, tags);
  return { deploymentGroupId: group.deploymentGroupId };
};

const GetDeploymentGroup: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const deploymentGroupName = requireString(input, "deploymentGroupName");
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const group = ctx.store.get<StoredDeploymentGroup>(
    depGroupKey(applicationName, deploymentGroupName),
  );
  if (group === undefined) {
    throw awsError(
      "DeploymentGroupDoesNotExistException",
      `Deployment group does not exist: ${deploymentGroupName}`,
      400,
    );
  }
  return { deploymentGroupInfo: depGroupView(group) };
};

const ListDeploymentGroups: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const groups = listDepGroups(ctx)
    .filter((g) => g.applicationName === applicationName)
    .map((g) => g.deploymentGroupName)
    .sort();
  const nextToken = stringOrUndefined(input["nextToken"]);
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString())
    : 0;
  const page = groups.slice(start, start + 100);
  const next =
    start + 100 < groups.length
      ? Buffer.from(String(start + 100)).toString("base64")
      : undefined;
  return { applicationName, deploymentGroups: page, nextToken: next };
};

const UpdateDeploymentGroup: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const currentName = requireString(input, "currentDeploymentGroupName");
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const group = ctx.store.get<StoredDeploymentGroup>(
    depGroupKey(applicationName, currentName),
  );
  if (group === undefined) {
    throw awsError(
      "DeploymentGroupDoesNotExistException",
      `Deployment group does not exist: ${currentName}`,
      400,
    );
  }
  const newName = stringOrUndefined(input["newDeploymentGroupName"]);
  const targetName = newName ?? currentName;
  if (newName !== undefined && newName !== currentName) {
    if (ctx.store.get(depGroupKey(applicationName, newName)) !== undefined) {
      throw awsError(
        "DeploymentGroupAlreadyExistsException",
        `Deployment group already exists: ${newName}`,
        400,
      );
    }
  }
  const newConfigName = stringOrUndefined(input["deploymentConfigName"]);
  if (newConfigName !== undefined) {
    if (ctx.store.get(depConfigKey(newConfigName)) === undefined) {
      throw awsError(
        "DeploymentConfigDoesNotExistException",
        `Deployment config does not exist: ${newConfigName}`,
        400,
      );
    }
  }
  const updated: StoredDeploymentGroup = {
    ...group,
    deploymentGroupName: targetName,
    arn: depGroupArn(ctx, applicationName, targetName),
    deploymentConfigName: newConfigName ?? group.deploymentConfigName,
    serviceRoleArn:
      stringOrUndefined(input["serviceRoleArn"]) ?? group.serviceRoleArn,
    ec2TagFilters:
      input["ec2TagFilters"] !== undefined
        ? arrayOrEmpty(input["ec2TagFilters"])
        : group.ec2TagFilters,
    onPremisesInstanceTagFilters:
      input["onPremisesInstanceTagFilters"] !== undefined
        ? arrayOrEmpty(input["onPremisesInstanceTagFilters"])
        : group.onPremisesInstanceTagFilters,
    autoScalingGroups:
      input["autoScalingGroups"] !== undefined
        ? stringListFromInput(input["autoScalingGroups"])
        : group.autoScalingGroups,
    deploymentStyle:
      input["deploymentStyle"] !== undefined
        ? recordOrUndefined(input["deploymentStyle"])
        : group.deploymentStyle,
    blueGreenDeploymentConfiguration:
      input["blueGreenDeploymentConfiguration"] !== undefined
        ? recordOrUndefined(input["blueGreenDeploymentConfiguration"])
        : group.blueGreenDeploymentConfiguration,
    loadBalancerInfo:
      input["loadBalancerInfo"] !== undefined
        ? recordOrUndefined(input["loadBalancerInfo"])
        : group.loadBalancerInfo,
    ec2TagSet:
      input["ec2TagSet"] !== undefined
        ? recordOrUndefined(input["ec2TagSet"])
        : group.ec2TagSet,
    onPremisesTagSet:
      input["onPremisesTagSet"] !== undefined
        ? recordOrUndefined(input["onPremisesTagSet"])
        : group.onPremisesTagSet,
    ecsServices:
      input["ecsServices"] !== undefined
        ? arrayOrEmpty(input["ecsServices"])
        : group.ecsServices,
    alarmConfiguration:
      input["alarmConfiguration"] !== undefined
        ? recordOrUndefined(input["alarmConfiguration"])
        : group.alarmConfiguration,
    autoRollbackConfiguration:
      input["autoRollbackConfiguration"] !== undefined
        ? recordOrUndefined(input["autoRollbackConfiguration"])
        : group.autoRollbackConfiguration,
    outdatedInstancesStrategy:
      stringOrUndefined(input["outdatedInstancesStrategy"]) ??
      group.outdatedInstancesStrategy,
    terminationHookEnabled:
      input["terminationHookEnabled"] !== undefined
        ? boolOrUndefined(input["terminationHookEnabled"])
        : group.terminationHookEnabled,
    triggerConfigurations:
      input["triggerConfigurations"] !== undefined
        ? arrayOrEmpty(input["triggerConfigurations"])
        : group.triggerConfigurations,
  };
  if (newName !== undefined && newName !== currentName) {
    const tags = getTags(ctx, group.arn);
    ctx.store.delete(depGroupKey(applicationName, currentName));
    ctx.store.delete(tagsKey(group.arn));
    ctx.store.set(depGroupKey(applicationName, newName), updated);
    if (tags.length > 0) setTags(ctx, updated.arn, tags);
  } else {
    ctx.store.set(depGroupKey(applicationName, currentName), updated);
  }
  return { hooksNotCleanedUp: [] };
};

const DeleteDeploymentGroup: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const deploymentGroupName = requireString(input, "deploymentGroupName");
  const group = ctx.store.get<StoredDeploymentGroup>(
    depGroupKey(applicationName, deploymentGroupName),
  );
  if (group !== undefined) {
    ctx.store.delete(tagsKey(group.arn));
  }
  ctx.store.delete(depGroupKey(applicationName, deploymentGroupName));
  return { hooksNotCleanedUp: [] };
};

const BatchGetDeploymentGroups: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  const names = stringListFromInput(input["deploymentGroupNames"]);
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const infos = names.map((name) => {
    const group = ctx.store.get<StoredDeploymentGroup>(
      depGroupKey(applicationName, name),
    );
    return group ? depGroupView(group) : undefined;
  });
  return { deploymentGroupsInfo: infos, errorMessage: undefined };
};

const CreateDeployment: OperationHandler = (input, ctx) => {
  ensureSeeded(ctx);
  const applicationName = requireString(input, "applicationName");
  const app = ctx.store.get<StoredApplication>(appKey(applicationName));
  if (app === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const deploymentGroupName = stringOrUndefined(input["deploymentGroupName"]);
  if (deploymentGroupName !== undefined) {
    const group = ctx.store.get<StoredDeploymentGroup>(
      depGroupKey(applicationName, deploymentGroupName),
    );
    if (group === undefined) {
      throw awsError(
        "DeploymentGroupDoesNotExistException",
        `Deployment group does not exist: ${deploymentGroupName}`,
        400,
      );
    }
  }
  const group =
    deploymentGroupName !== undefined
      ? ctx.store.get<StoredDeploymentGroup>(
          depGroupKey(applicationName, deploymentGroupName),
        )
      : undefined;
  const providedDepConfigName = stringOrUndefined(
    input["deploymentConfigName"],
  );
  if (providedDepConfigName !== undefined) {
    if (ctx.store.get(depConfigKey(providedDepConfigName)) === undefined) {
      throw awsError(
        "DeploymentConfigDoesNotExistException",
        `Deployment config does not exist: ${providedDepConfigName}`,
        400,
      );
    }
  }
  const configName =
    providedDepConfigName ??
    group?.deploymentConfigName ??
    "CodeDeployDefault.OneAtATime";
  const revision = recordOrUndefined(input["revision"]);
  if (revision === undefined) {
    throw awsError(
      "RevisionRequiredException",
      "A revision must be specified.",
      400,
    );
  }
  const hash = revisionHash(revision);
  const revKey = revisionKey(applicationName, hash);
  if (ctx.store.get(revKey) === undefined) {
    const rev: StoredRevision = {
      applicationName,
      revision,
      description: undefined,
      registerTime: Date.now(),
    };
    ctx.store.set(revKey, rev);
  }
  const deploymentId = genDeploymentId();
  const dep: StoredDeployment = {
    deploymentId,
    applicationName,
    deploymentGroupName,
    deploymentConfigName: configName,
    description: stringOrUndefined(input["description"]),
    revision,
    createTime: Date.now(),
    stoppedAt: undefined,
    stoppedMessage: undefined,
    ignoreApplicationStopFailures:
      typeof input["ignoreApplicationStopFailures"] === "boolean"
        ? input["ignoreApplicationStopFailures"]
        : false,
    fileExistsBehavior: stringOrUndefined(input["fileExistsBehavior"]),
    creator: "user",
  };
  ctx.store.set(deploymentKey(deploymentId), dep);
  return { deploymentId };
};

const GetDeployment: OperationHandler = (input, ctx) => {
  const deploymentId = requireString(input, "deploymentId");
  const dep = ctx.store.get<StoredDeployment>(deploymentKey(deploymentId));
  if (dep === undefined) {
    throw awsError(
      "DeploymentDoesNotExistException",
      `Deployment does not exist: ${deploymentId}`,
      400,
    );
  }
  return { deploymentInfo: deploymentView(dep) };
};

const ListDeployments: OperationHandler = (input, ctx) => {
  const applicationName = stringOrUndefined(input["applicationName"]);
  const deploymentGroupName = stringOrUndefined(input["deploymentGroupName"]);

  if (applicationName !== undefined) {
    if (ctx.store.get(appKey(applicationName)) === undefined) {
      throw awsError(
        "ApplicationDoesNotExistException",
        `Application does not exist: ${applicationName}`,
        400,
      );
    }
  }
  if (deploymentGroupName !== undefined) {
    if (applicationName === undefined) {
      throw awsError(
        "InvalidInputException",
        "applicationName is required when deploymentGroupName is specified.",
        400,
      );
    }
    if (
      ctx.store.get(depGroupKey(applicationName, deploymentGroupName)) ===
      undefined
    ) {
      throw awsError(
        "DeploymentGroupDoesNotExistException",
        `Deployment group does not exist: ${deploymentGroupName}`,
        400,
      );
    }
  }

  const statusFilter = Array.isArray(input["includeOnlyStatuses"])
    ? (input["includeOnlyStatuses"] as string[])
    : undefined;
  const createTimeRange = recordOrUndefined(input["createTimeRange"]);
  let deps = listDeployments(ctx);
  if (applicationName !== undefined) {
    deps = deps.filter((d) => d.applicationName === applicationName);
  }
  if (deploymentGroupName !== undefined) {
    deps = deps.filter((d) => d.deploymentGroupName === deploymentGroupName);
  }
  if (statusFilter !== undefined && statusFilter.length > 0) {
    deps = deps.filter((d) =>
      statusFilter.includes(computeDeploymentStatus(d)),
    );
  }
  if (createTimeRange !== undefined) {
    const rangeStart =
      typeof createTimeRange["start"] === "number"
        ? createTimeRange["start"] * 1000
        : undefined;
    const rangeEnd =
      typeof createTimeRange["end"] === "number"
        ? createTimeRange["end"] * 1000
        : undefined;
    if (rangeStart !== undefined)
      deps = deps.filter((d) => d.createTime >= rangeStart);
    if (rangeEnd !== undefined)
      deps = deps.filter((d) => d.createTime <= rangeEnd);
  }
  const ids = deps.map((d) => d.deploymentId);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString())
    : 0;
  const page = ids.slice(start, start + 100);
  const next =
    start + 100 < ids.length
      ? Buffer.from(String(start + 100)).toString("base64")
      : undefined;
  return { deployments: page, nextToken: next };
};

const StopDeployment: OperationHandler = (input, ctx) => {
  const deploymentId = requireString(input, "deploymentId");
  const dep = ctx.store.get<StoredDeployment>(deploymentKey(deploymentId));
  if (dep === undefined) {
    throw awsError(
      "DeploymentDoesNotExistException",
      `Deployment does not exist: ${deploymentId}`,
      400,
    );
  }
  const currentStatus = computeDeploymentStatus(dep);
  if (currentStatus === "Succeeded" || currentStatus === "Stopped") {
    throw awsError(
      "DeploymentAlreadyCompletedException",
      `Deployment ${deploymentId} has already completed.`,
      400,
    );
  }
  const updated: StoredDeployment = {
    ...dep,
    stoppedAt: Date.now(),
    stoppedMessage: "Stopped by user",
  };
  ctx.store.set(deploymentKey(deploymentId), updated);
  return { status: "Succeeded", statusMessage: "Deployment stopped." };
};

const BatchGetDeployments: OperationHandler = (input, ctx) => {
  const ids = stringListFromInput(input["deploymentIds"]);
  if (ids.length > 25) {
    throw awsError(
      "BatchLimitExceededException",
      "Cannot get more than 25 deployments at a time.",
      400,
    );
  }
  const infos = ids
    .map((id) => {
      const dep = ctx.store.get<StoredDeployment>(deploymentKey(id));
      return dep ? deploymentView(dep) : undefined;
    })
    .filter((d) => d !== undefined);
  return { deploymentsInfo: infos };
};

const CreateDeploymentConfig: OperationHandler = (input, ctx) => {
  ensureSeeded(ctx);
  const deploymentConfigName = requireString(input, "deploymentConfigName");
  if (ctx.store.get(depConfigKey(deploymentConfigName)) !== undefined) {
    throw awsError(
      "DeploymentConfigAlreadyExistsException",
      `Deployment config already exists: ${deploymentConfigName}`,
      400,
    );
  }
  const cfg: StoredDeploymentConfig = {
    deploymentConfigId: genId(),
    deploymentConfigName,
    arn: depConfigArn(ctx, deploymentConfigName),
    minimumHealthyHosts: recordOrUndefined(input["minimumHealthyHosts"]),
    trafficRoutingConfig: recordOrUndefined(input["trafficRoutingConfig"]),
    computePlatform: stringOrUndefined(input["computePlatform"]) ?? "Server",
    createTime: Date.now(),
    isDefault: false,
  };
  ctx.store.set(depConfigKey(deploymentConfigName), cfg);
  return { deploymentConfigId: cfg.deploymentConfigId };
};

const GetDeploymentConfig: OperationHandler = (input, ctx) => {
  ensureSeeded(ctx);
  const deploymentConfigName = requireString(input, "deploymentConfigName");
  const cfg = ctx.store.get<StoredDeploymentConfig>(
    depConfigKey(deploymentConfigName),
  );
  if (cfg === undefined) {
    throw awsError(
      "DeploymentConfigDoesNotExistException",
      `Deployment config does not exist: ${deploymentConfigName}`,
      400,
    );
  }
  return { deploymentConfigInfo: depConfigView(cfg) };
};

const ListDeploymentConfigs: OperationHandler = (input, ctx) => {
  ensureSeeded(ctx);
  const names = listDepConfigs(ctx)
    .map((c) => c.deploymentConfigName)
    .sort();
  const nextToken = stringOrUndefined(input["nextToken"]);
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString())
    : 0;
  const page = names.slice(start, start + 100);
  const next =
    start + 100 < names.length
      ? Buffer.from(String(start + 100)).toString("base64")
      : undefined;
  return { deploymentConfigsList: page, nextToken: next };
};

const DeleteDeploymentConfig: OperationHandler = (input, ctx) => {
  const deploymentConfigName = requireString(input, "deploymentConfigName");
  const cfg = ctx.store.get<StoredDeploymentConfig>(
    depConfigKey(deploymentConfigName),
  );
  if (cfg?.isDefault === true) {
    throw awsError(
      "InvalidOperationException",
      `Cannot delete built-in deployment configuration: ${deploymentConfigName}`,
      400,
    );
  }
  if (cfg === undefined) {
    return {};
  }
  const inUse = listDepGroups(ctx).some(
    (g) => g.deploymentConfigName === deploymentConfigName,
  );
  if (inUse) {
    throw awsError(
      "DeploymentConfigInUseException",
      `Deployment config is in use: ${deploymentConfigName}`,
      400,
    );
  }
  ctx.store.delete(depConfigKey(deploymentConfigName));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const resource = arnToResource(ctx, arn);
  if (resource === undefined) {
    throw awsError(
      "ArnNotSupportedException",
      `ARN not supported: ${arn}`,
      400,
    );
  }
  checkResourceExists(ctx, resource);
  const tags = arrayOrEmpty(input["Tags"]) as TagEntry[];
  const existing = getTags(ctx, arn);
  setTags(ctx, arn, mergeTags(existing, tags));
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const resource = arnToResource(ctx, arn);
  if (resource === undefined) {
    throw awsError(
      "ArnNotSupportedException",
      `ARN not supported: ${arn}`,
      400,
    );
  }
  checkResourceExists(ctx, resource);
  const keys = stringListFromInput(input["TagKeys"]);
  const existing = getTags(ctx, arn);
  setTags(ctx, arn, removeTags(existing, keys));
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const resource = arnToResource(ctx, arn);
  if (resource === undefined) {
    throw awsError(
      "ArnNotSupportedException",
      `ARN not supported: ${arn}`,
      400,
    );
  }
  checkResourceExists(ctx, resource);
  const tags = getTags(ctx, arn);
  return { Tags: tags };
};

const AddTagsToOnPremisesInstances: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["instanceNames"]);
  const tags = arrayOrEmpty(input["tags"]) as TagEntry[];
  if (tags.length === 0) {
    throw awsError(
      "TagRequiredException",
      "At least one tag is required.",
      400,
    );
  }
  for (const name of names) {
    const inst = ctx.store.get<StoredOnPremisesInstance>(onPremKey(name));
    if (inst === undefined) {
      throw awsError(
        "InstanceNotRegisteredException",
        `Instance not registered: ${name}`,
        400,
      );
    }
    const updated: StoredOnPremisesInstance = {
      ...inst,
      tags: mergeTags(inst.tags, tags),
    };
    ctx.store.set(onPremKey(name), updated);
  }
  return {};
};

const BatchGetApplicationRevisions: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  if (ctx.store.get(appKey(applicationName)) === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const revisions = arrayOrEmpty(input["revisions"]);
  const result = revisions
    .map((r) => {
      const rev = recordOrUndefined(r);
      if (rev === undefined) return undefined;
      const hash = revisionHash(rev);
      const stored = ctx.store.get<StoredRevision>(
        revisionKey(applicationName, hash),
      );
      if (stored === undefined) return undefined;
      return {
        revisionLocation: stored.revision,
        genericRevisionInfo: {
          description: stored.description,
          registerTime: stored.registerTime / 1000,
        },
      };
    })
    .filter((r) => r !== undefined);
  return { applicationName, revisions: result, errorMessage: undefined };
};

const BatchGetDeploymentInstances: OperationHandler = (_input, _ctx) => ({
  instancesSummary: [],
  errorMessage: undefined,
});

const BatchGetDeploymentTargets: OperationHandler = (_input, _ctx) => ({
  deploymentTargets: [],
});

const BatchGetOnPremisesInstances: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["instanceNames"]);
  if (names.length > 25) {
    throw awsError(
      "BatchLimitExceededException",
      "Cannot get more than 25 on-premises instances at a time.",
      400,
    );
  }
  const infos = names
    .map((name) => {
      const inst = ctx.store.get<StoredOnPremisesInstance>(onPremKey(name));
      return inst ? onPremView(inst) : undefined;
    })
    .filter((i) => i !== undefined);
  return { instanceInfos: infos };
};

const ContinueDeployment: OperationHandler = (input, ctx) => {
  const deploymentId = requireString(input, "deploymentId");
  const dep = ctx.store.get<StoredDeployment>(deploymentKey(deploymentId));
  if (dep === undefined) {
    throw awsError(
      "DeploymentDoesNotExistException",
      `Deployment does not exist: ${deploymentId}`,
      400,
    );
  }
  const currentStatus = computeDeploymentStatus(dep);
  if (currentStatus === "Succeeded" || currentStatus === "Stopped") {
    throw awsError(
      "DeploymentAlreadyCompletedException",
      `Deployment ${deploymentId} has already completed.`,
      400,
    );
  }
  return {};
};

const DeleteGitHubAccountToken: OperationHandler = (input, _ctx) => ({
  tokenName: stringOrUndefined(input["tokenName"]),
});

const DeleteResourcesByExternalId: OperationHandler = (_input, _ctx) => ({});

const DeregisterOnPremisesInstance: OperationHandler = (input, ctx) => {
  const instanceName = requireString(input, "instanceName");
  const inst = ctx.store.get<StoredOnPremisesInstance>(onPremKey(instanceName));
  if (inst === undefined) {
    throw awsError(
      "InstanceNotRegisteredException",
      `Instance not registered: ${instanceName}`,
      400,
    );
  }
  const updated: StoredOnPremisesInstance = {
    ...inst,
    deregisterTime: Date.now(),
  };
  ctx.store.set(onPremKey(instanceName), updated);
  return {};
};

const GetApplicationRevision: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  if (ctx.store.get(appKey(applicationName)) === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const revision = recordOrUndefined(input["revision"]);
  if (revision === undefined) {
    throw awsError(
      "RevisionRequiredException",
      "A revision must be specified.",
      400,
    );
  }
  const hash = revisionHash(revision);
  const stored = ctx.store.get<StoredRevision>(
    revisionKey(applicationName, hash),
  );
  if (stored === undefined) {
    throw awsError(
      "RevisionDoesNotExistException",
      `Revision does not exist for application: ${applicationName}`,
      400,
    );
  }
  return {
    applicationName,
    revision: stored.revision,
    revisionInfo: {
      description: stored.description,
      registerTime: stored.registerTime / 1000,
    },
  };
};

const GetDeploymentInstance: OperationHandler = (_input, _ctx) => ({
  instanceSummary: undefined,
});

const GetDeploymentTarget: OperationHandler = (_input, _ctx) => ({
  deploymentTarget: undefined,
});

const GetOnPremisesInstance: OperationHandler = (input, ctx) => {
  const instanceName = requireString(input, "instanceName");
  const inst = ctx.store.get<StoredOnPremisesInstance>(onPremKey(instanceName));
  if (inst === undefined) {
    throw awsError(
      "InstanceNotRegisteredException",
      `Instance not registered: ${instanceName}`,
      400,
    );
  }
  return { instanceInfo: onPremView(inst) };
};

const ListApplicationRevisions: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  if (ctx.store.get(appKey(applicationName)) === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const revs = listRevisions(ctx, applicationName);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString())
    : 0;
  const page = revs.slice(start, start + 100);
  const next =
    start + 100 < revs.length
      ? Buffer.from(String(start + 100)).toString("base64")
      : undefined;
  return {
    revisions: page.map((r) => r.revision),
    nextToken: next,
  };
};

const ListDeploymentInstances: OperationHandler = (_input, _ctx) => ({
  instancesList: [],
  nextToken: undefined,
});

const ListDeploymentTargets: OperationHandler = (_input, _ctx) => ({
  targetIds: [],
  nextToken: undefined,
});

const ListGitHubAccountTokenNames: OperationHandler = (_input, _ctx) => ({
  tokenNameList: [],
  nextToken: undefined,
});

const ListOnPremisesInstances: OperationHandler = (input, ctx) => {
  const registrationStatus = stringOrUndefined(input["registrationStatus"]);
  const tagFilters = arrayOrEmpty(input["tagFilters"]) as Array<{
    Key?: string;
    Value?: string;
    Type?: string;
  }>;

  let instances = listOnPremInstances(ctx);

  if (registrationStatus === "Registered") {
    instances = instances.filter((i) => i.deregisterTime === undefined);
  } else if (registrationStatus === "Deregistered") {
    instances = instances.filter((i) => i.deregisterTime !== undefined);
  }

  if (tagFilters.length > 0) {
    instances = instances.filter((inst) =>
      tagFilters.every((filter) => {
        const { Key, Value } = filter;
        if (Key === undefined && Value === undefined) return true;
        return inst.tags.some((t) => {
          if (Key !== undefined && Value !== undefined)
            return t.Key === Key && t.Value === Value;
          if (Key !== undefined) return t.Key === Key;
          if (Value !== undefined) return t.Value === Value;
          return true;
        });
      }),
    );
  }

  const names = instances.map((i) => i.instanceName);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const start = nextToken
    ? parseInt(Buffer.from(nextToken, "base64").toString())
    : 0;
  const page = names.slice(start, start + 100);
  const next =
    start + 100 < names.length
      ? Buffer.from(String(start + 100)).toString("base64")
      : undefined;
  return { instanceNames: page, nextToken: next };
};

const PutLifecycleEventHookExecutionStatus: OperationHandler = (input, ctx) => {
  const deploymentId = requireString(input, "deploymentId");
  const dep = ctx.store.get<StoredDeployment>(deploymentKey(deploymentId));
  if (dep === undefined) {
    throw awsError(
      "DeploymentDoesNotExistException",
      `Deployment does not exist: ${deploymentId}`,
      400,
    );
  }
  const currentStatus = computeDeploymentStatus(dep);
  if (currentStatus === "Succeeded" || currentStatus === "Stopped") {
    throw awsError(
      "DeploymentAlreadyCompletedException",
      `Deployment ${deploymentId} has already completed.`,
      400,
    );
  }
  return { lifecycleEventHookExecutionId: undefined };
};

const RegisterApplicationRevision: OperationHandler = (input, ctx) => {
  const applicationName = requireString(input, "applicationName");
  if (ctx.store.get(appKey(applicationName)) === undefined) {
    throw awsError(
      "ApplicationDoesNotExistException",
      `Application does not exist: ${applicationName}`,
      400,
    );
  }
  const revision = recordOrUndefined(input["revision"]);
  if (revision === undefined) {
    throw awsError(
      "RevisionRequiredException",
      "A revision must be specified.",
      400,
    );
  }
  const description = stringOrUndefined(input["description"]);
  const hash = revisionHash(revision);
  const rev: StoredRevision = {
    applicationName,
    revision,
    description,
    registerTime: Date.now(),
  };
  ctx.store.set(revisionKey(applicationName, hash), rev);
  return {};
};

const RegisterOnPremisesInstance: OperationHandler = (input, ctx) => {
  const instanceName = requireString(input, "instanceName");
  const iamUserArn = stringOrUndefined(input["iamUserArn"]);
  const iamSessionArn = stringOrUndefined(input["iamSessionArn"]);
  if (iamUserArn !== undefined && iamSessionArn !== undefined) {
    throw awsError(
      "InvalidIamSessionArnException",
      "Cannot specify both iamUserArn and iamSessionArn.",
      400,
    );
  }
  if (ctx.store.get(onPremKey(instanceName)) !== undefined) {
    throw awsError(
      "InstanceNameAlreadyRegisteredException",
      `Instance already registered: ${instanceName}`,
      400,
    );
  }
  const inst: StoredOnPremisesInstance = {
    instanceName,
    iamUserArn,
    iamSessionArn,
    registerTime: Date.now(),
    deregisterTime: undefined,
    tags: [],
  };
  ctx.store.set(onPremKey(instanceName), inst);
  return {};
};

const RemoveTagsFromOnPremisesInstances: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["instanceNames"]);
  const tagEntries = arrayOrEmpty(input["tags"]) as Array<{ Key?: string }>;
  if (tagEntries.length === 0) {
    throw awsError(
      "TagRequiredException",
      "At least one tag is required.",
      400,
    );
  }
  const tagKeys = tagEntries
    .map((t) => t.Key)
    .filter((k): k is string => typeof k === "string");
  for (const name of names) {
    const inst = ctx.store.get<StoredOnPremisesInstance>(onPremKey(name));
    if (inst === undefined) {
      throw awsError(
        "InstanceNotRegisteredException",
        `Instance not registered: ${name}`,
        400,
      );
    }
    const updated: StoredOnPremisesInstance = {
      ...inst,
      tags: removeTags(inst.tags, tagKeys),
    };
    ctx.store.set(onPremKey(name), updated);
  }
  return {};
};

const SkipWaitTimeForInstanceTermination: OperationHandler = (input, ctx) => {
  const deploymentId = requireString(input, "deploymentId");
  const dep = ctx.store.get<StoredDeployment>(deploymentKey(deploymentId));
  if (dep === undefined) {
    throw awsError(
      "DeploymentDoesNotExistException",
      `Deployment does not exist: ${deploymentId}`,
      400,
    );
  }
  const currentStatus = computeDeploymentStatus(dep);
  if (currentStatus === "Succeeded" || currentStatus === "Stopped") {
    throw awsError(
      "DeploymentAlreadyCompletedException",
      `Deployment ${deploymentId} has already completed.`,
      400,
    );
  }
  return {};
};

const codedeploy = {
  name: "codedeploy",
  protocol: "json",
  operations: {
    AddTagsToOnPremisesInstances,
    BatchGetApplicationRevisions,
    BatchGetApplications,
    BatchGetDeploymentGroups,
    BatchGetDeploymentInstances,
    BatchGetDeploymentTargets,
    BatchGetDeployments,
    BatchGetOnPremisesInstances,
    ContinueDeployment,
    CreateApplication,
    CreateDeployment,
    CreateDeploymentConfig,
    CreateDeploymentGroup,
    DeleteApplication,
    DeleteDeploymentConfig,
    DeleteDeploymentGroup,
    DeleteGitHubAccountToken,
    DeleteResourcesByExternalId,
    DeregisterOnPremisesInstance,
    GetApplication,
    GetApplicationRevision,
    GetDeployment,
    GetDeploymentConfig,
    GetDeploymentGroup,
    GetDeploymentInstance,
    GetDeploymentTarget,
    GetOnPremisesInstance,
    ListApplicationRevisions,
    ListApplications,
    ListDeploymentConfigs,
    ListDeploymentGroups,
    ListDeploymentInstances,
    ListDeploymentTargets,
    ListDeployments,
    ListGitHubAccountTokenNames,
    ListOnPremisesInstances,
    ListTagsForResource,
    PutLifecycleEventHookExecutionStatus,
    RegisterApplicationRevision,
    RegisterOnPremisesInstance,
    RemoveTagsFromOnPremisesInstances,
    SkipWaitTimeForInstanceTermination,
    StopDeployment,
    TagResource,
    UntagResource,
    UpdateApplication,
    UpdateDeploymentGroup,
  },
  model,
} as const satisfies ServiceDefinition;

export default codedeploy;
