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
          }
        }
        return undefined;

      case "evaluation-forms":
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
        if (
          parts.length === 4 &&
          parts[3] === "associate-hours" &&
          req.method === "POST"
        )
          return "AssociateHoursOfOperations";
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
        if (parts.length === 4 && req.method === "POST") {
          if (parts[3] === "associate-email-addresses")
            return "AssociateQueueEmailAddresses";
          if (parts[3] === "associate-quick-connects")
            return "AssociateQueueQuickConnects";
        }
        return undefined;

      case "routing-profiles":
        if (
          parts.length === 4 &&
          parts[3] === "associate-queues" &&
          req.method === "POST"
        )
          return "AssociateRoutingProfileQueues";
        return undefined;

      case "associate-security-profiles":
        if (parts.length === 2 && req.method === "POST")
          return "AssociateSecurityProfiles";
        return undefined;

      case "traffic-distribution-group":
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
  },
  model,
} as const satisfies ServiceDefinition;

export default connect;
