import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import emrModel from "../../../../test/vendor/aws-models/emr.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(emrModel);

type Tag = { Key: string; Value: string };

type StoredStep = {
  Id: string;
  Name: string;
  State: string;
  ActionOnFailure: string;
  Jar: string;
};

type StoredCluster = {
  Id: string;
  Name: string;
  ClusterArn: string;
  State: string;
  ReleaseLabel: string | undefined;
  LogUri: string | undefined;
  Steps: StoredStep[];
  TerminationProtected: boolean;
  VisibleToAllUsers: boolean;
  KeepJobFlowAliveWhenNoSteps: boolean;
  UnhealthyNodeReplacement: boolean;
  StepConcurrencyLevel: number;
  MasterInstanceType: string;
  SlaveInstanceType: string;
  InstanceCount: number;
};

type StoredFleet = {
  Id: string;
  ClusterId: string;
  Name: string;
  InstanceFleetType: string;
  State: string;
};

type StoredGroup = {
  Id: string;
  ClusterId: string;
  Name: string;
  InstanceGroupType: string;
  InstanceType: string;
  RequestedInstanceCount: number;
  RunningInstanceCount: number;
  State: string;
  Market: string;
};

type StoredStudio = {
  StudioId: string;
  StudioArn: string;
  Name: string;
  Description: string | undefined;
  AuthMode: string;
  VpcId: string;
  SubnetIds: string[];
  ServiceRole: string;
  UserRole: string | undefined;
  WorkspaceSecurityGroupId: string;
  EngineSecurityGroupId: string;
  Url: string;
  DefaultS3Location: string | undefined;
  IdpAuthUrl: string | undefined;
  IdpRelayStateParameterName: string | undefined;
  TrustedIdentityPropagationEnabled: boolean | undefined;
  IdcUserAssignment: string | undefined;
  IdcInstanceArn: string | undefined;
  EncryptionKeyArn: string | undefined;
  CreationTime: number;
};

type StoredSessionMapping = {
  StudioId: string;
  IdentityId: string;
  IdentityName: string;
  IdentityType: string;
  SessionPolicyArn: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredSecurityConfig = {
  Name: string;
  SecurityConfiguration: string;
  CreationDateTime: number;
};

type StoredNotebookExecution = {
  NotebookExecutionId: string;
  EditorId: string | undefined;
  NotebookExecutionName: string | undefined;
  NotebookParams: string | undefined;
  Status: string;
  StartTime: number;
  EndTime: number | undefined;
  ExecutionEngineId: string | undefined;
};

type StoredPersistentAppUI = {
  PersistentAppUIId: string;
  TargetResourceArn: string;
  Status: string;
  CreationTime: number;
  LastModifiedTime: number;
};

const clusterKey = (id: string): string => `cluster/${id}`;
const fleetKey = (clusterId: string, fleetId: string): string =>
  `fleet/${clusterId}/${fleetId}`;
const groupKey = (clusterId: string, groupId: string): string =>
  `group/${clusterId}/${groupId}`;
const studioKey = (id: string): string => `studio/${id}`;
const mappingKey = (
  studioId: string,
  identityType: string,
  id: string,
): string => `mapping/${studioId}/${identityType}/${id}`;
const secConfigKey = (name: string): string => `secconfig/${name}`;
const notebookKey = (id: string): string => `notebook/${id}`;
const puiKey = (id: string): string => `pui/${id}`;
const tagsKey = (resourceId: string): string => `tags/${resourceId}`;
const autoTerminationKey = (clusterId: string): string =>
  `policy/autotermination/${clusterId}`;
const managedScalingKey = (clusterId: string): string =>
  `policy/managedscaling/${clusterId}`;
const autoScalingKey = (clusterId: string, groupId: string): string =>
  `policy/autoscaling/${clusterId}/${groupId}`;
const BLOCK_PUBLIC_ACCESS_KEY = "policy/blockpublicaccess";

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidRequestException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const boolOrDefault = (value: unknown, def: boolean): boolean =>
  typeof value === "boolean" ? value : def;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const clusterArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:elasticmapreduce:${ctx.region}:${ctx.account}:cluster/${id}`;

const studioArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:elasticmapreduce:${ctx.region}:${ctx.account}:studio/${id}`;

const newId = (): string =>
  `j-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const newStepId = (): string =>
  `s-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const newFleetId = (): string =>
  `if-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const newGroupId = (): string =>
  `ig-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const newStudioId = (): string =>
  `es-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const newNotebookId = (): string =>
  `ex-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const newPuiId = (): string =>
  `ui-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const nowEpoch = (): number => Date.now() / 1000;

const statusOf = (state: string): Record<string, unknown> => ({
  State: state,
  StateChangeReason: { Code: "USER_REQUEST", Message: "" },
  Timeline: {},
});

const requireCluster = (ctx: ServiceContext, id: string): StoredCluster => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Cluster id '${id}' is not valid.`,
      400,
    );
  }
  return cluster;
};

const requireStudio = (ctx: ServiceContext, id: string): StoredStudio => {
  const studio = ctx.store.get<StoredStudio>(studioKey(id));
  if (studio === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Studio id '${id}' is not valid.`,
      400,
    );
  }
  return studio;
};

const requireSecConfig = (
  ctx: ServiceContext,
  name: string,
): StoredSecurityConfig => {
  const config = ctx.store.get<StoredSecurityConfig>(secConfigKey(name));
  if (config === undefined) {
    throw awsError(
      "InvalidRequestException",
      `SecurityConfiguration '${name}' does not exist.`,
      400,
    );
  }
  return config;
};

const requireNotebook = (
  ctx: ServiceContext,
  id: string,
): StoredNotebookExecution => {
  const nb = ctx.store.get<StoredNotebookExecution>(notebookKey(id));
  if (nb === undefined) {
    throw awsError(
      "InvalidRequestException",
      `NotebookExecution '${id}' does not exist.`,
      400,
    );
  }
  return nb;
};

const getTags = (ctx: ServiceContext, resourceId: string): Tag[] =>
  ctx.store.get<Tag[]>(tagsKey(resourceId)) ?? [];

const setTags = (
  ctx: ServiceContext,
  resourceId: string,
  tags: Tag[],
): void => {
  ctx.store.set(tagsKey(resourceId), tags);
};

const RunJobFlow: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (input["Instances"] === undefined) {
    throw awsError("InvalidRequestException", "Instances is required.", 400);
  }
  const instances =
    (input["Instances"] as Record<string, unknown> | undefined) ?? {};
  const id = newId();
  const cluster: StoredCluster = {
    Id: id,
    Name: name,
    ClusterArn: clusterArn(ctx, id),
    State: "WAITING",
    ReleaseLabel: stringOrUndefined(input["ReleaseLabel"]),
    LogUri: stringOrUndefined(input["LogUri"]),
    Steps: [],
    TerminationProtected: boolOrDefault(
      instances["TerminationProtected"],
      false,
    ),
    VisibleToAllUsers: boolOrDefault(input["VisibleToAllUsers"], true),
    KeepJobFlowAliveWhenNoSteps: boolOrDefault(
      instances["KeepJobFlowAliveWhenNoSteps"],
      false,
    ),
    UnhealthyNodeReplacement: boolOrDefault(
      instances["UnhealthyNodeReplacement"],
      false,
    ),
    StepConcurrencyLevel: 1,
    MasterInstanceType:
      typeof instances["MasterInstanceType"] === "string"
        ? instances["MasterInstanceType"]
        : "m5.xlarge",
    SlaveInstanceType:
      typeof instances["SlaveInstanceType"] === "string"
        ? instances["SlaveInstanceType"]
        : "m5.xlarge",
    InstanceCount:
      typeof instances["InstanceCount"] === "number"
        ? instances["InstanceCount"]
        : 1,
  };
  ctx.store.set(clusterKey(id), cluster);
  return { JobFlowId: id, ClusterArn: cluster.ClusterArn };
};

const ListClusters: OperationHandler = (_input, ctx) => {
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => ({
      Id: entry.value.Id,
      Name: entry.value.Name,
      ClusterArn: entry.value.ClusterArn,
      Status: statusOf(entry.value.State),
      NormalizedInstanceHours: 0,
    }));
  return { Clusters: clusters };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, id);
  return {
    Cluster: {
      Id: cluster.Id,
      Name: cluster.Name,
      ClusterArn: cluster.ClusterArn,
      Status: statusOf(cluster.State),
      ReleaseLabel: cluster.ReleaseLabel,
      LogUri: cluster.LogUri,
      InstanceCollectionType: "INSTANCE_GROUP",
      AutoTerminate: false,
      TerminationProtected: cluster.TerminationProtected ?? false,
      VisibleToAllUsers: cluster.VisibleToAllUsers ?? true,
      Tags: getTags(ctx, cluster.Id),
    },
  };
};

const AddJobFlowSteps: OperationHandler = (input, ctx) => {
  const id = requireString(input, "JobFlowId");
  const cluster = requireCluster(ctx, id);
  const steps = Array.isArray(input["Steps"]) ? input["Steps"] : [];
  const added: StoredStep[] = steps.map((step) => {
    const s =
      typeof step === "object" && step !== null
        ? (step as Record<string, unknown>)
        : {};
    const hadoopStep =
      typeof s["HadoopJarStep"] === "object" && s["HadoopJarStep"] !== null
        ? (s["HadoopJarStep"] as Record<string, unknown>)
        : {};
    return {
      Id: newStepId(),
      Name: typeof s["Name"] === "string" ? s["Name"] : "step",
      State: "PENDING",
      ActionOnFailure:
        typeof s["ActionOnFailure"] === "string"
          ? s["ActionOnFailure"]
          : "CONTINUE",
      Jar: typeof hadoopStep["Jar"] === "string" ? hadoopStep["Jar"] : "",
    };
  });
  const updated: StoredCluster = {
    ...cluster,
    Steps: [...cluster.Steps, ...added],
  };
  ctx.store.set(clusterKey(id), updated);
  return { StepIds: added.map((step) => step.Id) };
};

const TerminateJobFlows: OperationHandler = (input, ctx) => {
  const ids = stringList(input["JobFlowIds"]);
  for (const id of ids) {
    ctx.store.delete(clusterKey(id));
  }
  return {};
};

const AddInstanceFleet: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, clusterId);
  const fleetInput =
    (input["InstanceFleet"] as Record<string, unknown> | undefined) ?? {};
  const fleetId = newFleetId();
  const fleet: StoredFleet = {
    Id: fleetId,
    ClusterId: clusterId,
    Name: typeof fleetInput["Name"] === "string" ? fleetInput["Name"] : "fleet",
    InstanceFleetType:
      typeof fleetInput["InstanceFleetType"] === "string"
        ? fleetInput["InstanceFleetType"]
        : "CORE",
    State: "RUNNING",
  };
  ctx.store.set(fleetKey(clusterId, fleetId), fleet);
  return {
    ClusterId: clusterId,
    InstanceFleetId: fleetId,
    ClusterArn: cluster.ClusterArn,
  };
};

const AddInstanceGroups: OperationHandler = (input, ctx) => {
  const jobFlowId = requireString(input, "JobFlowId");
  const cluster = requireCluster(ctx, jobFlowId);
  const groups = Array.isArray(input["InstanceGroups"])
    ? input["InstanceGroups"]
    : [];
  const addedIds: string[] = [];
  for (const grp of groups) {
    const g =
      typeof grp === "object" && grp !== null
        ? (grp as Record<string, unknown>)
        : {};
    const groupId = newGroupId();
    const group: StoredGroup = {
      Id: groupId,
      ClusterId: jobFlowId,
      Name: typeof g["Name"] === "string" ? g["Name"] : "group",
      InstanceGroupType:
        typeof g["InstanceRole"] === "string" ? g["InstanceRole"] : "CORE",
      InstanceType:
        typeof g["InstanceType"] === "string" ? g["InstanceType"] : "m5.xlarge",
      RequestedInstanceCount:
        typeof g["InstanceCount"] === "number" ? g["InstanceCount"] : 1,
      RunningInstanceCount: 0,
      State: "RUNNING",
      Market: typeof g["Market"] === "string" ? g["Market"] : "ON_DEMAND",
    };
    ctx.store.set(groupKey(jobFlowId, groupId), group);
    addedIds.push(groupId);
  }
  return {
    JobFlowId: jobFlowId,
    InstanceGroupIds: addedIds,
    ClusterArn: cluster.ClusterArn,
  };
};

const AddTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as unknown[])
        .filter(
          (t): t is Record<string, unknown> =>
            typeof t === "object" && t !== null,
        )
        .map((t) => ({
          Key: String(t["Key"] ?? ""),
          Value: String(t["Value"] ?? ""),
        }))
    : [];
  const existing = getTags(ctx, resourceId);
  const merged = [
    ...existing.filter((e) => !newTags.some((n) => n.Key === e.Key)),
    ...newTags,
  ];
  setTags(ctx, resourceId, merged);
  return {};
};

const CancelSteps: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, clusterId);
  const stepIds = stringList(input["StepIds"]);
  const results: Record<string, unknown>[] = [];
  const updatedSteps = cluster.Steps.map((step) => {
    if (stepIds.includes(step.Id)) {
      results.push({ StepId: step.Id, Status: "SUBMITTED", Reason: "" });
      return { ...step, State: "CANCELLED" };
    }
    return step;
  });
  ctx.store.set(clusterKey(clusterId), { ...cluster, Steps: updatedSteps });
  return { CancelStepsInfoList: results };
};

const CreatePersistentAppUI: OperationHandler = (input, ctx) => {
  const targetResourceArn = requireString(input, "TargetResourceArn");
  const id = newPuiId();
  const ts = nowEpoch();
  const pui: StoredPersistentAppUI = {
    PersistentAppUIId: id,
    TargetResourceArn: targetResourceArn,
    Status: "ACTIVE",
    CreationTime: ts,
    LastModifiedTime: ts,
  };
  ctx.store.set(puiKey(id), pui);
  return { PersistentAppUIId: id, RuntimeRoleEnabledCluster: false };
};

const CreateSecurityConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const secConfig =
    typeof input["SecurityConfiguration"] === "string"
      ? input["SecurityConfiguration"]
      : "{}";
  const creationDateTime = nowEpoch();
  const config: StoredSecurityConfig = {
    Name: name,
    SecurityConfiguration: secConfig,
    CreationDateTime: creationDateTime,
  };
  ctx.store.set(secConfigKey(name), config);
  return { Name: name, CreationDateTime: creationDateTime };
};

const CreateStudio: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const authMode = requireString(input, "AuthMode");
  const vpcId = requireString(input, "VpcId");
  const serviceRole = requireString(input, "ServiceRole");
  const workspaceSecurityGroupId = requireString(
    input,
    "WorkspaceSecurityGroupId",
  );
  const engineSecurityGroupId = requireString(input, "EngineSecurityGroupId");
  const id = newStudioId();
  const studio: StoredStudio = {
    StudioId: id,
    StudioArn: studioArn(ctx, id),
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    AuthMode: authMode,
    VpcId: vpcId,
    SubnetIds: stringList(input["SubnetIds"]),
    ServiceRole: serviceRole,
    UserRole: stringOrUndefined(input["UserRole"]),
    WorkspaceSecurityGroupId: workspaceSecurityGroupId,
    EngineSecurityGroupId: engineSecurityGroupId,
    Url: `https://studio-${id}.emrstudio-prod.${ctx.region}.amazonaws.com`,
    DefaultS3Location: stringOrUndefined(input["DefaultS3Location"]),
    IdpAuthUrl: stringOrUndefined(input["IdpAuthUrl"]),
    IdpRelayStateParameterName: stringOrUndefined(
      input["IdpRelayStateParameterName"],
    ),
    TrustedIdentityPropagationEnabled:
      typeof input["TrustedIdentityPropagationEnabled"] === "boolean"
        ? input["TrustedIdentityPropagationEnabled"]
        : undefined,
    IdcUserAssignment: stringOrUndefined(input["IdcUserAssignment"]),
    IdcInstanceArn: stringOrUndefined(input["IdcInstanceArn"]),
    EncryptionKeyArn: stringOrUndefined(input["EncryptionKeyArn"]),
    CreationTime: nowEpoch(),
  };
  ctx.store.set(studioKey(id), studio);
  if (Array.isArray(input["Tags"])) {
    const tags = (input["Tags"] as unknown[])
      .filter(
        (t): t is Record<string, unknown> =>
          typeof t === "object" && t !== null,
      )
      .map((t) => ({
        Key: String(t["Key"] ?? ""),
        Value: String(t["Value"] ?? ""),
      }));
    setTags(ctx, id, tags);
  }
  return { StudioId: id, Url: studio.Url };
};

const CreateStudioSessionMapping: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  requireStudio(ctx, studioId);
  const identityType = requireString(input, "IdentityType");
  const identityId = stringOrUndefined(input["IdentityId"]) ?? "";
  const identityName = stringOrUndefined(input["IdentityName"]) ?? "";
  const sessionPolicyArn = stringOrUndefined(input["SessionPolicyArn"]) ?? "";
  const lookupKey = identityId !== "" ? identityId : identityName;
  const ts = nowEpoch();
  const mapping: StoredSessionMapping = {
    StudioId: studioId,
    IdentityId: identityId,
    IdentityName: identityName,
    IdentityType: identityType,
    SessionPolicyArn: sessionPolicyArn,
    CreationTime: ts,
    LastModifiedTime: ts,
  };
  ctx.store.set(mappingKey(studioId, identityType, lookupKey), mapping);
  return {};
};

const DeleteSecurityConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireSecConfig(ctx, name);
  ctx.store.delete(secConfigKey(name));
  return {};
};

const DeleteStudio: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  requireStudio(ctx, studioId);
  ctx.store.delete(studioKey(studioId));
  return {};
};

const DeleteStudioSessionMapping: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  requireStudio(ctx, studioId);
  const identityType = requireString(input, "IdentityType");
  const identityId = stringOrUndefined(input["IdentityId"]) ?? "";
  const identityName = stringOrUndefined(input["IdentityName"]) ?? "";
  const lookupKey = identityId !== "" ? identityId : identityName;
  ctx.store.delete(mappingKey(studioId, identityType, lookupKey));
  return {};
};

const DescribeJobFlows: OperationHandler = (input, ctx) => {
  const jobFlowIds = stringList(input["JobFlowIds"]);
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .filter((c) => jobFlowIds.length === 0 || jobFlowIds.includes(c.Id));
  const ts = nowEpoch();
  const jobFlows = clusters.map((c) => ({
    JobFlowId: c.Id,
    Name: c.Name,
    LogUri: c.LogUri,
    ExecutionStatusDetail: {
      State: c.State,
      CreationDateTime: ts,
    },
    Instances: {
      MasterInstanceType: c.MasterInstanceType ?? "m5.xlarge",
      SlaveInstanceType: c.SlaveInstanceType ?? "m5.xlarge",
      InstanceCount: c.InstanceCount ?? 1,
    },
    Steps: c.Steps.map((s) => ({
      StepConfig: {
        Name: s.Name,
        HadoopJarStep: { Jar: s.Jar },
      },
      ExecutionStatusDetail: {
        State: s.State,
        CreationDateTime: ts,
      },
    })),
  }));
  return { JobFlows: jobFlows };
};

const DescribeNotebookExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookExecutionId");
  const nb = requireNotebook(ctx, id);
  return {
    NotebookExecution: {
      NotebookExecutionId: nb.NotebookExecutionId,
      EditorId: nb.EditorId,
      NotebookExecutionName: nb.NotebookExecutionName,
      NotebookParams: nb.NotebookParams,
      Status: nb.Status,
      StartTime: nb.StartTime,
      EndTime: nb.EndTime,
    },
  };
};

const DescribePersistentAppUI: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PersistentAppUIId");
  const pui = ctx.store.get<StoredPersistentAppUI>(puiKey(id));
  if (pui === undefined) {
    throw awsError(
      "InvalidRequestException",
      `PersistentAppUI '${id}' does not exist.`,
      400,
    );
  }
  return {
    PersistentAppUI: {
      PersistentAppUIId: pui.PersistentAppUIId,
      PersistentAppUIStatus: pui.Status,
      CreationTime: pui.CreationTime,
      LastModifiedTime: pui.LastModifiedTime,
    },
  };
};

const DescribeReleaseLabel: OperationHandler = (input, _ctx) => {
  const releaseLabel = stringOrUndefined(input["ReleaseLabel"]) ?? "emr-6.9.0";
  return {
    ReleaseLabel: releaseLabel,
    Applications: [{ Name: "Hadoop", Version: "3.3.3" }],
    AvailableOSReleases: [{ Label: "2.0.20221004.0" }],
  };
};

const DescribeSecurityConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const config = requireSecConfig(ctx, name);
  return {
    Name: config.Name,
    SecurityConfiguration: config.SecurityConfiguration,
    CreationDateTime: config.CreationDateTime,
  };
};

const DescribeStep: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const stepId = requireString(input, "StepId");
  const cluster = requireCluster(ctx, clusterId);
  const step = cluster.Steps.find((s) => s.Id === stepId);
  if (step === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Step '${stepId}' does not exist in cluster '${clusterId}'.`,
      400,
    );
  }
  return {
    Step: {
      Id: step.Id,
      Name: step.Name,
      Config: { Jar: step.Jar, Properties: {}, Args: [] },
      ActionOnFailure: step.ActionOnFailure,
      Status: {
        State: step.State,
        StateChangeReason: {},
        Timeline: {},
      },
    },
  };
};

const DescribeStudio: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  const studio = requireStudio(ctx, studioId);
  return {
    Studio: {
      StudioId: studio.StudioId,
      StudioArn: studio.StudioArn,
      Name: studio.Name,
      Description: studio.Description,
      AuthMode: studio.AuthMode,
      VpcId: studio.VpcId,
      SubnetIds: studio.SubnetIds,
      ServiceRole: studio.ServiceRole,
      UserRole: studio.UserRole,
      WorkspaceSecurityGroupId: studio.WorkspaceSecurityGroupId,
      EngineSecurityGroupId: studio.EngineSecurityGroupId,
      Url: studio.Url,
      CreationTime: studio.CreationTime,
      DefaultS3Location: studio.DefaultS3Location,
      IdpAuthUrl: studio.IdpAuthUrl,
      IdpRelayStateParameterName: studio.IdpRelayStateParameterName,
      Tags: getTags(ctx, studioId),
    },
  };
};

const GetAutoTerminationPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const policy = ctx.store.get<Record<string, unknown>>(
    autoTerminationKey(clusterId),
  );
  return { AutoTerminationPolicy: policy ?? {} };
};

const GetBlockPublicAccessConfiguration: OperationHandler = (_input, ctx) => {
  const config = ctx.store.get<Record<string, unknown>>(
    BLOCK_PUBLIC_ACCESS_KEY,
  );
  return {
    BlockPublicAccessConfiguration: config ?? {
      BlockPublicSecurityGroupRules: false,
    },
    BlockPublicAccessConfigurationMetadata: {
      CreationDateTime: nowEpoch(),
      CreatedByArn: `arn:aws:iam::${ctx.account}:root`,
    },
  };
};

const GetClusterSessionCredentials: OperationHandler = (input, _ctx) => {
  requireString(input, "ClusterId");
  return {
    Credentials: {
      UsernamePassword: {
        Username: "hadoop",
        Password: crypto.randomUUID().replace(/-/g, ""),
      },
    },
    ExpiresAt: nowEpoch() + 3600,
  };
};

const GetManagedScalingPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const policy = ctx.store.get<Record<string, unknown>>(
    managedScalingKey(clusterId),
  );
  return { ManagedScalingPolicy: policy ?? {} };
};

const GetOnClusterAppUIPresignedURL: OperationHandler = (input, ctx) => {
  requireString(input, "ClusterId");
  return {
    PresignedURLReady: true,
    PresignedURL: `https://on-cluster-ui.${ctx.region}.amazonaws.com/presigned?token=${crypto.randomUUID()}`,
  };
};

const GetPersistentAppUIPresignedURL: OperationHandler = (input, ctx) => {
  requireString(input, "PersistentAppUIId");
  return {
    PresignedURLReady: true,
    PresignedURL: `https://persistent-ui.${ctx.region}.amazonaws.com/presigned?token=${crypto.randomUUID()}`,
  };
};

const GetStudioSessionMapping: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  requireStudio(ctx, studioId);
  const identityType = requireString(input, "IdentityType");
  const identityId = stringOrUndefined(input["IdentityId"]) ?? "";
  const identityName = stringOrUndefined(input["IdentityName"]) ?? "";
  const lookupKey = identityId !== "" ? identityId : identityName;
  const mapping = ctx.store.get<StoredSessionMapping>(
    mappingKey(studioId, identityType, lookupKey),
  );
  if (mapping === undefined) {
    throw awsError(
      "InvalidRequestException",
      `SessionMapping does not exist.`,
      400,
    );
  }
  return {
    SessionMapping: {
      StudioId: mapping.StudioId,
      IdentityId: mapping.IdentityId,
      IdentityName: mapping.IdentityName,
      IdentityType: mapping.IdentityType,
      SessionPolicyArn: mapping.SessionPolicyArn,
      CreationTime: mapping.CreationTime,
      LastModifiedTime: mapping.LastModifiedTime,
    },
  };
};

const ListBootstrapActions: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  return { BootstrapActions: [] };
};

const ListInstanceFleets: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const prefix = `fleet/${clusterId}/`;
  const fleets = ctx.store
    .list<StoredFleet>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      Id: e.value.Id,
      Name: e.value.Name,
      InstanceFleetType: e.value.InstanceFleetType,
      Status: { State: e.value.State, StateChangeReason: {}, Timeline: {} },
      TargetOnDemandCapacity: 0,
      TargetSpotCapacity: 0,
      ProvisionedOnDemandCapacity: 0,
      ProvisionedSpotCapacity: 0,
      InstanceTypeSpecifications: [],
    }));
  return { InstanceFleets: fleets };
};

const ListInstanceGroups: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const prefix = `group/${clusterId}/`;
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      Id: e.value.Id,
      Name: e.value.Name,
      Market: e.value.Market,
      InstanceGroupType: e.value.InstanceGroupType,
      InstanceType: e.value.InstanceType,
      RequestedInstanceCount: e.value.RequestedInstanceCount,
      RunningInstanceCount: e.value.RunningInstanceCount,
      Status: { State: e.value.State, StateChangeReason: {}, Timeline: {} },
      Configurations: [],
      EbsBlockDevices: [],
    }));
  return { InstanceGroups: groups };
};

const ListInstances: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  return { Instances: [] };
};

const ListNotebookExecutions: OperationHandler = (_input, ctx) => {
  const executions = ctx.store
    .list<StoredNotebookExecution>()
    .filter((e) => e.key.startsWith("notebook/"))
    .map((e) => ({
      NotebookExecutionId: e.value.NotebookExecutionId,
      EditorId: e.value.EditorId,
      NotebookExecutionName: e.value.NotebookExecutionName,
      Status: e.value.Status,
      StartTime: e.value.StartTime,
      EndTime: e.value.EndTime,
    }));
  return { NotebookExecutions: executions };
};

const ListReleaseLabels: OperationHandler = (_input, _ctx) => {
  return {
    ReleaseLabels: ["emr-7.0.0", "emr-6.15.0", "emr-6.14.0", "emr-6.9.0"],
  };
};

const ListSecurityConfigurations: OperationHandler = (_input, ctx) => {
  const configs = ctx.store
    .list<StoredSecurityConfig>()
    .filter((e) => e.key.startsWith("secconfig/"))
    .map((e) => ({
      Name: e.value.Name,
      CreationDateTime: e.value.CreationDateTime,
    }));
  return { SecurityConfigurations: configs };
};

const ListSteps: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, clusterId);
  const stepStates = stringList(input["StepStates"]);
  const stepIds = stringList(input["StepIds"]);
  const steps = cluster.Steps.filter(
    (s) => stepIds.length === 0 || stepIds.includes(s.Id),
  )
    .filter((s) => stepStates.length === 0 || stepStates.includes(s.State))
    .map((s) => ({
      Id: s.Id,
      Name: s.Name,
      Config: { Jar: s.Jar, Properties: {}, Args: [] },
      ActionOnFailure: s.ActionOnFailure,
      Status: {
        State: s.State,
        StateChangeReason: {},
        Timeline: {},
      },
    }));
  return { Steps: steps };
};

const ListStudioSessionMappings: OperationHandler = (input, ctx) => {
  const studioId = stringOrUndefined(input["StudioId"]);
  const identityType = stringOrUndefined(input["IdentityType"]);
  const mappings = ctx.store
    .list<StoredSessionMapping>()
    .filter((e) => e.key.startsWith("mapping/"))
    .map((e) => e.value)
    .filter((m) => studioId === undefined || m.StudioId === studioId)
    .filter(
      (m) => identityType === undefined || m.IdentityType === identityType,
    )
    .map((m) => ({
      StudioId: m.StudioId,
      IdentityId: m.IdentityId,
      IdentityName: m.IdentityName,
      IdentityType: m.IdentityType,
      SessionPolicyArn: m.SessionPolicyArn,
      CreationTime: m.CreationTime,
    }));
  return { SessionMappings: mappings };
};

const ListStudios: OperationHandler = (_input, ctx) => {
  const studios = ctx.store
    .list<StoredStudio>()
    .filter((e) => e.key.startsWith("studio/"))
    .map((e) => ({
      StudioId: e.value.StudioId,
      Name: e.value.Name,
      VpcId: e.value.VpcId,
      Description: e.value.Description,
      Url: e.value.Url,
      AuthMode: e.value.AuthMode,
      CreationTime: e.value.CreationTime,
    }));
  return { Studios: studios };
};

const ListSupportedInstanceTypes: OperationHandler = (_input, _ctx) => {
  return {
    SupportedInstanceTypes: [
      {
        Type: "m5.xlarge",
        MemoryGB: 16,
        StorageGB: 0,
        VCPU: 4,
        Is64BitsOnly: true,
        EbsOptimizedAvailable: true,
        EbsOptimizedByDefault: true,
        NumberOfDisks: 0,
        EbsStorageOnly: false,
        Architecture: "x86_64",
      },
    ],
  };
};

const ModifyCluster: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, clusterId);
  const stepConcurrencyLevel =
    typeof input["StepConcurrencyLevel"] === "number"
      ? input["StepConcurrencyLevel"]
      : cluster.StepConcurrencyLevel;
  ctx.store.set(clusterKey(clusterId), {
    ...cluster,
    StepConcurrencyLevel: stepConcurrencyLevel,
  });
  return { StepConcurrencyLevel: stepConcurrencyLevel };
};

const ModifyInstanceFleet: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const fleetInput =
    (input["InstanceFleet"] as Record<string, unknown> | undefined) ?? {};
  const fleetId =
    typeof fleetInput["InstanceFleetId"] === "string"
      ? fleetInput["InstanceFleetId"]
      : "";
  if (fleetId !== "") {
    const fleet = ctx.store.get<StoredFleet>(fleetKey(clusterId, fleetId));
    if (fleet !== undefined) {
      ctx.store.set(fleetKey(clusterId, fleetId), { ...fleet });
    }
  }
  return {};
};

const ModifyInstanceGroups: OperationHandler = (input, ctx) => {
  const clusterId = stringOrUndefined(input["ClusterId"]);
  if (clusterId !== undefined) {
    requireCluster(ctx, clusterId);
  }
  const groups = Array.isArray(input["InstanceGroups"])
    ? input["InstanceGroups"]
    : [];
  for (const grp of groups) {
    const g =
      typeof grp === "object" && grp !== null
        ? (grp as Record<string, unknown>)
        : {};
    const groupId =
      typeof g["InstanceGroupId"] === "string" ? g["InstanceGroupId"] : "";
    if (clusterId !== undefined && groupId !== "") {
      const existing = ctx.store.get<StoredGroup>(groupKey(clusterId, groupId));
      if (existing !== undefined) {
        const instanceCount =
          typeof g["InstanceCount"] === "number"
            ? g["InstanceCount"]
            : existing.RequestedInstanceCount;
        ctx.store.set(groupKey(clusterId, groupId), {
          ...existing,
          RequestedInstanceCount: instanceCount,
        });
      }
    }
  }
  return {};
};

const PutAutoScalingPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const instanceGroupId = requireString(input, "InstanceGroupId");
  const cluster = requireCluster(ctx, clusterId);
  const policy = input["AutoScalingPolicy"] ?? {};
  ctx.store.set(autoScalingKey(clusterId, instanceGroupId), policy);
  return {
    ClusterId: clusterId,
    InstanceGroupId: instanceGroupId,
    AutoScalingPolicy: {
      Status: { State: "ATTACHED", StateChangeReason: {} },
      Constraints: {},
      Rules: [],
    },
    ClusterArn: cluster.ClusterArn,
  };
};

const PutAutoTerminationPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const policy = input["AutoTerminationPolicy"] ?? {};
  ctx.store.set(autoTerminationKey(clusterId), policy);
  return {};
};

const PutBlockPublicAccessConfiguration: OperationHandler = (input, ctx) => {
  const config = input["BlockPublicAccessConfiguration"] ?? {
    BlockPublicSecurityGroupRules: false,
  };
  ctx.store.set(BLOCK_PUBLIC_ACCESS_KEY, config);
  return {};
};

const PutManagedScalingPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  const policy = input["ManagedScalingPolicy"] ?? {};
  ctx.store.set(managedScalingKey(clusterId), policy);
  return {};
};

const RemoveAutoScalingPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  const instanceGroupId = requireString(input, "InstanceGroupId");
  requireCluster(ctx, clusterId);
  ctx.store.delete(autoScalingKey(clusterId, instanceGroupId));
  return {};
};

const RemoveAutoTerminationPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  ctx.store.delete(autoTerminationKey(clusterId));
  return {};
};

const RemoveManagedScalingPolicy: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterId");
  requireCluster(ctx, clusterId);
  ctx.store.delete(managedScalingKey(clusterId));
  return {};
};

const RemoveTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tagKeys = stringList(input["TagKeys"]);
  const existing = getTags(ctx, resourceId);
  setTags(
    ctx,
    resourceId,
    existing.filter((t) => !tagKeys.includes(t.Key)),
  );
  return {};
};

const SetKeepJobFlowAliveWhenNoSteps: OperationHandler = (input, ctx) => {
  const ids = stringList(input["JobFlowIds"]);
  const keep = boolOrDefault(input["KeepJobFlowAliveWhenNoSteps"], false);
  for (const id of ids) {
    const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
    if (cluster !== undefined) {
      ctx.store.set(clusterKey(id), {
        ...cluster,
        KeepJobFlowAliveWhenNoSteps: keep,
      });
    }
  }
  return {};
};

const SetTerminationProtection: OperationHandler = (input, ctx) => {
  const ids = stringList(input["JobFlowIds"]);
  const protect = boolOrDefault(input["TerminationProtected"], false);
  for (const id of ids) {
    const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
    if (cluster !== undefined) {
      ctx.store.set(clusterKey(id), {
        ...cluster,
        TerminationProtected: protect,
      });
    }
  }
  return {};
};

const SetUnhealthyNodeReplacement: OperationHandler = (input, ctx) => {
  const ids = stringList(input["JobFlowIds"]);
  const replace = boolOrDefault(input["UnhealthyNodeReplacement"], false);
  for (const id of ids) {
    const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
    if (cluster !== undefined) {
      ctx.store.set(clusterKey(id), {
        ...cluster,
        UnhealthyNodeReplacement: replace,
      });
    }
  }
  return {};
};

const SetVisibleToAllUsers: OperationHandler = (input, ctx) => {
  const ids = stringList(input["JobFlowIds"]);
  const visible = boolOrDefault(input["VisibleToAllUsers"], true);
  for (const id of ids) {
    const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
    if (cluster !== undefined) {
      ctx.store.set(clusterKey(id), {
        ...cluster,
        VisibleToAllUsers: visible,
      });
    }
  }
  return {};
};

const StartNotebookExecution: OperationHandler = (input, ctx) => {
  const id = newNotebookId();
  const engine =
    (input["ExecutionEngine"] as Record<string, unknown> | undefined) ?? {};
  const nb: StoredNotebookExecution = {
    NotebookExecutionId: id,
    EditorId: stringOrUndefined(input["EditorId"]),
    NotebookExecutionName: stringOrUndefined(input["NotebookExecutionName"]),
    NotebookParams: stringOrUndefined(input["NotebookParams"]),
    Status: "RUNNING",
    StartTime: nowEpoch(),
    EndTime: undefined,
    ExecutionEngineId:
      typeof engine["Id"] === "string" ? engine["Id"] : undefined,
  };
  ctx.store.set(notebookKey(id), nb);
  return { NotebookExecutionId: id };
};

const StopNotebookExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "NotebookExecutionId");
  const nb = requireNotebook(ctx, id);
  ctx.store.set(notebookKey(id), {
    ...nb,
    Status: "STOPPING",
    EndTime: nowEpoch(),
  });
  return {};
};

const UpdateStudio: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  const studio = requireStudio(ctx, studioId);
  const updated: StoredStudio = {
    ...studio,
    Name:
      typeof input["Name"] === "string" && input["Name"] !== ""
        ? input["Name"]
        : studio.Name,
    Description:
      typeof input["Description"] === "string"
        ? input["Description"]
        : studio.Description,
    SubnetIds: Array.isArray(input["SubnetIds"])
      ? stringList(input["SubnetIds"])
      : studio.SubnetIds,
    DefaultS3Location:
      typeof input["DefaultS3Location"] === "string"
        ? input["DefaultS3Location"]
        : studio.DefaultS3Location,
    EncryptionKeyArn:
      typeof input["EncryptionKeyArn"] === "string"
        ? input["EncryptionKeyArn"]
        : studio.EncryptionKeyArn,
  };
  ctx.store.set(studioKey(studioId), updated);
  return {};
};

const UpdateStudioSessionMapping: OperationHandler = (input, ctx) => {
  const studioId = requireString(input, "StudioId");
  requireStudio(ctx, studioId);
  const identityType = requireString(input, "IdentityType");
  const identityId = stringOrUndefined(input["IdentityId"]) ?? "";
  const identityName = stringOrUndefined(input["IdentityName"]) ?? "";
  const lookupKey = identityId !== "" ? identityId : identityName;
  const existing = ctx.store.get<StoredSessionMapping>(
    mappingKey(studioId, identityType, lookupKey),
  );
  if (existing === undefined) {
    throw awsError(
      "InvalidRequestException",
      `SessionMapping does not exist.`,
      400,
    );
  }
  const sessionPolicyArn =
    stringOrUndefined(input["SessionPolicyArn"]) ?? existing.SessionPolicyArn;
  ctx.store.set(mappingKey(studioId, identityType, lookupKey), {
    ...existing,
    SessionPolicyArn: sessionPolicyArn,
    LastModifiedTime: nowEpoch(),
  });
  return {};
};

const emr = {
  name: "elasticmapreduce",
  protocol: "json",
  operations: {
    RunJobFlow,
    ListClusters,
    DescribeCluster,
    AddJobFlowSteps,
    TerminateJobFlows,
    AddInstanceFleet,
    AddInstanceGroups,
    AddTags,
    CancelSteps,
    CreatePersistentAppUI,
    CreateSecurityConfiguration,
    CreateStudio,
    CreateStudioSessionMapping,
    DeleteSecurityConfiguration,
    DeleteStudio,
    DeleteStudioSessionMapping,
    DescribeJobFlows,
    DescribeNotebookExecution,
    DescribePersistentAppUI,
    DescribeReleaseLabel,
    DescribeSecurityConfiguration,
    DescribeStep,
    DescribeStudio,
    GetAutoTerminationPolicy,
    GetBlockPublicAccessConfiguration,
    GetClusterSessionCredentials,
    GetManagedScalingPolicy,
    GetOnClusterAppUIPresignedURL,
    GetPersistentAppUIPresignedURL,
    GetStudioSessionMapping,
    ListBootstrapActions,
    ListInstanceFleets,
    ListInstanceGroups,
    ListInstances,
    ListNotebookExecutions,
    ListReleaseLabels,
    ListSecurityConfigurations,
    ListSteps,
    ListStudioSessionMappings,
    ListStudios,
    ListSupportedInstanceTypes,
    ModifyCluster,
    ModifyInstanceFleet,
    ModifyInstanceGroups,
    PutAutoScalingPolicy,
    PutAutoTerminationPolicy,
    PutBlockPublicAccessConfiguration,
    PutManagedScalingPolicy,
    RemoveAutoScalingPolicy,
    RemoveAutoTerminationPolicy,
    RemoveManagedScalingPolicy,
    RemoveTags,
    SetKeepJobFlowAliveWhenNoSteps,
    SetTerminationProtection,
    SetUnhealthyNodeReplacement,
    SetVisibleToAllUsers,
    StartNotebookExecution,
    StopNotebookExecution,
    UpdateStudio,
    UpdateStudioSessionMapping,
  },
  model,
} as const satisfies ServiceDefinition;

export default emr;
