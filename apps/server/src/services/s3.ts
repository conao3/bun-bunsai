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

type S3Bucket = {
  name: string;
  creationDate: number;
  objects: Record<string, S3Object>;
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
      if (req.method === "PUT") return "CreateBucket";
      if (req.method === "DELETE") return "DeleteBucket";
      if (req.method === "GET") return "ListObjectsV2";
      if (req.method === "HEAD") return "HeadBucket";
      return undefined;
    }
    if (req.method === "PUT") return "PutObject";
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
  },
  model,
};

export default s3;
