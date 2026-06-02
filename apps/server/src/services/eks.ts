import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import eksModel from "../../../../test/vendor/aws-models/eks.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(eksModel);

type StoredCluster = {
  name: string;
  arn: string;
  createdAt: number;
  version: string;
  endpoint: string;
  roleArn: string;
  resourcesVpcConfig: Record<string, unknown> | undefined;
  kubernetesNetworkConfig: Record<string, unknown> | undefined;
  logging: Record<string, unknown> | undefined;
  status: string;
  platformVersion: string;
  tags: Record<string, string>;
  certificateAuthority: Record<string, unknown>;
  identity: Record<string, unknown>;
};

type StoredNodegroup = {
  nodegroupName: string;
  nodegroupArn: string;
  clusterName: string;
  version: string;
  releaseVersion: string;
  createdAt: number;
  modifiedAt: number;
  status: string;
  capacityType: string | undefined;
  scalingConfig: Record<string, unknown>;
  instanceTypes: string[];
  subnets: string[];
  amiType: string | undefined;
  nodeRole: string;
  labels: Record<string, string>;
  diskSize: number | undefined;
  tags: Record<string, string>;
};

const clusterKey = (name: string): string => `cluster/${name}`;

const nodegroupKey = (cluster: string, nodegroup: string): string =>
  `nodegroup/${cluster}/${nodegroup}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const stringListFrom = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const stringMapFrom = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  const record = asRecord(value);
  if (record === undefined) return out;
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
};

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("InvalidParameterException", `${field} is required.`, 400);
  }
  return value;
};

const clusterArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:eks:${ctx.region}:${ctx.account}:cluster/${name}`;

const nodegroupArnOf = (
  ctx: ServiceContext,
  cluster: string,
  nodegroup: string,
): string =>
  `arn:aws:eks:${ctx.region}:${ctx.account}:nodegroup/${cluster}/${nodegroup}/${crypto.randomUUID()}`;

const endpointOf = (ctx: ServiceContext, id: string): string =>
  `https://${id}.gr7.${ctx.region}.eks.amazonaws.com`;

const clusterView = (cluster: StoredCluster): Record<string, unknown> => ({
  name: cluster.name,
  arn: cluster.arn,
  createdAt: cluster.createdAt,
  version: cluster.version,
  endpoint: cluster.endpoint,
  roleArn: cluster.roleArn,
  resourcesVpcConfig: cluster.resourcesVpcConfig,
  kubernetesNetworkConfig: cluster.kubernetesNetworkConfig,
  logging: cluster.logging,
  identity: cluster.identity,
  status: cluster.status,
  certificateAuthority: cluster.certificateAuthority,
  platformVersion: cluster.platformVersion,
  tags: cluster.tags,
});

const nodegroupView = (
  nodegroup: StoredNodegroup,
): Record<string, unknown> => ({
  nodegroupName: nodegroup.nodegroupName,
  nodegroupArn: nodegroup.nodegroupArn,
  clusterName: nodegroup.clusterName,
  version: nodegroup.version,
  releaseVersion: nodegroup.releaseVersion,
  createdAt: nodegroup.createdAt,
  modifiedAt: nodegroup.modifiedAt,
  status: nodegroup.status,
  capacityType: nodegroup.capacityType,
  scalingConfig: nodegroup.scalingConfig,
  instanceTypes: nodegroup.instanceTypes,
  subnets: nodegroup.subnets,
  amiType: nodegroup.amiType,
  nodeRole: nodegroup.nodeRole,
  labels: nodegroup.labels,
  diskSize: nodegroup.diskSize,
  tags: nodegroup.tags,
});

const requireCluster = (ctx: ServiceContext, name: string): StoredCluster => {
  const stored = ctx.store.get<StoredCluster>(clusterKey(name));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No cluster found for name: ${name}.`,
      404,
    );
  }
  return stored;
};

const CreateCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const roleArn = requireString(input, "roleArn");
  if (ctx.store.get<StoredCluster>(clusterKey(name)) !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Cluster already exists with name: ${name}.`,
      409,
    );
  }
  const id = crypto.randomUUID();
  const cluster: StoredCluster = {
    name,
    arn: clusterArnOf(ctx, name),
    createdAt: nowSeconds(),
    version: stringOrUndefined(input["version"]) ?? "1.31",
    endpoint: endpointOf(ctx, id.replace(/-/g, "").slice(0, 32).toUpperCase()),
    roleArn,
    resourcesVpcConfig: asRecord(input["resourcesVpcConfig"]),
    kubernetesNetworkConfig: asRecord(input["kubernetesNetworkConfig"]),
    logging: asRecord(input["logging"]),
    status: "ACTIVE",
    platformVersion: "eks.1",
    tags: stringMapFrom(input["tags"]),
    certificateAuthority: { data: btoa(`bunsai-ca-${name}`) },
    identity: { oidc: { issuer: endpointOf(ctx, id) } },
  };
  ctx.store.set(clusterKey(name), cluster);
  return { cluster: clusterView(cluster) };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cluster = requireCluster(ctx, name);
  return { cluster: clusterView(cluster) };
};

const ListClusters: OperationHandler = (_input, ctx) => {
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { clusters: clusters.map((cluster) => cluster.name) };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cluster = requireCluster(ctx, name);
  ctx.store.delete(clusterKey(name));
  return { cluster: clusterView({ ...cluster, status: "DELETING" }) };
};

const CreateNodegroup: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const nodegroupName = requireString(input, "nodegroupName");
  const nodeRole = requireString(input, "nodeRole");
  requireCluster(ctx, clusterName);
  if (
    ctx.store.get<StoredNodegroup>(nodegroupKey(clusterName, nodegroupName)) !==
    undefined
  ) {
    throw awsError(
      "ResourceInUseException",
      `NodeGroup already exists with name ${nodegroupName} and cluster name ${clusterName}.`,
      409,
    );
  }
  const at = nowSeconds();
  const nodegroup: StoredNodegroup = {
    nodegroupName,
    nodegroupArn: nodegroupArnOf(ctx, clusterName, nodegroupName),
    clusterName,
    version: stringOrUndefined(input["version"]) ?? "1.31",
    releaseVersion: stringOrUndefined(input["releaseVersion"]) ?? "1.31.0",
    createdAt: at,
    modifiedAt: at,
    status: "ACTIVE",
    capacityType: stringOrUndefined(input["capacityType"]) ?? "ON_DEMAND",
    scalingConfig: asRecord(input["scalingConfig"]) ?? {
      minSize: 1,
      maxSize: 2,
      desiredSize: 2,
    },
    instanceTypes: stringListFrom(input["instanceTypes"]),
    subnets: stringListFrom(input["subnets"]),
    amiType: stringOrUndefined(input["amiType"]) ?? "AL2_x86_64",
    nodeRole,
    labels: stringMapFrom(input["labels"]),
    diskSize: numberOrUndefined(input["diskSize"]) ?? 20,
    tags: stringMapFrom(input["tags"]),
  };
  ctx.store.set(nodegroupKey(clusterName, nodegroupName), nodegroup);
  return { nodegroup: nodegroupView(nodegroup) };
};

const DescribeNodegroup: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const nodegroupName = requireString(input, "nodegroupName");
  const stored = ctx.store.get<StoredNodegroup>(
    nodegroupKey(clusterName, nodegroupName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No node group found for name: ${nodegroupName}.`,
      404,
    );
  }
  return { nodegroup: nodegroupView(stored) };
};

const ListNodegroups: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const nodegroups = ctx.store
    .list<StoredNodegroup>()
    .filter((entry) => entry.key.startsWith(`nodegroup/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.nodegroupName.localeCompare(b.nodegroupName));
  return { nodegroups: nodegroups.map((nodegroup) => nodegroup.nodegroupName) };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const eks = {
  name: "eks",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "clusters") return undefined;
    if (parts.length === 1) {
      if (req.method === "POST") return "CreateCluster";
      if (req.method === "GET") return "ListClusters";
      return undefined;
    }
    if (parts.length === 2) {
      if (req.method === "GET") return "DescribeCluster";
      if (req.method === "DELETE") return "DeleteCluster";
      return undefined;
    }
    if (parts.length === 3 && parts[2] === "node-groups") {
      if (req.method === "POST") return "CreateNodegroup";
      if (req.method === "GET") return "ListNodegroups";
      return undefined;
    }
    if (parts.length === 4 && parts[2] === "node-groups") {
      if (req.method === "GET") return "DescribeNodegroup";
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateCluster,
    DescribeCluster,
    ListClusters,
    DeleteCluster,
    CreateNodegroup,
    DescribeNodegroup,
    ListNodegroups,
  },
  model,
} as const satisfies ServiceDefinition;

export default eks;
