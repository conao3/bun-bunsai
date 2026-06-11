import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import iotModel from "../../../../test/vendor/aws-models/iot.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(iotModel);

const thingKey = (name: string) => `thing:${name}`;
const thingTypeKey = (name: string) => `thingType:${name}`;
const thingGroupKey = (name: string) => `thingGroup:${name}`;
const certKey = (id: string) => `cert:${id}`;
const policyKey = (name: string) => `policy:${name}`;
const topicRuleKey = (name: string) => `rule:${name}`;
const tagsKey = (arn: string) => `tags:${arn}`;
const thingGroupMembersKey = (groupName: string) =>
  `thingGroupMembers:${groupName}`;
const thingGroupsForThingKey = (thingName: string) =>
  `thingGroupsForThing:${thingName}`;
const policyAttachmentsKey = (policyName: string) =>
  `policyAttach:${policyName}`;
const principalPoliciesKey = (principal: string) =>
  `principalPolicies:${principal}`;
const thingPrincipalsKey = (thingName: string) =>
  `thingPrincipals:${thingName}`;
const principalThingsKey = (principal: string) =>
  `principalThings:${principal}`;
const policyVersionKey = (policyName: string, versionId: string) =>
  `policyVersion:${policyName}:${versionId}`;
const policyVersionsKey = (policyName: string) =>
  `policyVersions:${policyName}`;
const allThingsKey = "allThings";
const allThingTypesKey = "allThingTypes";
const allThingGroupsKey = "allThingGroups";
const allCertsKey = "allCerts";
const allPoliciesKey = "allPolicies";
const allRulesKey = "allRules";
const jobKey = (id: string) => `job:${id}`;
const jobTemplateKey = (id: string) => `jobTemplate:${id}`;
const commandKey = (id: string) => `command:${id}`;
const commandExecutionKey = (id: string) => `commandExecution:${id}`;
const jobExecutionKey = (jobId: string, thingName: string) =>
  `jobExec:${jobId}:${thingName}`;
const jobExecutionsForJobKey = (jobId: string) => `jobExecsForJob:${jobId}`;
const jobExecutionsForThingKey = (thingName: string) =>
  `jobExecsForThing:${thingName}`;
const allJobsKey = "allJobs";
const allJobTemplatesKey = "allJobTemplates";
const allCommandsKey = "allCommands";
const allCommandExecutionsKey = "allCommandExecutions";
const caCertKey = (id: string) => `caCert:${id}`;
const allCACertsKey = "allCACerts";
const registrationCodeKey = "registrationCode";
const certProviderKey = (name: string) => `certProvider:${name}`;
const allCertProvidersKey = "allCertProviders";
const provisioningTemplateKey = (name: string) => `provTemplate:${name}`;
const provisioningTemplateVersionKey = (name: string, versionId: number) =>
  `provTemplateV:${name}:${versionId}`;
const provisioningTemplateVersionsKey = (name: string) =>
  `provTemplateVersions:${name}`;
const allProvisioningTemplatesKey = "allProvisioningTemplates";
const roleAliasKey = (alias: string) => `roleAlias:${alias}`;
const allRoleAliasesKey = "allRoleAliases";
const authorizerKey = (name: string) => `authorizer:${name}`;
const allAuthorizersKey = "allAuthorizers";
const defaultAuthorizerKey = "defaultAuthorizer";
const domainConfigKey = (name: string) => `domainConfig:${name}`;
const allDomainConfigsKey = "allDomainConfigs";
const auditConfigKey = "auditConfig";
const auditTaskKey = (id: string) => `auditTask:${id}`;
const allAuditTasksKey = "allAuditTasks";
const auditFindingKey = (id: string) => `auditFinding:${id}`;
const allAuditFindingsKey = "allAuditFindings";
const auditSuppressionKey = (checkName: string, resourceId: string) =>
  `auditSuppression:${checkName}:${resourceId}`;
const allAuditSuppressionsKey = "allAuditSuppressions";
const mitigationActionKey = (name: string) => `mitigationAction:${name}`;
const allMitigationActionsKey = "allMitigationActions";
const auditMitigationTaskKey = (id: string) => `auditMitigationTask:${id}`;
const allAuditMitigationTasksKey = "allAuditMitigationTasks";
const scheduledAuditKey = (name: string) => `scheduledAudit:${name}`;
const allScheduledAuditsKey = "allScheduledAudits";
const securityProfileKey = (name: string) => `securityProfile:${name}`;
const allSecurityProfilesKey = "allSecurityProfiles";
const securityProfileTargetsKey = (name: string) =>
  `securityProfileTargets:${name}`;
const customMetricKey = (name: string) => `customMetric:${name}`;
const allCustomMetricsKey = "allCustomMetrics";
const dimensionKey = (name: string) => `dimension:${name}`;
const allDimensionsKey = "allDimensions";
const detectTaskKey = (id: string) => `detectTask:${id}`;
const allDetectTasksKey = "allDetectTasks";

type StoredThing = {
  thingName: string;
  thingArn: string;
  thingId: string;
  thingTypeName?: string;
  attributes: Record<string, string>;
  version: number;
  createdAt: number;
};

type StoredThingType = {
  thingTypeName: string;
  thingTypeArn: string;
  thingTypeId: string;
  thingTypeDescription?: string;
  deprecated: boolean;
  deprecationDate?: number;
  createdAt: number;
};

type StoredThingGroup = {
  thingGroupName: string;
  thingGroupArn: string;
  thingGroupId: string;
  thingGroupDescription?: string;
  parentGroupName?: string;
  version: number;
  createdAt: number;
};

type StoredCertificate = {
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  publicKey: string;
  privateKey: string;
  status: string;
  createdAt: number;
};

type StoredPolicy = {
  policyName: string;
  policyArn: string;
  policyDocument: string;
  defaultVersionId: string;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredTopicRule = {
  ruleName: string;
  ruleArn: string;
  topicRulePayload: unknown;
  enabled: boolean;
  createdAt: number;
};

type StoredPolicyVersion = {
  policyVersionId: string;
  policyDocument: string;
  isDefaultVersion: boolean;
  createdAt: number;
};

type StoredJob = {
  jobId: string;
  jobArn: string;
  targets: string[];
  status: string;
  description?: string;
  document?: string;
  documentSource?: string;
  targetSelection?: string;
  createdAt: number;
  lastUpdatedAt: number;
  completedAt?: number;
};

type StoredJobExecution = {
  jobId: string;
  thingName: string;
  executionNumber: number;
  status: string;
  queuedAt: number;
  lastUpdatedAt: number;
  versionNumber: number;
};

type StoredJobTemplate = {
  jobTemplateId: string;
  jobTemplateArn: string;
  description: string;
  document?: string;
  documentSource?: string;
  createdAt: number;
};

type StoredCommand = {
  commandId: string;
  commandArn: string;
  namespace?: string;
  displayName?: string;
  description?: string;
  payload?: unknown;
  payloadTemplate?: string;
  mandatoryParameters?: unknown[];
  roleArn?: string;
  deprecated: boolean;
  pendingDeletion: boolean;
  createdAt: number;
  lastUpdatedAt: number;
};

type StoredCommandExecution = {
  executionId: string;
  commandArn: string;
  targetArn: string;
  status: string;
  createdAt: number;
  lastUpdatedAt: number;
  completedAt?: number;
};

type StoredCACertificate = {
  certificateId: string;
  certificateArn: string;
  certificatePem: string;
  status: string;
  autoRegistrationStatus: string;
  createdAt: number;
};

type StoredCertificateProvider = {
  certificateProviderName: string;
  certificateProviderArn: string;
  lambdaFunctionArn: string;
  accountDefaultForOperations: string[];
  createdAt: number;
  lastModifiedAt: number;
};

type StoredProvisioningTemplate = {
  templateName: string;
  templateArn: string;
  description?: string;
  templateBody: string;
  enabled: boolean;
  provisioningRoleArn: string;
  defaultVersionId: number;
  createdAt: number;
  lastModifiedDate: number;
  type: string;
};

type StoredProvisioningTemplateVersion = {
  versionId: number;
  templateBody: string;
  isDefaultVersion: boolean;
  createdAt: number;
};

type StoredRoleAlias = {
  roleAlias: string;
  roleAliasArn: string;
  roleArn: string;
  credentialDurationSeconds: number;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredAuthorizer = {
  authorizerName: string;
  authorizerArn: string;
  authorizerFunctionArn: string;
  tokenKeyName?: string;
  tokenSigningPublicKeys?: Record<string, string>;
  status: string;
  signingDisabled: boolean;
  enableCachingForHttp: boolean;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredDomainConfiguration = {
  domainConfigurationName: string;
  domainConfigurationArn: string;
  domainName?: string;
  serviceType?: string;
  domainConfigurationStatus: string;
  domainType: string;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredAccountAuditConfig = {
  roleArn?: string;
  auditNotificationTargetConfigurations?: unknown;
  auditCheckConfigurations?: unknown;
};

type StoredAuditTask = {
  taskId: string;
  taskType: string;
  taskStatus: string;
  taskStartTime: number;
  scheduledAuditName?: string;
  auditDetails?: unknown;
};

type StoredAuditFinding = {
  findingId: string;
  checkName: string;
  taskId: string;
  findingTime: number;
  severity: string;
  resourceIdentifier: unknown;
  nonCompliantResource?: unknown;
  relatedResources?: unknown[];
  reasonForNonCompliance?: string;
  reasonForNonComplianceCode?: string;
  isSuppressed?: boolean;
};

type StoredAuditSuppression = {
  checkName: string;
  resourceIdentifier: unknown;
  expirationDate?: number;
  suppressIndefinitely?: boolean;
  description?: string;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredMitigationAction = {
  actionName: string;
  actionArn: string;
  actionId: string;
  roleArn: string;
  actionParams: unknown;
  createdDate: number;
  lastModifiedDate: number;
};

type StoredAuditMitigationActionsTask = {
  taskId: string;
  target: unknown;
  auditCheckToActionsMapping: unknown;
  taskStatus: string;
  startTime: number;
  endTime?: number;
};

type StoredScheduledAudit = {
  scheduledAuditName: string;
  scheduledAuditArn: string;
  frequency: string;
  dayOfMonth?: string;
  dayOfWeek?: string;
  targetCheckNames: string[];
  createdAt: number;
  lastModifiedDate: number;
};

type StoredSecurityProfile = {
  securityProfileName: string;
  securityProfileArn: string;
  securityProfileDescription?: string;
  behaviors?: unknown[];
  alertTargets?: unknown;
  additionalMetricsToRetainV2?: unknown[];
  metricsExportConfig?: unknown;
  version: number;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredCustomMetric = {
  metricName: string;
  metricArn: string;
  displayName?: string;
  metricType: string;
  createdAt: number;
  lastModifiedDate: number;
};

type StoredDimension = {
  name: string;
  arn: string;
  type: string;
  stringValues: string[];
  createdAt: number;
  lastModifiedDate: number;
};

type StoredDetectMitigationActionsTask = {
  taskId: string;
  target: unknown;
  actions: string[];
  violationEventOccurrenceRange?: unknown;
  includeOnlyActiveViolations?: boolean;
  includeSuppressedAlerts?: boolean;
  taskStatus: string;
  taskStartTime: number;
  taskEndTime?: number;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const thingArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:thing/${name}`;
const thingTypeArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:thingtype/${name}`;
const thingGroupArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:thinggroup/${name}`;
const certArn = (ctx: ServiceContext, id: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:cert/${id}`;
const policyArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:policy/${name}`;
const ruleArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:rule/${name}`;
const jobArn = (ctx: ServiceContext, id: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:job/${id}`;
const jobTemplateArn = (ctx: ServiceContext, id: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:jobtemplate/${id}`;
const commandArn = (ctx: ServiceContext, id: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:command/${id}`;
const caCertArn = (ctx: ServiceContext, id: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:cacert/${id}`;
const certProviderArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:certificateprovider/${name}`;
const provisioningTemplateArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:provisioningtemplate/${name}`;
const roleAliasArn = (ctx: ServiceContext, alias: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:rolealias/${alias}`;
const authorizerArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:authorizer/${name}`;
const domainConfigArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:domainconfiguration/${name}/V1`;
const mitigationActionArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:mitigationaction/${name}`;
const scheduledAuditArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:scheduledaudit/${name}`;
const securityProfileArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:securityprofile/${name}`;
const customMetricArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:custommetric/${name}`;
const dimensionArn = (ctx: ServiceContext, name: string) =>
  `arn:aws:iot:${ctx.region}:${ctx.account}:dimension/${name}`;

const pemOf = (id: string): string =>
  `-----BEGIN CERTIFICATE-----\n${Buffer.from(id, "utf8").toString("base64")}\n-----END CERTIFICATE-----`;
const privateKeyOf = (id: string): string =>
  `-----BEGIN RSA PRIVATE KEY-----\n${Buffer.from(`key:${id}`, "utf8").toString("base64")}\n-----END RSA PRIVATE KEY-----`;
const publicKeyOf = (id: string): string =>
  `-----BEGIN PUBLIC KEY-----\n${Buffer.from(`pub:${id}`, "utf8").toString("base64")}\n-----END PUBLIC KEY-----`;

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const requireStr = (data: Record<string, unknown>, field: string): string => {
  const v = str(data[field]);
  if (v === undefined)
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  return v;
};

const requireThing = (ctx: ServiceContext, name: string): StoredThing => {
  const stored = ctx.store.get<StoredThing>(thingKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Thing ${name} not found.`,
      404,
    );
  return stored;
};

const requireThingType = (
  ctx: ServiceContext,
  name: string,
): StoredThingType => {
  const stored = ctx.store.get<StoredThingType>(thingTypeKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `ThingType ${name} not found.`,
      404,
    );
  return stored;
};

const requireThingGroup = (
  ctx: ServiceContext,
  name: string,
): StoredThingGroup => {
  const stored = ctx.store.get<StoredThingGroup>(thingGroupKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `ThingGroup ${name} not found.`,
      404,
    );
  return stored;
};

const requireCert = (ctx: ServiceContext, id: string): StoredCertificate => {
  const stored = ctx.store.get<StoredCertificate>(certKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Certificate ${id} not found.`,
      404,
    );
  return stored;
};

const requirePolicy = (ctx: ServiceContext, name: string): StoredPolicy => {
  const stored = ctx.store.get<StoredPolicy>(policyKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Policy ${name} not found.`,
      404,
    );
  return stored;
};

const requireRule = (ctx: ServiceContext, name: string): StoredTopicRule => {
  const stored = ctx.store.get<StoredTopicRule>(topicRuleKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `TopicRule ${name} not found.`,
      404,
    );
  return stored;
};

const requireCACert = (
  ctx: ServiceContext,
  id: string,
): StoredCACertificate => {
  const stored = ctx.store.get<StoredCACertificate>(caCertKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `CA Certificate ${id} not found.`,
      404,
    );
  return stored;
};

const requireCertProvider = (
  ctx: ServiceContext,
  name: string,
): StoredCertificateProvider => {
  const stored = ctx.store.get<StoredCertificateProvider>(
    certProviderKey(name),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Certificate provider ${name} not found.`,
      404,
    );
  return stored;
};

const requireProvisioningTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredProvisioningTemplate => {
  const stored = ctx.store.get<StoredProvisioningTemplate>(
    provisioningTemplateKey(name),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Provisioning template ${name} not found.`,
      404,
    );
  return stored;
};

const requireRoleAlias = (
  ctx: ServiceContext,
  alias: string,
): StoredRoleAlias => {
  const stored = ctx.store.get<StoredRoleAlias>(roleAliasKey(alias));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Role alias ${alias} not found.`,
      404,
    );
  return stored;
};

const requireAuthorizer = (
  ctx: ServiceContext,
  name: string,
): StoredAuthorizer => {
  const stored = ctx.store.get<StoredAuthorizer>(authorizerKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Authorizer ${name} not found.`,
      404,
    );
  return stored;
};

const requireDomainConfig = (
  ctx: ServiceContext,
  name: string,
): StoredDomainConfiguration => {
  const stored = ctx.store.get<StoredDomainConfiguration>(
    domainConfigKey(name),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Domain configuration ${name} not found.`,
      404,
    );
  return stored;
};

const requireAuditTask = (ctx: ServiceContext, id: string): StoredAuditTask => {
  const stored = ctx.store.get<StoredAuditTask>(auditTaskKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Audit task ${id} not found.`,
      404,
    );
  return stored;
};

const requireAuditSuppression = (
  ctx: ServiceContext,
  checkName: string,
  resourceId: string,
): StoredAuditSuppression => {
  const stored = ctx.store.get<StoredAuditSuppression>(
    auditSuppressionKey(checkName, resourceId),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Audit suppression for check ${checkName} not found.`,
      404,
    );
  return stored;
};

const requireMitigationAction = (
  ctx: ServiceContext,
  name: string,
): StoredMitigationAction => {
  const stored = ctx.store.get<StoredMitigationAction>(
    mitigationActionKey(name),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Mitigation action ${name} not found.`,
      404,
    );
  return stored;
};

const requireAuditMitigationTask = (
  ctx: ServiceContext,
  id: string,
): StoredAuditMitigationActionsTask => {
  const stored = ctx.store.get<StoredAuditMitigationActionsTask>(
    auditMitigationTaskKey(id),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Audit mitigation actions task ${id} not found.`,
      404,
    );
  return stored;
};

const requireScheduledAudit = (
  ctx: ServiceContext,
  name: string,
): StoredScheduledAudit => {
  const stored = ctx.store.get<StoredScheduledAudit>(scheduledAuditKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Scheduled audit ${name} not found.`,
      404,
    );
  return stored;
};

const requireSecurityProfile = (
  ctx: ServiceContext,
  name: string,
): StoredSecurityProfile => {
  const stored = ctx.store.get<StoredSecurityProfile>(securityProfileKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Security profile ${name} not found.`,
      404,
    );
  return stored;
};

const requireCustomMetric = (
  ctx: ServiceContext,
  name: string,
): StoredCustomMetric => {
  const stored = ctx.store.get<StoredCustomMetric>(customMetricKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Custom metric ${name} not found.`,
      404,
    );
  return stored;
};

const requireDimension = (
  ctx: ServiceContext,
  name: string,
): StoredDimension => {
  const stored = ctx.store.get<StoredDimension>(dimensionKey(name));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Dimension ${name} not found.`,
      404,
    );
  return stored;
};

const requireDetectMitigationTask = (
  ctx: ServiceContext,
  id: string,
): StoredDetectMitigationActionsTask => {
  const stored = ctx.store.get<StoredDetectMitigationActionsTask>(
    detectTaskKey(id),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Detect mitigation actions task ${id} not found.`,
      404,
    );
  return stored;
};

const resourceIdKey = (resourceIdentifier: unknown): string => {
  const r = resourceIdentifier as Record<string, unknown>;
  return JSON.stringify(
    Object.keys(r)
      .sort()
      .reduce(
        (acc, k) => {
          acc[k] = r[k];
          return acc;
        },
        {} as Record<string, unknown>,
      ),
  );
};

const getList = <T>(ctx: ServiceContext, key: string): T[] =>
  ctx.store.get<T[]>(key) ?? [];

const addToList = <T>(ctx: ServiceContext, key: string, item: T): void => {
  const list = getList<T>(ctx, key);
  ctx.store.set(key, [...list, item]);
};

const removeFromList = <T>(
  ctx: ServiceContext,
  key: string,
  pred: (item: T) => boolean,
): void => {
  const list = getList<T>(ctx, key);
  ctx.store.set(
    key,
    list.filter((item) => !pred(item)),
  );
};

const certIdFromArn = (arn: string): string => {
  const parts = arn.split("/");
  return parts[parts.length - 1] ?? arn;
};

const paginateList = <T>(
  items: T[],
  marker?: string,
  pageSize = 250,
): { items: T[]; nextMarker?: string } => {
  const start = marker
    ? parseInt(Buffer.from(marker, "base64").toString(), 10)
    : 0;
  const page = items.slice(start, start + pageSize);
  const nextMarker =
    start + pageSize < items.length
      ? Buffer.from(String(start + pageSize)).toString("base64")
      : undefined;
  return { items: page, nextMarker };
};

// === Thing operations ===

const CreateThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  if (ctx.store.get(thingKey(thingName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Thing ${thingName} already exists.`,
      409,
    );
  }
  const thingId = crypto.randomUUID();
  const arn = thingArn(ctx, thingName);
  const thingTypeName = str(data["thingTypeName"]);
  if (thingTypeName) requireThingType(ctx, thingTypeName);
  const stored: StoredThing = {
    thingName,
    thingArn: arn,
    thingId,
    thingTypeName,
    attributes:
      ((data["attributePayload"] as Record<string, unknown>)
        ?.attributes as Record<string, string>) ?? {},
    version: 1,
    createdAt: nowSeconds(),
  };
  ctx.store.set(thingKey(thingName), stored);
  addToList(ctx, allThingsKey, thingName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { thingName, thingArn: arn, thingId };
};

const DescribeThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const stored = requireThing(ctx, thingName);
  return {
    thingName: stored.thingName,
    thingArn: stored.thingArn,
    thingId: stored.thingId,
    thingTypeName: stored.thingTypeName,
    attributes: stored.attributes,
    version: stored.version,
  };
};

const UpdateThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const stored = requireThing(ctx, thingName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing ${thingName}.`,
      409,
    );
  }
  const removeThingType = data["removeThingType"] === true;
  const thingTypeName = removeThingType
    ? undefined
    : (str(data["thingTypeName"]) ?? stored.thingTypeName);
  const attributePayload = data["attributePayload"] as
    | Record<string, unknown>
    | undefined;
  let attributes = { ...stored.attributes };
  if (attributePayload) {
    const newAttrs =
      (attributePayload["attributes"] as Record<string, string> | undefined) ??
      {};
    if (attributePayload["merge"] === true) {
      attributes = { ...attributes, ...newAttrs };
    } else {
      attributes = newAttrs;
    }
  }
  ctx.store.set(thingKey(thingName), {
    ...stored,
    thingTypeName,
    attributes,
    version: stored.version + 1,
  });
  return {};
};

const DeleteThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const stored = requireThing(ctx, thingName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing ${thingName}.`,
      409,
    );
  }
  const principals = getList<string>(ctx, thingPrincipalsKey(thingName));
  if (principals.length > 0) {
    throw awsError(
      "InvalidRequestException",
      `Cannot delete. Thing ${thingName} is still attached to one or more principals.`,
      400,
    );
  }
  const groups = getList<string>(ctx, thingGroupsForThingKey(thingName));
  for (const groupName of groups) {
    removeFromList<string>(
      ctx,
      thingGroupMembersKey(groupName),
      (n) => n === thingName,
    );
  }
  ctx.store.set(thingGroupsForThingKey(thingName), undefined);
  ctx.store.set(thingPrincipalsKey(thingName), undefined);
  ctx.store.set(tagsKey(stored.thingArn), undefined);
  ctx.store.set(thingKey(thingName), undefined);
  removeFromList<string>(ctx, allThingsKey, (n) => n === thingName);
  return {};
};

const ListThings: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]) ?? str(data["marker"]);
  const maxResults =
    typeof data["maxResults"] === "number"
      ? Math.min(data["maxResults"], 250)
      : undefined;
  const filterTypeName = str(data["thingTypeName"]);
  const attributeName = str(data["attributeName"]);
  const attributeValue = str(data["attributeValue"]);
  const usePrefixAttributeValue = data["usePrefixAttributeValue"] === true;
  let allNames = getList<string>(ctx, allThingsKey);
  if (filterTypeName || attributeName) {
    allNames = allNames.filter((n) => {
      const t = ctx.store.get<StoredThing>(thingKey(n));
      if (!t) return false;
      if (filterTypeName && t.thingTypeName !== filterTypeName) return false;
      if (attributeName && attributeValue !== undefined) {
        const val = t.attributes[attributeName];
        if (usePrefixAttributeValue) {
          if (!val?.startsWith(attributeValue)) return false;
        } else {
          if (val !== attributeValue) return false;
        }
      }
      return true;
    });
  }
  const { items: names, nextMarker } = paginateList(
    allNames,
    marker,
    maxResults,
  );
  const things = names
    .map((n) => ctx.store.get<StoredThing>(thingKey(n)))
    .filter(Boolean)
    .map((t) => ({
      thingName: t!.thingName,
      thingArn: t!.thingArn,
      thingTypeName: t!.thingTypeName,
      attributes: t!.attributes,
      version: t!.version,
    }));
  return { things, nextToken: nextMarker };
};

const ListThingGroupsForThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  requireThing(ctx, thingName);
  const groups = getList<string>(ctx, thingGroupsForThingKey(thingName));
  return {
    thingGroups: groups.map((g) => ({
      groupName: g,
      groupArn: thingGroupArn(ctx, g),
    })),
  };
};

// === ThingType operations ===

const CreateThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  if (ctx.store.get(thingTypeKey(thingTypeName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ThingType ${thingTypeName} already exists.`,
      409,
    );
  }
  const thingTypeId = crypto.randomUUID();
  const arn = thingTypeArn(ctx, thingTypeName);
  const props = data["thingTypeProperties"] as
    | Record<string, unknown>
    | undefined;
  const stored: StoredThingType = {
    thingTypeName,
    thingTypeArn: arn,
    thingTypeId,
    thingTypeDescription: str(props?.["thingTypeDescription"]),
    deprecated: false,
    createdAt: nowSeconds(),
  };
  ctx.store.set(thingTypeKey(thingTypeName), stored);
  addToList(ctx, allThingTypesKey, thingTypeName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {
    thingTypeName,
    thingTypeArn: arn,
    thingTypeId,
  };
};

const DescribeThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  const stored = requireThingType(ctx, thingTypeName);
  return {
    thingTypeName: stored.thingTypeName,
    thingTypeId: stored.thingTypeId,
    thingTypeArn: stored.thingTypeArn,
    thingTypeProperties: {
      thingTypeDescription: stored.thingTypeDescription,
    },
    thingTypeMetadata: {
      deprecated: stored.deprecated,
      deprecationDate: stored.deprecationDate,
      creationDate: stored.createdAt,
    },
  };
};

const DeleteThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  const stored = requireThingType(ctx, thingTypeName);
  ctx.store.set(tagsKey(stored.thingTypeArn), undefined);
  ctx.store.set(thingTypeKey(thingTypeName), undefined);
  removeFromList<string>(ctx, allThingTypesKey, (n) => n === thingTypeName);
  return {};
};

const ListThingTypes: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allThingTypesKey);
  const { items: names, nextMarker } = paginateList(allNames, marker);
  const thingTypes = names
    .map((n) => ctx.store.get<StoredThingType>(thingTypeKey(n)))
    .filter(Boolean)
    .map((t) => ({
      thingTypeName: t!.thingTypeName,
      thingTypeArn: t!.thingTypeArn,
      thingTypeProperties: { thingTypeDescription: t!.thingTypeDescription },
      thingTypeMetadata: {
        deprecated: t!.deprecated,
        deprecationDate: t!.deprecationDate,
        creationDate: t!.createdAt,
      },
    }));
  return { thingTypes, nextToken: nextMarker };
};

const DeprecateThingType: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingTypeName = requireStr(data, "thingTypeName");
  const stored = requireThingType(ctx, thingTypeName);
  ctx.store.set(thingTypeKey(thingTypeName), {
    ...stored,
    deprecated: true,
    deprecationDate: nowSeconds(),
  });
  return {};
};

// === ThingGroup operations ===

const CreateThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  if (ctx.store.get(thingGroupKey(thingGroupName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ThingGroup ${thingGroupName} already exists.`,
      409,
    );
  }
  const thingGroupId = crypto.randomUUID();
  const arn = thingGroupArn(ctx, thingGroupName);
  const props = data["thingGroupProperties"] as
    | Record<string, unknown>
    | undefined;
  const parentGroupName = str(data["parentGroupName"]);
  if (parentGroupName) requireThingGroup(ctx, parentGroupName);
  const stored: StoredThingGroup = {
    thingGroupName,
    thingGroupArn: arn,
    thingGroupId,
    thingGroupDescription: str(props?.["thingGroupDescription"]),
    parentGroupName,
    version: 1,
    createdAt: nowSeconds(),
  };
  ctx.store.set(thingGroupKey(thingGroupName), stored);
  addToList(ctx, allThingGroupsKey, thingGroupName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { thingGroupName, thingGroupArn: arn, thingGroupId };
};

const DescribeThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const stored = requireThingGroup(ctx, thingGroupName);
  return {
    thingGroupName: stored.thingGroupName,
    thingGroupId: stored.thingGroupId,
    thingGroupArn: stored.thingGroupArn,
    version: stored.version,
    thingGroupProperties: {
      thingGroupDescription: stored.thingGroupDescription,
    },
    thingGroupMetadata: {
      parentGroupName: stored.parentGroupName,
      creationDate: stored.createdAt,
    },
  };
};

const UpdateThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const stored = requireThingGroup(ctx, thingGroupName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing group ${thingGroupName}.`,
      409,
    );
  }
  const props = data["thingGroupProperties"] as
    | Record<string, unknown>
    | undefined;
  const updated = {
    ...stored,
    thingGroupDescription:
      str(props?.["thingGroupDescription"]) ?? stored.thingGroupDescription,
    version: stored.version + 1,
  };
  ctx.store.set(thingGroupKey(thingGroupName), updated);
  return { version: updated.version };
};

const DeleteThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const stored = requireThingGroup(ctx, thingGroupName);
  const expectedVersion = data["expectedVersion"];
  if (
    expectedVersion !== undefined &&
    Number(expectedVersion) !== stored.version
  ) {
    throw awsError(
      "VersionConflictException",
      `Version conflict for thing group ${thingGroupName}.`,
      409,
    );
  }
  const allGroupNames = getList<string>(ctx, allThingGroupsKey);
  for (const gName of allGroupNames) {
    const g = ctx.store.get<StoredThingGroup>(thingGroupKey(gName));
    if (g?.parentGroupName === thingGroupName) {
      throw awsError(
        "InvalidRequestException",
        `ThingGroup ${thingGroupName} has child groups.`,
        400,
      );
    }
  }
  const members = getList<string>(ctx, thingGroupMembersKey(thingGroupName));
  for (const memberName of members) {
    removeFromList<string>(
      ctx,
      thingGroupsForThingKey(memberName),
      (g) => g === thingGroupName,
    );
  }
  ctx.store.set(tagsKey(stored.thingGroupArn), undefined);
  ctx.store.set(thingGroupMembersKey(thingGroupName), undefined);
  ctx.store.set(thingGroupKey(thingGroupName), undefined);
  removeFromList<string>(ctx, allThingGroupsKey, (n) => n === thingGroupName);
  return {};
};

const ListThingGroups: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const maxResults =
    typeof data["maxResults"] === "number"
      ? Math.min(data["maxResults"], 250)
      : undefined;
  const parentGroup = str(data["parentGroup"]);
  const namePrefixFilter = str(data["namePrefixFilter"]);
  let allNames = getList<string>(ctx, allThingGroupsKey);
  if (parentGroup || namePrefixFilter) {
    allNames = allNames.filter((n) => {
      const g = ctx.store.get<StoredThingGroup>(thingGroupKey(n));
      if (!g) return false;
      if (parentGroup && g.parentGroupName !== parentGroup) return false;
      if (namePrefixFilter && !n.startsWith(namePrefixFilter)) return false;
      return true;
    });
  }
  const { items: names, nextMarker } = paginateList(
    allNames,
    marker,
    maxResults,
  );
  const thingGroups = names
    .map((n) => ctx.store.get<StoredThingGroup>(thingGroupKey(n)))
    .filter(Boolean)
    .map((g) => ({
      groupName: g!.thingGroupName,
      groupArn: g!.thingGroupArn,
    }));
  return { thingGroups, nextToken: nextMarker };
};

const AddThingToThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const thingName = requireStr(data, "thingName");
  requireThingGroup(ctx, thingGroupName);
  requireThing(ctx, thingName);
  const members = getList<string>(ctx, thingGroupMembersKey(thingGroupName));
  if (!members.includes(thingName)) {
    addToList(ctx, thingGroupMembersKey(thingGroupName), thingName);
  }
  const groups = getList<string>(ctx, thingGroupsForThingKey(thingName));
  if (!groups.includes(thingGroupName)) {
    addToList(ctx, thingGroupsForThingKey(thingName), thingGroupName);
  }
  return {};
};

const RemoveThingFromThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  const thingName = requireStr(data, "thingName");
  removeFromList<string>(
    ctx,
    thingGroupMembersKey(thingGroupName),
    (n) => n === thingName,
  );
  removeFromList<string>(
    ctx,
    thingGroupsForThingKey(thingName),
    (n) => n === thingGroupName,
  );
  return {};
};

const ListThingsInThingGroup: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingGroupName = requireStr(data, "thingGroupName");
  requireThingGroup(ctx, thingGroupName);
  const marker = str(data["nextToken"]);
  const allMembers = getList<string>(ctx, thingGroupMembersKey(thingGroupName));
  const { items: members, nextMarker } = paginateList(allMembers, marker);
  return { things: members, nextToken: nextMarker };
};

// === Certificate operations ===

const CreateKeysAndCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = certArn(ctx, id);
  const status =
    data["setAsActive"] === true || data["setAsActive"] === "true"
      ? "ACTIVE"
      : "INACTIVE";
  const stored: StoredCertificate = {
    certificateId: id,
    certificateArn: arn,
    certificatePem: pemOf(id),
    publicKey: publicKeyOf(id),
    privateKey: privateKeyOf(id),
    status,
    createdAt: nowSeconds(),
  };
  ctx.store.set(certKey(id), stored);
  addToList(ctx, allCertsKey, id);
  return {
    certificateArn: arn,
    certificateId: id,
    certificatePem: stored.certificatePem,
    keyPair: {
      PublicKey: stored.publicKey,
      PrivateKey: stored.privateKey,
    },
  };
};

const DescribeCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const stored = requireCert(ctx, certificateId);
  return {
    certificateDescription: {
      certificateArn: stored.certificateArn,
      certificateId: stored.certificateId,
      status: stored.status,
      certificatePem: stored.certificatePem,
      creationDate: stored.createdAt,
      lastModifiedDate: stored.createdAt,
    },
  };
};

const UpdateCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const newStatus = requireStr(data, "newStatus");
  if (newStatus === "PENDING_TRANSFER" || newStatus === "PENDING_ACTIVATION") {
    throw awsError(
      "CertificateStateException",
      `Setting the status to ${newStatus} is not allowed.`,
      406,
    );
  }
  const stored = requireCert(ctx, certificateId);
  ctx.store.set(certKey(certificateId), { ...stored, status: newStatus });
  return {};
};

const DeleteCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const forceDelete =
    data["forceDelete"] === true || data["forceDelete"] === "true";
  const stored = requireCert(ctx, certificateId);
  if (stored.status === "ACTIVE") {
    throw awsError(
      "CertificateStateException",
      `Certificate ${certificateId} is in ACTIVE state.`,
      406,
    );
  }
  const arn = certArn(ctx, certificateId);
  const attachedThings = getList<string>(ctx, principalThingsKey(arn));
  if (attachedThings.length > 0) {
    throw awsError(
      "DeleteConflictException",
      `Certificate ${certificateId} is attached to one or more things.`,
      409,
    );
  }
  const attachedPolicies = getList<string>(ctx, principalPoliciesKey(arn));
  if (attachedPolicies.length > 0 && !forceDelete) {
    throw awsError(
      "DeleteConflictException",
      `Certificate ${certificateId} has attached policies.`,
      409,
    );
  }
  for (const policyName of attachedPolicies) {
    removeFromList<string>(
      ctx,
      policyAttachmentsKey(policyName),
      (t) => t === arn,
    );
  }
  ctx.store.set(principalPoliciesKey(arn), undefined);
  ctx.store.set(principalThingsKey(arn), undefined);
  ctx.store.set(certKey(certificateId), undefined);
  removeFromList<string>(ctx, allCertsKey, (id) => id === certificateId);
  return {};
};

const ListCertificates: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allIds = getList<string>(ctx, allCertsKey);
  const { items: ids, nextMarker } = paginateList(allIds, marker);
  const certificates = ids
    .map((id) => ctx.store.get<StoredCertificate>(certKey(id)))
    .filter(Boolean)
    .map((c) => ({
      certificateArn: c!.certificateArn,
      certificateId: c!.certificateId,
      status: c!.status,
      creationDate: c!.createdAt,
    }));
  return { certificates, nextMarker };
};

// === Policy operations ===

const CreatePolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  if (ctx.store.get(policyKey(policyName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Policy ${policyName} already exists.`,
      409,
    );
  }
  const arn = policyArn(ctx, policyName);
  const policyDocument = requireStr(data, "policyDocument");
  const stored: StoredPolicy = {
    policyName,
    policyArn: arn,
    policyDocument,
    defaultVersionId: "1",
    createdAt: nowSeconds(),
    lastModifiedDate: nowSeconds(),
  };
  ctx.store.set(policyKey(policyName), stored);
  addToList(ctx, allPoliciesKey, policyName);
  const v1: StoredPolicyVersion = {
    policyVersionId: "1",
    policyDocument,
    isDefaultVersion: true,
    createdAt: stored.createdAt,
  };
  ctx.store.set(policyVersionKey(policyName, "1"), v1);
  addToList(ctx, policyVersionsKey(policyName), "1");
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {
    policyName,
    policyArn: arn,
    policyDocument,
    policyVersionId: "1",
  };
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const stored = requirePolicy(ctx, policyName);
  return {
    policyName: stored.policyName,
    policyArn: stored.policyArn,
    policyDocument: stored.policyDocument,
    defaultVersionId: stored.defaultVersionId,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const stored = requirePolicy(ctx, policyName);
  const targets = getList<string>(ctx, policyAttachmentsKey(policyName));
  if (targets.length > 0) {
    throw awsError(
      "DeleteConflictException",
      `Policy ${policyName} is attached to one or more principals.`,
      409,
    );
  }
  const versions = getList<string>(ctx, policyVersionsKey(policyName));
  for (const vId of versions) {
    ctx.store.set(policyVersionKey(policyName, vId), undefined);
  }
  ctx.store.set(policyVersionsKey(policyName), undefined);
  ctx.store.set(tagsKey(stored.policyArn), undefined);
  ctx.store.set(policyKey(policyName), undefined);
  removeFromList<string>(ctx, allPoliciesKey, (n) => n === policyName);
  return {};
};

const ListPolicies: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allNames = getList<string>(ctx, allPoliciesKey);
  const { items: names, nextMarker } = paginateList(allNames, marker);
  const policies = names
    .map((n) => ctx.store.get<StoredPolicy>(policyKey(n)))
    .filter(Boolean)
    .map((p) => ({
      policyName: p!.policyName,
      policyArn: p!.policyArn,
    }));
  return { policies, nextMarker };
};

const AttachPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const target = requireStr(data, "target");
  requirePolicy(ctx, policyName);
  const targets = getList<string>(ctx, policyAttachmentsKey(policyName));
  if (!targets.includes(target)) {
    addToList(ctx, policyAttachmentsKey(policyName), target);
  }
  const policies = getList<string>(ctx, principalPoliciesKey(target));
  if (!policies.includes(policyName)) {
    addToList(ctx, principalPoliciesKey(target), policyName);
  }
  return {};
};

const DetachPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const target = requireStr(data, "target");
  removeFromList<string>(
    ctx,
    policyAttachmentsKey(policyName),
    (t) => t === target,
  );
  removeFromList<string>(
    ctx,
    principalPoliciesKey(target),
    (p) => p === policyName,
  );
  return {};
};

const ListAttachedPolicies: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const target = requireStr(data, "target");
  const marker = str(data["marker"]);
  const allPolicyNames = getList<string>(ctx, principalPoliciesKey(target));
  const { items: names, nextMarker } = paginateList(allPolicyNames, marker);
  const policies = names
    .map((n) => ctx.store.get<StoredPolicy>(policyKey(n)))
    .filter(Boolean)
    .map((p) => ({
      policyName: p!.policyName,
      policyArn: p!.policyArn,
    }));
  return { policies, nextMarker };
};

const ListTargetsForPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  requirePolicy(ctx, policyName);
  const marker = str(data["marker"]);
  const allTargets = getList<string>(ctx, policyAttachmentsKey(policyName));
  const { items: targets, nextMarker } = paginateList(allTargets, marker);
  return { targets, nextMarker };
};

const CreatePolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyDocument = requireStr(data, "policyDocument");
  const setAsDefault =
    data["setAsDefault"] === true || data["setAsDefault"] === "true";
  const stored = requirePolicy(ctx, policyName);
  const versions = getList<string>(ctx, policyVersionsKey(policyName));
  if (versions.length >= 5) {
    throw awsError(
      "VersionsLimitExceededException",
      `The policy ${policyName} has too many versions.`,
      409,
    );
  }
  const maxVer = versions.reduce((m, v) => Math.max(m, parseInt(v, 10)), 0);
  const nextId = String(maxVer + 1);
  const version: StoredPolicyVersion = {
    policyVersionId: nextId,
    policyDocument,
    isDefaultVersion: setAsDefault,
    createdAt: nowSeconds(),
  };
  ctx.store.set(policyVersionKey(policyName, nextId), version);
  addToList(ctx, policyVersionsKey(policyName), nextId);
  if (setAsDefault) {
    const oldId = stored.defaultVersionId;
    const old = ctx.store.get<StoredPolicyVersion>(
      policyVersionKey(policyName, oldId),
    );
    if (old) {
      ctx.store.set(policyVersionKey(policyName, oldId), {
        ...old,
        isDefaultVersion: false,
      });
    }
    ctx.store.set(policyKey(policyName), {
      ...stored,
      defaultVersionId: nextId,
      policyDocument,
    });
  }
  return {
    policyArn: stored.policyArn,
    policyDocument,
    policyVersionId: nextId,
    isDefaultVersion: setAsDefault,
  };
};

const GetPolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyVersionId = requireStr(data, "policyVersionId");
  const stored = requirePolicy(ctx, policyName);
  const version = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyName, policyVersionId),
  );
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyVersion ${policyVersionId} not found.`,
      404,
    );
  }
  return {
    policyArn: stored.policyArn,
    policyName,
    policyDocument: version.policyDocument,
    policyVersionId,
    isDefaultVersion: version.isDefaultVersion,
    creationDate: version.createdAt,
    lastModifiedDate: version.createdAt,
  };
};

const ListPolicyVersions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  requirePolicy(ctx, policyName);
  const versions = getList<string>(ctx, policyVersionsKey(policyName));
  const policyVersions = versions.map((vId) => {
    const v = ctx.store.get<StoredPolicyVersion>(
      policyVersionKey(policyName, vId),
    )!;
    return {
      versionId: vId,
      isDefaultVersion: v.isDefaultVersion,
      createDate: v.createdAt,
    };
  });
  return { policyVersions };
};

const SetDefaultPolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyVersionId = requireStr(data, "policyVersionId");
  const stored = requirePolicy(ctx, policyName);
  const version = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyName, policyVersionId),
  );
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyVersion ${policyVersionId} not found.`,
      404,
    );
  }
  const oldId = stored.defaultVersionId;
  if (oldId !== policyVersionId) {
    const old = ctx.store.get<StoredPolicyVersion>(
      policyVersionKey(policyName, oldId),
    );
    if (old) {
      ctx.store.set(policyVersionKey(policyName, oldId), {
        ...old,
        isDefaultVersion: false,
      });
    }
    ctx.store.set(policyVersionKey(policyName, policyVersionId), {
      ...version,
      isDefaultVersion: true,
    });
    ctx.store.set(policyKey(policyName), {
      ...stored,
      defaultVersionId: policyVersionId,
      policyDocument: version.policyDocument,
    });
  }
  return {};
};

const DeletePolicyVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const policyVersionId = requireStr(data, "policyVersionId");
  const stored = requirePolicy(ctx, policyName);
  if (stored.defaultVersionId === policyVersionId) {
    throw awsError(
      "DeleteConflictException",
      `Cannot delete the default version of a policy.`,
      409,
    );
  }
  const version = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyName, policyVersionId),
  );
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `PolicyVersion ${policyVersionId} not found.`,
      404,
    );
  }
  ctx.store.set(policyVersionKey(policyName, policyVersionId), undefined);
  removeFromList<string>(
    ctx,
    policyVersionsKey(policyName),
    (v) => v === policyVersionId,
  );
  return {};
};

const AttachPrincipalPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const principal = requireStr(data, "principal");
  requirePolicy(ctx, policyName);
  const targets = getList<string>(ctx, policyAttachmentsKey(policyName));
  if (!targets.includes(principal)) {
    addToList(ctx, policyAttachmentsKey(policyName), principal);
  }
  const policies = getList<string>(ctx, principalPoliciesKey(principal));
  if (!policies.includes(policyName)) {
    addToList(ctx, principalPoliciesKey(principal), policyName);
  }
  return {};
};

const DetachPrincipalPolicy: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  const principal = requireStr(data, "principal");
  removeFromList<string>(
    ctx,
    policyAttachmentsKey(policyName),
    (t) => t === principal,
  );
  removeFromList<string>(
    ctx,
    principalPoliciesKey(principal),
    (p) => p === policyName,
  );
  return {};
};

const ListPrincipalPolicies: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const principal = requireStr(data, "principal");
  const marker = str(data["marker"]);
  const allPolicyNames = getList<string>(ctx, principalPoliciesKey(principal));
  const { items: names, nextMarker } = paginateList(allPolicyNames, marker);
  const policies = names
    .map((n) => ctx.store.get<StoredPolicy>(policyKey(n)))
    .filter(Boolean)
    .map((p) => ({
      policyName: p!.policyName,
      policyArn: p!.policyArn,
    }));
  return { policies, nextMarker };
};

const ListPolicyPrincipals: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const policyName = requireStr(data, "policyName");
  requirePolicy(ctx, policyName);
  const marker = str(data["marker"]);
  const allTargets = getList<string>(ctx, policyAttachmentsKey(policyName));
  const { items: principals, nextMarker } = paginateList(allTargets, marker);
  return { principals, nextMarker };
};

// === ThingPrincipal operations ===

const AttachThingPrincipal: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const principal = requireStr(data, "principal");
  requireThing(ctx, thingName);
  const principals = getList<string>(ctx, thingPrincipalsKey(thingName));
  if (!principals.includes(principal)) {
    addToList(ctx, thingPrincipalsKey(thingName), principal);
  }
  const things = getList<string>(ctx, principalThingsKey(principal));
  if (!things.includes(thingName)) {
    addToList(ctx, principalThingsKey(principal), thingName);
  }
  return {};
};

const DetachThingPrincipal: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const principal = requireStr(data, "principal");
  removeFromList<string>(
    ctx,
    thingPrincipalsKey(thingName),
    (p) => p === principal,
  );
  removeFromList<string>(
    ctx,
    principalThingsKey(principal),
    (t) => t === thingName,
  );
  return {};
};

const ListThingPrincipals: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  requireThing(ctx, thingName);
  const principals = getList<string>(ctx, thingPrincipalsKey(thingName));
  return { principals };
};

const ListPrincipalThings: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const principal = requireStr(data, "principal");
  const marker = str(data["nextToken"]);
  const allThingNames = getList<string>(ctx, principalThingsKey(principal));
  const { items: things, nextMarker } = paginateList(allThingNames, marker);
  return { things, nextToken: nextMarker };
};

// === TopicRule operations ===

const CreateTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  if (ctx.store.get(topicRuleKey(ruleName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `TopicRule ${ruleName} already exists.`,
      409,
    );
  }
  const arn = ruleArn(ctx, ruleName);
  const topicRulePayload = data["topicRulePayload"];
  if (!topicRulePayload) {
    throw awsError(
      "InvalidRequestException",
      "topicRulePayload is required.",
      400,
    );
  }
  const stored: StoredTopicRule = {
    ruleName,
    ruleArn: arn,
    topicRulePayload,
    enabled: true,
    createdAt: nowSeconds(),
  };
  ctx.store.set(topicRuleKey(ruleName), stored);
  addToList(ctx, allRulesKey, ruleName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {};
};

const GetTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  return {
    ruleArn: stored.ruleArn,
    rule: {
      ruleName: stored.ruleName,
      createdAt: stored.createdAt,
      ruleDisabled: !stored.enabled,
      ...(stored.topicRulePayload as object),
    },
  };
};

const ReplaceTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  const topicRulePayload = data["topicRulePayload"];
  if (!topicRulePayload) {
    throw awsError(
      "InvalidRequestException",
      "topicRulePayload is required.",
      400,
    );
  }
  ctx.store.set(topicRuleKey(ruleName), {
    ...stored,
    topicRulePayload,
  });
  return {};
};

const DeleteTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  ctx.store.set(tagsKey(stored.ruleArn), undefined);
  ctx.store.set(topicRuleKey(ruleName), undefined);
  removeFromList<string>(ctx, allRulesKey, (n) => n === ruleName);
  return {};
};

const ListTopicRules: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allRulesKey);
  const { items: names, nextMarker } = paginateList(allNames, nextToken);
  const rules = names
    .map((n) => ctx.store.get<StoredTopicRule>(topicRuleKey(n)))
    .filter(Boolean)
    .map((r) => ({
      ruleName: r!.ruleName,
      ruleArn: r!.ruleArn,
      topicPattern: (r!.topicRulePayload as Record<string, unknown>)?.["sql"],
      createdAt: r!.createdAt,
      ruleDisabled: !r!.enabled,
    }));
  return { rules, nextToken: nextMarker };
};

const EnableTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  ctx.store.set(topicRuleKey(ruleName), { ...stored, enabled: true });
  return {};
};

const DisableTopicRule: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const ruleName = requireStr(data, "ruleName");
  const stored = requireRule(ctx, ruleName);
  ctx.store.set(topicRuleKey(ruleName), { ...stored, enabled: false });
  return {};
};

// === Endpoint ===

const DescribeEndpoint: OperationHandler = (input, ctx) => {
  const id = `${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
  return {
    endpointAddress: `${id}.iot.${ctx.region}.amazonaws.com`,
  };
};

// === Tags ===

const TagResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireStr(data, "resourceArn");
  const newTags = (data["tags"] as { Key: string; Value?: string }[]) ?? [];
  const existing = getList<{ Key: string; Value?: string }>(
    ctx,
    tagsKey(resourceArn),
  );
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireStr(data, "resourceArn");
  const tagKeys = (data["tagKeys"] as string[]) ?? [];
  const existing = getList<{ Key: string; Value?: string }>(
    ctx,
    tagsKey(resourceArn),
  );
  ctx.store.set(
    tagsKey(resourceArn),
    existing.filter((t) => !tagKeys.includes(t.Key)),
  );
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const resourceArn = requireStr(data, "resourceArn");
  const tags = getList<{ Key: string; Value?: string }>(
    ctx,
    tagsKey(resourceArn),
  );
  return { tags };
};

// === Job / JobExecution / JobTemplate / Command operations ===

const requireJob = (ctx: ServiceContext, id: string): StoredJob => {
  const stored = ctx.store.get<StoredJob>(jobKey(id));
  if (!stored)
    throw awsError("ResourceNotFoundException", `Job ${id} not found.`, 404);
  return stored;
};

const requireJobExecution = (
  ctx: ServiceContext,
  jobId: string,
  thingName: string,
): StoredJobExecution => {
  const stored = ctx.store.get<StoredJobExecution>(
    jobExecutionKey(jobId, thingName),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Job execution for job ${jobId} on thing ${thingName} not found.`,
      404,
    );
  return stored;
};

const requireJobTemplate = (
  ctx: ServiceContext,
  id: string,
): StoredJobTemplate => {
  const stored = ctx.store.get<StoredJobTemplate>(jobTemplateKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Job template ${id} not found.`,
      404,
    );
  return stored;
};

const requireCommand = (ctx: ServiceContext, id: string): StoredCommand => {
  const stored = ctx.store.get<StoredCommand>(commandKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Command ${id} not found.`,
      404,
    );
  return stored;
};

const requireCommandExecution = (
  ctx: ServiceContext,
  id: string,
): StoredCommandExecution => {
  const stored = ctx.store.get<StoredCommandExecution>(commandExecutionKey(id));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Command execution ${id} not found.`,
      404,
    );
  return stored;
};

const managedJobTemplates = [
  {
    templateName: "AWS-Download-And-Run-OTA-Update",
    templateArn:
      "arn:aws:iot:::managed-job-template/AWS-Download-And-Run-OTA-Update",
    description: "Downloads and runs an OTA update on the device",
    documentVersion: "1.0",
  },
  {
    templateName: "AWS-Reboot",
    templateArn: "arn:aws:iot:::managed-job-template/AWS-Reboot",
    description: "Reboots the device",
    documentVersion: "1.0",
  },
] as const;

const CreateJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  if (ctx.store.get(jobKey(jobId)) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Job ${jobId} already exists.`,
      409,
    );
  const targets = data["targets"] as string[] | undefined;
  if (!targets || targets.length === 0)
    throw awsError("InvalidRequestException", "targets is required.", 400);
  const arn = jobArn(ctx, jobId);
  const now = nowSeconds();
  const stored: StoredJob = {
    jobId,
    jobArn: arn,
    targets,
    status: "IN_PROGRESS",
    description: str(data["description"]),
    document: str(data["document"]),
    documentSource: str(data["documentSource"]),
    targetSelection: str(data["targetSelection"]),
    createdAt: now,
    lastUpdatedAt: now,
  };
  ctx.store.set(jobKey(jobId), stored);
  addToList(ctx, allJobsKey, jobId);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  for (const target of targets) {
    const thingName = target.includes(":")
      ? (target.split("/").pop() ?? target)
      : target;
    const exec: StoredJobExecution = {
      jobId,
      thingName,
      executionNumber: 1,
      status: "QUEUED",
      queuedAt: now,
      lastUpdatedAt: now,
      versionNumber: 1,
    };
    ctx.store.set(jobExecutionKey(jobId, thingName), exec);
    addToList(ctx, jobExecutionsForJobKey(jobId), thingName);
    addToList(ctx, jobExecutionsForThingKey(thingName), jobId);
  }
  return { jobId, jobArn: arn, description: stored.description };
};

const AssociateTargetsWithJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const stored = requireJob(ctx, jobId);
  const newTargets = data["targets"] as string[] | undefined;
  if (!newTargets || newTargets.length === 0)
    throw awsError("InvalidRequestException", "targets is required.", 400);
  const now = nowSeconds();
  const existing = new Set(stored.targets);
  for (const target of newTargets) {
    if (!existing.has(target)) {
      stored.targets.push(target);
      const thingName = target.includes(":")
        ? (target.split("/").pop() ?? target)
        : target;
      const exec: StoredJobExecution = {
        jobId,
        thingName,
        executionNumber: 1,
        status: "QUEUED",
        queuedAt: now,
        lastUpdatedAt: now,
        versionNumber: 1,
      };
      ctx.store.set(jobExecutionKey(jobId, thingName), exec);
      addToList(ctx, jobExecutionsForJobKey(jobId), thingName);
      addToList(ctx, jobExecutionsForThingKey(thingName), jobId);
    }
  }
  stored.lastUpdatedAt = now;
  ctx.store.set(jobKey(jobId), stored);
  return { jobArn: stored.jobArn, jobId, description: stored.description };
};

const CancelJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const stored = requireJob(ctx, jobId);
  stored.status = "CANCELLATION_IN_PROGRESS";
  stored.lastUpdatedAt = nowSeconds();
  ctx.store.set(jobKey(jobId), stored);
  return { jobId, jobArn: stored.jobArn, description: stored.description };
};

const DeleteJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  requireJob(ctx, jobId);
  ctx.store.set(jobKey(jobId), undefined);
  removeFromList<string>(ctx, allJobsKey, (id) => id === jobId);
  return {};
};

const DescribeJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const stored = requireJob(ctx, jobId);
  return {
    documentSource: stored.documentSource,
    job: {
      jobId: stored.jobId,
      jobArn: stored.jobArn,
      targets: stored.targets,
      status: stored.status,
      description: stored.description,
      targetSelection: stored.targetSelection,
      createdAt: stored.createdAt,
      lastUpdatedAt: stored.lastUpdatedAt,
      completedAt: stored.completedAt,
    },
  };
};

const UpdateJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const stored = requireJob(ctx, jobId);
  if (data["description"] !== undefined)
    stored.description = str(data["description"]);
  stored.lastUpdatedAt = nowSeconds();
  ctx.store.set(jobKey(jobId), stored);
  return {};
};

const ListJobs: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const statusFilter = str(data["status"]);
  const nextToken = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allJobsKey);
  let jobs = allIds
    .map((id) => ctx.store.get<StoredJob>(jobKey(id)))
    .filter((j): j is StoredJob => j !== undefined);
  if (statusFilter) jobs = jobs.filter((j) => j.status === statusFilter);
  const { items, nextMarker } = paginateList(jobs, nextToken);
  return {
    jobs: items.map((j) => ({
      jobId: j.jobId,
      jobArn: j.jobArn,
      status: j.status,
      targetSelection: j.targetSelection,
      createdAt: j.createdAt,
      lastUpdatedAt: j.lastUpdatedAt,
      completedAt: j.completedAt,
    })),
    nextToken: nextMarker,
  };
};

const GetJobDocument: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const stored = requireJob(ctx, jobId);
  return { document: stored.document ?? "" };
};

const DescribeJobExecution: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const thingName = requireStr(data, "thingName");
  const exec = requireJobExecution(ctx, jobId, thingName);
  return {
    execution: {
      jobId: exec.jobId,
      thingArn: thingArn(ctx, exec.thingName),
      status: exec.status,
      executionNumber: exec.executionNumber,
      queuedAt: exec.queuedAt,
      lastUpdatedAt: exec.lastUpdatedAt,
      versionNumber: exec.versionNumber,
    },
  };
};

const CancelJobExecution: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const thingName = requireStr(data, "thingName");
  const exec = requireJobExecution(ctx, jobId, thingName);
  exec.status = "CANCELLATION_IN_PROGRESS";
  exec.lastUpdatedAt = nowSeconds();
  ctx.store.set(jobExecutionKey(jobId, thingName), exec);
  return {};
};

const DeleteJobExecution: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  const thingName = requireStr(data, "thingName");
  requireJobExecution(ctx, jobId, thingName);
  ctx.store.set(jobExecutionKey(jobId, thingName), undefined);
  removeFromList<string>(
    ctx,
    jobExecutionsForJobKey(jobId),
    (n) => n === thingName,
  );
  removeFromList<string>(
    ctx,
    jobExecutionsForThingKey(thingName),
    (id) => id === jobId,
  );
  return {};
};

const ListJobExecutionsForJob: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobId = requireStr(data, "jobId");
  requireJob(ctx, jobId);
  const thingNames = getList<string>(ctx, jobExecutionsForJobKey(jobId));
  const execs = thingNames
    .map((n) => ctx.store.get<StoredJobExecution>(jobExecutionKey(jobId, n)))
    .filter((e): e is StoredJobExecution => e !== undefined);
  const nextToken = str(data["nextToken"]);
  const { items, nextMarker } = paginateList(execs, nextToken);
  return {
    executionSummaries: items.map((e) => ({
      thingArn: thingArn(ctx, e.thingName),
      jobExecutionSummary: {
        status: e.status,
        executionNumber: e.executionNumber,
        queuedAt: e.queuedAt,
        lastUpdatedAt: e.lastUpdatedAt,
      },
    })),
    nextToken: nextMarker,
  };
};

const ListJobExecutionsForThing: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const thingName = requireStr(data, "thingName");
  const jobIds = getList<string>(ctx, jobExecutionsForThingKey(thingName));
  const execs = jobIds
    .map((id) =>
      ctx.store.get<StoredJobExecution>(jobExecutionKey(id, thingName)),
    )
    .filter((e): e is StoredJobExecution => e !== undefined);
  const nextToken = str(data["nextToken"]);
  const { items, nextMarker } = paginateList(execs, nextToken);
  return {
    executionSummaries: items.map((e) => ({
      jobId: e.jobId,
      jobExecutionSummary: {
        status: e.status,
        executionNumber: e.executionNumber,
        queuedAt: e.queuedAt,
        lastUpdatedAt: e.lastUpdatedAt,
      },
    })),
    nextToken: nextMarker,
  };
};

const CreateJobTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobTemplateId = requireStr(data, "jobTemplateId");
  if (ctx.store.get(jobTemplateKey(jobTemplateId)) !== undefined)
    throw awsError(
      "ConflictException",
      `Job template ${jobTemplateId} already exists.`,
      409,
    );
  const description = requireStr(data, "description");
  const arn = jobTemplateArn(ctx, jobTemplateId);
  const stored: StoredJobTemplate = {
    jobTemplateId,
    jobTemplateArn: arn,
    description,
    document: str(data["document"]),
    documentSource: str(data["documentSource"]),
    createdAt: nowSeconds(),
  };
  ctx.store.set(jobTemplateKey(jobTemplateId), stored);
  addToList(ctx, allJobTemplatesKey, jobTemplateId);
  return { jobTemplateArn: arn, jobTemplateId };
};

const DeleteJobTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobTemplateId = requireStr(data, "jobTemplateId");
  requireJobTemplate(ctx, jobTemplateId);
  ctx.store.set(jobTemplateKey(jobTemplateId), undefined);
  removeFromList<string>(ctx, allJobTemplatesKey, (id) => id === jobTemplateId);
  return {};
};

const DescribeJobTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const jobTemplateId = requireStr(data, "jobTemplateId");
  const stored = requireJobTemplate(ctx, jobTemplateId);
  return {
    jobTemplateId: stored.jobTemplateId,
    jobTemplateArn: stored.jobTemplateArn,
    description: stored.description,
    document: stored.document,
    documentSource: stored.documentSource,
    createdAt: stored.createdAt,
  };
};

const ListJobTemplates: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allJobTemplatesKey);
  const templates = allIds
    .map((id) => ctx.store.get<StoredJobTemplate>(jobTemplateKey(id)))
    .filter((t): t is StoredJobTemplate => t !== undefined);
  const { items, nextMarker } = paginateList(templates, nextToken);
  return {
    jobTemplates: items.map((t) => ({
      jobTemplateArn: t.jobTemplateArn,
      jobTemplateId: t.jobTemplateId,
      description: t.description,
      createdAt: t.createdAt,
    })),
    nextToken: nextMarker,
  };
};

const DescribeManagedJobTemplate: OperationHandler = (input) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  const template = managedJobTemplates.find(
    (t) => t.templateName === templateName,
  );
  if (!template)
    throw awsError(
      "ResourceNotFoundException",
      `Managed job template ${templateName} not found.`,
      404,
    );
  return {
    templateName: template.templateName,
    templateArn: template.templateArn,
    description: template.description,
    documentVersion: template.documentVersion,
    document: "{}",
    environments: [],
    templateVersion: template.documentVersion,
  };
};

const ListManagedJobTemplates: OperationHandler = () => {
  return {
    managedJobTemplates: managedJobTemplates.map((t) => ({
      templateName: t.templateName,
      templateArn: t.templateArn,
      description: t.description,
      environments: [],
      templateVersion: t.documentVersion,
    })),
  };
};

const CreateCommand: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const commandId = requireStr(data, "commandId");
  if (ctx.store.get(commandKey(commandId)) !== undefined)
    throw awsError(
      "ConflictException",
      `Command ${commandId} already exists.`,
      409,
    );
  const arn = commandArn(ctx, commandId);
  const now = nowSeconds();
  const stored: StoredCommand = {
    commandId,
    commandArn: arn,
    namespace: str(data["namespace"]),
    displayName: str(data["displayName"]),
    description: str(data["description"]),
    payload: data["payload"],
    payloadTemplate: str(data["payloadTemplate"]),
    mandatoryParameters: data["mandatoryParameters"] as unknown[] | undefined,
    roleArn: str(data["roleArn"]),
    deprecated: false,
    pendingDeletion: false,
    createdAt: now,
    lastUpdatedAt: now,
  };
  ctx.store.set(commandKey(commandId), stored);
  addToList(ctx, allCommandsKey, commandId);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { commandId, commandArn: arn };
};

const DeleteCommand: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const commandId = requireStr(data, "commandId");
  requireCommand(ctx, commandId);
  ctx.store.set(commandKey(commandId), undefined);
  removeFromList<string>(ctx, allCommandsKey, (id) => id === commandId);
  return {};
};

const GetCommand: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const commandId = requireStr(data, "commandId");
  const stored = requireCommand(ctx, commandId);
  return {
    commandId: stored.commandId,
    commandArn: stored.commandArn,
    namespace: stored.namespace,
    displayName: stored.displayName,
    description: stored.description,
    payload: stored.payload,
    mandatoryParameters: stored.mandatoryParameters,
    roleArn: stored.roleArn,
    deprecated: stored.deprecated,
    pendingDeletion: stored.pendingDeletion,
    createdAt: stored.createdAt,
    lastUpdatedAt: stored.lastUpdatedAt,
  };
};

const UpdateCommand: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const commandId = requireStr(data, "commandId");
  const stored = requireCommand(ctx, commandId);
  if (data["displayName"] !== undefined)
    stored.displayName = str(data["displayName"]);
  if (data["description"] !== undefined)
    stored.description = str(data["description"]);
  if (data["deprecated"] !== undefined)
    stored.deprecated = Boolean(data["deprecated"]);
  stored.lastUpdatedAt = nowSeconds();
  ctx.store.set(commandKey(commandId), stored);
  return { commandId: stored.commandId, commandArn: stored.commandArn };
};

const ListCommands: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allCommandsKey);
  const commands = allIds
    .map((id) => ctx.store.get<StoredCommand>(commandKey(id)))
    .filter((c): c is StoredCommand => c !== undefined);
  const { items, nextMarker } = paginateList(commands, nextToken);
  return {
    commands: items.map((c) => ({
      commandId: c.commandId,
      commandArn: c.commandArn,
      namespace: c.namespace,
      displayName: c.displayName,
      deprecated: c.deprecated,
      createdAt: c.createdAt,
      lastUpdatedAt: c.lastUpdatedAt,
    })),
    nextToken: nextMarker,
  };
};

const GetCommandExecution: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const executionId = requireStr(data, "executionId");
  const stored = requireCommandExecution(ctx, executionId);
  return {
    executionId: stored.executionId,
    commandArn: stored.commandArn,
    targetArn: stored.targetArn,
    status: stored.status,
    createdAt: stored.createdAt,
    lastUpdatedAt: stored.lastUpdatedAt,
    completedAt: stored.completedAt,
  };
};

const DeleteCommandExecution: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const executionId = requireStr(data, "executionId");
  requireCommandExecution(ctx, executionId);
  ctx.store.set(commandExecutionKey(executionId), undefined);
  removeFromList<string>(
    ctx,
    allCommandExecutionsKey,
    (id) => id === executionId,
  );
  return {};
};

const ListCommandExecutions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const commandArnFilter = str(data["commandArn"]);
  const targetArnFilter = str(data["targetArn"]);
  const allIds = getList<string>(ctx, allCommandExecutionsKey);
  let execs = allIds
    .map((id) => ctx.store.get<StoredCommandExecution>(commandExecutionKey(id)))
    .filter((e): e is StoredCommandExecution => e !== undefined);
  if (commandArnFilter)
    execs = execs.filter((e) => e.commandArn === commandArnFilter);
  if (targetArnFilter)
    execs = execs.filter((e) => e.targetArn === targetArnFilter);
  const { items, nextMarker } = paginateList(execs, nextToken);
  return {
    commandExecutions: items.map((e) => ({
      executionId: e.executionId,
      commandArn: e.commandArn,
      targetArn: e.targetArn,
      status: e.status,
      createdAt: e.createdAt,
      lastUpdatedAt: e.lastUpdatedAt,
    })),
    nextToken: nextMarker,
  };
};

// === Certificate transfer / CA / registration operations ===

const CreateCertificateFromCsr: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  requireStr(data, "certificateSigningRequest");
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = certArn(ctx, id);
  const status =
    data["setAsActive"] === true || data["setAsActive"] === "true"
      ? "ACTIVE"
      : "INACTIVE";
  const stored: StoredCertificate = {
    certificateId: id,
    certificateArn: arn,
    certificatePem: pemOf(id),
    publicKey: publicKeyOf(id),
    privateKey: privateKeyOf(id),
    status,
    createdAt: nowSeconds(),
  };
  ctx.store.set(certKey(id), stored);
  addToList(ctx, allCertsKey, id);
  return {
    certificateArn: arn,
    certificateId: id,
    certificatePem: stored.certificatePem,
  };
};

const AcceptCertificateTransfer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const stored = requireCert(ctx, certificateId);
  if (stored.status !== "PENDING_TRANSFER") {
    throw awsError(
      "TransferAlreadyCompletedException",
      `Certificate ${certificateId} transfer already completed.`,
      410,
    );
  }
  const newStatus =
    data["setAsActive"] === true || data["setAsActive"] === "true"
      ? "ACTIVE"
      : "INACTIVE";
  ctx.store.set(certKey(certificateId), { ...stored, status: newStatus });
  return {};
};

const CancelCertificateTransfer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const stored = requireCert(ctx, certificateId);
  if (stored.status !== "PENDING_TRANSFER") {
    throw awsError(
      "TransferAlreadyCompletedException",
      `Certificate ${certificateId} transfer already completed.`,
      410,
    );
  }
  ctx.store.set(certKey(certificateId), { ...stored, status: "INACTIVE" });
  return {};
};

const TransferCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const stored = requireCert(ctx, certificateId);
  if (stored.status !== "ACTIVE" && stored.status !== "INACTIVE") {
    throw awsError(
      "CertificateStateException",
      `Certificate ${certificateId} cannot be transferred.`,
      406,
    );
  }
  ctx.store.set(certKey(certificateId), {
    ...stored,
    status: "PENDING_TRANSFER",
  });
  return { transferredCertificateArn: stored.certificateArn };
};

const RejectCertificateTransfer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "certificateId");
  const stored = requireCert(ctx, certificateId);
  if (stored.status !== "PENDING_TRANSFER") {
    throw awsError(
      "TransferAlreadyCompletedException",
      `Certificate ${certificateId} transfer already completed.`,
      410,
    );
  }
  ctx.store.set(certKey(certificateId), { ...stored, status: "INACTIVE" });
  return {};
};

const RegisterCertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  requireStr(data, "certificatePem");
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = certArn(ctx, id);
  const status = str(data["status"]) ?? "INACTIVE";
  const stored: StoredCertificate = {
    certificateId: id,
    certificateArn: arn,
    certificatePem: str(data["certificatePem"]) ?? pemOf(id),
    publicKey: publicKeyOf(id),
    privateKey: privateKeyOf(id),
    status,
    createdAt: nowSeconds(),
  };
  ctx.store.set(certKey(id), stored);
  addToList(ctx, allCertsKey, id);
  return { certificateArn: arn, certificateId: id };
};

const RegisterCertificateWithoutCA: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  requireStr(data, "certificatePem");
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = certArn(ctx, id);
  const status = str(data["status"]) ?? "ACTIVE";
  const stored: StoredCertificate = {
    certificateId: id,
    certificateArn: arn,
    certificatePem: str(data["certificatePem"]) ?? pemOf(id),
    publicKey: publicKeyOf(id),
    privateKey: privateKeyOf(id),
    status,
    createdAt: nowSeconds(),
  };
  ctx.store.set(certKey(id), stored);
  addToList(ctx, allCertsKey, id);
  return { certificateArn: arn, certificateId: id };
};

const ListCertificatesByCA: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const caCertificateId = requireStr(data, "caCertificateId");
  requireCACert(ctx, caCertificateId);
  const marker = str(data["marker"]);
  const allIds = getList<string>(ctx, allCertsKey);
  const { items: ids, nextMarker } = paginateList(allIds, marker);
  const certificates = ids
    .map((id) => ctx.store.get<StoredCertificate>(certKey(id)))
    .filter(Boolean)
    .map((c) => ({
      certificateArn: c!.certificateArn,
      certificateId: c!.certificateId,
      status: c!.status,
      creationDate: c!.createdAt,
    }));
  return { certificates, nextMarker };
};

const ListOutgoingCertificates: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allIds = getList<string>(ctx, allCertsKey);
  const allCerts = allIds
    .map((id) => ctx.store.get<StoredCertificate>(certKey(id)))
    .filter((c): c is StoredCertificate => c !== undefined)
    .filter((c) => c.status === "PENDING_TRANSFER");
  const { items, nextMarker } = paginateList(allCerts, marker);
  return {
    outgoingCertificates: items.map((c) => ({
      certificateArn: c.certificateArn,
      certificateId: c.certificateId,
      creationDate: c.createdAt,
    })),
    nextMarker,
  };
};

// === CA Certificate operations ===

const RegisterCACertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  requireStr(data, "caCertificate");
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = caCertArn(ctx, id);
  const status =
    data["setAsActive"] === true || data["setAsActive"] === "true"
      ? "ACTIVE"
      : "INACTIVE";
  const stored: StoredCACertificate = {
    certificateId: id,
    certificateArn: arn,
    certificatePem: str(data["caCertificate"]) ?? pemOf(id),
    status,
    autoRegistrationStatus:
      data["allowAutoRegistration"] === true ||
      data["allowAutoRegistration"] === "true"
        ? "ENABLE"
        : "DISABLE",
    createdAt: nowSeconds(),
  };
  ctx.store.set(caCertKey(id), stored);
  addToList(ctx, allCACertsKey, id);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { certificateArn: arn, certificateId: id };
};

const DescribeCACertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "caCertificateId");
  const stored = requireCACert(ctx, certificateId);
  return {
    certificateDescription: {
      certificateArn: stored.certificateArn,
      certificateId: stored.certificateId,
      status: stored.status,
      certificatePem: stored.certificatePem,
      autoRegistrationStatus: stored.autoRegistrationStatus,
      creationDate: stored.createdAt,
      lastModifiedDate: stored.createdAt,
    },
    registrationConfig: {},
  };
};

const UpdateCACertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "caCertificateId");
  const stored = requireCACert(ctx, certificateId);
  const newStatus = str(data["newStatus"]) ?? stored.status;
  const newAutoReg =
    str(data["newAutoRegistrationStatus"]) ?? stored.autoRegistrationStatus;
  ctx.store.set(caCertKey(certificateId), {
    ...stored,
    status: newStatus,
    autoRegistrationStatus: newAutoReg,
  });
  return {};
};

const DeleteCACertificate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateId = requireStr(data, "caCertificateId");
  requireCACert(ctx, certificateId);
  ctx.store.set(caCertKey(certificateId), undefined);
  removeFromList<string>(ctx, allCACertsKey, (id) => id === certificateId);
  return {};
};

const ListCACertificates: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allIds = getList<string>(ctx, allCACertsKey);
  const { items: ids, nextMarker } = paginateList(allIds, marker);
  const certificates = ids
    .map((id) => ctx.store.get<StoredCACertificate>(caCertKey(id)))
    .filter(Boolean)
    .map((c) => ({
      certificateArn: c!.certificateArn,
      certificateId: c!.certificateId,
      status: c!.status,
      creationDate: c!.createdAt,
    }));
  return { certificates, nextMarker };
};

const GetRegistrationCode: OperationHandler = (_input, ctx) => {
  let code = ctx.store.get<string>(registrationCodeKey);
  if (!code) {
    code = crypto.randomUUID().replace(/-/g, "");
    ctx.store.set(registrationCodeKey, code);
  }
  return { registrationCode: code };
};

const DeleteRegistrationCode: OperationHandler = (_input, ctx) => {
  const code = ctx.store.get<string>(registrationCodeKey);
  if (!code)
    throw awsError(
      "ResourceNotFoundException",
      "Registration code not found.",
      404,
    );
  ctx.store.set(registrationCodeKey, undefined);
  return {};
};

// === Certificate provider operations ===

const CreateCertificateProvider: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateProviderName = requireStr(data, "certificateProviderName");
  if (ctx.store.get(certProviderKey(certificateProviderName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Certificate provider ${certificateProviderName} already exists.`,
      409,
    );
  }
  const lambdaFunctionArn = requireStr(data, "lambdaFunctionArn");
  const accountDefaultForOperations =
    (data["accountDefaultForOperations"] as string[]) ?? [];
  const arn = certProviderArn(ctx, certificateProviderName);
  const stored: StoredCertificateProvider = {
    certificateProviderName,
    certificateProviderArn: arn,
    lambdaFunctionArn,
    accountDefaultForOperations,
    createdAt: nowSeconds(),
    lastModifiedAt: nowSeconds(),
  };
  ctx.store.set(certProviderKey(certificateProviderName), stored);
  addToList(ctx, allCertProvidersKey, certificateProviderName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { certificateProviderName, certificateProviderArn: arn };
};

const DescribeCertificateProvider: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateProviderName = requireStr(data, "certificateProviderName");
  const stored = requireCertProvider(ctx, certificateProviderName);
  return {
    certificateProviderName: stored.certificateProviderName,
    certificateProviderArn: stored.certificateProviderArn,
    lambdaFunctionArn: stored.lambdaFunctionArn,
    accountDefaultForOperations: stored.accountDefaultForOperations,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedAt,
  };
};

const UpdateCertificateProvider: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateProviderName = requireStr(data, "certificateProviderName");
  const stored = requireCertProvider(ctx, certificateProviderName);
  const lambdaFunctionArn =
    str(data["lambdaFunctionArn"]) ?? stored.lambdaFunctionArn;
  const accountDefaultForOperations =
    (data["accountDefaultForOperations"] as string[] | undefined) ??
    stored.accountDefaultForOperations;
  ctx.store.set(certProviderKey(certificateProviderName), {
    ...stored,
    lambdaFunctionArn,
    accountDefaultForOperations,
    lastModifiedAt: nowSeconds(),
  });
  return {
    certificateProviderName,
    certificateProviderArn: stored.certificateProviderArn,
  };
};

const DeleteCertificateProvider: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const certificateProviderName = requireStr(data, "certificateProviderName");
  requireCertProvider(ctx, certificateProviderName);
  ctx.store.set(certProviderKey(certificateProviderName), undefined);
  removeFromList<string>(
    ctx,
    allCertProvidersKey,
    (n) => n === certificateProviderName,
  );
  return {};
};

const ListCertificateProviders: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allCertProvidersKey);
  const { items: names, nextMarker } = paginateList(allNames, nextToken);
  const certificateProviders = names
    .map((n) => ctx.store.get<StoredCertificateProvider>(certProviderKey(n)))
    .filter(Boolean)
    .map((p) => ({
      certificateProviderName: p!.certificateProviderName,
      certificateProviderArn: p!.certificateProviderArn,
    }));
  return { certificateProviders, nextToken: nextMarker };
};

// === Provisioning template operations ===

const CreateProvisioningTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  if (ctx.store.get(provisioningTemplateKey(templateName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Provisioning template ${templateName} already exists.`,
      409,
    );
  }
  const templateBody = requireStr(data, "templateBody");
  const provisioningRoleArn = requireStr(data, "provisioningRoleArn");
  const arn = provisioningTemplateArn(ctx, templateName);
  const now = nowSeconds();
  const stored: StoredProvisioningTemplate = {
    templateName,
    templateArn: arn,
    description: str(data["description"]),
    templateBody,
    enabled: data["enabled"] !== false,
    provisioningRoleArn,
    defaultVersionId: 1,
    createdAt: now,
    lastModifiedDate: now,
    type: str(data["type"]) ?? "FLEET_PROVISIONING",
  };
  ctx.store.set(provisioningTemplateKey(templateName), stored);
  addToList(ctx, allProvisioningTemplatesKey, templateName);
  const v1: StoredProvisioningTemplateVersion = {
    versionId: 1,
    templateBody,
    isDefaultVersion: true,
    createdAt: now,
  };
  ctx.store.set(provisioningTemplateVersionKey(templateName, 1), v1);
  ctx.store.set(provisioningTemplateVersionsKey(templateName), [1]);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { templateArn: arn, templateName, defaultVersionId: 1 };
};

const DescribeProvisioningTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  const stored = requireProvisioningTemplate(ctx, templateName);
  return {
    templateArn: stored.templateArn,
    templateName: stored.templateName,
    description: stored.description,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
    defaultVersionId: stored.defaultVersionId,
    templateBody: stored.templateBody,
    enabled: stored.enabled,
    provisioningRoleArn: stored.provisioningRoleArn,
    type: stored.type,
  };
};

const UpdateProvisioningTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  const stored = requireProvisioningTemplate(ctx, templateName);
  ctx.store.set(provisioningTemplateKey(templateName), {
    ...stored,
    description:
      data["description"] !== undefined
        ? str(data["description"])
        : stored.description,
    enabled:
      data["enabled"] !== undefined
        ? data["enabled"] !== false
        : stored.enabled,
    provisioningRoleArn:
      str(data["provisioningRoleArn"]) ?? stored.provisioningRoleArn,
    defaultVersionId:
      typeof data["defaultVersionId"] === "number"
        ? data["defaultVersionId"]
        : stored.defaultVersionId,
    lastModifiedDate: nowSeconds(),
  });
  return {};
};

const DeleteProvisioningTemplate: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  requireProvisioningTemplate(ctx, templateName);
  ctx.store.set(provisioningTemplateKey(templateName), undefined);
  ctx.store.set(provisioningTemplateVersionsKey(templateName), undefined);
  removeFromList<string>(
    ctx,
    allProvisioningTemplatesKey,
    (n) => n === templateName,
  );
  return {};
};

const ListProvisioningTemplates: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const nextToken = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allProvisioningTemplatesKey);
  const { items: names, nextMarker } = paginateList(allNames, nextToken);
  const templates = names
    .map((n) =>
      ctx.store.get<StoredProvisioningTemplate>(provisioningTemplateKey(n)),
    )
    .filter(Boolean)
    .map((t) => ({
      templateArn: t!.templateArn,
      templateName: t!.templateName,
      description: t!.description,
      creationDate: t!.createdAt,
      lastModifiedDate: t!.lastModifiedDate,
      enabled: t!.enabled,
      type: t!.type,
    }));
  return { templates, nextToken: nextMarker };
};

const CreateProvisioningTemplateVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  const stored = requireProvisioningTemplate(ctx, templateName);
  const templateBody = requireStr(data, "templateBody");
  const setAsDefault = data["setAsDefault"] === true;
  const existingVersionIds = getList<number>(
    ctx,
    provisioningTemplateVersionsKey(templateName),
  );
  const newVersionId = Math.max(0, ...existingVersionIds) + 1;
  const v: StoredProvisioningTemplateVersion = {
    versionId: newVersionId,
    templateBody,
    isDefaultVersion: setAsDefault,
    createdAt: nowSeconds(),
  };
  ctx.store.set(provisioningTemplateVersionKey(templateName, newVersionId), v);
  addToList(ctx, provisioningTemplateVersionsKey(templateName), newVersionId);
  if (setAsDefault) {
    ctx.store.set(provisioningTemplateKey(templateName), {
      ...stored,
      defaultVersionId: newVersionId,
      templateBody,
      lastModifiedDate: nowSeconds(),
    });
  }
  return {
    templateArn: stored.templateArn,
    templateName,
    versionId: newVersionId,
  };
};

const DescribeProvisioningTemplateVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  requireProvisioningTemplate(ctx, templateName);
  const versionId = Number(data["versionId"]);
  const v = ctx.store.get<StoredProvisioningTemplateVersion>(
    provisioningTemplateVersionKey(templateName, versionId),
  );
  if (!v)
    throw awsError(
      "ResourceNotFoundException",
      `Version ${versionId} not found.`,
      404,
    );
  return {
    versionId: v.versionId,
    creationDate: v.createdAt,
    templateBody: v.templateBody,
    isDefaultVersion: v.isDefaultVersion,
  };
};

const DeleteProvisioningTemplateVersion: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  const stored = requireProvisioningTemplate(ctx, templateName);
  const versionId = Number(data["versionId"]);
  if (stored.defaultVersionId === versionId) {
    throw awsError(
      "InvalidRequestException",
      `Cannot delete the default version.`,
      400,
    );
  }
  const v = ctx.store.get<StoredProvisioningTemplateVersion>(
    provisioningTemplateVersionKey(templateName, versionId),
  );
  if (!v)
    throw awsError(
      "ResourceNotFoundException",
      `Version ${versionId} not found.`,
      404,
    );
  ctx.store.set(
    provisioningTemplateVersionKey(templateName, versionId),
    undefined,
  );
  removeFromList<number>(
    ctx,
    provisioningTemplateVersionsKey(templateName),
    (id) => id === versionId,
  );
  return {};
};

const ListProvisioningTemplateVersions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  requireProvisioningTemplate(ctx, templateName);
  const nextToken = str(data["nextToken"]);
  const allVersionIds = getList<number>(
    ctx,
    provisioningTemplateVersionsKey(templateName),
  );
  const { items: versionIds, nextMarker } = paginateList(
    allVersionIds,
    nextToken,
  );
  const versions = versionIds
    .map((id) =>
      ctx.store.get<StoredProvisioningTemplateVersion>(
        provisioningTemplateVersionKey(templateName, id),
      ),
    )
    .filter(Boolean)
    .map((v) => ({
      versionId: v!.versionId,
      creationDate: v!.createdAt,
      isDefaultVersion: v!.isDefaultVersion,
    }));
  return { versions, nextToken: nextMarker };
};

const CreateProvisioningClaim: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const templateName = requireStr(data, "templateName");
  requireProvisioningTemplate(ctx, templateName);
  const id = crypto.randomUUID().replace(/-/g, "");
  return {
    certificateId: id,
    certificatePem: pemOf(id),
    keyPair: {
      PublicKey: publicKeyOf(id),
      PrivateKey: privateKeyOf(id),
    },
    expiration: nowSeconds() + 300,
  };
};

// === Role alias operations ===

const CreateRoleAlias: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const roleAlias = requireStr(data, "roleAlias");
  if (ctx.store.get(roleAliasKey(roleAlias)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Role alias ${roleAlias} already exists.`,
      409,
    );
  }
  const roleArn = requireStr(data, "roleArn");
  const arn = roleAliasArn(ctx, roleAlias);
  const now = nowSeconds();
  const stored: StoredRoleAlias = {
    roleAlias,
    roleAliasArn: arn,
    roleArn,
    credentialDurationSeconds:
      typeof data["credentialDurationSeconds"] === "number"
        ? data["credentialDurationSeconds"]
        : 3600,
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(roleAliasKey(roleAlias), stored);
  addToList(ctx, allRoleAliasesKey, roleAlias);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { roleAlias, roleAliasArn: arn };
};

const DescribeRoleAlias: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const roleAlias = requireStr(data, "roleAlias");
  const stored = requireRoleAlias(ctx, roleAlias);
  return {
    roleAliasDescription: {
      roleAlias: stored.roleAlias,
      roleAliasArn: stored.roleAliasArn,
      roleArn: stored.roleArn,
      credentialDurationSeconds: stored.credentialDurationSeconds,
      creationDate: stored.createdAt,
      lastModifiedDate: stored.lastModifiedDate,
    },
  };
};

const UpdateRoleAlias: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const roleAlias = requireStr(data, "roleAlias");
  const stored = requireRoleAlias(ctx, roleAlias);
  ctx.store.set(roleAliasKey(roleAlias), {
    ...stored,
    roleArn: str(data["roleArn"]) ?? stored.roleArn,
    credentialDurationSeconds:
      typeof data["credentialDurationSeconds"] === "number"
        ? data["credentialDurationSeconds"]
        : stored.credentialDurationSeconds,
    lastModifiedDate: nowSeconds(),
  });
  return { roleAlias, roleAliasArn: stored.roleAliasArn };
};

const DeleteRoleAlias: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const roleAlias = requireStr(data, "roleAlias");
  requireRoleAlias(ctx, roleAlias);
  ctx.store.set(roleAliasKey(roleAlias), undefined);
  removeFromList<string>(ctx, allRoleAliasesKey, (a) => a === roleAlias);
  return {};
};

const ListRoleAliases: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const allAliases = getList<string>(ctx, allRoleAliasesKey);
  const { items: aliases, nextMarker } = paginateList(allAliases, marker);
  return { roleAliases: aliases, nextMarker };
};

// === Authorizer operations ===

const CreateAuthorizer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const authorizerName = requireStr(data, "authorizerName");
  if (ctx.store.get(authorizerKey(authorizerName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Authorizer ${authorizerName} already exists.`,
      409,
    );
  }
  const authorizerFunctionArn = requireStr(data, "authorizerFunctionArn");
  const arn = authorizerArn(ctx, authorizerName);
  const now = nowSeconds();
  const stored: StoredAuthorizer = {
    authorizerName,
    authorizerArn: arn,
    authorizerFunctionArn,
    tokenKeyName: str(data["tokenKeyName"]),
    tokenSigningPublicKeys:
      (data["tokenSigningPublicKeys"] as Record<string, string>) ?? undefined,
    status: str(data["status"]) ?? "ACTIVE",
    signingDisabled: data["signingDisabled"] === true,
    enableCachingForHttp: data["enableCachingForHttp"] === true,
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(authorizerKey(authorizerName), stored);
  addToList(ctx, allAuthorizersKey, authorizerName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { authorizerName, authorizerArn: arn };
};

const DescribeAuthorizer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const authorizerName = requireStr(data, "authorizerName");
  const stored = requireAuthorizer(ctx, authorizerName);
  return {
    authorizerDescription: {
      authorizerName: stored.authorizerName,
      authorizerArn: stored.authorizerArn,
      authorizerFunctionArn: stored.authorizerFunctionArn,
      tokenKeyName: stored.tokenKeyName,
      tokenSigningPublicKeys: stored.tokenSigningPublicKeys,
      status: stored.status,
      signingDisabled: stored.signingDisabled,
      enableCachingForHttp: stored.enableCachingForHttp,
      creationDate: stored.createdAt,
      lastModifiedDate: stored.lastModifiedDate,
    },
  };
};

const UpdateAuthorizer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const authorizerName = requireStr(data, "authorizerName");
  const stored = requireAuthorizer(ctx, authorizerName);
  ctx.store.set(authorizerKey(authorizerName), {
    ...stored,
    authorizerFunctionArn:
      str(data["authorizerFunctionArn"]) ?? stored.authorizerFunctionArn,
    tokenKeyName:
      data["tokenKeyName"] !== undefined
        ? str(data["tokenKeyName"])
        : stored.tokenKeyName,
    tokenSigningPublicKeys:
      (data["tokenSigningPublicKeys"] as Record<string, string> | undefined) ??
      stored.tokenSigningPublicKeys,
    status: str(data["status"]) ?? stored.status,
    enableCachingForHttp:
      data["enableCachingForHttp"] !== undefined
        ? data["enableCachingForHttp"] === true
        : stored.enableCachingForHttp,
    lastModifiedDate: nowSeconds(),
  });
  return { authorizerName, authorizerArn: stored.authorizerArn };
};

const DeleteAuthorizer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const authorizerName = requireStr(data, "authorizerName");
  requireAuthorizer(ctx, authorizerName);
  const defaultAuth = ctx.store.get<string>(defaultAuthorizerKey);
  if (defaultAuth === authorizerName) {
    throw awsError(
      "DeleteConflictException",
      `Cannot delete the default authorizer.`,
      409,
    );
  }
  ctx.store.set(authorizerKey(authorizerName), undefined);
  removeFromList<string>(ctx, allAuthorizersKey, (n) => n === authorizerName);
  return {};
};

const ListAuthorizers: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const statusFilter = str(data["status"]);
  const allNames = getList<string>(ctx, allAuthorizersKey);
  let authorizers = allNames
    .map((n) => ctx.store.get<StoredAuthorizer>(authorizerKey(n)))
    .filter((a): a is StoredAuthorizer => a !== undefined);
  if (statusFilter)
    authorizers = authorizers.filter((a) => a.status === statusFilter);
  const { items, nextMarker } = paginateList(authorizers, marker);
  return {
    authorizers: items.map((a) => ({
      authorizerName: a.authorizerName,
      authorizerArn: a.authorizerArn,
    })),
    nextMarker,
  };
};

const SetDefaultAuthorizer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const authorizerName = requireStr(data, "authorizerName");
  const stored = requireAuthorizer(ctx, authorizerName);
  ctx.store.set(defaultAuthorizerKey, authorizerName);
  return { authorizerName, authorizerArn: stored.authorizerArn };
};

const DescribeDefaultAuthorizer: OperationHandler = (_input, ctx) => {
  const name = ctx.store.get<string>(defaultAuthorizerKey);
  if (!name)
    throw awsError(
      "ResourceNotFoundException",
      "No default authorizer set.",
      404,
    );
  const stored = requireAuthorizer(ctx, name);
  return {
    authorizerDescription: {
      authorizerName: stored.authorizerName,
      authorizerArn: stored.authorizerArn,
      authorizerFunctionArn: stored.authorizerFunctionArn,
      tokenKeyName: stored.tokenKeyName,
      status: stored.status,
      creationDate: stored.createdAt,
      lastModifiedDate: stored.lastModifiedDate,
    },
  };
};

const ClearDefaultAuthorizer: OperationHandler = (_input, ctx) => {
  const name = ctx.store.get<string>(defaultAuthorizerKey);
  if (!name)
    throw awsError(
      "ResourceNotFoundException",
      "No default authorizer set.",
      404,
    );
  ctx.store.set(defaultAuthorizerKey, undefined);
  return {};
};

const TestInvokeAuthorizer: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const authorizerName = requireStr(data, "authorizerName");
  requireAuthorizer(ctx, authorizerName);
  return {
    isAuthenticated: true,
    principalId: "test-principal",
    policyDocuments: [
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: "iot:*", Resource: "*" }],
      }),
    ],
    refreshAfterInSeconds: 300,
    disconnectAfterInSeconds: 86400,
  };
};

// === Domain configuration operations ===

const CreateDomainConfiguration: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const domainConfigurationName = requireStr(data, "domainConfigurationName");
  if (ctx.store.get(domainConfigKey(domainConfigurationName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Domain configuration ${domainConfigurationName} already exists.`,
      409,
    );
  }
  const arn = domainConfigArn(ctx, domainConfigurationName);
  const now = nowSeconds();
  const stored: StoredDomainConfiguration = {
    domainConfigurationName,
    domainConfigurationArn: arn,
    domainName: str(data["domainName"]),
    serviceType: str(data["serviceType"]) ?? "DATA",
    domainConfigurationStatus: "ENABLED",
    domainType: str(data["domainName"]) ? "CUSTOMER_MANAGED" : "AWS_MANAGED",
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(domainConfigKey(domainConfigurationName), stored);
  addToList(ctx, allDomainConfigsKey, domainConfigurationName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { domainConfigurationName, domainConfigurationArn: arn };
};

const DescribeDomainConfiguration: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const domainConfigurationName = requireStr(data, "domainConfigurationName");
  const stored = requireDomainConfig(ctx, domainConfigurationName);
  return {
    domainConfigurationName: stored.domainConfigurationName,
    domainConfigurationArn: stored.domainConfigurationArn,
    domainName: stored.domainName,
    serviceType: stored.serviceType,
    domainConfigurationStatus: stored.domainConfigurationStatus,
    domainType: stored.domainType,
  };
};

const UpdateDomainConfiguration: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const domainConfigurationName = requireStr(data, "domainConfigurationName");
  const stored = requireDomainConfig(ctx, domainConfigurationName);
  ctx.store.set(domainConfigKey(domainConfigurationName), {
    ...stored,
    domainConfigurationStatus:
      str(data["domainConfigurationStatus"]) ??
      stored.domainConfigurationStatus,
    lastModifiedDate: nowSeconds(),
  });
  return {
    domainConfigurationName,
    domainConfigurationArn: stored.domainConfigurationArn,
  };
};

const DeleteDomainConfiguration: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const domainConfigurationName = requireStr(data, "domainConfigurationName");
  requireDomainConfig(ctx, domainConfigurationName);
  ctx.store.set(domainConfigKey(domainConfigurationName), undefined);
  removeFromList<string>(
    ctx,
    allDomainConfigsKey,
    (n) => n === domainConfigurationName,
  );
  return {};
};

const ListDomainConfigurations: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["marker"]);
  const serviceTypeFilter = str(data["serviceType"]);
  const allNames = getList<string>(ctx, allDomainConfigsKey);
  let configs = allNames
    .map((n) => ctx.store.get<StoredDomainConfiguration>(domainConfigKey(n)))
    .filter((c): c is StoredDomainConfiguration => c !== undefined);
  if (serviceTypeFilter)
    configs = configs.filter((c) => c.serviceType === serviceTypeFilter);
  const { items, nextMarker } = paginateList(configs, marker);
  return {
    domainConfigurations: items.map((c) => ({
      domainConfigurationName: c.domainConfigurationName,
      domainConfigurationArn: c.domainConfigurationArn,
      serviceType: c.serviceType,
      domainConfigurationStatus: c.domainConfigurationStatus,
      domainType: c.domainType,
    })),
    nextMarker,
  };
};

const DescribeAccountAuditConfiguration: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<StoredAccountAuditConfig>(auditConfigKey) ?? {};
  return {
    roleArn: stored.roleArn,
    auditNotificationTargetConfigurations:
      stored.auditNotificationTargetConfigurations,
    auditCheckConfigurations: stored.auditCheckConfigurations,
  };
};

const UpdateAccountAuditConfiguration: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const existing =
    ctx.store.get<StoredAccountAuditConfig>(auditConfigKey) ?? {};
  const updated: StoredAccountAuditConfig = {
    roleArn: str(data["roleArn"]) ?? existing.roleArn,
    auditNotificationTargetConfigurations:
      data["auditNotificationTargetConfigurations"] ??
      existing.auditNotificationTargetConfigurations,
    auditCheckConfigurations:
      data["auditCheckConfigurations"] ?? existing.auditCheckConfigurations,
  };
  ctx.store.set(auditConfigKey, updated);
  return {};
};

const DeleteAccountAuditConfiguration: OperationHandler = (_input, ctx) => {
  ctx.store.set(auditConfigKey, undefined);
  return {};
};

const StartOnDemandAuditTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const targetCheckNames = data["targetCheckNames"] as string[] | undefined;
  if (!targetCheckNames || targetCheckNames.length === 0)
    throw awsError(
      "InvalidRequestException",
      "targetCheckNames is required.",
      400,
    );
  const taskId = `audit-${nowSeconds()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = nowSeconds();
  const stored: StoredAuditTask = {
    taskId,
    taskType: "ON_DEMAND_AUDIT_TASK",
    taskStatus: "COMPLETED",
    taskStartTime: now,
    auditDetails: Object.fromEntries(
      targetCheckNames.map((c) => [
        c,
        {
          checkRunStatus: "COMPLETED_COMPLIANT",
          checkCompliant: true,
          totalResourcesCount: 0,
          nonCompliantResourcesCount: 0,
        },
      ]),
    ),
  };
  ctx.store.set(auditTaskKey(taskId), stored);
  addToList(ctx, allAuditTasksKey, taskId);
  return { taskId };
};

const CancelAuditTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  const stored = requireAuditTask(ctx, taskId);
  stored.taskStatus = "CANCELLED";
  ctx.store.set(auditTaskKey(taskId), stored);
  return {};
};

const DescribeAuditTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  const stored = requireAuditTask(ctx, taskId);
  return {
    taskStatus: stored.taskStatus,
    taskType: stored.taskType,
    taskStartTime: stored.taskStartTime,
    scheduledAuditName: stored.scheduledAuditName,
    auditDetails: stored.auditDetails,
    taskStatistics: {
      totalChecks: 0,
      inProgressChecks: 0,
      waitingForDataCollectionChecks: 0,
      compliantChecksCount: 0,
      nonCompliantChecksCount: 0,
      failedChecksCount: 0,
      canceledChecksCount: 0,
    },
  };
};

const ListAuditTasks: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allAuditTasksKey);
  const tasks = allIds
    .map((id) => ctx.store.get<StoredAuditTask>(auditTaskKey(id)))
    .filter((t): t is StoredAuditTask => t !== undefined);
  const { items, nextMarker } = paginateList(tasks, marker);
  return {
    tasks: items.map((t) => ({
      taskId: t.taskId,
      taskStatus: t.taskStatus,
      taskType: t.taskType,
    })),
    nextToken: nextMarker,
  };
};

const DescribeAuditFinding: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const findingId = requireStr(data, "findingId");
  const stored = ctx.store.get<StoredAuditFinding>(auditFindingKey(findingId));
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Audit finding ${findingId} not found.`,
      404,
    );
  return { finding: stored };
};

const ListAuditFindings: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allAuditFindingsKey);
  const findings = allIds
    .map((id) => ctx.store.get<StoredAuditFinding>(auditFindingKey(id)))
    .filter((f): f is StoredAuditFinding => f !== undefined);
  const { items, nextMarker } = paginateList(findings, marker);
  return { findings: items, nextToken: nextMarker };
};

const CreateAuditSuppression: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const checkName = requireStr(data, "checkName");
  const resourceIdentifier = data["resourceIdentifier"];
  if (!resourceIdentifier)
    throw awsError(
      "InvalidRequestException",
      "resourceIdentifier is required.",
      400,
    );
  const rid = resourceIdKey(resourceIdentifier);
  const existingKey = auditSuppressionKey(checkName, rid);
  if (ctx.store.get(existingKey) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Audit suppression for check ${checkName} already exists.`,
      409,
    );
  const now = nowSeconds();
  const stored: StoredAuditSuppression = {
    checkName,
    resourceIdentifier,
    expirationDate: data["expirationDate"] as number | undefined,
    suppressIndefinitely: data["suppressIndefinitely"] as boolean | undefined,
    description: str(data["description"]),
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(existingKey, stored);
  addToList(ctx, allAuditSuppressionsKey, `${checkName}:${rid}`);
  return {};
};

const DeleteAuditSuppression: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const checkName = requireStr(data, "checkName");
  const resourceIdentifier = data["resourceIdentifier"];
  if (!resourceIdentifier)
    throw awsError(
      "InvalidRequestException",
      "resourceIdentifier is required.",
      400,
    );
  const rid = resourceIdKey(resourceIdentifier);
  ctx.store.set(auditSuppressionKey(checkName, rid), undefined);
  removeFromList<string>(
    ctx,
    allAuditSuppressionsKey,
    (k) => k === `${checkName}:${rid}`,
  );
  return {};
};

const DescribeAuditSuppression: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const checkName = requireStr(data, "checkName");
  const resourceIdentifier = data["resourceIdentifier"];
  if (!resourceIdentifier)
    throw awsError(
      "InvalidRequestException",
      "resourceIdentifier is required.",
      400,
    );
  const rid = resourceIdKey(resourceIdentifier);
  const stored = requireAuditSuppression(ctx, checkName, rid);
  return {
    checkName: stored.checkName,
    resourceIdentifier: stored.resourceIdentifier,
    expirationDate: stored.expirationDate,
    suppressIndefinitely: stored.suppressIndefinitely,
    description: stored.description,
  };
};

const UpdateAuditSuppression: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const checkName = requireStr(data, "checkName");
  const resourceIdentifier = data["resourceIdentifier"];
  if (!resourceIdentifier)
    throw awsError(
      "InvalidRequestException",
      "resourceIdentifier is required.",
      400,
    );
  const rid = resourceIdKey(resourceIdentifier);
  const stored = requireAuditSuppression(ctx, checkName, rid);
  if (data["expirationDate"] !== undefined)
    stored.expirationDate = data["expirationDate"] as number;
  if (data["suppressIndefinitely"] !== undefined)
    stored.suppressIndefinitely = data["suppressIndefinitely"] as boolean;
  if (data["description"] !== undefined)
    stored.description = str(data["description"]);
  stored.lastModifiedDate = nowSeconds();
  ctx.store.set(auditSuppressionKey(checkName, rid), stored);
  return {};
};

const ListAuditSuppressions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allKeys = getList<string>(ctx, allAuditSuppressionsKey);
  const suppressions = allKeys
    .map((k) => {
      const [cn, ...rest] = k.split(":");
      const rid = rest.join(":");
      return ctx.store.get<StoredAuditSuppression>(
        auditSuppressionKey(cn ?? "", rid),
      );
    })
    .filter((s): s is StoredAuditSuppression => s !== undefined);
  const { items, nextMarker } = paginateList(suppressions, marker);
  return { suppressions: items, nextToken: nextMarker };
};

const CreateMitigationAction: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const actionName = requireStr(data, "actionName");
  if (ctx.store.get(mitigationActionKey(actionName)) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Mitigation action ${actionName} already exists.`,
      409,
    );
  const roleArn = requireStr(data, "roleArn");
  const actionParams = data["actionParams"];
  if (!actionParams)
    throw awsError("InvalidRequestException", "actionParams is required.", 400);
  const arn = mitigationActionArn(ctx, actionName);
  const actionId = `action-${nowSeconds()}`;
  const now = nowSeconds();
  const stored: StoredMitigationAction = {
    actionName,
    actionArn: arn,
    actionId,
    roleArn,
    actionParams,
    createdDate: now,
    lastModifiedDate: now,
  };
  ctx.store.set(mitigationActionKey(actionName), stored);
  addToList(ctx, allMitigationActionsKey, actionName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { actionArn: arn, actionId };
};

const DeleteMitigationAction: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const actionName = requireStr(data, "actionName");
  requireMitigationAction(ctx, actionName);
  ctx.store.set(mitigationActionKey(actionName), undefined);
  removeFromList<string>(ctx, allMitigationActionsKey, (n) => n === actionName);
  return {};
};

const DescribeMitigationAction: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const actionName = requireStr(data, "actionName");
  const stored = requireMitigationAction(ctx, actionName);
  return {
    actionName: stored.actionName,
    actionType: "UPDATE_DEVICE_CERTIFICATE",
    actionArn: stored.actionArn,
    actionId: stored.actionId,
    roleArn: stored.roleArn,
    actionParams: stored.actionParams,
    creationDate: stored.createdDate,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const UpdateMitigationAction: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const actionName = requireStr(data, "actionName");
  const stored = requireMitigationAction(ctx, actionName);
  if (data["roleArn"]) stored.roleArn = requireStr(data, "roleArn");
  if (data["actionParams"]) stored.actionParams = data["actionParams"];
  stored.lastModifiedDate = nowSeconds();
  ctx.store.set(mitigationActionKey(actionName), stored);
  return { actionArn: stored.actionArn, actionId: stored.actionId };
};

const ListMitigationActions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allMitigationActionsKey);
  const actions = allNames
    .map((n) => ctx.store.get<StoredMitigationAction>(mitigationActionKey(n)))
    .filter((a): a is StoredMitigationAction => a !== undefined);
  const { items, nextMarker } = paginateList(actions, marker);
  return {
    actionIdentifiers: items.map((a) => ({
      actionName: a.actionName,
      actionArn: a.actionArn,
      creationDate: a.createdDate,
    })),
    nextToken: nextMarker,
  };
};

const StartAuditMitigationActionsTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  if (ctx.store.get(auditMitigationTaskKey(taskId)) !== undefined)
    throw awsError(
      "TaskAlreadyExistsException",
      `Task ${taskId} already exists.`,
      400,
    );
  const target = data["target"];
  const auditCheckToActionsMapping = data["auditCheckToActionsMapping"];
  if (!target || !auditCheckToActionsMapping)
    throw awsError(
      "InvalidRequestException",
      "target and auditCheckToActionsMapping are required.",
      400,
    );
  const now = nowSeconds();
  const stored: StoredAuditMitigationActionsTask = {
    taskId,
    target,
    auditCheckToActionsMapping,
    taskStatus: "COMPLETED",
    startTime: now,
    endTime: now,
  };
  ctx.store.set(auditMitigationTaskKey(taskId), stored);
  addToList(ctx, allAuditMitigationTasksKey, taskId);
  return { taskId };
};

const CancelAuditMitigationActionsTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  const stored = requireAuditMitigationTask(ctx, taskId);
  stored.taskStatus = "CANCELLED";
  ctx.store.set(auditMitigationTaskKey(taskId), stored);
  return {};
};

const DescribeAuditMitigationActionsTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  const stored = requireAuditMitigationTask(ctx, taskId);
  return {
    taskStatus: stored.taskStatus,
    startTime: stored.startTime,
    endTime: stored.endTime,
    target: stored.target,
    auditCheckToActionsMapping: stored.auditCheckToActionsMapping,
    actionsDefinition: [],
    taskStatistics: {},
  };
};

const ListAuditMitigationActionsTasks: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allAuditMitigationTasksKey);
  const tasks = allIds
    .map((id) =>
      ctx.store.get<StoredAuditMitigationActionsTask>(
        auditMitigationTaskKey(id),
      ),
    )
    .filter((t): t is StoredAuditMitigationActionsTask => t !== undefined);
  const { items, nextMarker } = paginateList(tasks, marker);
  return {
    tasks: items.map((t) => ({
      taskId: t.taskId,
      startTime: t.startTime,
      taskStatus: t.taskStatus,
    })),
    nextToken: nextMarker,
  };
};

const ListAuditMitigationActionsExecutions: OperationHandler = (
  _input,
  _ctx,
) => {
  return { actionsExecutions: [], nextToken: undefined };
};

const CreateScheduledAudit: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const scheduledAuditName = requireStr(data, "scheduledAuditName");
  if (ctx.store.get(scheduledAuditKey(scheduledAuditName)) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Scheduled audit ${scheduledAuditName} already exists.`,
      409,
    );
  const frequency = requireStr(data, "frequency");
  const targetCheckNames = data["targetCheckNames"] as string[] | undefined;
  if (!targetCheckNames || targetCheckNames.length === 0)
    throw awsError(
      "InvalidRequestException",
      "targetCheckNames is required.",
      400,
    );
  const arn = scheduledAuditArn(ctx, scheduledAuditName);
  const now = nowSeconds();
  const stored: StoredScheduledAudit = {
    scheduledAuditName,
    scheduledAuditArn: arn,
    frequency,
    dayOfMonth: str(data["dayOfMonth"]),
    dayOfWeek: str(data["dayOfWeek"]),
    targetCheckNames,
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(scheduledAuditKey(scheduledAuditName), stored);
  addToList(ctx, allScheduledAuditsKey, scheduledAuditName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { scheduledAuditArn: arn };
};

const DeleteScheduledAudit: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const scheduledAuditName = requireStr(data, "scheduledAuditName");
  requireScheduledAudit(ctx, scheduledAuditName);
  ctx.store.set(scheduledAuditKey(scheduledAuditName), undefined);
  removeFromList<string>(
    ctx,
    allScheduledAuditsKey,
    (n) => n === scheduledAuditName,
  );
  return {};
};

const DescribeScheduledAudit: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const scheduledAuditName = requireStr(data, "scheduledAuditName");
  const stored = requireScheduledAudit(ctx, scheduledAuditName);
  return {
    frequency: stored.frequency,
    dayOfMonth: stored.dayOfMonth,
    dayOfWeek: stored.dayOfWeek,
    targetCheckNames: stored.targetCheckNames,
    scheduledAuditName: stored.scheduledAuditName,
    scheduledAuditArn: stored.scheduledAuditArn,
  };
};

const UpdateScheduledAudit: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const scheduledAuditName = requireStr(data, "scheduledAuditName");
  const stored = requireScheduledAudit(ctx, scheduledAuditName);
  if (data["frequency"]) stored.frequency = requireStr(data, "frequency");
  if (data["dayOfMonth"] !== undefined)
    stored.dayOfMonth = str(data["dayOfMonth"]);
  if (data["dayOfWeek"] !== undefined)
    stored.dayOfWeek = str(data["dayOfWeek"]);
  if (data["targetCheckNames"])
    stored.targetCheckNames = data["targetCheckNames"] as string[];
  stored.lastModifiedDate = nowSeconds();
  ctx.store.set(scheduledAuditKey(scheduledAuditName), stored);
  return { scheduledAuditArn: stored.scheduledAuditArn };
};

const ListScheduledAudits: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allScheduledAuditsKey);
  const audits = allNames
    .map((n) => ctx.store.get<StoredScheduledAudit>(scheduledAuditKey(n)))
    .filter((a): a is StoredScheduledAudit => a !== undefined);
  const { items, nextMarker } = paginateList(audits, marker);
  return {
    scheduledAudits: items.map((a) => ({
      scheduledAuditName: a.scheduledAuditName,
      scheduledAuditArn: a.scheduledAuditArn,
      frequency: a.frequency,
    })),
    nextToken: nextMarker,
  };
};

const CreateSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  if (ctx.store.get(securityProfileKey(securityProfileName)) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Security profile ${securityProfileName} already exists.`,
      409,
    );
  const arn = securityProfileArn(ctx, securityProfileName);
  const now = nowSeconds();
  const stored: StoredSecurityProfile = {
    securityProfileName,
    securityProfileArn: arn,
    securityProfileDescription: str(data["securityProfileDescription"]),
    behaviors: data["behaviors"] as unknown[] | undefined,
    alertTargets: data["alertTargets"],
    additionalMetricsToRetainV2: data["additionalMetricsToRetainV2"] as
      | unknown[]
      | undefined,
    metricsExportConfig: data["metricsExportConfig"],
    version: 1,
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(securityProfileKey(securityProfileName), stored);
  addToList(ctx, allSecurityProfilesKey, securityProfileName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return {
    securityProfileName: stored.securityProfileName,
    securityProfileArn: stored.securityProfileArn,
  };
};

const DeleteSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  requireSecurityProfile(ctx, securityProfileName);
  ctx.store.set(securityProfileKey(securityProfileName), undefined);
  ctx.store.set(securityProfileTargetsKey(securityProfileName), undefined);
  removeFromList<string>(
    ctx,
    allSecurityProfilesKey,
    (n) => n === securityProfileName,
  );
  return {};
};

const DescribeSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  const stored = requireSecurityProfile(ctx, securityProfileName);
  return {
    securityProfileName: stored.securityProfileName,
    securityProfileArn: stored.securityProfileArn,
    securityProfileDescription: stored.securityProfileDescription,
    behaviors: stored.behaviors ?? [],
    alertTargets: stored.alertTargets ?? {},
    additionalMetricsToRetainV2: stored.additionalMetricsToRetainV2 ?? [],
    metricsExportConfig: stored.metricsExportConfig,
    version: stored.version,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const UpdateSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  const stored = requireSecurityProfile(ctx, securityProfileName);
  if (data["securityProfileDescription"] !== undefined)
    stored.securityProfileDescription = str(data["securityProfileDescription"]);
  if (data["behaviors"] !== undefined)
    stored.behaviors = data["behaviors"] as unknown[];
  if (data["alertTargets"] !== undefined)
    stored.alertTargets = data["alertTargets"];
  if (data["additionalMetricsToRetainV2"] !== undefined)
    stored.additionalMetricsToRetainV2 = data[
      "additionalMetricsToRetainV2"
    ] as unknown[];
  if (data["metricsExportConfig"] !== undefined)
    stored.metricsExportConfig = data["metricsExportConfig"];
  stored.version += 1;
  stored.lastModifiedDate = nowSeconds();
  ctx.store.set(securityProfileKey(securityProfileName), stored);
  return {
    securityProfileName: stored.securityProfileName,
    securityProfileArn: stored.securityProfileArn,
    securityProfileDescription: stored.securityProfileDescription,
    behaviors: stored.behaviors ?? [],
    alertTargets: stored.alertTargets ?? {},
    additionalMetricsToRetainV2: stored.additionalMetricsToRetainV2 ?? [],
    version: stored.version,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const ListSecurityProfiles: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allSecurityProfilesKey);
  const profiles = allNames
    .map((n) => ctx.store.get<StoredSecurityProfile>(securityProfileKey(n)))
    .filter((p): p is StoredSecurityProfile => p !== undefined);
  const { items, nextMarker } = paginateList(profiles, marker);
  return {
    securityProfileIdentifiers: items.map((p) => ({
      name: p.securityProfileName,
      arn: p.securityProfileArn,
    })),
    nextToken: nextMarker,
  };
};

const AttachSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  requireSecurityProfile(ctx, securityProfileName);
  const securityProfileTargetArn = requireStr(data, "securityProfileTargetArn");
  const targets = getList<string>(
    ctx,
    securityProfileTargetsKey(securityProfileName),
  );
  if (!targets.includes(securityProfileTargetArn)) {
    addToList(
      ctx,
      securityProfileTargetsKey(securityProfileName),
      securityProfileTargetArn,
    );
  }
  return {};
};

const DetachSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  requireSecurityProfile(ctx, securityProfileName);
  const securityProfileTargetArn = requireStr(data, "securityProfileTargetArn");
  removeFromList<string>(
    ctx,
    securityProfileTargetsKey(securityProfileName),
    (t) => t === securityProfileTargetArn,
  );
  return {};
};

const ListSecurityProfilesForTarget: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const targetArn = requireStr(data, "securityProfileTargetArn");
  const allNames = getList<string>(ctx, allSecurityProfilesKey);
  const matching = allNames.filter((n) => {
    const targets = getList<string>(ctx, securityProfileTargetsKey(n));
    return targets.includes(targetArn);
  });
  const profiles = matching
    .map((n) => ctx.store.get<StoredSecurityProfile>(securityProfileKey(n)))
    .filter((p): p is StoredSecurityProfile => p !== undefined);
  const { items, nextMarker } = paginateList(profiles, marker);
  return {
    securityProfileTargetMappings: items.map((p) => ({
      securityProfileIdentifier: {
        name: p.securityProfileName,
        arn: p.securityProfileArn,
      },
      target: { arn: targetArn },
    })),
    nextToken: nextMarker,
  };
};

const ListTargetsForSecurityProfile: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const securityProfileName = requireStr(data, "securityProfileName");
  requireSecurityProfile(ctx, securityProfileName);
  const marker = str(data["nextToken"]);
  const targets = getList<string>(
    ctx,
    securityProfileTargetsKey(securityProfileName),
  );
  const { items, nextMarker } = paginateList(targets, marker);
  return {
    securityProfileTargets: items.map((arn) => ({ arn })),
    nextToken: nextMarker,
  };
};

const ValidateSecurityProfileBehaviors: OperationHandler = (input, _ctx) => {
  const data = input as Record<string, unknown>;
  const behaviors = (data["behaviors"] as unknown[]) ?? [];
  return {
    valid: true,
    validationErrors:
      behaviors.length === 0
        ? [{ errorMessage: "behaviors must not be empty." }]
        : [],
  };
};

const CreateCustomMetric: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const metricName = requireStr(data, "metricName");
  if (ctx.store.get(customMetricKey(metricName)) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Custom metric ${metricName} already exists.`,
      409,
    );
  const metricType = requireStr(data, "metricType");
  const arn = customMetricArn(ctx, metricName);
  const now = nowSeconds();
  const stored: StoredCustomMetric = {
    metricName,
    metricArn: arn,
    displayName: str(data["displayName"]),
    metricType,
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(customMetricKey(metricName), stored);
  addToList(ctx, allCustomMetricsKey, metricName);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { metricName: stored.metricName, metricArn: stored.metricArn };
};

const DeleteCustomMetric: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const metricName = requireStr(data, "metricName");
  requireCustomMetric(ctx, metricName);
  ctx.store.set(customMetricKey(metricName), undefined);
  removeFromList<string>(ctx, allCustomMetricsKey, (n) => n === metricName);
  return {};
};

const DescribeCustomMetric: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const metricName = requireStr(data, "metricName");
  const stored = requireCustomMetric(ctx, metricName);
  return {
    metricName: stored.metricName,
    metricArn: stored.metricArn,
    metricType: stored.metricType,
    displayName: stored.displayName,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const UpdateCustomMetric: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const metricName = requireStr(data, "metricName");
  const stored = requireCustomMetric(ctx, metricName);
  if (data["displayName"] !== undefined)
    stored.displayName = str(data["displayName"]);
  stored.lastModifiedDate = nowSeconds();
  ctx.store.set(customMetricKey(metricName), stored);
  return {
    metricName: stored.metricName,
    metricArn: stored.metricArn,
    metricType: stored.metricType,
    displayName: stored.displayName,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const ListCustomMetrics: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allCustomMetricsKey);
  const { items, nextMarker } = paginateList(allNames, marker);
  return { metricNames: items, nextToken: nextMarker };
};

const CreateDimension: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const name = requireStr(data, "name");
  if (ctx.store.get(dimensionKey(name)) !== undefined)
    throw awsError(
      "ResourceAlreadyExistsException",
      `Dimension ${name} already exists.`,
      409,
    );
  const type = requireStr(data, "type");
  const stringValues = data["stringValues"] as string[] | undefined;
  if (!stringValues || stringValues.length === 0)
    throw awsError("InvalidRequestException", "stringValues is required.", 400);
  const arn = dimensionArn(ctx, name);
  const now = nowSeconds();
  const stored: StoredDimension = {
    name,
    arn,
    type,
    stringValues,
    createdAt: now,
    lastModifiedDate: now,
  };
  ctx.store.set(dimensionKey(name), stored);
  addToList(ctx, allDimensionsKey, name);
  const tags = data["tags"] as { Key: string; Value?: string }[] | undefined;
  if (tags && tags.length > 0) ctx.store.set(tagsKey(arn), tags);
  return { name: stored.name, arn: stored.arn };
};

const DeleteDimension: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const name = requireStr(data, "name");
  requireDimension(ctx, name);
  ctx.store.set(dimensionKey(name), undefined);
  removeFromList<string>(ctx, allDimensionsKey, (n) => n === name);
  return {};
};

const DescribeDimension: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const name = requireStr(data, "name");
  const stored = requireDimension(ctx, name);
  return {
    name: stored.name,
    arn: stored.arn,
    type: stored.type,
    stringValues: stored.stringValues,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const UpdateDimension: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const name = requireStr(data, "name");
  const stored = requireDimension(ctx, name);
  if (data["stringValues"])
    stored.stringValues = data["stringValues"] as string[];
  stored.lastModifiedDate = nowSeconds();
  ctx.store.set(dimensionKey(name), stored);
  return {
    name: stored.name,
    arn: stored.arn,
    type: stored.type,
    stringValues: stored.stringValues,
    creationDate: stored.createdAt,
    lastModifiedDate: stored.lastModifiedDate,
  };
};

const ListDimensions: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allNames = getList<string>(ctx, allDimensionsKey);
  const { items, nextMarker } = paginateList(allNames, marker);
  return { dimensionNames: items, nextToken: nextMarker };
};

const StartDetectMitigationActionsTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  if (ctx.store.get(detectTaskKey(taskId)) !== undefined)
    throw awsError(
      "TaskAlreadyExistsException",
      `Task ${taskId} already exists.`,
      400,
    );
  const target = data["target"];
  const actions = data["actions"] as string[] | undefined;
  if (!target || !actions || actions.length === 0)
    throw awsError(
      "InvalidRequestException",
      "target and actions are required.",
      400,
    );
  const now = nowSeconds();
  const stored: StoredDetectMitigationActionsTask = {
    taskId,
    target,
    actions,
    violationEventOccurrenceRange: data["violationEventOccurrenceRange"],
    includeOnlyActiveViolations: data["includeOnlyActiveViolations"] as
      | boolean
      | undefined,
    includeSuppressedAlerts: data["includeSuppressedAlerts"] as
      | boolean
      | undefined,
    taskStatus: "SUCCESSFUL",
    taskStartTime: now,
    taskEndTime: now,
  };
  ctx.store.set(detectTaskKey(taskId), stored);
  addToList(ctx, allDetectTasksKey, taskId);
  return { taskId };
};

const CancelDetectMitigationActionsTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  const stored = requireDetectMitigationTask(ctx, taskId);
  stored.taskStatus = "CANCELED";
  ctx.store.set(detectTaskKey(taskId), stored);
  return {};
};

const DescribeDetectMitigationActionsTask: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const taskId = requireStr(data, "taskId");
  const stored = requireDetectMitigationTask(ctx, taskId);
  return {
    taskSummary: {
      taskId: stored.taskId,
      taskStatus: stored.taskStatus,
      taskStartTime: stored.taskStartTime,
      taskEndTime: stored.taskEndTime,
      target: stored.target,
      actions: stored.actions,
      violationEventOccurrenceRange: stored.violationEventOccurrenceRange,
      includeOnlyActiveViolations: stored.includeOnlyActiveViolations,
      includeSuppressedAlerts: stored.includeSuppressedAlerts,
      actionsDefinition: [],
      taskStatistics: {
        actionsExecuted: 0,
        actionsSkipped: 0,
        actionsFailed: 0,
      },
    },
  };
};

const ListDetectMitigationActionsTasks: OperationHandler = (input, ctx) => {
  const data = input as Record<string, unknown>;
  const marker = str(data["nextToken"]);
  const allIds = getList<string>(ctx, allDetectTasksKey);
  const tasks = allIds
    .map((id) =>
      ctx.store.get<StoredDetectMitigationActionsTask>(detectTaskKey(id)),
    )
    .filter((t): t is StoredDetectMitigationActionsTask => t !== undefined);
  const { items, nextMarker } = paginateList(tasks, marker);
  return {
    tasks: items.map((t) => ({
      taskId: t.taskId,
      taskStatus: t.taskStatus,
      taskStartTime: t.taskStartTime,
      taskEndTime: t.taskEndTime,
      target: t.target,
      actions: t.actions,
      actionsDefinition: [],
      taskStatistics: {
        actionsExecuted: 0,
        actionsSkipped: 0,
        actionsFailed: 0,
      },
    })),
    nextToken: nextMarker,
  };
};

const ListDetectMitigationActionsExecutions: OperationHandler = (
  _input,
  _ctx,
) => {
  return { actionsExecutions: [], nextToken: undefined };
};

const ListActiveViolations: OperationHandler = (_input, _ctx) => {
  return { activeViolations: [], nextToken: undefined };
};

const ListViolationEvents: OperationHandler = (_input, _ctx) => {
  return { violationEvents: [], nextToken: undefined };
};

const PutVerificationStateOnViolation: OperationHandler = (input, _ctx) => {
  const data = input as Record<string, unknown>;
  requireStr(data, "violationId");
  return {};
};

const GetBehaviorModelTrainingSummaries: OperationHandler = (_input, _ctx) => {
  return { summaries: [], nextToken: undefined };
};

// === resolveOperation ===

const idFromArn2 = (arn: string): string => {
  const parts = arn.split(":");
  return parts[parts.length - 1] ?? arn;
};
void idFromArn2;
void certIdFromArn;

export default {
  name: "iot",
  protocol: "rest-json" as const,
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/^\//, "");
    const parts = path.split("/");

    if (parts[0] === "things") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListThings";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateThing";
        if (req.method === "GET") return "DescribeThing";
        if (req.method === "PATCH") return "UpdateThing";
        if (req.method === "DELETE") return "DeleteThing";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "principals") {
          if (req.method === "PUT") return "AttachThingPrincipal";
          if (req.method === "DELETE") return "DetachThingPrincipal";
          if (req.method === "GET") return "ListThingPrincipals";
          return undefined;
        }
        if (parts[2] === "thing-groups") {
          if (req.method === "GET") return "ListThingGroupsForThing";
          return undefined;
        }
        if (parts[2] === "jobs") {
          if (req.method === "GET") return "ListJobExecutionsForThing";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[2] === "jobs" && req.method === "GET")
          return "DescribeJobExecution";
        return undefined;
      }
      if (parts.length === 5) {
        if (
          parts[2] === "jobs" &&
          parts[4] === "cancel" &&
          req.method === "PUT"
        )
          return "CancelJobExecution";
        return undefined;
      }
      if (parts.length === 6) {
        if (
          parts[2] === "jobs" &&
          parts[4] === "executionNumber" &&
          req.method === "DELETE"
        )
          return "DeleteJobExecution";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "thing-types") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListThingTypes";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateThingType";
        if (req.method === "GET") return "DescribeThingType";
        if (req.method === "DELETE") return "DeleteThingType";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "deprecate") {
        if (req.method === "POST") return "DeprecateThingType";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "thing-groups") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListThingGroups";
        return undefined;
      }
      if (parts[1] === "addThingToThingGroup") {
        if (req.method === "PUT") return "AddThingToThingGroup";
        return undefined;
      }
      if (parts[1] === "removeThingFromThingGroup") {
        if (req.method === "PUT") return "RemoveThingFromThingGroup";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateThingGroup";
        if (req.method === "GET") return "DescribeThingGroup";
        if (req.method === "PATCH") return "UpdateThingGroup";
        if (req.method === "DELETE") return "DeleteThingGroup";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "things") {
        if (req.method === "GET") return "ListThingsInThingGroup";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "keys-and-certificate") {
      if (req.method === "POST") return "CreateKeysAndCertificate";
      return undefined;
    }

    if (parts[0] === "certificate") {
      if (parts[1] === "register-no-ca" && req.method === "POST")
        return "RegisterCertificateWithoutCA";
      if (parts[1] === "register" && req.method === "POST")
        return "RegisterCertificate";
      return undefined;
    }

    if (parts[0] === "certificates") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListCertificates";
        if (req.method === "POST") return "CreateCertificateFromCsr";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeCertificate";
        if (req.method === "PUT") return "UpdateCertificate";
        if (req.method === "DELETE") return "DeleteCertificate";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "certificates-by-ca") {
      if (parts.length === 2 && req.method === "GET")
        return "ListCertificatesByCA";
      return undefined;
    }

    if (parts[0] === "certificates-out-going") {
      if (req.method === "GET") return "ListOutgoingCertificates";
      return undefined;
    }

    if (parts[0] === "accept-certificate-transfer") {
      if (parts.length === 2 && req.method === "PATCH")
        return "AcceptCertificateTransfer";
      return undefined;
    }

    if (parts[0] === "cancel-certificate-transfer") {
      if (parts.length === 2 && req.method === "PATCH")
        return "CancelCertificateTransfer";
      return undefined;
    }

    if (parts[0] === "transfer-certificate") {
      if (parts.length === 2 && req.method === "PATCH")
        return "TransferCertificate";
      return undefined;
    }

    if (parts[0] === "reject-certificate-transfer") {
      if (parts.length === 2 && req.method === "PATCH")
        return "RejectCertificateTransfer";
      return undefined;
    }

    if (parts[0] === "cacertificate") {
      if (parts.length === 1 && req.method === "POST")
        return "RegisterCACertificate";
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeCACertificate";
        if (req.method === "PUT") return "UpdateCACertificate";
        if (req.method === "DELETE") return "DeleteCACertificate";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "cacertificates") {
      if (req.method === "GET") return "ListCACertificates";
      return undefined;
    }

    if (parts[0] === "registrationcode") {
      if (req.method === "GET") return "GetRegistrationCode";
      if (req.method === "DELETE") return "DeleteRegistrationCode";
      return undefined;
    }

    if (parts[0] === "certificate-providers") {
      if (parts.length === 1 && req.method === "GET")
        return "ListCertificateProviders";
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateCertificateProvider";
        if (req.method === "GET") return "DescribeCertificateProvider";
        if (req.method === "PUT") return "UpdateCertificateProvider";
        if (req.method === "DELETE") return "DeleteCertificateProvider";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "provisioning-templates") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListProvisioningTemplates";
        if (req.method === "POST") return "CreateProvisioningTemplate";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeProvisioningTemplate";
        if (req.method === "PATCH") return "UpdateProvisioningTemplate";
        if (req.method === "DELETE") return "DeleteProvisioningTemplate";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "versions") {
        if (req.method === "GET") return "ListProvisioningTemplateVersions";
        if (req.method === "POST") return "CreateProvisioningTemplateVersion";
        return undefined;
      }
      if (
        parts.length === 3 &&
        parts[2] === "provisioning-claim" &&
        req.method === "POST"
      )
        return "CreateProvisioningClaim";
      if (parts.length === 4 && parts[2] === "versions") {
        if (req.method === "GET") return "DescribeProvisioningTemplateVersion";
        if (req.method === "DELETE") return "DeleteProvisioningTemplateVersion";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "role-aliases") {
      if (parts.length === 1 && req.method === "GET") return "ListRoleAliases";
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateRoleAlias";
        if (req.method === "GET") return "DescribeRoleAlias";
        if (req.method === "PUT") return "UpdateRoleAlias";
        if (req.method === "DELETE") return "DeleteRoleAlias";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "default-authorizer") {
      if (req.method === "POST") return "SetDefaultAuthorizer";
      if (req.method === "GET") return "DescribeDefaultAuthorizer";
      if (req.method === "DELETE") return "ClearDefaultAuthorizer";
      return undefined;
    }

    if (parts[0] === "authorizer") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateAuthorizer";
        if (req.method === "GET") return "DescribeAuthorizer";
        if (req.method === "PUT") return "UpdateAuthorizer";
        if (req.method === "DELETE") return "DeleteAuthorizer";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "test" && req.method === "POST")
        return "TestInvokeAuthorizer";
      return undefined;
    }

    if (parts[0] === "authorizers") {
      if (req.method === "GET") return "ListAuthorizers";
      return undefined;
    }

    if (parts[0] === "domainConfigurations") {
      if (parts.length === 1 && req.method === "GET")
        return "ListDomainConfigurations";
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateDomainConfiguration";
        if (req.method === "GET") return "DescribeDomainConfiguration";
        if (req.method === "PUT") return "UpdateDomainConfiguration";
        if (req.method === "DELETE") return "DeleteDomainConfiguration";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policies") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPolicies";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreatePolicy";
        if (req.method === "GET") return "GetPolicy";
        if (req.method === "DELETE") return "DeletePolicy";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "version") {
        if (req.method === "GET") return "ListPolicyVersions";
        if (req.method === "POST") return "CreatePolicyVersion";
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "version") {
        if (req.method === "GET") return "GetPolicyVersion";
        if (req.method === "PATCH") return "SetDefaultPolicyVersion";
        if (req.method === "DELETE") return "DeletePolicyVersion";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "principal-policies") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPrincipalPolicies";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "AttachPrincipalPolicy";
        if (req.method === "DELETE") return "DetachPrincipalPolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policy-principals") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListPolicyPrincipals";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "target-policies") {
      if (parts.length === 2) {
        if (req.method === "PUT") return "AttachPolicy";
        if (req.method === "POST") return "DetachPolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "attached-policies") {
      if (parts.length === 2) {
        if (req.method === "POST") return "ListAttachedPolicies";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "policy-targets") {
      if (parts.length === 2) {
        if (req.method === "POST") return "ListTargetsForPolicy";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "principals" && parts[1] === "things") {
      if (req.method === "GET") return "ListPrincipalThings";
      return undefined;
    }

    if (parts[0] === "rules") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListTopicRules";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateTopicRule";
        if (req.method === "GET") return "GetTopicRule";
        if (req.method === "PATCH") return "ReplaceTopicRule";
        if (req.method === "DELETE") return "DeleteTopicRule";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "enable" && req.method === "POST")
          return "EnableTopicRule";
        if (parts[2] === "disable" && req.method === "POST")
          return "DisableTopicRule";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "endpoint") {
      if (req.method === "GET") return "DescribeEndpoint";
      return undefined;
    }

    if (parts[0] === "tags") {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      return undefined;
    }

    if (parts[0] === "untag") {
      if (req.method === "POST") return "UntagResource";
      return undefined;
    }

    if (parts[0] === "jobs") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListJobs";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "CreateJob";
        if (req.method === "GET") return "DescribeJob";
        if (req.method === "PATCH") return "UpdateJob";
        if (req.method === "DELETE") return "DeleteJob";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "cancel" && req.method === "PUT") return "CancelJob";
        if (parts[2] === "targets" && req.method === "POST")
          return "AssociateTargetsWithJob";
        if (parts[2] === "things" && req.method === "GET")
          return "ListJobExecutionsForJob";
        if (parts[2] === "job-document" && req.method === "GET")
          return "GetJobDocument";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "job-templates") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListJobTemplates";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "CreateJobTemplate";
        if (req.method === "GET") return "DescribeJobTemplate";
        if (req.method === "DELETE") return "DeleteJobTemplate";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "managed-job-templates") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListManagedJobTemplates";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeManagedJobTemplate";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "commands") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListCommands";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "CreateCommand";
        if (req.method === "GET") return "GetCommand";
        if (req.method === "PATCH") return "UpdateCommand";
        if (req.method === "DELETE") return "DeleteCommand";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "command-executions") {
      if (parts.length === 1) {
        if (req.method === "POST") return "ListCommandExecutions";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetCommandExecution";
        if (req.method === "DELETE") return "DeleteCommandExecution";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "audit" && parts[1] === "configuration") {
      if (req.method === "GET") return "DescribeAccountAuditConfiguration";
      if (req.method === "PATCH") return "UpdateAccountAuditConfiguration";
      if (req.method === "DELETE") return "DeleteAccountAuditConfiguration";
      return undefined;
    }

    if (parts[0] === "audit" && parts[1] === "tasks") {
      if (parts.length === 2) {
        if (req.method === "POST") return "StartOnDemandAuditTask";
        if (req.method === "GET") return "ListAuditTasks";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeAuditTask";
        return undefined;
      }
      if (parts.length === 4 && parts[3] === "cancel") {
        if (req.method === "PUT") return "CancelAuditTask";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "audit" && parts[1] === "findings") {
      if (parts.length === 2) {
        if (req.method === "POST") return "ListAuditFindings";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeAuditFinding";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "audit" && parts[1] === "suppressions") {
      if (parts[2] === "create" && req.method === "POST")
        return "CreateAuditSuppression";
      if (parts[2] === "delete" && req.method === "POST")
        return "DeleteAuditSuppression";
      if (parts[2] === "describe" && req.method === "POST")
        return "DescribeAuditSuppression";
      if (parts[2] === "update" && req.method === "PATCH")
        return "UpdateAuditSuppression";
      if (parts[2] === "list" && req.method === "POST")
        return "ListAuditSuppressions";
      return undefined;
    }

    if (
      parts[0] === "audit" &&
      parts[1] === "mitigationactions" &&
      parts[2] === "tasks"
    ) {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListAuditMitigationActionsTasks";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "POST") return "StartAuditMitigationActionsTask";
        if (req.method === "GET") return "DescribeAuditMitigationActionsTask";
        return undefined;
      }
      if (parts.length === 5 && parts[4] === "cancel") {
        if (req.method === "PUT") return "CancelAuditMitigationActionsTask";
        return undefined;
      }
      return undefined;
    }

    if (
      parts[0] === "audit" &&
      parts[1] === "mitigationactions" &&
      parts[2] === "executions"
    ) {
      if (req.method === "GET") return "ListAuditMitigationActionsExecutions";
      return undefined;
    }

    if (parts[0] === "audit" && parts[1] === "scheduledaudits") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListScheduledAudits";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateScheduledAudit";
        if (req.method === "GET") return "DescribeScheduledAudit";
        if (req.method === "PATCH") return "UpdateScheduledAudit";
        if (req.method === "DELETE") return "DeleteScheduledAudit";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "mitigationactions" && parts[1] === "actions") {
      if (parts.length === 2) {
        if (req.method === "GET") return "ListMitigationActions";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateMitigationAction";
        if (req.method === "GET") return "DescribeMitigationAction";
        if (req.method === "PATCH") return "UpdateMitigationAction";
        if (req.method === "DELETE") return "DeleteMitigationAction";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "security-profiles") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListSecurityProfiles";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateSecurityProfile";
        if (req.method === "GET") return "DescribeSecurityProfile";
        if (req.method === "PATCH") return "UpdateSecurityProfile";
        if (req.method === "DELETE") return "DeleteSecurityProfile";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "targets") {
        if (req.method === "PUT") return "AttachSecurityProfile";
        if (req.method === "DELETE") return "DetachSecurityProfile";
        if (req.method === "GET") return "ListTargetsForSecurityProfile";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "security-profiles-for-target") {
      if (req.method === "GET") return "ListSecurityProfilesForTarget";
      return undefined;
    }

    if (parts[0] === "security-profile-behaviors" && parts[1] === "validate") {
      if (req.method === "POST") return "ValidateSecurityProfileBehaviors";
      return undefined;
    }

    if (parts[0] === "custom-metric") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateCustomMetric";
        if (req.method === "GET") return "DescribeCustomMetric";
        if (req.method === "PATCH") return "UpdateCustomMetric";
        if (req.method === "DELETE") return "DeleteCustomMetric";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "custom-metrics") {
      if (req.method === "GET") return "ListCustomMetrics";
      return undefined;
    }

    if (parts[0] === "dimensions") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListDimensions";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateDimension";
        if (req.method === "GET") return "DescribeDimension";
        if (req.method === "PATCH") return "UpdateDimension";
        if (req.method === "DELETE") return "DeleteDimension";
        return undefined;
      }
      return undefined;
    }

    if (
      parts[0] === "detect" &&
      parts[1] === "mitigationactions" &&
      parts[2] === "tasks"
    ) {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListDetectMitigationActionsTasks";
        return undefined;
      }
      if (parts.length === 4) {
        if (req.method === "PUT") return "StartDetectMitigationActionsTask";
        if (req.method === "GET") return "DescribeDetectMitigationActionsTask";
        return undefined;
      }
      if (parts.length === 5 && parts[4] === "cancel") {
        if (req.method === "PUT") return "CancelDetectMitigationActionsTask";
        return undefined;
      }
      return undefined;
    }

    if (
      parts[0] === "detect" &&
      parts[1] === "mitigationactions" &&
      parts[2] === "executions"
    ) {
      if (req.method === "GET") return "ListDetectMitigationActionsExecutions";
      return undefined;
    }

    if (parts[0] === "active-violations") {
      if (req.method === "GET") return "ListActiveViolations";
      return undefined;
    }

    if (parts[0] === "violation-events") {
      if (req.method === "GET") return "ListViolationEvents";
      return undefined;
    }

    if (parts[0] === "violations" && parts[2] === "verification-state") {
      if (req.method === "POST") return "PutVerificationStateOnViolation";
      return undefined;
    }

    if (parts[0] === "behavior-model-training" && parts[1] === "summaries") {
      if (req.method === "GET") return "GetBehaviorModelTrainingSummaries";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateThing,
    DescribeThing,
    UpdateThing,
    DeleteThing,
    ListThings,
    ListThingGroupsForThing,
    CreateThingType,
    DescribeThingType,
    DeleteThingType,
    ListThingTypes,
    DeprecateThingType,
    CreateThingGroup,
    DescribeThingGroup,
    UpdateThingGroup,
    DeleteThingGroup,
    ListThingGroups,
    AddThingToThingGroup,
    RemoveThingFromThingGroup,
    ListThingsInThingGroup,
    CreateKeysAndCertificate,
    CreateCertificateFromCsr,
    AcceptCertificateTransfer,
    CancelCertificateTransfer,
    TransferCertificate,
    RejectCertificateTransfer,
    RegisterCertificate,
    RegisterCertificateWithoutCA,
    ListCertificatesByCA,
    ListOutgoingCertificates,
    DescribeCertificate,
    UpdateCertificate,
    DeleteCertificate,
    ListCertificates,
    RegisterCACertificate,
    DescribeCACertificate,
    UpdateCACertificate,
    DeleteCACertificate,
    ListCACertificates,
    GetRegistrationCode,
    DeleteRegistrationCode,
    CreateCertificateProvider,
    DescribeCertificateProvider,
    UpdateCertificateProvider,
    DeleteCertificateProvider,
    ListCertificateProviders,
    CreateProvisioningTemplate,
    DescribeProvisioningTemplate,
    UpdateProvisioningTemplate,
    DeleteProvisioningTemplate,
    ListProvisioningTemplates,
    CreateProvisioningTemplateVersion,
    DescribeProvisioningTemplateVersion,
    DeleteProvisioningTemplateVersion,
    ListProvisioningTemplateVersions,
    CreateProvisioningClaim,
    CreateRoleAlias,
    DescribeRoleAlias,
    UpdateRoleAlias,
    DeleteRoleAlias,
    ListRoleAliases,
    CreateAuthorizer,
    DescribeAuthorizer,
    UpdateAuthorizer,
    DeleteAuthorizer,
    ListAuthorizers,
    SetDefaultAuthorizer,
    DescribeDefaultAuthorizer,
    ClearDefaultAuthorizer,
    TestInvokeAuthorizer,
    CreateDomainConfiguration,
    DescribeDomainConfiguration,
    UpdateDomainConfiguration,
    DeleteDomainConfiguration,
    ListDomainConfigurations,
    CreatePolicy,
    GetPolicy,
    DeletePolicy,
    ListPolicies,
    CreatePolicyVersion,
    GetPolicyVersion,
    ListPolicyVersions,
    SetDefaultPolicyVersion,
    DeletePolicyVersion,
    AttachPolicy,
    DetachPolicy,
    ListAttachedPolicies,
    ListTargetsForPolicy,
    AttachPrincipalPolicy,
    DetachPrincipalPolicy,
    ListPrincipalPolicies,
    ListPolicyPrincipals,
    AttachThingPrincipal,
    DetachThingPrincipal,
    ListThingPrincipals,
    ListPrincipalThings,
    CreateTopicRule,
    GetTopicRule,
    ReplaceTopicRule,
    DeleteTopicRule,
    ListTopicRules,
    EnableTopicRule,
    DisableTopicRule,
    DescribeEndpoint,
    TagResource,
    UntagResource,
    ListTagsForResource,
    CreateJob,
    AssociateTargetsWithJob,
    CancelJob,
    DeleteJob,
    DescribeJob,
    UpdateJob,
    ListJobs,
    GetJobDocument,
    DescribeJobExecution,
    CancelJobExecution,
    DeleteJobExecution,
    ListJobExecutionsForJob,
    ListJobExecutionsForThing,
    CreateJobTemplate,
    DeleteJobTemplate,
    DescribeJobTemplate,
    ListJobTemplates,
    DescribeManagedJobTemplate,
    ListManagedJobTemplates,
    CreateCommand,
    DeleteCommand,
    GetCommand,
    UpdateCommand,
    ListCommands,
    GetCommandExecution,
    DeleteCommandExecution,
    ListCommandExecutions,
    DescribeAccountAuditConfiguration,
    UpdateAccountAuditConfiguration,
    DeleteAccountAuditConfiguration,
    StartOnDemandAuditTask,
    CancelAuditTask,
    DescribeAuditTask,
    ListAuditTasks,
    DescribeAuditFinding,
    ListAuditFindings,
    CreateAuditSuppression,
    DeleteAuditSuppression,
    DescribeAuditSuppression,
    UpdateAuditSuppression,
    ListAuditSuppressions,
    CreateMitigationAction,
    DeleteMitigationAction,
    DescribeMitigationAction,
    UpdateMitigationAction,
    ListMitigationActions,
    StartAuditMitigationActionsTask,
    CancelAuditMitigationActionsTask,
    DescribeAuditMitigationActionsTask,
    ListAuditMitigationActionsTasks,
    ListAuditMitigationActionsExecutions,
    CreateScheduledAudit,
    DeleteScheduledAudit,
    DescribeScheduledAudit,
    UpdateScheduledAudit,
    ListScheduledAudits,
    CreateSecurityProfile,
    DeleteSecurityProfile,
    DescribeSecurityProfile,
    UpdateSecurityProfile,
    ListSecurityProfiles,
    AttachSecurityProfile,
    DetachSecurityProfile,
    ListSecurityProfilesForTarget,
    ListTargetsForSecurityProfile,
    ValidateSecurityProfileBehaviors,
    CreateCustomMetric,
    DeleteCustomMetric,
    DescribeCustomMetric,
    UpdateCustomMetric,
    ListCustomMetrics,
    CreateDimension,
    DeleteDimension,
    DescribeDimension,
    UpdateDimension,
    ListDimensions,
    StartDetectMitigationActionsTask,
    CancelDetectMitigationActionsTask,
    DescribeDetectMitigationActionsTask,
    ListDetectMitigationActionsTasks,
    ListDetectMitigationActionsExecutions,
    ListActiveViolations,
    ListViolationEvents,
    PutVerificationStateOnViolation,
    GetBehaviorModelTrainingSummaries,
  },
  model,
} as const satisfies ServiceDefinition;
