import type {
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import { deliverToArn } from "../core/events.ts";

const model = lazyServiceModel(
  () => import("../../models/s3.json", { with: { type: "json" } }),
);

type S3Object = {
  key: string;
  body: Uint8Array;
  contentType: string;
  etag: string;
  size: number;
  lastModified: number;
  tagSet: S3Tag[];
  userMetadata: Record<string, string>;
  storageClass: string;
  versionId?: string;
  isDeleteMarker?: boolean;
  acl?: string;
  contentDisposition?: string;
  cacheControl?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  expires?: number;
  retention?: { Mode: string; RetainUntilDate: number };
  legalHold?: string;
  serverSideEncryption?: string;
};

type S3Tag = {
  Key: string;
  Value: string;
};

type S3Part = {
  partNumber: number;
  body: Uint8Array;
  etag: string;
  size: number;
  lastModified: number;
};

type S3Upload = {
  uploadId: string;
  key: string;
  initiated: number;
  contentType: string;
  parts: Record<string, S3Part>;
  userMetadata: Record<string, string>;
  storageClass: string;
  contentDisposition?: string;
  cacheControl?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  expires?: number;
};

type S3Bucket = {
  name: string;
  creationDate: number;
  objects: Record<string, S3Object[]>;
  tagSet: S3Tag[];
  uploads: Record<string, S3Upload>;
  versioningStatus: string | undefined;
  mfaDelete: string | undefined;
  policy: string | undefined;
  lifecycleRules: unknown[];
  corsRules: unknown[];
  website: Record<string, unknown> | undefined;
  encryptionRules: unknown[];
  notification: Record<string, unknown> | undefined;
  publicAccessBlock: Record<string, unknown> | undefined;
  logging: Record<string, unknown> | undefined;
  accelerateStatus: string | undefined;
  objectLock: Record<string, unknown> | undefined;
  acl?: string;
  replication: Record<string, unknown> | undefined;
  requestPayment: string;
  analyticsConfigs: Record<string, unknown>;
  inventoryConfigs: Record<string, unknown>;
  metricsConfigs: Record<string, unknown>;
  intelligentTieringConfigs: Record<string, unknown>;
  metadataConfiguration: Record<string, unknown> | undefined;
  metadataTableConfiguration: Record<string, unknown> | undefined;
  metadataInventoryTableConfiguration: Record<string, unknown> | undefined;
  metadataJournalTableConfiguration: Record<string, unknown> | undefined;
  ownershipControls: Record<string, unknown> | undefined;
  abacStatus: Record<string, unknown> | undefined;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const md5Hex = (value: Uint8Array): string =>
  new Bun.CryptoHasher("md5").update(value).digest("hex");

const md5Bytes = (value: Uint8Array): Uint8Array =>
  new Bun.CryptoHasher("md5").update(value).digest();

const hashBody = (value: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value[i];
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, "0").repeat(4).slice(0, 32);
};

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
};

const hashWithPrefix = (prefix: string, body: Uint8Array): string =>
  hashBody(concatBytes([new TextEncoder().encode(prefix), body]));

const generateVersionId = (): string => crypto.randomUUID().replace(/-/g, "");

const matchesNullVersion = (
  requested: string | undefined,
  stored: string | undefined,
): boolean =>
  requested === stored || (requested === "null" && stored === undefined);

const getCurrentObject = (
  versions: S3Object[] | undefined,
): S3Object | undefined => {
  if (versions === undefined || versions.length === 0) return undefined;
  const latest = versions[0];
  return latest.isDeleteMarker ? undefined : latest;
};

const versionIndexFor = (versions: S3Object[], versionId: unknown): number => {
  if (typeof versionId !== "string" || versionId === "") {
    return versions.length > 0 ? 0 : -1;
  }
  return versions.findIndex((v) => matchesNullVersion(versionId, v.versionId));
};

const ensureVersionDeletable = (
  object: S3Object,
  input: Record<string, unknown>,
): void => {
  if (object.legalHold === "ON") {
    throw awsError("AccessDenied", "Access Denied", 403);
  }
  const retention = object.retention;
  if (retention === undefined) return;
  if (retention.RetainUntilDate <= nowSeconds()) return;
  const bypass =
    input["BypassGovernanceRetention"] === true ||
    input["BypassGovernanceRetention"] === "true";
  if (retention.Mode === "GOVERNANCE" && bypass) return;
  throw awsError("AccessDenied", "Access Denied", 403);
};

const ALL_USERS_URI =
  "http://acs.amazonaws.com/groups/global/AllUsers" as const;
const AUTH_USERS_URI =
  "http://acs.amazonaws.com/groups/global/AuthenticatedUsers" as const;

const cannedAclGrants = (acl: string | undefined) => {
  const ownerGrant = {
    Grantee: { ID: "bunsai", DisplayName: "bunsai", Type: "CanonicalUser" },
    Permission: "FULL_CONTROL",
  };
  const allUsersRead = {
    Grantee: { URI: ALL_USERS_URI, Type: "Group" },
    Permission: "READ",
  };
  const allUsersWrite = {
    Grantee: { URI: ALL_USERS_URI, Type: "Group" },
    Permission: "WRITE",
  };
  const authUsersRead = {
    Grantee: { URI: AUTH_USERS_URI, Type: "Group" },
    Permission: "READ",
  };
  if (acl === "public-read") return [ownerGrant, allUsersRead];
  if (acl === "public-read-write")
    return [ownerGrant, allUsersRead, allUsersWrite];
  if (acl === "authenticated-read") return [ownerGrant, authUsersRead];
  return [ownerGrant];
};

const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const bucketKeyFromPath = (
  path: string,
): { bucket: string | undefined; key: string | undefined } => {
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  if (trimmed === "") return { bucket: undefined, key: undefined };
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return { bucket: decodeURIComponent(trimmed), key: undefined };
  }
  const bucket = decodeURIComponent(trimmed.slice(0, slash));
  const rawKey = trimmed.slice(slash + 1);
  return {
    bucket,
    key: rawKey === "" ? undefined : decodeURIComponent(rawKey),
  };
};

const endpointBaseNames = new Set(["localhost", "bunsai.test"]);

export const virtualHostBucket = (host: string | null): string | undefined => {
  if (host === null) return undefined;
  const hostname = host.split(":")[0];
  if (endpointBaseNames.has(hostname) || /^[\d.]+$/.test(hostname))
    return undefined;
  const dot = hostname.indexOf(".");
  if (dot === -1) return undefined;
  const first = hostname.slice(0, dot);
  const rest = hostname.slice(dot + 1);
  if (first === "" || first === "s3" || first.startsWith("s3-"))
    return undefined;
  if (endpointBaseNames.has(rest) || rest.startsWith("s3.")) return first;
  return undefined;
};

const normalizeEtag = (value: string): string =>
  value.startsWith("W/") ? value.slice(2) : value;

const etagMatches = (header: string, etag: string): boolean =>
  header
    .split(",")
    .map((entry) => entry.trim())
    .some(
      (entry) => entry === "*" || normalizeEtag(entry) === normalizeEtag(etag),
    );

const asSeconds = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const evaluateConditional = (
  input: Record<string, unknown>,
  object: S3Object,
): void => {
  const ifMatch = input["IfMatch"];
  const ifNoneMatch = input["IfNoneMatch"];
  const ifModifiedSince = asSeconds(input["IfModifiedSince"]);
  const ifUnmodifiedSince = asSeconds(input["IfUnmodifiedSince"]);
  if (typeof ifMatch === "string") {
    if (!etagMatches(ifMatch, object.etag)) {
      throw awsError(
        "PreconditionFailed",
        "At least one of the pre-conditions you specified did not hold",
        412,
      );
    }
  } else if (
    ifUnmodifiedSince !== undefined &&
    object.lastModified > ifUnmodifiedSince
  ) {
    throw awsError(
      "PreconditionFailed",
      "At least one of the pre-conditions you specified did not hold",
      412,
    );
  }
  if (typeof ifNoneMatch === "string") {
    if (etagMatches(ifNoneMatch, object.etag)) {
      throw awsError("NotModified", "Not Modified", 304);
    }
  } else if (
    ifModifiedSince !== undefined &&
    object.lastModified <= ifModifiedSince
  ) {
    throw awsError("NotModified", "Not Modified", 304);
  }
};

const getBucket = (ctx: ServiceContext, name: string): S3Bucket => {
  const bucket = ctx.store.get<S3Bucket>(name);
  if (bucket === undefined) {
    throw awsError("NoSuchBucket", "The specified bucket does not exist", 404);
  }
  return bucket;
};

const asArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (typeof value === "object" && value !== null)
    return [value as Record<string, unknown>];
  return [];
};

const eventMatches = (configured: string, actual: string): boolean => {
  if (configured.endsWith("*"))
    return actual.startsWith(configured.slice(0, -1));
  return configured === actual;
};

const filterMatches = (filter: unknown, key: string): boolean => {
  const filterKey =
    typeof filter === "object" && filter !== null
      ? (filter as Record<string, unknown>)["Key"]
      : undefined;
  const rules =
    typeof filterKey === "object" && filterKey !== null
      ? asArray((filterKey as Record<string, unknown>)["FilterRules"])
      : [];
  for (const rule of rules) {
    const name = String(rule["Name"] ?? "").toLowerCase();
    const value = String(rule["Value"] ?? "");
    if (name === "prefix" && !key.startsWith(value)) return false;
    if (name === "suffix" && !key.endsWith(value)) return false;
  }
  return true;
};

const emitS3Notification = async (
  ctx: ServiceContext,
  bucketName: string,
  notification: Record<string, unknown> | undefined,
  eventName: string,
  key: string,
  object: S3Object | undefined,
): Promise<void> => {
  if (notification === undefined) return;
  const fullEventName = `s3:${eventName}`;
  const record = {
    eventVersion: "2.1",
    eventSource: "aws:s3",
    awsRegion: ctx.region,
    eventTime: new Date().toISOString(),
    eventName,
    s3: {
      s3SchemaVersion: "1.0",
      bucket: { name: bucketName, arn: `arn:aws:s3:::${bucketName}` },
      object: {
        key,
        size: object?.size ?? 0,
        eTag: object?.etag.replaceAll('"', "") ?? "",
      },
    },
  };
  const payload = JSON.stringify({ Records: [record] });
  const configs: { arnKey: string; entries: Record<string, unknown>[] }[] = [
    {
      arnKey: "QueueArn",
      entries: asArray(notification["QueueConfigurations"]),
    },
    {
      arnKey: "TopicArn",
      entries: asArray(notification["TopicConfigurations"]),
    },
    {
      arnKey: "LambdaFunctionArn",
      entries: asArray(notification["LambdaFunctionConfigurations"]),
    },
  ];
  for (const { arnKey, entries } of configs) {
    for (const entry of entries) {
      const arn = entry[arnKey];
      if (typeof arn !== "string") continue;
      const rawEvents = entry["Events"];
      const events = Array.isArray(rawEvents)
        ? (rawEvents as string[])
        : typeof rawEvents === "string"
          ? [rawEvents]
          : [];
      if (!events.some((e) => eventMatches(e, fullEventName))) continue;
      if (!filterMatches(entry["Filter"], key)) continue;
      await deliverToArn(ctx, arn, {
        body: payload,
        event: { Records: [record] },
      });
    }
  }
};

const parseTagSet = (tagging: unknown): S3Tag[] => {
  const rawTagSet =
    typeof tagging === "object" && tagging !== null
      ? (tagging as Record<string, unknown>)["TagSet"]
      : undefined;
  if (!Array.isArray(rawTagSet)) return [];
  return rawTagSet.flatMap((tag) => {
    if (typeof tag !== "object" || tag === null) return [];
    const record = tag as Record<string, unknown>;
    const tagKey = record["Key"];
    const tagValue = record["Value"];
    if (typeof tagKey !== "string" || typeof tagValue !== "string") return [];
    return [{ Key: tagKey, Value: tagValue }];
  });
};

const parseTaggingHeader = (tagging: unknown): S3Tag[] => {
  if (typeof tagging !== "string" || tagging === "") return [];
  return tagging.split("&").flatMap((pair) => {
    const eq = pair.indexOf("=");
    if (eq === -1) return [];
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = decodeURIComponent(pair.slice(eq + 1));
    return [{ Key: k, Value: v }];
  });
};

const s3: ServiceDefinition = {
  name: "s3",
  protocol: "rest-xml",
  xmlErrorRoot: "Error",
  mapValidationError: (error) => {
    if (error.member?.endsWith("LocationConstraint") === true) {
      return {
        code: "InvalidLocationConstraint",
        message: "The specified location-constraint is not valid",
        statusCode: 400,
      };
    }
    return undefined;
  },
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const { bucket, key } = bucketKeyFromPath(req.path);
    if (bucket === undefined) {
      if (req.method === "GET") return "ListBuckets";
      return undefined;
    }
    if (key === undefined) {
      const hasTagging = req.query.has("tagging");
      const hasLocation = req.query.has("location");
      const hasUploads = req.query.has("uploads");
      const hasVersioning = req.query.has("versioning");
      const hasPolicy = req.query.has("policy");
      const hasAcl = req.query.has("acl");
      const hasLifecycle = req.query.has("lifecycle");
      const hasCors = req.query.has("cors");
      const hasWebsite = req.query.has("website");
      const hasEncryption = req.query.has("encryption");
      const hasNotification = req.query.has("notification");
      const hasPublicAccessBlock = req.query.has("publicAccessBlock");
      const hasLogging = req.query.has("logging");
      const hasAccelerate = req.query.has("accelerate");
      const hasObjectLock = req.query.has("object-lock");
      const hasReplication = req.query.has("replication");
      const hasRequestPayment = req.query.has("requestPayment");
      const hasAnalytics = req.query.has("analytics");
      const hasInventory = req.query.has("inventory");
      const hasMetrics = req.query.has("metrics");
      const hasIntelligentTiering = req.query.has("intelligent-tiering");
      const hasMetadataConfiguration = req.query.has("metadataConfiguration");
      const hasMetadataTable = req.query.has("metadataTable");
      const hasOwnershipControls = req.query.has("ownershipControls");
      const hasAbac = req.query.has("abac");
      const hasPolicyStatus = req.query.has("policyStatus");
      const hasMetadataInventoryTable = req.query.has("metadataInventoryTable");
      const hasMetadataJournalTable = req.query.has("metadataJournalTable");
      if (req.method === "PUT") {
        if (hasTagging) return "PutBucketTagging";
        if (hasVersioning) return "PutBucketVersioning";
        if (hasPolicy) return "PutBucketPolicy";
        if (hasLifecycle) return "PutBucketLifecycleConfiguration";
        if (hasCors) return "PutBucketCors";
        if (hasWebsite) return "PutBucketWebsite";
        if (hasEncryption) return "PutBucketEncryption";
        if (hasNotification) return "PutBucketNotificationConfiguration";
        if (hasPublicAccessBlock) return "PutPublicAccessBlock";
        if (hasLogging) return "PutBucketLogging";
        if (hasAccelerate) return "PutBucketAccelerateConfiguration";
        if (hasObjectLock) return "PutObjectLockConfiguration";
        if (hasReplication) return "PutBucketReplication";
        if (hasRequestPayment) return "PutBucketRequestPayment";
        if (hasAcl) return "PutBucketAcl";
        if (hasAnalytics) return "PutBucketAnalyticsConfiguration";
        if (hasInventory) return "PutBucketInventoryConfiguration";
        if (hasMetrics) return "PutBucketMetricsConfiguration";
        if (hasIntelligentTiering)
          return "PutBucketIntelligentTieringConfiguration";
        if (hasMetadataInventoryTable)
          return "UpdateBucketMetadataInventoryTableConfiguration";
        if (hasMetadataJournalTable)
          return "UpdateBucketMetadataJournalTableConfiguration";
        if (hasOwnershipControls) return "PutBucketOwnershipControls";
        if (hasAbac) return "PutBucketAbac";
        return "CreateBucket";
      }
      if (req.method === "DELETE") {
        if (hasTagging) return "DeleteBucketTagging";
        if (hasPolicy) return "DeleteBucketPolicy";
        if (hasLifecycle) return "DeleteBucketLifecycle";
        if (hasCors) return "DeleteBucketCors";
        if (hasWebsite) return "DeleteBucketWebsite";
        if (hasPublicAccessBlock) return "DeletePublicAccessBlock";
        if (hasReplication) return "DeleteBucketReplication";
        if (hasAnalytics) return "DeleteBucketAnalyticsConfiguration";
        if (hasInventory) return "DeleteBucketInventoryConfiguration";
        if (hasMetrics) return "DeleteBucketMetricsConfiguration";
        if (hasIntelligentTiering)
          return "DeleteBucketIntelligentTieringConfiguration";
        if (hasMetadataConfiguration)
          return "DeleteBucketMetadataConfiguration";
        if (hasMetadataTable) return "DeleteBucketMetadataTableConfiguration";
        if (hasOwnershipControls) return "DeleteBucketOwnershipControls";
        if (hasEncryption) return "DeleteBucketEncryption";
        return "DeleteBucket";
      }
      if (req.method === "GET") {
        if (hasTagging) return "GetBucketTagging";
        if (hasLocation) return "GetBucketLocation";
        if (hasUploads) return "ListMultipartUploads";
        if (hasVersioning) return "GetBucketVersioning";
        if (hasPolicy) return "GetBucketPolicy";
        if (hasAcl) return "GetBucketAcl";
        if (hasLifecycle) return "GetBucketLifecycleConfiguration";
        if (hasCors) return "GetBucketCors";
        if (hasWebsite) return "GetBucketWebsite";
        if (hasEncryption) return "GetBucketEncryption";
        if (hasNotification) return "GetBucketNotificationConfiguration";
        if (hasPublicAccessBlock) return "GetPublicAccessBlock";
        if (hasLogging) return "GetBucketLogging";
        if (hasAccelerate) return "GetBucketAccelerateConfiguration";
        if (hasObjectLock) return "GetObjectLockConfiguration";
        if (hasReplication) return "GetBucketReplication";
        if (hasRequestPayment) return "GetBucketRequestPayment";
        if (hasAnalytics)
          return req.query.has("id")
            ? "GetBucketAnalyticsConfiguration"
            : "ListBucketAnalyticsConfigurations";
        if (hasInventory)
          return req.query.has("id")
            ? "GetBucketInventoryConfiguration"
            : "ListBucketInventoryConfigurations";
        if (hasMetrics)
          return req.query.has("id")
            ? "GetBucketMetricsConfiguration"
            : "ListBucketMetricsConfigurations";
        if (hasIntelligentTiering)
          return req.query.has("id")
            ? "GetBucketIntelligentTieringConfiguration"
            : "ListBucketIntelligentTieringConfigurations";
        if (hasMetadataConfiguration) return "GetBucketMetadataConfiguration";
        if (hasMetadataTable) return "GetBucketMetadataTableConfiguration";
        if (hasOwnershipControls) return "GetBucketOwnershipControls";
        if (hasAbac) return "GetBucketAbac";
        if (hasPolicyStatus) return "GetBucketPolicyStatus";
        if (req.query.has("versions")) return "ListObjectVersions";
        if (req.query.get("list-type") === "2") return "ListObjectsV2";
        return "ListObjects";
      }
      if (req.method === "POST") {
        if (req.query.has("delete")) return "DeleteObjects";
        if (hasMetadataConfiguration)
          return "CreateBucketMetadataConfiguration";
        if (hasMetadataTable) return "CreateBucketMetadataTableConfiguration";
        return undefined;
      }
      if (req.method === "HEAD") return "HeadBucket";
      return undefined;
    }
    const hasUploads = req.query.has("uploads");
    const hasUploadId = req.query.has("uploadId");
    const hasObjectTagging = req.query.has("tagging");
    const hasObjectAcl = req.query.has("acl");
    const hasRetention = req.query.has("retention");
    const hasLegalHold = req.query.has("legal-hold");
    const hasAttributes = req.query.has("attributes");
    if (req.method === "POST") {
      if (hasUploads) return "CreateMultipartUpload";
      if (hasUploadId) return "CompleteMultipartUpload";
      return undefined;
    }
    if (req.method === "PUT") {
      if (hasUploadId) {
        if (req.headers.get("x-amz-copy-source") !== null)
          return "UploadPartCopy";
        return "UploadPart";
      }
      if (hasObjectTagging) return "PutObjectTagging";
      if (hasObjectAcl) return "PutObjectAcl";
      if (hasRetention) return "PutObjectRetention";
      if (hasLegalHold) return "PutObjectLegalHold";
      if (req.headers.get("x-amz-copy-source") !== null) return "CopyObject";
      return "PutObject";
    }
    if (req.method === "GET") {
      if (hasUploadId) return "ListParts";
      if (hasObjectTagging) return "GetObjectTagging";
      if (hasObjectAcl) return "GetObjectAcl";
      if (hasRetention) return "GetObjectRetention";
      if (hasLegalHold) return "GetObjectLegalHold";
      if (hasAttributes) return "GetObjectAttributes";
      return "GetObject";
    }
    if (req.method === "HEAD") return "HeadObject";
    if (req.method === "DELETE") {
      if (hasUploadId) return "AbortMultipartUpload";
      if (hasObjectTagging) return "DeleteObjectTagging";
      return "DeleteObject";
    }
    return undefined;
  },
  operations: {
    CreateBucket: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      if (ctx.store.get<S3Bucket>(bucket) !== undefined) {
        throw awsError(
          "BucketAlreadyOwnedByYou",
          "Your previous request to create the named bucket succeeded and you already own it",
          409,
        );
      }
      const lockEnabled =
        input["ObjectLockEnabledForBucket"] === true ||
        input["ObjectLockEnabledForBucket"] === "true";
      ctx.store.set<S3Bucket>(bucket, {
        name: bucket,
        creationDate: nowSeconds(),
        objects: {},
        tagSet: [],
        uploads: {},
        versioningStatus: lockEnabled ? "Enabled" : undefined,
        mfaDelete: undefined,
        policy: undefined,
        lifecycleRules: [],
        corsRules: [],
        website: undefined,
        encryptionRules: [],
        notification: undefined,
        publicAccessBlock: undefined,
        logging: undefined,
        accelerateStatus: undefined,
        objectLock: lockEnabled ? { ObjectLockEnabled: "Enabled" } : undefined,
        acl: undefined,
        replication: undefined,
        requestPayment: "BucketOwner",
        analyticsConfigs: {},
        inventoryConfigs: {},
        metricsConfigs: {},
        intelligentTieringConfigs: {},
        metadataConfiguration: undefined,
        metadataTableConfiguration: undefined,
        metadataInventoryTableConfiguration: undefined,
        metadataJournalTableConfiguration: undefined,
        ownershipControls: undefined,
        abacStatus: undefined,
      });
      return { Location: `/${bucket}` };
    },
    ListBuckets: (_input, ctx) => {
      const buckets = ctx.store.list<S3Bucket>();
      return {
        Owner: { ID: "bunsai", DisplayName: "bunsai" },
        Buckets: buckets.map((b) => ({
          Name: b.value.name,
          CreationDate: b.value.creationDate,
        })),
      };
    },
    DeleteBucket: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (
        Object.keys(target.objects).length > 0 ||
        Object.keys(target.uploads).length > 0
      ) {
        throw awsError(
          "BucketNotEmpty",
          "The bucket you tried to delete is not empty",
          409,
        );
      }
      ctx.store.delete(bucket);
      return {};
    },
    HeadBucket: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      getBucket(ctx, bucket);
      return {
        $headers: {
          "x-amz-bucket-region": req.region,
          "x-amz-access-point-alias": "false",
        },
      };
    },
    PutObject: async (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const ifNoneMatch = input["IfNoneMatch"];
      if (typeof ifNoneMatch === "string") {
        const currentObj = getCurrentObject(target.objects[key]);
        if (
          currentObj !== undefined &&
          etagMatches(ifNoneMatch, currentObj.etag)
        ) {
          throw awsError(
            "PreconditionFailed",
            "At least one of the pre-conditions you specified did not hold",
            412,
            { Condition: "If-None-Match" },
          );
        }
      }
      const versioned = target.versioningStatus === "Enabled";
      const body = req.bodyBytes;
      const etag = `"${md5Hex(body)}"`;
      const metadata = input["Metadata"];
      const storageClass = input["StorageClass"];
      const versionId = versioned ? generateVersionId() : undefined;
      const acl = typeof input["ACL"] === "string" ? input["ACL"] : undefined;
      const contentDisposition =
        typeof input["ContentDisposition"] === "string"
          ? input["ContentDisposition"]
          : undefined;
      const cacheControl =
        typeof input["CacheControl"] === "string"
          ? input["CacheControl"]
          : undefined;
      const contentEncoding =
        typeof input["ContentEncoding"] === "string"
          ? input["ContentEncoding"]
          : undefined;
      const contentLanguage =
        typeof input["ContentLanguage"] === "string"
          ? input["ContentLanguage"]
          : undefined;
      const expires =
        typeof input["Expires"] === "number" ? input["Expires"] : undefined;
      const serverSideEncryption =
        typeof input["ServerSideEncryption"] === "string"
          ? input["ServerSideEncryption"]
          : "AES256";
      const object: S3Object = {
        key,
        body,
        contentType:
          req.headers.get("content-type") ?? "application/octet-stream",
        etag,
        size: body.byteLength,
        lastModified: nowSeconds(),
        tagSet: [],
        userMetadata:
          typeof metadata === "object" && metadata !== null
            ? (metadata as Record<string, string>)
            : {},
        storageClass:
          typeof storageClass === "string" ? storageClass : "STANDARD",
        versionId,
        acl,
        contentDisposition,
        cacheControl,
        contentEncoding,
        contentLanguage,
        expires,
        serverSideEncryption,
      };
      const existing = target.objects[key] ?? [];
      const versions = versioned ? [object, ...existing] : [object];
      const next: S3Bucket = {
        ...target,
        objects: { ...target.objects, [key]: versions },
      };
      ctx.store.set<S3Bucket>(bucket, next);
      await emitS3Notification(
        ctx,
        bucket,
        target.notification,
        "ObjectCreated:Put",
        key,
        object,
      );
      return {
        ETag: object.etag,
        ...(versionId !== undefined ? { VersionId: versionId } : {}),
        ServerSideEncryption: object.serverSideEncryption,
      };
    },
    GetObject: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const requestedVersionId =
        typeof input["VersionId"] === "string" ? input["VersionId"] : undefined;
      let object: S3Object | undefined;
      if (requestedVersionId !== undefined) {
        const found = (target.objects[key] ?? []).find((v) =>
          matchesNullVersion(requestedVersionId, v.versionId),
        );
        if (found === undefined) {
          throw awsError("NoSuchKey", "The specified key does not exist.", 404);
        }
        if (found.isDeleteMarker) {
          throw awsError(
            "MethodNotAllowed",
            "The specified method is not allowed against this resource.",
            405,
          );
        }
        object = found;
      } else {
        object = getCurrentObject(target.objects[key]);
        if (object === undefined) {
          throw awsError("NoSuchKey", "The specified key does not exist.", 404);
        }
      }
      evaluateConditional(input, object);
      const responseContentType =
        typeof input["ResponseContentType"] === "string"
          ? input["ResponseContentType"]
          : undefined;
      const responseContentDisposition =
        typeof input["ResponseContentDisposition"] === "string"
          ? input["ResponseContentDisposition"]
          : undefined;
      const responseCacheControl =
        typeof input["ResponseCacheControl"] === "string"
          ? input["ResponseCacheControl"]
          : undefined;
      const responseContentEncoding =
        typeof input["ResponseContentEncoding"] === "string"
          ? input["ResponseContentEncoding"]
          : undefined;
      const responseContentLanguage =
        typeof input["ResponseContentLanguage"] === "string"
          ? input["ResponseContentLanguage"]
          : undefined;
      const responseExpires =
        typeof input["ResponseExpires"] === "number"
          ? input["ResponseExpires"]
          : undefined;
      const common = {
        ContentType: responseContentType ?? object.contentType,
        ETag: object.etag,
        LastModified: object.lastModified,
        Metadata: object.userMetadata,
        ...(object.storageClass === "STANDARD"
          ? {}
          : { StorageClass: object.storageClass }),
        ...(object.versionId !== undefined
          ? { VersionId: object.versionId }
          : {}),
        ...((responseContentDisposition ?? object.contentDisposition) !==
        undefined
          ? {
              ContentDisposition:
                responseContentDisposition ?? object.contentDisposition,
            }
          : {}),
        ...((responseCacheControl ?? object.cacheControl) !== undefined
          ? { CacheControl: responseCacheControl ?? object.cacheControl }
          : {}),
        ...((responseContentEncoding ?? object.contentEncoding) !== undefined
          ? {
              ContentEncoding:
                responseContentEncoding ?? object.contentEncoding,
            }
          : {}),
        ...((responseContentLanguage ?? object.contentLanguage) !== undefined
          ? {
              ContentLanguage:
                responseContentLanguage ?? object.contentLanguage,
            }
          : {}),
        ...((responseExpires ?? object.expires) !== undefined
          ? { Expires: responseExpires ?? object.expires }
          : {}),
        ServerSideEncryption: object.serverSideEncryption ?? "AES256",
      };
      const rangeHeader = req.headers.get("range");
      const match =
        typeof rangeHeader === "string"
          ? rangeHeader.match(/^bytes=(\d*)-(\d*)$/)
          : null;
      if (match !== null && (match[1] !== "" || match[2] !== "")) {
        const total = object.size;
        const isSuffixRange = match[1] === "";
        const start = isSuffixRange
          ? Math.max(0, total - Number(match[2]))
          : Number(match[1]);
        const end =
          isSuffixRange || match[2] === ""
            ? total - 1
            : Math.min(Number(match[2]), total - 1);
        if (start >= total || start > end) {
          throw awsError(
            "InvalidRange",
            "The requested range is not satisfiable",
            416,
          );
        }
        const slice = object.body.slice(start, end + 1);
        return {
          ...common,
          Body: slice,
          ContentLength: slice.byteLength,
          ContentRange: `bytes ${start}-${end}/${total}`,
          __statusCode: 206,
        };
      }
      return {
        ...common,
        Body: object.body,
        ContentLength: object.size,
      };
    },
    HeadObject: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const requestedVersionId =
        typeof input["VersionId"] === "string" ? input["VersionId"] : undefined;
      let object: S3Object | undefined;
      if (requestedVersionId !== undefined) {
        const found = (target.objects[key] ?? []).find((v) =>
          matchesNullVersion(requestedVersionId, v.versionId),
        );
        if (found === undefined || found.isDeleteMarker) {
          throw awsError("NoSuchKey", "The specified key does not exist.", 404);
        }
        object = found;
      } else {
        object = getCurrentObject(target.objects[key]);
        if (object === undefined) {
          throw awsError("NoSuchKey", "The specified key does not exist.", 404);
        }
      }
      evaluateConditional(input, object);
      return {
        ContentType: object.contentType,
        ContentLength: object.size,
        ETag: object.etag,
        LastModified: object.lastModified,
        Metadata: object.userMetadata,
        ...(object.storageClass === "STANDARD"
          ? {}
          : { StorageClass: object.storageClass }),
        ...(object.versionId !== undefined
          ? { VersionId: object.versionId }
          : {}),
        ...(object.contentDisposition !== undefined
          ? { ContentDisposition: object.contentDisposition }
          : {}),
        ...(object.cacheControl !== undefined
          ? { CacheControl: object.cacheControl }
          : {}),
        ...(object.contentEncoding !== undefined
          ? { ContentEncoding: object.contentEncoding }
          : {}),
        ...(object.contentLanguage !== undefined
          ? { ContentLanguage: object.contentLanguage }
          : {}),
        ...(object.expires !== undefined ? { Expires: object.expires } : {}),
        ServerSideEncryption: object.serverSideEncryption ?? "AES256",
      };
    },
    ListObjectsV2: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const prefix = typeof input["Prefix"] === "string" ? input["Prefix"] : "";
      const delimiter =
        typeof input["Delimiter"] === "string" ? input["Delimiter"] : "";
      const startAfter =
        typeof input["StartAfter"] === "string" ? input["StartAfter"] : "";
      const continuationToken =
        typeof input["ContinuationToken"] === "string"
          ? Buffer.from(input["ContinuationToken"], "base64").toString("utf8")
          : "";
      const after = continuationToken !== "" ? continuationToken : startAfter;
      const maxKeys =
        typeof input["MaxKeys"] === "number" && input["MaxKeys"] >= 0
          ? Math.min(input["MaxKeys"], 1000)
          : 1000;
      const candidates = Object.values(target.objects)
        .map((vs) => getCurrentObject(vs))
        .filter((o): o is S3Object => o !== undefined)
        .filter((o) => o.key.startsWith(prefix))
        .filter((o) => o.key > after)
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const contents: S3Object[] = [];
      const commonPrefixes: string[] = [];
      const seenPrefixes = new Set<string>();
      let isTruncated = false;
      let nextToken: string | undefined;
      for (const object of candidates) {
        const rest = object.key.slice(prefix.length);
        const boundary = delimiter === "" ? -1 : rest.indexOf(delimiter);
        const group =
          boundary === -1
            ? undefined
            : prefix + rest.slice(0, boundary + delimiter.length);
        if (group !== undefined && seenPrefixes.has(group)) continue;
        if (contents.length + commonPrefixes.length >= maxKeys) {
          isTruncated = maxKeys > 0;
          break;
        }
        if (group !== undefined) {
          seenPrefixes.add(group);
          commonPrefixes.push(group);
          nextToken =
            group.slice(0, -1) +
            String.fromCodePoint(
              (group.codePointAt(group.length - 1) ?? 0) + 1,
            );
        } else {
          contents.push(object);
          nextToken = object.key;
        }
      }
      return {
        Name: bucket,
        Prefix: prefix,
        ...(delimiter === "" ? {} : { Delimiter: delimiter }),
        MaxKeys: maxKeys,
        KeyCount: contents.length + commonPrefixes.length,
        IsTruncated: isTruncated,
        ...(startAfter === "" ? {} : { StartAfter: startAfter }),
        Contents: contents.map((o) => ({
          Key: o.key,
          LastModified: o.lastModified,
          ETag: o.etag,
          Size: o.size,
          StorageClass: o.storageClass,
        })),
        ...(commonPrefixes.length === 0
          ? {}
          : { CommonPrefixes: commonPrefixes.map((p) => ({ Prefix: p })) }),
        ...(isTruncated && nextToken !== undefined
          ? {
              NextContinuationToken: Buffer.from(nextToken).toString("base64"),
            }
          : {}),
      };
    },
    DeleteObject: async (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versioned = target.versioningStatus === "Enabled";
      const requestedVersionId =
        typeof input["VersionId"] === "string" ? input["VersionId"] : undefined;
      if (versioned && requestedVersionId === undefined) {
        const versionId = generateVersionId();
        const marker: S3Object = {
          key,
          body: new Uint8Array(0),
          contentType: "",
          etag: "",
          size: 0,
          lastModified: nowSeconds(),
          tagSet: [],
          userMetadata: {},
          storageClass: "STANDARD",
          versionId,
          isDeleteMarker: true,
        };
        const existing = target.objects[key] ?? [];
        ctx.store.set<S3Bucket>(bucket, {
          ...target,
          objects: { ...target.objects, [key]: [marker, ...existing] },
        });
        await emitS3Notification(
          ctx,
          bucket,
          target.notification,
          "ObjectRemoved:DeleteMarkerCreated",
          key,
          undefined,
        );
        return { DeleteMarker: true, VersionId: versionId };
      }
      if (versioned && requestedVersionId !== undefined) {
        const existing = target.objects[key] ?? [];
        const idx = existing.findIndex((v) =>
          matchesNullVersion(requestedVersionId, v.versionId),
        );
        if (idx === -1) return {};
        const removed = existing[idx];
        ensureVersionDeletable(removed, input);
        const filtered = existing.filter((_, i) => i !== idx);
        const objects =
          filtered.length > 0
            ? { ...target.objects, [key]: filtered }
            : (() => {
                const r = { ...target.objects };
                delete r[key];
                return r;
              })();
        ctx.store.set<S3Bucket>(bucket, { ...target, objects });
        if (!removed.isDeleteMarker) {
          await emitS3Notification(
            ctx,
            bucket,
            target.notification,
            "ObjectRemoved:Delete",
            key,
            undefined,
          );
        }
        return {
          DeleteMarker: removed.isDeleteMarker ?? false,
          VersionId: requestedVersionId,
        };
      }
      if (target.objects[key] !== undefined) {
        const rest = { ...target.objects };
        delete rest[key];
        ctx.store.set<S3Bucket>(bucket, { ...target, objects: rest });
        await emitS3Notification(
          ctx,
          bucket,
          target.notification,
          "ObjectRemoved:Delete",
          key,
          undefined,
        );
      }
      return {};
    },
    DeleteObjects: async (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versioned = target.versioningStatus === "Enabled";
      const quiet = /<Quiet>\s*true\s*<\/Quiet>/i.test(req.bodyText);
      const objectEntries = [
        ...req.bodyText.matchAll(/<Object>([\s\S]*?)<\/Object>/g),
      ].map((m) => {
        const block = m[1];
        const keyMatch = block.match(/<Key>([\s\S]*?)<\/Key>/);
        const vidMatch = block.match(/<VersionId>([\s\S]*?)<\/VersionId>/);
        return {
          key: keyMatch ? decodeXmlEntities(keyMatch[1]) : "",
          versionId: vidMatch ? decodeXmlEntities(vidMatch[1]) : undefined,
        };
      });
      const objects = { ...target.objects };
      const deletedParts: string[] = [];
      for (const entry of objectEntries) {
        const { key, versionId } = entry;
        if (key === "") continue;
        if (versioned && versionId === undefined) {
          const newVersionId = generateVersionId();
          const marker: S3Object = {
            key,
            body: new Uint8Array(0),
            contentType: "",
            etag: "",
            size: 0,
            lastModified: nowSeconds(),
            tagSet: [],
            userMetadata: {},
            storageClass: "STANDARD",
            versionId: newVersionId,
            isDeleteMarker: true,
          };
          objects[key] = [marker, ...(objects[key] ?? [])];
          await emitS3Notification(
            ctx,
            bucket,
            target.notification,
            "ObjectRemoved:DeleteMarkerCreated",
            key,
            undefined,
          );
          deletedParts.push(
            `<Deleted><Key>${escapeXml(key)}</Key><DeleteMarker>true</DeleteMarker><DeleteMarkerVersionId>${escapeXml(newVersionId)}</DeleteMarkerVersionId></Deleted>`,
          );
        } else if (versioned && versionId !== undefined) {
          const existing = objects[key] ?? [];
          const idx = existing.findIndex((v) =>
            matchesNullVersion(versionId, v.versionId),
          );
          if (idx !== -1) {
            const removed = existing[idx];
            const filtered = existing.filter((_, i) => i !== idx);
            if (filtered.length > 0) {
              objects[key] = filtered;
            } else {
              delete objects[key];
            }
            if (!removed.isDeleteMarker) {
              await emitS3Notification(
                ctx,
                bucket,
                target.notification,
                "ObjectRemoved:Delete",
                key,
                undefined,
              );
            }
            deletedParts.push(
              `<Deleted><Key>${escapeXml(key)}</Key><VersionId>${escapeXml(versionId)}</VersionId>${removed.isDeleteMarker ? "<DeleteMarker>true</DeleteMarker>" : ""}</Deleted>`,
            );
          }
        } else {
          const existed = objects[key] !== undefined;
          delete objects[key];
          if (existed) {
            await emitS3Notification(
              ctx,
              bucket,
              target.notification,
              "ObjectRemoved:Delete",
              key,
              undefined,
            );
          }
          deletedParts.push(`<Deleted><Key>${escapeXml(key)}</Key></Deleted>`);
        }
      }
      ctx.store.set<S3Bucket>(bucket, { ...target, objects });
      const body = quiet ? "" : deletedParts.join("");
      return {
        __xml: `<?xml version="1.0" encoding="UTF-8"?><DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${body}</DeleteResult>`,
      };
    },
    ListObjects: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const prefix = req.query.get("prefix") ?? "";
      const marker = req.query.get("marker") ?? "";
      const delimiter = req.query.get("delimiter") ?? "";
      const maxKeysRaw = Number(req.query.get("max-keys") ?? "1000");
      const maxKeys = Number.isFinite(maxKeysRaw)
        ? Math.min(Math.max(0, maxKeysRaw), 1000)
        : 1000;
      const candidates = Object.values(target.objects)
        .map((vs) => getCurrentObject(vs))
        .filter((o): o is S3Object => o !== undefined)
        .filter((o) => o.key.startsWith(prefix))
        .filter((o) => o.key > marker)
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const contents: S3Object[] = [];
      const commonPrefixes: string[] = [];
      const seenPrefixes = new Set<string>();
      let isTruncated = false;
      let nextMarker: string | undefined;
      for (const object of candidates) {
        const rest = object.key.slice(prefix.length);
        const boundary = delimiter === "" ? -1 : rest.indexOf(delimiter);
        const group =
          boundary === -1
            ? undefined
            : prefix + rest.slice(0, boundary + delimiter.length);
        if (group !== undefined && seenPrefixes.has(group)) continue;
        if (contents.length + commonPrefixes.length >= maxKeys) {
          isTruncated = maxKeys > 0;
          break;
        }
        if (group !== undefined) {
          seenPrefixes.add(group);
          commonPrefixes.push(group);
          nextMarker =
            group.slice(0, -1) +
            String.fromCodePoint(
              (group.codePointAt(group.length - 1) ?? 0) + 1,
            );
        } else {
          contents.push(object);
          nextMarker = object.key;
        }
      }
      return {
        Name: bucket,
        Prefix: prefix,
        Marker: marker,
        MaxKeys: maxKeys,
        IsTruncated: isTruncated,
        ...(delimiter !== "" ? { Delimiter: delimiter } : {}),
        ...(isTruncated && nextMarker !== undefined
          ? { NextMarker: nextMarker }
          : {}),
        Contents: contents.map((o) => ({
          Key: o.key,
          LastModified: o.lastModified,
          ETag: o.etag,
          Size: o.size,
          StorageClass: o.storageClass,
        })),
        ...(commonPrefixes.length > 0
          ? { CommonPrefixes: commonPrefixes.map((p) => ({ Prefix: p })) }
          : {}),
      };
    },
    CopyObject: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const copySource = input["CopySource"];
      if (typeof copySource !== "string" || copySource === "") {
        throw awsError(
          "InvalidArgument",
          "x-amz-copy-source header is required",
          400,
        );
      }
      const [sourceRef, sourceQuery] = copySource.split("?");
      const { bucket: srcBucket, key: srcKey } = bucketKeyFromPath(sourceRef);
      if (srcBucket === undefined || srcKey === undefined) {
        throw awsError("InvalidArgument", "invalid copy source", 400);
      }
      const sourceBucket = getBucket(ctx, srcBucket);
      const srcVersionId = new URLSearchParams(sourceQuery ?? "").get(
        "versionId",
      );
      const srcVersions = sourceBucket.objects[srcKey];
      const source =
        srcVersionId === null
          ? getCurrentObject(srcVersions)
          : (srcVersions ?? []).find((v) =>
              srcVersionId === "null"
                ? v.versionId === undefined
                : v.versionId === srcVersionId,
            );
      if (source === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      evaluateConditional(
        {
          IfMatch: input["CopySourceIfMatch"],
          IfNoneMatch: input["CopySourceIfNoneMatch"],
          IfModifiedSince: input["CopySourceIfModifiedSince"],
          IfUnmodifiedSince: input["CopySourceIfUnmodifiedSince"],
        },
        source,
      );
      const useReplace = input["MetadataDirective"] === "REPLACE";
      const useTagReplace = input["TaggingDirective"] === "REPLACE";
      if (
        srcBucket === bucket &&
        srcKey === key &&
        srcVersionId === null &&
        !useReplace &&
        !useTagReplace &&
        typeof input["StorageClass"] !== "string" &&
        typeof input["WebsiteRedirectLocation"] !== "string" &&
        typeof input["ServerSideEncryption"] !== "string"
      ) {
        throw awsError(
          "InvalidRequest",
          "This copy request is illegal because it is trying to copy an object to itself without changing the object's metadata, storage class, website redirect location or encryption attributes.",
          400,
        );
      }
      const versioned = target.versioningStatus === "Enabled";
      const versionId = versioned ? generateVersionId() : undefined;
      const lastModified = nowSeconds();
      const reqStorageClass = input["StorageClass"];
      const reqMetadata = input["Metadata"];
      const object: S3Object = {
        key,
        body: source.body,
        contentType: useReplace
          ? typeof input["ContentType"] === "string"
            ? input["ContentType"]
            : "application/octet-stream"
          : source.contentType,
        etag: source.etag,
        size: source.size,
        lastModified,
        tagSet: useTagReplace
          ? parseTaggingHeader(input["Tagging"])
          : source.tagSet,
        userMetadata: useReplace
          ? typeof reqMetadata === "object" && reqMetadata !== null
            ? (reqMetadata as Record<string, string>)
            : {}
          : source.userMetadata,
        storageClass:
          typeof reqStorageClass === "string"
            ? reqStorageClass
            : source.storageClass,
        versionId,
        contentDisposition: useReplace
          ? typeof input["ContentDisposition"] === "string"
            ? input["ContentDisposition"]
            : undefined
          : source.contentDisposition,
        cacheControl: useReplace
          ? typeof input["CacheControl"] === "string"
            ? input["CacheControl"]
            : undefined
          : source.cacheControl,
        contentEncoding: useReplace
          ? typeof input["ContentEncoding"] === "string"
            ? input["ContentEncoding"]
            : undefined
          : source.contentEncoding,
        contentLanguage: useReplace
          ? typeof input["ContentLanguage"] === "string"
            ? input["ContentLanguage"]
            : undefined
          : source.contentLanguage,
        expires: useReplace
          ? typeof input["Expires"] === "number"
            ? input["Expires"]
            : undefined
          : source.expires,
      };
      const existing = target.objects[key] ?? [];
      const versions = versioned ? [object, ...existing] : [object];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: versions },
      });
      return {
        CopyObjectResult: {
          ETag: object.etag,
          LastModified: lastModified,
        },
        ...(versionId !== undefined ? { VersionId: versionId } : {}),
      };
    },
    PutBucketTagging: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const tagSet = parseTagSet(input["Tagging"]);
      ctx.store.set<S3Bucket>(bucket, { ...target, tagSet });
      return {};
    },
    GetBucketTagging: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if ((target.tagSet ?? []).length === 0) {
        throw awsError("NoSuchTagSet", "The TagSet does not exist", 404);
      }
      return {
        TagSet: target.tagSet.map((tag) => ({
          Key: tag.Key,
          Value: tag.Value,
        })),
      };
    },
    DeleteBucketTagging: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, tagSet: [] });
      return {};
    },
    GetBucketLocation: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      getBucket(ctx, bucket);
      return { LocationConstraint: req.region };
    },
    CreateMultipartUpload: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = hashWithPrefix(
        `${key}:${Date.now()}:${Math.random()}`,
        new Uint8Array(0),
      );
      const metadata = input["Metadata"];
      const storageClass = input["StorageClass"];
      const upload: S3Upload = {
        uploadId,
        key,
        initiated: nowSeconds(),
        contentType:
          req.headers.get("content-type") ?? "application/octet-stream",
        parts: {},
        userMetadata:
          typeof metadata === "object" && metadata !== null
            ? (metadata as Record<string, string>)
            : {},
        storageClass:
          typeof storageClass === "string" ? storageClass : "STANDARD",
        contentDisposition:
          typeof input["ContentDisposition"] === "string"
            ? input["ContentDisposition"]
            : undefined,
        cacheControl:
          typeof input["CacheControl"] === "string"
            ? input["CacheControl"]
            : undefined,
        contentEncoding:
          typeof input["ContentEncoding"] === "string"
            ? input["ContentEncoding"]
            : undefined,
        contentLanguage:
          typeof input["ContentLanguage"] === "string"
            ? input["ContentLanguage"]
            : undefined,
        expires:
          typeof input["Expires"] === "number" ? input["Expires"] : undefined,
      };
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        uploads: { ...target.uploads, [uploadId]: upload },
      });
      return { Bucket: bucket, Key: key, UploadId: uploadId };
    },
    UploadPart: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = req.query.get("uploadId") ?? "";
      const upload = target.uploads[uploadId];
      if (upload === undefined) {
        throw awsError(
          "NoSuchUpload",
          "The specified multipart upload does not exist.",
          404,
        );
      }
      const partNumberRaw = req.query.get("partNumber") ?? "";
      const partNumber = Number.parseInt(partNumberRaw, 10);
      if (!Number.isInteger(partNumber) || partNumber < 1) {
        throw awsError("InvalidArgument", "invalid partNumber", 400);
      }
      const body = req.bodyBytes;
      const etag = `"${md5Hex(body)}"`;
      const part: S3Part = {
        partNumber,
        body,
        etag,
        size: body.byteLength,
        lastModified: nowSeconds(),
      };
      const nextUpload: S3Upload = {
        ...upload,
        parts: { ...upload.parts, [String(partNumber)]: part },
      };
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        uploads: { ...target.uploads, [uploadId]: nextUpload },
      });
      return { ETag: etag };
    },
    UploadPartCopy: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = req.query.get("uploadId") ?? "";
      const upload = target.uploads[uploadId];
      if (upload === undefined) {
        throw awsError(
          "NoSuchUpload",
          "The specified multipart upload does not exist.",
          404,
        );
      }
      const partNumberRaw = req.query.get("partNumber") ?? "";
      const partNumber = Number.parseInt(partNumberRaw, 10);
      if (!Number.isInteger(partNumber) || partNumber < 1) {
        throw awsError("InvalidArgument", "invalid partNumber", 400);
      }
      const copySource = input["CopySource"];
      if (typeof copySource !== "string" || copySource === "") {
        throw awsError(
          "InvalidArgument",
          "x-amz-copy-source header is required",
          400,
        );
      }
      const { bucket: srcBucket, key: srcKey } = bucketKeyFromPath(
        copySource.split("?")[0],
      );
      if (srcBucket === undefined || srcKey === undefined) {
        throw awsError("InvalidArgument", "invalid copy source", 400);
      }
      const source = getCurrentObject(
        getBucket(ctx, srcBucket).objects[srcKey],
      );
      if (source === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const range = input["CopySourceRange"];
      const match =
        typeof range === "string" ? range.match(/^bytes=(\d+)-(\d+)$/) : null;
      const body =
        match === null
          ? source.body
          : source.body.slice(Number(match[1]), Number(match[2]) + 1);
      const lastModified = nowSeconds();
      const etag = `"${md5Hex(body)}"`;
      const part: S3Part = {
        partNumber,
        body,
        etag,
        size: body.byteLength,
        lastModified,
      };
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        uploads: {
          ...target.uploads,
          [uploadId]: {
            ...upload,
            parts: { ...upload.parts, [String(partNumber)]: part },
          },
        },
      });
      return { CopyPartResult: { ETag: etag, LastModified: lastModified } };
    },
    CompleteMultipartUpload: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = req.query.get("uploadId") ?? "";
      const upload = target.uploads[uploadId];
      if (upload === undefined) {
        throw awsError(
          "NoSuchUpload",
          "The specified multipart upload does not exist.",
          404,
        );
      }
      const multipart = input["MultipartUpload"];
      const rawParts =
        typeof multipart === "object" && multipart !== null
          ? (multipart as Record<string, unknown>)["Parts"]
          : undefined;
      const requested = Array.isArray(rawParts)
        ? rawParts.flatMap((entry) => {
            if (typeof entry !== "object" || entry === null) return [];
            const record = entry as Record<string, unknown>;
            const partNumber = Number(record["PartNumber"]);
            if (!Number.isInteger(partNumber)) return [];
            const etag = record["ETag"];
            return [
              { partNumber, etag: typeof etag === "string" ? etag : undefined },
            ];
          })
        : Object.values(upload.parts)
            .map((p) => ({ partNumber: p.partNumber, etag: p.etag }))
            .sort((a, b) => a.partNumber - b.partNumber);
      for (let i = 1; i < requested.length; i += 1) {
        if (requested[i].partNumber <= requested[i - 1].partNumber) {
          throw awsError(
            "InvalidPartOrder",
            "The list of parts was not in ascending order. Parts must be ordered by part number.",
            400,
          );
        }
      }
      const bodies = requested.map((entry) => {
        const part = upload.parts[String(entry.partNumber)];
        if (
          part === undefined ||
          (entry.etag !== undefined &&
            normalizeEtag(entry.etag) !== normalizeEtag(part.etag))
        ) {
          throw awsError(
            "InvalidPart",
            "One or more of the specified parts could not be found. The part might not have been uploaded, or the specified entity tag might not have matched the part's entity tag.",
            400,
          );
        }
        return part.body;
      });
      const combined = concatBytes(bodies);
      const etag = `"${md5Hex(concatBytes(bodies.map(md5Bytes)))}-${requested.length}"`;
      const versioned = target.versioningStatus === "Enabled";
      const versionId = versioned ? generateVersionId() : undefined;
      const object: S3Object = {
        key,
        body: combined,
        contentType: upload.contentType,
        etag,
        size: combined.byteLength,
        lastModified: nowSeconds(),
        tagSet: [],
        userMetadata: upload.userMetadata,
        storageClass: upload.storageClass,
        versionId,
        contentDisposition: upload.contentDisposition,
        cacheControl: upload.cacheControl,
        contentEncoding: upload.contentEncoding,
        contentLanguage: upload.contentLanguage,
        expires: upload.expires,
      };
      const existingVersions = target.objects[key] ?? [];
      const versions = versioned ? [object, ...existingVersions] : [object];
      const rest = { ...target.uploads };
      delete rest[uploadId];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: versions },
        uploads: rest,
      });
      return {
        Location: `http://${bucket}.s3.${req.region}.amazonaws.com/${key}`,
        Bucket: bucket,
        Key: key,
        ETag: etag,
        ServerSideEncryption: "AES256",
      };
    },
    AbortMultipartUpload: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = req.query.get("uploadId") ?? "";
      if (target.uploads[uploadId] === undefined) {
        throw awsError(
          "NoSuchUpload",
          "The specified multipart upload does not exist.",
          404,
        );
      }
      const rest = { ...target.uploads };
      delete rest[uploadId];
      ctx.store.set<S3Bucket>(bucket, { ...target, uploads: rest });
      return {};
    },
    ListParts: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = req.query.get("uploadId") ?? "";
      const upload = target.uploads[uploadId];
      if (upload === undefined) {
        throw awsError(
          "NoSuchUpload",
          "The specified multipart upload does not exist.",
          404,
        );
      }
      const parts = Object.values(upload.parts).sort(
        (a, b) => a.partNumber - b.partNumber,
      );
      return {
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: 0,
        MaxParts: 1000,
        IsTruncated: false,
        StorageClass: "STANDARD",
        Parts: parts.map((p) => ({
          PartNumber: p.partNumber,
          LastModified: p.lastModified,
          ETag: p.etag,
          Size: p.size,
        })),
      };
    },
    ListMultipartUploads: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const prefix = req.query.get("prefix") ?? "";
      const uploads = Object.values(target.uploads)
        .filter((u) => u.key.startsWith(prefix))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return {
        Bucket: bucket,
        Prefix: prefix,
        MaxUploads: 1000,
        IsTruncated: false,
        Uploads: uploads.map((u) => ({
          Key: u.key,
          UploadId: u.uploadId,
          Initiated: u.initiated,
          StorageClass: "STANDARD",
        })),
      };
    },
    PutBucketVersioning: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["VersioningConfiguration"];
      const record =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      const status = record["Status"];
      const mfaDelete = record["MFADelete"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        versioningStatus: typeof status === "string" ? status : undefined,
        mfaDelete: typeof mfaDelete === "string" ? mfaDelete : undefined,
      });
      return {};
    },
    GetBucketVersioning: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const result: Record<string, string> = {};
      if (target.versioningStatus !== undefined) {
        result["Status"] = target.versioningStatus;
      }
      if (target.mfaDelete !== undefined) {
        result["MFADelete"] = target.mfaDelete;
      }
      return result;
    },
    PutBucketPolicy: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const policy = input["Policy"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        policy: typeof policy === "string" ? policy : req.bodyText,
      });
      return {};
    },
    GetBucketPolicy: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.policy === undefined) {
        throw awsError(
          "NoSuchBucketPolicy",
          "The bucket policy does not exist",
          404,
        );
      }
      return { Policy: target.policy };
    },
    DeleteBucketPolicy: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, policy: undefined });
      return {};
    },
    PutObjectTagging: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versions = target.objects[key] ?? [];
      const object = getCurrentObject(versions);
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const tagSet = parseTagSet(input["Tagging"]);
      const updated = [{ ...object, tagSet }, ...versions.slice(1)];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: updated },
      });
      return {};
    },
    GetObjectTagging: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const object = getCurrentObject(target.objects[key]);
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      return {
        TagSet: (object.tagSet ?? []).map((tag) => ({
          Key: tag.Key,
          Value: tag.Value,
        })),
      };
    },
    DeleteObjectTagging: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versions = target.objects[key] ?? [];
      const object = getCurrentObject(versions);
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const updated = [
        { ...object, tagSet: [] as S3Tag[] },
        ...versions.slice(1),
      ];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: updated },
      });
      return {};
    },
    GetObjectAcl: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const object = getCurrentObject(target.objects[key]);
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      return {
        Owner: { ID: "bunsai", DisplayName: "bunsai" },
        Grants: cannedAclGrants(object.acl),
      };
    },
    PutObjectAcl: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versions = target.objects[key] ?? [];
      const object = getCurrentObject(versions);
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const acl = typeof input["ACL"] === "string" ? input["ACL"] : "private";
      const updated = [{ ...object, acl }, ...versions.slice(1)];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: updated },
      });
      return {};
    },
    PutObjectRetention: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versions = target.objects[key] ?? [];
      const idx = versionIndexFor(versions, input["VersionId"]);
      const object = idx === -1 ? undefined : versions[idx];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const raw = input["Retention"];
      const retRaw =
        typeof raw === "object" && raw !== null
          ? (raw as { Mode?: unknown; RetainUntilDate?: unknown })
          : {};
      const mode = typeof retRaw.Mode === "string" ? retRaw.Mode : "";
      const retainUntilDate =
        typeof retRaw.RetainUntilDate === "number" ? retRaw.RetainUntilDate : 0;
      const updated = versions.map((v, i) =>
        i === idx
          ? {
              ...v,
              retention: { Mode: mode, RetainUntilDate: retainUntilDate },
            }
          : v,
      );
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: updated },
      });
      return {};
    },
    GetObjectRetention: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const vs = target.objects[key] ?? [];
      const object = vs[versionIndexFor(vs, _input["VersionId"])];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      return { Retention: object.retention ?? {} };
    },
    PutObjectLegalHold: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const versions = target.objects[key] ?? [];
      const idx = versionIndexFor(versions, input["VersionId"]);
      const object = idx === -1 ? undefined : versions[idx];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const raw = input["LegalHold"];
      const holdRaw =
        typeof raw === "object" && raw !== null
          ? (raw as { Status?: unknown })
          : {};
      const status =
        typeof holdRaw.Status === "string" ? holdRaw.Status : "OFF";
      const updated = versions.map((v, i) =>
        i === idx ? { ...v, legalHold: status } : v,
      );
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: updated },
      });
      return {};
    },
    GetObjectLegalHold: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const vs = target.objects[key] ?? [];
      const object = vs[versionIndexFor(vs, _input["VersionId"])];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      return { LegalHold: { Status: object.legalHold ?? "OFF" } };
    },
    GetObjectAttributes: (input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const object = getCurrentObject(target.objects[key]);
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const attrs = Array.isArray(input["ObjectAttributes"])
        ? (input["ObjectAttributes"] as string[])
        : [];
      const result: Record<string, unknown> = {};
      if (attrs.includes("ETag")) result["ETag"] = object.etag;
      if (attrs.includes("ObjectSize")) result["ObjectSize"] = object.size;
      if (attrs.includes("StorageClass"))
        result["StorageClass"] = object.storageClass;
      return result;
    },
    GetBucketAcl: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      return {
        Owner: { ID: "bunsai", DisplayName: "bunsai" },
        Grants: cannedAclGrants(target.acl),
      };
    },
    PutBucketAcl: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const acl = typeof input["ACL"] === "string" ? input["ACL"] : "private";
      ctx.store.set<S3Bucket>(bucket, { ...target, acl });
      return {};
    },
    PutBucketLifecycleConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["LifecycleConfiguration"];
      const rawRules =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)["Rules"]
          : undefined;
      const lifecycleRules = Array.isArray(rawRules) ? rawRules : [];
      ctx.store.set<S3Bucket>(bucket, { ...target, lifecycleRules });
      return {};
    },
    GetBucketLifecycleConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if ((target.lifecycleRules ?? []).length === 0) {
        throw awsError(
          "NoSuchLifecycleConfiguration",
          "The lifecycle configuration does not exist",
          404,
        );
      }
      return { Rules: target.lifecycleRules };
    },
    DeleteBucketLifecycle: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, lifecycleRules: [] });
      return {};
    },
    PutBucketAnalyticsConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = input["AnalyticsConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        analyticsConfigs: { ...target.analyticsConfigs, [id]: config },
      });
      return {};
    },
    GetBucketAnalyticsConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = target.analyticsConfigs[id];
      if (config === undefined) {
        throw awsError(
          "NoSuchConfiguration",
          "The specified configuration does not exist",
          404,
        );
      }
      return { AnalyticsConfiguration: config };
    },
    DeleteBucketAnalyticsConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const { [id]: _removed, ...rest } = target.analyticsConfigs;
      ctx.store.set<S3Bucket>(bucket, { ...target, analyticsConfigs: rest });
      return {};
    },
    ListBucketAnalyticsConfigurations: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const continuationToken = req.query.get("continuation-token");
      const allIds = Object.keys(target.analyticsConfigs).sort();
      const startIdx =
        continuationToken !== null
          ? allIds.findIndex((id) => id > continuationToken)
          : 0;
      const page = allIds.slice(
        startIdx < 0 ? allIds.length : startIdx,
        (startIdx < 0 ? allIds.length : startIdx) + 100,
      );
      const isTruncated = page.length === 100 && startIdx + 100 < allIds.length;
      const list = page.map((id) => target.analyticsConfigs[id]);
      return {
        IsTruncated: isTruncated,
        ContinuationToken: continuationToken ?? undefined,
        NextContinuationToken: isTruncated ? page[page.length - 1] : undefined,
        AnalyticsConfigurationList: list,
      };
    },
    PutBucketInventoryConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = input["InventoryConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        inventoryConfigs: { ...target.inventoryConfigs, [id]: config },
      });
      return {};
    },
    GetBucketInventoryConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = target.inventoryConfigs[id];
      if (config === undefined) {
        throw awsError(
          "NoSuchConfiguration",
          "The specified configuration does not exist",
          404,
        );
      }
      return { InventoryConfiguration: config };
    },
    DeleteBucketInventoryConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const { [id]: _removed, ...rest } = target.inventoryConfigs;
      ctx.store.set<S3Bucket>(bucket, { ...target, inventoryConfigs: rest });
      return {};
    },
    ListBucketInventoryConfigurations: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const continuationToken = req.query.get("continuation-token");
      const allIds = Object.keys(target.inventoryConfigs).sort();
      const startIdx =
        continuationToken !== null
          ? allIds.findIndex((id) => id > continuationToken)
          : 0;
      const page = allIds.slice(
        startIdx < 0 ? allIds.length : startIdx,
        (startIdx < 0 ? allIds.length : startIdx) + 100,
      );
      const isTruncated = page.length === 100 && startIdx + 100 < allIds.length;
      const list = page.map((id) => target.inventoryConfigs[id]);
      return {
        IsTruncated: isTruncated,
        ContinuationToken: continuationToken ?? undefined,
        NextContinuationToken: isTruncated ? page[page.length - 1] : undefined,
        InventoryConfigurationList: list,
      };
    },
    PutBucketMetricsConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = input["MetricsConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metricsConfigs: { ...target.metricsConfigs, [id]: config },
      });
      return {};
    },
    GetBucketMetricsConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = target.metricsConfigs[id];
      if (config === undefined) {
        throw awsError(
          "NoSuchConfiguration",
          "The specified configuration does not exist",
          404,
        );
      }
      return { MetricsConfiguration: config };
    },
    DeleteBucketMetricsConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const { [id]: _removed, ...rest } = target.metricsConfigs;
      ctx.store.set<S3Bucket>(bucket, { ...target, metricsConfigs: rest });
      return {};
    },
    ListBucketMetricsConfigurations: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const continuationToken = req.query.get("continuation-token");
      const allIds = Object.keys(target.metricsConfigs).sort();
      const startIdx =
        continuationToken !== null
          ? allIds.findIndex((id) => id > continuationToken)
          : 0;
      const page = allIds.slice(
        startIdx < 0 ? allIds.length : startIdx,
        (startIdx < 0 ? allIds.length : startIdx) + 100,
      );
      const isTruncated = page.length === 100 && startIdx + 100 < allIds.length;
      const list = page.map((id) => target.metricsConfigs[id]);
      return {
        IsTruncated: isTruncated,
        ContinuationToken: continuationToken ?? undefined,
        NextContinuationToken: isTruncated ? page[page.length - 1] : undefined,
        MetricsConfigurationList: list,
      };
    },
    PutBucketIntelligentTieringConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = input["IntelligentTieringConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        intelligentTieringConfigs: {
          ...target.intelligentTieringConfigs,
          [id]: config,
        },
      });
      return {};
    },
    GetBucketIntelligentTieringConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const config = target.intelligentTieringConfigs[id];
      if (config === undefined) {
        throw awsError(
          "NoSuchConfiguration",
          "The specified configuration does not exist",
          404,
        );
      }
      return { IntelligentTieringConfiguration: config };
    },
    DeleteBucketIntelligentTieringConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const id = req.query.get("id");
      if (typeof id !== "string" || id === "") {
        throw awsError("InvalidArgument", "Id is required", 400);
      }
      const { [id]: _removed, ...rest } = target.intelligentTieringConfigs;
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        intelligentTieringConfigs: rest,
      });
      return {};
    },
    ListBucketIntelligentTieringConfigurations: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const continuationToken = req.query.get("continuation-token");
      const allIds = Object.keys(target.intelligentTieringConfigs).sort();
      const startIdx =
        continuationToken !== null
          ? allIds.findIndex((id) => id > continuationToken)
          : 0;
      const page = allIds.slice(
        startIdx < 0 ? allIds.length : startIdx,
        (startIdx < 0 ? allIds.length : startIdx) + 100,
      );
      const isTruncated = page.length === 100 && startIdx + 100 < allIds.length;
      const list = page.map((id) => target.intelligentTieringConfigs[id]);
      return {
        IsTruncated: isTruncated,
        ContinuationToken: continuationToken ?? undefined,
        NextContinuationToken: isTruncated ? page[page.length - 1] : undefined,
        IntelligentTieringConfigurationList: list,
      };
    },
    CreateBucketMetadataConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["MetadataConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metadataConfiguration:
          typeof config === "object" && config !== null
            ? (config as Record<string, unknown>)
            : {},
      });
      return {};
    },
    GetBucketMetadataConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.metadataConfiguration === undefined) {
        throw awsError(
          "NoSuchConfiguration",
          "The specified configuration does not exist",
          404,
        );
      }
      return {
        GetBucketMetadataConfigurationResult: target.metadataConfiguration,
      };
    },
    DeleteBucketMetadataConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metadataConfiguration: undefined,
      });
      return {};
    },
    CreateBucketMetadataTableConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["MetadataTableConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metadataTableConfiguration:
          typeof config === "object" && config !== null
            ? (config as Record<string, unknown>)
            : {},
      });
      return {};
    },
    GetBucketMetadataTableConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.metadataTableConfiguration === undefined) {
        throw awsError(
          "NoSuchConfiguration",
          "The specified configuration does not exist",
          404,
        );
      }
      return {
        GetBucketMetadataTableConfigurationResult:
          target.metadataTableConfiguration,
      };
    },
    DeleteBucketMetadataTableConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metadataTableConfiguration: undefined,
      });
      return {};
    },
    UpdateBucketMetadataInventoryTableConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["InventoryTableConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metadataInventoryTableConfiguration:
          typeof config === "object" && config !== null
            ? (config as Record<string, unknown>)
            : {},
      });
      return {};
    },
    UpdateBucketMetadataJournalTableConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["JournalTableConfiguration"];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        metadataJournalTableConfiguration:
          typeof config === "object" && config !== null
            ? (config as Record<string, unknown>)
            : {},
      });
      return {};
    },
    PutBucketCors: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["CORSConfiguration"];
      const rawRules =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)["CORSRules"]
          : undefined;
      const corsRules = Array.isArray(rawRules) ? rawRules : [];
      ctx.store.set<S3Bucket>(bucket, { ...target, corsRules });
      return {};
    },
    GetBucketCors: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if ((target.corsRules ?? []).length === 0) {
        throw awsError(
          "NoSuchCORSConfiguration",
          "The CORS configuration does not exist",
          404,
        );
      }
      return { CORSRules: target.corsRules };
    },
    DeleteBucketCors: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, corsRules: [] });
      return {};
    },
    PutBucketWebsite: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["WebsiteConfiguration"];
      const website =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      ctx.store.set<S3Bucket>(bucket, { ...target, website });
      return {};
    },
    GetBucketWebsite: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.website === undefined) {
        throw awsError(
          "NoSuchWebsiteConfiguration",
          "The specified bucket does not have a website configuration",
          404,
        );
      }
      return target.website;
    },
    DeleteBucketWebsite: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, website: undefined });
      return {};
    },
    PutBucketReplication: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const replication =
        typeof input["ReplicationConfiguration"] === "object" &&
        input["ReplicationConfiguration"] !== null
          ? (input["ReplicationConfiguration"] as Record<string, unknown>)
          : undefined;
      ctx.store.set<S3Bucket>(bucket, { ...target, replication });
      return {};
    },
    GetBucketReplication: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.replication === undefined) {
        throw awsError(
          "ReplicationConfigurationNotFoundError",
          "The replication configuration was not found",
          404,
        );
      }
      return { ReplicationConfiguration: target.replication };
    },
    DeleteBucketReplication: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, replication: undefined });
      return {};
    },
    PutBucketRequestPayment: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["RequestPaymentConfiguration"];
      const payer =
        typeof config === "object" &&
        config !== null &&
        typeof (config as Record<string, unknown>)["Payer"] === "string"
          ? ((config as Record<string, unknown>)["Payer"] as string)
          : "BucketOwner";
      ctx.store.set<S3Bucket>(bucket, { ...target, requestPayment: payer });
      return {};
    },
    GetBucketRequestPayment: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      return { Payer: target.requestPayment };
    },
    PutBucketEncryption: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["ServerSideEncryptionConfiguration"];
      const rawRules =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)["Rules"]
          : undefined;
      const encryptionRules = Array.isArray(rawRules) ? rawRules : [];
      ctx.store.set<S3Bucket>(bucket, { ...target, encryptionRules });
      return {};
    },
    GetBucketEncryption: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if ((target.encryptionRules ?? []).length === 0) {
        throw awsError(
          "ServerSideEncryptionConfigurationNotFoundError",
          "The server side encryption configuration was not found",
          404,
        );
      }
      return {
        ServerSideEncryptionConfiguration: { Rules: target.encryptionRules },
      };
    },
    PutBucketNotificationConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["NotificationConfiguration"];
      const notification =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      ctx.store.set<S3Bucket>(bucket, { ...target, notification });
      return {};
    },
    GetBucketNotificationConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      return target.notification ?? {};
    },
    GetBucketNotification: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      return target.notification ?? {};
    },
    PutBucketNotification: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["NotificationConfiguration"];
      const notification =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      ctx.store.set<S3Bucket>(bucket, { ...target, notification });
      return {};
    },
    GetBucketOwnershipControls: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.ownershipControls === undefined) {
        throw awsError(
          "OwnershipControlsNotFoundError",
          "The bucket ownership controls were not found",
          404,
        );
      }
      return { OwnershipControls: target.ownershipControls };
    },
    PutBucketOwnershipControls: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["OwnershipControls"];
      const ownershipControls =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      ctx.store.set<S3Bucket>(bucket, { ...target, ownershipControls });
      return {};
    },
    DeleteBucketOwnershipControls: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        ownershipControls: undefined,
      });
      return {};
    },
    GetBucketAbac: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      return { AbacStatus: target.abacStatus ?? { Status: "Disabled" } };
    },
    PutBucketAbac: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["AbacStatus"];
      const abacStatus =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : { Status: "Disabled" };
      ctx.store.set<S3Bucket>(bucket, { ...target, abacStatus });
      return {};
    },
    GetBucketPolicyStatus: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      return { PolicyStatus: { IsPublic: target.policy !== undefined } };
    },
    DeleteBucketEncryption: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, { ...target, encryptionRules: [] });
      return {};
    },
    GetBucketLifecycle: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if ((target.lifecycleRules ?? []).length === 0) {
        throw awsError(
          "NoSuchLifecycleConfiguration",
          "The lifecycle configuration does not exist",
          404,
        );
      }
      return { Rules: target.lifecycleRules };
    },
    PutBucketLifecycle: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["LifecycleConfiguration"];
      const rawRules =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)["Rules"]
          : undefined;
      const lifecycleRules = Array.isArray(rawRules) ? rawRules : [];
      ctx.store.set<S3Bucket>(bucket, { ...target, lifecycleRules });
      return {};
    },
    PutPublicAccessBlock: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["PublicAccessBlockConfiguration"];
      const publicAccessBlock =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      ctx.store.set<S3Bucket>(bucket, { ...target, publicAccessBlock });
      return {};
    },
    GetPublicAccessBlock: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.publicAccessBlock === undefined) {
        throw awsError(
          "NoSuchPublicAccessBlockConfiguration",
          "The public access block configuration was not found",
          404,
        );
      }
      return { PublicAccessBlockConfiguration: target.publicAccessBlock };
    },
    DeletePublicAccessBlock: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        publicAccessBlock: undefined,
      });
      return {};
    },
    PutBucketLogging: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["BucketLoggingStatus"];
      const record =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      const loggingEnabled = record["LoggingEnabled"];
      const logging =
        typeof loggingEnabled === "object" && loggingEnabled !== null
          ? (loggingEnabled as Record<string, unknown>)
          : undefined;
      ctx.store.set<S3Bucket>(bucket, { ...target, logging });
      return {};
    },
    GetBucketLogging: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.logging === undefined) return {};
      return { LoggingEnabled: target.logging };
    },
    PutBucketAccelerateConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const config = input["AccelerateConfiguration"];
      const status =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)["Status"]
          : undefined;
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        accelerateStatus: typeof status === "string" ? status : undefined,
      });
      return {};
    },
    GetBucketAccelerateConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.accelerateStatus === undefined) return {};
      return { Status: target.accelerateStatus };
    },
    PutObjectLockConfiguration: (input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.versioningStatus !== "Enabled") {
        throw awsError(
          "InvalidBucketState",
          "Versioning must be 'Enabled' on the bucket to apply a Object Lock configuration",
          409,
        );
      }
      const config = input["ObjectLockConfiguration"];
      const objectLock =
        typeof config === "object" && config !== null
          ? (config as Record<string, unknown>)
          : {};
      ctx.store.set<S3Bucket>(bucket, { ...target, objectLock });
      return {};
    },
    GetObjectLockConfiguration: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.objectLock === undefined) {
        throw awsError(
          "ObjectLockConfigurationNotFoundError",
          "Object Lock configuration does not exist for this bucket",
          404,
        );
      }
      return { ObjectLockConfiguration: target.objectLock };
    },
    ListObjectVersions: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const prefix = req.query.get("prefix") ?? "";
      const keyMarker = req.query.get("key-marker") ?? "";
      const versionIdMarker = req.query.get("version-id-marker") ?? "";
      const delimiter = req.query.get("delimiter") ?? "";
      const maxKeysRaw = Number(req.query.get("max-keys") ?? "1000");
      const maxKeys = Number.isFinite(maxKeysRaw)
        ? Math.min(Math.max(0, maxKeysRaw), 1000)
        : 1000;
      const toIso = (ts: number): string => new Date(ts * 1000).toISOString();
      const candidates = Object.values(target.objects)
        .flatMap((vs) => vs)
        .filter((v) => v.key.startsWith(prefix))
        .filter((v) => {
          if (keyMarker === "") return true;
          if (v.key > keyMarker) return true;
          if (v.key === keyMarker && versionIdMarker !== "")
            return (v.versionId ?? "null") < versionIdMarker;
          return false;
        })
        .sort((a, b) => {
          if (a.key !== b.key) return a.key < b.key ? -1 : 1;
          return b.lastModified - a.lastModified;
        });
      const resultVersions: typeof candidates = [];
      const commonPrefixes: string[] = [];
      const seenPrefixes = new Set<string>();
      let isTruncated = false;
      let nextKeyMarker: string | undefined;
      let nextVersionIdMarker: string | undefined;
      for (const v of candidates) {
        const rest = v.key.slice(prefix.length);
        const boundary = delimiter === "" ? -1 : rest.indexOf(delimiter);
        const group =
          boundary === -1
            ? undefined
            : prefix + rest.slice(0, boundary + delimiter.length);
        if (group !== undefined && seenPrefixes.has(group)) continue;
        if (resultVersions.length + commonPrefixes.length >= maxKeys) {
          isTruncated = maxKeys > 0;
          break;
        }
        if (group !== undefined) {
          seenPrefixes.add(group);
          commonPrefixes.push(group);
          nextKeyMarker =
            group.slice(0, -1) +
            String.fromCodePoint(
              (group.codePointAt(group.length - 1) ?? 0) + 1,
            );
          nextVersionIdMarker = undefined;
        } else {
          resultVersions.push(v);
          nextKeyMarker = v.key;
          nextVersionIdMarker = v.versionId ?? "null";
        }
      }
      const versionXml = resultVersions
        .map((v) => {
          if (v.isDeleteMarker) {
            return [
              `<DeleteMarker>`,
              `<Key>${escapeXml(v.key)}</Key>`,
              `<VersionId>${escapeXml(v.versionId ?? "null")}</VersionId>`,
              `<IsLatest>${(target.objects[v.key] ?? [])[0]?.versionId === v.versionId ? "true" : "false"}</IsLatest>`,
              `<LastModified>${toIso(v.lastModified)}</LastModified>`,
              `</DeleteMarker>`,
            ].join("");
          }
          return [
            `<Version>`,
            `<Key>${escapeXml(v.key)}</Key>`,
            `<VersionId>${escapeXml(v.versionId ?? "null")}</VersionId>`,
            `<IsLatest>${(target.objects[v.key] ?? [])[0]?.versionId === v.versionId ? "true" : "false"}</IsLatest>`,
            `<LastModified>${toIso(v.lastModified)}</LastModified>`,
            `<ETag>${escapeXml(v.etag)}</ETag>`,
            `<Size>${v.size}</Size>`,
            `<StorageClass>${escapeXml(v.storageClass)}</StorageClass>`,
            `</Version>`,
          ].join("");
        })
        .join("");
      const commonPrefixXml = commonPrefixes
        .map(
          (p) =>
            `<CommonPrefixes><Prefix>${escapeXml(p)}</Prefix></CommonPrefixes>`,
        )
        .join("");
      return {
        __xml: [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<ListVersionsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">`,
          `<IsTruncated>${isTruncated ? "true" : "false"}</IsTruncated>`,
          `<Name>${escapeXml(bucket)}</Name>`,
          `<Prefix>${escapeXml(prefix)}</Prefix>`,
          `<MaxKeys>${maxKeys}</MaxKeys>`,
          ...(keyMarker !== ""
            ? [`<KeyMarker>${escapeXml(keyMarker)}</KeyMarker>`]
            : []),
          ...(delimiter !== ""
            ? [`<Delimiter>${escapeXml(delimiter)}</Delimiter>`]
            : []),
          ...(isTruncated && nextKeyMarker !== undefined
            ? [`<NextKeyMarker>${escapeXml(nextKeyMarker)}</NextKeyMarker>`]
            : []),
          ...(isTruncated && nextVersionIdMarker !== undefined
            ? [
                `<NextVersionIdMarker>${escapeXml(nextVersionIdMarker)}</NextVersionIdMarker>`,
              ]
            : []),
          versionXml,
          commonPrefixXml,
          `</ListVersionsResult>`,
        ].join(""),
      };
    },
  },
  model,
};

export default s3;
