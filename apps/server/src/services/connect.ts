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
  return { AssociationId: crypto.randomUUID() };
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
  return { Id: id, Arn: arn, LockVersion: 1 };
};

const CreateDataTableAttribute: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const name = requireString(input, "Name");
  const attributeId = crypto.randomUUID();
  return { Name: name, AttributeId: attributeId, LockVersion: 1 };
};

const CreateEmailAddress: OperationHandler = (input, ctx) => {
  const instanceId = requireString(input, "InstanceId");
  requireInstance(ctx, instanceId);
  const id = crypto.randomUUID();
  const arn = `arn:aws:connect:${ctx.region}:${ctx.account}:instance/${instanceId}/email-address/${id}`;
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
  const overrideId = crypto.randomUUID();
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
        if (
          parts.length === 4 &&
          parts[3] === "associate-user" &&
          req.method === "POST"
        )
          return "AssociateContactWithUser";
        return undefined;

      case "default-vocabulary":
        if (parts.length === 3 && req.method === "PUT")
          return "AssociateDefaultVocabulary";
        return undefined;

      case "email-addresses":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateEmailAddress";
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
        return undefined;

      case "flow-associations-batch":
        if (parts.length === 2 && req.method === "POST")
          return "BatchGetFlowAssociation";
        return undefined;

      case "agent-status":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateAgentStatus";
        return undefined;

      case "contact":
        if (parts.length === 2) {
          if (parts[1] === "create-contact" && req.method === "PUT")
            return "CreateContact";
          if (parts[1] === "create-participant" && req.method === "POST")
            return "CreateParticipant";
        }
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
        if (
          parts.length === 4 &&
          parts[3] === "version" &&
          req.method === "PUT"
        )
          return "CreateContactFlowVersion";
        return undefined;

      case "contact-flow-modules":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateContactFlowModule";
        if (parts.length === 4 && req.method === "PUT") {
          if (parts[3] === "alias") return "CreateContactFlowModuleAlias";
          if (parts[3] === "version") return "CreateContactFlowModuleVersion";
        }
        return undefined;

      case "data-tables":
        if (parts.length === 2 && req.method === "PUT")
          return "CreateDataTable";
        if (
          parts.length === 4 &&
          parts[3] === "attributes" &&
          req.method === "PUT"
        )
          return "CreateDataTableAttribute";
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

      default:
        return undefined;
    }
  },
  operations: {
    CreateInstance,
    DescribeInstance,
    ListInstances,
    DeleteInstance,
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
    BatchAssociateAnalyticsDataSet,
    BatchDisassociateAnalyticsDataSet,
    BatchGetAttachedFileMetadata,
    BatchGetFlowAssociation,
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
  },
  model,
} as const satisfies ServiceDefinition;

export default connect;
