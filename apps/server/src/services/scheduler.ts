import { awsError } from "../core/framework.ts";
import { deliverToArn } from "../core/events.ts";
import { loadServiceModel } from "../core/shapes.ts";
import schedulerModel from "../../models/scheduler.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(schedulerModel);

const schedulePrefix = "schedule:" as const;

const groupPrefix = "group:" as const;

const tagPrefix = "tag:" as const;

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

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const parseAt = (expr: string): number | undefined => {
  const m = /^at\((.+)\)$/.exec(expr);
  if (m === null) return undefined;
  const ms = new Date(m[1]).getTime();
  return Number.isNaN(ms) ? undefined : ms;
};

const parseRate = (expr: string): number | undefined => {
  const m = /^rate\((\d+)\s+(minute|minutes|hour|hours|day|days)\)$/.exec(expr);
  if (m === null) return undefined;
  const val = parseInt(m[1], 10);
  const unitMs: Record<string, number> = {
    minute: 60_000,
    minutes: 60_000,
    hour: 3_600_000,
    hours: 3_600_000,
    day: 86_400_000,
    days: 86_400_000,
  };
  return val * (unitMs[m[2]] ?? 0);
};

const cancelTimer = (key: string): void => {
  const t = pendingTimers.get(key);
  if (t !== undefined) {
    clearTimeout(t);
    pendingTimers.delete(key);
  }
};

const fireSchedule = async (
  key: string,
  ctx: ServiceContext,
): Promise<void> => {
  const schedule = ctx.store.get<StoredSchedule>(key);
  if (schedule === undefined || schedule.State !== "ENABLED") return;
  const targetArn =
    typeof schedule.Target["Arn"] === "string"
      ? schedule.Target["Arn"]
      : undefined;
  if (targetArn === undefined) return;
  const body =
    typeof schedule.Target["Input"] === "string"
      ? schedule.Target["Input"]
      : "{}";
  await deliverToArn(ctx, targetArn, {
    body,
    event: { source: "aws.scheduler" },
  });
};

const armTimer = (
  key: string,
  schedule: StoredSchedule,
  ctx: ServiceContext,
): void => {
  cancelTimer(key);
  if (schedule.State !== "ENABLED") return;
  const expr = schedule.ScheduleExpression;
  const atMs = parseAt(expr);
  if (atMs !== undefined) {
    const delay = Math.max(0, atMs - Date.now());
    pendingTimers.set(
      key,
      setTimeout(() => {
        pendingTimers.delete(key);
        void fireSchedule(key, ctx);
      }, delay),
    );
    return;
  }
  const rateMs = parseRate(expr);
  if (rateMs !== undefined) {
    const fire = (): void => {
      void (async () => {
        pendingTimers.delete(key);
        await fireSchedule(key, ctx);
        const current = ctx.store.get<StoredSchedule>(key);
        if (current !== undefined && current.State === "ENABLED") {
          pendingTimers.set(key, setTimeout(fire, rateMs));
        }
      })();
    };
    pendingTimers.set(key, setTimeout(fire, rateMs));
    return;
  }
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

const tagKey = (arn: string): string => `${tagPrefix}${arn}`;

const arnExists = (arn: string, ctx: ServiceContext): boolean => {
  const schedMatch =
    /^arn:aws:scheduler:[^:]+:[^:]+:schedule\/([^/]+)\/(.+)$/.exec(arn);
  if (schedMatch !== null) {
    return (
      ctx.store.get<StoredSchedule>(
        scheduleKey(schedMatch[1]!, schedMatch[2]!),
      ) !== undefined
    );
  }
  const grpMatch = /^arn:aws:scheduler:[^:]+:[^:]+:schedule-group\/(.+)$/.exec(
    arn,
  );
  if (grpMatch !== null) {
    return ctx.store.get<StoredGroup>(groupKey(grpMatch[1]!)) !== undefined;
  }
  return false;
};

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
  if (
    group !== defaultGroup &&
    ctx.store.get<StoredGroup>(groupKey(group)) === undefined
  ) {
    throw awsError(
      "ResourceNotFoundException",
      `Schedule group ${group} not found.`,
      404,
    );
  }
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
  armTimer(scheduleKey(group, name), schedule, ctx);
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
  const nextToken = stringOrUndefined(input["NextToken"]);
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
  const startIdx = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const page = schedules.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < schedules.length;
  const responseNextToken = hasMore ? btoa(String(startIdx + max)) : undefined;
  return { Schedules: page.map(scheduleSummary), NextToken: responseNextToken };
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
  armTimer(scheduleKey(group, name), schedule, ctx);
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
  cancelTimer(scheduleKey(group, name));
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

const GetScheduleGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const group = ctx.store.get<StoredGroup>(groupKey(name));
  if (group === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Schedule group ${name} not found.`,
      404,
    );
  }
  return groupView(group);
};

const DeleteScheduleGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const existing = ctx.store.get<StoredGroup>(groupKey(name));
  if (existing === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Schedule group ${name} not found.`,
      404,
    );
  }
  const schedulesInGroup = ctx.store
    .list<StoredSchedule>()
    .filter((entry) => entry.key.startsWith(schedulePrefix))
    .map((entry) => ({ key: entry.key, value: entry.value }))
    .filter((entry) => entry.value.GroupName === name);
  if (schedulesInGroup.length === 0) {
    ctx.store.delete(groupKey(name));
    ctx.store.delete(tagKey(existing.Arn));
    return {};
  }
  const deletingGroup: StoredGroup = { ...existing, State: "DELETING" };
  ctx.store.set(groupKey(name), deletingGroup);
  setTimeout(() => {
    for (const { key, value } of schedulesInGroup) {
      cancelTimer(key);
      ctx.store.delete(key);
      ctx.store.delete(tagKey(value.Arn));
    }
    ctx.store.delete(groupKey(name));
    ctx.store.delete(tagKey(existing.Arn));
  }, 0);
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  if (!arnExists(arn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }
  const tags = Array.isArray(input["Tags"])
    ? (input["Tags"] as Record<string, unknown>[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  for (const tag of tags) {
    const key = typeof tag["Key"] === "string" ? tag["Key"] : undefined;
    const value = typeof tag["Value"] === "string" ? tag["Value"] : undefined;
    if (key !== undefined && value !== undefined) {
      existing[key] = value;
    }
  }
  ctx.store.set(tagKey(arn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  if (!arnExists(arn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagKey(arn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  if (!arnExists(arn, ctx)) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found.`,
      404,
    );
  }
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  const tags = Object.entries(existing).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tags };
};

const ListScheduleGroups: OperationHandler = (input, ctx) => {
  const prefix = stringOrUndefined(input["NamePrefix"]);
  const nextToken = stringOrUndefined(input["NextToken"]);
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
  const startIdx = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const page = groups.slice(startIdx, startIdx + max);
  const hasMore = startIdx + max < groups.length;
  const responseNextToken = hasMore ? btoa(String(startIdx + max)) : undefined;
  return {
    ScheduleGroups: page.map(groupView),
    NextToken: responseNextToken,
  };
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
      if (parts.length === 2) {
        if (req.method === "POST") return "CreateScheduleGroup";
        if (req.method === "GET") return "GetScheduleGroup";
        if (req.method === "DELETE") return "DeleteScheduleGroup";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "tags") {
      if (parts.length >= 2) {
        if (req.method === "GET") return "ListTagsForResource";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
        return undefined;
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
    GetScheduleGroup,
    DeleteScheduleGroup,
    ListScheduleGroups,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default scheduler;
