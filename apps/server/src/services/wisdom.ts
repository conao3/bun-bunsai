import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import wisdomModel from "../../../../test/vendor/aws-models/wisdom.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(wisdomModel);

const knowledgeBasePrefix = "knowledgeBase:" as const;

type StoredKnowledgeBase = {
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  knowledgeBaseType: string;
  name: string;
  status: string;
  description: string | undefined;
  lastContentModificationTime: number;
  tags: Record<string, unknown> | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

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

const knowledgeBaseKey = (id: string): string => `${knowledgeBasePrefix}${id}`;

const nowSeconds = (): number => Date.now() / 1000;

const requireKnowledgeBase = (
  ctx: ServiceContext,
  id: string,
): StoredKnowledgeBase => {
  const stored = ctx.store.get<StoredKnowledgeBase>(knowledgeBaseKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `KnowledgeBase ${id} not found.`,
      404,
    );
  }
  return stored;
};

const knowledgeBaseView = (
  knowledgeBase: StoredKnowledgeBase,
): Record<string, unknown> => ({
  knowledgeBaseId: knowledgeBase.knowledgeBaseId,
  knowledgeBaseArn: knowledgeBase.knowledgeBaseArn,
  knowledgeBaseType: knowledgeBase.knowledgeBaseType,
  name: knowledgeBase.name,
  status: knowledgeBase.status,
  description: knowledgeBase.description,
  lastContentModificationTime: knowledgeBase.lastContentModificationTime,
  tags: knowledgeBase.tags,
});

const knowledgeBaseSummary = (
  knowledgeBase: StoredKnowledgeBase,
): Record<string, unknown> => ({
  knowledgeBaseId: knowledgeBase.knowledgeBaseId,
  knowledgeBaseArn: knowledgeBase.knowledgeBaseArn,
  knowledgeBaseType: knowledgeBase.knowledgeBaseType,
  name: knowledgeBase.name,
  status: knowledgeBase.status,
  description: knowledgeBase.description,
});

const CreateKnowledgeBase: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const knowledgeBaseType = requireString(input, "knowledgeBaseType");
  const id = crypto.randomUUID();
  const arn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:knowledge-base/${id}`;
  const knowledgeBase: StoredKnowledgeBase = {
    knowledgeBaseId: id,
    knowledgeBaseArn: arn,
    knowledgeBaseType,
    name,
    status: "ACTIVE",
    description: stringOrUndefined(input["description"]),
    lastContentModificationTime: nowSeconds(),
    tags: recordOrUndefined(input["tags"]),
  };
  ctx.store.set(knowledgeBaseKey(id), knowledgeBase);
  return { knowledgeBase: knowledgeBaseView(knowledgeBase) };
};

const GetKnowledgeBase: OperationHandler = (input, ctx) => {
  const id = requireString(input, "knowledgeBaseId");
  return { knowledgeBase: knowledgeBaseView(requireKnowledgeBase(ctx, id)) };
};

const ListKnowledgeBases: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const knowledgeBases = ctx.store
    .list<StoredKnowledgeBase>()
    .filter((entry) => entry.key.startsWith(knowledgeBasePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return {
    knowledgeBaseSummaries: knowledgeBases
      .slice(0, max)
      .map(knowledgeBaseSummary),
  };
};

const DeleteKnowledgeBase: OperationHandler = (input, ctx) => {
  const id = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, id);
  ctx.store.delete(knowledgeBaseKey(id));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const wisdom = {
  name: "wisdom",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "knowledgeBases") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateKnowledgeBase";
      if (req.method === "GET") return "ListKnowledgeBases";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetKnowledgeBase";
      if (req.method === "DELETE") return "DeleteKnowledgeBase";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateKnowledgeBase,
    GetKnowledgeBase,
    ListKnowledgeBases,
    DeleteKnowledgeBase,
  },
  model,
} as const satisfies ServiceDefinition;

export default wisdom;
