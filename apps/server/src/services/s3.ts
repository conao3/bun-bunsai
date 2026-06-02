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
};

type S3Tag = {
  Key: string;
  Value: string;
};

type S3Bucket = {
  name: string;
  creationDate: number;
  objects: Record<string, S3Object>;
  tagSet: S3Tag[];
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
      if (req.method === "PUT") {
        if (hasTagging) return "PutBucketTagging";
        return "CreateBucket";
      }
      if (req.method === "DELETE") {
        if (hasTagging) return "DeleteBucketTagging";
        return "DeleteBucket";
      }
      if (req.method === "GET") {
        if (hasTagging) return "GetBucketTagging";
        if (hasLocation) return "GetBucketLocation";
        if (req.query.get("list-type") === "2") return "ListObjectsV2";
        return "ListObjects";
      }
      if (req.method === "HEAD") return "HeadBucket";
      return undefined;
    }
    if (req.method === "PUT") {
      if (req.headers.get("x-amz-copy-source") !== null) return "CopyObject";
      return "PutObject";
    }
    if (req.method === "GET") return "GetObject";
    if (req.method === "HEAD") return "HeadObject";
    if (req.method === "DELETE") return "DeleteObject";
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
      const tagging = input["Tagging"];
      const rawTagSet =
        typeof tagging === "object" && tagging !== null
          ? (tagging as Record<string, unknown>)["TagSet"]
          : undefined;
      const tagSet = Array.isArray(rawTagSet)
        ? rawTagSet.flatMap((tag) => {
            if (typeof tag !== "object" || tag === null) return [];
            const record = tag as Record<string, unknown>;
            const tagKey = record["Key"];
            const tagValue = record["Value"];
            if (typeof tagKey !== "string" || typeof tagValue !== "string") {
              return [];
            }
            return [{ Key: tagKey, Value: tagValue }];
          })
        : [];
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
  },
  model,
};

export default s3;
