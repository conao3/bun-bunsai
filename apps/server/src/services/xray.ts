import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import xrayModel from "../../../../test/vendor/aws-models/xray.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(xrayModel);

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

const traces = new Map<string, StoredTrace>();
const samplingRules = new Map<string, StoredSamplingRule>();
const groups = new Map<string, StoredGroup>();
const tags = new Map<string, Record<string, string>>();
const resourcePolicies = new Map<string, StoredResourcePolicy>();
const indexingRules = new Map<string, StoredIndexingRule>();
const retrievals = new Map<string, StoredRetrieval>();

let encryptionConfig: StoredEncryptionConfig = {
  Status: "ACTIVE",
  Type: "NONE",
};

const ACCOUNT_ID = "123456789012";
const REGION = "us-east-1";

const makeRuleARN = (name: string) =>
  `arn:aws:xray:${REGION}:${ACCOUNT_ID}:sampling-rule/${name}`;

const makeGroupARN = (name: string) =>
  `arn:aws:xray:${REGION}:${ACCOUNT_ID}:group/${name}`;

const nowSec = () => Math.floor(Date.now() / 1000);

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

const PutTraceSegments: OperationHandler = (input, _ctx) => {
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

    if (traces.has(traceId)) {
      const t = traces.get(traceId)!;
      const existing = t.segments.findIndex((s) => s.id === segId);
      if (existing >= 0) {
        t.segments[existing] = segment;
      } else {
        t.segments.push(segment);
      }
      if (parsed.end_time && parsed.end_time > t.endTime)
        t.endTime = parsed.end_time;
      if (parsed.start_time && parsed.start_time < t.startTime)
        t.startTime = parsed.start_time;
    } else {
      traces.set(traceId, {
        id: traceId,
        segments: [segment],
        startTime: parsed.start_time ?? nowSec(),
        endTime: parsed.end_time ?? nowSec(),
      });
    }
  }

  return { UnprocessedTraceSegments: unprocessed };
};

const GetTraceSummaries: OperationHandler = (input, _ctx) => {
  validateRequired(input as Record<string, unknown>, ["StartTime", "EndTime"]);
  const startTime = input.StartTime as number | Date;
  const endTime = input.EndTime as number | Date;
  const startSec =
    typeof startTime === "number" ? startTime : startTime.getTime() / 1000;
  const endSec =
    typeof endTime === "number" ? endTime : endTime.getTime() / 1000;
  const filterExpr = input.FilterExpression as string | undefined;

  const summaries = [];
  for (const trace of traces.values()) {
    if (trace.startTime < startSec || trace.startTime > endSec) continue;

    const rootSeg = trace.segments[0]?.parsed;
    if (filterExpr) {
      const lower = filterExpr.toLowerCase();
      const name = rootSeg?.name?.toLowerCase() ?? "";
      if (
        !name.startsWith(lower.replace(/^service\(/, "").replace(/\)$/, ""))
      ) {
        if (!lower.includes(name) && !name.includes(lower)) continue;
      }
    }

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
    TracesProcessedCount: traces.size,
    NextToken: undefined,
  };
};

const BatchGetTraces: OperationHandler = (input, _ctx) => {
  const ids = (input.TraceIds ?? []) as string[];
  const found = [];
  const unprocessed = [];

  for (const id of ids) {
    const trace = traces.get(id);
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

const GetTraceGraph: OperationHandler = (input, _ctx) => {
  const ids = (input.TraceIds ?? []) as string[];
  const serviceMap = new Map<string, { name: string; type: string }>();

  for (const id of ids) {
    const trace = traces.get(id);
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

const GetServiceGraph: OperationHandler = (input, _ctx) => {
  validateRequired(input as Record<string, unknown>, ["StartTime", "EndTime"]);
  return {
    Services: [],
    StartTime: input.StartTime,
    EndTime: input.EndTime,
    ContainsOldGroupVersions: false,
    NextToken: undefined,
  };
};

const PutTelemetryRecords: OperationHandler = (_input, _ctx) => ({});

const CreateSamplingRule: OperationHandler = (input, _ctx) => {
  const rule = input.SamplingRule as Record<string, unknown>;
  if (!rule)
    throw awsError("InvalidRequestException", "SamplingRule is required.", 400);

  const name = (rule.RuleName as string) ?? `rule-${Date.now()}`;
  if (samplingRules.has(name)) {
    throw awsError(
      "RuleLimitExceededException",
      `Rule ${name} already exists.`,
      400,
    );
  }

  const now = nowSec();
  const stored: StoredSamplingRule = {
    RuleName: name,
    RuleARN: makeRuleARN(name),
    ResourceARN: (rule.ResourceARN as string) ?? "*",
    Priority: (rule.Priority as number) ?? 1000,
    FixedRate: (rule.FixedRate as number) ?? 0.05,
    ReservoirSize: (rule.ReservoirSize as number) ?? 1,
    ServiceName: (rule.ServiceName as string) ?? "*",
    ServiceType: (rule.ServiceType as string) ?? "*",
    Host: (rule.Host as string) ?? "*",
    HTTPMethod: (rule.HTTPMethod as string) ?? "*",
    URLPath: (rule.URLPath as string) ?? "*",
    Version: (rule.Version as number) ?? 1,
    Attributes: (rule.Attributes as Record<string, string>) ?? {},
    CreatedAt: now,
    ModifiedAt: now,
    Tags: {},
  };

  const inputTags = (input.Tags ?? []) as { Key: string; Value: string }[];
  for (const t of inputTags) stored.Tags[t.Key] = t.Value;

  samplingRules.set(name, stored);
  tags.set(stored.RuleARN, { ...stored.Tags });

  return { SamplingRuleRecord: toSamplingRuleRecord(stored) };
};

const GetSamplingRules: OperationHandler = (_input, _ctx) => {
  return {
    SamplingRuleRecords: Array.from(samplingRules.values()).map(
      toSamplingRuleRecord,
    ),
    NextToken: undefined,
  };
};

const UpdateSamplingRule: OperationHandler = (input, _ctx) => {
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
  if (name) stored = samplingRules.get(name);
  if (!stored && arn) {
    stored = Array.from(samplingRules.values()).find((r) => r.RuleARN === arn);
  }

  if (!stored) {
    throw awsError("InvalidRequestException", "Sampling rule not found.", 400);
  }

  if (update.ResourceARN !== undefined)
    stored.ResourceARN = update.ResourceARN as string;
  if (update.Priority !== undefined)
    stored.Priority = update.Priority as number;
  if (update.FixedRate !== undefined)
    stored.FixedRate = update.FixedRate as number;
  if (update.ReservoirSize !== undefined)
    stored.ReservoirSize = update.ReservoirSize as number;
  if (update.ServiceName !== undefined)
    stored.ServiceName = update.ServiceName as string;
  if (update.ServiceType !== undefined)
    stored.ServiceType = update.ServiceType as string;
  if (update.Host !== undefined) stored.Host = update.Host as string;
  if (update.HTTPMethod !== undefined)
    stored.HTTPMethod = update.HTTPMethod as string;
  if (update.URLPath !== undefined) stored.URLPath = update.URLPath as string;
  if (update.Attributes !== undefined)
    stored.Attributes = update.Attributes as Record<string, string>;
  stored.ModifiedAt = nowSec();

  return { SamplingRuleRecord: toSamplingRuleRecord(stored) };
};

const DeleteSamplingRule: OperationHandler = (input, _ctx) => {
  const name = input.RuleName as string | undefined;
  const arn = input.RuleARN as string | undefined;

  let stored: StoredSamplingRule | undefined;
  let key: string | undefined;

  if (name) {
    stored = samplingRules.get(name);
    key = name;
  }
  if (!stored && arn) {
    for (const [k, v] of samplingRules) {
      if (v.RuleARN === arn) {
        stored = v;
        key = k;
        break;
      }
    }
  }

  if (!stored || !key) {
    throw awsError("InvalidRequestException", "Sampling rule not found.", 400);
  }

  samplingRules.delete(key);
  tags.delete(stored.RuleARN);

  return { SamplingRuleRecord: toSamplingRuleRecord(stored) };
};

const GetSamplingTargets: OperationHandler = (input, _ctx) => {
  const docs = (input.SamplingStatisticsDocuments ?? []) as Record<
    string,
    unknown
  >[];
  const targets = docs.map((doc) => {
    const ruleName = doc.RuleName as string;
    const rule = samplingRules.get(ruleName);
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

const CreateGroup: OperationHandler = (input, _ctx) => {
  const name = input.GroupName as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "GroupName is required.", 400);
  if (groups.has(name))
    throw awsError(
      "InvalidRequestException",
      `Group ${name} already exists.`,
      400,
    );

  const arn = makeGroupARN(name);
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

  groups.set(name, stored);
  tags.set(arn, { ...stored.Tags });

  return { Group: toGroup(stored) };
};

const GetGroup: OperationHandler = (input, _ctx) => {
  const name = input.GroupName as string | undefined;
  const arn = input.GroupARN as string | undefined;

  let stored: StoredGroup | undefined;
  if (name) stored = groups.get(name);
  if (!stored && arn) {
    stored = Array.from(groups.values()).find((g) => g.GroupARN === arn);
  }

  if (!stored) {
    throw awsError("InvalidRequestException", "Group not found.", 400);
  }

  return { Group: toGroup(stored) };
};

const GetGroups: OperationHandler = (_input, _ctx) => ({
  Groups: Array.from(groups.values()).map(toGroupSummary),
  NextToken: undefined,
});

const UpdateGroup: OperationHandler = (input, _ctx) => {
  const name = input.GroupName as string | undefined;
  const arn = input.GroupARN as string | undefined;

  let stored: StoredGroup | undefined;
  if (name) stored = groups.get(name);
  if (!stored && arn) {
    stored = Array.from(groups.values()).find((g) => g.GroupARN === arn);
  }

  if (!stored) {
    throw awsError("InvalidRequestException", "Group not found.", 400);
  }

  if (input.FilterExpression !== undefined)
    stored.FilterExpression = input.FilterExpression as string;
  if (input.InsightsConfiguration !== undefined)
    stored.InsightsConfiguration =
      input.InsightsConfiguration as StoredGroup["InsightsConfiguration"];

  return { Group: toGroup(stored) };
};

const DeleteGroup: OperationHandler = (input, _ctx) => {
  const name = input.GroupName as string | undefined;
  const arn = input.GroupARN as string | undefined;

  let key: string | undefined;
  let stored: StoredGroup | undefined;

  if (name) {
    stored = groups.get(name);
    key = name;
  }
  if (!stored && arn) {
    for (const [k, v] of groups) {
      if (v.GroupARN === arn) {
        stored = v;
        key = k;
        break;
      }
    }
  }

  if (!stored || !key) {
    throw awsError("InvalidRequestException", "Group not found.", 400);
  }

  groups.delete(key);
  tags.delete(stored.GroupARN);

  return {};
};

const GetEncryptionConfig: OperationHandler = (_input, _ctx) => ({
  EncryptionConfig: {
    KeyId: encryptionConfig.KeyId,
    Status: encryptionConfig.Status,
    Type: encryptionConfig.Type,
  },
});

const PutEncryptionConfig: OperationHandler = (input, _ctx) => {
  const type = input.Type as string | undefined;
  if (!type)
    throw awsError("InvalidRequestException", "Type is required.", 400);

  encryptionConfig = {
    KeyId: input.KeyId as string | undefined,
    Status: "UPDATING",
    Type: type,
  };

  setTimeout(() => {
    encryptionConfig.Status = "ACTIVE";
  }, 0);

  return {
    EncryptionConfig: {
      KeyId: encryptionConfig.KeyId,
      Status: "ACTIVE",
      Type: encryptionConfig.Type,
    },
  };
};

const getTagsForArn = (arn: string) => tags.get(arn) ?? {};

const ListTagsForResource: OperationHandler = (input, _ctx) => {
  const arn = input.ResourceARN as string | undefined;
  if (!arn)
    throw awsError("InvalidRequestException", "ResourceARN is required.", 400);

  const isGroup = Array.from(groups.values()).some((g) => g.GroupARN === arn);
  const isRule = Array.from(samplingRules.values()).some(
    (r) => r.RuleARN === arn,
  );

  if (!isGroup && !isRule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }

  const resourceTags = getTagsForArn(arn);
  return {
    Tags: Object.entries(resourceTags).map(([Key, Value]) => ({ Key, Value })),
    NextToken: undefined,
  };
};

const TagResource: OperationHandler = (input, _ctx) => {
  const arn = input.ResourceARN as string | undefined;
  if (!arn)
    throw awsError("InvalidRequestException", "ResourceARN is required.", 400);

  const isGroup = Array.from(groups.values()).some((g) => g.GroupARN === arn);
  const isRule = Array.from(samplingRules.values()).some(
    (r) => r.RuleARN === arn,
  );

  if (!isGroup && !isRule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }

  const inputTags = (input.Tags ?? []) as { Key: string; Value: string }[];
  const existing = getTagsForArn(arn);
  if (Object.keys(existing).length + inputTags.length > 50) {
    throw awsError("TooManyTagsException", "Too many tags.", 400);
  }

  const updated = { ...existing };
  for (const t of inputTags) updated[t.Key] = t.Value;
  tags.set(arn, updated);

  return {};
};

const UntagResource: OperationHandler = (input, _ctx) => {
  const arn = input.ResourceARN as string | undefined;
  if (!arn)
    throw awsError("InvalidRequestException", "ResourceARN is required.", 400);

  const isGroup = Array.from(groups.values()).some((g) => g.GroupARN === arn);
  const isRule = Array.from(samplingRules.values()).some(
    (r) => r.RuleARN === arn,
  );

  if (!isGroup && !isRule) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }

  const tagKeys = (input.TagKeys ?? []) as string[];
  const existing = getTagsForArn(arn);
  const updated = { ...existing };
  for (const k of tagKeys) delete updated[k];
  tags.set(arn, updated);

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

const GetIndexingRules: OperationHandler = (_input, _ctx) => ({
  IndexingRules: Array.from(indexingRules.values()).map((r) => ({
    Name: r.Name,
    ModifiedAt: r.ModifiedAt,
    Rule: r.Rule,
  })),
  NextToken: undefined,
});

const UpdateIndexingRule: OperationHandler = (input, _ctx) => {
  const name = input.Name as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "Name is required.", 400);

  const existing = indexingRules.get(name);
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
  indexingRules.set(name, updated);

  return {
    IndexingRule: {
      Name: updated.Name,
      ModifiedAt: updated.ModifiedAt,
      Rule: updated.Rule,
    },
  };
};

const ListResourcePolicies: OperationHandler = (_input, _ctx) => ({
  ResourcePolicies: Array.from(resourcePolicies.values()).map((p) => ({
    PolicyName: p.PolicyName,
    PolicyDocument: p.PolicyDocument,
    PolicyRevisionId: p.PolicyRevisionId,
    LastUpdatedTime: p.LastUpdatedTime,
  })),
  NextToken: undefined,
});

const PutResourcePolicy: OperationHandler = (input, _ctx) => {
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

  const revisionId = `${Date.now()}`;
  const stored: StoredResourcePolicy = {
    PolicyName: name,
    PolicyDocument: doc,
    PolicyRevisionId: revisionId,
    LastUpdatedTime: nowSec(),
  };
  resourcePolicies.set(name, stored);

  return {
    ResourcePolicy: {
      PolicyName: stored.PolicyName,
      PolicyDocument: stored.PolicyDocument,
      PolicyRevisionId: stored.PolicyRevisionId,
      LastUpdatedTime: stored.LastUpdatedTime,
    },
  };
};

const DeleteResourcePolicy: OperationHandler = (input, _ctx) => {
  const name = input.PolicyName as string | undefined;
  if (!name)
    throw awsError("InvalidRequestException", "PolicyName is required.", 400);

  if (!resourcePolicies.has(name)) {
    throw awsError("InvalidRequestException", `Policy ${name} not found.`, 400);
  }

  resourcePolicies.delete(name);
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

const StartTraceRetrieval: OperationHandler = (input, _ctx) => {
  const traceIds = (input.TraceIds ?? []) as string[];
  if (!traceIds.length)
    throw awsError("InvalidRequestException", "TraceIds is required.", 400);
  validateRequired(input as Record<string, unknown>, ["StartTime", "EndTime"]);

  const token = `retrieval-${Date.now()}`;
  retrievals.set(token, {
    RetrievalToken: token,
    Status: "SCHEDULED",
    StartTime: (input.StartTime as number) ?? nowSec(),
    EndTime: (input.EndTime as number) ?? nowSec(),
    TraceIds: traceIds,
  });

  return { RetrievalToken: token };
};

const CancelTraceRetrieval: OperationHandler = (input, _ctx) => {
  const token = input.RetrievalToken as string | undefined;
  if (!token)
    throw awsError(
      "InvalidRequestException",
      "RetrievalToken is required.",
      400,
    );
  if (!retrievals.has(token)) {
    throw awsError(
      "ResourceNotFoundException",
      `Retrieval ${token} not found.`,
      404,
    );
  }
  retrievals.delete(token);
  return {};
};

const ListRetrievedTraces: OperationHandler = (input, _ctx) => {
  const token = input.RetrievalToken as string | undefined;
  if (!token)
    throw awsError(
      "InvalidRequestException",
      "RetrievalToken is required.",
      400,
    );

  const retrieval = retrievals.get(token);
  if (!retrieval) {
    throw awsError(
      "ResourceNotFoundException",
      `Retrieval ${token} not found.`,
      404,
    );
  }

  const traceList = retrieval.TraceIds.map((id) => {
    const trace = traces.get(id);
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

const GetRetrievedTracesGraph: OperationHandler = (input, _ctx) => {
  const token = input.RetrievalToken as string | undefined;
  if (!token)
    throw awsError(
      "InvalidRequestException",
      "RetrievalToken is required.",
      400,
    );

  if (!retrievals.has(token)) {
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
