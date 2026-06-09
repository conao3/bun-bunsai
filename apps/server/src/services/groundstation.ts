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
const configPrefix = "config:" as const;
const dataflowEndpointGroupPrefix = "dataflowEndpointGroup:" as const;
const ephemerisPrefix = "ephemeris:" as const;
const contactPrefix = "contact:" as const;
const agentPrefix = "agent:" as const;

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

type StoredConfig = {
  configId: string;
  configType: string;
  configArn: string;
  name: string;
  configData: unknown;
  tags: Record<string, unknown>;
};

type StoredDataflowEndpointGroup = {
  dataflowEndpointGroupId: string;
  dataflowEndpointGroupArn: string;
  endpointsDetails: unknown[];
  tags: Record<string, unknown>;
  contactPrePassDurationSeconds: number | undefined;
  contactPostPassDurationSeconds: number | undefined;
};

type ContactVersionEntry = {
  versionId: string;
  created: number;
  activated: number | undefined;
  superseded: number | undefined;
  lastUpdated: number;
  status: string;
};

type StoredContact = {
  contactId: string;
  contactArn: string;
  versionId: string;
  versions: ContactVersionEntry[];
  missionProfileArn: string;
  satelliteArn: string;
  startTime: number;
  endTime: number;
  prePassStartTime: number;
  postPassEndTime: number;
  groundStation: string;
  contactStatus: string;
  errorMessage: string | undefined;
  maximumElevation: { value: number; unit: string } | undefined;
  tags: Record<string, unknown>;
  region: string;
  account: string;
  dataflowList: unknown[];
  visibilityStartTime: number;
  visibilityEndTime: number;
  trackingOverrides: unknown;
  ephemeris: { ephemerisId: string; ephemerisType: string } | undefined;
};

type StoredEphemeris = {
  ephemerisId: string;
  ephemerisArn: string;
  satelliteId: string;
  status: string;
  priority: number;
  creationTime: number;
  enabled: boolean;
  name: string;
  tags: Record<string, unknown>;
  suppliedData: unknown;
  invalidReason: string | undefined;
  errorReasons: unknown[] | undefined;
};

type StoredAgent = {
  agentId: string;
  taskingDocument: string;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const booleanOrDefault = (value: unknown, def: boolean): boolean =>
  typeof value === "boolean" ? value : def;

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

const encodePageToken = (offset: number): string =>
  Buffer.from(String(offset), "utf8").toString("base64");

const decodePageToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const decoded = Buffer.from(token, "base64").toString("utf8");
  const parsed = Number.parseInt(decoded, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const missionProfileKey = (id: string): string =>
  `${missionProfilePrefix}${id}`;

const configKey = (configType: string, configId: string): string =>
  `${configPrefix}${configType}:${configId}`;

const dataflowEndpointGroupKey = (id: string): string =>
  `${dataflowEndpointGroupPrefix}${id}`;

const ephemerisKey = (id: string): string => `${ephemerisPrefix}${id}`;

const contactKey = (id: string): string => `${contactPrefix}${id}`;

const agentKey = (id: string): string => `${agentPrefix}${id}`;

const tagsKey = (resourceArn: string): string => `tags:${resourceArn}`;

const profileArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:groundstation:${ctx.region}:${ctx.account}:mission-profile/${id}`;

const configArn = (
  ctx: ServiceContext,
  configType: string,
  configId: string,
): string =>
  `arn:aws:groundstation:${ctx.region}:${ctx.account}:config/${configType}/${configId}`;

const dataflowEndpointGroupArnFor = (ctx: ServiceContext, id: string): string =>
  `arn:aws:groundstation:${ctx.region}:${ctx.account}:dataflow-endpoint-group/${id}`;

const ephemerisArnFor = (ctx: ServiceContext, id: string): string =>
  `arn:aws:groundstation:${ctx.region}:${ctx.account}:ephemeris/${id}`;

const contactArnFor = (ctx: ServiceContext, id: string): string =>
  `arn:aws:groundstation:${ctx.region}:${ctx.account}:contact/${id}`;

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

const requireConfig = (
  ctx: ServiceContext,
  configType: string,
  configId: string,
): StoredConfig => {
  const config = ctx.store.get<StoredConfig>(configKey(configType, configId));
  if (config === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Config ${configId} not found.`,
      404,
    );
  }
  return config;
};

const requireDataflowEndpointGroup = (
  ctx: ServiceContext,
  id: string,
): StoredDataflowEndpointGroup => {
  const group = ctx.store.get<StoredDataflowEndpointGroup>(
    dataflowEndpointGroupKey(id),
  );
  if (group === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Dataflow endpoint group ${id} not found.`,
      404,
    );
  }
  return group;
};

const requireEphemeris = (ctx: ServiceContext, id: string): StoredEphemeris => {
  const eph = ctx.store.get<StoredEphemeris>(ephemerisKey(id));
  if (eph === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Ephemeris ${id} not found.`,
      404,
    );
  }
  return eph;
};

const requireContact = (ctx: ServiceContext, id: string): StoredContact => {
  const contact = ctx.store.get<StoredContact>(contactKey(id));
  if (contact === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact ${id} not found.`,
      404,
    );
  }
  return contact;
};

const profileView = (
  profile: StoredMissionProfile,
  ctx: ServiceContext,
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
  tags:
    ctx.store.get<Record<string, unknown>>(
      tagsKey(profile.missionProfileArn),
    ) ?? {},
  streamsKmsKey: profile.streamsKmsKey,
  streamsKmsRole: profile.streamsKmsRole,
});

const profileListItemView = (
  profile: StoredMissionProfile,
): Record<string, unknown> => ({
  missionProfileId: profile.missionProfileId,
  missionProfileArn: profile.missionProfileArn,
  region: profile.region,
  name: profile.name,
});

const contactLiveStatus = (contact: StoredContact): string => {
  if (
    contact.contactStatus === "CANCELLED" ||
    contact.contactStatus === "FAILED"
  ) {
    return contact.contactStatus;
  }
  const now = Math.floor(Date.now() / 1000);
  if (now < contact.prePassStartTime) return "SCHEDULED";
  if (now < contact.startTime) return "PREPASS";
  if (now < contact.endTime) return "PASS";
  if (now < contact.postPassEndTime) return "POSTPASS";
  return "COMPLETED";
};

const contactView = (
  contact: StoredContact,
  ctx: ServiceContext,
): Record<string, unknown> => ({
  contactId: contact.contactId,
  missionProfileArn: contact.missionProfileArn,
  satelliteArn: contact.satelliteArn,
  startTime: contact.startTime,
  endTime: contact.endTime,
  prePassStartTime: contact.prePassStartTime,
  postPassEndTime: contact.postPassEndTime,
  groundStation: contact.groundStation,
  contactStatus: contactLiveStatus(contact),
  errorMessage: contact.errorMessage,
  maximumElevation: contact.maximumElevation,
  tags:
    ctx.store.get<Record<string, unknown>>(tagsKey(contact.contactArn)) ?? {},
  region: contact.region,
  dataflowList: contact.dataflowList,
  visibilityStartTime: contact.visibilityStartTime,
  visibilityEndTime: contact.visibilityEndTime,
  trackingOverrides: contact.trackingOverrides,
  ephemeris: contact.ephemeris,
  version: contact.versionId,
});

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const staticSatelliteId = "sat-bunsai-0001";
const staticGroundStationId = "gs-bunsai-0001";

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
  ctx.store.set(tagsKey(profile.missionProfileArn), profile.tags);
  return { missionProfileId: id };
};

const GetMissionProfile: OperationHandler = (input, ctx) => {
  const id = requireString(input, "missionProfileId");
  return profileView(requireProfile(ctx, id), ctx);
};

const ListMissionProfiles: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const offset = decodePageToken(input["nextToken"]);
  const profiles = ctx.store
    .list<StoredMissionProfile>()
    .filter((entry) => entry.key.startsWith(missionProfilePrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const page = profiles.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    missionProfileList: page.map(profileListItemView),
  };
  if (offset + max < profiles.length) {
    result["nextToken"] = encodePageToken(offset + max);
  }
  return result;
};

const DeleteMissionProfile: OperationHandler = (input, ctx) => {
  const id = requireString(input, "missionProfileId");
  const profile = requireProfile(ctx, id);
  const dependentContact = ctx.store
    .list<StoredContact>()
    .find(
      (entry) =>
        entry.key.startsWith(contactPrefix) &&
        entry.value.missionProfileArn === profile.missionProfileArn,
    );
  if (dependentContact !== undefined) {
    throw awsError(
      "DependencyException",
      `MissionProfile ${id} is referenced by a contact.`,
      424,
    );
  }
  ctx.store.delete(missionProfileKey(id));
  return { missionProfileId: id };
};

const UpdateMissionProfile: OperationHandler = (input, ctx) => {
  const id = requireString(input, "missionProfileId");
  const profile = requireProfile(ctx, id);
  const updated: StoredMissionProfile = {
    ...profile,
    name: stringOrUndefined(input["name"]) ?? profile.name,
    contactPrePassDurationSeconds:
      numberOrUndefined(input["contactPrePassDurationSeconds"]) ??
      profile.contactPrePassDurationSeconds,
    contactPostPassDurationSeconds:
      numberOrUndefined(input["contactPostPassDurationSeconds"]) ??
      profile.contactPostPassDurationSeconds,
    minimumViableContactDurationSeconds:
      numberOrUndefined(input["minimumViableContactDurationSeconds"]) ??
      profile.minimumViableContactDurationSeconds,
    dataflowEdges: Array.isArray(input["dataflowEdges"])
      ? input["dataflowEdges"]
      : profile.dataflowEdges,
    trackingConfigArn:
      stringOrUndefined(input["trackingConfigArn"]) ??
      profile.trackingConfigArn,
    telemetrySinkConfigArn:
      stringOrUndefined(input["telemetrySinkConfigArn"]) ??
      profile.telemetrySinkConfigArn,
    streamsKmsKey: input["streamsKmsKey"] ?? profile.streamsKmsKey,
    streamsKmsRole:
      stringOrUndefined(input["streamsKmsRole"]) ?? profile.streamsKmsRole,
  };
  ctx.store.set(missionProfileKey(id), updated);
  return { missionProfileId: id };
};

const CreateConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const configData = input["configData"];
  const configType = determineConfigType(configData);
  const id = crypto.randomUUID();
  const config: StoredConfig = {
    configId: id,
    configType,
    configArn: configArn(ctx, configType, id),
    name,
    configData,
    tags: recordOrEmpty(input["tags"]),
  };
  ctx.store.set(configKey(configType, id), config);
  ctx.store.set(tagsKey(config.configArn), config.tags);
  return { configId: id, configType, configArn: config.configArn };
};

const determineConfigType = (configData: unknown): string => {
  if (typeof configData !== "object" || configData === null)
    return "dataflow-endpoint";
  const keys = Object.keys(configData as Record<string, unknown>);
  if (keys.includes("antennaDownlinkConfig")) return "antenna-downlink";
  if (keys.includes("antennaDownlinkDemodDecodeConfig"))
    return "antenna-downlink-demod-decode";
  if (keys.includes("antennaUplinkConfig")) return "antenna-uplink";
  if (keys.includes("dataflowEndpointConfig")) return "dataflow-endpoint";
  if (keys.includes("trackingConfig")) return "tracking";
  if (keys.includes("uplinkEchoConfig")) return "uplink-echo";
  if (keys.includes("s3RecordingConfig")) return "s3-recording";
  if (keys.includes("telemetrySinkConfig")) return "telemetry-sink";
  return "dataflow-endpoint";
};

const GetConfig: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "configId");
  const configType = requireString(input, "configType");
  const config = requireConfig(ctx, configType, configId);
  return {
    configId: config.configId,
    configArn: config.configArn,
    name: config.name,
    configType: config.configType,
    configData: config.configData,
    tags:
      ctx.store.get<Record<string, unknown>>(tagsKey(config.configArn)) ?? {},
  };
};

const ListConfigs: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const offset = decodePageToken(input["nextToken"]);
  const configs = ctx.store
    .list<StoredConfig>()
    .filter((entry) => entry.key.startsWith(configPrefix))
    .map((entry) => entry.value)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const page = configs.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    configList: page.map((c) => ({
      configId: c.configId,
      configType: c.configType,
      configArn: c.configArn,
      name: c.name,
    })),
  };
  if (offset + max < configs.length) {
    result["nextToken"] = encodePageToken(offset + max);
  }
  return result;
};

const UpdateConfig: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "configId");
  const configType = requireString(input, "configType");
  const config = requireConfig(ctx, configType, configId);
  const updated: StoredConfig = {
    ...config,
    name: stringOrUndefined(input["name"]) ?? config.name,
    configData: input["configData"] ?? config.configData,
  };
  ctx.store.set(configKey(configType, configId), updated);
  return {
    configId: config.configId,
    configType: config.configType,
    configArn: config.configArn,
  };
};

const DeleteConfig: OperationHandler = (input, ctx) => {
  const configId = requireString(input, "configId");
  const configType = requireString(input, "configType");
  const config = requireConfig(ctx, configType, configId);
  const dependentProfile = ctx.store
    .list<StoredMissionProfile>()
    .find(
      (entry) =>
        entry.key.startsWith(missionProfilePrefix) &&
        (entry.value.trackingConfigArn === config.configArn ||
          (entry.value.dataflowEdges as string[][]).some((edge) =>
            edge.includes(config.configArn),
          )),
    );
  if (dependentProfile !== undefined) {
    throw awsError(
      "DependencyException",
      `Config ${configId} is referenced by a mission profile.`,
      424,
    );
  }
  ctx.store.delete(configKey(configType, configId));
  return {
    configId: config.configId,
    configType: config.configType,
    configArn: config.configArn,
  };
};

const CreateDataflowEndpointGroup: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const group: StoredDataflowEndpointGroup = {
    dataflowEndpointGroupId: id,
    dataflowEndpointGroupArn: dataflowEndpointGroupArnFor(ctx, id),
    endpointsDetails: arrayOrEmpty(input["endpointDetails"]),
    tags: recordOrEmpty(input["tags"]),
    contactPrePassDurationSeconds: numberOrUndefined(
      input["contactPrePassDurationSeconds"],
    ),
    contactPostPassDurationSeconds: numberOrUndefined(
      input["contactPostPassDurationSeconds"],
    ),
  };
  ctx.store.set(dataflowEndpointGroupKey(id), group);
  ctx.store.set(tagsKey(group.dataflowEndpointGroupArn), group.tags);
  return { dataflowEndpointGroupId: id };
};

const CreateDataflowEndpointGroupV2: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const group: StoredDataflowEndpointGroup = {
    dataflowEndpointGroupId: id,
    dataflowEndpointGroupArn: dataflowEndpointGroupArnFor(ctx, id),
    endpointsDetails: arrayOrEmpty(input["endpoints"]),
    tags: recordOrEmpty(input["tags"]),
    contactPrePassDurationSeconds: numberOrUndefined(
      input["contactPrePassDurationSeconds"],
    ),
    contactPostPassDurationSeconds: numberOrUndefined(
      input["contactPostPassDurationSeconds"],
    ),
  };
  ctx.store.set(dataflowEndpointGroupKey(id), group);
  ctx.store.set(tagsKey(group.dataflowEndpointGroupArn), group.tags);
  return { dataflowEndpointGroupId: id };
};

const GetDataflowEndpointGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "dataflowEndpointGroupId");
  const group = requireDataflowEndpointGroup(ctx, id);
  return {
    dataflowEndpointGroupId: group.dataflowEndpointGroupId,
    dataflowEndpointGroupArn: group.dataflowEndpointGroupArn,
    endpointsDetails: group.endpointsDetails,
    tags:
      ctx.store.get<Record<string, unknown>>(
        tagsKey(group.dataflowEndpointGroupArn),
      ) ?? {},
    contactPrePassDurationSeconds: group.contactPrePassDurationSeconds,
    contactPostPassDurationSeconds: group.contactPostPassDurationSeconds,
  };
};

const ListDataflowEndpointGroups: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const offset = decodePageToken(input["nextToken"]);
  const groups = ctx.store
    .list<StoredDataflowEndpointGroup>()
    .filter((entry) => entry.key.startsWith(dataflowEndpointGroupPrefix))
    .map((entry) => entry.value);
  const page = groups.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    dataflowEndpointGroupList: page.map((g) => ({
      dataflowEndpointGroupId: g.dataflowEndpointGroupId,
      dataflowEndpointGroupArn: g.dataflowEndpointGroupArn,
    })),
  };
  if (offset + max < groups.length) {
    result["nextToken"] = encodePageToken(offset + max);
  }
  return result;
};

const DeleteDataflowEndpointGroup: OperationHandler = (input, ctx) => {
  const id = requireString(input, "dataflowEndpointGroupId");
  requireDataflowEndpointGroup(ctx, id);
  ctx.store.delete(dataflowEndpointGroupKey(id));
  return { dataflowEndpointGroupId: id };
};

const CreateEphemeris: OperationHandler = (input, ctx) => {
  const satelliteId = requireString(input, "satelliteId");
  const name = stringOrUndefined(input["name"]) ?? "";
  const id = crypto.randomUUID();
  const arn = ephemerisArnFor(ctx, id);
  const now = Math.floor(Date.now() / 1000);
  const enabled = booleanOrDefault(input["enabled"], true);
  const eph: StoredEphemeris = {
    ephemerisId: id,
    ephemerisArn: arn,
    satelliteId,
    status: enabled ? "ENABLED" : "DISABLED",
    priority: numberOrUndefined(input["priority"]) ?? 0,
    creationTime: now,
    enabled,
    name,
    tags: recordOrEmpty(input["tags"]),
    suppliedData: input["ephemeris"],
    invalidReason: undefined,
    errorReasons: undefined,
  };
  ctx.store.set(ephemerisKey(id), eph);
  ctx.store.set(tagsKey(arn), eph.tags);
  return { ephemerisId: id };
};

const DescribeEphemeris: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ephemerisId");
  const eph = requireEphemeris(ctx, id);
  return {
    ephemerisId: eph.ephemerisId,
    satelliteId: eph.satelliteId,
    status: eph.status,
    priority: eph.priority,
    creationTime: eph.creationTime,
    enabled: eph.enabled,
    name: eph.name,
    tags:
      ctx.store.get<Record<string, unknown>>(tagsKey(eph.ephemerisArn)) ?? {},
    suppliedData: eph.suppliedData,
    invalidReason: eph.invalidReason,
    errorReasons: eph.errorReasons,
  };
};

const UpdateEphemeris: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ephemerisId");
  const eph = requireEphemeris(ctx, id);
  const enabled =
    typeof input["enabled"] === "boolean" ? input["enabled"] : eph.enabled;
  const updated: StoredEphemeris = {
    ...eph,
    enabled,
    status: enabled ? "ENABLED" : "DISABLED",
    name: stringOrUndefined(input["name"]) ?? eph.name,
    priority: numberOrUndefined(input["priority"]) ?? eph.priority,
  };
  ctx.store.set(ephemerisKey(id), updated);
  return { ephemerisId: id };
};

const DeleteEphemeris: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ephemerisId");
  requireEphemeris(ctx, id);
  ctx.store.delete(ephemerisKey(id));
  return { ephemerisId: id };
};

const ListEphemerides: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const offset = decodePageToken(input["nextToken"]);
  const satelliteId = stringOrUndefined(input["satelliteId"]);
  const statusList = Array.isArray(input["statusList"])
    ? (input["statusList"] as string[])
    : undefined;
  let ephs = ctx.store
    .list<StoredEphemeris>()
    .filter((entry) => entry.key.startsWith(ephemerisPrefix))
    .map((entry) => entry.value);
  if (satelliteId !== undefined) {
    ephs = ephs.filter((e) => e.satelliteId === satelliteId);
  }
  if (statusList !== undefined && statusList.length > 0) {
    ephs = ephs.filter((e) => statusList.includes(e.status));
  }
  const page = ephs.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    ephemerides: page.map((e) => ({
      ephemerisId: e.ephemerisId,
      ephemerisType: "OEM",
      status: e.status,
      priority: e.priority,
      enabled: e.enabled,
      creationTime: e.creationTime,
      name: e.name,
    })),
  };
  if (offset + max < ephs.length) {
    result["nextToken"] = encodePageToken(offset + max);
  }
  return result;
};

const ReserveContact: OperationHandler = (input, ctx) => {
  const missionProfileArn = requireString(input, "missionProfileArn");
  const satelliteArn = requireString(input, "satelliteArn");
  const startTime = requireNumber(input, "startTime");
  const endTime = requireNumber(input, "endTime");
  const groundStation = requireString(input, "groundStation");
  const id = crypto.randomUUID();
  const arn = contactArnFor(ctx, id);
  const versionId = crypto.randomUUID();
  const prePassStartTime = startTime - 120;
  const postPassEndTime = endTime + 120;
  const now = Math.floor(Date.now() / 1000);
  const initialVersion: ContactVersionEntry = {
    versionId,
    created: now,
    activated: undefined,
    superseded: undefined,
    lastUpdated: now,
    status: "ACTIVE",
  };
  const tags = recordOrEmpty(input["tags"]);
  const contact: StoredContact = {
    contactId: id,
    contactArn: arn,
    versionId,
    versions: [initialVersion],
    missionProfileArn,
    satelliteArn,
    startTime,
    endTime,
    prePassStartTime,
    postPassEndTime,
    groundStation,
    contactStatus: "SCHEDULED",
    errorMessage: undefined,
    maximumElevation: { value: 45.0, unit: "DEGREE_ANGLE" },
    tags,
    region: ctx.region,
    account: ctx.account,
    dataflowList: [],
    visibilityStartTime: startTime,
    visibilityEndTime: endTime,
    trackingOverrides: input["trackingOverrides"],
    ephemeris: undefined,
  };
  ctx.store.set(contactKey(id), contact);
  ctx.store.set(tagsKey(arn), tags);
  return { contactId: id, versionId };
};

const DescribeContact: OperationHandler = (input, ctx) => {
  const id = requireString(input, "contactId");
  return contactView(requireContact(ctx, id), ctx);
};

const DescribeContactVersion: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "contactId");
  const versionId = requireString(input, "versionId");
  const contact = requireContact(ctx, contactId);
  const version = contact.versions.find((v) => v.versionId === versionId);
  if (version === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Contact version ${versionId} not found.`,
      404,
    );
  }
  return { ...contactView(contact, ctx), version: versionId };
};

const CancelContact: OperationHandler = (input, ctx) => {
  const id = requireString(input, "contactId");
  const contact = requireContact(ctx, id);
  const liveStatus = contactLiveStatus(contact);
  if (liveStatus === "CANCELLED" || liveStatus === "COMPLETED") {
    throw awsError(
      "InvalidParameterException",
      `Contact ${id} cannot be cancelled in status ${liveStatus}.`,
      400,
    );
  }
  const updated: StoredContact = { ...contact, contactStatus: "CANCELLED" };
  ctx.store.set(contactKey(id), updated);
  return { contactId: id, versionId: contact.versionId };
};

const ListContacts: OperationHandler = (input, ctx) => {
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const offset = decodePageToken(input["nextToken"]);
  const statusList = Array.isArray(input["statusList"])
    ? (input["statusList"] as string[])
    : undefined;
  if (statusList === undefined || statusList.length === 0) {
    throw awsError("InvalidParameterException", "statusList is required.", 400);
  }
  const startTimeSec = requireNumber(input, "startTime");
  const endTimeSec = requireNumber(input, "endTime");
  const groundStation = stringOrUndefined(input["groundStation"]);
  const satelliteArnFilter = stringOrUndefined(input["satelliteArn"]);
  const missionProfileArnFilter = stringOrUndefined(input["missionProfileArn"]);
  let contacts = ctx.store
    .list<StoredContact>()
    .filter((entry) => entry.key.startsWith(contactPrefix))
    .map((entry) => entry.value);
  contacts = contacts.filter(
    (c) => c.startTime >= startTimeSec && c.endTime <= endTimeSec,
  );
  contacts = contacts.filter((c) => statusList.includes(contactLiveStatus(c)));
  if (groundStation !== undefined) {
    contacts = contacts.filter((c) => c.groundStation === groundStation);
  }
  if (satelliteArnFilter !== undefined) {
    contacts = contacts.filter((c) => c.satelliteArn === satelliteArnFilter);
  }
  if (missionProfileArnFilter !== undefined) {
    contacts = contacts.filter(
      (c) => c.missionProfileArn === missionProfileArnFilter,
    );
  }
  const page = contacts.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    contactList: page.map((c) => ({
      contactId: c.contactId,
      missionProfileArn: c.missionProfileArn,
      satelliteArn: c.satelliteArn,
      startTime: c.startTime,
      endTime: c.endTime,
      prePassStartTime: c.prePassStartTime,
      postPassEndTime: c.postPassEndTime,
      groundStation: c.groundStation,
      contactStatus: contactLiveStatus(c),
      errorMessage: c.errorMessage,
      maximumElevation: c.maximumElevation,
      region: c.region,
      tags: ctx.store.get<Record<string, unknown>>(tagsKey(c.contactArn)) ?? {},
      visibilityStartTime: c.visibilityStartTime,
      visibilityEndTime: c.visibilityEndTime,
      ephemeris: c.ephemeris,
      version: c.versionId,
    })),
  };
  if (offset + max < contacts.length) {
    result["nextToken"] = encodePageToken(offset + max);
  }
  return result;
};

const ListContactVersions: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "contactId");
  const contact = requireContact(ctx, contactId);
  const max = numberOrUndefined(input["maxResults"]) ?? 100;
  const offset = decodePageToken(input["nextToken"]);
  const page = contact.versions.slice(offset, offset + max);
  const result: Record<string, unknown> = {
    contactVersionsList: page.map((v) => ({
      versionId: v.versionId,
      created: v.created,
      activated: v.activated,
      superseded: v.superseded,
      lastUpdated: v.lastUpdated,
      status: v.status,
      failureCodes: [],
    })),
  };
  if (offset + max < contact.versions.length) {
    result["nextToken"] = encodePageToken(offset + max);
  }
  return result;
};

const UpdateContact: OperationHandler = (input, ctx) => {
  const contactId = requireString(input, "contactId");
  const contact = requireContact(ctx, contactId);
  const newVersionId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const newVersion: ContactVersionEntry = {
    versionId: newVersionId,
    created: now,
    activated: undefined,
    superseded: undefined,
    lastUpdated: now,
    status: "ACTIVE",
  };
  const updated: StoredContact = {
    ...contact,
    versionId: newVersionId,
    versions: [...contact.versions, newVersion],
    trackingOverrides: input["trackingOverrides"] ?? contact.trackingOverrides,
    satelliteArn:
      stringOrUndefined(input["satelliteArn"]) ?? contact.satelliteArn,
  };
  ctx.store.set(contactKey(contactId), updated);
  return { contactId, versionId: newVersionId };
};

const GetSatellite: OperationHandler = (input, _ctx) => {
  const satelliteId = requireString(input, "satelliteId");
  if (satelliteId !== staticSatelliteId) {
    throw awsError(
      "ResourceNotFoundException",
      `Satellite ${satelliteId} not found.`,
      404,
    );
  }
  return {
    satelliteId: staticSatelliteId,
    satelliteArn: `arn:aws:groundstation:us-east-1:000000000000:satellite/${staticSatelliteId}`,
    noradSatelliteID: 25544,
    groundStations: [staticGroundStationId],
    currentEphemeris: undefined,
  };
};

const ListSatellites: OperationHandler = (_input, _ctx) => ({
  satellites: [
    {
      satelliteId: staticSatelliteId,
      satelliteArn: `arn:aws:groundstation:us-east-1:000000000000:satellite/${staticSatelliteId}`,
      noradSatelliteID: 25544,
      groundStations: [staticGroundStationId],
      currentEphemeris: undefined,
    },
  ],
});

const ListGroundStations: OperationHandler = (_input, _ctx) => ({
  groundStationList: [
    {
      groundStationId: staticGroundStationId,
      groundStationName: staticGroundStationId,
      region: "us-east-1",
    },
  ],
});

const GetMinuteUsage: OperationHandler = (_input, _ctx) => ({
  isReservedMinutesCustomer: false,
  totalReservedMinuteAllocation: 0,
  upcomingMinutesScheduled: 0,
  totalScheduledMinutes: 0,
  estimatedMinutesRemaining: 0,
});

const ListAntennas: OperationHandler = (_input, _ctx) => ({
  antennaList: [
    {
      groundStationName: staticGroundStationId,
      antennaName: "ant-bunsai-0001",
      region: "us-east-1",
    },
  ],
});

const ListGroundStationReservations: OperationHandler = (_input, _ctx) => ({
  reservationList: [],
});

const RegisterAgent: OperationHandler = (input, ctx) => {
  const id = crypto.randomUUID();
  const agent: StoredAgent = {
    agentId: id,
    taskingDocument: JSON.stringify({
      agentId: id,
      taskingDocument: input["agentDetails"],
    }),
  };
  ctx.store.set(agentKey(id), agent);
  return { agentId: id };
};

const GetAgentConfiguration: OperationHandler = (input, ctx) => {
  const agentId = requireString(input, "agentId");
  const agent = ctx.store.get<StoredAgent>(agentKey(agentId));
  if (agent === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Agent ${agentId} not found.`,
      404,
    );
  }
  return { agentId: agent.agentId, taskingDocument: agent.taskingDocument };
};

const UpdateAgentStatus: OperationHandler = (input, ctx) => {
  const agentId = requireString(input, "agentId");
  const agent = ctx.store.get<StoredAgent>(agentKey(agentId));
  if (agent === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Agent ${agentId} not found.`,
      404,
    );
  }
  return { agentId };
};

const GetAgentTaskResponseUrl: OperationHandler = (input, _ctx) => {
  const agentId = requireString(input, "agentId");
  const taskId = requireString(input, "taskId");
  return {
    agentId,
    taskId,
    presignedLogUrl: `https://s3.amazonaws.com/bunsai-groundstation-logs/${agentId}/${taskId}`,
  };
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, unknown>>(tagsKey(resourceArn));
  return { tags: tags ?? {} };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const newTags = recordOrEmpty(input["tags"]);
  const existing =
    ctx.store.get<Record<string, unknown>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = arrayOrEmpty(input["tagKeys"]) as string[];
  const existing =
    ctx.store.get<Record<string, unknown>>(tagsKey(resourceArn)) ?? {};
  const updated = Object.fromEntries(
    Object.entries(existing).filter(([k]) => !tagKeys.includes(k)),
  );
  ctx.store.set(tagsKey(resourceArn), updated);
  return {};
};

const groundstation = {
  name: "groundstation",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const [p0, , p2] = parts;

    if (p0 === "missionprofile") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateMissionProfile";
        if (req.method === "GET") return "ListMissionProfiles";
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetMissionProfile";
        if (req.method === "DELETE") return "DeleteMissionProfile";
        if (req.method === "PUT") return "UpdateMissionProfile";
      }
      return undefined;
    }

    if (p0 === "config") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateConfig";
        if (req.method === "GET") return "ListConfigs";
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetConfig";
        if (req.method === "PUT") return "UpdateConfig";
        if (req.method === "DELETE") return "DeleteConfig";
      }
      return undefined;
    }

    if (p0 === "dataflowEndpointGroup") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateDataflowEndpointGroup";
        if (req.method === "GET") return "ListDataflowEndpointGroups";
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "GetDataflowEndpointGroup";
        if (req.method === "DELETE") return "DeleteDataflowEndpointGroup";
      }
      return undefined;
    }

    if (p0 === "dataflowEndpointGroupV2") {
      if (parts.length === 1 && req.method === "POST")
        return "CreateDataflowEndpointGroupV2";
      return undefined;
    }

    if (p0 === "ephemeris") {
      if (parts.length === 1 && req.method === "POST") return "CreateEphemeris";
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeEphemeris";
        if (req.method === "PUT") return "UpdateEphemeris";
        if (req.method === "DELETE") return "DeleteEphemeris";
      }
      return undefined;
    }

    if (p0 === "ephemerides") {
      if (parts.length === 1 && req.method === "POST") return "ListEphemerides";
      return undefined;
    }

    if (p0 === "contact") {
      if (parts.length === 1 && req.method === "POST") return "ReserveContact";
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeContact";
        if (req.method === "DELETE") return "CancelContact";
      }
      if (parts.length === 3 && p2 === "versions") {
        if (req.method === "GET") return "ListContactVersions";
        if (req.method === "POST") return "UpdateContact";
      }
      if (parts.length === 4 && p2 === "versions") {
        if (req.method === "GET") return "DescribeContactVersion";
      }
      return undefined;
    }

    if (p0 === "contacts") {
      if (parts.length === 1 && req.method === "POST") return "ListContacts";
      return undefined;
    }

    if (p0 === "satellite") {
      if (parts.length === 1 && req.method === "GET") return "ListSatellites";
      if (parts.length === 2 && req.method === "GET") return "GetSatellite";
      return undefined;
    }

    if (p0 === "groundstation") {
      if (parts.length === 1 && req.method === "GET")
        return "ListGroundStations";
      if (parts.length === 3 && p2 === "antenna" && req.method === "GET")
        return "ListAntennas";
      if (parts.length === 3 && p2 === "reservation" && req.method === "GET")
        return "ListGroundStationReservations";
      return undefined;
    }

    if (p0 === "minute-usage") {
      if (parts.length === 1 && req.method === "POST") return "GetMinuteUsage";
      return undefined;
    }

    if (p0 === "tags") {
      if (parts.length >= 2) {
        if (req.method === "GET") return "ListTagsForResource";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
      }
      return undefined;
    }

    if (p0 === "agent") {
      if (parts.length === 1 && req.method === "POST") return "RegisterAgent";
      if (parts.length === 2 && req.method === "PUT")
        return "UpdateAgentStatus";
      if (parts.length === 3 && p2 === "configuration" && req.method === "GET")
        return "GetAgentConfiguration";
      return undefined;
    }

    if (p0 === "agentResponseUrl") {
      if (parts.length === 3 && req.method === "GET")
        return "GetAgentTaskResponseUrl";
      return undefined;
    }

    return undefined;
  },
  operations: {
    CreateMissionProfile,
    GetMissionProfile,
    ListMissionProfiles,
    DeleteMissionProfile,
    UpdateMissionProfile,
    CreateConfig,
    GetConfig,
    ListConfigs,
    UpdateConfig,
    DeleteConfig,
    CreateDataflowEndpointGroup,
    CreateDataflowEndpointGroupV2,
    GetDataflowEndpointGroup,
    ListDataflowEndpointGroups,
    DeleteDataflowEndpointGroup,
    CreateEphemeris,
    DescribeEphemeris,
    UpdateEphemeris,
    DeleteEphemeris,
    ListEphemerides,
    ReserveContact,
    DescribeContact,
    DescribeContactVersion,
    CancelContact,
    ListContacts,
    ListContactVersions,
    UpdateContact,
    GetSatellite,
    ListSatellites,
    ListGroundStations,
    GetMinuteUsage,
    ListAntennas,
    ListGroundStationReservations,
    RegisterAgent,
    GetAgentConfiguration,
    UpdateAgentStatus,
    GetAgentTaskResponseUrl,
    ListTagsForResource,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default groundstation;
