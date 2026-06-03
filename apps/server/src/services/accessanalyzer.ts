import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import accessanalyzerModel from "../../../../test/vendor/aws-models/accessanalyzer.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(accessanalyzerModel);

const analyzerPrefix = "analyzer:" as const;

type StoredAnalyzer = {
  arn: string;
  name: string;
  type: string;
  createdAt: number;
  status: string;
  tags: Record<string, string>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

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

const analyzerKey = (name: string): string => `${analyzerPrefix}${name}`;

const analyzerArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:access-analyzer:${ctx.region}:${ctx.account}:analyzer/${name}`;

const analyzerSummary = (
  analyzer: StoredAnalyzer,
): Record<string, unknown> => ({
  arn: analyzer.arn,
  name: analyzer.name,
  type: analyzer.type,
  createdAt: analyzer.createdAt,
  status: analyzer.status,
  tags: analyzer.tags,
});

const CreateAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const type = requireString(input, "type");
  if (ctx.store.get<StoredAnalyzer>(analyzerKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Analyzer ${name} already exists.`,
      409,
    );
  }
  const arn = analyzerArn(ctx, name);
  const analyzer: StoredAnalyzer = {
    arn,
    name,
    type,
    createdAt: nowSeconds(),
    status: "ACTIVE",
    tags: stringMapFrom(input["tags"]),
  };
  ctx.store.set(analyzerKey(name), analyzer);
  return { arn };
};

const GetAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  const analyzer = ctx.store.get<StoredAnalyzer>(analyzerKey(name));
  if (analyzer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Analyzer ${name} not found.`,
      404,
    );
  }
  return { analyzer: analyzerSummary(analyzer) };
};

const ListAnalyzers: OperationHandler = (input, ctx) => {
  const type = stringOrUndefined(input["type"]);
  const max =
    typeof input["maxResults"] === "number"
      ? (input["maxResults"] as number)
      : 100;
  const analyzers = ctx.store
    .list<StoredAnalyzer>()
    .filter((entry) => entry.key.startsWith(analyzerPrefix))
    .map((entry) => entry.value)
    .filter((analyzer) => type === undefined || analyzer.type === type)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const page = analyzers.slice(0, max);
  return { analyzers: page.map(analyzerSummary) };
};

const DeleteAnalyzer: OperationHandler = (input, ctx) => {
  const name = requireString(input, "analyzerName");
  if (ctx.store.get<StoredAnalyzer>(analyzerKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Analyzer ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(analyzerKey(name));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const accessanalyzer = {
  name: "access-analyzer",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "analyzer") return undefined;
    if (parts.length === 1) {
      if (req.method === "PUT") return "CreateAnalyzer";
      if (req.method === "GET") return "ListAnalyzers";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetAnalyzer";
      if (req.method === "DELETE") return "DeleteAnalyzer";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateAnalyzer,
    GetAnalyzer,
    ListAnalyzers,
    DeleteAnalyzer,
  },
  model,
} as const satisfies ServiceDefinition;

export default accessanalyzer;
