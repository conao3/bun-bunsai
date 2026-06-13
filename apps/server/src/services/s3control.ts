import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/s3control.json", { with: { type: "json" } }),
);

const tagKey = (arn: string): string => `tag:${arn}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidRequest", `${field} is required.`, 400);
  }
  return value;
};

const arnFromPath = (path: string): string | undefined => {
  const marker = "/v20180820/tags/";
  const idx = path.indexOf(marker);
  if (idx < 0) return undefined;
  const tail = path.slice(idx + marker.length);
  if (tail === "") return undefined;
  return decodeURIComponent(tail.split("?")[0]);
};

const resourceArnFrom = (
  input: Record<string, unknown>,
  req: ParsedRequest,
): string => {
  const fromPath = arnFromPath(req.path);
  if (fromPath !== undefined && fromPath !== "") return fromPath;
  return requireString(input, "ResourceArn");
};

const getTagMap = (ctx: ServiceContext, arn: string): Record<string, string> =>
  ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};

const tagsAsList = (
  tags: Record<string, string>,
): Array<{ Key: string; Value: string }> =>
  Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));

const normalizeInputTags = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const k = e["Key"];
    const v = e["Value"];
    if (typeof k === "string" && typeof v === "string") out[k] = v;
  }
  return out;
};

const ListTagsForResource: OperationHandler = (input, ctx, req) => {
  const arn = resourceArnFrom(input, req);
  return { Tags: tagsAsList(getTagMap(ctx, arn)) };
};

const TagResource: OperationHandler = (input, ctx, req) => {
  const arn = resourceArnFrom(input, req);
  const newTags = normalizeInputTags(input["Tags"]);
  const existing = getTagMap(ctx, arn);
  ctx.store.set(tagKey(arn), { ...existing, ...newTags });
  return { $status: 204 };
};

const UntagResource: OperationHandler = (input, ctx, req) => {
  const arn = resourceArnFrom(input, req);
  const keys = Array.isArray(input["TagKeys"])
    ? input["TagKeys"].filter((k): k is string => typeof k === "string")
    : [];
  const existing = getTagMap(ctx, arn);
  const updated = { ...existing };
  for (const k of keys) delete updated[k];
  ctx.store.set(tagKey(arn), updated);
  return { $status: 204 };
};

const s3control = {
  name: "s3",
  protocol: "rest-xml",
  matches: (req: ParsedRequest): boolean => {
    if (req.path.includes("/v20180820/")) return true;
    const headers = req.headers as Headers | undefined;
    if (headers === undefined) return false;
    const host = (headers.get("host") ?? "").toLowerCase();
    if (host.includes("s3-control")) return true;
    if (headers.get("x-amz-account-id") !== null) return true;
    return false;
  },
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const idx = req.path.indexOf("/v20180820/tags/");
    if (idx < 0) return undefined;
    if (req.method === "GET") return "ListTagsForResource";
    if (req.method === "POST") return "TagResource";
    if (req.method === "DELETE") return "UntagResource";
    return undefined;
  },
  operations: {
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default s3control;
