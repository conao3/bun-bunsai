import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cognitoIdpModel from "../../../../test/vendor/aws-models/cognito-idp.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(cognitoIdpModel);

type Attribute = {
  Name: string;
  Value?: string;
};

type StoredUser = {
  Username: string;
  Attributes: Attribute[];
  UserCreateDate: number;
  UserLastModifiedDate: number;
  Enabled: boolean;
  UserStatus: string;
};

type StoredClient = {
  UserPoolId: string;
  ClientName: string;
  ClientId: string;
  ClientSecret?: string;
  CreationDate: number;
  LastModifiedDate: number;
};

type StoredPool = {
  Id: string;
  Name: string;
  Arn: string;
  Status: string;
  CreationDate: number;
  LastModifiedDate: number;
  MfaConfiguration: string;
  EstimatedNumberOfUsers: number;
  users: Record<string, StoredUser>;
  clients: Record<string, StoredClient>;
};

const poolArn = (region: string, account: string, poolId: string): string =>
  `arn:aws:cognito-idp:${region}:${account}:userpool/${poolId}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const requirePool = (ctx: ServiceContext, poolId: string): StoredPool => {
  const pool = ctx.store.get<StoredPool>(poolId);
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User pool ${poolId} does not exist.`,
      400,
    );
  }
  return pool;
};

const toAttributes = (value: unknown): Attribute[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => ({
      Name: typeof entry["Name"] === "string" ? (entry["Name"] as string) : "",
      Value:
        typeof entry["Value"] === "string"
          ? (entry["Value"] as string)
          : undefined,
    }));
};

const poolDescription = (pool: StoredPool): Record<string, unknown> => ({
  Id: pool.Id,
  Name: pool.Name,
  Status: pool.Status,
  LambdaConfig: {},
  CreationDate: pool.CreationDate,
  LastModifiedDate: pool.LastModifiedDate,
});

const poolType = (pool: StoredPool): Record<string, unknown> => ({
  Id: pool.Id,
  Name: pool.Name,
  Arn: pool.Arn,
  Status: pool.Status,
  MfaConfiguration: pool.MfaConfiguration,
  CreationDate: pool.CreationDate,
  LastModifiedDate: pool.LastModifiedDate,
  EstimatedNumberOfUsers: Object.keys(pool.users).length,
  Policies: {},
  LambdaConfig: {},
  SchemaAttributes: [],
  AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
});

const userType = (user: StoredUser): Record<string, unknown> => ({
  Username: user.Username,
  Attributes: user.Attributes,
  UserCreateDate: user.UserCreateDate,
  UserLastModifiedDate: user.UserLastModifiedDate,
  Enabled: user.Enabled,
  UserStatus: user.UserStatus,
});

const CreateUserPool: OperationHandler = (input, ctx) => {
  const name = requireString(input, "PoolName");
  const region = ctx.region;
  const suffix = crypto.randomUUID().slice(0, 9);
  const poolId = `${region}_${suffix}`;
  const now = Math.floor(Date.now() / 1000);
  const mfa =
    typeof input["MfaConfiguration"] === "string"
      ? (input["MfaConfiguration"] as string)
      : "OFF";
  const pool: StoredPool = {
    Id: poolId,
    Name: name,
    Arn: poolArn(region, ctx.account, poolId),
    Status: "Enabled",
    CreationDate: now,
    LastModifiedDate: now,
    MfaConfiguration: mfa,
    EstimatedNumberOfUsers: 0,
    users: {},
    clients: {},
  };
  ctx.store.set(poolId, pool);
  return { UserPool: poolType(pool) };
};

const DescribeUserPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  return { UserPool: poolType(pool) };
};

const ListUserPools: OperationHandler = (input, ctx) => {
  const entries = ctx.store.list<StoredPool>();
  return {
    UserPools: entries.map((entry) => poolDescription(entry.value)),
  };
};

const DeleteUserPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  ctx.store.delete(poolId);
  return {};
};

const CreateUserPoolClient: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientName = requireString(input, "ClientName");
  const now = Math.floor(Date.now() / 1000);
  const clientId = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
  const generateSecret = input["GenerateSecret"] === true;
  const client: StoredClient = {
    UserPoolId: poolId,
    ClientName: clientName,
    ClientId: clientId,
    ClientSecret: generateSecret
      ? crypto.randomUUID().replace(/-/g, "")
      : undefined,
    CreationDate: now,
    LastModifiedDate: now,
  };
  pool.clients[clientId] = client;
  ctx.store.set(poolId, pool);
  return {
    UserPoolClient: {
      UserPoolId: client.UserPoolId,
      ClientName: client.ClientName,
      ClientId: client.ClientId,
      ClientSecret: client.ClientSecret,
      CreationDate: client.CreationDate,
      LastModifiedDate: client.LastModifiedDate,
    },
  };
};

const AdminCreateUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  if (pool.users[username] !== undefined) {
    throw awsError(
      "UsernameExistsException",
      `User account already exists`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const user: StoredUser = {
    Username: username,
    Attributes: toAttributes(input["UserAttributes"]),
    UserCreateDate: now,
    UserLastModifiedDate: now,
    Enabled: true,
    UserStatus: "FORCE_CHANGE_PASSWORD",
  };
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return { User: userType(user) };
};

const AdminGetUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = pool.users[username];
  if (user === undefined) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  return {
    Username: user.Username,
    UserAttributes: user.Attributes,
    UserCreateDate: user.UserCreateDate,
    UserLastModifiedDate: user.UserLastModifiedDate,
    Enabled: user.Enabled,
    UserStatus: user.UserStatus,
  };
};

const ListUsers: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  return {
    Users: Object.values(pool.users).map((user) => userType(user)),
  };
};

const cognitoIdp: ServiceDefinition = {
  name: "cognito-idp",
  protocol: "json",
  operations: {
    CreateUserPool,
    DescribeUserPool,
    ListUserPools,
    DeleteUserPool,
    CreateUserPoolClient,
    AdminCreateUser,
    AdminGetUser,
    ListUsers,
  },
  model,
} as const;

export default cognitoIdp;
