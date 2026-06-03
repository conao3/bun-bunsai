import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codeartifactModel from "../../../../test/vendor/aws-models/codeartifact.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codeartifactModel);

const domainPrefix = "domain:" as const;

type StoredDomain = {
  name: string;
  owner: string;
  arn: string;
  status: string;
  createdTime: number;
  encryptionKey: string | undefined;
  repositoryCount: number;
  assetSizeBytes: number;
  s3BucketArn: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

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

const domainKey = (name: string): string => `${domainPrefix}${name}`;

const domainArn = (account: string, region: string, name: string): string =>
  `arn:aws:codeartifact:${region}:${account}:domain/${name}`;

const domainView = (domain: StoredDomain): Record<string, unknown> => ({
  name: domain.name,
  owner: domain.owner,
  arn: domain.arn,
  status: domain.status,
  createdTime: new Date(domain.createdTime),
  encryptionKey: domain.encryptionKey,
  repositoryCount: domain.repositoryCount,
  assetSizeBytes: domain.assetSizeBytes,
  s3BucketArn: domain.s3BucketArn,
});

const domainSummary = (domain: StoredDomain): Record<string, unknown> => ({
  name: domain.name,
  owner: domain.owner,
  arn: domain.arn,
  status: domain.status,
  createdTime: new Date(domain.createdTime),
  encryptionKey: domain.encryptionKey,
});

const requireDomain = (ctx: ServiceContext, name: string): StoredDomain => {
  const stored = ctx.store.get<StoredDomain>(domainKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Domain ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const CreateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "domain");
  if (ctx.store.get<StoredDomain>(domainKey(name)) !== undefined) {
    throw awsError("ConflictException", `Domain ${name} already exists.`, 409);
  }
  const domain: StoredDomain = {
    name,
    owner: ctx.account,
    arn: domainArn(ctx.account, ctx.region, name),
    status: "Active",
    createdTime: Date.now(),
    encryptionKey: stringOrUndefined(input["encryptionKey"]),
    repositoryCount: 0,
    assetSizeBytes: 0,
    s3BucketArn: `arn:aws:s3:::bunsai-codeartifact-${name}`,
  };
  ctx.store.set(domainKey(name), domain);
  return { domain: domainView(domain) };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "domain");
  return { domain: domainView(requireDomain(ctx, name)) };
};

const ListDomains: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 1000;
  const domains = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith(domainPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { domains: domains.slice(0, max).map(domainSummary) };
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "domain");
  const domain = requireDomain(ctx, name);
  ctx.store.delete(domainKey(name));
  return { domain: domainView(domain) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const codeartifact = {
  name: "codeartifact",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1") return undefined;
    if (parts.length === 2 && parts[1] === "domain") {
      if (req.method === "POST") return "CreateDomain";
      if (req.method === "GET") return "DescribeDomain";
      if (req.method === "DELETE") return "DeleteDomain";
      return undefined;
    }
    if (parts.length === 2 && parts[1] === "domains") {
      if (req.method === "POST") return "ListDomains";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateDomain,
    DescribeDomain,
    ListDomains,
    DeleteDomain,
  },
  model,
} as const satisfies ServiceDefinition;

export default codeartifact;
