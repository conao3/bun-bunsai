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

const botPrefix = "bot:" as const;

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

const botKey = (id: string): string => `${botPrefix}${id}`;

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
    .filter((entry) => entry.key.startsWith(botPrefix))
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

const lexv2 = {
  name: "lex",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "bots") return undefined;
    if (parts.length === 1) {
      if (req.method === "PUT") return "CreateBot";
      if (req.method === "POST") return "ListBots";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "DescribeBot";
      if (req.method === "DELETE") return "DeleteBot";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateBot,
    DescribeBot,
    ListBots,
    DeleteBot,
  },
  model,
} as const satisfies ServiceDefinition;

export default lexv2;
