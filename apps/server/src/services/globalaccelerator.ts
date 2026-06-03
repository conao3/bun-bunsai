import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import globalacceleratorModel from "../../../../test/vendor/aws-models/globalaccelerator.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(globalacceleratorModel);

type StoredAccelerator = {
  AcceleratorArn: string;
  Name: string;
  IpAddressType: string;
  Enabled: boolean;
  IpSets: {
    IpFamily: string;
    IpAddresses: string[];
    IpAddressFamily: string;
  }[];
  DnsName: string;
  Status: string;
  CreatedTime: number;
  LastModifiedTime: number;
};

const acceleratorKey = (arn: string): string => `accelerator/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidArgumentException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const requireAccelerator = (
  ctx: ServiceContext,
  arn: string,
): StoredAccelerator => {
  const accelerator = ctx.store.get<StoredAccelerator>(acceleratorKey(arn));
  if (accelerator === undefined) {
    throw awsError(
      "AcceleratorNotFoundException",
      `Accelerator not found: ${arn}`,
      400,
    );
  }
  return accelerator;
};

const CreateAccelerator: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  requireString(input, "IdempotencyToken");
  const acceleratorId = crypto.randomUUID();
  const arn = `arn:aws:globalaccelerator::${ctx.account}:accelerator/${acceleratorId}`;
  const now = Date.now() / 1000;
  const accelerator: StoredAccelerator = {
    AcceleratorArn: arn,
    Name: name,
    IpAddressType: stringOrUndefined(input["IpAddressType"]) ?? "IPV4",
    Enabled: typeof input["Enabled"] === "boolean" ? input["Enabled"] : true,
    IpSets: [
      {
        IpFamily: "IPv4",
        IpAddresses: ["198.51.100.1", "198.51.100.2"],
        IpAddressFamily: "IPv4",
      },
    ],
    DnsName: `${acceleratorId}.awsglobalaccelerator.com`,
    Status: "DEPLOYED",
    CreatedTime: now,
    LastModifiedTime: now,
  };
  ctx.store.set(acceleratorKey(arn), accelerator);
  return { Accelerator: accelerator };
};

const DescribeAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  return { Accelerator: requireAccelerator(ctx, arn) };
};

const ListAccelerators: OperationHandler = (_input, ctx) => {
  const accelerators = ctx.store
    .list<StoredAccelerator>()
    .filter((entry) => entry.key.startsWith("accelerator/"))
    .map((entry) => entry.value);
  return { Accelerators: accelerators };
};

const UpdateAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  const accelerator = requireAccelerator(ctx, arn);
  const updated: StoredAccelerator = {
    ...accelerator,
    Name: stringOrUndefined(input["Name"]) ?? accelerator.Name,
    IpAddressType:
      stringOrUndefined(input["IpAddressType"]) ?? accelerator.IpAddressType,
    Enabled:
      typeof input["Enabled"] === "boolean"
        ? input["Enabled"]
        : accelerator.Enabled,
    Status: "DEPLOYED",
    LastModifiedTime: Date.now() / 1000,
  };
  ctx.store.set(acceleratorKey(arn), updated);
  return { Accelerator: updated };
};

const DeleteAccelerator: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "AcceleratorArn");
  requireAccelerator(ctx, arn);
  ctx.store.delete(acceleratorKey(arn));
  return {};
};

const globalaccelerator = {
  name: "globalaccelerator",
  protocol: "json",
  operations: {
    CreateAccelerator,
    DescribeAccelerator,
    ListAccelerators,
    UpdateAccelerator,
    DeleteAccelerator,
  },
  model,
} as const satisfies ServiceDefinition;

export default globalaccelerator;
