import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import detectiveModel from "../../../../test/vendor/aws-models/detective.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(detectiveModel);

const graphPrefix = "graph:" as const;

type StoredGraph = {
  arn: string;
  id: string;
  createdTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const hex32 = (): string => {
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
};

const graphKey = (id: string): string => `${graphPrefix}${id}`;

const graphArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:detective:${ctx.region}:${ctx.account}:graph:${id}`;

const graphSummary = (graph: StoredGraph): Record<string, unknown> => ({
  Arn: graph.arn,
  CreatedTime: graph.createdTime,
});

const CreateGraph: OperationHandler = (_input, ctx) => {
  const id = hex32();
  const arn = graphArn(ctx, id);
  const graph: StoredGraph = {
    arn,
    id,
    createdTime: nowSeconds(),
  };
  ctx.store.set(graphKey(id), graph);
  return { GraphArn: arn };
};

const ListGraphs: OperationHandler = (input, ctx) => {
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 200;
  const graphs = ctx.store
    .list<StoredGraph>()
    .filter((entry) => entry.key.startsWith(graphPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.arn < b.arn ? -1 : a.arn > b.arn ? 1 : 0));
  const page = graphs.slice(0, max);
  return { GraphList: page.map(graphSummary) };
};

const DeleteGraph: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "GraphArn");
  const match = ctx.store
    .list<StoredGraph>()
    .find(
      (entry) => entry.key.startsWith(graphPrefix) && entry.value.arn === arn,
    );
  if (match === undefined) {
    throw awsError("ResourceNotFoundException", `Graph ${arn} not found.`, 404);
  }
  ctx.store.delete(match.key);
  return {};
};

const detective = {
  name: "detective",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    if (req.method !== "POST") return undefined;
    if (req.path === "/graph") return "CreateGraph";
    if (req.path === "/graphs/list") return "ListGraphs";
    if (req.path === "/graph/removal") return "DeleteGraph";
    return undefined;
  },
  operations: {
    CreateGraph,
    ListGraphs,
    DeleteGraph,
  },
  model,
} as const satisfies ServiceDefinition;

export default detective;
