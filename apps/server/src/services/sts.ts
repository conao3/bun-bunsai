import type { ServiceDefinition } from "../core/types.ts";
import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import { callerArn, parseArn } from "../core/arn.ts";
import stsModel from "../../models/sts.json" with { type: "json" };

const defaultAccount = "000000000000" as const;

const model = loadServiceModel(stsModel);

const accountOf = (ctx: { account: string }): string =>
  ctx.account === "" ? defaultAccount : ctx.account;

const accountFromRoleArn = (roleArn: string, fallback: string): string => {
  const account = parseArn(roleArn)?.account ?? "";
  return /^\d{12}$/.test(account) ? account : fallback;
};

type RoleInfo = { roleName: string; sessionName: string };

const roleTokenPrefix = "FQoGZXIvYXdzEXAMPLEtokenbunsai" as const;
const fedTokenPrefix = "FQoGZXIvYXdzEXAMPLEtokenfedbunsai" as const;

const sessionTokenFor = (account: string, role?: RoleInfo): string =>
  role
    ? `${roleTokenPrefix}${account}/${role.roleName}/${role.sessionName}`
    : `${roleTokenPrefix}${account}`;

const fedTokenFor = (account: string, name: string): string =>
  `${fedTokenPrefix}${account}/${name}`;

const assumedRoleFromToken = (
  token: string,
): { account: string; roleName: string; sessionName: string } | undefined => {
  if (!token.startsWith(roleTokenPrefix)) return undefined;
  const rest = token.slice(roleTokenPrefix.length);
  const s1 = rest.indexOf("/");
  if (s1 === -1) return undefined;
  const account = rest.slice(0, s1);
  const tail = rest.slice(s1 + 1);
  const s2 = tail.indexOf("/");
  if (s2 === -1) return undefined;
  const roleName = tail.slice(0, s2);
  const sessionName = tail.slice(s2 + 1);
  if (!account || !roleName || !sessionName) return undefined;
  return { account, roleName, sessionName };
};

const federatedUserFromToken = (
  token: string,
): { account: string; name: string } | undefined => {
  if (!token.startsWith(fedTokenPrefix)) return undefined;
  const rest = token.slice(fedTokenPrefix.length);
  const s = rest.indexOf("/");
  if (s === -1) return undefined;
  const account = rest.slice(0, s);
  const name = rest.slice(s + 1);
  if (!account || !name) return undefined;
  return { account, name };
};

const issueCredentials = (
  account: string,
  durationSeconds: number,
  role?: RoleInfo,
) => ({
  AccessKeyId: `ASIA${account}BNSI`,
  SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  SessionToken: sessionTokenFor(account, role),
  Expiration: Math.floor(Date.now() / 1000) + durationSeconds,
});

const sts = {
  name: "sts",
  protocol: "query",
  operations: {
    GetCallerIdentity: (_input, ctx, req) => {
      const acct = accountOf(ctx);
      const token = req.headers.get("x-amz-security-token");
      const assumed = token ? assumedRoleFromToken(token) : undefined;
      if (assumed) {
        return {
          Account: assumed.account,
          Arn: `arn:aws:sts::${assumed.account}:assumed-role/${assumed.roleName}/${assumed.sessionName}`,
          UserId: `AROABUNSAIEXAMPLEID:${assumed.sessionName}`,
        };
      }
      const federated = token ? federatedUserFromToken(token) : undefined;
      if (federated) {
        return {
          Account: federated.account,
          Arn: `arn:aws:sts::${federated.account}:federated-user/${federated.name}`,
          UserId: `${federated.account}:${federated.name}`,
        };
      }
      return {
        Account: acct,
        Arn: callerArn(acct),
        UserId: acct,
      };
    },
    AssumeRole: (input, ctx) => {
      const acct = accountOf(ctx);
      const params = input as {
        RoleArn?: string;
        RoleSessionName?: string;
        DurationSeconds?: number;
      };
      const roleArn = params.RoleArn ?? `arn:aws:iam::${acct}:role/bunsai`;
      const sessionName = params.RoleSessionName ?? "bunsai-session";
      const roleName = roleArn.split("/").pop() ?? "bunsai";
      const duration = params.DurationSeconds ?? 3600;
      const assumedAccount = accountFromRoleArn(roleArn, acct);
      return {
        Credentials: issueCredentials(assumedAccount, duration, {
          roleName,
          sessionName,
        }),
        AssumedRoleUser: {
          AssumedRoleId: `AROABUNSAIEXAMPLEID:${sessionName}`,
          Arn: `arn:aws:sts::${assumedAccount}:assumed-role/${roleName}/${sessionName}`,
        },
        PackedPolicySize: 6,
      };
    },
    GetSessionToken: (input, ctx) => {
      const params = input as { DurationSeconds?: number };
      return {
        Credentials: issueCredentials(
          accountOf(ctx),
          params.DurationSeconds ?? 43200,
        ),
      };
    },
    GetFederationToken: (input, ctx) => {
      const acct = accountOf(ctx);
      const params = input as { Name?: string; DurationSeconds?: number };
      const name = params.Name ?? "bunsai-federated";
      const duration = params.DurationSeconds ?? 43200;
      return {
        Credentials: {
          AccessKeyId: `ASIA${acct}BNSI`,
          SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          SessionToken: fedTokenFor(acct, name),
          Expiration: Math.floor(Date.now() / 1000) + duration,
        },
        FederatedUser: {
          FederatedUserId: `${acct}:${name}`,
          Arn: `arn:aws:sts::${acct}:federated-user/${name}`,
        },
        PackedPolicySize: 6,
      };
    },
    AssumeRoleWithWebIdentity: (input, ctx) => {
      const acct = accountOf(ctx);
      const params = input as {
        RoleArn?: string;
        RoleSessionName?: string;
        WebIdentityToken?: string;
        ProviderId?: string;
        DurationSeconds?: number;
      };
      if (!params.WebIdentityToken) {
        throw awsError(
          "InvalidIdentityTokenException",
          "WebIdentityToken is required",
          400,
        );
      }
      const roleArn = params.RoleArn ?? `arn:aws:iam::${acct}:role/bunsai`;
      const sessionName = params.RoleSessionName ?? "bunsai-session";
      const roleName = roleArn.split("/").pop() ?? "bunsai";
      const duration = params.DurationSeconds ?? 3600;
      const assumedAccount = accountFromRoleArn(roleArn, acct);
      return {
        Credentials: issueCredentials(assumedAccount, duration, {
          roleName,
          sessionName,
        }),
        SubjectFromWebIdentityToken: "bunsai-web-identity-subject",
        AssumedRoleUser: {
          AssumedRoleId: `AROABUNSAIEXAMPLEID:${sessionName}`,
          Arn: `arn:aws:sts::${assumedAccount}:assumed-role/${roleName}/${sessionName}`,
        },
        PackedPolicySize: 6,
        Provider: params.ProviderId ?? "sts.amazonaws.com",
        Audience: "bunsai",
      };
    },
    DecodeAuthorizationMessage: (input) => {
      const params = input as { EncodedMessage?: string };
      const encoded = params.EncodedMessage ?? "";
      let decoded: string;
      try {
        decoded = atob(encoded);
      } catch {
        decoded = encoded;
      }
      return { DecodedMessage: decoded };
    },
    AssumeRoleWithSAML: (input, ctx) => {
      const acct = accountOf(ctx);
      const params = input as {
        RoleArn?: string;
        PrincipalArn?: string;
        SAMLAssertion?: string;
        DurationSeconds?: number;
      };
      if (!params.SAMLAssertion) {
        throw awsError(
          "InvalidIdentityTokenException",
          "SAMLAssertion is required",
          400,
        );
      }
      const roleArn = params.RoleArn ?? `arn:aws:iam::${acct}:role/bunsai`;
      const sessionName = "bunsai-saml-session";
      const roleName = roleArn.split("/").pop() ?? "bunsai";
      const duration = params.DurationSeconds ?? 3600;
      const assumedAccount = accountFromRoleArn(roleArn, acct);
      const issuer = "https://bunsai.example.com/saml";
      return {
        Credentials: issueCredentials(assumedAccount, duration, {
          roleName,
          sessionName,
        }),
        AssumedRoleUser: {
          AssumedRoleId: `AROABUNSAIEXAMPLEID:${sessionName}`,
          Arn: `arn:aws:sts::${assumedAccount}:assumed-role/${roleName}/${sessionName}`,
        },
        PackedPolicySize: 6,
        Subject: "bunsai-saml-subject",
        SubjectType: "transient",
        Issuer: issuer,
        Audience: "https://signin.aws.amazon.com/saml",
        NameQualifier: "bunsai-name-qualifier",
      };
    },
  },
  model,
} as const satisfies ServiceDefinition;

export default sts;
