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

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const connect = {
  name: "connect",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "instance") return undefined;
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
    return undefined;
  },
  operations: {
    CreateInstance,
    DescribeInstance,
    ListInstances,
    DeleteInstance,
  },
  model,
} as const satisfies ServiceDefinition;

export default connect;
