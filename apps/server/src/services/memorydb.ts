import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import memorydbModel from "../../../../test/vendor/aws-models/memorydb.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(memorydbModel);

type StoredCluster = {
  Name: string;
  Description: string | undefined;
  Status: string;
  NodeType: string;
  NumberOfShards: number;
  Engine: string;
  EngineVersion: string;
  ACLName: string;
  SubnetGroupName: string | undefined;
  ARN: string;
  ClusterEndpoint: { Address: string; Port: number };
};

type StoredSubnetGroup = {
  Name: string;
  Description: string | undefined;
  VpcId: string;
  Subnets: { Identifier: string }[];
  ARN: string;
};

const clusterKey = (name: string): string => `cluster/${name}`;
const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "InvalidParameterValueException",
      `${key} is required.`,
      400,
    );
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const clusterArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:cluster/${name}`;

const subnetGroupArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:subnetgroup/${name}`;

const requireCluster = (ctx: ServiceContext, name: string): StoredCluster => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
  if (cluster === undefined) {
    throw awsError("ClusterNotFoundFault", `Cluster not found: ${name}`, 400);
  }
  return cluster;
};

const CreateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const nodeType = requireString(input, "NodeType");
  requireString(input, "ACLName");
  if (ctx.store.get<StoredCluster>(clusterKey(name)) !== undefined) {
    throw awsError(
      "ClusterAlreadyExistsFault",
      `Cluster already exists: ${name}`,
      400,
    );
  }
  const cluster: StoredCluster = {
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    Status: "available",
    NodeType: nodeType,
    NumberOfShards:
      typeof input["NumShards"] === "number" ? input["NumShards"] : 1,
    Engine: stringOrUndefined(input["Engine"]) ?? "redis",
    EngineVersion: stringOrUndefined(input["EngineVersion"]) ?? "7.1",
    ACLName: requireString(input, "ACLName"),
    SubnetGroupName: stringOrUndefined(input["SubnetGroupName"]),
    ARN: clusterArn(ctx, name),
    ClusterEndpoint: {
      Address: `clustercfg.${name}.memorydb.${ctx.region}.amazonaws.com`,
      Port: 6379,
    },
  };
  ctx.store.set(clusterKey(name), cluster);
  return { Cluster: cluster };
};

const DescribeClusters: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ClusterName"]);
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .filter((cluster) => name === undefined || cluster.Name === name);
  if (name !== undefined && clusters.length === 0) {
    throw awsError("ClusterNotFoundFault", `Cluster not found: ${name}`, 400);
  }
  return { Clusters: clusters };
};

const UpdateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const cluster = requireCluster(ctx, name);
  const updated: StoredCluster = {
    ...cluster,
    Description: stringOrUndefined(input["Description"]) ?? cluster.Description,
    NodeType: stringOrUndefined(input["NodeType"]) ?? cluster.NodeType,
    EngineVersion:
      stringOrUndefined(input["EngineVersion"]) ?? cluster.EngineVersion,
    ACLName: stringOrUndefined(input["ACLName"]) ?? cluster.ACLName,
  };
  ctx.store.set(clusterKey(name), updated);
  return { Cluster: updated };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const cluster = requireCluster(ctx, name);
  ctx.store.delete(clusterKey(name));
  return { Cluster: { ...cluster, Status: "deleting" } };
};

const CreateSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubnetGroupName");
  if (ctx.store.get<StoredSubnetGroup>(subnetGroupKey(name)) !== undefined) {
    throw awsError(
      "SubnetGroupAlreadyExistsFault",
      `Subnet group already exists: ${name}`,
      400,
    );
  }
  const subnetIds = Array.isArray(input["SubnetIds"])
    ? (input["SubnetIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const subnetGroup: StoredSubnetGroup = {
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    VpcId: `vpc-${crypto.randomUUID().slice(0, 8)}`,
    Subnets: subnetIds.map((identifier) => ({ Identifier: identifier })),
    ARN: subnetGroupArn(ctx, name),
  };
  ctx.store.set(subnetGroupKey(name), subnetGroup);
  return { SubnetGroup: subnetGroup };
};

const memorydb = {
  name: "memorydb",
  protocol: "json",
  operations: {
    CreateCluster,
    DescribeClusters,
    UpdateCluster,
    DeleteCluster,
    CreateSubnetGroup,
  },
  model,
} as const satisfies ServiceDefinition;

export default memorydb;
