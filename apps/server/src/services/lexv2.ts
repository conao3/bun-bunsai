import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import lexv2Model from "../../../../test/vendor/aws-models/lexv2.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(lexv2Model);

type StoredBot = {
  botId: string;
  botName: string;
  description: string | undefined;
  roleArn: string;
  dataPrivacy: Record<string, unknown>;
  idleSessionTTLInSeconds: number;
  botStatus: string;
  botType: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBotAlias = {
  botAliasId: string;
  botAliasName: string;
  botId: string;
  botVersion: string | undefined;
  description: string | undefined;
  botAliasStatus: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBotLocale = {
  botId: string;
  botVersion: string;
  localeId: string;
  localeName: string;
  description: string | undefined;
  nluIntentConfidenceThreshold: number;
  botLocaleStatus: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBotVersion = {
  botId: string;
  botVersion: string;
  description: string | undefined;
  botStatus: string;
  creationDateTime: number;
};

type StoredBotReplica = {
  botId: string;
  replicaRegion: string;
  sourceRegion: string;
  botReplicaStatus: string;
  creationDateTime: number;
};

type StoredIntent = {
  intentId: string;
  intentName: string;
  botId: string;
  botVersion: string;
  localeId: string;
  description: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredSlot = {
  slotId: string;
  slotName: string;
  botId: string;
  botVersion: string;
  localeId: string;
  intentId: string;
  description: string | undefined;
  slotTypeId: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredSlotType = {
  slotTypeId: string;
  slotTypeName: string;
  botId: string;
  botVersion: string;
  localeId: string;
  description: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredCustomVocabItem = {
  itemId: string;
  phrase: string;
  weight: number | undefined;
  displayAs: string | undefined;
};

type StoredExport = {
  exportId: string;
  resourceSpecification: Record<string, unknown>;
  fileFormat: string;
  exportStatus: string;
  downloadUrl: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredImport = {
  importId: string;
  resourceSpecification: Record<string, unknown> | undefined;
  importedResourceId: string | undefined;
  importedResourceName: string | undefined;
  importStatus: string;
  mergeStrategy: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredResourcePolicy = {
  resourceArn: string;
  policy: string;
  revisionId: string;
  lastUpdatedDateTime: number;
};

type StoredTestSet = {
  testSetId: string;
  testSetName: string;
  description: string | undefined;
  modality: string;
  status: string;
  numTurns: number;
  storageLocation: Record<string, unknown> | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredTestExecution = {
  testExecutionId: string;
  testSetId: string;
  target: Record<string, unknown>;
  apiMode: string;
  testExecutionModality: string;
  testExecutionStatus: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredTestSetGeneration = {
  testSetGenerationId: string;
  testSetName: string;
  description: string | undefined;
  storageLocation: Record<string, unknown> | undefined;
  generationDataSource: Record<string, unknown>;
  roleArn: string;
  testSetGenerationStatus: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBotRecommendation = {
  botId: string;
  botVersion: string;
  localeId: string;
  botRecommendationId: string;
  botRecommendationStatus: string;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

type StoredBotAnalyzer = {
  botId: string;
  botAnalyzerRequestId: string;
  botAnalyzerStatus: string;
  creationDateTime: number;
};

type StoredBotResourceGeneration = {
  botId: string;
  botVersion: string;
  localeId: string;
  generationId: string;
  generationStatus: string;
  generationInputPrompt: string | undefined;
  creationDateTime: number;
  lastUpdatedDateTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

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

const requireRecord = (
  input: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const value = recordOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const requireNumber = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const value = input[field];
  if (typeof value !== "number") {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const botKey = (id: string): string => `bot:${id}`;
const aliasKey = (botId: string, aliasId: string): string =>
  `alias:${botId}:${aliasId}`;
const localeKey = (
  botId: string,
  botVersion: string,
  localeId: string,
): string => `locale:${botId}:${botVersion}:${localeId}`;
const versionKey = (botId: string, botVersion: string): string =>
  `version:${botId}:${botVersion}`;
const replicaKey = (botId: string, replicaRegion: string): string =>
  `replica:${botId}:${replicaRegion}`;
const intentKey = (
  botId: string,
  botVersion: string,
  localeId: string,
  intentId: string,
): string => `intent:${botId}:${botVersion}:${localeId}:${intentId}`;
const slotKey = (
  botId: string,
  botVersion: string,
  localeId: string,
  intentId: string,
  slotId: string,
): string => `slot:${botId}:${botVersion}:${localeId}:${intentId}:${slotId}`;
const slotTypeKey = (
  botId: string,
  botVersion: string,
  localeId: string,
  slotTypeId: string,
): string => `slottype:${botId}:${botVersion}:${localeId}:${slotTypeId}`;
const vocabKey = (
  botId: string,
  botVersion: string,
  localeId: string,
): string => `vocab:${botId}:${botVersion}:${localeId}`;
const exportKey = (exportId: string): string => `export:${exportId}`;
const importKey = (importId: string): string => `import:${importId}`;
const policyKey = (resourceArn: string): string => `policy:${resourceArn}`;
const tagKey = (resourceARN: string): string => `tag:${resourceARN}`;
const testSetKey = (testSetId: string): string => `testset:${testSetId}`;
const testExecKey = (testExecutionId: string): string =>
  `testexec:${testExecutionId}`;
const testGenKey = (testSetGenerationId: string): string =>
  `testgen:${testSetGenerationId}`;
const botRecKey = (
  botId: string,
  botVersion: string,
  localeId: string,
  botRecommendationId: string,
): string => `botrec:${botId}:${botVersion}:${localeId}:${botRecommendationId}`;
const botAnalyzerKey = (botId: string, botAnalyzerRequestId: string): string =>
  `botanalyzer:${botId}:${botAnalyzerRequestId}`;
const botResGenKey = (
  botId: string,
  botVersion: string,
  localeId: string,
  generationId: string,
): string =>
  `botresourcegen:${botId}:${botVersion}:${localeId}:${generationId}`;

const nowSeconds = (): number => Date.now() / 1000;

const generateId = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const requireBot = (ctx: ServiceContext, botId: string): StoredBot => {
  const bot = ctx.store.get<StoredBot>(botKey(botId));
  if (bot === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Bot ${botId} does not exist.`,
      404,
    );
  }
  return bot;
};

const requireBotAlias = (
  ctx: ServiceContext,
  botId: string,
  botAliasId: string,
): StoredBotAlias => {
  const alias = ctx.store.get<StoredBotAlias>(aliasKey(botId, botAliasId));
  if (alias === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotAlias ${botAliasId} does not exist.`,
      404,
    );
  }
  return alias;
};

const requireBotLocale = (
  ctx: ServiceContext,
  botId: string,
  botVersion: string,
  localeId: string,
): StoredBotLocale => {
  const locale = ctx.store.get<StoredBotLocale>(
    localeKey(botId, botVersion, localeId),
  );
  if (locale === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotLocale ${localeId} does not exist.`,
      404,
    );
  }
  return locale;
};

const requireBotVersion = (
  ctx: ServiceContext,
  botId: string,
  botVersion: string,
): StoredBotVersion => {
  const version = ctx.store.get<StoredBotVersion>(
    versionKey(botId, botVersion),
  );
  if (version === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotVersion ${botVersion} does not exist.`,
      404,
    );
  }
  return version;
};

const requireIntent = (
  ctx: ServiceContext,
  botId: string,
  botVersion: string,
  localeId: string,
  intentId: string,
): StoredIntent => {
  const intent = ctx.store.get<StoredIntent>(
    intentKey(botId, botVersion, localeId, intentId),
  );
  if (intent === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Intent ${intentId} does not exist.`,
      404,
    );
  }
  return intent;
};

const requireSlot = (
  ctx: ServiceContext,
  botId: string,
  botVersion: string,
  localeId: string,
  intentId: string,
  slotId: string,
): StoredSlot => {
  const slot = ctx.store.get<StoredSlot>(
    slotKey(botId, botVersion, localeId, intentId, slotId),
  );
  if (slot === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Slot ${slotId} does not exist.`,
      404,
    );
  }
  return slot;
};

const requireSlotType = (
  ctx: ServiceContext,
  botId: string,
  botVersion: string,
  localeId: string,
  slotTypeId: string,
): StoredSlotType => {
  const slotType = ctx.store.get<StoredSlotType>(
    slotTypeKey(botId, botVersion, localeId, slotTypeId),
  );
  if (slotType === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `SlotType ${slotTypeId} does not exist.`,
      404,
    );
  }
  return slotType;
};

const requireExport = (ctx: ServiceContext, exportId: string): StoredExport => {
  const exp = ctx.store.get<StoredExport>(exportKey(exportId));
  if (exp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Export ${exportId} does not exist.`,
      404,
    );
  }
  return exp;
};

const requireImport = (ctx: ServiceContext, importId: string): StoredImport => {
  const imp = ctx.store.get<StoredImport>(importKey(importId));
  if (imp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Import ${importId} does not exist.`,
      404,
    );
  }
  return imp;
};

const requireTestSet = (
  ctx: ServiceContext,
  testSetId: string,
): StoredTestSet => {
  const ts = ctx.store.get<StoredTestSet>(testSetKey(testSetId));
  if (ts === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TestSet ${testSetId} does not exist.`,
      404,
    );
  }
  return ts;
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((segment) => segment.length > 0);

const CreateBot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botName = requireString(request, "botName");
  const roleArn = requireString(request, "roleArn");
  const dataPrivacy = requireRecord(request, "dataPrivacy");
  const idleSessionTTLInSeconds = requireNumber(
    request,
    "idleSessionTTLInSeconds",
  );
  const botType = stringOrUndefined(request.botType) ?? "Bot";
  const now = nowSeconds();
  const bot: StoredBot = {
    botId: generateId(),
    botName,
    description: stringOrUndefined(request.description),
    roleArn,
    dataPrivacy,
    idleSessionTTLInSeconds,
    botStatus: "Available",
    botType,
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(botKey(bot.botId), bot);
  return {
    botId: bot.botId,
    botName: bot.botName,
    description: bot.description,
    roleArn: bot.roleArn,
    dataPrivacy: bot.dataPrivacy,
    idleSessionTTLInSeconds: bot.idleSessionTTLInSeconds,
    botStatus: bot.botStatus,
    botType: bot.botType,
    creationDateTime: bot.creationDateTime,
  };
};

const DescribeBot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const bot = requireBot(ctx, botId);
  return {
    botId: bot.botId,
    botName: bot.botName,
    description: bot.description,
    roleArn: bot.roleArn,
    dataPrivacy: bot.dataPrivacy,
    idleSessionTTLInSeconds: bot.idleSessionTTLInSeconds,
    botStatus: bot.botStatus,
    botType: bot.botType,
    creationDateTime: bot.creationDateTime,
    lastUpdatedDateTime: bot.lastUpdatedDateTime,
  };
};

const ListBots: OperationHandler = (_input, ctx) => {
  const bots = ctx.store
    .list<StoredBot>()
    .filter((entry) => entry.key.startsWith("bot:"))
    .map((entry) => entry.value);
  return {
    botSummaries: bots.map((bot) => ({
      botId: bot.botId,
      botName: bot.botName,
      description: bot.description,
      botStatus: bot.botStatus,
      botType: bot.botType,
      lastUpdatedDateTime: bot.lastUpdatedDateTime,
    })),
  };
};

const DeleteBot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const bot = requireBot(ctx, botId);
  ctx.store.delete(botKey(botId));
  return {
    botId: bot.botId,
    botStatus: "Deleting",
  };
};

const UpdateBot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const bot = requireBot(ctx, botId);
  const now = nowSeconds();
  const updated: StoredBot = {
    ...bot,
    botName: stringOrUndefined(request.botName) ?? bot.botName,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : bot.description,
    roleArn: stringOrUndefined(request.roleArn) ?? bot.roleArn,
    dataPrivacy: recordOrUndefined(request.dataPrivacy) ?? bot.dataPrivacy,
    idleSessionTTLInSeconds:
      typeof request.idleSessionTTLInSeconds === "number"
        ? request.idleSessionTTLInSeconds
        : bot.idleSessionTTLInSeconds,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(botKey(botId), updated);
  return {
    botId: updated.botId,
    botName: updated.botName,
    description: updated.description,
    roleArn: updated.roleArn,
    dataPrivacy: updated.dataPrivacy,
    idleSessionTTLInSeconds: updated.idleSessionTTLInSeconds,
    botStatus: updated.botStatus,
    botType: updated.botType,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const CreateBotAlias: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const botAliasName = requireString(request, "botAliasName");
  const now = nowSeconds();
  const alias: StoredBotAlias = {
    botAliasId: generateId(),
    botAliasName,
    botId,
    botVersion: stringOrUndefined(request.botVersion),
    description: stringOrUndefined(request.description),
    botAliasStatus: "Available",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(aliasKey(botId, alias.botAliasId), alias);
  return {
    botAliasId: alias.botAliasId,
    botAliasName: alias.botAliasName,
    botId: alias.botId,
    botVersion: alias.botVersion,
    description: alias.description,
    botAliasStatus: alias.botAliasStatus,
    creationDateTime: alias.creationDateTime,
  };
};

const DescribeBotAlias: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botAliasId = requireString(request, "botAliasId");
  const alias = requireBotAlias(ctx, botId, botAliasId);
  return {
    botAliasId: alias.botAliasId,
    botAliasName: alias.botAliasName,
    botId: alias.botId,
    botVersion: alias.botVersion,
    description: alias.description,
    botAliasStatus: alias.botAliasStatus,
    creationDateTime: alias.creationDateTime,
    lastUpdatedDateTime: alias.lastUpdatedDateTime,
  };
};

const ListBotAliases: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const prefix = `alias:${botId}:`;
  const aliases = ctx.store
    .list<StoredBotAlias>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botAliasSummaries: aliases.map((a) => ({
      botAliasId: a.botAliasId,
      botAliasName: a.botAliasName,
      botVersion: a.botVersion,
      description: a.description,
      botAliasStatus: a.botAliasStatus,
      creationDateTime: a.creationDateTime,
      lastUpdatedDateTime: a.lastUpdatedDateTime,
    })),
    botId,
  };
};

const DeleteBotAlias: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botAliasId = requireString(request, "botAliasId");
  const alias = requireBotAlias(ctx, botId, botAliasId);
  ctx.store.delete(aliasKey(botId, botAliasId));
  return {
    botId: alias.botId,
    botAliasId: alias.botAliasId,
    botAliasStatus: "Deleting",
  };
};

const UpdateBotAlias: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botAliasId = requireString(request, "botAliasId");
  const alias = requireBotAlias(ctx, botId, botAliasId);
  const now = nowSeconds();
  const updated: StoredBotAlias = {
    ...alias,
    botAliasName: stringOrUndefined(request.botAliasName) ?? alias.botAliasName,
    botVersion:
      "botVersion" in request
        ? stringOrUndefined(request.botVersion)
        : alias.botVersion,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : alias.description,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(aliasKey(botId, botAliasId), updated);
  return {
    botAliasId: updated.botAliasId,
    botAliasName: updated.botAliasName,
    botId: updated.botId,
    botVersion: updated.botVersion,
    description: updated.description,
    botAliasStatus: updated.botAliasStatus,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const CreateBotLocale: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  requireBot(ctx, botId);
  const localeId = requireString(request, "localeId");
  const nluIntentConfidenceThreshold = requireNumber(
    request,
    "nluIntentConfidenceThreshold",
  );
  const now = nowSeconds();
  const locale: StoredBotLocale = {
    botId,
    botVersion,
    localeId,
    localeName: localeId,
    description: stringOrUndefined(request.description),
    nluIntentConfidenceThreshold,
    botLocaleStatus: "NotBuilt",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(localeKey(botId, botVersion, localeId), locale);
  return {
    botId: locale.botId,
    botVersion: locale.botVersion,
    localeId: locale.localeId,
    localeName: locale.localeName,
    description: locale.description,
    nluIntentConfidenceThreshold: locale.nluIntentConfidenceThreshold,
    botLocaleStatus: locale.botLocaleStatus,
    creationDateTime: locale.creationDateTime,
  };
};

const DescribeBotLocale: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const locale = requireBotLocale(ctx, botId, botVersion, localeId);
  return {
    botId: locale.botId,
    botVersion: locale.botVersion,
    localeId: locale.localeId,
    localeName: locale.localeName,
    description: locale.description,
    nluIntentConfidenceThreshold: locale.nluIntentConfidenceThreshold,
    botLocaleStatus: locale.botLocaleStatus,
    creationDateTime: locale.creationDateTime,
    lastUpdatedDateTime: locale.lastUpdatedDateTime,
  };
};

const ListBotLocales: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  requireBot(ctx, botId);
  const prefix = `locale:${botId}:${botVersion}:`;
  const locales = ctx.store
    .list<StoredBotLocale>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersion,
    botLocaleSummaries: locales.map((l) => ({
      localeId: l.localeId,
      localeName: l.localeName,
      description: l.description,
      botLocaleStatus: l.botLocaleStatus,
      lastUpdatedDateTime: l.lastUpdatedDateTime,
      lastBuildSubmittedDateTime: l.lastUpdatedDateTime,
    })),
  };
};

const DeleteBotLocale: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const locale = requireBotLocale(ctx, botId, botVersion, localeId);
  ctx.store.delete(localeKey(botId, botVersion, localeId));
  return {
    botId: locale.botId,
    botVersion: locale.botVersion,
    localeId: locale.localeId,
    botLocaleStatus: "Deleting",
  };
};

const UpdateBotLocale: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const locale = requireBotLocale(ctx, botId, botVersion, localeId);
  const now = nowSeconds();
  const updated: StoredBotLocale = {
    ...locale,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : locale.description,
    nluIntentConfidenceThreshold:
      typeof request.nluIntentConfidenceThreshold === "number"
        ? request.nluIntentConfidenceThreshold
        : locale.nluIntentConfidenceThreshold,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(localeKey(botId, botVersion, localeId), updated);
  return {
    botId: updated.botId,
    botVersion: updated.botVersion,
    localeId: updated.localeId,
    localeName: updated.localeName,
    description: updated.description,
    nluIntentConfidenceThreshold: updated.nluIntentConfidenceThreshold,
    botLocaleStatus: updated.botLocaleStatus,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const BuildBotLocale: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const locale = requireBotLocale(ctx, botId, botVersion, localeId);
  const now = nowSeconds();
  const updated: StoredBotLocale = {
    ...locale,
    botLocaleStatus: "Built",
    lastUpdatedDateTime: now,
  };
  ctx.store.set(localeKey(botId, botVersion, localeId), updated);
  return {
    botId,
    botVersion,
    localeId,
    botLocaleStatus: "Building",
    lastBuildSubmittedDateTime: now,
  };
};

const CreateBotVersion: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const now = nowSeconds();
  const version: StoredBotVersion = {
    botId,
    botVersion: generateId(),
    description: stringOrUndefined(request.description),
    botStatus: "Available",
    creationDateTime: now,
  };
  ctx.store.set(versionKey(botId, version.botVersion), version);
  return {
    botId: version.botId,
    botVersion: version.botVersion,
    description: version.description,
    botStatus: version.botStatus,
    creationDateTime: version.creationDateTime,
  };
};

const DescribeBotVersion: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const version = requireBotVersion(ctx, botId, botVersion);
  return {
    botId: version.botId,
    botVersion: version.botVersion,
    description: version.description,
    botStatus: version.botStatus,
    creationDateTime: version.creationDateTime,
  };
};

const ListBotVersions: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const prefix = `version:${botId}:`;
  const versions = ctx.store
    .list<StoredBotVersion>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersionSummaries: versions.map((v) => ({
      botName: "",
      botVersion: v.botVersion,
      description: v.description,
      botStatus: v.botStatus,
      creationDateTime: v.creationDateTime,
    })),
  };
};

const DeleteBotVersion: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const version = requireBotVersion(ctx, botId, botVersion);
  ctx.store.delete(versionKey(botId, botVersion));
  return {
    botId: version.botId,
    botVersion: version.botVersion,
    botStatus: "Deleting",
  };
};

const CreateBotReplica: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const replicaRegion = requireString(request, "replicaRegion");
  const now = nowSeconds();
  const replica: StoredBotReplica = {
    botId,
    replicaRegion,
    sourceRegion: ctx.region,
    botReplicaStatus: "Enabled",
    creationDateTime: now,
  };
  ctx.store.set(replicaKey(botId, replicaRegion), replica);
  return {
    botId: replica.botId,
    replicaRegion: replica.replicaRegion,
    sourceRegion: replica.sourceRegion,
    botReplicaStatus: replica.botReplicaStatus,
    creationDateTime: replica.creationDateTime,
  };
};

const DescribeBotReplica: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const replicaRegion = requireString(request, "replicaRegion");
  const replica = ctx.store.get<StoredBotReplica>(
    replicaKey(botId, replicaRegion),
  );
  if (replica === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotReplica ${replicaRegion} does not exist.`,
      404,
    );
  }
  return {
    botId: replica.botId,
    replicaRegion: replica.replicaRegion,
    sourceRegion: replica.sourceRegion,
    botReplicaStatus: replica.botReplicaStatus,
    creationDateTime: replica.creationDateTime,
  };
};

const DeleteBotReplica: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const replicaRegion = requireString(request, "replicaRegion");
  const replica = ctx.store.get<StoredBotReplica>(
    replicaKey(botId, replicaRegion),
  );
  if (replica === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotReplica ${replicaRegion} does not exist.`,
      404,
    );
  }
  ctx.store.delete(replicaKey(botId, replicaRegion));
  return {
    botId: replica.botId,
    replicaRegion: replica.replicaRegion,
    botReplicaStatus: "Deleting",
  };
};

const ListBotReplicas: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const prefix = `replica:${botId}:`;
  const replicas = ctx.store
    .list<StoredBotReplica>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botReplicaSummaries: replicas.map((r) => ({
      replicaRegion: r.replicaRegion,
      creationDateTime: r.creationDateTime,
      botReplicaStatus: r.botReplicaStatus,
    })),
  };
};

const ListBotAliasReplicas: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const replicaRegion = requireString(request, "replicaRegion");
  return {
    botId,
    sourceRegion: ctx.region,
    replicaRegion,
    botAliasReplicaSummaries: [],
  };
};

const ListBotVersionReplicas: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const replicaRegion = requireString(request, "replicaRegion");
  return {
    botId,
    sourceRegion: ctx.region,
    replicaRegion,
    botVersionReplicaSummaries: [],
  };
};

const CreateIntent: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const intentName = requireString(request, "intentName");
  const now = nowSeconds();
  const intent: StoredIntent = {
    intentId: generateId(),
    intentName,
    botId,
    botVersion,
    localeId,
    description: stringOrUndefined(request.description),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(
    intentKey(botId, botVersion, localeId, intent.intentId),
    intent,
  );
  return {
    intentId: intent.intentId,
    intentName: intent.intentName,
    botId: intent.botId,
    botVersion: intent.botVersion,
    localeId: intent.localeId,
    description: intent.description,
    creationDateTime: intent.creationDateTime,
  };
};

const DescribeIntent: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  const intent = requireIntent(ctx, botId, botVersion, localeId, intentId);
  return {
    intentId: intent.intentId,
    intentName: intent.intentName,
    botId: intent.botId,
    botVersion: intent.botVersion,
    localeId: intent.localeId,
    description: intent.description,
    creationDateTime: intent.creationDateTime,
    lastUpdatedDateTime: intent.lastUpdatedDateTime,
  };
};

const ListIntents: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const prefix = `intent:${botId}:${botVersion}:${localeId}:`;
  const intents = ctx.store
    .list<StoredIntent>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersion,
    localeId,
    intentSummaries: intents.map((i) => ({
      intentId: i.intentId,
      intentName: i.intentName,
      description: i.description,
      lastUpdatedDateTime: i.lastUpdatedDateTime,
    })),
  };
};

const UpdateIntent: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  const intent = requireIntent(ctx, botId, botVersion, localeId, intentId);
  const now = nowSeconds();
  const updated: StoredIntent = {
    ...intent,
    intentName: stringOrUndefined(request.intentName) ?? intent.intentName,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : intent.description,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(intentKey(botId, botVersion, localeId, intentId), updated);
  return {
    intentId: updated.intentId,
    intentName: updated.intentName,
    botId: updated.botId,
    botVersion: updated.botVersion,
    localeId: updated.localeId,
    description: updated.description,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const DeleteIntent: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  requireIntent(ctx, botId, botVersion, localeId, intentId);
  ctx.store.delete(intentKey(botId, botVersion, localeId, intentId));
  return {};
};

const CreateSlot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  requireBot(ctx, botId);
  const slotName = requireString(request, "slotName");
  const now = nowSeconds();
  const slot: StoredSlot = {
    slotId: generateId(),
    slotName,
    botId,
    botVersion,
    localeId,
    intentId,
    description: stringOrUndefined(request.description),
    slotTypeId: stringOrUndefined(request.slotTypeId),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(
    slotKey(botId, botVersion, localeId, intentId, slot.slotId),
    slot,
  );
  return {
    slotId: slot.slotId,
    slotName: slot.slotName,
    botId: slot.botId,
    botVersion: slot.botVersion,
    localeId: slot.localeId,
    intentId: slot.intentId,
    description: slot.description,
    slotTypeId: slot.slotTypeId,
    creationDateTime: slot.creationDateTime,
  };
};

const DescribeSlot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  const slotId = requireString(request, "slotId");
  const slot = requireSlot(ctx, botId, botVersion, localeId, intentId, slotId);
  return {
    slotId: slot.slotId,
    slotName: slot.slotName,
    botId: slot.botId,
    botVersion: slot.botVersion,
    localeId: slot.localeId,
    intentId: slot.intentId,
    description: slot.description,
    slotTypeId: slot.slotTypeId,
    creationDateTime: slot.creationDateTime,
    lastUpdatedDateTime: slot.lastUpdatedDateTime,
  };
};

const ListSlots: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  requireBot(ctx, botId);
  const prefix = `slot:${botId}:${botVersion}:${localeId}:${intentId}:`;
  const slots = ctx.store
    .list<StoredSlot>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersion,
    localeId,
    intentId,
    slotSummaries: slots.map((s) => ({
      slotId: s.slotId,
      slotName: s.slotName,
      description: s.description,
      slotTypeId: s.slotTypeId,
      lastUpdatedDateTime: s.lastUpdatedDateTime,
    })),
  };
};

const UpdateSlot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  const slotId = requireString(request, "slotId");
  const slot = requireSlot(ctx, botId, botVersion, localeId, intentId, slotId);
  const now = nowSeconds();
  const updated: StoredSlot = {
    ...slot,
    slotName: stringOrUndefined(request.slotName) ?? slot.slotName,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : slot.description,
    slotTypeId:
      "slotTypeId" in request
        ? stringOrUndefined(request.slotTypeId)
        : slot.slotTypeId,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(
    slotKey(botId, botVersion, localeId, intentId, slotId),
    updated,
  );
  return {
    slotId: updated.slotId,
    slotName: updated.slotName,
    botId: updated.botId,
    botVersion: updated.botVersion,
    localeId: updated.localeId,
    intentId: updated.intentId,
    description: updated.description,
    slotTypeId: updated.slotTypeId,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const DeleteSlot: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const intentId = requireString(request, "intentId");
  const slotId = requireString(request, "slotId");
  requireSlot(ctx, botId, botVersion, localeId, intentId, slotId);
  ctx.store.delete(slotKey(botId, botVersion, localeId, intentId, slotId));
  return {};
};

const CreateSlotType: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const slotTypeName = requireString(request, "slotTypeName");
  const now = nowSeconds();
  const st: StoredSlotType = {
    slotTypeId: generateId(),
    slotTypeName,
    botId,
    botVersion,
    localeId,
    description: stringOrUndefined(request.description),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(slotTypeKey(botId, botVersion, localeId, st.slotTypeId), st);
  return {
    slotTypeId: st.slotTypeId,
    slotTypeName: st.slotTypeName,
    botId: st.botId,
    botVersion: st.botVersion,
    localeId: st.localeId,
    description: st.description,
    creationDateTime: st.creationDateTime,
  };
};

const DescribeSlotType: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const slotTypeId = requireString(request, "slotTypeId");
  const st = requireSlotType(ctx, botId, botVersion, localeId, slotTypeId);
  return {
    slotTypeId: st.slotTypeId,
    slotTypeName: st.slotTypeName,
    botId: st.botId,
    botVersion: st.botVersion,
    localeId: st.localeId,
    description: st.description,
    creationDateTime: st.creationDateTime,
    lastUpdatedDateTime: st.lastUpdatedDateTime,
  };
};

const ListSlotTypes: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const prefix = `slottype:${botId}:${botVersion}:${localeId}:`;
  const types = ctx.store
    .list<StoredSlotType>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersion,
    localeId,
    slotTypeSummaries: types.map((t) => ({
      slotTypeId: t.slotTypeId,
      slotTypeName: t.slotTypeName,
      description: t.description,
      lastUpdatedDateTime: t.lastUpdatedDateTime,
    })),
  };
};

const UpdateSlotType: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const slotTypeId = requireString(request, "slotTypeId");
  const st = requireSlotType(ctx, botId, botVersion, localeId, slotTypeId);
  const now = nowSeconds();
  const updated: StoredSlotType = {
    ...st,
    slotTypeName: stringOrUndefined(request.slotTypeName) ?? st.slotTypeName,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : st.description,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(slotTypeKey(botId, botVersion, localeId, slotTypeId), updated);
  return {
    slotTypeId: updated.slotTypeId,
    slotTypeName: updated.slotTypeName,
    botId: updated.botId,
    botVersion: updated.botVersion,
    localeId: updated.localeId,
    description: updated.description,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const DeleteSlotType: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const slotTypeId = requireString(request, "slotTypeId");
  requireSlotType(ctx, botId, botVersion, localeId, slotTypeId);
  ctx.store.delete(slotTypeKey(botId, botVersion, localeId, slotTypeId));
  return {};
};

const BatchCreateCustomVocabularyItem: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const customVocabularyItemList = Array.isArray(
    request.customVocabularyItemList,
  )
    ? (request.customVocabularyItemList as Record<string, unknown>[])
    : [];
  const key = vocabKey(botId, botVersion, localeId);
  const existing = ctx.store.get<StoredCustomVocabItem[]>(key) ?? [];
  const added: StoredCustomVocabItem[] = [];
  const errors: unknown[] = [];
  for (const item of customVocabularyItemList) {
    const phrase = stringOrUndefined(item.phrase);
    if (phrase === undefined) {
      errors.push({ itemId: "", errorMessage: "phrase is required" });
      continue;
    }
    const vocabItem: StoredCustomVocabItem = {
      itemId: generateId(),
      phrase,
      weight: typeof item.weight === "number" ? item.weight : undefined,
      displayAs: stringOrUndefined(item.displayAs),
    };
    existing.push(vocabItem);
    added.push(vocabItem);
  }
  ctx.store.set(key, existing);
  return {
    botId,
    botVersion,
    localeId,
    resources: added,
    errors,
  };
};

const BatchDeleteCustomVocabularyItem: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const customVocabularyItemList = Array.isArray(
    request.customVocabularyItemList,
  )
    ? (request.customVocabularyItemList as Record<string, unknown>[])
    : [];
  const key = vocabKey(botId, botVersion, localeId);
  const existing = ctx.store.get<StoredCustomVocabItem[]>(key) ?? [];
  const toDelete = new Set(
    customVocabularyItemList
      .map((i) => stringOrUndefined(i.itemId))
      .filter((id): id is string => id !== undefined),
  );
  const remaining = existing.filter((i) => !toDelete.has(i.itemId));
  ctx.store.set(key, remaining);
  return {
    botId,
    botVersion,
    localeId,
    resources: Array.from(toDelete).map((itemId) => ({ itemId })),
    errors: [],
  };
};

const BatchUpdateCustomVocabularyItem: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const customVocabularyItemList = Array.isArray(
    request.customVocabularyItemList,
  )
    ? (request.customVocabularyItemList as Record<string, unknown>[])
    : [];
  const key = vocabKey(botId, botVersion, localeId);
  const existing = ctx.store.get<StoredCustomVocabItem[]>(key) ?? [];
  const updated: StoredCustomVocabItem[] = [];
  for (const item of customVocabularyItemList) {
    const itemId = stringOrUndefined(item.itemId);
    if (itemId === undefined) continue;
    const idx = existing.findIndex((e) => e.itemId === itemId);
    if (idx >= 0) {
      const phrase = stringOrUndefined(item.phrase) ?? existing[idx].phrase;
      existing[idx] = { ...existing[idx], phrase };
      updated.push(existing[idx]);
    }
  }
  ctx.store.set(key, existing);
  return {
    botId,
    botVersion,
    localeId,
    resources: updated,
    errors: [],
  };
};

const ListCustomVocabularyItems: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const key = vocabKey(botId, botVersion, localeId);
  const items = ctx.store.get<StoredCustomVocabItem[]>(key) ?? [];
  return {
    botId,
    botVersion,
    localeId,
    customVocabularyItems: items,
  };
};

const DescribeCustomVocabularyMetadata: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const key = vocabKey(botId, botVersion, localeId);
  const items = ctx.store.get<StoredCustomVocabItem[]>(key) ?? [];
  return {
    botId,
    botVersion,
    localeId,
    customVocabularyStatus: items.length > 0 ? "Ready" : "NotFound",
    creationDateTime: nowSeconds(),
    lastUpdatedDateTime: nowSeconds(),
  };
};

const DeleteCustomVocabulary: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const key = vocabKey(botId, botVersion, localeId);
  ctx.store.delete(key);
  return {
    botId,
    botVersion,
    localeId,
    customVocabularyStatus: "Deleting",
  };
};

const CreateExport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceSpecification = requireRecord(request, "resourceSpecification");
  const fileFormat = requireString(request, "fileFormat");
  const now = nowSeconds();
  const exp: StoredExport = {
    exportId: generateId(),
    resourceSpecification,
    fileFormat,
    exportStatus: "Completed",
    downloadUrl: `https://s3.amazonaws.com/exports/${generateId()}.zip`,
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(exportKey(exp.exportId), exp);
  return {
    exportId: exp.exportId,
    resourceSpecification: exp.resourceSpecification,
    fileFormat: exp.fileFormat,
    exportStatus: exp.exportStatus,
    creationDateTime: exp.creationDateTime,
  };
};

const DescribeExport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const exportId = requireString(request, "exportId");
  const exp = requireExport(ctx, exportId);
  return {
    exportId: exp.exportId,
    resourceSpecification: exp.resourceSpecification,
    fileFormat: exp.fileFormat,
    exportStatus: exp.exportStatus,
    downloadUrl: exp.downloadUrl,
    creationDateTime: exp.creationDateTime,
    lastUpdatedDateTime: exp.lastUpdatedDateTime,
  };
};

const ListExports: OperationHandler = (_input, ctx) => {
  const exports = ctx.store
    .list<StoredExport>()
    .filter((e) => e.key.startsWith("export:"))
    .map((e) => e.value);
  return {
    exportSummaries: exports.map((exp) => ({
      exportId: exp.exportId,
      resourceSpecification: exp.resourceSpecification,
      fileFormat: exp.fileFormat,
      exportStatus: exp.exportStatus,
      creationDateTime: exp.creationDateTime,
      lastUpdatedDateTime: exp.lastUpdatedDateTime,
    })),
  };
};

const UpdateExport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const exportId = requireString(request, "exportId");
  const exp = requireExport(ctx, exportId);
  const now = nowSeconds();
  const updated: StoredExport = { ...exp, lastUpdatedDateTime: now };
  ctx.store.set(exportKey(exportId), updated);
  return {
    exportId: updated.exportId,
    resourceSpecification: updated.resourceSpecification,
    fileFormat: updated.fileFormat,
    exportStatus: updated.exportStatus,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const DeleteExport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const exportId = requireString(request, "exportId");
  const exp = requireExport(ctx, exportId);
  ctx.store.delete(exportKey(exportId));
  return {
    exportId: exp.exportId,
    exportStatus: "Deleting",
  };
};

const StartImport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const importId = generateId();
  const now = nowSeconds();
  const imp: StoredImport = {
    importId,
    resourceSpecification: recordOrUndefined(request.resourceSpecification),
    importedResourceId: undefined,
    importedResourceName: undefined,
    importStatus: "Completed",
    mergeStrategy: stringOrUndefined(request.mergeStrategy),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(importKey(importId), imp);
  return {
    importId: imp.importId,
    resourceSpecification: imp.resourceSpecification,
    importStatus: imp.importStatus,
    mergeStrategy: imp.mergeStrategy,
    creationDateTime: imp.creationDateTime,
  };
};

const DescribeImport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const importId = requireString(request, "importId");
  const imp = requireImport(ctx, importId);
  return {
    importId: imp.importId,
    resourceSpecification: imp.resourceSpecification,
    importedResourceId: imp.importedResourceId,
    importedResourceName: imp.importedResourceName,
    importStatus: imp.importStatus,
    mergeStrategy: imp.mergeStrategy,
    creationDateTime: imp.creationDateTime,
    lastUpdatedDateTime: imp.lastUpdatedDateTime,
  };
};

const ListImports: OperationHandler = (_input, ctx) => {
  const imports = ctx.store
    .list<StoredImport>()
    .filter((e) => e.key.startsWith("import:"))
    .map((e) => e.value);
  return {
    importSummaries: imports.map((imp) => ({
      importId: imp.importId,
      importedResourceId: imp.importedResourceId,
      importedResourceName: imp.importedResourceName,
      importStatus: imp.importStatus,
      mergeStrategy: imp.mergeStrategy,
      creationDateTime: imp.creationDateTime,
      lastUpdatedDateTime: imp.lastUpdatedDateTime,
    })),
  };
};

const DeleteImport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const importId = requireString(request, "importId");
  const imp = requireImport(ctx, importId);
  ctx.store.delete(importKey(importId));
  return {
    importId: imp.importId,
    importStatus: "Deleting",
  };
};

const CreateResourcePolicy: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceArn = requireString(request, "resourceArn");
  const policy = requireString(request, "policy");
  const now = nowSeconds();
  const rp: StoredResourcePolicy = {
    resourceArn,
    policy,
    revisionId: generateId(),
    lastUpdatedDateTime: now,
  };
  ctx.store.set(policyKey(resourceArn), rp);
  return {
    resourceArn: rp.resourceArn,
    revisionId: rp.revisionId,
  };
};

const DescribeResourcePolicy: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceArn = requireString(request, "resourceArn");
  const rp = ctx.store.get<StoredResourcePolicy>(policyKey(resourceArn));
  if (rp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ResourcePolicy for ${resourceArn} does not exist.`,
      404,
    );
  }
  return {
    resourceArn: rp.resourceArn,
    policy: rp.policy,
    revisionId: rp.revisionId,
  };
};

const UpdateResourcePolicy: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceArn = requireString(request, "resourceArn");
  const policy = requireString(request, "policy");
  const existing = ctx.store.get<StoredResourcePolicy>(policyKey(resourceArn));
  const now = nowSeconds();
  const rp: StoredResourcePolicy = {
    resourceArn,
    policy,
    revisionId: generateId(),
    lastUpdatedDateTime: now,
  };
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ResourcePolicy for ${resourceArn} does not exist.`,
      404,
    );
  }
  ctx.store.set(policyKey(resourceArn), rp);
  return {
    resourceArn: rp.resourceArn,
    revisionId: rp.revisionId,
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceArn = requireString(request, "resourceArn");
  const rp = ctx.store.get<StoredResourcePolicy>(policyKey(resourceArn));
  if (rp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `ResourcePolicy for ${resourceArn} does not exist.`,
      404,
    );
  }
  ctx.store.delete(policyKey(resourceArn));
  return {
    resourceArn: rp.resourceArn,
    revisionId: rp.revisionId,
  };
};

const policyStatementsKey = (resourceArn: string): string =>
  `policystatements:${resourceArn}`;

const CreateResourcePolicyStatement: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceArn = requireString(request, "resourceArn");
  const statementId = requireString(request, "statementId");
  const statements =
    ctx.store.get<Record<string, unknown>[]>(
      policyStatementsKey(resourceArn),
    ) ?? [];
  statements.push({ statementId, ...request });
  ctx.store.set(policyStatementsKey(resourceArn), statements);
  return {
    resourceArn,
    revisionId: generateId(),
  };
};

const DeleteResourcePolicyStatement: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceArn = requireString(request, "resourceArn");
  const statementId = requireString(request, "statementId");
  const statements =
    ctx.store.get<Record<string, unknown>[]>(
      policyStatementsKey(resourceArn),
    ) ?? [];
  const filtered = statements.filter((s) => s["statementId"] !== statementId);
  ctx.store.set(policyStatementsKey(resourceArn), filtered);
  return {
    resourceArn,
    revisionId: generateId(),
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceARN = requireString(request, "resourceARN");
  const tags = recordOrUndefined(request.tags) ?? {};
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceARN)) ?? {};
  ctx.store.set(tagKey(resourceARN), { ...existing, ...tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceARN = requireString(request, "resourceARN");
  const tagKeys = Array.isArray(request.tagKeys)
    ? (request.tagKeys as string[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>>(tagKey(resourceARN)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagKey(resourceARN), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const resourceARN = requireString(request, "resourceARN");
  const tags = ctx.store.get<Record<string, string>>(tagKey(resourceARN)) ?? {};
  return { tags };
};

const CreateTestSetDiscrepancyReport: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetId = requireString(request, "testSetId");
  requireTestSet(ctx, testSetId);
  const testSetDiscrepancyReportId = generateId();
  return {
    testSetId,
    testSetDiscrepancyReportId,
    creationDateTime: nowSeconds(),
    testSetDiscrepancyReportStatus: "InProgress",
  };
};

const DescribeTestSetDiscrepancyReport: OperationHandler = (input, _ctx) => {
  const request = input as Record<string, unknown>;
  const testSetDiscrepancyReportId = requireString(
    request,
    "testSetDiscrepancyReportId",
  );
  return {
    testSetDiscrepancyReportId,
    testSetId: "synthetic",
    creationDateTime: nowSeconds(),
    lastUpdatedDateTime: nowSeconds(),
    testSetDiscrepancyReportStatus: "Completed",
    testSetDiscrepancyTopErrors: { totalErrorCount: 0, errorCounts: [] },
    testSetDiscrepancyRawOutputUrl: "",
  };
};

const CreateUploadUrl: OperationHandler = (_input, _ctx) => ({
  importId: generateId(),
  uploadUrl: `https://s3.amazonaws.com/uploads/${generateId()}`,
});

const DeleteUtterances: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return {};
};

const ListAggregatedUtterances: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, aggregatedUtterancesSummaries: [] };
};

const ListBuiltInIntents: OperationHandler = (input, _ctx) => {
  const request = input as Record<string, unknown>;
  const localeId = requireString(request, "localeId");
  return {
    localeId,
    builtInIntentSummaries: [
      {
        intentSignature: "AMAZON.FallbackIntent",
        description: "When no other intent matches",
      },
      {
        intentSignature: "AMAZON.HelpIntent",
        description: "Provides help information",
      },
      {
        intentSignature: "AMAZON.CancelIntent",
        description: "Cancels current interaction",
      },
      {
        intentSignature: "AMAZON.StopIntent",
        description: "Stops the current interaction",
      },
    ],
  };
};

const ListBuiltInSlotTypes: OperationHandler = (input, _ctx) => {
  const request = input as Record<string, unknown>;
  const localeId = requireString(request, "localeId");
  return {
    localeId,
    builtInSlotTypeSummaries: [
      {
        slotTypeSignature: "AMAZON.AlphaNumeric",
        description: "Alphanumeric values",
      },
      {
        slotTypeSignature: "AMAZON.Date",
        description: "Date values",
      },
      {
        slotTypeSignature: "AMAZON.Number",
        description: "Number values",
      },
    ],
  };
};

const StartBotRecommendation: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const now = nowSeconds();
  const rec: StoredBotRecommendation = {
    botId,
    botVersion,
    localeId,
    botRecommendationId: generateId(),
    botRecommendationStatus: "Processing",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(
    botRecKey(botId, botVersion, localeId, rec.botRecommendationId),
    rec,
  );
  return {
    botId: rec.botId,
    botVersion: rec.botVersion,
    localeId: rec.localeId,
    botRecommendationId: rec.botRecommendationId,
    botRecommendationStatus: rec.botRecommendationStatus,
    creationDateTime: rec.creationDateTime,
  };
};

const DescribeBotRecommendation: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const botRecommendationId = requireString(request, "botRecommendationId");
  const rec = ctx.store.get<StoredBotRecommendation>(
    botRecKey(botId, botVersion, localeId, botRecommendationId),
  );
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotRecommendation ${botRecommendationId} does not exist.`,
      404,
    );
  }
  return {
    botId: rec.botId,
    botVersion: rec.botVersion,
    localeId: rec.localeId,
    botRecommendationId: rec.botRecommendationId,
    botRecommendationStatus: rec.botRecommendationStatus,
    creationDateTime: rec.creationDateTime,
    lastUpdatedDateTime: rec.lastUpdatedDateTime,
  };
};

const UpdateBotRecommendation: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const botRecommendationId = requireString(request, "botRecommendationId");
  const rec = ctx.store.get<StoredBotRecommendation>(
    botRecKey(botId, botVersion, localeId, botRecommendationId),
  );
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotRecommendation ${botRecommendationId} does not exist.`,
      404,
    );
  }
  const now = nowSeconds();
  const updated = { ...rec, lastUpdatedDateTime: now };
  ctx.store.set(
    botRecKey(botId, botVersion, localeId, botRecommendationId),
    updated,
  );
  return {
    botId: updated.botId,
    botVersion: updated.botVersion,
    localeId: updated.localeId,
    botRecommendationId: updated.botRecommendationId,
    botRecommendationStatus: updated.botRecommendationStatus,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const ListBotRecommendations: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const prefix = `botrec:${botId}:${botVersion}:${localeId}:`;
  const recs = ctx.store
    .list<StoredBotRecommendation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersion,
    localeId,
    botRecommendationSummaries: recs.map((r) => ({
      botRecommendationId: r.botRecommendationId,
      botRecommendationStatus: r.botRecommendationStatus,
      creationDateTime: r.creationDateTime,
      lastUpdatedDateTime: r.lastUpdatedDateTime,
    })),
  };
};

const StopBotRecommendation: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const botRecommendationId = requireString(request, "botRecommendationId");
  const rec = ctx.store.get<StoredBotRecommendation>(
    botRecKey(botId, botVersion, localeId, botRecommendationId),
  );
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotRecommendation ${botRecommendationId} does not exist.`,
      404,
    );
  }
  const updated = { ...rec, botRecommendationStatus: "Stopped" };
  ctx.store.set(
    botRecKey(botId, botVersion, localeId, botRecommendationId),
    updated,
  );
  return {
    botId,
    botVersion,
    localeId,
    botRecommendationId,
    botRecommendationStatus: "Stopped",
  };
};

const ListRecommendedIntents: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const botRecommendationId = requireString(request, "botRecommendationId");
  requireBot(ctx, botId);
  return {
    botId,
    botVersion,
    localeId,
    botRecommendationId,
    summaryList: [],
  };
};

const SearchAssociatedTranscripts: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return {
    botId,
    botVersion: request.botVersion,
    localeId: request.localeId,
    botRecommendationId: request.botRecommendationId,
    associatedTranscripts: [],
    totalResults: 0,
  };
};

const GenerateBotElement: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return {
    botId,
    botVersion: request.botVersion,
    localeId: request.localeId,
    sampleUtterances: [],
  };
};

const StartBotResourceGeneration: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const now = nowSeconds();
  const gen: StoredBotResourceGeneration = {
    botId,
    botVersion,
    localeId,
    generationId: generateId(),
    generationStatus: "InProgress",
    generationInputPrompt: stringOrUndefined(request.generationInputPrompt),
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(
    botResGenKey(botId, botVersion, localeId, gen.generationId),
    gen,
  );
  return {
    botId: gen.botId,
    botVersion: gen.botVersion,
    localeId: gen.localeId,
    generationId: gen.generationId,
    generationStatus: gen.generationStatus,
    generationInputPrompt: gen.generationInputPrompt,
    creationDateTime: gen.creationDateTime,
  };
};

const DescribeBotResourceGeneration: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  const generationId = requireString(request, "generationId");
  const gen = ctx.store.get<StoredBotResourceGeneration>(
    botResGenKey(botId, botVersion, localeId, generationId),
  );
  if (gen === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Generation ${generationId} does not exist.`,
      404,
    );
  }
  return {
    botId: gen.botId,
    botVersion: gen.botVersion,
    localeId: gen.localeId,
    generationId: gen.generationId,
    generationStatus: gen.generationStatus,
    generationInputPrompt: gen.generationInputPrompt,
    creationDateTime: gen.creationDateTime,
    lastUpdatedDateTime: gen.lastUpdatedDateTime,
  };
};

const ListBotResourceGenerations: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botVersion = requireString(request, "botVersion");
  const localeId = requireString(request, "localeId");
  requireBot(ctx, botId);
  const prefix = `botresourcegen:${botId}:${botVersion}:${localeId}:`;
  const gens = ctx.store
    .list<StoredBotResourceGeneration>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botVersion,
    localeId,
    generationSummaries: gens.map((g) => ({
      generationId: g.generationId,
      generationStatus: g.generationStatus,
      creationDateTime: g.creationDateTime,
      lastUpdatedDateTime: g.lastUpdatedDateTime,
    })),
  };
};

const StartBotAnalyzer: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const now = nowSeconds();
  const analyzer: StoredBotAnalyzer = {
    botId,
    botAnalyzerRequestId: generateId(),
    botAnalyzerStatus: "Running",
    creationDateTime: now,
  };
  ctx.store.set(botAnalyzerKey(botId, analyzer.botAnalyzerRequestId), analyzer);
  return {
    botId: analyzer.botId,
    botAnalyzerRequestId: analyzer.botAnalyzerRequestId,
    botAnalyzerStatus: analyzer.botAnalyzerStatus,
    creationDateTime: analyzer.creationDateTime,
  };
};

const StopBotAnalyzer: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botAnalyzerRequestId = requireString(request, "botAnalyzerRequestId");
  const key = botAnalyzerKey(botId, botAnalyzerRequestId);
  const analyzer = ctx.store.get<StoredBotAnalyzer>(key);
  if (analyzer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotAnalyzer ${botAnalyzerRequestId} does not exist.`,
      404,
    );
  }
  const updated = { ...analyzer, botAnalyzerStatus: "Stopped" };
  ctx.store.set(key, updated);
  return {
    botId: updated.botId,
    botAnalyzerRequestId: updated.botAnalyzerRequestId,
    botAnalyzerStatus: updated.botAnalyzerStatus,
  };
};

const DeleteBotAnalyzerRecommendation: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botAnalyzerRequestId = requireString(request, "botAnalyzerRequestId");
  ctx.store.delete(botAnalyzerKey(botId, botAnalyzerRequestId));
  return {};
};

const DescribeBotAnalyzerRecommendation: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  const botAnalyzerRequestId = requireString(request, "botAnalyzerRequestId");
  const analyzer = ctx.store.get<StoredBotAnalyzer>(
    botAnalyzerKey(botId, botAnalyzerRequestId),
  );
  if (analyzer === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `BotAnalyzer ${botAnalyzerRequestId} does not exist.`,
      404,
    );
  }
  return {
    botId: analyzer.botId,
    botAnalyzerRequestId: analyzer.botAnalyzerRequestId,
    botAnalyzerStatus: analyzer.botAnalyzerStatus,
    creationDateTime: analyzer.creationDateTime,
    recommendations: [],
  };
};

const ListBotAnalyzerHistory: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  const prefix = `botanalyzer:${botId}:`;
  const analyzers = ctx.store
    .list<StoredBotAnalyzer>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    botId,
    botAnalyzerHistorySummaries: analyzers.map((a) => ({
      botAnalyzerRequestId: a.botAnalyzerRequestId,
      botAnalyzerStatus: a.botAnalyzerStatus,
      creationDateTime: a.creationDateTime,
    })),
  };
};

const DescribeTestSet: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetId = requireString(request, "testSetId");
  const ts = requireTestSet(ctx, testSetId);
  return {
    testSetId: ts.testSetId,
    testSetName: ts.testSetName,
    description: ts.description,
    modality: ts.modality,
    status: ts.status,
    numTurns: ts.numTurns,
    storageLocation: ts.storageLocation,
    creationDateTime: ts.creationDateTime,
    lastUpdatedDateTime: ts.lastUpdatedDateTime,
  };
};

const ListTestSets: OperationHandler = (_input, ctx) => {
  const sets = ctx.store
    .list<StoredTestSet>()
    .filter((e) => e.key.startsWith("testset:"))
    .map((e) => e.value);
  return {
    testSetSummaries: sets.map((ts) => ({
      testSetId: ts.testSetId,
      testSetName: ts.testSetName,
      description: ts.description,
      modality: ts.modality,
      status: ts.status,
      numTurns: ts.numTurns,
      creationDateTime: ts.creationDateTime,
      lastUpdatedDateTime: ts.lastUpdatedDateTime,
    })),
  };
};

const DeleteTestSet: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetId = requireString(request, "testSetId");
  requireTestSet(ctx, testSetId);
  ctx.store.delete(testSetKey(testSetId));
  return {};
};

const UpdateTestSet: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetId = requireString(request, "testSetId");
  const ts = requireTestSet(ctx, testSetId);
  const now = nowSeconds();
  const updated: StoredTestSet = {
    ...ts,
    testSetName: stringOrUndefined(request.testSetName) ?? ts.testSetName,
    description:
      "description" in request
        ? stringOrUndefined(request.description)
        : ts.description,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(testSetKey(testSetId), updated);
  return {
    testSetId: updated.testSetId,
    testSetName: updated.testSetName,
    description: updated.description,
    modality: updated.modality,
    status: updated.status,
    numTurns: updated.numTurns,
    storageLocation: updated.storageLocation,
    creationDateTime: updated.creationDateTime,
    lastUpdatedDateTime: updated.lastUpdatedDateTime,
  };
};

const ListTestSetRecords: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetId = requireString(request, "testSetId");
  requireTestSet(ctx, testSetId);
  return { testSetRecords: [] };
};

const StartTestExecution: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetId = requireString(request, "testSetId");
  requireTestSet(ctx, testSetId);
  const target = requireRecord(request, "target");
  const now = nowSeconds();
  const exec: StoredTestExecution = {
    testExecutionId: generateId(),
    testSetId,
    target,
    apiMode: stringOrUndefined(request.apiMode) ?? "NonStreaming",
    testExecutionModality:
      stringOrUndefined(request.testExecutionModality) ?? "Text",
    testExecutionStatus: "InProgress",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(testExecKey(exec.testExecutionId), exec);
  return {
    testExecutionId: exec.testExecutionId,
    creationDateTime: exec.creationDateTime,
    testSetId: exec.testSetId,
    target: exec.target,
    apiMode: exec.apiMode,
    testExecutionModality: exec.testExecutionModality,
    testExecutionStatus: exec.testExecutionStatus,
  };
};

const DescribeTestExecution: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testExecutionId = requireString(request, "testExecutionId");
  const exec = ctx.store.get<StoredTestExecution>(testExecKey(testExecutionId));
  if (exec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TestExecution ${testExecutionId} does not exist.`,
      404,
    );
  }
  return {
    testExecutionId: exec.testExecutionId,
    creationDateTime: exec.creationDateTime,
    lastUpdatedDateTime: exec.lastUpdatedDateTime,
    testSetId: exec.testSetId,
    target: exec.target,
    apiMode: exec.apiMode,
    testExecutionModality: exec.testExecutionModality,
    testExecutionStatus: exec.testExecutionStatus,
  };
};

const ListTestExecutions: OperationHandler = (_input, ctx) => {
  const execs = ctx.store
    .list<StoredTestExecution>()
    .filter((e) => e.key.startsWith("testexec:"))
    .map((e) => e.value);
  return {
    testExecutions: execs.map((e) => ({
      testExecutionId: e.testExecutionId,
      creationDateTime: e.creationDateTime,
      lastUpdatedDateTime: e.lastUpdatedDateTime,
      testSetId: e.testSetId,
      target: e.target,
      apiMode: e.apiMode,
      testExecutionModality: e.testExecutionModality,
      testExecutionStatus: e.testExecutionStatus,
    })),
  };
};

const GetTestExecutionArtifactsUrl: OperationHandler = (input, _ctx) => {
  const request = input as Record<string, unknown>;
  const testExecutionId = requireString(request, "testExecutionId");
  return {
    testExecutionId,
    downloadArtifactsUrl: `https://s3.amazonaws.com/testexec/${testExecutionId}/artifacts.zip`,
  };
};

const ListTestExecutionResultItems: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testExecutionId = requireString(request, "testExecutionId");
  const exec = ctx.store.get<StoredTestExecution>(testExecKey(testExecutionId));
  if (exec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TestExecution ${testExecutionId} does not exist.`,
      404,
    );
  }
  return { testExecutionResults: { resultItems: [] } };
};

const StartTestSetGeneration: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetName = requireString(request, "testSetName");
  const generationDataSource = requireRecord(request, "generationDataSource");
  const roleArn = requireString(request, "roleArn");
  const now = nowSeconds();
  const gen: StoredTestSetGeneration = {
    testSetGenerationId: generateId(),
    testSetName,
    description: stringOrUndefined(request.description),
    storageLocation: recordOrUndefined(request.storageLocation),
    generationDataSource,
    roleArn,
    testSetGenerationStatus: "Generating",
    creationDateTime: now,
    lastUpdatedDateTime: now,
  };
  ctx.store.set(testGenKey(gen.testSetGenerationId), gen);
  return {
    testSetGenerationId: gen.testSetGenerationId,
    creationDateTime: gen.creationDateTime,
    testSetGenerationStatus: gen.testSetGenerationStatus,
    testSetName: gen.testSetName,
    description: gen.description,
    storageLocation: gen.storageLocation,
    generationDataSource: gen.generationDataSource,
    roleArn: gen.roleArn,
  };
};

const DescribeTestSetGeneration: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const testSetGenerationId = requireString(request, "testSetGenerationId");
  const gen = ctx.store.get<StoredTestSetGeneration>(
    testGenKey(testSetGenerationId),
  );
  if (gen === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `TestSetGeneration ${testSetGenerationId} does not exist.`,
      404,
    );
  }
  return {
    testSetGenerationId: gen.testSetGenerationId,
    creationDateTime: gen.creationDateTime,
    lastUpdatedDateTime: gen.lastUpdatedDateTime,
    testSetGenerationStatus: gen.testSetGenerationStatus,
    testSetName: gen.testSetName,
    description: gen.description,
    storageLocation: gen.storageLocation,
    generationDataSource: gen.generationDataSource,
    roleArn: gen.roleArn,
  };
};

const ListIntentMetrics: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, results: [], nextToken: undefined };
};

const ListIntentPaths: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { nodeSummaries: [] };
};

const ListIntentStageMetrics: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, results: [], nextToken: undefined };
};

const ListSessionAnalyticsData: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, sessions: [] };
};

const ListSessionMetrics: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, results: [], nextToken: undefined };
};

const ListUtteranceAnalyticsData: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, utterances: [] };
};

const ListUtteranceMetrics: OperationHandler = (input, ctx) => {
  const request = input as Record<string, unknown>;
  const botId = requireString(request, "botId");
  requireBot(ctx, botId);
  return { botId, results: [], nextToken: undefined };
};

const resolveBot = (parts: string[], method: string): string | undefined => {
  const botId = parts[1];
  if (botId === undefined) {
    if (method === "PUT") return "CreateBot";
    if (method === "POST") return "ListBots";
    return undefined;
  }
  const sub = parts[2];
  if (sub === undefined) {
    if (method === "GET") return "DescribeBot";
    if (method === "DELETE") return "DeleteBot";
    if (method === "PUT") return "UpdateBot";
    return undefined;
  }
  if (sub === "botaliases") return resolveBotAliases(parts, method);
  if (sub === "botversions") return resolveBotVersions(parts, method);
  if (sub === "replicas") return resolveBotReplicas(parts, method);
  if (sub === "utterances") {
    if (method === "DELETE") return "DeleteUtterances";
    return undefined;
  }
  if (sub === "aggregatedutterances") {
    if (method === "POST") return "ListAggregatedUtterances";
    return undefined;
  }
  if (sub === "analytics") return resolveBotAnalytics(parts, method);
  if (sub === "botanalyzer") return resolveBotAnalyzer(parts, method);
  return undefined;
};

const resolveBotAliases = (
  parts: string[],
  method: string,
): string | undefined => {
  const aliasId = parts[3];
  if (aliasId === undefined) {
    if (method === "PUT") return "CreateBotAlias";
    if (method === "POST") return "ListBotAliases";
    return undefined;
  }
  if (method === "GET") return "DescribeBotAlias";
  if (method === "DELETE") return "DeleteBotAlias";
  if (method === "PUT") return "UpdateBotAlias";
  return undefined;
};

const resolveBotVersions = (
  parts: string[],
  method: string,
): string | undefined => {
  const botVersion = parts[3];
  if (botVersion === undefined) {
    if (method === "PUT") return "CreateBotVersion";
    if (method === "POST") return "ListBotVersions";
    return undefined;
  }
  const sub = parts[4];
  if (sub === undefined) {
    if (method === "GET") return "DescribeBotVersion";
    if (method === "DELETE") return "DeleteBotVersion";
    return undefined;
  }
  if (sub === "botlocales") return resolveBotLocales(parts, method);
  return undefined;
};

const resolveBotLocales = (
  parts: string[],
  method: string,
): string | undefined => {
  const localeId = parts[5];
  if (localeId === undefined) {
    if (method === "PUT") return "CreateBotLocale";
    if (method === "POST") return "ListBotLocales";
    return undefined;
  }
  const sub = parts[6];
  if (sub === undefined) {
    if (method === "GET") return "DescribeBotLocale";
    if (method === "DELETE") return "DeleteBotLocale";
    if (method === "PUT") return "UpdateBotLocale";
    if (method === "POST") return "BuildBotLocale";
    return undefined;
  }
  if (sub === "intents") return resolveIntents(parts, method);
  if (sub === "slottypes") return resolveSlotTypes(parts, method);
  if (sub === "customvocabulary") return resolveCustomVocab(parts, method);
  if (sub === "botrecommendations")
    return resolveBotRecommendations(parts, method);
  if (sub === "generate") {
    if (method === "POST") return "GenerateBotElement";
    return undefined;
  }
  if (sub === "generations")
    return resolveBotResourceGenerations(parts, method);
  if (sub === "startgeneration") {
    if (method === "PUT") return "StartBotResourceGeneration";
    return undefined;
  }
  return undefined;
};

const resolveIntents = (
  parts: string[],
  method: string,
): string | undefined => {
  const intentId = parts[7];
  if (intentId === undefined) {
    if (method === "PUT") return "CreateIntent";
    if (method === "POST") return "ListIntents";
    return undefined;
  }
  const sub = parts[8];
  if (sub === undefined) {
    if (method === "GET") return "DescribeIntent";
    if (method === "DELETE") return "DeleteIntent";
    if (method === "PUT") return "UpdateIntent";
    return undefined;
  }
  if (sub === "slots") return resolveSlots(parts, method);
  return undefined;
};

const resolveSlots = (parts: string[], method: string): string | undefined => {
  const slotId = parts[9];
  if (slotId === undefined) {
    if (method === "PUT") return "CreateSlot";
    if (method === "POST") return "ListSlots";
    return undefined;
  }
  if (method === "GET") return "DescribeSlot";
  if (method === "DELETE") return "DeleteSlot";
  if (method === "PUT") return "UpdateSlot";
  return undefined;
};

const resolveSlotTypes = (
  parts: string[],
  method: string,
): string | undefined => {
  const slotTypeId = parts[7];
  if (slotTypeId === undefined) {
    if (method === "PUT") return "CreateSlotType";
    if (method === "POST") return "ListSlotTypes";
    return undefined;
  }
  if (method === "GET") return "DescribeSlotType";
  if (method === "DELETE") return "DeleteSlotType";
  if (method === "PUT") return "UpdateSlotType";
  return undefined;
};

const resolveCustomVocab = (
  parts: string[],
  method: string,
): string | undefined => {
  const p7 = parts[7];
  if (p7 === undefined) {
    if (method === "DELETE") return "DeleteCustomVocabulary";
    return undefined;
  }
  if (p7 === "DEFAULT") {
    const action = parts[8];
    if (action === "batchcreate" && method === "PUT")
      return "BatchCreateCustomVocabularyItem";
    if (action === "batchdelete" && method === "POST")
      return "BatchDeleteCustomVocabularyItem";
    if (action === "batchupdate" && method === "PUT")
      return "BatchUpdateCustomVocabularyItem";
    if (action === "list" && method === "POST")
      return "ListCustomVocabularyItems";
    if (action === "metadata" && method === "GET")
      return "DescribeCustomVocabularyMetadata";
  }
  return undefined;
};

const resolveBotRecommendations = (
  parts: string[],
  method: string,
): string | undefined => {
  const recId = parts[7];
  if (recId === undefined) {
    if (method === "PUT") return "StartBotRecommendation";
    if (method === "POST") return "ListBotRecommendations";
    return undefined;
  }
  const action = parts[8];
  if (action === undefined) {
    if (method === "GET") return "DescribeBotRecommendation";
    if (method === "PUT") return "UpdateBotRecommendation";
    return undefined;
  }
  if (action === "intents" && method === "POST")
    return "ListRecommendedIntents";
  if (action === "stopbotrecommendation" && method === "PUT")
    return "StopBotRecommendation";
  if (action === "associatedtranscripts" && method === "POST")
    return "SearchAssociatedTranscripts";
  return undefined;
};

const resolveBotResourceGenerations = (
  parts: string[],
  method: string,
): string | undefined => {
  const genId = parts[7];
  if (genId === undefined) {
    if (method === "POST") return "ListBotResourceGenerations";
    return undefined;
  }
  if (method === "GET") return "DescribeBotResourceGeneration";
  return undefined;
};

const resolveBotReplicas = (
  parts: string[],
  method: string,
): string | undefined => {
  const replicaRegion = parts[3];
  if (replicaRegion === undefined) {
    if (method === "PUT") return "CreateBotReplica";
    if (method === "POST") return "ListBotReplicas";
    return undefined;
  }
  const sub = parts[4];
  if (sub === undefined) {
    if (method === "GET") return "DescribeBotReplica";
    if (method === "DELETE") return "DeleteBotReplica";
    return undefined;
  }
  if (sub === "botaliases" && method === "POST") return "ListBotAliasReplicas";
  if (sub === "botversions" && method === "POST")
    return "ListBotVersionReplicas";
  return undefined;
};

const resolveBotAnalytics = (
  parts: string[],
  method: string,
): string | undefined => {
  const metric = parts[3];
  if (metric === "intentmetrics" && method === "POST")
    return "ListIntentMetrics";
  if (metric === "intentpaths" && method === "POST") return "ListIntentPaths";
  if (metric === "intentstagemetrics" && method === "POST")
    return "ListIntentStageMetrics";
  if (metric === "sessions" && method === "POST")
    return "ListSessionAnalyticsData";
  if (metric === "sessionmetrics" && method === "POST")
    return "ListSessionMetrics";
  if (metric === "utterances" && method === "POST")
    return "ListUtteranceAnalyticsData";
  if (metric === "utterancemetrics" && method === "POST")
    return "ListUtteranceMetrics";
  return undefined;
};

const resolveBotAnalyzer = (
  parts: string[],
  method: string,
): string | undefined => {
  const p3 = parts[3];
  if (p3 === undefined) {
    if (method === "POST") return "StartBotAnalyzer";
    return undefined;
  }
  if (p3 === "history" && method === "POST") return "ListBotAnalyzerHistory";
  if (p3 === "describe") {
    if (parts[4] !== undefined && method === "POST")
      return "DescribeBotAnalyzerRecommendation";
    return undefined;
  }
  const p4 = parts[4];
  if (p4 === undefined) {
    if (method === "DELETE") return "DeleteBotAnalyzerRecommendation";
    return undefined;
  }
  if (p4 === "stop" && method === "PUT") return "StopBotAnalyzer";
  return undefined;
};

const lexv2 = {
  name: "lex",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const method = req.method;

    if (parts[0] === "bots") return resolveBot(parts, method);

    if (parts[0] === "exports") {
      const exportId = parts[1];
      if (exportId === undefined) {
        if (method === "PUT") return "CreateExport";
        if (method === "POST") return "ListExports";
        return undefined;
      }
      if (method === "GET") return "DescribeExport";
      if (method === "DELETE") return "DeleteExport";
      if (method === "PUT") return "UpdateExport";
      return undefined;
    }

    if (parts[0] === "imports") {
      const importId = parts[1];
      if (importId === undefined) {
        if (method === "PUT") return "StartImport";
        if (method === "POST") return "ListImports";
        return undefined;
      }
      if (method === "GET") return "DescribeImport";
      if (method === "DELETE") return "DeleteImport";
      return undefined;
    }

    if (parts[0] === "policy") {
      const sub = parts[2];
      if (sub === undefined) {
        if (method === "POST") return "CreateResourcePolicy";
        if (method === "GET") return "DescribeResourcePolicy";
        if (method === "DELETE") return "DeleteResourcePolicy";
        if (method === "PUT") return "UpdateResourcePolicy";
        return undefined;
      }
      if (sub === "statements") {
        const statementId = parts[3];
        if (statementId === undefined) {
          if (method === "POST") return "CreateResourcePolicyStatement";
          return undefined;
        }
        if (method === "DELETE") return "DeleteResourcePolicyStatement";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts[1] !== undefined) {
        if (method === "POST") return "TagResource";
        if (method === "GET") return "ListTagsForResource";
        if (method === "DELETE") return "UntagResource";
      }
      return undefined;
    }

    if (parts[0] === "testsets") {
      const testSetId = parts[1];
      if (testSetId === undefined) {
        if (method === "POST") return "ListTestSets";
        return undefined;
      }
      const sub = parts[2];
      if (sub === undefined) {
        if (method === "GET") return "DescribeTestSet";
        if (method === "DELETE") return "DeleteTestSet";
        if (method === "PUT") return "UpdateTestSet";
        return undefined;
      }
      if (sub === "records" && method === "POST") return "ListTestSetRecords";
      if (sub === "testexecutions" && method === "POST")
        return "StartTestExecution";
      if (sub === "testsetdiscrepancy" && method === "POST")
        return "CreateTestSetDiscrepancyReport";
      return undefined;
    }

    if (parts[0] === "testsetgenerations") {
      const genId = parts[1];
      if (genId === undefined) {
        if (method === "PUT") return "StartTestSetGeneration";
        return undefined;
      }
      if (method === "GET") return "DescribeTestSetGeneration";
      return undefined;
    }

    if (parts[0] === "testsetdiscrepancy") {
      if (parts[1] !== undefined && method === "GET")
        return "DescribeTestSetDiscrepancyReport";
      return undefined;
    }

    if (parts[0] === "testexecutions") {
      const execId = parts[1];
      if (execId === undefined) {
        if (method === "POST") return "ListTestExecutions";
        return undefined;
      }
      const sub = parts[2];
      if (sub === undefined) {
        if (method === "GET") return "DescribeTestExecution";
        return undefined;
      }
      if (sub === "artifacturl" && method === "GET")
        return "GetTestExecutionArtifactsUrl";
      if (sub === "results" && method === "POST")
        return "ListTestExecutionResultItems";
      return undefined;
    }

    if (parts[0] === "createuploadurl") {
      if (method === "POST") return "CreateUploadUrl";
      return undefined;
    }

    if (parts[0] === "builtins") {
      if (parts[1] === "locales" && parts[2] !== undefined) {
        const sub = parts[3];
        if (sub === "intents" && method === "POST") return "ListBuiltInIntents";
        if (sub === "slottypes" && method === "POST")
          return "ListBuiltInSlotTypes";
      }
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateBot,
    DescribeBot,
    ListBots,
    DeleteBot,
    UpdateBot,
    CreateBotAlias,
    DescribeBotAlias,
    ListBotAliases,
    DeleteBotAlias,
    UpdateBotAlias,
    CreateBotLocale,
    DescribeBotLocale,
    ListBotLocales,
    DeleteBotLocale,
    UpdateBotLocale,
    BuildBotLocale,
    CreateBotVersion,
    DescribeBotVersion,
    ListBotVersions,
    DeleteBotVersion,
    CreateBotReplica,
    DescribeBotReplica,
    DeleteBotReplica,
    ListBotReplicas,
    ListBotAliasReplicas,
    ListBotVersionReplicas,
    CreateIntent,
    DescribeIntent,
    ListIntents,
    UpdateIntent,
    DeleteIntent,
    CreateSlot,
    DescribeSlot,
    ListSlots,
    UpdateSlot,
    DeleteSlot,
    CreateSlotType,
    DescribeSlotType,
    ListSlotTypes,
    UpdateSlotType,
    DeleteSlotType,
    BatchCreateCustomVocabularyItem,
    BatchDeleteCustomVocabularyItem,
    BatchUpdateCustomVocabularyItem,
    ListCustomVocabularyItems,
    DescribeCustomVocabularyMetadata,
    DeleteCustomVocabulary,
    CreateExport,
    DescribeExport,
    ListExports,
    UpdateExport,
    DeleteExport,
    StartImport,
    DescribeImport,
    ListImports,
    DeleteImport,
    CreateResourcePolicy,
    DescribeResourcePolicy,
    UpdateResourcePolicy,
    DeleteResourcePolicy,
    CreateResourcePolicyStatement,
    DeleteResourcePolicyStatement,
    TagResource,
    UntagResource,
    ListTagsForResource,
    CreateTestSetDiscrepancyReport,
    DescribeTestSetDiscrepancyReport,
    CreateUploadUrl,
    DeleteUtterances,
    ListAggregatedUtterances,
    ListBuiltInIntents,
    ListBuiltInSlotTypes,
    StartBotRecommendation,
    DescribeBotRecommendation,
    UpdateBotRecommendation,
    ListBotRecommendations,
    StopBotRecommendation,
    ListRecommendedIntents,
    SearchAssociatedTranscripts,
    GenerateBotElement,
    StartBotResourceGeneration,
    DescribeBotResourceGeneration,
    ListBotResourceGenerations,
    StartBotAnalyzer,
    StopBotAnalyzer,
    DeleteBotAnalyzerRecommendation,
    DescribeBotAnalyzerRecommendation,
    ListBotAnalyzerHistory,
    DescribeTestSet,
    ListTestSets,
    DeleteTestSet,
    UpdateTestSet,
    ListTestSetRecords,
    StartTestExecution,
    DescribeTestExecution,
    ListTestExecutions,
    GetTestExecutionArtifactsUrl,
    ListTestExecutionResultItems,
    StartTestSetGeneration,
    DescribeTestSetGeneration,
    ListIntentMetrics,
    ListIntentPaths,
    ListIntentStageMetrics,
    ListSessionAnalyticsData,
    ListSessionMetrics,
    ListUtteranceAnalyticsData,
    ListUtteranceMetrics,
  },
  model,
} as const satisfies ServiceDefinition;

export default lexv2;
