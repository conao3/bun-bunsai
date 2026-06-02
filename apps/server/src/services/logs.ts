import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import logsModel from "../../../../test/vendor/aws-models/logs.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(logsModel);

type StoredEvent = {
  timestamp: number;
  message: string;
  ingestionTime: number;
  eventId: string;
};

type StoredStream = {
  logStreamName: string;
  creationTime: number;
  events: StoredEvent[];
};

type StoredGroup = {
  logGroupName: string;
  creationTime: number;
  arn: string;
  streams: Record<string, StoredStream>;
};

const groupArnOf = (region: string, account: string, name: string): string =>
  `arn:aws:logs:${region}:${account}:log-group:${name}:*`;

const streamArnOf = (
  region: string,
  account: string,
  groupName: string,
  streamName: string,
): string =>
  `arn:aws:logs:${region}:${account}:log-group:${groupName}:log-stream:${streamName}`;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  field: string,
): string | undefined => {
  const value = input[field];
  return typeof value === "string" ? value : undefined;
};

const optionalNumber = (
  input: Record<string, unknown>,
  field: string,
): number | undefined => {
  const value = input[field];
  return typeof value === "number" ? value : undefined;
};

const requireGroup = (ctx: ServiceContext, name: string): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(name);
  if (group === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The specified log group does not exist.`,
      400,
    );
  }
  return group;
};

const requireStream = (group: StoredGroup, name: string): StoredStream => {
  const stream = group.streams[name];
  if (stream === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `The specified log stream does not exist.`,
      400,
    );
  }
  return stream;
};

const sequenceTokenOf = (stream: StoredStream): string =>
  String(stream.events.length);

const CreateLogGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "logGroupName");
  if (ctx.store.get<StoredGroup>(name) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `The specified log group already exists.`,
      400,
    );
  }
  const group: StoredGroup = {
    logGroupName: name,
    creationTime: Date.now(),
    arn: groupArnOf(ctx.region, ctx.account, name),
    streams: {},
  };
  ctx.store.set(name, group);
  return {};
};

const DeleteLogGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "logGroupName");
  requireGroup(ctx, name);
  ctx.store.delete(name);
  return {};
};

const DescribeLogGroups: OperationHandler = (input, ctx) => {
  const prefix = optionalString(input, "logGroupNamePrefix");
  const groups = ctx.store
    .list<StoredGroup>()
    .map((entry) => entry.value)
    .filter((group) =>
      prefix === undefined ? true : group.logGroupName.startsWith(prefix),
    )
    .sort((a, b) => a.logGroupName.localeCompare(b.logGroupName));
  return {
    logGroups: groups.map((group) => ({
      logGroupName: group.logGroupName,
      creationTime: group.creationTime,
      metricFilterCount: 0,
      arn: group.arn,
      storedBytes: 0,
      logGroupClass: "STANDARD",
    })),
  };
};

const CreateLogStream: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const streamName = requireString(input, "logStreamName");
  const group = requireGroup(ctx, groupName);
  if (group.streams[streamName] !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `The specified log stream already exists.`,
      400,
    );
  }
  group.streams[streamName] = {
    logStreamName: streamName,
    creationTime: Date.now(),
    events: [],
  };
  ctx.store.set(groupName, group);
  return {};
};

const logStreamView = (
  ctx: ServiceContext,
  groupName: string,
  stream: StoredStream,
): Record<string, unknown> => {
  const view: Record<string, unknown> = {
    logStreamName: stream.logStreamName,
    creationTime: stream.creationTime,
    arn: streamArnOf(ctx.region, ctx.account, groupName, stream.logStreamName),
    storedBytes: 0,
    uploadSequenceToken: sequenceTokenOf(stream),
  };
  if (stream.events.length > 0) {
    const first = stream.events[0];
    const last = stream.events[stream.events.length - 1];
    if (first !== undefined) view["firstEventTimestamp"] = first.timestamp;
    if (last !== undefined) {
      view["lastEventTimestamp"] = last.timestamp;
      view["lastIngestionTime"] = last.ingestionTime;
    }
  }
  return view;
};

const DescribeLogStreams: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const group = requireGroup(ctx, groupName);
  const prefix = optionalString(input, "logStreamNamePrefix");
  const streams = Object.values(group.streams)
    .filter((stream) =>
      prefix === undefined ? true : stream.logStreamName.startsWith(prefix),
    )
    .sort((a, b) => a.logStreamName.localeCompare(b.logStreamName));
  return {
    logStreams: streams.map((stream) => logStreamView(ctx, groupName, stream)),
  };
};

const PutLogEvents: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const streamName = requireString(input, "logStreamName");
  const group = requireGroup(ctx, groupName);
  const stream = requireStream(group, streamName);
  const rawEvents = input["logEvents"];
  if (!Array.isArray(rawEvents)) {
    throw awsError("InvalidParameterException", "logEvents is required.", 400);
  }
  const ingestionTime = Date.now();
  for (const raw of rawEvents) {
    const event = raw as Record<string, unknown>;
    const timestamp = optionalNumber(event, "timestamp");
    const message = optionalString(event, "message");
    if (timestamp === undefined || message === undefined) {
      throw awsError(
        "InvalidParameterException",
        "Each log event requires timestamp and message.",
        400,
      );
    }
    stream.events.push({
      timestamp,
      message,
      ingestionTime,
      eventId: crypto.randomUUID(),
    });
  }
  stream.events.sort((a, b) => a.timestamp - b.timestamp);
  ctx.store.set(groupName, group);
  return { nextSequenceToken: sequenceTokenOf(stream) };
};

const GetLogEvents: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const streamName = requireString(input, "logStreamName");
  const group = requireGroup(ctx, groupName);
  const stream = requireStream(group, streamName);
  const startTime = optionalNumber(input, "startTime");
  const endTime = optionalNumber(input, "endTime");
  const events = stream.events.filter((event) => {
    if (startTime !== undefined && event.timestamp < startTime) return false;
    if (endTime !== undefined && event.timestamp >= endTime) return false;
    return true;
  });
  const token = `t/${stream.events.length}`;
  return {
    events: events.map((event) => ({
      timestamp: event.timestamp,
      message: event.message,
      ingestionTime: event.ingestionTime,
    })),
    nextForwardToken: token,
    nextBackwardToken: token,
  };
};

const FilterLogEvents: OperationHandler = (input, ctx) => {
  const groupName = requireString(input, "logGroupName");
  const group = requireGroup(ctx, groupName);
  const startTime = optionalNumber(input, "startTime");
  const endTime = optionalNumber(input, "endTime");
  const pattern = optionalString(input, "filterPattern");
  const rawStreamNames = input["logStreamNames"];
  const streamNames = Array.isArray(rawStreamNames)
    ? rawStreamNames.filter(
        (value): value is string => typeof value === "string",
      )
    : undefined;
  const collected: {
    logStreamName: string;
    timestamp: number;
    message: string;
    ingestionTime: number;
    eventId: string;
  }[] = [];
  for (const stream of Object.values(group.streams)) {
    if (
      streamNames !== undefined &&
      !streamNames.includes(stream.logStreamName)
    )
      continue;
    for (const event of stream.events) {
      if (startTime !== undefined && event.timestamp < startTime) continue;
      if (endTime !== undefined && event.timestamp >= endTime) continue;
      if (
        pattern !== undefined &&
        pattern !== "" &&
        !event.message.includes(pattern)
      )
        continue;
      collected.push({
        logStreamName: stream.logStreamName,
        timestamp: event.timestamp,
        message: event.message,
        ingestionTime: event.ingestionTime,
        eventId: event.eventId,
      });
    }
  }
  collected.sort((a, b) => a.timestamp - b.timestamp);
  const searched = Object.values(group.streams).map((stream) => ({
    logStreamName: stream.logStreamName,
    searchedCompletely: true,
  }));
  return {
    events: collected,
    searchedLogStreams: searched,
  };
};

const logs: ServiceDefinition = {
  name: "logs",
  protocol: "json",
  operations: {
    CreateLogGroup,
    DeleteLogGroup,
    DescribeLogGroups,
    CreateLogStream,
    DescribeLogStreams,
    PutLogEvents,
    GetLogEvents,
    FilterLogEvents,
  },
  model,
} as const;

export default logs;
