import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import swfModel from "../../../../test/vendor/aws-models/swf.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(swfModel);

type StoredDomain = {
  name: string;
  status: string;
  description: string | undefined;
  retentionPeriodInDays: string;
  arn: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("ValidationException", `${field} is a required field.`, 400);
};

const domainKey = (name: string): string => `domain#${name}`;

const domainArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:swf:${ctx.region}:${ctx.account}:/domain/${name}`;

const retentionOf = (input: Record<string, unknown>): string => {
  const value = input["workflowExecutionRetentionPeriodInDays"];
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number") return String(value);
  throw awsError(
    "ValidationException",
    "workflowExecutionRetentionPeriodInDays is a required field.",
    400,
  );
};

const requireDomain = (ctx: ServiceContext, name: string): StoredDomain => {
  const domain = ctx.store.get<StoredDomain>(domainKey(name));
  if (domain === undefined) {
    throw awsError("UnknownResourceFault", `Unknown domain: ${name}`, 400);
  }
  return domain;
};

const RegisterDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const retentionPeriodInDays = retentionOf(input);
  const existing = ctx.store.get<StoredDomain>(domainKey(name));
  if (existing !== undefined && existing.status === "REGISTERED") {
    throw awsError(
      "DomainAlreadyExistsFault",
      `Domain already exists: ${name}`,
      400,
    );
  }
  const domain: StoredDomain = {
    name,
    status: "REGISTERED",
    description: stringOrUndefined(input["description"]),
    retentionPeriodInDays,
    arn: domainArnOf(ctx, name),
  };
  ctx.store.set(domainKey(name), domain);
  return {};
};

const ListDomains: OperationHandler = (input, ctx) => {
  const registrationStatus = requireString(input, "registrationStatus");
  const domainInfos = ctx.store
    .list<StoredDomain>()
    .map((entry) => entry.value)
    .filter((domain) => domain.status === registrationStatus)
    .map((domain) => ({
      name: domain.name,
      status: domain.status,
      description: domain.description,
      arn: domain.arn,
    }));
  return { domainInfos };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const domain = requireDomain(ctx, name);
  return {
    domainInfo: {
      name: domain.name,
      status: domain.status,
      description: domain.description,
      arn: domain.arn,
    },
    configuration: {
      workflowExecutionRetentionPeriodInDays: domain.retentionPeriodInDays,
    },
  };
};

const DeprecateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const domain = requireDomain(ctx, name);
  domain.status = "DEPRECATED";
  ctx.store.set(domainKey(name), domain);
  return {};
};

const swf: ServiceDefinition = {
  name: "swf",
  protocol: "json",
  operations: {
    RegisterDomain,
    ListDomains,
    DescribeDomain,
    DeprecateDomain,
  },
  model,
} as const;

export default swf;
