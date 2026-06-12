import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import guarddutyModel from "../../models/guardduty.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(guarddutyModel);

type StoredDetector = {
  DetectorId: string;
  Status: string;
  ServiceRole: string;
  FindingPublishingFrequency: string;
  Tags: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
};

type StoredFilter = {
  Name: string;
  Description: string;
  Action: string;
  Rank: number;
  FindingCriteria: unknown;
  Tags: Record<string, string>;
  CreatedAt: string;
  UpdatedAt: string;
};

type StoredIPSet = {
  IpSetId: string;
  Name: string;
  Format: string;
  Location: string;
  Status: string;
  Tags: Record<string, string>;
};

type StoredThreatEntitySet = {
  ThreatEntitySetId: string;
  Name: string;
  Format: string;
  Location: string;
  Status: string;
  Tags: Record<string, string>;
};

type StoredThreatIntelSet = {
  ThreatIntelSetId: string;
  Name: string;
  Format: string;
  Location: string;
  Status: string;
  Tags: Record<string, string>;
};

type StoredTrustedEntitySet = {
  TrustedEntitySetId: string;
  Name: string;
  Format: string;
  Location: string;
  Status: string;
  Tags: Record<string, string>;
};

type StoredMember = {
  AccountId: string;
  DetectorId: string;
  Email: string;
  MasterId: string;
  RelationshipStatus: string;
  InvitedAt: string;
  UpdatedAt: string;
};

type StoredPublishingDestination = {
  DestinationId: string;
  DestinationType: string;
  Status: string;
  PublishingFailureStartTimestamp: number;
  DestinationProperties: Record<string, unknown>;
};

type StoredMalwareProtectionPlan = {
  MalwareProtectionPlanId: string;
  Arn: string;
  Role: string;
  CreatedAt: number;
  Status: string;
  ProtectedResource: unknown;
  Actions: unknown;
};

type StoredFinding = {
  FindingId: string;
  AccountId: string;
  Arn: string;
  DetectorId: string;
  Region: string;
  Type: string;
  CreatedAt: string;
  UpdatedAt: string;
  Title: string;
  Description: string;
  Severity: number;
  Archived: boolean;
};

type StoredInvitation = {
  AccountId: string;
  InvitationId: string;
  RelationshipStatus: string;
  InvitedAt: string;
};

type StoredOrgAdmin = {
  AccountId: string;
};

type StoredMalwareScan = {
  ScanId: string;
  DetectorId: string;
  AccountId: string;
  ScanStatus: string;
  ScanStartTime: number;
  ScanEndTime: number;
  AdminDetectorId: string;
};

type StoredMalwareScanSettings = {
  ScanResourceCriteria: unknown;
  EbsSnapshotPreservation: string;
};

type StoredOrgConfig = {
  AutoEnableOrganizationMembers: string;
};

type StoredAdminRelationship = {
  AccountId: string;
  InvitationId: string;
  RelationshipStatus: string;
  InvitedAt: string;
};

const detectorKey = (id: string): string => `detector/${id}`;
const filterKey = (detectorId: string, name: string): string =>
  `filter:${detectorId}:${name}`;
const ipSetKey = (detectorId: string, id: string): string =>
  `ipset:${detectorId}:${id}`;
const threatEntitySetKey = (detectorId: string, id: string): string =>
  `threatentityset:${detectorId}:${id}`;
const threatIntelSetKey = (detectorId: string, id: string): string =>
  `threatintelset:${detectorId}:${id}`;
const trustedEntitySetKey = (detectorId: string, id: string): string =>
  `trustedentityset:${detectorId}:${id}`;
const memberKey = (detectorId: string, accountId: string): string =>
  `member:${detectorId}:${accountId}`;
const publishingDestKey = (detectorId: string, id: string): string =>
  `publishingdestination:${detectorId}:${id}`;
const malwareProtectionPlanKey = (id: string): string =>
  `malwareprotectionplan:${id}`;
const findingKey = (detectorId: string, findingId: string): string =>
  `finding:${detectorId}:${findingId}`;
const invitationKey = (accountId: string): string => `invitation:${accountId}`;
const orgAdminKey = (accountId: string): string => `orgadmin:${accountId}`;
const malwareScanKey = (scanId: string): string => `malwarescan:${scanId}`;
const malwareScanSettingsKey = (detectorId: string): string =>
  `malwarescansettings:${detectorId}`;
const orgConfigKey = (detectorId: string): string => `orgconfig:${detectorId}`;
const tagsKey = (arn: string): string => `tags:${arn}`;
const adminRelationshipKey = (detectorId: string): string =>
  `adminrelationship:${detectorId}`;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const booleanFrom = (value: unknown): boolean =>
  value === true || value === "true";

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

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const getFindingFieldValue = (
  finding: StoredFinding,
  field: string,
): unknown => {
  switch (field) {
    case "id":
      return finding.FindingId;
    case "severity":
      return finding.Severity;
    case "type":
      return finding.Type;
    case "region":
      return finding.Region;
    case "accountId":
      return finding.AccountId;
    case "service.archived":
      return String(finding.Archived);
    case "createdAt":
      return finding.CreatedAt;
    case "updatedAt":
      return finding.UpdatedAt;
    default:
      return undefined;
  }
};

const matchesFindingCriterion = (
  fieldVal: unknown,
  condition: Record<string, unknown>,
): boolean => {
  if ("Eq" in condition) {
    const eq = asStringArray(condition["Eq"]);
    if (eq.length > 0 && !eq.includes(String(fieldVal ?? ""))) return false;
  }
  if ("Neq" in condition) {
    const neq = asStringArray(condition["Neq"]);
    if (neq.length > 0 && neq.includes(String(fieldVal ?? ""))) return false;
  }
  if ("Lt" in condition && typeof condition["Lt"] === "number") {
    if (typeof fieldVal !== "number" || fieldVal >= condition["Lt"])
      return false;
  }
  if ("Lte" in condition && typeof condition["Lte"] === "number") {
    if (typeof fieldVal !== "number" || fieldVal > condition["Lte"])
      return false;
  }
  if ("Gt" in condition && typeof condition["Gt"] === "number") {
    if (typeof fieldVal !== "number" || fieldVal <= condition["Gt"])
      return false;
  }
  if ("Gte" in condition && typeof condition["Gte"] === "number") {
    if (typeof fieldVal !== "number" || fieldVal < condition["Gte"])
      return false;
  }
  return true;
};

const matchesFindingCriteria = (
  finding: StoredFinding,
  criterion: Record<string, unknown>,
): boolean => {
  for (const [field, cond] of Object.entries(criterion)) {
    const condition = asRecord(cond);
    if (condition === undefined) continue;
    if (
      !matchesFindingCriterion(getFindingFieldValue(finding, field), condition)
    )
      return false;
  }
  return true;
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

const serviceRoleOf = (ctx: ServiceContext): string =>
  `arn:aws:iam::${ctx.account}:role/aws-service-role/guardduty.amazonaws.com/AWSServiceRoleForAmazonGuardDuty`;

const requireDetector = (ctx: ServiceContext, id: string): StoredDetector => {
  const stored = ctx.store.get<StoredDetector>(detectorKey(id));
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `The request is rejected because the input detectorId is not owned by the current account.`,
      400,
    );
  }
  return stored;
};

const detectorArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:guardduty:${ctx.region}:${ctx.account}:detector/${id}`;

const CreateDetector: OperationHandler = (input, ctx) => {
  const enable = booleanFrom(input["Enable"]);
  const now = new Date().toISOString();
  const id = crypto.randomUUID().replace(/-/g, "");
  const detector: StoredDetector = {
    DetectorId: id,
    Status: enable ? "ENABLED" : "DISABLED",
    ServiceRole: serviceRoleOf(ctx),
    FindingPublishingFrequency:
      stringOrUndefined(input["FindingPublishingFrequency"]) ?? "SIX_HOURS",
    Tags: stringMapFrom(input["Tags"]),
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(detectorKey(id), detector);
  return { DetectorId: id, UnprocessedDataSources: undefined };
};

const GetDetector: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DetectorId");
  const detector = requireDetector(ctx, id);
  return {
    CreatedAt: detector.CreatedAt,
    FindingPublishingFrequency: detector.FindingPublishingFrequency,
    ServiceRole: detector.ServiceRole,
    Status: detector.Status,
    UpdatedAt: detector.UpdatedAt,
    Tags: detector.Tags,
  };
};

const ListDetectors: OperationHandler = (input, ctx) => {
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const all = ctx.store
    .list<StoredDetector>()
    .filter((entry) => entry.key.startsWith("detector/"))
    .map((entry) => entry.value.DetectorId)
    .sort((a, b) => a.localeCompare(b));
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { DetectorIds: page, NextToken: encodePageToken(nextOffset) };
  }
  return { DetectorIds: page };
};

const UpdateDetector: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DetectorId");
  const detector = requireDetector(ctx, id);
  const next: StoredDetector = {
    ...detector,
    Status:
      input["Enable"] === undefined
        ? detector.Status
        : booleanFrom(input["Enable"])
          ? "ENABLED"
          : "DISABLED",
    FindingPublishingFrequency:
      stringOrUndefined(input["FindingPublishingFrequency"]) ??
      detector.FindingPublishingFrequency,
    UpdatedAt: new Date().toISOString(),
  };
  ctx.store.set(detectorKey(id), next);
  return {};
};

const DeleteDetector: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DetectorId");
  requireDetector(ctx, id);
  ctx.store.delete(detectorKey(id));
  return {};
};

const AcceptAdministratorInvitation: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const administratorId = requireString(input, "AdministratorId");
  const invitationId =
    stringOrUndefined(input["InvitationId"]) ??
    "00000000000000000000000000000000";
  const rel: StoredAdminRelationship = {
    AccountId: administratorId,
    InvitationId: invitationId,
    RelationshipStatus: "Enabled",
    InvitedAt: new Date().toISOString(),
  };
  ctx.store.set(adminRelationshipKey(detectorId), rel);
  return {};
};

const AcceptInvitation: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const masterId = requireString(input, "MasterId");
  const invitationId =
    stringOrUndefined(input["InvitationId"]) ??
    "00000000000000000000000000000000";
  const rel: StoredAdminRelationship = {
    AccountId: masterId,
    InvitationId: invitationId,
    RelationshipStatus: "Enabled",
    InvitedAt: new Date().toISOString(),
  };
  ctx.store.set(adminRelationshipKey(detectorId), rel);
  return {};
};

const GetAdministratorAccount: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rel = ctx.store.get<StoredAdminRelationship>(
    adminRelationshipKey(detectorId),
  );
  if (rel === undefined) {
    throw awsError(
      "BadRequestException",
      "The request is rejected because no administrator account is associated with the detector.",
      400,
    );
  }
  return {
    Administrator: {
      AccountId: rel.AccountId,
      InvitationId: rel.InvitationId,
      RelationshipStatus: rel.RelationshipStatus,
      InvitedAt: rel.InvitedAt,
    },
  };
};

const GetMasterAccount: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rel = ctx.store.get<StoredAdminRelationship>(
    adminRelationshipKey(detectorId),
  );
  if (rel === undefined) {
    throw awsError(
      "BadRequestException",
      "The request is rejected because no master account is associated with the detector.",
      400,
    );
  }
  return {
    Master: {
      AccountId: rel.AccountId,
      InvitationId: rel.InvitationId,
      RelationshipStatus: rel.RelationshipStatus,
      InvitedAt: rel.InvitedAt,
    },
  };
};

const DisassociateFromAdministratorAccount: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  ctx.store.delete(adminRelationshipKey(detectorId));
  return {};
};

const DisassociateFromMasterAccount: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  ctx.store.delete(adminRelationshipKey(detectorId));
  return {};
};

const ArchiveFindings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const findingIds = asStringArray(input["FindingIds"]);
  for (const findingId of findingIds) {
    const key = findingKey(detectorId, findingId);
    const stored = ctx.store.get<StoredFinding>(key);
    if (stored !== undefined) {
      ctx.store.set(key, { ...stored, Archived: true });
    }
  }
  return {};
};

const CreateSampleFindings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const types = asStringArray(input["FindingTypes"]);
  const findingTypes =
    types.length > 0 ? types : ["Recon:EC2/PortProbeUnprotectedPort"];
  const now = new Date().toISOString();
  for (const type of findingTypes) {
    const id = crypto.randomUUID().replace(/-/g, "");
    const finding: StoredFinding = {
      FindingId: id,
      AccountId: ctx.account,
      Arn: `arn:aws:guardduty:${ctx.region}:${ctx.account}:detector/${detectorId}/finding/${id}`,
      DetectorId: detectorId,
      Region: ctx.region,
      Type: type,
      CreatedAt: now,
      UpdatedAt: now,
      Title: `Sample finding: ${type}`,
      Description: "This is a sample finding.",
      Severity: 5,
      Archived: false,
    };
    ctx.store.set(findingKey(detectorId, id), finding);
  }
  return {};
};

const GetFindings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const findingIds = asStringArray(input["FindingIds"]);
  const findings = findingIds.map((fid) => {
    const stored = ctx.store.get<StoredFinding>(findingKey(detectorId, fid));
    if (stored === undefined) {
      throw awsError(
        "BadRequestException",
        `The request is rejected because the input FindingId is not found: ${fid}`,
        400,
      );
    }
    return {
      AccountId: stored.AccountId,
      Arn: stored.Arn,
      CreatedAt: stored.CreatedAt,
      Description: stored.Description,
      Id: stored.FindingId,
      Region: stored.Region,
      Severity: stored.Severity,
      Title: stored.Title,
      Type: stored.Type,
      UpdatedAt: stored.UpdatedAt,
      Service: { Archived: stored.Archived, Count: 1 },
    };
  });
  return { Findings: findings };
};

const GetFindingsStatistics: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const prefix = `finding:${detectorId}:`;
  const findings = ctx.store
    .list<StoredFinding>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);
  const countBySeverity: Record<string, number> = {};
  for (const f of findings) {
    const key = String(f.Severity);
    countBySeverity[key] = (countBySeverity[key] ?? 0) + 1;
  }
  return { FindingStatistics: { CountBySeverity: countBySeverity } };
};

const ListFindings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const prefix = `finding:${detectorId}:`;
  let findings = ctx.store
    .list<StoredFinding>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value);

  const findingCriteria = asRecord(input["FindingCriteria"]);
  if (findingCriteria !== undefined) {
    const criterion = asRecord(findingCriteria["Criterion"]) ?? {};
    findings = findings.filter((f) => matchesFindingCriteria(f, criterion));
  }

  const sortCriteria = asRecord(input["SortCriteria"]);
  if (sortCriteria !== undefined) {
    const attr = stringOrUndefined(sortCriteria["AttributeName"]);
    const order = stringOrUndefined(sortCriteria["OrderBy"]) ?? "ASC";
    if (attr !== undefined) {
      findings = [...findings].sort((a, b) => {
        const va = getFindingFieldValue(a, attr);
        const vb = getFindingFieldValue(b, attr);
        let cmp = 0;
        if (typeof va === "number" && typeof vb === "number") {
          cmp = va - vb;
        } else {
          cmp = String(va ?? "").localeCompare(String(vb ?? ""));
        }
        return order === "DESC" ? -cmp : cmp;
      });
    }
  }

  const ids = findings.map((f) => f.FindingId);
  const pageSize = maxResults ?? ids.length;
  const page = ids.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < ids.length) {
    return { FindingIds: page, NextToken: encodePageToken(nextOffset) };
  }
  return { FindingIds: page };
};

const UnarchiveFindings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const findingIds = asStringArray(input["FindingIds"]);
  for (const findingId of findingIds) {
    const key = findingKey(detectorId, findingId);
    const stored = ctx.store.get<StoredFinding>(key);
    if (stored !== undefined) {
      ctx.store.set(key, { ...stored, Archived: false });
    }
  }
  return {};
};

const UpdateFindingsFeedback: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  return {};
};

const CreateFilter: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "Name");
  const now = new Date().toISOString();
  const filter: StoredFilter = {
    Name: name,
    Description: stringOrUndefined(input["Description"]) ?? "",
    Action: stringOrUndefined(input["Action"]) ?? "NOOP",
    Rank: typeof input["Rank"] === "number" ? (input["Rank"] as number) : 1,
    FindingCriteria: input["FindingCriteria"] ?? {},
    Tags: stringMapFrom(input["Tags"]),
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(filterKey(detectorId, name), filter);
  return { Name: name };
};

const GetFilter: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "FilterName");
  const stored = ctx.store.get<StoredFilter>(filterKey(detectorId, name));
  if (stored === undefined) {
    throw awsError("BadRequestException", `Filter ${name} not found.`, 400);
  }
  return {
    Name: stored.Name,
    Description: stored.Description,
    Action: stored.Action,
    Rank: stored.Rank,
    FindingCriteria: stored.FindingCriteria,
    Tags: stored.Tags,
  };
};

const ListFilters: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const prefix = `filter:${detectorId}:`;
  const all = ctx.store
    .list<StoredFilter>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value.Name)
    .sort();
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { FilterNames: page, NextToken: encodePageToken(nextOffset) };
  }
  return { FilterNames: page };
};

const UpdateFilter: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "FilterName");
  const key = filterKey(detectorId, name);
  const stored = ctx.store.get<StoredFilter>(key);
  if (stored === undefined) {
    throw awsError("BadRequestException", `Filter ${name} not found.`, 400);
  }
  const updated: StoredFilter = {
    ...stored,
    Description: stringOrUndefined(input["Description"]) ?? stored.Description,
    Action: stringOrUndefined(input["Action"]) ?? stored.Action,
    Rank:
      typeof input["Rank"] === "number"
        ? (input["Rank"] as number)
        : stored.Rank,
    FindingCriteria: input["FindingCriteria"] ?? stored.FindingCriteria,
    UpdatedAt: new Date().toISOString(),
  };
  ctx.store.set(key, updated);
  return { Name: name };
};

const DeleteFilter: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "FilterName");
  const key = filterKey(detectorId, name);
  if (ctx.store.get(key) === undefined) {
    throw awsError("BadRequestException", `Filter ${name} not found.`, 400);
  }
  ctx.store.delete(key);
  return {};
};

const CreateIPSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "Name");
  const format = requireString(input, "Format");
  const location = requireString(input, "Location");
  const activate = booleanFrom(input["Activate"]);
  const id = crypto.randomUUID().replace(/-/g, "");
  const ipSet: StoredIPSet = {
    IpSetId: id,
    Name: name,
    Format: format,
    Location: location,
    Status: activate ? "ACTIVE" : "INACTIVE",
    Tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(ipSetKey(detectorId, id), ipSet);
  return { IpSetId: id };
};

const GetIPSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const ipSetId = requireString(input, "IpSetId");
  const stored = ctx.store.get<StoredIPSet>(ipSetKey(detectorId, ipSetId));
  if (stored === undefined) {
    throw awsError("BadRequestException", `IPSet ${ipSetId} not found.`, 400);
  }
  return {
    Name: stored.Name,
    Format: stored.Format,
    Location: stored.Location,
    Status: stored.Status,
    Tags: stored.Tags,
  };
};

const ListIPSets: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const prefix = `ipset:${detectorId}:`;
  const all = ctx.store
    .list<StoredIPSet>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value.IpSetId);
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { IpSetIds: page, NextToken: encodePageToken(nextOffset) };
  }
  return { IpSetIds: page };
};

const UpdateIPSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const ipSetId = requireString(input, "IpSetId");
  const key = ipSetKey(detectorId, ipSetId);
  const stored = ctx.store.get<StoredIPSet>(key);
  if (stored === undefined) {
    throw awsError("BadRequestException", `IPSet ${ipSetId} not found.`, 400);
  }
  const updated: StoredIPSet = {
    ...stored,
    Name: stringOrUndefined(input["Name"]) ?? stored.Name,
    Location: stringOrUndefined(input["Location"]) ?? stored.Location,
    Status:
      input["Activate"] !== undefined
        ? booleanFrom(input["Activate"])
          ? "ACTIVE"
          : "INACTIVE"
        : stored.Status,
  };
  ctx.store.set(key, updated);
  return {};
};

const DeleteIPSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const ipSetId = requireString(input, "IpSetId");
  const key = ipSetKey(detectorId, ipSetId);
  if (ctx.store.get(key) === undefined) {
    throw awsError("BadRequestException", `IPSet ${ipSetId} not found.`, 400);
  }
  ctx.store.delete(key);
  return {};
};

const CreateThreatEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "Name");
  const format = requireString(input, "Format");
  const location = requireString(input, "Location");
  const activate = booleanFrom(input["Activate"]);
  const id = crypto.randomUUID().replace(/-/g, "");
  const set: StoredThreatEntitySet = {
    ThreatEntitySetId: id,
    Name: name,
    Format: format,
    Location: location,
    Status: activate ? "ACTIVE" : "INACTIVE",
    Tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(threatEntitySetKey(detectorId, id), set);
  return { ThreatEntitySetId: id };
};

const GetThreatEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "ThreatEntitySetId");
  const stored = ctx.store.get<StoredThreatEntitySet>(
    threatEntitySetKey(detectorId, id),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `ThreatEntitySet ${id} not found.`,
      400,
    );
  }
  return {
    Name: stored.Name,
    Format: stored.Format,
    Location: stored.Location,
    Status: stored.Status,
    Tags: stored.Tags,
  };
};

const ListThreatEntitySets: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const prefix = `threatentityset:${detectorId}:`;
  const all = ctx.store
    .list<StoredThreatEntitySet>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value.ThreatEntitySetId);
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { ThreatEntitySetIds: page, NextToken: encodePageToken(nextOffset) };
  }
  return { ThreatEntitySetIds: page };
};

const UpdateThreatEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "ThreatEntitySetId");
  const key = threatEntitySetKey(detectorId, id);
  const stored = ctx.store.get<StoredThreatEntitySet>(key);
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `ThreatEntitySet ${id} not found.`,
      400,
    );
  }
  const updated: StoredThreatEntitySet = {
    ...stored,
    Name: stringOrUndefined(input["Name"]) ?? stored.Name,
    Location: stringOrUndefined(input["Location"]) ?? stored.Location,
    Status:
      input["Activate"] !== undefined
        ? booleanFrom(input["Activate"])
          ? "ACTIVE"
          : "INACTIVE"
        : stored.Status,
  };
  ctx.store.set(key, updated);
  return {};
};

const DeleteThreatEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "ThreatEntitySetId");
  const key = threatEntitySetKey(detectorId, id);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "BadRequestException",
      `ThreatEntitySet ${id} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateThreatIntelSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "Name");
  const format = requireString(input, "Format");
  const location = requireString(input, "Location");
  const activate = booleanFrom(input["Activate"]);
  const id = crypto.randomUUID().replace(/-/g, "");
  const set: StoredThreatIntelSet = {
    ThreatIntelSetId: id,
    Name: name,
    Format: format,
    Location: location,
    Status: activate ? "ACTIVE" : "INACTIVE",
    Tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(threatIntelSetKey(detectorId, id), set);
  return { ThreatIntelSetId: id };
};

const GetThreatIntelSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "ThreatIntelSetId");
  const stored = ctx.store.get<StoredThreatIntelSet>(
    threatIntelSetKey(detectorId, id),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `ThreatIntelSet ${id} not found.`,
      400,
    );
  }
  return {
    Name: stored.Name,
    Format: stored.Format,
    Location: stored.Location,
    Status: stored.Status,
    Tags: stored.Tags,
  };
};

const ListThreatIntelSets: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const prefix = `threatintelset:${detectorId}:`;
  const all = ctx.store
    .list<StoredThreatIntelSet>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value.ThreatIntelSetId);
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { ThreatIntelSetIds: page, NextToken: encodePageToken(nextOffset) };
  }
  return { ThreatIntelSetIds: page };
};

const UpdateThreatIntelSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "ThreatIntelSetId");
  const key = threatIntelSetKey(detectorId, id);
  const stored = ctx.store.get<StoredThreatIntelSet>(key);
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `ThreatIntelSet ${id} not found.`,
      400,
    );
  }
  const updated: StoredThreatIntelSet = {
    ...stored,
    Name: stringOrUndefined(input["Name"]) ?? stored.Name,
    Location: stringOrUndefined(input["Location"]) ?? stored.Location,
    Status:
      input["Activate"] !== undefined
        ? booleanFrom(input["Activate"])
          ? "ACTIVE"
          : "INACTIVE"
        : stored.Status,
  };
  ctx.store.set(key, updated);
  return {};
};

const DeleteThreatIntelSet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "ThreatIntelSetId");
  const key = threatIntelSetKey(detectorId, id);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "BadRequestException",
      `ThreatIntelSet ${id} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateTrustedEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const name = requireString(input, "Name");
  const format = requireString(input, "Format");
  const location = requireString(input, "Location");
  const activate = booleanFrom(input["Activate"]);
  const id = crypto.randomUUID().replace(/-/g, "");
  const set: StoredTrustedEntitySet = {
    TrustedEntitySetId: id,
    Name: name,
    Format: format,
    Location: location,
    Status: activate ? "ACTIVE" : "INACTIVE",
    Tags: stringMapFrom(input["Tags"]),
  };
  ctx.store.set(trustedEntitySetKey(detectorId, id), set);
  return { TrustedEntitySetId: id };
};

const GetTrustedEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "TrustedEntitySetId");
  const stored = ctx.store.get<StoredTrustedEntitySet>(
    trustedEntitySetKey(detectorId, id),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `TrustedEntitySet ${id} not found.`,
      400,
    );
  }
  return {
    Name: stored.Name,
    Format: stored.Format,
    Location: stored.Location,
    Status: stored.Status,
    Tags: stored.Tags,
  };
};

const ListTrustedEntitySets: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const prefix = `trustedentityset:${detectorId}:`;
  const ids = ctx.store
    .list<StoredTrustedEntitySet>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => entry.value.TrustedEntitySetId);
  return { TrustedEntitySetIds: ids, NextToken: undefined };
};

const UpdateTrustedEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "TrustedEntitySetId");
  const key = trustedEntitySetKey(detectorId, id);
  const stored = ctx.store.get<StoredTrustedEntitySet>(key);
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `TrustedEntitySet ${id} not found.`,
      400,
    );
  }
  const updated: StoredTrustedEntitySet = {
    ...stored,
    Name: stringOrUndefined(input["Name"]) ?? stored.Name,
    Location: stringOrUndefined(input["Location"]) ?? stored.Location,
    Status:
      input["Activate"] !== undefined
        ? booleanFrom(input["Activate"])
          ? "ACTIVE"
          : "INACTIVE"
        : stored.Status,
  };
  ctx.store.set(key, updated);
  return {};
};

const DeleteTrustedEntitySet: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const id = requireString(input, "TrustedEntitySetId");
  const key = trustedEntitySetKey(detectorId, id);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "BadRequestException",
      `TrustedEntitySet ${id} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accounts = Array.isArray(input["AccountDetails"])
    ? (input["AccountDetails"] as Record<string, unknown>[])
    : [];
  const now = new Date().toISOString();
  const unprocessed: Record<string, unknown>[] = [];
  for (const acct of accounts) {
    const accountId = stringOrUndefined(acct["AccountId"]);
    if (accountId === undefined) continue;
    const email = stringOrUndefined(acct["Email"]) ?? "";
    const member: StoredMember = {
      AccountId: accountId,
      DetectorId: detectorId,
      Email: email,
      MasterId: ctx.account,
      RelationshipStatus: "Enabled",
      InvitedAt: now,
      UpdatedAt: now,
    };
    ctx.store.set(memberKey(detectorId, accountId), member);
  }
  return { UnprocessedAccounts: unprocessed };
};

const GetMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const members: Record<string, unknown>[] = [];
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const stored = ctx.store.get<StoredMember>(
      memberKey(detectorId, accountId),
    );
    if (stored === undefined) {
      unprocessed.push({
        AccountId: accountId,
        Result: "Member not found.",
      });
    } else {
      members.push({
        AccountId: stored.AccountId,
        DetectorId: stored.DetectorId,
        Email: stored.Email,
        MasterId: stored.MasterId,
        RelationshipStatus: stored.RelationshipStatus,
        InvitedAt: stored.InvitedAt,
        UpdatedAt: stored.UpdatedAt,
      });
    }
  }
  return { Members: members, UnprocessedAccounts: unprocessed };
};

const ListMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const prefix = `member:${detectorId}:`;
  const members = ctx.store
    .list<StoredMember>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      AccountId: entry.value.AccountId,
      DetectorId: entry.value.DetectorId,
      Email: entry.value.Email,
      MasterId: entry.value.MasterId,
      RelationshipStatus: entry.value.RelationshipStatus,
      InvitedAt: entry.value.InvitedAt,
      UpdatedAt: entry.value.UpdatedAt,
    }));
  return { Members: members, NextToken: undefined };
};

const DeleteMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = memberKey(detectorId, accountId);
    if (ctx.store.get(key) === undefined) {
      unprocessed.push({
        AccountId: accountId,
        Result: "Member not found.",
      });
    } else {
      ctx.store.delete(key);
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const DisassociateMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = memberKey(detectorId, accountId);
    const stored = ctx.store.get<StoredMember>(key);
    if (stored === undefined) {
      unprocessed.push({ AccountId: accountId, Result: "Member not found." });
    } else {
      ctx.store.set(key, {
        ...stored,
        RelationshipStatus: "Removed",
        UpdatedAt: new Date().toISOString(),
      });
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const InviteMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = memberKey(detectorId, accountId);
    const stored = ctx.store.get<StoredMember>(key);
    if (stored === undefined) {
      unprocessed.push({ AccountId: accountId, Result: "Member not found." });
    } else {
      ctx.store.set(key, {
        ...stored,
        RelationshipStatus: "Invited",
        InvitedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      });
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const StartMonitoringMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = memberKey(detectorId, accountId);
    const stored = ctx.store.get<StoredMember>(key);
    if (stored === undefined) {
      unprocessed.push({ AccountId: accountId, Result: "Member not found." });
    } else {
      ctx.store.set(key, {
        ...stored,
        RelationshipStatus: "Enabled",
        UpdatedAt: new Date().toISOString(),
      });
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const StopMonitoringMembers: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = memberKey(detectorId, accountId);
    const stored = ctx.store.get<StoredMember>(key);
    if (stored === undefined) {
      unprocessed.push({ AccountId: accountId, Result: "Member not found." });
    } else {
      ctx.store.set(key, {
        ...stored,
        RelationshipStatus: "Paused",
        UpdatedAt: new Date().toISOString(),
      });
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const GetMemberDetectors: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const accountIds = asStringArray(input["AccountIds"]);
  const memberDetectors = accountIds.map((accountId) => ({
    AccountId: accountId,
    DetectorId: detectorId,
    Features: [],
    UnprocessedAccounts: [],
  }));
  return {
    MemberDataSourceConfigurations: memberDetectors,
    UnprocessedAccounts: [],
  };
};

const UpdateMemberDetectors: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  return { UnprocessedAccounts: [] };
};

const CreatePublishingDestination: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const destinationType = requireString(input, "DestinationType");
  const destinationProperties = asRecord(input["DestinationProperties"]) ?? {};
  const id = crypto.randomUUID().replace(/-/g, "");
  const dest: StoredPublishingDestination = {
    DestinationId: id,
    DestinationType: destinationType,
    Status: "ACTIVE",
    PublishingFailureStartTimestamp: 0,
    DestinationProperties: destinationProperties,
  };
  ctx.store.set(publishingDestKey(detectorId, id), dest);
  return { DestinationId: id };
};

const DescribePublishingDestination: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const destinationId = requireString(input, "DestinationId");
  const stored = ctx.store.get<StoredPublishingDestination>(
    publishingDestKey(detectorId, destinationId),
  );
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Publishing destination ${destinationId} not found.`,
      400,
    );
  }
  return {
    DestinationId: stored.DestinationId,
    DestinationType: stored.DestinationType,
    Status: stored.Status,
    PublishingFailureStartTimestamp: stored.PublishingFailureStartTimestamp,
    DestinationProperties: stored.DestinationProperties,
  };
};

const ListPublishingDestinations: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const prefix = `publishingdestination:${detectorId}:`;
  const destinations = ctx.store
    .list<StoredPublishingDestination>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      DestinationId: entry.value.DestinationId,
      DestinationType: entry.value.DestinationType,
      Status: entry.value.Status,
    }));
  return { Destinations: destinations, NextToken: undefined };
};

const UpdatePublishingDestination: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const destinationId = requireString(input, "DestinationId");
  const key = publishingDestKey(detectorId, destinationId);
  const stored = ctx.store.get<StoredPublishingDestination>(key);
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Publishing destination ${destinationId} not found.`,
      400,
    );
  }
  const destinationProperties =
    asRecord(input["DestinationProperties"]) ?? stored.DestinationProperties;
  ctx.store.set(key, {
    ...stored,
    DestinationProperties: destinationProperties,
  });
  return {};
};

const DeletePublishingDestination: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const destinationId = requireString(input, "DestinationId");
  const key = publishingDestKey(detectorId, destinationId);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "BadRequestException",
      `Publishing destination ${destinationId} not found.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const CreateMalwareProtectionPlan: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID().replace(/-/g, "");
  const arn = `arn:aws:guardduty:${ctx.region}:${ctx.account}:malware-protection-plan/${id}`;
  const plan: StoredMalwareProtectionPlan = {
    MalwareProtectionPlanId: id,
    Arn: arn,
    Role: stringOrUndefined(input["Role"]) ?? "",
    CreatedAt: nowSeconds(),
    Status: "ACTIVE",
    ProtectedResource: input["ProtectedResource"] ?? {},
    Actions: input["Actions"] ?? {},
  };
  ctx.store.set(malwareProtectionPlanKey(id), plan);
  return { MalwareProtectionPlanId: id };
};

const GetMalwareProtectionPlan: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MalwareProtectionPlanId");
  const stored = ctx.store.get<StoredMalwareProtectionPlan>(
    malwareProtectionPlanKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Malware protection plan ${id} not found.`,
      404,
    );
  }
  return {
    Arn: stored.Arn,
    Role: stored.Role,
    ProtectedResource: stored.ProtectedResource,
    Actions: stored.Actions,
    CreatedAt: stored.CreatedAt,
    Status: stored.Status,
    StatusReasons: [],
    Tags: ctx.store.get<Record<string, string>>(tagsKey(stored.Arn)) ?? {},
  };
};

const ListMalwareProtectionPlans: OperationHandler = (_input, ctx) => {
  const plans = ctx.store
    .list<StoredMalwareProtectionPlan>()
    .filter((entry) => entry.key.startsWith("malwareprotectionplan:"))
    .map((entry) => ({
      MalwareProtectionPlanId: entry.value.MalwareProtectionPlanId,
      Arn: entry.value.Arn,
    }));
  return { MalwareProtectionPlans: plans, NextToken: undefined };
};

const UpdateMalwareProtectionPlan: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MalwareProtectionPlanId");
  const key = malwareProtectionPlanKey(id);
  const stored = ctx.store.get<StoredMalwareProtectionPlan>(key);
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Malware protection plan ${id} not found.`,
      404,
    );
  }
  ctx.store.set(key, {
    ...stored,
    Role: stringOrUndefined(input["Role"]) ?? stored.Role,
    Actions: input["Actions"] ?? stored.Actions,
    ProtectedResource: input["ProtectedResource"] ?? stored.ProtectedResource,
  });
  return {};
};

const DeleteMalwareProtectionPlan: OperationHandler = (input, ctx) => {
  const id = requireString(input, "MalwareProtectionPlanId");
  const key = malwareProtectionPlanKey(id);
  if (ctx.store.get(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Malware protection plan ${id} not found.`,
      404,
    );
  }
  ctx.store.delete(key);
  return {};
};

const DescribeMalwareScans: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const prefix = `malwarescan:`;
  const scans = ctx.store
    .list<StoredMalwareScan>()
    .filter(
      (entry) =>
        entry.key.startsWith(prefix) && entry.value.DetectorId === detectorId,
    )
    .map((entry) => ({
      AccountId: entry.value.AccountId,
      AdminDetectorId: entry.value.AdminDetectorId,
      DetectorId: entry.value.DetectorId,
      ScanId: entry.value.ScanId,
      ScanStatus: entry.value.ScanStatus,
      ScanStartTime: entry.value.ScanStartTime,
      ScanEndTime: entry.value.ScanEndTime,
    }));
  return { Scans: scans, NextToken: undefined };
};

const GetMalwareScan: OperationHandler = (input, ctx) => {
  const scanId = requireString(input, "ScanId");
  const stored = ctx.store.get<StoredMalwareScan>(malwareScanKey(scanId));
  if (stored === undefined) {
    throw awsError(
      "BadRequestException",
      `Malware scan ${scanId} not found.`,
      400,
    );
  }
  return {
    AccountId: stored.AccountId,
    AdminDetectorId: stored.AdminDetectorId,
    DetectorId: stored.DetectorId,
    ScanId: stored.ScanId,
    ScanStatus: stored.ScanStatus,
    ScanStartTime: stored.ScanStartTime,
    ScanEndTime: stored.ScanEndTime,
  };
};

const GetMalwareScanSettings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const stored = ctx.store.get<StoredMalwareScanSettings>(
    malwareScanSettingsKey(detectorId),
  );
  return {
    ScanResourceCriteria: stored?.ScanResourceCriteria ?? {},
    EbsSnapshotPreservation: stored?.EbsSnapshotPreservation ?? "NO_RETENTION",
  };
};

const UpdateMalwareScanSettings: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const existing = ctx.store.get<StoredMalwareScanSettings>(
    malwareScanSettingsKey(detectorId),
  );
  const settings: StoredMalwareScanSettings = {
    ScanResourceCriteria:
      input["ScanResourceCriteria"] ?? existing?.ScanResourceCriteria ?? {},
    EbsSnapshotPreservation:
      stringOrUndefined(input["EbsSnapshotPreservation"]) ??
      existing?.EbsSnapshotPreservation ??
      "NO_RETENTION",
  };
  ctx.store.set(malwareScanSettingsKey(detectorId), settings);
  return {};
};

const ListMalwareScans: OperationHandler = (_input, ctx) => {
  const scans = ctx.store
    .list<StoredMalwareScan>()
    .filter((entry) => entry.key.startsWith("malwarescan:"))
    .map((entry) => ({
      AccountId: entry.value.AccountId,
      AdminDetectorId: entry.value.AdminDetectorId,
      DetectorId: entry.value.DetectorId,
      ScanId: entry.value.ScanId,
      ScanStatus: entry.value.ScanStatus,
      ScanStartTime: entry.value.ScanStartTime,
      ScanEndTime: entry.value.ScanEndTime,
    }));
  return { Scans: scans, NextToken: undefined };
};

const StartMalwareScan: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const scanId = crypto.randomUUID().replace(/-/g, "");
  const now = nowSeconds();
  const scan: StoredMalwareScan = {
    ScanId: scanId,
    DetectorId: "",
    AccountId: ctx.account,
    ScanStatus: "RUNNING",
    ScanStartTime: now,
    ScanEndTime: 0,
    AdminDetectorId: "",
  };
  ctx.store.set(malwareScanKey(scanId), scan);
  return { ScanId: scanId, ResourceArn: resourceArn };
};

const SendObjectMalwareScan: OperationHandler = (input, ctx) => {
  const scanId = crypto.randomUUID().replace(/-/g, "");
  const now = nowSeconds();
  const scan: StoredMalwareScan = {
    ScanId: scanId,
    DetectorId: "",
    AccountId: ctx.account,
    ScanStatus: "RUNNING",
    ScanStartTime: now,
    ScanEndTime: 0,
    AdminDetectorId: "",
  };
  ctx.store.set(malwareScanKey(scanId), scan);
  return { ScanId: scanId };
};

const DeclineInvitations: OperationHandler = (input, ctx) => {
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = invitationKey(accountId);
    if (ctx.store.get(key) === undefined) {
      unprocessed.push({
        AccountId: accountId,
        Result: "Invitation not found.",
      });
    } else {
      ctx.store.delete(key);
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const DeleteInvitations: OperationHandler = (input, ctx) => {
  const accountIds = asStringArray(input["AccountIds"]);
  const unprocessed: Record<string, unknown>[] = [];
  for (const accountId of accountIds) {
    const key = invitationKey(accountId);
    if (ctx.store.get(key) === undefined) {
      unprocessed.push({
        AccountId: accountId,
        Result: "Invitation not found.",
      });
    } else {
      ctx.store.delete(key);
    }
  }
  return { UnprocessedAccounts: unprocessed };
};

const GetInvitationsCount: OperationHandler = (_input, ctx) => {
  const count = ctx.store
    .list()
    .filter((entry) => entry.key.startsWith("invitation:")).length;
  return { InvitationsCount: count };
};

const ListInvitations: OperationHandler = (_input, ctx) => {
  const invitations = ctx.store
    .list<StoredInvitation>()
    .filter((entry) => entry.key.startsWith("invitation:"))
    .map((entry) => ({
      AccountId: entry.value.AccountId,
      InvitationId: entry.value.InvitationId,
      RelationshipStatus: entry.value.RelationshipStatus,
      InvitedAt: entry.value.InvitedAt,
    }));
  return { Invitations: invitations, NextToken: undefined };
};

const DisableOrganizationAdminAccount: OperationHandler = (input, ctx) => {
  const adminAccountId = requireString(input, "AdminAccountId");
  const key = orgAdminKey(adminAccountId);
  if (ctx.store.get(key) !== undefined) {
    ctx.store.delete(key);
  }
  return {};
};

const EnableOrganizationAdminAccount: OperationHandler = (input, ctx) => {
  const adminAccountId = requireString(input, "AdminAccountId");
  const admin: StoredOrgAdmin = { AccountId: adminAccountId };
  ctx.store.set(orgAdminKey(adminAccountId), admin);
  return {};
};

const ListOrganizationAdminAccounts: OperationHandler = (_input, ctx) => {
  const admins = ctx.store
    .list<StoredOrgAdmin>()
    .filter((entry) => entry.key.startsWith("orgadmin:"))
    .map((entry) => ({
      AccountId: entry.value.AccountId,
      Status: "ENABLED",
    }));
  return { AdminAccounts: admins, NextToken: undefined };
};

const DescribeOrganizationConfiguration: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const stored = ctx.store.get<StoredOrgConfig>(orgConfigKey(detectorId));
  return {
    AutoEnable: stored?.AutoEnableOrganizationMembers === "ALL",
    AutoEnableOrganizationMembers:
      stored?.AutoEnableOrganizationMembers ?? "NONE",
    MemberAccountLimitReached: false,
    DataSources: undefined,
    Features: [],
    NextToken: undefined,
  };
};

const UpdateOrganizationConfiguration: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const autoEnable =
    stringOrUndefined(input["AutoEnableOrganizationMembers"]) ?? "NONE";
  ctx.store.set(orgConfigKey(detectorId), {
    AutoEnableOrganizationMembers: autoEnable,
  } as StoredOrgConfig);
  return {};
};

const GetOrganizationStatistics: OperationHandler = (_input, ctx) => {
  const memberCount = ctx.store
    .list<StoredMember>()
    .filter((entry) => entry.key.startsWith("member:")).length;
  return {
    OrganizationDetails: {
      UpdatedAt: new Date().toISOString(),
      OrganizationStatistics: {
        TotalAccountsCount: memberCount + 1,
        MemberAccountsCount: memberCount,
        ActiveAccountsCount: memberCount + 1,
        EnabledAccountsCount: memberCount + 1,
        CountByFeature: [],
      },
    },
  };
};

const GetCoverageStatistics: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const prefix = `coverage:${detectorId}:`;
  const entries = ctx.store
    .list<{ CoverageStatus: string; ResourceType: string }>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  const countByCoverageStatus: Record<string, number> = {};
  const countByResourceType: Record<string, number> = {};
  for (const e of entries) {
    countByCoverageStatus[e.CoverageStatus] =
      (countByCoverageStatus[e.CoverageStatus] ?? 0) + 1;
    countByResourceType[e.ResourceType] =
      (countByResourceType[e.ResourceType] ?? 0) + 1;
  }
  return {
    CoverageStatistics: {
      CountByCoverageStatus: countByCoverageStatus,
      CountByResourceType: countByResourceType,
    },
  };
};

const ListCoverage: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  const rawMax = input["MaxResults"];
  const maxResults =
    typeof rawMax === "number" && rawMax > 0 ? rawMax : undefined;
  const offset = decodePageToken(input["NextToken"]);
  const prefix = `coverage:${detectorId}:`;
  const all = ctx.store
    .list<Record<string, unknown>>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  const pageSize = maxResults ?? all.length;
  const page = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize;
  if (nextOffset < all.length) {
    return { Resources: page, NextToken: encodePageToken(nextOffset) };
  }
  return { Resources: page };
};

const GetRemainingFreeTrialDays: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  return {
    Accounts: [
      {
        AccountId: ctx.account,
        DataSources: {
          CloudTrail: { FreeTrialDaysRemaining: 30 },
          DnsLogs: { FreeTrialDaysRemaining: 30 },
          FlowLogs: { FreeTrialDaysRemaining: 30 },
          S3Logs: { FreeTrialDaysRemaining: 30 },
        },
      },
    ],
    UnprocessedAccounts: [],
  };
};

const GetUsageStatistics: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "DetectorId");
  requireDetector(ctx, detectorId);
  return {
    UsageStatistics: {
      SumByAccount: [],
      SumByDataSource: [],
      SumByResource: [],
      TopResources: [],
    },
    NextToken: undefined,
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { Tags: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tags = stringMapFrom(input["Tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const tagKeys = asStringArray(input["TagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  const updated: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!tagKeys.includes(k)) updated[k] = v;
  }
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const guardduty = {
  name: "guardduty",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "tags") {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }

    if (parts[0] === "admin") {
      if (parts.length === 1 && req.method === "GET")
        return "ListOrganizationAdminAccounts";
      if (parts[1] === "disable" && req.method === "POST")
        return "DisableOrganizationAdminAccount";
      if (parts[1] === "enable" && req.method === "POST")
        return "EnableOrganizationAdminAccount";
      return undefined;
    }

    if (parts[0] === "invitation") {
      if (parts.length === 1 && req.method === "GET") return "ListInvitations";
      if (parts[1] === "count" && req.method === "GET")
        return "GetInvitationsCount";
      if (parts[1] === "decline" && req.method === "POST")
        return "DeclineInvitations";
      if (parts[1] === "delete" && req.method === "POST")
        return "DeleteInvitations";
      return undefined;
    }

    if (parts[0] === "malware-protection-plan") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListMalwareProtectionPlans";
        if (req.method === "POST") return "CreateMalwareProtectionPlan";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetMalwareProtectionPlan";
        if (req.method === "DELETE") return "DeleteMalwareProtectionPlan";
        if (req.method === "PATCH") return "UpdateMalwareProtectionPlan";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "malware-scan") {
      if (parts.length === 1 && req.method === "POST")
        return "ListMalwareScans";
      if (parts[1] === "start" && req.method === "POST")
        return "StartMalwareScan";
      if (parts.length === 2 && req.method === "GET") return "GetMalwareScan";
      return undefined;
    }

    if (
      parts[0] === "object-malware-scan" &&
      parts[1] === "send" &&
      req.method === "POST"
    ) {
      return "SendObjectMalwareScan";
    }

    if (
      parts[0] === "organization" &&
      parts[1] === "statistics" &&
      req.method === "GET"
    ) {
      return "GetOrganizationStatistics";
    }

    if (parts[0] !== "detector") return undefined;

    if (parts.length === 1) {
      if (req.method === "POST") return "CreateDetector";
      if (req.method === "GET") return "ListDetectors";
      return undefined;
    }

    if (parts.length === 2) {
      if (req.method === "GET") return "GetDetector";
      if (req.method === "POST") return "UpdateDetector";
      if (req.method === "DELETE") return "DeleteDetector";
      return undefined;
    }

    const resource = parts[2];

    if (resource === "administrator") {
      if (parts.length === 3) {
        if (req.method === "GET") return "GetAdministratorAccount";
        if (req.method === "POST") return "AcceptAdministratorInvitation";
      }
      if (
        parts.length === 4 &&
        parts[3] === "disassociate" &&
        req.method === "POST"
      ) {
        return "DisassociateFromAdministratorAccount";
      }
      return undefined;
    }

    if (resource === "master") {
      if (parts.length === 3) {
        if (req.method === "GET") return "GetMasterAccount";
        if (req.method === "POST") return "AcceptInvitation";
      }
      if (
        parts.length === 4 &&
        parts[3] === "disassociate" &&
        req.method === "POST"
      ) {
        return "DisassociateFromMasterAccount";
      }
      return undefined;
    }

    if (resource === "findings") {
      if (parts.length === 3 && req.method === "POST") return "ListFindings";
      if (parts.length === 4) {
        if (parts[3] === "archive" && req.method === "POST")
          return "ArchiveFindings";
        if (parts[3] === "create" && req.method === "POST")
          return "CreateSampleFindings";
        if (parts[3] === "feedback" && req.method === "POST")
          return "UpdateFindingsFeedback";
        if (parts[3] === "get" && req.method === "POST") return "GetFindings";
        if (parts[3] === "statistics" && req.method === "POST")
          return "GetFindingsStatistics";
        if (parts[3] === "unarchive" && req.method === "POST")
          return "UnarchiveFindings";
      }
      return undefined;
    }

    if (resource === "filter") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListFilters";
        if (req.method === "POST") return "CreateFilter";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetFilter";
        if (req.method === "POST") return "UpdateFilter";
        if (req.method === "DELETE") return "DeleteFilter";
      }
      return undefined;
    }

    if (resource === "ipset") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListIPSets";
        if (req.method === "POST") return "CreateIPSet";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetIPSet";
        if (req.method === "POST") return "UpdateIPSet";
        if (req.method === "DELETE") return "DeleteIPSet";
      }
      return undefined;
    }

    if (resource === "member") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListMembers";
        if (req.method === "POST") return "CreateMembers";
      }
      if (parts.length === 4) {
        if (parts[3] === "delete" && req.method === "POST")
          return "DeleteMembers";
        if (parts[3] === "disassociate" && req.method === "POST")
          return "DisassociateMembers";
        if (parts[3] === "get" && req.method === "POST") return "GetMembers";
        if (parts[3] === "invite" && req.method === "POST")
          return "InviteMembers";
        if (parts[3] === "start" && req.method === "POST")
          return "StartMonitoringMembers";
        if (parts[3] === "stop" && req.method === "POST")
          return "StopMonitoringMembers";
      }
      if (parts.length === 5 && parts[3] === "detector") {
        if (parts[4] === "get" && req.method === "POST")
          return "GetMemberDetectors";
        if (parts[4] === "update" && req.method === "POST")
          return "UpdateMemberDetectors";
      }
      return undefined;
    }

    if (resource === "publishingDestination") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListPublishingDestinations";
        if (req.method === "POST") return "CreatePublishingDestination";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "DescribePublishingDestination";
        if (req.method === "POST") return "UpdatePublishingDestination";
        if (req.method === "DELETE") return "DeletePublishingDestination";
      }
      return undefined;
    }

    if (resource === "threatentityset") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListThreatEntitySets";
        if (req.method === "POST") return "CreateThreatEntitySet";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetThreatEntitySet";
        if (req.method === "POST") return "UpdateThreatEntitySet";
        if (req.method === "DELETE") return "DeleteThreatEntitySet";
      }
      return undefined;
    }

    if (resource === "threatintelset") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListThreatIntelSets";
        if (req.method === "POST") return "CreateThreatIntelSet";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetThreatIntelSet";
        if (req.method === "POST") return "UpdateThreatIntelSet";
        if (req.method === "DELETE") return "DeleteThreatIntelSet";
      }
      return undefined;
    }

    if (resource === "trustedentityset") {
      if (parts.length === 3) {
        if (req.method === "GET") return "ListTrustedEntitySets";
        if (req.method === "POST") return "CreateTrustedEntitySet";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetTrustedEntitySet";
        if (req.method === "POST") return "UpdateTrustedEntitySet";
        if (req.method === "DELETE") return "DeleteTrustedEntitySet";
      }
      return undefined;
    }

    if (resource === "admin") {
      if (parts.length === 3) {
        if (req.method === "GET") return "DescribeOrganizationConfiguration";
        if (req.method === "POST") return "UpdateOrganizationConfiguration";
      }
      return undefined;
    }

    if (
      resource === "malware-scans" &&
      parts.length === 3 &&
      req.method === "POST"
    ) {
      return "DescribeMalwareScans";
    }

    if (resource === "malware-scan-settings" && parts.length === 3) {
      if (req.method === "GET") return "GetMalwareScanSettings";
      if (req.method === "POST") return "UpdateMalwareScanSettings";
      return undefined;
    }

    if (resource === "coverage") {
      if (parts.length === 3 && req.method === "POST") return "ListCoverage";
      if (
        parts.length === 4 &&
        parts[3] === "statistics" &&
        req.method === "POST"
      )
        return "GetCoverageStatistics";
      return undefined;
    }

    if (
      resource === "freeTrial" &&
      parts.length === 4 &&
      parts[3] === "daysRemaining" &&
      req.method === "POST"
    ) {
      return "GetRemainingFreeTrialDays";
    }

    if (
      resource === "usage" &&
      parts.length === 4 &&
      parts[3] === "statistics" &&
      req.method === "POST"
    ) {
      return "GetUsageStatistics";
    }

    return undefined;
  },
  operations: {
    CreateDetector,
    GetDetector,
    ListDetectors,
    UpdateDetector,
    DeleteDetector,
    AcceptAdministratorInvitation,
    AcceptInvitation,
    GetAdministratorAccount,
    GetMasterAccount,
    DisassociateFromAdministratorAccount,
    DisassociateFromMasterAccount,
    ArchiveFindings,
    CreateSampleFindings,
    GetFindings,
    GetFindingsStatistics,
    ListFindings,
    UnarchiveFindings,
    UpdateFindingsFeedback,
    CreateFilter,
    GetFilter,
    ListFilters,
    UpdateFilter,
    DeleteFilter,
    CreateIPSet,
    GetIPSet,
    ListIPSets,
    UpdateIPSet,
    DeleteIPSet,
    CreateThreatEntitySet,
    GetThreatEntitySet,
    ListThreatEntitySets,
    UpdateThreatEntitySet,
    DeleteThreatEntitySet,
    CreateThreatIntelSet,
    GetThreatIntelSet,
    ListThreatIntelSets,
    UpdateThreatIntelSet,
    DeleteThreatIntelSet,
    CreateTrustedEntitySet,
    GetTrustedEntitySet,
    ListTrustedEntitySets,
    UpdateTrustedEntitySet,
    DeleteTrustedEntitySet,
    CreateMembers,
    GetMembers,
    ListMembers,
    DeleteMembers,
    DisassociateMembers,
    InviteMembers,
    StartMonitoringMembers,
    StopMonitoringMembers,
    GetMemberDetectors,
    UpdateMemberDetectors,
    CreatePublishingDestination,
    DescribePublishingDestination,
    ListPublishingDestinations,
    UpdatePublishingDestination,
    DeletePublishingDestination,
    CreateMalwareProtectionPlan,
    GetMalwareProtectionPlan,
    ListMalwareProtectionPlans,
    UpdateMalwareProtectionPlan,
    DeleteMalwareProtectionPlan,
    DescribeMalwareScans,
    GetMalwareScan,
    GetMalwareScanSettings,
    UpdateMalwareScanSettings,
    ListMalwareScans,
    StartMalwareScan,
    SendObjectMalwareScan,
    DeclineInvitations,
    DeleteInvitations,
    GetInvitationsCount,
    ListInvitations,
    DisableOrganizationAdminAccount,
    EnableOrganizationAdminAccount,
    ListOrganizationAdminAccounts,
    DescribeOrganizationConfiguration,
    UpdateOrganizationConfiguration,
    GetOrganizationStatistics,
    GetCoverageStatistics,
    ListCoverage,
    GetRemainingFreeTrialDays,
    GetUsageStatistics,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default guardduty;
