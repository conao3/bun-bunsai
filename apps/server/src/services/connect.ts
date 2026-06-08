import { callerArn } from "../core/arn.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import connectModel from "../../../../test/vendor/aws-models/connect.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(connectModel);

const instancePrefix = "instance:" as const;
const phoneNumberPrefix = "phone-number:" as const;
const agentStatusPrefix = "agent-status:" as const;
const contactFlowPrefix = "contact-flow:" as const;
const contactFlowModulePrefix = "contact-flow-module:" as const;
const queuePrefix = "queue:" as const;
const routingProfilePrefix = "routing-profile:" as const;
const hoursOfOperationPrefix = "hours-of-operation:" as const;
const securityProfilePrefix = "security-profile:" as const;
const quickConnectPrefix = "quick-connect:" as const;
const evaluationFormPrefix = "evaluation-form:" as const;
const contactPrefix = "contact:" as const;
const emailAddressPrefix = "email-address:" as const;
const dataTablePrefix = "data-table:" as const;
const dataTableAttributePrefix = "data-table-attribute:" as const;
const contactFlowModuleAliasPrefix = "contact-flow-module-alias:" as const;
const hoursOfOperationOverridePrefix = "hours-of-operation-override:" as const;
const instanceStorageConfigPrefix = "instance-storage-config:" as const;
const userPrefix = "user:" as const;
const userHierarchyGroupPrefix = "user-hierarchy-group:" as const;
const viewPrefix = "view:" as const;
const vocabularyPrefix = "vocabulary:" as const;
const workspacePrefix = "workspace:" as const;
const dataTableValuePrefix = "data-table-value:" as const;
const notificationPrefix = "notification:" as const;
const promptPrefix = "prompt:" as const;
const rulePrefix = "rule:" as const;
const testCasePrefix = "test-case:" as const;
const trafficDistributionGroupPrefix = "traffic-distribution-group:" as const;
const predefinedAttributePrefix = "predefined-attribute:" as const;
const resourceTagsPrefix = "resource-tags:" as const;

type StoredInstance = {
  Id: string;
  Arn: string;
  IdentityManagementType: string;
  InstanceAlias: string | undefined;
  CreatedTime: number;
  ServiceRole: string;
  InstanceStatus: string;
  InboundCallsEnabled: boolean;
  OutboundCallsEnabled: boolean;
  InstanceAccessUrl: string;
};

type StoredPhoneNumber = {
  PhoneNumberId: string;
  PhoneNumberArn: string;
  PhoneNumber: string;
  InstanceId: string | undefined;
  ContactFlowId: string | undefined;
};

type StoredAgentStatus = {
  AgentStatusId: string;
  AgentStatusARN: string;
  Name: string;
  State: string;
  InstanceId: string;
};

type StoredContactFlow = {
  ContactFlowId: string;
  ContactFlowArn: string;
  Name: string;
  Type: string;
  InstanceId: string;
};

type StoredContactFlowModule = {
  Id: string;
  Arn: string;
  Name: string;
  InstanceId: string;
};

type StoredQueue = {
  QueueId: string;
  QueueArn: string;
  Name: string;
  InstanceId: string;
};

type StoredRoutingProfile = {
  RoutingProfileId: string;
  RoutingProfileArn: string;
  Name: string;
  InstanceId: string;
};

type StoredHoursOfOperation = {
  HoursOfOperationId: string;
  HoursOfOperationArn: string;
  Name: string;
  InstanceId: string;
};

type StoredSecurityProfile = {
  SecurityProfileId: string;
  SecurityProfileArn: string;
  SecurityProfileName: string;
  InstanceId: string;
};

type StoredQuickConnect = {
  QuickConnectId: string;
  QuickConnectARN: string;
  Name: string;
  InstanceId: string;
};

type StoredEvaluationForm = {
  EvaluationFormId: string;
  EvaluationFormArn: string;
  InstanceId: string;
};

type StoredContact = {
  ContactId: string;
  ContactArn: string;
  InstanceId: string;
  TotalPauseCount: number;
  LastPausedTimestamp?: string;
  LastResumedTimestamp?: string;
  RecordingEnabled?: boolean;
  RecordingSuspended?: boolean;
  StreamingId?: string;
  Stopped?: boolean;
  Tags?: Record<string, string>;
};

type StoredEmailAddress = {
  EmailAddressId: string;
  EmailAddressArn: string;
  EmailAddress: string;
  InstanceId: string;
};

type StoredDataTable = {
  Id: string;
  Arn: string;
  InstanceId: string;
};

type StoredDataTableAttribute = {
  Name: string;
  AttributeId: string;
  DataTableId: string;
  InstanceId: string;
};

type StoredContactFlowModuleAlias = {
  Id: string;
  ContactFlowModuleArn: string;
  InstanceId: string;
  ContactFlowModuleId: string;
};

type StoredHoursOfOperationOverride = {
  HoursOfOperationOverrideId: string;
  HoursOfOperationId: string;
  InstanceId: string;
};

type StoredInstanceStorageConfig = {
  AssociationId: string;
  InstanceId: string;
  ResourceType: string;
};

type StoredUser = {
  UserId: string;
  UserArn: string;
  Username: string;
  InstanceId: string;
  AgentStatusId?: string;
};

type StoredUserHierarchyGroup = {
  HierarchyGroupId: string;
  HierarchyGroupArn: string;
  Name: string;
  InstanceId: string;
};

type StoredView = {
  Id: string;
  Arn: string;
  Name: string;
  Status: string;
  InstanceId: string;
};

type StoredVocabulary = {
  VocabularyId: string;
  VocabularyArn: string;
  VocabularyName: string;
  InstanceId: string;
};

type StoredWorkspace = {
  WorkspaceId: string;
  WorkspaceArn: string;
  Name: string;
  InstanceId: string;
};

type StoredDataTableValue = {
  InstanceId: string;
  DataTableId: string;
  Key: string;
  Value: Record<string, unknown>;
};

type StoredNotification = {
  NotificationId: string;
  NotificationArn: string;
  InstanceId: string;
};

type StoredPrompt = {
  PromptId: string;
  PromptArn: string;
  Name: string;
  InstanceId: string;
};

type StoredRule = {
  RuleId: string;
  RuleArn: string;
  InstanceId: string;
};

type StoredTestCase = {
  TestCaseId: string;
  TestCaseArn: string;
  InstanceId: string;
};

type StoredTrafficDistributionGroup = {
  Id: string;
  Arn: string;
};

type StoredPredefinedAttribute = {
  Name: string;
  InstanceId: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const booleanValue = (value: unknown): boolean =>
  typeof value === "boolean" ? value : false;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidRequestException", `${field} is required.`, 400);
  }
  return value;
};

const instanceKey = (id: string): string => `${instancePrefix}${id}`;
const phoneNumberKey = (id: string): string => `${phoneNumberPrefix}${id}`;
const agentStatusKey = (instanceId: string, statusId: string): string =>
  `${agentStatusPrefix}${instanceId}:${statusId}`;
const contactFlowKey = (instanceId: string, id: string): string =>
  `${contactFlowPrefix}${instanceId}:${id}`;
const contactFlowModuleKey = (instanceId: string, id: string): string =>
  `${contactFlowModulePrefix}${instanceId}:${id}`;
const queueKey = (instanceId: string, id: string): string =>
  `${queuePrefix}${instanceId}:${id}`;
const routingProfileKey = (instanceId: string, id: string): string =>
  `${routingProfilePrefix}${instanceId}:${id}`;
const hoursOfOperationKey = (instanceId: string, id: string): string =>
  `${hoursOfOperationPrefix}${instanceId}:${id}`;
const securityProfileKey = (instanceId: string, id: string): string =>
  `${securityProfilePrefix}${instanceId}:${id}`;
const quickConnectKey = (instanceId: string, id: string): string =>
  `${quickConnectPrefix}${instanceId}:${id}`;
const evaluationFormKey = (instanceId: string, id: string): string =>
  `${evaluationFormPrefix}${instanceId}:${id}`;
const contactKey = (instanceId: string, id: string): string =>
  `${contactPrefix}${instanceId}:${id}`;
const emailAddressKey = (instanceId: string, id: string): string =>
  `${emailAddressPrefix}${instanceId}:${id}`;
const dataTableKey = (instanceId: string, id: string): string =>
  `${dataTablePrefix}${instanceId}:${id}`;
const dataTableAttributeKey = (
  instanceId: string,
  tableId: string,
  name: string,
): string => `${dataTableAttributePrefix}${instanceId}:${tableId}:${name}`;
const contactFlowModuleAliasKey = (
  instanceId: string,
  moduleId: string,
  aliasId: string,
): string =>
  `${contactFlowModuleAliasPrefix}${instanceId}:${moduleId}:${aliasId}`;
const hoursOfOperationOverrideKey = (
  instanceId: string,
  hooId: string,
  overrideId: string,
): string =>
  `${hoursOfOperationOverridePrefix}${instanceId}:${hooId}:${overrideId}`;
const instanceStorageConfigKey = (
  instanceId: string,
  associationId: string,
): string => `${instanceStorageConfigPrefix}${instanceId}:${associationId}`;
const userKey = (instanceId: string, userId: string): string =>
  `${userPrefix}${instanceId}:${userId}`;
const userHierarchyGroupKey = (instanceId: string, id: string): string =>
  `${userHierarchyGroupPrefix}${instanceId}:${id}`;
const viewKey = (instanceId: string, id: string): string =>
  `${viewPrefix}${instanceId}:${id}`;
const vocabularyKey = (instanceId: string, id: string): string =>
  `${vocabularyPrefix}${instanceId}:${id}`;
const workspaceKey = (instanceId: string, id: string): string =>
  `${workspacePrefix}${instanceId}:${id}`;
const dataTableValueKey = (
  instanceId: string,
  tableId: string,
  key: string,
): string => `${dataTableValuePrefix}${instanceId}:${tableId}:${key}`;
const notificationKey = (instanceId: string, id: string): string =>
  `${notificationPrefix}${instanceId}:${id}`;
const promptKey = (instanceId: string, id: string): string =>
  `${promptPrefix}${instanceId}:${id}`;
const ruleKey = (instanceId: string, id: string): string =>
  `${rulePrefix}${instanceId}:${id}`;
const testCaseKey = (instanceId: string, id: string): string =>
  `${testCasePrefix}${instanceId}:${id}`;
const trafficDistributionGroupKey = (id: string): string =>
  `${trafficDistributionGroupPrefix}${id}`;
const predefinedAttributeKey = (instanceId: string, name: string): string =>
  `${predefinedAttributePrefix}${instanceId}:${name}`;
const resourceTagsKey = (arn: string): string => `${resourceTagsPrefix}${arn}`;

const requireInstance = (ctx: ServiceContext, id: string): StoredInstance => {
  const stored = ctx.store.get<StoredInstance>(instanceKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Instance ${id} not found.`,
      404,
    );
  }
  return stored;
};

const instanceView = (instance: StoredInstance): Record<string, unknown> => ({
  Id: instance.Id,
  Arn: instance.Arn,
  IdentityManagementType: instance.IdentityManagementType,
  InstanceAlias: instance.InstanceAlias,
  CreatedTime: instance.CreatedTime,
  ServiceRole: instance.ServiceRole,
  InstanceStatus: instance.InstanceStatus,
  InboundCallsEnabled: instance.InboundCallsEnabled,
  OutboundCallsEnabled: instance.OutboundCallsEnabled,
  InstanceAccessUrl: instance.InstanceAccessUrl,
});

const instanceSummary = (
  instance: StoredInstance,
): Record<string, unknown> => ({
  Id: instance.Id,
  Arn: instance.Arn,
  IdentityManagementType: instance.IdentityManagementType,
  InstanceAlias: instance.InstanceAlias,
  CreatedTime: instance.CreatedTime,
  ServiceRole: instance.ServiceRole,
  InstanceStatus: instance.InstanceStatus,
  InboundCallsEnabled: instance.InboundCallsEnabled,
  OutboundCallsEnabled: instance.OutboundCallsEnabled,
  InstanceAccessUrl: instance.InstanceAccessUrl,
});

const CreateInstance: OperationHandler = (input, ctx) => {
  const identityManagementType = requireString(input, "IdentityManagementType");
  const inbound = booleanValue(input["InboundCallsEnabled"]);
  const outbound = booleanValue(input["OutboundCallsEnabled"]);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${id}`;
  const alias = stringOrUndefined(input["InstanceAlias"]);
  const instance: StoredInstance = {
    Id: id,
    Arn: arn,
    IdentityManagementType: identityManagementType,
    InstanceAlias: alias,
    CreatedTime: Date.now() / 1000,
    ServiceRole: `arn:aws:iam::${ctx.account}:role/aws-service-role/connect.amazonaws.com/AWSServiceRoleForAmazonConnect_${id}`,
    InstanceStatus: "ACTIVE",
    InboundCallsEnabled: inbound,
    OutboundCallsEnabled: outbound,
    InstanceAccessUrl: `https://${alias ?? id}.my.connect.aws`,
  };
  ctx.store.set(instanceKey(id), instance);
  return {
    Id: id,
    Arn: arn,
  };
};

const DescribeInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InstanceId");
  const instance = requireInstance(ctx, id);
  return { Instance: instanceView(instance) };
};

const ListInstances: OperationHandler = (_input, ctx) => {
  const instances = ctx.store
    .list<StoredInstance>()
    .filter((entry) => entry.key.startsWith(instancePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0));
  return { InstanceSummaryList: instances.map(instanceSummary) };
};

const DeleteInstance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "InstanceId");
  requireInstance(ctx, id);
  ctx.store.delete(instanceKey(id));
  return {};
};

const DeleteAttachedFile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteContactEvaluation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteContactFlow: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowId = requireString(input, "ContactFlowId");
  const stored = ctx.store.get<StoredContactFlow>(
    contactFlowKey(instanceId, contactFlowId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlow ${contactFlowId} not found.`,
      404,
    );
  }
  ctx.store.delete(contactFlowKey(instanceId, contactFlowId));
  return {};
};

const DeleteContactFlowModule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowModuleId = requireString(input, "ContactFlowModuleId");
  const stored = ctx.store.get<StoredContactFlowModule>(
    contactFlowModuleKey(instanceId, contactFlowModuleId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModule ${contactFlowModuleId} not found.`,
      404,
    );
  }
  ctx.store.delete(contactFlowModuleKey(instanceId, contactFlowModuleId));
  return {};
};

const DeleteContactFlowModuleAlias: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowModuleId = requireString(input, "ContactFlowModuleId");
  const aliasId = requireString(input, "AliasId");
  const stored = ctx.store.get<StoredContactFlowModuleAlias>(
    contactFlowModuleAliasKey(instanceId, contactFlowModuleId, aliasId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModuleAlias ${aliasId} not found.`,
      404,
    );
  }
  ctx.store.delete(
    contactFlowModuleAliasKey(instanceId, contactFlowModuleId, aliasId),
  );
  return {};
};

const DeleteContactFlowModuleVersion: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteContactFlowVersion: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteDataTable: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const stored = ctx.store.get<StoredDataTable>(
    dataTableKey(instanceId, dataTableId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataTable ${dataTableId} not found.`,
      404,
    );
  }
  ctx.store.delete(dataTableKey(instanceId, dataTableId));
  return {};
};

const DeleteDataTableAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const attributeName = requireString(input, "AttributeName");
  const stored = ctx.store.get<StoredDataTableAttribute>(
    dataTableAttributeKey(instanceId, dataTableId, attributeName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataTableAttribute ${attributeName} not found.`,
      404,
    );
  }
  ctx.store.delete(
    dataTableAttributeKey(instanceId, dataTableId, attributeName),
  );
  return {};
};

const DeleteEmailAddress: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const emailAddressId = requireString(input, "EmailAddressId");
  const stored = ctx.store.get<StoredEmailAddress>(
    emailAddressKey(instanceId, emailAddressId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `EmailAddress ${emailAddressId} not found.`,
      404,
    );
  }
  ctx.store.delete(emailAddressKey(instanceId, emailAddressId));
  return {};
};

const DeleteEvaluationForm: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const evaluationFormId = requireString(input, "EvaluationFormId");
  const stored = ctx.store.get<StoredEvaluationForm>(
    evaluationFormKey(instanceId, evaluationFormId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `EvaluationForm ${evaluationFormId} not found.`,
      404,
    );
  }
  ctx.store.delete(evaluationFormKey(instanceId, evaluationFormId));
  return {};
};

const DeleteHoursOfOperation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hoursOfOperationId = requireString(input, "HoursOfOperationId");
  const stored = ctx.store.get<StoredHoursOfOperation>(
    hoursOfOperationKey(instanceId, hoursOfOperationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `HoursOfOperation ${hoursOfOperationId} not found.`,
      404,
    );
  }
  ctx.store.delete(hoursOfOperationKey(instanceId, hoursOfOperationId));
  return {};
};

const DeleteHoursOfOperationOverride: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hooId = requireString(input, "HoursOfOperationId");
  const overrideId = requireString(input, "HoursOfOperationOverrideId");
  const stored = ctx.store.get<StoredHoursOfOperationOverride>(
    hoursOfOperationOverrideKey(instanceId, hooId, overrideId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `HoursOfOperationOverride ${overrideId} not found.`,
      404,
    );
  }
  ctx.store.delete(hoursOfOperationOverrideKey(instanceId, hooId, overrideId));
  return {};
};

const DeleteIntegrationAssociation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteNotification: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeletePredefinedAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeletePrompt: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeletePushNotificationRegistration: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteQueue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const queueId = requireString(input, "QueueId");
  const stored = ctx.store.get<StoredQueue>(queueKey(instanceId, queueId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Queue ${queueId} not found.`,
      404,
    );
  }
  ctx.store.delete(queueKey(instanceId, queueId));
  return {};
};

const DeleteQuickConnect: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const quickConnectId = requireString(input, "QuickConnectId");
  const stored = ctx.store.get<StoredQuickConnect>(
    quickConnectKey(instanceId, quickConnectId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `QuickConnect ${quickConnectId} not found.`,
      404,
    );
  }
  ctx.store.delete(quickConnectKey(instanceId, quickConnectId));
  return {};
};

const DeleteRoutingProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const routingProfileId = requireString(input, "RoutingProfileId");
  const stored = ctx.store.get<StoredRoutingProfile>(
    routingProfileKey(instanceId, routingProfileId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `RoutingProfile ${routingProfileId} not found.`,
      404,
    );
  }
  ctx.store.delete(routingProfileKey(instanceId, routingProfileId));
  return {};
};

const DeleteRule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteSecurityProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const securityProfileId = requireString(input, "SecurityProfileId");
  const stored = ctx.store.get<StoredSecurityProfile>(
    securityProfileKey(instanceId, securityProfileId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `SecurityProfile ${securityProfileId} not found.`,
      404,
    );
  }
  ctx.store.delete(securityProfileKey(instanceId, securityProfileId));
  return {};
};

const DeleteTaskTemplate: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteTestCase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteTrafficDistributionGroup: OperationHandler = (_input, _ctx) => {
  return {};
};

const DeleteUseCase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const userId = requireString(input, "UserId");
  const stored = ctx.store.get<StoredUser>(userKey(instanceId, userId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User ${userId} not found.`,
      404,
    );
  }
  ctx.store.delete(userKey(instanceId, userId));
  return {};
};

const DeleteUserHierarchyGroup: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hierarchyGroupId = requireString(input, "HierarchyGroupId");
  const stored = ctx.store.get<StoredUserHierarchyGroup>(
    userHierarchyGroupKey(instanceId, hierarchyGroupId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `UserHierarchyGroup ${hierarchyGroupId} not found.`,
      404,
    );
  }
  ctx.store.delete(userHierarchyGroupKey(instanceId, hierarchyGroupId));
  return {};
};

const DeleteView: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const viewId = requireString(input, "ViewId");
  const stored = ctx.store.get<StoredView>(viewKey(instanceId, viewId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `View ${viewId} not found.`,
      404,
    );
  }
  ctx.store.delete(viewKey(instanceId, viewId));
  return {};
};

const DeleteViewVersion: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteVocabulary: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const vocabularyId = requireString(input, "VocabularyId");
  const stored = ctx.store.get<StoredVocabulary>(
    vocabularyKey(instanceId, vocabularyId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Vocabulary ${vocabularyId} not found.`,
      404,
    );
  }
  ctx.store.delete(vocabularyKey(instanceId, vocabularyId));
  return {
    VocabularyArn: stored.VocabularyArn,
    VocabularyId: stored.VocabularyId,
    State: "DELETE_IN_PROGRESS",
  };
};

const DeleteWorkspace: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const workspaceId = requireString(input, "WorkspaceId");
  const stored = ctx.store.get<StoredWorkspace>(
    workspaceKey(instanceId, workspaceId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Workspace ${workspaceId} not found.`,
      404,
    );
  }
  ctx.store.delete(workspaceKey(instanceId, workspaceId));
  return {};
};

const DeleteWorkspaceMedia: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const ActivateEvaluationForm: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const formId = requireString(input, "EvaluationFormId");
  const version =
    typeof input["EvaluationFormVersion"] === "number"
      ? input["EvaluationFormVersion"]
      : 1;
  return {
    EvaluationFormId: formId,
    EvaluationFormArn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/evaluation-form/${formId}`,
    EvaluationFormVersion: version,
  };
};

const DeactivateEvaluationForm: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const formId = requireString(input, "EvaluationFormId");
  const version =
    typeof input["EvaluationFormVersion"] === "number"
      ? input["EvaluationFormVersion"]
      : 1;
  return {
    EvaluationFormId: formId,
    EvaluationFormArn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/evaluation-form/${formId}`,
    EvaluationFormVersion: version,
  };
};

const AssociateAnalyticsDataSet: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataSetId = requireString(input, "DataSetId");
  const targetAccountId =
    typeof input["TargetAccountId"] === "string"
      ? input["TargetAccountId"]
      : ctx.account;
  const shareId = crypto.randomUUID();
  return {
    DataSetId: dataSetId,
    TargetAccountId: targetAccountId,
    ResourceShareId: shareId,
    ResourceShareArn: `arn:aws:ram:${ctx.region}:${ctx.account}:resource-share/${shareId}`,
  };
};

const AssociateApprovedOrigin: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateBot: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateContactWithUser: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateDefaultVocabulary: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateEmailAddressAlias: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateFlow: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateHoursOfOperations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateInstanceStorageConfig: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const resourceType =
    typeof input["ResourceType"] === "string"
      ? input["ResourceType"]
      : "CHAT_TRANSCRIPTS";
  const associationId = crypto.randomUUID();
  const stored: StoredInstanceStorageConfig = {
    AssociationId: associationId,
    InstanceId: instanceId,
    ResourceType: resourceType,
  };
  ctx.store.set(instanceStorageConfigKey(instanceId, associationId), stored);
  return { AssociationId: associationId };
};

const AssociateLambdaFunction: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateLexBot: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociatePhoneNumberContactFlow: OperationHandler = (input, ctx) => {
  const phoneNumberId = requireString(input, "PhoneNumberId");
  const contactFlowId = requireString(input, "ContactFlowId");
  const stored = ctx.store.get<StoredPhoneNumber>(
    phoneNumberKey(phoneNumberId),
  );
  if (stored !== undefined) {
    ctx.store.set(phoneNumberKey(phoneNumberId), {
      ...stored,
      ContactFlowId: contactFlowId,
    });
  }
  return {};
};

const AssociateQueueEmailAddresses: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateQueueQuickConnects: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateRoutingProfileQueues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateSecurityKey: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { AssociationId: crypto.randomUUID() };
};

const AssociateSecurityProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const AssociateTrafficDistributionGroupUser: OperationHandler = (
  _input,
  _ctx,
) => {
  return {};
};

const AssociateUserProficiencies: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const BatchAssociateAnalyticsDataSet: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataSetIds = Array.isArray(input["DataSetIds"])
    ? (input["DataSetIds"] as string[])
    : [];
  const targetAccountId =
    typeof input["TargetAccountId"] === "string"
      ? input["TargetAccountId"]
      : ctx.account;
  const created = dataSetIds.map((id) => {
    const shareId = crypto.randomUUID();
    return {
      DataSetId: id,
      TargetAccountId: targetAccountId,
      ResourceShareId: shareId,
      ResourceShareArn: `arn:aws:ram:${ctx.region}:${ctx.account}:resource-share/${shareId}`,
      ResourceShareStatus: "ACTIVE",
    };
  });
  return { Created: created, Errors: [] };
};

const BatchDisassociateAnalyticsDataSet: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataSetIds = Array.isArray(input["DataSetIds"])
    ? (input["DataSetIds"] as string[])
    : [];
  return { Deleted: dataSetIds, Errors: [] };
};

const BatchGetAttachedFileMetadata: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Files: [], Errors: [] };
};

const BatchGetFlowAssociation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { FlowAssociationSummaryList: [] };
};

const ClaimPhoneNumber: OperationHandler = (input, ctx) => {
  const phoneNumber = requireString(input, "PhoneNumber");
  const instanceId = stringOrUndefined(input["InstanceId"]);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:phone-number/${id}`;
  const stored: StoredPhoneNumber = {
    PhoneNumberId: id,
    PhoneNumberArn: arn,
    PhoneNumber: phoneNumber,
    InstanceId: instanceId,
    ContactFlowId: undefined,
  };
  ctx.store.set(phoneNumberKey(id), stored);
  return { PhoneNumberId: id, PhoneNumberArn: arn };
};

const CompleteAttachedFileUpload: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const CreateAgentStatus: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const state = typeof input["State"] === "string" ? input["State"] : "ENABLED";
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/agent-state/${id}`;
  const stored: StoredAgentStatus = {
    AgentStatusId: id,
    AgentStatusARN: arn,
    Name: name,
    State: state,
    InstanceId: instanceId,
  };
  ctx.store.set(agentStatusKey(instanceId, id), stored);
  return { AgentStatusARN: arn, AgentStatusId: id };
};

const CreateContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return { ContactId: id, ContactArn: arn };
};

const CreateContactFlow: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const type =
    typeof input["Type"] === "string" ? input["Type"] : "CONTACT_FLOW";
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact-flow/${id}`;
  const stored: StoredContactFlow = {
    ContactFlowId: id,
    ContactFlowArn: arn,
    Name: name,
    Type: type,
    InstanceId: instanceId,
  };
  ctx.store.set(contactFlowKey(instanceId, id), stored);
  return {
    ContactFlowId: id,
    ContactFlowArn: arn,
    FlowContentSha256: crypto.randomUUID(),
  };
};

const CreateContactFlowModule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/flow-module/${id}`;
  const stored: StoredContactFlowModule = {
    Id: id,
    Arn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(contactFlowModuleKey(instanceId, id), stored);
  return { Id: id, Arn: arn };
};

const CreateContactFlowModuleAlias: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const moduleId = requireString(input, "ContactFlowModuleId");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/flow-module/${moduleId}`;
  const stored: StoredContactFlowModuleAlias = {
    Id: id,
    ContactFlowModuleArn: arn,
    InstanceId: instanceId,
    ContactFlowModuleId: moduleId,
  };
  ctx.store.set(contactFlowModuleAliasKey(instanceId, moduleId, id), stored);
  return { ContactFlowModuleArn: arn, Id: id };
};

const CreateContactFlowModuleVersion: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const moduleId = requireString(input, "ContactFlowModuleId");
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/flow-module/${moduleId}`;
  return { ContactFlowModuleArn: arn, Version: 1 };
};

const CreateContactFlowVersion: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const flowId = requireString(input, "ContactFlowId");
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact-flow/${flowId}`;
  return { ContactFlowArn: arn, Version: 1 };
};

const CreateDataTable: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/data-table/${id}`;
  const stored: StoredDataTable = { Id: id, Arn: arn, InstanceId: instanceId };
  ctx.store.set(dataTableKey(instanceId, id), stored);
  return { Id: id, Arn: arn, LockVersion: 1 };
};

const CreateDataTableAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const name = requireString(input, "Name");
  const attributeId = crypto.randomUUID();
  const stored: StoredDataTableAttribute = {
    Name: name,
    AttributeId: attributeId,
    DataTableId: dataTableId,
    InstanceId: instanceId,
  };
  ctx.store.set(dataTableAttributeKey(instanceId, dataTableId, name), stored);
  return { Name: name, AttributeId: attributeId, LockVersion: 1 };
};

const CreateEmailAddress: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const emailAddress = requireString(input, "EmailAddress");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/email-address/${id}`;
  const stored: StoredEmailAddress = {
    EmailAddressId: id,
    EmailAddressArn: arn,
    EmailAddress: emailAddress,
    InstanceId: instanceId,
  };
  ctx.store.set(emailAddressKey(instanceId, id), stored);
  return { EmailAddressId: id, EmailAddressArn: arn };
};

const CreateEvaluationForm: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/evaluation-form/${id}`;
  const stored: StoredEvaluationForm = {
    EvaluationFormId: id,
    EvaluationFormArn: arn,
    InstanceId: instanceId,
  };
  ctx.store.set(evaluationFormKey(instanceId, id), stored);
  return { EvaluationFormId: id, EvaluationFormArn: arn };
};

const CreateHoursOfOperation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/operating-hours/${id}`;
  const stored: StoredHoursOfOperation = {
    HoursOfOperationId: id,
    HoursOfOperationArn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(hoursOfOperationKey(instanceId, id), stored);
  return { HoursOfOperationId: id, HoursOfOperationArn: arn };
};

const CreateHoursOfOperationOverride: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hooId = requireString(input, "HoursOfOperationId");
  const overrideId = crypto.randomUUID();
  const stored: StoredHoursOfOperationOverride = {
    HoursOfOperationOverrideId: overrideId,
    HoursOfOperationId: hooId,
    InstanceId: instanceId,
  };
  ctx.store.set(
    hoursOfOperationOverrideKey(instanceId, hooId, overrideId),
    stored,
  );
  return { HoursOfOperationOverrideId: overrideId };
};

const CreateIntegrationAssociation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/integration-association/${id}`;
  return { IntegrationAssociationId: id, IntegrationAssociationArn: arn };
};

const CreateNotification: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/notification/${id}`;
  const stored: StoredNotification = {
    NotificationId: id,
    NotificationArn: arn,
    InstanceId: instanceId,
  };
  ctx.store.set(notificationKey(instanceId, id), stored);
  return { NotificationId: id, NotificationArn: arn };
};

const CreateParticipant: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const participantId = crypto.randomUUID();
  return {
    ParticipantCredentials: {
      ParticipantToken: crypto.randomUUID(),
      Expiry: new Date(Date.now() + 3600000).toISOString(),
    },
    ParticipantId: participantId,
  };
};

const CreatePersistentContactAssociation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const continuedContactId = crypto.randomUUID();
  return { ContinuedFromContactId: continuedContactId };
};

const CreatePredefinedAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const stored: StoredPredefinedAttribute = {
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(predefinedAttributeKey(instanceId, name), stored);
  return {};
};

const CreatePrompt: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/prompt/${id}`;
  const stored: StoredPrompt = {
    PromptId: id,
    PromptArn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(promptKey(instanceId, id), stored);
  return { PromptARN: arn, PromptId: id };
};

const CreatePushNotificationRegistration: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const registrationId = crypto.randomUUID();
  return { RegistrationId: registrationId };
};

const CreateQueue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/queue/${id}`;
  const stored: StoredQueue = {
    QueueId: id,
    QueueArn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(queueKey(instanceId, id), stored);
  return { QueueArn: arn, QueueId: id };
};

const CreateQuickConnect: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/transfer-destination/${id}`;
  const stored: StoredQuickConnect = {
    QuickConnectId: id,
    QuickConnectARN: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(quickConnectKey(instanceId, id), stored);
  return { QuickConnectARN: arn, QuickConnectId: id };
};

const CreateRoutingProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/routing-profile/${id}`;
  const stored: StoredRoutingProfile = {
    RoutingProfileId: id,
    RoutingProfileArn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(routingProfileKey(instanceId, id), stored);
  return { RoutingProfileArn: arn, RoutingProfileId: id };
};

const CreateRule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/rule/${id}`;
  const stored: StoredRule = {
    RuleId: id,
    RuleArn: arn,
    InstanceId: instanceId,
  };
  ctx.store.set(ruleKey(instanceId, id), stored);
  return { RuleArn: arn, RuleId: id };
};

const CreateSecurityProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const profileName = requireString(input, "SecurityProfileName");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/security-profile/${id}`;
  const stored: StoredSecurityProfile = {
    SecurityProfileId: id,
    SecurityProfileArn: arn,
    SecurityProfileName: profileName,
    InstanceId: instanceId,
  };
  ctx.store.set(securityProfileKey(instanceId, id), stored);
  return { SecurityProfileId: id, SecurityProfileArn: arn };
};

const CreateTaskTemplate: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/task-template/${id}`;
  return { Id: id, Arn: arn };
};

const CreateTestCase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/test-case/${id}`;
  const stored: StoredTestCase = {
    TestCaseId: id,
    TestCaseArn: arn,
    InstanceId: instanceId,
  };
  ctx.store.set(testCaseKey(instanceId, id), stored);
  return { TestCaseId: id, TestCaseArn: arn };
};

const CreateTrafficDistributionGroup: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:traffic-distribution-group/${id}`;
  const stored: StoredTrafficDistributionGroup = { Id: id, Arn: arn };
  ctx.store.set(trafficDistributionGroupKey(id), stored);
  return { Id: id, Arn: arn };
};

const CreateUseCase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/use-case/${id}`;
  return { UseCaseId: id, UseCaseArn: arn };
};

const AssociateWorkspace: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { SuccessfulList: [], FailedList: [] };
};

const BatchCreateDataTableValue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const values = Array.isArray(input["Values"])
    ? (input["Values"] as Array<Record<string, unknown>>)
    : [];
  const successful = values.map((v) => {
    const key = typeof v["Key"] === "string" ? v["Key"] : crypto.randomUUID();
    const stored: StoredDataTableValue = {
      InstanceId: instanceId,
      DataTableId: dataTableId,
      Key: key,
      Value: v,
    };
    ctx.store.set(dataTableValueKey(instanceId, dataTableId, key), stored);
    return { Key: key };
  });
  return { Successful: successful, Failed: [] };
};

const BatchDeleteDataTableValue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const values = Array.isArray(input["Values"])
    ? (input["Values"] as Array<Record<string, unknown>>)
    : [];
  const successful = values.map((v) => {
    const key = typeof v["Key"] === "string" ? v["Key"] : "";
    ctx.store.delete(dataTableValueKey(instanceId, dataTableId, key));
    return { Key: key };
  });
  return { Successful: successful, Failed: [] };
};

const BatchDescribeDataTableValue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const values = Array.isArray(input["Values"])
    ? (input["Values"] as Array<Record<string, unknown>>)
    : [];
  const successful = values.map((v) => {
    const key = typeof v["Key"] === "string" ? v["Key"] : "";
    const stored = ctx.store.get<StoredDataTableValue>(
      dataTableValueKey(instanceId, dataTableId, key),
    );
    return stored ?? { Key: key };
  });
  return { Successful: successful, Failed: [] };
};

const BatchPutContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contacts = Array.isArray(input["ContactDataRequestList"])
    ? (input["ContactDataRequestList"] as Array<Record<string, unknown>>)
    : [];
  const successful = contacts.map(() => {
    const id = crypto.randomUUID();
    return { RequestIdentifier: id, ContactId: id };
  });
  return { SuccessfulRequestList: successful, FailedRequestList: [] };
};

const BatchUpdateDataTableValue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const values = Array.isArray(input["Values"])
    ? (input["Values"] as Array<Record<string, unknown>>)
    : [];
  const successful = values.map((v) => {
    const key = typeof v["Key"] === "string" ? v["Key"] : "";
    const existing = ctx.store.get<StoredDataTableValue>(
      dataTableValueKey(instanceId, dataTableId, key),
    );
    const updated: StoredDataTableValue = {
      InstanceId: instanceId,
      DataTableId: dataTableId,
      Key: key,
      Value: { ...(existing?.Value ?? {}), ...v },
    };
    ctx.store.set(dataTableValueKey(instanceId, dataTableId, key), updated);
    return { Key: key };
  });
  return { Successful: successful, Failed: [] };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const username = requireString(input, "Username");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/agent/${id}`;
  const stored: StoredUser = {
    UserId: id,
    UserArn: arn,
    Username: username,
    InstanceId: instanceId,
  };
  ctx.store.set(userKey(instanceId, id), stored);
  return { UserId: id, UserArn: arn };
};

const CreateUserHierarchyGroup: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/agent-group/${id}`;
  const stored: StoredUserHierarchyGroup = {
    HierarchyGroupId: id,
    HierarchyGroupArn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(userHierarchyGroupKey(instanceId, id), stored);
  return { HierarchyGroupId: id, HierarchyGroupArn: arn };
};

const CreateView: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const status =
    typeof input["Status"] === "string" ? input["Status"] : "SAVED";
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/view/${id}`;
  const stored: StoredView = {
    Id: id,
    Arn: arn,
    Name: name,
    Status: status,
    InstanceId: instanceId,
  };
  ctx.store.set(viewKey(instanceId, id), stored);
  return {
    View: {
      Id: id,
      Arn: arn,
      Name: name,
      Status: status,
      Version: 1,
      ViewContentSha256: crypto.randomUUID(),
    },
  };
};

const CreateViewVersion: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const viewId = requireString(input, "ViewId");
  const stored = ctx.store.get<StoredView>(viewKey(instanceId, viewId));
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/view/${viewId}`;
  return {
    View: {
      Id: viewId,
      Arn: arn,
      Name: stored?.Name ?? "",
      Status: stored?.Status ?? "SAVED",
      Version: 1,
      ViewContentSha256: crypto.randomUUID(),
    },
  };
};

const CreateVocabulary: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const vocabularyName = requireString(input, "VocabularyName");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/vocabulary/${id}`;
  const stored: StoredVocabulary = {
    VocabularyId: id,
    VocabularyArn: arn,
    VocabularyName: vocabularyName,
    InstanceId: instanceId,
  };
  ctx.store.set(vocabularyKey(instanceId, id), stored);
  return {
    VocabularyArn: arn,
    VocabularyId: id,
    State: "CREATION_IN_PROGRESS",
  };
};

const CreateWorkspace: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/workspace/${id}`;
  const stored: StoredWorkspace = {
    WorkspaceId: id,
    WorkspaceArn: arn,
    Name: name,
    InstanceId: instanceId,
  };
  ctx.store.set(workspaceKey(instanceId, id), stored);
  return { WorkspaceId: id, WorkspaceArn: arn };
};

const CreateWorkspacePage: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DescribeAgentStatus: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const agentStatusId = requireString(input, "AgentStatusId");
  const stored = ctx.store.get<StoredAgentStatus>(
    agentStatusKey(instanceId, agentStatusId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AgentStatus ${agentStatusId} not found.`,
      404,
    );
  }
  return {
    AgentStatus: {
      AgentStatusId: stored.AgentStatusId,
      AgentStatusARN: stored.AgentStatusARN,
      Name: stored.Name,
      State: stored.State,
      Type: "CUSTOM",
    },
  };
};

const DescribeAttachedFilesConfiguration: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const attachmentScope = requireString(input, "AttachmentScope");
  return {
    AttachedFilesConfiguration: {
      S3Config: {
        BucketName: `connect-${instanceId}`,
        BucketPrefix: attachmentScope,
      },
    },
  };
};

const DescribeAuthenticationProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const authenticationProfileId = requireString(
    input,
    "AuthenticationProfileId",
  );
  return {
    AuthenticationProfile: {
      Id: authenticationProfileId,
      Arn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/authentication-profile/${authenticationProfileId}`,
      Name: "default",
      IsDefault: true,
    },
  };
};

const DescribeContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {
    Contact: {
      Id: stored.ContactId,
      Arn: stored.ContactArn,
      TotalPauseCount: stored.TotalPauseCount,
      ...(stored.LastPausedTimestamp !== undefined
        ? { LastPausedTimestamp: new Date(stored.LastPausedTimestamp) }
        : {}),
      ...(stored.LastResumedTimestamp !== undefined
        ? { LastResumedTimestamp: new Date(stored.LastResumedTimestamp) }
        : {}),
      ...(stored.RecordingEnabled
        ? { Recordings: [{ StorageType: "S3", Type: "AUDIO" }] }
        : {}),
      ...(stored.Tags !== undefined ? { Tags: stored.Tags } : {}),
    },
  };
};

const DescribeContactEvaluation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const evaluationId = requireString(input, "EvaluationId");
  return {
    Evaluation: {
      EvaluationId: evaluationId,
      EvaluationArn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact-evaluation/${evaluationId}`,
      Status: "DRAFT",
      Answers: {},
      Notes: {},
      CreatedTime: new Date().toISOString(),
      LastModifiedTime: new Date().toISOString(),
    },
    EvaluationForm: {
      EvaluationFormVersion: 1,
      EvaluationFormId: evaluationId,
      EvaluationFormArn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/evaluation-form/${evaluationId}`,
      Title: "default",
      Status: "ACTIVE",
      Items: [],
      CreatedTime: new Date().toISOString(),
      LastModifiedTime: new Date().toISOString(),
      CreatedBy: callerArn(ctx.account),
      LastModifiedBy: callerArn(ctx.account),
    },
  };
};

const DescribeContactFlow: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowId = requireString(input, "ContactFlowId");
  const stored = ctx.store.get<StoredContactFlow>(
    contactFlowKey(instanceId, contactFlowId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlow ${contactFlowId} not found.`,
      404,
    );
  }
  return {
    ContactFlow: {
      Id: stored.ContactFlowId,
      Arn: stored.ContactFlowArn,
      Name: stored.Name,
      Type: stored.Type,
      State: "ACTIVE",
      Status: "PUBLISHED",
    },
  };
};

const DescribeContactFlowModule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowModuleId = requireString(input, "ContactFlowModuleId");
  const stored = ctx.store.get<StoredContactFlowModule>(
    contactFlowModuleKey(instanceId, contactFlowModuleId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModule ${contactFlowModuleId} not found.`,
      404,
    );
  }
  return {
    ContactFlowModule: {
      Id: stored.Id,
      Arn: stored.Arn,
      Name: stored.Name,
      Status: "PUBLISHED",
    },
  };
};

const DescribeContactFlowModuleAlias: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowModuleId = requireString(input, "ContactFlowModuleId");
  const aliasId = requireString(input, "AliasId");
  const stored = ctx.store.get<StoredContactFlowModuleAlias>(
    contactFlowModuleAliasKey(instanceId, contactFlowModuleId, aliasId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModuleAlias ${aliasId} not found.`,
      404,
    );
  }
  return {
    ContactFlowModuleAlias: {
      Id: stored.Id,
      Arn: stored.ContactFlowModuleArn,
    },
  };
};

const DescribeDataTable: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const stored = ctx.store.get<StoredDataTable>(
    dataTableKey(instanceId, dataTableId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataTable ${dataTableId} not found.`,
      404,
    );
  }
  return {
    DataTable: {
      Id: stored.Id,
      Arn: stored.Arn,
    },
  };
};

const DescribeDataTableAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const dataTableId = requireString(input, "DataTableId");
  const attributeName = requireString(input, "AttributeName");
  const stored = ctx.store.get<StoredDataTableAttribute>(
    dataTableAttributeKey(instanceId, dataTableId, attributeName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DataTableAttribute ${attributeName} not found.`,
      404,
    );
  }
  return {
    Attribute: {
      Name: stored.Name,
      AttributeId: stored.AttributeId,
    },
  };
};

const DescribeEmailAddress: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const emailAddressId = requireString(input, "EmailAddressId");
  const stored = ctx.store.get<StoredEmailAddress>(
    emailAddressKey(instanceId, emailAddressId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `EmailAddress ${emailAddressId} not found.`,
      404,
    );
  }
  return {
    EmailAddressId: stored.EmailAddressId,
    EmailAddressArn: stored.EmailAddressArn,
    EmailAddress: stored.EmailAddress,
  };
};

const DescribeEvaluationForm: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const evaluationFormId = requireString(input, "EvaluationFormId");
  const stored = ctx.store.get<StoredEvaluationForm>(
    evaluationFormKey(instanceId, evaluationFormId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `EvaluationForm ${evaluationFormId} not found.`,
      404,
    );
  }
  return {
    EvaluationForm: {
      EvaluationFormId: stored.EvaluationFormId,
      EvaluationFormArn: stored.EvaluationFormArn,
      EvaluationFormVersion: 1,
      Locked: false,
      Status: "DRAFT",
      Title: "default",
      Items: [],
      CreatedTime: new Date().toISOString(),
      LastModifiedTime: new Date().toISOString(),
      CreatedBy: callerArn(ctx.account),
      LastModifiedBy: callerArn(ctx.account),
    },
  };
};

const DescribeHoursOfOperation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hoursOfOperationId = requireString(input, "HoursOfOperationId");
  const stored = ctx.store.get<StoredHoursOfOperation>(
    hoursOfOperationKey(instanceId, hoursOfOperationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `HoursOfOperation ${hoursOfOperationId} not found.`,
      404,
    );
  }
  return {
    HoursOfOperation: {
      HoursOfOperationId: stored.HoursOfOperationId,
      HoursOfOperationArn: stored.HoursOfOperationArn,
      Name: stored.Name,
      Config: [],
    },
  };
};

const DescribeHoursOfOperationOverride: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hoursOfOperationId = requireString(input, "HoursOfOperationId");
  const hoursOfOperationOverrideId = requireString(
    input,
    "HoursOfOperationOverrideId",
  );
  const stored = ctx.store.get<StoredHoursOfOperationOverride>(
    hoursOfOperationOverrideKey(
      instanceId,
      hoursOfOperationId,
      hoursOfOperationOverrideId,
    ),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `HoursOfOperationOverride ${hoursOfOperationOverrideId} not found.`,
      404,
    );
  }
  return {
    HoursOfOperationOverride: {
      HoursOfOperationOverrideId: stored.HoursOfOperationOverrideId,
      HoursOfOperationId: stored.HoursOfOperationId,
      Config: [],
    },
  };
};

const DescribeUser: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const userId = requireString(input, "UserId");
  const stored = ctx.store.get<StoredUser>(userKey(instanceId, userId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User ${userId} not found.`,
      404,
    );
  }
  return {
    User: {
      Id: stored.UserId,
      Arn: stored.UserArn,
      Username: stored.Username,
    },
  };
};

const DescribeUserHierarchyGroup: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hierarchyGroupId = requireString(input, "HierarchyGroupId");
  const stored = ctx.store.get<StoredUserHierarchyGroup>(
    userHierarchyGroupKey(instanceId, hierarchyGroupId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `UserHierarchyGroup ${hierarchyGroupId} not found.`,
      404,
    );
  }
  return {
    HierarchyGroup: {
      HierarchyGroupId: stored.HierarchyGroupId,
      Arn: stored.HierarchyGroupArn,
      Name: stored.Name,
    },
  };
};

const DescribeUserHierarchyStructure: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {
    HierarchyStructure: {},
  };
};

const DescribeView: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const viewId = requireString(input, "ViewId");
  const stored = ctx.store.get<StoredView>(viewKey(instanceId, viewId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `View ${viewId} not found.`,
      404,
    );
  }
  return {
    View: {
      Id: stored.Id,
      Arn: stored.Arn,
      Name: stored.Name,
      Status: stored.Status,
      Version: 1,
    },
  };
};

const DescribeVocabulary: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const vocabularyId = requireString(input, "VocabularyId");
  const stored = ctx.store.get<StoredVocabulary>(
    vocabularyKey(instanceId, vocabularyId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Vocabulary ${vocabularyId} not found.`,
      404,
    );
  }
  return {
    Vocabulary: {
      VocabularyId: stored.VocabularyId,
      Arn: stored.VocabularyArn,
      Name: stored.VocabularyName,
      State: "ACTIVE",
    },
  };
};

const DescribeWorkspace: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const workspaceId = requireString(input, "WorkspaceId");
  const stored = ctx.store.get<StoredWorkspace>(
    workspaceKey(instanceId, workspaceId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Workspace ${workspaceId} not found.`,
      404,
    );
  }
  return {
    Workspace: {
      WorkspaceId: stored.WorkspaceId,
      Arn: stored.WorkspaceArn,
      Name: stored.Name,
    },
  };
};

const DisassociateAnalyticsDataSet: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateApprovedOrigin: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateBot: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateEmailAddressAlias: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateFlow: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateHoursOfOperations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateInstanceStorageConfig: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const associationId = requireString(input, "AssociationId");
  const key = instanceStorageConfigKey(instanceId, associationId);
  if (ctx.store.get<StoredInstanceStorageConfig>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `InstanceStorageConfig ${associationId} not found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DisassociateLambdaFunction: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateLexBot: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociatePhoneNumberContactFlow: OperationHandler = (input, ctx) => {
  const phoneNumberId = requireString(input, "PhoneNumberId");
  const stored = ctx.store.get<StoredPhoneNumber>(
    phoneNumberKey(phoneNumberId),
  );
  if (stored !== undefined) {
    ctx.store.set(phoneNumberKey(phoneNumberId), {
      ...stored,
      ContactFlowId: undefined,
    });
  }
  return {};
};

const DisassociateQueueEmailAddresses: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateQueueQuickConnects: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateRoutingProfileQueues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateSecurityKey: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateSecurityProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateTrafficDistributionGroupUser: OperationHandler = (
  _input,
  _ctx,
) => {
  return {};
};

const DisassociateUserProficiencies: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DisassociateWorkspace: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DescribeInstanceAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const attributeType = requireString(input, "AttributeType");
  return {
    Attribute: {
      AttributeType: attributeType,
      Value: "true",
    },
  };
};

const DescribeInstanceStorageConfig: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const associationId = requireString(input, "AssociationId");
  const stored = ctx.store.get<StoredInstanceStorageConfig>(
    instanceStorageConfigKey(instanceId, associationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `InstanceStorageConfig ${associationId} not found.`,
      404,
    );
  }
  return {
    StorageConfig: {
      AssociationId: stored.AssociationId,
      StorageType: "S3",
      ResourceType: stored.ResourceType,
    },
  };
};

const UpdateAgentStatus: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const agentStatusId = requireString(input, "AgentStatusId");
  const stored = ctx.store.get<StoredAgentStatus>(
    agentStatusKey(instanceId, agentStatusId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AgentStatus ${agentStatusId} not found.`,
      404,
    );
  }
  const name = stringOrUndefined(input["Name"]) ?? stored.Name;
  const state =
    typeof input["State"] === "string" ? input["State"] : stored.State;
  ctx.store.set(agentStatusKey(instanceId, agentStatusId), {
    ...stored,
    Name: name,
    State: state,
  });
  return {};
};

const UpdateAttachedFilesConfiguration: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const UpdateAuthenticationProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const UpdateContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {};
};

const UpdateContactAttributes: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const UpdateContactEvaluation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const evaluationId = requireString(input, "EvaluationId");
  return {
    EvaluationId: evaluationId,
    EvaluationArn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact-evaluation/${evaluationId}`,
  };
};

const UpdateContactFlowContent: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowId = requireString(input, "ContactFlowId");
  const stored = ctx.store.get<StoredContactFlow>(
    contactFlowKey(instanceId, contactFlowId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlow ${contactFlowId} not found.`,
      404,
    );
  }
  return {};
};

const UpdateContactFlowMetadata: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowId = requireString(input, "ContactFlowId");
  const stored = ctx.store.get<StoredContactFlow>(
    contactFlowKey(instanceId, contactFlowId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlow ${contactFlowId} not found.`,
      404,
    );
  }
  const name = stringOrUndefined(input["Name"]) ?? stored.Name;
  ctx.store.set(contactFlowKey(instanceId, contactFlowId), {
    ...stored,
    Name: name,
  });
  return {};
};

const UpdateContactFlowModuleAlias: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const moduleId = requireString(input, "ContactFlowModuleId");
  const aliasId = requireString(input, "AliasId");
  const stored = ctx.store.get<StoredContactFlowModuleAlias>(
    contactFlowModuleAliasKey(instanceId, moduleId, aliasId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModuleAlias ${aliasId} not found.`,
      404,
    );
  }
  return {};
};

const UpdateContactFlowModuleContent: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const moduleId = requireString(input, "ContactFlowModuleId");
  const stored = ctx.store.get<StoredContactFlowModule>(
    contactFlowModuleKey(instanceId, moduleId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModule ${moduleId} not found.`,
      404,
    );
  }
  return {};
};

const UpdateContactFlowModuleMetadata: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const moduleId = requireString(input, "ContactFlowModuleId");
  const stored = ctx.store.get<StoredContactFlowModule>(
    contactFlowModuleKey(instanceId, moduleId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlowModule ${moduleId} not found.`,
      404,
    );
  }
  const name = stringOrUndefined(input["Name"]) ?? stored.Name;
  ctx.store.set(contactFlowModuleKey(instanceId, moduleId), {
    ...stored,
    Name: name,
  });
  return {};
};

const UpdateContactFlowName: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactFlowId = requireString(input, "ContactFlowId");
  const stored = ctx.store.get<StoredContactFlow>(
    contactFlowKey(instanceId, contactFlowId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ContactFlow ${contactFlowId} not found.`,
      404,
    );
  }
  const name = stringOrUndefined(input["Name"]) ?? stored.Name;
  ctx.store.set(contactFlowKey(instanceId, contactFlowId), {
    ...stored,
    Name: name,
  });
  return {};
};

const UpdateContactRoutingData: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {};
};

const UpdateContactSchedule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DeleteWorkspacePage: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const DescribeNotification: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const notificationId = requireString(input, "NotificationId");
  const stored = ctx.store.get<StoredNotification>(
    notificationKey(instanceId, notificationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Notification ${notificationId} not found.`,
      404,
    );
  }
  return {
    Notification: {
      NotificationId: stored.NotificationId,
      NotificationArn: stored.NotificationArn,
    },
  };
};

const DescribePhoneNumber: OperationHandler = (input, ctx) => {
  const phoneNumberId = requireString(input, "PhoneNumberId");
  const stored = ctx.store.get<StoredPhoneNumber>(
    phoneNumberKey(phoneNumberId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `PhoneNumber ${phoneNumberId} not found.`,
      404,
    );
  }
  return {
    ClaimedPhoneNumberSummary: {
      PhoneNumberId: stored.PhoneNumberId,
      PhoneNumberArn: stored.PhoneNumberArn,
      PhoneNumber: stored.PhoneNumber,
      PhoneNumberStatus: { Status: "CLAIMED" },
    },
  };
};

const DescribePredefinedAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const stored = ctx.store.get<StoredPredefinedAttribute>(
    predefinedAttributeKey(instanceId, name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `PredefinedAttribute ${name} not found.`,
      404,
    );
  }
  return {
    PredefinedAttribute: {
      Name: stored.Name,
    },
  };
};

const DescribePrompt: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const promptId = requireString(input, "PromptId");
  const stored = ctx.store.get<StoredPrompt>(promptKey(instanceId, promptId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Prompt ${promptId} not found.`,
      404,
    );
  }
  return {
    Prompt: {
      PromptARN: stored.PromptArn,
      PromptId: stored.PromptId,
      Name: stored.Name,
    },
  };
};

const DescribeQueue: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const queueId = requireString(input, "QueueId");
  const stored = ctx.store.get<StoredQueue>(queueKey(instanceId, queueId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Queue ${queueId} not found.`,
      404,
    );
  }
  return {
    Queue: {
      QueueId: stored.QueueId,
      QueueArn: stored.QueueArn,
      Name: stored.Name,
    },
  };
};

const DescribeQuickConnect: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const quickConnectId = requireString(input, "QuickConnectId");
  const stored = ctx.store.get<StoredQuickConnect>(
    quickConnectKey(instanceId, quickConnectId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `QuickConnect ${quickConnectId} not found.`,
      404,
    );
  }
  return {
    QuickConnect: {
      QuickConnectId: stored.QuickConnectId,
      QuickConnectARN: stored.QuickConnectARN,
      Name: stored.Name,
    },
  };
};

const DescribeRoutingProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const routingProfileId = requireString(input, "RoutingProfileId");
  const stored = ctx.store.get<StoredRoutingProfile>(
    routingProfileKey(instanceId, routingProfileId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `RoutingProfile ${routingProfileId} not found.`,
      404,
    );
  }
  return {
    RoutingProfile: {
      RoutingProfileId: stored.RoutingProfileId,
      RoutingProfileArn: stored.RoutingProfileArn,
      Name: stored.Name,
      InstanceId: stored.InstanceId,
    },
  };
};

const DescribeRule: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const ruleId = requireString(input, "RuleId");
  const stored = ctx.store.get<StoredRule>(ruleKey(instanceId, ruleId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Rule ${ruleId} not found.`,
      404,
    );
  }
  return {
    Rule: {
      RuleId: stored.RuleId,
      RuleArn: stored.RuleArn,
      InstanceId: stored.InstanceId,
    },
  };
};

const DescribeSecurityProfile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const securityProfileId = requireString(input, "SecurityProfileId");
  const stored = ctx.store.get<StoredSecurityProfile>(
    securityProfileKey(instanceId, securityProfileId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `SecurityProfile ${securityProfileId} not found.`,
      404,
    );
  }
  return {
    SecurityProfile: {
      Id: stored.SecurityProfileId,
      Arn: stored.SecurityProfileArn,
      SecurityProfileName: stored.SecurityProfileName,
    },
  };
};

const DescribeTestCase: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const testCaseId = requireString(input, "TestCaseId");
  const stored = ctx.store.get<StoredTestCase>(
    testCaseKey(instanceId, testCaseId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TestCase ${testCaseId} not found.`,
      404,
    );
  }
  return {
    TestCase: {
      TestCaseId: stored.TestCaseId,
      TestCaseArn: stored.TestCaseArn,
    },
  };
};

const DescribeTrafficDistributionGroup: OperationHandler = (input, ctx) => {
  const trafficDistributionGroupId = requireString(
    input,
    "TrafficDistributionGroupId",
  );
  const stored = ctx.store.get<StoredTrafficDistributionGroup>(
    trafficDistributionGroupKey(trafficDistributionGroupId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TrafficDistributionGroup ${trafficDistributionGroupId} not found.`,
      404,
    );
  }
  return {
    TrafficDistributionGroup: {
      Id: stored.Id,
      Arn: stored.Arn,
      Status: "ACTIVE",
    },
  };
};

const DismissUserContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const EvaluateDataTableValues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Results: [] };
};

const GetAttachedFile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const GetContactAttributes: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Attributes: {} };
};

const GetContactMetrics: OperationHandler = (_input, _ctx) => {
  return { MetricResults: [] };
};

const GetCurrentMetricData: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { MetricResults: [], ApproximateTotalCount: 0 };
};

const GetCurrentUserData: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { UserDataList: [], ApproximateTotalCount: 0 };
};

const GetEffectiveHoursOfOperations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {
    EffectiveHoursOfOperationList: [],
    EffectiveOverrideHoursList: [],
    TimeZone: "UTC",
  };
};

const GetFederationToken: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {
    Credentials: {
      AccessToken: "access-token",
      AccessTokenExpiration: new Date().toISOString(),
      RefreshToken: "refresh-token",
      RefreshTokenExpiration: new Date().toISOString(),
    },
    UserArn: `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/agent/federation`,
    UserId: "federation-user",
  };
};

const GetFlowAssociation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const GetMetricData: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { MetricResults: [] };
};

const GetMetricDataV2: OperationHandler = (_input, _ctx) => {
  return { MetricResults: [] };
};

const GetPromptFile: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const promptId = requireString(input, "PromptId");
  const stored = ctx.store.get<StoredPrompt>(promptKey(instanceId, promptId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Prompt ${promptId} not found.`,
      404,
    );
  }
  return {
    PromptPresignedUrl: `https://s3.amazonaws.com/${instanceId}/prompts/${promptId}`,
    LastModifiedTime: new Date().toISOString(),
    LastModifiedRegion: ctx.region,
  };
};

const GetTaskTemplate: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const taskTemplateId = requireString(input, "TaskTemplateId");
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/task-template/${taskTemplateId}`;
  return {
    InstanceId: instanceId,
    Id: taskTemplateId,
    Arn: arn,
    Name: "task-template",
    Status: "ACTIVE",
    LastModifiedTime: new Date().toISOString(),
    CreatedTime: new Date().toISOString(),
  };
};

const GetTestCaseExecutionSummary: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {
    StartTime: new Date().toISOString(),
    EndTime: new Date().toISOString(),
    Status: "COMPLETED",
    ObservationSummary: {},
  };
};

const GetTrafficDistribution: OperationHandler = (input, ctx) => {
  const id = requireString(input, "Id");
  const stored = ctx.store.get<StoredTrafficDistributionGroup>(
    trafficDistributionGroupKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TrafficDistributionGroup ${id} not found.`,
      404,
    );
  }
  return {
    TelephonyConfig: { Distributions: [] },
    Id: stored.Id,
    Arn: stored.Arn,
    SignInConfig: { Distributions: [] },
    AgentConfig: { Distributions: [] },
  };
};

const ImportPhoneNumber: OperationHandler = (input, ctx) => {
  const instanceId = stringOrUndefined(input["InstanceId"]);
  const sourcePhoneNumberArn = requireString(input, "SourcePhoneNumberArn");
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:phone-number/${id}`;
  const stored: StoredPhoneNumber = {
    PhoneNumberId: id,
    PhoneNumberArn: arn,
    PhoneNumber: sourcePhoneNumberArn,
    InstanceId: instanceId,
    ContactFlowId: undefined,
  };
  ctx.store.set(phoneNumberKey(id), stored);
  return { PhoneNumberId: id, PhoneNumberArn: arn };
};

const ImportWorkspaceMedia: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const ListAgentStatuses: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const statuses = ctx.store
    .list<StoredAgentStatus>()
    .filter((entry) => entry.key.startsWith(agentStatusPrefix))
    .map((entry) => entry.value)
    .filter((s) => s.InstanceId === instanceId);
  return {
    AgentStatusSummaryList: statuses.map((s) => ({
      Id: s.AgentStatusId,
      Arn: s.AgentStatusARN,
      Name: s.Name,
      Type: "CUSTOM",
      LastModifiedTime: new Date().toISOString(),
      LastModifiedRegion: ctx.region,
    })),
  };
};

const ListAnalyticsDataAssociations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Results: [] };
};

const ListAnalyticsDataLakeDataSets: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Results: [] };
};

const ListApprovedOrigins: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Origins: [] };
};

const ListAssociatedContacts: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ContactSummaryList: [] };
};

const ListAttachedFilesConfigurations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { AttachedFilesConfigurations: [] };
};

const ListAuthenticationProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { AuthenticationProfileSummaryList: [] };
};

const ListBots: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { LexBots: [] };
};

const ListChildHoursOfOperations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ChildHoursOfOperationsSummaryList: [] };
};

const ListContactEvaluations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { EvaluationSummaryList: [] };
};

const ListContactFlowModuleAliases: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const moduleId = requireString(input, "ContactFlowModuleId");
  const aliases = ctx.store
    .list<StoredContactFlowModuleAlias>()
    .filter((entry) => entry.key.startsWith(contactFlowModuleAliasPrefix))
    .map((entry) => entry.value)
    .filter(
      (a) => a.InstanceId === instanceId && a.ContactFlowModuleId === moduleId,
    );
  return {
    ContactFlowModuleAliasSummaryList: aliases.map((a) => ({
      Id: a.Id,
      Arn: a.ContactFlowModuleArn,
    })),
  };
};

const ListContactFlowModuleVersions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ContactFlowModuleVersionSummaryList: [] };
};

const ListContactFlowModules: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const modules = ctx.store
    .list<StoredContactFlowModule>()
    .filter((entry) => entry.key.startsWith(contactFlowModulePrefix))
    .map((entry) => entry.value)
    .filter((m) => m.InstanceId === instanceId);
  return {
    ContactFlowModulesSummaryList: modules.map((m) => ({
      Id: m.Id,
      Arn: m.Arn,
      Name: m.Name,
    })),
  };
};

const ListContactFlowVersions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ContactFlowVersionSummaryList: [] };
};

const ListContactFlows: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const flows = ctx.store
    .list<StoredContactFlow>()
    .filter((entry) => entry.key.startsWith(contactFlowPrefix))
    .map((entry) => entry.value)
    .filter((f) => f.InstanceId === instanceId);
  return {
    ContactFlowSummaryList: flows.map((f) => ({
      Id: f.ContactFlowId,
      Arn: f.ContactFlowArn,
      Name: f.Name,
      ContactFlowType: f.Type,
    })),
  };
};

const ListContactReferences: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ReferenceSummaryList: [] };
};

const ListDataTableAttributes: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const tableId = requireString(input, "DataTableId");
  const attrs = ctx.store
    .list<StoredDataTableAttribute>()
    .filter((entry) => entry.key.startsWith(dataTableAttributePrefix))
    .map((entry) => entry.value)
    .filter((a) => a.InstanceId === instanceId && a.DataTableId === tableId);
  return {
    Attributes: attrs.map((a) => ({
      Name: a.Name,
      AttributeId: a.AttributeId,
    })),
  };
};

const ListDataTablePrimaryValues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const tableId = requireString(input, "DataTableId");
  const values = ctx.store
    .list<StoredDataTableValue>()
    .filter((entry) => entry.key.startsWith(dataTableValuePrefix))
    .map((entry) => entry.value)
    .filter((v) => v.InstanceId === instanceId && v.DataTableId === tableId);
  return {
    PrimaryValuesList: values.map((v) => ({ Key: v.Key })),
  };
};

const ListDataTableValues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const tableId = requireString(input, "DataTableId");
  const values = ctx.store
    .list<StoredDataTableValue>()
    .filter((entry) => entry.key.startsWith(dataTableValuePrefix))
    .map((entry) => entry.value)
    .filter((v) => v.InstanceId === instanceId && v.DataTableId === tableId);
  return { Values: values.map((v) => ({ Key: v.Key })) };
};

const ListDataTables: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const tables = ctx.store
    .list<StoredDataTable>()
    .filter((entry) => entry.key.startsWith(dataTablePrefix))
    .map((entry) => entry.value)
    .filter((t) => t.InstanceId === instanceId);
  return {
    DataTableSummaryList: tables.map((t) => ({ Id: t.Id, Arn: t.Arn })),
  };
};

const ListDefaultVocabularies: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { DefaultVocabularyList: [] };
};

const ListEntitySecurityProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { SecurityProfiles: [] };
};

const ListEvaluationFormVersions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { EvaluationFormVersionSummaryList: [] };
};

const ListLambdaFunctions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { LambdaFunctions: [] };
};

const ListLexBots: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { LexBots: [] };
};

const ListNotifications: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const notifications = ctx.store
    .list<StoredNotification>()
    .filter((entry) => entry.key.startsWith(notificationPrefix))
    .map((entry) => entry.value)
    .filter((n) => n.InstanceId === instanceId);
  return {
    NotificationSummaryList: notifications.map((n) => ({
      NotificationId: n.NotificationId,
      NotificationArn: n.NotificationArn,
    })),
  };
};

const ListPhoneNumbers: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const numbers = ctx.store
    .list<StoredPhoneNumber>()
    .filter((entry) => entry.key.startsWith(phoneNumberPrefix))
    .map((entry) => entry.value)
    .filter((p) => p.InstanceId === instanceId);
  return {
    PhoneNumberSummaryList: numbers.map((p) => ({
      Id: p.PhoneNumberId,
      Arn: p.PhoneNumberArn,
      PhoneNumber: p.PhoneNumber,
    })),
  };
};

const ListPhoneNumbersV2: OperationHandler = (_input, _ctx) => {
  return { ListPhoneNumbersSummaryList: [] };
};

const ListPredefinedAttributes: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const attrs = ctx.store
    .list<StoredPredefinedAttribute>()
    .filter((entry) => entry.key.startsWith(predefinedAttributePrefix))
    .map((entry) => entry.value)
    .filter((a) => a.InstanceId === instanceId);
  return {
    PredefinedAttributeSummaryList: attrs.map((a) => ({ Name: a.Name })),
  };
};

const ListPrompts: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const prompts = ctx.store
    .list<StoredPrompt>()
    .filter((entry) => entry.key.startsWith(promptPrefix))
    .map((entry) => entry.value)
    .filter((p) => p.InstanceId === instanceId);
  return {
    PromptSummaryList: prompts.map((p) => ({
      Id: p.PromptId,
      Arn: p.PromptArn,
      Name: p.Name,
    })),
  };
};

const ListQueueEmailAddresses: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { EmailAddressMetadataList: [] };
};

const ListQueueQuickConnects: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { QuickConnectSummaryList: [] };
};

const ListQueues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const queues = ctx.store
    .list<StoredQueue>()
    .filter((entry) => entry.key.startsWith(queuePrefix))
    .map((entry) => entry.value)
    .filter((q) => q.InstanceId === instanceId);
  return {
    QueueSummaryList: queues.map((q) => ({
      Id: q.QueueId,
      Arn: q.QueueArn,
      Name: q.Name,
    })),
  };
};

const ListQuickConnects: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const connects = ctx.store
    .list<StoredQuickConnect>()
    .filter((entry) => entry.key.startsWith(quickConnectPrefix))
    .map((entry) => entry.value)
    .filter((q) => q.InstanceId === instanceId);
  return {
    QuickConnectSummaryList: connects.map((q) => ({
      Id: q.QuickConnectId,
      Arn: q.QuickConnectARN,
      Name: q.Name,
    })),
  };
};

const ListRealtimeContactAnalysisSegmentsV2: OperationHandler = (
  input,
  ctx,
) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Channel: "CHAT", Status: "COMPLETED", Segments: [] };
};

const ListEvaluationForms: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const forms = ctx.store
    .list<StoredEvaluationForm>()
    .filter((entry) => entry.key.startsWith(evaluationFormPrefix))
    .map((entry) => entry.value)
    .filter((f) => f.InstanceId === instanceId);
  return {
    EvaluationFormSummaryList: forms.map((f) => ({
      EvaluationFormId: f.EvaluationFormId,
      EvaluationFormArn: f.EvaluationFormArn,
    })),
  };
};

const ListFlowAssociations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { FlowAssociationSummaryList: [] };
};

const ListHoursOfOperationOverrides: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hooId = requireString(input, "HoursOfOperationId");
  const overrides = ctx.store
    .list<StoredHoursOfOperationOverride>()
    .filter((entry) => entry.key.startsWith(hoursOfOperationOverridePrefix))
    .map((entry) => entry.value)
    .filter(
      (o) => o.InstanceId === instanceId && o.HoursOfOperationId === hooId,
    );
  return {
    HoursOfOperationOverrideList: overrides.map((o) => ({
      HoursOfOperationOverrideId: o.HoursOfOperationOverrideId,
      HoursOfOperationId: o.HoursOfOperationId,
    })),
  };
};

const ListHoursOfOperations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hours = ctx.store
    .list<StoredHoursOfOperation>()
    .filter((entry) => entry.key.startsWith(hoursOfOperationPrefix))
    .map((entry) => entry.value)
    .filter((h) => h.InstanceId === instanceId);
  return {
    HoursOfOperationSummaryList: hours.map((h) => ({
      Id: h.HoursOfOperationId,
      Arn: h.HoursOfOperationArn,
      Name: h.Name,
    })),
  };
};

const ListInstanceAttributes: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Attributes: [] };
};

const ListInstanceStorageConfigs: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const resourceType =
    typeof input["ResourceType"] === "string"
      ? input["ResourceType"]
      : undefined;
  const configs = ctx.store
    .list<StoredInstanceStorageConfig>()
    .filter((entry) => entry.key.startsWith(instanceStorageConfigPrefix))
    .map((entry) => entry.value)
    .filter(
      (c) =>
        c.InstanceId === instanceId &&
        (resourceType === undefined || c.ResourceType === resourceType),
    );
  return {
    StorageConfigs: configs.map((c) => ({
      AssociationId: c.AssociationId,
      StorageType: "S3",
      ResourceType: c.ResourceType,
    })),
  };
};

const ListIntegrationAssociations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { IntegrationAssociationSummaryList: [] };
};

const ListRoutingProfileManualAssignmentQueues: OperationHandler = (
  input,
  ctx,
) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { RoutingProfileManualAssignmentQueueConfigSummaryList: [] };
};

const ListRoutingProfileQueues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { RoutingProfileQueueConfigSummaryList: [] };
};

const ListRoutingProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const profiles = ctx.store
    .list<StoredRoutingProfile>()
    .filter((entry) => entry.key.startsWith(routingProfilePrefix))
    .map((entry) => entry.value)
    .filter((p) => p.InstanceId === instanceId);
  return {
    RoutingProfileSummaryList: profiles.map((p) => ({
      Id: p.RoutingProfileId,
      Arn: p.RoutingProfileArn,
      Name: p.Name,
    })),
  };
};

const ListRules: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const rules = ctx.store
    .list<StoredRule>()
    .filter((entry) => entry.key.startsWith(rulePrefix))
    .map((entry) => entry.value)
    .filter((r) => r.InstanceId === instanceId);
  return {
    RuleSummaryList: rules.map((r) => ({
      RuleId: r.RuleId,
      RuleArn: r.RuleArn,
    })),
  };
};

const ListSecurityKeys: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { SecurityKeys: [] };
};

const ListSecurityProfileApplications: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Applications: [] };
};

const ListSecurityProfileFlowModules: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { AllowedFlowModules: [] };
};

const ListSecurityProfilePermissions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Permissions: [] };
};

const ListSecurityProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const profiles = ctx.store
    .list<StoredSecurityProfile>()
    .filter((entry) => entry.key.startsWith(securityProfilePrefix))
    .map((entry) => entry.value)
    .filter((p) => p.InstanceId === instanceId);
  return {
    SecurityProfileSummaryList: profiles.map((p) => ({
      Id: p.SecurityProfileId,
      Arn: p.SecurityProfileArn,
      Name: p.SecurityProfileName,
    })),
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const stored = ctx.store.get<Record<string, string>>(resourceTagsKey(arn));
  return { tags: stored ?? {} };
};

const ListTaskTemplates: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { TaskTemplates: [] };
};

const ListTestCaseExecutionRecords: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ExecutionRecords: [] };
};

const ListTestCaseExecutions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { TestCaseExecutions: [] };
};

const ListTestCases: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const cases = ctx.store
    .list<StoredTestCase>()
    .filter((entry) => entry.key.startsWith(testCasePrefix))
    .map((entry) => entry.value)
    .filter((t) => t.InstanceId === instanceId);
  return {
    TestCaseSummaryList: cases.map((t) => ({
      TestCaseId: t.TestCaseId,
      TestCaseArn: t.TestCaseArn,
    })),
  };
};

const ListTrafficDistributionGroupUsers: OperationHandler = (input, ctx) => {
  const id = requireString(input, "TrafficDistributionGroupId");
  const stored = ctx.store.get<StoredTrafficDistributionGroup>(
    trafficDistributionGroupKey(id),
  );
  if (!stored)
    throw awsError(
      "ResourceNotFoundException",
      `Traffic distribution group ${id} not found.`,
      404,
    );
  return { TrafficDistributionGroupUserSummaryList: [] };
};

const ListTrafficDistributionGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredTrafficDistributionGroup>()
    .filter((entry) => entry.key.startsWith(trafficDistributionGroupPrefix))
    .map((entry) => entry.value);
  return {
    TrafficDistributionGroupSummaryList: groups.map((g) => ({
      Id: g.Id,
      Arn: g.Arn,
    })),
  };
};

const ListUseCases: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { UseCaseSummaryList: [] };
};

const ListUserHierarchyGroups: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const groups = ctx.store
    .list<StoredUserHierarchyGroup>()
    .filter((entry) => entry.key.startsWith(userHierarchyGroupPrefix))
    .map((entry) => entry.value)
    .filter((g) => g.InstanceId === instanceId);
  return {
    UserHierarchyGroupSummaryList: groups.map((g) => ({
      Id: g.HierarchyGroupId,
      Arn: g.HierarchyGroupArn,
      Name: g.Name,
    })),
  };
};

const ListUserNotifications: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { UserNotifications: [] };
};

const ListUserProficiencies: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { UserProficiencyList: [] };
};

const ListUsers: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const users = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith(userPrefix))
    .map((entry) => entry.value)
    .filter((u) => u.InstanceId === instanceId);
  return {
    UserSummaryList: users.map((u) => ({
      Id: u.UserId,
      Arn: u.UserArn,
      Username: u.Username,
    })),
  };
};

const ListViewVersions: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { ViewVersionSummaryList: [] };
};

const ListViews: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const views = ctx.store
    .list<StoredView>()
    .filter((entry) => entry.key.startsWith(viewPrefix))
    .map((entry) => entry.value)
    .filter((v) => v.InstanceId === instanceId);
  return {
    ViewsSummaryList: views.map((v) => ({
      Id: v.Id,
      Arn: v.Arn,
      Name: v.Name,
      Status: v.Status,
    })),
  };
};

const ListWorkspaceMedia: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Media: [] };
};

const ListWorkspacePages: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const workspaceId = requireString(input, "WorkspaceId");
  const stored = ctx.store.get<StoredWorkspace>(
    workspaceKey(instanceId, workspaceId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Workspace ${workspaceId} not found.`,
      404,
    );
  }
  return { WorkspacePageList: [] };
};

const ListWorkspaces: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const workspaces = ctx.store
    .list<StoredWorkspace>()
    .filter((entry) => entry.key.startsWith(workspacePrefix))
    .map((entry) => entry.value)
    .filter((w) => w.InstanceId === instanceId);
  return {
    WorkspaceSummaryList: workspaces.map((w) => ({
      Id: w.WorkspaceId,
      Arn: w.WorkspaceArn,
      Name: w.Name,
    })),
  };
};

const MonitorContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const monitorId = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${monitorId}`;
  return { ContactId: monitorId, ContactArn: arn };
};

const PauseContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    TotalPauseCount: stored.TotalPauseCount + 1,
    LastPausedTimestamp: new Date().toISOString(),
  });
  return {};
};

const PutUserStatus: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const userId = requireString(input, "UserId");
  const agentStatusId = requireString(input, "AgentStatusId");
  const stored = ctx.store.get<StoredUser>(userKey(instanceId, userId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User ${userId} not found.`,
      404,
    );
  }
  ctx.store.set(userKey(instanceId, userId), {
    ...stored,
    AgentStatusId: agentStatusId,
  });
  return {};
};

const ReleasePhoneNumber: OperationHandler = (input, ctx) => {
  const phoneNumberId = requireString(input, "PhoneNumberId");
  const stored = ctx.store.get<StoredPhoneNumber>(
    phoneNumberKey(phoneNumberId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `PhoneNumber ${phoneNumberId} not found.`,
      404,
    );
  }
  ctx.store.delete(phoneNumberKey(phoneNumberId));
  return {};
};

const ReplicateInstance: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${id}`;
  return { Id: id, Arn: arn };
};

const ResumeContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    LastResumedTimestamp: new Date().toISOString(),
  });
  return {};
};

const ResumeContactRecording: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {};
};

const SearchAgentStatuses: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const statuses = ctx.store
    .list<StoredAgentStatus>()
    .filter((entry) => entry.key.startsWith(agentStatusPrefix))
    .map((entry) => entry.value)
    .filter((s) => s.InstanceId === instanceId);
  return {
    AgentStatuses: statuses.map((s) => ({
      AgentStatusId: s.AgentStatusId,
      AgentStatusARN: s.AgentStatusARN,
      Name: s.Name,
      State: s.State,
    })),
    ApproximateTotalCount: statuses.length,
  };
};

const SearchAvailablePhoneNumbers: OperationHandler = (_input, _ctx) => {
  return { AvailableNumbersList: [] };
};

const SearchContactEvaluations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { EvaluationSearchSummaryList: [], ApproximateTotalCount: 0 };
};

const SearchContactFlowModules: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const modules = ctx.store
    .list<StoredContactFlowModule>()
    .filter((entry) => entry.key.startsWith(contactFlowModulePrefix))
    .map((entry) => entry.value)
    .filter((m) => m.InstanceId === instanceId);
  return {
    ContactFlowModules: modules.map((m) => ({
      Id: m.Id,
      Arn: m.Arn,
      Name: m.Name,
    })),
    ApproximateTotalCount: modules.length,
  };
};

const SearchContactFlows: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const flows = ctx.store
    .list<StoredContactFlow>()
    .filter((entry) => entry.key.startsWith(contactFlowPrefix))
    .map((entry) => entry.value)
    .filter((f) => f.InstanceId === instanceId);
  return {
    ContactFlows: flows.map((f) => ({
      Id: f.ContactFlowId,
      Arn: f.ContactFlowArn,
      Name: f.Name,
      ContactFlowType: f.Type,
    })),
    ApproximateTotalCount: flows.length,
  };
};

const SearchContacts: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contacts = ctx.store
    .list<StoredContact>()
    .filter((entry) => entry.key.startsWith(contactPrefix))
    .map((entry) => entry.value)
    .filter((c) => c.InstanceId === instanceId);
  return {
    Contacts: contacts.map((c) => ({ Id: c.ContactId, Arn: c.ContactArn })),
    TotalCount: contacts.length,
  };
};

const SearchDataTables: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const tables = ctx.store
    .list<StoredDataTable>()
    .filter((entry) => entry.key.startsWith(dataTablePrefix))
    .map((entry) => entry.value)
    .filter((t) => t.InstanceId === instanceId);
  return {
    DataTables: tables.map((t) => ({ Id: t.Id, Arn: t.Arn })),
    ApproximateTotalCount: tables.length,
  };
};

const SearchEmailAddresses: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const addresses = ctx.store
    .list<StoredEmailAddress>()
    .filter((entry) => entry.key.startsWith(emailAddressPrefix))
    .map((entry) => entry.value)
    .filter((a) => a.InstanceId === instanceId);
  return {
    EmailAddresses: addresses.map((a) => ({
      EmailAddressId: a.EmailAddressId,
      EmailAddressArn: a.EmailAddressArn,
      EmailAddress: a.EmailAddress,
    })),
    ApproximateTotalCount: addresses.length,
  };
};

const SearchEvaluationForms: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const forms = ctx.store
    .list<StoredEvaluationForm>()
    .filter((entry) => entry.key.startsWith(evaluationFormPrefix))
    .map((entry) => entry.value)
    .filter((f) => f.InstanceId === instanceId);
  return {
    EvaluationFormSearchSummaryList: forms.map((f) => ({
      EvaluationFormId: f.EvaluationFormId,
      EvaluationFormArn: f.EvaluationFormArn,
    })),
    ApproximateTotalCount: forms.length,
  };
};

const SearchHoursOfOperationOverrides: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const overrides = ctx.store
    .list<StoredHoursOfOperationOverride>()
    .filter((entry) => entry.key.startsWith(hoursOfOperationOverridePrefix))
    .map((entry) => entry.value)
    .filter((o) => o.InstanceId === instanceId);
  return {
    HoursOfOperationOverrides: overrides.map((o) => ({
      HoursOfOperationOverrideId: o.HoursOfOperationOverrideId,
      HoursOfOperationId: o.HoursOfOperationId,
    })),
    ApproximateTotalCount: overrides.length,
  };
};

const SearchHoursOfOperations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const hours = ctx.store
    .list<StoredHoursOfOperation>()
    .filter((entry) => entry.key.startsWith(hoursOfOperationPrefix))
    .map((entry) => entry.value)
    .filter((h) => h.InstanceId === instanceId);
  return {
    HoursOfOperations: hours.map((h) => ({
      HoursOfOperationId: h.HoursOfOperationId,
      HoursOfOperationArn: h.HoursOfOperationArn,
      Name: h.Name,
    })),
    ApproximateTotalCount: hours.length,
  };
};

const SearchNotifications: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const notifications = ctx.store
    .list<StoredNotification>()
    .filter((entry) => entry.key.startsWith(notificationPrefix))
    .map((entry) => entry.value)
    .filter((n) => n.InstanceId === instanceId);
  return {
    Notifications: notifications.map((n) => ({
      NotificationId: n.NotificationId,
      NotificationArn: n.NotificationArn,
    })),
    ApproximateTotalCount: notifications.length,
  };
};

const SearchPredefinedAttributes: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const attrs = ctx.store
    .list<StoredPredefinedAttribute>()
    .filter((entry) => entry.key.startsWith(predefinedAttributePrefix))
    .map((entry) => entry.value)
    .filter((a) => a.InstanceId === instanceId);
  return {
    PredefinedAttributes: attrs.map((a) => ({ Name: a.Name })),
    ApproximateTotalCount: attrs.length,
  };
};

const SearchPrompts: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const prompts = ctx.store
    .list<StoredPrompt>()
    .filter((entry) => entry.key.startsWith(promptPrefix))
    .map((entry) => entry.value)
    .filter((p) => p.InstanceId === instanceId);
  return {
    Prompts: prompts.map((p) => ({
      PromptId: p.PromptId,
      PromptARN: p.PromptArn,
      Name: p.Name,
    })),
    ApproximateTotalCount: prompts.length,
  };
};

const SearchQueues: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const queues = ctx.store
    .list<StoredQueue>()
    .filter((entry) => entry.key.startsWith(queuePrefix))
    .map((entry) => entry.value)
    .filter((q) => q.InstanceId === instanceId);
  return {
    Queues: queues.map((q) => ({
      QueueId: q.QueueId,
      QueueArn: q.QueueArn,
      Name: q.Name,
    })),
    ApproximateTotalCount: queues.length,
  };
};

const SearchQuickConnects: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredQuickConnect>()
    .filter((entry) => entry.key.startsWith(quickConnectPrefix))
    .map((entry) => entry.value)
    .filter((q) => q.InstanceId === instanceId);
  return {
    QuickConnects: items.map((q) => ({
      QuickConnectId: q.QuickConnectId,
      QuickConnectARN: q.QuickConnectARN,
      Name: q.Name,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchResourceTags: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { Tags: [] };
};

const SearchRoutingProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredRoutingProfile>()
    .filter((entry) => entry.key.startsWith(routingProfilePrefix))
    .map((entry) => entry.value)
    .filter((r) => r.InstanceId === instanceId);
  return {
    RoutingProfiles: items.map((r) => ({
      RoutingProfileId: r.RoutingProfileId,
      RoutingProfileArn: r.RoutingProfileArn,
      Name: r.Name,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchSecurityProfiles: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredSecurityProfile>()
    .filter((entry) => entry.key.startsWith(securityProfilePrefix))
    .map((entry) => entry.value)
    .filter((s) => s.InstanceId === instanceId);
  return {
    SecurityProfiles: items.map((s) => ({
      Id: s.SecurityProfileId,
      Arn: s.SecurityProfileArn,
      SecurityProfileName: s.SecurityProfileName,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchTestCases: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredTestCase>()
    .filter((entry) => entry.key.startsWith(testCasePrefix))
    .map((entry) => entry.value)
    .filter((t) => t.InstanceId === instanceId);
  return {
    TestCases: items.map((t) => ({
      Id: t.TestCaseId,
      Arn: t.TestCaseArn,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchUserHierarchyGroups: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredUserHierarchyGroup>()
    .filter((entry) => entry.key.startsWith(userHierarchyGroupPrefix))
    .map((entry) => entry.value)
    .filter((g) => g.InstanceId === instanceId);
  return {
    UserHierarchyGroups: items.map((g) => ({
      Id: g.HierarchyGroupId,
      Arn: g.HierarchyGroupArn,
      Name: g.Name,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchUsers: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith(userPrefix))
    .map((entry) => entry.value)
    .filter((u) => u.InstanceId === instanceId);
  return {
    Users: items.map((u) => ({
      Id: u.UserId,
      Arn: u.UserArn,
      Username: u.Username,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchViews: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredView>()
    .filter((entry) => entry.key.startsWith(viewPrefix))
    .map((entry) => entry.value)
    .filter((v) => v.InstanceId === instanceId);
  return {
    Views: items.map((v) => ({
      Id: v.Id,
      Arn: v.Arn,
      Name: v.Name,
      Status: v.Status,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SearchVocabularies: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredVocabulary>()
    .filter((entry) => entry.key.startsWith(vocabularyPrefix))
    .map((entry) => entry.value)
    .filter((v) => v.InstanceId === instanceId);
  return {
    VocabularySummaryList: items.map((v) => ({
      Id: v.VocabularyId,
      Arn: v.VocabularyArn,
      Name: v.VocabularyName,
      State: "ACTIVE",
    })),
  };
};

const SearchWorkspaceAssociations: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return { WorkspaceAssociations: [], ApproximateTotalCount: 0 };
};

const SearchWorkspaces: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const items = ctx.store
    .list<StoredWorkspace>()
    .filter((entry) => entry.key.startsWith(workspacePrefix))
    .map((entry) => entry.value)
    .filter((w) => w.InstanceId === instanceId);
  return {
    Workspaces: items.map((w) => ({
      Id: w.WorkspaceId,
      Arn: w.WorkspaceArn,
      Name: w.Name,
    })),
    ApproximateTotalCount: items.length,
  };
};

const SendChatIntegrationEvent: OperationHandler = (_input, _ctx) => {
  return { InitialContactId: crypto.randomUUID(), NewChatCreated: true };
};

const SendOutboundEmail: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const StartAttachedFileUpload: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/attached-file/${id}`;
  return {
    FileArn: arn,
    FileId: id,
    CreationTime: new Date().toISOString(),
    FileStatus: "APPROVED",
    UploadUrlMetadata: {
      Url: `https://s3.example.com/${id}`,
      UrlExpiry: new Date().toISOString(),
      HeadersToInclude: {},
    },
  };
};

const StartChatContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return {
    ContactId: id,
    ParticipantId: crypto.randomUUID(),
    ParticipantToken: crypto.randomUUID(),
  };
};

const StartContactEvaluation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const storedContact = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (storedContact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact-evaluation/${id}`;
  return { EvaluationId: id, EvaluationArn: arn };
};

const StartContactMediaProcessing: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const StartContactRecording: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    RecordingEnabled: true,
  });
  return {};
};

const StartContactStreaming: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const streamingId = crypto.randomUUID();
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    StreamingId: streamingId,
  });
  return { StreamingId: streamingId };
};

const StartEmailContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return { ContactId: id };
};

const StartOutboundChatContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return { ContactId: id };
};

const StartOutboundEmailContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return { ContactId: id };
};

const StartOutboundVoiceContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return { ContactId: id };
};

const StartScreenSharing: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {};
};

const StartTaskContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return { ContactId: id };
};

const StartTestCaseExecution: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const testCaseId = requireString(input, "TestCaseId");
  const stored = ctx.store.get<StoredTestCase>(
    testCaseKey(instanceId, testCaseId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Test case ${testCaseId} not found.`,
      404,
    );
  }
  const executionId = crypto.randomUUID();
  return {
    TestCaseExecutionId: executionId,
    TestCaseId: testCaseId,
    Status: "IN_PROGRESS",
  };
};

const StartWebRTCContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact/${id}`;
  const stored: StoredContact = {
    ContactId: id,
    ContactArn: arn,
    InstanceId: instanceId,
    TotalPauseCount: 0,
  };
  ctx.store.set(contactKey(instanceId, id), stored);
  return {
    ContactId: id,
    ParticipantId: crypto.randomUUID(),
    ParticipantToken: crypto.randomUUID(),
  };
};

const StopContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    Stopped: true,
  });
  return {};
};

const StopContactMediaProcessing: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {};
};

const StopContactRecording: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    RecordingEnabled: false,
    RecordingSuspended: false,
  });
  return {};
};

const StopContactStreaming: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    StreamingId: undefined,
  });
  return {};
};

const StopTestCaseExecution: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  return {};
};

const SubmitContactEvaluation: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const evaluationId = requireString(input, "EvaluationId");
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/contact-evaluation/${evaluationId}`;
  return { EvaluationId: evaluationId, EvaluationArn: arn };
};

const SuspendContactRecording: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    RecordingSuspended: true,
  });
  return {};
};

const TagContact: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const contactId = requireString(input, "ContactId");
  const stored = ctx.store.get<StoredContact>(
    contactKey(instanceId, contactId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const tags = (input["Tags"] ?? {}) as Record<string, string>;
  ctx.store.set(contactKey(instanceId, contactId), {
    ...stored,
    Tags: { ...(stored.Tags ?? {}), ...tags },
  });
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tags = (input["tags"] ?? {}) as Record<string, string>;
  const existing =
    ctx.store.get<Record<string, string>>(resourceTagsKey(arn)) ?? {};
  ctx.store.set(resourceTagsKey(arn), { ...existing, ...tags });
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const connect = {
  name: "connect",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    switch (parts[0]) {
      case "instance":
        if (parts.length === 1) {
          if (req.method === "PUT") return "CreateInstance";
          if (req.method === "GET") return "ListInstances";
          return undefined;
        }
        if (parts.length === 2) {
          if (req.method === "GET") return "DescribeInstance";
          if (req.method === "DELETE") return "DeleteInstance";
          return undefined;
        }
        if (parts.length === 3) {
          if (req.method === "PUT") {
            if (parts[2] === "approved-origin")
              return "AssociateApprovedOrigin";
            if (parts[2] === "bot") return "AssociateBot";
            if (parts[2] === "storage-config")
              return "AssociateInstanceStorageConfig";
            if (parts[2] === "lambda-function")
              return "AssociateLambdaFunction";
            if (parts[2] === "lex-bot") return "AssociateLexBot";
            if (parts[2] === "security-key") return "AssociateSecurityKey";
            if (parts[2] === "integration-associations")
              return "CreateIntegrationAssociation";
            if (parts[2] === "outbound-email") return "SendOutboundEmail";
          }
          if (req.method === "DELETE") {
            if (parts[2] === "approved-origin")
              return "DisassociateApprovedOrigin";
            if (parts[2] === "lambda-function")
              return "DisassociateLambdaFunction";
            if (parts[2] === "lex-bot") return "DisassociateLexBot";
          }
          if (req.method === "POST") {
            if (parts[2] === "bot") return "DisassociateBot";
            if (parts[2] === "replicate") return "ReplicateInstance";
          }
          if (req.method === "GET") {
            if (parts[2] === "approved-origins") return "ListApprovedOrigins";
            if (parts[2] === "bots") return "ListBots";
            if (parts[2] === "attributes") return "ListInstanceAttributes";
            if (parts[2] === "lambda-functions") return "ListLambdaFunctions";
            if (parts[2] === "lex-bots") return "ListLexBots";
            if (parts[2] === "storage-configs")
              return "ListInstanceStorageConfigs";
            if (parts[2] === "integration-associations")
              return "ListIntegrationAssociations";
            if (parts[2] === "security-keys") return "ListSecurityKeys";
          }
        }
        if (parts.length === 4) {
          if (
            req.method === "PUT" &&
            parts[2] === "task" &&
            parts[3] === "template"
          )
            return "CreateTaskTemplate";
          if (
            req.method === "GET" &&
            parts[2] === "task" &&
            parts[3] === "template"
          )
            return "ListTaskTemplates";
          if (req.method === "GET" && parts[2] === "attribute")
            return "DescribeInstanceAttribute";
          if (req.method === "GET" && parts[2] === "storage-config")
            return "DescribeInstanceStorageConfig";
          if (req.method === "DELETE" && parts[2] === "storage-config")
            return "DisassociateInstanceStorageConfig";
          if (req.method === "DELETE" && parts[2] === "security-key")
            return "DisassociateSecurityKey";
          if (
            req.method === "DELETE" &&
            parts[2] === "integration-associations"
          )
            return "DeleteIntegrationAssociation";
        }
        if (parts.length === 5) {
          if (
            req.method === "PUT" &&
            parts[2] === "integration-associations" &&
            parts[4] === "use-cases"
          )
            return "CreateUseCase";
          if (
            req.method === "GET" &&
            parts[2] === "integration-associations" &&
            parts[4] === "use-cases"
          )
            return "ListUseCases";
          if (
            req.method === "DELETE" &&
            parts[2] === "task" &&
            parts[3] === "template"
          )
            return "DeleteTaskTemplate";
          if (
            req.method === "GET" &&
            parts[2] === "task" &&
            parts[3] === "template"
          )
            return "GetTaskTemplate";
        }
        if (parts.length === 6) {
          if (
            req.method === "DELETE" &&
            parts[2] === "integration-associations" &&
            parts[4] === "use-cases"
          )
            return "DeleteUseCase";
        }
        return undefined;

      case "evaluation-forms":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateEvaluationForm";
        if (parts.length === 2 && req.method === "GET")
          return "ListEvaluationForms";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeEvaluationForm";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteEvaluationForm";
        if (
          parts.length === 4 &&
          parts[3] === "versions" &&
          req.method === "GET"
        )
          return "ListEvaluationFormVersions";
        if (
          parts.length === 4 &&
          parts[3] === "activate" &&
          req.method === "POST"
        )
          return "ActivateEvaluationForm";
        if (
          parts.length === 4 &&
          parts[3] === "deactivate" &&
          req.method === "POST"
        )
          return "DeactivateEvaluationForm";
        return undefined;

      case "analytics-data":
        if (parts[1] === "instance" && parts.length === 4) {
          if (parts[3] === "association" && req.method === "PUT")
            return "AssociateAnalyticsDataSet";
          if (parts[3] === "association" && req.method === "POST")
            return "DisassociateAnalyticsDataSet";
          if (parts[3] === "association" && req.method === "GET")
            return "ListAnalyticsDataAssociations";
          if (parts[3] === "associations" && req.method === "PUT")
            return "BatchAssociateAnalyticsDataSet";
          if (parts[3] === "associations" && req.method === "POST")
            return "BatchDisassociateAnalyticsDataSet";
          if (parts[3] === "datasets" && req.method === "GET")
            return "ListAnalyticsDataLakeDataSets";
        }
        return undefined;

      case "contacts":
        if (parts.length === 3 && req.method === "GET")
          return "DescribeContact";
        if (parts.length === 3 && req.method === "POST") return "UpdateContact";
        if (parts.length === 4 && req.method === "POST") {
          if (parts[3] === "associate-user") return "AssociateContactWithUser";
          if (parts[3] === "routing-data") return "UpdateContactRoutingData";
        }
        return undefined;

      case "default-vocabulary":
        if (parts.length === 3 && req.method === "PUT")
          return "AssociateDefaultVocabulary";
        return undefined;

      case "email-addresses":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateEmailAddress";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeEmailAddress";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteEmailAddress";
        if (
          parts.length === 4 &&
          parts[3] === "associate-alias" &&
          req.method === "POST"
        )
          return "AssociateEmailAddressAlias";
        if (
          parts.length === 4 &&
          parts[3] === "disassociate-alias" &&
          req.method === "POST"
        )
          return "DisassociateEmailAddressAlias";
        return undefined;

      case "flow-associations":
        if (parts.length === 2 && req.method === "PUT") return "AssociateFlow";
        if (parts.length === 4 && req.method === "GET")
          return "GetFlowAssociation";
        if (parts.length === 4 && req.method === "DELETE")
          return "DisassociateFlow";
        return undefined;

      case "hours-of-operations":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateHoursOfOperation";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeHoursOfOperation";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteHoursOfOperation";
        if (parts.length === 4 && parts[3] === "hours" && req.method === "GET")
          return "ListChildHoursOfOperations";
        if (
          parts.length === 4 &&
          parts[3] === "associate-hours" &&
          req.method === "POST"
        )
          return "AssociateHoursOfOperations";
        if (
          parts.length === 4 &&
          parts[3] === "disassociate-hours" &&
          req.method === "POST"
        )
          return "DisassociateHoursOfOperations";
        if (
          parts.length === 4 &&
          parts[3] === "overrides" &&
          req.method === "GET"
        )
          return "ListHoursOfOperationOverrides";
        if (
          parts.length === 4 &&
          parts[3] === "overrides" &&
          req.method === "PUT"
        )
          return "CreateHoursOfOperationOverride";
        if (
          parts.length === 5 &&
          parts[3] === "overrides" &&
          req.method === "GET"
        )
          return "DescribeHoursOfOperationOverride";
        if (
          parts.length === 5 &&
          parts[3] === "overrides" &&
          req.method === "DELETE"
        )
          return "DeleteHoursOfOperationOverride";
        return undefined;

      case "phone-number":
        if (parts.length === 2 && parts[1] === "claim" && req.method === "POST")
          return "ClaimPhoneNumber";
        if (
          parts.length === 2 &&
          parts[1] === "import" &&
          req.method === "POST"
        )
          return "ImportPhoneNumber";
        if (parts.length === 2 && parts[1] === "list" && req.method === "POST")
          return "ListPhoneNumbersV2";
        if (
          parts.length === 2 &&
          parts[1] === "search-available" &&
          req.method === "POST"
        )
          return "SearchAvailablePhoneNumbers";
        if (parts.length === 2 && req.method === "GET")
          return "DescribePhoneNumber";
        if (parts.length === 2 && req.method === "DELETE")
          return "ReleasePhoneNumber";
        if (
          parts.length === 3 &&
          parts[2] === "contact-flow" &&
          req.method === "PUT"
        )
          return "AssociatePhoneNumberContactFlow";
        if (
          parts.length === 3 &&
          parts[2] === "contact-flow" &&
          req.method === "DELETE"
        )
          return "DisassociatePhoneNumberContactFlow";
        return undefined;

      case "queues":
        if (parts.length === 2 && req.method === "PUT") return "CreateQueue";
        if (parts.length === 3 && req.method === "GET") return "DescribeQueue";
        if (parts.length === 3 && req.method === "DELETE") return "DeleteQueue";
        if (parts.length === 4 && req.method === "GET") {
          if (parts[3] === "email-addresses") return "ListQueueEmailAddresses";
          if (parts[3] === "quick-connects") return "ListQueueQuickConnects";
        }
        if (parts.length === 4 && req.method === "POST") {
          if (parts[3] === "associate-email-addresses")
            return "AssociateQueueEmailAddresses";
          if (parts[3] === "associate-quick-connects")
            return "AssociateQueueQuickConnects";
          if (parts[3] === "disassociate-email-addresses")
            return "DisassociateQueueEmailAddresses";
          if (parts[3] === "disassociate-quick-connects")
            return "DisassociateQueueQuickConnects";
        }
        return undefined;

      case "routing-profiles":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateRoutingProfile";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeRoutingProfile";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteRoutingProfile";
        if (parts.length === 4 && req.method === "GET") {
          if (parts[3] === "queues") return "ListRoutingProfileQueues";
          if (parts[3] === "manual-assignment-queues")
            return "ListRoutingProfileManualAssignmentQueues";
        }
        if (
          parts.length === 4 &&
          parts[3] === "associate-queues" &&
          req.method === "POST"
        )
          return "AssociateRoutingProfileQueues";
        if (
          parts.length === 4 &&
          parts[3] === "disassociate-queues" &&
          req.method === "POST"
        )
          return "DisassociateRoutingProfileQueues";
        return undefined;

      case "security-profiles":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateSecurityProfile";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeSecurityProfile";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteSecurityProfile";
        return undefined;

      case "associate-security-profiles":
        if (parts.length === 2 && req.method === "POST")
          return "AssociateSecurityProfiles";
        return undefined;

      case "disassociate-security-profiles":
        if (parts.length === 2 && req.method === "POST")
          return "DisassociateSecurityProfiles";
        return undefined;

      case "traffic-distribution-group":
        if (parts.length === 1 && req.method === "PUT")
          return "CreateTrafficDistributionGroup";
        if (parts.length === 2 && req.method === "GET")
          return "DescribeTrafficDistributionGroup";
        if (parts.length === 2 && req.method === "DELETE")
          return "DeleteTrafficDistributionGroup";
        if (parts.length === 3 && parts[2] === "user" && req.method === "PUT")
          return "AssociateTrafficDistributionGroupUser";
        if (
          parts.length === 3 &&
          parts[2] === "user" &&
          req.method === "DELETE"
        )
          return "DisassociateTrafficDistributionGroupUser";
        if (parts.length === 3 && parts[2] === "user" && req.method === "GET")
          return "ListTrafficDistributionGroupUsers";
        return undefined;

      case "users":
        if (parts.length === 2 && req.method === "PUT") return "CreateUser";
        if (parts.length === 3 && req.method === "GET") return "DescribeUser";
        if (parts.length === 3 && req.method === "DELETE") return "DeleteUser";
        if (
          parts.length === 4 &&
          parts[3] === "associate-proficiencies" &&
          req.method === "POST"
        )
          return "AssociateUserProficiencies";
        if (
          parts.length === 4 &&
          parts[3] === "disassociate-proficiencies" &&
          req.method === "POST"
        )
          return "DisassociateUserProficiencies";
        if (
          parts.length === 4 &&
          parts[3] === "contact" &&
          req.method === "POST"
        )
          return "DismissUserContact";
        if (
          parts.length === 4 &&
          parts[3] === "notifications" &&
          req.method === "GET"
        )
          return "ListUserNotifications";
        if (
          parts.length === 4 &&
          parts[3] === "proficiencies" &&
          req.method === "GET"
        )
          return "ListUserProficiencies";
        if (parts.length === 4 && parts[3] === "status" && req.method === "PUT")
          return "PutUserStatus";
        return undefined;

      case "user-hierarchy-groups":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateUserHierarchyGroup";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeUserHierarchyGroup";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteUserHierarchyGroup";
        return undefined;

      case "user-hierarchy-structure":
        if (parts.length === 2 && req.method === "GET")
          return "DescribeUserHierarchyStructure";
        return undefined;

      case "attached-files":
        if (parts.length === 2 && req.method === "PUT")
          return "StartAttachedFileUpload";
        if (parts.length === 2 && req.method === "POST")
          return "BatchGetAttachedFileMetadata";
        if (parts.length === 3 && req.method === "GET")
          return "GetAttachedFile";
        if (parts.length === 3 && req.method === "POST")
          return "CompleteAttachedFileUpload";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteAttachedFile";
        return undefined;

      case "flow-associations-batch":
        if (parts.length === 2 && req.method === "POST")
          return "BatchGetFlowAssociation";
        return undefined;

      case "agent-status":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateAgentStatus";
        if (parts.length === 2 && req.method === "GET")
          return "ListAgentStatuses";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeAgentStatus";
        if (parts.length === 3 && req.method === "POST")
          return "UpdateAgentStatus";
        return undefined;

      case "contact":
        if (parts.length === 2) {
          if (parts[1] === "create-contact" && req.method === "PUT")
            return "CreateContact";
          if (parts[1] === "create-participant" && req.method === "POST")
            return "CreateParticipant";
          if (parts[1] === "attributes" && req.method === "POST")
            return "UpdateContactAttributes";
          if (parts[1] === "schedule" && req.method === "POST")
            return "UpdateContactSchedule";
          if (parts[1] === "monitor" && req.method === "POST")
            return "MonitorContact";
          if (parts[1] === "pause" && req.method === "POST")
            return "PauseContact";
          if (parts[1] === "resume" && req.method === "POST")
            return "ResumeContact";
          if (parts[1] === "resume-recording" && req.method === "POST")
            return "ResumeContactRecording";
          if (parts[1] === "chat" && req.method === "PUT")
            return "StartChatContact";
          if (parts[1] === "email" && req.method === "PUT")
            return "StartEmailContact";
          if (parts[1] === "outbound-chat" && req.method === "PUT")
            return "StartOutboundChatContact";
          if (parts[1] === "outbound-email" && req.method === "PUT")
            return "StartOutboundEmailContact";
          if (parts[1] === "outbound-voice" && req.method === "PUT")
            return "StartOutboundVoiceContact";
          if (parts[1] === "screen-sharing" && req.method === "PUT")
            return "StartScreenSharing";
          if (
            parts[1] === "start-contact-media-processing" &&
            req.method === "POST"
          )
            return "StartContactMediaProcessing";
          if (parts[1] === "start-recording" && req.method === "POST")
            return "StartContactRecording";
          if (parts[1] === "start-streaming" && req.method === "POST")
            return "StartContactStreaming";
          if (parts[1] === "task" && req.method === "PUT")
            return "StartTaskContact";
          if (parts[1] === "webrtc" && req.method === "PUT")
            return "StartWebRTCContact";
          if (parts[1] === "stop" && req.method === "POST")
            return "StopContact";
          if (
            parts[1] === "stop-contact-media-processing" &&
            req.method === "POST"
          )
            return "StopContactMediaProcessing";
          if (parts[1] === "stop-recording" && req.method === "POST")
            return "StopContactRecording";
          if (parts[1] === "stop-streaming" && req.method === "POST")
            return "StopContactStreaming";
          if (parts[1] === "suspend-recording" && req.method === "POST")
            return "SuspendContactRecording";
          if (parts[1] === "tags" && req.method === "POST") return "TagContact";
        }
        if (parts.length === 3 && parts[1] === "batch" && req.method === "PUT")
          return "BatchPutContact";
        if (
          parts.length === 3 &&
          parts[1] === "associated" &&
          req.method === "GET"
        )
          return "ListAssociatedContacts";
        if (
          parts.length === 4 &&
          parts[1] === "references" &&
          req.method === "GET"
        )
          return "ListContactReferences";
        if (
          parts.length === 4 &&
          parts[1] === "attributes" &&
          req.method === "GET"
        )
          return "GetContactAttributes";
        if (
          parts.length === 4 &&
          parts[1] === "persistent-contact-association" &&
          req.method === "POST"
        )
          return "CreatePersistentContactAssociation";
        if (
          parts.length === 4 &&
          parts[1] === "list-real-time-analysis-segments-v2" &&
          req.method === "POST"
        )
          return "ListRealtimeContactAnalysisSegmentsV2";
        return undefined;

      case "contact-flows":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateContactFlow";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeContactFlow";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteContactFlow";
        if (
          parts.length === 4 &&
          req.method === "GET" &&
          parts[3] === "versions"
        )
          return "ListContactFlowVersions";
        if (
          parts.length === 4 &&
          req.method === "PUT" &&
          parts[3] === "version"
        )
          return "CreateContactFlowVersion";
        if (parts.length === 4 && req.method === "POST") {
          if (parts[3] === "content") return "UpdateContactFlowContent";
          if (parts[3] === "metadata") return "UpdateContactFlowMetadata";
          if (parts[3] === "name") return "UpdateContactFlowName";
        }
        if (
          parts.length === 5 &&
          parts[3] === "version" &&
          req.method === "DELETE"
        )
          return "DeleteContactFlowVersion";
        return undefined;

      case "contact-flow-modules":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateContactFlowModule";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeContactFlowModule";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteContactFlowModule";
        if (parts.length === 4 && req.method === "GET") {
          if (parts[3] === "aliases") return "ListContactFlowModuleAliases";
          if (parts[3] === "versions") return "ListContactFlowModuleVersions";
        }
        if (parts.length === 4 && req.method === "PUT") {
          if (parts[3] === "alias") return "CreateContactFlowModuleAlias";
          if (parts[3] === "version") return "CreateContactFlowModuleVersion";
        }
        if (parts.length === 4 && req.method === "POST") {
          if (parts[3] === "content") return "UpdateContactFlowModuleContent";
          if (parts[3] === "metadata") return "UpdateContactFlowModuleMetadata";
        }
        if (parts.length === 5 && parts[3] === "alias") {
          if (req.method === "GET") return "DescribeContactFlowModuleAlias";
          if (req.method === "POST") return "UpdateContactFlowModuleAlias";
          if (req.method === "DELETE") return "DeleteContactFlowModuleAlias";
        }
        if (
          parts.length === 5 &&
          parts[3] === "version" &&
          req.method === "DELETE"
        )
          return "DeleteContactFlowModuleVersion";
        return undefined;

      case "data-tables":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateDataTable";
        if (parts.length === 2 && req.method === "GET") return "ListDataTables";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeDataTable";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteDataTable";
        if (
          parts.length === 4 &&
          parts[3] === "attributes" &&
          req.method === "POST"
        )
          return "ListDataTableAttributes";
        if (
          parts.length === 4 &&
          parts[3] === "attributes" &&
          req.method === "PUT"
        )
          return "CreateDataTableAttribute";
        if (
          parts.length === 5 &&
          parts[3] === "attributes" &&
          req.method === "GET"
        )
          return "DescribeDataTableAttribute";
        if (
          parts.length === 5 &&
          parts[3] === "attributes" &&
          req.method === "DELETE"
        )
          return "DeleteDataTableAttribute";
        if (
          parts.length === 5 &&
          parts[3] === "values" &&
          req.method === "POST"
        ) {
          if (parts[4] === "create") return "BatchCreateDataTableValue";
          if (parts[4] === "delete") return "BatchDeleteDataTableValue";
          if (parts[4] === "describe") return "BatchDescribeDataTableValue";
          if (parts[4] === "update") return "BatchUpdateDataTableValue";
          if (parts[4] === "evaluate") return "EvaluateDataTableValues";
          if (parts[4] === "list-primary") return "ListDataTablePrimaryValues";
          if (parts[4] === "list") return "ListDataTableValues";
        }
        return undefined;

      case "notifications":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateNotification";
        if (parts.length === 2 && req.method === "GET")
          return "ListNotifications";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeNotification";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteNotification";
        return undefined;

      case "predefined-attributes":
        if (parts.length === 2 && req.method === "PUT")
          return "CreatePredefinedAttribute";
        if (parts.length === 2 && req.method === "GET")
          return "ListPredefinedAttributes";
        if (parts.length === 3 && req.method === "GET")
          return "DescribePredefinedAttribute";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeletePredefinedAttribute";
        return undefined;

      case "prompts":
        if (parts.length === 2 && req.method === "PUT") return "CreatePrompt";
        if (parts.length === 3 && req.method === "GET") return "DescribePrompt";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeletePrompt";
        if (parts.length === 4 && parts[3] === "file" && req.method === "GET")
          return "GetPromptFile";
        return undefined;

      case "push-notification":
        if (
          parts.length === 3 &&
          parts[2] === "registrations" &&
          req.method === "PUT"
        )
          return "CreatePushNotificationRegistration";
        if (
          parts.length === 4 &&
          parts[2] === "registrations" &&
          req.method === "DELETE"
        )
          return "DeletePushNotificationRegistration";
        return undefined;

      case "quick-connects":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateQuickConnect";
        if (parts.length === 2 && req.method === "GET")
          return "ListQuickConnects";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeQuickConnect";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteQuickConnect";
        return undefined;

      case "rules":
        if (parts.length === 2 && req.method === "POST") return "CreateRule";
        if (parts.length === 2 && req.method === "GET") return "ListRules";
        if (parts.length === 3 && req.method === "GET") return "DescribeRule";
        if (parts.length === 3 && req.method === "DELETE") return "DeleteRule";
        return undefined;

      case "test-cases":
        if (parts.length === 2 && req.method === "PUT") return "CreateTestCase";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeTestCase";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteTestCase";
        if (
          parts.length === 4 &&
          parts[3] === "start-execution" &&
          req.method === "PUT"
        )
          return "StartTestCaseExecution";
        if (
          parts.length === 5 &&
          parts[4] === "summary" &&
          req.method === "GET"
        )
          return "GetTestCaseExecutionSummary";
        if (
          parts.length === 5 &&
          parts[4] === "records" &&
          req.method === "GET"
        )
          return "ListTestCaseExecutionRecords";
        if (
          parts.length === 5 &&
          parts[4] === "stop-execution" &&
          req.method === "POST"
        )
          return "StopTestCaseExecution";
        return undefined;

      case "attached-files-configurations":
        if (parts.length === 2 && req.method === "GET")
          return "ListAttachedFilesConfigurations";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeAttachedFilesConfiguration";
        if (parts.length === 3 && req.method === "POST")
          return "UpdateAttachedFilesConfiguration";
        return undefined;

      case "authentication-profiles":
        if (parts.length === 3 && req.method === "GET")
          return "DescribeAuthenticationProfile";
        if (parts.length === 3 && req.method === "POST")
          return "UpdateAuthenticationProfile";
        return undefined;

      case "authentication-profiles-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListAuthenticationProfiles";
        return undefined;

      case "contact-flows-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListContactFlows";
        return undefined;

      case "contact-flow-modules-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListContactFlowModules";
        return undefined;

      case "contact-evaluations":
        if (parts.length === 2 && req.method === "PUT")
          return "StartContactEvaluation";
        if (parts.length === 2 && req.method === "GET")
          return "ListContactEvaluations";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeContactEvaluation";
        if (parts.length === 3 && req.method === "POST")
          return "UpdateContactEvaluation";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteContactEvaluation";
        if (
          parts.length === 4 &&
          parts[3] === "submit" &&
          req.method === "POST"
        )
          return "SubmitContactEvaluation";
        return undefined;

      case "views":
        if (parts.length === 2 && req.method === "PUT") return "CreateView";
        if (parts.length === 2 && req.method === "GET") return "ListViews";
        if (parts.length === 3 && req.method === "GET") return "DescribeView";
        if (parts.length === 3 && req.method === "DELETE") return "DeleteView";
        if (
          parts.length === 4 &&
          parts[3] === "versions" &&
          req.method === "PUT"
        )
          return "CreateViewVersion";
        if (
          parts.length === 4 &&
          parts[3] === "versions" &&
          req.method === "GET"
        )
          return "ListViewVersions";
        if (
          parts.length === 5 &&
          parts[3] === "versions" &&
          req.method === "DELETE"
        )
          return "DeleteViewVersion";
        return undefined;

      case "vocabulary":
        if (parts.length === 2 && req.method === "POST")
          return "CreateVocabulary";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeVocabulary";
        return undefined;

      case "vocabulary-remove":
        if (parts.length === 3 && req.method === "POST")
          return "DeleteVocabulary";
        return undefined;

      case "workspaces":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateWorkspace";
        if (parts.length === 2 && req.method === "GET") return "ListWorkspaces";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeWorkspace";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteWorkspace";
        if (
          parts.length === 4 &&
          parts[3] === "associate" &&
          req.method === "POST"
        )
          return "AssociateWorkspace";
        if (
          parts.length === 4 &&
          parts[3] === "disassociate" &&
          req.method === "POST"
        )
          return "DisassociateWorkspace";
        if (parts.length === 4 && parts[3] === "pages" && req.method === "GET")
          return "ListWorkspacePages";
        if (parts.length === 4 && parts[3] === "pages" && req.method === "PUT")
          return "CreateWorkspacePage";
        if (
          parts.length === 5 &&
          parts[3] === "pages" &&
          req.method === "DELETE"
        )
          return "DeleteWorkspacePage";
        if (
          parts.length === 4 &&
          parts[3] === "media" &&
          req.method === "DELETE"
        )
          return "DeleteWorkspaceMedia";
        if (parts.length === 4 && parts[3] === "media" && req.method === "POST")
          return "ImportWorkspaceMedia";
        if (parts.length === 4 && parts[3] === "media" && req.method === "GET")
          return "ListWorkspaceMedia";
        return undefined;

      case "metrics":
        if (
          parts[1] === "contact" &&
          parts.length === 2 &&
          req.method === "POST"
        )
          return "GetContactMetrics";
        if (
          parts[1] === "current" &&
          parts.length === 3 &&
          req.method === "POST"
        )
          return "GetCurrentMetricData";
        if (
          parts[1] === "userdata" &&
          parts.length === 3 &&
          req.method === "POST"
        )
          return "GetCurrentUserData";
        if (
          parts[1] === "historical" &&
          parts.length === 3 &&
          req.method === "POST"
        )
          return "GetMetricData";
        if (parts[1] === "data" && parts.length === 2 && req.method === "POST")
          return "GetMetricDataV2";
        return undefined;

      case "effective-hours-of-operations":
        if (parts.length === 3 && req.method === "GET")
          return "GetEffectiveHoursOfOperations";
        return undefined;

      case "user":
        if (
          parts.length === 3 &&
          parts[1] === "federate" &&
          req.method === "GET"
        )
          return "GetFederationToken";
        return undefined;

      case "traffic-distribution":
        if (parts.length === 2 && req.method === "GET")
          return "GetTrafficDistribution";
        return undefined;

      case "default-vocabulary-summary":
        if (parts.length === 2 && req.method === "POST")
          return "ListDefaultVocabularies";
        return undefined;

      case "entity-security-profiles-summary":
        if (parts.length === 2 && req.method === "POST")
          return "ListEntitySecurityProfiles";
        return undefined;

      case "flow-associations-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListFlowAssociations";
        return undefined;

      case "hours-of-operations-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListHoursOfOperations";
        return undefined;

      case "phone-numbers-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListPhoneNumbers";
        return undefined;

      case "prompts-summary":
        if (parts.length === 2 && req.method === "GET") return "ListPrompts";
        return undefined;

      case "queues-summary":
        if (parts.length === 2 && req.method === "GET") return "ListQueues";
        return undefined;

      case "routing-profiles-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListRoutingProfiles";
        return undefined;

      case "security-profiles-applications":
        if (parts.length === 3 && req.method === "GET")
          return "ListSecurityProfileApplications";
        return undefined;

      case "security-profiles-flow-modules":
        if (parts.length === 3 && req.method === "GET")
          return "ListSecurityProfileFlowModules";
        return undefined;

      case "security-profiles-permissions":
        if (parts.length === 3 && req.method === "GET")
          return "ListSecurityProfilePermissions";
        return undefined;

      case "security-profiles-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListSecurityProfiles";
        return undefined;

      case "tags":
        if (parts.length === 2 && req.method === "GET")
          return "ListTagsForResource";
        if (parts.length === 2 && req.method === "POST") return "TagResource";
        return undefined;

      case "test-case-executions":
        if (parts.length === 2 && req.method === "GET")
          return "ListTestCaseExecutions";
        return undefined;

      case "test-cases-summary":
        if (parts.length === 2 && req.method === "GET") return "ListTestCases";
        return undefined;

      case "traffic-distribution-groups":
        if (parts.length === 1 && req.method === "GET")
          return "ListTrafficDistributionGroups";
        return undefined;

      case "user-hierarchy-groups-summary":
        if (parts.length === 2 && req.method === "GET")
          return "ListUserHierarchyGroups";
        return undefined;

      case "users-summary":
        if (parts.length === 2 && req.method === "GET") return "ListUsers";
        return undefined;

      case "search-agent-statuses":
        if (parts.length === 1 && req.method === "POST")
          return "SearchAgentStatuses";
        return undefined;

      case "search-available-phone-numbers":
        if (parts.length === 1 && req.method === "POST")
          return "SearchAvailablePhoneNumbers";
        return undefined;

      case "search-contact-evaluations":
        if (parts.length === 1 && req.method === "POST")
          return "SearchContactEvaluations";
        return undefined;

      case "search-contact-flow-modules":
        if (parts.length === 1 && req.method === "POST")
          return "SearchContactFlowModules";
        return undefined;

      case "search-contact-flows":
        if (parts.length === 1 && req.method === "POST")
          return "SearchContactFlows";
        return undefined;

      case "search-contacts":
        if (parts.length === 1 && req.method === "POST")
          return "SearchContacts";
        return undefined;

      case "search-data-tables":
        if (parts.length === 1 && req.method === "POST")
          return "SearchDataTables";
        return undefined;

      case "search-email-addresses":
        if (parts.length === 1 && req.method === "POST")
          return "SearchEmailAddresses";
        return undefined;

      case "search-evaluation-forms":
        if (parts.length === 1 && req.method === "POST")
          return "SearchEvaluationForms";
        return undefined;

      case "search-hours-of-operation-overrides":
        if (parts.length === 1 && req.method === "POST")
          return "SearchHoursOfOperationOverrides";
        return undefined;

      case "search-hours-of-operations":
        if (parts.length === 1 && req.method === "POST")
          return "SearchHoursOfOperations";
        return undefined;

      case "search-notifications":
        if (parts.length === 1 && req.method === "POST")
          return "SearchNotifications";
        return undefined;

      case "search-predefined-attributes":
        if (parts.length === 1 && req.method === "POST")
          return "SearchPredefinedAttributes";
        return undefined;

      case "search-prompts":
        if (parts.length === 1 && req.method === "POST") return "SearchPrompts";
        return undefined;

      case "search-queues":
        if (parts.length === 1 && req.method === "POST") return "SearchQueues";
        return undefined;

      case "search-quick-connects":
        if (parts.length === 1 && req.method === "POST")
          return "SearchQuickConnects";
        return undefined;

      case "search-resource-tags":
        if (parts.length === 1 && req.method === "POST")
          return "SearchResourceTags";
        return undefined;

      case "search-routing-profiles":
        if (parts.length === 1 && req.method === "POST")
          return "SearchRoutingProfiles";
        return undefined;

      case "search-security-profiles":
        if (parts.length === 1 && req.method === "POST")
          return "SearchSecurityProfiles";
        return undefined;

      case "search-test-cases":
        if (parts.length === 1 && req.method === "POST")
          return "SearchTestCases";
        return undefined;

      case "search-user-hierarchy-groups":
        if (parts.length === 1 && req.method === "POST")
          return "SearchUserHierarchyGroups";
        return undefined;

      case "search-users":
        if (parts.length === 1 && req.method === "POST") return "SearchUsers";
        return undefined;

      case "search-views":
        if (parts.length === 1 && req.method === "POST") return "SearchViews";
        return undefined;

      case "vocabulary-summary":
        if (parts.length === 2 && req.method === "POST")
          return "SearchVocabularies";
        return undefined;

      case "search-workspace-associations":
        if (parts.length === 1 && req.method === "POST")
          return "SearchWorkspaceAssociations";
        return undefined;

      case "search-workspaces":
        if (parts.length === 1 && req.method === "POST")
          return "SearchWorkspaces";
        return undefined;

      case "chat-integration-event":
        if (parts.length === 1 && req.method === "POST")
          return "SendChatIntegrationEvent";
        return undefined;

      default:
        return undefined;
    }
  },
  operations: {
    CreateInstance,
    DescribeInstance,
    ListInstances,
    DeleteInstance,
    DeleteAttachedFile,
    DismissUserContact,
    DeleteContactEvaluation,
    DeleteContactFlow,
    DeleteContactFlowModule,
    DeleteContactFlowModuleAlias,
    DeleteContactFlowModuleVersion,
    DeleteContactFlowVersion,
    DeleteDataTable,
    DeleteDataTableAttribute,
    DeleteEmailAddress,
    DeleteEvaluationForm,
    DeleteHoursOfOperation,
    DeleteHoursOfOperationOverride,
    DeleteIntegrationAssociation,
    DeleteNotification,
    DeletePredefinedAttribute,
    DeletePrompt,
    DeletePushNotificationRegistration,
    DeleteQueue,
    DeleteQuickConnect,
    DeleteRoutingProfile,
    DeleteRule,
    DeleteSecurityProfile,
    DeleteTaskTemplate,
    DeleteTestCase,
    DeleteTrafficDistributionGroup,
    DeleteUseCase,
    DeleteUser,
    DeleteUserHierarchyGroup,
    DeleteView,
    DeleteViewVersion,
    DeleteVocabulary,
    DeleteWorkspace,
    DeleteWorkspaceMedia,
    DeleteWorkspacePage,
    ActivateEvaluationForm,
    DeactivateEvaluationForm,
    AssociateAnalyticsDataSet,
    AssociateApprovedOrigin,
    AssociateBot,
    AssociateContactWithUser,
    AssociateDefaultVocabulary,
    AssociateEmailAddressAlias,
    AssociateFlow,
    AssociateHoursOfOperations,
    AssociateInstanceStorageConfig,
    AssociateLambdaFunction,
    AssociateLexBot,
    AssociatePhoneNumberContactFlow,
    AssociateQueueEmailAddresses,
    AssociateQueueQuickConnects,
    AssociateRoutingProfileQueues,
    AssociateSecurityKey,
    AssociateSecurityProfiles,
    AssociateTrafficDistributionGroupUser,
    AssociateUserProficiencies,
    AssociateWorkspace,
    BatchAssociateAnalyticsDataSet,
    BatchDisassociateAnalyticsDataSet,
    BatchCreateDataTableValue,
    BatchDeleteDataTableValue,
    BatchDescribeDataTableValue,
    BatchGetAttachedFileMetadata,
    BatchGetFlowAssociation,
    EvaluateDataTableValues,
    BatchPutContact,
    BatchUpdateDataTableValue,
    ClaimPhoneNumber,
    CompleteAttachedFileUpload,
    CreateAgentStatus,
    CreateContact,
    CreateContactFlow,
    CreateContactFlowModule,
    CreateContactFlowModuleAlias,
    CreateContactFlowModuleVersion,
    CreateContactFlowVersion,
    CreateDataTable,
    CreateDataTableAttribute,
    CreateEmailAddress,
    CreateEvaluationForm,
    CreateHoursOfOperation,
    CreateHoursOfOperationOverride,
    CreateIntegrationAssociation,
    CreateNotification,
    CreateParticipant,
    CreatePersistentContactAssociation,
    CreatePredefinedAttribute,
    CreatePrompt,
    CreatePushNotificationRegistration,
    CreateQueue,
    CreateQuickConnect,
    CreateRoutingProfile,
    CreateRule,
    CreateSecurityProfile,
    CreateTaskTemplate,
    CreateTestCase,
    CreateTrafficDistributionGroup,
    CreateUseCase,
    CreateUser,
    CreateUserHierarchyGroup,
    CreateView,
    CreateViewVersion,
    CreateVocabulary,
    CreateWorkspace,
    CreateWorkspacePage,
    DescribeAgentStatus,
    DescribeAttachedFilesConfiguration,
    GetAttachedFile,
    GetContactAttributes,
    GetContactMetrics,
    GetCurrentMetricData,
    GetCurrentUserData,
    GetEffectiveHoursOfOperations,
    GetFederationToken,
    GetFlowAssociation,
    GetMetricData,
    GetMetricDataV2,
    GetPromptFile,
    GetTaskTemplate,
    GetTestCaseExecutionSummary,
    GetTrafficDistribution,
    ImportPhoneNumber,
    ImportWorkspaceMedia,
    ListAgentStatuses,
    ListAnalyticsDataAssociations,
    ListAnalyticsDataLakeDataSets,
    ListApprovedOrigins,
    ListAssociatedContacts,
    ListAttachedFilesConfigurations,
    ListAuthenticationProfiles,
    ListBots,
    ListChildHoursOfOperations,
    ListContactEvaluations,
    ListContactFlowModuleAliases,
    ListContactFlowModuleVersions,
    ListContactFlowModules,
    ListContactFlowVersions,
    ListContactFlows,
    ListContactReferences,
    ListDataTableAttributes,
    ListDataTablePrimaryValues,
    ListDataTableValues,
    ListDataTables,
    ListDefaultVocabularies,
    ListEntitySecurityProfiles,
    ListEvaluationFormVersions,
    ListEvaluationForms,
    ListFlowAssociations,
    ListHoursOfOperationOverrides,
    ListHoursOfOperations,
    ListInstanceAttributes,
    ListInstanceStorageConfigs,
    ListIntegrationAssociations,
    ListLambdaFunctions,
    ListLexBots,
    ListNotifications,
    ListPhoneNumbers,
    ListPhoneNumbersV2,
    ListPredefinedAttributes,
    ListPrompts,
    ListQueueEmailAddresses,
    ListQueueQuickConnects,
    ListQueues,
    ListQuickConnects,
    ListRoutingProfileManualAssignmentQueues,
    ListRoutingProfileQueues,
    ListRoutingProfiles,
    ListRules,
    ListSecurityKeys,
    ListSecurityProfileApplications,
    ListSecurityProfileFlowModules,
    ListSecurityProfilePermissions,
    ListSecurityProfiles,
    ListTagsForResource,
    ListTaskTemplates,
    ListTestCaseExecutionRecords,
    ListTestCaseExecutions,
    ListTestCases,
    ListTrafficDistributionGroupUsers,
    ListTrafficDistributionGroups,
    ListUseCases,
    ListUserHierarchyGroups,
    ListUserNotifications,
    ListUserProficiencies,
    ListUsers,
    ListViewVersions,
    ListViews,
    ListWorkspaceMedia,
    ListWorkspacePages,
    ListWorkspaces,
    ListRealtimeContactAnalysisSegmentsV2,
    DescribeAuthenticationProfile,
    DescribeContact,
    DescribeContactEvaluation,
    DescribeContactFlow,
    DescribeContactFlowModule,
    DescribeContactFlowModuleAlias,
    DescribeDataTable,
    DescribeDataTableAttribute,
    DescribeEmailAddress,
    DescribeEvaluationForm,
    DescribeHoursOfOperation,
    DescribeHoursOfOperationOverride,
    DescribeInstanceAttribute,
    DescribeInstanceStorageConfig,
    DescribeNotification,
    DescribePhoneNumber,
    DescribePredefinedAttribute,
    DescribePrompt,
    DescribeQueue,
    DescribeQuickConnect,
    DescribeRoutingProfile,
    DescribeRule,
    DescribeSecurityProfile,
    DescribeTestCase,
    DescribeTrafficDistributionGroup,
    DescribeUser,
    DescribeUserHierarchyGroup,
    DescribeUserHierarchyStructure,
    DescribeView,
    DescribeVocabulary,
    DescribeWorkspace,
    DisassociateAnalyticsDataSet,
    DisassociateApprovedOrigin,
    DisassociateBot,
    DisassociateEmailAddressAlias,
    DisassociateFlow,
    DisassociateHoursOfOperations,
    DisassociateInstanceStorageConfig,
    DisassociateLambdaFunction,
    DisassociateLexBot,
    DisassociatePhoneNumberContactFlow,
    DisassociateQueueEmailAddresses,
    DisassociateQueueQuickConnects,
    DisassociateRoutingProfileQueues,
    DisassociateSecurityKey,
    DisassociateSecurityProfiles,
    DisassociateTrafficDistributionGroupUser,
    DisassociateUserProficiencies,
    DisassociateWorkspace,
    UpdateAgentStatus,
    UpdateAttachedFilesConfiguration,
    UpdateAuthenticationProfile,
    UpdateContact,
    UpdateContactAttributes,
    UpdateContactEvaluation,
    UpdateContactFlowContent,
    UpdateContactFlowMetadata,
    UpdateContactFlowModuleAlias,
    UpdateContactFlowModuleContent,
    UpdateContactFlowModuleMetadata,
    UpdateContactFlowName,
    UpdateContactRoutingData,
    UpdateContactSchedule,
    MonitorContact,
    PauseContact,
    PutUserStatus,
    ReleasePhoneNumber,
    ReplicateInstance,
    ResumeContact,
    ResumeContactRecording,
    SearchAgentStatuses,
    SearchAvailablePhoneNumbers,
    SearchContactEvaluations,
    SearchContactFlowModules,
    SearchContactFlows,
    SearchContacts,
    SearchDataTables,
    SearchEmailAddresses,
    SearchEvaluationForms,
    SearchHoursOfOperationOverrides,
    SearchHoursOfOperations,
    SearchNotifications,
    SearchPredefinedAttributes,
    SearchPrompts,
    SearchQueues,
    SearchQuickConnects,
    SearchResourceTags,
    SearchRoutingProfiles,
    SearchSecurityProfiles,
    SearchTestCases,
    SearchUserHierarchyGroups,
    SearchUsers,
    SearchViews,
    SearchVocabularies,
    SearchWorkspaceAssociations,
    SearchWorkspaces,
    SendChatIntegrationEvent,
    SendOutboundEmail,
    StartAttachedFileUpload,
    StartChatContact,
    StartContactEvaluation,
    StartContactMediaProcessing,
    StartContactRecording,
    StartContactStreaming,
    StartEmailContact,
    StartOutboundChatContact,
    StartOutboundEmailContact,
    StartOutboundVoiceContact,
    StartScreenSharing,
    StartTaskContact,
    StartTestCaseExecution,
    StartWebRTCContact,
    StopContact,
    StopContactMediaProcessing,
    StopContactRecording,
    StopContactStreaming,
    StopTestCaseExecution,
    SubmitContactEvaluation,
    SuspendContactRecording,
    TagContact,
    TagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default connect;
