import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ec2Model from "../../../../test/vendor/aws-models/ec2.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(ec2Model);

type Tag = {
  Key: string;
  Value: string;
};

type StoredInstance = {
  InstanceId: string;
  ImageId: string;
  InstanceType: string;
  State: { Code: number; Name: string };
  PrivateIpAddress: string;
  SubnetId: string | undefined;
  VpcId: string | undefined;
  ReservationId: string;
  Tags: Tag[];
};

type StoredVpc = {
  VpcId: string;
  CidrBlock: string;
  State: string;
  InstanceTenancy: string;
  IsDefault: boolean;
  DhcpOptionsId: string;
  Tags: Tag[];
};

type StoredSecurityGroup = {
  GroupId: string;
  GroupName: string;
  Description: string;
  VpcId: string | undefined;
  Tags: Tag[];
};

const hexId = (prefix: string): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `${prefix}-${hex}`;
};

const instanceKey = (id: string): string => `instance/${id}`;
const vpcKey = (id: string): string => `vpc/${id}`;
const sgKey = (id: string): string => `sg/${id}`;

const allInstances = (ctx: ServiceContext): StoredInstance[] =>
  ctx.store
    .list<StoredInstance>()
    .filter((entry) => entry.key.startsWith("instance/"))
    .map((entry) => entry.value);

const allVpcs = (ctx: ServiceContext): StoredVpc[] =>
  ctx.store
    .list<StoredVpc>()
    .filter((entry) => entry.key.startsWith("vpc/"))
    .map((entry) => entry.value);

const allSecurityGroups = (ctx: ServiceContext): StoredSecurityGroup[] =>
  ctx.store
    .list<StoredSecurityGroup>()
    .filter((entry) => entry.key.startsWith("sg/"))
    .map((entry) => entry.value);

const stringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string" && value !== "") return [value];
  return [];
};

const tagList = (value: unknown): Tag[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        Key: typeof record["Key"] === "string" ? record["Key"] : "",
        Value: typeof record["Value"] === "string" ? record["Value"] : "",
      };
    });
};

const RunInstances: OperationHandler = (input, ctx) => {
  const imageId =
    typeof input["ImageId"] === "string" ? input["ImageId"] : "ami-00000000";
  const instanceType =
    typeof input["InstanceType"] === "string"
      ? input["InstanceType"]
      : "t2.micro";
  const rawMin = input["MinCount"];
  const min =
    typeof rawMin === "number"
      ? rawMin
      : typeof rawMin === "string"
        ? Number.parseInt(rawMin, 10)
        : 1;
  const count = Number.isFinite(min) && min > 0 ? min : 1;
  const reservationId = hexId("r");
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : undefined;
  const instances: StoredInstance[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = hexId("i");
    const octet = 10 + (i % 240);
    const instance: StoredInstance = {
      InstanceId: id,
      ImageId: imageId,
      InstanceType: instanceType,
      State: { Code: 16, Name: "running" },
      PrivateIpAddress: `10.0.0.${octet}`,
      SubnetId: subnetId,
      VpcId: undefined,
      ReservationId: reservationId,
      Tags: [],
    };
    ctx.store.set(instanceKey(id), instance);
    instances.push(instance);
  }
  return {
    ReservationId: reservationId,
    OwnerId: ctx.account,
    Instances: instances.map((instance) => ({
      InstanceId: instance.InstanceId,
      ImageId: instance.ImageId,
      InstanceType: instance.InstanceType,
      State: instance.State,
      PrivateIpAddress: instance.PrivateIpAddress,
      SubnetId: instance.SubnetId,
      VpcId: instance.VpcId,
      Tags: instance.Tags,
    })),
  };
};

const DescribeInstances: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const instances = allInstances(ctx).filter((instance) =>
    ids.length === 0 ? true : ids.includes(instance.InstanceId),
  );
  const byReservation = new Map<string, StoredInstance[]>();
  for (const instance of instances) {
    const list = byReservation.get(instance.ReservationId) ?? [];
    list.push(instance);
    byReservation.set(instance.ReservationId, list);
  }
  return {
    Reservations: [...byReservation.entries()].map(
      ([reservationId, members]) => ({
        ReservationId: reservationId,
        OwnerId: ctx.account,
        Instances: members.map((instance) => ({
          InstanceId: instance.InstanceId,
          ImageId: instance.ImageId,
          InstanceType: instance.InstanceType,
          State: instance.State,
          PrivateIpAddress: instance.PrivateIpAddress,
          SubnetId: instance.SubnetId,
          VpcId: instance.VpcId,
          Tags: instance.Tags,
        })),
      }),
    ),
  };
};

const transitionInstances = (
  ctx: ServiceContext,
  ids: string[],
  current: { Code: number; Name: string },
): { InstanceId: string; CurrentState: unknown; PreviousState: unknown }[] => {
  const changes: {
    InstanceId: string;
    CurrentState: unknown;
    PreviousState: unknown;
  }[] = [];
  for (const id of ids) {
    const instance = ctx.store.get<StoredInstance>(instanceKey(id));
    if (instance === undefined) {
      throw awsError(
        "InvalidInstanceID.NotFound",
        `The instance ID '${id}' does not exist`,
        400,
      );
    }
    const previous = instance.State;
    instance.State = current;
    ctx.store.set(instanceKey(id), instance);
    changes.push({
      InstanceId: id,
      PreviousState: previous,
      CurrentState: current,
    });
  }
  return changes;
};

const TerminateInstances: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const changes = transitionInstances(ctx, ids, {
    Code: 48,
    Name: "terminated",
  });
  for (const id of ids) ctx.store.delete(instanceKey(id));
  return { TerminatingInstances: changes };
};

const StartInstances: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const changes = transitionInstances(ctx, ids, { Code: 16, Name: "running" });
  return { StartingInstances: changes };
};

const StopInstances: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const changes = transitionInstances(ctx, ids, { Code: 80, Name: "stopped" });
  return { StoppingInstances: changes };
};

const CreateVpc: OperationHandler = (input, ctx) => {
  const cidrBlock =
    typeof input["CidrBlock"] === "string" ? input["CidrBlock"] : "10.0.0.0/16";
  const instanceTenancy =
    typeof input["InstanceTenancy"] === "string"
      ? input["InstanceTenancy"]
      : "default";
  const id = hexId("vpc");
  const vpc: StoredVpc = {
    VpcId: id,
    CidrBlock: cidrBlock,
    State: "available",
    InstanceTenancy: instanceTenancy,
    IsDefault: false,
    DhcpOptionsId: hexId("dopt"),
    Tags: [],
  };
  ctx.store.set(vpcKey(id), vpc);
  return {
    Vpc: {
      VpcId: vpc.VpcId,
      CidrBlock: vpc.CidrBlock,
      State: vpc.State,
      InstanceTenancy: vpc.InstanceTenancy,
      IsDefault: vpc.IsDefault,
      DhcpOptionsId: vpc.DhcpOptionsId,
      OwnerId: ctx.account,
      Tags: vpc.Tags,
    },
  };
};

const DescribeVpcs: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpcIds"]);
  const vpcs = allVpcs(ctx).filter((vpc) =>
    ids.length === 0 ? true : ids.includes(vpc.VpcId),
  );
  return {
    Vpcs: vpcs.map((vpc) => ({
      VpcId: vpc.VpcId,
      CidrBlock: vpc.CidrBlock,
      State: vpc.State,
      InstanceTenancy: vpc.InstanceTenancy,
      IsDefault: vpc.IsDefault,
      DhcpOptionsId: vpc.DhcpOptionsId,
      OwnerId: ctx.account,
      Tags: vpc.Tags,
    })),
  };
};

const DeleteVpc: OperationHandler = (input, ctx) => {
  const id = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(id));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpcKey(id));
  return {};
};

const CreateSecurityGroup: OperationHandler = (input, ctx) => {
  const groupName =
    typeof input["GroupName"] === "string" ? input["GroupName"] : "";
  if (groupName === "") {
    throw awsError(
      "MissingParameter",
      "The request must contain the parameter GroupName",
      400,
    );
  }
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : undefined;
  const id = hexId("sg");
  const group: StoredSecurityGroup = {
    GroupId: id,
    GroupName: groupName,
    Description: description,
    VpcId: vpcId,
    Tags: [],
  };
  ctx.store.set(sgKey(id), group);
  return {
    GroupId: id,
    SecurityGroupArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:security-group/${id}`,
    Tags: group.Tags,
  };
};

const DescribeSecurityGroups: OperationHandler = (input, ctx) => {
  const ids = stringList(input["GroupIds"]);
  const names = stringList(input["GroupNames"]);
  const groups = allSecurityGroups(ctx).filter((group) => {
    if (ids.length === 0 && names.length === 0) return true;
    return ids.includes(group.GroupId) || names.includes(group.GroupName);
  });
  return {
    SecurityGroups: groups.map((group) => ({
      GroupId: group.GroupId,
      GroupName: group.GroupName,
      Description: group.Description,
      VpcId: group.VpcId,
      OwnerId: ctx.account,
      SecurityGroupArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:security-group/${group.GroupId}`,
      Tags: group.Tags,
    })),
  };
};

const resourceTagTarget = (
  ctx: ServiceContext,
  resourceId: string,
): StoredInstance | StoredVpc | StoredSecurityGroup | undefined => {
  if (resourceId.startsWith("i-"))
    return ctx.store.get<StoredInstance>(instanceKey(resourceId));
  if (resourceId.startsWith("vpc-"))
    return ctx.store.get<StoredVpc>(vpcKey(resourceId));
  if (resourceId.startsWith("sg-"))
    return ctx.store.get<StoredSecurityGroup>(sgKey(resourceId));
  return undefined;
};

const persistResource = (
  ctx: ServiceContext,
  resourceId: string,
  resource: StoredInstance | StoredVpc | StoredSecurityGroup,
): void => {
  if (resourceId.startsWith("i-"))
    ctx.store.set(instanceKey(resourceId), resource);
  else if (resourceId.startsWith("vpc-"))
    ctx.store.set(vpcKey(resourceId), resource);
  else if (resourceId.startsWith("sg-"))
    ctx.store.set(sgKey(resourceId), resource);
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resources = stringList(input["Resources"]);
  const tags = tagList(input["Tags"]);
  for (const resourceId of resources) {
    const resource = resourceTagTarget(ctx, resourceId);
    if (resource === undefined) {
      throw awsError("InvalidID", `The ID '${resourceId}' is not valid`, 400);
    }
    for (const tag of tags) {
      const existing = resource.Tags.find((item) => item.Key === tag.Key);
      if (existing === undefined) resource.Tags.push({ ...tag });
      else existing.Value = tag.Value;
    }
    persistResource(ctx, resourceId, resource);
  }
  return {};
};

const resourceTypeOf = (resourceId: string): string => {
  if (resourceId.startsWith("i-")) return "instance";
  if (resourceId.startsWith("vpc-")) return "vpc";
  if (resourceId.startsWith("sg-")) return "security-group";
  return "unknown";
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const collected: {
    Key: string;
    Value: string;
    ResourceId: string;
    ResourceType: string;
  }[] = [];
  const consume = (resourceId: string, tags: Tag[]): void => {
    for (const tag of tags) {
      collected.push({
        Key: tag.Key,
        Value: tag.Value,
        ResourceId: resourceId,
        ResourceType: resourceTypeOf(resourceId),
      });
    }
  };
  for (const instance of allInstances(ctx))
    consume(instance.InstanceId, instance.Tags);
  for (const vpc of allVpcs(ctx)) consume(vpc.VpcId, vpc.Tags);
  for (const group of allSecurityGroups(ctx))
    consume(group.GroupId, group.Tags);
  return { Tags: collected };
};

const ec2: ServiceDefinition = {
  name: "ec2",
  protocol: "ec2",
  operations: {
    RunInstances,
    DescribeInstances,
    TerminateInstances,
    StartInstances,
    StopInstances,
    CreateVpc,
    DescribeVpcs,
    DeleteVpc,
    CreateSecurityGroup,
    DescribeSecurityGroups,
    CreateTags,
    DescribeTags,
  },
  model,
} as const;

export default ec2;
