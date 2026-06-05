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

type StoredNotebookInstanceLifecycleConfig = {
  NotebookInstanceLifecycleConfigName: string;
  NotebookInstanceLifecycleConfigArn: string;
  OnStart?: unknown;
  OnCreate?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredPipeline = {
  PipelineName: string;
  PipelineArn: string;
  PipelineDisplayName?: string;
  PipelineDefinition?: string;
  PipelineDescription?: string;
  RoleArn?: string;
  PipelineStatus: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredPipelineExecution = {
  PipelineArn: string;
  PipelineExecutionArn: string;
  PipelineExecutionDisplayName?: string;
  PipelineExecutionStatus: string;
  CreationTime: number;
  LastModifiedTime: number;
  PipelineParameters?: Array<{ Name: string; Value: string }>;
};

type StoredProcessingJob = {
  ProcessingJobName: string;
  ProcessingJobArn: string;
  ProcessingJobStatus: string;
  AppSpecification?: unknown;
  ProcessingInputs?: unknown;
  ProcessingOutputConfig?: unknown;
  ProcessingResources?: unknown;
  RoleArn?: string;
  StoppingCondition?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredTransformJob = {
  TransformJobName: string;
  TransformJobArn: string;
  TransformJobStatus: string;
  ModelName: string;
  TransformInput?: unknown;
  TransformOutput?: unknown;
  TransformResources?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredDomain = {
  DomainId: string;
  DomainArn: string;
  DomainName: string;
  AuthMode?: string;
  Status: string;
  Url: string;
  CreationTime: number;
  LastModifiedTime: number;
  DefaultUserSettings?: unknown;
  DomainSettings?: unknown;
  SubnetIds?: unknown;
  VpcId?: string;
  AppNetworkAccessType?: string;
  DefaultSpaceSettings?: unknown;
};

type StoredApp = {
  DomainId: string;
  AppType: string;
  AppName: string;
  AppArn: string;
  UserProfileName?: string;
  SpaceName?: string;
  Status: string;
  CreationTime: number;
  ResourceSpec?: unknown;
};

type StoredAppImageConfig = {
  AppImageConfigName: string;
  AppImageConfigArn: string;
  CreationTime: number;
  LastModifiedTime: number;
  KernelGatewayImageConfig?: unknown;
  JupyterLabAppImageConfig?: unknown;
  CodeEditorAppImageConfig?: unknown;
};

type StoredSpace = {
  DomainId: string;
  SpaceName: string;
  SpaceArn: string;
  Status: string;
  SpaceDisplayName?: string;
  SpaceSettings?: unknown;
  OwnershipSettings?: unknown;
  SpaceSharingSettings?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredUserProfile = {
  DomainId: string;
  UserProfileName: string;
  UserProfileArn: string;
  Status: string;
  SingleSignOnUserIdentifier?: string;
  SingleSignOnUserValue?: string;
  UserSettings?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredMlflowApp = {
  Name: string;
  Arn: string;
  ArtifactStoreUri?: string;
  RoleArn?: string;
  ModelRegistrationMode?: string;
  CreationTime: number;
};

type StoredPartnerApp = {
  Name: string;
  Arn: string;
  Type?: string;
  ExecutionRoleArn?: string;
  Tier?: string;
  AuthType?: string;
  CreationTime: number;
};

type StoredFeatureGroup = {
  FeatureGroupName: string;
  FeatureGroupArn: string;
  RecordIdentifierFeatureName: string;
  EventTimeFeatureName: string;
  FeatureDefinitions?: unknown;
  OnlineStoreConfig?: unknown;
  OfflineStoreConfig?: unknown;
  ThroughputConfig?: unknown;
  RoleArn?: string;
  Description?: string;
  CreationTime: number;
};

type StoredHub = {
  HubName: string;
  HubArn: string;
  HubDescription: string;
  HubDisplayName?: string;
  HubSearchKeywords?: unknown;
  S3StorageConfig?: unknown;
  CreationTime: number;
};

type StoredImage = {
  ImageName: string;
  ImageArn: string;
  Description?: string;
  DisplayName?: string;
  RoleArn: string;
  CreationTime: number;
};

type StoredImageVersion = {
  ImageName: string;
  ImageVersionArn: string;
  Version: number;
  BaseImage: string;
  CreationTime: number;
};

type StoredInferenceComponent = {
  InferenceComponentName: string;
  InferenceComponentArn: string;
  EndpointName: string;
  VariantName?: string;
  Specification?: unknown;
  Specifications?: unknown;
  RuntimeConfig?: unknown;
  CreationTime: number;
};

type StoredInferenceExperiment = {
  Name: string;
  InferenceExperimentArn: string;
  Type: string;
  RoleArn: string;
  EndpointName: string;
  ModelVariants?: unknown;
  ShadowModeConfig?: unknown;
  Description?: string;
  Schedule?: unknown;
  DataStorageConfig?: unknown;
  CreationTime: number;
};

type StoredInferenceRecommendationsJob = {
  JobName: string;
  JobArn: string;
  JobType: string;
  RoleArn: string;
  InputConfig?: unknown;
  JobDescription?: string;
  CreationTime: number;
};

type StoredMonitoringSchedule = {
  MonitoringScheduleName: string;
  MonitoringScheduleArn: string;
  MonitoringScheduleConfig?: unknown;
  CreationTime: number;
};

type StoredAssociation = {
  SourceArn: string;
  DestinationArn: string;
  AssociationType?: string;
};

type StoredTags = {
  ResourceArn: string;
  Tags: Array<{ Key: string; Value: string }>;
};

type StoredTrialComponentAssociation = {
  TrialComponentName: string;
  TrialName: string;
  TrialComponentArn: string;
  TrialArn: string;
};

type StoredClusterNode = {
  ClusterName: string;
  NodeId: string;
  InstanceGroupName: string;
  Status: string;
};

type StoredAIBenchmarkJob = {
  AIBenchmarkJobName: string;
  AIBenchmarkJobArn: string;
  AIBenchmarkJobStatus: string;
  BenchmarkTarget?: unknown;
  OutputConfig?: unknown;
  AIWorkloadConfigIdentifier?: unknown;
  RoleArn?: string;
  CreationTime: number;
};

type StoredAIRecommendationJob = {
  AIRecommendationJobName: string;
  AIRecommendationJobArn: string;
  AIRecommendationJobStatus: string;
  ModelSource?: unknown;
  OutputConfig?: unknown;
  AIWorkloadConfigIdentifier?: unknown;
  PerformanceTarget?: unknown;
  RoleArn?: string;
  CreationTime: number;
};

type StoredAIWorkloadConfig = {
  AIWorkloadConfigName: string;
  AIWorkloadConfigArn: string;
  DatasetConfig?: unknown;
  AIWorkloadConfigs?: unknown;
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

const notebookInstanceLifecycleConfigKey = (name: string): string =>
  `notebook-instance-lifecycle-config/${name}`;

const pipelineKey = (name: string): string => `pipeline/${name}`;

const pipelineExecutionKey = (arn: string): string =>
  `pipeline-execution/${arn}`;

const processingJobKey = (name: string): string => `processing-job/${name}`;

const transformJobKey = (name: string): string => `transform-job/${name}`;

const domainKey = (id: string): string => `domain/${id}`;

const appKey = (domainId: string, appType: string, appName: string): string =>
  `app/${domainId}/${appType}/${appName}`;

const appImageConfigKey = (name: string): string => `app-image-config/${name}`;

const spaceKey = (domainId: string, spaceName: string): string =>
  `space/${domainId}/${spaceName}`;

const userProfileKey = (domainId: string, userProfileName: string): string =>
  `user-profile/${domainId}/${userProfileName}`;

const mlflowAppKey = (name: string): string => `mlflow-app/${name}`;

const partnerAppKey = (name: string): string => `partner-app/${name}`;

const featureGroupKey = (name: string): string => `feature-group/${name}`;

const hubKey = (name: string): string => `hub/${name}`;

const imageKey = (name: string): string => `image/${name}`;

const imageVersionKey = (imageName: string, version: number): string =>
  `image-version/${imageName}/${version}`;

const inferenceComponentKey = (name: string): string =>
  `inference-component/${name}`;

const inferenceExperimentKey = (name: string): string =>
  `inference-experiment/${name}`;

const inferenceRecommendationsJobKey = (name: string): string =>
  `inference-recommendations-job/${name}`;

const monitoringScheduleKey = (name: string): string =>
  `monitoring-schedule/${name}`;

const associationKey = (sourceArn: string, destinationArn: string): string =>
  `association/${sourceArn}/${destinationArn}`;

const tagsKey = (resourceArn: string): string => `tags/${resourceArn}`;

const trialComponentAssociationKey = (
  trialComponentName: string,
  trialName: string,
): string => `trial-component-association/${trialComponentName}/${trialName}`;

const clusterNodeKey = (clusterName: string, nodeId: string): string =>
  `cluster-node/${clusterName}/${nodeId}`;

const aiBenchmarkJobKey = (name: string): string => `ai-benchmark-job/${name}`;

const aiRecommendationJobKey = (name: string): string =>
  `ai-recommendation-job/${name}`;

const aiWorkloadConfigKey = (name: string): string =>
  `ai-workload-config/${name}`;

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

const notebookInstanceLifecycleConfigArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:notebook-instance-lifecycle-config/${name}`;

const pipelineArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:pipeline/${name}`;

const pipelineExecutionArnOf = (
  region: string,
  account: string,
  pipelineName: string,
  executionId: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:pipeline/${pipelineName}/execution/${executionId}`;

const processingJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:processing-job/${name}`;

const transformJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:transform-job/${name}`;

const domainArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:sagemaker:${region}:${account}:domain/${id}`;

const appArnOf = (
  region: string,
  account: string,
  domainId: string,
  userProfileOrSpace: string,
  appType: string,
  appName: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:app/${domainId}/${userProfileOrSpace}/${appType}/${appName}`;

const appImageConfigArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:app-image-config/${name}`;

const spaceArnOf = (
  region: string,
  account: string,
  domainId: string,
  spaceName: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:space/${domainId}/${spaceName}`;

const userProfileArnOf = (
  region: string,
  account: string,
  domainId: string,
  userProfileName: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:user-profile/${domainId}/${userProfileName}`;

const mlflowAppArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:mlflow-tracking-server/${name}`;

const partnerAppArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:partner-app/${name}`;

const featureGroupArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:feature-group/${name}`;

const hubArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:hub/${name}`;

const hubContentArnOf = (
  region: string,
  account: string,
  hubName: string,
  contentType: string,
  contentName: string,
  contentVersion: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:hub-content/${hubName}/${contentType}/${contentName}/${contentVersion}`;

const imageArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:image/${name}`;

const imageVersionArnOf = (
  region: string,
  account: string,
  name: string,
  version: number,
): string =>
  `arn:aws:sagemaker:${region}:${account}:image-version/${name}/${version}`;

const inferenceComponentArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:inference-component/${name}`;

const inferenceExperimentArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:inference-experiment/${name}`;

const inferenceRecommendationsJobArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:inference-recommendations-job/${name}`;

const monitoringScheduleArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:monitoring-schedule/${name}`;

const aiBenchmarkJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:ai-benchmark-job/${name}`;

const aiRecommendationJobArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:ai-recommendation-job/${name}`;

const aiWorkloadConfigArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:ai-workload-config/${name}`;

const trialComponentArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:experiment-trial-component/${name}`;

const trialArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:experiment-trial/${name}`;

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
    .sort((a, b) => a.EndpointConfigName.localeCompare(b.EndpointConfigName));
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
      typeof input["Content"] === "string"
        ? (input["Content"] as string)
        : "{}",
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
    ModelExplainabilityJobOutputConfig:
      stored.ModelExplainabilityJobOutputConfig,
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

const DeleteNotebookInstance: OperationHandler = (input, ctx) => {
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
  ctx.store.delete(notebookInstanceKey(name));
  return {};
};

const CreatePresignedNotebookInstanceUrl: OperationHandler = (input, ctx) => {
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
  const url = `https://${name}.notebook.${ctx.region}.sagemaker.aws/tree?token=bunsai-presigned-token`;
  return { AuthorizedUrl: url };
};

const CreateNotebookInstanceLifecycleConfig: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "NotebookInstanceLifecycleConfigName");
  const existing = ctx.store.get<StoredNotebookInstanceLifecycleConfig>(
    notebookInstanceLifecycleConfigKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create NotebookInstanceLifecycleConfig ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = notebookInstanceLifecycleConfigArnOf(
    ctx.region,
    ctx.account,
    name,
  );
  const at = nowSeconds();
  const stored: StoredNotebookInstanceLifecycleConfig = {
    NotebookInstanceLifecycleConfigName: name,
    NotebookInstanceLifecycleConfigArn: arn,
    OnStart: input["OnStart"],
    OnCreate: input["OnCreate"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(notebookInstanceLifecycleConfigKey(name), stored);
  return { NotebookInstanceLifecycleConfigArn: arn };
};

const requireNotebookInstanceLifecycleConfig = (
  ctx: ServiceContext,
  name: string,
): StoredNotebookInstanceLifecycleConfig => {
  const stored = ctx.store.get<StoredNotebookInstanceLifecycleConfig>(
    notebookInstanceLifecycleConfigKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find notebook instance lifecycle config "${name}".`,
      400,
    );
  }
  return stored;
};

const DescribeNotebookInstanceLifecycleConfig: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "NotebookInstanceLifecycleConfigName");
  const stored = requireNotebookInstanceLifecycleConfig(ctx, name);
  return {
    NotebookInstanceLifecycleConfigArn:
      stored.NotebookInstanceLifecycleConfigArn,
    NotebookInstanceLifecycleConfigName:
      stored.NotebookInstanceLifecycleConfigName,
    OnStart: stored.OnStart,
    OnCreate: stored.OnCreate,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DeleteNotebookInstanceLifecycleConfig: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "NotebookInstanceLifecycleConfigName");
  requireNotebookInstanceLifecycleConfig(ctx, name);
  ctx.store.delete(notebookInstanceLifecycleConfigKey(name));
  return {};
};

const ListNotebookInstanceLifecycleConfigs: OperationHandler = (
  _input,
  ctx,
) => {
  const configs = ctx.store
    .list<StoredNotebookInstanceLifecycleConfig>()
    .filter((entry) =>
      entry.key.startsWith("notebook-instance-lifecycle-config/"),
    )
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.NotebookInstanceLifecycleConfigName.localeCompare(
        b.NotebookInstanceLifecycleConfigName,
      ),
    );
  return {
    NotebookInstanceLifecycleConfigs: configs.map((stored) => ({
      NotebookInstanceLifecycleConfigName:
        stored.NotebookInstanceLifecycleConfigName,
      NotebookInstanceLifecycleConfigArn:
        stored.NotebookInstanceLifecycleConfigArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const CreatePipeline: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  const existing = ctx.store.get<StoredPipeline>(pipelineKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Pipeline ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = pipelineArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredPipeline = {
    PipelineName: name,
    PipelineArn: arn,
    PipelineDisplayName:
      typeof input["PipelineDisplayName"] === "string"
        ? (input["PipelineDisplayName"] as string)
        : undefined,
    PipelineDefinition:
      typeof input["PipelineDefinition"] === "string"
        ? (input["PipelineDefinition"] as string)
        : undefined,
    PipelineDescription:
      typeof input["PipelineDescription"] === "string"
        ? (input["PipelineDescription"] as string)
        : undefined,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    PipelineStatus: "Active",
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(pipelineKey(name), stored);
  return { PipelineArn: arn };
};

const requirePipeline = (ctx: ServiceContext, name: string): StoredPipeline => {
  const stored = ctx.store.get<StoredPipeline>(pipelineKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Pipeline with name "${name}" does not exist.`,
      400,
    );
  }
  return stored;
};

const DescribePipeline: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  const stored = requirePipeline(ctx, name);
  return {
    PipelineArn: stored.PipelineArn,
    PipelineName: stored.PipelineName,
    PipelineDisplayName: stored.PipelineDisplayName,
    PipelineDefinition: stored.PipelineDefinition,
    PipelineDescription: stored.PipelineDescription,
    RoleArn: stored.RoleArn,
    PipelineStatus: stored.PipelineStatus,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    CreatedBy: {},
    LastModifiedBy: {},
  };
};

const DeletePipeline: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  const stored = requirePipeline(ctx, name);
  ctx.store.delete(pipelineKey(name));
  return { PipelineArn: stored.PipelineArn };
};

const ListPipelineVersions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  const stored = requirePipeline(ctx, name);
  return {
    PipelineVersionSummaries: [
      {
        PipelineArn: stored.PipelineArn,
        CreationTime: stored.CreationTime,
        LastModifiedTime: stored.LastModifiedTime,
      },
    ],
  };
};

const ListPipelineExecutions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  requirePipeline(ctx, name);
  const arn = pipelineArnOf(ctx.region, ctx.account, name);
  const executions = ctx.store
    .list<StoredPipelineExecution>()
    .filter((entry) => entry.key.startsWith("pipeline-execution/"))
    .map((entry) => entry.value)
    .filter((exec) => exec.PipelineArn === arn)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  return {
    PipelineExecutionSummaries: executions.map((exec) => ({
      PipelineExecutionArn: exec.PipelineExecutionArn,
      PipelineExecutionDisplayName: exec.PipelineExecutionDisplayName,
      PipelineExecutionStatus: exec.PipelineExecutionStatus,
      StartTime: exec.CreationTime,
    })),
  };
};

const requirePipelineExecution = (
  ctx: ServiceContext,
  arn: string,
): StoredPipelineExecution => {
  const stored = ctx.store.get<StoredPipelineExecution>(
    pipelineExecutionKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Pipeline execution with ARN "${arn}" does not exist.`,
      400,
    );
  }
  return stored;
};

const DescribePipelineExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PipelineExecutionArn");
  const stored = requirePipelineExecution(ctx, arn);
  return {
    PipelineArn: stored.PipelineArn,
    PipelineExecutionArn: stored.PipelineExecutionArn,
    PipelineExecutionDisplayName: stored.PipelineExecutionDisplayName,
    PipelineExecutionStatus: stored.PipelineExecutionStatus,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    CreatedBy: {},
    LastModifiedBy: {},
  };
};

const DescribePipelineDefinitionForExecution: OperationHandler = (
  input,
  ctx,
) => {
  const execArn = requireString(input, "PipelineExecutionArn");
  const exec = requirePipelineExecution(ctx, execArn);
  const pipelineNameMatch = exec.PipelineArn.split(":pipeline/")[1];
  const pipeline = pipelineNameMatch
    ? ctx.store.get<StoredPipeline>(pipelineKey(pipelineNameMatch))
    : undefined;
  return {
    PipelineDefinition: pipeline?.PipelineDefinition ?? "{}",
    CreationTime: exec.CreationTime,
  };
};

const ListPipelineExecutionSteps: OperationHandler = (input, _ctx) => {
  requireString(input, "PipelineExecutionArn");
  return { PipelineExecutionSteps: [] };
};

const ListPipelineParametersForExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PipelineExecutionArn");
  const stored = requirePipelineExecution(ctx, arn);
  return { PipelineParameters: stored.PipelineParameters ?? [] };
};

const CreateProcessingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProcessingJobName");
  const existing = ctx.store.get<StoredProcessingJob>(processingJobKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create ProcessingJob ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = processingJobArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredProcessingJob = {
    ProcessingJobName: name,
    ProcessingJobArn: arn,
    ProcessingJobStatus: "InProgress",
    AppSpecification: input["AppSpecification"],
    ProcessingInputs: input["ProcessingInputs"],
    ProcessingOutputConfig: input["ProcessingOutputConfig"],
    ProcessingResources: input["ProcessingResources"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    StoppingCondition: input["StoppingCondition"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(processingJobKey(name), stored);
  return { ProcessingJobArn: arn };
};

const requireProcessingJob = (
  ctx: ServiceContext,
  name: string,
): StoredProcessingJob => {
  const stored = ctx.store.get<StoredProcessingJob>(processingJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Could not find processing job "${name}".`,
      400,
    );
  }
  return stored;
};

const DeleteProcessingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProcessingJobName");
  requireProcessingJob(ctx, name);
  ctx.store.delete(processingJobKey(name));
  return {};
};

const CreateTransformJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TransformJobName");
  const existing = ctx.store.get<StoredTransformJob>(transformJobKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create TransformJob ${name}. Resource already exists.`,
      400,
    );
  }
  const modelName = requireString(input, "ModelName");
  const arn = transformJobArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredTransformJob = {
    TransformJobName: name,
    TransformJobArn: arn,
    TransformJobStatus: "InProgress",
    ModelName: modelName,
    TransformInput: input["TransformInput"],
    TransformOutput: input["TransformOutput"],
    TransformResources: input["TransformResources"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(transformJobKey(name), stored);
  return { TransformJobArn: arn };
};

let domainIdCounter = 1;

const CreateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DomainName");
  const domainId = `d-${String(domainIdCounter++).padStart(10, "0")}`;
  const arn = domainArnOf(ctx.region, ctx.account, domainId);
  const at = nowSeconds();
  const stored: StoredDomain = {
    DomainId: domainId,
    DomainArn: arn,
    DomainName: name,
    AuthMode:
      typeof input["AuthMode"] === "string"
        ? (input["AuthMode"] as string)
        : undefined,
    Status: "InService",
    Url: `https://${domainId}.studio.${ctx.region}.sagemaker.aws`,
    DefaultUserSettings: input["DefaultUserSettings"],
    DomainSettings: input["DomainSettings"],
    SubnetIds: input["SubnetIds"],
    VpcId:
      typeof input["VpcId"] === "string"
        ? (input["VpcId"] as string)
        : undefined,
    AppNetworkAccessType:
      typeof input["AppNetworkAccessType"] === "string"
        ? (input["AppNetworkAccessType"] as string)
        : undefined,
    DefaultSpaceSettings: input["DefaultSpaceSettings"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(domainKey(domainId), stored);
  return { DomainArn: arn, DomainId: domainId, Url: stored.Url };
};

const requireDomain = (ctx: ServiceContext, id: string): StoredDomain => {
  const stored = ctx.store.get<StoredDomain>(domainKey(id));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Domain ${id} does not exist.`, 400);
  }
  return stored;
};

const CreateApp: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const appType = requireString(input, "AppType");
  const appName = requireString(input, "AppName");
  const userProfileName =
    typeof input["UserProfileName"] === "string"
      ? (input["UserProfileName"] as string)
      : undefined;
  const spaceName =
    typeof input["SpaceName"] === "string"
      ? (input["SpaceName"] as string)
      : undefined;
  const qualifier = userProfileName ?? spaceName ?? "default";
  const arn = appArnOf(
    ctx.region,
    ctx.account,
    domainId,
    qualifier,
    appType,
    appName,
  );
  const stored: StoredApp = {
    DomainId: domainId,
    AppType: appType,
    AppName: appName,
    AppArn: arn,
    UserProfileName: userProfileName,
    SpaceName: spaceName,
    Status: "InService",
    CreationTime: nowSeconds(),
    ResourceSpec: input["ResourceSpec"],
  };
  ctx.store.set(appKey(domainId, appType, appName), stored);
  return { AppArn: arn };
};

const requireApp = (
  ctx: ServiceContext,
  domainId: string,
  appType: string,
  appName: string,
): StoredApp => {
  const stored = ctx.store.get<StoredApp>(appKey(domainId, appType, appName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `App ${appName} of type ${appType} in domain ${domainId} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteApp: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const appType = requireString(input, "AppType");
  const appName = requireString(input, "AppName");
  requireApp(ctx, domainId, appType, appName);
  ctx.store.delete(appKey(domainId, appType, appName));
  return {};
};

const CreateAppImageConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AppImageConfigName");
  const existing = ctx.store.get<StoredAppImageConfig>(appImageConfigKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create AppImageConfig ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = appImageConfigArnOf(ctx.region, ctx.account, name);
  const at = nowSeconds();
  const stored: StoredAppImageConfig = {
    AppImageConfigName: name,
    AppImageConfigArn: arn,
    KernelGatewayImageConfig: input["KernelGatewayImageConfig"],
    JupyterLabAppImageConfig: input["JupyterLabAppImageConfig"],
    CodeEditorAppImageConfig: input["CodeEditorAppImageConfig"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(appImageConfigKey(name), stored);
  return { AppImageConfigArn: arn };
};

const requireAppImageConfig = (
  ctx: ServiceContext,
  name: string,
): StoredAppImageConfig => {
  const stored = ctx.store.get<StoredAppImageConfig>(appImageConfigKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `AppImageConfig ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteAppImageConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AppImageConfigName");
  requireAppImageConfig(ctx, name);
  ctx.store.delete(appImageConfigKey(name));
  return {};
};

const CreateSpace: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const spaceName = requireString(input, "SpaceName");
  const existing = ctx.store.get<StoredSpace>(spaceKey(domainId, spaceName));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Space ${spaceName} in domain ${domainId}. Resource already exists.`,
      400,
    );
  }
  const arn = spaceArnOf(ctx.region, ctx.account, domainId, spaceName);
  const at = nowSeconds();
  const stored: StoredSpace = {
    DomainId: domainId,
    SpaceName: spaceName,
    SpaceArn: arn,
    Status: "InService",
    SpaceDisplayName:
      typeof input["SpaceDisplayName"] === "string"
        ? (input["SpaceDisplayName"] as string)
        : undefined,
    SpaceSettings: input["SpaceSettings"],
    OwnershipSettings: input["OwnershipSettings"],
    SpaceSharingSettings: input["SpaceSharingSettings"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(spaceKey(domainId, spaceName), stored);
  return { SpaceArn: arn };
};

const CreateUserProfile: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const userProfileName = requireString(input, "UserProfileName");
  const existing = ctx.store.get<StoredUserProfile>(
    userProfileKey(domainId, userProfileName),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create UserProfile ${userProfileName} in domain ${domainId}. Resource already exists.`,
      400,
    );
  }
  const arn = userProfileArnOf(
    ctx.region,
    ctx.account,
    domainId,
    userProfileName,
  );
  const at = nowSeconds();
  const stored: StoredUserProfile = {
    DomainId: domainId,
    UserProfileName: userProfileName,
    UserProfileArn: arn,
    Status: "InService",
    SingleSignOnUserIdentifier:
      typeof input["SingleSignOnUserIdentifier"] === "string"
        ? (input["SingleSignOnUserIdentifier"] as string)
        : undefined,
    SingleSignOnUserValue:
      typeof input["SingleSignOnUserValue"] === "string"
        ? (input["SingleSignOnUserValue"] as string)
        : undefined,
    UserSettings: input["UserSettings"],
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(userProfileKey(domainId, userProfileName), stored);
  return { UserProfileArn: arn };
};

const CreatePresignedDomainUrl: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const url = `https://${domainId}.studio.${ctx.region}.sagemaker.aws/auth?token=bunsai-presigned-token`;
  return { AuthorizedUrl: url };
};

const CreateMlflowApp: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const existing = ctx.store.get<StoredMlflowApp>(mlflowAppKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create MlflowApp ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = mlflowAppArnOf(ctx.region, ctx.account, name);
  const stored: StoredMlflowApp = {
    Name: name,
    Arn: arn,
    ArtifactStoreUri:
      typeof input["ArtifactStoreUri"] === "string"
        ? (input["ArtifactStoreUri"] as string)
        : undefined,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    ModelRegistrationMode:
      typeof input["ModelRegistrationMode"] === "string"
        ? (input["ModelRegistrationMode"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(mlflowAppKey(name), stored);
  return { Arn: arn };
};

const requireMlflowApp = (
  ctx: ServiceContext,
  arn: string,
): StoredMlflowApp => {
  const entries = ctx.store
    .list<StoredMlflowApp>()
    .filter((e) => e.key.startsWith("mlflow-app/"))
    .map((e) => e.value)
    .find((v) => v.Arn === arn);
  if (entries === undefined) {
    throw awsError("ResourceNotFound", `MlflowApp ${arn} does not exist.`, 400);
  }
  return entries;
};

const CreatePresignedMlflowAppUrl: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  requireMlflowApp(ctx, arn);
  const url = `https://mlflow.${ctx.region}.sagemaker.aws/auth?arn=${encodeURIComponent(arn)}&token=bunsai-presigned-token`;
  return { AuthorizedUrl: url };
};

const CreatePartnerApp: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const existing = ctx.store.get<StoredPartnerApp>(partnerAppKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create PartnerApp ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = partnerAppArnOf(ctx.region, ctx.account, name);
  const stored: StoredPartnerApp = {
    Name: name,
    Arn: arn,
    Type:
      typeof input["Type"] === "string" ? (input["Type"] as string) : undefined,
    ExecutionRoleArn:
      typeof input["ExecutionRoleArn"] === "string"
        ? (input["ExecutionRoleArn"] as string)
        : undefined,
    Tier:
      typeof input["Tier"] === "string" ? (input["Tier"] as string) : undefined,
    AuthType:
      typeof input["AuthType"] === "string"
        ? (input["AuthType"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(partnerAppKey(name), stored);
  return { Arn: arn };
};

const requirePartnerApp = (
  ctx: ServiceContext,
  arn: string,
): StoredPartnerApp => {
  const entry = ctx.store
    .list<StoredPartnerApp>()
    .filter((e) => e.key.startsWith("partner-app/"))
    .map((e) => e.value)
    .find((v) => v.Arn === arn);
  if (entry === undefined) {
    throw awsError(
      "ResourceNotFound",
      `PartnerApp ${arn} does not exist.`,
      400,
    );
  }
  return entry;
};

const CreatePartnerAppPresignedUrl: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  requirePartnerApp(ctx, arn);
  const url = `https://partner-app.${ctx.region}.sagemaker.aws/auth?arn=${encodeURIComponent(arn)}&token=bunsai-presigned-token`;
  return { Url: url };
};

const CreateFeatureGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FeatureGroupName");
  const existing = ctx.store.get<StoredFeatureGroup>(featureGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create FeatureGroup ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = featureGroupArnOf(ctx.region, ctx.account, name);
  const stored: StoredFeatureGroup = {
    FeatureGroupName: name,
    FeatureGroupArn: arn,
    RecordIdentifierFeatureName: requireString(
      input,
      "RecordIdentifierFeatureName",
    ),
    EventTimeFeatureName: requireString(input, "EventTimeFeatureName"),
    FeatureDefinitions: input["FeatureDefinitions"],
    OnlineStoreConfig: input["OnlineStoreConfig"],
    OfflineStoreConfig: input["OfflineStoreConfig"],
    ThroughputConfig: input["ThroughputConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(featureGroupKey(name), stored);
  return { FeatureGroupArn: arn };
};

const requireFeatureGroup = (
  ctx: ServiceContext,
  name: string,
): StoredFeatureGroup => {
  const stored = ctx.store.get<StoredFeatureGroup>(featureGroupKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `FeatureGroup ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteFeatureGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FeatureGroupName");
  requireFeatureGroup(ctx, name);
  ctx.store.delete(featureGroupKey(name));
  return {};
};

const CreateHub: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HubName");
  const existing = ctx.store.get<StoredHub>(hubKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Hub ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = hubArnOf(ctx.region, ctx.account, name);
  const stored: StoredHub = {
    HubName: name,
    HubArn: arn,
    HubDescription: requireString(input, "HubDescription"),
    HubDisplayName:
      typeof input["HubDisplayName"] === "string"
        ? (input["HubDisplayName"] as string)
        : undefined,
    HubSearchKeywords: input["HubSearchKeywords"],
    S3StorageConfig: input["S3StorageConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(hubKey(name), stored);
  return { HubArn: arn };
};

const requireHub = (ctx: ServiceContext, name: string): StoredHub => {
  const stored = ctx.store.get<StoredHub>(hubKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Hub ${name} does not exist.`, 400);
  }
  return stored;
};

const CreateHubContentPresignedUrls: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  const contentType = requireString(input, "HubContentType");
  const contentName = requireString(input, "HubContentName");
  requireHub(ctx, hubName);
  const version =
    typeof input["HubContentVersion"] === "string"
      ? (input["HubContentVersion"] as string)
      : "1.0.0";
  const url = `https://s3.${ctx.region}.amazonaws.com/sagemaker-hub-${ctx.account}/${hubName}/${contentType}/${contentName}/${version}?presigned=bunsai-token`;
  return { AuthorizedUrlConfigs: [{ Url: url }] };
};

const CreateHubContentReference: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  const publicArn = requireString(input, "SageMakerPublicHubContentArn");
  const hub = requireHub(ctx, hubName);
  const contentName =
    typeof input["HubContentName"] === "string"
      ? (input["HubContentName"] as string)
      : (publicArn.split("/").pop() ?? "content");
  const contentVersion =
    typeof input["MinVersion"] === "string"
      ? (input["MinVersion"] as string)
      : "1.0.0";
  const hubContentArn = hubContentArnOf(
    ctx.region,
    ctx.account,
    hubName,
    "Model",
    contentName,
    contentVersion,
  );
  return { HubArn: hub.HubArn, HubContentArn: hubContentArn };
};

const CreateImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ImageName");
  const existing = ctx.store.get<StoredImage>(imageKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create Image ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = imageArnOf(ctx.region, ctx.account, name);
  const stored: StoredImage = {
    ImageName: name,
    ImageArn: arn,
    RoleArn: requireString(input, "RoleArn"),
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(imageKey(name), stored);
  return { ImageArn: arn };
};

const requireImage = (ctx: ServiceContext, name: string): StoredImage => {
  const stored = ctx.store.get<StoredImage>(imageKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Image ${name} does not exist.`, 400);
  }
  return stored;
};

const CreateImageVersion: OperationHandler = (input, ctx) => {
  const imageName = requireString(input, "ImageName");
  requireImage(ctx, imageName);
  const versions = ctx.store
    .list<StoredImageVersion>()
    .filter((e) => e.key.startsWith(`image-version/${imageName}/`))
    .map((e) => e.value);
  const version = versions.length + 1;
  const arn = imageVersionArnOf(ctx.region, ctx.account, imageName, version);
  const stored: StoredImageVersion = {
    ImageName: imageName,
    ImageVersionArn: arn,
    Version: version,
    BaseImage: requireString(input, "BaseImage"),
    CreationTime: nowSeconds(),
  };
  ctx.store.set(imageVersionKey(imageName, version), stored);
  return { ImageVersionArn: arn };
};

const CreateInferenceComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InferenceComponentName");
  const existing = ctx.store.get<StoredInferenceComponent>(
    inferenceComponentKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create InferenceComponent ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = inferenceComponentArnOf(ctx.region, ctx.account, name);
  const stored: StoredInferenceComponent = {
    InferenceComponentName: name,
    InferenceComponentArn: arn,
    EndpointName: requireString(input, "EndpointName"),
    VariantName:
      typeof input["VariantName"] === "string"
        ? (input["VariantName"] as string)
        : undefined,
    Specification: input["Specification"],
    Specifications: input["Specifications"],
    RuntimeConfig: input["RuntimeConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(inferenceComponentKey(name), stored);
  return { InferenceComponentArn: arn };
};

const CreateInferenceExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const existing = ctx.store.get<StoredInferenceExperiment>(
    inferenceExperimentKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create InferenceExperiment ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = inferenceExperimentArnOf(ctx.region, ctx.account, name);
  const stored: StoredInferenceExperiment = {
    Name: name,
    InferenceExperimentArn: arn,
    Type: requireString(input, "Type"),
    RoleArn: requireString(input, "RoleArn"),
    EndpointName: requireString(input, "EndpointName"),
    ModelVariants: input["ModelVariants"],
    ShadowModeConfig: input["ShadowModeConfig"],
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    Schedule: input["Schedule"],
    DataStorageConfig: input["DataStorageConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(inferenceExperimentKey(name), stored);
  return { InferenceExperimentArn: arn };
};

const CreateInferenceRecommendationsJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobName");
  const existing = ctx.store.get<StoredInferenceRecommendationsJob>(
    inferenceRecommendationsJobKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create InferenceRecommendationsJob ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = inferenceRecommendationsJobArnOf(ctx.region, ctx.account, name);
  const stored: StoredInferenceRecommendationsJob = {
    JobName: name,
    JobArn: arn,
    JobType: requireString(input, "JobType"),
    RoleArn: requireString(input, "RoleArn"),
    InputConfig: input["InputConfig"],
    JobDescription:
      typeof input["JobDescription"] === "string"
        ? (input["JobDescription"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(inferenceRecommendationsJobKey(name), stored);
  return { JobArn: arn };
};

const CreateMonitoringSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MonitoringScheduleName");
  const existing = ctx.store.get<StoredMonitoringSchedule>(
    monitoringScheduleKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Cannot create MonitoringSchedule ${name}. Resource already exists.`,
      400,
    );
  }
  const arn = monitoringScheduleArnOf(ctx.region, ctx.account, name);
  const stored: StoredMonitoringSchedule = {
    MonitoringScheduleName: name,
    MonitoringScheduleArn: arn,
    MonitoringScheduleConfig: input["MonitoringScheduleConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(monitoringScheduleKey(name), stored);
  return { MonitoringScheduleArn: arn };
};

const requireMonitoringSchedule = (
  ctx: ServiceContext,
  name: string,
): StoredMonitoringSchedule => {
  const stored = ctx.store.get<StoredMonitoringSchedule>(
    monitoringScheduleKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MonitoringSchedule ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteMonitoringSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MonitoringScheduleName");
  requireMonitoringSchedule(ctx, name);
  ctx.store.delete(monitoringScheduleKey(name));
  return {};
};

const DescribeApp: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const appType = requireString(input, "AppType");
  const appName = requireString(input, "AppName");
  const stored = requireApp(ctx, domainId, appType, appName);
  return {
    AppArn: stored.AppArn,
    AppType: stored.AppType,
    AppName: stored.AppName,
    DomainId: stored.DomainId,
    UserProfileName: stored.UserProfileName,
    SpaceName: stored.SpaceName,
    Status: stored.Status,
    CreationTime: stored.CreationTime,
    ResourceSpec: stored.ResourceSpec,
  };
};

const DescribeAppImageConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AppImageConfigName");
  const stored = requireAppImageConfig(ctx, name);
  return {
    AppImageConfigArn: stored.AppImageConfigArn,
    AppImageConfigName: stored.AppImageConfigName,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    KernelGatewayImageConfig: stored.KernelGatewayImageConfig,
    JupyterLabAppImageConfig: stored.JupyterLabAppImageConfig,
    CodeEditorAppImageConfig: stored.CodeEditorAppImageConfig,
  };
};

const DescribeAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ActionName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:action/${name}`;
  const now = nowSeconds();
  return {
    ActionName: name,
    ActionArn: arn,
    ActionType: "ModelDeployment",
    Status: "Completed",
    CreationTime: now,
    LastModifiedTime: now,
  };
};

const DescribeAlgorithm: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlgorithmName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:algorithm/${name}`;
  return {
    AlgorithmName: name,
    AlgorithmArn: arn,
    AlgorithmStatus: "Completed",
    CreationTime: nowSeconds(),
    TrainingSpecification: {
      TrainingImage: `${ctx.account}.dkr.ecr.${ctx.region}.amazonaws.com/bunsai:latest`,
      SupportedTrainingInstanceTypes: ["ml.m5.xlarge"],
    },
    AlgorithmStatusDetails: {},
  };
};

const DescribeArtifact: OperationHandler = (input, ctx) => {
  const artifactArn = requireString(input, "ArtifactArn");
  const now = nowSeconds();
  return {
    ArtifactName: "bunsai-artifact",
    ArtifactArn: artifactArn,
    ArtifactType: "DataSet",
    Source: {
      SourceUri: `s3://bunsai-sagemaker/${ctx.account}/artifacts/data`,
    },
    CreationTime: now,
    LastModifiedTime: now,
  };
};

const DescribeAutoMLJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoMLJobName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:automl-job/${name}`;
  const now = nowSeconds();
  return {
    AutoMLJobName: name,
    AutoMLJobArn: arn,
    AutoMLJobStatus: "Completed",
    AutoMLJobSecondaryStatus: "Completed",
    CreationTime: now,
    LastModifiedTime: now,
    InputDataConfig: [],
    OutputDataConfig: { S3OutputPath: `s3://bunsai-sagemaker/${name}/output` },
    RoleArn: `arn:aws:iam::${ctx.account}:role/SageMakerRole`,
  };
};

const DescribeAutoMLJobV2: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoMLJobName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:automl-job/${name}`;
  const now = nowSeconds();
  return {
    AutoMLJobName: name,
    AutoMLJobArn: arn,
    AutoMLJobStatus: "Completed",
    AutoMLJobSecondaryStatus: "Completed",
    CreationTime: now,
    LastModifiedTime: now,
    AutoMLJobInputDataConfig: [],
    OutputDataConfig: { S3OutputPath: `s3://bunsai-sagemaker/${name}/output` },
    RoleArn: `arn:aws:iam::${ctx.account}:role/SageMakerRole`,
  };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:cluster/${name}`;
  return {
    ClusterArn: arn,
    ClusterName: name,
    ClusterStatus: "InService",
    CreationTime: nowSeconds(),
    InstanceGroups: [],
  };
};

const DescribeClusterEvent: OperationHandler = (input, ctx) => {
  const eventId = requireString(input, "EventId");
  const clusterName = requireString(input, "ClusterName");
  const clusterArn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:cluster/${clusterName}`;
  return {
    EventDetails: {
      EventId: eventId,
      ClusterArn: clusterArn,
      ClusterName: clusterName,
      ResourceType: "Cluster",
      EventTime: nowSeconds(),
      EventLevel: "Info",
      Description: "Cluster event",
    },
  };
};

const DescribeAIBenchmarkJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIBenchmarkJobName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:ai-benchmark-job/${name}`;
  const now = nowSeconds();
  return {
    AIBenchmarkJobName: name,
    AIBenchmarkJobArn: arn,
    AIBenchmarkJobStatus: "Completed",
    BenchmarkTarget: { BenchmarkConfig: { ModelId: `${name}-model` } },
    CreationTime: now,
    StartTime: now,
    EndTime: now,
  };
};

const DescribeAIRecommendationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIRecommendationJobName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:ai-recommendation-job/${name}`;
  const now = nowSeconds();
  return {
    AIRecommendationJobName: name,
    AIRecommendationJobArn: arn,
    AIRecommendationJobStatus: "Completed",
    Recommendations: [],
    CreationTime: now,
    StartTime: now,
    EndTime: now,
  };
};

const DescribeAIWorkloadConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIWorkloadConfigName");
  const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:ai-workload-config/${name}`;
  return {
    AIWorkloadConfigName: name,
    AIWorkloadConfigArn: arn,
    AIWorkloadConfigs: [],
    CreationTime: nowSeconds(),
  };
};

const AddAssociation: OperationHandler = (input, ctx) => {
  const sourceArn = requireString(input, "SourceArn");
  const destinationArn = requireString(input, "DestinationArn");
  const stored: StoredAssociation = {
    SourceArn: sourceArn,
    DestinationArn: destinationArn,
    AssociationType:
      typeof input["AssociationType"] === "string"
        ? (input["AssociationType"] as string)
        : undefined,
  };
  ctx.store.set(associationKey(sourceArn, destinationArn), stored);
  return { SourceArn: sourceArn, DestinationArn: destinationArn };
};

const AddTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as Array<{ Key: string; Value: string }>)
    : [];
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  const currentTags = existing?.Tags ?? [];
  const merged = [...currentTags];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(resourceArn), {
    ResourceArn: resourceArn,
    Tags: merged,
  });
  return { Tags: merged };
};

const AssociateTrialComponent: OperationHandler = (input, ctx) => {
  const trialComponentName = requireString(input, "TrialComponentName");
  const trialName = requireString(input, "TrialName");
  const trialComponentArn = trialComponentArnOf(
    ctx.region,
    ctx.account,
    trialComponentName,
  );
  const trialArn = trialArnOf(ctx.region, ctx.account, trialName);
  const stored: StoredTrialComponentAssociation = {
    TrialComponentName: trialComponentName,
    TrialName: trialName,
    TrialComponentArn: trialComponentArn,
    TrialArn: trialArn,
  };
  ctx.store.set(
    trialComponentAssociationKey(trialComponentName, trialName),
    stored,
  );
  return { TrialComponentArn: trialComponentArn, TrialArn: trialArn };
};

const AttachClusterNodeVolume: OperationHandler = (input, ctx) => {
  const clusterArn = requireString(input, "ClusterArn");
  const nodeId = requireString(input, "NodeId");
  const volumeId = requireString(input, "VolumeId");
  void ctx;
  return {
    ClusterArn: clusterArn,
    NodeId: nodeId,
    VolumeId: volumeId,
    AttachTime: nowSeconds(),
    Status: "attached",
    DeviceName: "/dev/xvdf",
  };
};

const BatchAddClusterNodes: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "ClusterName");
  const nodesToAdd = Array.isArray(input["NodesToAdd"])
    ? (input["NodesToAdd"] as Array<Record<string, unknown>>)
    : [];
  const successful: Array<Record<string, unknown>> = [];
  for (let i = 0; i < nodesToAdd.length; i++) {
    const node = nodesToAdd[i];
    const instanceGroupName =
      typeof node["InstanceGroupName"] === "string"
        ? node["InstanceGroupName"]
        : "default-group";
    const nodeId = `i-${nowSeconds().toString(16)}${i.toString(16).padStart(4, "0")}`;
    const nodeLogicalId =
      typeof node["NodeLogicalId"] === "string"
        ? node["NodeLogicalId"]
        : nodeId;
    const stored: StoredClusterNode = {
      ClusterName: clusterName,
      NodeId: nodeId,
      InstanceGroupName: instanceGroupName,
      Status: "Running",
    };
    ctx.store.set(clusterNodeKey(clusterName, nodeId), stored);
    successful.push({
      NodeLogicalId: nodeLogicalId,
      InstanceGroupName: instanceGroupName,
      Status: "Running",
    });
  }
  return { Successful: successful, Failed: [] };
};

const BatchDeleteClusterNodes: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "ClusterName");
  const nodeIds = Array.isArray(input["NodeIds"])
    ? (input["NodeIds"] as string[])
    : [];
  const nodeLogicalIds = Array.isArray(input["NodeLogicalIds"])
    ? (input["NodeLogicalIds"] as string[])
    : [];
  for (const nodeId of nodeIds) {
    ctx.store.delete(clusterNodeKey(clusterName, nodeId));
  }
  return {
    Failed: [],
    Successful: nodeIds,
    FailedNodeLogicalIds: [],
    SuccessfulNodeLogicalIds: nodeLogicalIds,
  };
};

const BatchDescribeModelPackage: OperationHandler = (input, ctx) => {
  const arns = Array.isArray(input["ModelPackageArnList"])
    ? (input["ModelPackageArnList"] as string[])
    : [];
  const allPackages = ctx.store
    .list<StoredModelPackage>()
    .filter((entry) => entry.key.startsWith("model-package/"))
    .map((entry) => entry.value);
  const summaries: Record<string, unknown> = {};
  for (const arn of arns) {
    const pkg = allPackages.find((p) => p.ModelPackageArn === arn);
    if (pkg !== undefined) {
      summaries[arn] = {
        ModelPackageGroupName: pkg.ModelPackageGroupName,
        ModelPackageVersion: 1,
        ModelPackageArn: pkg.ModelPackageArn,
        ModelPackageDescription: pkg.ModelPackageDescription,
        CreationTime: pkg.CreationTime,
        InferenceSpecification: undefined,
        ModelPackageStatus: pkg.ModelPackageStatus,
        ModelApprovalStatus: pkg.ModelApprovalStatus,
        ModelPackageRegistrationType: pkg.ModelPackageGroupName
          ? "MultipleApprovalRequired"
          : "SingleModel",
      };
    }
  }
  return {
    ModelPackageSummaries: summaries,
    BatchDescribeModelPackageErrorMap: {},
  };
};

const BatchRebootClusterNodes: OperationHandler = (input, _ctx) => {
  const nodeIds = Array.isArray(input["NodeIds"])
    ? (input["NodeIds"] as string[])
    : [];
  const nodeLogicalIds = Array.isArray(input["NodeLogicalIds"])
    ? (input["NodeLogicalIds"] as string[])
    : [];
  return {
    Successful: nodeIds,
    Failed: [],
    FailedNodeLogicalIds: [],
    SuccessfulNodeLogicalIds: nodeLogicalIds,
  };
};

const BatchReplaceClusterNodes: OperationHandler = (input, _ctx) => {
  const nodeIds = Array.isArray(input["NodeIds"])
    ? (input["NodeIds"] as string[])
    : [];
  const nodeLogicalIds = Array.isArray(input["NodeLogicalIds"])
    ? (input["NodeLogicalIds"] as string[])
    : [];
  return {
    Successful: nodeIds,
    Failed: [],
    FailedNodeLogicalIds: [],
    SuccessfulNodeLogicalIds: nodeLogicalIds,
  };
};

const CreateAIBenchmarkJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIBenchmarkJobName");
  const existing = ctx.store.get<StoredAIBenchmarkJob>(aiBenchmarkJobKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `AI benchmark job ${name} already exists.`,
      400,
    );
  }
  const arn = aiBenchmarkJobArnOf(ctx.region, ctx.account, name);
  const stored: StoredAIBenchmarkJob = {
    AIBenchmarkJobName: name,
    AIBenchmarkJobArn: arn,
    AIBenchmarkJobStatus: "InProgress",
    BenchmarkTarget: input["BenchmarkTarget"],
    OutputConfig: input["OutputConfig"],
    AIWorkloadConfigIdentifier: input["AIWorkloadConfigIdentifier"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(aiBenchmarkJobKey(name), stored);
  return { AIBenchmarkJobArn: arn };
};

const CreateAIRecommendationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIRecommendationJobName");
  const existing = ctx.store.get<StoredAIRecommendationJob>(
    aiRecommendationJobKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `AI recommendation job ${name} already exists.`,
      400,
    );
  }
  const arn = aiRecommendationJobArnOf(ctx.region, ctx.account, name);
  const stored: StoredAIRecommendationJob = {
    AIRecommendationJobName: name,
    AIRecommendationJobArn: arn,
    AIRecommendationJobStatus: "InProgress",
    ModelSource: input["ModelSource"],
    OutputConfig: input["OutputConfig"],
    AIWorkloadConfigIdentifier: input["AIWorkloadConfigIdentifier"],
    PerformanceTarget: input["PerformanceTarget"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(aiRecommendationJobKey(name), stored);
  return { AIRecommendationJobArn: arn };
};

const CreateAIWorkloadConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIWorkloadConfigName");
  const existing = ctx.store.get<StoredAIWorkloadConfig>(
    aiWorkloadConfigKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `AI workload config ${name} already exists.`,
      400,
    );
  }
  const arn = aiWorkloadConfigArnOf(ctx.region, ctx.account, name);
  const stored: StoredAIWorkloadConfig = {
    AIWorkloadConfigName: name,
    AIWorkloadConfigArn: arn,
    DatasetConfig: input["DatasetConfig"],
    AIWorkloadConfigs: input["AIWorkloadConfigs"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(aiWorkloadConfigKey(name), stored);
  return { AIWorkloadConfigArn: arn };
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
    DeleteNotebookInstance,
    CreatePresignedNotebookInstanceUrl,
    CreateNotebookInstanceLifecycleConfig,
    DescribeNotebookInstanceLifecycleConfig,
    DeleteNotebookInstanceLifecycleConfig,
    ListNotebookInstanceLifecycleConfigs,
    CreatePipeline,
    DescribePipeline,
    DeletePipeline,
    ListPipelineVersions,
    ListPipelineExecutions,
    DescribePipelineExecution,
    DescribePipelineDefinitionForExecution,
    ListPipelineExecutionSteps,
    ListPipelineParametersForExecution,
    CreateProcessingJob,
    DeleteProcessingJob,
    CreateTransformJob,
    CreateDomain,
    CreateApp,
    DescribeApp,
    DeleteApp,
    CreateAppImageConfig,
    DescribeAppImageConfig,
    DeleteAppImageConfig,
    DescribeAction,
    DescribeAlgorithm,
    DescribeArtifact,
    DescribeAutoMLJob,
    DescribeAutoMLJobV2,
    DescribeCluster,
    DescribeClusterEvent,
    DescribeAIBenchmarkJob,
    DescribeAIRecommendationJob,
    DescribeAIWorkloadConfig,
    CreateSpace,
    CreateUserProfile,
    CreatePresignedDomainUrl,
    CreateMlflowApp,
    CreatePresignedMlflowAppUrl,
    CreatePartnerApp,
    CreatePartnerAppPresignedUrl,
    CreateFeatureGroup,
    DeleteFeatureGroup,
    CreateHub,
    CreateHubContentPresignedUrls,
    CreateHubContentReference,
    CreateImage,
    CreateImageVersion,
    CreateInferenceComponent,
    CreateInferenceExperiment,
    CreateInferenceRecommendationsJob,
    CreateMonitoringSchedule,
    DeleteMonitoringSchedule,
    AddAssociation,
    AddTags,
    AssociateTrialComponent,
    AttachClusterNodeVolume,
    BatchAddClusterNodes,
    BatchDeleteClusterNodes,
    BatchDescribeModelPackage,
    BatchRebootClusterNodes,
    BatchReplaceClusterNodes,
    CreateAIBenchmarkJob,
    CreateAIRecommendationJob,
    CreateAIWorkloadConfig,
  },
  model,
} as const satisfies ServiceDefinition;

export default sagemaker;
