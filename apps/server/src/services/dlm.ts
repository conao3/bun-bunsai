import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import dlmModel from "../../models/dlm.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(dlmModel);

const policyPrefix = "policy:" as const;

type StoredPolicy = {
  PolicyId: string;
  Description: string;
  State: string;
  ExecutionRoleArn: string;
  PolicyDetails: unknown;
  Tags: Record<string, string>;
  PolicyArn: string;
  DateCreated: string;
  DateModified: string;
  PolicyType: string;
  DefaultPolicy: boolean;
  DefaultPolicyType: string | undefined;
  StatusMessage: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidRequest", `${field} is required.`, 400);
  }
  return value;
};

const newPolicyId = (): string =>
  `policy-${crypto.randomUUID().replaceAll("-", "").slice(0, 17)}`;

const policyKey = (id: string): string => `${policyPrefix}${id}`;

const tagKey = (arn: string): string => `tag:${arn}`;

const policyView = (policy: StoredPolicy): Record<string, unknown> => ({
  PolicyId: policy.PolicyId,
  Description: policy.Description,
  State: policy.State,
  StatusMessage: policy.StatusMessage,
  ExecutionRoleArn: policy.ExecutionRoleArn,
  DateCreated: policy.DateCreated,
  DateModified: policy.DateModified,
  PolicyDetails: policy.PolicyDetails,
  Tags: policy.Tags,
  PolicyArn: policy.PolicyArn,
  DefaultPolicy: policy.DefaultPolicy,
});

const policySummary = (policy: StoredPolicy): Record<string, unknown> => ({
  PolicyId: policy.PolicyId,
  Description: policy.Description,
  State: policy.State,
  Tags: policy.Tags,
  PolicyType: policy.PolicyType,
  DefaultPolicy: policy.DefaultPolicy,
  PolicyArn: policy.PolicyArn,
});

const requirePolicy = (ctx: ServiceContext, id: string): StoredPolicy => {
  const stored = ctx.store.get<StoredPolicy>(policyKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found for ID ${id}.`,
      404,
    );
  }
  return stored;
};

const arnToPolicyId = (arn: string): string | undefined => {
  const last = arn.split(":").pop();
  if (!last) return undefined;
  const parts = last.split("/");
  if (parts.length === 2 && parts[0] === "policy") return parts[1];
  return undefined;
};

const requirePolicyByArn = (ctx: ServiceContext, arn: string): StoredPolicy => {
  const id = arnToPolicyId(arn);
  if (id === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found for ARN ${arn}.`,
      404,
    );
  }
  return requirePolicy(ctx, id);
};

const toStringRecord = (r: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
};

const CreateLifecyclePolicy: OperationHandler = (input, ctx) => {
  const executionRoleArn = requireString(input, "ExecutionRoleArn");
  const description = requireString(input, "Description");
  const state = requireString(input, "State");
  const id = newPolicyId();
  const now = new Date().toISOString();
  const details = recordOrEmpty(input["PolicyDetails"]);
  const policyType =
    stringOrUndefined(details["PolicyType"]) ?? "EBS_SNAPSHOT_MANAGEMENT";
  const defaultPolicyTypeInput = stringOrUndefined(input["DefaultPolicy"]);
  const isDefaultPolicy = defaultPolicyTypeInput !== undefined;
  const arn = `arn:aws:dlm:${ctx.region}:${ctx.account}:policy/${id}`;
  const creationTags = toStringRecord(recordOrEmpty(input["Tags"]));
  const policy: StoredPolicy = {
    PolicyId: id,
    Description: description,
    State: state,
    ExecutionRoleArn: executionRoleArn,
    PolicyDetails: input["PolicyDetails"] ?? {},
    Tags: creationTags,
    PolicyArn: arn,
    DateCreated: now,
    DateModified: now,
    PolicyType: policyType,
    DefaultPolicy: isDefaultPolicy,
    DefaultPolicyType: defaultPolicyTypeInput,
    StatusMessage: undefined,
  };
  ctx.store.set(policyKey(id), policy);
  ctx.store.set(tagKey(arn), { ...creationTags });
  return { PolicyId: id };
};

const GetLifecyclePolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PolicyId");
  return { Policy: policyView(requirePolicy(ctx, id)) };
};

const matchTagFilters = (
  filters: string[],
  tags: Array<{ Key?: string; Value?: string }>,
): boolean => {
  const tagSet = new Set(
    tags
      .filter((t) => typeof t.Key === "string" && typeof t.Value === "string")
      .map((t) => `${t.Key}=${t.Value}`),
  );
  return filters.some((f) => tagSet.has(f));
};

const GetLifecyclePolicies: OperationHandler = (input, ctx) => {
  const requested = input["PolicyIds"];
  const ids = Array.isArray(requested)
    ? requested.filter((value): value is string => typeof value === "string")
    : undefined;
  const stateFilter = stringOrUndefined(input["State"]);
  const resourceTypeFilter = Array.isArray(input["ResourceTypes"])
    ? input["ResourceTypes"].filter((v): v is string => typeof v === "string")
    : undefined;
  const targetTagFilter = Array.isArray(input["TargetTags"])
    ? input["TargetTags"].filter((v): v is string => typeof v === "string")
    : undefined;
  const tagsToAddFilter = Array.isArray(input["TagsToAdd"])
    ? input["TagsToAdd"].filter((v): v is string => typeof v === "string")
    : undefined;
  const defaultPolicyTypeFilter = stringOrUndefined(input["DefaultPolicyType"]);

  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((entry) => entry.key.startsWith(policyPrefix))
    .map((entry) => entry.value)
    .filter((p) => ids === undefined || ids.includes(p.PolicyId))
    .filter((p) => stateFilter === undefined || p.State === stateFilter)
    .filter((p) => {
      if (resourceTypeFilter === undefined) return true;
      const d = p.PolicyDetails as Record<string, unknown>;
      const rt = Array.isArray(d["ResourceTypes"])
        ? (d["ResourceTypes"] as string[])
        : [];
      return resourceTypeFilter.some((r) => rt.includes(r));
    })
    .filter((p) => {
      if (targetTagFilter === undefined) return true;
      const d = p.PolicyDetails as Record<string, unknown>;
      const tt = Array.isArray(d["TargetTags"])
        ? (d["TargetTags"] as Array<{ Key?: string; Value?: string }>)
        : [];
      return matchTagFilters(targetTagFilter, tt);
    })
    .filter((p) => {
      if (tagsToAddFilter === undefined) return true;
      const d = p.PolicyDetails as Record<string, unknown>;
      const schedules = Array.isArray(d["Schedules"])
        ? (d["Schedules"] as Array<Record<string, unknown>>)
        : [];
      const allTagsToAdd = schedules.flatMap((s) =>
        Array.isArray(s["TagsToAdd"])
          ? (s["TagsToAdd"] as Array<{ Key?: string; Value?: string }>)
          : [],
      );
      return matchTagFilters(tagsToAddFilter, allTagsToAdd);
    })
    .filter((p) => {
      if (defaultPolicyTypeFilter === undefined) return true;
      if (defaultPolicyTypeFilter === "ALL") return p.DefaultPolicy === true;
      return (
        p.DefaultPolicy === true &&
        p.DefaultPolicyType === defaultPolicyTypeFilter
      );
    })
    .sort((a, b) =>
      a.PolicyId < b.PolicyId ? -1 : a.PolicyId > b.PolicyId ? 1 : 0,
    );
  return { Policies: policies.map(policySummary) };
};

const DeleteLifecyclePolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PolicyId");
  const policy = requirePolicy(ctx, id);
  ctx.store.delete(policyKey(id));
  ctx.store.delete(tagKey(policy.PolicyArn));
  return {};
};

const UpdateLifecyclePolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PolicyId");
  const policy = requirePolicy(ctx, id);
  const now = new Date().toISOString();
  const executionRoleArn = stringOrUndefined(input["ExecutionRoleArn"]);
  const state = stringOrUndefined(input["State"]);
  const description = stringOrUndefined(input["Description"]);
  const updated: StoredPolicy = {
    ...policy,
    DateModified: now,
    ...(executionRoleArn !== undefined
      ? { ExecutionRoleArn: executionRoleArn }
      : {}),
    ...(state !== undefined ? { State: state } : {}),
    ...(description !== undefined ? { Description: description } : {}),
    ...(input["PolicyDetails"] !== undefined
      ? { PolicyDetails: input["PolicyDetails"] }
      : {}),
  };
  ctx.store.set(policyKey(id), updated);
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  requirePolicyByArn(ctx, arn);
  const newTags = recordOrEmpty(input["Tags"]) as Record<string, string>;
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  ctx.store.set(tagKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  requirePolicyByArn(ctx, arn);
  const keys = Array.isArray(input["TagKeys"])
    ? input["TagKeys"].filter((k): k is string => typeof k === "string")
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  const updated = { ...existing };
  for (const k of keys) delete updated[k];
  ctx.store.set(tagKey(arn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  requirePolicyByArn(ctx, arn);
  const tags = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  return { Tags: tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const dlm = {
  name: "dlm",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "policies") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateLifecyclePolicy";
        if (req.method === "GET") return "GetLifecyclePolicies";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetLifecyclePolicy";
        if (req.method === "DELETE") return "DeleteLifecyclePolicy";
        if (req.method === "PATCH") return "UpdateLifecyclePolicy";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "tags" && parts.length >= 2) {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateLifecyclePolicy,
    GetLifecyclePolicy,
    GetLifecyclePolicies,
    DeleteLifecyclePolicy,
    UpdateLifecyclePolicy,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default dlm;
