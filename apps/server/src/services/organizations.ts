import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import organizationsModel from "../../models/organizations.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(organizationsModel);

type StoredOrganization = {
  Id: string;
  Arn: string;
  FeatureSet: string;
  MasterAccountArn: string;
  MasterAccountId: string;
  MasterAccountEmail: string;
  AvailablePolicyTypes: { Type: string; Status: string }[];
};

type StoredRoot = {
  Id: string;
  Arn: string;
  Name: string;
  PolicyTypes: { Type: string; Status: string }[];
};

type StoredAccount = {
  Id: string;
  Arn: string;
  Email: string;
  Name: string;
  Status: string;
  State: string;
  JoinedMethod: string;
  JoinedTimestamp: number;
  ParentId: string;
};

type StoredCreateAccountStatus = {
  Id: string;
  AccountName: string;
  State: string;
  RequestedTimestamp: number;
  CompletedTimestamp?: number;
  AccountId: string;
  GovCloudAccountId?: string;
};

type StoredOrganizationalUnit = {
  Id: string;
  Arn: string;
  Name: string;
  ParentId: string;
};

type StoredPolicy = {
  Id: string;
  Arn: string;
  Name: string;
  Description: string;
  Type: string;
  AwsManaged: boolean;
  Content: string;
};

type StoredHandshake = {
  Id: string;
  Arn: string;
  State: string;
  Action: string;
  Parties: { Id: string; Type: string }[];
  Resources: { Value: string; Type: string }[];
  RequestedTimestamp: number;
  ExpirationTimestamp: number;
};

type StoredEnabledService = {
  ServicePrincipal: string;
  DateEnabled: number;
};

type StoredResourcePolicy = {
  Id: string;
  Arn: string;
  Content: string;
};

type StoredResponsibilityTransfer = {
  Id: string;
  Arn: string;
  Name: string;
  Type: string;
  Status: string;
  Source: { ManagementAccountId: string; ManagementAccountEmail: string };
  Target: { ManagementAccountId: string; ManagementAccountEmail: string };
  StartTimestamp: number;
  EndTimestamp?: number;
  ActiveHandshakeId?: string;
};

const orgKey = "organization" as const;
const rootKey = "root" as const;
const resourcePolicyKey = "resourcePolicy" as const;

const accountKey = (id: string): string => `account/${id}`;
const ouKey = (id: string): string => `ou/${id}`;
const policyKey = (id: string): string => `policy/${id}`;
const handshakeKey = (id: string): string => `handshake/${id}`;
const delegateKey = (accountId: string, sp: string): string =>
  `delegate/${accountId}/${sp}`;
const serviceKey = (sp: string): string => `service/${sp}`;
const tagsKey = (resourceId: string): string => `tags/${resourceId}`;
const attachmentKey = (policyId: string, targetId: string): string =>
  `attachment/${policyId}/${targetId}`;
const casKey = (id: string): string => `cas/${id}`;
const rtKey = (id: string): string => `rt/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidInputException",
      `You specified an invalid value for ${key}.`,
      400,
    );
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const randomChars = (length: number): string => {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const randomDigits = (length: number): string => {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") {
    return 0;
  }
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const paginate = <T>(
  items: T[],
  maxResults: number,
  nextToken: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const offset = decodePageToken(nextToken);
  const page = items.slice(offset, offset + maxResults);
  const nextOffset = offset + maxResults;
  return {
    page,
    nextToken:
      nextOffset < items.length ? encodePageToken(nextOffset) : undefined,
  };
};

const requireOrganization = (ctx: ServiceContext): StoredOrganization => {
  const org = ctx.store.get<StoredOrganization>(orgKey);
  if (org === undefined) {
    throw awsError(
      "AWSOrganizationsNotInUseException",
      "Your account is not a member of an organization.",
      400,
    );
  }
  return org;
};

const requireAccount = (ctx: ServiceContext, id: string): StoredAccount => {
  const account = ctx.store.get<StoredAccount>(accountKey(id));
  if (account === undefined) {
    throw awsError(
      "AccountNotFoundException",
      "We can't find an account with the AccountId that you specified.",
      400,
    );
  }
  return account;
};

const requireOU = (
  ctx: ServiceContext,
  id: string,
): StoredOrganizationalUnit => {
  const ou = ctx.store.get<StoredOrganizationalUnit>(ouKey(id));
  if (ou === undefined) {
    throw awsError(
      "OrganizationalUnitNotFoundException",
      "We can't find an OU with the OrganizationalUnitId that you specified.",
      400,
    );
  }
  return ou;
};

const requirePolicy = (ctx: ServiceContext, id: string): StoredPolicy => {
  const policy = ctx.store.get<StoredPolicy>(policyKey(id));
  if (policy === undefined) {
    throw awsError(
      "PolicyNotFoundException",
      "We can't find a policy with the PolicyId that you specified.",
      400,
    );
  }
  return policy;
};

const requireHandshake = (ctx: ServiceContext, id: string): StoredHandshake => {
  const handshake = ctx.store.get<StoredHandshake>(handshakeKey(id));
  if (handshake === undefined) {
    throw awsError(
      "HandshakeNotFoundException",
      "We can't find a handshake with the HandshakeId that you specified.",
      400,
    );
  }
  return handshake;
};

const requireRT = (
  ctx: ServiceContext,
  id: string,
): StoredResponsibilityTransfer => {
  const rt = ctx.store.get<StoredResponsibilityTransfer>(rtKey(id));
  if (rt === undefined) {
    throw awsError(
      "ResponsibilityTransferNotFoundException",
      "We can't find a responsibility transfer with the Id that you specified.",
      400,
    );
  }
  return rt;
};

const resolveTarget = (
  ctx: ServiceContext,
  targetId: string,
): { TargetId: string; Arn: string; Name: string; Type: string } => {
  const root = ctx.store.get<StoredRoot>(rootKey);
  if (root !== undefined && root.Id === targetId) {
    return { TargetId: targetId, Arn: root.Arn, Name: root.Name, Type: "ROOT" };
  }
  const account = ctx.store.get<StoredAccount>(accountKey(targetId));
  if (account !== undefined) {
    return {
      TargetId: targetId,
      Arn: account.Arn,
      Name: account.Name,
      Type: "ACCOUNT",
    };
  }
  const ou = ctx.store.get<StoredOrganizationalUnit>(ouKey(targetId));
  if (ou !== undefined) {
    return {
      TargetId: targetId,
      Arn: ou.Arn,
      Name: ou.Name,
      Type: "ORGANIZATIONAL_UNIT",
    };
  }
  throw awsError(
    "TargetNotFoundException",
    "We can't find a root, OU, or account with the TargetId that you specified.",
    400,
  );
};

const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>,
      );
    } else {
      result[key] = sv;
    }
  }
  return result;
};

const getHierarchyPath = (ctx: ServiceContext, targetId: string): string[] => {
  const path: string[] = [];
  let current: string | undefined = targetId;
  const root = ctx.store.get<StoredRoot>(rootKey);
  while (current !== undefined) {
    path.push(current);
    if (root !== undefined && current === root.Id) {
      break;
    }
    const account: StoredAccount | undefined = ctx.store.get<StoredAccount>(
      accountKey(current),
    );
    if (account !== undefined) {
      current = account.ParentId;
      continue;
    }
    const ou: StoredOrganizationalUnit | undefined =
      ctx.store.get<StoredOrganizationalUnit>(ouKey(current));
    if (ou !== undefined) {
      current = ou.ParentId;
      continue;
    }
    break;
  }
  return path;
};

const CreateOrganization: OperationHandler = (input, ctx) => {
  const existing = ctx.store.get<StoredOrganization>(orgKey);
  if (existing !== undefined) {
    throw awsError(
      "AlreadyInOrganizationException",
      "The provided account is already a member of an organization.",
      400,
    );
  }
  const featureSet =
    optionalString(input, "FeatureSet") === "CONSOLIDATED_BILLING"
      ? "CONSOLIDATED_BILLING"
      : "ALL";
  const orgId = `o-${randomChars(10)}`;
  const masterEmail = `master@${randomChars(8)}.example.com`;
  const policyTypes =
    featureSet === "ALL"
      ? [{ Type: "SERVICE_CONTROL_POLICY", Status: "ENABLED" }]
      : [];
  const org: StoredOrganization = {
    Id: orgId,
    Arn: `arn:aws:organizations::${ctx.account}:organization/${orgId}`,
    FeatureSet: featureSet,
    MasterAccountArn: `arn:aws:organizations::${ctx.account}:account/${orgId}/${ctx.account}`,
    MasterAccountId: ctx.account,
    MasterAccountEmail: masterEmail,
    AvailablePolicyTypes: policyTypes,
  };
  ctx.store.set(orgKey, org);
  const rootId = `r-${randomChars(4)}`;
  const root: StoredRoot = {
    Id: rootId,
    Arn: `arn:aws:organizations::${ctx.account}:root/${orgId}/${rootId}`,
    Name: "Root",
    PolicyTypes: policyTypes,
  };
  ctx.store.set(rootKey, root);
  const master: StoredAccount = {
    Id: ctx.account,
    Arn: org.MasterAccountArn,
    Email: masterEmail,
    Name: "management-account",
    Status: "ACTIVE",
    State: "ACTIVE",
    JoinedMethod: "INVITED",
    JoinedTimestamp: nowSeconds(),
    ParentId: rootId,
  };
  ctx.store.set(accountKey(ctx.account), master);
  return { Organization: org };
};

const DescribeOrganization: OperationHandler = (_input, ctx) => {
  const org = requireOrganization(ctx);
  return { Organization: org };
};

const CreateAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const name = requireString(input, "AccountName");
  const email = requireString(input, "Email");
  const accountId = randomDigits(12);
  const now = nowSeconds();
  const root = ctx.store.get<StoredRoot>(rootKey);
  const account: StoredAccount = {
    Id: accountId,
    Arn: `arn:aws:organizations::${ctx.account}:account/o-${randomChars(10)}/${accountId}`,
    Email: email,
    Name: name,
    Status: "ACTIVE",
    State: "ACTIVE",
    JoinedMethod: "CREATED",
    JoinedTimestamp: now,
    ParentId: root?.Id ?? "",
  };
  ctx.store.set(accountKey(accountId), account);
  const status: StoredCreateAccountStatus = {
    Id: `car-${randomChars(16)}`,
    AccountName: name,
    State: "IN_PROGRESS",
    RequestedTimestamp: now,
    AccountId: accountId,
  };
  ctx.store.set(casKey(status.Id), status);
  return { CreateAccountStatus: status };
};

const DescribeAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  const account = requireAccount(ctx, accountId);
  return { Account: account };
};

const ListAccounts: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const all = ctx.store
    .list<StoredAccount>()
    .filter((entry) => entry.key.startsWith("account/"))
    .map((entry) => entry.value);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Accounts: page, NextToken: nextToken };
};

const CreateOrganizationalUnit: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const name = requireString(input, "Name");
  const parentId = requireString(input, "ParentId");
  const root = ctx.store.get<StoredRoot>(rootKey);
  const parentIsKnown =
    (root !== undefined && root.Id === parentId) ||
    ctx.store.get<StoredOrganizationalUnit>(ouKey(parentId)) !== undefined;
  if (!parentIsKnown) {
    throw awsError(
      "ParentNotFoundException",
      "We can't find a root or OU with the ParentId that you specified.",
      400,
    );
  }
  const ouId = `ou-${randomChars(4)}-${randomChars(8)}`;
  const ou: StoredOrganizationalUnit = {
    Id: ouId,
    Arn: `arn:aws:organizations::${ctx.account}:ou/${org.Id}/${ouId}`,
    Name: name,
    ParentId: parentId,
  };
  ctx.store.set(ouKey(ouId), ou);
  return {
    OrganizationalUnit: { Id: ou.Id, Arn: ou.Arn, Name: ou.Name },
  };
};

const ListOrganizationalUnitsForParent: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const parentId = requireString(input, "ParentId");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list<StoredOrganizationalUnit>()
    .filter((entry) => entry.key.startsWith("ou/"))
    .map((entry) => entry.value)
    .filter((ou) => ou.ParentId === parentId)
    .map((ou) => ({ Id: ou.Id, Arn: ou.Arn, Name: ou.Name }));
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { OrganizationalUnits: page, NextToken: nextToken };
};

const ListRoots: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const root = ctx.store.get<StoredRoot>(rootKey);
  return { Roots: root === undefined ? [] : [root] };
};

const AcceptHandshake: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const handshakeId = requireString(input, "HandshakeId");
  const handshake = requireHandshake(ctx, handshakeId);
  if (handshake.State !== "REQUESTED" && handshake.State !== "OPEN") {
    throw awsError(
      "HandshakeAlreadyInStateException",
      "The handshake is already in the given state.",
      400,
    );
  }
  const updated: StoredHandshake = { ...handshake, State: "ACCEPTED" };
  ctx.store.set(handshakeKey(handshakeId), updated);
  return { Handshake: updated };
};

const AttachPolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const policyId = requireString(input, "PolicyId");
  const targetId = requireString(input, "TargetId");
  const policy = requirePolicy(ctx, policyId);
  resolveTarget(ctx, targetId);
  const root = ctx.store.get<StoredRoot>(rootKey);
  const policyTypeEnabled =
    root?.PolicyTypes.some(
      (pt) => pt.Type === policy.Type && pt.Status === "ENABLED",
    ) ?? false;
  if (!policyTypeEnabled) {
    throw awsError(
      "PolicyTypeNotEnabledException",
      "The specified policy type is not currently enabled in this root.",
      400,
    );
  }
  const key = attachmentKey(policyId, targetId);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "DuplicatePolicyAttachmentException",
      "The policy is already attached to the specified target.",
      400,
    );
  }
  ctx.store.set(key, { PolicyId: policyId, TargetId: targetId });
  return {};
};

const CancelHandshake: OperationHandler = (input, ctx) => {
  const handshakeId = requireString(input, "HandshakeId");
  const handshake = requireHandshake(ctx, handshakeId);
  if (handshake.State !== "REQUESTED" && handshake.State !== "OPEN") {
    throw awsError(
      "HandshakeAlreadyInStateException",
      "The handshake is already in the given state.",
      400,
    );
  }
  const updated: StoredHandshake = { ...handshake, State: "CANCELED" };
  ctx.store.set(handshakeKey(handshakeId), updated);
  return { Handshake: updated };
};

const CloseAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  const account = requireAccount(ctx, accountId);
  if (account.Status === "SUSPENDED") {
    throw awsError(
      "AccountAlreadyClosedException",
      "You attempted to close an account that is already closed.",
      400,
    );
  }
  const updated: StoredAccount = {
    ...account,
    Status: "SUSPENDED",
    State: "SUSPENDED",
  };
  ctx.store.set(accountKey(accountId), updated);
  return {};
};

const CreateGovCloudAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const name = requireString(input, "AccountName");
  const email = requireString(input, "Email");
  const accountId = randomDigits(12);
  const govCloudAccountId = randomDigits(12);
  const now = nowSeconds();
  const root = ctx.store.get<StoredRoot>(rootKey);
  const account: StoredAccount = {
    Id: accountId,
    Arn: `arn:aws:organizations::${ctx.account}:account/o-${randomChars(10)}/${accountId}`,
    Email: email,
    Name: name,
    Status: "ACTIVE",
    State: "ACTIVE",
    JoinedMethod: "CREATED",
    JoinedTimestamp: now,
    ParentId: root?.Id ?? "",
  };
  ctx.store.set(accountKey(accountId), account);
  const status: StoredCreateAccountStatus = {
    Id: `car-${randomChars(16)}`,
    AccountName: name,
    State: "IN_PROGRESS",
    RequestedTimestamp: now,
    AccountId: accountId,
    GovCloudAccountId: govCloudAccountId,
  };
  ctx.store.set(casKey(status.Id), status);
  return { CreateAccountStatus: status };
};

const CreatePolicy: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const content = requireString(input, "Content");
  const description = optionalString(input, "Description") ?? "";
  const name = requireString(input, "Name");
  const type = requireString(input, "Type");
  const pId = `p-${randomChars(8)}${randomChars(8)}`;
  const policy: StoredPolicy = {
    Id: pId,
    Arn: `arn:aws:organizations::${ctx.account}:policy/${org.Id}/${type.toLowerCase()}/${pId}`,
    Name: name,
    Description: description,
    Type: type,
    AwsManaged: false,
    Content: content,
  };
  ctx.store.set(policyKey(pId), policy);
  return {
    Policy: {
      PolicySummary: {
        Id: policy.Id,
        Arn: policy.Arn,
        Name: policy.Name,
        Description: policy.Description,
        Type: policy.Type,
        AwsManaged: policy.AwsManaged,
      },
      Content: policy.Content,
    },
  };
};

const DeclineHandshake: OperationHandler = (input, ctx) => {
  const handshakeId = requireString(input, "HandshakeId");
  const handshake = requireHandshake(ctx, handshakeId);
  if (handshake.State !== "REQUESTED" && handshake.State !== "OPEN") {
    throw awsError(
      "HandshakeAlreadyInStateException",
      "The handshake is already in the given state.",
      400,
    );
  }
  const updated: StoredHandshake = { ...handshake, State: "DECLINED" };
  ctx.store.set(handshakeKey(handshakeId), updated);
  return { Handshake: updated };
};

const DeleteOrganization: OperationHandler = (_input, ctx) => {
  const org = requireOrganization(ctx);
  const memberAccounts = ctx.store
    .list<StoredAccount>()
    .filter((entry) => entry.key.startsWith("account/"))
    .map((entry) => entry.value)
    .filter((a) => a.Id !== org.MasterAccountId);
  if (memberAccounts.length > 0) {
    throw awsError(
      "OrganizationNotEmptyException",
      "The organization must first be emptied of all accounts, OUs, and policies before it can be deleted.",
      400,
    );
  }
  ctx.store.delete(orgKey);
  ctx.store.delete(rootKey);
  ctx.store.delete(accountKey(org.MasterAccountId));
  return {};
};

const DeleteOrganizationalUnit: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const ouId = requireString(input, "OrganizationalUnitId");
  requireOU(ctx, ouId);
  const childAccounts = ctx.store
    .list<StoredAccount>()
    .filter((entry) => entry.key.startsWith("account/"))
    .map((entry) => entry.value)
    .filter((a) => a.ParentId === ouId);
  if (childAccounts.length > 0) {
    throw awsError(
      "OrganizationalUnitNotEmptyException",
      "The specified OU is not empty. Move all accounts to another root or OU, then try the operation again.",
      400,
    );
  }
  const childOUs = ctx.store
    .list<StoredOrganizationalUnit>()
    .filter((entry) => entry.key.startsWith("ou/"))
    .map((entry) => entry.value)
    .filter((ou) => ou.ParentId === ouId);
  if (childOUs.length > 0) {
    throw awsError(
      "OrganizationalUnitNotEmptyException",
      "The specified OU is not empty. Move all accounts to another root or OU, then try the operation again.",
      400,
    );
  }
  ctx.store.delete(ouKey(ouId));
  return {};
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const pId = requireString(input, "PolicyId");
  requirePolicy(ctx, pId);
  const attachments = ctx.store
    .list()
    .filter((entry) => entry.key.startsWith(`attachment/${pId}/`));
  if (attachments.length > 0) {
    throw awsError(
      "PolicyInUseException",
      "The policy is attached to one or more entities. You must detach it from all roots, OUs, and accounts before finalizing your request to delete it.",
      400,
    );
  }
  ctx.store.delete(policyKey(pId));
  return {};
};

const DeleteResourcePolicy: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const rp = ctx.store.get<StoredResourcePolicy>(resourcePolicyKey);
  if (rp === undefined) {
    throw awsError(
      "ResourcePolicyNotFoundException",
      "We can't find a resource-based policy in this organization.",
      400,
    );
  }
  ctx.store.delete(resourcePolicyKey);
  return {};
};

const DeregisterDelegatedAdministrator: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  const sp = requireString(input, "ServicePrincipal");
  requireAccount(ctx, accountId);
  const key = delegateKey(accountId, sp);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "AccountNotRegisteredException",
      "The specified account is not a delegated administrator for this service principal.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DescribeCreateAccountStatus: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const requestId = requireString(input, "CreateAccountRequestId");
  const status = ctx.store.get<StoredCreateAccountStatus>(casKey(requestId));
  if (status === undefined) {
    throw awsError(
      "CreateAccountStatusNotFoundException",
      "We can't find a create account request with the CreateAccountRequestId that you specified.",
      400,
    );
  }
  if (status.State === "IN_PROGRESS") {
    const succeeded: StoredCreateAccountStatus = {
      ...status,
      State: "SUCCEEDED",
      CompletedTimestamp: nowSeconds(),
    };
    ctx.store.set(casKey(requestId), succeeded);
    return { CreateAccountStatus: succeeded };
  }
  return { CreateAccountStatus: status };
};

const DescribeEffectivePolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const policyType = requireString(input, "PolicyType");
  const targetId = optionalString(input, "TargetId") ?? ctx.account;
  const hierarchy = getHierarchyPath(ctx, targetId);
  let merged: Record<string, unknown> = {};
  for (const nodeId of [...hierarchy].reverse()) {
    const nodeAttachments = ctx.store
      .list()
      .filter(
        (entry) =>
          entry.key.startsWith("attachment/") &&
          entry.key.endsWith(`/${nodeId}`),
      )
      .map((entry) => {
        const parts = entry.key.split("/");
        return ctx.store.get<StoredPolicy>(policyKey(parts[1] ?? ""));
      })
      .filter(
        (p): p is StoredPolicy => p !== undefined && p.Type === policyType,
      );
    for (const policy of nodeAttachments) {
      try {
        const parsed = JSON.parse(policy.Content) as Record<string, unknown>;
        merged = deepMerge(merged, parsed);
      } catch {
        // ignore unparseable content
      }
    }
  }
  return {
    EffectivePolicy: {
      PolicyContent: JSON.stringify(merged),
      LastUpdatedTimestamp: nowSeconds(),
      TargetId: targetId,
      PolicyType: policyType,
    },
  };
};

const DescribeHandshake: OperationHandler = (input, ctx) => {
  const handshakeId = requireString(input, "HandshakeId");
  const handshake = requireHandshake(ctx, handshakeId);
  const org = ctx.store.get<StoredOrganization>(orgKey);
  const isManagement = org !== undefined && ctx.account === org.MasterAccountId;
  const isParty = handshake.Parties.some((p) => p.Id === ctx.account);
  if (!isManagement && !isParty) {
    throw awsError(
      "AccessDeniedException",
      "You don't have permission to access this handshake.",
      400,
    );
  }
  return { Handshake: handshake };
};

const DescribeOrganizationalUnit: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const ouId = requireString(input, "OrganizationalUnitId");
  const ou = requireOU(ctx, ouId);
  return { OrganizationalUnit: { Id: ou.Id, Arn: ou.Arn, Name: ou.Name } };
};

const DescribePolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const pId = requireString(input, "PolicyId");
  const policy = requirePolicy(ctx, pId);
  return {
    Policy: {
      PolicySummary: {
        Id: policy.Id,
        Arn: policy.Arn,
        Name: policy.Name,
        Description: policy.Description,
        Type: policy.Type,
        AwsManaged: policy.AwsManaged,
      },
      Content: policy.Content,
    },
  };
};

const DescribeResourcePolicy: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const rp = ctx.store.get<StoredResourcePolicy>(resourcePolicyKey);
  if (rp === undefined) {
    throw awsError(
      "ResourcePolicyNotFoundException",
      "We can't find a resource-based policy in this organization.",
      400,
    );
  }
  return {
    ResourcePolicy: {
      ResourcePolicySummary: { Id: rp.Id, Arn: rp.Arn },
      Content: rp.Content,
    },
  };
};

const DescribeResponsibilityTransfer: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const id = requireString(input, "Id");
  const rt = requireRT(ctx, id);
  return { ResponsibilityTransfer: rt };
};

const DetachPolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const policyId = requireString(input, "PolicyId");
  const targetId = requireString(input, "TargetId");
  requirePolicy(ctx, policyId);
  const key = attachmentKey(policyId, targetId);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "PolicyNotAttachedException",
      "The policy isn't attached to the specified target.",
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DisableAWSServiceAccess: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const sp = requireString(input, "ServicePrincipal");
  ctx.store.delete(serviceKey(sp));
  return {};
};

const DisablePolicyType: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const rootId = requireString(input, "RootId");
  const policyType = requireString(input, "PolicyType");
  const root = ctx.store.get<StoredRoot>(rootKey);
  if (root === undefined || root.Id !== rootId) {
    throw awsError(
      "RootNotFoundException",
      "We can't find a root with the RootId that you specified.",
      400,
    );
  }
  const existing = root.PolicyTypes.find((pt) => pt.Type === policyType);
  if (existing === undefined) {
    throw awsError(
      "PolicyTypeNotEnabledException",
      "The specified policy type is not enabled in the specified root.",
      400,
    );
  }
  const updatedRoot: StoredRoot = {
    ...root,
    PolicyTypes: root.PolicyTypes.filter((pt) => pt.Type !== policyType),
  };
  ctx.store.set(rootKey, updatedRoot);
  const updatedOrg: StoredOrganization = {
    ...org,
    AvailablePolicyTypes: org.AvailablePolicyTypes.filter(
      (pt) => pt.Type !== policyType,
    ),
  };
  ctx.store.set(orgKey, updatedOrg);
  return { Root: updatedRoot };
};

const EnableAWSServiceAccess: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const sp = requireString(input, "ServicePrincipal");
  if (ctx.store.get(serviceKey(sp)) === undefined) {
    const entry: StoredEnabledService = {
      ServicePrincipal: sp,
      DateEnabled: nowSeconds(),
    };
    ctx.store.set(serviceKey(sp), entry);
  }
  return {};
};

const EnableAllFeatures: OperationHandler = (_input, ctx) => {
  const org = requireOrganization(ctx);
  const hId = `h-${randomChars(32)}`;
  const now = nowSeconds();
  const handshake: StoredHandshake = {
    Id: hId,
    Arn: `arn:aws:organizations::${ctx.account}:handshake/${org.Id}/enable_all_features/${hId}`,
    State: "OPEN",
    Action: "ENABLE_ALL_FEATURES",
    Parties: [{ Id: org.Id, Type: "ORGANIZATION" }],
    Resources: [{ Value: org.Id, Type: "ORGANIZATION" }],
    RequestedTimestamp: now,
    ExpirationTimestamp: now + 30 * 24 * 3600,
  };
  ctx.store.set(handshakeKey(hId), handshake);
  const updatedOrg: StoredOrganization = {
    ...org,
    FeatureSet: "ALL",
    AvailablePolicyTypes:
      org.AvailablePolicyTypes.length === 0
        ? [{ Type: "SERVICE_CONTROL_POLICY", Status: "ENABLED" }]
        : org.AvailablePolicyTypes,
  };
  ctx.store.set(orgKey, updatedOrg);
  return { Handshake: handshake };
};

const EnablePolicyType: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const rootId = requireString(input, "RootId");
  const policyType = requireString(input, "PolicyType");
  const root = ctx.store.get<StoredRoot>(rootKey);
  if (root === undefined || root.Id !== rootId) {
    throw awsError(
      "RootNotFoundException",
      "We can't find a root with the RootId that you specified.",
      400,
    );
  }
  const existing = root.PolicyTypes.find((pt) => pt.Type === policyType);
  if (existing !== undefined && existing.Status === "ENABLED") {
    throw awsError(
      "PolicyTypeAlreadyEnabledException",
      "The specified policy type is already enabled.",
      400,
    );
  }
  const updatedRoot: StoredRoot = {
    ...root,
    PolicyTypes: [
      ...root.PolicyTypes.filter((pt) => pt.Type !== policyType),
      { Type: policyType, Status: "ENABLED" },
    ],
  };
  ctx.store.set(rootKey, updatedRoot);
  const orgHasType = org.AvailablePolicyTypes.some(
    (pt) => pt.Type === policyType,
  );
  if (!orgHasType) {
    const updatedOrg: StoredOrganization = {
      ...org,
      AvailablePolicyTypes: [
        ...org.AvailablePolicyTypes,
        { Type: policyType, Status: "ENABLED" },
      ],
    };
    ctx.store.set(orgKey, updatedOrg);
  }
  return { Root: updatedRoot };
};

const InviteAccountToOrganization: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const target = input["Target"] as Record<string, unknown> | undefined;
  if (target === undefined) {
    throw awsError("InvalidInputException", "Target is required.", 400);
  }
  const targetId = requireString(target, "Id");
  const targetType = requireString(target, "Type");
  const hId = `h-${randomChars(32)}`;
  const now = nowSeconds();
  const handshake: StoredHandshake = {
    Id: hId,
    Arn: `arn:aws:organizations::${ctx.account}:handshake/${org.Id}/invite/${hId}`,
    State: "REQUESTED",
    Action: "INVITE",
    Parties: [
      { Id: org.Id, Type: "ORGANIZATION" },
      { Id: targetId, Type: targetType },
    ],
    Resources: [
      { Value: targetId, Type: "ACCOUNT" },
      { Value: org.Id, Type: "ORGANIZATION" },
    ],
    RequestedTimestamp: now,
    ExpirationTimestamp: now + 15 * 24 * 3600,
  };
  ctx.store.set(handshakeKey(hId), handshake);
  return { Handshake: handshake };
};

const InviteOrganizationToTransferResponsibility: OperationHandler = (
  input,
  ctx,
) => {
  const org = requireOrganization(ctx);
  const type = requireString(input, "Type");
  const target = input["Target"] as Record<string, unknown> | undefined;
  const targetAccountId =
    target !== undefined
      ? (optionalString(target, "Id") ?? ctx.account)
      : ctx.account;
  const now = nowSeconds();
  const hId = `h-${randomChars(32)}`;
  const handshake: StoredHandshake = {
    Id: hId,
    Arn: `arn:aws:organizations::${ctx.account}:handshake/${org.Id}/transfer_responsibility/${hId}`,
    State: "REQUESTED",
    Action: "TRANSFER_RESPONSIBILITY",
    Parties: [
      { Id: org.Id, Type: "ORGANIZATION" },
      { Id: targetAccountId, Type: "ACCOUNT" },
    ],
    Resources: [{ Value: type, Type: "RESPONSIBILITY_TYPE" }],
    RequestedTimestamp: now,
    ExpirationTimestamp: now + 15 * 24 * 3600,
  };
  ctx.store.set(handshakeKey(hId), handshake);
  const rtId = `rt-${randomChars(16)}`;
  const rt: StoredResponsibilityTransfer = {
    Id: rtId,
    Arn: `arn:aws:organizations::${ctx.account}:transfer/${org.Id}/${rtId}`,
    Name: optionalString(input, "SourceName") ?? "transfer",
    Type: type,
    Status: "REQUESTED",
    Source: {
      ManagementAccountId: ctx.account,
      ManagementAccountEmail: "",
    },
    Target: {
      ManagementAccountId: targetAccountId,
      ManagementAccountEmail: "",
    },
    StartTimestamp: now,
    ActiveHandshakeId: hId,
  };
  ctx.store.set(rtKey(rtId), rt);
  return { Handshake: handshake };
};

const LeaveOrganization: OperationHandler = (_input, ctx) => {
  const org = requireOrganization(ctx);
  if (ctx.account === org.MasterAccountId) {
    throw awsError(
      "MasterCannotLeaveOrganizationException",
      "You can't remove a management account from an organization.",
      400,
    );
  }
  const account = ctx.store.get<StoredAccount>(accountKey(ctx.account));
  if (account === undefined) {
    throw awsError(
      "AccountNotFoundException",
      "We can't find an account with the AccountId that you specified.",
      400,
    );
  }
  const hasAttached = ctx.store
    .list()
    .some(
      (entry) =>
        entry.key.startsWith("attachment/") &&
        entry.key.endsWith(`/${ctx.account}`),
    );
  if (hasAttached) {
    throw awsError(
      "ConstraintViolationException",
      "You must detach all policies before leaving the organization.",
      400,
    );
  }
  ctx.store.delete(accountKey(ctx.account));
  return {};
};

const ListAWSServiceAccessForOrganization: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const services = ctx.store
    .list<StoredEnabledService>()
    .filter((entry) => entry.key.startsWith("service/"))
    .map((entry) => ({
      ServicePrincipal: entry.value.ServicePrincipal,
      DateEnabled: entry.value.DateEnabled,
    }));
  return { EnabledServicePrincipals: services };
};

const ListAccountsForParent: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const parentId = requireString(input, "ParentId");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list<StoredAccount>()
    .filter((entry) => entry.key.startsWith("account/"))
    .map((entry) => entry.value)
    .filter((a) => a.ParentId === parentId);
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Accounts: page, NextToken: nextToken };
};

const ListAccountsWithInvalidEffectivePolicy: OperationHandler = (
  input,
  ctx,
) => {
  requireOrganization(ctx);
  const policyType = requireString(input, "PolicyType");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const root = ctx.store.get<StoredRoot>(rootKey);
  const typeEnabled =
    root?.PolicyTypes.some(
      (pt) => pt.Type === policyType && pt.Status === "ENABLED",
    ) ?? false;
  if (!typeEnabled) {
    return { Accounts: [], PolicyType: policyType };
  }
  const all = ctx.store
    .list<StoredAccount>()
    .filter((entry) => entry.key.startsWith("account/"))
    .map((entry) => entry.value)
    .filter((account) => {
      const hierarchy = getHierarchyPath(ctx, account.Id);
      return !hierarchy.some((nodeId) =>
        ctx.store.list().some((entry) => {
          if (
            !entry.key.startsWith("attachment/") ||
            !entry.key.endsWith(`/${nodeId}`)
          ) {
            return false;
          }
          const parts = entry.key.split("/");
          const p = ctx.store.get<StoredPolicy>(policyKey(parts[1] ?? ""));
          return p !== undefined && p.Type === policyType;
        }),
      );
    });
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Accounts: page, PolicyType: policyType, NextToken: nextToken };
};

const ListChildren: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const parentId = requireString(input, "ParentId");
  const childType = requireString(input, "ChildType");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  if (childType === "ACCOUNT") {
    const all = ctx.store
      .list<StoredAccount>()
      .filter((entry) => entry.key.startsWith("account/"))
      .map((entry) => entry.value)
      .filter((a) => a.ParentId === parentId)
      .map((a) => ({ Id: a.Id, Type: "ACCOUNT" as const }));
    const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
    return { Children: page, NextToken: nextToken };
  }
  const all = ctx.store
    .list<StoredOrganizationalUnit>()
    .filter((entry) => entry.key.startsWith("ou/"))
    .map((entry) => entry.value)
    .filter((ou) => ou.ParentId === parentId)
    .map((ou) => ({ Id: ou.Id, Type: "ORGANIZATIONAL_UNIT" as const }));
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Children: page, NextToken: nextToken };
};

const ListCreateAccountStatus: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const states = input["States"] as string[] | undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list<StoredCreateAccountStatus>()
    .filter((entry) => entry.key.startsWith("cas/"))
    .map((entry) => entry.value)
    .filter(
      (s) =>
        states === undefined || states.length === 0 || states.includes(s.State),
    );
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { CreateAccountStatuses: page, NextToken: nextToken };
};

const ListDelegatedAdministrators: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const filterSp = optionalString(input, "ServicePrincipal");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const delegates = ctx.store
    .list<{
      AccountId: string;
      ServicePrincipal: string;
      DelegationEnabledDate: number;
    }>()
    .filter((entry) => entry.key.startsWith("delegate/"))
    .map((entry) => entry.value)
    .filter((d) => filterSp === undefined || d.ServicePrincipal === filterSp);
  const all = delegates.map((d) => {
    const account = ctx.store.get<StoredAccount>(accountKey(d.AccountId));
    return {
      Id: d.AccountId,
      Arn: account?.Arn ?? "",
      Email: account?.Email ?? "",
      Name: account?.Name ?? "",
      Status: account?.Status ?? "ACTIVE",
      State: account?.State ?? "ACTIVE",
      JoinedMethod: account?.JoinedMethod ?? "CREATED",
      JoinedTimestamp: account?.JoinedTimestamp ?? 0,
      DelegationEnabledDate: d.DelegationEnabledDate,
    };
  });
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { DelegatedAdministrators: page, NextToken: nextToken };
};

const ListDelegatedServicesForAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  requireAccount(ctx, accountId);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const prefix = `delegate/${accountId}/`;
  const all = ctx.store
    .list<{
      AccountId: string;
      ServicePrincipal: string;
      DelegationEnabledDate: number;
    }>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      ServicePrincipal: entry.value.ServicePrincipal,
      DelegationEnabledDate: entry.value.DelegationEnabledDate,
    }));
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { DelegatedServices: page, NextToken: nextToken };
};

const ListEffectivePolicyValidationErrors: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  requireAccount(ctx, accountId);
  const policyType = requireString(input, "PolicyType");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const hierarchy = getHierarchyPath(ctx, accountId);
  const path = hierarchy
    .slice()
    .reverse()
    .map((nodeId) => {
      const root = ctx.store.get<StoredRoot>(rootKey);
      if (root !== undefined && root.Id === nodeId) {
        return { Id: nodeId, Type: "ROOT" as const };
      }
      const ou = ctx.store.get<StoredOrganizationalUnit>(ouKey(nodeId));
      if (ou !== undefined) {
        return { Id: nodeId, Type: "ORGANIZATIONAL_UNIT" as const };
      }
      return { Id: nodeId, Type: "ACCOUNT" as const };
    });
  const allErrors: {
    PolicyId?: string;
    PolicyType: string;
    ErrorCode: string;
    ErrorMessage: string;
  }[] = [];
  const { page, nextToken } = paginate(
    allErrors,
    maxResults,
    input["NextToken"],
  );
  return {
    AccountId: accountId,
    PolicyType: policyType,
    Path: path,
    EvaluationTimestamp: nowSeconds(),
    EffectivePolicyValidationErrors: page,
    NextToken: nextToken,
  };
};

const ListHandshakesForAccount: OperationHandler = (input, ctx) => {
  const filter = input["Filter"] as Record<string, unknown> | undefined;
  const actionType =
    filter !== undefined ? optionalString(filter, "ActionType") : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list<StoredHandshake>()
    .filter((entry) => entry.key.startsWith("handshake/"))
    .map((entry) => entry.value)
    .filter((h) => h.Parties.some((p) => p.Id === ctx.account))
    .filter((h) => actionType === undefined || h.Action === actionType);
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Handshakes: page, NextToken: nextToken };
};

const ListHandshakesForOrganization: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const filter = input["Filter"] as Record<string, unknown> | undefined;
  const actionType =
    filter !== undefined ? optionalString(filter, "ActionType") : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list<StoredHandshake>()
    .filter((entry) => entry.key.startsWith("handshake/"))
    .map((entry) => entry.value)
    .filter((h) => actionType === undefined || h.Action === actionType);
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Handshakes: page, NextToken: nextToken };
};

const ListInboundResponsibilityTransfers: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const transfers = ctx.store
    .list<StoredResponsibilityTransfer>()
    .filter((entry) => entry.key.startsWith("rt/"))
    .map((entry) => entry.value)
    .filter((rt) => rt.Target.ManagementAccountId === ctx.account);
  return { ResponsibilityTransfers: transfers };
};

const ListOutboundResponsibilityTransfers: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const transfers = ctx.store
    .list<StoredResponsibilityTransfer>()
    .filter((entry) => entry.key.startsWith("rt/"))
    .map((entry) => entry.value)
    .filter((rt) => rt.Source.ManagementAccountId === ctx.account);
  return { ResponsibilityTransfers: transfers };
};

const ListParents: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const childId = requireString(input, "ChildId");
  const account = ctx.store.get<StoredAccount>(accountKey(childId));
  if (account !== undefined) {
    const parentId = account.ParentId;
    const parentType = parentId.startsWith("r-")
      ? "ROOT"
      : "ORGANIZATIONAL_UNIT";
    return { Parents: [{ Id: parentId, Type: parentType }] };
  }
  const ou = ctx.store.get<StoredOrganizationalUnit>(ouKey(childId));
  if (ou !== undefined) {
    const parentId = ou.ParentId;
    const parentType = parentId.startsWith("r-")
      ? "ROOT"
      : "ORGANIZATIONAL_UNIT";
    return { Parents: [{ Id: parentId, Type: parentType }] };
  }
  throw awsError(
    "ChildNotFoundException",
    "We can't find a child with the ChildId that you specified.",
    400,
  );
};

const ListPolicies: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const filter = optionalString(input, "Filter");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list<StoredPolicy>()
    .filter((entry) => entry.key.startsWith("policy/"))
    .map((entry) => entry.value)
    .filter((p) => filter === undefined || p.Type === filter)
    .map((p) => ({
      Id: p.Id,
      Arn: p.Arn,
      Name: p.Name,
      Description: p.Description,
      Type: p.Type,
      AwsManaged: p.AwsManaged,
    }));
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Policies: page, NextToken: nextToken };
};

const ListPoliciesForTarget: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const targetId = requireString(input, "TargetId");
  const filter = optionalString(input, "Filter");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all = ctx.store
    .list()
    .filter(
      (entry) =>
        entry.key.startsWith("attachment/") &&
        entry.key.endsWith(`/${targetId}`),
    )
    .map((entry) => {
      const parts = entry.key.split("/");
      return parts[1];
    })
    .map((pId) => ctx.store.get<StoredPolicy>(policyKey(pId)))
    .filter((p): p is StoredPolicy => p !== undefined)
    .filter((p) => filter === undefined || p.Type === filter)
    .map((p) => ({
      Id: p.Id,
      Arn: p.Arn,
      Name: p.Name,
      Description: p.Description,
      Type: p.Type,
      AwsManaged: p.AwsManaged,
    }));
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Policies: page, NextToken: nextToken };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const resourceId = requireString(input, "ResourceId");
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const all =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceId)) ?? [];
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Tags: page, NextToken: nextToken };
};

const ListTargetsForPolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const policyId = requireString(input, "PolicyId");
  requirePolicy(ctx, policyId);
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 20;
  const prefix = `attachment/${policyId}/`;
  const all = ctx.store
    .list<{ PolicyId: string; TargetId: string }>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => {
      const targetId = entry.value.TargetId;
      return resolveTarget(ctx, targetId);
    });
  const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
  return { Targets: page, NextToken: nextToken };
};

const MoveAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  const sourceParentId = requireString(input, "SourceParentId");
  const destParentId = requireString(input, "DestinationParentId");
  const account = requireAccount(ctx, accountId);
  if (account.ParentId !== sourceParentId) {
    throw awsError(
      "SourceParentNotFoundException",
      "We can't find a source root or OU with the ParentId that you specified.",
      400,
    );
  }
  const root = ctx.store.get<StoredRoot>(rootKey);
  const destIsRoot = root !== undefined && root.Id === destParentId;
  const destIsOU =
    ctx.store.get<StoredOrganizationalUnit>(ouKey(destParentId)) !== undefined;
  if (!destIsRoot && !destIsOU) {
    throw awsError(
      "DestinationParentNotFoundException",
      "We can't find a destination root or OU with the ParentId that you specified.",
      400,
    );
  }
  const updated: StoredAccount = { ...account, ParentId: destParentId };
  ctx.store.set(accountKey(accountId), updated);
  return {};
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const content = requireString(input, "Content");
  const existing = ctx.store.get<StoredResourcePolicy>(resourcePolicyKey);
  const rpId = existing?.Id ?? `rp-${randomChars(16)}`;
  const rp: StoredResourcePolicy = {
    Id: rpId,
    Arn: `arn:aws:organizations::${ctx.account}:resourcepolicy/${org.Id}/${rpId}`,
    Content: content,
  };
  ctx.store.set(resourcePolicyKey, rp);
  return {
    ResourcePolicy: {
      ResourcePolicySummary: { Id: rp.Id, Arn: rp.Arn },
      Content: rp.Content,
    },
  };
};

const RegisterDelegatedAdministrator: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  const sp = requireString(input, "ServicePrincipal");
  requireAccount(ctx, accountId);
  const key = delegateKey(accountId, sp);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "AccountAlreadyRegisteredException",
      "The specified account is already a delegated administrator for this service principal.",
      400,
    );
  }
  ctx.store.set(key, {
    AccountId: accountId,
    ServicePrincipal: sp,
    DelegationEnabledDate: nowSeconds(),
  });
  return {};
};

const RemoveAccountFromOrganization: OperationHandler = (input, ctx) => {
  const org = requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  requireAccount(ctx, accountId);
  if (accountId === org.MasterAccountId) {
    throw awsError(
      "MasterCannotLeaveOrganizationException",
      "You can't remove a management account from an organization.",
      400,
    );
  }
  const hasAttached = ctx.store
    .list()
    .some(
      (entry) =>
        entry.key.startsWith("attachment/") &&
        entry.key.endsWith(`/${accountId}`),
    );
  if (hasAttached) {
    throw awsError(
      "ConstraintViolationException",
      "You must detach all policies before removing an account from the organization.",
      400,
    );
  }
  ctx.store.delete(accountKey(accountId));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const resourceId = requireString(input, "ResourceId");
  const newTags = (input["Tags"] as { Key: string; Value: string }[]) ?? [];
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceId)) ?? [];
  const merged = [
    ...existing.filter((t) => !newTags.some((nt) => nt.Key === t.Key)),
    ...newTags,
  ];
  ctx.store.set(tagsKey(resourceId), merged);
  return {};
};

const TerminateResponsibilityTransfer: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const id = requireString(input, "Id");
  const rt = requireRT(ctx, id);
  const updated: StoredResponsibilityTransfer = {
    ...rt,
    Status: "TERMINATED",
    EndTimestamp: nowSeconds(),
  };
  ctx.store.set(rtKey(id), updated);
  return { ResponsibilityTransfer: updated };
};

const UntagResource: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const resourceId = requireString(input, "ResourceId");
  const tagKeys = (input["TagKeys"] as string[]) ?? [];
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceId)) ?? [];
  const updated = existing.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(tagsKey(resourceId), updated);
  return {};
};

const UpdateOrganizationalUnit: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const ouId = requireString(input, "OrganizationalUnitId");
  const ou = requireOU(ctx, ouId);
  const name = optionalString(input, "Name") ?? ou.Name;
  const updated: StoredOrganizationalUnit = { ...ou, Name: name };
  ctx.store.set(ouKey(ouId), updated);
  return {
    OrganizationalUnit: {
      Id: updated.Id,
      Arn: updated.Arn,
      Name: updated.Name,
    },
  };
};

const UpdatePolicy: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const pId = requireString(input, "PolicyId");
  const policy = requirePolicy(ctx, pId);
  const updated: StoredPolicy = {
    ...policy,
    Name: optionalString(input, "Name") ?? policy.Name,
    Description: optionalString(input, "Description") ?? policy.Description,
    Content: optionalString(input, "Content") ?? policy.Content,
  };
  ctx.store.set(policyKey(pId), updated);
  return {
    Policy: {
      PolicySummary: {
        Id: updated.Id,
        Arn: updated.Arn,
        Name: updated.Name,
        Description: updated.Description,
        Type: updated.Type,
        AwsManaged: updated.AwsManaged,
      },
      Content: updated.Content,
    },
  };
};

const UpdateResponsibilityTransfer: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const id = requireString(input, "Id");
  const rt = requireRT(ctx, id);
  const updated: StoredResponsibilityTransfer = {
    ...rt,
    Name: optionalString(input, "Name") ?? rt.Name,
  };
  ctx.store.set(rtKey(id), updated);
  return { ResponsibilityTransfer: updated };
};

const organizations = {
  name: "organizations",
  protocol: "json",
  operations: {
    AcceptHandshake,
    AttachPolicy,
    CancelHandshake,
    CloseAccount,
    CreateAccount,
    CreateGovCloudAccount,
    CreateOrganization,
    CreateOrganizationalUnit,
    CreatePolicy,
    DeclineHandshake,
    DeleteOrganization,
    DeleteOrganizationalUnit,
    DeletePolicy,
    DeleteResourcePolicy,
    DeregisterDelegatedAdministrator,
    DescribeAccount,
    DescribeCreateAccountStatus,
    DescribeEffectivePolicy,
    DescribeHandshake,
    DescribeOrganization,
    DescribeOrganizationalUnit,
    DescribePolicy,
    DescribeResourcePolicy,
    DescribeResponsibilityTransfer,
    DetachPolicy,
    DisableAWSServiceAccess,
    DisablePolicyType,
    EnableAWSServiceAccess,
    EnableAllFeatures,
    EnablePolicyType,
    InviteAccountToOrganization,
    InviteOrganizationToTransferResponsibility,
    LeaveOrganization,
    ListAWSServiceAccessForOrganization,
    ListAccounts,
    ListAccountsForParent,
    ListAccountsWithInvalidEffectivePolicy,
    ListChildren,
    ListCreateAccountStatus,
    ListDelegatedAdministrators,
    ListDelegatedServicesForAccount,
    ListEffectivePolicyValidationErrors,
    ListHandshakesForAccount,
    ListHandshakesForOrganization,
    ListInboundResponsibilityTransfers,
    ListOrganizationalUnitsForParent,
    ListOutboundResponsibilityTransfers,
    ListParents,
    ListPolicies,
    ListPoliciesForTarget,
    ListRoots,
    ListTagsForResource,
    ListTargetsForPolicy,
    MoveAccount,
    PutResourcePolicy,
    RegisterDelegatedAdministrator,
    RemoveAccountFromOrganization,
    TagResource,
    TerminateResponsibilityTransfer,
    UntagResource,
    UpdateOrganizationalUnit,
    UpdatePolicy,
    UpdateResponsibilityTransfer,
  },
  model,
} as const satisfies ServiceDefinition;

export default organizations;
