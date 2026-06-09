import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import appstreamModel from "../../../../test/vendor/aws-models/appstream.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(appstreamModel);

type StoredFleet = {
  Arn: string;
  Name: string;
  DisplayName: string | undefined;
  Description: string | undefined;
  ImageName: string | undefined;
  ImageArn: string | undefined;
  InstanceType: string;
  FleetType: string;
  ComputeCapacityStatus: {
    Desired: number;
    Running: number;
    InUse: number;
    Available: number;
  };
  State: string;
  CreatedTime: number;
  EnableDefaultInternetAccess: boolean | undefined;
  IdleDisconnectTimeoutInSeconds: number | undefined;
  IamRoleArn: string | undefined;
  StreamView: string | undefined;
  Platform: string | undefined;
  DomainJoinInfoDirectoryName: string | undefined;
};

type StoredStack = {
  Arn: string;
  Name: string;
  Description: string | undefined;
  DisplayName: string | undefined;
  CreatedTime: number;
  RedirectURL: string | undefined;
  FeedbackURL: string | undefined;
};

type StoredAppBlock = {
  Arn: string;
  Name: string;
  Description: string | undefined;
  DisplayName: string | undefined;
  SourceS3Location: Record<string, unknown> | undefined;
  SetupScriptDetails: Record<string, unknown> | undefined;
  PostSetupScriptDetails: Record<string, unknown> | undefined;
  PackagingType: string | undefined;
  State: string;
  CreatedTime: number;
};

type StoredAppBlockBuilder = {
  Arn: string;
  Name: string;
  DisplayName: string | undefined;
  Description: string | undefined;
  Platform: string;
  InstanceType: string;
  EnableDefaultInternetAccess: boolean | undefined;
  IamRoleArn: string | undefined;
  VpcConfig: Record<string, unknown>;
  State: string;
  CreatedTime: number;
};

type StoredApplication = {
  Arn: string;
  Name: string;
  DisplayName: string | undefined;
  IconURL: string | undefined;
  LaunchPath: string | undefined;
  LaunchParameters: string | undefined;
  Enabled: boolean;
  WorkingDirectory: string | undefined;
  Description: string | undefined;
  AppBlockArn: string | undefined;
  IconS3Location: Record<string, unknown> | undefined;
  Platforms: string[];
  InstanceFamilies: string[];
  CreatedTime: number;
};

type StoredDirectoryConfig = {
  DirectoryName: string;
  OrganizationalUnitDistinguishedNames: string[];
  ServiceAccountCredentials: Record<string, unknown> | undefined;
  CreatedTime: number;
  CertificateBasedAuthProperties: Record<string, unknown> | undefined;
};

type StoredEntitlement = {
  Name: string;
  StackName: string;
  Description: string | undefined;
  AppVisibility: string;
  Attributes: { Name: string; Value: string }[];
  CreatedTime: number;
  LastModifiedTime: number;
};

type StoredImageBuilder = {
  Arn: string;
  Name: string;
  ImageArn: string | undefined;
  Description: string | undefined;
  DisplayName: string | undefined;
  VpcConfig: Record<string, unknown> | undefined;
  InstanceType: string | undefined;
  Platform: string | undefined;
  IamRoleArn: string | undefined;
  State: string;
  CreatedTime: number;
  EnableDefaultInternetAccess: boolean | undefined;
};

type StoredImage = {
  Arn: string;
  Name: string;
  BaseImageArn: string | undefined;
  DisplayName: string | undefined;
  State: string;
  Visibility: string;
  ImageBuilderSupported: boolean;
  ImageBuilderName: string | undefined;
  Platform: string | undefined;
  Description: string | undefined;
  CreatedTime: number;
  ImagePermissions: { allowFleet: boolean; allowImageBuilder: boolean };
};

type StoredUser = {
  Arn: string;
  UserName: string;
  Enabled: boolean;
  Status: string;
  FirstName: string | undefined;
  LastName: string | undefined;
  CreatedTime: number;
  AuthenticationType: string;
};

type StoredTheme = {
  StackName: string;
  State: string;
  ThemeTitleText: string | undefined;
  ThemeStyling: string | undefined;
  ThemeFooterLinks: unknown[] | undefined;
  ThemeOrganizationLogoURL: string | undefined;
  ThemeFaviconURL: string | undefined;
  CreatedTime: number;
};

type StoredUsageReportSubscription = {
  S3BucketName: string;
  Schedule: string;
  LastGeneratedReportDate: number | undefined;
};

type StoredExportImageTask = {
  TaskId: string;
  ImageArn: string;
  AmiName: string;
  CreatedDate: string;
  AmiDescription: string | undefined;
  State: string;
  AmiId: string | undefined;
};

type StoredSession = {
  Id: string;
  UserId: string;
  StackName: string;
  FleetName: string;
  State: string;
  ConnectionState: string;
  StartTime: number;
  MaxExpirationTime: number;
  AuthenticationType: string;
  InstanceId: string;
};

const fleetKey = (name: string): string => `fleet/${name}`;
const stackKey = (name: string): string => `stack/${name}`;
const appBlockKey = (name: string): string => `appblock/${name}`;
const appBlockBuilderKey = (name: string): string => `appblockbuilder/${name}`;
const applicationKey = (name: string): string => `application/${name}`;
const directoryConfigKey = (name: string): string => `dirconfig/${name}`;
const entitlementKey = (stackName: string, name: string): string =>
  `entitlement/${stackName}/${name}`;
const imageBuilderKey = (name: string): string => `imagebuilder/${name}`;
const imageKey = (name: string): string => `image/${name}`;
const userKey = (authType: string, userName: string): string =>
  `user/${authType}/${userName}`;
const themeKey = (stackName: string): string => `theme/${stackName}`;
const usageReportSubscriptionKey = (): string => `usage-report-subscription`;
const exportImageTaskKey = (taskId: string): string =>
  `exportimagetask/${taskId}`;
const sessionKey = (id: string): string => `session/${id}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const fleetStackAssocKey = (fleetName: string, stackName: string): string =>
  `fleet-stack/${fleetName}/${stackName}`;
const builderAppBlockAssocKey = (
  builderName: string,
  appBlockArn: string,
): string => `builder-appblock/${builderName}/${appBlockArn}`;
const fleetAppAssocKey = (fleetName: string, appArn: string): string =>
  `fleet-app/${fleetName}/${appArn}`;
const entitledAppKey = (
  stackName: string,
  entitlementName: string,
  appId: string,
): string => `entitled-app/${stackName}/${entitlementName}/${appId}`;
const userStackAssocKey = (
  stackName: string,
  userName: string,
  authType: string,
): string => `user-stack/${stackName}/${userName}/${authType}`;
const imagePerm = (name: string, accountId: string): string =>
  `imageperm/${name}/${accountId}`;
const imageBuilderSoftwareKey = (imageBuilderName: string): string =>
  `imagebuilder-software/${imageBuilderName}`;

const arnResourceExists = (arn: string, ctx: ServiceContext): boolean => {
  const colonParts = arn.split(":");
  if (colonParts.length < 6) return false;
  const resourcePart = colonParts.slice(5).join(":");
  const slashIdx = resourcePart.indexOf("/");
  if (slashIdx === -1) return false;
  const resourceType = resourcePart.slice(0, slashIdx);
  const resourceId = resourcePart.slice(slashIdx + 1);
  if (resourceType === "fleet")
    return ctx.store.get<StoredFleet>(fleetKey(resourceId)) !== undefined;
  if (resourceType === "stack")
    return ctx.store.get<StoredStack>(stackKey(resourceId)) !== undefined;
  if (resourceType === "image")
    return ctx.store.get<StoredImage>(imageKey(resourceId)) !== undefined;
  if (resourceType === "image-builder")
    return (
      ctx.store.get<StoredImageBuilder>(imageBuilderKey(resourceId)) !==
      undefined
    );
  if (resourceType === "application")
    return (
      ctx.store.get<StoredApplication>(applicationKey(resourceId)) !== undefined
    );
  if (resourceType === "app-block")
    return ctx.store.get<StoredAppBlock>(appBlockKey(resourceId)) !== undefined;
  if (resourceType === "app-block-builder")
    return (
      ctx.store.get<StoredAppBlockBuilder>(appBlockBuilderKey(resourceId)) !==
      undefined
    );
  if (resourceType === "user") {
    const slash = resourceId.indexOf("/");
    if (slash === -1) return false;
    return (
      ctx.store.get<StoredUser>(
        userKey(resourceId.slice(0, slash), resourceId.slice(slash + 1)),
      ) !== undefined
    );
  }
  return false;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidParameterCombinationException",
      `${key} is required.`,
      400,
    );
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const booleanOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const stringListFromInput = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const encodeCursor = (offset: number): string => btoa(String(offset));

const decodeCursor = (token: string): number => {
  const n = parseInt(atob(token), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const paginate = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; NextToken: string | undefined } => {
  const offset = typeof nextToken === "string" ? decodeCursor(nextToken) : 0;
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : items.length;
  const page = items.slice(offset, offset + max);
  const token =
    offset + max < items.length ? encodeCursor(offset + max) : undefined;
  return { items: page, NextToken: token };
};

const filtersFromInput = (
  value: unknown,
): { name: string; values: string[] }[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (f): f is Record<string, unknown> =>
        typeof f === "object" && f !== null && !Array.isArray(f),
    )
    .map((f) => ({
      name: typeof f["Name"] === "string" ? f["Name"] : "",
      values: Array.isArray(f["Values"])
        ? (f["Values"] as unknown[]).filter(
            (v): v is string => typeof v === "string",
          )
        : [],
    }))
    .filter((f) => f.name !== "");
};

const desiredFromComputeCapacity = (value: unknown): number => {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)["DesiredInstances"] === "number"
  ) {
    return (value as Record<string, unknown>)["DesiredInstances"] as number;
  }
  return 1;
};

const objectOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const entitlementAttributesFromInput = (
  value: unknown,
): { Name: string; Value: string }[] =>
  Array.isArray(value)
    ? (value as unknown[])
        .filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        )
        .map((entry) => ({
          Name: typeof entry["Name"] === "string" ? entry["Name"] : "",
          Value: typeof entry["Value"] === "string" ? entry["Value"] : "",
        }))
        .filter((a) => a.Name !== "")
    : [];

const tagsMapFromInput = (value: unknown): Record<string, string> => {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string") result[k] = v;
    }
    return result;
  }
  return {};
};

const fleetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:fleet/${name}`;

const stackArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:stack/${name}`;

const appBlockArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:app-block/${name}`;

const appBlockBuilderArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:app-block-builder/${name}`;

const applicationArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:application/${name}`;

const imageBuilderArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:image-builder/${name}`;

const imageArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:image/${name}`;

const userArn = (
  ctx: ServiceContext,
  authType: string,
  userName: string,
): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:user/${authType}/${userName}`;

const listFleets = (ctx: ServiceContext): StoredFleet[] =>
  ctx.store
    .list<StoredFleet>()
    .filter((entry) => entry.key.startsWith("fleet/"))
    .map((entry) => entry.value);

const listStacks = (ctx: ServiceContext): StoredStack[] =>
  ctx.store
    .list<StoredStack>()
    .filter((entry) => entry.key.startsWith("stack/"))
    .map((entry) => entry.value);

const listAppBlocks = (ctx: ServiceContext): StoredAppBlock[] =>
  ctx.store
    .list<StoredAppBlock>()
    .filter((entry) => entry.key.startsWith("appblock/"))
    .map((entry) => entry.value);

const listAppBlockBuilders = (ctx: ServiceContext): StoredAppBlockBuilder[] =>
  ctx.store
    .list<StoredAppBlockBuilder>()
    .filter((entry) => entry.key.startsWith("appblockbuilder/"))
    .map((entry) => entry.value);

const listApplications = (ctx: ServiceContext): StoredApplication[] =>
  ctx.store
    .list<StoredApplication>()
    .filter((entry) => entry.key.startsWith("application/"))
    .map((entry) => entry.value);

const listDirectoryConfigs = (ctx: ServiceContext): StoredDirectoryConfig[] =>
  ctx.store
    .list<StoredDirectoryConfig>()
    .filter((entry) => entry.key.startsWith("dirconfig/"))
    .map((entry) => entry.value);

const listImageBuilders = (ctx: ServiceContext): StoredImageBuilder[] =>
  ctx.store
    .list<StoredImageBuilder>()
    .filter((entry) => entry.key.startsWith("imagebuilder/"))
    .map((entry) => entry.value);

const listImages = (ctx: ServiceContext): StoredImage[] =>
  ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith("image/"))
    .map((entry) => entry.value);

const listUsers = (ctx: ServiceContext): StoredUser[] =>
  ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith("user/"))
    .map((entry) => entry.value);

const listExportImageTasks = (ctx: ServiceContext): StoredExportImageTask[] =>
  ctx.store
    .list<StoredExportImageTask>()
    .filter((entry) => entry.key.startsWith("exportimagetask/"))
    .map((entry) => entry.value);

const listSessions = (ctx: ServiceContext): StoredSession[] =>
  ctx.store
    .list<StoredSession>()
    .filter((entry) => entry.key.startsWith("session/"))
    .map((entry) => entry.value);

const CreateFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const instanceType = requireString(input, "InstanceType");
  if (ctx.store.get<StoredFleet>(fleetKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Fleet already exists: ${name}`,
      400,
    );
  }
  const desired = desiredFromComputeCapacity(input["ComputeCapacity"]);
  const fleet: StoredFleet = {
    Arn: fleetArn(ctx, name),
    Name: name,
    DisplayName: stringOrUndefined(input["DisplayName"]),
    Description: stringOrUndefined(input["Description"]),
    ImageName: stringOrUndefined(input["ImageName"]),
    ImageArn: stringOrUndefined(input["ImageArn"]),
    InstanceType: instanceType,
    FleetType: stringOrUndefined(input["FleetType"]) ?? "ON_DEMAND",
    ComputeCapacityStatus: {
      Desired: desired,
      Running: desired,
      InUse: 0,
      Available: desired,
    },
    State: "RUNNING",
    CreatedTime: Date.now(),
    EnableDefaultInternetAccess: booleanOrUndefined(
      input["EnableDefaultInternetAccess"],
    ),
    IdleDisconnectTimeoutInSeconds: numberOrUndefined(
      input["IdleDisconnectTimeoutInSeconds"],
    ),
    IamRoleArn: stringOrUndefined(input["IamRoleArn"]),
    StreamView: stringOrUndefined(input["StreamView"]),
    Platform: stringOrUndefined(input["Platform"]),
    DomainJoinInfoDirectoryName: stringOrUndefined(
      (input["DomainJoinInfo"] as Record<string, unknown> | undefined)?.[
        "DirectoryName"
      ],
    ),
  };
  ctx.store.set(fleetKey(name), fleet);
  return { Fleet: fleet };
};

const DescribeFleets: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  return {
    Fleets: listFleets(ctx).filter(
      (fleet) => names.length === 0 || names.includes(fleet.Name),
    ),
  };
};

const DeleteFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredFleet>(fleetKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${name}`,
      400,
    );
  }
  const hasStackAssoc = ctx.store
    .list<boolean>()
    .some((entry) => entry.key.startsWith(`fleet-stack/${name}/`));
  if (hasStackAssoc) {
    throw awsError("ResourceInUseException", `Fleet is in use: ${name}`, 400);
  }
  ctx.store.delete(fleetKey(name));
  return {};
};

const StartFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const fleet = ctx.store.get<StoredFleet>(fleetKey(name));
  if (fleet === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${name}`,
      400,
    );
  }
  if (fleet.State === "RUNNING") {
    throw awsError(
      "OperationNotPermittedException",
      `Fleet is already RUNNING: ${name}`,
      400,
    );
  }
  ctx.store.set(fleetKey(name), { ...fleet, State: "RUNNING" });
  return {};
};

const StopFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const fleet = ctx.store.get<StoredFleet>(fleetKey(name));
  if (fleet === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${name}`,
      400,
    );
  }
  if (fleet.State === "STOPPED") {
    throw awsError(
      "OperationNotPermittedException",
      `Fleet is already STOPPED: ${name}`,
      400,
    );
  }
  ctx.store.set(fleetKey(name), { ...fleet, State: "STOPPED" });
  return {};
};

const UpdateFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const fleet = ctx.store.get<StoredFleet>(fleetKey(name));
  if (fleet === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${name}`,
      400,
    );
  }
  const desired =
    input["ComputeCapacity"] !== undefined
      ? desiredFromComputeCapacity(input["ComputeCapacity"])
      : fleet.ComputeCapacityStatus.Desired;
  const updated: StoredFleet = {
    ...fleet,
    DisplayName: stringOrUndefined(input["DisplayName"]) ?? fleet.DisplayName,
    Description: stringOrUndefined(input["Description"]) ?? fleet.Description,
    ImageName: stringOrUndefined(input["ImageName"]) ?? fleet.ImageName,
    ImageArn: stringOrUndefined(input["ImageArn"]) ?? fleet.ImageArn,
    InstanceType:
      stringOrUndefined(input["InstanceType"]) ?? fleet.InstanceType,
    ComputeCapacityStatus: {
      Desired: desired,
      Running: desired,
      InUse: 0,
      Available: desired,
    },
    EnableDefaultInternetAccess:
      booleanOrUndefined(input["EnableDefaultInternetAccess"]) ??
      fleet.EnableDefaultInternetAccess,
    IdleDisconnectTimeoutInSeconds:
      numberOrUndefined(input["IdleDisconnectTimeoutInSeconds"]) ??
      fleet.IdleDisconnectTimeoutInSeconds,
    IamRoleArn: stringOrUndefined(input["IamRoleArn"]) ?? fleet.IamRoleArn,
    StreamView: stringOrUndefined(input["StreamView"]) ?? fleet.StreamView,
    Platform: stringOrUndefined(input["Platform"]) ?? fleet.Platform,
    DomainJoinInfoDirectoryName:
      stringOrUndefined(
        (input["DomainJoinInfo"] as Record<string, unknown> | undefined)?.[
          "DirectoryName"
        ],
      ) ?? fleet.DomainJoinInfoDirectoryName,
  };
  ctx.store.set(fleetKey(name), updated);
  return { Fleet: updated };
};

const AssociateFleet: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "FleetName");
  const stackName = requireString(input, "StackName");
  if (ctx.store.get<StoredFleet>(fleetKey(fleetName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${fleetName}`,
      400,
    );
  }
  if (ctx.store.get<StoredStack>(stackKey(stackName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Stack not found: ${stackName}`,
      400,
    );
  }
  ctx.store.set(fleetStackAssocKey(fleetName, stackName), true);
  return {};
};

const DisassociateFleet: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "FleetName");
  const stackName = requireString(input, "StackName");
  ctx.store.delete(fleetStackAssocKey(fleetName, stackName));
  return {};
};

const ListAssociatedFleets: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const names = ctx.store
    .list<boolean>()
    .filter((entry) => entry.key.startsWith("fleet-stack/"))
    .filter((entry) => entry.key.endsWith(`/${stackName}`))
    .map((entry) => entry.key.split("/")[1]);
  return { Names: names };
};

const ListAssociatedStacks: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "FleetName");
  const names = ctx.store
    .list<boolean>()
    .filter((entry) => entry.key.startsWith(`fleet-stack/${fleetName}/`))
    .map((entry) => entry.key.split("/").slice(2).join("/"));
  return { Names: names };
};

const CreateStack: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredStack>(stackKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Stack already exists: ${name}`,
      400,
    );
  }
  const stack: StoredStack = {
    Arn: stackArn(ctx, name),
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DisplayName: stringOrUndefined(input["DisplayName"]),
    CreatedTime: Date.now(),
    RedirectURL: stringOrUndefined(input["RedirectURL"]),
    FeedbackURL: stringOrUndefined(input["FeedbackURL"]),
  };
  ctx.store.set(stackKey(name), stack);
  return { Stack: stack };
};

const DescribeStacks: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  return {
    Stacks: listStacks(ctx).filter(
      (stack) => names.length === 0 || names.includes(stack.Name),
    ),
  };
};

const DeleteStack: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredStack>(stackKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Stack not found: ${name}`,
      400,
    );
  }
  const hasFleetAssoc = ctx.store
    .list<boolean>()
    .some(
      (entry) =>
        entry.key.startsWith("fleet-stack/") && entry.key.endsWith(`/${name}`),
    );
  if (hasFleetAssoc) {
    throw awsError("ResourceInUseException", `Stack is in use: ${name}`, 400);
  }
  const hasEntitlement = ctx.store
    .list<StoredEntitlement>()
    .some((entry) => entry.key.startsWith(`entitlement/${name}/`));
  if (hasEntitlement) {
    throw awsError("ResourceInUseException", `Stack is in use: ${name}`, 400);
  }
  ctx.store.delete(stackKey(name));
  return {};
};

const UpdateStack: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stack = ctx.store.get<StoredStack>(stackKey(name));
  if (stack === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Stack not found: ${name}`,
      400,
    );
  }
  const updated: StoredStack = {
    ...stack,
    Description: stringOrUndefined(input["Description"]) ?? stack.Description,
    DisplayName: stringOrUndefined(input["DisplayName"]) ?? stack.DisplayName,
    RedirectURL: stringOrUndefined(input["RedirectURL"]) ?? stack.RedirectURL,
    FeedbackURL: stringOrUndefined(input["FeedbackURL"]) ?? stack.FeedbackURL,
  };
  ctx.store.set(stackKey(name), updated);
  return { Stack: updated };
};

const CreateAppBlock: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredAppBlock>(appBlockKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `AppBlock already exists: ${name}`,
      400,
    );
  }
  const arn = appBlockArn(ctx, name);
  const appBlock: StoredAppBlock = {
    Arn: arn,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DisplayName: stringOrUndefined(input["DisplayName"]),
    SourceS3Location: objectOrUndefined(input["SourceS3Location"]),
    SetupScriptDetails: objectOrUndefined(input["SetupScriptDetails"]),
    PostSetupScriptDetails: objectOrUndefined(input["PostSetupScriptDetails"]),
    PackagingType: stringOrUndefined(input["PackagingType"]),
    State: "ACTIVE",
    CreatedTime: Date.now(),
  };
  ctx.store.set(appBlockKey(name), appBlock);
  return { AppBlock: appBlock };
};

const DescribeAppBlocks: OperationHandler = (input, ctx) => {
  const arns = stringListFromInput(input["Arns"]);
  return {
    AppBlocks: listAppBlocks(ctx).filter(
      (ab) => arns.length === 0 || arns.includes(ab.Arn),
    ),
  };
};

const DeleteAppBlock: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredAppBlock>(appBlockKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlock not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(appBlockKey(name));
  return {};
};

const CreateAppBlockBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const platform = requireString(input, "Platform");
  const instanceType = requireString(input, "InstanceType");
  if (
    ctx.store.get<StoredAppBlockBuilder>(appBlockBuilderKey(name)) !== undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `AppBlockBuilder already exists: ${name}`,
      400,
    );
  }
  const arn = appBlockBuilderArn(ctx, name);
  const builder: StoredAppBlockBuilder = {
    Arn: arn,
    Name: name,
    DisplayName: stringOrUndefined(input["DisplayName"]),
    Description: stringOrUndefined(input["Description"]),
    Platform: platform,
    InstanceType: instanceType,
    EnableDefaultInternetAccess: booleanOrUndefined(
      input["EnableDefaultInternetAccess"],
    ),
    IamRoleArn: stringOrUndefined(input["IamRoleArn"]),
    VpcConfig: objectOrUndefined(input["VpcConfig"]) ?? {},
    State: "RUNNING",
    CreatedTime: Date.now(),
  };
  ctx.store.set(appBlockBuilderKey(name), builder);
  return { AppBlockBuilder: builder };
};

const DescribeAppBlockBuilders: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  return {
    AppBlockBuilders: listAppBlockBuilders(ctx).filter(
      (b) => names.length === 0 || names.includes(b.Name),
    ),
  };
};

const DeleteAppBlockBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (
    ctx.store.get<StoredAppBlockBuilder>(appBlockBuilderKey(name)) === undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlockBuilder not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(appBlockBuilderKey(name));
  return {};
};

const StartAppBlockBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const builder = ctx.store.get<StoredAppBlockBuilder>(
    appBlockBuilderKey(name),
  );
  if (builder === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlockBuilder not found: ${name}`,
      400,
    );
  }
  if (builder.State === "RUNNING") {
    throw awsError(
      "OperationNotPermittedException",
      `AppBlockBuilder is already RUNNING: ${name}`,
      400,
    );
  }
  const updated = { ...builder, State: "RUNNING" };
  ctx.store.set(appBlockBuilderKey(name), updated);
  return { AppBlockBuilder: updated };
};

const StopAppBlockBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const builder = ctx.store.get<StoredAppBlockBuilder>(
    appBlockBuilderKey(name),
  );
  if (builder === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlockBuilder not found: ${name}`,
      400,
    );
  }
  if (builder.State === "STOPPED") {
    throw awsError(
      "OperationNotPermittedException",
      `AppBlockBuilder is already STOPPED: ${name}`,
      400,
    );
  }
  const updated = { ...builder, State: "STOPPED" };
  ctx.store.set(appBlockBuilderKey(name), updated);
  return { AppBlockBuilder: updated };
};

const UpdateAppBlockBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const builder = ctx.store.get<StoredAppBlockBuilder>(
    appBlockBuilderKey(name),
  );
  if (builder === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlockBuilder not found: ${name}`,
      400,
    );
  }
  const updated: StoredAppBlockBuilder = {
    ...builder,
    DisplayName: stringOrUndefined(input["DisplayName"]) ?? builder.DisplayName,
    Description: stringOrUndefined(input["Description"]) ?? builder.Description,
    InstanceType:
      stringOrUndefined(input["InstanceType"]) ?? builder.InstanceType,
    Platform: stringOrUndefined(input["Platform"]) ?? builder.Platform,
    IamRoleArn: stringOrUndefined(input["IamRoleArn"]) ?? builder.IamRoleArn,
    EnableDefaultInternetAccess:
      booleanOrUndefined(input["EnableDefaultInternetAccess"]) ??
      builder.EnableDefaultInternetAccess,
    VpcConfig: objectOrUndefined(input["VpcConfig"]) ?? builder.VpcConfig,
  };
  ctx.store.set(appBlockBuilderKey(name), updated);
  return { AppBlockBuilder: updated };
};

const AssociateAppBlockBuilderAppBlock: OperationHandler = (input, ctx) => {
  const appBlockArn_ = requireString(input, "AppBlockArn");
  const appBlockBuilderName = requireString(input, "AppBlockBuilderName");
  const appBlockName = appBlockArn_.split("/").pop() ?? "";
  if (ctx.store.get<StoredAppBlock>(appBlockKey(appBlockName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlock not found: ${appBlockArn_}`,
      400,
    );
  }
  if (
    ctx.store.get<StoredAppBlockBuilder>(
      appBlockBuilderKey(appBlockBuilderName),
    ) === undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlockBuilder not found: ${appBlockBuilderName}`,
      400,
    );
  }
  const assoc = {
    AppBlockArn: appBlockArn_,
    AppBlockBuilderName: appBlockBuilderName,
  };
  ctx.store.set(
    builderAppBlockAssocKey(appBlockBuilderName, appBlockArn_),
    assoc,
  );
  return { AppBlockBuilderAppBlockAssociation: assoc };
};

const DisassociateAppBlockBuilderAppBlock: OperationHandler = (input, ctx) => {
  const appBlockArn_ = requireString(input, "AppBlockArn");
  const appBlockBuilderName = requireString(input, "AppBlockBuilderName");
  ctx.store.delete(builderAppBlockAssocKey(appBlockBuilderName, appBlockArn_));
  return {};
};

const DescribeAppBlockBuilderAppBlockAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const filterBuilderName = stringOrUndefined(input["AppBlockBuilderName"]);
  const filterAppBlockArn = stringOrUndefined(input["AppBlockArn"]);
  const assocs = ctx.store
    .list<{ AppBlockArn: string; AppBlockBuilderName: string }>()
    .filter((entry) => entry.key.startsWith("builder-appblock/"))
    .map((entry) => entry.value)
    .filter(
      (a) =>
        filterBuilderName === undefined ||
        a.AppBlockBuilderName === filterBuilderName,
    )
    .filter(
      (a) =>
        filterAppBlockArn === undefined || a.AppBlockArn === filterAppBlockArn,
    );
  return { AppBlockBuilderAppBlockAssociations: assocs };
};

const CreateAppBlockBuilderStreamingURL: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AppBlockBuilderName");
  if (
    ctx.store.get<StoredAppBlockBuilder>(appBlockBuilderKey(name)) === undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `AppBlockBuilder not found: ${name}`,
      400,
    );
  }
  return {
    StreamingURL: `https://appstream2.${ctx.region}.aws.amazon.com/authenticate?version=1&appblockbuilder=${name}`,
    Expires: Math.floor(Date.now() / 1000) + 3600,
  };
};

const CreateApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredApplication>(applicationKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Application already exists: ${name}`,
      400,
    );
  }
  const arn = applicationArn(ctx, name);
  const app: StoredApplication = {
    Arn: arn,
    Name: name,
    DisplayName: stringOrUndefined(input["DisplayName"]),
    IconURL: stringOrUndefined(input["IconURL"]),
    LaunchPath: stringOrUndefined(input["LaunchPath"]),
    LaunchParameters: stringOrUndefined(input["LaunchParameters"]),
    Enabled: true,
    WorkingDirectory: stringOrUndefined(input["WorkingDirectory"]),
    Description: stringOrUndefined(input["Description"]),
    AppBlockArn: stringOrUndefined(input["AppBlockArn"]),
    IconS3Location: objectOrUndefined(input["IconS3Location"]),
    Platforms: stringListFromInput(input["Platforms"]),
    InstanceFamilies: stringListFromInput(input["InstanceFamilies"]),
    CreatedTime: Date.now(),
  };
  ctx.store.set(applicationKey(name), app);
  return { Application: app };
};

const DescribeApplications: OperationHandler = (input, ctx) => {
  const arns = stringListFromInput(input["Arns"]);
  return {
    Applications: listApplications(ctx).filter(
      (a) => arns.length === 0 || arns.includes(a.Arn),
    ),
  };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredApplication>(applicationKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(applicationKey(name));
  return {};
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const app = ctx.store.get<StoredApplication>(applicationKey(name));
  if (app === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found: ${name}`,
      400,
    );
  }
  const updated: StoredApplication = {
    ...app,
    DisplayName: stringOrUndefined(input["DisplayName"]) ?? app.DisplayName,
    Description: stringOrUndefined(input["Description"]) ?? app.Description,
    IconURL: stringOrUndefined(input["IconURL"]) ?? app.IconURL,
    LaunchPath: stringOrUndefined(input["LaunchPath"]) ?? app.LaunchPath,
    LaunchParameters:
      stringOrUndefined(input["LaunchParameters"]) ?? app.LaunchParameters,
    WorkingDirectory:
      stringOrUndefined(input["WorkingDirectory"]) ?? app.WorkingDirectory,
    AppBlockArn: stringOrUndefined(input["AppBlockArn"]) ?? app.AppBlockArn,
    IconS3Location:
      objectOrUndefined(input["IconS3Location"]) ?? app.IconS3Location,
    Enabled: booleanOrUndefined(input["Enabled"]) ?? app.Enabled,
  };
  ctx.store.set(applicationKey(name), updated);
  return { Application: updated };
};

const AssociateApplicationFleet: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "FleetName");
  const appArn = requireString(input, "ApplicationArn");
  if (ctx.store.get<StoredFleet>(fleetKey(fleetName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${fleetName}`,
      400,
    );
  }
  const appName = appArn.split("/").pop() ?? "";
  if (ctx.store.get<StoredApplication>(applicationKey(appName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found: ${appArn}`,
      400,
    );
  }
  const assoc = { FleetName: fleetName, ApplicationArn: appArn };
  ctx.store.set(fleetAppAssocKey(fleetName, appArn), assoc);
  return { ApplicationFleetAssociation: assoc };
};

const DisassociateApplicationFleet: OperationHandler = (input, ctx) => {
  const fleetName = requireString(input, "FleetName");
  const appArn = requireString(input, "ApplicationArn");
  ctx.store.delete(fleetAppAssocKey(fleetName, appArn));
  return {};
};

const DescribeApplicationFleetAssociations: OperationHandler = (input, ctx) => {
  const filterFleet = stringOrUndefined(input["FleetName"]);
  const filterApp = stringOrUndefined(input["ApplicationArn"]);
  const assocs = ctx.store
    .list<{ FleetName: string; ApplicationArn: string }>()
    .filter((entry) => entry.key.startsWith("fleet-app/"))
    .map((entry) => entry.value)
    .filter((a) => filterFleet === undefined || a.FleetName === filterFleet)
    .filter((a) => filterApp === undefined || a.ApplicationArn === filterApp);
  return { ApplicationFleetAssociations: assocs };
};

const AssociateApplicationToEntitlement: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const entitlementName = requireString(input, "EntitlementName");
  const appId = requireString(input, "ApplicationIdentifier");
  if (
    ctx.store.get<StoredEntitlement>(
      entitlementKey(stackName, entitlementName),
    ) === undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `Entitlement not found: ${entitlementName}`,
      400,
    );
  }
  ctx.store.set(entitledAppKey(stackName, entitlementName, appId), {
    ApplicationIdentifier: appId,
  });
  return {};
};

const DisassociateApplicationFromEntitlement: OperationHandler = (
  input,
  ctx,
) => {
  const stackName = requireString(input, "StackName");
  const entitlementName = requireString(input, "EntitlementName");
  const appId = requireString(input, "ApplicationIdentifier");
  ctx.store.delete(entitledAppKey(stackName, entitlementName, appId));
  return {};
};

const ListEntitledApplications: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const entitlementName = requireString(input, "EntitlementName");
  const prefix = `entitled-app/${stackName}/${entitlementName}/`;
  const apps = ctx.store
    .list<{ ApplicationIdentifier: string }>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  return { EntitledApplications: apps };
};

const CreateDirectoryConfig: OperationHandler = (input, ctx) => {
  const directoryName = requireString(input, "DirectoryName");
  if (
    ctx.store.get<StoredDirectoryConfig>(directoryConfigKey(directoryName)) !==
    undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `DirectoryConfig already exists: ${directoryName}`,
      400,
    );
  }
  const dirConfig: StoredDirectoryConfig = {
    DirectoryName: directoryName,
    OrganizationalUnitDistinguishedNames: stringListFromInput(
      input["OrganizationalUnitDistinguishedNames"],
    ),
    ServiceAccountCredentials: objectOrUndefined(
      input["ServiceAccountCredentials"],
    ),
    CreatedTime: Date.now(),
    CertificateBasedAuthProperties: objectOrUndefined(
      input["CertificateBasedAuthProperties"],
    ),
  };
  ctx.store.set(directoryConfigKey(directoryName), dirConfig);
  return { DirectoryConfig: dirConfig };
};

const DescribeDirectoryConfigs: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["DirectoryNames"]);
  const all = listDirectoryConfigs(ctx).filter(
    (dc) => names.length === 0 || names.includes(dc.DirectoryName),
  );
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { DirectoryConfigs: items, NextToken };
};

const DeleteDirectoryConfig: OperationHandler = (input, ctx) => {
  const directoryName = requireString(input, "DirectoryName");
  if (
    ctx.store.get<StoredDirectoryConfig>(directoryConfigKey(directoryName)) ===
    undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `DirectoryConfig not found: ${directoryName}`,
      400,
    );
  }
  const usedByFleet = listFleets(ctx).some(
    (f) => f.DomainJoinInfoDirectoryName === directoryName,
  );
  if (usedByFleet) {
    throw awsError(
      "ResourceInUseException",
      `DirectoryConfig is in use: ${directoryName}`,
      400,
    );
  }
  ctx.store.delete(directoryConfigKey(directoryName));
  return {};
};

const UpdateDirectoryConfig: OperationHandler = (input, ctx) => {
  const directoryName = requireString(input, "DirectoryName");
  const dirConfig = ctx.store.get<StoredDirectoryConfig>(
    directoryConfigKey(directoryName),
  );
  if (dirConfig === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `DirectoryConfig not found: ${directoryName}`,
      400,
    );
  }
  const updated: StoredDirectoryConfig = {
    ...dirConfig,
    OrganizationalUnitDistinguishedNames:
      input["OrganizationalUnitDistinguishedNames"] !== undefined
        ? stringListFromInput(input["OrganizationalUnitDistinguishedNames"])
        : dirConfig.OrganizationalUnitDistinguishedNames,
    ServiceAccountCredentials:
      objectOrUndefined(input["ServiceAccountCredentials"]) ??
      dirConfig.ServiceAccountCredentials,
    CertificateBasedAuthProperties:
      objectOrUndefined(input["CertificateBasedAuthProperties"]) ??
      dirConfig.CertificateBasedAuthProperties,
  };
  ctx.store.set(directoryConfigKey(directoryName), updated);
  return { DirectoryConfig: updated };
};

const CreateEntitlement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stackName = requireString(input, "StackName");
  const appVisibility = requireString(input, "AppVisibility");
  if (
    ctx.store.get<StoredEntitlement>(entitlementKey(stackName, name)) !==
    undefined
  ) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Entitlement already exists: ${name}`,
      400,
    );
  }
  const now = Date.now();
  const entitlement: StoredEntitlement = {
    Name: name,
    StackName: stackName,
    Description: stringOrUndefined(input["Description"]),
    AppVisibility: appVisibility,
    Attributes: entitlementAttributesFromInput(input["Attributes"]),
    CreatedTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(entitlementKey(stackName, name), entitlement);
  return { Entitlement: entitlement };
};

const DescribeEntitlements: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const name = stringOrUndefined(input["Name"]);
  const all = ctx.store
    .list<StoredEntitlement>()
    .filter((entry) => entry.key.startsWith(`entitlement/${stackName}/`))
    .map((entry) => entry.value)
    .filter((e) => name === undefined || e.Name === name);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Entitlements: items, NextToken };
};

const DeleteEntitlement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stackName = requireString(input, "StackName");
  if (
    ctx.store.get<StoredEntitlement>(entitlementKey(stackName, name)) ===
    undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `Entitlement not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(entitlementKey(stackName, name));
  return {};
};

const UpdateEntitlement: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const stackName = requireString(input, "StackName");
  const entitlement = ctx.store.get<StoredEntitlement>(
    entitlementKey(stackName, name),
  );
  if (entitlement === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Entitlement not found: ${name}`,
      400,
    );
  }
  const updated: StoredEntitlement = {
    ...entitlement,
    Description:
      stringOrUndefined(input["Description"]) ?? entitlement.Description,
    AppVisibility:
      stringOrUndefined(input["AppVisibility"]) ?? entitlement.AppVisibility,
    Attributes:
      input["Attributes"] !== undefined
        ? entitlementAttributesFromInput(input["Attributes"])
        : entitlement.Attributes,
    LastModifiedTime: Date.now(),
  };
  ctx.store.set(entitlementKey(stackName, name), updated);
  return { Entitlement: updated };
};

const CreateImageBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const instanceType = requireString(input, "InstanceType");
  if (ctx.store.get<StoredImageBuilder>(imageBuilderKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `ImageBuilder already exists: ${name}`,
      400,
    );
  }
  const arn = imageBuilderArn(ctx, name);
  const builder: StoredImageBuilder = {
    Arn: arn,
    Name: name,
    ImageArn: stringOrUndefined(input["ImageArn"]),
    Description: stringOrUndefined(input["Description"]),
    DisplayName: stringOrUndefined(input["DisplayName"]),
    VpcConfig: objectOrUndefined(input["VpcConfig"]),
    InstanceType: instanceType,
    Platform: stringOrUndefined(input["Platform"]),
    IamRoleArn: stringOrUndefined(input["IamRoleArn"]),
    State: "RUNNING",
    CreatedTime: Date.now(),
    EnableDefaultInternetAccess: booleanOrUndefined(
      input["EnableDefaultInternetAccess"],
    ),
  };
  ctx.store.set(imageBuilderKey(name), builder);
  return { ImageBuilder: builder };
};

const DescribeImageBuilders: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  return {
    ImageBuilders: listImageBuilders(ctx).filter(
      (b) => names.length === 0 || names.includes(b.Name),
    ),
  };
};

const DeleteImageBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const builder = ctx.store.get<StoredImageBuilder>(imageBuilderKey(name));
  if (builder === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ImageBuilder not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(imageBuilderKey(name));
  return { ImageBuilder: { ...builder, State: "DELETING" } };
};

const StartImageBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const builder = ctx.store.get<StoredImageBuilder>(imageBuilderKey(name));
  if (builder === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ImageBuilder not found: ${name}`,
      400,
    );
  }
  if (builder.State === "RUNNING") {
    throw awsError(
      "OperationNotPermittedException",
      `ImageBuilder is already RUNNING: ${name}`,
      400,
    );
  }
  const updated = { ...builder, State: "RUNNING" };
  ctx.store.set(imageBuilderKey(name), updated);
  return { ImageBuilder: updated };
};

const StopImageBuilder: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const builder = ctx.store.get<StoredImageBuilder>(imageBuilderKey(name));
  if (builder === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ImageBuilder not found: ${name}`,
      400,
    );
  }
  if (builder.State === "STOPPED") {
    throw awsError(
      "OperationNotPermittedException",
      `ImageBuilder is already STOPPED: ${name}`,
      400,
    );
  }
  const updated = { ...builder, State: "STOPPED" };
  ctx.store.set(imageBuilderKey(name), updated);
  return { ImageBuilder: updated };
};

const CreateImageBuilderStreamingURL: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredImageBuilder>(imageBuilderKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ImageBuilder not found: ${name}`,
      400,
    );
  }
  return {
    StreamingURL: `https://appstream2.${ctx.region}.aws.amazon.com/authenticate?version=1&imagebuilder=${name}`,
    Expires: Math.floor(Date.now() / 1000) + 3600,
  };
};

const AssociateSoftwareToImageBuilder: OperationHandler = (input, ctx) => {
  const imageBuilderName = requireString(input, "ImageBuilderName");
  const softwareNames = stringListFromInput(input["SoftwareNames"]);
  const existing =
    ctx.store.get<string[]>(imageBuilderSoftwareKey(imageBuilderName)) ?? [];
  const merged = [...new Set([...existing, ...softwareNames])];
  ctx.store.set(imageBuilderSoftwareKey(imageBuilderName), merged);
  return {};
};

const DisassociateSoftwareFromImageBuilder: OperationHandler = (input, ctx) => {
  const imageBuilderName = requireString(input, "ImageBuilderName");
  const softwareNames = stringListFromInput(input["SoftwareNames"]);
  const existing =
    ctx.store.get<string[]>(imageBuilderSoftwareKey(imageBuilderName)) ?? [];
  const updated = existing.filter((s) => !softwareNames.includes(s));
  ctx.store.set(imageBuilderSoftwareKey(imageBuilderName), updated);
  return {};
};

const DescribeSoftwareAssociations: OperationHandler = (input, ctx) => {
  const associatedResource = requireString(input, "AssociatedResource");
  const builderName = associatedResource.split("/").pop() ?? associatedResource;
  const softwareNames =
    ctx.store.get<string[]>(imageBuilderSoftwareKey(builderName)) ?? [];
  return {
    AssociatedResource: associatedResource,
    SoftwareAssociations: softwareNames.map((name) => ({ SoftwareName: name })),
  };
};

const StartSoftwareDeploymentToImageBuilder: OperationHandler = (
  _input,
  _ctx,
) => {
  return {};
};

const CreateImportedImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const arn = imageArn(ctx, name);
  const image: StoredImage = {
    Arn: arn,
    Name: name,
    BaseImageArn: stringOrUndefined(input["BaseImageArn"]),
    DisplayName: stringOrUndefined(input["DisplayName"]),
    State: "AVAILABLE",
    Visibility: "PRIVATE",
    ImageBuilderSupported: false,
    ImageBuilderName: undefined,
    Platform: stringOrUndefined(input["Platform"]),
    Description: stringOrUndefined(input["Description"]),
    CreatedTime: Date.now(),
    ImagePermissions: { allowFleet: true, allowImageBuilder: false },
  };
  ctx.store.set(imageKey(name), image);
  return { Image: image };
};

const CopyImage: OperationHandler = (input, ctx) => {
  const sourceImageName = requireString(input, "SourceImageName");
  const destImageName = requireString(input, "DestinationImageName");
  const sourceImage = ctx.store.get<StoredImage>(imageKey(sourceImageName));
  if (sourceImage === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image not found: ${sourceImageName}`,
      400,
    );
  }
  const destArn = imageArn(ctx, destImageName);
  const destImage: StoredImage = {
    ...sourceImage,
    Arn: destArn,
    Name: destImageName,
    BaseImageArn: sourceImage.Arn,
    CreatedTime: Date.now(),
  };
  ctx.store.set(imageKey(destImageName), destImage);
  return { DestinationImageName: destImageName };
};

const CreateUpdatedImage: OperationHandler = (input, ctx) => {
  const existingImageName = requireString(input, "existingImageName");
  const newImageName = requireString(input, "newImageName");
  const existing = ctx.store.get<StoredImage>(imageKey(existingImageName));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image not found: ${existingImageName}`,
      400,
    );
  }
  const newArn = imageArn(ctx, newImageName);
  const newImage: StoredImage = {
    ...existing,
    Arn: newArn,
    Name: newImageName,
    BaseImageArn: existing.Arn,
    CreatedTime: Date.now(),
  };
  ctx.store.set(imageKey(newImageName), newImage);
  return { image: newImage, canUpdateImage: true };
};

const DescribeImages: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  const arns = stringListFromInput(input["Arns"]);
  const all = listImages(ctx).filter(
    (img) =>
      (names.length === 0 || names.includes(img.Name)) &&
      (arns.length === 0 || arns.includes(img.Arn)),
  );
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Images: items, NextToken };
};

const DeleteImage: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const image = ctx.store.get<StoredImage>(imageKey(name));
  if (image === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Image not found: ${name}`,
      400,
    );
  }
  const imageArn_ = image.Arn;
  const usedByFleet = listFleets(ctx).some(
    (f) => f.ImageName === name || f.ImageArn === imageArn_,
  );
  if (usedByFleet) {
    throw awsError("ResourceInUseException", `Image is in use: ${name}`, 400);
  }
  const usedByBuilder = listImageBuilders(ctx).some(
    (b) => b.ImageArn === imageArn_,
  );
  if (usedByBuilder) {
    throw awsError("ResourceInUseException", `Image is in use: ${name}`, 400);
  }
  ctx.store.delete(imageKey(name));
  return { Image: { ...image, State: "DELETING" } };
};

const UpdateImagePermissions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const sharedAccountId = requireString(input, "SharedAccountId");
  const permsInput = objectOrUndefined(input["ImagePermissions"]);
  const perms = {
    allowFleet:
      typeof permsInput?.["allowFleet"] === "boolean"
        ? permsInput["allowFleet"]
        : true,
    allowImageBuilder:
      typeof permsInput?.["allowImageBuilder"] === "boolean"
        ? permsInput["allowImageBuilder"]
        : false,
  };
  ctx.store.set(imagePerm(name, sharedAccountId), {
    SharedAccountId: sharedAccountId,
    SharedImagePermissions: perms,
  });
  return {};
};

const DescribeImagePermissions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const sharedAccountIds = stringListFromInput(input["SharedAwsAccountIds"]);
  const prefix = `imageperm/${name}/`;
  const entries = ctx.store
    .list<{
      SharedAccountId: string;
      SharedImagePermissions: Record<string, unknown>;
    }>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value)
    .filter(
      (entry) =>
        sharedAccountIds.length === 0 ||
        sharedAccountIds.includes(entry.SharedAccountId),
    );
  return { Name: name, SharedImagePermissionsList: entries };
};

const DeleteImagePermissions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const sharedAccountId = requireString(input, "SharedAccountId");
  ctx.store.delete(imagePerm(name, sharedAccountId));
  return {};
};

const CreateExportImageTask: OperationHandler = (input, ctx) => {
  const imageName = requireString(input, "ImageName");
  const amiName = requireString(input, "AmiName");
  const image = ctx.store.get<StoredImage>(imageKey(imageName));
  const taskId = crypto.randomUUID();
  const task: StoredExportImageTask = {
    TaskId: taskId,
    ImageArn: image?.Arn ?? imageArn(ctx, imageName),
    AmiName: amiName,
    CreatedDate: new Date().toISOString(),
    AmiDescription: stringOrUndefined(input["AmiDescription"]),
    State: "ACTIVE",
    AmiId: `ami-${crypto.randomUUID().slice(0, 8)}`,
  };
  ctx.store.set(exportImageTaskKey(taskId), task);
  return { ExportImageTask: task };
};

const GetExportImageTask: OperationHandler = (input, ctx) => {
  const taskId = requireString(input, "TaskId");
  const task = ctx.store.get<StoredExportImageTask>(exportImageTaskKey(taskId));
  if (task === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ExportImageTask not found: ${taskId}`,
      400,
    );
  }
  return { ExportImageTask: task };
};

const ListExportImageTasks: OperationHandler = (input, ctx) => {
  let tasks = listExportImageTasks(ctx);
  const filters = filtersFromInput(input["Filters"]);
  for (const filter of filters) {
    if (filter.name === "State") {
      tasks = tasks.filter((t) => filter.values.includes(t.State));
    } else if (filter.name === "ImageName") {
      tasks = tasks.filter((t) => filter.values.includes(t.AmiName));
    }
  }
  const { items, NextToken } = paginate(
    tasks,
    input["MaxResults"],
    input["NextToken"],
  );
  return { ExportImageTasks: items, NextToken };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const authType = requireString(input, "AuthenticationType");
  const key = userKey(authType, userName);
  if (ctx.store.get<StoredUser>(key) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `User already exists: ${userName}`,
      400,
    );
  }
  const user: StoredUser = {
    Arn: userArn(ctx, authType, userName),
    UserName: userName,
    Enabled: true,
    Status: "CONFIRMED",
    FirstName: stringOrUndefined(input["FirstName"]),
    LastName: stringOrUndefined(input["LastName"]),
    CreatedTime: Date.now(),
    AuthenticationType: authType,
  };
  ctx.store.set(key, user);
  return {};
};

const DescribeUsers: OperationHandler = (input, ctx) => {
  const authType = requireString(input, "AuthenticationType");
  const all = listUsers(ctx).filter((u) => u.AuthenticationType === authType);
  const { items, NextToken } = paginate(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Users: items, NextToken };
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const authType = requireString(input, "AuthenticationType");
  const key = userKey(authType, userName);
  if (ctx.store.get<StoredUser>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User not found: ${userName}`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const EnableUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const authType = requireString(input, "AuthenticationType");
  const key = userKey(authType, userName);
  const user = ctx.store.get<StoredUser>(key);
  if (user === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User not found: ${userName}`,
      400,
    );
  }
  ctx.store.set(key, { ...user, Enabled: true });
  return {};
};

const DisableUser: OperationHandler = (input, ctx) => {
  const userName = requireString(input, "UserName");
  const authType = requireString(input, "AuthenticationType");
  const key = userKey(authType, userName);
  const user = ctx.store.get<StoredUser>(key);
  if (user === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User not found: ${userName}`,
      400,
    );
  }
  ctx.store.set(key, { ...user, Enabled: false });
  return {};
};

const BatchAssociateUserStack: OperationHandler = (input, ctx) => {
  const associations = Array.isArray(input["UserStackAssociations"])
    ? (input["UserStackAssociations"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  for (const assoc of associations) {
    const stackName = stringOrUndefined(assoc["StackName"]);
    const userName = stringOrUndefined(assoc["UserName"]);
    const authType = stringOrUndefined(assoc["AuthenticationType"]);
    if (stackName && userName && authType) {
      ctx.store.set(userStackAssocKey(stackName, userName, authType), {
        StackName: stackName,
        UserName: userName,
        AuthenticationType: authType,
        SendEmailNotification:
          typeof assoc["SendEmailNotification"] === "boolean"
            ? assoc["SendEmailNotification"]
            : false,
      });
    }
  }
  return { errors: [] };
};

const BatchDisassociateUserStack: OperationHandler = (input, ctx) => {
  const associations = Array.isArray(input["UserStackAssociations"])
    ? (input["UserStackAssociations"] as unknown[]).filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  for (const assoc of associations) {
    const stackName = stringOrUndefined(assoc["StackName"]);
    const userName = stringOrUndefined(assoc["UserName"]);
    const authType = stringOrUndefined(assoc["AuthenticationType"]);
    if (stackName && userName && authType) {
      ctx.store.delete(userStackAssocKey(stackName, userName, authType));
    }
  }
  return { errors: [] };
};

const DescribeUserStackAssociations: OperationHandler = (input, ctx) => {
  const filterStack = stringOrUndefined(input["StackName"]);
  const filterUser = stringOrUndefined(input["UserName"]);
  const filterAuth = stringOrUndefined(input["AuthenticationType"]);
  const assocs = ctx.store
    .list<{
      StackName: string;
      UserName: string;
      AuthenticationType: string;
      SendEmailNotification: boolean;
    }>()
    .filter((entry) => entry.key.startsWith("user-stack/"))
    .map((entry) => entry.value)
    .filter((a) => filterStack === undefined || a.StackName === filterStack)
    .filter((a) => filterUser === undefined || a.UserName === filterUser)
    .filter(
      (a) => filterAuth === undefined || a.AuthenticationType === filterAuth,
    );
  return { UserStackAssociations: assocs };
};

const CreateThemeForStack: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  if (ctx.store.get<StoredTheme>(themeKey(stackName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Theme already exists for stack: ${stackName}`,
      400,
    );
  }
  const theme: StoredTheme = {
    StackName: stackName,
    State: "ENABLED",
    ThemeTitleText: stringOrUndefined(input["ThemeTitleText"]),
    ThemeStyling: stringOrUndefined(input["ThemeStyling"]),
    ThemeFooterLinks: Array.isArray(input["ThemeFooterLinks"])
      ? (input["ThemeFooterLinks"] as unknown[])
      : undefined,
    ThemeOrganizationLogoURL: stringOrUndefined(
      input["ThemeOrganizationLogoURL"],
    ),
    ThemeFaviconURL: stringOrUndefined(input["ThemeFaviconURL"]),
    CreatedTime: Date.now(),
  };
  ctx.store.set(themeKey(stackName), theme);
  return { Theme: theme };
};

const DescribeThemeForStack: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const theme = ctx.store.get<StoredTheme>(themeKey(stackName));
  if (theme === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Theme not found for stack: ${stackName}`,
      400,
    );
  }
  return { Theme: theme };
};

const UpdateThemeForStack: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const theme = ctx.store.get<StoredTheme>(themeKey(stackName));
  if (theme === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Theme not found for stack: ${stackName}`,
      400,
    );
  }
  const updated: StoredTheme = {
    ...theme,
    ThemeTitleText:
      stringOrUndefined(input["ThemeTitleText"]) ?? theme.ThemeTitleText,
    ThemeStyling:
      stringOrUndefined(input["ThemeStyling"]) ?? theme.ThemeStyling,
    ThemeFooterLinks: Array.isArray(input["ThemeFooterLinks"])
      ? (input["ThemeFooterLinks"] as unknown[])
      : theme.ThemeFooterLinks,
    ThemeOrganizationLogoURL:
      stringOrUndefined(input["ThemeOrganizationLogoURL"]) ??
      theme.ThemeOrganizationLogoURL,
    ThemeFaviconURL:
      stringOrUndefined(input["ThemeFaviconURL"]) ?? theme.ThemeFaviconURL,
  };
  ctx.store.set(themeKey(stackName), updated);
  return { Theme: updated };
};

const DeleteThemeForStack: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  if (ctx.store.get<StoredTheme>(themeKey(stackName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Theme not found for stack: ${stackName}`,
      400,
    );
  }
  ctx.store.delete(themeKey(stackName));
  return {};
};

const CreateUsageReportSubscription: OperationHandler = (input, ctx) => {
  const schedule = stringOrUndefined(input["Schedule"]) ?? "DAILY";
  const s3BucketName = `appstream-logs-${ctx.account}-${ctx.region}`;
  const sub: StoredUsageReportSubscription = {
    S3BucketName: s3BucketName,
    Schedule: schedule,
    LastGeneratedReportDate: undefined,
  };
  ctx.store.set(usageReportSubscriptionKey(), sub);
  return { S3BucketName: s3BucketName, Schedule: schedule };
};

const DescribeUsageReportSubscriptions: OperationHandler = (_input, ctx) => {
  const sub = ctx.store.get<StoredUsageReportSubscription>(
    usageReportSubscriptionKey(),
  );
  return {
    UsageReportSubscriptions: sub !== undefined ? [sub] : [],
  };
};

const DeleteUsageReportSubscription: OperationHandler = (_input, ctx) => {
  ctx.store.delete(usageReportSubscriptionKey());
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  if (!arnResourceExists(resourceArn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const tags = tagsMapFromInput(input["Tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  if (!arnResourceExists(resourceArn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const tagKeys = stringListFromInput(input["TagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated = Object.fromEntries(
    Object.entries(existing).filter(([k]) => !tagKeys.includes(k)),
  );
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  if (!arnResourceExists(resourceArn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource not found: ${resourceArn}`,
      400,
    );
  }
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const CreateStreamingURL: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const fleetName = requireString(input, "FleetName");
  const userId = requireString(input, "UserId");
  const sessionId = `sess-${crypto.randomUUID().slice(0, 8)}`;
  const session: StoredSession = {
    Id: sessionId,
    UserId: userId,
    StackName: stackName,
    FleetName: fleetName,
    State: "ACTIVE",
    ConnectionState: "CONNECTED",
    StartTime: Math.floor(Date.now() / 1000) - 60,
    MaxExpirationTime: Math.floor(Date.now() / 1000) + 3600,
    AuthenticationType: stringOrUndefined(input["AuthenticationType"]) ?? "API",
    InstanceId: `i-${crypto.randomUUID().slice(0, 12)}`,
  };
  ctx.store.set(sessionKey(sessionId), session);
  return {
    StreamingURL: `https://appstream2.${ctx.region}.aws.amazon.com/authenticate?version=1&stack=${stackName}&fleet=${fleetName}&user=${userId}`,
    Expires: Math.floor(Date.now() / 1000) + 3600,
  };
};

const DescribeSessions: OperationHandler = (input, ctx) => {
  const stackName = requireString(input, "StackName");
  const fleetName = requireString(input, "FleetName");
  const userId = stringOrUndefined(input["UserId"]);
  const instanceId = stringOrUndefined(input["InstanceId"]);
  let sessions = listSessions(ctx).filter(
    (s) => s.StackName === stackName && s.FleetName === fleetName,
  );
  if (userId !== undefined) {
    sessions = sessions.filter((s) => s.UserId === userId);
  }
  if (instanceId !== undefined) {
    sessions = sessions.filter((s) => s.InstanceId === instanceId);
  }
  const { items, NextToken } = paginate(
    sessions,
    input["Limit"],
    input["NextToken"],
  );
  return { Sessions: items, NextToken };
};

const ExpireSession: OperationHandler = (input, ctx) => {
  const sessionId = requireString(input, "SessionId");
  const session = ctx.store.get<StoredSession>(sessionKey(sessionId));
  if (session !== undefined) {
    ctx.store.set(sessionKey(sessionId), { ...session, State: "EXPIRED" });
  }
  return {};
};

const DrainSessionInstance: OperationHandler = (_input, _ctx) => {
  return {};
};

const DescribeAppLicenseUsage: OperationHandler = (_input, _ctx) => {
  return { AppLicenseUsages: [] };
};

const appstream = {
  name: "appstream",
  protocol: "json",
  operations: {
    AssociateAppBlockBuilderAppBlock,
    AssociateApplicationFleet,
    AssociateApplicationToEntitlement,
    AssociateFleet,
    AssociateSoftwareToImageBuilder,
    BatchAssociateUserStack,
    BatchDisassociateUserStack,
    CopyImage,
    CreateAppBlock,
    CreateAppBlockBuilder,
    CreateAppBlockBuilderStreamingURL,
    CreateApplication,
    CreateDirectoryConfig,
    CreateEntitlement,
    CreateExportImageTask,
    CreateFleet,
    CreateImageBuilder,
    CreateImageBuilderStreamingURL,
    CreateImportedImage,
    CreateStack,
    CreateStreamingURL,
    CreateThemeForStack,
    CreateUpdatedImage,
    CreateUsageReportSubscription,
    CreateUser,
    DeleteAppBlock,
    DeleteAppBlockBuilder,
    DeleteApplication,
    DeleteDirectoryConfig,
    DeleteEntitlement,
    DeleteFleet,
    DeleteImage,
    DeleteImageBuilder,
    DeleteImagePermissions,
    DeleteStack,
    DeleteThemeForStack,
    DeleteUsageReportSubscription,
    DeleteUser,
    DescribeAppBlockBuilderAppBlockAssociations,
    DescribeAppBlockBuilders,
    DescribeAppBlocks,
    DescribeAppLicenseUsage,
    DescribeApplicationFleetAssociations,
    DescribeApplications,
    DescribeDirectoryConfigs,
    DescribeEntitlements,
    DescribeFleets,
    DescribeImageBuilders,
    DescribeImagePermissions,
    DescribeImages,
    DescribeSessions,
    DescribeSoftwareAssociations,
    DescribeStacks,
    DescribeThemeForStack,
    DescribeUsageReportSubscriptions,
    DescribeUserStackAssociations,
    DescribeUsers,
    DisableUser,
    DisassociateAppBlockBuilderAppBlock,
    DisassociateApplicationFleet,
    DisassociateApplicationFromEntitlement,
    DisassociateFleet,
    DisassociateSoftwareFromImageBuilder,
    DrainSessionInstance,
    EnableUser,
    ExpireSession,
    GetExportImageTask,
    ListAssociatedFleets,
    ListAssociatedStacks,
    ListEntitledApplications,
    ListExportImageTasks,
    ListTagsForResource,
    StartAppBlockBuilder,
    StartFleet,
    StartImageBuilder,
    StartSoftwareDeploymentToImageBuilder,
    StopAppBlockBuilder,
    StopFleet,
    StopImageBuilder,
    TagResource,
    UntagResource,
    UpdateAppBlockBuilder,
    UpdateApplication,
    UpdateDirectoryConfig,
    UpdateEntitlement,
    UpdateFleet,
    UpdateImagePermissions,
    UpdateStack,
    UpdateThemeForStack,
  },
  model,
} as const satisfies ServiceDefinition;

export default appstream;
