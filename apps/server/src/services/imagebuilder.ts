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
const componentPrefix = "component:" as const;
const componentPolicyPrefix = "component-policy:" as const;
const imageRecipePrefix = "image-recipe:" as const;
const imageRecipePolicyPrefix = "image-recipe-policy:" as const;
const containerRecipePrefix = "container-recipe:" as const;
const containerRecipePolicyPrefix = "container-recipe-policy:" as const;
const distConfigPrefix = "dist-config:" as const;
const infraConfigPrefix = "infra-config:" as const;
const tagsPrefix = "tags:" as const;
const imagePrefix = "image:" as const;
const imagePolicyPrefix = "image-policy:" as const;
const lifecyclePolicyPrefix = "lifecycle-policy:" as const;
const lifecycleExecutionPrefix = "lifecycle-execution:" as const;

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

type StoredComponent = {
  arn: string;
  name: string;
  version: string;
  description: string | undefined;
  changeDescription: string | undefined;
  type: string;
  platform: string;
  supportedOsVersions: unknown[] | undefined;
  data: string | undefined;
  uri: string | undefined;
  kmsKeyId: string | undefined;
  tags: Record<string, string>;
  dateCreated: string;
};

type StoredImageRecipe = {
  arn: string;
  name: string;
  version: string;
  description: string | undefined;
  platform: string;
  components: unknown;
  parentImage: string;
  blockDeviceMappings: unknown;
  workingDirectory: string | undefined;
  additionalInstanceConfiguration: Record<string, unknown> | undefined;
  amiTags: Record<string, string>;
  tags: Record<string, string>;
  dateCreated: string;
};

type StoredContainerRecipe = {
  arn: string;
  containerType: string;
  name: string;
  version: string;
  description: string | undefined;
  platform: string;
  components: unknown;
  instanceConfiguration: Record<string, unknown> | undefined;
  dockerfileTemplateData: string | undefined;
  kmsKeyId: string | undefined;
  parentImage: string;
  workingDirectory: string | undefined;
  targetRepository: Record<string, unknown>;
  tags: Record<string, string>;
  dateCreated: string;
};

type StoredDistributionConfig = {
  arn: string;
  name: string;
  description: string | undefined;
  distributions: unknown;
  tags: Record<string, string>;
  dateCreated: string;
  dateUpdated: string;
};

type StoredInfraConfig = {
  arn: string;
  name: string;
  description: string | undefined;
  instanceTypes: unknown;
  instanceProfileName: string;
  securityGroupIds: unknown;
  subnetId: string | undefined;
  logging: Record<string, unknown> | undefined;
  keyPair: string | undefined;
  terminateInstanceOnFailure: boolean | undefined;
  snsTopicArn: string | undefined;
  resourceTags: Record<string, string>;
  instanceMetadataOptions: Record<string, unknown> | undefined;
  placement: Record<string, unknown> | undefined;
  tags: Record<string, string>;
  dateCreated: string;
  dateUpdated: string;
};

type StoredImage = {
  arn: string;
  name: string;
  version: string;
  type: string;
  platform: string;
  osVersion: string | undefined;
  imageRecipeArn: string | undefined;
  containerRecipeArn: string | undefined;
  infrastructureConfigurationArn: string | undefined;
  distributionConfigurationArn: string | undefined;
  imageTestsConfiguration: Record<string, unknown> | undefined;
  enhancedImageMetadataEnabled: boolean | undefined;
  executionRole: string | undefined;
  pipelineArn: string | undefined;
  state: { status: string; reason?: string };
  tags: Record<string, string>;
  dateCreated: string;
};

type StoredLifecyclePolicy = {
  arn: string;
  name: string;
  description: string | undefined;
  status: string;
  executionRole: string;
  resourceType: string;
  policyDetails: unknown;
  resourceSelection: unknown;
  dateCreated: string;
  dateUpdated: string;
  tags: Record<string, string>;
};

type StoredLifecycleExecution = {
  lifecycleExecutionId: string;
  lifecyclePolicyArn: string | undefined;
  resourceArn: string;
  state: { status: string; reason?: string };
  startTime: string;
  endTime: string | undefined;
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

const arrayOrUndefined = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? value : undefined;

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

const nowIso = (): string => new Date().toISOString();

const pipelineKey = (arn: string): string => `${pipelinePrefix}${arn}`;
const componentKey = (arn: string): string => `${componentPrefix}${arn}`;
const componentPolicyKey = (arn: string): string =>
  `${componentPolicyPrefix}${arn}`;
const imageRecipeKey = (arn: string): string => `${imageRecipePrefix}${arn}`;
const imageRecipePolicyKey = (arn: string): string =>
  `${imageRecipePolicyPrefix}${arn}`;
const containerRecipeKey = (arn: string): string =>
  `${containerRecipePrefix}${arn}`;
const containerRecipePolicyKey = (arn: string): string =>
  `${containerRecipePolicyPrefix}${arn}`;
const distConfigKey = (arn: string): string => `${distConfigPrefix}${arn}`;
const infraConfigKey = (arn: string): string => `${infraConfigPrefix}${arn}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;
const imageKey = (arn: string): string => `${imagePrefix}${arn}`;
const imagePolicyKey = (arn: string): string => `${imagePolicyPrefix}${arn}`;
const lifecyclePolicyKey = (arn: string): string =>
  `${lifecyclePolicyPrefix}${arn}`;
const lifecycleExecutionKey = (id: string): string =>
  `${lifecycleExecutionPrefix}${id}`;

const pipelineArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:image-pipeline/${name}`;

const componentArnOf = (
  ctx: ServiceContext,
  name: string,
  version: string,
): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:component/${name}/${version}/1`;

const imageRecipeArnOf = (
  ctx: ServiceContext,
  name: string,
  version: string,
): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:image-recipe/${name}/${version}`;

const containerRecipeArnOf = (
  ctx: ServiceContext,
  name: string,
  version: string,
): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:container-recipe/${name}/${version}`;

const distConfigArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:distribution-configuration/${name}`;

const infraConfigArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:infrastructure-configuration/${name}`;

const imageArnOf = (
  ctx: ServiceContext,
  name: string,
  version: string,
): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:image/${name}/${version}/1`;

const imageVersionArnOf = (
  ctx: ServiceContext,
  name: string,
  version: string,
): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:image/${name}/${version}`;

const lifecyclePolicyArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:imagebuilder:${ctx.region}:${ctx.account}:lifecycle-policy/${name}`;

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

const componentView = (c: StoredComponent): Record<string, unknown> => ({
  arn: c.arn,
  name: c.name,
  version: c.version,
  description: c.description,
  changeDescription: c.changeDescription,
  type: c.type,
  platform: c.platform,
  supportedOsVersions: c.supportedOsVersions,
  data: c.data,
  kmsKeyId: c.kmsKeyId,
  dateCreated: c.dateCreated,
  tags: c.tags,
  owner: "Self",
});

const componentSummaryView = (c: StoredComponent): Record<string, unknown> => ({
  arn: c.arn,
  name: c.name,
  version: c.version,
  platform: c.platform,
  supportedOsVersions: c.supportedOsVersions,
  type: c.type,
  owner: "Self",
  description: c.description,
  changeDescription: c.changeDescription,
  dateCreated: c.dateCreated,
  tags: c.tags,
});

const componentVersionView = (c: StoredComponent): Record<string, unknown> => {
  const versionArn = c.arn.split("/").slice(0, -1).join("/");
  return {
    arn: versionArn,
    name: c.name,
    version: c.version,
    description: c.description,
    platform: c.platform,
    supportedOsVersions: c.supportedOsVersions,
    type: c.type,
    owner: "Self",
    dateCreated: c.dateCreated,
    status: "AVAILABLE",
  };
};

const imageRecipeView = (r: StoredImageRecipe): Record<string, unknown> => ({
  arn: r.arn,
  type: "AMI",
  name: r.name,
  description: r.description,
  platform: r.platform,
  owner: "Self",
  version: r.version,
  components: r.components,
  parentImage: r.parentImage,
  blockDeviceMappings: r.blockDeviceMappings,
  dateCreated: r.dateCreated,
  tags: r.tags,
  workingDirectory: r.workingDirectory,
  additionalInstanceConfiguration: r.additionalInstanceConfiguration,
  amiTags: r.amiTags,
});

const imageRecipeSummaryView = (
  r: StoredImageRecipe,
): Record<string, unknown> => ({
  arn: r.arn,
  name: r.name,
  platform: r.platform,
  owner: "Self",
  parentImage: r.parentImage,
  dateCreated: r.dateCreated,
  tags: r.tags,
});

const containerRecipeView = (
  r: StoredContainerRecipe,
): Record<string, unknown> => ({
  arn: r.arn,
  containerType: r.containerType,
  name: r.name,
  description: r.description,
  platform: r.platform,
  owner: "Self",
  version: r.version,
  components: r.components,
  instanceConfiguration: r.instanceConfiguration,
  dockerfileTemplateData: r.dockerfileTemplateData,
  kmsKeyId: r.kmsKeyId,
  parentImage: r.parentImage,
  dateCreated: r.dateCreated,
  tags: r.tags,
  workingDirectory: r.workingDirectory,
  targetRepository: r.targetRepository,
});

const containerRecipeSummaryView = (
  r: StoredContainerRecipe,
): Record<string, unknown> => ({
  arn: r.arn,
  containerType: r.containerType,
  name: r.name,
  platform: r.platform,
  owner: "Self",
  parentImage: r.parentImage,
  dateCreated: r.dateCreated,
  tags: r.tags,
});

const distConfigView = (
  d: StoredDistributionConfig,
): Record<string, unknown> => ({
  arn: d.arn,
  name: d.name,
  description: d.description,
  distributions: d.distributions,
  dateCreated: d.dateCreated,
  dateUpdated: d.dateUpdated,
  tags: d.tags,
});

const distConfigSummaryView = (
  d: StoredDistributionConfig,
): Record<string, unknown> => ({
  arn: d.arn,
  name: d.name,
  description: d.description,
  dateCreated: d.dateCreated,
  dateUpdated: d.dateUpdated,
  tags: d.tags,
});

const infraConfigView = (i: StoredInfraConfig): Record<string, unknown> => ({
  arn: i.arn,
  name: i.name,
  description: i.description,
  instanceTypes: i.instanceTypes,
  instanceProfileName: i.instanceProfileName,
  securityGroupIds: i.securityGroupIds,
  subnetId: i.subnetId,
  logging: i.logging,
  keyPair: i.keyPair,
  terminateInstanceOnFailure: i.terminateInstanceOnFailure,
  snsTopicArn: i.snsTopicArn,
  dateCreated: i.dateCreated,
  dateUpdated: i.dateUpdated,
  resourceTags: i.resourceTags,
  instanceMetadataOptions: i.instanceMetadataOptions,
  tags: i.tags,
  placement: i.placement,
});

const infraConfigSummaryView = (
  i: StoredInfraConfig,
): Record<string, unknown> => ({
  arn: i.arn,
  name: i.name,
  description: i.description,
  dateCreated: i.dateCreated,
  dateUpdated: i.dateUpdated,
  resourceTags: i.resourceTags,
  tags: i.tags,
  instanceTypes: i.instanceTypes,
  instanceProfileName: i.instanceProfileName,
  placement: i.placement,
});

const imageView = (img: StoredImage): Record<string, unknown> => ({
  arn: img.arn,
  type: img.type,
  name: img.name,
  version: img.version,
  platform: img.platform,
  osVersion: img.osVersion,
  state: img.state,
  imageRecipe: img.imageRecipeArn ? { arn: img.imageRecipeArn } : undefined,
  containerRecipe: img.containerRecipeArn
    ? { arn: img.containerRecipeArn }
    : undefined,
  infrastructureConfiguration: img.infrastructureConfigurationArn
    ? { arn: img.infrastructureConfigurationArn }
    : undefined,
  distributionConfiguration: img.distributionConfigurationArn
    ? { arn: img.distributionConfigurationArn }
    : undefined,
  imageTestsConfiguration: img.imageTestsConfiguration,
  enhancedImageMetadataEnabled: img.enhancedImageMetadataEnabled,
  executionRole: img.executionRole,
  tags: img.tags,
  dateCreated: img.dateCreated,
  buildType: "USER_INITIATED",
  imageSource: "USER_CREATED",
});

const imageSummaryView = (img: StoredImage): Record<string, unknown> => ({
  arn: img.arn,
  name: img.name,
  type: img.type,
  version: img.version,
  platform: img.platform,
  osVersion: img.osVersion,
  state: img.state,
  owner: "Self",
  dateCreated: img.dateCreated,
  tags: img.tags,
  buildType: "USER_INITIATED",
  imageSource: "USER_CREATED",
});

const imageVersionView = (img: StoredImage): Record<string, unknown> => {
  const versionArn = img.arn.split("/").slice(0, -1).join("/");
  return {
    arn: versionArn,
    name: img.name,
    type: img.type,
    version: img.version,
    platform: img.platform,
    osVersion: img.osVersion,
    owner: "Self",
    dateCreated: img.dateCreated,
    buildType: "USER_INITIATED",
    imageSource: "USER_CREATED",
  };
};

const lifecyclePolicyView = (
  p: StoredLifecyclePolicy,
): Record<string, unknown> => ({
  arn: p.arn,
  name: p.name,
  description: p.description,
  status: p.status,
  executionRole: p.executionRole,
  resourceType: p.resourceType,
  policyDetails: p.policyDetails,
  resourceSelection: p.resourceSelection,
  dateCreated: p.dateCreated,
  dateUpdated: p.dateUpdated,
  tags: p.tags,
});

const lifecyclePolicySummaryView = (
  p: StoredLifecyclePolicy,
): Record<string, unknown> => ({
  arn: p.arn,
  name: p.name,
  description: p.description,
  status: p.status,
  executionRole: p.executionRole,
  resourceType: p.resourceType,
  dateCreated: p.dateCreated,
  dateUpdated: p.dateUpdated,
  tags: p.tags,
});

const lifecycleExecutionView = (
  e: StoredLifecycleExecution,
): Record<string, unknown> => ({
  lifecycleExecutionId: e.lifecycleExecutionId,
  lifecyclePolicyArn: e.lifecyclePolicyArn,
  state: e.state,
  startTime: e.startTime,
  endTime: e.endTime,
});

const requireImage = (ctx: ServiceContext, arn: string): StoredImage => {
  const stored = ctx.store.get<StoredImage>(imageKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

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

const requireComponent = (
  ctx: ServiceContext,
  arn: string,
): StoredComponent => {
  const stored = ctx.store.get<StoredComponent>(componentKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Component not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireImageRecipe = (
  ctx: ServiceContext,
  arn: string,
): StoredImageRecipe => {
  const stored = ctx.store.get<StoredImageRecipe>(imageRecipeKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image recipe not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireContainerRecipe = (
  ctx: ServiceContext,
  arn: string,
): StoredContainerRecipe => {
  const stored = ctx.store.get<StoredContainerRecipe>(containerRecipeKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Container recipe not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireDistConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredDistributionConfig => {
  const stored = ctx.store.get<StoredDistributionConfig>(distConfigKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Distribution configuration not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireInfraConfig = (
  ctx: ServiceContext,
  arn: string,
): StoredInfraConfig => {
  const stored = ctx.store.get<StoredInfraConfig>(infraConfigKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Infrastructure configuration not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireLifecyclePolicy = (
  ctx: ServiceContext,
  arn: string,
): StoredLifecyclePolicy => {
  const stored = ctx.store.get<StoredLifecyclePolicy>(lifecyclePolicyKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Lifecycle policy not found for arn: ${arn}.`,
      404,
    );
  }
  return stored;
};

const requireLifecycleExecution = (
  ctx: ServiceContext,
  id: string,
): StoredLifecycleExecution => {
  const stored = ctx.store.get<StoredLifecycleExecution>(
    lifecycleExecutionKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Lifecycle execution not found for id: ${id}.`,
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

const CreateComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const semanticVersion = requireString(input, "semanticVersion");
  const platform = requireString(input, "platform");
  const arn = componentArnOf(ctx, name, semanticVersion);
  if (ctx.store.get<StoredComponent>(componentKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Component already exists with arn: ${arn}.`,
      400,
    );
  }
  const now = nowIso();
  const component: StoredComponent = {
    arn,
    name,
    version: semanticVersion,
    description: stringOrUndefined(input["description"]),
    changeDescription: stringOrUndefined(input["changeDescription"]),
    type: "BUILD",
    platform,
    supportedOsVersions: arrayOrUndefined(input["supportedOsVersions"]),
    data: stringOrUndefined(input["data"]),
    uri: stringOrUndefined(input["uri"]),
    kmsKeyId: stringOrUndefined(input["kmsKeyId"]),
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(componentKey(arn), component);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    componentBuildVersionArn: arn,
  };
};

const ImportComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const semanticVersion = requireString(input, "semanticVersion");
  const platform = requireString(input, "platform");
  const arn = componentArnOf(ctx, name, semanticVersion);
  if (ctx.store.get<StoredComponent>(componentKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Component already exists with arn: ${arn}.`,
      400,
    );
  }
  const now = nowIso();
  const component: StoredComponent = {
    arn,
    name,
    version: semanticVersion,
    description: stringOrUndefined(input["description"]),
    changeDescription: stringOrUndefined(input["changeDescription"]),
    type: stringOrUndefined(input["type"]) ?? "BUILD",
    platform,
    supportedOsVersions: undefined,
    data: stringOrUndefined(input["data"]),
    uri: stringOrUndefined(input["uri"]),
    kmsKeyId: stringOrUndefined(input["kmsKeyId"]),
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(componentKey(arn), component);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    componentBuildVersionArn: arn,
  };
};

const GetComponent: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "componentBuildVersionArn");
  const component = requireComponent(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    component: componentView(component),
  };
};

const DeleteComponent: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "componentBuildVersionArn");
  requireComponent(ctx, arn);
  ctx.store.delete(componentKey(arn));
  ctx.store.delete(componentPolicyKey(arn));
  return {
    requestId: crypto.randomUUID(),
    componentBuildVersionArn: arn,
  };
};

const GetComponentPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "componentArn");
  const policy = ctx.store.get<string>(componentPolicyKey(arn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found for component arn: ${arn}.`,
      404,
    );
  }
  return {
    requestId: crypto.randomUUID(),
    policy,
  };
};

const PutComponentPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "componentArn");
  const policy = requireString(input, "policy");
  ctx.store.set(componentPolicyKey(arn), policy);
  return {
    requestId: crypto.randomUUID(),
    componentArn: arn,
  };
};

const ListComponents: OperationHandler = (_input, ctx) => {
  const components = ctx.store
    .list<StoredComponent>()
    .filter((entry) => entry.key.startsWith(componentPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    componentVersionList: components.map(componentVersionView),
  };
};

const ListComponentBuildVersions: OperationHandler = (input, ctx) => {
  const versionArn = requireString(input, "componentVersionArn");
  const components = ctx.store
    .list<StoredComponent>()
    .filter((entry) => entry.key.startsWith(componentPrefix))
    .map((entry) => entry.value)
    .filter((c) => c.arn.startsWith(versionArn))
    .sort((a, b) => (a.arn < b.arn ? -1 : a.arn > b.arn ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    componentSummaryList: components.map(componentSummaryView),
  };
};

const CreateImageRecipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const semanticVersion = requireString(input, "semanticVersion");
  const parentImage = requireString(input, "parentImage");
  const arn = imageRecipeArnOf(ctx, name, semanticVersion);
  if (ctx.store.get<StoredImageRecipe>(imageRecipeKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Image recipe already exists with arn: ${arn}.`,
      400,
    );
  }
  const now = nowIso();
  const recipe: StoredImageRecipe = {
    arn,
    name,
    version: semanticVersion,
    description: stringOrUndefined(input["description"]),
    platform: "Linux",
    components: input["components"] ?? [],
    parentImage,
    blockDeviceMappings: input["blockDeviceMappings"],
    workingDirectory: stringOrUndefined(input["workingDirectory"]),
    additionalInstanceConfiguration: asRecord(
      input["additionalInstanceConfiguration"],
    ),
    amiTags: stringMapFrom(input["amiTags"]),
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(imageRecipeKey(arn), recipe);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    imageRecipeArn: arn,
  };
};

const GetImageRecipe: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageRecipeArn");
  const recipe = requireImageRecipe(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    imageRecipe: imageRecipeView(recipe),
  };
};

const DeleteImageRecipe: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageRecipeArn");
  requireImageRecipe(ctx, arn);
  ctx.store.delete(imageRecipeKey(arn));
  ctx.store.delete(imageRecipePolicyKey(arn));
  return {
    requestId: crypto.randomUUID(),
    imageRecipeArn: arn,
  };
};

const GetImageRecipePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageRecipeArn");
  const policy = ctx.store.get<string>(imageRecipePolicyKey(arn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found for image recipe arn: ${arn}.`,
      404,
    );
  }
  return {
    requestId: crypto.randomUUID(),
    policy,
  };
};

const PutImageRecipePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageRecipeArn");
  const policy = requireString(input, "policy");
  ctx.store.set(imageRecipePolicyKey(arn), policy);
  return {
    requestId: crypto.randomUUID(),
    imageRecipeArn: arn,
  };
};

const ListImageRecipes: OperationHandler = (_input, ctx) => {
  const recipes = ctx.store
    .list<StoredImageRecipe>()
    .filter((entry) => entry.key.startsWith(imageRecipePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    imageRecipeSummaryList: recipes.map(imageRecipeSummaryView),
  };
};

const CreateContainerRecipe: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const semanticVersion = requireString(input, "semanticVersion");
  const containerType = requireString(input, "containerType");
  const parentImage = requireString(input, "parentImage");
  const targetRepository =
    asRecord(input["targetRepository"]) ??
    (() => {
      throw awsError(
        "InvalidParameterException",
        "targetRepository is required.",
        400,
      );
    })();
  const arn = containerRecipeArnOf(ctx, name, semanticVersion);
  if (
    ctx.store.get<StoredContainerRecipe>(containerRecipeKey(arn)) !== undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Container recipe already exists with arn: ${arn}.`,
      400,
    );
  }
  const now = nowIso();
  const recipe: StoredContainerRecipe = {
    arn,
    containerType,
    name,
    version: semanticVersion,
    description: stringOrUndefined(input["description"]),
    platform: stringOrUndefined(input["platformOverride"]) ?? "Linux",
    components: input["components"] ?? [],
    instanceConfiguration: asRecord(input["instanceConfiguration"]),
    dockerfileTemplateData: stringOrUndefined(input["dockerfileTemplateData"]),
    kmsKeyId: stringOrUndefined(input["kmsKeyId"]),
    parentImage,
    workingDirectory: stringOrUndefined(input["workingDirectory"]),
    targetRepository,
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(containerRecipeKey(arn), recipe);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    containerRecipeArn: arn,
  };
};

const GetContainerRecipe: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "containerRecipeArn");
  const recipe = requireContainerRecipe(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    containerRecipe: containerRecipeView(recipe),
  };
};

const DeleteContainerRecipe: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "containerRecipeArn");
  requireContainerRecipe(ctx, arn);
  ctx.store.delete(containerRecipeKey(arn));
  ctx.store.delete(containerRecipePolicyKey(arn));
  return {
    requestId: crypto.randomUUID(),
    containerRecipeArn: arn,
  };
};

const GetContainerRecipePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "containerRecipeArn");
  const policy = ctx.store.get<string>(containerRecipePolicyKey(arn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found for container recipe arn: ${arn}.`,
      404,
    );
  }
  return {
    requestId: crypto.randomUUID(),
    policy,
  };
};

const PutContainerRecipePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "containerRecipeArn");
  const policy = requireString(input, "policy");
  ctx.store.set(containerRecipePolicyKey(arn), policy);
  return {
    requestId: crypto.randomUUID(),
    containerRecipeArn: arn,
  };
};

const ListContainerRecipes: OperationHandler = (_input, ctx) => {
  const recipes = ctx.store
    .list<StoredContainerRecipe>()
    .filter((entry) => entry.key.startsWith(containerRecipePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    containerRecipeSummaryList: recipes.map(containerRecipeSummaryView),
  };
};

const CreateDistributionConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const arn = distConfigArnOf(ctx, name);
  if (
    ctx.store.get<StoredDistributionConfig>(distConfigKey(arn)) !== undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Distribution configuration already exists with name: ${name}.`,
      400,
    );
  }
  const now = nowIso();
  const config: StoredDistributionConfig = {
    arn,
    name,
    description: stringOrUndefined(input["description"]),
    distributions: input["distributions"] ?? [],
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
    dateUpdated: now,
  };
  ctx.store.set(distConfigKey(arn), config);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    distributionConfigurationArn: arn,
  };
};

const GetDistributionConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "distributionConfigurationArn");
  const config = requireDistConfig(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    distributionConfiguration: distConfigView(config),
  };
};

const UpdateDistributionConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "distributionConfigurationArn");
  const config = requireDistConfig(ctx, arn);
  const updated: StoredDistributionConfig = {
    ...config,
    description: stringOrUndefined(input["description"]) ?? config.description,
    distributions: input["distributions"] ?? config.distributions,
    dateUpdated: nowIso(),
  };
  ctx.store.set(distConfigKey(arn), updated);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    distributionConfigurationArn: arn,
  };
};

const DeleteDistributionConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "distributionConfigurationArn");
  requireDistConfig(ctx, arn);
  ctx.store.delete(distConfigKey(arn));
  return {
    requestId: crypto.randomUUID(),
    distributionConfigurationArn: arn,
  };
};

const ListDistributionConfigurations: OperationHandler = (_input, ctx) => {
  const configs = ctx.store
    .list<StoredDistributionConfig>()
    .filter((entry) => entry.key.startsWith(distConfigPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    distributionConfigurationSummaryList: configs.map(distConfigSummaryView),
  };
};

const CreateInfrastructureConfiguration: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const instanceProfileName = requireString(input, "instanceProfileName");
  const arn = infraConfigArnOf(ctx, name);
  if (ctx.store.get<StoredInfraConfig>(infraConfigKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Infrastructure configuration already exists with name: ${name}.`,
      400,
    );
  }
  const now = nowIso();
  const config: StoredInfraConfig = {
    arn,
    name,
    description: stringOrUndefined(input["description"]),
    instanceTypes: input["instanceTypes"],
    instanceProfileName,
    securityGroupIds: input["securityGroupIds"],
    subnetId: stringOrUndefined(input["subnetId"]),
    logging: asRecord(input["logging"]),
    keyPair: stringOrUndefined(input["keyPair"]),
    terminateInstanceOnFailure: booleanOrUndefined(
      input["terminateInstanceOnFailure"],
    ),
    snsTopicArn: stringOrUndefined(input["snsTopicArn"]),
    resourceTags: stringMapFrom(input["resourceTags"]),
    instanceMetadataOptions: asRecord(input["instanceMetadataOptions"]),
    placement: asRecord(input["placement"]),
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
    dateUpdated: now,
  };
  ctx.store.set(infraConfigKey(arn), config);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    infrastructureConfigurationArn: arn,
  };
};

const GetInfrastructureConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "infrastructureConfigurationArn");
  const config = requireInfraConfig(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    infrastructureConfiguration: infraConfigView(config),
  };
};

const UpdateInfrastructureConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "infrastructureConfigurationArn");
  const config = requireInfraConfig(ctx, arn);
  const updated: StoredInfraConfig = {
    ...config,
    description: stringOrUndefined(input["description"]) ?? config.description,
    instanceTypes:
      input["instanceTypes"] !== undefined
        ? input["instanceTypes"]
        : config.instanceTypes,
    instanceProfileName:
      stringOrUndefined(input["instanceProfileName"]) ??
      config.instanceProfileName,
    securityGroupIds:
      input["securityGroupIds"] !== undefined
        ? input["securityGroupIds"]
        : config.securityGroupIds,
    subnetId: stringOrUndefined(input["subnetId"]) ?? config.subnetId,
    logging: asRecord(input["logging"]) ?? config.logging,
    keyPair: stringOrUndefined(input["keyPair"]) ?? config.keyPair,
    terminateInstanceOnFailure:
      booleanOrUndefined(input["terminateInstanceOnFailure"]) ??
      config.terminateInstanceOnFailure,
    snsTopicArn: stringOrUndefined(input["snsTopicArn"]) ?? config.snsTopicArn,
    resourceTags:
      input["resourceTags"] !== undefined
        ? stringMapFrom(input["resourceTags"])
        : config.resourceTags,
    instanceMetadataOptions:
      asRecord(input["instanceMetadataOptions"]) ??
      config.instanceMetadataOptions,
    placement: asRecord(input["placement"]) ?? config.placement,
    dateUpdated: nowIso(),
  };
  ctx.store.set(infraConfigKey(arn), updated);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    infrastructureConfigurationArn: arn,
  };
};

const DeleteInfrastructureConfiguration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "infrastructureConfigurationArn");
  requireInfraConfig(ctx, arn);
  ctx.store.delete(infraConfigKey(arn));
  return {
    requestId: crypto.randomUUID(),
    infrastructureConfigurationArn: arn,
  };
};

const ListInfrastructureConfigurations: OperationHandler = (_input, ctx) => {
  const configs = ctx.store
    .list<StoredInfraConfig>()
    .filter((entry) => entry.key.startsWith(infraConfigPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    infrastructureConfigurationSummaryList: configs.map(infraConfigSummaryView),
  };
};

const CreateImage: OperationHandler = (input, ctx) => {
  const imageRecipeArn = stringOrUndefined(input["imageRecipeArn"]);
  const containerRecipeArn = stringOrUndefined(input["containerRecipeArn"]);
  const infrastructureConfigurationArn = requireString(
    input,
    "infrastructureConfigurationArn",
  );
  let name: string;
  let version: string;
  let type: string;
  if (imageRecipeArn) {
    const parts = imageRecipeArn.split("/");
    name = parts[parts.length - 2] ?? "image";
    version = parts[parts.length - 1] ?? "1.0.0";
    type = "AMI";
  } else if (containerRecipeArn) {
    const parts = containerRecipeArn.split("/");
    name = parts[parts.length - 2] ?? "image";
    version = parts[parts.length - 1] ?? "1.0.0";
    type = "DOCKER";
  } else {
    throw awsError(
      "InvalidParameterException",
      "imageRecipeArn or containerRecipeArn is required.",
      400,
    );
  }
  const arn = imageArnOf(ctx, name, version);
  const now = nowIso();
  const image: StoredImage = {
    arn,
    name,
    version,
    type,
    platform: "Linux",
    osVersion: undefined,
    imageRecipeArn,
    containerRecipeArn,
    infrastructureConfigurationArn,
    distributionConfigurationArn: stringOrUndefined(
      input["distributionConfigurationArn"],
    ),
    imageTestsConfiguration: asRecord(input["imageTestsConfiguration"]),
    enhancedImageMetadataEnabled: booleanOrUndefined(
      input["enhancedImageMetadataEnabled"],
    ),
    executionRole: stringOrUndefined(input["executionRole"]),
    state: { status: "BUILDING" },
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(imageKey(arn), image);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    imageBuildVersionArn: arn,
  };
};

const GetImage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageBuildVersionArn");
  const image = requireImage(ctx, arn);
  return {
    requestId: crypto.randomUUID(),
    image: imageView(image),
  };
};

const DeleteImage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageBuildVersionArn");
  requireImage(ctx, arn);
  ctx.store.delete(imageKey(arn));
  return {
    requestId: crypto.randomUUID(),
    imageBuildVersionArn: arn,
  };
};

const ListImages: OperationHandler = (_input, ctx) => {
  const images = ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith(imagePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    requestId: crypto.randomUUID(),
    imageVersionList: images.map(imageVersionView),
  };
};

const GetImagePolicy: OperationHandler = (input, ctx) => {
  const imageArn = requireString(input, "imageArn");
  const policy = ctx.store.get<string>(imagePolicyKey(imageArn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found for image arn: ${imageArn}.`,
      404,
    );
  }
  return {
    requestId: crypto.randomUUID(),
    policy,
  };
};

const PutImagePolicy: OperationHandler = (input, ctx) => {
  const imageArn = requireString(input, "imageArn");
  const policy = requireString(input, "policy");
  ctx.store.set(imagePolicyKey(imageArn), policy);
  return {
    requestId: crypto.randomUUID(),
    imageArn,
  };
};

const CancelImageCreation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageBuildVersionArn");
  const image = requireImage(ctx, arn);
  const updated: StoredImage = { ...image, state: { status: "CANCELLED" } };
  ctx.store.set(imageKey(arn), updated);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    imageBuildVersionArn: arn,
  };
};

const DistributeImage: OperationHandler = (input, ctx) => {
  const sourceImage = requireString(input, "sourceImage");
  const distributionConfigurationArn = requireString(
    input,
    "distributionConfigurationArn",
  );
  const sourceParts = sourceImage.split("/");
  const name =
    sourceParts.length >= 2
      ? (sourceParts[sourceParts.length - 2] ?? "distributed")
      : "distributed";
  const version =
    sourceParts.length >= 2
      ? (sourceParts[sourceParts.length - 1] ?? "1.0.0")
      : "1.0.0";
  const arn = imageArnOf(ctx, name, version);
  const now = nowIso();
  const image: StoredImage = {
    arn,
    name,
    version,
    type: "AMI",
    platform: "Linux",
    osVersion: undefined,
    imageRecipeArn: undefined,
    containerRecipeArn: undefined,
    infrastructureConfigurationArn: undefined,
    distributionConfigurationArn,
    imageTestsConfiguration: undefined,
    enhancedImageMetadataEnabled: undefined,
    executionRole: stringOrUndefined(input["executionRole"]),
    state: { status: "DISTRIBUTING" },
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(imageKey(arn), image);
  return {
    clientToken: stringOrUndefined(input["clientToken"]),
    imageBuildVersionArn: arn,
  };
};

const RetryImage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imageBuildVersionArn");
  const image = requireImage(ctx, arn);
  const updated: StoredImage = { ...image, state: { status: "BUILDING" } };
  ctx.store.set(imageKey(arn), updated);
  return {
    clientToken: stringOrUndefined(input["clientToken"]),
    imageBuildVersionArn: arn,
  };
};

const ImportDiskImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const semanticVersion = requireString(input, "semanticVersion");
  const platform = requireString(input, "platform");
  const infrastructureConfigurationArn = requireString(
    input,
    "infrastructureConfigurationArn",
  );
  const arn = imageArnOf(ctx, name, semanticVersion);
  const now = nowIso();
  const image: StoredImage = {
    arn,
    name,
    version: semanticVersion,
    type: "AMI",
    platform,
    osVersion: stringOrUndefined(input["osVersion"]),
    imageRecipeArn: undefined,
    containerRecipeArn: undefined,
    infrastructureConfigurationArn,
    distributionConfigurationArn: undefined,
    imageTestsConfiguration: undefined,
    enhancedImageMetadataEnabled: undefined,
    executionRole: stringOrUndefined(input["executionRole"]),
    state: { status: "IMPORTING" },
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(imageKey(arn), image);
  return {
    clientToken: stringOrUndefined(input["clientToken"]),
    imageBuildVersionArn: arn,
  };
};

const ImportVmImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const semanticVersion = requireString(input, "semanticVersion");
  const platform = requireString(input, "platform");
  const arn = imageArnOf(ctx, name, semanticVersion);
  const versionArn = imageVersionArnOf(ctx, name, semanticVersion);
  const now = nowIso();
  const image: StoredImage = {
    arn,
    name,
    version: semanticVersion,
    type: "AMI",
    platform,
    osVersion: stringOrUndefined(input["osVersion"]),
    imageRecipeArn: undefined,
    containerRecipeArn: undefined,
    infrastructureConfigurationArn: undefined,
    distributionConfigurationArn: undefined,
    imageTestsConfiguration: undefined,
    enhancedImageMetadataEnabled: undefined,
    executionRole: undefined,
    state: { status: "IMPORTING" },
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(imageKey(arn), image);
  return {
    requestId: crypto.randomUUID(),
    imageArn: versionArn,
    clientToken: stringOrUndefined(input["clientToken"]),
  };
};

const ListImageBuildVersions: OperationHandler = (input, ctx) => {
  const imageVersionArn = requireString(input, "imageVersionArn");
  const images = ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith(imagePrefix))
    .map((entry) => entry.value)
    .filter((img) => {
      const versionArn = img.arn.split("/").slice(0, -1).join("/");
      return versionArn === imageVersionArn;
    })
    .sort((a, b) =>
      a.dateCreated < b.dateCreated
        ? -1
        : a.dateCreated > b.dateCreated
          ? 1
          : 0,
    );
  return {
    requestId: crypto.randomUUID(),
    imageSummaryList: images.map(imageSummaryView),
  };
};

const ListImagePackages: OperationHandler = (input, ctx) => {
  const imageBuildVersionArn = requireString(input, "imageBuildVersionArn");
  requireImage(ctx, imageBuildVersionArn);
  return {
    requestId: crypto.randomUUID(),
    imagePackageList: [],
  };
};

const CreateLifecyclePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const executionRole = requireString(input, "executionRole");
  const resourceType = requireString(input, "resourceType");
  const arn = lifecyclePolicyArnOf(ctx, name);
  if (
    ctx.store.get<StoredLifecyclePolicy>(lifecyclePolicyKey(arn)) !== undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Lifecycle policy already exists with name: ${name}.`,
      400,
    );
  }
  const now = nowIso();
  const policy: StoredLifecyclePolicy = {
    arn,
    name,
    description: stringOrUndefined(input["description"]),
    status: stringOrUndefined(input["status"]) ?? "ENABLED",
    executionRole,
    resourceType,
    policyDetails: input["policyDetails"],
    resourceSelection: input["resourceSelection"],
    dateCreated: now,
    dateUpdated: now,
    tags: stringMapFrom(input["tags"]),
  };
  ctx.store.set(lifecyclePolicyKey(arn), policy);
  return {
    clientToken: stringOrUndefined(input["clientToken"]),
    lifecyclePolicyArn: arn,
  };
};

const GetLifecyclePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "lifecyclePolicyArn");
  const policy = requireLifecyclePolicy(ctx, arn);
  return { lifecyclePolicy: lifecyclePolicyView(policy) };
};

const ListLifecyclePolicies: OperationHandler = (_input, ctx) => {
  const policies = ctx.store
    .list<StoredLifecyclePolicy>()
    .filter((entry) => entry.key.startsWith(lifecyclePolicyPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    lifecyclePolicySummaryList: policies.map(lifecyclePolicySummaryView),
  };
};

const UpdateLifecyclePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "lifecyclePolicyArn");
  const existing = requireLifecyclePolicy(ctx, arn);
  const executionRole = requireString(input, "executionRole");
  const resourceType = requireString(input, "resourceType");
  const updated: StoredLifecyclePolicy = {
    ...existing,
    description: stringOrUndefined(input["description"]),
    status: stringOrUndefined(input["status"]) ?? existing.status,
    executionRole,
    resourceType,
    policyDetails: input["policyDetails"],
    resourceSelection: input["resourceSelection"],
    dateUpdated: nowIso(),
  };
  ctx.store.set(lifecyclePolicyKey(arn), updated);
  return { lifecyclePolicyArn: arn };
};

const DeleteLifecyclePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "lifecyclePolicyArn");
  requireLifecyclePolicy(ctx, arn);
  ctx.store.delete(lifecyclePolicyKey(arn));
  return { lifecyclePolicyArn: arn };
};

const StartResourceStateUpdate: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const id = crypto.randomUUID();
  const execution: StoredLifecycleExecution = {
    lifecycleExecutionId: id,
    lifecyclePolicyArn: undefined,
    resourceArn,
    state: { status: "IN_PROGRESS" },
    startTime: nowIso(),
    endTime: undefined,
  };
  ctx.store.set(lifecycleExecutionKey(id), execution);
  return { lifecycleExecutionId: id, resourceArn };
};

const GetLifecycleExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "lifecycleExecutionId");
  const execution = requireLifecycleExecution(ctx, id);
  return { lifecycleExecution: lifecycleExecutionView(execution) };
};

const CancelLifecycleExecution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "lifecycleExecutionId");
  const execution = requireLifecycleExecution(ctx, id);
  const updated: StoredLifecycleExecution = {
    ...execution,
    state: { status: "CANCELLED" },
    endTime: nowIso(),
  };
  ctx.store.set(lifecycleExecutionKey(id), updated);
  return { lifecycleExecutionId: id };
};

const ListLifecycleExecutions: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const executions = ctx.store
    .list<StoredLifecycleExecution>()
    .filter((entry) => entry.key.startsWith(lifecycleExecutionPrefix))
    .map((entry) => entry.value)
    .filter((e) => e.resourceArn === resourceArn)
    .sort((a, b) =>
      a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0,
    );
  return { lifecycleExecutions: executions.map(lifecycleExecutionView) };
};

const ListLifecycleExecutionResources: OperationHandler = (input, ctx) => {
  const id = requireString(input, "lifecycleExecutionId");
  const execution = requireLifecycleExecution(ctx, id);
  return {
    lifecycleExecutionId: id,
    lifecycleExecutionState: execution.state,
    resources: [],
  };
};

const UpdateImagePipeline: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "imagePipelineArn");
  const existing = requirePipeline(ctx, arn);
  const infrastructureConfigurationArn = requireString(
    input,
    "infrastructureConfigurationArn",
  );
  const updated: StoredPipeline = {
    ...existing,
    description: stringOrUndefined(input["description"]),
    imageRecipeArn:
      stringOrUndefined(input["imageRecipeArn"]) ?? existing.imageRecipeArn,
    containerRecipeArn:
      stringOrUndefined(input["containerRecipeArn"]) ??
      existing.containerRecipeArn,
    infrastructureConfigurationArn,
    distributionConfigurationArn:
      stringOrUndefined(input["distributionConfigurationArn"]) ??
      existing.distributionConfigurationArn,
    imageTestsConfiguration:
      asRecord(input["imageTestsConfiguration"]) ??
      existing.imageTestsConfiguration,
    enhancedImageMetadataEnabled:
      booleanOrUndefined(input["enhancedImageMetadataEnabled"]) ??
      existing.enhancedImageMetadataEnabled,
    schedule: asRecord(input["schedule"]) ?? existing.schedule,
    status: stringOrUndefined(input["status"]) ?? existing.status,
    executionRole:
      stringOrUndefined(input["executionRole"]) ?? existing.executionRole,
    imageTags:
      Object.keys(stringMapFrom(input["imageTags"])).length > 0
        ? stringMapFrom(input["imageTags"])
        : existing.imageTags,
    dateUpdated: nowIso(),
  };
  ctx.store.set(pipelineKey(arn), updated);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    imagePipelineArn: arn,
  };
};

const StartImagePipelineExecution: OperationHandler = (input, ctx) => {
  const pipelineArn = requireString(input, "imagePipelineArn");
  const pipeline = requirePipeline(ctx, pipelineArn);
  const pipelineName = pipeline.name;
  const version = "0.0.1";
  const arn = imageArnOf(ctx, pipelineName, version);
  const now = nowIso();
  const image: StoredImage = {
    arn,
    name: pipelineName,
    version,
    type: "AMI",
    platform: "Linux",
    osVersion: undefined,
    imageRecipeArn: pipeline.imageRecipeArn,
    containerRecipeArn: pipeline.containerRecipeArn,
    infrastructureConfigurationArn: pipeline.infrastructureConfigurationArn,
    distributionConfigurationArn: pipeline.distributionConfigurationArn,
    imageTestsConfiguration: pipeline.imageTestsConfiguration,
    enhancedImageMetadataEnabled: pipeline.enhancedImageMetadataEnabled,
    executionRole: pipeline.executionRole,
    pipelineArn,
    state: { status: "BUILDING" },
    tags: stringMapFrom(input["tags"]),
    dateCreated: now,
  };
  ctx.store.set(imageKey(arn), image);
  return {
    requestId: crypto.randomUUID(),
    clientToken: stringOrUndefined(input["clientToken"]),
    imageBuildVersionArn: arn,
  };
};

const ListImagePipelineImages: OperationHandler = (input, ctx) => {
  const pipelineArn = requireString(input, "imagePipelineArn");
  requirePipeline(ctx, pipelineArn);
  const images = ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith(imagePrefix))
    .map((entry) => entry.value)
    .filter((img) => img.pipelineArn === pipelineArn)
    .sort((a, b) =>
      a.dateCreated < b.dateCreated
        ? -1
        : a.dateCreated > b.dateCreated
          ? 1
          : 0,
    );
  return {
    requestId: crypto.randomUUID(),
    imageSummaryList: images.map(imageSummaryView),
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const newTags = stringMapFrom(input["tags"]);
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tagKeys = (input["tagKeys"] as string[] | undefined) ?? [];
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  const updated: Record<string, string> = { ...existing };
  for (const key of tagKeys) {
    delete updated[key];
  }
  ctx.store.set(tagsKey(arn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return { tags };
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
    if (path === "/CreateComponent" && req.method === "PUT") {
      return "CreateComponent";
    }
    if (path === "/ImportComponent" && req.method === "PUT") {
      return "ImportComponent";
    }
    if (path === "/GetComponent" && req.method === "GET") {
      return "GetComponent";
    }
    if (path === "/DeleteComponent" && req.method === "DELETE") {
      return "DeleteComponent";
    }
    if (path === "/GetComponentPolicy" && req.method === "GET") {
      return "GetComponentPolicy";
    }
    if (path === "/PutComponentPolicy" && req.method === "PUT") {
      return "PutComponentPolicy";
    }
    if (path === "/ListComponents" && req.method === "POST") {
      return "ListComponents";
    }
    if (path === "/ListComponentBuildVersions" && req.method === "POST") {
      return "ListComponentBuildVersions";
    }
    if (path === "/CreateImageRecipe" && req.method === "PUT") {
      return "CreateImageRecipe";
    }
    if (path === "/GetImageRecipe" && req.method === "GET") {
      return "GetImageRecipe";
    }
    if (path === "/DeleteImageRecipe" && req.method === "DELETE") {
      return "DeleteImageRecipe";
    }
    if (path === "/GetImageRecipePolicy" && req.method === "GET") {
      return "GetImageRecipePolicy";
    }
    if (path === "/PutImageRecipePolicy" && req.method === "PUT") {
      return "PutImageRecipePolicy";
    }
    if (path === "/ListImageRecipes" && req.method === "POST") {
      return "ListImageRecipes";
    }
    if (path === "/CreateContainerRecipe" && req.method === "PUT") {
      return "CreateContainerRecipe";
    }
    if (path === "/GetContainerRecipe" && req.method === "GET") {
      return "GetContainerRecipe";
    }
    if (path === "/DeleteContainerRecipe" && req.method === "DELETE") {
      return "DeleteContainerRecipe";
    }
    if (path === "/GetContainerRecipePolicy" && req.method === "GET") {
      return "GetContainerRecipePolicy";
    }
    if (path === "/PutContainerRecipePolicy" && req.method === "PUT") {
      return "PutContainerRecipePolicy";
    }
    if (path === "/ListContainerRecipes" && req.method === "POST") {
      return "ListContainerRecipes";
    }
    if (path === "/CreateDistributionConfiguration" && req.method === "PUT") {
      return "CreateDistributionConfiguration";
    }
    if (path === "/GetDistributionConfiguration" && req.method === "GET") {
      return "GetDistributionConfiguration";
    }
    if (path === "/UpdateDistributionConfiguration" && req.method === "PUT") {
      return "UpdateDistributionConfiguration";
    }
    if (
      path === "/DeleteDistributionConfiguration" &&
      req.method === "DELETE"
    ) {
      return "DeleteDistributionConfiguration";
    }
    if (path === "/ListDistributionConfigurations" && req.method === "POST") {
      return "ListDistributionConfigurations";
    }
    if (path === "/CreateInfrastructureConfiguration" && req.method === "PUT") {
      return "CreateInfrastructureConfiguration";
    }
    if (path === "/GetInfrastructureConfiguration" && req.method === "GET") {
      return "GetInfrastructureConfiguration";
    }
    if (path === "/UpdateInfrastructureConfiguration" && req.method === "PUT") {
      return "UpdateInfrastructureConfiguration";
    }
    if (
      path === "/DeleteInfrastructureConfiguration" &&
      req.method === "DELETE"
    ) {
      return "DeleteInfrastructureConfiguration";
    }
    if (path === "/ListInfrastructureConfigurations" && req.method === "POST") {
      return "ListInfrastructureConfigurations";
    }
    if (path === "/CreateImage" && req.method === "PUT") {
      return "CreateImage";
    }
    if (path === "/GetImage" && req.method === "GET") {
      return "GetImage";
    }
    if (path === "/DeleteImage" && req.method === "DELETE") {
      return "DeleteImage";
    }
    if (path === "/ListImages" && req.method === "POST") {
      return "ListImages";
    }
    if (path === "/GetImagePolicy" && req.method === "GET") {
      return "GetImagePolicy";
    }
    if (path === "/PutImagePolicy" && req.method === "PUT") {
      return "PutImagePolicy";
    }
    if (path === "/CancelImageCreation" && req.method === "PUT") {
      return "CancelImageCreation";
    }
    if (path === "/DistributeImage" && req.method === "PUT") {
      return "DistributeImage";
    }
    if (path === "/RetryImage" && req.method === "PUT") {
      return "RetryImage";
    }
    if (path === "/ImportDiskImage" && req.method === "PUT") {
      return "ImportDiskImage";
    }
    if (path === "/ImportVmImage" && req.method === "PUT") {
      return "ImportVmImage";
    }
    if (path === "/ListImageBuildVersions" && req.method === "POST") {
      return "ListImageBuildVersions";
    }
    if (path === "/ListImagePackages" && req.method === "POST") {
      return "ListImagePackages";
    }
    if (path.startsWith("/tags/") && req.method === "POST") {
      return "TagResource";
    }
    if (path.startsWith("/tags/") && req.method === "DELETE") {
      return "UntagResource";
    }
    if (path.startsWith("/tags/") && req.method === "GET") {
      return "ListTagsForResource";
    }
    if (path === "/CreateLifecyclePolicy" && req.method === "PUT") {
      return "CreateLifecyclePolicy";
    }
    if (path === "/GetLifecyclePolicy" && req.method === "GET") {
      return "GetLifecyclePolicy";
    }
    if (path === "/ListLifecyclePolicies" && req.method === "POST") {
      return "ListLifecyclePolicies";
    }
    if (path === "/UpdateLifecyclePolicy" && req.method === "PUT") {
      return "UpdateLifecyclePolicy";
    }
    if (path === "/DeleteLifecyclePolicy" && req.method === "DELETE") {
      return "DeleteLifecyclePolicy";
    }
    if (path === "/StartResourceStateUpdate" && req.method === "PUT") {
      return "StartResourceStateUpdate";
    }
    if (path === "/GetLifecycleExecution" && req.method === "GET") {
      return "GetLifecycleExecution";
    }
    if (path === "/CancelLifecycleExecution" && req.method === "PUT") {
      return "CancelLifecycleExecution";
    }
    if (path === "/ListLifecycleExecutions" && req.method === "POST") {
      return "ListLifecycleExecutions";
    }
    if (path === "/ListLifecycleExecutionResources" && req.method === "POST") {
      return "ListLifecycleExecutionResources";
    }
    if (path === "/UpdateImagePipeline" && req.method === "PUT") {
      return "UpdateImagePipeline";
    }
    if (path === "/StartImagePipelineExecution" && req.method === "PUT") {
      return "StartImagePipelineExecution";
    }
    if (path === "/ListImagePipelineImages" && req.method === "POST") {
      return "ListImagePipelineImages";
    }
    return undefined;
  },
  operations: {
    CreateImagePipeline,
    GetImagePipeline,
    ListImagePipelines,
    DeleteImagePipeline,
    CreateComponent,
    ImportComponent,
    GetComponent,
    DeleteComponent,
    GetComponentPolicy,
    PutComponentPolicy,
    ListComponents,
    ListComponentBuildVersions,
    CreateImageRecipe,
    GetImageRecipe,
    DeleteImageRecipe,
    GetImageRecipePolicy,
    PutImageRecipePolicy,
    ListImageRecipes,
    CreateContainerRecipe,
    GetContainerRecipe,
    DeleteContainerRecipe,
    GetContainerRecipePolicy,
    PutContainerRecipePolicy,
    ListContainerRecipes,
    CreateDistributionConfiguration,
    GetDistributionConfiguration,
    UpdateDistributionConfiguration,
    DeleteDistributionConfiguration,
    ListDistributionConfigurations,
    CreateInfrastructureConfiguration,
    GetInfrastructureConfiguration,
    UpdateInfrastructureConfiguration,
    DeleteInfrastructureConfiguration,
    ListInfrastructureConfigurations,
    CreateImage,
    GetImage,
    DeleteImage,
    ListImages,
    GetImagePolicy,
    PutImagePolicy,
    CancelImageCreation,
    DistributeImage,
    RetryImage,
    ImportDiskImage,
    ImportVmImage,
    ListImageBuildVersions,
    ListImagePackages,
    TagResource,
    UntagResource,
    ListTagsForResource,
    CreateLifecyclePolicy,
    GetLifecyclePolicy,
    ListLifecyclePolicies,
    UpdateLifecyclePolicy,
    DeleteLifecyclePolicy,
    StartResourceStateUpdate,
    GetLifecycleExecution,
    CancelLifecycleExecution,
    ListLifecycleExecutions,
    ListLifecycleExecutionResources,
    UpdateImagePipeline,
    StartImagePipelineExecution,
    ListImagePipelineImages,
  },
  model,
} as const satisfies ServiceDefinition;

export default imagebuilder;
