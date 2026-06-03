import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import fmsModel from "../../../../test/vendor/aws-models/fms.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(fmsModel);

type StoredPolicy = Record<string, unknown> & {
  PolicyId: string;
  PolicyName: string;
  PolicyUpdateToken: string;
};

const policyKey = (policyId: string): string => `policy/${policyId}`;

const policyArn = (ctx: ServiceContext, policyId: string): string =>
  `arn:aws:fms:${ctx.region}:${ctx.account}:policy/${policyId}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidInputException", `${key} is required.`, 400);
  }
  return value;
};

const requirePolicy = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const policy = input["Policy"];
  if (typeof policy !== "object" || policy === null) {
    throw awsError("InvalidInputException", "Policy is required.", 400);
  }
  return policy as Record<string, unknown>;
};

const loadPolicy = (ctx: ServiceContext, policyId: string): StoredPolicy => {
  const policy = ctx.store.get<StoredPolicy>(policyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found: ${policyId}`,
      404,
    );
  }
  return policy;
};

const toSummary = (policy: StoredPolicy): Record<string, unknown> => {
  const data = policy["SecurityServicePolicyData"] as
    | Record<string, unknown>
    | undefined;
  return {
    PolicyArn: policy["PolicyArn"],
    PolicyId: policy["PolicyId"],
    PolicyName: policy["PolicyName"],
    ResourceType: policy["ResourceType"],
    SecurityServiceType: data?.["Type"],
    RemediationEnabled: policy["RemediationEnabled"],
    DeleteUnusedFMManagedResources:
      policy["DeleteUnusedFMManagedResources"] ?? false,
    PolicyStatus: policy["PolicyStatus"] ?? "ACTIVE",
  };
};

const PutPolicy: OperationHandler = (input, ctx) => {
  const requested = requirePolicy(input as Record<string, unknown>);
  const existingId =
    typeof requested["PolicyId"] === "string" && requested["PolicyId"] !== ""
      ? (requested["PolicyId"] as string)
      : crypto.randomUUID();
  const updateToken = crypto.randomUUID();
  const policy: StoredPolicy = {
    ...requested,
    PolicyId: existingId,
    PolicyName: requireString(requested, "PolicyName"),
    PolicyUpdateToken: updateToken,
    PolicyArn: policyArn(ctx, existingId),
  };
  ctx.store.set(policyKey(existingId), policy);
  return { Policy: policy, PolicyArn: policyArn(ctx, existingId) };
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  const policy = loadPolicy(ctx, policyId);
  return { Policy: policy, PolicyArn: policyArn(ctx, policyId) };
};

const ListPolicies: OperationHandler = (_input, ctx) => {
  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((entry) => entry.key.startsWith("policy/"))
    .map((entry) => toSummary(entry.value));
  return { PolicyList: policies };
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  loadPolicy(ctx, policyId);
  ctx.store.delete(policyKey(policyId));
  return {};
};

const fms = {
  name: "fms",
  protocol: "json",
  operations: {
    PutPolicy,
    GetPolicy,
    ListPolicies,
    DeletePolicy,
  },
  model,
} as const satisfies ServiceDefinition;

export default fms;
