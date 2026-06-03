import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import guarddutyModel from "../../../../test/vendor/aws-models/guardduty.json" with { type: "json" };
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

const detectorKey = (id: string): string => `detector/${id}`;

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

const ListDetectors: OperationHandler = (_input, ctx) => {
  const ids = ctx.store
    .list<StoredDetector>()
    .filter((entry) => entry.key.startsWith("detector/"))
    .map((entry) => entry.value.DetectorId)
    .sort((a, b) => a.localeCompare(b));
  return { DetectorIds: ids };
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

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const guardduty = {
  name: "guardduty",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
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
    return undefined;
  },
  operations: {
    CreateDetector,
    GetDetector,
    ListDetectors,
    UpdateDetector,
    DeleteDetector,
  },
  model,
} as const satisfies ServiceDefinition;

export default guardduty;
