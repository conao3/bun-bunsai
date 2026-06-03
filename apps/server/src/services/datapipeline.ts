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

type StoredPipeline = {
  pipelineId: string;
  name: string;
  uniqueId: string;
  description: string | undefined;
  fields: StoredField[];
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
  };
  ctx.store.set(pipelineKey(pipelineId), pipeline);
  return { pipelineId };
};

const ListPipelines: OperationHandler = (input, ctx) => {
  const pipelineIdList = ctx.store
    .list<StoredPipeline>()
    .map((entry) => entry.value)
    .map((pipeline) => ({ id: pipeline.pipelineId, name: pipeline.name }));
  return { pipelineIdList, hasMoreResults: false };
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

const datapipeline = {
  name: "datapipeline",
  protocol: "json",
  operations: {
    CreatePipeline,
    ListPipelines,
    DescribePipelines,
    DeletePipeline,
  },
  model,
} as const satisfies ServiceDefinition;

export default datapipeline;
