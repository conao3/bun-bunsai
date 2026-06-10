import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import pipesModel from "../../../../test/vendor/aws-models/pipes.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";
import { deliverToArn, registerEventSource } from "../core/events.ts";
import { parseArn } from "../core/arn.ts";

const model = loadServiceModel(pipesModel);

const pipePrefix = "pipe:" as const;

type StoredFilter = { Pattern: string | undefined };

type StoredPipe = {
  Name: string;
  Arn: string;
  Description: string | undefined;
  DesiredState: string;
  CurrentState: string;
  StateReason: string | undefined;
  Source: string;
  SourceParameters: Record<string, unknown> | undefined;
  Enrichment: string | undefined;
  EnrichmentParameters: Record<string, unknown> | undefined;
  Target: string;
  TargetParameters: Record<string, unknown> | undefined;
  RoleArn: string;
  Filters: StoredFilter[] | undefined;
  CreationTime: number;
  LastModifiedTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const pipeKey = (name: string): string => `${pipePrefix}${name}`;

const pipeArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:pipes:${ctx.region}:${ctx.account}:pipe/${name}`;

const requirePipe = (ctx: ServiceContext, name: string): StoredPipe => {
  const stored = ctx.store.get<StoredPipe>(pipeKey(name));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Pipe ${name} does not exist.`, 404);
  }
  return stored;
};

const pipeTimestamps = (pipe: StoredPipe) => ({
  CreationTime: new Date(pipe.CreationTime).toISOString(),
  LastModifiedTime: new Date(pipe.LastModifiedTime).toISOString(),
});

const pipeView = (
  pipe: StoredPipe,
  tags: Record<string, string>,
): Record<string, unknown> => ({
  Arn: pipe.Arn,
  Name: pipe.Name,
  Description: pipe.Description,
  DesiredState: pipe.DesiredState,
  CurrentState: pipe.CurrentState,
  StateReason: pipe.StateReason,
  Source: pipe.Source,
  SourceParameters: pipe.SourceParameters,
  Enrichment: pipe.Enrichment,
  EnrichmentParameters: pipe.EnrichmentParameters,
  Target: pipe.Target,
  TargetParameters: pipe.TargetParameters,
  RoleArn: pipe.RoleArn,
  Tags: tags,
  ...pipeTimestamps(pipe),
});

const pipeSummary = (pipe: StoredPipe): Record<string, unknown> => ({
  Arn: pipe.Arn,
  Name: pipe.Name,
  DesiredState: pipe.DesiredState,
  CurrentState: pipe.CurrentState,
  ...pipeTimestamps(pipe),
});

const matchesDetailPattern = (value: unknown, pattern: unknown): boolean => {
  if (Array.isArray(pattern)) {
    return pattern.includes(value);
  }
  if (typeof pattern === "object" && pattern !== null) {
    let obj = value;
    if (typeof value === "string") {
      try {
        obj = JSON.parse(value);
      } catch {
        return false;
      }
    }
    if (typeof obj !== "object" || obj === null) return false;
    for (const [k, v] of Object.entries(pattern as Record<string, unknown>)) {
      if (!matchesDetailPattern((obj as Record<string, unknown>)[k], v))
        return false;
    }
    return true;
  }
  return false;
};

const filterMatches = (
  filters: StoredFilter[] | undefined,
  record: Record<string, unknown>,
): boolean => {
  if (filters === undefined || filters.length === 0) return true;
  for (const filter of filters) {
    if (filter.Pattern === undefined) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(filter.Pattern) as Record<string, unknown>;
    } catch {
      continue;
    }
    let ok = true;
    for (const [key, matcher] of Object.entries(parsed)) {
      if (!matchesDetailPattern(record[key], matcher)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
};

const extractFilters = (
  sourceParameters: unknown,
): StoredFilter[] | undefined => {
  if (typeof sourceParameters !== "object" || sourceParameters === null)
    return undefined;
  const sp = sourceParameters as Record<string, unknown>;
  const fc = sp["FilterCriteria"];
  if (typeof fc !== "object" || fc === null) return undefined;
  const rawFilters = (fc as Record<string, unknown>)["Filters"];
  if (!Array.isArray(rawFilters)) return undefined;
  return rawFilters.map((f: unknown) => {
    const fo = f as Record<string, unknown>;
    return { Pattern: stringOrUndefined(fo["Pattern"]) };
  });
};

const transitionState = (pipe: StoredPipe): StoredPipe => {
  if (pipe.CurrentState === "CREATING" && pipe.DesiredState === "RUNNING") {
    return { ...pipe, CurrentState: "RUNNING" };
  }
  if (pipe.CurrentState === "STARTING" && pipe.DesiredState === "RUNNING") {
    return { ...pipe, CurrentState: "RUNNING" };
  }
  if (pipe.CurrentState === "STOPPING" && pipe.DesiredState === "STOPPED") {
    return { ...pipe, CurrentState: "STOPPED" };
  }
  return pipe;
};

const CreatePipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const source = requireString(input, "Source");
  const target = requireString(input, "Target");
  const roleArn = requireString(input, "RoleArn");

  if (ctx.store.get(pipeKey(name)) !== undefined) {
    throw awsError("ConflictException", `Pipe ${name} already exists.`, 409);
  }

  const sourceParameters =
    typeof input["SourceParameters"] === "object" &&
    input["SourceParameters"] !== null
      ? (input["SourceParameters"] as Record<string, unknown>)
      : undefined;

  const now = Date.now();
  const pipe: StoredPipe = {
    Name: name,
    Arn: pipeArn(ctx, name),
    Description: stringOrUndefined(input["Description"]),
    DesiredState: stringOrUndefined(input["DesiredState"]) ?? "RUNNING",
    CurrentState: "CREATING",
    StateReason: undefined,
    Source: source,
    SourceParameters: sourceParameters,
    Enrichment: stringOrUndefined(input["Enrichment"]),
    EnrichmentParameters:
      typeof input["EnrichmentParameters"] === "object" &&
      input["EnrichmentParameters"] !== null
        ? (input["EnrichmentParameters"] as Record<string, unknown>)
        : undefined,
    Target: target,
    TargetParameters:
      typeof input["TargetParameters"] === "object" &&
      input["TargetParameters"] !== null
        ? (input["TargetParameters"] as Record<string, unknown>)
        : undefined,
    RoleArn: roleArn,
    Filters: extractFilters(sourceParameters),
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(pipeKey(name), pipe);

  if (typeof input["Tags"] === "object" && input["Tags"] !== null) {
    ctx.store.set(`tag:${pipe.Arn}`, input["Tags"]);
  }

  return {
    Arn: pipe.Arn,
    Name: pipe.Name,
    DesiredState: pipe.DesiredState,
    CurrentState: pipe.CurrentState,
    ...pipeTimestamps(pipe),
  };
};

const DescribePipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  let pipe = requirePipe(ctx, name);
  const transitioned = transitionState(pipe);
  if (transitioned !== pipe) {
    ctx.store.set(pipeKey(name), transitioned);
    pipe = transitioned;
  }
  const tags = ctx.store.get<Record<string, string>>(`tag:${pipe.Arn}`) ?? {};
  return pipeView(pipe, tags);
};

const UpdatePipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const pipe = requirePipe(ctx, name);
  const now = Date.now();

  const sourceParameters =
    input["SourceParameters"] !== undefined
      ? typeof input["SourceParameters"] === "object" &&
        input["SourceParameters"] !== null
        ? (input["SourceParameters"] as Record<string, unknown>)
        : undefined
      : pipe.SourceParameters;

  const updated: StoredPipe = {
    ...pipe,
    LastModifiedTime: now,
    Description:
      "Description" in input
        ? stringOrUndefined(input["Description"])
        : pipe.Description,
    DesiredState: stringOrUndefined(input["DesiredState"]) ?? pipe.DesiredState,
    Target: stringOrUndefined(input["Target"]) ?? pipe.Target,
    RoleArn: stringOrUndefined(input["RoleArn"]) ?? pipe.RoleArn,
    SourceParameters: sourceParameters,
    Enrichment:
      "Enrichment" in input
        ? stringOrUndefined(input["Enrichment"])
        : pipe.Enrichment,
    EnrichmentParameters:
      input["EnrichmentParameters"] !== undefined
        ? typeof input["EnrichmentParameters"] === "object" &&
          input["EnrichmentParameters"] !== null
          ? (input["EnrichmentParameters"] as Record<string, unknown>)
          : undefined
        : pipe.EnrichmentParameters,
    TargetParameters:
      input["TargetParameters"] !== undefined
        ? typeof input["TargetParameters"] === "object" &&
          input["TargetParameters"] !== null
          ? (input["TargetParameters"] as Record<string, unknown>)
          : undefined
        : pipe.TargetParameters,
    Filters: extractFilters(sourceParameters),
  };
  ctx.store.set(pipeKey(name), updated);
  return {
    Arn: updated.Arn,
    Name: updated.Name,
    DesiredState: updated.DesiredState,
    CurrentState: updated.CurrentState,
    ...pipeTimestamps(updated),
  };
};

const DeletePipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const pipe = requirePipe(ctx, name);
  ctx.store.delete(pipeKey(name));
  ctx.store.delete(`tag:${pipe.Arn}`);
  return {
    Arn: pipe.Arn,
    Name: pipe.Name,
    DesiredState: pipe.DesiredState,
    CurrentState: "DELETING",
    ...pipeTimestamps(pipe),
  };
};

const ListPipes: OperationHandler = (input, ctx) => {
  const namePrefix = stringOrUndefined(input["NamePrefix"]);
  const desiredStateFilter = stringOrUndefined(input["DesiredState"]);
  const currentStateFilter = stringOrUndefined(input["CurrentState"]);
  const sourcePrefix = stringOrUndefined(input["SourcePrefix"]);
  const targetPrefix = stringOrUndefined(input["TargetPrefix"]);
  const limit = typeof input["Limit"] === "number" ? input["Limit"] : 100;
  const nextToken = stringOrUndefined(input["NextToken"]);

  const all = ctx.store
    .list<StoredPipe>()
    .filter((e) => e.key.startsWith(pipePrefix))
    .map((e) => e.value)
    .filter((p) => namePrefix === undefined || p.Name.startsWith(namePrefix))
    .filter(
      (p) =>
        desiredStateFilter === undefined ||
        p.DesiredState === desiredStateFilter,
    )
    .filter(
      (p) =>
        currentStateFilter === undefined ||
        p.CurrentState === currentStateFilter,
    )
    .filter(
      (p) => sourcePrefix === undefined || p.Source.startsWith(sourcePrefix),
    )
    .filter(
      (p) => targetPrefix === undefined || p.Target.startsWith(targetPrefix),
    )
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));

  let startIdx = 0;
  if (nextToken !== undefined) {
    const idx = all.findIndex((p) => p.Name === nextToken);
    if (idx >= 0) startIdx = idx;
  }

  const page = all.slice(startIdx, startIdx + limit);
  const newNextToken =
    startIdx + limit < all.length ? all[startIdx + limit]!.Name : undefined;

  return {
    Pipes: page.map(pipeSummary),
    ...(newNextToken !== undefined ? { NextToken: newNextToken } : {}),
  };
};

const StartPipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const pipe = requirePipe(ctx, name);
  const now = Date.now();
  const updated: StoredPipe = {
    ...pipe,
    DesiredState: "RUNNING",
    CurrentState: "STARTING",
    LastModifiedTime: now,
  };
  ctx.store.set(pipeKey(name), updated);
  return {
    Arn: updated.Arn,
    Name: updated.Name,
    DesiredState: updated.DesiredState,
    CurrentState: updated.CurrentState,
    ...pipeTimestamps(updated),
  };
};

const StopPipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const pipe = requirePipe(ctx, name);
  const now = Date.now();
  const updated: StoredPipe = {
    ...pipe,
    DesiredState: "STOPPED",
    CurrentState: "STOPPING",
    LastModifiedTime: now,
  };
  ctx.store.set(pipeKey(name), updated);
  return {
    Arn: updated.Arn,
    Name: updated.Name,
    DesiredState: updated.DesiredState,
    CurrentState: updated.CurrentState,
    ...pipeTimestamps(updated),
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const newTags =
    typeof input["tags"] === "object" && input["tags"] !== null
      ? (input["tags"] as Record<string, string>)
      : {};
  const existing = ctx.store.get<Record<string, string>>(`tag:${arn}`) ?? {};
  ctx.store.set(`tag:${arn}`, { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const keys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(`tag:${arn}`) ?? {};
  const updated = { ...existing };
  for (const k of keys) delete updated[k];
  ctx.store.set(`tag:${arn}`, updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(`tag:${arn}`) ?? {};
  return { tags };
};

registerEventSource(async (ctx, sourceArn, records) => {
  const pipesStore = ctx.storeFor("pipes");
  let consumed = false;
  for (const { key, value: pipe } of pipesStore.list<StoredPipe>()) {
    if (!key.startsWith(pipePrefix)) continue;
    if (pipe.Source !== sourceArn) continue;
    if (pipe.CurrentState !== "RUNNING") continue;
    for (const record of records) {
      const rec = record as Record<string, unknown>;
      if (!filterMatches(pipe.Filters, rec)) continue;
      const body =
        typeof rec["body"] === "string" ? rec["body"] : JSON.stringify(rec);
      const parsed = parseArn(pipe.Target);
      if (parsed === undefined) continue;
      if (parsed.service === "sqs") {
        await deliverToArn(ctx, pipe.Target, { body, event: rec });
      } else {
        await deliverToArn(ctx, pipe.Target, {
          body,
          event: { Records: records },
        });
      }
      consumed = true;
    }
  }
  return consumed;
});

const pathSegments = (path: string): string[] =>
  path.split("/").filter((p) => p !== "");

const pipes = {
  name: "pipes",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "v1" && parts[1] === "pipes") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListPipes";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribePipe";
        if (req.method === "POST") return "CreatePipe";
        if (req.method === "DELETE") return "DeletePipe";
        if (req.method === "PUT") return "UpdatePipe";
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[3] === "start" && req.method === "POST") return "StartPipe";
        if (parts[3] === "stop" && req.method === "POST") return "StopPipe";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "tags") {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreatePipe,
    DeletePipe,
    DescribePipe,
    ListPipes,
    ListTagsForResource,
    StartPipe,
    StopPipe,
    TagResource,
    UntagResource,
    UpdatePipe,
  },
  model,
} as const satisfies ServiceDefinition;

export default pipes;
