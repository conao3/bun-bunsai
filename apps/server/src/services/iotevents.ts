import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ioteventsModel from "../../../../test/vendor/aws-models/iotevents.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ioteventsModel);

const inputPrefix = "input:" as const;
const detectorModelPrefix = "detectorModel:" as const;
const alarmModelPrefix = "alarmModel:" as const;
const analysisPrefix = "analysis:" as const;
const loggingKey = "logging" as const;
const tagsPrefix = "tags:" as const;

type StoredInput = {
  inputName: string;
  inputDescription: string | undefined;
  inputArn: string;
  creationTime: number;
  lastUpdateTime: number;
  status: string;
  inputDefinition: unknown;
};

type StoredDetectorModel = {
  detectorModelName: string;
  detectorModelDescription: string | undefined;
  detectorModelArn: string;
  roleArn: string;
  key: string | undefined;
  evaluationMethod: string | undefined;
  creationTime: number;
  lastUpdateTime: number;
  status: string;
  currentVersion: string;
  versions: StoredDetectorModelVersion[];
  detectorModelDefinition: unknown;
};

type StoredDetectorModelVersion = {
  detectorModelName: string;
  detectorModelVersion: string;
  detectorModelArn: string;
  roleArn: string;
  creationTime: number;
  lastUpdateTime: number;
  status: string;
  evaluationMethod: string | undefined;
};

type StoredAlarmModel = {
  alarmModelName: string;
  alarmModelDescription: string | undefined;
  alarmModelArn: string;
  roleArn: string;
  key: string | undefined;
  severity: number | undefined;
  creationTime: number;
  lastUpdateTime: number;
  status: string;
  currentVersion: string;
  versions: StoredAlarmModelVersion[];
  alarmRule: unknown;
  alarmNotification: unknown;
  alarmEventActions: unknown;
  alarmCapabilities: unknown;
};

type StoredAlarmModelVersion = {
  alarmModelName: string;
  alarmModelArn: string;
  alarmModelVersion: string;
  roleArn: string;
  creationTime: number;
  lastUpdateTime: number;
  status: string;
  statusMessage: string | undefined;
};

type StoredAnalysis = {
  analysisId: string;
  status: string;
  results: unknown[];
};

type StoredLogging = {
  roleArn: string;
  level: string;
  enabled: boolean;
  detectorDebugOptions: unknown;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const inputKey = (name: string): string => `${inputPrefix}${name}`;
const detectorModelKey = (name: string): string =>
  `${detectorModelPrefix}${name}`;
const alarmModelKey = (name: string): string => `${alarmModelPrefix}${name}`;
const analysisKey = (id: string): string => `${analysisPrefix}${id}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const inputArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:iotevents:${ctx.region}:${ctx.account}:input/${name}`;

const detectorModelArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:iotevents:${ctx.region}:${ctx.account}:detectorModel/${name}`;

const alarmModelArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:iotevents:${ctx.region}:${ctx.account}:alarmModel/${name}`;

const requireInput = (ctx: ServiceContext, name: string): StoredInput => {
  const stored = ctx.store.get<StoredInput>(inputKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Input ${name} was not found.`,
      404,
    );
  }
  return stored;
};

const requireDetectorModel = (
  ctx: ServiceContext,
  name: string,
): StoredDetectorModel => {
  const stored = ctx.store.get<StoredDetectorModel>(detectorModelKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DetectorModel ${name} was not found.`,
      404,
    );
  }
  return stored;
};

const requireAlarmModel = (
  ctx: ServiceContext,
  name: string,
): StoredAlarmModel => {
  const stored = ctx.store.get<StoredAlarmModel>(alarmModelKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AlarmModel ${name} was not found.`,
      404,
    );
  }
  return stored;
};

const requireAnalysis = (ctx: ServiceContext, id: string): StoredAnalysis => {
  const stored = ctx.store.get<StoredAnalysis>(analysisKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Analysis ${id} was not found.`,
      404,
    );
  }
  return stored;
};

const configurationView = (input: StoredInput): Record<string, unknown> => ({
  inputName: input.inputName,
  inputDescription: input.inputDescription,
  inputArn: input.inputArn,
  creationTime: input.creationTime,
  lastUpdateTime: input.lastUpdateTime,
  status: input.status,
});

const summaryView = (input: StoredInput): Record<string, unknown> => ({
  inputName: input.inputName,
  inputDescription: input.inputDescription,
  inputArn: input.inputArn,
  creationTime: input.creationTime,
  lastUpdateTime: input.lastUpdateTime,
  status: input.status,
});

const detectorModelConfigurationView = (
  dm: StoredDetectorModel,
): Record<string, unknown> => ({
  detectorModelName: dm.detectorModelName,
  detectorModelVersion: dm.currentVersion,
  detectorModelDescription: dm.detectorModelDescription,
  detectorModelArn: dm.detectorModelArn,
  roleArn: dm.roleArn,
  creationTime: dm.creationTime,
  lastUpdateTime: dm.lastUpdateTime,
  status: dm.status,
  key: dm.key,
  evaluationMethod: dm.evaluationMethod,
});

const detectorModelSummaryView = (
  dm: StoredDetectorModel,
): Record<string, unknown> => ({
  detectorModelName: dm.detectorModelName,
  detectorModelDescription: dm.detectorModelDescription,
  creationTime: dm.creationTime,
});

const alarmModelSummaryView = (
  am: StoredAlarmModel,
): Record<string, unknown> => ({
  alarmModelName: am.alarmModelName,
  alarmModelDescription: am.alarmModelDescription,
  creationTime: am.creationTime,
});

const CreateInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  const inputDefinition = data["inputDefinition"];
  if (inputDefinition === undefined || inputDefinition === null) {
    throw awsError(
      "InvalidRequestException",
      "inputDefinition is required.",
      400,
    );
  }
  const now = nowSeconds();
  const stored: StoredInput = {
    inputName,
    inputDescription: stringOrUndefined(data["inputDescription"]),
    inputArn: inputArn(ctx, inputName),
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    inputDefinition,
  };
  ctx.store.set(inputKey(inputName), stored);
  return { inputConfiguration: configurationView(stored) };
};

const DescribeInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  const stored = requireInput(ctx, inputName);
  return {
    input: {
      inputConfiguration: configurationView(stored),
      inputDefinition: stored.inputDefinition,
    },
  };
};

const UpdateInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  const stored = requireInput(ctx, inputName);
  const inputDefinition = data["inputDefinition"];
  if (inputDefinition === undefined || inputDefinition === null) {
    throw awsError(
      "InvalidRequestException",
      "inputDefinition is required.",
      400,
    );
  }
  const updated: StoredInput = {
    ...stored,
    inputDescription: stringOrUndefined(data["inputDescription"]),
    inputDefinition,
    lastUpdateTime: nowSeconds(),
  };
  ctx.store.set(inputKey(inputName), updated);
  return { inputConfiguration: configurationView(updated) };
};

const ListInputs: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const inputs = ctx.store
    .list<StoredInput>()
    .filter((entry) => entry.key.startsWith(inputPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.inputName < b.inputName ? -1 : a.inputName > b.inputName ? 1 : 0,
    );
  return { inputSummaries: inputs.slice(0, max).map(summaryView) };
};

const DeleteInput: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const inputName = requireString(data, "inputName");
  requireInput(ctx, inputName);
  ctx.store.delete(inputKey(inputName));
  return {};
};

const ListInputRoutings: OperationHandler = () => {
  return { routedResources: [] };
};

const CreateDetectorModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const detectorModelName = requireString(data, "detectorModelName");
  const roleArn = requireString(data, "roleArn");
  const detectorModelDefinition = data["detectorModelDefinition"];
  if (
    detectorModelDefinition === undefined ||
    detectorModelDefinition === null
  ) {
    throw awsError(
      "InvalidRequestException",
      "detectorModelDefinition is required.",
      400,
    );
  }
  const now = nowSeconds();
  const version = "1";
  const arn = detectorModelArn(ctx, detectorModelName);
  const versionSummary: StoredDetectorModelVersion = {
    detectorModelName,
    detectorModelVersion: version,
    detectorModelArn: arn,
    roleArn,
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    evaluationMethod: stringOrUndefined(data["evaluationMethod"]),
  };
  const stored: StoredDetectorModel = {
    detectorModelName,
    detectorModelDescription: stringOrUndefined(
      data["detectorModelDescription"],
    ),
    detectorModelArn: arn,
    roleArn,
    key: stringOrUndefined(data["key"]),
    evaluationMethod: stringOrUndefined(data["evaluationMethod"]),
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    currentVersion: version,
    versions: [versionSummary],
    detectorModelDefinition,
  };
  ctx.store.set(detectorModelKey(detectorModelName), stored);
  const tags = data["tags"];
  if (Array.isArray(tags) && tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return { detectorModelConfiguration: detectorModelConfigurationView(stored) };
};

const DescribeDetectorModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const detectorModelName = requireString(data, "detectorModelName");
  const stored = requireDetectorModel(ctx, detectorModelName);
  return {
    detectorModel: {
      detectorModelDefinition: stored.detectorModelDefinition,
      detectorModelConfiguration: detectorModelConfigurationView(stored),
    },
  };
};

const UpdateDetectorModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const detectorModelName = requireString(data, "detectorModelName");
  const roleArn = requireString(data, "roleArn");
  const stored = requireDetectorModel(ctx, detectorModelName);
  const detectorModelDefinition = data["detectorModelDefinition"];
  if (
    detectorModelDefinition === undefined ||
    detectorModelDefinition === null
  ) {
    throw awsError(
      "InvalidRequestException",
      "detectorModelDefinition is required.",
      400,
    );
  }
  const now = nowSeconds();
  const newVersion = String(stored.versions.length + 1);
  const versionSummary: StoredDetectorModelVersion = {
    detectorModelName,
    detectorModelVersion: newVersion,
    detectorModelArn: stored.detectorModelArn,
    roleArn,
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    evaluationMethod: stringOrUndefined(data["evaluationMethod"]),
  };
  const updated: StoredDetectorModel = {
    ...stored,
    detectorModelDescription: stringOrUndefined(
      data["detectorModelDescription"],
    ),
    roleArn,
    evaluationMethod: stringOrUndefined(data["evaluationMethod"]),
    lastUpdateTime: now,
    currentVersion: newVersion,
    versions: [...stored.versions, versionSummary],
    detectorModelDefinition,
  };
  ctx.store.set(detectorModelKey(detectorModelName), updated);
  return {
    detectorModelConfiguration: detectorModelConfigurationView(updated),
  };
};

const DeleteDetectorModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const detectorModelName = requireString(data, "detectorModelName");
  requireDetectorModel(ctx, detectorModelName);
  ctx.store.delete(detectorModelKey(detectorModelName));
  return {};
};

const ListDetectorModels: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const models = ctx.store
    .list<StoredDetectorModel>()
    .filter((entry) => entry.key.startsWith(detectorModelPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.detectorModelName < b.detectorModelName
        ? -1
        : a.detectorModelName > b.detectorModelName
          ? 1
          : 0,
    );
  return {
    detectorModelSummaries: models.slice(0, max).map(detectorModelSummaryView),
  };
};

const ListDetectorModelVersions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const detectorModelName = requireString(data, "detectorModelName");
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const stored = requireDetectorModel(ctx, detectorModelName);
  return {
    detectorModelVersionSummaries: stored.versions.slice(0, max),
  };
};

const StartDetectorModelAnalysis: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const detectorModelDefinition = data["detectorModelDefinition"];
  if (
    detectorModelDefinition === undefined ||
    detectorModelDefinition === null
  ) {
    throw awsError(
      "InvalidRequestException",
      "detectorModelDefinition is required.",
      400,
    );
  }
  const analysisId = `analysis-${nowSeconds()}-${Math.random().toString(36).slice(2, 8)}`;
  const stored: StoredAnalysis = {
    analysisId,
    status: "COMPLETE",
    results: [],
  };
  ctx.store.set(analysisKey(analysisId), stored);
  return { analysisId };
};

const DescribeDetectorModelAnalysis: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const analysisId = requireString(data, "analysisId");
  const stored = requireAnalysis(ctx, analysisId);
  return { status: stored.status };
};

const GetDetectorModelAnalysisResults: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const analysisId = requireString(data, "analysisId");
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const stored = requireAnalysis(ctx, analysisId);
  return { analysisResults: stored.results.slice(0, max) };
};

const CreateAlarmModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const alarmModelName = requireString(data, "alarmModelName");
  const roleArn = requireString(data, "roleArn");
  const alarmRule = data["alarmRule"];
  if (alarmRule === undefined || alarmRule === null) {
    throw awsError("InvalidRequestException", "alarmRule is required.", 400);
  }
  const now = nowSeconds();
  const version = "1";
  const arn = alarmModelArn(ctx, alarmModelName);
  const versionSummary: StoredAlarmModelVersion = {
    alarmModelName,
    alarmModelArn: arn,
    alarmModelVersion: version,
    roleArn,
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    statusMessage: undefined,
  };
  const stored: StoredAlarmModel = {
    alarmModelName,
    alarmModelDescription: stringOrUndefined(data["alarmModelDescription"]),
    alarmModelArn: arn,
    roleArn,
    key: stringOrUndefined(data["key"]),
    severity: numberOrUndefined(data["severity"]),
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    currentVersion: version,
    versions: [versionSummary],
    alarmRule,
    alarmNotification: data["alarmNotification"] ?? null,
    alarmEventActions: data["alarmEventActions"] ?? null,
    alarmCapabilities: data["alarmCapabilities"] ?? null,
  };
  ctx.store.set(alarmModelKey(alarmModelName), stored);
  const tags = data["tags"];
  if (Array.isArray(tags) && tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return {
    creationTime: now,
    alarmModelArn: arn,
    alarmModelVersion: version,
    lastUpdateTime: now,
    status: "ACTIVE",
  };
};

const DescribeAlarmModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const alarmModelName = requireString(data, "alarmModelName");
  const stored = requireAlarmModel(ctx, alarmModelName);
  return {
    creationTime: stored.creationTime,
    alarmModelArn: stored.alarmModelArn,
    alarmModelVersion: stored.currentVersion,
    lastUpdateTime: stored.lastUpdateTime,
    status: stored.status,
    statusMessage: undefined,
    alarmModelName: stored.alarmModelName,
    alarmModelDescription: stored.alarmModelDescription,
    roleArn: stored.roleArn,
    key: stored.key,
    severity: stored.severity,
    alarmRule: stored.alarmRule,
    alarmNotification: stored.alarmNotification,
    alarmEventActions: stored.alarmEventActions,
    alarmCapabilities: stored.alarmCapabilities,
  };
};

const UpdateAlarmModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const alarmModelName = requireString(data, "alarmModelName");
  const roleArn = requireString(data, "roleArn");
  const stored = requireAlarmModel(ctx, alarmModelName);
  const alarmRule = data["alarmRule"];
  if (alarmRule === undefined || alarmRule === null) {
    throw awsError("InvalidRequestException", "alarmRule is required.", 400);
  }
  const now = nowSeconds();
  const newVersion = String(stored.versions.length + 1);
  const versionSummary: StoredAlarmModelVersion = {
    alarmModelName,
    alarmModelArn: stored.alarmModelArn,
    alarmModelVersion: newVersion,
    roleArn,
    creationTime: now,
    lastUpdateTime: now,
    status: "ACTIVE",
    statusMessage: undefined,
  };
  const updated: StoredAlarmModel = {
    ...stored,
    alarmModelDescription: stringOrUndefined(data["alarmModelDescription"]),
    roleArn,
    severity: numberOrUndefined(data["severity"]),
    lastUpdateTime: now,
    currentVersion: newVersion,
    versions: [...stored.versions, versionSummary],
    alarmRule,
    alarmNotification: data["alarmNotification"] ?? stored.alarmNotification,
    alarmEventActions: data["alarmEventActions"] ?? stored.alarmEventActions,
    alarmCapabilities: data["alarmCapabilities"] ?? stored.alarmCapabilities,
  };
  ctx.store.set(alarmModelKey(alarmModelName), updated);
  return {
    creationTime: updated.creationTime,
    alarmModelArn: updated.alarmModelArn,
    alarmModelVersion: newVersion,
    lastUpdateTime: now,
    status: "ACTIVE",
  };
};

const DeleteAlarmModel: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const alarmModelName = requireString(data, "alarmModelName");
  requireAlarmModel(ctx, alarmModelName);
  ctx.store.delete(alarmModelKey(alarmModelName));
  return {};
};

const ListAlarmModels: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const models = ctx.store
    .list<StoredAlarmModel>()
    .filter((entry) => entry.key.startsWith(alarmModelPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.alarmModelName < b.alarmModelName
        ? -1
        : a.alarmModelName > b.alarmModelName
          ? 1
          : 0,
    );
  return {
    alarmModelSummaries: models.slice(0, max).map(alarmModelSummaryView),
  };
};

const ListAlarmModelVersions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const alarmModelName = requireString(data, "alarmModelName");
  const max = numberOrUndefined(data["maxResults"]) ?? 100;
  const stored = requireAlarmModel(ctx, alarmModelName);
  return {
    alarmModelVersionSummaries: stored.versions.slice(0, max),
  };
};

const PutLoggingOptions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const loggingOptions = data["loggingOptions"] as Record<string, unknown>;
  if (loggingOptions === undefined || loggingOptions === null) {
    throw awsError(
      "InvalidRequestException",
      "loggingOptions is required.",
      400,
    );
  }
  const stored: StoredLogging = {
    roleArn: requireString(loggingOptions, "roleArn"),
    level: requireString(loggingOptions, "level"),
    enabled: Boolean(loggingOptions["enabled"]),
    detectorDebugOptions: loggingOptions["detectorDebugOptions"] ?? null,
  };
  ctx.store.set(loggingKey, stored);
  return {};
};

const DescribeLoggingOptions: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<StoredLogging>(loggingKey);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Logging options not found.",
      404,
    );
  }
  return {
    loggingOptions: {
      roleArn: stored.roleArn,
      level: stored.level,
      enabled: stored.enabled,
      detectorDebugOptions: stored.detectorDebugOptions,
    },
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireString(data, "resourceArn");
  const tags = data["tags"];
  if (!Array.isArray(tags)) {
    throw awsError("InvalidRequestException", "tags is required.", 400);
  }
  const existing = ctx.store.get<unknown[]>(tagsKey(resourceArn)) ?? [];
  const existingMap = new Map<string, string>(
    existing.map((t) => {
      const tag = t as { key: string; value: string };
      return [tag.key, tag.value];
    }),
  );
  for (const t of tags) {
    const tag = t as { key: string; value: string };
    existingMap.set(tag.key, tag.value);
  }
  const merged = Array.from(existingMap.entries()).map(([key, value]) => ({
    key,
    value,
  }));
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireString(data, "resourceArn");
  const tagKeys = data["tagKeys"];
  if (!Array.isArray(tagKeys)) {
    throw awsError("InvalidRequestException", "tagKeys is required.", 400);
  }
  const existing = ctx.store.get<unknown[]>(tagsKey(resourceArn)) ?? [];
  const filtered = existing.filter((t) => {
    const tag = t as { key: string };
    return !tagKeys.includes(tag.key);
  });
  ctx.store.set(tagsKey(resourceArn), filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireString(data, "resourceArn");
  const tags = ctx.store.get<unknown[]>(tagsKey(resourceArn)) ?? [];
  return { tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const iotevents = {
  name: "iotevents",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "inputs") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateInput";
        if (req.method === "GET") return "ListInputs";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeInput";
        if (req.method === "PUT") return "UpdateInput";
        if (req.method === "DELETE") return "DeleteInput";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "input-routings") {
      if (parts.length === 1 && req.method === "POST")
        return "ListInputRoutings";
      return undefined;
    }

    if (parts[0] === "detector-models") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateDetectorModel";
        if (req.method === "GET") return "ListDetectorModels";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeDetectorModel";
        if (req.method === "POST") return "UpdateDetectorModel";
        if (req.method === "DELETE") return "DeleteDetectorModel";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "versions") {
        if (req.method === "GET") return "ListDetectorModelVersions";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "alarm-models") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateAlarmModel";
        if (req.method === "GET") return "ListAlarmModels";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeAlarmModel";
        if (req.method === "POST") return "UpdateAlarmModel";
        if (req.method === "DELETE") return "DeleteAlarmModel";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "versions") {
        if (req.method === "GET") return "ListAlarmModelVersions";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "analysis") {
      if (parts[1] === "detector-models") {
        if (parts.length === 2) {
          if (req.method === "POST") return "StartDetectorModelAnalysis";
          return undefined;
        }
        if (parts.length === 3) {
          if (req.method === "GET") return "DescribeDetectorModelAnalysis";
          return undefined;
        }
        if (parts.length === 4 && parts[3] === "results") {
          if (req.method === "GET") return "GetDetectorModelAnalysisResults";
          return undefined;
        }
      }
      return undefined;
    }

    if (parts[0] === "logging") {
      if (parts.length === 1) {
        if (req.method === "PUT") return "PutLoggingOptions";
        if (req.method === "GET") return "DescribeLoggingOptions";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts.length === 1) {
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
        if (req.method === "GET") return "ListTagsForResource";
        return undefined;
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateInput,
    DescribeInput,
    UpdateInput,
    ListInputs,
    DeleteInput,
    ListInputRoutings,
    CreateDetectorModel,
    DescribeDetectorModel,
    UpdateDetectorModel,
    DeleteDetectorModel,
    ListDetectorModels,
    ListDetectorModelVersions,
    StartDetectorModelAnalysis,
    DescribeDetectorModelAnalysis,
    GetDetectorModelAnalysisResults,
    CreateAlarmModel,
    DescribeAlarmModel,
    UpdateAlarmModel,
    DeleteAlarmModel,
    ListAlarmModels,
    ListAlarmModelVersions,
    PutLoggingOptions,
    DescribeLoggingOptions,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default iotevents;
