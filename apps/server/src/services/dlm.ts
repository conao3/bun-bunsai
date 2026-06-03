import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import dlmModel from "../../../../test/vendor/aws-models/dlm.json" with { type: "json" };
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
  Tags: Record<string, unknown>;
  PolicyArn: string;
  DateCreated: string;
  DateModified: string;
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

const policyView = (policy: StoredPolicy): Record<string, unknown> => ({
  PolicyId: policy.PolicyId,
  Description: policy.Description,
  State: policy.State,
  ExecutionRoleArn: policy.ExecutionRoleArn,
  DateCreated: policy.DateCreated,
  DateModified: policy.DateModified,
  PolicyDetails: policy.PolicyDetails,
  Tags: policy.Tags,
  PolicyArn: policy.PolicyArn,
});

const policySummary = (policy: StoredPolicy): Record<string, unknown> => ({
  PolicyId: policy.PolicyId,
  Description: policy.Description,
  State: policy.State,
  Tags: policy.Tags,
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

const CreateLifecyclePolicy: OperationHandler = (input, ctx) => {
  const executionRoleArn = requireString(input, "ExecutionRoleArn");
  const description = requireString(input, "Description");
  const state = requireString(input, "State");
  const id = newPolicyId();
  const now = new Date().toISOString();
  const policy: StoredPolicy = {
    PolicyId: id,
    Description: description,
    State: state,
    ExecutionRoleArn: executionRoleArn,
    PolicyDetails: input["PolicyDetails"] ?? {},
    Tags: recordOrEmpty(input["Tags"]),
    PolicyArn: `arn:aws:dlm:${ctx.region}:${ctx.account}:policy/${id}`,
    DateCreated: now,
    DateModified: now,
  };
  ctx.store.set(policyKey(id), policy);
  return { PolicyId: id };
};

const GetLifecyclePolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PolicyId");
  return { Policy: policyView(requirePolicy(ctx, id)) };
};

const GetLifecyclePolicies: OperationHandler = (input, ctx) => {
  const requested = input["PolicyIds"];
  const ids = Array.isArray(requested)
    ? requested.filter((value): value is string => typeof value === "string")
    : undefined;
  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((entry) => entry.key.startsWith(policyPrefix))
    .map((entry) => entry.value)
    .filter((policy) => ids === undefined || ids.includes(policy.PolicyId))
    .sort((a, b) =>
      a.PolicyId < b.PolicyId ? -1 : a.PolicyId > b.PolicyId ? 1 : 0,
    );
  return { Policies: policies.map(policySummary) };
};

const DeleteLifecyclePolicy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "PolicyId");
  requirePolicy(ctx, id);
  ctx.store.delete(policyKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const dlm = {
  name: "dlm",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "policies") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateLifecyclePolicy";
      if (req.method === "GET") return "GetLifecyclePolicies";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetLifecyclePolicy";
      if (req.method === "DELETE") return "DeleteLifecyclePolicy";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateLifecyclePolicy,
    GetLifecyclePolicy,
    GetLifecyclePolicies,
    DeleteLifecyclePolicy,
  },
  model,
} as const satisfies ServiceDefinition;

export default dlm;
