import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/sagemaker.json", { with: { type: "json" } }),
  { targetPrefix: "SageMaker" },
);

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
  MonitoringScheduleStatus: string;
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

type StoredAction = {
  ActionName: string;
  ActionArn: string;
  ActionType: string;
  Status: string;
  Source?: unknown;
  Properties?: unknown;
  Description?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredAlgorithm = {
  AlgorithmName: string;
  AlgorithmArn: string;
  AlgorithmStatus: string;
  AlgorithmDescription?: string;
  TrainingSpecification?: unknown;
  InferenceSpecification?: unknown;
  ValidationSpecification?: unknown;
  CreationTime: number;
};

type StoredArtifact = {
  ArtifactName?: string;
  ArtifactArn: string;
  ArtifactType: string;
  Source?: unknown;
  Properties?: unknown;
  Description?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredAutoMLJob = {
  AutoMLJobName: string;
  AutoMLJobArn: string;
  AutoMLJobStatus: string;
  AutoMLJobSecondaryStatus: string;
  InputDataConfig?: unknown;
  OutputDataConfig?: unknown;
  RoleArn?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredAutoMLJobV2 = {
  AutoMLJobName: string;
  AutoMLJobArn: string;
  AutoMLJobStatus: string;
  AutoMLJobSecondaryStatus: string;
  AutoMLJobInputDataConfig?: unknown;
  OutputDataConfig?: unknown;
  RoleArn?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredCluster = {
  ClusterName: string;
  ClusterArn: string;
  ClusterStatus: string;
  InstanceGroups?: unknown;
  VpcConfig?: unknown;
  CreationTime: number;
};

type StoredClusterSchedulerConfig = {
  ClusterSchedulerConfigName: string;
  ClusterSchedulerConfigArn: string;
  ClusterSchedulerConfigId: string;
  ClusterArn?: string;
  SchedulerConfig?: unknown;
  Description?: string;
  Status: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredCodeRepository = {
  CodeRepositoryName: string;
  CodeRepositoryArn: string;
  GitConfig?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredCompilationJob = {
  CompilationJobName: string;
  CompilationJobArn: string;
  CompilationJobStatus: string;
  RoleArn: string;
  InputConfig?: unknown;
  OutputConfig?: unknown;
  StoppingCondition?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredComputeQuota = {
  ComputeQuotaName: string;
  ComputeQuotaArn: string;
  ComputeQuotaId: string;
  ClusterArn?: string;
  ComputeQuotaConfig?: unknown;
  Description?: string;
  Status: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredContext = {
  ContextName: string;
  ContextArn: string;
  ContextType: string;
  Source?: unknown;
  Properties?: unknown;
  Description?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredDataQualityJobDefinition = {
  JobDefinitionName: string;
  JobDefinitionArn: string;
  DataQualityBaselineConfig?: unknown;
  DataQualityAppSpecification?: unknown;
  DataQualityJobInput?: unknown;
  DataQualityJobOutputConfig?: unknown;
  JobResources?: unknown;
  NetworkConfig?: unknown;
  RoleArn?: string;
  StoppingCondition?: unknown;
  CreationTime: number;
};

type StoredDeviceFleet = {
  DeviceFleetName: string;
  DeviceFleetArn: string;
  RoleArn?: string;
  Description?: string;
  OutputConfig?: unknown;
  CreationTime: number;
};

type StoredDevice = {
  DeviceName: string;
  DeviceFleetName: string;
  DeviceArn: string;
  IotThingName?: string;
  Description?: string;
  RegistrationTime: number;
};

type StoredEdgeDeploymentPlan = {
  EdgeDeploymentPlanName: string;
  EdgeDeploymentPlanArn: string;
  DeviceFleetName?: string;
  ModelConfigs?: unknown;
  Stages?: unknown[];
  CreationTime: number;
};

type StoredEdgePackagingJob = {
  EdgePackagingJobName: string;
  EdgePackagingJobArn: string;
  CompilationJobName?: string;
  ModelName?: string;
  ModelVersion?: string;
  RoleArn?: string;
  OutputConfig?: unknown;
  CreationTime: number;
};

type StoredExperiment = {
  ExperimentName: string;
  ExperimentArn: string;
  DisplayName?: string;
  Description?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredFlowDefinition = {
  FlowDefinitionName: string;
  FlowDefinitionArn: string;
  RoleArn?: string;
  HumanLoopConfig?: unknown;
  OutputConfig?: unknown;
  CreationTime: number;
};

type StoredHumanTaskUi = {
  HumanTaskUiName: string;
  HumanTaskUiArn: string;
  UiTemplate?: unknown;
  CreationTime: number;
};

type StoredHyperParameterTuningJob = {
  HyperParameterTuningJobName: string;
  HyperParameterTuningJobArn: string;
  HyperParameterTuningJobStatus: string;
  HyperParameterTuningJobConfig?: unknown;
  TrainingJobDefinition?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredLabelingJob = {
  LabelingJobName: string;
  LabelingJobArn: string;
  LabelingJobStatus: string;
  LabelAttributeName?: string;
  InputConfig?: unknown;
  OutputConfig?: unknown;
  RoleArn?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredMlflowTrackingServer = {
  TrackingServerName: string;
  TrackingServerArn: string;
  ArtifactStoreUri?: string;
  TrackingServerSize?: string;
  MlflowVersion?: string;
  RoleArn?: string;
  CreationTime: number;
};

type StoredOptimizationJob = {
  OptimizationJobName: string;
  OptimizationJobArn: string;
  OptimizationJobStatus: string;
  RoleArn?: string;
  ModelSource?: unknown;
  DeploymentInstanceType?: string;
  OptimizationConfigs?: unknown;
  OutputConfig?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredProject = {
  ProjectName: string;
  ProjectArn: string;
  ProjectId: string;
  ProjectDescription?: string;
  ServiceCatalogProvisioningDetails?: unknown;
  ProjectStatus: string;
  CreationTime: number;
};

type StoredStudioLifecycleConfig = {
  StudioLifecycleConfigName: string;
  StudioLifecycleConfigArn: string;
  StudioLifecycleConfigAppType: string;
  StudioLifecycleConfigContent?: string;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredTrial = {
  TrialName: string;
  TrialArn: string;
  ExperimentName: string;
  DisplayName?: string;
  MetadataProperties?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredTrialComponent = {
  TrialComponentName: string;
  TrialComponentArn: string;
  DisplayName?: string;
  Status?: unknown;
  StartTime?: number;
  EndTime?: number;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredWorkforce = {
  WorkforceName: string;
  WorkforceArn: string;
  CognitoConfig?: unknown;
  OidcConfig?: unknown;
  SourceIpConfig?: unknown;
  WorkforceVpcConfig?: unknown;
  CreationTime: number;
  LastModifiedTime: number;
};

type StoredWorkteam = {
  WorkteamName: string;
  WorkteamArn: string;
  Description: string;
  MemberDefinitions?: unknown;
  NotificationConfiguration?: unknown;
  WorkerAccessConfiguration?: unknown;
  CreateDate: number;
  LastUpdatedDate: number;
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

const idempotencyKey = (prefix: string, token: string): string =>
  `idempotency/${prefix}/${token}`;

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

const actionKey = (name: string): string => `action/${name}`;

const algorithmKey = (name: string): string => `algorithm/${name}`;

const artifactKey = (arn: string): string => `artifact/${arn}`;

const autoMLJobKey = (name: string): string => `automl-job/${name}`;

const autoMLJobV2Key = (name: string): string => `automl-job-v2/${name}`;

const clusterKey = (name: string): string => `cluster/${name}`;

const clusterSchedulerConfigKey = (name: string): string =>
  `cluster-scheduler-config/${name}`;

const codeRepositoryKey = (name: string): string => `code-repository/${name}`;

const compilationJobKey = (name: string): string => `compilation-job/${name}`;

const computeQuotaKey = (name: string): string => `compute-quota/${name}`;

const contextKey = (name: string): string => `context/${name}`;

const dataQualityJobDefinitionKey = (name: string): string =>
  `data-quality-job-definition/${name}`;

const deviceFleetKey = (name: string): string => `device-fleet/${name}`;

const deviceKey = (fleetName: string, deviceName: string): string =>
  `device/${fleetName}/${deviceName}`;

const edgeDeploymentPlanKey = (name: string): string =>
  `edge-deployment-plan/${name}`;

const edgePackagingJobKey = (name: string): string =>
  `edge-packaging-job/${name}`;

const experimentKey = (name: string): string => `experiment/${name}`;

const flowDefinitionKey = (name: string): string => `flow-definition/${name}`;

const humanTaskUiKey = (name: string): string => `human-task-ui/${name}`;

const hyperParameterTuningJobKey = (name: string): string =>
  `hyper-parameter-tuning-job/${name}`;

const labelingJobKey = (name: string): string => `labeling-job/${name}`;

const mlflowTrackingServerKey = (name: string): string =>
  `mlflow-tracking-server/${name}`;

const optimizationJobKey = (name: string): string => `optimization-job/${name}`;

const projectKey = (name: string): string => `project/${name}`;

const studioLifecycleConfigKey = (name: string): string =>
  `studio-lifecycle-config/${name}`;

const trialKey = (name: string): string => `trial/${name}`;

const trialComponentKey = (name: string): string => `trial-component/${name}`;

const workforceKey = (name: string): string => `workforce/${name}`;

const workteamKey = (name: string): string => `workteam/${name}`;

const lineageGroupPolicyKey = (name: string): string =>
  `lineage-group-policy/${name}`;

const modelPackageGroupPolicyKey = (name: string): string =>
  `model-package-group-policy/${name}`;

const portfolioStatusKey = (): string => `servicecatalog-portfolio-status`;

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

const actionArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:action/${name}`;

const algorithmArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:algorithm/${name}`;

const artifactArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:artifact/${name}`;

const autoMLJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:automl-job/${name}`;

const clusterArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:cluster/${name}`;

const clusterSchedulerConfigArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:cluster-scheduler-config/${name}`;

const codeRepositoryArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:code-repository/${name}`;

const compilationJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:compilation-job/${name}`;

const computeQuotaArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:compute-quota/${name}`;

const contextArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:context/${name}`;

const dataQualityJobDefinitionArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:data-quality-job-definition/${name}`;

const deviceFleetArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:device-fleet/${name}`;

const edgeDeploymentPlanArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:edge-deployment-plan/${name}`;

const edgePackagingJobArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:edge-packaging-job/${name}`;

const experimentArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:experiment/${name}`;

const flowDefinitionArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:flow-definition/${name}`;

const humanTaskUiArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:human-task-ui/${name}`;

const hyperParameterTuningJobArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:hyper-parameter-tuning-job/${name}`;

const labelingJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:labeling-job/${name}`;

const mlflowTrackingServerArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:mlflow-tracking-server/${name}`;

const optimizationJobArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:optimization-job/${name}`;

const trialComponentArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:experiment-trial-component/${name}`;

const trialArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:experiment-trial/${name}`;

const projectArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:project/${name}`;

const studioLifecycleConfigArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:sagemaker:${region}:${account}:studio-lifecycle-config/${name}`;

const workforceArnOf = (
  region: string,
  account: string,
  name: string,
): string => `arn:aws:sagemaker:${region}:${account}:workforce/${name}`;

const workteamArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:sagemaker:${region}:${account}:workteam/${name}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const ENDPOINT_INSERVICE_DELAY_SECS = 2 as const;

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
  const stored = requireModel(ctx, name);
  ctx.store.delete(tagsKey(stored.ModelArn));
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
  const stored = requireEndpointConfig(ctx, name);
  const inUse = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith("endpoint/"))
    .some((e) => e.value.EndpointConfigName === name);
  if (inUse) {
    throw awsError(
      "ResourceInUse",
      `EndpointConfig ${name} is currently in use by one or more endpoints.`,
      400,
    );
  }
  ctx.store.delete(tagsKey(stored.EndpointConfigArn));
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
    EndpointStatus: "Creating",
    ProductionVariants: config.ProductionVariants,
    CreationTime: at,
    LastModifiedTime: at,
  };
  ctx.store.set(endpointKey(name), stored);
  const inputTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as Array<{ Key: string; Value: string }>)
    : [];
  if (inputTags.length > 0) {
    ctx.store.set(tagsKey(arn), { ResourceArn: arn, Tags: inputTags });
  }
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
    EndpointStatus: endpointEffectiveStatus(stored),
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const endpointEffectiveStatus = (stored: StoredEndpoint): string => {
  if (
    stored.EndpointStatus === "Creating" &&
    nowSeconds() - stored.CreationTime >= ENDPOINT_INSERVICE_DELAY_SECS
  ) {
    return "InService";
  }
  if (
    stored.EndpointStatus === "Updating" &&
    nowSeconds() - stored.LastModifiedTime >= ENDPOINT_INSERVICE_DELAY_SECS
  ) {
    return "InService";
  }
  return stored.EndpointStatus;
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
  ctx.store.delete(tagsKey(stored.EndpointArn));
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
      EndpointStatus: endpointEffectiveStatus(stored),
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
  const clientToken =
    typeof input["ClientToken"] === "string"
      ? (input["ClientToken"] as string)
      : undefined;
  if (clientToken !== undefined) {
    const existingArn = ctx.store.get<string>(
      idempotencyKey("model-package", clientToken),
    );
    if (existingArn !== undefined) return { ModelPackageArn: existingArn };
  }
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
  if (clientToken !== undefined) {
    ctx.store.set(idempotencyKey("model-package", clientToken), arn);
  }
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
  const clientRequestToken =
    typeof input["ClientRequestToken"] === "string"
      ? (input["ClientRequestToken"] as string)
      : undefined;
  if (clientRequestToken !== undefined) {
    const existingArn = ctx.store.get<string>(
      idempotencyKey("pipeline", clientRequestToken),
    );
    if (existingArn !== undefined) return { PipelineArn: existingArn };
  }
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
  if (clientRequestToken !== undefined) {
    ctx.store.set(idempotencyKey("pipeline", clientRequestToken), arn);
  }
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
  const clientToken =
    typeof input["ClientToken"] === "string"
      ? (input["ClientToken"] as string)
      : undefined;
  if (clientToken !== undefined) {
    const existingArn = ctx.store.get<string>(
      idempotencyKey("partner-app", clientToken),
    );
    if (existingArn !== undefined) return { Arn: existingArn };
  }
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
  if (clientToken !== undefined) {
    ctx.store.set(idempotencyKey("partner-app", clientToken), arn);
  }
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
  const clientToken =
    typeof input["ClientToken"] === "string"
      ? (input["ClientToken"] as string)
      : undefined;
  if (clientToken !== undefined) {
    const existingArn = ctx.store.get<string>(
      idempotencyKey("image-version", clientToken),
    );
    if (existingArn !== undefined) return { ImageVersionArn: existingArn };
  }
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
  if (clientToken !== undefined) {
    ctx.store.set(idempotencyKey("image-version", clientToken), arn);
  }
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
    MonitoringScheduleStatus: "Scheduled",
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
  const stored = ctx.store.get<StoredAction>(actionKey(name));
  const arn =
    stored?.ActionArn ??
    `arn:aws:sagemaker:${ctx.region}:${ctx.account}:action/${name}`;
  const now = nowSeconds();
  return {
    ActionName: name,
    ActionArn: arn,
    ActionType: stored?.ActionType ?? "ModelDeployment",
    Status: stored?.Status ?? "Completed",
    Source: stored?.Source,
    Properties: stored?.Properties,
    Description: stored?.Description,
    CreationTime: stored?.CreationTime ?? now,
    LastModifiedTime: stored?.LastModifiedTime ?? now,
  };
};

const DescribeAlgorithm: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlgorithmName");
  const stored = ctx.store.get<StoredAlgorithm>(algorithmKey(name));
  const arn =
    stored?.AlgorithmArn ??
    `arn:aws:sagemaker:${ctx.region}:${ctx.account}:algorithm/${name}`;
  return {
    AlgorithmName: name,
    AlgorithmArn: arn,
    AlgorithmStatus: stored?.AlgorithmStatus ?? "Completed",
    AlgorithmDescription: stored?.AlgorithmDescription,
    CreationTime: stored?.CreationTime ?? nowSeconds(),
    TrainingSpecification: stored?.TrainingSpecification ?? {
      TrainingImage: `${ctx.account}.dkr.ecr.${ctx.region}.amazonaws.com/bunsai:latest`,
      SupportedTrainingInstanceTypes: ["ml.m5.xlarge"],
    },
    AlgorithmStatusDetails: {},
  };
};

const DescribeArtifact: OperationHandler = (input, ctx) => {
  const artifactArn = requireString(input, "ArtifactArn");
  const stored = ctx.store.get<StoredArtifact>(artifactKey(artifactArn));
  if (stored !== undefined) {
    return {
      ArtifactName: stored.ArtifactName,
      ArtifactArn: stored.ArtifactArn,
      ArtifactType: stored.ArtifactType,
      Source: stored.Source,
      Properties: stored.Properties,
      Description: stored.Description,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    };
  }
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
  const stored = ctx.store.get<StoredAutoMLJob>(autoMLJobKey(name));
  const arn =
    stored?.AutoMLJobArn ??
    `arn:aws:sagemaker:${ctx.region}:${ctx.account}:automl-job/${name}`;
  const now = nowSeconds();
  return {
    AutoMLJobName: name,
    AutoMLJobArn: arn,
    AutoMLJobStatus: stored?.AutoMLJobStatus ?? "Completed",
    AutoMLJobSecondaryStatus: stored?.AutoMLJobSecondaryStatus ?? "Completed",
    CreationTime: stored?.CreationTime ?? now,
    LastModifiedTime: stored?.LastModifiedTime ?? now,
    InputDataConfig: stored?.InputDataConfig ?? [],
    OutputDataConfig: stored?.OutputDataConfig ?? {
      S3OutputPath: `s3://bunsai-sagemaker/${name}/output`,
    },
    RoleArn:
      stored?.RoleArn ?? `arn:aws:iam::${ctx.account}:role/SageMakerRole`,
  };
};

const DescribeAutoMLJobV2: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoMLJobName");
  const stored = ctx.store.get<StoredAutoMLJobV2>(autoMLJobV2Key(name));
  const arn =
    stored?.AutoMLJobArn ??
    `arn:aws:sagemaker:${ctx.region}:${ctx.account}:automl-job/${name}`;
  const now = nowSeconds();
  return {
    AutoMLJobName: name,
    AutoMLJobArn: arn,
    AutoMLJobStatus: stored?.AutoMLJobStatus ?? "Completed",
    AutoMLJobSecondaryStatus: stored?.AutoMLJobSecondaryStatus ?? "Completed",
    CreationTime: stored?.CreationTime ?? now,
    LastModifiedTime: stored?.LastModifiedTime ?? now,
    AutoMLJobInputDataConfig: stored?.AutoMLJobInputDataConfig ?? [],
    OutputDataConfig: stored?.OutputDataConfig ?? {
      S3OutputPath: `s3://bunsai-sagemaker/${name}/output`,
    },
    RoleArn:
      stored?.RoleArn ?? `arn:aws:iam::${ctx.account}:role/SageMakerRole`,
  };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const stored = ctx.store.get<StoredCluster>(clusterKey(name));
  const arn =
    stored?.ClusterArn ??
    `arn:aws:sagemaker:${ctx.region}:${ctx.account}:cluster/${name}`;
  return {
    ClusterArn: arn,
    ClusterName: name,
    ClusterStatus: stored?.ClusterStatus ?? "InService",
    CreationTime: stored?.CreationTime ?? nowSeconds(),
    InstanceGroups: stored?.InstanceGroups ?? [],
    VpcConfig: stored?.VpcConfig,
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

const DeregisterDevices: OperationHandler = (input, _ctx) => {
  void requireString(input, "DeviceFleetName");
  return {};
};

const DescribeClusterNode: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "ClusterName");
  const nodeId = requireString(input, "NodeId");
  const stored = ctx.store.get<StoredClusterNode>(
    clusterNodeKey(clusterName, nodeId),
  );
  const clusterArn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:cluster/${clusterName}`;
  return {
    NodeDetails: {
      ClusterArn: clusterArn,
      NodeId: nodeId,
      InstanceGroupName: stored?.InstanceGroupName ?? "default-group",
      InstanceType: "ml.p4d.24xlarge",
      LaunchTime: nowSeconds(),
      LifeCycleConfig: { SourceS3Uri: "", OnCreate: "" },
      InstanceStorageConfigs: [],
      ThreadsPerCore: 1,
      NodeStatus: stored?.Status ?? "Running",
    },
  };
};

const DescribeClusterSchedulerConfig: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterSchedulerConfigId");
  const stored = requireClusterSchedulerConfig(ctx, id);
  return {
    ClusterSchedulerConfigName: stored.ClusterSchedulerConfigName,
    ClusterSchedulerConfigArn: stored.ClusterSchedulerConfigArn,
    ClusterSchedulerConfigId: stored.ClusterSchedulerConfigId,
    ClusterArn: stored.ClusterArn,
    SchedulerConfig: stored.SchedulerConfig,
    Description: stored.Description,
    Status: stored.Status,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeCodeRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CodeRepositoryName");
  const stored = requireCodeRepository(ctx, name);
  return {
    CodeRepositoryName: stored.CodeRepositoryName,
    CodeRepositoryArn: stored.CodeRepositoryArn,
    GitConfig: stored.GitConfig,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeCompilationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CompilationJobName");
  const stored = requireCompilationJob(ctx, name);
  return {
    CompilationJobName: stored.CompilationJobName,
    CompilationJobArn: stored.CompilationJobArn,
    CompilationJobStatus: stored.CompilationJobStatus,
    RoleArn: stored.RoleArn,
    InputConfig: stored.InputConfig,
    OutputConfig: stored.OutputConfig,
    StoppingCondition: stored.StoppingCondition,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeComputeQuota: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ComputeQuotaId");
  const stored = requireComputeQuota(ctx, id);
  return {
    ComputeQuotaName: stored.ComputeQuotaName,
    ComputeQuotaArn: stored.ComputeQuotaArn,
    ComputeQuotaId: stored.ComputeQuotaId,
    ClusterArn: stored.ClusterArn,
    ComputeQuotaConfig: stored.ComputeQuotaConfig,
    Description: stored.Description,
    Status: stored.Status,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeContext: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContextName");
  const stored = requireContext(ctx, name);
  return {
    ContextName: stored.ContextName,
    ContextArn: stored.ContextArn,
    ContextType: stored.ContextType,
    Source: stored.Source,
    Properties: stored.Properties,
    Description: stored.Description,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeDataQualityJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  const stored = requireDataQualityJobDefinition(ctx, name);
  return {
    JobDefinitionName: stored.JobDefinitionName,
    JobDefinitionArn: stored.JobDefinitionArn,
    DataQualityBaselineConfig: stored.DataQualityBaselineConfig,
    DataQualityAppSpecification: stored.DataQualityAppSpecification,
    DataQualityJobInput: stored.DataQualityJobInput,
    DataQualityJobOutputConfig: stored.DataQualityJobOutputConfig,
    JobResources: stored.JobResources,
    NetworkConfig: stored.NetworkConfig,
    RoleArn: stored.RoleArn,
    StoppingCondition: stored.StoppingCondition,
    CreationTime: stored.CreationTime,
  };
};

const DescribeDevice: OperationHandler = (input, ctx) => {
  const deviceFleetName = requireString(input, "DeviceFleetName");
  const deviceName = requireString(input, "DeviceName");
  const now = nowSeconds();
  return {
    DeviceName: deviceName,
    DeviceFleetName: deviceFleetName,
    DeviceArn: `arn:aws:sagemaker:${ctx.region}:${ctx.account}:device-fleet/${deviceFleetName}/device/${deviceName}`,
    RegistrationTime: now,
    LatestHeartbeat: now,
    Models: [],
    MaxModels: 10,
    NextToken: undefined,
  };
};

const DescribeDeviceFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeviceFleetName");
  const stored = requireDeviceFleet(ctx, name);
  return {
    DeviceFleetName: stored.DeviceFleetName,
    DeviceFleetArn: stored.DeviceFleetArn,
    OutputConfig: stored.OutputConfig,
    Description: stored.Description,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
    RoleArn: stored.RoleArn,
    IotRoleAlias: undefined,
  };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  const stored = requireDomain(ctx, id);
  return {
    DomainId: stored.DomainId,
    DomainArn: stored.DomainArn,
    DomainName: stored.DomainName,
    AuthMode: stored.AuthMode,
    Status: stored.Status,
    Url: stored.Url,
    DefaultUserSettings: stored.DefaultUserSettings,
    DomainSettings: stored.DomainSettings,
    SubnetIds: stored.SubnetIds,
    VpcId: stored.VpcId,
    AppNetworkAccessType: stored.AppNetworkAccessType,
    DefaultSpaceSettings: stored.DefaultSpaceSettings,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeEdgeDeploymentPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EdgeDeploymentPlanName");
  const stored = requireEdgeDeploymentPlan(ctx, name);
  const now = nowSeconds();
  return {
    EdgeDeploymentPlanArn: stored.EdgeDeploymentPlanArn,
    EdgeDeploymentPlanName: stored.EdgeDeploymentPlanName,
    DeviceFleetName: stored.DeviceFleetName,
    ModelConfigs: stored.ModelConfigs,
    EdgeDeploymentCreationTime: stored.CreationTime,
    EdgeDeploymentLastUpdateTime: now,
    Stages: stored.Stages ?? [],
    EdgeDeploymentSuccess: 0,
    EdgeDeploymentPending: 0,
    EdgeDeploymentFailed: 0,
  };
};

const DescribeEdgePackagingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EdgePackagingJobName");
  const stored = ctx.store.get<StoredEdgePackagingJob>(
    edgePackagingJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `EdgePackagingJob ${name} does not exist.`,
      400,
    );
  }
  return {
    EdgePackagingJobArn: stored.EdgePackagingJobArn,
    EdgePackagingJobName: stored.EdgePackagingJobName,
    CompilationJobName: stored.CompilationJobName,
    ModelName: stored.ModelName,
    ModelVersion: stored.ModelVersion,
    RoleArn: stored.RoleArn,
    OutputConfig: stored.OutputConfig,
    EdgePackagingJobStatus: "COMPLETED",
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ExperimentName");
  const stored = ctx.store.get<StoredExperiment>(experimentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Experiment ${name} does not exist.`,
      400,
    );
  }
  return {
    ExperimentName: stored.ExperimentName,
    ExperimentArn: stored.ExperimentArn,
    DisplayName: stored.DisplayName,
    Description: stored.Description,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeFeatureGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FeatureGroupName");
  const stored = requireFeatureGroup(ctx, name);
  return {
    FeatureGroupArn: stored.FeatureGroupArn,
    FeatureGroupName: stored.FeatureGroupName,
    RecordIdentifierFeatureName: stored.RecordIdentifierFeatureName,
    EventTimeFeatureName: stored.EventTimeFeatureName,
    FeatureDefinitions: stored.FeatureDefinitions ?? [],
    OnlineStoreConfig: stored.OnlineStoreConfig,
    OfflineStoreConfig: stored.OfflineStoreConfig,
    ThroughputConfig: stored.ThroughputConfig,
    RoleArn: stored.RoleArn,
    Description: stored.Description,
    FeatureGroupStatus: "Created",
    CreationTime: stored.CreationTime,
    NextToken: "",
  };
};

const DescribeFeatureMetadata: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "FeatureGroupName");
  const featureName = requireString(input, "FeatureName");
  const stored = requireFeatureGroup(ctx, groupName);
  const now = nowSeconds();
  return {
    FeatureGroupArn: stored.FeatureGroupArn,
    FeatureGroupName: stored.FeatureGroupName,
    FeatureName: featureName,
    FeatureType: "String",
    CreationTime: stored.CreationTime,
    LastModifiedTime: now,
  };
};

const DescribeFlowDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FlowDefinitionName");
  const stored = ctx.store.get<StoredFlowDefinition>(flowDefinitionKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `FlowDefinition ${name} does not exist.`,
      400,
    );
  }
  return {
    FlowDefinitionArn: stored.FlowDefinitionArn,
    FlowDefinitionName: stored.FlowDefinitionName,
    FlowDefinitionStatus: "Active",
    RoleArn: stored.RoleArn,
    HumanLoopConfig: stored.HumanLoopConfig,
    OutputConfig: stored.OutputConfig,
    CreationTime: stored.CreationTime,
  };
};

const DescribeHub: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HubName");
  const stored = requireHub(ctx, name);
  return {
    HubName: stored.HubName,
    HubArn: stored.HubArn,
    HubDescription: stored.HubDescription,
    HubDisplayName: stored.HubDisplayName,
    HubSearchKeywords: stored.HubSearchKeywords,
    S3StorageConfig: stored.S3StorageConfig,
    HubStatus: "InService",
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeHubContent: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  const contentType = requireString(input, "HubContentType");
  const contentName = requireString(input, "HubContentName");
  const contentVersion =
    typeof input["HubContentVersion"] === "string"
      ? (input["HubContentVersion"] as string)
      : "1.0.0";
  requireHub(ctx, hubName);
  const contentArn = hubContentArnOf(
    ctx.region,
    ctx.account,
    hubName,
    contentType,
    contentName,
    contentVersion,
  );
  const now = nowSeconds();
  return {
    HubName: hubName,
    HubArn: hubArnOf(ctx.region, ctx.account, hubName),
    HubContentName: contentName,
    HubContentArn: contentArn,
    HubContentVersion: contentVersion,
    HubContentType: contentType,
    HubContentStatus: "Available",
    CreationTime: now,
  };
};

const DescribeHumanTaskUi: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HumanTaskUiName");
  const stored = ctx.store.get<StoredHumanTaskUi>(humanTaskUiKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `HumanTaskUi ${name} does not exist.`,
      400,
    );
  }
  return {
    HumanTaskUiArn: stored.HumanTaskUiArn,
    HumanTaskUiName: stored.HumanTaskUiName,
    HumanTaskUiStatus: "Active",
    UiTemplate: stored.UiTemplate
      ? { Url: `https://s3.amazonaws.com/bunsai-sagemaker/${name}/template` }
      : { Url: `https://s3.amazonaws.com/bunsai-sagemaker/${name}/template` },
    CreationTime: stored.CreationTime,
  };
};

const DescribeHyperParameterTuningJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HyperParameterTuningJobName");
  const stored = ctx.store.get<StoredHyperParameterTuningJob>(
    hyperParameterTuningJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `HyperParameterTuningJob ${name} does not exist.`,
      400,
    );
  }
  return {
    HyperParameterTuningJobName: stored.HyperParameterTuningJobName,
    HyperParameterTuningJobArn: stored.HyperParameterTuningJobArn,
    HyperParameterTuningJobStatus: stored.HyperParameterTuningJobStatus,
    HyperParameterTuningJobConfig: stored.HyperParameterTuningJobConfig,
    TrainingJobDefinition: stored.TrainingJobDefinition,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    TrainingJobStatusCounters: {
      Completed: 0,
      InProgress: 0,
      RetryableError: 0,
      NonRetryableError: 0,
      Stopped: 0,
    },
    ObjectiveStatusCounters: {
      Succeeded: 0,
      Pending: 0,
      Failed: 0,
    },
  };
};

const DescribeImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ImageName");
  const stored = requireImage(ctx, name);
  return {
    ImageName: stored.ImageName,
    ImageArn: stored.ImageArn,
    RoleArn: stored.RoleArn,
    Description: stored.Description,
    DisplayName: stored.DisplayName,
    ImageStatus: "CREATED",
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeImageVersion: OperationHandler = (input, ctx) => {
  const imageName = requireString(input, "ImageName");
  const version =
    typeof input["Version"] === "number" ? (input["Version"] as number) : 1;
  const stored = ctx.store.get<StoredImageVersion>(
    imageVersionKey(imageName, version),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `ImageVersion ${imageName}/${version} does not exist.`,
      400,
    );
  }
  return {
    ImageArn: imageArnOf(ctx.region, ctx.account, imageName),
    ImageVersionArn: stored.ImageVersionArn,
    Version: stored.Version,
    BaseImage: stored.BaseImage,
    ContainerImage: stored.BaseImage,
    ImageVersionStatus: "CREATED",
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeInferenceComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InferenceComponentName");
  const stored = ctx.store.get<StoredInferenceComponent>(
    inferenceComponentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceComponent ${name} does not exist.`,
      400,
    );
  }
  return {
    InferenceComponentName: stored.InferenceComponentName,
    InferenceComponentArn: stored.InferenceComponentArn,
    EndpointName: stored.EndpointName,
    VariantName: stored.VariantName,
    Specification: stored.Specification,
    Specifications: stored.Specifications,
    RuntimeConfig: stored.RuntimeConfig,
    InferenceComponentStatus: "InService",
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeInferenceExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredInferenceExperiment>(
    inferenceExperimentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceExperiment ${name} does not exist.`,
      400,
    );
  }
  return {
    Name: stored.Name,
    Arn: stored.InferenceExperimentArn,
    Type: stored.Type,
    Status: "Running",
    RoleArn: stored.RoleArn,
    EndpointName: stored.EndpointName,
    ModelVariants: stored.ModelVariants,
    ShadowModeConfig: stored.ShadowModeConfig,
    Description: stored.Description,
    Schedule: stored.Schedule,
    DataStorageConfig: stored.DataStorageConfig,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeInferenceRecommendationsJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobName");
  const stored = ctx.store.get<StoredInferenceRecommendationsJob>(
    inferenceRecommendationsJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceRecommendationsJob ${name} does not exist.`,
      400,
    );
  }
  return {
    JobName: stored.JobName,
    JobArn: stored.JobArn,
    JobType: stored.JobType,
    Status: "COMPLETED",
    RoleArn: stored.RoleArn,
    InputConfig: stored.InputConfig,
    JobDescription: stored.JobDescription,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
    CompletionTime: stored.CreationTime,
  };
};

const DescribeLabelingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "LabelingJobName");
  const stored = ctx.store.get<StoredLabelingJob>(labelingJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `LabelingJob ${name} does not exist.`,
      400,
    );
  }
  return {
    LabelingJobName: stored.LabelingJobName,
    LabelingJobArn: stored.LabelingJobArn,
    LabelingJobStatus: stored.LabelingJobStatus,
    LabelAttributeName: stored.LabelAttributeName,
    InputConfig: stored.InputConfig,
    OutputConfig: stored.OutputConfig,
    RoleArn: stored.RoleArn,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    LabelCounters: {
      TotalLabeled: 0,
      HumanLabeled: 0,
      MachineLabeled: 0,
      FailedNonRetryableError: 0,
      Unlabeled: 0,
    },
  };
};

const DescribeLineageGroup: OperationHandler = (input, _ctx) => {
  const name = requireString(input, "LineageGroupName");
  return {
    LineageGroupName: name,
    LineageGroupArn: `arn:aws:sagemaker:us-east-1:123456789012:lineage-group/${name}`,
    DisplayName: name,
    Description: "",
    CreationTime: 0,
    LastModifiedTime: 0,
  };
};

const DescribeMlflowApp: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const stored = requireMlflowApp(ctx, arn);
  return {
    Name: stored.Name,
    Arn: stored.Arn,
    Status: "InService",
    ArtifactStoreUri: stored.ArtifactStoreUri,
    RoleArn: stored.RoleArn,
    ModelRegistrationMode: stored.ModelRegistrationMode,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeMlflowTrackingServer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrackingServerName");
  const stored = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowTrackingServer ${name} does not exist.`,
      400,
    );
  }
  return {
    TrackingServerName: stored.TrackingServerName,
    TrackingServerArn: stored.TrackingServerArn,
    TrackingServerStatus: "Created",
    ArtifactStoreUri: stored.ArtifactStoreUri,
    TrackingServerSize: stored.TrackingServerSize,
    MlflowVersion: stored.MlflowVersion,
    RoleArn: stored.RoleArn,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeMonitoringSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MonitoringScheduleName");
  const stored = requireMonitoringSchedule(ctx, name);
  return {
    MonitoringScheduleName: stored.MonitoringScheduleName,
    MonitoringScheduleArn: stored.MonitoringScheduleArn,
    MonitoringScheduleStatus: stored.MonitoringScheduleStatus,
    MonitoringScheduleConfig: stored.MonitoringScheduleConfig,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeOptimizationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptimizationJobName");
  const stored = ctx.store.get<StoredOptimizationJob>(optimizationJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `OptimizationJob ${name} does not exist.`,
      400,
    );
  }
  return {
    OptimizationJobName: stored.OptimizationJobName,
    OptimizationJobArn: stored.OptimizationJobArn,
    OptimizationJobStatus: stored.OptimizationJobStatus,
    RoleArn: stored.RoleArn,
    ModelSource: stored.ModelSource,
    DeploymentInstanceType: stored.DeploymentInstanceType,
    OptimizationConfigs: stored.OptimizationConfigs,
    OutputConfig: stored.OutputConfig,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribePartnerApp: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const stored = requirePartnerApp(ctx, arn);
  return {
    Arn: stored.Arn,
    Name: stored.Name,
    Status: "Available",
    Type: stored.Type,
    ExecutionRoleArn: stored.ExecutionRoleArn,
    Tier: stored.Tier,
    AuthType: stored.AuthType,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.CreationTime,
  };
};

const DescribeProcessingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProcessingJobName");
  const stored = requireProcessingJob(ctx, name);
  return {
    ProcessingJobName: stored.ProcessingJobName,
    ProcessingJobArn: stored.ProcessingJobArn,
    ProcessingJobStatus: stored.ProcessingJobStatus,
    AppSpecification: stored.AppSpecification,
    ProcessingInputs: stored.ProcessingInputs,
    ProcessingOutputConfig: stored.ProcessingOutputConfig,
    ProcessingResources: stored.ProcessingResources,
    RoleArn: stored.RoleArn,
    StoppingCondition: stored.StoppingCondition,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProjectName");
  const stored = ctx.store.get<StoredProject>(projectKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Project ${name} does not exist.`, 400);
  }
  return {
    ProjectName: stored.ProjectName,
    ProjectArn: stored.ProjectArn,
    ProjectId: stored.ProjectId,
    ProjectDescription: stored.ProjectDescription,
    ServiceCatalogProvisioningDetails: stored.ServiceCatalogProvisioningDetails,
    ProjectStatus: stored.ProjectStatus,
    CreationTime: stored.CreationTime,
  };
};

const DescribeReservedCapacity: OperationHandler = (input, _ctx) => {
  const arn = requireString(input, "ReservedCapacityArn");
  return {
    ReservedCapacityArn: arn,
    ReservedCapacityName: arn.split("/").pop() ?? "reserved-capacity",
    Status: "Active",
    InstanceType: "ml.p4d.24xlarge",
    TotalInstanceCount: 1,
    AvailableInstanceCount: 1,
    UsedInstanceCount: 0,
    Duration: "1Month",
    StartTime: 0,
    EndTime: 0,
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

const CreateAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ActionName");
  const existing = ctx.store.get<StoredAction>(actionKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Action ${name} already exists.`, 400);
  }
  const arn = actionArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredAction = {
    ActionName: name,
    ActionArn: arn,
    ActionType:
      typeof input["ActionType"] === "string"
        ? (input["ActionType"] as string)
        : "ModelDeployment",
    Status: "Completed",
    Source: input["Source"],
    Properties: input["Properties"],
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(actionKey(name), stored);
  return { ActionArn: arn };
};

const CreateAlgorithm: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlgorithmName");
  const existing = ctx.store.get<StoredAlgorithm>(algorithmKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Algorithm ${name} already exists.`, 400);
  }
  const arn = algorithmArnOf(ctx.region, ctx.account, name);
  const stored: StoredAlgorithm = {
    AlgorithmName: name,
    AlgorithmArn: arn,
    AlgorithmStatus: "Pending",
    AlgorithmDescription:
      typeof input["AlgorithmDescription"] === "string"
        ? (input["AlgorithmDescription"] as string)
        : undefined,
    TrainingSpecification: input["TrainingSpecification"],
    InferenceSpecification: input["InferenceSpecification"],
    ValidationSpecification: input["ValidationSpecification"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(algorithmKey(name), stored);
  return { AlgorithmArn: arn };
};

const CreateArtifact: OperationHandler = (input, ctx) => {
  const artifactType = requireString(input, "ArtifactType");
  const name =
    typeof input["ArtifactName"] === "string"
      ? (input["ArtifactName"] as string)
      : artifactType;
  const arn = artifactArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredArtifact = {
    ArtifactName:
      typeof input["ArtifactName"] === "string"
        ? (input["ArtifactName"] as string)
        : undefined,
    ArtifactArn: arn,
    ArtifactType: artifactType,
    Source: input["Source"],
    Properties: input["Properties"],
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(artifactKey(arn), stored);
  return { ArtifactArn: arn };
};

const CreateAutoMLJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoMLJobName");
  const existing = ctx.store.get<StoredAutoMLJob>(autoMLJobKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `AutoML job ${name} already exists.`, 400);
  }
  const arn = autoMLJobArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredAutoMLJob = {
    AutoMLJobName: name,
    AutoMLJobArn: arn,
    AutoMLJobStatus: "InProgress",
    AutoMLJobSecondaryStatus: "AnalyzingData",
    InputDataConfig: input["InputDataConfig"],
    OutputDataConfig: input["OutputDataConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(autoMLJobKey(name), stored);
  return { AutoMLJobArn: arn };
};

const CreateAutoMLJobV2: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoMLJobName");
  const existing = ctx.store.get<StoredAutoMLJobV2>(autoMLJobV2Key(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `AutoML job ${name} already exists.`, 400);
  }
  const arn = autoMLJobArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredAutoMLJobV2 = {
    AutoMLJobName: name,
    AutoMLJobArn: arn,
    AutoMLJobStatus: "InProgress",
    AutoMLJobSecondaryStatus: "AnalyzingData",
    AutoMLJobInputDataConfig: input["AutoMLJobInputDataConfig"],
    OutputDataConfig: input["OutputDataConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(autoMLJobV2Key(name), stored);
  return { AutoMLJobArn: arn };
};

const CreateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const existing = ctx.store.get<StoredCluster>(clusterKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Cluster ${name} already exists.`, 400);
  }
  const arn = clusterArnOf(ctx.region, ctx.account, name);
  const stored: StoredCluster = {
    ClusterName: name,
    ClusterArn: arn,
    ClusterStatus: "Creating",
    InstanceGroups: input["InstanceGroups"],
    VpcConfig: input["VpcConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(clusterKey(name), stored);
  return { ClusterArn: arn };
};

const CreateClusterSchedulerConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const existing = ctx.store.get<StoredClusterSchedulerConfig>(
    clusterSchedulerConfigKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `ClusterSchedulerConfig ${name} already exists.`,
      400,
    );
  }
  const arn = clusterSchedulerConfigArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredClusterSchedulerConfig = {
    ClusterSchedulerConfigName: name,
    ClusterSchedulerConfigArn: arn,
    ClusterSchedulerConfigId: name,
    ClusterArn:
      typeof input["ClusterArn"] === "string"
        ? (input["ClusterArn"] as string)
        : undefined,
    SchedulerConfig: input["SchedulerConfig"],
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    Status: "Creating",
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(clusterSchedulerConfigKey(name), stored);
  return {
    ClusterSchedulerConfigArn: arn,
    ClusterSchedulerConfigId: name,
  };
};

const CreateCodeRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CodeRepositoryName");
  const existing = ctx.store.get<StoredCodeRepository>(codeRepositoryKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `CodeRepository ${name} already exists.`,
      400,
    );
  }
  const arn = codeRepositoryArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredCodeRepository = {
    CodeRepositoryName: name,
    CodeRepositoryArn: arn,
    GitConfig: input["GitConfig"],
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(codeRepositoryKey(name), stored);
  return { CodeRepositoryArn: arn };
};

const CreateCompilationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CompilationJobName");
  const existing = ctx.store.get<StoredCompilationJob>(compilationJobKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `CompilationJob ${name} already exists.`,
      400,
    );
  }
  const arn = compilationJobArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredCompilationJob = {
    CompilationJobName: name,
    CompilationJobArn: arn,
    CompilationJobStatus: "INPROGRESS",
    RoleArn: requireString(input, "RoleArn"),
    InputConfig: input["InputConfig"],
    OutputConfig: input["OutputConfig"],
    StoppingCondition: input["StoppingCondition"],
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(compilationJobKey(name), stored);
  return { CompilationJobArn: arn };
};

const CreateComputeQuota: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ComputeQuotaName");
  const existing = ctx.store.get<StoredComputeQuota>(computeQuotaKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `ComputeQuota ${name} already exists.`,
      400,
    );
  }
  const arn = computeQuotaArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredComputeQuota = {
    ComputeQuotaName: name,
    ComputeQuotaArn: arn,
    ComputeQuotaId: name,
    ClusterArn:
      typeof input["ClusterArn"] === "string"
        ? (input["ClusterArn"] as string)
        : undefined,
    ComputeQuotaConfig: input["ComputeQuotaConfig"],
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    Status: "Creating",
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(computeQuotaKey(name), stored);
  return { ComputeQuotaArn: arn, ComputeQuotaId: name };
};

const CreateContext: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContextName");
  const existing = ctx.store.get<StoredContext>(contextKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Context ${name} already exists.`, 400);
  }
  const arn = contextArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredContext = {
    ContextName: name,
    ContextArn: arn,
    ContextType: requireString(input, "ContextType"),
    Source: input["Source"],
    Properties: input["Properties"],
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(contextKey(name), stored);
  return { ContextArn: arn };
};

const CreateDataQualityJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  const existing = ctx.store.get<StoredDataQualityJobDefinition>(
    dataQualityJobDefinitionKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `DataQualityJobDefinition ${name} already exists.`,
      400,
    );
  }
  const arn = dataQualityJobDefinitionArnOf(ctx.region, ctx.account, name);
  const stored: StoredDataQualityJobDefinition = {
    JobDefinitionName: name,
    JobDefinitionArn: arn,
    DataQualityBaselineConfig: input["DataQualityBaselineConfig"],
    DataQualityAppSpecification: input["DataQualityAppSpecification"],
    DataQualityJobInput: input["DataQualityJobInput"],
    DataQualityJobOutputConfig: input["DataQualityJobOutputConfig"],
    JobResources: input["JobResources"],
    NetworkConfig: input["NetworkConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    StoppingCondition: input["StoppingCondition"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(dataQualityJobDefinitionKey(name), stored);
  return { JobDefinitionArn: arn };
};

const CreateDeviceFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeviceFleetName");
  const existing = ctx.store.get<StoredDeviceFleet>(deviceFleetKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `DeviceFleet ${name} already exists.`, 400);
  }
  const arn = deviceFleetArnOf(ctx.region, ctx.account, name);
  const stored: StoredDeviceFleet = {
    DeviceFleetName: name,
    DeviceFleetArn: arn,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    OutputConfig: input["OutputConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(deviceFleetKey(name), stored);
  return {};
};

const CreateEdgeDeploymentPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EdgeDeploymentPlanName");
  const existing = ctx.store.get<StoredEdgeDeploymentPlan>(
    edgeDeploymentPlanKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `EdgeDeploymentPlan ${name} already exists.`,
      400,
    );
  }
  const arn = edgeDeploymentPlanArnOf(ctx.region, ctx.account, name);
  const stored: StoredEdgeDeploymentPlan = {
    EdgeDeploymentPlanName: name,
    EdgeDeploymentPlanArn: arn,
    DeviceFleetName:
      typeof input["DeviceFleetName"] === "string"
        ? (input["DeviceFleetName"] as string)
        : undefined,
    ModelConfigs: input["ModelConfigs"],
    Stages: Array.isArray(input["Stages"])
      ? (input["Stages"] as unknown[])
      : [],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(edgeDeploymentPlanKey(name), stored);
  return { EdgeDeploymentPlanArn: arn };
};

const CreateEdgeDeploymentStage: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "EdgeDeploymentPlanName");
  const stored = ctx.store.get<StoredEdgeDeploymentPlan>(
    edgeDeploymentPlanKey(planName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `EdgeDeploymentPlan ${planName} does not exist.`,
      400,
    );
  }
  const newStages = Array.isArray(input["Stages"])
    ? (input["Stages"] as unknown[])
    : [];
  ctx.store.set(edgeDeploymentPlanKey(planName), {
    ...stored,
    Stages: [...(stored.Stages ?? []), ...newStages],
  });
  return {};
};

const CreateEdgePackagingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EdgePackagingJobName");
  const existing = ctx.store.get<StoredEdgePackagingJob>(
    edgePackagingJobKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `EdgePackagingJob ${name} already exists.`,
      400,
    );
  }
  const arn = edgePackagingJobArnOf(ctx.region, ctx.account, name);
  const stored: StoredEdgePackagingJob = {
    EdgePackagingJobName: name,
    EdgePackagingJobArn: arn,
    CompilationJobName:
      typeof input["CompilationJobName"] === "string"
        ? (input["CompilationJobName"] as string)
        : undefined,
    ModelName:
      typeof input["ModelName"] === "string"
        ? (input["ModelName"] as string)
        : undefined,
    ModelVersion:
      typeof input["ModelVersion"] === "string"
        ? (input["ModelVersion"] as string)
        : undefined,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    OutputConfig: input["OutputConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(edgePackagingJobKey(name), stored);
  return {};
};

const CreateExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ExperimentName");
  const existing = ctx.store.get<StoredExperiment>(experimentKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Experiment ${name} already exists.`, 400);
  }
  const arn = experimentArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredExperiment = {
    ExperimentName: name,
    ExperimentArn: arn,
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : undefined,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(experimentKey(name), stored);
  return { ExperimentArn: arn };
};

const CreateFlowDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FlowDefinitionName");
  const existing = ctx.store.get<StoredFlowDefinition>(flowDefinitionKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `FlowDefinition ${name} already exists.`,
      400,
    );
  }
  const arn = flowDefinitionArnOf(ctx.region, ctx.account, name);
  const stored: StoredFlowDefinition = {
    FlowDefinitionName: name,
    FlowDefinitionArn: arn,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    HumanLoopConfig: input["HumanLoopConfig"],
    OutputConfig: input["OutputConfig"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(flowDefinitionKey(name), stored);
  return { FlowDefinitionArn: arn };
};

const CreateHumanTaskUi: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HumanTaskUiName");
  const existing = ctx.store.get<StoredHumanTaskUi>(humanTaskUiKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `HumanTaskUi ${name} already exists.`, 400);
  }
  const arn = humanTaskUiArnOf(ctx.region, ctx.account, name);
  const stored: StoredHumanTaskUi = {
    HumanTaskUiName: name,
    HumanTaskUiArn: arn,
    UiTemplate: input["UiTemplate"],
    CreationTime: nowSeconds(),
  };
  ctx.store.set(humanTaskUiKey(name), stored);
  return { HumanTaskUiArn: arn };
};

const CreateHyperParameterTuningJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HyperParameterTuningJobName");
  const existing = ctx.store.get<StoredHyperParameterTuningJob>(
    hyperParameterTuningJobKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `HyperParameterTuningJob ${name} already exists.`,
      400,
    );
  }
  const arn = hyperParameterTuningJobArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredHyperParameterTuningJob = {
    HyperParameterTuningJobName: name,
    HyperParameterTuningJobArn: arn,
    HyperParameterTuningJobStatus: "InProgress",
    HyperParameterTuningJobConfig: input["HyperParameterTuningJobConfig"],
    TrainingJobDefinition: input["TrainingJobDefinition"],
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(hyperParameterTuningJobKey(name), stored);
  return { HyperParameterTuningJobArn: arn };
};

const CreateLabelingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "LabelingJobName");
  const existing = ctx.store.get<StoredLabelingJob>(labelingJobKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `LabelingJob ${name} already exists.`, 400);
  }
  const arn = labelingJobArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredLabelingJob = {
    LabelingJobName: name,
    LabelingJobArn: arn,
    LabelingJobStatus: "InProgress",
    LabelAttributeName:
      typeof input["LabelAttributeName"] === "string"
        ? (input["LabelAttributeName"] as string)
        : undefined,
    InputConfig: input["InputConfig"],
    OutputConfig: input["OutputConfig"],
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(labelingJobKey(name), stored);
  return { LabelingJobArn: arn };
};

const CreateMlflowTrackingServer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrackingServerName");
  const existing = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `MlflowTrackingServer ${name} already exists.`,
      400,
    );
  }
  const arn = mlflowTrackingServerArnOf(ctx.region, ctx.account, name);
  const stored: StoredMlflowTrackingServer = {
    TrackingServerName: name,
    TrackingServerArn: arn,
    ArtifactStoreUri:
      typeof input["ArtifactStoreUri"] === "string"
        ? (input["ArtifactStoreUri"] as string)
        : undefined,
    TrackingServerSize:
      typeof input["TrackingServerSize"] === "string"
        ? (input["TrackingServerSize"] as string)
        : undefined,
    MlflowVersion:
      typeof input["MlflowVersion"] === "string"
        ? (input["MlflowVersion"] as string)
        : undefined,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    CreationTime: nowSeconds(),
  };
  ctx.store.set(mlflowTrackingServerKey(name), stored);
  return { TrackingServerArn: arn };
};

const CreateOptimizationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptimizationJobName");
  const existing = ctx.store.get<StoredOptimizationJob>(
    optimizationJobKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `OptimizationJob ${name} already exists.`,
      400,
    );
  }
  const arn = optimizationJobArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredOptimizationJob = {
    OptimizationJobName: name,
    OptimizationJobArn: arn,
    OptimizationJobStatus: "INPROGRESS",
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    ModelSource: input["ModelSource"],
    DeploymentInstanceType:
      typeof input["DeploymentInstanceType"] === "string"
        ? (input["DeploymentInstanceType"] as string)
        : undefined,
    OptimizationConfigs: input["OptimizationConfigs"],
    OutputConfig: input["OutputConfig"],
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(optimizationJobKey(name), stored);
  return { OptimizationJobArn: arn };
};

const CreateProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProjectName");
  const existing = ctx.store.get<StoredProject>(projectKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Project ${name} already exists.`, 400);
  }
  const arn = projectArnOf(ctx.region, ctx.account, name);
  const stored: StoredProject = {
    ProjectName: name,
    ProjectArn: arn,
    ProjectId: name,
    ProjectDescription:
      typeof input["ProjectDescription"] === "string"
        ? (input["ProjectDescription"] as string)
        : undefined,
    ServiceCatalogProvisioningDetails:
      input["ServiceCatalogProvisioningDetails"],
    ProjectStatus: "Pending",
    CreationTime: nowSeconds(),
  };
  ctx.store.set(projectKey(name), stored);
  return { ProjectArn: arn, ProjectId: name };
};

const CreateStudioLifecycleConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StudioLifecycleConfigName");
  const existing = ctx.store.get<StoredStudioLifecycleConfig>(
    studioLifecycleConfigKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Studio lifecycle config ${name} already exists.`,
      400,
    );
  }
  const arn = studioLifecycleConfigArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredStudioLifecycleConfig = {
    StudioLifecycleConfigName: name,
    StudioLifecycleConfigArn: arn,
    StudioLifecycleConfigAppType:
      typeof input["StudioLifecycleConfigAppType"] === "string"
        ? (input["StudioLifecycleConfigAppType"] as string)
        : "JupyterServer",
    StudioLifecycleConfigContent:
      typeof input["StudioLifecycleConfigContent"] === "string"
        ? (input["StudioLifecycleConfigContent"] as string)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(studioLifecycleConfigKey(name), stored);
  return { StudioLifecycleConfigArn: arn };
};

const CreateTrial: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialName");
  const existing = ctx.store.get<StoredTrial>(trialKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Trial ${name} already exists.`, 400);
  }
  const arn = trialArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredTrial = {
    TrialName: name,
    TrialArn: arn,
    ExperimentName: requireString(input, "ExperimentName"),
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : undefined,
    MetadataProperties: input["MetadataProperties"],
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(trialKey(name), stored);
  return { TrialArn: arn };
};

const CreateTrialComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialComponentName");
  const existing = ctx.store.get<StoredTrialComponent>(trialComponentKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ResourceInUse",
      `Trial component ${name} already exists.`,
      400,
    );
  }
  const arn = trialComponentArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredTrialComponent = {
    TrialComponentName: name,
    TrialComponentArn: arn,
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : undefined,
    Status: input["Status"],
    StartTime:
      typeof input["StartTime"] === "number"
        ? (input["StartTime"] as number)
        : undefined,
    EndTime:
      typeof input["EndTime"] === "number"
        ? (input["EndTime"] as number)
        : undefined,
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(trialComponentKey(name), stored);
  return { TrialComponentArn: arn };
};

const CreateWorkforce: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkforceName");
  const existing = ctx.store.get<StoredWorkforce>(workforceKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Workforce ${name} already exists.`, 400);
  }
  const arn = workforceArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredWorkforce = {
    WorkforceName: name,
    WorkforceArn: arn,
    CognitoConfig: input["CognitoConfig"],
    OidcConfig: input["OidcConfig"],
    SourceIpConfig: input["SourceIpConfig"],
    WorkforceVpcConfig: input["WorkforceVpcConfig"],
    CreationTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(workforceKey(name), stored);
  return { WorkforceArn: arn };
};

const CreateWorkteam: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkteamName");
  const existing = ctx.store.get<StoredWorkteam>(workteamKey(name));
  if (existing !== undefined) {
    throw awsError("ResourceInUse", `Workteam ${name} already exists.`, 400);
  }
  const arn = workteamArnOf(ctx.region, ctx.account, name);
  const now = nowSeconds();
  const stored: StoredWorkteam = {
    WorkteamName: name,
    WorkteamArn: arn,
    Description: requireString(input, "Description"),
    MemberDefinitions: input["MemberDefinitions"],
    NotificationConfiguration: input["NotificationConfiguration"],
    WorkerAccessConfiguration: input["WorkerAccessConfiguration"],
    CreateDate: now,
    LastUpdatedDate: now,
  };
  ctx.store.set(workteamKey(name), stored);
  return { WorkteamArn: arn };
};

const requireAIBenchmarkJob = (
  ctx: ServiceContext,
  name: string,
): StoredAIBenchmarkJob => {
  const stored = ctx.store.get<StoredAIBenchmarkJob>(aiBenchmarkJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `AI benchmark job ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteAIBenchmarkJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIBenchmarkJobName");
  requireAIBenchmarkJob(ctx, name);
  ctx.store.delete(aiBenchmarkJobKey(name));
  return {};
};

const requireAIRecommendationJob = (
  ctx: ServiceContext,
  name: string,
): StoredAIRecommendationJob => {
  const stored = ctx.store.get<StoredAIRecommendationJob>(
    aiRecommendationJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `AI recommendation job ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteAIRecommendationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIRecommendationJobName");
  requireAIRecommendationJob(ctx, name);
  ctx.store.delete(aiRecommendationJobKey(name));
  return {};
};

const requireAIWorkloadConfig = (
  ctx: ServiceContext,
  name: string,
): StoredAIWorkloadConfig => {
  const stored = ctx.store.get<StoredAIWorkloadConfig>(
    aiWorkloadConfigKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `AI workload config ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteAIWorkloadConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIWorkloadConfigName");
  requireAIWorkloadConfig(ctx, name);
  ctx.store.delete(aiWorkloadConfigKey(name));
  return {};
};

const requireAction = (ctx: ServiceContext, name: string): StoredAction => {
  const stored = ctx.store.get<StoredAction>(actionKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Action ${name} does not exist.`, 400);
  }
  return stored;
};

const DeleteAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ActionName");
  requireAction(ctx, name);
  ctx.store.delete(actionKey(name));
  return { ActionArn: actionArnOf(ctx.region, ctx.account, name) };
};

const requireAlgorithm = (
  ctx: ServiceContext,
  name: string,
): StoredAlgorithm => {
  const stored = ctx.store.get<StoredAlgorithm>(algorithmKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Algorithm ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteAlgorithm: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AlgorithmName");
  requireAlgorithm(ctx, name);
  ctx.store.delete(algorithmKey(name));
  return {};
};

const requireArtifact = (ctx: ServiceContext, arn: string): StoredArtifact => {
  const stored = ctx.store.get<StoredArtifact>(artifactKey(arn));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Artifact ${arn} does not exist.`, 400);
  }
  return stored;
};

const DeleteArtifact: OperationHandler = (input, ctx) => {
  const artifactArn = requireString(input, "ArtifactArn");
  requireArtifact(ctx, artifactArn);
  ctx.store.delete(artifactKey(artifactArn));
  return { ArtifactArn: artifactArn };
};

const DeleteAssociation: OperationHandler = (input, ctx) => {
  const sourceArn = requireString(input, "SourceArn");
  const destinationArn = requireString(input, "DestinationArn");
  const key = associationKey(sourceArn, destinationArn);
  const stored = ctx.store.get<StoredAssociation>(key);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Association from ${sourceArn} to ${destinationArn} does not exist.`,
      400,
    );
  }
  ctx.store.delete(key);
  return { SourceArn: sourceArn, DestinationArn: destinationArn };
};

const requireCluster = (ctx: ServiceContext, name: string): StoredCluster => {
  const stored = ctx.store.get<StoredCluster>(clusterKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Cluster ${name} does not exist.`, 400);
  }
  return stored;
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const stored = requireCluster(ctx, name);
  ctx.store.delete(clusterKey(name));
  return { ClusterArn: stored.ClusterArn };
};

const requireClusterSchedulerConfig = (
  ctx: ServiceContext,
  name: string,
): StoredClusterSchedulerConfig => {
  const stored = ctx.store.get<StoredClusterSchedulerConfig>(
    clusterSchedulerConfigKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `ClusterSchedulerConfig ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteClusterSchedulerConfig: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterSchedulerConfigId");
  requireClusterSchedulerConfig(ctx, id);
  ctx.store.delete(clusterSchedulerConfigKey(id));
  return {};
};

const requireCodeRepository = (
  ctx: ServiceContext,
  name: string,
): StoredCodeRepository => {
  const stored = ctx.store.get<StoredCodeRepository>(codeRepositoryKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `CodeRepository ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteCodeRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CodeRepositoryName");
  requireCodeRepository(ctx, name);
  ctx.store.delete(codeRepositoryKey(name));
  return {};
};

const requireCompilationJob = (
  ctx: ServiceContext,
  name: string,
): StoredCompilationJob => {
  const stored = ctx.store.get<StoredCompilationJob>(compilationJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `CompilationJob ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteCompilationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CompilationJobName");
  requireCompilationJob(ctx, name);
  ctx.store.delete(compilationJobKey(name));
  return {};
};

const requireComputeQuota = (
  ctx: ServiceContext,
  name: string,
): StoredComputeQuota => {
  const stored = ctx.store.get<StoredComputeQuota>(computeQuotaKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `ComputeQuota ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteComputeQuota: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ComputeQuotaId");
  requireComputeQuota(ctx, name);
  ctx.store.delete(computeQuotaKey(name));
  return {};
};

const requireContext = (ctx: ServiceContext, name: string): StoredContext => {
  const stored = ctx.store.get<StoredContext>(contextKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Context ${name} does not exist.`, 400);
  }
  return stored;
};

const DeleteContext: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContextName");
  const stored = requireContext(ctx, name);
  ctx.store.delete(contextKey(name));
  return { ContextArn: stored.ContextArn };
};

const requireDataQualityJobDefinition = (
  ctx: ServiceContext,
  name: string,
): StoredDataQualityJobDefinition => {
  const stored = ctx.store.get<StoredDataQualityJobDefinition>(
    dataQualityJobDefinitionKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `DataQualityJobDefinition ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteDataQualityJobDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobDefinitionName");
  requireDataQualityJobDefinition(ctx, name);
  ctx.store.delete(dataQualityJobDefinitionKey(name));
  return {};
};

const requireDeviceFleet = (
  ctx: ServiceContext,
  name: string,
): StoredDeviceFleet => {
  const stored = ctx.store.get<StoredDeviceFleet>(deviceFleetKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `DeviceFleet ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteDeviceFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeviceFleetName");
  requireDeviceFleet(ctx, name);
  ctx.store.delete(deviceFleetKey(name));
  return {};
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  requireDomain(ctx, id);
  ctx.store.delete(domainKey(id));
  return {};
};

const requireEdgeDeploymentPlan = (
  ctx: ServiceContext,
  name: string,
): StoredEdgeDeploymentPlan => {
  const stored = ctx.store.get<StoredEdgeDeploymentPlan>(
    edgeDeploymentPlanKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `EdgeDeploymentPlan ${name} does not exist.`,
      400,
    );
  }
  return stored;
};

const DeleteEdgeDeploymentPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EdgeDeploymentPlanName");
  requireEdgeDeploymentPlan(ctx, name);
  ctx.store.delete(edgeDeploymentPlanKey(name));
  return {};
};

const DeleteEdgeDeploymentStage: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "EdgeDeploymentPlanName");
  const stageName = requireString(input, "StageName");
  const stored = requireEdgeDeploymentPlan(ctx, planName);
  const stages = Array.isArray(stored.Stages) ? stored.Stages : [];
  const filtered = stages.filter(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      (s as Record<string, unknown>)["StageName"] !== stageName,
  );
  ctx.store.set(edgeDeploymentPlanKey(planName), {
    ...stored,
    Stages: filtered,
  });
  return {};
};

const DeleteExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ExperimentName");
  const stored = ctx.store.get<StoredExperiment>(experimentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Experiment ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(experimentKey(name));
  return { ExperimentArn: stored.ExperimentArn };
};

const DeleteFlowDefinition: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FlowDefinitionName");
  const stored = ctx.store.get<StoredFlowDefinition>(flowDefinitionKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `FlowDefinition ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(flowDefinitionKey(name));
  return {};
};

const DeleteHub: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HubName");
  requireHub(ctx, name);
  ctx.store.delete(hubKey(name));
  return {};
};

const DeleteHubContent: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  requireHub(ctx, hubName);
  return {};
};

const DeleteHubContentReference: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  requireHub(ctx, hubName);
  return {};
};

const DeleteHumanTaskUi: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HumanTaskUiName");
  const stored = ctx.store.get<StoredHumanTaskUi>(humanTaskUiKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `HumanTaskUi ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(humanTaskUiKey(name));
  return {};
};

const DeleteHyperParameterTuningJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HyperParameterTuningJobName");
  const stored = ctx.store.get<StoredHyperParameterTuningJob>(
    hyperParameterTuningJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `HyperParameterTuningJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(hyperParameterTuningJobKey(name));
  return {};
};

const DeleteImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ImageName");
  requireImage(ctx, name);
  ctx.store.delete(imageKey(name));
  return {};
};

const DeleteImageVersion: OperationHandler = (input, ctx) => {
  const imageName = requireString(input, "ImageName");
  const version =
    typeof input["Version"] === "number" ? (input["Version"] as number) : 0;
  const stored = ctx.store.get<StoredImageVersion>(
    imageVersionKey(imageName, version),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `ImageVersion ${imageName}/${version} does not exist.`,
      400,
    );
  }
  ctx.store.delete(imageVersionKey(imageName, version));
  return { ImageVersionArn: stored.ImageVersionArn };
};

const DeleteInferenceComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InferenceComponentName");
  const stored = ctx.store.get<StoredInferenceComponent>(
    inferenceComponentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceComponent ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(inferenceComponentKey(name));
  return {};
};

const DeleteInferenceExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredInferenceExperiment>(
    inferenceExperimentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceExperiment ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(inferenceExperimentKey(name));
  return { InferenceExperimentArn: stored.InferenceExperimentArn };
};

const DeleteMlflowApp: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredMlflowApp>(mlflowAppKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowApp ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(mlflowAppKey(name));
  return {};
};

const DeleteMlflowTrackingServer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrackingServerName");
  const stored = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowTrackingServer ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(mlflowTrackingServerKey(name));
  return { TrackingServerArn: stored.TrackingServerArn };
};

const DeleteOptimizationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptimizationJobName");
  const stored = ctx.store.get<StoredOptimizationJob>(optimizationJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `OptimizationJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(optimizationJobKey(name));
  return {};
};

const DeletePartnerApp: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const stored = requirePartnerApp(ctx, arn);
  ctx.store.delete(partnerAppKey(stored.Name));
  return { Arn: arn };
};

const DeleteProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProjectName");
  const stored = ctx.store.get<StoredProject>(projectKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Project ${name} does not exist.`, 400);
  }
  ctx.store.delete(projectKey(name));
  return {};
};

const DeleteSpace: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const spaceName = requireString(input, "SpaceName");
  const stored = ctx.store.get<StoredSpace>(spaceKey(domainId, spaceName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Space ${spaceName} in domain ${domainId} does not exist.`,
      400,
    );
  }
  ctx.store.delete(spaceKey(domainId, spaceName));
  return {};
};

const DeleteStudioLifecycleConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StudioLifecycleConfigName");
  const stored = ctx.store.get<StoredStudioLifecycleConfig>(
    studioLifecycleConfigKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `StudioLifecycleConfig ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(studioLifecycleConfigKey(name));
  return {};
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  if (existing !== undefined) {
    const filtered = existing.Tags.filter((t) => !tagKeys.includes(t.Key));
    ctx.store.set(tagsKey(resourceArn), {
      ResourceArn: resourceArn,
      Tags: filtered,
    });
  }
  return {};
};

const DeleteTrial: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialName");
  const stored = ctx.store.get<StoredTrial>(trialKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Trial ${name} does not exist.`, 400);
  }
  ctx.store.delete(trialKey(name));
  return { TrialArn: stored.TrialArn };
};

const DeleteTrialComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialComponentName");
  const stored = ctx.store.get<StoredTrialComponent>(trialComponentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `TrialComponent ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(trialComponentKey(name));
  return { TrialComponentArn: stored.TrialComponentArn };
};

const DeleteUserProfile: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const userProfileName = requireString(input, "UserProfileName");
  const stored = ctx.store.get<StoredUserProfile>(
    userProfileKey(domainId, userProfileName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `UserProfile ${userProfileName} in domain ${domainId} does not exist.`,
      400,
    );
  }
  ctx.store.delete(userProfileKey(domainId, userProfileName));
  return {};
};

const DeleteWorkforce: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkforceName");
  const stored = ctx.store.get<StoredWorkforce>(workforceKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Workforce ${name} does not exist.`,
      400,
    );
  }
  ctx.store.delete(workforceKey(name));
  return {};
};

const DeleteWorkteam: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkteamName");
  const stored = ctx.store.get<StoredWorkteam>(workteamKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Workteam ${name} does not exist.`, 400);
  }
  ctx.store.delete(workteamKey(name));
  return { Success: true };
};

const CreatePresignedMlflowTrackingServerUrl: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "TrackingServerName");
  const stored = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowTrackingServer ${name} does not exist.`,
      400,
    );
  }
  const url = `https://${name}.mlflow.${ctx.region}.sagemaker.aws/?token=bunsai-presigned-token`;
  return { AuthorizedUrl: url };
};

const DescribeSpace: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const spaceName = requireString(input, "SpaceName");
  const stored = ctx.store.get<StoredSpace>(spaceKey(domainId, spaceName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Space ${spaceName} in domain ${domainId} does not exist.`,
      400,
    );
  }
  return {
    DomainId: stored.DomainId,
    SpaceArn: stored.SpaceArn,
    SpaceName: stored.SpaceName,
    Status: stored.Status,
    SpaceDisplayName: stored.SpaceDisplayName,
    SpaceSettings: stored.SpaceSettings,
    OwnershipSettings: stored.OwnershipSettings,
    SpaceSharingSettings: stored.SpaceSharingSettings,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeStudioLifecycleConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "StudioLifecycleConfigName");
  const stored = ctx.store.get<StoredStudioLifecycleConfig>(
    studioLifecycleConfigKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `StudioLifecycleConfig ${name} does not exist.`,
      400,
    );
  }
  return {
    StudioLifecycleConfigArn: stored.StudioLifecycleConfigArn,
    StudioLifecycleConfigName: stored.StudioLifecycleConfigName,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
    StudioLifecycleConfigContent: stored.StudioLifecycleConfigContent,
    StudioLifecycleConfigAppType: stored.StudioLifecycleConfigAppType,
  };
};

const DescribeSubscribedWorkteam: OperationHandler = (input, _ctx) => {
  const workteamArn = requireString(input, "WorkteamArn");
  return {
    SubscribedWorkteam: {
      WorkteamArn: workteamArn,
      MarketplaceTitle: "Bunsai Subscribed Workteam",
      SellerName: "bunsai",
      MarketplaceDescription: "Synthetic subscribed workteam for testing.",
      ListingId: "bunsai-listing-id",
    },
  };
};

const DescribeTrainingPlanExtensionHistory: OperationHandler = (input, ctx) => {
  const trainingPlanArn = requireString(input, "TrainingPlanArn");
  const arnParts = trainingPlanArn.split("training-plan/");
  const name = arnParts.length > 1 ? arnParts[1] : "";
  const stored = ctx.store.get<StoredTrainingPlan>(trainingPlanKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `TrainingPlan ${trainingPlanArn} does not exist.`,
      400,
    );
  }
  return {
    TrainingPlanExtensions: [],
  };
};

const DescribeTransformJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TransformJobName");
  const stored = ctx.store.get<StoredTransformJob>(transformJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `TransformJob ${name} does not exist.`,
      400,
    );
  }
  return {
    TransformJobName: stored.TransformJobName,
    TransformJobArn: stored.TransformJobArn,
    TransformJobStatus: stored.TransformJobStatus,
    ModelName: stored.ModelName,
    TransformInput: stored.TransformInput,
    TransformOutput: stored.TransformOutput,
    TransformResources: stored.TransformResources,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeTrial: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialName");
  const stored = ctx.store.get<StoredTrial>(trialKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Trial ${name} does not exist.`, 400);
  }
  return {
    TrialName: stored.TrialName,
    TrialArn: stored.TrialArn,
    DisplayName: stored.DisplayName,
    ExperimentName: stored.ExperimentName,
    MetadataProperties: stored.MetadataProperties,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeTrialComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialComponentName");
  const stored = ctx.store.get<StoredTrialComponent>(trialComponentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `TrialComponent ${name} does not exist.`,
      400,
    );
  }
  return {
    TrialComponentName: stored.TrialComponentName,
    TrialComponentArn: stored.TrialComponentArn,
    DisplayName: stored.DisplayName,
    Status: stored.Status,
    StartTime: stored.StartTime,
    EndTime: stored.EndTime,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeUserProfile: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const userProfileName = requireString(input, "UserProfileName");
  const stored = ctx.store.get<StoredUserProfile>(
    userProfileKey(domainId, userProfileName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `UserProfile ${userProfileName} in domain ${domainId} does not exist.`,
      400,
    );
  }
  return {
    DomainId: stored.DomainId,
    UserProfileArn: stored.UserProfileArn,
    UserProfileName: stored.UserProfileName,
    Status: stored.Status,
    SingleSignOnUserIdentifier: stored.SingleSignOnUserIdentifier,
    SingleSignOnUserValue: stored.SingleSignOnUserValue,
    UserSettings: stored.UserSettings,
    CreationTime: stored.CreationTime,
    LastModifiedTime: stored.LastModifiedTime,
  };
};

const DescribeWorkforce: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkforceName");
  const stored = ctx.store.get<StoredWorkforce>(workforceKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Workforce ${name} does not exist.`,
      400,
    );
  }
  return {
    Workforce: {
      WorkforceName: stored.WorkforceName,
      WorkforceArn: stored.WorkforceArn,
      CognitoConfig: stored.CognitoConfig,
      OidcConfig: stored.OidcConfig,
      SourceIpConfig: stored.SourceIpConfig,
      WorkforceVpcConfig: stored.WorkforceVpcConfig,
      CreateDate: stored.CreationTime,
      LastUpdatedDate: stored.LastModifiedTime,
    },
  };
};

const DescribeWorkteam: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkteamName");
  const stored = ctx.store.get<StoredWorkteam>(workteamKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Workteam ${name} does not exist.`, 400);
  }
  return {
    Workteam: {
      WorkteamName: stored.WorkteamName,
      WorkteamArn: stored.WorkteamArn,
      Description: stored.Description,
      MemberDefinitions: stored.MemberDefinitions,
      NotificationConfiguration: stored.NotificationConfiguration,
      WorkerAccessConfiguration: stored.WorkerAccessConfiguration,
      CreateDate: stored.CreateDate,
      LastUpdatedDate: stored.LastUpdatedDate,
    },
  };
};

const DetachClusterNodeVolume: OperationHandler = (input, _ctx) => {
  const clusterArn = requireString(input, "ClusterArn");
  const nodeId = requireString(input, "NodeId");
  const volumeId = requireString(input, "VolumeId");
  return {
    ClusterArn: clusterArn,
    NodeId: nodeId,
    VolumeId: volumeId,
    AttachTime: nowSeconds(),
    Status: "detached",
    DeviceName: "/dev/xvdf",
  };
};

const DisableSagemakerServicecatalogPortfolio: OperationHandler = (
  _input,
  ctx,
) => {
  ctx.store.set(portfolioStatusKey(), { Status: "Disabled" });
  return {};
};

const DisassociateTrialComponent: OperationHandler = (input, ctx) => {
  const trialComponentName = requireString(input, "TrialComponentName");
  const trialName = requireString(input, "TrialName");
  const stored = ctx.store.get<StoredTrialComponentAssociation>(
    trialComponentAssociationKey(trialComponentName, trialName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Association between trial component ${trialComponentName} and trial ${trialName} does not exist.`,
      400,
    );
  }
  ctx.store.delete(trialComponentAssociationKey(trialComponentName, trialName));
  return {
    TrialComponentArn: stored.TrialComponentArn,
    TrialArn: stored.TrialArn,
  };
};

const EnableSagemakerServicecatalogPortfolio: OperationHandler = (
  _input,
  ctx,
) => {
  ctx.store.set(portfolioStatusKey(), { Status: "Enabled" });
  return {};
};

const ExtendTrainingPlan: OperationHandler = (input, ctx) => {
  const offeringId = requireString(input, "TrainingPlanExtensionOfferingId");
  void ctx;
  const now = nowSeconds();
  return {
    TrainingPlanExtensions: [
      {
        TrainingPlanExtensionOfferingId: offeringId,
        ExtendedAt: now,
        StartDate: now,
        EndDate: now + 86400,
        Status: "Active",
        PaymentStatus: "Completed",
      },
    ],
  };
};

const GetDeviceFleetReport: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeviceFleetName");
  const stored = requireDeviceFleet(ctx, name);
  return {
    DeviceFleetArn: stored.DeviceFleetArn,
    DeviceFleetName: stored.DeviceFleetName,
    Description: stored.Description,
    OutputConfig: stored.OutputConfig,
    ReportGenerated: nowSeconds(),
    DeviceStats: { ConnectedDeviceCount: 0, RegisteredDeviceCount: 0 },
    AgentVersions: [],
    ModelStats: [],
  };
};

const GetLineageGroupPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "LineageGroupName");
  const stored = ctx.store.get<{
    LineageGroupArn: string;
    ResourcePolicy: string;
  }>(lineageGroupPolicyKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Lineage group ${name} does not exist.`,
      400,
    );
  }
  return {
    LineageGroupArn: stored.LineageGroupArn,
    ResourcePolicy: stored.ResourcePolicy,
  };
};

const GetModelPackageGroupPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageGroupName");
  const stored = ctx.store.get<{
    ModelPackageGroupArn: string;
    ResourcePolicy: string;
  }>(modelPackageGroupPolicyKey(name));
  if (stored === undefined) {
    const group = ctx.store.get<StoredModelPackageGroup>(
      modelPackageGroupKey(name),
    );
    if (group === undefined) {
      throw awsError(
        "ResourceNotFound",
        `Model package group ${name} does not exist.`,
        400,
      );
    }
    return { ResourcePolicy: "" };
  }
  return { ResourcePolicy: stored.ResourcePolicy };
};

const GetSagemakerServicecatalogPortfolioStatus: OperationHandler = (
  _input,
  ctx,
) => {
  const stored = ctx.store.get<{ Status: string }>(portfolioStatusKey());
  return { Status: stored?.Status ?? "Disabled" };
};

const GetScalingConfigurationRecommendation: OperationHandler = (
  input,
  ctx,
) => {
  const jobName = requireString(input, "InferenceRecommendationsJobName");
  const stored = ctx.store.get<StoredInferenceRecommendationsJob>(
    inferenceRecommendationsJobKey(jobName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Inference recommendations job ${jobName} does not exist.`,
      400,
    );
  }
  return {
    InferenceRecommendationsJobName: stored.JobName,
    RecommendationId: input["RecommendationId"],
    EndpointName: input["EndpointName"],
    TargetCpuUtilizationPerCore: input["TargetCpuUtilizationPerCore"] ?? 50,
    ScalingPolicyObjective: input["ScalingPolicyObjective"],
    Metric: undefined,
    DynamicScalingConfiguration: { MinCapacity: 1, MaxCapacity: 10 },
  };
};

const GetSearchSuggestions: OperationHandler = (_input, _ctx) => {
  return { PropertyNameSuggestions: [] };
};

const ImportHubContent: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  const contentName = requireString(input, "HubContentName");
  const contentType = requireString(input, "HubContentType");
  const hub = requireHub(ctx, hubName);
  const contentVersion =
    typeof input["HubContentVersion"] === "string"
      ? (input["HubContentVersion"] as string)
      : "1.0.0";
  const hubContentArn = hubContentArnOf(
    ctx.region,
    ctx.account,
    hubName,
    contentType,
    contentName,
    contentVersion,
  );
  return { HubArn: hub.HubArn, HubContentArn: hubContentArn };
};

const ListAIWorkloadConfigs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let configs = ctx.store
    .list<StoredAIWorkloadConfig>()
    .filter((entry) => entry.key.startsWith("ai-workload-config/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    configs = configs.filter((c) =>
      c.AIWorkloadConfigName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    configs = configs.slice(0, maxResults);
  }
  return {
    AIWorkloadConfigs: configs.map((stored) => ({
      AIWorkloadConfigName: stored.AIWorkloadConfigName,
      AIWorkloadConfigArn: stored.AIWorkloadConfigArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListActions: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let actions = ctx.store
    .list<StoredAction>()
    .filter((entry) => entry.key.startsWith("action/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    actions = actions.slice(0, maxResults);
  }
  return {
    ActionSummaries: actions.map((stored) => ({
      ActionName: stored.ActionName,
      ActionArn: stored.ActionArn,
      ActionType: stored.ActionType,
      Status: stored.Status,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListAlgorithms: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let algorithms = ctx.store
    .list<StoredAlgorithm>()
    .filter((entry) => entry.key.startsWith("algorithm/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.AlgorithmName.localeCompare(b.AlgorithmName));
  if (nameContains !== undefined) {
    algorithms = algorithms.filter((a) =>
      a.AlgorithmName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    algorithms = algorithms.slice(0, maxResults);
  }
  return {
    AlgorithmSummaryList: algorithms.map((stored) => ({
      AlgorithmName: stored.AlgorithmName,
      AlgorithmArn: stored.AlgorithmArn,
      AlgorithmStatus: stored.AlgorithmStatus,
      CreationTime: stored.CreationTime,
      AlgorithmDescription: stored.AlgorithmDescription,
    })),
  };
};

const ListAliases: OperationHandler = (_input, _ctx) => {
  return { SageMakerImageVersionAliases: [] };
};

const ListAppImageConfigs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let configs = ctx.store
    .list<StoredAppImageConfig>()
    .filter((entry) => entry.key.startsWith("app-image-config/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    configs = configs.filter((c) =>
      c.AppImageConfigName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    configs = configs.slice(0, maxResults);
  }
  return {
    AppImageConfigs: configs.map((stored) => ({
      AppImageConfigName: stored.AppImageConfigName,
      AppImageConfigArn: stored.AppImageConfigArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListApps: OperationHandler = (input, ctx) => {
  const domainIdEquals =
    typeof input["DomainIdEquals"] === "string"
      ? (input["DomainIdEquals"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let apps = ctx.store
    .list<StoredApp>()
    .filter((entry) => entry.key.startsWith("app/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (domainIdEquals !== undefined) {
    apps = apps.filter((a) => a.DomainId === domainIdEquals);
  }
  if (maxResults !== undefined) {
    apps = apps.slice(0, maxResults);
  }
  return {
    Apps: apps.map((stored) => ({
      DomainId: stored.DomainId,
      AppType: stored.AppType,
      AppName: stored.AppName,
      AppArn: stored.AppArn,
      Status: stored.Status,
      UserProfileName: stored.UserProfileName,
      SpaceName: stored.SpaceName,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListArtifacts: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let artifacts = ctx.store
    .list<StoredArtifact>()
    .filter((entry) => entry.key.startsWith("artifact/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    artifacts = artifacts.slice(0, maxResults);
  }
  return {
    ArtifactSummaries: artifacts.map((stored) => ({
      ArtifactArn: stored.ArtifactArn,
      ArtifactType: stored.ArtifactType,
      ArtifactName: stored.ArtifactName,
      Source: stored.Source,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListAssociations: OperationHandler = (input, ctx) => {
  const sourceArn =
    typeof input["SourceArn"] === "string"
      ? (input["SourceArn"] as string)
      : undefined;
  const destinationArn =
    typeof input["DestinationArn"] === "string"
      ? (input["DestinationArn"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let associations = ctx.store
    .list<StoredAssociation>()
    .filter((entry) => entry.key.startsWith("association/"))
    .map((entry) => entry.value);
  if (sourceArn !== undefined) {
    associations = associations.filter((a) => a.SourceArn === sourceArn);
  }
  if (destinationArn !== undefined) {
    associations = associations.filter(
      (a) => a.DestinationArn === destinationArn,
    );
  }
  if (maxResults !== undefined) {
    associations = associations.slice(0, maxResults);
  }
  return {
    AssociationSummaries: associations.map((stored) => ({
      SourceArn: stored.SourceArn,
      DestinationArn: stored.DestinationArn,
      AssociationType: stored.AssociationType,
    })),
  };
};

const ListAutoMLJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const v1Jobs = ctx.store
    .list<StoredAutoMLJob>()
    .filter((entry) => entry.key.startsWith("automl-job/"))
    .map((entry) => entry.value);
  const v2Jobs = ctx.store
    .list<StoredAutoMLJobV2>()
    .filter((entry) => entry.key.startsWith("automl-job-v2/"))
    .map((entry) => entry.value);
  let jobs = [...v1Jobs, ...v2Jobs].sort(
    (a, b) => b.CreationTime - a.CreationTime,
  );
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.AutoMLJobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    AutoMLJobSummaries: jobs.map((stored) => ({
      AutoMLJobName: stored.AutoMLJobName,
      AutoMLJobArn: stored.AutoMLJobArn,
      AutoMLJobStatus: stored.AutoMLJobStatus,
      AutoMLJobSecondaryStatus: stored.AutoMLJobSecondaryStatus,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListCandidatesForAutoMLJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "AutoMLJobName");
  const v1 = ctx.store.get<StoredAutoMLJob>(autoMLJobKey(jobName));
  const v2 = ctx.store.get<StoredAutoMLJobV2>(autoMLJobV2Key(jobName));
  if (v1 === undefined && v2 === undefined) {
    throw awsError(
      "ResourceNotFound",
      `AutoML job ${jobName} does not exist.`,
      400,
    );
  }
  return { Candidates: [] };
};

const ListClusterEvents: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "ClusterName");
  requireCluster(ctx, clusterName);
  return { Events: [] };
};

const ListClusterNodes: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "ClusterName");
  requireCluster(ctx, clusterName);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let nodes = ctx.store
    .list<StoredClusterNode>()
    .filter((entry) => entry.key.startsWith(`cluster-node/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.NodeId.localeCompare(b.NodeId));
  if (maxResults !== undefined) {
    nodes = nodes.slice(0, maxResults);
  }
  return {
    ClusterNodeSummaries: nodes.map((stored) => ({
      InstanceGroupName: stored.InstanceGroupName,
      NodeId: stored.NodeId,
      NodeStatus: stored.Status,
    })),
  };
};

const ListAIBenchmarkJobs: OperationHandler = (_input, ctx) => {
  const jobs = ctx.store
    .list<StoredAIBenchmarkJob>()
    .filter((entry) => entry.key.startsWith("ai-benchmark-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  return {
    AIBenchmarkJobs: jobs.map((stored) => ({
      AIBenchmarkJobName: stored.AIBenchmarkJobName,
      AIBenchmarkJobArn: stored.AIBenchmarkJobArn,
      AIBenchmarkJobStatus: stored.AIBenchmarkJobStatus,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListAIRecommendationJobs: OperationHandler = (_input, ctx) => {
  const jobs = ctx.store
    .list<StoredAIRecommendationJob>()
    .filter((entry) => entry.key.startsWith("ai-recommendation-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  return {
    AIRecommendationJobs: jobs.map((stored) => ({
      AIRecommendationJobName: stored.AIRecommendationJobName,
      AIRecommendationJobArn: stored.AIRecommendationJobArn,
      AIRecommendationJobStatus: stored.AIRecommendationJobStatus,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListClusterSchedulerConfigs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const clusterArn =
    typeof input["ClusterArn"] === "string"
      ? (input["ClusterArn"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let configs = ctx.store
    .list<StoredClusterSchedulerConfig>()
    .filter((entry) => entry.key.startsWith("cluster-scheduler-config/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    configs = configs.filter((c) =>
      c.ClusterSchedulerConfigName.includes(nameContains),
    );
  }
  if (clusterArn !== undefined) {
    configs = configs.filter((c) => c.ClusterArn === clusterArn);
  }
  if (maxResults !== undefined) {
    configs = configs.slice(0, maxResults);
  }
  return {
    ClusterSchedulerConfigSummaries: configs.map((stored) => ({
      ClusterSchedulerConfigName: stored.ClusterSchedulerConfigName,
      ClusterSchedulerConfigArn: stored.ClusterSchedulerConfigArn,
      ClusterSchedulerConfigId: stored.ClusterSchedulerConfigId,
      ClusterArn: stored.ClusterArn,
      Status: stored.Status,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListClusters: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    clusters = clusters.filter((c) => c.ClusterName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    clusters = clusters.slice(0, maxResults);
  }
  return {
    ClusterSummaries: clusters.map((stored) => ({
      ClusterName: stored.ClusterName,
      ClusterArn: stored.ClusterArn,
      ClusterStatus: stored.ClusterStatus,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListCodeRepositories: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let repos = ctx.store
    .list<StoredCodeRepository>()
    .filter((entry) => entry.key.startsWith("code-repository/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.CodeRepositoryName.localeCompare(b.CodeRepositoryName));
  if (nameContains !== undefined) {
    repos = repos.filter((r) => r.CodeRepositoryName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    repos = repos.slice(0, maxResults);
  }
  return {
    CodeRepositorySummaryList: repos.map((stored) => ({
      CodeRepositoryName: stored.CodeRepositoryName,
      CodeRepositoryArn: stored.CodeRepositoryArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      GitConfig: stored.GitConfig,
    })),
  };
};

const ListCompilationJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredCompilationJob>()
    .filter((entry) => entry.key.startsWith("compilation-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.CompilationJobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    CompilationJobSummaries: jobs.map((stored) => ({
      CompilationJobName: stored.CompilationJobName,
      CompilationJobArn: stored.CompilationJobArn,
      CompilationJobStatus: stored.CompilationJobStatus,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListComputeQuotas: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let quotas = ctx.store
    .list<StoredComputeQuota>()
    .filter((entry) => entry.key.startsWith("compute-quota/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    quotas = quotas.filter((q) => q.ComputeQuotaName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    quotas = quotas.slice(0, maxResults);
  }
  return {
    ComputeQuotaSummaries: quotas.map((stored) => ({
      ComputeQuotaName: stored.ComputeQuotaName,
      ComputeQuotaArn: stored.ComputeQuotaArn,
      ComputeQuotaId: stored.ComputeQuotaId,
      Status: stored.Status,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListContexts: OperationHandler = (input, ctx) => {
  const contextType =
    typeof input["ContextType"] === "string"
      ? (input["ContextType"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let contexts = ctx.store
    .list<StoredContext>()
    .filter((entry) => entry.key.startsWith("context/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (contextType !== undefined) {
    contexts = contexts.filter((c) => c.ContextType === contextType);
  }
  if (maxResults !== undefined) {
    contexts = contexts.slice(0, maxResults);
  }
  return {
    ContextSummaries: contexts.map((stored) => ({
      ContextName: stored.ContextName,
      ContextArn: stored.ContextArn,
      ContextType: stored.ContextType,
      Source: stored.Source,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListDataQualityJobDefinitions: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let defs = ctx.store
    .list<StoredDataQualityJobDefinition>()
    .filter((entry) => entry.key.startsWith("data-quality-job-definition/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    defs = defs.filter((d) => d.JobDefinitionName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    defs = defs.slice(0, maxResults);
  }
  return {
    JobDefinitionSummaries: defs.map((stored) => ({
      MonitoringJobDefinitionName: stored.JobDefinitionName,
      MonitoringJobDefinitionArn: stored.JobDefinitionArn,
      CreationTime: stored.CreationTime,
      EndpointName: "",
    })),
  };
};

const ListDeviceFleets: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let fleets = ctx.store
    .list<StoredDeviceFleet>()
    .filter((entry) => entry.key.startsWith("device-fleet/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    fleets = fleets.filter((f) => f.DeviceFleetName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    fleets = fleets.slice(0, maxResults);
  }
  return {
    DeviceFleetSummaries: fleets.map((stored) => ({
      DeviceFleetName: stored.DeviceFleetName,
      DeviceFleetArn: stored.DeviceFleetArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListDevices: OperationHandler = (input, ctx) => {
  const fleetName =
    typeof input["DeviceFleetName"] === "string"
      ? (input["DeviceFleetName"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let devices = ctx.store
    .list<StoredDevice>()
    .filter((entry) => entry.key.startsWith("device/"))
    .map((entry) => entry.value);
  if (fleetName !== undefined) {
    devices = devices.filter((d) => d.DeviceFleetName === fleetName);
  }
  if (maxResults !== undefined) {
    devices = devices.slice(0, maxResults);
  }
  return {
    DeviceSummaries: devices.map((stored) => ({
      DeviceName: stored.DeviceName,
      DeviceFleetName: stored.DeviceFleetName,
      DeviceArn: stored.DeviceArn,
      IotThingName: stored.IotThingName,
      Description: stored.Description,
      RegistrationTime: stored.RegistrationTime,
    })),
  };
};

const ListDomains: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let domains = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith("domain/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    domains = domains.slice(0, maxResults);
  }
  return {
    Domains: domains.map((stored) => ({
      DomainId: stored.DomainId,
      DomainArn: stored.DomainArn,
      DomainName: stored.DomainName,
      Status: stored.Status,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      Url: stored.Url,
    })),
  };
};

const ListEdgeDeploymentPlans: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let plans = ctx.store
    .list<StoredEdgeDeploymentPlan>()
    .filter((entry) => entry.key.startsWith("edge-deployment-plan/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    plans = plans.filter((p) =>
      p.EdgeDeploymentPlanName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    plans = plans.slice(0, maxResults);
  }
  return {
    EdgeDeploymentPlanSummaries: plans.map((stored) => ({
      EdgeDeploymentPlanName: stored.EdgeDeploymentPlanName,
      EdgeDeploymentPlanArn: stored.EdgeDeploymentPlanArn,
      DeviceFleetName: stored.DeviceFleetName ?? "",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListEdgePackagingJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredEdgePackagingJob>()
    .filter((entry) => entry.key.startsWith("edge-packaging-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.EdgePackagingJobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    EdgePackagingJobSummaries: jobs.map((stored) => ({
      EdgePackagingJobName: stored.EdgePackagingJobName,
      EdgePackagingJobArn: stored.EdgePackagingJobArn,
      EdgePackagingJobStatus: "COMPLETED",
      ModelName: stored.ModelName,
      ModelVersion: stored.ModelVersion,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListExperiments: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let experiments = ctx.store
    .list<StoredExperiment>()
    .filter((entry) => entry.key.startsWith("experiment/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    experiments = experiments.slice(0, maxResults);
  }
  return {
    ExperimentSummaries: experiments.map((stored) => ({
      ExperimentArn: stored.ExperimentArn,
      ExperimentName: stored.ExperimentName,
      DisplayName: stored.DisplayName,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListFeatureGroups: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let groups = ctx.store
    .list<StoredFeatureGroup>()
    .filter((entry) => entry.key.startsWith("feature-group/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    groups = groups.filter((g) => g.FeatureGroupName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    groups = groups.slice(0, maxResults);
  }
  return {
    FeatureGroupSummaries: groups.map((stored) => ({
      FeatureGroupName: stored.FeatureGroupName,
      FeatureGroupArn: stored.FeatureGroupArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListFlowDefinitions: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let defs = ctx.store
    .list<StoredFlowDefinition>()
    .filter((entry) => entry.key.startsWith("flow-definition/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    defs = defs.slice(0, maxResults);
  }
  return {
    FlowDefinitionSummaries: defs.map((stored) => ({
      FlowDefinitionName: stored.FlowDefinitionName,
      FlowDefinitionArn: stored.FlowDefinitionArn,
      FlowDefinitionStatus: "Active",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListHubContentVersions: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  requireHub(ctx, hubName);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let items = ctx.store
    .list<unknown>()
    .filter((entry) => entry.key.startsWith(`hub-content/${hubName}/`))
    .map(() => ({}));
  if (maxResults !== undefined) {
    items = items.slice(0, maxResults);
  }
  return { HubContentSummaries: items };
};

const ListHubContents: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  requireHub(ctx, hubName);
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let items = ctx.store
    .list<unknown>()
    .filter((entry) => entry.key.startsWith(`hub-content/${hubName}/`));
  if (nameContains !== undefined) {
    items = items.filter((e) => e.key.includes(nameContains));
  }
  if (maxResults !== undefined) {
    items = items.slice(0, maxResults);
  }
  return { HubContentSummaries: items.map(() => ({})) };
};

const ListHubs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let hubs = ctx.store
    .list<StoredHub>()
    .filter((entry) => entry.key.startsWith("hub/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    hubs = hubs.filter((h) => h.HubName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    hubs = hubs.slice(0, maxResults);
  }
  return {
    HubSummaries: hubs.map((stored) => ({
      HubName: stored.HubName,
      HubArn: stored.HubArn,
      HubDescription: stored.HubDescription,
      HubDisplayName: stored.HubDisplayName,
      HubStatus: "InService",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListHumanTaskUis: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let uis = ctx.store
    .list<StoredHumanTaskUi>()
    .filter((entry) => entry.key.startsWith("human-task-ui/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    uis = uis.slice(0, maxResults);
  }
  return {
    HumanTaskUiSummaries: uis.map((stored) => ({
      HumanTaskUiName: stored.HumanTaskUiName,
      HumanTaskUiArn: stored.HumanTaskUiArn,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListHyperParameterTuningJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredHyperParameterTuningJob>()
    .filter((entry) => entry.key.startsWith("hyper-parameter-tuning-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) =>
      j.HyperParameterTuningJobName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    HyperParameterTuningJobSummaries: jobs.map((stored) => ({
      HyperParameterTuningJobName: stored.HyperParameterTuningJobName,
      HyperParameterTuningJobArn: stored.HyperParameterTuningJobArn,
      HyperParameterTuningJobStatus: stored.HyperParameterTuningJobStatus,
      Strategy: "Bayesian",
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      TrainingJobStatusCounters: {
        Completed: 0,
        InProgress: 0,
        RetryableError: 0,
        NonRetryableError: 0,
        Stopped: 0,
      },
      ObjectiveStatusCounters: {
        Succeeded: 0,
        Pending: 0,
        Failed: 0,
      },
    })),
  };
};

const ListImageVersions: OperationHandler = (input, ctx) => {
  const imageName = requireString(input, "ImageName");
  requireImage(ctx, imageName);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let versions = ctx.store
    .list<StoredImageVersion>()
    .filter((entry) => entry.key.startsWith(`image-version/${imageName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    versions = versions.slice(0, maxResults);
  }
  return {
    ImageVersions: versions.map((stored) => ({
      ImageVersionArn: stored.ImageVersionArn,
      ImageArn: ctx.store.get<StoredImage>(imageKey(imageName))?.ImageArn,
      Version: stored.Version,
      ImageVersionStatus: "CREATED",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListImages: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let images = ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith("image/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    images = images.filter((img) => img.ImageName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    images = images.slice(0, maxResults);
  }
  return {
    Images: images.map((stored) => ({
      ImageName: stored.ImageName,
      ImageArn: stored.ImageArn,
      DisplayName: stored.DisplayName,
      Description: stored.Description,
      ImageStatus: "CREATED",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListInferenceComponents: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let components = ctx.store
    .list<StoredInferenceComponent>()
    .filter((entry) => entry.key.startsWith("inference-component/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    components = components.filter((c) =>
      c.InferenceComponentName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    components = components.slice(0, maxResults);
  }
  return {
    InferenceComponents: components.map((stored) => ({
      InferenceComponentName: stored.InferenceComponentName,
      InferenceComponentArn: stored.InferenceComponentArn,
      EndpointName: stored.EndpointName,
      VariantName: stored.VariantName,
      InferenceComponentStatus: "InService",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListInferenceExperiments: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let experiments = ctx.store
    .list<StoredInferenceExperiment>()
    .filter((entry) => entry.key.startsWith("inference-experiment/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    experiments = experiments.filter((e) => e.Name.includes(nameContains));
  }
  if (maxResults !== undefined) {
    experiments = experiments.slice(0, maxResults);
  }
  return {
    InferenceExperiments: experiments.map((stored) => ({
      Name: stored.Name,
      Type: stored.Type,
      Status: "Running",
      Description: stored.Description,
      RoleArn: stored.RoleArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.CreationTime,
    })),
  };
};

const ListInferenceRecommendationsJobSteps: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Steps: [] };
};

const ListInferenceRecommendationsJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredInferenceRecommendationsJob>()
    .filter((entry) => entry.key.startsWith("inference-recommendations-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.JobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    InferenceRecommendationsJobs: jobs.map((stored) => ({
      JobName: stored.JobName,
      JobDescription: stored.JobDescription ?? "",
      JobType: stored.JobType,
      JobArn: stored.JobArn,
      Status: "COMPLETED",
      CreationTime: stored.CreationTime,
      RoleArn: stored.RoleArn,
      LastModifiedTime: stored.CreationTime,
    })),
  };
};

const ListLabelingJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredLabelingJob>()
    .filter((entry) => entry.key.startsWith("labeling-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.LabelingJobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    LabelingJobSummaryList: jobs.map((stored) => ({
      LabelingJobName: stored.LabelingJobName,
      LabelingJobArn: stored.LabelingJobArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      LabelingJobStatus: stored.LabelingJobStatus,
      LabelCounters: {},
      WorkteamArn: "",
    })),
  };
};

const ListLabelingJobsForWorkteam: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredLabelingJob>()
    .filter((entry) => entry.key.startsWith("labeling-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    LabelingJobSummaryList: jobs.map((stored) => ({
      LabelingJobName: stored.LabelingJobName,
      JobReferenceCode: stored.LabelingJobArn,
      WorkRequesterAccountId: ctx.account,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListLineageGroups: OperationHandler = (_input, _ctx) => {
  return { LineageGroupSummaries: [] };
};

const ListMlflowApps: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let apps = ctx.store
    .list<StoredMlflowApp>()
    .filter((entry) => entry.key.startsWith("mlflow-app/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    apps = apps.slice(0, maxResults);
  }
  return {
    Summaries: apps.map((stored) => ({
      Arn: stored.Arn,
      Name: stored.Name,
      Status: "InService",
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListMlflowTrackingServers: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let servers = ctx.store
    .list<StoredMlflowTrackingServer>()
    .filter((entry) => entry.key.startsWith("mlflow-tracking-server/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    servers = servers.slice(0, maxResults);
  }
  return {
    TrackingServerSummaries: servers.map((stored) => ({
      TrackingServerArn: stored.TrackingServerArn,
      TrackingServerName: stored.TrackingServerName,
      CreationTime: stored.CreationTime,
      TrackingServerStatus: "Created",
      MlflowVersion: stored.MlflowVersion,
    })),
  };
};

const ListModelBiasJobDefinitions: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let defs = ctx.store
    .list<StoredModelBiasJobDefinition>()
    .filter((entry) => entry.key.startsWith("model-bias-job-definition/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    defs = defs.filter((d) => d.JobDefinitionName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    defs = defs.slice(0, maxResults);
  }
  return {
    JobDefinitionSummaries: defs.map((stored) => ({
      MonitoringJobDefinitionName: stored.JobDefinitionName,
      MonitoringJobDefinitionArn: stored.JobDefinitionArn,
      CreationTime: stored.CreationTime,
      EndpointName: "",
    })),
  };
};

const ListModelCardExportJobs: OperationHandler = (input, ctx) => {
  const modelCardName = requireString(input, "ModelCardName");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredModelCardExportJob>()
    .filter((entry) => entry.key.startsWith("model-card-export-job/"))
    .map((entry) => entry.value)
    .filter((j) => j.ModelCardName === modelCardName)
    .sort((a, b) => b.CreatedAt - a.CreatedAt);
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    ModelCardExportJobSummaries: jobs.map((stored) => ({
      ModelCardExportJobName: stored.ModelCardExportJobName,
      ModelCardExportJobArn: stored.ModelCardExportJobArn,
      Status: stored.Status,
      ModelCardName: stored.ModelCardName,
      ModelCardVersion: stored.ModelCardVersion,
      CreatedAt: stored.CreatedAt,
      LastModifiedAt: stored.LastModifiedAt,
    })),
  };
};

const ListModelCardVersions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelCardName");
  const stored = ctx.store.get<StoredModelCard>(modelCardKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Model card ${name} not found.`, 404);
  }
  return {
    ModelCardVersionSummaryList: [
      {
        ModelCardName: stored.ModelCardName,
        ModelCardArn: stored.ModelCardArn,
        ModelCardStatus: stored.ModelCardStatus,
        ModelCardVersion: stored.ModelCardVersion,
        CreationTime: stored.CreationTime,
        LastModifiedTime: stored.LastModifiedTime,
      },
    ],
  };
};

const ListModelCards: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let cards = ctx.store
    .list<StoredModelCard>()
    .filter((entry) => entry.key.startsWith("model-card/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    cards = cards.filter((c) => c.ModelCardName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    cards = cards.slice(0, maxResults);
  }
  return {
    ModelCardSummaries: cards.map((stored) => ({
      ModelCardName: stored.ModelCardName,
      ModelCardArn: stored.ModelCardArn,
      ModelCardStatus: stored.ModelCardStatus,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListModelExplainabilityJobDefinitions: OperationHandler = (
  input,
  ctx,
) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let defs = ctx.store
    .list<StoredModelExplainabilityJobDefinition>()
    .filter((entry) =>
      entry.key.startsWith("model-explainability-job-definition/"),
    )
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    defs = defs.filter((d) => d.JobDefinitionName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    defs = defs.slice(0, maxResults);
  }
  return {
    JobDefinitionSummaries: defs.map((stored) => ({
      MonitoringJobDefinitionName: stored.JobDefinitionName,
      MonitoringJobDefinitionArn: stored.JobDefinitionArn,
      CreationTime: stored.CreationTime,
      EndpointName: "",
    })),
  };
};

const ListModelMetadata: OperationHandler = (_input, _ctx) => ({
  ModelMetadataSummaries: [],
});

const ListModelPackageGroups: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let groups = ctx.store
    .list<StoredModelPackageGroup>()
    .filter((entry) => entry.key.startsWith("model-package-group/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    groups = groups.filter((g) =>
      g.ModelPackageGroupName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    groups = groups.slice(0, maxResults);
  }
  return {
    ModelPackageGroupSummaryList: groups.map((stored) => ({
      ModelPackageGroupName: stored.ModelPackageGroupName,
      ModelPackageGroupArn: stored.ModelPackageGroupArn,
      ModelPackageGroupDescription: stored.ModelPackageGroupDescription,
      CreationTime: stored.CreationTime,
      ModelPackageGroupStatus: stored.ModelPackageGroupStatus,
    })),
  };
};

const ListModelPackages: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const modelPackageGroupName =
    typeof input["ModelPackageGroupName"] === "string"
      ? (input["ModelPackageGroupName"] as string)
      : undefined;
  const modelApprovalStatus =
    typeof input["ModelApprovalStatus"] === "string"
      ? (input["ModelApprovalStatus"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let pkgs = ctx.store
    .list<StoredModelPackage>()
    .filter((entry) => entry.key.startsWith("model-package/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    pkgs = pkgs.filter((p) => p.ModelPackageName.includes(nameContains));
  }
  if (modelPackageGroupName !== undefined) {
    pkgs = pkgs.filter(
      (p) => p.ModelPackageGroupName === modelPackageGroupName,
    );
  }
  if (modelApprovalStatus !== undefined) {
    pkgs = pkgs.filter((p) => p.ModelApprovalStatus === modelApprovalStatus);
  }
  if (maxResults !== undefined) {
    pkgs = pkgs.slice(0, maxResults);
  }
  return {
    ModelPackageSummaryList: pkgs.map((stored) => ({
      ModelPackageName: stored.ModelPackageName,
      ModelPackageGroupName: stored.ModelPackageGroupName,
      ModelPackageArn: stored.ModelPackageArn,
      ModelPackageDescription: stored.ModelPackageDescription,
      CreationTime: stored.CreationTime,
      ModelPackageStatus: stored.ModelPackageStatus,
      ModelApprovalStatus: stored.ModelApprovalStatus,
    })),
  };
};

const ListModelQualityJobDefinitions: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let defs = ctx.store
    .list<StoredModelQualityJobDefinition>()
    .filter((entry) => entry.key.startsWith("model-quality-job-definition/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    defs = defs.filter((d) => d.JobDefinitionName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    defs = defs.slice(0, maxResults);
  }
  return {
    JobDefinitionSummaries: defs.map((stored) => ({
      MonitoringJobDefinitionName: stored.JobDefinitionName,
      MonitoringJobDefinitionArn: stored.JobDefinitionArn,
      CreationTime: stored.CreationTime,
      EndpointName: "",
    })),
  };
};

const ListMonitoringAlertHistory: OperationHandler = (input, ctx) => {
  const scheduleName =
    typeof input["MonitoringScheduleName"] === "string"
      ? (input["MonitoringScheduleName"] as string)
      : undefined;
  if (scheduleName !== undefined) {
    requireMonitoringSchedule(ctx, scheduleName);
  }
  return { MonitoringAlertHistory: [] };
};

const ListMonitoringAlerts: OperationHandler = (input, ctx) => {
  const scheduleName = requireString(input, "MonitoringScheduleName");
  requireMonitoringSchedule(ctx, scheduleName);
  return { MonitoringAlertSummaries: [] };
};

const ListMonitoringExecutions: OperationHandler = (_input, _ctx) => ({
  MonitoringExecutionSummaries: [],
});

const ListMonitoringSchedules: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let schedules = ctx.store
    .list<StoredMonitoringSchedule>()
    .filter((entry) => entry.key.startsWith("monitoring-schedule/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    schedules = schedules.filter((s) =>
      s.MonitoringScheduleName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    schedules = schedules.slice(0, maxResults);
  }
  return {
    MonitoringScheduleSummaries: schedules.map((stored) => ({
      MonitoringScheduleName: stored.MonitoringScheduleName,
      MonitoringScheduleArn: stored.MonitoringScheduleArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.CreationTime,
      MonitoringScheduleStatus: "Pending",
    })),
  };
};

const ListOptimizationJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredOptimizationJob>()
    .filter((entry) => entry.key.startsWith("optimization-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.OptimizationJobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    OptimizationJobSummaries: jobs.map((stored) => ({
      OptimizationJobName: stored.OptimizationJobName,
      OptimizationJobArn: stored.OptimizationJobArn,
      CreationTime: stored.CreationTime,
      OptimizationJobStatus: stored.OptimizationJobStatus,
      DeploymentInstanceType: stored.DeploymentInstanceType ?? "",
      OptimizationTypes: [],
    })),
  };
};

const ListPartnerApps: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let apps = ctx.store
    .list<StoredPartnerApp>()
    .filter((entry) => entry.key.startsWith("partner-app/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    apps = apps.slice(0, maxResults);
  }
  return {
    Summaries: apps.map((stored) => ({
      Arn: stored.Arn,
      Name: stored.Name,
      Type: stored.Type,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListPipelines: OperationHandler = (input, ctx) => {
  const pipelineNamePrefix =
    typeof input["PipelineNamePrefix"] === "string"
      ? (input["PipelineNamePrefix"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let pipelines = ctx.store
    .list<StoredPipeline>()
    .filter((entry) => entry.key.startsWith("pipeline/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (pipelineNamePrefix !== undefined) {
    pipelines = pipelines.filter((p) =>
      p.PipelineName.startsWith(pipelineNamePrefix),
    );
  }
  if (maxResults !== undefined) {
    pipelines = pipelines.slice(0, maxResults);
  }
  return {
    PipelineSummaries: pipelines.map((stored) => ({
      PipelineArn: stored.PipelineArn,
      PipelineName: stored.PipelineName,
      PipelineDisplayName: stored.PipelineDisplayName,
      PipelineDescription: stored.PipelineDescription,
      RoleArn: stored.RoleArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListProcessingJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredProcessingJob>()
    .filter((entry) => entry.key.startsWith("processing-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.ProcessingJobName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    ProcessingJobSummaries: jobs.map((stored) => ({
      ProcessingJobName: stored.ProcessingJobName,
      ProcessingJobArn: stored.ProcessingJobArn,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
      ProcessingJobStatus: stored.ProcessingJobStatus,
    })),
  };
};

const ListProjects: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let projects = ctx.store
    .list<StoredProject>()
    .filter((entry) => entry.key.startsWith("project/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    projects = projects.filter((p) => p.ProjectName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    projects = projects.slice(0, maxResults);
  }
  return {
    ProjectSummaryList: projects.map((stored) => ({
      ProjectName: stored.ProjectName,
      ProjectArn: stored.ProjectArn,
      ProjectId: stored.ProjectId,
      ProjectDescription: stored.ProjectDescription,
      ProjectStatus: stored.ProjectStatus,
      CreationTime: stored.CreationTime,
    })),
  };
};

const ListResourceCatalogs: OperationHandler = (_input, _ctx) => ({
  ResourceCatalogs: [],
});

const ListSpaces: OperationHandler = (input, ctx) => {
  const domainIdEquals =
    typeof input["DomainIdEquals"] === "string"
      ? (input["DomainIdEquals"] as string)
      : undefined;
  const spaceNameContains =
    typeof input["SpaceNameContains"] === "string"
      ? (input["SpaceNameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let spaces = ctx.store
    .list<StoredSpace>()
    .filter((entry) => entry.key.startsWith("space/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (domainIdEquals !== undefined) {
    spaces = spaces.filter((s) => s.DomainId === domainIdEquals);
  }
  if (spaceNameContains !== undefined) {
    spaces = spaces.filter((s) => s.SpaceName.includes(spaceNameContains));
  }
  if (maxResults !== undefined) {
    spaces = spaces.slice(0, maxResults);
  }
  return {
    Spaces: spaces.map((stored) => ({
      DomainId: stored.DomainId,
      SpaceName: stored.SpaceName,
      SpaceArn: stored.SpaceArn,
      Status: stored.Status,
      SpaceDisplayName: stored.SpaceDisplayName,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListStageDevices: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "EdgeDeploymentPlanName");
  const stageName = requireString(input, "StageName");
  void stageName;
  const stored = ctx.store.get<StoredEdgeDeploymentPlan>(
    edgeDeploymentPlanKey(planName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `EdgeDeploymentPlan ${planName} does not exist.`,
      400,
    );
  }
  return { DeviceDeploymentSummaries: [] };
};

const ListStudioLifecycleConfigs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const appTypeEquals =
    typeof input["AppTypeEquals"] === "string"
      ? (input["AppTypeEquals"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let configs = ctx.store
    .list<StoredStudioLifecycleConfig>()
    .filter((entry) => entry.key.startsWith("studio-lifecycle-config/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    configs = configs.filter((c) =>
      c.StudioLifecycleConfigName.includes(nameContains),
    );
  }
  if (appTypeEquals !== undefined) {
    configs = configs.filter(
      (c) => c.StudioLifecycleConfigAppType === appTypeEquals,
    );
  }
  if (maxResults !== undefined) {
    configs = configs.slice(0, maxResults);
  }
  return {
    StudioLifecycleConfigs: configs.map((stored) => ({
      StudioLifecycleConfigName: stored.StudioLifecycleConfigName,
      StudioLifecycleConfigArn: stored.StudioLifecycleConfigArn,
      StudioLifecycleConfigAppType: stored.StudioLifecycleConfigAppType,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListSubscribedWorkteams: OperationHandler = (_input, _ctx) => ({
  SubscribedWorkteams: [],
});

const ListTags: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const stored = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  let tags = stored?.Tags ?? [];
  if (maxResults !== undefined) {
    tags = tags.slice(0, maxResults);
  }
  return { Tags: tags };
};

const ListTrainingJobsForHyperParameterTuningJob: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "HyperParameterTuningJobName");
  const stored = ctx.store.get<StoredHyperParameterTuningJob>(
    hyperParameterTuningJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `HyperParameterTuningJob ${name} does not exist.`,
      400,
    );
  }
  return { TrainingJobSummaries: [] };
};

const ListTrainingPlans: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let plans = ctx.store
    .list<StoredTrainingPlan>()
    .filter((entry) => entry.key.startsWith("training-plan/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (maxResults !== undefined) {
    plans = plans.slice(0, maxResults);
  }
  return {
    TrainingPlanSummaries: plans.map((stored) => ({
      TrainingPlanName: stored.TrainingPlanName,
      TrainingPlanArn: stored.TrainingPlanArn,
      Status: stored.Status,
      StartTime: stored.CreationTime,
    })),
  };
};

const ListTransformJobs: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const statusEquals =
    typeof input["StatusEquals"] === "string"
      ? (input["StatusEquals"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let jobs = ctx.store
    .list<StoredTransformJob>()
    .filter((entry) => entry.key.startsWith("transform-job/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    jobs = jobs.filter((j) => j.TransformJobName.includes(nameContains));
  }
  if (statusEquals !== undefined) {
    jobs = jobs.filter((j) => j.TransformJobStatus === statusEquals);
  }
  if (maxResults !== undefined) {
    jobs = jobs.slice(0, maxResults);
  }
  return {
    TransformJobSummaries: jobs.map((stored) => ({
      TransformJobName: stored.TransformJobName,
      TransformJobArn: stored.TransformJobArn,
      TransformJobStatus: stored.TransformJobStatus,
      ModelName: stored.ModelName,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListTrialComponents: OperationHandler = (input, ctx) => {
  const trialName =
    typeof input["TrialName"] === "string"
      ? (input["TrialName"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let components = ctx.store
    .list<StoredTrialComponent>()
    .filter((entry) => entry.key.startsWith("trial-component/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (trialName !== undefined) {
    const associations = ctx.store
      .list<StoredTrialComponentAssociation>()
      .filter((entry) => entry.key.startsWith("trial-component-association/"))
      .map((entry) => entry.value)
      .filter((a) => a.TrialName === trialName);
    const componentNames = new Set(
      associations.map((a) => a.TrialComponentName),
    );
    components = components.filter((c) =>
      componentNames.has(c.TrialComponentName),
    );
  }
  if (maxResults !== undefined) {
    components = components.slice(0, maxResults);
  }
  return {
    TrialComponentSummaries: components.map((stored) => ({
      TrialComponentName: stored.TrialComponentName,
      TrialComponentArn: stored.TrialComponentArn,
      DisplayName: stored.DisplayName,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListTrials: OperationHandler = (input, ctx) => {
  const experimentName =
    typeof input["ExperimentName"] === "string"
      ? (input["ExperimentName"] as string)
      : undefined;
  const trialComponentName =
    typeof input["TrialComponentName"] === "string"
      ? (input["TrialComponentName"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let trials = ctx.store
    .list<StoredTrial>()
    .filter((entry) => entry.key.startsWith("trial/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (experimentName !== undefined) {
    trials = trials.filter((t) => t.ExperimentName === experimentName);
  }
  if (trialComponentName !== undefined) {
    const associations = ctx.store
      .list<StoredTrialComponentAssociation>()
      .filter((entry) =>
        entry.key.startsWith(
          `trial-component-association/${trialComponentName}/`,
        ),
      )
      .map((entry) => entry.value);
    const trialNames = new Set(associations.map((a) => a.TrialName));
    trials = trials.filter((t) => trialNames.has(t.TrialName));
  }
  if (maxResults !== undefined) {
    trials = trials.slice(0, maxResults);
  }
  return {
    TrialSummaries: trials.map((stored) => ({
      TrialName: stored.TrialName,
      TrialArn: stored.TrialArn,
      DisplayName: stored.DisplayName,
      ExperimentName: stored.ExperimentName,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListUltraServersByReservedCapacity: OperationHandler = (input, _ctx) => {
  void requireString(input, "ReservedCapacityArn");
  return { UltraServers: [] };
};

const ListUserProfiles: OperationHandler = (input, ctx) => {
  const domainIdEquals =
    typeof input["DomainIdEquals"] === "string"
      ? (input["DomainIdEquals"] as string)
      : undefined;
  const nameContains =
    typeof input["UserProfileNameContains"] === "string"
      ? (input["UserProfileNameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let profiles = ctx.store
    .list<StoredUserProfile>()
    .filter((entry) => entry.key.startsWith("user-profile/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (domainIdEquals !== undefined) {
    profiles = profiles.filter((p) => p.DomainId === domainIdEquals);
  }
  if (nameContains !== undefined) {
    profiles = profiles.filter((p) => p.UserProfileName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    profiles = profiles.slice(0, maxResults);
  }
  return {
    UserProfiles: profiles.map((stored) => ({
      DomainId: stored.DomainId,
      UserProfileName: stored.UserProfileName,
      Status: stored.Status,
      CreationTime: stored.CreationTime,
      LastModifiedTime: stored.LastModifiedTime,
    })),
  };
};

const ListWorkforces: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let workforces = ctx.store
    .list<StoredWorkforce>()
    .filter((entry) => entry.key.startsWith("workforce/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreationTime - a.CreationTime);
  if (nameContains !== undefined) {
    workforces = workforces.filter((w) =>
      w.WorkforceName.includes(nameContains),
    );
  }
  if (maxResults !== undefined) {
    workforces = workforces.slice(0, maxResults);
  }
  return {
    Workforces: workforces.map((stored) => ({
      WorkforceName: stored.WorkforceName,
      WorkforceArn: stored.WorkforceArn,
      CognitoConfig: stored.CognitoConfig,
      OidcConfig: stored.OidcConfig,
      SourceIpConfig: stored.SourceIpConfig,
      WorkforceVpcConfig: stored.WorkforceVpcConfig,
      CreateDate: stored.CreationTime,
      LastUpdatedDate: stored.LastModifiedTime,
    })),
  };
};

const ListWorkteams: OperationHandler = (input, ctx) => {
  const nameContains =
    typeof input["NameContains"] === "string"
      ? (input["NameContains"] as string)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  let workteams = ctx.store
    .list<StoredWorkteam>()
    .filter((entry) => entry.key.startsWith("workteam/"))
    .map((entry) => entry.value)
    .sort((a, b) => b.CreateDate - a.CreateDate);
  if (nameContains !== undefined) {
    workteams = workteams.filter((w) => w.WorkteamName.includes(nameContains));
  }
  if (maxResults !== undefined) {
    workteams = workteams.slice(0, maxResults);
  }
  return {
    Workteams: workteams.map((stored) => ({
      WorkteamName: stored.WorkteamName,
      WorkteamArn: stored.WorkteamArn,
      Description: stored.Description,
      MemberDefinitions: stored.MemberDefinitions,
      NotificationConfiguration: stored.NotificationConfiguration,
      WorkerAccessConfiguration: stored.WorkerAccessConfiguration,
      CreateDate: stored.CreateDate,
      LastUpdatedDate: stored.LastUpdatedDate,
      ProductListingIds: [],
    })),
  };
};

const PutModelPackageGroupPolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelPackageGroupName");
  const resourcePolicy = requireString(input, "ResourcePolicy");
  const group = ctx.store.get<StoredModelPackageGroup>(
    modelPackageGroupKey(name),
  );
  if (group === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Model package group ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(modelPackageGroupPolicyKey(name), {
    ModelPackageGroupArn: group.ModelPackageGroupArn,
    ResourcePolicy: resourcePolicy,
  });
  return { ModelPackageGroupArn: group.ModelPackageGroupArn };
};

const QueryLineage: OperationHandler = (input, ctx) => {
  const startArns = Array.isArray(input["StartArns"])
    ? (input["StartArns"] as string[])
    : [];
  const artifacts = ctx.store
    .list<StoredArtifact>()
    .filter((entry) => entry.key.startsWith("artifact/"))
    .map((entry) => entry.value);
  const contexts = ctx.store
    .list<StoredContext>()
    .filter((entry) => entry.key.startsWith("context/"))
    .map((entry) => entry.value);
  const actions = ctx.store
    .list<StoredAction>()
    .filter((entry) => entry.key.startsWith("action/"))
    .map((entry) => entry.value);
  const allArns = new Map<string, string>([
    ...artifacts.map((a): [string, string] => [a.ArtifactArn, "Artifact"]),
    ...contexts.map((c): [string, string] => [c.ContextArn, "Context"]),
    ...actions.map((a): [string, string] => [a.ActionArn, "Action"]),
  ]);
  const targetArns =
    startArns.length === 0
      ? [...allArns.keys()]
      : startArns.filter((arn) => allArns.has(arn));
  const vertices = targetArns.map((arn) => ({
    Arn: arn,
    Type: allArns.get(arn) ?? "Artifact",
    LineageType: allArns.get(arn) ?? "Artifact",
  }));
  return { Vertices: vertices, Edges: [] };
};

const RegisterDevices: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "DeviceFleetName");
  const devices = Array.isArray(input["Devices"])
    ? (input["Devices"] as Array<{
        DeviceName: string;
        IotThingName?: string;
        Description?: string;
      }>)
    : [];
  const now = nowSeconds();
  for (const device of devices) {
    const arn = `arn:aws:sagemaker:${ctx.region}:${ctx.account}:device-fleet/${fleetName}/device/${device.DeviceName}`;
    const stored: StoredDevice = {
      DeviceName: device.DeviceName,
      DeviceFleetName: fleetName,
      DeviceArn: arn,
      IotThingName: device.IotThingName,
      Description: device.Description,
      RegistrationTime: now,
    };
    ctx.store.set(deviceKey(fleetName, device.DeviceName), stored);
  }
  return {};
};

const RenderUiTemplate: OperationHandler = (input, _ctx) => {
  const template = input["UiTemplate"] as { Content?: string } | undefined;
  const content =
    template?.Content ?? "<html><body>{{task.input}}</body></html>";
  return {
    RenderedContent: content,
    Errors: [],
  };
};

const RetryPipelineExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PipelineExecutionArn");
  const stored = requirePipelineExecution(ctx, arn);
  ctx.store.set(pipelineExecutionKey(arn), {
    ...stored,
    PipelineExecutionStatus: "Executing",
    LastModifiedTime: nowSeconds(),
  });
  return { PipelineExecutionArn: arn };
};

const Search: OperationHandler = (input, ctx) => {
  const resource = requireString(input, "Resource");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const prefixMap: Record<string, string> = {
    Experiment: "experiment/",
    TrainingJob: "training-job/",
    ExperimentTrial: "trial/",
    ExperimentTrialComponent: "trial-component/",
    FeatureGroup: "feature-group/",
    ModelPackage: "model-package/",
    ModelPackageGroup: "model-package-group/",
    Pipeline: "pipeline/",
    PipelineExecution: "pipeline-execution/",
    Project: "project/",
  };
  const prefix = prefixMap[resource];
  if (prefix === undefined) {
    return { Results: [], TotalHits: { Value: 0, Relation: "Equals" } };
  }
  let entries = ctx.store
    .list<Record<string, unknown>>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  if (maxResults !== undefined) {
    entries = entries.slice(0, maxResults);
  }
  const results = entries.map((value) => ({ [resource]: value }));
  return {
    Results: results,
    TotalHits: { Value: results.length, Relation: "Equals" },
  };
};

const SearchTrainingPlanOfferings: OperationHandler = (_input, _ctx) => {
  return {
    TrainingPlanOfferings: [],
    TrainingPlanExtensionOfferings: [],
  };
};

const SendPipelineExecutionStepFailure: OperationHandler = (input, _ctx) => {
  void requireString(input, "CallbackToken");
  return { PipelineExecutionArn: undefined };
};

const SendPipelineExecutionStepSuccess: OperationHandler = (input, _ctx) => {
  void requireString(input, "CallbackToken");
  return { PipelineExecutionArn: undefined };
};

const StartClusterHealthCheck: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const stored = requireCluster(ctx, name);
  return { ClusterArn: stored.ClusterArn };
};

const StartEdgeDeploymentStage: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "EdgeDeploymentPlanName");
  void requireString(input, "StageName");
  requireEdgeDeploymentPlan(ctx, planName);
  return {};
};

const StartInferenceExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredInferenceExperiment>(
    inferenceExperimentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceExperiment ${name} does not exist.`,
      400,
    );
  }
  return { InferenceExperimentArn: stored.InferenceExperimentArn };
};

const StartMlflowTrackingServer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrackingServerName");
  const stored = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowTrackingServer ${name} does not exist.`,
      400,
    );
  }
  return { TrackingServerArn: stored.TrackingServerArn };
};

const StartMonitoringSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MonitoringScheduleName");
  requireMonitoringSchedule(ctx, name);
  return {};
};

const StartNotebookInstance: OperationHandler = (input, ctx) => {
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
  ctx.store.set(notebookInstanceKey(name), {
    ...stored,
    NotebookInstanceStatus: "InService",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StartPipelineExecution: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  const pipeline = requirePipeline(ctx, name);
  const executionId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const arn = pipelineExecutionArnOf(
    ctx.region,
    ctx.account,
    name,
    executionId,
  );
  const now = nowSeconds();
  const stored: StoredPipelineExecution = {
    PipelineArn: pipeline.PipelineArn,
    PipelineExecutionArn: arn,
    PipelineExecutionDisplayName:
      typeof input["PipelineExecutionDisplayName"] === "string"
        ? (input["PipelineExecutionDisplayName"] as string)
        : undefined,
    PipelineExecutionStatus: "Executing",
    CreationTime: now,
    LastModifiedTime: now,
    PipelineParameters: Array.isArray(input["PipelineParameters"])
      ? (input["PipelineParameters"] as Array<{ Name: string; Value: string }>)
      : [],
  };
  ctx.store.set(pipelineExecutionKey(arn), stored);
  return { PipelineExecutionArn: arn };
};

const StartSession: OperationHandler = (input, ctx) => {
  void requireString(input, "ResourceIdentifier");
  const sessionId = crypto.randomUUID();
  return {
    SessionId: sessionId,
    StreamUrl: `wss://session.sagemaker.${ctx.region}.amazonaws.com/${sessionId}`,
    TokenValue: "bunsai-session-token",
  };
};

const StopCompilationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CompilationJobName");
  const stored = requireCompilationJob(ctx, name);
  ctx.store.set(compilationJobKey(name), {
    ...stored,
    CompilationJobStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopEdgeDeploymentStage: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "EdgeDeploymentPlanName");
  void requireString(input, "StageName");
  requireEdgeDeploymentPlan(ctx, planName);
  return {};
};

const StopEdgePackagingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EdgePackagingJobName");
  const stored = ctx.store.get<StoredEdgePackagingJob>(
    edgePackagingJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `EdgePackagingJob ${name} does not exist.`,
      400,
    );
  }
  return {};
};

const StopHyperParameterTuningJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HyperParameterTuningJobName");
  const stored = ctx.store.get<StoredHyperParameterTuningJob>(
    hyperParameterTuningJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `HyperParameterTuningJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(hyperParameterTuningJobKey(name), {
    ...stored,
    HyperParameterTuningJobStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopInferenceExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredInferenceExperiment>(
    inferenceExperimentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceExperiment ${name} does not exist.`,
      400,
    );
  }
  return { InferenceExperimentArn: stored.InferenceExperimentArn };
};

const StopInferenceRecommendationsJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "JobName");
  const stored = ctx.store.get<StoredInferenceRecommendationsJob>(
    inferenceRecommendationsJobKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceRecommendationsJob ${name} does not exist.`,
      400,
    );
  }
  return {};
};

const StopLabelingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "LabelingJobName");
  const stored = ctx.store.get<StoredLabelingJob>(labelingJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `LabelingJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(labelingJobKey(name), {
    ...stored,
    LabelingJobStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopMlflowTrackingServer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrackingServerName");
  const stored = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowTrackingServer ${name} does not exist.`,
      400,
    );
  }
  return { TrackingServerArn: stored.TrackingServerArn };
};

const StopMonitoringSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MonitoringScheduleName");
  const stored = requireMonitoringSchedule(ctx, name);
  ctx.store.set(monitoringScheduleKey(name), {
    ...stored,
    MonitoringScheduleStatus: "Stopped",
  });
  return {};
};

const StopNotebookInstance: OperationHandler = (input, ctx) => {
  const name = requireString(input, "NotebookInstanceName");
  const stored = ctx.store.get<StoredNotebookInstance>(
    notebookInstanceKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `NotebookInstance ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(notebookInstanceKey(name), {
    ...stored,
    NotebookInstanceStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopOptimizationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptimizationJobName");
  const stored = ctx.store.get<StoredOptimizationJob>(optimizationJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `OptimizationJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(optimizationJobKey(name), {
    ...stored,
    OptimizationJobStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopPipelineExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PipelineExecutionArn");
  const stored = requirePipelineExecution(ctx, arn);
  ctx.store.set(pipelineExecutionKey(arn), {
    ...stored,
    PipelineExecutionStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return { PipelineExecutionArn: arn };
};

const StopAIBenchmarkJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIBenchmarkJobName");
  const stored = requireAIBenchmarkJob(ctx, name);
  ctx.store.set(aiBenchmarkJobKey(name), {
    ...stored,
    AIBenchmarkJobStatus: "Stopping",
  });
  return { AIBenchmarkJobArn: stored.AIBenchmarkJobArn };
};

const StopAIRecommendationJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AIRecommendationJobName");
  const stored = requireAIRecommendationJob(ctx, name);
  ctx.store.set(aiRecommendationJobKey(name), {
    ...stored,
    AIRecommendationJobStatus: "Stopping",
  });
  return { AIRecommendationJobArn: stored.AIRecommendationJobArn };
};

const StopAutoMLJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AutoMLJobName");
  const stored = ctx.store.get<StoredAutoMLJob>(autoMLJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `AutoMLJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(autoMLJobKey(name), {
    ...stored,
    AutoMLJobStatus: "Stopping",
    AutoMLJobSecondaryStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopProcessingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProcessingJobName");
  const stored = requireProcessingJob(ctx, name);
  ctx.store.set(processingJobKey(name), {
    ...stored,
    ProcessingJobStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const StopTransformJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TransformJobName");
  const stored = ctx.store.get<StoredTransformJob>(transformJobKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `TransformJob ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(transformJobKey(name), {
    ...stored,
    TransformJobStatus: "Stopping",
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const UpdateAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ActionName");
  const stored = requireAction(ctx, name);
  ctx.store.set(actionKey(name), {
    ...stored,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    Status:
      typeof input["Status"] === "string"
        ? (input["Status"] as string)
        : stored.Status,
    Properties:
      input["Properties"] !== undefined
        ? input["Properties"]
        : stored.Properties,
    LastModifiedTime: nowSeconds(),
  });
  return { ActionArn: stored.ActionArn };
};

const UpdateAppImageConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AppImageConfigName");
  const stored = requireAppImageConfig(ctx, name);
  ctx.store.set(appImageConfigKey(name), {
    ...stored,
    KernelGatewayImageConfig:
      input["KernelGatewayImageConfig"] !== undefined
        ? input["KernelGatewayImageConfig"]
        : stored.KernelGatewayImageConfig,
    JupyterLabAppImageConfig:
      input["JupyterLabAppImageConfig"] !== undefined
        ? input["JupyterLabAppImageConfig"]
        : stored.JupyterLabAppImageConfig,
    CodeEditorAppImageConfig:
      input["CodeEditorAppImageConfig"] !== undefined
        ? input["CodeEditorAppImageConfig"]
        : stored.CodeEditorAppImageConfig,
    LastModifiedTime: nowSeconds(),
  });
  return { AppImageConfigArn: stored.AppImageConfigArn };
};

const UpdateArtifact: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ArtifactArn");
  const stored = requireArtifact(ctx, arn);
  ctx.store.set(artifactKey(arn), {
    ...stored,
    ArtifactName:
      typeof input["ArtifactName"] === "string"
        ? (input["ArtifactName"] as string)
        : stored.ArtifactName,
    Properties:
      input["Properties"] !== undefined
        ? input["Properties"]
        : stored.Properties,
    LastModifiedTime: nowSeconds(),
  });
  return { ArtifactArn: arn };
};

const UpdateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const stored = requireCluster(ctx, name);
  ctx.store.set(clusterKey(name), {
    ...stored,
    InstanceGroups:
      input["InstanceGroups"] !== undefined
        ? input["InstanceGroups"]
        : stored.InstanceGroups,
  });
  return { ClusterArn: stored.ClusterArn };
};

const UpdateClusterSchedulerConfig: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterSchedulerConfigId");
  const stored = requireClusterSchedulerConfig(ctx, id);
  ctx.store.set(clusterSchedulerConfigKey(id), {
    ...stored,
    SchedulerConfig:
      input["SchedulerConfig"] !== undefined
        ? input["SchedulerConfig"]
        : stored.SchedulerConfig,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    LastModifiedTime: nowSeconds(),
  });
  return {
    ClusterSchedulerConfigArn: stored.ClusterSchedulerConfigArn,
    ClusterSchedulerConfigVersion: 1,
  };
};

const UpdateClusterSoftware: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const stored = requireCluster(ctx, name);
  return { ClusterArn: stored.ClusterArn };
};

const UpdateCodeRepository: OperationHandler = (input, ctx) => {
  const name = requireString(input, "CodeRepositoryName");
  const stored = requireCodeRepository(ctx, name);
  ctx.store.set(codeRepositoryKey(name), {
    ...stored,
    GitConfig:
      input["GitConfig"] !== undefined ? input["GitConfig"] : stored.GitConfig,
    LastModifiedTime: nowSeconds(),
  });
  return { CodeRepositoryArn: stored.CodeRepositoryArn };
};

const UpdateComputeQuota: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ComputeQuotaId");
  const stored = requireComputeQuota(ctx, id);
  ctx.store.set(computeQuotaKey(id), {
    ...stored,
    ComputeQuotaConfig:
      input["ComputeQuotaConfig"] !== undefined
        ? input["ComputeQuotaConfig"]
        : stored.ComputeQuotaConfig,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    LastModifiedTime: nowSeconds(),
  });
  return {
    ComputeQuotaArn: stored.ComputeQuotaArn,
    ComputeQuotaVersion: 1,
  };
};

const UpdateContext: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ContextName");
  const stored = requireContext(ctx, name);
  ctx.store.set(contextKey(name), {
    ...stored,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    Properties:
      input["Properties"] !== undefined
        ? input["Properties"]
        : stored.Properties,
    LastModifiedTime: nowSeconds(),
  });
  return { ContextArn: stored.ContextArn };
};

const UpdateDeviceFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "DeviceFleetName");
  const stored = requireDeviceFleet(ctx, name);
  ctx.store.set(deviceFleetKey(name), {
    ...stored,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : stored.RoleArn,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    OutputConfig:
      input["OutputConfig"] !== undefined
        ? input["OutputConfig"]
        : stored.OutputConfig,
  });
  return {};
};

const UpdateDevices: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "DeviceFleetName");
  const devices = Array.isArray(input["Devices"])
    ? (input["Devices"] as Array<{
        DeviceName: string;
        IotThingName?: string;
        Description?: string;
      }>)
    : [];
  for (const device of devices) {
    const key = deviceKey(fleetName, device.DeviceName);
    const stored = ctx.store.get<StoredDevice>(key);
    if (stored !== undefined) {
      ctx.store.set(key, {
        ...stored,
        IotThingName:
          typeof device.IotThingName === "string"
            ? device.IotThingName
            : stored.IotThingName,
        Description:
          typeof device.Description === "string"
            ? device.Description
            : stored.Description,
      });
    }
  }
  return {};
};

const UpdateDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  const stored = requireDomain(ctx, id);
  ctx.store.set(domainKey(id), {
    ...stored,
    DefaultUserSettings:
      input["DefaultUserSettings"] !== undefined
        ? input["DefaultUserSettings"]
        : stored.DefaultUserSettings,
    DomainSettings:
      input["DomainSettingsForUpdate"] !== undefined
        ? input["DomainSettingsForUpdate"]
        : stored.DomainSettings,
    DefaultSpaceSettings:
      input["DefaultSpaceSettings"] !== undefined
        ? input["DefaultSpaceSettings"]
        : stored.DefaultSpaceSettings,
    SubnetIds:
      input["SubnetIds"] !== undefined ? input["SubnetIds"] : stored.SubnetIds,
    AppNetworkAccessType:
      typeof input["AppNetworkAccessType"] === "string"
        ? (input["AppNetworkAccessType"] as string)
        : stored.AppNetworkAccessType,
    LastModifiedTime: nowSeconds(),
  });
  return { DomainArn: stored.DomainArn };
};

const UpdateEndpoint: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const stored = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Could not find endpoint "${name}".`,
      400,
    );
  }
  const newConfigName = requireString(input, "EndpointConfigName");
  const newConfig = ctx.store.get<StoredEndpointConfig>(
    configKey(newConfigName),
  );
  if (newConfig === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find endpoint configuration "${newConfigName}".`,
      400,
    );
  }
  ctx.store.set(endpointKey(name), {
    ...stored,
    EndpointConfigName: newConfigName,
    EndpointStatus: "Updating",
    ProductionVariants: newConfig.ProductionVariants,
    LastModifiedTime: nowSeconds(),
  });
  return { EndpointArn: stored.EndpointArn };
};

const UpdateEndpointWeightsAndCapacities: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const stored = ctx.store.get<StoredEndpoint>(endpointKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Could not find endpoint "${name}".`,
      400,
    );
  }
  const updates = Array.isArray(input["DesiredWeightsAndCapacities"])
    ? (input["DesiredWeightsAndCapacities"] as Array<{
        VariantName: string;
        DesiredWeight?: number;
        DesiredInstanceCount?: number;
      }>)
    : [];
  const variants = Array.isArray(stored.ProductionVariants)
    ? (stored.ProductionVariants as Array<Record<string, unknown>>).map(
        (variant) => {
          const update = updates.find(
            (u) => u.VariantName === variant["VariantName"],
          );
          if (update === undefined) return variant;
          return {
            ...variant,
            CurrentWeight:
              update.DesiredWeight !== undefined
                ? update.DesiredWeight
                : variant["CurrentWeight"],
            CurrentInstanceCount:
              update.DesiredInstanceCount !== undefined
                ? update.DesiredInstanceCount
                : variant["CurrentInstanceCount"],
          };
        },
      )
    : stored.ProductionVariants;
  ctx.store.set(endpointKey(name), {
    ...stored,
    ProductionVariants: variants,
    LastModifiedTime: nowSeconds(),
  });
  return { EndpointArn: stored.EndpointArn };
};

const UpdateExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ExperimentName");
  const stored = ctx.store.get<StoredExperiment>(experimentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Experiment ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(experimentKey(name), {
    ...stored,
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : stored.DisplayName,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    LastModifiedTime: nowSeconds(),
  });
  return { ExperimentArn: stored.ExperimentArn };
};

const UpdateFeatureGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FeatureGroupName");
  const stored = requireFeatureGroup(ctx, name);
  ctx.store.set(featureGroupKey(name), {
    ...stored,
    OnlineStoreConfig:
      input["OnlineStoreConfig"] !== undefined
        ? input["OnlineStoreConfig"]
        : stored.OnlineStoreConfig,
    ThroughputConfig:
      input["ThroughputConfig"] !== undefined
        ? input["ThroughputConfig"]
        : stored.ThroughputConfig,
  });
  return { FeatureGroupArn: stored.FeatureGroupArn };
};

const UpdateFeatureMetadata: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "FeatureGroupName");
  requireFeatureGroup(ctx, groupName);
  return {};
};

const UpdateHub: OperationHandler = (input, ctx) => {
  const name = requireString(input, "HubName");
  const stored = requireHub(ctx, name);
  ctx.store.set(hubKey(name), {
    ...stored,
    HubDescription:
      typeof input["HubDescription"] === "string"
        ? (input["HubDescription"] as string)
        : stored.HubDescription,
    HubDisplayName:
      typeof input["HubDisplayName"] === "string"
        ? (input["HubDisplayName"] as string)
        : stored.HubDisplayName,
    HubSearchKeywords:
      input["HubSearchKeywords"] !== undefined
        ? input["HubSearchKeywords"]
        : stored.HubSearchKeywords,
  });
  return { HubArn: stored.HubArn };
};

const UpdateHubContent: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  const contentName = requireString(input, "HubContentName");
  const contentType = requireString(input, "HubContentType");
  const contentVersion = requireString(input, "HubContentVersion");
  const hub = requireHub(ctx, hubName);
  const contentArn = hubContentArnOf(
    ctx.region,
    ctx.account,
    hubName,
    contentType,
    contentName,
    contentVersion,
  );
  return { HubArn: hub.HubArn, HubContentArn: contentArn };
};

const UpdateHubContentReference: OperationHandler = (input, ctx) => {
  const hubName = requireString(input, "HubName");
  const contentName = requireString(input, "HubContentName");
  const contentType = requireString(input, "HubContentType");
  const minVersion =
    typeof input["MinVersion"] === "string"
      ? (input["MinVersion"] as string)
      : "1.0.0";
  const hub = requireHub(ctx, hubName);
  const contentArn = hubContentArnOf(
    ctx.region,
    ctx.account,
    hubName,
    contentType,
    contentName,
    minVersion,
  );
  return { HubArn: hub.HubArn, HubContentArn: contentArn };
};

const UpdateImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ImageName");
  const stored = requireImage(ctx, name);
  const deleteProps = Array.isArray(input["DeleteProperties"])
    ? (input["DeleteProperties"] as string[])
    : [];
  ctx.store.set(imageKey(name), {
    ...stored,
    Description: deleteProps.includes("Description")
      ? undefined
      : typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    DisplayName: deleteProps.includes("DisplayName")
      ? undefined
      : typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : stored.DisplayName,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : stored.RoleArn,
  });
  return { ImageArn: stored.ImageArn };
};

const UpdateImageVersion: OperationHandler = (input, ctx) => {
  const imageName = requireString(input, "ImageName");
  const version =
    typeof input["Version"] === "number" ? (input["Version"] as number) : 1;
  const stored = ctx.store.get<StoredImageVersion>(
    imageVersionKey(imageName, version),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `ImageVersion ${imageName}/${version} does not exist.`,
      400,
    );
  }
  return { ImageVersionArn: stored.ImageVersionArn };
};

const UpdateInferenceComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InferenceComponentName");
  const stored = ctx.store.get<StoredInferenceComponent>(
    inferenceComponentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceComponent ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(inferenceComponentKey(name), {
    ...stored,
    Specification:
      input["Specification"] !== undefined
        ? input["Specification"]
        : stored.Specification,
    Specifications:
      input["Specifications"] !== undefined
        ? input["Specifications"]
        : stored.Specifications,
    RuntimeConfig:
      input["RuntimeConfig"] !== undefined
        ? input["RuntimeConfig"]
        : stored.RuntimeConfig,
  });
  return { InferenceComponentArn: stored.InferenceComponentArn };
};

const UpdateInferenceComponentRuntimeConfig: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "InferenceComponentName");
  const stored = ctx.store.get<StoredInferenceComponent>(
    inferenceComponentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceComponent ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(inferenceComponentKey(name), {
    ...stored,
    RuntimeConfig:
      input["DesiredRuntimeConfig"] !== undefined
        ? input["DesiredRuntimeConfig"]
        : stored.RuntimeConfig,
  });
  return { InferenceComponentArn: stored.InferenceComponentArn };
};

const UpdateInferenceExperiment: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredInferenceExperiment>(
    inferenceExperimentKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `InferenceExperiment ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(inferenceExperimentKey(name), {
    ...stored,
    Schedule:
      input["Schedule"] !== undefined ? input["Schedule"] : stored.Schedule,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    ModelVariants:
      input["ModelVariants"] !== undefined
        ? input["ModelVariants"]
        : stored.ModelVariants,
    DataStorageConfig:
      input["DataStorageConfig"] !== undefined
        ? input["DataStorageConfig"]
        : stored.DataStorageConfig,
    ShadowModeConfig:
      input["ShadowModeConfig"] !== undefined
        ? input["ShadowModeConfig"]
        : stored.ShadowModeConfig,
  });
  return { InferenceExperimentArn: stored.InferenceExperimentArn };
};

const UpdateMlflowApp: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const stored = requireMlflowApp(ctx, arn);
  ctx.store.set(mlflowAppKey(stored.Name), {
    ...stored,
    ArtifactStoreUri:
      typeof input["ArtifactStoreUri"] === "string"
        ? (input["ArtifactStoreUri"] as string)
        : stored.ArtifactStoreUri,
    ModelRegistrationMode:
      typeof input["ModelRegistrationMode"] === "string"
        ? (input["ModelRegistrationMode"] as string)
        : stored.ModelRegistrationMode,
  });
  return { Arn: stored.Arn };
};

const UpdateMlflowTrackingServer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrackingServerName");
  const stored = ctx.store.get<StoredMlflowTrackingServer>(
    mlflowTrackingServerKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `MlflowTrackingServer ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(mlflowTrackingServerKey(name), {
    ...stored,
    ArtifactStoreUri:
      typeof input["ArtifactStoreUri"] === "string"
        ? (input["ArtifactStoreUri"] as string)
        : stored.ArtifactStoreUri,
    TrackingServerSize:
      typeof input["TrackingServerSize"] === "string"
        ? (input["TrackingServerSize"] as string)
        : stored.TrackingServerSize,
  });
  return { TrackingServerArn: stored.TrackingServerArn };
};

const UpdateModelCard: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ModelCardName");
  const stored = requireModelCard(ctx, name);
  ctx.store.set(modelCardKey(name), {
    ...stored,
    Content:
      typeof input["Content"] === "string"
        ? (input["Content"] as string)
        : stored.Content,
    ModelCardStatus:
      typeof input["ModelCardStatus"] === "string"
        ? (input["ModelCardStatus"] as string)
        : stored.ModelCardStatus,
    ModelCardVersion: stored.ModelCardVersion + 1,
    LastModifiedTime: nowSeconds(),
  });
  return { ModelCardArn: stored.ModelCardArn };
};

const UpdateModelPackage: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ModelPackageArn");
  const pkgName = arn.split("/").pop() ?? arn;
  const stored = ctx.store.get<StoredModelPackage>(modelPackageKey(pkgName));
  if (stored === undefined) {
    throw awsError(
      "ValidationException",
      `Could not find model package "${pkgName}".`,
      400,
    );
  }
  ctx.store.set(modelPackageKey(pkgName), {
    ...stored,
    ModelApprovalStatus:
      typeof input["ModelApprovalStatus"] === "string"
        ? (input["ModelApprovalStatus"] as string)
        : stored.ModelApprovalStatus,
    LastModifiedTime: nowSeconds(),
  });
  return { ModelPackageArn: stored.ModelPackageArn };
};

const UpdateMonitoringAlert: OperationHandler = (input, ctx) => {
  const scheduleName = requireString(input, "MonitoringScheduleName");
  const alertName = requireString(input, "MonitoringAlertName");
  const stored = requireMonitoringSchedule(ctx, scheduleName);
  return {
    MonitoringScheduleArn: stored.MonitoringScheduleArn,
    MonitoringAlertName: alertName,
  };
};

const UpdateMonitoringSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MonitoringScheduleName");
  const stored = requireMonitoringSchedule(ctx, name);
  ctx.store.set(monitoringScheduleKey(name), {
    ...stored,
    MonitoringScheduleConfig:
      input["MonitoringScheduleConfig"] !== undefined
        ? input["MonitoringScheduleConfig"]
        : stored.MonitoringScheduleConfig,
  });
  return { MonitoringScheduleArn: stored.MonitoringScheduleArn };
};

const UpdateNotebookInstance: OperationHandler = (input, ctx) => {
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
  ctx.store.set(notebookInstanceKey(name), {
    ...stored,
    InstanceType:
      typeof input["InstanceType"] === "string"
        ? (input["InstanceType"] as string)
        : stored.InstanceType,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : stored.RoleArn,
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const UpdateNotebookInstanceLifecycleConfig: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "NotebookInstanceLifecycleConfigName");
  const stored = requireNotebookInstanceLifecycleConfig(ctx, name);
  ctx.store.set(notebookInstanceLifecycleConfigKey(name), {
    ...stored,
    OnCreate:
      input["OnCreate"] !== undefined ? input["OnCreate"] : stored.OnCreate,
    OnStart: input["OnStart"] !== undefined ? input["OnStart"] : stored.OnStart,
    LastModifiedTime: nowSeconds(),
  });
  return {};
};

const UpdatePartnerApp: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const stored = requirePartnerApp(ctx, arn);
  ctx.store.set(partnerAppKey(stored.Name), {
    ...stored,
    Tier:
      typeof input["Tier"] === "string"
        ? (input["Tier"] as string)
        : stored.Tier,
  });
  return { Arn: stored.Arn };
};

const UpdatePipeline: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PipelineName");
  const stored = requirePipeline(ctx, name);
  ctx.store.set(pipelineKey(name), {
    ...stored,
    PipelineDisplayName:
      typeof input["PipelineDisplayName"] === "string"
        ? (input["PipelineDisplayName"] as string)
        : stored.PipelineDisplayName,
    PipelineDefinition:
      typeof input["PipelineDefinition"] === "string"
        ? (input["PipelineDefinition"] as string)
        : stored.PipelineDefinition,
    PipelineDescription:
      typeof input["PipelineDescription"] === "string"
        ? (input["PipelineDescription"] as string)
        : stored.PipelineDescription,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : stored.RoleArn,
    LastModifiedTime: nowSeconds(),
  });
  return { PipelineArn: stored.PipelineArn };
};

const UpdatePipelineExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PipelineExecutionArn");
  const stored = requirePipelineExecution(ctx, arn);
  ctx.store.set(pipelineExecutionKey(arn), {
    ...stored,
    PipelineExecutionDisplayName:
      typeof input["PipelineExecutionDisplayName"] === "string"
        ? (input["PipelineExecutionDisplayName"] as string)
        : stored.PipelineExecutionDisplayName,
    LastModifiedTime: nowSeconds(),
  });
  return { PipelineExecutionArn: stored.PipelineExecutionArn };
};

const UpdatePipelineVersion: OperationHandler = (input, ctx) => {
  const pipelineArn = requireString(input, "PipelineArn");
  const pipelineVersionId =
    typeof input["PipelineVersionId"] === "number"
      ? (input["PipelineVersionId"] as number)
      : 0;
  const pipelineName = pipelineArn.split(":pipeline/")[1];
  if (pipelineName === undefined) {
    throw awsError("ResourceNotFound", `Pipeline not found.`, 400);
  }
  requirePipeline(ctx, pipelineName);
  return { PipelineArn: pipelineArn, PipelineVersionId: pipelineVersionId };
};

const UpdateProject: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ProjectName");
  const stored = ctx.store.get<StoredProject>(projectKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Project ${name} does not exist.`, 400);
  }
  ctx.store.set(projectKey(name), {
    ...stored,
    ProjectDescription:
      typeof input["ProjectDescription"] === "string"
        ? (input["ProjectDescription"] as string)
        : stored.ProjectDescription,
    ServiceCatalogProvisioningDetails:
      input["ServiceCatalogProvisioningUpdateDetails"] !== undefined
        ? input["ServiceCatalogProvisioningUpdateDetails"]
        : stored.ServiceCatalogProvisioningDetails,
  });
  return { ProjectArn: stored.ProjectArn };
};

const UpdateSpace: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const spaceName = requireString(input, "SpaceName");
  const stored = ctx.store.get<StoredSpace>(spaceKey(domainId, spaceName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Space ${spaceName} in domain ${domainId} does not exist.`,
      400,
    );
  }
  ctx.store.set(spaceKey(domainId, spaceName), {
    ...stored,
    SpaceSettings:
      input["SpaceSettings"] !== undefined
        ? input["SpaceSettings"]
        : stored.SpaceSettings,
    SpaceDisplayName:
      typeof input["SpaceDisplayName"] === "string"
        ? (input["SpaceDisplayName"] as string)
        : stored.SpaceDisplayName,
    LastModifiedTime: nowSeconds(),
  });
  return { SpaceArn: stored.SpaceArn };
};

const UpdateTrainingJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrainingJobName");
  const stored = requireTrainingJob(ctx, name);
  ctx.store.set(trainingJobKey(name), {
    ...stored,
    ResourceConfig:
      input["ResourceConfig"] !== undefined
        ? input["ResourceConfig"]
        : stored.ResourceConfig,
    LastModifiedTime: nowSeconds(),
  });
  return { TrainingJobArn: stored.TrainingJobArn };
};

const UpdateTrial: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialName");
  const stored = ctx.store.get<StoredTrial>(trialKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Trial ${name} does not exist.`, 400);
  }
  ctx.store.set(trialKey(name), {
    ...stored,
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : stored.DisplayName,
    LastModifiedTime: nowSeconds(),
  });
  return { TrialArn: stored.TrialArn };
};

const UpdateTrialComponent: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TrialComponentName");
  const stored = ctx.store.get<StoredTrialComponent>(trialComponentKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `TrialComponent ${name} does not exist.`,
      400,
    );
  }
  ctx.store.set(trialComponentKey(name), {
    ...stored,
    DisplayName:
      typeof input["DisplayName"] === "string"
        ? (input["DisplayName"] as string)
        : stored.DisplayName,
    Status: input["Status"] !== undefined ? input["Status"] : stored.Status,
    StartTime:
      typeof input["StartTime"] === "number"
        ? (input["StartTime"] as number)
        : stored.StartTime,
    EndTime:
      typeof input["EndTime"] === "number"
        ? (input["EndTime"] as number)
        : stored.EndTime,
    LastModifiedTime: nowSeconds(),
  });
  return { TrialComponentArn: stored.TrialComponentArn };
};

const UpdateUserProfile: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  const userProfileName = requireString(input, "UserProfileName");
  const stored = ctx.store.get<StoredUserProfile>(
    userProfileKey(domainId, userProfileName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `UserProfile ${userProfileName} in domain ${domainId} does not exist.`,
      400,
    );
  }
  ctx.store.set(userProfileKey(domainId, userProfileName), {
    ...stored,
    UserSettings:
      input["UserSettings"] !== undefined
        ? input["UserSettings"]
        : stored.UserSettings,
    LastModifiedTime: nowSeconds(),
  });
  return { UserProfileArn: stored.UserProfileArn };
};

const UpdateWorkforce: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkforceName");
  const stored = ctx.store.get<StoredWorkforce>(workforceKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFound",
      `Workforce ${name} does not exist.`,
      400,
    );
  }
  const updated: StoredWorkforce = {
    ...stored,
    SourceIpConfig:
      input["SourceIpConfig"] !== undefined
        ? input["SourceIpConfig"]
        : stored.SourceIpConfig,
    OidcConfig:
      input["OidcConfig"] !== undefined
        ? input["OidcConfig"]
        : stored.OidcConfig,
    WorkforceVpcConfig:
      input["WorkforceVpcConfig"] !== undefined
        ? input["WorkforceVpcConfig"]
        : stored.WorkforceVpcConfig,
    LastModifiedTime: nowSeconds(),
  };
  ctx.store.set(workforceKey(name), updated);
  return {
    Workforce: {
      WorkforceName: updated.WorkforceName,
      WorkforceArn: updated.WorkforceArn,
      CognitoConfig: updated.CognitoConfig,
      OidcConfig: updated.OidcConfig,
      SourceIpConfig: updated.SourceIpConfig,
      WorkforceVpcConfig: updated.WorkforceVpcConfig,
      CreateDate: updated.CreationTime,
      LastUpdatedDate: updated.LastModifiedTime,
    },
  };
};

const UpdateWorkteam: OperationHandler = (input, ctx) => {
  const name = requireString(input, "WorkteamName");
  const stored = ctx.store.get<StoredWorkteam>(workteamKey(name));
  if (stored === undefined) {
    throw awsError("ResourceNotFound", `Workteam ${name} does not exist.`, 400);
  }
  const updated: StoredWorkteam = {
    ...stored,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : stored.Description,
    MemberDefinitions:
      input["MemberDefinitions"] !== undefined
        ? input["MemberDefinitions"]
        : stored.MemberDefinitions,
    NotificationConfiguration:
      input["NotificationConfiguration"] !== undefined
        ? input["NotificationConfiguration"]
        : stored.NotificationConfiguration,
    WorkerAccessConfiguration:
      input["WorkerAccessConfiguration"] !== undefined
        ? input["WorkerAccessConfiguration"]
        : stored.WorkerAccessConfiguration,
    LastUpdatedDate: nowSeconds(),
  };
  ctx.store.set(workteamKey(name), updated);
  return {
    Workteam: {
      WorkteamName: updated.WorkteamName,
      WorkteamArn: updated.WorkteamArn,
      Description: updated.Description,
      MemberDefinitions: updated.MemberDefinitions,
      NotificationConfiguration: updated.NotificationConfiguration,
      WorkerAccessConfiguration: updated.WorkerAccessConfiguration,
      CreateDate: updated.CreateDate,
      LastUpdatedDate: updated.LastUpdatedDate,
    },
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
    DeregisterDevices,
    DescribeClusterNode,
    DescribeClusterSchedulerConfig,
    DescribeCodeRepository,
    DescribeCompilationJob,
    DescribeComputeQuota,
    DescribeContext,
    DescribeDataQualityJobDefinition,
    DescribeDevice,
    DescribeDeviceFleet,
    DescribeDomain,
    DescribeEdgeDeploymentPlan,
    DescribeEdgePackagingJob,
    DescribeExperiment,
    DescribeFeatureGroup,
    DescribeFeatureMetadata,
    DescribeFlowDefinition,
    DescribeHub,
    DescribeHubContent,
    DescribeHumanTaskUi,
    DescribeHyperParameterTuningJob,
    DescribeImage,
    DescribeImageVersion,
    DescribeInferenceComponent,
    DescribeInferenceExperiment,
    DescribeInferenceRecommendationsJob,
    DescribeLabelingJob,
    DescribeLineageGroup,
    DescribeMlflowApp,
    DescribeMlflowTrackingServer,
    DescribeMonitoringSchedule,
    DescribeOptimizationJob,
    DescribePartnerApp,
    DescribeProcessingJob,
    DescribeProject,
    DescribeReservedCapacity,
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
    CreateAction,
    CreateAlgorithm,
    CreateArtifact,
    CreateAutoMLJob,
    CreateAutoMLJobV2,
    CreateCluster,
    CreateClusterSchedulerConfig,
    CreateCodeRepository,
    CreateCompilationJob,
    CreateComputeQuota,
    CreateContext,
    CreateDataQualityJobDefinition,
    CreateDeviceFleet,
    CreateEdgeDeploymentPlan,
    CreateEdgeDeploymentStage,
    CreateEdgePackagingJob,
    CreateExperiment,
    CreateFlowDefinition,
    CreateHumanTaskUi,
    CreateHyperParameterTuningJob,
    CreateLabelingJob,
    CreateMlflowTrackingServer,
    CreateOptimizationJob,
    CreatePresignedMlflowTrackingServerUrl,
    CreateProject,
    CreateStudioLifecycleConfig,
    CreateTrial,
    CreateTrialComponent,
    CreateWorkforce,
    CreateWorkteam,
    DeleteAIBenchmarkJob,
    DeleteAIRecommendationJob,
    DeleteAIWorkloadConfig,
    DeleteAction,
    DeleteAlgorithm,
    DeleteArtifact,
    DeleteAssociation,
    DeleteCluster,
    DeleteClusterSchedulerConfig,
    DeleteCodeRepository,
    DeleteCompilationJob,
    DeleteComputeQuota,
    DeleteContext,
    DeleteDataQualityJobDefinition,
    DeleteDeviceFleet,
    DeleteDomain,
    DeleteEdgeDeploymentPlan,
    DeleteEdgeDeploymentStage,
    DeleteExperiment,
    DeleteFlowDefinition,
    DeleteHub,
    DeleteHubContent,
    DeleteHubContentReference,
    DeleteHumanTaskUi,
    DeleteHyperParameterTuningJob,
    DeleteImage,
    DeleteImageVersion,
    DeleteInferenceComponent,
    DeleteInferenceExperiment,
    DeleteMlflowApp,
    DeleteMlflowTrackingServer,
    DeleteOptimizationJob,
    DeletePartnerApp,
    DeleteProject,
    DeleteSpace,
    DeleteStudioLifecycleConfig,
    DeleteTags,
    DeleteTrial,
    DeleteTrialComponent,
    DeleteUserProfile,
    DeleteWorkforce,
    DeleteWorkteam,
    DescribeSpace,
    DescribeStudioLifecycleConfig,
    DescribeSubscribedWorkteam,
    DescribeTrainingPlanExtensionHistory,
    DescribeTransformJob,
    DescribeTrial,
    DescribeTrialComponent,
    DescribeUserProfile,
    DescribeWorkforce,
    DescribeWorkteam,
    DetachClusterNodeVolume,
    DisableSagemakerServicecatalogPortfolio,
    DisassociateTrialComponent,
    EnableSagemakerServicecatalogPortfolio,
    ExtendTrainingPlan,
    GetDeviceFleetReport,
    GetLineageGroupPolicy,
    GetModelPackageGroupPolicy,
    GetSagemakerServicecatalogPortfolioStatus,
    GetScalingConfigurationRecommendation,
    GetSearchSuggestions,
    ImportHubContent,
    ListAIBenchmarkJobs,
    ListAIRecommendationJobs,
    ListAIWorkloadConfigs,
    ListActions,
    ListAlgorithms,
    ListAliases,
    ListAppImageConfigs,
    ListApps,
    ListArtifacts,
    ListAssociations,
    ListAutoMLJobs,
    ListCandidatesForAutoMLJob,
    ListClusterEvents,
    ListClusterNodes,
    ListClusterSchedulerConfigs,
    ListClusters,
    ListCodeRepositories,
    ListCompilationJobs,
    ListComputeQuotas,
    ListContexts,
    ListDataQualityJobDefinitions,
    ListDeviceFleets,
    ListDevices,
    ListDomains,
    ListEdgeDeploymentPlans,
    ListEdgePackagingJobs,
    ListExperiments,
    ListFeatureGroups,
    ListFlowDefinitions,
    ListHubContentVersions,
    ListHubContents,
    ListHubs,
    ListHumanTaskUis,
    ListHyperParameterTuningJobs,
    ListImageVersions,
    ListImages,
    ListInferenceComponents,
    ListInferenceExperiments,
    ListInferenceRecommendationsJobSteps,
    ListInferenceRecommendationsJobs,
    ListLabelingJobs,
    ListLabelingJobsForWorkteam,
    ListLineageGroups,
    ListMlflowApps,
    ListMlflowTrackingServers,
    ListModelBiasJobDefinitions,
    ListModelCardExportJobs,
    ListModelCardVersions,
    ListModelCards,
    ListModelExplainabilityJobDefinitions,
    ListModelMetadata,
    ListModelPackageGroups,
    ListModelPackages,
    ListModelQualityJobDefinitions,
    ListMonitoringAlertHistory,
    ListMonitoringAlerts,
    ListMonitoringExecutions,
    ListMonitoringSchedules,
    ListOptimizationJobs,
    ListPartnerApps,
    ListPipelines,
    ListProcessingJobs,
    ListProjects,
    ListResourceCatalogs,
    ListSpaces,
    ListStageDevices,
    ListStudioLifecycleConfigs,
    ListSubscribedWorkteams,
    ListTags,
    ListTrainingJobsForHyperParameterTuningJob,
    ListTrainingPlans,
    ListTransformJobs,
    ListTrialComponents,
    ListTrials,
    ListUltraServersByReservedCapacity,
    ListUserProfiles,
    ListWorkforces,
    ListWorkteams,
    PutModelPackageGroupPolicy,
    QueryLineage,
    RegisterDevices,
    RenderUiTemplate,
    RetryPipelineExecution,
    Search,
    SearchTrainingPlanOfferings,
    SendPipelineExecutionStepFailure,
    SendPipelineExecutionStepSuccess,
    StartClusterHealthCheck,
    StartEdgeDeploymentStage,
    StartInferenceExperiment,
    StartMlflowTrackingServer,
    StartMonitoringSchedule,
    StartNotebookInstance,
    StartPipelineExecution,
    StartSession,
    StopAIBenchmarkJob,
    StopAIRecommendationJob,
    StopAutoMLJob,
    StopCompilationJob,
    StopEdgeDeploymentStage,
    StopEdgePackagingJob,
    StopHyperParameterTuningJob,
    StopInferenceExperiment,
    StopInferenceRecommendationsJob,
    StopLabelingJob,
    StopMlflowTrackingServer,
    StopMonitoringSchedule,
    StopNotebookInstance,
    StopOptimizationJob,
    StopPipelineExecution,
    StopProcessingJob,
    StopTransformJob,
    UpdateAction,
    UpdateAppImageConfig,
    UpdateArtifact,
    UpdateCluster,
    UpdateClusterSchedulerConfig,
    UpdateClusterSoftware,
    UpdateCodeRepository,
    UpdateComputeQuota,
    UpdateContext,
    UpdateDeviceFleet,
    UpdateDevices,
    UpdateDomain,
    UpdateEndpoint,
    UpdateEndpointWeightsAndCapacities,
    UpdateExperiment,
    UpdateFeatureGroup,
    UpdateFeatureMetadata,
    UpdateHub,
    UpdateHubContent,
    UpdateHubContentReference,
    UpdateImage,
    UpdateImageVersion,
    UpdateInferenceComponent,
    UpdateInferenceComponentRuntimeConfig,
    UpdateInferenceExperiment,
    UpdateMlflowApp,
    UpdateMlflowTrackingServer,
    UpdateModelCard,
    UpdateModelPackage,
    UpdateMonitoringAlert,
    UpdateMonitoringSchedule,
    UpdateNotebookInstance,
    UpdateNotebookInstanceLifecycleConfig,
    UpdatePartnerApp,
    UpdatePipeline,
    UpdatePipelineExecution,
    UpdatePipelineVersion,
    UpdateProject,
    UpdateSpace,
    UpdateTrainingJob,
    UpdateTrial,
    UpdateTrialComponent,
    UpdateUserProfile,
    UpdateWorkforce,
    UpdateWorkteam,
  },
  model,
} as const satisfies ServiceDefinition;

export default sagemaker;
