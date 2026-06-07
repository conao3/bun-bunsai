import type { ServiceDefinition } from "../core/types.ts";
import { loadServiceModel } from "../core/shapes.ts";
import { parseArn } from "../core/arn.ts";
import stsModel from "../../../../test/vendor/aws-models/sts.json" with { type: "json" };

const defaultAccount = "000000000000" as const;

const model = loadServiceModel(stsModel);

const accountOf = (ctx: { account: string }): string =>
  ctx.account === "" ? defaultAccount : ctx.account;

const accountFromRoleArn = (roleArn: string, fallback: string): string => {
  const account = parseArn(roleArn)?.account ?? "";
  return /^\d{12}$/.test(account) ? account : fallback;
};

const issueCredentials = (account: string, durationSeconds: number) => ({
  AccessKeyId: `ASIA${account}BNSI`,
  SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  SessionToken: `FQoGZXIvYXdzEXAMPLEtokenbunsai${account}`,
  Expiration: Math.floor(Date.now() / 1000) + durationSeconds,
});

const sts = {
  name: "sts",
  protocol: "query",
  operations: {
    GetCallerIdentity: (_input, ctx) => {
      const acct = accountOf(ctx);
      return {
        Account: acct,
        Arn: `arn:aws:iam::${acct}:root`,
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
        Credentials: issueCredentials(assumedAccount, duration),
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
      return {
        Credentials: issueCredentials(acct, params.DurationSeconds ?? 43200),
        FederatedUser: {
          FederatedUserId: `${acct}:${name}`,
          Arn: `arn:aws:sts::${acct}:federated-user/${name}`,
        },
        PackedPolicySize: 6,
      };
    },
  },
  model,
} as const satisfies ServiceDefinition;

export default sts;
