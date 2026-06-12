import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/personalize.json", { with: { type: "json" } }),
  { targetPrefix: "AmazonPersonalize" },
);

const schemaPrefix = "schema:" as const;
const datasetGroupPrefix = "dsg:" as const;
const datasetPrefix = "ds:" as const;
const datasetImportJobPrefix = "dsij:" as const;
const datasetExportJobPrefix = "dsej:" as const;
const dataDeletionJobPrefix = "ddj:" as const;
const solutionPrefix = "sol:" as const;
const solutionVersionPrefix = "solv:" as const;
const campaignPrefix = "cmp:" as const;
const recommenderPrefix = "rec:" as const;
const eventTrackerPrefix = "et:" as const;
const filterPrefix = "flt:" as const;
const metricAttributionPrefix = "ma:" as const;
const batchInferenceJobPrefix = "bij:" as const;
const batchSegmentJobPrefix = "bsj:" as const;
const tagsPrefix = "tags:" as const;

type StoredSchema = {
  name: string;
  schemaArn: string;
  schema: string;
  domain: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredDatasetGroup = {
  name: string;
  datasetGroupArn: string;
  roleArn: string | undefined;
  kmsKeyArn: string | undefined;
  domain: string | undefined;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredDataset = {
  name: string;
  datasetArn: string;
  datasetGroupArn: string;
  datasetType: string;
  schemaArn: string;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredDatasetImportJob = {
  jobName: string;
  datasetImportJobArn: string;
  datasetArn: string;
  dataSource: unknown;
  roleArn: string;
  importMode: string | undefined;
  publishAttributionMetricsToS3: boolean | undefined;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredDatasetExportJob = {
  jobName: string;
  datasetExportJobArn: string;
  datasetArn: string;
  ingestionMode: string | undefined;
  roleArn: string;
  jobOutput: unknown;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredDataDeletionJob = {
  jobName: string;
  dataDeletionJobArn: string;
  datasetGroupArn: string;
  dataSource: unknown;
  roleArn: string;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredSolution = {
  name: string;
  solutionArn: string;
  datasetGroupArn: string;
  recipeArn: string | undefined;
  performHPO: boolean | undefined;
  performAutoML: boolean | undefined;
  performAutoTraining: boolean | undefined;
  eventType: string | undefined;
  solutionConfig: unknown;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredSolutionVersion = {
  name: string | undefined;
  solutionVersionArn: string;
  solutionArn: string;
  trainingMode: string | undefined;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredCampaign = {
  name: string;
  campaignArn: string;
  solutionVersionArn: string;
  minProvisionedTPS: number | undefined;
  campaignConfig: unknown;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredRecommender = {
  name: string;
  recommenderArn: string;
  datasetGroupArn: string;
  recipeArn: string;
  recommenderConfig: unknown;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredEventTracker = {
  name: string;
  eventTrackerArn: string;
  trackingId: string;
  datasetGroupArn: string;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredFilter = {
  name: string;
  filterArn: string;
  datasetGroupArn: string;
  filterExpression: string;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredMetricAttribution = {
  name: string;
  metricAttributionArn: string;
  datasetGroupArn: string;
  metrics: unknown[];
  metricsOutputConfig: unknown;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBatchInferenceJob = {
  jobName: string;
  batchInferenceJobArn: string;
  solutionVersionArn: string;
  filterArn: string | undefined;
  numResults: number | undefined;
  jobInput: unknown;
  jobOutput: unknown;
  roleArn: string;
  batchInferenceJobConfig: unknown;
  batchInferenceJobMode: string | undefined;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBatchSegmentJob = {
  jobName: string;
  batchSegmentJobArn: string;
  solutionVersionArn: string;
  filterArn: string | undefined;
  numResults: number | undefined;
  jobInput: unknown;
  jobOutput: unknown;
  roleArn: string;
  status: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const boolOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const advancePersonalizeStatus = (status: string): string => {
  if (status === "CREATE PENDING") return "CREATE IN_PROGRESS";
  if (status === "CREATE IN_PROGRESS") return "ACTIVE";
  if (status === "STOPPING") return "INACTIVE";
  return status;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidInputException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const schemaKey = (arn: string): string => `${schemaPrefix}${arn}`;
const datasetGroupKey = (arn: string): string => `${datasetGroupPrefix}${arn}`;
const datasetKey = (arn: string): string => `${datasetPrefix}${arn}`;
const datasetImportJobKey = (arn: string): string =>
  `${datasetImportJobPrefix}${arn}`;
const datasetExportJobKey = (arn: string): string =>
  `${datasetExportJobPrefix}${arn}`;
const dataDeletionJobKey = (arn: string): string =>
  `${dataDeletionJobPrefix}${arn}`;
const solutionKey = (arn: string): string => `${solutionPrefix}${arn}`;
const solutionVersionKey = (arn: string): string =>
  `${solutionVersionPrefix}${arn}`;
const campaignKey = (arn: string): string => `${campaignPrefix}${arn}`;
const recommenderKey = (arn: string): string => `${recommenderPrefix}${arn}`;
const eventTrackerKey = (arn: string): string => `${eventTrackerPrefix}${arn}`;
const filterKey = (arn: string): string => `${filterPrefix}${arn}`;
const metricAttributionKey = (arn: string): string =>
  `${metricAttributionPrefix}${arn}`;
const batchInferenceJobKey = (arn: string): string =>
  `${batchInferenceJobPrefix}${arn}`;
const batchSegmentJobKey = (arn: string): string =>
  `${batchSegmentJobPrefix}${arn}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const makeArn = (
  ctx: ServiceContext,
  resourceType: string,
  name: string,
): string =>
  `arn:aws:personalize:${ctx.region}:${ctx.account}:${resourceType}/${name}`;

const makeArnWithId = (ctx: ServiceContext, resourceType: string): string => {
  const id = crypto.randomUUID();
  return `arn:aws:personalize:${ctx.region}:${ctx.account}:${resourceType}/${id}`;
};

const schemaArn = (ctx: ServiceContext, name: string): string =>
  makeArn(ctx, "schema", name);

const requireSchema = (ctx: ServiceContext, arn: string): StoredSchema => {
  const stored = ctx.store.get<StoredSchema>(schemaKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireDatasetGroup = (
  ctx: ServiceContext,
  arn: string,
): StoredDatasetGroup => {
  const stored = ctx.store.get<StoredDatasetGroup>(datasetGroupKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireDataset = (ctx: ServiceContext, arn: string): StoredDataset => {
  const stored = ctx.store.get<StoredDataset>(datasetKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireDatasetImportJob = (
  ctx: ServiceContext,
  arn: string,
): StoredDatasetImportJob => {
  const stored = ctx.store.get<StoredDatasetImportJob>(
    datasetImportJobKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireDatasetExportJob = (
  ctx: ServiceContext,
  arn: string,
): StoredDatasetExportJob => {
  const stored = ctx.store.get<StoredDatasetExportJob>(
    datasetExportJobKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireDataDeletionJob = (
  ctx: ServiceContext,
  arn: string,
): StoredDataDeletionJob => {
  const stored = ctx.store.get<StoredDataDeletionJob>(dataDeletionJobKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireSolution = (ctx: ServiceContext, arn: string): StoredSolution => {
  const stored = ctx.store.get<StoredSolution>(solutionKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireSolutionVersion = (
  ctx: ServiceContext,
  arn: string,
): StoredSolutionVersion => {
  const stored = ctx.store.get<StoredSolutionVersion>(solutionVersionKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireCampaign = (ctx: ServiceContext, arn: string): StoredCampaign => {
  const stored = ctx.store.get<StoredCampaign>(campaignKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireRecommender = (
  ctx: ServiceContext,
  arn: string,
): StoredRecommender => {
  const stored = ctx.store.get<StoredRecommender>(recommenderKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireEventTracker = (
  ctx: ServiceContext,
  arn: string,
): StoredEventTracker => {
  const stored = ctx.store.get<StoredEventTracker>(eventTrackerKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireFilter = (ctx: ServiceContext, arn: string): StoredFilter => {
  const stored = ctx.store.get<StoredFilter>(filterKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireMetricAttribution = (
  ctx: ServiceContext,
  arn: string,
): StoredMetricAttribution => {
  const stored = ctx.store.get<StoredMetricAttribution>(
    metricAttributionKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireBatchInferenceJob = (
  ctx: ServiceContext,
  arn: string,
): StoredBatchInferenceJob => {
  const stored = ctx.store.get<StoredBatchInferenceJob>(
    batchInferenceJobKey(arn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const requireBatchSegmentJob = (
  ctx: ServiceContext,
  arn: string,
): StoredBatchSegmentJob => {
  const stored = ctx.store.get<StoredBatchSegmentJob>(batchSegmentJobKey(arn));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      400,
    );
  }
  return stored;
};

const schemaView = (stored: StoredSchema): Record<string, unknown> => ({
  name: stored.name,
  schemaArn: stored.schemaArn,
  schema: stored.schema,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
  domain: stored.domain,
});

const schemaSummaryView = (stored: StoredSchema): Record<string, unknown> => ({
  name: stored.name,
  schemaArn: stored.schemaArn,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
  domain: stored.domain,
});

const datasetGroupView = (
  stored: StoredDatasetGroup,
): Record<string, unknown> => ({
  name: stored.name,
  datasetGroupArn: stored.datasetGroupArn,
  roleArn: stored.roleArn,
  kmsKeyArn: stored.kmsKeyArn,
  domain: stored.domain,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetGroupSummaryView = (
  stored: StoredDatasetGroup,
): Record<string, unknown> => ({
  name: stored.name,
  datasetGroupArn: stored.datasetGroupArn,
  domain: stored.domain,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetView = (stored: StoredDataset): Record<string, unknown> => ({
  name: stored.name,
  datasetArn: stored.datasetArn,
  datasetGroupArn: stored.datasetGroupArn,
  datasetType: stored.datasetType,
  schemaArn: stored.schemaArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetSummaryView = (
  stored: StoredDataset,
): Record<string, unknown> => ({
  name: stored.name,
  datasetArn: stored.datasetArn,
  datasetType: stored.datasetType,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetImportJobView = (
  stored: StoredDatasetImportJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  datasetImportJobArn: stored.datasetImportJobArn,
  datasetArn: stored.datasetArn,
  dataSource: stored.dataSource,
  roleArn: stored.roleArn,
  importMode: stored.importMode,
  publishAttributionMetricsToS3: stored.publishAttributionMetricsToS3,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetImportJobSummaryView = (
  stored: StoredDatasetImportJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  datasetImportJobArn: stored.datasetImportJobArn,
  datasetArn: stored.datasetArn,
  importMode: stored.importMode,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetExportJobView = (
  stored: StoredDatasetExportJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  datasetExportJobArn: stored.datasetExportJobArn,
  datasetArn: stored.datasetArn,
  ingestionMode: stored.ingestionMode,
  roleArn: stored.roleArn,
  jobOutput: stored.jobOutput,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const datasetExportJobSummaryView = (
  stored: StoredDatasetExportJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  datasetExportJobArn: stored.datasetExportJobArn,
  ingestionMode: stored.ingestionMode,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const dataDeletionJobView = (
  stored: StoredDataDeletionJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  dataDeletionJobArn: stored.dataDeletionJobArn,
  datasetGroupArn: stored.datasetGroupArn,
  dataSource: stored.dataSource,
  roleArn: stored.roleArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const dataDeletionJobSummaryView = (
  stored: StoredDataDeletionJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  dataDeletionJobArn: stored.dataDeletionJobArn,
  datasetGroupArn: stored.datasetGroupArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const solutionView = (stored: StoredSolution): Record<string, unknown> => ({
  name: stored.name,
  solutionArn: stored.solutionArn,
  datasetGroupArn: stored.datasetGroupArn,
  recipeArn: stored.recipeArn,
  performHPO: stored.performHPO,
  performAutoML: stored.performAutoML,
  performAutoTraining: stored.performAutoTraining,
  eventType: stored.eventType,
  solutionConfig: stored.solutionConfig,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const solutionSummaryView = (
  stored: StoredSolution,
): Record<string, unknown> => ({
  name: stored.name,
  solutionArn: stored.solutionArn,
  recipeArn: stored.recipeArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const solutionVersionView = (
  stored: StoredSolutionVersion,
): Record<string, unknown> => ({
  name: stored.name,
  solutionVersionArn: stored.solutionVersionArn,
  solutionArn: stored.solutionArn,
  trainingMode: stored.trainingMode,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const solutionVersionSummaryView = (
  stored: StoredSolutionVersion,
): Record<string, unknown> => ({
  solutionVersionArn: stored.solutionVersionArn,
  solutionArn: stored.solutionArn,
  trainingMode: stored.trainingMode,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const campaignView = (stored: StoredCampaign): Record<string, unknown> => ({
  name: stored.name,
  campaignArn: stored.campaignArn,
  solutionVersionArn: stored.solutionVersionArn,
  minProvisionedTPS: stored.minProvisionedTPS,
  campaignConfig: stored.campaignConfig,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const campaignSummaryView = (
  stored: StoredCampaign,
): Record<string, unknown> => ({
  name: stored.name,
  campaignArn: stored.campaignArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const recommenderView = (
  stored: StoredRecommender,
): Record<string, unknown> => ({
  name: stored.name,
  recommenderArn: stored.recommenderArn,
  datasetGroupArn: stored.datasetGroupArn,
  recipeArn: stored.recipeArn,
  recommenderConfig: stored.recommenderConfig,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const recommenderSummaryView = (
  stored: StoredRecommender,
): Record<string, unknown> => ({
  name: stored.name,
  recommenderArn: stored.recommenderArn,
  datasetGroupArn: stored.datasetGroupArn,
  recipeArn: stored.recipeArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const eventTrackerView = (
  stored: StoredEventTracker,
): Record<string, unknown> => ({
  name: stored.name,
  eventTrackerArn: stored.eventTrackerArn,
  trackingId: stored.trackingId,
  datasetGroupArn: stored.datasetGroupArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const eventTrackerSummaryView = (
  stored: StoredEventTracker,
): Record<string, unknown> => ({
  name: stored.name,
  eventTrackerArn: stored.eventTrackerArn,
  datasetGroupArn: stored.datasetGroupArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const filterView = (stored: StoredFilter): Record<string, unknown> => ({
  name: stored.name,
  filterArn: stored.filterArn,
  datasetGroupArn: stored.datasetGroupArn,
  filterExpression: stored.filterExpression,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const filterSummaryView = (stored: StoredFilter): Record<string, unknown> => ({
  name: stored.name,
  filterArn: stored.filterArn,
  datasetGroupArn: stored.datasetGroupArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const metricAttributionView = (
  stored: StoredMetricAttribution,
): Record<string, unknown> => ({
  name: stored.name,
  metricAttributionArn: stored.metricAttributionArn,
  datasetGroupArn: stored.datasetGroupArn,
  metrics: stored.metrics,
  metricsOutputConfig: stored.metricsOutputConfig,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const metricAttributionSummaryView = (
  stored: StoredMetricAttribution,
): Record<string, unknown> => ({
  name: stored.name,
  metricAttributionArn: stored.metricAttributionArn,
  datasetGroupArn: stored.datasetGroupArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const batchInferenceJobView = (
  stored: StoredBatchInferenceJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  batchInferenceJobArn: stored.batchInferenceJobArn,
  solutionVersionArn: stored.solutionVersionArn,
  filterArn: stored.filterArn,
  numResults: stored.numResults,
  jobInput: stored.jobInput,
  jobOutput: stored.jobOutput,
  roleArn: stored.roleArn,
  batchInferenceJobConfig: stored.batchInferenceJobConfig,
  batchInferenceJobMode: stored.batchInferenceJobMode,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const batchInferenceJobSummaryView = (
  stored: StoredBatchInferenceJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  batchInferenceJobArn: stored.batchInferenceJobArn,
  solutionVersionArn: stored.solutionVersionArn,
  batchInferenceJobMode: stored.batchInferenceJobMode,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const batchSegmentJobView = (
  stored: StoredBatchSegmentJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  batchSegmentJobArn: stored.batchSegmentJobArn,
  solutionVersionArn: stored.solutionVersionArn,
  filterArn: stored.filterArn,
  numResults: stored.numResults,
  jobInput: stored.jobInput,
  jobOutput: stored.jobOutput,
  roleArn: stored.roleArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const batchSegmentJobSummaryView = (
  stored: StoredBatchSegmentJob,
): Record<string, unknown> => ({
  jobName: stored.jobName,
  batchSegmentJobArn: stored.batchSegmentJobArn,
  solutionVersionArn: stored.solutionVersionArn,
  status: stored.status,
  creationDateTime: stored.creationDateTime,
  lastUpdatedDateTime: stored.lastUpdatedDateTime,
});

const getTags = (ctx: ServiceContext, arn: string): Record<string, string> =>
  ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};

const CreateSchema: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const schema = requireString(input, "schema");
  const arn = schemaArn(ctx, name);
  if (ctx.store.get<StoredSchema>(schemaKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Schema already exists: ${arn}`,
      400,
    );
  }
  const now = nowSeconds();
  const stored: StoredSchema = {
    name,
    schemaArn: arn,
    schema,
    domain: stringOrUndefined(input["domain"]),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(schemaKey(arn), stored);
  return { schemaArn: arn };
};

const DescribeSchema: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "schemaArn");
  return { schema: schemaView(requireSchema(ctx, arn)) };
};

const ListSchemas: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredSchema>()
    .filter((entry) => entry.key.startsWith(schemaPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    schemas: items.map(schemaSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteSchema: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "schemaArn");
  requireSchema(ctx, arn);
  ctx.store.delete(schemaKey(arn));
  return {};
};

const CreateDatasetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const arn = makeArn(ctx, "dataset-group", name);
  if (ctx.store.get<StoredDatasetGroup>(datasetGroupKey(arn)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Dataset group already exists: ${arn}`,
      400,
    );
  }
  const now = nowSeconds();
  const stored: StoredDatasetGroup = {
    name,
    datasetGroupArn: arn,
    roleArn: stringOrUndefined(input["roleArn"]),
    kmsKeyArn: stringOrUndefined(input["kmsKeyArn"]),
    domain: stringOrUndefined(input["domain"]),
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(datasetGroupKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { datasetGroupArn: arn, domain: stored.domain };
};

const DescribeDatasetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetGroupArn");
  const stored = requireDatasetGroup(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(datasetGroupKey(arn), current);
  }
  return { datasetGroup: datasetGroupView(current) };
};

const ListDatasetGroups: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredDatasetGroup>()
    .filter((entry) => entry.key.startsWith(datasetGroupPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    datasetGroups: items.map(datasetGroupSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteDatasetGroup: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetGroupArn");
  requireDatasetGroup(ctx, arn);
  ctx.store.delete(datasetGroupKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const CreateDataset: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const schemaArnVal = requireString(input, "schemaArn");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  const datasetType = requireString(input, "datasetType");
  requireDatasetGroup(ctx, datasetGroupArn);
  requireSchema(ctx, schemaArnVal);
  const arn = makeArn(
    ctx,
    "dataset",
    `${datasetGroupArn.split("/").pop()}/${datasetType}/${name}`,
  );
  const now = nowSeconds();
  const stored: StoredDataset = {
    name,
    datasetArn: arn,
    datasetGroupArn,
    datasetType,
    schemaArn: schemaArnVal,
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(datasetKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { datasetArn: arn };
};

const DescribeDataset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetArn");
  const stored = requireDataset(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(datasetKey(arn), current);
  }
  return { dataset: datasetView(current) };
};

const ListDatasets: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredDataset>()
    .filter((entry) => entry.key.startsWith(datasetPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((d) => d.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    datasets: items.map(datasetSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteDataset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetArn");
  requireDataset(ctx, arn);
  ctx.store.delete(datasetKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const UpdateDataset: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetArn");
  const schemaArnVal = requireString(input, "schemaArn");
  const stored = requireDataset(ctx, arn);
  const updated: StoredDataset = {
    ...stored,
    schemaArn: schemaArnVal,
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(datasetKey(arn), updated);
  return { datasetArn: arn };
};

const CreateDatasetImportJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const datasetArn = requireString(input, "datasetArn");
  const roleArn = requireString(input, "roleArn");
  requireDataset(ctx, datasetArn);
  const arn = makeArnWithId(ctx, "dataset-import-job");
  const now = nowSeconds();
  const stored: StoredDatasetImportJob = {
    jobName,
    datasetImportJobArn: arn,
    datasetArn,
    dataSource: input["dataSource"],
    roleArn,
    importMode: stringOrUndefined(input["importMode"]),
    publishAttributionMetricsToS3: boolOrUndefined(
      input["publishAttributionMetricsToS3"],
    ),
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(datasetImportJobKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { datasetImportJobArn: arn };
};

const DescribeDatasetImportJob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetImportJobArn");
  const stored = requireDatasetImportJob(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(datasetImportJobKey(arn), current);
  }
  return { datasetImportJob: datasetImportJobView(current) };
};

const ListDatasetImportJobs: OperationHandler = (input, ctx) => {
  const datasetArnFilter = stringOrUndefined(input["datasetArn"]);
  let all = ctx.store
    .list<StoredDatasetImportJob>()
    .filter((entry) => entry.key.startsWith(datasetImportJobPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetArnFilter !== undefined) {
    all = all.filter((j) => j.datasetArn === datasetArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    datasetImportJobs: items.map(datasetImportJobSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const CreateDatasetExportJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const datasetArn = requireString(input, "datasetArn");
  const roleArn = requireString(input, "roleArn");
  requireDataset(ctx, datasetArn);
  const arn = makeArnWithId(ctx, "dataset-export-job");
  const now = nowSeconds();
  const stored: StoredDatasetExportJob = {
    jobName,
    datasetExportJobArn: arn,
    datasetArn,
    ingestionMode: stringOrUndefined(input["ingestionMode"]),
    roleArn,
    jobOutput: input["jobOutput"],
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(datasetExportJobKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { datasetExportJobArn: arn };
};

const DescribeDatasetExportJob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "datasetExportJobArn");
  const stored = requireDatasetExportJob(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(datasetExportJobKey(arn), current);
  }
  return { datasetExportJob: datasetExportJobView(current) };
};

const ListDatasetExportJobs: OperationHandler = (input, ctx) => {
  const datasetArnFilter = stringOrUndefined(input["datasetArn"]);
  let all = ctx.store
    .list<StoredDatasetExportJob>()
    .filter((entry) => entry.key.startsWith(datasetExportJobPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetArnFilter !== undefined) {
    all = all.filter((j) => j.datasetArn === datasetArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    datasetExportJobs: items.map(datasetExportJobSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const CreateDataDeletionJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  const roleArn = requireString(input, "roleArn");
  requireDatasetGroup(ctx, datasetGroupArn);
  const arn = makeArnWithId(ctx, "data-deletion-job");
  const now = nowSeconds();
  const stored: StoredDataDeletionJob = {
    jobName,
    dataDeletionJobArn: arn,
    datasetGroupArn,
    dataSource: input["dataSource"],
    roleArn,
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(dataDeletionJobKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { dataDeletionJobArn: arn };
};

const DescribeDataDeletionJob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "dataDeletionJobArn");
  const stored = requireDataDeletionJob(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(dataDeletionJobKey(arn), current);
  }
  return { dataDeletionJob: dataDeletionJobView(current) };
};

const ListDataDeletionJobs: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredDataDeletionJob>()
    .filter((entry) => entry.key.startsWith(dataDeletionJobPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((j) => j.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    dataDeletionJobs: items.map(dataDeletionJobSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const CreateSolution: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  requireDatasetGroup(ctx, datasetGroupArn);
  const arn = makeArn(ctx, "solution", name);
  const now = nowSeconds();
  const stored: StoredSolution = {
    name,
    solutionArn: arn,
    datasetGroupArn,
    recipeArn: stringOrUndefined(input["recipeArn"]),
    performHPO: boolOrUndefined(input["performHPO"]),
    performAutoML: boolOrUndefined(input["performAutoML"]),
    performAutoTraining: boolOrUndefined(input["performAutoTraining"]),
    eventType: stringOrUndefined(input["eventType"]),
    solutionConfig: input["solutionConfig"],
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(solutionKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { solutionArn: arn };
};

const DescribeSolution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "solutionArn");
  const stored = requireSolution(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(solutionKey(arn), current);
  }
  return { solution: solutionView(current) };
};

const ListSolutions: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredSolution>()
    .filter((entry) => entry.key.startsWith(solutionPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((s) => s.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    solutions: items.map(solutionSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteSolution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "solutionArn");
  requireSolution(ctx, arn);
  ctx.store.delete(solutionKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const UpdateSolution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "solutionArn");
  const stored = requireSolution(ctx, arn);
  const updated: StoredSolution = {
    ...stored,
    performAutoTraining:
      boolOrUndefined(input["performAutoTraining"]) ??
      stored.performAutoTraining,
    solutionConfig: input["solutionUpdateConfig"] ?? stored.solutionConfig,
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(solutionKey(arn), updated);
  return { solutionArn: arn };
};

const CreateSolutionVersion: OperationHandler = (input, ctx) => {
  const solutionArn = requireString(input, "solutionArn");
  requireSolution(ctx, solutionArn);
  const arn = makeArnWithId(ctx, "solution-version");
  const now = nowSeconds();
  const stored: StoredSolutionVersion = {
    name: stringOrUndefined(input["name"]),
    solutionVersionArn: arn,
    solutionArn,
    trainingMode: stringOrUndefined(input["trainingMode"]),
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(solutionVersionKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { solutionVersionArn: arn };
};

const DescribeSolutionVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "solutionVersionArn");
  const stored = requireSolutionVersion(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(solutionVersionKey(arn), current);
  }
  return { solutionVersion: solutionVersionView(current) };
};

const ListSolutionVersions: OperationHandler = (input, ctx) => {
  const solutionArnFilter = stringOrUndefined(input["solutionArn"]);
  let all = ctx.store
    .list<StoredSolutionVersion>()
    .filter((entry) => entry.key.startsWith(solutionVersionPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (solutionArnFilter !== undefined) {
    all = all.filter((v) => v.solutionArn === solutionArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    solutionVersions: items.map(solutionVersionSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const StopSolutionVersionCreation: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "solutionVersionArn");
  const stored = requireSolutionVersion(ctx, arn);
  const updated: StoredSolutionVersion = {
    ...stored,
    status: "CREATE STOPPING",
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(solutionVersionKey(arn), updated);
  return {};
};

const GetSolutionMetrics: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "solutionVersionArn");
  requireSolutionVersion(ctx, arn);
  return {
    solutionVersionArn: arn,
    metrics: {
      coverage: 0.9,
      mean_reciprocal_rank_at_25: 0.1234,
      normalized_discounted_cumulative_gain_at_5: 0.1234,
      normalized_discounted_cumulative_gain_at_10: 0.1234,
      normalized_discounted_cumulative_gain_at_25: 0.1234,
      precision_at_5: 0.1234,
      precision_at_10: 0.1234,
      precision_at_25: 0.1234,
    },
  };
};

const CreateCampaign: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const solutionVersionArn = requireString(input, "solutionVersionArn");
  requireSolutionVersion(ctx, solutionVersionArn);
  const arn = makeArn(ctx, "campaign", name);
  const now = nowSeconds();
  const stored: StoredCampaign = {
    name,
    campaignArn: arn,
    solutionVersionArn,
    minProvisionedTPS: numberOrUndefined(input["minProvisionedTPS"]),
    campaignConfig: input["campaignConfig"],
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(campaignKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { campaignArn: arn };
};

const DescribeCampaign: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "campaignArn");
  const stored = requireCampaign(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(campaignKey(arn), current);
  }
  return { campaign: campaignView(current) };
};

const ListCampaigns: OperationHandler = (input, ctx) => {
  const solutionArnFilter = stringOrUndefined(input["solutionArn"]);
  let all = ctx.store
    .list<StoredCampaign>()
    .filter((entry) => entry.key.startsWith(campaignPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (solutionArnFilter !== undefined) {
    const svArns = new Set(
      ctx.store
        .list<StoredSolutionVersion>()
        .filter((e) => e.key.startsWith(solutionVersionPrefix))
        .map((e) => e.value)
        .filter((sv) => sv.solutionArn === solutionArnFilter)
        .map((sv) => sv.solutionVersionArn),
    );
    all = all.filter((c) => svArns.has(c.solutionVersionArn));
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    campaigns: items.map(campaignSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteCampaign: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "campaignArn");
  requireCampaign(ctx, arn);
  ctx.store.delete(campaignKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const UpdateCampaign: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "campaignArn");
  const stored = requireCampaign(ctx, arn);
  const updated: StoredCampaign = {
    ...stored,
    solutionVersionArn:
      stringOrUndefined(input["solutionVersionArn"]) ??
      stored.solutionVersionArn,
    minProvisionedTPS:
      numberOrUndefined(input["minProvisionedTPS"]) ?? stored.minProvisionedTPS,
    campaignConfig: input["campaignConfig"] ?? stored.campaignConfig,
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(campaignKey(arn), updated);
  return { campaignArn: arn };
};

const CreateRecommender: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  const recipeArn = requireString(input, "recipeArn");
  requireDatasetGroup(ctx, datasetGroupArn);
  const arn = makeArn(ctx, "recommender", name);
  const now = nowSeconds();
  const stored: StoredRecommender = {
    name,
    recommenderArn: arn,
    datasetGroupArn,
    recipeArn,
    recommenderConfig: input["recommenderConfig"],
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(recommenderKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { recommenderArn: arn };
};

const DescribeRecommender: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "recommenderArn");
  const stored = requireRecommender(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(recommenderKey(arn), current);
  }
  return { recommender: recommenderView(current) };
};

const ListRecommenders: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredRecommender>()
    .filter((entry) => entry.key.startsWith(recommenderPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((r) => r.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    recommenders: items.map(recommenderSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteRecommender: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "recommenderArn");
  requireRecommender(ctx, arn);
  ctx.store.delete(recommenderKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const UpdateRecommender: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "recommenderArn");
  const stored = requireRecommender(ctx, arn);
  const updated: StoredRecommender = {
    ...stored,
    recommenderConfig: input["recommenderConfig"] ?? stored.recommenderConfig,
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(recommenderKey(arn), updated);
  return { recommenderArn: arn };
};

const StartRecommender: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "recommenderArn");
  const stored = requireRecommender(ctx, arn);
  const updated: StoredRecommender = {
    ...stored,
    status: "CREATE PENDING",
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(recommenderKey(arn), updated);
  return { recommenderArn: arn };
};

const StopRecommender: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "recommenderArn");
  const stored = requireRecommender(ctx, arn);
  const updated: StoredRecommender = {
    ...stored,
    status: "STOPPING",
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(recommenderKey(arn), updated);
  return { recommenderArn: arn };
};

const CreateEventTracker: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  requireDatasetGroup(ctx, datasetGroupArn);
  const arn = makeArn(ctx, "event-tracker", name);
  const trackingId = crypto.randomUUID();
  const now = nowSeconds();
  const stored: StoredEventTracker = {
    name,
    eventTrackerArn: arn,
    trackingId,
    datasetGroupArn,
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(eventTrackerKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { eventTrackerArn: arn, trackingId };
};

const DescribeEventTracker: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "eventTrackerArn");
  const stored = requireEventTracker(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(eventTrackerKey(arn), current);
  }
  return { eventTracker: eventTrackerView(current) };
};

const ListEventTrackers: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredEventTracker>()
    .filter((entry) => entry.key.startsWith(eventTrackerPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((t) => t.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    eventTrackers: items.map(eventTrackerSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteEventTracker: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "eventTrackerArn");
  requireEventTracker(ctx, arn);
  ctx.store.delete(eventTrackerKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const CreateFilter: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  const filterExpression = requireString(input, "filterExpression");
  requireDatasetGroup(ctx, datasetGroupArn);
  const arn = makeArn(ctx, "filter", name);
  const now = nowSeconds();
  const stored: StoredFilter = {
    name,
    filterArn: arn,
    datasetGroupArn,
    filterExpression,
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(filterKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { filterArn: arn };
};

const DescribeFilter: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "filterArn");
  const stored = requireFilter(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(filterKey(arn), current);
  }
  return { filter: filterView(current) };
};

const ListFilters: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredFilter>()
    .filter((entry) => entry.key.startsWith(filterPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((f) => f.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    Filters: items.map(filterSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteFilter: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "filterArn");
  requireFilter(ctx, arn);
  ctx.store.delete(filterKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const CreateMetricAttribution: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const datasetGroupArn = requireString(input, "datasetGroupArn");
  requireDatasetGroup(ctx, datasetGroupArn);
  const arn = makeArn(ctx, "metric-attribution", name);
  const now = nowSeconds();
  const stored: StoredMetricAttribution = {
    name,
    metricAttributionArn: arn,
    datasetGroupArn,
    metrics: Array.isArray(input["metrics"])
      ? (input["metrics"] as unknown[])
      : [],
    metricsOutputConfig: input["metricsOutputConfig"],
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(metricAttributionKey(arn), stored);
  return { metricAttributionArn: arn };
};

const DescribeMetricAttribution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "metricAttributionArn");
  const stored = requireMetricAttribution(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(metricAttributionKey(arn), current);
  }
  return { metricAttribution: metricAttributionView(current) };
};

const ListMetricAttributions: OperationHandler = (input, ctx) => {
  const datasetGroupArnFilter = stringOrUndefined(input["datasetGroupArn"]);
  let all = ctx.store
    .list<StoredMetricAttribution>()
    .filter((entry) => entry.key.startsWith(metricAttributionPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (datasetGroupArnFilter !== undefined) {
    all = all.filter((m) => m.datasetGroupArn === datasetGroupArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    metricAttributions: items.map(metricAttributionSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const DeleteMetricAttribution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "metricAttributionArn");
  requireMetricAttribution(ctx, arn);
  ctx.store.delete(metricAttributionKey(arn));
  return {};
};

const UpdateMetricAttribution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "metricAttributionArn");
  const stored = requireMetricAttribution(ctx, arn);
  const addMetrics = Array.isArray(input["addMetrics"])
    ? (input["addMetrics"] as unknown[])
    : [];
  const removeMetrics = Array.isArray(input["removeMetrics"])
    ? (input["removeMetrics"] as string[])
    : [];
  const existingMetrics = stored.metrics as Array<{ eventType: string }>;
  const filteredMetrics = existingMetrics.filter(
    (m) => !removeMetrics.includes(m.eventType),
  );
  const updated: StoredMetricAttribution = {
    ...stored,
    metrics: [...filteredMetrics, ...addMetrics],
    metricsOutputConfig:
      input["metricsOutputConfig"] ?? stored.metricsOutputConfig,
    lastUpdatedDateTime: nowSeconds(),
  };
  ctx.store.set(metricAttributionKey(arn), updated);
  return { metricAttributionArn: arn };
};

const ListMetricAttributionMetrics: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "metricAttributionArn");
  const stored = requireMetricAttribution(ctx, arn);
  const { items, nextToken } = paginateList(
    stored.metrics as unknown[],
    input["nextToken"],
    input["maxResults"],
  );
  return {
    metrics: items,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const CreateBatchInferenceJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const solutionVersionArn = requireString(input, "solutionVersionArn");
  const roleArn = requireString(input, "roleArn");
  requireSolutionVersion(ctx, solutionVersionArn);
  const arn = makeArnWithId(ctx, "batch-inference-job");
  const now = nowSeconds();
  const stored: StoredBatchInferenceJob = {
    jobName,
    batchInferenceJobArn: arn,
    solutionVersionArn,
    filterArn: stringOrUndefined(input["filterArn"]),
    numResults: numberOrUndefined(input["numResults"]),
    jobInput: input["jobInput"],
    jobOutput: input["jobOutput"],
    roleArn,
    batchInferenceJobConfig: input["batchInferenceJobConfig"],
    batchInferenceJobMode: stringOrUndefined(input["batchInferenceJobMode"]),
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(batchInferenceJobKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { batchInferenceJobArn: arn };
};

const DescribeBatchInferenceJob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "batchInferenceJobArn");
  const stored = requireBatchInferenceJob(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(batchInferenceJobKey(arn), current);
  }
  return { batchInferenceJob: batchInferenceJobView(current) };
};

const ListBatchInferenceJobs: OperationHandler = (input, ctx) => {
  const solutionVersionArnFilter = stringOrUndefined(
    input["solutionVersionArn"],
  );
  let all = ctx.store
    .list<StoredBatchInferenceJob>()
    .filter((entry) => entry.key.startsWith(batchInferenceJobPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (solutionVersionArnFilter !== undefined) {
    all = all.filter((j) => j.solutionVersionArn === solutionVersionArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    batchInferenceJobs: items.map(batchInferenceJobSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const CreateBatchSegmentJob: OperationHandler = (input, ctx) => {
  const jobName = requireString(input, "jobName");
  const solutionVersionArn = requireString(input, "solutionVersionArn");
  const roleArn = requireString(input, "roleArn");
  requireSolutionVersion(ctx, solutionVersionArn);
  const arn = makeArnWithId(ctx, "batch-segment-job");
  const now = nowSeconds();
  const stored: StoredBatchSegmentJob = {
    jobName,
    batchSegmentJobArn: arn,
    solutionVersionArn,
    filterArn: stringOrUndefined(input["filterArn"]),
    numResults: numberOrUndefined(input["numResults"]),
    jobInput: input["jobInput"],
    jobOutput: input["jobOutput"],
    roleArn,
    status: "CREATE PENDING",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(batchSegmentJobKey(arn), stored);
  if (Array.isArray(input["tags"])) {
    const tags: Record<string, string> = {};
    for (const tag of input["tags"] as Array<{
      tagKey: string;
      tagValue: string;
    }>) {
      tags[tag.tagKey] = tag.tagValue;
    }
    ctx.store.set(tagsKey(arn), tags);
  }
  return { batchSegmentJobArn: arn };
};

const DescribeBatchSegmentJob: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "batchSegmentJobArn");
  const stored = requireBatchSegmentJob(ctx, arn);
  const newStatus = advancePersonalizeStatus(stored.status);
  const current =
    newStatus !== stored.status
      ? { ...stored, status: newStatus, lastUpdatedDateTime: nowSeconds() }
      : stored;
  if (newStatus !== stored.status) {
    ctx.store.set(batchSegmentJobKey(arn), current);
  }
  return { batchSegmentJob: batchSegmentJobView(current) };
};

const ListBatchSegmentJobs: OperationHandler = (input, ctx) => {
  const solutionVersionArnFilter = stringOrUndefined(
    input["solutionVersionArn"],
  );
  let all = ctx.store
    .list<StoredBatchSegmentJob>()
    .filter((entry) => entry.key.startsWith(batchSegmentJobPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.creationDateTime - b.creationDateTime);
  if (solutionVersionArnFilter !== undefined) {
    all = all.filter((j) => j.solutionVersionArn === solutionVersionArnFilter);
  }
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    batchSegmentJobs: items.map(batchSegmentJobSummaryView),
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = input["tags"] as Record<string, string> | undefined;
  const existing = getTags(ctx, resourceArn);
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...(newTags ?? {}) });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing = getTags(ctx, resourceArn);
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  return { tags: getTags(ctx, resourceArn) };
};

const DescribeAlgorithm: OperationHandler = (input, _ctx) => {
  const algorithmArn = requireString(input, "algorithmArn");
  return {
    algorithm: {
      name: algorithmArn.split("/").pop() ?? "unknown",
      algorithmArn,
      algorithmImage: {
        name: "personalize-ranking",
        dockerURI:
          "382416733822.dkr.ecr.us-east-1.amazonaws.com/personalize-ranking:1",
      },
      defaultHyperParameters: {},
      defaultHyperParameterRanges: {
        integerHyperParameterRanges: [],
        continuousHyperParameterRanges: [],
        categoricalHyperParameterRanges: [],
      },
      roleArn: `arn:aws:iam::000000000000:role/personalize`,
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
    },
  };
};

const DescribeFeatureTransformation: OperationHandler = (input, _ctx) => {
  const featureTransformationArn = requireString(
    input,
    "featureTransformationArn",
  );
  return {
    featureTransformation: {
      name: featureTransformationArn.split("/").pop() ?? "unknown",
      featureTransformationArn,
      defaultParameters: {},
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
      status: "ACTIVE",
    },
  };
};

const DescribeRecipe: OperationHandler = (input, _ctx) => {
  const recipeArn = requireString(input, "recipeArn");
  return {
    recipe: {
      name: recipeArn.split("/").pop() ?? "unknown",
      recipeArn,
      description: "Personalize recipe",
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
      status: "ACTIVE",
      recipeType: "USER_PERSONALIZATION",
    },
  };
};

const ListRecipes: OperationHandler = (input, _ctx) => {
  const domain = stringOrUndefined(input["domain"]);
  const recipes = [
    {
      name: "aws-user-personalization",
      recipeArn: "arn:aws:personalize:::recipe/aws-user-personalization",
      status: "ACTIVE",
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
      domain: undefined,
    },
    {
      name: "aws-sims",
      recipeArn: "arn:aws:personalize:::recipe/aws-sims",
      status: "ACTIVE",
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
      domain: undefined,
    },
    {
      name: "aws-popularity-count",
      recipeArn: "arn:aws:personalize:::recipe/aws-popularity-count",
      status: "ACTIVE",
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
      domain: undefined,
    },
    {
      name: "aws-ecomm-recommended-for-you",
      recipeArn: "arn:aws:personalize:::recipe/aws-ecomm-recommended-for-you",
      status: "ACTIVE",
      creationDateTime: 1609459200,
      lastUpdatedDateTime: 1609459200,
      domain: "ECOMMERCE",
    },
  ];
  const filtered = domain
    ? recipes.filter((r) => r.domain === domain || r.domain === undefined)
    : recipes;
  const { items, nextToken } = paginateList(
    filtered,
    input["nextToken"],
    input["maxResults"],
  );
  return {
    recipes: items,
    ...(nextToken !== undefined ? { nextToken } : {}),
  };
};

const personalize = {
  name: "personalize",
  protocol: "json",
  operations: {
    CreateSchema,
    DescribeSchema,
    ListSchemas,
    DeleteSchema,
    CreateDatasetGroup,
    DescribeDatasetGroup,
    ListDatasetGroups,
    DeleteDatasetGroup,
    CreateDataset,
    DescribeDataset,
    ListDatasets,
    DeleteDataset,
    UpdateDataset,
    CreateDatasetImportJob,
    DescribeDatasetImportJob,
    ListDatasetImportJobs,
    CreateDatasetExportJob,
    DescribeDatasetExportJob,
    ListDatasetExportJobs,
    CreateDataDeletionJob,
    DescribeDataDeletionJob,
    ListDataDeletionJobs,
    CreateSolution,
    DescribeSolution,
    ListSolutions,
    DeleteSolution,
    UpdateSolution,
    CreateSolutionVersion,
    DescribeSolutionVersion,
    ListSolutionVersions,
    StopSolutionVersionCreation,
    GetSolutionMetrics,
    CreateCampaign,
    DescribeCampaign,
    ListCampaigns,
    DeleteCampaign,
    UpdateCampaign,
    CreateRecommender,
    DescribeRecommender,
    ListRecommenders,
    DeleteRecommender,
    UpdateRecommender,
    StartRecommender,
    StopRecommender,
    CreateEventTracker,
    DescribeEventTracker,
    ListEventTrackers,
    DeleteEventTracker,
    CreateFilter,
    DescribeFilter,
    ListFilters,
    DeleteFilter,
    CreateMetricAttribution,
    DescribeMetricAttribution,
    ListMetricAttributions,
    DeleteMetricAttribution,
    UpdateMetricAttribution,
    ListMetricAttributionMetrics,
    CreateBatchInferenceJob,
    DescribeBatchInferenceJob,
    ListBatchInferenceJobs,
    CreateBatchSegmentJob,
    DescribeBatchSegmentJob,
    ListBatchSegmentJobs,
    TagResource,
    UntagResource,
    ListTagsForResource,
    DescribeAlgorithm,
    DescribeFeatureTransformation,
    DescribeRecipe,
    ListRecipes,
  },
  model,
} as const satisfies ServiceDefinition;

export default personalize;
