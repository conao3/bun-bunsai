import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import redshiftModel from "../../../../test/vendor/aws-models/redshift.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(redshiftModel);

type StoredCluster = {
  ClusterIdentifier: string;
  NodeType: string;
  ClusterStatus: string;
  ClusterAvailabilityStatus: string;
  MasterUsername: string | undefined;
  DBName: string;
  Endpoint: {
    Address: string;
    Port: number;
  };
  ClusterCreateTime: string;
  AutomatedSnapshotRetentionPeriod: number;
  ManualSnapshotRetentionPeriod: number;
  ClusterSubnetGroupName: string | undefined;
  AvailabilityZone: string;
  PreferredMaintenanceWindow: string;
  ClusterVersion: string;
  AllowVersionUpgrade: boolean;
  NumberOfNodes: number;
  PubliclyAccessible: boolean;
  Encrypted: boolean;
  ClusterNamespaceArn: string;
  IamRoles: { IamRoleArn: string; ApplyStatus: string }[];
};

type StoredSubnet = {
  SubnetIdentifier: string;
  SubnetAvailabilityZone: {
    Name: string;
  };
  SubnetStatus: string;
};

type StoredClusterSubnetGroup = {
  ClusterSubnetGroupName: string;
  Description: string;
  VpcId: string;
  SubnetGroupStatus: string;
  Subnets: StoredSubnet[];
};

type StoredSnapshot = {
  SnapshotIdentifier: string;
  ClusterIdentifier: string;
  SnapshotCreateTime: string;
  Status: string;
  Port: number;
  AvailabilityZone: string;
  ClusterCreateTime: string;
  MasterUsername: string | undefined;
  ClusterVersion: string;
  NodeType: string;
  NumberOfNodes: number;
  DBName: string;
  Encrypted: boolean;
  ManualSnapshotRetentionPeriod: number;
  SnapshotType: string;
  AccountsWithRestoreAccess: { AccountId: string }[];
};

type StoredParameter = {
  ParameterName: string;
  ParameterValue: string;
  Description: string;
  Source: string;
  DataType: string;
  IsModifiable: boolean;
};

type StoredParameterGroup = {
  ParameterGroupName: string;
  ParameterGroupFamily: string;
  Description: string;
  Parameters: StoredParameter[];
};

type StoredSecurityGroup = {
  ClusterSecurityGroupName: string;
  Description: string;
  EC2SecurityGroups: {
    Status: string;
    EC2SecurityGroupName: string;
    EC2SecurityGroupOwnerId: string;
  }[];
  IPRanges: { Status: string; CIDRIP: string }[];
};

type StoredLoggingStatus = {
  LoggingEnabled: boolean;
  BucketName: string | undefined;
  S3KeyPrefix: string | undefined;
  LogDestinationType: string | undefined;
  LogExports: string[];
};

type StoredTableRestoreStatus = {
  TableRestoreRequestId: string;
  Status: string;
  RequestTime: string;
  ClusterIdentifier: string;
  SnapshotIdentifier: string;
  SourceDatabaseName: string;
  SourceSchemaName: string | undefined;
  SourceTableName: string;
  TargetDatabaseName: string | undefined;
  TargetSchemaName: string | undefined;
  NewTableName: string;
};

type StoredEventSubscription = {
  CustomerAwsId: string;
  CustSubscriptionId: string;
  SnsTopicArn: string;
  Status: string;
  SubscriptionCreationTime: string;
  SourceType: string | undefined;
  SourceIdsList: string[];
  EventCategoriesList: string[];
  Severity: string;
  Enabled: boolean;
  Tags: { Key: string; Value: string }[];
};

type StoredSnapshotCopyGrant = {
  SnapshotCopyGrantName: string;
  KmsKeyId: string | undefined;
  Tags: { Key: string; Value: string }[];
};

type StoredSnapshotSchedule = {
  ScheduleIdentifier: string;
  ScheduleDefinitions: string[];
  ScheduleDescription: string | undefined;
  Tags: { Key: string; Value: string }[];
  NextInvocations: string[];
  AssociatedClusters: {
    ClusterIdentifier: string;
    ScheduleAssociationState: string;
  }[];
};

type StoredUsageLimit = {
  UsageLimitId: string;
  ClusterIdentifier: string;
  FeatureType: string;
  LimitType: string;
  Amount: number;
  Period: string;
  BreachAction: string;
  Tags: { Key: string; Value: string }[];
};

type StoredAuthenticationProfile = {
  AuthenticationProfileName: string;
  AuthenticationProfileContent: string;
};

type StoredCustomDomainAssociation = {
  ClusterIdentifier: string;
  CustomDomainName: string;
  CustomDomainCertificateArn: string;
  CustomDomainCertExpiryTime: string;
};

type StoredScheduledAction = {
  ScheduledActionName: string;
  TargetAction: Record<string, unknown>;
  Schedule: string;
  IamRole: string;
  ScheduledActionDescription: string | undefined;
  State: string;
  NextInvocations: string[];
  StartTime: string | undefined;
  EndTime: string | undefined;
};

type StoredSnapshotCopySettings = {
  DestinationRegion: string;
  RetentionPeriod: number;
  ManualSnapshotRetentionPeriod: number;
  SnapshotCopyGrantName: string | undefined;
};

type StoredDataShare = {
  DataShareArn: string;
  ProducerArn: string;
  AllowPubliclyAccessibleConsumers: boolean;
  DataShareAssociations: {
    ConsumerIdentifier: string | undefined;
    Status: string;
    ConsumerRegion: string | undefined;
    CreatedDate: string;
    StatusChangeDate: string;
    ProducerAllowedWrites: boolean | undefined;
    ConsumerAcceptedWrites: boolean | undefined;
  }[];
  ManagedBy: string | undefined;
  DataShareType: string | undefined;
};

type StoredEndpointAccess = {
  ClusterIdentifier: string;
  ResourceOwner: string;
  SubnetGroupName: string;
  EndpointStatus: string;
  EndpointName: string;
  EndpointCreateTime: string;
  Port: number;
  Address: string;
  VpcSecurityGroups: { VpcSecurityGroupId: string; Status: string }[];
  VpcEndpoint: {
    VpcEndpointId: string;
    VpcId: string;
    NetworkInterfaces: unknown[];
  };
};

type StoredEndpointAuthorization = {
  Grantor: string;
  Grantee: string;
  ClusterIdentifier: string;
  AuthorizeTime: string;
  ClusterStatus: string;
  Status: string;
  AllowedAllVPCs: boolean;
  AllowedVPCs: string[];
  EndpointCount: number;
};

type StoredHsmClientCertificate = {
  HsmClientCertificateIdentifier: string;
  HsmClientCertificatePublicKey: string;
  Tags: { Key: string; Value: string }[];
};

type StoredHsmConfiguration = {
  HsmConfigurationIdentifier: string;
  Description: string;
  HsmIpAddress: string;
  HsmPartitionName: string;
  Tags: { Key: string; Value: string }[];
};

type StoredReservedNodeOffering = {
  ReservedNodeOfferingId: string;
  NodeType: string;
  Duration: number;
  FixedPrice: number;
  UsagePrice: number;
  CurrencyCode: string;
  OfferingType: string;
  RecurringCharges: {
    RecurringChargeAmount: number;
    RecurringChargeFrequency: string;
  }[];
  ReservedNodeOfferingType: string;
};

type StoredReservedNode = {
  ReservedNodeId: string;
  ReservedNodeOfferingId: string;
  NodeType: string;
  StartTime: string;
  Duration: number;
  FixedPrice: number;
  UsagePrice: number;
  CurrencyCode: string;
  NodeCount: number;
  State: string;
  OfferingType: string;
  RecurringCharges: {
    RecurringChargeAmount: number;
    RecurringChargeFrequency: string;
  }[];
  ReservedNodeOfferingType: string;
};

type StoredReservedNodeExchangeStatus = {
  ReservedNodeExchangeRequestId: string;
  Status: string;
  RequestTime: string;
  SourceReservedNodeId: string;
  SourceReservedNodeType: string;
  SourceReservedNodeCount: number;
  TargetReservedNodeOfferingId: string;
  TargetReservedNodeType: string;
  TargetReservedNodeCount: number;
};

type StoredIntegration = {
  IntegrationArn: string;
  IntegrationName: string;
  SourceArn: string;
  TargetArn: string;
  Status: string;
  Errors: { ErrorCode: string; ErrorMessage: string }[];
  CreateTime: string;
  Description: string | undefined;
  KMSKeyId: string | undefined;
  AdditionalEncryptionContext: Record<string, string>;
  Tags: { Key: string; Value: string }[];
};

type StoredInboundIntegration = {
  IntegrationArn: string;
  SourceArn: string;
  TargetArn: string;
  Status: string;
  Errors: { ErrorCode: string; ErrorMessage: string }[];
  CreateTime: string;
};

type StoredAuthorizedTokenIssuer = {
  TrustedTokenIssuerArn: string | undefined;
  AuthorizedAudiencesList: string[];
};

type StoredRedshiftIdcApplication = {
  IdcInstanceArn: string;
  RedshiftIdcApplicationName: string;
  RedshiftIdcApplicationArn: string;
  IdentityNamespace: string | undefined;
  IdcDisplayName: string | undefined;
  IamRoleArn: string;
  IdcManagedApplicationArn: string;
  IdcOnboardStatus: string;
  AuthorizedTokenIssuerList: StoredAuthorizedTokenIssuer[];
  ServiceIntegrations: Record<string, unknown>[];
  ApplicationType: string | undefined;
  Tags: { Key: string; Value: string }[];
  SsoTagKeys: string[];
};

type StoredPartner = {
  ClusterIdentifier: string;
  DatabaseName: string;
  PartnerName: string;
  Status: string;
  StatusMessage: string | undefined;
  CreatedAt: string;
  UpdatedAt: string;
};

type StoredResourcePolicy = {
  ResourceArn: string;
  Policy: string;
};

type StoredLakehouseConfig = {
  ClusterIdentifier: string;
  LakehouseIdcApplicationArn: string | undefined;
  LakehouseRegistrationStatus: string;
  CatalogArn: string | undefined;
};

const clusterKey = (id: string): string => `cluster/${id}`;
const subnetGroupKey = (name: string): string => `subnetgroup/${name}`;
const snapshotKey = (id: string): string => `snapshot/${id}`;
const paramGroupKey = (name: string): string => `paramgroup/${name}`;
const secGroupKey = (name: string): string => `secgroup/${name}`;
const loggingKey = (clusterId: string): string => `logging/${clusterId}`;
const tableRestoreKey = (requestId: string): string =>
  `tablerestore/${requestId}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const eventSubKey = (name: string): string => `eventsub/${name}`;
const snapshotCopyGrantKey = (name: string): string => `snapcopygrant/${name}`;
const snapshotScheduleKey = (id: string): string => `snapschedule/${id}`;
const usageLimitKey = (id: string): string => `usagelimit/${id}`;
const authProfileKey = (name: string): string => `authprofile/${name}`;
const customDomainKey = (clusterId: string, domainName: string): string =>
  `customdomain/${clusterId}/${domainName}`;
const scheduledActionKey = (name: string): string => `scheduledaction/${name}`;
const snapshotCopyKey = (clusterId: string): string =>
  `snapshotcopy/${clusterId}`;
const datashareKey = (arn: string): string => `datashare/${arn}`;
const endpointKey = (name: string): string => `endpoint/${name}`;
const endpointAuthKey = (clusterId: string, account: string): string =>
  `endpointauth/${clusterId}/${account}`;
const hsmClientCertKey = (id: string): string => `hsmclientcert/${id}`;
const hsmConfigKey = (id: string): string => `hsmconfig/${id}`;
const reservedNodeOfferingKey = (id: string): string =>
  `reservednodeoffering/${id}`;
const reservedNodeKey = (id: string): string => `reservednode/${id}`;
const reservedNodeExchangeKey = (id: string): string =>
  `reservednodeexchange/${id}`;
const integrationKey = (arn: string): string => `integration/${arn}`;
const inboundIntegrationKey = (arn: string): string =>
  `inboundintegration/${arn}`;
const idcApplicationKey = (arn: string): string => `idcapplication/${arn}`;
const partnerKey = (
  clusterId: string,
  dbName: string,
  partnerName: string,
): string => `partner/${clusterId}/${dbName}/${partnerName}`;
const resourcePolicyKey = (arn: string): string => `resourcepolicy/${arn}`;
const lakehouseConfigKey = (clusterId: string): string =>
  `lakehouse/${clusterId}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidParameterValue", `${key} is required.`, 400);
  }
  return value;
};

const optionalString = (
  input: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

const numberOr = (
  input: Record<string, unknown>,
  key: string,
  fallback: number,
): number => {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const booleanOr = (
  input: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean => {
  const value = input[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return fallback;
};

const stringList = (input: Record<string, unknown>, key: string): string[] => {
  const value = input[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
};

const tagList = (
  input: Record<string, unknown>,
): { Key: string; Value: string }[] => {
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .filter(
      (t): t is Record<string, unknown> => t !== null && typeof t === "object",
    )
    .map((t) => ({
      Key: String(t["Key"] ?? ""),
      Value: String(t["Value"] ?? ""),
    }));
};

const requireCluster = (ctx: ServiceContext, id: string): StoredCluster => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError("ClusterNotFound", `Cluster ${id} not found.`, 404);
  }
  return cluster;
};

const requireSnapshot = (ctx: ServiceContext, id: string): StoredSnapshot => {
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
  if (snapshot === undefined) {
    throw awsError("ClusterSnapshotNotFound", `Snapshot ${id} not found.`, 404);
  }
  return snapshot;
};

const requireParameterGroup = (
  ctx: ServiceContext,
  name: string,
): StoredParameterGroup => {
  const group = ctx.store.get<StoredParameterGroup>(paramGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "ClusterParameterGroupNotFound",
      `Parameter group ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireSecurityGroup = (
  ctx: ServiceContext,
  name: string,
): StoredSecurityGroup => {
  const group = ctx.store.get<StoredSecurityGroup>(secGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "ClusterSecurityGroupNotFound",
      `Security group ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireSubnetGroup = (
  ctx: ServiceContext,
  name: string,
): StoredClusterSubnetGroup => {
  const group = ctx.store.get<StoredClusterSubnetGroup>(subnetGroupKey(name));
  if (group === undefined) {
    throw awsError(
      "ClusterSubnetGroupNotFound",
      `Subnet group ${name} not found.`,
      404,
    );
  }
  return group;
};

const requireEventSub = (
  ctx: ServiceContext,
  name: string,
): StoredEventSubscription => {
  const sub = ctx.store.get<StoredEventSubscription>(eventSubKey(name));
  if (sub === undefined) {
    throw awsError(
      "SubscriptionNotFound",
      `Subscription ${name} not found.`,
      404,
    );
  }
  return sub;
};

const requireSnapshotCopyGrant = (
  ctx: ServiceContext,
  name: string,
): StoredSnapshotCopyGrant => {
  const grant = ctx.store.get<StoredSnapshotCopyGrant>(
    snapshotCopyGrantKey(name),
  );
  if (grant === undefined) {
    throw awsError(
      "SnapshotCopyGrantNotFoundFault",
      `Snapshot copy grant ${name} not found.`,
      404,
    );
  }
  return grant;
};

const requireSnapshotSchedule = (
  ctx: ServiceContext,
  id: string,
): StoredSnapshotSchedule => {
  const schedule = ctx.store.get<StoredSnapshotSchedule>(
    snapshotScheduleKey(id),
  );
  if (schedule === undefined) {
    throw awsError(
      "SnapshotScheduleNotFound",
      `Snapshot schedule ${id} not found.`,
      404,
    );
  }
  return schedule;
};

const requireUsageLimit = (
  ctx: ServiceContext,
  id: string,
): StoredUsageLimit => {
  const limit = ctx.store.get<StoredUsageLimit>(usageLimitKey(id));
  if (limit === undefined) {
    throw awsError(
      "UsageLimitNotFoundFault",
      `Usage limit ${id} not found.`,
      404,
    );
  }
  return limit;
};

const requireAuthProfile = (
  ctx: ServiceContext,
  name: string,
): StoredAuthenticationProfile => {
  const profile = ctx.store.get<StoredAuthenticationProfile>(
    authProfileKey(name),
  );
  if (profile === undefined) {
    throw awsError(
      "AuthenticationProfileNotFoundFault",
      `Authentication profile ${name} not found.`,
      404,
    );
  }
  return profile;
};

const requireScheduledAction = (
  ctx: ServiceContext,
  name: string,
): StoredScheduledAction => {
  const action = ctx.store.get<StoredScheduledAction>(scheduledActionKey(name));
  if (action === undefined) {
    throw awsError(
      "ScheduledActionNotFound",
      `Scheduled action ${name} not found.`,
      404,
    );
  }
  return action;
};

const requireHsmClientCert = (
  ctx: ServiceContext,
  id: string,
): StoredHsmClientCertificate => {
  const cert = ctx.store.get<StoredHsmClientCertificate>(hsmClientCertKey(id));
  if (cert === undefined) {
    throw awsError(
      "HsmClientCertificateNotFoundFault",
      `HSM client certificate ${id} not found.`,
      404,
    );
  }
  return cert;
};

const requireHsmConfig = (
  ctx: ServiceContext,
  id: string,
): StoredHsmConfiguration => {
  const config = ctx.store.get<StoredHsmConfiguration>(hsmConfigKey(id));
  if (config === undefined) {
    throw awsError(
      "HsmConfigurationNotFoundFault",
      `HSM configuration ${id} not found.`,
      404,
    );
  }
  return config;
};

const requireReservedNodeOffering = (
  ctx: ServiceContext,
  id: string,
): StoredReservedNodeOffering => {
  const offering = ctx.store.get<StoredReservedNodeOffering>(
    reservedNodeOfferingKey(id),
  );
  if (offering === undefined) {
    throw awsError(
      "ReservedNodeOfferingNotFoundFault",
      `Reserved node offering ${id} not found.`,
      404,
    );
  }
  return offering;
};

const requireReservedNode = (
  ctx: ServiceContext,
  id: string,
): StoredReservedNode => {
  const node = ctx.store.get<StoredReservedNode>(reservedNodeKey(id));
  if (node === undefined) {
    throw awsError(
      "ReservedNodeNotFoundFault",
      `Reserved node ${id} not found.`,
      404,
    );
  }
  return node;
};

const namespaceArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:redshift:${region}:${account}:namespace:${crypto.randomUUID()}`;

const integrationArnOf = (region: string, account: string): string =>
  `arn:aws:redshift:${region}:${account}:integration:${crypto.randomUUID()}`;

const idcApplicationArnOf = (
  region: string,
  account: string,
  name: string,
): string =>
  `arn:aws:redshift:${region}:${account}:redshiftidcapplication/${name}`;

const requireIntegration = (
  ctx: ServiceContext,
  arn: string,
): StoredIntegration => {
  const integration = ctx.store.get<StoredIntegration>(integrationKey(arn));
  if (integration === undefined) {
    throw awsError(
      "IntegrationNotFoundFault",
      `Integration ${arn} not found.`,
      404,
    );
  }
  return integration;
};

const requireIdcApplication = (
  ctx: ServiceContext,
  arn: string,
): StoredRedshiftIdcApplication => {
  const app = ctx.store.get<StoredRedshiftIdcApplication>(
    idcApplicationKey(arn),
  );
  if (app === undefined) {
    throw awsError(
      "RedshiftIdcApplicationNotExistsFault",
      `IDC application ${arn} not found.`,
      404,
    );
  }
  return app;
};

const requirePartner = (
  ctx: ServiceContext,
  clusterId: string,
  dbName: string,
  partnerName: string,
): StoredPartner => {
  const partner = ctx.store.get<StoredPartner>(
    partnerKey(clusterId, dbName, partnerName),
  );
  if (partner === undefined) {
    throw awsError(
      "PartnerNotFoundFault",
      `Partner ${partnerName} not found.`,
      404,
    );
  }
  return partner;
};

const requireResourcePolicy = (
  ctx: ServiceContext,
  arn: string,
): StoredResourcePolicy => {
  const policy = ctx.store.get<StoredResourcePolicy>(resourcePolicyKey(arn));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundFault",
      `Resource policy for ${arn} not found.`,
      404,
    );
  }
  return policy;
};

const presentIntegration = (i: StoredIntegration) => ({
  IntegrationArn: i.IntegrationArn,
  IntegrationName: i.IntegrationName,
  SourceArn: i.SourceArn,
  TargetArn: i.TargetArn,
  Status: i.Status,
  Errors: i.Errors,
  CreateTime: i.CreateTime,
  Description: i.Description,
  KMSKeyId: i.KMSKeyId,
  AdditionalEncryptionContext: i.AdditionalEncryptionContext,
  Tags: i.Tags,
});

const presentInboundIntegration = (i: StoredInboundIntegration) => ({
  IntegrationArn: i.IntegrationArn,
  SourceArn: i.SourceArn,
  TargetArn: i.TargetArn,
  Status: i.Status,
  Errors: i.Errors,
  CreateTime: i.CreateTime,
});

const presentIdcApplication = (a: StoredRedshiftIdcApplication) => ({
  IdcInstanceArn: a.IdcInstanceArn,
  RedshiftIdcApplicationName: a.RedshiftIdcApplicationName,
  RedshiftIdcApplicationArn: a.RedshiftIdcApplicationArn,
  IdentityNamespace: a.IdentityNamespace,
  IdcDisplayName: a.IdcDisplayName,
  IamRoleArn: a.IamRoleArn,
  IdcManagedApplicationArn: a.IdcManagedApplicationArn,
  IdcOnboardStatus: a.IdcOnboardStatus,
  AuthorizedTokenIssuerList: a.AuthorizedTokenIssuerList,
  ServiceIntegrations: a.ServiceIntegrations,
  ApplicationType: a.ApplicationType,
  Tags: a.Tags,
  SsoTagKeys: a.SsoTagKeys,
});

const presentCluster = (cluster: StoredCluster) => ({
  ClusterIdentifier: cluster.ClusterIdentifier,
  NodeType: cluster.NodeType,
  ClusterStatus: cluster.ClusterStatus,
  ClusterAvailabilityStatus: cluster.ClusterAvailabilityStatus,
  MasterUsername: cluster.MasterUsername,
  DBName: cluster.DBName,
  Endpoint: {
    Address: cluster.Endpoint.Address,
    Port: cluster.Endpoint.Port,
  },
  ClusterCreateTime: cluster.ClusterCreateTime,
  AutomatedSnapshotRetentionPeriod: cluster.AutomatedSnapshotRetentionPeriod,
  ManualSnapshotRetentionPeriod: cluster.ManualSnapshotRetentionPeriod,
  ClusterSubnetGroupName: cluster.ClusterSubnetGroupName,
  AvailabilityZone: cluster.AvailabilityZone,
  PreferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
  ClusterVersion: cluster.ClusterVersion,
  AllowVersionUpgrade: cluster.AllowVersionUpgrade,
  NumberOfNodes: cluster.NumberOfNodes,
  PubliclyAccessible: cluster.PubliclyAccessible,
  Encrypted: cluster.Encrypted,
  ClusterNamespaceArn: cluster.ClusterNamespaceArn,
  IamRoles: cluster.IamRoles,
});

const presentSubnetGroup = (group: StoredClusterSubnetGroup) => ({
  ClusterSubnetGroupName: group.ClusterSubnetGroupName,
  Description: group.Description,
  VpcId: group.VpcId,
  SubnetGroupStatus: group.SubnetGroupStatus,
  Subnets: group.Subnets.map((subnet) => ({
    SubnetIdentifier: subnet.SubnetIdentifier,
    SubnetAvailabilityZone: {
      Name: subnet.SubnetAvailabilityZone.Name,
    },
    SubnetStatus: subnet.SubnetStatus,
  })),
});

const presentSnapshot = (snapshot: StoredSnapshot) => ({
  SnapshotIdentifier: snapshot.SnapshotIdentifier,
  ClusterIdentifier: snapshot.ClusterIdentifier,
  SnapshotCreateTime: snapshot.SnapshotCreateTime,
  Status: snapshot.Status,
  Port: snapshot.Port,
  AvailabilityZone: snapshot.AvailabilityZone,
  ClusterCreateTime: snapshot.ClusterCreateTime,
  MasterUsername: snapshot.MasterUsername,
  ClusterVersion: snapshot.ClusterVersion,
  NodeType: snapshot.NodeType,
  NumberOfNodes: snapshot.NumberOfNodes,
  DBName: snapshot.DBName,
  Encrypted: snapshot.Encrypted,
  ManualSnapshotRetentionPeriod: snapshot.ManualSnapshotRetentionPeriod,
  SnapshotType: snapshot.SnapshotType,
  AccountsWithRestoreAccess: snapshot.AccountsWithRestoreAccess.map((a) => ({
    AccountId: a.AccountId,
  })),
});

const presentParameterGroup = (group: StoredParameterGroup) => ({
  ParameterGroupName: group.ParameterGroupName,
  ParameterGroupFamily: group.ParameterGroupFamily,
  Description: group.Description,
});

const presentSecurityGroup = (group: StoredSecurityGroup) => ({
  ClusterSecurityGroupName: group.ClusterSecurityGroupName,
  Description: group.Description,
  EC2SecurityGroups: group.EC2SecurityGroups.map((sg) => ({
    Status: sg.Status,
    EC2SecurityGroupName: sg.EC2SecurityGroupName,
    EC2SecurityGroupOwnerId: sg.EC2SecurityGroupOwnerId,
  })),
  IPRanges: group.IPRanges.map((r) => ({
    Status: r.Status,
    CIDRIP: r.CIDRIP,
  })),
});

const defaultParameters = (family: string): StoredParameter[] => [
  {
    ParameterName: "enable_user_activity_logging",
    ParameterValue: "false",
    Description: "Enable logging of user activity",
    Source: "engine-default",
    DataType: "boolean",
    IsModifiable: true,
  },
  {
    ParameterName: "max_concurrency_scaling_clusters",
    ParameterValue: "1",
    Description: "Maximum number of concurrency scaling clusters",
    Source: "engine-default",
    DataType: "integer",
    IsModifiable: true,
  },
  {
    ParameterName: "auto_analyze",
    ParameterValue: "true",
    Description: "Enable automatic analyze",
    Source: "engine-default",
    DataType: "boolean",
    IsModifiable: true,
  },
];

const CreateCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const existing = ctx.store.get<StoredCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "ClusterAlreadyExists",
      `Cluster ${id} already exists.`,
      400,
    );
  }
  const nodeType = requireString(input, "NodeType");
  const masterUsername = requireString(input, "MasterUsername");
  const clusterType = optionalString(input, "ClusterType") ?? "multi-node";
  const numberOfNodes =
    clusterType === "single-node" ? 1 : numberOr(input, "NumberOfNodes", 1);
  const cluster: StoredCluster = {
    ClusterIdentifier: id,
    NodeType: nodeType,
    ClusterStatus: "available",
    ClusterAvailabilityStatus: "Available",
    MasterUsername: masterUsername,
    DBName: optionalString(input, "DBName") ?? "dev",
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.redshift.amazonaws.com`,
      Port: numberOr(input, "Port", 5439),
    },
    ClusterCreateTime: new Date().toISOString(),
    AutomatedSnapshotRetentionPeriod: numberOr(
      input,
      "AutomatedSnapshotRetentionPeriod",
      1,
    ),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      -1,
    ),
    ClusterSubnetGroupName: optionalString(input, "ClusterSubnetGroupName"),
    AvailabilityZone:
      optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`,
    PreferredMaintenanceWindow:
      optionalString(input, "PreferredMaintenanceWindow") ??
      "sat:06:00-sat:06:30",
    ClusterVersion: optionalString(input, "ClusterVersion") ?? "1.0",
    AllowVersionUpgrade: booleanOr(input, "AllowVersionUpgrade", true),
    NumberOfNodes: numberOfNodes,
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    Encrypted: booleanOr(input, "Encrypted", false),
    ClusterNamespaceArn: namespaceArnOf(ctx.region, ctx.account, id),
    IamRoles: [],
  };
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const DescribeClusters: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "ClusterIdentifier");
  if (id !== undefined) {
    const cluster = requireCluster(ctx, id);
    return { Clusters: [presentCluster(cluster)] };
  }
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => presentCluster(entry.value));
  return { Clusters: clusters };
};

const DeleteCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const presented = presentCluster(cluster);
  ctx.store.delete(clusterKey(id));
  return { Cluster: { ...presented, ClusterStatus: "deleting" } };
};

const ModifyCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const newId = optionalString(input, "NewClusterIdentifier");
  cluster.NodeType = optionalString(input, "NodeType") ?? cluster.NodeType;
  cluster.NumberOfNodes = numberOr(
    input,
    "NumberOfNodes",
    cluster.NumberOfNodes,
  );
  cluster.AutomatedSnapshotRetentionPeriod = numberOr(
    input,
    "AutomatedSnapshotRetentionPeriod",
    cluster.AutomatedSnapshotRetentionPeriod,
  );
  cluster.ManualSnapshotRetentionPeriod = numberOr(
    input,
    "ManualSnapshotRetentionPeriod",
    cluster.ManualSnapshotRetentionPeriod,
  );
  cluster.PreferredMaintenanceWindow =
    optionalString(input, "PreferredMaintenanceWindow") ??
    cluster.PreferredMaintenanceWindow;
  cluster.ClusterVersion =
    optionalString(input, "ClusterVersion") ?? cluster.ClusterVersion;
  cluster.AllowVersionUpgrade = booleanOr(
    input,
    "AllowVersionUpgrade",
    cluster.AllowVersionUpgrade,
  );
  cluster.PubliclyAccessible = booleanOr(
    input,
    "PubliclyAccessible",
    cluster.PubliclyAccessible,
  );
  if (newId !== undefined && newId !== id) {
    cluster.ClusterIdentifier = newId;
    ctx.store.delete(clusterKey(id));
    ctx.store.set(clusterKey(newId), cluster);
  } else {
    ctx.store.set(clusterKey(id), cluster);
  }
  return { Cluster: presentCluster(cluster) };
};

const PauseCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.ClusterStatus = "paused";
  cluster.ClusterAvailabilityStatus = "Unavailable";
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ResumeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.ClusterStatus = "available";
  cluster.ClusterAvailabilityStatus = "Available";
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const RebootCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.ClusterStatus = "available";
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const RotateEncryptionKey: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  cluster.Encrypted = true;
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ResizeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const nodeType = optionalString(input, "NodeType");
  const numberOfNodes = numberOr(input, "NumberOfNodes", cluster.NumberOfNodes);
  if (nodeType !== undefined) {
    cluster.NodeType = nodeType;
  }
  cluster.NumberOfNodes = numberOfNodes;
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const CancelResize: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, id);
  return {
    TargetNodeType: "dc2.large",
    TargetNumberOfNodes: 2,
    TargetClusterType: "multi-node",
    Status: "CANCELLED",
    ImportTablesCompleted: [],
    ImportTablesInProgress: [],
    ImportTablesNotStarted: [],
    ResizeType: "ClassicResize",
    Message: "Resize cancelled",
  };
};

const DescribeResize: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, id);
  return {
    TargetNodeType: "dc2.large",
    TargetNumberOfNodes: 2,
    TargetClusterType: "multi-node",
    Status: "SUCCEEDED",
    ImportTablesCompleted: [],
    ImportTablesInProgress: [],
    ImportTablesNotStarted: [],
    ResizeType: "ClassicResize",
  };
};

const ModifyAquaConfiguration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, id);
  const status = optionalString(input, "AquaConfigurationStatus") ?? "disabled";
  return {
    AquaConfiguration: {
      AquaStatus: status === "enabled" ? "enabled" : "disabled",
      AquaConfigurationStatus: status,
    },
  };
};

const ModifyClusterDbRevision: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { Cluster: presentCluster(cluster) };
};

const ModifyClusterIamRoles: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const addRoles = stringList(input, "AddIamRoles");
  const removeRoles = stringList(input, "RemoveIamRoles");
  const defaultRole = optionalString(input, "DefaultIamRoleArn");

  const removedSet = new Set(removeRoles);
  const existing = cluster.IamRoles.filter(
    (r) => !removedSet.has(r.IamRoleArn),
  );
  const added = addRoles.map((arn) => ({
    IamRoleArn: arn,
    ApplyStatus: "adding",
  }));
  cluster.IamRoles = [...existing, ...added];
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ModifyClusterMaintenance: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  return { Cluster: presentCluster(cluster) };
};

const RestoreFromClusterSnapshot: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  const existing = ctx.store.get<StoredCluster>(clusterKey(id));
  if (existing !== undefined) {
    throw awsError(
      "ClusterAlreadyExists",
      `Cluster ${id} already exists.`,
      400,
    );
  }
  const snapshot =
    snapshotId !== undefined ? requireSnapshot(ctx, snapshotId) : undefined;
  const cluster: StoredCluster = {
    ClusterIdentifier: id,
    NodeType:
      snapshot?.NodeType ?? optionalString(input, "NodeType") ?? "dc2.large",
    ClusterStatus: "available",
    ClusterAvailabilityStatus: "Available",
    MasterUsername: snapshot?.MasterUsername,
    DBName: snapshot?.DBName ?? "dev",
    Endpoint: {
      Address: `${id}.bunsai.${ctx.region}.redshift.amazonaws.com`,
      Port: numberOr(input, "Port", snapshot?.Port ?? 5439),
    },
    ClusterCreateTime: new Date().toISOString(),
    AutomatedSnapshotRetentionPeriod: numberOr(
      input,
      "AutomatedSnapshotRetentionPeriod",
      1,
    ),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      -1,
    ),
    ClusterSubnetGroupName: optionalString(input, "ClusterSubnetGroupName"),
    AvailabilityZone:
      optionalString(input, "AvailabilityZone") ?? `${ctx.region}a`,
    PreferredMaintenanceWindow:
      optionalString(input, "PreferredMaintenanceWindow") ??
      "sat:06:00-sat:06:30",
    ClusterVersion: snapshot?.ClusterVersion ?? "1.0",
    AllowVersionUpgrade: booleanOr(input, "AllowVersionUpgrade", true),
    NumberOfNodes:
      snapshot?.NumberOfNodes ?? numberOr(input, "NumberOfNodes", 1),
    PubliclyAccessible: booleanOr(input, "PubliclyAccessible", false),
    Encrypted: snapshot?.Encrypted ?? booleanOr(input, "Encrypted", false),
    ClusterNamespaceArn: namespaceArnOf(ctx.region, ctx.account, id),
    IamRoles: [],
  };
  ctx.store.set(clusterKey(id), cluster);
  return { Cluster: presentCluster(cluster) };
};

const RestoreTableFromClusterSnapshot: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const sourceDatabase = requireString(input, "SourceDatabaseName");
  const sourceTable = requireString(input, "SourceTableName");
  const newTableName = requireString(input, "NewTableName");
  requireCluster(ctx, clusterId);
  const requestId = crypto.randomUUID();
  const status: StoredTableRestoreStatus = {
    TableRestoreRequestId: requestId,
    Status: "SUCCEEDED",
    RequestTime: new Date().toISOString(),
    ClusterIdentifier: clusterId,
    SnapshotIdentifier: snapshotId,
    SourceDatabaseName: sourceDatabase,
    SourceSchemaName: optionalString(input, "SourceSchemaName"),
    SourceTableName: sourceTable,
    TargetDatabaseName: optionalString(input, "TargetDatabaseName"),
    TargetSchemaName: optionalString(input, "TargetSchemaName"),
    NewTableName: newTableName,
  };
  ctx.store.set(tableRestoreKey(requestId), status);
  return {
    TableRestoreStatus: {
      TableRestoreRequestId: status.TableRestoreRequestId,
      Status: status.Status,
      RequestTime: status.RequestTime,
      ClusterIdentifier: status.ClusterIdentifier,
      SnapshotIdentifier: status.SnapshotIdentifier,
      SourceDatabaseName: status.SourceDatabaseName,
      SourceSchemaName: status.SourceSchemaName,
      SourceTableName: status.SourceTableName,
      TargetDatabaseName: status.TargetDatabaseName,
      TargetSchemaName: status.TargetSchemaName,
      NewTableName: status.NewTableName,
    },
  };
};

const CreateClusterSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSubnetGroupName");
  const existing = ctx.store.get<StoredClusterSubnetGroup>(
    subnetGroupKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ClusterSubnetGroupAlreadyExists",
      `ClusterSubnetGroup ${name} already exists.`,
      400,
    );
  }
  const description = requireString(input, "Description");
  const subnetIds = Array.isArray(input["SubnetIds"])
    ? (input["SubnetIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const group: StoredClusterSubnetGroup = {
    ClusterSubnetGroupName: name,
    Description: description,
    VpcId: optionalString(input, "VpcId") ?? "vpc-bunsai00000000000",
    SubnetGroupStatus: "Complete",
    Subnets: subnetIds.map((subnetId) => ({
      SubnetIdentifier: subnetId,
      SubnetAvailabilityZone: {
        Name: `${ctx.region}a`,
      },
      SubnetStatus: "Active",
    })),
  };
  ctx.store.set(subnetGroupKey(name), group);
  return { ClusterSubnetGroup: presentSubnetGroup(group) };
};

const DeleteClusterSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSubnetGroupName");
  requireSubnetGroup(ctx, name);
  ctx.store.delete(subnetGroupKey(name));
  return {};
};

const DescribeClusterSubnetGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ClusterSubnetGroupName");
  if (name !== undefined) {
    const group = requireSubnetGroup(ctx, name);
    return { ClusterSubnetGroups: [presentSubnetGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredClusterSubnetGroup>()
    .filter((entry) => entry.key.startsWith("subnetgroup/"))
    .map((entry) => presentSubnetGroup(entry.value));
  return { ClusterSubnetGroups: groups };
};

const ModifyClusterSubnetGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSubnetGroupName");
  const group = requireSubnetGroup(ctx, name);
  group.Description = optionalString(input, "Description") ?? group.Description;
  const subnetIds = Array.isArray(input["SubnetIds"])
    ? (input["SubnetIds"] as unknown[]).filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (subnetIds.length > 0) {
    group.Subnets = subnetIds.map((subnetId) => ({
      SubnetIdentifier: subnetId,
      SubnetAvailabilityZone: { Name: `${ctx.region}a` },
      SubnetStatus: "Active",
    }));
  }
  ctx.store.set(subnetGroupKey(name), group);
  return { ClusterSubnetGroup: presentSubnetGroup(group) };
};

const CreateClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const clusterId = requireString(input, "ClusterIdentifier");
  const existing = ctx.store.get<StoredSnapshot>(snapshotKey(snapshotId));
  if (existing !== undefined) {
    throw awsError(
      "ClusterSnapshotAlreadyExists",
      `Snapshot ${snapshotId} already exists.`,
      400,
    );
  }
  const cluster = requireCluster(ctx, clusterId);
  const snapshot: StoredSnapshot = {
    SnapshotIdentifier: snapshotId,
    ClusterIdentifier: clusterId,
    SnapshotCreateTime: new Date().toISOString(),
    Status: "available",
    Port: cluster.Endpoint.Port,
    AvailabilityZone: cluster.AvailabilityZone,
    ClusterCreateTime: cluster.ClusterCreateTime,
    MasterUsername: cluster.MasterUsername,
    ClusterVersion: cluster.ClusterVersion,
    NodeType: cluster.NodeType,
    NumberOfNodes: cluster.NumberOfNodes,
    DBName: cluster.DBName,
    Encrypted: cluster.Encrypted,
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      cluster.ManualSnapshotRetentionPeriod,
    ),
    SnapshotType: "manual",
    AccountsWithRestoreAccess: [],
  };
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const DeleteClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const snapshot = requireSnapshot(ctx, snapshotId);
  ctx.store.delete(snapshotKey(snapshotId));
  return { Snapshot: { ...presentSnapshot(snapshot), Status: "deleted" } };
};

const DescribeClusterSnapshots: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  if (snapshotId !== undefined) {
    const snapshot = requireSnapshot(ctx, snapshotId);
    return { Snapshots: [presentSnapshot(snapshot)] };
  }
  const clusterId = optionalString(input, "ClusterIdentifier");
  const snapshots = ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .filter(
      (entry) =>
        clusterId === undefined || entry.value.ClusterIdentifier === clusterId,
    )
    .map((entry) => presentSnapshot(entry.value));
  return { Snapshots: snapshots };
};

const CopyClusterSnapshot: OperationHandler = (input, ctx) => {
  const sourceId = requireString(input, "SourceSnapshotIdentifier");
  const targetId = requireString(input, "TargetSnapshotIdentifier");
  const existing = ctx.store.get<StoredSnapshot>(snapshotKey(targetId));
  if (existing !== undefined) {
    throw awsError(
      "ClusterSnapshotAlreadyExists",
      `Snapshot ${targetId} already exists.`,
      400,
    );
  }
  const source = requireSnapshot(ctx, sourceId);
  const copy: StoredSnapshot = {
    ...source,
    SnapshotIdentifier: targetId,
    SnapshotCreateTime: new Date().toISOString(),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      source.ManualSnapshotRetentionPeriod,
    ),
    AccountsWithRestoreAccess: [],
  };
  ctx.store.set(snapshotKey(targetId), copy);
  return { Snapshot: presentSnapshot(copy) };
};

const AuthorizeSnapshotAccess: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  const accountId = requireString(input, "AccountWithRestoreAccess");
  if (snapshotId === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "SnapshotIdentifier is required.",
      400,
    );
  }
  const snapshot = requireSnapshot(ctx, snapshotId);
  if (
    !snapshot.AccountsWithRestoreAccess.some((a) => a.AccountId === accountId)
  ) {
    snapshot.AccountsWithRestoreAccess.push({ AccountId: accountId });
  }
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const RevokeSnapshotAccess: OperationHandler = (input, ctx) => {
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  const accountId = requireString(input, "AccountWithRestoreAccess");
  if (snapshotId === undefined) {
    throw awsError(
      "InvalidParameterValue",
      "SnapshotIdentifier is required.",
      400,
    );
  }
  const snapshot = requireSnapshot(ctx, snapshotId);
  snapshot.AccountsWithRestoreAccess =
    snapshot.AccountsWithRestoreAccess.filter((a) => a.AccountId !== accountId);
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const BatchDeleteClusterSnapshots: OperationHandler = (input, ctx) => {
  const identifiers = Array.isArray(input["Identifiers"])
    ? (input["Identifiers"] as unknown[]).filter(
        (i): i is Record<string, unknown> =>
          i !== null && typeof i === "object",
      )
    : [];
  const deleted: string[] = [];
  const errors: {
    SnapshotIdentifier: string;
    SnapshotClusterIdentifier: string;
    FailureCode: string;
    FailureReason: string;
  }[] = [];
  for (const entry of identifiers) {
    const id =
      typeof entry["SnapshotIdentifier"] === "string"
        ? entry["SnapshotIdentifier"]
        : "";
    if (id === "") continue;
    const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
    if (snapshot === undefined) {
      errors.push({
        SnapshotIdentifier: id,
        SnapshotClusterIdentifier: "",
        FailureCode: "ClusterSnapshotNotFound",
        FailureReason: `Snapshot ${id} not found.`,
      });
    } else {
      ctx.store.delete(snapshotKey(id));
      deleted.push(id);
    }
  }
  return { Resources: deleted, Errors: errors };
};

const BatchModifyClusterSnapshots: OperationHandler = (input, ctx) => {
  const ids = stringList(input, "SnapshotIdentifierList");
  const retentionPeriod = numberOr(input, "ManualSnapshotRetentionPeriod", -2);
  const modified: string[] = [];
  const errors: {
    SnapshotIdentifier: string;
    SnapshotClusterIdentifier: string;
    FailureCode: string;
    FailureReason: string;
  }[] = [];
  for (const id of ids) {
    const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
    if (snapshot === undefined) {
      errors.push({
        SnapshotIdentifier: id,
        SnapshotClusterIdentifier: "",
        FailureCode: "ClusterSnapshotNotFound",
        FailureReason: `Snapshot ${id} not found.`,
      });
    } else {
      if (retentionPeriod !== -2) {
        snapshot.ManualSnapshotRetentionPeriod = retentionPeriod;
        ctx.store.set(snapshotKey(id), snapshot);
      }
      modified.push(id);
    }
  }
  return { Resources: modified, Errors: errors };
};

const ModifyClusterSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId = requireString(input, "SnapshotIdentifier");
  const snapshot = requireSnapshot(ctx, snapshotId);
  const retention = numberOr(input, "ManualSnapshotRetentionPeriod", -2);
  if (retention !== -2) {
    snapshot.ManualSnapshotRetentionPeriod = retention;
  }
  ctx.store.set(snapshotKey(snapshotId), snapshot);
  return { Snapshot: presentSnapshot(snapshot) };
};

const CreateClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const existing = ctx.store.get<StoredParameterGroup>(paramGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ClusterParameterGroupAlreadyExists",
      `Parameter group ${name} already exists.`,
      400,
    );
  }
  const family = requireString(input, "ParameterGroupFamily");
  const description = requireString(input, "Description");
  const group: StoredParameterGroup = {
    ParameterGroupName: name,
    ParameterGroupFamily: family,
    Description: description,
    Parameters: defaultParameters(family),
  };
  ctx.store.set(paramGroupKey(name), group);
  return { ClusterParameterGroup: presentParameterGroup(group) };
};

const DeleteClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  requireParameterGroup(ctx, name);
  ctx.store.delete(paramGroupKey(name));
  return {};
};

const DescribeClusterParameterGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ParameterGroupName");
  if (name !== undefined) {
    const group = requireParameterGroup(ctx, name);
    return { ParameterGroups: [presentParameterGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredParameterGroup>()
    .filter((entry) => entry.key.startsWith("paramgroup/"))
    .map((entry) => presentParameterGroup(entry.value));
  return { ParameterGroups: groups };
};

const DescribeClusterParameters: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const group = requireParameterGroup(ctx, name);
  return {
    Parameters: group.Parameters.map((p) => ({
      ParameterName: p.ParameterName,
      ParameterValue: p.ParameterValue,
      Description: p.Description,
      Source: p.Source,
      DataType: p.DataType,
      IsModifiable: p.IsModifiable,
    })),
  };
};

const ModifyClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const group = requireParameterGroup(ctx, name);
  const params = Array.isArray(input["Parameters"])
    ? (input["Parameters"] as unknown[]).filter(
        (p): p is Record<string, unknown> =>
          p !== null && typeof p === "object",
      )
    : [];
  for (const param of params) {
    const paramName = String(param["ParameterName"] ?? "");
    const paramValue = String(param["ParameterValue"] ?? "");
    const existing = group.Parameters.find(
      (p) => p.ParameterName === paramName,
    );
    if (existing !== undefined) {
      existing.ParameterValue = paramValue;
      existing.Source = "user";
    } else {
      group.Parameters.push({
        ParameterName: paramName,
        ParameterValue: paramValue,
        Description: "",
        Source: "user",
        DataType: "string",
        IsModifiable: true,
      });
    }
  }
  ctx.store.set(paramGroupKey(name), group);
  return { ParameterGroupName: name, ParameterGroupStatus: "pending-reboot" };
};

const ResetClusterParameterGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ParameterGroupName");
  const group = requireParameterGroup(ctx, name);
  const resetAll = booleanOr(input, "ResetAllParameters", false);
  if (resetAll) {
    group.Parameters = defaultParameters(group.ParameterGroupFamily);
  } else {
    const params = Array.isArray(input["Parameters"])
      ? (input["Parameters"] as unknown[]).filter(
          (p): p is Record<string, unknown> =>
            p !== null && typeof p === "object",
        )
      : [];
    for (const param of params) {
      const paramName = String(param["ParameterName"] ?? "");
      const existing = group.Parameters.find(
        (p) => p.ParameterName === paramName,
      );
      if (existing !== undefined) {
        existing.Source = "engine-default";
      }
    }
  }
  ctx.store.set(paramGroupKey(name), group);
  return { ParameterGroupName: name, ParameterGroupStatus: "pending-reboot" };
};

const DescribeDefaultClusterParameters: OperationHandler = (input, ctx) => {
  const family = requireString(input, "ParameterGroupFamily");
  return {
    DefaultClusterParameters: {
      ParameterGroupFamily: family,
      Marker: undefined,
      Parameters: defaultParameters(family).map((p) => ({
        ParameterName: p.ParameterName,
        ParameterValue: p.ParameterValue,
        Description: p.Description,
        Source: p.Source,
        DataType: p.DataType,
        IsModifiable: p.IsModifiable,
      })),
    },
  };
};

const CreateClusterSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  const existing = ctx.store.get<StoredSecurityGroup>(secGroupKey(name));
  if (existing !== undefined) {
    throw awsError(
      "ClusterSecurityGroupAlreadyExists",
      `Security group ${name} already exists.`,
      400,
    );
  }
  const description = requireString(input, "Description");
  const group: StoredSecurityGroup = {
    ClusterSecurityGroupName: name,
    Description: description,
    EC2SecurityGroups: [],
    IPRanges: [],
  };
  ctx.store.set(secGroupKey(name), group);
  return { ClusterSecurityGroup: presentSecurityGroup(group) };
};

const DeleteClusterSecurityGroup: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  requireSecurityGroup(ctx, name);
  ctx.store.delete(secGroupKey(name));
  return {};
};

const DescribeClusterSecurityGroups: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ClusterSecurityGroupName");
  if (name !== undefined) {
    const group = requireSecurityGroup(ctx, name);
    return { ClusterSecurityGroups: [presentSecurityGroup(group)] };
  }
  const groups = ctx.store
    .list<StoredSecurityGroup>()
    .filter((entry) => entry.key.startsWith("secgroup/"))
    .map((entry) => presentSecurityGroup(entry.value));
  return { ClusterSecurityGroups: groups };
};

const AuthorizeClusterSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  const group = requireSecurityGroup(ctx, name);
  const cidr = optionalString(input, "CIDRIP");
  const ec2Name = optionalString(input, "EC2SecurityGroupName");
  const ec2Owner = optionalString(input, "EC2SecurityGroupOwnerId");
  if (cidr !== undefined) {
    if (!group.IPRanges.some((r) => r.CIDRIP === cidr)) {
      group.IPRanges.push({ Status: "authorized", CIDRIP: cidr });
    }
  }
  if (ec2Name !== undefined) {
    if (
      !group.EC2SecurityGroups.some((sg) => sg.EC2SecurityGroupName === ec2Name)
    ) {
      group.EC2SecurityGroups.push({
        Status: "authorized",
        EC2SecurityGroupName: ec2Name,
        EC2SecurityGroupOwnerId: ec2Owner ?? ctx.account,
      });
    }
  }
  ctx.store.set(secGroupKey(name), group);
  return { ClusterSecurityGroup: presentSecurityGroup(group) };
};

const RevokeClusterSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ClusterSecurityGroupName");
  const group = requireSecurityGroup(ctx, name);
  const cidr = optionalString(input, "CIDRIP");
  const ec2Name = optionalString(input, "EC2SecurityGroupName");
  if (cidr !== undefined) {
    group.IPRanges = group.IPRanges.filter((r) => r.CIDRIP !== cidr);
  }
  if (ec2Name !== undefined) {
    group.EC2SecurityGroups = group.EC2SecurityGroups.filter(
      (sg) => sg.EC2SecurityGroupName !== ec2Name,
    );
  }
  ctx.store.set(secGroupKey(name), group);
  return { ClusterSecurityGroup: presentSecurityGroup(group) };
};

const CreateTags: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  const newTags = tagList(input);
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceName)) ??
    [];
  const keySet = new Map(newTags.map((t) => [t.Key, t.Value]));
  const merged = [...existing.filter((t) => !keySet.has(t.Key)), ...newTags];
  ctx.store.set(tagsKey(resourceName), merged);
  return {};
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resourceName = requireString(input, "ResourceName");
  const keys = stringList(input, "TagKeys");
  const existing =
    ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceName)) ??
    [];
  const updated = existing.filter((t) => !keys.includes(t.Key));
  ctx.store.set(tagsKey(resourceName), updated);
  return {};
};

const DescribeTags: OperationHandler = (input, ctx) => {
  const resourceName = optionalString(input, "ResourceName");
  const resourceType = optionalString(input, "ResourceType");

  if (resourceName !== undefined) {
    const tags =
      ctx.store.get<{ Key: string; Value: string }[]>(tagsKey(resourceName)) ??
      [];
    return {
      TaggedResources: tags.map((t) => ({
        Tag: { Key: t.Key, Value: t.Value },
        ResourceName: resourceName,
        ResourceType: resourceType ?? "cluster",
      })),
    };
  }

  const entries = ctx.store
    .list<{ Key: string; Value: string }[]>()
    .filter((entry) => entry.key.startsWith("tags/"));
  const taggedResources = entries.flatMap((entry) =>
    entry.value.map((t) => ({
      Tag: { Key: t.Key, Value: t.Value },
      ResourceName: entry.key.replace(/^tags\//, ""),
      ResourceType: "cluster",
    })),
  );
  return { TaggedResources: taggedResources };
};

const EnableLogging: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const bucket = optionalString(input, "BucketName");
  const prefix = optionalString(input, "S3KeyPrefix");
  const logDestType = optionalString(input, "LogDestinationType") ?? "s3";
  const logExports = stringList(input, "LogExports");
  const status: StoredLoggingStatus = {
    LoggingEnabled: true,
    BucketName: bucket,
    S3KeyPrefix: prefix,
    LogDestinationType: logDestType,
    LogExports: logExports,
  };
  ctx.store.set(loggingKey(clusterId), status);
  return {
    LoggingEnabled: status.LoggingEnabled,
    BucketName: status.BucketName,
    S3KeyPrefix: status.S3KeyPrefix,
    LogDestinationType: status.LogDestinationType,
    LogExports: status.LogExports,
  };
};

const DisableLogging: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const status: StoredLoggingStatus = {
    LoggingEnabled: false,
    BucketName: undefined,
    S3KeyPrefix: undefined,
    LogDestinationType: undefined,
    LogExports: [],
  };
  ctx.store.set(loggingKey(clusterId), status);
  return {
    LoggingEnabled: false,
    BucketName: undefined,
    S3KeyPrefix: undefined,
    LogDestinationType: undefined,
    LogExports: [],
  };
};

const DescribeLoggingStatus: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const status = ctx.store.get<StoredLoggingStatus>(loggingKey(clusterId)) ?? {
    LoggingEnabled: false,
    BucketName: undefined,
    S3KeyPrefix: undefined,
    LogDestinationType: undefined,
    LogExports: [],
  };
  return {
    LoggingEnabled: status.LoggingEnabled,
    BucketName: status.BucketName,
    S3KeyPrefix: status.S3KeyPrefix,
    LogDestinationType: status.LogDestinationType,
    LogExports: status.LogExports,
  };
};

const GetClusterCredentials: OperationHandler = (input, ctx) => {
  const dbUser = requireString(input, "DbUser");
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const expiration = new Date(Date.now() + 900000).toISOString();
  return {
    DbUser: dbUser,
    DbPassword: `BunsaiTmpPw-${clusterId}`,
    Expiration: expiration,
  };
};

const GetClusterCredentialsWithIAM: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const dbName = optionalString(input, "DbName") ?? "dev";
  const expiration = new Date(Date.now() + 900000).toISOString();
  const nextRefresh = new Date(Date.now() + 600000).toISOString();
  return {
    DbUser: `IAM:bunsai-user`,
    DbPassword: `BunsaiIamPw-${clusterId}`,
    Expiration: expiration,
    NextRefreshTime: nextRefresh,
  };
};

const DescribeAccountAttributes: OperationHandler = (_input, _ctx) => {
  return {
    AccountAttributes: [
      {
        AttributeName: "max-clusters",
        AttributeValues: [{ AttributeValue: "100" }],
      },
      {
        AttributeName: "max-reserved-nodes",
        AttributeValues: [{ AttributeValue: "20" }],
      },
    ],
  };
};

const DescribeClusterDbRevisions: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  if (clusterId !== undefined) {
    requireCluster(ctx, clusterId);
    return {
      ClusterDbRevisions: [
        {
          ClusterIdentifier: clusterId,
          CurrentDatabaseRevision: "18041",
          DatabaseRevisionReleaseDate: "2023-01-01T00:00:00Z",
          RevisionTargets: [],
        },
      ],
    };
  }
  return { ClusterDbRevisions: [] };
};

const DescribeClusterTracks: OperationHandler = (_input, _ctx) => {
  return {
    MaintenanceTracks: [
      {
        MaintenanceTrackName: "current",
        DatabaseVersion: "1.0.18041",
        UpdateTargets: [],
      },
      {
        MaintenanceTrackName: "trailing",
        DatabaseVersion: "1.0.17991",
        UpdateTargets: [],
      },
    ],
  };
};

const DescribeClusterVersions: OperationHandler = (_input, _ctx) => {
  return {
    ClusterVersions: [
      {
        ClusterVersion: "1.0",
        ClusterParameterGroupFamily: "redshift-1.0",
        Description: "Amazon Redshift 1.0",
      },
    ],
  };
};

const DescribeEventCategories: OperationHandler = (_input, _ctx) => {
  return {
    EventCategoriesMapList: [
      {
        SourceType: "cluster",
        Events: [
          {
            EventId: "REDSHIFT-EVENT-1000",
            EventCategories: ["availability"],
            EventDescription: "Cluster was available",
            Severity: "INFO",
          },
        ],
      },
    ],
  };
};

const DescribeEvents: OperationHandler = (_input, _ctx) => {
  return { Events: [], Marker: undefined };
};

const DescribeNodeConfigurationOptions: OperationHandler = (_input, _ctx) => {
  return {
    NodeConfigurationOptionList: [
      {
        NodeType: "dc2.large",
        NumberOfNodes: 2,
        EstimatedDiskUtilizationPercent: 0.5,
        Mode: "standard",
      },
      {
        NodeType: "ra3.xlplus",
        NumberOfNodes: 2,
        EstimatedDiskUtilizationPercent: 0.5,
        Mode: "standard",
      },
    ],
  };
};

const DescribeOrderableClusterOptions: OperationHandler = (_input, _ctx) => {
  return {
    OrderableClusterOptions: [
      {
        ClusterVersion: "1.0",
        ClusterType: "single-node",
        NodeType: "dc2.large",
        AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
      },
      {
        ClusterVersion: "1.0",
        ClusterType: "multi-node",
        NodeType: "ra3.xlplus",
        AvailabilityZones: [{ Name: "us-east-1a" }, { Name: "us-east-1b" }],
      },
    ],
  };
};

const DescribeStorage: OperationHandler = (_input, _ctx) => {
  return {
    TotalBackupSizeInMegaBytes: 0,
    TotalProvisionedStorageInMegaBytes: 0,
  };
};

const presentEventSub = (sub: StoredEventSubscription) => ({
  CustomerAwsId: sub.CustomerAwsId,
  CustSubscriptionId: sub.CustSubscriptionId,
  SnsTopicArn: sub.SnsTopicArn,
  Status: sub.Status,
  SubscriptionCreationTime: sub.SubscriptionCreationTime,
  SourceType: sub.SourceType,
  SourceIdsList: sub.SourceIdsList,
  EventCategoriesList: sub.EventCategoriesList,
  Severity: sub.Severity,
  Enabled: sub.Enabled,
  Tags: sub.Tags,
});

const presentSnapshotCopyGrant = (grant: StoredSnapshotCopyGrant) => ({
  SnapshotCopyGrantName: grant.SnapshotCopyGrantName,
  KmsKeyId: grant.KmsKeyId,
  Tags: grant.Tags,
});

const presentSnapshotSchedule = (schedule: StoredSnapshotSchedule) => ({
  ScheduleIdentifier: schedule.ScheduleIdentifier,
  ScheduleDefinitions: schedule.ScheduleDefinitions,
  ScheduleDescription: schedule.ScheduleDescription,
  Tags: schedule.Tags,
  NextInvocations: schedule.NextInvocations,
  AssociatedClusterCount: schedule.AssociatedClusters.length,
  AssociatedClusters: schedule.AssociatedClusters,
});

const presentUsageLimit = (limit: StoredUsageLimit) => ({
  UsageLimitId: limit.UsageLimitId,
  ClusterIdentifier: limit.ClusterIdentifier,
  FeatureType: limit.FeatureType,
  LimitType: limit.LimitType,
  Amount: limit.Amount,
  Period: limit.Period,
  BreachAction: limit.BreachAction,
  Tags: limit.Tags,
});

const presentScheduledAction = (action: StoredScheduledAction) => ({
  ScheduledActionName: action.ScheduledActionName,
  TargetAction: action.TargetAction,
  Schedule: action.Schedule,
  IamRole: action.IamRole,
  ScheduledActionDescription: action.ScheduledActionDescription,
  State: action.State,
  NextInvocations: action.NextInvocations,
  StartTime: action.StartTime,
  EndTime: action.EndTime,
});

const DescribeTableRestoreStatus: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  const requestId = optionalString(input, "TableRestoreRequestId");
  if (requestId !== undefined) {
    const status = ctx.store.get<StoredTableRestoreStatus>(
      tableRestoreKey(requestId),
    );
    if (status === undefined) {
      throw awsError(
        "TableRestoreNotFoundFault",
        `Table restore request ${requestId} not found.`,
        404,
      );
    }
    return {
      TableRestoreStatusDetails: [
        {
          TableRestoreRequestId: status.TableRestoreRequestId,
          Status: status.Status,
          RequestTime: status.RequestTime,
          ClusterIdentifier: status.ClusterIdentifier,
          SnapshotIdentifier: status.SnapshotIdentifier,
          SourceDatabaseName: status.SourceDatabaseName,
          SourceSchemaName: status.SourceSchemaName,
          SourceTableName: status.SourceTableName,
          TargetDatabaseName: status.TargetDatabaseName,
          TargetSchemaName: status.TargetSchemaName,
          NewTableName: status.NewTableName,
        },
      ],
    };
  }
  const allStatuses = ctx.store
    .list<StoredTableRestoreStatus>()
    .filter((entry) => entry.key.startsWith("tablerestore/"))
    .filter(
      (entry) =>
        clusterId === undefined || entry.value.ClusterIdentifier === clusterId,
    )
    .map((entry) => ({
      TableRestoreRequestId: entry.value.TableRestoreRequestId,
      Status: entry.value.Status,
      RequestTime: entry.value.RequestTime,
      ClusterIdentifier: entry.value.ClusterIdentifier,
      SnapshotIdentifier: entry.value.SnapshotIdentifier,
      SourceDatabaseName: entry.value.SourceDatabaseName,
      SourceSchemaName: entry.value.SourceSchemaName,
      SourceTableName: entry.value.SourceTableName,
      TargetDatabaseName: entry.value.TargetDatabaseName,
      TargetSchemaName: entry.value.TargetSchemaName,
      NewTableName: entry.value.NewTableName,
    }));
  return { TableRestoreStatusDetails: allStatuses };
};

const CreateAuthenticationProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AuthenticationProfileName");
  const content = requireString(input, "AuthenticationProfileContent");
  const existing = ctx.store.get<StoredAuthenticationProfile>(
    authProfileKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "AuthenticationProfileAlreadyExistsFault",
      `Authentication profile ${name} already exists.`,
      400,
    );
  }
  const profile: StoredAuthenticationProfile = {
    AuthenticationProfileName: name,
    AuthenticationProfileContent: content,
  };
  ctx.store.set(authProfileKey(name), profile);
  return {
    AuthenticationProfileName: name,
    AuthenticationProfileContent: content,
  };
};

const DeleteAuthenticationProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AuthenticationProfileName");
  requireAuthProfile(ctx, name);
  ctx.store.delete(authProfileKey(name));
  return { AuthenticationProfileName: name };
};

const DescribeAuthenticationProfiles: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "AuthenticationProfileName");
  if (name !== undefined) {
    const profile = requireAuthProfile(ctx, name);
    return {
      AuthenticationProfiles: [
        {
          AuthenticationProfileName: profile.AuthenticationProfileName,
          AuthenticationProfileContent: profile.AuthenticationProfileContent,
        },
      ],
    };
  }
  const profiles = ctx.store
    .list<StoredAuthenticationProfile>()
    .filter((entry) => entry.key.startsWith("authprofile/"))
    .map((entry) => ({
      AuthenticationProfileName: entry.value.AuthenticationProfileName,
      AuthenticationProfileContent: entry.value.AuthenticationProfileContent,
    }));
  return { AuthenticationProfiles: profiles };
};

const ModifyAuthenticationProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "AuthenticationProfileName");
  const content = requireString(input, "AuthenticationProfileContent");
  requireAuthProfile(ctx, name);
  const profile: StoredAuthenticationProfile = {
    AuthenticationProfileName: name,
    AuthenticationProfileContent: content,
  };
  ctx.store.set(authProfileKey(name), profile);
  return {
    AuthenticationProfileName: name,
    AuthenticationProfileContent: content,
  };
};

const CreateCustomDomainAssociation: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const domainName = requireString(input, "CustomDomainName");
  const certArn = requireString(input, "CustomDomainCertificateArn");
  requireCluster(ctx, clusterId);
  const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const assoc: StoredCustomDomainAssociation = {
    ClusterIdentifier: clusterId,
    CustomDomainName: domainName,
    CustomDomainCertificateArn: certArn,
    CustomDomainCertExpiryTime: expiry,
  };
  ctx.store.set(customDomainKey(clusterId, domainName), assoc);
  return {
    CustomDomainName: domainName,
    CustomDomainCertificateArn: certArn,
    ClusterIdentifier: clusterId,
    CustomDomainCertExpiryTime: expiry,
  };
};

const DeleteCustomDomainAssociation: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const domainName = requireString(input, "CustomDomainName");
  requireCluster(ctx, clusterId);
  ctx.store.delete(customDomainKey(clusterId, domainName));
  return {};
};

const DescribeCustomDomainAssociations: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  const domainName = optionalString(input, "CustomDomainName");
  const entries = ctx.store
    .list<StoredCustomDomainAssociation>()
    .filter((entry) => entry.key.startsWith("customdomain/"))
    .filter(
      (entry) =>
        clusterId === undefined || entry.value.ClusterIdentifier === clusterId,
    )
    .filter(
      (entry) =>
        domainName === undefined || entry.value.CustomDomainName === domainName,
    );
  const associations = entries.map((entry) => ({
    CustomDomainCertificateArn: entry.value.CustomDomainCertificateArn,
    CustomDomainCertificateExpiryDate: entry.value.CustomDomainCertExpiryTime,
    CertificateAssociations: [
      {
        CustomDomainName: entry.value.CustomDomainName,
        ClusterIdentifier: entry.value.ClusterIdentifier,
      },
    ],
  }));
  return { Associations: associations };
};

const ModifyCustomDomainAssociation: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const domainName = requireString(input, "CustomDomainName");
  const certArn = requireString(input, "CustomDomainCertificateArn");
  requireCluster(ctx, clusterId);
  const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const assoc: StoredCustomDomainAssociation = {
    ClusterIdentifier: clusterId,
    CustomDomainName: domainName,
    CustomDomainCertificateArn: certArn,
    CustomDomainCertExpiryTime: expiry,
  };
  ctx.store.set(customDomainKey(clusterId, domainName), assoc);
  return {
    CustomDomainName: domainName,
    CustomDomainCertificateArn: certArn,
    ClusterIdentifier: clusterId,
    CustomDomainCertExpiryTime: expiry,
  };
};

const CreateEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubscriptionName");
  const existing = ctx.store.get<StoredEventSubscription>(eventSubKey(name));
  if (existing !== undefined) {
    throw awsError(
      "SubscriptionAlreadyExistFault",
      `Subscription ${name} already exists.`,
      400,
    );
  }
  const snsTopicArn = requireString(input, "SnsTopicArn");
  const sub: StoredEventSubscription = {
    CustomerAwsId: ctx.account,
    CustSubscriptionId: name,
    SnsTopicArn: snsTopicArn,
    Status: "active",
    SubscriptionCreationTime: new Date().toISOString(),
    SourceType: optionalString(input, "SourceType"),
    SourceIdsList: stringList(input, "SourceIds"),
    EventCategoriesList: stringList(input, "EventCategories"),
    Severity: optionalString(input, "Severity") ?? "INFO",
    Enabled: booleanOr(input, "Enabled", true),
    Tags: tagList(input),
  };
  ctx.store.set(eventSubKey(name), sub);
  return { EventSubscription: presentEventSub(sub) };
};

const DeleteEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubscriptionName");
  requireEventSub(ctx, name);
  ctx.store.delete(eventSubKey(name));
  return {};
};

const DescribeEventSubscriptions: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "SubscriptionName");
  if (name !== undefined) {
    const sub = requireEventSub(ctx, name);
    return { EventSubscriptionsList: [presentEventSub(sub)] };
  }
  const subs = ctx.store
    .list<StoredEventSubscription>()
    .filter((entry) => entry.key.startsWith("eventsub/"))
    .map((entry) => presentEventSub(entry.value));
  return { EventSubscriptionsList: subs };
};

const ModifyEventSubscription: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SubscriptionName");
  const sub = requireEventSub(ctx, name);
  sub.SnsTopicArn = optionalString(input, "SnsTopicArn") ?? sub.SnsTopicArn;
  sub.SourceType = optionalString(input, "SourceType") ?? sub.SourceType;
  const sourceIds = stringList(input, "SourceIds");
  if (sourceIds.length > 0) {
    sub.SourceIdsList = sourceIds;
  }
  const eventCategories = stringList(input, "EventCategories");
  if (eventCategories.length > 0) {
    sub.EventCategoriesList = eventCategories;
  }
  sub.Severity = optionalString(input, "Severity") ?? sub.Severity;
  if (input["Enabled"] !== undefined) {
    sub.Enabled = booleanOr(input, "Enabled", sub.Enabled);
  }
  ctx.store.set(eventSubKey(name), sub);
  return { EventSubscription: presentEventSub(sub) };
};

const CreateScheduledAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ScheduledActionName");
  const existing = ctx.store.get<StoredScheduledAction>(
    scheduledActionKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "ScheduledActionAlreadyExistsFault",
      `Scheduled action ${name} already exists.`,
      400,
    );
  }
  const targetAction = (input["TargetAction"] as Record<string, unknown>) ?? {};
  const schedule = requireString(input, "Schedule");
  const iamRole = requireString(input, "IamRole");
  const action: StoredScheduledAction = {
    ScheduledActionName: name,
    TargetAction: targetAction,
    Schedule: schedule,
    IamRole: iamRole,
    ScheduledActionDescription: optionalString(
      input,
      "ScheduledActionDescription",
    ),
    State: "ACTIVE",
    NextInvocations: [],
    StartTime: optionalString(input, "StartTime"),
    EndTime: optionalString(input, "EndTime"),
  };
  ctx.store.set(scheduledActionKey(name), action);
  return presentScheduledAction(action);
};

const DeleteScheduledAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ScheduledActionName");
  requireScheduledAction(ctx, name);
  ctx.store.delete(scheduledActionKey(name));
  return {};
};

const DescribeScheduledActions: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "ScheduledActionName");
  if (name !== undefined) {
    const action = requireScheduledAction(ctx, name);
    return { ScheduledActions: [presentScheduledAction(action)] };
  }
  const actions = ctx.store
    .list<StoredScheduledAction>()
    .filter((entry) => entry.key.startsWith("scheduledaction/"))
    .map((entry) => presentScheduledAction(entry.value));
  return { ScheduledActions: actions };
};

const ModifyScheduledAction: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ScheduledActionName");
  const action = requireScheduledAction(ctx, name);
  if (input["TargetAction"] !== undefined) {
    action.TargetAction = input["TargetAction"] as Record<string, unknown>;
  }
  action.Schedule = optionalString(input, "Schedule") ?? action.Schedule;
  action.IamRole = optionalString(input, "IamRole") ?? action.IamRole;
  action.ScheduledActionDescription =
    optionalString(input, "ScheduledActionDescription") ??
    action.ScheduledActionDescription;
  action.StartTime = optionalString(input, "StartTime") ?? action.StartTime;
  action.EndTime = optionalString(input, "EndTime") ?? action.EndTime;
  if (input["Enable"] !== undefined) {
    action.State = booleanOr(input, "Enable", true) ? "ACTIVE" : "DISABLED";
  }
  ctx.store.set(scheduledActionKey(name), action);
  return presentScheduledAction(action);
};

const CreateSnapshotCopyGrant: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SnapshotCopyGrantName");
  const existing = ctx.store.get<StoredSnapshotCopyGrant>(
    snapshotCopyGrantKey(name),
  );
  if (existing !== undefined) {
    throw awsError(
      "SnapshotCopyGrantAlreadyExistsFault",
      `Snapshot copy grant ${name} already exists.`,
      400,
    );
  }
  const grant: StoredSnapshotCopyGrant = {
    SnapshotCopyGrantName: name,
    KmsKeyId: optionalString(input, "KmsKeyId"),
    Tags: tagList(input),
  };
  ctx.store.set(snapshotCopyGrantKey(name), grant);
  return { SnapshotCopyGrant: presentSnapshotCopyGrant(grant) };
};

const DeleteSnapshotCopyGrant: OperationHandler = (input, ctx) => {
  const name = requireString(input, "SnapshotCopyGrantName");
  requireSnapshotCopyGrant(ctx, name);
  ctx.store.delete(snapshotCopyGrantKey(name));
  return {};
};

const DescribeSnapshotCopyGrants: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "SnapshotCopyGrantName");
  if (name !== undefined) {
    const grant = requireSnapshotCopyGrant(ctx, name);
    return { SnapshotCopyGrants: [presentSnapshotCopyGrant(grant)] };
  }
  const grants = ctx.store
    .list<StoredSnapshotCopyGrant>()
    .filter((entry) => entry.key.startsWith("snapcopygrant/"))
    .map((entry) => presentSnapshotCopyGrant(entry.value));
  return { SnapshotCopyGrants: grants };
};

const CreateSnapshotSchedule: OperationHandler = (input, ctx) => {
  const id =
    optionalString(input, "ScheduleIdentifier") ??
    `auto-${crypto.randomUUID().slice(0, 8)}`;
  const existing = ctx.store.get<StoredSnapshotSchedule>(
    snapshotScheduleKey(id),
  );
  if (existing !== undefined) {
    throw awsError(
      "SnapshotScheduleAlreadyExistsFault",
      `Snapshot schedule ${id} already exists.`,
      400,
    );
  }
  const schedule: StoredSnapshotSchedule = {
    ScheduleIdentifier: id,
    ScheduleDefinitions: stringList(input, "ScheduleDefinitions"),
    ScheduleDescription: optionalString(input, "ScheduleDescription"),
    Tags: tagList(input),
    NextInvocations: [],
    AssociatedClusters: [],
  };
  ctx.store.set(snapshotScheduleKey(id), schedule);
  return presentSnapshotSchedule(schedule);
};

const DeleteSnapshotSchedule: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ScheduleIdentifier");
  requireSnapshotSchedule(ctx, id);
  ctx.store.delete(snapshotScheduleKey(id));
  return {};
};

const DescribeSnapshotSchedules: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  const scheduleId = optionalString(input, "ScheduleIdentifier");
  if (scheduleId !== undefined) {
    const schedule = requireSnapshotSchedule(ctx, scheduleId);
    return { SnapshotSchedules: [presentSnapshotSchedule(schedule)] };
  }
  let schedules = ctx.store
    .list<StoredSnapshotSchedule>()
    .filter((entry) => entry.key.startsWith("snapschedule/"))
    .map((entry) => entry.value);
  if (clusterId !== undefined) {
    schedules = schedules.filter((s) =>
      s.AssociatedClusters.some((a) => a.ClusterIdentifier === clusterId),
    );
  }
  return { SnapshotSchedules: schedules.map(presentSnapshotSchedule) };
};

const ModifySnapshotSchedule: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ScheduleIdentifier");
  const schedule = requireSnapshotSchedule(ctx, id);
  const definitions = stringList(input, "ScheduleDefinitions");
  if (definitions.length > 0) {
    schedule.ScheduleDefinitions = definitions;
  }
  ctx.store.set(snapshotScheduleKey(id), schedule);
  return presentSnapshotSchedule(schedule);
};

const ModifyClusterSnapshotSchedule: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const scheduleId = optionalString(input, "ScheduleIdentifier");
  const disassociate = booleanOr(input, "DisassociateSchedule", false);
  requireCluster(ctx, clusterId);
  if (scheduleId !== undefined && !disassociate) {
    const schedule = requireSnapshotSchedule(ctx, scheduleId);
    if (
      !schedule.AssociatedClusters.some(
        (a) => a.ClusterIdentifier === clusterId,
      )
    ) {
      schedule.AssociatedClusters.push({
        ClusterIdentifier: clusterId,
        ScheduleAssociationState: "ACTIVE",
      });
      ctx.store.set(snapshotScheduleKey(scheduleId), schedule);
    }
  } else if (scheduleId !== undefined && disassociate) {
    const schedule = ctx.store.get<StoredSnapshotSchedule>(
      snapshotScheduleKey(scheduleId),
    );
    if (schedule !== undefined) {
      schedule.AssociatedClusters = schedule.AssociatedClusters.filter(
        (a) => a.ClusterIdentifier !== clusterId,
      );
      ctx.store.set(snapshotScheduleKey(scheduleId), schedule);
    }
  }
  return {};
};

const CreateUsageLimit: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const featureType = requireString(input, "FeatureType");
  const limitType = requireString(input, "LimitType");
  const amount = numberOr(input, "Amount", 0);
  const id = crypto.randomUUID();
  const limit: StoredUsageLimit = {
    UsageLimitId: id,
    ClusterIdentifier: clusterId,
    FeatureType: featureType,
    LimitType: limitType,
    Amount: amount,
    Period: optionalString(input, "Period") ?? "monthly",
    BreachAction: optionalString(input, "BreachAction") ?? "log",
    Tags: tagList(input),
  };
  ctx.store.set(usageLimitKey(id), limit);
  return presentUsageLimit(limit);
};

const DeleteUsageLimit: OperationHandler = (input, ctx) => {
  const id = requireString(input, "UsageLimitId");
  requireUsageLimit(ctx, id);
  ctx.store.delete(usageLimitKey(id));
  return {};
};

const DescribeUsageLimits: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "UsageLimitId");
  const clusterId = optionalString(input, "ClusterIdentifier");
  if (id !== undefined) {
    const limit = requireUsageLimit(ctx, id);
    return { UsageLimits: [presentUsageLimit(limit)] };
  }
  let limits = ctx.store
    .list<StoredUsageLimit>()
    .filter((entry) => entry.key.startsWith("usagelimit/"))
    .map((entry) => entry.value);
  if (clusterId !== undefined) {
    limits = limits.filter((l) => l.ClusterIdentifier === clusterId);
  }
  return { UsageLimits: limits.map(presentUsageLimit) };
};

const ModifyUsageLimit: OperationHandler = (input, ctx) => {
  const id = requireString(input, "UsageLimitId");
  const limit = requireUsageLimit(ctx, id);
  if (input["Amount"] !== undefined) {
    limit.Amount = numberOr(input, "Amount", limit.Amount);
  }
  limit.BreachAction =
    optionalString(input, "BreachAction") ?? limit.BreachAction;
  ctx.store.set(usageLimitKey(id), limit);
  return presentUsageLimit(limit);
};

const EnableSnapshotCopy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const settings: StoredSnapshotCopySettings = {
    DestinationRegion: requireString(input, "DestinationRegion"),
    RetentionPeriod: numberOr(input, "RetentionPeriod", 7),
    ManualSnapshotRetentionPeriod: numberOr(
      input,
      "ManualSnapshotRetentionPeriod",
      -1,
    ),
    SnapshotCopyGrantName: optionalString(input, "SnapshotCopyGrantName"),
  };
  ctx.store.set(snapshotCopyKey(id), settings);
  return { Cluster: presentCluster(cluster) };
};

const DisableSnapshotCopy: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  ctx.store.delete(snapshotCopyKey(id));
  return { Cluster: presentCluster(cluster) };
};

const ModifySnapshotCopyRetentionPeriod: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, id);
  const settings = ctx.store.get<StoredSnapshotCopySettings>(
    snapshotCopyKey(id),
  );
  if (settings !== undefined) {
    const manual = booleanOr(input, "Manual", false);
    const period = numberOr(input, "RetentionPeriod", 7);
    if (manual) {
      settings.ManualSnapshotRetentionPeriod = period;
    } else {
      settings.RetentionPeriod = period;
    }
    ctx.store.set(snapshotCopyKey(id), settings);
  }
  return { Cluster: presentCluster(cluster) };
};

const requireDataShare = (
  ctx: ServiceContext,
  arn: string,
): StoredDataShare => {
  const ds = ctx.store.get<StoredDataShare>(datashareKey(arn));
  if (ds === undefined) {
    throw awsError("InvalidDataShareFault", `DataShare ${arn} not found.`, 404);
  }
  return ds;
};

const requireEndpointAccess = (
  ctx: ServiceContext,
  name: string,
): StoredEndpointAccess => {
  const ep = ctx.store.get<StoredEndpointAccess>(endpointKey(name));
  if (ep === undefined) {
    throw awsError("EndpointNotFound", `Endpoint ${name} not found.`, 404);
  }
  return ep;
};

const requireEndpointAuthorization = (
  ctx: ServiceContext,
  clusterId: string,
  account: string,
): StoredEndpointAuthorization => {
  const auth = ctx.store.get<StoredEndpointAuthorization>(
    endpointAuthKey(clusterId, account),
  );
  if (auth === undefined) {
    throw awsError(
      "EndpointAuthorizationNotFound",
      `Endpoint authorization for cluster ${clusterId} account ${account} not found.`,
      404,
    );
  }
  return auth;
};

const presentDataShare = (ds: StoredDataShare) => ({
  DataShareArn: ds.DataShareArn,
  ProducerArn: ds.ProducerArn,
  AllowPubliclyAccessibleConsumers: ds.AllowPubliclyAccessibleConsumers,
  DataShareAssociations: ds.DataShareAssociations.map((a) => ({
    ConsumerIdentifier: a.ConsumerIdentifier,
    Status: a.Status,
    ConsumerRegion: a.ConsumerRegion,
    CreatedDate: a.CreatedDate,
    StatusChangeDate: a.StatusChangeDate,
    ProducerAllowedWrites: a.ProducerAllowedWrites,
    ConsumerAcceptedWrites: a.ConsumerAcceptedWrites,
  })),
  ManagedBy: ds.ManagedBy,
  DataShareType: ds.DataShareType,
});

const presentEndpointAccess = (ep: StoredEndpointAccess) => ({
  ClusterIdentifier: ep.ClusterIdentifier,
  ResourceOwner: ep.ResourceOwner,
  SubnetGroupName: ep.SubnetGroupName,
  EndpointStatus: ep.EndpointStatus,
  EndpointName: ep.EndpointName,
  EndpointCreateTime: ep.EndpointCreateTime,
  Port: ep.Port,
  Address: ep.Address,
  VpcSecurityGroups: ep.VpcSecurityGroups,
  VpcEndpoint: ep.VpcEndpoint,
});

const presentEndpointAuthorization = (auth: StoredEndpointAuthorization) => ({
  Grantor: auth.Grantor,
  Grantee: auth.Grantee,
  ClusterIdentifier: auth.ClusterIdentifier,
  AuthorizeTime: auth.AuthorizeTime,
  ClusterStatus: auth.ClusterStatus,
  Status: auth.Status,
  AllowedAllVPCs: auth.AllowedAllVPCs,
  AllowedVPCs: auth.AllowedVPCs,
  EndpointCount: auth.EndpointCount,
});

const presentHsmClientCert = (cert: StoredHsmClientCertificate) => ({
  HsmClientCertificateIdentifier: cert.HsmClientCertificateIdentifier,
  HsmClientCertificatePublicKey: cert.HsmClientCertificatePublicKey,
  Tags: cert.Tags,
});

const presentHsmConfig = (config: StoredHsmConfiguration) => ({
  HsmConfigurationIdentifier: config.HsmConfigurationIdentifier,
  Description: config.Description,
  HsmIpAddress: config.HsmIpAddress,
  HsmPartitionName: config.HsmPartitionName,
  Tags: config.Tags,
});

const presentReservedNodeOffering = (offering: StoredReservedNodeOffering) => ({
  ReservedNodeOfferingId: offering.ReservedNodeOfferingId,
  NodeType: offering.NodeType,
  Duration: offering.Duration,
  FixedPrice: offering.FixedPrice,
  UsagePrice: offering.UsagePrice,
  CurrencyCode: offering.CurrencyCode,
  OfferingType: offering.OfferingType,
  RecurringCharges: offering.RecurringCharges,
  ReservedNodeOfferingType: offering.ReservedNodeOfferingType,
});

const presentReservedNode = (node: StoredReservedNode) => ({
  ReservedNodeId: node.ReservedNodeId,
  ReservedNodeOfferingId: node.ReservedNodeOfferingId,
  NodeType: node.NodeType,
  StartTime: node.StartTime,
  Duration: node.Duration,
  FixedPrice: node.FixedPrice,
  UsagePrice: node.UsagePrice,
  CurrencyCode: node.CurrencyCode,
  NodeCount: node.NodeCount,
  State: node.State,
  OfferingType: node.OfferingType,
  RecurringCharges: node.RecurringCharges,
  ReservedNodeOfferingType: node.ReservedNodeOfferingType,
});

const AuthorizeDataShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataShareArn");
  const consumerIdentifier = requireString(input, "ConsumerIdentifier");
  const allowWrites = booleanOr(input, "AllowWrites", false);
  const now = new Date().toISOString();
  let ds = ctx.store.get<StoredDataShare>(datashareKey(arn));
  if (ds === undefined) {
    ds = {
      DataShareArn: arn,
      ProducerArn: arn,
      AllowPubliclyAccessibleConsumers: false,
      DataShareAssociations: [],
      ManagedBy: undefined,
      DataShareType: undefined,
    };
  }
  const existing = ds.DataShareAssociations.find(
    (a) => a.ConsumerIdentifier === consumerIdentifier,
  );
  if (existing !== undefined) {
    existing.Status = "AUTHORIZED";
    existing.StatusChangeDate = now;
    existing.ProducerAllowedWrites = allowWrites;
  } else {
    ds.DataShareAssociations.push({
      ConsumerIdentifier: consumerIdentifier,
      Status: "AUTHORIZED",
      ConsumerRegion: undefined,
      CreatedDate: now,
      StatusChangeDate: now,
      ProducerAllowedWrites: allowWrites,
      ConsumerAcceptedWrites: undefined,
    });
  }
  ctx.store.set(datashareKey(arn), ds);
  return presentDataShare(ds);
};

const DeauthorizeDataShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataShareArn");
  const consumerIdentifier = requireString(input, "ConsumerIdentifier");
  const ds = requireDataShare(ctx, arn);
  const now = new Date().toISOString();
  const assoc = ds.DataShareAssociations.find(
    (a) => a.ConsumerIdentifier === consumerIdentifier,
  );
  if (assoc !== undefined) {
    assoc.Status = "DEAUTHORIZED";
    assoc.StatusChangeDate = now;
  }
  ctx.store.set(datashareKey(arn), ds);
  return presentDataShare(ds);
};

const AssociateDataShareConsumer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataShareArn");
  const ds = requireDataShare(ctx, arn);
  const now = new Date().toISOString();
  const consumerArn = optionalString(input, "ConsumerArn");
  const consumerRegion = optionalString(input, "ConsumerRegion");
  const allowWrites = booleanOr(input, "AllowWrites", false);
  const identifier = consumerArn ?? consumerRegion;
  const existing = ds.DataShareAssociations.find(
    (a) => a.ConsumerIdentifier === identifier,
  );
  if (existing !== undefined) {
    existing.Status = "ACTIVE";
    existing.StatusChangeDate = now;
    existing.ConsumerAcceptedWrites = allowWrites;
  } else {
    ds.DataShareAssociations.push({
      ConsumerIdentifier: identifier,
      Status: "ACTIVE",
      ConsumerRegion: consumerRegion,
      CreatedDate: now,
      StatusChangeDate: now,
      ProducerAllowedWrites: undefined,
      ConsumerAcceptedWrites: allowWrites,
    });
  }
  ctx.store.set(datashareKey(arn), ds);
  return presentDataShare(ds);
};

const DisassociateDataShareConsumer: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataShareArn");
  const ds = requireDataShare(ctx, arn);
  const now = new Date().toISOString();
  const consumerArn = optionalString(input, "ConsumerArn");
  const consumerRegion = optionalString(input, "ConsumerRegion");
  const identifier = consumerArn ?? consumerRegion;
  const assoc = ds.DataShareAssociations.find(
    (a) => a.ConsumerIdentifier === identifier,
  );
  if (assoc !== undefined) {
    assoc.Status = "DEAUTHORIZED";
    assoc.StatusChangeDate = now;
  }
  ctx.store.set(datashareKey(arn), ds);
  return presentDataShare(ds);
};

const RejectDataShare: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "DataShareArn");
  const ds = requireDataShare(ctx, arn);
  const now = new Date().toISOString();
  for (const assoc of ds.DataShareAssociations) {
    assoc.Status = "REJECTED";
    assoc.StatusChangeDate = now;
  }
  ctx.store.set(datashareKey(arn), ds);
  return presentDataShare(ds);
};

const DescribeDataShares: OperationHandler = (input, ctx) => {
  const arn = optionalString(input, "DataShareArn");
  if (arn !== undefined) {
    const ds = requireDataShare(ctx, arn);
    return { DataShares: [presentDataShare(ds)] };
  }
  const all = ctx.store
    .list<StoredDataShare>()
    .filter((e) => e.key.startsWith("datashare/"))
    .map((e) => presentDataShare(e.value));
  return { DataShares: all };
};

const DescribeDataSharesForConsumer: OperationHandler = (input, ctx) => {
  const consumerArn = optionalString(input, "ConsumerArn");
  const statusFilter = optionalString(input, "Status");
  let all = ctx.store
    .list<StoredDataShare>()
    .filter((e) => e.key.startsWith("datashare/"))
    .map((e) => e.value);
  if (consumerArn !== undefined) {
    all = all.filter((ds) =>
      ds.DataShareAssociations.some(
        (a) => a.ConsumerIdentifier === consumerArn,
      ),
    );
  }
  if (statusFilter !== undefined) {
    all = all.filter((ds) =>
      ds.DataShareAssociations.some((a) => a.Status === statusFilter),
    );
  }
  return { DataShares: all.map(presentDataShare) };
};

const DescribeDataSharesForProducer: OperationHandler = (input, ctx) => {
  const producerArn = optionalString(input, "ProducerArn");
  const statusFilter = optionalString(input, "Status");
  let all = ctx.store
    .list<StoredDataShare>()
    .filter((e) => e.key.startsWith("datashare/"))
    .map((e) => e.value);
  if (producerArn !== undefined) {
    all = all.filter((ds) => ds.ProducerArn === producerArn);
  }
  if (statusFilter !== undefined) {
    all = all.filter((ds) =>
      ds.DataShareAssociations.some((a) => a.Status === statusFilter),
    );
  }
  return { DataShares: all.map(presentDataShare) };
};

const AuthorizeEndpointAccess: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, clusterId);
  const account = requireString(input, "Account");
  const vpcIds = stringList(input, "VpcIds");
  const now = new Date().toISOString();
  const auth: StoredEndpointAuthorization = {
    Grantor: ctx.account,
    Grantee: account,
    ClusterIdentifier: clusterId,
    AuthorizeTime: now,
    ClusterStatus: cluster.ClusterStatus,
    Status: "Authorized",
    AllowedAllVPCs: vpcIds.length === 0,
    AllowedVPCs: vpcIds,
    EndpointCount: 0,
  };
  ctx.store.set(endpointAuthKey(clusterId, account), auth);
  return presentEndpointAuthorization(auth);
};

const RevokeEndpointAccess: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const account = requireString(input, "Account");
  const auth = requireEndpointAuthorization(ctx, clusterId, account);
  ctx.store.delete(endpointAuthKey(clusterId, account));
  return presentEndpointAuthorization({ ...auth, Status: "Revoking" });
};

const CreateEndpointAccess: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const endpointName = requireString(input, "EndpointName");
  const subnetGroupName = requireString(input, "SubnetGroupName");
  const resourceOwner = optionalString(input, "ResourceOwner") ?? ctx.account;
  const vpcSgIds = stringList(input, "VpcSecurityGroupIds");
  const now = new Date().toISOString();
  const ep: StoredEndpointAccess = {
    ClusterIdentifier: clusterId,
    ResourceOwner: resourceOwner,
    SubnetGroupName: subnetGroupName,
    EndpointStatus: "active",
    EndpointName: endpointName,
    EndpointCreateTime: now,
    Port: 5439,
    Address: `${endpointName}.${ctx.region}.redshift.amazonaws.com`,
    VpcSecurityGroups: vpcSgIds.map((id) => ({
      VpcSecurityGroupId: id,
      Status: "active",
    })),
    VpcEndpoint: {
      VpcEndpointId: crypto.randomUUID(),
      VpcId: "",
      NetworkInterfaces: [],
    },
  };
  ctx.store.set(endpointKey(endpointName), ep);
  return presentEndpointAccess(ep);
};

const DeleteEndpointAccess: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const ep = requireEndpointAccess(ctx, name);
  ctx.store.delete(endpointKey(name));
  return presentEndpointAccess(ep);
};

const DescribeEndpointAccess: OperationHandler = (input, ctx) => {
  const name = optionalString(input, "EndpointName");
  const clusterId = optionalString(input, "ClusterIdentifier");
  const resourceOwner = optionalString(input, "ResourceOwner");
  if (name !== undefined) {
    const ep = requireEndpointAccess(ctx, name);
    return { EndpointAccessList: [presentEndpointAccess(ep)] };
  }
  let eps = ctx.store
    .list<StoredEndpointAccess>()
    .filter((e) => e.key.startsWith("endpoint/"))
    .map((e) => e.value);
  if (clusterId !== undefined) {
    eps = eps.filter((e) => e.ClusterIdentifier === clusterId);
  }
  if (resourceOwner !== undefined) {
    eps = eps.filter((e) => e.ResourceOwner === resourceOwner);
  }
  return { EndpointAccessList: eps.map(presentEndpointAccess) };
};

const ModifyEndpointAccess: OperationHandler = (input, ctx) => {
  const name = requireString(input, "EndpointName");
  const ep = requireEndpointAccess(ctx, name);
  const vpcSgIds = stringList(input, "VpcSecurityGroupIds");
  if (vpcSgIds.length > 0) {
    ep.VpcSecurityGroups = vpcSgIds.map((id) => ({
      VpcSecurityGroupId: id,
      Status: "active",
    }));
  }
  ctx.store.set(endpointKey(name), ep);
  return presentEndpointAccess(ep);
};

const DescribeEndpointAuthorization: OperationHandler = (input, ctx) => {
  const clusterId = optionalString(input, "ClusterIdentifier");
  const account = optionalString(input, "Account");
  let auths = ctx.store
    .list<StoredEndpointAuthorization>()
    .filter((e) => e.key.startsWith("endpointauth/"))
    .map((e) => e.value);
  if (clusterId !== undefined) {
    auths = auths.filter((a) => a.ClusterIdentifier === clusterId);
  }
  if (account !== undefined) {
    const grantee = booleanOr(input, "Grantee", false);
    if (grantee) {
      auths = auths.filter((a) => a.Grantee === account);
    } else {
      auths = auths.filter((a) => a.Grantor === account);
    }
  }
  return { EndpointAuthorizationList: auths.map(presentEndpointAuthorization) };
};

const RegisterNamespace: OperationHandler = (_input, _ctx) => {
  return { Status: "Registering" };
};

const DeregisterNamespace: OperationHandler = (_input, _ctx) => {
  return { Status: "Deregistering" };
};

const BUILTIN_OFFERINGS: StoredReservedNodeOffering[] = [
  {
    ReservedNodeOfferingId: "offering-dc2-large-1yr",
    NodeType: "dc2.large",
    Duration: 31536000,
    FixedPrice: 642.0,
    UsagePrice: 0.0,
    CurrencyCode: "USD",
    OfferingType: "All Upfront",
    RecurringCharges: [
      { RecurringChargeAmount: 0.0, RecurringChargeFrequency: "Hourly" },
    ],
    ReservedNodeOfferingType: "Regular",
  },
  {
    ReservedNodeOfferingId: "offering-ra3-xlplus-1yr",
    NodeType: "ra3.xlplus",
    Duration: 31536000,
    FixedPrice: 1380.0,
    UsagePrice: 0.0,
    CurrencyCode: "USD",
    OfferingType: "All Upfront",
    RecurringCharges: [
      { RecurringChargeAmount: 0.0, RecurringChargeFrequency: "Hourly" },
    ],
    ReservedNodeOfferingType: "Regular",
  },
  {
    ReservedNodeOfferingId: "offering-ra3-xlplus-1yr-upgradable",
    NodeType: "ra3.xlplus",
    Duration: 31536000,
    FixedPrice: 1200.0,
    UsagePrice: 0.05,
    CurrencyCode: "USD",
    OfferingType: "Partial Upfront",
    RecurringCharges: [
      { RecurringChargeAmount: 0.05, RecurringChargeFrequency: "Hourly" },
    ],
    ReservedNodeOfferingType: "Upgradable",
  },
] as const;

const ensureBuiltinOfferings = (ctx: ServiceContext): void => {
  for (const o of BUILTIN_OFFERINGS) {
    if (
      ctx.store.get<StoredReservedNodeOffering>(
        reservedNodeOfferingKey(o.ReservedNodeOfferingId),
      ) === undefined
    ) {
      ctx.store.set(reservedNodeOfferingKey(o.ReservedNodeOfferingId), o);
    }
  }
};

const CreateHsmClientCertificate: OperationHandler = (input, ctx) => {
  const id = requireString(input, "HsmClientCertificateIdentifier");
  const existing = ctx.store.get<StoredHsmClientCertificate>(
    hsmClientCertKey(id),
  );
  if (existing !== undefined) {
    throw awsError(
      "HsmClientCertificateAlreadyExistsFault",
      `HSM client certificate ${id} already exists.`,
      400,
    );
  }
  const cert: StoredHsmClientCertificate = {
    HsmClientCertificateIdentifier: id,
    HsmClientCertificatePublicKey: `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA${id}\n-----END PUBLIC KEY-----`,
    Tags: tagList(input),
  };
  ctx.store.set(hsmClientCertKey(id), cert);
  return { HsmClientCertificate: presentHsmClientCert(cert) };
};

const CreateHsmConfiguration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "HsmConfigurationIdentifier");
  const existing = ctx.store.get<StoredHsmConfiguration>(hsmConfigKey(id));
  if (existing !== undefined) {
    throw awsError(
      "HsmConfigurationAlreadyExistsFault",
      `HSM configuration ${id} already exists.`,
      400,
    );
  }
  const config: StoredHsmConfiguration = {
    HsmConfigurationIdentifier: id,
    Description: requireString(input, "Description"),
    HsmIpAddress: requireString(input, "HsmIpAddress"),
    HsmPartitionName: requireString(input, "HsmPartitionName"),
    Tags: tagList(input),
  };
  ctx.store.set(hsmConfigKey(id), config);
  return { HsmConfiguration: presentHsmConfig(config) };
};

const DeleteHsmClientCertificate: OperationHandler = (input, ctx) => {
  const id = requireString(input, "HsmClientCertificateIdentifier");
  requireHsmClientCert(ctx, id);
  ctx.store.delete(hsmClientCertKey(id));
  return {};
};

const DeleteHsmConfiguration: OperationHandler = (input, ctx) => {
  const id = requireString(input, "HsmConfigurationIdentifier");
  requireHsmConfig(ctx, id);
  ctx.store.delete(hsmConfigKey(id));
  return {};
};

const DescribeHsmClientCertificates: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "HsmClientCertificateIdentifier");
  if (id !== undefined) {
    const cert = requireHsmClientCert(ctx, id);
    return { HsmClientCertificates: [presentHsmClientCert(cert)] };
  }
  const certs = ctx.store
    .list<StoredHsmClientCertificate>()
    .filter((e) => e.key.startsWith("hsmclientcert/"))
    .map((e) => presentHsmClientCert(e.value));
  return { HsmClientCertificates: certs };
};

const DescribeHsmConfigurations: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "HsmConfigurationIdentifier");
  if (id !== undefined) {
    const config = requireHsmConfig(ctx, id);
    return { HsmConfigurations: [presentHsmConfig(config)] };
  }
  const configs = ctx.store
    .list<StoredHsmConfiguration>()
    .filter((e) => e.key.startsWith("hsmconfig/"))
    .map((e) => presentHsmConfig(e.value));
  return { HsmConfigurations: configs };
};

const DescribeReservedNodeOfferings: OperationHandler = (input, ctx) => {
  ensureBuiltinOfferings(ctx);
  const id = optionalString(input, "ReservedNodeOfferingId");
  if (id !== undefined) {
    const offering = requireReservedNodeOffering(ctx, id);
    return { ReservedNodeOfferings: [presentReservedNodeOffering(offering)] };
  }
  const offerings = ctx.store
    .list<StoredReservedNodeOffering>()
    .filter((e) => e.key.startsWith("reservednodeoffering/"))
    .map((e) => presentReservedNodeOffering(e.value));
  return { ReservedNodeOfferings: offerings };
};

const DescribeReservedNodes: OperationHandler = (input, ctx) => {
  const id = optionalString(input, "ReservedNodeId");
  if (id !== undefined) {
    const node = requireReservedNode(ctx, id);
    return { ReservedNodes: [presentReservedNode(node)] };
  }
  const nodes = ctx.store
    .list<StoredReservedNode>()
    .filter((e) => e.key.startsWith("reservednode/"))
    .map((e) => presentReservedNode(e.value));
  return { ReservedNodes: nodes };
};

const PurchaseReservedNodeOffering: OperationHandler = (input, ctx) => {
  ensureBuiltinOfferings(ctx);
  const offeringId = requireString(input, "ReservedNodeOfferingId");
  const offering = requireReservedNodeOffering(ctx, offeringId);
  const nodeCount = numberOr(input, "NodeCount", 1);
  const reservedNodeId = crypto.randomUUID();
  const existing = ctx.store
    .list<StoredReservedNode>()
    .find(
      (e) =>
        e.key.startsWith("reservednode/") &&
        e.value.ReservedNodeOfferingId === offeringId &&
        e.value.State === "active",
    );
  if (existing !== undefined) {
    throw awsError(
      "ReservedNodeAlreadyExistsFault",
      `Reserved node for offering ${offeringId} already exists.`,
      400,
    );
  }
  const node: StoredReservedNode = {
    ReservedNodeId: reservedNodeId,
    ReservedNodeOfferingId: offeringId,
    NodeType: offering.NodeType,
    StartTime: new Date().toISOString(),
    Duration: offering.Duration,
    FixedPrice: offering.FixedPrice,
    UsagePrice: offering.UsagePrice,
    CurrencyCode: offering.CurrencyCode,
    NodeCount: nodeCount,
    State: "active",
    OfferingType: offering.OfferingType,
    RecurringCharges: offering.RecurringCharges,
    ReservedNodeOfferingType: offering.ReservedNodeOfferingType,
  };
  ctx.store.set(reservedNodeKey(reservedNodeId), node);
  return { ReservedNode: presentReservedNode(node) };
};

const AcceptReservedNodeExchange: OperationHandler = (input, ctx) => {
  const sourceId = requireString(input, "ReservedNodeId");
  const targetOfferingId = requireString(input, "TargetReservedNodeOfferingId");
  ensureBuiltinOfferings(ctx);
  const sourceNode = requireReservedNode(ctx, sourceId);
  const targetOffering = requireReservedNodeOffering(ctx, targetOfferingId);
  if (sourceNode.State !== "active") {
    throw awsError(
      "InvalidReservedNodeStateFault",
      `Reserved node ${sourceId} is not in active state.`,
      400,
    );
  }
  const exchangeId = crypto.randomUUID();
  const now = new Date().toISOString();
  const exchangeStatus: StoredReservedNodeExchangeStatus = {
    ReservedNodeExchangeRequestId: exchangeId,
    Status: "succeeded",
    RequestTime: now,
    SourceReservedNodeId: sourceId,
    SourceReservedNodeType: sourceNode.NodeType,
    SourceReservedNodeCount: sourceNode.NodeCount,
    TargetReservedNodeOfferingId: targetOfferingId,
    TargetReservedNodeType: targetOffering.NodeType,
    TargetReservedNodeCount: sourceNode.NodeCount,
  };
  ctx.store.set(reservedNodeExchangeKey(exchangeId), exchangeStatus);
  sourceNode.State = "retired";
  ctx.store.set(reservedNodeKey(sourceId), sourceNode);
  const newNodeId = crypto.randomUUID();
  const newNode: StoredReservedNode = {
    ReservedNodeId: newNodeId,
    ReservedNodeOfferingId: targetOfferingId,
    NodeType: targetOffering.NodeType,
    StartTime: now,
    Duration: targetOffering.Duration,
    FixedPrice: targetOffering.FixedPrice,
    UsagePrice: targetOffering.UsagePrice,
    CurrencyCode: targetOffering.CurrencyCode,
    NodeCount: sourceNode.NodeCount,
    State: "active",
    OfferingType: targetOffering.OfferingType,
    RecurringCharges: targetOffering.RecurringCharges,
    ReservedNodeOfferingType: targetOffering.ReservedNodeOfferingType,
  };
  ctx.store.set(reservedNodeKey(newNodeId), newNode);
  return { ExchangedReservedNode: presentReservedNode(newNode) };
};

const DescribeReservedNodeExchangeStatus: OperationHandler = (input, ctx) => {
  const sourceId = optionalString(input, "ReservedNodeId");
  const exchangeId = optionalString(input, "ReservedNodeExchangeRequestId");
  let statuses = ctx.store
    .list<StoredReservedNodeExchangeStatus>()
    .filter((e) => e.key.startsWith("reservednodeexchange/"))
    .map((e) => e.value);
  if (sourceId !== undefined) {
    statuses = statuses.filter((s) => s.SourceReservedNodeId === sourceId);
  }
  if (exchangeId !== undefined) {
    statuses = statuses.filter(
      (s) => s.ReservedNodeExchangeRequestId === exchangeId,
    );
  }
  return {
    ReservedNodeExchangeStatusDetails: statuses.map((s) => ({
      ReservedNodeExchangeRequestId: s.ReservedNodeExchangeRequestId,
      Status: s.Status,
      RequestTime: s.RequestTime,
      SourceReservedNodeId: s.SourceReservedNodeId,
      SourceReservedNodeType: s.SourceReservedNodeType,
      SourceReservedNodeCount: s.SourceReservedNodeCount,
      TargetReservedNodeOfferingId: s.TargetReservedNodeOfferingId,
      TargetReservedNodeType: s.TargetReservedNodeType,
      TargetReservedNodeCount: s.TargetReservedNodeCount,
    })),
  };
};

const GetReservedNodeExchangeOfferings: OperationHandler = (input, ctx) => {
  ensureBuiltinOfferings(ctx);
  const sourceId = requireString(input, "ReservedNodeId");
  const sourceNode = requireReservedNode(ctx, sourceId);
  if (sourceNode.State !== "active") {
    throw awsError(
      "InvalidReservedNodeStateFault",
      `Reserved node ${sourceId} is not in active state.`,
      400,
    );
  }
  const offerings = ctx.store
    .list<StoredReservedNodeOffering>()
    .filter((e) => e.key.startsWith("reservednodeoffering/"))
    .map((e) => e.value)
    .filter(
      (o) =>
        o.ReservedNodeOfferingType === "Upgradable" ||
        o.NodeType !== sourceNode.NodeType,
    );
  return { ReservedNodeOfferings: offerings.map(presentReservedNodeOffering) };
};

const GetReservedNodeExchangeConfigurationOptions: OperationHandler = (
  input,
  ctx,
) => {
  ensureBuiltinOfferings(ctx);
  const clusterId = optionalString(input, "ClusterIdentifier");
  const snapshotId = optionalString(input, "SnapshotIdentifier");
  let sourceNodes: StoredReservedNode[] = [];
  if (clusterId !== undefined) {
    requireCluster(ctx, clusterId);
    sourceNodes = ctx.store
      .list<StoredReservedNode>()
      .filter((e) => e.key.startsWith("reservednode/"))
      .map((e) => e.value)
      .filter((n) => n.State === "active");
  } else if (snapshotId !== undefined) {
    requireSnapshot(ctx, snapshotId);
    sourceNodes = ctx.store
      .list<StoredReservedNode>()
      .filter((e) => e.key.startsWith("reservednode/"))
      .map((e) => e.value)
      .filter((n) => n.State === "active");
  }
  const targetOfferings = ctx.store
    .list<StoredReservedNodeOffering>()
    .filter((e) => e.key.startsWith("reservednodeoffering/"))
    .map((e) => e.value)
    .filter((o) => o.ReservedNodeOfferingType === "Upgradable");
  const options = sourceNodes.flatMap((src) =>
    targetOfferings.map((tgt) => ({
      SourceReservedNode: presentReservedNode(src),
      TargetReservedNodeCount: src.NodeCount,
      TargetReservedNodeOffering: presentReservedNodeOffering(tgt),
    })),
  );
  return { ReservedNodeConfigurationOptionList: options };
};

const CreateIntegration: OperationHandler = (input, ctx) => {
  const sourceArn = requireString(input, "SourceArn");
  const targetArn = requireString(input, "TargetArn");
  const integrationName = requireString(input, "IntegrationName");
  const arn = integrationArnOf(ctx.region, ctx.account);
  const now = new Date().toISOString();
  const encCtxRaw = input["AdditionalEncryptionContext"];
  const additionalEncryptionContext: Record<string, string> =
    encCtxRaw !== null &&
    typeof encCtxRaw === "object" &&
    !Array.isArray(encCtxRaw)
      ? Object.fromEntries(
          Object.entries(encCtxRaw as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v),
          ]),
        )
      : {};
  const tagListRaw = input["TagList"];
  const tags: { Key: string; Value: string }[] = Array.isArray(tagListRaw)
    ? (tagListRaw as Record<string, unknown>[])
        .filter((t) => t !== null && typeof t === "object")
        .map((t) => ({
          Key: String(t["Key"] ?? ""),
          Value: String(t["Value"] ?? ""),
        }))
    : [];
  const integration: StoredIntegration = {
    IntegrationArn: arn,
    IntegrationName: integrationName,
    SourceArn: sourceArn,
    TargetArn: targetArn,
    Status: "active",
    Errors: [],
    CreateTime: now,
    Description: optionalString(input, "Description"),
    KMSKeyId: optionalString(input, "KMSKeyId"),
    AdditionalEncryptionContext: additionalEncryptionContext,
    Tags: tags,
  };
  ctx.store.set(integrationKey(arn), integration);
  const inbound: StoredInboundIntegration = {
    IntegrationArn: arn,
    SourceArn: sourceArn,
    TargetArn: targetArn,
    Status: "active",
    Errors: [],
    CreateTime: now,
  };
  ctx.store.set(inboundIntegrationKey(arn), inbound);
  return presentIntegration(integration);
};

const DeleteIntegration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "IntegrationArn");
  const integration = requireIntegration(ctx, arn);
  ctx.store.delete(integrationKey(arn));
  ctx.store.delete(inboundIntegrationKey(arn));
  return presentIntegration(integration);
};

const DescribeIntegrations: OperationHandler = (input, ctx) => {
  const arn = optionalString(input, "IntegrationArn");
  if (arn !== undefined) {
    const integration = requireIntegration(ctx, arn);
    return { Integrations: [presentIntegration(integration)] };
  }
  const filtersRaw = input["Filters"];
  let integrations = ctx.store
    .list<StoredIntegration>()
    .filter((e) => e.key.startsWith("integration/"))
    .map((e) => e.value);
  if (Array.isArray(filtersRaw)) {
    for (const f of filtersRaw as Record<string, unknown>[]) {
      if (typeof f !== "object" || f === null) continue;
      const name = String(f["Name"] ?? "");
      const values = Array.isArray(f["Values"])
        ? (f["Values"] as unknown[]).map((v) => String(v))
        : [];
      if (values.length === 0) continue;
      if (name === "integration-arn") {
        integrations = integrations.filter((i) =>
          values.includes(i.IntegrationArn),
        );
      } else if (name === "source-arn") {
        integrations = integrations.filter((i) => values.includes(i.SourceArn));
      } else if (name === "status") {
        integrations = integrations.filter((i) => values.includes(i.Status));
      }
    }
  }
  return { Integrations: integrations.map(presentIntegration) };
};

const DescribeInboundIntegrations: OperationHandler = (input, ctx) => {
  const integrationArn = optionalString(input, "IntegrationArn");
  const targetArn = optionalString(input, "TargetArn");
  let inbounds = ctx.store
    .list<StoredInboundIntegration>()
    .filter((e) => e.key.startsWith("inboundintegration/"))
    .map((e) => e.value);
  if (integrationArn !== undefined) {
    inbounds = inbounds.filter((i) => i.IntegrationArn === integrationArn);
  }
  if (targetArn !== undefined) {
    inbounds = inbounds.filter((i) => i.TargetArn === targetArn);
  }
  return { InboundIntegrations: inbounds.map(presentInboundIntegration) };
};

const ModifyIntegration: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "IntegrationArn");
  const integration = requireIntegration(ctx, arn);
  const description = optionalString(input, "Description");
  const integrationName = optionalString(input, "IntegrationName");
  if (description !== undefined) {
    integration.Description = description;
  }
  if (integrationName !== undefined) {
    integration.IntegrationName = integrationName;
  }
  ctx.store.set(integrationKey(arn), integration);
  return presentIntegration(integration);
};

const CreateRedshiftIdcApplication: OperationHandler = (input, ctx) => {
  const idcInstanceArn = requireString(input, "IdcInstanceArn");
  const name = requireString(input, "RedshiftIdcApplicationName");
  const iamRoleArn = requireString(input, "IamRoleArn");
  const arn = idcApplicationArnOf(ctx.region, ctx.account, name);
  const tokenIssuerListRaw = input["AuthorizedTokenIssuerList"];
  const authorizedTokenIssuerList: StoredAuthorizedTokenIssuer[] =
    Array.isArray(tokenIssuerListRaw)
      ? (tokenIssuerListRaw as Record<string, unknown>[]).map((t) => ({
          TrustedTokenIssuerArn: optionalString(t, "TrustedTokenIssuerArn"),
          AuthorizedAudiencesList: stringList(t, "AuthorizedAudiencesList"),
        }))
      : [];
  const serviceIntegrationsRaw = input["ServiceIntegrations"];
  const serviceIntegrations: Record<string, unknown>[] = Array.isArray(
    serviceIntegrationsRaw,
  )
    ? (serviceIntegrationsRaw as Record<string, unknown>[])
    : [];
  const app: StoredRedshiftIdcApplication = {
    IdcInstanceArn: idcInstanceArn,
    RedshiftIdcApplicationName: name,
    RedshiftIdcApplicationArn: arn,
    IdentityNamespace: optionalString(input, "IdentityNamespace"),
    IdcDisplayName: optionalString(input, "IdcDisplayName"),
    IamRoleArn: iamRoleArn,
    IdcManagedApplicationArn: `arn:aws:sso::${ctx.account}:application/ssoins-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}/${name}`,
    IdcOnboardStatus: "ENABLED",
    AuthorizedTokenIssuerList: authorizedTokenIssuerList,
    ServiceIntegrations: serviceIntegrations,
    ApplicationType: optionalString(input, "ApplicationType"),
    Tags: tagList(input),
    SsoTagKeys: stringList(input, "SsoTagKeys"),
  };
  ctx.store.set(idcApplicationKey(arn), app);
  return { RedshiftIdcApplication: presentIdcApplication(app) };
};

const DeleteRedshiftIdcApplication: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "RedshiftIdcApplicationArn");
  requireIdcApplication(ctx, arn);
  ctx.store.delete(idcApplicationKey(arn));
  return {};
};

const DescribeRedshiftIdcApplications: OperationHandler = (input, ctx) => {
  const arn = optionalString(input, "RedshiftIdcApplicationArn");
  if (arn !== undefined) {
    const app = requireIdcApplication(ctx, arn);
    return { RedshiftIdcApplications: [presentIdcApplication(app)] };
  }
  const apps = ctx.store
    .list<StoredRedshiftIdcApplication>()
    .filter((e) => e.key.startsWith("idcapplication/"))
    .map((e) => presentIdcApplication(e.value));
  return { RedshiftIdcApplications: apps };
};

const ModifyRedshiftIdcApplication: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "RedshiftIdcApplicationArn");
  const app = requireIdcApplication(ctx, arn);
  const identityNamespace = optionalString(input, "IdentityNamespace");
  const iamRoleArn = optionalString(input, "IamRoleArn");
  const idcDisplayName = optionalString(input, "IdcDisplayName");
  if (identityNamespace !== undefined) {
    app.IdentityNamespace = identityNamespace;
  }
  if (iamRoleArn !== undefined) {
    app.IamRoleArn = iamRoleArn;
  }
  if (idcDisplayName !== undefined) {
    app.IdcDisplayName = idcDisplayName;
  }
  const tokenIssuerListRaw = input["AuthorizedTokenIssuerList"];
  if (Array.isArray(tokenIssuerListRaw)) {
    app.AuthorizedTokenIssuerList = (
      tokenIssuerListRaw as Record<string, unknown>[]
    ).map((t) => ({
      TrustedTokenIssuerArn: optionalString(t, "TrustedTokenIssuerArn"),
      AuthorizedAudiencesList: stringList(t, "AuthorizedAudiencesList"),
    }));
  }
  const serviceIntegrationsRaw = input["ServiceIntegrations"];
  if (Array.isArray(serviceIntegrationsRaw)) {
    app.ServiceIntegrations = serviceIntegrationsRaw as Record<
      string,
      unknown
    >[];
  }
  ctx.store.set(idcApplicationKey(arn), app);
  return { RedshiftIdcApplication: presentIdcApplication(app) };
};

const GetIdentityCenterAuthToken: OperationHandler = (input, _ctx) => {
  const clusterIds = stringList(input, "ClusterIds");
  if (clusterIds.length === 0) {
    throw awsError(
      "MissingParameter",
      "The required parameter ClusterIds is missing.",
      400,
    );
  }
  const expiration = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    Token: `bunsai-mock-idc-token-${crypto.randomUUID()}`,
    ExpirationTime: expiration,
  };
};

const AddPartner: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const dbName = requireString(input, "DatabaseName");
  const partnerName = requireString(input, "PartnerName");
  const now = new Date().toISOString();
  const partner: StoredPartner = {
    ClusterIdentifier: clusterId,
    DatabaseName: dbName,
    PartnerName: partnerName,
    Status: "Active",
    StatusMessage: undefined,
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(partnerKey(clusterId, dbName, partnerName), partner);
  return { DatabaseName: dbName, PartnerName: partnerName };
};

const DeletePartner: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const dbName = requireString(input, "DatabaseName");
  const partnerName = requireString(input, "PartnerName");
  requirePartner(ctx, clusterId, dbName, partnerName);
  ctx.store.delete(partnerKey(clusterId, dbName, partnerName));
  return { DatabaseName: dbName, PartnerName: partnerName };
};

const DescribePartners: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const dbName = optionalString(input, "DatabaseName");
  const partnerName = optionalString(input, "PartnerName");
  let partners = ctx.store
    .list<StoredPartner>()
    .filter((e) => e.key.startsWith(`partner/${clusterId}/`))
    .map((e) => e.value);
  if (dbName !== undefined) {
    partners = partners.filter((p) => p.DatabaseName === dbName);
  }
  if (partnerName !== undefined) {
    partners = partners.filter((p) => p.PartnerName === partnerName);
  }
  return {
    PartnerIntegrationInfoList: partners.map((p) => ({
      DatabaseName: p.DatabaseName,
      PartnerName: p.PartnerName,
      Status: p.Status,
      StatusMessage: p.StatusMessage,
      CreatedAt: p.CreatedAt,
      UpdatedAt: p.UpdatedAt,
    })),
  };
};

const UpdatePartnerStatus: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const dbName = requireString(input, "DatabaseName");
  const partnerName = requireString(input, "PartnerName");
  const partner = requirePartner(ctx, clusterId, dbName, partnerName);
  partner.Status = requireString(input, "Status");
  partner.StatusMessage =
    optionalString(input, "StatusMessage") ?? partner.StatusMessage;
  partner.UpdatedAt = new Date().toISOString();
  ctx.store.set(partnerKey(clusterId, dbName, partnerName), partner);
  return { DatabaseName: dbName, PartnerName: partnerName };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const policy = requireString(input, "Policy");
  const stored: StoredResourcePolicy = { ResourceArn: arn, Policy: policy };
  ctx.store.set(resourcePolicyKey(arn), stored);
  return { ResourcePolicy: { ResourceArn: arn, Policy: policy } };
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const stored = requireResourcePolicy(ctx, arn);
  return {
    ResourcePolicy: { ResourceArn: stored.ResourceArn, Policy: stored.Policy },
  };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  requireResourcePolicy(ctx, arn);
  ctx.store.delete(resourcePolicyKey(arn));
  return {};
};

const ListRecommendations: OperationHandler = (_input, _ctx) => {
  return { Recommendations: [], Marker: undefined };
};

const FailoverPrimaryCompute: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  const cluster = requireCluster(ctx, clusterId);
  cluster.ClusterStatus = "available";
  ctx.store.set(clusterKey(clusterId), cluster);
  return { Cluster: presentCluster(cluster) };
};

const ModifyLakehouseConfiguration: OperationHandler = (input, ctx) => {
  const clusterId = requireString(input, "ClusterIdentifier");
  requireCluster(ctx, clusterId);
  const existing =
    ctx.store.get<StoredLakehouseConfig>(lakehouseConfigKey(clusterId)) ??
    ({
      ClusterIdentifier: clusterId,
      LakehouseIdcApplicationArn: undefined,
      LakehouseRegistrationStatus: "Deregistered",
      CatalogArn: undefined,
    } as StoredLakehouseConfig);
  const registration = optionalString(input, "LakehouseRegistration");
  if (registration === "Register") {
    existing.LakehouseRegistrationStatus = "Registered";
  } else if (registration === "Deregister") {
    existing.LakehouseRegistrationStatus = "Deregistered";
  }
  const idcArn = optionalString(input, "LakehouseIdcApplicationArn");
  if (idcArn !== undefined) {
    existing.LakehouseIdcApplicationArn = idcArn;
  }
  const catalogName = optionalString(input, "CatalogName");
  if (catalogName !== undefined) {
    existing.CatalogArn = `arn:aws:glue:${ctx.region}:${ctx.account}:catalog/${catalogName}`;
  }
  ctx.store.set(lakehouseConfigKey(clusterId), existing);
  return {
    ClusterIdentifier: existing.ClusterIdentifier,
    LakehouseIdcApplicationArn: existing.LakehouseIdcApplicationArn,
    LakehouseRegistrationStatus: existing.LakehouseRegistrationStatus,
    CatalogArn: existing.CatalogArn,
  };
};

const redshift: ServiceDefinition = {
  name: "redshift",
  protocol: "query",
  operations: {
    AuthorizeClusterSecurityGroupIngress,
    AuthorizeSnapshotAccess,
    BatchDeleteClusterSnapshots,
    BatchModifyClusterSnapshots,
    CancelResize,
    CopyClusterSnapshot,
    CreateAuthenticationProfile,
    CreateCluster,
    CreateClusterParameterGroup,
    CreateClusterSecurityGroup,
    CreateClusterSnapshot,
    CreateClusterSubnetGroup,
    CreateCustomDomainAssociation,
    CreateEventSubscription,
    CreateScheduledAction,
    CreateSnapshotCopyGrant,
    CreateSnapshotSchedule,
    CreateTags,
    CreateUsageLimit,
    DeleteAuthenticationProfile,
    DeleteCluster,
    DeleteClusterParameterGroup,
    DeleteClusterSecurityGroup,
    DeleteClusterSnapshot,
    DeleteClusterSubnetGroup,
    DeleteCustomDomainAssociation,
    DeleteEventSubscription,
    DeleteScheduledAction,
    DeleteSnapshotCopyGrant,
    DeleteSnapshotSchedule,
    DeleteTags,
    DeleteUsageLimit,
    DescribeAccountAttributes,
    DescribeAuthenticationProfiles,
    DescribeClusterDbRevisions,
    DescribeClusterParameterGroups,
    DescribeClusterParameters,
    DescribeClusterSecurityGroups,
    DescribeClusterSnapshots,
    DescribeClusterSubnetGroups,
    DescribeClusterTracks,
    DescribeClusterVersions,
    DescribeClusters,
    DescribeCustomDomainAssociations,
    DescribeDefaultClusterParameters,
    DescribeEventCategories,
    DescribeEventSubscriptions,
    DescribeEvents,
    DescribeLoggingStatus,
    DescribeNodeConfigurationOptions,
    DescribeOrderableClusterOptions,
    DescribeResize,
    DescribeScheduledActions,
    DescribeSnapshotCopyGrants,
    DescribeSnapshotSchedules,
    DescribeStorage,
    DescribeTableRestoreStatus,
    DescribeTags,
    DescribeUsageLimits,
    DisableLogging,
    DisableSnapshotCopy,
    EnableLogging,
    EnableSnapshotCopy,
    GetClusterCredentials,
    GetClusterCredentialsWithIAM,
    ModifyAquaConfiguration,
    ModifyAuthenticationProfile,
    ModifyCluster,
    ModifyClusterDbRevision,
    ModifyClusterIamRoles,
    ModifyClusterMaintenance,
    ModifyClusterParameterGroup,
    ModifyClusterSnapshot,
    ModifyClusterSnapshotSchedule,
    ModifyClusterSubnetGroup,
    ModifyCustomDomainAssociation,
    ModifyEventSubscription,
    ModifyScheduledAction,
    ModifySnapshotCopyRetentionPeriod,
    ModifySnapshotSchedule,
    ModifyUsageLimit,
    PauseCluster,
    RebootCluster,
    ResetClusterParameterGroup,
    ResizeCluster,
    RestoreFromClusterSnapshot,
    RestoreTableFromClusterSnapshot,
    ResumeCluster,
    RevokeClusterSecurityGroupIngress,
    RevokeSnapshotAccess,
    RotateEncryptionKey,
    AssociateDataShareConsumer,
    AuthorizeDataShare,
    AuthorizeEndpointAccess,
    CreateEndpointAccess,
    DeauthorizeDataShare,
    DeleteEndpointAccess,
    DeregisterNamespace,
    DescribeDataShares,
    DescribeDataSharesForConsumer,
    DescribeDataSharesForProducer,
    DescribeEndpointAccess,
    DescribeEndpointAuthorization,
    DisassociateDataShareConsumer,
    ModifyEndpointAccess,
    RegisterNamespace,
    RejectDataShare,
    RevokeEndpointAccess,
    CreateHsmClientCertificate,
    CreateHsmConfiguration,
    DeleteHsmClientCertificate,
    DeleteHsmConfiguration,
    DescribeHsmClientCertificates,
    DescribeHsmConfigurations,
    CreateIntegration,
    DeleteIntegration,
    DescribeIntegrations,
    DescribeInboundIntegrations,
    ModifyIntegration,
    CreateRedshiftIdcApplication,
    DeleteRedshiftIdcApplication,
    DescribeRedshiftIdcApplications,
    ModifyRedshiftIdcApplication,
    GetIdentityCenterAuthToken,
    AddPartner,
    DeletePartner,
    DescribePartners,
    UpdatePartnerStatus,
    DeleteResourcePolicy,
    GetResourcePolicy,
    PutResourcePolicy,
    ListRecommendations,
    FailoverPrimaryCompute,
    ModifyLakehouseConfiguration,
    AcceptReservedNodeExchange,
    DescribeReservedNodeExchangeStatus,
    DescribeReservedNodeOfferings,
    DescribeReservedNodes,
    GetReservedNodeExchangeConfigurationOptions,
    GetReservedNodeExchangeOfferings,
    PurchaseReservedNodeOffering,
  },
  model,
} as const;

export default redshift;
