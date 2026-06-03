import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import daxModel from "../../../../test/vendor/aws-models/dax.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(daxModel);

type StoredCluster = {
  ClusterName: string;
  Description: string | undefined;
  ClusterArn: string;
  TotalNodes: number;
  ActiveNodes: number;
  NodeType: string;
  Status: string;
  ClusterDiscoveryEndpoint: { Address: string; Port: number };
  IamRoleArn: string;
  SubnetGroup: string | undefined;
};

type StoredSubnetGroup = {
  SubnetGroupName: string;
  Description: string | undefined;
  VpcId: string;
  Subnets: { SubnetIdentifier: string }[];
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

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

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
  const iamRoleArn = requireString(input, "IamRoleArn");
  if (ctx.store.get<StoredCluster>(clusterKey(name)) !== undefined) {
    throw awsError(
      "ClusterAlreadyExistsFault",
      `Cluster already exists: ${name}`,
      400,
    );
  }
  const replicationFactor =
    typeof input["ReplicationFactor"] === "number"
      ? input["ReplicationFactor"]
      : 1;
  const cluster: StoredCluster = {
    ClusterName: name,
    Description: stringOrUndefined(input["Description"]),
    ClusterArn: `arn:aws:dax:${ctx.region}:${ctx.account}:cache/${name}`,
    TotalNodes: replicationFactor,
    ActiveNodes: replicationFactor,
    NodeType: nodeType,
    Status: "available",
    ClusterDiscoveryEndpoint: {
      Address: `${name}.dax-clusters.${ctx.region}.amazonaws.com`,
      Port: 8111,
    },
    IamRoleArn: iamRoleArn,
    SubnetGroup: stringOrUndefined(input["SubnetGroupName"]),
  };
  ctx.store.set(clusterKey(name), cluster);
  return { Cluster: cluster };
};

const DescribeClusters: OperationHandler = (input, ctx) => {
  const names = stringList(input["ClusterNames"]);
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .filter(
      (cluster) => names.length === 0 || names.includes(cluster.ClusterName),
    );
  return { Clusters: clusters };
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
  const subnetGroup: StoredSubnetGroup = {
    SubnetGroupName: name,
    Description: stringOrUndefined(input["Description"]),
    VpcId: `vpc-${crypto.randomUUID().slice(0, 8)}`,
    Subnets: stringList(input["SubnetIds"]).map((identifier) => ({
      SubnetIdentifier: identifier,
    })),
  };
  ctx.store.set(subnetGroupKey(name), subnetGroup);
  return { SubnetGroup: subnetGroup };
};

const DescribeSubnetGroups: OperationHandler = (input, ctx) => {
  const names = stringList(input["SubnetGroupNames"]);
  const subnetGroups = ctx.store
    .list<StoredSubnetGroup>()
    .filter((entry) => entry.key.startsWith("subnetgroup/"))
    .map((entry) => entry.value)
    .filter(
      (group) => names.length === 0 || names.includes(group.SubnetGroupName),
    );
  return { SubnetGroups: subnetGroups };
};

const dax = {
  name: "dax",
  protocol: "json",
  operations: {
    CreateCluster,
    DescribeClusters,
    DeleteCluster,
    CreateSubnetGroup,
    DescribeSubnetGroups,
  },
  model,
} as const satisfies ServiceDefinition;

export default dax;
