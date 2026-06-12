import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/autoscaling.json", { with: { type: "json" } }),
);

type StoredLaunchConfiguration = {
  LaunchConfigurationName: string;
  LaunchConfigurationARN: string;
  ImageId: string;
  InstanceType: string;
  KeyName: string | undefined;
  SecurityGroups: string[];
  UserData: string | undefined;
  CreatedTime: string;
  AssociatePublicIpAddress: boolean | undefined;
  IamInstanceProfile: string | undefined;
  EbsOptimized: boolean;
};

type StoredTag = {
  ResourceId: string;
  ResourceType: string;
  Key: string;
  Value: string;
  PropagateAtLaunch: boolean;
};

type StoredScalingPolicy = {
  PolicyARN: string;
  PolicyName: string;
  AutoScalingGroupName: string;
  PolicyType: string;
  AdjustmentType: string | undefined;
  ScalingAdjustment: number | undefined;
  Cooldown: number | undefined;
  MinAdjustmentMagnitude: number | undefined;
  EstimatedInstanceWarmup: number | undefined;
  TargetTrackingConfiguration: unknown;
  StepAdjustments: unknown[];
  MetricAggregationType: string | undefined;
  Enabled: boolean;
};

type StoredInstance = {
  InstanceId: string;
  AutoScalingGroupName: string;
  AvailabilityZone: string;
  LifecycleState: string;
  HealthStatus: string;
  LaunchConfigurationName: string | undefined;
  ProtectedFromScaleIn: boolean;
};

type StoredAutoScalingGroup = {
  AutoScalingGroupName: string;
  AutoScalingGroupARN: string;
  LaunchConfigurationName: string | undefined;
  LaunchTemplate:
    | {
        LaunchTemplateId?: string;
        LaunchTemplateName?: string;
        Version?: string;
      }
    | undefined;
  MixedInstancesPolicy: Record<string, unknown> | undefined;
  InstanceId: string | undefined;
  MinSize: number;
  MaxSize: number;
  DesiredCapacity: number;
  DefaultCooldown: number;
  AvailabilityZones: string[];
  HealthCheckType: string;
  HealthCheckGracePeriod: number;
  VPCZoneIdentifier: string | undefined;
  TerminationPolicies: string[];
  NewInstancesProtectedFromScaleIn: boolean;
  CreatedTime: string;
  Tags: StoredTag[];
  InstanceIds: string[];
  SuspendedProcesses: string[];
  LoadBalancerNames: string[];
  TargetGroupARNs: string[];
  TrafficSources: { Identifier: string; Type: string }[];
  EnabledMetrics: string[];
};

type StoredScheduledAction = {
  ScheduledActionName: string;
  ScheduledActionARN: string;
  AutoScalingGroupName: string;
  StartTime: string | undefined;
  EndTime: string | undefined;
  Recurrence: string | undefined;
  TimeZone: string | undefined;
  MinSize: number | undefined;
  MaxSize: number | undefined;
  DesiredCapacity: number | undefined;
};

type StoredLifecycleHook = {
  LifecycleHookName: string;
  AutoScalingGroupName: string;
  LifecycleTransition: string;
  RoleARN: string | undefined;
  NotificationTargetARN: string | undefined;
  NotificationMetadata: string | undefined;
  HeartbeatTimeout: number;
  DefaultResult: string;
  GlobalTimeout: number;
};

type StoredInstanceRefresh = {
  InstanceRefreshId: string;
  AutoScalingGroupName: string;
  Status: string;
  StartTime: string;
  EndTime: string | undefined;
  PercentageComplete: number;
  InstancesToUpdate: number;
};

type StoredWarmPool = {
  AutoScalingGroupName: string;
  MaxGroupPreparedCapacity: number | undefined;
  MinSize: number;
  PoolState: string;
};

type StoredNotification = {
  AutoScalingGroupName: string;
  TopicARN: string;
  NotificationType: string;
};

type StoredScalingActivity = {
  ActivityId: string;
  AutoScalingGroupName: string;
  Description: string;
  Cause: string;
  StartTime: string;
  EndTime: string | undefined;
  StatusCode: string;
  Progress: number;
};

const lcKey = (name: string): string => `lc/${name}`;
const asgKey = (name: string): string => `asg/${name}`;
const instanceKey = (id: string): string => `instance/${id}`;
const policyKey = (asgName: string, policyName: string): string =>
  `policy/${asgName}/${policyName}`;
const tagKey = (resourceId: string, key: string): string =>
  `tag/${resourceId}/${key}`;
const scheduledActionKey = (asgName: string, actionName: string): string =>
  `scheduled/${asgName}/${actionName}`;
const lifecycleHookKey = (asgName: string, hookName: string): string =>
  `hook/${asgName}/${hookName}`;
const instanceRefreshKey = (refreshId: string): string =>
  `refresh/${refreshId}`;
const warmPoolKey = (asgName: string): string => `warmpool/${asgName}`;
const notificationKey = (
  asgName: string,
  topicArn: string,
  type: string,
): string => `notification/${asgName}/${topicArn}/${type}`;
const activityKey = (activityId: string): string => `activity/${activityId}`;

let instanceCounter = 0;
let activityCounter = 0;
let refreshCounter = 0;
let scheduledActionCounter = 0;

const nextInstanceId = (): string => {
  instanceCounter += 1;
  return `i-${String(instanceCounter).padStart(17, "0")}`;
};

const nextActivityId = (): string => {
  activityCounter += 1;
  return `activity-${String(activityCounter).padStart(8, "0")}`;
};

const nextRefreshId = (): string => {
  refreshCounter += 1;
  return `refresh-${String(refreshCounter).padStart(8, "0")}`;
};

const nextScheduledActionArn = (
  region: string,
  account: string,
  asgName: string,
  actionName: string,
): string => {
  scheduledActionCounter += 1;
  return `arn:aws:autoscaling:${region}:${account}:scheduledUpdateGroupAction:${String(scheduledActionCounter).padStart(8, "0")}:autoScalingGroupName/${asgName}:scheduledActionName/${actionName}`;
};

const lcArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:autoscaling:${region}:${account}:launchConfiguration:00000000-0000-0000-0000-000000000000:launchConfigurationName/${name}`;

const asgArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:autoscaling:${region}:${account}:autoScalingGroup:00000000-0000-0000-0000-000000000000:autoScalingGroupName/${name}`;

const policyArnOf = (
  region: string,
  account: string,
  asgName: string,
  policyName: string,
): string =>
  `arn:aws:autoscaling:${region}:${account}:scalingPolicy:00000000-0000-0000-0000-000000000000:autoScalingGroupName/${asgName}:policyName/${policyName}`;

const recordActivity = (
  ctx: ServiceContext,
  asgName: string,
  description: string,
  cause: string,
): StoredScalingActivity => {
  const activity: StoredScalingActivity = {
    ActivityId: nextActivityId(),
    AutoScalingGroupName: asgName,
    Description: description,
    Cause: cause,
    StartTime: new Date().toISOString(),
    EndTime: new Date().toISOString(),
    StatusCode: "Successful",
    Progress: 100,
  };
  ctx.store.set(activityKey(activity.ActivityId), activity);
  return activity;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationError", `${key} is required.`, 400);
  }
  return value;
};

const requireNumber = (input: Record<string, unknown>, key: string): number => {
  const value = input[key];
  if (typeof value !== "number") {
    throw awsError("ValidationError", `${key} is required.`, 400);
  }
  return value;
};

const requireLc = (
  ctx: ServiceContext,
  name: string,
): StoredLaunchConfiguration => {
  const lc = ctx.store.get<StoredLaunchConfiguration>(lcKey(name));
  if (lc === undefined) {
    throw awsError(
      "ValidationError",
      `No launch configuration found with name ${name}.`,
      400,
    );
  }
  return lc;
};

const requireAsg = (
  ctx: ServiceContext,
  name: string,
): StoredAutoScalingGroup => {
  const asg = ctx.store.get<StoredAutoScalingGroup>(asgKey(name));
  if (asg === undefined) {
    throw awsError("ValidationError", `Group ${name} not found.`, 400);
  }
  return asg;
};

const syncInstances = (
  ctx: ServiceContext,
  asg: StoredAutoScalingGroup,
): void => {
  const activeIds = asg.InstanceIds.filter((id) => {
    const inst = ctx.store.get<StoredInstance>(instanceKey(id));
    return inst !== undefined && inst.LifecycleState !== "Standby";
  });

  const standbyIds = asg.InstanceIds.filter((id) => {
    const inst = ctx.store.get<StoredInstance>(instanceKey(id));
    return inst !== undefined && inst.LifecycleState === "Standby";
  });

  const current = activeIds.length;
  const desired = asg.DesiredCapacity;
  const az =
    asg.AvailabilityZones.length > 0
      ? (asg.AvailabilityZones[0] ?? "us-east-1a")
      : "us-east-1a";

  if (current < desired) {
    for (let i = current; i < desired; i++) {
      const id = nextInstanceId();
      const instance: StoredInstance = {
        InstanceId: id,
        AutoScalingGroupName: asg.AutoScalingGroupName,
        AvailabilityZone: az,
        LifecycleState: "InService",
        HealthStatus: "Healthy",
        LaunchConfigurationName: asg.LaunchConfigurationName,
        ProtectedFromScaleIn: asg.NewInstancesProtectedFromScaleIn,
      };
      ctx.store.set(instanceKey(id), instance);
      activeIds.push(id);
    }
  } else if (current > desired) {
    const toRemove = activeIds.splice(desired);
    for (const id of toRemove) {
      ctx.store.delete(instanceKey(id));
    }
  }

  asg.InstanceIds = [...activeIds, ...standbyIds];
  ctx.store.set(asgKey(asg.AutoScalingGroupName), asg);
};

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") {
    return 0;
  }
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const asgToOutput = (
  asg: StoredAutoScalingGroup,
  instances: StoredInstance[],
): Record<string, unknown> => ({
  AutoScalingGroupName: asg.AutoScalingGroupName,
  AutoScalingGroupARN: asg.AutoScalingGroupARN,
  LaunchConfigurationName: asg.LaunchConfigurationName,
  LaunchTemplate: asg.LaunchTemplate,
  MixedInstancesPolicy: asg.MixedInstancesPolicy,
  MinSize: asg.MinSize,
  MaxSize: asg.MaxSize,
  DesiredCapacity: asg.DesiredCapacity,
  DefaultCooldown: asg.DefaultCooldown,
  AvailabilityZones: asg.AvailabilityZones,
  HealthCheckType: asg.HealthCheckType,
  HealthCheckGracePeriod: asg.HealthCheckGracePeriod,
  VPCZoneIdentifier: asg.VPCZoneIdentifier,
  TerminationPolicies: asg.TerminationPolicies,
  NewInstancesProtectedFromScaleIn: asg.NewInstancesProtectedFromScaleIn,
  CreatedTime: asg.CreatedTime,
  Tags: asg.Tags,
  SuspendedProcesses: asg.SuspendedProcesses.map((p) => ({
    ProcessName: p,
    SuspensionReason: "User suspended",
  })),
  LoadBalancerNames: asg.LoadBalancerNames,
  TargetGroupARNs: asg.TargetGroupARNs,
  TrafficSources: asg.TrafficSources,
  EnabledMetrics: asg.EnabledMetrics.map((m) => ({ Metric: m })),
  Instances: instances.map((inst) => ({
    InstanceId: inst.InstanceId,
    AvailabilityZone: inst.AvailabilityZone,
    LifecycleState: inst.LifecycleState,
    HealthStatus: inst.HealthStatus,
    LaunchConfigurationName: inst.LaunchConfigurationName,
    ProtectedFromScaleIn: inst.ProtectedFromScaleIn,
  })),
});

const CreateLaunchConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "LaunchConfigurationName");
  if (ctx.store.get(lcKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsFault",
      `Launch configuration named ${name} already exists.`,
      400,
    );
  }
  const lc: StoredLaunchConfiguration = {
    LaunchConfigurationName: name,
    LaunchConfigurationARN: lcArnOf(ctx.region, ctx.account, name),
    ImageId: typeof input["ImageId"] === "string" ? input["ImageId"] : "",
    InstanceType:
      typeof input["InstanceType"] === "string" ? input["InstanceType"] : "",
    KeyName:
      typeof input["KeyName"] === "string" ? input["KeyName"] : undefined,
    SecurityGroups: Array.isArray(input["SecurityGroups"])
      ? (input["SecurityGroups"] as string[])
      : [],
    UserData:
      typeof input["UserData"] === "string" ? input["UserData"] : undefined,
    CreatedTime: new Date().toISOString(),
    AssociatePublicIpAddress:
      typeof input["AssociatePublicIpAddress"] === "boolean"
        ? input["AssociatePublicIpAddress"]
        : undefined,
    IamInstanceProfile:
      typeof input["IamInstanceProfile"] === "string"
        ? input["IamInstanceProfile"]
        : undefined,
    EbsOptimized:
      typeof input["EbsOptimized"] === "boolean"
        ? input["EbsOptimized"]
        : false,
  };
  ctx.store.set(lcKey(name), lc);
  return {};
};

const DescribeLaunchConfigurations: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["LaunchConfigurationNames"])
    ? (input["LaunchConfigurationNames"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 100;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredLaunchConfiguration>()
    .filter((e) => e.key.startsWith("lc/"))
    .map((e) => e.value);

  if (names.length > 0) {
    const nameSet = new Set(names);
    all = all.filter((lc) => nameSet.has(lc.LaunchConfigurationName));
  }

  const page = all.slice(offset, offset + maxRecords);
  const next = offset + maxRecords;
  const result: Record<string, unknown> = {
    LaunchConfigurations: page.map((lc) => ({
      LaunchConfigurationName: lc.LaunchConfigurationName,
      LaunchConfigurationARN: lc.LaunchConfigurationARN,
      ImageId: lc.ImageId,
      InstanceType: lc.InstanceType,
      KeyName: lc.KeyName,
      SecurityGroups: lc.SecurityGroups,
      UserData: lc.UserData,
      CreatedTime: lc.CreatedTime,
      AssociatePublicIpAddress: lc.AssociatePublicIpAddress,
      IamInstanceProfile: lc.IamInstanceProfile,
      EbsOptimized: lc.EbsOptimized,
    })),
  };
  if (next < all.length) {
    result["NextToken"] = encodePageToken(next);
  }
  return result;
};

const DeleteLaunchConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "LaunchConfigurationName");
  const lc = ctx.store.get<StoredLaunchConfiguration>(lcKey(name));
  if (lc === undefined) {
    throw awsError(
      "ValidationError",
      `Launch configuration '${name}' does not exist.`,
      400,
    );
  }
  const inUse = ctx.store
    .list<StoredAutoScalingGroup>()
    .filter((e) => e.key.startsWith("asg/"))
    .some((e) => e.value.LaunchConfigurationName === name);
  if (inUse) {
    throw awsError(
      "ResourceInUseFault",
      `Launch configuration ${name} is currently in use.`,
      400,
    );
  }
  ctx.store.delete(lcKey(name));
  return {};
};

const CreateAutoScalingGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoScalingGroupName");
  if (ctx.store.get(asgKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsFault",
      `Auto Scaling group named ${name} already exists.`,
      400,
    );
  }
  const lcName =
    typeof input["LaunchConfigurationName"] === "string"
      ? input["LaunchConfigurationName"]
      : undefined;
  if (lcName !== undefined) {
    requireLc(ctx, lcName);
  }

  const launchTemplate =
    typeof input["LaunchTemplate"] === "object" &&
    input["LaunchTemplate"] !== null
      ? (input["LaunchTemplate"] as {
          LaunchTemplateId?: string;
          LaunchTemplateName?: string;
          Version?: string;
        })
      : undefined;
  const mixedInstancesPolicy =
    typeof input["MixedInstancesPolicy"] === "object" &&
    input["MixedInstancesPolicy"] !== null
      ? (input["MixedInstancesPolicy"] as Record<string, unknown>)
      : undefined;
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : undefined;

  if (
    lcName === undefined &&
    launchTemplate === undefined &&
    mixedInstancesPolicy === undefined &&
    instanceId === undefined
  ) {
    throw awsError(
      "ValidationError",
      "Either LaunchConfigurationName, LaunchTemplate, MixedInstancesPolicy, or InstanceId must be provided.",
      400,
    );
  }

  const minSize = requireNumber(input, "MinSize");
  const maxSize = requireNumber(input, "MaxSize");

  if (minSize > maxSize) {
    throw awsError(
      "ValidationError",
      `MinSize ${minSize} must be less than or equal to MaxSize ${maxSize}.`,
      400,
    );
  }

  const desiredCapacity =
    typeof input["DesiredCapacity"] === "number"
      ? input["DesiredCapacity"]
      : minSize;

  if (desiredCapacity < minSize || desiredCapacity > maxSize) {
    throw awsError(
      "ValidationError",
      `DesiredCapacity ${desiredCapacity} is outside of the group limits [${minSize}, ${maxSize}].`,
      400,
    );
  }

  const rawTags = input["Tags"];
  const tags: StoredTag[] = [];
  if (Array.isArray(rawTags)) {
    for (const t of rawTags) {
      if (typeof t === "object" && t !== null) {
        const tag = t as Record<string, unknown>;
        if (typeof tag["Key"] === "string") {
          tags.push({
            ResourceId: name,
            ResourceType: "auto-scaling-group",
            Key: tag["Key"],
            Value: typeof tag["Value"] === "string" ? tag["Value"] : "",
            PropagateAtLaunch:
              typeof tag["PropagateAtLaunch"] === "boolean"
                ? tag["PropagateAtLaunch"]
                : false,
          });
        }
      }
    }
  }

  const azRaw = input["AvailabilityZones"];
  const availabilityZones: string[] = Array.isArray(azRaw)
    ? (azRaw as string[])
    : [`${ctx.region}a`];

  const asg: StoredAutoScalingGroup = {
    AutoScalingGroupName: name,
    AutoScalingGroupARN: asgArnOf(ctx.region, ctx.account, name),
    LaunchConfigurationName: lcName,
    LaunchTemplate: launchTemplate,
    MixedInstancesPolicy: mixedInstancesPolicy,
    InstanceId: instanceId,
    MinSize: minSize,
    MaxSize: maxSize,
    DesiredCapacity: desiredCapacity,
    DefaultCooldown:
      typeof input["DefaultCooldown"] === "number"
        ? input["DefaultCooldown"]
        : 300,
    AvailabilityZones: availabilityZones,
    HealthCheckType:
      typeof input["HealthCheckType"] === "string"
        ? input["HealthCheckType"]
        : "EC2",
    HealthCheckGracePeriod:
      typeof input["HealthCheckGracePeriod"] === "number"
        ? input["HealthCheckGracePeriod"]
        : 0,
    VPCZoneIdentifier:
      typeof input["VPCZoneIdentifier"] === "string"
        ? input["VPCZoneIdentifier"]
        : undefined,
    TerminationPolicies: Array.isArray(input["TerminationPolicies"])
      ? (input["TerminationPolicies"] as string[])
      : ["Default"],
    NewInstancesProtectedFromScaleIn:
      typeof input["NewInstancesProtectedFromScaleIn"] === "boolean"
        ? input["NewInstancesProtectedFromScaleIn"]
        : false,
    CreatedTime: new Date().toISOString(),
    Tags: tags,
    InstanceIds: [],
    SuspendedProcesses: [],
    LoadBalancerNames: [],
    TargetGroupARNs: [],
    TrafficSources: [],
    EnabledMetrics: [],
  };

  for (const tag of tags) {
    ctx.store.set(tagKey(name, tag.Key), tag);
  }

  ctx.store.set(asgKey(name), asg);
  syncInstances(ctx, asg);
  return {};
};

const DescribeAutoScalingGroups: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["AutoScalingGroupNames"])
    ? (input["AutoScalingGroupNames"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as Record<string, unknown>[])
    : [];

  let all = ctx.store
    .list<StoredAutoScalingGroup>()
    .filter((e) => e.key.startsWith("asg/"))
    .map((e) => e.value);

  if (names.length > 0) {
    const nameSet = new Set(names);
    all = all.filter((asg) => nameSet.has(asg.AutoScalingGroupName));
  }

  for (const filter of filters) {
    const filterName = typeof filter["Name"] === "string" ? filter["Name"] : "";
    const filterValues = Array.isArray(filter["Values"])
      ? (filter["Values"] as string[])
      : [];
    if (filterValues.length === 0) continue;
    const valueSet = new Set(filterValues);
    if (filterName === "tag-key") {
      all = all.filter((asg) => asg.Tags.some((t) => valueSet.has(t.Key)));
    } else if (filterName === "tag-value") {
      all = all.filter((asg) => asg.Tags.some((t) => valueSet.has(t.Value)));
    } else if (filterName.startsWith("tag:")) {
      const tagKey = filterName.slice(4);
      all = all.filter((asg) =>
        asg.Tags.some((t) => t.Key === tagKey && valueSet.has(t.Value)),
      );
    }
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    AutoScalingGroups: page.map((asg) => {
      const instances = asg.InstanceIds.map(
        (id) =>
          ctx.store.get<StoredInstance>(instanceKey(id)) ?? {
            InstanceId: id,
            AutoScalingGroupName: asg.AutoScalingGroupName,
            AvailabilityZone: asg.AvailabilityZones[0] ?? "us-east-1a",
            LifecycleState: "InService",
            HealthStatus: "Healthy",
            LaunchConfigurationName: asg.LaunchConfigurationName,
            ProtectedFromScaleIn: false,
          },
      );
      return asgToOutput(asg, instances);
    }),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const UpdateAutoScalingGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, name);

  if (typeof input["LaunchConfigurationName"] === "string") {
    requireLc(ctx, input["LaunchConfigurationName"]);
    asg.LaunchConfigurationName = input["LaunchConfigurationName"];
  }
  if (
    typeof input["LaunchTemplate"] === "object" &&
    input["LaunchTemplate"] !== null
  ) {
    asg.LaunchTemplate = input["LaunchTemplate"] as {
      LaunchTemplateId?: string;
      LaunchTemplateName?: string;
      Version?: string;
    };
  }
  if (
    typeof input["MixedInstancesPolicy"] === "object" &&
    input["MixedInstancesPolicy"] !== null
  ) {
    asg.MixedInstancesPolicy = input["MixedInstancesPolicy"] as Record<
      string,
      unknown
    >;
  }
  if (typeof input["MinSize"] === "number") asg.MinSize = input["MinSize"];
  if (typeof input["MaxSize"] === "number") asg.MaxSize = input["MaxSize"];

  if (asg.MinSize > asg.MaxSize) {
    throw awsError(
      "ValidationError",
      `MinSize ${asg.MinSize} must be less than or equal to MaxSize ${asg.MaxSize}.`,
      400,
    );
  }

  if (typeof input["DesiredCapacity"] === "number") {
    const desired = input["DesiredCapacity"];
    if (desired < asg.MinSize || desired > asg.MaxSize) {
      throw awsError(
        "ValidationError",
        `New DesiredCapacity value ${desired} is outside of the group limits [${asg.MinSize}, ${asg.MaxSize}].`,
        400,
      );
    }
    asg.DesiredCapacity = desired;
  } else {
    asg.DesiredCapacity = Math.min(
      asg.MaxSize,
      Math.max(asg.MinSize, asg.DesiredCapacity),
    );
  }

  if (typeof input["DefaultCooldown"] === "number") {
    asg.DefaultCooldown = input["DefaultCooldown"];
  }
  if (typeof input["HealthCheckType"] === "string") {
    asg.HealthCheckType = input["HealthCheckType"];
  }
  if (typeof input["HealthCheckGracePeriod"] === "number") {
    asg.HealthCheckGracePeriod = input["HealthCheckGracePeriod"];
  }
  if (typeof input["VPCZoneIdentifier"] === "string") {
    asg.VPCZoneIdentifier = input["VPCZoneIdentifier"];
  }
  if (Array.isArray(input["TerminationPolicies"])) {
    asg.TerminationPolicies = input["TerminationPolicies"] as string[];
  }
  if (typeof input["NewInstancesProtectedFromScaleIn"] === "boolean") {
    asg.NewInstancesProtectedFromScaleIn =
      input["NewInstancesProtectedFromScaleIn"];
  }
  if (Array.isArray(input["AvailabilityZones"])) {
    asg.AvailabilityZones = input["AvailabilityZones"] as string[];
  }

  ctx.store.set(asgKey(name), asg);
  syncInstances(ctx, asg);
  return {};
};

const DeleteAutoScalingGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoScalingGroupName");
  const asg = ctx.store.get<StoredAutoScalingGroup>(asgKey(name));
  if (asg === undefined) {
    throw awsError(
      "ValidationError",
      `Auto Scaling group '${name}' does not exist.`,
      400,
    );
  }
  const forceDelete =
    typeof input["ForceDelete"] === "boolean" ? input["ForceDelete"] : false;

  if (!forceDelete && asg.InstanceIds.length > 0) {
    throw awsError(
      "ResourceInUseFault",
      `Auto Scaling group '${name}' cannot be deleted because it still contains instances.`,
      400,
    );
  }

  for (const id of asg.InstanceIds) {
    ctx.store.delete(instanceKey(id));
  }
  ctx.store.delete(asgKey(name));

  for (const entry of ctx.store.list<StoredScalingPolicy>()) {
    if (
      entry.key.startsWith(`policy/${name}/`) &&
      entry.value.AutoScalingGroupName === name
    ) {
      ctx.store.delete(entry.key);
    }
  }

  for (const entry of ctx.store.list<StoredTag>()) {
    if (entry.key.startsWith(`tag/${name}/`)) {
      ctx.store.delete(entry.key);
    }
  }

  return {};
};

const SetDesiredCapacity: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoScalingGroupName");
  const desired = requireNumber(input, "DesiredCapacity");
  const asg = requireAsg(ctx, name);

  if (desired < asg.MinSize || desired > asg.MaxSize) {
    throw awsError(
      "ValidationError",
      `New DesiredCapacity value ${desired} is outside of the group limits [${asg.MinSize}, ${asg.MaxSize}].`,
      400,
    );
  }

  asg.DesiredCapacity = desired;
  ctx.store.set(asgKey(name), asg);
  syncInstances(ctx, asg);
  return {};
};

const DescribeAutoScalingInstances: OperationHandler = (input, ctx) => {
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredInstance>()
    .filter((e) => e.key.startsWith("instance/"))
    .map((e) => e.value);

  if (instanceIds.length > 0) {
    const idSet = new Set(instanceIds);
    all = all.filter((inst) => idSet.has(inst.InstanceId));
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    AutoScalingInstances: page.map((inst) => ({
      InstanceId: inst.InstanceId,
      AutoScalingGroupName: inst.AutoScalingGroupName,
      AvailabilityZone: inst.AvailabilityZone,
      LifecycleState: inst.LifecycleState,
      HealthStatus: inst.HealthStatus,
      LaunchConfigurationName: inst.LaunchConfigurationName,
      ProtectedFromScaleIn: inst.ProtectedFromScaleIn,
    })),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const TerminateInstanceInAutoScalingGroup: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  if (typeof input["ShouldDecrementDesiredCapacity"] !== "boolean") {
    throw awsError(
      "ValidationError",
      "ShouldDecrementDesiredCapacity is required.",
      400,
    );
  }
  const shouldDecrement = input["ShouldDecrementDesiredCapacity"];

  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError("ValidationError", `Instance ${instanceId} not found.`, 400);
  }

  const asg = requireAsg(ctx, instance.AutoScalingGroupName);

  if (shouldDecrement && asg.DesiredCapacity - 1 < asg.MinSize) {
    throw awsError(
      "ValidationError",
      `Cannot decrement DesiredCapacity below MinSize ${asg.MinSize}.`,
      400,
    );
  }

  const idx = asg.InstanceIds.indexOf(instanceId);
  if (idx !== -1) {
    asg.InstanceIds.splice(idx, 1);
  }
  ctx.store.delete(instanceKey(instanceId));

  if (shouldDecrement) {
    asg.DesiredCapacity -= 1;
  }
  ctx.store.set(asgKey(asg.AutoScalingGroupName), asg);
  if (!shouldDecrement) {
    syncInstances(ctx, asg);
  }

  return {
    Activity: {
      ActivityId: `terminate-${instanceId}`,
      AutoScalingGroupName: asg.AutoScalingGroupName,
      Description: `Terminating EC2 instance: ${instanceId}`,
      Cause: "TerminateInstanceInAutoScalingGroup",
      StartTime: new Date().toISOString(),
      StatusCode: "InProgress",
      Progress: 0,
    },
  };
};

const AttachInstances: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : [];

  const newIds = instanceIds.filter((id) => !asg.InstanceIds.includes(id));
  if (asg.InstanceIds.length + newIds.length > asg.MaxSize) {
    throw awsError(
      "ValidationError",
      `Attaching ${newIds.length} instance(s) would exceed the group's MaxSize of ${asg.MaxSize}.`,
      400,
    );
  }

  for (const id of newIds) {
    const instance: StoredInstance = {
      InstanceId: id,
      AutoScalingGroupName: asgName,
      AvailabilityZone: asg.AvailabilityZones[0] ?? "us-east-1a",
      LifecycleState: "InService",
      HealthStatus: "Healthy",
      LaunchConfigurationName: asg.LaunchConfigurationName,
      ProtectedFromScaleIn: false,
    };
    ctx.store.set(instanceKey(id), instance);
    asg.InstanceIds.push(id);
  }
  asg.DesiredCapacity = Math.min(
    asg.MaxSize,
    asg.DesiredCapacity + newIds.length,
  );
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DetachInstances: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : [];
  if (typeof input["ShouldDecrementDesiredCapacity"] !== "boolean") {
    throw awsError(
      "ValidationError",
      "ShouldDecrementDesiredCapacity is required.",
      400,
    );
  }
  const shouldDecrement = input["ShouldDecrementDesiredCapacity"];

  const detachCount = instanceIds.filter((id) =>
    asg.InstanceIds.includes(id),
  ).length;
  if (shouldDecrement && asg.DesiredCapacity - detachCount < asg.MinSize) {
    throw awsError(
      "ValidationError",
      `Cannot decrement DesiredCapacity below MinSize ${asg.MinSize}.`,
      400,
    );
  }

  const activities: Record<string, unknown>[] = [];
  for (const id of instanceIds) {
    const idx = asg.InstanceIds.indexOf(id);
    if (idx !== -1) {
      asg.InstanceIds.splice(idx, 1);
      ctx.store.delete(instanceKey(id));
      activities.push({
        ActivityId: `detach-${id}`,
        AutoScalingGroupName: asgName,
        Description: `Detaching EC2 instance: ${id}`,
        Cause: "DetachInstances",
        StartTime: new Date().toISOString(),
        StatusCode: "InProgress",
        Progress: 0,
      });
    }
  }

  if (shouldDecrement) {
    asg.DesiredCapacity = Math.max(
      asg.MinSize,
      asg.DesiredCapacity - detachCount,
    );
    ctx.store.set(asgKey(asgName), asg);
  } else {
    ctx.store.set(asgKey(asgName), asg);
    syncInstances(ctx, asg);
  }

  return { Activities: activities };
};

const PutScalingPolicy: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const policyName = requireString(input, "PolicyName");
  const arn = policyArnOf(ctx.region, ctx.account, asgName, policyName);

  const policy: StoredScalingPolicy = {
    PolicyARN: arn,
    PolicyName: policyName,
    AutoScalingGroupName: asgName,
    PolicyType:
      typeof input["PolicyType"] === "string"
        ? input["PolicyType"]
        : "SimpleScaling",
    AdjustmentType:
      typeof input["AdjustmentType"] === "string"
        ? input["AdjustmentType"]
        : undefined,
    ScalingAdjustment:
      typeof input["ScalingAdjustment"] === "number"
        ? input["ScalingAdjustment"]
        : undefined,
    Cooldown:
      typeof input["Cooldown"] === "number" ? input["Cooldown"] : undefined,
    MinAdjustmentMagnitude:
      typeof input["MinAdjustmentMagnitude"] === "number"
        ? input["MinAdjustmentMagnitude"]
        : undefined,
    EstimatedInstanceWarmup:
      typeof input["EstimatedInstanceWarmup"] === "number"
        ? input["EstimatedInstanceWarmup"]
        : undefined,
    TargetTrackingConfiguration:
      typeof input["TargetTrackingConfiguration"] === "object"
        ? input["TargetTrackingConfiguration"]
        : undefined,
    StepAdjustments: Array.isArray(input["StepAdjustments"])
      ? (input["StepAdjustments"] as unknown[])
      : [],
    MetricAggregationType:
      typeof input["MetricAggregationType"] === "string"
        ? input["MetricAggregationType"]
        : undefined,
    Enabled: typeof input["Enabled"] === "boolean" ? input["Enabled"] : true,
  };

  ctx.store.set(policyKey(asgName, policyName), policy);
  return { PolicyARN: arn };
};

const DescribePolicies: OperationHandler = (input, ctx) => {
  const asgName =
    typeof input["AutoScalingGroupName"] === "string"
      ? input["AutoScalingGroupName"]
      : undefined;
  const policyNames = Array.isArray(input["PolicyNames"])
    ? (input["PolicyNames"] as string[])
    : [];
  const policyTypes = Array.isArray(input["PolicyTypes"])
    ? (input["PolicyTypes"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredScalingPolicy>()
    .filter((e) => e.key.startsWith("policy/"))
    .map((e) => e.value);

  if (asgName !== undefined) {
    all = all.filter((p) => p.AutoScalingGroupName === asgName);
  }
  if (policyNames.length > 0) {
    const nameSet = new Set(policyNames);
    all = all.filter((p) => nameSet.has(p.PolicyName));
  }
  if (policyTypes.length > 0) {
    const typeSet = new Set(policyTypes);
    all = all.filter((p) => typeSet.has(p.PolicyType));
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    ScalingPolicies: page.map((p) => ({
      PolicyARN: p.PolicyARN,
      PolicyName: p.PolicyName,
      AutoScalingGroupName: p.AutoScalingGroupName,
      PolicyType: p.PolicyType,
      AdjustmentType: p.AdjustmentType,
      ScalingAdjustment: p.ScalingAdjustment,
      Cooldown: p.Cooldown,
      MinAdjustmentMagnitude: p.MinAdjustmentMagnitude,
      EstimatedInstanceWarmup: p.EstimatedInstanceWarmup,
      TargetTrackingConfiguration: p.TargetTrackingConfiguration,
      StepAdjustments: p.StepAdjustments,
      MetricAggregationType: p.MetricAggregationType,
      Enabled: p.Enabled,
    })),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const asgName =
    typeof input["AutoScalingGroupName"] === "string"
      ? input["AutoScalingGroupName"]
      : undefined;
  const policyNameOrArn = requireString(input, "PolicyName");

  if (asgName !== undefined) {
    ctx.store.delete(policyKey(asgName, policyNameOrArn));
  } else {
    for (const entry of ctx.store.list<StoredScalingPolicy>()) {
      if (
        entry.key.startsWith("policy/") &&
        (entry.value.PolicyName === policyNameOrArn ||
          entry.value.PolicyARN === policyNameOrArn)
      ) {
        ctx.store.delete(entry.key);
        break;
      }
    }
  }
  return {};
};

const CreateOrUpdateTags: OperationHandler = (input, ctx) => {
  const rawTags = input["Tags"];
  if (!Array.isArray(rawTags)) return {};

  for (const t of rawTags) {
    if (typeof t !== "object" || t === null) continue;
    const tag = t as Record<string, unknown>;
    const resourceId =
      typeof tag["ResourceId"] === "string" ? tag["ResourceId"] : undefined;
    const key = typeof tag["Key"] === "string" ? tag["Key"] : undefined;
    if (resourceId === undefined || key === undefined) continue;

    if (
      ctx.store.get<StoredAutoScalingGroup>(asgKey(resourceId)) === undefined
    ) {
      throw awsError(
        "ValidationError",
        `Auto Scaling group '${resourceId}' does not exist.`,
        400,
      );
    }

    const storedTag: StoredTag = {
      ResourceId: resourceId,
      ResourceType:
        typeof tag["ResourceType"] === "string"
          ? tag["ResourceType"]
          : "auto-scaling-group",
      Key: key,
      Value: typeof tag["Value"] === "string" ? tag["Value"] : "",
      PropagateAtLaunch:
        typeof tag["PropagateAtLaunch"] === "boolean"
          ? tag["PropagateAtLaunch"]
          : false,
    };
    ctx.store.set(tagKey(resourceId, key), storedTag);

    const asg = ctx.store.get<StoredAutoScalingGroup>(asgKey(resourceId));
    if (asg !== undefined) {
      const existing = asg.Tags.findIndex((t2) => t2.Key === key);
      if (existing >= 0) {
        asg.Tags[existing] = storedTag;
      } else {
        asg.Tags.push(storedTag);
      }
      ctx.store.set(asgKey(resourceId), asg);
    }
  }
  return {};
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);

  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as Record<string, unknown>[])
    : [];

  let all = ctx.store
    .list<StoredTag>()
    .filter((e) => e.key.startsWith("tag/"))
    .map((e) => e.value);

  for (const filter of filters) {
    const filterName = typeof filter["Name"] === "string" ? filter["Name"] : "";
    const filterValues = Array.isArray(filter["Values"])
      ? (filter["Values"] as string[])
      : [];
    if (filterValues.length === 0) continue;

    if (filterName === "auto-scaling-group") {
      const valueSet = new Set(filterValues);
      all = all.filter((t) => valueSet.has(t.ResourceId));
    } else if (filterName === "key") {
      const valueSet = new Set(filterValues);
      all = all.filter((t) => valueSet.has(t.Key));
    } else if (filterName === "value") {
      const valueSet = new Set(filterValues);
      all = all.filter((t) => valueSet.has(t.Value));
    } else if (filterName === "propagate-at-launch") {
      const wantTrue = filterValues.includes("true");
      const wantFalse = filterValues.includes("false");
      if (wantTrue && !wantFalse) {
        all = all.filter((t) => t.PropagateAtLaunch === true);
      } else if (wantFalse && !wantTrue) {
        all = all.filter((t) => t.PropagateAtLaunch === false);
      }
    }
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    Tags: page.map((t) => ({
      ResourceId: t.ResourceId,
      ResourceType: t.ResourceType,
      Key: t.Key,
      Value: t.Value,
      PropagateAtLaunch: t.PropagateAtLaunch,
    })),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const rawTags = input["Tags"];
  if (!Array.isArray(rawTags)) return {};

  for (const t of rawTags) {
    if (typeof t !== "object" || t === null) continue;
    const tag = t as Record<string, unknown>;
    const resourceId =
      typeof tag["ResourceId"] === "string" ? tag["ResourceId"] : undefined;
    const key = typeof tag["Key"] === "string" ? tag["Key"] : undefined;
    if (resourceId === undefined || key === undefined) continue;

    if (
      ctx.store.get<StoredAutoScalingGroup>(asgKey(resourceId)) === undefined
    ) {
      throw awsError(
        "ValidationError",
        `Auto Scaling group '${resourceId}' does not exist.`,
        400,
      );
    }

    ctx.store.delete(tagKey(resourceId, key));

    const asg = ctx.store.get<StoredAutoScalingGroup>(asgKey(resourceId));
    if (asg !== undefined) {
      asg.Tags = asg.Tags.filter((t2) => t2.Key !== key);
      ctx.store.set(asgKey(resourceId), asg);
    }
  }
  return {};
};

// --- Static response operations ---

const DescribeAccountLimits: OperationHandler = (_input, _ctx) => ({
  MaxNumberOfAutoScalingGroups: 200,
  MaxNumberOfLaunchConfigurations: 200,
  NumberOfAutoScalingGroups: 0,
  NumberOfLaunchConfigurations: 0,
});

const DescribeAdjustmentTypes: OperationHandler = (_input, _ctx) => ({
  AdjustmentTypes: [
    { AdjustmentType: "ChangeInCapacity" },
    { AdjustmentType: "ExactCapacity" },
    { AdjustmentType: "PercentChangeInCapacity" },
  ],
});

const DescribeAutoScalingNotificationTypes: OperationHandler = (
  _input,
  _ctx,
) => ({
  AutoScalingNotificationTypes: [
    "autoscaling:EC2_INSTANCE_LAUNCH",
    "autoscaling:EC2_INSTANCE_LAUNCH_ERROR",
    "autoscaling:EC2_INSTANCE_TERMINATE",
    "autoscaling:EC2_INSTANCE_TERMINATE_ERROR",
    "autoscaling:TEST_NOTIFICATION",
  ],
});

const DescribeLifecycleHookTypes: OperationHandler = (_input, _ctx) => ({
  LifecycleHookTypes: [
    "autoscaling:EC2_INSTANCE_LAUNCHING",
    "autoscaling:EC2_INSTANCE_TERMINATING",
  ],
});

const DescribeMetricCollectionTypes: OperationHandler = (_input, _ctx) => ({
  Metrics: [
    { Metric: "GroupMinSize" },
    { Metric: "GroupMaxSize" },
    { Metric: "GroupDesiredCapacity" },
    { Metric: "GroupInServiceInstances" },
    { Metric: "GroupPendingInstances" },
    { Metric: "GroupStandbyInstances" },
    { Metric: "GroupTerminatingInstances" },
    { Metric: "GroupTotalInstances" },
  ],
  Granularities: [{ Granularity: "1Minute" }],
});

const DescribeScalingProcessTypes: OperationHandler = (_input, _ctx) => ({
  Processes: [
    { ProcessName: "Launch" },
    { ProcessName: "Terminate" },
    { ProcessName: "AddToLoadBalancer" },
    { ProcessName: "AlarmNotification" },
    { ProcessName: "AZRebalance" },
    { ProcessName: "HealthCheck" },
    { ProcessName: "InstanceRefresh" },
    { ProcessName: "ReplaceUnhealthy" },
    { ProcessName: "ScheduledActions" },
  ],
});

const DescribeTerminationPolicyTypes: OperationHandler = (_input, _ctx) => ({
  TerminationPolicyTypes: [
    "AllocationStrategy",
    "ClosestToNextInstanceHour",
    "Default",
    "NewestInstance",
    "OldestInstance",
    "OldestLaunchConfiguration",
    "OldestLaunchTemplate",
  ],
});

// --- LoadBalancer / TargetGroup / TrafficSources ---

const AttachLoadBalancers: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const names = Array.isArray(input["LoadBalancerNames"])
    ? (input["LoadBalancerNames"] as string[])
    : [];
  for (const n of names) {
    if (!asg.LoadBalancerNames.includes(n)) asg.LoadBalancerNames.push(n);
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DetachLoadBalancers: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const names = Array.isArray(input["LoadBalancerNames"])
    ? (input["LoadBalancerNames"] as string[])
    : [];
  const nameSet = new Set(names);
  asg.LoadBalancerNames = asg.LoadBalancerNames.filter((n) => !nameSet.has(n));
  ctx.store.set(asgKey(asgName), asg);
  return { Activities: [] };
};

const DescribeLoadBalancers: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const offset = decodePageToken(input["NextToken"]);
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 100;
  const page = asg.LoadBalancerNames.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    LoadBalancers: page.map((n) => ({
      LoadBalancerName: n,
      State: "Added",
    })),
  };
  if (offset + maxRecords < asg.LoadBalancerNames.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const AttachLoadBalancerTargetGroups: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const arns = Array.isArray(input["TargetGroupARNs"])
    ? (input["TargetGroupARNs"] as string[])
    : [];
  for (const arn of arns) {
    if (!asg.TargetGroupARNs.includes(arn)) asg.TargetGroupARNs.push(arn);
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DetachLoadBalancerTargetGroups: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const arns = Array.isArray(input["TargetGroupARNs"])
    ? (input["TargetGroupARNs"] as string[])
    : [];
  const arnSet = new Set(arns);
  asg.TargetGroupARNs = asg.TargetGroupARNs.filter((a) => !arnSet.has(a));
  ctx.store.set(asgKey(asgName), asg);
  return { Activities: [] };
};

const DescribeLoadBalancerTargetGroups: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const offset = decodePageToken(input["NextToken"]);
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 100;
  const page = asg.TargetGroupARNs.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    LoadBalancerTargetGroups: page.map((arn) => ({
      LoadBalancerTargetGroupARN: arn,
      State: "Added",
    })),
  };
  if (offset + maxRecords < asg.TargetGroupARNs.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const AttachTrafficSources: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const sources = Array.isArray(input["TrafficSources"])
    ? (input["TrafficSources"] as { Identifier: string; Type: string }[])
    : [];
  for (const src of sources) {
    if (!asg.TrafficSources.some((s) => s.Identifier === src.Identifier)) {
      asg.TrafficSources.push(src);
    }
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DetachTrafficSources: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const sources = Array.isArray(input["TrafficSources"])
    ? (input["TrafficSources"] as { Identifier: string }[])
    : [];
  const idSet = new Set(sources.map((s) => s.Identifier));
  asg.TrafficSources = asg.TrafficSources.filter(
    (s) => !idSet.has(s.Identifier),
  );
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DescribeTrafficSources: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const offset = decodePageToken(input["NextToken"]);
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 100;
  const page = asg.TrafficSources.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    TrafficSources: page.map((s) => ({
      Identifier: s.Identifier,
      Type: s.Type,
      State: "Added",
    })),
  };
  if (offset + maxRecords < asg.TrafficSources.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

// --- Scheduled actions ---

const PutScheduledUpdateGroupAction: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const actionName = requireString(input, "ScheduledActionName");
  const arn = nextScheduledActionArn(
    ctx.region,
    ctx.account,
    asgName,
    actionName,
  );

  const action: StoredScheduledAction = {
    ScheduledActionName: actionName,
    ScheduledActionARN: arn,
    AutoScalingGroupName: asgName,
    StartTime:
      typeof input["StartTime"] === "string" ? input["StartTime"] : undefined,
    EndTime:
      typeof input["EndTime"] === "string" ? input["EndTime"] : undefined,
    Recurrence:
      typeof input["Recurrence"] === "string" ? input["Recurrence"] : undefined,
    TimeZone:
      typeof input["TimeZone"] === "string" ? input["TimeZone"] : undefined,
    MinSize:
      typeof input["MinSize"] === "number" ? input["MinSize"] : undefined,
    MaxSize:
      typeof input["MaxSize"] === "number" ? input["MaxSize"] : undefined,
    DesiredCapacity:
      typeof input["DesiredCapacity"] === "number"
        ? input["DesiredCapacity"]
        : undefined,
  };
  ctx.store.set(scheduledActionKey(asgName, actionName), action);
  return {};
};

const DescribeScheduledActions: OperationHandler = (input, ctx) => {
  const asgName =
    typeof input["AutoScalingGroupName"] === "string"
      ? input["AutoScalingGroupName"]
      : undefined;
  const actionNames = Array.isArray(input["ScheduledActionNames"])
    ? (input["ScheduledActionNames"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredScheduledAction>()
    .filter((e) => e.key.startsWith("scheduled/"))
    .map((e) => e.value);

  if (asgName !== undefined) {
    all = all.filter((a) => a.AutoScalingGroupName === asgName);
  }
  if (actionNames.length > 0) {
    const nameSet = new Set(actionNames);
    all = all.filter((a) => nameSet.has(a.ScheduledActionName));
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    ScheduledUpdateGroupActions: page.map((a) => ({
      ScheduledActionName: a.ScheduledActionName,
      ScheduledActionARN: a.ScheduledActionARN,
      AutoScalingGroupName: a.AutoScalingGroupName,
      StartTime: a.StartTime,
      EndTime: a.EndTime,
      Recurrence: a.Recurrence,
      TimeZone: a.TimeZone,
      MinSize: a.MinSize,
      MaxSize: a.MaxSize,
      DesiredCapacity: a.DesiredCapacity,
    })),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const DeleteScheduledAction: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const actionName = requireString(input, "ScheduledActionName");
  ctx.store.delete(scheduledActionKey(asgName, actionName));
  return {};
};

const BatchPutScheduledUpdateGroupAction: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const actions = Array.isArray(input["ScheduledUpdateGroupActions"])
    ? (input["ScheduledUpdateGroupActions"] as Record<string, unknown>[])
    : [];

  const failedScheduledActions: Record<string, unknown>[] = [];
  for (const raw of actions) {
    const actionName =
      typeof raw["ScheduledActionName"] === "string"
        ? raw["ScheduledActionName"]
        : undefined;
    if (actionName === undefined) continue;
    const arn = nextScheduledActionArn(
      ctx.region,
      ctx.account,
      asgName,
      actionName,
    );
    const action: StoredScheduledAction = {
      ScheduledActionName: actionName,
      ScheduledActionARN: arn,
      AutoScalingGroupName: asgName,
      StartTime:
        typeof raw["StartTime"] === "string" ? raw["StartTime"] : undefined,
      EndTime: typeof raw["EndTime"] === "string" ? raw["EndTime"] : undefined,
      Recurrence:
        typeof raw["Recurrence"] === "string" ? raw["Recurrence"] : undefined,
      TimeZone:
        typeof raw["TimeZone"] === "string" ? raw["TimeZone"] : undefined,
      MinSize: typeof raw["MinSize"] === "number" ? raw["MinSize"] : undefined,
      MaxSize: typeof raw["MaxSize"] === "number" ? raw["MaxSize"] : undefined,
      DesiredCapacity:
        typeof raw["DesiredCapacity"] === "number"
          ? raw["DesiredCapacity"]
          : undefined,
    };
    ctx.store.set(scheduledActionKey(asgName, actionName), action);
  }
  return { FailedScheduledUpdateGroupActions: failedScheduledActions };
};

const BatchDeleteScheduledAction: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const actionNames = Array.isArray(input["ScheduledActionNames"])
    ? (input["ScheduledActionNames"] as string[])
    : [];
  const failedScheduledActions: Record<string, unknown>[] = [];
  for (const actionName of actionNames) {
    ctx.store.delete(scheduledActionKey(asgName, actionName));
  }
  return { FailedScheduledUpdateGroupActions: failedScheduledActions };
};

// --- Lifecycle hooks ---

const PutLifecycleHook: OperationHandler = (input, ctx) => {
  const hookName = requireString(input, "LifecycleHookName");
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);

  const hook: StoredLifecycleHook = {
    LifecycleHookName: hookName,
    AutoScalingGroupName: asgName,
    LifecycleTransition:
      typeof input["LifecycleTransition"] === "string"
        ? input["LifecycleTransition"]
        : "autoscaling:EC2_INSTANCE_LAUNCHING",
    RoleARN:
      typeof input["RoleARN"] === "string" ? input["RoleARN"] : undefined,
    NotificationTargetARN:
      typeof input["NotificationTargetARN"] === "string"
        ? input["NotificationTargetARN"]
        : undefined,
    NotificationMetadata:
      typeof input["NotificationMetadata"] === "string"
        ? input["NotificationMetadata"]
        : undefined,
    HeartbeatTimeout:
      typeof input["HeartbeatTimeout"] === "number"
        ? input["HeartbeatTimeout"]
        : 3600,
    DefaultResult:
      typeof input["DefaultResult"] === "string"
        ? input["DefaultResult"]
        : "ABANDON",
    GlobalTimeout: 172800,
  };
  ctx.store.set(lifecycleHookKey(asgName, hookName), hook);
  return {};
};

const DescribeLifecycleHooks: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const hookNames = Array.isArray(input["LifecycleHookNames"])
    ? (input["LifecycleHookNames"] as string[])
    : [];

  let all = ctx.store
    .list<StoredLifecycleHook>()
    .filter((e) => e.key.startsWith(`hook/${asgName}/`))
    .map((e) => e.value);

  if (hookNames.length > 0) {
    const nameSet = new Set(hookNames);
    all = all.filter((h) => nameSet.has(h.LifecycleHookName));
  }

  return {
    LifecycleHooks: all.map((h) => ({
      LifecycleHookName: h.LifecycleHookName,
      AutoScalingGroupName: h.AutoScalingGroupName,
      LifecycleTransition: h.LifecycleTransition,
      RoleARN: h.RoleARN,
      NotificationTargetARN: h.NotificationTargetARN,
      NotificationMetadata: h.NotificationMetadata,
      HeartbeatTimeout: h.HeartbeatTimeout,
      DefaultResult: h.DefaultResult,
      GlobalTimeout: h.GlobalTimeout,
    })),
  };
};

const DeleteLifecycleHook: OperationHandler = (input, ctx) => {
  const hookName = requireString(input, "LifecycleHookName");
  const asgName = requireString(input, "AutoScalingGroupName");
  ctx.store.delete(lifecycleHookKey(asgName, hookName));
  return {};
};

const CompleteLifecycleAction: OperationHandler = (input, ctx) => {
  requireString(input, "LifecycleHookName");
  requireString(input, "AutoScalingGroupName");
  return {};
};

const RecordLifecycleActionHeartbeat: OperationHandler = (input, ctx) => {
  requireString(input, "LifecycleHookName");
  requireString(input, "AutoScalingGroupName");
  return {};
};

// --- Process suspend/resume ---

const SuspendProcesses: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const processes = Array.isArray(input["ScalingProcesses"])
    ? (input["ScalingProcesses"] as string[])
    : [
        "Launch",
        "Terminate",
        "AddToLoadBalancer",
        "AlarmNotification",
        "AZRebalance",
        "HealthCheck",
        "InstanceRefresh",
        "ReplaceUnhealthy",
        "ScheduledActions",
      ];
  for (const p of processes) {
    if (!asg.SuspendedProcesses.includes(p)) asg.SuspendedProcesses.push(p);
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const ResumeProcesses: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const processes = Array.isArray(input["ScalingProcesses"])
    ? (input["ScalingProcesses"] as string[])
    : [];
  if (processes.length === 0) {
    asg.SuspendedProcesses = [];
  } else {
    const processSet = new Set(processes);
    asg.SuspendedProcesses = asg.SuspendedProcesses.filter(
      (p) => !processSet.has(p),
    );
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

// --- Instance refresh ---

const StartInstanceRefresh: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);

  const existing = ctx.store
    .list<StoredInstanceRefresh>()
    .filter((e) => e.key.startsWith("refresh/"))
    .find(
      (e) =>
        e.value.AutoScalingGroupName === asgName &&
        e.value.Status === "InProgress",
    );
  if (existing !== undefined) {
    throw awsError(
      "InstanceRefreshInProgressFault",
      `An instance refresh is already in progress for Auto Scaling group ${asgName}.`,
      400,
    );
  }

  const refreshId = nextRefreshId();
  const refresh: StoredInstanceRefresh = {
    InstanceRefreshId: refreshId,
    AutoScalingGroupName: asgName,
    Status: "InProgress",
    StartTime: new Date().toISOString(),
    EndTime: undefined,
    PercentageComplete: 0,
    InstancesToUpdate: 0,
  };
  ctx.store.set(instanceRefreshKey(refreshId), refresh);
  return { InstanceRefreshId: refreshId };
};

const DescribeInstanceRefreshes: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const refreshIds = Array.isArray(input["InstanceRefreshIds"])
    ? (input["InstanceRefreshIds"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredInstanceRefresh>()
    .filter((e) => e.key.startsWith("refresh/"))
    .map((e) => e.value)
    .filter((r) => r.AutoScalingGroupName === asgName);

  if (refreshIds.length > 0) {
    const idSet = new Set(refreshIds);
    all = all.filter((r) => idSet.has(r.InstanceRefreshId));
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    InstanceRefreshes: page.map((r) => {
      const status = r.Status === "InProgress" ? "Successful" : r.Status;
      return {
        InstanceRefreshId: r.InstanceRefreshId,
        AutoScalingGroupName: r.AutoScalingGroupName,
        Status: status,
        StartTime: r.StartTime,
        EndTime: r.EndTime ?? r.StartTime,
        PercentageComplete:
          status === "Successful" ? 100 : r.PercentageComplete,
        InstancesToUpdate: r.InstancesToUpdate,
      };
    }),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const CancelInstanceRefresh: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const entry = ctx.store
    .list<StoredInstanceRefresh>()
    .filter((e) => e.key.startsWith("refresh/"))
    .find(
      (e) =>
        e.value.AutoScalingGroupName === asgName &&
        e.value.Status === "InProgress",
    );
  if (entry === undefined) {
    throw awsError(
      "ActiveInstanceRefreshNotFound",
      `No in-progress instance refresh found for Auto Scaling group ${asgName}.`,
      400,
    );
  }
  const refresh = entry.value;
  refresh.Status = "Cancelled";
  refresh.EndTime = new Date().toISOString();
  ctx.store.set(instanceRefreshKey(refresh.InstanceRefreshId), refresh);
  return { InstanceRefreshId: refresh.InstanceRefreshId };
};

const RollbackInstanceRefresh: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const entry = ctx.store
    .list<StoredInstanceRefresh>()
    .filter((e) => e.key.startsWith("refresh/"))
    .find(
      (e) =>
        e.value.AutoScalingGroupName === asgName &&
        (e.value.Status === "InProgress" || e.value.Status === "Successful"),
    );
  if (entry === undefined) {
    throw awsError(
      "ActiveInstanceRefreshNotFound",
      `No rollbackable instance refresh found for Auto Scaling group ${asgName}.`,
      400,
    );
  }
  const refresh = entry.value;
  refresh.Status = "RollbackSuccessful";
  refresh.EndTime = new Date().toISOString();
  ctx.store.set(instanceRefreshKey(refresh.InstanceRefreshId), refresh);
  return { InstanceRefreshId: refresh.InstanceRefreshId };
};

// --- Standby ---

const EnterStandby: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : asg.InstanceIds.slice();
  const shouldDecrement =
    typeof input["ShouldDecrementDesiredCapacity"] === "boolean"
      ? input["ShouldDecrementDesiredCapacity"]
      : false;

  const activities: Record<string, unknown>[] = [];
  for (const id of instanceIds) {
    const inst = ctx.store.get<StoredInstance>(instanceKey(id));
    if (inst !== undefined) {
      inst.LifecycleState = "Standby";
      ctx.store.set(instanceKey(id), inst);
      activities.push({
        ActivityId: nextActivityId(),
        AutoScalingGroupName: asgName,
        Description: `Moving EC2 instance to Standby: ${id}`,
        Cause: "EnterStandby",
        StartTime: new Date().toISOString(),
        StatusCode: "Successful",
        Progress: 100,
      });
    }
  }

  if (shouldDecrement) {
    asg.DesiredCapacity = Math.max(
      asg.MinSize,
      asg.DesiredCapacity - instanceIds.length,
    );
    ctx.store.set(asgKey(asgName), asg);
  }

  return { Activities: activities };
};

const ExitStandby: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : asg.InstanceIds.filter((id) => {
        const inst = ctx.store.get<StoredInstance>(instanceKey(id));
        return inst?.LifecycleState === "Standby";
      });

  const activities: Record<string, unknown>[] = [];
  for (const id of instanceIds) {
    const inst = ctx.store.get<StoredInstance>(instanceKey(id));
    if (inst !== undefined && inst.LifecycleState === "Standby") {
      inst.LifecycleState = "InService";
      ctx.store.set(instanceKey(id), inst);
      asg.DesiredCapacity = Math.min(asg.MaxSize, asg.DesiredCapacity + 1);
      activities.push({
        ActivityId: nextActivityId(),
        AutoScalingGroupName: asgName,
        Description: `Moving EC2 instance out of Standby: ${id}`,
        Cause: "ExitStandby",
        StartTime: new Date().toISOString(),
        StatusCode: "Successful",
        Progress: 100,
      });
    }
  }

  ctx.store.set(asgKey(asgName), asg);
  return { Activities: activities };
};

// --- SetInstanceHealth / SetInstanceProtection ---

const SetInstanceHealth: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  const healthStatus = requireString(input, "HealthStatus");
  const inst = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (inst === undefined) {
    throw awsError("ValidationError", `Instance ${instanceId} not found.`, 400);
  }
  inst.HealthStatus = healthStatus;
  ctx.store.set(instanceKey(instanceId), inst);
  return {};
};

const SetInstanceProtection: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : [];
  const protected_ =
    typeof input["ProtectedFromScaleIn"] === "boolean"
      ? input["ProtectedFromScaleIn"]
      : false;

  for (const id of instanceIds) {
    const inst = ctx.store.get<StoredInstance>(instanceKey(id));
    if (inst !== undefined) {
      inst.ProtectedFromScaleIn = protected_;
      ctx.store.set(instanceKey(id), inst);
    }
  }
  return {};
};

// --- Warm pool ---

const PutWarmPool: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const warmPool: StoredWarmPool = {
    AutoScalingGroupName: asgName,
    MaxGroupPreparedCapacity:
      typeof input["MaxGroupPreparedCapacity"] === "number"
        ? input["MaxGroupPreparedCapacity"]
        : undefined,
    MinSize: typeof input["MinSize"] === "number" ? input["MinSize"] : 0,
    PoolState:
      typeof input["PoolState"] === "string" ? input["PoolState"] : "Stopped",
  };
  ctx.store.set(warmPoolKey(asgName), warmPool);
  return {};
};

const DescribeWarmPool: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const wp = ctx.store.get<StoredWarmPool>(warmPoolKey(asgName));
  if (wp === undefined) {
    return { WarmPoolConfiguration: {}, Instances: [] };
  }
  return {
    WarmPoolConfiguration: {
      MaxGroupPreparedCapacity: wp.MaxGroupPreparedCapacity,
      MinSize: wp.MinSize,
      PoolState: wp.PoolState,
      Status: "Active",
    },
    Instances: [],
  };
};

const DeleteWarmPool: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  ctx.store.delete(warmPoolKey(asgName));
  return {};
};

// --- Notification configurations ---

const PutNotificationConfiguration: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const topicArn = requireString(input, "TopicARN");
  const types = Array.isArray(input["NotificationTypes"])
    ? (input["NotificationTypes"] as string[])
    : [];
  for (const type of types) {
    const notif: StoredNotification = {
      AutoScalingGroupName: asgName,
      TopicARN: topicArn,
      NotificationType: type,
    };
    ctx.store.set(notificationKey(asgName, topicArn, type), notif);
  }
  return {};
};

const DescribeNotificationConfigurations: OperationHandler = (input, ctx) => {
  const asgNames = Array.isArray(input["AutoScalingGroupNames"])
    ? (input["AutoScalingGroupNames"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 50;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredNotification>()
    .filter((e) => e.key.startsWith("notification/"))
    .map((e) => e.value);

  if (asgNames.length > 0) {
    const nameSet = new Set(asgNames);
    all = all.filter((n) => nameSet.has(n.AutoScalingGroupName));
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    NotificationConfigurations: page.map((n) => ({
      AutoScalingGroupName: n.AutoScalingGroupName,
      TopicARN: n.TopicARN,
      NotificationType: n.NotificationType,
    })),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

const DeleteNotificationConfiguration: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const topicArn = requireString(input, "TopicARN");

  for (const entry of ctx.store.list<StoredNotification>()) {
    if (
      entry.key.startsWith(`notification/${asgName}/${topicArn}/`) &&
      entry.value.AutoScalingGroupName === asgName &&
      entry.value.TopicARN === topicArn
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

// --- Metrics collection ---

const EnableMetricsCollection: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const metrics = Array.isArray(input["Metrics"])
    ? (input["Metrics"] as string[])
    : [
        "GroupMinSize",
        "GroupMaxSize",
        "GroupDesiredCapacity",
        "GroupInServiceInstances",
        "GroupPendingInstances",
        "GroupStandbyInstances",
        "GroupTerminatingInstances",
        "GroupTotalInstances",
      ];
  for (const m of metrics) {
    if (!asg.EnabledMetrics.includes(m)) asg.EnabledMetrics.push(m);
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DisableMetricsCollection: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const metrics = Array.isArray(input["Metrics"])
    ? (input["Metrics"] as string[])
    : [];
  if (metrics.length === 0) {
    asg.EnabledMetrics = [];
  } else {
    const metricSet = new Set(metrics);
    asg.EnabledMetrics = asg.EnabledMetrics.filter((m) => !metricSet.has(m));
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

// --- ExecutePolicy ---

const ExecutePolicy: OperationHandler = (input, ctx) => {
  const policyNameOrArn = requireString(input, "PolicyName");
  const asgName =
    typeof input["AutoScalingGroupName"] === "string"
      ? input["AutoScalingGroupName"]
      : undefined;

  let policy: StoredScalingPolicy | undefined;
  if (asgName !== undefined) {
    policy = ctx.store.get<StoredScalingPolicy>(
      policyKey(asgName, policyNameOrArn),
    );
  }
  if (policy === undefined) {
    for (const entry of ctx.store.list<StoredScalingPolicy>()) {
      if (
        entry.key.startsWith("policy/") &&
        (entry.value.PolicyName === policyNameOrArn ||
          entry.value.PolicyARN === policyNameOrArn)
      ) {
        policy = entry.value;
        break;
      }
    }
  }
  if (policy === undefined) {
    throw awsError(
      "ValidationError",
      `Policy ${policyNameOrArn} not found.`,
      400,
    );
  }

  const asg = requireAsg(ctx, policy.AutoScalingGroupName);

  if (
    policy.PolicyType === "SimpleScaling" &&
    policy.AdjustmentType !== undefined &&
    policy.ScalingAdjustment !== undefined
  ) {
    let newDesired = asg.DesiredCapacity;
    if (policy.AdjustmentType === "ChangeInCapacity") {
      newDesired += policy.ScalingAdjustment;
    } else if (policy.AdjustmentType === "ExactCapacity") {
      newDesired = policy.ScalingAdjustment;
    } else if (policy.AdjustmentType === "PercentChangeInCapacity") {
      newDesired = Math.round(
        asg.DesiredCapacity * (1 + policy.ScalingAdjustment / 100),
      );
    }
    asg.DesiredCapacity = Math.min(
      asg.MaxSize,
      Math.max(asg.MinSize, newDesired),
    );
    ctx.store.set(asgKey(asg.AutoScalingGroupName), asg);
    syncInstances(ctx, asg);
    recordActivity(
      ctx,
      asg.AutoScalingGroupName,
      `Executing policy ${policy.PolicyName}`,
      "ExecutePolicy",
    );
  }

  return {};
};

// --- DescribeScalingActivities ---

const DescribeScalingActivities: OperationHandler = (input, ctx) => {
  const asgName =
    typeof input["AutoScalingGroupName"] === "string"
      ? input["AutoScalingGroupName"]
      : undefined;
  const activityIds = Array.isArray(input["ActivityIds"])
    ? (input["ActivityIds"] as string[])
    : [];
  const maxRecords =
    typeof input["MaxRecords"] === "number" ? input["MaxRecords"] : 100;
  const offset = decodePageToken(input["NextToken"]);

  let all = ctx.store
    .list<StoredScalingActivity>()
    .filter((e) => e.key.startsWith("activity/"))
    .map((e) => e.value);

  if (asgName !== undefined) {
    all = all.filter((a) => a.AutoScalingGroupName === asgName);
  }
  if (activityIds.length > 0) {
    const idSet = new Set(activityIds);
    all = all.filter((a) => idSet.has(a.ActivityId));
  }

  const page = all.slice(offset, offset + maxRecords);
  const result: Record<string, unknown> = {
    Activities: page.map((a) => ({
      ActivityId: a.ActivityId,
      AutoScalingGroupName: a.AutoScalingGroupName,
      Description: a.Description,
      Cause: a.Cause,
      StartTime: a.StartTime,
      EndTime: a.EndTime,
      StatusCode: a.StatusCode,
      Progress: a.Progress,
    })),
  };
  if (offset + maxRecords < all.length) {
    result["NextToken"] = encodePageToken(offset + maxRecords);
  }
  return result;
};

// --- LaunchInstances ---

const LaunchInstances: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const requestedCapacity = requireNumber(input, "RequestedCapacity");
  const asg = requireAsg(ctx, asgName);

  const instanceIds: string[] = [];
  const az = asg.AvailabilityZones[0] ?? "us-east-1a";
  for (let i = 0; i < requestedCapacity; i++) {
    const id = nextInstanceId();
    const instance: StoredInstance = {
      InstanceId: id,
      AutoScalingGroupName: asgName,
      AvailabilityZone: az,
      LifecycleState: "InService",
      HealthStatus: "Healthy",
      LaunchConfigurationName: asg.LaunchConfigurationName,
      ProtectedFromScaleIn: asg.NewInstancesProtectedFromScaleIn,
    };
    ctx.store.set(instanceKey(id), instance);
    asg.InstanceIds.push(id);
    instanceIds.push(id);
  }
  ctx.store.set(asgKey(asgName), asg);

  return {
    InstanceIds: instanceIds,
  };
};

// --- GetPredictiveScalingForecast ---

const GetPredictiveScalingForecast: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  requireAsg(ctx, asgName);
  const now = new Date().toISOString();
  return {
    LoadForecast: [
      {
        Timestamps: [now],
        Values: [0],
        MetricSpecification: {
          TargetValue: 50,
          PredefinedLoadMetricSpecification: {
            PredefinedMetricType: "ASGTotalCPUUtilization",
          },
        },
      },
    ],
    CapacityForecast: {
      Timestamps: [now],
      Values: [0],
    },
    UpdateTime: now,
  };
};

const autoscaling = {
  name: "autoscaling",
  protocol: "query",
  operations: {
    CreateLaunchConfiguration,
    DescribeLaunchConfigurations,
    DeleteLaunchConfiguration,
    CreateAutoScalingGroup,
    DescribeAutoScalingGroups,
    UpdateAutoScalingGroup,
    DeleteAutoScalingGroup,
    SetDesiredCapacity,
    DescribeAutoScalingInstances,
    TerminateInstanceInAutoScalingGroup,
    AttachInstances,
    DetachInstances,
    PutScalingPolicy,
    DescribePolicies,
    DeletePolicy,
    CreateOrUpdateTags,
    DescribeTags,
    DeleteTags,
    // Static responses
    DescribeAccountLimits,
    DescribeAdjustmentTypes,
    DescribeAutoScalingNotificationTypes,
    DescribeLifecycleHookTypes,
    DescribeMetricCollectionTypes,
    DescribeScalingProcessTypes,
    DescribeTerminationPolicyTypes,
    // LoadBalancer / TargetGroup / TrafficSources
    AttachLoadBalancers,
    DetachLoadBalancers,
    DescribeLoadBalancers,
    AttachLoadBalancerTargetGroups,
    DetachLoadBalancerTargetGroups,
    DescribeLoadBalancerTargetGroups,
    AttachTrafficSources,
    DetachTrafficSources,
    DescribeTrafficSources,
    // Scheduled actions
    PutScheduledUpdateGroupAction,
    DescribeScheduledActions,
    DeleteScheduledAction,
    BatchPutScheduledUpdateGroupAction,
    BatchDeleteScheduledAction,
    // Lifecycle hooks
    PutLifecycleHook,
    DescribeLifecycleHooks,
    DeleteLifecycleHook,
    CompleteLifecycleAction,
    RecordLifecycleActionHeartbeat,
    // Process suspend/resume
    SuspendProcesses,
    ResumeProcesses,
    // Instance refresh
    StartInstanceRefresh,
    DescribeInstanceRefreshes,
    CancelInstanceRefresh,
    RollbackInstanceRefresh,
    // Standby
    EnterStandby,
    ExitStandby,
    // Health / Protection
    SetInstanceHealth,
    SetInstanceProtection,
    // Warm pool
    PutWarmPool,
    DescribeWarmPool,
    DeleteWarmPool,
    // Notifications
    PutNotificationConfiguration,
    DescribeNotificationConfigurations,
    DeleteNotificationConfiguration,
    // Metrics
    EnableMetricsCollection,
    DisableMetricsCollection,
    // Policy execution
    ExecutePolicy,
    // Activities
    DescribeScalingActivities,
    // Launch / Forecast
    LaunchInstances,
    GetPredictiveScalingForecast,
  },
  model,
} as const satisfies ServiceDefinition;

export default autoscaling;
