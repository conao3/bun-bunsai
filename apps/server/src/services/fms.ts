import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import fmsModel from "../../../../test/vendor/aws-models/fms.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(fmsModel);

type StoredPolicy = Record<string, unknown> & {
  PolicyId: string;
  PolicyName: string;
  PolicyUpdateToken: string;
};

const policyKey = (policyId: string): string => `policy/${policyId}`;

const policyArn = (ctx: ServiceContext, policyId: string): string =>
  `arn:aws:fms:${ctx.region}:${ctx.account}:policy/${policyId}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidInputException", `${key} is required.`, 400);
  }
  return value;
};

const requirePolicy = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const policy = input["Policy"];
  if (typeof policy !== "object" || policy === null) {
    throw awsError("InvalidInputException", "Policy is required.", 400);
  }
  return policy as Record<string, unknown>;
};

const loadPolicy = (ctx: ServiceContext, policyId: string): StoredPolicy => {
  const policy = ctx.store.get<StoredPolicy>(policyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Policy not found: ${policyId}`,
      404,
    );
  }
  return policy;
};

const toSummary = (policy: StoredPolicy): Record<string, unknown> => {
  const data = policy["SecurityServicePolicyData"] as
    | Record<string, unknown>
    | undefined;
  return {
    PolicyArn: policy["PolicyArn"],
    PolicyId: policy["PolicyId"],
    PolicyName: policy["PolicyName"],
    ResourceType: policy["ResourceType"],
    SecurityServiceType: data?.["Type"],
    RemediationEnabled: policy["RemediationEnabled"],
    DeleteUnusedFMManagedResources:
      policy["DeleteUnusedFMManagedResources"] ?? false,
    PolicyStatus: policy["PolicyStatus"] ?? "ACTIVE",
  };
};

const PutPolicy: OperationHandler = (input, ctx) => {
  const requested = requirePolicy(input as Record<string, unknown>);
  const existingId =
    typeof requested["PolicyId"] === "string" && requested["PolicyId"] !== ""
      ? (requested["PolicyId"] as string)
      : crypto.randomUUID();
  const updateToken = crypto.randomUUID();
  const policy: StoredPolicy = {
    ...requested,
    PolicyId: existingId,
    PolicyName: requireString(requested, "PolicyName"),
    PolicyUpdateToken: updateToken,
    PolicyArn: policyArn(ctx, existingId),
  };
  ctx.store.set(policyKey(existingId), policy);
  return { Policy: policy, PolicyArn: policyArn(ctx, existingId) };
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  const policy = loadPolicy(ctx, policyId);
  return { Policy: policy, PolicyArn: policyArn(ctx, policyId) };
};

const ListPolicies: OperationHandler = (_input, ctx) => {
  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((entry) => entry.key.startsWith("policy/"))
    .map((entry) => toSummary(entry.value));
  return { PolicyList: policies };
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  loadPolicy(ctx, policyId);
  ctx.store.delete(policyKey(policyId));
  return {};
};

type StoredAppsList = Record<string, unknown> & {
  ListId: string;
  ListName: string;
};

const appsListKey = (listId: string): string => `appslist/${listId}`;

const appsListArn = (ctx: ServiceContext, listId: string): string =>
  `arn:aws:fms:${ctx.region}:${ctx.account}:applications-list/${listId}`;

const loadAppsList = (ctx: ServiceContext, listId: string): StoredAppsList => {
  const list = ctx.store.get<StoredAppsList>(appsListKey(listId));
  if (list === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AppsList not found: ${listId}`,
      404,
    );
  }
  return list;
};

const PutAppsList: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const requested = inp["AppsList"];
  if (typeof requested !== "object" || requested === null) {
    throw awsError("InvalidInputException", "AppsList is required.", 400);
  }
  const req = requested as Record<string, unknown>;
  const listId =
    typeof req["ListId"] === "string" && req["ListId"] !== ""
      ? req["ListId"]
      : crypto.randomUUID();
  const stored: StoredAppsList = {
    ...req,
    ListId: listId,
    ListName: requireString(req, "ListName"),
    AppsList: (req["AppsList"] as unknown[]) ?? [],
  };
  ctx.store.set(appsListKey(listId), stored);
  return { AppsList: stored, AppsListArn: appsListArn(ctx, listId) };
};

const GetAppsList: OperationHandler = (input, ctx) => {
  const listId = requireString(input as Record<string, unknown>, "ListId");
  const list = loadAppsList(ctx, listId);
  return { AppsList: list, AppsListArn: appsListArn(ctx, listId) };
};

const ListAppsLists: OperationHandler = (_input, ctx) => {
  const lists = ctx.store
    .list<StoredAppsList>()
    .filter((e) => e.key.startsWith("appslist/"))
    .map((e) => ({
      ListId: e.value.ListId,
      ListName: e.value.ListName,
      ListArn: appsListArn(ctx, e.value.ListId),
      AppsList: (e.value["AppsList"] as unknown[]) ?? [],
    }));
  return { AppsLists: lists };
};

const DeleteAppsList: OperationHandler = (input, ctx) => {
  const listId = requireString(input as Record<string, unknown>, "ListId");
  loadAppsList(ctx, listId);
  ctx.store.delete(appsListKey(listId));
  return {};
};

type StoredProtocolsList = Record<string, unknown> & {
  ListId: string;
  ListName: string;
};

const protocolsListKey = (listId: string): string => `protocolslist/${listId}`;

const protocolsListArn = (ctx: ServiceContext, listId: string): string =>
  `arn:aws:fms:${ctx.region}:${ctx.account}:protocols-list/${listId}`;

const loadProtocolsList = (
  ctx: ServiceContext,
  listId: string,
): StoredProtocolsList => {
  const list = ctx.store.get<StoredProtocolsList>(protocolsListKey(listId));
  if (list === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ProtocolsList not found: ${listId}`,
      404,
    );
  }
  return list;
};

const PutProtocolsList: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const requested = inp["ProtocolsList"];
  if (typeof requested !== "object" || requested === null) {
    throw awsError("InvalidInputException", "ProtocolsList is required.", 400);
  }
  const req = requested as Record<string, unknown>;
  const listId =
    typeof req["ListId"] === "string" && req["ListId"] !== ""
      ? req["ListId"]
      : crypto.randomUUID();
  const stored: StoredProtocolsList = {
    ...req,
    ListId: listId,
    ListName: requireString(req, "ListName"),
    ProtocolsList: (req["ProtocolsList"] as unknown[]) ?? [],
  };
  ctx.store.set(protocolsListKey(listId), stored);
  return {
    ProtocolsList: stored,
    ProtocolsListArn: protocolsListArn(ctx, listId),
  };
};

const GetProtocolsList: OperationHandler = (input, ctx) => {
  const listId = requireString(input as Record<string, unknown>, "ListId");
  const list = loadProtocolsList(ctx, listId);
  return {
    ProtocolsList: list,
    ProtocolsListArn: protocolsListArn(ctx, listId),
  };
};

const ListProtocolsLists: OperationHandler = (_input, ctx) => {
  const lists = ctx.store
    .list<StoredProtocolsList>()
    .filter((e) => e.key.startsWith("protocolslist/"))
    .map((e) => ({
      ListId: e.value.ListId,
      ListName: e.value.ListName,
      ListArn: protocolsListArn(ctx, e.value.ListId),
      ProtocolsList: (e.value["ProtocolsList"] as unknown[]) ?? [],
    }));
  return { ProtocolsLists: lists };
};

const DeleteProtocolsList: OperationHandler = (input, ctx) => {
  const listId = requireString(input as Record<string, unknown>, "ListId");
  loadProtocolsList(ctx, listId);
  ctx.store.delete(protocolsListKey(listId));
  return {};
};

type StoredResourceSet = Record<string, unknown> & {
  Id: string;
  Name: string;
};

const resourceSetKey = (id: string): string => `resourceset/${id}`;

const resourceSetArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:fms:${ctx.region}:${ctx.account}:resource-set/${id}`;

const resourceSetResourcesKey = (id: string): string =>
  `resourceset-resources/${id}`;

const loadResourceSet = (
  ctx: ServiceContext,
  id: string,
): StoredResourceSet => {
  const rs = ctx.store.get<StoredResourceSet>(resourceSetKey(id));
  if (rs === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ResourceSet not found: ${id}`,
      404,
    );
  }
  return rs;
};

const PutResourceSet: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const requested = inp["ResourceSet"];
  if (typeof requested !== "object" || requested === null) {
    throw awsError("InvalidInputException", "ResourceSet is required.", 400);
  }
  const req = requested as Record<string, unknown>;
  const id =
    typeof req["Id"] === "string" && req["Id"] !== ""
      ? req["Id"]
      : crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const stored: StoredResourceSet = {
    ...req,
    Id: id,
    Name: requireString(req, "Name"),
    ResourceTypeList: (req["ResourceTypeList"] as unknown[]) ?? [],
  };
  ctx.store.set(resourceSetKey(id), stored);
  return { ResourceSet: stored, ResourceSetArn: resourceSetArn(ctx, id) };
};

const GetResourceSet: OperationHandler = (input, ctx) => {
  const id = requireString(input as Record<string, unknown>, "Identifier");
  const rs = loadResourceSet(ctx, id);
  return { ResourceSet: rs, ResourceSetArn: resourceSetArn(ctx, id) };
};

const ListResourceSets: OperationHandler = (_input, ctx) => {
  const sets = ctx.store
    .list<StoredResourceSet>()
    .filter((e) => e.key.startsWith("resourceset/"))
    .map((e) => ({
      Id: e.value.Id,
      Name: e.value.Name,
      ResourceSetStatus: e.value["ResourceSetStatus"] ?? "ACTIVE",
    }));
  return { ResourceSets: sets };
};

const DeleteResourceSet: OperationHandler = (input, ctx) => {
  const id = requireString(input as Record<string, unknown>, "Identifier");
  loadResourceSet(ctx, id);
  ctx.store.delete(resourceSetKey(id));
  ctx.store.delete(resourceSetResourcesKey(id));
  return {};
};

const BatchAssociateResource: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const setId = requireString(inp, "ResourceSetIdentifier");
  loadResourceSet(ctx, setId);
  const items = (inp["Items"] as string[] | undefined) ?? [];
  const existing =
    ctx.store.get<string[]>(resourceSetResourcesKey(setId)) ?? [];
  const updated = Array.from(new Set([...existing, ...items]));
  ctx.store.set(resourceSetResourcesKey(setId), updated);
  return { ResourceSetIdentifier: setId, FailedItems: [] };
};

const BatchDisassociateResource: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const setId = requireString(inp, "ResourceSetIdentifier");
  loadResourceSet(ctx, setId);
  const items = new Set((inp["Items"] as string[] | undefined) ?? []);
  const existing =
    ctx.store.get<string[]>(resourceSetResourcesKey(setId)) ?? [];
  ctx.store.set(
    resourceSetResourcesKey(setId),
    existing.filter((r) => !items.has(r)),
  );
  return { ResourceSetIdentifier: setId, FailedItems: [] };
};

const ListResourceSetResources: OperationHandler = (input, ctx) => {
  const id = requireString(input as Record<string, unknown>, "Identifier");
  loadResourceSet(ctx, id);
  const resources = ctx.store.get<string[]>(resourceSetResourcesKey(id)) ?? [];
  return {
    Items: resources.map((r) => ({ URI: r })),
  };
};

const adminAccountKey = "adminaccount";

const adminAccountsKey = (account: string): string =>
  `adminaccounts/${account}`;

const AssociateAdminAccount: OperationHandler = (input, ctx) => {
  const account = requireString(
    input as Record<string, unknown>,
    "AdminAccount",
  );
  ctx.store.set(adminAccountKey, account);
  return {};
};

const DisassociateAdminAccount: OperationHandler = (_input, ctx) => {
  const account = ctx.store.get<string>(adminAccountKey);
  if (account === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Admin account not found.",
      404,
    );
  }
  ctx.store.delete(adminAccountKey);
  return {};
};

const GetAdminAccount: OperationHandler = (_input, ctx) => {
  const account = ctx.store.get<string>(adminAccountKey);
  if (account === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Admin account not found.",
      404,
    );
  }
  return { AdminAccount: account, RoleStatus: "READY" };
};

const PutAdminAccount: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const account = requireString(inp, "AdminAccount");
  const scope = inp["AdminScope"] ?? {};
  ctx.store.set(adminAccountsKey(account), {
    AdminAccount: account,
    Status: "ONBOARDING",
    AdminScope: scope,
  });
  return {};
};

const GetAdminScope: OperationHandler = (input, ctx) => {
  const account = requireString(
    input as Record<string, unknown>,
    "AdminAccount",
  );
  const stored = ctx.store.get<Record<string, unknown>>(
    adminAccountsKey(account),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Admin account not found: ${account}`,
      404,
    );
  }
  return {
    AdminScope: stored["AdminScope"] ?? {},
    Status: "ONBOARDING_COMPLETE",
  };
};

const ListAdminAccountsForOrganization: OperationHandler = (_input, ctx) => {
  const accounts = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith("adminaccounts/"))
    .map((e) => ({
      AdminAccount: e.value["AdminAccount"],
      DefaultAdmin: false,
      Status: e.value["Status"] ?? "ONBOARDING",
    }));
  return { AdminAccounts: accounts };
};

const ListAdminsManagingAccount: OperationHandler = (_input, ctx) => {
  const accounts = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith("adminaccounts/"))
    .map((e) => e.value["AdminAccount"] as string);
  return { AdminAccounts: accounts };
};

const tpfKey = (fw: string): string => `tpf/${fw}`;

const AssociateThirdPartyFirewall: OperationHandler = (input, ctx) => {
  const fw = requireString(
    input as Record<string, unknown>,
    "ThirdPartyFirewall",
  );
  ctx.store.set(tpfKey(fw), "ONBOARDING");
  return { ThirdPartyFirewallStatus: "ONBOARDING" };
};

const DisassociateThirdPartyFirewall: OperationHandler = (input, ctx) => {
  const fw = requireString(
    input as Record<string, unknown>,
    "ThirdPartyFirewall",
  );
  ctx.store.set(tpfKey(fw), "OFFBOARDING");
  return { ThirdPartyFirewallStatus: "OFFBOARDING" };
};

const GetThirdPartyFirewallAssociationStatus: OperationHandler = (
  input,
  ctx,
) => {
  const fw = requireString(
    input as Record<string, unknown>,
    "ThirdPartyFirewall",
  );
  const status = ctx.store.get<string>(tpfKey(fw)) ?? "NOT_EXIST";
  return {
    ThirdPartyFirewallStatus: status,
    MarketplaceOnboardingStatus: "COMPLETE",
  };
};

const ListThirdPartyFirewallFirewallPolicies: OperationHandler = (
  input,
  _ctx,
) => {
  const fw = requireString(
    input as Record<string, unknown>,
    "ThirdPartyFirewall",
  );
  return {
    ThirdPartyFirewallFirewallPolicies: [
      {
        FirewallPolicyId: `${fw}-policy-1`,
        FirewallPolicyName: `${fw} Policy 1`,
      },
    ],
  };
};

const notificationChannelKey = "notificationchannel";

const PutNotificationChannel: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  ctx.store.set(notificationChannelKey, {
    SnsTopicArn: requireString(inp, "SnsTopicArn"),
    SnsRoleName: requireString(inp, "SnsRoleName"),
  });
  return {};
};

const GetNotificationChannel: OperationHandler = (_input, ctx) => {
  const channel = ctx.store.get<Record<string, unknown>>(
    notificationChannelKey,
  );
  if (channel === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Notification channel not found.",
      404,
    );
  }
  return {
    SnsTopicArn: channel["SnsTopicArn"],
    SnsRoleName: channel["SnsRoleName"],
  };
};

const DeleteNotificationChannel: OperationHandler = (_input, ctx) => {
  const channel = ctx.store.get<Record<string, unknown>>(
    notificationChannelKey,
  );
  if (channel === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Notification channel not found.",
      404,
    );
  }
  ctx.store.delete(notificationChannelKey);
  return {};
};

const tagsKey = (arn: string): string => `tags/${arn}`;

const TagResource: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const arn = requireString(inp, "ResourceArn");
  const tagList =
    (inp["TagList"] as Array<{ Key: string; Value: string }> | undefined) ?? [];
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const tag of tagList) {
    existing[tag.Key] = tag.Value;
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const arn = requireString(inp, "ResourceArn");
  const tagKeys = (inp["TagKeys"] as string[] | undefined) ?? [];
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input as Record<string, unknown>, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return {
    TagList: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
  };
};

const GetComplianceDetail: OperationHandler = (input, _ctx) => {
  const inp = input as Record<string, unknown>;
  return {
    PolicyComplianceDetail: {
      PolicyId: inp["PolicyId"],
      PolicyOwner: inp["MemberAccount"],
      MemberAccount: inp["MemberAccount"],
      Violators: [],
      EvaluationLimitExceeded: false,
    },
  };
};

const GetProtectionStatus: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  return {
    AdminAccountId: ctx.account,
    ServiceType: "WAFV2",
    Data: `{"policyId":"${policyId}","status":"PROTECTED"}`,
  };
};

const GetViolationDetails: OperationHandler = (input, _ctx) => {
  const inp = input as Record<string, unknown>;
  return {
    ViolationDetail: {
      PolicyId: inp["PolicyId"],
      MemberAccount: inp["MemberAccount"],
      ResourceId: inp["ResourceId"],
      ResourceType: inp["ResourceType"],
      ResourceViolations: [],
    },
  };
};

const ListComplianceStatus: OperationHandler = (_input, _ctx) => {
  return { PolicyComplianceStatusList: [] };
};

const ListDiscoveredResources: OperationHandler = (_input, _ctx) => {
  return { Items: [] };
};

const ListMemberAccounts: OperationHandler = (_input, _ctx) => {
  return { MemberAccounts: [] };
};

const fms = {
  name: "fms",
  protocol: "json",
  operations: {
    PutPolicy,
    GetPolicy,
    ListPolicies,
    DeletePolicy,
    PutAppsList,
    GetAppsList,
    ListAppsLists,
    DeleteAppsList,
    PutProtocolsList,
    GetProtocolsList,
    ListProtocolsLists,
    DeleteProtocolsList,
    PutResourceSet,
    GetResourceSet,
    ListResourceSets,
    DeleteResourceSet,
    BatchAssociateResource,
    BatchDisassociateResource,
    ListResourceSetResources,
    AssociateAdminAccount,
    DisassociateAdminAccount,
    GetAdminAccount,
    PutAdminAccount,
    GetAdminScope,
    ListAdminAccountsForOrganization,
    ListAdminsManagingAccount,
    AssociateThirdPartyFirewall,
    DisassociateThirdPartyFirewall,
    GetThirdPartyFirewallAssociationStatus,
    ListThirdPartyFirewallFirewallPolicies,
    PutNotificationChannel,
    GetNotificationChannel,
    DeleteNotificationChannel,
    TagResource,
    UntagResource,
    ListTagsForResource,
    GetComplianceDetail,
    GetProtectionStatus,
    GetViolationDetails,
    ListComplianceStatus,
    ListDiscoveredResources,
    ListMemberAccounts,
  },
  model,
} as const satisfies ServiceDefinition;

export default fms;
