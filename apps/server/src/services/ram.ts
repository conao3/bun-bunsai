import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ramModel from "../../../../test/vendor/aws-models/ram.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ramModel);

const sharePrefix = "share:" as const;

type StoredShare = {
  resourceShareArn: string;
  name: string;
  owningAccountId: string;
  allowExternalPrincipals: boolean;
  status: string;
  creationTime: number;
  lastUpdatedTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const shareKey = (arn: string): string => `${sharePrefix}${arn}`;

const shareArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:ram:${ctx.region}:${ctx.account}:resource-share/${id}`;

const randomId = (): string =>
  `${Date.now().toString(16)}-${Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")}`;

const shareView = (share: StoredShare): Record<string, unknown> => ({
  resourceShareArn: share.resourceShareArn,
  name: share.name,
  owningAccountId: share.owningAccountId,
  allowExternalPrincipals: share.allowExternalPrincipals,
  status: share.status,
  creationTime: share.creationTime,
  lastUpdatedTime: share.lastUpdatedTime,
});

const CreateResourceShare: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const allowExternalPrincipals =
    typeof input["allowExternalPrincipals"] === "boolean"
      ? (input["allowExternalPrincipals"] as boolean)
      : true;
  const arn = shareArn(ctx, randomId());
  const now = nowSeconds();
  const share: StoredShare = {
    resourceShareArn: arn,
    name,
    owningAccountId: ctx.account,
    allowExternalPrincipals,
    status: "ACTIVE",
    creationTime: now,
    lastUpdatedTime: now,
  };
  ctx.store.set(shareKey(arn), share);
  return { resourceShare: shareView(share) };
};

const GetResourceShares: OperationHandler = (input, ctx) => {
  const arns = Array.isArray(input["resourceShareArns"])
    ? (input["resourceShareArns"] as unknown[]).filter(
        (item): item is string => typeof item === "string",
      )
    : undefined;
  const name = stringOrUndefined(input["name"]);
  const status = stringOrUndefined(input["resourceShareStatus"]);
  const shares = ctx.store
    .list<StoredShare>()
    .filter((entry) => entry.key.startsWith(sharePrefix))
    .map((entry) => entry.value)
    .filter(
      (share) => arns === undefined || arns.includes(share.resourceShareArn),
    )
    .filter((share) => name === undefined || share.name === name)
    .filter((share) => status === undefined || share.status === status)
    .sort((a, b) =>
      a.resourceShareArn < b.resourceShareArn
        ? -1
        : a.resourceShareArn > b.resourceShareArn
          ? 1
          : 0,
    );
  return { resourceShares: shares.map(shareView) };
};

const UpdateResourceShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  const share = ctx.store.get<StoredShare>(shareKey(arn));
  if (share === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Resource share ${arn} not found.`,
      400,
    );
  }
  const name = stringOrUndefined(input["name"]);
  const allowExternalPrincipals =
    typeof input["allowExternalPrincipals"] === "boolean"
      ? (input["allowExternalPrincipals"] as boolean)
      : undefined;
  const updated: StoredShare = {
    ...share,
    name: name ?? share.name,
    allowExternalPrincipals:
      allowExternalPrincipals ?? share.allowExternalPrincipals,
    lastUpdatedTime: nowSeconds(),
  };
  ctx.store.set(shareKey(arn), updated);
  return { resourceShare: shareView(updated) };
};

const DeleteResourceShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceShareArn");
  const share = ctx.store.get<StoredShare>(shareKey(arn));
  if (share === undefined) {
    throw awsError(
      "UnknownResourceException",
      `Resource share ${arn} not found.`,
      400,
    );
  }
  ctx.store.delete(shareKey(arn));
  return { returnValue: true };
};

const ram = {
  name: "ram",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const path = req.path.replace(/\/+$/, "").toLowerCase();
    if (req.method === "POST" && path === "/createresourceshare")
      return "CreateResourceShare";
    if (req.method === "POST" && path === "/getresourceshares")
      return "GetResourceShares";
    if (req.method === "POST" && path === "/updateresourceshare")
      return "UpdateResourceShare";
    if (req.method === "DELETE" && path === "/deleteresourceshare")
      return "DeleteResourceShare";
    return undefined;
  },
  operations: {
    CreateResourceShare,
    GetResourceShares,
    UpdateResourceShare,
    DeleteResourceShare,
  },
  model,
} as const satisfies ServiceDefinition;

export default ram;
