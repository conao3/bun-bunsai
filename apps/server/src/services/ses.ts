import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/ses.json", { with: { type: "json" } }),
);

type StoredIdentity = {
  Identity: string;
  IdentityType: string;
  VerificationStatus: string;
  VerificationToken: string;
};

type StoredConfigurationSet = {
  Name: string;
  EventDestinations: StoredEventDestination[];
  TrackingOptions: Record<string, unknown> | undefined;
  DeliveryOptions: Record<string, unknown> | undefined;
  ReputationOptions: {
    SendingEnabled: boolean;
    ReputationMetricsEnabled: boolean;
  };
};

type StoredEventDestination = {
  Name: string;
  Enabled: boolean;
  MatchingEventTypes: string[];
  KinesisFirehoseDestination?: Record<string, unknown>;
  CloudWatchDestination?: Record<string, unknown>;
  SNSDestination?: Record<string, unknown>;
};

type StoredReceiptRuleSet = {
  Name: string;
  CreatedTimestamp: string;
  Rules: StoredReceiptRule[];
};

type StoredReceiptRule = {
  Name: string;
  Enabled: boolean;
  TlsPolicy: string | undefined;
  Recipients: string[];
  Actions: unknown[];
  ScanEnabled: boolean;
};

type StoredReceiptFilter = {
  Name: string;
  IpFilter: {
    Policy: string;
    Cidr: string;
  };
};

type StoredTemplate = {
  TemplateName: string;
  SubjectPart: string;
  TextPart: string;
  HtmlPart: string;
};

type StoredCustomVerificationEmailTemplate = {
  TemplateName: string;
  FromEmailAddress: string;
  TemplateSubject: string;
  TemplateContent: string;
  SuccessRedirectionURL: string;
  FailureRedirectionURL: string;
};

type StoredIdentityNotificationAttributes = {
  BounceTopic: string;
  ComplaintTopic: string;
  DeliveryTopic: string;
  ForwardingEnabled: boolean;
  HeadersInBounceNotificationsEnabled: boolean;
  HeadersInComplaintNotificationsEnabled: boolean;
  HeadersInDeliveryNotificationsEnabled: boolean;
};

type StoredIdentityDkimAttributes = {
  DkimEnabled: boolean;
  DkimVerificationStatus: string;
  DkimTokens: string[];
};

type StoredIdentityMailFromDomainAttributes = {
  MailFromDomain: string;
  MailFromDomainStatus: string;
  BehaviorOnMXFailure: string;
};

type StoredAccountSending = {
  Enabled: boolean;
};

type StoredSendStats = {
  SentLast24Hours: number;
  DeliveryAttempts: number;
};

const identityKey = (identity: string): string => `identity/${identity}`;

const identityTypeOf = (identity: string): string =>
  identity.includes("@") ? "EmailAddress" : "Domain";

const configSetKey = (name: string): string => `configset/${name}`;

const ruleSetKey = (name: string): string => `ruleset/${name}`;

const activeRuleSetKey = (): string => "active_ruleset";

const filterKey = (name: string): string => `filter/${name}`;

const templateKey = (name: string): string => `template/${name}`;

const cvTemplateKey = (name: string): string => `cvtemplate/${name}`;

const identityPolicyKey = (identity: string, policyName: string): string =>
  `policy/${identity}/${policyName}`;

const notifAttrsKey = (identity: string): string => `notif_attrs/${identity}`;

const dkimAttrsKey = (identity: string): string => `dkim/${identity}`;

const mailFromKey = (identity: string): string => `mailfrom/${identity}`;

const accountSendingKey = (): string => "account_sending";

const sendStatsKey = (): string => "send_stats";

const incrementSendStats = (ctx: ServiceContext, count = 1): void => {
  const current = ctx.store.get<StoredSendStats>(sendStatsKey()) ?? {
    SentLast24Hours: 0,
    DeliveryAttempts: 0,
  };
  ctx.store.set(sendStatsKey(), {
    SentLast24Hours: current.SentLast24Hours + count,
    DeliveryAttempts: current.DeliveryAttempts + count,
  });
};

const checkAccountSendingEnabled = (ctx: ServiceContext): void => {
  const stored = ctx.store.get<StoredAccountSending>(accountSendingKey());
  if (stored !== undefined && !stored.Enabled) {
    throw awsError(
      "AccountSendingPausedException",
      "Account sending has been disabled.",
      400,
    );
  }
};

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") {
    return 0;
  }
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterValue", `${key} is required.`, 400);
  }
  return value;
};

const stringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const putIdentity = (ctx: ServiceContext, identity: string): StoredIdentity => {
  const existing = ctx.store.get<StoredIdentity>(identityKey(identity));
  if (existing !== undefined) {
    return existing;
  }
  const stored: StoredIdentity = {
    Identity: identity,
    IdentityType: identityTypeOf(identity),
    VerificationStatus: "Success",
    VerificationToken: crypto.randomUUID().replaceAll("-", ""),
  };
  ctx.store.set(identityKey(identity), stored);
  return stored;
};

const requireConfigSet = (
  ctx: ServiceContext,
  name: string,
): StoredConfigurationSet => {
  const cs = ctx.store.get<StoredConfigurationSet>(configSetKey(name));
  if (cs === undefined) {
    throw awsError(
      "ConfigurationSetDoesNotExistException",
      `Configuration set <${name}> does not exist.`,
      400,
    );
  }
  return cs;
};

const requireRuleSet = (
  ctx: ServiceContext,
  name: string,
): StoredReceiptRuleSet => {
  const rs = ctx.store.get<StoredReceiptRuleSet>(ruleSetKey(name));
  if (rs === undefined) {
    throw awsError(
      "RuleSetDoesNotExistException",
      `Rule set ${name} does not exist.`,
      400,
    );
  }
  return rs;
};

const requireTemplate = (ctx: ServiceContext, name: string): StoredTemplate => {
  const t = ctx.store.get<StoredTemplate>(templateKey(name));
  if (t === undefined) {
    throw awsError(
      "TemplateDoesNotExistException",
      `Template ${name} does not exist.`,
      400,
    );
  }
  return t;
};

const requireIdentity = (
  ctx: ServiceContext,
  identity: string,
): StoredIdentity => {
  const stored = ctx.store.get<StoredIdentity>(identityKey(identity));
  if (stored === undefined) {
    throw awsError(
      "InvalidParameterValue",
      `Identity ${identity} does not exist.`,
      400,
    );
  }
  return stored;
};

const requireFilter = (
  ctx: ServiceContext,
  name: string,
): StoredReceiptFilter => {
  const f = ctx.store.get<StoredReceiptFilter>(filterKey(name));
  if (f === undefined) {
    throw awsError(
      "FilterDoesNotExistException",
      `Filter ${name} does not exist.`,
      400,
    );
  }
  return f;
};

const requireCvTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredCustomVerificationEmailTemplate => {
  const t = ctx.store.get<StoredCustomVerificationEmailTemplate>(
    cvTemplateKey(name),
  );
  if (t === undefined) {
    throw awsError(
      "CustomVerificationEmailTemplateDoesNotExistException",
      `Custom verification email template ${name} does not exist.`,
      400,
    );
  }
  return t;
};

const checkConfigurationSet = (
  ctx: ServiceContext,
  input: Record<string, unknown>,
): void => {
  const name = input["ConfigurationSetName"];
  if (typeof name !== "string" || name === "") return;
  const cs = requireConfigSet(ctx, name);
  if (!cs.ReputationOptions.SendingEnabled) {
    throw awsError(
      "ConfigurationSetSendingPausedException",
      `Configuration set <${name}> has disabled email sending.`,
      400,
    );
  }
};

const getOrDefaultNotifAttrs = (
  ctx: ServiceContext,
  identity: string,
): StoredIdentityNotificationAttributes => {
  return (
    ctx.store.get<StoredIdentityNotificationAttributes>(
      notifAttrsKey(identity),
    ) ?? {
      BounceTopic: "",
      ComplaintTopic: "",
      DeliveryTopic: "",
      ForwardingEnabled: true,
      HeadersInBounceNotificationsEnabled: false,
      HeadersInComplaintNotificationsEnabled: false,
      HeadersInDeliveryNotificationsEnabled: false,
    }
  );
};

const getOrDefaultDkimAttrs = (
  ctx: ServiceContext,
  identity: string,
): StoredIdentityDkimAttributes => {
  return (
    ctx.store.get<StoredIdentityDkimAttributes>(dkimAttrsKey(identity)) ?? {
      DkimEnabled: true,
      DkimVerificationStatus: "NotStarted",
      DkimTokens: [],
    }
  );
};

const renderTemplate = (
  template: string,
  data: Record<string, string>,
): string => {
  let result = template;
  for (const [k, v] of Object.entries(data)) {
    result = result.replaceAll(`{{${k}}}`, v);
  }
  return result;
};

const VerifyEmailIdentity: OperationHandler = (input, ctx) => {
  const emailAddress = requireString(input, "EmailAddress");
  putIdentity(ctx, emailAddress);
  return {};
};

const VerifyEmailAddress: OperationHandler = (input, ctx) => {
  const emailAddress = requireString(input, "EmailAddress");
  putIdentity(ctx, emailAddress);
  return {};
};

const VerifyDomainIdentity: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "Domain");
  const stored = putIdentity(ctx, domain);
  return { VerificationToken: stored.VerificationToken };
};

const VerifyDomainDkim: OperationHandler = (input, ctx) => {
  const domain = requireString(input, "Domain");
  putIdentity(ctx, domain);
  const tokens = [
    crypto.randomUUID().replaceAll("-", "").slice(0, 32),
    crypto.randomUUID().replaceAll("-", "").slice(0, 32),
    crypto.randomUUID().replaceAll("-", "").slice(0, 32),
  ];
  const existing = ctx.store.get<StoredIdentityDkimAttributes>(
    dkimAttrsKey(domain),
  );
  const updated: StoredIdentityDkimAttributes = {
    DkimEnabled: existing?.DkimEnabled ?? true,
    DkimVerificationStatus: "Pending",
    DkimTokens: tokens,
  };
  ctx.store.set(dkimAttrsKey(domain), updated);
  return { DkimTokens: tokens };
};

const ListIdentities: OperationHandler = (input, ctx) => {
  const filterType =
    typeof input["IdentityType"] === "string"
      ? (input["IdentityType"] as string)
      : undefined;
  const maxItems =
    typeof input["MaxItems"] === "number" && input["MaxItems"] > 0
      ? (input["MaxItems"] as number)
      : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredIdentity>()
    .filter((entry) => entry.key.startsWith("identity/"))
    .filter(
      (entry) =>
        filterType === undefined || entry.value.IdentityType === filterType,
    )
    .map((entry) => entry.value.Identity);
  const page =
    maxItems !== undefined
      ? all.slice(offset, offset + maxItems)
      : all.slice(offset);
  const nextOffset = offset + page.length;
  const nextToken =
    maxItems !== undefined && nextOffset < all.length
      ? encodePageToken(nextOffset)
      : undefined;
  return {
    Identities: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const ListVerifiedEmailAddresses: OperationHandler = (_, ctx) => {
  const addresses = ctx.store
    .list<StoredIdentity>()
    .filter((entry) => entry.key.startsWith("identity/"))
    .filter((entry) => entry.value.IdentityType === "EmailAddress")
    .map((entry) => entry.value.Identity);
  return { VerifiedEmailAddresses: addresses };
};

const deleteIdentityCascade = (ctx: ServiceContext, identity: string): void => {
  ctx.store.delete(identityKey(identity));
  ctx.store.delete(dkimAttrsKey(identity));
  ctx.store.delete(notifAttrsKey(identity));
  ctx.store.delete(mailFromKey(identity));
  const prefix = `policy/${identity}/`;
  for (const entry of ctx.store.list()) {
    if (entry.key.startsWith(prefix)) {
      ctx.store.delete(entry.key);
    }
  }
};

const DeleteIdentity: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  deleteIdentityCascade(ctx, identity);
  return {};
};

const DeleteVerifiedEmailAddress: OperationHandler = (input, ctx) => {
  const emailAddress = requireString(input, "EmailAddress");
  deleteIdentityCascade(ctx, emailAddress);
  return {};
};

const SendEmail: OperationHandler = (input, ctx) => {
  checkAccountSendingEnabled(ctx);
  checkConfigurationSet(ctx, input);
  const source = requireString(input, "Source");
  const destination = input["Destination"];
  if (typeof destination !== "object" || destination === null) {
    throw awsError("InvalidParameterValue", "Destination is required.", 400);
  }
  const dest = destination as Record<string, unknown>;
  const recipients = [
    ...stringList(dest["ToAddresses"]),
    ...stringList(dest["CcAddresses"]),
    ...stringList(dest["BccAddresses"]),
  ];
  if (recipients.length === 0) {
    throw awsError(
      "InvalidParameterValue",
      "Destination must contain at least one recipient.",
      400,
    );
  }
  const stored = ctx.store.get<StoredIdentity>(identityKey(source));
  if (stored === undefined) {
    throw awsError(
      "MessageRejected",
      `Email address is not verified. The following identities failed the check in region ${ctx.region}: ${source}`,
      400,
    );
  }
  incrementSendStats(ctx);
  return { MessageId: crypto.randomUUID() };
};

const SendRawEmail: OperationHandler = (input, ctx) => {
  checkAccountSendingEnabled(ctx);
  checkConfigurationSet(ctx, input);
  const rawMessage = input["RawMessage"];
  if (typeof rawMessage !== "object" || rawMessage === null) {
    throw awsError("InvalidParameterValue", "RawMessage is required.", 400);
  }
  const data = (rawMessage as Record<string, unknown>)["Data"];
  if (data === undefined || data === null) {
    throw awsError(
      "InvalidParameterValue",
      "RawMessage.Data is required.",
      400,
    );
  }
  const source = input["Source"];
  if (typeof source === "string" && source !== "") {
    const stored = ctx.store.get<StoredIdentity>(identityKey(source));
    if (stored === undefined) {
      throw awsError(
        "MessageRejected",
        `Email address is not verified. The following identities failed the check in region ${ctx.region}: ${source}`,
        400,
      );
    }
  }
  incrementSendStats(ctx);
  return { MessageId: crypto.randomUUID() };
};

const SendTemplatedEmail: OperationHandler = (input, ctx) => {
  checkAccountSendingEnabled(ctx);
  checkConfigurationSet(ctx, input);
  const source = requireString(input, "Source");
  const templateName = requireString(input, "Template");
  requireTemplate(ctx, templateName);
  const stored = ctx.store.get<StoredIdentity>(identityKey(source));
  if (stored === undefined) {
    throw awsError(
      "MessageRejected",
      `Email address is not verified. The following identities failed the check in region ${ctx.region}: ${source}`,
      400,
    );
  }
  incrementSendStats(ctx);
  return { MessageId: crypto.randomUUID() };
};

const SendBulkTemplatedEmail: OperationHandler = (input, ctx) => {
  checkAccountSendingEnabled(ctx);
  checkConfigurationSet(ctx, input);
  const source = requireString(input, "Source");
  const templateName = requireString(input, "Template");
  requireTemplate(ctx, templateName);
  const stored = ctx.store.get<StoredIdentity>(identityKey(source));
  if (stored === undefined) {
    throw awsError(
      "MessageRejected",
      `Email address is not verified. The following identities failed the check in region ${ctx.region}: ${source}`,
      400,
    );
  }
  const destinations = Array.isArray(input["Destinations"])
    ? input["Destinations"]
    : [];
  incrementSendStats(ctx, destinations.length);
  const statuses = destinations.map(() => ({
    Status: "Success",
    MessageId: crypto.randomUUID(),
  }));
  return { Status: statuses };
};

const SendBounce: OperationHandler = (input, _ctx) => {
  const originalMessageId = requireString(input, "OriginalMessageId");
  return { MessageId: `bounce-${originalMessageId}` };
};

const SendCustomVerificationEmail: OperationHandler = (input, ctx) => {
  const emailAddress = requireString(input, "EmailAddress");
  const templateName = requireString(input, "TemplateName");
  const t = ctx.store.get<StoredCustomVerificationEmailTemplate>(
    cvTemplateKey(templateName),
  );
  if (t === undefined) {
    throw awsError(
      "CustomVerificationEmailTemplateDoesNotExistException",
      `Custom verification email template ${templateName} does not exist.`,
      400,
    );
  }
  return { MessageId: `cvmail-${emailAddress}-${crypto.randomUUID()}` };
};

const GetSendQuota: OperationHandler = (_, ctx) => {
  const stats = ctx.store.get<StoredSendStats>(sendStatsKey()) ?? {
    SentLast24Hours: 0,
    DeliveryAttempts: 0,
  };
  return {
    Max24HourSend: 200,
    MaxSendRate: 1,
    SentLast24Hours: stats.SentLast24Hours,
  };
};

const GetSendStatistics: OperationHandler = (_, ctx) => {
  const stats = ctx.store.get<StoredSendStats>(sendStatsKey()) ?? {
    SentLast24Hours: 0,
    DeliveryAttempts: 0,
  };
  return {
    SendDataPoints: [
      {
        Timestamp: new Date().toISOString(),
        DeliveryAttempts: stats.DeliveryAttempts,
        Bounces: 0,
        Complaints: 0,
        Rejects: 0,
      },
    ],
  };
};

const GetIdentityVerificationAttributes: OperationHandler = (input, ctx) => {
  const identities = stringList(input["Identities"]);
  const attributes: Record<
    string,
    { VerificationStatus: string; VerificationToken?: string }
  > = {};
  for (const identity of identities) {
    const stored = ctx.store.get<StoredIdentity>(identityKey(identity));
    if (stored === undefined) {
      continue;
    }
    attributes[identity] =
      stored.IdentityType === "Domain"
        ? {
            VerificationStatus: stored.VerificationStatus,
            VerificationToken: stored.VerificationToken,
          }
        : { VerificationStatus: stored.VerificationStatus };
  }
  return { VerificationAttributes: attributes };
};

const GetIdentityDkimAttributes: OperationHandler = (input, ctx) => {
  const identities = stringList(input["Identities"]);
  const dkimAttributes: Record<string, StoredIdentityDkimAttributes> = {};
  for (const identity of identities) {
    dkimAttributes[identity] = getOrDefaultDkimAttrs(ctx, identity);
  }
  return { DkimAttributes: dkimAttributes };
};

const SetIdentityDkimEnabled: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const enabled =
    typeof input["DkimEnabled"] === "boolean" ? input["DkimEnabled"] : true;
  const existing = getOrDefaultDkimAttrs(ctx, identity);
  ctx.store.set(dkimAttrsKey(identity), { ...existing, DkimEnabled: enabled });
  return {};
};

const GetIdentityMailFromDomainAttributes: OperationHandler = (input, ctx) => {
  const identities = stringList(input["Identities"]);
  const attrs: Record<string, StoredIdentityMailFromDomainAttributes> = {};
  for (const identity of identities) {
    attrs[identity] = ctx.store.get<StoredIdentityMailFromDomainAttributes>(
      mailFromKey(identity),
    ) ?? {
      MailFromDomain: "",
      MailFromDomainStatus: "Success",
      BehaviorOnMXFailure: "UseDefaultValue",
    };
  }
  return { MailFromDomainAttributes: attrs };
};

const SetIdentityMailFromDomain: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const mailFromDomain =
    typeof input["MailFromDomain"] === "string" ? input["MailFromDomain"] : "";
  const behaviorOnMXFailure =
    typeof input["BehaviorOnMXFailure"] === "string"
      ? input["BehaviorOnMXFailure"]
      : "UseDefaultValue";
  ctx.store.set(mailFromKey(identity), {
    MailFromDomain: mailFromDomain,
    MailFromDomainStatus: "Success",
    BehaviorOnMXFailure: behaviorOnMXFailure,
  });
  return {};
};

const GetIdentityNotificationAttributes: OperationHandler = (input, ctx) => {
  const identities = stringList(input["Identities"]);
  const attrs: Record<string, StoredIdentityNotificationAttributes> = {};
  for (const identity of identities) {
    attrs[identity] = getOrDefaultNotifAttrs(ctx, identity);
  }
  return { NotificationAttributes: attrs };
};

const SetIdentityNotificationTopic: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const notificationType = requireString(input, "NotificationType");
  const snsTopic =
    typeof input["SnsTopic"] === "string" ? input["SnsTopic"] : "";
  const existing = getOrDefaultNotifAttrs(ctx, identity);
  const updated = { ...existing };
  if (notificationType === "Bounce") updated.BounceTopic = snsTopic;
  else if (notificationType === "Complaint") updated.ComplaintTopic = snsTopic;
  else if (notificationType === "Delivery") updated.DeliveryTopic = snsTopic;
  ctx.store.set(notifAttrsKey(identity), updated);
  return {};
};

const SetIdentityFeedbackForwardingEnabled: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const forwardingEnabled =
    typeof input["ForwardingEnabled"] === "boolean"
      ? input["ForwardingEnabled"]
      : true;
  const existing = getOrDefaultNotifAttrs(ctx, identity);
  ctx.store.set(notifAttrsKey(identity), {
    ...existing,
    ForwardingEnabled: forwardingEnabled,
  });
  return {};
};

const SetIdentityHeadersInNotificationsEnabled: OperationHandler = (
  input,
  ctx,
) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const notificationType = requireString(input, "NotificationType");
  const enabled =
    typeof input["Enabled"] === "boolean" ? input["Enabled"] : false;
  const existing = getOrDefaultNotifAttrs(ctx, identity);
  const updated = { ...existing };
  if (notificationType === "Bounce")
    updated.HeadersInBounceNotificationsEnabled = enabled;
  else if (notificationType === "Complaint")
    updated.HeadersInComplaintNotificationsEnabled = enabled;
  else if (notificationType === "Delivery")
    updated.HeadersInDeliveryNotificationsEnabled = enabled;
  ctx.store.set(notifAttrsKey(identity), updated);
  return {};
};

const GetIdentityPolicies: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  const policyNames = stringList(input["PolicyNames"]);
  const policies: Record<string, string> = {};
  for (const name of policyNames) {
    const policy = ctx.store.get<{ PolicyDocument: string }>(
      identityPolicyKey(identity, name),
    );
    if (policy !== undefined) {
      policies[name] = policy.PolicyDocument;
    }
  }
  return { Policies: policies };
};

const ListIdentityPolicies: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  const prefix = `policy/${identity}/`;
  const names = ctx.store
    .list<{ PolicyDocument: string }>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.key.slice(prefix.length));
  return { PolicyNames: names };
};

const PutIdentityPolicy: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const policyName = requireString(input, "PolicyName");
  const policy = requireString(input, "Policy");
  ctx.store.set(identityPolicyKey(identity, policyName), {
    PolicyDocument: policy,
  });
  return {};
};

const DeleteIdentityPolicy: OperationHandler = (input, ctx) => {
  const identity = requireString(input, "Identity");
  requireIdentity(ctx, identity);
  const policyName = requireString(input, "PolicyName");
  ctx.store.delete(identityPolicyKey(identity, policyName));
  return {};
};

const GetAccountSendingEnabled: OperationHandler = (_, ctx) => {
  const stored = ctx.store.get<StoredAccountSending>(accountSendingKey());
  return { Enabled: stored?.Enabled ?? true };
};

const UpdateAccountSendingEnabled: OperationHandler = (input, ctx) => {
  const enabled =
    typeof input["Enabled"] === "boolean" ? input["Enabled"] : true;
  ctx.store.set(accountSendingKey(), { Enabled: enabled });
  return {};
};

const CreateConfigurationSet: OperationHandler = (input, ctx) => {
  const configSetInput = input["ConfigurationSet"];
  if (typeof configSetInput !== "object" || configSetInput === null) {
    throw awsError(
      "InvalidParameterValue",
      "ConfigurationSet is required.",
      400,
    );
  }
  const name = requireString(configSetInput as Record<string, unknown>, "Name");
  const existing = ctx.store.get<StoredConfigurationSet>(configSetKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ConfigurationSetAlreadyExistsException",
      `Configuration set ${name} already exists.`,
      400,
    );
  }
  const cs: StoredConfigurationSet = {
    Name: name,
    EventDestinations: [],
    TrackingOptions: undefined,
    DeliveryOptions: undefined,
    ReputationOptions: {
      SendingEnabled: true,
      ReputationMetricsEnabled: false,
    },
  };
  ctx.store.set(configSetKey(name), cs);
  return {};
};

const DeleteConfigurationSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ConfigurationSetName");
  requireConfigSet(ctx, name);
  ctx.store.delete(configSetKey(name));
  return {};
};

const DescribeConfigurationSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, name);
  return {
    ConfigurationSet: { Name: cs.Name },
    EventDestinations: cs.EventDestinations,
    TrackingOptions: cs.TrackingOptions,
    DeliveryOptions: cs.DeliveryOptions,
    ReputationOptions: cs.ReputationOptions,
  };
};

const ListConfigurationSets: OperationHandler = (input, ctx) => {
  const maxItems =
    typeof input["MaxItems"] === "number" && input["MaxItems"] > 0
      ? (input["MaxItems"] as number)
      : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredConfigurationSet>()
    .filter((entry) => entry.key.startsWith("configset/"))
    .map((entry) => ({ Name: entry.value.Name }));
  const page =
    maxItems !== undefined
      ? all.slice(offset, offset + maxItems)
      : all.slice(offset);
  const nextOffset = offset + page.length;
  const nextToken =
    maxItems !== undefined && nextOffset < all.length
      ? encodePageToken(nextOffset)
      : undefined;
  return {
    ConfigurationSets: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const CreateConfigurationSetEventDestination: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  const edInput = input["EventDestination"];
  if (typeof edInput !== "object" || edInput === null) {
    throw awsError(
      "InvalidParameterValue",
      "EventDestination is required.",
      400,
    );
  }
  const ed = edInput as Record<string, unknown>;
  const name = requireString(ed, "Name");
  if (cs.EventDestinations.some((d) => d.Name === name)) {
    throw awsError(
      "EventDestinationAlreadyExistsException",
      `Event destination ${name} already exists.`,
      400,
    );
  }
  const dest: StoredEventDestination = {
    Name: name,
    Enabled: typeof ed["Enabled"] === "boolean" ? ed["Enabled"] : false,
    MatchingEventTypes: stringList(ed["MatchingEventTypes"]),
    KinesisFirehoseDestination:
      typeof ed["KinesisFirehoseDestination"] === "object" &&
      ed["KinesisFirehoseDestination"] !== null
        ? (ed["KinesisFirehoseDestination"] as Record<string, unknown>)
        : undefined,
    CloudWatchDestination:
      typeof ed["CloudWatchDestination"] === "object" &&
      ed["CloudWatchDestination"] !== null
        ? (ed["CloudWatchDestination"] as Record<string, unknown>)
        : undefined,
    SNSDestination:
      typeof ed["SNSDestination"] === "object" && ed["SNSDestination"] !== null
        ? (ed["SNSDestination"] as Record<string, unknown>)
        : undefined,
  };
  ctx.store.set(configSetKey(csName), {
    ...cs,
    EventDestinations: [...cs.EventDestinations, dest],
  });
  return {};
};

const UpdateConfigurationSetEventDestination: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  const edInput = input["EventDestination"];
  if (typeof edInput !== "object" || edInput === null) {
    throw awsError(
      "InvalidParameterValue",
      "EventDestination is required.",
      400,
    );
  }
  const ed = edInput as Record<string, unknown>;
  const name = requireString(ed, "Name");
  const existingIdx = cs.EventDestinations.findIndex((d) => d.Name === name);
  if (existingIdx === -1) {
    throw awsError(
      "EventDestinationDoesNotExistException",
      `Event destination ${name} does not exist.`,
      400,
    );
  }
  const updated: StoredEventDestination = {
    Name: name,
    Enabled: typeof ed["Enabled"] === "boolean" ? ed["Enabled"] : false,
    MatchingEventTypes: stringList(ed["MatchingEventTypes"]),
    KinesisFirehoseDestination:
      typeof ed["KinesisFirehoseDestination"] === "object" &&
      ed["KinesisFirehoseDestination"] !== null
        ? (ed["KinesisFirehoseDestination"] as Record<string, unknown>)
        : undefined,
    CloudWatchDestination:
      typeof ed["CloudWatchDestination"] === "object" &&
      ed["CloudWatchDestination"] !== null
        ? (ed["CloudWatchDestination"] as Record<string, unknown>)
        : undefined,
    SNSDestination:
      typeof ed["SNSDestination"] === "object" && ed["SNSDestination"] !== null
        ? (ed["SNSDestination"] as Record<string, unknown>)
        : undefined,
  };
  const newDests = [...cs.EventDestinations];
  newDests[existingIdx] = updated;
  ctx.store.set(configSetKey(csName), { ...cs, EventDestinations: newDests });
  return {};
};

const DeleteConfigurationSetEventDestination: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  const edName = requireString(input, "EventDestinationName");
  const existingIdx = cs.EventDestinations.findIndex((d) => d.Name === edName);
  if (existingIdx === -1) {
    throw awsError(
      "EventDestinationDoesNotExistException",
      `Event destination ${edName} does not exist.`,
      400,
    );
  }
  const newDests = cs.EventDestinations.filter((d) => d.Name !== edName);
  ctx.store.set(configSetKey(csName), { ...cs, EventDestinations: newDests });
  return {};
};

const CreateConfigurationSetTrackingOptions: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  if (cs.TrackingOptions !== undefined) {
    throw awsError(
      "TrackingOptionsAlreadyExistsException",
      `Tracking options already exist for configuration set ${csName}.`,
      400,
    );
  }
  const trackingOptions = input["TrackingOptions"] ?? {};
  ctx.store.set(configSetKey(csName), {
    ...cs,
    TrackingOptions: trackingOptions as Record<string, unknown>,
  });
  return {};
};

const UpdateConfigurationSetTrackingOptions: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  if (cs.TrackingOptions === undefined) {
    throw awsError(
      "TrackingOptionsDoesNotExistException",
      `Tracking options do not exist for configuration set ${csName}.`,
      400,
    );
  }
  const trackingOptions = input["TrackingOptions"] ?? {};
  ctx.store.set(configSetKey(csName), {
    ...cs,
    TrackingOptions: trackingOptions as Record<string, unknown>,
  });
  return {};
};

const DeleteConfigurationSetTrackingOptions: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  ctx.store.set(configSetKey(csName), {
    ...cs,
    TrackingOptions: undefined,
  });
  return {};
};

const PutConfigurationSetDeliveryOptions: OperationHandler = (input, ctx) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  const deliveryOptions = input["DeliveryOptions"] ?? {};
  ctx.store.set(configSetKey(csName), {
    ...cs,
    DeliveryOptions: deliveryOptions as Record<string, unknown>,
  });
  return {};
};

const UpdateConfigurationSetReputationMetricsEnabled: OperationHandler = (
  input,
  ctx,
) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  const enabled =
    typeof input["Enabled"] === "boolean" ? input["Enabled"] : false;
  ctx.store.set(configSetKey(csName), {
    ...cs,
    ReputationOptions: {
      ...cs.ReputationOptions,
      ReputationMetricsEnabled: enabled,
    },
  });
  return {};
};

const UpdateConfigurationSetSendingEnabled: OperationHandler = (input, ctx) => {
  const csName = requireString(input, "ConfigurationSetName");
  const cs = requireConfigSet(ctx, csName);
  const enabled =
    typeof input["Enabled"] === "boolean" ? input["Enabled"] : true;
  ctx.store.set(configSetKey(csName), {
    ...cs,
    ReputationOptions: { ...cs.ReputationOptions, SendingEnabled: enabled },
  });
  return {};
};

const CreateReceiptRuleSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RuleSetName");
  const existing = ctx.store.get<StoredReceiptRuleSet>(ruleSetKey(name));
  if (existing !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Rule set ${name} already exists.`,
      400,
    );
  }
  const rs: StoredReceiptRuleSet = {
    Name: name,
    CreatedTimestamp: new Date().toISOString(),
    Rules: [],
  };
  ctx.store.set(ruleSetKey(name), rs);
  return {};
};

const DeleteReceiptRuleSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RuleSetName");
  requireRuleSet(ctx, name);
  const active = ctx.store.get<{ Name: string }>(activeRuleSetKey());
  if (active?.Name === name) {
    throw awsError(
      "CannotDeleteException",
      `Cannot delete active rule set ${name}.`,
      400,
    );
  }
  ctx.store.delete(ruleSetKey(name));
  return {};
};

const DescribeReceiptRuleSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, name);
  return {
    Metadata: { Name: rs.Name, CreatedTimestamp: rs.CreatedTimestamp },
    Rules: rs.Rules,
  };
};

const LIST_RECEIPT_RULE_SETS_PAGE_SIZE = 100;

const ListReceiptRuleSets: OperationHandler = (input, ctx) => {
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredReceiptRuleSet>()
    .filter((entry) => entry.key.startsWith("ruleset/"))
    .map((entry) => ({
      Name: entry.value.Name,
      CreatedTimestamp: entry.value.CreatedTimestamp,
    }));
  const page = all.slice(offset, offset + LIST_RECEIPT_RULE_SETS_PAGE_SIZE);
  const nextOffset = offset + page.length;
  const nextToken =
    nextOffset < all.length ? encodePageToken(nextOffset) : undefined;
  return {
    RuleSets: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const CloneReceiptRuleSet: OperationHandler = (input, ctx) => {
  const originalName = requireString(input, "OriginalRuleSetName");
  const newName = requireString(input, "RuleSetName");
  const original = requireRuleSet(ctx, originalName);
  const existing = ctx.store.get<StoredReceiptRuleSet>(ruleSetKey(newName));
  if (existing !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Rule set ${newName} already exists.`,
      400,
    );
  }
  const cloned: StoredReceiptRuleSet = {
    Name: newName,
    CreatedTimestamp: new Date().toISOString(),
    Rules: original.Rules.map((r) => ({ ...r })),
  };
  ctx.store.set(ruleSetKey(newName), cloned);
  return {};
};

const SetActiveReceiptRuleSet: OperationHandler = (input, ctx) => {
  const name = input["RuleSetName"];
  if (name === undefined || name === null) {
    ctx.store.delete(activeRuleSetKey());
    return {};
  }
  const nameStr = requireString(input, "RuleSetName");
  requireRuleSet(ctx, nameStr);
  ctx.store.set(activeRuleSetKey(), { Name: nameStr });
  return {};
};

const DescribeActiveReceiptRuleSet: OperationHandler = (_, ctx) => {
  const active = ctx.store.get<{ Name: string }>(activeRuleSetKey());
  if (active === undefined) {
    return {};
  }
  const rs = ctx.store.get<StoredReceiptRuleSet>(ruleSetKey(active.Name));
  if (rs === undefined) {
    return {};
  }
  return {
    Metadata: { Name: rs.Name, CreatedTimestamp: rs.CreatedTimestamp },
    Rules: rs.Rules,
  };
};

const CreateReceiptRule: OperationHandler = (input, ctx) => {
  const ruleSetName = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, ruleSetName);
  const ruleInput = input["Rule"];
  if (typeof ruleInput !== "object" || ruleInput === null) {
    throw awsError("InvalidParameterValue", "Rule is required.", 400);
  }
  const rule = ruleInput as Record<string, unknown>;
  const name = requireString(rule, "Name");
  if (rs.Rules.some((r) => r.Name === name)) {
    throw awsError(
      "AlreadyExistsException",
      `Rule ${name} already exists.`,
      400,
    );
  }
  const storedRule: StoredReceiptRule = {
    Name: name,
    Enabled: typeof rule["Enabled"] === "boolean" ? rule["Enabled"] : false,
    TlsPolicy:
      typeof rule["TlsPolicy"] === "string" ? rule["TlsPolicy"] : undefined,
    Recipients: stringList(rule["Recipients"]),
    Actions: Array.isArray(rule["Actions"]) ? rule["Actions"] : [],
    ScanEnabled:
      typeof rule["ScanEnabled"] === "boolean" ? rule["ScanEnabled"] : false,
  };
  const after = input["After"];
  let newRules: StoredReceiptRule[];
  if (typeof after === "string" && after !== "") {
    const afterIdx = rs.Rules.findIndex((r) => r.Name === after);
    if (afterIdx === -1) {
      newRules = [...rs.Rules, storedRule];
    } else {
      newRules = [
        ...rs.Rules.slice(0, afterIdx + 1),
        storedRule,
        ...rs.Rules.slice(afterIdx + 1),
      ];
    }
  } else {
    newRules = [storedRule, ...rs.Rules];
  }
  ctx.store.set(ruleSetKey(ruleSetName), { ...rs, Rules: newRules });
  return {};
};

const UpdateReceiptRule: OperationHandler = (input, ctx) => {
  const ruleSetName = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, ruleSetName);
  const ruleInput = input["Rule"];
  if (typeof ruleInput !== "object" || ruleInput === null) {
    throw awsError("InvalidParameterValue", "Rule is required.", 400);
  }
  const rule = ruleInput as Record<string, unknown>;
  const name = requireString(rule, "Name");
  const existingIdx = rs.Rules.findIndex((r) => r.Name === name);
  if (existingIdx === -1) {
    throw awsError(
      "RuleDoesNotExistException",
      `Rule ${name} does not exist.`,
      400,
    );
  }
  const updated: StoredReceiptRule = {
    Name: name,
    Enabled: typeof rule["Enabled"] === "boolean" ? rule["Enabled"] : false,
    TlsPolicy:
      typeof rule["TlsPolicy"] === "string" ? rule["TlsPolicy"] : undefined,
    Recipients: stringList(rule["Recipients"]),
    Actions: Array.isArray(rule["Actions"]) ? rule["Actions"] : [],
    ScanEnabled:
      typeof rule["ScanEnabled"] === "boolean" ? rule["ScanEnabled"] : false,
  };
  const newRules = [...rs.Rules];
  newRules[existingIdx] = updated;
  ctx.store.set(ruleSetKey(ruleSetName), { ...rs, Rules: newRules });
  return {};
};

const DeleteReceiptRule: OperationHandler = (input, ctx) => {
  const ruleSetName = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, ruleSetName);
  const ruleName = requireString(input, "RuleName");
  const ruleExists = rs.Rules.some((r) => r.Name === ruleName);
  if (!ruleExists) {
    throw awsError(
      "RuleDoesNotExistException",
      `Rule ${ruleName} does not exist.`,
      400,
    );
  }
  const newRules = rs.Rules.filter((r) => r.Name !== ruleName);
  ctx.store.set(ruleSetKey(ruleSetName), { ...rs, Rules: newRules });
  return {};
};

const DescribeReceiptRule: OperationHandler = (input, ctx) => {
  const ruleSetName = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, ruleSetName);
  const ruleName = requireString(input, "RuleName");
  const rule = rs.Rules.find((r) => r.Name === ruleName);
  if (rule === undefined) {
    throw awsError(
      "RuleDoesNotExistException",
      `Rule ${ruleName} does not exist.`,
      400,
    );
  }
  return { Rule: rule };
};

const ReorderReceiptRuleSet: OperationHandler = (input, ctx) => {
  const ruleSetName = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, ruleSetName);
  const ruleNames = stringList(input["RuleNames"]);
  const newRules = ruleNames
    .map((name) => rs.Rules.find((r) => r.Name === name))
    .filter((r): r is StoredReceiptRule => r !== undefined);
  ctx.store.set(ruleSetKey(ruleSetName), { ...rs, Rules: newRules });
  return {};
};

const SetReceiptRulePosition: OperationHandler = (input, ctx) => {
  const ruleSetName = requireString(input, "RuleSetName");
  const rs = requireRuleSet(ctx, ruleSetName);
  const ruleName = requireString(input, "RuleName");
  const after = input["After"];
  const rule = rs.Rules.find((r) => r.Name === ruleName);
  if (rule === undefined) {
    throw awsError(
      "RuleDoesNotExistException",
      `Rule ${ruleName} does not exist.`,
      400,
    );
  }
  const withoutRule = rs.Rules.filter((r) => r.Name !== ruleName);
  let newRules: StoredReceiptRule[];
  if (typeof after === "string" && after !== "") {
    const afterIdx = withoutRule.findIndex((r) => r.Name === after);
    if (afterIdx === -1) {
      newRules = [...withoutRule, rule];
    } else {
      newRules = [
        ...withoutRule.slice(0, afterIdx + 1),
        rule,
        ...withoutRule.slice(afterIdx + 1),
      ];
    }
  } else {
    newRules = [rule, ...withoutRule];
  }
  ctx.store.set(ruleSetKey(ruleSetName), { ...rs, Rules: newRules });
  return {};
};

const CreateReceiptFilter: OperationHandler = (input, ctx) => {
  const filterInput = input["Filter"];
  if (typeof filterInput !== "object" || filterInput === null) {
    throw awsError("InvalidParameterValue", "Filter is required.", 400);
  }
  const f = filterInput as Record<string, unknown>;
  const name = requireString(f, "Name");
  const existing = ctx.store.get<StoredReceiptFilter>(filterKey(name));
  if (existing !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Filter ${name} already exists.`,
      400,
    );
  }
  const ipFilterInput = f["IpFilter"];
  if (typeof ipFilterInput !== "object" || ipFilterInput === null) {
    throw awsError("InvalidParameterValue", "IpFilter is required.", 400);
  }
  const ipFilter = ipFilterInput as Record<string, unknown>;
  const stored: StoredReceiptFilter = {
    Name: name,
    IpFilter: {
      Policy:
        typeof ipFilter["Policy"] === "string" ? ipFilter["Policy"] : "Block",
      Cidr: typeof ipFilter["Cidr"] === "string" ? ipFilter["Cidr"] : "",
    },
  };
  ctx.store.set(filterKey(name), stored);
  return {};
};

const DeleteReceiptFilter: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FilterName");
  requireFilter(ctx, name);
  ctx.store.delete(filterKey(name));
  return {};
};

const ListReceiptFilters: OperationHandler = (_, ctx) => {
  const filters = ctx.store
    .list<StoredReceiptFilter>()
    .filter((entry) => entry.key.startsWith("filter/"))
    .map((entry) => entry.value);
  return { Filters: filters };
};

const CreateTemplate: OperationHandler = (input, ctx) => {
  const templateInput = input["Template"];
  if (typeof templateInput !== "object" || templateInput === null) {
    throw awsError("InvalidParameterValue", "Template is required.", 400);
  }
  const t = templateInput as Record<string, unknown>;
  const name = requireString(t, "TemplateName");
  const existing = ctx.store.get<StoredTemplate>(templateKey(name));
  if (existing !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Template ${name} already exists.`,
      400,
    );
  }
  const stored: StoredTemplate = {
    TemplateName: name,
    SubjectPart: typeof t["SubjectPart"] === "string" ? t["SubjectPart"] : "",
    TextPart: typeof t["TextPart"] === "string" ? t["TextPart"] : "",
    HtmlPart: typeof t["HtmlPart"] === "string" ? t["HtmlPart"] : "",
  };
  ctx.store.set(templateKey(name), stored);
  return {};
};

const DeleteTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TemplateName");
  requireTemplate(ctx, name);
  ctx.store.delete(templateKey(name));
  return {};
};

const GetTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TemplateName");
  const t = requireTemplate(ctx, name);
  return { Template: t };
};

const ListTemplates: OperationHandler = (input, ctx) => {
  const maxItems =
    typeof input["MaxItems"] === "number" && input["MaxItems"] > 0
      ? (input["MaxItems"] as number)
      : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredTemplate>()
    .filter((entry) => entry.key.startsWith("template/"))
    .map((entry) => ({ Name: entry.value.TemplateName }));
  const page =
    maxItems !== undefined
      ? all.slice(offset, offset + maxItems)
      : all.slice(offset);
  const nextOffset = offset + page.length;
  const nextToken =
    maxItems !== undefined && nextOffset < all.length
      ? encodePageToken(nextOffset)
      : undefined;
  return {
    TemplatesMetadata: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const UpdateTemplate: OperationHandler = (input, ctx) => {
  const templateInput = input["Template"];
  if (typeof templateInput !== "object" || templateInput === null) {
    throw awsError("InvalidParameterValue", "Template is required.", 400);
  }
  const t = templateInput as Record<string, unknown>;
  const name = requireString(t, "TemplateName");
  requireTemplate(ctx, name);
  const updated: StoredTemplate = {
    TemplateName: name,
    SubjectPart: typeof t["SubjectPart"] === "string" ? t["SubjectPart"] : "",
    TextPart: typeof t["TextPart"] === "string" ? t["TextPart"] : "",
    HtmlPart: typeof t["HtmlPart"] === "string" ? t["HtmlPart"] : "",
  };
  ctx.store.set(templateKey(name), updated);
  return {};
};

const TestRenderTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TemplateName");
  const t = requireTemplate(ctx, name);
  const templateDataStr =
    typeof input["TemplateData"] === "string" ? input["TemplateData"] : "{}";
  let data: Record<string, string> = {};
  try {
    data = JSON.parse(templateDataStr) as Record<string, string>;
  } catch {
    data = {};
  }
  const subject = renderTemplate(t.SubjectPart, data);
  const textPart = renderTemplate(t.TextPart, data);
  const htmlPart = renderTemplate(t.HtmlPart, data);
  return { RenderedTemplate: `Subject: ${subject}\n\n${textPart || htmlPart}` };
};

const CreateCustomVerificationEmailTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "TemplateName");
  const existing = ctx.store.get<StoredCustomVerificationEmailTemplate>(
    cvTemplateKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "CustomVerificationEmailTemplateAlreadyExistsException",
      `Custom verification email template ${name} already exists.`,
      400,
    );
  }
  const stored: StoredCustomVerificationEmailTemplate = {
    TemplateName: name,
    FromEmailAddress:
      typeof input["FromEmailAddress"] === "string"
        ? input["FromEmailAddress"]
        : "",
    TemplateSubject:
      typeof input["TemplateSubject"] === "string"
        ? input["TemplateSubject"]
        : "",
    TemplateContent:
      typeof input["TemplateContent"] === "string"
        ? input["TemplateContent"]
        : "",
    SuccessRedirectionURL:
      typeof input["SuccessRedirectionURL"] === "string"
        ? input["SuccessRedirectionURL"]
        : "",
    FailureRedirectionURL:
      typeof input["FailureRedirectionURL"] === "string"
        ? input["FailureRedirectionURL"]
        : "",
  };
  ctx.store.set(cvTemplateKey(name), stored);
  return {};
};

const DeleteCustomVerificationEmailTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "TemplateName");
  requireCvTemplate(ctx, name);
  ctx.store.delete(cvTemplateKey(name));
  return {};
};

const GetCustomVerificationEmailTemplate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TemplateName");
  const t = ctx.store.get<StoredCustomVerificationEmailTemplate>(
    cvTemplateKey(name),
  );
  if (t === undefined) {
    throw awsError(
      "CustomVerificationEmailTemplateDoesNotExistException",
      `Custom verification email template ${name} does not exist.`,
      400,
    );
  }
  return t;
};

const ListCustomVerificationEmailTemplates: OperationHandler = (input, ctx) => {
  const maxItems =
    typeof input["MaxItems"] === "number" && input["MaxItems"] > 0
      ? (input["MaxItems"] as number)
      : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredCustomVerificationEmailTemplate>()
    .filter((entry) => entry.key.startsWith("cvtemplate/"))
    .map((entry) => ({
      TemplateName: entry.value.TemplateName,
      FromEmailAddress: entry.value.FromEmailAddress,
      TemplateSubject: entry.value.TemplateSubject,
      SuccessRedirectionURL: entry.value.SuccessRedirectionURL,
      FailureRedirectionURL: entry.value.FailureRedirectionURL,
    }));
  const page =
    maxItems !== undefined
      ? all.slice(offset, offset + maxItems)
      : all.slice(offset);
  const nextOffset = offset + page.length;
  const nextToken =
    maxItems !== undefined && nextOffset < all.length
      ? encodePageToken(nextOffset)
      : undefined;
  return {
    CustomVerificationEmailTemplates: page,
    ...(nextToken !== undefined ? { NextToken: nextToken } : {}),
  };
};

const UpdateCustomVerificationEmailTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const name = requireString(input, "TemplateName");
  const existing = ctx.store.get<StoredCustomVerificationEmailTemplate>(
    cvTemplateKey(name),
  );
  if (existing === undefined) {
    throw awsError(
      "CustomVerificationEmailTemplateDoesNotExistException",
      `Custom verification email template ${name} does not exist.`,
      400,
    );
  }
  const updated: StoredCustomVerificationEmailTemplate = {
    TemplateName: name,
    FromEmailAddress:
      typeof input["FromEmailAddress"] === "string"
        ? input["FromEmailAddress"]
        : existing.FromEmailAddress,
    TemplateSubject:
      typeof input["TemplateSubject"] === "string"
        ? input["TemplateSubject"]
        : existing.TemplateSubject,
    TemplateContent:
      typeof input["TemplateContent"] === "string"
        ? input["TemplateContent"]
        : existing.TemplateContent,
    SuccessRedirectionURL:
      typeof input["SuccessRedirectionURL"] === "string"
        ? input["SuccessRedirectionURL"]
        : existing.SuccessRedirectionURL,
    FailureRedirectionURL:
      typeof input["FailureRedirectionURL"] === "string"
        ? input["FailureRedirectionURL"]
        : existing.FailureRedirectionURL,
  };
  ctx.store.set(cvTemplateKey(name), updated);
  return {};
};

const ses = {
  name: "ses",
  protocol: "query",
  operations: {
    VerifyEmailIdentity,
    VerifyEmailAddress,
    VerifyDomainIdentity,
    VerifyDomainDkim,
    ListIdentities,
    ListVerifiedEmailAddresses,
    DeleteIdentity,
    DeleteVerifiedEmailAddress,
    SendEmail,
    SendRawEmail,
    SendTemplatedEmail,
    SendBulkTemplatedEmail,
    SendBounce,
    SendCustomVerificationEmail,
    GetSendQuota,
    GetSendStatistics,
    GetIdentityVerificationAttributes,
    GetIdentityDkimAttributes,
    SetIdentityDkimEnabled,
    GetIdentityMailFromDomainAttributes,
    SetIdentityMailFromDomain,
    GetIdentityNotificationAttributes,
    SetIdentityNotificationTopic,
    SetIdentityFeedbackForwardingEnabled,
    SetIdentityHeadersInNotificationsEnabled,
    GetIdentityPolicies,
    ListIdentityPolicies,
    PutIdentityPolicy,
    DeleteIdentityPolicy,
    GetAccountSendingEnabled,
    UpdateAccountSendingEnabled,
    CreateConfigurationSet,
    DeleteConfigurationSet,
    DescribeConfigurationSet,
    ListConfigurationSets,
    CreateConfigurationSetEventDestination,
    UpdateConfigurationSetEventDestination,
    DeleteConfigurationSetEventDestination,
    CreateConfigurationSetTrackingOptions,
    UpdateConfigurationSetTrackingOptions,
    DeleteConfigurationSetTrackingOptions,
    PutConfigurationSetDeliveryOptions,
    UpdateConfigurationSetReputationMetricsEnabled,
    UpdateConfigurationSetSendingEnabled,
    CreateReceiptRuleSet,
    DeleteReceiptRuleSet,
    DescribeReceiptRuleSet,
    ListReceiptRuleSets,
    CloneReceiptRuleSet,
    SetActiveReceiptRuleSet,
    DescribeActiveReceiptRuleSet,
    CreateReceiptRule,
    UpdateReceiptRule,
    DeleteReceiptRule,
    DescribeReceiptRule,
    ReorderReceiptRuleSet,
    SetReceiptRulePosition,
    CreateReceiptFilter,
    DeleteReceiptFilter,
    ListReceiptFilters,
    CreateTemplate,
    DeleteTemplate,
    GetTemplate,
    ListTemplates,
    UpdateTemplate,
    TestRenderTemplate,
    CreateCustomVerificationEmailTemplate,
    DeleteCustomVerificationEmailTemplate,
    GetCustomVerificationEmailTemplate,
    ListCustomVerificationEmailTemplates,
    UpdateCustomVerificationEmailTemplate,
  },
  model,
} as const satisfies ServiceDefinition;

export default ses;
