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
  PermissionsBoundary?: {
    PermissionsBoundaryType: string;
    PermissionsBoundaryArn: string;
  };
};

type StoredUser = {
  Path: string;
  UserName: string;
  UserId: string;
  Arn: string;
  CreateDate: string;
  PermissionsBoundary?: {
    PermissionsBoundaryType: string;
    PermissionsBoundaryArn: string;
  };
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

type StoredLoginProfile = {
  UserName: string;
  CreateDate: string;
  PasswordResetRequired: boolean;
};

type StoredUserPolicy = {
  UserName: string;
  PolicyName: string;
  PolicyDocument: string;
};

type StoredUserAttachment = {
  UserName: string;
  PolicyArn: string;
  PolicyName: string;
};

type StoredGroupPolicy = {
  GroupName: string;
  PolicyName: string;
  PolicyDocument: string;
};

type StoredGroupAttachment = {
  GroupName: string;
  PolicyArn: string;
  PolicyName: string;
};

type StoredServerCertificate = {
  Path: string;
  ServerCertificateName: string;
  ServerCertificateId: string;
  Arn: string;
  UploadDate: string;
  Expiration?: string;
  CertificateBody: string;
  PrivateKey: string;
  CertificateChain?: string;
  Tags: StoredTag[];
};

type StoredSSHPublicKey = {
  UserName: string;
  SSHPublicKeyId: string;
  Fingerprint: string;
  SSHPublicKeyBody: string;
  Status: string;
  UploadDate: string;
};

type StoredSigningCertificate = {
  UserName: string;
  CertificateId: string;
  CertificateBody: string;
  Status: string;
  UploadDate: string;
};

type StoredVirtualMFADevice = {
  SerialNumber: string;
  VirtualMFADeviceName: string;
  Path: string;
  Tags: StoredTag[];
};

type StoredEnabledMFADevice = {
  UserName: string;
  SerialNumber: string;
  EnableDate: string;
};

type StoredServiceSpecificCredential = {
  UserName: string;
  ServiceName: string;
  ServiceSpecificCredentialId: string;
  ServiceUserName: string;
  ServicePassword: string;
  Status: string;
  CreateDate: string;
};

type StoredPasswordPolicy = {
  MinimumPasswordLength?: number;
  RequireSymbols?: boolean;
  RequireNumbers?: boolean;
  RequireUppercaseCharacters?: boolean;
  RequireLowercaseCharacters?: boolean;
  AllowUsersToChangePassword?: boolean;
  MaxPasswordAge?: number;
  PasswordReusePrevention?: number;
  HardExpiry?: boolean;
};

type StoredOIDCProvider = {
  Url: string;
  Arn: string;
  ClientIDList: string[];
  ThumbprintList: string[];
  CreateDate: string;
  Tags: StoredTag[];
};

type StoredDeletionTask = {
  TaskId: string;
  RoleName: string;
  Status: string;
};

type StoredServiceLastAccessJob = {
  JobId: string;
  EntityType: string;
  EntityArn: string;
  JobCreationDate: string;
  JobCompletionDate: string;
  JobStatus: string;
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

const loginProfileKey = (userName: string): string =>
  `loginprofile/${userName}`;

const userPolicyKey = (userName: string, policyName: string): string =>
  `userpolicy/${userName}/${policyName}`;

const userAttachmentKey = (userName: string, policyArn: string): string =>
  `userattachment/${userName}/${policyArn}`;

const userTagKey = (userName: string, tagKey: string): string =>
  `usertag/${userName}/${tagKey}`;

const groupPolicyKey = (groupName: string, policyName: string): string =>
  `grouppolicy/${groupName}/${policyName}`;

const groupAttachmentKey = (groupName: string, policyArn: string): string =>
  `groupattachment/${groupName}/${policyArn}`;

const serverCertKey = (name: string): string => `servercert/${name}`;

const serverCertTagKey = (name: string, tagKey: string): string =>
  `servercerttag/${name}/${tagKey}`;

const sshPublicKeyKey = (id: string): string => `sshpublickey/${id}`;

const signingCertKey = (id: string): string => `signingcert/${id}`;

const virtualMfaKey = (serialNumber: string): string =>
  `virtualmfa/${serialNumber}`;

const enabledMfaKey = (serialNumber: string): string =>
  `mfaenabled/${serialNumber}`;

const mfaTagKey = (serialNumber: string, tagKey: string): string =>
  `mfatag/${serialNumber}/${tagKey}`;

const serviceSpecCredKey = (id: string): string => `servicespeccred/${id}`;

const policyTagKey = (arn: string, tagKey: string): string =>
  `policytag/${arn}/${tagKey}`;

const oidcProviderKey = (arn: string): string => `oidcprovider/${arn}`;

const oidcProviderTagKey = (arn: string, tagKey: string): string =>
  `oidcprovidertag/${arn}/${tagKey}`;

const deletionTaskKey = (taskId: string): string => `deletiontask/${taskId}`;

const serviceLastAccessJobKey = (jobId: string): string =>
  `servicelastaccessjob/${jobId}`;

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

const serverCertArnOf = (account: string, path: string, name: string): string =>
  `arn:aws:iam::${account}:server-certificate${path}${name}`;

const virtualMfaArnOf = (account: string, path: string, name: string): string =>
  `arn:aws:iam::${account}:mfa${path}${name}`;

const oidcProviderArnOf = (account: string, url: string): string => {
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  return `arn:aws:iam::${account}:oidc-provider/${host}`;
};

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

const optionalBool = (
  input: Record<string, unknown>,
  key: string,
): boolean | undefined => {
  const value = input[key];
  return typeof value === "boolean" ? value : undefined;
};

const optionalNumber = (
  input: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = input[key];
  return typeof value === "number" ? value : undefined;
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

const UpdateUser: OperationHandler = (input, ctx) => {
  const name = requireString(input, "UserName");
  const user = requireUser(ctx, name);
  const newPath = optionalString(input, "NewPath");
  const newName = optionalString(input, "NewUserName");
  if (newName !== undefined && newName !== name) {
    if (ctx.store.get<StoredUser>(userKey(newName)) !== undefined) {
      throw awsError(
        "EntityAlreadyExists",
        `User with name ${newName} already exists.`,
        409,
      );
    }
    const updatedUser: StoredUser = {
      ...user,
      UserName: newName,
      Path: newPath ?? user.Path,
      Arn: userArnOf(ctx.account, newPath ?? user.Path, newName),
    };
    ctx.store.set(userKey(newName), updatedUser);
    ctx.store.delete(userKey(name));
    for (const entry of ctx.store.list<StoredAccessKey>()) {
      if (entry.key.startsWith("accesskey/") && entry.value.UserName === name) {
        ctx.store.set(entry.key, { ...entry.value, UserName: newName });
      }
    }
    for (const entry of ctx.store.list<StoredGroupMember>()) {
      if (
        entry.key.startsWith("groupmember/") &&
        entry.value.UserName === name
      ) {
        ctx.store.set(entry.key, { ...entry.value, UserName: newName });
      }
    }
  } else if (newPath !== undefined) {
    ctx.store.set(userKey(name), {
      ...user,
      Path: newPath,
      Arn: userArnOf(ctx.account, newPath, name),
    });
  }
  return {};
};

const TagUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  for (const tag of toTagList(input)) {
    ctx.store.set(userTagKey(userName, tag.Key), {
      UserName: userName,
      ...tag,
    });
  }
  return {};
};

const UntagUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const tagKeys = input["TagKeys"];
  if (Array.isArray(tagKeys)) {
    for (const key of tagKeys) {
      if (typeof key === "string") {
        ctx.store.delete(userTagKey(userName, key));
      }
    }
  }
  return {};
};

const ListUserTags: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const tags = ctx.store
    .list<StoredTag & { UserName: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("usertag/") && entry.value.UserName === userName,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  return { Tags: tags, IsTruncated: false };
};

const PutUserPolicy: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const policyName = requireString(input, "PolicyName");
  const policyDocument = requireString(input, "PolicyDocument");
  requireUser(ctx, userName);
  const userPolicy: StoredUserPolicy = {
    UserName: userName,
    PolicyName: policyName,
    PolicyDocument: policyDocument,
  };
  ctx.store.set(userPolicyKey(userName, policyName), userPolicy);
  return {};
};

const GetUserPolicy: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const policyName = requireString(input, "PolicyName");
  const userPolicy = ctx.store.get<StoredUserPolicy>(
    userPolicyKey(userName, policyName),
  );
  if (userPolicy === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The user policy with name ${policyName} cannot be found.`,
      404,
    );
  }
  return {
    UserName: userPolicy.UserName,
    PolicyName: userPolicy.PolicyName,
    PolicyDocument: userPolicy.PolicyDocument,
  };
};

const DeleteUserPolicy: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const policyName = requireString(input, "PolicyName");
  const key = userPolicyKey(userName, policyName);
  if (ctx.store.get<StoredUserPolicy>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The user policy with name ${policyName} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListUserPolicies: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const names = ctx.store
    .list<StoredUserPolicy>()
    .filter(
      (entry) =>
        entry.key.startsWith("userpolicy/") &&
        entry.value.UserName === userName,
    )
    .map((entry) => entry.value.PolicyName);
  return { PolicyNames: names, IsTruncated: false };
};

const AttachUserPolicy: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const policyArn = requireString(input, "PolicyArn");
  requireUser(ctx, userName);
  const policy = requirePolicy(ctx, policyArn);
  const attachment: StoredUserAttachment = {
    UserName: userName,
    PolicyArn: policyArn,
    PolicyName: policy.PolicyName,
  };
  ctx.store.set(userAttachmentKey(userName, policyArn), attachment);
  return {};
};

const DetachUserPolicy: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const policyArn = requireString(input, "PolicyArn");
  requireUser(ctx, userName);
  const key = userAttachmentKey(userName, policyArn);
  if (ctx.store.get<StoredUserAttachment>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Policy ${policyArn} was not attached to user ${userName}.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListAttachedUserPolicies: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const attached = ctx.store
    .list<StoredUserAttachment>()
    .filter(
      (entry) =>
        entry.key.startsWith("userattachment/") &&
        entry.value.UserName === userName,
    )
    .map((entry) => ({
      PolicyName: entry.value.PolicyName,
      PolicyArn: entry.value.PolicyArn,
    }));
  return { AttachedPolicies: attached, IsTruncated: false };
};

const PutUserPermissionsBoundary: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const permissionsBoundary = requireString(input, "PermissionsBoundary");
  const user = requireUser(ctx, userName);
  ctx.store.set(userKey(userName), {
    ...user,
    PermissionsBoundary: {
      PermissionsBoundaryType: "Policy",
      PermissionsBoundaryArn: permissionsBoundary,
    },
  });
  return {};
};

const DeleteUserPermissionsBoundary: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const user = requireUser(ctx, userName);
  const { PermissionsBoundary: _pb, ...rest } = user;
  ctx.store.set(userKey(userName), rest);
  return {};
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
  const v1: StoredPolicyVersion = {
    PolicyArn: arn,
    VersionId: "v1",
    Document: document,
    IsDefaultVersion: true,
    CreateDate: now,
  };
  ctx.store.set(policyVersionKey(arn, "v1"), v1);
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

const DeleteAccessKey: OperationHandler = (input, ctx) => {
  const accessKeyId = requireString(input, "AccessKeyId");
  const key = accessKeyKey(accessKeyId);
  if (ctx.store.get<StoredAccessKey>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Access Key ${accessKeyId} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const UpdateAccessKey: OperationHandler = (input, ctx) => {
  const accessKeyId = requireString(input, "AccessKeyId");
  const status = requireString(input, "Status");
  const key = accessKeyKey(accessKeyId);
  const accessKey = ctx.store.get<StoredAccessKey>(key);
  if (accessKey === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Access Key ${accessKeyId} cannot be found.`,
      404,
    );
  }
  ctx.store.set(key, { ...accessKey, Status: status });
  return {};
};

const GetAccessKeyLastUsed: OperationHandler = (input, ctx) => {
  const accessKeyId = requireString(input, "AccessKeyId");
  const accessKey = ctx.store.get<StoredAccessKey>(accessKeyKey(accessKeyId));
  const userName = accessKey?.UserName ?? "";
  return {
    UserName: userName,
    AccessKeyLastUsed: {
      LastUsedDate: undefined,
      ServiceName: "N/A",
      Region: "N/A",
    },
  };
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

const UpdateGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "GroupName");
  const group = requireGroup(ctx, name);
  const newPath = optionalString(input, "NewPath");
  const newName = optionalString(input, "NewGroupName");
  if (newName !== undefined && newName !== name) {
    if (ctx.store.get<StoredGroup>(groupKey(newName)) !== undefined) {
      throw awsError(
        "EntityAlreadyExists",
        `Group with name ${newName} already exists.`,
        409,
      );
    }
    const updatedGroup: StoredGroup = {
      ...group,
      GroupName: newName,
      Path: newPath ?? group.Path,
      Arn: groupArnOf(ctx.account, newPath ?? group.Path, newName),
    };
    ctx.store.set(groupKey(newName), updatedGroup);
    ctx.store.delete(groupKey(name));
    for (const entry of ctx.store.list<StoredGroupMember>()) {
      if (
        entry.key.startsWith("groupmember/") &&
        entry.value.GroupName === name
      ) {
        ctx.store.delete(entry.key);
        ctx.store.set(groupMemberKey(newName, entry.value.UserName), {
          GroupName: newName,
          UserName: entry.value.UserName,
        });
      }
    }
  } else if (newPath !== undefined) {
    ctx.store.set(groupKey(name), {
      ...group,
      Path: newPath,
      Arn: groupArnOf(ctx.account, newPath, name),
    });
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

const ListGroupsForUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const groups = ctx.store
    .list<StoredGroupMember>()
    .filter(
      (entry) =>
        entry.key.startsWith("groupmember/") &&
        entry.value.UserName === userName,
    )
    .map((entry) => ctx.store.get<StoredGroup>(groupKey(entry.value.GroupName)))
    .filter((group): group is StoredGroup => group !== undefined);
  return { Groups: groups, IsTruncated: false };
};

const AttachGroupPolicy: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const policyArn = requireString(input, "PolicyArn");
  requireGroup(ctx, groupName);
  const policy = requirePolicy(ctx, policyArn);
  const attachment: StoredGroupAttachment = {
    GroupName: groupName,
    PolicyArn: policyArn,
    PolicyName: policy.PolicyName,
  };
  ctx.store.set(groupAttachmentKey(groupName, policyArn), attachment);
  return {};
};

const DetachGroupPolicy: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const policyArn = requireString(input, "PolicyArn");
  requireGroup(ctx, groupName);
  const key = groupAttachmentKey(groupName, policyArn);
  if (ctx.store.get<StoredGroupAttachment>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Policy ${policyArn} was not attached to group ${groupName}.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListAttachedGroupPolicies: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  requireGroup(ctx, groupName);
  const attached = ctx.store
    .list<StoredGroupAttachment>()
    .filter(
      (entry) =>
        entry.key.startsWith("groupattachment/") &&
        entry.value.GroupName === groupName,
    )
    .map((entry) => ({
      PolicyName: entry.value.PolicyName,
      PolicyArn: entry.value.PolicyArn,
    }));
  return { AttachedPolicies: attached, IsTruncated: false };
};

const PutGroupPolicy: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const policyName = requireString(input, "PolicyName");
  const policyDocument = requireString(input, "PolicyDocument");
  requireGroup(ctx, groupName);
  const groupPolicy: StoredGroupPolicy = {
    GroupName: groupName,
    PolicyName: policyName,
    PolicyDocument: policyDocument,
  };
  ctx.store.set(groupPolicyKey(groupName, policyName), groupPolicy);
  return {};
};

const GetGroupPolicy: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const policyName = requireString(input, "PolicyName");
  const groupPolicy = ctx.store.get<StoredGroupPolicy>(
    groupPolicyKey(groupName, policyName),
  );
  if (groupPolicy === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The group policy with name ${policyName} cannot be found.`,
      404,
    );
  }
  return {
    GroupName: groupPolicy.GroupName,
    PolicyName: groupPolicy.PolicyName,
    PolicyDocument: groupPolicy.PolicyDocument,
  };
};

const DeleteGroupPolicy: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const policyName = requireString(input, "PolicyName");
  const key = groupPolicyKey(groupName, policyName);
  if (ctx.store.get<StoredGroupPolicy>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The group policy with name ${policyName} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListGroupPolicies: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  requireGroup(ctx, groupName);
  const names = ctx.store
    .list<StoredGroupPolicy>()
    .filter(
      (entry) =>
        entry.key.startsWith("grouppolicy/") &&
        entry.value.GroupName === groupName,
    )
    .map((entry) => entry.value.PolicyName);
  return { PolicyNames: names, IsTruncated: false };
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

const CreateLoginProfile: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  if (
    ctx.store.get<StoredLoginProfile>(loginProfileKey(userName)) !== undefined
  ) {
    throw awsError(
      "EntityAlreadyExists",
      `Login Profile for user ${userName} already exists.`,
      409,
    );
  }
  const profile: StoredLoginProfile = {
    UserName: userName,
    CreateDate: new Date().toISOString(),
    PasswordResetRequired:
      optionalBool(input, "PasswordResetRequired") ?? false,
  };
  ctx.store.set(loginProfileKey(userName), profile);
  return {
    LoginProfile: {
      UserName: profile.UserName,
      CreateDate: profile.CreateDate,
      PasswordResetRequired: profile.PasswordResetRequired,
    },
  };
};

const GetLoginProfile: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const profile = ctx.store.get<StoredLoginProfile>(loginProfileKey(userName));
  if (profile === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Login Profile for user ${userName} cannot be found.`,
      404,
    );
  }
  return {
    LoginProfile: {
      UserName: profile.UserName,
      CreateDate: profile.CreateDate,
      PasswordResetRequired: profile.PasswordResetRequired,
    },
  };
};

const UpdateLoginProfile: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const profile = ctx.store.get<StoredLoginProfile>(loginProfileKey(userName));
  if (profile === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Login Profile for user ${userName} cannot be found.`,
      404,
    );
  }
  const passwordResetRequired = optionalBool(input, "PasswordResetRequired");
  ctx.store.set(loginProfileKey(userName), {
    ...profile,
    PasswordResetRequired:
      passwordResetRequired ?? profile.PasswordResetRequired,
  });
  return {};
};

const DeleteLoginProfile: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const key = loginProfileKey(userName);
  if (ctx.store.get<StoredLoginProfile>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Login Profile for user ${userName} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateAccountAlias: OperationHandler = (input, ctx) => {
  const alias = requireString(input, "AccountAlias");
  ctx.store.set("accountalias/0", { AccountAlias: alias });
  return {};
};

const DeleteAccountAlias: OperationHandler = (input, ctx) => {
  const alias = requireString(input, "AccountAlias");
  const stored = ctx.store.get<{ AccountAlias: string }>("accountalias/0");
  if (stored === undefined || stored.AccountAlias !== alias) {
    throw awsError(
      "NoSuchEntity",
      `The account alias ${alias} does not exist.`,
      404,
    );
  }
  ctx.store.delete("accountalias/0");
  return {};
};

const ListAccountAliases: OperationHandler = (input, ctx) => {
  const stored = ctx.store.get<{ AccountAlias: string }>("accountalias/0");
  const aliases = stored !== undefined ? [stored.AccountAlias] : [];
  return { AccountAliases: aliases, IsTruncated: false };
};

const UpdateAccountPasswordPolicy: OperationHandler = (input, ctx) => {
  const existing =
    ctx.store.get<StoredPasswordPolicy>("passwordpolicy/0") ?? {};
  const updated: StoredPasswordPolicy = {
    ...existing,
  };
  const minLen = optionalNumber(input, "MinimumPasswordLength");
  if (minLen !== undefined) updated.MinimumPasswordLength = minLen;
  const reqSymbols = optionalBool(input, "RequireSymbols");
  if (reqSymbols !== undefined) updated.RequireSymbols = reqSymbols;
  const reqNumbers = optionalBool(input, "RequireNumbers");
  if (reqNumbers !== undefined) updated.RequireNumbers = reqNumbers;
  const reqUpper = optionalBool(input, "RequireUppercaseCharacters");
  if (reqUpper !== undefined) updated.RequireUppercaseCharacters = reqUpper;
  const reqLower = optionalBool(input, "RequireLowercaseCharacters");
  if (reqLower !== undefined) updated.RequireLowercaseCharacters = reqLower;
  const allowChange = optionalBool(input, "AllowUsersToChangePassword");
  if (allowChange !== undefined)
    updated.AllowUsersToChangePassword = allowChange;
  const maxAge = optionalNumber(input, "MaxPasswordAge");
  if (maxAge !== undefined) updated.MaxPasswordAge = maxAge;
  const reuse = optionalNumber(input, "PasswordReusePrevention");
  if (reuse !== undefined) updated.PasswordReusePrevention = reuse;
  const hardExpiry = optionalBool(input, "HardExpiry");
  if (hardExpiry !== undefined) updated.HardExpiry = hardExpiry;
  ctx.store.set("passwordpolicy/0", updated);
  return {};
};

const GetAccountPasswordPolicy: OperationHandler = (input, ctx) => {
  const policy = ctx.store.get<StoredPasswordPolicy>("passwordpolicy/0");
  if (policy === undefined) {
    throw awsError(
      "NoSuchEntity",
      "The Password Policy with domain name does not exist.",
      404,
    );
  }
  return {
    PasswordPolicy: {
      MinimumPasswordLength: policy.MinimumPasswordLength,
      RequireSymbols: policy.RequireSymbols,
      RequireNumbers: policy.RequireNumbers,
      RequireUppercaseCharacters: policy.RequireUppercaseCharacters,
      RequireLowercaseCharacters: policy.RequireLowercaseCharacters,
      AllowUsersToChangePassword: policy.AllowUsersToChangePassword,
      ExpirePasswords:
        policy.MaxPasswordAge !== undefined && policy.MaxPasswordAge > 0,
      MaxPasswordAge: policy.MaxPasswordAge,
      PasswordReusePrevention: policy.PasswordReusePrevention,
      HardExpiry: policy.HardExpiry,
    },
  };
};

const DeleteAccountPasswordPolicy: OperationHandler = (input, ctx) => {
  if (ctx.store.get<StoredPasswordPolicy>("passwordpolicy/0") === undefined) {
    throw awsError(
      "NoSuchEntity",
      "The Password Policy with domain name does not exist.",
      404,
    );
  }
  ctx.store.delete("passwordpolicy/0");
  return {};
};

const GetAccountSummary: OperationHandler = (input, ctx) => {
  const users = ctx.store
    .list<StoredUser>()
    .filter((e) => e.key.startsWith("user/")).length;
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((e) => e.key.startsWith("group/")).length;
  const roles = ctx.store
    .list<StoredRole>()
    .filter((e) => e.key.startsWith("role/")).length;
  const policies = ctx.store
    .list<StoredPolicy>()
    .filter((e) => e.key.startsWith("policy/")).length;
  const mfaDevices = ctx.store
    .list<StoredEnabledMFADevice>()
    .filter((e) => e.key.startsWith("mfaenabled/")).length;
  const serverCerts = ctx.store
    .list<StoredServerCertificate>()
    .filter((e) => e.key.startsWith("servercert/")).length;
  const instanceProfiles = ctx.store
    .list<StoredInstanceProfile>()
    .filter((e) => e.key.startsWith("instanceprofile/")).length;
  return {
    SummaryMap: {
      Users: users,
      UsersQuota: 5000,
      Groups: groups,
      GroupsQuota: 300,
      Roles: roles,
      RolesQuota: 1000,
      Policies: policies,
      PoliciesQuota: 1500,
      MFADevices: mfaDevices,
      MFADevicesInUse: mfaDevices,
      AccountMFAEnabled: 0,
      AccountAccessKeysPresent: 0,
      AccountPasswordPresent:
        ctx.store.get("passwordpolicy/0") !== undefined ? 1 : 0,
      AccountSigningCertificatesPresent: 0,
      ServerCertificates: serverCerts,
      ServerCertificatesQuota: 20,
      InstanceProfiles: instanceProfiles,
      InstanceProfilesQuota: 1000,
      GroupsPerUserQuota: 10,
      SigningCertificatesPerUserQuota: 2,
      AccessKeysPerUserQuota: 2,
      AttachedPoliciesPerGroupQuota: 10,
      AttachedPoliciesPerRoleQuota: 10,
      AttachedPoliciesPerUserQuota: 10,
      UserPolicySizeQuota: 2048,
      GroupPolicySizeQuota: 5120,
      RolePolicySizeQuota: 10240,
      PolicySizeQuota: 6144,
      PolicyVersionsInUse: 0,
      PolicyVersionsInUseQuota: 10000,
      VersionsPerPolicyQuota: 5,
      GlobalEndpointTokenVersion: 1,
      AssumeRolePolicySizeQuota: 2048,
      Providers: 0,
    },
  };
};

const ChangePassword: OperationHandler = (input, ctx) => {
  requireString(input, "OldPassword");
  requireString(input, "NewPassword");
  return {};
};

const requireServerCert = (
  ctx: ServiceContext,
  name: string,
): StoredServerCertificate => {
  const cert = ctx.store.get<StoredServerCertificate>(serverCertKey(name));
  if (cert === undefined) {
    throw awsError(
      "NoSuchEntity",
      `The Server Certificate with name ${name} cannot be found.`,
      404,
    );
  }
  return cert;
};

const UploadServerCertificate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  if (
    ctx.store.get<StoredServerCertificate>(serverCertKey(name)) !== undefined
  ) {
    throw awsError(
      "EntityAlreadyExists",
      `Server certificate ${name} already exists.`,
      409,
    );
  }
  const path = normalizePath(input);
  const now = new Date().toISOString();
  const cert: StoredServerCertificate = {
    Path: path,
    ServerCertificateName: name,
    ServerCertificateId: `ASCA${randomHex(16)}`,
    Arn: serverCertArnOf(ctx.account, path, name),
    UploadDate: now,
    CertificateBody: requireString(input, "CertificateBody"),
    PrivateKey: requireString(input, "PrivateKey"),
    CertificateChain: optionalString(input, "CertificateChain"),
    Tags: toTagList(input),
  };
  ctx.store.set(serverCertKey(name), cert);
  return {
    ServerCertificateMetadata: {
      Path: cert.Path,
      ServerCertificateName: cert.ServerCertificateName,
      ServerCertificateId: cert.ServerCertificateId,
      Arn: cert.Arn,
      UploadDate: cert.UploadDate,
      Expiration: cert.Expiration,
    },
    Tags: cert.Tags,
  };
};

const GetServerCertificate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  const cert = requireServerCert(ctx, name);
  return {
    ServerCertificate: {
      ServerCertificateMetadata: {
        Path: cert.Path,
        ServerCertificateName: cert.ServerCertificateName,
        ServerCertificateId: cert.ServerCertificateId,
        Arn: cert.Arn,
        UploadDate: cert.UploadDate,
        Expiration: cert.Expiration,
      },
      CertificateBody: cert.CertificateBody,
      CertificateChain: cert.CertificateChain,
      Tags: cert.Tags,
    },
  };
};

const UpdateServerCertificate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  const cert = requireServerCert(ctx, name);
  const newPath = optionalString(input, "NewPath");
  const newName = optionalString(input, "NewServerCertificateName");
  if (newName !== undefined && newName !== name) {
    if (
      ctx.store.get<StoredServerCertificate>(serverCertKey(newName)) !==
      undefined
    ) {
      throw awsError(
        "EntityAlreadyExists",
        `Server certificate ${newName} already exists.`,
        409,
      );
    }
    const updatedCert: StoredServerCertificate = {
      ...cert,
      ServerCertificateName: newName,
      Path: newPath ?? cert.Path,
      Arn: serverCertArnOf(ctx.account, newPath ?? cert.Path, newName),
    };
    ctx.store.set(serverCertKey(newName), updatedCert);
    ctx.store.delete(serverCertKey(name));
  } else if (newPath !== undefined) {
    ctx.store.set(serverCertKey(name), {
      ...cert,
      Path: newPath,
      Arn: serverCertArnOf(ctx.account, newPath, name),
    });
  }
  return {};
};

const DeleteServerCertificate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  requireServerCert(ctx, name);
  ctx.store.delete(serverCertKey(name));
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith("servercerttag/") &&
      entry.key.startsWith(`servercerttag/${name}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const ListServerCertificates: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "PathPrefix") ?? "/";
  const certs = ctx.store
    .list<StoredServerCertificate>()
    .filter((entry) => entry.key.startsWith("servercert/"))
    .map((entry) => entry.value)
    .filter((cert) => cert.Path.startsWith(prefix))
    .map((cert) => ({
      Path: cert.Path,
      ServerCertificateName: cert.ServerCertificateName,
      ServerCertificateId: cert.ServerCertificateId,
      Arn: cert.Arn,
      UploadDate: cert.UploadDate,
      Expiration: cert.Expiration,
    }));
  return { ServerCertificateMetadataList: certs, IsTruncated: false };
};

const TagServerCertificate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  requireServerCert(ctx, name);
  for (const tag of toTagList(input)) {
    ctx.store.set(serverCertTagKey(name, tag.Key), {
      ServerCertificateName: name,
      ...tag,
    });
  }
  return {};
};

const UntagServerCertificate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  requireServerCert(ctx, name);
  const tagKeys = input["TagKeys"];
  if (Array.isArray(tagKeys)) {
    for (const key of tagKeys) {
      if (typeof key === "string") {
        ctx.store.delete(serverCertTagKey(name, key));
      }
    }
  }
  return {};
};

const ListServerCertificateTags: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ServerCertificateName");
  requireServerCert(ctx, name);
  const tags = ctx.store
    .list<StoredTag & { ServerCertificateName: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("servercerttag/") &&
        entry.value.ServerCertificateName === name,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  return { Tags: tags, IsTruncated: false };
};

const UploadSSHPublicKey: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const body = requireString(input, "SSHPublicKeyBody");
  const now = new Date().toISOString();
  const keyId = `APKA${randomHex(16)}`;
  const sshKey: StoredSSHPublicKey = {
    UserName: userName,
    SSHPublicKeyId: keyId,
    Fingerprint: randomHex(47),
    SSHPublicKeyBody: body,
    Status: "Active",
    UploadDate: now,
  };
  ctx.store.set(sshPublicKeyKey(keyId), sshKey);
  return {
    SSHPublicKey: {
      UserName: sshKey.UserName,
      SSHPublicKeyId: sshKey.SSHPublicKeyId,
      Fingerprint: sshKey.Fingerprint,
      SSHPublicKeyBody: sshKey.SSHPublicKeyBody,
      Status: sshKey.Status,
      UploadDate: sshKey.UploadDate,
    },
  };
};

const GetSSHPublicKey: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const keyId = requireString(input, "SSHPublicKeyId");
  const sshKey = ctx.store.get<StoredSSHPublicKey>(sshPublicKeyKey(keyId));
  if (sshKey === undefined || sshKey.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `The SSH public key with ID ${keyId} cannot be found.`,
      404,
    );
  }
  return {
    SSHPublicKey: {
      UserName: sshKey.UserName,
      SSHPublicKeyId: sshKey.SSHPublicKeyId,
      Fingerprint: sshKey.Fingerprint,
      SSHPublicKeyBody: sshKey.SSHPublicKeyBody,
      Status: sshKey.Status,
      UploadDate: sshKey.UploadDate,
    },
  };
};

const UpdateSSHPublicKey: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const keyId = requireString(input, "SSHPublicKeyId");
  const status = requireString(input, "Status");
  const sshKey = ctx.store.get<StoredSSHPublicKey>(sshPublicKeyKey(keyId));
  if (sshKey === undefined || sshKey.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `The SSH public key with ID ${keyId} cannot be found.`,
      404,
    );
  }
  ctx.store.set(sshPublicKeyKey(keyId), { ...sshKey, Status: status });
  return {};
};

const DeleteSSHPublicKey: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const keyId = requireString(input, "SSHPublicKeyId");
  const sshKey = ctx.store.get<StoredSSHPublicKey>(sshPublicKeyKey(keyId));
  if (sshKey === undefined || sshKey.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `The SSH public key with ID ${keyId} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(sshPublicKeyKey(keyId));
  return {};
};

const ListSSHPublicKeys: OperationHandler = (input, ctx) => {
  const userName = optionalString(input, "UserName");
  const keys = ctx.store
    .list<StoredSSHPublicKey>()
    .filter((entry) => entry.key.startsWith("sshpublickey/"))
    .map((entry) => entry.value)
    .filter((key) => userName === undefined || key.UserName === userName)
    .map((key) => ({
      UserName: key.UserName,
      SSHPublicKeyId: key.SSHPublicKeyId,
      Status: key.Status,
      UploadDate: key.UploadDate,
    }));
  return { SSHPublicKeys: keys, IsTruncated: false };
};

const UploadSigningCertificate: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  requireUser(ctx, userName);
  const body = requireString(input, "CertificateBody");
  const now = new Date().toISOString();
  const certId = randomHex(40).toLowerCase();
  const cert: StoredSigningCertificate = {
    UserName: userName,
    CertificateId: certId,
    CertificateBody: body,
    Status: "Active",
    UploadDate: now,
  };
  ctx.store.set(signingCertKey(certId), cert);
  return {
    Certificate: {
      UserName: cert.UserName,
      CertificateId: cert.CertificateId,
      CertificateBody: cert.CertificateBody,
      Status: cert.Status,
      UploadDate: cert.UploadDate,
    },
  };
};

const UpdateSigningCertificate: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const certId = requireString(input, "CertificateId");
  const status = requireString(input, "Status");
  const cert = ctx.store.get<StoredSigningCertificate>(signingCertKey(certId));
  if (cert === undefined || cert.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `The Signing Certificate with ID ${certId} cannot be found.`,
      404,
    );
  }
  ctx.store.set(signingCertKey(certId), { ...cert, Status: status });
  return {};
};

const DeleteSigningCertificate: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const certId = requireString(input, "CertificateId");
  const cert = ctx.store.get<StoredSigningCertificate>(signingCertKey(certId));
  if (cert === undefined || cert.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `The Signing Certificate with ID ${certId} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(signingCertKey(certId));
  return {};
};

const ListSigningCertificates: OperationHandler = (input, ctx) => {
  const userName = optionalString(input, "UserName");
  const certs = ctx.store
    .list<StoredSigningCertificate>()
    .filter((entry) => entry.key.startsWith("signingcert/"))
    .map((entry) => entry.value)
    .filter((cert) => userName === undefined || cert.UserName === userName)
    .map((cert) => ({
      UserName: cert.UserName,
      CertificateId: cert.CertificateId,
      CertificateBody: cert.CertificateBody,
      Status: cert.Status,
      UploadDate: cert.UploadDate,
    }));
  return { Certificates: certs, IsTruncated: false };
};

const CreateVirtualMFADevice: OperationHandler = (input, ctx) => {
  const name = requireString(input, "VirtualMFADeviceName");
  const path = normalizePath(input);
  const serialNumber = virtualMfaArnOf(ctx.account, path, name);
  if (
    ctx.store.get<StoredVirtualMFADevice>(virtualMfaKey(serialNumber)) !==
    undefined
  ) {
    throw awsError(
      "EntityAlreadyExists",
      `VirtualMFADevice with name ${name} already exists.`,
      409,
    );
  }
  const device: StoredVirtualMFADevice = {
    SerialNumber: serialNumber,
    VirtualMFADeviceName: name,
    Path: path,
    Tags: toTagList(input),
  };
  ctx.store.set(virtualMfaKey(serialNumber), device);
  return {
    VirtualMFADevice: {
      SerialNumber: device.SerialNumber,
      Base32StringSeed: Buffer.from(randomHex(20)).toString("base64"),
      QRCodePNG: Buffer.from(randomHex(20)).toString("base64"),
      Tags: device.Tags,
    },
  };
};

const EnableMFADevice: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const serialNumber = requireString(input, "SerialNumber");
  requireUser(ctx, userName);
  const enabledDevice: StoredEnabledMFADevice = {
    UserName: userName,
    SerialNumber: serialNumber,
    EnableDate: new Date().toISOString(),
  };
  ctx.store.set(enabledMfaKey(serialNumber), enabledDevice);
  const vDevice = ctx.store.get<StoredVirtualMFADevice>(
    virtualMfaKey(serialNumber),
  );
  if (vDevice !== undefined) {
    ctx.store.set(virtualMfaKey(serialNumber), vDevice);
  }
  return {};
};

const DeactivateMFADevice: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const serialNumber = requireString(input, "SerialNumber");
  requireUser(ctx, userName);
  ctx.store.delete(enabledMfaKey(serialNumber));
  return {};
};

const ResyncMFADevice: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const serialNumber = requireString(input, "SerialNumber");
  requireUser(ctx, userName);
  const device = ctx.store.get<StoredEnabledMFADevice>(
    enabledMfaKey(serialNumber),
  );
  if (device === undefined || device.UserName !== userName) {
    throw awsError(
      "InvalidAuthenticationCode",
      `Device ${serialNumber} not found for user ${userName}.`,
      400,
    );
  }
  return {};
};

const DeleteVirtualMFADevice: OperationHandler = (input, ctx) => {
  const serialNumber = requireString(input, "SerialNumber");
  if (
    ctx.store.get<StoredVirtualMFADevice>(virtualMfaKey(serialNumber)) ===
    undefined
  ) {
    throw awsError(
      "NoSuchEntity",
      `VirtualMFADevice with serial ${serialNumber} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(virtualMfaKey(serialNumber));
  ctx.store.delete(enabledMfaKey(serialNumber));
  return {};
};

const GetMFADevice: OperationHandler = (input, ctx) => {
  const serialNumber = requireString(input, "SerialNumber");
  const device = ctx.store.get<StoredEnabledMFADevice>(
    enabledMfaKey(serialNumber),
  );
  if (device === undefined) {
    throw awsError(
      "NoSuchEntity",
      `MFA Device ${serialNumber} cannot be found.`,
      404,
    );
  }
  return {
    UserName: device.UserName,
    SerialNumber: device.SerialNumber,
    EnableDate: device.EnableDate,
  };
};

const ListMFADevices: OperationHandler = (input, ctx) => {
  const userName = optionalString(input, "UserName");
  const devices = ctx.store
    .list<StoredEnabledMFADevice>()
    .filter((entry) => entry.key.startsWith("mfaenabled/"))
    .map((entry) => entry.value)
    .filter((device) => userName === undefined || device.UserName === userName)
    .map((device) => ({
      UserName: device.UserName,
      SerialNumber: device.SerialNumber,
      EnableDate: device.EnableDate,
    }));
  return { MFADevices: devices, IsTruncated: false };
};

const ListVirtualMFADevices: OperationHandler = (input, ctx) => {
  const assignmentStatus = optionalString(input, "AssignmentStatus") ?? "Any";
  const enabledSerials = new Set(
    ctx.store
      .list<StoredEnabledMFADevice>()
      .filter((e) => e.key.startsWith("mfaenabled/"))
      .map((e) => e.value.SerialNumber),
  );
  const devices = ctx.store
    .list<StoredVirtualMFADevice>()
    .filter((entry) => entry.key.startsWith("virtualmfa/"))
    .map((entry) => entry.value)
    .filter((device) => {
      const isAssigned = enabledSerials.has(device.SerialNumber);
      if (assignmentStatus === "Assigned") return isAssigned;
      if (assignmentStatus === "Unassigned") return !isAssigned;
      return true;
    })
    .map((device) => {
      const enabled = ctx.store.get<StoredEnabledMFADevice>(
        enabledMfaKey(device.SerialNumber),
      );
      const user =
        enabled !== undefined
          ? ctx.store.get<StoredUser>(userKey(enabled.UserName))
          : undefined;
      return {
        SerialNumber: device.SerialNumber,
        EnableDate: enabled?.EnableDate,
        User: user,
        Tags: device.Tags,
      };
    });
  return { VirtualMFADevices: devices, IsTruncated: false };
};

const TagMFADevice: OperationHandler = (input, ctx) => {
  const serialNumber = requireString(input, "SerialNumber");
  if (
    ctx.store.get<StoredVirtualMFADevice>(virtualMfaKey(serialNumber)) ===
    undefined
  ) {
    throw awsError(
      "NoSuchEntity",
      `MFA device ${serialNumber} cannot be found.`,
      404,
    );
  }
  for (const tag of toTagList(input)) {
    ctx.store.set(mfaTagKey(serialNumber, tag.Key), {
      SerialNumber: serialNumber,
      ...tag,
    });
  }
  return {};
};

const UntagMFADevice: OperationHandler = (input, ctx) => {
  const serialNumber = requireString(input, "SerialNumber");
  if (
    ctx.store.get<StoredVirtualMFADevice>(virtualMfaKey(serialNumber)) ===
    undefined
  ) {
    throw awsError(
      "NoSuchEntity",
      `MFA device ${serialNumber} cannot be found.`,
      404,
    );
  }
  const tagKeys = input["TagKeys"];
  if (Array.isArray(tagKeys)) {
    for (const key of tagKeys) {
      if (typeof key === "string") {
        ctx.store.delete(mfaTagKey(serialNumber, key));
      }
    }
  }
  return {};
};

const ListMFADeviceTags: OperationHandler = (input, ctx) => {
  const serialNumber = requireString(input, "SerialNumber");
  if (
    ctx.store.get<StoredVirtualMFADevice>(virtualMfaKey(serialNumber)) ===
    undefined
  ) {
    throw awsError(
      "NoSuchEntity",
      `MFA device ${serialNumber} cannot be found.`,
      404,
    );
  }
  const tags = ctx.store
    .list<StoredTag & { SerialNumber: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("mfatag/") &&
        entry.value.SerialNumber === serialNumber,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  return { Tags: tags, IsTruncated: false };
};

const CreateServiceSpecificCredential: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const serviceName = requireString(input, "ServiceName");
  requireUser(ctx, userName);
  const now = new Date().toISOString();
  const credId = `AKDA${randomHex(16)}`;
  const cred: StoredServiceSpecificCredential = {
    UserName: userName,
    ServiceName: serviceName,
    ServiceSpecificCredentialId: credId,
    ServiceUserName: `${userName}-at-${ctx.account}`,
    ServicePassword: randomHex(40),
    Status: "Active",
    CreateDate: now,
  };
  ctx.store.set(serviceSpecCredKey(credId), cred);
  return {
    ServiceSpecificCredential: {
      CreateDate: cred.CreateDate,
      ServiceName: cred.ServiceName,
      ServiceUserName: cred.ServiceUserName,
      ServicePassword: cred.ServicePassword,
      ServiceSpecificCredentialId: cred.ServiceSpecificCredentialId,
      UserName: cred.UserName,
      Status: cred.Status,
    },
  };
};

const DeleteServiceSpecificCredential: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const credId = requireString(input, "ServiceSpecificCredentialId");
  const cred = ctx.store.get<StoredServiceSpecificCredential>(
    serviceSpecCredKey(credId),
  );
  if (cred === undefined || cred.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `Service specific credential ${credId} cannot be found.`,
      404,
    );
  }
  ctx.store.delete(serviceSpecCredKey(credId));
  return {};
};

const ListServiceSpecificCredentials: OperationHandler = (input, ctx) => {
  const userName = optionalString(input, "UserName");
  const serviceName = optionalString(input, "ServiceName");
  const creds = ctx.store
    .list<StoredServiceSpecificCredential>()
    .filter((entry) => entry.key.startsWith("servicespeccred/"))
    .map((entry) => entry.value)
    .filter((cred) => userName === undefined || cred.UserName === userName)
    .filter(
      (cred) => serviceName === undefined || cred.ServiceName === serviceName,
    )
    .map((cred) => ({
      UserName: cred.UserName,
      Status: cred.Status,
      ServiceUserName: cred.ServiceUserName,
      CreateDate: cred.CreateDate,
      ServiceSpecificCredentialId: cred.ServiceSpecificCredentialId,
      ServiceName: cred.ServiceName,
    }));
  return { ServiceSpecificCredentials: creds };
};

const ResetServiceSpecificCredential: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const credId = requireString(input, "ServiceSpecificCredentialId");
  const cred = ctx.store.get<StoredServiceSpecificCredential>(
    serviceSpecCredKey(credId),
  );
  if (cred === undefined || cred.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `Service specific credential ${credId} cannot be found.`,
      404,
    );
  }
  const updated: StoredServiceSpecificCredential = {
    ...cred,
    ServicePassword: randomHex(40),
  };
  ctx.store.set(serviceSpecCredKey(credId), updated);
  return {
    ServiceSpecificCredential: {
      CreateDate: updated.CreateDate,
      ServiceName: updated.ServiceName,
      ServiceUserName: updated.ServiceUserName,
      ServicePassword: updated.ServicePassword,
      ServiceSpecificCredentialId: updated.ServiceSpecificCredentialId,
      UserName: updated.UserName,
      Status: updated.Status,
    },
  };
};

const UpdateServiceSpecificCredential: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const credId = requireString(input, "ServiceSpecificCredentialId");
  const status = requireString(input, "Status");
  const cred = ctx.store.get<StoredServiceSpecificCredential>(
    serviceSpecCredKey(credId),
  );
  if (cred === undefined || cred.UserName !== userName) {
    throw awsError(
      "NoSuchEntity",
      `Service specific credential ${credId} cannot be found.`,
      404,
    );
  }
  ctx.store.set(serviceSpecCredKey(credId), { ...cred, Status: status });
  return {};
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "PolicyArn");
  requirePolicy(ctx, arn);
  ctx.store.delete(policyKey(arn));
  for (const entry of ctx.store.list()) {
    if (
      (entry.key.startsWith("policyversion/") &&
        (entry.value as StoredPolicyVersion).PolicyArn === arn) ||
      (entry.key.startsWith("policytag/") &&
        entry.key.startsWith(`policytag/${arn}/`))
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const DeletePolicyVersion: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  const versionId = requireString(input, "VersionId");
  const policy = requirePolicy(ctx, policyArn);
  if (policy.DefaultVersionId === versionId) {
    throw awsError(
      "DeleteConflict",
      `Cannot delete the default version of a policy.`,
      409,
    );
  }
  const key = policyVersionKey(policyArn, versionId);
  if (ctx.store.get<StoredPolicyVersion>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Policy version ${versionId} does not exist.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const SetDefaultPolicyVersion: OperationHandler = (input, ctx) => {
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
  const existing = policyVersionsOf(ctx, policyArn);
  for (const v of existing) {
    if (v.IsDefaultVersion) {
      ctx.store.set(policyVersionKey(policyArn, v.VersionId), {
        ...v,
        IsDefaultVersion: false,
      });
    }
  }
  if (stored !== undefined) {
    ctx.store.set(policyVersionKey(policyArn, versionId), {
      ...stored,
      IsDefaultVersion: true,
    });
  }
  ctx.store.set(policyKey(policyArn), {
    ...policy,
    DefaultVersionId: versionId,
    UpdateDate: new Date().toISOString(),
  });
  return {};
};

const TagPolicy: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  requirePolicy(ctx, policyArn);
  for (const tag of toTagList(input)) {
    ctx.store.set(policyTagKey(policyArn, tag.Key), {
      PolicyArn: policyArn,
      ...tag,
    });
  }
  return {};
};

const UntagPolicy: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  requirePolicy(ctx, policyArn);
  const tagKeys = input["TagKeys"];
  if (Array.isArray(tagKeys)) {
    for (const key of tagKeys) {
      if (typeof key === "string") {
        ctx.store.delete(policyTagKey(policyArn, key));
      }
    }
  }
  return {};
};

const ListPolicyTags: OperationHandler = (input, ctx) => {
  const policyArn = requireString(input, "PolicyArn");
  requirePolicy(ctx, policyArn);
  const tags = ctx.store
    .list<StoredTag & { PolicyArn: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("policytag/") &&
        entry.value.PolicyArn === policyArn,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  return { Tags: tags, IsTruncated: false };
};

const DeleteInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  const profile = requireInstanceProfile(ctx, name);
  if (profile.Roles.length > 0) {
    throw awsError(
      "DeleteConflict",
      `Cannot delete entity, must remove roles from instance profile first.`,
      409,
    );
  }
  ctx.store.delete(instanceProfileKey(name));
  return {};
};

const ListInstanceProfiles: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "PathPrefix") ?? "/";
  const profiles = ctx.store
    .list<StoredInstanceProfile>()
    .filter((entry) => entry.key.startsWith("instanceprofile/"))
    .map((entry) => entry.value)
    .filter((profile) => profile.Path.startsWith(prefix));
  return { InstanceProfiles: profiles, IsTruncated: false };
};

const ListInstanceProfilesForRole: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  requireRole(ctx, roleName);
  const profiles = ctx.store
    .list<StoredInstanceProfile>()
    .filter((entry) => entry.key.startsWith("instanceprofile/"))
    .map((entry) => entry.value)
    .filter((profile) => profile.Roles.some((r) => r.RoleName === roleName));
  return { InstanceProfiles: profiles, IsTruncated: false };
};

const RemoveRoleFromInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  const roleName = requireString(input, "RoleName");
  const profile = requireInstanceProfile(ctx, name);
  if (!profile.Roles.some((r) => r.RoleName === roleName)) {
    throw awsError(
      "NoSuchEntity",
      `Role ${roleName} is not associated with instance profile ${name}.`,
      404,
    );
  }
  ctx.store.set(instanceProfileKey(name), {
    ...profile,
    Roles: profile.Roles.filter((r) => r.RoleName !== roleName),
  });
  return {};
};

const TagInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  const profile = requireInstanceProfile(ctx, name);
  const newTags = toTagList(input);
  const existingTags = profile.Tags.filter(
    (t) => !newTags.some((nt) => nt.Key === t.Key),
  );
  ctx.store.set(instanceProfileKey(name), {
    ...profile,
    Tags: [...existingTags, ...newTags],
  });
  return {};
};

const UntagInstanceProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  const profile = requireInstanceProfile(ctx, name);
  const tagKeys = input["TagKeys"];
  const keysToRemove = new Set<string>(
    Array.isArray(tagKeys)
      ? tagKeys.filter((k): k is string => typeof k === "string")
      : [],
  );
  ctx.store.set(instanceProfileKey(name), {
    ...profile,
    Tags: profile.Tags.filter((t) => !keysToRemove.has(t.Key)),
  });
  return {};
};

const ListInstanceProfileTags: OperationHandler = (input, ctx) => {
  const name = requireString(input, "InstanceProfileName");
  const profile = requireInstanceProfile(ctx, name);
  return { Tags: profile.Tags, IsTruncated: false };
};

const PutRolePermissionsBoundary: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const permissionsBoundary = requireString(input, "PermissionsBoundary");
  const role = requireRole(ctx, roleName);
  ctx.store.set(roleKey(roleName), {
    ...role,
    PermissionsBoundary: {
      PermissionsBoundaryType: "PermissionsBoundaryPolicy",
      PermissionsBoundaryArn: permissionsBoundary,
    },
  });
  return {};
};

const DeleteRolePermissionsBoundary: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const role = requireRole(ctx, roleName);
  const { PermissionsBoundary: _pb, ...rest } = role;
  ctx.store.set(roleKey(roleName), rest);
  return {};
};

const DetachRolePolicy: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const policyArn = requireString(input, "PolicyArn");
  requireRole(ctx, roleName);
  const key = attachmentKey(roleName, policyArn);
  if (ctx.store.get<StoredAttachment>(key) === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Policy ${policyArn} was not attached to role ${roleName}.`,
      404,
    );
  }
  ctx.store.delete(key);
  const policy = ctx.store.get<StoredPolicy>(policyKey(policyArn));
  if (policy !== undefined) {
    ctx.store.set(policyKey(policyArn), {
      ...policy,
      AttachmentCount: Math.max(0, policy.AttachmentCount - 1),
    });
  }
  return {};
};

const UpdateAssumeRolePolicy: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  const policyDocument = requireString(input, "PolicyDocument");
  const role = requireRole(ctx, roleName);
  ctx.store.set(roleKey(roleName), {
    ...role,
    AssumeRolePolicyDocument: policyDocument,
  });
  return {};
};

const DeleteServiceLinkedRole: OperationHandler = (input, ctx) => {
  const roleName = requireString(input, "RoleName");
  requireRole(ctx, roleName);
  ctx.store.delete(roleKey(roleName));
  const taskId = `task/${randomHex(16)}`;
  const task: StoredDeletionTask = {
    TaskId: taskId,
    RoleName: roleName,
    Status: "SUCCEEDED",
  };
  ctx.store.set(deletionTaskKey(taskId), task);
  return { DeletionTaskId: taskId };
};

const GetServiceLinkedRoleDeletionStatus: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "DeletionTaskId");
  const task = ctx.store.get<StoredDeletionTask>(deletionTaskKey(taskId));
  if (task === undefined) {
    throw awsError(
      "NoSuchEntity",
      `Deletion task ${taskId} cannot be found.`,
      404,
    );
  }
  return { Status: task.Status };
};

const GenerateServiceLastAccessedDetails: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "Arn");
  const jobId = `job/${randomHex(16)}`;
  const now = new Date().toISOString();
  const job: StoredServiceLastAccessJob = {
    JobId: jobId,
    EntityType: "Role",
    EntityArn: arn,
    JobCreationDate: now,
    JobCompletionDate: now,
    JobStatus: "COMPLETED",
  };
  ctx.store.set(serviceLastAccessJobKey(jobId), job);
  return { JobId: jobId };
};

const GetServiceLastAccessedDetails: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "JobId");
  const job = ctx.store.get<StoredServiceLastAccessJob>(
    serviceLastAccessJobKey(jobId),
  );
  if (job === undefined) {
    throw awsError("NoSuchEntity", `Job ${jobId} cannot be found.`, 404);
  }
  return {
    JobStatus: job.JobStatus,
    JobCreationDate: job.JobCreationDate,
    JobCompletionDate: job.JobCompletionDate,
    ServicesLastAccessed: [],
    IsTruncated: false,
  };
};

const GetServiceLastAccessedDetailsWithEntities: OperationHandler = (
  input,
  ctx,
) => {
  const jobId = requireString(input, "JobId");
  const job = ctx.store.get<StoredServiceLastAccessJob>(
    serviceLastAccessJobKey(jobId),
  );
  if (job === undefined) {
    throw awsError("NoSuchEntity", `Job ${jobId} cannot be found.`, 404);
  }
  return {
    JobStatus: job.JobStatus,
    JobCreationDate: job.JobCreationDate,
    JobCompletionDate: job.JobCompletionDate,
    EntityDetailsList: [],
    IsTruncated: false,
  };
};

const GetContextKeysForCustomPolicy: OperationHandler = (input, _ctx) => {
  return { ContextKeyNames: [] };
};

const GetContextKeysForPrincipalPolicy: OperationHandler = (input, _ctx) => {
  return { ContextKeyNames: [] };
};

const SimulateCustomPolicy: OperationHandler = (input, _ctx) => {
  const actionNames = input["ActionNames"];
  const actions = Array.isArray(actionNames) ? (actionNames as string[]) : [];
  const results = actions.map((action) => ({
    EvalActionName: action,
    EvalDecision: "allowed",
  }));
  return { EvaluationResults: results, IsTruncated: false };
};

const SimulatePrincipalPolicy: OperationHandler = (input, _ctx) => {
  const actionNames = input["ActionNames"];
  const actions = Array.isArray(actionNames) ? (actionNames as string[]) : [];
  const results = actions.map((action) => ({
    EvalActionName: action,
    EvalDecision: "allowed",
  }));
  return { EvaluationResults: results, IsTruncated: false };
};

const requireOIDCProvider = (
  ctx: ServiceContext,
  arn: string,
): StoredOIDCProvider => {
  const provider = ctx.store.get<StoredOIDCProvider>(oidcProviderKey(arn));
  if (provider === undefined) {
    throw awsError(
      "NoSuchEntity",
      `OpenIDConnect Provider ${arn} cannot be found.`,
      404,
    );
  }
  return provider;
};

const CreateOpenIDConnectProvider: OperationHandler = (input, ctx) => {
  const url = requireString(input, "Url");
  const arn = oidcProviderArnOf(ctx.account, url);
  if (ctx.store.get<StoredOIDCProvider>(oidcProviderKey(arn)) !== undefined) {
    throw awsError(
      "EntityAlreadyExists",
      `Provider with URL ${url} already exists.`,
      409,
    );
  }
  const clientIdList = input["ClientIDList"];
  const thumbprintList = input["ThumbprintList"];
  const provider: StoredOIDCProvider = {
    Url: url,
    Arn: arn,
    ClientIDList: Array.isArray(clientIdList) ? (clientIdList as string[]) : [],
    ThumbprintList: Array.isArray(thumbprintList)
      ? (thumbprintList as string[])
      : [],
    CreateDate: new Date().toISOString(),
    Tags: toTagList(input),
  };
  ctx.store.set(oidcProviderKey(arn), provider);
  return { OpenIDConnectProviderArn: arn };
};

const DeleteOpenIDConnectProvider: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  requireOIDCProvider(ctx, arn);
  ctx.store.delete(oidcProviderKey(arn));
  for (const entry of ctx.store.list()) {
    if (
      entry.key.startsWith("oidcprovidertag/") &&
      entry.key.startsWith(`oidcprovidertag/${arn}/`)
    ) {
      ctx.store.delete(entry.key);
    }
  }
  return {};
};

const GetOpenIDConnectProvider: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  const provider = requireOIDCProvider(ctx, arn);
  const tags = ctx.store
    .list<StoredTag & { ProviderArn: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("oidcprovidertag/") &&
        entry.value.ProviderArn === arn,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  return {
    Url: provider.Url,
    ClientIDList: provider.ClientIDList,
    ThumbprintList: provider.ThumbprintList,
    CreateDate: provider.CreateDate,
    Tags: tags.length > 0 ? tags : provider.Tags,
  };
};

const AddClientIDToOpenIDConnectProvider: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  const clientId = requireString(input, "ClientID");
  const provider = requireOIDCProvider(ctx, arn);
  if (provider.ClientIDList.includes(clientId)) {
    return {};
  }
  ctx.store.set(oidcProviderKey(arn), {
    ...provider,
    ClientIDList: [...provider.ClientIDList, clientId],
  });
  return {};
};

const RemoveClientIDFromOpenIDConnectProvider: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  const clientId = requireString(input, "ClientID");
  const provider = requireOIDCProvider(ctx, arn);
  ctx.store.set(oidcProviderKey(arn), {
    ...provider,
    ClientIDList: provider.ClientIDList.filter((id) => id !== clientId),
  });
  return {};
};

const UpdateOpenIDConnectProviderThumbprint: OperationHandler = (
  input,
  ctx,
) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  const thumbprintList = input["ThumbprintList"];
  const provider = requireOIDCProvider(ctx, arn);
  ctx.store.set(oidcProviderKey(arn), {
    ...provider,
    ThumbprintList: Array.isArray(thumbprintList)
      ? (thumbprintList as string[])
      : provider.ThumbprintList,
  });
  return {};
};

const ListOpenIDConnectProviders: OperationHandler = (input, ctx) => {
  const providers = ctx.store
    .list<StoredOIDCProvider>()
    .filter((entry) => entry.key.startsWith("oidcprovider/"))
    .map((entry) => ({ Arn: entry.value.Arn }));
  return { OpenIDConnectProviderList: providers };
};

const TagOpenIDConnectProvider: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  requireOIDCProvider(ctx, arn);
  for (const tag of toTagList(input)) {
    ctx.store.set(oidcProviderTagKey(arn, tag.Key), {
      ProviderArn: arn,
      ...tag,
    });
  }
  return {};
};

const ListOpenIDConnectProviderTags: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "OpenIDConnectProviderArn");
  requireOIDCProvider(ctx, arn);
  const storedTags = ctx.store
    .list<StoredTag & { ProviderArn: string }>()
    .filter(
      (entry) =>
        entry.key.startsWith("oidcprovidertag/") &&
        entry.value.ProviderArn === arn,
    )
    .map((entry) => ({ Key: entry.value.Key, Value: entry.value.Value }));
  const provider = ctx.store.get<StoredOIDCProvider>(oidcProviderKey(arn));
  const inlineTags = provider?.Tags ?? [];
  const allTagKeys = new Set<string>(storedTags.map((t) => t.Key));
  const combinedTags = [
    ...storedTags,
    ...inlineTags.filter((t) => !allTagKeys.has(t.Key)),
  ];
  return { Tags: combinedTags, IsTruncated: false };
};

const GenerateCredentialReport: OperationHandler = (input, ctx) => {
  ctx.store.set("credentialreport/0", {
    GeneratedTime: new Date().toISOString(),
  });
  return {
    State: "COMPLETE",
    Description: "No report exists. Starting a new report generation task",
  };
};

const GetCredentialReport: OperationHandler = (input, ctx) => {
  const report = ctx.store.get<{ GeneratedTime: string }>("credentialreport/0");
  if (report === undefined) {
    throw awsError(
      "ReportNotPresent",
      "The credential report does not exist. Use GenerateCredentialReport to create a new report.",
      410,
    );
  }
  const users = ctx.store
    .list<StoredUser>()
    .filter((e) => e.key.startsWith("user/"))
    .map((e) => e.value);
  const header =
    "user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated";
  const rows = users.map(
    (u) =>
      `${u.UserName},${u.Arn},${u.CreateDate},false,N/A,N/A,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  );
  const csv = [header, ...rows].join("\n");
  return {
    Content: Buffer.from(csv).toString("base64"),
    ReportFormat: "text/csv",
    GeneratedTime: report.GeneratedTime,
  };
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
    UpdateUser,
    TagUser,
    UntagUser,
    ListUserTags,
    PutUserPolicy,
    GetUserPolicy,
    DeleteUserPolicy,
    ListUserPolicies,
    AttachUserPolicy,
    DetachUserPolicy,
    ListAttachedUserPolicies,
    PutUserPermissionsBoundary,
    DeleteUserPermissionsBoundary,
    CreatePolicy,
    GetPolicy,
    AttachRolePolicy,
    ListAttachedRolePolicies,
    CreateAccessKey,
    ListAccessKeys,
    DeleteAccessKey,
    UpdateAccessKey,
    GetAccessKeyLastUsed,
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
    UpdateGroup,
    AddUserToGroup,
    RemoveUserFromGroup,
    ListGroupsForUser,
    AttachGroupPolicy,
    DetachGroupPolicy,
    ListAttachedGroupPolicies,
    PutGroupPolicy,
    GetGroupPolicy,
    DeleteGroupPolicy,
    ListGroupPolicies,
    CreatePolicyVersion,
    ListPolicyVersions,
    GetPolicyVersion,
    CreateServiceLinkedRole,
    CreateLoginProfile,
    GetLoginProfile,
    UpdateLoginProfile,
    DeleteLoginProfile,
    CreateAccountAlias,
    DeleteAccountAlias,
    ListAccountAliases,
    UpdateAccountPasswordPolicy,
    GetAccountPasswordPolicy,
    DeleteAccountPasswordPolicy,
    GetAccountSummary,
    ChangePassword,
    UploadServerCertificate,
    GetServerCertificate,
    UpdateServerCertificate,
    DeleteServerCertificate,
    ListServerCertificates,
    TagServerCertificate,
    UntagServerCertificate,
    ListServerCertificateTags,
    UploadSSHPublicKey,
    GetSSHPublicKey,
    UpdateSSHPublicKey,
    DeleteSSHPublicKey,
    ListSSHPublicKeys,
    UploadSigningCertificate,
    UpdateSigningCertificate,
    DeleteSigningCertificate,
    ListSigningCertificates,
    CreateVirtualMFADevice,
    EnableMFADevice,
    DeactivateMFADevice,
    ResyncMFADevice,
    DeleteVirtualMFADevice,
    GetMFADevice,
    ListMFADevices,
    ListVirtualMFADevices,
    TagMFADevice,
    UntagMFADevice,
    ListMFADeviceTags,
    CreateServiceSpecificCredential,
    DeleteServiceSpecificCredential,
    ListServiceSpecificCredentials,
    ResetServiceSpecificCredential,
    UpdateServiceSpecificCredential,
    GenerateCredentialReport,
    GetCredentialReport,
    DeletePolicy,
    DeletePolicyVersion,
    SetDefaultPolicyVersion,
    TagPolicy,
    UntagPolicy,
    ListPolicyTags,
    DeleteInstanceProfile,
    ListInstanceProfiles,
    ListInstanceProfilesForRole,
    RemoveRoleFromInstanceProfile,
    TagInstanceProfile,
    UntagInstanceProfile,
    ListInstanceProfileTags,
    PutRolePermissionsBoundary,
    DeleteRolePermissionsBoundary,
    DetachRolePolicy,
    UpdateAssumeRolePolicy,
    DeleteServiceLinkedRole,
    GetServiceLinkedRoleDeletionStatus,
    GenerateServiceLastAccessedDetails,
    GetServiceLastAccessedDetails,
    GetServiceLastAccessedDetailsWithEntities,
    GetContextKeysForCustomPolicy,
    GetContextKeysForPrincipalPolicy,
    SimulateCustomPolicy,
    SimulatePrincipalPolicy,
    CreateOpenIDConnectProvider,
    DeleteOpenIDConnectProvider,
    GetOpenIDConnectProvider,
    AddClientIDToOpenIDConnectProvider,
    RemoveClientIDFromOpenIDConnectProvider,
    UpdateOpenIDConnectProviderThumbprint,
    ListOpenIDConnectProviders,
    TagOpenIDConnectProvider,
    ListOpenIDConnectProviderTags,
  },
  model,
} as const satisfies ServiceDefinition;

export default iam;
