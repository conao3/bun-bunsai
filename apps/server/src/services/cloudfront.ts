import type {
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cloudfrontModel from "../../../../test/vendor/aws-models/cloudfront.json" with { type: "json" };

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
      if (method === "GET") return "GetCachePolicy";
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
          (e) =>
            !e.key.startsWith(cachePolicyKey) &&
            !e.key.startsWith(publicKeyKey) &&
            !e.key.startsWith(oaiKey) &&
            !e.key.startsWith(oacKey) &&
            !e.key.startsWith(invalidationKey) &&
            !e.key.startsWith(monsubKey),
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
      getDistribution(ctx, id);
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
            !e.key.startsWith(cachePolicyKey) &&
            !e.key.startsWith(publicKeyKey) &&
            !e.key.startsWith(oaiKey) &&
            !e.key.startsWith(oacKey) &&
            !e.key.startsWith(invalidationKey) &&
            !e.key.startsWith(monsubKey) &&
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
          (e) =>
            !e.key.startsWith(cachePolicyKey) &&
            !e.key.startsWith(publicKeyKey) &&
            !e.key.startsWith(oaiKey) &&
            !e.key.startsWith(oacKey) &&
            !e.key.startsWith(invalidationKey) &&
            !e.key.startsWith(monsubKey),
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
      ctx.store.delete(publicKeyKey + id);
      return undefined;
    },
    CreateCloudFrontOriginAccessIdentity: (input, ctx) => {
      const config = asRecord(input["CloudFrontOriginAccessIdentityConfig"]);
      const callerReference = config["CallerReference"];
      if (typeof callerReference !== "string" || callerReference === "") {
        throw awsError("InvalidArgument", "CallerReference is required", 400);
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
  },
  model,
};

export default cloudfront;
