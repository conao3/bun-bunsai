import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import sesv2Model from "../../../../test/vendor/aws-models/sesv2.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(sesv2Model);

type Tag = { Key: string; Value: string };

type StoredIdentityV2 = {
  EmailIdentity: string;
  IdentityType: string;
  VerifiedForSendingStatus: boolean;
  DkimAttributes: {
    SigningEnabled: boolean;
    Status: string;
    Tokens: string[];
    SigningAttributesOrigin: string;
    NextSigningKeyLength: string;
    CurrentSigningKeyLength: string;
    LastKeyGenerationTimestamp: string;
  };
  MailFromAttributes: {
    MailFromDomain: string;
    MailFromDomainStatus: string;
    BehaviorOnMxFailure: string;
  };
  FeedbackForwardingStatus: boolean;
  Tags: Tag[];
  ConfigurationSetName: string | undefined;
};

type StoredConfigurationSetV2 = {
  ConfigurationSetName: string;
  TrackingOptions: Record<string, unknown> | undefined;
  DeliveryOptions: Record<string, unknown> | undefined;
  ReputationOptions: Record<string, unknown> | undefined;
  SendingOptions: { SendingEnabled: boolean } | undefined;
  SuppressionOptions: Record<string, unknown> | undefined;
  VdmOptions: Record<string, unknown> | undefined;
  Tags: Tag[];
  EventDestinations: StoredEventDestinationV2[];
};

type StoredEventDestinationV2 = {
  Name: string;
  Enabled: boolean;
  MatchingEventTypes: string[];
  KinesisFirehoseDestination?: Record<string, unknown>;
  CloudWatchDestination?: Record<string, unknown>;
  SnsDestination?: Record<string, unknown>;
  PinpointDestination?: Record<string, unknown>;
  SesDestination?: Record<string, unknown>;
};

type StoredEmailTemplateV2 = {
  TemplateName: string;
  TemplateContent: {
    Subject?: string;
    Text?: string;
    Html?: string;
  };
  Tags: Tag[];
  CreatedTimestamp: string;
};

type StoredSuppressedDestination = {
  EmailAddress: string;
  Reason: string;
  LastUpdateTime: string;
};

const v1IdentityKey = (identity: string): string => `identity/${identity}`;
const identityKey = (identity: string): string => `v2identity/${identity}`;
const configSetKey = (name: string): string => `v2configset/${name}`;
const templateKey = (name: string): string => `v2template/${name}`;
const suppressedKey = (email: string): string => `v2suppressed/${email}`;
const tagsKey = (arn: string): string => `v2tags/${arn}`;

const identityTypeOf = (identity: string): string =>
  identity.includes("@") ? "EMAIL_ADDRESS" : "DOMAIN";

const requireConfigSet = (
  ctx: ServiceContext,
  name: string,
): StoredConfigurationSetV2 => {
  const cs = ctx.store.get<StoredConfigurationSetV2>(configSetKey(name));
  if (cs === undefined) {
    throw awsError(
      "NotFoundException",
      `The specified configuration set does not exist.`,
      404,
    );
  }
  return cs;
};

const requireTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredEmailTemplateV2 => {
  const t = ctx.store.get<StoredEmailTemplateV2>(templateKey(name));
  if (t === undefined) {
    throw awsError(
      "NotFoundException",
      `Template ${name} does not exist.`,
      404,
    );
  }
  return t;
};

const getIdentityFromStore = (
  ctx: ServiceContext,
  identity: string,
): StoredIdentityV2 | undefined => {
  const v2 = ctx.store.get<StoredIdentityV2>(identityKey(identity));
  if (v2 !== undefined) return v2;
  const v1 = ctx.store.get<{ Identity: string; VerificationStatus: string }>(
    v1IdentityKey(identity),
  );
  if (v1 === undefined) return undefined;
  return {
    EmailIdentity: v1.Identity,
    IdentityType: identityTypeOf(v1.Identity),
    VerifiedForSendingStatus: v1.VerificationStatus === "Success",
    DkimAttributes: {
      SigningEnabled: false,
      Status: "NOT_STARTED",
      Tokens: [],
      SigningAttributesOrigin: "AWS_SES",
      NextSigningKeyLength: "RSA_2048_BIT",
      CurrentSigningKeyLength: "RSA_2048_BIT",
      LastKeyGenerationTimestamp: new Date().toISOString(),
    },
    MailFromAttributes: {
      MailFromDomain: "",
      MailFromDomainStatus: "NOT_STARTED",
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    },
    FeedbackForwardingStatus: true,
    Tags: [],
    ConfigurationSetName: undefined,
  };
};

const requireIdentity = (
  ctx: ServiceContext,
  identity: string,
): StoredIdentityV2 => {
  const stored = getIdentityFromStore(ctx, identity);
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `The specified email identity does not exist.`,
      404,
    );
  }
  return stored;
};

const isSuppressed = (ctx: ServiceContext, email: string): boolean => {
  return (
    ctx.store.get<StoredSuppressedDestination>(suppressedKey(email)) !==
    undefined
  );
};

const CreateEmailIdentity: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  const existing = getIdentityFromStore(ctx, identity);
  if (
    existing !== undefined &&
    ctx.store.get(identityKey(identity)) !== undefined
  ) {
    throw awsError(
      "AlreadyExistsException",
      `The specified email identity already exists.`,
      400,
    );
  }
  const stored: StoredIdentityV2 = {
    EmailIdentity: identity,
    IdentityType: identityTypeOf(identity),
    VerifiedForSendingStatus: true,
    DkimAttributes: {
      SigningEnabled: false,
      Status: "NOT_STARTED",
      Tokens: [],
      SigningAttributesOrigin: "AWS_SES",
      NextSigningKeyLength: "RSA_2048_BIT",
      CurrentSigningKeyLength: "RSA_2048_BIT",
      LastKeyGenerationTimestamp: new Date().toISOString(),
    },
    MailFromAttributes: {
      MailFromDomain: "",
      MailFromDomainStatus: "NOT_STARTED",
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    },
    FeedbackForwardingStatus: true,
    Tags: (input["Tags"] as Tag[] | undefined) ?? [],
    ConfigurationSetName: input["ConfigurationSetName"] as string | undefined,
  };
  ctx.store.set(identityKey(identity), stored);
  return {
    IdentityType: stored.IdentityType,
    VerifiedForSendingStatus: stored.VerifiedForSendingStatus,
    DkimAttributes: stored.DkimAttributes,
  };
};

const GetEmailIdentity: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  const stored = requireIdentity(ctx, identity);
  return {
    IdentityType: stored.IdentityType,
    FeedbackForwardingStatus: stored.FeedbackForwardingStatus,
    VerifiedForSendingStatus: stored.VerifiedForSendingStatus,
    DkimAttributes: stored.DkimAttributes,
    MailFromAttributes: stored.MailFromAttributes,
    Tags: stored.Tags,
    ConfigurationSetName: stored.ConfigurationSetName,
    VerificationStatus: stored.VerifiedForSendingStatus
      ? "SUCCESS"
      : "NOT_STARTED",
  };
};

const ListEmailIdentities: OperationHandler = (input, ctx) => {
  const v2Identities = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2identity/"))
    .map((e) => {
      const s = e.value as StoredIdentityV2;
      return {
        IdentityType: s.IdentityType,
        IdentityName: s.EmailIdentity,
        SendingEnabled: s.VerifiedForSendingStatus,
        VerificationStatus: s.VerifiedForSendingStatus
          ? "SUCCESS"
          : "NOT_STARTED",
      };
    });

  const v2Names = new Set(v2Identities.map((i) => i.IdentityName));
  const v1Identities = ctx.store
    .list()
    .filter((e) => e.key.startsWith("identity/"))
    .map((e) => {
      const s = e.value as { Identity: string; VerificationStatus: string };
      return {
        IdentityType: identityTypeOf(s.Identity),
        IdentityName: s.Identity,
        SendingEnabled: s.VerificationStatus === "Success",
        VerificationStatus:
          s.VerificationStatus === "Success" ? "SUCCESS" : "NOT_STARTED",
      };
    })
    .filter((i) => !v2Names.has(i.IdentityName));

  const allIdentities = [...v2Identities, ...v1Identities];
  const pageSize = input["PageSize"] as number | undefined;
  const nextToken = input["NextToken"] as string | undefined;

  let start = 0;
  if (nextToken !== undefined) {
    start = parseInt(nextToken, 10);
    if (isNaN(start)) start = 0;
  }

  const page =
    pageSize !== undefined
      ? allIdentities.slice(start, start + pageSize)
      : allIdentities.slice(start);

  const hasMore =
    pageSize !== undefined && start + pageSize < allIdentities.length;

  return {
    EmailIdentities: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const DeleteEmailIdentity: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  requireIdentity(ctx, identity);
  ctx.store.delete(identityKey(identity));
  return {};
};

const SendEmail: OperationHandler = (input, ctx) => {
  const destination = input["Destination"] as
    | {
        ToAddresses?: string[];
        CcAddresses?: string[];
        BccAddresses?: string[];
      }
    | undefined;

  const allRecipients = [
    ...(destination?.ToAddresses ?? []),
    ...(destination?.CcAddresses ?? []),
    ...(destination?.BccAddresses ?? []),
  ];

  for (const addr of allRecipients) {
    if (isSuppressed(ctx, addr)) {
      throw awsError(
        "MessageRejected",
        `Email address ${addr} is on the suppression list.`,
        400,
      );
    }
  }

  const fromEmail = input["FromEmailAddress"] as string | undefined;
  if (fromEmail !== undefined) {
    const identity =
      getIdentityFromStore(ctx, fromEmail) ??
      getIdentityFromStore(ctx, fromEmail.replace(/^[^@]+@/, ""));
    if (identity === undefined) {
      throw awsError(
        "MailFromDomainNotVerifiedException",
        `Email address not verified: ${fromEmail}`,
        400,
      );
    }
  }

  return { MessageId: `sesv2-${crypto.randomUUID()}` };
};

const CreateConfigurationSet: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const existing = ctx.store.get(configSetKey(name));
  if (existing !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Configuration set ${name} already exists.`,
      400,
    );
  }
  const stored: StoredConfigurationSetV2 = {
    ConfigurationSetName: name,
    TrackingOptions: input["TrackingOptions"] as
      | Record<string, unknown>
      | undefined,
    DeliveryOptions: input["DeliveryOptions"] as
      | Record<string, unknown>
      | undefined,
    ReputationOptions: input["ReputationOptions"] as
      | Record<string, unknown>
      | undefined,
    SendingOptions: input["SendingOptions"] as
      | { SendingEnabled: boolean }
      | undefined,
    SuppressionOptions: input["SuppressionOptions"] as
      | Record<string, unknown>
      | undefined,
    VdmOptions: input["VdmOptions"] as Record<string, unknown> | undefined,
    Tags: (input["Tags"] as Tag[] | undefined) ?? [],
    EventDestinations: [],
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const GetConfigurationSet: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  return {
    ConfigurationSetName: stored.ConfigurationSetName,
    TrackingOptions: stored.TrackingOptions,
    DeliveryOptions: stored.DeliveryOptions,
    ReputationOptions: stored.ReputationOptions,
    SendingOptions: stored.SendingOptions,
    SuppressionOptions: stored.SuppressionOptions,
    VdmOptions: stored.VdmOptions,
    Tags: stored.Tags,
  };
};

const ListConfigurationSets: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2configset/"))
    .map((e) => (e.value as StoredConfigurationSetV2).ConfigurationSetName);

  const pageSize = input["PageSize"] as number | undefined;
  const nextToken = input["NextToken"] as string | undefined;

  let start = 0;
  if (nextToken !== undefined) {
    start = parseInt(nextToken, 10);
    if (isNaN(start)) start = 0;
  }

  const page =
    pageSize !== undefined
      ? all.slice(start, start + pageSize)
      : all.slice(start);
  const hasMore = pageSize !== undefined && start + pageSize < all.length;

  return {
    ConfigurationSets: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const DeleteConfigurationSet: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  requireConfigSet(ctx, name);
  ctx.store.delete(configSetKey(name));
  return {};
};

const GetConfigurationSetEventDestinations: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  return { EventDestinations: stored.EventDestinations };
};

const CreateConfigurationSetEventDestination: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  const destName = input["EventDestinationName"] as string;
  if (stored.EventDestinations.some((d) => d.Name === destName)) {
    throw awsError(
      "AlreadyExistsException",
      `Event destination ${destName} already exists.`,
      400,
    );
  }
  const destConfig = input["EventDestination"] as
    | Record<string, unknown>
    | undefined;
  const dest: StoredEventDestinationV2 = {
    Name: destName,
    Enabled: (destConfig?.["Enabled"] as boolean | undefined) ?? false,
    MatchingEventTypes:
      (destConfig?.["MatchingEventTypes"] as string[] | undefined) ?? [],
    KinesisFirehoseDestination: destConfig?.["KinesisFirehoseDestination"] as
      | Record<string, unknown>
      | undefined,
    CloudWatchDestination: destConfig?.["CloudWatchDestination"] as
      | Record<string, unknown>
      | undefined,
    SnsDestination: destConfig?.["SnsDestination"] as
      | Record<string, unknown>
      | undefined,
    PinpointDestination: destConfig?.["PinpointDestination"] as
      | Record<string, unknown>
      | undefined,
    SesDestination: destConfig?.["SesDestination"] as
      | Record<string, unknown>
      | undefined,
  };
  stored.EventDestinations.push(dest);
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const UpdateConfigurationSetEventDestination: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  const destName = input["EventDestinationName"] as string;
  const idx = stored.EventDestinations.findIndex((d) => d.Name === destName);
  if (idx === -1) {
    throw awsError(
      "NotFoundException",
      `Event destination ${destName} not found.`,
      404,
    );
  }
  const destConfig = input["EventDestination"] as
    | Record<string, unknown>
    | undefined;
  stored.EventDestinations[idx] = {
    Name: destName,
    Enabled: (destConfig?.["Enabled"] as boolean | undefined) ?? false,
    MatchingEventTypes:
      (destConfig?.["MatchingEventTypes"] as string[] | undefined) ?? [],
    KinesisFirehoseDestination: destConfig?.["KinesisFirehoseDestination"] as
      | Record<string, unknown>
      | undefined,
    CloudWatchDestination: destConfig?.["CloudWatchDestination"] as
      | Record<string, unknown>
      | undefined,
    SnsDestination: destConfig?.["SnsDestination"] as
      | Record<string, unknown>
      | undefined,
    PinpointDestination: destConfig?.["PinpointDestination"] as
      | Record<string, unknown>
      | undefined,
    SesDestination: destConfig?.["SesDestination"] as
      | Record<string, unknown>
      | undefined,
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const DeleteConfigurationSetEventDestination: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  const destName = input["EventDestinationName"] as string;
  const idx = stored.EventDestinations.findIndex((d) => d.Name === destName);
  if (idx === -1) {
    throw awsError(
      "NotFoundException",
      `Event destination ${destName} not found.`,
      404,
    );
  }
  stored.EventDestinations.splice(idx, 1);
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutConfigurationSetDeliveryOptions: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  stored.DeliveryOptions = {
    TlsPolicy: input["TlsPolicy"],
    SendingPoolName: input["SendingPoolName"],
    MaxDeliverySeconds: input["MaxDeliverySeconds"],
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutConfigurationSetReputationOptions: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  stored.ReputationOptions = {
    ReputationMetricsEnabled: input["ReputationMetricsEnabled"],
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutConfigurationSetSendingOptions: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  stored.SendingOptions = {
    SendingEnabled: (input["SendingEnabled"] as boolean | undefined) ?? true,
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutConfigurationSetSuppressionOptions: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  stored.SuppressionOptions = {
    SuppressedReasons: input["SuppressedReasons"],
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutConfigurationSetTrackingOptions: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  stored.TrackingOptions = {
    CustomRedirectDomain: input["CustomRedirectDomain"],
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const CreateEmailTemplate: OperationHandler = (input, ctx) => {
  const name = input["TemplateName"] as string;
  const existing = ctx.store.get(templateKey(name));
  if (existing !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Email template ${name} already exists.`,
      400,
    );
  }
  const content =
    (input["TemplateContent"] as Record<string, unknown> | undefined) ?? {};
  const stored: StoredEmailTemplateV2 = {
    TemplateName: name,
    TemplateContent: {
      Subject: content["Subject"] as string | undefined,
      Text: content["Text"] as string | undefined,
      Html: content["Html"] as string | undefined,
    },
    Tags: (input["Tags"] as Tag[] | undefined) ?? [],
    CreatedTimestamp: new Date().toISOString(),
  };
  ctx.store.set(templateKey(name), stored);
  return {};
};

const GetEmailTemplate: OperationHandler = (input, ctx) => {
  const name = input["TemplateName"] as string;
  const stored = requireTemplate(ctx, name);
  return {
    TemplateName: stored.TemplateName,
    TemplateContent: stored.TemplateContent,
    Tags: stored.Tags,
  };
};

const ListEmailTemplates: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2template/"))
    .map((e) => {
      const s = e.value as StoredEmailTemplateV2;
      return {
        TemplateName: s.TemplateName,
        CreatedTimestamp: s.CreatedTimestamp,
      };
    });

  const pageSize = input["PageSize"] as number | undefined;
  const nextToken = input["NextToken"] as string | undefined;

  let start = 0;
  if (nextToken !== undefined) {
    start = parseInt(nextToken, 10);
    if (isNaN(start)) start = 0;
  }

  const page =
    pageSize !== undefined
      ? all.slice(start, start + pageSize)
      : all.slice(start);
  const hasMore = pageSize !== undefined && start + pageSize < all.length;

  return {
    TemplatesMetadata: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const DeleteEmailTemplate: OperationHandler = (input, ctx) => {
  const name = input["TemplateName"] as string;
  requireTemplate(ctx, name);
  ctx.store.delete(templateKey(name));
  return {};
};

const UpdateEmailTemplate: OperationHandler = (input, ctx) => {
  const name = input["TemplateName"] as string;
  const stored = requireTemplate(ctx, name);
  const content =
    (input["TemplateContent"] as Record<string, unknown> | undefined) ?? {};
  stored.TemplateContent = {
    Subject: content["Subject"] as string | undefined,
    Text: content["Text"] as string | undefined,
    Html: content["Html"] as string | undefined,
  };
  ctx.store.set(templateKey(name), stored);
  return {};
};

const PutSuppressedDestination: OperationHandler = (input, ctx) => {
  const email = input["EmailAddress"] as string;
  const reason = input["Reason"] as string;
  const stored: StoredSuppressedDestination = {
    EmailAddress: email,
    Reason: reason,
    LastUpdateTime: new Date().toISOString(),
  };
  ctx.store.set(suppressedKey(email), stored);
  return {};
};

const GetSuppressedDestination: OperationHandler = (input, ctx) => {
  const email = input["EmailAddress"] as string;
  const stored = ctx.store.get<StoredSuppressedDestination>(
    suppressedKey(email),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Suppressed destination ${email} not found.`,
      404,
    );
  }
  return {
    SuppressedDestination: {
      EmailAddress: stored.EmailAddress,
      Reason: stored.Reason,
      LastUpdateTime: stored.LastUpdateTime,
      Attributes: { MessageId: "", FeedbackId: "" },
    },
  };
};

const ListSuppressedDestinations: OperationHandler = (input, ctx) => {
  let all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2suppressed/"))
    .map((e) => {
      const s = e.value as StoredSuppressedDestination;
      return {
        EmailAddress: s.EmailAddress,
        Reason: s.Reason,
        LastUpdateTime: s.LastUpdateTime,
      };
    });

  const reasons = input["Reasons"] as string[] | undefined;
  if (reasons !== undefined && reasons.length > 0) {
    all = all.filter((s) => reasons.includes(s.Reason));
  }

  const pageSize = input["PageSize"] as number | undefined;
  const nextToken = input["NextToken"] as string | undefined;

  let start = 0;
  if (nextToken !== undefined) {
    start = parseInt(nextToken, 10);
    if (isNaN(start)) start = 0;
  }

  const page =
    pageSize !== undefined
      ? all.slice(start, start + pageSize)
      : all.slice(start);
  const hasMore = pageSize !== undefined && start + pageSize < all.length;

  return {
    SuppressedDestinationSummaries: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const DeleteSuppressedDestination: OperationHandler = (input, ctx) => {
  const email = input["EmailAddress"] as string;
  const stored = ctx.store.get<StoredSuppressedDestination>(
    suppressedKey(email),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Suppressed destination ${email} not found.`,
      404,
    );
  }
  ctx.store.delete(suppressedKey(email));
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
  const tags = ctx.store.get<Tag[]>(tagsKey(arn)) ?? [];
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = input["ResourceArn"] as string;
  const newTags = (input["Tags"] as Tag[] | undefined) ?? [];
  const existing = ctx.store.get<Tag[]>(tagsKey(arn)) ?? [];
  const merged = [...existing];
  for (const tag of newTags) {
    const idx = merged.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      merged[idx] = tag;
    } else {
      merged.push(tag);
    }
  }
  ctx.store.set(tagsKey(arn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, _ctx, req) => {
  const arn = req.query.get("ResourceArn") ?? (input["ResourceArn"] as string);
  const keysParam = req.query.getAll("TagKeys");
  const keysToRemove =
    keysParam.length > 0
      ? keysParam
      : ((input["TagKeys"] as string[] | undefined) ?? []);
  const existing = _ctx.store.get<Tag[]>(tagsKey(arn)) ?? [];
  const updated = existing.filter((t) => !keysToRemove.includes(t.Key));
  _ctx.store.set(tagsKey(arn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((p) => p !== "");

const sesv2: ServiceDefinition = {
  name: "ses",
  protocol: "rest-json",
  matches: (req: ParsedRequest): boolean => req.path.startsWith("/v2/email/"),
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;

    if (parts[0] !== "v2" || parts[1] !== "email") return undefined;

    if (parts[2] === "outbound-emails" && m === "POST") return "SendEmail";

    if (parts[2] === "identities") {
      if (parts.length === 3) {
        if (m === "GET") return "ListEmailIdentities";
        if (m === "POST") return "CreateEmailIdentity";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetEmailIdentity";
        if (m === "DELETE") return "DeleteEmailIdentity";
      }
    }

    if (parts[2] === "configuration-sets") {
      if (parts.length === 3) {
        if (m === "GET") return "ListConfigurationSets";
        if (m === "POST") return "CreateConfigurationSet";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetConfigurationSet";
        if (m === "DELETE") return "DeleteConfigurationSet";
      }
      if (parts.length === 5) {
        const sub = parts[4];
        if (sub === "event-destinations") {
          if (m === "GET") return "GetConfigurationSetEventDestinations";
          if (m === "POST") return "CreateConfigurationSetEventDestination";
        }
        if (sub === "delivery-options" && m === "PUT")
          return "PutConfigurationSetDeliveryOptions";
        if (sub === "reputation-options" && m === "PUT")
          return "PutConfigurationSetReputationOptions";
        if (sub === "sending" && m === "PUT")
          return "PutConfigurationSetSendingOptions";
        if (sub === "suppression-options" && m === "PUT")
          return "PutConfigurationSetSuppressionOptions";
        if (sub === "tracking-options" && m === "PUT")
          return "PutConfigurationSetTrackingOptions";
      }
      if (parts.length === 6 && parts[4] === "event-destinations") {
        if (m === "PUT") return "UpdateConfigurationSetEventDestination";
        if (m === "DELETE") return "DeleteConfigurationSetEventDestination";
      }
    }

    if (parts[2] === "templates") {
      if (parts.length === 3) {
        if (m === "GET") return "ListEmailTemplates";
        if (m === "POST") return "CreateEmailTemplate";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetEmailTemplate";
        if (m === "DELETE") return "DeleteEmailTemplate";
        if (m === "PUT") return "UpdateEmailTemplate";
      }
    }

    if (parts[2] === "suppression" && parts[3] === "addresses") {
      if (parts.length === 4) {
        if (m === "GET") return "ListSuppressedDestinations";
        if (m === "PUT") return "PutSuppressedDestination";
      }
      if (parts.length === 5) {
        if (m === "GET") return "GetSuppressedDestination";
        if (m === "DELETE") return "DeleteSuppressedDestination";
      }
    }

    if (parts[2] === "tags") {
      if (m === "GET") return "ListTagsForResource";
      if (m === "POST") return "TagResource";
      if (m === "DELETE") return "UntagResource";
    }

    return undefined;
  },
  operations: {
    SendEmail,
    CreateEmailIdentity,
    GetEmailIdentity,
    ListEmailIdentities,
    DeleteEmailIdentity,
    CreateConfigurationSet,
    GetConfigurationSet,
    ListConfigurationSets,
    DeleteConfigurationSet,
    GetConfigurationSetEventDestinations,
    CreateConfigurationSetEventDestination,
    UpdateConfigurationSetEventDestination,
    DeleteConfigurationSetEventDestination,
    PutConfigurationSetDeliveryOptions,
    PutConfigurationSetReputationOptions,
    PutConfigurationSetSendingOptions,
    PutConfigurationSetSuppressionOptions,
    PutConfigurationSetTrackingOptions,
    CreateEmailTemplate,
    GetEmailTemplate,
    ListEmailTemplates,
    DeleteEmailTemplate,
    UpdateEmailTemplate,
    PutSuppressedDestination,
    GetSuppressedDestination,
    ListSuppressedDestinations,
    DeleteSuppressedDestination,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default sesv2;
