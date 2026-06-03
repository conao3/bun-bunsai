import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import appstreamModel from "../../../../test/vendor/aws-models/appstream.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(appstreamModel);

type StoredFleet = {
  Arn: string;
  Name: string;
  DisplayName: string | undefined;
  Description: string | undefined;
  ImageName: string | undefined;
  ImageArn: string | undefined;
  InstanceType: string;
  FleetType: string;
  ComputeCapacityStatus: {
    Desired: number;
    Running: number;
    InUse: number;
    Available: number;
  };
  State: string;
  CreatedTime: number;
  EnableDefaultInternetAccess: boolean | undefined;
  IdleDisconnectTimeoutInSeconds: number | undefined;
  IamRoleArn: string | undefined;
  StreamView: string | undefined;
  Platform: string | undefined;
};

type StoredStack = {
  Arn: string;
  Name: string;
  Description: string | undefined;
  DisplayName: string | undefined;
  CreatedTime: number;
  RedirectURL: string | undefined;
  FeedbackURL: string | undefined;
};

const fleetKey = (name: string): string => `fleet/${name}`;
const stackKey = (name: string): string => `stack/${name}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidParameterCombinationException",
      `${key} is required.`,
      400,
    );
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const booleanOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const stringListFromInput = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const desiredFromComputeCapacity = (value: unknown): number => {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)["DesiredInstances"] === "number"
  ) {
    return (value as Record<string, unknown>)["DesiredInstances"] as number;
  }
  return 1;
};

const fleetArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:fleet/${name}`;

const stackArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:appstream:${ctx.region}:${ctx.account}:stack/${name}`;

const listFleets = (ctx: ServiceContext): StoredFleet[] =>
  ctx.store
    .list<StoredFleet>()
    .filter((entry) => entry.key.startsWith("fleet/"))
    .map((entry) => entry.value);

const listStacks = (ctx: ServiceContext): StoredStack[] =>
  ctx.store
    .list<StoredStack>()
    .filter((entry) => entry.key.startsWith("stack/"))
    .map((entry) => entry.value);

const CreateFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const instanceType = requireString(input, "InstanceType");
  if (ctx.store.get<StoredFleet>(fleetKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Fleet already exists: ${name}`,
      400,
    );
  }
  const desired = desiredFromComputeCapacity(input["ComputeCapacity"]);
  const fleet: StoredFleet = {
    Arn: fleetArn(ctx, name),
    Name: name,
    DisplayName: stringOrUndefined(input["DisplayName"]),
    Description: stringOrUndefined(input["Description"]),
    ImageName: stringOrUndefined(input["ImageName"]),
    ImageArn: stringOrUndefined(input["ImageArn"]),
    InstanceType: instanceType,
    FleetType: stringOrUndefined(input["FleetType"]) ?? "ON_DEMAND",
    ComputeCapacityStatus: {
      Desired: desired,
      Running: desired,
      InUse: 0,
      Available: desired,
    },
    State: "RUNNING",
    CreatedTime: Date.now(),
    EnableDefaultInternetAccess: booleanOrUndefined(
      input["EnableDefaultInternetAccess"],
    ),
    IdleDisconnectTimeoutInSeconds: numberOrUndefined(
      input["IdleDisconnectTimeoutInSeconds"],
    ),
    IamRoleArn: stringOrUndefined(input["IamRoleArn"]),
    StreamView: stringOrUndefined(input["StreamView"]),
    Platform: stringOrUndefined(input["Platform"]),
  };
  ctx.store.set(fleetKey(name), fleet);
  return { Fleet: fleet };
};

const DescribeFleets: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  return {
    Fleets: listFleets(ctx).filter(
      (fleet) => names.length === 0 || names.includes(fleet.Name),
    ),
  };
};

const DeleteFleet: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredFleet>(fleetKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fleet not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(fleetKey(name));
  return {};
};

const CreateStack: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredStack>(stackKey(name)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Stack already exists: ${name}`,
      400,
    );
  }
  const stack: StoredStack = {
    Arn: stackArn(ctx, name),
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DisplayName: stringOrUndefined(input["DisplayName"]),
    CreatedTime: Date.now(),
    RedirectURL: stringOrUndefined(input["RedirectURL"]),
    FeedbackURL: stringOrUndefined(input["FeedbackURL"]),
  };
  ctx.store.set(stackKey(name), stack);
  return { Stack: stack };
};

const DescribeStacks: OperationHandler = (input, ctx) => {
  const names = stringListFromInput(input["Names"]);
  return {
    Stacks: listStacks(ctx).filter(
      (stack) => names.length === 0 || names.includes(stack.Name),
    ),
  };
};

const DeleteStack: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (ctx.store.get<StoredStack>(stackKey(name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Stack not found: ${name}`,
      400,
    );
  }
  ctx.store.delete(stackKey(name));
  return {};
};

const appstream = {
  name: "appstream",
  protocol: "json",
  operations: {
    CreateFleet,
    DescribeFleets,
    DeleteFleet,
    CreateStack,
    DescribeStacks,
    DeleteStack,
  },
  model,
} as const satisfies ServiceDefinition;

export default appstream;
