import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/memorydb.json", { with: { type: "json" } }),
  { targetPrefix: "AmazonMemoryDB" },
);

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
  ParameterGroupName: string | undefined;
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

type StoredParameterGroup = {
  Name: string;
  Family: string;
  Description: string | undefined;
  ARN: string;
};

type StoredSnapshot = {
  Name: string;
  Status: string;
  Source: string;
  KmsKeyId: string | undefined;
  ARN: string;
  ClusterConfiguration: {
    Name: string;
    Description: string | undefined;
    NodeType: string;
    EngineVersion: string;
    NumShards: number;
  };
};

type StoredUser = {
  Name: string;
  Status: string;
  AccessString: string;
  ACLNames: string[];
  MinimumEngineVersion: string;
  Authentication: { Type: string; PasswordCount: number };
  ARN: string;
};

type StoredACL = {
  Name: string;
  Status: string;
  UserNames: string[];
  MinimumEngineVersion: string;
  ARN: string;
};

type StoredMultiRegionCluster = {
  MultiRegionClusterName: string;
  Description: string | undefined;
  Status: string;
  NodeType: string;
  Engine: string;
  EngineVersion: string;
  NumberOfShards: number;
  MultiRegionParameterGroupName: string | undefined;
  TLSEnabled: boolean;
  ARN: string;
};

type StoredReservedNode = {
  ReservationId: string;
  ReservedNodesOfferingId: string;
  NodeType: string;
  Duration: number;
  FixedPrice: number;
  NodeCount: number;
  OfferingType: string;
  State: string;
  ARN: string;
};

type StoredTag = { Key: string; Value: string };

const clusterKey = (name: string): string => `cluster/${name}`;
const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;
const parameterGroupKey = (name: string): string => `parametergroup/${name}`;
const snapshotKey = (name: string): string => `snapshot/${name}`;
const userKey = (name: string): string => `user/${name}`;
const aclKey = (name: string): string => `acl/${name}`;
const multiRegionClusterKey = (name: string): string =>
  `multiregioncluster/${name}`;
const reservedNodeKey = (id: string): string => `reservednode/${id}`;
const tagKey = (arn: string): string => `tags/${arn}`;
const paramValuesKey = (pgName: string): string => `paramvalues/${pgName}`;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
  let startIndex = 0;
  if (typeof nextToken === "string" && nextToken !== "") {
    const parsed = parseInt(nextToken, 10);
    if (isNaN(parsed)) {
      throw awsError(
        "InvalidNextTokenException",
        "The NextToken value is invalid.",
        400,
      );
    }
    startIndex = parsed;
  }
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

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

const parameterGroupArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:parametergroup/${name}`;

const snapshotArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:snapshot/${name}`;

const userArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:user/${name}`;

const aclArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:acl/${name}`;

const multiRegionClusterArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:multiregioncluster/${name}`;

const reservedNodeArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:memorydb:${ctx.region}:${ctx.account}:reservednode/${id}`;

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
  const pg = ctx.store.get<StoredParameterGroup>(parameterGroupKey(name));
  if (pg === undefined) {
    throw awsError(
      "ParameterGroupNotFoundFault",
      `Parameter group not found: ${name}`,
      400,
    );
  }
  return pg;
};

const requireSnapshot = (ctx: ServiceContext, name: string): StoredSnapshot => {
  const snap = ctx.store.get<StoredSnapshot>(snapshotKey(name));
  if (snap === undefined) {
    throw awsError("SnapshotNotFoundFault", `Snapshot not found: ${name}`, 400);
  }
  return snap;
};

const requireUser = (ctx: ServiceContext, name: string): StoredUser => {
  const user = ctx.store.get<StoredUser>(userKey(name));
  if (user === undefined) {
    throw awsError("UserNotFoundFault", `User not found: ${name}`, 400);
  }
  return user;
};

const requireACL = (ctx: ServiceContext, name: string): StoredACL => {
  const acl = ctx.store.get<StoredACL>(aclKey(name));
  if (acl === undefined) {
    throw awsError("ACLNotFoundFault", `ACL not found: ${name}`, 400);
  }
  return acl;
};

const requireMultiRegionCluster = (
  ctx: ServiceContext,
  name: string,
): StoredMultiRegionCluster => {
  const mrc = ctx.store.get<StoredMultiRegionCluster>(
    multiRegionClusterKey(name),
  );
  if (mrc === undefined) {
    throw awsError(
      "MultiRegionClusterNotFoundFault",
      `Multi-region cluster not found: ${name}`,
      400,
    );
  }
  return mrc;
};

const tagsFromInput = (input: Record<string, unknown>): StoredTag[] => {
  if (!Array.isArray(input["Tags"])) return [];
  return (input["Tags"] as unknown[]).flatMap((t) => {
    if (
      typeof t === "object" &&
      t !== null &&
      "Key" in t &&
      typeof (t as Record<string, unknown>)["Key"] === "string"
    ) {
      return [
        {
          Key: (t as Record<string, unknown>)["Key"] as string,
          Value:
            typeof (t as Record<string, unknown>)["Value"] === "string"
              ? ((t as Record<string, unknown>)["Value"] as string)
              : "",
        },
      ];
    }
    return [];
  });
};

const CreateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  const nodeType = requireString(input, "NodeType");
  const aclName = requireString(input, "ACLName");
  requireACL(ctx, aclName);
  const subnetGroupName = stringOrUndefined(input["SubnetGroupName"]);
  if (subnetGroupName !== undefined) {
    requireSubnetGroup(ctx, subnetGroupName);
  }
  const parameterGroupName = stringOrUndefined(input["ParameterGroupName"]);
  if (parameterGroupName !== undefined) {
    requireParameterGroup(ctx, parameterGroupName);
  }
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
    ACLName: aclName,
    SubnetGroupName: subnetGroupName,
    ParameterGroupName: parameterGroupName,
    ARN: clusterArn(ctx, name),
    ClusterEndpoint: {
      Address: `clustercfg.${name}.memorydb.${ctx.region}.amazonaws.com`,
      Port: 6379,
    },
  };
  ctx.store.set(clusterKey(name), cluster);
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(cluster.ARN), tags);
  }
  return { Cluster: { ...cluster, Status: "creating" } };
};

const buildShards = (numShards: number) => {
  const totalSlots = 16384;
  const slotsPerShard = Math.floor(totalSlots / numShards);
  return Array.from({ length: numShards }, (_, i) => {
    const start = i * slotsPerShard;
    const end =
      i === numShards - 1 ? totalSlots - 1 : start + slotsPerShard - 1;
    return {
      Name: String(i + 1).padStart(4, "0"),
      Status: "available" as const,
      Slots: `${start}-${end}`,
      Nodes: [],
      NumberOfNodes: 1,
    };
  });
};

const DescribeClusters: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ClusterName"]);
  const showShardDetails = input["ShowShardDetails"] === true;
  const allClusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .filter((cluster) => name === undefined || cluster.Name === name);
  if (name !== undefined && allClusters.length === 0) {
    throw awsError("ClusterNotFoundFault", `Cluster not found: ${name}`, 400);
  }
  const { items, nextToken } = paginateList(
    allClusters,
    input["NextToken"],
    input["MaxResults"],
  );
  const clusters = showShardDetails
    ? items.map((c) => ({ ...c, Shards: buildShards(c.NumberOfShards) }))
    : items;
  return { Clusters: clusters, NextToken: nextToken };
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
  ctx.store.delete(tagKey(cluster.ARN));
  return { Cluster: { ...cluster, Status: "deleting" } };
};

const BatchUpdateCluster: OperationHandler = (input, ctx) => {
  const clusterNames = Array.isArray(input["ClusterNames"])
    ? (input["ClusterNames"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const processed: StoredCluster[] = [];
  const unprocessed: {
    ClusterName: string;
    ErrorType: string;
    ErrorMessage: string;
  }[] = [];
  for (const name of clusterNames) {
    const cluster = ctx.store.get<StoredCluster>(clusterKey(name));
    if (cluster !== undefined) {
      processed.push(cluster);
    } else {
      unprocessed.push({
        ClusterName: name,
        ErrorType: "ClusterNotFoundFault",
        ErrorMessage: `Cluster not found: ${name}`,
      });
    }
  }
  return { ProcessedClusters: processed, UnprocessedClusters: unprocessed };
};

const FailoverShard: OperationHandler = (input, ctx) => {
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
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(subnetGroup.ARN), tags);
  }
  return { SubnetGroup: subnetGroup };
};

const DeleteSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubnetGroupName");
  const sg = requireSubnetGroup(ctx, name);
  const inUse = ctx.store
    .list<StoredCluster>()
    .some(
      (entry) =>
        entry.key.startsWith("cluster/") &&
        entry.value.SubnetGroupName === name,
    );
  if (inUse) {
    throw awsError(
      "SubnetGroupInUseFault",
      `Subnet group is in use by a cluster: ${name}`,
      400,
    );
  }
  ctx.store.delete(subnetGroupKey(name));
  ctx.store.delete(tagKey(sg.ARN));
  return { SubnetGroup: sg };
};

const DescribeSubnetGroups: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["SubnetGroupName"]);
  const allGroups = ctx.store
    .list<StoredSubnetGroup>()
    .filter((entry) => entry.key.startsWith("subnetgroup/"))
    .map((entry) => entry.value)
    .filter((sg) => name === undefined || sg.Name === name);
  if (name !== undefined && allGroups.length === 0) {
    throw awsError(
      "SubnetGroupNotFoundFault",
      `Subnet group not found: ${name}`,
      400,
    );
  }
  const { items, nextToken } = paginateList(
    allGroups,
    input["NextToken"],
    input["MaxResults"],
  );
  return { SubnetGroups: items, NextToken: nextToken };
};

const UpdateSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubnetGroupName");
  const sg = requireSubnetGroup(ctx, name);
  const subnetIds = Array.isArray(input["SubnetIds"])
    ? (input["SubnetIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : sg.Subnets.map((s) => s.Identifier);
  const updated: StoredSubnetGroup = {
    ...sg,
    Description: stringOrUndefined(input["Description"]) ?? sg.Description,
    Subnets: subnetIds.map((identifier) => ({ Identifier: identifier })),
  };
  ctx.store.set(subnetGroupKey(name), updated);
  return { SubnetGroup: updated };
};

const CreateParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const family = requireString(input, "Family");
  if (
    ctx.store.get<StoredParameterGroup>(parameterGroupKey(name)) !== undefined
  ) {
    throw awsError(
      "ParameterGroupAlreadyExistsFault",
      `Parameter group already exists: ${name}`,
      400,
    );
  }
  const pg: StoredParameterGroup = {
    Name: name,
    Family: family,
    Description: stringOrUndefined(input["Description"]),
    ARN: parameterGroupArn(ctx, name),
  };
  ctx.store.set(parameterGroupKey(name), pg);
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(pg.ARN), tags);
  }
  return { ParameterGroup: pg };
};

const DeleteParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const pg = requireParameterGroup(ctx, name);
  const inUse = ctx.store
    .list<StoredCluster>()
    .some(
      (entry) =>
        entry.key.startsWith("cluster/") &&
        entry.value.ParameterGroupName === name,
    );
  if (inUse) {
    throw awsError(
      "InvalidParameterGroupStateFault",
      `Parameter group is in use by a cluster: ${name}`,
      400,
    );
  }
  ctx.store.delete(parameterGroupKey(name));
  ctx.store.delete(tagKey(pg.ARN));
  return { ParameterGroup: pg };
};

const DescribeParameterGroups: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ParameterGroupName"]);
  const allGroups = ctx.store
    .list<StoredParameterGroup>()
    .filter((entry) => entry.key.startsWith("parametergroup/"))
    .map((entry) => entry.value)
    .filter((pg) => name === undefined || pg.Name === name);
  if (name !== undefined && allGroups.length === 0) {
    throw awsError(
      "ParameterGroupNotFoundFault",
      `Parameter group not found: ${name}`,
      400,
    );
  }
  const { items, nextToken } = paginateList(
    allGroups,
    input["NextToken"],
    input["MaxResults"],
  );
  return { ParameterGroups: items, NextToken: nextToken };
};

const defaultParameters: Record<
  string,
  {
    Description: string;
    DataType: string;
    AllowedValues: string;
    MinimumEngineVersion: string;
    defaultValue: string;
  }
> = {
  "maxmemory-policy": {
    Description: "Max memory policy",
    DataType: "string",
    AllowedValues:
      "noeviction,allkeys-lru,volatile-lru,allkeys-random,volatile-random,volatile-ttl",
    MinimumEngineVersion: "6.0",
    defaultValue: "noeviction",
  },
} as const;

const DescribeParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  requireParameterGroup(ctx, name);
  const overrides =
    ctx.store.get<Record<string, string>>(paramValuesKey(name)) ?? {};
  const Parameters = Object.entries(defaultParameters).map(([pName, meta]) => ({
    Name: pName,
    Value: overrides[pName] ?? meta.defaultValue,
    Description: meta.Description,
    DataType: meta.DataType,
    AllowedValues: meta.AllowedValues,
    MinimumEngineVersion: meta.MinimumEngineVersion,
  }));
  return { Parameters };
};

const ResetParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const pg = requireParameterGroup(ctx, name);
  const allParameters = input["AllParameters"] === true;
  if (allParameters) {
    ctx.store.delete(paramValuesKey(name));
  } else {
    const paramNames = Array.isArray(input["ParameterNames"])
      ? (input["ParameterNames"] as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [];
    if (paramNames.length > 0) {
      const overrides =
        ctx.store.get<Record<string, string>>(paramValuesKey(name)) ?? {};
      const remaining = Object.fromEntries(
        Object.entries(overrides).filter(([k]) => !paramNames.includes(k)),
      );
      ctx.store.set(paramValuesKey(name), remaining);
    }
  }
  return { ParameterGroup: pg };
};

const UpdateParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const pg = requireParameterGroup(ctx, name);
  const nameValues = Array.isArray(input["ParameterNameValues"])
    ? (input["ParameterNameValues"] as unknown[]).flatMap((nv) => {
        if (
          typeof nv === "object" &&
          nv !== null &&
          typeof (nv as Record<string, unknown>)["ParameterName"] ===
            "string" &&
          typeof (nv as Record<string, unknown>)["ParameterValue"] === "string"
        ) {
          return [
            [
              (nv as Record<string, unknown>)["ParameterName"] as string,
              (nv as Record<string, unknown>)["ParameterValue"] as string,
            ] as [string, string],
          ];
        }
        return [];
      })
    : [];
  if (nameValues.length > 0) {
    const existing =
      ctx.store.get<Record<string, string>>(paramValuesKey(name)) ?? {};
    ctx.store.set(paramValuesKey(name), {
      ...existing,
      ...Object.fromEntries(nameValues),
    });
  }
  return { ParameterGroup: pg };
};

const CreateSnapshot: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "ClusterName");
  const snapshotName = requireString(input, "SnapshotName");
  const cluster = requireCluster(ctx, clusterName);
  if (ctx.store.get<StoredSnapshot>(snapshotKey(snapshotName)) !== undefined) {
    throw awsError(
      "SnapshotAlreadyExistsFault",
      `Snapshot already exists: ${snapshotName}`,
      400,
    );
  }
  const snap: StoredSnapshot = {
    Name: snapshotName,
    Status: "available",
    Source: "manual",
    KmsKeyId: stringOrUndefined(input["KmsKeyId"]),
    ARN: snapshotArn(ctx, snapshotName),
    ClusterConfiguration: {
      Name: cluster.Name,
      Description: cluster.Description,
      NodeType: cluster.NodeType,
      EngineVersion: cluster.EngineVersion,
      NumShards: cluster.NumberOfShards,
    },
  };
  ctx.store.set(snapshotKey(snapshotName), snap);
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(snap.ARN), tags);
  }
  return { Snapshot: { ...snap, Status: "creating" } };
};

const CopySnapshot: OperationHandler = (input, ctx) => {
  const sourceName = requireString(input, "SourceSnapshotName");
  const targetName = requireString(input, "TargetSnapshotName");
  const source = requireSnapshot(ctx, sourceName);
  if (ctx.store.get<StoredSnapshot>(snapshotKey(targetName)) !== undefined) {
    throw awsError(
      "SnapshotAlreadyExistsFault",
      `Snapshot already exists: ${targetName}`,
      400,
    );
  }
  const snap: StoredSnapshot = {
    ...source,
    Name: targetName,
    ARN: snapshotArn(ctx, targetName),
    KmsKeyId: stringOrUndefined(input["KmsKeyId"]) ?? source.KmsKeyId,
  };
  ctx.store.set(snapshotKey(targetName), snap);
  const inputTags = tagsFromInput(input);
  const sourceTags = ctx.store.get<StoredTag[]>(tagKey(source.ARN)) ?? [];
  const mergedTags = [
    ...sourceTags.filter((st) => !inputTags.some((it) => it.Key === st.Key)),
    ...inputTags,
  ];
  if (mergedTags.length > 0) {
    ctx.store.set(tagKey(snap.ARN), mergedTags);
  }
  return { Snapshot: snap };
};

const DeleteSnapshot: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SnapshotName");
  const snap = requireSnapshot(ctx, name);
  ctx.store.delete(snapshotKey(name));
  ctx.store.delete(tagKey(snap.ARN));
  return { Snapshot: { ...snap, Status: "deleting" } };
};

const DescribeSnapshots: OperationHandler = (input, ctx) => {
  const clusterName = stringOrUndefined(input["ClusterName"]);
  const snapshotName = stringOrUndefined(input["SnapshotName"]);
  const sourceFilter = stringOrUndefined(input["Source"]);
  const allSnapshots = ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .map((entry) => entry.value)
    .filter((s) => snapshotName === undefined || s.Name === snapshotName)
    .filter(
      (s) =>
        clusterName === undefined ||
        s.ClusterConfiguration.Name === clusterName,
    )
    .filter((s) => sourceFilter === undefined || s.Source === sourceFilter);
  if (snapshotName !== undefined && allSnapshots.length === 0) {
    throw awsError(
      "SnapshotNotFoundFault",
      `Snapshot not found: ${snapshotName}`,
      400,
    );
  }
  const { items, nextToken } = paginateList(
    allSnapshots,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Snapshots: items, NextToken: nextToken };
};

const CreateUser: OperationHandler = (input, ctx) => {
  const name = requireString(input, "UserName");
  const accessString = requireString(input, "AccessString");
  if (ctx.store.get<StoredUser>(userKey(name)) !== undefined) {
    throw awsError(
      "UserAlreadyExistsFault",
      `User already exists: ${name}`,
      400,
    );
  }
  const authMode = input["AuthenticationMode"];
  const passwordCount =
    typeof authMode === "object" &&
    authMode !== null &&
    Array.isArray((authMode as Record<string, unknown>)["Passwords"])
      ? ((authMode as Record<string, unknown>)["Passwords"] as unknown[]).length
      : 1;
  const authType =
    typeof authMode === "object" &&
    authMode !== null &&
    typeof (authMode as Record<string, unknown>)["Type"] === "string"
      ? ((authMode as Record<string, unknown>)["Type"] as string)
      : "password";
  const user: StoredUser = {
    Name: name,
    Status: "active",
    AccessString: accessString,
    ACLNames: [],
    MinimumEngineVersion: "6.0",
    Authentication: { Type: authType, PasswordCount: passwordCount },
    ARN: userArn(ctx, name),
  };
  ctx.store.set(userKey(name), user);
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(user.ARN), tags);
  }
  return { User: user };
};

const DeleteUser: OperationHandler = (input, ctx) => {
  const name = requireString(input, "UserName");
  const user = requireUser(ctx, name);
  if (user.ACLNames.length > 0) {
    throw awsError(
      "InvalidUserStateFault",
      `User is associated with ACLs: ${name}`,
      400,
    );
  }
  ctx.store.delete(userKey(name));
  ctx.store.delete(tagKey(user.ARN));
  return { User: { ...user, Status: "deleting" } };
};

const DescribeUsers: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["UserName"]);
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as unknown[]).flatMap((f) => {
        if (
          typeof f === "object" &&
          f !== null &&
          typeof (f as Record<string, unknown>)["Name"] === "string" &&
          Array.isArray((f as Record<string, unknown>)["Values"])
        ) {
          return [
            {
              name: (f as Record<string, unknown>)["Name"] as string,
              values: (
                (f as Record<string, unknown>)["Values"] as unknown[]
              ).filter((v): v is string => typeof v === "string"),
            },
          ];
        }
        return [];
      })
    : [];
  const aclFilter = filters.find((f) => f.name === "ACLName");
  const allUsers = ctx.store
    .list<StoredUser>()
    .filter((entry) => entry.key.startsWith("user/"))
    .map((entry) => entry.value)
    .filter((u) => name === undefined || u.Name === name)
    .filter(
      (u) =>
        aclFilter === undefined ||
        aclFilter.values.some((aclName) => u.ACLNames.includes(aclName)),
    );
  if (name !== undefined && allUsers.length === 0) {
    throw awsError("UserNotFoundFault", `User not found: ${name}`, 400);
  }
  const { items, nextToken } = paginateList(
    allUsers,
    input["NextToken"],
    input["MaxResults"],
  );
  return { Users: items, NextToken: nextToken };
};

const UpdateUser: OperationHandler = (input, ctx) => {
  const name = requireString(input, "UserName");
  const user = requireUser(ctx, name);
  const authMode = input["AuthenticationMode"];
  const passwordCount =
    typeof authMode === "object" &&
    authMode !== null &&
    Array.isArray((authMode as Record<string, unknown>)["Passwords"])
      ? ((authMode as Record<string, unknown>)["Passwords"] as unknown[]).length
      : user.Authentication.PasswordCount;
  const authType =
    typeof authMode === "object" &&
    authMode !== null &&
    typeof (authMode as Record<string, unknown>)["Type"] === "string"
      ? ((authMode as Record<string, unknown>)["Type"] as string)
      : user.Authentication.Type;
  const updated: StoredUser = {
    ...user,
    AccessString: stringOrUndefined(input["AccessString"]) ?? user.AccessString,
    Authentication: { Type: authType, PasswordCount: passwordCount },
  };
  ctx.store.set(userKey(name), updated);
  return { User: updated };
};

const CreateACL: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ACLName");
  if (ctx.store.get<StoredACL>(aclKey(name)) !== undefined) {
    throw awsError("ACLAlreadyExistsFault", `ACL already exists: ${name}`, 400);
  }
  const userNames = Array.isArray(input["UserNames"])
    ? (input["UserNames"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const acl: StoredACL = {
    Name: name,
    Status: "active",
    UserNames: userNames,
    MinimumEngineVersion: "6.0",
    ARN: aclArn(ctx, name),
  };
  ctx.store.set(aclKey(name), acl);
  for (const userName of userNames) {
    const u = ctx.store.get<StoredUser>(userKey(userName));
    if (u !== undefined && !u.ACLNames.includes(name)) {
      ctx.store.set(userKey(userName), {
        ...u,
        ACLNames: [...u.ACLNames, name],
      });
    }
  }
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(acl.ARN), tags);
  }
  return { ACL: acl };
};

const DeleteACL: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ACLName");
  const acl = requireACL(ctx, name);
  const inUse = ctx.store
    .list<StoredCluster>()
    .some(
      (entry) =>
        entry.key.startsWith("cluster/") && entry.value.ACLName === name,
    );
  if (inUse) {
    throw awsError(
      "InvalidACLStateFault",
      `ACL is associated with a cluster: ${name}`,
      400,
    );
  }
  for (const userName of acl.UserNames) {
    const u = ctx.store.get<StoredUser>(userKey(userName));
    if (u !== undefined) {
      ctx.store.set(userKey(userName), {
        ...u,
        ACLNames: u.ACLNames.filter((a) => a !== name),
      });
    }
  }
  ctx.store.delete(aclKey(name));
  ctx.store.delete(tagKey(acl.ARN));
  return { ACL: { ...acl, Status: "deleting" } };
};

const DescribeACLs: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["ACLName"]);
  const allAcls = ctx.store
    .list<StoredACL>()
    .filter((entry) => entry.key.startsWith("acl/"))
    .map((entry) => entry.value)
    .filter((a) => name === undefined || a.Name === name);
  if (name !== undefined && allAcls.length === 0) {
    throw awsError("ACLNotFoundFault", `ACL not found: ${name}`, 400);
  }
  const { items, nextToken } = paginateList(
    allAcls,
    input["NextToken"],
    input["MaxResults"],
  );
  return { ACLs: items, NextToken: nextToken };
};

const UpdateACL: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ACLName");
  const acl = requireACL(ctx, name);
  const toAdd = Array.isArray(input["UserNamesToAdd"])
    ? (input["UserNamesToAdd"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const toRemove = new Set(
    Array.isArray(input["UserNamesToRemove"])
      ? (input["UserNamesToRemove"] as unknown[]).filter(
          (v): v is string => typeof v === "string",
        )
      : [],
  );
  const updatedUsers = [
    ...acl.UserNames.filter((u) => !toRemove.has(u)),
    ...toAdd.filter((u) => !acl.UserNames.includes(u)),
  ];
  const updated: StoredACL = { ...acl, UserNames: updatedUsers };
  ctx.store.set(aclKey(name), updated);
  for (const userName of toAdd) {
    const u = ctx.store.get<StoredUser>(userKey(userName));
    if (u !== undefined && !u.ACLNames.includes(name)) {
      ctx.store.set(userKey(userName), {
        ...u,
        ACLNames: [...u.ACLNames, name],
      });
    }
  }
  for (const userName of toRemove) {
    const u = ctx.store.get<StoredUser>(userKey(userName));
    if (u !== undefined) {
      ctx.store.set(userKey(userName), {
        ...u,
        ACLNames: u.ACLNames.filter((a) => a !== name),
      });
    }
  }
  return { ACL: updated };
};

const CreateMultiRegionCluster: OperationHandler = (input, ctx) => {
  const nameSuffix = requireString(input, "MultiRegionClusterNameSuffix");
  const nodeType = requireString(input, "NodeType");
  const fullName = `cluster-${nameSuffix}`;
  if (
    ctx.store.get<StoredMultiRegionCluster>(multiRegionClusterKey(fullName)) !==
    undefined
  ) {
    throw awsError(
      "MultiRegionClusterAlreadyExistsFault",
      `Multi-region cluster already exists: ${fullName}`,
      400,
    );
  }
  const mrc: StoredMultiRegionCluster = {
    MultiRegionClusterName: fullName,
    Description: stringOrUndefined(input["Description"]),
    Status: "available",
    NodeType: nodeType,
    Engine: stringOrUndefined(input["Engine"]) ?? "redis",
    EngineVersion: stringOrUndefined(input["EngineVersion"]) ?? "7.1",
    NumberOfShards:
      typeof input["NumShards"] === "number" ? input["NumShards"] : 1,
    MultiRegionParameterGroupName: stringOrUndefined(
      input["MultiRegionParameterGroupName"],
    ),
    TLSEnabled:
      typeof input["TLSEnabled"] === "boolean" ? input["TLSEnabled"] : true,
    ARN: multiRegionClusterArn(ctx, fullName),
  };
  ctx.store.set(multiRegionClusterKey(fullName), mrc);
  const tags = tagsFromInput(input);
  if (tags.length > 0) {
    ctx.store.set(tagKey(mrc.ARN), tags);
  }
  return { MultiRegionCluster: { ...mrc, Status: "creating" } };
};

const DeleteMultiRegionCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MultiRegionClusterName");
  const mrc = requireMultiRegionCluster(ctx, name);
  ctx.store.delete(multiRegionClusterKey(name));
  ctx.store.delete(tagKey(mrc.ARN));
  return { MultiRegionCluster: { ...mrc, Status: "deleting" } };
};

const DescribeMultiRegionClusters: OperationHandler = (input, ctx) => {
  const name = stringOrUndefined(input["MultiRegionClusterName"]);
  const allClusters = ctx.store
    .list<StoredMultiRegionCluster>()
    .filter((entry) => entry.key.startsWith("multiregioncluster/"))
    .map((entry) => entry.value)
    .filter((mrc) => name === undefined || mrc.MultiRegionClusterName === name);
  if (name !== undefined && allClusters.length === 0) {
    throw awsError(
      "MultiRegionClusterNotFoundFault",
      `Multi-region cluster not found: ${name}`,
      400,
    );
  }
  const { items, nextToken } = paginateList(
    allClusters,
    input["NextToken"],
    input["MaxResults"],
  );
  return { MultiRegionClusters: items, NextToken: nextToken };
};

const UpdateMultiRegionCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MultiRegionClusterName");
  const mrc = requireMultiRegionCluster(ctx, name);
  const updated: StoredMultiRegionCluster = {
    ...mrc,
    Description: stringOrUndefined(input["Description"]) ?? mrc.Description,
    NodeType: stringOrUndefined(input["NodeType"]) ?? mrc.NodeType,
    EngineVersion:
      stringOrUndefined(input["EngineVersion"]) ?? mrc.EngineVersion,
    MultiRegionParameterGroupName:
      stringOrUndefined(input["MultiRegionParameterGroupName"]) ??
      mrc.MultiRegionParameterGroupName,
  };
  ctx.store.set(multiRegionClusterKey(name), updated);
  return { MultiRegionCluster: updated };
};

const DescribeEngineVersions: OperationHandler = (_input, _ctx) => {
  return {
    EngineVersions: [
      {
        Engine: "redis",
        EngineVersion: "7.1",
        EnginePatchVersion: "7.1.0",
        ParameterGroupFamily: "memorydb_redis7",
      },
      {
        Engine: "redis",
        EngineVersion: "7.0",
        EnginePatchVersion: "7.0.7",
        ParameterGroupFamily: "memorydb_redis7",
      },
      {
        Engine: "redis",
        EngineVersion: "6.2",
        EnginePatchVersion: "6.2.6",
        ParameterGroupFamily: "memorydb_redis6",
      },
    ],
  };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return { Events: [] };
};

const DescribeMultiRegionParameterGroups: OperationHandler = (_input, _ctx) => {
  return { MultiRegionParameterGroups: [] };
};

const DescribeMultiRegionParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MultiRegionParameterGroupName");
  void ctx;
  void name;
  return { MultiRegionParameters: [] };
};

const DescribeReservedNodes: OperationHandler = (input, ctx) => {
  const reservationId = stringOrUndefined(input["ReservationId"]);
  const allNodes = ctx.store
    .list<StoredReservedNode>()
    .filter((entry) => entry.key.startsWith("reservednode/"))
    .map((entry) => entry.value)
    .filter(
      (n) => reservationId === undefined || n.ReservationId === reservationId,
    );
  if (reservationId !== undefined && allNodes.length === 0) {
    throw awsError(
      "ReservedNodeNotFoundFault",
      `Reserved node not found: ${reservationId}`,
      400,
    );
  }
  const { items, nextToken } = paginateList(
    allNodes,
    input["NextToken"],
    input["MaxResults"],
  );
  return { ReservedNodes: items, NextToken: nextToken };
};

const DescribeReservedNodesOfferings: OperationHandler = (_input, _ctx) => {
  return {
    ReservedNodesOfferings: [
      {
        ReservedNodesOfferingId: "offering-db-r6g-large-1yr",
        NodeType: "db.r6g.large",
        Duration: 31536000,
        FixedPrice: 1000.0,
        OfferingType: "No Upfront",
        RecurringCharges: [
          { RecurringChargeAmount: 0.1, RecurringChargeFrequency: "Hourly" },
        ],
      },
    ],
  };
};

const DescribeServiceUpdates: OperationHandler = (_input, _ctx) => {
  return { ServiceUpdates: [] };
};

const ListAllowedNodeTypeUpdates: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterName");
  requireCluster(ctx, name);
  return {
    ScaleUpNodeTypes: ["db.r6g.xlarge", "db.r6g.2xlarge"],
    ScaleDownNodeTypes: ["db.t4g.small"],
  };
};

const ListAllowedMultiRegionClusterUpdates: OperationHandler = (input, ctx) => {
  const name = requireString(input, "MultiRegionClusterName");
  requireMultiRegionCluster(ctx, name);
  return {
    ScaleUpNodeTypes: ["db.r6g.xlarge", "db.r6g.2xlarge"],
    ScaleDownNodeTypes: ["db.t4g.small"],
  };
};

const PurchaseReservedNodesOffering: OperationHandler = (input, ctx) => {
  const offeringId = requireString(input, "ReservedNodesOfferingId");
  const reservationId =
    stringOrUndefined(input["ReservationId"]) ??
    `ri-${crypto.randomUUID().slice(0, 8)}`;
  if (
    ctx.store.get<StoredReservedNode>(reservedNodeKey(reservationId)) !==
    undefined
  ) {
    throw awsError(
      "ReservedNodeAlreadyExistsFault",
      `Reserved node already exists: ${reservationId}`,
      400,
    );
  }
  const nodeCount =
    typeof input["NodeCount"] === "number" ? input["NodeCount"] : 1;
  const node: StoredReservedNode = {
    ReservationId: reservationId,
    ReservedNodesOfferingId: offeringId,
    NodeType: "db.r6g.large",
    Duration: 31536000,
    FixedPrice: 1000.0,
    NodeCount: nodeCount,
    OfferingType: "No Upfront",
    State: "active",
    ARN: reservedNodeArn(ctx, reservationId),
  };
  ctx.store.set(reservedNodeKey(reservationId), node);
  return { ReservedNode: node };
};

const ListTags: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  void ctx;
  const tags = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
  return { TagList: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const newTags = tagsFromInput(input);
  const existing = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
  const merged = [
    ...existing.filter((e) => !newTags.some((n) => n.Key === e.Key)),
    ...newTags,
  ];
  ctx.store.set(tagKey(arn), merged);
  return { TagList: merged };
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as unknown[]).filter(
        (v): v is string => typeof v === "string",
      )
    : [];
  const existing = ctx.store.get<StoredTag[]>(tagKey(arn)) ?? [];
  const remaining = existing.filter((t) => !tagKeys.includes(t.Key));
  ctx.store.set(tagKey(arn), remaining);
  return { TagList: remaining };
};

const memorydb = {
  name: "memorydb",
  protocol: "json",
  operations: {
    BatchUpdateCluster,
    CopySnapshot,
    CreateACL,
    CreateCluster,
    CreateMultiRegionCluster,
    CreateParameterGroup,
    CreateSnapshot,
    CreateSubnetGroup,
    CreateUser,
    DeleteACL,
    DeleteCluster,
    DeleteMultiRegionCluster,
    DeleteParameterGroup,
    DeleteSnapshot,
    DeleteSubnetGroup,
    DeleteUser,
    DescribeACLs,
    DescribeClusters,
    DescribeEngineVersions,
    DescribeEvents,
    DescribeMultiRegionClusters,
    DescribeMultiRegionParameterGroups,
    DescribeMultiRegionParameters,
    DescribeParameterGroups,
    DescribeParameters,
    DescribeReservedNodes,
    DescribeReservedNodesOfferings,
    DescribeServiceUpdates,
    DescribeSnapshots,
    DescribeSubnetGroups,
    DescribeUsers,
    FailoverShard,
    ListAllowedMultiRegionClusterUpdates,
    ListAllowedNodeTypeUpdates,
    ListTags,
    PurchaseReservedNodesOffering,
    ResetParameterGroup,
    TagResource,
    UntagResource,
    UpdateACL,
    UpdateCluster,
    UpdateMultiRegionCluster,
    UpdateParameterGroup,
    UpdateSubnetGroup,
    UpdateUser,
  },
  model,
} as const satisfies ServiceDefinition;

export default memorydb;
