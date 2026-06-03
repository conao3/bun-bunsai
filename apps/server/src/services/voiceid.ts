import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import voiceidModel from "../../../../test/vendor/aws-models/voiceid.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(voiceidModel);

const domainPrefix = "domain:" as const;

type StoredDomain = {
  DomainId: string;
  Arn: string;
  Name: string;
  Description: string | undefined;
  DomainStatus: string;
  ServerSideEncryptionConfiguration: Record<string, unknown>;
  CreatedAt: number;
  UpdatedAt: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

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

const domainKey = (id: string): string => `${domainPrefix}${id}`;

const domainArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:voiceid:${ctx.region}:${ctx.account}:domain/${id}`;

const nowSeconds = (): number => Date.now() / 1000;

const requireDomain = (ctx: ServiceContext, id: string): StoredDomain => {
  const domain = ctx.store.get<StoredDomain>(domainKey(id));
  if (domain === undefined) {
    throw awsError("ResourceNotFoundException", `Domain ${id} not found.`, 404);
  }
  return domain;
};

const domainView = (domain: StoredDomain): Record<string, unknown> => ({
  DomainId: domain.DomainId,
  Arn: domain.Arn,
  Name: domain.Name,
  Description: domain.Description,
  DomainStatus: domain.DomainStatus,
  ServerSideEncryptionConfiguration: domain.ServerSideEncryptionConfiguration,
  CreatedAt: domain.CreatedAt,
  UpdatedAt: domain.UpdatedAt,
});

const CreateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const sse = requireRecord(input, "ServerSideEncryptionConfiguration");
  requireString(sse, "KmsKeyId");
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const now = nowSeconds();
  const domain: StoredDomain = {
    DomainId: id,
    Arn: domainArn(ctx, id),
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DomainStatus: "ACTIVE",
    ServerSideEncryptionConfiguration: sse,
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(domainKey(id), domain);
  return { Domain: domainView(domain) };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  const domain = requireDomain(ctx, id);
  return { Domain: domainView(domain) };
};

const ListDomains: OperationHandler = (_input, ctx) => {
  const domains = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith(domainPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
    );
  return { DomainSummaries: domains.map(domainView) };
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  requireDomain(ctx, id);
  ctx.store.delete(domainKey(id));
  return {};
};

const voiceid = {
  name: "voiceid",
  protocol: "json",
  operations: {
    CreateDomain,
    DescribeDomain,
    ListDomains,
    DeleteDomain,
  },
  model,
} as const satisfies ServiceDefinition;

export default voiceid;
