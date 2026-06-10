import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import pinpointModel from "../../../../test/vendor/aws-models/pinpoint.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(pinpointModel);

const appPrefix = "app:" as const;
const campPrefix = "camp:" as const;
const segPrefix = "seg:" as const;
const jrnPrefix = "jrn:" as const;
const chPrefix = "ch:" as const;
const tplPrefix = "tpl:" as const;
const epPrefix = "ep:" as const;
const xjobPrefix = "xjob:" as const;
const ijobPrefix = "ijob:" as const;
const evtstrPrefix = "evtstr:" as const;
const recPrefix = "rec:" as const;
const settingsPrefix = "settings:" as const;
const tagsPrefix = "tags:" as const;

type StoredApp = {
  Id: string;
  Arn: string;
  Name: string;
  tags: Record<string, string>;
  CreationDate: string;
};

type StoredCampaign = {
  Id: string;
  ApplicationId: string;
  Arn: string;
  Name: string;
  CreationDate: string;
  LastModifiedDate: string;
  SegmentId: string;
  SegmentVersion: number;
  State: { Status: string };
  tags: Record<string, string>;
  Version: number;
};

type StoredSegment = {
  Id: string;
  ApplicationId: string;
  Arn: string;
  Name: string;
  CreationDate: string;
  LastModifiedDate: string;
  SegmentType: string;
  Version: number;
  tags: Record<string, string>;
};

type StoredJourney = {
  Id: string;
  ApplicationId: string;
  Arn: string;
  Name: string;
  CreationDate: string;
  LastModifiedDate: string;
  State: string;
  tags: Record<string, string>;
};

type StoredChannel = {
  ApplicationId: string;
  Platform: string;
  CreationDate: string;
  LastModifiedDate: string;
  Enabled: boolean;
  IsArchived: boolean;
  Version: number;
};

type StoredTemplate = {
  TemplateName: string;
  TemplateType: string;
  CreationDate: string;
  LastModifiedDate: string;
  Version: string;
  tags: Record<string, string>;
  body: Record<string, unknown>;
};

type StoredEndpoint = {
  Id: string;
  ApplicationId: string;
  Address: string | undefined;
  ChannelType: string | undefined;
  CreationDate: string;
  EffectiveDate: string;
  EndpointStatus: string;
  OptOut: string;
  User: Record<string, unknown> | undefined;
};

type StoredJob = {
  Id: string;
  ApplicationId: string;
  JobStatus: string;
  CreationDate: string;
  Type: string;
  Definition: Record<string, unknown>;
};

type StoredEventStream = {
  ApplicationId: string;
  DestinationStreamArn: string;
  RoleArn: string;
  LastModifiedDate: string;
};

type StoredRecommender = {
  Id: string;
  RecommendationProviderUri: string;
  RecommendationProviderRoleArn: string;
  CreationDate: string;
  LastModifiedDate: string;
  Name: string | undefined;
  Description: string | undefined;
};

type StoredAppSettings = {
  ApplicationId: string;
  CampaignHook: Record<string, unknown> | undefined;
  Limits: Record<string, unknown> | undefined;
  QuietTime: Record<string, unknown> | undefined;
  LastModifiedDate: string;
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
    throw awsError("BadRequestException", `${field} is required.`, 400);
  }
  return value;
};

const appKey = (id: string): string => `${appPrefix}${id}`;
const campaignKey = (appId: string, campId: string): string =>
  `${campPrefix}${appId}:${campId}`;
const segmentKey = (appId: string, segId: string): string =>
  `${segPrefix}${appId}:${segId}`;
const journeyKey = (appId: string, jrnId: string): string =>
  `${jrnPrefix}${appId}:${jrnId}`;
const channelKey = (appId: string, chType: string): string =>
  `${chPrefix}${appId}:${chType}`;
const templateKey = (name: string, type: string): string =>
  `${tplPrefix}${name}:${type}`;
const endpointKey = (appId: string, epId: string): string =>
  `${epPrefix}${appId}:${epId}`;
const exportJobKey = (appId: string, jobId: string): string =>
  `${xjobPrefix}${appId}:${jobId}`;
const importJobKey = (appId: string, jobId: string): string =>
  `${ijobPrefix}${appId}:${jobId}`;
const eventStreamKey = (appId: string): string => `${evtstrPrefix}${appId}`;
const recommenderKey = (recId: string): string => `${recPrefix}${recId}`;
const settingsKey = (appId: string): string => `${settingsPrefix}${appId}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const appArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:mobiletargeting:${ctx.region}:${ctx.account}:apps/${id}`;
const campaignArnOf = (
  ctx: ServiceContext,
  appId: string,
  campId: string,
): string =>
  `arn:aws:mobiletargeting:${ctx.region}:${ctx.account}:apps/${appId}/campaigns/${campId}`;
const segmentArnOf = (
  ctx: ServiceContext,
  appId: string,
  segId: string,
): string =>
  `arn:aws:mobiletargeting:${ctx.region}:${ctx.account}:apps/${appId}/segments/${segId}`;
const recommenderArnOf = (ctx: ServiceContext, recId: string): string =>
  `arn:aws:mobiletargeting:${ctx.region}:${ctx.account}:recommenders/${recId}`;
const journeyArnOf = (
  ctx: ServiceContext,
  appId: string,
  jrnId: string,
): string =>
  `arn:aws:mobiletargeting:${ctx.region}:${ctx.account}:apps/${appId}/journeys/${jrnId}`;

const appView = (app: StoredApp): Record<string, unknown> => ({
  Id: app.Id,
  Arn: app.Arn,
  Name: app.Name,
  tags: app.tags,
  CreationDate: app.CreationDate,
});

const campaignView = (c: StoredCampaign): Record<string, unknown> => ({
  Id: c.Id,
  ApplicationId: c.ApplicationId,
  Arn: c.Arn,
  Name: c.Name,
  CreationDate: c.CreationDate,
  LastModifiedDate: c.LastModifiedDate,
  SegmentId: c.SegmentId,
  SegmentVersion: c.SegmentVersion,
  State: c.State,
  tags: c.tags,
  Version: c.Version,
});

const segmentView = (s: StoredSegment): Record<string, unknown> => ({
  Id: s.Id,
  ApplicationId: s.ApplicationId,
  Arn: s.Arn,
  Name: s.Name,
  CreationDate: s.CreationDate,
  LastModifiedDate: s.LastModifiedDate,
  SegmentType: s.SegmentType,
  Version: s.Version,
  tags: s.tags,
});

const journeyView = (j: StoredJourney): Record<string, unknown> => ({
  Id: j.Id,
  ApplicationId: j.ApplicationId,
  Arn: j.Arn,
  Name: j.Name,
  CreationDate: j.CreationDate,
  LastModifiedDate: j.LastModifiedDate,
  State: j.State,
  tags: j.tags,
});

const channelView = (ch: StoredChannel): Record<string, unknown> => ({
  ApplicationId: ch.ApplicationId,
  Platform: ch.Platform,
  CreationDate: ch.CreationDate,
  LastModifiedDate: ch.LastModifiedDate,
  Enabled: ch.Enabled,
  IsArchived: ch.IsArchived,
  HasCredential: false,
  Version: ch.Version,
});

const templateView = (t: StoredTemplate): Record<string, unknown> => ({
  TemplateName: t.TemplateName,
  TemplateType: t.TemplateType,
  CreationDate: t.CreationDate,
  LastModifiedDate: t.LastModifiedDate,
  Version: t.Version,
  tags: t.tags,
  ...t.body,
});

const endpointView = (e: StoredEndpoint): Record<string, unknown> => ({
  Id: e.Id,
  ApplicationId: e.ApplicationId,
  Address: e.Address,
  ChannelType: e.ChannelType,
  CreationDate: e.CreationDate,
  EffectiveDate: e.EffectiveDate,
  EndpointStatus: e.EndpointStatus,
  OptOut: e.OptOut,
  User: e.User,
});

const jobView = (j: StoredJob): Record<string, unknown> => ({
  Id: j.Id,
  ApplicationId: j.ApplicationId,
  JobStatus: j.JobStatus,
  CreationDate: j.CreationDate,
  Type: j.Type,
  Definition: j.Definition,
});

const eventStreamView = (e: StoredEventStream): Record<string, unknown> => ({
  ApplicationId: e.ApplicationId,
  DestinationStreamArn: e.DestinationStreamArn,
  RoleArn: e.RoleArn,
  LastModifiedDate: e.LastModifiedDate,
});

const recommenderView = (r: StoredRecommender): Record<string, unknown> => ({
  Id: r.Id,
  RecommendationProviderUri: r.RecommendationProviderUri,
  RecommendationProviderRoleArn: r.RecommendationProviderRoleArn,
  CreationDate: r.CreationDate,
  LastModifiedDate: r.LastModifiedDate,
  Name: r.Name,
  Description: r.Description,
});

const paginateList = <T>(
  items: T[],
  token: unknown,
  pageSize: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const size =
    typeof pageSize === "string" && pageSize !== ""
      ? parseInt(pageSize, 10)
      : 0;
  const limit = size > 0 ? size : 100;
  const start =
    typeof token === "string" && token !== "" ? parseInt(token, 10) : 0;
  const page = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : undefined;
  return { items: page, nextToken: next };
};

const JOURNEY_STATES: ReadonlySet<string> = new Set([
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "CLOSED",
]);

const JOURNEY_TERMINAL_STATES = new Set(["COMPLETED", "CANCELLED", "CLOSED"]);

const requireApp = (ctx: ServiceContext, id: string): StoredApp => {
  const stored = ctx.store.get<StoredApp>(appKey(id));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Application not found with id: ${id}.`,
      404,
    );
  }
  return stored;
};

const requireCampaign = (
  ctx: ServiceContext,
  appId: string,
  campId: string,
): StoredCampaign => {
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredCampaign>(campaignKey(appId, campId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Campaign not found with id: ${campId}.`,
      404,
    );
  }
  return stored;
};

const requireSegment = (
  ctx: ServiceContext,
  appId: string,
  segId: string,
): StoredSegment => {
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredSegment>(segmentKey(appId, segId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Segment not found with id: ${segId}.`,
      404,
    );
  }
  return stored;
};

const requireJourney = (
  ctx: ServiceContext,
  appId: string,
  jrnId: string,
): StoredJourney => {
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredJourney>(journeyKey(appId, jrnId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Journey not found with id: ${jrnId}.`,
      404,
    );
  }
  return stored;
};

const requireEndpoint = (
  ctx: ServiceContext,
  appId: string,
  epId: string,
): StoredEndpoint => {
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredEndpoint>(endpointKey(appId, epId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Endpoint not found with id: ${epId}.`,
      404,
    );
  }
  return stored;
};

const requireRecommender = (
  ctx: ServiceContext,
  recId: string,
): StoredRecommender => {
  const stored = ctx.store.get<StoredRecommender>(recommenderKey(recId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Recommender configuration not found with id: ${recId}.`,
      404,
    );
  }
  return stored;
};

const msgBody = (): Record<string, unknown> => ({
  MessageBody: {
    Message: "The request succeeded.",
    RequestID: crypto.randomUUID(),
  },
});

const channelMeta = {
  adm: {
    responseKey: "ADMChannelResponse",
    platform: "ADM",
  },
  apns: {
    responseKey: "APNSChannelResponse",
    platform: "APNS",
  },
  apns_sandbox: {
    responseKey: "APNSSandboxChannelResponse",
    platform: "APNS_SANDBOX",
  },
  apns_voip: {
    responseKey: "APNSVoipChannelResponse",
    platform: "APNS_VOIP",
  },
  apns_voip_sandbox: {
    responseKey: "APNSVoipSandboxChannelResponse",
    platform: "APNS_VOIP_SANDBOX",
  },
  baidu: {
    responseKey: "BaiduChannelResponse",
    platform: "BAIDU",
  },
  email: {
    responseKey: "EmailChannelResponse",
    platform: "EMAIL",
  },
  gcm: {
    responseKey: "GCMChannelResponse",
    platform: "GCM",
  },
  sms: {
    responseKey: "SMSChannelResponse",
    platform: "SMS",
  },
  voice: {
    responseKey: "VoiceChannelResponse",
    platform: "VOICE",
  },
} as const;

type ChannelType = keyof typeof channelMeta;

const makeChannelGet =
  (chType: ChannelType): OperationHandler =>
  (input, ctx) => {
    const appId = requireString(input, "ApplicationId");
    requireApp(ctx, appId);
    const meta = channelMeta[chType];
    const stored = ctx.store.get<StoredChannel>(channelKey(appId, chType));
    if (stored === undefined) {
      throw awsError(
        "NotFoundException",
        `Channel not found for application ${appId}.`,
        404,
      );
    }
    return { [meta.responseKey]: channelView(stored) };
  };

const makeChannelUpdate =
  (chType: ChannelType): OperationHandler =>
  (input, ctx) => {
    const appId = requireString(input, "ApplicationId");
    requireApp(ctx, appId);
    const meta = channelMeta[chType];
    const reqKey = (meta.responseKey as string).replace("Response", "Request");
    const body = asRecord(input[reqKey]) ?? {};
    const nowStr = new Date().toISOString();
    const existing = ctx.store.get<StoredChannel>(channelKey(appId, chType));
    const ch: StoredChannel = {
      ApplicationId: appId,
      Platform: meta.platform,
      CreationDate: existing?.CreationDate ?? nowStr,
      LastModifiedDate: nowStr,
      Enabled:
        typeof body["Enabled"] === "boolean"
          ? body["Enabled"]
          : (existing?.Enabled ?? true),
      IsArchived: false,
      Version: (existing?.Version ?? 0) + 1,
    };
    ctx.store.set(channelKey(appId, chType), ch);
    return { [meta.responseKey]: channelView(ch) };
  };

const makeChannelDelete =
  (chType: ChannelType): OperationHandler =>
  (input, ctx) => {
    const appId = requireString(input, "ApplicationId");
    requireApp(ctx, appId);
    const meta = channelMeta[chType];
    const stored = ctx.store.get<StoredChannel>(channelKey(appId, chType));
    if (stored === undefined) {
      throw awsError(
        "NotFoundException",
        `Channel not found for application ${appId}.`,
        404,
      );
    }
    ctx.store.delete(channelKey(appId, chType));
    return { [meta.responseKey]: channelView(stored) };
  };

const templateMeta = {
  email: {
    responseKey: "EmailTemplateResponse",
    requestKey: "EmailTemplateRequest",
    typeStr: "EMAIL",
    createKey: "CreateTemplateMessageBody",
  },
  inapp: {
    responseKey: "InAppTemplateResponse",
    requestKey: "InAppTemplateRequest",
    typeStr: "INAPP",
    createKey: "TemplateCreateMessageBody",
  },
  push: {
    responseKey: "PushNotificationTemplateResponse",
    requestKey: "PushNotificationTemplateRequest",
    typeStr: "PUSH",
    createKey: "CreateTemplateMessageBody",
  },
  sms: {
    responseKey: "SMSTemplateResponse",
    requestKey: "SMSTemplateRequest",
    typeStr: "SMS",
    createKey: "CreateTemplateMessageBody",
  },
  voice: {
    responseKey: "VoiceTemplateResponse",
    requestKey: "VoiceTemplateRequest",
    typeStr: "VOICE",
    createKey: "CreateTemplateMessageBody",
  },
} as const;

type TplType = keyof typeof templateMeta;

const makeTemplateCreate =
  (tplType: TplType): OperationHandler =>
  (input, ctx) => {
    const name = requireString(input, "TemplateName");
    const meta = templateMeta[tplType];
    const body = asRecord(input[meta.requestKey]) ?? {};
    const nowStr = new Date().toISOString();
    const tpl: StoredTemplate = {
      TemplateName: name,
      TemplateType: meta.typeStr,
      CreationDate: nowStr,
      LastModifiedDate: nowStr,
      Version: "1",
      tags: stringMapFrom(body["tags"]),
      body,
    };
    ctx.store.set(templateKey(name, tplType), tpl);
    return {
      [meta.createKey]: {
        Message: "The request succeeded and your resource was created.",
        RequestID: crypto.randomUUID(),
      },
    };
  };

const makeTemplateGet =
  (tplType: TplType): OperationHandler =>
  (input, ctx) => {
    const name = requireString(input, "TemplateName");
    const meta = templateMeta[tplType];
    const stored = ctx.store.get<StoredTemplate>(templateKey(name, tplType));
    if (stored === undefined) {
      throw awsError("NotFoundException", `Template ${name} not found.`, 404);
    }
    return { [meta.responseKey]: templateView(stored) };
  };

const makeTemplateUpdate =
  (tplType: TplType): OperationHandler =>
  (input, ctx) => {
    const name = requireString(input, "TemplateName");
    const meta = templateMeta[tplType];
    const body = asRecord(input[meta.requestKey]) ?? {};
    const stored = ctx.store.get<StoredTemplate>(templateKey(name, tplType));
    if (stored === undefined) {
      throw awsError("NotFoundException", `Template ${name} not found.`, 404);
    }
    const nowStr = new Date().toISOString();
    ctx.store.set(templateKey(name, tplType), {
      ...stored,
      LastModifiedDate: nowStr,
      Version: String(Number(stored.Version) + 1),
      body,
    });
    return msgBody();
  };

const makeTemplateDelete =
  (tplType: TplType): OperationHandler =>
  (input, ctx) => {
    const name = requireString(input, "TemplateName");
    const stored = ctx.store.get<StoredTemplate>(templateKey(name, tplType));
    if (stored === undefined) {
      throw awsError("NotFoundException", `Template ${name} not found.`, 404);
    }
    ctx.store.delete(templateKey(name, tplType));
    return msgBody();
  };

const CreateApp: OperationHandler = (input, ctx) => {
  const request = asRecord(input["CreateApplicationRequest"]) ?? {};
  const name = requireString(request, "Name");
  const id = crypto.randomUUID().replace(/-/g, "");
  const app: StoredApp = {
    Id: id,
    Arn: appArnOf(ctx, id),
    Name: name,
    tags: stringMapFrom(request["tags"]),
    CreationDate: new Date().toISOString(),
  };
  ctx.store.set(appKey(id), app);
  if (Object.keys(app.tags).length > 0) {
    ctx.store.set(tagsKey(app.Arn), app.tags);
  }
  return { ApplicationResponse: appView(app) };
};

const GetApp: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  const app = requireApp(ctx, id);
  return { ApplicationResponse: appView(app) };
};

const GetApps: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredApp>()
    .filter((entry) => entry.key.startsWith(appPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => a.Name.localeCompare(b.Name));
  const { items, nextToken } = paginateList(
    all,
    input["Token"],
    input["PageSize"],
  );
  return {
    ApplicationsResponse: {
      Item: items.map(appView),
      ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
    },
  };
};

const DeleteApp: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ApplicationId");
  const app = requireApp(ctx, id);
  const childPrefixes = [
    `${campPrefix}${id}:`,
    `${segPrefix}${id}:`,
    `${jrnPrefix}${id}:`,
    `${epPrefix}${id}:`,
  ];
  const hasChildren = ctx.store
    .list()
    .some((entry) => childPrefixes.some((p) => entry.key.startsWith(p)));
  if (hasChildren) {
    throw awsError(
      "BadRequestException",
      `Application ${id} has dependent resources. Delete all campaigns, segments, journeys, and endpoints before deleting the application.`,
      400,
    );
  }
  ctx.store.delete(appKey(id));
  ctx.store.delete(tagsKey(app.Arn));
  return { ApplicationResponse: appView(app) };
};

const GetApplicationDateRangeKpi: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const kpiName = requireString(input, "KpiName");
  requireApp(ctx, appId);
  return {
    ApplicationDateRangeKpiResponse: {
      ApplicationId: appId,
      EndTime: new Date().toISOString(),
      KpiName: kpiName,
      KpiResult: { Rows: [] },
      StartTime: new Date().toISOString(),
    },
  };
};

const GetApplicationSettings: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const stored =
    ctx.store.get<StoredAppSettings>(settingsKey(appId)) ??
    ({
      ApplicationId: appId,
      CampaignHook: undefined,
      Limits: undefined,
      QuietTime: undefined,
      LastModifiedDate: new Date().toISOString(),
    } as StoredAppSettings);
  return {
    ApplicationSettingsResource: {
      ApplicationId: stored.ApplicationId,
      CampaignHook: stored.CampaignHook,
      Limits: stored.Limits,
      QuietTime: stored.QuietTime,
      LastModifiedDate: stored.LastModifiedDate,
    },
  };
};

const UpdateApplicationSettings: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["WriteApplicationSettingsRequest"]) ?? {};
  const nowStr = new Date().toISOString();
  const settings: StoredAppSettings = {
    ApplicationId: appId,
    CampaignHook: asRecord(body["CampaignHook"]),
    Limits: asRecord(body["Limits"]),
    QuietTime: asRecord(body["QuietTime"]),
    LastModifiedDate: nowStr,
  };
  ctx.store.set(settingsKey(appId), settings);
  return {
    ApplicationSettingsResource: {
      ApplicationId: settings.ApplicationId,
      CampaignHook: settings.CampaignHook,
      Limits: settings.Limits,
      QuietTime: settings.QuietTime,
      LastModifiedDate: settings.LastModifiedDate,
    },
  };
};

const CreateCampaign: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["WriteCampaignRequest"]) ?? {};
  const name = stringOrUndefined(body["Name"]) ?? "Campaign";
  const campId = crypto.randomUUID().replace(/-/g, "");
  const nowStr = new Date().toISOString();
  const camp: StoredCampaign = {
    Id: campId,
    ApplicationId: appId,
    Arn: campaignArnOf(ctx, appId, campId),
    Name: name,
    CreationDate: nowStr,
    LastModifiedDate: nowStr,
    SegmentId: stringOrUndefined(body["SegmentId"]) ?? "",
    SegmentVersion: 1,
    State: { Status: "SCHEDULED" },
    tags: stringMapFrom(body["tags"]),
    Version: 1,
  };
  ctx.store.set(campaignKey(appId, campId), camp);
  if (Object.keys(camp.tags).length > 0) {
    ctx.store.set(tagsKey(camp.Arn), camp.tags);
  }
  return { CampaignResponse: campaignView(camp) };
};

const GetCampaign: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  return {
    CampaignResponse: campaignView(requireCampaign(ctx, appId, campId)),
  };
};

const GetCampaigns: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const pfx = `${campPrefix}${appId}:`;
  const all = ctx.store
    .list<StoredCampaign>()
    .filter((e) => e.key.startsWith(pfx))
    .map((e) => campaignView(e.value));
  const { items, nextToken } = paginateList(
    all,
    input["Token"],
    input["PageSize"],
  );
  return {
    CampaignsResponse: {
      Item: items,
      ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
    },
  };
};

const UpdateCampaign: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  const camp = requireCampaign(ctx, appId, campId);
  const body = asRecord(input["WriteCampaignRequest"]) ?? {};
  const nowStr = new Date().toISOString();
  const updated: StoredCampaign = {
    ...camp,
    Name: stringOrUndefined(body["Name"]) ?? camp.Name,
    LastModifiedDate: nowStr,
    Version: camp.Version + 1,
  };
  ctx.store.set(campaignKey(appId, campId), updated);
  return { CampaignResponse: campaignView(updated) };
};

const DeleteCampaign: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  const camp = requireCampaign(ctx, appId, campId);
  ctx.store.delete(campaignKey(appId, campId));
  ctx.store.delete(tagsKey(camp.Arn));
  return { CampaignResponse: campaignView(camp) };
};

const GetCampaignActivities: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  requireCampaign(ctx, appId, campId);
  return { ActivitiesResponse: { Item: [] } };
};

const GetCampaignDateRangeKpi: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  const kpiName = requireString(input, "KpiName");
  requireCampaign(ctx, appId, campId);
  return {
    CampaignDateRangeKpiResponse: {
      ApplicationId: appId,
      CampaignId: campId,
      EndTime: new Date().toISOString(),
      KpiName: kpiName,
      KpiResult: { Rows: [] },
      StartTime: new Date().toISOString(),
    },
  };
};

const GetCampaignVersion: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  return {
    CampaignResponse: campaignView(requireCampaign(ctx, appId, campId)),
  };
};

const GetCampaignVersions: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const campId = requireString(input, "CampaignId");
  const camp = requireCampaign(ctx, appId, campId);
  return { CampaignsResponse: { Item: [campaignView(camp)] } };
};

const CreateSegment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["WriteSegmentRequest"]) ?? {};
  const name = stringOrUndefined(body["Name"]) ?? "Segment";
  const segId = crypto.randomUUID().replace(/-/g, "");
  const nowStr = new Date().toISOString();
  const seg: StoredSegment = {
    Id: segId,
    ApplicationId: appId,
    Arn: segmentArnOf(ctx, appId, segId),
    Name: name,
    CreationDate: nowStr,
    LastModifiedDate: nowStr,
    SegmentType: "DIMENSIONAL",
    Version: 1,
    tags: stringMapFrom(body["tags"]),
  };
  ctx.store.set(segmentKey(appId, segId), seg);
  if (Object.keys(seg.tags).length > 0) {
    ctx.store.set(tagsKey(seg.Arn), seg.tags);
  }
  return { SegmentResponse: segmentView(seg) };
};

const GetSegment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  return { SegmentResponse: segmentView(requireSegment(ctx, appId, segId)) };
};

const GetSegments: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const pfx = `${segPrefix}${appId}:`;
  const all = ctx.store
    .list<StoredSegment>()
    .filter((e) => e.key.startsWith(pfx))
    .map((e) => segmentView(e.value));
  const { items, nextToken } = paginateList(
    all,
    input["Token"],
    input["PageSize"],
  );
  return {
    SegmentsResponse: {
      Item: items,
      ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
    },
  };
};

const UpdateSegment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  const seg = requireSegment(ctx, appId, segId);
  const body = asRecord(input["WriteSegmentRequest"]) ?? {};
  const nowStr = new Date().toISOString();
  const updated: StoredSegment = {
    ...seg,
    Name: stringOrUndefined(body["Name"]) ?? seg.Name,
    LastModifiedDate: nowStr,
    Version: seg.Version + 1,
  };
  ctx.store.set(segmentKey(appId, segId), updated);
  return { SegmentResponse: segmentView(updated) };
};

const DeleteSegment: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  const seg = requireSegment(ctx, appId, segId);
  ctx.store.delete(segmentKey(appId, segId));
  ctx.store.delete(tagsKey(seg.Arn));
  return { SegmentResponse: segmentView(seg) };
};

const GetSegmentVersion: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  return { SegmentResponse: segmentView(requireSegment(ctx, appId, segId)) };
};

const GetSegmentVersions: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  const seg = requireSegment(ctx, appId, segId);
  return { SegmentsResponse: { Item: [segmentView(seg)] } };
};

const GetSegmentExportJobs: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  requireSegment(ctx, appId, segId);
  const pfx = `${xjobPrefix}${appId}:`;
  const jobs = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith(pfx))
    .filter(
      (e) =>
        (asRecord(e.value.Definition)?.["SegmentId"] as string | undefined) ===
        segId,
    )
    .map((e) => jobView(e.value));
  return { ExportJobsResponse: { Item: jobs } };
};

const GetSegmentImportJobs: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const segId = requireString(input, "SegmentId");
  requireSegment(ctx, appId, segId);
  const pfx = `${ijobPrefix}${appId}:`;
  const jobs = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith(pfx))
    .filter(
      (e) =>
        (asRecord(e.value.Definition)?.["SegmentId"] as string | undefined) ===
        segId,
    )
    .map((e) => jobView(e.value));
  return { ImportJobsResponse: { Item: jobs } };
};

const CreateJourney: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["WriteJourneyRequest"]) ?? {};
  const name = requireString(body, "Name");
  const jrnId = crypto.randomUUID().replace(/-/g, "");
  const nowStr = new Date().toISOString();
  const jrn: StoredJourney = {
    Id: jrnId,
    ApplicationId: appId,
    Arn: journeyArnOf(ctx, appId, jrnId),
    Name: name,
    CreationDate: nowStr,
    LastModifiedDate: nowStr,
    State: "DRAFT",
    tags: stringMapFrom(body["tags"]),
  };
  ctx.store.set(journeyKey(appId, jrnId), jrn);
  if (Object.keys(jrn.tags).length > 0) {
    ctx.store.set(tagsKey(jrn.Arn), jrn.tags);
  }
  return { JourneyResponse: journeyView(jrn) };
};

const GetJourney: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  return { JourneyResponse: journeyView(requireJourney(ctx, appId, jrnId)) };
};

const ListJourneys: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const pfx = `${jrnPrefix}${appId}:`;
  const all = ctx.store
    .list<StoredJourney>()
    .filter((e) => e.key.startsWith(pfx))
    .map((e) => journeyView(e.value));
  const { items, nextToken } = paginateList(
    all,
    input["Token"],
    input["PageSize"],
  );
  return {
    JourneysResponse: {
      Item: items,
      ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
    },
  };
};

const UpdateJourney: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const jrn = requireJourney(ctx, appId, jrnId);
  const body = asRecord(input["WriteJourneyRequest"]) ?? {};
  const nowStr = new Date().toISOString();
  const updated: StoredJourney = {
    ...jrn,
    Name: stringOrUndefined(body["Name"]) ?? jrn.Name,
    LastModifiedDate: nowStr,
  };
  ctx.store.set(journeyKey(appId, jrnId), updated);
  return { JourneyResponse: journeyView(updated) };
};

const UpdateJourneyState: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const jrn = requireJourney(ctx, appId, jrnId);
  const body = asRecord(input["JourneyStateRequest"]) ?? {};
  const newState = stringOrUndefined(body["State"]);
  if (newState === undefined || !JOURNEY_STATES.has(newState)) {
    throw awsError(
      "BadRequestException",
      `State must be one of DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED, CLOSED.`,
      400,
    );
  }
  if (JOURNEY_TERMINAL_STATES.has(jrn.State)) {
    throw awsError(
      "BadRequestException",
      `Journey is in terminal state ${jrn.State} and cannot be transitioned.`,
      400,
    );
  }
  const nowStr = new Date().toISOString();
  const updated: StoredJourney = {
    ...jrn,
    State: newState,
    LastModifiedDate: nowStr,
  };
  ctx.store.set(journeyKey(appId, jrnId), updated);
  return { JourneyResponse: journeyView(updated) };
};

const JOURNEY_UNDELETABLE_STATES = new Set(["ACTIVE", "PAUSED", "DRAFT"]);

const DeleteJourney: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const jrn = requireJourney(ctx, appId, jrnId);
  if (JOURNEY_UNDELETABLE_STATES.has(jrn.State)) {
    throw awsError(
      "BadRequestException",
      `Journey cannot be deleted in ${jrn.State} state. Transition to CANCELLED before deleting.`,
      400,
    );
  }
  ctx.store.delete(journeyKey(appId, jrnId));
  ctx.store.delete(tagsKey(jrn.Arn));
  return { JourneyResponse: journeyView(jrn) };
};

const GetJourneyDateRangeKpi: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const kpiName = requireString(input, "KpiName");
  requireJourney(ctx, appId, jrnId);
  return {
    JourneyDateRangeKpiResponse: {
      ApplicationId: appId,
      JourneyId: jrnId,
      EndTime: new Date().toISOString(),
      KpiName: kpiName,
      KpiResult: { Rows: [] },
      StartTime: new Date().toISOString(),
    },
  };
};

const GetJourneyExecutionActivityMetrics: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const activityId = requireString(input, "JourneyActivityId");
  requireJourney(ctx, appId, jrnId);
  return {
    JourneyExecutionActivityMetricsResponse: {
      ApplicationId: appId,
      JourneyId: jrnId,
      JourneyActivityId: activityId,
      ActivityType: "MESSAGE",
      LastEvaluatedTime: new Date().toISOString(),
      Metrics: {},
    },
  };
};

const GetJourneyExecutionMetrics: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  requireJourney(ctx, appId, jrnId);
  return {
    JourneyExecutionMetricsResponse: {
      ApplicationId: appId,
      JourneyId: jrnId,
      LastEvaluatedTime: new Date().toISOString(),
      Metrics: {},
    },
  };
};

const GetJourneyRunExecutionActivityMetrics: OperationHandler = (
  input,
  ctx,
) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const runId = requireString(input, "RunId");
  const activityId = requireString(input, "JourneyActivityId");
  requireJourney(ctx, appId, jrnId);
  return {
    JourneyRunExecutionActivityMetricsResponse: {
      ApplicationId: appId,
      JourneyId: jrnId,
      RunId: runId,
      JourneyActivityId: activityId,
      ActivityType: "MESSAGE",
      LastEvaluatedTime: new Date().toISOString(),
      Metrics: {},
    },
  };
};

const GetJourneyRunExecutionMetrics: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  const runId = requireString(input, "RunId");
  requireJourney(ctx, appId, jrnId);
  return {
    JourneyRunExecutionMetricsResponse: {
      ApplicationId: appId,
      JourneyId: jrnId,
      RunId: runId,
      LastEvaluatedTime: new Date().toISOString(),
      Metrics: {},
    },
  };
};

const GetJourneyRuns: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jrnId = requireString(input, "JourneyId");
  requireJourney(ctx, appId, jrnId);
  return { JourneyRunsResponse: { Item: [] } };
};

const GetChannels: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const channels: Record<string, unknown> = {};
  for (const chType of Object.keys(channelMeta) as ChannelType[]) {
    const stored = ctx.store.get<StoredChannel>(channelKey(appId, chType));
    if (stored !== undefined) {
      channels[stored.Platform] = channelView(stored);
    }
  }
  return { ChannelsResponse: { Channels: channels } };
};

const GetAdmChannel = makeChannelGet("adm");
const UpdateAdmChannel = makeChannelUpdate("adm");
const DeleteAdmChannel = makeChannelDelete("adm");
const GetApnsChannel = makeChannelGet("apns");
const UpdateApnsChannel = makeChannelUpdate("apns");
const DeleteApnsChannel = makeChannelDelete("apns");
const GetApnsSandboxChannel = makeChannelGet("apns_sandbox");
const UpdateApnsSandboxChannel = makeChannelUpdate("apns_sandbox");
const DeleteApnsSandboxChannel = makeChannelDelete("apns_sandbox");
const GetApnsVoipChannel = makeChannelGet("apns_voip");
const UpdateApnsVoipChannel = makeChannelUpdate("apns_voip");
const DeleteApnsVoipChannel = makeChannelDelete("apns_voip");
const GetApnsVoipSandboxChannel = makeChannelGet("apns_voip_sandbox");
const UpdateApnsVoipSandboxChannel = makeChannelUpdate("apns_voip_sandbox");
const DeleteApnsVoipSandboxChannel = makeChannelDelete("apns_voip_sandbox");
const GetBaiduChannel = makeChannelGet("baidu");
const UpdateBaiduChannel = makeChannelUpdate("baidu");
const DeleteBaiduChannel = makeChannelDelete("baidu");
const GetEmailChannel = makeChannelGet("email");
const UpdateEmailChannel = makeChannelUpdate("email");
const DeleteEmailChannel = makeChannelDelete("email");
const GetGcmChannel = makeChannelGet("gcm");
const UpdateGcmChannel = makeChannelUpdate("gcm");
const DeleteGcmChannel = makeChannelDelete("gcm");
const GetSmsChannel = makeChannelGet("sms");
const UpdateSmsChannel = makeChannelUpdate("sms");
const DeleteSmsChannel = makeChannelDelete("sms");
const GetVoiceChannel = makeChannelGet("voice");
const UpdateVoiceChannel = makeChannelUpdate("voice");
const DeleteVoiceChannel = makeChannelDelete("voice");

const CreateEmailTemplate = makeTemplateCreate("email");
const GetEmailTemplate = makeTemplateGet("email");
const UpdateEmailTemplate = makeTemplateUpdate("email");
const DeleteEmailTemplate = makeTemplateDelete("email");
const CreateInAppTemplate = makeTemplateCreate("inapp");
const GetInAppTemplate = makeTemplateGet("inapp");
const UpdateInAppTemplate = makeTemplateUpdate("inapp");
const DeleteInAppTemplate = makeTemplateDelete("inapp");
const CreatePushTemplate = makeTemplateCreate("push");
const GetPushTemplate = makeTemplateGet("push");
const UpdatePushTemplate = makeTemplateUpdate("push");
const DeletePushTemplate = makeTemplateDelete("push");
const CreateSmsTemplate = makeTemplateCreate("sms");
const GetSmsTemplate = makeTemplateGet("sms");
const UpdateSmsTemplate = makeTemplateUpdate("sms");
const DeleteSmsTemplate = makeTemplateDelete("sms");
const CreateVoiceTemplate = makeTemplateCreate("voice");
const GetVoiceTemplate = makeTemplateGet("voice");
const UpdateVoiceTemplate = makeTemplateUpdate("voice");
const DeleteVoiceTemplate = makeTemplateDelete("voice");

const ListTemplates: OperationHandler = (_input, ctx) => {
  const tpls = ctx.store
    .list<StoredTemplate>()
    .filter((e) => e.key.startsWith(tplPrefix))
    .map((e) => ({
      TemplateName: e.value.TemplateName,
      TemplateType: e.value.TemplateType,
      CreationDate: e.value.CreationDate,
      LastModifiedDate: e.value.LastModifiedDate,
      Version: e.value.Version,
      tags: e.value.tags,
    }));
  return { TemplatesResponse: { Item: tpls } };
};

const ListTemplateVersions: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TemplateName");
  const rawType = requireString(input, "TemplateType").toLowerCase() as TplType;
  const stored = ctx.store.get<StoredTemplate>(templateKey(name, rawType));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Template ${name} not found.`, 404);
  }
  return {
    TemplateVersionsResponse: {
      Item: [
        {
          CreationDate: stored.CreationDate,
          LastModifiedDate: stored.LastModifiedDate,
          TemplateName: stored.TemplateName,
          TemplateType: stored.TemplateType,
          Version: stored.Version,
        },
      ],
    },
  };
};

const UpdateTemplateActiveVersion: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TemplateName");
  const rawType = requireString(input, "TemplateType").toLowerCase() as TplType;
  const stored = ctx.store.get<StoredTemplate>(templateKey(name, rawType));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Template ${name} not found.`, 404);
  }
  return msgBody();
};

const GetEndpoint: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const epId = requireString(input, "EndpointId");
  return { EndpointResponse: endpointView(requireEndpoint(ctx, appId, epId)) };
};

const UpdateEndpoint: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const epId = requireString(input, "EndpointId");
  requireApp(ctx, appId);
  const body = asRecord(input["EndpointRequest"]) ?? {};
  const nowStr = new Date().toISOString();
  const existing = ctx.store.get<StoredEndpoint>(endpointKey(appId, epId));
  const ep: StoredEndpoint = {
    Id: epId,
    ApplicationId: appId,
    Address: stringOrUndefined(body["Address"]) ?? existing?.Address,
    ChannelType:
      stringOrUndefined(body["ChannelType"]) ?? existing?.ChannelType,
    CreationDate: existing?.CreationDate ?? nowStr,
    EffectiveDate: nowStr,
    EndpointStatus: stringOrUndefined(body["EndpointStatus"]) ?? "ACTIVE",
    OptOut: stringOrUndefined(body["OptOut"]) ?? "NONE",
    User: asRecord(body["User"]) ?? existing?.User,
  };
  ctx.store.set(endpointKey(appId, epId), ep);
  return msgBody();
};

const UpdateEndpointsBatch: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const batchReq = asRecord(input["EndpointBatchRequest"]) ?? {};
  const items = Array.isArray(batchReq["Item"])
    ? (batchReq["Item"] as unknown[])
    : [];
  const nowStr = new Date().toISOString();
  for (const item of items) {
    const rec = asRecord(item);
    if (rec === undefined) continue;
    const epId = stringOrUndefined(rec["Id"]);
    if (epId === undefined) continue;
    const existing = ctx.store.get<StoredEndpoint>(endpointKey(appId, epId));
    const ep: StoredEndpoint = {
      Id: epId,
      ApplicationId: appId,
      Address: stringOrUndefined(rec["Address"]) ?? existing?.Address,
      ChannelType:
        stringOrUndefined(rec["ChannelType"]) ?? existing?.ChannelType,
      CreationDate: existing?.CreationDate ?? nowStr,
      EffectiveDate: nowStr,
      EndpointStatus: stringOrUndefined(rec["EndpointStatus"]) ?? "ACTIVE",
      OptOut: stringOrUndefined(rec["OptOut"]) ?? "NONE",
      User: asRecord(rec["User"]) ?? existing?.User,
    };
    ctx.store.set(endpointKey(appId, epId), ep);
  }
  return msgBody();
};

const DeleteEndpoint: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const epId = requireString(input, "EndpointId");
  requireEndpoint(ctx, appId, epId);
  ctx.store.delete(endpointKey(appId, epId));
  return msgBody();
};

const GetInAppMessages: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  return {
    InAppMessagesResponse: {
      InAppMessageCampaigns: [],
    },
  };
};

const GetUserEndpoints: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const userId = requireString(input, "UserId");
  requireApp(ctx, appId);
  const pfx = `${epPrefix}${appId}:`;
  const eps = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith(pfx))
    .filter(
      (e) =>
        (e.value.User as Record<string, unknown> | undefined)?.["UserId"] ===
        userId,
    )
    .map((e) => endpointView(e.value));
  return { EndpointsResponse: { Item: eps } };
};

const DeleteUserEndpoints: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const userId = requireString(input, "UserId");
  requireApp(ctx, appId);
  const pfx = `${epPrefix}${appId}:`;
  const eps = ctx.store
    .list<StoredEndpoint>()
    .filter((e) => e.key.startsWith(pfx))
    .filter(
      (e) =>
        (e.value.User as Record<string, unknown> | undefined)?.["UserId"] ===
        userId,
    );
  for (const e of eps) {
    ctx.store.delete(e.key);
  }
  return { EndpointsResponse: { Item: eps.map((e) => endpointView(e.value)) } };
};

const CreateExportJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["ExportJobRequest"]) ?? {};
  const jobId = crypto.randomUUID().replace(/-/g, "");
  const nowStr = new Date().toISOString();
  const job: StoredJob = {
    Id: jobId,
    ApplicationId: appId,
    JobStatus: "COMPLETED",
    CreationDate: nowStr,
    Type: "EXPORT",
    Definition: body,
  };
  ctx.store.set(exportJobKey(appId, jobId), job);
  return { ExportJobResponse: jobView(job) };
};

const GetExportJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jobId = requireString(input, "JobId");
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredJob>(exportJobKey(appId, jobId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Export job not found with id: ${jobId}.`,
      404,
    );
  }
  return { ExportJobResponse: jobView(stored) };
};

const GetExportJobs: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const pfx = `${xjobPrefix}${appId}:`;
  const jobs = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith(pfx))
    .map((e) => jobView(e.value));
  return { ExportJobsResponse: { Item: jobs } };
};

const CreateImportJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["ImportJobRequest"]) ?? {};
  const jobId = crypto.randomUUID().replace(/-/g, "");
  const nowStr = new Date().toISOString();
  const job: StoredJob = {
    Id: jobId,
    ApplicationId: appId,
    JobStatus: "COMPLETED",
    CreationDate: nowStr,
    Type: "IMPORT",
    Definition: body,
  };
  ctx.store.set(importJobKey(appId, jobId), job);
  return { ImportJobResponse: jobView(job) };
};

const GetImportJob: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const jobId = requireString(input, "JobId");
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredJob>(importJobKey(appId, jobId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Import job not found with id: ${jobId}.`,
      404,
    );
  }
  return { ImportJobResponse: jobView(stored) };
};

const GetImportJobs: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const pfx = `${ijobPrefix}${appId}:`;
  const jobs = ctx.store
    .list<StoredJob>()
    .filter((e) => e.key.startsWith(pfx))
    .map((e) => jobView(e.value));
  return { ImportJobsResponse: { Item: jobs } };
};

const GetEventStream: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredEventStream>(eventStreamKey(appId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Event stream not found for application ${appId}.`,
      404,
    );
  }
  return { EventStream: eventStreamView(stored) };
};

const PutEventStream: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const body = asRecord(input["WriteEventStream"]) ?? {};
  const nowStr = new Date().toISOString();
  const es: StoredEventStream = {
    ApplicationId: appId,
    DestinationStreamArn: requireString(body, "DestinationStreamArn"),
    RoleArn: requireString(body, "RoleArn"),
    LastModifiedDate: nowStr,
  };
  ctx.store.set(eventStreamKey(appId), es);
  return { EventStream: eventStreamView(es) };
};

const DeleteEventStream: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  const stored = ctx.store.get<StoredEventStream>(eventStreamKey(appId));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Event stream not found for application ${appId}.`,
      404,
    );
  }
  ctx.store.delete(eventStreamKey(appId));
  return { EventStream: eventStreamView(stored) };
};

const CreateRecommenderConfiguration: OperationHandler = (input, ctx) => {
  const body = asRecord(input["CreateRecommenderConfiguration"]) ?? {};
  const uri = requireString(body, "RecommendationProviderUri");
  const roleArn = requireString(body, "RecommendationProviderRoleArn");
  const recId = crypto.randomUUID().replace(/-/g, "");
  const nowStr = new Date().toISOString();
  const rec: StoredRecommender = {
    Id: recId,
    RecommendationProviderUri: uri,
    RecommendationProviderRoleArn: roleArn,
    CreationDate: nowStr,
    LastModifiedDate: nowStr,
    Name: stringOrUndefined(body["Name"]),
    Description: stringOrUndefined(body["Description"]),
  };
  ctx.store.set(recommenderKey(recId), rec);
  return {
    RecommenderConfigurationResponse: {
      ...recommenderView(rec),
      Arn: recommenderArnOf(ctx, recId),
    },
  };
};

const GetRecommenderConfiguration: OperationHandler = (input, ctx) => {
  const recId = requireString(input, "RecommenderId");
  const rec = requireRecommender(ctx, recId);
  return {
    RecommenderConfigurationResponse: {
      ...recommenderView(rec),
      Arn: recommenderArnOf(ctx, recId),
    },
  };
};

const GetRecommenderConfigurations: OperationHandler = (_input, ctx) => {
  const recs = ctx.store
    .list<StoredRecommender>()
    .filter((e) => e.key.startsWith(recPrefix))
    .map((e) => recommenderView(e.value));
  return {
    ListRecommenderConfigurationsResponse: { Item: recs },
  };
};

const UpdateRecommenderConfiguration: OperationHandler = (input, ctx) => {
  const recId = requireString(input, "RecommenderId");
  const rec = requireRecommender(ctx, recId);
  const body = asRecord(input["UpdateRecommenderConfiguration"]) ?? {};
  const nowStr = new Date().toISOString();
  const updated: StoredRecommender = {
    ...rec,
    RecommendationProviderUri:
      stringOrUndefined(body["RecommendationProviderUri"]) ??
      rec.RecommendationProviderUri,
    RecommendationProviderRoleArn:
      stringOrUndefined(body["RecommendationProviderRoleArn"]) ??
      rec.RecommendationProviderRoleArn,
    Name: stringOrUndefined(body["Name"]) ?? rec.Name,
    Description: stringOrUndefined(body["Description"]) ?? rec.Description,
    LastModifiedDate: nowStr,
  };
  ctx.store.set(recommenderKey(recId), updated);
  return {
    RecommenderConfigurationResponse: {
      ...recommenderView(updated),
      Arn: recommenderArnOf(ctx, recId),
    },
  };
};

const DeleteRecommenderConfiguration: OperationHandler = (input, ctx) => {
  const recId = requireString(input, "RecommenderId");
  const rec = requireRecommender(ctx, recId);
  ctx.store.delete(recommenderKey(recId));
  ctx.store.delete(tagsKey(recommenderArnOf(ctx, recId)));
  return {
    RecommenderConfigurationResponse: {
      ...recommenderView(rec),
      Arn: recommenderArnOf(ctx, recId),
    },
  };
};

const requireResourceByArn = (ctx: ServiceContext, arn: string): void => {
  const pathPart = arn.split(":").slice(5).join(":");
  const segs = pathPart.split("/");
  if (segs[0] === "apps" && segs[1]) {
    const appId = segs[1];
    requireApp(ctx, appId);
    if (segs.length >= 4 && segs[2] && segs[3]) {
      if (segs[2] === "campaigns") requireCampaign(ctx, appId, segs[3]);
      else if (segs[2] === "segments") requireSegment(ctx, appId, segs[3]);
      else if (segs[2] === "journeys") requireJourney(ctx, appId, segs[3]);
    }
  } else if (segs[0] === "recommenders" && segs[1]) {
    requireRecommender(ctx, segs[1]);
  } else {
    throw awsError("NotFoundException", `Resource not found: ${arn}.`, 404);
  }
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  requireResourceByArn(ctx, arn);
  const stored = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return { TagsModel: { tags: stored } };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const body = asRecord(input["TagsModel"]) ?? {};
  const newTags = stringMapFrom(body["tags"]);
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const k of tagKeys) {
    delete existing[k];
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const PhoneNumberValidate: OperationHandler = (input, _ctx) => {
  const body = asRecord(input["NumberValidateRequest"]) ?? {};
  const phoneNumber = stringOrUndefined(body["PhoneNumber"]) ?? "+10000000000";
  return {
    NumberValidateResponse: {
      PhoneType: "MOBILE",
      PhoneTypeCode: 0,
      Carrier: "Unknown",
      CleansedPhoneNumberE164: phoneNumber,
      CleansedPhoneNumberNational: phoneNumber,
      Country: "US",
      CountryCodeIso2: "US",
      CountryCodeNumeric: "1",
      OriginalPhoneNumber: phoneNumber,
      Timezone: "America/New_York",
    },
  };
};

const PutEvents: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  return {
    EventsResponse: {
      Results: {},
    },
  };
};

const RemoveAttributes: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  const attributeType = requireString(input, "AttributeType");
  requireApp(ctx, appId);
  return {
    AttributesResource: {
      ApplicationId: appId,
      AttributeType: attributeType,
      Attributes: [],
    },
  };
};

const SendMessages: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  return {
    MessageResponse: {
      ApplicationId: appId,
      RequestId: crypto.randomUUID(),
      Result: {},
    },
  };
};

const SendOTPMessage: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  return {
    MessageResponse: {
      ApplicationId: appId,
      RequestId: crypto.randomUUID(),
      Result: {},
    },
  };
};

const SendUsersMessages: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  return {
    SendUsersMessageResponse: {
      ApplicationId: appId,
      RequestId: crypto.randomUUID(),
      Result: {},
    },
  };
};

const VerifyOTPMessage: OperationHandler = (input, ctx) => {
  const appId = requireString(input, "ApplicationId");
  requireApp(ctx, appId);
  return {
    VerificationResponse: {
      Valid: true,
    },
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const pinpoint = {
  name: "mobiletargeting",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "v1") return undefined;

    if (parts[1] === "phone") {
      if (
        parts.length === 4 &&
        parts[2] === "number" &&
        parts[3] === "validate" &&
        req.method === "POST"
      )
        return "PhoneNumberValidate";
      return undefined;
    }

    if (parts[1] === "recommenders") {
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateRecommenderConfiguration";
        if (req.method === "GET") return "GetRecommenderConfigurations";
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetRecommenderConfiguration";
        if (req.method === "PUT") return "UpdateRecommenderConfiguration";
        if (req.method === "DELETE") return "DeleteRecommenderConfiguration";
      }
      return undefined;
    }

    if (parts[1] === "tags") {
      if (parts.length >= 3) {
        if (req.method === "GET") return "ListTagsForResource";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
      }
      return undefined;
    }

    if (parts[1] === "templates") {
      if (parts.length === 2 && req.method === "GET") return "ListTemplates";
      if (parts.length === 4) {
        const tType = parts[3];
        if (tType === "email") {
          if (req.method === "POST") return "CreateEmailTemplate";
          if (req.method === "GET") return "GetEmailTemplate";
          if (req.method === "PUT") return "UpdateEmailTemplate";
          if (req.method === "DELETE") return "DeleteEmailTemplate";
        }
        if (tType === "inapp") {
          if (req.method === "POST") return "CreateInAppTemplate";
          if (req.method === "GET") return "GetInAppTemplate";
          if (req.method === "PUT") return "UpdateInAppTemplate";
          if (req.method === "DELETE") return "DeleteInAppTemplate";
        }
        if (tType === "push") {
          if (req.method === "POST") return "CreatePushTemplate";
          if (req.method === "GET") return "GetPushTemplate";
          if (req.method === "PUT") return "UpdatePushTemplate";
          if (req.method === "DELETE") return "DeletePushTemplate";
        }
        if (tType === "sms") {
          if (req.method === "POST") return "CreateSmsTemplate";
          if (req.method === "GET") return "GetSmsTemplate";
          if (req.method === "PUT") return "UpdateSmsTemplate";
          if (req.method === "DELETE") return "DeleteSmsTemplate";
        }
        if (tType === "voice") {
          if (req.method === "POST") return "CreateVoiceTemplate";
          if (req.method === "GET") return "GetVoiceTemplate";
          if (req.method === "PUT") return "UpdateVoiceTemplate";
          if (req.method === "DELETE") return "DeleteVoiceTemplate";
        }
      }
      if (parts.length === 5) {
        if (parts[4] === "versions" && req.method === "GET")
          return "ListTemplateVersions";
        if (parts[4] === "active-version" && req.method === "PUT")
          return "UpdateTemplateActiveVersion";
      }
      return undefined;
    }

    if (parts[1] !== "apps") return undefined;

    if (parts.length === 2) {
      if (req.method === "POST") return "CreateApp";
      if (req.method === "GET") return "GetApps";
      return undefined;
    }

    if (parts.length === 3) {
      if (req.method === "GET") return "GetApp";
      if (req.method === "DELETE") return "DeleteApp";
      return undefined;
    }

    switch (parts[3]) {
      case "campaigns":
        if (parts.length === 4) {
          if (req.method === "POST") return "CreateCampaign";
          if (req.method === "GET") return "GetCampaigns";
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetCampaign";
          if (req.method === "PUT") return "UpdateCampaign";
          if (req.method === "DELETE") return "DeleteCampaign";
        }
        if (parts.length === 6) {
          if (parts[5] === "activities" && req.method === "GET")
            return "GetCampaignActivities";
          if (parts[5] === "versions" && req.method === "GET")
            return "GetCampaignVersions";
        }
        if (
          parts.length === 7 &&
          parts[5] === "versions" &&
          req.method === "GET"
        )
          return "GetCampaignVersion";
        if (
          parts.length === 8 &&
          parts[5] === "kpis" &&
          parts[6] === "daterange" &&
          req.method === "GET"
        )
          return "GetCampaignDateRangeKpi";
        break;

      case "channels":
        if (parts.length === 4 && req.method === "GET") return "GetChannels";
        if (parts.length === 5) {
          const ch = parts[4];
          if (ch === "adm") {
            if (req.method === "GET") return "GetAdmChannel";
            if (req.method === "PUT") return "UpdateAdmChannel";
            if (req.method === "DELETE") return "DeleteAdmChannel";
          }
          if (ch === "apns") {
            if (req.method === "GET") return "GetApnsChannel";
            if (req.method === "PUT") return "UpdateApnsChannel";
            if (req.method === "DELETE") return "DeleteApnsChannel";
          }
          if (ch === "apns_sandbox") {
            if (req.method === "GET") return "GetApnsSandboxChannel";
            if (req.method === "PUT") return "UpdateApnsSandboxChannel";
            if (req.method === "DELETE") return "DeleteApnsSandboxChannel";
          }
          if (ch === "apns_voip") {
            if (req.method === "GET") return "GetApnsVoipChannel";
            if (req.method === "PUT") return "UpdateApnsVoipChannel";
            if (req.method === "DELETE") return "DeleteApnsVoipChannel";
          }
          if (ch === "apns_voip_sandbox") {
            if (req.method === "GET") return "GetApnsVoipSandboxChannel";
            if (req.method === "PUT") return "UpdateApnsVoipSandboxChannel";
            if (req.method === "DELETE") return "DeleteApnsVoipSandboxChannel";
          }
          if (ch === "baidu") {
            if (req.method === "GET") return "GetBaiduChannel";
            if (req.method === "PUT") return "UpdateBaiduChannel";
            if (req.method === "DELETE") return "DeleteBaiduChannel";
          }
          if (ch === "email") {
            if (req.method === "GET") return "GetEmailChannel";
            if (req.method === "PUT") return "UpdateEmailChannel";
            if (req.method === "DELETE") return "DeleteEmailChannel";
          }
          if (ch === "gcm") {
            if (req.method === "GET") return "GetGcmChannel";
            if (req.method === "PUT") return "UpdateGcmChannel";
            if (req.method === "DELETE") return "DeleteGcmChannel";
          }
          if (ch === "sms") {
            if (req.method === "GET") return "GetSmsChannel";
            if (req.method === "PUT") return "UpdateSmsChannel";
            if (req.method === "DELETE") return "DeleteSmsChannel";
          }
          if (ch === "voice") {
            if (req.method === "GET") return "GetVoiceChannel";
            if (req.method === "PUT") return "UpdateVoiceChannel";
            if (req.method === "DELETE") return "DeleteVoiceChannel";
          }
        }
        break;

      case "endpoints":
        if (parts.length === 4 && req.method === "PUT")
          return "UpdateEndpointsBatch";
        if (parts.length === 5) {
          if (req.method === "GET") return "GetEndpoint";
          if (req.method === "PUT") return "UpdateEndpoint";
          if (req.method === "DELETE") return "DeleteEndpoint";
        }
        if (
          parts.length === 6 &&
          parts[5] === "inappmessages" &&
          req.method === "GET"
        )
          return "GetInAppMessages";
        break;

      case "eventstream":
        if (parts.length === 4) {
          if (req.method === "GET") return "GetEventStream";
          if (req.method === "POST") return "PutEventStream";
          if (req.method === "DELETE") return "DeleteEventStream";
        }
        break;

      case "events":
        if (parts.length === 4 && req.method === "POST") return "PutEvents";
        break;

      case "jobs":
        if (parts[4] === "export") {
          if (parts.length === 5) {
            if (req.method === "POST") return "CreateExportJob";
            if (req.method === "GET") return "GetExportJobs";
          }
          if (parts.length === 6 && req.method === "GET") return "GetExportJob";
        }
        if (parts[4] === "import") {
          if (parts.length === 5) {
            if (req.method === "POST") return "CreateImportJob";
            if (req.method === "GET") return "GetImportJobs";
          }
          if (parts.length === 6 && req.method === "GET") return "GetImportJob";
        }
        break;

      case "journeys":
        if (parts.length === 4) {
          if (req.method === "POST") return "CreateJourney";
          if (req.method === "GET") return "ListJourneys";
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetJourney";
          if (req.method === "PUT") return "UpdateJourney";
          if (req.method === "DELETE") return "DeleteJourney";
        }
        if (parts.length === 6) {
          if (parts[5] === "execution-metrics" && req.method === "GET")
            return "GetJourneyExecutionMetrics";
          if (parts[5] === "runs" && req.method === "GET")
            return "GetJourneyRuns";
          if (parts[5] === "state" && req.method === "PUT")
            return "UpdateJourneyState";
        }
        if (parts.length === 8) {
          if (
            parts[5] === "kpis" &&
            parts[6] === "daterange" &&
            req.method === "GET"
          )
            return "GetJourneyDateRangeKpi";
          if (
            parts[5] === "activities" &&
            parts[7] === "execution-metrics" &&
            req.method === "GET"
          )
            return "GetJourneyExecutionActivityMetrics";
          if (
            parts[5] === "runs" &&
            parts[7] === "execution-metrics" &&
            req.method === "GET"
          )
            return "GetJourneyRunExecutionMetrics";
        }
        if (
          parts.length === 10 &&
          parts[5] === "runs" &&
          parts[7] === "activities" &&
          parts[9] === "execution-metrics" &&
          req.method === "GET"
        )
          return "GetJourneyRunExecutionActivityMetrics";
        break;

      case "kpis":
        if (
          parts.length === 6 &&
          parts[4] === "daterange" &&
          req.method === "GET"
        )
          return "GetApplicationDateRangeKpi";
        break;

      case "messages":
        if (parts.length === 4 && req.method === "POST") return "SendMessages";
        break;

      case "otp":
        if (parts.length === 4 && req.method === "POST")
          return "SendOTPMessage";
        break;

      case "segments":
        if (parts.length === 4) {
          if (req.method === "POST") return "CreateSegment";
          if (req.method === "GET") return "GetSegments";
        }
        if (parts.length === 5) {
          if (req.method === "GET") return "GetSegment";
          if (req.method === "PUT") return "UpdateSegment";
          if (req.method === "DELETE") return "DeleteSegment";
        }
        if (
          parts.length === 6 &&
          parts[5] === "versions" &&
          req.method === "GET"
        )
          return "GetSegmentVersions";
        if (parts.length === 7) {
          if (parts[5] === "versions" && req.method === "GET")
            return "GetSegmentVersion";
          if (
            parts[5] === "jobs" &&
            parts[6] === "export" &&
            req.method === "GET"
          )
            return "GetSegmentExportJobs";
          if (
            parts[5] === "jobs" &&
            parts[6] === "import" &&
            req.method === "GET"
          )
            return "GetSegmentImportJobs";
        }
        break;

      case "settings":
        if (parts.length === 4) {
          if (req.method === "GET") return "GetApplicationSettings";
          if (req.method === "PUT") return "UpdateApplicationSettings";
        }
        break;

      case "attributes":
        if (parts.length === 5 && req.method === "PUT")
          return "RemoveAttributes";
        break;

      case "users":
        if (parts.length === 5) {
          if (req.method === "GET") return "GetUserEndpoints";
          if (req.method === "DELETE") return "DeleteUserEndpoints";
        }
        break;

      case "users-messages":
        if (parts.length === 4 && req.method === "POST")
          return "SendUsersMessages";
        break;

      case "verify-otp":
        if (parts.length === 4 && req.method === "POST")
          return "VerifyOTPMessage";
        break;
    }

    return undefined;
  },
  operations: {
    CreateApp,
    GetApp,
    GetApps,
    DeleteApp,
    GetApplicationDateRangeKpi,
    GetApplicationSettings,
    UpdateApplicationSettings,
    CreateCampaign,
    GetCampaign,
    GetCampaigns,
    UpdateCampaign,
    DeleteCampaign,
    GetCampaignActivities,
    GetCampaignDateRangeKpi,
    GetCampaignVersion,
    GetCampaignVersions,
    GetChannels,
    GetAdmChannel,
    UpdateAdmChannel,
    DeleteAdmChannel,
    GetApnsChannel,
    UpdateApnsChannel,
    DeleteApnsChannel,
    GetApnsSandboxChannel,
    UpdateApnsSandboxChannel,
    DeleteApnsSandboxChannel,
    GetApnsVoipChannel,
    UpdateApnsVoipChannel,
    DeleteApnsVoipChannel,
    GetApnsVoipSandboxChannel,
    UpdateApnsVoipSandboxChannel,
    DeleteApnsVoipSandboxChannel,
    GetBaiduChannel,
    UpdateBaiduChannel,
    DeleteBaiduChannel,
    GetEmailChannel,
    UpdateEmailChannel,
    DeleteEmailChannel,
    GetGcmChannel,
    UpdateGcmChannel,
    DeleteGcmChannel,
    GetSmsChannel,
    UpdateSmsChannel,
    DeleteSmsChannel,
    GetVoiceChannel,
    UpdateVoiceChannel,
    DeleteVoiceChannel,
    GetEndpoint,
    UpdateEndpoint,
    UpdateEndpointsBatch,
    DeleteEndpoint,
    GetInAppMessages,
    GetUserEndpoints,
    DeleteUserEndpoints,
    GetEventStream,
    PutEventStream,
    DeleteEventStream,
    CreateExportJob,
    GetExportJob,
    GetExportJobs,
    CreateImportJob,
    GetImportJob,
    GetImportJobs,
    CreateJourney,
    GetJourney,
    ListJourneys,
    UpdateJourney,
    UpdateJourneyState,
    DeleteJourney,
    GetJourneyDateRangeKpi,
    GetJourneyExecutionActivityMetrics,
    GetJourneyExecutionMetrics,
    GetJourneyRunExecutionActivityMetrics,
    GetJourneyRunExecutionMetrics,
    GetJourneyRuns,
    CreateRecommenderConfiguration,
    GetRecommenderConfiguration,
    GetRecommenderConfigurations,
    UpdateRecommenderConfiguration,
    DeleteRecommenderConfiguration,
    CreateSegment,
    GetSegment,
    GetSegments,
    UpdateSegment,
    DeleteSegment,
    GetSegmentVersion,
    GetSegmentVersions,
    GetSegmentExportJobs,
    GetSegmentImportJobs,
    CreateEmailTemplate,
    GetEmailTemplate,
    UpdateEmailTemplate,
    DeleteEmailTemplate,
    CreateInAppTemplate,
    GetInAppTemplate,
    UpdateInAppTemplate,
    DeleteInAppTemplate,
    CreatePushTemplate,
    GetPushTemplate,
    UpdatePushTemplate,
    DeletePushTemplate,
    CreateSmsTemplate,
    GetSmsTemplate,
    UpdateSmsTemplate,
    DeleteSmsTemplate,
    CreateVoiceTemplate,
    GetVoiceTemplate,
    UpdateVoiceTemplate,
    DeleteVoiceTemplate,
    ListTemplates,
    ListTemplateVersions,
    UpdateTemplateActiveVersion,
    ListTagsForResource,
    TagResource,
    UntagResource,
    PhoneNumberValidate,
    PutEvents,
    RemoveAttributes,
    SendMessages,
    SendOTPMessage,
    SendUsersMessages,
    VerifyOTPMessage,
  },
  model,
} as const satisfies ServiceDefinition;

export default pinpoint;
