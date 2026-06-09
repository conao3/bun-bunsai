import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import workspacesModel from "../../../../test/vendor/aws-models/workspaces.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(workspacesModel);

type StoredTag = {
  Key: string;
  Value: string | undefined;
};

type StoredWorkspace = {
  WorkspaceId: string;
  DirectoryId: string;
  UserName: string;
  BundleId: string;
  State: string;
  IpAddress: string;
  ComputerName: string;
  SubnetId: string;
  Tags: StoredTag[];
  WorkspaceProperties?: {
    ComputeTypeName?: string;
    RunningMode?: string;
    UserVolumeSizeGib?: number;
    RootVolumeSizeGib?: number;
  };
};

type StoredWorkspaceBundle = {
  BundleId: string;
  Name: string;
  Owner: string;
  Description: string | undefined;
  ImageId: string | undefined;
  State: string;
  CreationTime: number;
  LastUpdatedTime: number;
  ComputeType: { Name: string } | undefined;
  UserStorage: { Capacity: string } | undefined;
  RootStorage: { Capacity: string } | undefined;
  BundleType: string | undefined;
};

type StoredWorkspaceImage = {
  ImageId: string;
  Name: string;
  Description: string | undefined;
  OperatingSystem: { Type: string } | undefined;
  State: string;
  RequiredTenancy: string;
  Created: number;
  OwnerAccountId: string;
};

type StoredIpGroup = {
  groupId: string;
  groupName: string;
  groupDesc: string | undefined;
  userRules: { ipRule: string; ruleDesc: string | undefined }[];
};

type StoredConnectionAlias = {
  AliasId: string;
  ConnectionString: string;
  State: string;
  OwnerAccountId: string;
  Associations: {
    AssociationStatus: string;
    AssociatedAccountId: string;
    ResourceId: string | undefined;
    ConnectionIdentifier: string;
  }[];
};

type StoredWorkspaceDirectory = {
  DirectoryId: string;
  DirectoryName: string | undefined;
  Alias: string;
  RegistrationCode: string;
  State: string;
  Tenancy: string | undefined;
  SubnetIds: string[];
  ipGroupIds: string[];
  WorkspaceAccessProperties: Record<string, string> | undefined;
  WorkspaceCreationProperties: Record<string, unknown> | undefined;
  SelfservicePermissions: Record<string, string> | undefined;
  SamlProperties: Record<string, unknown> | undefined;
  CertificateBasedAuthProperties: Record<string, unknown> | undefined;
  StreamingProperties: Record<string, unknown> | undefined;
  EndpointEncryptionMode: string | undefined;
  WorkspaceDirectoryName: string | undefined;
  WorkspaceDirectoryDescription: string | undefined;
  UserIdentityType: string | undefined;
  WorkspaceType: string | undefined;
};

type StoredWorkspacesPool = {
  PoolId: string;
  PoolArn: string;
  PoolName: string;
  Description: string | undefined;
  State: string;
  CreatedAt: number;
  BundleId: string;
  DirectoryId: string;
  CapacityStatus: {
    AvailableUserSessions: number;
    DesiredUserSessions: number;
    ActualUserSessions: number;
    ActiveUserSessions: number;
  };
  ApplicationSettings:
    | { Status: string; SettingsGroup: string | undefined }
    | undefined;
  TimeoutSettings: Record<string, unknown> | undefined;
  RunningMode: string | undefined;
};

type StoredAccountLink = {
  AccountLinkId: string;
  AccountLinkStatus: string;
  SourceAccountId: string;
  TargetAccountId: string;
};

type StoredConnectClientAddIn = {
  AddInId: string;
  ResourceId: string;
  Name: string;
  URL: string;
};

type StoredPoolSession = {
  SessionId: string;
  PoolId: string;
  UserId: string | undefined;
  ConnectionState: string;
  AuthenticationType: string;
  StartTime: number;
  ExpirationTime: number;
};

const workspaceKey = (id: string): string => `workspace/${id}`;
const tagsKey = (resourceId: string): string => `tags/${resourceId}`;
const bundleKey = (id: string): string => `bundle/${id}`;
const imageKey = (id: string): string => `image/${id}`;
const ipGroupKey = (id: string): string => `ipgroup/${id}`;
const aliasKey = (id: string): string => `alias/${id}`;
const directoryKey = (id: string): string => `directory/${id}`;
const poolKey = (id: string): string => `pool/${id}`;
const accountLinkKey = (id: string): string => `accountlink/${id}`;
const addonKey = (id: string): string => `addon/${id}`;
const brandingKey = (resourceId: string): string => `branding/${resourceId}`;
const aliasPerm = (aliasId: string): string => `aliasperm/${aliasId}`;
const imagePerm = (imageId: string): string => `imageperm/${imageId}`;
const poolSessionKey = (sessionId: string): string =>
  `poolsession/${sessionId}`;
const ACCOUNT_KEY = "account";

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const toTagList = (value: unknown): StoredTag[] =>
  Array.isArray(value)
    ? (value as unknown[])
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .map((entry) => ({
          Key: typeof entry["Key"] === "string" ? entry["Key"] : "",
          Value: stringOrUndefined(entry["Value"]),
        }))
        .filter((tag) => tag.Key !== "")
    : [];

const toStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

const listByPrefix = <T>(ctx: ServiceContext, prefix: string): T[] =>
  ctx.store
    .list<T>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 1000;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const nextWorkspaceIp = (ctx: ServiceContext): string => {
  const counter = (ctx.store.get<number>("ipCounter") ?? 9) + 1;
  ctx.store.set("ipCounter", counter);
  return `10.0.${Math.floor(counter / 256)}.${counter % 256}`;
};

const requireStored = <T>(
  ctx: ServiceContext,
  key: string,
  errorMsg: string,
): T => {
  const value = ctx.store.get<T>(key);
  if (value === undefined) {
    throw awsError("ResourceNotFoundException", errorMsg, 400);
  }
  return value;
};

const CreateWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["Workspaces"])
    ? (input["Workspaces"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  if (requests.length === 0) {
    throw awsError("ValidationException", "Workspaces is required.", 400);
  }
  const pending = requests.map((request) => {
    const directoryId = requireString(request, "DirectoryId");
    const userName = requireString(request, "UserName");
    const bundleId = requireString(request, "BundleId");
    const id = `ws-${crypto.randomUUID().slice(0, 9)}`;
    const workspace: StoredWorkspace = {
      WorkspaceId: id,
      DirectoryId: directoryId,
      UserName: userName,
      BundleId: bundleId,
      State: "AVAILABLE",
      IpAddress: nextWorkspaceIp(ctx),
      ComputerName: `WSAMZN-${id.slice(3, 11).toUpperCase()}`,
      SubnetId: `subnet-${crypto.randomUUID().slice(0, 8)}`,
      Tags: toTagList(request["Tags"]),
    };
    ctx.store.set(workspaceKey(id), workspace);
    return { ...workspace, State: "PENDING" };
  });
  return { FailedRequests: [], PendingRequests: pending };
};

const DescribeWorkspaces: OperationHandler = (input, ctx) => {
  const ids = Array.isArray(input["WorkspaceIds"])
    ? (input["WorkspaceIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const directoryId = stringOrUndefined(input["DirectoryId"]);
  const userName = stringOrUndefined(input["UserName"]);
  const bundleId = stringOrUndefined(input["BundleId"]);
  const allWorkspaces = ctx.store
    .list<StoredWorkspace>()
    .filter((entry) => entry.key.startsWith("workspace/"))
    .map((entry) => entry.value)
    .filter((workspace) => workspace.State !== "TERMINATED")
    .filter(
      (workspace) => ids === undefined || ids.includes(workspace.WorkspaceId),
    )
    .filter(
      (workspace) =>
        directoryId === undefined || workspace.DirectoryId === directoryId,
    )
    .filter(
      (workspace) => userName === undefined || workspace.UserName === userName,
    )
    .filter(
      (workspace) => bundleId === undefined || workspace.BundleId === bundleId,
    );
  const { items, nextToken } = paginateList(
    allWorkspaces,
    input["NextToken"],
    input["Limit"],
  );
  return { Workspaces: items, NextToken: nextToken };
};

const TerminateWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["TerminateWorkspaceRequests"])
    ? (input["TerminateWorkspaceRequests"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  if (requests.length === 0) {
    throw awsError(
      "ValidationException",
      "TerminateWorkspaceRequests is required.",
      400,
    );
  }
  const failedRequests: {
    WorkspaceId: string;
    ErrorCode: string;
    ErrorMessage: string;
  }[] = [];
  for (const request of requests) {
    const id = requireString(request, "WorkspaceId");
    const ws = ctx.store.get<StoredWorkspace>(workspaceKey(id));
    if (ws === undefined) {
      failedRequests.push({
        WorkspaceId: id,
        ErrorCode: "ValidationException",
        ErrorMessage: `Workspace ${id} does not exist.`,
      });
    } else {
      ctx.store.set(workspaceKey(id), { ...ws, State: "TERMINATING" });
      ctx.store.set(workspaceKey(id), { ...ws, State: "TERMINATED" });
    }
  }
  return { FailedRequests: failedRequests };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tags = toTagList(input["Tags"]);
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  const merged = [
    ...existing.filter((tag) => !tags.some((next) => next.Key === tag.Key)),
    ...tags,
  ];
  ctx.store.set(tagsKey(resourceId), merged);
  const workspace = ctx.store.get<StoredWorkspace>(workspaceKey(resourceId));
  if (workspace !== undefined) {
    ctx.store.set(workspaceKey(resourceId), { ...workspace, Tags: merged });
  }
  return {};
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tags = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  return { TagList: tags };
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const tagKeys = toStringList(input["TagKeys"]);
  const existing = ctx.store.get<StoredTag[]>(tagsKey(resourceId)) ?? [];
  const updated = existing.filter((tag) => !tagKeys.includes(tag.Key));
  ctx.store.set(tagsKey(resourceId), updated);
  const workspace = ctx.store.get<StoredWorkspace>(workspaceKey(resourceId));
  if (workspace !== undefined) {
    ctx.store.set(workspaceKey(resourceId), { ...workspace, Tags: updated });
  }
  return {};
};

const CreateWorkspaceBundle: OperationHandler = (input, ctx) => {
  const name = requireString(input, "BundleName");
  const id = `wsb-${crypto.randomUUID().slice(0, 8)}`;
  const computeType =
    typeof input["ComputeType"] === "object" && input["ComputeType"] !== null
      ? {
          Name:
            stringOrUndefined(
              (input["ComputeType"] as Record<string, unknown>)["Name"],
            ) ?? "VALUE",
        }
      : undefined;
  const userStorage =
    typeof input["UserStorage"] === "object" && input["UserStorage"] !== null
      ? {
          Capacity:
            stringOrUndefined(
              (input["UserStorage"] as Record<string, unknown>)["Capacity"],
            ) ?? "50",
        }
      : undefined;
  const rootStorage =
    typeof input["RootStorage"] === "object" && input["RootStorage"] !== null
      ? {
          Capacity:
            stringOrUndefined(
              (input["RootStorage"] as Record<string, unknown>)["Capacity"],
            ) ?? "80",
        }
      : undefined;
  const bundle: StoredWorkspaceBundle = {
    BundleId: id,
    Name: name,
    Owner: ctx.account,
    Description: stringOrUndefined(input["BundleDescription"]),
    ImageId: stringOrUndefined(input["ImageId"]),
    State: "AVAILABLE",
    CreationTime: Date.now(),
    LastUpdatedTime: Date.now(),
    ComputeType: computeType,
    UserStorage: userStorage,
    RootStorage: rootStorage,
    BundleType: undefined,
  };
  ctx.store.set(bundleKey(id), bundle);
  return { WorkspaceBundle: bundle };
};

const DescribeWorkspaceBundles: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["BundleIds"]);
  const owner = stringOrUndefined(input["Owner"]);
  const bundles = listByPrefix<StoredWorkspaceBundle>(ctx, "bundle/")
    .filter((b) => ids.length === 0 || ids.includes(b.BundleId))
    .filter((b) => owner === undefined || b.Owner === owner);
  const { items, nextToken } = paginateList(
    bundles,
    input["NextToken"],
    undefined,
  );
  return { Bundles: items, NextToken: nextToken };
};

const UpdateWorkspaceBundle: OperationHandler = (input, ctx) => {
  const bundleId = requireString(input, "BundleId");
  const bundle = requireStored<StoredWorkspaceBundle>(
    ctx,
    bundleKey(bundleId),
    `Bundle not found: ${bundleId}`,
  );
  const imageId = stringOrUndefined(input["ImageId"]);
  if (imageId !== undefined) {
    ctx.store.set(bundleKey(bundleId), {
      ...bundle,
      ImageId: imageId,
      LastUpdatedTime: Date.now(),
    });
  }
  return {};
};

const DeleteWorkspaceBundle: OperationHandler = (input, ctx) => {
  const bundleId = requireString(input, "BundleId");
  requireStored<StoredWorkspaceBundle>(
    ctx,
    bundleKey(bundleId),
    `Bundle not found: ${bundleId}`,
  );
  ctx.store.delete(bundleKey(bundleId));
  return {};
};

const CreateWorkspaceImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = `wsi-${crypto.randomUUID().slice(0, 8)}`;
  const image: StoredWorkspaceImage = {
    ImageId: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    OperatingSystem: { Type: "WINDOWS" },
    State: "AVAILABLE",
    RequiredTenancy: "DEFAULT",
    Created: Date.now(),
    OwnerAccountId: ctx.account,
  };
  ctx.store.set(imageKey(id), image);
  return {
    ImageId: id,
    Name: name,
    Description: image.Description,
    OperatingSystem: image.OperatingSystem,
    State: image.State,
    RequiredTenancy: image.RequiredTenancy,
    Created: image.Created,
    OwnerAccountId: image.OwnerAccountId,
  };
};

const DescribeWorkspaceImages: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["ImageIds"]);
  const images = listByPrefix<StoredWorkspaceImage>(ctx, "image/").filter(
    (img) => ids.length === 0 || ids.includes(img.ImageId),
  );
  const { items, nextToken } = paginateList(
    images,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Images: items, NextToken: nextToken };
};

const CopyWorkspaceImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = `wsi-${crypto.randomUUID().slice(0, 8)}`;
  const image: StoredWorkspaceImage = {
    ImageId: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    OperatingSystem: { Type: "WINDOWS" },
    State: "AVAILABLE",
    RequiredTenancy: "DEFAULT",
    Created: Date.now(),
    OwnerAccountId: ctx.account,
  };
  ctx.store.set(imageKey(id), image);
  return { ImageId: id };
};

const ImportWorkspaceImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ImageName");
  const id = `wsi-${crypto.randomUUID().slice(0, 8)}`;
  const image: StoredWorkspaceImage = {
    ImageId: id,
    Name: name,
    Description: stringOrUndefined(input["ImageDescription"]),
    OperatingSystem: { Type: "WINDOWS" },
    State: "AVAILABLE",
    RequiredTenancy: "DEFAULT",
    Created: Date.now(),
    OwnerAccountId: ctx.account,
  };
  ctx.store.set(imageKey(id), image);
  return { ImageId: id };
};

const ImportCustomWorkspaceImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ImageName");
  const id = `wsi-${crypto.randomUUID().slice(0, 8)}`;
  const image: StoredWorkspaceImage = {
    ImageId: id,
    Name: name,
    Description: stringOrUndefined(input["ImageDescription"]),
    OperatingSystem: { Type: "WINDOWS" },
    State: "PENDING",
    RequiredTenancy: "DEFAULT",
    Created: Date.now(),
    OwnerAccountId: ctx.account,
  };
  ctx.store.set(imageKey(id), image);
  return { ImageId: id, State: image.State };
};

const CreateUpdatedWorkspaceImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const id = `wsi-${crypto.randomUUID().slice(0, 8)}`;
  const image: StoredWorkspaceImage = {
    ImageId: id,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    OperatingSystem: { Type: "WINDOWS" },
    State: "AVAILABLE",
    RequiredTenancy: "DEFAULT",
    Created: Date.now(),
    OwnerAccountId: ctx.account,
  };
  ctx.store.set(imageKey(id), image);
  return { ImageId: id };
};

const DeleteWorkspaceImage: OperationHandler = (input, ctx) => {
  const imageId = requireString(input, "ImageId");
  requireStored<StoredWorkspaceImage>(
    ctx,
    imageKey(imageId),
    `Image not found: ${imageId}`,
  );
  ctx.store.delete(imageKey(imageId));
  return {};
};

const DescribeWorkspaceImagePermissions: OperationHandler = (input, ctx) => {
  const imageId = requireString(input, "ImageId");
  const permissions =
    ctx.store.get<{ SharedAccountId: string; AllowCopyImage: boolean }[]>(
      imagePerm(imageId),
    ) ?? [];
  return { ImageId: imageId, ImagePermissions: permissions };
};

const UpdateWorkspaceImagePermission: OperationHandler = (input, ctx) => {
  const imageId = requireString(input, "ImageId");
  const sharedAccountId = requireString(input, "SharedAccountId");
  const allowCopy = input["AllowCopyImage"] === true;
  const existing =
    ctx.store.get<{ SharedAccountId: string; AllowCopyImage: boolean }[]>(
      imagePerm(imageId),
    ) ?? [];
  const updated = [
    ...existing.filter((p) => p.SharedAccountId !== sharedAccountId),
    { SharedAccountId: sharedAccountId, AllowCopyImage: allowCopy },
  ];
  ctx.store.set(imagePerm(imageId), updated);
  return {};
};

const DescribeCustomWorkspaceImageImport: OperationHandler = (input, ctx) => {
  const imageId = requireString(input, "ImageId");
  const image = ctx.store.get<StoredWorkspaceImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image not found: ${imageId}`,
      400,
    );
  }
  return {
    ImageId: imageId,
    State: image.State,
    ProgressPercentage: 100,
    Created: image.Created,
    LastUpdatedTime: Date.now(),
  };
};

const CreateIpGroup: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "GroupName");
  const id = `wsipg-${crypto.randomUUID().slice(0, 8)}`;
  const rules = Array.isArray(input["UserRules"])
    ? (input["UserRules"] as unknown[])
        .filter(
          (r): r is Record<string, unknown> =>
            typeof r === "object" && r !== null,
        )
        .map((r) => ({
          ipRule: String(r["ipRule"] ?? ""),
          ruleDesc: stringOrUndefined(r["ruleDesc"]),
        }))
    : [];
  const group: StoredIpGroup = {
    groupId: id,
    groupName,
    groupDesc: stringOrUndefined(input["GroupDesc"]),
    userRules: rules,
  };
  ctx.store.set(ipGroupKey(id), group);
  return { GroupId: id };
};

const DescribeIpGroups: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["GroupIds"]);
  const groups = listByPrefix<StoredIpGroup>(ctx, "ipgroup/").filter(
    (g) => ids.length === 0 || ids.includes(g.groupId),
  );
  return { Result: groups };
};

const AuthorizeIpRules: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  const group = requireStored<StoredIpGroup>(
    ctx,
    ipGroupKey(groupId),
    `IpGroup not found: ${groupId}`,
  );
  const newRules = Array.isArray(input["UserRules"])
    ? (input["UserRules"] as unknown[])
        .filter(
          (r): r is Record<string, unknown> =>
            typeof r === "object" && r !== null,
        )
        .map((r) => ({
          ipRule: String(r["ipRule"] ?? ""),
          ruleDesc: stringOrUndefined(r["ruleDesc"]),
        }))
    : [];
  ctx.store.set(ipGroupKey(groupId), {
    ...group,
    userRules: [...group.userRules, ...newRules],
  });
  return {};
};

const RevokeIpRules: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  const group = requireStored<StoredIpGroup>(
    ctx,
    ipGroupKey(groupId),
    `IpGroup not found: ${groupId}`,
  );
  const toRevoke = toStringList(input["UserRules"]);
  ctx.store.set(ipGroupKey(groupId), {
    ...group,
    userRules: group.userRules.filter((r) => !toRevoke.includes(r.ipRule)),
  });
  return {};
};

const UpdateRulesOfIpGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  const group = requireStored<StoredIpGroup>(
    ctx,
    ipGroupKey(groupId),
    `IpGroup not found: ${groupId}`,
  );
  const newRules = Array.isArray(input["UserRules"])
    ? (input["UserRules"] as unknown[])
        .filter(
          (r): r is Record<string, unknown> =>
            typeof r === "object" && r !== null,
        )
        .map((r) => ({
          ipRule: String(r["ipRule"] ?? ""),
          ruleDesc: stringOrUndefined(r["ruleDesc"]),
        }))
    : [];
  ctx.store.set(ipGroupKey(groupId), { ...group, userRules: newRules });
  return {};
};

const DeleteIpGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireStored<StoredIpGroup>(
    ctx,
    ipGroupKey(groupId),
    `IpGroup not found: ${groupId}`,
  );
  ctx.store.delete(ipGroupKey(groupId));
  return {};
};

const CreateConnectionAlias: OperationHandler = (input, ctx) => {
  const connectionString = requireString(input, "ConnectionString");
  const id = `wsca-${crypto.randomUUID().slice(0, 8)}`;
  const alias: StoredConnectionAlias = {
    AliasId: id,
    ConnectionString: connectionString,
    State: "CREATED",
    OwnerAccountId: ctx.account,
    Associations: [],
  };
  ctx.store.set(aliasKey(id), alias);
  return { AliasId: id };
};

const DescribeConnectionAliases: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["AliasIds"]);
  const resourceId = stringOrUndefined(input["ResourceId"]);
  const aliases = listByPrefix<StoredConnectionAlias>(ctx, "alias/")
    .filter((a) => ids.length === 0 || ids.includes(a.AliasId))
    .filter(
      (a) =>
        resourceId === undefined ||
        a.Associations.some((assoc) => assoc.ResourceId === resourceId),
    );
  return { ConnectionAliases: aliases };
};

const AssociateConnectionAlias: OperationHandler = (input, ctx) => {
  const aliasId = requireString(input, "AliasId");
  const resourceId = requireString(input, "ResourceId");
  const alias = requireStored<StoredConnectionAlias>(
    ctx,
    aliasKey(aliasId),
    `ConnectionAlias not found: ${aliasId}`,
  );
  const connectionIdentifier = crypto.randomUUID().slice(0, 8);
  const association = {
    AssociationStatus: "ASSOCIATED",
    AssociatedAccountId: ctx.account,
    ResourceId: resourceId,
    ConnectionIdentifier: connectionIdentifier,
  };
  ctx.store.set(aliasKey(aliasId), {
    ...alias,
    Associations: [...alias.Associations, association],
  });
  return { ConnectionIdentifier: connectionIdentifier };
};

const DisassociateConnectionAlias: OperationHandler = (input, ctx) => {
  const aliasId = requireString(input, "AliasId");
  const alias = requireStored<StoredConnectionAlias>(
    ctx,
    aliasKey(aliasId),
    `ConnectionAlias not found: ${aliasId}`,
  );
  ctx.store.set(aliasKey(aliasId), { ...alias, Associations: [] });
  return {};
};

const DeleteConnectionAlias: OperationHandler = (input, ctx) => {
  const aliasId = requireString(input, "AliasId");
  requireStored<StoredConnectionAlias>(
    ctx,
    aliasKey(aliasId),
    `ConnectionAlias not found: ${aliasId}`,
  );
  ctx.store.delete(aliasKey(aliasId));
  return {};
};

const DescribeConnectionAliasPermissions: OperationHandler = (input, ctx) => {
  const aliasId = requireString(input, "AliasId");
  requireStored<StoredConnectionAlias>(
    ctx,
    aliasKey(aliasId),
    `ConnectionAlias not found: ${aliasId}`,
  );
  const permissions =
    ctx.store.get<{ SharedAccountId: string; AllowAssociation: boolean }[]>(
      aliasPerm(aliasId),
    ) ?? [];
  return { AliasId: aliasId, ConnectionAliasPermissions: permissions };
};

const UpdateConnectionAliasPermission: OperationHandler = (input, ctx) => {
  const aliasId = requireString(input, "AliasId");
  requireStored<StoredConnectionAlias>(
    ctx,
    aliasKey(aliasId),
    `ConnectionAlias not found: ${aliasId}`,
  );
  const perm = input["ConnectionAliasPermission"];
  if (typeof perm === "object" && perm !== null) {
    const p = perm as Record<string, unknown>;
    const sharedAccountId = String(p["SharedAccountId"] ?? "");
    const allowAssociation = p["AllowAssociation"] === true;
    const existing =
      ctx.store.get<{ SharedAccountId: string; AllowAssociation: boolean }[]>(
        aliasPerm(aliasId),
      ) ?? [];
    const updated = [
      ...existing.filter((x) => x.SharedAccountId !== sharedAccountId),
      { SharedAccountId: sharedAccountId, AllowAssociation: allowAssociation },
    ];
    ctx.store.set(aliasPerm(aliasId), updated);
  }
  return {};
};

const RegisterWorkspaceDirectory: OperationHandler = (input, ctx) => {
  const directoryId = requireString(input, "DirectoryId");
  const existing = ctx.store.get<StoredWorkspaceDirectory>(
    directoryKey(directoryId),
  );
  if (existing !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Directory already registered: ${directoryId}`,
      400,
    );
  }
  const dir: StoredWorkspaceDirectory = {
    DirectoryId: directoryId,
    DirectoryName: stringOrUndefined(input["WorkspaceDirectoryName"]),
    Alias: `alias-${directoryId.slice(0, 8)}`,
    RegistrationCode: `WSpdx+${directoryId.slice(0, 8)}`,
    State: "REGISTERED",
    Tenancy: stringOrUndefined(input["Tenancy"]),
    SubnetIds: toStringList(input["SubnetIds"]),
    ipGroupIds: [],
    WorkspaceAccessProperties: undefined,
    WorkspaceCreationProperties: undefined,
    SelfservicePermissions: undefined,
    SamlProperties: undefined,
    CertificateBasedAuthProperties: undefined,
    StreamingProperties: undefined,
    EndpointEncryptionMode: undefined,
    WorkspaceDirectoryName: stringOrUndefined(input["WorkspaceDirectoryName"]),
    WorkspaceDirectoryDescription: stringOrUndefined(
      input["WorkspaceDirectoryDescription"],
    ),
    UserIdentityType: stringOrUndefined(input["UserIdentityType"]),
    WorkspaceType: stringOrUndefined(input["WorkspaceType"]),
  };
  ctx.store.set(directoryKey(directoryId), dir);
  return { DirectoryId: directoryId, State: dir.State };
};

const DescribeWorkspaceDirectories: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["DirectoryIds"]);
  const dirs = listByPrefix<StoredWorkspaceDirectory>(ctx, "directory/").filter(
    (d) => ids.length === 0 || ids.includes(d.DirectoryId),
  );
  return { Directories: dirs };
};

const DeregisterWorkspaceDirectory: OperationHandler = (input, ctx) => {
  const directoryId = requireString(input, "DirectoryId");
  requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(directoryId),
    `Directory not found: ${directoryId}`,
  );
  ctx.store.delete(directoryKey(directoryId));
  return {};
};

const AssociateIpGroups: OperationHandler = (input, ctx) => {
  const directoryId = requireString(input, "DirectoryId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(directoryId),
    `Directory not found: ${directoryId}`,
  );
  const groupIds = toStringList(input["GroupIds"]);
  const updated = [...new Set([...dir.ipGroupIds, ...groupIds])];
  ctx.store.set(directoryKey(directoryId), { ...dir, ipGroupIds: updated });
  return {};
};

const DisassociateIpGroups: OperationHandler = (input, ctx) => {
  const directoryId = requireString(input, "DirectoryId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(directoryId),
    `Directory not found: ${directoryId}`,
  );
  const groupIds = toStringList(input["GroupIds"]);
  ctx.store.set(directoryKey(directoryId), {
    ...dir,
    ipGroupIds: dir.ipGroupIds.filter((id) => !groupIds.includes(id)),
  });
  return {};
};

const ModifyWorkspaceAccessProperties: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(resourceId),
    `Directory not found: ${resourceId}`,
  );
  const props = input["WorkspaceAccessProperties"];
  const accessProps =
    typeof props === "object" && props !== null
      ? (props as Record<string, string>)
      : undefined;
  ctx.store.set(directoryKey(resourceId), {
    ...dir,
    WorkspaceAccessProperties: accessProps,
  });
  return {};
};

const ModifyWorkspaceCreationProperties: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(resourceId),
    `Directory not found: ${resourceId}`,
  );
  const props = input["WorkspaceCreationProperties"];
  const creationProps =
    typeof props === "object" && props !== null
      ? (props as Record<string, unknown>)
      : undefined;
  ctx.store.set(directoryKey(resourceId), {
    ...dir,
    WorkspaceCreationProperties: creationProps,
  });
  return {};
};

const ModifySelfservicePermissions: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(resourceId),
    `Directory not found: ${resourceId}`,
  );
  const perms = input["SelfservicePermissions"];
  const selfServicePerms =
    typeof perms === "object" && perms !== null
      ? (perms as Record<string, string>)
      : undefined;
  ctx.store.set(directoryKey(resourceId), {
    ...dir,
    SelfservicePermissions: selfServicePerms,
  });
  return {};
};

const ModifyStreamingProperties: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(resourceId),
    `Directory not found: ${resourceId}`,
  );
  const props = input["StreamingProperties"];
  const streamingProps =
    typeof props === "object" && props !== null
      ? (props as Record<string, unknown>)
      : undefined;
  ctx.store.set(directoryKey(resourceId), {
    ...dir,
    StreamingProperties: streamingProps,
  });
  return {};
};

const ModifySamlProperties: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(resourceId),
    `Directory not found: ${resourceId}`,
  );
  const props = input["SamlProperties"];
  const samlProps =
    typeof props === "object" && props !== null
      ? (props as Record<string, unknown>)
      : undefined;
  ctx.store.set(directoryKey(resourceId), {
    ...dir,
    SamlProperties: samlProps,
  });
  return {};
};

const ModifyCertificateBasedAuthProperties: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(resourceId),
    `Directory not found: ${resourceId}`,
  );
  const props = input["CertificateBasedAuthProperties"];
  const certProps =
    typeof props === "object" && props !== null
      ? (props as Record<string, unknown>)
      : undefined;
  ctx.store.set(directoryKey(resourceId), {
    ...dir,
    CertificateBasedAuthProperties: certProps,
  });
  return {};
};

const ModifyEndpointEncryptionMode: OperationHandler = (input, ctx) => {
  const directoryId = requireString(input, "DirectoryId");
  const dir = requireStored<StoredWorkspaceDirectory>(
    ctx,
    directoryKey(directoryId),
    `Directory not found: ${directoryId}`,
  );
  ctx.store.set(directoryKey(directoryId), {
    ...dir,
    EndpointEncryptionMode: stringOrUndefined(input["EndpointEncryptionMode"]),
  });
  return {};
};

const CreateConnectClientAddIn: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const name = requireString(input, "Name");
  const url = requireString(input, "URL");
  const id = crypto.randomUUID();
  const addIn: StoredConnectClientAddIn = {
    AddInId: id,
    ResourceId: resourceId,
    Name: name,
    URL: url,
  };
  ctx.store.set(addonKey(id), addIn);
  return { AddInId: id };
};

const DescribeConnectClientAddIns: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const addIns = listByPrefix<StoredConnectClientAddIn>(ctx, "addon/").filter(
    (a) => a.ResourceId === resourceId,
  );
  return { AddIns: addIns };
};

const UpdateConnectClientAddIn: OperationHandler = (input, ctx) => {
  const addInId = requireString(input, "AddInId");
  const addIn = requireStored<StoredConnectClientAddIn>(
    ctx,
    addonKey(addInId),
    `AddIn not found: ${addInId}`,
  );
  ctx.store.set(addonKey(addInId), {
    ...addIn,
    Name: stringOrUndefined(input["Name"]) ?? addIn.Name,
    URL: stringOrUndefined(input["URL"]) ?? addIn.URL,
  });
  return {};
};

const DeleteConnectClientAddIn: OperationHandler = (input, ctx) => {
  const addInId = requireString(input, "AddInId");
  requireStored<StoredConnectClientAddIn>(
    ctx,
    addonKey(addInId),
    `AddIn not found: ${addInId}`,
  );
  ctx.store.delete(addonKey(addInId));
  return {};
};

const CreateWorkspacesPool: OperationHandler = (input, ctx) => {
  const poolName = requireString(input, "PoolName");
  const bundleId = requireString(input, "BundleId");
  const directoryId = requireString(input, "DirectoryId");
  const id = `wspool-${crypto.randomUUID().slice(0, 8)}`;
  const capacity = input["Capacity"];
  const desiredSessions =
    typeof capacity === "object" && capacity !== null
      ? (numberOrUndefined(
          (capacity as Record<string, unknown>)["DesiredUserSessions"],
        ) ?? 1)
      : 1;
  const appSettings = input["ApplicationSettings"];
  const applicationSettings =
    typeof appSettings === "object" && appSettings !== null
      ? {
          Status:
            stringOrUndefined(
              (appSettings as Record<string, unknown>)["Status"],
            ) ?? "DISABLED",
          SettingsGroup: stringOrUndefined(
            (appSettings as Record<string, unknown>)["SettingsGroup"],
          ),
        }
      : undefined;
  const pool: StoredWorkspacesPool = {
    PoolId: id,
    PoolArn: `arn:aws:workspaces:${ctx.region}:${ctx.account}:workspacespool/${id}`,
    PoolName: poolName,
    Description: stringOrUndefined(input["Description"]),
    State: "AVAILABLE",
    CreatedAt: Date.now(),
    BundleId: bundleId,
    DirectoryId: directoryId,
    CapacityStatus: {
      AvailableUserSessions: desiredSessions,
      DesiredUserSessions: desiredSessions,
      ActualUserSessions: desiredSessions,
      ActiveUserSessions: 0,
    },
    ApplicationSettings: applicationSettings,
    TimeoutSettings:
      typeof input["TimeoutSettings"] === "object" &&
      input["TimeoutSettings"] !== null
        ? (input["TimeoutSettings"] as Record<string, unknown>)
        : undefined,
    RunningMode: stringOrUndefined(input["RunningMode"]),
  };
  ctx.store.set(poolKey(id), pool);
  return { WorkspacesPool: pool };
};

const DescribeWorkspacesPools: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["PoolIds"]);
  const pools = listByPrefix<StoredWorkspacesPool>(ctx, "pool/").filter(
    (p) => ids.length === 0 || ids.includes(p.PoolId),
  );
  return { WorkspacesPools: pools };
};

const UpdateWorkspacesPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "PoolId");
  const pool = requireStored<StoredWorkspacesPool>(
    ctx,
    poolKey(poolId),
    `Pool not found: ${poolId}`,
  );
  const updated: StoredWorkspacesPool = {
    ...pool,
    Description: stringOrUndefined(input["Description"]) ?? pool.Description,
    BundleId: stringOrUndefined(input["BundleId"]) ?? pool.BundleId,
    DirectoryId: stringOrUndefined(input["DirectoryId"]) ?? pool.DirectoryId,
    RunningMode: stringOrUndefined(input["RunningMode"]) ?? pool.RunningMode,
  };
  ctx.store.set(poolKey(poolId), updated);
  return { WorkspacesPool: updated };
};

const StartWorkspacesPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "PoolId");
  const pool = requireStored<StoredWorkspacesPool>(
    ctx,
    poolKey(poolId),
    `Pool not found: ${poolId}`,
  );
  ctx.store.set(poolKey(poolId), { ...pool, State: "AVAILABLE" });
  return {};
};

const StopWorkspacesPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "PoolId");
  const pool = requireStored<StoredWorkspacesPool>(
    ctx,
    poolKey(poolId),
    `Pool not found: ${poolId}`,
  );
  ctx.store.set(poolKey(poolId), { ...pool, State: "STOPPED" });
  return {};
};

const TerminateWorkspacesPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "PoolId");
  requireStored<StoredWorkspacesPool>(
    ctx,
    poolKey(poolId),
    `Pool not found: ${poolId}`,
  );
  ctx.store.delete(poolKey(poolId));
  return {};
};

const DescribeWorkspacesPoolSessions: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "PoolId");
  const userId = stringOrUndefined(input["UserId"]);
  const sessions = listByPrefix<StoredPoolSession>(ctx, "poolsession/")
    .filter((s) => s.PoolId === poolId)
    .filter((s) => userId === undefined || s.UserId === userId);
  return { Sessions: sessions };
};

const TerminateWorkspacesPoolSession: OperationHandler = (input, ctx) => {
  const sessionId = requireString(input, "SessionId");
  ctx.store.delete(poolSessionKey(sessionId));
  return {};
};

const CreateAccountLinkInvitation: OperationHandler = (input, ctx) => {
  const targetAccountId = requireString(input, "TargetAccountId");
  const id = crypto.randomUUID().slice(0, 8);
  const link: StoredAccountLink = {
    AccountLinkId: id,
    AccountLinkStatus: "PENDING_ACCEPTANCE",
    SourceAccountId: ctx.account,
    TargetAccountId: targetAccountId,
  };
  ctx.store.set(accountLinkKey(id), link);
  return { AccountLink: link };
};

const AcceptAccountLinkInvitation: OperationHandler = (input, ctx) => {
  const linkId = requireString(input, "LinkId");
  const link = requireStored<StoredAccountLink>(
    ctx,
    accountLinkKey(linkId),
    `AccountLink not found: ${linkId}`,
  );
  const updated = { ...link, AccountLinkStatus: "LINKED" };
  ctx.store.set(accountLinkKey(linkId), updated);
  return { AccountLink: updated };
};

const RejectAccountLinkInvitation: OperationHandler = (input, ctx) => {
  const linkId = requireString(input, "LinkId");
  const link = requireStored<StoredAccountLink>(
    ctx,
    accountLinkKey(linkId),
    `AccountLink not found: ${linkId}`,
  );
  const updated = { ...link, AccountLinkStatus: "REJECTED" };
  ctx.store.set(accountLinkKey(linkId), updated);
  return { AccountLink: updated };
};

const DeleteAccountLinkInvitation: OperationHandler = (input, ctx) => {
  const linkId = requireString(input, "LinkId");
  const link = requireStored<StoredAccountLink>(
    ctx,
    accountLinkKey(linkId),
    `AccountLink not found: ${linkId}`,
  );
  ctx.store.delete(accountLinkKey(linkId));
  return { AccountLink: link };
};

const GetAccountLink: OperationHandler = (input, ctx) => {
  const linkId = stringOrUndefined(input["LinkId"]);
  if (linkId !== undefined) {
    const link = requireStored<StoredAccountLink>(
      ctx,
      accountLinkKey(linkId),
      `AccountLink not found: ${linkId}`,
    );
    return { AccountLink: link };
  }
  const linkedAccountId = stringOrUndefined(input["LinkedAccountId"]);
  if (linkedAccountId !== undefined) {
    const link = listByPrefix<StoredAccountLink>(ctx, "accountlink/").find(
      (l) =>
        l.TargetAccountId === linkedAccountId ||
        l.SourceAccountId === linkedAccountId,
    );
    if (link === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        `AccountLink not found for account: ${linkedAccountId}`,
        400,
      );
    }
    return { AccountLink: link };
  }
  throw awsError(
    "ValidationException",
    "LinkId or LinkedAccountId is required.",
    400,
  );
};

const ListAccountLinks: OperationHandler = (input, ctx) => {
  const statusFilter = toStringList(input["LinkStatusFilter"]);
  const links = listByPrefix<StoredAccountLink>(ctx, "accountlink/").filter(
    (l) =>
      statusFilter.length === 0 || statusFilter.includes(l.AccountLinkStatus),
  );
  return { AccountLinks: links };
};

const ImportClientBranding: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const branding: Record<string, unknown> = {};
  const platforms = [
    "DeviceTypeWindows",
    "DeviceTypeOsx",
    "DeviceTypeAndroid",
    "DeviceTypeIos",
    "DeviceTypeLinux",
    "DeviceTypeWeb",
  ] as const;
  for (const platform of platforms) {
    if (typeof input[platform] === "object" && input[platform] !== null) {
      branding[platform] = input[platform];
    }
  }
  ctx.store.set(brandingKey(resourceId), branding);
  return branding;
};

const DescribeClientBranding: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const branding =
    ctx.store.get<Record<string, unknown>>(brandingKey(resourceId)) ?? {};
  return branding;
};

const DeleteClientBranding: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  const branding =
    ctx.store.get<Record<string, unknown>>(brandingKey(resourceId)) ?? {};
  const platforms = toStringList(input["Platforms"]);
  const updated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(branding)) {
    if (!platforms.includes(key)) {
      updated[key] = value;
    }
  }
  ctx.store.set(brandingKey(resourceId), updated);
  return {};
};

const ModifyClientProperties: OperationHandler = (input, ctx) => {
  const resourceId = requireString(input, "ResourceId");
  ctx.store.set(`clientprops/${resourceId}`, input["ClientProperties"]);
  return {};
};

const DescribeClientProperties: OperationHandler = (input, ctx) => {
  const resourceIds = toStringList(input["ResourceIds"]);
  const result = resourceIds.map((id) => ({
    ResourceId: id,
    ClientProperties: ctx.store.get(`clientprops/${id}`) ?? {},
  }));
  return { ClientPropertiesList: result };
};

const RebootWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["RebootWorkspaceRequests"])
    ? (input["RebootWorkspaceRequests"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  for (const req of requests) {
    const id = String(req["WorkspaceId"] ?? "");
    const ws = ctx.store.get<StoredWorkspace>(workspaceKey(id));
    if (ws !== undefined) {
      ctx.store.set(workspaceKey(id), { ...ws, State: "AVAILABLE" });
    }
  }
  return { FailedRequests: [] };
};

const RebuildWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["RebuildWorkspaceRequests"])
    ? (input["RebuildWorkspaceRequests"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  for (const req of requests) {
    const id = String(req["WorkspaceId"] ?? "");
    const ws = ctx.store.get<StoredWorkspace>(workspaceKey(id));
    if (ws !== undefined) {
      ctx.store.set(workspaceKey(id), { ...ws, State: "AVAILABLE" });
    }
  }
  return { FailedRequests: [] };
};

const StartWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["StartWorkspaceRequests"])
    ? (input["StartWorkspaceRequests"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  for (const req of requests) {
    const id = String(req["WorkspaceId"] ?? "");
    const ws = ctx.store.get<StoredWorkspace>(workspaceKey(id));
    if (ws !== undefined) {
      ctx.store.set(workspaceKey(id), { ...ws, State: "AVAILABLE" });
    }
  }
  return { FailedRequests: [] };
};

const StopWorkspaces: OperationHandler = (input, ctx) => {
  const requests = Array.isArray(input["StopWorkspaceRequests"])
    ? (input["StopWorkspaceRequests"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  for (const req of requests) {
    const id = String(req["WorkspaceId"] ?? "");
    const ws = ctx.store.get<StoredWorkspace>(workspaceKey(id));
    if (ws !== undefined) {
      ctx.store.set(workspaceKey(id), { ...ws, State: "STOPPED" });
    }
  }
  return { FailedRequests: [] };
};

const RestoreWorkspace: OperationHandler = (input, ctx) => {
  const workspaceId = requireString(input, "WorkspaceId");
  const ws = requireStored<StoredWorkspace>(
    ctx,
    workspaceKey(workspaceId),
    `Workspace not found: ${workspaceId}`,
  );
  ctx.store.set(workspaceKey(workspaceId), { ...ws, State: "AVAILABLE" });
  return {};
};

const MigrateWorkspace: OperationHandler = (input, ctx) => {
  const sourceId = requireString(input, "SourceWorkspaceId");
  const bundleId = requireString(input, "BundleId");
  const ws = requireStored<StoredWorkspace>(
    ctx,
    workspaceKey(sourceId),
    `Workspace not found: ${sourceId}`,
  );
  const newId = `ws-${crypto.randomUUID().slice(0, 9)}`;
  const newWs: StoredWorkspace = {
    ...ws,
    WorkspaceId: newId,
    BundleId: bundleId,
    State: "AVAILABLE",
  };
  ctx.store.set(workspaceKey(newId), newWs);
  ctx.store.delete(workspaceKey(sourceId));
  return { SourceWorkspaceId: sourceId, TargetWorkspaceId: newId };
};

const ModifyWorkspaceState: OperationHandler = (input, ctx) => {
  const workspaceId = requireString(input, "WorkspaceId");
  const workspaceState = requireString(input, "WorkspaceState");
  const ws = requireStored<StoredWorkspace>(
    ctx,
    workspaceKey(workspaceId),
    `Workspace not found: ${workspaceId}`,
  );
  ctx.store.set(workspaceKey(workspaceId), { ...ws, State: workspaceState });
  return {};
};

const ModifyWorkspaceProperties: OperationHandler = (input, ctx) => {
  const workspaceId = requireString(input, "WorkspaceId");
  const ws = requireStored<StoredWorkspace>(
    ctx,
    workspaceKey(workspaceId),
    `Workspace not found: ${workspaceId}`,
  );
  const props = input["WorkspaceProperties"];
  if (typeof props !== "object" || props === null) return {};
  const p = props as Record<string, unknown>;
  const updated = { ...ws.WorkspaceProperties };
  const computeTypeName = stringOrUndefined(p["ComputeTypeName"]);
  const runningMode = stringOrUndefined(p["RunningMode"]);
  const userVolumeSizeGib = numberOrUndefined(p["UserVolumeSizeGib"]);
  const rootVolumeSizeGib = numberOrUndefined(p["RootVolumeSizeGib"]);
  if (computeTypeName !== undefined) updated.ComputeTypeName = computeTypeName;
  if (runningMode !== undefined) updated.RunningMode = runningMode;
  if (userVolumeSizeGib !== undefined)
    updated.UserVolumeSizeGib = userVolumeSizeGib;
  if (rootVolumeSizeGib !== undefined)
    updated.RootVolumeSizeGib = rootVolumeSizeGib;
  ctx.store.set(workspaceKey(workspaceId), {
    ...ws,
    WorkspaceProperties: updated,
  });
  return {};
};

const CreateStandbyWorkspaces: OperationHandler = (input, ctx) => {
  const standbyWorkspaces = Array.isArray(input["StandbyWorkspaces"])
    ? (input["StandbyWorkspaces"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  const pending = standbyWorkspaces.map((req) => {
    const primaryWorkspaceId = String(req["PrimaryWorkspaceId"] ?? "");
    const directoryId = String(req["DirectoryId"] ?? "");
    const id = `ws-${crypto.randomUUID().slice(0, 9)}`;
    return {
      StandbyWorkspaceId: id,
      DirectoryId: directoryId,
      PrimaryWorkspaceId: primaryWorkspaceId,
    };
  });
  return { FailedStandbyRequests: [], PendingStandbyRequests: pending };
};

const DescribeWorkspacesConnectionStatus: OperationHandler = (input, ctx) => {
  const ids = toStringList(input["WorkspaceIds"]);
  const workspaces = ctx.store
    .list<StoredWorkspace>()
    .filter((entry) => entry.key.startsWith("workspace/"))
    .map((entry) => entry.value)
    .filter((ws) => ids.length === 0 || ids.includes(ws.WorkspaceId));
  const statuses = workspaces.map((ws) => ({
    WorkspaceId: ws.WorkspaceId,
    ConnectionState: ws.State === "AVAILABLE" ? "CONNECTED" : "DISCONNECTED",
    ConnectionStateCheckTimestamp: Date.now(),
    LastKnownUserConnectionTimestamp: Date.now(),
  }));
  const { items, nextToken } = paginateList(
    statuses,
    input["NextToken"],
    undefined,
  );
  return { WorkspacesConnectionStatus: items, NextToken: nextToken };
};

const DescribeWorkspaceSnapshots: OperationHandler = (input) => {
  requireString(input, "WorkspaceId");
  return { RebuildSnapshots: [], RestoreSnapshots: [] };
};

const DescribeAccount: OperationHandler = (input, ctx) => {
  const account = ctx.store.get<{
    DedicatedTenancySupport: string;
    DedicatedTenancyManagementCidrRange: string;
  }>(ACCOUNT_KEY);
  return {
    DedicatedTenancySupport: account?.DedicatedTenancySupport ?? "DISABLED",
    DedicatedTenancyManagementCidrRange:
      account?.DedicatedTenancyManagementCidrRange ?? "198.18.0.0/16",
  };
};

const DescribeAccountModifications: OperationHandler = () => {
  return { AccountModifications: [] };
};

const ModifyAccount: OperationHandler = (input, ctx) => {
  const current = ctx.store.get<Record<string, unknown>>(ACCOUNT_KEY) ?? {};
  ctx.store.set(ACCOUNT_KEY, {
    ...current,
    DedicatedTenancySupport:
      stringOrUndefined(input["DedicatedTenancySupport"]) ??
      current["DedicatedTenancySupport"],
    DedicatedTenancyManagementCidrRange:
      stringOrUndefined(input["DedicatedTenancyManagementCidrRange"]) ??
      current["DedicatedTenancyManagementCidrRange"],
  });
  return {};
};

const ListAvailableManagementCidrRanges: OperationHandler = () => {
  return { ManagementCidrRanges: ["198.18.0.0/16", "198.19.0.0/16"] };
};

const DescribeApplications: OperationHandler = () => {
  return { Applications: [] };
};

const DescribeApplicationAssociations: OperationHandler = (input) => {
  requireString(input, "ApplicationId");
  return { Associations: [] };
};

const DescribeBundleAssociations: OperationHandler = (input) => {
  requireString(input, "BundleId");
  return { Associations: [] };
};

const DescribeImageAssociations: OperationHandler = (input) => {
  requireString(input, "ImageId");
  return { Associations: [] };
};

const DescribeWorkspaceAssociations: OperationHandler = (input) => {
  requireString(input, "WorkspaceId");
  return { Associations: [] };
};

const AssociateWorkspaceApplication: OperationHandler = (input) => {
  const workspaceId = requireString(input, "WorkspaceId");
  const applicationId = requireString(input, "ApplicationId");
  return {
    Association: {
      WorkspaceId: workspaceId,
      AssociatedResourceId: applicationId,
      AssociatedResourceType: "APPLICATION",
      State: "COMPLETED",
    },
  };
};

const DisassociateWorkspaceApplication: OperationHandler = (input) => {
  const workspaceId = requireString(input, "WorkspaceId");
  const applicationId = requireString(input, "ApplicationId");
  return {
    Association: {
      WorkspaceId: workspaceId,
      AssociatedResourceId: applicationId,
      AssociatedResourceType: "APPLICATION",
      State: "REMOVED",
    },
  };
};

const DeployWorkspaceApplications: OperationHandler = (input) => {
  requireString(input, "WorkspaceId");
  return { Deployment: { Associations: [] } };
};

const workspaces = {
  name: "workspaces",
  protocol: "json",
  operations: {
    AcceptAccountLinkInvitation,
    AssociateConnectionAlias,
    AssociateIpGroups,
    AssociateWorkspaceApplication,
    AuthorizeIpRules,
    CopyWorkspaceImage,
    CreateAccountLinkInvitation,
    CreateConnectClientAddIn,
    CreateConnectionAlias,
    CreateIpGroup,
    CreateStandbyWorkspaces,
    CreateTags,
    CreateUpdatedWorkspaceImage,
    CreateWorkspaceBundle,
    CreateWorkspaceImage,
    CreateWorkspaces,
    CreateWorkspacesPool,
    DeleteAccountLinkInvitation,
    DeleteClientBranding,
    DeleteConnectClientAddIn,
    DeleteConnectionAlias,
    DeleteIpGroup,
    DeleteTags,
    DeleteWorkspaceBundle,
    DeleteWorkspaceImage,
    DeployWorkspaceApplications,
    DeregisterWorkspaceDirectory,
    DescribeAccount,
    DescribeAccountModifications,
    DescribeApplicationAssociations,
    DescribeApplications,
    DescribeBundleAssociations,
    DescribeClientBranding,
    DescribeClientProperties,
    DescribeConnectClientAddIns,
    DescribeConnectionAliasPermissions,
    DescribeConnectionAliases,
    DescribeCustomWorkspaceImageImport,
    DescribeImageAssociations,
    DescribeIpGroups,
    DescribeTags,
    DescribeWorkspaceAssociations,
    DescribeWorkspaceBundles,
    DescribeWorkspaceDirectories,
    DescribeWorkspaceImagePermissions,
    DescribeWorkspaceImages,
    DescribeWorkspaceSnapshots,
    DescribeWorkspaces,
    DescribeWorkspacesConnectionStatus,
    DescribeWorkspacesPoolSessions,
    DescribeWorkspacesPools,
    DisassociateConnectionAlias,
    DisassociateIpGroups,
    DisassociateWorkspaceApplication,
    GetAccountLink,
    ImportClientBranding,
    ImportCustomWorkspaceImage,
    ImportWorkspaceImage,
    ListAccountLinks,
    ListAvailableManagementCidrRanges,
    MigrateWorkspace,
    ModifyAccount,
    ModifyCertificateBasedAuthProperties,
    ModifyClientProperties,
    ModifyEndpointEncryptionMode,
    ModifySamlProperties,
    ModifySelfservicePermissions,
    ModifyStreamingProperties,
    ModifyWorkspaceAccessProperties,
    ModifyWorkspaceCreationProperties,
    ModifyWorkspaceProperties,
    ModifyWorkspaceState,
    RebootWorkspaces,
    RebuildWorkspaces,
    RegisterWorkspaceDirectory,
    RejectAccountLinkInvitation,
    RestoreWorkspace,
    RevokeIpRules,
    StartWorkspaces,
    StartWorkspacesPool,
    StopWorkspaces,
    StopWorkspacesPool,
    TerminateWorkspaces,
    TerminateWorkspacesPool,
    TerminateWorkspacesPoolSession,
    UpdateConnectClientAddIn,
    UpdateConnectionAliasPermission,
    UpdateRulesOfIpGroup,
    UpdateWorkspaceBundle,
    UpdateWorkspaceImagePermission,
    UpdateWorkspacesPool,
  },
  model,
} as const satisfies ServiceDefinition;

export default workspaces;
