import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cloudcontrolModel from "../../../../test/vendor/aws-models/cloudcontrol.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(cloudcontrolModel);

const uuid = (): string => crypto.randomUUID();

const resourceKey = (typeName: string, identifier: string): string =>
  `resource:${typeName}:${identifier}`;

const requestKey = (requestToken: string): string => `req:${requestToken}`;

type StoredResource = {
  TypeName: string;
  Identifier: string;
  Properties: string;
};

type OperationStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCESS"
  | "FAILED"
  | "CANCEL_IN_PROGRESS"
  | "CANCEL_COMPLETE";

type OperationType = "CREATE" | "DELETE" | "UPDATE";

type StoredRequest = {
  RequestToken: string;
  TypeName: string;
  Identifier: string;
  OperationType: OperationType;
  OperationStatus: OperationStatus;
  EventTime: number;
  StatusMessage?: string;
  ResourceModel?: string;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const v = input[field];
  if (typeof v !== "string" || v === "") {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return v;
};

const listAllResources = (ctx: ServiceContext): StoredResource[] =>
  ctx.store
    .list<StoredResource>()
    .filter((e) => e.key.startsWith("resource:"))
    .map((e) => e.value);

const listAllRequests = (ctx: ServiceContext): StoredRequest[] =>
  ctx.store
    .list<StoredRequest>()
    .filter((e) => e.key.startsWith("req:"))
    .map((e) => e.value);

const resolveRequest = (
  req: StoredRequest,
  ctx: ServiceContext,
): StoredRequest => {
  if (req.OperationStatus !== "PENDING") return req;
  const updated: StoredRequest = { ...req, OperationStatus: "SUCCESS" };
  ctx.store.set(requestKey(req.RequestToken), updated);
  return updated;
};

const progressEventFrom = (req: StoredRequest) => ({
  TypeName: req.TypeName,
  Identifier: req.Identifier,
  RequestToken: req.RequestToken,
  Operation: req.OperationType,
  OperationStatus: req.OperationStatus,
  EventTime: new Date(req.EventTime * 1000).toISOString(),
  StatusMessage: req.StatusMessage,
  ResourceModel: req.ResourceModel,
});

const applyJsonPatch = (
  target: unknown,
  patch: unknown[],
): Record<string, unknown> => {
  const obj = structuredClone(target) as Record<string, unknown>;
  for (const operation of patch) {
    const op = operation as { op: string; path: string; value?: unknown };
    if (!op.path.startsWith("/")) {
      throw awsError(
        "InvalidRequestException",
        `Invalid JSON Patch path: ${op.path}`,
        400,
      );
    }
    const parts = op.path
      .slice(1)
      .split("/")
      .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));

    if (op.op === "add" || op.op === "replace") {
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
          cur[parts[i]] = {};
        }
        cur = cur[parts[i]] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = op.value;
    } else if (op.op === "remove") {
      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) break;
        cur = cur[parts[i]] as Record<string, unknown>;
      }
      delete cur[parts[parts.length - 1]];
    } else {
      throw awsError(
        "InvalidRequestException",
        `Unsupported JSON Patch op: ${op.op}`,
        400,
      );
    }
  }
  return obj;
};

const CreateResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  const desiredState = requireString(input, "DesiredState");

  const identifier = uuid();

  const resource: StoredResource = {
    TypeName: typeName,
    Identifier: identifier,
    Properties: desiredState,
  };
  ctx.store.set(resourceKey(typeName, identifier), resource);

  const requestToken = uuid();
  const now = Math.floor(Date.now() / 1000);
  const request: StoredRequest = {
    RequestToken: requestToken,
    TypeName: typeName,
    Identifier: identifier,
    OperationType: "CREATE",
    OperationStatus: "PENDING",
    EventTime: now,
    ResourceModel: desiredState,
  };
  ctx.store.set(requestKey(requestToken), request);

  return { ProgressEvent: progressEventFrom(request) };
};

const GetResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  const identifier = requireString(input, "Identifier");

  const resource = ctx.store.get<StoredResource>(
    resourceKey(typeName, identifier),
  );
  if (resource === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${identifier}`,
      400,
    );
  }

  return {
    TypeName: typeName,
    ResourceDescription: {
      Identifier: resource.Identifier,
      Properties: resource.Properties,
    },
  };
};

const UpdateResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  const identifier = requireString(input, "Identifier");
  const patchDocument = requireString(input, "PatchDocument");

  const resource = ctx.store.get<StoredResource>(
    resourceKey(typeName, identifier),
  );
  if (resource === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${identifier}`,
      400,
    );
  }

  const concurrent = listAllRequests(ctx).find(
    (r) =>
      r.TypeName === typeName &&
      r.Identifier === identifier &&
      r.OperationStatus === "PENDING",
  );
  if (concurrent !== undefined) {
    throw awsError(
      "ConcurrentOperationException",
      `Concurrent operation in progress for resource: ${identifier}`,
      400,
    );
  }

  let patch: unknown[];
  try {
    patch = JSON.parse(patchDocument) as unknown[];
  } catch {
    throw awsError(
      "InvalidRequestException",
      "PatchDocument is not valid JSON.",
      400,
    );
  }
  if (!Array.isArray(patch)) {
    throw awsError(
      "InvalidRequestException",
      "PatchDocument must be a JSON array.",
      400,
    );
  }

  let currentProps: unknown;
  try {
    currentProps = JSON.parse(resource.Properties);
  } catch {
    currentProps = {};
  }

  const updatedProps = applyJsonPatch(currentProps, patch);
  const updatedPropsStr = JSON.stringify(updatedProps);

  const updatedResource: StoredResource = {
    ...resource,
    Properties: updatedPropsStr,
  };
  ctx.store.set(resourceKey(typeName, identifier), updatedResource);

  const requestToken = uuid();
  const now = Math.floor(Date.now() / 1000);
  const request: StoredRequest = {
    RequestToken: requestToken,
    TypeName: typeName,
    Identifier: identifier,
    OperationType: "UPDATE",
    OperationStatus: "PENDING",
    EventTime: now,
    ResourceModel: updatedPropsStr,
  };
  ctx.store.set(requestKey(requestToken), request);

  return { ProgressEvent: progressEventFrom(request) };
};

const DeleteResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  const identifier = requireString(input, "Identifier");

  const resource = ctx.store.get<StoredResource>(
    resourceKey(typeName, identifier),
  );
  if (resource === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${identifier}`,
      400,
    );
  }

  ctx.store.delete(resourceKey(typeName, identifier));

  const requestToken = uuid();
  const now = Math.floor(Date.now() / 1000);
  const request: StoredRequest = {
    RequestToken: requestToken,
    TypeName: typeName,
    Identifier: identifier,
    OperationType: "DELETE",
    OperationStatus: "PENDING",
    EventTime: now,
  };
  ctx.store.set(requestKey(requestToken), request);

  return { ProgressEvent: progressEventFrom(request) };
};

const ListResources: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  const nextToken =
    typeof input["NextToken"] === "string" ? input["NextToken"] : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : 100;

  const all = listAllResources(ctx).filter((r) => r.TypeName === typeName);

  const startIdx = nextToken !== undefined ? parseInt(nextToken, 10) : 0;
  const page = all.slice(startIdx, startIdx + maxResults);
  const nextIdx = startIdx + page.length;
  const hasMore = nextIdx < all.length;

  return {
    TypeName: typeName,
    ResourceDescriptions: page.map((r) => ({
      Identifier: r.Identifier,
      Properties: r.Properties,
    })),
    NextToken: hasMore ? String(nextIdx) : undefined,
  };
};

const GetResourceRequestStatus: OperationHandler = (input, ctx) => {
  const requestToken = requireString(input, "RequestToken");

  const req = ctx.store.get<StoredRequest>(requestKey(requestToken));
  if (req === undefined) {
    throw awsError(
      "RequestTokenNotFoundException",
      `Request token not found: ${requestToken}`,
      400,
    );
  }

  const resolved = resolveRequest(req, ctx);

  return { ProgressEvent: progressEventFrom(resolved) };
};

const ListResourceRequests: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : 20;
  const nextToken =
    typeof input["NextToken"] === "string" ? input["NextToken"] : undefined;

  const rawFilter = input["ResourceRequestStatusFilter"] as
    | Record<string, unknown>
    | undefined;
  const filterTypes = Array.isArray(rawFilter?.["OperationTypes"])
    ? (rawFilter["OperationTypes"] as string[])
    : undefined;
  const filterStatuses = Array.isArray(rawFilter?.["OperationStatuses"])
    ? (rawFilter["OperationStatuses"] as string[])
    : undefined;

  let all = listAllRequests(ctx).map((r) => resolveRequest(r, ctx));

  if (filterTypes !== undefined) {
    all = all.filter((r) => filterTypes.includes(r.OperationType));
  }
  if (filterStatuses !== undefined) {
    all = all.filter((r) => filterStatuses.includes(r.OperationStatus));
  }

  const startIdx = nextToken !== undefined ? parseInt(nextToken, 10) : 0;
  const page = all.slice(startIdx, startIdx + maxResults);
  const nextIdx = startIdx + page.length;
  const hasMore = nextIdx < all.length;

  return {
    ResourceRequestStatusSummaries: page.map((r) => progressEventFrom(r)),
    NextToken: hasMore ? String(nextIdx) : undefined,
  };
};

const CancelResourceRequest: OperationHandler = (input, ctx) => {
  const requestToken = requireString(input, "RequestToken");

  const req = ctx.store.get<StoredRequest>(requestKey(requestToken));
  if (req === undefined) {
    throw awsError(
      "RequestTokenNotFoundException",
      `Request token not found: ${requestToken}`,
      400,
    );
  }
  if (req.OperationStatus !== "PENDING") {
    throw awsError(
      "ConcurrentModificationException",
      `Cannot cancel request in status: ${req.OperationStatus}`,
      400,
    );
  }

  const cancelled: StoredRequest = {
    ...req,
    OperationStatus: "CANCEL_COMPLETE",
  };
  ctx.store.set(requestKey(requestToken), cancelled);

  return { ProgressEvent: progressEventFrom(cancelled) };
};

const cloudcontrol = {
  name: "cloudcontrolapi",
  protocol: "json",
  operations: {
    CreateResource,
    GetResource,
    UpdateResource,
    DeleteResource,
    ListResources,
    GetResourceRequestStatus,
    ListResourceRequests,
    CancelResourceRequest,
  },
  model,
} as const satisfies ServiceDefinition;

export default cloudcontrol;
