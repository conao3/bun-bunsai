import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import datasyncModel from "../../../../test/vendor/aws-models/datasync.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(datasyncModel);

type StoredLocation = {
  LocationArn: string;
  LocationUri: string;
  S3BucketArn: string;
  S3StorageClass: string;
  S3Config: Record<string, unknown>;
  Subdirectory: string | undefined;
  AgentArns: unknown[];
  Tags: unknown[];
};

type StoredTask = {
  TaskArn: string;
  Name: string | undefined;
  Status: string;
  SourceLocationArn: string;
  DestinationLocationArn: string;
  CloudWatchLogGroupArn: string | undefined;
  Options: unknown;
  Excludes: unknown[];
  Includes: unknown[];
  Schedule: unknown;
  Tags: unknown[];
  TaskMode: string;
  CreationTime: number;
  CurrentTaskExecutionArn: string | undefined;
  executions: string[];
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const hex17 = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 17);

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireString = (
  input: Record<string, unknown>,
  member: string,
): string => {
  const value = input[member];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("InvalidRequestException", `${member} is required.`, 400);
};

const locationArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:datasync:${ctx.region}:${ctx.account}:location/loc-${id}`;

const taskArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:datasync:${ctx.region}:${ctx.account}:task/task-${id}`;

const locationKey = (arn: string): string => `location/${arn}`;

const taskKey = (arn: string): string => `task/${arn}`;

const requireTask = (ctx: ServiceContext, arn: string): StoredTask => {
  const task = ctx.store.get<StoredTask>(taskKey(arn));
  if (task === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Task ${arn} could not be found.`,
      400,
    );
  }
  return task;
};

const CreateLocationS3: OperationHandler = (input, ctx) => {
  const s3BucketArn = requireString(input, "S3BucketArn");
  const s3Config = asRecord(input["S3Config"]);
  if (stringOrUndefined(s3Config["BucketAccessRoleArn"]) === undefined) {
    throw awsError(
      "InvalidRequestException",
      "S3Config.BucketAccessRoleArn is required.",
      400,
    );
  }
  const id = hex17();
  const arn = locationArn(ctx, id);
  const subdirectory = stringOrUndefined(input["Subdirectory"]);
  const bucketName = s3BucketArn.split(":").pop() ?? s3BucketArn;
  const suffix =
    subdirectory === undefined
      ? ""
      : subdirectory.startsWith("/")
        ? subdirectory
        : `/${subdirectory}`;
  const location: StoredLocation = {
    LocationArn: arn,
    LocationUri: `s3://${bucketName}${suffix}`,
    S3BucketArn: s3BucketArn,
    S3StorageClass: stringOrUndefined(input["S3StorageClass"]) ?? "STANDARD",
    S3Config: s3Config,
    Subdirectory: subdirectory,
    AgentArns: arrayOrEmpty(input["AgentArns"]),
    Tags: arrayOrEmpty(input["Tags"]),
  };
  ctx.store.set(locationKey(arn), location);
  return { LocationArn: arn };
};

const ListLocations: OperationHandler = (_input, ctx) => {
  const locations = ctx.store
    .list<StoredLocation>()
    .filter((entry) => entry.key.startsWith("location/"))
    .map((entry) => ({
      LocationArn: entry.value.LocationArn,
      LocationUri: entry.value.LocationUri,
    }));
  return { Locations: locations };
};

const CreateTask: OperationHandler = (input, ctx) => {
  const sourceLocationArn = requireString(input, "SourceLocationArn");
  const destinationLocationArn = requireString(input, "DestinationLocationArn");
  const id = hex17();
  const arn = taskArn(ctx, id);
  const task: StoredTask = {
    TaskArn: arn,
    Name: stringOrUndefined(input["Name"]),
    Status: "AVAILABLE",
    SourceLocationArn: sourceLocationArn,
    DestinationLocationArn: destinationLocationArn,
    CloudWatchLogGroupArn: stringOrUndefined(input["CloudWatchLogGroupArn"]),
    Options: input["Options"],
    Excludes: arrayOrEmpty(input["Excludes"]),
    Includes: arrayOrEmpty(input["Includes"]),
    Schedule: input["Schedule"],
    Tags: arrayOrEmpty(input["Tags"]),
    TaskMode: stringOrUndefined(input["TaskMode"]) ?? "BASIC",
    CreationTime: nowSeconds(),
    CurrentTaskExecutionArn: undefined,
    executions: [],
  };
  ctx.store.set(taskKey(arn), task);
  return { TaskArn: arn };
};

const DescribeTask: OperationHandler = (input, ctx) => {
  const task = requireTask(ctx, requireString(input, "TaskArn"));
  return {
    TaskArn: task.TaskArn,
    Status: task.Status,
    Name: task.Name,
    CurrentTaskExecutionArn: task.CurrentTaskExecutionArn,
    SourceLocationArn: task.SourceLocationArn,
    DestinationLocationArn: task.DestinationLocationArn,
    CloudWatchLogGroupArn: task.CloudWatchLogGroupArn,
    SourceNetworkInterfaceArns: [],
    DestinationNetworkInterfaceArns: [],
    Options: task.Options,
    Excludes: task.Excludes,
    Includes: task.Includes,
    Schedule: task.Schedule,
    CreationTime: task.CreationTime,
    TaskMode: task.TaskMode,
  };
};

const ListTasks: OperationHandler = (_input, ctx) => {
  const tasks = ctx.store
    .list<StoredTask>()
    .filter((entry) => entry.key.startsWith("task/"))
    .map((entry) => ({
      TaskArn: entry.value.TaskArn,
      Status: entry.value.Status,
      Name: entry.value.Name,
      TaskMode: entry.value.TaskMode,
    }));
  return { Tasks: tasks };
};

const DeleteTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  requireTask(ctx, arn);
  ctx.store.delete(taskKey(arn));
  return {};
};

const StartTaskExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "TaskArn");
  const task = requireTask(ctx, arn);
  const executionArn = `${arn}/execution/exec-${hex17()}`;
  task.executions.push(executionArn);
  task.CurrentTaskExecutionArn = executionArn;
  task.Status = "RUNNING";
  ctx.store.set(taskKey(arn), task);
  return { TaskExecutionArn: executionArn };
};

const datasync: ServiceDefinition = {
  name: "datasync",
  protocol: "json",
  operations: {
    CreateLocationS3,
    ListLocations,
    CreateTask,
    DescribeTask,
    ListTasks,
    DeleteTask,
    StartTaskExecution,
  },
  model,
} as const;

export default datasync;
