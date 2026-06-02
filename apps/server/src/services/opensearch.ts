import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import opensearchModel from "../../../../test/vendor/aws-models/opensearch.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(opensearchModel);

type StoredDomain = {
  domainId: string;
  domainName: string;
  arn: string;
  engineVersion: string;
  endpoint: string;
  clusterConfig: Record<string, unknown>;
  ebsOptions: Record<string, unknown>;
  accessPolicies: string | undefined;
  ipAddressType: string;
  advancedOptions: Record<string, string>;
};

const domainKey = (name: string): string => `domain/${name}`;

const hex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const advancedOptionsFromInput = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
};

const domainStatusView = (domain: StoredDomain): Record<string, unknown> => ({
  DomainId: domain.domainId,
  DomainName: domain.domainName,
  ARN: domain.arn,
  Created: true,
  Deleted: false,
  Endpoint: domain.endpoint,
  Processing: false,
  UpgradeProcessing: false,
  EngineVersion: domain.engineVersion,
  ClusterConfig: domain.clusterConfig,
  EBSOptions: domain.ebsOptions,
  AccessPolicies: domain.accessPolicies,
  IPAddressType: domain.ipAddressType,
  AdvancedOptions: domain.advancedOptions,
});

const optionStatus = (value: unknown): Record<string, unknown> => ({
  Options: value,
  Status: {
    CreationDate: Math.floor(Date.now() / 1000),
    UpdateDate: Math.floor(Date.now() / 1000),
    UpdateVersion: 1,
    State: "Active",
    PendingDeletion: false,
  },
});

const domainConfigView = (domain: StoredDomain): Record<string, unknown> => ({
  EngineVersion: optionStatus(domain.engineVersion),
  ClusterConfig: optionStatus(domain.clusterConfig),
  EBSOptions: optionStatus(domain.ebsOptions),
  AccessPolicies: optionStatus(domain.accessPolicies),
  IPAddressType: optionStatus(domain.ipAddressType),
  AdvancedOptions: optionStatus(domain.advancedOptions),
});

const requireDomain = (
  ctx: ServiceContext,
  domainName: string,
): StoredDomain => {
  const domain = ctx.store.get<StoredDomain>(domainKey(domainName));
  if (domain === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Domain not found: ${domainName}`,
      409,
    );
  }
  return domain;
};

const CreateDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  if (ctx.store.get<StoredDomain>(domainKey(domainName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Domain already exists: ${domainName}`,
      409,
    );
  }
  const domainId = `${ctx.account}/${domainName}`;
  const domain: StoredDomain = {
    domainId,
    domainName,
    arn: `arn:aws:es:${ctx.region}:${ctx.account}:domain/${domainName}`,
    engineVersion:
      stringOrUndefined(input["EngineVersion"]) ?? "OpenSearch_2.11",
    endpoint: `${domainName}-${hex(6)}.${ctx.region}.es.amazonaws.com`,
    clusterConfig: recordOrEmpty(input["ClusterConfig"]),
    ebsOptions: recordOrEmpty(input["EBSOptions"]),
    accessPolicies: stringOrUndefined(input["AccessPolicies"]),
    ipAddressType: stringOrUndefined(input["IPAddressType"]) ?? "ipv4",
    advancedOptions: advancedOptionsFromInput(input["AdvancedOptions"]),
  };
  ctx.store.set(domainKey(domainName), domain);
  return { DomainStatus: domainStatusView(domain) };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  return { DomainStatus: domainStatusView(domain) };
};

const DescribeDomains: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["DomainNames"])
    ? (input["DomainNames"] as unknown[]).filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const statuses = names
    .map((name) => ctx.store.get<StoredDomain>(domainKey(name)))
    .filter((domain): domain is StoredDomain => domain !== undefined)
    .map(domainStatusView);
  return { DomainStatusList: statuses };
};

const ListDomainNames: OperationHandler = (_input, ctx) => {
  const names = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith("domain/"))
    .map((entry) => ({
      DomainName: entry.value.domainName,
      EngineType: entry.value.engineVersion.startsWith("Elasticsearch")
        ? "Elasticsearch"
        : "OpenSearch",
    }));
  return { DomainNames: names };
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  ctx.store.delete(domainKey(domainName));
  return {
    DomainStatus: {
      ...domainStatusView(domain),
      Deleted: true,
      Processing: true,
    },
  };
};

const UpdateDomainConfig: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  if (input["ClusterConfig"] !== undefined) {
    domain.clusterConfig = recordOrEmpty(input["ClusterConfig"]);
  }
  if (input["EBSOptions"] !== undefined) {
    domain.ebsOptions = recordOrEmpty(input["EBSOptions"]);
  }
  if (input["AccessPolicies"] !== undefined) {
    domain.accessPolicies = stringOrUndefined(input["AccessPolicies"]);
  }
  if (input["IPAddressType"] !== undefined) {
    domain.ipAddressType = stringOrUndefined(input["IPAddressType"]) ?? "ipv4";
  }
  if (input["AdvancedOptions"] !== undefined) {
    domain.advancedOptions = advancedOptionsFromInput(input["AdvancedOptions"]);
  }
  ctx.store.set(domainKey(domainName), domain);
  return { DomainConfig: domainConfigView(domain) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const opensearch = {
  name: "es",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "2021-01-01") return undefined;
    if (parts[1] === "domain" && parts.length === 2) {
      if (req.method === "GET") return "ListDomainNames";
      return undefined;
    }
    if (parts[1] !== "opensearch") return undefined;
    if (parts[2] === "domain") {
      if (parts.length === 3 && req.method === "POST") return "CreateDomain";
      if (parts.length === 4) {
        if (req.method === "GET") return "DescribeDomain";
        if (req.method === "DELETE") return "DeleteDomain";
        return undefined;
      }
      if (
        parts.length === 5 &&
        parts[4] === "config" &&
        req.method === "POST"
      ) {
        return "UpdateDomainConfig";
      }
      return undefined;
    }
    if (parts[2] === "domain-info" && parts.length === 3) {
      if (req.method === "POST") return "DescribeDomains";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateDomain,
    DescribeDomain,
    DescribeDomains,
    ListDomainNames,
    DeleteDomain,
    UpdateDomainConfig,
  },
  model,
} as const satisfies ServiceDefinition;

export default opensearch;
