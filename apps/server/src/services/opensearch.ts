import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/opensearch.json", { with: { type: "json" } }),
);

type StoredDomain = {
  domainId: string;
  domainName: string;
  arn: string;
  engineVersion: string;
  endpoint: string;
  clusterConfig: Record<string, unknown>;
  ebsOptions: Record<string, unknown>;
  accessPolicies: string | undefined;
  ipAddressType: string;
  advancedOptions: Record<string, string>;
};

type StoredApplication = {
  id: string;
  name: string;
  arn: string;
  endpoint: string;
  iamIdentityCenterOptions: Record<string, unknown>;
  dataSources: unknown[];
  appConfigs: unknown[];
  createdAt: number;
  lastUpdatedAt: number;
  clientToken?: string;
};

type StoredPackage = {
  packageId: string;
  packageName: string;
  packageType: string;
  packageDescription: string;
  packageStatus: string;
  createdAt: number;
  lastUpdatedAt: number;
  availablePackageVersion: string;
  engineVersion: string;
  associatedDomains: string[];
  arn: string;
};

type StoredVpcEndpoint = {
  vpcEndpointId: string;
  vpcEndpointOwner: string;
  domainArn: string;
  vpcOptions: Record<string, unknown>;
  status: string;
  endpoint: string;
  arn: string;
};

type StoredConnection = {
  connectionId: string;
  localDomainInfo: Record<string, unknown>;
  remoteDomainInfo: Record<string, unknown>;
  connectionStatus: Record<string, unknown>;
  connectionMode: string;
  connectionAlias: string;
};

type StoredDataSource = {
  name: string;
  dataSourceType: Record<string, unknown>;
  description: string;
};

type StoredDirectQueryDataSource = {
  dataSourceName: string;
  dataSourceType: Record<string, unknown>;
  description: string;
  openSearchArns: string[];
};

type StoredIndex = {
  indexName: string;
  indexSchema: Record<string, unknown>;
  status: string;
};

const domainKey = (name: string): string => `domain/${name}`;
const appKey = (id: string): string => `application/${id}`;
const pkgKey = (id: string): string => `package/${id}`;
const vpcKey = (id: string): string => `vpcEndpoint/${id}`;
const inboundKey = (id: string): string => `inboundConnection/${id}`;
const outboundKey = (id: string): string => `outboundConnection/${id}`;
const dataSourceKey = (domain: string, name: string): string =>
  `dataSource/${domain}/${name}`;
const directQueryKey = (name: string): string =>
  `directQueryDataSource/${name}`;
const indexKey = (domain: string, name: string): string =>
  `index/${domain}/${name}`;
const tagKey = (arn: string): string => `tags/${arn}`;
const clientTokenKey = (token: string): string =>
  `clientToken/application/${token}`;
const capabilityKey = (appId: string, cap: string): string =>
  `capability/${appId}/${cap}`;
const vpcAccessKey = (domain: string): string => `vpcAccess/${domain}`;

const hex = (length: number): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrEmpty = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const advancedOptionsFromInput = (value: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
};

const domainStatusView = (domain: StoredDomain): Record<string, unknown> => ({
  DomainId: domain.domainId,
  DomainName: domain.domainName,
  ARN: domain.arn,
  Created: true,
  Deleted: false,
  Endpoint: domain.endpoint,
  Processing: false,
  UpgradeProcessing: false,
  EngineVersion: domain.engineVersion,
  ClusterConfig: domain.clusterConfig,
  EBSOptions: domain.ebsOptions,
  AccessPolicies: domain.accessPolicies,
  IPAddressType: domain.ipAddressType,
  AdvancedOptions: domain.advancedOptions,
});

const optionStatus = (value: unknown): Record<string, unknown> => ({
  Options: value,
  Status: {
    CreationDate: Math.floor(Date.now() / 1000),
    UpdateDate: Math.floor(Date.now() / 1000),
    UpdateVersion: 1,
    State: "Active",
    PendingDeletion: false,
  },
});

const domainConfigView = (domain: StoredDomain): Record<string, unknown> => ({
  EngineVersion: optionStatus(domain.engineVersion),
  ClusterConfig: optionStatus(domain.clusterConfig),
  EBSOptions: optionStatus(domain.ebsOptions),
  AccessPolicies: optionStatus(domain.accessPolicies),
  IPAddressType: optionStatus(domain.ipAddressType),
  AdvancedOptions: optionStatus(domain.advancedOptions),
});

const requireDomain = (
  ctx: ServiceContext,
  domainName: string,
): StoredDomain => {
  const domain = ctx.store.get<StoredDomain>(domainKey(domainName));
  if (domain === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Domain not found: ${domainName}`,
      404,
    );
  }
  return domain;
};

const requireDomainByArn = (
  ctx: ServiceContext,
  domainArn: string,
): StoredDomain => {
  const found = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith("domain/"))
    .find((entry) => entry.value.arn === domainArn);
  if (found === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Domain not found for ARN: ${domainArn}`,
      404,
    );
  }
  return found.value;
};

const paginateList = <T>(
  items: T[],
  maxResults: unknown,
  nextToken: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const limit =
    typeof maxResults === "number" && maxResults > 0
      ? maxResults
      : items.length;
  const offset =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(offset, offset + limit);
  const newOffset = offset + limit;
  return {
    items: page,
    nextToken: newOffset < items.length ? String(newOffset) : undefined,
  };
};

const packageDetailsView = (pkg: StoredPackage): Record<string, unknown> => ({
  PackageID: pkg.packageId,
  PackageName: pkg.packageName,
  PackageType: pkg.packageType,
  PackageDescription: pkg.packageDescription,
  PackageStatus: pkg.packageStatus,
  CreatedAt: pkg.createdAt,
  LastUpdatedAt: pkg.lastUpdatedAt,
  AvailablePackageVersion: pkg.availablePackageVersion,
  EngineVersion: pkg.engineVersion,
});

const domainPackageDetails = (
  pkg: StoredPackage,
  domainName: string,
  status: string,
): Record<string, unknown> => ({
  PackageID: pkg.packageId,
  PackageName: pkg.packageName,
  PackageType: pkg.packageType,
  DomainName: domainName,
  DomainPackageStatus: status,
  PackageVersion: pkg.availablePackageVersion,
  LastUpdated: pkg.lastUpdatedAt,
});

const vpcEndpointView = (ep: StoredVpcEndpoint): Record<string, unknown> => ({
  VpcEndpointId: ep.vpcEndpointId,
  VpcEndpointOwner: ep.vpcEndpointOwner,
  DomainArn: ep.domainArn,
  VpcOptions: ep.vpcOptions,
  Status: ep.status,
  Endpoint: ep.endpoint,
});

const vpcEndpointSummaryView = (
  ep: StoredVpcEndpoint,
): Record<string, unknown> => ({
  VpcEndpointId: ep.vpcEndpointId,
  VpcEndpointOwner: ep.vpcEndpointOwner,
  DomainArn: ep.domainArn,
  Status: ep.status,
});

const outboundConnectionView = (
  conn: StoredConnection,
): Record<string, unknown> => ({
  LocalDomainInfo: conn.localDomainInfo,
  RemoteDomainInfo: conn.remoteDomainInfo,
  ConnectionId: conn.connectionId,
  ConnectionAlias: conn.connectionAlias,
  ConnectionStatus: conn.connectionStatus,
  ConnectionMode: conn.connectionMode,
});

const inboundConnectionView = (
  conn: StoredConnection,
): Record<string, unknown> => ({
  LocalDomainInfo: conn.localDomainInfo,
  RemoteDomainInfo: conn.remoteDomainInfo,
  ConnectionId: conn.connectionId,
  ConnectionStatus: conn.connectionStatus,
  ConnectionMode: conn.connectionMode,
});

const serviceSoftwareView = (): Record<string, unknown> => ({
  CurrentVersion: "R20231201",
  NewVersion: "R20240101",
  UpdateAvailable: false,
  Cancellable: false,
  UpdateStatus: "COMPLETED",
  Description: "No update available",
  AutomatedUpdateDate: Math.floor(Date.now() / 1000) + 604800,
  OptionalDeployment: false,
});

const CreateDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  if (ctx.store.get<StoredDomain>(domainKey(domainName)) !== undefined) {
    throw awsError(
      "ResourceAlreadyExistsException",
      `Domain already exists: ${domainName}`,
      409,
    );
  }
  const domainId = `${ctx.account}/${domainName}`;
  const domain: StoredDomain = {
    domainId,
    domainName,
    arn: `arn:aws:es:${ctx.region}:${ctx.account}:domain/${domainName}`,
    engineVersion:
      stringOrUndefined(input["EngineVersion"]) ?? "OpenSearch_2.11",
    endpoint: `${domainName}-${hex(6)}.${ctx.region}.es.amazonaws.com`,
    clusterConfig: recordOrEmpty(input["ClusterConfig"]),
    ebsOptions: recordOrEmpty(input["EBSOptions"]),
    accessPolicies: stringOrUndefined(input["AccessPolicies"]),
    ipAddressType: stringOrUndefined(input["IPAddressType"]) ?? "ipv4",
    advancedOptions: advancedOptionsFromInput(input["AdvancedOptions"]),
  };
  ctx.store.set(domainKey(domainName), domain);
  const inputTagList = Array.isArray(input["TagList"])
    ? (input["TagList"] as { Key?: string; Value?: string }[])
    : [];
  if (inputTagList.length > 0) {
    const tags: Record<string, string> = {};
    for (const tag of inputTagList) {
      if (tag.Key !== undefined && tag.Value !== undefined) {
        tags[tag.Key] = tag.Value;
      }
    }
    ctx.store.set(tagKey(domain.arn), tags);
  }
  return { DomainStatus: domainStatusView(domain) };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  return { DomainStatus: domainStatusView(domain) };
};

const DescribeDomains: OperationHandler = (input, ctx) => {
  const names = Array.isArray(input["DomainNames"])
    ? (input["DomainNames"] as unknown[]).filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const statuses = names
    .map((name) => ctx.store.get<StoredDomain>(domainKey(name)))
    .filter((domain): domain is StoredDomain => domain !== undefined)
    .map(domainStatusView);
  return { DomainStatusList: statuses };
};

const ListDomainNames: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith("domain/"))
    .map((entry) => ({
      DomainName: entry.value.domainName,
      EngineType: entry.value.engineVersion.startsWith("Elasticsearch")
        ? "Elasticsearch"
        : "OpenSearch",
    }));
  const { items, nextToken } = paginateList(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { DomainNames: items, NextToken: nextToken };
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  ctx.store.delete(domainKey(domainName));
  ctx.store.delete(tagKey(domain.arn));
  return {
    DomainStatus: {
      ...domainStatusView(domain),
      Deleted: true,
      Processing: true,
    },
  };
};

const UpdateDomainConfig: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  if (input["ClusterConfig"] !== undefined) {
    domain.clusterConfig = recordOrEmpty(input["ClusterConfig"]);
  }
  if (input["EBSOptions"] !== undefined) {
    domain.ebsOptions = recordOrEmpty(input["EBSOptions"]);
  }
  if (input["AccessPolicies"] !== undefined) {
    domain.accessPolicies = stringOrUndefined(input["AccessPolicies"]);
  }
  if (input["IPAddressType"] !== undefined) {
    domain.ipAddressType = stringOrUndefined(input["IPAddressType"]) ?? "ipv4";
  }
  if (input["AdvancedOptions"] !== undefined) {
    domain.advancedOptions = advancedOptionsFromInput(input["AdvancedOptions"]);
  }
  ctx.store.set(domainKey(domainName), domain);
  return { DomainConfig: domainConfigView(domain) };
};

const DescribeDomainConfig: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  const domain = requireDomain(ctx, domainName);
  return { DomainConfig: domainConfigView(domain) };
};

const DescribeDomainAutoTunes: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { AutoTunes: [], NextToken: undefined };
};

const DescribeDomainChangeProgress: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    ChangeProgressStatus: {
      ChangeId: hex(16),
      StartTime: Math.floor(Date.now() / 1000),
      Status: "COMPLETED",
      PendingProperties: [],
      CompletedProperties: [],
      TotalNumberOfStages: 0,
      ChangeProgressStages: [],
    },
  };
};

const DescribeDomainHealth: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    AvailabilityZoneCount: "1",
    ActiveAvailabilityZoneCount: "1",
    StandByAvailabilityZoneCount: "0",
    DataNodeCount: "1",
    DedicatedMaster: false,
    MasterEligibleNodeCount: "1",
    WarmNodeCount: "0",
    MasterNode: "Available",
    ClusterHealth: "Green",
    TotalShards: "5",
    TotalUnAssignedShards: "0",
    EnvironmentInformation: [],
  };
};

const DescribeDomainNodes: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { DomainNodesStatusList: [] };
};

const DescribeDryRunProgress: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    DryRunProgressStatus: {
      DryRunId: hex(16),
      DryRunStatus: "completed",
      CreationDate: new Date().toISOString(),
      UpdateDate: new Date().toISOString(),
      ValidationFailures: [],
    },
    DryRunConfig: undefined,
    DryRunResults: undefined,
  };
};

const CancelDomainConfigChange: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    DryRun: false,
    Message: "No pending configuration change to cancel.",
    CancelledChangeIds: [],
  };
};

const GetDomainMaintenanceStatus: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    Status: "COMPLETED",
    StatusMessage: "Maintenance completed successfully.",
    NodeId: undefined,
    Action: undefined,
    CreatedAt: Math.floor(Date.now() / 1000),
    UpdatedAt: Math.floor(Date.now() / 1000),
  };
};

const ListDomainMaintenances: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { DomainMaintenances: [], NextToken: undefined };
};

const StartDomainMaintenance: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { MaintenanceId: `maint-${hex(8)}` };
};

const ListScheduledActions: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { ScheduledActions: [], NextToken: undefined };
};

const UpdateScheduledAction: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    ScheduledAction: {
      Id: stringOrUndefined(input["ActionID"]) ?? hex(8),
      Type: stringOrUndefined(input["ActionType"]) ?? "SERVICE_SOFTWARE_UPDATE",
      Severity: "HIGH",
      ScheduledTime:
        typeof input["ScheduledTime"] === "number"
          ? input["ScheduledTime"]
          : Math.floor(Date.now() / 1000) + 86400,
      Description: "Scheduled action",
      ScheduledBy: "CUSTOMER",
      Status: "PENDING_UPDATE",
      Mandatory: false,
      Cancellable: true,
    },
  };
};

const CancelServiceSoftwareUpdate: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { ServiceSoftwareOptions: serviceSoftwareView() };
};

const RollbackServiceSoftwareUpdate: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { ServiceSoftwareOptions: serviceSoftwareView() };
};

const StartServiceSoftwareUpdate: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { ServiceSoftwareOptions: serviceSoftwareView() };
};

const GetCompatibleVersions: OperationHandler = (_input, _ctx) => ({
  CompatibleVersions: [
    {
      SourceVersion: "OpenSearch_2.11",
      TargetVersions: ["OpenSearch_2.13", "OpenSearch_2.15"],
    },
    {
      SourceVersion: "OpenSearch_2.13",
      TargetVersions: ["OpenSearch_2.15"],
    },
  ],
});

const GetUpgradeHistory: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return { UpgradeHistories: [], NextToken: undefined };
};

const GetUpgradeStatus: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    UpgradeStep: "UPGRADE",
    StepStatus: "SUCCEEDED",
    UpgradeName: "OpenSearch Upgrade",
  };
};

const ListVersions: OperationHandler = (input, _ctx) => {
  const all = [
    "OpenSearch_2.15",
    "OpenSearch_2.13",
    "OpenSearch_2.11",
    "OpenSearch_2.9",
    "Elasticsearch_7.10",
  ];
  const { items, nextToken } = paginateList(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { Versions: items, NextToken: nextToken };
};

const UpgradeDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]);
  if (domainName === undefined) {
    throw awsError("ValidationException", "DomainName is required.", 400);
  }
  requireDomain(ctx, domainName);
  return {
    UpgradeId: hex(16),
    DomainName: domainName,
    TargetVersion:
      stringOrUndefined(input["TargetVersion"]) ?? "OpenSearch_2.13",
    PerformCheckOnly: input["PerformCheckOnly"] === true,
    AdvancedOptions: recordOrEmpty(input["AdvancedOptions"]),
    ChangeProgressDetails: {
      ChangeId: hex(16),
      Message: "Upgrade initiated",
    },
  };
};

const DescribeInstanceTypeLimits: OperationHandler = (input, _ctx) => {
  const instanceType =
    stringOrUndefined(input["InstanceType"]) ?? "t3.small.search";
  return {
    LimitsByRole: {
      data: {
        StorageTypes: [
          {
            StorageTypeName: "gp3",
            StorageSubTypeName: "gp3",
            StorageLimits: [
              { LimitName: "MinimumVolumeSize", LimitValues: ["20"] },
              { LimitName: "MaximumVolumeSize", LimitValues: ["16384"] },
            ],
          },
        ],
        InstanceLimits: {
          InstanceCountLimits: {
            MinimumInstanceCount: 1,
            MaximumInstanceCount: 40,
          },
        },
        AdditionalLimits: [],
      },
      ["master"]: {
        StorageTypes: [],
        InstanceLimits: {
          InstanceCountLimits: {
            MinimumInstanceCount: 3,
            MaximumInstanceCount: 5,
          },
        },
        AdditionalLimits: [],
      },
    },
    [instanceType]: undefined,
  };
};

const ListInstanceTypeDetails: OperationHandler = (input, _ctx) => {
  const engineVersion =
    stringOrUndefined(input["EngineVersion"]) ?? "OpenSearch_2.11";
  return {
    InstanceTypeDetails: [
      {
        InstanceType: "t3.small.search",
        EncryptionEnabled: true,
        CognitoEnabled: false,
        AppLogsEnabled: true,
        AdvancedSecurityEnabled: false,
        WarmEnabled: false,
        MultiAZWithStandbyEnabled: false,
        InstanceRole: ["data"],
        AvailabilityZones: [`${engineVersion}-az1`],
      },
      {
        InstanceType: "t3.medium.search",
        EncryptionEnabled: true,
        CognitoEnabled: true,
        AppLogsEnabled: true,
        AdvancedSecurityEnabled: true,
        WarmEnabled: false,
        MultiAZWithStandbyEnabled: false,
        InstanceRole: ["data", "master"],
        AvailabilityZones: [`${engineVersion}-az1`],
      },
    ],
    NextToken: undefined,
  };
};

const DescribeReservedInstanceOfferings: OperationHandler = (_input, _ctx) => ({
  ReservedInstanceOfferings: [],
  NextToken: undefined,
});

const DescribeReservedInstances: OperationHandler = (_input, _ctx) => ({
  ReservedInstances: [],
  NextToken: undefined,
});

const PurchaseReservedInstanceOffering: OperationHandler = (input, _ctx) => ({
  ReservationName:
    stringOrUndefined(input["ReservationName"]) ?? "my-reservation",
  ReservedInstanceId: hex(16),
});

const ListInsights: OperationHandler = (_input, _ctx) => ({
  InsightsSummaries: [],
  NextToken: undefined,
});

const DescribeInsightDetails: OperationHandler = (input, _ctx) => ({
  InsightId: stringOrUndefined(input["Id"]) ?? hex(16),
  InsightType: "FieldMappingTypeConflict",
  InsightName: "Sample insight",
  InsightStatus: {
    Status: "ACTIVE",
    StatusDescription: "Active insight",
    StatusInformation: [],
  },
  InsightSeverity: "ERROR",
  InsightDescription: "Sample insight description",
  AdditionalDetail: undefined,
  CreatedAt: Math.floor(Date.now() / 1000),
  UpdatedAt: Math.floor(Date.now() / 1000),
});

const appTagListFromStore = (
  arn: string,
  ctx: { store: { get: <T>(key: string) => T | undefined } },
): { Key: string; Value: string }[] => {
  const tags = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  return Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
};

const CreateApplication: OperationHandler = (input, ctx) => {
  const clientToken = stringOrUndefined(input["clientToken"]);
  if (clientToken !== undefined) {
    const existingId = ctx.store.get<string>(clientTokenKey(clientToken));
    if (existingId !== undefined) {
      const existing = ctx.store.get<StoredApplication>(appKey(existingId));
      if (existing !== undefined) {
        return {
          id: existing.id,
          name: existing.name,
          arn: existing.arn,
          dataSources: existing.dataSources,
          iamIdentityCenterOptions: existing.iamIdentityCenterOptions,
          appConfigs: existing.appConfigs,
          tagList: appTagListFromStore(existing.arn, ctx),
          createdAt: existing.createdAt,
          kmsKeyArn: undefined,
        };
      }
    }
  }
  const id = hex(12);
  const name = stringOrUndefined(input["name"]) ?? `app-${id}`;
  const now = Math.floor(Date.now() / 1000);
  const app: StoredApplication = {
    id,
    name,
    arn: `arn:aws:opensearch:${ctx.region}:${ctx.account}:application/${id}`,
    endpoint: `https://${id}.${ctx.region}.aoss.amazonaws.com`,
    iamIdentityCenterOptions: recordOrEmpty(input["iamIdentityCenterOptions"]),
    dataSources: Array.isArray(input["dataSources"])
      ? (input["dataSources"] as unknown[])
      : [],
    appConfigs: Array.isArray(input["appConfigs"])
      ? (input["appConfigs"] as unknown[])
      : [],
    createdAt: now,
    lastUpdatedAt: now,
    clientToken,
  };
  ctx.store.set(appKey(id), app);
  if (clientToken !== undefined) {
    ctx.store.set(clientTokenKey(clientToken), id);
  }
  const inputTagList = Array.isArray(input["tagList"])
    ? (input["tagList"] as { Key?: string; Value?: string }[])
    : [];
  if (inputTagList.length > 0) {
    const tags: Record<string, string> = {};
    for (const tag of inputTagList) {
      if (tag.Key !== undefined && tag.Value !== undefined) {
        tags[tag.Key] = tag.Value;
      }
    }
    ctx.store.set(tagKey(app.arn), tags);
  }
  return {
    id: app.id,
    name: app.name,
    arn: app.arn,
    dataSources: app.dataSources,
    iamIdentityCenterOptions: app.iamIdentityCenterOptions,
    appConfigs: app.appConfigs,
    tagList: appTagListFromStore(app.arn, ctx),
    createdAt: app.createdAt,
    kmsKeyArn: undefined,
  };
};

const GetApplication: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["id"]) ?? "";
  const app = ctx.store.get<StoredApplication>(appKey(id));
  if (app === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found: ${id}`,
      404,
    );
  }
  return {
    id: app.id,
    arn: app.arn,
    name: app.name,
    endpoint: app.endpoint,
    status: "ACTIVE",
    iamIdentityCenterOptions: app.iamIdentityCenterOptions,
    dataSources: app.dataSources,
    appConfigs: app.appConfigs,
    createdAt: app.createdAt,
    lastUpdatedAt: app.lastUpdatedAt,
    kmsKeyArn: undefined,
  };
};

const UpdateApplication: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["id"]) ?? "";
  const app = ctx.store.get<StoredApplication>(appKey(id));
  if (app === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found: ${id}`,
      404,
    );
  }
  if (input["dataSources"] !== undefined) {
    app.dataSources = Array.isArray(input["dataSources"])
      ? (input["dataSources"] as unknown[])
      : [];
  }
  if (input["appConfigs"] !== undefined) {
    app.appConfigs = Array.isArray(input["appConfigs"])
      ? (input["appConfigs"] as unknown[])
      : [];
  }
  if (input["iamIdentityCenterOptions"] !== undefined) {
    app.iamIdentityCenterOptions = recordOrEmpty(
      input["iamIdentityCenterOptions"],
    );
  }
  app.lastUpdatedAt = Math.floor(Date.now() / 1000);
  ctx.store.set(appKey(id), app);
  return {
    id: app.id,
    name: app.name,
    arn: app.arn,
    endpoint: app.endpoint,
    status: "UPDATING",
    iamIdentityCenterOptions: app.iamIdentityCenterOptions,
    dataSources: app.dataSources,
    appConfigs: app.appConfigs,
    createdAt: app.createdAt,
    lastUpdatedAt: app.lastUpdatedAt,
  };
};

const DeleteApplication: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["id"]) ?? "";
  const app = ctx.store.get<StoredApplication>(appKey(id));
  if (app === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Application not found: ${id}`,
      404,
    );
  }
  ctx.store.delete(appKey(id));
  ctx.store.delete(tagKey(app.arn));
  if (app.clientToken !== undefined) {
    ctx.store.delete(clientTokenKey(app.clientToken));
  }
  return {};
};

const ListApplications: OperationHandler = (_input, ctx) => {
  const apps = ctx.store
    .list<StoredApplication>()
    .filter((entry) => entry.key.startsWith("application/"))
    .map((entry) => ({
      id: entry.value.id,
      arn: entry.value.arn,
      name: entry.value.name,
      endpoint: entry.value.endpoint,
      status: "ACTIVE",
      createdAt: entry.value.createdAt,
      lastUpdatedAt: entry.value.lastUpdatedAt,
    }));
  return { ApplicationSummaries: apps, nextToken: undefined };
};

const GetCapability: OperationHandler = (input, ctx) => {
  const applicationId = stringOrUndefined(input["applicationId"]) ?? "";
  const capabilityName = stringOrUndefined(input["capabilityName"]) ?? "";
  const cap = ctx.store.get(capabilityKey(applicationId, capabilityName));
  if (cap === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Capability not found: ${capabilityName}`,
      404,
    );
  }
  return { Capability: cap };
};

const RegisterCapability: OperationHandler = (input, ctx) => {
  const applicationId = stringOrUndefined(input["applicationId"]) ?? "";
  const capabilityName = stringOrUndefined(input["capabilityName"]) ?? "";
  const cap = {
    Name: capabilityName,
    References: recordOrEmpty(input["capabilityConfig"]),
  };
  ctx.store.set(capabilityKey(applicationId, capabilityName), cap);
  return { ApplicationId: applicationId, CapabilityName: capabilityName };
};

const DeregisterCapability: OperationHandler = (input, ctx) => {
  const applicationId = stringOrUndefined(input["applicationId"]) ?? "";
  const capabilityName = stringOrUndefined(input["capabilityName"]) ?? "";
  ctx.store.delete(capabilityKey(applicationId, capabilityName));
  return {};
};

const GetDefaultApplicationSetting: OperationHandler = (_input, ctx) => {
  const settings = ctx.store.get<unknown[]>(`defaultAppSettings`) ?? [];
  return { ApplicationSettings: settings };
};

const PutDefaultApplicationSetting: OperationHandler = (input, ctx) => {
  const settings = Array.isArray(input["ApplicationSettings"])
    ? (input["ApplicationSettings"] as unknown[])
    : [];
  ctx.store.set(`defaultAppSettings`, settings);
  return {};
};

const CreatePackage: OperationHandler = (input, ctx) => {
  const packageId = `F${hex(8).toUpperCase()}`;
  const packageName =
    stringOrUndefined(input["PackageName"]) ?? `package-${packageId}`;
  const now = Math.floor(Date.now() / 1000);
  const pkg: StoredPackage = {
    packageId,
    packageName,
    packageType: stringOrUndefined(input["PackageType"]) ?? "TXT-DICTIONARY",
    packageDescription: stringOrUndefined(input["PackageDescription"]) ?? "",
    packageStatus: "AVAILABLE",
    createdAt: now,
    lastUpdatedAt: now,
    availablePackageVersion: "1.0.0",
    engineVersion: stringOrUndefined(input["EngineVersion"]) ?? "",
    associatedDomains: [],
    arn: `arn:aws:es:${ctx.region}:${ctx.account}:packages/${packageId}`,
  };
  ctx.store.set(pkgKey(packageId), pkg);
  return { PackageDetails: packageDetailsView(pkg) };
};

const DeletePackage: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  ctx.store.delete(pkgKey(packageId));
  ctx.store.delete(tagKey(pkg.arn));
  return {
    PackageDetails: { ...packageDetailsView(pkg), PackageStatus: "DELETING" },
  };
};

const UpdatePackage: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  if (input["PackageDescription"] !== undefined) {
    pkg.packageDescription =
      stringOrUndefined(input["PackageDescription"]) ?? pkg.packageDescription;
  }
  pkg.lastUpdatedAt = Math.floor(Date.now() / 1000);
  ctx.store.set(pkgKey(packageId), pkg);
  return { PackageDetails: packageDetailsView(pkg) };
};

const UpdatePackageScope: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  return {
    PackageID: pkg.packageId,
    PackageUserList: [],
    PackageScopeOperationStatus: "COMPLETED",
  };
};

const DescribePackages: OperationHandler = (input, ctx) => {
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as unknown[])
    : [];
  let packages = ctx.store
    .list<StoredPackage>()
    .filter((entry) => entry.key.startsWith("package/"))
    .map((entry) => entry.value);
  for (const filter of filters) {
    const f = filter as Record<string, unknown>;
    const name = stringOrUndefined(f["Name"]);
    const values = Array.isArray(f["Value"]) ? (f["Value"] as string[]) : [];
    if (values.length === 0) continue;
    if (name === "PackageID") {
      packages = packages.filter((p) => values.includes(p.packageId));
    } else if (name === "PackageStatus") {
      packages = packages.filter((p) => values.includes(p.packageStatus));
    } else if (name === "EngineVersion") {
      packages = packages.filter((p) => values.includes(p.engineVersion));
    } else if (name === "PackageName") {
      packages = packages.filter((p) => values.includes(p.packageName));
    } else if (name === "PackageType") {
      packages = packages.filter((p) => values.includes(p.packageType));
    }
  }
  const { items, nextToken } = paginateList(
    packages,
    input["MaxResults"],
    input["NextToken"],
  );
  return {
    PackageDetailsList: items.map(packageDetailsView),
    NextToken: nextToken,
  };
};

const AssociatePackage: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  requireDomain(ctx, domainName);
  if (!pkg.associatedDomains.includes(domainName)) {
    pkg.associatedDomains.push(domainName);
    ctx.store.set(pkgKey(packageId), pkg);
  }
  return {
    DomainPackageDetails: domainPackageDetails(pkg, domainName, "ACTIVE"),
  };
};

const AssociatePackages: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const packages = Array.isArray(input["PackageList"])
    ? (input["PackageList"] as { PackageID?: string }[])
    : [];
  const details: Record<string, unknown>[] = [];
  for (const item of packages) {
    const packageId = item.PackageID ?? "";
    const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
    if (pkg === undefined) continue;
    if (!pkg.associatedDomains.includes(domainName)) {
      pkg.associatedDomains.push(domainName);
      ctx.store.set(pkgKey(packageId), pkg);
    }
    details.push(domainPackageDetails(pkg, domainName, "ACTIVE"));
  }
  return { DomainPackageDetailsList: details };
};

const DissociatePackage: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  requireDomain(ctx, domainName);
  pkg.associatedDomains = pkg.associatedDomains.filter((d) => d !== domainName);
  ctx.store.set(pkgKey(packageId), pkg);
  return {
    DomainPackageDetails: domainPackageDetails(pkg, domainName, "DISSOCIATING"),
  };
};

const DissociatePackages: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const packages = Array.isArray(input["PackageList"])
    ? (input["PackageList"] as { PackageID?: string }[])
    : [];
  const details: Record<string, unknown>[] = [];
  for (const item of packages) {
    const packageId = item.PackageID ?? "";
    const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
    if (pkg === undefined) continue;
    pkg.associatedDomains = pkg.associatedDomains.filter(
      (d) => d !== domainName,
    );
    ctx.store.set(pkgKey(packageId), pkg);
    details.push(domainPackageDetails(pkg, domainName, "DISSOCIATING"));
  }
  return { DomainPackageDetailsList: details };
};

const GetPackageVersionHistory: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  return {
    PackageID: pkg.packageId,
    PackageVersionHistoryList: [
      {
        PackageVersion: pkg.availablePackageVersion,
        CommitMessage: "Initial version",
        CreatedAt: pkg.createdAt,
        PluginProperties: undefined,
        PackageConfiguration: undefined,
      },
    ],
    NextToken: undefined,
  };
};

const ListDomainsForPackage: OperationHandler = (input, ctx) => {
  const packageId = stringOrUndefined(input["PackageID"]) ?? "";
  const pkg = ctx.store.get<StoredPackage>(pkgKey(packageId));
  if (pkg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Package not found: ${packageId}`,
      404,
    );
  }
  return {
    DomainPackageDetailsList: pkg.associatedDomains.map((d) =>
      domainPackageDetails(pkg, d, "ACTIVE"),
    ),
    NextToken: undefined,
  };
};

const ListPackagesForDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const packages = ctx.store
    .list<StoredPackage>()
    .filter(
      (entry) =>
        entry.key.startsWith("package/") &&
        entry.value.associatedDomains.includes(domainName),
    )
    .map((entry) => domainPackageDetails(entry.value, domainName, "ACTIVE"));
  return { DomainPackageDetailsList: packages, NextToken: undefined };
};

const CreateVpcEndpoint: OperationHandler = (input, ctx) => {
  const domainArn = stringOrUndefined(input["DomainArn"]) ?? "";
  requireDomainByArn(ctx, domainArn);
  const vpcEndpointId = `aos-${hex(8)}`;
  const ep: StoredVpcEndpoint = {
    vpcEndpointId,
    vpcEndpointOwner: ctx.account,
    domainArn,
    vpcOptions: recordOrEmpty(input["VpcOptions"]),
    status: "CREATING",
    endpoint: `${vpcEndpointId}.${ctx.region}.aoss.amazonaws.com`,
    arn: `arn:aws:es:${ctx.region}:${ctx.account}:vpc-endpoints/${vpcEndpointId}`,
  };
  ctx.store.set(vpcKey(vpcEndpointId), ep);
  return { VpcEndpoint: vpcEndpointView(ep) };
};

const DeleteVpcEndpoint: OperationHandler = (input, ctx) => {
  const vpcEndpointId = stringOrUndefined(input["VpcEndpointId"]) ?? "";
  const ep = ctx.store.get<StoredVpcEndpoint>(vpcKey(vpcEndpointId));
  if (ep === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `VPC endpoint not found: ${vpcEndpointId}`,
      404,
    );
  }
  if (ep.status === "CREATING" || ep.status === "DELETING") {
    throw awsError(
      "DisabledOperationException",
      `VPC endpoint ${vpcEndpointId} cannot be deleted in ${ep.status} state`,
      409,
    );
  }
  ep.status = "DELETING";
  ctx.store.set(vpcKey(vpcEndpointId), ep);
  ctx.store.delete(tagKey(ep.arn));
  return {
    VpcEndpointSummary: vpcEndpointSummaryView(ep),
  };
};

const DescribeVpcEndpoints: OperationHandler = (input, ctx) => {
  const ids = Array.isArray(input["VpcEndpointIds"])
    ? (input["VpcEndpointIds"] as string[])
    : [];
  const endpoints = ids
    .map((id) => {
      const ep = ctx.store.get<StoredVpcEndpoint>(vpcKey(id));
      if (ep === undefined) return undefined;
      if (ep.status === "CREATING") {
        ep.status = "ACTIVE";
        ctx.store.set(vpcKey(id), ep);
      }
      return vpcEndpointView(ep);
    })
    .filter((ep): ep is Record<string, unknown> => ep !== undefined);
  return { VpcEndpoints: endpoints, VpcEndpointErrors: [] };
};

const ListVpcEndpoints: OperationHandler = (input, ctx) => {
  const all = ctx.store
    .list<StoredVpcEndpoint>()
    .filter((entry) => entry.key.startsWith("vpcEndpoint/"))
    .map((entry) => vpcEndpointSummaryView(entry.value));
  const { items, nextToken } = paginateList(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { VpcEndpointSummaryList: items, NextToken: nextToken };
};

const ListVpcEndpointsForDomain: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  const domain = requireDomain(ctx, domainName);
  const domainArn = domain.arn;
  const summaries = ctx.store
    .list<StoredVpcEndpoint>()
    .filter(
      (entry) =>
        entry.key.startsWith("vpcEndpoint/") &&
        entry.value.domainArn === domainArn,
    )
    .map((entry) => vpcEndpointSummaryView(entry.value));
  return { VpcEndpointSummaryList: summaries, NextToken: undefined };
};

const UpdateVpcEndpoint: OperationHandler = (input, ctx) => {
  const vpcEndpointId = stringOrUndefined(input["VpcEndpointId"]) ?? "";
  const ep = ctx.store.get<StoredVpcEndpoint>(vpcKey(vpcEndpointId));
  if (ep === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `VPC endpoint not found: ${vpcEndpointId}`,
      404,
    );
  }
  if (input["VpcOptions"] !== undefined) {
    ep.vpcOptions = recordOrEmpty(input["VpcOptions"]);
  }
  ctx.store.set(vpcKey(vpcEndpointId), ep);
  return { VpcEndpoint: vpcEndpointView(ep) };
};

const AuthorizeVpcEndpointAccess: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const account = stringOrUndefined(input["Account"]) ?? "";
  const existing = ctx.store.get<string[]>(vpcAccessKey(domainName)) ?? [];
  if (!existing.includes(account)) {
    existing.push(account);
    ctx.store.set(vpcAccessKey(domainName), existing);
  }
  return {
    AuthorizedPrincipal: {
      PrincipalType: "AWS_ACCOUNT",
      Principal: account,
    },
  };
};

const RevokeVpcEndpointAccess: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const account = stringOrUndefined(input["Account"]) ?? "";
  const existing = ctx.store.get<string[]>(vpcAccessKey(domainName)) ?? [];
  const updated = existing.filter((a) => a !== account);
  ctx.store.set(vpcAccessKey(domainName), updated);
  return {};
};

const ListVpcEndpointAccess: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const accounts = ctx.store.get<string[]>(vpcAccessKey(domainName)) ?? [];
  return {
    AuthorizedPrincipalList: accounts.map((a) => ({
      PrincipalType: "AWS_ACCOUNT",
      Principal: a,
    })),
    NextToken: undefined,
  };
};

const CreateOutboundConnection: OperationHandler = (input, ctx) => {
  const connectionId = `or-${hex(12)}`;
  const inboundConnectionId = `ir-${hex(12)}`;
  const conn: StoredConnection = {
    connectionId,
    localDomainInfo: recordOrEmpty(input["LocalDomainInfo"]),
    remoteDomainInfo: recordOrEmpty(input["RemoteDomainInfo"]),
    connectionStatus: {
      StatusCode: "VALIDATING",
      Message: "Validating connection",
    },
    connectionMode: stringOrUndefined(input["ConnectionMode"]) ?? "DIRECT",
    connectionAlias: stringOrUndefined(input["ConnectionAlias"]) ?? "",
  };
  ctx.store.set(outboundKey(connectionId), conn);
  const inbound: StoredConnection = {
    connectionId: inboundConnectionId,
    localDomainInfo: conn.remoteDomainInfo,
    remoteDomainInfo: conn.localDomainInfo,
    connectionStatus: {
      StatusCode: "PENDING_ACCEPTANCE",
      Message: "Pending acceptance",
    },
    connectionMode: conn.connectionMode,
    connectionAlias: conn.connectionAlias,
  };
  ctx.store.set(inboundKey(inboundConnectionId), inbound);
  return {
    LocalDomainInfo: conn.localDomainInfo,
    RemoteDomainInfo: conn.remoteDomainInfo,
    ConnectionAlias: conn.connectionAlias,
    ConnectionStatus: conn.connectionStatus,
    ConnectionId: conn.connectionId,
    ConnectionMode: conn.connectionMode,
    ConnectionProperties: undefined,
  };
};

const DeleteOutboundConnection: OperationHandler = (input, ctx) => {
  const connectionId = stringOrUndefined(input["ConnectionId"]) ?? "";
  const conn = ctx.store.get<StoredConnection>(outboundKey(connectionId));
  if (conn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Outbound connection not found: ${connectionId}`,
      404,
    );
  }
  ctx.store.delete(outboundKey(connectionId));
  return {
    Connection: outboundConnectionView({
      ...conn,
      connectionStatus: { StatusCode: "DELETED", Message: "Deleted" },
    }),
  };
};

const DescribeOutboundConnections: OperationHandler = (input, ctx) => {
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as unknown[])
    : [];
  let conns = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith("outboundConnection/"))
    .map((entry) => entry.value);
  if (filters.length > 0) {
    for (const filter of filters) {
      const f = filter as Record<string, unknown>;
      const name = stringOrUndefined(f["Name"]);
      const values = Array.isArray(f["Values"])
        ? (f["Values"] as string[])
        : [];
      if (name === "connection-id" && values.length > 0) {
        conns = conns.filter((c) => values.includes(c.connectionId));
      }
    }
  }
  const transitioned = conns.map((conn) => {
    const status = conn.connectionStatus as Record<string, unknown>;
    if (status["StatusCode"] === "VALIDATING") {
      conn.connectionStatus = {
        StatusCode: "PENDING_ACCEPTANCE",
        Message: "Pending acceptance",
      };
      ctx.store.set(outboundKey(conn.connectionId), conn);
    }
    return outboundConnectionView(conn);
  });
  return {
    Connections: transitioned,
    NextToken: undefined,
  };
};

const AcceptInboundConnection: OperationHandler = (input, ctx) => {
  const connectionId = stringOrUndefined(input["ConnectionId"]) ?? "";
  const conn = ctx.store.get<StoredConnection>(inboundKey(connectionId));
  if (conn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Inbound connection not found: ${connectionId}`,
      404,
    );
  }
  conn.connectionStatus = { StatusCode: "ACTIVE", Message: "Active" };
  ctx.store.set(inboundKey(connectionId), conn);
  return { Connection: inboundConnectionView(conn) };
};

const RejectInboundConnection: OperationHandler = (input, ctx) => {
  const connectionId = stringOrUndefined(input["ConnectionId"]) ?? "";
  const conn = ctx.store.get<StoredConnection>(inboundKey(connectionId));
  if (conn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Inbound connection not found: ${connectionId}`,
      404,
    );
  }
  conn.connectionStatus = { StatusCode: "REJECTED", Message: "Rejected" };
  ctx.store.set(inboundKey(connectionId), conn);
  return { Connection: inboundConnectionView(conn) };
};

const DeleteInboundConnection: OperationHandler = (input, ctx) => {
  const connectionId = stringOrUndefined(input["ConnectionId"]) ?? "";
  const conn = ctx.store.get<StoredConnection>(inboundKey(connectionId));
  if (conn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Inbound connection not found: ${connectionId}`,
      404,
    );
  }
  ctx.store.delete(inboundKey(connectionId));
  return {
    Connection: inboundConnectionView({
      ...conn,
      connectionStatus: { StatusCode: "DELETED", Message: "Deleted" },
    }),
  };
};

const DescribeInboundConnections: OperationHandler = (input, ctx) => {
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as unknown[])
    : [];
  let conns = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith("inboundConnection/"))
    .map((entry) => entry.value);
  if (filters.length > 0) {
    for (const filter of filters) {
      const f = filter as Record<string, unknown>;
      const name = stringOrUndefined(f["Name"]);
      const values = Array.isArray(f["Values"])
        ? (f["Values"] as string[])
        : [];
      if (name === "connection-id" && values.length > 0) {
        conns = conns.filter((c) => values.includes(c.connectionId));
      }
    }
  }
  return {
    Connections: conns.map(inboundConnectionView),
    NextToken: undefined,
  };
};

const AddDataSource: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const name = stringOrUndefined(input["Name"]) ?? "";
  const ds: StoredDataSource = {
    name,
    dataSourceType: recordOrEmpty(input["DataSourceType"]),
    description: stringOrUndefined(input["Description"]) ?? "",
  };
  ctx.store.set(dataSourceKey(domainName, name), ds);
  return { Message: "Data source added successfully." };
};

const GetDataSource: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const name = stringOrUndefined(input["Name"]) ?? "";
  const ds = ctx.store.get<StoredDataSource>(dataSourceKey(domainName, name));
  if (ds === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Data source not found: ${name}`,
      404,
    );
  }
  return {
    DataSourceType: ds.dataSourceType,
    Name: ds.name,
    Description: ds.description,
    Status: "ACTIVE",
  };
};

const ListDataSources: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const prefix = `dataSource/${domainName}/`;
  const all = ctx.store
    .list<StoredDataSource>()
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      DataSourceType: entry.value.dataSourceType,
      Name: entry.value.name,
      Description: entry.value.description,
      Status: "ACTIVE",
    }));
  const { items, nextToken } = paginateList(
    all,
    input["MaxResults"],
    input["NextToken"],
  );
  return { DataSources: items, NextToken: nextToken };
};

const UpdateDataSource: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const name = stringOrUndefined(input["Name"]) ?? "";
  const ds = ctx.store.get<StoredDataSource>(dataSourceKey(domainName, name));
  if (ds === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Data source not found: ${name}`,
      404,
    );
  }
  if (input["DataSourceType"] !== undefined) {
    ds.dataSourceType = recordOrEmpty(input["DataSourceType"]);
  }
  if (input["Description"] !== undefined) {
    ds.description = stringOrUndefined(input["Description"]) ?? ds.description;
  }
  ctx.store.set(dataSourceKey(domainName, name), ds);
  return { Message: "Data source updated successfully." };
};

const DeleteDataSource: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const name = stringOrUndefined(input["Name"]) ?? "";
  if (ctx.store.get(dataSourceKey(domainName, name)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Data source not found: ${name}`,
      404,
    );
  }
  ctx.store.delete(dataSourceKey(domainName, name));
  return { Message: "Data source deleted successfully." };
};

const AddDirectQueryDataSource: OperationHandler = (input, ctx) => {
  const dataSourceName = stringOrUndefined(input["DataSourceName"]) ?? "";
  const ds: StoredDirectQueryDataSource = {
    dataSourceName,
    dataSourceType: recordOrEmpty(input["DataSourceType"]),
    description: stringOrUndefined(input["Description"]) ?? "",
    openSearchArns: Array.isArray(input["OpenSearchArns"])
      ? (input["OpenSearchArns"] as string[])
      : [],
  };
  ctx.store.set(directQueryKey(dataSourceName), ds);
  return {
    DataSourceArn: `arn:aws:opensearch:${ctx.region}:${ctx.account}:datasource/${dataSourceName}`,
  };
};

const GetDirectQueryDataSource: OperationHandler = (input, ctx) => {
  const dataSourceName = stringOrUndefined(input["DataSourceName"]) ?? "";
  const ds = ctx.store.get<StoredDirectQueryDataSource>(
    directQueryKey(dataSourceName),
  );
  if (ds === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Direct query data source not found: ${dataSourceName}`,
      404,
    );
  }
  return {
    DataSourceName: ds.dataSourceName,
    DataSourceType: ds.dataSourceType,
    Description: ds.description,
    OpenSearchArns: ds.openSearchArns,
    DataSourceAccessPolicy: undefined,
    DataSourceArn: `arn:aws:opensearch:${ctx.region}:${ctx.account}:datasource/${ds.dataSourceName}`,
  };
};

const ListDirectQueryDataSources: OperationHandler = (_input, ctx) => {
  const sources = ctx.store
    .list<StoredDirectQueryDataSource>()
    .filter((entry) => entry.key.startsWith("directQueryDataSource/"))
    .map((entry) => ({
      DataSourceName: entry.value.dataSourceName,
      DataSourceType: entry.value.dataSourceType,
      Description: entry.value.description,
      OpenSearchArns: entry.value.openSearchArns,
      DataSourceArn: `arn:aws:opensearch:${ctx.region}:${ctx.account}:datasource/${entry.value.dataSourceName}`,
    }));
  return { NextToken: undefined, DirectQueryDataSources: sources };
};

const UpdateDirectQueryDataSource: OperationHandler = (input, ctx) => {
  const dataSourceName = stringOrUndefined(input["DataSourceName"]) ?? "";
  const ds = ctx.store.get<StoredDirectQueryDataSource>(
    directQueryKey(dataSourceName),
  );
  if (ds === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Direct query data source not found: ${dataSourceName}`,
      404,
    );
  }
  if (input["Description"] !== undefined) {
    ds.description = stringOrUndefined(input["Description"]) ?? ds.description;
  }
  if (input["OpenSearchArns"] !== undefined) {
    ds.openSearchArns = Array.isArray(input["OpenSearchArns"])
      ? (input["OpenSearchArns"] as string[])
      : ds.openSearchArns;
  }
  ctx.store.set(directQueryKey(dataSourceName), ds);
  return {
    DataSourceArn: `arn:aws:opensearch:${ctx.region}:${ctx.account}:datasource/${dataSourceName}`,
  };
};

const DeleteDirectQueryDataSource: OperationHandler = (input, ctx) => {
  const dataSourceName = stringOrUndefined(input["DataSourceName"]) ?? "";
  if (ctx.store.get(directQueryKey(dataSourceName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Direct query data source not found: ${dataSourceName}`,
      404,
    );
  }
  ctx.store.delete(directQueryKey(dataSourceName));
  return {};
};

const CreateIndex: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const indexName = stringOrUndefined(input["IndexName"]) ?? "";
  const idx: StoredIndex = {
    indexName,
    indexSchema: recordOrEmpty(input["IndexSchema"]),
    status: "CREATED",
  };
  ctx.store.set(indexKey(domainName, indexName), idx);
  return { Status: "CREATED" };
};

const GetIndex: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const indexName = stringOrUndefined(input["IndexName"]) ?? "";
  const idx = ctx.store.get<StoredIndex>(indexKey(domainName, indexName));
  if (idx === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Index not found: ${indexName}`,
      404,
    );
  }
  return { Status: idx.status, IndexSchema: idx.indexSchema };
};

const UpdateIndex: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const indexName = stringOrUndefined(input["IndexName"]) ?? "";
  const idx = ctx.store.get<StoredIndex>(indexKey(domainName, indexName));
  if (idx === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Index not found: ${indexName}`,
      404,
    );
  }
  if (input["IndexSchema"] !== undefined) {
    idx.indexSchema = recordOrEmpty(input["IndexSchema"]);
  }
  idx.status = "UPDATED";
  ctx.store.set(indexKey(domainName, indexName), idx);
  return { Status: "UPDATED" };
};

const DeleteIndex: OperationHandler = (input, ctx) => {
  const domainName = stringOrUndefined(input["DomainName"]) ?? "";
  requireDomain(ctx, domainName);
  const indexName = stringOrUndefined(input["IndexName"]) ?? "";
  if (ctx.store.get(indexKey(domainName, indexName)) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Index not found: ${indexName}`,
      404,
    );
  }
  ctx.store.delete(indexKey(domainName, indexName));
  return { Status: "DELETED" };
};

const AddTags: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ARN"]) ?? "";
  const tagList = Array.isArray(input["TagList"])
    ? (input["TagList"] as { Key?: string; Value?: string }[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  for (const tag of tagList) {
    if (tag.Key !== undefined && tag.Value !== undefined) {
      existing[tag.Key] = tag.Value;
    }
  }
  ctx.store.set(tagKey(arn), existing);
  return {};
};

const ListTags: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ARN"]) ?? "";
  const tags = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  return {
    TagList: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
  };
};

const RemoveTags: OperationHandler = (input, ctx) => {
  const arn = stringOrUndefined(input["ARN"]) ?? "";
  const tagKeys = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagKey(arn), existing);
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const opensearch = {
  name: "es",
  protocol: "rest-json",
  matches: (req: ParsedRequest): boolean => req.path.startsWith("/2021-01-01/"),
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] !== "2021-01-01") return undefined;
    const seg1 = parts[1];

    if (seg1 === "domain") {
      if (parts.length === 2 && req.method === "GET") return "ListDomainNames";
      if (parts.length === 4 && parts[3] === "packages" && req.method === "GET")
        return "ListPackagesForDomain";
      return undefined;
    }

    if (seg1 === "tags") {
      if (req.method === "POST") return "AddTags";
      if (req.method === "GET") return "ListTags";
      return undefined;
    }

    if (seg1 === "tags-removal") {
      if (req.method === "POST") return "RemoveTags";
      return undefined;
    }

    if (seg1 === "packages") {
      if (parts.length === 2 && req.method === "POST") return "CreatePackage";
      const seg2 = parts[2];
      if (seg2 === "describe" && req.method === "POST")
        return "DescribePackages";
      if (seg2 === "update" && req.method === "POST") return "UpdatePackage";
      if (seg2 === "updateScope" && req.method === "POST")
        return "UpdatePackageScope";
      if (seg2 === "associateMultiple" && req.method === "POST")
        return "AssociatePackages";
      if (seg2 === "dissociateMultiple" && req.method === "POST")
        return "DissociatePackages";
      if (seg2 === "associate" && parts.length === 5 && req.method === "POST")
        return "AssociatePackage";
      if (seg2 === "dissociate" && parts.length === 5 && req.method === "POST")
        return "DissociatePackage";
      if (parts.length === 3 && req.method === "DELETE") return "DeletePackage";
      if (parts.length === 4 && parts[3] === "history" && req.method === "GET")
        return "GetPackageVersionHistory";
      if (parts.length === 4 && parts[3] === "domains" && req.method === "GET")
        return "ListDomainsForPackage";
      return undefined;
    }

    if (seg1 !== "opensearch") return undefined;

    const seg2 = parts[2];

    if (seg2 === "application") {
      if (parts.length === 3 && req.method === "POST")
        return "CreateApplication";
      if (parts.length === 4) {
        if (req.method === "GET") return "GetApplication";
        if (req.method === "PUT") return "UpdateApplication";
        if (req.method === "DELETE") return "DeleteApplication";
      }
      if (parts.length === 6 && parts[4] === "capability") {
        if (parts[5] === "register" && req.method === "POST")
          return "RegisterCapability";
        if (req.method === "GET") return "GetCapability";
      }
      if (
        parts.length === 7 &&
        parts[4] === "capability" &&
        parts[5] === "deregister" &&
        req.method === "DELETE"
      )
        return "DeregisterCapability";
      return undefined;
    }

    if (
      seg2 === "list-applications" &&
      parts.length === 3 &&
      req.method === "GET"
    )
      return "ListApplications";

    if (seg2 === "defaultApplicationSetting" && parts.length === 3) {
      if (req.method === "GET") return "GetDefaultApplicationSetting";
      if (req.method === "PUT") return "PutDefaultApplicationSetting";
    }

    if (seg2 === "domain") {
      if (parts.length === 3 && req.method === "POST") return "CreateDomain";
      if (parts.length === 4) {
        if (req.method === "GET") return "DescribeDomain";
        if (req.method === "DELETE") return "DeleteDomain";
      }
      if (parts.length === 5) {
        const seg4 = parts[4];
        if (seg4 === "config") {
          if (req.method === "GET") return "DescribeDomainConfig";
          if (req.method === "POST") return "UpdateDomainConfig";
        }
        if (seg4 === "autoTunes" && req.method === "GET")
          return "DescribeDomainAutoTunes";
        if (seg4 === "progress" && req.method === "GET")
          return "DescribeDomainChangeProgress";
        if (seg4 === "health" && req.method === "GET")
          return "DescribeDomainHealth";
        if (seg4 === "nodes" && req.method === "GET")
          return "DescribeDomainNodes";
        if (seg4 === "dryRun" && req.method === "GET")
          return "DescribeDryRunProgress";
        if (seg4 === "authorizeVpcEndpointAccess" && req.method === "POST")
          return "AuthorizeVpcEndpointAccess";
        if (seg4 === "revokeVpcEndpointAccess" && req.method === "POST")
          return "RevokeVpcEndpointAccess";
        if (seg4 === "listVpcEndpointAccess" && req.method === "GET")
          return "ListVpcEndpointAccess";
        if (seg4 === "vpcEndpoints" && req.method === "GET")
          return "ListVpcEndpointsForDomain";
        if (seg4 === "dataSource") {
          if (req.method === "POST") return "AddDataSource";
          if (req.method === "GET") return "ListDataSources";
        }
        if (seg4 === "index" && req.method === "POST") return "CreateIndex";
        if (seg4 === "domainMaintenance") {
          if (req.method === "POST") return "StartDomainMaintenance";
          if (req.method === "GET") return "GetDomainMaintenanceStatus";
        }
        if (seg4 === "domainMaintenances" && req.method === "GET")
          return "ListDomainMaintenances";
        if (seg4 === "scheduledActions" && req.method === "GET")
          return "ListScheduledActions";
      }
      if (parts.length === 6) {
        const seg4 = parts[4];
        const seg5 = parts[5];
        if (seg4 === "config" && seg5 === "cancel" && req.method === "POST")
          return "CancelDomainConfigChange";
        if (seg4 === "dataSource") {
          if (req.method === "GET") return "GetDataSource";
          if (req.method === "PUT") return "UpdateDataSource";
          if (req.method === "DELETE") return "DeleteDataSource";
        }
        if (seg4 === "index") {
          if (req.method === "GET") return "GetIndex";
          if (req.method === "PUT") return "UpdateIndex";
          if (req.method === "DELETE") return "DeleteIndex";
        }
        if (
          seg4 === "scheduledAction" &&
          seg5 === "update" &&
          req.method === "PUT"
        )
          return "UpdateScheduledAction";
      }
      return undefined;
    }

    if (seg2 === "domain-info" && parts.length === 3 && req.method === "POST")
      return "DescribeDomains";

    if (seg2 === "directQueryDataSource") {
      if (parts.length === 3) {
        if (req.method === "POST") return "AddDirectQueryDataSource";
        if (req.method === "GET") return "ListDirectQueryDataSources";
      }
      if (parts.length === 4) {
        if (req.method === "GET") return "GetDirectQueryDataSource";
        if (req.method === "PUT") return "UpdateDirectQueryDataSource";
        if (req.method === "DELETE") return "DeleteDirectQueryDataSource";
      }
      return undefined;
    }

    if (seg2 === "cc") {
      const seg3 = parts[3];
      if (seg3 === "inboundConnection") {
        if (parts.length === 5) {
          if (parts[4] === "search" && req.method === "POST")
            return "DescribeInboundConnections";
          if (req.method === "DELETE") return "DeleteInboundConnection";
        }
        if (parts.length === 6) {
          if (parts[5] === "accept" && req.method === "PUT")
            return "AcceptInboundConnection";
          if (parts[5] === "reject" && req.method === "PUT")
            return "RejectInboundConnection";
        }
      }
      if (seg3 === "outboundConnection") {
        if (parts.length === 4 && req.method === "POST")
          return "CreateOutboundConnection";
        if (parts.length === 5) {
          if (parts[4] === "search" && req.method === "POST")
            return "DescribeOutboundConnections";
          if (req.method === "DELETE") return "DeleteOutboundConnection";
        }
      }
      return undefined;
    }

    if (seg2 === "vpcEndpoints") {
      if (parts.length === 3) {
        if (req.method === "POST") return "CreateVpcEndpoint";
        if (req.method === "GET") return "ListVpcEndpoints";
      }
      if (parts.length === 4) {
        if (parts[3] === "describe" && req.method === "POST")
          return "DescribeVpcEndpoints";
        if (parts[3] === "update" && req.method === "POST")
          return "UpdateVpcEndpoint";
        if (req.method === "DELETE") return "DeleteVpcEndpoint";
      }
      return undefined;
    }

    if (
      seg2 === "instanceTypeLimits" &&
      parts.length === 5 &&
      req.method === "GET"
    )
      return "DescribeInstanceTypeLimits";

    if (
      seg2 === "instanceTypeDetails" &&
      parts.length === 4 &&
      req.method === "GET"
    )
      return "ListInstanceTypeDetails";

    if (
      seg2 === "reservedInstanceOfferings" &&
      parts.length === 3 &&
      req.method === "GET"
    )
      return "DescribeReservedInstanceOfferings";

    if (
      seg2 === "reservedInstances" &&
      parts.length === 3 &&
      req.method === "GET"
    )
      return "DescribeReservedInstances";

    if (
      seg2 === "purchaseReservedInstanceOffering" &&
      parts.length === 3 &&
      req.method === "POST"
    )
      return "PurchaseReservedInstanceOffering";

    if (seg2 === "serviceSoftwareUpdate") {
      if (parts[3] === "cancel" && req.method === "POST")
        return "CancelServiceSoftwareUpdate";
      if (parts[3] === "rollback" && req.method === "POST")
        return "RollbackServiceSoftwareUpdate";
      if (parts[3] === "start" && req.method === "POST")
        return "StartServiceSoftwareUpdate";
      return undefined;
    }

    if (
      seg2 === "compatibleVersions" &&
      parts.length === 3 &&
      req.method === "GET"
    )
      return "GetCompatibleVersions";

    if (seg2 === "versions" && parts.length === 3 && req.method === "GET")
      return "ListVersions";

    if (seg2 === "upgradeDomain") {
      if (parts.length === 3 && req.method === "POST") return "UpgradeDomain";
      if (parts.length === 5) {
        if (parts[4] === "history" && req.method === "GET")
          return "GetUpgradeHistory";
        if (parts[4] === "status" && req.method === "GET")
          return "GetUpgradeStatus";
      }
      return undefined;
    }

    if (seg2 === "insights" && parts.length === 3 && req.method === "POST")
      return "ListInsights";

    if (
      seg2 === "insight-details" &&
      parts.length === 3 &&
      req.method === "POST"
    )
      return "DescribeInsightDetails";

    return undefined;
  },
  operations: {
    CreateDomain,
    DescribeDomain,
    DescribeDomains,
    ListDomainNames,
    DeleteDomain,
    UpdateDomainConfig,
    DescribeDomainConfig,
    DescribeDomainAutoTunes,
    DescribeDomainChangeProgress,
    DescribeDomainHealth,
    DescribeDomainNodes,
    DescribeDryRunProgress,
    CancelDomainConfigChange,
    GetDomainMaintenanceStatus,
    ListDomainMaintenances,
    StartDomainMaintenance,
    ListScheduledActions,
    UpdateScheduledAction,
    CancelServiceSoftwareUpdate,
    RollbackServiceSoftwareUpdate,
    StartServiceSoftwareUpdate,
    GetCompatibleVersions,
    GetUpgradeHistory,
    GetUpgradeStatus,
    ListVersions,
    UpgradeDomain,
    DescribeInstanceTypeLimits,
    ListInstanceTypeDetails,
    DescribeReservedInstanceOfferings,
    DescribeReservedInstances,
    PurchaseReservedInstanceOffering,
    ListInsights,
    DescribeInsightDetails,
    CreateApplication,
    GetApplication,
    UpdateApplication,
    DeleteApplication,
    ListApplications,
    GetCapability,
    RegisterCapability,
    DeregisterCapability,
    GetDefaultApplicationSetting,
    PutDefaultApplicationSetting,
    CreatePackage,
    DeletePackage,
    UpdatePackage,
    UpdatePackageScope,
    DescribePackages,
    AssociatePackage,
    AssociatePackages,
    DissociatePackage,
    DissociatePackages,
    GetPackageVersionHistory,
    ListDomainsForPackage,
    ListPackagesForDomain,
    CreateVpcEndpoint,
    DeleteVpcEndpoint,
    DescribeVpcEndpoints,
    ListVpcEndpoints,
    ListVpcEndpointsForDomain,
    UpdateVpcEndpoint,
    AuthorizeVpcEndpointAccess,
    RevokeVpcEndpointAccess,
    ListVpcEndpointAccess,
    CreateOutboundConnection,
    DeleteOutboundConnection,
    DescribeOutboundConnections,
    AcceptInboundConnection,
    RejectInboundConnection,
    DeleteInboundConnection,
    DescribeInboundConnections,
    AddDataSource,
    GetDataSource,
    ListDataSources,
    UpdateDataSource,
    DeleteDataSource,
    AddDirectQueryDataSource,
    GetDirectQueryDataSource,
    ListDirectQueryDataSources,
    UpdateDirectQueryDataSource,
    DeleteDirectQueryDataSource,
    CreateIndex,
    GetIndex,
    UpdateIndex,
    DeleteIndex,
    AddTags,
    ListTags,
    RemoveTags,
  },
  model,
} as const satisfies ServiceDefinition;

export default opensearch;
