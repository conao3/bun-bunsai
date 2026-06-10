import { createHash, createHmac, randomBytes } from "node:crypto";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import { publicJwks, signJwt, verifyJwt } from "../core/jwt.ts";
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
  Password?: string;
  devices: Record<string, StoredDevice>;
  webAuthnCredentials: Record<string, StoredWebAuthnCredential>;
  mfaPreferences: Record<string, unknown>;
  userSettings: Record<string, unknown>;
  softwareTokenVerified?: boolean;
};

type StoredDevice = {
  DeviceKey: string;
  DeviceAttributes: Attribute[];
  DeviceCreateDate: number;
  DeviceLastModifiedDate: number;
  DeviceLastAuthenticatedDate: number;
  DeviceRememberedStatus: string;
};

type StoredWebAuthnCredential = {
  CredentialId: string;
  FriendlyCredentialName: string;
  CreatedAt: number;
  AuthenticatorAttachment: string;
  RelyingPartyId: string;
};

type StoredClient = {
  UserPoolId: string;
  ClientName: string;
  ClientId: string;
  ClientSecret?: string;
  CreationDate: number;
  LastModifiedDate: number;
  CallbackURLs?: string[];
  LogoutURLs?: string[];
  AllowedOAuthFlows?: string[];
  AllowedOAuthScopes?: string[];
  SupportedIdentityProviders?: string[];
  ExplicitAuthFlows?: string[];
  TokenValidityUnits?: Record<string, unknown>;
  AccessTokenValidity?: number;
  IdTokenValidity?: number;
  RefreshTokenValidity?: number;
  EnableTokenRevocation?: boolean;
  secrets: string[];
};

type StoredGroup = {
  GroupName: string;
  UserPoolId: string;
  Description?: string;
  RoleArn?: string;
  Precedence?: number;
  CreationDate: number;
  LastModifiedDate: number;
  members: string[];
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
  CustomAttributes?: Array<{
    AttributeDataType: string;
    Name: string;
    Mutable?: boolean;
    Required?: boolean;
  }>;
  Policies?: Record<string, unknown>;
  DeletionProtection?: string;
  AutoVerifiedAttributes?: string[];
  UsernameAttributes?: string[];
  VerificationMessageTemplate?: Record<string, unknown>;
  SmsVerificationMessage?: string;
  EmailVerificationMessage?: string;
  EmailVerificationSubject?: string;
  SmsAuthenticationMessage?: string;
  AccountRecoverySetting?: Record<string, unknown>;
  AdminCreateUserConfig?: Record<string, unknown>;
  DeviceConfiguration?: Record<string, unknown>;
  UserAttributeUpdateSettings?: Record<string, unknown>;
  UserPoolTier?: string;
};

type StoredIdentityProvider = {
  UserPoolId: string;
  ProviderName: string;
  ProviderType: string;
  ProviderDetails: Record<string, string>;
  AttributeMapping?: Record<string, string>;
  IdpIdentifiers?: string[];
  CreationDate: number;
  LastModifiedDate: number;
};

type StoredResourceServer = {
  UserPoolId: string;
  Identifier: string;
  Name: string;
  Scopes?: Array<{ ScopeName: string; ScopeDescription: string }>;
};

type StoredUserImportJob = {
  JobName: string;
  JobId: string;
  UserPoolId: string;
  Status: string;
  CreationDate: number;
  StartDate?: number;
  CompletionDate?: number;
  CloudWatchLogsRoleArn: string;
  ImportedUsers: number;
  SkippedUsers: number;
  FailedUsers: number;
  CompletionMessage?: string;
};

type StoredDomain = {
  Domain: string;
  UserPoolId: string;
  Status: string;
  CloudFrontDistribution?: string;
  S3Bucket?: string;
  Version?: string;
  CustomDomainConfig?: Record<string, unknown>;
};

type StoredReplica = {
  UserPoolId: string;
  ReplicaRegion: string;
  Status: string;
  UserPoolArn: string;
};

type StoredTerms = {
  UserPoolId: string;
  DefaultVersion: string;
  Versions: Record<string, Record<string, unknown>>;
};

type StoredManagedLoginBranding = {
  ManagedLoginBrandingId: string;
  UserPoolId: string;
  ClientId?: string;
  Assets?: unknown[];
  Settings?: Record<string, unknown>;
  UseCognitoProvidedValues?: boolean;
  CreationDate: number;
  LastModifiedDate: number;
};

type StoredTags = Record<string, string>;

type StoredLogDelivery = {
  UserPoolId: string;
  LogConfigurations: unknown[];
};

type StoredRiskConfig = {
  UserPoolId: string;
  ClientId?: string;
  CompromisedCredentialsRiskConfiguration?: Record<string, unknown>;
  AccountTakeoverRiskConfiguration?: Record<string, unknown>;
  RiskExceptionConfiguration?: Record<string, unknown>;
};

type StoredUiCustomization = {
  UserPoolId: string;
  ClientId?: string;
  CSS?: string;
  ImageUrl?: string;
  LastModifiedDate: number;
  CreationDate: number;
};

type StoredMfaConfig = {
  UserPoolId: string;
  SmsMfaConfiguration?: Record<string, unknown>;
  SoftwareTokenMfaConfiguration?: Record<string, unknown>;
  EmailMfaConfiguration?: Record<string, unknown>;
  WebAuthnConfiguration?: Record<string, unknown>;
  MfaConfiguration: string;
};

const SRP_N_HEX =
  "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
  "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
  "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
  "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
  "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D" +
  "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
  "83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
  "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
  "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9" +
  "DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
  "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64" +
  "ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7" +
  "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B" +
  "F12FFA06D98A0864D87602733EC86A64521F2B18177B200C" +
  "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31" +
  "43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF";

const SRP_N = BigInt(`0x${SRP_N_HEX}`);
const SRP_g = 2n;

const srpPadHex = (n: bigint): string => {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  if (/^[89a-f]/i.test(hex)) hex = `00${hex}`;
  return hex;
};

const srpDigest = (hexStr: string): bigint =>
  BigInt(
    `0x${createHash("sha256").update(Buffer.from(hexStr, "hex")).digest("hex")}`,
  );

const SRP_k = srpDigest(srpPadHex(SRP_N) + "02");

const modPow = (base: bigint, exp: bigint, mod: bigint): bigint => {
  let result = 1n;
  let b = ((base % mod) + mod) % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    e >>= 1n;
    b = (b * b) % mod;
  }
  return result;
};

const srpHkdf = (S: bigint, u: bigint): Buffer => {
  const ikm = Buffer.from(srpPadHex(S), "hex");
  const salt = Buffer.from(srpPadHex(u), "hex");
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const info = Buffer.concat([
    Buffer.from("Caldera Derived Key", "utf8"),
    Buffer.from([0x01]),
  ]);
  return createHmac("sha256", prk).update(info).digest().subarray(0, 16);
};

type SrpSession = {
  poolId: string;
  clientId: string;
  username: string;
  b: string;
  v: string;
  srpA: string;
  salt: string;
  secretBlock: string;
};

const srpSessionKey = (poolId: string, username: string): string =>
  `srp#${poolId}#${username}`;

type MfaChallengeSession = {
  poolId: string;
  clientId: string;
  username: string;
};

const mfaChallengeKey = (session: string): string => `mfachallenge#${session}`;

const MFA_VALID_CODE = "123456" as const;

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

const requireUser = (pool: StoredPool, username: string): StoredUser => {
  const user = pool.users[username];
  if (user === undefined) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  return user;
};

const requireClient = (pool: StoredPool, clientId: string): StoredClient => {
  const client = pool.clients[clientId];
  if (client === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  return client;
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
  Policies: pool.Policies ?? {},
  LambdaConfig: {},
  SchemaAttributes: pool.CustomAttributes ?? [],
  AdminCreateUserConfig: pool.AdminCreateUserConfig ?? {
    AllowAdminCreateUserOnly: false,
  },
  DeletionProtection: pool.DeletionProtection ?? "INACTIVE",
  UserPoolTier: pool.UserPoolTier ?? "ESSENTIALS",
});

const userType = (user: StoredUser): Record<string, unknown> => ({
  Username: user.Username,
  Attributes: user.Attributes,
  UserCreateDate: user.UserCreateDate,
  UserLastModifiedDate: user.UserLastModifiedDate,
  Enabled: user.Enabled,
  UserStatus: user.UserStatus,
});

const clientType = (client: StoredClient): Record<string, unknown> => ({
  UserPoolId: client.UserPoolId,
  ClientName: client.ClientName,
  ClientId: client.ClientId,
  ClientSecret: client.ClientSecret,
  CreationDate: client.CreationDate,
  LastModifiedDate: client.LastModifiedDate,
  CallbackURLs: client.CallbackURLs ?? [],
  LogoutURLs: client.LogoutURLs ?? [],
  AllowedOAuthFlows: client.AllowedOAuthFlows ?? [],
  AllowedOAuthScopes: client.AllowedOAuthScopes ?? [],
  SupportedIdentityProviders: client.SupportedIdentityProviders ?? [],
  ExplicitAuthFlows: client.ExplicitAuthFlows ?? [],
  TokenValidityUnits: client.TokenValidityUnits ?? {},
  AccessTokenValidity: client.AccessTokenValidity,
  IdTokenValidity: client.IdTokenValidity,
  RefreshTokenValidity: client.RefreshTokenValidity,
  EnableTokenRevocation: client.EnableTokenRevocation,
});

const regionFromPoolId = (poolId: string): string => {
  const region = poolId.split("_")[0];
  return region !== undefined && region !== "" ? region : "us-east-1";
};

const issuerForPool = (poolId: string): string =>
  `https://cognito-idp.${regionFromPoolId(poolId)}.amazonaws.com/${poolId}`;

const STANDARD_ID_CLAIMS = new Set([
  "email",
  "email_verified",
  "phone_number",
  "phone_number_verified",
  "name",
  "given_name",
  "family_name",
  "preferred_username",
]);

const idClaimsFromUser = (
  user: StoredUser | undefined,
): Record<string, unknown> => {
  const claims: Record<string, unknown> = {};
  if (user === undefined) return claims;
  for (const attribute of user.Attributes) {
    if (attribute.Value === undefined) continue;
    if (
      attribute.Name === "email_verified" ||
      attribute.Name === "phone_number_verified"
    ) {
      claims[attribute.Name] = attribute.Value === "true";
    } else if (STANDARD_ID_CLAIMS.has(attribute.Name)) {
      claims[attribute.Name] = attribute.Value;
    } else if (attribute.Name === "sub") {
      claims["sub"] = attribute.Value;
    }
  }
  return claims;
};

type TokenContext = {
  poolId: string;
  username: string;
  clientId: string;
  user?: StoredUser;
  ctx?: ServiceContext;
};

const issueTokens = async (
  token: TokenContext,
): Promise<Record<string, unknown>> => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;
  const iss = issuerForPool(token.poolId);
  const extra = idClaimsFromUser(token.user);
  const sub = extra["sub"] as string;
  const groupEntries = token.ctx?.store.list<StoredGroup>() ?? [];
  const userGroups = groupEntries
    .filter(
      (e) =>
        e.key.startsWith(`group#${token.poolId}#`) &&
        Array.isArray(e.value.members) &&
        (e.value.members as string[]).includes(token.username),
    )
    .sort(
      (a, b) =>
        (a.value.Precedence ?? Number.MAX_SAFE_INTEGER) -
        (b.value.Precedence ?? Number.MAX_SAFE_INTEGER),
    )
    .map((e) => e.value.GroupName);
  const idClaims = {
    ...extra,
    ...(userGroups.length > 0 ? { "cognito:groups": userGroups } : {}),
    sub,
    iss,
    aud: token.clientId,
    token_use: "id",
    auth_time: now,
    iat: now,
    exp,
    "cognito:username": token.username,
    event_id: crypto.randomUUID(),
    jti: crypto.randomUUID(),
  };
  const accessClaims = {
    sub,
    iss,
    client_id: token.clientId,
    token_use: "access",
    scope: "aws.cognito.signin.user.admin",
    auth_time: now,
    iat: now,
    exp,
    version: 2,
    username: token.username,
    ...(userGroups.length > 0 ? { "cognito:groups": userGroups } : {}),
    jti: crypto.randomUUID(),
  };
  const refreshClaims = {
    sub: token.username,
    iss,
    client_id: token.clientId,
    token_use: "refresh" as const,
    iat: now,
    exp: now + 30 * 24 * 3600,
    jti: crypto.randomUUID(),
  };
  return {
    AccessToken: await signJwt(accessClaims),
    IdToken: await signJwt(idClaims),
    RefreshToken: await signJwt(refreshClaims),
    TokenType: "Bearer",
    ExpiresIn: 3600,
  };
};

const validateRefreshToken = async (
  refreshToken: string,
  clientId: string,
  ctx: ServiceContext,
): Promise<string> => {
  let payload: Record<string, unknown>;
  try {
    payload = await verifyJwt(refreshToken);
  } catch {
    throw awsError("NotAuthorizedException", "Invalid Refresh Token.", 400);
  }
  if (payload["token_use"] !== "refresh" || payload["client_id"] !== clientId) {
    throw awsError("NotAuthorizedException", "Invalid Refresh Token.", 400);
  }
  const jti = typeof payload["jti"] === "string" ? payload["jti"] : "";
  if (jti !== "" && ctx.store.get(revokedTokenKey(jti)) !== undefined) {
    throw awsError(
      "NotAuthorizedException",
      "Refresh token has been revoked.",
      400,
    );
  }
  const iss = typeof payload["iss"] === "string" ? payload["iss"] : "";
  const poolId = iss.split("/").pop() ?? "";
  const username = typeof payload["sub"] === "string" ? payload["sub"] : "";
  const iat = typeof payload["iat"] === "number" ? payload["iat"] : 0;
  const signoutTs = ctx.store.get<number>(signoutKey(poolId, username));
  if (signoutTs !== undefined && iat <= signoutTs) {
    throw awsError(
      "NotAuthorizedException",
      "Refresh token has been revoked.",
      400,
    );
  }
  return username;
};

const validateAccessToken = async (
  accessToken: string,
  ctx: ServiceContext,
): Promise<{ pool: StoredPool; user: StoredUser; username: string }> => {
  let payload: Record<string, unknown>;
  try {
    payload = await verifyJwt(accessToken);
  } catch {
    throw awsError("NotAuthorizedException", "Invalid Access Token.", 400);
  }
  if (payload["token_use"] !== "access") {
    throw awsError("NotAuthorizedException", "Invalid Access Token.", 400);
  }
  const iss = typeof payload["iss"] === "string" ? payload["iss"] : "";
  const poolId = iss.split("/").pop() ?? "";
  const username =
    typeof payload["username"] === "string" ? payload["username"] : "";
  const pool = ctx.store.get<StoredPool>(poolId);
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "User pool does not exist.",
      400,
    );
  }
  const user = pool.users[username];
  if (user === undefined) {
    throw awsError("UserNotFoundException", "User does not exist.", 400);
  }
  return { pool, user, username };
};

export const handleCognitoDiscovery = async (
  req: Request,
  url: URL,
): Promise<Response | undefined> => {
  if (req.method !== "GET") return undefined;
  const match = url.pathname.match(
    /^\/([^/]+)\/\.well-known\/(jwks\.json|openid-configuration)$/,
  );
  if (match === null) return undefined;
  const poolId = match[1];
  const headers = { "content-type": "application/json" };
  if (match[2] === "jwks.json") {
    return new Response(JSON.stringify(await publicJwks()), { headers });
  }
  const iss = issuerForPool(poolId);
  const config = {
    issuer: iss,
    jwks_uri: `${iss}/.well-known/jwks.json`,
    id_token_signing_alg_values_supported: ["RS256"],
    response_types_supported: ["code", "token"],
    subject_types_supported: ["public"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "none"],
  };
  return new Response(JSON.stringify(config), { headers });
};

const idpKey = (poolId: string, providerName: string): string =>
  `idp#${poolId}#${providerName}`;

const rsKey = (poolId: string, identifier: string): string =>
  `rs#${poolId}#${identifier}`;

const uijKey = (poolId: string, jobId: string): string =>
  `uij#${poolId}#${jobId}`;

const domainKey = (domain: string): string => `domain#${domain}`;

const replicaKey = (poolId: string, region: string): string =>
  `replica#${poolId}#${region}`;

const termsKey = (poolId: string): string => `terms#${poolId}`;

const mlbKey = (poolId: string, clientId?: string): string =>
  clientId ? `mlb#${poolId}#${clientId}` : `mlb#${poolId}`;

const tagsKey = (resourceArn: string): string => `tags#${resourceArn}`;

const logDeliveryKey = (poolId: string): string => `logdelivery#${poolId}`;

const riskConfigKey = (poolId: string, clientId?: string): string =>
  clientId ? `riskconfig#${poolId}#${clientId}` : `riskconfig#${poolId}`;

const uiCustomKey = (poolId: string, clientId?: string): string =>
  clientId ? `uicustom#${poolId}#${clientId}` : `uicustom#${poolId}`;

const mfaConfigKey = (poolId: string): string => `mfaconfig#${poolId}`;

const revokedTokenKey = (jti: string): string => `revoked#${jti}`;

const signoutKey = (poolId: string, username: string): string =>
  `signout#${poolId}#${username}`;

const deviceKey = (
  poolId: string,
  username: string,
  deviceKey: string,
): string => `device#${poolId}#${username}#${deviceKey}`;

const groupKey = (poolId: string, groupName: string): string =>
  `group#${poolId}#${groupName}`;

const groupType = (group: StoredGroup): Record<string, unknown> => ({
  GroupName: group.GroupName,
  UserPoolId: group.UserPoolId,
  Description: group.Description,
  RoleArn: group.RoleArn,
  Precedence: group.Precedence,
  CreationDate: group.CreationDate,
  LastModifiedDate: group.LastModifiedDate,
});

const requireGroup = (
  ctx: ServiceContext,
  poolId: string,
  groupName: string,
): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(groupKey(poolId, groupName));
  if (group === undefined) {
    throw awsError("ResourceNotFoundException", `Group not found.`, 400);
  }
  return group;
};

const deviceType = (device: StoredDevice): Record<string, unknown> => ({
  DeviceKey: device.DeviceKey,
  DeviceAttributes: device.DeviceAttributes,
  DeviceCreateDate: device.DeviceCreateDate,
  DeviceLastModifiedDate: device.DeviceLastModifiedDate,
  DeviceLastAuthenticatedDate: device.DeviceLastAuthenticatedDate,
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
    Policies:
      typeof input["Policies"] === "object" && input["Policies"] !== null
        ? (input["Policies"] as Record<string, unknown>)
        : {},
    DeletionProtection:
      typeof input["DeletionProtection"] === "string"
        ? (input["DeletionProtection"] as string)
        : "INACTIVE",
    AdminCreateUserConfig:
      typeof input["AdminCreateUserConfig"] === "object" &&
      input["AdminCreateUserConfig"] !== null
        ? (input["AdminCreateUserConfig"] as Record<string, unknown>)
        : { AllowAdminCreateUserOnly: false },
    UserPoolTier:
      typeof input["UserPoolTier"] === "string"
        ? (input["UserPoolTier"] as string)
        : "ESSENTIALS",
  };
  ctx.store.set(poolId, pool);
  if (
    typeof input["UserPoolTags"] === "object" &&
    input["UserPoolTags"] !== null
  ) {
    ctx.store.set(tagsKey(pool.Arn), input["UserPoolTags"] as StoredTags);
  }
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
    UserPools: entries
      .filter(
        (entry) =>
          !entry.key.startsWith("group#") &&
          !entry.key.startsWith("idp#") &&
          !entry.key.startsWith("rs#") &&
          !entry.key.startsWith("uij#") &&
          !entry.key.startsWith("domain#") &&
          !entry.key.startsWith("replica#") &&
          !entry.key.startsWith("terms#") &&
          !entry.key.startsWith("mlb#") &&
          !entry.key.startsWith("tags#") &&
          !entry.key.startsWith("logdelivery#") &&
          !entry.key.startsWith("riskconfig#") &&
          !entry.key.startsWith("uicustom#") &&
          !entry.key.startsWith("mfaconfig#") &&
          !entry.key.startsWith("device#"),
      )
      .filter(
        (entry) =>
          typeof entry.value.Id === "string" &&
          typeof entry.value.Name === "string",
      )
      .map((entry) => poolDescription(entry.value)),
  };
};

const DeleteUserPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  if (pool.DeletionProtection === "ACTIVE") {
    throw awsError(
      "InvalidParameterException",
      "This operation is not supported when deletion protection is ACTIVE.",
      400,
    );
  }
  ctx.store.delete(poolId);
  return {};
};

const UpdateUserPool: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const now = Math.floor(Date.now() / 1000);
  if (typeof input["MfaConfiguration"] === "string") {
    pool.MfaConfiguration = input["MfaConfiguration"] as string;
  }
  if (typeof input["Policies"] === "object" && input["Policies"] !== null) {
    pool.Policies = input["Policies"] as Record<string, unknown>;
  }
  if (typeof input["DeletionProtection"] === "string") {
    pool.DeletionProtection = input["DeletionProtection"] as string;
  }
  if (
    typeof input["AdminCreateUserConfig"] === "object" &&
    input["AdminCreateUserConfig"] !== null
  ) {
    pool.AdminCreateUserConfig = input["AdminCreateUserConfig"] as Record<
      string,
      unknown
    >;
  }
  pool.LastModifiedDate = now;
  ctx.store.set(poolId, pool);
  return {};
};

const AddCustomAttributes: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const attrs = Array.isArray(input["CustomAttributes"])
    ? input["CustomAttributes"]
    : [];
  if (!pool.CustomAttributes) pool.CustomAttributes = [];
  for (const attr of attrs) {
    if (typeof attr === "object" && attr !== null) {
      const a = attr as Record<string, unknown>;
      pool.CustomAttributes.push({
        AttributeDataType:
          typeof a["AttributeDataType"] === "string"
            ? (a["AttributeDataType"] as string)
            : "String",
        Name:
          typeof a["Name"] === "string"
            ? `custom:${a["Name"] as string}`
            : "custom:unknown",
        Mutable: a["Mutable"] !== false,
        Required: a["Required"] === true,
      });
    }
  }
  ctx.store.set(poolId, pool);
  return {};
};

const GetSigningCertificate: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  return { Certificate: "MIID...fakecert" };
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
    CallbackURLs: Array.isArray(input["CallbackURLs"])
      ? (input["CallbackURLs"] as string[])
      : [],
    LogoutURLs: Array.isArray(input["LogoutURLs"])
      ? (input["LogoutURLs"] as string[])
      : [],
    AllowedOAuthFlows: Array.isArray(input["AllowedOAuthFlows"])
      ? (input["AllowedOAuthFlows"] as string[])
      : [],
    AllowedOAuthScopes: Array.isArray(input["AllowedOAuthScopes"])
      ? (input["AllowedOAuthScopes"] as string[])
      : [],
    SupportedIdentityProviders: Array.isArray(
      input["SupportedIdentityProviders"],
    )
      ? (input["SupportedIdentityProviders"] as string[])
      : [],
    ExplicitAuthFlows: Array.isArray(input["ExplicitAuthFlows"])
      ? (input["ExplicitAuthFlows"] as string[])
      : [],
    EnableTokenRevocation: input["EnableTokenRevocation"] === true,
    secrets: [],
  };
  pool.clients[clientId] = client;
  ctx.store.set(poolId, pool);
  return { UserPoolClient: clientType(client) };
};

const DescribeUserPoolClient: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  const client = requireClient(pool, clientId);
  return { UserPoolClient: clientType(client) };
};

const UpdateUserPoolClient: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  const client = requireClient(pool, clientId);
  const now = Math.floor(Date.now() / 1000);
  if (typeof input["ClientName"] === "string")
    client.ClientName = input["ClientName"] as string;
  if (Array.isArray(input["CallbackURLs"]))
    client.CallbackURLs = input["CallbackURLs"] as string[];
  if (Array.isArray(input["LogoutURLs"]))
    client.LogoutURLs = input["LogoutURLs"] as string[];
  if (Array.isArray(input["AllowedOAuthFlows"]))
    client.AllowedOAuthFlows = input["AllowedOAuthFlows"] as string[];
  if (Array.isArray(input["AllowedOAuthScopes"]))
    client.AllowedOAuthScopes = input["AllowedOAuthScopes"] as string[];
  if (Array.isArray(input["SupportedIdentityProviders"]))
    client.SupportedIdentityProviders = input[
      "SupportedIdentityProviders"
    ] as string[];
  if (Array.isArray(input["ExplicitAuthFlows"]))
    client.ExplicitAuthFlows = input["ExplicitAuthFlows"] as string[];
  if (typeof input["EnableTokenRevocation"] === "boolean")
    client.EnableTokenRevocation = input["EnableTokenRevocation"] as boolean;
  client.LastModifiedDate = now;
  pool.clients[clientId] = client;
  ctx.store.set(poolId, pool);
  return { UserPoolClient: clientType(client) };
};

const DeleteUserPoolClient: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  requireClient(pool, clientId);
  delete pool.clients[clientId];
  ctx.store.set(poolId, pool);
  return {};
};

const ListUserPoolClients: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  return {
    UserPoolClients: Object.values(pool.clients).map((c) => ({
      ClientId: c.ClientId,
      ClientName: c.ClientName,
      UserPoolId: c.UserPoolId,
    })),
  };
};

const AddUserPoolClientSecret: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  const client = requireClient(pool, clientId);
  const secret = crypto.randomUUID().replace(/-/g, "");
  client.secrets.push(secret);
  pool.clients[clientId] = client;
  ctx.store.set(poolId, pool);
  return { ClientSecret: secret };
};

const DeleteUserPoolClientSecret: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  const client = requireClient(pool, clientId);
  const secretHash =
    typeof input["SecretHash"] === "string"
      ? (input["SecretHash"] as string)
      : "";
  client.secrets = client.secrets.filter((s) => s !== secretHash);
  pool.clients[clientId] = client;
  ctx.store.set(poolId, pool);
  return {};
};

const ListUserPoolClientSecrets: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  const client = requireClient(pool, clientId);
  return { SecretList: client.secrets };
};

const CreateIdentityProvider: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const providerName = requireString(input, "ProviderName");
  const providerType = requireString(input, "ProviderType");
  const now = Math.floor(Date.now() / 1000);
  const idp: StoredIdentityProvider = {
    UserPoolId: poolId,
    ProviderName: providerName,
    ProviderType: providerType,
    ProviderDetails:
      typeof input["ProviderDetails"] === "object" &&
      input["ProviderDetails"] !== null
        ? (input["ProviderDetails"] as Record<string, string>)
        : {},
    AttributeMapping:
      typeof input["AttributeMapping"] === "object" &&
      input["AttributeMapping"] !== null
        ? (input["AttributeMapping"] as Record<string, string>)
        : {},
    IdpIdentifiers: Array.isArray(input["IdpIdentifiers"])
      ? (input["IdpIdentifiers"] as string[])
      : [],
    CreationDate: now,
    LastModifiedDate: now,
  };
  ctx.store.set(idpKey(poolId, providerName), idp);
  return {
    IdentityProvider: {
      UserPoolId: idp.UserPoolId,
      ProviderName: idp.ProviderName,
      ProviderType: idp.ProviderType,
      ProviderDetails: idp.ProviderDetails,
      AttributeMapping: idp.AttributeMapping,
      IdpIdentifiers: idp.IdpIdentifiers,
      CreationDate: idp.CreationDate,
      LastModifiedDate: idp.LastModifiedDate,
    },
  };
};

const DescribeIdentityProvider: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const providerName = requireString(input, "ProviderName");
  const idp = ctx.store.get<StoredIdentityProvider>(
    idpKey(poolId, providerName),
  );
  if (idp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Identity provider ${providerName} does not exist.`,
      400,
    );
  }
  return {
    IdentityProvider: {
      UserPoolId: idp.UserPoolId,
      ProviderName: idp.ProviderName,
      ProviderType: idp.ProviderType,
      ProviderDetails: idp.ProviderDetails,
      AttributeMapping: idp.AttributeMapping,
      IdpIdentifiers: idp.IdpIdentifiers,
      CreationDate: idp.CreationDate,
      LastModifiedDate: idp.LastModifiedDate,
    },
  };
};

const GetIdentityProviderByIdentifier: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const identifier = requireString(input, "IdpIdentifier");
  const entries = ctx.store.list<StoredIdentityProvider>();
  const idp = entries
    .filter((e) => e.key.startsWith(`idp#${poolId}#`))
    .map((e) => e.value)
    .find((e) => (e.IdpIdentifiers ?? []).includes(identifier));
  if (idp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Identity provider with identifier ${identifier} does not exist.`,
      400,
    );
  }
  return {
    IdentityProvider: {
      UserPoolId: idp.UserPoolId,
      ProviderName: idp.ProviderName,
      ProviderType: idp.ProviderType,
      ProviderDetails: idp.ProviderDetails,
      AttributeMapping: idp.AttributeMapping,
      IdpIdentifiers: idp.IdpIdentifiers,
      CreationDate: idp.CreationDate,
      LastModifiedDate: idp.LastModifiedDate,
    },
  };
};

const UpdateIdentityProvider: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const providerName = requireString(input, "ProviderName");
  const key = idpKey(poolId, providerName);
  const idp = ctx.store.get<StoredIdentityProvider>(key);
  if (idp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Identity provider ${providerName} does not exist.`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof input["ProviderDetails"] === "object" &&
    input["ProviderDetails"] !== null
  ) {
    idp.ProviderDetails = input["ProviderDetails"] as Record<string, string>;
  }
  if (
    typeof input["AttributeMapping"] === "object" &&
    input["AttributeMapping"] !== null
  ) {
    idp.AttributeMapping = input["AttributeMapping"] as Record<string, string>;
  }
  if (Array.isArray(input["IdpIdentifiers"])) {
    idp.IdpIdentifiers = input["IdpIdentifiers"] as string[];
  }
  idp.LastModifiedDate = now;
  ctx.store.set(key, idp);
  return {
    IdentityProvider: {
      UserPoolId: idp.UserPoolId,
      ProviderName: idp.ProviderName,
      ProviderType: idp.ProviderType,
      ProviderDetails: idp.ProviderDetails,
      AttributeMapping: idp.AttributeMapping,
      IdpIdentifiers: idp.IdpIdentifiers,
      CreationDate: idp.CreationDate,
      LastModifiedDate: idp.LastModifiedDate,
    },
  };
};

const DeleteIdentityProvider: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const providerName = requireString(input, "ProviderName");
  const key = idpKey(poolId, providerName);
  const idp = ctx.store.get<StoredIdentityProvider>(key);
  if (idp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Identity provider ${providerName} does not exist.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListIdentityProviders: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const entries = ctx.store.list<StoredIdentityProvider>();
  return {
    Providers: entries
      .filter((e) => e.key.startsWith(`idp#${poolId}#`))
      .map((e) => ({
        ProviderName: e.value.ProviderName,
        ProviderType: e.value.ProviderType,
        CreationDate: e.value.CreationDate,
        LastModifiedDate: e.value.LastModifiedDate,
      })),
  };
};

const AdminDisableProviderForUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const user = input["User"] as Record<string, unknown> | undefined;
  if (!user)
    throw awsError("InvalidParameterException", "User is required.", 400);
  const username =
    typeof user["Username"] === "string" ? (user["Username"] as string) : "";
  if (username && pool.users[username]) {
    pool.users[username].UserStatus = "DISABLED";
    ctx.store.set(poolId, pool);
  }
  return {};
};

const AdminLinkProviderForUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  return {};
};

const CreateResourceServer: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const identifier = requireString(input, "Identifier");
  const name = requireString(input, "Name");
  const rs: StoredResourceServer = {
    UserPoolId: poolId,
    Identifier: identifier,
    Name: name,
    Scopes: Array.isArray(input["Scopes"])
      ? (input["Scopes"] as Array<{
          ScopeName: string;
          ScopeDescription: string;
        }>)
      : [],
  };
  ctx.store.set(rsKey(poolId, identifier), rs);
  return {
    ResourceServer: {
      UserPoolId: rs.UserPoolId,
      Identifier: rs.Identifier,
      Name: rs.Name,
      Scopes: rs.Scopes,
    },
  };
};

const DescribeResourceServer: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const identifier = requireString(input, "Identifier");
  const rs = ctx.store.get<StoredResourceServer>(rsKey(poolId, identifier));
  if (rs === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource server ${identifier} does not exist.`,
      400,
    );
  }
  return {
    ResourceServer: {
      UserPoolId: rs.UserPoolId,
      Identifier: rs.Identifier,
      Name: rs.Name,
      Scopes: rs.Scopes,
    },
  };
};

const UpdateResourceServer: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const identifier = requireString(input, "Identifier");
  const key = rsKey(poolId, identifier);
  const rs = ctx.store.get<StoredResourceServer>(key);
  if (rs === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource server ${identifier} does not exist.`,
      400,
    );
  }
  if (typeof input["Name"] === "string") rs.Name = input["Name"] as string;
  if (Array.isArray(input["Scopes"]))
    rs.Scopes = input["Scopes"] as Array<{
      ScopeName: string;
      ScopeDescription: string;
    }>;
  ctx.store.set(key, rs);
  return {
    ResourceServer: {
      UserPoolId: rs.UserPoolId,
      Identifier: rs.Identifier,
      Name: rs.Name,
      Scopes: rs.Scopes,
    },
  };
};

const DeleteResourceServer: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const identifier = requireString(input, "Identifier");
  const key = rsKey(poolId, identifier);
  const rs = ctx.store.get<StoredResourceServer>(key);
  if (rs === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource server ${identifier} does not exist.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListResourceServers: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const entries = ctx.store.list<StoredResourceServer>();
  return {
    ResourceServers: entries
      .filter((e) => e.key.startsWith(`rs#${poolId}#`))
      .map((e) => ({
        UserPoolId: e.value.UserPoolId,
        Identifier: e.value.Identifier,
        Name: e.value.Name,
        Scopes: e.value.Scopes,
      })),
  };
};

const CreateUserImportJob: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const jobName = requireString(input, "JobName");
  const cloudWatchLogsRoleArn = requireString(input, "CloudWatchLogsRoleArn");
  const now = Math.floor(Date.now() / 1000);
  const jobId = `import-${crypto.randomUUID().slice(0, 8)}`;
  const job: StoredUserImportJob = {
    JobName: jobName,
    JobId: jobId,
    UserPoolId: poolId,
    Status: "Created",
    CreationDate: now,
    CloudWatchLogsRoleArn: cloudWatchLogsRoleArn,
    ImportedUsers: 0,
    SkippedUsers: 0,
    FailedUsers: 0,
  };
  ctx.store.set(uijKey(poolId, jobId), job);
  return {
    UserImportJob: {
      JobName: job.JobName,
      JobId: job.JobId,
      UserPoolId: job.UserPoolId,
      Status: job.Status,
      CreationDate: job.CreationDate,
      CloudWatchLogsRoleArn: job.CloudWatchLogsRoleArn,
      ImportedUsers: job.ImportedUsers,
      SkippedUsers: job.SkippedUsers,
      FailedUsers: job.FailedUsers,
    },
  };
};

const DescribeUserImportJob: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const jobId = requireString(input, "JobId");
  const job = ctx.store.get<StoredUserImportJob>(uijKey(poolId, jobId));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User import job ${jobId} does not exist.`,
      400,
    );
  }
  return {
    UserImportJob: {
      JobName: job.JobName,
      JobId: job.JobId,
      UserPoolId: job.UserPoolId,
      Status: job.Status,
      CreationDate: job.CreationDate,
      StartDate: job.StartDate,
      CompletionDate: job.CompletionDate,
      CloudWatchLogsRoleArn: job.CloudWatchLogsRoleArn,
      ImportedUsers: job.ImportedUsers,
      SkippedUsers: job.SkippedUsers,
      FailedUsers: job.FailedUsers,
      CompletionMessage: job.CompletionMessage,
    },
  };
};

const ListUserImportJobs: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const entries = ctx.store.list<StoredUserImportJob>();
  return {
    UserImportJobs: entries
      .filter((e) => e.key.startsWith(`uij#${poolId}#`))
      .map((e) => ({
        JobName: e.value.JobName,
        JobId: e.value.JobId,
        UserPoolId: e.value.UserPoolId,
        Status: e.value.Status,
        CreationDate: e.value.CreationDate,
        CloudWatchLogsRoleArn: e.value.CloudWatchLogsRoleArn,
        ImportedUsers: e.value.ImportedUsers,
        SkippedUsers: e.value.SkippedUsers,
        FailedUsers: e.value.FailedUsers,
      })),
  };
};

const StartUserImportJob: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const jobId = requireString(input, "JobId");
  const key = uijKey(poolId, jobId);
  const job = ctx.store.get<StoredUserImportJob>(key);
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User import job ${jobId} does not exist.`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  job.Status = "Pending";
  job.StartDate = now;
  ctx.store.set(key, job);
  return {
    UserImportJob: {
      JobName: job.JobName,
      JobId: job.JobId,
      UserPoolId: job.UserPoolId,
      Status: job.Status,
      CreationDate: job.CreationDate,
      StartDate: job.StartDate,
      CloudWatchLogsRoleArn: job.CloudWatchLogsRoleArn,
      ImportedUsers: job.ImportedUsers,
      SkippedUsers: job.SkippedUsers,
      FailedUsers: job.FailedUsers,
    },
  };
};

const StopUserImportJob: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const jobId = requireString(input, "JobId");
  const key = uijKey(poolId, jobId);
  const job = ctx.store.get<StoredUserImportJob>(key);
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `User import job ${jobId} does not exist.`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  job.Status = "Stopped";
  job.CompletionDate = now;
  job.CompletionMessage = "Job stopped by user.";
  ctx.store.set(key, job);
  return {
    UserImportJob: {
      JobName: job.JobName,
      JobId: job.JobId,
      UserPoolId: job.UserPoolId,
      Status: job.Status,
      CreationDate: job.CreationDate,
      StartDate: job.StartDate,
      CompletionDate: job.CompletionDate,
      CloudWatchLogsRoleArn: job.CloudWatchLogsRoleArn,
      ImportedUsers: job.ImportedUsers,
      SkippedUsers: job.SkippedUsers,
      FailedUsers: job.FailedUsers,
      CompletionMessage: job.CompletionMessage,
    },
  };
};

const GetCSVHeader: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  return {
    UserPoolId: poolId,
    CSVHeader: [
      "cognito:username",
      "cognito:status",
      "name",
      "email",
      "phone_number",
      "email_verified",
      "phone_number_verified",
    ],
  };
};

const CreateUserPoolDomain: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "Domain");
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const now = Math.floor(Date.now() / 1000);
  const stored: StoredDomain = {
    Domain: domain,
    UserPoolId: poolId,
    Status: "ACTIVE",
    CloudFrontDistribution: `${crypto.randomUUID().slice(0, 12)}.cloudfront.net`,
    Version: "1",
    CustomDomainConfig:
      typeof input["CustomDomainConfig"] === "object" &&
      input["CustomDomainConfig"] !== null
        ? (input["CustomDomainConfig"] as Record<string, unknown>)
        : undefined,
  };
  ctx.store.set(domainKey(domain), stored);
  return { CloudFrontDomain: stored.CloudFrontDistribution };
};

const DescribeUserPoolDomain: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "Domain");
  const stored = ctx.store.get<StoredDomain>(domainKey(domain));
  if (stored === undefined) {
    return { DomainDescription: {} };
  }
  return {
    DomainDescription: {
      UserPoolId: stored.UserPoolId,
      AWSAccountId: ctx.account,
      Domain: stored.Domain,
      S3Bucket: stored.S3Bucket,
      CloudFrontDistribution: stored.CloudFrontDistribution,
      Version: stored.Version,
      Status: stored.Status,
      CustomDomainConfig: stored.CustomDomainConfig,
    },
  };
};

const UpdateUserPoolDomain: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "Domain");
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const key = domainKey(domain);
  const stored = ctx.store.get<StoredDomain>(key);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Domain ${domain} does not exist.`,
      400,
    );
  }
  if (
    typeof input["CustomDomainConfig"] === "object" &&
    input["CustomDomainConfig"] !== null
  ) {
    stored.CustomDomainConfig = input["CustomDomainConfig"] as Record<
      string,
      unknown
    >;
  }
  ctx.store.set(key, stored);
  return { CloudFrontDomain: stored.CloudFrontDistribution };
};

const DeleteUserPoolDomain: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "Domain");
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  ctx.store.delete(domainKey(domain));
  return {};
};

const CreateUserPoolReplica: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const replicaRegion = requireString(input, "ReplicaRegion");
  const now = Math.floor(Date.now() / 1000);
  const replica: StoredReplica = {
    UserPoolId: poolId,
    ReplicaRegion: replicaRegion,
    Status: "ACTIVE",
    UserPoolArn: `arn:aws:cognito-idp:${replicaRegion}:${ctx.account}:userpool/${poolId}`,
  };
  ctx.store.set(replicaKey(poolId, replicaRegion), replica);
  return {
    ReplicaConfiguration: {
      UserPoolId: poolId,
      SourceRegion: ctx.region,
      ReplicaRegion: replicaRegion,
      ReplicationRegions: [replicaRegion],
      UserPoolArn: replica.UserPoolArn,
      ReplicaPoolArn: replica.UserPoolArn,
      ReplicaStatus: replica.Status,
      CreationTime: now,
    },
  };
};

const UpdateUserPoolReplica: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const replicaRegion = requireString(input, "ReplicaRegion");
  const key = replicaKey(poolId, replicaRegion);
  const replica = ctx.store.get<StoredReplica>(key);
  if (replica === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Replica in region ${replicaRegion} does not exist.`,
      400,
    );
  }
  ctx.store.set(key, replica);
  return {
    ReplicaConfiguration: {
      UserPoolId: poolId,
      ReplicaRegion: replicaRegion,
      ReplicaStatus: replica.Status,
    },
  };
};

const DeleteUserPoolReplica: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const replicaRegion = requireString(input, "ReplicaRegion");
  ctx.store.delete(replicaKey(poolId, replicaRegion));
  return {};
};

const ListUserPoolReplicas: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const entries = ctx.store.list<StoredReplica>();
  return {
    UserPoolReplicaList: entries
      .filter((e) => e.key.startsWith(`replica#${poolId}#`))
      .map((e) => ({
        UserPoolId: e.value.UserPoolId,
        ReplicaRegion: e.value.ReplicaRegion,
        Status: e.value.Status,
        UserPoolArn: e.value.UserPoolArn,
      })),
  };
};

const CreateTerms: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const now = Math.floor(Date.now() / 1000);
  const versionId = `v${now}`;
  const terms: StoredTerms = {
    UserPoolId: poolId,
    DefaultVersion: versionId,
    Versions: {
      [versionId]: {
        TermsUrl:
          typeof input["TermsUrl"] === "string" ? input["TermsUrl"] : "",
        CreationDate: now,
      },
    },
  };
  ctx.store.set(termsKey(poolId), terms);
  return {
    Terms: {
      UserPoolId: poolId,
      DefaultVersion: terms.DefaultVersion,
      Versions: terms.Versions,
    },
  };
};

const DescribeTerms: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const terms = ctx.store.get<StoredTerms>(termsKey(poolId));
  if (terms === undefined) {
    return { Terms: { UserPoolId: poolId, Versions: {} } };
  }
  return {
    Terms: {
      UserPoolId: poolId,
      DefaultVersion: terms.DefaultVersion,
      Versions: terms.Versions,
    },
  };
};

const UpdateTerms: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const key = termsKey(poolId);
  const existing = ctx.store.get<StoredTerms>(key);
  const now = Math.floor(Date.now() / 1000);
  const versionId = `v${now}`;
  const terms: StoredTerms = existing ?? {
    UserPoolId: poolId,
    DefaultVersion: versionId,
    Versions: {},
  };
  terms.Versions[versionId] = {
    TermsUrl: typeof input["TermsUrl"] === "string" ? input["TermsUrl"] : "",
    CreationDate: now,
  };
  terms.DefaultVersion = versionId;
  ctx.store.set(key, terms);
  return {
    Terms: {
      UserPoolId: poolId,
      DefaultVersion: terms.DefaultVersion,
      Versions: terms.Versions,
    },
  };
};

const DeleteTerms: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  ctx.store.delete(termsKey(poolId));
  return {};
};

const ListTerms: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const terms = ctx.store.get<StoredTerms>(termsKey(poolId));
  return {
    Terms: terms
      ? Object.entries(terms.Versions).map(([versionId, v]) => ({
          VersionId: versionId,
          ...v,
        }))
      : [],
  };
};

const CreateManagedLoginBranding: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string"
      ? (input["ClientId"] as string)
      : undefined;
  const now = Math.floor(Date.now() / 1000);
  const brandingId = crypto.randomUUID().slice(0, 8);
  const branding: StoredManagedLoginBranding = {
    ManagedLoginBrandingId: brandingId,
    UserPoolId: poolId,
    ClientId: clientId,
    Assets: Array.isArray(input["Assets"]) ? input["Assets"] : [],
    Settings:
      typeof input["Settings"] === "object" && input["Settings"] !== null
        ? (input["Settings"] as Record<string, unknown>)
        : {},
    UseCognitoProvidedValues: input["UseCognitoProvidedValues"] === true,
    CreationDate: now,
    LastModifiedDate: now,
  };
  ctx.store.set(mlbKey(poolId, clientId), branding);
  return {
    ManagedLoginBranding: {
      ManagedLoginBrandingId: branding.ManagedLoginBrandingId,
      UserPoolId: branding.UserPoolId,
      ClientId: branding.ClientId,
      Assets: branding.Assets,
      Settings: branding.Settings,
      UseCognitoProvidedValues: branding.UseCognitoProvidedValues,
      CreationDate: branding.CreationDate,
      LastModifiedDate: branding.LastModifiedDate,
    },
  };
};

const DescribeManagedLoginBranding: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const brandingId =
    typeof input["ManagedLoginBrandingId"] === "string"
      ? (input["ManagedLoginBrandingId"] as string)
      : undefined;
  const entries = ctx.store.list<StoredManagedLoginBranding>();
  const branding = entries
    .filter((e) => e.key.startsWith(`mlb#${poolId}`))
    .map((e) => e.value)
    .find((e) => !brandingId || e.ManagedLoginBrandingId === brandingId);
  if (branding === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Managed login branding does not exist.`,
      400,
    );
  }
  return {
    ManagedLoginBranding: {
      ManagedLoginBrandingId: branding.ManagedLoginBrandingId,
      UserPoolId: branding.UserPoolId,
      ClientId: branding.ClientId,
      Assets: branding.Assets,
      Settings: branding.Settings,
      UseCognitoProvidedValues: branding.UseCognitoProvidedValues,
      CreationDate: branding.CreationDate,
      LastModifiedDate: branding.LastModifiedDate,
    },
  };
};

const DescribeManagedLoginBrandingByClient: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const clientId = requireString(input, "ClientId");
  const branding = ctx.store.get<StoredManagedLoginBranding>(
    mlbKey(poolId, clientId),
  );
  if (branding === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Managed login branding does not exist.`,
      400,
    );
  }
  return {
    ManagedLoginBranding: {
      ManagedLoginBrandingId: branding.ManagedLoginBrandingId,
      UserPoolId: branding.UserPoolId,
      ClientId: branding.ClientId,
      Assets: branding.Assets,
      Settings: branding.Settings,
      UseCognitoProvidedValues: branding.UseCognitoProvidedValues,
      CreationDate: branding.CreationDate,
      LastModifiedDate: branding.LastModifiedDate,
    },
  };
};

const UpdateManagedLoginBranding: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const brandingId =
    typeof input["ManagedLoginBrandingId"] === "string"
      ? (input["ManagedLoginBrandingId"] as string)
      : undefined;
  const entries = ctx.store.list<StoredManagedLoginBranding>();
  const found = entries
    .filter((e) => e.key.startsWith(`mlb#${poolId}`))
    .find((e) => !brandingId || e.value.ManagedLoginBrandingId === brandingId);
  if (found === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Managed login branding does not exist.`,
      400,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const branding = found.value;
  if (Array.isArray(input["Assets"])) branding.Assets = input["Assets"];
  if (typeof input["Settings"] === "object" && input["Settings"] !== null) {
    branding.Settings = input["Settings"] as Record<string, unknown>;
  }
  if (typeof input["UseCognitoProvidedValues"] === "boolean")
    branding.UseCognitoProvidedValues = input[
      "UseCognitoProvidedValues"
    ] as boolean;
  branding.LastModifiedDate = now;
  ctx.store.set(found.key, branding);
  return {
    ManagedLoginBranding: {
      ManagedLoginBrandingId: branding.ManagedLoginBrandingId,
      UserPoolId: branding.UserPoolId,
      ClientId: branding.ClientId,
      Assets: branding.Assets,
      Settings: branding.Settings,
      UseCognitoProvidedValues: branding.UseCognitoProvidedValues,
      CreationDate: branding.CreationDate,
      LastModifiedDate: branding.LastModifiedDate,
    },
  };
};

const DeleteManagedLoginBranding: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const brandingId =
    typeof input["ManagedLoginBrandingId"] === "string"
      ? (input["ManagedLoginBrandingId"] as string)
      : undefined;
  const entries = ctx.store.list<StoredManagedLoginBranding>();
  const found = entries
    .filter((e) => e.key.startsWith(`mlb#${poolId}`))
    .find((e) => !brandingId || e.value.ManagedLoginBrandingId === brandingId);
  if (found === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Managed login branding does not exist.`,
      400,
    );
  }
  ctx.store.delete(found.key);
  return {};
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
  const userSub = crypto.randomUUID();
  const user: StoredUser = {
    Username: username,
    Attributes: [
      { Name: "sub", Value: userSub },
      ...toAttributes(input["UserAttributes"]),
    ],
    UserCreateDate: now,
    UserLastModifiedDate: now,
    Enabled: true,
    UserStatus: "FORCE_CHANGE_PASSWORD",
    devices: {},
    webAuthnCredentials: {},
    mfaPreferences: {},
    userSettings: {},
  };
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return { User: userType(user) };
};

const AdminGetUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  return {
    Username: user.Username,
    UserAttributes: user.Attributes,
    UserCreateDate: user.UserCreateDate,
    UserLastModifiedDate: user.UserLastModifiedDate,
    Enabled: user.Enabled,
    UserStatus: user.UserStatus,
    MFAOptions: [],
  };
};

const AdminConfirmSignUp: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  user.UserStatus = "CONFIRMED";
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminDeleteUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  requireUser(pool, username);
  delete pool.users[username];
  ctx.store.set(poolId, pool);
  return {};
};

const AdminDeleteUserAttributes: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  const toDelete = Array.isArray(input["UserAttributeNames"])
    ? (input["UserAttributeNames"] as string[])
    : [];
  user.Attributes = user.Attributes.filter((a) => !toDelete.includes(a.Name));
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminDisableUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  user.Enabled = false;
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminEnableUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  user.Enabled = true;
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminUpdateUserAttributes: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  const newAttrs = toAttributes(input["UserAttributes"]);
  for (const attr of newAttrs) {
    const idx = user.Attributes.findIndex((a) => a.Name === attr.Name);
    if (idx >= 0) {
      user.Attributes[idx] = attr;
    } else {
      user.Attributes.push(attr);
    }
  }
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminSetUserPassword: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  const password = requireString(input, "Password");
  user.Password = password;
  const permanent = input["Permanent"] === true;
  if (permanent) user.UserStatus = "CONFIRMED";
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminSetUserSettings: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  user.userSettings =
    typeof input["MFAOptions"] === "object" && input["MFAOptions"] !== null
      ? { MFAOptions: input["MFAOptions"] }
      : {};
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminSetUserMFAPreference: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  if (
    typeof input["SMSMfaSettings"] === "object" &&
    input["SMSMfaSettings"] !== null
  ) {
    user.mfaPreferences["SMSMfaSettings"] = input["SMSMfaSettings"];
  }
  if (
    typeof input["SoftwareTokenMfaSettings"] === "object" &&
    input["SoftwareTokenMfaSettings"] !== null
  ) {
    user.mfaPreferences["SoftwareTokenMfaSettings"] =
      input["SoftwareTokenMfaSettings"];
  }
  if (
    typeof input["EmailMfaSettings"] === "object" &&
    input["EmailMfaSettings"] !== null
  ) {
    user.mfaPreferences["EmailMfaSettings"] = input["EmailMfaSettings"];
  }
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminResetUserPassword: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  user.UserStatus = "RESET_REQUIRED";
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminUserGlobalSignOut: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  requireUser(pool, username);
  return {};
};

const AdminListUserAuthEvents: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  requireUser(pool, username);
  return { AuthEvents: [] };
};

const AdminUpdateAuthEventFeedback: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  requireUser(pool, username);
  return {};
};

const AdminForgetDevice: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  const deviceKey = requireString(input, "DeviceKey");
  delete user.devices[deviceKey];
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const AdminGetDevice: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  const dKey = requireString(input, "DeviceKey");
  const device = user.devices[dKey];
  if (device === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Device ${dKey} does not exist.`,
      400,
    );
  }
  return { Device: deviceType(device) };
};

const AdminListDevices: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  return { Devices: Object.values(user.devices).map(deviceType) };
};

const AdminUpdateDeviceStatus: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const user = requireUser(pool, username);
  const dKey = requireString(input, "DeviceKey");
  const device = user.devices[dKey];
  if (
    device !== undefined &&
    typeof input["DeviceRememberedStatus"] === "string"
  ) {
    device.DeviceRememberedStatus = input["DeviceRememberedStatus"] as string;
    device.DeviceLastModifiedDate = Math.floor(Date.now() / 1000);
    user.devices[dKey] = device;
    pool.users[username] = user;
    ctx.store.set(poolId, pool);
  }
  return {};
};

const AdminInitiateAuth: OperationHandler = async (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string" ? (input["ClientId"] as string) : "";
  const authFlow = requireString(input, "AuthFlow");
  const authParams =
    typeof input["AuthParameters"] === "object" &&
    input["AuthParameters"] !== null
      ? (input["AuthParameters"] as Record<string, string>)
      : {};
  if (
    authFlow === "ADMIN_USER_PASSWORD_AUTH" ||
    authFlow === "USER_PASSWORD_AUTH"
  ) {
    const username = authParams["USERNAME"] ?? "";
    const user = pool.users[username];
    if (user === undefined) {
      throw awsError("UserNotFoundException", `User does not exist.`, 400);
    }
    if (!user.Enabled) {
      throw awsError("NotAuthorizedException", `User is disabled.`, 400);
    }
    const password = authParams["PASSWORD"] ?? "";
    if (user.Password === undefined || user.Password !== password) {
      throw awsError(
        "NotAuthorizedException",
        "Incorrect username or password.",
        400,
      );
    }
    if (user.UserStatus === "UNCONFIRMED") {
      throw awsError(
        "UserNotConfirmedException",
        "User is not confirmed.",
        400,
      );
    }
    const mfaSettings = user.mfaPreferences["SoftwareTokenMfaSettings"] as
      | Record<string, unknown>
      | undefined;
    if (mfaSettings?.["Enabled"] === true) {
      const sessionToken = randomBytes(32).toString("hex");
      const challengeSession: MfaChallengeSession = {
        poolId,
        clientId,
        username,
      };
      ctx.store.set(mfaChallengeKey(sessionToken), challengeSession);
      return {
        ChallengeName: "SOFTWARE_TOKEN_MFA",
        Session: sessionToken,
        ChallengeParameters: { USERNAME: username },
      };
    }
    return {
      AuthenticationResult: await issueTokens({
        poolId,
        username,
        clientId,
        user,
        ctx,
      }),
    };
  }
  if (authFlow === "REFRESH_TOKEN_AUTH" || authFlow === "REFRESH_TOKEN") {
    const refreshToken = authParams["REFRESH_TOKEN"] ?? "";
    const username = await validateRefreshToken(refreshToken, clientId, ctx);
    const tokens = await issueTokens({
      poolId,
      username,
      clientId,
      user: pool.users[username],
      ctx,
    });
    const { RefreshToken: _rt, ...withoutRefresh } = tokens;
    return { AuthenticationResult: withoutRefresh };
  }
  return { ChallengeName: "PASSWORD_VERIFIER", ChallengeParameters: {} };
};

const AdminRespondToAuthChallenge: OperationHandler = async (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string" ? (input["ClientId"] as string) : "";
  const challengeName =
    typeof input["ChallengeName"] === "string"
      ? (input["ChallengeName"] as string)
      : "";
  const challengeResponses =
    typeof input["ChallengeResponses"] === "object" &&
    input["ChallengeResponses"] !== null
      ? (input["ChallengeResponses"] as Record<string, string>)
      : {};
  const username = challengeResponses["USERNAME"] ?? "unknown";
  if (challengeName === "SOFTWARE_TOKEN_MFA") {
    const sessionToken =
      typeof input["Session"] === "string" ? input["Session"] : "";
    const pending = ctx.store.get<MfaChallengeSession>(
      mfaChallengeKey(sessionToken),
    );
    if (pending === undefined) {
      throw awsError("NotAuthorizedException", "Invalid session.", 400);
    }
    ctx.store.delete(mfaChallengeKey(sessionToken));
    const code = challengeResponses["SOFTWARE_TOKEN_MFA_CODE"] ?? "";
    if (code !== MFA_VALID_CODE) {
      throw awsError(
        "CodeMismatchException",
        "The provided code does not match what the server was expecting.",
        400,
      );
    }
    return {
      AuthenticationResult: await issueTokens({
        poolId,
        username,
        clientId,
        user: pool.users[username],
        ctx,
      }),
    };
  }
  return {
    AuthenticationResult: await issueTokens({
      poolId,
      username,
      clientId,
      user: pool.users[username],
      ctx,
    }),
  };
};

const InitiateAuth: OperationHandler = async (input, ctx) => {
  const authFlow = requireString(input, "AuthFlow");
  const clientId = requireString(input, "ClientId");
  const authParams =
    typeof input["AuthParameters"] === "object" &&
    input["AuthParameters"] !== null
      ? (input["AuthParameters"] as Record<string, string>)
      : {};
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      !entry.key.startsWith("uij#") &&
      !entry.key.startsWith("domain#") &&
      !entry.key.startsWith("replica#") &&
      !entry.key.startsWith("terms#") &&
      !entry.key.startsWith("mlb#") &&
      !entry.key.startsWith("tags#") &&
      !entry.key.startsWith("logdelivery#") &&
      !entry.key.startsWith("riskconfig#") &&
      !entry.key.startsWith("uicustom#") &&
      !entry.key.startsWith("mfaconfig#") &&
      !entry.key.startsWith("device#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      break;
    }
  }
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  if (
    authFlow === "USER_PASSWORD_AUTH" ||
    authFlow === "ADMIN_USER_PASSWORD_AUTH"
  ) {
    const username = authParams["USERNAME"] ?? "";
    const user = pool.users[username];
    if (user === undefined) {
      throw awsError("UserNotFoundException", `User does not exist.`, 400);
    }
    const password = authParams["PASSWORD"] ?? "";
    if (user.Password === undefined || user.Password !== password) {
      throw awsError(
        "NotAuthorizedException",
        "Incorrect username or password.",
        400,
      );
    }
    if (user.UserStatus === "UNCONFIRMED") {
      throw awsError(
        "UserNotConfirmedException",
        "User is not confirmed.",
        400,
      );
    }
    const mfaSettings = user.mfaPreferences["SoftwareTokenMfaSettings"] as
      | Record<string, unknown>
      | undefined;
    if (mfaSettings?.["Enabled"] === true) {
      const sessionToken = randomBytes(32).toString("hex");
      const challengeSession: MfaChallengeSession = {
        poolId: pool.Id,
        clientId,
        username,
      };
      ctx.store.set(mfaChallengeKey(sessionToken), challengeSession);
      return {
        ChallengeName: "SOFTWARE_TOKEN_MFA",
        Session: sessionToken,
        ChallengeParameters: { USERNAME: username },
      };
    }
    return {
      AuthenticationResult: await issueTokens({
        poolId: pool.Id,
        username,
        clientId,
        user,
        ctx,
      }),
    };
  }
  if (authFlow === "REFRESH_TOKEN_AUTH" || authFlow === "REFRESH_TOKEN") {
    const refreshToken = authParams["REFRESH_TOKEN"] ?? "";
    const username = await validateRefreshToken(refreshToken, clientId, ctx);
    const tokens = await issueTokens({
      poolId: pool.Id,
      username,
      clientId,
      user: pool.users[username],
      ctx,
    });
    const { RefreshToken: _rt, ...withoutRefresh } = tokens;
    return { AuthenticationResult: withoutRefresh };
  }
  if (authFlow === "USER_SRP_AUTH") {
    const username = authParams["USERNAME"] ?? "";
    const srpA = authParams["SRP_A"] ?? "";
    const user = pool.users[username];
    if (user === undefined) {
      throw awsError("UserNotFoundException", `User does not exist.`, 400);
    }
    if (!user.Enabled) {
      throw awsError("NotAuthorizedException", `User is disabled.`, 400);
    }
    const password = user.Password ?? "";
    const poolName = pool.Id.split("_")[1] ?? pool.Id;
    const saltRaw = randomBytes(16);
    const saltBigInt = BigInt(`0x${saltRaw.toString("hex")}`);
    const saltHex = srpPadHex(saltBigInt);
    const innerHash = createHash("sha256")
      .update(`${poolName}${username}:${password}`, "utf8")
      .digest("hex");
    const x = srpDigest(saltHex + innerHash);
    const v = modPow(SRP_g, x, SRP_N);
    const b = BigInt(`0x${randomBytes(32).toString("hex")}`);
    const B = (((SRP_k * v) % SRP_N) + modPow(SRP_g, b, SRP_N)) % SRP_N;
    const secretBlockBytes = randomBytes(128);
    const secretBlock = secretBlockBytes.toString("base64");
    const session: SrpSession = {
      poolId: pool.Id,
      clientId,
      username,
      b: b.toString(16),
      v: v.toString(16),
      srpA,
      salt: saltHex,
      secretBlock,
    };
    ctx.store.set(srpSessionKey(pool.Id, username), session);
    return {
      ChallengeName: "PASSWORD_VERIFIER",
      ChallengeParameters: {
        SRP_B: srpPadHex(B),
        SALT: saltHex,
        SECRET_BLOCK: secretBlock,
        USER_ID_FOR_SRP: username,
        USERNAME: username,
      },
    };
  }
  return { ChallengeName: "PASSWORD_VERIFIER", ChallengeParameters: {} };
};

const RespondToAuthChallenge: OperationHandler = async (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const challengeName =
    typeof input["ChallengeName"] === "string"
      ? (input["ChallengeName"] as string)
      : "";
  const challengeResponses =
    typeof input["ChallengeResponses"] === "object" &&
    input["ChallengeResponses"] !== null
      ? (input["ChallengeResponses"] as Record<string, string>)
      : {};
  const username = challengeResponses["USERNAME"] ?? "unknown";
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      break;
    }
  }
  if (challengeName === "SOFTWARE_TOKEN_MFA") {
    const sessionToken =
      typeof input["Session"] === "string" ? input["Session"] : "";
    const pending = ctx.store.get<MfaChallengeSession>(
      mfaChallengeKey(sessionToken),
    );
    if (pending === undefined) {
      throw awsError("NotAuthorizedException", "Invalid session.", 400);
    }
    ctx.store.delete(mfaChallengeKey(sessionToken));
    const code = challengeResponses["SOFTWARE_TOKEN_MFA_CODE"] ?? "";
    if (code !== MFA_VALID_CODE) {
      throw awsError(
        "CodeMismatchException",
        "The provided code does not match what the server was expecting.",
        400,
      );
    }
    const mfaPool = ctx.store.get<StoredPool>(pending.poolId);
    return {
      AuthenticationResult: await issueTokens({
        poolId: pending.poolId,
        username: pending.username,
        clientId: pending.clientId,
        user: mfaPool?.users[pending.username],
        ctx,
      }),
    };
  }
  if (pool !== undefined && challengeName === "PASSWORD_VERIFIER") {
    const session = ctx.store.get<SrpSession>(srpSessionKey(pool.Id, username));
    if (session !== undefined) {
      const signature = challengeResponses["PASSWORD_CLAIM_SIGNATURE"] ?? "";
      const secretBlock =
        challengeResponses["PASSWORD_CLAIM_SECRET_BLOCK"] ?? "";
      const timestamp = challengeResponses["TIMESTAMP"] ?? "";
      ctx.store.delete(srpSessionKey(pool.Id, username));
      if (secretBlock !== session.secretBlock) {
        throw awsError(
          "NotAuthorizedException",
          "Incorrect username or password.",
          400,
        );
      }
      const A = BigInt(`0x${session.srpA}`);
      const v = BigInt(`0x${session.v}`);
      const b = BigInt(`0x${session.b}`);
      const B = (((SRP_k * v) % SRP_N) + modPow(SRP_g, b, SRP_N)) % SRP_N;
      const u = srpDigest(srpPadHex(A) + srpPadHex(B));
      const S = modPow(
        (((A * modPow(v, u, SRP_N)) % SRP_N) + SRP_N) % SRP_N,
        b,
        SRP_N,
      );
      const K = srpHkdf(S, u);
      const secretBlockBytes = Buffer.from(secretBlock, "base64");
      const poolName = pool.Id.split("_")[1] ?? pool.Id;
      const expectedSig = createHmac("sha256", K)
        .update(poolName, "utf8")
        .update(username, "utf8")
        .update(secretBlockBytes)
        .update(timestamp, "utf8")
        .digest("base64");
      if (signature !== expectedSig) {
        throw awsError(
          "NotAuthorizedException",
          "Incorrect username or password.",
          400,
        );
      }
      return {
        AuthenticationResult: await issueTokens({
          poolId: pool.Id,
          username,
          clientId,
          user: pool.users[username],
          ctx,
        }),
      };
    }
  }
  return {
    AuthenticationResult: await issueTokens({
      poolId: pool?.Id ?? "unknown",
      username,
      clientId,
      user: pool?.users[username],
      ctx,
    }),
  };
};

const GetTokensFromRefreshToken: OperationHandler = async (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const username =
    typeof input["Username"] === "string"
      ? (input["Username"] as string)
      : "unknown";
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      break;
    }
  }
  return {
    AuthenticationResult: await issueTokens({
      poolId: pool?.Id ?? "unknown",
      username,
      clientId,
      user: pool?.users[username],
      ctx,
    }),
  };
};

const SignUp: OperationHandler = (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const username = requireString(input, "Username");
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  let poolId = "";
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      !entry.key.startsWith("uij#") &&
      !entry.key.startsWith("domain#") &&
      !entry.key.startsWith("replica#") &&
      !entry.key.startsWith("terms#") &&
      !entry.key.startsWith("mlb#") &&
      !entry.key.startsWith("tags#") &&
      !entry.key.startsWith("logdelivery#") &&
      !entry.key.startsWith("riskconfig#") &&
      !entry.key.startsWith("uicustom#") &&
      !entry.key.startsWith("mfaconfig#") &&
      !entry.key.startsWith("device#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      poolId = entry.key;
      break;
    }
  }
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  if (pool.users[username] !== undefined) {
    throw awsError("UsernameExistsException", `User already exists.`, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const userSub = crypto.randomUUID();
  const user: StoredUser = {
    Username: username,
    Attributes: [
      { Name: "sub", Value: userSub },
      ...toAttributes(input["UserAttributes"]),
    ],
    UserCreateDate: now,
    UserLastModifiedDate: now,
    Enabled: true,
    UserStatus: "UNCONFIRMED",
    Password:
      typeof input["Password"] === "string"
        ? (input["Password"] as string)
        : undefined,
    devices: {},
    webAuthnCredentials: {},
    mfaPreferences: {},
    userSettings: {},
  };
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {
    UserConfirmed: false,
    UserSub: userSub,
  };
};

const ConfirmSignUp: OperationHandler = (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const username = requireString(input, "Username");
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  let poolId = "";
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      poolId = entry.key;
      break;
    }
  }
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  const user = pool.users[username];
  if (user === undefined) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  user.UserStatus = "CONFIRMED";
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const ForgotPassword: OperationHandler = (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const username = requireString(input, "Username");
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      break;
    }
  }
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  if (!pool.users[username]) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  return {
    CodeDeliveryDetails: {
      AttributeName: "email",
      DeliveryMedium: "EMAIL",
      Destination: "***@example.com",
    },
  };
};

const ConfirmForgotPassword: OperationHandler = (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const username = requireString(input, "Username");
  const password = requireString(input, "Password");
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  let poolId = "";
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      poolId = entry.key;
      break;
    }
  }
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  const user = pool.users[username];
  if (user === undefined) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  user.Password = password;
  user.UserStatus = "CONFIRMED";
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(poolId, pool);
  return {};
};

const ChangePassword: OperationHandler = (_input, _ctx) => {
  return {};
};

const ResendConfirmationCode: OperationHandler = (input, ctx) => {
  const clientId = requireString(input, "ClientId");
  const username = requireString(input, "Username");
  const entries = ctx.store.list<StoredPool>();
  let pool: StoredPool | undefined;
  for (const entry of entries) {
    if (
      !entry.key.startsWith("group#") &&
      !entry.key.startsWith("idp#") &&
      !entry.key.startsWith("rs#") &&
      typeof entry.value.Id === "string" &&
      entry.value.clients?.[clientId] !== undefined
    ) {
      pool = entry.value;
      break;
    }
  }
  if (pool === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Client ${clientId} does not exist.`,
      400,
    );
  }
  if (!pool.users[username]) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  return {
    CodeDeliveryDetails: {
      AttributeName: "email",
      DeliveryMedium: "EMAIL",
      Destination: "***@example.com",
    },
  };
};

const GetUser: OperationHandler = async (input, ctx) => {
  const accessToken =
    typeof input["AccessToken"] === "string" ? input["AccessToken"] : "";
  const { user, username } = await validateAccessToken(accessToken, ctx);
  const mfaSettings = user.mfaPreferences["SoftwareTokenMfaSettings"] as
    | Record<string, unknown>
    | undefined;
  const softwareEnabled = mfaSettings?.["Enabled"] === true;
  return {
    Username: username,
    UserAttributes: user.Attributes,
    MFAOptions: [],
    PreferredMfaSetting: softwareEnabled ? "SOFTWARE_TOKEN_MFA" : undefined,
    UserMFASettingList: softwareEnabled ? ["SOFTWARE_TOKEN_MFA"] : [],
  };
};

const GetUserAttributeVerificationCode: OperationHandler = (input, ctx) => {
  return {
    CodeDeliveryDetails: {
      AttributeName:
        typeof input["AttributeName"] === "string"
          ? input["AttributeName"]
          : "email",
      DeliveryMedium: "EMAIL",
      Destination: "***@example.com",
    },
  };
};

const GetUserAuthFactors: OperationHandler = (_input, _ctx) => {
  return {
    Username: "unknown",
    PreferredMfaSetting: "SOFTWARE_TOKEN_MFA",
    UserMFASettingList: ["SOFTWARE_TOKEN_MFA"],
  };
};

const VerifyUserAttribute: OperationHandler = (_input, _ctx) => {
  return {};
};

const UpdateUserAttributes: OperationHandler = async (input, ctx) => {
  const accessToken =
    typeof input["AccessToken"] === "string" ? input["AccessToken"] : "";
  const { pool, user, username } = await validateAccessToken(accessToken, ctx);
  const newAttrs = toAttributes(input["UserAttributes"]);
  for (const attr of newAttrs) {
    const idx = user.Attributes.findIndex((a) => a.Name === attr.Name);
    if (idx >= 0) {
      user.Attributes[idx] = attr;
    } else {
      user.Attributes.push(attr);
    }
  }
  user.UserLastModifiedDate = Math.floor(Date.now() / 1000);
  pool.users[username] = user;
  ctx.store.set(pool.Id, pool);
  return { CodeDeliveryDetailsList: [] };
};

const DeleteUser: OperationHandler = (_input, _ctx) => {
  return {};
};

const DeleteUserAttributes: OperationHandler = (_input, _ctx) => {
  return {};
};

const SetUserSettings: OperationHandler = (_input, _ctx) => {
  return {};
};

const SetUserMFAPreference: OperationHandler = async (input, ctx) => {
  const accessToken =
    typeof input["AccessToken"] === "string" ? input["AccessToken"] : "";
  const { user } = await validateAccessToken(accessToken, ctx);
  if (
    typeof input["SoftwareTokenMfaSettings"] === "object" &&
    input["SoftwareTokenMfaSettings"] !== null
  ) {
    user.mfaPreferences["SoftwareTokenMfaSettings"] =
      input["SoftwareTokenMfaSettings"];
  }
  if (
    typeof input["SMSMfaSettings"] === "object" &&
    input["SMSMfaSettings"] !== null
  ) {
    user.mfaPreferences["SMSMfaSettings"] = input["SMSMfaSettings"];
  }
  return {};
};

const GlobalSignOut: OperationHandler = async (input, ctx) => {
  const accessToken = requireString(input, "AccessToken");
  const { pool, username } = await validateAccessToken(accessToken, ctx);
  const now = Math.floor(Date.now() / 1000);
  ctx.store.set(signoutKey(pool.Id, username), now);
  return {};
};

const RevokeToken: OperationHandler = async (input, ctx) => {
  const token = requireString(input, "Token");
  let payload: Record<string, unknown>;
  try {
    payload = await verifyJwt(token);
  } catch {
    return {};
  }
  const jti = typeof payload["jti"] === "string" ? payload["jti"] : "";
  if (jti !== "") {
    ctx.store.set(revokedTokenKey(jti), true);
  }
  return {};
};

const UpdateAuthEventFeedback: OperationHandler = (_input, _ctx) => {
  return {};
};

const ConfirmDevice: OperationHandler = (input, ctx) => {
  return { UserConfirmationNecessary: false };
};

const ForgetDevice: OperationHandler = (_input, _ctx) => {
  return {};
};

const GetDevice: OperationHandler = (input, ctx) => {
  const dKey = requireString(input, "DeviceKey");
  return {
    Device: {
      DeviceKey: dKey,
      DeviceAttributes: [],
      DeviceCreateDate: Math.floor(Date.now() / 1000),
      DeviceLastModifiedDate: Math.floor(Date.now() / 1000),
      DeviceLastAuthenticatedDate: Math.floor(Date.now() / 1000),
    },
  };
};

const ListDevices: OperationHandler = (_input, _ctx) => {
  return { Devices: [] };
};

const UpdateDeviceStatus: OperationHandler = (_input, _ctx) => {
  return {};
};

const AssociateSoftwareToken: OperationHandler = async (input, ctx) => {
  const accessToken =
    typeof input["AccessToken"] === "string" ? input["AccessToken"] : undefined;
  const session =
    typeof input["Session"] === "string" ? input["Session"] : undefined;
  if (accessToken !== undefined && accessToken !== "") {
    await validateAccessToken(accessToken, ctx);
  } else if (session !== undefined && session !== "") {
    const pending = ctx.store.get<MfaChallengeSession>(
      mfaChallengeKey(session),
    );
    if (pending === undefined) {
      throw awsError("NotAuthorizedException", "Invalid session.", 400);
    }
  } else {
    throw awsError(
      "InvalidParameterException",
      "Either AccessToken or Session is required.",
      400,
    );
  }
  return { SecretCode: "BUNSAISIMTOTP000000000000000000" };
};

const VerifySoftwareToken: OperationHandler = async (input, ctx) => {
  const accessToken =
    typeof input["AccessToken"] === "string" ? input["AccessToken"] : undefined;
  const session =
    typeof input["Session"] === "string" ? input["Session"] : undefined;
  let pool: StoredPool;
  let user: StoredUser;
  if (accessToken !== undefined && accessToken !== "") {
    const result = await validateAccessToken(accessToken, ctx);
    pool = result.pool;
    user = result.user;
  } else if (session !== undefined && session !== "") {
    const pending = ctx.store.get<MfaChallengeSession>(
      mfaChallengeKey(session),
    );
    if (pending === undefined) {
      throw awsError("NotAuthorizedException", "Invalid session.", 400);
    }
    const p = ctx.store.get<StoredPool>(pending.poolId);
    if (p === undefined) {
      throw awsError(
        "ResourceNotFoundException",
        "User pool does not exist.",
        400,
      );
    }
    pool = p;
    user = pool.users[pending.username];
    if (user === undefined) {
      throw awsError("UserNotFoundException", "User does not exist.", 400);
    }
  } else {
    throw awsError(
      "InvalidParameterException",
      "Either AccessToken or Session is required.",
      400,
    );
  }
  void pool;
  user.softwareTokenVerified = true;
  return { Status: "SUCCESS" };
};

const StartWebAuthnRegistration: OperationHandler = (_input, _ctx) => {
  return {
    CredentialCreationOptions: {
      publicKey: {
        challenge: "fakechallenge",
        rp: { name: "Fake RP", id: "localhost" },
        user: { id: "fakeuserid", name: "fakeuser", displayName: "Fake User" },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60000,
      },
    },
  };
};

const CompleteWebAuthnRegistration: OperationHandler = (_input, _ctx) => {
  return {};
};

const DeleteWebAuthnCredential: OperationHandler = (_input, _ctx) => {
  return {};
};

const ListWebAuthnCredentials: OperationHandler = (_input, _ctx) => {
  return { Credentials: [] };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const poolIdMatch = resourceArn.match(
    /arn:aws:cognito-idp:[^:]+:[^:]+:userpool\/(.+)/,
  );
  if (!poolIdMatch) {
    throw awsError("ResourceNotFoundException", `Resource not found.`, 400);
  }
  requirePool(ctx, poolIdMatch[1]);
  const tags =
    typeof input["Tags"] === "object" && input["Tags"] !== null
      ? (input["Tags"] as Record<string, string>)
      : {};
  const key = tagsKey(resourceArn);
  const existing = ctx.store.get<StoredTags>(key) ?? {};
  Object.assign(existing, tags);
  ctx.store.set(key, existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const key = tagsKey(resourceArn);
  const existing = ctx.store.get<StoredTags>(key) ?? {};
  for (const tagKey of tagKeys) {
    delete existing[tagKey];
  }
  ctx.store.set(key, existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<StoredTags>(tagsKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const SetLogDeliveryConfiguration: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const logConfigs = Array.isArray(input["LogConfigurations"])
    ? input["LogConfigurations"]
    : [];
  const stored: StoredLogDelivery = {
    UserPoolId: poolId,
    LogConfigurations: logConfigs,
  };
  ctx.store.set(logDeliveryKey(poolId), stored);
  return {
    LogDeliveryConfiguration: {
      UserPoolId: poolId,
      LogConfigurations: logConfigs,
    },
  };
};

const GetLogDeliveryConfiguration: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const stored = ctx.store.get<StoredLogDelivery>(logDeliveryKey(poolId));
  return {
    LogDeliveryConfiguration: {
      UserPoolId: poolId,
      LogConfigurations: stored?.LogConfigurations ?? [],
    },
  };
};

const SetRiskConfiguration: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string"
      ? (input["ClientId"] as string)
      : undefined;
  const now = Math.floor(Date.now() / 1000);
  const config: StoredRiskConfig = {
    UserPoolId: poolId,
    ClientId: clientId,
    CompromisedCredentialsRiskConfiguration:
      typeof input["CompromisedCredentialsRiskConfiguration"] === "object" &&
      input["CompromisedCredentialsRiskConfiguration"] !== null
        ? (input["CompromisedCredentialsRiskConfiguration"] as Record<
            string,
            unknown
          >)
        : undefined,
    AccountTakeoverRiskConfiguration:
      typeof input["AccountTakeoverRiskConfiguration"] === "object" &&
      input["AccountTakeoverRiskConfiguration"] !== null
        ? (input["AccountTakeoverRiskConfiguration"] as Record<string, unknown>)
        : undefined,
    RiskExceptionConfiguration:
      typeof input["RiskExceptionConfiguration"] === "object" &&
      input["RiskExceptionConfiguration"] !== null
        ? (input["RiskExceptionConfiguration"] as Record<string, unknown>)
        : undefined,
  };
  ctx.store.set(riskConfigKey(poolId, clientId), config);
  return {
    RiskConfiguration: {
      UserPoolId: poolId,
      ClientId: clientId,
      CompromisedCredentialsRiskConfiguration:
        config.CompromisedCredentialsRiskConfiguration,
      AccountTakeoverRiskConfiguration: config.AccountTakeoverRiskConfiguration,
      RiskExceptionConfiguration: config.RiskExceptionConfiguration,
      LastModifiedDate: now,
    },
  };
};

const DescribeRiskConfiguration: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string"
      ? (input["ClientId"] as string)
      : undefined;
  const config = ctx.store.get<StoredRiskConfig>(
    riskConfigKey(poolId, clientId),
  );
  return {
    RiskConfiguration: {
      UserPoolId: poolId,
      ClientId: clientId,
      CompromisedCredentialsRiskConfiguration:
        config?.CompromisedCredentialsRiskConfiguration,
      AccountTakeoverRiskConfiguration:
        config?.AccountTakeoverRiskConfiguration,
      RiskExceptionConfiguration: config?.RiskExceptionConfiguration,
    },
  };
};

const SetUICustomization: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string"
      ? (input["ClientId"] as string)
      : undefined;
  const now = Math.floor(Date.now() / 1000);
  const customization: StoredUiCustomization = {
    UserPoolId: poolId,
    ClientId: clientId,
    CSS:
      typeof input["CSS"] === "string" ? (input["CSS"] as string) : undefined,
    ImageUrl:
      typeof input["ImageFileData"] === "string"
        ? "https://example.com/logo.png"
        : undefined,
    CreationDate: now,
    LastModifiedDate: now,
  };
  ctx.store.set(uiCustomKey(poolId, clientId), customization);
  return {
    UICustomization: {
      UserPoolId: poolId,
      ClientId: clientId,
      CSS: customization.CSS,
      ImageUrl: customization.ImageUrl,
      CreationDate: now,
      LastModifiedDate: now,
    },
  };
};

const GetUICustomization: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const clientId =
    typeof input["ClientId"] === "string"
      ? (input["ClientId"] as string)
      : undefined;
  const customization = ctx.store.get<StoredUiCustomization>(
    uiCustomKey(poolId, clientId),
  );
  const now = Math.floor(Date.now() / 1000);
  return {
    UICustomization: {
      UserPoolId: poolId,
      ClientId: clientId,
      CSS: customization?.CSS,
      ImageUrl: customization?.ImageUrl,
      CreationDate: customization?.CreationDate ?? now,
      LastModifiedDate: customization?.LastModifiedDate ?? now,
    },
  };
};

const SetUserPoolMfaConfig: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const mfaConfig: StoredMfaConfig = {
    UserPoolId: poolId,
    SmsMfaConfiguration:
      typeof input["SmsMfaConfiguration"] === "object" &&
      input["SmsMfaConfiguration"] !== null
        ? (input["SmsMfaConfiguration"] as Record<string, unknown>)
        : undefined,
    SoftwareTokenMfaConfiguration:
      typeof input["SoftwareTokenMfaConfiguration"] === "object" &&
      input["SoftwareTokenMfaConfiguration"] !== null
        ? (input["SoftwareTokenMfaConfiguration"] as Record<string, unknown>)
        : undefined,
    EmailMfaConfiguration:
      typeof input["EmailMfaConfiguration"] === "object" &&
      input["EmailMfaConfiguration"] !== null
        ? (input["EmailMfaConfiguration"] as Record<string, unknown>)
        : undefined,
    WebAuthnConfiguration:
      typeof input["WebAuthnConfiguration"] === "object" &&
      input["WebAuthnConfiguration"] !== null
        ? (input["WebAuthnConfiguration"] as Record<string, unknown>)
        : undefined,
    MfaConfiguration:
      typeof input["MfaConfiguration"] === "string"
        ? (input["MfaConfiguration"] as string)
        : "OFF",
  };
  ctx.store.set(mfaConfigKey(poolId), mfaConfig);
  return {
    SmsMfaConfiguration: mfaConfig.SmsMfaConfiguration,
    SoftwareTokenMfaConfiguration: mfaConfig.SoftwareTokenMfaConfiguration,
    EmailMfaConfiguration: mfaConfig.EmailMfaConfiguration,
    WebAuthnConfiguration: mfaConfig.WebAuthnConfiguration,
    MfaConfiguration: mfaConfig.MfaConfiguration,
  };
};

const GetUserPoolMfaConfig: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const mfaConfig = ctx.store.get<StoredMfaConfig>(mfaConfigKey(poolId));
  const pool = requirePool(ctx, poolId);
  return {
    SmsMfaConfiguration: mfaConfig?.SmsMfaConfiguration,
    SoftwareTokenMfaConfiguration: mfaConfig?.SoftwareTokenMfaConfiguration,
    EmailMfaConfiguration: mfaConfig?.EmailMfaConfiguration,
    WebAuthnConfiguration: mfaConfig?.WebAuthnConfiguration,
    MfaConfiguration: mfaConfig?.MfaConfiguration ?? pool.MfaConfiguration,
  };
};

const ListUsers: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const limit =
    typeof input["Limit"] === "number" ? (input["Limit"] as number) : 60;
  const paginationToken =
    typeof input["PaginationToken"] === "string"
      ? (input["PaginationToken"] as string)
      : undefined;
  const filterStr =
    typeof input["Filter"] === "string"
      ? (input["Filter"] as string)
      : undefined;

  let users = Object.values(pool.users);

  if (filterStr !== undefined && filterStr !== "") {
    const filterMatch = filterStr.match(/^(\S+)\s*(=|\^=|!=)\s*"([^"]*)"$/);
    if (filterMatch !== null) {
      const attrName = filterMatch[1] as string;
      const operator = filterMatch[2] as string;
      const value = filterMatch[3] as string;
      users = users.filter((user) => {
        let userValue: string | undefined;
        if (attrName === "username") {
          userValue = user.Username;
        } else if (attrName === "cognito:user_status") {
          userValue = user.UserStatus;
        } else if (attrName === "status") {
          userValue = user.Enabled ? "Enabled" : "Disabled";
        } else {
          userValue = user.Attributes.find((a) => a.Name === attrName)?.Value;
        }
        if (userValue === undefined) return false;
        if (operator === "=") return userValue === value;
        if (operator === "^=") return userValue.startsWith(value);
        if (operator === "!=") return userValue !== value;
        return true;
      });
    }
  }

  let startIdx = 0;
  if (paginationToken !== undefined) {
    const startUsername = Buffer.from(paginationToken, "base64").toString(
      "utf8",
    );
    const found = users.findIndex((u) => u.Username === startUsername);
    if (found >= 0) startIdx = found;
  }

  const pageUsers = users.slice(startIdx, startIdx + limit);
  const nextUser = users[startIdx + limit];
  const nextToken =
    nextUser !== undefined
      ? Buffer.from(nextUser.Username, "utf8").toString("base64")
      : undefined;

  return {
    Users: pageUsers.map((user) => userType(user)),
    ...(nextToken !== undefined ? { PaginationToken: nextToken } : {}),
  };
};

const CreateGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const groupName = requireString(input, "GroupName");
  const key = groupKey(poolId, groupName);
  if (ctx.store.get<StoredGroup>(key) !== undefined) {
    throw awsError("GroupExistsException", `Group already exists.`, 400);
  }
  const now = Math.floor(Date.now() / 1000);
  const group: StoredGroup = {
    GroupName: groupName,
    UserPoolId: poolId,
    Description:
      typeof input["Description"] === "string"
        ? (input["Description"] as string)
        : undefined,
    RoleArn:
      typeof input["RoleArn"] === "string"
        ? (input["RoleArn"] as string)
        : undefined,
    Precedence:
      typeof input["Precedence"] === "number"
        ? (input["Precedence"] as number)
        : undefined,
    CreationDate: now,
    LastModifiedDate: now,
    members: [],
  };
  ctx.store.set(key, group);
  return { Group: groupType(group) };
};

const GetGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const groupName = requireString(input, "GroupName");
  const group = requireGroup(ctx, poolId, groupName);
  return { Group: groupType(group) };
};

const ListGroups: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const entries = ctx.store.list<StoredGroup>();
  return {
    Groups: entries
      .filter(
        (entry) =>
          entry.value.UserPoolId === poolId &&
          typeof entry.value.GroupName === "string",
      )
      .map((entry) => groupType(entry.value)),
  };
};

const DeleteGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const groupName = requireString(input, "GroupName");
  const group = requireGroup(ctx, poolId, groupName);
  if (group.members.length > 0) {
    throw awsError(
      "InvalidParameterException",
      `You must first remove all users from the group ${groupName} before deleting it.`,
      400,
    );
  }
  ctx.store.delete(groupKey(poolId, groupName));
  return {};
};

const UpdateGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  requirePool(ctx, poolId);
  const groupName = requireString(input, "GroupName");
  const key = groupKey(poolId, groupName);
  const group = requireGroup(ctx, poolId, groupName);
  const now = Math.floor(Date.now() / 1000);
  if (typeof input["Description"] === "string")
    group.Description = input["Description"] as string;
  if (typeof input["RoleArn"] === "string")
    group.RoleArn = input["RoleArn"] as string;
  if (typeof input["Precedence"] === "number")
    group.Precedence = input["Precedence"] as number;
  group.LastModifiedDate = now;
  ctx.store.set(key, group);
  return { Group: groupType(group) };
};

const AdminAddUserToGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const groupName = requireString(input, "GroupName");
  if (pool.users[username] === undefined) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  const group = requireGroup(ctx, poolId, groupName);
  if (!group.members.includes(username)) {
    group.members.push(username);
    ctx.store.set(groupKey(poolId, groupName), group);
  }
  return {};
};

const AdminRemoveUserFromGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  const groupName = requireString(input, "GroupName");
  if (pool.users[username] === undefined) {
    throw awsError("UserNotFoundException", `User does not exist.`, 400);
  }
  const group = requireGroup(ctx, poolId, groupName);
  group.members = group.members.filter((member) => member !== username);
  ctx.store.set(groupKey(poolId, groupName), group);
  return {};
};

const AdminListGroupsForUser: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const username = requireString(input, "Username");
  requireUser(pool, username);
  const entries = ctx.store.list<StoredGroup>();
  return {
    Groups: entries
      .filter(
        (e) =>
          e.key.startsWith(`group#${poolId}#`) &&
          e.value.members.includes(username),
      )
      .map((e) => groupType(e.value)),
  };
};

const ListUsersInGroup: OperationHandler = (input, ctx) => {
  const poolId = requireString(input, "UserPoolId");
  const pool = requirePool(ctx, poolId);
  const groupName = requireString(input, "GroupName");
  const group = requireGroup(ctx, poolId, groupName);
  return {
    Users: group.members
      .map((username) => pool.users[username])
      .filter((user): user is StoredUser => user !== undefined)
      .map(userType),
  };
};

const cognitoIdp: ServiceDefinition = {
  name: "cognito-idp",
  protocol: "json",
  operations: {
    AddCustomAttributes,
    AddUserPoolClientSecret,
    AdminConfirmSignUp,
    AdminCreateUser,
    AdminDeleteUser,
    AdminDeleteUserAttributes,
    AdminDisableProviderForUser,
    AdminDisableUser,
    AdminEnableUser,
    AdminForgetDevice,
    AdminGetDevice,
    AdminGetUser,
    AdminInitiateAuth,
    AdminLinkProviderForUser,
    AdminListDevices,
    AdminListGroupsForUser,
    AdminListUserAuthEvents,
    AdminRemoveUserFromGroup,
    AdminResetUserPassword,
    AdminRespondToAuthChallenge,
    AdminSetUserMFAPreference,
    AdminSetUserPassword,
    AdminSetUserSettings,
    AdminUpdateAuthEventFeedback,
    AdminUpdateDeviceStatus,
    AdminUpdateUserAttributes,
    AdminUserGlobalSignOut,
    AssociateSoftwareToken,
    ChangePassword,
    CompleteWebAuthnRegistration,
    ConfirmDevice,
    ConfirmForgotPassword,
    ConfirmSignUp,
    CreateGroup,
    CreateIdentityProvider,
    CreateManagedLoginBranding,
    CreateResourceServer,
    CreateTerms,
    CreateUserImportJob,
    CreateUserPool,
    CreateUserPoolClient,
    CreateUserPoolDomain,
    CreateUserPoolReplica,
    DeleteGroup,
    DeleteIdentityProvider,
    DeleteManagedLoginBranding,
    DeleteResourceServer,
    DeleteTerms,
    DeleteUser,
    DeleteUserAttributes,
    DeleteUserPoolClient,
    DeleteUserPoolClientSecret,
    DeleteUserPool,
    DeleteUserPoolDomain,
    DeleteUserPoolReplica,
    DeleteWebAuthnCredential,
    DescribeIdentityProvider,
    DescribeManagedLoginBranding,
    DescribeManagedLoginBrandingByClient,
    DescribeResourceServer,
    DescribeRiskConfiguration,
    DescribeTerms,
    DescribeUserImportJob,
    DescribeUserPool,
    DescribeUserPoolClient,
    DescribeUserPoolDomain,
    AdminAddUserToGroup,
    ForgetDevice,
    ForgotPassword,
    GetCSVHeader,
    GetDevice,
    GetGroup,
    GetIdentityProviderByIdentifier,
    GetLogDeliveryConfiguration,
    GetSigningCertificate,
    GetTokensFromRefreshToken,
    GetUICustomization,
    GetUser,
    GetUserAttributeVerificationCode,
    GetUserAuthFactors,
    GetUserPoolMfaConfig,
    GlobalSignOut,
    InitiateAuth,
    ListDevices,
    ListGroups,
    ListIdentityProviders,
    ListResourceServers,
    ListTagsForResource,
    ListTerms,
    ListUserImportJobs,
    ListUserPoolClientSecrets,
    ListUserPoolClients,
    ListUserPoolReplicas,
    ListUserPools,
    ListUsers,
    ListUsersInGroup,
    ListWebAuthnCredentials,
    ResendConfirmationCode,
    RespondToAuthChallenge,
    RevokeToken,
    SetLogDeliveryConfiguration,
    SetRiskConfiguration,
    SetUICustomization,
    SetUserMFAPreference,
    SetUserPoolMfaConfig,
    SetUserSettings,
    SignUp,
    StartUserImportJob,
    StartWebAuthnRegistration,
    StopUserImportJob,
    TagResource,
    UntagResource,
    UpdateAuthEventFeedback,
    UpdateDeviceStatus,
    UpdateGroup,
    UpdateIdentityProvider,
    UpdateManagedLoginBranding,
    UpdateResourceServer,
    UpdateTerms,
    UpdateUserAttributes,
    UpdateUserPool,
    UpdateUserPoolClient,
    UpdateUserPoolDomain,
    UpdateUserPoolReplica,
    VerifySoftwareToken,
    VerifyUserAttribute,
  },
  model,
} as const;

export default cognitoIdp;
