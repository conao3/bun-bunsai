import type { ServiceDefinition } from "../core/types.ts";
import { loadServiceModel } from "../core/shapes.ts";
import stsModel from "../../../../test/vendor/aws-models/sts.json" with { type: "json" };

const defaultAccount = "000000000000" as const;

const model = loadServiceModel(stsModel);

const sts = {
  name: "sts",
  protocol: "query",
  operations: {
    GetCallerIdentity: (_input, ctx) => {
      const acct = ctx.account === "" ? defaultAccount : ctx.account;
      return {
        Account: acct,
        Arn: `arn:aws:iam::${acct}:root`,
        UserId: acct,
      };
    },
  },
  model,
} as const satisfies ServiceDefinition;

export default sts;
