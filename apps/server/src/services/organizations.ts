import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import organizationsModel from "../../../../test/vendor/aws-models/organizations.json" with { type: "json" };
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
};

type StoredCreateAccountStatus = {
  Id: string;
  AccountName: string;
  State: string;
  RequestedTimestamp: number;
  CompletedTimestamp: number;
  AccountId: string;
};

type StoredOrganizationalUnit = {
  Id: string;
  Arn: string;
  Name: string;
  ParentId: string;
};

const orgKey = "organization" as const;

const rootKey = "root" as const;

const accountKey = (id: string): string => `account/${id}`;

const ouKey = (id: string): string => `ou/${id}`;

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
  const account: StoredAccount = {
    Id: accountId,
    Arn: `arn:aws:organizations::${ctx.account}:account/o-${randomChars(10)}/${accountId}`,
    Email: email,
    Name: name,
    Status: "ACTIVE",
    State: "ACTIVE",
    JoinedMethod: "CREATED",
    JoinedTimestamp: now,
  };
  ctx.store.set(accountKey(accountId), account);
  const status: StoredCreateAccountStatus = {
    Id: `car-${randomChars(16)}`,
    AccountName: name,
    State: "SUCCEEDED",
    RequestedTimestamp: now,
    CompletedTimestamp: now,
    AccountId: accountId,
  };
  return { CreateAccountStatus: status };
};

const DescribeAccount: OperationHandler = (input, ctx) => {
  requireOrganization(ctx);
  const accountId = requireString(input, "AccountId");
  const account = ctx.store.get<StoredAccount>(accountKey(accountId));
  if (account === undefined) {
    throw awsError(
      "AccountNotFoundException",
      "We can't find an account with the AccountId that you specified.",
      400,
    );
  }
  return { Account: account };
};

const ListAccounts: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const accounts = ctx.store
    .list<StoredAccount>()
    .filter((entry) => entry.key.startsWith("account/"))
    .map((entry) => entry.value);
  return { Accounts: accounts };
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
  const units = ctx.store
    .list<StoredOrganizationalUnit>()
    .filter((entry) => entry.key.startsWith("ou/"))
    .map((entry) => entry.value)
    .filter((ou) => ou.ParentId === parentId)
    .map((ou) => ({ Id: ou.Id, Arn: ou.Arn, Name: ou.Name }));
  return { OrganizationalUnits: units };
};

const ListRoots: OperationHandler = (_input, ctx) => {
  requireOrganization(ctx);
  const root = ctx.store.get<StoredRoot>(rootKey);
  return { Roots: root === undefined ? [] : [root] };
};

const organizations = {
  name: "organizations",
  protocol: "json",
  operations: {
    CreateOrganization,
    DescribeOrganization,
    CreateAccount,
    DescribeAccount,
    ListAccounts,
    CreateOrganizationalUnit,
    ListOrganizationalUnitsForParent,
    ListRoots,
  },
  model,
} as const satisfies ServiceDefinition;

export default organizations;
