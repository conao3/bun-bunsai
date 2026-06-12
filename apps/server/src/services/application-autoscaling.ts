import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import applicationAutoscalingModel from "../../models/application-autoscaling.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(applicationAutoscalingModel);

type StoredScalableTarget = {
  ServiceNamespace: string;
  ResourceId: string;
  ScalableDimension: string;
  MinCapacity: number | undefined;
  MaxCapacity: number | undefined;
  RoleARN: string | undefined;
  SuspendedState: SuspendedStateFlags;
  ScalableTargetARN: string;
  CreationTime: number;
};

type StoredScalingPolicy = {
  PolicyARN: string;
  PolicyName: string;
  ServiceNamespace: string;
  ResourceId: string;
  ScalableDimension: string;
  PolicyType: string;
  StepScalingPolicyConfiguration: unknown | undefined;
  TargetTrackingScalingPolicyConfiguration: unknown | undefined;
  PredictiveScalingPolicyConfiguration: unknown | undefined;
  CreationTime: number;
};

type StoredScheduledAction = {
  ScheduledActionName: string;
  ScheduledActionARN: string;
  ServiceNamespace: string;
  Schedule: string | undefined;
  Timezone: string | undefined;
  ResourceId: string;
  ScalableDimension: string;
  StartTime: number | undefined;
  EndTime: number | undefined;
  ScalableTargetAction: unknown | undefined;
  CreationTime: number;
};

type StoredScalingActivity = {
  ActivityId: string;
  ServiceNamespace: string;
  ResourceId: string;
  ScalableDimension: string;
  Description: string;
  Cause: string;
  StartTime: number;
  EndTime: number | undefined;
  StatusCode: string;
  StatusMessage: string | undefined;
};

type StoredTag = { Key: string; Value: string };

type SuspendedStateFlags = {
  DynamicScalingInSuspended: boolean;
  DynamicScalingOutSuspended: boolean;
  ScheduledScalingSuspended: boolean;
};

const targetKey = (ns: string, resourceId: string, dimension: string): string =>
  `target/${ns}/${resourceId}/${dimension}`;

const policyKey = (arn: string): string => `policy/${arn}`;
const scheduledActionKey = (arn: string): string => `saction/${arn}`;
const tagKey = (arn: string): string => `tags/${arn}`;
const activityKey = (id: string): string => `activity/${id}`;

let counter = 0;
const nextId = (): string => {
  counter += 1;
  return String(counter).padStart(12, "0");
};

const targetArn = (region: string, account: string): string =>
  `arn:aws:application-autoscaling:${region}:${account}:scalable-target/${crypto.randomUUID().replace(/-/g, "")}`;

const policyArn = (
  region: string,
  account: string,
  ns: string,
  resourceId: string,
  dimension: string,
  name: string,
): string =>
  `arn:aws:autoscaling:${region}:${account}:scalingPolicy:${nextId()}:resource/${ns}/${resourceId}:policyName/${name}:scalableDimension/${dimension}`;

const scheduledActionArn = (
  region: string,
  account: string,
  ns: string,
  resourceId: string,
  name: string,
): string =>
  `arn:aws:autoscaling:${region}:${account}:scheduledAction:${nextId()}:resource/${ns}/${resourceId}:scheduledActionName/${name}`;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
  defaultPageSize = 50,
  maxPageSize?: number,
): { items: T[]; nextToken: string | undefined } => {
  if (
    maxPageSize !== undefined &&
    typeof maxResults === "number" &&
    maxResults > maxPageSize
  ) {
    throw awsError(
      "ValidationException",
      `MaxResults must be between 1 and ${maxPageSize}.`,
      400,
    );
  }
  const pageSize =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : defaultPageSize;
  let startIndex = 0;
  if (typeof nextToken === "string" && nextToken !== "") {
    const parsed = parseInt(nextToken, 10);
    if (isNaN(parsed)) {
      throw awsError(
        "InvalidNextTokenException",
        "The NextToken value is invalid.",
        400,
      );
    }
    startIndex = parsed;
  }
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const getTargetByArn = (
  ctx: ServiceContext,
  arn: string,
): StoredScalableTarget => {
  const target = ctx.store
    .list<StoredScalableTarget>()
    .filter((e) => e.key.startsWith("target/"))
    .map((e) => e.value)
    .find((t) => t.ScalableTargetARN === arn);
  if (target === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ARN not found: ${arn}`,
      400,
      { ResourceName: arn },
    );
  }
  return target;
};

const getTarget = (
  ctx: ServiceContext,
  ns: string,
  resourceId: string,
  dimension: string,
): StoredScalableTarget => {
  const target = ctx.store.get<StoredScalableTarget>(
    targetKey(ns, resourceId, dimension),
  );
  if (target === undefined) {
    throw awsError(
      "ObjectNotFoundException",
      `No scalable target registered for the scalable dimension ${dimension} under service namespace ${ns} with resource ID ${resourceId}.`,
      400,
    );
  }
  return target;
};

const mergeSuspendedState = (
  input: unknown,
  existing: SuspendedStateFlags,
): SuspendedStateFlags => {
  if (input === null || typeof input !== "object") {
    return existing;
  }
  const patch = input as Record<string, unknown>;
  return {
    DynamicScalingInSuspended:
      typeof patch["DynamicScalingInSuspended"] === "boolean"
        ? patch["DynamicScalingInSuspended"]
        : existing.DynamicScalingInSuspended,
    DynamicScalingOutSuspended:
      typeof patch["DynamicScalingOutSuspended"] === "boolean"
        ? patch["DynamicScalingOutSuspended"]
        : existing.DynamicScalingOutSuspended,
    ScheduledScalingSuspended:
      typeof patch["ScheduledScalingSuspended"] === "boolean"
        ? patch["ScheduledScalingSuspended"]
        : existing.ScheduledScalingSuspended,
  };
};

const defaultSuspendedState = (): SuspendedStateFlags => ({
  DynamicScalingInSuspended: false,
  DynamicScalingOutSuspended: false,
  ScheduledScalingSuspended: false,
});

const RegisterScalableTarget: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");

  const key = targetKey(ns, resourceId, dimension);
  const existing = ctx.store.get<StoredScalableTarget>(key);

  if (existing === undefined) {
    if (typeof input["MinCapacity"] !== "number") {
      throw awsError(
        "ValidationException",
        "MinCapacity is required when registering a new scalable target.",
        400,
      );
    }
    if (typeof input["MaxCapacity"] !== "number") {
      throw awsError(
        "ValidationException",
        "MaxCapacity is required when registering a new scalable target.",
        400,
      );
    }
  }

  const newMin =
    typeof input["MinCapacity"] === "number"
      ? input["MinCapacity"]
      : existing?.MinCapacity;
  const newMax =
    typeof input["MaxCapacity"] === "number"
      ? input["MaxCapacity"]
      : existing?.MaxCapacity;

  if (
    typeof newMin === "number" &&
    typeof newMax === "number" &&
    newMin > newMax
  ) {
    throw awsError(
      "ValidationException",
      "MinCapacity must be less than or equal to MaxCapacity.",
      400,
    );
  }

  const arn = existing?.ScalableTargetARN ?? targetArn(ctx.region, ctx.account);

  const suspendedState = mergeSuspendedState(
    input["SuspendedState"],
    existing?.SuspendedState ?? defaultSuspendedState(),
  );

  const target: StoredScalableTarget = {
    ServiceNamespace: ns,
    ResourceId: resourceId,
    ScalableDimension: dimension,
    MinCapacity: newMin,
    MaxCapacity: newMax,
    RoleARN:
      typeof input["RoleARN"] === "string"
        ? input["RoleARN"]
        : existing?.RoleARN,
    SuspendedState: suspendedState,
    ScalableTargetARN: arn,
    CreationTime: existing?.CreationTime ?? Date.now() / 1000,
  };

  ctx.store.set(key, target);

  if (
    existing !== undefined &&
    (newMin !== existing.MinCapacity || newMax !== existing.MaxCapacity)
  ) {
    const activityId = crypto.randomUUID().replace(/-/g, "");
    const activity: StoredScalingActivity = {
      ActivityId: activityId,
      ServiceNamespace: ns,
      ResourceId: resourceId,
      ScalableDimension: dimension,
      Description: `Updating capacity from min=${existing.MinCapacity},max=${existing.MaxCapacity} to min=${newMin},max=${newMax}`,
      Cause: "RegisterScalableTarget",
      StartTime: Date.now() / 1000,
      EndTime: Date.now() / 1000,
      StatusCode: "Successful",
      StatusMessage: undefined,
    };
    ctx.store.set(activityKey(activityId), activity);
  }

  if (input["Tags"] !== undefined && typeof input["Tags"] === "object") {
    const tags = Object.entries(input["Tags"] as Record<string, string>).map(
      ([Key, Value]) => ({ Key, Value }),
    );
    const existingTags = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
    const merged = [
      ...existingTags.filter((e) => !tags.some((n) => n.Key === e.Key)),
      ...tags,
    ];
    ctx.store.set(tagKey(arn), merged);
  }

  return { ScalableTargetARN: arn };
};

const DescribeScalableTargets: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const resourceIds = Array.isArray(input["ResourceIds"])
    ? (input["ResourceIds"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const dimension =
    typeof input["ScalableDimension"] === "string"
      ? input["ScalableDimension"]
      : undefined;

  const all = ctx.store
    .list<StoredScalableTarget>()
    .filter((e) => e.key.startsWith("target/"))
    .map((e) => e.value);

  let filtered = all.filter((t) => t.ServiceNamespace === ns);
  if (resourceIds.length > 0) {
    filtered = filtered.filter((t) => resourceIds.includes(t.ResourceId));
  }
  if (dimension !== undefined) {
    filtered = filtered.filter((t) => t.ScalableDimension === dimension);
  }

  const { items, nextToken } = paginateList(
    filtered,
    input["NextToken"],
    input["MaxResults"],
  );

  const targets = items.map((t) => ({
    ServiceNamespace: t.ServiceNamespace,
    ResourceId: t.ResourceId,
    ScalableDimension: t.ScalableDimension,
    MinCapacity: t.MinCapacity,
    MaxCapacity: t.MaxCapacity,
    RoleARN: t.RoleARN,
    SuspendedState: t.SuspendedState,
    ScalableTargetARN: t.ScalableTargetARN,
    CreationTime: t.CreationTime,
  }));

  return { ScalableTargets: targets, NextToken: nextToken };
};

const DeregisterScalableTarget: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");

  const stored = ctx.store.get<StoredScalableTarget>(
    targetKey(ns, resourceId, dimension),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `No scalable target found for the scalable dimension ${dimension} under service namespace ${ns} with resource ID ${resourceId}.`,
      400,
    );
  }
  const target = stored;

  ctx.store.delete(targetKey(ns, resourceId, dimension));
  ctx.store.delete(tagKey(target.ScalableTargetARN));

  const policies = ctx.store
    .list<StoredScalingPolicy>()
    .filter((e) => e.key.startsWith("policy/"))
    .map((e) => e.value)
    .filter(
      (p) =>
        p.ServiceNamespace === ns &&
        p.ResourceId === resourceId &&
        p.ScalableDimension === dimension,
    );
  for (const p of policies) {
    ctx.store.delete(policyKey(p.PolicyARN));
  }

  const actions = ctx.store
    .list<StoredScheduledAction>()
    .filter((e) => e.key.startsWith("saction/"))
    .map((e) => e.value)
    .filter(
      (a) =>
        a.ServiceNamespace === ns &&
        a.ResourceId === resourceId &&
        a.ScalableDimension === dimension,
    );
  for (const a of actions) {
    ctx.store.delete(scheduledActionKey(a.ScheduledActionARN));
  }

  return {};
};

const PutScalingPolicy: OperationHandler = (input, ctx) => {
  const policyName = requireString(input, "PolicyName");
  const ns = requireString(input, "ServiceNamespace");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");

  getTarget(ctx, ns, resourceId, dimension);

  const existing = ctx.store
    .list<StoredScalingPolicy>()
    .filter((e) => e.key.startsWith("policy/"))
    .map((e) => e.value)
    .find(
      (p) =>
        p.ServiceNamespace === ns &&
        p.ResourceId === resourceId &&
        p.ScalableDimension === dimension &&
        p.PolicyName === policyName,
    );

  const policyType =
    typeof input["PolicyType"] === "string"
      ? input["PolicyType"]
      : (existing?.PolicyType ?? "StepScaling");

  if (
    policyType === "StepScaling" &&
    input["StepScalingPolicyConfiguration"] === undefined &&
    existing?.StepScalingPolicyConfiguration === undefined
  ) {
    throw awsError(
      "ValidationException",
      "StepScalingPolicyConfiguration is required for PolicyType StepScaling.",
      400,
    );
  }
  if (
    policyType === "TargetTrackingScaling" &&
    input["TargetTrackingScalingPolicyConfiguration"] === undefined &&
    existing?.TargetTrackingScalingPolicyConfiguration === undefined
  ) {
    throw awsError(
      "ValidationException",
      "TargetTrackingScalingPolicyConfiguration is required for PolicyType TargetTrackingScaling.",
      400,
    );
  }
  if (
    policyType === "PredictiveScaling" &&
    input["PredictiveScalingPolicyConfiguration"] === undefined &&
    existing?.PredictiveScalingPolicyConfiguration === undefined
  ) {
    throw awsError(
      "ValidationException",
      "PredictiveScalingPolicyConfiguration is required for PolicyType PredictiveScaling.",
      400,
    );
  }

  const arn =
    existing?.PolicyARN ??
    policyArn(ctx.region, ctx.account, ns, resourceId, dimension, policyName);

  const policy: StoredScalingPolicy = {
    PolicyARN: arn,
    PolicyName: policyName,
    ServiceNamespace: ns,
    ResourceId: resourceId,
    ScalableDimension: dimension,
    PolicyType: policyType,
    StepScalingPolicyConfiguration:
      input["StepScalingPolicyConfiguration"] ??
      existing?.StepScalingPolicyConfiguration,
    TargetTrackingScalingPolicyConfiguration:
      input["TargetTrackingScalingPolicyConfiguration"] ??
      existing?.TargetTrackingScalingPolicyConfiguration,
    PredictiveScalingPolicyConfiguration:
      input["PredictiveScalingPolicyConfiguration"] ??
      existing?.PredictiveScalingPolicyConfiguration,
    CreationTime: existing?.CreationTime ?? Date.now() / 1000,
  };

  ctx.store.set(policyKey(arn), policy);
  return { PolicyARN: arn, Alarms: [] };
};

const DescribeScalingPolicies: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const policyNames = Array.isArray(input["PolicyNames"])
    ? (input["PolicyNames"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const resourceId =
    typeof input["ResourceId"] === "string" ? input["ResourceId"] : undefined;
  const dimension =
    typeof input["ScalableDimension"] === "string"
      ? input["ScalableDimension"]
      : undefined;

  const all = ctx.store
    .list<StoredScalingPolicy>()
    .filter((e) => e.key.startsWith("policy/"))
    .map((e) => e.value);

  let filtered = all.filter((p) => p.ServiceNamespace === ns);
  if (policyNames.length > 0) {
    filtered = filtered.filter((p) => policyNames.includes(p.PolicyName));
  }
  if (resourceId !== undefined) {
    filtered = filtered.filter((p) => p.ResourceId === resourceId);
  }
  if (dimension !== undefined) {
    filtered = filtered.filter((p) => p.ScalableDimension === dimension);
  }

  const { items, nextToken } = paginateList(
    filtered,
    input["NextToken"],
    input["MaxResults"],
    10,
    10,
  );

  const policies = items.map((p) => ({
    PolicyARN: p.PolicyARN,
    PolicyName: p.PolicyName,
    ServiceNamespace: p.ServiceNamespace,
    ResourceId: p.ResourceId,
    ScalableDimension: p.ScalableDimension,
    PolicyType: p.PolicyType,
    StepScalingPolicyConfiguration: p.StepScalingPolicyConfiguration,
    TargetTrackingScalingPolicyConfiguration:
      p.TargetTrackingScalingPolicyConfiguration,
    PredictiveScalingPolicyConfiguration:
      p.PredictiveScalingPolicyConfiguration,
    Alarms: [],
    CreationTime: p.CreationTime,
  }));

  return { ScalingPolicies: policies, NextToken: nextToken };
};

const DeleteScalingPolicy: OperationHandler = (input, ctx) => {
  const policyName = requireString(input, "PolicyName");
  const ns = requireString(input, "ServiceNamespace");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");

  const existing = ctx.store
    .list<StoredScalingPolicy>()
    .filter((e) => e.key.startsWith("policy/"))
    .map((e) => e.value)
    .find(
      (p) =>
        p.ServiceNamespace === ns &&
        p.ResourceId === resourceId &&
        p.ScalableDimension === dimension &&
        p.PolicyName === policyName,
    );

  if (existing === undefined) {
    throw awsError(
      "ObjectNotFoundException",
      `No scaling policy found for the specified combination of resource ID, scalable dimension, and namespace.`,
      400,
    );
  }

  ctx.store.delete(policyKey(existing.PolicyARN));
  return {};
};

const PutScheduledAction: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const actionName = requireString(input, "ScheduledActionName");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");

  getTarget(ctx, ns, resourceId, dimension);

  const existing = ctx.store
    .list<StoredScheduledAction>()
    .filter((e) => e.key.startsWith("saction/"))
    .map((e) => e.value)
    .find(
      (a) =>
        a.ServiceNamespace === ns &&
        a.ResourceId === resourceId &&
        a.ScalableDimension === dimension &&
        a.ScheduledActionName === actionName,
    );

  const arn =
    existing?.ScheduledActionARN ??
    scheduledActionArn(ctx.region, ctx.account, ns, resourceId, actionName);

  const action: StoredScheduledAction = {
    ScheduledActionName: actionName,
    ScheduledActionARN: arn,
    ServiceNamespace: ns,
    Schedule:
      typeof input["Schedule"] === "string"
        ? input["Schedule"]
        : existing?.Schedule,
    Timezone:
      typeof input["Timezone"] === "string"
        ? input["Timezone"]
        : existing?.Timezone,
    ResourceId: resourceId,
    ScalableDimension: dimension,
    StartTime:
      typeof input["StartTime"] === "number"
        ? input["StartTime"]
        : existing?.StartTime,
    EndTime:
      typeof input["EndTime"] === "number"
        ? input["EndTime"]
        : existing?.EndTime,
    ScalableTargetAction:
      input["ScalableTargetAction"] ?? existing?.ScalableTargetAction,
    CreationTime: existing?.CreationTime ?? Date.now() / 1000,
  };

  ctx.store.set(scheduledActionKey(arn), action);
  return {};
};

const DescribeScheduledActions: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const actionNames = Array.isArray(input["ScheduledActionNames"])
    ? (input["ScheduledActionNames"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const resourceId =
    typeof input["ResourceId"] === "string" ? input["ResourceId"] : undefined;
  const dimension =
    typeof input["ScalableDimension"] === "string"
      ? input["ScalableDimension"]
      : undefined;

  const all = ctx.store
    .list<StoredScheduledAction>()
    .filter((e) => e.key.startsWith("saction/"))
    .map((e) => e.value);

  let filtered = all.filter((a) => a.ServiceNamespace === ns);
  if (actionNames.length > 0) {
    filtered = filtered.filter((a) =>
      actionNames.includes(a.ScheduledActionName),
    );
  }
  if (resourceId !== undefined) {
    filtered = filtered.filter((a) => a.ResourceId === resourceId);
  }
  if (dimension !== undefined) {
    filtered = filtered.filter((a) => a.ScalableDimension === dimension);
  }

  const { items, nextToken } = paginateList(
    filtered,
    input["NextToken"],
    input["MaxResults"],
  );

  const actions = items.map((a) => ({
    ScheduledActionName: a.ScheduledActionName,
    ScheduledActionARN: a.ScheduledActionARN,
    ServiceNamespace: a.ServiceNamespace,
    Schedule: a.Schedule,
    Timezone: a.Timezone,
    ResourceId: a.ResourceId,
    ScalableDimension: a.ScalableDimension,
    StartTime: a.StartTime,
    EndTime: a.EndTime,
    ScalableTargetAction: a.ScalableTargetAction,
    CreationTime: a.CreationTime,
  }));

  return { ScheduledActions: actions, NextToken: nextToken };
};

const DeleteScheduledAction: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const actionName = requireString(input, "ScheduledActionName");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");

  const existing = ctx.store
    .list<StoredScheduledAction>()
    .filter((e) => e.key.startsWith("saction/"))
    .map((e) => e.value)
    .find(
      (a) =>
        a.ServiceNamespace === ns &&
        a.ResourceId === resourceId &&
        a.ScalableDimension === dimension &&
        a.ScheduledActionName === actionName,
    );

  if (existing === undefined) {
    throw awsError(
      "ObjectNotFoundException",
      `No scheduled action found for the specified combination.`,
      400,
    );
  }

  ctx.store.delete(scheduledActionKey(existing.ScheduledActionARN));
  return {};
};

const DescribeScalingActivities: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const resourceId =
    typeof input["ResourceId"] === "string" ? input["ResourceId"] : undefined;
  const dimension =
    typeof input["ScalableDimension"] === "string"
      ? input["ScalableDimension"]
      : undefined;
  const includeNotScaled = input["IncludeNotScaledActivities"] === true;

  const all = ctx.store
    .list<StoredScalingActivity>()
    .filter((e) => e.key.startsWith("activity/"))
    .map((e) => e.value);

  let filtered = all.filter((a) => a.ServiceNamespace === ns);
  if (!includeNotScaled) {
    filtered = filtered.filter((a) => a.StatusCode !== "NotScaled");
  }
  if (resourceId !== undefined) {
    filtered = filtered.filter((a) => a.ResourceId === resourceId);
  }
  if (dimension !== undefined) {
    filtered = filtered.filter((a) => a.ScalableDimension === dimension);
  }

  const { items, nextToken } = paginateList(
    filtered,
    input["NextToken"],
    input["MaxResults"],
  );

  const activities = items.map((a) => ({
    ActivityId: a.ActivityId,
    ServiceNamespace: a.ServiceNamespace,
    ResourceId: a.ResourceId,
    ScalableDimension: a.ScalableDimension,
    Description: a.Description,
    Cause: a.Cause,
    StartTime: a.StartTime,
    EndTime: a.EndTime,
    StatusCode: a.StatusCode,
    StatusMessage: a.StatusMessage,
  }));

  return { ScalingActivities: activities, NextToken: nextToken };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  getTargetByArn(ctx, arn);
  const tags = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
  const tagMap = Object.fromEntries(tags.map((t) => [t.Key, t.Value]));
  return { Tags: tagMap };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  getTargetByArn(ctx, arn);
  const newTags =
    input["Tags"] !== undefined && typeof input["Tags"] === "object"
      ? Object.entries(input["Tags"] as Record<string, string>).map(
          ([Key, Value]) => ({ Key, Value }),
        )
      : [];
  const existing = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
  const merged = [
    ...existing.filter((e) => !newTags.some((n) => n.Key === e.Key)),
    ...newTags,
  ];
  ctx.store.set(tagKey(arn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceARN");
  getTargetByArn(ctx, arn);
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const existing = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
  const remaining = existing.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(tagKey(arn), remaining);
  return {};
};

const GetPredictiveScalingForecast: OperationHandler = (input, ctx) => {
  const ns = requireString(input, "ServiceNamespace");
  const resourceId = requireString(input, "ResourceId");
  const dimension = requireString(input, "ScalableDimension");
  requireString(input, "PolicyName");

  if (typeof input["StartTime"] !== "number") {
    throw awsError("ValidationException", "StartTime is required.", 400);
  }
  if (typeof input["EndTime"] !== "number") {
    throw awsError("ValidationException", "EndTime is required.", 400);
  }

  getTarget(ctx, ns, resourceId, dimension);

  return {
    LoadForecast: [],
    CapacityForecast: { Timestamps: [], Values: [] },
    UpdateTime: Date.now() / 1000,
  };
};

const applicationAutoscaling: ServiceDefinition = {
  name: "application-autoscaling",
  protocol: "json",
  operations: {
    RegisterScalableTarget,
    DescribeScalableTargets,
    DeregisterScalableTarget,
    PutScalingPolicy,
    DescribeScalingPolicies,
    DeleteScalingPolicy,
    PutScheduledAction,
    DescribeScheduledActions,
    DeleteScheduledAction,
    DescribeScalingActivities,
    ListTagsForResource,
    TagResource,
    UntagResource,
    GetPredictiveScalingForecast,
  },
  model,
} satisfies ServiceDefinition;

export default applicationAutoscaling;
