import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/support.json", { with: { type: "json" } }),
);

const casePrefix = "case:" as const;

const communicationPrefix = "communication:" as const;

const attachmentSetPrefix = "attachmentSet:" as const;

const attachmentPrefix = "attachment:" as const;

type StoredAttachment = {
  attachmentId: string;
  fileName: string;
  data: string;
};

type StoredAttachmentSet = {
  attachmentSetId: string;
  expiryTime: string;
  attachmentIds: string[];
};

type StoredCommunication = {
  caseId: string;
  body: string;
  submittedBy: string;
  timeCreated: string;
  attachmentSet: { attachmentId: string; fileName: string }[];
};

type StoredCase = {
  caseId: string;
  displayId: string;
  subject: string;
  status: string;
  serviceCode: string;
  categoryCode: string;
  severityCode: string;
  submittedBy: string;
  timeCreated: string;
  ccEmailAddresses: string[];
  language: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" && value !== "" ? value : fallback;

const arrayOfStrings = (value: unknown): string[] =>
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

const newCaseId = (): string => {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return `case-000000000000-${year}-${suffix}`;
};

const newAttachmentSetId = (): string => crypto.randomUUID();

const newAttachmentId = (): string => crypto.randomUUID();

const newCommunicationTime = (): string => new Date().toISOString();

const caseKey = (id: string): string => `${casePrefix}${id}`;

const communicationsKey = (caseId: string): string =>
  `${communicationPrefix}${caseId}`;

const attachmentSetKey = (id: string): string => `${attachmentSetPrefix}${id}`;

const attachmentKey = (id: string): string => `${attachmentPrefix}${id}`;

const requireCase = (ctx: ServiceContext, caseId: string): StoredCase => {
  const found = ctx.store.get<StoredCase>(caseKey(caseId));
  if (found === undefined) {
    throw awsError("CaseIdNotFound", `Case ${caseId} not found.`, 400);
  }
  return found;
};

const listCommunications = (
  ctx: ServiceContext,
  caseId: string,
): StoredCommunication[] =>
  ctx.store.get<StoredCommunication[]>(communicationsKey(caseId)) ?? [];

const appendCommunication = (
  ctx: ServiceContext,
  caseId: string,
  entry: StoredCommunication,
): void => {
  const existing = listCommunications(ctx, caseId);
  ctx.store.set(communicationsKey(caseId), [...existing, entry]);
};

const recentCommunications = (
  list: StoredCommunication[],
): { communications: StoredCommunication[] } => ({
  communications: list.slice(-5),
});

const caseView = (
  c: StoredCase,
  comms: StoredCommunication[],
): Record<string, unknown> => ({
  caseId: c.caseId,
  displayId: c.displayId,
  subject: c.subject,
  status: c.status,
  serviceCode: c.serviceCode,
  categoryCode: c.categoryCode,
  severityCode: c.severityCode,
  submittedBy: c.submittedBy,
  timeCreated: c.timeCreated,
  recentCommunications: recentCommunications(comms),
  ccEmailAddresses: c.ccEmailAddresses,
  language: c.language,
});

const AddAttachmentsToSet: OperationHandler = (input, ctx) => {
  const attachments = Array.isArray(input["attachments"])
    ? (input["attachments"] as Record<string, unknown>[])
    : [];
  if (attachments.length === 0) {
    throw awsError("ValidationException", "attachments is required.", 400);
  }
  const requestedSetId = stringOrUndefined(input["attachmentSetId"]);
  let setId: string;
  let existingIds: string[];
  if (requestedSetId !== undefined) {
    const set = ctx.store.get<StoredAttachmentSet>(
      attachmentSetKey(requestedSetId),
    );
    if (set === undefined) {
      throw awsError(
        "AttachmentSetIdNotFound",
        `Attachment set ${requestedSetId} not found.`,
        400,
      );
    }
    setId = requestedSetId;
    existingIds = set.attachmentIds;
  } else {
    setId = newAttachmentSetId();
    existingIds = [];
  }
  const newIds: string[] = [];
  for (const att of attachments) {
    const fileName = stringOr(att["fileName"], "");
    const data =
      typeof att["data"] === "string"
        ? att["data"]
        : att["data"] instanceof Uint8Array
          ? Buffer.from(att["data"]).toString("base64")
          : "";
    const id = newAttachmentId();
    const stored: StoredAttachment = { attachmentId: id, fileName, data };
    ctx.store.set(attachmentKey(id), stored);
    newIds.push(id);
  }
  const expiryTime = new Date(Date.now() + 3_600_000).toISOString();
  const set: StoredAttachmentSet = {
    attachmentSetId: setId,
    expiryTime,
    attachmentIds: [...existingIds, ...newIds],
  };
  ctx.store.set(attachmentSetKey(setId), set);
  return { attachmentSetId: setId, expiryTime };
};

const AddCommunicationToCase: OperationHandler = (input, ctx) => {
  const body = requireString(input, "communicationBody");
  const caseId = stringOrUndefined(input["caseId"]);
  if (caseId === undefined) {
    throw awsError("ValidationException", "caseId is required.", 400);
  }
  requireCase(ctx, caseId);
  const attachmentSetId = stringOrUndefined(input["attachmentSetId"]);
  let attachmentSet: { attachmentId: string; fileName: string }[] = [];
  if (attachmentSetId !== undefined) {
    const set = ctx.store.get<StoredAttachmentSet>(
      attachmentSetKey(attachmentSetId),
    );
    if (set === undefined) {
      throw awsError(
        "AttachmentSetIdNotFound",
        `Attachment set ${attachmentSetId} not found.`,
        400,
      );
    }
    attachmentSet = set.attachmentIds
      .map((id) => ctx.store.get<StoredAttachment>(attachmentKey(id)))
      .filter((att): att is StoredAttachment => att !== undefined)
      .map((att) => ({
        attachmentId: att.attachmentId,
        fileName: att.fileName,
      }));
  }
  const entry: StoredCommunication = {
    caseId,
    body,
    submittedBy: "bunsai-support@example.com",
    timeCreated: newCommunicationTime(),
    attachmentSet,
  };
  appendCommunication(ctx, caseId, entry);
  return { result: true };
};

const CreateCase: OperationHandler = (input, ctx) => {
  const subject = requireString(input, "subject");
  const body = requireString(input, "communicationBody");
  const id = newCaseId();
  const now = new Date().toISOString();
  const attachmentSetId = stringOrUndefined(input["attachmentSetId"]);
  let attachmentSet: { attachmentId: string; fileName: string }[] = [];
  if (attachmentSetId !== undefined) {
    const set = ctx.store.get<StoredAttachmentSet>(
      attachmentSetKey(attachmentSetId),
    );
    if (set === undefined) {
      throw awsError(
        "AttachmentSetIdNotFound",
        `Attachment set ${attachmentSetId} not found.`,
        400,
      );
    }
    attachmentSet = set.attachmentIds
      .map((aid) => ctx.store.get<StoredAttachment>(attachmentKey(aid)))
      .filter((att): att is StoredAttachment => att !== undefined)
      .map((att) => ({
        attachmentId: att.attachmentId,
        fileName: att.fileName,
      }));
  }
  const stored: StoredCase = {
    caseId: id,
    displayId: id.split("-").pop() ?? id,
    subject,
    status: "opened",
    serviceCode: stringOr(input["serviceCode"], "general-info"),
    categoryCode: stringOr(input["categoryCode"], "other"),
    severityCode: stringOr(input["severityCode"], "low"),
    submittedBy: "bunsai-support@example.com",
    timeCreated: now,
    ccEmailAddresses: arrayOfStrings(input["ccEmailAddresses"]),
    language: stringOr(input["language"], "en"),
  };
  ctx.store.set(caseKey(id), stored);
  const initial: StoredCommunication = {
    caseId: id,
    body,
    submittedBy: stored.submittedBy,
    timeCreated: now,
    attachmentSet,
  };
  appendCommunication(ctx, id, initial);
  return { caseId: id };
};

const DescribeAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "attachmentId");
  const att = ctx.store.get<StoredAttachment>(attachmentKey(id));
  if (att === undefined) {
    throw awsError("AttachmentIdNotFound", `Attachment ${id} not found.`, 400);
  }
  return { attachment: { fileName: att.fileName, data: att.data } };
};

const DescribeCases: OperationHandler = (input, ctx) => {
  const caseIdList = arrayOfStrings(input["caseIdList"]);
  const includeResolved =
    typeof input["includeResolvedCases"] === "boolean"
      ? (input["includeResolvedCases"] as boolean)
      : false;
  const includeCommunications =
    typeof input["includeCommunications"] === "boolean"
      ? (input["includeCommunications"] as boolean)
      : true;
  const all = ctx.store
    .list<StoredCase>()
    .filter((entry) => entry.key.startsWith(casePrefix))
    .map((entry) => entry.value)
    .filter((c) => caseIdList.length === 0 || caseIdList.includes(c.caseId))
    .filter((c) => includeResolved || c.status !== "resolved")
    .sort((a, b) =>
      a.timeCreated < b.timeCreated
        ? 1
        : a.timeCreated > b.timeCreated
          ? -1
          : 0,
    );
  const cases = all.map((c) => {
    const comms = includeCommunications
      ? listCommunications(ctx, c.caseId)
      : [];
    return caseView(c, comms);
  });
  return { cases };
};

const DescribeCommunications: OperationHandler = (input, ctx) => {
  const caseId = requireString(input, "caseId");
  requireCase(ctx, caseId);
  const communications = listCommunications(ctx, caseId);
  return { communications };
};

const DescribeCreateCaseOptions: OperationHandler = (input) => {
  requireString(input, "issueType");
  requireString(input, "serviceCode");
  requireString(input, "language");
  requireString(input, "categoryCode");
  return {
    languageAvailability: "available",
    communicationTypes: [
      {
        type: "web",
        supportedHours: [
          { startTime: "00:00:00.000", endTime: "23:59:59.999" },
        ],
        datesWithoutSupport: [],
      },
    ],
  };
};

const DescribeServices: OperationHandler = (input) => {
  const requested = arrayOfStrings(input["serviceCodeList"]);
  const services = [
    {
      code: "general-info",
      name: "General Info and Getting Started",
      categories: [{ code: "other", name: "Other" }],
    },
    {
      code: "amazon-ec2",
      name: "Amazon Elastic Compute Cloud (Linux)",
      categories: [
        { code: "instance-issue", name: "Instance Issues" },
        { code: "other", name: "Other" },
      ],
    },
  ];
  const filtered =
    requested.length === 0
      ? services
      : services.filter((s) => requested.includes(s.code));
  return { services: filtered };
};

const DescribeSeverityLevels: OperationHandler = () => ({
  severityLevels: [
    { code: "low", name: "General guidance" },
    { code: "normal", name: "System impaired" },
    { code: "high", name: "Production system impaired" },
    { code: "urgent", name: "Production system down" },
    { code: "critical", name: "Business-critical system down" },
  ],
});

const DescribeSupportedLanguages: OperationHandler = (input) => {
  requireString(input, "issueType");
  requireString(input, "serviceCode");
  requireString(input, "categoryCode");
  return {
    supportedLanguages: [
      { code: "en", language: "English", display: "English" },
      { code: "ja", language: "Japanese", display: "Japanese" },
      { code: "ko", language: "Korean", display: "Korean" },
      { code: "zh", language: "Chinese", display: "Chinese" },
    ],
  };
};

const DescribeTrustedAdvisorCheckRefreshStatuses: OperationHandler = (
  input,
) => {
  const checkIds = arrayOfStrings(input["checkIds"]);
  return {
    statuses: checkIds.map((checkId) => ({
      checkId,
      status: "none",
      millisUntilNextRefreshable: 0,
    })),
  };
};

const DescribeTrustedAdvisorCheckResult: OperationHandler = (input) => {
  const checkId = requireString(input, "checkId");
  return {
    result: {
      checkId,
      timestamp: new Date().toISOString(),
      status: "ok",
      resourcesSummary: {
        resourcesProcessed: 0,
        resourcesFlagged: 0,
        resourcesIgnored: 0,
        resourcesSuppressed: 0,
      },
      categorySpecificSummary: {},
      flaggedResources: [],
    },
  };
};

const DescribeTrustedAdvisorCheckSummaries: OperationHandler = (input) => {
  const checkIds = arrayOfStrings(input["checkIds"]);
  return {
    summaries: checkIds.map((checkId) => ({
      checkId,
      timestamp: new Date().toISOString(),
      status: "ok",
      hasFlaggedResources: false,
      resourcesSummary: {
        resourcesProcessed: 0,
        resourcesFlagged: 0,
        resourcesIgnored: 0,
        resourcesSuppressed: 0,
      },
      categorySpecificSummary: {},
    })),
  };
};

const DescribeTrustedAdvisorChecks: OperationHandler = (input) => {
  requireString(input, "language");
  return { checks: [] };
};

const RefreshTrustedAdvisorCheck: OperationHandler = (input) => {
  const checkId = requireString(input, "checkId");
  return {
    status: {
      checkId,
      status: "enqueued",
      millisUntilNextRefreshable: 0,
    },
  };
};

const ResolveCase: OperationHandler = (input, ctx) => {
  const caseId = stringOrUndefined(input["caseId"]);
  if (caseId === undefined) {
    throw awsError("ValidationException", "caseId is required.", 400);
  }
  const stored = requireCase(ctx, caseId);
  const initial = stored.status;
  const updated: StoredCase = { ...stored, status: "resolved" };
  ctx.store.set(caseKey(caseId), updated);
  return { initialCaseStatus: initial, finalCaseStatus: "resolved" };
};

const support = {
  name: "support",
  protocol: "json",
  operations: {
    AddAttachmentsToSet,
    AddCommunicationToCase,
    CreateCase,
    DescribeAttachment,
    DescribeCases,
    DescribeCommunications,
    DescribeCreateCaseOptions,
    DescribeServices,
    DescribeSeverityLevels,
    DescribeSupportedLanguages,
    DescribeTrustedAdvisorCheckRefreshStatuses,
    DescribeTrustedAdvisorCheckResult,
    DescribeTrustedAdvisorCheckSummaries,
    DescribeTrustedAdvisorChecks,
    RefreshTrustedAdvisorCheck,
    ResolveCase,
  },
  model,
} as const satisfies ServiceDefinition;

export default support;
