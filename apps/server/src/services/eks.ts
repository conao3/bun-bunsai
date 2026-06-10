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
  connectorConfig: Record<string, unknown> | undefined;
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

type StoredFargateProfile = {
  fargateProfileName: string;
  fargateProfileArn: string;
  clusterName: string;
  createdAt: number;
  podExecutionRoleArn: string;
  subnets: string[];
  selectors: Record<string, unknown>[];
  status: string;
  tags: Record<string, string>;
  health: Record<string, unknown>;
};

type StoredAddon = {
  addonName: string;
  clusterName: string;
  status: string;
  addonVersion: string;
  health: Record<string, unknown>;
  addonArn: string;
  createdAt: number;
  modifiedAt: number;
  serviceAccountRoleArn: string | undefined;
  tags: Record<string, string>;
  configurationValues: string | undefined;
};

type StoredAccessEntry = {
  clusterName: string;
  principalArn: string;
  kubernetesGroups: string[];
  accessEntryArn: string;
  createdAt: number;
  modifiedAt: number;
  tags: Record<string, string>;
  username: string;
  type: string;
  accessPolicies: StoredAssociatedAccessPolicy[];
};

type StoredAssociatedAccessPolicy = {
  policyArn: string;
  accessScope: Record<string, unknown>;
  associatedAt: number;
  modifiedAt: number;
};

type StoredPodIdentityAssociation = {
  clusterName: string;
  namespace: string;
  serviceAccount: string;
  roleArn: string;
  associationArn: string;
  associationId: string;
  tags: Record<string, string>;
  createdAt: number;
  modifiedAt: number;
  disableSessionTags: boolean | undefined;
  targetRoleArn: string | undefined;
  policy: string | undefined;
};

type StoredIdentityProviderConfig = {
  clusterName: string;
  type: string;
  name: string;
  identityProviderConfigArn: string;
  issuerUrl: string;
  clientId: string;
  usernameClaim: string | undefined;
  usernamePrefix: string | undefined;
  groupsClaim: string | undefined;
  groupsPrefix: string | undefined;
  requiredClaims: Record<string, string>;
  tags: Record<string, string>;
  status: string;
  updateId: string | undefined;
};

type StoredUpdate = {
  id: string;
  status: string;
  type: string;
  params: Record<string, unknown>[];
  createdAt: number;
  errors: Record<string, unknown>[];
  clusterName: string;
  nodegroupName: string | undefined;
  addonName: string | undefined;
  capabilityName: string | undefined;
};

type StoredInsight = {
  id: string;
  clusterName: string;
  name: string;
  category: string;
  kubernetesVersion: string;
  lastRefreshTime: number;
  lastTransitionTime: number;
  description: string;
  insightStatus: Record<string, unknown>;
  recommendation: string;
  additionalInfo: Record<string, unknown>;
  resources: unknown[];
  categorySpecificSummary: Record<string, unknown>;
};

type StoredInsightsRefresh = {
  clusterName: string;
  status: string;
  startedAt: number;
  endedAt: number | undefined;
};

type StoredEksAnywhereSubscription = {
  id: string;
  arn: string;
  createdAt: number;
  licenseQuantity: number;
  licenseType: string;
  term: Record<string, unknown>;
  status: string;
  autoRenew: boolean;
  licenseArns: string[];
  tags: Record<string, string>;
  name: string;
};

type StoredCapability = {
  capabilityName: string;
  arn: string;
  clusterName: string;
  type: string;
  roleArn: string;
  status: string;
  version: string;
  tags: Record<string, string>;
  createdAt: number;
  modifiedAt: number;
  deletePropagationPolicy: string | undefined;
};

const clusterKey = (name: string): string => `cluster/${name}`;

const nodegroupKey = (cluster: string, nodegroup: string): string =>
  `nodegroup/${cluster}/${nodegroup}`;

const fargateKey = (cluster: string, profile: string): string =>
  `fargate/${cluster}/${profile}`;

const addonKey = (cluster: string, addon: string): string =>
  `addon/${cluster}/${addon}`;

const accessEntryKey = (cluster: string, principalArn: string): string =>
  `access-entry/${cluster}/${principalArn}`;

const podIdentityKey = (cluster: string, associationId: string): string =>
  `pod-identity/${cluster}/${associationId}`;

const idpConfigKey = (cluster: string, name: string): string =>
  `idp-config/${cluster}/${name}`;

const updateKey = (cluster: string, updateId: string): string =>
  `update/${cluster}/${updateId}`;

const subscriptionKey = (id: string): string =>
  `eks-anywhere-subscription/${id}`;

const capabilityKey = (cluster: string, capabilityName: string): string =>
  `capability/${cluster}/${capabilityName}`;

const tagsKey = (resourceArn: string): string => `tags/${resourceArn}`;

const insightKey = (clusterName: string, id: string): string =>
  `insight/${clusterName}/${id}`;

const insightsRefreshKey = (clusterName: string): string =>
  `insights-refresh/${clusterName}`;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const boolOrUndefined = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

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

const paginateList = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
  getKey: (item: T) => string,
): { page: T[]; nextToken: string | undefined } => {
  let start = 0;
  if (nextToken !== undefined) {
    const cursor = atob(nextToken);
    const idx = items.findIndex((item) => getKey(item) > cursor);
    start = idx === -1 ? items.length : idx;
  }
  const max = maxResults ?? items.length;
  const page = items.slice(start, start + max);
  const next =
    start + max < items.length
      ? btoa(getKey(page[page.length - 1]))
      : undefined;
  return { page, nextToken: next };
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
  connectorConfig: cluster.connectorConfig,
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

const accessEntryView = (
  entry: StoredAccessEntry,
): Record<string, unknown> => ({
  clusterName: entry.clusterName,
  principalArn: entry.principalArn,
  kubernetesGroups: entry.kubernetesGroups,
  accessEntryArn: entry.accessEntryArn,
  createdAt: entry.createdAt,
  modifiedAt: entry.modifiedAt,
  tags: entry.tags,
  username: entry.username,
  type: entry.type,
});

const associatedPolicyView = (
  p: StoredAssociatedAccessPolicy,
): Record<string, unknown> => ({
  policyArn: p.policyArn,
  accessScope: p.accessScope,
  associatedAt: p.associatedAt,
  modifiedAt: p.modifiedAt,
});

const podIdentityView = (
  assoc: StoredPodIdentityAssociation,
): Record<string, unknown> => ({
  clusterName: assoc.clusterName,
  namespace: assoc.namespace,
  serviceAccount: assoc.serviceAccount,
  roleArn: assoc.roleArn,
  associationArn: assoc.associationArn,
  associationId: assoc.associationId,
  tags: assoc.tags,
  createdAt: assoc.createdAt,
  modifiedAt: assoc.modifiedAt,
  disableSessionTags: assoc.disableSessionTags,
  targetRoleArn: assoc.targetRoleArn,
  policy: assoc.policy,
});

const podIdentitySummaryView = (
  assoc: StoredPodIdentityAssociation,
): Record<string, unknown> => ({
  clusterName: assoc.clusterName,
  namespace: assoc.namespace,
  serviceAccount: assoc.serviceAccount,
  associationArn: assoc.associationArn,
  associationId: assoc.associationId,
});

const oidcIdpView = (
  cfg: StoredIdentityProviderConfig,
): Record<string, unknown> => ({
  identityProviderConfigName: cfg.name,
  identityProviderConfigArn: cfg.identityProviderConfigArn,
  clusterName: cfg.clusterName,
  issuerUrl: cfg.issuerUrl,
  clientId: cfg.clientId,
  usernameClaim: cfg.usernameClaim,
  usernamePrefix: cfg.usernamePrefix,
  groupsClaim: cfg.groupsClaim,
  groupsPrefix: cfg.groupsPrefix,
  requiredClaims: cfg.requiredClaims,
  tags: cfg.tags,
  status: cfg.status,
});

const updateView = (u: StoredUpdate): Record<string, unknown> => ({
  id: u.id,
  status: u.status,
  type: u.type,
  params: u.params,
  createdAt: u.createdAt,
  errors: u.errors,
});

const subscriptionView = (
  sub: StoredEksAnywhereSubscription,
): Record<string, unknown> => ({
  id: sub.id,
  arn: sub.arn,
  createdAt: sub.createdAt,
  licenseQuantity: sub.licenseQuantity,
  licenseType: sub.licenseType,
  term: sub.term,
  status: sub.status,
  autoRenew: sub.autoRenew,
  licenseArns: sub.licenseArns,
  tags: sub.tags,
  name: sub.name,
});

const capabilityView = (cap: StoredCapability): Record<string, unknown> => ({
  capabilityName: cap.capabilityName,
  arn: cap.arn,
  clusterName: cap.clusterName,
  type: cap.type,
  roleArn: cap.roleArn,
  status: cap.status,
  version: cap.version,
  tags: cap.tags,
  createdAt: cap.createdAt,
  modifiedAt: cap.modifiedAt,
  deletePropagationPolicy: cap.deletePropagationPolicy,
  health: { issues: [] },
});

const capabilitySummaryView = (
  cap: StoredCapability,
): Record<string, unknown> => ({
  capabilityName: cap.capabilityName,
  arn: cap.arn,
  type: cap.type,
  status: cap.status,
  version: cap.version,
  createdAt: cap.createdAt,
  modifiedAt: cap.modifiedAt,
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

const requireNodegroup = (
  ctx: ServiceContext,
  cluster: string,
  nodegroup: string,
): StoredNodegroup => {
  const stored = ctx.store.get<StoredNodegroup>(
    nodegroupKey(cluster, nodegroup),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No node group found for name: ${nodegroup}.`,
      404,
    );
  }
  return stored;
};

const storeUpdate = (
  ctx: ServiceContext,
  clusterName: string,
  type: string,
  params: Record<string, unknown>[],
  nodegroupName?: string,
  addonName?: string,
  capabilityName?: string,
): StoredUpdate => {
  const id = crypto.randomUUID();
  const update: StoredUpdate = {
    id,
    status: "Successful",
    type,
    params,
    createdAt: nowSeconds(),
    errors: [],
    clusterName,
    nodegroupName,
    addonName,
    capabilityName,
  };
  ctx.store.set(updateKey(clusterName, id), update);
  return update;
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
    status: "CREATING",
    platformVersion: "eks.1",
    tags: stringMapFrom(input["tags"]),
    certificateAuthority: { data: btoa(`bunsai-ca-${name}`) },
    identity: { oidc: { issuer: endpointOf(ctx, id) } },
    connectorConfig: undefined,
  };
  ctx.store.set(clusterKey(name), cluster);
  return { cluster: clusterView(cluster) };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cluster = requireCluster(ctx, name);
  if (cluster.status === "CREATING") {
    const updated = { ...cluster, status: "ACTIVE" };
    ctx.store.set(clusterKey(name), updated);
    return { cluster: clusterView(updated) };
  }
  if (cluster.status === "UPDATING") {
    const updated = { ...cluster, status: "ACTIVE" };
    ctx.store.set(clusterKey(name), updated);
    return { cluster: clusterView(cluster) };
  }
  return { cluster: clusterView(cluster) };
};

const ListClusters: OperationHandler = (input, ctx) => {
  const maxResults = numberOrUndefined(input["maxResults"]);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  const { page, nextToken: next } = paginateList(
    clusters,
    maxResults,
    nextToken,
    (c) => c.name,
  );
  return { clusters: page.map((c) => c.name), nextToken: next };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cluster = requireCluster(ctx, name);
  const hasNodegroups = ctx.store
    .list<StoredNodegroup>()
    .some((entry) => entry.key.startsWith(`nodegroup/${name}/`));
  if (hasNodegroups) {
    throw awsError(
      "ResourceInUseException",
      `Cluster has nodegroups attached. Remove all nodegroups before deleting the cluster.`,
      409,
    );
  }
  const hasFargate = ctx.store
    .list<StoredFargateProfile>()
    .some((entry) => entry.key.startsWith(`fargate/${name}/`));
  if (hasFargate) {
    throw awsError(
      "ResourceInUseException",
      `Cluster has Fargate profiles attached. Remove all Fargate profiles before deleting the cluster.`,
      409,
    );
  }
  ctx.store.delete(clusterKey(name));
  ctx.store.delete(tagsKey(cluster.arn));
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
    status: "CREATING",
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
  if (stored.status === "CREATING") {
    const updated = { ...stored, status: "ACTIVE" };
    ctx.store.set(nodegroupKey(clusterName, nodegroupName), updated);
    return { nodegroup: nodegroupView(updated) };
  }
  if (stored.status === "UPDATING") {
    const updated = { ...stored, status: "ACTIVE" };
    ctx.store.set(nodegroupKey(clusterName, nodegroupName), updated);
    return { nodegroup: nodegroupView(stored) };
  }
  return { nodegroup: nodegroupView(stored) };
};

const ListNodegroups: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const maxResults = numberOrUndefined(input["maxResults"]);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const nodegroups = ctx.store
    .list<StoredNodegroup>()
    .filter((entry) => entry.key.startsWith(`nodegroup/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.nodegroupName.localeCompare(b.nodegroupName));
  const { page, nextToken: next } = paginateList(
    nodegroups,
    maxResults,
    nextToken,
    (ng) => ng.nodegroupName,
  );
  return { nodegroups: page.map((ng) => ng.nodegroupName), nextToken: next };
};

const DeleteNodegroup: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const nodegroupName = requireString(input, "nodegroupName");
  const stored = requireNodegroup(ctx, clusterName, nodegroupName);
  ctx.store.delete(nodegroupKey(clusterName, nodegroupName));
  ctx.store.delete(tagsKey(stored.nodegroupArn));
  return { nodegroup: nodegroupView({ ...stored, status: "DELETING" }) };
};

const recordListFrom = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === "object" && entry !== null && !Array.isArray(entry),
      )
    : [];

const fargateArnOf = (
  ctx: ServiceContext,
  cluster: string,
  profile: string,
): string =>
  `arn:aws:eks:${ctx.region}:${ctx.account}:fargateprofile/${cluster}/${profile}/${crypto.randomUUID()}`;

const addonArnOf = (
  ctx: ServiceContext,
  cluster: string,
  addon: string,
): string =>
  `arn:aws:eks:${ctx.region}:${ctx.account}:addon/${cluster}/${addon}/${crypto.randomUUID()}`;

const fargateProfileView = (
  profile: StoredFargateProfile,
): Record<string, unknown> => ({
  fargateProfileName: profile.fargateProfileName,
  fargateProfileArn: profile.fargateProfileArn,
  clusterName: profile.clusterName,
  createdAt: profile.createdAt,
  podExecutionRoleArn: profile.podExecutionRoleArn,
  subnets: profile.subnets,
  selectors: profile.selectors,
  status: profile.status,
  tags: profile.tags,
  health:
    profile.status === "ACTIVE"
      ? profile.health
      : {
          issues: [
            {
              code: "InternalFailure",
              message: "Fargate profile is being provisioned",
              resourceIds: [],
            },
          ],
        },
});

const addonView = (addon: StoredAddon): Record<string, unknown> => ({
  addonName: addon.addonName,
  clusterName: addon.clusterName,
  status: addon.status,
  addonVersion: addon.addonVersion,
  health:
    addon.status === "ACTIVE"
      ? addon.health
      : {
          issues: [
            {
              code: "InsufficientNumberOfReplicas",
              message: "Addon is being provisioned",
              resourceIds: [],
            },
          ],
        },
  addonArn: addon.addonArn,
  createdAt: addon.createdAt,
  modifiedAt: addon.modifiedAt,
  serviceAccountRoleArn: addon.serviceAccountRoleArn,
  tags: addon.tags,
  configurationValues: addon.configurationValues,
});

const CreateFargateProfile: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const fargateProfileName = requireString(input, "fargateProfileName");
  const podExecutionRoleArn = requireString(input, "podExecutionRoleArn");
  requireCluster(ctx, clusterName);
  if (
    ctx.store.get<StoredFargateProfile>(
      fargateKey(clusterName, fargateProfileName),
    ) !== undefined
  ) {
    throw awsError(
      "ResourceInUseException",
      `FargateProfile already exists with name ${fargateProfileName} and cluster name ${clusterName}.`,
      409,
    );
  }
  const profile: StoredFargateProfile = {
    fargateProfileName,
    fargateProfileArn: fargateArnOf(ctx, clusterName, fargateProfileName),
    clusterName,
    createdAt: nowSeconds(),
    podExecutionRoleArn,
    subnets: stringListFrom(input["subnets"]),
    selectors: recordListFrom(input["selectors"]),
    status: "CREATING",
    tags: stringMapFrom(input["tags"]),
    health: { issues: [] },
  };
  ctx.store.set(fargateKey(clusterName, fargateProfileName), profile);
  return { fargateProfile: fargateProfileView(profile) };
};

const DescribeFargateProfile: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const fargateProfileName = requireString(input, "fargateProfileName");
  const stored = ctx.store.get<StoredFargateProfile>(
    fargateKey(clusterName, fargateProfileName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No Fargate Profile found with name: ${fargateProfileName}.`,
      404,
    );
  }
  if (stored.status === "CREATING") {
    const updated = { ...stored, status: "ACTIVE" };
    ctx.store.set(fargateKey(clusterName, fargateProfileName), updated);
    return { fargateProfile: fargateProfileView(updated) };
  }
  return { fargateProfile: fargateProfileView(stored) };
};

const ListFargateProfiles: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const maxResults = numberOrUndefined(input["maxResults"]);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const profiles = ctx.store
    .list<StoredFargateProfile>()
    .filter((entry) => entry.key.startsWith(`fargate/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.fargateProfileName.localeCompare(b.fargateProfileName));
  const { page, nextToken: next } = paginateList(
    profiles,
    maxResults,
    nextToken,
    (p) => p.fargateProfileName,
  );
  return {
    fargateProfileNames: page.map((p) => p.fargateProfileName),
    nextToken: next,
  };
};

const DeleteFargateProfile: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const fargateProfileName = requireString(input, "fargateProfileName");
  const stored = ctx.store.get<StoredFargateProfile>(
    fargateKey(clusterName, fargateProfileName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No Fargate Profile found with name: ${fargateProfileName}.`,
      404,
    );
  }
  ctx.store.delete(fargateKey(clusterName, fargateProfileName));
  ctx.store.delete(tagsKey(stored.fargateProfileArn));
  return {
    fargateProfile: fargateProfileView({ ...stored, status: "DELETING" }),
  };
};

const CreateAddon: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const addonName = requireString(input, "addonName");
  requireCluster(ctx, clusterName);
  if (
    ctx.store.get<StoredAddon>(addonKey(clusterName, addonName)) !== undefined
  ) {
    throw awsError(
      "ResourceInUseException",
      `Addon already exists with name ${addonName} and cluster name ${clusterName}.`,
      409,
    );
  }
  const at = nowSeconds();
  const addon: StoredAddon = {
    addonName,
    clusterName,
    status: "CREATING",
    addonVersion:
      stringOrUndefined(input["addonVersion"]) ?? "v1.0.0-eksbuild.1",
    health: { issues: [] },
    addonArn: addonArnOf(ctx, clusterName, addonName),
    createdAt: at,
    modifiedAt: at,
    serviceAccountRoleArn: stringOrUndefined(input["serviceAccountRoleArn"]),
    tags: stringMapFrom(input["tags"]),
    configurationValues: stringOrUndefined(input["configurationValues"]),
  };
  ctx.store.set(addonKey(clusterName, addonName), addon);
  return { addon: addonView(addon) };
};

const DescribeAddon: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const addonName = requireString(input, "addonName");
  const stored = ctx.store.get<StoredAddon>(addonKey(clusterName, addonName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No addon found with name: ${addonName}.`,
      404,
    );
  }
  if (stored.status === "CREATING") {
    const updated = { ...stored, status: "ACTIVE" };
    ctx.store.set(addonKey(clusterName, addonName), updated);
    return { addon: addonView(updated) };
  }
  return { addon: addonView(stored) };
};

const ListAddons: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const maxResults = numberOrUndefined(input["maxResults"]);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const addons = ctx.store
    .list<StoredAddon>()
    .filter((entry) => entry.key.startsWith(`addon/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.addonName.localeCompare(b.addonName));
  const { page, nextToken: next } = paginateList(
    addons,
    maxResults,
    nextToken,
    (a) => a.addonName,
  );
  return { addons: page.map((a) => a.addonName), nextToken: next };
};

const DeleteAddon: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const addonName = requireString(input, "addonName");
  const stored = ctx.store.get<StoredAddon>(addonKey(clusterName, addonName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No addon found with name: ${addonName}.`,
      404,
    );
  }
  ctx.store.delete(addonKey(clusterName, addonName));
  ctx.store.delete(tagsKey(stored.addonArn));
  return { addon: addonView({ ...stored, status: "DELETING" }) };
};

const UpdateAddon: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const addonName = requireString(input, "addonName");
  const stored = ctx.store.get<StoredAddon>(addonKey(clusterName, addonName));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No addon found with name: ${addonName}.`,
      404,
    );
  }
  const updated: StoredAddon = {
    ...stored,
    modifiedAt: nowSeconds(),
    addonVersion:
      stringOrUndefined(input["addonVersion"]) ?? stored.addonVersion,
    serviceAccountRoleArn:
      stringOrUndefined(input["serviceAccountRoleArn"]) ??
      stored.serviceAccountRoleArn,
    configurationValues:
      stringOrUndefined(input["configurationValues"]) ??
      stored.configurationValues,
  };
  ctx.store.set(addonKey(clusterName, addonName), updated);
  const update = storeUpdate(
    ctx,
    clusterName,
    "AddonUpdate",
    [],
    undefined,
    addonName,
  );
  return { update: updateView(update) };
};

const DescribeAddonVersions: OperationHandler = (_input, _ctx) => {
  return {
    addons: [
      {
        addonName: "vpc-cni",
        type: "networking",
        addonVersions: [
          {
            addonVersion: "v1.18.1-eksbuild.1",
            architecture: ["amd64"],
            computeTypes: ["nodeGroups"],
            compatibilities: [
              {
                clusterVersion: "1.31",
                platformVersions: ["*"],
                defaultVersion: true,
              },
            ],
            requiresConfiguration: false,
            requiresIamPermissions: true,
          },
        ],
        marketplaceVersion: "",
        publisher: "eks",
        owner: "aws",
      },
      {
        addonName: "coredns",
        type: "networking",
        addonVersions: [
          {
            addonVersion: "v1.11.3-eksbuild.1",
            architecture: ["amd64"],
            computeTypes: ["nodeGroups"],
            compatibilities: [
              {
                clusterVersion: "1.31",
                platformVersions: ["*"],
                defaultVersion: true,
              },
            ],
            requiresConfiguration: false,
            requiresIamPermissions: false,
          },
        ],
        marketplaceVersion: "",
        publisher: "eks",
        owner: "aws",
      },
    ],
  };
};

const DescribeAddonConfiguration: OperationHandler = (input, _ctx) => {
  const addonName = requireString(input, "addonName");
  const addonVersion = requireString(input, "addonVersion");
  return {
    addonName,
    addonVersion,
    configurationSchema: "{}",
    podIdentityConfiguration: [],
  };
};

const CreateAccessEntry: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  requireCluster(ctx, clusterName);
  if (
    ctx.store.get<StoredAccessEntry>(
      accessEntryKey(clusterName, principalArn),
    ) !== undefined
  ) {
    throw awsError(
      "ResourceInUseException",
      `Access entry already exists for principal: ${principalArn}.`,
      409,
    );
  }
  const at = nowSeconds();
  const entry: StoredAccessEntry = {
    clusterName,
    principalArn,
    kubernetesGroups: stringListFrom(input["kubernetesGroups"]),
    accessEntryArn: `arn:aws:eks:${ctx.region}:${ctx.account}:access-entry/${clusterName}/${principalArn}`,
    createdAt: at,
    modifiedAt: at,
    tags: stringMapFrom(input["tags"]),
    username: stringOrUndefined(input["username"]) ?? "",
    type: stringOrUndefined(input["type"]) ?? "STANDARD",
    accessPolicies: [],
  };
  ctx.store.set(accessEntryKey(clusterName, principalArn), entry);
  return { accessEntry: accessEntryView(entry) };
};

const DescribeAccessEntry: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  const stored = ctx.store.get<StoredAccessEntry>(
    accessEntryKey(clusterName, principalArn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access entry found for principal: ${principalArn}.`,
      404,
    );
  }
  return { accessEntry: accessEntryView(stored) };
};

const ListAccessEntries: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const maxResults = numberOrUndefined(input["maxResults"]);
  const nextToken = stringOrUndefined(input["nextToken"]);
  const entries = ctx.store
    .list<StoredAccessEntry>()
    .filter((entry) => entry.key.startsWith(`access-entry/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.principalArn.localeCompare(b.principalArn));
  const { page, nextToken: next } = paginateList(
    entries,
    maxResults,
    nextToken,
    (e) => e.principalArn,
  );
  return { accessEntries: page.map((e) => e.principalArn), nextToken: next };
};

const DeleteAccessEntry: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  const stored = ctx.store.get<StoredAccessEntry>(
    accessEntryKey(clusterName, principalArn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access entry found for principal: ${principalArn}.`,
      404,
    );
  }
  ctx.store.delete(accessEntryKey(clusterName, principalArn));
  return {};
};

const UpdateAccessEntry: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  const stored = ctx.store.get<StoredAccessEntry>(
    accessEntryKey(clusterName, principalArn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access entry found for principal: ${principalArn}.`,
      404,
    );
  }
  const updated: StoredAccessEntry = {
    ...stored,
    modifiedAt: nowSeconds(),
    kubernetesGroups: Array.isArray(input["kubernetesGroups"])
      ? stringListFrom(input["kubernetesGroups"])
      : stored.kubernetesGroups,
    username: stringOrUndefined(input["username"]) ?? stored.username,
  };
  ctx.store.set(accessEntryKey(clusterName, principalArn), updated);
  return { accessEntry: accessEntryView(updated) };
};

const AssociateAccessPolicy: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  const policyArn = requireString(input, "policyArn");
  const stored = ctx.store.get<StoredAccessEntry>(
    accessEntryKey(clusterName, principalArn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access entry found for principal: ${principalArn}.`,
      404,
    );
  }
  const accessScope = asRecord(input["accessScope"]) ?? { type: "cluster" };
  const at = nowSeconds();
  const existing = stored.accessPolicies.findIndex(
    (p) => p.policyArn === policyArn,
  );
  const policy: StoredAssociatedAccessPolicy = {
    policyArn,
    accessScope,
    associatedAt: at,
    modifiedAt: at,
  };
  const newPolicies = [...stored.accessPolicies];
  if (existing >= 0) {
    newPolicies[existing] = policy;
  } else {
    newPolicies.push(policy);
  }
  ctx.store.set(accessEntryKey(clusterName, principalArn), {
    ...stored,
    accessPolicies: newPolicies,
  });
  return {
    clusterName,
    principalArn,
    associatedAccessPolicy: associatedPolicyView(policy),
  };
};

const DisassociateAccessPolicy: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  const policyArn = requireString(input, "policyArn");
  const stored = ctx.store.get<StoredAccessEntry>(
    accessEntryKey(clusterName, principalArn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access entry found for principal: ${principalArn}.`,
      404,
    );
  }
  const newPolicies = stored.accessPolicies.filter(
    (p) => p.policyArn !== policyArn,
  );
  ctx.store.set(accessEntryKey(clusterName, principalArn), {
    ...stored,
    accessPolicies: newPolicies,
  });
  return {};
};

const ListAssociatedAccessPolicies: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const principalArn = requireString(input, "principalArn");
  const stored = ctx.store.get<StoredAccessEntry>(
    accessEntryKey(clusterName, principalArn),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No access entry found for principal: ${principalArn}.`,
      404,
    );
  }
  return {
    clusterName,
    principalArn,
    associatedAccessPolicies: stored.accessPolicies.map(associatedPolicyView),
  };
};

const ListAccessPolicies: OperationHandler = (_input, _ctx) => {
  return {
    accessPolicies: [
      {
        name: "AmazonEKSClusterAdminPolicy",
        arn: "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy",
      },
      {
        name: "AmazonEKSAdminPolicy",
        arn: "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy",
      },
      {
        name: "AmazonEKSEditPolicy",
        arn: "arn:aws:eks::aws:cluster-access-policy/AmazonEKSEditPolicy",
      },
      {
        name: "AmazonEKSViewPolicy",
        arn: "arn:aws:eks::aws:cluster-access-policy/AmazonEKSViewPolicy",
      },
    ],
  };
};

const CreatePodIdentityAssociation: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const namespace = requireString(input, "namespace");
  const serviceAccount = requireString(input, "serviceAccount");
  const roleArn = requireString(input, "roleArn");
  requireCluster(ctx, clusterName);
  const associationId = crypto.randomUUID();
  const at = nowSeconds();
  const assoc: StoredPodIdentityAssociation = {
    clusterName,
    namespace,
    serviceAccount,
    roleArn,
    associationArn: `arn:aws:eks:${ctx.region}:${ctx.account}:podidentityassociation/${clusterName}/${associationId}`,
    associationId,
    tags: stringMapFrom(input["tags"]),
    createdAt: at,
    modifiedAt: at,
    disableSessionTags: boolOrUndefined(input["disableSessionTags"]),
    targetRoleArn: stringOrUndefined(input["targetRoleArn"]),
    policy: stringOrUndefined(input["policy"]),
  };
  ctx.store.set(podIdentityKey(clusterName, associationId), assoc);
  return { association: podIdentityView(assoc) };
};

const DescribePodIdentityAssociation: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const associationId = requireString(input, "associationId");
  const stored = ctx.store.get<StoredPodIdentityAssociation>(
    podIdentityKey(clusterName, associationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No pod identity association found with id: ${associationId}.`,
      404,
    );
  }
  return { association: podIdentityView(stored) };
};

const ListPodIdentityAssociations: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const assocs = ctx.store
    .list<StoredPodIdentityAssociation>()
    .filter((entry) => entry.key.startsWith(`pod-identity/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.associationId.localeCompare(b.associationId));
  return { associations: assocs.map(podIdentitySummaryView) };
};

const DeletePodIdentityAssociation: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const associationId = requireString(input, "associationId");
  const stored = ctx.store.get<StoredPodIdentityAssociation>(
    podIdentityKey(clusterName, associationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No pod identity association found with id: ${associationId}.`,
      404,
    );
  }
  ctx.store.delete(podIdentityKey(clusterName, associationId));
  return { association: podIdentityView(stored) };
};

const UpdatePodIdentityAssociation: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const associationId = requireString(input, "associationId");
  const stored = ctx.store.get<StoredPodIdentityAssociation>(
    podIdentityKey(clusterName, associationId),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No pod identity association found with id: ${associationId}.`,
      404,
    );
  }
  const updated: StoredPodIdentityAssociation = {
    ...stored,
    modifiedAt: nowSeconds(),
    roleArn: stringOrUndefined(input["roleArn"]) ?? stored.roleArn,
    disableSessionTags:
      boolOrUndefined(input["disableSessionTags"]) ?? stored.disableSessionTags,
    targetRoleArn:
      stringOrUndefined(input["targetRoleArn"]) ?? stored.targetRoleArn,
    policy: stringOrUndefined(input["policy"]) ?? stored.policy,
  };
  ctx.store.set(podIdentityKey(clusterName, associationId), updated);
  return { association: podIdentityView(updated) };
};

const AssociateIdentityProviderConfig: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const oidc = asRecord(input["oidc"]) ?? {};
  const name =
    stringOrUndefined(oidc["identityProviderConfigName"]) ?? "default";
  const issuerUrl = stringOrUndefined(oidc["issuerUrl"]) ?? "";
  const clientId = stringOrUndefined(oidc["clientId"]) ?? "";
  const at = nowSeconds();
  const updateId = crypto.randomUUID();
  const cfg: StoredIdentityProviderConfig = {
    clusterName,
    type: "oidc",
    name,
    identityProviderConfigArn: `arn:aws:eks:${ctx.region}:${ctx.account}:identityproviderconfig/${clusterName}/oidc/${name}/${crypto.randomUUID()}`,
    issuerUrl,
    clientId,
    usernameClaim: stringOrUndefined(oidc["usernameClaim"]),
    usernamePrefix: stringOrUndefined(oidc["usernamePrefix"]),
    groupsClaim: stringOrUndefined(oidc["groupsClaim"]),
    groupsPrefix: stringOrUndefined(oidc["groupsPrefix"]),
    requiredClaims: stringMapFrom(oidc["requiredClaims"]),
    tags: stringMapFrom(input["tags"]),
    status: "ACTIVE",
    updateId,
  };
  ctx.store.set(idpConfigKey(clusterName, name), cfg);
  const update = storeUpdate(
    ctx,
    clusterName,
    "AssociateIdentityProviderConfig",
    [{ type: "IdentityProviderConfig", value: name }],
  );
  return { update: updateView(update), tags: cfg.tags };
};

const DescribeIdentityProviderConfig: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const identityProviderConfig =
    asRecord(input["identityProviderConfig"]) ?? {};
  const name = requireString(
    identityProviderConfig as Record<string, unknown>,
    "name",
  );
  const stored = ctx.store.get<StoredIdentityProviderConfig>(
    idpConfigKey(clusterName, name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No identity provider config found with name: ${name}.`,
      404,
    );
  }
  return { identityProviderConfig: { oidc: oidcIdpView(stored) } };
};

const ListIdentityProviderConfigs: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const configs = ctx.store
    .list<StoredIdentityProviderConfig>()
    .filter((entry) => entry.key.startsWith(`idp-config/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    identityProviderConfigs: configs.map((c) => ({
      type: c.type,
      name: c.name,
    })),
  };
};

const DisassociateIdentityProviderConfig: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const identityProviderConfig =
    asRecord(input["identityProviderConfig"]) ?? {};
  const name = requireString(
    identityProviderConfig as Record<string, unknown>,
    "name",
  );
  const stored = ctx.store.get<StoredIdentityProviderConfig>(
    idpConfigKey(clusterName, name),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No identity provider config found with name: ${name}.`,
      404,
    );
  }
  ctx.store.delete(idpConfigKey(clusterName, name));
  const update = storeUpdate(
    ctx,
    clusterName,
    "DisassociateIdentityProviderConfig",
    [{ type: "IdentityProviderConfig", value: name }],
  );
  return { update: updateView(update) };
};

const AssociateEncryptionConfig: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const update = storeUpdate(ctx, clusterName, "AssociateEncryptionConfig", [
    {
      type: "EncryptionConfig",
      value: JSON.stringify(input["encryptionConfig"]),
    },
  ]);
  return { update: updateView(update) };
};

const UpdateClusterConfig: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cluster = requireCluster(ctx, name);
  const updated: StoredCluster = {
    ...cluster,
    status: "UPDATING",
    resourcesVpcConfig:
      asRecord(input["resourcesVpcConfig"]) ?? cluster.resourcesVpcConfig,
    logging: asRecord(input["logging"]) ?? cluster.logging,
  };
  ctx.store.set(clusterKey(name), updated);
  const update = storeUpdate(ctx, name, "ConfigUpdate", [
    { type: "ClusterLogging", value: "updated" },
  ]);
  return { update: updateView(update) };
};

const UpdateClusterVersion: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const version = requireString(input, "version");
  const cluster = requireCluster(ctx, name);
  ctx.store.set(clusterKey(name), { ...cluster, version, status: "UPDATING" });
  const update = storeUpdate(ctx, name, "VersionUpdate", [
    { type: "Version", value: version },
  ]);
  return { update: updateView(update) };
};

const UpdateNodegroupConfig: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const nodegroupName = requireString(input, "nodegroupName");
  const stored = requireNodegroup(ctx, clusterName, nodegroupName);
  const updated: StoredNodegroup = {
    ...stored,
    modifiedAt: nowSeconds(),
    status: "UPDATING",
    labels: stringMapFrom(input["labels"]) || stored.labels,
    scalingConfig: asRecord(input["scalingConfig"]) ?? stored.scalingConfig,
  };
  ctx.store.set(nodegroupKey(clusterName, nodegroupName), updated);
  const update = storeUpdate(
    ctx,
    clusterName,
    "ConfigUpdate",
    [{ type: "LabelsToAdd", value: "updated" }],
    nodegroupName,
  );
  return { update: updateView(update) };
};

const UpdateNodegroupVersion: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const nodegroupName = requireString(input, "nodegroupName");
  const stored = requireNodegroup(ctx, clusterName, nodegroupName);
  const newVersion = stringOrUndefined(input["version"]) ?? stored.version;
  const newRelease =
    stringOrUndefined(input["releaseVersion"]) ?? stored.releaseVersion;
  const updated: StoredNodegroup = {
    ...stored,
    modifiedAt: nowSeconds(),
    status: "UPDATING",
    version: newVersion,
    releaseVersion: newRelease,
  };
  ctx.store.set(nodegroupKey(clusterName, nodegroupName), updated);
  const update = storeUpdate(
    ctx,
    clusterName,
    "VersionUpdate",
    [{ type: "Version", value: newVersion }],
    nodegroupName,
  );
  return { update: updateView(update) };
};

const DescribeUpdate: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const updateId = requireString(input, "updateId");
  const stored = ctx.store.get<StoredUpdate>(updateKey(name, updateId));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No update found with id: ${updateId}.`,
      404,
    );
  }
  return { update: updateView(stored) };
};

const ListUpdates: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const nodegroupName = stringOrUndefined(input["nodegroupName"]);
  const addonName = stringOrUndefined(input["addonName"]);
  const capabilityName = stringOrUndefined(input["capabilityName"]);
  const updates = ctx.store
    .list<StoredUpdate>()
    .filter((entry) => entry.key.startsWith(`update/${name}/`))
    .map((entry) => entry.value)
    .filter((u) => {
      if (nodegroupName !== undefined) return u.nodegroupName === nodegroupName;
      if (addonName !== undefined) return u.addonName === addonName;
      if (capabilityName !== undefined)
        return u.capabilityName === capabilityName;
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
  return { updateIds: updates.map((u) => u.id) };
};

const RegisterCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  if (ctx.store.get<StoredCluster>(clusterKey(name)) !== undefined) {
    throw awsError(
      "ResourceInUseException",
      `Cluster already exists with name: ${name}.`,
      409,
    );
  }
  const connectorConfig = asRecord(input["connectorConfig"]) ?? {};
  const id = crypto.randomUUID();
  const cluster: StoredCluster = {
    name,
    arn: clusterArnOf(ctx, name),
    createdAt: nowSeconds(),
    version: "1.31",
    endpoint: "",
    roleArn: stringOrUndefined(connectorConfig["roleArn"]) ?? "",
    resourcesVpcConfig: undefined,
    kubernetesNetworkConfig: undefined,
    logging: undefined,
    status: "PENDING",
    platformVersion: "eks-anywhere.1",
    tags: stringMapFrom(input["tags"]),
    certificateAuthority: {},
    identity: {},
    connectorConfig: {
      activationId: id,
      activationCode: btoa(id).slice(0, 32),
      activationExpiry: nowSeconds() + 3600,
      provider: stringOrUndefined(connectorConfig["provider"]) ?? "OTHER",
      roleArn: stringOrUndefined(connectorConfig["roleArn"]) ?? "",
    },
  };
  ctx.store.set(clusterKey(name), cluster);
  return { cluster: clusterView(cluster) };
};

const DeregisterCluster: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const cluster = requireCluster(ctx, name);
  ctx.store.delete(clusterKey(name));
  return { cluster: clusterView({ ...cluster, status: "DELETING" }) };
};

const CreateEksAnywhereSubscription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const id = crypto.randomUUID();
  const at = nowSeconds();
  const sub: StoredEksAnywhereSubscription = {
    id,
    arn: `arn:aws:eks:${ctx.region}:${ctx.account}:eks-anywhere-subscription/${id}`,
    createdAt: at,
    licenseQuantity: numberOrUndefined(input["licenseQuantity"]) ?? 1,
    licenseType: stringOrUndefined(input["licenseType"]) ?? "Cluster",
    term: asRecord(input["term"]) ?? { duration: 1, unit: "MONTHS" },
    status: "ACTIVE",
    autoRenew:
      typeof input["autoRenew"] === "boolean" ? input["autoRenew"] : false,
    licenseArns: [],
    tags: stringMapFrom(input["tags"]),
    name,
  };
  ctx.store.set(subscriptionKey(id), sub);
  return { subscription: subscriptionView(sub) };
};

const DescribeEksAnywhereSubscription: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const stored = ctx.store.get<StoredEksAnywhereSubscription>(
    subscriptionKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No subscription found with id: ${id}.`,
      404,
    );
  }
  return { subscription: subscriptionView(stored) };
};

const ListEksAnywhereSubscriptions: OperationHandler = (_input, ctx) => {
  const subs = ctx.store
    .list<StoredEksAnywhereSubscription>()
    .filter((entry) => entry.key.startsWith("eks-anywhere-subscription/"))
    .map((entry) => entry.value)
    .sort((a, b) => a.id.localeCompare(b.id));
  return { subscriptions: subs.map(subscriptionView) };
};

const DeleteEksAnywhereSubscription: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const stored = ctx.store.get<StoredEksAnywhereSubscription>(
    subscriptionKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No subscription found with id: ${id}.`,
      404,
    );
  }
  ctx.store.delete(subscriptionKey(id));
  return {
    subscription: subscriptionView({ ...stored, status: "DELETING" }),
  };
};

const UpdateEksAnywhereSubscription: OperationHandler = (input, ctx) => {
  const id = requireString(input, "id");
  const stored = ctx.store.get<StoredEksAnywhereSubscription>(
    subscriptionKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No subscription found with id: ${id}.`,
      404,
    );
  }
  const updated: StoredEksAnywhereSubscription = {
    ...stored,
    autoRenew:
      typeof input["autoRenew"] === "boolean"
        ? input["autoRenew"]
        : stored.autoRenew,
  };
  ctx.store.set(subscriptionKey(id), updated);
  return { subscription: subscriptionView(updated) };
};

const CreateCapability: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const capabilityName = requireString(input, "capabilityName");
  const type = requireString(input, "type");
  const roleArn = requireString(input, "roleArn");
  const deletePropagationPolicy = requireString(
    input,
    "deletePropagationPolicy",
  );
  requireCluster(ctx, clusterName);
  const at = nowSeconds();
  const cap: StoredCapability = {
    capabilityName,
    arn: `arn:aws:eks:${ctx.region}:${ctx.account}:capability/${clusterName}/${capabilityName}`,
    clusterName,
    type,
    roleArn,
    status: "ACTIVE",
    version: "1.0.0",
    tags: stringMapFrom(input["tags"]),
    createdAt: at,
    modifiedAt: at,
    deletePropagationPolicy,
  };
  ctx.store.set(capabilityKey(clusterName, capabilityName), cap);
  return { capability: capabilityView(cap) };
};

const DescribeCapability: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const capabilityName = requireString(input, "capabilityName");
  const stored = ctx.store.get<StoredCapability>(
    capabilityKey(clusterName, capabilityName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No capability found with name: ${capabilityName}.`,
      404,
    );
  }
  return { capability: capabilityView(stored) };
};

const ListCapabilities: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const caps = ctx.store
    .list<StoredCapability>()
    .filter((entry) => entry.key.startsWith(`capability/${clusterName}/`))
    .map((entry) => entry.value)
    .sort((a, b) => a.capabilityName.localeCompare(b.capabilityName));
  return { capabilities: caps.map(capabilitySummaryView) };
};

const DeleteCapability: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const capabilityName = requireString(input, "capabilityName");
  const stored = ctx.store.get<StoredCapability>(
    capabilityKey(clusterName, capabilityName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No capability found with name: ${capabilityName}.`,
      404,
    );
  }
  ctx.store.delete(capabilityKey(clusterName, capabilityName));
  return {
    capability: capabilityView({ ...stored, status: "DELETING" }),
  };
};

const UpdateCapability: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  const capabilityName = requireString(input, "capabilityName");
  const stored = ctx.store.get<StoredCapability>(
    capabilityKey(clusterName, capabilityName),
  );
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No capability found with name: ${capabilityName}.`,
      404,
    );
  }
  const updated: StoredCapability = {
    ...stored,
    modifiedAt: nowSeconds(),
    roleArn: stringOrUndefined(input["roleArn"]) ?? stored.roleArn,
    deletePropagationPolicy:
      stringOrUndefined(input["deletePropagationPolicy"]) ??
      stored.deletePropagationPolicy,
  };
  ctx.store.set(capabilityKey(clusterName, capabilityName), updated);
  const update = storeUpdate(
    ctx,
    clusterName,
    "ConfigUpdate",
    [{ type: "Version", value: updated.version }],
    undefined,
    undefined,
    capabilityName,
  );
  return { update: updateView(update) };
};

const DescribeClusterVersions: OperationHandler = (_input, _ctx) => {
  return {
    clusterVersions: [
      {
        clusterVersion: "1.31",
        clusterType: "eks",
        defaultPlatformVersion: "eks.1",
        defaultVersion: true,
        releaseDate: 1700000000,
        endOfStandardSupportDate: 1800000000,
        endOfExtendedSupportDate: 1900000000,
        status: "standard-support",
        versionStatus: "STANDARD_SUPPORT",
        kubernetesPatchVersion: "1.31.0",
      },
      {
        clusterVersion: "1.30",
        clusterType: "eks",
        defaultPlatformVersion: "eks.1",
        defaultVersion: false,
        releaseDate: 1690000000,
        endOfStandardSupportDate: 1790000000,
        endOfExtendedSupportDate: 1890000000,
        status: "extended-support",
        versionStatus: "EXTENDED_SUPPORT",
        kubernetesPatchVersion: "1.30.0",
      },
    ],
  };
};

const ensureInsights = (
  ctx: ServiceContext,
  clusterName: string,
): StoredInsight[] => {
  const prefix = `insight/${clusterName}/`;
  const stored = ctx.store
    .list<StoredInsight>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  if (stored.length > 0) return stored;
  const id = `${clusterName}-upgrade-readiness`;
  const insight: StoredInsight = {
    id,
    clusterName,
    name: "upgrade-readiness",
    category: "UPGRADE_READINESS",
    kubernetesVersion: "1.31",
    lastRefreshTime: nowSeconds(),
    lastTransitionTime: nowSeconds(),
    description: "Upgrade readiness check for EKS cluster",
    insightStatus: { status: "PASSING", reason: "" },
    recommendation: "",
    additionalInfo: {},
    resources: [],
    categorySpecificSummary: {},
  };
  ctx.store.set(insightKey(clusterName, id), insight);
  return [insight];
};

const DescribeInsight: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const id = requireString(input, "id");
  const stored = ctx.store.get<StoredInsight>(insightKey(clusterName, id));
  if (stored !== undefined) {
    return {
      insight: {
        id: stored.id,
        name: stored.name,
        category: stored.category,
        kubernetesVersion: stored.kubernetesVersion,
        lastRefreshTime: stored.lastRefreshTime,
        lastTransitionTime: stored.lastTransitionTime,
        description: stored.description,
        insightStatus: stored.insightStatus,
        recommendation: stored.recommendation,
        additionalInfo: stored.additionalInfo,
        resources: stored.resources,
        categorySpecificSummary: stored.categorySpecificSummary,
      },
    };
  }
  return {
    insight: {
      id,
      name: "upgrade-readiness",
      category: "UPGRADE_READINESS",
      kubernetesVersion: "1.31",
      lastRefreshTime: nowSeconds(),
      lastTransitionTime: nowSeconds(),
      description: "Upgrade readiness check for EKS cluster",
      insightStatus: { status: "PASSING", reason: "" },
      recommendation: "",
      additionalInfo: {},
      resources: [],
      categorySpecificSummary: {},
    },
  };
};

const DescribeInsightsRefresh: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const stored = ctx.store.get<StoredInsightsRefresh>(
    insightsRefreshKey(clusterName),
  );
  if (stored === undefined) {
    return {
      message: "No refresh in progress",
      status: "COMPLETED",
      startedAt: nowSeconds() - 60,
      endedAt: nowSeconds(),
    };
  }
  if (stored.status === "IN_PROGRESS") {
    const completed: StoredInsightsRefresh = {
      ...stored,
      status: "COMPLETED",
      endedAt: nowSeconds(),
    };
    ctx.store.set(insightsRefreshKey(clusterName), completed);
    return {
      message: "Insights refresh completed",
      status: "COMPLETED",
      startedAt: stored.startedAt,
      endedAt: completed.endedAt,
    };
  }
  return {
    message: "Insights refresh completed",
    status: stored.status,
    startedAt: stored.startedAt,
    endedAt: stored.endedAt,
  };
};

const ListInsights: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const insights = ensureInsights(ctx, clusterName);
  return {
    insights: insights.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      kubernetesVersion: i.kubernetesVersion,
      lastRefreshTime: i.lastRefreshTime,
      lastTransitionTime: i.lastTransitionTime,
      description: i.description,
      insightStatus: i.insightStatus,
    })),
  };
};

const StartInsightsRefresh: OperationHandler = (input, ctx) => {
  const clusterName = requireString(input, "clusterName");
  requireCluster(ctx, clusterName);
  const refresh: StoredInsightsRefresh = {
    clusterName,
    status: "IN_PROGRESS",
    startedAt: nowSeconds(),
    endedAt: undefined,
  };
  ctx.store.set(insightsRefreshKey(clusterName), refresh);
  return {
    message: "Insights refresh started",
    status: "IN_PROGRESS",
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags = stringMapFrom(input["tags"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  ctx.store.set(tagsKey(resourceArn), { ...existing, ...tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tagKeys = stringListFrom(input["tagKeys"]);
  const existing =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(resourceArn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const tags =
    ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
  return { tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const eks = {
  name: "eks",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);

    if (parts[0] === "access-policies") {
      if (req.method === "GET") return "ListAccessPolicies";
      return undefined;
    }

    if (parts[0] === "addons") {
      if (parts[1] === "configuration-schemas" && req.method === "GET")
        return "DescribeAddonConfiguration";
      if (parts[1] === "supported-versions" && req.method === "GET")
        return "DescribeAddonVersions";
      return undefined;
    }

    if (parts[0] === "cluster-versions") {
      if (req.method === "GET") return "DescribeClusterVersions";
      return undefined;
    }

    if (parts[0] === "cluster-registrations") {
      if (parts.length === 1 && req.method === "POST") return "RegisterCluster";
      if (parts.length === 2 && req.method === "DELETE")
        return "DeregisterCluster";
      return undefined;
    }

    if (parts[0] === "eks-anywhere-subscriptions") {
      if (parts.length === 1) {
        if (req.method === "POST") return "CreateEksAnywhereSubscription";
        if (req.method === "GET") return "ListEksAnywhereSubscriptions";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "GET") return "DescribeEksAnywhereSubscription";
        if (req.method === "DELETE") return "DeleteEksAnywhereSubscription";
        if (req.method === "POST") return "UpdateEksAnywhereSubscription";
        return undefined;
      }
      return undefined;
    }

    if (parts[0] === "tags") {
      if (parts.length >= 2) {
        if (req.method === "GET") return "ListTagsForResource";
        if (req.method === "POST") return "TagResource";
        if (req.method === "DELETE") return "UntagResource";
      }
      return undefined;
    }

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

    if (parts.length === 3) {
      if (parts[2] === "node-groups") {
        if (req.method === "POST") return "CreateNodegroup";
        if (req.method === "GET") return "ListNodegroups";
      }
      if (parts[2] === "fargate-profiles") {
        if (req.method === "POST") return "CreateFargateProfile";
        if (req.method === "GET") return "ListFargateProfiles";
      }
      if (parts[2] === "addons") {
        if (req.method === "POST") return "CreateAddon";
        if (req.method === "GET") return "ListAddons";
      }
      if (parts[2] === "access-entries") {
        if (req.method === "POST") return "CreateAccessEntry";
        if (req.method === "GET") return "ListAccessEntries";
      }
      if (parts[2] === "pod-identity-associations") {
        if (req.method === "POST") return "CreatePodIdentityAssociation";
        if (req.method === "GET") return "ListPodIdentityAssociations";
      }
      if (parts[2] === "identity-provider-configs") {
        if (req.method === "GET") return "ListIdentityProviderConfigs";
      }
      if (parts[2] === "capabilities") {
        if (req.method === "POST") return "CreateCapability";
        if (req.method === "GET") return "ListCapabilities";
      }
      if (parts[2] === "updates") {
        if (req.method === "POST") return "UpdateClusterVersion";
        if (req.method === "GET") return "ListUpdates";
      }
      if (parts[2] === "update-config") {
        if (req.method === "POST") return "UpdateClusterConfig";
      }
      if (parts[2] === "encryption-config") return undefined;
      if (parts[2] === "insights") {
        if (req.method === "POST") return "ListInsights";
      }
      if (parts[2] === "insights-refresh") {
        if (req.method === "GET") return "DescribeInsightsRefresh";
        if (req.method === "POST") return "StartInsightsRefresh";
      }
      return undefined;
    }

    if (parts.length === 4) {
      if (parts[2] === "node-groups") {
        if (req.method === "GET") return "DescribeNodegroup";
        if (req.method === "DELETE") return "DeleteNodegroup";
      }
      if (parts[2] === "fargate-profiles") {
        if (req.method === "GET") return "DescribeFargateProfile";
        if (req.method === "DELETE") return "DeleteFargateProfile";
      }
      if (parts[2] === "addons") {
        if (req.method === "GET") return "DescribeAddon";
        if (req.method === "DELETE") return "DeleteAddon";
      }
      if (parts[2] === "access-entries") {
        if (req.method === "GET") return "DescribeAccessEntry";
        if (req.method === "DELETE") return "DeleteAccessEntry";
        if (req.method === "POST") return "UpdateAccessEntry";
      }
      if (parts[2] === "pod-identity-associations") {
        if (req.method === "GET") return "DescribePodIdentityAssociation";
        if (req.method === "DELETE") return "DeletePodIdentityAssociation";
        if (req.method === "POST") return "UpdatePodIdentityAssociation";
      }
      if (parts[2] === "identity-provider-configs") {
        if (parts[3] === "associate" && req.method === "POST")
          return "AssociateIdentityProviderConfig";
        if (parts[3] === "describe" && req.method === "POST")
          return "DescribeIdentityProviderConfig";
        if (parts[3] === "disassociate" && req.method === "POST")
          return "DisassociateIdentityProviderConfig";
      }
      if (parts[2] === "encryption-config") {
        if (parts[3] === "associate" && req.method === "POST")
          return "AssociateEncryptionConfig";
      }
      if (parts[2] === "capabilities") {
        if (req.method === "GET") return "DescribeCapability";
        if (req.method === "DELETE") return "DeleteCapability";
        if (req.method === "POST") return "UpdateCapability";
      }
      if (parts[2] === "updates") {
        if (req.method === "GET") return "DescribeUpdate";
      }
      if (parts[2] === "insights") {
        if (req.method === "GET") return "DescribeInsight";
      }
      return undefined;
    }

    if (parts.length === 5) {
      if (parts[2] === "node-groups") {
        if (parts[4] === "update-config" && req.method === "POST")
          return "UpdateNodegroupConfig";
        if (parts[4] === "update-version" && req.method === "POST")
          return "UpdateNodegroupVersion";
      }
      if (
        parts[2] === "addons" &&
        parts[4] === "update" &&
        req.method === "POST"
      )
        return "UpdateAddon";
      if (parts[2] === "access-entries") {
        if (parts[4] === "access-policies") {
          if (req.method === "GET") return "ListAssociatedAccessPolicies";
          if (req.method === "POST") return "AssociateAccessPolicy";
        }
      }
      return undefined;
    }

    if (parts.length === 6) {
      if (
        parts[2] === "access-entries" &&
        parts[4] === "access-policies" &&
        req.method === "DELETE"
      )
        return "DisassociateAccessPolicy";
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
    DeleteNodegroup,
    CreateFargateProfile,
    DescribeFargateProfile,
    ListFargateProfiles,
    DeleteFargateProfile,
    CreateAddon,
    DescribeAddon,
    ListAddons,
    DeleteAddon,
    UpdateAddon,
    DescribeAddonVersions,
    DescribeAddonConfiguration,
    CreateAccessEntry,
    DescribeAccessEntry,
    ListAccessEntries,
    DeleteAccessEntry,
    UpdateAccessEntry,
    AssociateAccessPolicy,
    DisassociateAccessPolicy,
    ListAssociatedAccessPolicies,
    ListAccessPolicies,
    CreatePodIdentityAssociation,
    DescribePodIdentityAssociation,
    ListPodIdentityAssociations,
    DeletePodIdentityAssociation,
    UpdatePodIdentityAssociation,
    AssociateIdentityProviderConfig,
    DescribeIdentityProviderConfig,
    ListIdentityProviderConfigs,
    DisassociateIdentityProviderConfig,
    AssociateEncryptionConfig,
    UpdateClusterConfig,
    UpdateClusterVersion,
    UpdateNodegroupConfig,
    UpdateNodegroupVersion,
    DescribeUpdate,
    ListUpdates,
    RegisterCluster,
    DeregisterCluster,
    CreateEksAnywhereSubscription,
    DescribeEksAnywhereSubscription,
    ListEksAnywhereSubscriptions,
    DeleteEksAnywhereSubscription,
    UpdateEksAnywhereSubscription,
    CreateCapability,
    DescribeCapability,
    ListCapabilities,
    DeleteCapability,
    UpdateCapability,
    DescribeClusterVersions,
    DescribeInsight,
    DescribeInsightsRefresh,
    ListInsights,
    StartInsightsRefresh,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default eks;
