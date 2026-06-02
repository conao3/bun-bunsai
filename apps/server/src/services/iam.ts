import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import iamModel from "../../../../test/vendor/aws-models/iam.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(iamModel);

type StoredRole = {
  Path: string;
  RoleName: string;
  RoleId: string;
  Arn: string;
  CreateDate: string;
  AssumeRolePolicyDocument?: string;
  Description?: string;
  MaxSessionDuration: number;
};

type StoredUser = {
  Path: string;
  UserName: string;
  UserId: string;
  Arn: string;
  CreateDate: string;
};

type StoredPolicy = {
  PolicyName: string;
  PolicyId: string;
  Arn: string;
  Path: string;
  DefaultVersionId: string;
  AttachmentCount: number;
  IsAttachable: boolean;
  Description?: string;
  PolicyDocument?: string;
  CreateDate: string;
  UpdateDate: string;
};

type StoredAttachment = {
  RoleName: string;
  PolicyArn: string;
  PolicyName: string;
};

type StoredAccessKey = {
  UserName: string;
  AccessKeyId: string;
  Status: string;
  SecretAccessKey: string;
  CreateDate: string;
};

type StoredRolePolicy = {
  RoleName: string;
  PolicyName: string;
  PolicyDocument: string;
};

type StoredTag = {
  Key: string;
  Value: string;
};

type StoredInstanceProfile = {
  Path: string;
  InstanceProfileName: string;
  InstanceProfileId: string;
  Arn: string;
  CreateDate: string;
  Roles: StoredRole[];
  Tags: StoredTag[];
};

const roleKey = (name: string): string => `role/${name}`;

const userKey = (name: string): string => `user/${name}`;

const policyKey = (arn: string): string => `policy/${arn}`;

const attachmentKey = (roleName: string, policyArn: string): string =>
  `attachment/${roleName}/${policyArn}`;

const accessKeyKey = (id: string): string => `accesskey/${id}`;

const rolePolicyKey = (roleName: string, policyName: string): string =>
  `rolepolicy/${roleName}/${policyName}`;

const roleTagKey = (roleName: string, tagKey: string): string =>
  `roletag/${roleName}/${tagKey}`;

const instanceProfileKey = (name: string): string => `instanceprofile/${name}`;

const roleArnOf = (account: string, path: string, name: string): string =>
  `arn:aws:iam::${account}:role${path}${name}`;

const userArnOf = (account: string, path: string, name: string): string =>
  `arn:aws:iam::${account}:user${path}${name}`;

const policyArnOf = (account: string, path: string, name: string): string =>
  `arn:aws:iam::${account}:policy${path}${name}`;

const instanceProfileArnOf = (
  account: string,
  path: string,
  name: string,
): string => `arn:aws:iam::${account}:instance-profile${path}${name}`;

const randomHex = (length: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationError", `${key} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
};

const normalizePath = (input: Record<string, unknown>): string => {
  const path = optionalString(input, "Path");
  if (path === undefined || path === "") {
    return "/";
  }
  return path;
};

const CreateRole: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RoleName");
  if (ctx.store.get<StoredRole>(roleKey(name)) !== undefined) {
    throw awsError(
      "EntityAlreadyExists",
      `Role with name ${name} already exists.`,
      409,
    );
  }
  const path = normalizePath(input);
  const maxSessionDuration =
    typeof input["MaxSessionDuration"] === "number"
      ? (input["MaxSessionDuration"] as number)
      : 3600;
  const role: StoredRole = {
    Path: path,
    RoleName: name,
    RoleId: `AROA${randomHex(17)}`,
    Arn: roleArnOf(ctx.account, path, name),
    CreateDate: new Date().toISOString(),
    AssumeRolePolicyDocument: optionalString(input, "AssumeRolePolicyDocument"),
    Description: optionalString(input, "Description"),
    MaxSessionDuration: maxSessionDuration,
  };
  ctx.store.set(roleKey(name), role);
  return { Role: role };
};

const requireRole = (ctx: ServiceContext, name: string): StoredRole => {
  const role = ctx.store.get<StoredRole>(roleKey(name));
  if (role === undefined) {
    throw awsError("NoSuchEntity", `Role ${name} cannot be found.`, 404);
  }
  return role;
};

const GetRole: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RoleName");
  return { Role: requireRole(ctx, name) };
};

const DeleteRole: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RoleName");
  requireRole(ctx, name);
  ctx.store.delete(roleKey(name));
  for (const entry of ctx.store.list<StoredAttachment>()) {
    if (entry.key.startsWith("attachment/") && entry.value.RoleName === name) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const ListRoles: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "PathPrefix") ?? "/";
  const roles = ctx.store
    .list<StoredRole>()
    .filter((entry) => entry.key.startsWith("role/"))
    .map((entry) => entry.value)
    .filter((role) => role.Path.startsWith(prefix));
  return { Roles: roles, IsTruncated: false };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const name = requireString(input, "UserName");
  if (ctx.store.get<StoredUser>(userKey(name)) !== undefined) {
    throw awsError(
      "EntityAlreadyExists",
      `User with name ${name} already exists.`,
      409,
    );
  }
  const path = normalizePath(input);
  const user: StoredUser = {
    Path: path,
    UserName: name,
    UserId: `AIDA${randomHex(17)}`,
    Arn: userArnOf(ctx.account, path, name),
    CreateDate: new Date().toISOString(),
  };
  ctx.store.set(userKey(name), user);
  return { User: user };
};

const requireUser = (ctx: ServiceContext, name: string): StoredUser => {
  const user = ctx.store.get<StoredUser>(userKey(name));
  if (user === undefined) {
    throw awsError("NoSuchEntity", `User ${name} cannot be found.`, 404);
  }
  return user;
};

const GetUser: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "UserName");
  if (name === undefined || name === "") {
    throw awsError("ValidationError", "UserName is required.", 400);
  }
  return { User: requireUser(ctx, name) };
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const name = requireString(input, "UserName");
  requireUser(ctx, name);
  ctx.store.delete(userKey(name));
  for (const entry of ctx.store.list<StoredAccessKey>()) {
    if (entry.key.startsWith("accesskey/") && entry.value.UserName === name) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const ListUsers: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "PathPrefix") ?? "/";
  const users = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith("user/"))
    .map((entry) => entry.value)
    .filter((user) => user.Path.startsWith(prefix));
  return { Users: users, IsTruncated: false };
};

const CreatePolicy: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PolicyName");
  const document = requireString(input, "PolicyDocument");
  const path = normalizePath(input);
  const arn = policyArnOf(ctx.account, path, name);
  if (ctx.store.get<StoredPolicy>(policyKey(arn)) !== undefined) {
    throw awsError("EntityAlreadyExists", `Policy ${arn} already exists.`, 409);
  }
  const now = new Date().toISOString();
  const policy: StoredPolicy = {
    PolicyName: name,
    PolicyId: `ANPA${randomHex(17)}`,
    Arn: arn,
    Path: path,
    DefaultVersionId: "v1",
    AttachmentCount: 0,
    IsAttachable: true,
    Description: optionalString(input, "Description"),
    PolicyDocument: document,
    CreateDate: now,
    UpdateDate: now,
  };
  ctx.store.set(policyKey(arn), policy);
  return { Policy: policy };
};

const requirePolicy = (ctx: ServiceContext, arn: string): StoredPolicy => {
  const policy = ctx.store.get<StoredPolicy>(policyKey(arn));
  if (policy === undefined) {
    throw awsError("NoSuchEntity", `Policy ${arn} does not exist.`, 404);
  }
  return policy;
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PolicyArn");
  return { Policy: requirePolicy(ctx, arn) };
};

const AttachRolePolicy: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const policyArn = requireString(input, "PolicyArn");
  requireRole(ctx, roleName);
  const policy = requirePolicy(ctx, policyArn);
  const attachment: StoredAttachment = {
    RoleName: roleName,
    PolicyArn: policyArn,
    PolicyName: policy.PolicyName,
  };
  ctx.store.set(attachmentKey(roleName, policyArn), attachment);
  ctx.store.set(policyKey(policyArn), {
    ...policy,
    AttachmentCount: policy.AttachmentCount + 1,
  });
  return {};
};

const ListAttachedRolePolicies: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  requireRole(ctx, roleName);
  const attached = ctx.store
    .list<StoredAttachment>()
    .filter(
      (entry) =>
        entry.key.startsWith("attachment/") &&
        entry.value.RoleName === roleName,
    )
    .map((entry) => ({
      PolicyName: entry.value.PolicyName,
      PolicyArn: entry.value.PolicyArn,
    }));
  return { AttachedPolicies: attached, IsTruncated: false };
};

const CreateAccessKey: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const accessKey: StoredAccessKey = {
    UserName: userName,
    AccessKeyId: `AKIA${randomHex(16)}`,
    Status: "Active",
    SecretAccessKey: randomHex(40),
    CreateDate: new Date().toISOString(),
  };
  ctx.store.set(accessKeyKey(accessKey.AccessKeyId), accessKey);
  return { AccessKey: accessKey };
};

const ListAccessKeys: OperationHandler = (input, ctx) => {
  const userName = optionalString(input, "UserName");
  const keys = ctx.store
    .list<StoredAccessKey>()
    .filter((entry) => entry.key.startsWith("accesskey/"))
    .map((entry) => entry.value)
    .filter((key) => userName === undefined || key.UserName === userName)
    .map((key) => ({
      UserName: key.UserName,
      AccessKeyId: key.AccessKeyId,
      Status: key.Status,
      CreateDate: key.CreateDate,
    }));
  return { AccessKeyMetadata: keys, IsTruncated: false };
};

const PutRolePolicy: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const policyName = requireString(input, "PolicyName");
  const policyDocument = requireString(input, "PolicyDocument");
  requireRole(ctx, roleName);
  const rolePolicy: StoredRolePolicy = {
    RoleName: roleName,
    PolicyName: policyName,
    PolicyDocument: policyDocument,
  };
  ctx.store.set(rolePolicyKey(roleName, policyName), rolePolicy);
  return {};
};

const GetRolePolicy: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const policyName = requireString(input, "PolicyName");
  const rolePolicy = ctx.store.get<StoredRolePolicy>(
    rolePolicyKey(roleName, policyName),
  );
  if (rolePolicy === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The role policy with name ${policyName} cannot be found.`,
      404,
    );
  }
  return {
    RoleName: rolePolicy.RoleName,
    PolicyName: rolePolicy.PolicyName,
    PolicyDocument: rolePolicy.PolicyDocument,
  };
};

const ListRolePolicies: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  requireRole(ctx, roleName);
  const names = ctx.store
    .list<StoredRolePolicy>()
    .filter(
      (entry) =>
        entry.key.startsWith("rolepolicy/") &&
        entry.value.RoleName === roleName,
    )
    .map((entry) => entry.value.PolicyName);
  return { PolicyNames: names, IsTruncated: false };
};

const DeleteRolePolicy: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const policyName = requireString(input, "PolicyName");
  const key = rolePolicyKey(roleName, policyName);
  if (ctx.store.get<StoredRolePolicy>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The role policy with name ${policyName} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const requireInstanceProfile = (
  ctx: ServiceContext,
  name: string,
): StoredInstanceProfile => {
  const profile = ctx.store.get<StoredInstanceProfile>(
    instanceProfileKey(name),
  );
  if (profile === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Instance Profile ${name} cannot be found.`,
      404,
    );
  }
  return profile;
};

const toTagList = (input: Record<string, unknown>): StoredTag[] => {
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .filter(
      (tag): tag is Record<string, unknown> =>
        typeof tag === "object" && tag !== null,
    )
    .map((tag) => ({
      Key: typeof tag["Key"] === "string" ? (tag["Key"] as string) : "",
      Value: typeof tag["Value"] === "string" ? (tag["Value"] as string) : "",
    }));
};

const CreateInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  if (
    ctx.store.get<StoredInstanceProfile>(instanceProfileKey(name)) !== undefined
  ) {
    throw awsError(
      "EntityAlreadyExists",
      `Instance Profile ${name} already exists.`,
      409,
    );
  }
  const path = normalizePath(input);
  const profile: StoredInstanceProfile = {
    Path: path,
    InstanceProfileName: name,
    InstanceProfileId: `AIPA${randomHex(17)}`,
    Arn: instanceProfileArnOf(ctx.account, path, name),
    CreateDate: new Date().toISOString(),
    Roles: [],
    Tags: toTagList(input),
  };
  ctx.store.set(instanceProfileKey(name), profile);
  return { InstanceProfile: profile };
};

const AddRoleToInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  const roleName = requireString(input, "RoleName");
  const profile = requireInstanceProfile(ctx, name);
  const role = requireRole(ctx, roleName);
  if (profile.Roles.some((existing) => existing.RoleName === roleName)) {
    throw awsError(
      "LimitExceeded",
      `Cannot exceed quota for InstanceSessionsPerInstanceProfile: 1`,
      409,
    );
  }
  ctx.store.set(instanceProfileKey(name), {
    ...profile,
    Roles: [...profile.Roles, role],
  });
  return {};
};

const GetInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  return { InstanceProfile: requireInstanceProfile(ctx, name) };
};

const ListEntitiesForPolicy: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  requirePolicy(ctx, policyArn);
  const roles = ctx.store
    .list<StoredAttachment>()
    .filter(
      (entry) =>
        entry.key.startsWith("attachment/") &&
        entry.value.PolicyArn === policyArn,
    )
    .map((entry) => entry.value.RoleName)
    .map((roleName) => {
      const role = ctx.store.get<StoredRole>(roleKey(roleName));
      return {
        RoleName: roleName,
        RoleId: role === undefined ? `AROA${randomHex(17)}` : role.RoleId,
      };
    });
  return {
    PolicyGroups: [],
    PolicyUsers: [],
    PolicyRoles: roles,
    IsTruncated: false,
  };
};

const TagRole: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  requireRole(ctx, roleName);
  for (const tag of toTagList(input)) {
    ctx.store.set(roleTagKey(roleName, tag.Key), {
      RoleName: roleName,
      ...tag,
    });
  }
  return {};
};

const ListRoleTags: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  requireRole(ctx, roleName);
  const tags = ctx.store
    .list<StoredTag & { RoleName: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("roletag/") && entry.value.RoleName === roleName,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  return { Tags: tags, IsTruncated: false };
};

const iam = {
  name: "iam",
  protocol: "query",
  operations: {
    CreateRole,
    GetRole,
    DeleteRole,
    ListRoles,
    CreateUser,
    GetUser,
    DeleteUser,
    ListUsers,
    CreatePolicy,
    GetPolicy,
    AttachRolePolicy,
    ListAttachedRolePolicies,
    CreateAccessKey,
    ListAccessKeys,
    PutRolePolicy,
    GetRolePolicy,
    ListRolePolicies,
    DeleteRolePolicy,
    CreateInstanceProfile,
    AddRoleToInstanceProfile,
    GetInstanceProfile,
    ListEntitiesForPolicy,
    TagRole,
    ListRoleTags,
  },
  model,
} as const satisfies ServiceDefinition;

export default iam;
