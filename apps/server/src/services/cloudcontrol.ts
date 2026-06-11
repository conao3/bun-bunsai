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

const clientTokenKey = (token: string): string => `clienttoken:${token}`;

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
  PreviousResource?: StoredResource;
};

type StoredClientToken = {
  RequestToken: string;
  Identifier: string;
  Fingerprint: string;
};

const TYPE_NAME_RE =
  /^[A-Za-z0-9]{2,64}::[A-Za-z0-9]{2,64}::[A-Za-z0-9]{2,64}$/;

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

const validateTypeName = (typeName: string): void => {
  if (!TYPE_NAME_RE.test(typeName)) {
    throw awsError("ValidationException", `Invalid TypeName: ${typeName}`, 400);
  }
};

const validateMaxResults = (maxResults: number): void => {
  if (maxResults < 1 || maxResults > 100) {
    throw awsError(
      "ValidationException",
      "MaxResults must be between 1 and 100.",
      400,
    );
  }
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
  if (req.OperationStatus === "PENDING") {
    const updated: StoredRequest = { ...req, OperationStatus: "SUCCESS" };
    ctx.store.set(requestKey(req.RequestToken), updated);
    return updated;
  }
  if (req.OperationStatus === "CANCEL_IN_PROGRESS") {
    const updated: StoredRequest = {
      ...req,
      OperationStatus: "CANCEL_COMPLETE",
    };
    ctx.store.set(requestKey(req.RequestToken), updated);
    return updated;
  }
  return req;
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

const extractIdentifier = (typeName: string, desiredState: string): string => {
  let props: Record<string, unknown>;
  try {
    props = JSON.parse(desiredState) as Record<string, unknown>;
  } catch {
    return uuid();
  }

  const shortName = typeName.split("::").pop() ?? "";
  const byShortNameKey = `${shortName}Name`;
  if (
    typeof props[byShortNameKey] === "string" &&
    (props[byShortNameKey] as string) !== ""
  ) {
    return props[byShortNameKey] as string;
  }

  if (typeof props["Name"] === "string" && props["Name"] !== "") {
    return props["Name"] as string;
  }

  if (typeof props["Id"] === "string" && props["Id"] !== "") {
    return props["Id"] as string;
  }

  return uuid();
};

const hasPendingRequest = (
  typeName: string,
  identifier: string,
  ctx: ServiceContext,
): boolean =>
  listAllRequests(ctx).some(
    (r) =>
      r.TypeName === typeName &&
      r.Identifier === identifier &&
      r.OperationStatus === "PENDING",
  );

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

const handleClientToken = (
  clientToken: string | undefined,
  fingerprint: string,
  ctx: ServiceContext,
): StoredRequest | undefined => {
  if (clientToken === undefined) return undefined;

  const existing = ctx.store.get<StoredClientToken>(
    clientTokenKey(clientToken),
  );
  if (existing === undefined) return undefined;

  if (existing.Fingerprint !== fingerprint) {
    throw awsError(
      "ClientTokenConflictException",
      "ClientToken reused with different request parameters.",
      400,
    );
  }

  return ctx.store.get<StoredRequest>(requestKey(existing.RequestToken));
};

const storeClientToken = (
  clientToken: string | undefined,
  requestToken: string,
  identifier: string,
  fingerprint: string,
  ctx: ServiceContext,
): void => {
  if (clientToken === undefined) return;
  ctx.store.set<StoredClientToken>(clientTokenKey(clientToken), {
    RequestToken: requestToken,
    Identifier: identifier,
    Fingerprint: fingerprint,
  });
};

const CreateResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  validateTypeName(typeName);
  const desiredState = requireString(input, "DesiredState");
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;

  const fingerprint = `CREATE:${typeName}:${desiredState}`;
  const replay = handleClientToken(clientToken, fingerprint, ctx);
  if (replay !== undefined) {
    return { ProgressEvent: progressEventFrom(replay) };
  }

  const identifier = extractIdentifier(typeName, desiredState);

  if (
    ctx.store.get<StoredResource>(resourceKey(typeName, identifier)) !==
    undefined
  ) {
    throw awsError(
      "AlreadyExistsException",
      `Resource already exists: ${identifier}`,
      400,
    );
  }

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
  storeClientToken(clientToken, requestToken, identifier, fingerprint, ctx);

  return { ProgressEvent: progressEventFrom(request) };
};

const GetResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  validateTypeName(typeName);
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
  validateTypeName(typeName);
  const identifier = requireString(input, "Identifier");
  const patchDocument = requireString(input, "PatchDocument");
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;

  const fingerprint = `UPDATE:${typeName}:${identifier}:${patchDocument}`;
  const replay = handleClientToken(clientToken, fingerprint, ctx);
  if (replay !== undefined) {
    return { ProgressEvent: progressEventFrom(replay) };
  }

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

  if (hasPendingRequest(typeName, identifier, ctx)) {
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
    PreviousResource: resource,
  };
  ctx.store.set(requestKey(requestToken), request);
  storeClientToken(clientToken, requestToken, identifier, fingerprint, ctx);

  return { ProgressEvent: progressEventFrom(request) };
};

const DeleteResource: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  validateTypeName(typeName);
  const identifier = requireString(input, "Identifier");
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;

  const fingerprint = `DELETE:${typeName}:${identifier}`;
  const replay = handleClientToken(clientToken, fingerprint, ctx);
  if (replay !== undefined) {
    return { ProgressEvent: progressEventFrom(replay) };
  }

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

  if (hasPendingRequest(typeName, identifier, ctx)) {
    throw awsError(
      "ConcurrentOperationException",
      `Concurrent operation in progress for resource: ${identifier}`,
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
    PreviousResource: resource,
  };
  ctx.store.set(requestKey(requestToken), request);
  storeClientToken(clientToken, requestToken, identifier, fingerprint, ctx);

  return { ProgressEvent: progressEventFrom(request) };
};

const ListResources: OperationHandler = (input, ctx) => {
  const typeName = requireString(input, "TypeName");
  validateTypeName(typeName);
  const nextToken =
    typeof input["NextToken"] === "string" ? input["NextToken"] : undefined;
  const maxResultsRaw =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : 100;
  validateMaxResults(maxResultsRaw);
  const maxResults = maxResultsRaw;

  const resourceModelRaw =
    typeof input["ResourceModel"] === "string"
      ? input["ResourceModel"]
      : undefined;

  let all = listAllResources(ctx).filter((r) => r.TypeName === typeName);

  if (resourceModelRaw !== undefined) {
    let filter: Record<string, unknown>;
    try {
      filter = JSON.parse(resourceModelRaw) as Record<string, unknown>;
    } catch {
      filter = {};
    }
    const filterKeys = Object.keys(filter);
    if (filterKeys.length > 0) {
      all = all.filter((r) => {
        let props: Record<string, unknown>;
        try {
          props = JSON.parse(r.Properties) as Record<string, unknown>;
        } catch {
          return false;
        }
        return filterKeys.every((k) => props[k] === filter[k]);
      });
    }
  }

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
  const maxResultsRaw =
    typeof input["MaxResults"] === "number" ? input["MaxResults"] : 20;
  validateMaxResults(maxResultsRaw);
  const maxResults = maxResultsRaw;
  const nextToken =
    typeof input["NextToken"] === "string" ? input["NextToken"] : undefined;

  const rawFilter = input["ResourceRequestStatusFilter"] as
    | Record<string, unknown>
    | undefined;
  const filterTypes = Array.isArray(rawFilter?.["Operations"])
    ? (rawFilter["Operations"] as string[])
    : undefined;
  const filterStatuses = Array.isArray(rawFilter?.["OperationStatuses"])
    ? (rawFilter["OperationStatuses"] as string[])
    : undefined;

  let all = listAllRequests(ctx);

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

  if (req.OperationType === "CREATE") {
    ctx.store.delete(resourceKey(req.TypeName, req.Identifier));
  } else if (
    (req.OperationType === "DELETE" || req.OperationType === "UPDATE") &&
    req.PreviousResource !== undefined
  ) {
    ctx.store.set(
      resourceKey(req.TypeName, req.Identifier),
      req.PreviousResource,
    );
  }

  const cancelled: StoredRequest = {
    ...req,
    OperationStatus: "CANCEL_IN_PROGRESS",
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
