import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/wisdom.json", { with: { type: "json" } }),
);

const knowledgeBasePrefix = "knowledgeBase:" as const;
const assistantPrefix = "assistant:" as const;
const associationPrefix = "assistantAssociation:" as const;
const contentPrefix = "content:" as const;
const quickResponsePrefix = "quickResponse:" as const;
const sessionPrefix = "session:" as const;
const importJobPrefix = "importJob:" as const;
const tagPrefix = "tags:" as const;

type StoredKnowledgeBase = {
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  knowledgeBaseType: string;
  name: string;
  status: string;
  description: string | undefined;
  lastContentModificationTime: number;
  tags: Record<string, unknown> | undefined;
  templateUri: string | undefined;
};

type StoredAssistant = {
  assistantId: string;
  assistantArn: string;
  name: string;
  type: string;
  status: string;
  description: string | undefined;
  tags: Record<string, unknown> | undefined;
};

type StoredAssistantAssociation = {
  assistantAssociationId: string;
  assistantAssociationArn: string;
  assistantId: string;
  assistantArn: string;
  associationType: string;
  knowledgeBaseId: string | undefined;
  knowledgeBaseArn: string | undefined;
  tags: Record<string, unknown> | undefined;
};

type StoredContent = {
  contentId: string;
  contentArn: string;
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  name: string;
  title: string;
  contentType: string;
  status: string;
  revisionId: string;
  metadata: Record<string, string>;
  url: string;
  urlExpiry: number;
  linkOutUri: string | undefined;
  tags: Record<string, unknown> | undefined;
};

type StoredQuickResponse = {
  quickResponseId: string;
  quickResponseArn: string;
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  name: string;
  contentType: string;
  status: string;
  createdTime: number;
  lastModifiedTime: number;
  plainTextContent: string | undefined;
  markdownContent: string | undefined;
  description: string | undefined;
  isActive: boolean;
  language: string | undefined;
  shortcutKey: string | undefined;
  tags: Record<string, unknown> | undefined;
};

type StoredSession = {
  sessionId: string;
  sessionArn: string;
  assistantId: string;
  assistantArn: string;
  name: string;
  description: string | undefined;
  tags: Record<string, unknown> | undefined;
};

type StoredImportJob = {
  importJobId: string;
  knowledgeBaseId: string;
  knowledgeBaseArn: string;
  importJobType: string;
  uploadId: string;
  status: string;
  createdTime: number;
  lastModifiedTime: number;
  url: string;
  urlExpiry: number;
  metadata: Record<string, string> | undefined;
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

const stringRecordOrUndefined = (
  value: unknown,
): Record<string, string> | undefined => {
  const r = recordOrUndefined(value);
  if (r === undefined) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") out[k] = v;
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

const knowledgeBaseKey = (id: string): string => `${knowledgeBasePrefix}${id}`;
const assistantKey = (id: string): string => `${assistantPrefix}${id}`;
const associationKey = (assistantId: string, assocId: string): string =>
  `${associationPrefix}${assistantId}:${assocId}`;
const contentKey = (kbId: string, contentId: string): string =>
  `${contentPrefix}${kbId}:${contentId}`;
const quickResponseKey = (kbId: string, qrId: string): string =>
  `${quickResponsePrefix}${kbId}:${qrId}`;
const sessionKey = (assistantId: string, sessionId: string): string =>
  `${sessionPrefix}${assistantId}:${sessionId}`;
const importJobKey = (kbId: string, jobId: string): string =>
  `${importJobPrefix}${kbId}:${jobId}`;
const tagKey = (arn: string): string => `${tagPrefix}${arn}`;

const nowSeconds = (): number => Date.now() / 1000;

const encodeNextToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodeNextToken = (token: unknown): number => {
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
  const offset = decodeNextToken(nextToken);
  const page = items.slice(offset, offset + maxResults);
  const nextOffset = offset + maxResults;
  return {
    page,
    nextToken:
      nextOffset < items.length ? encodeNextToken(nextOffset) : undefined,
  };
};

const syncTags = (
  arn: string,
  tags: Record<string, unknown> | undefined,
  ctx: ServiceContext,
): void => {
  if (tags === undefined) return;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags)) {
    if (typeof v === "string") out[k] = v;
  }
  ctx.store.set(tagKey(arn), out);
};

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

const requireAssistant = (ctx: ServiceContext, id: string): StoredAssistant => {
  const stored = ctx.store.get<StoredAssistant>(assistantKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Assistant ${id} not found.`,
      404,
    );
  }
  return stored;
};

const requireAssociation = (
  ctx: ServiceContext,
  assistantId: string,
  assocId: string,
): StoredAssistantAssociation => {
  const stored = ctx.store.get<StoredAssistantAssociation>(
    associationKey(assistantId, assocId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `AssistantAssociation ${assocId} not found.`,
      404,
    );
  }
  return stored;
};

const requireContent = (
  ctx: ServiceContext,
  kbId: string,
  contentId: string,
): StoredContent => {
  requireKnowledgeBase(ctx, kbId);
  const stored = ctx.store.get<StoredContent>(contentKey(kbId, contentId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Content ${contentId} not found.`,
      404,
    );
  }
  return stored;
};

const requireQuickResponse = (
  ctx: ServiceContext,
  kbId: string,
  qrId: string,
): StoredQuickResponse => {
  requireKnowledgeBase(ctx, kbId);
  const stored = ctx.store.get<StoredQuickResponse>(
    quickResponseKey(kbId, qrId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `QuickResponse ${qrId} not found.`,
      404,
    );
  }
  return stored;
};

const requireSession = (
  ctx: ServiceContext,
  assistantId: string,
  sessionId: string,
): StoredSession => {
  requireAssistant(ctx, assistantId);
  const stored = ctx.store.get<StoredSession>(
    sessionKey(assistantId, sessionId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Session ${sessionId} not found.`,
      404,
    );
  }
  return stored;
};

const requireImportJob = (
  ctx: ServiceContext,
  kbId: string,
  jobId: string,
): StoredImportJob => {
  requireKnowledgeBase(ctx, kbId);
  const stored = ctx.store.get<StoredImportJob>(importJobKey(kbId, jobId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ImportJob ${jobId} not found.`,
      404,
    );
  }
  return stored;
};

const knowledgeBaseView = (
  kb: StoredKnowledgeBase,
): Record<string, unknown> => ({
  knowledgeBaseId: kb.knowledgeBaseId,
  knowledgeBaseArn: kb.knowledgeBaseArn,
  knowledgeBaseType: kb.knowledgeBaseType,
  name: kb.name,
  status: kb.status,
  description: kb.description,
  lastContentModificationTime: kb.lastContentModificationTime,
  tags: kb.tags,
  ...(kb.templateUri !== undefined
    ? { renderingConfiguration: { templateUri: kb.templateUri } }
    : {}),
});

const knowledgeBaseSummary = (
  kb: StoredKnowledgeBase,
): Record<string, unknown> => ({
  knowledgeBaseId: kb.knowledgeBaseId,
  knowledgeBaseArn: kb.knowledgeBaseArn,
  knowledgeBaseType: kb.knowledgeBaseType,
  name: kb.name,
  status: kb.status,
  description: kb.description,
});

const assistantView = (a: StoredAssistant): Record<string, unknown> => ({
  assistantId: a.assistantId,
  assistantArn: a.assistantArn,
  name: a.name,
  type: a.type,
  status: a.status,
  description: a.description,
  tags: a.tags,
});

const assistantSummary = (a: StoredAssistant): Record<string, unknown> => ({
  assistantId: a.assistantId,
  assistantArn: a.assistantArn,
  name: a.name,
  type: a.type,
  status: a.status,
  description: a.description,
  tags: a.tags,
});

const associationView = (
  assoc: StoredAssistantAssociation,
): Record<string, unknown> => ({
  assistantAssociationId: assoc.assistantAssociationId,
  assistantAssociationArn: assoc.assistantAssociationArn,
  assistantId: assoc.assistantId,
  assistantArn: assoc.assistantArn,
  associationType: assoc.associationType,
  associationData: {
    knowledgeBaseAssociation: {
      knowledgeBaseId: assoc.knowledgeBaseId,
      knowledgeBaseArn: assoc.knowledgeBaseArn,
    },
  },
  tags: assoc.tags,
});

const contentView = (c: StoredContent): Record<string, unknown> => ({
  contentId: c.contentId,
  contentArn: c.contentArn,
  knowledgeBaseId: c.knowledgeBaseId,
  knowledgeBaseArn: c.knowledgeBaseArn,
  name: c.name,
  title: c.title,
  contentType: c.contentType,
  status: c.status,
  revisionId: c.revisionId,
  metadata: c.metadata,
  url: c.url,
  urlExpiry: c.urlExpiry,
  linkOutUri: c.linkOutUri,
  tags: c.tags,
});

const contentSummaryView = (c: StoredContent): Record<string, unknown> => ({
  contentId: c.contentId,
  contentArn: c.contentArn,
  knowledgeBaseId: c.knowledgeBaseId,
  knowledgeBaseArn: c.knowledgeBaseArn,
  name: c.name,
  title: c.title,
  contentType: c.contentType,
  status: c.status,
  revisionId: c.revisionId,
  metadata: c.metadata,
  tags: c.tags,
});

const quickResponseView = (
  qr: StoredQuickResponse,
): Record<string, unknown> => ({
  quickResponseId: qr.quickResponseId,
  quickResponseArn: qr.quickResponseArn,
  knowledgeBaseId: qr.knowledgeBaseId,
  knowledgeBaseArn: qr.knowledgeBaseArn,
  name: qr.name,
  contentType: qr.contentType,
  status: qr.status,
  createdTime: qr.createdTime,
  lastModifiedTime: qr.lastModifiedTime,
  contents: {
    plainText:
      qr.plainTextContent !== undefined
        ? { content: qr.plainTextContent }
        : undefined,
    markdown:
      qr.markdownContent !== undefined
        ? { content: qr.markdownContent }
        : undefined,
  },
  description: qr.description,
  isActive: qr.isActive,
  language: qr.language,
  shortcutKey: qr.shortcutKey,
  tags: qr.tags,
});

const quickResponseSummaryView = (
  qr: StoredQuickResponse,
): Record<string, unknown> => ({
  quickResponseId: qr.quickResponseId,
  quickResponseArn: qr.quickResponseArn,
  knowledgeBaseId: qr.knowledgeBaseId,
  knowledgeBaseArn: qr.knowledgeBaseArn,
  name: qr.name,
  contentType: qr.contentType,
  status: qr.status,
  createdTime: qr.createdTime,
  lastModifiedTime: qr.lastModifiedTime,
  description: qr.description,
  isActive: qr.isActive,
  tags: qr.tags,
});

const sessionView = (s: StoredSession): Record<string, unknown> => ({
  sessionId: s.sessionId,
  sessionArn: s.sessionArn,
  name: s.name,
  description: s.description,
  tags: s.tags,
});

const sessionSummaryView = (s: StoredSession): Record<string, unknown> => ({
  sessionId: s.sessionId,
  sessionArn: s.sessionArn,
  assistantId: s.assistantId,
  assistantArn: s.assistantArn,
});

const importJobView = (j: StoredImportJob): Record<string, unknown> => ({
  importJobId: j.importJobId,
  knowledgeBaseId: j.knowledgeBaseId,
  knowledgeBaseArn: j.knowledgeBaseArn,
  importJobType: j.importJobType,
  uploadId: j.uploadId,
  status: j.status,
  createdTime: j.createdTime,
  lastModifiedTime: j.lastModifiedTime,
  url: j.url,
  urlExpiry: j.urlExpiry,
  metadata: j.metadata,
});

const importJobSummaryView = (j: StoredImportJob): Record<string, unknown> => ({
  importJobId: j.importJobId,
  knowledgeBaseId: j.knowledgeBaseId,
  knowledgeBaseArn: j.knowledgeBaseArn,
  importJobType: j.importJobType,
  uploadId: j.uploadId,
  status: j.status,
  createdTime: j.createdTime,
  lastModifiedTime: j.lastModifiedTime,
  metadata: j.metadata,
});

const CreateKnowledgeBase: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const knowledgeBaseType = requireString(input, "knowledgeBaseType");
  const duplicate = ctx.store
    .list<StoredKnowledgeBase>()
    .find(
      (e) => e.key.startsWith(knowledgeBasePrefix) && e.value.name === name,
    );
  if (duplicate !== undefined) {
    throw awsError(
      "ConflictException",
      `KnowledgeBase with name ${name} already exists.`,
      409,
    );
  }
  const id = crypto.randomUUID();
  const arn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:knowledge-base/${id}`;
  const tags = recordOrUndefined(input["tags"]);
  const knowledgeBase: StoredKnowledgeBase = {
    knowledgeBaseId: id,
    knowledgeBaseArn: arn,
    knowledgeBaseType,
    name,
    status: "CREATE_IN_PROGRESS",
    description: stringOrUndefined(input["description"]),
    lastContentModificationTime: nowSeconds(),
    tags,
    templateUri: undefined,
  };
  ctx.store.set(knowledgeBaseKey(id), knowledgeBase);
  syncTags(arn, tags, ctx);
  return { knowledgeBase: knowledgeBaseView(knowledgeBase) };
};

const GetKnowledgeBase: OperationHandler = (input, ctx) => {
  const id = requireString(input, "knowledgeBaseId");
  const stored = requireKnowledgeBase(ctx, id);
  if (stored.status === "CREATE_IN_PROGRESS") {
    const updated: StoredKnowledgeBase = { ...stored, status: "ACTIVE" };
    ctx.store.set(knowledgeBaseKey(id), updated);
    return { knowledgeBase: knowledgeBaseView(updated) };
  }
  return { knowledgeBase: knowledgeBaseView(stored) };
};

const ListKnowledgeBases: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const knowledgeBases = ctx.store
    .list<StoredKnowledgeBase>()
    .filter((entry) => entry.key.startsWith(knowledgeBasePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page, nextToken } = paginate(knowledgeBases, max, input["nextToken"]);
  return {
    knowledgeBaseSummaries: page.map(knowledgeBaseSummary),
    nextToken,
  };
};

const DeleteKnowledgeBase: OperationHandler = (input, ctx) => {
  const id = requireString(input, "knowledgeBaseId");
  const kb = requireKnowledgeBase(ctx, id);
  const kbContentPrefix = contentKey(id, "");
  const hasContents = ctx.store
    .list<StoredContent>()
    .some((e) => e.key.startsWith(kbContentPrefix));
  if (hasContents) {
    throw awsError(
      "ConflictException",
      `KnowledgeBase ${id} has contents. Delete all contents before deleting the knowledge base.`,
      409,
    );
  }
  ctx.store.delete(knowledgeBaseKey(id));
  ctx.store.delete(tagKey(kb.knowledgeBaseArn));
  return {};
};

const UpdateKnowledgeBaseTemplateUri: OperationHandler = (input, ctx) => {
  const id = requireString(input, "knowledgeBaseId");
  const templateUri = requireString(input, "templateUri");
  const kb = requireKnowledgeBase(ctx, id);
  const updated: StoredKnowledgeBase = { ...kb, templateUri };
  ctx.store.set(knowledgeBaseKey(id), updated);
  return { knowledgeBase: knowledgeBaseView(updated) };
};

const RemoveKnowledgeBaseTemplateUri: OperationHandler = (input, ctx) => {
  const id = requireString(input, "knowledgeBaseId");
  const kb = requireKnowledgeBase(ctx, id);
  const updated: StoredKnowledgeBase = { ...kb, templateUri: undefined };
  ctx.store.set(knowledgeBaseKey(id), updated);
  return {};
};

const CreateAssistant: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const type = requireString(input, "type");
  const duplicate = ctx.store
    .list<StoredAssistant>()
    .find((e) => e.key.startsWith(assistantPrefix) && e.value.name === name);
  if (duplicate !== undefined) {
    throw awsError(
      "ConflictException",
      `Assistant with name ${name} already exists.`,
      409,
    );
  }
  const id = crypto.randomUUID();
  const arn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:assistant/${id}`;
  const tags = recordOrUndefined(input["tags"]);
  const assistant: StoredAssistant = {
    assistantId: id,
    assistantArn: arn,
    name,
    type,
    status: "CREATE_IN_PROGRESS",
    description: stringOrUndefined(input["description"]),
    tags,
  };
  ctx.store.set(assistantKey(id), assistant);
  syncTags(arn, tags, ctx);
  return { assistant: assistantView(assistant) };
};

const GetAssistant: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assistantId");
  const stored = requireAssistant(ctx, id);
  if (stored.status === "CREATE_IN_PROGRESS") {
    const updated: StoredAssistant = { ...stored, status: "ACTIVE" };
    ctx.store.set(assistantKey(id), updated);
    return { assistant: assistantView(updated) };
  }
  return { assistant: assistantView(stored) };
};

const ListAssistants: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const assistants = ctx.store
    .list<StoredAssistant>()
    .filter((entry) => entry.key.startsWith(assistantPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const { page, nextToken } = paginate(assistants, max, input["nextToken"]);
  return {
    assistantSummaries: page.map(assistantSummary),
    nextToken,
  };
};

const DeleteAssistant: OperationHandler = (input, ctx) => {
  const id = requireString(input, "assistantId");
  const stored = requireAssistant(ctx, id);
  ctx.store.delete(assistantKey(id));
  ctx.store.delete(tagKey(stored.assistantArn));
  return {};
};

const CreateAssistantAssociation: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const assistant = requireAssistant(ctx, assistantId);
  const associationType = requireString(input, "associationType");
  const association = recordOrUndefined(input["association"]);
  const knowledgeBaseId =
    association !== undefined
      ? stringOrUndefined(association["knowledgeBaseId"])
      : undefined;
  let knowledgeBaseArn: string | undefined;
  if (knowledgeBaseId !== undefined) {
    const kb = requireKnowledgeBase(ctx, knowledgeBaseId);
    knowledgeBaseArn = kb.knowledgeBaseArn;
  }
  const assocId = crypto.randomUUID();
  const assocArn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:association/${assistantId}/${assocId}`;
  const stored: StoredAssistantAssociation = {
    assistantAssociationId: assocId,
    assistantAssociationArn: assocArn,
    assistantId,
    assistantArn: assistant.assistantArn,
    associationType,
    knowledgeBaseId,
    knowledgeBaseArn,
    tags: recordOrUndefined(input["tags"]),
  };
  ctx.store.set(associationKey(assistantId, assocId), stored);
  return { assistantAssociation: associationView(stored) };
};

const GetAssistantAssociation: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const assocId = requireString(input, "assistantAssociationId");
  return {
    assistantAssociation: associationView(
      requireAssociation(ctx, assistantId, assocId),
    ),
  };
};

const ListAssistantAssociations: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  requireAssistant(ctx, assistantId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = associationKey(assistantId, "");
  const associations = ctx.store
    .list<StoredAssistantAssociation>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(associations, max, input["nextToken"]);
  return {
    assistantAssociationSummaries: page.map(associationView),
    nextToken,
  };
};

const DeleteAssistantAssociation: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const assocId = requireString(input, "assistantAssociationId");
  requireAssociation(ctx, assistantId, assocId);
  ctx.store.delete(associationKey(assistantId, assocId));
  return {};
};

const CreateSession: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const assistant = requireAssistant(ctx, assistantId);
  const name = requireString(input, "name");
  const sessionId = crypto.randomUUID();
  const sessionArn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:session/${assistantId}/${sessionId}`;
  const stored: StoredSession = {
    sessionId,
    sessionArn,
    assistantId,
    assistantArn: assistant.assistantArn,
    name,
    description: stringOrUndefined(input["description"]),
    tags: recordOrUndefined(input["tags"]),
  };
  ctx.store.set(sessionKey(assistantId, sessionId), stored);
  return { session: sessionView(stored) };
};

const GetSession: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const sessionId = requireString(input, "sessionId");
  return { session: sessionView(requireSession(ctx, assistantId, sessionId)) };
};

const SearchSessions: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  requireAssistant(ctx, assistantId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = sessionKey(assistantId, "");
  const sessions = ctx.store
    .list<StoredSession>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(sessions, max, input["nextToken"]);
  return {
    sessionSummaries: page.map(sessionSummaryView),
    nextToken,
  };
};

const GetRecommendations: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const sessionId = requireString(input, "sessionId");
  requireSession(ctx, assistantId, sessionId);
  return { recommendations: [], triggers: [] };
};

const NotifyRecommendationsReceived: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  const sessionId = requireString(input, "sessionId");
  requireSession(ctx, assistantId, sessionId);
  const ids = Array.isArray(input["recommendationIds"])
    ? (input["recommendationIds"] as string[])
    : [];
  return { recommendationIds: ids, errors: [] };
};

const QueryAssistant: OperationHandler = (input, ctx) => {
  const assistantId = requireString(input, "assistantId");
  requireAssistant(ctx, assistantId);
  return { results: [] };
};

const CreateContent: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const kb = requireKnowledgeBase(ctx, kbId);
  const name = requireString(input, "name");
  const kbContentPrefix = contentKey(kbId, "");
  const duplicate = ctx.store
    .list<StoredContent>()
    .find((e) => e.key.startsWith(kbContentPrefix) && e.value.name === name);
  if (duplicate !== undefined) {
    throw awsError(
      "ConflictException",
      `Content with name ${name} already exists in knowledge base ${kbId}.`,
      409,
    );
  }
  const uploadId = requireString(input, "uploadId");
  const contentId = crypto.randomUUID();
  const contentArn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:content/${kbId}/${contentId}`;
  const tags = recordOrUndefined(input["tags"]);
  const stored: StoredContent = {
    contentId,
    contentArn,
    knowledgeBaseId: kbId,
    knowledgeBaseArn: kb.knowledgeBaseArn,
    name,
    title: stringOrUndefined(input["title"]) ?? name,
    contentType: "application/octet-stream",
    status: "ACTIVE",
    revisionId: crypto.randomUUID(),
    metadata: stringRecordOrUndefined(input["metadata"]) ?? {},
    url: `https://example.com/content/${uploadId}`,
    urlExpiry: nowSeconds() + 3600,
    linkOutUri: stringOrUndefined(input["overrideLinkOutUri"]),
    tags,
  };
  ctx.store.set(contentKey(kbId, contentId), stored);
  syncTags(contentArn, tags, ctx);
  return { content: contentView(stored) };
};

const GetContent: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const contentId = requireString(input, "contentId");
  return { content: contentView(requireContent(ctx, kbId, contentId)) };
};

const GetContentSummary: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const contentId = requireString(input, "contentId");
  return {
    contentSummary: contentSummaryView(requireContent(ctx, kbId, contentId)),
  };
};

const ListContents: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, kbId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = contentKey(kbId, "");
  const contents = ctx.store
    .list<StoredContent>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(contents, max, input["nextToken"]);
  return {
    contentSummaries: page.map(contentSummaryView),
    nextToken,
  };
};

const UpdateContent: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const contentId = requireString(input, "contentId");
  const existing = requireContent(ctx, kbId, contentId);
  const updated: StoredContent = {
    ...existing,
    title: stringOrUndefined(input["title"]) ?? existing.title,
    revisionId: crypto.randomUUID(),
    linkOutUri:
      input["removeOverrideLinkOutUri"] === true
        ? undefined
        : (stringOrUndefined(input["overrideLinkOutUri"]) ??
          existing.linkOutUri),
    metadata: stringRecordOrUndefined(input["metadata"]) ?? existing.metadata,
  };
  ctx.store.set(contentKey(kbId, contentId), updated);
  return { content: contentView(updated) };
};

const DeleteContent: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const contentId = requireString(input, "contentId");
  const stored = requireContent(ctx, kbId, contentId);
  ctx.store.delete(contentKey(kbId, contentId));
  ctx.store.delete(tagKey(stored.contentArn));
  return {};
};

const SearchContent: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, kbId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = contentKey(kbId, "");
  const contents = ctx.store
    .list<StoredContent>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(contents, max, input["nextToken"]);
  return {
    contentSummaries: page.map(contentSummaryView),
    nextToken,
  };
};

const StartContentUpload: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, kbId);
  const uploadId = crypto.randomUUID();
  return {
    uploadId,
    url: `https://example.com/upload/${uploadId}`,
    urlExpiry: nowSeconds() + 3600,
    headersToInclude: {},
  };
};

const CreateQuickResponse: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const kb = requireKnowledgeBase(ctx, kbId);
  const name = requireString(input, "name");
  const qrPrefix = quickResponseKey(kbId, "");
  const duplicate = ctx.store
    .list<StoredQuickResponse>()
    .find((e) => e.key.startsWith(qrPrefix) && e.value.name === name);
  if (duplicate !== undefined) {
    throw awsError(
      "ConflictException",
      `QuickResponse with name ${name} already exists in knowledge base ${kbId}.`,
      409,
    );
  }
  const content = recordOrUndefined(input["content"]);
  const plainTextContent =
    content !== undefined ? stringOrUndefined(content["plainText"]) : undefined;
  const markdownContent =
    content !== undefined ? stringOrUndefined(content["markdown"]) : undefined;
  const qrId = crypto.randomUUID();
  const qrArn = `arn:aws:wisdom:${ctx.region}:${ctx.account}:quick-response/${kbId}/${qrId}`;
  const now = nowSeconds();
  const tags = recordOrUndefined(input["tags"]);
  const stored: StoredQuickResponse = {
    quickResponseId: qrId,
    quickResponseArn: qrArn,
    knowledgeBaseId: kbId,
    knowledgeBaseArn: kb.knowledgeBaseArn,
    name,
    contentType:
      stringOrUndefined(input["contentType"]) ??
      "application/x.quickresponse;format=plain",
    status: "CREATED",
    createdTime: now,
    lastModifiedTime: now,
    plainTextContent,
    markdownContent,
    description: stringOrUndefined(input["description"]),
    isActive: input["isActive"] === true,
    language: stringOrUndefined(input["language"]),
    shortcutKey: stringOrUndefined(input["shortcutKey"]),
    tags,
  };
  ctx.store.set(quickResponseKey(kbId, qrId), stored);
  syncTags(qrArn, tags, ctx);
  return { quickResponse: quickResponseView(stored) };
};

const GetQuickResponse: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const qrId = requireString(input, "quickResponseId");
  return {
    quickResponse: quickResponseView(requireQuickResponse(ctx, kbId, qrId)),
  };
};

const ListQuickResponses: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, kbId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = quickResponseKey(kbId, "");
  const qrs = ctx.store
    .list<StoredQuickResponse>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(qrs, max, input["nextToken"]);
  return {
    quickResponseSummaries: page.map(quickResponseSummaryView),
    nextToken,
  };
};

const UpdateQuickResponse: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const qrId = requireString(input, "quickResponseId");
  const existing = requireQuickResponse(ctx, kbId, qrId);
  const content = recordOrUndefined(input["content"]);
  const updated: StoredQuickResponse = {
    ...existing,
    name: stringOrUndefined(input["name"]) ?? existing.name,
    contentType:
      stringOrUndefined(input["contentType"]) ?? existing.contentType,
    description:
      input["removeDescription"] === true
        ? undefined
        : (stringOrUndefined(input["description"]) ?? existing.description),
    isActive:
      input["isActive"] !== undefined
        ? input["isActive"] === true
        : existing.isActive,
    language: stringOrUndefined(input["language"]) ?? existing.language,
    shortcutKey:
      input["removeShortcutKey"] === true
        ? undefined
        : (stringOrUndefined(input["shortcutKey"]) ?? existing.shortcutKey),
    lastModifiedTime: nowSeconds(),
    plainTextContent:
      content !== undefined
        ? stringOrUndefined(content["plainText"])
        : existing.plainTextContent,
    markdownContent:
      content !== undefined
        ? stringOrUndefined(content["markdown"])
        : existing.markdownContent,
  };
  ctx.store.set(quickResponseKey(kbId, qrId), updated);
  return { quickResponse: quickResponseView(updated) };
};

const DeleteQuickResponse: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const qrId = requireString(input, "quickResponseId");
  const stored = requireQuickResponse(ctx, kbId, qrId);
  ctx.store.delete(quickResponseKey(kbId, qrId));
  ctx.store.delete(tagKey(stored.quickResponseArn));
  return {};
};

const SearchQuickResponses: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, kbId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = quickResponseKey(kbId, "");
  const qrs = ctx.store
    .list<StoredQuickResponse>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(qrs, max, input["nextToken"]);
  const results = page.map((qr) => ({
    quickResponseId: qr.quickResponseId,
    quickResponseArn: qr.quickResponseArn,
    knowledgeBaseId: qr.knowledgeBaseId,
    knowledgeBaseArn: qr.knowledgeBaseArn,
    name: qr.name,
    contentType: qr.contentType,
    status: qr.status,
    createdTime: qr.createdTime,
    lastModifiedTime: qr.lastModifiedTime,
    isActive: qr.isActive,
    contents: {
      plainText:
        qr.plainTextContent !== undefined
          ? { content: qr.plainTextContent }
          : undefined,
      markdown:
        qr.markdownContent !== undefined
          ? { content: qr.markdownContent }
          : undefined,
    },
    description: qr.description,
    language: qr.language,
    shortcutKey: qr.shortcutKey,
    tags: qr.tags,
  }));
  return { results, nextToken };
};

const StartImportJob: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const kb = requireKnowledgeBase(ctx, kbId);
  const importJobType = requireString(input, "importJobType");
  const uploadId = requireString(input, "uploadId");
  const jobId = crypto.randomUUID();
  const now = nowSeconds();
  const stored: StoredImportJob = {
    importJobId: jobId,
    knowledgeBaseId: kbId,
    knowledgeBaseArn: kb.knowledgeBaseArn,
    importJobType,
    uploadId,
    status: "START_IN_PROGRESS",
    createdTime: now,
    lastModifiedTime: now,
    url: `https://example.com/import/${uploadId}`,
    urlExpiry: now + 3600,
    metadata: stringRecordOrUndefined(input["metadata"]),
  };
  ctx.store.set(importJobKey(kbId, jobId), stored);
  return { importJob: importJobView(stored) };
};

const GetImportJob: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const jobId = requireString(input, "importJobId");
  const stored = requireImportJob(ctx, kbId, jobId);
  if (stored.status === "START_IN_PROGRESS") {
    const updated: StoredImportJob = { ...stored, status: "COMPLETE" };
    ctx.store.set(importJobKey(kbId, jobId), updated);
    return { importJob: importJobView(updated) };
  }
  return { importJob: importJobView(stored) };
};

const ListImportJobs: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  requireKnowledgeBase(ctx, kbId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const prefix = importJobKey(kbId, "");
  const jobs = ctx.store
    .list<StoredImportJob>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginate(jobs, max, input["nextToken"]);
  return {
    importJobSummaries: page.map(importJobSummaryView),
    nextToken,
  };
};

const DeleteImportJob: OperationHandler = (input, ctx) => {
  const kbId = requireString(input, "knowledgeBaseId");
  const jobId = requireString(input, "importJobId");
  requireImportJob(ctx, kbId, jobId);
  ctx.store.delete(importJobKey(kbId, jobId));
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  return { tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = recordOrUndefined(input["tags"]) ?? {};
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const merged: Record<string, string> = { ...existing };
  for (const [k, v] of Object.entries(newTags)) {
    if (typeof v === "string") merged[k] = v;
  }
  ctx.store.set(tagKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceArn)) ?? {};
  const updated = { ...existing };
  for (const k of tagKeys) {
    delete updated[k];
  }
  ctx.store.set(tagKey(resourceArn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const wisdom = {
  name: "wisdom",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;

    if (parts[0] === "assistants") {
      if (parts.length === 1) {
        if (m === "POST") return "CreateAssistant";
        if (m === "GET") return "ListAssistants";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetAssistant";
        if (m === "DELETE") return "DeleteAssistant";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "associations") {
          if (m === "POST") return "CreateAssistantAssociation";
          if (m === "GET") return "ListAssistantAssociations";
          return undefined;
        }
        if (parts[2] === "sessions") {
          if (m === "POST") return "CreateSession";
          return undefined;
        }
        if (parts[2] === "query") {
          if (m === "POST") return "QueryAssistant";
          return undefined;
        }
        if (parts[2] === "searchSessions") {
          if (m === "POST") return "SearchSessions";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 4) {
        if (parts[2] === "associations") {
          if (m === "GET") return "GetAssistantAssociation";
          if (m === "DELETE") return "DeleteAssistantAssociation";
          return undefined;
        }
        if (parts[2] === "sessions") {
          if (m === "GET") return "GetSession";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 5) {
        if (parts[2] === "sessions" && parts[4] === "recommendations") {
          if (m === "GET") return "GetRecommendations";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 6) {
        if (
          parts[2] === "sessions" &&
          parts[4] === "recommendations" &&
          parts[5] === "notify"
        ) {
          if (m === "POST") return "NotifyRecommendationsReceived";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "knowledgeBases") {
      if (parts.length === 1) {
        if (m === "POST") return "CreateKnowledgeBase";
        if (m === "GET") return "ListKnowledgeBases";
        return undefined;
      }
      if (parts.length === 2) {
        if (m === "GET") return "GetKnowledgeBase";
        if (m === "DELETE") return "DeleteKnowledgeBase";
        return undefined;
      }
      if (parts.length === 3) {
        switch (parts[2]) {
          case "contents":
            if (m === "POST") return "CreateContent";
            if (m === "GET") return "ListContents";
            return undefined;
          case "search":
            if (m === "POST") return "SearchContent";
            return undefined;
          case "quickResponses":
            if (m === "POST") return "CreateQuickResponse";
            if (m === "GET") return "ListQuickResponses";
            return undefined;
          case "importJobs":
            if (m === "POST") return "StartImportJob";
            if (m === "GET") return "ListImportJobs";
            return undefined;
          case "upload":
            if (m === "POST") return "StartContentUpload";
            return undefined;
          case "templateUri":
            if (m === "POST") return "UpdateKnowledgeBaseTemplateUri";
            if (m === "DELETE") return "RemoveKnowledgeBaseTemplateUri";
            return undefined;
          default:
            return undefined;
        }
      }
      if (parts.length === 4) {
        if (parts[2] === "contents") {
          if (m === "GET") return "GetContent";
          if (m === "POST") return "UpdateContent";
          if (m === "DELETE") return "DeleteContent";
          return undefined;
        }
        if (parts[2] === "quickResponses") {
          if (m === "GET") return "GetQuickResponse";
          if (m === "POST") return "UpdateQuickResponse";
          if (m === "DELETE") return "DeleteQuickResponse";
          return undefined;
        }
        if (parts[2] === "importJobs") {
          if (m === "GET") return "GetImportJob";
          if (m === "DELETE") return "DeleteImportJob";
          return undefined;
        }
        if (parts[2] === "search" && parts[3] === "quickResponses") {
          if (m === "POST") return "SearchQuickResponses";
          return undefined;
        }
        return undefined;
      }
      if (parts.length === 5) {
        if (parts[2] === "contents" && parts[4] === "summary") {
          if (m === "GET") return "GetContentSummary";
          return undefined;
        }
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "tags" && parts.length === 2) {
      if (m === "GET") return "ListTagsForResource";
      if (m === "POST") return "TagResource";
      if (m === "DELETE") return "UntagResource";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateKnowledgeBase,
    GetKnowledgeBase,
    ListKnowledgeBases,
    DeleteKnowledgeBase,
    UpdateKnowledgeBaseTemplateUri,
    RemoveKnowledgeBaseTemplateUri,
    CreateAssistant,
    GetAssistant,
    ListAssistants,
    DeleteAssistant,
    CreateAssistantAssociation,
    GetAssistantAssociation,
    ListAssistantAssociations,
    DeleteAssistantAssociation,
    CreateSession,
    GetSession,
    SearchSessions,
    GetRecommendations,
    NotifyRecommendationsReceived,
    QueryAssistant,
    CreateContent,
    GetContent,
    GetContentSummary,
    ListContents,
    UpdateContent,
    DeleteContent,
    SearchContent,
    StartContentUpload,
    CreateQuickResponse,
    GetQuickResponse,
    ListQuickResponses,
    UpdateQuickResponse,
    DeleteQuickResponse,
    SearchQuickResponses,
    StartImportJob,
    GetImportJob,
    ListImportJobs,
    DeleteImportJob,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default wisdom;
