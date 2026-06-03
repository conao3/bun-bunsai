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

type StoredGroup = {
  Path: string;
  GroupName: string;
  GroupId: string;
  Arn: string;
  CreateDate: string;
};

type StoredGroupMember = {
  GroupName: string;
  UserName: string;
};

type StoredPolicyVersion = {
  PolicyArn: string;
  VersionId: string;
  Document: string;
  IsDefaultVersion: boolean;
  CreateDate: string;
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

const groupKey = (name: string): string => `group/${name}`;

const groupMemberKey = (groupName: string, userName: string): string =>
  `groupmember/${groupName}/${userName}`;

const policyVersionKey = (arn: string, versionId: string): string =>
  `policyversion/${arn}/${versionId}`;

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

const groupArnOf = (account: string, path: string, name: string): string =>
  `arn:aws:iam::${account}:group${path}${name}`;

const serviceLinkedRoleArnOf = (
  account: string,
  service: string,
  name: string,
): string => `arn:aws:iam::${account}:role/aws-service-role/${service}/${name}`;

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

const requireGroup = (ctx: ServiceContext, name: string): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(groupKey(name));
  if (group === undefined) {
    throw awsError("NoSuchEntity", `Group ${name} cannot be found.`, 404);
  }
  return group;
};

const CreateGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GroupName");
  if (ctx.store.get<StoredGroup>(groupKey(name)) !== undefined) {
    throw awsError(
      "EntityAlreadyExists",
      `Group with name ${name} already exists.`,
      409,
    );
  }
  const path = normalizePath(input);
  const group: StoredGroup = {
    Path: path,
    GroupName: name,
    GroupId: `AGPA${randomHex(17)}`,
    Arn: groupArnOf(ctx.account, path, name),
    CreateDate: new Date().toISOString(),
  };
  ctx.store.set(groupKey(name), group);
  return { Group: group };
};

const GetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GroupName");
  const group = requireGroup(ctx, name);
  const users = ctx.store
    .list<StoredGroupMember>()
    .filter(
      (entry) =>
        entry.key.startsWith("groupmember/") && entry.value.GroupName === name,
    )
    .map((entry) => ctx.store.get<StoredUser>(userKey(entry.value.UserName)))
    .filter((user): user is StoredUser => user !== undefined);
  return { Group: group, Users: users, IsTruncated: false };
};

const ListGroups: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "PathPrefix") ?? "/";
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((entry) => entry.key.startsWith("group/"))
    .map((entry) => entry.value)
    .filter((group) => group.Path.startsWith(prefix));
  return { Groups: groups, IsTruncated: false };
};

const DeleteGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GroupName");
  requireGroup(ctx, name);
  ctx.store.delete(groupKey(name));
  for (const entry of ctx.store.list<StoredGroupMember>()) {
    if (
      entry.key.startsWith("groupmember/") &&
      entry.value.GroupName === name
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const AddUserToGroup: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const userName = requireString(input, "UserName");
  requireGroup(ctx, groupName);
  requireUser(ctx, userName);
  const member: StoredGroupMember = {
    GroupName: groupName,
    UserName: userName,
  };
  ctx.store.set(groupMemberKey(groupName, userName), member);
  return {};
};

const RemoveUserFromGroup: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const userName = requireString(input, "UserName");
  requireGroup(ctx, groupName);
  ctx.store.delete(groupMemberKey(groupName, userName));
  return {};
};

const policyVersionsOf = (
  ctx: ServiceContext,
  policyArn: string,
): StoredPolicyVersion[] =>
  ctx.store
    .list<StoredPolicyVersion>()
    .filter(
      (entry) =>
        entry.key.startsWith("policyversion/") &&
        entry.value.PolicyArn === policyArn,
    )
    .map((entry) => entry.value);

const CreatePolicyVersion: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  const document = requireString(input, "PolicyDocument");
  const policy = requirePolicy(ctx, policyArn);
  const setAsDefault = input["SetAsDefault"] === true;
  const existing = policyVersionsOf(ctx, policyArn);
  const maxVersion = existing.reduce((max, version) => {
    const num = Number.parseInt(version.VersionId.slice(1), 10);
    return num > max ? num : max;
  }, 1);
  const versionId = `v${maxVersion + 1}`;
  const now = new Date().toISOString();
  if (setAsDefault) {
    for (const version of existing) {
      if (version.IsDefaultVersion) {
        ctx.store.set(policyVersionKey(policyArn, version.VersionId), {
          ...version,
          IsDefaultVersion: false,
        });
      }
    }
  }
  const created: StoredPolicyVersion = {
    PolicyArn: policyArn,
    VersionId: versionId,
    Document: document,
    IsDefaultVersion: setAsDefault,
    CreateDate: now,
  };
  ctx.store.set(policyVersionKey(policyArn, versionId), created);
  if (setAsDefault) {
    ctx.store.set(policyKey(policyArn), {
      ...policy,
      DefaultVersionId: versionId,
      UpdateDate: now,
    });
  }
  return {
    PolicyVersion: {
      Document: created.Document,
      VersionId: created.VersionId,
      IsDefaultVersion: created.IsDefaultVersion,
      CreateDate: created.CreateDate,
    },
  };
};

const defaultPolicyVersionOf = (policy: StoredPolicy): StoredPolicyVersion => ({
  PolicyArn: policy.Arn,
  VersionId: "v1",
  Document: policy.PolicyDocument ?? "",
  IsDefaultVersion: policy.DefaultVersionId === "v1",
  CreateDate: policy.CreateDate,
});

const ListPolicyVersions: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  const policy = requirePolicy(ctx, policyArn);
  const stored = policyVersionsOf(ctx, policyArn);
  const hasV1 = stored.some((version) => version.VersionId === "v1");
  const versions = (
    hasV1 ? stored : [defaultPolicyVersionOf(policy), ...stored]
  ).map((version) => ({
    VersionId: version.VersionId,
    IsDefaultVersion: version.VersionId === policy.DefaultVersionId,
    CreateDate: version.CreateDate,
  }));
  return { Versions: versions, IsTruncated: false };
};

const GetPolicyVersion: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  const versionId = requireString(input, "VersionId");
  const policy = requirePolicy(ctx, policyArn);
  const stored = ctx.store.get<StoredPolicyVersion>(
    policyVersionKey(policyArn, versionId),
  );
  const version =
    stored ?? (versionId === "v1" ? defaultPolicyVersionOf(policy) : undefined);
  if (version === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Policy version ${versionId} does not exist.`,
      404,
    );
  }
  return {
    PolicyVersion: {
      Document: version.Document,
      VersionId: version.VersionId,
      IsDefaultVersion: version.IsDefaultVersion,
      CreateDate: version.CreateDate,
    },
  };
};

const CreateServiceLinkedRole: OperationHandler = (input, ctx) => {
  const awsServiceName = requireString(input, "AWSServiceName");
  const suffix = optionalString(input, "CustomSuffix");
  const baseName = `AWSServiceRoleFor${awsServiceName.split(".")[0]}`;
  const name = suffix === undefined ? baseName : `${baseName}_${suffix}`;
  if (ctx.store.get<StoredRole>(roleKey(name)) !== undefined) {
    throw awsError(
      "EntityAlreadyExists",
      `Role with name ${name} already exists.`,
      409,
    );
  }
  const path = `/aws-service-role/${awsServiceName}/`;
  const role: StoredRole = {
    Path: path,
    RoleName: name,
    RoleId: `AROA${randomHex(17)}`,
    Arn: serviceLinkedRoleArnOf(ctx.account, awsServiceName, name),
    CreateDate: new Date().toISOString(),
    Description: optionalString(input, "Description"),
    MaxSessionDuration: 3600,
  };
  ctx.store.set(roleKey(name), role);
  return { Role: role };
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
    CreateGroup,
    GetGroup,
    ListGroups,
    DeleteGroup,
    AddUserToGroup,
    RemoveUserFromGroup,
    CreatePolicyVersion,
    ListPolicyVersions,
    GetPolicyVersion,
    CreateServiceLinkedRole,
  },
  model,
} as const satisfies ServiceDefinition;

export default iam;
