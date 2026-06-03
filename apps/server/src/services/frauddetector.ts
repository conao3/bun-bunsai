import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import frauddetectorModel from "../../../../test/vendor/aws-models/frauddetector.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(frauddetectorModel);

type StoredDetector = {
  detectorId: string;
  description: string | undefined;
  eventTypeName: string;
  createdTime: string;
  lastUpdatedTime: string;
  arn: string;
};

const detectorKey = (id: string): string => `detector/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const detectorArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:frauddetector:${ctx.region}:${ctx.account}:detector/${id}`;

const PutDetector: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  const eventTypeName = requireString(input, "eventTypeName");
  const now = new Date().toISOString();
  const detector: StoredDetector = {
    detectorId,
    description: stringOrUndefined(input["description"]),
    eventTypeName,
    createdTime: now,
    lastUpdatedTime: now,
    arn: detectorArn(ctx, detectorId),
  };
  ctx.store.set(detectorKey(detectorId), detector);
  return {};
};

const GetDetectors: OperationHandler = (input, ctx) => {
  const detectorId = stringOrUndefined(input["detectorId"]);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const detectors = ctx.store
    .list<StoredDetector>()
    .filter((entry) => entry.key.startsWith("detector/"))
    .map((entry) => entry.value)
    .filter(
      (detector) =>
        detectorId === undefined || detector.detectorId === detectorId,
    )
    .sort((a, b) =>
      a.detectorId < b.detectorId ? -1 : a.detectorId > b.detectorId ? 1 : 0,
    )
    .slice(0, max);
  return { detectors };
};

const DeleteDetector: OperationHandler = (input, ctx) => {
  const detectorId = requireString(input, "detectorId");
  if (ctx.store.get<StoredDetector>(detectorKey(detectorId)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Detector not found: ${detectorId}`,
      404,
    );
  }
  ctx.store.delete(detectorKey(detectorId));
  return {};
};

const frauddetector = {
  name: "frauddetector",
  protocol: "json",
  operations: {
    PutDetector,
    GetDetectors,
    DeleteDetector,
  },
  model,
} as const satisfies ServiceDefinition;

export default frauddetector;
