import type {
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cloudfrontModel from "../../models/cloudfront.json" with { type: "json" };

const model = loadServiceModel(cloudfrontModel);

const apiPrefix = "/2020-05-31/distribution";
const cachePolicyPrefix = "/2020-05-31/cache-policy";
const publicKeyPrefix = "/2020-05-31/public-key";
const oaiPrefix = "/2020-05-31/origin-access-identity/cloudfront";
const oacPrefix = "/2020-05-31/origin-access-control";

const cachePolicyKey = "cachepolicy#";
const publicKeyKey = "publickey#";
const oaiKey = "oai#";
const oacKey = "oac#";
const invalidationKey = "invalidation#";
const monsubKey = "monsub#";
const anycastIpListKey = "anycastiplist#";
const connectionGroupKey = "connectiongroup#";
const connectionFunctionKey = "connectionfunction#";
const continuousDeploymentPolicyKey = "cdpolicy#";
const distributionTenantKey = "disttenant#";
const tenantInvalidationKey = "tenantinvalidation#";
const fieldLevelEncryptionKey = "fle#";
const fieldLevelEncryptionProfileKey = "flep#";
const keyGroupKey = "keygroup#";
const tagKey = "tag#";

type StoredDistribution = {
  id: string;
  arn: string;
  status: string;
  lastModifiedTime: string;
  domainName: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredCachePolicy = {
  id: string;
  lastModifiedTime: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredPublicKey = {
  id: string;
  createdTime: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredOAI = {
  id: string;
  s3CanonicalUserId: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredOAC = {
  id: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredInvalidation = {
  id: string;
  createTime: string;
  batch: Record<string, unknown>;
};

type StoredMonitoringSub = {
  config: Record<string, unknown>;
};

type StoredAnycastIpList = {
  id: string;
  name: string;
  arn: string;
  status: string;
  lastModifiedTime: string;
  etag: string;
  ipCount: number;
  anycastIps: string[];
};

type StoredConnectionGroup = {
  id: string;
  name: string;
  arn: string;
  status: string;
  createdTime: string;
  lastModifiedTime: string;
  etag: string;
  ipv6Enabled: boolean;
  anycastIpListId: string;
  enabled: boolean;
  routingEndpoint: string;
};

type StoredConnectionFunction = {
  id: string;
  name: string;
  arn: string;
  status: string;
  createdTime: string;
  lastModifiedTime: string;
  etag: string;
  stage: string;
  functionCode: string;
  comment: string;
};

type StoredContinuousDeploymentPolicy = {
  id: string;
  lastModifiedTime: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredDistributionTenant = {
  id: string;
  name: string;
  arn: string;
  distributionId: string;
  domains: string[];
  status: string;
  createdTime: string;
  lastModifiedTime: string;
  etag: string;
  connectionGroupId: string;
  customizations: Record<string, unknown>;
  parameters: unknown[];
  enabled: boolean;
};

type StoredFieldLevelEncryption = {
  id: string;
  lastModifiedTime: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredFieldLevelEncryptionProfile = {
  id: string;
  name: string;
  lastModifiedTime: string;
  etag: string;
  config: Record<string, unknown>;
};

type StoredKeyGroup = {
  id: string;
  lastModifiedTime: string;
  etag: string;
  config: Record<string, unknown>;
};

const generateId = (prefix: string): string => {
  let out = prefix;
  for (let i = 0; i < 13; i += 1) {
    out += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
      Math.floor(Math.random() * 36)
    ];
  }
  return out;
};

const asRecord = (raw: unknown): Record<string, unknown> =>
  typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : {};

const cachePolicyView = (entry: StoredCachePolicy) => ({
  Id: entry.id,
  LastModifiedTime: entry.lastModifiedTime,
  CachePolicyConfig: entry.config,
});

const publicKeyView = (entry: StoredPublicKey) => ({
  Id: entry.id,
  CreatedTime: entry.createdTime,
  PublicKeyConfig: entry.config,
});

const oaiView = (entry: StoredOAI) => ({
  Id: entry.id,
  S3CanonicalUserId: entry.s3CanonicalUserId,
  CloudFrontOriginAccessIdentityConfig: entry.config,
});

const oacView = (entry: StoredOAC) => ({
  Id: entry.id,
  OriginAccessControlConfig: entry.config,
});

const oacSummaryView = (entry: StoredOAC) => {
  const cfg = entry.config;
  return {
    Id: entry.id,
    Description: cfg["Description"] ?? "",
    Name: cfg["Name"] ?? "",
    SigningProtocol: cfg["SigningProtocol"] ?? "sigv4",
    SigningBehavior: cfg["SigningBehavior"] ?? "always",
    OriginAccessControlOriginType: cfg["OriginAccessControlOriginType"] ?? "s3",
  };
};

const invalidationView = (entry: StoredInvalidation) => ({
  Id: entry.id,
  Status: "Completed",
  CreateTime: entry.createTime,
  InvalidationBatch: {
    Paths: entry.batch["Paths"] ?? { Quantity: 0 },
    CallerReference:
      typeof entry.batch["CallerReference"] === "string"
        ? entry.batch["CallerReference"]
        : "",
  },
});

const anycastIpListView = (entry: StoredAnycastIpList) => ({
  Id: entry.id,
  Name: entry.name,
  ARN: entry.arn,
  Status: entry.status,
  LastModifiedTime: entry.lastModifiedTime,
  IpCount: entry.ipCount,
  AnycastIps: entry.anycastIps,
});

const connectionGroupView = (entry: StoredConnectionGroup) => ({
  Id: entry.id,
  Name: entry.name,
  ARN: entry.arn,
  Status: entry.status,
  CreatedTime: entry.createdTime,
  LastModifiedTime: entry.lastModifiedTime,
  Ipv6Enabled: entry.ipv6Enabled,
  AnycastIpListId: entry.anycastIpListId,
  Enabled: entry.enabled,
  RoutingEndpoint: entry.routingEndpoint,
});

const connectionFunctionView = (entry: StoredConnectionFunction) => ({
  Name: entry.name,
  Id: entry.id,
  ConnectionFunctionArn: entry.arn,
  Status: entry.status,
  Stage: entry.stage,
  CreatedTime: entry.createdTime,
  LastModifiedTime: entry.lastModifiedTime,
  ConnectionFunctionConfig: {
    Comment: entry.comment,
    Runtime: "cloudfront-js-2.0",
  },
});

const continuousDeploymentPolicyView = (
  entry: StoredContinuousDeploymentPolicy,
) => ({
  Id: entry.id,
  LastModifiedTime: entry.lastModifiedTime,
  ContinuousDeploymentPolicyConfig: entry.config,
});

const distributionTenantView = (entry: StoredDistributionTenant) => ({
  Id: entry.id,
  Name: entry.name,
  ARN: entry.arn,
  DistributionId: entry.distributionId,
  Domains: entry.domains.map((d) => ({ Domain: d })),
  Status: entry.status,
  CreatedTime: entry.createdTime,
  LastModifiedTime: entry.lastModifiedTime,
  ConnectionGroupId: entry.connectionGroupId,
  Customizations: entry.customizations,
  Parameters: entry.parameters,
  Enabled: entry.enabled,
});

const fieldLevelEncryptionView = (entry: StoredFieldLevelEncryption) => ({
  Id: entry.id,
  LastModifiedTime: entry.lastModifiedTime,
  FieldLevelEncryptionConfig: entry.config,
});

const fieldLevelEncryptionProfileView = (
  entry: StoredFieldLevelEncryptionProfile,
) => ({
  Id: entry.id,
  Name: entry.name,
  LastModifiedTime: entry.lastModifiedTime,
  FieldLevelEncryptionProfileConfig: entry.config,
});

const keyGroupView = (entry: StoredKeyGroup) => ({
  Id: entry.id,
  LastModifiedTime: entry.lastModifiedTime,
  KeyGroupConfig: entry.config,
});

const getCachePolicyEntry = (
  ctx: ServiceContext,
  id: string,
): StoredCachePolicy => {
  const found = ctx.store.get<StoredCachePolicy>(cachePolicyKey + id);
  if (found === undefined) {
    throw awsError(
      "NoSuchCachePolicy",
      `The specified cache policy does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getPublicKeyEntry = (
  ctx: ServiceContext,
  id: string,
): StoredPublicKey => {
  const found = ctx.store.get<StoredPublicKey>(publicKeyKey + id);
  if (found === undefined) {
    throw awsError(
      "NoSuchPublicKey",
      `The specified public key does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getDistribution = (
  ctx: ServiceContext,
  id: string,
): StoredDistribution => {
  const found = ctx.store.get<StoredDistribution>(id);
  if (found === undefined) {
    throw awsError(
      "NoSuchDistribution",
      `The specified distribution does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getOAI = (ctx: ServiceContext, id: string): StoredOAI => {
  const found = ctx.store.get<StoredOAI>(oaiKey + id);
  if (found === undefined) {
    throw awsError(
      "NoSuchCloudFrontOriginAccessIdentity",
      `The specified origin access identity does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getOAC = (ctx: ServiceContext, id: string): StoredOAC => {
  const found = ctx.store.get<StoredOAC>(oacKey + id);
  if (found === undefined) {
    throw awsError(
      "NoSuchOriginAccessControl",
      `The specified origin access control does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getInvalidationEntry = (
  ctx: ServiceContext,
  distributionId: string,
  invalidationId: string,
): StoredInvalidation => {
  const found = ctx.store.get<StoredInvalidation>(
    invalidationKey + distributionId + "#" + invalidationId,
  );
  if (found === undefined) {
    throw awsError(
      "NoSuchInvalidation",
      `The specified invalidation does not exist: ${invalidationId}`,
      404,
    );
  }
  return found;
};

const getAnycastIpList = (
  ctx: ServiceContext,
  id: string,
): StoredAnycastIpList => {
  const found = ctx.store.get<StoredAnycastIpList>(anycastIpListKey + id);
  if (found === undefined) {
    throw awsError(
      "NoSuchResource",
      `The specified Anycast IP list does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getConnectionGroup = (
  ctx: ServiceContext,
  id: string,
): StoredConnectionGroup => {
  const found = ctx.store.get<StoredConnectionGroup>(connectionGroupKey + id);
  if (found === undefined) {
    throw awsError(
      "EntityNotFound",
      `The specified connection group does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getConnectionFunction = (
  ctx: ServiceContext,
  id: string,
): StoredConnectionFunction => {
  const found = ctx.store.get<StoredConnectionFunction>(
    connectionFunctionKey + id,
  );
  if (found === undefined) {
    throw awsError(
      "EntityNotFound",
      `The specified connection function does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getContinuousDeploymentPolicy = (
  ctx: ServiceContext,
  id: string,
): StoredContinuousDeploymentPolicy => {
  const found = ctx.store.get<StoredContinuousDeploymentPolicy>(
    continuousDeploymentPolicyKey + id,
  );
  if (found === undefined) {
    throw awsError(
      "NoSuchContinuousDeploymentPolicy",
      `The specified continuous deployment policy does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getDistributionTenant = (
  ctx: ServiceContext,
  id: string,
): StoredDistributionTenant => {
  const found = ctx.store.get<StoredDistributionTenant>(
    distributionTenantKey + id,
  );
  if (found === undefined) {
    throw awsError(
      "EntityNotFound",
      `The specified distribution tenant does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getFieldLevelEncryption = (
  ctx: ServiceContext,
  id: string,
): StoredFieldLevelEncryption => {
  const found = ctx.store.get<StoredFieldLevelEncryption>(
    fieldLevelEncryptionKey + id,
  );
  if (found === undefined) {
    throw awsError(
      "NoSuchFieldLevelEncryption",
      `The specified field-level encryption does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getFieldLevelEncryptionProfile = (
  ctx: ServiceContext,
  id: string,
): StoredFieldLevelEncryptionProfile => {
  const found = ctx.store.get<StoredFieldLevelEncryptionProfile>(
    fieldLevelEncryptionProfileKey + id,
  );
  if (found === undefined) {
    throw awsError(
      "NoSuchFieldLevelEncryptionProfile",
      `The specified field-level encryption profile does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getKeyGroup = (ctx: ServiceContext, id: string): StoredKeyGroup => {
  const found = ctx.store.get<StoredKeyGroup>(keyGroupKey + id);
  if (found === undefined) {
    throw awsError(
      "NoSuchResource",
      `The specified key group does not exist: ${id}`,
      404,
    );
  }
  return found;
};

const getMonitoringSub = (
  ctx: ServiceContext,
  distributionId: string,
): StoredMonitoringSub => {
  const found = ctx.store.get<StoredMonitoringSub>(monsubKey + distributionId);
  if (found === undefined) {
    throw awsError(
      "NoSuchMonitoringSubscription",
      `The specified monitoring subscription does not exist for distribution: ${distributionId}`,
      404,
    );
  }
  return found;
};

const nonDistributionPrefixes = [
  cachePolicyKey,
  publicKeyKey,
  oaiKey,
  oacKey,
  invalidationKey,
  monsubKey,
  anycastIpListKey,
  connectionGroupKey,
  connectionFunctionKey,
  continuousDeploymentPolicyKey,
  distributionTenantKey,
  tenantInvalidationKey,
  fieldLevelEncryptionKey,
  fieldLevelEncryptionProfileKey,
  keyGroupKey,
  tagKey,
] as const;

const getDistributions = (ctx: ServiceContext): StoredDistribution[] =>
  ctx.store
    .list<StoredDistribution>()
    .filter((e) => !nonDistributionPrefixes.some((p) => e.key.startsWith(p)))
    .map((e) => e.value);

const isCachePolicyInUse = (ctx: ServiceContext, policyId: string): boolean =>
  getDistributions(ctx).some((dist) => {
    const dcb = asRecord(dist.config["DefaultCacheBehavior"]);
    if (dcb["CachePolicyId"] === policyId) return true;
    const cbs = asRecord(dist.config["CacheBehaviors"]);
    const items = Array.isArray(cbs["Items"])
      ? (cbs["Items"] as unknown[])
      : [];
    return items.some((item) => asRecord(item)["CachePolicyId"] === policyId);
  });

const isPublicKeyInUse = (ctx: ServiceContext, keyId: string): boolean =>
  getDistributions(ctx).some((dist) =>
    JSON.stringify(dist.config).includes(keyId),
  );

const isOAIInUse = (ctx: ServiceContext, oaiId: string): boolean => {
  const oaiPath = `origin-access-identity/cloudfront/${oaiId}`;
  return getDistributions(ctx).some((dist) => {
    const origins = asRecord(dist.config["Origins"]);
    const items = Array.isArray(origins["Items"])
      ? (origins["Items"] as unknown[])
      : [];
    return items.some(
      (item) =>
        asRecord(asRecord(item)["S3OriginConfig"])["OriginAccessIdentity"] ===
        oaiPath,
    );
  });
};

const distributionView = (entry: StoredDistribution) => ({
  Id: entry.id,
  ARN: entry.arn,
  Status: entry.status,
  LastModifiedTime: entry.lastModifiedTime,
  InProgressInvalidationBatches: 0,
  DomainName: entry.domainName,
  ActiveTrustedSigners: { Enabled: false, Quantity: 0 },
  ActiveTrustedKeyGroups: { Enabled: false, Quantity: 0 },
  DistributionConfig: entry.config,
});

const distributionSummaryView = (entry: StoredDistribution) => {
  const config = entry.config;
  return {
    Id: entry.id,
    ARN: entry.arn,
    Status: entry.status,
    LastModifiedTime: entry.lastModifiedTime,
    DomainName: entry.domainName,
    Aliases: asRecord(config["Aliases"]) ?? { Quantity: 0 },
    Origins: config["Origins"] ?? { Quantity: 0, Items: [] },
    DefaultCacheBehavior: config["DefaultCacheBehavior"] ?? {},
    CacheBehaviors: config["CacheBehaviors"] ?? { Quantity: 0, Items: [] },
    CustomErrorResponses: { Quantity: 0 },
    Comment: config["Comment"] ?? "",
    PriceClass: config["PriceClass"] ?? "PriceClass_All",
    Enabled: config["Enabled"] === true,
    ViewerCertificate: config["ViewerCertificate"] ?? {
      CloudFrontDefaultCertificate: true,
    },
    Restrictions: config["Restrictions"] ?? {
      GeoRestriction: { RestrictionType: "none", Quantity: 0 },
    },
    WebACLId: config["WebACLId"] ?? "",
    HttpVersion: config["HttpVersion"] ?? "http2",
    IsIPV6Enabled: config["IsIPV6Enabled"] === true,
    Staging: config["Staging"] === true,
  };
};

const cloudfront: ServiceDefinition = {
  name: "cloudfront",
  protocol: "rest-xml",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const { path, method, query } = req;

    if (path.startsWith(oaiPrefix)) {
      const rest = path.slice(oaiPrefix.length).replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateCloudFrontOriginAccessIdentity";
        if (method === "GET") return "ListCloudFrontOriginAccessIdentities";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetCloudFrontOriginAccessIdentityConfig";
        if (method === "PUT") return "UpdateCloudFrontOriginAccessIdentity";
        return undefined;
      }
      if (method === "GET") return "GetCloudFrontOriginAccessIdentity";
      if (method === "DELETE") return "DeleteCloudFrontOriginAccessIdentity";
      return undefined;
    }

    if (path.startsWith(oacPrefix)) {
      const rest = path.slice(oacPrefix.length).replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateOriginAccessControl";
        if (method === "GET") return "ListOriginAccessControls";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetOriginAccessControlConfig";
        if (method === "PUT") return "UpdateOriginAccessControl";
        return undefined;
      }
      if (method === "GET") return "GetOriginAccessControl";
      if (method === "DELETE") return "DeleteOriginAccessControl";
      return undefined;
    }

    if (path.startsWith(cachePolicyPrefix)) {
      const rest = path.slice(cachePolicyPrefix.length).replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateCachePolicy";
        if (method === "GET") return "ListCachePolicies";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetCachePolicyConfig";
        return undefined;
      }
      if (method === "GET") return "GetCachePolicy";
      if (method === "PUT") return "UpdateCachePolicy";
      if (method === "DELETE") return "DeleteCachePolicy";
      return undefined;
    }

    if (path.startsWith(publicKeyPrefix)) {
      const rest = path.slice(publicKeyPrefix.length).replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreatePublicKey";
        if (method === "GET") return "ListPublicKeys";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetPublicKeyConfig";
        if (method === "PUT") return "UpdatePublicKey";
        return undefined;
      }
      if (method === "GET") return "GetPublicKey";
      if (method === "DELETE") return "DeletePublicKey";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributions/")) {
      const rest = path.slice("/2020-05-31/distributions/".length);
      const monsubSuffix = "/monitoring-subscription";
      if (rest.endsWith(monsubSuffix)) {
        if (method === "POST") return "CreateMonitoringSubscription";
        if (method === "GET") return "GetMonitoringSubscription";
        if (method === "DELETE") return "DeleteMonitoringSubscription";
        return undefined;
      }
      return undefined;
    }

    if (path === "/2020-05-31/conflicting-alias") {
      if (method === "GET") return "ListConflictingAliases";
      return undefined;
    }

    if (path === "/2020-05-31/domain-conflicts") {
      if (method === "POST") return "ListDomainConflicts";
      return undefined;
    }

    if (path === "/2020-05-31/domain-association") {
      if (method === "POST") return "UpdateDomainAssociation";
      return undefined;
    }

    if (path === "/2020-05-31/verify-dns-configuration") {
      if (method === "POST") return "VerifyDnsConfiguration";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/managed-certificate/")) {
      if (method === "GET") return "GetManagedCertificateDetails";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByWebACLId/")) {
      if (method === "GET") return "ListDistributionsByWebACLId";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByOwnedResource/")) {
      if (method === "GET") return "ListDistributionsByOwnedResource";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/anycast-ip-list")) {
      const rest = path
        .slice("/2020-05-31/anycast-ip-list".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateAnycastIpList";
        if (method === "GET") return "ListAnycastIpLists";
        return undefined;
      }
      if (method === "GET") return "GetAnycastIpList";
      if (method === "PUT") return "UpdateAnycastIpList";
      if (method === "DELETE") return "DeleteAnycastIpList";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByAnycastIpListId/")) {
      if (method === "GET") return "ListDistributionsByAnycastIpListId";
      return undefined;
    }

    if (path === "/2020-05-31/connection-groups") {
      if (method === "POST") return "ListConnectionGroups";
      return undefined;
    }

    if (
      path === "/2020-05-31/connection-group" ||
      path.startsWith("/2020-05-31/connection-group/")
    ) {
      const rest = path
        .slice("/2020-05-31/connection-group".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateConnectionGroup";
        if (method === "GET") return "GetConnectionGroupByRoutingEndpoint";
        return undefined;
      }
      if (method === "GET") return "GetConnectionGroup";
      if (method === "PUT") return "UpdateConnectionGroup";
      if (method === "DELETE") return "DeleteConnectionGroup";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByConnectionMode/")) {
      if (method === "GET") return "ListDistributionsByConnectionMode";
      return undefined;
    }

    if (path === "/2020-05-31/connection-functions") {
      if (method === "POST") return "ListConnectionFunctions";
      return undefined;
    }

    if (
      path === "/2020-05-31/connection-function" ||
      path.startsWith("/2020-05-31/connection-function/")
    ) {
      const rest = path
        .slice("/2020-05-31/connection-function".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateConnectionFunction";
        return undefined;
      }
      const fnSegs = rest.slice(1).split("/");
      if (fnSegs.length === 1) {
        if (method === "GET") return "GetConnectionFunction";
        if (method === "PUT") return "UpdateConnectionFunction";
        if (method === "DELETE") return "DeleteConnectionFunction";
        return undefined;
      }
      if (fnSegs.length === 2) {
        if (fnSegs[1] === "describe" && method === "GET")
          return "DescribeConnectionFunction";
        if (fnSegs[1] === "publish" && method === "POST")
          return "PublishConnectionFunction";
        if (fnSegs[1] === "test" && method === "POST")
          return "TestConnectionFunction";
        return undefined;
      }
      return undefined;
    }

    if (path === "/2020-05-31/distributionsByConnectionFunction") {
      if (method === "GET") return "ListDistributionsByConnectionFunction";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/continuous-deployment-policy")) {
      const rest = path
        .slice("/2020-05-31/continuous-deployment-policy".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateContinuousDeploymentPolicy";
        if (method === "GET") return "ListContinuousDeploymentPolicies";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetContinuousDeploymentPolicyConfig";
        return undefined;
      }
      if (method === "GET") return "GetContinuousDeploymentPolicy";
      if (method === "PUT") return "UpdateContinuousDeploymentPolicy";
      if (method === "DELETE") return "DeleteContinuousDeploymentPolicy";
      return undefined;
    }

    if (path === "/2020-05-31/distribution-tenants") {
      if (method === "POST") return "ListDistributionTenants";
      return undefined;
    }

    if (path === "/2020-05-31/distribution-tenants-by-customization") {
      if (method === "POST") return "ListDistributionTenantsByCustomization";
      return undefined;
    }

    if (
      path === "/2020-05-31/distribution-tenant" ||
      path.startsWith("/2020-05-31/distribution-tenant/")
    ) {
      const rest = path
        .slice("/2020-05-31/distribution-tenant".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateDistributionTenant";
        if (method === "GET") return "GetDistributionTenantByDomain";
        return undefined;
      }
      const dtSegs = rest.slice(1).split("/");
      if (dtSegs.length === 1) {
        if (method === "GET") return "GetDistributionTenant";
        if (method === "PUT") return "UpdateDistributionTenant";
        if (method === "DELETE") return "DeleteDistributionTenant";
        return undefined;
      }
      if (dtSegs.length === 2) {
        if (dtSegs[1] === "associate-web-acl" && method === "PUT")
          return "AssociateDistributionTenantWebACL";
        if (dtSegs[1] === "disassociate-web-acl" && method === "PUT")
          return "DisassociateDistributionTenantWebACL";
        if (dtSegs[1] === "invalidation") {
          if (method === "POST")
            return "CreateInvalidationForDistributionTenant";
          if (method === "GET") return "ListInvalidationsForDistributionTenant";
          return undefined;
        }
        return undefined;
      }
      if (dtSegs.length === 3 && dtSegs[1] === "invalidation") {
        if (method === "GET") return "GetInvalidationForDistributionTenant";
        return undefined;
      }
      return undefined;
    }

    if (path.startsWith("/2020-05-31/field-level-encryption-profile")) {
      const rest = path
        .slice("/2020-05-31/field-level-encryption-profile".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateFieldLevelEncryptionProfile";
        if (method === "GET") return "ListFieldLevelEncryptionProfiles";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetFieldLevelEncryptionProfileConfig";
        if (method === "PUT") return "UpdateFieldLevelEncryptionProfile";
        return undefined;
      }
      if (method === "GET") return "GetFieldLevelEncryptionProfile";
      if (method === "DELETE") return "DeleteFieldLevelEncryptionProfile";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/field-level-encryption")) {
      const rest = path
        .slice("/2020-05-31/field-level-encryption".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateFieldLevelEncryptionConfig";
        if (method === "GET") return "ListFieldLevelEncryptionConfigs";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetFieldLevelEncryptionConfig";
        if (method === "PUT") return "UpdateFieldLevelEncryptionConfig";
        return undefined;
      }
      if (method === "GET") return "GetFieldLevelEncryption";
      if (method === "DELETE") return "DeleteFieldLevelEncryptionConfig";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/key-group")) {
      const rest = path
        .slice("/2020-05-31/key-group".length)
        .replace(/\/$/, "");
      if (rest === "") {
        if (method === "POST") return "CreateKeyGroup";
        if (method === "GET") return "ListKeyGroups";
        return undefined;
      }
      if (rest.endsWith("/config")) {
        if (method === "GET") return "GetKeyGroupConfig";
        return undefined;
      }
      if (method === "GET") return "GetKeyGroup";
      if (method === "PUT") return "UpdateKeyGroup";
      if (method === "DELETE") return "DeleteKeyGroup";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByKeyGroupId/")) {
      if (method === "GET") return "ListDistributionsByKeyGroup";
      return undefined;
    }

    if (path === "/2020-05-31/tagging") {
      if (method === "GET") return "ListTagsForResource";
      if (method === "POST") {
        if (query.get("Operation") === "Tag") return "TagResource";
        if (query.get("Operation") === "Untag") return "UntagResource";
        return undefined;
      }
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByCachePolicyId/")) {
      if (method === "GET") return "ListDistributionsByCachePolicyId";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByOriginRequestPolicyId/")) {
      if (method === "GET") return "ListDistributionsByOriginRequestPolicyId";
      return undefined;
    }

    if (path === "/2020-05-31/distributionsByRealtimeLogConfig") {
      if (method === "POST") return "ListDistributionsByRealtimeLogConfig";
      return undefined;
    }

    if (
      path.startsWith("/2020-05-31/distributionsByResponseHeadersPolicyId/")
    ) {
      if (method === "GET") return "ListDistributionsByResponseHeadersPolicyId";
      return undefined;
    }

    if (path === "/2020-05-31/distributionsByTrustStore") {
      if (method === "GET") return "ListDistributionsByTrustStore";
      return undefined;
    }

    if (path.startsWith("/2020-05-31/distributionsByVpcOriginId/")) {
      if (method === "GET") return "ListDistributionsByVpcOriginId";
      return undefined;
    }

    if (!path.startsWith(apiPrefix)) return undefined;
    const rest = path.slice(apiPrefix.length).replace(/\/$/, "");

    if (rest === "") {
      if (method === "POST") {
        if (query.has("WithTags")) return "CreateDistributionWithTags";
        return "CreateDistribution";
      }
      if (method === "GET") return "ListDistributions";
      return undefined;
    }

    const segs = rest.slice(1).split("/");

    if (segs.length === 1) {
      if (method === "GET") return "GetDistribution";
      if (method === "DELETE") return "DeleteDistribution";
      return undefined;
    }

    if (segs.length === 2) {
      const sub = segs[1];
      if (sub === "config") {
        if (method === "GET") return "GetDistributionConfig";
        if (method === "PUT") return "UpdateDistribution";
        return undefined;
      }
      if (sub === "invalidation") {
        if (method === "POST") return "CreateInvalidation";
        if (method === "GET") return "ListInvalidations";
        return undefined;
      }
      if (sub === "copy") {
        if (method === "POST") return "CopyDistribution";
        return undefined;
      }
      if (sub === "associate-alias") {
        if (method === "PUT") return "AssociateAlias";
        return undefined;
      }
      if (sub === "associate-web-acl") {
        if (method === "PUT") return "AssociateDistributionWebACL";
        return undefined;
      }
      if (sub === "disassociate-web-acl") {
        if (method === "PUT") return "DisassociateDistributionWebACL";
        return undefined;
      }
      if (sub === "promote-staging-config") {
        if (method === "PUT") return "UpdateDistributionWithStagingConfig";
        return undefined;
      }
      return undefined;
    }

    if (segs.length === 3 && segs[1] === "invalidation") {
      if (method === "GET") return "GetInvalidation";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateDistribution: (input, ctx) => {
      const config = asRecord(input["DistributionConfig"]);
      const callerReference = config["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidArgument", "CallerReference is required", 400);
      }
      const existingDist = getDistributions(ctx).find(
        (d) => d.config["CallerReference"] === callerReference,
      );
      if (existingDist !== undefined) {
        if (JSON.stringify(existingDist.config) === JSON.stringify(config)) {
          return {
            Distribution: distributionView(existingDist),
            Location: `https://cloudfront.amazonaws.com${apiPrefix}/${existingDist.id}`,
            ETag: existingDist.etag,
          };
        }
        throw awsError(
          "DistributionAlreadyExists",
          "The caller reference you attempted to create the distribution with is associated with another distribution.",
          409,
        );
      }
      const id = generateId("E");
      const domainName = `${id.toLowerCase()}.cloudfront.net`;
      const entry: StoredDistribution = {
        id,
        arn: `arn:aws:cloudfront::${ctx.account}:distribution/${id}`,
        status: "Deployed",
        lastModifiedTime: new Date().toISOString(),
        domainName,
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredDistribution>(id, entry);
      return {
        Distribution: distributionView(entry),
        Location: `https://cloudfront.amazonaws.com${apiPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    CreateDistributionWithTags: (input, ctx) => {
      const configWithTags = asRecord(input["DistributionConfigWithTags"]);
      const config = asRecord(configWithTags["DistributionConfig"]);
      const callerReference = config["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidArgument", "CallerReference is required", 400);
      }
      const id = generateId("E");
      const domainName = `${id.toLowerCase()}.cloudfront.net`;
      const entry: StoredDistribution = {
        id,
        arn: `arn:aws:cloudfront::${ctx.account}:distribution/${id}`,
        status: "Deployed",
        lastModifiedTime: new Date().toISOString(),
        domainName,
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredDistribution>(id, entry);
      return {
        Distribution: distributionView(entry),
        Location: `https://cloudfront.amazonaws.com${apiPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    CopyDistribution: (input, ctx) => {
      const primaryId =
        typeof input["PrimaryDistributionId"] === "string"
          ? input["PrimaryDistributionId"]
          : undefined;
      if (primaryId === undefined || primaryId === "") {
        throw awsError(
          "InvalidArgument",
          "PrimaryDistributionId is required",
          400,
        );
      }
      const primary = getDistribution(ctx, primaryId);
      const callerReference =
        typeof input["CallerReference"] === "string"
          ? input["CallerReference"]
          : generateId("CR");
      const id = generateId("E");
      const domainName = `${id.toLowerCase()}.cloudfront.net`;
      const staging =
        input["Enabled"] !== undefined
          ? input["Enabled"] === true
          : primary.config["Enabled"] === true;
      const newConfig = {
        ...primary.config,
        CallerReference: callerReference,
        Staging: input["Staging"] === true || input["Staging"] === "true",
        Enabled: staging,
      };
      const entry: StoredDistribution = {
        id,
        arn: `arn:aws:cloudfront::${ctx.account}:distribution/${id}`,
        status: "Deployed",
        lastModifiedTime: new Date().toISOString(),
        domainName,
        etag: generateId("ETAG"),
        config: newConfig,
      };
      ctx.store.set<StoredDistribution>(id, entry);
      return {
        Distribution: distributionView(entry),
        Location: `https://cloudfront.amazonaws.com${apiPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    GetDistribution: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      return {
        Distribution: distributionView(entry),
        ETag: entry.etag,
      };
    },
    GetDistributionConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      return {
        DistributionConfig: entry.config,
        ETag: entry.etag,
      };
    },
    ListDistributions: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredDistribution>()
        .filter(
          (e) => !nonDistributionPrefixes.some((p) => e.key.startsWith(p)),
        );
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => distributionSummaryView(e.value)),
        },
      };
    },
    UpdateDistribution: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource. Please retrieve the latest version of the resource and try again.",
          412,
        );
      }
      const config = asRecord(input["DistributionConfig"]);
      const updated: StoredDistribution = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredDistribution>(id, updated);
      return {
        Distribution: distributionView(updated),
        ETag: updated.etag,
      };
    },
    UpdateDistributionWithStagingConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      const stagingId =
        typeof input["StagingDistributionId"] === "string"
          ? input["StagingDistributionId"]
          : undefined;
      const stagingConfig =
        stagingId !== undefined
          ? getDistribution(ctx, stagingId).config
          : entry.config;
      const updated: StoredDistribution = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config: { ...stagingConfig, Staging: false },
      };
      ctx.store.set<StoredDistribution>(id, updated);
      return {
        Distribution: distributionView(updated),
        ETag: updated.etag,
      };
    },
    DeleteDistribution: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      if (entry.config["Enabled"] === true) {
        throw awsError(
          "DistributionNotDisabled",
          "The specified CloudFront distribution is not disabled. You must disable the distribution before you can delete it.",
          409,
        );
      }
      ctx.store.delete(id);
      return undefined;
    },
    AssociateAlias: (input, ctx) => {
      const id =
        typeof input["TargetDistributionId"] === "string"
          ? input["TargetDistributionId"]
          : undefined;
      if (id === undefined || id === "") {
        throw awsError(
          "InvalidArgument",
          "TargetDistributionId is required",
          400,
        );
      }
      const entry = getDistribution(ctx, id);
      const alias =
        typeof input["Alias"] === "string" ? input["Alias"] : undefined;
      const existing = Array.isArray(entry.config["Aliases"])
        ? (entry.config["Aliases"] as string[])
        : [];
      const aliases = alias !== undefined ? [...existing, alias] : existing;
      const updated: StoredDistribution = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config: {
          ...entry.config,
          Aliases: { Quantity: aliases.length, Items: aliases },
        },
      };
      ctx.store.set<StoredDistribution>(id, updated);
      return undefined;
    },
    AssociateDistributionWebACL: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      const webAclArn =
        typeof input["WebACLArn"] === "string" ? input["WebACLArn"] : "";
      const updated: StoredDistribution = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config: { ...entry.config, WebACLId: webAclArn },
      };
      ctx.store.set<StoredDistribution>(id, updated);
      return {
        Id: id,
        WebACLArn: webAclArn,
        ETag: updated.etag,
      };
    },
    DisassociateDistributionWebACL: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistribution(ctx, id);
      const updated: StoredDistribution = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config: { ...entry.config, WebACLId: "" },
      };
      ctx.store.set<StoredDistribution>(id, updated);
      return {
        Id: id,
        ETag: updated.etag,
      };
    },
    ListDistributionsByWebACLId: (_input, ctx) => {
      const webAclId =
        typeof _input["WebACLId"] === "string" ? _input["WebACLId"] : "";
      const entries = ctx.store
        .list<StoredDistribution>()
        .filter(
          (e) =>
            !nonDistributionPrefixes.some((p) => e.key.startsWith(p)) &&
            (e.value.config["WebACLId"] === webAclId || webAclId === ""),
        );
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => distributionSummaryView(e.value)),
        },
      };
    },
    ListDistributionsByOwnedResource: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredDistribution>()
        .filter(
          (e) => !nonDistributionPrefixes.some((p) => e.key.startsWith(p)),
        );
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => distributionSummaryView(e.value)),
        },
      };
    },
    CreateInvalidation: (input, ctx) => {
      const id =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      getDistribution(ctx, id);
      const batch = asRecord(input["InvalidationBatch"]);
      const invalidationId = generateId("I");
      const createTime = new Date().toISOString();
      const storedInval: StoredInvalidation = {
        id: invalidationId,
        createTime,
        batch,
      };
      ctx.store.set<StoredInvalidation>(
        invalidationKey + id + "#" + invalidationId,
        storedInval,
      );
      return {
        Location: `https://cloudfront.amazonaws.com${apiPrefix}/${id}/invalidation/${invalidationId}`,
        Invalidation: {
          ...invalidationView(storedInval),
          Status: "InProgress",
        },
      };
    },
    GetInvalidation: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      const invalidationId =
        typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (distributionId === undefined || distributionId === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      if (invalidationId === undefined || invalidationId === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getDistribution(ctx, distributionId);
      const entry = getInvalidationEntry(ctx, distributionId, invalidationId);
      return { Invalidation: invalidationView(entry) };
    },
    ListInvalidations: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      if (distributionId === undefined || distributionId === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      getDistribution(ctx, distributionId);
      const prefix = invalidationKey + distributionId + "#";
      const entries = ctx.store
        .list<StoredInvalidation>()
        .filter((e) => e.key.startsWith(prefix));
      return {
        InvalidationList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => ({
            Id: e.value.id,
            CreateTime: e.value.createTime,
            Status: "Completed",
          })),
        },
      };
    },
    CreateMonitoringSubscription: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      if (distributionId === undefined || distributionId === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      getDistribution(ctx, distributionId);
      const sub = asRecord(input["MonitoringSubscription"]);
      const entry: StoredMonitoringSub = { config: sub };
      ctx.store.set<StoredMonitoringSub>(monsubKey + distributionId, entry);
      return { MonitoringSubscription: sub };
    },
    GetMonitoringSubscription: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      if (distributionId === undefined || distributionId === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      getDistribution(ctx, distributionId);
      const entry = getMonitoringSub(ctx, distributionId);
      return { MonitoringSubscription: entry.config };
    },
    DeleteMonitoringSubscription: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      if (distributionId === undefined || distributionId === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      getDistribution(ctx, distributionId);
      getMonitoringSub(ctx, distributionId);
      ctx.store.delete(monsubKey + distributionId);
      return undefined;
    },
    ListConflictingAliases: (_input, _ctx) => ({
      ConflictingAliasesList: {
        MaxItems: 100,
        Quantity: 0,
        Items: [],
        NextMarker: undefined,
      },
    }),
    ListDomainConflicts: (_input, _ctx) => ({
      DomainConflicts: { Quantity: 0, Items: [] },
      NextMarker: undefined,
    }),
    UpdateDomainAssociation: (input, _ctx) => {
      const domain = typeof input["Domain"] === "string" ? input["Domain"] : "";
      return {
        Domain: domain,
        ResourceId: "",
        ETag: generateId("ETAG"),
      };
    },
    VerifyDnsConfiguration: (_input, _ctx) => ({
      DnsConfigurationList: { Quantity: 0, Items: [] },
    }),
    GetManagedCertificateDetails: (input, _ctx) => {
      const identifier =
        typeof input["Identifier"] === "string" ? input["Identifier"] : "";
      return {
        ManagedCertificateDetails: {
          CertificateArn: `arn:aws:acm:us-east-1:123456789012:certificate/${identifier}`,
          CertificateStatus: "ISSUED",
          ValidationTokenHost: "cloudfront",
          ValidationTokenDetails: { Quantity: 0, Items: [] },
        },
      };
    },
    CreateCachePolicy: (input, ctx) => {
      const config = asRecord(input["CachePolicyConfig"]);
      const name = config["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const id = generateId("");
      const entry: StoredCachePolicy = {
        id,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredCachePolicy>(cachePolicyKey + id, entry);
      return {
        CachePolicy: cachePolicyView(entry),
        Location: `https://cloudfront.amazonaws.com${cachePolicyPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    GetCachePolicy: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getCachePolicyEntry(ctx, id);
      return {
        CachePolicy: cachePolicyView(entry),
        ETag: entry.etag,
      };
    },
    ListCachePolicies: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredCachePolicy>()
        .filter((e) => e.key.startsWith(cachePolicyKey));
      return {
        CachePolicyList: {
          MaxItems: 100,
          Quantity: entries.length,
          Items: entries.map((e) => ({
            Type: "custom",
            CachePolicy: cachePolicyView(e.value),
          })),
        },
      };
    },
    DeleteCachePolicy: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getCachePolicyEntry(ctx, id);
      if (isCachePolicyInUse(ctx, id)) {
        throw awsError(
          "CachePolicyInUse",
          "The specified cache policy is currently associated with a distribution.",
          409,
        );
      }
      ctx.store.delete(cachePolicyKey + id);
      return undefined;
    },
    CreatePublicKey: (input, ctx) => {
      const config = asRecord(input["PublicKeyConfig"]);
      const name = config["Name"];
      const encodedKey = config["EncodedKey"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      if (typeof encodedKey !== "string" || encodedKey === "") {
        throw awsError("InvalidArgument", "EncodedKey is required", 400);
      }
      const id = generateId("K");
      const entry: StoredPublicKey = {
        id,
        createdTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredPublicKey>(publicKeyKey + id, entry);
      return {
        PublicKey: publicKeyView(entry),
        Location: `https://cloudfront.amazonaws.com${publicKeyPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    GetPublicKey: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getPublicKeyEntry(ctx, id);
      return {
        PublicKey: publicKeyView(entry),
        ETag: entry.etag,
      };
    },
    ListPublicKeys: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredPublicKey>()
        .filter((e) => e.key.startsWith(publicKeyKey));
      return {
        PublicKeyList: {
          MaxItems: 100,
          Quantity: entries.length,
          Items: entries.map((e) => {
            const config = e.value.config;
            return {
              Id: e.value.id,
              Name: config["Name"] ?? "",
              CreatedTime: e.value.createdTime,
              EncodedKey: config["EncodedKey"] ?? "",
              Comment: config["Comment"] ?? "",
            };
          }),
        },
      };
    },
    DeletePublicKey: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getPublicKeyEntry(ctx, id);
      if (isPublicKeyInUse(ctx, id)) {
        throw awsError(
          "PublicKeyInUse",
          "The specified public key is currently associated with a distribution.",
          409,
        );
      }
      ctx.store.delete(publicKeyKey + id);
      return undefined;
    },
    CreateCloudFrontOriginAccessIdentity: (input, ctx) => {
      const config = asRecord(input["CloudFrontOriginAccessIdentityConfig"]);
      const callerReference = config["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidArgument", "CallerReference is required", 400);
      }
      const existingOAIs = ctx.store
        .list<StoredOAI>()
        .filter((e) => e.key.startsWith(oaiKey))
        .map((e) => e.value);
      const existingOAI = existingOAIs.find(
        (o) => o.config["CallerReference"] === callerReference,
      );
      if (existingOAI !== undefined) {
        throw awsError(
          "CloudFrontOriginAccessIdentityAlreadyExists",
          "If you are attempting to create a new origin access identity, the caller reference you specified is already an origin access identity.",
          409,
        );
      }
      const id = generateId("OAI");
      const entry: StoredOAI = {
        id,
        s3CanonicalUserId: generateId("S3"),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredOAI>(oaiKey + id, entry);
      return {
        CloudFrontOriginAccessIdentity: oaiView(entry),
        Location: `https://cloudfront.amazonaws.com${oaiPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    GetCloudFrontOriginAccessIdentity: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getOAI(ctx, id);
      return {
        CloudFrontOriginAccessIdentity: oaiView(entry),
        ETag: entry.etag,
      };
    },
    GetCloudFrontOriginAccessIdentityConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getOAI(ctx, id);
      return {
        CloudFrontOriginAccessIdentityConfig: entry.config,
        ETag: entry.etag,
      };
    },
    UpdateCloudFrontOriginAccessIdentity: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getOAI(ctx, id);
      const config = asRecord(input["CloudFrontOriginAccessIdentityConfig"]);
      const updated: StoredOAI = {
        ...entry,
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredOAI>(oaiKey + id, updated);
      return {
        CloudFrontOriginAccessIdentity: oaiView(updated),
        ETag: updated.etag,
      };
    },
    DeleteCloudFrontOriginAccessIdentity: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getOAI(ctx, id);
      if (isOAIInUse(ctx, id)) {
        throw awsError(
          "CloudFrontOriginAccessIdentityInUse",
          "The specified origin access identity is currently associated with a distribution.",
          409,
        );
      }
      ctx.store.delete(oaiKey + id);
      return undefined;
    },
    ListCloudFrontOriginAccessIdentities: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredOAI>()
        .filter((e) => e.key.startsWith(oaiKey));
      return {
        CloudFrontOriginAccessIdentityList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => ({
            Id: e.value.id,
            S3CanonicalUserId: e.value.s3CanonicalUserId,
            Comment: e.value.config["Comment"] ?? "",
          })),
        },
      };
    },
    CreateOriginAccessControl: (input, ctx) => {
      const config = asRecord(input["OriginAccessControlConfig"]);
      const name = config["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const id = generateId("OAC");
      const entry: StoredOAC = {
        id,
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredOAC>(oacKey + id, entry);
      return {
        OriginAccessControl: oacView(entry),
        Location: `https://cloudfront.amazonaws.com${oacPrefix}/${id}`,
        ETag: entry.etag,
      };
    },
    GetOriginAccessControl: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getOAC(ctx, id);
      return {
        OriginAccessControl: oacView(entry),
        ETag: entry.etag,
      };
    },
    GetOriginAccessControlConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getOAC(ctx, id);
      return {
        OriginAccessControlConfig: entry.config,
        ETag: entry.etag,
      };
    },
    UpdateOriginAccessControl: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getOAC(ctx, id);
      const config = asRecord(input["OriginAccessControlConfig"]);
      const updated: StoredOAC = {
        ...entry,
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredOAC>(oacKey + id, updated);
      return {
        OriginAccessControl: oacView(updated),
        ETag: updated.etag,
      };
    },
    DeleteOriginAccessControl: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getOAC(ctx, id);
      ctx.store.delete(oacKey + id);
      return undefined;
    },
    ListOriginAccessControls: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredOAC>()
        .filter((e) => e.key.startsWith(oacKey));
      return {
        OriginAccessControlList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => oacSummaryView(e.value)),
        },
      };
    },
    GetCachePolicyConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getCachePolicyEntry(ctx, id);
      return {
        CachePolicyConfig: entry.config,
        ETag: entry.etag,
      };
    },
    UpdateCachePolicy: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getCachePolicyEntry(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const config = asRecord(input["CachePolicyConfig"]);
      const updated: StoredCachePolicy = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredCachePolicy>(cachePolicyKey + id, updated);
      return {
        CachePolicy: cachePolicyView(updated),
        ETag: updated.etag,
      };
    },
    GetPublicKeyConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getPublicKeyEntry(ctx, id);
      return {
        PublicKeyConfig: entry.config,
        ETag: entry.etag,
      };
    },
    UpdatePublicKey: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getPublicKeyEntry(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const config = asRecord(input["PublicKeyConfig"]);
      const updated: StoredPublicKey = {
        ...entry,
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredPublicKey>(publicKeyKey + id, updated);
      return {
        PublicKey: publicKeyView(updated),
        ETag: updated.etag,
      };
    },
    CreateAnycastIpList: (input, ctx) => {
      const name =
        typeof input["Name"] === "string" ? input["Name"] : undefined;
      if (name === undefined || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const ipCount =
        typeof input["IpCount"] === "number" ? input["IpCount"] : 3;
      const id = generateId("AIPL");
      const arn = `arn:aws:cloudfront::${ctx.account}:anycast-ip-list/${id}`;
      const entry: StoredAnycastIpList = {
        id,
        name,
        arn,
        status: "Deployed",
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        ipCount,
        anycastIps: Array.from(
          { length: ipCount },
          (_, i) => `192.0.2.${i + 1}`,
        ),
      };
      ctx.store.set<StoredAnycastIpList>(anycastIpListKey + id, entry);
      return {
        AnycastIpList: anycastIpListView(entry),
        ETag: entry.etag,
      };
    },
    GetAnycastIpList: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getAnycastIpList(ctx, id);
      return {
        AnycastIpList: anycastIpListView(entry),
        ETag: entry.etag,
      };
    },
    ListAnycastIpLists: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredAnycastIpList>()
        .filter((e) => e.key.startsWith(anycastIpListKey));
      return {
        AnycastIpLists: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => anycastIpListView(e.value)),
        },
      };
    },
    UpdateAnycastIpList: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getAnycastIpList(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const updated: StoredAnycastIpList = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
      };
      ctx.store.set<StoredAnycastIpList>(anycastIpListKey + id, updated);
      return {
        AnycastIpList: anycastIpListView(updated),
        ETag: updated.etag,
      };
    },
    DeleteAnycastIpList: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getAnycastIpList(ctx, id);
      ctx.store.delete(anycastIpListKey + id);
      return undefined;
    },
    ListDistributionsByAnycastIpListId: (input, ctx) => {
      const anycastIpListId =
        typeof input["AnycastIpListId"] === "string"
          ? input["AnycastIpListId"]
          : "";
      const dists = getDistributions(ctx).filter((d) =>
        JSON.stringify(d.config).includes(anycastIpListId),
      );
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map(distributionSummaryView),
        },
      };
    },
    CreateConnectionGroup: (input, ctx) => {
      const name =
        typeof input["Name"] === "string" ? input["Name"] : undefined;
      if (name === undefined || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const id = generateId("CG");
      const arn = `arn:aws:cloudfront::${ctx.account}:connection-group/${id}`;
      const now = new Date().toISOString();
      const entry: StoredConnectionGroup = {
        id,
        name,
        arn,
        status: "Deployed",
        createdTime: now,
        lastModifiedTime: now,
        etag: generateId("ETAG"),
        ipv6Enabled: input["Ipv6Enabled"] !== false,
        anycastIpListId:
          typeof input["AnycastIpListId"] === "string"
            ? input["AnycastIpListId"]
            : "",
        enabled: input["Enabled"] !== false,
        routingEndpoint: `${id.toLowerCase()}.cloudfront.net`,
      };
      ctx.store.set<StoredConnectionGroup>(connectionGroupKey + id, entry);
      return {
        ConnectionGroup: connectionGroupView(entry),
        ETag: entry.etag,
      };
    },
    GetConnectionGroup: (input, ctx) => {
      const identifier =
        typeof input["Identifier"] === "string"
          ? input["Identifier"]
          : undefined;
      if (identifier === undefined || identifier === "") {
        throw awsError("InvalidArgument", "Identifier is required", 400);
      }
      const entry = getConnectionGroup(ctx, identifier);
      return {
        ConnectionGroup: connectionGroupView(entry),
        ETag: entry.etag,
      };
    },
    GetConnectionGroupByRoutingEndpoint: (input, ctx) => {
      const routingEndpoint =
        typeof input["RoutingEndpoint"] === "string"
          ? input["RoutingEndpoint"]
          : undefined;
      const entries = ctx.store
        .list<StoredConnectionGroup>()
        .filter((e) => e.key.startsWith(connectionGroupKey));
      const found = entries.find(
        (e) =>
          e.value.routingEndpoint === routingEndpoint ||
          routingEndpoint === undefined,
      );
      if (found === undefined) {
        throw awsError(
          "EntityNotFound",
          "No connection group found for the specified routing endpoint.",
          404,
        );
      }
      return {
        ConnectionGroup: connectionGroupView(found.value),
        ETag: found.value.etag,
      };
    },
    ListConnectionGroups: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredConnectionGroup>()
        .filter((e) => e.key.startsWith(connectionGroupKey));
      return {
        NextMarker: undefined,
        ConnectionGroups: entries.map((e) => connectionGroupView(e.value)),
      };
    },
    UpdateConnectionGroup: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getConnectionGroup(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const updated: StoredConnectionGroup = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        ipv6Enabled:
          typeof input["Ipv6Enabled"] === "boolean"
            ? input["Ipv6Enabled"]
            : entry.ipv6Enabled,
        enabled:
          typeof input["Enabled"] === "boolean"
            ? input["Enabled"]
            : entry.enabled,
      };
      ctx.store.set<StoredConnectionGroup>(connectionGroupKey + id, updated);
      return {
        ConnectionGroup: connectionGroupView(updated),
        ETag: updated.etag,
      };
    },
    DeleteConnectionGroup: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getConnectionGroup(ctx, id);
      ctx.store.delete(connectionGroupKey + id);
      return undefined;
    },
    ListDistributionsByConnectionMode: (_input, ctx) => {
      const dists = getDistributions(ctx);
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map(distributionSummaryView),
        },
      };
    },
    CreateConnectionFunction: (input, ctx) => {
      const name =
        typeof input["Name"] === "string" ? input["Name"] : undefined;
      if (name === undefined || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const id = generateId("CF");
      const arn = `arn:aws:cloudfront::${ctx.account}:connection-function/${id}`;
      const now = new Date().toISOString();
      const functionConfig = asRecord(input["ConnectionFunctionConfig"] ?? {});
      const entry: StoredConnectionFunction = {
        id,
        name,
        arn,
        status: "UNPUBLISHED",
        createdTime: now,
        lastModifiedTime: now,
        etag: generateId("ETAG"),
        stage: "DEVELOPMENT",
        functionCode:
          typeof input["ConnectionFunctionCode"] === "string"
            ? input["ConnectionFunctionCode"]
            : "",
        comment:
          typeof functionConfig["Comment"] === "string"
            ? functionConfig["Comment"]
            : "",
      };
      ctx.store.set<StoredConnectionFunction>(
        connectionFunctionKey + id,
        entry,
      );
      return {
        ConnectionFunctionSummary: connectionFunctionView(entry),
        Location: `https://cloudfront.amazonaws.com/2020-05-31/connection-function/${id}`,
        ETag: entry.etag,
      };
    },
    GetConnectionFunction: (input, ctx) => {
      const identifier =
        typeof input["Identifier"] === "string"
          ? input["Identifier"]
          : undefined;
      if (identifier === undefined || identifier === "") {
        throw awsError("InvalidArgument", "Identifier is required", 400);
      }
      const entry = getConnectionFunction(ctx, identifier);
      return {
        ConnectionFunctionCode: entry.functionCode,
        ETag: entry.etag,
        ContentType: "text/javascript",
      };
    },
    DescribeConnectionFunction: (input, ctx) => {
      const identifier =
        typeof input["Identifier"] === "string"
          ? input["Identifier"]
          : undefined;
      if (identifier === undefined || identifier === "") {
        throw awsError("InvalidArgument", "Identifier is required", 400);
      }
      const entry = getConnectionFunction(ctx, identifier);
      return {
        ConnectionFunctionSummary: connectionFunctionView(entry),
        ETag: entry.etag,
      };
    },
    ListConnectionFunctions: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredConnectionFunction>()
        .filter((e) => e.key.startsWith(connectionFunctionKey));
      return {
        NextMarker: undefined,
        ConnectionFunctions: entries.map((e) =>
          connectionFunctionView(e.value),
        ),
      };
    },
    ListDistributionsByConnectionFunction: (_input, ctx) => {
      const dists = getDistributions(ctx);
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map(distributionSummaryView),
        },
      };
    },
    UpdateConnectionFunction: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getConnectionFunction(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const functionConfig = asRecord(input["ConnectionFunctionConfig"] ?? {});
      const updated: StoredConnectionFunction = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        functionCode:
          typeof input["ConnectionFunctionCode"] === "string"
            ? input["ConnectionFunctionCode"]
            : entry.functionCode,
        comment:
          typeof functionConfig["Comment"] === "string"
            ? functionConfig["Comment"]
            : entry.comment,
      };
      ctx.store.set<StoredConnectionFunction>(
        connectionFunctionKey + id,
        updated,
      );
      return {
        ConnectionFunctionSummary: connectionFunctionView(updated),
        ETag: updated.etag,
      };
    },
    DeleteConnectionFunction: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getConnectionFunction(ctx, id);
      ctx.store.delete(connectionFunctionKey + id);
      return undefined;
    },
    PublishConnectionFunction: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getConnectionFunction(ctx, id);
      const updated: StoredConnectionFunction = {
        ...entry,
        stage: "LIVE",
        status: "DEPLOYED",
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
      };
      ctx.store.set<StoredConnectionFunction>(
        connectionFunctionKey + id,
        updated,
      );
      return {
        ConnectionFunctionSummary: connectionFunctionView(updated),
        ETag: updated.etag,
      };
    },
    TestConnectionFunction: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getConnectionFunction(ctx, id);
      return {
        ConnectionFunctionTestResult: {
          ConnectionFunctionSummary: connectionFunctionView(entry),
          ComputeUtilization: "10",
          ConnectionFunctionExecutionLogs: [],
          ConnectionFunctionErrorMessage: "",
          ConnectionFunctionOutput: "{}",
        },
      };
    },
    CreateContinuousDeploymentPolicy: (input, ctx) => {
      const config = asRecord(input["ContinuousDeploymentPolicyConfig"]);
      const id = generateId("CDP");
      const entry: StoredContinuousDeploymentPolicy = {
        id,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredContinuousDeploymentPolicy>(
        continuousDeploymentPolicyKey + id,
        entry,
      );
      return {
        ContinuousDeploymentPolicy: continuousDeploymentPolicyView(entry),
        Location: `https://cloudfront.amazonaws.com/2020-05-31/continuous-deployment-policy/${id}`,
        ETag: entry.etag,
      };
    },
    GetContinuousDeploymentPolicy: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getContinuousDeploymentPolicy(ctx, id);
      return {
        ContinuousDeploymentPolicy: continuousDeploymentPolicyView(entry),
        ETag: entry.etag,
      };
    },
    GetContinuousDeploymentPolicyConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getContinuousDeploymentPolicy(ctx, id);
      return {
        ContinuousDeploymentPolicyConfig: entry.config,
        ETag: entry.etag,
      };
    },
    ListContinuousDeploymentPolicies: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredContinuousDeploymentPolicy>()
        .filter((e) => e.key.startsWith(continuousDeploymentPolicyKey));
      return {
        ContinuousDeploymentPolicyList: {
          MaxItems: 100,
          Quantity: entries.length,
          Items: entries.map((e) => ({
            ContinuousDeploymentPolicy: continuousDeploymentPolicyView(e.value),
          })),
          NextMarker: undefined,
        },
      };
    },
    UpdateContinuousDeploymentPolicy: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getContinuousDeploymentPolicy(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const config = asRecord(input["ContinuousDeploymentPolicyConfig"]);
      const updated: StoredContinuousDeploymentPolicy = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredContinuousDeploymentPolicy>(
        continuousDeploymentPolicyKey + id,
        updated,
      );
      return {
        ContinuousDeploymentPolicy: continuousDeploymentPolicyView(updated),
        ETag: updated.etag,
      };
    },
    DeleteContinuousDeploymentPolicy: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getContinuousDeploymentPolicy(ctx, id);
      ctx.store.delete(continuousDeploymentPolicyKey + id);
      return undefined;
    },
    CreateDistributionTenant: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      if (distributionId === undefined || distributionId === "") {
        throw awsError("InvalidArgument", "DistributionId is required", 400);
      }
      const name =
        typeof input["Name"] === "string" ? input["Name"] : undefined;
      if (name === undefined || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const domainList = Array.isArray(input["Domains"])
        ? (input["Domains"] as unknown[])
        : [];
      if (domainList.length === 0) {
        throw awsError("InvalidArgument", "Domains is required", 400);
      }
      const domains = domainList.map((d) =>
        typeof d === "string" ? d : ((asRecord(d)["Domain"] as string) ?? ""),
      );
      const id = generateId("DT");
      const arn = `arn:aws:cloudfront::${ctx.account}:distribution-tenant/${id}`;
      const now = new Date().toISOString();
      const entry: StoredDistributionTenant = {
        id,
        name,
        arn,
        distributionId,
        domains,
        status: "Deployed",
        createdTime: now,
        lastModifiedTime: now,
        etag: generateId("ETAG"),
        connectionGroupId:
          typeof input["ConnectionGroupId"] === "string"
            ? input["ConnectionGroupId"]
            : "",
        customizations: asRecord(input["Customizations"] ?? {}),
        parameters: Array.isArray(input["Parameters"])
          ? (input["Parameters"] as unknown[])
          : [],
        enabled: input["Enabled"] !== false,
      };
      ctx.store.set<StoredDistributionTenant>(
        distributionTenantKey + id,
        entry,
      );
      return {
        DistributionTenant: distributionTenantView(entry),
        ETag: entry.etag,
      };
    },
    GetDistributionTenant: (input, ctx) => {
      const identifier =
        typeof input["Identifier"] === "string"
          ? input["Identifier"]
          : undefined;
      if (identifier === undefined || identifier === "") {
        throw awsError("InvalidArgument", "Identifier is required", 400);
      }
      const entry = getDistributionTenant(ctx, identifier);
      return {
        DistributionTenant: distributionTenantView(entry),
        ETag: entry.etag,
      };
    },
    GetDistributionTenantByDomain: (input, ctx) => {
      const domain =
        typeof input["Domain"] === "string" ? input["Domain"] : undefined;
      const entries = ctx.store
        .list<StoredDistributionTenant>()
        .filter((e) => e.key.startsWith(distributionTenantKey));
      const found = entries.find(
        (e) => domain === undefined || e.value.domains.includes(domain),
      );
      if (found === undefined) {
        throw awsError(
          "EntityNotFound",
          "No distribution tenant found for the specified domain.",
          404,
        );
      }
      return {
        DistributionTenant: distributionTenantView(found.value),
        ETag: found.value.etag,
      };
    },
    ListDistributionTenants: (input, ctx) => {
      const distributionId =
        typeof input["DistributionId"] === "string"
          ? input["DistributionId"]
          : undefined;
      const entries = ctx.store
        .list<StoredDistributionTenant>()
        .filter(
          (e) =>
            e.key.startsWith(distributionTenantKey) &&
            (distributionId === undefined ||
              e.value.distributionId === distributionId),
        );
      return {
        NextMarker: undefined,
        DistributionTenantList: entries.map((e) =>
          distributionTenantView(e.value),
        ),
      };
    },
    ListDistributionTenantsByCustomization: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredDistributionTenant>()
        .filter((e) => e.key.startsWith(distributionTenantKey));
      return {
        NextMarker: undefined,
        DistributionTenantList: entries.map((e) =>
          distributionTenantView(e.value),
        ),
      };
    },
    UpdateDistributionTenant: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistributionTenant(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const domainList = Array.isArray(input["Domains"])
        ? (input["Domains"] as unknown[])
        : null;
      const domains =
        domainList !== null
          ? domainList.map((d) =>
              typeof d === "string"
                ? d
                : ((asRecord(d)["Domain"] as string) ?? ""),
            )
          : entry.domains;
      const updated: StoredDistributionTenant = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        domains,
        connectionGroupId:
          typeof input["ConnectionGroupId"] === "string"
            ? input["ConnectionGroupId"]
            : entry.connectionGroupId,
        customizations:
          input["Customizations"] !== undefined
            ? asRecord(input["Customizations"])
            : entry.customizations,
        parameters: Array.isArray(input["Parameters"])
          ? (input["Parameters"] as unknown[])
          : entry.parameters,
        enabled:
          typeof input["Enabled"] === "boolean"
            ? input["Enabled"]
            : entry.enabled,
      };
      ctx.store.set<StoredDistributionTenant>(
        distributionTenantKey + id,
        updated,
      );
      return {
        DistributionTenant: distributionTenantView(updated),
        ETag: updated.etag,
      };
    },
    DeleteDistributionTenant: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getDistributionTenant(ctx, id);
      ctx.store.delete(distributionTenantKey + id);
      return undefined;
    },
    AssociateDistributionTenantWebACL: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistributionTenant(ctx, id);
      const webAclArn =
        typeof input["WebACLArn"] === "string" ? input["WebACLArn"] : "";
      const updated: StoredDistributionTenant = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        customizations: {
          ...entry.customizations,
          WebACLArn: webAclArn,
        },
      };
      ctx.store.set<StoredDistributionTenant>(
        distributionTenantKey + id,
        updated,
      );
      return {
        Id: id,
        WebACLArn: webAclArn,
        ETag: updated.etag,
      };
    },
    DisassociateDistributionTenantWebACL: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getDistributionTenant(ctx, id);
      const updated: StoredDistributionTenant = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        customizations: { ...entry.customizations, WebACLArn: "" },
      };
      ctx.store.set<StoredDistributionTenant>(
        distributionTenantKey + id,
        updated,
      );
      return {
        Id: id,
        ETag: updated.etag,
      };
    },
    CreateInvalidationForDistributionTenant: (input, ctx) => {
      const tenantId =
        typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (tenantId === undefined || tenantId === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getDistributionTenant(ctx, tenantId);
      const batch = asRecord(input["InvalidationBatch"] ?? {});
      const invalidationId = generateId("I");
      const createTime = new Date().toISOString();
      const storedInval: StoredInvalidation = {
        id: invalidationId,
        createTime,
        batch,
      };
      ctx.store.set<StoredInvalidation>(
        tenantInvalidationKey + tenantId + "#" + invalidationId,
        storedInval,
      );
      return {
        Location: `https://cloudfront.amazonaws.com/2020-05-31/distribution-tenant/${tenantId}/invalidation/${invalidationId}`,
        Invalidation: {
          ...invalidationView(storedInval),
          Status: "InProgress",
        },
      };
    },
    GetInvalidationForDistributionTenant: (input, ctx) => {
      const tenantId =
        typeof input["DistributionTenantId"] === "string"
          ? input["DistributionTenantId"]
          : undefined;
      const invalidationId =
        typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (tenantId === undefined || tenantId === "") {
        throw awsError(
          "InvalidArgument",
          "DistributionTenantId is required",
          400,
        );
      }
      if (invalidationId === undefined || invalidationId === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getDistributionTenant(ctx, tenantId);
      const found = ctx.store.get<StoredInvalidation>(
        tenantInvalidationKey + tenantId + "#" + invalidationId,
      );
      if (found === undefined) {
        throw awsError(
          "NoSuchInvalidation",
          `The specified invalidation does not exist: ${invalidationId}`,
          404,
        );
      }
      return { Invalidation: invalidationView(found) };
    },
    ListInvalidationsForDistributionTenant: (input, ctx) => {
      const tenantId =
        typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (tenantId === undefined || tenantId === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getDistributionTenant(ctx, tenantId);
      const prefix = tenantInvalidationKey + tenantId + "#";
      const entries = ctx.store
        .list<StoredInvalidation>()
        .filter((e) => e.key.startsWith(prefix));
      return {
        InvalidationList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: entries.length,
          Items: entries.map((e) => invalidationView(e.value)),
        },
      };
    },
    CreateFieldLevelEncryptionConfig: (input, ctx) => {
      const config = asRecord(input["FieldLevelEncryptionConfig"]);
      const callerReference = config["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidArgument", "CallerReference is required", 400);
      }
      const id = generateId("FLE");
      const entry: StoredFieldLevelEncryption = {
        id,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredFieldLevelEncryption>(
        fieldLevelEncryptionKey + id,
        entry,
      );
      return {
        FieldLevelEncryption: fieldLevelEncryptionView(entry),
        Location: `https://cloudfront.amazonaws.com/2020-05-31/field-level-encryption/${id}`,
        ETag: entry.etag,
      };
    },
    GetFieldLevelEncryption: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getFieldLevelEncryption(ctx, id);
      return {
        FieldLevelEncryption: fieldLevelEncryptionView(entry),
        ETag: entry.etag,
      };
    },
    GetFieldLevelEncryptionConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getFieldLevelEncryption(ctx, id);
      return {
        FieldLevelEncryptionConfig: entry.config,
        ETag: entry.etag,
      };
    },
    ListFieldLevelEncryptionConfigs: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredFieldLevelEncryption>()
        .filter((e) => e.key.startsWith(fieldLevelEncryptionKey));
      return {
        FieldLevelEncryptionList: {
          MaxItems: 100,
          Quantity: entries.length,
          Items: entries.map((e) => fieldLevelEncryptionView(e.value)),
          NextMarker: undefined,
        },
      };
    },
    UpdateFieldLevelEncryptionConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getFieldLevelEncryption(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const config = asRecord(input["FieldLevelEncryptionConfig"]);
      const updated: StoredFieldLevelEncryption = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredFieldLevelEncryption>(
        fieldLevelEncryptionKey + id,
        updated,
      );
      return {
        FieldLevelEncryption: fieldLevelEncryptionView(updated),
        ETag: updated.etag,
      };
    },
    DeleteFieldLevelEncryptionConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getFieldLevelEncryption(ctx, id);
      ctx.store.delete(fieldLevelEncryptionKey + id);
      return undefined;
    },
    CreateFieldLevelEncryptionProfile: (input, ctx) => {
      const config = asRecord(input["FieldLevelEncryptionProfileConfig"]);
      const name = config["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const id = generateId("FLEP");
      const entry: StoredFieldLevelEncryptionProfile = {
        id,
        name: name as string,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredFieldLevelEncryptionProfile>(
        fieldLevelEncryptionProfileKey + id,
        entry,
      );
      return {
        FieldLevelEncryptionProfile: fieldLevelEncryptionProfileView(entry),
        Location: `https://cloudfront.amazonaws.com/2020-05-31/field-level-encryption-profile/${id}`,
        ETag: entry.etag,
      };
    },
    GetFieldLevelEncryptionProfile: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getFieldLevelEncryptionProfile(ctx, id);
      return {
        FieldLevelEncryptionProfile: fieldLevelEncryptionProfileView(entry),
        ETag: entry.etag,
      };
    },
    GetFieldLevelEncryptionProfileConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getFieldLevelEncryptionProfile(ctx, id);
      return {
        FieldLevelEncryptionProfileConfig: entry.config,
        ETag: entry.etag,
      };
    },
    ListFieldLevelEncryptionProfiles: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredFieldLevelEncryptionProfile>()
        .filter((e) => e.key.startsWith(fieldLevelEncryptionProfileKey));
      return {
        FieldLevelEncryptionProfileList: {
          MaxItems: 100,
          Quantity: entries.length,
          Items: entries.map((e) => fieldLevelEncryptionProfileView(e.value)),
          NextMarker: undefined,
        },
      };
    },
    UpdateFieldLevelEncryptionProfile: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getFieldLevelEncryptionProfile(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const config = asRecord(input["FieldLevelEncryptionProfileConfig"]);
      const updated: StoredFieldLevelEncryptionProfile = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredFieldLevelEncryptionProfile>(
        fieldLevelEncryptionProfileKey + id,
        updated,
      );
      return {
        FieldLevelEncryptionProfile: fieldLevelEncryptionProfileView(updated),
        ETag: updated.etag,
      };
    },
    DeleteFieldLevelEncryptionProfile: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getFieldLevelEncryptionProfile(ctx, id);
      ctx.store.delete(fieldLevelEncryptionProfileKey + id);
      return undefined;
    },
    CreateKeyGroup: (input, ctx) => {
      const config = asRecord(input["KeyGroupConfig"]);
      const name = config["Name"];
      if (typeof name !== "string" || name === "") {
        throw awsError("InvalidArgument", "Name is required", 400);
      }
      const id = generateId("KG");
      const entry: StoredKeyGroup = {
        id,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredKeyGroup>(keyGroupKey + id, entry);
      return {
        KeyGroup: keyGroupView(entry),
        Location: `https://cloudfront.amazonaws.com/2020-05-31/key-group/${id}`,
        ETag: entry.etag,
      };
    },
    GetKeyGroup: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getKeyGroup(ctx, id);
      return {
        KeyGroup: keyGroupView(entry),
        ETag: entry.etag,
      };
    },
    GetKeyGroupConfig: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getKeyGroup(ctx, id);
      return {
        KeyGroupConfig: entry.config,
        ETag: entry.etag,
      };
    },
    ListKeyGroups: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredKeyGroup>()
        .filter((e) => e.key.startsWith(keyGroupKey));
      return {
        KeyGroupList: {
          MaxItems: 100,
          Quantity: entries.length,
          Items: entries.map((e) => ({
            KeyGroup: keyGroupView(e.value),
          })),
          NextMarker: undefined,
        },
      };
    },
    UpdateKeyGroup: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const entry = getKeyGroup(ctx, id);
      const ifMatch =
        typeof input["IfMatch"] === "string" ? input["IfMatch"] : undefined;
      if (ifMatch !== undefined && ifMatch !== entry.etag) {
        throw awsError(
          "PreconditionFailed",
          "The If-Match version is not current for the resource.",
          412,
        );
      }
      const config = asRecord(input["KeyGroupConfig"]);
      const updated: StoredKeyGroup = {
        ...entry,
        lastModifiedTime: new Date().toISOString(),
        etag: generateId("ETAG"),
        config,
      };
      ctx.store.set<StoredKeyGroup>(keyGroupKey + id, updated);
      return {
        KeyGroup: keyGroupView(updated),
        ETag: updated.etag,
      };
    },
    DeleteKeyGroup: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getKeyGroup(ctx, id);
      ctx.store.delete(keyGroupKey + id);
      return undefined;
    },
    ListDistributionsByKeyGroup: (input, ctx) => {
      const keyGroupId =
        typeof input["KeyGroupId"] === "string" ? input["KeyGroupId"] : "";
      const dists = getDistributions(ctx).filter((d) =>
        JSON.stringify(d.config).includes(keyGroupId),
      );
      return {
        DistributionIdList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map((d) => d.id),
        },
      };
    },
    ListTagsForResource: (input, _ctx) => {
      const resource =
        typeof input["Resource"] === "string" ? input["Resource"] : "";
      const stored = _ctx.store.get<{ Items: Record<string, string>[] }>(
        tagKey + resource,
      );
      const items = stored?.Items ?? [];
      return {
        Tags: { Items: items },
      };
    },
    TagResource: (input, ctx) => {
      const resource =
        typeof input["Resource"] === "string" ? input["Resource"] : "";
      const tags = asRecord(input["Tags"] ?? {});
      const existing = ctx.store.get<{ Items: Record<string, string>[] }>(
        tagKey + resource,
      );
      const existingItems = existing?.Items ?? [];
      const newItems = Array.isArray(tags["Items"])
        ? (tags["Items"] as Record<string, string>[])
        : [];
      const merged = [...existingItems];
      for (const tag of newItems) {
        const idx = merged.findIndex((t) => t["Key"] === tag["Key"]);
        if (idx >= 0) {
          merged[idx] = tag;
        } else {
          merged.push(tag);
        }
      }
      ctx.store.set<{ Items: Record<string, string>[] }>(tagKey + resource, {
        Items: merged,
      });
      return undefined;
    },
    UntagResource: (input, ctx) => {
      const resource =
        typeof input["Resource"] === "string" ? input["Resource"] : "";
      const tagKeys = asRecord(input["TagKeys"] ?? {});
      const existing = ctx.store.get<{ Items: Record<string, string>[] }>(
        tagKey + resource,
      );
      if (existing === undefined) return undefined;
      const keysToRemove = Array.isArray(tagKeys["Items"])
        ? (tagKeys["Items"] as string[])
        : [];
      const filtered = existing.Items.filter(
        (t) => !keysToRemove.includes(t["Key"] ?? ""),
      );
      ctx.store.set<{ Items: Record<string, string>[] }>(tagKey + resource, {
        Items: filtered,
      });
      return undefined;
    },
    ListDistributionsByCachePolicyId: (input, ctx) => {
      const cachePolicyId =
        typeof input["CachePolicyId"] === "string"
          ? input["CachePolicyId"]
          : "";
      const dists = getDistributions(ctx).filter((d) => {
        const dcb = asRecord(d.config["DefaultCacheBehavior"]);
        if (dcb["CachePolicyId"] === cachePolicyId) return true;
        const cbs = asRecord(d.config["CacheBehaviors"]);
        const items = Array.isArray(cbs["Items"])
          ? (cbs["Items"] as unknown[])
          : [];
        return items.some(
          (item) => asRecord(item)["CachePolicyId"] === cachePolicyId,
        );
      });
      return {
        DistributionIdList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map((d) => d.id),
        },
      };
    },
    ListDistributionsByOriginRequestPolicyId: (input, ctx) => {
      const policyId =
        typeof input["OriginRequestPolicyId"] === "string"
          ? input["OriginRequestPolicyId"]
          : "";
      const dists = getDistributions(ctx).filter((d) =>
        JSON.stringify(d.config).includes(policyId),
      );
      return {
        DistributionIdList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map((d) => d.id),
        },
      };
    },
    ListDistributionsByRealtimeLogConfig: (input, ctx) => {
      const configArn =
        typeof input["RealtimeLogConfigArn"] === "string"
          ? input["RealtimeLogConfigArn"]
          : "";
      const dists = getDistributions(ctx).filter((d) =>
        JSON.stringify(d.config).includes(configArn),
      );
      return {
        DistributionList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map(distributionSummaryView),
        },
      };
    },
    ListDistributionsByResponseHeadersPolicyId: (input, ctx) => {
      const policyId =
        typeof input["ResponseHeadersPolicyId"] === "string"
          ? input["ResponseHeadersPolicyId"]
          : "";
      const dists = getDistributions(ctx).filter((d) =>
        JSON.stringify(d.config).includes(policyId),
      );
      return {
        DistributionIdList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map((d) => d.id),
        },
      };
    },
    ListDistributionsByTrustStore: (_input, ctx) => {
      const dists = getDistributions(ctx);
      return {
        DistributionIdList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map((d) => d.id),
        },
      };
    },
    ListDistributionsByVpcOriginId: (_input, ctx) => {
      const dists = getDistributions(ctx);
      return {
        DistributionIdList: {
          Marker: "",
          MaxItems: 100,
          IsTruncated: false,
          Quantity: dists.length,
          Items: dists.map((d) => d.id),
        },
      };
    },
  },
  model,
};

export default cloudfront;
