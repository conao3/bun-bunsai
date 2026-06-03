import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import smsVoiceModel from "../../../../test/vendor/aws-models/pinpoint-sms-voice-v2.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(smsVoiceModel);

const configurationSetPrefix = "configuration-set:" as const;

type StoredConfigurationSet = {
  ConfigurationSetName: string;
  ConfigurationSetArn: string;
  EventDestinations: unknown[];
  Tags: { Key: string; Value: string }[];
  CreatedTimestamp: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const tagsFrom = (value: unknown): { Key: string; Value: string }[] => {
  if (!Array.isArray(value)) return [];
  const out: { Key: string; Value: string }[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const key = stringOrUndefined(record["Key"]);
    const tagValue = stringOrUndefined(record["Value"]);
    if (key !== undefined && tagValue !== undefined)
      out.push({ Key: key, Value: tagValue });
  }
  return out;
};

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

const configurationSetKey = (name: string): string =>
  `${configurationSetPrefix}${name}`;

const configurationSetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:sms-voice:${ctx.region}:${ctx.account}:configuration-set/${name}`;

const nameFromArn = (value: string): string => {
  const marker = ":configuration-set/";
  const index = value.indexOf(marker);
  return index === -1 ? value : value.slice(index + marker.length);
};

const configurationSetView = (
  set: StoredConfigurationSet,
): Record<string, unknown> => ({
  ConfigurationSetArn: set.ConfigurationSetArn,
  ConfigurationSetName: set.ConfigurationSetName,
  EventDestinations: set.EventDestinations,
  CreatedTimestamp: set.CreatedTimestamp,
});

const requireConfigurationSet = (
  ctx: ServiceContext,
  name: string,
): StoredConfigurationSet => {
  const stored = ctx.store.get<StoredConfigurationSet>(
    configurationSetKey(name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Configuration set ${name} does not exist.`,
      404,
    );
  }
  return stored;
};

const CreateConfigurationSet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ConfigurationSetName");
  if (ctx.store.get<StoredConfigurationSet>(configurationSetKey(name))) {
    throw awsError(
      "ConflictException",
      `Configuration set ${name} already exists.`,
      409,
    );
  }
  const set: StoredConfigurationSet = {
    ConfigurationSetName: name,
    ConfigurationSetArn: configurationSetArn(ctx, name),
    EventDestinations: [],
    Tags: tagsFrom(input["Tags"]),
    CreatedTimestamp: Math.floor(Date.now() / 1000),
  };
  ctx.store.set(configurationSetKey(name), set);
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    Tags: set.Tags,
    CreatedTimestamp: set.CreatedTimestamp,
  };
};

const DescribeConfigurationSets: OperationHandler = (input, ctx) => {
  const filter = input["ConfigurationSetNames"];
  const wanted = Array.isArray(filter)
    ? filter.filter((entry): entry is string => typeof entry === "string")
    : undefined;
  const sets = ctx.store
    .list<StoredConfigurationSet>()
    .filter((entry) => entry.key.startsWith(configurationSetPrefix))
    .map((entry) => entry.value)
    .filter(
      (set) =>
        wanted === undefined ||
        wanted.some(
          (name) =>
            name === set.ConfigurationSetName ||
            nameFromArn(name) === set.ConfigurationSetName,
        ),
    )
    .sort((a, b) =>
      a.ConfigurationSetName.localeCompare(b.ConfigurationSetName),
    );
  return { ConfigurationSets: sets.map(configurationSetView) };
};

const DeleteConfigurationSet: OperationHandler = (input, ctx) => {
  const name = nameFromArn(requireString(input, "ConfigurationSetName"));
  const set = requireConfigurationSet(ctx, name);
  ctx.store.delete(configurationSetKey(name));
  return {
    ConfigurationSetArn: set.ConfigurationSetArn,
    ConfigurationSetName: set.ConfigurationSetName,
    EventDestinations: set.EventDestinations,
    CreatedTimestamp: set.CreatedTimestamp,
  };
};

const smsVoice = {
  name: "sms-voice",
  protocol: "json",
  operations: {
    CreateConfigurationSet,
    DescribeConfigurationSets,
    DeleteConfigurationSet,
  },
  model,
} as const satisfies ServiceDefinition;

export default smsVoice;
