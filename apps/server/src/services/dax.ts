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
  ParameterGroupName: string | undefined;
};

type StoredSubnetGroup = {
  SubnetGroupName: string;
  Description: string | undefined;
  VpcId: string;
  Subnets: { SubnetIdentifier: string }[];
};

type StoredParameterGroup = {
  ParameterGroupName: string;
  Description: string | undefined;
};

type StoredTags = Record<string, string>;

const clusterKey = (name: string): string => `cluster/${name}`;
const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;
const paramGroupKey = (name: string): string => `paramgroup/${name}`;
const tagKey = (arn: string): string => `tags/${arn}`;

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

const requireSubnetGroup = (
  ctx: ServiceContext,
  name: string,
): StoredSubnetGroup => {
  const sg = ctx.store.get<StoredSubnetGroup>(subnetGroupKey(name));
  if (sg === undefined) {
    throw awsError(
      "SubnetGroupNotFoundFault",
      `Subnet group not found: ${name}`,
      400,
    );
  }
  return sg;
};

const requireParameterGroup = (
  ctx: ServiceContext,
  name: string,
): StoredParameterGroup => {
  const pg = ctx.store.get<StoredParameterGroup>(paramGroupKey(name));
  if (pg === undefined) {
    throw awsError(
      "ParameterGroupNotFoundFault",
      `Parameter group not found: ${name}`,
      400,
    );
  }
  return pg;
};

const staticParameters = [
  {
    ParameterName: "query-ttl-millis",
    ParameterValue: "300000",
    ParameterType: "DEFAULT",
    Source: "system",
    DataType: "integer",
    IsModifiable: "TRUE",
    ChangeType: "IMMEDIATE",
    Description: "The TTL (in milliseconds) for query cache entries.",
    AllowedValues: "1-3600000",
  },
  {
    ParameterName: "record-ttl-millis",
    ParameterValue: "300000",
    ParameterType: "DEFAULT",
    Source: "system",
    DataType: "integer",
    IsModifiable: "TRUE",
    ChangeType: "IMMEDIATE",
    Description: "The TTL (in milliseconds) for record cache entries.",
    AllowedValues: "1-3600000",
  },
] as const;

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
    ParameterGroupName: stringOrUndefined(input["ParameterGroupName"]),
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

const UpdateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const cluster = requireCluster(ctx, name);
  const updated: StoredCluster = { ...cluster };
  if (input["Description"] !== undefined) {
    updated.Description = stringOrUndefined(input["Description"]);
  }
  if (input["ParameterGroupName"] !== undefined) {
    updated.ParameterGroupName = stringOrUndefined(input["ParameterGroupName"]);
  }
  ctx.store.set(clusterKey(name), updated);
  return { Cluster: updated };
};

const IncreaseReplicationFactor: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const cluster = requireCluster(ctx, name);
  const newFactor =
    typeof input["NewReplicationFactor"] === "number"
      ? input["NewReplicationFactor"]
      : cluster.TotalNodes;
  const updated: StoredCluster = {
    ...cluster,
    TotalNodes: newFactor,
    ActiveNodes: newFactor,
  };
  ctx.store.set(clusterKey(name), updated);
  return { Cluster: updated };
};

const DecreaseReplicationFactor: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const cluster = requireCluster(ctx, name);
  const newFactor =
    typeof input["NewReplicationFactor"] === "number"
      ? input["NewReplicationFactor"]
      : cluster.TotalNodes;
  const updated: StoredCluster = {
    ...cluster,
    TotalNodes: newFactor,
    ActiveNodes: newFactor,
  };
  ctx.store.set(clusterKey(name), updated);
  return { Cluster: updated };
};

const RebootNode: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const cluster = requireCluster(ctx, name);
  return { Cluster: cluster };
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

const UpdateSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubnetGroupName");
  const sg = requireSubnetGroup(ctx, name);
  const updated: StoredSubnetGroup = {
    ...sg,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : sg.Description,
    Subnets: Array.isArray(input["SubnetIds"])
      ? stringList(input["SubnetIds"]).map((id) => ({
          SubnetIdentifier: id,
        }))
      : sg.Subnets,
  };
  ctx.store.set(subnetGroupKey(name), updated);
  return { SubnetGroup: updated };
};

const DeleteSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubnetGroupName");
  requireSubnetGroup(ctx, name);
  ctx.store.delete(subnetGroupKey(name));
  return { DeletionMessage: `SubnetGroup ${name} has been deleted.` };
};

const CreateParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  if (ctx.store.get<StoredParameterGroup>(paramGroupKey(name)) !== undefined) {
    throw awsError(
      "ParameterGroupAlreadyExistsFault",
      `Parameter group already exists: ${name}`,
      400,
    );
  }
  const pg: StoredParameterGroup = {
    ParameterGroupName: name,
    Description: stringOrUndefined(input["Description"]),
  };
  ctx.store.set(paramGroupKey(name), pg);
  return { ParameterGroup: pg };
};

const UpdateParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const pg = requireParameterGroup(ctx, name);
  return { ParameterGroup: pg };
};

const DeleteParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  requireParameterGroup(ctx, name);
  ctx.store.delete(paramGroupKey(name));
  return { DeletionMessage: `ParameterGroup ${name} has been deleted.` };
};

const DescribeParameterGroups: OperationHandler = (input, ctx) => {
  const names = stringList(input["ParameterGroupNames"]);
  const pgs = ctx.store
    .list<StoredParameterGroup>()
    .filter((entry) => entry.key.startsWith("paramgroup/"))
    .map((entry) => entry.value)
    .filter(
      (pg) => names.length === 0 || names.includes(pg.ParameterGroupName),
    );
  return { ParameterGroups: pgs };
};

const DescribeParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  requireParameterGroup(ctx, name);
  return { Parameters: staticParameters };
};

const DescribeDefaultParameters: OperationHandler = (_input, _ctx) => {
  return { Parameters: staticParameters };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return { Events: [] };
};

const ListTags: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceName");
  const tags = ctx.store.get<StoredTags>(tagKey(arn)) ?? {};
  const tagList = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
  return { Tags: tagList };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceName");
  const newTags = Array.isArray(input["Tags"])
    ? (input["Tags"] as { Key?: unknown; Value?: unknown }[])
    : [];
  const existing = ctx.store.get<StoredTags>(tagKey(arn)) ?? {};
  const merged: StoredTags = { ...existing };
  for (const tag of newTags) {
    if (typeof tag.Key === "string") {
      merged[tag.Key] = typeof tag.Value === "string" ? tag.Value : "";
    }
  }
  ctx.store.set(tagKey(arn), merged);
  const tagList = Object.entries(merged).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { Tags: tagList };
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceName");
  const keys = stringList(input["TagKeys"]);
  const existing = ctx.store.get<StoredTags>(tagKey(arn)) ?? {};
  const updated: StoredTags = { ...existing };
  for (const key of keys) {
    delete updated[key];
  }
  ctx.store.set(tagKey(arn), updated);
  const tagList = Object.entries(updated).map(([Key, Value]) => ({
    Key,
    Value,
  }));
  return { Tags: tagList };
};

const dax = {
  name: "dax",
  protocol: "json",
  operations: {
    CreateCluster,
    DescribeClusters,
    DeleteCluster,
    UpdateCluster,
    IncreaseReplicationFactor,
    DecreaseReplicationFactor,
    RebootNode,
    CreateSubnetGroup,
    DescribeSubnetGroups,
    UpdateSubnetGroup,
    DeleteSubnetGroup,
    CreateParameterGroup,
    UpdateParameterGroup,
    DeleteParameterGroup,
    DescribeParameterGroups,
    DescribeParameters,
    DescribeDefaultParameters,
    DescribeEvents,
    ListTags,
    TagResource,
    UntagResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default dax;
