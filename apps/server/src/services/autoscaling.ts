import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import autoscalingModel from "../../../../test/vendor/aws-models/autoscaling.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(autoscalingModel);

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
};

const lcKey = (name: string): string => `lc/${name}`;
const asgKey = (name: string): string => `asg/${name}`;
const instanceKey = (id: string): string => `instance/${id}`;
const policyKey = (asgName: string, policyName: string): string =>
  `policy/${asgName}/${policyName}`;
const tagKey = (resourceId: string, key: string): string =>
  `tag/${resourceId}/${key}`;

let instanceCounter = 0;

const nextInstanceId = (): string => {
  instanceCounter += 1;
  return `i-${String(instanceCounter).padStart(17, "0")}`;
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
  const current = asg.InstanceIds.length;
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
      asg.InstanceIds.push(id);
    }
  } else if (current > desired) {
    const toRemove = asg.InstanceIds.splice(desired);
    for (const id of toRemove) {
      ctx.store.delete(instanceKey(id));
    }
  }

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
  const minSize = requireNumber(input, "MinSize");
  const maxSize = requireNumber(input, "MaxSize");
  const desiredCapacity =
    typeof input["DesiredCapacity"] === "number"
      ? input["DesiredCapacity"]
      : minSize;

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

  let all = ctx.store
    .list<StoredAutoScalingGroup>()
    .filter((e) => e.key.startsWith("asg/"))
    .map((e) => e.value);

  if (names.length > 0) {
    const nameSet = new Set(names);
    all = all.filter((asg) => nameSet.has(asg.AutoScalingGroupName));
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
  if (typeof input["MinSize"] === "number") asg.MinSize = input["MinSize"];
  if (typeof input["MaxSize"] === "number") asg.MaxSize = input["MaxSize"];
  if (typeof input["DesiredCapacity"] === "number") {
    asg.DesiredCapacity = input["DesiredCapacity"];
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
    return {};
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
  const shouldDecrement =
    typeof input["ShouldDecrementDesiredCapacity"] === "boolean"
      ? input["ShouldDecrementDesiredCapacity"]
      : true;

  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError("ValidationError", `Instance ${instanceId} not found.`, 400);
  }

  const asg = requireAsg(ctx, instance.AutoScalingGroupName);
  const idx = asg.InstanceIds.indexOf(instanceId);
  if (idx !== -1) {
    asg.InstanceIds.splice(idx, 1);
  }
  ctx.store.delete(instanceKey(instanceId));

  if (shouldDecrement && asg.DesiredCapacity > asg.MinSize) {
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

  for (const id of instanceIds) {
    if (!asg.InstanceIds.includes(id)) {
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
  }
  ctx.store.set(asgKey(asgName), asg);
  return {};
};

const DetachInstances: OperationHandler = (input, ctx) => {
  const asgName = requireString(input, "AutoScalingGroupName");
  const asg = requireAsg(ctx, asgName);
  const instanceIds = Array.isArray(input["InstanceIds"])
    ? (input["InstanceIds"] as string[])
    : [];
  const shouldDecrement =
    typeof input["ShouldDecrementDesiredCapacity"] === "boolean"
      ? input["ShouldDecrementDesiredCapacity"]
      : false;

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
      asg.DesiredCapacity - instanceIds.length,
    );
  }
  ctx.store.set(asgKey(asgName), asg);

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

    ctx.store.delete(tagKey(resourceId, key));

    const asg = ctx.store.get<StoredAutoScalingGroup>(asgKey(resourceId));
    if (asg !== undefined) {
      asg.Tags = asg.Tags.filter((t2) => t2.Key !== key);
      ctx.store.set(asgKey(resourceId), asg);
    }
  }
  return {};
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
  },
  model,
} as const satisfies ServiceDefinition;

export default autoscaling;
