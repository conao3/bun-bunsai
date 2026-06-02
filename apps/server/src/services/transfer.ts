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
  SshPublicKeys: unknown[];
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
  const servers = ctx.store.list<StoredServer>().map((entry) => ({
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

const transfer: ServiceDefinition = {
  name: "transfer",
  protocol: "json",
  operations: {
    CreateServer,
    DescribeServer,
    ListServers,
    DeleteServer,
    CreateUser,
    DescribeUser,
    ListUsers,
  },
  model,
} as const;

export default transfer;
