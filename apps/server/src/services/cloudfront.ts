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
      const entries = ctx.store.list<StoredDistribution>();
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
  },
  model,
};

export default cloudfront;
