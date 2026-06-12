import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () =>
    import("../../models/pinpoint-sms-voice-v2.json", {
      with: { type: "json" },
    }),
  { targetPrefix: "PinpointSMSVoiceV2" },
);

const configurationSetPrefix = "configuration-set:" as const;
const phonePrefix = "phone:" as const;
const poolPrefix = "pool:" as const;
const optOutPrefix = "optout:" as const;
const optedOutPrefix = "opted-out:" as const;
const senderPrefix = "sender:" as const;
const keywordPrefix = "keyword:" as const;
const registrationPrefix = "registration:" as const;
const regVersionPrefix = "reg-version:" as const;
const regAttachmentPrefix = "reg-attachment:" as const;
const regAssocPrefix = "reg-assoc:" as const;
const regFieldPrefix = "reg-field:" as const;
const protectPrefix = "protect:" as const;
const protectRulePrefix = "protect-rule:" as const;
const protectOverridePrefix = "protect-override:" as const;
const rcsAgentPrefix = "rcs-agent:" as const;
const verifiedDestPrefix = "verified-dest:" as const;
const notifyPrefix = "notify:" as const;
const resourcePolicyPrefix = "resource-policy:" as const;
const tagsPrefix = "tags:" as const;
const poolOriginPrefix = "pool-origin:" as const;

type StoredConfigurationSet = {
  ConfigurationSetName: string;
  ConfigurationSetArn: string;
  EventDestinations: StoredEventDestination[];
  Tags: { Key: string; Value: string }[];
  DefaultMessageType?: string;
  DefaultSenderId?: string;
  ProtectConfigurationArn?: string;
  ProtectConfigurationId?: string;
  MessageFeedbackEnabled?: boolean;
  CreatedTimestamp: number;
};

type StoredEventDestination = {
  EventDestinationName: string;
  Enabled: boolean;
  MatchingEventTypes: string[];
  CloudWatchLogsDestination?: unknown;
  KinesisFirehoseDestination?: unknown;
  SnsDestination?: unknown;
};

type StoredPhoneNumber = {
  PhoneNumberArn: string;
  PhoneNumberId: string;
  PhoneNumber: string;
  Status: string;
  IsoCountryCode: string;
  MessageType: string;
  NumberCapabilities: string[];
  NumberType: string;
  MonthlyLeasingPrice: string;
  TwoWayEnabled: boolean;
  TwoWayChannelArn?: string;
  TwoWayChannelRole?: string;
  SelfManagedOptOutsEnabled: boolean;
  OptOutListName: string;
  InternationalSendingEnabled: boolean;
  DeletionProtectionEnabled: boolean;
  PoolId?: string;
  RegistrationId?: string;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredPool = {
  PoolArn: string;
  PoolId: string;
  Status: string;
  MessageType: string;
  TwoWayEnabled: boolean;
  TwoWayChannelArn?: string;
  TwoWayChannelRole?: string;
  SelfManagedOptOutsEnabled: boolean;
  OptOutListName: string;
  SharedRoutesEnabled: boolean;
  DeletionProtectionEnabled: boolean;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredOptOutList = {
  OptOutListArn: string;
  OptOutListName: string;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredOptedOutNumber = {
  OptedOutNumber: string;
  OptedOutTimestamp: number;
  EndUserOptedOut: boolean;
};

type StoredSenderId = {
  SenderIdArn: string;
  SenderId: string;
  IsoCountryCode: string;
  MessageTypes: string[];
  MonthlyLeasingPrice: string;
  DeletionProtectionEnabled: boolean;
  Registered: boolean;
  RegistrationId?: string;
  Tags: { Key: string; Value: string }[];
};

type StoredKeyword = {
  Keyword: string;
  KeywordMessage: string;
  KeywordAction: string;
  OriginationIdentityArn: string;
  OriginationIdentity: string;
};

type StoredRegistration = {
  RegistrationArn: string;
  RegistrationId: string;
  RegistrationType: string;
  RegistrationStatus: string;
  CurrentVersionNumber: number;
  ApprovedVersionNumber?: number;
  LatestDeniedVersionNumber?: number;
  AdditionalAttributes?: Record<string, string>;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredRegistrationVersion = {
  VersionNumber: number;
  RegistrationVersionStatus: string;
  RegistrationVersionStatusHistory: {
    DraftTimestamp: number;
    SubmittedTimestamp?: number;
    AwsReviewingTimestamp?: number;
    ReviewingTimestamp?: number;
    ApprovedTimestamp?: number;
    DiscardedTimestamp?: number;
    DeniedTimestamp?: number;
  };
  DeniedReasons?: unknown[];
  Feedback?: string;
  AwsReview?: boolean;
};

type StoredRegistrationAttachment = {
  RegistrationAttachmentArn: string;
  RegistrationAttachmentId: string;
  AttachmentStatus: string;
  AttachmentUploadErrorReason?: string;
  AttachmentBody?: string;
  AttachmentUrl?: string;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredRegistrationAssociation = {
  RegistrationArn: string;
  RegistrationId: string;
  RegistrationType: string;
  ResourceArn: string;
  ResourceId: string;
  ResourceType: string;
  IsoCountryCode?: string;
  PhoneNumber?: string;
};

type StoredRegistrationFieldValue = {
  FieldPath: string;
  SelectChoices?: string[];
  TextValue?: string;
  RegistrationAttachmentId?: string;
};

type StoredProtectConfiguration = {
  ProtectConfigurationArn: string;
  ProtectConfigurationId: string;
  CreatedTimestamp: number;
  AccountDefault: boolean;
  DeletionProtectionEnabled: boolean;
  Tags: { Key: string; Value: string }[];
};

type StoredProtectCountryRuleSet = {
  NumberCapability: string;
  CountryRuleSet: Record<string, { ProtectStatus: string }>;
};

type StoredProtectRuleOverride = {
  DestinationPhoneNumber: string;
  Action: string;
  IsoCountryCode?: string;
  ExpirationTimestamp?: number;
  CreatedTimestamp: number;
};

type StoredRcsAgent = {
  RcsAgentArn: string;
  RcsAgentId: string;
  Status: string;
  CreatedTimestamp: number;
  DeletionProtectionEnabled: boolean;
  OptOutListName?: string;
  SelfManagedOptOutsEnabled: boolean;
  TwoWayChannelArn?: string;
  TwoWayChannelRole?: string;
  TwoWayEnabled: boolean;
  PoolId?: string;
  TestingAgent?: boolean;
  Tags: { Key: string; Value: string }[];
};

type StoredVerifiedDestinationNumber = {
  VerifiedDestinationNumberArn: string;
  VerifiedDestinationNumberId: string;
  DestinationPhoneNumber: string;
  Status: string;
  RcsAgentId?: string;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredNotifyConfiguration = {
  NotifyConfigurationArn: string;
  NotifyConfigurationId: string;
  DisplayName: string;
  UseCase: string;
  DefaultTemplateId?: string;
  PoolId?: string;
  EnabledCountries?: string[];
  EnabledChannels: string[];
  Tier: string;
  TierUpgradeStatus: string;
  Status: string;
  RejectionReason?: string;
  DeletionProtectionEnabled: boolean;
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

type StoredResourcePolicy = {
  ResourceArn: string;
  Policy: string;
  CreatedTimestamp: number;
};

type StoredSpendLimitOverride = {
  MonthlyLimit: number;
};

type StoredDefaultProtectConfig = {
  ProtectConfigurationArn: string;
  ProtectConfigurationId: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const boolOrDefault = (value: unknown, def: boolean): boolean =>
  typeof value === "boolean" ? value : def;

const tagsFrom = (value: unknown): { Key: string; Value: string }[] => {
  if (!Array.isArray(value)) return [];
  const out: { Key: string; Value: string }[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const key = stringOrUndefined(record["Key"]);
    const tagValue = stringOrUndefined(record["Value"]);
    if (key !== undefined && tagValue !== undefined)
      out.push({ Key: key, Value: tagValue });
  }
  return out;
};

const strArrayFrom = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
};

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const paginate = <T>(
  items: T[],
  input: Record<string, unknown>,
): { page: T[]; NextToken: string | undefined } => {
  const maxResults = numberOrUndefined(input["MaxResults"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
  const offset = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const limit = maxResults ?? items.length;
  const page = items.slice(offset, offset + limit);
  const next =
    offset + limit < items.length ? btoa(String(offset + limit)) : undefined;
  return { page, NextToken: next };
};

type FilterSpec = { Name: string; Values: string[] };

const filterBySpec = <T>(
  items: T[],
  filtersRaw: unknown,
  fieldMap: Record<string, keyof T & string>,
): T[] => {
  if (!Array.isArray(filtersRaw) || filtersRaw.length === 0) return items;
  const filters: FilterSpec[] = [];
  for (const f of filtersRaw) {
    if (typeof f !== "object" || f === null) continue;
    const rec = f as Record<string, unknown>;
    const name = stringOrUndefined(rec["Name"]);
    const values = strArrayFrom(rec["Values"]);
    if (name && values.length > 0) filters.push({ Name: name, Values: values });
  }
  if (filters.length === 0) return items;
  return items.filter((item) =>
    filters.every((filter) => {
      const field = fieldMap[filter.Name];
      if (!field) return true;
      const itemValue = (item as Record<string, unknown>)[field];
      const strValue = typeof itemValue === "string" ? itemValue : undefined;
      return strValue !== undefined && filter.Values.includes(strValue);
    }),
  );
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

const nowSecs = (): number => Math.floor(Date.now() / 1000);

const uid = (): string =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const configurationSetKey = (name: string): string =>
  `${configurationSetPrefix}${name}`;

const configurationSetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:sms-voice:${ctx.region}:${ctx.account}:configuration-set/${name}`;

const nameFromArn = (value: string): string => {
  const marker = ":configuration-set/";
  const index = value.indexOf(marker);
  return index === -1 ? value : value.slice(index + marker.length);
};

const idFromArn = (value: string): string => {
  const parts = value.split("/");
  return parts[parts.length - 1] ?? value;
};

const configurationSetView = (
  set: StoredConfigurationSet,
): Record<string, unknown> => ({
  ConfigurationSetArn: set.ConfigurationSetArn,
  ConfigurationSetName: set.ConfigurationSetName,
  EventDestinations: set.EventDestinations,
  CreatedTimestamp: set.CreatedTimestamp,
});

const requireConfigurationSet = (
  ctx: ServiceContext,
  name: string,
): StoredConfigurationSet => {
  const stored = ctx.store.get<StoredConfigurationSet>(
    configurationSetKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Configuration set ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const requirePhoneNumber = (
  ctx: ServiceContext,
  idOrArn: string,
): StoredPhoneNumber => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredPhoneNumber>(`${phonePrefix}${id}`);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Phone number ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requirePool = (ctx: ServiceContext, idOrArn: string): StoredPool => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredPool>(`${poolPrefix}${id}`);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Pool ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireOptOutList = (
  ctx: ServiceContext,
  nameOrArn: string,
): StoredOptOutList => {
  const name = idFromArn(nameOrArn);
  const stored = ctx.store.get<StoredOptOutList>(`${optOutPrefix}${name}`);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `OptOutList ${nameOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireRegistration = (
  ctx: ServiceContext,
  idOrArn: string,
): StoredRegistration => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredRegistration>(
    `${registrationPrefix}${id}`,
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Registration ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireProtectConfiguration = (
  ctx: ServiceContext,
  idOrArn: string,
): StoredProtectConfiguration => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredProtectConfiguration>(
    `${protectPrefix}${id}`,
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Protect configuration ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireRcsAgent = (
  ctx: ServiceContext,
  idOrArn: string,
): StoredRcsAgent => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredRcsAgent>(`${rcsAgentPrefix}${id}`);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `RCS agent ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireVerifiedDestination = (
  ctx: ServiceContext,
  idOrArn: string,
): StoredVerifiedDestinationNumber => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredVerifiedDestinationNumber>(
    `${verifiedDestPrefix}${id}`,
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Verified destination number ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const requireNotifyConfiguration = (
  ctx: ServiceContext,
  idOrArn: string,
): StoredNotifyConfiguration => {
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredNotifyConfiguration>(
    `${notifyPrefix}${id}`,
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Notify configuration ${idOrArn} does not exist.`,
      404,
    );
  }
  return stored;
};

const phoneNumberView = (p: StoredPhoneNumber): Record<string, unknown> => ({
  PhoneNumberArn: p.PhoneNumberArn,
  PhoneNumberId: p.PhoneNumberId,
  PhoneNumber: p.PhoneNumber,
  Status: p.Status,
  IsoCountryCode: p.IsoCountryCode,
  MessageType: p.MessageType,
  NumberCapabilities: p.NumberCapabilities,
  NumberType: p.NumberType,
  MonthlyLeasingPrice: p.MonthlyLeasingPrice,
  TwoWayEnabled: p.TwoWayEnabled,
  TwoWayChannelArn: p.TwoWayChannelArn,
  TwoWayChannelRole: p.TwoWayChannelRole,
  SelfManagedOptOutsEnabled: p.SelfManagedOptOutsEnabled,
  OptOutListName: p.OptOutListName,
  InternationalSendingEnabled: p.InternationalSendingEnabled,
  DeletionProtectionEnabled: p.DeletionProtectionEnabled,
  PoolId: p.PoolId,
  RegistrationId: p.RegistrationId,
  CreatedTimestamp: p.CreatedTimestamp,
});

const poolView = (p: StoredPool): Record<string, unknown> => ({
  PoolArn: p.PoolArn,
  PoolId: p.PoolId,
  Status: p.Status,
  MessageType: p.MessageType,
  TwoWayEnabled: p.TwoWayEnabled,
  TwoWayChannelArn: p.TwoWayChannelArn,
  TwoWayChannelRole: p.TwoWayChannelRole,
  SelfManagedOptOutsEnabled: p.SelfManagedOptOutsEnabled,
  OptOutListName: p.OptOutListName,
  SharedRoutesEnabled: p.SharedRoutesEnabled,
  DeletionProtectionEnabled: p.DeletionProtectionEnabled,
  CreatedTimestamp: p.CreatedTimestamp,
});

const senderIdView = (s: StoredSenderId): Record<string, unknown> => ({
  SenderIdArn: s.SenderIdArn,
  SenderId: s.SenderId,
  IsoCountryCode: s.IsoCountryCode,
  MessageTypes: s.MessageTypes,
  MonthlyLeasingPrice: s.MonthlyLeasingPrice,
  DeletionProtectionEnabled: s.DeletionProtectionEnabled,
  Registered: s.Registered,
  RegistrationId: s.RegistrationId,
});

const registrationView = (r: StoredRegistration): Record<string, unknown> => ({
  RegistrationArn: r.RegistrationArn,
  RegistrationId: r.RegistrationId,
  RegistrationType: r.RegistrationType,
  RegistrationStatus: r.RegistrationStatus,
  CurrentVersionNumber: r.CurrentVersionNumber,
  ApprovedVersionNumber: r.ApprovedVersionNumber,
  LatestDeniedVersionNumber: r.LatestDeniedVersionNumber,
  AdditionalAttributes: r.AdditionalAttributes,
  CreatedTimestamp: r.CreatedTimestamp,
});

const protectConfigView = (
  p: StoredProtectConfiguration,
): Record<string, unknown> => ({
  ProtectConfigurationArn: p.ProtectConfigurationArn,
  ProtectConfigurationId: p.ProtectConfigurationId,
  CreatedTimestamp: p.CreatedTimestamp,
  AccountDefault: p.AccountDefault,
  DeletionProtectionEnabled: p.DeletionProtectionEnabled,
});

const rcsAgentView = (r: StoredRcsAgent): Record<string, unknown> => ({
  RcsAgentArn: r.RcsAgentArn,
  RcsAgentId: r.RcsAgentId,
  Status: r.Status,
  CreatedTimestamp: r.CreatedTimestamp,
  DeletionProtectionEnabled: r.DeletionProtectionEnabled,
  OptOutListName: r.OptOutListName,
  SelfManagedOptOutsEnabled: r.SelfManagedOptOutsEnabled,
  TwoWayChannelArn: r.TwoWayChannelArn,
  TwoWayChannelRole: r.TwoWayChannelRole,
  TwoWayEnabled: r.TwoWayEnabled,
  PoolId: r.PoolId,
  TestingAgent: r.TestingAgent,
});

const notifyConfigView = (
  n: StoredNotifyConfiguration,
): Record<string, unknown> => ({
  NotifyConfigurationArn: n.NotifyConfigurationArn,
  NotifyConfigurationId: n.NotifyConfigurationId,
  DisplayName: n.DisplayName,
  UseCase: n.UseCase,
  DefaultTemplateId: n.DefaultTemplateId,
  PoolId: n.PoolId,
  EnabledCountries: n.EnabledCountries,
  EnabledChannels: n.EnabledChannels,
  Tier: n.Tier,
  TierUpgradeStatus: n.TierUpgradeStatus,
  Status: n.Status,
  RejectionReason: n.RejectionReason,
  DeletionProtectionEnabled: n.DeletionProtectionEnabled,
  CreatedTimestamp: n.CreatedTimestamp,
});

const getTagsForArn = (
  ctx: ServiceContext,
  arn: string,
): { Key: string; Value: string }[] =>
  ctx.store.get<{ Key: string; Value: string }[]>(`${tagsPrefix}${arn}`) ?? [];

const setTagsForArn = (
  ctx: ServiceContext,
  arn: string,
  tags: { Key: string; Value: string }[],
): void => {
  ctx.store.set(`${tagsPrefix}${arn}`, tags);
};

const CreateConfigurationSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ConfigurationSetName");
  if (ctx.store.get<StoredConfigurationSet>(configurationSetKey(name))) {
    throw awsError(
      "ConflictException",
      `Configuration set ${name} already exists.`,
      409,
    );
  }
  const set: StoredConfigurationSet = {
    ConfigurationSetName: name,
    ConfigurationSetArn: configurationSetArn(ctx, name),
    EventDestinations: [],
    Tags: tagsFrom(input["Tags"]),
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(configurationSetKey(name), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    Tags: set.Tags,
    CreatedTimestamp: set.CreatedTimestamp,
  };
};

const DescribeConfigurationSets: OperationHandler = (input, ctx) => {
  const filter = input["ConfigurationSetNames"];
  const wanted = Array.isArray(filter)
    ? filter.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const sets = ctx.store
    .list<StoredConfigurationSet>()
    .filter((entry) => entry.key.startsWith(configurationSetPrefix))
    .map((entry) => entry.value)
    .filter(
      (set) =>
        wanted === undefined ||
        wanted.some(
          (name) =>
            name === set.ConfigurationSetName ||
            nameFromArn(name) === set.ConfigurationSetName,
        ),
    )
    .sort((a, b) =>
      a.ConfigurationSetName.localeCompare(b.ConfigurationSetName),
    );
  return { ConfigurationSets: sets.map(configurationSetView) };
};

const DeleteConfigurationSet: OperationHandler = (input, ctx) => {
  const name = nameFromArn(requireString(input, "ConfigurationSetName"));
  const set = requireConfigurationSet(ctx, name);
  ctx.store.delete(configurationSetKey(name));
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    EventDestinations: set.EventDestinations,
    CreatedTimestamp: set.CreatedTimestamp,
  };
};

const CreateEventDestination: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const destName = requireString(input, "EventDestinationName");
  const set = requireConfigurationSet(ctx, configSetName);
  if (set.EventDestinations.some((d) => d.EventDestinationName === destName)) {
    throw awsError(
      "ConflictException",
      `Event destination ${destName} already exists.`,
      409,
    );
  }
  const dest: StoredEventDestination = {
    EventDestinationName: destName,
    Enabled: boolOrDefault(input["Enabled"], true),
    MatchingEventTypes: strArrayFrom(input["MatchingEventTypes"]),
    CloudWatchLogsDestination: input["CloudWatchLogsDestination"],
    KinesisFirehoseDestination: input["KinesisFirehoseDestination"],
    SnsDestination: input["SnsDestination"],
  };
  set.EventDestinations.push(dest);
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    EventDestination: dest,
  };
};

const UpdateEventDestination: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const destName = requireString(input, "EventDestinationName");
  const set = requireConfigurationSet(ctx, configSetName);
  const idx = set.EventDestinations.findIndex(
    (d) => d.EventDestinationName === destName,
  );
  if (idx === -1) {
    throw awsError(
      "ResourceNotFoundException",
      `Event destination ${destName} does not exist.`,
      404,
    );
  }
  const existing = set.EventDestinations[idx]!;
  const updated: StoredEventDestination = {
    ...existing,
    Enabled:
      typeof input["Enabled"] === "boolean"
        ? input["Enabled"]
        : existing.Enabled,
    MatchingEventTypes: Array.isArray(input["MatchingEventTypes"])
      ? strArrayFrom(input["MatchingEventTypes"])
      : existing.MatchingEventTypes,
    CloudWatchLogsDestination:
      input["CloudWatchLogsDestination"] ?? existing.CloudWatchLogsDestination,
    KinesisFirehoseDestination:
      input["KinesisFirehoseDestination"] ??
      existing.KinesisFirehoseDestination,
    SnsDestination: input["SnsDestination"] ?? existing.SnsDestination,
  };
  set.EventDestinations[idx] = updated;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    EventDestination: updated,
  };
};

const DeleteEventDestination: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const destName = requireString(input, "EventDestinationName");
  const set = requireConfigurationSet(ctx, configSetName);
  const idx = set.EventDestinations.findIndex(
    (d) => d.EventDestinationName === destName,
  );
  if (idx === -1) {
    throw awsError(
      "ResourceNotFoundException",
      `Event destination ${destName} does not exist.`,
      404,
    );
  }
  const [removed] = set.EventDestinations.splice(idx, 1);
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    EventDestination: removed,
  };
};

const SetDefaultMessageType: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const messageType = requireString(input, "MessageType");
  const set = requireConfigurationSet(ctx, configSetName);
  set.DefaultMessageType = messageType;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    MessageType: messageType,
  };
};

const DeleteDefaultMessageType: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const set = requireConfigurationSet(ctx, configSetName);
  const messageType = set.DefaultMessageType;
  delete set.DefaultMessageType;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    MessageType: messageType,
  };
};

const SetDefaultSenderId: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const senderId = requireString(input, "SenderId");
  const set = requireConfigurationSet(ctx, configSetName);
  set.DefaultSenderId = senderId;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    SenderId: senderId,
  };
};

const DeleteDefaultSenderId: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const set = requireConfigurationSet(ctx, configSetName);
  const senderId = set.DefaultSenderId;
  delete set.DefaultSenderId;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    SenderId: senderId,
  };
};

const SetDefaultMessageFeedbackEnabled: OperationHandler = (input, ctx) => {
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const enabled =
    typeof input["MessageFeedbackEnabled"] === "boolean"
      ? input["MessageFeedbackEnabled"]
      : false;
  const set = requireConfigurationSet(ctx, configSetName);
  set.MessageFeedbackEnabled = enabled;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    MessageFeedbackEnabled: enabled,
  };
};

const AssociateProtectConfiguration: OperationHandler = (input, ctx) => {
  const protectIdOrArn = requireString(input, "ProtectConfigurationId");
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const protect = requireProtectConfiguration(ctx, protectIdOrArn);
  const set = requireConfigurationSet(ctx, configSetName);
  set.ProtectConfigurationArn = protect.ProtectConfigurationArn;
  set.ProtectConfigurationId = protect.ProtectConfigurationId;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    ProtectConfigurationArn: protect.ProtectConfigurationArn,
    ProtectConfigurationId: protect.ProtectConfigurationId,
  };
};

const DisassociateProtectConfiguration: OperationHandler = (input, ctx) => {
  const protectIdOrArn = requireString(input, "ProtectConfigurationId");
  const configSetName = nameFromArn(
    requireString(input, "ConfigurationSetName"),
  );
  const protect = requireProtectConfiguration(ctx, protectIdOrArn);
  const set = requireConfigurationSet(ctx, configSetName);
  delete set.ProtectConfigurationArn;
  delete set.ProtectConfigurationId;
  ctx.store.set(configurationSetKey(configSetName), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    ProtectConfigurationArn: protect.ProtectConfigurationArn,
    ProtectConfigurationId: protect.ProtectConfigurationId,
  };
};

const RequestPhoneNumber: OperationHandler = (input, ctx) => {
  const isoCountryCode = requireString(input, "IsoCountryCode");
  const messageType = requireString(input, "MessageType");
  const numberCapabilities = strArrayFrom(input["NumberCapabilities"]);
  const numberType = requireString(input, "NumberType");
  const id = `phone-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${id}`;
  const phoneNumber = `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredPhoneNumber = {
    PhoneNumberArn: arn,
    PhoneNumberId: id,
    PhoneNumber: phoneNumber,
    Status: "ACTIVE",
    IsoCountryCode: isoCountryCode,
    MessageType: messageType,
    NumberCapabilities: numberCapabilities,
    NumberType: numberType,
    MonthlyLeasingPrice: "1.00",
    TwoWayEnabled: false,
    SelfManagedOptOutsEnabled: false,
    OptOutListName: stringOrUndefined(input["OptOutListName"]) ?? "Default",
    InternationalSendingEnabled: boolOrDefault(
      input["InternationalSendingEnabled"],
      false,
    ),
    DeletionProtectionEnabled: boolOrDefault(
      input["DeletionProtectionEnabled"],
      false,
    ),
    PoolId: stringOrUndefined(input["PoolId"]),
    RegistrationId: stringOrUndefined(input["RegistrationId"]),
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${phonePrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    ...phoneNumberView(stored),
    Status: "PENDING",
    Tags: tags,
  };
};

const DescribePhoneNumbers: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["PhoneNumberIds"]);
  const all = ctx.store
    .list<StoredPhoneNumber>()
    .filter((e) => e.key.startsWith(phonePrefix))
    .map((e) => e.value);
  const byId =
    ids.length > 0
      ? all.filter((p) =>
          ids.some((id) => id === p.PhoneNumberId || id === p.PhoneNumberArn),
        )
      : all;
  const filtered = filterBySpec(byId, input["Filters"], {
    status: "Status",
    "number-type": "NumberType",
    "iso-country-code": "IsoCountryCode",
    "message-type": "MessageType",
  });
  const { page, NextToken } = paginate(filtered, input);
  return { PhoneNumbers: page.map(phoneNumberView), NextToken };
};

const UpdatePhoneNumber: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "PhoneNumberId");
  const stored = requirePhoneNumber(ctx, idOrArn);
  if (typeof input["TwoWayEnabled"] === "boolean")
    stored.TwoWayEnabled = input["TwoWayEnabled"];
  if (stringOrUndefined(input["TwoWayChannelArn"]))
    stored.TwoWayChannelArn = stringOrUndefined(input["TwoWayChannelArn"]);
  if (stringOrUndefined(input["TwoWayChannelRole"]))
    stored.TwoWayChannelRole = stringOrUndefined(input["TwoWayChannelRole"]);
  if (typeof input["SelfManagedOptOutsEnabled"] === "boolean")
    stored.SelfManagedOptOutsEnabled = input["SelfManagedOptOutsEnabled"];
  if (stringOrUndefined(input["OptOutListName"]))
    stored.OptOutListName = stringOrUndefined(input["OptOutListName"])!;
  if (typeof input["InternationalSendingEnabled"] === "boolean")
    stored.InternationalSendingEnabled = input["InternationalSendingEnabled"];
  if (typeof input["DeletionProtectionEnabled"] === "boolean")
    stored.DeletionProtectionEnabled = input["DeletionProtectionEnabled"];
  ctx.store.set(`${phonePrefix}${stored.PhoneNumberId}`, stored);
  return phoneNumberView(stored);
};

const ReleasePhoneNumber: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "PhoneNumberId");
  const stored = requirePhoneNumber(ctx, idOrArn);
  if (stored.DeletionProtectionEnabled) {
    throw awsError(
      "ConflictException",
      `Phone number ${idOrArn} has deletion protection enabled.`,
      409,
    );
  }
  if (stored.PoolId !== undefined) {
    throw awsError(
      "ConflictException",
      `Phone number ${idOrArn} is associated with pool ${stored.PoolId}. Disassociate it first.`,
      409,
    );
  }
  ctx.store.delete(`${phonePrefix}${stored.PhoneNumberId}`);
  return phoneNumberView(stored);
};

const CreatePool: OperationHandler = (input, ctx) => {
  const originationIdentity = requireString(input, "OriginationIdentity");
  const messageType = requireString(input, "MessageType");
  const id = `pool-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:pool/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredPool = {
    PoolArn: arn,
    PoolId: id,
    Status: "ACTIVE",
    MessageType: messageType,
    TwoWayEnabled: false,
    SelfManagedOptOutsEnabled: false,
    OptOutListName: "Default",
    SharedRoutesEnabled: false,
    DeletionProtectionEnabled: boolOrDefault(
      input["DeletionProtectionEnabled"],
      false,
    ),
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${poolPrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  if (originationIdentity) {
    const originId = idFromArn(originationIdentity);
    const originArn = originationIdentity.startsWith("arn:")
      ? originationIdentity
      : `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${originId}`;
    const originMeta = {
      OriginationIdentityArn: originArn,
      OriginationIdentity: originId,
      IsoCountryCode: stringOrUndefined(input["IsoCountryCode"]) ?? "US",
      NumberCapabilities: ["SMS"] as string[],
    };
    ctx.store.set(`${poolOriginPrefix}${id}:${originId}`, originMeta);
  }
  return {
    ...poolView(stored),
    Status: "CREATING",
    Tags: tags,
  };
};

const DescribePools: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["PoolIds"]);
  const all = ctx.store
    .list<StoredPool>()
    .filter((e) => e.key.startsWith(poolPrefix))
    .map((e) => e.value);
  const byId =
    ids.length > 0
      ? all.filter((p) => ids.some((id) => id === p.PoolId || id === p.PoolArn))
      : all;
  const filtered = filterBySpec(byId, input["Filters"], {
    status: "Status",
    "message-type": "MessageType",
  });
  const { page, NextToken } = paginate(filtered, input);
  return { Pools: page.map(poolView), NextToken };
};

const UpdatePool: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "PoolId");
  const stored = requirePool(ctx, idOrArn);
  if (typeof input["TwoWayEnabled"] === "boolean")
    stored.TwoWayEnabled = input["TwoWayEnabled"];
  if (stringOrUndefined(input["TwoWayChannelArn"]))
    stored.TwoWayChannelArn = stringOrUndefined(input["TwoWayChannelArn"]);
  if (stringOrUndefined(input["TwoWayChannelRole"]))
    stored.TwoWayChannelRole = stringOrUndefined(input["TwoWayChannelRole"]);
  if (typeof input["SelfManagedOptOutsEnabled"] === "boolean")
    stored.SelfManagedOptOutsEnabled = input["SelfManagedOptOutsEnabled"];
  if (stringOrUndefined(input["OptOutListName"]))
    stored.OptOutListName = stringOrUndefined(input["OptOutListName"])!;
  if (typeof input["SharedRoutesEnabled"] === "boolean")
    stored.SharedRoutesEnabled = input["SharedRoutesEnabled"];
  if (typeof input["DeletionProtectionEnabled"] === "boolean")
    stored.DeletionProtectionEnabled = input["DeletionProtectionEnabled"];
  ctx.store.set(`${poolPrefix}${stored.PoolId}`, stored);
  return poolView(stored);
};

const DeletePool: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "PoolId");
  const stored = requirePool(ctx, idOrArn);
  if (stored.DeletionProtectionEnabled) {
    throw awsError(
      "ConflictException",
      `Pool ${idOrArn} has deletion protection enabled.`,
      409,
    );
  }
  const originPrefix = `${poolOriginPrefix}${stored.PoolId}:`;
  const hasOrigins = ctx.store
    .list<unknown>()
    .some((e) => e.key.startsWith(originPrefix));
  if (hasOrigins) {
    throw awsError(
      "ConflictException",
      `Pool ${idOrArn} still has origination identities associated. Disassociate them first.`,
      409,
    );
  }
  ctx.store.delete(`${poolPrefix}${stored.PoolId}`);
  return poolView(stored);
};

const AssociateOriginationIdentity: OperationHandler = (input, ctx) => {
  const poolIdOrArn = requireString(input, "PoolId");
  const originationIdentity = requireString(input, "OriginationIdentity");
  const pool = requirePool(ctx, poolIdOrArn);
  const originId = idFromArn(originationIdentity);
  const phoneStored = ctx.store.get<StoredPhoneNumber>(
    `${phonePrefix}${originId}`,
  );
  const senderStored = ctx.store
    .list<StoredSenderId>()
    .find(
      (e) =>
        e.key.startsWith(senderPrefix) &&
        (e.value.SenderId === originId ||
          e.value.SenderIdArn === originationIdentity),
    );
  if (!phoneStored && !senderStored) {
    throw awsError(
      "ResourceNotFoundException",
      `Origination identity ${originationIdentity} does not exist.`,
      404,
    );
  }
  const originArn = originationIdentity.startsWith("arn:")
    ? originationIdentity
    : `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${originId}`;
  const isoCountryCode = stringOrUndefined(input["IsoCountryCode"]) ?? "US";
  const originMeta = {
    OriginationIdentityArn: originArn,
    OriginationIdentity: originId,
    IsoCountryCode: isoCountryCode,
    NumberCapabilities: ["SMS"] as string[],
  };
  ctx.store.set(`${poolOriginPrefix}${pool.PoolId}:${originId}`, originMeta);
  return {
    PoolArn: pool.PoolArn,
    PoolId: pool.PoolId,
    OriginationIdentityArn: originArn,
    OriginationIdentity: originId,
    IsoCountryCode: isoCountryCode,
  };
};

const DisassociateOriginationIdentity: OperationHandler = (input, ctx) => {
  const poolIdOrArn = requireString(input, "PoolId");
  const originationIdentity = requireString(input, "OriginationIdentity");
  const pool = requirePool(ctx, poolIdOrArn);
  const originId = idFromArn(originationIdentity);
  const originArn = originationIdentity.startsWith("arn:")
    ? originationIdentity
    : `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${originId}`;
  const isoCountryCode = stringOrUndefined(input["IsoCountryCode"]) ?? "US";
  ctx.store.delete(`${poolOriginPrefix}${pool.PoolId}:${originId}`);
  return {
    PoolArn: pool.PoolArn,
    PoolId: pool.PoolId,
    OriginationIdentityArn: originArn,
    OriginationIdentity: originId,
    IsoCountryCode: isoCountryCode,
  };
};

const ListPoolOriginationIdentities: OperationHandler = (input, ctx) => {
  const poolIdOrArn = requireString(input, "PoolId");
  const pool = requirePool(ctx, poolIdOrArn);
  const prefix = `${poolOriginPrefix}${pool.PoolId}:`;
  const origins = ctx.store
    .list<unknown>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    PoolArn: pool.PoolArn,
    PoolId: pool.PoolId,
    OriginationIdentities: origins,
  };
};

const CreateOptOutList: OperationHandler = (input, ctx) => {
  const name = requireString(input, "OptOutListName");
  if (ctx.store.get<StoredOptOutList>(`${optOutPrefix}${name}`)) {
    throw awsError(
      "ConflictException",
      `OptOutList ${name} already exists.`,
      409,
    );
  }
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:opt-out-list/${name}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredOptOutList = {
    OptOutListArn: arn,
    OptOutListName: name,
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${optOutPrefix}${name}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    OptOutListArn: stored.OptOutListArn,
    OptOutListName: stored.OptOutListName,
    Tags: tags,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const DescribeOptOutLists: OperationHandler = (input, ctx) => {
  const names = strArrayFrom(input["OptOutListNames"]);
  const all = ctx.store
    .list<StoredOptOutList>()
    .filter((e) => e.key.startsWith(optOutPrefix))
    .map((e) => e.value);
  const filtered =
    names.length > 0
      ? all.filter((o) =>
          names.some(
            (n) => n === o.OptOutListName || idFromArn(n) === o.OptOutListName,
          ),
        )
      : all;
  return {
    OptOutLists: filtered.map((o) => ({
      OptOutListArn: o.OptOutListArn,
      OptOutListName: o.OptOutListName,
      CreatedTimestamp: o.CreatedTimestamp,
    })),
  };
};

const DeleteOptOutList: OperationHandler = (input, ctx) => {
  const nameOrArn = requireString(input, "OptOutListName");
  const stored = requireOptOutList(ctx, nameOrArn);
  ctx.store.delete(`${optOutPrefix}${stored.OptOutListName}`);
  return {
    OptOutListArn: stored.OptOutListArn,
    OptOutListName: stored.OptOutListName,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const PutOptedOutNumber: OperationHandler = (input, ctx) => {
  const listNameOrArn = requireString(input, "OptOutListName");
  const number = requireString(input, "OptedOutNumber");
  const list = requireOptOutList(ctx, listNameOrArn);
  const now = nowSecs();
  const stored: StoredOptedOutNumber = {
    OptedOutNumber: number,
    OptedOutTimestamp: now,
    EndUserOptedOut: false,
  };
  ctx.store.set(`${optedOutPrefix}${list.OptOutListName}:${number}`, stored);
  return {
    OptOutListArn: list.OptOutListArn,
    OptOutListName: list.OptOutListName,
    OptedOutNumber: number,
    OptedOutTimestamp: now,
    EndUserOptedOut: false,
  };
};

const DeleteOptedOutNumber: OperationHandler = (input, ctx) => {
  const listNameOrArn = requireString(input, "OptOutListName");
  const number = requireString(input, "OptedOutNumber");
  const list = requireOptOutList(ctx, listNameOrArn);
  const key = `${optedOutPrefix}${list.OptOutListName}:${number}`;
  const stored = ctx.store.get<StoredOptedOutNumber>(key);
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Opted-out number ${number} does not exist.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {
    OptOutListArn: list.OptOutListArn,
    OptOutListName: list.OptOutListName,
    OptedOutNumber: stored.OptedOutNumber,
    OptedOutTimestamp: stored.OptedOutTimestamp,
    EndUserOptedOut: stored.EndUserOptedOut,
  };
};

const DescribeOptedOutNumbers: OperationHandler = (input, ctx) => {
  const listNameOrArn = requireString(input, "OptOutListName");
  const list = requireOptOutList(ctx, listNameOrArn);
  const prefix = `${optedOutPrefix}${list.OptOutListName}:`;
  const numbers = ctx.store
    .list<StoredOptedOutNumber>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    OptOutListArn: list.OptOutListArn,
    OptOutListName: list.OptOutListName,
    OptedOutNumbers: numbers,
  };
};

const RequestSenderId: OperationHandler = (input, ctx) => {
  const senderId = requireString(input, "SenderId");
  const isoCountryCode = requireString(input, "IsoCountryCode");
  const key = `${senderPrefix}${senderId}:${isoCountryCode}`;
  if (ctx.store.get<StoredSenderId>(key)) {
    throw awsError(
      "ConflictException",
      `Sender ID ${senderId} already exists for ${isoCountryCode}.`,
      409,
    );
  }
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:sender-id/${senderId}/${isoCountryCode}`;
  const messageTypes = strArrayFrom(input["MessageTypes"]);
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredSenderId = {
    SenderIdArn: arn,
    SenderId: senderId,
    IsoCountryCode: isoCountryCode,
    MessageTypes: messageTypes.length > 0 ? messageTypes : ["TRANSACTIONAL"],
    MonthlyLeasingPrice: "1.00",
    DeletionProtectionEnabled: boolOrDefault(
      input["DeletionProtectionEnabled"],
      false,
    ),
    Registered: false,
    Tags: tags,
  };
  ctx.store.set(key, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    ...senderIdView(stored),
    Tags: tags,
  };
};

const DescribeSenderIds: OperationHandler = (input, ctx) => {
  const senderIdList = Array.isArray(input["SenderIds"])
    ? input["SenderIds"]
    : [];
  const all = ctx.store
    .list<StoredSenderId>()
    .filter((e) => e.key.startsWith(senderPrefix))
    .map((e) => e.value);
  if (senderIdList.length === 0) {
    return { SenderIds: all.map(senderIdView) };
  }
  const filtered = all.filter((s) =>
    senderIdList.some((item: unknown) => {
      if (typeof item !== "object" || item === null) return false;
      const rec = item as Record<string, unknown>;
      const sid = stringOrUndefined(rec["SenderId"]);
      const iso = stringOrUndefined(rec["IsoCountryCode"]);
      return sid === s.SenderId && iso === s.IsoCountryCode;
    }),
  );
  return { SenderIds: filtered.map(senderIdView) };
};

const UpdateSenderId: OperationHandler = (input, ctx) => {
  const senderIdOrArn = requireString(input, "SenderId");
  const isoCountryCode = requireString(input, "IsoCountryCode");
  const senderId = idFromArn(senderIdOrArn).split("/")[0] ?? senderIdOrArn;
  const key = `${senderPrefix}${senderId}:${isoCountryCode}`;
  const stored = ctx.store.get<StoredSenderId>(key);
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Sender ID ${senderIdOrArn} does not exist.`,
      404,
    );
  }
  if (typeof input["DeletionProtectionEnabled"] === "boolean") {
    stored.DeletionProtectionEnabled = input["DeletionProtectionEnabled"];
  }
  ctx.store.set(key, stored);
  return senderIdView(stored);
};

const ReleaseSenderId: OperationHandler = (input, ctx) => {
  const senderIdOrArn = requireString(input, "SenderId");
  const isoCountryCode = requireString(input, "IsoCountryCode");
  const senderId = idFromArn(senderIdOrArn).split("/")[0] ?? senderIdOrArn;
  const key = `${senderPrefix}${senderId}:${isoCountryCode}`;
  const stored = ctx.store.get<StoredSenderId>(key);
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Sender ID ${senderIdOrArn} does not exist.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {
    SenderIdArn: stored.SenderIdArn,
    SenderId: stored.SenderId,
    IsoCountryCode: stored.IsoCountryCode,
    MessageTypes: stored.MessageTypes,
    MonthlyLeasingPrice: stored.MonthlyLeasingPrice,
    Registered: stored.Registered,
    RegistrationId: stored.RegistrationId,
  };
};

const PutKeyword: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "OriginationIdentity");
  const keyword = requireString(input, "Keyword");
  const keywordMessage = requireString(input, "KeywordMessage");
  const keywordAction =
    stringOrUndefined(input["KeywordAction"]) ?? "AUTOMATIC_RESPONSE";
  const identityId = idFromArn(identity);
  const identityArn = identity.startsWith("arn:")
    ? identity
    : `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${identityId}`;
  const stored: StoredKeyword = {
    Keyword: keyword,
    KeywordMessage: keywordMessage,
    KeywordAction: keywordAction,
    OriginationIdentityArn: identityArn,
    OriginationIdentity: identityId,
  };
  ctx.store.set(`${keywordPrefix}${identityId}:${keyword}`, stored);
  return {
    OriginationIdentityArn: identityArn,
    OriginationIdentity: identityId,
    Keyword: keyword,
    KeywordMessage: keywordMessage,
    KeywordAction: keywordAction,
  };
};

const DeleteKeyword: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "OriginationIdentity");
  const keyword = requireString(input, "Keyword");
  const identityId = idFromArn(identity);
  const key = `${keywordPrefix}${identityId}:${keyword}`;
  const stored = ctx.store.get<StoredKeyword>(key);
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Keyword ${keyword} does not exist.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {
    OriginationIdentityArn: stored.OriginationIdentityArn,
    OriginationIdentity: stored.OriginationIdentity,
    Keyword: stored.Keyword,
    KeywordMessage: stored.KeywordMessage,
    KeywordAction: stored.KeywordAction,
  };
};

const DescribeKeywords: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "OriginationIdentity");
  const identityId = idFromArn(identity);
  const identityArn = identity.startsWith("arn:")
    ? identity
    : `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${identityId}`;
  const prefix = `${keywordPrefix}${identityId}:`;
  const keywords = ctx.store
    .list<StoredKeyword>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      Keyword: e.value.Keyword,
      KeywordMessage: e.value.KeywordMessage,
      KeywordAction: e.value.KeywordAction,
    }));
  return {
    OriginationIdentityArn: identityArn,
    OriginationIdentity: identityId,
    Keywords: keywords,
  };
};

const CreateRegistration: OperationHandler = (input, ctx) => {
  const registrationType = requireString(input, "RegistrationType");
  const id = `registration-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:registration/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredRegistration = {
    RegistrationArn: arn,
    RegistrationId: id,
    RegistrationType: registrationType,
    RegistrationStatus: "CREATED",
    CurrentVersionNumber: 1,
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${registrationPrefix}${id}`, stored);
  const versionStored: StoredRegistrationVersion = {
    VersionNumber: 1,
    RegistrationVersionStatus: "DRAFT",
    RegistrationVersionStatusHistory: {
      DraftTimestamp: nowSecs(),
    },
  };
  ctx.store.set(`${regVersionPrefix}${id}:1`, versionStored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    ...registrationView(stored),
    Tags: tags,
  };
};

const DescribeRegistrations: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["RegistrationIds"]);
  const all = ctx.store
    .list<StoredRegistration>()
    .filter((e) => e.key.startsWith(registrationPrefix))
    .map((e) => e.value);
  const filtered =
    ids.length > 0
      ? all.filter((r) =>
          ids.some((id) => id === r.RegistrationId || id === r.RegistrationArn),
        )
      : all;
  return { Registrations: filtered.map(registrationView) };
};

const DeleteRegistration: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  ctx.store.delete(`${registrationPrefix}${stored.RegistrationId}`);
  return registrationView(stored);
};

const CreateRegistrationVersion: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  const newVersion = stored.CurrentVersionNumber + 1;
  stored.CurrentVersionNumber = newVersion;
  ctx.store.set(`${registrationPrefix}${stored.RegistrationId}`, stored);
  const versionStored: StoredRegistrationVersion = {
    VersionNumber: newVersion,
    RegistrationVersionStatus: "DRAFT",
    RegistrationVersionStatusHistory: {
      DraftTimestamp: nowSecs(),
    },
  };
  ctx.store.set(
    `${regVersionPrefix}${stored.RegistrationId}:${newVersion}`,
    versionStored,
  );
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    VersionNumber: newVersion,
    RegistrationVersionStatus: "DRAFT",
    RegistrationVersionStatusHistory:
      versionStored.RegistrationVersionStatusHistory,
  };
};

const DescribeRegistrationVersions: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  const prefix = `${regVersionPrefix}${stored.RegistrationId}:`;
  const versions = ctx.store
    .list<StoredRegistrationVersion>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.VersionNumber - b.VersionNumber);
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    RegistrationVersions: versions,
  };
};

const SubmitRegistrationVersion: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  const versionKey = `${regVersionPrefix}${stored.RegistrationId}:${stored.CurrentVersionNumber}`;
  const version = ctx.store.get<StoredRegistrationVersion>(versionKey);
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `Registration version not found.`,
      404,
    );
  }
  const awsReview = boolOrDefault(input["AwsReview"], false);
  version.RegistrationVersionStatus = "SUBMITTED";
  version.RegistrationVersionStatusHistory.SubmittedTimestamp = nowSecs();
  version.AwsReview = awsReview;
  stored.RegistrationStatus = "SUBMITTED";
  ctx.store.set(versionKey, version);
  ctx.store.set(`${registrationPrefix}${stored.RegistrationId}`, stored);
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    VersionNumber: version.VersionNumber,
    RegistrationVersionStatus: version.RegistrationVersionStatus,
    RegistrationVersionStatusHistory: version.RegistrationVersionStatusHistory,
    AwsReview: awsReview,
  };
};

const DiscardRegistrationVersion: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  const versionKey = `${regVersionPrefix}${stored.RegistrationId}:${stored.CurrentVersionNumber}`;
  const version = ctx.store.get<StoredRegistrationVersion>(versionKey);
  if (!version) {
    throw awsError(
      "ResourceNotFoundException",
      `Registration version not found.`,
      404,
    );
  }
  version.RegistrationVersionStatus = "DISCARDED";
  version.RegistrationVersionStatusHistory.DiscardedTimestamp = nowSecs();
  ctx.store.set(versionKey, version);
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    VersionNumber: version.VersionNumber,
    RegistrationVersionStatus: version.RegistrationVersionStatus,
    RegistrationVersionStatusHistory: version.RegistrationVersionStatusHistory,
  };
};

const CreateRegistrationAssociation: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const resourceIdOrArn = requireString(input, "ResourceId");
  const stored = requireRegistration(ctx, idOrArn);
  const resourceId = idFromArn(resourceIdOrArn);
  const resourceArn = resourceIdOrArn.startsWith("arn:")
    ? resourceIdOrArn
    : `arn:aws:sms-voice:${ctx.region}:${ctx.account}:phone-number/${resourceId}`;
  const assoc: StoredRegistrationAssociation = {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    RegistrationType: stored.RegistrationType,
    ResourceArn: resourceArn,
    ResourceId: resourceId,
    ResourceType: "PhoneNumber",
  };
  ctx.store.set(
    `${regAssocPrefix}${stored.RegistrationId}:${resourceId}`,
    assoc,
  );
  return {
    RegistrationArn: assoc.RegistrationArn,
    RegistrationId: assoc.RegistrationId,
    RegistrationType: assoc.RegistrationType,
    ResourceArn: assoc.ResourceArn,
    ResourceId: assoc.ResourceId,
    ResourceType: assoc.ResourceType,
    IsoCountryCode: assoc.IsoCountryCode,
    PhoneNumber: assoc.PhoneNumber,
  };
};

const ListRegistrationAssociations: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  const prefix = `${regAssocPrefix}${stored.RegistrationId}:`;
  const associations = ctx.store
    .list<StoredRegistrationAssociation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      ResourceArn: e.value.ResourceArn,
      ResourceId: e.value.ResourceId,
      ResourceType: e.value.ResourceType,
      IsoCountryCode: e.value.IsoCountryCode,
      PhoneNumber: e.value.PhoneNumber,
    }));
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    RegistrationType: stored.RegistrationType,
    RegistrationAssociations: associations,
  };
};

const PutRegistrationFieldValue: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const fieldPath = requireString(input, "FieldPath");
  const stored = requireRegistration(ctx, idOrArn);
  const fieldValue: StoredRegistrationFieldValue = {
    FieldPath: fieldPath,
    SelectChoices: strArrayFrom(input["SelectChoices"]),
    TextValue: stringOrUndefined(input["TextValue"]),
    RegistrationAttachmentId: stringOrUndefined(
      input["RegistrationAttachmentId"],
    ),
  };
  ctx.store.set(
    `${regFieldPrefix}${stored.RegistrationId}:${fieldPath}`,
    fieldValue,
  );
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    VersionNumber: stored.CurrentVersionNumber,
    FieldPath: fieldPath,
    SelectChoices: fieldValue.SelectChoices,
    TextValue: fieldValue.TextValue,
    RegistrationAttachmentId: fieldValue.RegistrationAttachmentId,
  };
};

const DeleteRegistrationFieldValue: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const fieldPath = requireString(input, "FieldPath");
  const stored = requireRegistration(ctx, idOrArn);
  const key = `${regFieldPrefix}${stored.RegistrationId}:${fieldPath}`;
  const fieldValue = ctx.store.get<StoredRegistrationFieldValue>(key);
  if (!fieldValue) {
    throw awsError(
      "ResourceNotFoundException",
      `Field value ${fieldPath} does not exist.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    VersionNumber: stored.CurrentVersionNumber,
    FieldPath: fieldPath,
    SelectChoices: fieldValue.SelectChoices,
    TextValue: fieldValue.TextValue,
    RegistrationAttachmentId: fieldValue.RegistrationAttachmentId,
  };
};

const DescribeRegistrationFieldValues: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationId");
  const stored = requireRegistration(ctx, idOrArn);
  const prefix = `${regFieldPrefix}${stored.RegistrationId}:`;
  const fields = ctx.store
    .list<StoredRegistrationFieldValue>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      FieldPath: e.value.FieldPath,
      SelectChoices: e.value.SelectChoices,
      TextValue: e.value.TextValue,
      RegistrationAttachmentId: e.value.RegistrationAttachmentId,
    }));
  return {
    RegistrationArn: stored.RegistrationArn,
    RegistrationId: stored.RegistrationId,
    VersionNumber: stored.CurrentVersionNumber,
    RegistrationFieldValues: fields,
  };
};

const CreateRegistrationAttachment: OperationHandler = (input, ctx) => {
  const id = `attachment-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:registration-attachment/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredRegistrationAttachment = {
    RegistrationAttachmentArn: arn,
    RegistrationAttachmentId: id,
    AttachmentStatus: "UPLOAD_COMPLETE",
    AttachmentBody: stringOrUndefined(input["AttachmentBody"]),
    AttachmentUrl: stringOrUndefined(input["AttachmentUrl"]),
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${regAttachmentPrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    RegistrationAttachmentArn: arn,
    RegistrationAttachmentId: id,
    AttachmentStatus: stored.AttachmentStatus,
    Tags: tags,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const DescribeRegistrationAttachments: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["RegistrationAttachmentIds"]);
  const all = ctx.store
    .list<StoredRegistrationAttachment>()
    .filter((e) => e.key.startsWith(regAttachmentPrefix))
    .map((e) => e.value);
  const filtered =
    ids.length > 0
      ? all.filter((a) =>
          ids.some(
            (id) =>
              id === a.RegistrationAttachmentId ||
              id === a.RegistrationAttachmentArn,
          ),
        )
      : all;
  return {
    RegistrationAttachments: filtered.map((a) => ({
      RegistrationAttachmentArn: a.RegistrationAttachmentArn,
      RegistrationAttachmentId: a.RegistrationAttachmentId,
      AttachmentStatus: a.AttachmentStatus,
      AttachmentUploadErrorReason: a.AttachmentUploadErrorReason,
      CreatedTimestamp: a.CreatedTimestamp,
      AttachmentUrl: a.AttachmentUrl,
    })),
  };
};

const DeleteRegistrationAttachment: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RegistrationAttachmentId");
  const id = idFromArn(idOrArn);
  const stored = ctx.store.get<StoredRegistrationAttachment>(
    `${regAttachmentPrefix}${id}`,
  );
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Registration attachment ${idOrArn} does not exist.`,
      404,
    );
  }
  ctx.store.delete(`${regAttachmentPrefix}${id}`);
  return {
    RegistrationAttachmentArn: stored.RegistrationAttachmentArn,
    RegistrationAttachmentId: stored.RegistrationAttachmentId,
    AttachmentStatus: stored.AttachmentStatus,
    AttachmentUploadErrorReason: stored.AttachmentUploadErrorReason,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const DescribeRegistrationFieldDefinitions: OperationHandler = (input, ctx) => {
  const registrationType = requireString(input, "RegistrationType");
  return {
    RegistrationType: registrationType,
    RegistrationFieldDefinitions: [
      {
        SectionPath: "businessInfo",
        FieldPath: "businessInfo.businessName",
        FieldType: "TEXT",
        FieldRequirement: "REQUIRED",
        DisplayHints: {
          Title: "Business Name",
          ShortDescription: "Legal name of the business",
        },
      },
    ],
  };
};

const DescribeRegistrationSectionDefinitions: OperationHandler = (
  input,
  ctx,
) => {
  const registrationType = requireString(input, "RegistrationType");
  return {
    RegistrationType: registrationType,
    RegistrationSectionDefinitions: [
      {
        SectionPath: "businessInfo",
        DisplayHints: {
          Title: "Business Information",
          ShortDescription: "Information about your business",
        },
      },
    ],
  };
};

const DescribeRegistrationTypeDefinitions: OperationHandler = (input, ctx) => {
  return {
    RegistrationTypeDefinitions: [
      {
        RegistrationType: "US_TEN_DLC_BRAND",
        DisplayHints: {
          Title: "US 10DLC Brand",
          ShortDescription: "US 10DLC brand registration",
        },
      },
    ],
  };
};

const CreateProtectConfiguration: OperationHandler = (input, ctx) => {
  const id = `protect-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:protect-configuration/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredProtectConfiguration = {
    ProtectConfigurationArn: arn,
    ProtectConfigurationId: id,
    CreatedTimestamp: nowSecs(),
    AccountDefault: false,
    DeletionProtectionEnabled: boolOrDefault(
      input["DeletionProtectionEnabled"],
      false,
    ),
    Tags: tags,
  };
  ctx.store.set(`${protectPrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    ...protectConfigView(stored),
    Tags: tags,
  };
};

const DescribeProtectConfigurations: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["ProtectConfigurationIds"]);
  const all = ctx.store
    .list<StoredProtectConfiguration>()
    .filter((e) => e.key.startsWith(protectPrefix))
    .map((e) => e.value);
  const filtered =
    ids.length > 0
      ? all.filter((p) =>
          ids.some(
            (id) =>
              id === p.ProtectConfigurationId ||
              id === p.ProtectConfigurationArn,
          ),
        )
      : all;
  return { ProtectConfigurations: filtered.map(protectConfigView) };
};

const UpdateProtectConfiguration: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  if (typeof input["DeletionProtectionEnabled"] === "boolean") {
    stored.DeletionProtectionEnabled = input["DeletionProtectionEnabled"];
  }
  ctx.store.set(`${protectPrefix}${stored.ProtectConfigurationId}`, stored);
  return protectConfigView(stored);
};

const DeleteProtectConfiguration: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  ctx.store.delete(`${protectPrefix}${stored.ProtectConfigurationId}`);
  return protectConfigView(stored);
};

const GetProtectConfigurationCountryRuleSet: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const numberCapability = requireString(input, "NumberCapability");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  const ruleKey = `${protectRulePrefix}${stored.ProtectConfigurationId}:${numberCapability}`;
  const ruleSet = ctx.store.get<StoredProtectCountryRuleSet>(ruleKey);
  return {
    ProtectConfigurationArn: stored.ProtectConfigurationArn,
    ProtectConfigurationId: stored.ProtectConfigurationId,
    NumberCapability: numberCapability,
    CountryRuleSet: ruleSet?.CountryRuleSet ?? {},
  };
};

const UpdateProtectConfigurationCountryRuleSet: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const numberCapability = requireString(input, "NumberCapability");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  const ruleKey = `${protectRulePrefix}${stored.ProtectConfigurationId}:${numberCapability}`;
  const existing = ctx.store.get<StoredProtectCountryRuleSet>(ruleKey) ?? {
    NumberCapability: numberCapability,
    CountryRuleSet: {} as Record<string, { ProtectStatus: string }>,
  };
  const updates =
    typeof input["CountryRuleSetUpdates"] === "object" &&
    input["CountryRuleSetUpdates"] !== null
      ? (input["CountryRuleSetUpdates"] as Record<string, unknown>)
      : {};
  for (const [country, info] of Object.entries(updates)) {
    if (typeof info === "object" && info !== null) {
      const infoRec = info as Record<string, unknown>;
      existing.CountryRuleSet[country] = {
        ProtectStatus: String(infoRec["ProtectStatus"] ?? "ALLOW"),
      };
    }
  }
  ctx.store.set(ruleKey, existing);
  return {
    ProtectConfigurationArn: stored.ProtectConfigurationArn,
    ProtectConfigurationId: stored.ProtectConfigurationId,
    NumberCapability: numberCapability,
    CountryRuleSet: existing.CountryRuleSet,
  };
};

const SetAccountDefaultProtectConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  const prev = ctx.store.get<StoredDefaultProtectConfig>("default-protect");
  if (prev) {
    const prevStored = ctx.store.get<StoredProtectConfiguration>(
      `${protectPrefix}${prev.ProtectConfigurationId}`,
    );
    if (prevStored) {
      prevStored.AccountDefault = false;
      ctx.store.set(
        `${protectPrefix}${prev.ProtectConfigurationId}`,
        prevStored,
      );
    }
  }
  stored.AccountDefault = true;
  ctx.store.set(`${protectPrefix}${stored.ProtectConfigurationId}`, stored);
  ctx.store.set("default-protect", {
    ProtectConfigurationArn: stored.ProtectConfigurationArn,
    ProtectConfigurationId: stored.ProtectConfigurationId,
  });
  return {
    DefaultProtectConfigurationArn: stored.ProtectConfigurationArn,
    DefaultProtectConfigurationId: stored.ProtectConfigurationId,
  };
};

const DeleteAccountDefaultProtectConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const defaultProtect =
    ctx.store.get<StoredDefaultProtectConfig>("default-protect");
  if (!defaultProtect) {
    throw awsError(
      "ResourceNotFoundException",
      `No default protect configuration set.`,
      404,
    );
  }
  const stored = ctx.store.get<StoredProtectConfiguration>(
    `${protectPrefix}${defaultProtect.ProtectConfigurationId}`,
  );
  if (stored) {
    stored.AccountDefault = false;
    ctx.store.set(`${protectPrefix}${stored.ProtectConfigurationId}`, stored);
  }
  ctx.store.delete("default-protect");
  return {
    DefaultProtectConfigurationArn: defaultProtect.ProtectConfigurationArn,
    DefaultProtectConfigurationId: defaultProtect.ProtectConfigurationId,
  };
};

const PutProtectConfigurationRuleSetNumberOverride: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const destPhone = requireString(input, "DestinationPhoneNumber");
  const action = requireString(input, "Action");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  const now = nowSecs();
  const override: StoredProtectRuleOverride = {
    DestinationPhoneNumber: destPhone,
    Action: action,
    IsoCountryCode: stringOrUndefined(input["IsoCountryCode"]),
    ExpirationTimestamp:
      typeof input["ExpirationTimestamp"] === "number"
        ? input["ExpirationTimestamp"]
        : undefined,
    CreatedTimestamp: now,
  };
  ctx.store.set(
    `${protectOverridePrefix}${stored.ProtectConfigurationId}:${destPhone}`,
    override,
  );
  return {
    ProtectConfigurationArn: stored.ProtectConfigurationArn,
    ProtectConfigurationId: stored.ProtectConfigurationId,
    DestinationPhoneNumber: destPhone,
    CreatedTimestamp: now,
    Action: action,
    IsoCountryCode: override.IsoCountryCode,
    ExpirationTimestamp: override.ExpirationTimestamp,
  };
};

const DeleteProtectConfigurationRuleSetNumberOverride: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const destPhone = requireString(input, "DestinationPhoneNumber");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  const overrideKey = `${protectOverridePrefix}${stored.ProtectConfigurationId}:${destPhone}`;
  const override = ctx.store.get<StoredProtectRuleOverride>(overrideKey);
  if (!override) {
    throw awsError(
      "ResourceNotFoundException",
      `Override for ${destPhone} does not exist.`,
      404,
    );
  }
  ctx.store.delete(overrideKey);
  return {
    ProtectConfigurationArn: stored.ProtectConfigurationArn,
    ProtectConfigurationId: stored.ProtectConfigurationId,
    DestinationPhoneNumber: destPhone,
    CreatedTimestamp: override.CreatedTimestamp,
    Action: override.Action,
    IsoCountryCode: override.IsoCountryCode,
    ExpirationTimestamp: override.ExpirationTimestamp,
  };
};

const ListProtectConfigurationRuleSetNumberOverrides: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "ProtectConfigurationId");
  const stored = requireProtectConfiguration(ctx, idOrArn);
  const prefix = `${protectOverridePrefix}${stored.ProtectConfigurationId}:`;
  const overrides = ctx.store
    .list<StoredProtectRuleOverride>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      DestinationPhoneNumber: e.value.DestinationPhoneNumber,
      Action: e.value.Action,
      IsoCountryCode: e.value.IsoCountryCode,
      ExpirationTimestamp: e.value.ExpirationTimestamp,
      CreatedTimestamp: e.value.CreatedTimestamp,
    }));
  return {
    ProtectConfigurationArn: stored.ProtectConfigurationArn,
    ProtectConfigurationId: stored.ProtectConfigurationId,
    RuleSetNumberOverrides: overrides,
  };
};

const CreateRcsAgent: OperationHandler = (input, ctx) => {
  const id = `rcs-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:rcs-agent/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredRcsAgent = {
    RcsAgentArn: arn,
    RcsAgentId: id,
    Status: "ACTIVE",
    CreatedTimestamp: nowSecs(),
    DeletionProtectionEnabled: boolOrDefault(
      input["DeletionProtectionEnabled"],
      false,
    ),
    OptOutListName: stringOrUndefined(input["OptOutListName"]),
    SelfManagedOptOutsEnabled: false,
    TwoWayEnabled: false,
    Tags: tags,
  };
  ctx.store.set(`${rcsAgentPrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    ...rcsAgentView(stored),
    Tags: tags,
  };
};

const DescribeRcsAgents: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["RcsAgentIds"]);
  const all = ctx.store
    .list<StoredRcsAgent>()
    .filter((e) => e.key.startsWith(rcsAgentPrefix))
    .map((e) => e.value);
  const filtered =
    ids.length > 0
      ? all.filter((r) =>
          ids.some((id) => id === r.RcsAgentId || id === r.RcsAgentArn),
        )
      : all;
  return { RcsAgents: filtered.map(rcsAgentView) };
};

const UpdateRcsAgent: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RcsAgentId");
  const stored = requireRcsAgent(ctx, idOrArn);
  if (typeof input["DeletionProtectionEnabled"] === "boolean")
    stored.DeletionProtectionEnabled = input["DeletionProtectionEnabled"];
  if (stringOrUndefined(input["OptOutListName"]))
    stored.OptOutListName = stringOrUndefined(input["OptOutListName"]);
  if (typeof input["SelfManagedOptOutsEnabled"] === "boolean")
    stored.SelfManagedOptOutsEnabled = input["SelfManagedOptOutsEnabled"];
  if (typeof input["TwoWayEnabled"] === "boolean")
    stored.TwoWayEnabled = input["TwoWayEnabled"];
  if (stringOrUndefined(input["TwoWayChannelArn"]))
    stored.TwoWayChannelArn = stringOrUndefined(input["TwoWayChannelArn"]);
  if (stringOrUndefined(input["TwoWayChannelRole"]))
    stored.TwoWayChannelRole = stringOrUndefined(input["TwoWayChannelRole"]);
  ctx.store.set(`${rcsAgentPrefix}${stored.RcsAgentId}`, stored);
  return rcsAgentView(stored);
};

const DeleteRcsAgent: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RcsAgentId");
  const stored = requireRcsAgent(ctx, idOrArn);
  ctx.store.delete(`${rcsAgentPrefix}${stored.RcsAgentId}`);
  return {
    RcsAgentArn: stored.RcsAgentArn,
    RcsAgentId: stored.RcsAgentId,
    Status: stored.Status,
    CreatedTimestamp: stored.CreatedTimestamp,
    DeletionProtectionEnabled: stored.DeletionProtectionEnabled,
    OptOutListName: stored.OptOutListName,
    SelfManagedOptOutsEnabled: stored.SelfManagedOptOutsEnabled,
    TwoWayChannelArn: stored.TwoWayChannelArn,
    TwoWayChannelRole: stored.TwoWayChannelRole,
    TwoWayEnabled: stored.TwoWayEnabled,
  };
};

const DescribeRcsAgentCountryLaunchStatus: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "RcsAgentId");
  const stored = requireRcsAgent(ctx, idOrArn);
  return {
    RcsAgentId: stored.RcsAgentId,
    RcsAgentArn: stored.RcsAgentArn,
    CountryLaunchStatus: [],
  };
};

const CreateVerifiedDestinationNumber: OperationHandler = (input, ctx) => {
  const destPhone = requireString(input, "DestinationPhoneNumber");
  const id = `verified-dest-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:verified-destination-number/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredVerifiedDestinationNumber = {
    VerifiedDestinationNumberArn: arn,
    VerifiedDestinationNumberId: id,
    DestinationPhoneNumber: destPhone,
    Status: "PENDING",
    RcsAgentId: stringOrUndefined(input["RcsAgentId"]),
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${verifiedDestPrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    VerifiedDestinationNumberArn: arn,
    VerifiedDestinationNumberId: id,
    DestinationPhoneNumber: destPhone,
    Status: "PENDING",
    RcsAgentId: stored.RcsAgentId,
    Tags: tags,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const DescribeVerifiedDestinationNumbers: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["VerifiedDestinationNumberIds"]);
  const all = ctx.store
    .list<StoredVerifiedDestinationNumber>()
    .filter((e) => e.key.startsWith(verifiedDestPrefix))
    .map((e) => e.value);
  const filtered =
    ids.length > 0
      ? all.filter((v) =>
          ids.some(
            (id) =>
              id === v.VerifiedDestinationNumberId ||
              id === v.VerifiedDestinationNumberArn,
          ),
        )
      : all;
  return {
    VerifiedDestinationNumbers: filtered.map((v) => ({
      VerifiedDestinationNumberArn: v.VerifiedDestinationNumberArn,
      VerifiedDestinationNumberId: v.VerifiedDestinationNumberId,
      DestinationPhoneNumber: v.DestinationPhoneNumber,
      Status: v.Status,
      RcsAgentId: v.RcsAgentId,
      CreatedTimestamp: v.CreatedTimestamp,
    })),
  };
};

const DeleteVerifiedDestinationNumber: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "VerifiedDestinationNumberId");
  const stored = requireVerifiedDestination(ctx, idOrArn);
  ctx.store.delete(
    `${verifiedDestPrefix}${stored.VerifiedDestinationNumberId}`,
  );
  return {
    VerifiedDestinationNumberArn: stored.VerifiedDestinationNumberArn,
    VerifiedDestinationNumberId: stored.VerifiedDestinationNumberId,
    DestinationPhoneNumber: stored.DestinationPhoneNumber,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const SendDestinationNumberVerificationCode: OperationHandler = (
  input,
  ctx,
) => {
  const idOrArn = requireString(input, "VerifiedDestinationNumberId");
  requireVerifiedDestination(ctx, idOrArn);
  return { MessageId: `msg-${uid()}` };
};

const VerifyDestinationNumber: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "VerifiedDestinationNumberId");
  const stored = requireVerifiedDestination(ctx, idOrArn);
  stored.Status = "VERIFIED";
  ctx.store.set(
    `${verifiedDestPrefix}${stored.VerifiedDestinationNumberId}`,
    stored,
  );
  return {
    VerifiedDestinationNumberArn: stored.VerifiedDestinationNumberArn,
    VerifiedDestinationNumberId: stored.VerifiedDestinationNumberId,
    DestinationPhoneNumber: stored.DestinationPhoneNumber,
    Status: "VERIFIED",
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const CreateNotifyConfiguration: OperationHandler = (input, ctx) => {
  const displayName = requireString(input, "DisplayName");
  const useCase = requireString(input, "UseCase");
  const enabledChannels = strArrayFrom(input["EnabledChannels"]);
  const id = `notify-${uid()}`;
  const arn = `arn:aws:sms-voice:${ctx.region}:${ctx.account}:notify-configuration/${id}`;
  const tags = tagsFrom(input["Tags"]);
  const stored: StoredNotifyConfiguration = {
    NotifyConfigurationArn: arn,
    NotifyConfigurationId: id,
    DisplayName: displayName,
    UseCase: useCase,
    DefaultTemplateId: stringOrUndefined(input["DefaultTemplateId"]),
    PoolId: stringOrUndefined(input["PoolId"]),
    EnabledCountries: Array.isArray(input["EnabledCountries"])
      ? strArrayFrom(input["EnabledCountries"])
      : undefined,
    EnabledChannels: enabledChannels,
    Tier: "STANDARD",
    TierUpgradeStatus: "NOT_STARTED",
    Status: "ACTIVE",
    DeletionProtectionEnabled: boolOrDefault(
      input["DeletionProtectionEnabled"],
      false,
    ),
    Tags: tags,
    CreatedTimestamp: nowSecs(),
  };
  ctx.store.set(`${notifyPrefix}${id}`, stored);
  if (tags.length > 0) setTagsForArn(ctx, arn, tags);
  return {
    ...notifyConfigView(stored),
    Tags: tags,
  };
};

const DescribeNotifyConfigurations: OperationHandler = (input, ctx) => {
  const ids = strArrayFrom(input["NotifyConfigurationIds"]);
  const all = ctx.store
    .list<StoredNotifyConfiguration>()
    .filter((e) => e.key.startsWith(notifyPrefix))
    .map((e) => e.value);
  const filtered =
    ids.length > 0
      ? all.filter((n) =>
          ids.some(
            (id) =>
              id === n.NotifyConfigurationId || id === n.NotifyConfigurationArn,
          ),
        )
      : all;
  return { NotifyConfigurations: filtered.map(notifyConfigView) };
};

const UpdateNotifyConfiguration: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "NotifyConfigurationId");
  const stored = requireNotifyConfiguration(ctx, idOrArn);
  if (stringOrUndefined(input["DefaultTemplateId"]))
    stored.DefaultTemplateId = stringOrUndefined(input["DefaultTemplateId"]);
  if (Array.isArray(input["EnabledCountries"]))
    stored.EnabledCountries = strArrayFrom(input["EnabledCountries"]);
  if (Array.isArray(input["EnabledChannels"]))
    stored.EnabledChannels = strArrayFrom(input["EnabledChannels"]);
  if (typeof input["DeletionProtectionEnabled"] === "boolean")
    stored.DeletionProtectionEnabled = input["DeletionProtectionEnabled"];
  ctx.store.set(`${notifyPrefix}${stored.NotifyConfigurationId}`, stored);
  return notifyConfigView(stored);
};

const DeleteNotifyConfiguration: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "NotifyConfigurationId");
  const stored = requireNotifyConfiguration(ctx, idOrArn);
  ctx.store.delete(`${notifyPrefix}${stored.NotifyConfigurationId}`);
  return notifyConfigView(stored);
};

const DescribeNotifyTemplates: OperationHandler = (input, ctx) => {
  return { NotifyTemplates: [] };
};

const ListNotifyCountries: OperationHandler = (input, ctx) => {
  return {
    NotifyCountries: [
      {
        IsoCountryCode: "US",
        CountryName: "United States",
        SupportedChannels: ["SMS", "VOICE"],
        SupportedUseCases: ["MARKETING", "TRANSACTIONAL"],
        SupportedTiers: ["STANDARD"],
        CustomerOwnedIdentityRequired: false,
      },
    ],
  };
};

const SendNotifyTextMessage: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "NotifyConfigurationId");
  requireNotifyConfiguration(ctx, idOrArn);
  return {
    MessageId: `msg-${uid()}`,
    ResolvedMessageBody: "Hello",
  };
};

const SendNotifyVoiceMessage: OperationHandler = (input, ctx) => {
  const idOrArn = requireString(input, "NotifyConfigurationId");
  requireNotifyConfiguration(ctx, idOrArn);
  return {
    MessageId: `msg-${uid()}`,
    ResolvedMessageBody: "Hello",
  };
};

const SetNotifyMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const monthlyLimit =
    typeof input["MonthlyLimit"] === "number" ? input["MonthlyLimit"] : 0;
  ctx.store.set("spend-notify", { MonthlyLimit: monthlyLimit });
  return { MonthlyLimit: monthlyLimit };
};

const DeleteNotifyMessageSpendLimitOverride: OperationHandler = (
  input,
  ctx,
) => {
  const stored = ctx.store.get<StoredSpendLimitOverride>("spend-notify");
  ctx.store.delete("spend-notify");
  return { MonthlyLimit: stored?.MonthlyLimit };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const stored = ctx.store.get<StoredResourcePolicy>(
    `${resourcePolicyPrefix}${resourceArn}`,
  );
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource policy for ${resourceArn} does not exist.`,
      404,
    );
  }
  return {
    ResourceArn: stored.ResourceArn,
    Policy: stored.Policy,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const policy = requireString(input, "Policy");
  const now = nowSecs();
  const stored: StoredResourcePolicy = {
    ResourceArn: resourceArn,
    Policy: policy,
    CreatedTimestamp: now,
  };
  ctx.store.set(`${resourcePolicyPrefix}${resourceArn}`, stored);
  return {
    ResourceArn: resourceArn,
    Policy: policy,
    CreatedTimestamp: now,
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const stored = ctx.store.get<StoredResourcePolicy>(
    `${resourcePolicyPrefix}${resourceArn}`,
  );
  if (!stored) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource policy for ${resourceArn} does not exist.`,
      404,
    );
  }
  ctx.store.delete(`${resourcePolicyPrefix}${resourceArn}`);
  return {
    ResourceArn: stored.ResourceArn,
    Policy: stored.Policy,
    CreatedTimestamp: stored.CreatedTimestamp,
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const newTags = tagsFrom(input["Tags"]);
  const existing = getTagsForArn(ctx, resourceArn);
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  setTagsForArn(ctx, resourceArn, merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = strArrayFrom(input["TagKeys"]);
  const existing = getTagsForArn(ctx, resourceArn);
  const filtered = existing.filter((t) => !tagKeys.includes(t.Key));
  setTagsForArn(ctx, resourceArn, filtered);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = getTagsForArn(ctx, resourceArn);
  return { ResourceArn: resourceArn, Tags: tags };
};

const DescribeAccountAttributes: OperationHandler = (input, ctx) => {
  return {
    AccountAttributes: [{ Name: "ACCOUNT_TIER", Value: "STANDARD" }],
  };
};

const DescribeAccountLimits: OperationHandler = (input, ctx) => {
  return {
    AccountLimits: [
      { Name: "PHONE_NUMBERS", Used: 0, Max: 10 },
      { Name: "POOLS", Used: 0, Max: 5 },
      { Name: "CONFIGURATION_SETS", Used: 0, Max: 100 },
      { Name: "OPT_OUT_LISTS", Used: 0, Max: 25 },
    ],
  };
};

const DescribeSpendLimits: OperationHandler = (input, ctx) => {
  const textOverride = ctx.store.get<StoredSpendLimitOverride>("spend-text");
  const voiceOverride = ctx.store.get<StoredSpendLimitOverride>("spend-voice");
  const mediaOverride = ctx.store.get<StoredSpendLimitOverride>("spend-media");
  return {
    SpendLimits: [
      {
        Name: "TEXT_MESSAGE_MONTHLY_SPEND_LIMIT",
        EnforcedLimit: textOverride?.MonthlyLimit ?? 100,
        MaxLimit: 1000,
        Overridden: textOverride !== undefined,
      },
      {
        Name: "VOICE_MESSAGE_MONTHLY_SPEND_LIMIT",
        EnforcedLimit: voiceOverride?.MonthlyLimit ?? 100,
        MaxLimit: 1000,
        Overridden: voiceOverride !== undefined,
      },
      {
        Name: "MEDIA_MESSAGE_MONTHLY_SPEND_LIMIT",
        EnforcedLimit: mediaOverride?.MonthlyLimit ?? 100,
        MaxLimit: 1000,
        Overridden: mediaOverride !== undefined,
      },
    ],
  };
};

const SetTextMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const monthlyLimit =
    typeof input["MonthlyLimit"] === "number" ? input["MonthlyLimit"] : 0;
  ctx.store.set("spend-text", { MonthlyLimit: monthlyLimit });
  return { MonthlyLimit: monthlyLimit };
};

const DeleteTextMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const stored = ctx.store.get<StoredSpendLimitOverride>("spend-text");
  ctx.store.delete("spend-text");
  return { MonthlyLimit: stored?.MonthlyLimit };
};

const SetVoiceMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const monthlyLimit =
    typeof input["MonthlyLimit"] === "number" ? input["MonthlyLimit"] : 0;
  ctx.store.set("spend-voice", { MonthlyLimit: monthlyLimit });
  return { MonthlyLimit: monthlyLimit };
};

const DeleteVoiceMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const stored = ctx.store.get<StoredSpendLimitOverride>("spend-voice");
  ctx.store.delete("spend-voice");
  return { MonthlyLimit: stored?.MonthlyLimit };
};

const SetMediaMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const monthlyLimit =
    typeof input["MonthlyLimit"] === "number" ? input["MonthlyLimit"] : 0;
  ctx.store.set("spend-media", { MonthlyLimit: monthlyLimit });
  return { MonthlyLimit: monthlyLimit };
};

const DeleteMediaMessageSpendLimitOverride: OperationHandler = (input, ctx) => {
  const stored = ctx.store.get<StoredSpendLimitOverride>("spend-media");
  ctx.store.delete("spend-media");
  return { MonthlyLimit: stored?.MonthlyLimit };
};

const SendTextMessage: OperationHandler = (input, ctx) => {
  requireString(input, "DestinationPhoneNumber");
  return { MessageId: `msg-${uid()}` };
};

const SendVoiceMessage: OperationHandler = (input, ctx) => {
  requireString(input, "DestinationPhoneNumber");
  return { MessageId: `msg-${uid()}` };
};

const SendMediaMessage: OperationHandler = (input, ctx) => {
  requireString(input, "DestinationPhoneNumber");
  return { MessageId: `msg-${uid()}` };
};

const CarrierLookup: OperationHandler = (input, ctx) => {
  const phoneNumber = requireString(input, "PhoneNumber");
  return {
    E164PhoneNumber: phoneNumber,
    DialingCountryCode: "1",
    IsoCountryCode: "US",
    Country: "United States",
    MCC: "310",
    MNC: "410",
    Carrier: "AT&T",
    PhoneNumberType: "MOBILE",
  };
};

const PutMessageFeedback: OperationHandler = (input, ctx) => {
  const messageId = requireString(input, "MessageId");
  const messageFeedbackStatus = requireString(input, "MessageFeedbackStatus");
  return {
    MessageId: messageId,
    MessageFeedbackStatus: messageFeedbackStatus,
  };
};

const smsVoice = {
  name: "sms-voice",
  protocol: "json",
  operations: {
    AssociateOriginationIdentity,
    AssociateProtectConfiguration,
    CarrierLookup,
    CreateConfigurationSet,
    CreateEventDestination,
    CreateNotifyConfiguration,
    CreateOptOutList,
    CreatePool,
    CreateProtectConfiguration,
    CreateRcsAgent,
    CreateRegistration,
    CreateRegistrationAssociation,
    CreateRegistrationAttachment,
    CreateRegistrationVersion,
    CreateVerifiedDestinationNumber,
    DeleteAccountDefaultProtectConfiguration,
    DeleteConfigurationSet,
    DeleteDefaultMessageType,
    DeleteDefaultSenderId,
    DeleteEventDestination,
    DeleteKeyword,
    DeleteMediaMessageSpendLimitOverride,
    DeleteNotifyConfiguration,
    DeleteNotifyMessageSpendLimitOverride,
    DeleteOptOutList,
    DeleteOptedOutNumber,
    DeletePool,
    DeleteProtectConfiguration,
    DeleteProtectConfigurationRuleSetNumberOverride,
    DeleteRcsAgent,
    DeleteRegistration,
    DeleteRegistrationAttachment,
    DeleteRegistrationFieldValue,
    DeleteResourcePolicy,
    DeleteTextMessageSpendLimitOverride,
    DeleteVerifiedDestinationNumber,
    DeleteVoiceMessageSpendLimitOverride,
    DescribeAccountAttributes,
    DescribeAccountLimits,
    DescribeConfigurationSets,
    DescribeKeywords,
    DescribeNotifyConfigurations,
    DescribeNotifyTemplates,
    DescribeOptOutLists,
    DescribeOptedOutNumbers,
    DescribePhoneNumbers,
    DescribePools,
    DescribeProtectConfigurations,
    DescribeRcsAgentCountryLaunchStatus,
    DescribeRcsAgents,
    DescribeRegistrationAttachments,
    DescribeRegistrationFieldDefinitions,
    DescribeRegistrationFieldValues,
    DescribeRegistrationSectionDefinitions,
    DescribeRegistrationTypeDefinitions,
    DescribeRegistrationVersions,
    DescribeRegistrations,
    DescribeSenderIds,
    DescribeSpendLimits,
    DescribeVerifiedDestinationNumbers,
    DisassociateOriginationIdentity,
    DisassociateProtectConfiguration,
    DiscardRegistrationVersion,
    GetProtectConfigurationCountryRuleSet,
    GetResourcePolicy,
    ListNotifyCountries,
    ListPoolOriginationIdentities,
    ListProtectConfigurationRuleSetNumberOverrides,
    ListRegistrationAssociations,
    ListTagsForResource,
    PutKeyword,
    PutMessageFeedback,
    PutOptedOutNumber,
    PutProtectConfigurationRuleSetNumberOverride,
    PutRegistrationFieldValue,
    PutResourcePolicy,
    ReleasePhoneNumber,
    ReleaseSenderId,
    RequestPhoneNumber,
    RequestSenderId,
    SendDestinationNumberVerificationCode,
    SendMediaMessage,
    SendNotifyTextMessage,
    SendNotifyVoiceMessage,
    SendTextMessage,
    SendVoiceMessage,
    SetAccountDefaultProtectConfiguration,
    SetDefaultMessageFeedbackEnabled,
    SetDefaultMessageType,
    SetDefaultSenderId,
    SetMediaMessageSpendLimitOverride,
    SetNotifyMessageSpendLimitOverride,
    SetTextMessageSpendLimitOverride,
    SetVoiceMessageSpendLimitOverride,
    SubmitRegistrationVersion,
    TagResource,
    UntagResource,
    UpdateEventDestination,
    UpdateNotifyConfiguration,
    UpdatePhoneNumber,
    UpdatePool,
    UpdateProtectConfiguration,
    UpdateProtectConfigurationCountryRuleSet,
    UpdateRcsAgent,
    UpdateSenderId,
    VerifyDestinationNumber,
  },
  model,
} as const satisfies ServiceDefinition;

export default smsVoice;
