import type { ServiceDefinition } from "../core/types.ts";

const defaultAccount = "000000000000" as const;

const sts = {
  name: "sts",
  protocol: "query",
  operations: {
    GetCallerIdentity: (_input, ctx) => {
      const acct = ctx.account === "" ? defaultAccount : ctx.account;
      return {
        GetCallerIdentityResult: {
          Account: acct,
          Arn: `arn:aws:iam::${acct}:root`,
          UserId: acct,
        },
        ResponseMetadata: {
          RequestId: "00000000-0000-0000-0000-000000000000",
        },
      };
    },
  },
} as const satisfies ServiceDefinition;

export default sts;
