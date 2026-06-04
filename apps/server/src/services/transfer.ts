import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import transferModel from "../../../../test/vendor/aws-models/transfer.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(transferModel);

type StoredUser = {
  Arn: string;
  HomeDirectory: string | undefined;
  HomeDirectoryType: string | undefined;
  HomeDirectoryMappings: unknown[];
  Policy: string | undefined;
  PosixProfile: unknown;
  Role: string;
  SshPublicKeys: {
    SshPublicKeyId: string;
    SshPublicKeyBody: string;
    DateImported: number;
  }[];
  Tags: unknown[];
  UserName: string;
};

type StoredServer = {
  Arn: string;
  ServerId: string;
  State: string;
  Domain: string;
  EndpointType: string;
  IdentityProviderType: string;
  LoggingRole: string | undefined;
  Protocols: unknown[];
  Certificate: string | undefined;
  SecurityPolicyName: string;
  Tags: unknown[];
  users: Record<string, StoredUser>;
  hostKeys: Record<string, StoredHostKey>;
  accesses: Record<string, StoredAccess>;
  agreements: Record<string, StoredAgreement>;
};

type StoredAccess = {
  ExternalId: string;
  HomeDirectory: string | undefined;
  HomeDirectoryType: string | undefined;
  HomeDirectoryMappings: unknown[];
  Policy: string | undefined;
  PosixProfile: unknown;
  Role: string | undefined;
};

type StoredAgreement = {
  Arn: string;
  AgreementId: string;
  ServerId: string;
  Description: string | undefined;
  Status: string;
  LocalProfileId: string;
  PartnerProfileId: string;
  BaseDirectory: string | undefined;
  AccessRole: string;
  Tags: unknown[];
  PreserveFilename: string | undefined;
  EnforceMessageSigning: string | undefined;
  CustomDirectories: unknown | undefined;
};

type StoredConnector = {
  Arn: string;
  ConnectorId: string;
  Url: string | undefined;
  As2Config: unknown | undefined;
  AccessRole: string;
  LoggingRole: string | undefined;
  Tags: unknown[];
  SftpConfig: unknown | undefined;
  SecurityPolicyName: string | undefined;
  EgressConfig: unknown | undefined;
  IpAddressType: string | undefined;
};

type StoredProfile = {
  Arn: string;
  ProfileId: string;
  As2Id: string;
  ProfileType: string;
  CertificateIds: string[];
  Tags: unknown[];
};

type StoredWebApp = {
  Arn: string;
  WebAppId: string;
  IdentityProviderDetails: unknown;
  AccessEndpoint: string | undefined;
  WebAppUnits: unknown | undefined;
  Tags: unknown[];
  WebAppEndpointPolicy: string | undefined;
  EndpointDetails: unknown | undefined;
  customization: StoredWebAppCustomization | undefined;
};

type StoredWebAppCustomization = {
  Title: string | undefined;
  LogoFile: unknown | undefined;
  FaviconFile: unknown | undefined;
};

type StoredWorkflow = {
  Arn: string;
  WorkflowId: string;
  Description: string | undefined;
  Steps: unknown[];
  OnExceptionSteps: unknown[];
  Tags: unknown[];
};

type StoredCertificate = {
  Arn: string;
  CertificateId: string;
  Usage: string;
  Status: string;
  Certificate: string | undefined;
  CertificateChain: string | undefined;
  ActiveDate: number | undefined;
  InactiveDate: number | undefined;
  Description: string | undefined;
  Type: string;
  Tags: unknown[];
};

type StoredHostKey = {
  Arn: string;
  HostKeyId: string;
  ServerId: string;
  HostKeyBody: string;
  HostKeyFingerprint: string;
  Description: string | undefined;
  Type: string;
  DateImported: number;
  Tags: unknown[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const hex17 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 17);

const serverIdFromInput = (input: Record<string, unknown>): string => {
  const serverId = input["ServerId"];
  if (typeof serverId === "string" && serverId !== "") return serverId;
  throw awsError("InvalidRequestException", "ServerId is required.", 400);
};

const userNameFromInput = (input: Record<string, unknown>): string => {
  const userName = input["UserName"];
  if (typeof userName === "string" && userName !== "") return userName;
  throw awsError("InvalidRequestException", "UserName is required.", 400);
};

const requireServer = (ctx: ServiceContext, serverId: string): StoredServer => {
  const server = ctx.store.get<StoredServer>(serverId);
  if (server === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown server ${serverId}.`,
      400,
    );
  }
  return server;
};

const serverArn = (ctx: ServiceContext, serverId: string): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:server/${serverId}`;

const userArn = (
  ctx: ServiceContext,
  serverId: string,
  userName: string,
): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:user/${serverId}/${userName}`;

const agreementArn = (
  ctx: ServiceContext,
  serverId: string,
  agreementId: string,
): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:agreement/${serverId}/${agreementId}`;

const connectorArn = (ctx: ServiceContext, connectorId: string): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:connector/${connectorId}`;

const profileArn = (ctx: ServiceContext, profileId: string): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:profile/${profileId}`;

const webAppArn = (ctx: ServiceContext, webAppId: string): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:webapp/${webAppId}`;

const workflowArn = (ctx: ServiceContext, workflowId: string): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:workflow/${workflowId}`;

const certificateArn = (ctx: ServiceContext, certId: string): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:certificate/${certId}`;

const hostKeyArn = (
  ctx: ServiceContext,
  serverId: string,
  hostKeyId: string,
): string =>
  `arn:aws:transfer:${ctx.region}:${ctx.account}:host-key/${serverId}/${hostKeyId}`;

const connectorKey = (connectorId: string): string =>
  `connector/${connectorId}`;

const profileKey = (profileId: string): string => `profile/${profileId}`;

const webAppKey = (webAppId: string): string => `webapp/${webAppId}`;

const workflowKey = (workflowId: string): string => `workflow/${workflowId}`;

const certKey = (certId: string): string => `certificate/${certId}`;

const tagKey = (arn: string): string => `tag/${arn}`;

const requireConnector = (
  ctx: ServiceContext,
  connectorId: string,
): StoredConnector => {
  const c = ctx.store.get<StoredConnector>(connectorKey(connectorId));
  if (c === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown connector ${connectorId}.`,
      400,
    );
  }
  return c;
};

const requireProfile = (
  ctx: ServiceContext,
  profileId: string,
): StoredProfile => {
  const p = ctx.store.get<StoredProfile>(profileKey(profileId));
  if (p === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown profile ${profileId}.`,
      400,
    );
  }
  return p;
};

const requireWebApp = (ctx: ServiceContext, webAppId: string): StoredWebApp => {
  const w = ctx.store.get<StoredWebApp>(webAppKey(webAppId));
  if (w === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown web app ${webAppId}.`,
      400,
    );
  }
  return w;
};

const requireWorkflow = (
  ctx: ServiceContext,
  workflowId: string,
): StoredWorkflow => {
  const w = ctx.store.get<StoredWorkflow>(workflowKey(workflowId));
  if (w === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown workflow ${workflowId}.`,
      400,
    );
  }
  return w;
};

const requireCert = (
  ctx: ServiceContext,
  certId: string,
): StoredCertificate => {
  const c = ctx.store.get<StoredCertificate>(certKey(certId));
  if (c === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown certificate ${certId}.`,
      400,
    );
  }
  return c;
};

const requireUser = (server: StoredServer, userName: string): StoredUser => {
  const user = server.users[userName];
  if (user === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown user ${userName}.`,
      400,
    );
  }
  return user;
};

const requireAccess = (
  server: StoredServer,
  externalId: string,
): StoredAccess => {
  const access = server.accesses[externalId];
  if (access === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown access ${externalId}.`,
      400,
    );
  }
  return access;
};

const requireAgreement = (
  server: StoredServer,
  agreementId: string,
): StoredAgreement => {
  const agreement = server.agreements[agreementId];
  if (agreement === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown agreement ${agreementId}.`,
      400,
    );
  }
  return agreement;
};

const requireHostKey = (
  server: StoredServer,
  hostKeyId: string,
): StoredHostKey => {
  const hk = server.hostKeys[hostKeyId];
  if (hk === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown host key ${hostKeyId}.`,
      400,
    );
  }
  return hk;
};

const CreateServer: OperationHandler = (input, ctx) => {
  const serverId = `s-${hex17()}`;
  const server: StoredServer = {
    Arn: serverArn(ctx, serverId),
    ServerId: serverId,
    State: "ONLINE",
    Domain: stringOrUndefined(input["Domain"]) ?? "S3",
    EndpointType: stringOrUndefined(input["EndpointType"]) ?? "PUBLIC",
    IdentityProviderType:
      stringOrUndefined(input["IdentityProviderType"]) ?? "SERVICE_MANAGED",
    LoggingRole: stringOrUndefined(input["LoggingRole"]),
    Protocols: arrayOrEmpty(input["Protocols"]).length
      ? arrayOrEmpty(input["Protocols"])
      : ["SFTP"],
    Certificate: stringOrUndefined(input["Certificate"]),
    SecurityPolicyName:
      stringOrUndefined(input["SecurityPolicyName"]) ??
      "TransferSecurityPolicy-2018-11",
    Tags: arrayOrEmpty(input["Tags"]),
    users: {},
    hostKeys: {},
    accesses: {},
    agreements: {},
  };
  ctx.store.set(serverId, server);
  return { ServerId: serverId };
};

const DescribeServer: OperationHandler = (input, ctx) => {
  const server = requireServer(ctx, serverIdFromInput(input));
  return {
    Server: {
      Arn: server.Arn,
      Certificate: server.Certificate,
      Domain: server.Domain,
      EndpointType: server.EndpointType,
      IdentityProviderType: server.IdentityProviderType,
      LoggingRole: server.LoggingRole,
      Protocols: server.Protocols,
      SecurityPolicyName: server.SecurityPolicyName,
      ServerId: server.ServerId,
      State: server.State,
      Tags: server.Tags,
      UserCount: Object.keys(server.users).length,
    },
  };
};

const ListServers: OperationHandler = (_input, ctx) => {
  const servers = ctx.store
    .list<StoredServer>()
    .filter((e) => !e.key.includes("/"))
    .map((entry) => ({
      Arn: entry.value.Arn,
      Domain: entry.value.Domain,
      IdentityProviderType: entry.value.IdentityProviderType,
      EndpointType: entry.value.EndpointType,
      LoggingRole: entry.value.LoggingRole,
      ServerId: entry.value.ServerId,
      State: entry.value.State,
      UserCount: Object.keys(entry.value.users).length,
    }));
  return { Servers: servers };
};

const DeleteServer: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  requireServer(ctx, serverId);
  ctx.store.delete(serverId);
  return {};
};

const StartServer: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  server.State = "ONLINE";
  ctx.store.set(serverId, server);
  return {};
};

const StopServer: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  server.State = "OFFLINE";
  ctx.store.set(serverId, server);
  return {};
};

const UpdateServer: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  if (stringOrUndefined(input["Certificate"]) !== undefined) {
    server.Certificate = stringOrUndefined(input["Certificate"]);
  }
  if (stringOrUndefined(input["EndpointType"]) !== undefined) {
    server.EndpointType = stringOrUndefined(input["EndpointType"])!;
  }
  if (stringOrUndefined(input["LoggingRole"]) !== undefined) {
    server.LoggingRole = stringOrUndefined(input["LoggingRole"]);
  }
  if (Array.isArray(input["Protocols"])) {
    server.Protocols = input["Protocols"] as unknown[];
  }
  if (stringOrUndefined(input["SecurityPolicyName"]) !== undefined) {
    server.SecurityPolicyName = stringOrUndefined(input["SecurityPolicyName"])!;
  }
  ctx.store.set(serverId, server);
  return { ServerId: serverId };
};

const TestIdentityProvider: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  requireServer(ctx, serverId);
  return {
    StatusCode: 200,
    Url: `https://example.com/identity`,
    Response: JSON.stringify({ Message: "Success" }),
  };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const userName = userNameFromInput(input);
  const role = input["Role"];
  if (typeof role !== "string" || role === "") {
    throw awsError("InvalidRequestException", "Role is required.", 400);
  }
  if (server.users[userName] !== undefined) {
    throw awsError(
      "ResourceExistsException",
      `User ${userName} already exists.`,
      400,
    );
  }
  const sshKeyBody = stringOrUndefined(input["SshPublicKeyBody"]);
  const user: StoredUser = {
    Arn: userArn(ctx, serverId, userName),
    HomeDirectory: stringOrUndefined(input["HomeDirectory"]),
    HomeDirectoryType: stringOrUndefined(input["HomeDirectoryType"]),
    HomeDirectoryMappings: arrayOrEmpty(input["HomeDirectoryMappings"]),
    Policy: stringOrUndefined(input["Policy"]),
    PosixProfile: input["PosixProfile"],
    Role: role,
    SshPublicKeys:
      sshKeyBody === undefined
        ? []
        : [
            {
              SshPublicKeyId: `key-${hex17()}`,
              SshPublicKeyBody: sshKeyBody,
              DateImported: Math.floor(Date.now() / 1000),
            },
          ],
    Tags: arrayOrEmpty(input["Tags"]),
    UserName: userName,
  };
  server.users[userName] = user;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, UserName: userName };
};

const DescribeUser: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const user = requireUser(server, userNameFromInput(input));
  return {
    ServerId: serverId,
    User: {
      Arn: user.Arn,
      HomeDirectory: user.HomeDirectory,
      HomeDirectoryMappings: user.HomeDirectoryMappings,
      HomeDirectoryType: user.HomeDirectoryType,
      Policy: user.Policy,
      PosixProfile: user.PosixProfile,
      Role: user.Role,
      SshPublicKeys: user.SshPublicKeys,
      Tags: user.Tags,
      UserName: user.UserName,
    },
  };
};

const ListUsers: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const users = Object.values(server.users).map((user) => ({
    Arn: user.Arn,
    HomeDirectory: user.HomeDirectory,
    HomeDirectoryType: user.HomeDirectoryType,
    Role: user.Role,
    SshPublicKeyCount: user.SshPublicKeys.length,
    UserName: user.UserName,
  }));
  return { ServerId: serverId, Users: users };
};

const UpdateUser: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const userName = userNameFromInput(input);
  const user = requireUser(server, userName);
  if (stringOrUndefined(input["HomeDirectory"]) !== undefined) {
    user.HomeDirectory = stringOrUndefined(input["HomeDirectory"]);
  }
  if (stringOrUndefined(input["HomeDirectoryType"]) !== undefined) {
    user.HomeDirectoryType = stringOrUndefined(input["HomeDirectoryType"]);
  }
  if (Array.isArray(input["HomeDirectoryMappings"])) {
    user.HomeDirectoryMappings = input["HomeDirectoryMappings"] as unknown[];
  }
  if (stringOrUndefined(input["Policy"]) !== undefined) {
    user.Policy = stringOrUndefined(input["Policy"]);
  }
  if (input["PosixProfile"] !== undefined) {
    user.PosixProfile = input["PosixProfile"];
  }
  if (stringOrUndefined(input["Role"]) !== undefined) {
    user.Role = stringOrUndefined(input["Role"])!;
  }
  server.users[userName] = user;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, UserName: userName };
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const userName = userNameFromInput(input);
  requireUser(server, userName);
  delete server.users[userName];
  ctx.store.set(serverId, server);
  return {};
};

const ImportSshPublicKey: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const userName = userNameFromInput(input);
  const user = requireUser(server, userName);
  const body = input["SshPublicKeyBody"];
  if (typeof body !== "string" || body === "") {
    throw awsError(
      "InvalidRequestException",
      "SshPublicKeyBody is required.",
      400,
    );
  }
  const keyId = `key-${hex17()}`;
  user.SshPublicKeys.push({
    SshPublicKeyId: keyId,
    SshPublicKeyBody: body,
    DateImported: Math.floor(Date.now() / 1000),
  });
  server.users[userName] = user;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, SshPublicKeyId: keyId, UserName: userName };
};

const DeleteSshPublicKey: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const userName = userNameFromInput(input);
  const user = requireUser(server, userName);
  const keyId = input["SshPublicKeyId"];
  if (typeof keyId !== "string" || keyId === "") {
    throw awsError(
      "InvalidRequestException",
      "SshPublicKeyId is required.",
      400,
    );
  }
  const idx = user.SshPublicKeys.findIndex((k) => k.SshPublicKeyId === keyId);
  if (idx === -1) {
    throw awsError(
      "ResourceNotFoundException",
      `Unknown SSH public key ${keyId}.`,
      400,
    );
  }
  user.SshPublicKeys.splice(idx, 1);
  server.users[userName] = user;
  ctx.store.set(serverId, server);
  return {};
};

const ImportHostKey: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const body = input["HostKeyBody"];
  if (typeof body !== "string" || body === "") {
    throw awsError("InvalidRequestException", "HostKeyBody is required.", 400);
  }
  const hostKeyId = `hostkey-${hex17()}`;
  const hk: StoredHostKey = {
    Arn: hostKeyArn(ctx, serverId, hostKeyId),
    HostKeyId: hostKeyId,
    ServerId: serverId,
    HostKeyBody: body,
    HostKeyFingerprint: `SHA256:${Buffer.from(body).toString("base64").slice(0, 43)}`,
    Description: stringOrUndefined(input["Description"]),
    Type: "RSA",
    DateImported: Math.floor(Date.now() / 1000),
    Tags: arrayOrEmpty(input["Tags"]),
  };
  server.hostKeys[hostKeyId] = hk;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, HostKeyId: hostKeyId };
};

const DescribeHostKey: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const hostKeyId = input["HostKeyId"];
  if (typeof hostKeyId !== "string" || hostKeyId === "") {
    throw awsError("InvalidRequestException", "HostKeyId is required.", 400);
  }
  const hk = requireHostKey(server, hostKeyId);
  return {
    HostKey: {
      Arn: hk.Arn,
      HostKeyId: hk.HostKeyId,
      HostKeyFingerprint: hk.HostKeyFingerprint,
      Description: hk.Description,
      Type: hk.Type,
      DateImported: hk.DateImported,
      Tags: hk.Tags,
    },
  };
};

const ListHostKeys: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const hostKeys = Object.values(server.hostKeys).map((hk) => ({
    Arn: hk.Arn,
    HostKeyId: hk.HostKeyId,
    Fingerprint: hk.HostKeyFingerprint,
    Description: hk.Description,
    Type: hk.Type,
    DateImported: hk.DateImported,
  }));
  return { ServerId: serverId, HostKeys: hostKeys };
};

const UpdateHostKey: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const hostKeyId = input["HostKeyId"];
  if (typeof hostKeyId !== "string" || hostKeyId === "") {
    throw awsError("InvalidRequestException", "HostKeyId is required.", 400);
  }
  const hk = requireHostKey(server, hostKeyId);
  const desc = input["Description"];
  if (typeof desc === "string") {
    hk.Description = desc;
  }
  server.hostKeys[hostKeyId] = hk;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, HostKeyId: hostKeyId };
};

const DeleteHostKey: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const hostKeyId = input["HostKeyId"];
  if (typeof hostKeyId !== "string" || hostKeyId === "") {
    throw awsError("InvalidRequestException", "HostKeyId is required.", 400);
  }
  requireHostKey(server, hostKeyId);
  delete server.hostKeys[hostKeyId];
  ctx.store.set(serverId, server);
  return {};
};

const CreateAccess: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const externalId = input["ExternalId"];
  if (typeof externalId !== "string" || externalId === "") {
    throw awsError("InvalidRequestException", "ExternalId is required.", 400);
  }
  const access: StoredAccess = {
    ExternalId: externalId,
    HomeDirectory: stringOrUndefined(input["HomeDirectory"]),
    HomeDirectoryType: stringOrUndefined(input["HomeDirectoryType"]),
    HomeDirectoryMappings: arrayOrEmpty(input["HomeDirectoryMappings"]),
    Policy: stringOrUndefined(input["Policy"]),
    PosixProfile: input["PosixProfile"],
    Role: stringOrUndefined(input["Role"]),
  };
  server.accesses[externalId] = access;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, ExternalId: externalId };
};

const DescribeAccess: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const externalId = input["ExternalId"];
  if (typeof externalId !== "string" || externalId === "") {
    throw awsError("InvalidRequestException", "ExternalId is required.", 400);
  }
  const access = requireAccess(server, externalId);
  return {
    ServerId: serverId,
    Access: {
      HomeDirectory: access.HomeDirectory,
      HomeDirectoryMappings: access.HomeDirectoryMappings,
      HomeDirectoryType: access.HomeDirectoryType,
      Policy: access.Policy,
      PosixProfile: access.PosixProfile,
      Role: access.Role,
      ExternalId: access.ExternalId,
    },
  };
};

const ListAccesses: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const accesses = Object.values(server.accesses).map((a) => ({
    HomeDirectory: a.HomeDirectory,
    HomeDirectoryType: a.HomeDirectoryType,
    Role: a.Role,
    ExternalId: a.ExternalId,
  }));
  return { ServerId: serverId, Accesses: accesses };
};

const UpdateAccess: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const externalId = input["ExternalId"];
  if (typeof externalId !== "string" || externalId === "") {
    throw awsError("InvalidRequestException", "ExternalId is required.", 400);
  }
  const access = requireAccess(server, externalId);
  if (stringOrUndefined(input["HomeDirectory"]) !== undefined) {
    access.HomeDirectory = stringOrUndefined(input["HomeDirectory"]);
  }
  if (stringOrUndefined(input["HomeDirectoryType"]) !== undefined) {
    access.HomeDirectoryType = stringOrUndefined(input["HomeDirectoryType"]);
  }
  if (Array.isArray(input["HomeDirectoryMappings"])) {
    access.HomeDirectoryMappings = input["HomeDirectoryMappings"] as unknown[];
  }
  if (stringOrUndefined(input["Policy"]) !== undefined) {
    access.Policy = stringOrUndefined(input["Policy"]);
  }
  if (input["PosixProfile"] !== undefined) {
    access.PosixProfile = input["PosixProfile"];
  }
  if (stringOrUndefined(input["Role"]) !== undefined) {
    access.Role = stringOrUndefined(input["Role"]);
  }
  server.accesses[externalId] = access;
  ctx.store.set(serverId, server);
  return { ServerId: serverId, ExternalId: externalId };
};

const DeleteAccess: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const externalId = input["ExternalId"];
  if (typeof externalId !== "string" || externalId === "") {
    throw awsError("InvalidRequestException", "ExternalId is required.", 400);
  }
  requireAccess(server, externalId);
  delete server.accesses[externalId];
  ctx.store.set(serverId, server);
  return {};
};

const CreateAgreement: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const localProfileId = input["LocalProfileId"];
  if (typeof localProfileId !== "string" || localProfileId === "") {
    throw awsError(
      "InvalidRequestException",
      "LocalProfileId is required.",
      400,
    );
  }
  const partnerProfileId = input["PartnerProfileId"];
  if (typeof partnerProfileId !== "string" || partnerProfileId === "") {
    throw awsError(
      "InvalidRequestException",
      "PartnerProfileId is required.",
      400,
    );
  }
  const accessRole = input["AccessRole"];
  if (typeof accessRole !== "string" || accessRole === "") {
    throw awsError("InvalidRequestException", "AccessRole is required.", 400);
  }
  const agreementId = `a-${hex17()}`;
  const agreement: StoredAgreement = {
    Arn: agreementArn(ctx, serverId, agreementId),
    AgreementId: agreementId,
    ServerId: serverId,
    Description: stringOrUndefined(input["Description"]),
    Status: stringOrUndefined(input["Status"]) ?? "ACTIVE",
    LocalProfileId: localProfileId,
    PartnerProfileId: partnerProfileId,
    BaseDirectory: stringOrUndefined(input["BaseDirectory"]),
    AccessRole: accessRole,
    Tags: arrayOrEmpty(input["Tags"]),
    PreserveFilename: stringOrUndefined(input["PreserveFilename"]),
    EnforceMessageSigning: stringOrUndefined(input["EnforceMessageSigning"]),
    CustomDirectories: input["CustomDirectories"],
  };
  server.agreements[agreementId] = agreement;
  ctx.store.set(serverId, server);
  return { AgreementId: agreementId };
};

const DescribeAgreement: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const agreementId = input["AgreementId"];
  if (typeof agreementId !== "string" || agreementId === "") {
    throw awsError("InvalidRequestException", "AgreementId is required.", 400);
  }
  const agreement = requireAgreement(server, agreementId);
  return {
    Agreement: {
      Arn: agreement.Arn,
      AgreementId: agreement.AgreementId,
      Description: agreement.Description,
      Status: agreement.Status,
      ServerId: agreement.ServerId,
      LocalProfileId: agreement.LocalProfileId,
      PartnerProfileId: agreement.PartnerProfileId,
      BaseDirectory: agreement.BaseDirectory,
      AccessRole: agreement.AccessRole,
      Tags: agreement.Tags,
      PreserveFilename: agreement.PreserveFilename,
      EnforceMessageSigning: agreement.EnforceMessageSigning,
      CustomDirectories: agreement.CustomDirectories,
    },
  };
};

const ListAgreements: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const agreements = Object.values(server.agreements).map((a) => ({
    Arn: a.Arn,
    AgreementId: a.AgreementId,
    Description: a.Description,
    Status: a.Status,
    ServerId: a.ServerId,
    LocalProfileId: a.LocalProfileId,
    PartnerProfileId: a.PartnerProfileId,
  }));
  return { Agreements: agreements };
};

const UpdateAgreement: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const agreementId = input["AgreementId"];
  if (typeof agreementId !== "string" || agreementId === "") {
    throw awsError("InvalidRequestException", "AgreementId is required.", 400);
  }
  const agreement = requireAgreement(server, agreementId);
  if (stringOrUndefined(input["Description"]) !== undefined) {
    agreement.Description = stringOrUndefined(input["Description"]);
  }
  if (stringOrUndefined(input["Status"]) !== undefined) {
    agreement.Status = stringOrUndefined(input["Status"])!;
  }
  if (stringOrUndefined(input["LocalProfileId"]) !== undefined) {
    agreement.LocalProfileId = stringOrUndefined(input["LocalProfileId"])!;
  }
  if (stringOrUndefined(input["PartnerProfileId"]) !== undefined) {
    agreement.PartnerProfileId = stringOrUndefined(input["PartnerProfileId"])!;
  }
  if (stringOrUndefined(input["BaseDirectory"]) !== undefined) {
    agreement.BaseDirectory = stringOrUndefined(input["BaseDirectory"]);
  }
  if (stringOrUndefined(input["AccessRole"]) !== undefined) {
    agreement.AccessRole = stringOrUndefined(input["AccessRole"])!;
  }
  server.agreements[agreementId] = agreement;
  ctx.store.set(serverId, server);
  return { AgreementId: agreementId };
};

const DeleteAgreement: OperationHandler = (input, ctx) => {
  const serverId = serverIdFromInput(input);
  const server = requireServer(ctx, serverId);
  const agreementId = input["AgreementId"];
  if (typeof agreementId !== "string" || agreementId === "") {
    throw awsError("InvalidRequestException", "AgreementId is required.", 400);
  }
  requireAgreement(server, agreementId);
  delete server.agreements[agreementId];
  ctx.store.set(serverId, server);
  return {};
};

const CreateConnector: OperationHandler = (input, ctx) => {
  const accessRole = input["AccessRole"];
  if (typeof accessRole !== "string" || accessRole === "") {
    throw awsError("InvalidRequestException", "AccessRole is required.", 400);
  }
  const connectorId = `c-${hex17()}`;
  const connector: StoredConnector = {
    Arn: connectorArn(ctx, connectorId),
    ConnectorId: connectorId,
    Url: stringOrUndefined(input["Url"]),
    As2Config: input["As2Config"],
    AccessRole: accessRole,
    LoggingRole: stringOrUndefined(input["LoggingRole"]),
    Tags: arrayOrEmpty(input["Tags"]),
    SftpConfig: input["SftpConfig"],
    SecurityPolicyName: stringOrUndefined(input["SecurityPolicyName"]),
    EgressConfig: input["EgressConfig"],
    IpAddressType: stringOrUndefined(input["IpAddressType"]),
  };
  ctx.store.set(connectorKey(connectorId), connector);
  return { ConnectorId: connectorId };
};

const DescribeConnector: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  const connector = requireConnector(ctx, connectorId);
  return {
    Connector: {
      Arn: connector.Arn,
      ConnectorId: connector.ConnectorId,
      Url: connector.Url,
      As2Config: connector.As2Config,
      AccessRole: connector.AccessRole,
      LoggingRole: connector.LoggingRole,
      Tags: connector.Tags,
      SftpConfig: connector.SftpConfig,
      ServiceManagedEgressIpAddresses: [],
      SecurityPolicyName: connector.SecurityPolicyName,
      EgressConfig: connector.EgressConfig,
      EgressType: "PUBLIC",
      Status: "ONLINE",
      IpAddressType: connector.IpAddressType,
    },
  };
};

const ListConnectors: OperationHandler = (_input, ctx) => {
  const connectors = ctx.store
    .list<StoredConnector>()
    .filter((e) => e.key.startsWith("connector/"))
    .map((e) => ({
      Arn: e.value.Arn,
      ConnectorId: e.value.ConnectorId,
      Url: e.value.Url,
    }));
  return { Connectors: connectors };
};

const UpdateConnector: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  const connector = requireConnector(ctx, connectorId);
  if (stringOrUndefined(input["Url"]) !== undefined) {
    connector.Url = stringOrUndefined(input["Url"]);
  }
  if (input["As2Config"] !== undefined) {
    connector.As2Config = input["As2Config"];
  }
  if (stringOrUndefined(input["AccessRole"]) !== undefined) {
    connector.AccessRole = stringOrUndefined(input["AccessRole"])!;
  }
  if (stringOrUndefined(input["LoggingRole"]) !== undefined) {
    connector.LoggingRole = stringOrUndefined(input["LoggingRole"]);
  }
  if (input["SftpConfig"] !== undefined) {
    connector.SftpConfig = input["SftpConfig"];
  }
  if (stringOrUndefined(input["SecurityPolicyName"]) !== undefined) {
    connector.SecurityPolicyName = stringOrUndefined(
      input["SecurityPolicyName"],
    );
  }
  ctx.store.set(connectorKey(connectorId), connector);
  return { ConnectorId: connectorId };
};

const DeleteConnector: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  requireConnector(ctx, connectorId);
  ctx.store.delete(connectorKey(connectorId));
  return {};
};

const TestConnection: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  requireConnector(ctx, connectorId);
  return {
    ConnectorId: connectorId,
    Status: "OK",
    StatusMessage: "Connection succeeded",
  };
};

const StartFileTransfer: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  requireConnector(ctx, connectorId);
  return { TransferId: `transfer-${hex17()}` };
};

const StartDirectoryListing: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  requireConnector(ctx, connectorId);
  const listingId = `listing-${hex17()}`;
  return {
    ListingId: listingId,
    OutputFileName: `${listingId}.json`,
  };
};

const StartRemoteDelete: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  requireConnector(ctx, connectorId);
  return { DeleteId: `delete-${hex17()}` };
};

const StartRemoteMove: OperationHandler = (input, ctx) => {
  const connectorId = input["ConnectorId"];
  if (typeof connectorId !== "string" || connectorId === "") {
    throw awsError("InvalidRequestException", "ConnectorId is required.", 400);
  }
  requireConnector(ctx, connectorId);
  return { MoveId: `move-${hex17()}` };
};

const ListFileTransferResults: OperationHandler = (_input, _ctx) => {
  return { FileTransferResults: [] };
};

const CreateProfile: OperationHandler = (input, ctx) => {
  const as2Id = input["As2Id"];
  if (typeof as2Id !== "string" || as2Id === "") {
    throw awsError("InvalidRequestException", "As2Id is required.", 400);
  }
  const profileType = input["ProfileType"];
  if (typeof profileType !== "string" || profileType === "") {
    throw awsError("InvalidRequestException", "ProfileType is required.", 400);
  }
  const profileId = `p-${hex17()}`;
  const profile: StoredProfile = {
    Arn: profileArn(ctx, profileId),
    ProfileId: profileId,
    As2Id: as2Id,
    ProfileType: profileType,
    CertificateIds: Array.isArray(input["CertificateIds"])
      ? (input["CertificateIds"] as string[])
      : [],
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(profileKey(profileId), profile);
  return { ProfileId: profileId };
};

const DescribeProfile: OperationHandler = (input, ctx) => {
  const profileId = input["ProfileId"];
  if (typeof profileId !== "string" || profileId === "") {
    throw awsError("InvalidRequestException", "ProfileId is required.", 400);
  }
  const profile = requireProfile(ctx, profileId);
  return {
    Profile: {
      Arn: profile.Arn,
      ProfileId: profile.ProfileId,
      ProfileType: profile.ProfileType,
      As2Id: profile.As2Id,
      CertificateIds: profile.CertificateIds,
      Tags: profile.Tags,
    },
  };
};

const ListProfiles: OperationHandler = (_input, ctx) => {
  const profiles = ctx.store
    .list<StoredProfile>()
    .filter((e) => e.key.startsWith("profile/"))
    .map((e) => ({
      Arn: e.value.Arn,
      ProfileId: e.value.ProfileId,
      As2Id: e.value.As2Id,
      ProfileType: e.value.ProfileType,
    }));
  return { Profiles: profiles };
};

const UpdateProfile: OperationHandler = (input, ctx) => {
  const profileId = input["ProfileId"];
  if (typeof profileId !== "string" || profileId === "") {
    throw awsError("InvalidRequestException", "ProfileId is required.", 400);
  }
  const profile = requireProfile(ctx, profileId);
  if (Array.isArray(input["CertificateIds"])) {
    profile.CertificateIds = input["CertificateIds"] as string[];
  }
  ctx.store.set(profileKey(profileId), profile);
  return { ProfileId: profileId };
};

const DeleteProfile: OperationHandler = (input, ctx) => {
  const profileId = input["ProfileId"];
  if (typeof profileId !== "string" || profileId === "") {
    throw awsError("InvalidRequestException", "ProfileId is required.", 400);
  }
  requireProfile(ctx, profileId);
  ctx.store.delete(profileKey(profileId));
  return {};
};

const CreateWebApp: OperationHandler = (input, ctx) => {
  if (
    input["IdentityProviderDetails"] === undefined ||
    input["IdentityProviderDetails"] === null
  ) {
    throw awsError(
      "InvalidRequestException",
      "IdentityProviderDetails is required.",
      400,
    );
  }
  const webAppId = `webapp-${hex17()}`;
  const webApp: StoredWebApp = {
    Arn: webAppArn(ctx, webAppId),
    WebAppId: webAppId,
    IdentityProviderDetails: input["IdentityProviderDetails"],
    AccessEndpoint: stringOrUndefined(input["AccessEndpoint"]),
    WebAppUnits: input["WebAppUnits"],
    Tags: arrayOrEmpty(input["Tags"]),
    WebAppEndpointPolicy: stringOrUndefined(input["WebAppEndpointPolicy"]),
    EndpointDetails: input["EndpointDetails"],
    customization: undefined,
  };
  ctx.store.set(webAppKey(webAppId), webApp);
  return { WebAppId: webAppId };
};

const DescribeWebApp: OperationHandler = (input, ctx) => {
  const webAppId = input["WebAppId"];
  if (typeof webAppId !== "string" || webAppId === "") {
    throw awsError("InvalidRequestException", "WebAppId is required.", 400);
  }
  const webApp = requireWebApp(ctx, webAppId);
  return {
    WebApp: {
      Arn: webApp.Arn,
      WebAppId: webApp.WebAppId,
      DescribedIdentityProviderDetails: webApp.IdentityProviderDetails,
      AccessEndpoint: webApp.AccessEndpoint,
      WebAppEndpoint: webApp.AccessEndpoint,
      WebAppUnits: webApp.WebAppUnits,
      Tags: webApp.Tags,
      WebAppEndpointPolicy: webApp.WebAppEndpointPolicy,
      EndpointType: "PUBLIC",
    },
  };
};

const ListWebApps: OperationHandler = (_input, ctx) => {
  const webApps = ctx.store
    .list<StoredWebApp>()
    .filter((e) => e.key.startsWith("webapp/"))
    .map((e) => ({
      Arn: e.value.Arn,
      WebAppId: e.value.WebAppId,
      AccessEndpoint: e.value.AccessEndpoint,
      WebAppEndpoint: e.value.AccessEndpoint,
      EndpointType: "PUBLIC",
    }));
  return { WebApps: webApps };
};

const UpdateWebApp: OperationHandler = (input, ctx) => {
  const webAppId = input["WebAppId"];
  if (typeof webAppId !== "string" || webAppId === "") {
    throw awsError("InvalidRequestException", "WebAppId is required.", 400);
  }
  const webApp = requireWebApp(ctx, webAppId);
  if (input["IdentityProviderDetails"] !== undefined) {
    webApp.IdentityProviderDetails = input["IdentityProviderDetails"];
  }
  if (stringOrUndefined(input["AccessEndpoint"]) !== undefined) {
    webApp.AccessEndpoint = stringOrUndefined(input["AccessEndpoint"]);
  }
  if (input["WebAppUnits"] !== undefined) {
    webApp.WebAppUnits = input["WebAppUnits"];
  }
  ctx.store.set(webAppKey(webAppId), webApp);
  return { WebAppId: webAppId };
};

const DeleteWebApp: OperationHandler = (input, ctx) => {
  const webAppId = input["WebAppId"];
  if (typeof webAppId !== "string" || webAppId === "") {
    throw awsError("InvalidRequestException", "WebAppId is required.", 400);
  }
  requireWebApp(ctx, webAppId);
  ctx.store.delete(webAppKey(webAppId));
  return {};
};

const DescribeWebAppCustomization: OperationHandler = (input, ctx) => {
  const webAppId = input["WebAppId"];
  if (typeof webAppId !== "string" || webAppId === "") {
    throw awsError("InvalidRequestException", "WebAppId is required.", 400);
  }
  const webApp = requireWebApp(ctx, webAppId);
  return {
    WebAppCustomization: {
      Arn: webApp.Arn,
      WebAppId: webApp.WebAppId,
      Title: webApp.customization?.Title,
      LogoFile: webApp.customization?.LogoFile,
      FaviconFile: webApp.customization?.FaviconFile,
    },
  };
};

const UpdateWebAppCustomization: OperationHandler = (input, ctx) => {
  const webAppId = input["WebAppId"];
  if (typeof webAppId !== "string" || webAppId === "") {
    throw awsError("InvalidRequestException", "WebAppId is required.", 400);
  }
  const webApp = requireWebApp(ctx, webAppId);
  webApp.customization = {
    Title: stringOrUndefined(input["Title"]),
    LogoFile: input["LogoFile"],
    FaviconFile: input["FaviconFile"],
  };
  ctx.store.set(webAppKey(webAppId), webApp);
  return { WebAppId: webAppId };
};

const DeleteWebAppCustomization: OperationHandler = (input, ctx) => {
  const webAppId = input["WebAppId"];
  if (typeof webAppId !== "string" || webAppId === "") {
    throw awsError("InvalidRequestException", "WebAppId is required.", 400);
  }
  const webApp = requireWebApp(ctx, webAppId);
  webApp.customization = undefined;
  ctx.store.set(webAppKey(webAppId), webApp);
  return {};
};

const CreateWorkflow: OperationHandler = (input, ctx) => {
  if (!Array.isArray(input["Steps"])) {
    throw awsError("InvalidRequestException", "Steps is required.", 400);
  }
  const workflowId = `w-${hex17()}`;
  const workflow: StoredWorkflow = {
    Arn: workflowArn(ctx, workflowId),
    WorkflowId: workflowId,
    Description: stringOrUndefined(input["Description"]),
    Steps: input["Steps"] as unknown[],
    OnExceptionSteps: arrayOrEmpty(input["OnExceptionSteps"]),
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(workflowKey(workflowId), workflow);
  return { WorkflowId: workflowId };
};

const DescribeWorkflow: OperationHandler = (input, ctx) => {
  const workflowId = input["WorkflowId"];
  if (typeof workflowId !== "string" || workflowId === "") {
    throw awsError("InvalidRequestException", "WorkflowId is required.", 400);
  }
  const workflow = requireWorkflow(ctx, workflowId);
  return {
    Workflow: {
      Arn: workflow.Arn,
      Description: workflow.Description,
      Steps: workflow.Steps,
      OnExceptionSteps: workflow.OnExceptionSteps,
      WorkflowId: workflow.WorkflowId,
      Tags: workflow.Tags,
    },
  };
};

const ListWorkflows: OperationHandler = (_input, ctx) => {
  const workflows = ctx.store
    .list<StoredWorkflow>()
    .filter((e) => e.key.startsWith("workflow/"))
    .map((e) => ({
      WorkflowId: e.value.WorkflowId,
      Description: e.value.Description,
      Arn: e.value.Arn,
    }));
  return { Workflows: workflows };
};

const DeleteWorkflow: OperationHandler = (input, ctx) => {
  const workflowId = input["WorkflowId"];
  if (typeof workflowId !== "string" || workflowId === "") {
    throw awsError("InvalidRequestException", "WorkflowId is required.", 400);
  }
  requireWorkflow(ctx, workflowId);
  ctx.store.delete(workflowKey(workflowId));
  return {};
};

const SendWorkflowStepState: OperationHandler = (input, ctx) => {
  const workflowId = input["WorkflowId"];
  if (typeof workflowId !== "string" || workflowId === "") {
    throw awsError("InvalidRequestException", "WorkflowId is required.", 400);
  }
  requireWorkflow(ctx, workflowId);
  return {};
};

const DescribeExecution: OperationHandler = (input, ctx) => {
  const workflowId = input["WorkflowId"];
  if (typeof workflowId !== "string" || workflowId === "") {
    throw awsError("InvalidRequestException", "WorkflowId is required.", 400);
  }
  requireWorkflow(ctx, workflowId);
  const executionId = input["ExecutionId"];
  if (typeof executionId !== "string" || executionId === "") {
    throw awsError("InvalidRequestException", "ExecutionId is required.", 400);
  }
  return {
    WorkflowId: workflowId,
    Execution: {
      ExecutionId: executionId,
      Status: "COMPLETED",
      InitialFileLocation: {
        S3FileLocation: { Bucket: "example", Key: "file.txt" },
      },
      ServiceMetadata: {
        UserDetails: { UserName: "user", ServerId: "s-example" },
      },
      Results: { OnPartialFailure: "CONTINUE" },
    },
  };
};

const ListExecutions: OperationHandler = (input, ctx) => {
  const workflowId = input["WorkflowId"];
  if (typeof workflowId !== "string" || workflowId === "") {
    throw awsError("InvalidRequestException", "WorkflowId is required.", 400);
  }
  requireWorkflow(ctx, workflowId);
  return { WorkflowId: workflowId, Executions: [] };
};

const ImportCertificate: OperationHandler = (input, ctx) => {
  const usage = input["Usage"];
  if (typeof usage !== "string" || usage === "") {
    throw awsError("InvalidRequestException", "Usage is required.", 400);
  }
  const certificate = input["Certificate"];
  if (typeof certificate !== "string" || certificate === "") {
    throw awsError("InvalidRequestException", "Certificate is required.", 400);
  }
  const certId = `cert-${hex17()}`;
  const now = Math.floor(Date.now() / 1000);
  const stored: StoredCertificate = {
    Arn: certificateArn(ctx, certId),
    CertificateId: certId,
    Usage: usage,
    Status: "ACTIVE",
    Certificate: certificate,
    CertificateChain: stringOrUndefined(input["CertificateChain"]),
    ActiveDate:
      typeof input["ActiveDate"] === "number" ? input["ActiveDate"] : now,
    InactiveDate:
      typeof input["InactiveDate"] === "number"
        ? input["InactiveDate"]
        : undefined,
    Description: stringOrUndefined(input["Description"]),
    Type: "IMPORTED",
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(certKey(certId), stored);
  return { CertificateId: certId };
};

const DescribeCertificate: OperationHandler = (input, ctx) => {
  const certId = input["CertificateId"];
  if (typeof certId !== "string" || certId === "") {
    throw awsError(
      "InvalidRequestException",
      "CertificateId is required.",
      400,
    );
  }
  const cert = requireCert(ctx, certId);
  return {
    Certificate: {
      Arn: cert.Arn,
      CertificateId: cert.CertificateId,
      Usage: cert.Usage,
      Status: cert.Status,
      Certificate: cert.Certificate,
      CertificateChain: cert.CertificateChain,
      ActiveDate: cert.ActiveDate,
      InactiveDate: cert.InactiveDate,
      Description: cert.Description,
      Type: cert.Type,
      Tags: cert.Tags,
    },
  };
};

const ListCertificates: OperationHandler = (_input, ctx) => {
  const certificates = ctx.store
    .list<StoredCertificate>()
    .filter((e) => e.key.startsWith("certificate/"))
    .map((e) => ({
      Arn: e.value.Arn,
      CertificateId: e.value.CertificateId,
      Usage: e.value.Usage,
      Status: e.value.Status,
      ActiveDate: e.value.ActiveDate,
      InactiveDate: e.value.InactiveDate,
      Type: e.value.Type,
      Description: e.value.Description,
    }));
  return { Certificates: certificates };
};

const UpdateCertificate: OperationHandler = (input, ctx) => {
  const certId = input["CertificateId"];
  if (typeof certId !== "string" || certId === "") {
    throw awsError(
      "InvalidRequestException",
      "CertificateId is required.",
      400,
    );
  }
  const cert = requireCert(ctx, certId);
  if (typeof input["ActiveDate"] === "number") {
    cert.ActiveDate = input["ActiveDate"];
  }
  if (typeof input["InactiveDate"] === "number") {
    cert.InactiveDate = input["InactiveDate"];
  }
  if (stringOrUndefined(input["Description"]) !== undefined) {
    cert.Description = stringOrUndefined(input["Description"]);
  }
  ctx.store.set(certKey(certId), cert);
  return { CertificateId: certId };
};

const DeleteCertificate: OperationHandler = (input, ctx) => {
  const certId = input["CertificateId"];
  if (typeof certId !== "string" || certId === "") {
    throw awsError(
      "InvalidRequestException",
      "CertificateId is required.",
      400,
    );
  }
  requireCert(ctx, certId);
  ctx.store.delete(certKey(certId));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input["Arn"];
  if (typeof arn !== "string" || arn === "") {
    throw awsError("InvalidRequestException", "Arn is required.", 400);
  }
  const newTags = arrayOrEmpty(input["Tags"]) as {
    Key: string;
    Value: string;
  }[];
  const key = tagKey(arn);
  const existing = ctx.store.get<{ Key: string; Value: string }[]>(key) ?? [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx === -1) {
      merged.push(tag);
    } else {
      merged[idx] = tag;
    }
  }
  ctx.store.set(key, merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = input["Arn"];
  if (typeof arn !== "string" || arn === "") {
    throw awsError("InvalidRequestException", "Arn is required.", 400);
  }
  const tagKeys = arrayOrEmpty(input["TagKeys"]) as string[];
  const key = tagKey(arn);
  const existing = ctx.store.get<{ Key: string; Value: string }[]>(key) ?? [];
  const filtered = existing.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(key, filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input["Arn"];
  if (typeof arn !== "string" || arn === "") {
    throw awsError("InvalidRequestException", "Arn is required.", 400);
  }
  const tags =
    ctx.store.get<{ Key: string; Value: string }[]>(tagKey(arn)) ?? [];
  return { Arn: arn, Tags: tags };
};

const DescribeSecurityPolicy: OperationHandler = (input, _ctx) => {
  const policyName = input["SecurityPolicyName"];
  if (typeof policyName !== "string" || policyName === "") {
    throw awsError(
      "InvalidRequestException",
      "SecurityPolicyName is required.",
      400,
    );
  }
  return {
    SecurityPolicy: {
      SecurityPolicyName: policyName,
      Fips: false,
      SshCiphers: ["aes128-ctr", "aes192-ctr", "aes256-ctr"],
      SshKexs: ["diffie-hellman-group14-sha1"],
      SshMacs: ["hmac-sha2-256"],
      TlsCiphers: ["TLS_AES_128_GCM_SHA256"],
      Type: "SERVER",
      Protocols: ["SFTP"],
    },
  };
};

const ListSecurityPolicies: OperationHandler = (_input, _ctx) => {
  return {
    SecurityPolicyNames: [
      "TransferSecurityPolicy-2018-11",
      "TransferSecurityPolicy-2020-06",
      "TransferSecurityPolicy-2022-03",
      "TransferSecurityPolicy-2023-05",
      "TransferSecurityPolicy-FIPS-2020-06",
      "TransferSecurityPolicy-FIPS-2023-05",
    ],
  };
};

const transfer: ServiceDefinition = {
  name: "transfer",
  protocol: "json",
  operations: {
    CreateServer,
    DescribeServer,
    ListServers,
    DeleteServer,
    StartServer,
    StopServer,
    UpdateServer,
    TestIdentityProvider,
    CreateUser,
    DescribeUser,
    ListUsers,
    UpdateUser,
    DeleteUser,
    ImportSshPublicKey,
    DeleteSshPublicKey,
    ImportHostKey,
    DescribeHostKey,
    ListHostKeys,
    UpdateHostKey,
    DeleteHostKey,
    CreateAccess,
    DescribeAccess,
    ListAccesses,
    UpdateAccess,
    DeleteAccess,
    CreateAgreement,
    DescribeAgreement,
    ListAgreements,
    UpdateAgreement,
    DeleteAgreement,
    CreateConnector,
    DescribeConnector,
    ListConnectors,
    UpdateConnector,
    DeleteConnector,
    TestConnection,
    StartFileTransfer,
    StartDirectoryListing,
    StartRemoteDelete,
    StartRemoteMove,
    ListFileTransferResults,
    CreateProfile,
    DescribeProfile,
    ListProfiles,
    UpdateProfile,
    DeleteProfile,
    CreateWebApp,
    DescribeWebApp,
    ListWebApps,
    UpdateWebApp,
    DeleteWebApp,
    DescribeWebAppCustomization,
    UpdateWebAppCustomization,
    DeleteWebAppCustomization,
    CreateWorkflow,
    DescribeWorkflow,
    ListWorkflows,
    DeleteWorkflow,
    SendWorkflowStepState,
    DescribeExecution,
    ListExecutions,
    ImportCertificate,
    DescribeCertificate,
    ListCertificates,
    UpdateCertificate,
    DeleteCertificate,
    TagResource,
    UntagResource,
    ListTagsForResource,
    DescribeSecurityPolicy,
    ListSecurityPolicies,
  },
  model,
} as const;

export default transfer;
