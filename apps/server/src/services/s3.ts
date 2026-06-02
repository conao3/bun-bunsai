import type {
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { awsError } from "../core/framework.ts";

type S3Object = {
  key: string;
  body: string;
  contentType: string;
  etag: string;
  size: number;
  lastModified: string;
};

type S3Bucket = {
  name: string;
  creationDate: string;
  objects: Record<string, S3Object>;
};

const xmlns = "http://s3.amazonaws.com/doc/2006-03-01/" as const;

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

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
        creationDate: new Date().toISOString(),
        objects: {},
      });
      return { __xml: "" };
    },
    ListBuckets: (_input, ctx) => {
      const buckets = ctx.store.list<S3Bucket>();
      const entries = buckets
        .map(
          (b) =>
            `<Bucket><Name>${escapeXml(b.value.name)}</Name><CreationDate>${b.value.creationDate}</CreationDate></Bucket>`,
        )
        .join("");
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<ListAllMyBucketsResult xmlns="${xmlns}"><Owner><ID>bunsai</ID><DisplayName>bunsai</DisplayName></Owner><Buckets>${entries}</Buckets></ListAllMyBucketsResult>`;
      return { __xml: body };
    },
    DeleteBucket: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      getBucket(ctx, bucket);
      ctx.store.delete(bucket);
      return { __xml: "" };
    },
    HeadBucket: (_input, ctx, req) => {
      const { bucket } = bucketKeyFromPath(req.path);
      if (bucket === undefined) {
        throw awsError("InvalidBucketName", "bucket name required", 400);
      }
      getBucket(ctx, bucket);
      return { __xml: "" };
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
        lastModified: new Date().toISOString(),
      };
      const next: S3Bucket = {
        ...target,
        objects: { ...target.objects, [key]: object },
      };
      ctx.store.set<S3Bucket>(bucket, next);
      return { __xml: "" };
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
      return { __xml: object.body };
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
      return { __xml: "" };
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
      const contents = all
        .map(
          (o) =>
            `<Contents><Key>${escapeXml(o.key)}</Key><LastModified>${o.lastModified}</LastModified><ETag>${escapeXml(o.etag)}</ETag><Size>${o.size}</Size><StorageClass>STANDARD</StorageClass></Contents>`,
        )
        .join("");
      const body = `<?xml version="1.0" encoding="UTF-8"?>\n<ListBucketResult xmlns="${xmlns}"><Name>${escapeXml(bucket)}</Name><Prefix>${escapeXml(prefix)}</Prefix><KeyCount>${all.length}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`;
      return { __xml: body };
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
      return { __xml: "" };
    },
  },
};

export default s3;
