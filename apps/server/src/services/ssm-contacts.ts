import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssmContactsModel from "../../models/ssm-contacts.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ssmContactsModel);

const contactPrefix = "contact:" as const;
const channelPrefix = "channel:" as const;
const rotationPrefix = "rotation:" as const;
const overridePrefix = "override:" as const;
const engagementPrefix = "engagement:" as const;
const pagePrefix = "page:" as const;
const policyPrefix = "policy:" as const;
const tagsPrefix = "tags:" as const;

type StoredContact = {
  ContactArn: string;
  Alias: string;
  DisplayName?: string;
  Type: string;
  Plan: Record<string, unknown>;
};

type StoredContactChannel = {
  ContactChannelArn: string;
  ContactArn: string;
  Name: string;
  Type: string;
  DeliveryAddress: Record<string, unknown>;
  ActivationStatus: string;
};

type StoredRotation = {
  RotationArn: string;
  Name: string;
  ContactIds: string[];
  StartTime?: number;
  TimeZoneId: string;
  Recurrence: Record<string, unknown>;
};

type StoredRotationOverride = {
  RotationOverrideId: string;
  RotationArn: string;
  NewContactIds: string[];
  StartTime: number;
  EndTime: number;
  CreateTime: number;
};

type StoredEngagement = {
  EngagementArn: string;
  ContactArn: string;
  Sender: string;
  Subject: string;
  Content: string;
  PublicSubject?: string;
  PublicContent?: string;
  IncidentId?: string;
  StartTime: number;
  StopTime?: number;
};

type StoredPage = {
  PageArn: string;
  EngagementArn: string;
  ContactArn: string;
  Sender: string;
  Subject: string;
  Content: string;
  PublicSubject?: string;
  PublicContent?: string;
  IncidentId?: string;
  SentTime: number;
  DeliveryTime?: number;
  ReadTime?: number;
  AcceptCode?: string;
};

type StoredPageReceipt = {
  ContactChannelArn?: string;
  ReceiptType: string;
  ReceiptInfo?: string;
  ReceiptTime: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];

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

const contactKey = (alias: string): string => `${contactPrefix}${alias}`;

const contactArn = (ctx: ServiceContext, alias: string): string =>
  `arn:aws:ssm-contacts:${ctx.region}:${ctx.account}:contact/${alias}`;

const aliasFromArn = (arn: string): string => {
  const marker = ":contact/";
  const index = arn.lastIndexOf(marker);
  return index === -1 ? arn : arn.slice(index + marker.length);
};

const makeSeq = (ctx: ServiceContext): string => {
  const seqKey = "__seq";
  const current = (ctx.store.get<number>(seqKey) ?? 0) + 1;
  ctx.store.set(seqKey, current);
  return current.toString(16).padStart(12, "0");
};

const makeUuid = (ctx: ServiceContext): string => {
  const seq = makeSeq(ctx);
  const a = seq.slice(0, 8);
  const b = seq.slice(8, 12);
  return `${a}-${b}-4000-8000-000000000000`;
};

const channelArn = (
  ctx: ServiceContext,
  contactAlias: string,
  seq: string,
): string =>
  `arn:aws:ssm-contacts:${ctx.region}:${ctx.account}:contact-channel/${contactAlias}/${seq}`;

const rotationArn = (ctx: ServiceContext, name: string, seq: string): string =>
  `arn:aws:ssm-contacts:${ctx.region}:${ctx.account}:rotation/${name}/${seq}`;

const engagementArn = (
  ctx: ServiceContext,
  alias: string,
  seq: string,
): string =>
  `arn:aws:ssm-contacts:${ctx.region}:${ctx.account}:engagement/${alias}/${seq}`;

const pageArn = (ctx: ServiceContext, seq: string): string =>
  `arn:aws:ssm-contacts:${ctx.region}:${ctx.account}:page/contact/${seq}`;

const channelKey = (arn: string): string => `${channelPrefix}${arn}`;
const rotationKey = (arn: string): string => `${rotationPrefix}${arn}`;
const overrideKey = (rotationArnVal: string, overrideId: string): string =>
  `${overridePrefix}${rotationArnVal}/${overrideId}`;
const engagementKey = (arn: string): string => `${engagementPrefix}${arn}`;
const pageKey = (arn: string): string => `${pagePrefix}${arn}`;
const policyKey = (arn: string): string => `${policyPrefix}${arn}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;
const receiptKey = (pageArnVal: string): string => `receipt:${pageArnVal}`;

const nowEpoch = (): number => Date.now() / 1000;

const paginateItems = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
  maxCap = 100,
): { page: T[]; nextToken: string | undefined } => {
  const max =
    typeof maxResults === "number" && maxResults > 0
      ? Math.min(maxResults, maxCap)
      : maxCap;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(atob(nextToken), 10) || 0
      : 0;
  const page = items.slice(offset, offset + max);
  const next =
    offset + max < items.length ? btoa(String(offset + max)) : undefined;
  return { page, nextToken: next };
};

const requireTimestamp = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const v = input[field];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Date.parse(v) / 1000;
    if (!Number.isNaN(n)) return n;
  }
  throw awsError("ValidationException", `${field} is required.`, 400);
};

const asTimestamp = (
  input: Record<string, unknown>,
  field: string,
): number | undefined => {
  const v = input[field];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Date.parse(v) / 1000;
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
};

const contactSummary = (contact: StoredContact): Record<string, unknown> => ({
  ContactArn: contact.ContactArn,
  Alias: contact.Alias,
  DisplayName: contact.DisplayName,
  Type: contact.Type,
});

const requireChannel = (
  ctx: ServiceContext,
  channelId: string,
): StoredContactChannel => {
  const channel = ctx.store.get<StoredContactChannel>(channelKey(channelId));
  if (channel === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact channel ${channelId} not found.`,
      404,
    );
  }
  return channel;
};

const requireRotation = (
  ctx: ServiceContext,
  rotationId: string,
): StoredRotation => {
  const rotation = ctx.store.get<StoredRotation>(rotationKey(rotationId));
  if (rotation === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Rotation ${rotationId} not found.`,
      404,
    );
  }
  return rotation;
};

const requireEngagement = (
  ctx: ServiceContext,
  engagementId: string,
): StoredEngagement => {
  const engagement = ctx.store.get<StoredEngagement>(
    engagementKey(engagementId),
  );
  if (engagement === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Engagement ${engagementId} not found.`,
      404,
    );
  }
  return engagement;
};

const requirePage = (ctx: ServiceContext, pageId: string): StoredPage => {
  const page = ctx.store.get<StoredPage>(pageKey(pageId));
  if (page === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Page ${pageId} not found.`,
      404,
    );
  }
  return page;
};

const CreateContact: OperationHandler = (input, ctx) => {
  const alias = requireString(input, "Alias");
  const type = requireString(input, "Type");
  const plan = asRecord(input["Plan"]);
  if (plan === undefined) {
    throw awsError("ValidationException", "Plan is required.", 400);
  }
  if (ctx.store.get<StoredContact>(contactKey(alias)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Contact ${alias} already exists.`,
      409,
    );
  }
  const arn = contactArn(ctx, alias);
  const contact: StoredContact = {
    ContactArn: arn,
    Alias: alias,
    DisplayName: stringOrUndefined(input["DisplayName"]),
    Type: type,
    Plan: plan,
  };
  ctx.store.set(contactKey(alias), contact);
  const tags = Array.isArray(input["Tags"]) ? (input["Tags"] as unknown[]) : [];
  if (tags.length > 0) {
    ctx.store.set(tagsKey(arn), tags);
  }
  return { ContactArn: arn };
};

const GetContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  const contact = ctx.store.get<StoredContact>(contactKey(alias));
  if (contact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  return {
    ContactArn: contact.ContactArn,
    Alias: contact.Alias,
    DisplayName: contact.DisplayName,
    Type: contact.Type,
    Plan: contact.Plan,
  };
};

const ListContacts: OperationHandler = (input, ctx) => {
  const aliasPrefix = stringOrUndefined(input["AliasPrefix"]);
  const type = stringOrUndefined(input["Type"]);
  const all = ctx.store
    .list<StoredContact>()
    .filter((entry) => entry.key.startsWith(contactPrefix))
    .map((entry) => entry.value)
    .filter(
      (contact) =>
        aliasPrefix === undefined || contact.Alias.startsWith(aliasPrefix),
    )
    .filter((contact) => type === undefined || contact.Type === type)
    .sort((a, b) => (a.Alias < b.Alias ? -1 : a.Alias > b.Alias ? 1 : 0));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Contacts: page.map(contactSummary), NextToken: nextToken };
};

const DeleteContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  const contact = ctx.store.get<StoredContact>(contactKey(alias));
  if (contact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const cArn = contact.ContactArn;
  const referencingRotation = ctx.store
    .list<StoredRotation>()
    .find(
      (entry) =>
        entry.key.startsWith(rotationPrefix) &&
        entry.value.ContactIds.includes(cArn),
    );
  if (referencingRotation !== undefined) {
    throw awsError(
      "ConflictException",
      `Contact ${contactId} is referenced by a rotation.`,
      409,
    );
  }
  const activeEngagement = ctx.store
    .list<StoredEngagement>()
    .find(
      (entry) =>
        entry.key.startsWith(engagementPrefix) &&
        entry.value.ContactArn === cArn &&
        entry.value.StopTime === undefined,
    );
  if (activeEngagement !== undefined) {
    throw awsError(
      "ConflictException",
      `Contact ${contactId} has active engagements.`,
      409,
    );
  }
  ctx.store.delete(contactKey(alias));
  ctx.store.delete(tagsKey(cArn));
  return {};
};

const UpdateContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  const contact = ctx.store.get<StoredContact>(contactKey(alias));
  if (contact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const updated: StoredContact = {
    ...contact,
    DisplayName: stringOrUndefined(input["DisplayName"]) ?? contact.DisplayName,
    Plan: asRecord(input["Plan"]) ?? contact.Plan,
  };
  ctx.store.set(contactKey(alias), updated);
  return {};
};

const CreateContactChannel: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const name = requireString(input, "Name");
  const type = requireString(input, "Type");
  const deliveryAddress = asRecord(input["DeliveryAddress"]);
  if (deliveryAddress === undefined) {
    throw awsError("ValidationException", "DeliveryAddress is required.", 400);
  }
  const alias = aliasFromArn(contactId);
  const cArn = contactArn(ctx, alias);
  if (ctx.store.get<StoredContact>(contactKey(alias)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const seq = makeSeq(ctx);
  const chArn = channelArn(ctx, alias, seq);
  const deferActivation = input["DeferActivation"] === true;
  const channel: StoredContactChannel = {
    ContactChannelArn: chArn,
    ContactArn: cArn,
    Name: name,
    Type: type,
    DeliveryAddress: deliveryAddress,
    ActivationStatus: deferActivation ? "NOT_ACTIVATED" : "NOT_ACTIVATED",
  };
  ctx.store.set(channelKey(chArn), channel);
  return { ContactChannelArn: chArn };
};

const GetContactChannel: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ContactChannelId");
  const channel = requireChannel(ctx, channelId);
  return {
    ContactArn: channel.ContactArn,
    ContactChannelArn: channel.ContactChannelArn,
    Name: channel.Name,
    Type: channel.Type,
    DeliveryAddress: channel.DeliveryAddress,
    ActivationStatus: channel.ActivationStatus,
  };
};

const DeleteContactChannel: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ContactChannelId");
  requireChannel(ctx, channelId);
  ctx.store.delete(channelKey(channelId));
  return {};
};

const UpdateContactChannel: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ContactChannelId");
  const channel = requireChannel(ctx, channelId);
  const updated: StoredContactChannel = {
    ...channel,
    Name: stringOrUndefined(input["Name"]) ?? channel.Name,
    DeliveryAddress:
      asRecord(input["DeliveryAddress"]) ?? channel.DeliveryAddress,
  };
  ctx.store.set(channelKey(channelId), updated);
  return {};
};

const ListContactChannels: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  if (ctx.store.get<StoredContact>(contactKey(alias)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const cArn = contactArn(ctx, alias);
  const all = ctx.store
    .list<StoredContactChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix))
    .map((entry) => entry.value)
    .filter((ch) => ch.ContactArn === cArn);
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { ContactChannels: page, NextToken: nextToken };
};

const ActivateContactChannel: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ContactChannelId");
  requireString(input, "ActivationCode");
  const channel = requireChannel(ctx, channelId);
  ctx.store.set(channelKey(channelId), {
    ...channel,
    ActivationStatus: "ACTIVATED",
  });
  return {};
};

const DeactivateContactChannel: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ContactChannelId");
  const channel = requireChannel(ctx, channelId);
  ctx.store.set(channelKey(channelId), {
    ...channel,
    ActivationStatus: "NOT_ACTIVATED",
  });
  return {};
};

const SendActivationCode: OperationHandler = (input, ctx) => {
  const channelId = requireString(input, "ContactChannelId");
  requireChannel(ctx, channelId);
  return {};
};

const CreateRotation: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const contactIds = asStringArray(input["ContactIds"]);
  const timeZoneId = requireString(input, "TimeZoneId");
  const recurrence = asRecord(input["Recurrence"]);
  if (recurrence === undefined) {
    throw awsError("ValidationException", "Recurrence is required.", 400);
  }
  const seq = makeSeq(ctx);
  const rArn = rotationArn(ctx, name, seq);
  const rotation: StoredRotation = {
    RotationArn: rArn,
    Name: name,
    ContactIds: contactIds,
    StartTime: asTimestamp(input, "StartTime"),
    TimeZoneId: timeZoneId,
    Recurrence: recurrence,
  };
  ctx.store.set(rotationKey(rArn), rotation);
  const tags = Array.isArray(input["Tags"]) ? (input["Tags"] as unknown[]) : [];
  if (tags.length > 0) {
    ctx.store.set(tagsKey(rArn), tags);
  }
  return { RotationArn: rArn };
};

const GetRotation: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  return {
    RotationArn: rotation.RotationArn,
    Name: rotation.Name,
    ContactIds: rotation.ContactIds,
    StartTime: rotation.StartTime ?? nowEpoch(),
    TimeZoneId: rotation.TimeZoneId,
    Recurrence: rotation.Recurrence,
  };
};

const DeleteRotation: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  ctx.store.delete(rotationKey(rotationId));
  ctx.store.delete(tagsKey(rotation.RotationArn));
  return {};
};

const UpdateRotation: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  const recurrence = asRecord(input["Recurrence"]);
  if (recurrence === undefined) {
    throw awsError("ValidationException", "Recurrence is required.", 400);
  }
  const updated: StoredRotation = {
    ...rotation,
    ContactIds:
      input["ContactIds"] !== undefined
        ? asStringArray(input["ContactIds"])
        : rotation.ContactIds,
    StartTime: asTimestamp(input, "StartTime") ?? rotation.StartTime,
    TimeZoneId: stringOrUndefined(input["TimeZoneId"]) ?? rotation.TimeZoneId,
    Recurrence: recurrence,
  };
  ctx.store.set(rotationKey(rotationId), updated);
  return {};
};

const ListRotations: OperationHandler = (input, ctx) => {
  const namePrefix = stringOrUndefined(input["RotationNamePrefix"]);
  const all = ctx.store
    .list<StoredRotation>()
    .filter((entry) => entry.key.startsWith(rotationPrefix))
    .map((entry) => entry.value)
    .filter((r) => namePrefix === undefined || r.Name.startsWith(namePrefix))
    .map((r) => ({
      RotationArn: r.RotationArn,
      Name: r.Name,
      ContactIds: r.ContactIds,
      StartTime: r.StartTime,
      TimeZoneId: r.TimeZoneId,
      Recurrence: r.Recurrence,
    }));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Rotations: page, NextToken: nextToken };
};

const CreateRotationOverride: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  const newContactIds = asStringArray(input["NewContactIds"]);
  const startTime = requireTimestamp(input, "StartTime");
  const endTime = requireTimestamp(input, "EndTime");
  const overrideId = makeUuid(ctx);
  const override: StoredRotationOverride = {
    RotationOverrideId: overrideId,
    RotationArn: rotation.RotationArn,
    NewContactIds: newContactIds,
    StartTime: startTime,
    EndTime: endTime,
    CreateTime: nowEpoch(),
  };
  ctx.store.set(overrideKey(rotation.RotationArn, overrideId), override);
  return { RotationOverrideId: overrideId };
};

const GetRotationOverride: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  const overrideId = requireString(input, "RotationOverrideId");
  const override = ctx.store.get<StoredRotationOverride>(
    overrideKey(rotation.RotationArn, overrideId),
  );
  if (override === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Rotation override ${overrideId} not found.`,
      404,
    );
  }
  return {
    RotationOverrideId: override.RotationOverrideId,
    RotationArn: override.RotationArn,
    NewContactIds: override.NewContactIds,
    StartTime: override.StartTime,
    EndTime: override.EndTime,
    CreateTime: override.CreateTime,
  };
};

const DeleteRotationOverride: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  const overrideId = requireString(input, "RotationOverrideId");
  const key = overrideKey(rotation.RotationArn, overrideId);
  if (ctx.store.get<StoredRotationOverride>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Rotation override ${overrideId} not found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListRotationOverrides: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  const rArn = rotation.RotationArn;
  const prefix = overrideKey(rArn, "");
  const all = ctx.store
    .list<StoredRotationOverride>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { RotationOverrides: page, NextToken: nextToken };
};

const makeShift = (
  contactIds: string[],
  startEpoch: number,
  endEpoch: number,
): Record<string, unknown> => ({
  ContactIds: contactIds,
  StartTime: startEpoch,
  EndTime: endEpoch,
  Type: "REGULAR",
});

const ListRotationShifts: OperationHandler = (input, ctx) => {
  const rotationId = requireString(input, "RotationId");
  const rotation = requireRotation(ctx, rotationId);
  const endTime = requireTimestamp(input, "EndTime");
  const startTime =
    asTimestamp(input, "StartTime") ?? rotation.StartTime ?? nowEpoch();
  const shift = makeShift(rotation.ContactIds, startTime, endTime);
  return { RotationShifts: [shift] };
};

const ListPreviewRotationShifts: OperationHandler = (input, ctx) => {
  void ctx;
  const endTime = requireTimestamp(input, "EndTime");
  const members = asStringArray(input["Members"]);
  const startTime =
    asTimestamp(input, "StartTime") ??
    asTimestamp(input, "RotationStartTime") ??
    nowEpoch();
  const shift = makeShift(members, startTime, endTime);
  return { RotationShifts: [shift] };
};

const StartEngagement: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const sender = requireString(input, "Sender");
  const subject = requireString(input, "Subject");
  const content = requireString(input, "Content");
  const alias = aliasFromArn(contactId);
  const contact = ctx.store.get<StoredContact>(contactKey(alias));
  if (contact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const seq = makeSeq(ctx);
  const eArn = engagementArn(ctx, alias, seq);
  const now = nowEpoch();
  const engagement: StoredEngagement = {
    EngagementArn: eArn,
    ContactArn: contact.ContactArn,
    Sender: sender,
    Subject: subject,
    Content: content,
    PublicSubject: stringOrUndefined(input["PublicSubject"]),
    PublicContent: stringOrUndefined(input["PublicContent"]),
    IncidentId: stringOrUndefined(input["IncidentId"]),
    StartTime: now,
  };
  ctx.store.set(engagementKey(eArn), engagement);
  const channels = ctx.store
    .list<StoredContactChannel>()
    .filter((entry) => entry.key.startsWith(channelPrefix))
    .map((entry) => entry.value)
    .filter((ch) => ch.ContactArn === contact.ContactArn);
  for (const ch of channels) {
    const pSeq = makeSeq(ctx);
    const pArn = pageArn(ctx, pSeq);
    const page: StoredPage = {
      PageArn: pArn,
      EngagementArn: eArn,
      ContactArn: contact.ContactArn,
      Sender: sender,
      Subject: subject,
      Content: content,
      PublicSubject: engagement.PublicSubject,
      PublicContent: engagement.PublicContent,
      IncidentId: engagement.IncidentId,
      SentTime: now,
    };
    ctx.store.set(pageKey(pArn), page);
    const receipt: StoredPageReceipt = {
      ContactChannelArn: ch.ContactChannelArn,
      ReceiptType: "SENT",
      ReceiptTime: now,
    };
    ctx.store.set(receiptKey(pArn), [receipt]);
  }
  return { EngagementArn: eArn };
};

const StopEngagement: OperationHandler = (input, ctx) => {
  const engagementId = requireString(input, "EngagementId");
  const engagement = requireEngagement(ctx, engagementId);
  if (engagement.StopTime !== undefined) {
    return {};
  }
  ctx.store.set(engagementKey(engagementId), {
    ...engagement,
    StopTime: nowEpoch(),
  });
  return {};
};

const DescribeEngagement: OperationHandler = (input, ctx) => {
  const engagementId = requireString(input, "EngagementId");
  const engagement = requireEngagement(ctx, engagementId);
  return {
    ContactArn: engagement.ContactArn,
    EngagementArn: engagement.EngagementArn,
    Sender: engagement.Sender,
    Subject: engagement.Subject,
    Content: engagement.Content,
    PublicSubject: engagement.PublicSubject,
    PublicContent: engagement.PublicContent,
    IncidentId: engagement.IncidentId,
    StartTime: engagement.StartTime,
    StopTime: engagement.StopTime,
  };
};

const ListEngagements: OperationHandler = (input, ctx) => {
  const incidentId = stringOrUndefined(input["IncidentId"]);
  const all = ctx.store
    .list<StoredEngagement>()
    .filter((entry) => entry.key.startsWith(engagementPrefix))
    .map((entry) => entry.value)
    .filter((e) => incidentId === undefined || e.IncidentId === incidentId)
    .map((e) => ({
      EngagementArn: e.EngagementArn,
      ContactArn: e.ContactArn,
      Sender: e.Sender,
      IncidentId: e.IncidentId,
      StartTime: e.StartTime,
      StopTime: e.StopTime,
    }));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Engagements: page, NextToken: nextToken };
};

const AcceptPage: OperationHandler = (input, ctx) => {
  const pageId = requireString(input, "PageId");
  const acceptType = requireString(input, "AcceptType");
  const acceptCode = requireString(input, "AcceptCode");
  const page = requirePage(ctx, pageId);
  const now = nowEpoch();
  const updated: StoredPage = {
    ...page,
    ReadTime: now,
    AcceptCode: acceptCode,
  };
  ctx.store.set(pageKey(pageId), updated);
  const receipts = ctx.store.get<StoredPageReceipt[]>(receiptKey(pageId)) ?? [];
  const channelId = stringOrUndefined(input["ContactChannelId"]);
  receipts.push({
    ContactChannelArn: channelId,
    ReceiptType: acceptType,
    ReceiptInfo: acceptCode,
    ReceiptTime: now,
  });
  ctx.store.set(receiptKey(pageId), receipts);
  return {};
};

const DescribePage: OperationHandler = (input, ctx) => {
  const pageId = requireString(input, "PageId");
  const page = requirePage(ctx, pageId);
  return {
    PageArn: page.PageArn,
    EngagementArn: page.EngagementArn,
    ContactArn: page.ContactArn,
    Sender: page.Sender,
    Subject: page.Subject,
    Content: page.Content,
    PublicSubject: page.PublicSubject,
    PublicContent: page.PublicContent,
    IncidentId: page.IncidentId,
    SentTime: page.SentTime,
    ReadTime: page.ReadTime,
    DeliveryTime: page.DeliveryTime,
  };
};

const ListPageReceipts: OperationHandler = (input, ctx) => {
  const pageId = requireString(input, "PageId");
  requirePage(ctx, pageId);
  const all = ctx.store.get<StoredPageReceipt[]>(receiptKey(pageId)) ?? [];
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Receipts: page, NextToken: nextToken };
};

const ListPageResolutions: OperationHandler = (input, ctx) => {
  const pageId = requireString(input, "PageId");
  const storedPage = requirePage(ctx, pageId);
  const alias = aliasFromArn(storedPage.ContactArn);
  const contact = ctx.store.get<StoredContact>(contactKey(alias));
  const all = contact
    ? [{ ContactArn: contact.ContactArn, Type: contact.Type }]
    : [];
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { PageResolutions: page, NextToken: nextToken };
};

const ListPagesByContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "ContactId");
  const alias = aliasFromArn(contactId);
  const cArn = contactArn(ctx, alias);
  if (ctx.store.get<StoredContact>(contactKey(alias)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactId} not found.`,
      404,
    );
  }
  const all = ctx.store
    .list<StoredPage>()
    .filter((entry) => entry.key.startsWith(pagePrefix))
    .map((entry) => entry.value)
    .filter((p) => p.ContactArn === cArn)
    .map((p) => ({
      PageArn: p.PageArn,
      EngagementArn: p.EngagementArn,
      ContactArn: p.ContactArn,
      Sender: p.Sender,
      IncidentId: p.IncidentId,
      SentTime: p.SentTime,
      DeliveryTime: p.DeliveryTime,
      ReadTime: p.ReadTime,
    }));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Pages: page, NextToken: nextToken };
};

const ListPagesByEngagement: OperationHandler = (input, ctx) => {
  const engagementId = requireString(input, "EngagementId");
  requireEngagement(ctx, engagementId);
  const all = ctx.store
    .list<StoredPage>()
    .filter((entry) => entry.key.startsWith(pagePrefix))
    .map((entry) => entry.value)
    .filter((p) => p.EngagementArn === engagementId)
    .map((p) => ({
      PageArn: p.PageArn,
      EngagementArn: p.EngagementArn,
      ContactArn: p.ContactArn,
      Sender: p.Sender,
      IncidentId: p.IncidentId,
      SentTime: p.SentTime,
      DeliveryTime: p.DeliveryTime,
      ReadTime: p.ReadTime,
    }));
  const { page, nextToken } = paginateItems(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Pages: page, NextToken: nextToken };
};

const GetContactPolicy: OperationHandler = (input, ctx) => {
  const contactArnVal = requireString(input, "ContactArn");
  const alias = aliasFromArn(contactArnVal);
  if (ctx.store.get<StoredContact>(contactKey(alias)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactArnVal} not found.`,
      404,
    );
  }
  const policy = ctx.store.get<string>(policyKey(contactArnVal));
  return { ContactArn: contactArnVal, Policy: policy };
};

const PutContactPolicy: OperationHandler = (input, ctx) => {
  const contactArnVal = requireString(input, "ContactArn");
  const policy = requireString(input, "Policy");
  const alias = aliasFromArn(contactArnVal);
  if (ctx.store.get<StoredContact>(contactKey(alias)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${contactArnVal} not found.`,
      404,
    );
  }
  ctx.store.set(policyKey(contactArnVal), policy);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tags = ctx.store.get<unknown[]>(tagsKey(resourceArn)) ?? [];
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as unknown[])
    : [];
  const existing =
    ctx.store.get<Record<string, string>[]>(tagsKey(resourceArn)) ?? [];
  const merged: Record<string, string>[] = [...existing];
  for (const tag of newTags) {
    const t = tag as Record<string, string>;
    const idx = merged.findIndex((e) => e["Key"] === t["Key"]);
    if (idx >= 0) {
      merged[idx] = t;
    } else {
      merged.push(t);
    }
  }
  ctx.store.set(tagsKey(resourceArn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceARN");
  const tagKeys = asStringArray(input["TagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>[]>(tagsKey(resourceArn)) ?? [];
  const filtered = existing.filter((t) => !tagKeys.includes(t["Key"] ?? ""));
  ctx.store.set(tagsKey(resourceArn), filtered);
  return {};
};

const ssmContacts = {
  name: "ssm-contacts",
  protocol: "json",
  operations: {
    AcceptPage,
    ActivateContactChannel,
    CreateContact,
    CreateContactChannel,
    CreateRotation,
    CreateRotationOverride,
    DeactivateContactChannel,
    DeleteContact,
    DeleteContactChannel,
    DeleteRotation,
    DeleteRotationOverride,
    DescribeEngagement,
    DescribePage,
    GetContact,
    GetContactChannel,
    GetContactPolicy,
    GetRotation,
    GetRotationOverride,
    ListContactChannels,
    ListContacts,
    ListEngagements,
    ListPageReceipts,
    ListPageResolutions,
    ListPagesByContact,
    ListPagesByEngagement,
    ListPreviewRotationShifts,
    ListRotationOverrides,
    ListRotationShifts,
    ListRotations,
    ListTagsForResource,
    PutContactPolicy,
    SendActivationCode,
    StartEngagement,
    StopEngagement,
    TagResource,
    UntagResource,
    UpdateContact,
    UpdateContactChannel,
    UpdateRotation,
  },
  model,
} as const satisfies ServiceDefinition;

export default ssmContacts;
