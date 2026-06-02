import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import schedulerModel from "../../../../test/vendor/aws-models/scheduler.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(schedulerModel);

const schedulePrefix = "schedule:" as const;

const groupPrefix = "group:" as const;

const defaultGroup = "default" as const;

type StoredSchedule = {
  Name: string;
  GroupName: string;
  Arn: string;
  Description: string | undefined;
  ScheduleExpression: string;
  ScheduleExpressionTimezone: string | undefined;
  StartDate: number | undefined;
  EndDate: number | undefined;
  State: string;
  KmsKeyArn: string | undefined;
  ActionAfterCompletion: string | undefined;
  FlexibleTimeWindow: Record<string, unknown>;
  Target: Record<string, unknown>;
  CreationDate: number;
  LastModificationDate: number;
};

type StoredGroup = {
  Name: string;
  Arn: string;
  State: string;
  CreationDate: number;
  LastModificationDate: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

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

const groupOf = (input: Record<string, unknown>): string =>
  stringOrUndefined(input["GroupName"]) ?? defaultGroup;

const scheduleKey = (group: string, name: string): string =>
  `${schedulePrefix}${group}/${name}`;

const groupKey = (name: string): string => `${groupPrefix}${name}`;

const scheduleArn = (
  ctx: ServiceContext,
  group: string,
  name: string,
): string =>
  `arn:aws:scheduler:${ctx.region}:${ctx.account}:schedule/${group}/${name}`;

const groupArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:scheduler:${ctx.region}:${ctx.account}:schedule-group/${name}`;

const scheduleView = (schedule: StoredSchedule): Record<string, unknown> => ({
  Arn: schedule.Arn,
  Name: schedule.Name,
  GroupName: schedule.GroupName,
  Description: schedule.Description,
  ScheduleExpression: schedule.ScheduleExpression,
  ScheduleExpressionTimezone: schedule.ScheduleExpressionTimezone,
  StartDate: schedule.StartDate,
  EndDate: schedule.EndDate,
  State: schedule.State,
  KmsKeyArn: schedule.KmsKeyArn,
  ActionAfterCompletion: schedule.ActionAfterCompletion,
  FlexibleTimeWindow: schedule.FlexibleTimeWindow,
  Target: schedule.Target,
  CreationDate: schedule.CreationDate,
  LastModificationDate: schedule.LastModificationDate,
});

const scheduleSummary = (
  schedule: StoredSchedule,
): Record<string, unknown> => ({
  Arn: schedule.Arn,
  Name: schedule.Name,
  GroupName: schedule.GroupName,
  State: schedule.State,
  CreationDate: schedule.CreationDate,
  LastModificationDate: schedule.LastModificationDate,
  Target: {
    Arn:
      typeof schedule.Target["Arn"] === "string"
        ? schedule.Target["Arn"]
        : undefined,
    RoleArn:
      typeof schedule.Target["RoleArn"] === "string"
        ? schedule.Target["RoleArn"]
        : undefined,
  },
});

const groupView = (group: StoredGroup): Record<string, unknown> => ({
  Arn: group.Arn,
  Name: group.Name,
  State: group.State,
  CreationDate: group.CreationDate,
  LastModificationDate: group.LastModificationDate,
});

const CreateSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const group = groupOf(input);
  if (ctx.store.get<StoredSchedule>(scheduleKey(group, name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Schedule ${name} already exists.`,
      409,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const arn = scheduleArn(ctx, group, name);
  const schedule: StoredSchedule = {
    Name: name,
    GroupName: group,
    Arn: arn,
    Description: stringOrUndefined(input["Description"]),
    ScheduleExpression: requireString(input, "ScheduleExpression"),
    ScheduleExpressionTimezone: stringOrUndefined(
      input["ScheduleExpressionTimezone"],
    ),
    StartDate: numberOrUndefined(input["StartDate"]),
    EndDate: numberOrUndefined(input["EndDate"]),
    State: stringOrUndefined(input["State"]) ?? "ENABLED",
    KmsKeyArn: stringOrUndefined(input["KmsKeyArn"]),
    ActionAfterCompletion: stringOrUndefined(input["ActionAfterCompletion"]),
    FlexibleTimeWindow: asRecord(input["FlexibleTimeWindow"]),
    Target: asRecord(input["Target"]),
    CreationDate: now,
    LastModificationDate: now,
  };
  ctx.store.set(scheduleKey(group, name), schedule);
  return { ScheduleArn: arn };
};

const GetSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const group = groupOf(input);
  const schedule = ctx.store.get<StoredSchedule>(scheduleKey(group, name));
  if (schedule === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Schedule ${name} not found.`,
      404,
    );
  }
  return scheduleView(schedule);
};

const ListSchedules: OperationHandler = (input, ctx) => {
  const group = stringOrUndefined(input["GroupName"]);
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const state = stringOrUndefined(input["State"]);
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 100;
  const schedules = ctx.store
    .list<StoredSchedule>()
    .filter((entry) => entry.key.startsWith(schedulePrefix))
    .map((entry) => entry.value)
    .filter((schedule) => group === undefined || schedule.GroupName === group)
    .filter(
      (schedule) => prefix === undefined || schedule.Name.startsWith(prefix),
    )
    .filter((schedule) => state === undefined || schedule.State === state)
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const page = schedules.slice(0, max);
  return { Schedules: page.map(scheduleSummary) };
};

const UpdateSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const group = groupOf(input);
  const existing = ctx.store.get<StoredSchedule>(scheduleKey(group, name));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Schedule ${name} not found.`,
      404,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const schedule: StoredSchedule = {
    Name: name,
    GroupName: group,
    Arn: existing.Arn,
    Description: stringOrUndefined(input["Description"]),
    ScheduleExpression: requireString(input, "ScheduleExpression"),
    ScheduleExpressionTimezone: stringOrUndefined(
      input["ScheduleExpressionTimezone"],
    ),
    StartDate: numberOrUndefined(input["StartDate"]),
    EndDate: numberOrUndefined(input["EndDate"]),
    State: stringOrUndefined(input["State"]) ?? "ENABLED",
    KmsKeyArn: stringOrUndefined(input["KmsKeyArn"]),
    ActionAfterCompletion: stringOrUndefined(input["ActionAfterCompletion"]),
    FlexibleTimeWindow: asRecord(input["FlexibleTimeWindow"]),
    Target: asRecord(input["Target"]),
    CreationDate: existing.CreationDate,
    LastModificationDate: now,
  };
  ctx.store.set(scheduleKey(group, name), schedule);
  return { ScheduleArn: existing.Arn };
};

const DeleteSchedule: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const group = groupOf(input);
  if (ctx.store.get<StoredSchedule>(scheduleKey(group, name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Schedule ${name} not found.`,
      404,
    );
  }
  ctx.store.delete(scheduleKey(group, name));
  return {};
};

const CreateScheduleGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredGroup>(groupKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `Schedule group ${name} already exists.`,
      409,
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const arn = groupArn(ctx, name);
  const group: StoredGroup = {
    Name: name,
    Arn: arn,
    State: "ACTIVE",
    CreationDate: now,
    LastModificationDate: now,
  };
  ctx.store.set(groupKey(name), group);
  return { ScheduleGroupArn: arn };
};

const ListScheduleGroups: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const max =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 100;
  const groups = ctx.store
    .list<StoredGroup>()
    .filter((entry) => entry.key.startsWith(groupPrefix))
    .map((entry) => entry.value)
    .filter((group) => prefix === undefined || group.Name.startsWith(prefix))
    .sort((a, b) => (a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0));
  const page = groups.slice(0, max);
  return { ScheduleGroups: page.map(groupView) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const scheduler = {
  name: "scheduler",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "schedules") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListSchedules";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateSchedule";
        if (req.method === "GET") return "GetSchedule";
        if (req.method === "PUT") return "UpdateSchedule";
        if (req.method === "DELETE") return "DeleteSchedule";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "schedule-groups") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListScheduleGroups";
        return undefined;
      }
      if (parts.length === 2 && req.method === "POST") {
        return "CreateScheduleGroup";
      }
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateSchedule,
    GetSchedule,
    ListSchedules,
    UpdateSchedule,
    DeleteSchedule,
    CreateScheduleGroup,
    ListScheduleGroups,
  },
  model,
} as const satisfies ServiceDefinition;

export default scheduler;
