import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import greengrassModel from "../../../../test/vendor/aws-models/greengrass.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(greengrassModel);

const groupPrefix = "group:" as const;
const defPrefix = "def:" as const;
const defverPrefix = "defver:" as const;
const deployPrefix = "deploy:" as const;
const bulkDeployPrefix = "bulkdeploy:" as const;
const groupverPrefix = "groupver:" as const;
const groupcertPrefix = "groupcert:" as const;
const roleGroupPrefix = "role:group:" as const;
const serviceroleKey = "servicerole" as const;
const connectivityPrefix = "connectivity:" as const;
const runtimeconfigPrefix = "runtimeconfig:" as const;
const tagsPrefix = "tags:" as const;

type StoredGroup = {
  id: string;
  arn: string;
  name: string;
  creationTimestamp: string;
  lastUpdatedTimestamp: string;
  latestVersion: string;
  latestVersionArn: string;
};

type StoredDefinition = {
  id: string;
  arn: string;
  name: string;
  creationTimestamp: string;
  lastUpdatedTimestamp: string;
  latestVersion: string | undefined;
  latestVersionArn: string | undefined;
};

type StoredDefinitionVersion = {
  id: string;
  arn: string;
  creationTimestamp: string;
  version: string;
  definition: unknown;
};

type StoredDeployment = {
  deploymentId: string;
  groupId: string;
  creationTimestamp: string;
  deploymentStatus: string;
  deploymentType: string;
  groupArn: string;
};

type StoredBulkDeployment = {
  bulkDeploymentId: string;
  bulkDeploymentArn: string;
  creationTimestamp: string;
  lastUpdatedTimestamp: string;
  status: string;
};

type StoredGroupVersion = {
  id: string;
  arn: string;
  creationTimestamp: string;
  version: string;
  definition: unknown;
};

type StoredGroupCertificateAuthority = {
  certificateAuthorityId: string;
  certificateAuthorityArn: string;
  creationTimestamp: string;
  pemEncodedCertificate: string;
};

type StoredRole = {
  roleArn: string;
  associatedAt: string;
};

type StoredServiceRole = {
  roleArn: string;
  associatedAt: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const randomId = (): string =>
  Array.from({ length: 36 }, (_, i) =>
    i === 8 || i === 13 || i === 18 || i === 23
      ? "-"
      : "0123456789abcdef".charAt(Math.floor(Math.random() * 16)),
  ).join("");

const groupKey = (id: string): string => `${groupPrefix}${id}`;
const defKey = (type: string, id: string): string =>
  `${defPrefix}${type}:${id}`;
const defverKey = (type: string, defId: string, verId: string): string =>
  `${defverPrefix}${type}:${defId}:${verId}`;
const deployKey = (groupId: string, deployId: string): string =>
  `${deployPrefix}${groupId}:${deployId}`;
const bulkDeployKey = (id: string): string => `${bulkDeployPrefix}${id}`;
const groupverKey = (groupId: string, verId: string): string =>
  `${groupverPrefix}${groupId}:${verId}`;
const groupcertKey = (groupId: string, certId: string): string =>
  `${groupcertPrefix}${groupId}:${certId}`;
const roleKey = (groupId: string): string => `${roleGroupPrefix}${groupId}`;
const connectivityKey = (thingName: string): string =>
  `${connectivityPrefix}${thingName}`;
const runtimeconfigKey = (thingName: string): string =>
  `${runtimeconfigPrefix}${thingName}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const greengrassArn = (ctx: ServiceContext, path: string): string =>
  `arn:aws:greengrass:${ctx.region}:${ctx.account}:${path}`;

const groupArn = (ctx: ServiceContext, id: string): string =>
  greengrassArn(ctx, `/greengrass/groups/${id}`);

const defArn = (ctx: ServiceContext, type: string, id: string): string =>
  greengrassArn(ctx, `/greengrass/definition/${type}/${id}`);

const defverArn = (
  ctx: ServiceContext,
  type: string,
  defId: string,
  verId: string,
): string =>
  greengrassArn(
    ctx,
    `/greengrass/definition/${type}/${defId}/versions/${verId}`,
  );

const groupverArn = (
  ctx: ServiceContext,
  groupId: string,
  verId: string,
): string =>
  greengrassArn(ctx, `/greengrass/groups/${groupId}/versions/${verId}`);

const groupView = (group: StoredGroup): Record<string, unknown> => ({
  Id: group.id,
  Arn: group.arn,
  Name: group.name,
  CreationTimestamp: group.creationTimestamp,
  LastUpdatedTimestamp: group.lastUpdatedTimestamp,
  LatestVersion: group.latestVersion,
  LatestVersionArn: group.latestVersionArn,
});

const defView = (d: StoredDefinition): Record<string, unknown> => ({
  Id: d.id,
  Arn: d.arn,
  Name: d.name,
  CreationTimestamp: d.creationTimestamp,
  LastUpdatedTimestamp: d.lastUpdatedTimestamp,
  LatestVersion: d.latestVersion,
  LatestVersionArn: d.latestVersionArn,
});

const defverView = (
  v: StoredDefinitionVersion,
  defId: string,
): Record<string, unknown> => ({
  Id: defId,
  Arn: v.arn,
  CreationTimestamp: v.creationTimestamp,
  Version: v.version,
  Definition: v.definition,
});

const requireGroup = (ctx: ServiceContext, id: string): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(groupKey(id));
  if (group === undefined) {
    throw awsError("BadRequestException", `Group ${id} not found.`, 400);
  }
  return group;
};

const requireDef = (
  ctx: ServiceContext,
  type: string,
  id: string,
): StoredDefinition => {
  const def = ctx.store.get<StoredDefinition>(defKey(type, id));
  if (def === undefined) {
    throw awsError(
      "BadRequestException",
      `${type} definition ${id} not found.`,
      400,
    );
  }
  return def;
};

const makeDefOps = (
  urlType: string,
  idField: string,
  verIdField: string,
): {
  createDef: OperationHandler;
  createDefVersion: OperationHandler;
  getDef: OperationHandler;
  getDefVersion: OperationHandler;
  listDefs: OperationHandler;
  listDefVersions: OperationHandler;
  updateDef: OperationHandler;
  deleteDef: OperationHandler;
} => {
  const createDef: OperationHandler = (input, ctx) => {
    const id = randomId();
    const now = new Date().toISOString();
    const def: StoredDefinition = {
      id,
      arn: defArn(ctx, urlType, id),
      name: stringOrUndefined(input["Name"]) ?? "",
      creationTimestamp: now,
      lastUpdatedTimestamp: now,
      latestVersion: undefined,
      latestVersionArn: undefined,
    };
    const initialVersion = input["InitialVersion"];
    if (initialVersion !== null && initialVersion !== undefined) {
      const verId = randomId();
      const ver: StoredDefinitionVersion = {
        id: verId,
        arn: defverArn(ctx, urlType, id, verId),
        creationTimestamp: now,
        version: verId,
        definition: initialVersion,
      };
      ctx.store.set(defverKey(urlType, id, verId), ver);
      def.latestVersion = verId;
      def.latestVersionArn = ver.arn;
    }
    ctx.store.set(defKey(urlType, id), def);
    return defView(def);
  };

  const createDefVersion: OperationHandler = (input, ctx) => {
    const defId = requireString(input, idField);
    const def = requireDef(ctx, urlType, defId);
    const verId = randomId();
    const now = new Date().toISOString();
    const ver: StoredDefinitionVersion = {
      id: verId,
      arn: defverArn(ctx, urlType, defId, verId),
      creationTimestamp: now,
      version: verId,
      definition: input,
    };
    ctx.store.set(defverKey(urlType, defId, verId), ver);
    def.latestVersion = verId;
    def.latestVersionArn = ver.arn;
    def.lastUpdatedTimestamp = now;
    ctx.store.set(defKey(urlType, defId), def);
    return {
      Arn: ver.arn,
      CreationTimestamp: ver.creationTimestamp,
      Id: defId,
      Version: verId,
    };
  };

  const getDef: OperationHandler = (input, ctx) => {
    const id = requireString(input, idField);
    return defView(requireDef(ctx, urlType, id));
  };

  const getDefVersion: OperationHandler = (input, ctx) => {
    const defId = requireString(input, idField);
    requireDef(ctx, urlType, defId);
    const verId = requireString(input, verIdField);
    const ver = ctx.store.get<StoredDefinitionVersion>(
      defverKey(urlType, defId, verId),
    );
    if (ver === undefined) {
      throw awsError("BadRequestException", `Version ${verId} not found.`, 400);
    }
    return defverView(ver, defId);
  };

  const listDefs: OperationHandler = (_input, ctx) => {
    const defs = ctx.store
      .list<StoredDefinition>()
      .filter((e) => e.key.startsWith(`${defPrefix}${urlType}:`))
      .map((e) => e.value)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { Definitions: defs.map(defView) };
  };

  const listDefVersions: OperationHandler = (input, ctx) => {
    const defId = requireString(input, idField);
    requireDef(ctx, urlType, defId);
    const versions = ctx.store
      .list<StoredDefinitionVersion>()
      .filter((e) => e.key.startsWith(`${defverPrefix}${urlType}:${defId}:`))
      .map((e) => e.value)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { Versions: versions.map((v) => defverView(v, defId)) };
  };

  const updateDef: OperationHandler = (input, ctx) => {
    const id = requireString(input, idField);
    const def = requireDef(ctx, urlType, id);
    const name = stringOrUndefined(input["Name"]);
    if (name !== undefined) def.name = name;
    def.lastUpdatedTimestamp = new Date().toISOString();
    ctx.store.set(defKey(urlType, id), def);
    return {};
  };

  const deleteDef: OperationHandler = (input, ctx) => {
    const id = requireString(input, idField);
    requireDef(ctx, urlType, id);
    ctx.store.delete(defKey(urlType, id));
    return {};
  };

  return {
    createDef,
    createDefVersion,
    getDef,
    getDefVersion,
    listDefs,
    listDefVersions,
    updateDef,
    deleteDef,
  };
};

const {
  createDef: CreateConnectorDefinition,
  createDefVersion: CreateConnectorDefinitionVersion,
  getDef: GetConnectorDefinition,
  getDefVersion: GetConnectorDefinitionVersion,
  listDefs: ListConnectorDefinitions,
  listDefVersions: ListConnectorDefinitionVersions,
  updateDef: UpdateConnectorDefinition,
  deleteDef: DeleteConnectorDefinition,
} = makeDefOps(
  "connectors",
  "ConnectorDefinitionId",
  "ConnectorDefinitionVersionId",
);

const {
  createDef: CreateCoreDefinition,
  createDefVersion: CreateCoreDefinitionVersion,
  getDef: GetCoreDefinition,
  getDefVersion: GetCoreDefinitionVersion,
  listDefs: ListCoreDefinitions,
  listDefVersions: ListCoreDefinitionVersions,
  updateDef: UpdateCoreDefinition,
  deleteDef: DeleteCoreDefinition,
} = makeDefOps("cores", "CoreDefinitionId", "CoreDefinitionVersionId");

const {
  createDef: CreateDeviceDefinition,
  createDefVersion: CreateDeviceDefinitionVersion,
  getDef: GetDeviceDefinition,
  getDefVersion: GetDeviceDefinitionVersion,
  listDefs: ListDeviceDefinitions,
  listDefVersions: ListDeviceDefinitionVersions,
  updateDef: UpdateDeviceDefinition,
  deleteDef: DeleteDeviceDefinition,
} = makeDefOps("devices", "DeviceDefinitionId", "DeviceDefinitionVersionId");

const {
  createDef: CreateFunctionDefinition,
  createDefVersion: CreateFunctionDefinitionVersion,
  getDef: GetFunctionDefinition,
  getDefVersion: GetFunctionDefinitionVersion,
  listDefs: ListFunctionDefinitions,
  listDefVersions: ListFunctionDefinitionVersions,
  updateDef: UpdateFunctionDefinition,
  deleteDef: DeleteFunctionDefinition,
} = makeDefOps(
  "functions",
  "FunctionDefinitionId",
  "FunctionDefinitionVersionId",
);

const {
  createDef: CreateLoggerDefinition,
  createDefVersion: CreateLoggerDefinitionVersion,
  getDef: GetLoggerDefinition,
  getDefVersion: GetLoggerDefinitionVersion,
  listDefs: ListLoggerDefinitions,
  listDefVersions: ListLoggerDefinitionVersions,
  updateDef: UpdateLoggerDefinition,
  deleteDef: DeleteLoggerDefinition,
} = makeDefOps("loggers", "LoggerDefinitionId", "LoggerDefinitionVersionId");

const {
  createDef: CreateResourceDefinition,
  createDefVersion: CreateResourceDefinitionVersion,
  getDef: GetResourceDefinition,
  getDefVersion: GetResourceDefinitionVersion,
  listDefs: ListResourceDefinitions,
  listDefVersions: ListResourceDefinitionVersions,
  updateDef: UpdateResourceDefinition,
  deleteDef: DeleteResourceDefinition,
} = makeDefOps(
  "resources",
  "ResourceDefinitionId",
  "ResourceDefinitionVersionId",
);

const {
  createDef: CreateSubscriptionDefinition,
  createDefVersion: CreateSubscriptionDefinitionVersion,
  getDef: GetSubscriptionDefinition,
  getDefVersion: GetSubscriptionDefinitionVersion,
  listDefs: ListSubscriptionDefinitions,
  listDefVersions: ListSubscriptionDefinitionVersions,
  updateDef: UpdateSubscriptionDefinition,
  deleteDef: DeleteSubscriptionDefinition,
} = makeDefOps(
  "subscriptions",
  "SubscriptionDefinitionId",
  "SubscriptionDefinitionVersionId",
);

const CreateGroup: OperationHandler = (input, ctx) => {
  const id = randomId();
  const now = new Date().toISOString();
  const versionId = randomId();
  const group: StoredGroup = {
    id,
    arn: groupArn(ctx, id),
    name: requireString(input, "Name"),
    creationTimestamp: now,
    lastUpdatedTimestamp: now,
    latestVersion: versionId,
    latestVersionArn: `${groupArn(ctx, id)}/versions/${versionId}`,
  };
  ctx.store.set(groupKey(id), group);
  return groupView(group);
};

const GetGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GroupId");
  return groupView(requireGroup(ctx, id));
};

const ListGroups: OperationHandler = (_input, ctx) => {
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((entry) => entry.key.startsWith(groupPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { Groups: groups.map(groupView) };
};

const DeleteGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GroupId");
  requireGroup(ctx, id);
  ctx.store.delete(groupKey(id));
  return {};
};

const UpdateGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GroupId");
  const group = requireGroup(ctx, id);
  const name = stringOrUndefined(input["Name"]);
  if (name !== undefined) group.name = name;
  group.lastUpdatedTimestamp = new Date().toISOString();
  ctx.store.set(groupKey(id), group);
  return {};
};

const AssociateRoleToGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const roleArn = requireString(input, "RoleArn");
  const now = new Date().toISOString();
  const role: StoredRole = { roleArn, associatedAt: now };
  ctx.store.set(roleKey(groupId), role);
  return { AssociatedAt: now };
};

const GetAssociatedRole: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const role = ctx.store.get<StoredRole>(roleKey(groupId));
  if (role === undefined) {
    throw awsError(
      "BadRequestException",
      `No role associated with group ${groupId}.`,
      400,
    );
  }
  return { AssociatedAt: role.associatedAt, RoleArn: role.roleArn };
};

const DisassociateRoleFromGroup: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const disassociatedAt = new Date().toISOString();
  ctx.store.delete(roleKey(groupId));
  return { DisassociatedAt: disassociatedAt };
};

const AssociateServiceRoleToAccount: OperationHandler = (input, ctx) => {
  const roleArn = requireString(input, "RoleArn");
  const now = new Date().toISOString();
  const serviceRole: StoredServiceRole = { roleArn, associatedAt: now };
  ctx.store.set(serviceroleKey, serviceRole);
  return { AssociatedAt: now };
};

const GetServiceRoleForAccount: OperationHandler = (_input, ctx) => {
  const serviceRole = ctx.store.get<StoredServiceRole>(serviceroleKey);
  if (serviceRole === undefined) {
    throw awsError(
      "BadRequestException",
      "No service role associated with account.",
      400,
    );
  }
  return {
    AssociatedAt: serviceRole.associatedAt,
    RoleArn: serviceRole.roleArn,
  };
};

const DisassociateServiceRoleFromAccount: OperationHandler = (_input, ctx) => {
  const disassociatedAt = new Date().toISOString();
  ctx.store.delete(serviceroleKey);
  return { DisassociatedAt: disassociatedAt };
};

const CreateGroupVersion: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const verId = randomId();
  const now = new Date().toISOString();
  const arn = groupverArn(ctx, groupId, verId);
  const groupVer: StoredGroupVersion = {
    id: verId,
    arn,
    creationTimestamp: now,
    version: verId,
    definition: input,
  };
  ctx.store.set(groupverKey(groupId, verId), groupVer);
  const group = requireGroup(ctx, groupId);
  group.latestVersion = verId;
  group.latestVersionArn = arn;
  group.lastUpdatedTimestamp = now;
  ctx.store.set(groupKey(groupId), group);
  return { Arn: arn, CreationTimestamp: now, Id: groupId, Version: verId };
};

const GetGroupVersion: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const verId = requireString(input, "GroupVersionId");
  const ver = ctx.store.get<StoredGroupVersion>(groupverKey(groupId, verId));
  if (ver === undefined) {
    throw awsError(
      "BadRequestException",
      `Group version ${verId} not found.`,
      400,
    );
  }
  return {
    Arn: ver.arn,
    CreationTimestamp: ver.creationTimestamp,
    Definition: ver.definition,
    Id: groupId,
    Version: ver.version,
  };
};

const ListGroupVersions: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const versions = ctx.store
    .list<StoredGroupVersion>()
    .filter((e) => e.key.startsWith(`${groupverPrefix}${groupId}:`))
    .map((e) => e.value)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    Versions: versions.map((v) => ({
      Arn: v.arn,
      CreationTimestamp: v.creationTimestamp,
      Id: groupId,
      Version: v.version,
    })),
  };
};

const CreateDeployment: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const deploymentId = randomId();
  const now = new Date().toISOString();
  const deployment: StoredDeployment = {
    deploymentId,
    groupId,
    creationTimestamp: now,
    deploymentStatus: "InProgress",
    deploymentType:
      (stringOrUndefined(input["DeploymentType"]) as string) ?? "NewDeployment",
    groupArn: groupArn(ctx, groupId),
  };
  ctx.store.set(deployKey(groupId, deploymentId), deployment);
  return {
    DeploymentArn: `${groupArn(ctx, groupId)}/deployments/${deploymentId}`,
    DeploymentId: deploymentId,
  };
};

const GetDeploymentStatus: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  const deploymentId = requireString(input, "DeploymentId");
  const deployment = ctx.store.get<StoredDeployment>(
    deployKey(groupId, deploymentId),
  );
  if (deployment === undefined) {
    throw awsError(
      "BadRequestException",
      `Deployment ${deploymentId} not found.`,
      400,
    );
  }
  return {
    DeploymentStatus: deployment.deploymentStatus,
    DeploymentType: deployment.deploymentType,
    UpdatedAt: deployment.creationTimestamp,
  };
};

const ListDeployments: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const deployments = ctx.store
    .list<StoredDeployment>()
    .filter((e) => e.key.startsWith(`${deployPrefix}${groupId}:`))
    .map((e) => e.value)
    .sort((a, b) =>
      a.deploymentId < b.deploymentId
        ? -1
        : a.deploymentId > b.deploymentId
          ? 1
          : 0,
    );
  return {
    Deployments: deployments.map((d) => ({
      CreatedAt: d.creationTimestamp,
      DeploymentArn: `${d.groupArn}/deployments/${d.deploymentId}`,
      DeploymentId: d.deploymentId,
      DeploymentType: d.deploymentType,
      GroupArn: d.groupArn,
    })),
  };
};

const ResetDeployments: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const deploymentId = randomId();
  const now = new Date().toISOString();
  const deployment: StoredDeployment = {
    deploymentId,
    groupId,
    creationTimestamp: now,
    deploymentStatus: "InProgress",
    deploymentType: "Reset",
    groupArn: groupArn(ctx, groupId),
  };
  ctx.store.set(deployKey(groupId, deploymentId), deployment);
  return {
    DeploymentArn: `${groupArn(ctx, groupId)}/deployments/${deploymentId}`,
    DeploymentId: deploymentId,
  };
};

const CreateGroupCertificateAuthority: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const certId = randomId();
  const certArn = greengrassArn(
    ctx,
    `/greengrass/groups/${groupId}/certificateauthorities/${certId}`,
  );
  const cert: StoredGroupCertificateAuthority = {
    certificateAuthorityId: certId,
    certificateAuthorityArn: certArn,
    creationTimestamp: new Date().toISOString(),
    pemEncodedCertificate: `-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${certId.replace(/-/g, "")}\n-----END CERTIFICATE-----\n`,
  };
  ctx.store.set(groupcertKey(groupId, certId), cert);
  return { CertificateAuthorityArn: certArn };
};

const GetGroupCertificateAuthority: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const certId = requireString(input, "CertificateAuthorityId");
  const cert = ctx.store.get<StoredGroupCertificateAuthority>(
    groupcertKey(groupId, certId),
  );
  if (cert === undefined) {
    throw awsError(
      "BadRequestException",
      `Certificate authority ${certId} not found.`,
      400,
    );
  }
  return {
    GroupCertificateAuthorityArn: cert.certificateAuthorityArn,
    GroupCertificateAuthorityId: cert.certificateAuthorityId,
    PemEncodedCertificate: cert.pemEncodedCertificate,
  };
};

const ListGroupCertificateAuthorities: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const certs = ctx.store
    .list<StoredGroupCertificateAuthority>()
    .filter((e) => e.key.startsWith(`${groupcertPrefix}${groupId}:`))
    .map((e) => e.value);
  return {
    GroupCertificateAuthorities: certs.map((c) => ({
      GroupCertificateAuthorityArn: c.certificateAuthorityArn,
      GroupCertificateAuthorityId: c.certificateAuthorityId,
    })),
  };
};

const GetGroupCertificateConfiguration: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const configKey = `certconfig:${groupId}`;
  const config = ctx.store.get<Record<string, unknown>>(configKey) ?? {
    CertificateExpiryInMilliseconds: "604800000",
    CertificateAuthorityExpiryInMilliseconds: "2524607999000",
  };
  return { ...config, GroupId: groupId };
};

const UpdateGroupCertificateConfiguration: OperationHandler = (input, ctx) => {
  const groupId = requireString(input, "GroupId");
  requireGroup(ctx, groupId);
  const configKey = `certconfig:${groupId}`;
  const existing = ctx.store.get<Record<string, unknown>>(configKey) ?? {};
  const updated = { ...existing };
  const expiry = stringOrUndefined(input["CertificateExpiryInMilliseconds"]);
  if (expiry !== undefined) updated["CertificateExpiryInMilliseconds"] = expiry;
  ctx.store.set(configKey, updated);
  return {
    ...updated,
    GroupId: groupId,
  };
};

const CreateSoftwareUpdateJob: OperationHandler = (input, ctx) => {
  const jobId = randomId();
  const jobArn = greengrassArn(ctx, `/greengrass/updates/${jobId}`);
  return {
    IotJobArn: jobArn,
    IotJobId: jobId,
    PlatformSoftwareVersion: "1.0.0",
  };
};

const StartBulkDeployment: OperationHandler = (input, ctx) => {
  const bulkDeployId = randomId();
  const now = new Date().toISOString();
  const bulkDeployArn = greengrassArn(
    ctx,
    `/greengrass/bulk/deployments/${bulkDeployId}`,
  );
  const bulk: StoredBulkDeployment = {
    bulkDeploymentId: bulkDeployId,
    bulkDeploymentArn: bulkDeployArn,
    creationTimestamp: now,
    lastUpdatedTimestamp: now,
    status: "Running",
  };
  ctx.store.set(bulkDeployKey(bulkDeployId), bulk);
  return { BulkDeploymentArn: bulkDeployArn, BulkDeploymentId: bulkDeployId };
};

const StopBulkDeployment: OperationHandler = (input, ctx) => {
  const bulkDeployId = requireString(input, "BulkDeploymentId");
  const bulk = ctx.store.get<StoredBulkDeployment>(bulkDeployKey(bulkDeployId));
  if (bulk === undefined) {
    throw awsError(
      "BadRequestException",
      `Bulk deployment ${bulkDeployId} not found.`,
      400,
    );
  }
  bulk.status = "Stopping";
  bulk.lastUpdatedTimestamp = new Date().toISOString();
  ctx.store.set(bulkDeployKey(bulkDeployId), bulk);
  return {};
};

const GetBulkDeploymentStatus: OperationHandler = (input, ctx) => {
  const bulkDeployId = requireString(input, "BulkDeploymentId");
  const bulk = ctx.store.get<StoredBulkDeployment>(bulkDeployKey(bulkDeployId));
  if (bulk === undefined) {
    throw awsError(
      "BadRequestException",
      `Bulk deployment ${bulkDeployId} not found.`,
      400,
    );
  }
  return {
    BulkDeploymentStatus: bulk.status,
    CreatedAt: bulk.creationTimestamp,
    Statistics: {
      InvalidInputRecords: 0,
      RecordsProcessed: 0,
      RetryAttempts: 0,
    },
  };
};

const ListBulkDeployments: OperationHandler = (_input, ctx) => {
  const bulks = ctx.store
    .list<StoredBulkDeployment>()
    .filter((e) => e.key.startsWith(bulkDeployPrefix))
    .map((e) => e.value)
    .sort((a, b) =>
      a.bulkDeploymentId < b.bulkDeploymentId
        ? -1
        : a.bulkDeploymentId > b.bulkDeploymentId
          ? 1
          : 0,
    );
  return {
    BulkDeployments: bulks.map((b) => ({
      BulkDeploymentArn: b.bulkDeploymentArn,
      BulkDeploymentId: b.bulkDeploymentId,
      BulkDeploymentStatus: b.status,
      CreatedAt: b.creationTimestamp,
    })),
  };
};

const ListBulkDeploymentDetailedReports: OperationHandler = (input, ctx) => {
  const bulkDeployId = requireString(input, "BulkDeploymentId");
  const bulk = ctx.store.get<StoredBulkDeployment>(bulkDeployKey(bulkDeployId));
  if (bulk === undefined) {
    throw awsError(
      "BadRequestException",
      `Bulk deployment ${bulkDeployId} not found.`,
      400,
    );
  }
  return { Deployments: [] };
};

const GetConnectivityInfo: OperationHandler = (input, ctx) => {
  const thingName = requireString(input, "ThingName");
  const info = ctx.store.get<unknown[]>(connectivityKey(thingName)) ?? [];
  return { ConnectivityInfo: info };
};

const UpdateConnectivityInfo: OperationHandler = (input, ctx) => {
  const thingName = requireString(input, "ThingName");
  const info = input["ConnectivityInfo"] ?? [];
  ctx.store.set(connectivityKey(thingName), info);
  return { Message: "ConnectivityInfo updated successfully.", Version: "1" };
};

const GetThingRuntimeConfiguration: OperationHandler = (input, ctx) => {
  const thingName = requireString(input, "ThingName");
  const config = ctx.store.get<unknown>(runtimeconfigKey(thingName)) ?? {};
  return { RuntimeConfiguration: config };
};

const UpdateThingRuntimeConfiguration: OperationHandler = (input, ctx) => {
  const thingName = requireString(input, "ThingName");
  const config = input["RuntimeConfiguration"] ?? {};
  ctx.store.set(runtimeconfigKey(thingName), config);
  return {};
};

const ListTagsForResource: OperationHandler = (input, _ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const store = _ctx.store;
  const tags = store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = (input["tags"] ?? {}) as Record<string, string>;
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = (input["TagKeys"] ?? []) as string[];
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const defUrlTypes: Record<string, string> = {
  connectors: "Connector",
  cores: "Core",
  devices: "Device",
  functions: "Function",
  loggers: "Logger",
  resources: "Resource",
  subscriptions: "Subscription",
} as const;

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const resolveDefinitionOperation = (
  parts: string[],
  method: string,
): string | undefined => {
  const urlType = parts[2];
  const typeName = defUrlTypes[urlType];
  if (typeName === undefined) return undefined;

  if (parts.length === 3) {
    if (method === "POST") return `Create${typeName}Definition`;
    if (method === "GET") return `List${typeName}Definitions`;
    return undefined;
  }
  if (parts.length === 4) {
    if (method === "GET") return `Get${typeName}Definition`;
    if (method === "DELETE") return `Delete${typeName}Definition`;
    if (method === "PUT") return `Update${typeName}Definition`;
    return undefined;
  }
  if (parts.length === 5 && parts[4] === "versions") {
    if (method === "POST") return `Create${typeName}DefinitionVersion`;
    if (method === "GET") return `List${typeName}DefinitionVersions`;
    return undefined;
  }
  if (parts.length === 6 && parts[4] === "versions") {
    if (method === "GET") return `Get${typeName}DefinitionVersion`;
    return undefined;
  }
  return undefined;
};

const resolveGroupOperation = (
  parts: string[],
  method: string,
): string | undefined => {
  if (parts.length === 2) {
    if (method === "POST") return "CreateGroup";
    if (method === "GET") return "ListGroups";
    return undefined;
  }
  if (parts.length === 3) {
    if (method === "GET") return "GetGroup";
    if (method === "DELETE") return "DeleteGroup";
    if (method === "PUT") return "UpdateGroup";
    return undefined;
  }
  const sub = parts[3];
  if (sub === "role") {
    if (method === "PUT") return "AssociateRoleToGroup";
    if (method === "GET") return "GetAssociatedRole";
    if (method === "DELETE") return "DisassociateRoleFromGroup";
    return undefined;
  }
  if (sub === "deployments") {
    if (parts.length === 4) {
      if (method === "POST") return "CreateDeployment";
      if (method === "GET") return "ListDeployments";
      return undefined;
    }
    if (parts[4] === "$reset" && method === "POST") return "ResetDeployments";
    if (parts.length === 6 && parts[5] === "status" && method === "GET")
      return "GetDeploymentStatus";
    return undefined;
  }
  if (sub === "certificateauthorities") {
    if (parts.length === 4) {
      if (method === "POST") return "CreateGroupCertificateAuthority";
      if (method === "GET") return "ListGroupCertificateAuthorities";
      return undefined;
    }
    if (
      parts.length === 6 &&
      parts[4] === "configuration" &&
      parts[5] === "expiry"
    ) {
      if (method === "GET") return "GetGroupCertificateConfiguration";
      if (method === "PUT") return "UpdateGroupCertificateConfiguration";
      return undefined;
    }
    if (parts.length === 5) {
      if (method === "GET") return "GetGroupCertificateAuthority";
      return undefined;
    }
    return undefined;
  }
  if (sub === "versions") {
    if (parts.length === 4) {
      if (method === "POST") return "CreateGroupVersion";
      if (method === "GET") return "ListGroupVersions";
      return undefined;
    }
    if (parts.length === 5 && method === "GET") return "GetGroupVersion";
    return undefined;
  }
  return undefined;
};

const greengrass = {
  name: "greengrass",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "tags") {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }
    if (parts[0] !== "greengrass") return undefined;
    if (parts[1] === "servicerole") {
      if (req.method === "PUT") return "AssociateServiceRoleToAccount";
      if (req.method === "GET") return "GetServiceRoleForAccount";
      if (req.method === "DELETE") return "DisassociateServiceRoleFromAccount";
      return undefined;
    }
    if (parts[1] === "updates" && req.method === "POST")
      return "CreateSoftwareUpdateJob";
    if (parts[1] === "bulk" && parts[2] === "deployments") {
      if (parts.length === 3) {
        if (req.method === "POST") return "StartBulkDeployment";
        if (req.method === "GET") return "ListBulkDeployments";
        return undefined;
      }
      if (parts[4] === "$stop" && req.method === "PUT")
        return "StopBulkDeployment";
      if (parts[4] === "status" && req.method === "GET")
        return "GetBulkDeploymentStatus";
      if (parts[4] === "detailed-reports" && req.method === "GET")
        return "ListBulkDeploymentDetailedReports";
      return undefined;
    }
    if (parts[1] === "things") {
      if (parts[3] === "connectivityInfo") {
        if (req.method === "GET") return "GetConnectivityInfo";
        if (req.method === "PUT") return "UpdateConnectivityInfo";
        return undefined;
      }
      if (parts[3] === "runtimeconfig") {
        if (req.method === "GET") return "GetThingRuntimeConfiguration";
        if (req.method === "PUT") return "UpdateThingRuntimeConfiguration";
        return undefined;
      }
      return undefined;
    }
    if (parts[1] === "definition")
      return resolveDefinitionOperation(parts, req.method);
    if (parts[1] === "groups") return resolveGroupOperation(parts, req.method);
    return undefined;
  },
  operations: {
    CreateGroup,
    GetGroup,
    ListGroups,
    DeleteGroup,
    UpdateGroup,
    AssociateRoleToGroup,
    GetAssociatedRole,
    DisassociateRoleFromGroup,
    AssociateServiceRoleToAccount,
    GetServiceRoleForAccount,
    DisassociateServiceRoleFromAccount,
    CreateGroupVersion,
    GetGroupVersion,
    ListGroupVersions,
    CreateDeployment,
    GetDeploymentStatus,
    ListDeployments,
    ResetDeployments,
    CreateGroupCertificateAuthority,
    GetGroupCertificateAuthority,
    ListGroupCertificateAuthorities,
    GetGroupCertificateConfiguration,
    UpdateGroupCertificateConfiguration,
    CreateSoftwareUpdateJob,
    StartBulkDeployment,
    StopBulkDeployment,
    GetBulkDeploymentStatus,
    ListBulkDeployments,
    ListBulkDeploymentDetailedReports,
    GetConnectivityInfo,
    UpdateConnectivityInfo,
    GetThingRuntimeConfiguration,
    UpdateThingRuntimeConfiguration,
    ListTagsForResource,
    TagResource,
    UntagResource,
    CreateConnectorDefinition,
    CreateConnectorDefinitionVersion,
    GetConnectorDefinition,
    GetConnectorDefinitionVersion,
    ListConnectorDefinitions,
    ListConnectorDefinitionVersions,
    UpdateConnectorDefinition,
    DeleteConnectorDefinition,
    CreateCoreDefinition,
    CreateCoreDefinitionVersion,
    GetCoreDefinition,
    GetCoreDefinitionVersion,
    ListCoreDefinitions,
    ListCoreDefinitionVersions,
    UpdateCoreDefinition,
    DeleteCoreDefinition,
    CreateDeviceDefinition,
    CreateDeviceDefinitionVersion,
    GetDeviceDefinition,
    GetDeviceDefinitionVersion,
    ListDeviceDefinitions,
    ListDeviceDefinitionVersions,
    UpdateDeviceDefinition,
    DeleteDeviceDefinition,
    CreateFunctionDefinition,
    CreateFunctionDefinitionVersion,
    GetFunctionDefinition,
    GetFunctionDefinitionVersion,
    ListFunctionDefinitions,
    ListFunctionDefinitionVersions,
    UpdateFunctionDefinition,
    DeleteFunctionDefinition,
    CreateLoggerDefinition,
    CreateLoggerDefinitionVersion,
    GetLoggerDefinition,
    GetLoggerDefinitionVersion,
    ListLoggerDefinitions,
    ListLoggerDefinitionVersions,
    UpdateLoggerDefinition,
    DeleteLoggerDefinition,
    CreateResourceDefinition,
    CreateResourceDefinitionVersion,
    GetResourceDefinition,
    GetResourceDefinitionVersion,
    ListResourceDefinitions,
    ListResourceDefinitionVersions,
    UpdateResourceDefinition,
    DeleteResourceDefinition,
    CreateSubscriptionDefinition,
    CreateSubscriptionDefinitionVersion,
    GetSubscriptionDefinition,
    GetSubscriptionDefinitionVersion,
    ListSubscriptionDefinitions,
    ListSubscriptionDefinitionVersions,
    UpdateSubscriptionDefinition,
    DeleteSubscriptionDefinition,
  },
  model,
} as const satisfies ServiceDefinition;

export default greengrass;
