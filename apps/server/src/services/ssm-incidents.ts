import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssmIncidentsModel from "../../../../test/vendor/aws-models/ssm-incidents.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ssmIncidentsModel);

const responsePlanPrefix = "response-plan:" as const;

type StoredResponsePlan = {
  arn: string;
  name: string;
  displayName: string | undefined;
  incidentTemplate: Record<string, unknown>;
  chatChannel: Record<string, unknown> | undefined;
  engagements: unknown[];
  actions: unknown[];
  integrations: unknown[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const requireRecord = (
  input: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const value = recordOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const responsePlanKey = (arn: string): string => `${responsePlanPrefix}${arn}`;

const buildArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:ssm-incidents::${ctx.account}:response-plan/${name}`;

const summaryView = (plan: StoredResponsePlan): Record<string, unknown> => ({
  arn: plan.arn,
  name: plan.name,
  displayName: plan.displayName,
});

const CreateResponsePlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const incidentTemplate = requireRecord(input, "incidentTemplate");
  const arn = buildArn(ctx, name);
  const existing = ctx.store.get<StoredResponsePlan>(responsePlanKey(arn));
  if (existing !== undefined) {
    throw awsError(
      "ConflictException",
      `Response plan ${name} already exists.`,
      409,
    );
  }
  const plan: StoredResponsePlan = {
    arn,
    name,
    displayName: stringOrUndefined(input.displayName),
    incidentTemplate,
    chatChannel: recordOrUndefined(input.chatChannel),
    engagements: arrayOrEmpty(input.engagements),
    actions: arrayOrEmpty(input.actions),
    integrations: arrayOrEmpty(input.integrations),
  };
  ctx.store.set(responsePlanKey(arn), plan);
  return { arn };
};

const GetResponsePlan: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  const plan = ctx.store.get<StoredResponsePlan>(responsePlanKey(arn));
  if (plan === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Response plan not found.`,
      404,
    );
  }
  return {
    arn: plan.arn,
    name: plan.name,
    displayName: plan.displayName,
    incidentTemplate: plan.incidentTemplate,
    chatChannel: plan.chatChannel,
    engagements: plan.engagements,
    actions: plan.actions,
    integrations: plan.integrations,
  };
};

const ListResponsePlans: OperationHandler = (_input, ctx) => {
  const plans = ctx.store
    .list<StoredResponsePlan>()
    .filter((entry) => entry.key.startsWith(responsePlanPrefix))
    .map((entry) => summaryView(entry.value));
  return { responsePlanSummaries: plans };
};

const DeleteResponsePlan: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "arn");
  ctx.store.delete(responsePlanKey(arn));
  return {};
};

const ssmIncidents = {
  name: "ssm-incidents",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.path === "/createResponsePlan" && req.method === "POST") {
      return "CreateResponsePlan";
    }
    if (req.path === "/getResponsePlan" && req.method === "GET") {
      return "GetResponsePlan";
    }
    if (req.path === "/listResponsePlans" && req.method === "POST") {
      return "ListResponsePlans";
    }
    if (req.path === "/deleteResponsePlan" && req.method === "POST") {
      return "DeleteResponsePlan";
    }
    return undefined;
  },
  operations: {
    CreateResponsePlan,
    GetResponsePlan,
    ListResponsePlans,
    DeleteResponsePlan,
  },
  model,
} as const satisfies ServiceDefinition;

export default ssmIncidents;
