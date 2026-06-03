import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import networkmanagerModel from "../../../../test/vendor/aws-models/networkmanager.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(networkmanagerModel);

type StoredGlobalNetwork = {
  GlobalNetworkId: string;
  GlobalNetworkArn: string;
  Description: string | undefined;
  CreatedAt: number;
  State: string;
  Tags: { Key: string | undefined; Value: string | undefined }[];
};

const globalNetworkKey = (id: string): string => `global-network/${id}`;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const tagListFrom = (
  value: unknown,
): { Key: string | undefined; Value: string | undefined }[] => {
  if (!Array.isArray(value)) return [];
  const out: { Key: string | undefined; Value: string | undefined }[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (record === undefined) continue;
    out.push({
      Key: stringOrUndefined(record["Key"]),
      Value: stringOrUndefined(record["Value"]),
    });
  }
  return out;
};

const globalNetworkId = (): string =>
  `global-network-${crypto.randomUUID().replace(/-/g, "").slice(0, 17)}`;

const globalNetworkArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:networkmanager::${ctx.account}:global-network/${id}`;

const globalNetworkView = (
  network: StoredGlobalNetwork,
): Record<string, unknown> => ({
  GlobalNetworkId: network.GlobalNetworkId,
  GlobalNetworkArn: network.GlobalNetworkArn,
  Description: network.Description,
  CreatedAt: network.CreatedAt,
  State: network.State,
  Tags: network.Tags,
});

const requireGlobalNetwork = (
  ctx: ServiceContext,
  id: string,
): StoredGlobalNetwork => {
  const stored = ctx.store.get<StoredGlobalNetwork>(globalNetworkKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Global network not found: ${id}.`,
      404,
    );
  }
  return stored;
};

const CreateGlobalNetwork: OperationHandler = (input, ctx) => {
  const id = globalNetworkId();
  const network: StoredGlobalNetwork = {
    GlobalNetworkId: id,
    GlobalNetworkArn: globalNetworkArnOf(ctx, id),
    Description: stringOrUndefined(input["Description"]),
    CreatedAt: Math.floor(Date.now() / 1000),
    State: "AVAILABLE",
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(globalNetworkKey(id), network);
  return { GlobalNetwork: globalNetworkView(network) };
};

const DescribeGlobalNetworks: OperationHandler = (input, ctx) => {
  const requested = Array.isArray(input["GlobalNetworkIds"])
    ? input["GlobalNetworkIds"].filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const networks = ctx.store
    .list<StoredGlobalNetwork>()
    .filter((entry) => entry.key.startsWith("global-network/"))
    .map((entry) => entry.value)
    .filter(
      (network) =>
        requested.length === 0 || requested.includes(network.GlobalNetworkId),
    )
    .sort((a, b) => a.GlobalNetworkId.localeCompare(b.GlobalNetworkId));
  return { GlobalNetworks: networks.map(globalNetworkView) };
};

const DeleteGlobalNetwork: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["GlobalNetworkId"]);
  if (id === undefined) {
    throw awsError("ValidationException", "GlobalNetworkId is required.", 400);
  }
  const network = requireGlobalNetwork(ctx, id);
  ctx.store.delete(globalNetworkKey(id));
  return {
    GlobalNetwork: globalNetworkView({ ...network, State: "DELETING" }),
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const networkmanager = {
  name: "networkmanager",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "global-networks") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateGlobalNetwork";
      if (req.method === "GET") return "DescribeGlobalNetworks";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "DELETE") return "DeleteGlobalNetwork";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateGlobalNetwork,
    DescribeGlobalNetworks,
    DeleteGlobalNetwork,
  },
  model,
} as const satisfies ServiceDefinition;

export default networkmanager;
