import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import groundstationModel from "../../../../test/vendor/aws-models/groundstation.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(groundstationModel);

const missionProfilePrefix = "missionProfile:" as const;

type StoredMissionProfile = {
  missionProfileId: string;
  missionProfileArn: string;
  region: string;
  name: string;
  contactPrePassDurationSeconds: number | undefined;
  contactPostPassDurationSeconds: number | undefined;
  minimumViableContactDurationSeconds: number;
  dataflowEdges: unknown[];
  trackingConfigArn: string;
  telemetrySinkConfigArn: string | undefined;
  tags: Record<string, unknown>;
  streamsKmsKey: unknown;
  streamsKmsRole: string | undefined;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const requireNumber = (
  input: Record<string, unknown>,
  field: string,
): number => {
  const value = numberOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const missionProfileKey = (id: string): string =>
  `${missionProfilePrefix}${id}`;

const profileArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:groundstation:${ctx.region}:${ctx.account}:mission-profile/${id}`;

const requireProfile = (
  ctx: ServiceContext,
  id: string,
): StoredMissionProfile => {
  const profile = ctx.store.get<StoredMissionProfile>(missionProfileKey(id));
  if (profile === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Mission profile ${id} not found.`,
      404,
    );
  }
  return profile;
};

const profileView = (
  profile: StoredMissionProfile,
): Record<string, unknown> => ({
  missionProfileId: profile.missionProfileId,
  missionProfileArn: profile.missionProfileArn,
  region: profile.region,
  name: profile.name,
  contactPrePassDurationSeconds: profile.contactPrePassDurationSeconds,
  contactPostPassDurationSeconds: profile.contactPostPassDurationSeconds,
  minimumViableContactDurationSeconds:
    profile.minimumViableContactDurationSeconds,
  dataflowEdges: profile.dataflowEdges,
  trackingConfigArn: profile.trackingConfigArn,
  telemetrySinkConfigArn: profile.telemetrySinkConfigArn,
  tags: profile.tags,
  streamsKmsKey: profile.streamsKmsKey,
  streamsKmsRole: profile.streamsKmsRole,
});

const listItemView = (
  profile: StoredMissionProfile,
): Record<string, unknown> => ({
  missionProfileId: profile.missionProfileId,
  missionProfileArn: profile.missionProfileArn,
  region: profile.region,
  name: profile.name,
});

const CreateMissionProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const minimumViableContactDurationSeconds = requireNumber(
    input,
    "minimumViableContactDurationSeconds",
  );
  const dataflowEdges = arrayOrEmpty(input["dataflowEdges"]);
  const trackingConfigArn = requireString(input, "trackingConfigArn");
  const id = crypto.randomUUID();
  const profile: StoredMissionProfile = {
    missionProfileId: id,
    missionProfileArn: profileArn(ctx, id),
    region: ctx.region,
    name,
    contactPrePassDurationSeconds: numberOrUndefined(
      input["contactPrePassDurationSeconds"],
    ),
    contactPostPassDurationSeconds: numberOrUndefined(
      input["contactPostPassDurationSeconds"],
    ),
    minimumViableContactDurationSeconds,
    dataflowEdges,
    trackingConfigArn,
    telemetrySinkConfigArn: stringOrUndefined(input["telemetrySinkConfigArn"]),
    tags: recordOrEmpty(input["tags"]),
    streamsKmsKey: input["streamsKmsKey"],
    streamsKmsRole: stringOrUndefined(input["streamsKmsRole"]),
  };
  ctx.store.set(missionProfileKey(id), profile);
  return { missionProfileId: id };
};

const GetMissionProfile: OperationHandler = (input, ctx) => {
  const id = requireString(input, "missionProfileId");
  return profileView(requireProfile(ctx, id));
};

const ListMissionProfiles: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const profiles = ctx.store
    .list<StoredMissionProfile>()
    .filter((entry) => entry.key.startsWith(missionProfilePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { missionProfileList: profiles.slice(0, max).map(listItemView) };
};

const DeleteMissionProfile: OperationHandler = (input, ctx) => {
  const id = requireString(input, "missionProfileId");
  requireProfile(ctx, id);
  ctx.store.delete(missionProfileKey(id));
  return { missionProfileId: id };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const groundstation = {
  name: "groundstation",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "missionprofile") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateMissionProfile";
      if (req.method === "GET") return "ListMissionProfiles";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "GetMissionProfile";
      if (req.method === "DELETE") return "DeleteMissionProfile";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateMissionProfile,
    GetMissionProfile,
    ListMissionProfiles,
    DeleteMissionProfile,
  },
  model,
} as const satisfies ServiceDefinition;

export default groundstation;
