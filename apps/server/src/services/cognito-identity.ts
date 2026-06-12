import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type { ServiceDefinition } from "../core/types.ts";

const model = lazyServiceModel(
  () =>
    import("../../models/cognito-identity.json", { with: { type: "json" } }),
  { targetPrefix: "AWSCognitoIdentityService" },
);

const defaultAccount = "000000000000" as const;
const fedTokenPrefix = "FQoGZXIvYXdzEXAMPLEtokenfedbunsai" as const;

const accountOf = (ctx: { account: string }): string =>
  ctx.account === "" ? defaultAccount : ctx.account;

type CognitoIdentityProvider = {
  ProviderName?: string;
  ClientId?: string;
  ServerSideTokenCheck?: boolean;
};

type StoredIdentityPool = {
  IdentityPoolId: string;
  IdentityPoolName: string;
  AllowUnauthenticatedIdentities: boolean;
  AllowClassicFlow?: boolean;
  SupportedLoginProviders?: Record<string, string>;
  DeveloperProviderName?: string;
  OpenIdConnectProviderARNs?: string[];
  CognitoIdentityProviders?: CognitoIdentityProvider[];
  SamlProviderARNs?: string[];
  IdentityPoolTags?: Record<string, string>;
};

type StoredIdentity = {
  IdentityId: string;
  IdentityPoolId: string;
  Logins: string[];
  CreationDate: number;
  LastModifiedDate: number;
};

type StoredIdentityPoolRoles = {
  Roles: Record<string, string>;
  RoleMappings?: Record<string, unknown>;
};

type StoredPrincipalTags = {
  UseDefaults: boolean;
  PrincipalTags: Record<string, string>;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const poolKey = (poolId: string): string => `pool:${poolId}`;
const identityKey = (identityId: string): string => `identity:${identityId}`;
const loginMapKey = (
  poolId: string,
  provider: string,
  stableId: string,
): string => `login:${poolId}:${provider}:${stableId}`;
const rolesKey = (poolId: string): string => `roles:${poolId}`;
const principalTagsKey = (poolId: string, provider: string): string =>
  `principaltags:${poolId}:${provider}`;

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const paginate = <T>(
  items: T[],
  maxResults: number,
  nextToken: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const offset = decodePageToken(nextToken);
  const page = items.slice(offset, offset + maxResults);
  const nextOffset = offset + maxResults;
  return {
    page,
    nextToken:
      nextOffset < items.length ? encodePageToken(nextOffset) : undefined,
  };
};

const poolIdFromArn = (arn: string): string | undefined => {
  const match = /identitypool\/(.+)$/.exec(arn);
  return match?.[1];
};

const issueCredentials = (account: string, identityId: string) => ({
  AccessKeyId: `ASIA${account}BNSI`,
  SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  SessionToken: `${fedTokenPrefix}${account}/${identityId}`,
  Expiration: nowSeconds() + 3600,
});

const stableLoginId = (token: string): string => {
  const parts = token.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8"),
      );
      if (typeof payload.sub === "string") return payload.sub;
    } catch {
      // not a valid JWT
    }
  }
  return token;
};

const cognitoIdentity: ServiceDefinition = {
  name: "cognito-identity",
  protocol: "json",
  model,
  operations: {
    CreateIdentityPool: (input, ctx) => {
      const name = input["IdentityPoolName"] as string;
      const allowUnauth = input["AllowUnauthenticatedIdentities"] as boolean;

      if (!name) {
        throw awsError(
          "InvalidParameterException",
          "IdentityPoolName is required",
          400,
        );
      }

      const allPools = ctx.store
        .list<StoredIdentityPool>()
        .filter((e) => e.key.startsWith("pool:"));
      const existing = allPools.find((e) => e.value.IdentityPoolName === name);
      if (existing) {
        throw awsError(
          "ResourceConflictException",
          `Identity pool '${name}' already exists`,
          400,
        );
      }

      const region = ctx.region || "us-east-1";
      const guid = crypto.randomUUID();
      const poolId = `${region}:${guid}`;

      const pool: StoredIdentityPool = {
        IdentityPoolId: poolId,
        IdentityPoolName: name,
        AllowUnauthenticatedIdentities: allowUnauth ?? false,
        AllowClassicFlow: input["AllowClassicFlow"] as boolean | undefined,
        SupportedLoginProviders: input["SupportedLoginProviders"] as
          | Record<string, string>
          | undefined,
        DeveloperProviderName: input["DeveloperProviderName"] as
          | string
          | undefined,
        OpenIdConnectProviderARNs: input["OpenIdConnectProviderARNs"] as
          | string[]
          | undefined,
        CognitoIdentityProviders: input["CognitoIdentityProviders"] as
          | CognitoIdentityProvider[]
          | undefined,
        SamlProviderARNs: input["SamlProviderARNs"] as string[] | undefined,
        IdentityPoolTags: input["IdentityPoolTags"] as
          | Record<string, string>
          | undefined,
      };

      ctx.store.set(poolKey(poolId), pool);

      return {
        IdentityPoolId: pool.IdentityPoolId,
        IdentityPoolName: pool.IdentityPoolName,
        AllowUnauthenticatedIdentities: pool.AllowUnauthenticatedIdentities,
        AllowClassicFlow: pool.AllowClassicFlow,
        SupportedLoginProviders: pool.SupportedLoginProviders,
        DeveloperProviderName: pool.DeveloperProviderName,
        OpenIdConnectProviderARNs: pool.OpenIdConnectProviderARNs,
        CognitoIdentityProviders: pool.CognitoIdentityProviders,
        SamlProviderARNs: pool.SamlProviderARNs,
        IdentityPoolTags: pool.IdentityPoolTags,
      };
    },

    DescribeIdentityPool: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }
      return {
        IdentityPoolId: pool.IdentityPoolId,
        IdentityPoolName: pool.IdentityPoolName,
        AllowUnauthenticatedIdentities: pool.AllowUnauthenticatedIdentities,
        AllowClassicFlow: pool.AllowClassicFlow,
        SupportedLoginProviders: pool.SupportedLoginProviders,
        DeveloperProviderName: pool.DeveloperProviderName,
        OpenIdConnectProviderARNs: pool.OpenIdConnectProviderARNs,
        CognitoIdentityProviders: pool.CognitoIdentityProviders,
        SamlProviderARNs: pool.SamlProviderARNs,
        IdentityPoolTags: pool.IdentityPoolTags,
      };
    },

    UpdateIdentityPool: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const existing = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!existing) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const updated: StoredIdentityPool = {
        IdentityPoolId: poolId,
        IdentityPoolName:
          (input["IdentityPoolName"] as string) ?? existing.IdentityPoolName,
        AllowUnauthenticatedIdentities:
          (input["AllowUnauthenticatedIdentities"] as boolean) ??
          existing.AllowUnauthenticatedIdentities,
        AllowClassicFlow:
          input["AllowClassicFlow"] !== undefined
            ? (input["AllowClassicFlow"] as boolean)
            : existing.AllowClassicFlow,
        SupportedLoginProviders:
          input["SupportedLoginProviders"] !== undefined
            ? (input["SupportedLoginProviders"] as Record<string, string>)
            : existing.SupportedLoginProviders,
        DeveloperProviderName:
          input["DeveloperProviderName"] !== undefined
            ? (input["DeveloperProviderName"] as string)
            : existing.DeveloperProviderName,
        OpenIdConnectProviderARNs:
          input["OpenIdConnectProviderARNs"] !== undefined
            ? (input["OpenIdConnectProviderARNs"] as string[])
            : existing.OpenIdConnectProviderARNs,
        CognitoIdentityProviders:
          input["CognitoIdentityProviders"] !== undefined
            ? (input["CognitoIdentityProviders"] as CognitoIdentityProvider[])
            : existing.CognitoIdentityProviders,
        SamlProviderARNs:
          input["SamlProviderARNs"] !== undefined
            ? (input["SamlProviderARNs"] as string[])
            : existing.SamlProviderARNs,
        IdentityPoolTags:
          input["IdentityPoolTags"] !== undefined
            ? (input["IdentityPoolTags"] as Record<string, string>)
            : existing.IdentityPoolTags,
      };

      ctx.store.set(poolKey(poolId), updated);

      return {
        IdentityPoolId: updated.IdentityPoolId,
        IdentityPoolName: updated.IdentityPoolName,
        AllowUnauthenticatedIdentities: updated.AllowUnauthenticatedIdentities,
        AllowClassicFlow: updated.AllowClassicFlow,
        SupportedLoginProviders: updated.SupportedLoginProviders,
        DeveloperProviderName: updated.DeveloperProviderName,
        OpenIdConnectProviderARNs: updated.OpenIdConnectProviderARNs,
        CognitoIdentityProviders: updated.CognitoIdentityProviders,
        SamlProviderARNs: updated.SamlProviderARNs,
        IdentityPoolTags: updated.IdentityPoolTags,
      };
    },

    DeleteIdentityPool: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const existing = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!existing) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const identities = ctx.store
        .list<StoredIdentity>()
        .filter(
          (e) =>
            e.key.startsWith("identity:") && e.value.IdentityPoolId === poolId,
        );
      for (const entry of identities) {
        ctx.store.delete(entry.key);
      }

      const loginPrefix = `login:${poolId}:`;
      const loginMappings = ctx.store
        .list<string>()
        .filter((e) => e.key.startsWith(loginPrefix));
      for (const entry of loginMappings) {
        ctx.store.delete(entry.key);
      }

      ctx.store.delete(rolesKey(poolId));

      const ptPrefix = `principaltags:${poolId}:`;
      const ptEntries = ctx.store
        .list<StoredPrincipalTags>()
        .filter((e) => e.key.startsWith(ptPrefix));
      for (const entry of ptEntries) {
        ctx.store.delete(entry.key);
      }

      ctx.store.delete(poolKey(poolId));
      return {};
    },

    ListIdentityPools: (input, ctx) => {
      const maxResults = (input["MaxResults"] as number) || 60;
      const all = ctx.store
        .list<StoredIdentityPool>()
        .filter((e) => e.key.startsWith("pool:"))
        .map((e) => ({
          IdentityPoolId: e.value.IdentityPoolId,
          IdentityPoolName: e.value.IdentityPoolName,
        }));

      const { page, nextToken } = paginate(all, maxResults, input["NextToken"]);
      return {
        IdentityPools: page,
        NextToken: nextToken,
      };
    },

    GetId: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const logins = input["Logins"] as Record<string, string> | undefined;

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const loginEntries = logins ? Object.entries(logins) : [];

      for (const [provider, token] of loginEntries) {
        const sid = stableLoginId(token);
        const mapKey = loginMapKey(poolId, provider, sid);
        const existingId = ctx.store.get<string>(mapKey);
        if (existingId) {
          if (ctx.store.get<StoredIdentity>(identityKey(existingId))) {
            return { IdentityId: existingId };
          }
          ctx.store.delete(mapKey);
        }
      }

      const region = ctx.region || "us-east-1";
      const guid = crypto.randomUUID();
      const identityId = `${region}:${guid}`;
      const now = nowSeconds();

      const identity: StoredIdentity = {
        IdentityId: identityId,
        IdentityPoolId: poolId,
        Logins: loginEntries.map(([provider]) => provider),
        CreationDate: now,
        LastModifiedDate: now,
      };

      ctx.store.set(identityKey(identityId), identity);
      for (const [provider, token] of loginEntries) {
        const sid = stableLoginId(token);
        ctx.store.set(loginMapKey(poolId, provider, sid), identityId);
      }

      return { IdentityId: identityId };
    },

    GetCredentialsForIdentity: (input, ctx) => {
      const identityId = input["IdentityId"] as string;
      const customRoleArn = input["CustomRoleArn"] as string | undefined;

      const identity = ctx.store.get<StoredIdentity>(identityKey(identityId));
      if (!identity) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity '${identityId}' not found`,
          400,
        );
      }

      const pool = ctx.store.get<StoredIdentityPool>(
        poolKey(identity.IdentityPoolId),
      );
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${identity.IdentityPoolId}' not found`,
          400,
        );
      }

      const isAuthenticated = identity.Logins.length > 0;

      if (!isAuthenticated && !pool.AllowUnauthenticatedIdentities) {
        throw awsError(
          "NotAuthorizedException",
          "Unauthenticated access is not allowed for this identity pool",
          400,
        );
      }

      if (!customRoleArn) {
        const storedRoles = ctx.store.get<StoredIdentityPoolRoles>(
          rolesKey(identity.IdentityPoolId),
        );
        if (storedRoles) {
          const roleKey = isAuthenticated ? "authenticated" : "unauthenticated";
          if (!storedRoles.Roles?.[roleKey]) {
            throw awsError(
              "InvalidIdentityPoolConfigurationException",
              `No ${roleKey} role configured for identity pool`,
              400,
            );
          }
        }
      }

      const acct = accountOf(ctx);
      const creds = issueCredentials(acct, identityId);

      return {
        IdentityId: identityId,
        Credentials: {
          AccessKeyId: creds.AccessKeyId,
          SecretKey: creds.SecretAccessKey,
          SessionToken: creds.SessionToken,
          Expiration: creds.Expiration,
        },
      };
    },

    GetOpenIdToken: (input, ctx) => {
      const identityId = input["IdentityId"] as string;
      const identity = ctx.store.get<StoredIdentity>(identityKey(identityId));
      if (!identity) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity '${identityId}' not found`,
          400,
        );
      }

      const acct = accountOf(ctx);
      const token = `bunsai-oidc-token.${acct}.${identityId}.${nowSeconds()}`;

      return {
        IdentityId: identityId,
        Token: token,
      };
    },

    ListIdentities: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const maxResults = (input["MaxResults"] as number) || 60;

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const allIdentities = ctx.store
        .list<StoredIdentity>()
        .filter(
          (e) =>
            e.key.startsWith("identity:") && e.value.IdentityPoolId === poolId,
        )
        .map((e) => ({
          IdentityId: e.value.IdentityId,
          Logins: e.value.Logins,
          CreationDate: e.value.CreationDate,
          LastModifiedDate: e.value.LastModifiedDate,
        }));

      const { page, nextToken } = paginate(
        allIdentities,
        maxResults,
        input["NextToken"],
      );
      return {
        IdentityPoolId: poolId,
        Identities: page,
        NextToken: nextToken,
      };
    },

    DescribeIdentity: (input, ctx) => {
      const identityId = input["IdentityId"] as string;
      const identity = ctx.store.get<StoredIdentity>(identityKey(identityId));
      if (!identity) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity '${identityId}' not found`,
          400,
        );
      }
      return {
        IdentityId: identity.IdentityId,
        Logins: identity.Logins,
        CreationDate: identity.CreationDate,
        LastModifiedDate: identity.LastModifiedDate,
      };
    },

    DeleteIdentities: (input, ctx) => {
      const idsToDelete = input["IdentityIdsToDelete"] as string[];
      for (const id of idsToDelete) {
        const identity = ctx.store.get<StoredIdentity>(identityKey(id));
        if (identity) {
          const loginPrefix = `login:${identity.IdentityPoolId}:`;
          const loginMappings = ctx.store
            .list<string>()
            .filter((e) => e.key.startsWith(loginPrefix) && e.value === id);
          for (const mapping of loginMappings) {
            ctx.store.delete(mapping.key);
          }
          ctx.store.delete(identityKey(id));
        }
      }
      return { UnprocessedIdentityIds: [] };
    },

    TagResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      const tags = input["Tags"] as Record<string, string>;

      const poolId = poolIdFromArn(resourceArn);
      if (!poolId) {
        throw awsError(
          "InvalidParameterException",
          `Invalid resource ARN: ${resourceArn}`,
          400,
        );
      }

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool not found for ARN: ${resourceArn}`,
          400,
        );
      }

      pool.IdentityPoolTags = { ...(pool.IdentityPoolTags ?? {}), ...tags };
      ctx.store.set(poolKey(poolId), pool);

      return {};
    },

    UntagResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      const tagKeys = input["TagKeys"] as string[];

      const poolId = poolIdFromArn(resourceArn);
      if (!poolId) {
        throw awsError(
          "InvalidParameterException",
          `Invalid resource ARN: ${resourceArn}`,
          400,
        );
      }

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool not found for ARN: ${resourceArn}`,
          400,
        );
      }

      if (pool.IdentityPoolTags) {
        for (const key of tagKeys) {
          delete pool.IdentityPoolTags[key];
        }
      }
      ctx.store.set(poolKey(poolId), pool);

      return {};
    },

    ListTagsForResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      const poolId = poolIdFromArn(resourceArn);
      if (!poolId) {
        throw awsError(
          "InvalidParameterException",
          `Invalid resource ARN: ${resourceArn}`,
          400,
        );
      }

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool not found for ARN: ${resourceArn}`,
          400,
        );
      }

      return { Tags: pool.IdentityPoolTags ?? {} };
    },

    GetIdentityPoolRoles: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const stored = ctx.store.get<StoredIdentityPoolRoles>(rolesKey(poolId));
      if (!stored) {
        return {
          IdentityPoolId: poolId,
          RoleMappings: {},
        };
      }

      return {
        IdentityPoolId: poolId,
        Roles: stored.Roles,
        RoleMappings: stored.RoleMappings ?? {},
      };
    },

    SetIdentityPoolRoles: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const roles = input["Roles"] as Record<string, string> | undefined;
      const roleMappings = input["RoleMappings"] as
        | Record<string, unknown>
        | undefined;

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      if (!roles) {
        throw awsError("InvalidParameterException", "Roles is required", 400);
      }

      const stored: StoredIdentityPoolRoles = {
        Roles: roles,
        RoleMappings: roleMappings,
      };
      ctx.store.set(rolesKey(poolId), stored);

      return {};
    },

    GetPrincipalTagAttributeMap: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const providerName = input["IdentityProviderName"] as string;

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const stored = ctx.store.get<StoredPrincipalTags>(
        principalTagsKey(poolId, providerName),
      );

      return {
        IdentityPoolId: poolId,
        IdentityProviderName: providerName,
        UseDefaults: stored?.UseDefaults ?? true,
        PrincipalTags: stored?.PrincipalTags ?? {},
      };
    },

    SetPrincipalTagAttributeMap: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const providerName = input["IdentityProviderName"] as string;

      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const useDefaults = input["UseDefaults"] as boolean | undefined;
      const principalTags = input["PrincipalTags"] as
        | Record<string, string>
        | undefined;

      const stored: StoredPrincipalTags = {
        UseDefaults: useDefaults ?? true,
        PrincipalTags: principalTags ?? {},
      };

      ctx.store.set(principalTagsKey(poolId, providerName), stored);

      return {
        IdentityPoolId: poolId,
        IdentityProviderName: providerName,
        UseDefaults: stored.UseDefaults,
        PrincipalTags: stored.PrincipalTags,
      };
    },

    GetOpenIdTokenForDeveloperIdentity: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const logins = input["Logins"] as Record<string, string> | undefined;
      const inputIdentityId = input["IdentityId"] as string | undefined;
      const loginEntries = logins ? Object.entries(logins) : [];

      let identityId: string;

      if (inputIdentityId) {
        const existingIdentity = ctx.store.get<StoredIdentity>(
          identityKey(inputIdentityId),
        );
        if (!existingIdentity) {
          throw awsError(
            "ResourceNotFoundException",
            `Identity '${inputIdentityId}' not found`,
            400,
          );
        }

        for (const [provider, token] of loginEntries) {
          const sid = stableLoginId(token);
          const mapKey = loginMapKey(poolId, provider, sid);
          const existingMappedId = ctx.store.get<string>(mapKey);
          if (existingMappedId && existingMappedId !== inputIdentityId) {
            throw awsError(
              "DeveloperUserAlreadyRegisteredException",
              `Developer user identifier is already registered to a different identity`,
              400,
            );
          }
        }

        identityId = inputIdentityId;
        const identity = ctx.store.get<StoredIdentity>(
          identityKey(identityId),
        )!;
        for (const [provider, token] of loginEntries) {
          const sid = stableLoginId(token);
          ctx.store.set(loginMapKey(poolId, provider, sid), identityId);
          if (!identity.Logins.includes(provider)) {
            identity.Logins.push(provider);
          }
        }
        identity.LastModifiedDate = nowSeconds();
        ctx.store.set(identityKey(identityId), identity);
      } else {
        let foundId: string | undefined;
        for (const [provider, token] of loginEntries) {
          const sid = stableLoginId(token);
          const mapKey = loginMapKey(poolId, provider, sid);
          const existingId = ctx.store.get<string>(mapKey);
          if (
            existingId &&
            ctx.store.get<StoredIdentity>(identityKey(existingId))
          ) {
            foundId = existingId;
            break;
          }
        }

        if (foundId) {
          identityId = foundId;
          const identity = ctx.store.get<StoredIdentity>(
            identityKey(identityId),
          )!;
          for (const [provider, token] of loginEntries) {
            const sid = stableLoginId(token);
            const mapKey = loginMapKey(poolId, provider, sid);
            if (!ctx.store.get<string>(mapKey)) {
              ctx.store.set(mapKey, identityId);
            }
            if (!identity.Logins.includes(provider)) {
              identity.Logins.push(provider);
            }
          }
          identity.LastModifiedDate = nowSeconds();
          ctx.store.set(identityKey(identityId), identity);
        } else {
          const region = ctx.region || "us-east-1";
          identityId = `${region}:${crypto.randomUUID()}`;
          const now = nowSeconds();
          const identity: StoredIdentity = {
            IdentityId: identityId,
            IdentityPoolId: poolId,
            Logins: loginEntries.map(([provider]) => provider),
            CreationDate: now,
            LastModifiedDate: now,
          };
          ctx.store.set(identityKey(identityId), identity);
          for (const [provider, token] of loginEntries) {
            const sid = stableLoginId(token);
            ctx.store.set(loginMapKey(poolId, provider, sid), identityId);
          }
        }
      }

      const acct = accountOf(ctx);
      const token = `bunsai-developer-oidc.${acct}.${identityId}.${nowSeconds()}`;
      return {
        IdentityId: identityId,
        Token: token,
      };
    },

    LookupDeveloperIdentity: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const developerUserIdentifier = input["DeveloperUserIdentifier"] as
        | string
        | undefined;
      const identityIdInput = input["IdentityId"] as string | undefined;
      const maxResults = (input["MaxResults"] as number) || 10;

      const provider = pool.DeveloperProviderName;
      if (!provider) {
        throw awsError(
          "InvalidParameterException",
          "Identity pool does not have a developer provider configured",
          400,
        );
      }

      const loginPrefix = `login:${poolId}:${provider}:`;

      if (developerUserIdentifier) {
        const sid = stableLoginId(developerUserIdentifier);
        const mapKey = loginMapKey(poolId, provider, sid);
        const identityId = ctx.store.get<string>(mapKey);

        if (!identityId) {
          throw awsError(
            "ResourceNotFoundException",
            `Developer identity '${developerUserIdentifier}' not found`,
            400,
          );
        }

        const allIdentifiers = ctx.store
          .list<string>()
          .filter(
            (e) => e.key.startsWith(loginPrefix) && e.value === identityId,
          )
          .map((e) => e.key.slice(loginPrefix.length));

        const { page, nextToken } = paginate(
          allIdentifiers,
          maxResults,
          input["NextToken"],
        );

        return {
          IdentityId: identityId,
          DeveloperUserIdentifierList: page,
          NextToken: nextToken,
        };
      } else if (identityIdInput) {
        const identity = ctx.store.get<StoredIdentity>(
          identityKey(identityIdInput),
        );
        if (!identity) {
          throw awsError(
            "ResourceNotFoundException",
            `Identity '${identityIdInput}' not found`,
            400,
          );
        }

        const allIdentifiers = ctx.store
          .list<string>()
          .filter(
            (e) => e.key.startsWith(loginPrefix) && e.value === identityIdInput,
          )
          .map((e) => e.key.slice(loginPrefix.length));

        const { page, nextToken } = paginate(
          allIdentifiers,
          maxResults,
          input["NextToken"],
        );

        return {
          IdentityId: identityIdInput,
          DeveloperUserIdentifierList: page,
          NextToken: nextToken,
        };
      } else {
        throw awsError(
          "InvalidParameterException",
          "Either DeveloperUserIdentifier or IdentityId must be provided",
          400,
        );
      }
    },

    MergeDeveloperIdentities: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const sourceIdentifier = input["SourceUserIdentifier"] as string;
      const destIdentifier = input["DestinationUserIdentifier"] as string;
      const devProviderName =
        (input["DeveloperProviderName"] as string) ||
        pool.DeveloperProviderName;

      if (!devProviderName) {
        throw awsError(
          "InvalidParameterException",
          "DeveloperProviderName is required",
          400,
        );
      }

      const srcMapKey = loginMapKey(
        poolId,
        devProviderName,
        stableLoginId(sourceIdentifier),
      );
      const dstMapKey = loginMapKey(
        poolId,
        devProviderName,
        stableLoginId(destIdentifier),
      );

      const srcIdentityId = ctx.store.get<string>(srcMapKey);
      if (!srcIdentityId) {
        throw awsError(
          "ResourceNotFoundException",
          `Developer identity '${sourceIdentifier}' not found`,
          400,
        );
      }

      const dstIdentityId = ctx.store.get<string>(dstMapKey);
      if (!dstIdentityId) {
        throw awsError(
          "ResourceNotFoundException",
          `Developer identity '${destIdentifier}' not found`,
          400,
        );
      }

      const loginPrefix = `login:${poolId}:`;
      const srcMappings = ctx.store
        .list<string>()
        .filter(
          (e) => e.key.startsWith(loginPrefix) && e.value === srcIdentityId,
        );

      for (const mapping of srcMappings) {
        ctx.store.set(mapping.key, dstIdentityId);
      }

      const srcIdentity = ctx.store.get<StoredIdentity>(
        identityKey(srcIdentityId),
      );
      const dstIdentity = ctx.store.get<StoredIdentity>(
        identityKey(dstIdentityId),
      );

      if (srcIdentity && dstIdentity) {
        for (const login of srcIdentity.Logins) {
          if (!dstIdentity.Logins.includes(login)) {
            dstIdentity.Logins.push(login);
          }
        }
        dstIdentity.LastModifiedDate = nowSeconds();
        ctx.store.set(identityKey(dstIdentityId), dstIdentity);
      }

      ctx.store.delete(identityKey(srcIdentityId));

      return { IdentityId: dstIdentityId };
    },

    UnlinkDeveloperIdentity: (input, ctx) => {
      const poolId = input["IdentityPoolId"] as string;
      const pool = ctx.store.get<StoredIdentityPool>(poolKey(poolId));
      if (!pool) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity pool '${poolId}' not found`,
          400,
        );
      }

      const identityId = input["IdentityId"] as string;
      const devProviderName = input["DeveloperProviderName"] as string;
      const devUserIdentifier = input["DeveloperUserIdentifier"] as string;

      const identity = ctx.store.get<StoredIdentity>(identityKey(identityId));
      if (!identity) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity '${identityId}' not found`,
          400,
        );
      }

      const sid = stableLoginId(devUserIdentifier);
      ctx.store.delete(loginMapKey(poolId, devProviderName, sid));

      identity.Logins = identity.Logins.filter((l) => l !== devProviderName);
      identity.LastModifiedDate = nowSeconds();
      ctx.store.set(identityKey(identityId), identity);

      return {};
    },

    UnlinkIdentity: (input, ctx) => {
      const identityId = input["IdentityId"] as string;
      const logins = input["Logins"] as Record<string, string> | undefined;
      const loginsToRemove = input["LoginsToRemove"] as string[] | undefined;

      const identity = ctx.store.get<StoredIdentity>(identityKey(identityId));
      if (!identity) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity '${identityId}' not found`,
          400,
        );
      }

      for (const provider of loginsToRemove ?? []) {
        const token = logins?.[provider];
        if (token) {
          const sid = stableLoginId(token);
          ctx.store.delete(loginMapKey(identity.IdentityPoolId, provider, sid));
        }
        identity.Logins = identity.Logins.filter((l) => l !== provider);
      }

      identity.LastModifiedDate = nowSeconds();
      ctx.store.set(identityKey(identityId), identity);

      return {};
    },
  },
};

export default cognitoIdentity;
