import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/xray.json", { with: { type: "json" } }),
);

type SegmentDoc = {
  trace_id: string;
  id: string;
  name?: string;
  start_time?: number;
  end_time?: number;
  in_progress?: boolean;
  fault?: boolean;
  error?: boolean;
  throttle?: boolean;
  http?: {
    request?: {
      method?: string;
      url?: string;
      user_agent?: string;
      client_ip?: string;
    };
    response?: { status?: number; content_length?: number };
  };
  annotations?: Record<string, string | number | boolean>;
  metadata?: Record<string, unknown>;
  subsegments?: unknown[];
  user?: string;
  origin?: string;
};

type StoredSegment = {
  id: string;
  document: string;
  parsed: SegmentDoc;
};

type StoredTrace = {
  id: string;
  segments: StoredSegment[];
  startTime: number;
  endTime: number;
};

type StoredSamplingRule = {
  RuleName: string;
  RuleARN: string;
  ResourceARN: string;
  Priority: number;
  FixedRate: number;
  ReservoirSize: number;
  ServiceName: string;
  ServiceType: string;
  Host: string;
  HTTPMethod: string;
  URLPath: string;
  Version: number;
  Attributes?: Record<string, string>;
  CreatedAt: number;
  ModifiedAt: number;
  Tags: Record<string, string>;
};

type StoredGroup = {
  GroupName: string;
  GroupARN: string;
  FilterExpression?: string;
  InsightsConfiguration?: {
    InsightsEnabled?: boolean;
    NotificationsEnabled?: boolean;
  };
  Tags: Record<string, string>;
};

type StoredResourcePolicy = {
  PolicyName: string;
  PolicyDocument: string;
  PolicyRevisionId: string;
  LastUpdatedTime: number;
};

type StoredIndexingRule = {
  Name: string;
  ModifiedAt: number;
  Rule: unknown;
};

type StoredRetrieval = {
  RetrievalToken: string;
  Status: string;
  StartTime: number;
  EndTime: number;
  TraceIds: string[];
  NextToken?: string;
};

type StoredEncryptionConfig = {
  KeyId?: string;
  Status: string;
  Type: string;
};

const nowSec = () => Math.floor(Date.now() / 1000);

const makeRuleARN = (ctx: ServiceContext, name: string) =>
  `arn:aws:xray:${ctx.region}:${ctx.account}:sampling-rule/${name}`;

const makeGroupARN = (ctx: ServiceContext, name: string) =>
  `arn:aws:xray:${ctx.region}:${ctx.account}:group/${name}`;

const toSamplingRuleRecord = (r: StoredSamplingRule) => ({
  SamplingRule: {
    RuleName: r.RuleName,
    RuleARN: r.RuleARN,
    ResourceARN: r.ResourceARN,
    Priority: r.Priority,
    FixedRate: r.FixedRate,
    ReservoirSize: r.ReservoirSize,
    ServiceName: r.ServiceName,
    ServiceType: r.ServiceType,
    Host: r.Host,
    HTTPMethod: r.HTTPMethod,
    URLPath: r.URLPath,
    Version: r.Version,
    Attributes: r.Attributes ?? {},
  },
  CreatedAt: r.CreatedAt,
  ModifiedAt: r.ModifiedAt,
});

const toGroupSummary = (g: StoredGroup) => ({
  GroupName: g.GroupName,
  GroupARN: g.GroupARN,
  FilterExpression: g.FilterExpression,
  InsightsConfiguration: g.InsightsConfiguration,
});

const toGroup = (g: StoredGroup) => ({
  GroupName: g.GroupName,
  GroupARN: g.GroupARN,
  FilterExpression: g.FilterExpression,
  InsightsConfiguration: g.InsightsConfiguration,
});

const validateRequired = (input: Record<string, unknown>, fields: string[]) => {
  for (const f of fields) {
    if (input[f] === undefined || input[f] === null) {
      throw awsError("InvalidRequestException", `${f} is required.`, 400);
    }
  }
};

const evalFilterExpr = (expr: string, trace: StoredTrace): boolean => {
  const e = expr.trim();

  const serviceMatch = e.match(/^service\("([^"]+)"\)$/i);
  if (serviceMatch) {
    return trace.segments.some((s) => s.parsed.name === serviceMatch[1]);
  }

  if (/^error$/i.test(e)) return trace.segments.some((s) => s.parsed.error);
  if (/^fault$/i.test(e)) return trace.segments.some((s) => s.parsed.fault);
  if (/^throttle$/i.test(e))
    return trace.segments.some((s) => s.parsed.throttle);

  const annotMatch = e.match(/^annotation\.(\w+)\s*=\s*"([^"]*)"$/i);
  if (annotMatch) {
    return trace.segments.some(
      (s) =>
        String(s.parsed.annotations?.[annotMatch[1]] ?? "") === annotMatch[2],
    );
  }

  const durMatch = e.match(/^(duration|responsetime)\s*([<>]=?)\s*([\d.]+)$/i);
  if (durMatch) {
    const dur = trace.endTime - trace.startTime;
    const val = parseFloat(durMatch[3]);
    switch (durMatch[2]) {
      case ">":
        return dur > val;
      case "<":
        return dur < val;
      case ">=":
        return dur >= val;
      case "<=":
        return dur <= val;
    }
  }

  return true;
};

const ensureDefaultRules = (ctx: ServiceContext) => {
  if (!ctx.store.get("rule/Default")) {
    const now = nowSec();
    const arn = makeRuleARN(ctx, "Default");
    ctx.store.set<StoredSamplingRule>("rule/Default", {
      RuleName: "Default",
      RuleARN: arn,
      ResourceARN: "*",
      Priority: 10000,
      FixedRate: 0.05,
      ReservoirSize: 1,
      ServiceName: "*",
      ServiceType: "*",
      Host: "*",
      HTTPMethod: "*",
      URLPath: "*",
      Version: 1,
      Attributes: {},
      CreatedAt: now,
      ModifiedAt: now,
      Tags: {},
    });
    ctx.store.set<Record<string, string>>(`tags/${arn}`, {});
  }
  if (!ctx.store.get("indexingrule/Default")) {
    ctx.store.set<StoredIndexingRule>("indexingrule/Default", {
      Name: "Default",
      ModifiedAt: nowSec(),
      Rule: { type: "PERMANENT", destination: "CloudWatchLogs" },
    });
  }
};

const listAllTraces = (ctx: ServiceContext) =>
  ctx.store
    .list<StoredTrace>()
    .filter((e) => e.key.startsWith("trace/"))
    .map((e) => e.value);

const listAllRules = (ctx: ServiceContext) =>
  ctx.store
    .list<StoredSamplingRule>()
    .filter((e) => e.key.startsWith("rule/"))
    .map((e) => e.value);

const listAllGroups = (ctx: ServiceContext) =>
  ctx.store
    .list<StoredGroup>()
    .filter((e) => e.key.startsWith("group/"))
    .map((e) => e.value);

const listAllPolicies = (ctx: ServiceContext) =>
  ctx.store
    .list<StoredResourcePolicy>()
    .filter((e) => e.key.startsWith("policy/"))
    .map((e) => e.value);

const listAllIndexingRules = (ctx: ServiceContext) =>
  ctx.store
    .list<StoredIndexingRule>()
    .filter((e) => e.key.startsWith("indexingrule/"))
    .map((e) => e.value);

const PutTraceSegments: OperationHandler = (input, ctx) => {
  const docs = (input.TraceSegmentDocuments ?? []) as string[];
  const unprocessed: { Id: string; ErrorCode: string; Message: string }[] = [];

  for (const doc of docs) {
    let parsed: SegmentDoc;
    try {
      parsed = JSON.parse(doc) as SegmentDoc;
    } catch {
      unprocessed.push({
        Id: "unknown",
        ErrorCode: "InvalidDocument",
        Message: "Failed to parse segment document.",
      });
      continue;
    }

    const traceId = parsed.trace_id;
    if (!traceId || typeof traceId !== "string") {
      unprocessed.push({
        Id: parsed.id ?? "unknown",
        ErrorCode: "InvalidDocument",
        Message: "Missing trace_id.",
      });
      continue;
    }

    const segId = parsed.id ?? "unknown";
    const segment: StoredSegment = { id: segId, document: doc, parsed };
    const key = `trace/${traceId}`;
    const existing = ctx.store.get<StoredTrace>(key);

    if (existing) {
      const segments = [...existing.segments];
      const idx = segments.findIndex((s) => s.id === segId);
      if (idx >= 0) {
        segments[idx] = segment;
      } else {
        segments.push(segment);
      }
      ctx.store.set<StoredTrace>(key, {
        ...existing,
        segments,
        endTime:
          parsed.end_time && parsed.end_time > existing.endTime
            ? parsed.end_time
            : existing.endTime,
        startTime:
          parsed.start_time && parsed.start_time < existing.startTime
            ? parsed.start_time
            : existing.startTime,
      });
    } else {
      ctx.store.set<StoredTrace>(key, {
        id: traceId,
        segments: [segment],
        startTime: parsed.start_time ?? nowSec(),
        endTime: parsed.end_time ?? nowSec(),
      });
    }
  }

  return { UnprocessedTraceSegments: unprocessed };
};

const GetTraceSummaries: OperationHandler = (input, ctx) => {
  validateRequired(input as Record<string, unknown>, ["StartTime", "EndTime"]);
  const startTime = input.StartTime as number | Date;
  const endTime = input.EndTime as number | Date;
  const startSec =
    typeof startTime === "number" ? startTime : startTime.getTime() / 1000;
  const endSec =
    typeof endTime === "number" ? endTime : endTime.getTime() / 1000;
  const filterExpr = input.FilterExpression as string | undefined;

  const allTraces = listAllTraces(ctx);
  const summaries = [];
  for (const trace of allTraces) {
    if (trace.startTime < startSec || trace.startTime > endSec) continue;
    if (filterExpr && !evalFilterExpr(filterExpr, trace)) continue;

    const hasFault = trace.segments.some((s) => s.parsed.fault);
    const hasError = trace.segments.some((s) => s.parsed.error);
    const hasThrottle = trace.segments.some((s) => s.parsed.throttle);
    const duration = trace.endTime - trace.startTime;

    summaries.push({
      Id: trace.id,
      Duration: duration,
      ResponseTime: duration,
      HasFault: hasFault,
      HasError: hasError,
      HasThrottle: hasThrottle,
      IsPartial: trace.segments.some((s) => s.parsed.in_progress),
    });
  }

  return {
    TraceSummaries: summaries,
    ApproximateTime: startSec,
    TracesProcessedCount: allTraces.length,
    NextToken: undefined,
  };
};

const BatchGetTraces: OperationHandler = (input, ctx) => {
  const ids = (input.TraceIds ?? []) as string[];
  if (ids.length > 5) {
    throw awsError(
      "InvalidRequestException",
      "Cannot retrieve more than 5 trace IDs at a time.",
      400,
    );
  }
  const found = [];
  const unprocessed = [];

  for (const id of ids) {
    const trace = ctx.store.get<StoredTrace>(`trace/${id}`);
    if (trace) {
      found.push({
        Id: trace.id,
        Duration: trace.endTime - trace.startTime,
        Segments: trace.segments.map((s) => ({
          Id: s.id,
          Document: s.document,
        })),
      });
    } else {
      unprocessed.push(id);
    }
  }

  return {
    Traces: found,
    UnprocessedTraceIds: unprocessed,
    NextToken: undefined,
  };
};

const GetTraceGraph: OperationHandler = (input, ctx) => {
  const ids = (input.TraceIds ?? []) as string[];
  const serviceMap = new Map<string, { name: string; type: string }>();

  for (const id of ids) {
    const trace = ctx.store.get<StoredTrace>(`trace/${id}`);
    if (!trace) continue;
    for (const seg of trace.segments) {
      const name = seg.parsed.name ?? "unknown";
      const origin = seg.parsed.origin ?? "AWS::Lambda::Function";
      serviceMap.set(name, { name, type: origin });
    }
  }

  return {
    Services: Array.from(serviceMap.values()).map((s, i) => ({
      ReferenceId: i,
      Name: s.name,
      Type: s.type,
    })),
    NextToken: undefined,
  };
};

const GetServiceGraph: OperationHandler = (input, ctx) => {
  validateRequired(input as Record<string, unknown>, ["StartTime", "EndTime"]);
  const startTime = input.StartTime as number | Date;
  const endTime = input.EndTime as number | Date;
  const startSec =
    typeof startTime === "number" ? startTime : startTime.getTime() / 1000;
  const endSec =
    typeof endTime === "number" ? endTime : endTime.getTime() / 1000;

  const serviceMap = new Map<
    string,
    {
      name: string;
      type: string;
      faultCount: number;
      errorCount: number;
      throttleCount: number;
      totalCount: number;
    }
  >();
  const edgeMap = new Map<string, { src: string; dst: string }>();

  for (const trace of listAllTraces(ctx)) {
    if (trace.startTime < startSec || trace.startTime > endSec) continue;
    for (const seg of trace.segments) {
      const name = seg.parsed.name ?? "unknown";
      const origin = seg.parsed.origin ?? "AWS::Lambda::Function";
      const existing = serviceMap.get(name) ?? {
        name,
        type: origin,
        faultCount: 0,
        errorCount: 0,
        throttleCount: 0,
        totalCount: 0,
      };
      existing.totalCount++;
      if (seg.parsed.fault) existing.faultCount++;
      if (seg.parsed.error) existing.errorCount++;
      if (seg.parsed.throttle) existing.throttleCount++;
      serviceMap.set(name, existing);
    }
    for (let i = 1; i < trace.segments.length; i++) {
      const src = trace.segments[0].parsed.name ?? "unknown";
      const dst = trace.segments[i].parsed.name ?? "unknown";
      edgeMap.set(`${src}->${dst}`, { src, dst });
    }
  }

  const serviceList = Array.from(serviceMap.values());
  const nameToRef = new Map(serviceList.map((s, i) => [s.name, i]));

  return {
    Services: serviceList.map((s, i) => ({
      ReferenceId: i,
      Name: s.name,
      Type: s.type,
      SummaryStatistics: {
        OkCount: s.totalCount - s.faultCount - s.errorCount - s.throttleCount,
        ErrorStatistics: {
          ThrottleCount: s.throttleCount,
          OtherCount: s.errorCount,
          TotalCount: s.errorCount + s.throttleCount,
        },
        FaultStatistics: { OtherCount: s.faultCount, TotalCount: s.faultCount },
        TotalCount: s.totalCount,
      },
      Edges: Array.from(edgeMap.values())
        .filter((e) => e.src === s.name)
        .map((e) => ({
          ReferenceId: nameToRef.get(e.dst) ?? 0,
          SummaryStatistics: {
            OkCount: 0,
            ErrorStatistics: {
              ThrottleCount: 0,
              OtherCount: 0,
              TotalCount: 0,
            },
            FaultStatistics: { OtherCount: 0, TotalCount: 0 },
            TotalCount: 0,
          },
        })),
    })),
    StartTime: input.StartTime,
    EndTime: input.EndTime,
    ContainsOldGroupVersions: false,
    NextToken: undefined,
  };
};

const PutTelemetryRecords: OperationHandler = (_input, _ctx) => ({});

const CreateSamplingRule: OperationHandler = (input, ctx) => {
  ensureDefaultRules(ctx);

  const rule = input.SamplingRule as Record<string, unknown>;
  if (!rule)
    throw awsError("InvalidRequestException", "SamplingRule is required.", 400);

  validateRequired(rule, [
    "RuleName",
    "ResourceARN",
    "Priority",
    "FixedRate",
    "ReservoirSize",
    "ServiceName",
    "ServiceType",
    "Host",
    "HTTPMethod",
    "URLPath",
    "Version",
  ]);

  const name = rule.RuleName as string;

  if (ctx.store.get(`rule/${name}`)) {
    throw awsError(
      "InvalidRequestException",
      `Rule ${name} already exists.`,
      400,
    );
  }

  const allRules = listAllRules(ctx);
  if (allRules.length >= 25) {
    throw awsError(
      "RuleLimitExceededException",
      "Sampling rule limit exceeded (max 25).",
      400,
    );
  }

  const now = nowSec();
  const stored: StoredSamplingRule = {
    RuleName: name,
    RuleARN: makeRuleARN(ctx, name),
    ResourceARN: rule.ResourceARN as string,
    Priority: rule.Priority as number,
    FixedRate: rule.FixedRate as number,
    ReservoirSize: rule.ReservoirSize as number,
    ServiceName: rule.ServiceName as string,
    ServiceType: rule.ServiceType as string,
    Host: rule.Host as string,
    HTTPMethod: rule.HTTPMethod as string,
    URLPath: rule.URLPath as string,
    Version: rule.Version as number,
    Attributes: (rule.Attributes as Record<string, string>) ?? {},
    CreatedAt: now,
    ModifiedAt: now,
    Tags: {},
  };

  const inputTags = (input.Tags ?? []) as { Key: string; Value: string }[];
  for (const t of inputTags) stored.Tags[t.Key] = t.Value;

  ctx.store.set(`rule/${name}`, stored);
  ctx.store.set<Record<string, string>>(`tags/${stored.RuleARN}`, {
    ...stored.Tags,
  });

  return { SamplingRuleRecord: toSamplingRuleRecord(stored) };
};

const GetSamplingRules: OperationHandler = (input, ctx) => {
  ensureDefaultRules(ctx);
  const all = listAllRules(ctx);
  const nextTokenIn = input.NextToken as string | undefined;
  let start = 0;
  if (nextTokenIn) {
    const idx = all.findIndex((r) => r.RuleName === nextTokenIn);
    if (idx >= 0) start = idx;
  }
  const page = all.slice(start, start + 100);
  const nextToken =
    all.length > start + 100 ? all[start + 100].RuleName : undefined;

  return {
    SamplingRuleRecords: page.map(toSamplingRuleRecord),
    NextToken: nextToken,
  };
};

const UpdateSamplingRule: OperationHandler = (input, ctx) => {
  const update = input.SamplingRuleUpdate as Record<string, unknown>;
  if (!update)
    throw awsError(
      "InvalidRequestException",
      "SamplingRuleUpdate is required.",
      400,
    );

  const name = update.RuleName as string | undefined;
  const arn = update.RuleARN as string | undefined;

  let stored: StoredSamplingRule | undefined;
  let storeKey: string | undefined;

  if (name) {
    stored = ctx.store.get<StoredSamplingRule>(`rule/${name}`);
    storeKey = `rule/${name}`;
  }
  if (!stored && arn) {
    for (const r of listAllRules(ctx)) {
      if (r.RuleARN === arn) {
        stored = r;
        storeKey = `rule/${r.RuleName}`;
        break;
      }
    }
  }

  if (!stored || !storeKey) {
    throw awsError("InvalidRequestException", "Sampling rule not found.", 400);
  }

  const updated: StoredSamplingRule = { ...stored };
  if (update.ResourceARN !== undefined)
    updated.ResourceARN = update.ResourceARN as string;
  if (update.Priority !== undefined)
    updated.Priority = update.Priority as number;
  if (update.FixedRate !== undefined)
    updated.FixedRate = update.FixedRate as number;
  if (update.ReservoirSize !== undefined)
    updated.ReservoirSize = update.ReservoirSize as number;
  if (update.ServiceName !== undefined)
    updated.ServiceName = update.ServiceName as string;
  if (update.ServiceType !== undefined)
    updated.ServiceType = update.ServiceType as string;
  if (update.Host !== undefined) updated.Host = update.Host as string;
  if (update.HTTPMethod !== undefined)
    updated.HTTPMethod = update.HTTPMethod as string;
  if (update.URLPath !== undefined) updated.URLPath = update.URLPath as string;
  if (update.Attributes !== undefined)
    updated.Attributes = update.Attributes as Record<string, string>;
  updated.ModifiedAt = nowSec();

  ctx.store.set(storeKey, updated);

  return { SamplingRuleRecord: toSamplingRuleRecord(updated) };
};

const DeleteSamplingRule: OperationHandler = (input, ctx) => {
  const name = input.RuleName as string | undefined;
  const arn = input.RuleARN as string | undefined;

  let stored: StoredSamplingRule | undefined;
  let storeKey: string | undefined;

  if (name) {
    stored = ctx.store.get<StoredSamplingRule>(`rule/${name}`);
    storeKey = `rule/${name}`;
  }
  if (!stored && arn) {
    for (const r of listAllRules(ctx)) {
      if (r.RuleARN === arn) {
        stored = r;
        storeKey = `rule/${r.RuleName}`;
        break;
      }
    }
  }

  if (!stored || !storeKey) {
    throw awsError("InvalidRequestException", "Sampling rule not found.", 400);
  }

  if (stored.RuleName === "Default") {
    throw awsError(
      "InvalidRequestException",
      "Cannot delete the Default sampling rule.",
      400,
    );
  }

  ctx.store.delete(storeKey);
  ctx.store.delete(`tags/${stored.RuleARN}`);

  return { SamplingRuleRecord: toSamplingRuleRecord(stored) };
};

const GetSamplingTargets: OperationHandler = (input, ctx) => {
  const docs = (input.SamplingStatisticsDocuments ?? []) as Record<
    string,
    unknown
  >[];
  const targets = docs.map((doc) => {
    const ruleName = doc.RuleName as string;
    const rule = ctx.store.get<StoredSamplingRule>(`rule/${ruleName}`);
    return {
      RuleName: ruleName,
      FixedRate: rule?.FixedRate ?? 0.05,
      ReservoirQuota: rule?.ReservoirSize ?? 1,
      ReservoirQuotaTTL: nowSec() + 10,
      Interval: 10,
    };
  });

  return {
    SamplingTargetDocuments: targets,
    LastRuleModification: nowSec(),
    UnprocessedStatistics: [],
    UnprocessedBoostStatistics: [],
  };
};

const GetSamplingStatisticSummaries: OperationHandler = (_input, _ctx) => ({
  SamplingStatisticSummaries: [],
  NextToken: undefined,
});

const CreateGroup: OperationHandler = (input, ctx) => {
  const name = input.GroupName as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "GroupName is required.", 400);
  if (ctx.store.get(`group/${name}`))
    throw awsError(
      "InvalidRequestException",
      `Group ${name} already exists.`,
      400,
    );

  const arn = makeGroupARN(ctx, name);
  const stored: StoredGroup = {
    GroupName: name,
    GroupARN: arn,
    FilterExpression: input.FilterExpression as string | undefined,
    InsightsConfiguration:
      input.InsightsConfiguration as StoredGroup["InsightsConfiguration"],
    Tags: {},
  };

  const inputTags = (input.Tags ?? []) as { Key: string; Value: string }[];
  for (const t of inputTags) stored.Tags[t.Key] = t.Value;

  ctx.store.set(`group/${name}`, stored);
  ctx.store.set<Record<string, string>>(`tags/${arn}`, { ...stored.Tags });

  return { Group: toGroup(stored) };
};

const GetGroup: OperationHandler = (input, ctx) => {
  const name = input.GroupName as string | undefined;
  const arn = input.GroupARN as string | undefined;

  let stored: StoredGroup | undefined;
  if (name) stored = ctx.store.get<StoredGroup>(`group/${name}`);
  if (!stored && arn) {
    stored = listAllGroups(ctx).find((g) => g.GroupARN === arn);
  }

  if (!stored) {
    throw awsError("InvalidRequestException", "Group not found.", 400);
  }

  return { Group: toGroup(stored) };
};

const GetGroups: OperationHandler = (input, ctx) => {
  const all = listAllGroups(ctx);
  const nextTokenIn = input.NextToken as string | undefined;
  let start = 0;
  if (nextTokenIn) {
    const idx = all.findIndex((g) => g.GroupName === nextTokenIn);
    if (idx >= 0) start = idx;
  }
  const page = all.slice(start, start + 100);
  const nextToken =
    all.length > start + 100 ? all[start + 100].GroupName : undefined;

  return {
    Groups: page.map(toGroupSummary),
    NextToken: nextToken,
  };
};

const UpdateGroup: OperationHandler = (input, ctx) => {
  const name = input.GroupName as string | undefined;
  const arn = input.GroupARN as string | undefined;

  let stored: StoredGroup | undefined;
  let storeKey: string | undefined;
  if (name) {
    stored = ctx.store.get<StoredGroup>(`group/${name}`);
    storeKey = `group/${name}`;
  }
  if (!stored && arn) {
    for (const g of listAllGroups(ctx)) {
      if (g.GroupARN === arn) {
        stored = g;
        storeKey = `group/${g.GroupName}`;
        break;
      }
    }
  }

  if (!stored || !storeKey) {
    throw awsError("InvalidRequestException", "Group not found.", 400);
  }

  const updated: StoredGroup = { ...stored };
  if (input.FilterExpression !== undefined)
    updated.FilterExpression = input.FilterExpression as string;
  if (input.InsightsConfiguration !== undefined)
    updated.InsightsConfiguration =
      input.InsightsConfiguration as StoredGroup["InsightsConfiguration"];

  ctx.store.set(storeKey, updated);

  return { Group: toGroup(updated) };
};

const DeleteGroup: OperationHandler = (input, ctx) => {
  const name = input.GroupName as string | undefined;
  const arn = input.GroupARN as string | undefined;

  let storeKey: string | undefined;
  let stored: StoredGroup | undefined;

  if (name) {
    stored = ctx.store.get<StoredGroup>(`group/${name}`);
    storeKey = `group/${name}`;
  }
  if (!stored && arn) {
    for (const g of listAllGroups(ctx)) {
      if (g.GroupARN === arn) {
        stored = g;
        storeKey = `group/${g.GroupName}`;
        break;
      }
    }
  }

  if (!stored || !storeKey) {
    throw awsError("InvalidRequestException", "Group not found.", 400);
  }

  ctx.store.delete(storeKey);
  ctx.store.delete(`tags/${stored.GroupARN}`);

  return {};
};

const getEncryptionConfig = (ctx: ServiceContext): StoredEncryptionConfig =>
  ctx.store.get<StoredEncryptionConfig>("encryptionconfig") ?? {
    Status: "ACTIVE",
    Type: "NONE",
  };

const GetEncryptionConfig: OperationHandler = (_input, ctx) => {
  const cfg = getEncryptionConfig(ctx);
  return {
    EncryptionConfig: {
      KeyId: cfg.KeyId,
      Status: cfg.Status,
      Type: cfg.Type,
    },
  };
};

const PutEncryptionConfig: OperationHandler = (input, ctx) => {
  const type = input.Type as string | undefined;
  if (!type)
    throw awsError("InvalidRequestException", "Type is required.", 400);

  ctx.store.set<StoredEncryptionConfig>("encryptionconfig", {
    KeyId: input.KeyId as string | undefined,
    Status: "ACTIVE",
    Type: type,
  });

  return {
    EncryptionConfig: {
      KeyId: input.KeyId,
      Status: "ACTIVE",
      Type: type,
    },
  };
};

const getTagsForArn = (ctx: ServiceContext, arn: string) =>
  ctx.store.get<Record<string, string>>(`tags/${arn}`) ?? {};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input.ResourceARN as string | undefined;
  if (!arn)
    throw awsError("InvalidRequestException", "ResourceARN is required.", 400);

  const isGroup = listAllGroups(ctx).some((g) => g.GroupARN === arn);
  const isRule = listAllRules(ctx).some((r) => r.RuleARN === arn);

  if (!isGroup && !isRule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }

  const resourceTags = getTagsForArn(ctx, arn);
  return {
    Tags: Object.entries(resourceTags).map(([Key, Value]) => ({ Key, Value })),
    NextToken: undefined,
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input.ResourceARN as string | undefined;
  if (!arn)
    throw awsError("InvalidRequestException", "ResourceARN is required.", 400);

  const isGroup = listAllGroups(ctx).some((g) => g.GroupARN === arn);
  const isRule = listAllRules(ctx).some((r) => r.RuleARN === arn);

  if (!isGroup && !isRule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }

  const inputTags = (input.Tags ?? []) as { Key: string; Value: string }[];
  const existing = getTagsForArn(ctx, arn);
  if (Object.keys(existing).length + inputTags.length > 50) {
    throw awsError("TooManyTagsException", "Too many tags.", 400);
  }

  const updated = { ...existing };
  for (const t of inputTags) updated[t.Key] = t.Value;
  ctx.store.set(`tags/${arn}`, updated);

  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = input.ResourceARN as string | undefined;
  if (!arn)
    throw awsError("InvalidRequestException", "ResourceARN is required.", 400);

  const isGroup = listAllGroups(ctx).some((g) => g.GroupARN === arn);
  const isRule = listAllRules(ctx).some((r) => r.RuleARN === arn);

  if (!isGroup && !isRule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }

  const tagKeys = (input.TagKeys ?? []) as string[];
  const existing = getTagsForArn(ctx, arn);
  const updated = { ...existing };
  for (const k of tagKeys) delete updated[k];
  ctx.store.set(`tags/${arn}`, updated);

  return {};
};

const GetInsight: OperationHandler = (_input, _ctx) => ({ Insight: undefined });

const GetInsightEvents: OperationHandler = (_input, _ctx) => ({
  InsightEvents: [],
  NextToken: undefined,
});

const GetInsightImpactGraph: OperationHandler = (input, _ctx) => ({
  InsightId: input.InsightId,
  StartTime: input.StartTime,
  EndTime: input.EndTime,
  ServiceGraphStartTime: input.StartTime,
  ServiceGraphEndTime: input.EndTime,
  Services: [],
  NextToken: undefined,
});

const GetInsightSummaries: OperationHandler = (_input, _ctx) => ({
  InsightSummaries: [],
  NextToken: undefined,
});

const GetTimeSeriesServiceStatistics: OperationHandler = (_input, _ctx) => ({
  TimeSeriesServiceStatistics: [],
  ContainsOldGroupVersions: false,
  NextToken: undefined,
});

const GetIndexingRules: OperationHandler = (input, ctx) => {
  ensureDefaultRules(ctx);
  const all = listAllIndexingRules(ctx);
  const nextTokenIn = input.NextToken as string | undefined;
  let start = 0;
  if (nextTokenIn) {
    const idx = all.findIndex((r) => r.Name === nextTokenIn);
    if (idx >= 0) start = idx;
  }
  const page = all.slice(start, start + 100);
  const nextToken =
    all.length > start + 100 ? all[start + 100].Name : undefined;

  return {
    IndexingRules: page.map((r) => ({
      Name: r.Name,
      ModifiedAt: r.ModifiedAt,
      Rule: r.Rule,
    })),
    NextToken: nextToken,
  };
};

const UpdateIndexingRule: OperationHandler = (input, ctx) => {
  const name = input.Name as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "Name is required.", 400);

  const existing = ctx.store.get<StoredIndexingRule>(`indexingrule/${name}`);
  if (!existing) {
    throw awsError(
      "ResourceNotFoundException",
      `Indexing rule ${name} not found.`,
      404,
    );
  }

  const updated: StoredIndexingRule = {
    Name: name,
    ModifiedAt: nowSec(),
    Rule: input.Rule ?? existing.Rule,
  };
  ctx.store.set(`indexingrule/${name}`, updated);

  return {
    IndexingRule: {
      Name: updated.Name,
      ModifiedAt: updated.ModifiedAt,
      Rule: updated.Rule,
    },
  };
};

const ListResourcePolicies: OperationHandler = (input, ctx) => {
  const all = listAllPolicies(ctx);
  const nextTokenIn = input.NextToken as string | undefined;
  let start = 0;
  if (nextTokenIn) {
    const idx = all.findIndex((p) => p.PolicyName === nextTokenIn);
    if (idx >= 0) start = idx;
  }
  const page = all.slice(start, start + 100);
  const nextToken =
    all.length > start + 100 ? all[start + 100].PolicyName : undefined;

  return {
    ResourcePolicies: page.map((p) => ({
      PolicyName: p.PolicyName,
      PolicyDocument: p.PolicyDocument,
      PolicyRevisionId: p.PolicyRevisionId,
      LastUpdatedTime: p.LastUpdatedTime,
    })),
    NextToken: nextToken,
  };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const name = input.PolicyName as string | undefined;
  const doc = input.PolicyDocument as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "PolicyName is required.", 400);
  if (!doc)
    throw awsError(
      "InvalidRequestException",
      "PolicyDocument is required.",
      400,
    );

  const existing = ctx.store.get<StoredResourcePolicy>(`policy/${name}`);
  const incomingRevisionId = input.PolicyRevisionId as string | undefined;
  if (
    existing &&
    incomingRevisionId &&
    incomingRevisionId !== existing.PolicyRevisionId
  ) {
    throw awsError(
      "InvalidPolicyRevisionIdException",
      "The specified policy revision ID does not match the current revision.",
      400,
    );
  }

  const revisionId = `rev-${Date.now()}`;
  const stored: StoredResourcePolicy = {
    PolicyName: name,
    PolicyDocument: doc,
    PolicyRevisionId: revisionId,
    LastUpdatedTime: nowSec(),
  };
  ctx.store.set(`policy/${name}`, stored);

  return {
    ResourcePolicy: {
      PolicyName: stored.PolicyName,
      PolicyDocument: stored.PolicyDocument,
      PolicyRevisionId: stored.PolicyRevisionId,
      LastUpdatedTime: stored.LastUpdatedTime,
    },
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const name = input.PolicyName as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "PolicyName is required.", 400);

  if (!ctx.store.get(`policy/${name}`)) {
    throw awsError("InvalidRequestException", `Policy ${name} not found.`, 400);
  }

  ctx.store.delete(`policy/${name}`);
  return {};
};

const GetTraceSegmentDestination: OperationHandler = (_input, _ctx) => ({
  Destination: "XRay",
  Status: "ACTIVE",
});

const UpdateTraceSegmentDestination: OperationHandler = (input, _ctx) => ({
  Destination: input.Destination ?? "XRay",
  Status: "ACTIVE",
});

const StartTraceRetrieval: OperationHandler = (input, ctx) => {
  const traceIds = (input.TraceIds ?? []) as string[];
  if (!traceIds.length)
    throw awsError("InvalidRequestException", "TraceIds is required.", 400);
  validateRequired(input as Record<string, unknown>, ["StartTime", "EndTime"]);

  const token = `retrieval-${Date.now()}`;
  ctx.store.set<StoredRetrieval>(`retrieval/${token}`, {
    RetrievalToken: token,
    Status: "SCHEDULED",
    StartTime: (input.StartTime as number) ?? nowSec(),
    EndTime: (input.EndTime as number) ?? nowSec(),
    TraceIds: traceIds,
  });

  return { RetrievalToken: token };
};

const CancelTraceRetrieval: OperationHandler = (input, ctx) => {
  const token = input.RetrievalToken as string | undefined;
  if (!token)
    throw awsError(
      "InvalidRequestException",
      "RetrievalToken is required.",
      400,
    );

  const retrieval = ctx.store.get<StoredRetrieval>(`retrieval/${token}`);
  if (!retrieval) {
    throw awsError(
      "ResourceNotFoundException",
      `Retrieval ${token} not found.`,
      404,
    );
  }

  ctx.store.set<StoredRetrieval>(`retrieval/${token}`, {
    ...retrieval,
    Status: "CANCELLED",
  });

  return {};
};

const ListRetrievedTraces: OperationHandler = (input, ctx) => {
  const token = input.RetrievalToken as string | undefined;
  if (!token)
    throw awsError(
      "InvalidRequestException",
      "RetrievalToken is required.",
      400,
    );

  const retrieval = ctx.store.get<StoredRetrieval>(`retrieval/${token}`);
  if (!retrieval) {
    throw awsError(
      "ResourceNotFoundException",
      `Retrieval ${token} not found.`,
      404,
    );
  }

  if (retrieval.Status === "CANCELLED") {
    return {
      RetrievalStatus: "CANCELLED",
      Traces: [],
      NextToken: undefined,
    };
  }

  const traceList = retrieval.TraceIds.map((id) => {
    const trace = ctx.store.get<StoredTrace>(`trace/${id}`);
    if (!trace) return { Id: id, Duration: 0, Segments: [] };
    return {
      Id: trace.id,
      Duration: trace.endTime - trace.startTime,
      Segments: trace.segments.map((s) => ({ Id: s.id, Document: s.document })),
    };
  });

  return {
    RetrievalStatus: "COMPLETE",
    Traces: traceList,
    NextToken: undefined,
  };
};

const GetRetrievedTracesGraph: OperationHandler = (input, ctx) => {
  const token = input.RetrievalToken as string | undefined;
  if (!token)
    throw awsError(
      "InvalidRequestException",
      "RetrievalToken is required.",
      400,
    );

  if (!ctx.store.get(`retrieval/${token}`)) {
    throw awsError(
      "ResourceNotFoundException",
      `Retrieval ${token} not found.`,
      404,
    );
  }

  return {
    RetrievalStatus: "COMPLETE",
    Services: [],
    NextToken: undefined,
  };
};

const PATH_TO_OP: Record<string, string> = {
  TraceSegments: "PutTraceSegments",
  TraceSummaries: "GetTraceSummaries",
  Traces: "BatchGetTraces",
  TraceGraph: "GetTraceGraph",
  ServiceGraph: "GetServiceGraph",
  TelemetryRecords: "PutTelemetryRecords",
  SamplingTargets: "GetSamplingTargets",
  SamplingStatisticSummaries: "GetSamplingStatisticSummaries",
  Groups: "GetGroups",
  EncryptionConfig: "GetEncryptionConfig",
  Insight: "GetInsight",
  InsightEvents: "GetInsightEvents",
  InsightImpactGraph: "GetInsightImpactGraph",
  InsightSummaries: "GetInsightSummaries",
  TimeSeriesServiceStatistics: "GetTimeSeriesServiceStatistics",
};

const xray = {
  name: "xray",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/^\//, "");
    return PATH_TO_OP[path] ?? path;
  },
  operations: {
    PutTraceSegments,
    GetTraceSummaries,
    BatchGetTraces,
    GetTraceGraph,
    GetServiceGraph,
    PutTelemetryRecords,
    CreateSamplingRule,
    GetSamplingRules,
    UpdateSamplingRule,
    DeleteSamplingRule,
    GetSamplingTargets,
    GetSamplingStatisticSummaries,
    CreateGroup,
    GetGroup,
    GetGroups,
    UpdateGroup,
    DeleteGroup,
    GetEncryptionConfig,
    PutEncryptionConfig,
    ListTagsForResource,
    TagResource,
    UntagResource,
    GetInsight,
    GetInsightEvents,
    GetInsightImpactGraph,
    GetInsightSummaries,
    GetTimeSeriesServiceStatistics,
    GetIndexingRules,
    UpdateIndexingRule,
    ListResourcePolicies,
    PutResourcePolicy,
    DeleteResourcePolicy,
    GetTraceSegmentDestination,
    UpdateTraceSegmentDestination,
    StartTraceRetrieval,
    CancelTraceRetrieval,
    ListRetrievedTraces,
    GetRetrievedTracesGraph,
  },
  model,
} as const satisfies ServiceDefinition;

export default xray;
