import type {
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import s3Model from "../../../../test/vendor/aws-models/s3.json" with { type: "json" };

const model = loadServiceModel(s3Model);

type S3Object = {
  key: string;
  body: string;
  contentType: string;
  etag: string;
  size: number;
  lastModified: number;
  tagSet: S3Tag[];
};

type S3Tag = {
  Key: string;
  Value: string;
};

type S3Part = {
  partNumber: number;
  body: string;
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
};

type S3Bucket = {
  name: string;
  creationDate: number;
  objects: Record<string, S3Object>;
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
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const hashBody = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(16).padStart(8, "0").repeat(4).slice(0, 32);
};

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

const getBucket = (ctx: ServiceContext, name: string): S3Bucket => {
  const bucket = ctx.store.get<S3Bucket>(name);
  if (bucket === undefined) {
    throw awsError("NoSuchBucket", "The specified bucket does not exist", 404);
  }
  return bucket;
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

const s3: ServiceDefinition = {
  name: "s3",
  protocol: "rest-xml",
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
        return "CreateBucket";
      }
      if (req.method === "DELETE") {
        if (hasTagging) return "DeleteBucketTagging";
        if (hasPolicy) return "DeleteBucketPolicy";
        if (hasCors) return "DeleteBucketCors";
        if (hasWebsite) return "DeleteBucketWebsite";
        if (hasPublicAccessBlock) return "DeletePublicAccessBlock";
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
        if (req.query.get("list-type") === "2") return "ListObjectsV2";
        return "ListObjects";
      }
      if (req.method === "HEAD") return "HeadBucket";
      return undefined;
    }
    const hasUploads = req.query.has("uploads");
    const hasUploadId = req.query.has("uploadId");
    const hasObjectTagging = req.query.has("tagging");
    if (req.method === "POST") {
      if (hasUploads) return "CreateMultipartUpload";
      if (hasUploadId) return "CompleteMultipartUpload";
      return undefined;
    }
    if (req.method === "PUT") {
      if (hasUploadId) return "UploadPart";
      if (hasObjectTagging) return "PutObjectTagging";
      if (req.headers.get("x-amz-copy-source") !== null) return "CopyObject";
      return "PutObject";
    }
    if (req.method === "GET") {
      if (hasUploadId) return "ListParts";
      if (hasObjectTagging) return "GetObjectTagging";
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
    CreateBucket: (_input, ctx, req) => {
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
      ctx.store.set<S3Bucket>(bucket, {
        name: bucket,
        creationDate: nowSeconds(),
        objects: {},
        tagSet: [],
        uploads: {},
        versioningStatus: undefined,
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
        objectLock: undefined,
      });
      return {};
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
      getBucket(ctx, bucket);
      ctx.store.delete(bucket);
      return {};
    },
    HeadBucket: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      getBucket(ctx, bucket);
      return {};
    },
    PutObject: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const body = req.bodyText;
      const etag = `"${hashBody(`${key}:${body}`)}"`;
      const object: S3Object = {
        key,
        body,
        contentType:
          req.headers.get("content-type") ?? "application/octet-stream",
        etag,
        size: Buffer.byteLength(body),
        lastModified: nowSeconds(),
        tagSet: [],
      };
      const next: S3Bucket = {
        ...target,
        objects: { ...target.objects, [key]: object },
      };
      ctx.store.set<S3Bucket>(bucket, next);
      return { ETag: object.etag };
    },
    GetObject: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const object = target.objects[key];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      return {
        Body: object.body,
        ContentLength: object.size,
        ETag: object.etag,
        LastModified: object.lastModified,
      };
    },
    HeadObject: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const object = target.objects[key];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      return {
        ContentLength: object.size,
        ETag: object.etag,
        LastModified: object.lastModified,
      };
    },
    ListObjectsV2: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const prefix = req.query.get("prefix") ?? "";
      const all = Object.values(target.objects)
        .filter((o) => o.key.startsWith(prefix))
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return {
        Name: bucket,
        Prefix: prefix,
        KeyCount: all.length,
        MaxKeys: 1000,
        IsTruncated: false,
        Contents: all.map((o) => ({
          Key: o.key,
          LastModified: o.lastModified,
          ETag: o.etag,
          Size: o.size,
          StorageClass: "STANDARD",
        })),
      };
    },
    DeleteObject: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      if (target.objects[key] !== undefined) {
        const rest = { ...target.objects };
        delete rest[key];
        ctx.store.set<S3Bucket>(bucket, { ...target, objects: rest });
      }
      return {};
    },
    ListObjects: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      const target = getBucket(ctx, bucket);
      const prefix = req.query.get("prefix") ?? "";
      const marker = req.query.get("marker") ?? "";
      const all = Object.values(target.objects)
        .filter((o) => o.key.startsWith(prefix))
        .filter((o) => o.key > marker)
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      return {
        Name: bucket,
        Prefix: prefix,
        Marker: marker,
        MaxKeys: 1000,
        IsTruncated: false,
        Contents: all.map((o) => ({
          Key: o.key,
          LastModified: o.lastModified,
          ETag: o.etag,
          Size: o.size,
          StorageClass: "STANDARD",
        })),
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
      const sourceRef = copySource.split("?")[0];
      const { bucket: srcBucket, key: srcKey } = bucketKeyFromPath(sourceRef);
      if (srcBucket === undefined || srcKey === undefined) {
        throw awsError("InvalidArgument", "invalid copy source", 400);
      }
      const sourceBucket = getBucket(ctx, srcBucket);
      const source = sourceBucket.objects[srcKey];
      if (source === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const lastModified = nowSeconds();
      const object: S3Object = {
        key,
        body: source.body,
        contentType: source.contentType,
        etag: source.etag,
        size: source.size,
        lastModified,
        tagSet: [],
      };
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: object },
      });
      return {
        CopyObjectResult: {
          ETag: object.etag,
          LastModified: lastModified,
        },
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
      return {
        TagSet: (target.tagSet ?? []).map((tag) => ({
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
    CreateMultipartUpload: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const uploadId = hashBody(`${key}:${Date.now()}:${Math.random()}`);
      const upload: S3Upload = {
        uploadId,
        key,
        initiated: nowSeconds(),
        contentType:
          req.headers.get("content-type") ?? "application/octet-stream",
        parts: {},
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
      const body = req.bodyText;
      const etag = `"${hashBody(`${uploadId}:${partNumber}:${body}`)}"`;
      const part: S3Part = {
        partNumber,
        body,
        etag,
        size: Buffer.byteLength(body),
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
            return [partNumber];
          })
        : Object.values(upload.parts)
            .map((p) => p.partNumber)
            .sort((a, b) => a - b);
      const combined = requested
        .map((partNumber) => {
          const part = upload.parts[String(partNumber)];
          if (part === undefined) {
            throw awsError(
              "InvalidPart",
              "One or more of the specified parts could not be found.",
              400,
            );
          }
          return part.body;
        })
        .join("");
      const etag = `"${hashBody(`${key}:${combined}`)}-${requested.length}"`;
      const object: S3Object = {
        key,
        body: combined,
        contentType: upload.contentType,
        etag,
        size: Buffer.byteLength(combined),
        lastModified: nowSeconds(),
        tagSet: [],
      };
      const rest = { ...target.uploads };
      delete rest[uploadId];
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: object },
        uploads: rest,
      });
      return {
        Location: `http://${bucket}.s3.${req.region}.amazonaws.com/${key}`,
        Bucket: bucket,
        Key: key,
        ETag: etag,
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
      const object = target.objects[key];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      const tagSet = parseTagSet(input["Tagging"]);
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: { ...object, tagSet } },
      });
      return {};
    },
    GetObjectTagging: (_input, ctx, req) => {
      const { bucket, key } = bucketKeyFromPath(req.path);
      if (bucket === undefined || key === undefined) {
        throw awsError("InvalidRequest", "bucket and key required", 400);
      }
      const target = getBucket(ctx, bucket);
      const object = target.objects[key];
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
      const object = target.objects[key];
      if (object === undefined) {
        throw awsError("NoSuchKey", "The specified key does not exist.", 404);
      }
      ctx.store.set<S3Bucket>(bucket, {
        ...target,
        objects: { ...target.objects, [key]: { ...object, tagSet: [] } },
      });
      return {};
    },
    GetBucketAcl: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      getBucket(ctx, bucket);
      return {
        Owner: { ID: "bunsai", DisplayName: "bunsai" },
        Grants: [
          {
            Grantee: {
              ID: "bunsai",
              DisplayName: "bunsai",
              Type: "CanonicalUser",
            },
            Permission: "FULL_CONTROL",
          },
        ],
      };
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
  },
  model,
};

export default s3;
