import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/fms.json", { with: { type: "json" } }),
  { targetPrefix: "AWSFMS_20180101" },
);

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

const paginateItems = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
  maxCap = 100,
): { page: T[]; nextToken: string | undefined } => {
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? Math.min(maxResults, maxCap)
      : maxCap;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(atob(nextToken), 10) || 0
      : 0;
  const page = items.slice(offset, offset + max);
  const next =
    offset + max < items.length ? btoa(String(offset + max)) : undefined;
  return { page, nextToken: next };
};

const PutPolicy: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const requested = requirePolicy(inp);
  const existingId =
    typeof requested["PolicyId"] === "string" && requested["PolicyId"] !== ""
      ? (requested["PolicyId"] as string)
      : crypto.randomUUID();
  if (
    typeof requested["PolicyId"] === "string" &&
    requested["PolicyId"] !== ""
  ) {
    const existing = ctx.store.get<StoredPolicy>(policyKey(existingId));
    if (existing !== undefined) {
      const provided = requested["PolicyUpdateToken"];
      if (provided !== existing.PolicyUpdateToken) {
        throw awsError(
          "InvalidOperationException",
          "PolicyUpdateToken mismatch.",
          400,
        );
      }
    }
  }
  const updateToken = crypto.randomUUID();
  const arn = policyArn(ctx, existingId);
  const policy: StoredPolicy = {
    ...requested,
    PolicyId: existingId,
    PolicyName: requireString(requested, "PolicyName"),
    PolicyUpdateToken: updateToken,
    PolicyArn: arn,
  };
  ctx.store.set(policyKey(existingId), policy);
  const tagList = inp["TagList"];
  if (Array.isArray(tagList) && tagList.length > 0) {
    const existingTags =
      ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
    for (const tag of tagList as Array<{ Key: string; Value: string }>) {
      existingTags[tag.Key] = tag.Value;
    }
    ctx.store.set(tagsKey(arn), existingTags);
  }
  return { Policy: policy, PolicyArn: arn };
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  const policy = loadPolicy(ctx, policyId);
  return { Policy: policy, PolicyArn: policyArn(ctx, policyId) };
};

const ListPolicies: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((entry) => entry.key.startsWith("policy/"))
    .map((entry) => toSummary(entry.value));
  const { page, nextToken } = paginateItems(
    policies,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    PolicyList: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
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

const ListAppsLists: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  if (typeof inp["MaxResults"] !== "number") {
    throw awsError("InvalidInputException", "MaxResults is required.", 400);
  }
  const lists = ctx.store
    .list<StoredAppsList>()
    .filter((e) => e.key.startsWith("appslist/"))
    .map((e) => ({
      ListId: e.value.ListId,
      ListName: e.value.ListName,
      ListArn: appsListArn(ctx, e.value.ListId),
      AppsList: (e.value["AppsList"] as unknown[]) ?? [],
    }));
  const { page, nextToken } = paginateItems(
    lists,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    AppsLists: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
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

const ListProtocolsLists: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  if (typeof inp["MaxResults"] !== "number") {
    throw awsError("InvalidInputException", "MaxResults is required.", 400);
  }
  const lists = ctx.store
    .list<StoredProtocolsList>()
    .filter((e) => e.key.startsWith("protocolslist/"))
    .map((e) => ({
      ListId: e.value.ListId,
      ListName: e.value.ListName,
      ListArn: protocolsListArn(ctx, e.value.ListId),
      ProtocolsList: (e.value["ProtocolsList"] as unknown[]) ?? [],
    }));
  const { page, nextToken } = paginateItems(
    lists,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    ProtocolsLists: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
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

const ListResourceSets: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const sets = ctx.store
    .list<StoredResourceSet>()
    .filter((e) => e.key.startsWith("resourceset/"))
    .map((e) => ({
      Id: e.value.Id,
      Name: e.value.Name,
      ResourceSetStatus: e.value["ResourceSetStatus"] ?? "ACTIVE",
    }));
  const { page, nextToken } = paginateItems(
    sets,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    ResourceSets: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
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
  if (
    !Array.isArray(inp["Items"]) ||
    (inp["Items"] as unknown[]).length === 0
  ) {
    throw awsError("InvalidInputException", "Items is required.", 400);
  }
  const items = inp["Items"] as string[];
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
  if (
    !Array.isArray(inp["Items"]) ||
    (inp["Items"] as unknown[]).length === 0
  ) {
    throw awsError("InvalidInputException", "Items is required.", 400);
  }
  const items = new Set(inp["Items"] as string[]);
  const existing =
    ctx.store.get<string[]>(resourceSetResourcesKey(setId)) ?? [];
  ctx.store.set(
    resourceSetResourcesKey(setId),
    existing.filter((r) => !items.has(r)),
  );
  return { ResourceSetIdentifier: setId, FailedItems: [] };
};

const ListResourceSetResources: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const id = requireString(inp, "Identifier");
  loadResourceSet(ctx, id);
  const resources = ctx.store.get<string[]>(resourceSetResourcesKey(id)) ?? [];
  const items = resources.map((r) => ({ URI: r }));
  const { page, nextToken } = paginateItems(
    items,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    Items: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
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
  const existing = ctx.store.get<string>(adminAccountKey);
  if (existing !== undefined && existing !== account) {
    throw awsError(
      "InvalidOperationException",
      `Admin account is already associated: ${existing}.`,
      400,
    );
  }
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
  const status = stored["Status"] as string | undefined;
  if (status === "ONBOARDING") {
    ctx.store.set(adminAccountsKey(account), {
      ...stored,
      Status: "ONBOARDING_COMPLETE",
    });
  }
  return {
    AdminScope: stored["AdminScope"] ?? {},
    Status: status ?? "ONBOARDING_COMPLETE",
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
  if (status === "ONBOARDING") {
    ctx.store.set(tpfKey(fw), "ONBOARD_COMPLETE");
  }
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

const validateFmsResourceArn = (ctx: ServiceContext, arn: string): void => {
  const match = arn.match(
    /^arn:aws:fms:[^:]*:[^:]*:(policy|applications-list|protocols-list)\/(.+)$/,
  );
  if (match === null) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      404,
    );
  }
  const resourceType = match[1] as string;
  const id = match[2] as string;
  const key =
    resourceType === "policy"
      ? policyKey(id)
      : resourceType === "applications-list"
        ? appsListKey(id)
        : protocolsListKey(id);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${arn}`,
      404,
    );
  }
};

const TagResource: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const arn = requireString(inp, "ResourceArn");
  validateFmsResourceArn(ctx, arn);
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
  validateFmsResourceArn(ctx, arn);
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
  validateFmsResourceArn(ctx, arn);
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return {
    TagList: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
  };
};

const GetComplianceDetail: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const policyId = requireString(inp, "PolicyId");
  const memberAccount = requireString(inp, "MemberAccount");
  loadPolicy(ctx, policyId);
  return {
    PolicyComplianceDetail: {
      PolicyId: policyId,
      PolicyOwner: ctx.account,
      MemberAccount: memberAccount,
      Violators: [],
      EvaluationLimitExceeded: false,
    },
  };
};

const GetProtectionStatus: OperationHandler = (input, ctx) => {
  const policyId = requireString(input as Record<string, unknown>, "PolicyId");
  const policy = loadPolicy(ctx, policyId);
  const data = policy["SecurityServicePolicyData"] as
    | Record<string, unknown>
    | undefined;
  const serviceType = (data?.["Type"] as string | undefined) ?? "WAFV2";
  return {
    AdminAccountId: ctx.account,
    ServiceType: serviceType,
    Data: `{"policyId":"${policyId}","status":"PROTECTED"}`,
  };
};

const GetViolationDetails: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const policyId = requireString(inp, "PolicyId");
  const memberAccount = requireString(inp, "MemberAccount");
  const resourceId = requireString(inp, "ResourceId");
  const resourceType = requireString(inp, "ResourceType");
  loadPolicy(ctx, policyId);
  return {
    ViolationDetail: {
      PolicyId: policyId,
      MemberAccount: memberAccount,
      ResourceId: resourceId,
      ResourceType: resourceType,
      ResourceViolations: [],
    },
  };
};

const ListComplianceStatus: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const policyId = requireString(inp, "PolicyId");
  loadPolicy(ctx, policyId);
  const memberAccounts = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith("adminaccounts/"))
    .map((e) => e.value["AdminAccount"] as string);
  const statuses = memberAccounts.map((account) => ({
    PolicyId: policyId,
    PolicyOwner: ctx.account,
    MemberAccount: account,
    EvaluationResults: [
      {
        EvaluationResult: "COMPLIANT",
        ViolatorCount: 0,
        EvaluationLimitExceeded: false,
      },
    ],
    IssueInfoMap: {},
  }));
  const { page, nextToken } = paginateItems(
    statuses,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    PolicyComplianceStatusList: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const ListDiscoveredResources: OperationHandler = (input, _ctx) => {
  const inp = input as Record<string, unknown>;
  const memberAccountIds =
    (inp["MemberAccountIds"] as string[] | undefined) ?? [];
  if (memberAccountIds.length > 1) {
    throw awsError(
      "InvalidInputException",
      "Only one MemberAccountId is supported per request.",
      400,
    );
  }
  const resourceType = (inp["ResourceType"] as string | undefined) ?? "";
  const typeSlug = resourceType.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const resources = memberAccountIds.map((accountId) => ({
    AccountId: accountId,
    ResourceId: `arn:aws:${typeSlug}:us-east-1:${accountId}:resource/discovered`,
    ResourceType: resourceType,
    Name: `discovered-${accountId}`,
  }));
  const { page, nextToken } = paginateItems(
    resources,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    Items: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const ListMemberAccounts: OperationHandler = (input, ctx) => {
  const inp = input as Record<string, unknown>;
  const accounts = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith("adminaccounts/"))
    .map((e) => e.value["AdminAccount"] as string);
  const { page, nextToken } = paginateItems(
    accounts,
    inp["MaxResults"],
    inp["NextToken"],
  );
  return {
    MemberAccounts: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
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
