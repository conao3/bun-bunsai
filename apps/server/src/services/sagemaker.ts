import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import sagemakerModel from "../../../../test/vendor/aws-models/sagemaker.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(sagemakerModel);

type StoredModel = {
  ModelName: string;
  ModelArn: string;
  PrimaryContainer?: unknown;
  Containers?: unknown;
  InferenceExecutionConfig?: unknown;
  ExecutionRoleArn?: string;
  VpcConfig?: unknown;
  EnableNetworkIsolation?: boolean;
  CreationTime: number;
};

type StoredEndpointConfig = {
  EndpointConfigName: string;
  EndpointConfigArn: string;
  ProductionVariants?: unknown;
  CreationTime: number;
};

type StoredEndpoint = {
  EndpointName: string;
  EndpointArn: string;
  EndpointConfigName: string;
  EndpointStatus: string;
  ProductionVariants?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredTrainingJob = {
  TrainingJobName: string;
  TrainingJobArn: string;
  TrainingJobStatus: string;
  SecondaryStatus: string;
  RoleArn?: string;
  AlgorithmSpecification?: unknown;
  HyperParameters?: unknown;
  InputDataConfig?: unknown;
  OutputDataConfig?: unknown;
  ResourceConfig?: unknown;
  StoppingCondition?: unknown;
  ModelArtifacts: { S3ModelArtifacts: string };
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredNotebookInstance = {
  NotebookInstanceName: string;
  NotebookInstanceArn: string;
  NotebookInstanceStatus: string;
  InstanceType?: string;
  RoleArn?: string;
  SubnetId?: string;
  Url: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredModelPackageGroup = {
  ModelPackageGroupName: string;
  ModelPackageGroupArn: string;
  ModelPackageGroupDescription?: string;
  CreationTime: number;
  ModelPackageGroupStatus: string;
};

type StoredModelPackage = {
  ModelPackageName: string;
  ModelPackageGroupName?: string;
  ModelPackageArn: string;
  ModelPackageDescription?: string;
  ModelPackageStatus: string;
  ModelApprovalStatus?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredModelCard = {
  ModelCardName: string;
  ModelCardArn: string;
  ModelCardVersion: number;
  Content: string;
  ModelCardStatus: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredModelCardExportJob = {
  ModelCardExportJobName: string;
  ModelCardExportJobArn: string;
  ModelCardName: string;
  ModelCardVersion: number;
  Status: string;
  OutputConfig: unknown;
  CreatedAt: number;
  LastModifiedAt: number;
};

type StoredModelBiasJobDefinition = {
  JobDefinitionName: string;
  JobDefinitionArn: string;
  CreationTime: number;
  ModelBiasBaselineConfig?: unknown;
  ModelBiasAppSpecification?: unknown;
  ModelBiasJobInput?: unknown;
  ModelBiasJobOutputConfig?: unknown;
  JobResources?: unknown;
  NetworkConfig?: unknown;
  RoleArn?: string;
  StoppingCondition?: unknown;
};

type StoredModelExplainabilityJobDefinition = {
  JobDefinitionName: string;
  JobDefinitionArn: string;
  CreationTime: number;
  ModelExplainabilityBaselineConfig?: unknown;
  ModelExplainabilityAppSpecification?: unknown;
  ModelExplainabilityJobInput?: unknown;
  ModelExplainabilityJobOutputConfig?: unknown;
  JobResources?: unknown;
  NetworkConfig?: unknown;
  RoleArn?: string;
  StoppingCondition?: unknown;
};

type StoredModelQualityJobDefinition = {
  JobDefinitionName: string;
  JobDefinitionArn: string;
  CreationTime: number;
  ModelQualityBaselineConfig?: unknown;
  ModelQualityAppSpecification?: unknown;
  ModelQualityJobInput?: unknown;
  ModelQualityJobOutputConfig?: unknown;
  JobResources?: unknown;
  NetworkConfig?: unknown;
  RoleArn?: string;
  StoppingCondition?: unknown;
};

type StoredTrainingPlan = {
  TrainingPlanName: string;
  TrainingPlanArn: string;
  Status: string;
  CreationTime: number;
};

const modelKey = (name: string): string => `model/${name}`;

const configKey = (name: string): string => `endpoint-config/${name}`;

const endpointKey = (name: string): string => `endpoint/${name}`;

const trainingJobKey = (name: string): string => `training-job/${name}`;

const notebookInstanceKey = (name: string): string =>
  `notebook-instance/${name}`;

const modelPackageGroupKey = (name: string): string =>
  `model-package-group/${name}`;

const modelPackageKey = (name: string): string => `model-package/${name}`;

const modelCardKey = (name: string): string => `model-card/${name}`;

const modelCardExportJobKey = (arn: string): string =>
  `model-card-export-job/${arn}`;

const modelBiasJobDefinitionKey = (name: string): string =>
  `model-bias-job-definition/${name}`;

const modelExplainabilityJobDefinitionKey = (name: string): string =>
  `model-explainability-job-definition/${name}`;

const modelQualityJobDefinitionKey = (name: string): string =>
  `model-quality-job-definition/${name}`;

const trainingPlanKey = (name: string): string => `training-plan/${name}`;

const trainingJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:training-job/${name}`;

const notebookInstanceArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:notebook-instance/${name}`;

const modelArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:model/${name}`;

const configArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:endpoint-config/${name}`;

const endpointArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:endpoint/${name}`;

const modelPackageGroupArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:model-package-group/${name}`;

const modelPackageArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:model-package/${name}`;

const modelCardArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:model-card/${name}`;

const modelCardExportJobArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:model-card-export-job/${name}`;

const modelBiasJobDefinitionArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:model-bias-job-definition/${name}`;

const modelExplainabilityJobDefinitionArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:model-explainability-job-definition/${name}`;

const modelQualityJobDefinitionArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:model-quality-job-definition/${name}`;

const trainingPlanArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:training-plan/${name}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const CreateModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelName");
  const existing = ctx.store.get<StoredModel>(modelKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Model ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelArnOf(ctx.region, ctx.account, name);
  const stored: StoredModel = {
    ModelName: name,
    ModelArn: arn,
    PrimaryContainer: input["PrimaryContainer"],
    Containers: input["Containers"],
    InferenceExecutionConfig: input["InferenceExecutionConfig"],
    ExecutionRoleArn:
      typeof input["ExecutionRoleArn"] === "string"
        ? (input["ExecutionRoleArn"] as string)
        : undefined,
    VpcConfig: input["VpcConfig"],
    EnableNetworkIsolation:
      typeof input["EnableNetworkIsolation"] === "boolean"
        ? (input["EnableNetworkIsolation"] as boolean)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(modelKey(name), stored);
  return { ModelArn: arn };
};

const requireModel = (ctx: ServiceContext, name: string): StoredModel => {
  const stored = ctx.store.get<StoredModel>(modelKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelName");
  const stored = requireModel(ctx, name);
  return {
    ModelName: stored.ModelName,
    PrimaryContainer: stored.PrimaryContainer,
    Containers: stored.Containers,
    InferenceExecutionConfig: stored.InferenceExecutionConfig,
    ExecutionRoleArn: stored.ExecutionRoleArn,
    VpcConfig: stored.VpcConfig,
    EnableNetworkIsolation: stored.EnableNetworkIsolation,
    CreationTime: stored.CreationTime,
    ModelArn: stored.ModelArn,
  };
};

const ListModels: OperationHandler = (_input, ctx) => {
  const models = ctx.store
    .list<StoredModel>()
    .filter((entry) => entry.key.startsWith("model/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.ModelName.localeCompare(b.ModelName));
  return {
    Models: models.map((stored) => ({
      ModelName: stored.ModelName,
      ModelArn: stored.ModelArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const DeleteModel: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelName");
  requireModel(ctx, name);
  ctx.store.delete(modelKey(name));
  return {};
};

const CreateEndpointConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointConfigName");
  const existing = ctx.store.get<StoredEndpointConfig>(configKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create EndpointConfig ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = configArnOf(ctx.region, ctx.account, name);
  const stored: StoredEndpointConfig = {
    EndpointConfigName: name,
    EndpointConfigArn: arn,
    ProductionVariants: input["ProductionVariants"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(configKey(name), stored);
  return { EndpointConfigArn: arn };
};

const requireEndpointConfig = (
  ctx: ServiceContext,
  name: string,
): StoredEndpointConfig => {
  const stored = ctx.store.get<StoredEndpointConfig>(configKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint configuration "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeEndpointConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointConfigName");
  const stored = requireEndpointConfig(ctx, name);
  return {
    EndpointConfigName: stored.EndpointConfigName,
    EndpointConfigArn: stored.EndpointConfigArn,
    ProductionVariants: stored.ProductionVariants,
    CreationTime: stored.CreationTime,
  };
};

const DeleteEndpointConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointConfigName");
  requireEndpointConfig(ctx, name);
  ctx.store.delete(configKey(name));
  return {};
};

const ListEndpointConfigs: OperationHandler = (_input, ctx) => {
  const configs = ctx.store
    .list<StoredEndpointConfig>()
    .filter((entry) => entry.key.startsWith("endpoint-config/"))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.EndpointConfigName.localeCompare(b.EndpointConfigName),
    );
  return {
    EndpointConfigs: configs.map((stored) => ({
      EndpointConfigName: stored.EndpointConfigName,
      EndpointConfigArn: stored.EndpointConfigArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const CreateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const configName = requireString(input, "EndpointConfigName");
  const config = ctx.store.get<StoredEndpointConfig>(configKey(configName));
  if (config === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint configuration "${configName}".`,
      400,
    );
  }
  const existing = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Endpoint ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = endpointArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredEndpoint = {
    EndpointName: name,
    EndpointArn: arn,
    EndpointConfigName: configName,
    EndpointStatus: "InService",
    ProductionVariants: config.ProductionVariants,
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(endpointKey(name), stored);
  return { EndpointArn: arn };
};

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const stored = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint "${name}".`,
      400,
    );
  }
  return {
    EndpointName: stored.EndpointName,
    EndpointArn: stored.EndpointArn,
    EndpointConfigName: stored.EndpointConfigName,
    ProductionVariants: stored.ProductionVariants,
    EndpointStatus: stored.EndpointStatus,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const stored = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint "${name}".`,
      400,
    );
  }
  ctx.store.delete(endpointKey(name));
  return {};
};

const ListEndpoints: OperationHandler = (_input, ctx) => {
  const endpoints = ctx.store
    .list<StoredEndpoint>()
    .filter((entry) => entry.key.startsWith("endpoint/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.EndpointName.localeCompare(b.EndpointName));
  return {
    Endpoints: endpoints.map((stored) => ({
      EndpointName: stored.EndpointName,
      EndpointArn: stored.EndpointArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      EndpointStatus: stored.EndpointStatus,
    })),
  };
};

const CreateTrainingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingJobName");
  const existing = ctx.store.get<StoredTrainingJob>(trainingJobKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create TrainingJob ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = trainingJobArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredTrainingJob = {
    TrainingJobName: name,
    TrainingJobArn: arn,
    TrainingJobStatus: "InProgress",
    SecondaryStatus: "Starting",
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    AlgorithmSpecification: input["AlgorithmSpecification"],
    HyperParameters: input["HyperParameters"],
    InputDataConfig: input["InputDataConfig"],
    OutputDataConfig: input["OutputDataConfig"],
    ResourceConfig: input["ResourceConfig"],
    StoppingCondition: input["StoppingCondition"],
    ModelArtifacts: {
      S3ModelArtifacts: `s3://bunsai-sagemaker/${name}/output/model.tar.gz`,
    },
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(trainingJobKey(name), stored);
  return { TrainingJobArn: arn };
};

const requireTrainingJob = (
  ctx: ServiceContext,
  name: string,
): StoredTrainingJob => {
  const stored = ctx.store.get<StoredTrainingJob>(trainingJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Requested resource not found: training job "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeTrainingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingJobName");
  const stored = requireTrainingJob(ctx, name);
  return {
    TrainingJobName: stored.TrainingJobName,
    TrainingJobArn: stored.TrainingJobArn,
    TrainingJobStatus: stored.TrainingJobStatus,
    SecondaryStatus: stored.SecondaryStatus,
    RoleArn: stored.RoleArn,
    AlgorithmSpecification: stored.AlgorithmSpecification,
    HyperParameters: stored.HyperParameters,
    InputDataConfig: stored.InputDataConfig,
    OutputDataConfig: stored.OutputDataConfig,
    ResourceConfig: stored.ResourceConfig,
    StoppingCondition: stored.StoppingCondition,
    ModelArtifacts: stored.ModelArtifacts,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const ListTrainingJobs: OperationHandler = (_input, ctx) => {
  const jobs = ctx.store
    .list<StoredTrainingJob>()
    .filter((entry) => entry.key.startsWith("training-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.TrainingJobName.localeCompare(b.TrainingJobName));
  return {
    TrainingJobSummaries: jobs.map((stored) => ({
      TrainingJobName: stored.TrainingJobName,
      TrainingJobArn: stored.TrainingJobArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      TrainingJobStatus: stored.TrainingJobStatus,
    })),
  };
};

const DeleteTrainingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingJobName");
  requireTrainingJob(ctx, name);
  ctx.store.delete(trainingJobKey(name));
  return {};
};

const StopTrainingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingJobName");
  const stored = requireTrainingJob(ctx, name);
  const updated: StoredTrainingJob = {
    ...stored,
    TrainingJobStatus: "Stopping",
    SecondaryStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  };
  ctx.store.set(trainingJobKey(name), updated);
  return {};
};

const CreateNotebookInstance: OperationHandler = (input, ctx) => {
  const name = requireString(input, "NotebookInstanceName");
  const existing = ctx.store.get<StoredNotebookInstance>(
    notebookInstanceKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create NotebookInstance ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = notebookInstanceArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredNotebookInstance = {
    NotebookInstanceName: name,
    NotebookInstanceArn: arn,
    NotebookInstanceStatus: "InService",
    InstanceType:
      typeof input["InstanceType"] === "string"
        ? (input["InstanceType"] as string)
        : undefined,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    SubnetId:
      typeof input["SubnetId"] === "string"
        ? (input["SubnetId"] as string)
        : undefined,
    Url: `${name}.notebook.${ctx.region}.sagemaker.aws`,
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(notebookInstanceKey(name), stored);
  return { NotebookInstanceArn: arn };
};

const DescribeNotebookInstance: OperationHandler = (input, ctx) => {
  const name = requireString(input, "NotebookInstanceName");
  const stored = ctx.store.get<StoredNotebookInstance>(
    notebookInstanceKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `RecordNotFound: notebook instance "${name}".`,
      400,
    );
  }
  return {
    NotebookInstanceArn: stored.NotebookInstanceArn,
    NotebookInstanceName: stored.NotebookInstanceName,
    NotebookInstanceStatus: stored.NotebookInstanceStatus,
    Url: stored.Url,
    InstanceType: stored.InstanceType,
    RoleArn: stored.RoleArn,
    SubnetId: stored.SubnetId,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const ListNotebookInstances: OperationHandler = (_input, ctx) => {
  const instances = ctx.store
    .list<StoredNotebookInstance>()
    .filter((entry) => entry.key.startsWith("notebook-instance/"))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.NotebookInstanceName.localeCompare(b.NotebookInstanceName),
    );
  return {
    NotebookInstances: instances.map((stored) => ({
      NotebookInstanceName: stored.NotebookInstanceName,
      NotebookInstanceArn: stored.NotebookInstanceArn,
      NotebookInstanceStatus: stored.NotebookInstanceStatus,
      InstanceType: stored.InstanceType,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const CreateModelPackageGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageGroupName");
  const existing = ctx.store.get<StoredModelPackageGroup>(
    modelPackageGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create ModelPackageGroup ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelPackageGroupArnOf(ctx.region, ctx.account, name);
  const stored: StoredModelPackageGroup = {
    ModelPackageGroupName: name,
    ModelPackageGroupArn: arn,
    ModelPackageGroupDescription:
      typeof input["ModelPackageGroupDescription"] === "string"
        ? (input["ModelPackageGroupDescription"] as string)
        : undefined,
    CreationTime: nowSeconds(),
    ModelPackageGroupStatus: "Completed",
  };
  ctx.store.set(modelPackageGroupKey(name), stored);
  return { ModelPackageGroupArn: arn };
};

const requireModelPackageGroup = (
  ctx: ServiceContext,
  name: string,
): StoredModelPackageGroup => {
  const stored = ctx.store.get<StoredModelPackageGroup>(
    modelPackageGroupKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model package group "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModelPackageGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageGroupName");
  const stored = requireModelPackageGroup(ctx, name);
  return {
    ModelPackageGroupName: stored.ModelPackageGroupName,
    ModelPackageGroupArn: stored.ModelPackageGroupArn,
    ModelPackageGroupDescription: stored.ModelPackageGroupDescription,
    CreationTime: stored.CreationTime,
    ModelPackageGroupStatus: stored.ModelPackageGroupStatus,
    CreatedBy: {},
  };
};

const DeleteModelPackageGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageGroupName");
  requireModelPackageGroup(ctx, name);
  ctx.store.delete(modelPackageGroupKey(name));
  return {};
};

const DeleteModelPackageGroupPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageGroupName");
  requireModelPackageGroup(ctx, name);
  return {};
};

const CreateModelPackage: OperationHandler = (input, ctx) => {
  const pkgName =
    typeof input["ModelPackageName"] === "string" &&
    input["ModelPackageName"] !== ""
      ? (input["ModelPackageName"] as string)
      : typeof input["ModelPackageGroupName"] === "string" &&
          input["ModelPackageGroupName"] !== ""
        ? (`${input["ModelPackageGroupName"]}-${nowSeconds()}` as string)
        : undefined;
  if (pkgName === undefined) {
    throw awsError(
      "ValidationException",
      "ModelPackageName or ModelPackageGroupName is required.",
      400,
    );
  }
  const arn = modelPackageArnOf(ctx.region, ctx.account, pkgName);
  const at = nowSeconds();
  const stored: StoredModelPackage = {
    ModelPackageName: pkgName,
    ModelPackageGroupName:
      typeof input["ModelPackageGroupName"] === "string"
        ? (input["ModelPackageGroupName"] as string)
        : undefined,
    ModelPackageArn: arn,
    ModelPackageDescription:
      typeof input["ModelPackageDescription"] === "string"
        ? (input["ModelPackageDescription"] as string)
        : undefined,
    ModelPackageStatus: "Completed",
    ModelApprovalStatus:
      typeof input["ModelApprovalStatus"] === "string"
        ? (input["ModelApprovalStatus"] as string)
        : "PendingManualApproval",
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(modelPackageKey(pkgName), stored);
  return { ModelPackageArn: arn };
};

const requireModelPackage = (
  ctx: ServiceContext,
  name: string,
): StoredModelPackage => {
  const stored = ctx.store.get<StoredModelPackage>(modelPackageKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model package "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModelPackage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageName");
  const stored = requireModelPackage(ctx, name);
  return {
    ModelPackageName: stored.ModelPackageName,
    ModelPackageGroupName: stored.ModelPackageGroupName,
    ModelPackageArn: stored.ModelPackageArn,
    ModelPackageDescription: stored.ModelPackageDescription,
    ModelPackageStatus: stored.ModelPackageStatus,
    ModelApprovalStatus: stored.ModelApprovalStatus,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    CreatedBy: {},
    ModelPackageStatusDetails: {
      ValidationStatuses: [],
      ImageScanStatuses: [],
    },
  };
};

const DeleteModelPackage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageName");
  requireModelPackage(ctx, name);
  ctx.store.delete(modelPackageKey(name));
  return {};
};

const CreateModelCard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelCardName");
  const existing = ctx.store.get<StoredModelCard>(modelCardKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create ModelCard ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelCardArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredModelCard = {
    ModelCardName: name,
    ModelCardArn: arn,
    ModelCardVersion: 1,
    Content:
      typeof input["Content"] === "string" ? (input["Content"] as string) : "{}",
    ModelCardStatus:
      typeof input["ModelCardStatus"] === "string"
        ? (input["ModelCardStatus"] as string)
        : "Draft",
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(modelCardKey(name), stored);
  return { ModelCardArn: arn };
};

const requireModelCard = (
  ctx: ServiceContext,
  name: string,
): StoredModelCard => {
  const stored = ctx.store.get<StoredModelCard>(modelCardKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model card "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModelCard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelCardName");
  const stored = requireModelCard(ctx, name);
  return {
    ModelCardArn: stored.ModelCardArn,
    ModelCardName: stored.ModelCardName,
    ModelCardVersion: stored.ModelCardVersion,
    Content: stored.Content,
    ModelCardStatus: stored.ModelCardStatus,
    CreationTime: stored.CreationTime,
    CreatedBy: {},
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DeleteModelCard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelCardName");
  requireModelCard(ctx, name);
  ctx.store.delete(modelCardKey(name));
  return {};
};

const CreateModelCardExportJob: OperationHandler = (input, ctx) => {
  const cardName = requireString(input, "ModelCardName");
  requireModelCard(ctx, cardName);
  const jobName = requireString(input, "ModelCardExportJobName");
  const arn = modelCardExportJobArnOf(ctx.region, ctx.account, jobName);
  const at = nowSeconds();
  const stored: StoredModelCardExportJob = {
    ModelCardExportJobName: jobName,
    ModelCardExportJobArn: arn,
    ModelCardName: cardName,
    ModelCardVersion: 1,
    Status: "Completed",
    OutputConfig: input["OutputConfig"],
    CreatedAt: at,
    LastModifiedAt: at,
  };
  ctx.store.set(modelCardExportJobKey(arn), stored);
  return { ModelCardExportJobArn: arn };
};

const DescribeModelCardExportJob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ModelCardExportJobArn");
  const stored = ctx.store.get<StoredModelCardExportJob>(
    modelCardExportJobKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model card export job "${arn}".`,
      400,
    );
  }
  return {
    ModelCardExportJobName: stored.ModelCardExportJobName,
    ModelCardExportJobArn: stored.ModelCardExportJobArn,
    Status: stored.Status,
    ModelCardName: stored.ModelCardName,
    ModelCardVersion: stored.ModelCardVersion,
    OutputConfig: stored.OutputConfig,
    CreatedAt: stored.CreatedAt,
    LastModifiedAt: stored.LastModifiedAt,
  };
};

const CreateModelBiasJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  const existing = ctx.store.get<StoredModelBiasJobDefinition>(
    modelBiasJobDefinitionKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create ModelBiasJobDefinition ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelBiasJobDefinitionArnOf(ctx.region, ctx.account, name);
  const stored: StoredModelBiasJobDefinition = {
    JobDefinitionName: name,
    JobDefinitionArn: arn,
    CreationTime: nowSeconds(),
    ModelBiasBaselineConfig: input["ModelBiasBaselineConfig"],
    ModelBiasAppSpecification: input["ModelBiasAppSpecification"],
    ModelBiasJobInput: input["ModelBiasJobInput"],
    ModelBiasJobOutputConfig: input["ModelBiasJobOutputConfig"],
    JobResources: input["JobResources"],
    NetworkConfig: input["NetworkConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    StoppingCondition: input["StoppingCondition"],
  };
  ctx.store.set(modelBiasJobDefinitionKey(name), stored);
  return { JobDefinitionArn: arn };
};

const requireModelBiasJobDefinition = (
  ctx: ServiceContext,
  name: string,
): StoredModelBiasJobDefinition => {
  const stored = ctx.store.get<StoredModelBiasJobDefinition>(
    modelBiasJobDefinitionKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model bias job definition "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModelBiasJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  const stored = requireModelBiasJobDefinition(ctx, name);
  return {
    JobDefinitionArn: stored.JobDefinitionArn,
    JobDefinitionName: stored.JobDefinitionName,
    CreationTime: stored.CreationTime,
    ModelBiasBaselineConfig: stored.ModelBiasBaselineConfig,
    ModelBiasAppSpecification: stored.ModelBiasAppSpecification,
    ModelBiasJobInput: stored.ModelBiasJobInput,
    ModelBiasJobOutputConfig: stored.ModelBiasJobOutputConfig,
    JobResources: stored.JobResources,
    NetworkConfig: stored.NetworkConfig,
    RoleArn: stored.RoleArn,
    StoppingCondition: stored.StoppingCondition,
  };
};

const DeleteModelBiasJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  requireModelBiasJobDefinition(ctx, name);
  ctx.store.delete(modelBiasJobDefinitionKey(name));
  return {};
};

const CreateModelExplainabilityJobDefinition: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "JobDefinitionName");
  const existing = ctx.store.get<StoredModelExplainabilityJobDefinition>(
    modelExplainabilityJobDefinitionKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create ModelExplainabilityJobDefinition ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelExplainabilityJobDefinitionArnOf(
    ctx.region,
    ctx.account,
    name,
  );
  const stored: StoredModelExplainabilityJobDefinition = {
    JobDefinitionName: name,
    JobDefinitionArn: arn,
    CreationTime: nowSeconds(),
    ModelExplainabilityBaselineConfig:
      input["ModelExplainabilityBaselineConfig"],
    ModelExplainabilityAppSpecification:
      input["ModelExplainabilityAppSpecification"],
    ModelExplainabilityJobInput: input["ModelExplainabilityJobInput"],
    ModelExplainabilityJobOutputConfig:
      input["ModelExplainabilityJobOutputConfig"],
    JobResources: input["JobResources"],
    NetworkConfig: input["NetworkConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    StoppingCondition: input["StoppingCondition"],
  };
  ctx.store.set(modelExplainabilityJobDefinitionKey(name), stored);
  return { JobDefinitionArn: arn };
};

const requireModelExplainabilityJobDefinition = (
  ctx: ServiceContext,
  name: string,
): StoredModelExplainabilityJobDefinition => {
  const stored = ctx.store.get<StoredModelExplainabilityJobDefinition>(
    modelExplainabilityJobDefinitionKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model explainability job definition "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModelExplainabilityJobDefinition: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "JobDefinitionName");
  const stored = requireModelExplainabilityJobDefinition(ctx, name);
  return {
    JobDefinitionArn: stored.JobDefinitionArn,
    JobDefinitionName: stored.JobDefinitionName,
    CreationTime: stored.CreationTime,
    ModelExplainabilityBaselineConfig: stored.ModelExplainabilityBaselineConfig,
    ModelExplainabilityAppSpecification:
      stored.ModelExplainabilityAppSpecification,
    ModelExplainabilityJobInput: stored.ModelExplainabilityJobInput,
    ModelExplainabilityJobOutputConfig: stored.ModelExplainabilityJobOutputConfig,
    JobResources: stored.JobResources,
    NetworkConfig: stored.NetworkConfig,
    RoleArn: stored.RoleArn,
    StoppingCondition: stored.StoppingCondition,
  };
};

const DeleteModelExplainabilityJobDefinition: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "JobDefinitionName");
  requireModelExplainabilityJobDefinition(ctx, name);
  ctx.store.delete(modelExplainabilityJobDefinitionKey(name));
  return {};
};

const CreateModelQualityJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  const existing = ctx.store.get<StoredModelQualityJobDefinition>(
    modelQualityJobDefinitionKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create ModelQualityJobDefinition ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = modelQualityJobDefinitionArnOf(ctx.region, ctx.account, name);
  const stored: StoredModelQualityJobDefinition = {
    JobDefinitionName: name,
    JobDefinitionArn: arn,
    CreationTime: nowSeconds(),
    ModelQualityBaselineConfig: input["ModelQualityBaselineConfig"],
    ModelQualityAppSpecification: input["ModelQualityAppSpecification"],
    ModelQualityJobInput: input["ModelQualityJobInput"],
    ModelQualityJobOutputConfig: input["ModelQualityJobOutputConfig"],
    JobResources: input["JobResources"],
    NetworkConfig: input["NetworkConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    StoppingCondition: input["StoppingCondition"],
  };
  ctx.store.set(modelQualityJobDefinitionKey(name), stored);
  return { JobDefinitionArn: arn };
};

const requireModelQualityJobDefinition = (
  ctx: ServiceContext,
  name: string,
): StoredModelQualityJobDefinition => {
  const stored = ctx.store.get<StoredModelQualityJobDefinition>(
    modelQualityJobDefinitionKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model quality job definition "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeModelQualityJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  const stored = requireModelQualityJobDefinition(ctx, name);
  return {
    JobDefinitionArn: stored.JobDefinitionArn,
    JobDefinitionName: stored.JobDefinitionName,
    CreationTime: stored.CreationTime,
    ModelQualityBaselineConfig: stored.ModelQualityBaselineConfig,
    ModelQualityAppSpecification: stored.ModelQualityAppSpecification,
    ModelQualityJobInput: stored.ModelQualityJobInput,
    ModelQualityJobOutputConfig: stored.ModelQualityJobOutputConfig,
    JobResources: stored.JobResources,
    NetworkConfig: stored.NetworkConfig,
    RoleArn: stored.RoleArn,
    StoppingCondition: stored.StoppingCondition,
  };
};

const DeleteModelQualityJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  requireModelQualityJobDefinition(ctx, name);
  ctx.store.delete(modelQualityJobDefinitionKey(name));
  return {};
};

const CreateTrainingPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingPlanName");
  const existing = ctx.store.get<StoredTrainingPlan>(trainingPlanKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create TrainingPlan ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = trainingPlanArnOf(ctx.region, ctx.account, name);
  const stored: StoredTrainingPlan = {
    TrainingPlanName: name,
    TrainingPlanArn: arn,
    Status: "Active",
    CreationTime: nowSeconds(),
  };
  ctx.store.set(trainingPlanKey(name), stored);
  return { TrainingPlanArn: arn };
};

const DescribeTrainingPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingPlanName");
  const stored = ctx.store.get<StoredTrainingPlan>(trainingPlanKey(name));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find training plan "${name}".`,
      400,
    );
  }
  return {
    TrainingPlanArn: stored.TrainingPlanArn,
    TrainingPlanName: stored.TrainingPlanName,
    Status: stored.Status,
  };
};

const sagemaker = {
  name: "sagemaker",
  protocol: "json",
  operations: {
    CreateModel,
    DescribeModel,
    ListModels,
    DeleteModel,
    CreateEndpointConfig,
    DescribeEndpointConfig,
    DeleteEndpointConfig,
    ListEndpointConfigs,
    CreateEndpoint,
    DescribeEndpoint,
    DeleteEndpoint,
    ListEndpoints,
    CreateTrainingJob,
    DescribeTrainingJob,
    ListTrainingJobs,
    DeleteTrainingJob,
    StopTrainingJob,
    CreateNotebookInstance,
    DescribeNotebookInstance,
    ListNotebookInstances,
    CreateModelPackageGroup,
    DescribeModelPackageGroup,
    DeleteModelPackageGroup,
    DeleteModelPackageGroupPolicy,
    CreateModelPackage,
    DescribeModelPackage,
    DeleteModelPackage,
    CreateModelCard,
    DescribeModelCard,
    DeleteModelCard,
    CreateModelCardExportJob,
    DescribeModelCardExportJob,
    CreateModelBiasJobDefinition,
    DescribeModelBiasJobDefinition,
    DeleteModelBiasJobDefinition,
    CreateModelExplainabilityJobDefinition,
    DescribeModelExplainabilityJobDefinition,
    DeleteModelExplainabilityJobDefinition,
    CreateModelQualityJobDefinition,
    DescribeModelQualityJobDefinition,
    DeleteModelQualityJobDefinition,
    CreateTrainingPlan,
    DescribeTrainingPlan,
  },
  model,
} as const satisfies ServiceDefinition;

export default sagemaker;
