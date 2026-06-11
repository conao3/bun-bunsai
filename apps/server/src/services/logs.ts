import { gzipSync } from "node:zlib";
import { awsError } from "../core/framework.ts";
import { deliverToArn } from "../core/events.ts";
import { loadServiceModel } from "../core/shapes.ts";
import logsModel from "../../../../test/vendor/aws-models/logs.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(logsModel);

type StoredEvent = {
  timestamp: number;
  message: string;
  ingestionTime: number;
  eventId: string;
};

type StoredStream = {
  logStreamName: string;
  creationTime: number;
  events: StoredEvent[];
};

type StoredGroup = {
  logGroupName: string;
  creationTime: number;
  arn: string;
  streams: Record<string, StoredStream>;
  retentionInDays?: number;
  tags?: Record<string, string>;
  kmsKeyId?: string;
  logGroupClass?: string;
  deletionProtectionEnabled?: boolean;
  dataProtectionStatus?: string;
};

type StoredMetricTransformation = {
  metricName: string;
  metricNamespace: string;
  metricValue: string;
  defaultValue?: number;
};

type StoredMetricFilter = {
  filterName: string;
  filterPattern: string;
  logGroupName: string;
  creationTime: number;
  metricTransformations: StoredMetricTransformation[];
};

type StoredDestination = {
  destinationName: string;
  targetArn: string;
  roleArn: string;
  arn: string;
  creationTime: number;
  accessPolicy?: string;
};

type StoredSubscriptionFilter = {
  filterName: string;
  filterPattern: string;
  logGroupName: string;
  destinationArn: string;
  roleArn?: string;
  distribution?: string;
  creationTime: number;
};

type StoredDeliveryDestination = {
  name: string;
  arn: string;
  deliveryDestinationType: string;
  outputFormat?: string;
  deliveryDestinationConfiguration: Record<string, unknown>;
  tags?: Record<string, string>;
};

type StoredDeliverySource = {
  name: string;
  arn: string;
  resourceArn: string;
  service: string;
  logType: string;
  tags?: Record<string, string>;
};

type StoredDelivery = {
  id: string;
  arn: string;
  deliverySourceName: string;
  deliveryDestinationArn: string;
  deliveryDestinationType: string;
  recordFields?: string[];
  fieldDelimiter?: string;
  s3DeliveryConfiguration?: Record<string, unknown>;
  tags?: Record<string, string>;
};

type StoredExportTask = {
  taskId: string;
  taskName: string;
  logGroupName: string;
  from: number;
  to: number;
  destination: string;
  destinationPrefix?: string;
  status: {
    code: string;
    message?: string;
  };
  creationTime: number;
  completionTime?: number;
  executionInfo?: Record<string, unknown>;
};

type StoredImportTask = {
  taskId: string;
  taskName: string;
  logGroupName: string;
  cloudTrailArn: string;
  startTime: number;
  endTime: number;
  status: string;
  createdDate: number;
  importedLogBytes?: number;
  importedLogEvents?: number;
  importedLogFiles?: number;
};

type StoredLogAnomalyDetector = {
  anomalyDetectorArn: string;
  detectorName: string;
  logGroupArnList: string[];
  evaluationFrequency: string;
  filterPattern?: string;
  anomalyDetectorStatus: string;
  kmsKeyId?: string;
  creationTimeStamp: number;
  lastModifiedTimeStamp: number;
  anomalyVisibilityTime?: number;
};

type StoredAnomaly = {
  anomalyId: string;
  patternId: string;
  anomalyDetectorArn: string;
  patternString: string;
  active: boolean;
  state: string;
  histogram: Record<string, number>;
  logSamples: unknown[];
  patternTokens: unknown[];
  logGroupArnList: string[];
  suppressed: boolean;
  suppressedDate?: number;
  suppressedUntil?: number;
  isPatternLevelSuppression?: boolean;
  firstSeen: number;
  lastSeen: number;
  description: string;
  priority: string;
};

type StoredLookupTable = {
  id: string;
  name: string;
  s3Location: Record<string, unknown>;
  status: string;
  createdDate: number;
  modifiedDate?: number;
  size?: number;
  lastUpdated?: number;
};

type StoredScheduledQuery = {
  arn: string;
  name: string;
  queryString: string;
  scheduleConfiguration: Record<string, unknown>;
  notificationConfiguration: Record<string, unknown>;
  targetConfiguration: Record<string, unknown>;
  scheduledQueryExecutionRoleArn: string;
  errorReportConfiguration?: Record<string, unknown>;
  kmsKeyId?: string;
  state: string;
  creationTime: number;
  lastRunTime?: number;
  lastModificationTime: number;
};

type StoredQueryDefinition = {
  queryDefinitionId: string;
  name: string;
  queryString: string;
  lastModified: number;
  logGroupNames?: string[];
};

type StoredQuery = {
  queryId: string;
  queryString: string;
  status: string;
  createTime: number;
  logGroupName?: string;
  logGroupNames?: string[];
  startTime?: number;
  endTime?: number;
  statistics?: Record<string, unknown>;
  results?: unknown[][];
};

type StoredAccountPolicy = {
  policyName: string;
  policyDocument: string;
  lastUpdatedTime: number;
  policyType: string;
  scope: string;
  selectionCriteria?: string;
  accountId: string;
};

type StoredDataProtectionPolicy = {
  logGroupIdentifier: string;
  policyDocument: string;
  lastUpdatedTime: number;
};

type StoredResourcePolicy = {
  policyName: string;
  policyDocument: string;
  lastUpdatedTime: number;
};

type StoredIndexPolicy = {
  logGroupIdentifier: string;
  policyDocument: string;
  lastUpdateTime: number;
  policyId?: string;
  source?: string;
};

type StoredIntegration = {
  integrationName: string;
  integrationStatus: string;
  integrationType: string;
  resourceConfig: Record<string, unknown>;
  integrationDetails?: Record<string, unknown>;
};

type StoredTransformer = {
  logGroupIdentifier: string;
  creationTime: number;
  lastModifiedTime: number;
  transformerConfig: unknown[];
};

const metricFilterPrefix = "metric-filter:";
const destinationPrefix = "destination:";
const subFilterPrefix = "sub-filter:";
const deliveryDstPrefix = "delivery-dst:";
const deliverySrcPrefix = "delivery-src:";
const deliveryPrefix = "delivery:";
const exportTaskPrefix = "export-task:";
const importTaskPrefix = "import-task:";
const logAnomalyPrefix = "log-anomaly:";
const anomalyPrefix = "anomaly:";
const lookupTablePrefix = "lookup-table:";
const scheduledQueryPrefix = "scheduled-query:";
const queryDefPrefix = "query-def:";
const queryPrefix = "query:";
const accountPolicyPrefix = "account-policy:";
const dpPolicyPrefix = "dp-policy:";
const resPolicyPrefix = "res-policy:";
const indexPolicyPrefix = "index-policy:";
const integrationPrefix = "integration:";
const transformerPrefix = "transformer:";
const tagsPrefix = "tags:";
const s3SourcePrefix = "s3-source:";

const metricFilterKey = (groupName: string, filterName: string): string =>
  `${metricFilterPrefix}${groupName} ${filterName}`;

const subFilterKey = (groupName: string, filterName: string): string =>
  `${subFilterPrefix}${groupName} ${filterName}`;

const groupArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:logs:${region}:${account}:log-group:${name}:*`;

const streamArnOf = (
  region: string,
  account: string,
  groupName: string,
  streamName: string,
): string =>
  `arn:aws:logs:${region}:${account}:log-group:${groupName}:log-stream:${streamName}`;

const destinationArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:logs:${region}:${account}:destination:${name}`;

const deliveryDstArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:logs:${region}:${account}:delivery-destination:${name}`;

const deliverySrcArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:logs:${region}:${account}:delivery-source:${name}`;

const deliveryArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:logs:${region}:${account}:delivery:${id}`;

const logAnomalyArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:logs:${region}:${account}:anomaly-detector:${id}`;

const scheduledQueryArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:timestream:${region}:${account}:scheduled-query/${name}`;

const integrationArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:logs:${region}:${account}:integration:${name}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  field: string,
): string | undefined => {
  const value = input[field];
  return typeof value === "string" ? value : undefined;
};

const optionalNumber = (
  input: Record<string, unknown>,
  field: string,
): number | undefined => {
  const value = input[field];
  return typeof value === "number" ? value : undefined;
};

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const requireGroup = (ctx: ServiceContext, name: string): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(name);
  if (group === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The specified log group does not exist.`,
      400,
    );
  }
  return group;
};

const requireStream = (group: StoredGroup, name: string): StoredStream => {
  const stream = group.streams[name];
  if (stream === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The specified log stream does not exist.`,
      400,
    );
  }
  return stream;
};

const sequenceTokenOf = (stream: StoredStream): string =>
  String(stream.events.length);

const nameFromIdentifier = (identifier: string): string => {
  const m = identifier.match(/^arn:aws:logs:[^:]+:[^:]+:log-group:([^:]+)/);
  return m ? m[1] : identifier;
};

const resolveGroupRef = (
  input: Record<string, unknown>,
  ctx: ServiceContext,
): StoredGroup => {
  const name = optionalString(input, "logGroupName");
  const identifier = optionalString(input, "logGroupIdentifier");
  if (name !== undefined && identifier !== undefined) {
    throw awsError(
      "InvalidParameterException",
      "You cannot specify both logGroupName and logGroupIdentifier.",
      400,
    );
  }
  if (name === undefined && identifier === undefined) {
    throw awsError(
      "InvalidParameterException",
      "logGroupName or logGroupIdentifier is required.",
      400,
    );
  }
  return requireGroup(ctx, name ?? nameFromIdentifier(identifier!));
};

const tagsFor = (ctx: ServiceContext, arn: string): Record<string, string> => {
  const stored = ctx.store.get<Record<string, string>>(`${tagsPrefix}${arn}`);
  return stored ?? {};
};

const setTagsFor = (
  ctx: ServiceContext,
  arn: string,
  tags: Record<string, string>,
): void => {
  ctx.store.set(`${tagsPrefix}${arn}`, tags);
};

const requireResourceByArn = (ctx: ServiceContext, arn: string): void => {
  const m = arn.match(/^arn:aws:logs:[^:]+:[^:]+:log-group:([^:]+)/);
  if (m) requireGroup(ctx, m[1]);
};

const CreateLogGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "logGroupName");
  if (ctx.store.get<StoredGroup>(name) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `The specified log group already exists.`,
      400,
    );
  }
  const arn = groupArnOf(ctx.region, ctx.account, name);
  const group: StoredGroup = {
    logGroupName: name,
    creationTime: Date.now(),
    arn,
    streams: {},
  };
  const kmsKeyId = optionalString(input, "kmsKeyId");
  if (kmsKeyId !== undefined) group.kmsKeyId = kmsKeyId;
  const logGroupClass = optionalString(input, "logGroupClass");
  if (logGroupClass !== undefined) group.logGroupClass = logGroupClass;
  if (input["deletionProtectionEnabled"] === true) {
    group.deletionProtectionEnabled = true;
  }
  ctx.store.set(name, group);
  const rawTags = input["tags"];
  if (rawTags !== null && typeof rawTags === "object") {
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawTags as Record<string, unknown>)) {
      if (typeof v === "string") tags[k] = v;
    }
    if (Object.keys(tags).length > 0) setTagsFor(ctx, arn, tags);
  }
  return {};
};

const DeleteLogGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "logGroupName");
  const group = requireGroup(ctx, name);
  if (group.deletionProtectionEnabled === true) {
    throw awsError(
      "ValidationException",
      "The specified log group has deletion protection enabled.",
      400,
    );
  }
  ctx.store.delete(name);
  const groupArn = group.arn;
  const keysToDelete = ctx.store
    .list()
    .map((entry) => entry.key)
    .filter(
      (key) =>
        key.startsWith(`${metricFilterPrefix}${name} `) ||
        key.startsWith(`${subFilterPrefix}${name} `) ||
        key === `${dpPolicyPrefix}${name}` ||
        key === `${indexPolicyPrefix}${name}` ||
        key === `${transformerPrefix}${name}` ||
        key === `${tagsPrefix}${groupArn}`,
    );
  for (const key of keysToDelete) {
    ctx.store.delete(key);
  }
  return {};
};

const logGroupView = (group: StoredGroup): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    logGroupName: group.logGroupName,
    creationTime: group.creationTime,
    metricFilterCount: 0,
    arn: group.arn,
    storedBytes: 0,
    logGroupClass: group.logGroupClass ?? "STANDARD",
  };
  if (group.retentionInDays !== undefined) {
    view["retentionInDays"] = group.retentionInDays;
  }
  if (group.kmsKeyId !== undefined) {
    view["kmsKeyId"] = group.kmsKeyId;
  }
  if (group.deletionProtectionEnabled !== undefined) {
    view["inheritedProperties"] = group.deletionProtectionEnabled
      ? ["RETENTION"]
      : [];
  }
  if (group.dataProtectionStatus !== undefined) {
    view["dataProtectionStatus"] = group.dataProtectionStatus;
  }
  return view;
};

const DescribeLogGroups: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "logGroupNamePrefix");
  const pattern = optionalString(input, "logGroupNamePattern");
  const limit = optionalNumber(input, "limit") ?? 50;
  const offset = decodePageToken(input["nextToken"]);
  const all = ctx.store
    .list<StoredGroup>()
    .filter(
      (entry) =>
        !entry.key.includes(":") && !entry.key.startsWith(metricFilterPrefix),
    )
    .map((entry) => entry.value)
    .filter(
      (v): v is StoredGroup =>
        v !== null && typeof v === "object" && "logGroupName" in v,
    )
    .filter((group) =>
      prefix === undefined ? true : group.logGroupName.startsWith(prefix),
    )
    .filter((group) =>
      pattern === undefined ? true : group.logGroupName.includes(pattern),
    )
    .sort((a, b) => a.logGroupName.localeCompare(b.logGroupName));
  const page = all.slice(offset, offset + limit);
  const result: Record<string, unknown> = { logGroups: page.map(logGroupView) };
  if (offset + limit < all.length) {
    result["nextToken"] = encodePageToken(offset + limit);
  }
  return result;
};

const CreateLogStream: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const streamName = requireString(input, "logStreamName");
  const group = requireGroup(ctx, groupName);
  if (group.streams[streamName] !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `The specified log stream already exists.`,
      400,
    );
  }
  group.streams[streamName] = {
    logStreamName: streamName,
    creationTime: Date.now(),
    events: [],
  };
  ctx.store.set(groupName, group);
  return {};
};

const DeleteLogStream: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const streamName = requireString(input, "logStreamName");
  const group = requireGroup(ctx, groupName);
  requireStream(group, streamName);
  delete group.streams[streamName];
  ctx.store.set(groupName, group);
  return {};
};

const logStreamView = (
  ctx: ServiceContext,
  groupName: string,
  stream: StoredStream,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    logStreamName: stream.logStreamName,
    creationTime: stream.creationTime,
    arn: streamArnOf(ctx.region, ctx.account, groupName, stream.logStreamName),
    storedBytes: 0,
    uploadSequenceToken: sequenceTokenOf(stream),
  };
  if (stream.events.length > 0) {
    const first = stream.events[0];
    const last = stream.events[stream.events.length - 1];
    if (first !== undefined) view["firstEventTimestamp"] = first.timestamp;
    if (last !== undefined) {
      view["lastEventTimestamp"] = last.timestamp;
      view["lastIngestionTime"] = last.ingestionTime;
    }
  }
  return view;
};

const DescribeLogStreams: OperationHandler = (input, ctx) => {
  const group = resolveGroupRef(input, ctx);
  const groupName = group.logGroupName;
  const prefix = optionalString(input, "logStreamNamePrefix");
  const limit = optionalNumber(input, "limit") ?? 50;
  const offset = decodePageToken(input["nextToken"]);
  const all = Object.values(group.streams)
    .filter((stream) =>
      prefix === undefined ? true : stream.logStreamName.startsWith(prefix),
    )
    .sort((a, b) => a.logStreamName.localeCompare(b.logStreamName));
  const page = all.slice(offset, offset + limit);
  const result: Record<string, unknown> = {
    logStreams: page.map((stream) => logStreamView(ctx, groupName, stream)),
  };
  if (offset + limit < all.length) {
    result["nextToken"] = encodePageToken(offset + limit);
  }
  return result;
};

const jsonSelectorGet = (path: string, obj: unknown): unknown => {
  let cur = obj;
  const segments = path.split(".").flatMap((seg) => {
    const parts: (string | number)[] = [];
    const re = /([^[]+)|\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) {
      if (m[2] !== undefined) {
        parts.push(parseInt(m[2], 10));
      } else {
        parts.push(m[1]!);
      }
    }
    return parts;
  });
  for (const seg of segments) {
    if (cur === null || typeof cur !== "object") return undefined;
    if (typeof seg === "number") {
      cur = (cur as unknown[])[seg];
    } else {
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
};

const jsonWildcardMatch = (pattern: string, value: string): boolean => {
  if (!pattern.includes("*")) return pattern === value;
  const parts = pattern
    .split("*")
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`^${parts.join(".*")}$`).test(value);
};

const jsonCompare = (
  selector: string,
  op: string,
  rawValue: string,
  obj: Record<string, unknown>,
): boolean => {
  const path = selector.startsWith("$.")
    ? selector.slice(2)
    : selector.slice(1);
  const actual = jsonSelectorGet(path, obj);
  if (op === "IS" && rawValue === "NULL") return actual === null;
  if (op === "NOT" && rawValue === "EXISTS") return actual === undefined;
  if (op === "IS" && rawValue === "TRUE") return actual === true;
  if (op === "IS" && rawValue === "FALSE") return actual === false;
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    const sv = rawValue.slice(1, -1);
    const av = typeof actual === "string" ? actual : String(actual ?? "");
    if (op === "=") return jsonWildcardMatch(sv, av);
    if (op === "!=") return !jsonWildcardMatch(sv, av);
    return false;
  }
  const nv = parseFloat(rawValue);
  const an =
    typeof actual === "number" ? actual : parseFloat(String(actual ?? ""));
  if (!Number.isFinite(nv) || !Number.isFinite(an)) return false;
  if (op === "=") return an === nv;
  if (op === "!=") return an !== nv;
  if (op === "<") return an < nv;
  if (op === "<=") return an <= nv;
  if (op === ">") return an > nv;
  if (op === ">=") return an >= nv;
  return false;
};

const jsonTokenize = (expr: string): string[] => {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch === "&" && expr[i + 1] === "&") {
      tokens.push("&&");
      i += 2;
      continue;
    }
    if (ch === "|" && expr[i + 1] === "|") {
      tokens.push("||");
      i += 2;
      continue;
    }
    if (ch === "!" && expr[i + 1] === "=") {
      tokens.push("!=");
      i += 2;
      continue;
    }
    if (ch === "<" && expr[i + 1] === "=") {
      tokens.push("<=");
      i += 2;
      continue;
    }
    if (ch === ">" && expr[i + 1] === "=") {
      tokens.push(">=");
      i += 2;
      continue;
    }
    if (ch === "<" || ch === ">" || ch === "=") {
      tokens.push(ch);
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < expr.length && expr[j] !== '"') {
        if (expr[j] === "\\") j++;
        j++;
      }
      tokens.push(expr.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < expr.length && !/[\s()&|=<>!]/.test(expr[j]!)) j++;
    if (j > i) tokens.push(expr.slice(i, j));
    i = j;
  }
  return tokens;
};

const jsonEvalExpr = (
  tokens: string[],
  pos: { v: number },
  obj: Record<string, unknown>,
): boolean => {
  const parsePrimary = (): boolean => {
    if (tokens[pos.v] === "(") {
      pos.v++;
      const result = parseOr();
      pos.v++;
      return result;
    }
    const selector = tokens[pos.v++]!;
    const op = tokens[pos.v++]!;
    const value = tokens[pos.v++]!;
    return jsonCompare(selector, op, value, obj);
  };
  const parseAnd = (): boolean => {
    let result = parsePrimary();
    while (pos.v < tokens.length && tokens[pos.v] === "&&") {
      pos.v++;
      result = parsePrimary() && result;
    }
    return result;
  };
  const parseOr = (): boolean => {
    let result = parseAnd();
    while (pos.v < tokens.length && tokens[pos.v] === "||") {
      pos.v++;
      result = parseAnd() || result;
    }
    return result;
  };
  return parseOr();
};

const matchesJsonPattern = (pattern: string, message: string): boolean => {
  let obj: unknown;
  try {
    obj = JSON.parse(message);
  } catch {
    return false;
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj))
    return false;
  const expr = pattern.slice(1, -1).trim();
  if (expr === "") return true;
  const tokens = jsonTokenize(expr);
  if (tokens.length === 0) return true;
  const pos = { v: 0 };
  return jsonEvalExpr(tokens, pos, obj as Record<string, unknown>);
};

const matchesPattern = (pattern: string, message: string): boolean => {
  if (pattern === "") return true;
  const trimmed = pattern.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return matchesJsonPattern(trimmed, message);
  }
  const tokens = trimmed.match(/"[^"]*"|[^\s]+/g) ?? [];
  const andTerms: string[] = [];
  const orTerms: string[] = [];
  const excludeTerms: string[] = [];
  for (const token of tokens) {
    if (token.startsWith("?")) {
      orTerms.push(token.slice(1));
    } else if (token.startsWith("-")) {
      excludeTerms.push(token.slice(1));
    } else if (token.startsWith('"') && token.endsWith('"')) {
      andTerms.push(token.slice(1, -1));
    } else {
      andTerms.push(token);
    }
  }
  if (!andTerms.every((t) => message.includes(t))) return false;
  if (orTerms.length > 0 && !orTerms.some((t) => message.includes(t)))
    return false;
  if (excludeTerms.some((t) => message.includes(t))) return false;
  return true;
};

const emitMetrics = (
  ctx: ServiceContext,
  groupName: string,
  events: StoredEvent[],
): void => {
  const cwStore = ctx.storeFor("monitoring");
  const filters = ctx.store
    .list<StoredMetricFilter>()
    .filter((entry) =>
      entry.key.startsWith(`${metricFilterPrefix}${groupName} `),
    )
    .map((entry) => entry.value);
  for (const filter of filters) {
    const matching = events.filter((e) =>
      matchesPattern(filter.filterPattern, e.message),
    );
    if (matching.length === 0) continue;
    for (const transformation of filter.metricTransformations) {
      const rawValue = parseFloat(transformation.metricValue);
      const pointValue = Number.isFinite(rawValue)
        ? rawValue
        : (transformation.defaultValue ?? 1);
      const cwKey = `metric/${transformation.metricNamespace}/${transformation.metricName}/`;
      const existing = cwStore.get<{
        Namespace: string;
        MetricName: string;
        Dimensions: unknown[];
        Unit: string;
        Points: { Timestamp: number; Value: number; Unit: string }[];
      }>(cwKey);
      const series = existing ?? {
        Namespace: transformation.metricNamespace,
        MetricName: transformation.metricName,
        Dimensions: [],
        Unit: "None",
        Points: [],
      };
      for (const event of matching) {
        series.Points.push({
          Timestamp: Math.floor(event.ingestionTime / 1000),
          Value: pointValue,
          Unit: "None",
        });
      }
      cwStore.set(cwKey, series);
    }
  }
};

const deliverToSubscriptions = async (
  ctx: ServiceContext,
  groupName: string,
  streamName: string,
  events: StoredEvent[],
): Promise<void> => {
  const filters = ctx.store
    .list<StoredSubscriptionFilter>()
    .filter((entry) => entry.key.startsWith(`${subFilterPrefix}${groupName} `))
    .map((entry) => entry.value);
  for (const filter of filters) {
    const matching = events.filter((e) =>
      matchesPattern(filter.filterPattern, e.message),
    );
    if (matching.length === 0) continue;
    const cwPayload = {
      messageType: "DATA_MESSAGE",
      owner: ctx.account,
      logGroup: groupName,
      logStream: streamName,
      subscriptionFilters: [filter.filterName],
      logEvents: matching.map((e) => ({
        id: e.eventId,
        timestamp: e.timestamp,
        message: e.message,
      })),
    };
    if (filter.destinationArn.startsWith("arn:aws:lambda:")) {
      const data = gzipSync(Buffer.from(JSON.stringify(cwPayload))).toString(
        "base64",
      );
      await deliverToArn(ctx, filter.destinationArn, {
        body: "",
        event: { awslogs: { data } },
      });
      continue;
    }
    if (!filter.destinationArn.startsWith("arn:aws:kinesis:")) continue;
    const parts = filter.destinationArn.split("/");
    const streamName2 = parts[parts.length - 1] ?? "";
    if (streamName2 === "") continue;
    const kinesisStore = ctx.storeFor("kinesis");
    const kStream = kinesisStore.get<{
      nextSequence: number;
      shards: { ShardId: string; Status: string }[];
      records: {
        SequenceNumber: string;
        Data: string;
        PartitionKey: string;
        ApproximateArrivalTimestamp: number;
        ShardId: string;
      }[];
    }>(`stream/${streamName2}`);
    if (kStream === undefined) continue;
    const openShard = kStream.shards.find((s) => s.Status === "OPEN");
    if (openShard === undefined) continue;
    const compressed = gzipSync(Buffer.from(JSON.stringify(cwPayload)));
    const record = {
      SequenceNumber: String(kStream.nextSequence),
      Data: compressed.toString("binary"),
      PartitionKey: groupName,
      ApproximateArrivalTimestamp: Math.floor(Date.now() / 1000),
      ShardId: openShard.ShardId,
    };
    kStream.nextSequence += 1;
    kStream.records.push(record);
    kinesisStore.set(`stream/${streamName2}`, kStream);
  }
};

const PutLogEvents: OperationHandler = async (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const streamName = requireString(input, "logStreamName");
  const group = requireGroup(ctx, groupName);
  const stream = requireStream(group, streamName);
  const rawEvents = input["logEvents"];
  if (!Array.isArray(rawEvents)) {
    throw awsError("InvalidParameterException", "logEvents is required.", 400);
  }
  const ingestionTime = Date.now();
  const newEvents: StoredEvent[] = [];
  for (const raw of rawEvents) {
    const event = raw as Record<string, unknown>;
    const timestamp = optionalNumber(event, "timestamp");
    const message = optionalString(event, "message");
    if (timestamp === undefined || message === undefined) {
      throw awsError(
        "InvalidParameterException",
        "Each log event requires timestamp and message.",
        400,
      );
    }
    const stored: StoredEvent = {
      timestamp,
      message,
      ingestionTime,
      eventId: crypto.randomUUID(),
    };
    stream.events.push(stored);
    newEvents.push(stored);
  }
  stream.events.sort((a, b) => a.timestamp - b.timestamp);
  ctx.store.set(groupName, group);
  emitMetrics(ctx, groupName, newEvents);
  await deliverToSubscriptions(ctx, groupName, streamName, newEvents);
  return { nextSequenceToken: sequenceTokenOf(stream) };
};

const GetLogEvents: OperationHandler = (input, ctx) => {
  const group = resolveGroupRef(input, ctx);
  const streamName = requireString(input, "logStreamName");
  const stream = requireStream(group, streamName);
  const startTime = optionalNumber(input, "startTime");
  const endTime = optionalNumber(input, "endTime");
  const limit = optionalNumber(input, "limit") ?? 10000;
  const startFromHead = input["startFromHead"] === true;
  const nextToken = optionalString(input, "nextToken");
  const filtered = stream.events.filter((event) => {
    if (startTime !== undefined && event.timestamp < startTime) return false;
    if (endTime !== undefined && event.timestamp >= endTime) return false;
    return true;
  });
  let pageStartIdx: number;
  let page: StoredEvent[];
  if (nextToken !== undefined) {
    const fMatch = /^f\/(\d+)$/.exec(nextToken);
    const bMatch = /^b\/(\d+)$/.exec(nextToken);
    if (fMatch) {
      pageStartIdx = parseInt(fMatch[1], 10);
      page = filtered.slice(pageStartIdx, pageStartIdx + limit);
    } else if (bMatch) {
      const endIdx = parseInt(bMatch[1], 10);
      pageStartIdx = Math.max(0, endIdx - limit);
      page = filtered.slice(pageStartIdx, endIdx);
    } else {
      pageStartIdx = startFromHead ? 0 : Math.max(0, filtered.length - limit);
      page = filtered.slice(pageStartIdx, pageStartIdx + limit);
    }
  } else if (startFromHead) {
    pageStartIdx = 0;
    page = filtered.slice(0, limit);
  } else {
    pageStartIdx = Math.max(0, filtered.length - limit);
    page = filtered.slice(pageStartIdx);
  }
  const pageEndIdx = pageStartIdx + page.length;
  return {
    events: page.map((event) => ({
      timestamp: event.timestamp,
      message: event.message,
      ingestionTime: event.ingestionTime,
    })),
    nextForwardToken: `f/${pageEndIdx}`,
    nextBackwardToken: `b/${pageStartIdx}`,
  };
};

const FilterLogEvents: OperationHandler = (input, ctx) => {
  const group = resolveGroupRef(input, ctx);
  const startTime = optionalNumber(input, "startTime");
  const endTime = optionalNumber(input, "endTime");
  const pattern = optionalString(input, "filterPattern");
  const limit = optionalNumber(input, "limit") ?? 10000;
  const nextToken = optionalString(input, "nextToken");
  const logStreamNamePrefix = optionalString(input, "logStreamNamePrefix");
  const rawStreamNames = input["logStreamNames"];
  const streamNames = Array.isArray(rawStreamNames)
    ? rawStreamNames.filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  if (streamNames !== undefined && logStreamNamePrefix !== undefined) {
    throw awsError(
      "InvalidParameterException",
      "logStreamNames and logStreamNamePrefix cannot be used together.",
      400,
    );
  }
  const collected: {
    logStreamName: string;
    timestamp: number;
    message: string;
    ingestionTime: number;
    eventId: string;
  }[] = [];
  for (const stream of Object.values(group.streams)) {
    if (
      streamNames !== undefined &&
      !streamNames.includes(stream.logStreamName)
    )
      continue;
    if (
      logStreamNamePrefix !== undefined &&
      !stream.logStreamName.startsWith(logStreamNamePrefix)
    )
      continue;
    for (const event of stream.events) {
      if (startTime !== undefined && event.timestamp < startTime) continue;
      if (endTime !== undefined && event.timestamp >= endTime) continue;
      if (pattern !== undefined && !matchesPattern(pattern, event.message))
        continue;
      collected.push({
        logStreamName: stream.logStreamName,
        timestamp: event.timestamp,
        message: event.message,
        ingestionTime: event.ingestionTime,
        eventId: event.eventId,
      });
    }
  }
  collected.sort((a, b) => a.timestamp - b.timestamp);
  const startIdx = nextToken !== undefined ? parseInt(nextToken, 10) || 0 : 0;
  const page = collected.slice(startIdx, startIdx + limit);
  const newNextToken =
    startIdx + limit < collected.length ? String(startIdx + limit) : undefined;
  const searched = Object.values(group.streams).map((stream) => ({
    logStreamName: stream.logStreamName,
    searchedCompletely: true,
  }));
  return {
    events: page,
    searchedLogStreams: searched,
    ...(newNextToken !== undefined ? { nextToken: newNextToken } : {}),
  };
};

const PutRetentionPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "logGroupName");
  const days = optionalNumber(input, "retentionInDays");
  if (days === undefined) {
    throw awsError(
      "InvalidParameterException",
      "retentionInDays is required.",
      400,
    );
  }
  const group = requireGroup(ctx, name);
  group.retentionInDays = days;
  ctx.store.set(name, group);
  return {};
};

const DeleteRetentionPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "logGroupName");
  const group = requireGroup(ctx, name);
  delete group.retentionInDays;
  ctx.store.set(name, group);
  return {};
};

const metricTransformationsOf = (
  input: Record<string, unknown>,
): StoredMetricTransformation[] => {
  const raw = input["metricTransformations"];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw awsError(
      "InvalidParameterException",
      "metricTransformations is required.",
      400,
    );
  }
  return raw.map((value) => {
    const entry = value as Record<string, unknown>;
    return {
      metricName: requireString(entry, "metricName"),
      metricNamespace: requireString(entry, "metricNamespace"),
      metricValue: requireString(entry, "metricValue"),
      defaultValue: optionalNumber(entry, "defaultValue"),
    };
  });
};

const PutMetricFilter: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const filterName = requireString(input, "filterName");
  const filterPattern = optionalString(input, "filterPattern") ?? "";
  requireGroup(ctx, groupName);
  const transformations = metricTransformationsOf(input);
  const key = metricFilterKey(groupName, filterName);
  const existing = ctx.store.get<StoredMetricFilter>(key);
  const filter: StoredMetricFilter = {
    filterName,
    filterPattern,
    logGroupName: groupName,
    creationTime: existing?.creationTime ?? Date.now(),
    metricTransformations: transformations,
  };
  ctx.store.set(key, filter);
  return {};
};

const metricFilterView = (
  filter: StoredMetricFilter,
): Record<string, unknown> => ({
  filterName: filter.filterName,
  filterPattern: filter.filterPattern,
  logGroupName: filter.logGroupName,
  creationTime: filter.creationTime,
  metricTransformations: filter.metricTransformations.map((transformation) => {
    const view: Record<string, unknown> = {
      metricName: transformation.metricName,
      metricNamespace: transformation.metricNamespace,
      metricValue: transformation.metricValue,
    };
    if (transformation.defaultValue !== undefined) {
      view["defaultValue"] = transformation.defaultValue;
    }
    return view;
  }),
});

const DescribeMetricFilters: OperationHandler = (input, ctx) => {
  const groupName = optionalString(input, "logGroupName");
  const namePrefix = optionalString(input, "filterNamePrefix");
  const metricName = optionalString(input, "metricName");
  const metricNamespace = optionalString(input, "metricNamespace");
  const filters = ctx.store
    .list<StoredMetricFilter>()
    .filter((entry) => entry.key.startsWith(metricFilterPrefix))
    .map((entry) => entry.value)
    .filter((filter) =>
      groupName === undefined ? true : filter.logGroupName === groupName,
    )
    .filter((filter) =>
      namePrefix === undefined
        ? true
        : filter.filterName.startsWith(namePrefix),
    )
    .filter((filter) =>
      metricName === undefined
        ? true
        : filter.metricTransformations.some(
            (transformation) => transformation.metricName === metricName,
          ),
    )
    .filter((filter) =>
      metricNamespace === undefined
        ? true
        : filter.metricTransformations.some(
            (transformation) =>
              transformation.metricNamespace === metricNamespace,
          ),
    )
    .sort((a, b) => a.filterName.localeCompare(b.filterName));
  return { metricFilters: filters.map(metricFilterView) };
};

const DeleteMetricFilter: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const filterName = requireString(input, "filterName");
  const key = metricFilterKey(groupName, filterName);
  if (ctx.store.get<StoredMetricFilter>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified metric filter does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const TagLogGroup: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const group = requireGroup(ctx, groupName);
  const rawTags = input["tags"];
  if (rawTags === null || typeof rawTags !== "object") {
    throw awsError("InvalidParameterException", "tags is required.", 400);
  }
  const tags = { ...tagsFor(ctx, group.arn) };
  for (const [tagKey, tagValue] of Object.entries(
    rawTags as Record<string, unknown>,
  )) {
    if (typeof tagValue === "string") tags[tagKey] = tagValue;
  }
  setTagsFor(ctx, group.arn, tags);
  return {};
};

const ListTagsLogGroup: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const group = requireGroup(ctx, groupName);
  return { tags: tagsFor(ctx, group.arn) };
};

const UntagLogGroup: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const group = requireGroup(ctx, groupName);
  const rawTags = input["tags"];
  const tags = { ...tagsFor(ctx, group.arn) };
  if (Array.isArray(rawTags)) {
    for (const tagKey of rawTags) {
      if (typeof tagKey === "string") delete tags[tagKey];
    }
  }
  setTagsFor(ctx, group.arn, tags);
  return {};
};

const AssociateKmsKey: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const kmsKeyId = requireString(input, "kmsKeyId");
  const group = requireGroup(ctx, groupName);
  group.kmsKeyId = kmsKeyId;
  ctx.store.set(groupName, group);
  return {};
};

const DisassociateKmsKey: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const group = requireGroup(ctx, groupName);
  delete group.kmsKeyId;
  ctx.store.set(groupName, group);
  return {};
};

const PutLogGroupDeletionProtection: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const enabled = input["deletionProtectionEnabled"];
  const group = requireGroup(ctx, groupName);
  group.deletionProtectionEnabled =
    typeof enabled === "boolean" ? enabled : false;
  ctx.store.set(groupName, group);
  return {};
};

const ListLogGroups: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "logGroupNamePrefix");
  const pattern = optionalString(input, "logGroupNamePattern");
  const groups = ctx.store
    .list<StoredGroup>()
    .filter(
      (entry) =>
        !entry.key.includes(":") && !entry.key.startsWith(metricFilterPrefix),
    )
    .map((entry) => entry.value)
    .filter(
      (v): v is StoredGroup =>
        v !== null && typeof v === "object" && "logGroupName" in v,
    )
    .filter((group) =>
      prefix === undefined ? true : group.logGroupName.startsWith(prefix),
    )
    .filter((group) =>
      pattern === undefined ? true : group.logGroupName.includes(pattern),
    )
    .sort((a, b) => a.logGroupName.localeCompare(b.logGroupName));
  return {
    logGroups: groups.map(logGroupView),
  };
};

const ListAggregateLogGroupSummaries: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredGroup>()
    .filter(
      (entry) =>
        !entry.key.includes(":") && !entry.key.startsWith(metricFilterPrefix),
    )
    .map((entry) => entry.value)
    .filter(
      (v): v is StoredGroup =>
        v !== null && typeof v === "object" && "logGroupName" in v,
    );
  return {
    logGroupSummaries: groups.map((group) => ({
      logGroupName: group.logGroupName,
      arn: group.arn,
      storedBytes: 0,
    })),
  };
};

const PutDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "destinationName");
  const targetArn = requireString(input, "targetArn");
  const roleArn = requireString(input, "roleArn");
  const key = `${destinationPrefix}${name}`;
  const existing = ctx.store.get<StoredDestination>(key);
  const dest: StoredDestination = {
    destinationName: name,
    targetArn,
    roleArn,
    arn: destinationArnOf(ctx.region, ctx.account, name),
    creationTime: existing?.creationTime ?? Date.now(),
    accessPolicy: existing?.accessPolicy,
  };
  ctx.store.set(key, dest);
  return { destination: destinationView(dest) };
};

const destinationView = (dest: StoredDestination): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    destinationName: dest.destinationName,
    targetArn: dest.targetArn,
    roleArn: dest.roleArn,
    arn: dest.arn,
    creationTime: dest.creationTime,
  };
  if (dest.accessPolicy !== undefined) {
    view["accessPolicy"] = dest.accessPolicy;
  }
  return view;
};

const PutDestinationPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "destinationName");
  const accessPolicy = requireString(input, "accessPolicy");
  const key = `${destinationPrefix}${name}`;
  const dest = ctx.store.get<StoredDestination>(key);
  if (dest === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified destination does not exist.",
      400,
    );
  }
  dest.accessPolicy = accessPolicy;
  ctx.store.set(key, dest);
  return {};
};

const DescribeDestinations: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "DestinationNamePrefix");
  const dests = ctx.store
    .list<StoredDestination>()
    .filter((entry) => entry.key.startsWith(destinationPrefix))
    .map((entry) => entry.value)
    .filter((dest) =>
      prefix === undefined ? true : dest.destinationName.startsWith(prefix),
    )
    .sort((a, b) => a.destinationName.localeCompare(b.destinationName));
  return { destinations: dests.map(destinationView) };
};

const DeleteDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "destinationName");
  const key = `${destinationPrefix}${name}`;
  if (ctx.store.get<StoredDestination>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified destination does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const PutSubscriptionFilter: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const filterName = requireString(input, "filterName");
  const filterPattern = optionalString(input, "filterPattern") ?? "";
  const destinationArn = requireString(input, "destinationArn");
  requireGroup(ctx, groupName);
  const key = subFilterKey(groupName, filterName);
  const existing = ctx.store.get<StoredSubscriptionFilter>(key);
  const filter: StoredSubscriptionFilter = {
    filterName,
    filterPattern,
    logGroupName: groupName,
    destinationArn,
    roleArn: optionalString(input, "roleArn"),
    distribution: optionalString(input, "distribution"),
    creationTime: existing?.creationTime ?? Date.now(),
  };
  ctx.store.set(key, filter);
  return {};
};

const subFilterView = (
  filter: StoredSubscriptionFilter,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    filterName: filter.filterName,
    filterPattern: filter.filterPattern,
    logGroupName: filter.logGroupName,
    destinationArn: filter.destinationArn,
    creationTime: filter.creationTime,
  };
  if (filter.roleArn !== undefined) view["roleArn"] = filter.roleArn;
  if (filter.distribution !== undefined)
    view["distribution"] = filter.distribution;
  return view;
};

const DescribeSubscriptionFilters: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const namePrefix = optionalString(input, "filterNamePrefix");
  requireGroup(ctx, groupName);
  const filters = ctx.store
    .list<StoredSubscriptionFilter>()
    .filter((entry) => entry.key.startsWith(`${subFilterPrefix}${groupName} `))
    .map((entry) => entry.value)
    .filter((filter) =>
      namePrefix === undefined
        ? true
        : filter.filterName.startsWith(namePrefix),
    )
    .sort((a, b) => a.filterName.localeCompare(b.filterName));
  return { subscriptionFilters: filters.map(subFilterView) };
};

const DeleteSubscriptionFilter: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const filterName = requireString(input, "filterName");
  const key = subFilterKey(groupName, filterName);
  if (ctx.store.get<StoredSubscriptionFilter>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified subscription filter does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const PutDeliveryDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const key = `${deliveryDstPrefix}${name}`;
  const existing = ctx.store.get<StoredDeliveryDestination>(key);
  const rawConfig = input["deliveryDestinationConfiguration"];
  const config =
    typeof rawConfig === "object" && rawConfig !== null
      ? (rawConfig as Record<string, unknown>)
      : {};
  const deliveryDestinationType =
    optionalString(input, "deliveryDestinationType") ??
    (typeof config["destinationResourceArn"] === "string" &&
    (config["destinationResourceArn"] as string).includes(":s3:")
      ? "S3"
      : "CWL");
  const dest: StoredDeliveryDestination = {
    name,
    arn: existing?.arn ?? deliveryDstArnOf(ctx.region, ctx.account, name),
    deliveryDestinationType,
    outputFormat: optionalString(input, "outputFormat"),
    deliveryDestinationConfiguration: config,
    tags: existing?.tags,
  };
  ctx.store.set(key, dest);
  return { deliveryDestination: deliveryDstView(dest) };
};

const deliveryDstView = (
  dest: StoredDeliveryDestination,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    name: dest.name,
    arn: dest.arn,
    deliveryDestinationType: dest.deliveryDestinationType,
    deliveryDestinationConfiguration: dest.deliveryDestinationConfiguration,
  };
  if (dest.outputFormat !== undefined) view["outputFormat"] = dest.outputFormat;
  if (dest.tags !== undefined) view["tags"] = dest.tags;
  return view;
};

const GetDeliveryDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const key = `${deliveryDstPrefix}${name}`;
  const dest = ctx.store.get<StoredDeliveryDestination>(key);
  if (dest === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery destination does not exist.",
      400,
    );
  }
  return { deliveryDestination: deliveryDstView(dest) };
};

const DescribeDeliveryDestinations: OperationHandler = (_input, ctx) => {
  const dests = ctx.store
    .list<StoredDeliveryDestination>()
    .filter((entry) => entry.key.startsWith(deliveryDstPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { deliveryDestinations: dests.map(deliveryDstView) };
};

const DeleteDeliveryDestination: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const key = `${deliveryDstPrefix}${name}`;
  if (ctx.store.get<StoredDeliveryDestination>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery destination does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const PutDeliveryDestinationPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "deliveryDestinationName");
  const policy = requireString(input, "deliveryDestinationPolicy");
  const key = `${deliveryDstPrefix}${name}-policy`;
  ctx.store.set(key, { policy });
  return { policy: { deliveryDestinationPolicy: policy } };
};

const GetDeliveryDestinationPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "deliveryDestinationName");
  const key = `${deliveryDstPrefix}${name}-policy`;
  const stored = ctx.store.get<{ policy: string }>(key);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery destination policy does not exist.",
      400,
    );
  }
  return { policy: { deliveryDestinationPolicy: stored.policy } };
};

const DeleteDeliveryDestinationPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "deliveryDestinationName");
  const key = `${deliveryDstPrefix}${name}-policy`;
  ctx.store.delete(key);
  return {};
};

const PutDeliverySource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const resourceArn = requireString(input, "resourceArn");
  const logType = requireString(input, "logType");
  const key = `${deliverySrcPrefix}${name}`;
  const existing = ctx.store.get<StoredDeliverySource>(key);
  const service = resourceArn.split(":")[2] ?? "unknown";
  const src: StoredDeliverySource = {
    name,
    arn: existing?.arn ?? deliverySrcArnOf(ctx.region, ctx.account, name),
    resourceArn,
    service,
    logType,
    tags: existing?.tags,
  };
  ctx.store.set(key, src);
  return { deliverySource: deliverySrcView(src) };
};

const deliverySrcView = (
  src: StoredDeliverySource,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    name: src.name,
    arn: src.arn,
    resourceArns: [src.resourceArn],
    service: src.service,
    logType: src.logType,
  };
  if (src.tags !== undefined) view["tags"] = src.tags;
  return view;
};

const GetDeliverySource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const key = `${deliverySrcPrefix}${name}`;
  const src = ctx.store.get<StoredDeliverySource>(key);
  if (src === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery source does not exist.",
      400,
    );
  }
  return { deliverySource: deliverySrcView(src) };
};

const DescribeDeliverySources: OperationHandler = (_input, ctx) => {
  const sources = ctx.store
    .list<StoredDeliverySource>()
    .filter((entry) => entry.key.startsWith(deliverySrcPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { deliverySources: sources.map(deliverySrcView) };
};

const DeleteDeliverySource: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const key = `${deliverySrcPrefix}${name}`;
  if (ctx.store.get<StoredDeliverySource>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery source does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateDelivery: OperationHandler = (input, ctx) => {
  const deliverySourceName = requireString(input, "deliverySourceName");
  const deliveryDestinationArn = requireString(input, "deliveryDestinationArn");
  const srcKey = `${deliverySrcPrefix}${deliverySourceName}`;
  const src = ctx.store.get<StoredDeliverySource>(srcKey);
  if (src === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery source does not exist.",
      400,
    );
  }
  const id = crypto.randomUUID();
  const delivery: StoredDelivery = {
    id,
    arn: deliveryArnOf(ctx.region, ctx.account, id),
    deliverySourceName,
    deliveryDestinationArn,
    deliveryDestinationType: deliveryDestinationArn.includes(":s3:")
      ? "S3"
      : "CWL",
    recordFields: Array.isArray(input["recordFields"])
      ? (input["recordFields"] as string[])
      : undefined,
    fieldDelimiter: optionalString(input, "fieldDelimiter"),
  };
  ctx.store.set(`${deliveryPrefix}${id}`, delivery);
  return { delivery: deliveryView(delivery) };
};

const deliveryView = (d: StoredDelivery): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    id: d.id,
    arn: d.arn,
    deliverySourceName: d.deliverySourceName,
    deliveryDestinationArn: d.deliveryDestinationArn,
    deliveryDestinationType: d.deliveryDestinationType,
  };
  if (d.recordFields !== undefined) view["recordFields"] = d.recordFields;
  if (d.fieldDelimiter !== undefined) view["fieldDelimiter"] = d.fieldDelimiter;
  if (d.tags !== undefined) view["tags"] = d.tags;
  return view;
};

const GetDelivery: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const delivery = ctx.store.get<StoredDelivery>(`${deliveryPrefix}${id}`);
  if (delivery === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery does not exist.",
      400,
    );
  }
  return { delivery: deliveryView(delivery) };
};

const DescribeDeliveries: OperationHandler = (_input, ctx) => {
  const deliveries = ctx.store
    .list<StoredDelivery>()
    .filter((entry) => entry.key.startsWith(deliveryPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.id.localeCompare(b.id));
  return { deliveries: deliveries.map(deliveryView) };
};

const UpdateDeliveryConfiguration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const key = `${deliveryPrefix}${id}`;
  const delivery = ctx.store.get<StoredDelivery>(key);
  if (delivery === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery does not exist.",
      400,
    );
  }
  if (Array.isArray(input["recordFields"])) {
    delivery.recordFields = input["recordFields"] as string[];
  }
  if (typeof input["fieldDelimiter"] === "string") {
    delivery.fieldDelimiter = input["fieldDelimiter"];
  }
  if (typeof input["s3DeliveryConfiguration"] === "object") {
    delivery.s3DeliveryConfiguration = input[
      "s3DeliveryConfiguration"
    ] as Record<string, unknown>;
  }
  ctx.store.set(key, delivery);
  return {};
};

const DeleteDelivery: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const key = `${deliveryPrefix}${id}`;
  if (ctx.store.get<StoredDelivery>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified delivery does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateExportTask: OperationHandler = (input, ctx) => {
  const activeTasks = ctx.store
    .list<StoredExportTask>()
    .filter((entry) => entry.key.startsWith(exportTaskPrefix))
    .map((entry) => entry.value)
    .filter(
      (task) =>
        task.status.code === "PENDING" || task.status.code === "RUNNING",
    );
  if (activeTasks.length > 0) {
    throw awsError(
      "LimitExceededException",
      "You have reached the maximum number of active export tasks.",
      400,
    );
  }
  const taskName = optionalString(input, "taskName") ?? "";
  const groupName = requireString(input, "logGroupName");
  const from = optionalNumber(input, "from") ?? 0;
  const to = optionalNumber(input, "to") ?? Date.now();
  const destination = requireString(input, "destination");
  requireGroup(ctx, groupName);
  const taskId = crypto.randomUUID();
  const task: StoredExportTask = {
    taskId,
    taskName,
    logGroupName: groupName,
    from,
    to,
    destination,
    destinationPrefix: optionalString(input, "destinationPrefix"),
    status: { code: "PENDING" },
    creationTime: Date.now(),
  };
  ctx.store.set(`${exportTaskPrefix}${taskId}`, task);
  return { taskId };
};

const exportTaskView = (task: StoredExportTask): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    taskId: task.taskId,
    taskName: task.taskName,
    logGroupName: task.logGroupName,
    from: task.from,
    to: task.to,
    destination: task.destination,
    status: task.status,
    creationTime: task.creationTime,
  };
  if (task.destinationPrefix !== undefined)
    view["destinationPrefix"] = task.destinationPrefix;
  if (task.completionTime !== undefined)
    view["completionTime"] = task.completionTime;
  return view;
};

const DescribeExportTasks: OperationHandler = (input, ctx) => {
  const taskId = optionalString(input, "taskId");
  const tasks = ctx.store
    .list<StoredExportTask>()
    .filter((entry) => entry.key.startsWith(exportTaskPrefix))
    .map((entry) => entry.value)
    .filter((task) => (taskId === undefined ? true : task.taskId === taskId))
    .sort((a, b) => a.creationTime - b.creationTime);
  for (const task of tasks) {
    if (task.status.code === "PENDING") {
      task.status = { code: "COMPLETED" };
      task.completionTime = Date.now();
      ctx.store.set(`${exportTaskPrefix}${task.taskId}`, task);
    }
  }
  return { exportTasks: tasks.map(exportTaskView) };
};

const CancelExportTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "taskId");
  const key = `${exportTaskPrefix}${taskId}`;
  const task = ctx.store.get<StoredExportTask>(key);
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified export task does not exist.",
      400,
    );
  }
  if (task.status.code !== "PENDING" && task.status.code !== "RUNNING") {
    throw awsError(
      "InvalidOperationException",
      "The specified export task is not in PENDING or RUNNING state.",
      400,
    );
  }
  task.status = { code: "CANCELLED" };
  ctx.store.set(key, task);
  return {};
};

const CreateImportTask: OperationHandler = (input, ctx) => {
  const taskName = requireString(input, "taskName");
  const groupName = requireString(input, "logGroupName");
  const cloudTrailArn = requireString(input, "cloudTrailArn");
  const startTime = optionalNumber(input, "startTime") ?? 0;
  const endTime = optionalNumber(input, "endTime") ?? Date.now();
  requireGroup(ctx, groupName);
  const taskId = crypto.randomUUID();
  const task: StoredImportTask = {
    taskId,
    taskName,
    logGroupName: groupName,
    cloudTrailArn,
    startTime,
    endTime,
    status: "ACTIVE",
    createdDate: Date.now(),
  };
  ctx.store.set(`${importTaskPrefix}${taskId}`, task);
  return { taskId };
};

const importTaskView = (task: StoredImportTask): Record<string, unknown> => ({
  taskId: task.taskId,
  taskName: task.taskName,
  logGroupName: task.logGroupName,
  cloudTrailArn: task.cloudTrailArn,
  startTime: task.startTime,
  endTime: task.endTime,
  status: task.status,
  createdDate: task.createdDate,
  importedLogBytes: task.importedLogBytes ?? 0,
  importedLogEvents: task.importedLogEvents ?? 0,
  importedLogFiles: task.importedLogFiles ?? 0,
});

const DescribeImportTasks: OperationHandler = (input, ctx) => {
  const taskId = optionalString(input, "taskId");
  const tasks = ctx.store
    .list<StoredImportTask>()
    .filter((entry) => entry.key.startsWith(importTaskPrefix))
    .map((entry) => entry.value)
    .filter((task) => (taskId === undefined ? true : task.taskId === taskId))
    .sort((a, b) => a.createdDate - b.createdDate);
  return { importTasks: tasks.map(importTaskView) };
};

const CancelImportTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "taskId");
  const key = `${importTaskPrefix}${taskId}`;
  const task = ctx.store.get<StoredImportTask>(key);
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified import task does not exist.",
      400,
    );
  }
  task.status = "CANCELLED";
  ctx.store.set(key, task);
  return {};
};

const DescribeImportTaskBatches: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "taskId");
  const key = `${importTaskPrefix}${taskId}`;
  const task = ctx.store.get<StoredImportTask>(key);
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified import task does not exist.",
      400,
    );
  }
  return {
    importTaskBatches: [
      {
        importTaskId: taskId,
        logGroupName: task.logGroupName,
        status: task.status,
        importedLogBytes: 0,
        importedLogEvents: 0,
        importedLogFiles: 0,
        startTime: task.startTime,
        endTime: task.endTime,
      },
    ],
  };
};

const CreateLogAnomalyDetector: OperationHandler = (input, ctx) => {
  const detectorName = optionalString(input, "detectorName") ?? "";
  const rawArns = input["logGroupArnList"];
  const logGroupArnList = Array.isArray(rawArns) ? (rawArns as string[]) : [];
  const id = crypto.randomUUID();
  const arn = logAnomalyArnOf(ctx.region, ctx.account, id);
  const detector: StoredLogAnomalyDetector = {
    anomalyDetectorArn: arn,
    detectorName,
    logGroupArnList,
    evaluationFrequency:
      optionalString(input, "evaluationFrequency") ?? "FIFTEEN_MIN",
    filterPattern: optionalString(input, "filterPattern"),
    anomalyDetectorStatus: "ACTIVE",
    kmsKeyId: optionalString(input, "kmsKeyId"),
    creationTimeStamp: Date.now(),
    lastModifiedTimeStamp: Date.now(),
    anomalyVisibilityTime: optionalNumber(input, "anomalyVisibilityTime"),
  };
  ctx.store.set(`${logAnomalyPrefix}${id}`, detector);
  return { anomalyDetectorArn: arn };
};

const logAnomalyView = (
  d: StoredLogAnomalyDetector,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    anomalyDetectorArn: d.anomalyDetectorArn,
    detectorName: d.detectorName,
    logGroupArnList: d.logGroupArnList,
    evaluationFrequency: d.evaluationFrequency,
    anomalyDetectorStatus: d.anomalyDetectorStatus,
    creationTimeStamp: d.creationTimeStamp,
    lastModifiedTimeStamp: d.lastModifiedTimeStamp,
  };
  if (d.filterPattern !== undefined) view["filterPattern"] = d.filterPattern;
  if (d.kmsKeyId !== undefined) view["kmsKeyId"] = d.kmsKeyId;
  if (d.anomalyVisibilityTime !== undefined)
    view["anomalyVisibilityTime"] = d.anomalyVisibilityTime;
  return view;
};

const GetLogAnomalyDetector: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "anomalyDetectorArn");
  const id = arn.split(":").pop() ?? arn;
  const detector = ctx.store.get<StoredLogAnomalyDetector>(
    `${logAnomalyPrefix}${id}`,
  );
  if (detector === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified anomaly detector does not exist.",
      400,
    );
  }
  return logAnomalyView(detector);
};

const ListLogAnomalyDetectors: OperationHandler = (input, ctx) => {
  const groupArn = optionalString(input, "filterLogGroupArn");
  const detectors = ctx.store
    .list<StoredLogAnomalyDetector>()
    .filter((entry) => entry.key.startsWith(logAnomalyPrefix))
    .map((entry) => entry.value)
    .filter((d) =>
      groupArn === undefined ? true : d.logGroupArnList.includes(groupArn),
    )
    .sort((a, b) => a.detectorName.localeCompare(b.detectorName));
  return { anomalyDetectors: detectors.map(logAnomalyView) };
};

const UpdateLogAnomalyDetector: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "anomalyDetectorArn");
  const id = arn.split(":").pop() ?? arn;
  const key = `${logAnomalyPrefix}${id}`;
  const detector = ctx.store.get<StoredLogAnomalyDetector>(key);
  if (detector === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified anomaly detector does not exist.",
      400,
    );
  }
  if (typeof input["evaluationFrequency"] === "string")
    detector.evaluationFrequency = input["evaluationFrequency"];
  if (typeof input["filterPattern"] === "string")
    detector.filterPattern = input["filterPattern"];
  if (typeof input["anomalyVisibilityTime"] === "number")
    detector.anomalyVisibilityTime = input["anomalyVisibilityTime"];
  if (typeof input["enabled"] === "boolean") {
    detector.anomalyDetectorStatus = input["enabled"] ? "ACTIVE" : "PAUSED";
  }
  detector.lastModifiedTimeStamp = Date.now();
  ctx.store.set(key, detector);
  return {};
};

const DeleteLogAnomalyDetector: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "anomalyDetectorArn");
  const id = arn.split(":").pop() ?? arn;
  const key = `${logAnomalyPrefix}${id}`;
  if (ctx.store.get<StoredLogAnomalyDetector>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified anomaly detector does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListAnomalies: OperationHandler = (input, ctx) => {
  const detectorArn = optionalString(input, "anomalyDetectorArn");
  const anomalies = ctx.store
    .list<StoredAnomaly>()
    .filter((entry) => entry.key.startsWith(anomalyPrefix))
    .map((entry) => entry.value)
    .filter((a) =>
      detectorArn === undefined ? true : a.anomalyDetectorArn === detectorArn,
    )
    .sort((a, b) => b.lastSeen - a.lastSeen);
  return {
    anomalies: anomalies.map((a) => ({
      anomalyId: a.anomalyId,
      patternId: a.patternId,
      anomalyDetectorArn: a.anomalyDetectorArn,
      patternString: a.patternString,
      active: a.active,
      state: a.state,
      histogram: a.histogram,
      logSamples: a.logSamples,
      patternTokens: a.patternTokens,
      logGroupArnList: a.logGroupArnList,
      suppressed: a.suppressed,
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      description: a.description,
      priority: a.priority,
    })),
  };
};

const UpdateAnomaly: OperationHandler = (input, ctx) => {
  const anomalyId = requireString(input, "anomalyId");
  const detectorArn = requireString(input, "anomalyDetectorArn");
  const key = `${anomalyPrefix}${anomalyId}`;
  const existing = ctx.store.get<StoredAnomaly>(key);
  if (existing !== undefined) {
    if (typeof input["suppressed"] === "boolean")
      existing.suppressed = input["suppressed"];
    if (typeof input["suppressionPeriod"] === "object") {
      existing.suppressedDate = Date.now();
    }
    ctx.store.set(key, existing);
  } else {
    const anomaly: StoredAnomaly = {
      anomalyId,
      patternId: crypto.randomUUID(),
      anomalyDetectorArn: detectorArn,
      patternString: "",
      active: true,
      state: "Active",
      histogram: {},
      logSamples: [],
      patternTokens: [],
      logGroupArnList: [],
      suppressed:
        typeof input["suppressed"] === "boolean" ? input["suppressed"] : false,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      description: "",
      priority: "MEDIUM",
    };
    ctx.store.set(key, anomaly);
  }
  return {};
};

const CreateLookupTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "lookupTableName");
  const rawS3 = input["s3Location"];
  const s3Location =
    typeof rawS3 === "object" && rawS3 !== null
      ? (rawS3 as Record<string, unknown>)
      : {};
  const id = crypto.randomUUID();
  const table: StoredLookupTable = {
    id,
    name,
    s3Location,
    status: "ACTIVE",
    createdDate: Date.now(),
  };
  ctx.store.set(`${lookupTablePrefix}${name}`, table);
  return {
    lookupTableArn: `arn:aws:logs:${ctx.region}:${ctx.account}:lookup-table:${id}`,
  };
};

const lookupTableView = (t: StoredLookupTable): Record<string, unknown> => ({
  lookupTableName: t.name,
  s3Location: t.s3Location,
  status: t.status,
  createdDate: t.createdDate,
  size: t.size ?? 0,
  lastUpdated: t.lastUpdated ?? t.createdDate,
});

const GetLookupTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "lookupTableName");
  const table = ctx.store.get<StoredLookupTable>(`${lookupTablePrefix}${name}`);
  if (table === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified lookup table does not exist.",
      400,
    );
  }
  return lookupTableView(table);
};

const DescribeLookupTables: OperationHandler = (_input, ctx) => {
  const tables = ctx.store
    .list<StoredLookupTable>()
    .filter((entry) => entry.key.startsWith(lookupTablePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { lookupTables: tables.map(lookupTableView) };
};

const UpdateLookupTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "lookupTableName");
  const key = `${lookupTablePrefix}${name}`;
  const table = ctx.store.get<StoredLookupTable>(key);
  if (table === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified lookup table does not exist.",
      400,
    );
  }
  if (typeof input["s3Location"] === "object" && input["s3Location"] !== null) {
    table.s3Location = input["s3Location"] as Record<string, unknown>;
  }
  table.modifiedDate = Date.now();
  ctx.store.set(key, table);
  return {};
};

const DeleteLookupTable: OperationHandler = (input, ctx) => {
  const name = requireString(input, "lookupTableName");
  const key = `${lookupTablePrefix}${name}`;
  if (ctx.store.get<StoredLookupTable>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified lookup table does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateScheduledQuery: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const queryString = requireString(input, "queryString");
  const scheduleConfiguration =
    typeof input["scheduleConfiguration"] === "object" &&
    input["scheduleConfiguration"] !== null
      ? (input["scheduleConfiguration"] as Record<string, unknown>)
      : {};
  const notificationConfiguration =
    typeof input["notificationConfiguration"] === "object" &&
    input["notificationConfiguration"] !== null
      ? (input["notificationConfiguration"] as Record<string, unknown>)
      : {};
  const targetConfiguration =
    typeof input["targetConfiguration"] === "object" &&
    input["targetConfiguration"] !== null
      ? (input["targetConfiguration"] as Record<string, unknown>)
      : {};
  const roleArn = requireString(input, "scheduledQueryExecutionRoleArn");
  const arn = scheduledQueryArnOf(ctx.region, ctx.account, name);
  const sq: StoredScheduledQuery = {
    arn,
    name,
    queryString,
    scheduleConfiguration,
    notificationConfiguration,
    targetConfiguration,
    scheduledQueryExecutionRoleArn: roleArn,
    errorReportConfiguration:
      typeof input["errorReportConfiguration"] === "object" &&
      input["errorReportConfiguration"] !== null
        ? (input["errorReportConfiguration"] as Record<string, unknown>)
        : undefined,
    kmsKeyId: optionalString(input, "kmsKeyId"),
    state: "ENABLED",
    creationTime: Date.now(),
    lastModificationTime: Date.now(),
  };
  ctx.store.set(`${scheduledQueryPrefix}${arn}`, sq);
  return { arn };
};

const scheduledQueryView = (
  sq: StoredScheduledQuery,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    arn: sq.arn,
    name: sq.name,
    creationTime: sq.creationTime,
    lastModificationTime: sq.lastModificationTime,
    queryString: sq.queryString,
    state: sq.state,
    scheduleConfiguration: sq.scheduleConfiguration,
    notificationConfiguration: sq.notificationConfiguration,
    scheduledQueryExecutionRoleArn: sq.scheduledQueryExecutionRoleArn,
    targetConfiguration: sq.targetConfiguration,
  };
  if (sq.errorReportConfiguration !== undefined)
    view["errorReportConfiguration"] = sq.errorReportConfiguration;
  if (sq.kmsKeyId !== undefined) view["kmsKeyId"] = sq.kmsKeyId;
  if (sq.lastRunTime !== undefined) view["lastRunTime"] = sq.lastRunTime;
  return view;
};

const GetScheduledQuery: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "scheduledQueryArn");
  const sq = ctx.store.get<StoredScheduledQuery>(
    `${scheduledQueryPrefix}${arn}`,
  );
  if (sq === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified scheduled query does not exist.",
      400,
    );
  }
  return { scheduledQuery: scheduledQueryView(sq) };
};

const ListScheduledQueries: OperationHandler = (_input, ctx) => {
  const queries = ctx.store
    .list<StoredScheduledQuery>()
    .filter((entry) => entry.key.startsWith(scheduledQueryPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { scheduledQueries: queries.map(scheduledQueryView) };
};

const UpdateScheduledQuery: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "scheduledQueryArn");
  const state = requireString(input, "state");
  const key = `${scheduledQueryPrefix}${arn}`;
  const sq = ctx.store.get<StoredScheduledQuery>(key);
  if (sq === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified scheduled query does not exist.",
      400,
    );
  }
  sq.state = state;
  sq.lastModificationTime = Date.now();
  ctx.store.set(key, sq);
  return {};
};

const DeleteScheduledQuery: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "scheduledQueryArn");
  const key = `${scheduledQueryPrefix}${arn}`;
  if (ctx.store.get<StoredScheduledQuery>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified scheduled query does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const GetScheduledQueryHistory: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "scheduledQueryArn");
  const sq = ctx.store.get<StoredScheduledQuery>(
    `${scheduledQueryPrefix}${arn}`,
  );
  if (sq === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified scheduled query does not exist.",
      400,
    );
  }
  return {
    scheduledQueryRunSummaries: [],
  };
};

const PutQueryDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const queryString = requireString(input, "queryString");
  const inputId = optionalString(input, "queryDefinitionId");
  const id = inputId ?? crypto.randomUUID();
  const key = `${queryDefPrefix}${id}`;
  const existing = ctx.store.get<StoredQueryDefinition>(key);
  const rawGroups = input["logGroupNames"];
  const logGroupNames = Array.isArray(rawGroups)
    ? (rawGroups as string[])
    : undefined;
  const def: StoredQueryDefinition = {
    queryDefinitionId: id,
    name,
    queryString,
    lastModified: Date.now(),
    logGroupNames: logGroupNames ?? existing?.logGroupNames,
  };
  ctx.store.set(key, def);
  return { queryDefinitionId: id };
};

const queryDefView = (d: StoredQueryDefinition): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    queryDefinitionId: d.queryDefinitionId,
    name: d.name,
    queryString: d.queryString,
    lastModified: d.lastModified,
  };
  if (d.logGroupNames !== undefined) view["logGroupNames"] = d.logGroupNames;
  return view;
};

const DescribeQueryDefinitions: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "queryDefinitionNamePrefix");
  const defs = ctx.store
    .list<StoredQueryDefinition>()
    .filter((entry) => entry.key.startsWith(queryDefPrefix))
    .map((entry) => entry.value)
    .filter((d) => (prefix === undefined ? true : d.name.startsWith(prefix)))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { queryDefinitions: defs.map(queryDefView) };
};

const DeleteQueryDefinition: OperationHandler = (input, ctx) => {
  const id = requireString(input, "queryDefinitionId");
  const key = `${queryDefPrefix}${id}`;
  const success = ctx.store.delete(key);
  return { success };
};

type InsightsFilterExpr =
  | { kind: "like"; field: string; pattern: string; flags: string }
  | { kind: "eq"; field: string; value: string };

type InsightsStage =
  | { type: "fields"; fields: string[] }
  | { type: "filter"; filter: InsightsFilterExpr }
  | { type: "sort"; field: string; direction: "asc" | "desc" }
  | { type: "limit"; count: number };

const parseInsightsQuery = (queryString: string): InsightsStage[] => {
  const stages: InsightsStage[] = [];
  for (const part of queryString.split("|").map((p) => p.trim())) {
    if (part.startsWith("fields ")) {
      const fields = part
        .slice("fields ".length)
        .split(",")
        .map((f) => f.trim());
      stages.push({ type: "fields", fields });
    } else if (part.startsWith("filter ")) {
      const expr = part.slice("filter ".length).trim();
      const likeM = /^([@\w]+)\s+like\s+\/(.+?)\/([gimsuy]*)$/.exec(expr);
      if (likeM) {
        stages.push({
          type: "filter",
          filter: {
            kind: "like",
            field: likeM[1]!,
            pattern: likeM[2]!,
            flags: likeM[3] ?? "",
          },
        });
      } else {
        const eqM = /^([@\w]+)\s*=\s*"([^"]*)"$/.exec(expr);
        if (eqM) {
          stages.push({
            type: "filter",
            filter: { kind: "eq", field: eqM[1]!, value: eqM[2]! },
          });
        }
      }
    } else if (part.startsWith("sort ")) {
      const m = /^([@\w]+)\s+(asc|desc)$/i.exec(
        part.slice("sort ".length).trim(),
      );
      if (m) {
        stages.push({
          type: "sort",
          field: m[1]!,
          direction: m[2]!.toLowerCase() as "asc" | "desc",
        });
      }
    } else if (part.startsWith("limit ")) {
      const n = parseInt(part.slice("limit ".length).trim(), 10);
      if (!isNaN(n)) stages.push({ type: "limit", count: n });
    }
  }
  return stages;
};

const applyInsightsQuery = (
  queryString: string,
  events: StoredEvent[],
): { field: string; value: string }[][] => {
  const stages = parseInsightsQuery(queryString);

  let rows: Record<string, string>[] = events.map((ev) => {
    const base: Record<string, string> = {
      "@timestamp": String(ev.timestamp),
      "@message": ev.message,
    };
    try {
      const parsed: unknown = JSON.parse(ev.message);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        for (const [k, v] of Object.entries(
          parsed as Record<string, unknown>,
        )) {
          if (
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
          ) {
            base[k] = String(v);
          }
        }
      }
    } catch {}
    return base;
  });

  let selectedFields: string[] | undefined;

  for (const stage of stages) {
    if (stage.type === "fields") {
      selectedFields = stage.fields;
    } else if (stage.type === "filter") {
      const { filter } = stage;
      rows = rows.filter((row) => {
        const val = row[filter.field] ?? "";
        if (filter.kind === "like") {
          return new RegExp(filter.pattern, filter.flags).test(val);
        }
        return val === filter.value;
      });
    } else if (stage.type === "sort") {
      const { field, direction } = stage;
      rows.sort((a, b) => {
        const av = a[field] ?? "";
        const bv = b[field] ?? "";
        const an = Number(av);
        const bn = Number(bv);
        if (!isNaN(an) && !isNaN(bn)) {
          return direction === "asc" ? an - bn : bn - an;
        }
        return direction === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      });
    } else if (stage.type === "limit") {
      rows = rows.slice(0, stage.count);
    }
  }

  return rows.map((row) => {
    const keys = selectedFields ?? Object.keys(row);
    return keys
      .filter((f) => f in row)
      .map((f) => ({ field: f, value: row[f]! }));
  });
};

const StartQuery: OperationHandler = (input, ctx) => {
  const queryString = requireString(input, "queryString");
  const singleName = optionalString(input, "logGroupName");
  const namesInput = input["logGroupNames"];
  const identifiersInput = input["logGroupIdentifiers"];
  const groupNames: string[] = singleName
    ? [singleName]
    : Array.isArray(namesInput)
      ? (namesInput as string[])
      : Array.isArray(identifiersInput)
        ? (identifiersInput as string[]).map(nameFromIdentifier)
        : [];
  for (const name of groupNames) {
    requireGroup(ctx, name);
  }
  const queryId = crypto.randomUUID();
  const query: StoredQuery = {
    queryId,
    queryString,
    status: "Running",
    createTime: Date.now(),
    logGroupName: groupNames[0],
    logGroupNames: groupNames,
    startTime: optionalNumber(input, "startTime"),
    endTime: optionalNumber(input, "endTime"),
    statistics: { recordsMatched: 0, recordsScanned: 0, bytesScanned: 0 },
    results: [],
  };
  ctx.store.set(`${queryPrefix}${queryId}`, query);
  return { queryId };
};

const StopQuery: OperationHandler = (input, ctx) => {
  const queryId = requireString(input, "queryId");
  const key = `${queryPrefix}${queryId}`;
  const query = ctx.store.get<StoredQuery>(key);
  if (query !== undefined) {
    query.status = "Cancelled";
    ctx.store.set(key, query);
  }
  return { success: true };
};

const GetQueryResults: OperationHandler = (input, ctx) => {
  const queryId = requireString(input, "queryId");
  const key = `${queryPrefix}${queryId}`;
  const query = ctx.store.get<StoredQuery>(key);
  if (query === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified query does not exist.",
      400,
    );
  }
  if (query.status === "Running") {
    const startMs =
      query.startTime !== undefined ? query.startTime * 1000 : undefined;
    const endMs =
      query.endTime !== undefined ? query.endTime * 1000 : undefined;
    const groupNames = query.logGroupNames ?? [];
    const candidateEvents: StoredEvent[] = [];
    let scanned = 0;
    for (const groupName of groupNames) {
      const group = ctx.store.get<StoredGroup>(groupName);
      if (group === undefined) continue;
      for (const stream of Object.values(group.streams)) {
        for (const event of stream.events) {
          scanned++;
          if (startMs !== undefined && event.timestamp < startMs) continue;
          if (endMs !== undefined && event.timestamp > endMs) continue;
          candidateEvents.push(event);
        }
      }
    }
    const results = applyInsightsQuery(query.queryString, candidateEvents);
    query.results = results;
    query.statistics = {
      recordsMatched: results.length,
      recordsScanned: scanned,
      bytesScanned: 0,
    };
    query.status = "Complete";
    ctx.store.set(key, query);
  }
  return {
    results: query.results ?? [],
    statistics: query.statistics ?? {
      recordsMatched: 0,
      recordsScanned: 0,
      bytesScanned: 0,
    },
    status: query.status,
  };
};

const DescribeQueries: OperationHandler = (input, ctx) => {
  const groupName = optionalString(input, "logGroupName");
  const status = optionalString(input, "status");
  const queries = ctx.store
    .list<StoredQuery>()
    .filter((entry) => entry.key.startsWith(queryPrefix))
    .map((entry) => entry.value)
    .filter((q) =>
      groupName === undefined ? true : q.logGroupName === groupName,
    )
    .filter((q) => (status === undefined ? true : q.status === status))
    .sort((a, b) => a.createTime - b.createTime);
  return {
    queries: queries.map((q) => ({
      queryId: q.queryId,
      queryString: q.queryString,
      status: q.status,
      createTime: q.createTime,
      logGroupName: q.logGroupName,
    })),
  };
};

const GetLogGroupFields: OperationHandler = (input, ctx) => {
  resolveGroupRef(input, ctx);
  return {
    logGroupFields: [
      { name: "@timestamp", percent: 100 },
      { name: "@message", percent: 100 },
      { name: "@logStream", percent: 100 },
    ],
  };
};

const ListLogGroupsForQuery: OperationHandler = (input, ctx) => {
  const queryId = requireString(input, "queryId");
  const query = ctx.store.get<StoredQuery>(`${queryPrefix}${queryId}`);
  if (query === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified query does not exist.",
      400,
    );
  }
  const groupNames = query.logGroupName ? [query.logGroupName] : [];
  return { logGroupNames: groupNames };
};

const GetLogRecord: OperationHandler = (_input, _ctx) => {
  return { logRecord: {} };
};

const GetLogFields: OperationHandler = (input, ctx) => {
  const groupName = optionalString(input, "logGroupName");
  if (groupName !== undefined) {
    requireGroup(ctx, groupName);
  }
  return {
    logFields: [
      { name: "@timestamp", percent: 100 },
      { name: "@message", percent: 100 },
    ],
  };
};

const GetLogObject: OperationHandler = (_input, _ctx) => {
  return {
    objectData: "",
  };
};

const PutAccountPolicy: OperationHandler = (input, ctx) => {
  const policyName = requireString(input, "policyName");
  const policyDocument = requireString(input, "policyDocument");
  const policyType = requireString(input, "policyType");
  const scope = optionalString(input, "scope") ?? "ALL";
  const key = `${accountPolicyPrefix}${policyType}:${policyName}`;
  const policy: StoredAccountPolicy = {
    policyName,
    policyDocument,
    lastUpdatedTime: Date.now(),
    policyType,
    scope,
    selectionCriteria: optionalString(input, "selectionCriteria"),
    accountId: ctx.account,
  };
  ctx.store.set(key, policy);
  return { accountPolicy: accountPolicyView(policy) };
};

const accountPolicyView = (p: StoredAccountPolicy): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    policyName: p.policyName,
    policyDocument: p.policyDocument,
    lastUpdatedTime: p.lastUpdatedTime,
    policyType: p.policyType,
    scope: p.scope,
    accountId: p.accountId,
  };
  if (p.selectionCriteria !== undefined)
    view["selectionCriteria"] = p.selectionCriteria;
  return view;
};

const DescribeAccountPolicies: OperationHandler = (input, ctx) => {
  const policyType = requireString(input, "policyType");
  const policyName = optionalString(input, "policyName");
  const policies = ctx.store
    .list<StoredAccountPolicy>()
    .filter((entry) =>
      entry.key.startsWith(`${accountPolicyPrefix}${policyType}:`),
    )
    .map((entry) => entry.value)
    .filter((p) =>
      policyName === undefined ? true : p.policyName === policyName,
    )
    .sort((a, b) => a.policyName.localeCompare(b.policyName));
  return { accountPolicies: policies.map(accountPolicyView) };
};

const DeleteAccountPolicy: OperationHandler = (input, ctx) => {
  const policyName = requireString(input, "policyName");
  const policyType = requireString(input, "policyType");
  const key = `${accountPolicyPrefix}${policyType}:${policyName}`;
  if (ctx.store.get<StoredAccountPolicy>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified account policy does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const PutDataProtectionPolicy: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const policyDocument = requireString(input, "policyDocument");
  const key = `${dpPolicyPrefix}${logGroupIdentifier}`;
  const policy: StoredDataProtectionPolicy = {
    logGroupIdentifier,
    policyDocument,
    lastUpdatedTime: Date.now(),
  };
  ctx.store.set(key, policy);
  const group = ctx.store.get<StoredGroup>(logGroupIdentifier);
  if (group !== undefined) {
    group.dataProtectionStatus = "ACTIVATED";
    ctx.store.set(logGroupIdentifier, group);
  }
  return {
    logGroupIdentifier,
    policyDocument,
    lastUpdatedTime: policy.lastUpdatedTime,
  };
};

const GetDataProtectionPolicy: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const key = `${dpPolicyPrefix}${logGroupIdentifier}`;
  const policy = ctx.store.get<StoredDataProtectionPolicy>(key);
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified data protection policy does not exist.",
      400,
    );
  }
  return {
    logGroupIdentifier: policy.logGroupIdentifier,
    policyDocument: policy.policyDocument,
    lastUpdatedTime: policy.lastUpdatedTime,
  };
};

const DeleteDataProtectionPolicy: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const key = `${dpPolicyPrefix}${logGroupIdentifier}`;
  ctx.store.delete(key);
  const group = ctx.store.get<StoredGroup>(logGroupIdentifier);
  if (group !== undefined) {
    delete group.dataProtectionStatus;
    ctx.store.set(logGroupIdentifier, group);
  }
  return {};
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const policyName = requireString(input, "policyName");
  const policyDocument = requireString(input, "policyDocument");
  const key = `${resPolicyPrefix}${policyName}`;
  const policy: StoredResourcePolicy = {
    policyName,
    policyDocument,
    lastUpdatedTime: Date.now(),
  };
  ctx.store.set(key, policy);
  return {
    resourcePolicy: {
      policyName,
      policyDocument,
      lastUpdatedTime: policy.lastUpdatedTime,
    },
  };
};

const DescribeResourcePolicies: OperationHandler = (_input, ctx) => {
  const policies = ctx.store
    .list<StoredResourcePolicy>()
    .filter((entry) => entry.key.startsWith(resPolicyPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.policyName.localeCompare(b.policyName));
  return {
    resourcePolicies: policies.map((p) => ({
      policyName: p.policyName,
      policyDocument: p.policyDocument,
      lastUpdatedTime: p.lastUpdatedTime,
    })),
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const policyName = requireString(input, "policyName");
  const key = `${resPolicyPrefix}${policyName}`;
  if (ctx.store.get<StoredResourcePolicy>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified resource policy does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const PutIndexPolicy: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const policyDocument = requireString(input, "policyDocument");
  const key = `${indexPolicyPrefix}${logGroupIdentifier}`;
  const policy: StoredIndexPolicy = {
    logGroupIdentifier,
    policyDocument,
    lastUpdateTime: Date.now(),
    policyId: crypto.randomUUID(),
    source: "ACCOUNT",
  };
  ctx.store.set(key, policy);
  return { indexPolicy: indexPolicyView(policy) };
};

const indexPolicyView = (p: StoredIndexPolicy): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    logGroupIdentifier: p.logGroupIdentifier,
    policyDocument: p.policyDocument,
    lastUpdateTime: p.lastUpdateTime,
  };
  if (p.policyId !== undefined) view["policyId"] = p.policyId;
  if (p.source !== undefined) view["source"] = p.source;
  return view;
};

const DescribeIndexPolicies: OperationHandler = (input, ctx) => {
  const rawIds = input["logGroupIdentifiers"];
  const ids = Array.isArray(rawIds) ? (rawIds as string[]) : undefined;
  const policies = ctx.store
    .list<StoredIndexPolicy>()
    .filter((entry) => entry.key.startsWith(indexPolicyPrefix))
    .map((entry) => entry.value)
    .filter((p) =>
      ids === undefined ? true : ids.includes(p.logGroupIdentifier),
    )
    .sort((a, b) => a.logGroupIdentifier.localeCompare(b.logGroupIdentifier));
  return { indexPolicies: policies.map(indexPolicyView) };
};

const DeleteIndexPolicy: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const key = `${indexPolicyPrefix}${logGroupIdentifier}`;
  if (ctx.store.get<StoredIndexPolicy>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified index policy does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DescribeFieldIndexes: OperationHandler = (input, ctx) => {
  const rawIds = input["logGroupIdentifiers"];
  const ids = Array.isArray(rawIds) ? (rawIds as string[]) : undefined;
  const policies = ctx.store
    .list<StoredIndexPolicy>()
    .filter((entry) => entry.key.startsWith(indexPolicyPrefix))
    .map((entry) => entry.value)
    .filter((p) =>
      ids === undefined ? true : ids.includes(p.logGroupIdentifier),
    );
  const fieldIndexes = policies.flatMap((p) => {
    try {
      const doc = JSON.parse(p.policyDocument) as { Fields?: string[] };
      const fields = doc.Fields ?? [];
      return fields.map((field) => ({
        logGroupIdentifier: p.logGroupIdentifier,
        fieldIndex: field,
        lastScanTime: p.lastUpdateTime,
        firstEventTime: p.lastUpdateTime,
        lastEventTime: p.lastUpdateTime,
      }));
    } catch {
      return [];
    }
  });
  return { fieldIndexes };
};

const PutIntegration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "integrationName");
  const integrationType = requireString(input, "integrationType");
  const rawConfig = input["resourceConfig"];
  const resourceConfig =
    typeof rawConfig === "object" && rawConfig !== null
      ? (rawConfig as Record<string, unknown>)
      : {};
  const key = `${integrationPrefix}${name}`;
  const integration: StoredIntegration = {
    integrationName: name,
    integrationStatus: "ACTIVE",
    integrationType,
    resourceConfig,
  };
  ctx.store.set(key, integration);
  return {
    integrationName: name,
    integrationStatus: "ACTIVE",
  };
};

const integrationView = (i: StoredIntegration): Record<string, unknown> => ({
  integrationName: i.integrationName,
  integrationStatus: i.integrationStatus,
  integrationType: i.integrationType,
});

const GetIntegration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "integrationName");
  const key = `${integrationPrefix}${name}`;
  const integration = ctx.store.get<StoredIntegration>(key);
  if (integration === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified integration does not exist.",
      400,
    );
  }
  return {
    integrationName: integration.integrationName,
    integrationStatus: integration.integrationStatus,
    integrationType: integration.integrationType,
    resourceConfig: integration.resourceConfig,
    integrationDetails: integration.integrationDetails ?? {},
  };
};

const ListIntegrations: OperationHandler = (input, ctx) => {
  const namePrefix = optionalString(input, "integrationNamePrefix");
  const typeFilter = optionalString(input, "integrationType");
  const statusFilter = optionalString(input, "integrationStatus");
  const integrations = ctx.store
    .list<StoredIntegration>()
    .filter((entry) => entry.key.startsWith(integrationPrefix))
    .map((entry) => entry.value)
    .filter((i) =>
      namePrefix === undefined
        ? true
        : i.integrationName.startsWith(namePrefix),
    )
    .filter((i) =>
      typeFilter === undefined ? true : i.integrationType === typeFilter,
    )
    .filter((i) =>
      statusFilter === undefined ? true : i.integrationStatus === statusFilter,
    )
    .sort((a, b) => a.integrationName.localeCompare(b.integrationName));
  return { integrationSummaries: integrations.map(integrationView) };
};

const DeleteIntegration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "integrationName");
  const key = `${integrationPrefix}${name}`;
  if (ctx.store.get<StoredIntegration>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified integration does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const PutTransformer: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const rawConfig = input["transformerConfig"];
  const transformerConfig = Array.isArray(rawConfig) ? rawConfig : [];
  const key = `${transformerPrefix}${logGroupIdentifier}`;
  const existing = ctx.store.get<StoredTransformer>(key);
  const transformer: StoredTransformer = {
    logGroupIdentifier,
    creationTime: existing?.creationTime ?? Date.now(),
    lastModifiedTime: Date.now(),
    transformerConfig,
  };
  ctx.store.set(key, transformer);
  return {};
};

const transformerView = (t: StoredTransformer): Record<string, unknown> => ({
  logGroupIdentifier: t.logGroupIdentifier,
  creationTime: t.creationTime,
  lastModifiedTime: t.lastModifiedTime,
  transformerConfig: t.transformerConfig,
});

const GetTransformer: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const key = `${transformerPrefix}${logGroupIdentifier}`;
  const transformer = ctx.store.get<StoredTransformer>(key);
  if (transformer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified transformer does not exist.",
      400,
    );
  }
  return transformerView(transformer);
};

const DeleteTransformer: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const key = `${transformerPrefix}${logGroupIdentifier}`;
  if (ctx.store.get<StoredTransformer>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "The specified transformer does not exist.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const TestTransformer: OperationHandler = (input, _ctx) => {
  const rawEvents = input["logEventMessages"];
  const events = Array.isArray(rawEvents) ? (rawEvents as string[]) : [];
  return {
    transformedLogs: events.map((message) => ({
      eventNumber: 1,
      eventMessage: message,
      transformedEventMessage: message,
    })),
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  requireResourceByArn(ctx, arn);
  return { tags: tagsFor(ctx, arn) };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  requireResourceByArn(ctx, arn);
  const rawTags = input["tags"];
  const existing = tagsFor(ctx, arn);
  if (typeof rawTags === "object" && rawTags !== null) {
    for (const [k, v] of Object.entries(rawTags as Record<string, unknown>)) {
      if (typeof v === "string") existing[k] = v;
    }
  }
  setTagsFor(ctx, arn, existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  requireResourceByArn(ctx, arn);
  const rawKeys = input["tagKeys"];
  const existing = tagsFor(ctx, arn);
  if (Array.isArray(rawKeys)) {
    for (const k of rawKeys) {
      if (typeof k === "string") delete existing[k];
    }
  }
  setTagsFor(ctx, arn, existing);
  return {};
};

const TestMetricFilter: OperationHandler = (input, _ctx) => {
  const filterPattern = requireString(input, "filterPattern");
  const rawEvents = input["logEventMessages"];
  const events = Array.isArray(rawEvents) ? (rawEvents as string[]) : [];
  return {
    matches: events
      .filter((msg) => msg.includes(filterPattern))
      .map((msg) => ({
        eventNumber: 1,
        eventMessage: msg,
        extractedValues: {},
      })),
  };
};

const StartLiveTail: OperationHandler = (_input, _ctx) => {
  return {};
};

const PutBearerTokenAuthentication: OperationHandler = (input, ctx) => {
  const logGroupIdentifier = requireString(input, "logGroupIdentifier");
  const token = requireString(input, "bearerToken");
  ctx.store.set(`bearer-token:${logGroupIdentifier}`, { token });
  return {};
};

const DescribeConfigurationTemplates: OperationHandler = (input, _ctx) => {
  const service = optionalString(input, "service");
  const templates = [
    {
      service: service ?? "lambda",
      logType: "APPLICATION_LOGS",
      resourceType: "AWS::Lambda::Function",
      deliveryDestinationType: "S3",
      defaultDeliveryConfigValues: {},
      allowedFields: [],
      allowedOutputFormats: ["json"],
      allowedActionForAllowVendedLogsDeliveryForResource:
        "logs:PutDeliverySource",
    },
  ];
  return { configurationTemplates: templates };
};

const AssociateSourceToS3TableIntegration: OperationHandler = (input, ctx) => {
  const integrationArn = requireString(input, "integrationArn");
  const resourceArn = requireString(input, "resourceArn");
  const key = `${s3SourcePrefix}${integrationArn}:${resourceArn}`;
  ctx.store.set(key, { integrationArn, resourceArn });
  return {};
};

const DisassociateSourceFromS3TableIntegration: OperationHandler = (
  input,
  ctx,
) => {
  const integrationArn = requireString(input, "integrationArn");
  const resourceArn = requireString(input, "resourceArn");
  const key = `${s3SourcePrefix}${integrationArn}:${resourceArn}`;
  ctx.store.delete(key);
  return {};
};

const ListSourcesForS3TableIntegration: OperationHandler = (input, ctx) => {
  const integrationArn = requireString(input, "integrationArn");
  const sources = ctx.store
    .list<{ integrationArn: string; resourceArn: string }>()
    .filter((entry) =>
      entry.key.startsWith(`${s3SourcePrefix}${integrationArn}:`),
    )
    .map((entry) => entry.value);
  return {
    sources: sources.map((s) => ({
      resourceArn: s.resourceArn,
    })),
  };
};

const logs: ServiceDefinition = {
  name: "logs",
  protocol: "json",
  operations: {
    AssociateKmsKey,
    AssociateSourceToS3TableIntegration,
    CancelExportTask,
    CancelImportTask,
    CreateDelivery,
    CreateExportTask,
    CreateImportTask,
    CreateLogAnomalyDetector,
    CreateLogGroup,
    CreateLogStream,
    CreateLookupTable,
    CreateScheduledQuery,
    DeleteAccountPolicy,
    DeleteDataProtectionPolicy,
    DeleteDelivery,
    DeleteDeliveryDestination,
    DeleteDeliveryDestinationPolicy,
    DeleteDeliverySource,
    DeleteDestination,
    DeleteIndexPolicy,
    DeleteIntegration,
    DeleteLogAnomalyDetector,
    DeleteLogGroup,
    DeleteLogStream,
    DeleteLookupTable,
    DeleteMetricFilter,
    DeleteQueryDefinition,
    DeleteResourcePolicy,
    DeleteRetentionPolicy,
    DeleteScheduledQuery,
    DeleteSubscriptionFilter,
    DeleteTransformer,
    DescribeAccountPolicies,
    DescribeConfigurationTemplates,
    DescribeDeliveries,
    DescribeDeliveryDestinations,
    DescribeDeliverySources,
    DescribeDestinations,
    DescribeExportTasks,
    DescribeFieldIndexes,
    DescribeImportTaskBatches,
    DescribeImportTasks,
    DescribeIndexPolicies,
    DescribeLogGroups,
    DescribeLogStreams,
    DescribeLookupTables,
    DescribeMetricFilters,
    DescribeQueries,
    DescribeQueryDefinitions,
    DescribeResourcePolicies,
    DescribeSubscriptionFilters,
    DisassociateKmsKey,
    DisassociateSourceFromS3TableIntegration,
    FilterLogEvents,
    GetDataProtectionPolicy,
    GetDelivery,
    GetDeliveryDestination,
    GetDeliveryDestinationPolicy,
    GetDeliverySource,
    GetIntegration,
    GetLogAnomalyDetector,
    GetLogEvents,
    GetLogFields,
    GetLogGroupFields,
    GetLogObject,
    GetLogRecord,
    GetLookupTable,
    GetQueryResults,
    GetScheduledQuery,
    GetScheduledQueryHistory,
    GetTransformer,
    ListAggregateLogGroupSummaries,
    ListAnomalies,
    ListIntegrations,
    ListLogAnomalyDetectors,
    ListLogGroups,
    ListLogGroupsForQuery,
    ListScheduledQueries,
    ListSourcesForS3TableIntegration,
    ListTagsForResource,
    ListTagsLogGroup,
    PutAccountPolicy,
    PutBearerTokenAuthentication,
    PutDataProtectionPolicy,
    PutDeliveryDestination,
    PutDeliveryDestinationPolicy,
    PutDeliverySource,
    PutDestination,
    PutDestinationPolicy,
    PutIndexPolicy,
    PutIntegration,
    PutLogEvents,
    PutLogGroupDeletionProtection,
    PutMetricFilter,
    PutQueryDefinition,
    PutResourcePolicy,
    PutRetentionPolicy,
    PutSubscriptionFilter,
    PutTransformer,
    StartLiveTail,
    StartQuery,
    StopQuery,
    TagLogGroup,
    TagResource,
    TestMetricFilter,
    TestTransformer,
    UntagLogGroup,
    UntagResource,
    UpdateAnomaly,
    UpdateDeliveryConfiguration,
    UpdateLogAnomalyDetector,
    UpdateLookupTable,
    UpdateScheduledQuery,
  },
  model,
} as const;

export default logs;
