import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/sesv2.json", { with: { type: "json" } }),
);

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

type TopicPreference = {
  TopicName: string;
  SubscriptionStatus: string;
};

type StoredContactList = {
  ContactListName: string;
  Topics: {
    TopicName: string;
    DisplayName: string;
    DefaultSubscriptionStatus: string;
    Description?: string;
  }[];
  Description?: string;
  CreatedTimestamp: string;
  LastUpdatedTimestamp: string;
  Tags: Tag[];
};

type StoredContact = {
  EmailAddress: string;
  ContactListName: string;
  TopicPreferences: TopicPreference[];
  UnsubscribeAll: boolean;
  CreatedTimestamp: string;
  LastUpdatedTimestamp: string;
};

type StoredCustomVerificationEmailTemplate = {
  TemplateName: string;
  FromEmailAddress: string;
  TemplateSubject: string;
  TemplateContent: string;
  SuccessRedirectionURL: string;
  FailureRedirectionURL: string;
};

type StoredExportJob = {
  JobId: string;
  ExportDataSource: Record<string, unknown>;
  ExportDestination: Record<string, unknown>;
  JobStatus: string;
  CreatedTimestamp: string;
  CompletedTimestamp: string;
};

type StoredImportJob = {
  JobId: string;
  ImportDataSource: Record<string, unknown>;
  ImportDestination: Record<string, unknown>;
  JobStatus: string;
  CreatedTimestamp: string;
  CompletedTimestamp: string;
  ProcessedRecordsCount: number;
  FailedRecordsCount: number;
};

type StoredDeliverabilityTestReport = {
  ReportId: string;
  ReportName: string;
  Subject: string;
  FromEmailAddress: string;
  CreateDate: string;
  DeliverabilityTestStatus: string;
};

type StoredSentMessage = {
  MessageId: string;
  FromEmailAddress?: string;
  Timestamp: string;
};

type StoredDedicatedIpPool = {
  PoolName: string;
  ScalingMode: string;
  Tags: Tag[];
};

type StoredDedicatedIp = {
  Ip: string;
  WarmupStatus: string;
  WarmupPercentage: number;
  PoolName: string | undefined;
};

type StoredAccount = {
  DedicatedIpAutoWarmupEnabled: boolean;
  ProductionAccessEnabled: boolean;
  SendingEnabled: boolean;
  SuppressionAttributes: Record<string, unknown> | undefined;
  Details: Record<string, unknown> | undefined;
  VdmAttributes: Record<string, unknown> | undefined;
};

type StoredTenant = {
  TenantName: string;
  TenantId: string;
  TenantArn: string;
  CreatedTimestamp: string;
  Tags: Tag[];
  SendingStatus: string;
  SuppressionAttributes: Record<string, unknown> | undefined;
};

type StoredTenantResourceAssociation = {
  TenantName: string;
  ResourceArn: string;
};

type StoredMultiRegionEndpoint = {
  EndpointName: string;
  EndpointId: string;
  Details: Record<string, unknown> | undefined;
  Status: string;
  CreatedTimestamp: string;
};

type StoredDeliverabilityDashboard = {
  DashboardEnabled: boolean;
  SubscriptionExpiryDate: string | undefined;
  AccountStatus: string | undefined;
  ActiveSubscribedDomains: unknown[] | undefined;
};

type StoredReputationEntity = {
  ReputationEntityReference: string;
  ReputationEntityType: string;
  ReputationManagementPolicy: string | undefined;
  CustomerManagedStatus: Record<string, unknown> | undefined;
};

const v1IdentityKey = (identity: string): string => `identity/${identity}`;
const identityKey = (identity: string): string => `v2identity/${identity}`;
const configSetKey = (name: string): string => `v2configset/${name}`;
const templateKey = (name: string): string => `v2template/${name}`;
const suppressedKey = (email: string): string => `v2suppressed/${email}`;
const tagsKey = (arn: string): string => `v2tags/${arn}`;
const contactListKey = (name: string): string => `v2contactlist/${name}`;
const contactKey = (listName: string, email: string): string =>
  `v2contact/${listName}/${email}`;
const customVerifTemplateKey = (name: string): string => `v2cvtemplate/${name}`;
const identityPoliciesKey = (identity: string): string =>
  `v2identitypolicies/${identity}`;
const exportJobKey = (jobId: string): string => `v2exportjob/${jobId}`;
const importJobKey = (jobId: string): string => `v2importjob/${jobId}`;
const delivTestKey = (reportId: string): string => `v2delivtest/${reportId}`;
const sentMessageKey = (messageId: string): string => `v2sent/${messageId}`;
const dedicatedIpPoolKey = (name: string): string =>
  `v2dedicatedippool/${name}`;
const dedicatedIpKey = (ip: string): string => `v2dedicatedip/${ip}`;
const accountKey = (): string => `v2account/singleton`;
const tenantKey = (name: string): string => `v2tenant/${name}`;
const tenantResourceKey = (tenantName: string, resourceArn: string): string =>
  `v2tenantresource/${tenantName}/${encodeURIComponent(resourceArn)}`;
const multiRegionEndpointKey = (name: string): string => `v2mre/${name}`;
const delivDashboardKey = (): string => `v2delivdashboard/singleton`;
const reputationEntityKey = (type: string, ref: string): string =>
  `v2reputation/${type}/${encodeURIComponent(ref)}`;

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

const requireContactList = (
  ctx: ServiceContext,
  name: string,
): StoredContactList => {
  const cl = ctx.store.get<StoredContactList>(contactListKey(name));
  if (cl === undefined) {
    throw awsError(
      "NotFoundException",
      `Contact list ${name} does not exist.`,
      404,
    );
  }
  return cl;
};

const requireCustomVerifTemplate = (
  ctx: ServiceContext,
  name: string,
): StoredCustomVerificationEmailTemplate => {
  const t = ctx.store.get<StoredCustomVerificationEmailTemplate>(
    customVerifTemplateKey(name),
  );
  if (t === undefined) {
    throw awsError(
      "NotFoundException",
      `Custom verification email template ${name} does not exist.`,
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

  const messageId = `sesv2-${crypto.randomUUID()}`;
  ctx.store.set(sentMessageKey(messageId), {
    MessageId: messageId,
    FromEmailAddress: fromEmail,
    Timestamp: new Date().toISOString(),
  } satisfies StoredSentMessage);
  return { MessageId: messageId };
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

const CreateContactList: OperationHandler = (input, ctx) => {
  const name = input["ContactListName"] as string;
  if (ctx.store.get(contactListKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Contact list ${name} already exists.`,
      400,
    );
  }
  const now = new Date().toISOString();
  const stored: StoredContactList = {
    ContactListName: name,
    Topics: (input["Topics"] as StoredContactList["Topics"] | undefined) ?? [],
    Description: input["Description"] as string | undefined,
    CreatedTimestamp: now,
    LastUpdatedTimestamp: now,
    Tags: (input["Tags"] as Tag[] | undefined) ?? [],
  };
  ctx.store.set(contactListKey(name), stored);
  return {};
};

const GetContactList: OperationHandler = (input, ctx) => {
  const name = input["ContactListName"] as string;
  const stored = requireContactList(ctx, name);
  return {
    ContactListName: stored.ContactListName,
    Topics: stored.Topics,
    Description: stored.Description,
    CreatedTimestamp: stored.CreatedTimestamp,
    LastUpdatedTimestamp: stored.LastUpdatedTimestamp,
    Tags: stored.Tags,
  };
};

const DeleteContactList: OperationHandler = (input, ctx) => {
  const name = input["ContactListName"] as string;
  requireContactList(ctx, name);
  ctx.store.delete(contactListKey(name));
  ctx.store
    .list()
    .filter((e) => e.key.startsWith(`v2contact/${name}/`))
    .forEach((e) => ctx.store.delete(e.key));
  return {};
};

const UpdateContactList: OperationHandler = (input, ctx) => {
  const name = input["ContactListName"] as string;
  const stored = requireContactList(ctx, name);
  const updated: StoredContactList = {
    ...stored,
    Topics:
      (input["Topics"] as StoredContactList["Topics"] | undefined) ??
      stored.Topics,
    Description:
      input["Description"] !== undefined
        ? (input["Description"] as string)
        : stored.Description,
    LastUpdatedTimestamp: new Date().toISOString(),
  };
  ctx.store.set(contactListKey(name), updated);
  return {};
};

const ListContactLists: OperationHandler = (_input, ctx) => {
  const lists = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2contactlist/"))
    .map((e) => {
      const s = e.value as StoredContactList;
      return {
        ContactListName: s.ContactListName,
        LastUpdatedTimestamp: s.LastUpdatedTimestamp,
      };
    });
  return { ContactLists: lists };
};

const CreateContact: OperationHandler = (input, ctx) => {
  const listName = input["ContactListName"] as string;
  requireContactList(ctx, listName);
  const email = input["EmailAddress"] as string;
  if (ctx.store.get(contactKey(listName, email)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Contact ${email} already exists.`,
      400,
    );
  }
  const now = new Date().toISOString();
  const stored: StoredContact = {
    EmailAddress: email,
    ContactListName: listName,
    TopicPreferences:
      (input["TopicPreferences"] as TopicPreference[] | undefined) ?? [],
    UnsubscribeAll: (input["UnsubscribeAll"] as boolean | undefined) ?? false,
    CreatedTimestamp: now,
    LastUpdatedTimestamp: now,
  };
  ctx.store.set(contactKey(listName, email), stored);
  return {};
};

const GetContact: OperationHandler = (input, ctx) => {
  const listName = input["ContactListName"] as string;
  const email = input["EmailAddress"] as string;
  const stored = ctx.store.get<StoredContact>(contactKey(listName, email));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Contact ${email} not found.`, 404);
  }
  return {
    ContactListName: stored.ContactListName,
    EmailAddress: stored.EmailAddress,
    TopicPreferences: stored.TopicPreferences,
    UnsubscribeAll: stored.UnsubscribeAll,
    CreatedTimestamp: stored.CreatedTimestamp,
    LastUpdatedTimestamp: stored.LastUpdatedTimestamp,
  };
};

const DeleteContact: OperationHandler = (input, ctx) => {
  const listName = input["ContactListName"] as string;
  const email = input["EmailAddress"] as string;
  if (ctx.store.get(contactKey(listName, email)) === undefined) {
    throw awsError("NotFoundException", `Contact ${email} not found.`, 404);
  }
  ctx.store.delete(contactKey(listName, email));
  return {};
};

const UpdateContact: OperationHandler = (input, ctx) => {
  const listName = input["ContactListName"] as string;
  const email = input["EmailAddress"] as string;
  const stored = ctx.store.get<StoredContact>(contactKey(listName, email));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Contact ${email} not found.`, 404);
  }
  const updated: StoredContact = {
    ...stored,
    TopicPreferences:
      (input["TopicPreferences"] as TopicPreference[] | undefined) ??
      stored.TopicPreferences,
    UnsubscribeAll:
      input["UnsubscribeAll"] !== undefined
        ? (input["UnsubscribeAll"] as boolean)
        : stored.UnsubscribeAll,
    LastUpdatedTimestamp: new Date().toISOString(),
  };
  ctx.store.set(contactKey(listName, email), updated);
  return {};
};

const ListContacts: OperationHandler = (input, ctx) => {
  const listName = input["ContactListName"] as string;
  requireContactList(ctx, listName);
  const prefix = `v2contact/${listName}/`;
  const contacts = ctx.store
    .list()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => {
      const s = e.value as StoredContact;
      return {
        EmailAddress: s.EmailAddress,
        TopicPreferences: s.TopicPreferences,
        UnsubscribeAll: s.UnsubscribeAll,
        LastUpdatedTimestamp: s.LastUpdatedTimestamp,
      };
    });
  return { Contacts: contacts };
};

const CreateCustomVerificationEmailTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["TemplateName"] as string;
  if (ctx.store.get(customVerifTemplateKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Template ${name} already exists.`,
      400,
    );
  }
  const stored: StoredCustomVerificationEmailTemplate = {
    TemplateName: name,
    FromEmailAddress: input["FromEmailAddress"] as string,
    TemplateSubject: input["TemplateSubject"] as string,
    TemplateContent: input["TemplateContent"] as string,
    SuccessRedirectionURL: input["SuccessRedirectionURL"] as string,
    FailureRedirectionURL: input["FailureRedirectionURL"] as string,
  };
  ctx.store.set(customVerifTemplateKey(name), stored);
  return {};
};

const GetCustomVerificationEmailTemplate: OperationHandler = (input, ctx) => {
  const name = input["TemplateName"] as string;
  const stored = requireCustomVerifTemplate(ctx, name);
  return { ...stored };
};

const DeleteCustomVerificationEmailTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["TemplateName"] as string;
  requireCustomVerifTemplate(ctx, name);
  ctx.store.delete(customVerifTemplateKey(name));
  return {};
};

const UpdateCustomVerificationEmailTemplate: OperationHandler = (
  input,
  ctx,
) => {
  const name = input["TemplateName"] as string;
  const stored = requireCustomVerifTemplate(ctx, name);
  const updated: StoredCustomVerificationEmailTemplate = {
    ...stored,
    FromEmailAddress:
      (input["FromEmailAddress"] as string | undefined) ??
      stored.FromEmailAddress,
    TemplateSubject:
      (input["TemplateSubject"] as string | undefined) ??
      stored.TemplateSubject,
    TemplateContent:
      (input["TemplateContent"] as string | undefined) ??
      stored.TemplateContent,
    SuccessRedirectionURL:
      (input["SuccessRedirectionURL"] as string | undefined) ??
      stored.SuccessRedirectionURL,
    FailureRedirectionURL:
      (input["FailureRedirectionURL"] as string | undefined) ??
      stored.FailureRedirectionURL,
  };
  ctx.store.set(customVerifTemplateKey(name), updated);
  return {};
};

const ListCustomVerificationEmailTemplates: OperationHandler = (
  _input,
  ctx,
) => {
  const templates = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2cvtemplate/"))
    .map((e) => {
      const s = e.value as StoredCustomVerificationEmailTemplate;
      return {
        TemplateName: s.TemplateName,
        FromEmailAddress: s.FromEmailAddress,
        TemplateSubject: s.TemplateSubject,
        SuccessRedirectionURL: s.SuccessRedirectionURL,
        FailureRedirectionURL: s.FailureRedirectionURL,
      };
    });
  return { CustomVerificationEmailTemplates: templates };
};

const SendCustomVerificationEmail: OperationHandler = (input, ctx) => {
  const templateName = input["TemplateName"] as string;
  requireCustomVerifTemplate(ctx, templateName);
  const messageId = `sesv2-cve-${crypto.randomUUID()}`;
  ctx.store.set(sentMessageKey(messageId), {
    MessageId: messageId,
    Timestamp: new Date().toISOString(),
  } satisfies StoredSentMessage);
  return { MessageId: messageId };
};

const CreateEmailIdentityPolicy: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  requireIdentity(ctx, identity);
  const policyName = input["PolicyName"] as string;
  const policies =
    ctx.store.get<Record<string, string>>(identityPoliciesKey(identity)) ?? {};
  if (policies[policyName] !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Policy ${policyName} already exists.`,
      400,
    );
  }
  policies[policyName] = input["Policy"] as string;
  ctx.store.set(identityPoliciesKey(identity), policies);
  return {};
};

const DeleteEmailIdentityPolicy: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  requireIdentity(ctx, identity);
  const policyName = input["PolicyName"] as string;
  const policies =
    ctx.store.get<Record<string, string>>(identityPoliciesKey(identity)) ?? {};
  if (policies[policyName] === undefined) {
    throw awsError("NotFoundException", `Policy ${policyName} not found.`, 404);
  }
  delete policies[policyName];
  ctx.store.set(identityPoliciesKey(identity), policies);
  return {};
};

const UpdateEmailIdentityPolicy: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  requireIdentity(ctx, identity);
  const policyName = input["PolicyName"] as string;
  const policies =
    ctx.store.get<Record<string, string>>(identityPoliciesKey(identity)) ?? {};
  if (policies[policyName] === undefined) {
    throw awsError("NotFoundException", `Policy ${policyName} not found.`, 404);
  }
  policies[policyName] = input["Policy"] as string;
  ctx.store.set(identityPoliciesKey(identity), policies);
  return {};
};

const GetEmailIdentityPolicies: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  requireIdentity(ctx, identity);
  const policies =
    ctx.store.get<Record<string, string>>(identityPoliciesKey(identity)) ?? {};
  return { Policies: policies };
};

const CreateExportJob: OperationHandler = (input, ctx) => {
  const jobId = `export-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const stored: StoredExportJob = {
    JobId: jobId,
    ExportDataSource:
      (input["ExportDataSource"] as Record<string, unknown>) ?? {},
    ExportDestination:
      (input["ExportDestination"] as Record<string, unknown>) ?? {},
    JobStatus: "COMPLETED",
    CreatedTimestamp: now,
    CompletedTimestamp: now,
  };
  ctx.store.set(exportJobKey(jobId), stored);
  return { JobId: jobId };
};

const CancelExportJob: OperationHandler = (input, ctx) => {
  const jobId = input["JobId"] as string;
  const stored = ctx.store.get<StoredExportJob>(exportJobKey(jobId));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Export job ${jobId} not found.`, 404);
  }
  ctx.store.set(exportJobKey(jobId), { ...stored, JobStatus: "CANCELLED" });
  return {};
};

const GetExportJob: OperationHandler = (input, ctx) => {
  const jobId = input["JobId"] as string;
  const stored = ctx.store.get<StoredExportJob>(exportJobKey(jobId));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Export job ${jobId} not found.`, 404);
  }
  return { ...stored };
};

const ListExportJobs: OperationHandler = (_input, ctx) => {
  const jobs = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2exportjob/"))
    .map((e) => {
      const s = e.value as StoredExportJob;
      return {
        JobId: s.JobId,
        ExportDataSource: s.ExportDataSource,
        ExportDestination: s.ExportDestination,
        JobStatus: s.JobStatus,
        CreatedTimestamp: s.CreatedTimestamp,
        CompletedTimestamp: s.CompletedTimestamp,
      };
    });
  return { ExportJobs: jobs };
};

const CreateImportJob: OperationHandler = (input, ctx) => {
  const jobId = `import-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const stored: StoredImportJob = {
    JobId: jobId,
    ImportDataSource:
      (input["ImportDataSource"] as Record<string, unknown>) ?? {},
    ImportDestination:
      (input["ImportDestination"] as Record<string, unknown>) ?? {},
    JobStatus: "COMPLETED",
    CreatedTimestamp: now,
    CompletedTimestamp: now,
    ProcessedRecordsCount: 0,
    FailedRecordsCount: 0,
  };
  ctx.store.set(importJobKey(jobId), stored);
  return { JobId: jobId };
};

const GetImportJob: OperationHandler = (input, ctx) => {
  const jobId = input["JobId"] as string;
  const stored = ctx.store.get<StoredImportJob>(importJobKey(jobId));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Import job ${jobId} not found.`, 404);
  }
  return { ...stored };
};

const ListImportJobs: OperationHandler = (_input, ctx) => {
  const jobs = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2importjob/"))
    .map((e) => {
      const s = e.value as StoredImportJob;
      return {
        JobId: s.JobId,
        ImportDataSource: s.ImportDataSource,
        ImportDestination: s.ImportDestination,
        JobStatus: s.JobStatus,
        CreatedTimestamp: s.CreatedTimestamp,
        CompletedTimestamp: s.CompletedTimestamp,
        ProcessedRecordsCount: s.ProcessedRecordsCount,
        FailedRecordsCount: s.FailedRecordsCount,
      };
    });
  return { ImportJobs: jobs };
};

const CreateDeliverabilityTestReport: OperationHandler = (input, ctx) => {
  const reportId = `delivtest-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const stored: StoredDeliverabilityTestReport = {
    ReportId: reportId,
    ReportName: (input["ReportName"] as string | undefined) ?? "",
    Subject: (input["Content"] as Record<string, unknown> | undefined)
      ? "test"
      : "test",
    FromEmailAddress: (input["FromEmailAddress"] as string | undefined) ?? "",
    CreateDate: now,
    DeliverabilityTestStatus: "COMPLETED",
  };
  ctx.store.set(delivTestKey(reportId), stored);
  return {
    ReportId: reportId,
    DeliverabilityTestStatus: stored.DeliverabilityTestStatus,
  };
};

const GetDeliverabilityTestReport: OperationHandler = (input, ctx) => {
  const reportId = input["ReportId"] as string;
  const stored = ctx.store.get<StoredDeliverabilityTestReport>(
    delivTestKey(reportId),
  );
  if (stored === undefined) {
    throw awsError("NotFoundException", `Report ${reportId} not found.`, 404);
  }
  return {
    DeliverabilityTestReport: {
      ReportId: stored.ReportId,
      ReportName: stored.ReportName,
      Subject: stored.Subject,
      FromEmailAddress: stored.FromEmailAddress,
      CreateDate: stored.CreateDate,
      DeliverabilityTestStatus: stored.DeliverabilityTestStatus,
    },
    OverallPlacement: {
      InboxPercentage: 1.0,
      SpamPercentage: 0.0,
      MissingPercentage: 0.0,
      SpfPercentage: 1.0,
      DkimPercentage: 1.0,
    },
    IspPlacements: [],
    Message: stored.Subject,
    Tags: [],
  };
};

const ListDeliverabilityTestReports: OperationHandler = (_input, ctx) => {
  const reports = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2delivtest/"))
    .map((e) => {
      const s = e.value as StoredDeliverabilityTestReport;
      return {
        ReportId: s.ReportId,
        ReportName: s.ReportName,
        Subject: s.Subject,
        FromEmailAddress: s.FromEmailAddress,
        CreateDate: s.CreateDate,
        DeliverabilityTestStatus: s.DeliverabilityTestStatus,
      };
    });
  return { DeliverabilityTestReports: reports };
};

const SendBulkEmail: OperationHandler = (input, ctx) => {
  const entries =
    (input["BulkEmailEntries"] as Array<Record<string, unknown>>) ?? [];
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
  const now = new Date().toISOString();
  const bulkEmailEntryResults = entries.map(() => {
    const messageId = `sesv2-bulk-${crypto.randomUUID()}`;
    ctx.store.set(sentMessageKey(messageId), {
      MessageId: messageId,
      FromEmailAddress: fromEmail,
      Timestamp: now,
    } satisfies StoredSentMessage);
    return { MessageId: messageId, Status: "SUCCESS", Error: undefined };
  });
  return { BulkEmailEntryResults: bulkEmailEntryResults };
};

const TestRenderEmailTemplate: OperationHandler = (input, ctx) => {
  const name = input["TemplateName"] as string;
  const stored = requireTemplate(ctx, name);
  const html = stored.TemplateContent.Html ?? "";
  const text = stored.TemplateContent.Text ?? "";
  const subject = stored.TemplateContent.Subject ?? "";
  return {
    RenderedTemplate: JSON.stringify({
      Subject: subject,
      Html: html,
      Text: text,
    }),
  };
};

const BatchGetMetricData: OperationHandler = (_input, _ctx) => {
  return { Results: [], Errors: [] };
};

const GetMessageInsights: OperationHandler = (input, ctx) => {
  const messageId = input["MessageId"] as string;
  const stored = ctx.store.get<StoredSentMessage>(sentMessageKey(messageId));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Message ${messageId} not found.`, 404);
  }
  return {
    MessageId: stored.MessageId,
    FromEmailAddress: stored.FromEmailAddress,
    Subject: "",
    EmailTags: [],
    Insights: [],
  };
};

const GetEmailAddressInsights: OperationHandler = (input, ctx) => {
  const email = input["EmailAddress"] as string;
  const hasSent = ctx.store
    .list()
    .some(
      (e) =>
        e.key.startsWith("v2sent/") &&
        (e.value as StoredSentMessage).FromEmailAddress === email,
    );
  if (!hasSent) {
    throw awsError("NotFoundException", `No insights for ${email}.`, 404);
  }
  return {
    EmailAddress: email,
    Domain: email.split("@")[1] ?? "",
    NetworkAttributes: {},
    SendingData: { MessageInsightsFilters: {} },
  };
};

const CreateDedicatedIpPool: OperationHandler = (input, ctx) => {
  const name = input["PoolName"] as string;
  if (ctx.store.get(dedicatedIpPoolKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Dedicated IP pool ${name} already exists.`,
      400,
    );
  }
  const stored: StoredDedicatedIpPool = {
    PoolName: name,
    ScalingMode: (input["ScalingMode"] as string | undefined) ?? "STANDARD",
    Tags: (input["Tags"] as Tag[] | undefined) ?? [],
  };
  ctx.store.set(dedicatedIpPoolKey(name), stored);
  return {};
};

const DeleteDedicatedIpPool: OperationHandler = (input, ctx) => {
  const name = input["PoolName"] as string;
  if (ctx.store.get(dedicatedIpPoolKey(name)) === undefined) {
    throw awsError(
      "NotFoundException",
      `Dedicated IP pool ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(dedicatedIpPoolKey(name));
  return {};
};

const GetDedicatedIpPool: OperationHandler = (input, ctx) => {
  const name = input["PoolName"] as string;
  const stored = ctx.store.get<StoredDedicatedIpPool>(dedicatedIpPoolKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Dedicated IP pool ${name} not found.`,
      404,
    );
  }
  return {
    DedicatedIpPool: {
      PoolName: stored.PoolName,
      ScalingMode: stored.ScalingMode,
    },
  };
};

const ListDedicatedIpPools: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2dedicatedippool/"))
    .map((e) => (e.value as StoredDedicatedIpPool).PoolName);

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
    DedicatedIpPools: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const GetDedicatedIp: OperationHandler = (input, ctx) => {
  const ip = input["Ip"] as string;
  const stored = ctx.store.get<StoredDedicatedIp>(dedicatedIpKey(ip));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Dedicated IP ${ip} not found.`, 404);
  }
  return {
    DedicatedIp: {
      Ip: stored.Ip,
      WarmupStatus: stored.WarmupStatus,
      WarmupPercentage: stored.WarmupPercentage,
      PoolName: stored.PoolName,
    },
  };
};

const GetDedicatedIps: OperationHandler = (input, ctx) => {
  const poolName = input["PoolName"] as string | undefined;
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2dedicatedip/"))
    .map((e) => e.value as StoredDedicatedIp)
    .filter((ip) => poolName === undefined || ip.PoolName === poolName)
    .map((ip) => ({
      Ip: ip.Ip,
      WarmupStatus: ip.WarmupStatus,
      WarmupPercentage: ip.WarmupPercentage,
      PoolName: ip.PoolName,
    }));

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
    DedicatedIps: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const PutDedicatedIpInPool: OperationHandler = (input, ctx) => {
  const ip = input["Ip"] as string;
  const destPool = input["DestinationPoolName"] as string;
  if (ctx.store.get(dedicatedIpPoolKey(destPool)) === undefined) {
    throw awsError(
      "NotFoundException",
      `Dedicated IP pool ${destPool} not found.`,
      404,
    );
  }
  const existing = ctx.store.get<StoredDedicatedIp>(dedicatedIpKey(ip));
  const stored: StoredDedicatedIp = existing ?? {
    Ip: ip,
    WarmupStatus: "IN_PROGRESS",
    WarmupPercentage: 0,
    PoolName: destPool,
  };
  stored.PoolName = destPool;
  ctx.store.set(dedicatedIpKey(ip), stored);
  return {};
};

const PutDedicatedIpPoolScalingAttributes: OperationHandler = (input, ctx) => {
  const name = input["PoolName"] as string;
  const stored = ctx.store.get<StoredDedicatedIpPool>(dedicatedIpPoolKey(name));
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Dedicated IP pool ${name} not found.`,
      404,
    );
  }
  stored.ScalingMode = input["ScalingMode"] as string;
  ctx.store.set(dedicatedIpPoolKey(name), stored);
  return {};
};

const PutDedicatedIpWarmupAttributes: OperationHandler = (input, ctx) => {
  const ip = input["Ip"] as string;
  const stored = ctx.store.get<StoredDedicatedIp>(dedicatedIpKey(ip));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Dedicated IP ${ip} not found.`, 404);
  }
  stored.WarmupPercentage = input["WarmupPercentage"] as number;
  ctx.store.set(dedicatedIpKey(ip), stored);
  return {};
};

const getAccount = (ctx: ServiceContext): StoredAccount => {
  const existing = ctx.store.get<StoredAccount>(accountKey());
  if (existing !== undefined) return existing;
  const fresh: StoredAccount = {
    DedicatedIpAutoWarmupEnabled: false,
    ProductionAccessEnabled: true,
    SendingEnabled: true,
    SuppressionAttributes: undefined,
    Details: undefined,
    VdmAttributes: undefined,
  };
  ctx.store.set(accountKey(), fresh);
  return fresh;
};

const PutAccountDedicatedIpWarmupAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const acc = getAccount(ctx);
  acc.DedicatedIpAutoWarmupEnabled =
    (input["AutoWarmupEnabled"] as boolean | undefined) ?? false;
  ctx.store.set(accountKey(), acc);
  return {};
};

const GetAccount: OperationHandler = (_input, ctx) => {
  const acc = getAccount(ctx);
  return {
    DedicatedIpAutoWarmupEnabled: acc.DedicatedIpAutoWarmupEnabled,
    EnforcementStatus: "HEALTHY",
    ProductionAccessEnabled: acc.ProductionAccessEnabled,
    SendQuota: {
      Max24HourSend: 50000,
      MaxSendRate: 14,
      SentLast24Hours: 0,
    },
    SendingEnabled: acc.SendingEnabled,
    SuppressionAttributes: acc.SuppressionAttributes,
    Details: acc.Details,
    VdmAttributes: acc.VdmAttributes,
  };
};

const PutAccountDetails: OperationHandler = (input, ctx) => {
  const acc = getAccount(ctx);
  acc.Details = {
    MailType: input["MailType"],
    WebsiteURL: input["WebsiteURL"],
    ContactLanguage: input["ContactLanguage"],
    UseCaseDescription: input["UseCaseDescription"],
    AdditionalContactEmailAddresses: input["AdditionalContactEmailAddresses"],
    ReviewDetails: input["ReviewDetails"],
  };
  ctx.store.set(accountKey(), acc);
  return {};
};

const PutAccountSendingAttributes: OperationHandler = (input, ctx) => {
  const acc = getAccount(ctx);
  acc.SendingEnabled = (input["SendingEnabled"] as boolean | undefined) ?? true;
  ctx.store.set(accountKey(), acc);
  return {};
};

const PutAccountSuppressionAttributes: OperationHandler = (input, ctx) => {
  const acc = getAccount(ctx);
  acc.SuppressionAttributes = {
    SuppressedReasons: input["SuppressedReasons"],
  };
  ctx.store.set(accountKey(), acc);
  return {};
};

const PutAccountVdmAttributes: OperationHandler = (input, ctx) => {
  const acc = getAccount(ctx);
  acc.VdmAttributes = input["VdmAttributes"] as
    | Record<string, unknown>
    | undefined;
  ctx.store.set(accountKey(), acc);
  return {};
};

const PutConfigurationSetArchivingOptions: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  (stored as Record<string, unknown>)["ArchivingOptions"] = {
    ArchiveArn: input["ArchiveArn"],
  };
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutConfigurationSetVdmOptions: OperationHandler = (input, ctx) => {
  const name = input["ConfigurationSetName"] as string;
  const stored = requireConfigSet(ctx, name);
  stored.VdmOptions = input["VdmOptions"] as
    | Record<string, unknown>
    | undefined;
  ctx.store.set(configSetKey(name), stored);
  return {};
};

const PutEmailIdentityConfigurationSetAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const identity = input["EmailIdentity"] as string;
  const stored = requireIdentity(ctx, identity);
  stored.ConfigurationSetName = input["ConfigurationSetName"] as
    | string
    | undefined;
  ctx.store.set(identityKey(identity), stored);
  return {};
};

const PutEmailIdentityDkimAttributes: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  const stored = requireIdentity(ctx, identity);
  stored.DkimAttributes.SigningEnabled =
    (input["SigningEnabled"] as boolean | undefined) ?? false;
  ctx.store.set(identityKey(identity), stored);
  return {};
};

const PutEmailIdentityDkimSigningAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const identity = input["EmailIdentity"] as string;
  const stored = requireIdentity(ctx, identity);
  const origin =
    (input["SigningAttributesOrigin"] as string | undefined) ?? "AWS_SES";
  stored.DkimAttributes.SigningAttributesOrigin = origin;
  ctx.store.set(identityKey(identity), stored);
  return { DkimStatus: stored.DkimAttributes.Status, DkimTokens: [] };
};

const PutEmailIdentityFeedbackAttributes: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  const stored = requireIdentity(ctx, identity);
  stored.FeedbackForwardingStatus =
    (input["EmailForwardingEnabled"] as boolean | undefined) ?? true;
  ctx.store.set(identityKey(identity), stored);
  return {};
};

const PutEmailIdentityMailFromAttributes: OperationHandler = (input, ctx) => {
  const identity = input["EmailIdentity"] as string;
  const stored = requireIdentity(ctx, identity);
  stored.MailFromAttributes.MailFromDomain =
    (input["MailFromDomain"] as string | undefined) ?? "";
  stored.MailFromAttributes.BehaviorOnMxFailure =
    (input["BehaviorOnMxFailure"] as string | undefined) ?? "USE_DEFAULT_VALUE";
  ctx.store.set(identityKey(identity), stored);
  return {};
};

const requireTenant = (ctx: ServiceContext, name: string): StoredTenant => {
  const stored = ctx.store.get<StoredTenant>(tenantKey(name));
  if (stored === undefined) {
    throw awsError("NotFoundException", `Tenant ${name} not found.`, 404);
  }
  return stored;
};

const CreateTenant: OperationHandler = (input, ctx) => {
  const name = input["TenantName"] as string;
  if (ctx.store.get(tenantKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Tenant ${name} already exists.`,
      400,
    );
  }
  const tenantId = `tenant-${name}`;
  const tenantArn = `arn:aws:ses:us-east-1:123456789012:tenant/${name}`;
  const stored: StoredTenant = {
    TenantName: name,
    TenantId: tenantId,
    TenantArn: tenantArn,
    CreatedTimestamp: new Date().toISOString(),
    Tags: (input["Tags"] as Tag[] | undefined) ?? [],
    SendingStatus: "ENABLED",
    SuppressionAttributes: input["SuppressionAttributes"] as
      | Record<string, unknown>
      | undefined,
  };
  ctx.store.set(tenantKey(name), stored);
  return {
    TenantName: stored.TenantName,
    TenantId: stored.TenantId,
    TenantArn: stored.TenantArn,
    CreatedTimestamp: stored.CreatedTimestamp,
    Tags: stored.Tags,
    SendingStatus: stored.SendingStatus,
    SuppressionAttributes: stored.SuppressionAttributes,
  };
};

const DeleteTenant: OperationHandler = (input, ctx) => {
  const name = input["TenantName"] as string;
  requireTenant(ctx, name);
  ctx.store.delete(tenantKey(name));
  ctx.store
    .list()
    .filter((e) => e.key.startsWith(`v2tenantresource/${name}/`))
    .forEach((e) => ctx.store.delete(e.key));
  return {};
};

const GetTenant: OperationHandler = (input, ctx) => {
  const name = input["TenantName"] as string;
  const stored = requireTenant(ctx, name);
  return {
    Tenant: {
      TenantName: stored.TenantName,
      TenantId: stored.TenantId,
      TenantArn: stored.TenantArn,
      CreatedTimestamp: stored.CreatedTimestamp,
      Tags: stored.Tags,
      SendingStatus: stored.SendingStatus,
      SuppressionAttributes: stored.SuppressionAttributes,
    },
  };
};

const ListTenants: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2tenant/"))
    .map((e) => {
      const s = e.value as StoredTenant;
      return {
        TenantName: s.TenantName,
        TenantId: s.TenantId,
        TenantArn: s.TenantArn,
        CreatedTimestamp: s.CreatedTimestamp,
        SendingStatus: s.SendingStatus,
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
    Tenants: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const CreateTenantResourceAssociation: OperationHandler = (input, ctx) => {
  const tenantName = input["TenantName"] as string;
  const resourceArn = input["ResourceArn"] as string;
  requireTenant(ctx, tenantName);
  const key = tenantResourceKey(tenantName, resourceArn);
  if (ctx.store.get(key) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Resource ${resourceArn} already associated with tenant ${tenantName}.`,
      400,
    );
  }
  const stored: StoredTenantResourceAssociation = {
    TenantName: tenantName,
    ResourceArn: resourceArn,
  };
  ctx.store.set(key, stored);
  return {};
};

const DeleteTenantResourceAssociation: OperationHandler = (input, ctx) => {
  const tenantName = input["TenantName"] as string;
  const resourceArn = input["ResourceArn"] as string;
  const key = tenantResourceKey(tenantName, resourceArn);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "NotFoundException",
      `Resource ${resourceArn} not associated with tenant ${tenantName}.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListTenantResources: OperationHandler = (input, ctx) => {
  const tenantName = input["TenantName"] as string;
  requireTenant(ctx, tenantName);
  const prefix = `v2tenantresource/${tenantName}/`;
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => ({
      ResourceArn: (e.value as StoredTenantResourceAssociation).ResourceArn,
    }));

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
    TenantResources: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const ListResourceTenants: OperationHandler = (input, ctx) => {
  const resourceArn = input["ResourceArn"] as string;
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2tenantresource/"))
    .map((e) => e.value as StoredTenantResourceAssociation)
    .filter((a) => a.ResourceArn === resourceArn)
    .map((a) => ({ TenantName: a.TenantName }));

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
    ResourceTenants: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const PutTenantSuppressionAttributes: OperationHandler = (input, ctx) => {
  const tenantName = input["TenantName"] as string;
  const stored = requireTenant(ctx, tenantName);
  stored.SuppressionAttributes = {
    SuppressedReasons: input["SuppressedReasons"],
  };
  ctx.store.set(tenantKey(tenantName), stored);
  return {};
};

const CreateMultiRegionEndpoint: OperationHandler = (input, ctx) => {
  const name = input["EndpointName"] as string;
  if (ctx.store.get(multiRegionEndpointKey(name)) !== undefined) {
    throw awsError(
      "AlreadyExistsException",
      `Multi-region endpoint ${name} already exists.`,
      400,
    );
  }
  const endpointId = `mre-${name}`;
  const stored: StoredMultiRegionEndpoint = {
    EndpointName: name,
    EndpointId: endpointId,
    Details: input["Details"] as Record<string, unknown> | undefined,
    Status: "READY",
    CreatedTimestamp: new Date().toISOString(),
  };
  ctx.store.set(multiRegionEndpointKey(name), stored);
  return { Status: "READY", EndpointId: endpointId };
};

const DeleteMultiRegionEndpoint: OperationHandler = (input, ctx) => {
  const name = input["EndpointName"] as string;
  if (ctx.store.get(multiRegionEndpointKey(name)) === undefined) {
    throw awsError(
      "NotFoundException",
      `Multi-region endpoint ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(multiRegionEndpointKey(name));
  return {};
};

const GetMultiRegionEndpoint: OperationHandler = (input, ctx) => {
  const name = input["EndpointName"] as string;
  const stored = ctx.store.get<StoredMultiRegionEndpoint>(
    multiRegionEndpointKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Multi-region endpoint ${name} not found.`,
      404,
    );
  }
  return {
    EndpointName: stored.EndpointName,
    EndpointId: stored.EndpointId,
    Routes: [],
    Status: stored.Status,
    CreatedTimestamp: stored.CreatedTimestamp,
    LastUpdatedTimestamp: stored.CreatedTimestamp,
  };
};

const ListMultiRegionEndpoints: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2mre/"))
    .map((e) => {
      const s = e.value as StoredMultiRegionEndpoint;
      return {
        EndpointName: s.EndpointName,
        EndpointId: s.EndpointId,
        Status: s.Status,
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
    MultiRegionEndpoints: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const GetDeliverabilityDashboardOptions: OperationHandler = (_input, ctx) => {
  const stored =
    ctx.store.get<StoredDeliverabilityDashboard>(delivDashboardKey());
  return {
    DashboardEnabled: stored?.DashboardEnabled ?? false,
    SubscriptionExpiryDate: stored?.SubscriptionExpiryDate,
    AccountStatus: stored?.AccountStatus,
    ActiveSubscribedDomains: stored?.ActiveSubscribedDomains ?? [],
    PendingExpirationSubscribedDomains: [],
  };
};

const PutDeliverabilityDashboardOption: OperationHandler = (input, ctx) => {
  const existing =
    ctx.store.get<StoredDeliverabilityDashboard>(delivDashboardKey());
  const stored: StoredDeliverabilityDashboard = existing ?? {
    DashboardEnabled: false,
    SubscriptionExpiryDate: undefined,
    AccountStatus: undefined,
    ActiveSubscribedDomains: undefined,
  };
  stored.DashboardEnabled = (input["DashboardEnabled"] as boolean) ?? false;
  ctx.store.set(delivDashboardKey(), stored);
  return {};
};

const GetDomainDeliverabilityCampaign: OperationHandler = (input, _ctx) => {
  const campaignId = input["CampaignId"] as string;
  throw awsError("NotFoundException", `Campaign ${campaignId} not found.`, 404);
};

const ListDomainDeliverabilityCampaigns: OperationHandler = (_input, _ctx) => {
  return { DomainDeliverabilityCampaigns: [] };
};

const GetDomainStatisticsReport: OperationHandler = (_input, _ctx) => {
  return {
    OverallVolume: {
      VolumeStatistics: {
        InboxRawCount: 0,
        SpamRawCount: 0,
        ProjectedInbox: 0,
        ProjectedSpam: 0,
      },
      ReadRatePercent: 0,
      DomainIspPlacements: [],
    },
    DailyVolumes: [],
  };
};

const GetBlacklistReports: OperationHandler = (_input, _ctx) => {
  return { BlacklistReport: {} };
};

const GetReputationEntity: OperationHandler = (input, ctx) => {
  const entityType = input["ReputationEntityType"] as string;
  const entityRef = input["ReputationEntityReference"] as string;
  const stored = ctx.store.get<StoredReputationEntity>(
    reputationEntityKey(entityType, entityRef),
  );
  if (stored === undefined) {
    throw awsError(
      "NotFoundException",
      `Reputation entity ${entityRef} not found.`,
      404,
    );
  }
  return {
    ReputationEntity: {
      ReputationEntityReference: stored.ReputationEntityReference,
      ReputationEntityType: stored.ReputationEntityType,
      ReputationManagementPolicy: stored.ReputationManagementPolicy,
      CustomerManagedStatus: stored.CustomerManagedStatus,
    },
  };
};

const ListReputationEntities: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list()
    .filter((e) => e.key.startsWith("v2reputation/"))
    .map((e) => {
      const s = e.value as StoredReputationEntity;
      return {
        ReputationEntityReference: s.ReputationEntityReference,
        ReputationEntityType: s.ReputationEntityType,
        ReputationManagementPolicy: s.ReputationManagementPolicy,
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
    ReputationEntities: page,
    NextToken: hasMore ? String(start + pageSize) : undefined,
  };
};

const UpdateReputationEntityCustomerManagedStatus: OperationHandler = (
  input,
  ctx,
) => {
  const entityType = input["ReputationEntityType"] as string;
  const entityRef = input["ReputationEntityReference"] as string;
  const key = reputationEntityKey(entityType, entityRef);
  const existing = ctx.store.get<StoredReputationEntity>(key);
  const stored: StoredReputationEntity = existing ?? {
    ReputationEntityReference: entityRef,
    ReputationEntityType: entityType,
    ReputationManagementPolicy: undefined,
    CustomerManagedStatus: undefined,
  };
  stored.CustomerManagedStatus = input["CustomerManagedStatus"] as
    | Record<string, unknown>
    | undefined;
  ctx.store.set(key, stored);
  return {};
};

const UpdateReputationEntityPolicy: OperationHandler = (input, ctx) => {
  const entityType = input["ReputationEntityType"] as string;
  const entityRef = input["ReputationEntityReference"] as string;
  const key = reputationEntityKey(entityType, entityRef);
  const existing = ctx.store.get<StoredReputationEntity>(key);
  const stored: StoredReputationEntity = existing ?? {
    ReputationEntityReference: entityRef,
    ReputationEntityType: entityType,
    ReputationManagementPolicy: undefined,
    CustomerManagedStatus: undefined,
  };
  stored.ReputationManagementPolicy = input["ReputationManagementPolicy"] as
    | string
    | undefined;
  ctx.store.set(key, stored);
  return {};
};

const ListRecommendations: OperationHandler = (_input, _ctx) => {
  return { Recommendations: [] };
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
      if (parts.length === 5 && parts[4] === "policies") {
        if (m === "GET") return "GetEmailIdentityPolicies";
      }
      if (parts.length === 6 && parts[4] === "policies") {
        if (m === "POST") return "CreateEmailIdentityPolicy";
        if (m === "DELETE") return "DeleteEmailIdentityPolicy";
        if (m === "PUT") return "UpdateEmailIdentityPolicy";
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

    if (parts[2] === "contact-lists") {
      if (parts.length === 3) {
        if (m === "GET") return "ListContactLists";
        if (m === "POST") return "CreateContactList";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetContactList";
        if (m === "DELETE") return "DeleteContactList";
        if (m === "PUT") return "UpdateContactList";
      }
      if (parts.length === 5 && parts[4] === "contacts") {
        if (m === "POST") return "CreateContact";
      }
      if (parts.length === 6 && parts[4] === "contacts") {
        if (parts[5] === "list" && m === "POST") return "ListContacts";
        if (m === "GET") return "GetContact";
        if (m === "DELETE") return "DeleteContact";
        if (m === "PUT") return "UpdateContact";
      }
    }

    if (parts[2] === "custom-verification-email-templates") {
      if (parts.length === 3) {
        if (m === "GET") return "ListCustomVerificationEmailTemplates";
        if (m === "POST") return "CreateCustomVerificationEmailTemplate";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetCustomVerificationEmailTemplate";
        if (m === "DELETE") return "DeleteCustomVerificationEmailTemplate";
        if (m === "PUT") return "UpdateCustomVerificationEmailTemplate";
      }
    }

    if (parts[2] === "outbound-custom-verification-emails" && m === "POST") {
      return "SendCustomVerificationEmail";
    }

    if (parts[2] === "export-jobs") {
      if (parts.length === 3 && m === "POST") return "CreateExportJob";
      if (parts.length === 4 && m === "GET") return "GetExportJob";
      if (parts.length === 5 && parts[4] === "cancel" && m === "PUT")
        return "CancelExportJob";
    }

    if (parts[2] === "list-export-jobs" && m === "POST")
      return "ListExportJobs";

    if (parts[2] === "import-jobs") {
      if (parts.length === 3 && m === "POST") return "CreateImportJob";
      if (parts.length === 4 && m === "GET") return "GetImportJob";
    }

    if (parts[2] === "import-jobs" && parts[3] === "list" && m === "POST")
      return "ListImportJobs";

    if (parts[2] === "deliverability-dashboard") {
      if (parts[3] === "test" && m === "POST")
        return "CreateDeliverabilityTestReport";
      if (parts[3] === "test-reports") {
        if (parts.length === 4 && m === "GET")
          return "ListDeliverabilityTestReports";
        if (parts.length === 5 && m === "GET")
          return "GetDeliverabilityTestReport";
      }
    }

    if (parts[2] === "outbound-bulk-emails" && m === "POST")
      return "SendBulkEmail";

    if (
      parts[2] === "templates" &&
      parts.length === 5 &&
      parts[4] === "render" &&
      m === "POST"
    ) {
      return "TestRenderEmailTemplate";
    }

    if (parts[2] === "metrics" && parts[3] === "batch" && m === "POST")
      return "BatchGetMetricData";

    if (parts[2] === "insights" && m === "GET") return "GetMessageInsights";

    if (parts[2] === "email-address-insights" && m === "POST")
      return "GetEmailAddressInsights";

    if (parts[2] === "dedicated-ip-pools") {
      if (parts.length === 3) {
        if (m === "GET") return "ListDedicatedIpPools";
        if (m === "POST") return "CreateDedicatedIpPool";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetDedicatedIpPool";
        if (m === "DELETE") return "DeleteDedicatedIpPool";
      }
      if (parts.length === 5 && parts[4] === "scaling" && m === "PUT")
        return "PutDedicatedIpPoolScalingAttributes";
    }

    if (parts[2] === "dedicated-ips") {
      if (parts.length === 3 && m === "GET") return "GetDedicatedIps";
      if (parts.length === 4 && m === "GET") return "GetDedicatedIp";
      if (parts.length === 5 && parts[4] === "pool" && m === "PUT")
        return "PutDedicatedIpInPool";
      if (parts.length === 5 && parts[4] === "warmup" && m === "PUT")
        return "PutDedicatedIpWarmupAttributes";
    }

    if (parts[2] === "account") {
      if (parts.length === 3 && m === "GET") return "GetAccount";
      if (parts.length === 4) {
        const sub = parts[3];
        if (sub === "details" && m === "POST") return "PutAccountDetails";
        if (sub === "sending" && m === "PUT")
          return "PutAccountSendingAttributes";
        if (sub === "suppression" && m === "PUT")
          return "PutAccountSuppressionAttributes";
        if (sub === "vdm" && m === "PUT") return "PutAccountVdmAttributes";
      }
      if (
        parts.length === 5 &&
        parts[3] === "dedicated-ips" &&
        parts[4] === "warmup" &&
        m === "PUT"
      )
        return "PutAccountDedicatedIpWarmupAttributes";
    }

    if (parts[2] === "configuration-sets" && parts.length === 5) {
      const sub = parts[4];
      if (sub === "archiving-options" && m === "PUT")
        return "PutConfigurationSetArchivingOptions";
      if (sub === "vdm-options" && m === "PUT")
        return "PutConfigurationSetVdmOptions";
    }

    if (parts[2] === "identities" && parts.length === 5) {
      const sub = parts[4];
      if (sub === "configuration-set" && m === "PUT")
        return "PutEmailIdentityConfigurationSetAttributes";
      if (sub === "dkim" && m === "PUT")
        return "PutEmailIdentityDkimAttributes";
      if (sub === "feedback" && m === "PUT")
        return "PutEmailIdentityFeedbackAttributes";
      if (sub === "mail-from" && m === "PUT")
        return "PutEmailIdentityMailFromAttributes";
    }

    if (
      parts[2] === "identities" &&
      parts.length === 6 &&
      parts[4] === "dkim" &&
      parts[5] === "signing" &&
      m === "PUT"
    )
      return "PutEmailIdentityDkimSigningAttributes";

    if (parts[2] === "tenants") {
      if (parts.length === 3 && m === "POST") return "CreateTenant";
      if (parts.length === 4) {
        const sub = parts[3];
        if (sub === "delete" && m === "POST") return "DeleteTenant";
        if (sub === "get" && m === "POST") return "GetTenant";
        if (sub === "list" && m === "POST") return "ListTenants";
      }
      if (parts.length === 4 && parts[3] === "resources" && m === "POST")
        return "CreateTenantResourceAssociation";
      if (parts.length === 5) {
        const sub = parts[3];
        if (sub === "resources" && parts[4] === "delete" && m === "POST")
          return "DeleteTenantResourceAssociation";
        if (sub === "resources" && parts[4] === "list" && m === "POST")
          return "ListTenantResources";
      }
    }

    if (parts[2] === "tenant" && parts[3] === "suppression" && m === "POST")
      return "PutTenantSuppressionAttributes";

    if (
      parts[2] === "resources" &&
      parts[3] === "tenants" &&
      parts[4] === "list" &&
      m === "POST"
    )
      return "ListResourceTenants";

    if (parts[2] === "multi-region-endpoints") {
      if (parts.length === 3) {
        if (m === "GET") return "ListMultiRegionEndpoints";
        if (m === "POST") return "CreateMultiRegionEndpoint";
      }
      if (parts.length === 4) {
        if (m === "GET") return "GetMultiRegionEndpoint";
        if (m === "DELETE") return "DeleteMultiRegionEndpoint";
      }
    }

    if (parts[2] === "deliverability-dashboard" && parts.length === 3) {
      if (m === "GET") return "GetDeliverabilityDashboardOptions";
      if (m === "PUT") return "PutDeliverabilityDashboardOption";
    }

    if (parts[2] === "deliverability-dashboard") {
      if (parts[3] === "campaigns" && parts.length === 4 && m === "GET")
        return "GetDomainDeliverabilityCampaign";
      if (
        parts[3] === "domains" &&
        parts.length === 5 &&
        parts[5] === "campaigns" &&
        m === "GET"
      )
        return "ListDomainDeliverabilityCampaigns";
      if (parts[3] === "statistics-report" && parts.length === 5 && m === "GET")
        return "GetDomainStatisticsReport";
      if (parts[3] === "blacklist-report" && parts.length === 4 && m === "GET")
        return "GetBlacklistReports";
    }

    if (parts[2] === "reputation" && parts[3] === "entities") {
      if (parts.length === 4 && m === "POST") return "ListReputationEntities";
      if (parts.length === 6 && m === "GET") return "GetReputationEntity";
      if (
        parts.length === 7 &&
        parts[6] === "customer-managed-status" &&
        m === "PUT"
      )
        return "UpdateReputationEntityCustomerManagedStatus";
      if (parts.length === 7 && parts[6] === "policy" && m === "PUT")
        return "UpdateReputationEntityPolicy";
    }

    if (parts[2] === "vdm" && parts[3] === "recommendations" && m === "POST")
      return "ListRecommendations";

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
    CreateContactList,
    GetContactList,
    DeleteContactList,
    UpdateContactList,
    ListContactLists,
    CreateContact,
    GetContact,
    DeleteContact,
    UpdateContact,
    ListContacts,
    CreateCustomVerificationEmailTemplate,
    GetCustomVerificationEmailTemplate,
    DeleteCustomVerificationEmailTemplate,
    UpdateCustomVerificationEmailTemplate,
    ListCustomVerificationEmailTemplates,
    SendCustomVerificationEmail,
    CreateEmailIdentityPolicy,
    DeleteEmailIdentityPolicy,
    UpdateEmailIdentityPolicy,
    GetEmailIdentityPolicies,
    CreateExportJob,
    CancelExportJob,
    GetExportJob,
    ListExportJobs,
    CreateImportJob,
    GetImportJob,
    ListImportJobs,
    CreateDeliverabilityTestReport,
    GetDeliverabilityTestReport,
    ListDeliverabilityTestReports,
    SendBulkEmail,
    TestRenderEmailTemplate,
    BatchGetMetricData,
    GetMessageInsights,
    GetEmailAddressInsights,
    CreateDedicatedIpPool,
    DeleteDedicatedIpPool,
    GetDedicatedIpPool,
    ListDedicatedIpPools,
    GetDedicatedIp,
    GetDedicatedIps,
    PutDedicatedIpInPool,
    PutDedicatedIpPoolScalingAttributes,
    PutDedicatedIpWarmupAttributes,
    PutAccountDedicatedIpWarmupAttributes,
    GetAccount,
    PutAccountDetails,
    PutAccountSendingAttributes,
    PutAccountSuppressionAttributes,
    PutAccountVdmAttributes,
    PutConfigurationSetArchivingOptions,
    PutConfigurationSetVdmOptions,
    PutEmailIdentityConfigurationSetAttributes,
    PutEmailIdentityDkimAttributes,
    PutEmailIdentityDkimSigningAttributes,
    PutEmailIdentityFeedbackAttributes,
    PutEmailIdentityMailFromAttributes,
    CreateTenant,
    DeleteTenant,
    GetTenant,
    ListTenants,
    CreateTenantResourceAssociation,
    DeleteTenantResourceAssociation,
    ListTenantResources,
    ListResourceTenants,
    PutTenantSuppressionAttributes,
    CreateMultiRegionEndpoint,
    DeleteMultiRegionEndpoint,
    GetMultiRegionEndpoint,
    ListMultiRegionEndpoints,
    GetDeliverabilityDashboardOptions,
    PutDeliverabilityDashboardOption,
    GetDomainDeliverabilityCampaign,
    ListDomainDeliverabilityCampaigns,
    GetDomainStatisticsReport,
    GetBlacklistReports,
    GetReputationEntity,
    ListReputationEntities,
    UpdateReputationEntityCustomerManagedStatus,
    UpdateReputationEntityPolicy,
    ListRecommendations,
  },
  model,
} as const satisfies ServiceDefinition;

export default sesv2;
