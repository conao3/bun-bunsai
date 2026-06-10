import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import cognitoIdentityModel from "../../../../test/vendor/aws-models/cognito-identity.json" with { type: "json" };
import type { ServiceDefinition } from "../core/types.ts";

const model = loadServiceModel(cognitoIdentityModel);

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

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const poolKey = (poolId: string): string => `pool:${poolId}`;
const identityKey = (identityId: string): string => `identity:${identityId}`;
const loginMapKey = (poolId: string, loginKey: string): string =>
  `login:${poolId}:${loginKey}`;

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

      const loginKeys = logins
        ? Object.entries(logins).map(([k, v]) => `${k}:${v}`)
        : [];
      const loginMapLookupKey =
        loginKeys.length > 0 ? loginMapKey(poolId, loginKeys[0]) : undefined;

      if (loginMapLookupKey) {
        const existingId = ctx.store.get<string>(loginMapLookupKey);
        if (existingId) {
          return { IdentityId: existingId };
        }
      }

      const region = ctx.region || "us-east-1";
      const guid = crypto.randomUUID();
      const identityId = `${region}:${guid}`;
      const now = nowSeconds();

      const identity: StoredIdentity = {
        IdentityId: identityId,
        IdentityPoolId: poolId,
        Logins: loginKeys,
        CreationDate: now,
        LastModifiedDate: now,
      };

      ctx.store.set(identityKey(identityId), identity);
      if (loginMapLookupKey) {
        ctx.store.set(loginMapLookupKey, identityId);
      }

      return { IdentityId: identityId };
    },

    GetCredentialsForIdentity: (input, ctx) => {
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
        ctx.store.delete(identityKey(id));
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
      const acct = accountOf(ctx);
      return {
        IdentityPoolId: poolId,
        Roles: {
          authenticated: `arn:aws:iam::${acct}:role/Cognito_${pool.IdentityPoolName}Auth_Role`,
          unauthenticated: `arn:aws:iam::${acct}:role/Cognito_${pool.IdentityPoolName}Unauth_Role`,
        },
        RoleMappings: {},
      };
    },

    SetIdentityPoolRoles: (_input, _ctx) => {
      return {};
    },

    GetPrincipalTagAttributeMap: (input, ctx) => {
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
        IdentityPoolId: poolId,
        IdentityProviderName: input["IdentityProviderName"] as string,
        UseDefaults: true,
        PrincipalTags: {},
      };
    },

    SetPrincipalTagAttributeMap: (input, ctx) => {
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
        IdentityPoolId: poolId,
        IdentityProviderName: input["IdentityProviderName"] as string,
        UseDefaults: input["UseDefaults"] as boolean,
        PrincipalTags: input["PrincipalTags"] as Record<string, string>,
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
      const loginKeys = logins
        ? Object.entries(logins).map(([k, v]) => `${k}:${v}`)
        : [];
      const loginMapLookupKey =
        loginKeys.length > 0 ? loginMapKey(poolId, loginKeys[0]) : undefined;

      let identityId: string;
      if (loginMapLookupKey) {
        const existingId = ctx.store.get<string>(loginMapLookupKey);
        if (existingId) {
          identityId = existingId;
        } else {
          const region = ctx.region || "us-east-1";
          identityId = `${region}:${crypto.randomUUID()}`;
          const now = nowSeconds();
          const identity: StoredIdentity = {
            IdentityId: identityId,
            IdentityPoolId: poolId,
            Logins: loginKeys,
            CreationDate: now,
            LastModifiedDate: now,
          };
          ctx.store.set(identityKey(identityId), identity);
          ctx.store.set(loginMapLookupKey, identityId);
        }
      } else {
        const region = ctx.region || "us-east-1";
        identityId = `${region}:${crypto.randomUUID()}`;
        const now = nowSeconds();
        const identity: StoredIdentity = {
          IdentityId: identityId,
          IdentityPoolId: poolId,
          Logins: loginKeys,
          CreationDate: now,
          LastModifiedDate: now,
        };
        ctx.store.set(identityKey(identityId), identity);
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
      void input["MaxResults"];
      return {
        IdentityId: undefined,
        DeveloperUserIdentifierList: [],
        NextToken: undefined,
      };
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
      return { IdentityId: input["DestinationUserIdentifier"] as string };
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
      return {};
    },

    UnlinkIdentity: (input, ctx) => {
      const identityId = input["IdentityId"] as string;
      const identity = ctx.store.get<StoredIdentity>(identityKey(identityId));
      if (!identity) {
        throw awsError(
          "ResourceNotFoundException",
          `Identity '${identityId}' not found`,
          400,
        );
      }
      return {};
    },
  },
};

export default cognitoIdentity;
