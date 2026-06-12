import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/mediastore.json", { with: { type: "json" } }),
  { targetPrefix: "MediaStore_20170901" },
);

type StoredContainer = {
  Name: string;
  ARN: string;
  Endpoint: string;
  Status: string;
  CreationTime: number;
  AccessLoggingEnabled: boolean;
};

const containerKey = (name: string): string => `container/${name}`;
const policyKey = (type: string, name: string): string =>
  `policy/${type}/${name}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const encodeCursor = (offset: number): string => btoa(String(offset));

const decodeCursor = (token: string): number => {
  const n = parseInt(atob(token), 10);
  return isNaN(n) ? 0 : n;
};

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; NextToken: string | undefined } => {
  const offset = typeof nextToken === "string" ? decodeCursor(nextToken) : 0;
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : items.length;
  const page = items.slice(offset, offset + max);
  const token =
    offset + max < items.length ? encodeCursor(offset + max) : undefined;
  return { items: page, NextToken: token };
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const containerArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:mediastore:${ctx.region}:${ctx.account}:container/${name}`;

const containerEndpoint = (name: string): string =>
  `https://${name}.data.mediastore.amazonaws.com`;

const getContainer = (ctx: ServiceContext, name: string): StoredContainer => {
  const container = ctx.store.get<StoredContainer>(containerKey(name));
  if (container === undefined) {
    throw awsError(
      "ContainerNotFoundException",
      `Container not found: ${name}`,
      400,
    );
  }
  return container;
};

const requireContainer = (
  ctx: ServiceContext,
  name: string,
): StoredContainer => {
  const container = getContainer(ctx, name);
  if (container.Status === "DELETING") {
    throw awsError(
      "ContainerInUseException",
      `Container is being deleted: ${name}`,
      400,
    );
  }
  return container;
};

const CreateContainer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  if (ctx.store.get<StoredContainer>(containerKey(name)) !== undefined) {
    throw awsError(
      "ContainerInUseException",
      `Container already exists: ${name}`,
      400,
    );
  }
  const container: StoredContainer = {
    Name: name,
    ARN: containerArn(ctx, name),
    Endpoint: containerEndpoint(name),
    Status: "ACTIVE",
    CreationTime: Math.floor(Date.now() / 1000),
    AccessLoggingEnabled: false,
  };
  ctx.store.set(containerKey(name), container);
  return { Container: { ...container, Status: "CREATING", Endpoint: "" } };
};

const DescribeContainer: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ContainerName"]);
  if (name === undefined) {
    throw awsError("ValidationException", "ContainerName is required.", 400);
  }
  const container = getContainer(ctx, name);
  return { Container: container };
};

const ListContainers: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredContainer>()
    .filter(
      (entry) =>
        entry.key.startsWith("container/") && entry.value.Status !== "DELETING",
    )
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Containers: items, NextToken };
};

const DeleteContainer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  const container = getContainer(ctx, name);
  if (container.Status === "DELETING") {
    ctx.store.delete(containerKey(name));
  } else {
    ctx.store.set(containerKey(name), { ...container, Status: "DELETING" });
  }
  return {};
};

const PutContainerPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const policy = requireString(input, "Policy");
  ctx.store.set(policyKey("container", name), policy);
  return {};
};

const GetContainerPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const policy = ctx.store.get<string>(policyKey("container", name));
  if (policy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No container policy for: ${name}`,
      400,
    );
  }
  return { Policy: policy };
};

const DeleteContainerPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const policy = ctx.store.get<string>(policyKey("container", name));
  if (policy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No container policy for: ${name}`,
      400,
    );
  }
  ctx.store.delete(policyKey("container", name));
  return {};
};

const PutCorsPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const corsPolicy = input["CorsPolicy"];
  if (!Array.isArray(corsPolicy)) {
    throw awsError("ValidationException", "CorsPolicy is required.", 400);
  }
  ctx.store.set(policyKey("cors", name), corsPolicy);
  return {};
};

const GetCorsPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const corsPolicy = ctx.store.get<unknown[]>(policyKey("cors", name));
  if (corsPolicy === undefined) {
    throw awsError(
      "CorsPolicyNotFoundException",
      `No CORS policy for: ${name}`,
      400,
    );
  }
  return { CorsPolicy: corsPolicy };
};

const DeleteCorsPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const corsPolicy = ctx.store.get<unknown[]>(policyKey("cors", name));
  if (corsPolicy === undefined) {
    throw awsError(
      "CorsPolicyNotFoundException",
      `No CORS policy for: ${name}`,
      400,
    );
  }
  ctx.store.delete(policyKey("cors", name));
  return {};
};

const PutLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const lifecyclePolicy = requireString(input, "LifecyclePolicy");
  ctx.store.set(policyKey("lifecycle", name), lifecyclePolicy);
  return {};
};

const GetLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const lifecyclePolicy = ctx.store.get<string>(policyKey("lifecycle", name));
  if (lifecyclePolicy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No lifecycle policy for: ${name}`,
      400,
    );
  }
  return { LifecyclePolicy: lifecyclePolicy };
};

const DeleteLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const lifecyclePolicy = ctx.store.get<string>(policyKey("lifecycle", name));
  if (lifecyclePolicy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No lifecycle policy for: ${name}`,
      400,
    );
  }
  ctx.store.delete(policyKey("lifecycle", name));
  return {};
};

const PutMetricPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const metricPolicy = input["MetricPolicy"];
  if (
    typeof metricPolicy !== "object" ||
    metricPolicy === null ||
    Array.isArray(metricPolicy)
  ) {
    throw awsError("ValidationException", "MetricPolicy is required.", 400);
  }
  ctx.store.set(policyKey("metric", name), metricPolicy);
  return {};
};

const GetMetricPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const metricPolicy = ctx.store.get<unknown>(policyKey("metric", name));
  if (metricPolicy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No metric policy for: ${name}`,
      400,
    );
  }
  return { MetricPolicy: metricPolicy };
};

const DeleteMetricPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  requireContainer(ctx, name);
  const metricPolicy = ctx.store.get<unknown>(policyKey("metric", name));
  if (metricPolicy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      `No metric policy for: ${name}`,
      400,
    );
  }
  ctx.store.delete(policyKey("metric", name));
  return {};
};

const StartAccessLogging: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  const container = requireContainer(ctx, name);
  ctx.store.set(containerKey(name), {
    ...container,
    AccessLoggingEnabled: true,
  });
  return {};
};

const StopAccessLogging: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContainerName");
  const container = requireContainer(ctx, name);
  ctx.store.set(containerKey(name), {
    ...container,
    AccessLoggingEnabled: false,
  });
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resource = requireString(input, "Resource");
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resource)) ?? {};
  for (const tag of tags as Array<{ Key: string; Value?: string }>) {
    existing[tag.Key] = tag.Value ?? "";
  }
  ctx.store.set(tagsKey(resource), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resource = requireString(input, "Resource");
  const tagKeys = input["TagKeys"];
  if (!Array.isArray(tagKeys)) {
    throw awsError("ValidationException", "TagKeys is required.", 400);
  }
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resource)) ?? {};
  for (const key of tagKeys as string[]) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(resource), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resource = requireString(input, "Resource");
  const tagsMap =
    ctx.store.get<Record<string, string>>(tagsKey(resource)) ?? {};
  const tags = Object.entries(tagsMap).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tags };
};

const mediastore = {
  name: "mediastore",
  protocol: "json",
  operations: {
    CreateContainer,
    DescribeContainer,
    ListContainers,
    DeleteContainer,
    PutContainerPolicy,
    GetContainerPolicy,
    DeleteContainerPolicy,
    PutCorsPolicy,
    GetCorsPolicy,
    DeleteCorsPolicy,
    PutLifecyclePolicy,
    GetLifecyclePolicy,
    DeleteLifecyclePolicy,
    PutMetricPolicy,
    GetMetricPolicy,
    DeleteMetricPolicy,
    StartAccessLogging,
    StopAccessLogging,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default mediastore;
