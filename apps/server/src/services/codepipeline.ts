import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import codePipelineModel from "../../../../test/vendor/aws-models/codepipeline.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(codePipelineModel);

type StoredPipeline = {
  declaration: Record<string, unknown>;
  version: number;
  arn: string;
  created: number;
  updated: number;
  tags: Record<string, unknown>[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const pipelineKey = (name: string): string => `pipeline:${name}`;

const pipelineArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:codepipeline:${ctx.region}:${ctx.account}:${name}`;

const pipelineName = (declaration: Record<string, unknown>): string => {
  const name = stringOrUndefined(declaration["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "pipeline.name is required.", 400);
  }
  return name;
};

const declarationView = (
  pipeline: StoredPipeline,
): Record<string, unknown> => ({
  ...pipeline.declaration,
  version: pipeline.version,
});

const summaryView = (pipeline: StoredPipeline): Record<string, unknown> => ({
  name: stringOrUndefined(pipeline.declaration["name"]),
  version: pipeline.version,
  pipelineType: stringOrUndefined(pipeline.declaration["pipelineType"]),
  executionMode: stringOrUndefined(pipeline.declaration["executionMode"]),
  created: pipeline.created,
  updated: pipeline.updated,
});

const CreatePipeline: OperationHandler = (input, ctx) => {
  const declaration = asRecord(input["pipeline"]);
  const name = pipelineName(declaration);
  if (ctx.store.get<StoredPipeline>(pipelineKey(name)) !== undefined) {
    throw awsError(
      "PipelineNameInUseException",
      `Pipeline ${name} already exists.`,
      400,
    );
  }
  const now = nowSeconds();
  const pipeline: StoredPipeline = {
    declaration,
    version: 1,
    arn: pipelineArn(ctx, name),
    created: now,
    updated: now,
    tags: asArray(input["tags"]),
  };
  ctx.store.set(pipelineKey(name), pipeline);
  return {
    pipeline: declarationView(pipeline),
    tags: pipeline.tags,
  };
};

const GetPipeline: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  const pipeline = ctx.store.get<StoredPipeline>(pipelineKey(name));
  if (pipeline === undefined) {
    throw awsError(
      "PipelineNotFoundException",
      `Pipeline ${name} not found.`,
      400,
    );
  }
  return {
    pipeline: declarationView(pipeline),
    metadata: {
      pipelineArn: pipeline.arn,
      created: pipeline.created,
      updated: pipeline.updated,
    },
  };
};

const ListPipelines: OperationHandler = (input, ctx) => {
  const pipelines = ctx.store
    .list<StoredPipeline>()
    .filter((entry) => entry.key.startsWith("pipeline:"))
    .map((entry) => entry.value)
    .sort((a, b) => {
      const an = stringOrUndefined(a.declaration["name"]) ?? "";
      const bn = stringOrUndefined(b.declaration["name"]) ?? "";
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
  return { pipelines: pipelines.map(summaryView) };
};

const UpdatePipeline: OperationHandler = (input, ctx) => {
  const declaration = asRecord(input["pipeline"]);
  const name = pipelineName(declaration);
  const existing = ctx.store.get<StoredPipeline>(pipelineKey(name));
  if (existing === undefined) {
    throw awsError(
      "PipelineNotFoundException",
      `Pipeline ${name} not found.`,
      400,
    );
  }
  const pipeline: StoredPipeline = {
    declaration,
    version: existing.version + 1,
    arn: existing.arn,
    created: existing.created,
    updated: nowSeconds(),
    tags: existing.tags,
  };
  ctx.store.set(pipelineKey(name), pipeline);
  return { pipeline: declarationView(pipeline) };
};

const DeletePipeline: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  if (ctx.store.get<StoredPipeline>(pipelineKey(name)) === undefined) {
    throw awsError(
      "PipelineNotFoundException",
      `Pipeline ${name} not found.`,
      400,
    );
  }
  ctx.store.delete(pipelineKey(name));
  return {};
};

const StartPipelineExecution: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["name"]);
  if (name === undefined) {
    throw awsError("ValidationException", "name is required.", 400);
  }
  if (ctx.store.get<StoredPipeline>(pipelineKey(name)) === undefined) {
    throw awsError(
      "PipelineNotFoundException",
      `Pipeline ${name} not found.`,
      400,
    );
  }
  return { pipelineExecutionId: crypto.randomUUID() };
};

const codepipeline = {
  name: "codepipeline",
  protocol: "json",
  operations: {
    CreatePipeline,
    GetPipeline,
    ListPipelines,
    UpdatePipeline,
    DeletePipeline,
    StartPipelineExecution,
  },
  model,
} as const satisfies ServiceDefinition;

export default codepipeline;
