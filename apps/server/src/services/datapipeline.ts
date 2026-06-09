import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import datapipelineModel from "../../../../test/vendor/aws-models/datapipeline.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(datapipelineModel);

type StoredField = {
  key: string;
  stringValue: string | undefined;
  refValue: string | undefined;
};

type StoredPipelineObject = {
  id: string;
  name: string;
  fields: StoredField[];
};

type StoredParameterAttribute = {
  key: string;
  stringValue: string;
};

type StoredParameterObject = {
  id: string;
  attributes: StoredParameterAttribute[];
};

type StoredParameterValue = {
  id: string;
  stringValue: string;
};

type StoredTag = {
  key: string;
  value: string;
};

type StoredPipeline = {
  pipelineId: string;
  name: string;
  uniqueId: string;
  description: string | undefined;
  fields: StoredField[];
  pipelineObjects: StoredPipelineObject[];
  parameterObjects: StoredParameterObject[];
  parameterValues: StoredParameterValue[];
  tags: StoredTag[];
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("ValidationException", `${field} is a required field.`, 400);
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const pipelineKey = (id: string): string => `pipeline#${id}`;

const pipelineIdOf = (): string =>
  `df-${crypto.randomUUID().replace(/-/g, "").slice(0, 19).toUpperCase()}`;

const requirePipeline = (ctx: ServiceContext, id: string): StoredPipeline => {
  const pipeline = ctx.store.get<StoredPipeline>(pipelineKey(id));
  if (pipeline === undefined) {
    throw awsError(
      "PipelineNotFoundException",
      `Pipeline not found: ${id}`,
      400,
    );
  }
  return pipeline;
};

const parsePipelineObjects = (value: unknown): StoredPipelineObject[] => {
  if (!Array.isArray(value)) return [];
  const result: StoredPipelineObject[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const id = stringOrUndefined(obj["id"]);
    const name = stringOrUndefined(obj["name"]);
    if (!id || !name) continue;
    const fields: StoredField[] = [];
    if (Array.isArray(obj["fields"])) {
      for (const f of obj["fields"]) {
        if (typeof f !== "object" || f === null) continue;
        const field = f as Record<string, unknown>;
        const key = stringOrUndefined(field["key"]);
        if (!key) continue;
        fields.push({
          key,
          stringValue: stringOrUndefined(field["stringValue"]),
          refValue: stringOrUndefined(field["refValue"]),
        });
      }
    }
    result.push({ id, name, fields });
  }
  return result;
};

const parseParameterObjects = (value: unknown): StoredParameterObject[] => {
  if (!Array.isArray(value)) return [];
  const result: StoredParameterObject[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const id = stringOrUndefined(obj["id"]);
    if (!id) continue;
    const attributes: StoredParameterAttribute[] = [];
    if (Array.isArray(obj["attributes"])) {
      for (const a of obj["attributes"]) {
        if (typeof a !== "object" || a === null) continue;
        const attr = a as Record<string, unknown>;
        const key = stringOrUndefined(attr["key"]);
        const sv =
          typeof attr["stringValue"] === "string" ? attr["stringValue"] : "";
        if (!key) continue;
        attributes.push({ key, stringValue: sv });
      }
    }
    result.push({ id, attributes });
  }
  return result;
};

const parseParameterValues = (value: unknown): StoredParameterValue[] => {
  if (!Array.isArray(value)) return [];
  const result: StoredParameterValue[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const id = stringOrUndefined(obj["id"]);
    const sv =
      typeof obj["stringValue"] === "string" ? obj["stringValue"] : undefined;
    if (!id || sv === undefined) continue;
    result.push({ id, stringValue: sv });
  }
  return result;
};

const parseTags = (value: unknown): StoredTag[] => {
  if (!Array.isArray(value)) return [];
  const result: StoredTag[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const key = stringOrUndefined(obj["key"]);
    const val = typeof obj["value"] === "string" ? obj["value"] : undefined;
    if (!key || val === undefined) continue;
    result.push({ key, value: val });
  }
  return result;
};

const PAGE_SIZE_DEFAULT = 100;

const applyPagination = <T>(
  items: T[],
  markerKey: (item: T) => string,
  marker: string | undefined,
  limit: number,
): { page: T[]; nextMarker: string | undefined; hasMoreResults: boolean } => {
  const start =
    marker === undefined
      ? 0
      : items.findIndex((item) => markerKey(item) === marker) + 1;
  const page = items.slice(start, start + limit);
  const hasMoreResults = start + limit < items.length;
  const nextMarker = hasMoreResults
    ? markerKey(page[page.length - 1] as T)
    : undefined;
  return { page, nextMarker, hasMoreResults };
};

const CreatePipeline: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const uniqueId = requireString(input, "uniqueId");
  const existing = ctx.store
    .list<StoredPipeline>()
    .map((entry) => entry.value)
    .find(
      (pipeline) => pipeline.name === name && pipeline.uniqueId === uniqueId,
    );
  if (existing !== undefined) {
    return { pipelineId: existing.pipelineId };
  }
  const pipelineId = pipelineIdOf();
  const pipeline: StoredPipeline = {
    pipelineId,
    name,
    uniqueId,
    description: stringOrUndefined(input["description"]),
    fields: [
      { key: "@pipelineState", stringValue: "PENDING", refValue: undefined },
    ],
    pipelineObjects: [],
    parameterObjects: [],
    parameterValues: [],
    tags: [],
  };
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return { pipelineId };
};

const ListPipelines: OperationHandler = (input, ctx) => {
  const marker = stringOrUndefined(input["marker"]);
  const all = ctx.store
    .list<StoredPipeline>()
    .map((entry) => entry.value)
    .map((pipeline) => ({ id: pipeline.pipelineId, name: pipeline.name }));
  const { page, nextMarker, hasMoreResults } = applyPagination(
    all,
    (p) => p.id,
    marker,
    PAGE_SIZE_DEFAULT,
  );
  return { pipelineIdList: page, marker: nextMarker, hasMoreResults };
};

const DescribePipelines: OperationHandler = (input, ctx) => {
  const ids = stringList(input["pipelineIds"]);
  const pipelineDescriptionList = ids.map((id) => {
    const pipeline = requirePipeline(ctx, id);
    return {
      pipelineId: pipeline.pipelineId,
      name: pipeline.name,
      description: pipeline.description,
      fields: pipeline.fields,
      tags: pipeline.tags,
    };
  });
  return { pipelineDescriptionList };
};

const DeletePipeline: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  requirePipeline(ctx, pipelineId);
  ctx.store.delete(pipelineKey(pipelineId));
  return {};
};

const PutPipelineDefinition: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  pipeline.pipelineObjects = parsePipelineObjects(input["pipelineObjects"]);
  pipeline.parameterObjects = parseParameterObjects(input["parameterObjects"]);
  pipeline.parameterValues = parseParameterValues(input["parameterValues"]);
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return { validationErrors: [], validationWarnings: [], errored: false };
};

const GetPipelineDefinition: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  return {
    pipelineObjects: pipeline.pipelineObjects,
    parameterObjects: pipeline.parameterObjects,
    parameterValues: pipeline.parameterValues,
  };
};

const ValidatePipelineDefinition: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  requirePipeline(ctx, pipelineId);
  return { validationErrors: [], validationWarnings: [], errored: false };
};

const ActivatePipeline: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const stateField = pipeline.fields.find((f) => f.key === "@pipelineState");
  if (stateField) {
    stateField.stringValue = "SCHEDULED";
  }
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return {};
};

const DeactivatePipeline: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const stateField = pipeline.fields.find((f) => f.key === "@pipelineState");
  if (stateField) {
    stateField.stringValue = "DEACTIVATING";
  }
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return {};
};

type StoredSelector = {
  fieldName: string | undefined;
  operatorType: string | undefined;
  operatorValues: string[];
};

const parseSelectors = (query: unknown): StoredSelector[] => {
  if (typeof query !== "object" || query === null) return [];
  const q = query as Record<string, unknown>;
  if (!Array.isArray(q["selectors"])) return [];
  return q["selectors"].map((sel: unknown) => {
    if (typeof sel !== "object" || sel === null)
      return {
        fieldName: undefined,
        operatorType: undefined,
        operatorValues: [],
      };
    const s = sel as Record<string, unknown>;
    const op =
      typeof s["operator"] === "object" && s["operator"] !== null
        ? (s["operator"] as Record<string, unknown>)
        : {};
    return {
      fieldName: stringOrUndefined(s["fieldName"]),
      operatorType: stringOrUndefined(op["type"]),
      operatorValues: stringList(op["values"]),
    };
  });
};

const matchesSelector = (
  obj: StoredPipelineObject,
  sel: StoredSelector,
): boolean => {
  if (!sel.fieldName || !sel.operatorType) return true;
  const field = obj.fields.find((f) => f.key === sel.fieldName);
  const fieldValue = field?.stringValue ?? field?.refValue;
  if (fieldValue === undefined) return false;
  if (sel.operatorType === "EQ" || sel.operatorType === "REF_EQ") {
    return sel.operatorValues.includes(fieldValue);
  }
  return true;
};

const evaluateExpressions = (
  obj: StoredPipelineObject,
): StoredPipelineObject => {
  const allFields = obj.fields;
  const resolve = (val: string | undefined): string | undefined => {
    if (!val) return val;
    return val.replace(/#\{([^}]+)\}/g, (_match, key) => {
      const ref = allFields.find((f) => f.key === key);
      return ref?.stringValue ?? ref?.refValue ?? `#{${key}}`;
    });
  };
  return {
    ...obj,
    fields: obj.fields.map((f) => ({
      ...f,
      stringValue: resolve(f.stringValue),
      refValue: resolve(f.refValue),
    })),
  };
};

const SetStatus: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const objectIds = stringList(input["objectIds"]);
  const status = requireString(input, "status");
  for (const obj of pipeline.pipelineObjects) {
    if (!objectIds.includes(obj.id)) continue;
    const existing = obj.fields.find((f) => f.key === "@status");
    if (existing) {
      existing.stringValue = status;
    } else {
      obj.fields.push({
        key: "@status",
        stringValue: status,
        refValue: undefined,
      });
    }
  }
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return {};
};

const DescribeObjects: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const objectIds = stringList(input["objectIds"]);
  const evaluate = input["evaluateExpressions"] === true;
  const marker = stringOrUndefined(input["marker"]);
  let matched = pipeline.pipelineObjects.filter((obj) =>
    objectIds.includes(obj.id),
  );
  if (evaluate) {
    matched = matched.map(evaluateExpressions);
  }
  const { page, nextMarker, hasMoreResults } = applyPagination(
    matched,
    (obj) => obj.id,
    marker,
    PAGE_SIZE_DEFAULT,
  );
  return { pipelineObjects: page, marker: nextMarker, hasMoreResults };
};

const QueryObjects: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const selectors = parseSelectors(input["query"]);
  const limit =
    typeof input["limit"] === "number" && input["limit"] > 0
      ? input["limit"]
      : PAGE_SIZE_DEFAULT;
  const marker = stringOrUndefined(input["marker"]);
  const filtered = pipeline.pipelineObjects.filter((obj) =>
    selectors.every((sel) => matchesSelector(obj, sel)),
  );
  const { page, nextMarker, hasMoreResults } = applyPagination(
    filtered,
    (obj) => obj.id,
    marker,
    limit,
  );
  const ids = page.map((obj) => obj.id);
  return { ids, marker: nextMarker, hasMoreResults };
};

const EvaluateExpression: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  requirePipeline(ctx, pipelineId);
  const expression = requireString(input, "expression");
  return { evaluatedExpression: expression };
};

const AddTags: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const newTags = parseTags(input["tags"]);
  for (const tag of newTags) {
    const existing = pipeline.tags.find((t) => t.key === tag.key);
    if (existing) {
      existing.value = tag.value;
    } else {
      pipeline.tags.push(tag);
    }
  }
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return {};
};

const RemoveTags: OperationHandler = (input, ctx) => {
  const pipelineId = requireString(input, "pipelineId");
  const pipeline = requirePipeline(ctx, pipelineId);
  const tagKeys = stringList(input["tagKeys"]);
  pipeline.tags = pipeline.tags.filter((t) => !tagKeys.includes(t.key));
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return {};
};

const PollForTask: OperationHandler = (_input, _ctx) => {
  return { taskObject: undefined };
};

const ReportTaskProgress: OperationHandler = (_input, _ctx) => {
  return { canceled: false };
};

const ReportTaskRunnerHeartbeat: OperationHandler = (_input, _ctx) => {
  return { terminate: false };
};

const SetTaskStatus: OperationHandler = (_input, _ctx) => {
  return {};
};

const datapipeline = {
  name: "datapipeline",
  protocol: "json",
  operations: {
    CreatePipeline,
    ListPipelines,
    DescribePipelines,
    DeletePipeline,
    PutPipelineDefinition,
    GetPipelineDefinition,
    ValidatePipelineDefinition,
    ActivatePipeline,
    DeactivatePipeline,
    SetStatus,
    DescribeObjects,
    QueryObjects,
    EvaluateExpression,
    AddTags,
    RemoveTags,
    PollForTask,
    ReportTaskProgress,
    ReportTaskRunnerHeartbeat,
    SetTaskStatus,
  },
  model,
} as const satisfies ServiceDefinition;

export default datapipeline;
