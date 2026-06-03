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
const cachePolicyKey = "cachepolicy#";
const publicKeyKey = "publickey#";

type StoredDistribution = {
  id: string;
  arn: string;
  status: string;
  lastModifiedTime: string;
  domainName: string;
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

const idFromPath = (path: string): string | undefined => {
  if (!path.startsWith(apiPrefix)) return undefined;
  const rest = path
    .slice(apiPrefix.length)
    .replace(/^\//, "")
    .replace(/\/$/, "");
  if (rest === "") return undefined;
  const segment = rest.split("/")[0];
  if (segment === undefined || segment === "") return undefined;
  return decodeURIComponent(segment);
};

const asRecord = (raw: unknown): Record<string, unknown> =>
  typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : {};

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
    CacheBehaviors: { Quantity: 0 },
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
    if (req.path.startsWith(cachePolicyPrefix)) {
      const rest = req.path.slice(cachePolicyPrefix.length).replace(/\/$/, "");
      if (rest === "") {
        if (req.method === "POST") return "CreateCachePolicy";
        if (req.method === "GET") return "ListCachePolicies";
        return undefined;
      }
      if (req.method === "GET") return "GetCachePolicy";
      if (req.method === "DELETE") return "DeleteCachePolicy";
      return undefined;
    }
    if (req.path.startsWith(publicKeyPrefix)) {
      const rest = req.path.slice(publicKeyPrefix.length).replace(/\/$/, "");
      if (rest === "") {
        if (req.method === "POST") return "CreatePublicKey";
        if (req.method === "GET") return "ListPublicKeys";
        return undefined;
      }
      if (req.method === "GET") return "GetPublicKey";
      if (req.method === "DELETE") return "DeletePublicKey";
      return undefined;
    }
    if (!req.path.startsWith(apiPrefix)) return undefined;
    const rest = req.path.slice(apiPrefix.length).replace(/\/$/, "");
    if (rest === "") {
      if (req.method === "POST") return "CreateDistribution";
      if (req.method === "GET") return "ListDistributions";
      return undefined;
    }
    if (rest.endsWith("/config")) {
      if (req.method === "PUT") return "UpdateDistribution";
      return undefined;
    }
    if (rest.endsWith("/invalidation")) {
      if (req.method === "POST") return "CreateInvalidation";
      return undefined;
    }
    if (req.method === "GET") return "GetDistribution";
    if (req.method === "DELETE") return "DeleteDistribution";
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
    ListDistributions: (_input, ctx) => {
      const entries = ctx.store
        .list<StoredDistribution>()
        .filter(
          (e) =>
            !e.key.startsWith(cachePolicyKey) &&
            !e.key.startsWith(publicKeyKey),
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
    DeleteDistribution: (input, ctx) => {
      const id = typeof input["Id"] === "string" ? input["Id"] : undefined;
      if (id === undefined || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      getDistribution(ctx, id);
      ctx.store.delete(id);
      return undefined;
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
      return {
        Location: `https://cloudfront.amazonaws.com${apiPrefix}/${id}/invalidation/${invalidationId}`,
        Invalidation: {
          Id: invalidationId,
          Status: "Completed",
          CreateTime: new Date().toISOString(),
          InvalidationBatch: {
            Paths: batch["Paths"] ?? { Quantity: 0 },
            CallerReference:
              typeof batch["CallerReference"] === "string"
                ? batch["CallerReference"]
                : "",
          },
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
  },
  model,
};

export default cloudfront;
