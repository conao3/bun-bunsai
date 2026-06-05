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
  return {};
};

const CreatePrompt: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/prompt/${id}`;
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
  return { TestCaseId: id, TestCaseArn: arn };
};

const CreateTrafficDistributionGroup: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:traffic-distribution-group/${id}`;
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
      CreatedBy: `arn:aws:iam::${ctx.account}:root`,
      LastModifiedBy: `arn:aws:iam::${ctx.account}:root`,
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
      CreatedBy: `arn:aws:iam::${ctx.account}:root`,
      LastModifiedBy: `arn:aws:iam::${ctx.account}:root`,
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
          }
        }
        if (parts.length === 4) {
          if (
            req.method === "PUT" &&
            parts[2] === "task" &&
            parts[3] === "template"
          )
            return "CreateTaskTemplate";
          if (req.method === "GET" && parts[2] === "attribute")
            return "DescribeInstanceAttribute";
          if (req.method === "GET" && parts[2] === "storage-config")
            return "DescribeInstanceStorageConfig";
        }
        if (parts.length === 5) {
          if (
            req.method === "PUT" &&
            parts[2] === "integration-associations" &&
            parts[4] === "use-cases"
          )
            return "CreateUseCase";
        }
        return undefined;

      case "evaluation-forms":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateEvaluationForm";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeEvaluationForm";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteEvaluationForm";
        if (
          parts.length === 4 &&
          parts[3] === "activate" &&
          req.method === "POST"
        )
          return "ActivateEvaluationForm";
        return undefined;

      case "analytics-data":
        if (parts[1] === "instance" && parts.length === 4) {
          if (parts[3] === "association" && req.method === "PUT")
            return "AssociateAnalyticsDataSet";
          if (parts[3] === "associations" && req.method === "PUT")
            return "BatchAssociateAnalyticsDataSet";
          if (parts[3] === "associations" && req.method === "POST")
            return "BatchDisassociateAnalyticsDataSet";
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
        return undefined;

      case "flow-associations":
        if (parts.length === 2 && req.method === "PUT") return "AssociateFlow";
        return undefined;

      case "hours-of-operations":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateHoursOfOperation";
        if (parts.length === 3 && req.method === "GET")
          return "DescribeHoursOfOperation";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteHoursOfOperation";
        if (
          parts.length === 4 &&
          parts[3] === "associate-hours" &&
          req.method === "POST"
        )
          return "AssociateHoursOfOperations";
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
        return undefined;

      case "phone-number":
        if (parts.length === 2 && parts[1] === "claim" && req.method === "POST")
          return "ClaimPhoneNumber";
        if (
          parts.length === 3 &&
          parts[2] === "contact-flow" &&
          req.method === "PUT"
        )
          return "AssociatePhoneNumberContactFlow";
        return undefined;

      case "queues":
        if (parts.length === 2 && req.method === "PUT") return "CreateQueue";
        if (parts.length === 4 && req.method === "POST") {
          if (parts[3] === "associate-email-addresses")
            return "AssociateQueueEmailAddresses";
          if (parts[3] === "associate-quick-connects")
            return "AssociateQueueQuickConnects";
        }
        return undefined;

      case "routing-profiles":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateRoutingProfile";
        if (
          parts.length === 4 &&
          parts[3] === "associate-queues" &&
          req.method === "POST"
        )
          return "AssociateRoutingProfileQueues";
        return undefined;

      case "security-profiles":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateSecurityProfile";
        return undefined;

      case "associate-security-profiles":
        if (parts.length === 2 && req.method === "POST")
          return "AssociateSecurityProfiles";
        return undefined;

      case "traffic-distribution-group":
        if (parts.length === 1 && req.method === "PUT")
          return "CreateTrafficDistributionGroup";
        if (parts.length === 3 && parts[2] === "user" && req.method === "PUT")
          return "AssociateTrafficDistributionGroupUser";
        return undefined;

      case "users":
        if (parts.length === 2 && req.method === "PUT") return "CreateUser";
        if (
          parts.length === 4 &&
          parts[3] === "associate-proficiencies" &&
          req.method === "POST"
        )
          return "AssociateUserProficiencies";
        return undefined;

      case "attached-files":
        if (parts.length === 2 && req.method === "POST")
          return "BatchGetAttachedFileMetadata";
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
        }
        if (parts.length === 3 && parts[1] === "batch" && req.method === "PUT")
          return "BatchPutContact";
        if (
          parts.length === 4 &&
          parts[1] === "persistent-contact-association" &&
          req.method === "POST"
        )
          return "CreatePersistentContactAssociation";
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
        if (parts.length === 3 && req.method === "GET")
          return "DescribeDataTable";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteDataTable";
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
        }
        return undefined;

      case "notifications":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateNotification";
        return undefined;

      case "predefined-attributes":
        if (parts.length === 2 && req.method === "PUT")
          return "CreatePredefinedAttribute";
        return undefined;

      case "prompts":
        if (parts.length === 2 && req.method === "PUT") return "CreatePrompt";
        return undefined;

      case "push-notification":
        if (
          parts.length === 3 &&
          parts[2] === "registrations" &&
          req.method === "PUT"
        )
          return "CreatePushNotificationRegistration";
        return undefined;

      case "quick-connects":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateQuickConnect";
        return undefined;

      case "rules":
        if (parts.length === 2 && req.method === "POST") return "CreateRule";
        return undefined;

      case "test-cases":
        if (parts.length === 2 && req.method === "PUT") return "CreateTestCase";
        return undefined;

      case "attached-files-configurations":
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

      case "contact-evaluations":
        if (parts.length === 3 && req.method === "GET")
          return "DescribeContactEvaluation";
        if (parts.length === 3 && req.method === "POST")
          return "UpdateContactEvaluation";
        if (parts.length === 3 && req.method === "DELETE")
          return "DeleteContactEvaluation";
        return undefined;

      case "user-hierarchy-groups":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateUserHierarchyGroup";
        return undefined;

      case "views":
        if (parts.length === 2 && req.method === "PUT") return "CreateView";
        if (
          parts.length === 4 &&
          parts[3] === "versions" &&
          req.method === "PUT"
        )
          return "CreateViewVersion";
        return undefined;

      case "vocabulary":
        if (parts.length === 2 && req.method === "POST")
          return "CreateVocabulary";
        return undefined;

      case "workspaces":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateWorkspace";
        if (
          parts.length === 4 &&
          parts[3] === "associate" &&
          req.method === "POST"
        )
          return "AssociateWorkspace";
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
    ActivateEvaluationForm,
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
    DescribeAgentStatus,
    DescribeAttachedFilesConfiguration,
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
  },
  model,
} as const satisfies ServiceDefinition;

export default connect;
