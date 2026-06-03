import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import imagebuilderModel from "../../../../test/vendor/aws-models/imagebuilder.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(imagebuilderModel);

const pipelinePrefix = "pipeline:" as const;

type StoredPipeline = {
  arn: string;
  name: string;
  description: string | undefined;
  imageRecipeArn: string | undefined;
  containerRecipeArn: string | undefined;
  infrastructureConfigurationArn: string;
  distributionConfigurationArn: string | undefined;
  imageTestsConfiguration: Record<string, unknown> | undefined;
  enhancedImageMetadataEnabled: boolean | undefined;
  schedule: Record<string, unknown> | undefined;
  status: string;
  dateCreated: string;
  dateUpdated: string;
  tags: Record<string, string>;
  imageTags: Record<string, string>;
  executionRole: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const booleanOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const pipelineKey = (arn: string): string => `${pipelinePrefix}${arn}`;

const pipelineArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:image-pipeline/${name}`;

const nowIso = (): string => new Date().toISOString();

const pipelineView = (pipeline: StoredPipeline): Record<string, unknown> => ({
  arn: pipeline.arn,
  name: pipeline.name,
  description: pipeline.description,
  platform: "Linux",
  enhancedImageMetadataEnabled: pipeline.enhancedImageMetadataEnabled,
  imageRecipeArn: pipeline.imageRecipeArn,
  containerRecipeArn: pipeline.containerRecipeArn,
  infrastructureConfigurationArn: pipeline.infrastructureConfigurationArn,
  distributionConfigurationArn: pipeline.distributionConfigurationArn,
  imageTestsConfiguration: pipeline.imageTestsConfiguration,
  schedule: pipeline.schedule,
  status: pipeline.status,
  dateCreated: pipeline.dateCreated,
  dateUpdated: pipeline.dateUpdated,
  tags: pipeline.tags,
  imageTags: pipeline.imageTags,
  executionRole: pipeline.executionRole,
});

const requirePipeline = (ctx: ServiceContext, arn: string): StoredPipeline => {
  const stored = ctx.store.get<StoredPipeline>(pipelineKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image pipeline not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const CreateImagePipeline: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const imageRecipeArn = requireString(input, "imageRecipeArn");
  const infrastructureConfigurationArn = requireString(
    input,
    "infrastructureConfigurationArn",
  );
  const arn = pipelineArnOf(ctx, name);
  if (ctx.store.get<StoredPipeline>(pipelineKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Image pipeline already exists with name: ${name}.`,
      400,
    );
  }
  const now = nowIso();
  const pipeline: StoredPipeline = {
    arn,
    name,
    description: stringOrUndefined(input["description"]),
    imageRecipeArn,
    containerRecipeArn: stringOrUndefined(input["containerRecipeArn"]),
    infrastructureConfigurationArn,
    distributionConfigurationArn: stringOrUndefined(
      input["distributionConfigurationArn"],
    ),
    imageTestsConfiguration: asRecord(input["imageTestsConfiguration"]),
    enhancedImageMetadataEnabled: booleanOrUndefined(
      input["enhancedImageMetadataEnabled"],
    ),
    schedule: asRecord(input["schedule"]),
    status: stringOrUndefined(input["status"]) ?? "ENABLED",
    dateCreated: now,
    dateUpdated: now,
    tags: stringMapFrom(input["tags"]),
    imageTags: stringMapFrom(input["imageTags"]),
    executionRole: stringOrUndefined(input["executionRole"]),
  };
  ctx.store.set(pipelineKey(arn), pipeline);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    imagePipelineArn: arn,
  };
};

const GetImagePipeline: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imagePipelineArn");
  const pipeline = requirePipeline(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    imagePipeline: pipelineView(pipeline),
  };
};

const ListImagePipelines: OperationHandler = (_input, ctx) => {
  const pipelines = ctx.store
    .list<StoredPipeline>()
    .filter((entry) => entry.key.startsWith(pipelinePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    imagePipelineList: pipelines.map(pipelineView),
  };
};

const DeleteImagePipeline: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imagePipelineArn");
  requirePipeline(ctx, arn);
  ctx.store.delete(pipelineKey(arn));
  return {
    requestId: crypto.randomUUID(),
    imagePipelineArn: arn,
  };
};

const imagebuilder = {
  name: "imagebuilder",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/\/+$/, "");
    if (path === "/CreateImagePipeline" && req.method === "PUT") {
      return "CreateImagePipeline";
    }
    if (path === "/GetImagePipeline" && req.method === "GET") {
      return "GetImagePipeline";
    }
    if (path === "/ListImagePipelines" && req.method === "POST") {
      return "ListImagePipelines";
    }
    if (path === "/DeleteImagePipeline" && req.method === "DELETE") {
      return "DeleteImagePipeline";
    }
    return undefined;
  },
  operations: {
    CreateImagePipeline,
    GetImagePipeline,
    ListImagePipelines,
    DeleteImagePipeline,
  },
  model,
} as const satisfies ServiceDefinition;

export default imagebuilder;
