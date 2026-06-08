import { callerArn } from "../core/arn.ts";
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
  MetadataOptions?: {
    HttpTokens?: string;
    HttpPutResponseHopLimit?: number;
    HttpEndpoint?: string;
    HttpProtocolIpv6?: string;
    InstanceMetadataTags?: string;
  };
  CpuCredits?: string;
  Monitoring?: { State: string };
};

type StoredVpcCidrAssoc = {
  AssociationId: string;
  CidrBlock: string;
};

type StoredVpcIpv6CidrAssoc = {
  AssociationId: string;
  Ipv6CidrBlock: string;
};

type StoredVpc = {
  VpcId: string;
  CidrBlock: string;
  State: string;
  InstanceTenancy: string;
  IsDefault: boolean;
  DhcpOptionsId: string;
  Tags: Tag[];
  CidrBlockAssociations: StoredVpcCidrAssoc[];
  Ipv6CidrBlockAssociations: StoredVpcIpv6CidrAssoc[];
  EnableDnsHostnames?: boolean;
  EnableDnsSupport?: boolean;
  EnableNetworkAddressUsageMetrics?: boolean;
};

type StoredSecurityGroup = {
  GroupId: string;
  GroupName: string;
  Description: string;
  VpcId: string | undefined;
  Tags: Tag[];
  IngressRules: StoredSecurityGroupRule[];
  EgressRules: StoredSecurityGroupRule[];
};

type StoredSecurityGroupRule = {
  SecurityGroupRuleId: string;
  IsEgress: boolean;
  IpProtocol: string;
  FromPort: number | undefined;
  ToPort: number | undefined;
  CidrIpv4: string | undefined;
  Description?: string;
};

type StoredSubnet = {
  SubnetId: string;
  VpcId: string;
  CidrBlock: string;
  AvailabilityZone: string;
  State: string;
  AvailableIpAddressCount: number;
  DefaultForAz: boolean;
  MapPublicIpOnLaunch: boolean;
  Tags: Tag[];
};

type StoredRouteTableAssociation = {
  RouteTableAssociationId: string;
  RouteTableId: string;
  SubnetId: string | undefined;
  GatewayId: string | undefined;
  Main: boolean;
  AssociationState: { State: string };
};

type StoredRouteTable = {
  RouteTableId: string;
  VpcId: string;
  Routes: {
    DestinationCidrBlock: string;
    GatewayId: string;
    Origin: string;
    State: string;
  }[];
  Tags: Tag[];
  Associations: StoredRouteTableAssociation[];
};

type StoredInternetGateway = {
  InternetGatewayId: string;
  Attachments: { State: string; VpcId: string }[];
  Tags: Tag[];
};

type StoredAddress = {
  AllocationId: string;
  PublicIp: string;
  Domain: string;
  PublicIpv4Pool: string;
  NetworkBorderGroup: string;
  AssociationId: string | undefined;
  InstanceId: string | undefined;
  DomainName: string | undefined;
  Tags: Tag[];
};

type StoredHost = {
  HostId: string;
  AvailabilityZone: string;
  InstanceType: string | undefined;
  InstanceFamily: string | undefined;
  AutoPlacement: string;
  HostRecovery: string;
  HostMaintenance: string;
  State: string;
  Tags: Tag[];
};

type StoredVpcPeeringConnection = {
  VpcPeeringConnectionId: string;
  AccepterVpcId: string;
  RequesterVpcId: string;
  Status: { Code: string; Message: string };
  Tags: Tag[];
};

type StoredTgwAttachment = {
  TransitGatewayAttachmentId: string;
  TransitGatewayId: string;
  ResourceId: string;
  ResourceType: string;
  State: string;
  Tags: Tag[];
};

type StoredKeyPair = {
  KeyPairId: string;
  KeyName: string;
  KeyType: string;
  KeyFingerprint: string;
  KeyMaterial: string;
  Tags: Tag[];
};

type StoredVolumeAttachment = {
  VolumeId: string;
  InstanceId: string;
  Device: string;
  State: string;
  AttachTime: string;
};

type StoredVolume = {
  VolumeId: string;
  Size: number;
  VolumeType: string;
  AvailabilityZone: string;
  State: string;
  SnapshotId: string;
  Iops: number;
  Encrypted: boolean;
  CreateTime: string;
  Tags: Tag[];
  Attachments: StoredVolumeAttachment[];
};

type StoredSnapshot = {
  SnapshotId: string;
  VolumeId: string;
  VolumeSize: number;
  State: string;
  Progress: string;
  StartTime: string;
  Description: string;
  Encrypted: boolean;
  OwnerId: string;
  Tags: Tag[];
  CreateVolumePermissions?: { UserId: string }[];
};

type StoredNatGateway = {
  NatGatewayId: string;
  SubnetId: string;
  VpcId: string;
  State: string;
  ConnectivityType: string;
  CreateTime: string;
  NatGatewayAddresses: {
    AllocationId: string | undefined;
    AssociationId?: string;
    PublicIp: string;
    PrivateIp: string;
    NetworkInterfaceId: string;
  }[];
  Tags: Tag[];
};

type StoredNetworkInterfaceAttachment = {
  AttachmentId: string;
  NetworkInterfaceId: string;
  InstanceId: string;
  DeviceIndex: number;
};

type StoredVpnGateway = {
  VpnGatewayId: string;
  State: string;
  VpcAttachments: { VpcId: string; State: string }[];
};

type StoredVerifiedAccessInstance = {
  VerifiedAccessInstanceId: string;
  Description: string;
  TrustProviderIds: string[];
  CreationTime: string;
  LastUpdatedTime: string;
  Tags: Tag[];
  FipsEnabled: boolean;
  AccessLogs?: {
    S3: { Enabled: boolean };
    CloudWatchLogs: { Enabled: boolean };
    KinesisDataFirehose: { Enabled: boolean };
    LogVersion: string;
    IncludeTrustContext: boolean;
  };
};

type StoredVerifiedAccessTrustProvider = {
  VerifiedAccessTrustProviderId: string;
  TrustProviderType: string;
  PolicyReferenceName: string;
  CreationTime: string;
  LastUpdatedTime: string;
  Description?: string;
};

type StoredCapacityReservation = {
  CapacityReservationId: string;
  InstanceType: string;
  InstancePlatform: string;
  AvailabilityZone: string;
  Tenancy: string;
  TotalInstanceCount: number;
  AvailableInstanceCount: number;
  EbsOptimized: boolean;
  EphemeralStorage: boolean;
  State: string;
  EndDateType: string;
  InstanceMatchCriteria: string;
  CreateDate: string;
  Tags: Tag[];
};

type StoredCarrierGateway = {
  CarrierGatewayId: string;
  VpcId: string;
  State: string;
  OwnerId: string;
  Tags: Tag[];
};

type StoredClientVpnEndpoint = {
  ClientVpnEndpointId: string;
  ServerCertificateArn: string;
  DnsName: string;
  State: string;
  Description: string | undefined;
  VpnPort: number | undefined;
  Tags: Tag[];
};

type StoredClientVpnRoute = {
  ClientVpnEndpointId: string;
  DestinationCidrBlock: string;
  TargetSubnet: string;
  Description: string;
  Status: string;
};

type StoredCoipPool = {
  PoolId: string;
  PoolCidrs: string[];
  LocalGatewayRouteTableId: string;
  Tags: Tag[];
  PoolArn: string;
};

type StoredCoipCidr = {
  Cidr: string;
  CoipPoolId: string;
  LocalGatewayRouteTableId: string;
};

type StoredCustomerGateway = {
  CustomerGatewayId: string;
  State: string;
  Type: string;
  IpAddress: string;
  BgpAsn: string;
  CertificateArn: string | undefined;
  DeviceName: string | undefined;
  Tags: Tag[];
};

type StoredIpam = {
  IpamId: string;
  OwnerId: string;
  IpamArn: string;
  State: string;
  Description: string | undefined;
  PublicDefaultScopeId: string;
  PrivateDefaultScopeId: string;
  ScopeCount: number;
  Tags: Tag[];
};

type StoredIpamScope = {
  IpamScopeId: string;
  IpamId: string;
  IpamScopeArn: string;
  IpamArn: string;
  IpamScopeType: string;
  IsDefault: boolean;
  Description: string | undefined;
  PoolCount: number;
  State: string;
  Tags: Tag[];
};

type StoredIpamPool = {
  IpamPoolId: string;
  IpamScopeId: string;
  IpamId: string;
  IpamArn: string;
  IpamScopeArn: string;
  IpamPoolArn: string;
  Locale: string | undefined;
  AddressFamily: string;
  State: string;
  Description: string | undefined;
  Tags: Tag[];
};

type StoredIpamResourceDiscovery = {
  IpamResourceDiscoveryId: string;
  OwnerId: string;
  IpamResourceDiscoveryArn: string;
  State: string;
  Description: string | undefined;
  IsDefault: boolean;
  Tags: Tag[];
};

type StoredIpamExternalResourceVerificationToken = {
  IpamExternalResourceVerificationTokenId: string;
  IpamArn: string;
  IpamId: string;
  TokenValue: string;
  TokenName: string;
  NotAfter: string;
  Status: string;
  State: string;
  Tags: Tag[];
};

type StoredIpamPolicy = {
  IpamPolicyId: string;
  IpamArn: string;
  Description: string | undefined;
  Policy: string | undefined;
  Tags: Tag[];
};

type StoredIpamPrefixListResolver = {
  IpamPrefixListResolverId: string;
  IpamId: string;
  IpamArn: string;
  OwnerId: string;
  Tags: Tag[];
};

type StoredIpamPrefixListResolverTarget = {
  IpamPrefixListResolverId: string;
  IpamPrefixListResolverTargetId: string;
  PrefixListId: string;
  OwnerId: string;
  Tags: Tag[];
};

type StoredIpamPoolCidr = {
  Cidr: string;
  State: string;
};

type StoredLaunchTemplate = {
  LaunchTemplateId: string;
  LaunchTemplateName: string;
  DefaultVersionNumber: number;
  LatestVersionNumber: number;
  CreateTime: string;
  CreatedBy: string;
  Tags: Tag[];
};

type StoredLaunchTemplateVersion = {
  LaunchTemplateId: string;
  LaunchTemplateName: string;
  VersionNumber: number;
  VersionDescription: string | undefined;
  CreateTime: string;
  CreatedBy: string;
  DefaultVersion: boolean;
  LaunchTemplateData: Record<string, unknown>;
};

type StoredLocalGatewayRouteTable = {
  LocalGatewayRouteTableId: string;
  LocalGatewayRouteTableArn: string;
  LocalGatewayId: string;
  State: string;
  OwnerId: string;
  Tags: Tag[];
};

type StoredLocalGatewayRoute = {
  LocalGatewayRouteTableId: string;
  DestinationCidrBlock: string;
  LocalGatewayVirtualInterfaceGroupId: string | undefined;
  Type: string;
  State: string;
};

type StoredLocalGatewayRouteTableVirtualInterfaceGroupAssociation = {
  LocalGatewayRouteTableVirtualInterfaceGroupAssociationId: string;
  LocalGatewayVirtualInterfaceGroupId: string;
  LocalGatewayId: string;
  LocalGatewayRouteTableId: string;
  LocalGatewayRouteTableArn: string;
  OwnerId: string;
  State: string;
  Tags: Tag[];
};

type StoredLocalGatewayRouteTableVpcAssociation = {
  LocalGatewayRouteTableVpcAssociationId: string;
  LocalGatewayRouteTableId: string;
  LocalGatewayRouteTableArn: string;
  LocalGatewayId: string;
  VpcId: string;
  OwnerId: string;
  State: string;
  Tags: Tag[];
};

type StoredLocalGatewayVirtualInterface = {
  LocalGatewayVirtualInterfaceId: string;
  LocalGatewayId: string;
  LocalGatewayVirtualInterfaceGroupId: string | undefined;
  LocalGatewayVirtualInterfaceArn: string;
  OutpostLagId: string | undefined;
  Vlan: number | undefined;
  LocalAddress: string | undefined;
  PeerAddress: string | undefined;
  LocalBgpAsn: number | undefined;
  PeerBgpAsn: number | undefined;
  OwnerId: string;
  Tags: Tag[];
};

type StoredLocalGatewayVirtualInterfaceGroup = {
  LocalGatewayVirtualInterfaceGroupId: string;
  LocalGatewayVirtualInterfaceIds: string[];
  LocalGatewayId: string;
  OwnerId: string;
  LocalBgpAsn: number | undefined;
  LocalGatewayVirtualInterfaceGroupArn: string;
  Tags: Tag[];
};

type StoredMacModificationTask = {
  InstanceId: string;
  MacModificationTaskId: string;
  TaskState: string;
  TaskType: string;
  StartTime: string;
  Tags: Tag[];
};

type StoredManagedPrefixList = {
  PrefixListId: string;
  AddressFamily: string;
  State: string;
  PrefixListArn: string;
  PrefixListName: string;
  MaxEntries: number;
  Version: number;
  Tags: Tag[];
  OwnerId: string;
  Entries: { Cidr: string; Description?: string }[];
};

type StoredNetworkAclEntry = {
  RuleNumber: number;
  Protocol: string;
  RuleAction: string;
  Egress: boolean;
  CidrBlock: string | undefined;
  Ipv6CidrBlock: string | undefined;
};

type StoredNetworkAcl = {
  NetworkAclId: string;
  VpcId: string;
  IsDefault: boolean;
  OwnerId: string;
  Entries: StoredNetworkAclEntry[];
  Tags: Tag[];
};

type StoredNetworkInsightsAccessScope = {
  NetworkInsightsAccessScopeId: string;
  NetworkInsightsAccessScopeArn: string;
  CreatedDate: string;
  UpdatedDate: string;
  Tags: Tag[];
};

type StoredNetworkInsightsPath = {
  NetworkInsightsPathId: string;
  NetworkInsightsPathArn: string;
  CreatedDate: string;
  Source: string;
  Destination: string | undefined;
  Protocol: string;
  DestinationPort: number | undefined;
  Tags: Tag[];
};

type StoredNetworkInsightsAnalysis = {
  NetworkInsightsAnalysisId: string;
  NetworkInsightsPathId: string;
};

type StoredNetworkInsightsAccessScopeAnalysis = {
  NetworkInsightsAccessScopeAnalysisId: string;
  NetworkInsightsAccessScopeId: string;
};

type StoredNetworkInterface = {
  NetworkInterfaceId: string;
  SubnetId: string;
  VpcId: string;
  AvailabilityZone: string;
  Description: string;
  OwnerId: string;
  PrivateIpAddress: string;
  PrivateDnsName: string;
  MacAddress: string;
  Status: string;
  InterfaceType: string;
  SourceDestCheck: boolean;
  Tags: Tag[];
  Groups: { GroupId: string; GroupName: string }[];
};

type StoredNetworkInterfacePermission = {
  NetworkInterfacePermissionId: string;
  NetworkInterfaceId: string;
  AwsAccountId: string | undefined;
  AwsService: string | undefined;
  Permission: string;
  PermissionState: string;
};

type StoredIamInstanceProfileAssociation = {
  AssociationId: string;
  InstanceId: string;
  IamInstanceProfile: { Arn: string; Id: string };
  State: string;
  Timestamp: string;
};

type StoredIpamByoasnAssociation = {
  Asn: string;
  IpamId: string;
  IpamArn: string;
  StatusMessage: string;
  State: string;
};

type StoredIpamResourceDiscoveryAssociation = {
  IpamResourceDiscoveryAssociationId: string;
  IpamResourceDiscoveryAssociationArn: string;
  IpamResourceDiscoveryId: string;
  IpamId: string;
  IpamArn: string;
  OwnerId: string;
  IsDefault: boolean;
  ResourceDiscoveryStatus: string;
  State: string;
  Tags: Tag[];
};

type StoredBundleTask = {
  BundleId: string;
  InstanceId: string;
  State: string;
  StartTime: string;
  UpdateTime: string;
  Progress: string;
};

type StoredDhcpOptions = {
  DhcpOptionsId: string;
  OwnerId: string;
  DhcpConfigurations: { Key: string; Values: string[] }[];
  Tags: Tag[];
};

type StoredEgressOnlyInternetGateway = {
  EgressOnlyInternetGatewayId: string;
  Attachments: { State: string; VpcId: string }[];
  Tags: Tag[];
};

type StoredFleet = {
  FleetId: string;
  FleetState: string;
  CreateTime: string;
  Tags: Tag[];
};

type StoredFlowLog = {
  FlowLogId: string;
  ResourceId: string;
  TrafficType: string;
  LogGroupName: string;
  LogDestination: string;
  FlowLogStatus: string;
  CreationTime: string;
  Tags: Tag[];
};

type StoredFpgaImage = {
  FpgaImageId: string;
  FpgaImageGlobalId: string;
  Name: string;
  Description: string;
  State: string;
  OwnerId: string;
  CreateTime: string;
  Tags: Tag[];
};

type StoredImage = {
  ImageId: string;
  Name: string;
  Description: string;
  InstanceId: string;
  State: string;
  OwnerId: string;
  CreationDate: string;
  Tags: Tag[];
  DeprecationTime?: string;
};

type StoredInstanceConnectEndpoint = {
  InstanceConnectEndpointId: string;
  InstanceConnectEndpointArn: string;
  OwnerId: string;
  State: string;
  SubnetId: string;
  VpcId: string;
  PreserveClientIp: boolean;
  SecurityGroupIds: string[];
  CreatedAt: string;
  Tags: Tag[];
};

type StoredInstanceEventWindow = {
  InstanceEventWindowId: string;
  Name: string;
  CronExpression: string | undefined;
  TimeRanges: {
    StartWeekDay: string;
    StartHour: number;
    EndWeekDay: string;
    EndHour: number;
  }[];
  State: string;
  Tags: Tag[];
};

type StoredExportTask = {
  ExportTaskId: string;
  Description: string;
  InstanceId: string;
  TargetEnvironment: string;
  State: string;
  StatusMessage: string;
  S3Bucket: string;
  S3Key: string;
  Tags: Tag[];
};

type StoredPlacementGroup = {
  GroupId: string;
  GroupName: string;
  State: string;
  Strategy: string;
  PartitionCount: number | undefined;
  SpreadLevel: string | undefined;
  Tags: Tag[];
};

type StoredPublicIpv4Pool = {
  PoolId: string;
  NetworkBorderGroup: string | undefined;
  Tags: Tag[];
};

type StoredReplaceRootVolumeTask = {
  ReplaceRootVolumeTaskId: string;
  InstanceId: string;
  TaskState: string;
  StartTime: string;
  Tags: Tag[];
  ImageId: string | undefined;
  SnapshotId: string | undefined;
  DeleteReplacedRootVolume: boolean;
};

type StoredReservedInstancesListing = {
  ReservedInstancesListingId: string;
  ReservedInstancesId: string;
  ClientToken: string;
  CreateDate: string;
  UpdateDate: string;
  Status: string;
  StatusMessage: string;
  Tags: Tag[];
};

type StoredRouteServer = {
  RouteServerId: string;
  AmazonSideAsn: number;
  State: string;
  PersistRoutesState: string;
  PersistRoutesDuration: number | undefined;
  SnsNotificationsEnabled: boolean;
  Tags: Tag[];
};

type StoredRouteServerEndpoint = {
  RouteServerEndpointId: string;
  RouteServerId: string;
  VpcId: string;
  SubnetId: string;
  EniId: string;
  EniAddress: string;
  State: string;
  Tags: Tag[];
};

type StoredRouteServerPeer = {
  RouteServerPeerId: string;
  RouteServerEndpointId: string;
  RouteServerId: string;
  VpcId: string;
  SubnetId: string;
  PeerAddress: string;
  PeerAsn: number;
  PeerLivenessDetection: string;
  State: string;
  EndpointEniId: string;
  EndpointEniAddress: string;
  Tags: Tag[];
};

type StoredSecondaryNetwork = {
  SecondaryNetworkId: string;
  Ipv4CidrBlock: string;
  NetworkType: string;
  State: string;
  Tags: Tag[];
};

type StoredSecondarySubnet = {
  SecondarySubnetId: string;
  SecondaryNetworkId: string;
  Ipv4CidrBlock: string;
  AvailabilityZone: string;
  State: string;
  Tags: Tag[];
};

type StoredSpotDatafeedSubscription = {
  OwnerId: string;
  Bucket: string;
  Prefix: string;
  State: string;
};

type StoredStoreImageTask = {
  ImageId: string;
  ObjectKey: string;
  Bucket: string;
};

type StoredSubnetCidrReservation = {
  SubnetCidrReservationId: string;
  SubnetId: string;
  Cidr: string;
  ReservationType: string;
  OwnerId: string;
  Description: string;
  Tags: Tag[];
};

type StoredTrafficMirrorFilterRule = {
  TrafficMirrorFilterRuleId: string;
  TrafficMirrorFilterId: string;
  TrafficDirection: string;
  RuleNumber: number;
  RuleAction: string;
  Protocol: number | undefined;
  DestinationPortRange: { FromPort: number; ToPort: number } | undefined;
  SourcePortRange: { FromPort: number; ToPort: number } | undefined;
  DestinationCidrBlock: string;
  SourceCidrBlock: string;
  Description: string;
  Tags: Tag[];
};

type StoredTrafficMirrorFilter = {
  TrafficMirrorFilterId: string;
  IngressFilterRules: StoredTrafficMirrorFilterRule[];
  EgressFilterRules: StoredTrafficMirrorFilterRule[];
  NetworkServices: string[];
  Description: string;
  Tags: Tag[];
};

type StoredTrafficMirrorSession = {
  TrafficMirrorSessionId: string;
  TrafficMirrorTargetId: string;
  TrafficMirrorFilterId: string;
  NetworkInterfaceId: string;
  OwnerId: string;
  PacketLength: number | undefined;
  SessionNumber: number;
  VirtualNetworkId: number | undefined;
  Description: string;
  Tags: Tag[];
};

type StoredTrafficMirrorTarget = {
  TrafficMirrorTargetId: string;
  NetworkInterfaceId: string | undefined;
  NetworkLoadBalancerArn: string | undefined;
  Type: string;
  Description: string;
  OwnerId: string;
  GatewayLoadBalancerEndpointId: string | undefined;
  Tags: Tag[];
};

type StoredTransitGateway = {
  TransitGatewayId: string;
  TransitGatewayArn: string;
  State: string;
  OwnerId: string;
  Description: string;
  CreationTime: string;
  Options: {
    AmazonSideAsn: number;
    AutoAcceptSharedAttachments: string;
    DefaultRouteTableAssociation: string;
    AssociationDefaultRouteTableId: string;
    DefaultRouteTablePropagation: string;
    PropagationDefaultRouteTableId: string;
    VpnEcmpSupport: string;
    DnsSupport: string;
    MulticastSupport: string;
  };
  Tags: Tag[];
};

type StoredTransitGatewayConnect = {
  TransitGatewayAttachmentId: string;
  TransportTransitGatewayAttachmentId: string;
  TransitGatewayId: string;
  State: string;
  CreationTime: string;
  Options: { Protocol: string };
  Tags: Tag[];
};

type StoredTransitGatewayConnectPeer = {
  TransitGatewayAttachmentId: string;
  TransitGatewayConnectPeerId: string;
  State: string;
  CreationTime: string;
  ConnectPeerConfiguration: {
    TransitGatewayAddress: string;
    PeerAddress: string;
    InsideCidrBlocks: string[];
    Protocol: string;
    BgpConfigurations: {
      TransitGatewayAsn: number;
      PeerAsn: number;
      TransitGatewayAddress: string;
      PeerAddress: string;
      BgpStatus: string;
    }[];
  };
  Tags: Tag[];
};

type StoredTransitGatewayMeteringPolicy = {
  TransitGatewayMeteringPolicyId: string;
  TransitGatewayId: string;
  MiddleboxAttachmentIds: string[];
  State: string;
  UpdateEffectiveAt: string;
  Tags: Tag[];
};

type StoredTransitGatewayMeteringPolicyEntry = {
  TransitGatewayMeteringPolicyId: string;
  PolicyRuleNumber: string;
  MeteredAccount: string;
  State: string;
  UpdatedAt: string;
  UpdateEffectiveAt: string;
  MeteringPolicyRule: {
    SourceTransitGatewayAttachmentId: string;
    SourceTransitGatewayAttachmentType: string;
    SourceCidrBlock: string;
    SourcePortRange: string;
    DestinationTransitGatewayAttachmentId: string;
    DestinationTransitGatewayAttachmentType: string;
    DestinationCidrBlock: string;
    DestinationPortRange: string;
    Protocol: string;
  };
};

type StoredTransitGatewayMulticastDomain = {
  TransitGatewayMulticastDomainId: string;
  TransitGatewayId: string;
  TransitGatewayMulticastDomainArn: string;
  OwnerId: string;
  Options: {
    Igmpv2Support: string;
    StaticSourcesSupport: string;
    AutoAcceptSharedAssociations: string;
  };
  State: string;
  CreationTime: string;
  Tags: Tag[];
};

type StoredTransitGatewayPeeringAttachment = {
  TransitGatewayAttachmentId: string;
  AccepterTransitGatewayAttachmentId: string;
  RequesterTgwInfo: {
    TransitGatewayId: string;
    OwnerId: string;
    Region: string;
  };
  AccepterTgwInfo: {
    TransitGatewayId: string;
    OwnerId: string;
    Region: string;
  };
  Options: { DynamicRouting: string };
  Status: { Code: string; Message: string };
  State: string;
  CreationTime: string;
  Tags: Tag[];
};

type StoredTransitGatewayPolicyTable = {
  TransitGatewayPolicyTableId: string;
  TransitGatewayId: string;
  State: string;
  CreationTime: string;
  Tags: Tag[];
};

type StoredTransitGatewayPrefixListReference = {
  TransitGatewayRouteTableId: string;
  PrefixListId: string;
  PrefixListOwnerId: string;
  State: string;
  Blackhole: boolean;
  TransitGatewayAttachment: {
    TransitGatewayAttachmentId: string;
    ResourceType: string;
    ResourceId: string;
  };
};

type StoredTransitGatewayRoute = {
  DestinationCidrBlock: string;
  TransitGatewayRouteTableId: string;
  TransitGatewayAttachmentId: string;
  Blackhole: boolean;
  Type: string;
  State: string;
};

type StoredTransitGatewayRouteTable = {
  TransitGatewayRouteTableId: string;
  TransitGatewayId: string;
  State: string;
  DefaultAssociationRouteTable: boolean;
  DefaultPropagationRouteTable: boolean;
  CreationTime: string;
  Tags: Tag[];
};

type StoredTransitGatewayRouteTableAnnouncement = {
  TransitGatewayRouteTableAnnouncementId: string;
  TransitGatewayId: string;
  PeerTransitGatewayId: string;
  PeeringAttachmentId: string;
  AnnouncementDirection: string;
  TransitGatewayRouteTableId: string;
  State: string;
  CreationTime: string;
  Tags: Tag[];
};

type StoredTransitGatewayVpcAttachment = {
  TransitGatewayAttachmentId: string;
  TransitGatewayId: string;
  VpcId: string;
  VpcOwnerId: string;
  State: string;
  SubnetIds: string[];
  CreationTime: string;
  Options: {
    DnsSupport: string;
    SecurityGroupReferencingSupport: string;
    Ipv6Support: string;
    ApplianceModeSupport: string;
  };
  Tags: Tag[];
};

type StoredVerifiedAccessEndpoint = {
  VerifiedAccessEndpointId: string;
  VerifiedAccessInstanceId: string;
  VerifiedAccessGroupId: string;
  ApplicationDomain: string;
  EndpointType: string;
  AttachmentType: string;
  DomainCertificateArn: string;
  EndpointDomain: string;
  SecurityGroupIds: string[];
  Description: string;
  CreationTime: string;
  LastUpdatedTime: string;
  Tags: Tag[];
  PolicyEnabled?: boolean;
  PolicyDocument?: string;
};

type StoredVerifiedAccessGroup = {
  VerifiedAccessGroupId: string;
  VerifiedAccessInstanceId: string;
  Description: string;
  Owner: string;
  VerifiedAccessGroupArn: string;
  CreationTime: string;
  LastUpdatedTime: string;
  Tags: Tag[];
  PolicyEnabled?: boolean;
  PolicyDocument?: string;
};

type StoredVpcEndpoint = {
  VpcEndpointId: string;
  VpcEndpointType: string;
  VpcId: string;
  ServiceName: string;
  State: string;
  RouteTableIds: string[];
  SubnetIds: string[];
  Groups: { GroupId: string; GroupName: string }[];
  IpAddressType: string;
  PrivateDnsEnabled: boolean;
  OwnerId: string;
  CreationTimestamp: string;
  Tags: Tag[];
};

type StoredVpcEndpointConnectionNotification = {
  ConnectionNotificationId: string;
  ServiceId: string | undefined;
  VpcEndpointId: string | undefined;
  ConnectionNotificationType: string;
  ConnectionNotificationArn: string;
  ConnectionEvents: string[];
  ConnectionNotificationState: string;
};

type StoredVpcEndpointServiceConfiguration = {
  ServiceId: string;
  ServiceName: string;
  ServiceState: string;
  AcceptanceRequired: boolean;
  NetworkLoadBalancerArns: string[];
  GatewayLoadBalancerArns: string[];
  PrivateDnsName: string | undefined;
  Tags: Tag[];
  PayerResponsibility?: string;
  AllowedPrincipals?: string[];
};

type StoredVpcBlockPublicAccessExclusion = {
  ExclusionId: string;
  InternetGatewayExclusionMode: string;
  ResourceArn: string;
  State: string;
  CreationTimestamp: string;
  LastUpdateTimestamp: string;
  Tags: Tag[];
};

type StoredVpcEncryptionControl = {
  VpcEncryptionControlId: string;
  VpcId: string;
  Mode: string;
  State: string;
  Tags: Tag[];
};

type StoredVpnConcentrator = {
  VpnConcentratorId: string;
  State: string;
  TransitGatewayId: string | undefined;
  Type: string;
  Tags: Tag[];
};

type StoredVpnConnection = {
  VpnConnectionId: string;
  State: string;
  CustomerGatewayId: string;
  VpnGatewayId: string | undefined;
  TransitGatewayId: string | undefined;
  Type: string;
  Tags: Tag[];
};

type StoredVpnConnectionRoute = {
  VpnConnectionId: string;
  DestinationCidrBlock: string;
  State: string;
};

type StoredCapacityManagerDataExport = {
  CapacityManagerDataExportId: string;
};

type StoredSpotInstanceRequest = {
  SpotInstanceRequestId: string;
  State: string;
  SpotPrice: string;
  Type: string;
  CreateTime: string;
  Tags: Tag[];
};

type StoredSpotFleetRequest = {
  SpotFleetRequestId: string;
  SpotFleetRequestState: string;
  CreateTime: string;
  SpotFleetRequestConfig: {
    IamFleetRole: string;
    TargetCapacity: number;
    AllocationStrategy: string;
  };
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
const subnetKey = (id: string): string => `subnet/${id}`;
const routeTableKey = (id: string): string => `rtb/${id}`;
const igwKey = (id: string): string => `igw/${id}`;
const addressKey = (id: string): string => `eip/${id}`;
const keyPairKey = (name: string): string => `keypair/${name}`;
const volumeKey = (id: string): string => `volume/${id}`;
const snapshotKey = (id: string): string => `snapshot/${id}`;
const natGatewayKey = (id: string): string => `natgw/${id}`;
const hostKey = (id: string): string => `host/${id}`;
const vpcPeeringKey = (id: string): string => `pcx/${id}`;
const tgwAttachmentKey = (id: string): string => `tgw-attach/${id}`;
const niAttachKey = (id: string): string => `ni-attach/${id}`;
const vpnGwKey = (id: string): string => `vpngw/${id}`;
const vaInstanceKey = (id: string): string => `vai/${id}`;
const vaTrustProviderKey = (id: string): string => `vatp/${id}`;
const capacityReservationKey = (id: string): string => `cr/${id}`;
const carrierGatewayKey = (id: string): string => `cagw/${id}`;
const clientVpnEndpointKey = (id: string): string => `cvpn/${id}`;
const clientVpnRouteKey = (endpointId: string, cidr: string): string =>
  `cvpn-route/${endpointId}/${cidr}`;
const coipPoolKey = (id: string): string => `coip-pool/${id}`;
const coipCidrKey = (poolId: string, cidr: string): string =>
  `coip-cidr/${poolId}/${cidr}`;
const customerGatewayKey = (id: string): string => `cgw/${id}`;
const ipamKey = (id: string): string => `ipam/${id}`;
const ipamScopeKey = (id: string): string => `ipam-scope/${id}`;
const ipamPoolKey = (id: string): string => `ipam-pool/${id}`;
const ipamResourceDiscoveryKey = (id: string): string => `ipam-rd/${id}`;
const ipamExternalTokenKey = (id: string): string => `ipam-token/${id}`;
const ipamPolicyKey = (id: string): string => `ipam-policy/${id}`;
const ipamPrefixListResolverKey = (id: string): string => `ipam-plr/${id}`;
const ipamPrefixListResolverTargetKey = (
  resolverId: string,
  targetId: string,
): string => `ipam-plrt/${resolverId}/${targetId}`;
const launchTemplateKey = (id: string): string => `lt/${id}`;
const launchTemplateVersionKey = (ltId: string, version: number): string =>
  `lt-version/${ltId}/${version}`;
const localGatewayRouteTableKey = (id: string): string => `lgw-rtb/${id}`;
const lgwVifGroupAssocKey = (id: string): string => `lgw-vif-grp-assoc/${id}`;
const lgwVpcAssocKey = (id: string): string => `lgw-vpc-assoc/${id}`;
const lgwVifKey = (id: string): string => `lgw-vif/${id}`;
const lgwVifGroupKey = (id: string): string => `lgw-vif-grp/${id}`;
const macTaskKey = (id: string): string => `mac-task/${id}`;
const managedPrefixListKey = (id: string): string => `pl/${id}`;
const networkAclKey = (id: string): string => `acl/${id}`;
const niAccessScopeKey = (id: string): string => `ni-scope/${id}`;
const niPathKey = (id: string): string => `ni-path/${id}`;
const networkInterfaceKey = (id: string): string => `eni/${id}`;
const niPermissionKey = (id: string): string => `ni-perm/${id}`;
const niAnalysisKey = (id: string): string => `ni-analysis/${id}`;
const niScopeAnalysisKey = (id: string): string => `ni-scope-analysis/${id}`;
const localGatewayRouteKey = (rtbId: string, cidr: string): string =>
  `lgw-route/${rtbId}/${cidr}`;
const iamProfileAssocKey = (id: string): string => `iam-profile-assoc/${id}`;
const ipamByoasnKey = (ipamId: string, asn: string): string =>
  `ipam-byoasn/${ipamId}/${asn}`;
const ipamRdAssocKey = (id: string): string => `ipam-rd-assoc/${id}`;
const bundleTaskKey = (id: string): string => `bundle/${id}`;
const dhcpOptionsKey = (id: string): string => `dhcp/${id}`;
const egressOnlyIgwKey = (id: string): string => `eigw/${id}`;
const fleetKey = (id: string): string => `fleet/${id}`;
const flowLogKey = (id: string): string => `fl/${id}`;
const fpgaImageKey = (id: string): string => `fpga/${id}`;
const imageKey = (id: string): string => `ami/${id}`;
const imageBinKey = (id: string): string => `ami-bin/${id}`;
const snapshotBinKey = (id: string): string => `snapshot-bin/${id}`;
const snapshotLockKey = (id: string): string => `snapshot-lock/${id}`;
const instanceConnectEndpointKey = (id: string): string => `ice/${id}`;
const instanceEventWindowKey = (id: string): string => `iew/${id}`;
const exportTaskKey = (id: string): string => `export/${id}`;
const placementGroupKey = (id: string): string => `pg/${id}`;
const publicIpv4PoolKey = (id: string): string => `ipv4-pool/${id}`;
const replaceRootVolumeTaskKey = (id: string): string => `rrvt/${id}`;
const reservedInstancesListingKey = (id: string): string => `ril/${id}`;
const routeServerKey = (id: string): string => `rs/${id}`;
const routeServerEndpointKey = (id: string): string => `rse/${id}`;
const routeServerPeerKey = (id: string): string => `rsp/${id}`;
const secondaryNetworkKey = (id: string): string => `snet/${id}`;
const secondarySubnetKey = (id: string): string => `ssub/${id}`;
const spotDatafeedKey = (): string => `spot-datafeed/singleton`;
const storeImageTaskKey = (id: string): string => `store-image-task/${id}`;
const subnetCidrReservationKey = (id: string): string => `scr/${id}`;
const trafficMirrorFilterKey = (id: string): string => `tmf/${id}`;
const trafficMirrorFilterRuleKey = (id: string): string => `tmfr/${id}`;
const trafficMirrorSessionKey = (id: string): string => `tms/${id}`;
const trafficMirrorTargetKey = (id: string): string => `tmt/${id}`;
const transitGatewayKey = (id: string): string => `tgw/${id}`;
const transitGatewayConnectKey = (id: string): string => `tgw-connect/${id}`;
const transitGatewayConnectPeerKey = (id: string): string =>
  `tgw-connect-peer/${id}`;
const transitGatewayMeteringPolicyKey = (id: string): string =>
  `tgw-metering-policy/${id}`;
const transitGatewayMeteringPolicyEntryKey = (
  policyId: string,
  ruleNumber: string,
): string => `tgw-mpe/${policyId}/${ruleNumber}`;
const transitGatewayMulticastDomainKey = (id: string): string =>
  `tgw-mcast/${id}`;
const transitGatewayPeeringAttachmentKey = (id: string): string =>
  `tgw-peering/${id}`;
const transitGatewayPolicyTableKey = (id: string): string => `tgw-pt/${id}`;
const transitGatewayPrefixListReferenceKey = (
  rtbId: string,
  plId: string,
): string => `tgw-plr/${rtbId}/${plId}`;
const transitGatewayRouteKey = (rtbId: string, cidr: string): string =>
  `tgw-route/${rtbId}/${cidr}`;
const transitGatewayRouteTableKey = (id: string): string => `tgw-rtb/${id}`;
const transitGatewayRouteTableAnnouncementKey = (id: string): string =>
  `tgw-rtb-ann/${id}`;
const transitGatewayVpcAttachmentKey = (id: string): string =>
  `tgw-vpc-attach/${id}`;
const verifiedAccessEndpointKey = (id: string): string => `vae/${id}`;
const verifiedAccessGroupKey = (id: string): string => `vag/${id}`;
const vpcEndpointKey = (id: string): string => `vpce/${id}`;
const vpcEndpointConnectionNotificationKey = (id: string): string =>
  `vpce-cn/${id}`;
const vpcEndpointServiceConfigKey = (id: string): string => `vpce-svc/${id}`;
const vpcBlockPublicAccessExclusionKey = (id: string): string =>
  `vpce-bpa/${id}`;
const vpcEncryptionControlKey = (id: string): string => `vpce-enc/${id}`;
const vpnConcentratorKey = (id: string): string => `vpn-conc/${id}`;
const vpnConnectionKey = (id: string): string => `vpn-conn/${id}`;
const vpnConnectionRouteKey = (connId: string, cidr: string): string =>
  `vpn-route/${connId}/${cidr}`;
const capacityManagerDataExportKey = (id: string): string => `cmde/${id}`;
const byoipCidrKey = (cidr: string): string => `byoip-cidr/${cidr}`;
const ipamPoolCidrKey = (poolId: string, cidr: string): string =>
  `ipam-pool-cidr/${poolId}/${cidr}`;
const publicIpv4PoolCidrKey = (poolId: string, cidr: string): string =>
  `ipv4-pool-cidr/${poolId}/${cidr}`;
const instanceEventNotificationKey = (): string => `ien/singleton`;
const ebsEncryptionByDefaultKey = (): string => `ebs-enc-by-default/singleton`;
const serialConsoleAccessKey = (): string => `serial-console-access/singleton`;
const imageBlockPublicAccessKey = (): string =>
  `image-block-public-access/singleton`;
const snapshotBlockPublicAccessKey = (): string =>
  `snapshot-block-public-access/singleton`;
const vpcClassicLinkKey = (id: string): string => `vpc-classic-link/${id}`;
const allowedImagesSettingsKey = (): string =>
  `allowed-images-settings/singleton`;
const spotInstanceRequestKey = (id: string): string => `sir/${id}`;
const spotFleetRequestKey = (id: string): string => `sfr/${id}`;
const tgwMcastMemberKey = (
  domainId: string,
  groupIp: string,
  niId: string,
): string => `tgw-mcast-member/${domainId}/${groupIp}/${niId}`;
const tgwMcastSourceKey = (
  domainId: string,
  groupIp: string,
  niId: string,
): string => `tgw-mcast-source/${domainId}/${groupIp}/${niId}`;
const defaultCreditSpecKey = (instanceFamily: string): string =>
  `default-credit-spec/${instanceFamily}`;
const ebsDefaultKmsKeyIdKey = (): string => `ebs-default-kms-key-id/singleton`;
const enabledIpamPolicyKey = (): string => `enabled-ipam-policy/singleton`;
const instanceMetadataDefaultsKey = (): string =>
  `instance-metadata-defaults/singleton`;

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

const allSubnets = (ctx: ServiceContext): StoredSubnet[] =>
  ctx.store
    .list<StoredSubnet>()
    .filter((entry) => entry.key.startsWith("subnet/"))
    .map((entry) => entry.value);

const allRouteTables = (ctx: ServiceContext): StoredRouteTable[] =>
  ctx.store
    .list<StoredRouteTable>()
    .filter((entry) => entry.key.startsWith("rtb/"))
    .map((entry) => entry.value);

const allInternetGateways = (ctx: ServiceContext): StoredInternetGateway[] =>
  ctx.store
    .list<StoredInternetGateway>()
    .filter((entry) => entry.key.startsWith("igw/"))
    .map((entry) => entry.value);

const allAddresses = (ctx: ServiceContext): StoredAddress[] =>
  ctx.store
    .list<StoredAddress>()
    .filter((entry) => entry.key.startsWith("eip/"))
    .map((entry) => entry.value);

const allKeyPairs = (ctx: ServiceContext): StoredKeyPair[] =>
  ctx.store
    .list<StoredKeyPair>()
    .filter((entry) => entry.key.startsWith("keypair/"))
    .map((entry) => entry.value);

const allVolumes = (ctx: ServiceContext): StoredVolume[] =>
  ctx.store
    .list<StoredVolume>()
    .filter((entry) => entry.key.startsWith("volume/"))
    .map((entry) => entry.value);

const allSnapshots = (ctx: ServiceContext): StoredSnapshot[] =>
  ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot/"))
    .map((entry) => entry.value);

const allNatGateways = (ctx: ServiceContext): StoredNatGateway[] =>
  ctx.store
    .list<StoredNatGateway>()
    .filter((entry) => entry.key.startsWith("natgw/"))
    .map((entry) => entry.value);

const allHosts = (ctx: ServiceContext): StoredHost[] =>
  ctx.store
    .list<StoredHost>()
    .filter((entry) => entry.key.startsWith("host/"))
    .map((entry) => entry.value);

const allVpcPeeringConnections = (
  ctx: ServiceContext,
): StoredVpcPeeringConnection[] =>
  ctx.store
    .list<StoredVpcPeeringConnection>()
    .filter((entry) => entry.key.startsWith("pcx/"))
    .map((entry) => entry.value);

const allVpnConcentrators = (ctx: ServiceContext): StoredVpnConcentrator[] =>
  ctx.store
    .list<StoredVpnConcentrator>()
    .filter((entry) => entry.key.startsWith("vpn-conc/"))
    .map((entry) => entry.value);

const allVpnConnections = (ctx: ServiceContext): StoredVpnConnection[] =>
  ctx.store
    .list<StoredVpnConnection>()
    .filter((entry) => entry.key.startsWith("vpn-conn/"))
    .map((entry) => entry.value);

const allVpnGateways = (ctx: ServiceContext): StoredVpnGateway[] =>
  ctx.store
    .list<StoredVpnGateway>()
    .filter((entry) => entry.key.startsWith("vpngw/"))
    .map((entry) => entry.value);

const allTgwAttachments = (ctx: ServiceContext): StoredTgwAttachment[] =>
  ctx.store
    .list<StoredTgwAttachment>()
    .filter((entry) => entry.key.startsWith("tgw-attach/"))
    .map((entry) => entry.value);

const allCapacityReservations = (
  ctx: ServiceContext,
): StoredCapacityReservation[] =>
  ctx.store
    .list<StoredCapacityReservation>()
    .filter((entry) => entry.key.startsWith("cr/"))
    .map((entry) => entry.value);

const allCarrierGateways = (ctx: ServiceContext): StoredCarrierGateway[] =>
  ctx.store
    .list<StoredCarrierGateway>()
    .filter((entry) => entry.key.startsWith("cagw/"))
    .map((entry) => entry.value);

const allCoipPools = (ctx: ServiceContext): StoredCoipPool[] =>
  ctx.store
    .list<StoredCoipPool>()
    .filter((entry) => entry.key.startsWith("coip-pool/"))
    .map((entry) => entry.value);

const allCustomerGateways = (ctx: ServiceContext): StoredCustomerGateway[] =>
  ctx.store
    .list<StoredCustomerGateway>()
    .filter((entry) => entry.key.startsWith("cgw/"))
    .map((entry) => entry.value);

const allDhcpOptions = (ctx: ServiceContext): StoredDhcpOptions[] =>
  ctx.store
    .list<StoredDhcpOptions>()
    .filter((entry) => entry.key.startsWith("dhcp/"))
    .map((entry) => entry.value);

const allEgressOnlyInternetGateways = (
  ctx: ServiceContext,
): StoredEgressOnlyInternetGateway[] =>
  ctx.store
    .list<StoredEgressOnlyInternetGateway>()
    .filter((entry) => entry.key.startsWith("eigw/"))
    .map((entry) => entry.value);

const allFleets = (ctx: ServiceContext): StoredFleet[] =>
  ctx.store
    .list<StoredFleet>()
    .filter((entry) => entry.key.startsWith("fleet/"))
    .map((entry) => entry.value);

const allFlowLogs = (ctx: ServiceContext): StoredFlowLog[] =>
  ctx.store
    .list<StoredFlowLog>()
    .filter((entry) => entry.key.startsWith("fl/"))
    .map((entry) => entry.value);

const allFpgaImages = (ctx: ServiceContext): StoredFpgaImage[] =>
  ctx.store
    .list<StoredFpgaImage>()
    .filter((entry) => entry.key.startsWith("fpga/"))
    .map((entry) => entry.value);

const allIamProfileAssociations = (
  ctx: ServiceContext,
): StoredIamInstanceProfileAssociation[] =>
  ctx.store
    .list<StoredIamInstanceProfileAssociation>()
    .filter((entry) => entry.key.startsWith("iam-profile-assoc/"))
    .map((entry) => entry.value);

const allImages = (ctx: ServiceContext): StoredImage[] =>
  ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith("ami/"))
    .map((entry) => entry.value);

const allImagesInBin = (ctx: ServiceContext): StoredImage[] =>
  ctx.store
    .list<StoredImage>()
    .filter((entry) => entry.key.startsWith("ami-bin/"))
    .map((entry) => entry.value);

const allSnapshotsInBin = (ctx: ServiceContext): StoredSnapshot[] =>
  ctx.store
    .list<StoredSnapshot>()
    .filter((entry) => entry.key.startsWith("snapshot-bin/"))
    .map((entry) => entry.value);

const allInstanceConnectEndpoints = (
  ctx: ServiceContext,
): StoredInstanceConnectEndpoint[] =>
  ctx.store
    .list<StoredInstanceConnectEndpoint>()
    .filter((entry) => entry.key.startsWith("ice/"))
    .map((entry) => entry.value);

const allInstanceEventWindows = (
  ctx: ServiceContext,
): StoredInstanceEventWindow[] =>
  ctx.store
    .list<StoredInstanceEventWindow>()
    .filter((entry) => entry.key.startsWith("iew/"))
    .map((entry) => entry.value);

const integerOf = (value: unknown): number | undefined => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const randomIpv4 = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `52.${bytes[0]}.${bytes[1]}.${bytes[2]}`;
};

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
          Monitoring: instance.Monitoring ?? { State: "disabled" },
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
    CidrBlockAssociations: [
      { AssociationId: hexId("vpc-cidr-assoc"), CidrBlock: cidrBlock },
    ],
    Ipv6CidrBlockAssociations: [],
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
      CidrBlockAssociationSet: (vpc.CidrBlockAssociations ?? []).map((a) => ({
        AssociationId: a.AssociationId,
        CidrBlock: a.CidrBlock,
        CidrBlockState: { State: "associated", StatusMessage: "" },
      })),
      Ipv6CidrBlockAssociationSet: (vpc.Ipv6CidrBlockAssociations ?? []).map(
        (a) => ({
          AssociationId: a.AssociationId,
          Ipv6CidrBlock: a.Ipv6CidrBlock,
          Ipv6CidrBlockState: { State: "associated", StatusMessage: "" },
        }),
      ),
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
    IngressRules: [],
    EgressRules: [],
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

const subnetView = (subnet: StoredSubnet, ownerId: string): unknown => ({
  SubnetId: subnet.SubnetId,
  VpcId: subnet.VpcId,
  CidrBlock: subnet.CidrBlock,
  AvailabilityZone: subnet.AvailabilityZone,
  State: subnet.State,
  AvailableIpAddressCount: subnet.AvailableIpAddressCount,
  DefaultForAz: subnet.DefaultForAz,
  MapPublicIpOnLaunch: subnet.MapPublicIpOnLaunch,
  OwnerId: ownerId,
  Tags: subnet.Tags,
});

const CreateSubnet: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  const cidrBlock =
    typeof input["CidrBlock"] === "string" ? input["CidrBlock"] : "10.0.0.0/24";
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const id = hexId("subnet");
  const subnet: StoredSubnet = {
    SubnetId: id,
    VpcId: vpcId,
    CidrBlock: cidrBlock,
    AvailabilityZone: availabilityZone,
    State: "available",
    AvailableIpAddressCount: 251,
    DefaultForAz: false,
    MapPublicIpOnLaunch: false,
    Tags: [],
  };
  ctx.store.set(subnetKey(id), subnet);
  return { Subnet: subnetView(subnet, ctx.account) };
};

const DescribeSubnets: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SubnetIds"]);
  const subnets = allSubnets(ctx).filter((subnet) =>
    ids.length === 0 ? true : ids.includes(subnet.SubnetId),
  );
  return {
    Subnets: subnets.map((subnet) => subnetView(subnet, ctx.account)),
  };
};

const DeleteSubnet: OperationHandler = (input, ctx) => {
  const id = typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(id));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSubnetID.NotFound",
      `The subnet ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(subnetKey(id));
  return {};
};

const routeTableView = (table: StoredRouteTable, ownerId: string): unknown => ({
  RouteTableId: table.RouteTableId,
  VpcId: table.VpcId,
  OwnerId: ownerId,
  Routes: table.Routes,
  Associations: table.Associations ?? [],
  PropagatingVgws: [],
  Tags: table.Tags,
});

const CreateRouteTable: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  const id = hexId("rtb");
  const table: StoredRouteTable = {
    RouteTableId: id,
    VpcId: vpcId,
    Routes: [
      {
        DestinationCidrBlock: vpc.CidrBlock,
        GatewayId: "local",
        Origin: "CreateRouteTable",
        State: "active",
      },
    ],
    Tags: [],
    Associations: [],
  };
  ctx.store.set(routeTableKey(id), table);
  return { RouteTable: routeTableView(table, ctx.account) };
};

const DescribeRouteTables: OperationHandler = (input, ctx) => {
  const ids = stringList(input["RouteTableIds"]);
  const tables = allRouteTables(ctx).filter((table) =>
    ids.length === 0 ? true : ids.includes(table.RouteTableId),
  );
  return {
    RouteTables: tables.map((table) => routeTableView(table, ctx.account)),
  };
};

const internetGatewayView = (
  gateway: StoredInternetGateway,
  ownerId: string,
): unknown => ({
  InternetGatewayId: gateway.InternetGatewayId,
  OwnerId: ownerId,
  Attachments: gateway.Attachments,
  Tags: gateway.Tags,
});

const CreateInternetGateway: OperationHandler = (_input, ctx) => {
  const id = hexId("igw");
  const gateway: StoredInternetGateway = {
    InternetGatewayId: id,
    Attachments: [],
    Tags: [],
  };
  ctx.store.set(igwKey(id), gateway);
  return { InternetGateway: internetGatewayView(gateway, ctx.account) };
};

const AttachInternetGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["InternetGatewayId"] === "string"
      ? input["InternetGatewayId"]
      : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const gateway = ctx.store.get<StoredInternetGateway>(igwKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidInternetGatewayID.NotFound",
      `The internet gateway ID '${id}' does not exist`,
      400,
    );
  }
  if (ctx.store.get<StoredVpc>(vpcKey(vpcId)) === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  gateway.Attachments = [{ State: "available", VpcId: vpcId }];
  ctx.store.set(igwKey(id), gateway);
  return {};
};

const DescribeInternetGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InternetGatewayIds"]);
  const gateways = allInternetGateways(ctx).filter((gateway) =>
    ids.length === 0 ? true : ids.includes(gateway.InternetGatewayId),
  );
  return {
    InternetGateways: gateways.map((gateway) =>
      internetGatewayView(gateway, ctx.account),
    ),
  };
};

const addressView = (address: StoredAddress): unknown => ({
  AllocationId: address.AllocationId,
  PublicIp: address.PublicIp,
  Domain: address.Domain,
  PublicIpv4Pool: address.PublicIpv4Pool,
  NetworkBorderGroup: address.NetworkBorderGroup,
  Tags: address.Tags,
});

const AllocateAddress: OperationHandler = (input, ctx) => {
  const domain = typeof input["Domain"] === "string" ? input["Domain"] : "vpc";
  const id = hexId("eipalloc");
  const address: StoredAddress = {
    AllocationId: id,
    PublicIp: randomIpv4(),
    Domain: domain,
    PublicIpv4Pool: "amazon",
    NetworkBorderGroup: ctx.region,
    AssociationId: undefined,
    InstanceId: undefined,
    DomainName: undefined,
    Tags: [],
  };
  ctx.store.set(addressKey(id), address);
  return {
    AllocationId: address.AllocationId,
    PublicIp: address.PublicIp,
    Domain: address.Domain,
    PublicIpv4Pool: address.PublicIpv4Pool,
    NetworkBorderGroup: address.NetworkBorderGroup,
  };
};

const DescribeAddresses: OperationHandler = (input, ctx) => {
  const allocationIds = stringList(input["AllocationIds"]);
  const publicIps = stringList(input["PublicIps"]);
  const addresses = allAddresses(ctx).filter((address) => {
    if (allocationIds.length === 0 && publicIps.length === 0) return true;
    return (
      allocationIds.includes(address.AllocationId) ||
      publicIps.includes(address.PublicIp)
    );
  });
  return { Addresses: addresses.map((address) => addressView(address)) };
};

const ReleaseAddress: OperationHandler = (input, ctx) => {
  const allocationId =
    typeof input["AllocationId"] === "string" ? input["AllocationId"] : "";
  const address = ctx.store.get<StoredAddress>(addressKey(allocationId));
  if (address === undefined) {
    throw awsError(
      "InvalidAllocationID.NotFound",
      `The allocation ID '${allocationId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(addressKey(allocationId));
  return {};
};

const fingerprint = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
    if (result.length % 3 === 2) result += ":";
  }
  return result.slice(0, 59);
};

const keyPairView = (keyPair: StoredKeyPair): unknown => ({
  KeyPairId: keyPair.KeyPairId,
  KeyName: keyPair.KeyName,
  KeyType: keyPair.KeyType,
  KeyFingerprint: keyPair.KeyFingerprint,
  Tags: keyPair.Tags,
});

const CreateKeyPair: OperationHandler = (input, ctx) => {
  const keyName = typeof input["KeyName"] === "string" ? input["KeyName"] : "";
  if (keyName === "") {
    throw awsError(
      "MissingParameter",
      "The request must contain the parameter KeyName",
      400,
    );
  }
  if (ctx.store.get<StoredKeyPair>(keyPairKey(keyName)) !== undefined) {
    throw awsError(
      "InvalidKeyPair.Duplicate",
      `The keypair '${keyName}' already exists.`,
      400,
    );
  }
  const keyType =
    typeof input["KeyType"] === "string" ? input["KeyType"] : "rsa";
  const keyPair: StoredKeyPair = {
    KeyPairId: hexId("key"),
    KeyName: keyName,
    KeyType: keyType,
    KeyFingerprint: fingerprint(),
    KeyMaterial: `-----BEGIN RSA PRIVATE KEY-----\nBUNSAI\n-----END RSA PRIVATE KEY-----`,
    Tags: [],
  };
  ctx.store.set(keyPairKey(keyName), keyPair);
  return {
    KeyPairId: keyPair.KeyPairId,
    KeyName: keyPair.KeyName,
    KeyFingerprint: keyPair.KeyFingerprint,
    KeyMaterial: keyPair.KeyMaterial,
    Tags: keyPair.Tags,
  };
};

const DescribeKeyPairs: OperationHandler = (input, ctx) => {
  const names = stringList(input["KeyNames"]);
  const ids = stringList(input["KeyPairIds"]);
  const keyPairs = allKeyPairs(ctx).filter((keyPair) => {
    if (names.length === 0 && ids.length === 0) return true;
    return names.includes(keyPair.KeyName) || ids.includes(keyPair.KeyPairId);
  });
  return { KeyPairs: keyPairs.map((keyPair) => keyPairView(keyPair)) };
};

const DescribeAvailabilityZones: OperationHandler = (_input, ctx) => {
  const suffixes = ["a", "b", "c"];
  return {
    AvailabilityZones: suffixes.map((suffix, index) => ({
      State: "available",
      OptInStatus: "opt-in-not-required",
      RegionName: ctx.region,
      ZoneName: `${ctx.region}${suffix}`,
      ZoneId: `${ctx.region}-az${index + 1}`,
      ZoneType: "availability-zone",
      NetworkBorderGroup: ctx.region,
      Messages: [],
    })),
  };
};

const findSecurityGroup = (
  ctx: ServiceContext,
  input: Record<string, unknown>,
): StoredSecurityGroup => {
  const groupId =
    typeof input["GroupId"] === "string" ? input["GroupId"] : undefined;
  const groupName =
    typeof input["GroupName"] === "string" ? input["GroupName"] : undefined;
  const group = allSecurityGroups(ctx).find((item) =>
    groupId !== undefined
      ? item.GroupId === groupId
      : item.GroupName === groupName,
  );
  if (group === undefined) {
    throw awsError(
      "InvalidGroup.NotFound",
      `The security group '${groupId ?? groupName ?? ""}' does not exist`,
      400,
    );
  }
  return group;
};

const ipPermissionList = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null,
  );
};

const cidrsOfPermission = (permission: Record<string, unknown>): string[] => {
  const ranges = permission["IpRanges"];
  if (!Array.isArray(ranges)) return [];
  return ranges
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => (typeof item["CidrIp"] === "string" ? item["CidrIp"] : ""))
    .filter((cidr) => cidr !== "");
};

const securityGroupRuleView = (
  rule: StoredSecurityGroupRule,
  group: StoredSecurityGroup,
  ownerId: string,
): unknown => ({
  SecurityGroupRuleId: rule.SecurityGroupRuleId,
  GroupId: group.GroupId,
  GroupOwnerId: ownerId,
  IsEgress: rule.IsEgress,
  IpProtocol: rule.IpProtocol,
  FromPort: rule.FromPort,
  ToPort: rule.ToPort,
  CidrIpv4: rule.CidrIpv4,
  Description: rule.Description,
});

const AuthorizeSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const group = findSecurityGroup(ctx, input);
  const permissions = ipPermissionList(input["IpPermissions"]);
  const created: StoredSecurityGroupRule[] = [];
  const addRule = (
    ipProtocol: string,
    fromPort: number | undefined,
    toPort: number | undefined,
    cidr: string | undefined,
  ): void => {
    const rule: StoredSecurityGroupRule = {
      SecurityGroupRuleId: hexId("sgr"),
      IsEgress: false,
      IpProtocol: ipProtocol,
      FromPort: fromPort,
      ToPort: toPort,
      CidrIpv4: cidr,
    };
    group.IngressRules.push(rule);
    created.push(rule);
  };
  if (permissions.length === 0) {
    const cidrIp =
      typeof input["CidrIp"] === "string" ? input["CidrIp"] : "0.0.0.0/0";
    const ipProtocol =
      typeof input["IpProtocol"] === "string" ? input["IpProtocol"] : "-1";
    addRule(
      ipProtocol,
      integerOf(input["FromPort"]),
      integerOf(input["ToPort"]),
      cidrIp,
    );
  } else {
    for (const permission of permissions) {
      const ipProtocol =
        typeof permission["IpProtocol"] === "string"
          ? permission["IpProtocol"]
          : "-1";
      const fromPort = integerOf(permission["FromPort"]);
      const toPort = integerOf(permission["ToPort"]);
      const cidrs = cidrsOfPermission(permission);
      if (cidrs.length === 0) addRule(ipProtocol, fromPort, toPort, undefined);
      else
        for (const cidr of cidrs) addRule(ipProtocol, fromPort, toPort, cidr);
    }
  }
  ctx.store.set(sgKey(group.GroupId), group);
  return {
    Return: true,
    SecurityGroupRules: created.map((rule) =>
      securityGroupRuleView(rule, group, ctx.account),
    ),
  };
};

const RevokeSecurityGroupIngress: OperationHandler = (input, ctx) => {
  const group = findSecurityGroup(ctx, input);
  const ruleIds = stringList(input["SecurityGroupRuleIds"]);
  const permissions = ipPermissionList(input["IpPermissions"]);
  const matchesPermission = (rule: StoredSecurityGroupRule): boolean => {
    if (permissions.length === 0) {
      const cidrIp =
        typeof input["CidrIp"] === "string" ? input["CidrIp"] : undefined;
      const ipProtocol =
        typeof input["IpProtocol"] === "string"
          ? input["IpProtocol"]
          : undefined;
      if (ipProtocol !== undefined && rule.IpProtocol !== ipProtocol)
        return false;
      if (cidrIp !== undefined && rule.CidrIpv4 !== cidrIp) return false;
      return true;
    }
    for (const permission of permissions) {
      const ipProtocol =
        typeof permission["IpProtocol"] === "string"
          ? permission["IpProtocol"]
          : undefined;
      if (ipProtocol !== undefined && rule.IpProtocol !== ipProtocol) continue;
      const cidrs = cidrsOfPermission(permission);
      if (cidrs.length === 0 || cidrs.includes(rule.CidrIpv4 ?? ""))
        return true;
    }
    return false;
  };
  group.IngressRules = group.IngressRules.filter((rule) => {
    if (ruleIds.length > 0) return !ruleIds.includes(rule.SecurityGroupRuleId);
    return !matchesPermission(rule);
  });
  ctx.store.set(sgKey(group.GroupId), group);
  return { Return: true };
};

const volumeView = (volume: StoredVolume): unknown => ({
  VolumeId: volume.VolumeId,
  Size: volume.Size,
  VolumeType: volume.VolumeType,
  AvailabilityZone: volume.AvailabilityZone,
  State: volume.State,
  SnapshotId: volume.SnapshotId,
  Iops: volume.Iops,
  Encrypted: volume.Encrypted,
  CreateTime: volume.CreateTime,
  Attachments: volume.Attachments,
  Tags: volume.Tags,
});

const CreateVolume: OperationHandler = (input, ctx) => {
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const size = integerOf(input["Size"]) ?? 8;
  const volumeType =
    typeof input["VolumeType"] === "string" ? input["VolumeType"] : "gp3";
  const snapshotId =
    typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : "";
  const id = hexId("vol");
  const volume: StoredVolume = {
    VolumeId: id,
    Size: size,
    VolumeType: volumeType,
    AvailabilityZone: availabilityZone,
    State: "available",
    SnapshotId: snapshotId,
    Iops: 3000,
    Encrypted: input["Encrypted"] === true,
    CreateTime: new Date().toISOString(),
    Tags: [],
    Attachments: [],
  };
  ctx.store.set(volumeKey(id), volume);
  return volumeView(volume);
};

const DescribeVolumes: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VolumeIds"]);
  const volumes = allVolumes(ctx).filter((volume) =>
    ids.length === 0 ? true : ids.includes(volume.VolumeId),
  );
  return { Volumes: volumes.map((volume) => volumeView(volume)) };
};

const DeleteVolume: OperationHandler = (input, ctx) => {
  const id = typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(id));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${id}' does not exist.`,
      400,
    );
  }
  ctx.store.delete(volumeKey(id));
  return {};
};

const snapshotView = (snapshot: StoredSnapshot): unknown => ({
  SnapshotId: snapshot.SnapshotId,
  VolumeId: snapshot.VolumeId,
  VolumeSize: snapshot.VolumeSize,
  State: snapshot.State,
  Progress: snapshot.Progress,
  StartTime: snapshot.StartTime,
  Description: snapshot.Description,
  Encrypted: snapshot.Encrypted,
  OwnerId: snapshot.OwnerId,
  Tags: snapshot.Tags,
});

const CreateSnapshot: OperationHandler = (input, ctx) => {
  const volumeId =
    typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(volumeId));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${volumeId}' does not exist.`,
      400,
    );
  }
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("snap");
  const snapshot: StoredSnapshot = {
    SnapshotId: id,
    VolumeId: volumeId,
    VolumeSize: volume.Size,
    State: "completed",
    Progress: "100%",
    StartTime: new Date().toISOString(),
    Description: description,
    Encrypted: volume.Encrypted,
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(snapshotKey(id), snapshot);
  return snapshotView(snapshot);
};

const DescribeSnapshots: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SnapshotIds"]);
  const snapshots = allSnapshots(ctx).filter((snapshot) =>
    ids.length === 0 ? true : ids.includes(snapshot.SnapshotId),
  );
  return { Snapshots: snapshots.map((snapshot) => snapshotView(snapshot)) };
};

const DeleteSnapshot: OperationHandler = (input, ctx) => {
  const id = typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : "";
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
  if (snapshot === undefined) {
    throw awsError(
      "InvalidSnapshot.NotFound",
      `The snapshot '${id}' does not exist.`,
      400,
    );
  }
  ctx.store.delete(snapshotKey(id));
  ctx.store.set(snapshotBinKey(id), snapshot);
  return {};
};

const natGatewayView = (gateway: StoredNatGateway): unknown => ({
  NatGatewayId: gateway.NatGatewayId,
  SubnetId: gateway.SubnetId,
  VpcId: gateway.VpcId,
  State: gateway.State,
  ConnectivityType: gateway.ConnectivityType,
  CreateTime: gateway.CreateTime,
  NatGatewayAddresses: gateway.NatGatewayAddresses,
  Tags: gateway.Tags,
});

const CreateNatGateway: OperationHandler = (input, ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(subnetId));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSubnetID.NotFound",
      `The subnet ID '${subnetId}' does not exist`,
      400,
    );
  }
  const connectivityType =
    typeof input["ConnectivityType"] === "string"
      ? input["ConnectivityType"]
      : "public";
  const allocationId =
    typeof input["AllocationId"] === "string"
      ? input["AllocationId"]
      : undefined;
  const id = hexId("nat");
  const gateway: StoredNatGateway = {
    NatGatewayId: id,
    SubnetId: subnetId,
    VpcId: subnet.VpcId,
    State: "available",
    ConnectivityType: connectivityType,
    CreateTime: new Date().toISOString(),
    NatGatewayAddresses: [
      {
        AllocationId: allocationId,
        PublicIp: randomIpv4(),
        PrivateIp: "10.0.0.10",
        NetworkInterfaceId: hexId("eni"),
      },
    ],
    Tags: [],
  };
  ctx.store.set(natGatewayKey(id), gateway);
  return { NatGateway: natGatewayView(gateway) };
};

const DescribeNatGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NatGatewayIds"]);
  const gateways = allNatGateways(ctx).filter((gateway) =>
    ids.length === 0 ? true : ids.includes(gateway.NatGatewayId),
  );
  return { NatGateways: gateways.map((gateway) => natGatewayView(gateway)) };
};

const DeleteNatGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NatGatewayId"] === "string" ? input["NatGatewayId"] : "";
  const gateway = ctx.store.get<StoredNatGateway>(natGatewayKey(id));
  if (gateway === undefined) {
    throw awsError(
      "NatGatewayNotFound",
      `The Nat Gateway '${id}' does not exist`,
      400,
    );
  }
  gateway.State = "deleted";
  ctx.store.set(natGatewayKey(id), gateway);
  return { NatGatewayId: id };
};

const AcceptAddressTransfer: OperationHandler = (input, ctx) => {
  const address = typeof input["Address"] === "string" ? input["Address"] : "";
  const found = allAddresses(ctx).find((a) => a.PublicIp === address);
  if (found === undefined) {
    throw awsError(
      "InvalidAllocationID.NotFound",
      `No Elastic IP address found for address '${address}'`,
      400,
    );
  }
  return {
    AddressTransfer: {
      PublicIp: found.PublicIp,
      AllocationId: found.AllocationId,
      TransferAccountId: ctx.account,
      TransferOfferAcceptedTimestamp: new Date().toISOString(),
      AddressTransferStatus: "accepted",
    },
  };
};

const AcceptCapacityReservationBillingOwnership: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Return: true };
};

const AcceptReservedInstancesExchangeQuote: OperationHandler = (
  _input,
  _ctx,
) => {
  return { ExchangeId: hexId("ri-exchange") };
};

const AcceptTransitGatewayMulticastDomainAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  const domainId =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : hexId("tgw-mcast");
  return {
    Associations: {
      TransitGatewayMulticastDomainId: domainId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      ResourceOwnerId: ctx.account,
      Subnets: [],
    },
  };
};

const AcceptTransitGatewayPeeringAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const stored = ctx.store.get<StoredTgwAttachment>(
    tgwAttachmentKey(attachmentId),
  );
  const tgwId = stored?.TransitGatewayId ?? hexId("tgw");
  if (stored !== undefined) {
    stored.State = "available";
    ctx.store.set(tgwAttachmentKey(attachmentId), stored);
  }
  return {
    TransitGatewayPeeringAttachment: {
      TransitGatewayAttachmentId: attachmentId,
      AccepterTransitGatewayAttachmentId: hexId("tgw-attach"),
      RequesterTgwInfo: {
        TransitGatewayId: tgwId,
        OwnerId: ctx.account,
        Region: ctx.region,
      },
      AccepterTgwInfo: {
        TransitGatewayId: hexId("tgw"),
        OwnerId: ctx.account,
        Region: ctx.region,
      },
      Status: { Code: "200", Message: "OK" },
      State: "available",
      CreationTime: new Date().toISOString(),
      Tags: stored?.Tags ?? [],
    },
  };
};

const AcceptTransitGatewayVpcAttachment: OperationHandler = (input, ctx) => {
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const stored = ctx.store.get<StoredTgwAttachment>(
    tgwAttachmentKey(attachmentId),
  );
  const tgwId = stored?.TransitGatewayId ?? hexId("tgw");
  const vpcId = stored?.ResourceId ?? hexId("vpc");
  if (stored !== undefined) {
    stored.State = "available";
    ctx.store.set(tgwAttachmentKey(attachmentId), stored);
  }
  return {
    TransitGatewayVpcAttachment: {
      TransitGatewayAttachmentId: attachmentId,
      TransitGatewayId: tgwId,
      VpcId: vpcId,
      VpcOwnerId: ctx.account,
      State: "available",
      SubnetIds: [],
      CreationTime: new Date().toISOString(),
      Tags: stored?.Tags ?? [],
    },
  };
};

const AcceptVpcEndpointConnections: OperationHandler = (_input, _ctx) => {
  return { Unsuccessful: [] };
};

const AcceptVpcPeeringConnection: OperationHandler = (input, ctx) => {
  const peeringId =
    typeof input["VpcPeeringConnectionId"] === "string"
      ? input["VpcPeeringConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpcPeeringConnection>(
    vpcPeeringKey(peeringId),
  );
  if (stored !== undefined) {
    stored.Status = { Code: "active", Message: "Active" };
    ctx.store.set(vpcPeeringKey(peeringId), stored);
  }
  const accepterVpcId = stored?.AccepterVpcId ?? hexId("vpc");
  const requesterVpcId = stored?.RequesterVpcId ?? hexId("vpc");
  return {
    VpcPeeringConnection: {
      VpcPeeringConnectionId: peeringId,
      AccepterVpcInfo: { VpcId: accepterVpcId, OwnerId: ctx.account },
      RequesterVpcInfo: { VpcId: requesterVpcId, OwnerId: ctx.account },
      Status: { Code: "active", Message: "Active" },
      Tags: stored?.Tags ?? [],
    },
  };
};

const AdvertiseByoipCidr: OperationHandler = (input, _ctx) => {
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  return {
    ByoipCidr: {
      Cidr: cidr,
      State: "advertised",
      StatusMessage: "Success",
      AsnAssociations: [],
    },
  };
};

const AllocateHosts: OperationHandler = (input, ctx) => {
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const instanceType =
    typeof input["InstanceType"] === "string"
      ? input["InstanceType"]
      : undefined;
  const instanceFamily =
    typeof input["InstanceFamily"] === "string"
      ? input["InstanceFamily"]
      : undefined;
  const quantity = integerOf(input["Quantity"]) ?? 1;
  const autoPlacement =
    typeof input["AutoPlacement"] === "string" ? input["AutoPlacement"] : "on";
  const hostRecovery =
    typeof input["HostRecovery"] === "string" ? input["HostRecovery"] : "off";
  const hostIds: string[] = [];
  for (let i = 0; i < quantity; i += 1) {
    const id = hexId("h");
    const host: StoredHost = {
      HostId: id,
      AvailabilityZone: availabilityZone,
      InstanceType: instanceType,
      InstanceFamily: instanceFamily,
      AutoPlacement: autoPlacement,
      HostRecovery: hostRecovery,
      HostMaintenance: "on",
      State: "available",
      Tags: [],
    };
    ctx.store.set(hostKey(id), host);
    hostIds.push(id);
  }
  return { HostIds: hostIds };
};

const AllocateIpamPoolCidr: OperationHandler = (input, ctx) => {
  const poolId =
    typeof input["IpamPoolId"] === "string" ? input["IpamPoolId"] : "";
  const cidr =
    typeof input["Cidr"] === "string" ? input["Cidr"] : "10.0.0.0/24";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const allocationId = hexId("ipam-alloc");
  return {
    IpamPoolAllocation: {
      Cidr: cidr,
      IpamPoolAllocationId: allocationId,
      Description: description,
      ResourceId: poolId,
      ResourceType: "ipam-pool",
      ResourceRegion: ctx.region,
      ResourceOwner: ctx.account,
    },
  };
};

const AssignIpv6Addresses: OperationHandler = (input, _ctx) => {
  const networkInterfaceId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const count = integerOf(input["Ipv6AddressCount"]) ?? 1;
  const assigned: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    assigned.push(
      `2600:1f${hex.slice(0, 2)}:${hex.slice(2, 6)}:${hex.slice(6, 10)}::${i + 1}`,
    );
  }
  return {
    NetworkInterfaceId: networkInterfaceId,
    AssignedIpv6Addresses: assigned,
    AssignedIpv6Prefixes: [],
  };
};

const AssignPrivateIpAddresses: OperationHandler = (input, _ctx) => {
  const networkInterfaceId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const requestedIps = stringList(input["PrivateIpAddresses"]);
  const count =
    requestedIps.length > 0
      ? requestedIps.length
      : (integerOf(input["SecondaryPrivateIpAddressCount"]) ?? 1);
  const assigned =
    requestedIps.length > 0
      ? requestedIps.map((ip) => ({ PrivateIpAddress: ip }))
      : Array.from({ length: count }, (_, i) => ({
          PrivateIpAddress: `10.0.1.${100 + i}`,
        }));
  return {
    NetworkInterfaceId: networkInterfaceId,
    AssignedPrivateIpAddresses: assigned,
    AssignedIpv4Prefixes: [],
  };
};

const AssignPrivateNatGatewayAddress: OperationHandler = (input, ctx) => {
  const natGatewayId =
    typeof input["NatGatewayId"] === "string" ? input["NatGatewayId"] : "";
  const gateway = ctx.store.get<StoredNatGateway>(natGatewayKey(natGatewayId));
  if (gateway === undefined) {
    throw awsError(
      "NatGatewayNotFound",
      `The Nat Gateway '${natGatewayId}' does not exist`,
      400,
    );
  }
  const requestedIps = stringList(input["PrivateIpAddresses"]);
  const count =
    requestedIps.length > 0
      ? requestedIps.length
      : (integerOf(input["PrivateIpAddressCount"]) ?? 1);
  const newAddresses = (
    requestedIps.length > 0
      ? requestedIps
      : Array.from({ length: count }, (_, i) => `10.0.2.${200 + i}`)
  ).map((ip) => ({
    AllocationId: undefined,
    PublicIp: randomIpv4(),
    PrivateIp: ip,
    NetworkInterfaceId: hexId("eni"),
  }));
  for (const addr of newAddresses) gateway.NatGatewayAddresses.push(addr);
  ctx.store.set(natGatewayKey(natGatewayId), gateway);
  return {
    NatGatewayId: natGatewayId,
    NatGatewayAddresses: gateway.NatGatewayAddresses,
  };
};

const AssociateAddress: OperationHandler = (input, ctx) => {
  const allocationId =
    typeof input["AllocationId"] === "string"
      ? input["AllocationId"]
      : undefined;
  const publicIp =
    typeof input["PublicIp"] === "string" ? input["PublicIp"] : undefined;
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : undefined;
  let address: StoredAddress | undefined;
  if (allocationId !== undefined) {
    address = ctx.store.get<StoredAddress>(addressKey(allocationId));
  } else if (publicIp !== undefined) {
    address = allAddresses(ctx).find((a) => a.PublicIp === publicIp);
  }
  if (address === undefined) {
    throw awsError(
      "InvalidAllocationID.NotFound",
      "No Elastic IP address found",
      400,
    );
  }
  const associationId = hexId("eipassoc");
  address.AssociationId = associationId;
  address.InstanceId = instanceId;
  ctx.store.set(addressKey(address.AllocationId), address);
  return { AssociationId: associationId };
};

const AssociateCapacityReservationBillingOwner: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Return: true };
};

const AssociateClientVpnTargetNetwork: OperationHandler = (input, _ctx) => {
  const associationId = hexId("cvpn-assoc");
  return {
    AssociationId: associationId,
    Status: { Code: "associated", Message: "" },
  };
};

const AcceptTransitGatewayClientVpnAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const stored = ctx.store.get<StoredTgwAttachment>(
    tgwAttachmentKey(attachmentId),
  );
  const tgwId = stored?.TransitGatewayId ?? hexId("tgw");
  if (stored !== undefined) {
    stored.State = "available";
    ctx.store.set(tgwAttachmentKey(attachmentId), stored);
  }
  return {
    TransitGatewayClientVpnAttachment: {
      TransitGatewayAttachmentId: attachmentId,
      TransitGatewayId: tgwId,
      ClientVpnEndpointId: stored?.ResourceId ?? hexId("cvpn"),
      Region: ctx.region,
      Status: { Code: "available", Message: "" },
      State: "available",
      CreationTime: new Date().toISOString(),
      Tags: stored?.Tags ?? [],
    },
  };
};

const ApplySecurityGroupsToClientVpnTargetNetwork: OperationHandler = (
  input,
  _ctx,
) => {
  const groups = stringList(input["SecurityGroupIds"]);
  return { SecurityGroupIds: groups };
};

const AssociateDhcpOptions: OperationHandler = (input, ctx) => {
  const dhcpOptionsId =
    typeof input["DhcpOptionsId"] === "string" ? input["DhcpOptionsId"] : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  vpc.DhcpOptionsId = dhcpOptionsId;
  ctx.store.set(vpcKey(vpcId), vpc);
  return {};
};

const AssociateEnclaveCertificateIamRole: OperationHandler = (_input, _ctx) => {
  return {
    CertificateS3BucketName: `aws-ec2-enclave-certificate-${hexId("s3")}`,
    CertificateS3ObjectKey: `enclaves/certificate/iam-role-association`,
    EncryptionKmsKeyId: hexId("key"),
  };
};

const AssociateIamInstanceProfile: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const profile = input["IamInstanceProfile"];
  const profileArn =
    typeof profile === "object" &&
    profile !== null &&
    typeof (profile as Record<string, unknown>)["Arn"] === "string"
      ? (profile as Record<string, unknown>)["Arn"]
      : `arn:aws:iam::${ctx.account}:instance-profile/default`;
  const profileId = hexId("AIPA");
  const associationId = hexId("iip-assoc");
  const association: StoredIamInstanceProfileAssociation = {
    AssociationId: associationId,
    InstanceId: instanceId,
    IamInstanceProfile: { Arn: profileArn as string, Id: profileId },
    State: "associated",
    Timestamp: new Date().toISOString(),
  };
  ctx.store.set(iamProfileAssocKey(associationId), association);
  return {
    IamInstanceProfileAssociation: {
      AssociationId: association.AssociationId,
      InstanceId: association.InstanceId,
      IamInstanceProfile: association.IamInstanceProfile,
      State: association.State,
      Timestamp: association.Timestamp,
    },
  };
};

const AssociateInstanceEventWindow: OperationHandler = (input, _ctx) => {
  const eventWindowId =
    typeof input["InstanceEventWindowId"] === "string"
      ? input["InstanceEventWindowId"]
      : hexId("iew");
  return {
    InstanceEventWindow: {
      InstanceEventWindowId: eventWindowId,
      AssociationTarget: {
        InstanceIds: stringList(
          (input["AssociationTarget"] as Record<string, unknown> | undefined)?.[
            "InstanceIds"
          ],
        ),
        Tags: [],
        DedicatedHostIds: [],
      },
      State: "active",
    },
  };
};

const AssociateIpamByoasn: OperationHandler = (input, ctx) => {
  const ipamId =
    typeof input["IpamId"] === "string" ? input["IpamId"] : hexId("ipam");
  const asn = typeof input["Asn"] === "string" ? input["Asn"] : "65000";
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  const ipamArn =
    ipam?.IpamArn ?? `arn:aws:ec2:${ctx.region}:${ctx.account}:ipam/${ipamId}`;
  const association: StoredIpamByoasnAssociation = {
    Asn: asn,
    IpamId: ipamId,
    IpamArn: ipamArn,
    StatusMessage: "BYOASN associated",
    State: "associate-complete",
  };
  ctx.store.set(ipamByoasnKey(ipamId, asn), association);
  return {
    AsnAssociation: {
      Asn: association.Asn,
      IpamId: association.IpamId,
      IpamArn: association.IpamArn,
      StatusMessage: association.StatusMessage,
      State: association.State,
    },
  };
};

const AssociateIpamResourceDiscovery: OperationHandler = (input, ctx) => {
  const ipamId =
    typeof input["IpamId"] === "string" ? input["IpamId"] : hexId("ipam");
  const rdId =
    typeof input["IpamResourceDiscoveryId"] === "string"
      ? input["IpamResourceDiscoveryId"]
      : hexId("ipam-rd");
  const assocId = hexId("ipam-res-disco-assoc");
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  const ipamArn =
    ipam?.IpamArn ?? `arn:aws:ec2:${ctx.region}:${ctx.account}:ipam/${ipamId}`;
  const association: StoredIpamResourceDiscoveryAssociation = {
    IpamResourceDiscoveryAssociationId: assocId,
    IpamResourceDiscoveryAssociationArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:ipam-resource-discovery-association/${assocId}`,
    IpamResourceDiscoveryId: rdId,
    IpamId: ipamId,
    IpamArn: ipamArn,
    OwnerId: ctx.account,
    IsDefault: false,
    ResourceDiscoveryStatus: "active",
    State: "associate-complete",
    Tags: [],
  };
  ctx.store.set(ipamRdAssocKey(assocId), association);
  return { IpamResourceDiscoveryAssociation: association };
};

const AssociateNatGatewayAddress: OperationHandler = (input, ctx) => {
  const natGatewayId =
    typeof input["NatGatewayId"] === "string" ? input["NatGatewayId"] : "";
  const allocationIds = stringList(input["AllocationIds"]);
  const gateway = ctx.store.get<StoredNatGateway>(natGatewayKey(natGatewayId));
  if (gateway === undefined) {
    throw awsError(
      "NatGatewayNotFound",
      `The Nat Gateway '${natGatewayId}' does not exist`,
      400,
    );
  }
  const newAddresses = allocationIds.map((allocId) => ({
    AllocationId: allocId,
    PublicIp: randomIpv4(),
    PrivateIp: "10.0.0.20",
    NetworkInterfaceId: hexId("eni"),
    AssociationId: hexId("eipassoc"),
    IsPrimary: false,
    Status: "succeeded",
  }));
  gateway.NatGatewayAddresses = [
    ...gateway.NatGatewayAddresses,
    ...newAddresses,
  ];
  ctx.store.set(natGatewayKey(natGatewayId), gateway);
  return { NatGatewayId: natGatewayId, NatGatewayAddresses: newAddresses };
};

const AssociateRouteServer: OperationHandler = (input, _ctx) => {
  const routeServerId =
    typeof input["RouteServerId"] === "string"
      ? input["RouteServerId"]
      : hexId("rs");
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  return {
    RouteServerAssociation: {
      RouteServerId: routeServerId,
      VpcId: vpcId,
      State: "associating",
    },
  };
};

const AssociateRouteTable: OperationHandler = (input, ctx) => {
  const routeTableId =
    typeof input["RouteTableId"] === "string" ? input["RouteTableId"] : "";
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : undefined;
  const gatewayId =
    typeof input["GatewayId"] === "string" ? input["GatewayId"] : undefined;
  const table = ctx.store.get<StoredRouteTable>(routeTableKey(routeTableId));
  if (table === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The routeTable ID '${routeTableId}' does not exist`,
      400,
    );
  }
  const assocId = hexId("rtbassoc");
  const assoc: StoredRouteTableAssociation = {
    RouteTableAssociationId: assocId,
    RouteTableId: routeTableId,
    SubnetId: subnetId,
    GatewayId: gatewayId,
    Main: false,
    AssociationState: { State: "associated" },
  };
  table.Associations = [...(table.Associations ?? []), assoc];
  ctx.store.set(routeTableKey(routeTableId), table);
  return { AssociationId: assocId, AssociationState: { State: "associated" } };
};

const AssociateSecurityGroupVpc: OperationHandler = (_input, _ctx) => {
  return { State: "associating" };
};

const AttachVolume: OperationHandler = (input, ctx) => {
  const volumeId =
    typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const device =
    typeof input["Device"] === "string" ? input["Device"] : "/dev/sdf";
  const volume = ctx.store.get<StoredVolume>(volumeKey(volumeId));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${volumeId}' does not exist.`,
      400,
    );
  }
  const attachTime = new Date().toISOString();
  const attachment: StoredVolumeAttachment = {
    VolumeId: volumeId,
    InstanceId: instanceId,
    Device: device,
    State: "attached",
    AttachTime: attachTime,
  };
  volume.State = "in-use";
  volume.Attachments = [attachment];
  ctx.store.set(volumeKey(volumeId), volume);
  return attachment;
};

const DetachVolume: OperationHandler = (input, ctx) => {
  const volumeId =
    typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(volumeId));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${volumeId}' does not exist.`,
      400,
    );
  }
  const prior = volume.Attachments[0];
  volume.State = "available";
  volume.Attachments = [];
  ctx.store.set(volumeKey(volumeId), volume);
  return {
    VolumeId: volumeId,
    InstanceId: prior?.InstanceId ?? "",
    Device: prior?.Device ?? "",
    State: "detached",
    AttachTime: prior?.AttachTime ?? new Date().toISOString(),
  };
};

const AttachNetworkInterface: OperationHandler = (input, ctx) => {
  const networkInterfaceId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const deviceIndex = integerOf(input["DeviceIndex"]) ?? 0;
  const attachmentId = hexId("eni-attach");
  const attachment: StoredNetworkInterfaceAttachment = {
    AttachmentId: attachmentId,
    NetworkInterfaceId: networkInterfaceId,
    InstanceId: instanceId,
    DeviceIndex: deviceIndex,
  };
  ctx.store.set(niAttachKey(attachmentId), attachment);
  return { AttachmentId: attachmentId, NetworkCardIndex: 0 };
};

const DetachNetworkInterface: OperationHandler = (input, ctx) => {
  const attachmentId =
    typeof input["AttachmentId"] === "string" ? input["AttachmentId"] : "";
  ctx.store.delete(niAttachKey(attachmentId));
  return {};
};

const AttachVpnGateway: OperationHandler = (input, ctx) => {
  const vpnGatewayId =
    typeof input["VpnGatewayId"] === "string" ? input["VpnGatewayId"] : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  let gateway = ctx.store.get<StoredVpnGateway>(vpnGwKey(vpnGatewayId));
  if (gateway === undefined) {
    gateway = {
      VpnGatewayId: vpnGatewayId,
      State: "available",
      VpcAttachments: [],
    };
  }
  gateway.VpcAttachments = gateway.VpcAttachments.filter(
    (a) => a.VpcId !== vpcId,
  );
  gateway.VpcAttachments.push({ VpcId: vpcId, State: "attached" });
  ctx.store.set(vpnGwKey(vpnGatewayId), gateway);
  return { VpcAttachment: { VpcId: vpcId, State: "attached" } };
};

const DetachVpnGateway: OperationHandler = (input, ctx) => {
  const vpnGatewayId =
    typeof input["VpnGatewayId"] === "string" ? input["VpnGatewayId"] : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const gateway = ctx.store.get<StoredVpnGateway>(vpnGwKey(vpnGatewayId));
  if (gateway !== undefined) {
    gateway.VpcAttachments = gateway.VpcAttachments.filter(
      (a) => a.VpcId !== vpcId,
    );
    ctx.store.set(vpnGwKey(vpnGatewayId), gateway);
  }
  return {};
};

const AttachClassicLinkVpc: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const DetachClassicLinkVpc: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const AttachVerifiedAccessTrustProvider: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const trustProviderId =
    typeof input["VerifiedAccessTrustProviderId"] === "string"
      ? input["VerifiedAccessTrustProviderId"]
      : "";
  let instance = ctx.store.get<StoredVerifiedAccessInstance>(
    vaInstanceKey(instanceId),
  );
  if (instance === undefined) {
    instance = {
      VerifiedAccessInstanceId: instanceId,
      Description: "",
      TrustProviderIds: [],
      CreationTime: new Date().toISOString(),
      LastUpdatedTime: new Date().toISOString(),
      Tags: [],
      FipsEnabled: false,
    };
  }
  if (!instance.TrustProviderIds.includes(trustProviderId)) {
    instance.TrustProviderIds.push(trustProviderId);
  }
  instance.LastUpdatedTime = new Date().toISOString();
  ctx.store.set(vaInstanceKey(instanceId), instance);
  let trustProvider = ctx.store.get<StoredVerifiedAccessTrustProvider>(
    vaTrustProviderKey(trustProviderId),
  );
  if (trustProvider === undefined) {
    trustProvider = {
      VerifiedAccessTrustProviderId: trustProviderId,
      TrustProviderType: "user",
      PolicyReferenceName: "user",
      CreationTime: new Date().toISOString(),
      LastUpdatedTime: new Date().toISOString(),
    };
    ctx.store.set(vaTrustProviderKey(trustProviderId), trustProvider);
  }
  return {
    VerifiedAccessTrustProvider: {
      VerifiedAccessTrustProviderId:
        trustProvider.VerifiedAccessTrustProviderId,
      TrustProviderType: trustProvider.TrustProviderType,
      PolicyReferenceName: trustProvider.PolicyReferenceName,
      CreationTime: trustProvider.CreationTime,
      LastUpdatedTime: trustProvider.LastUpdatedTime,
    },
    VerifiedAccessInstance: {
      VerifiedAccessInstanceId: instance.VerifiedAccessInstanceId,
      CreationTime: instance.CreationTime,
      LastUpdatedTime: instance.LastUpdatedTime,
      VerifiedAccessTrustProviders: instance.TrustProviderIds.map((id) => ({
        VerifiedAccessTrustProviderId: id,
        TrustProviderType: "user",
      })),
    },
  };
};

const DetachVerifiedAccessTrustProvider: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const trustProviderId =
    typeof input["VerifiedAccessTrustProviderId"] === "string"
      ? input["VerifiedAccessTrustProviderId"]
      : "";
  const instance = ctx.store.get<StoredVerifiedAccessInstance>(
    vaInstanceKey(instanceId),
  );
  if (instance !== undefined) {
    instance.TrustProviderIds = instance.TrustProviderIds.filter(
      (id) => id !== trustProviderId,
    );
    instance.LastUpdatedTime = new Date().toISOString();
    ctx.store.set(vaInstanceKey(instanceId), instance);
  }
  const trustProvider = ctx.store.get<StoredVerifiedAccessTrustProvider>(
    vaTrustProviderKey(trustProviderId),
  );
  return {
    VerifiedAccessTrustProvider: trustProvider
      ? {
          VerifiedAccessTrustProviderId:
            trustProvider.VerifiedAccessTrustProviderId,
          TrustProviderType: trustProvider.TrustProviderType,
          PolicyReferenceName: trustProvider.PolicyReferenceName,
          CreationTime: trustProvider.CreationTime,
          LastUpdatedTime: trustProvider.LastUpdatedTime,
        }
      : {
          VerifiedAccessTrustProviderId: trustProviderId,
          TrustProviderType: "user",
          PolicyReferenceName: "user",
        },
    VerifiedAccessInstance: instance
      ? {
          VerifiedAccessInstanceId: instance.VerifiedAccessInstanceId,
          CreationTime: instance.CreationTime,
          LastUpdatedTime: instance.LastUpdatedTime,
          VerifiedAccessTrustProviders: instance.TrustProviderIds.map((id) => ({
            VerifiedAccessTrustProviderId: id,
            TrustProviderType: "user",
          })),
        }
      : {
          VerifiedAccessInstanceId: instanceId,
          VerifiedAccessTrustProviders: [],
        },
  };
};

const DetachInternetGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["InternetGatewayId"] === "string"
      ? input["InternetGatewayId"]
      : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const gateway = ctx.store.get<StoredInternetGateway>(igwKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidInternetGatewayID.NotFound",
      `The internet gateway ID '${id}' does not exist`,
      400,
    );
  }
  gateway.Attachments = gateway.Attachments.filter((a) => a.VpcId !== vpcId);
  ctx.store.set(igwKey(id), gateway);
  return {};
};

const CreateCapacityReservation: OperationHandler = (input, ctx) => {
  const instanceType =
    typeof input["InstanceType"] === "string" ? input["InstanceType"] : "";
  const instancePlatform =
    typeof input["InstancePlatform"] === "string"
      ? input["InstancePlatform"]
      : "Linux/UNIX";
  const instanceCount =
    typeof input["InstanceCount"] === "number" ? input["InstanceCount"] : 1;
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const tenancy =
    typeof input["Tenancy"] === "string" ? input["Tenancy"] : "default";
  const endDateType =
    typeof input["EndDateType"] === "string"
      ? input["EndDateType"]
      : "unlimited";
  const instanceMatchCriteria =
    typeof input["InstanceMatchCriteria"] === "string"
      ? input["InstanceMatchCriteria"]
      : "open";
  const id = hexId("cr");
  const reservation: StoredCapacityReservation = {
    CapacityReservationId: id,
    InstanceType: instanceType,
    InstancePlatform: instancePlatform,
    AvailabilityZone: availabilityZone,
    Tenancy: tenancy,
    TotalInstanceCount: instanceCount,
    AvailableInstanceCount: instanceCount,
    EbsOptimized: input["EbsOptimized"] === true,
    EphemeralStorage: input["EphemeralStorage"] === true,
    State: "active",
    EndDateType: endDateType,
    InstanceMatchCriteria: instanceMatchCriteria,
    CreateDate: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(capacityReservationKey(id), reservation);
  return {
    CapacityReservation: {
      CapacityReservationId: reservation.CapacityReservationId,
      OwnerId: ctx.account,
      CapacityReservationArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:capacity-reservation/${id}`,
      InstanceType: reservation.InstanceType,
      InstancePlatform: reservation.InstancePlatform,
      AvailabilityZone: reservation.AvailabilityZone,
      Tenancy: reservation.Tenancy,
      TotalInstanceCount: reservation.TotalInstanceCount,
      AvailableInstanceCount: reservation.AvailableInstanceCount,
      EbsOptimized: reservation.EbsOptimized,
      EphemeralStorage: reservation.EphemeralStorage,
      State: reservation.State,
      EndDateType: reservation.EndDateType,
      InstanceMatchCriteria: reservation.InstanceMatchCriteria,
      CreateDate: reservation.CreateDate,
      Tags: reservation.Tags,
    },
  };
};

const CreateCapacityReservationBySplitting: OperationHandler = (input, ctx) => {
  const sourceId =
    typeof input["SourceCapacityReservationId"] === "string"
      ? input["SourceCapacityReservationId"]
      : "";
  const instanceCount =
    typeof input["InstanceCount"] === "number" ? input["InstanceCount"] : 1;
  const source = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(sourceId),
  );
  if (source === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation ID '${sourceId}' does not exist`,
      400,
    );
  }
  const destId = hexId("cr");
  const dest: StoredCapacityReservation = {
    ...source,
    CapacityReservationId: destId,
    TotalInstanceCount: instanceCount,
    AvailableInstanceCount: instanceCount,
    CreateDate: new Date().toISOString(),
  };
  source.TotalInstanceCount -= instanceCount;
  source.AvailableInstanceCount -= instanceCount;
  ctx.store.set(capacityReservationKey(sourceId), source);
  ctx.store.set(capacityReservationKey(destId), dest);
  const toView = (r: StoredCapacityReservation) => ({
    CapacityReservationId: r.CapacityReservationId,
    OwnerId: ctx.account,
    CapacityReservationArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:capacity-reservation/${r.CapacityReservationId}`,
    InstanceType: r.InstanceType,
    InstancePlatform: r.InstancePlatform,
    AvailabilityZone: r.AvailabilityZone,
    Tenancy: r.Tenancy,
    TotalInstanceCount: r.TotalInstanceCount,
    AvailableInstanceCount: r.AvailableInstanceCount,
    State: r.State,
    EndDateType: r.EndDateType,
    InstanceMatchCriteria: r.InstanceMatchCriteria,
    CreateDate: r.CreateDate,
    Tags: r.Tags,
  });
  return {
    SourceCapacityReservation: toView(source),
    DestinationCapacityReservation: toView(dest),
    InstanceCount: instanceCount,
  };
};

const CreateCapacityReservationFleet: OperationHandler = (input, ctx) => {
  const totalTargetCapacity =
    typeof input["TotalTargetCapacity"] === "number"
      ? input["TotalTargetCapacity"]
      : 1;
  const allocationStrategy =
    typeof input["AllocationStrategy"] === "string"
      ? input["AllocationStrategy"]
      : "prioritized";
  const instanceMatchCriteria =
    typeof input["InstanceMatchCriteria"] === "string"
      ? input["InstanceMatchCriteria"]
      : "open";
  const id = hexId("crf");
  return {
    CapacityReservationFleetId: id,
    State: "submitted",
    TotalTargetCapacity: totalTargetCapacity,
    TotalFulfilledCapacity: 0,
    InstanceMatchCriteria: instanceMatchCriteria,
    AllocationStrategy: allocationStrategy,
    CreateTime: new Date().toISOString(),
    FleetCapacityReservations: [],
    Tags: [],
  };
};

const CreateCapacityManagerDataExport: OperationHandler = (_input, ctx) => {
  const id = hexId("cmde");
  const stored: StoredCapacityManagerDataExport = {
    CapacityManagerDataExportId: id,
  };
  ctx.store.set(capacityManagerDataExportKey(id), stored);
  return { CapacityManagerDataExportId: id };
};

const CreateCarrierGateway: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  const id = hexId("cagw");
  const gateway: StoredCarrierGateway = {
    CarrierGatewayId: id,
    VpcId: vpcId,
    State: "available",
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(carrierGatewayKey(id), gateway);
  return {
    CarrierGateway: {
      CarrierGatewayId: gateway.CarrierGatewayId,
      VpcId: gateway.VpcId,
      State: gateway.State,
      OwnerId: gateway.OwnerId,
      Tags: gateway.Tags,
    },
  };
};

const CreateClientVpnEndpoint: OperationHandler = (input, ctx) => {
  const serverCertificateArn =
    typeof input["ServerCertificateArn"] === "string"
      ? input["ServerCertificateArn"]
      : "";
  const id = hexId("cvpn");
  const endpoint: StoredClientVpnEndpoint = {
    ClientVpnEndpointId: id,
    ServerCertificateArn: serverCertificateArn,
    DnsName: `${id}.prod.clientvpn.${ctx.region}.amazonaws.com`,
    State: "available",
    Description: undefined,
    VpnPort: undefined,
    Tags: [],
  };
  ctx.store.set(clientVpnEndpointKey(id), endpoint);
  return {
    ClientVpnEndpointId: id,
    Status: { Code: "available", Message: "" },
    DnsName: endpoint.DnsName,
  };
};

const CreateClientVpnRoute: OperationHandler = (input, ctx) => {
  const clientVpnEndpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const targetVpcSubnetId =
    typeof input["TargetVpcSubnetId"] === "string"
      ? input["TargetVpcSubnetId"]
      : "local";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const endpoint = ctx.store.get<StoredClientVpnEndpoint>(
    clientVpnEndpointKey(clientVpnEndpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidClientVpnEndpointId.NotFound",
      `The Client VPN endpoint ID '${clientVpnEndpointId}' does not exist`,
      400,
    );
  }
  const route: StoredClientVpnRoute = {
    ClientVpnEndpointId: clientVpnEndpointId,
    DestinationCidrBlock: destinationCidrBlock,
    TargetSubnet: targetVpcSubnetId,
    Description: description,
    Status: "active",
  };
  ctx.store.set(
    clientVpnRouteKey(clientVpnEndpointId, destinationCidrBlock),
    route,
  );
  return { Status: { Code: "creating", Message: "" } };
};

const CreateCoipPool: OperationHandler = (input, ctx) => {
  const localGatewayRouteTableId =
    typeof input["LocalGatewayRouteTableId"] === "string"
      ? input["LocalGatewayRouteTableId"]
      : "";
  const id = hexId("ipv4pool-coip");
  const pool: StoredCoipPool = {
    PoolId: id,
    PoolCidrs: [],
    LocalGatewayRouteTableId: localGatewayRouteTableId,
    Tags: [],
    PoolArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:coip-pool/${id}`,
  };
  ctx.store.set(coipPoolKey(id), pool);
  return {
    CoipPool: {
      PoolId: pool.PoolId,
      PoolCidrs: pool.PoolCidrs,
      LocalGatewayRouteTableId: pool.LocalGatewayRouteTableId,
      Tags: pool.Tags,
      PoolArn: pool.PoolArn,
    },
  };
};

const CreateCoipCidr: OperationHandler = (input, ctx) => {
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  const coipPoolId =
    typeof input["CoipPoolId"] === "string" ? input["CoipPoolId"] : "";
  const pool = ctx.store.get<StoredCoipPool>(coipPoolKey(coipPoolId));
  if (pool === undefined) {
    throw awsError(
      "InvalidCoipPoolId.NotFound",
      `The COIP pool ID '${coipPoolId}' does not exist`,
      400,
    );
  }
  const coipCidr: StoredCoipCidr = {
    Cidr: cidr,
    CoipPoolId: coipPoolId,
    LocalGatewayRouteTableId: pool.LocalGatewayRouteTableId,
  };
  ctx.store.set(coipCidrKey(coipPoolId, cidr), coipCidr);
  pool.PoolCidrs.push(cidr);
  ctx.store.set(coipPoolKey(coipPoolId), pool);
  return {
    CoipCidr: {
      Cidr: coipCidr.Cidr,
      CoipPoolId: coipCidr.CoipPoolId,
      LocalGatewayRouteTableId: coipCidr.LocalGatewayRouteTableId,
    },
  };
};

const CreateCustomerGateway: OperationHandler = (input, ctx) => {
  const type = typeof input["Type"] === "string" ? input["Type"] : "ipsec.1";
  const ipAddress =
    typeof input["IpAddress"] === "string"
      ? input["IpAddress"]
      : typeof input["PublicIp"] === "string"
        ? input["PublicIp"]
        : randomIpv4();
  const bgpAsn =
    typeof input["BgpAsn"] === "number"
      ? String(input["BgpAsn"])
      : typeof input["BgpAsnExtended"] === "number"
        ? String(input["BgpAsnExtended"])
        : "65000";
  const certificateArn =
    typeof input["CertificateArn"] === "string"
      ? input["CertificateArn"]
      : undefined;
  const deviceName =
    typeof input["DeviceName"] === "string" ? input["DeviceName"] : undefined;
  const id = hexId("cgw");
  const gateway: StoredCustomerGateway = {
    CustomerGatewayId: id,
    State: "available",
    Type: type,
    IpAddress: ipAddress,
    BgpAsn: bgpAsn,
    CertificateArn: certificateArn,
    DeviceName: deviceName,
    Tags: [],
  };
  ctx.store.set(customerGatewayKey(id), gateway);
  return {
    CustomerGateway: {
      CustomerGatewayId: gateway.CustomerGatewayId,
      State: gateway.State,
      Type: gateway.Type,
      IpAddress: gateway.IpAddress,
      BgpAsn: gateway.BgpAsn,
      CertificateArn: gateway.CertificateArn,
      DeviceName: gateway.DeviceName,
      Tags: gateway.Tags,
    },
  };
};

const CreateDefaultSubnet: OperationHandler = (input, ctx) => {
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const defaultVpc = allVpcs(ctx).find((vpc) => vpc.IsDefault);
  if (defaultVpc === undefined) {
    throw awsError(
      "DefaultVpcAlreadyExists",
      "A Default VPC for this user already exists in this region",
      400,
    );
  }
  const id = hexId("subnet");
  const subnet: StoredSubnet = {
    SubnetId: id,
    VpcId: defaultVpc.VpcId,
    CidrBlock: "172.31.0.0/20",
    AvailabilityZone: availabilityZone,
    State: "available",
    AvailableIpAddressCount: 4091,
    DefaultForAz: true,
    MapPublicIpOnLaunch: true,
    Tags: [],
  };
  ctx.store.set(subnetKey(id), subnet);
  return { Subnet: subnetView(subnet, ctx.account) };
};

const CreateDefaultVpc: OperationHandler = (_input, ctx) => {
  const existing = allVpcs(ctx).find((vpc) => vpc.IsDefault);
  if (existing !== undefined) {
    throw awsError(
      "DefaultVpcAlreadyExists",
      "A Default VPC for this user already exists in this region",
      400,
    );
  }
  const id = hexId("vpc");
  const vpc: StoredVpc = {
    VpcId: id,
    CidrBlock: "172.31.0.0/16",
    State: "available",
    InstanceTenancy: "default",
    IsDefault: true,
    DhcpOptionsId: hexId("dopt"),
    Tags: [],
    CidrBlockAssociations: [
      { AssociationId: hexId("vpc-cidr-assoc"), CidrBlock: "172.31.0.0/16" },
    ],
    Ipv6CidrBlockAssociations: [],
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

const CreateIpam: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : undefined;
  const id = hexId("ipam");
  const ipamArn = `arn:aws:ec2::${ctx.account}:ipam/${id}`;
  const publicScopeId = hexId("ipam-scope");
  const privateScopeId = hexId("ipam-scope");
  const publicScope: StoredIpamScope = {
    IpamScopeId: publicScopeId,
    IpamId: id,
    IpamScopeArn: `arn:aws:ec2::${ctx.account}:ipam-scope/${publicScopeId}`,
    IpamArn: ipamArn,
    IpamScopeType: "public",
    IsDefault: true,
    Description: undefined,
    PoolCount: 0,
    State: "create-complete",
    Tags: [],
  };
  const privateScope: StoredIpamScope = {
    IpamScopeId: privateScopeId,
    IpamId: id,
    IpamScopeArn: `arn:aws:ec2::${ctx.account}:ipam-scope/${privateScopeId}`,
    IpamArn: ipamArn,
    IpamScopeType: "private",
    IsDefault: true,
    Description: undefined,
    PoolCount: 0,
    State: "create-complete",
    Tags: [],
  };
  const ipam: StoredIpam = {
    IpamId: id,
    OwnerId: ctx.account,
    IpamArn: ipamArn,
    State: "create-complete",
    Description: description,
    PublicDefaultScopeId: publicScopeId,
    PrivateDefaultScopeId: privateScopeId,
    ScopeCount: 2,
    Tags: [],
  };
  ctx.store.set(ipamScopeKey(publicScopeId), publicScope);
  ctx.store.set(ipamScopeKey(privateScopeId), privateScope);
  ctx.store.set(ipamKey(id), ipam);
  return {
    Ipam: {
      IpamId: ipam.IpamId,
      OwnerId: ipam.OwnerId,
      IpamArn: ipam.IpamArn,
      State: ipam.State,
      Description: ipam.Description,
      PublicDefaultScopeId: ipam.PublicDefaultScopeId,
      PrivateDefaultScopeId: ipam.PrivateDefaultScopeId,
      ScopeCount: ipam.ScopeCount,
      Tags: ipam.Tags,
    },
  };
};

const CreateIpamExternalResourceVerificationToken: OperationHandler = (
  input,
  ctx,
) => {
  const ipamId = typeof input["IpamId"] === "string" ? input["IpamId"] : "";
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  if (ipam === undefined) {
    throw awsError(
      "InvalidIpamId.NotFound",
      `The IPAM ID '${ipamId}' does not exist`,
      400,
    );
  }
  const id = hexId("ipam-external-resource-verification-token");
  const notAfter = new Date(
    new Date().getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const token: StoredIpamExternalResourceVerificationToken = {
    IpamExternalResourceVerificationTokenId: id,
    IpamArn: ipam.IpamArn,
    IpamId: ipamId,
    TokenValue: hexId("token"),
    TokenName: `ipam-token-${id}`,
    NotAfter: notAfter,
    Status: "create-complete",
    State: "create-complete",
    Tags: [],
  };
  ctx.store.set(ipamExternalTokenKey(id), token);
  return {
    IpamExternalResourceVerificationToken: {
      IpamExternalResourceVerificationTokenId:
        token.IpamExternalResourceVerificationTokenId,
      IpamArn: token.IpamArn,
      IpamId: token.IpamId,
      TokenValue: token.TokenValue,
      TokenName: token.TokenName,
      NotAfter: token.NotAfter,
      Status: token.Status,
      State: token.State,
      Tags: token.Tags,
    },
  };
};

const CreateIpamPolicy: OperationHandler = (input, ctx) => {
  const ipamArn = typeof input["IpamArn"] === "string" ? input["IpamArn"] : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : undefined;
  const policy =
    typeof input["Policy"] === "string" ? input["Policy"] : undefined;
  const id = hexId("ipam-policy");
  const ipamPolicy: StoredIpamPolicy = {
    IpamPolicyId: id,
    IpamArn: ipamArn,
    Description: description,
    Policy: policy,
    Tags: [],
  };
  ctx.store.set(ipamPolicyKey(id), ipamPolicy);
  return {
    IpamPolicy: {
      IpamPolicyId: ipamPolicy.IpamPolicyId,
      IpamArn: ipamPolicy.IpamArn,
      Description: ipamPolicy.Description,
      Policy: ipamPolicy.Policy,
      Tags: ipamPolicy.Tags,
    },
  };
};

const CreateIpamPool: OperationHandler = (input, ctx) => {
  const ipamScopeId =
    typeof input["IpamScopeId"] === "string" ? input["IpamScopeId"] : "";
  const addressFamily =
    typeof input["AddressFamily"] === "string"
      ? input["AddressFamily"]
      : "ipv4";
  const locale =
    typeof input["Locale"] === "string" ? input["Locale"] : undefined;
  const description =
    typeof input["Description"] === "string" ? input["Description"] : undefined;
  const scope = ctx.store.get<StoredIpamScope>(ipamScopeKey(ipamScopeId));
  if (scope === undefined) {
    throw awsError(
      "InvalidIpamScopeId.NotFound",
      `The IPAM scope ID '${ipamScopeId}' does not exist`,
      400,
    );
  }
  const id = hexId("ipam-pool");
  const ipamPoolArn = `arn:aws:ec2::${ctx.account}:ipam-pool/${id}`;
  const pool: StoredIpamPool = {
    IpamPoolId: id,
    IpamScopeId: ipamScopeId,
    IpamId: scope.IpamId,
    IpamArn: scope.IpamArn,
    IpamScopeArn: scope.IpamScopeArn,
    IpamPoolArn: ipamPoolArn,
    Locale: locale,
    AddressFamily: addressFamily,
    State: "create-complete",
    Description: description,
    Tags: [],
  };
  ctx.store.set(ipamPoolKey(id), pool);
  return {
    IpamPool: {
      IpamPoolId: pool.IpamPoolId,
      IpamScopeId: pool.IpamScopeId,
      IpamId: pool.IpamId,
      IpamArn: pool.IpamArn,
      IpamScopeArn: pool.IpamScopeArn,
      IpamPoolArn: pool.IpamPoolArn,
      Locale: pool.Locale,
      AddressFamily: pool.AddressFamily,
      State: pool.State,
      Description: pool.Description,
      Tags: pool.Tags,
    },
  };
};

const CreateIpamPrefixListResolver: OperationHandler = (input, ctx) => {
  const ipamId = typeof input["IpamId"] === "string" ? input["IpamId"] : "";
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  if (ipam === undefined) {
    throw awsError(
      "InvalidIpamId.NotFound",
      `The IPAM ID '${ipamId}' does not exist`,
      400,
    );
  }
  const id = hexId("ipam-prefix-list-resolver");
  const resolver: StoredIpamPrefixListResolver = {
    IpamPrefixListResolverId: id,
    IpamId: ipamId,
    IpamArn: ipam.IpamArn,
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(ipamPrefixListResolverKey(id), resolver);
  return {
    IpamPrefixListResolver: {
      IpamPrefixListResolverId: resolver.IpamPrefixListResolverId,
      IpamId: resolver.IpamId,
      IpamArn: resolver.IpamArn,
      OwnerId: resolver.OwnerId,
      Tags: resolver.Tags,
    },
  };
};

const CreateIpamPrefixListResolverTarget: OperationHandler = (input, ctx) => {
  const ipamPrefixListResolverId =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : "";
  const prefixListId =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const resolver = ctx.store.get<StoredIpamPrefixListResolver>(
    ipamPrefixListResolverKey(ipamPrefixListResolverId),
  );
  if (resolver === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverId.NotFound",
      `The IPAM prefix list resolver ID '${ipamPrefixListResolverId}' does not exist`,
      400,
    );
  }
  const id = hexId("ipam-prefix-list-resolver-target");
  const target: StoredIpamPrefixListResolverTarget = {
    IpamPrefixListResolverId: ipamPrefixListResolverId,
    IpamPrefixListResolverTargetId: id,
    PrefixListId: prefixListId,
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(
    ipamPrefixListResolverTargetKey(ipamPrefixListResolverId, id),
    target,
  );
  return {
    IpamPrefixListResolverTarget: {
      IpamPrefixListResolverId: target.IpamPrefixListResolverId,
      IpamPrefixListResolverTargetId: target.IpamPrefixListResolverTargetId,
      PrefixListId: target.PrefixListId,
      OwnerId: target.OwnerId,
      Tags: target.Tags,
    },
  };
};

const CreateIpamResourceDiscovery: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : undefined;
  const id = hexId("ipam-resource-discovery");
  const resourceDiscovery: StoredIpamResourceDiscovery = {
    IpamResourceDiscoveryId: id,
    OwnerId: ctx.account,
    IpamResourceDiscoveryArn: `arn:aws:ec2::${ctx.account}:ipam-resource-discovery/${id}`,
    State: "create-complete",
    Description: description,
    IsDefault: false,
    Tags: [],
  };
  ctx.store.set(ipamResourceDiscoveryKey(id), resourceDiscovery);
  return {
    IpamResourceDiscovery: {
      IpamResourceDiscoveryId: resourceDiscovery.IpamResourceDiscoveryId,
      OwnerId: resourceDiscovery.OwnerId,
      IpamResourceDiscoveryArn: resourceDiscovery.IpamResourceDiscoveryArn,
      State: resourceDiscovery.State,
      Description: resourceDiscovery.Description,
      IsDefault: resourceDiscovery.IsDefault,
      Tags: resourceDiscovery.Tags,
    },
  };
};

const CreateIpamScope: OperationHandler = (input, ctx) => {
  const ipamId = typeof input["IpamId"] === "string" ? input["IpamId"] : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : undefined;
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  if (ipam === undefined) {
    throw awsError(
      "InvalidIpamId.NotFound",
      `The IPAM ID '${ipamId}' does not exist`,
      400,
    );
  }
  const id = hexId("ipam-scope");
  const scope: StoredIpamScope = {
    IpamScopeId: id,
    IpamId: ipamId,
    IpamScopeArn: `arn:aws:ec2::${ctx.account}:ipam-scope/${id}`,
    IpamArn: ipam.IpamArn,
    IpamScopeType: "private",
    IsDefault: false,
    Description: description,
    PoolCount: 0,
    State: "create-complete",
    Tags: [],
  };
  ipam.ScopeCount += 1;
  ctx.store.set(ipamKey(ipamId), ipam);
  ctx.store.set(ipamScopeKey(id), scope);
  return {
    IpamScope: {
      IpamScopeId: scope.IpamScopeId,
      IpamId: scope.IpamId,
      IpamScopeArn: scope.IpamScopeArn,
      IpamArn: scope.IpamArn,
      IpamScopeType: scope.IpamScopeType,
      IsDefault: scope.IsDefault,
      Description: scope.Description,
      PoolCount: scope.PoolCount,
      State: scope.State,
      Tags: scope.Tags,
    },
  };
};

const CreateLaunchTemplate: OperationHandler = (input, ctx) => {
  const launchTemplateName =
    typeof input["LaunchTemplateName"] === "string"
      ? input["LaunchTemplateName"]
      : "";
  const versionDescription =
    typeof input["VersionDescription"] === "string"
      ? input["VersionDescription"]
      : undefined;
  const launchTemplateData =
    typeof input["LaunchTemplateData"] === "object" &&
    input["LaunchTemplateData"] !== null
      ? (input["LaunchTemplateData"] as Record<string, unknown>)
      : {};
  const id = hexId("lt");
  const createTime = new Date().toISOString();
  const createdBy = callerArn(ctx.account);
  const lt: StoredLaunchTemplate = {
    LaunchTemplateId: id,
    LaunchTemplateName: launchTemplateName,
    DefaultVersionNumber: 1,
    LatestVersionNumber: 1,
    CreateTime: createTime,
    CreatedBy: createdBy,
    Tags: [],
  };
  const version: StoredLaunchTemplateVersion = {
    LaunchTemplateId: id,
    LaunchTemplateName: launchTemplateName,
    VersionNumber: 1,
    VersionDescription: versionDescription,
    CreateTime: createTime,
    CreatedBy: createdBy,
    DefaultVersion: true,
    LaunchTemplateData: launchTemplateData,
  };
  ctx.store.set(launchTemplateKey(id), lt);
  ctx.store.set(launchTemplateVersionKey(id, 1), version);
  return {
    LaunchTemplate: {
      LaunchTemplateId: lt.LaunchTemplateId,
      LaunchTemplateName: lt.LaunchTemplateName,
      DefaultVersionNumber: lt.DefaultVersionNumber,
      LatestVersionNumber: lt.LatestVersionNumber,
      CreateTime: lt.CreateTime,
      CreatedBy: lt.CreatedBy,
      Tags: lt.Tags,
    },
  };
};

const CreateLaunchTemplateVersion: OperationHandler = (input, ctx) => {
  const launchTemplateId =
    typeof input["LaunchTemplateId"] === "string"
      ? input["LaunchTemplateId"]
      : typeof input["LaunchTemplateName"] === "string"
        ? undefined
        : "";
  const launchTemplateName =
    typeof input["LaunchTemplateName"] === "string"
      ? input["LaunchTemplateName"]
      : undefined;
  const versionDescription =
    typeof input["VersionDescription"] === "string"
      ? input["VersionDescription"]
      : undefined;
  const launchTemplateData =
    typeof input["LaunchTemplateData"] === "object" &&
    input["LaunchTemplateData"] !== null
      ? (input["LaunchTemplateData"] as Record<string, unknown>)
      : {};

  let lt: StoredLaunchTemplate | undefined;
  if (launchTemplateId !== undefined && launchTemplateId !== "") {
    lt = ctx.store.get<StoredLaunchTemplate>(
      launchTemplateKey(launchTemplateId),
    );
  } else if (launchTemplateName !== undefined) {
    lt = ctx.store
      .list<StoredLaunchTemplate>()
      .filter((entry) => entry.key.startsWith("lt/"))
      .map((entry) => entry.value)
      .find((t) => t.LaunchTemplateName === launchTemplateName);
  }
  if (lt === undefined) {
    throw awsError(
      "InvalidLaunchTemplateId.NotFound",
      `The launch template ID or name does not exist`,
      400,
    );
  }
  const newVersion = lt.LatestVersionNumber + 1;
  const createTime = new Date().toISOString();
  const createdBy = callerArn(ctx.account);
  const version: StoredLaunchTemplateVersion = {
    LaunchTemplateId: lt.LaunchTemplateId,
    LaunchTemplateName: lt.LaunchTemplateName,
    VersionNumber: newVersion,
    VersionDescription: versionDescription,
    CreateTime: createTime,
    CreatedBy: createdBy,
    DefaultVersion: false,
    LaunchTemplateData: launchTemplateData,
  };
  lt.LatestVersionNumber = newVersion;
  ctx.store.set(launchTemplateKey(lt.LaunchTemplateId), lt);
  ctx.store.set(
    launchTemplateVersionKey(lt.LaunchTemplateId, newVersion),
    version,
  );
  return {
    LaunchTemplateVersion: {
      LaunchTemplateId: version.LaunchTemplateId,
      LaunchTemplateName: version.LaunchTemplateName,
      VersionNumber: version.VersionNumber,
      VersionDescription: version.VersionDescription,
      CreateTime: version.CreateTime,
      CreatedBy: version.CreatedBy,
      DefaultVersion: version.DefaultVersion,
      LaunchTemplateData: version.LaunchTemplateData,
    },
  };
};

const CreateLocalGatewayRouteTableVirtualInterfaceGroupAssociation: OperationHandler =
  (input, ctx) => {
    const localGatewayRouteTableId =
      typeof input["LocalGatewayRouteTableId"] === "string"
        ? input["LocalGatewayRouteTableId"]
        : "";
    const localGatewayVirtualInterfaceGroupId =
      typeof input["LocalGatewayVirtualInterfaceGroupId"] === "string"
        ? input["LocalGatewayVirtualInterfaceGroupId"]
        : "";
    const id = hexId("lgw-vif-grp-assoc");
    const rtb = ctx.store.get<StoredLocalGatewayRouteTable>(
      localGatewayRouteTableKey(localGatewayRouteTableId),
    );
    const localGatewayId = rtb?.LocalGatewayId ?? "lgw-unknown";
    const routeTableArn =
      rtb?.LocalGatewayRouteTableArn ??
      `arn:aws:ec2:${ctx.region}:${ctx.account}:local-gateway-route-table/${localGatewayRouteTableId}`;
    const assoc: StoredLocalGatewayRouteTableVirtualInterfaceGroupAssociation =
      {
        LocalGatewayRouteTableVirtualInterfaceGroupAssociationId: id,
        LocalGatewayVirtualInterfaceGroupId:
          localGatewayVirtualInterfaceGroupId,
        LocalGatewayId: localGatewayId,
        LocalGatewayRouteTableId: localGatewayRouteTableId,
        LocalGatewayRouteTableArn: routeTableArn,
        OwnerId: ctx.account,
        State: "associated",
        Tags: [],
      };
    ctx.store.set(lgwVifGroupAssocKey(id), assoc);
    return {
      LocalGatewayRouteTableVirtualInterfaceGroupAssociation: {
        LocalGatewayRouteTableVirtualInterfaceGroupAssociationId:
          assoc.LocalGatewayRouteTableVirtualInterfaceGroupAssociationId,
        LocalGatewayVirtualInterfaceGroupId:
          assoc.LocalGatewayVirtualInterfaceGroupId,
        LocalGatewayId: assoc.LocalGatewayId,
        LocalGatewayRouteTableId: assoc.LocalGatewayRouteTableId,
        LocalGatewayRouteTableArn: assoc.LocalGatewayRouteTableArn,
        OwnerId: assoc.OwnerId,
        State: assoc.State,
        Tags: assoc.Tags,
      },
    };
  };

const CreateLocalGatewayRouteTableVpcAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const localGatewayRouteTableId =
    typeof input["LocalGatewayRouteTableId"] === "string"
      ? input["LocalGatewayRouteTableId"]
      : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const id = hexId("lgw-vpc-assoc");
  const rtb = ctx.store.get<StoredLocalGatewayRouteTable>(
    localGatewayRouteTableKey(localGatewayRouteTableId),
  );
  const localGatewayId = rtb?.LocalGatewayId ?? "lgw-unknown";
  const routeTableArn =
    rtb?.LocalGatewayRouteTableArn ??
    `arn:aws:ec2:${ctx.region}:${ctx.account}:local-gateway-route-table/${localGatewayRouteTableId}`;
  const assoc: StoredLocalGatewayRouteTableVpcAssociation = {
    LocalGatewayRouteTableVpcAssociationId: id,
    LocalGatewayRouteTableId: localGatewayRouteTableId,
    LocalGatewayRouteTableArn: routeTableArn,
    LocalGatewayId: localGatewayId,
    VpcId: vpcId,
    OwnerId: ctx.account,
    State: "associated",
    Tags: [],
  };
  ctx.store.set(lgwVpcAssocKey(id), assoc);
  return {
    LocalGatewayRouteTableVpcAssociation: {
      LocalGatewayRouteTableVpcAssociationId:
        assoc.LocalGatewayRouteTableVpcAssociationId,
      LocalGatewayRouteTableId: assoc.LocalGatewayRouteTableId,
      LocalGatewayRouteTableArn: assoc.LocalGatewayRouteTableArn,
      LocalGatewayId: assoc.LocalGatewayId,
      VpcId: assoc.VpcId,
      OwnerId: assoc.OwnerId,
      State: assoc.State,
      Tags: assoc.Tags,
    },
  };
};

const CreateLocalGatewayVirtualInterface: OperationHandler = (input, ctx) => {
  const localGatewayVirtualInterfaceGroupId =
    typeof input["LocalGatewayVirtualInterfaceGroupId"] === "string"
      ? input["LocalGatewayVirtualInterfaceGroupId"]
      : undefined;
  const outpostLagId =
    typeof input["OutpostLagId"] === "string"
      ? input["OutpostLagId"]
      : undefined;
  const vlan = typeof input["Vlan"] === "number" ? input["Vlan"] : undefined;
  const localAddress =
    typeof input["LocalAddress"] === "string"
      ? input["LocalAddress"]
      : undefined;
  const peerAddress =
    typeof input["PeerAddress"] === "string" ? input["PeerAddress"] : undefined;
  const peerBgpAsn =
    typeof input["PeerBgpAsn"] === "number" ? input["PeerBgpAsn"] : undefined;
  const id = hexId("lgw-vif");
  const vif: StoredLocalGatewayVirtualInterface = {
    LocalGatewayVirtualInterfaceId: id,
    LocalGatewayId: "lgw-unknown",
    LocalGatewayVirtualInterfaceGroupId: localGatewayVirtualInterfaceGroupId,
    LocalGatewayVirtualInterfaceArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:local-gateway-virtual-interface/${id}`,
    OutpostLagId: outpostLagId,
    Vlan: vlan,
    LocalAddress: localAddress,
    PeerAddress: peerAddress,
    LocalBgpAsn: undefined,
    PeerBgpAsn: peerBgpAsn,
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(lgwVifKey(id), vif);
  return {
    LocalGatewayVirtualInterface: {
      LocalGatewayVirtualInterfaceId: vif.LocalGatewayVirtualInterfaceId,
      LocalGatewayId: vif.LocalGatewayId,
      LocalGatewayVirtualInterfaceGroupId:
        vif.LocalGatewayVirtualInterfaceGroupId,
      LocalGatewayVirtualInterfaceArn: vif.LocalGatewayVirtualInterfaceArn,
      OutpostLagId: vif.OutpostLagId,
      Vlan: vif.Vlan,
      LocalAddress: vif.LocalAddress,
      PeerAddress: vif.PeerAddress,
      LocalBgpAsn: vif.LocalBgpAsn,
      PeerBgpAsn: vif.PeerBgpAsn,
      OwnerId: vif.OwnerId,
      Tags: vif.Tags,
    },
  };
};

const CreateLocalGatewayVirtualInterfaceGroup: OperationHandler = (
  input,
  ctx,
) => {
  const localGatewayId =
    typeof input["LocalGatewayId"] === "string" ? input["LocalGatewayId"] : "";
  const localBgpAsn =
    typeof input["LocalBgpAsn"] === "number" ? input["LocalBgpAsn"] : undefined;
  const id = hexId("lgw-vif-grp");
  const group: StoredLocalGatewayVirtualInterfaceGroup = {
    LocalGatewayVirtualInterfaceGroupId: id,
    LocalGatewayVirtualInterfaceIds: [],
    LocalGatewayId: localGatewayId,
    OwnerId: ctx.account,
    LocalBgpAsn: localBgpAsn,
    LocalGatewayVirtualInterfaceGroupArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:local-gateway-virtual-interface-group/${id}`,
    Tags: [],
  };
  ctx.store.set(lgwVifGroupKey(id), group);
  return {
    LocalGatewayVirtualInterfaceGroup: {
      LocalGatewayVirtualInterfaceGroupId:
        group.LocalGatewayVirtualInterfaceGroupId,
      LocalGatewayVirtualInterfaceIds: group.LocalGatewayVirtualInterfaceIds,
      LocalGatewayId: group.LocalGatewayId,
      OwnerId: group.OwnerId,
      LocalBgpAsn: group.LocalBgpAsn,
      LocalGatewayVirtualInterfaceGroupArn:
        group.LocalGatewayVirtualInterfaceGroupArn,
      Tags: group.Tags,
    },
  };
};

const CreateMacSystemIntegrityProtectionModificationTask: OperationHandler = (
  input,
  ctx,
) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const id = hexId("mac-task");
  const task: StoredMacModificationTask = {
    InstanceId: instanceId,
    MacModificationTaskId: id,
    TaskState: "successful",
    TaskType: "sip-modification",
    StartTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(macTaskKey(id), task);
  return {
    MacModificationTask: {
      InstanceId: task.InstanceId,
      MacModificationTaskId: task.MacModificationTaskId,
      TaskState: task.TaskState,
      TaskType: task.TaskType,
      StartTime: task.StartTime,
      Tags: task.Tags,
    },
  };
};

const CreateManagedPrefixList: OperationHandler = (input, ctx) => {
  const prefixListName =
    typeof input["PrefixListName"] === "string" ? input["PrefixListName"] : "";
  const addressFamily =
    typeof input["AddressFamily"] === "string"
      ? input["AddressFamily"]
      : "IPv4";
  const maxEntries =
    typeof input["MaxEntries"] === "number" ? input["MaxEntries"] : 10;
  const rawEntries = input["Entries"];
  const entries: { Cidr: string; Description?: string }[] = Array.isArray(
    rawEntries,
  )
    ? rawEntries
        .filter((e) => typeof e === "object" && e !== null)
        .map((e) => {
          const entry = e as Record<string, unknown>;
          return {
            Cidr: typeof entry["Cidr"] === "string" ? entry["Cidr"] : "",
            ...(typeof entry["Description"] === "string"
              ? { Description: entry["Description"] }
              : {}),
          };
        })
        .filter((e) => e.Cidr !== "")
    : [];
  const id = hexId("pl");
  const pl: StoredManagedPrefixList = {
    PrefixListId: id,
    AddressFamily: addressFamily,
    State: "create-complete",
    PrefixListArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:managed-prefix-list/${id}`,
    PrefixListName: prefixListName,
    MaxEntries: maxEntries,
    Version: 1,
    Tags: [],
    OwnerId: ctx.account,
    Entries: entries,
  };
  ctx.store.set(managedPrefixListKey(id), pl);
  return {
    PrefixList: {
      PrefixListId: pl.PrefixListId,
      AddressFamily: pl.AddressFamily,
      State: pl.State,
      PrefixListArn: pl.PrefixListArn,
      PrefixListName: pl.PrefixListName,
      MaxEntries: pl.MaxEntries,
      Version: pl.Version,
      Tags: pl.Tags,
      OwnerId: pl.OwnerId,
    },
  };
};

const CreateNetworkAcl: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const id = hexId("acl");
  const acl: StoredNetworkAcl = {
    NetworkAclId: id,
    VpcId: vpcId,
    IsDefault: false,
    OwnerId: ctx.account,
    Entries: [],
    Tags: [],
  };
  ctx.store.set(networkAclKey(id), acl);
  return {
    NetworkAcl: {
      NetworkAclId: acl.NetworkAclId,
      VpcId: acl.VpcId,
      IsDefault: acl.IsDefault,
      OwnerId: acl.OwnerId,
      Entries: acl.Entries,
      Associations: [],
      Tags: acl.Tags,
    },
  };
};

const CreateNetworkAclEntry: OperationHandler = (input, ctx) => {
  const networkAclId =
    typeof input["NetworkAclId"] === "string" ? input["NetworkAclId"] : "";
  const ruleNumber =
    typeof input["RuleNumber"] === "number" ? input["RuleNumber"] : 100;
  const protocol =
    typeof input["Protocol"] === "string" ? input["Protocol"] : "-1";
  const ruleAction =
    typeof input["RuleAction"] === "string" ? input["RuleAction"] : "allow";
  const egress = typeof input["Egress"] === "boolean" ? input["Egress"] : false;
  const cidrBlock =
    typeof input["CidrBlock"] === "string" ? input["CidrBlock"] : undefined;
  const ipv6CidrBlock =
    typeof input["Ipv6CidrBlock"] === "string"
      ? input["Ipv6CidrBlock"]
      : undefined;
  const acl = ctx.store.get<StoredNetworkAcl>(networkAclKey(networkAclId));
  if (acl === undefined) {
    throw awsError(
      "InvalidNetworkAclID.NotFound",
      `The network ACL '${networkAclId}' does not exist`,
      400,
    );
  }
  const entry: StoredNetworkAclEntry = {
    RuleNumber: ruleNumber,
    Protocol: protocol,
    RuleAction: ruleAction,
    Egress: egress,
    CidrBlock: cidrBlock,
    Ipv6CidrBlock: ipv6CidrBlock,
  };
  acl.Entries.push(entry);
  ctx.store.set(networkAclKey(networkAclId), acl);
  return {};
};

const CreateNetworkInsightsAccessScope: OperationHandler = (_input, ctx) => {
  const id = hexId("nis");
  const now = new Date().toISOString();
  const scope: StoredNetworkInsightsAccessScope = {
    NetworkInsightsAccessScopeId: id,
    NetworkInsightsAccessScopeArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:network-insights-access-scope/${id}`,
    CreatedDate: now,
    UpdatedDate: now,
    Tags: [],
  };
  ctx.store.set(niAccessScopeKey(id), scope);
  return {
    NetworkInsightsAccessScope: {
      NetworkInsightsAccessScopeId: scope.NetworkInsightsAccessScopeId,
      NetworkInsightsAccessScopeArn: scope.NetworkInsightsAccessScopeArn,
      CreatedDate: scope.CreatedDate,
      UpdatedDate: scope.UpdatedDate,
      Tags: scope.Tags,
    },
    NetworkInsightsAccessScopeContent: {
      NetworkInsightsAccessScopeId: scope.NetworkInsightsAccessScopeId,
      MatchPaths: [],
      ExcludePaths: [],
    },
  };
};

const CreateNetworkInsightsPath: OperationHandler = (input, ctx) => {
  const source = typeof input["Source"] === "string" ? input["Source"] : "";
  const destination =
    typeof input["Destination"] === "string" ? input["Destination"] : undefined;
  const protocol =
    typeof input["Protocol"] === "string" ? input["Protocol"] : "tcp";
  const destinationPort =
    typeof input["DestinationPort"] === "number"
      ? input["DestinationPort"]
      : undefined;
  const id = hexId("nip");
  const now = new Date().toISOString();
  const path: StoredNetworkInsightsPath = {
    NetworkInsightsPathId: id,
    NetworkInsightsPathArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:network-insights-path/${id}`,
    CreatedDate: now,
    Source: source,
    Destination: destination,
    Protocol: protocol,
    DestinationPort: destinationPort,
    Tags: [],
  };
  ctx.store.set(niPathKey(id), path);
  return {
    NetworkInsightsPath: {
      NetworkInsightsPathId: path.NetworkInsightsPathId,
      NetworkInsightsPathArn: path.NetworkInsightsPathArn,
      CreatedDate: path.CreatedDate,
      Source: path.Source,
      Destination: path.Destination,
      Protocol: path.Protocol,
      DestinationPort: path.DestinationPort,
      Tags: path.Tags,
    },
  };
};

const CreateNetworkInterface: OperationHandler = (input, ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const privateIpAddress =
    typeof input["PrivateIpAddress"] === "string"
      ? input["PrivateIpAddress"]
      : randomIpv4();
  const interfaceType =
    typeof input["InterfaceType"] === "string"
      ? input["InterfaceType"]
      : "interface";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(subnetId));
  const vpcId = subnet?.VpcId ?? "";
  const az = subnet?.AvailabilityZone ?? `${ctx.region}a`;
  const id = hexId("eni");
  const macAddr = [0, 0, 0, 0, 0, 0]
    .map(() =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0"),
    )
    .join(":");
  const ni: StoredNetworkInterface = {
    NetworkInterfaceId: id,
    SubnetId: subnetId,
    VpcId: vpcId,
    AvailabilityZone: az,
    Description: description,
    OwnerId: ctx.account,
    PrivateIpAddress: privateIpAddress,
    PrivateDnsName: `ip-${privateIpAddress.replace(/\./g, "-")}.${az}.compute.internal`,
    MacAddress: macAddr,
    Status: "available",
    InterfaceType: interfaceType,
    SourceDestCheck: true,
    Tags: [],
    Groups: [],
  };
  ctx.store.set(networkInterfaceKey(id), ni);
  return {
    NetworkInterface: {
      NetworkInterfaceId: ni.NetworkInterfaceId,
      SubnetId: ni.SubnetId,
      VpcId: ni.VpcId,
      AvailabilityZone: ni.AvailabilityZone,
      Description: ni.Description,
      OwnerId: ni.OwnerId,
      PrivateIpAddress: ni.PrivateIpAddress,
      PrivateDnsName: ni.PrivateDnsName,
      MacAddress: ni.MacAddress,
      Status: ni.Status,
      InterfaceType: ni.InterfaceType,
      SourceDestCheck: ni.SourceDestCheck,
      TagSet: ni.Tags,
      Groups: ni.Groups,
    },
  };
};

const CreateNetworkInterfacePermission: OperationHandler = (input, ctx) => {
  const networkInterfaceId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const awsAccountId =
    typeof input["AwsAccountId"] === "string"
      ? input["AwsAccountId"]
      : undefined;
  const awsService =
    typeof input["AwsService"] === "string" ? input["AwsService"] : undefined;
  const permission =
    typeof input["Permission"] === "string" ? input["Permission"] : "";
  const id = hexId("ni-perm");
  const perm: StoredNetworkInterfacePermission = {
    NetworkInterfacePermissionId: id,
    NetworkInterfaceId: networkInterfaceId,
    AwsAccountId: awsAccountId,
    AwsService: awsService,
    Permission: permission,
    PermissionState: "granted",
  };
  ctx.store.set(niPermissionKey(id), perm);
  return {
    InterfacePermission: {
      NetworkInterfacePermissionId: perm.NetworkInterfacePermissionId,
      NetworkInterfaceId: perm.NetworkInterfaceId,
      AwsAccountId: perm.AwsAccountId,
      AwsService: perm.AwsService,
      Permission: perm.Permission,
      PermissionState: {
        State: perm.PermissionState,
      },
    },
  };
};

const CreateLocalGatewayRoute: OperationHandler = (input, ctx) => {
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const localGatewayRouteTableId =
    typeof input["LocalGatewayRouteTableId"] === "string"
      ? input["LocalGatewayRouteTableId"]
      : "";
  const localGatewayVirtualInterfaceGroupId =
    typeof input["LocalGatewayVirtualInterfaceGroupId"] === "string"
      ? input["LocalGatewayVirtualInterfaceGroupId"]
      : undefined;
  const route: StoredLocalGatewayRoute = {
    LocalGatewayRouteTableId: localGatewayRouteTableId,
    DestinationCidrBlock: destinationCidrBlock,
    LocalGatewayVirtualInterfaceGroupId: localGatewayVirtualInterfaceGroupId,
    Type: "static",
    State: "active",
  };
  ctx.store.set(
    localGatewayRouteKey(localGatewayRouteTableId, destinationCidrBlock),
    route,
  );
  return {
    Route: {
      DestinationCidrBlock: route.DestinationCidrBlock,
      LocalGatewayVirtualInterfaceGroupId:
        route.LocalGatewayVirtualInterfaceGroupId,
      Type: route.Type,
      State: route.State,
      LocalGatewayRouteTableId: route.LocalGatewayRouteTableId,
    },
  };
};

const CreateLocalGatewayRouteTable: OperationHandler = (input, ctx) => {
  const localGatewayId =
    typeof input["LocalGatewayId"] === "string" ? input["LocalGatewayId"] : "";
  const id = hexId("lgw-rtb");
  const routeTable: StoredLocalGatewayRouteTable = {
    LocalGatewayRouteTableId: id,
    LocalGatewayRouteTableArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:local-gateway-route-table/${id}`,
    LocalGatewayId: localGatewayId,
    State: "available",
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(localGatewayRouteTableKey(id), routeTable);
  return {
    LocalGatewayRouteTable: {
      LocalGatewayRouteTableId: routeTable.LocalGatewayRouteTableId,
      LocalGatewayRouteTableArn: routeTable.LocalGatewayRouteTableArn,
      LocalGatewayId: routeTable.LocalGatewayId,
      State: routeTable.State,
      OwnerId: routeTable.OwnerId,
      Tags: routeTable.Tags,
    },
  };
};

const AssociateSubnetCidrBlock: OperationHandler = (input, _ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const ipv6CidrBlock =
    typeof input["Ipv6CidrBlock"] === "string"
      ? input["Ipv6CidrBlock"]
      : "::/0";
  const assocId = hexId("subnet-cidr-assoc");
  return {
    SubnetId: subnetId,
    Ipv6CidrBlockAssociation: {
      AssociationId: assocId,
      Ipv6CidrBlock: ipv6CidrBlock,
      Ipv6CidrBlockState: { State: "associated", StatusMessage: "" },
    },
  };
};

const AssociateTransitGatewayMulticastDomain: OperationHandler = (
  input,
  _ctx,
) => {
  const domainId =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : hexId("tgw-mcast");
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  const subnetIds = stringList(input["SubnetIds"]);
  return {
    Associations: {
      TransitGatewayMulticastDomainId: domainId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      Subnets: subnetIds.map((id) => ({ SubnetId: id, State: "associated" })),
    },
  };
};

const AssociateTransitGatewayPolicyTable: OperationHandler = (input, _ctx) => {
  const tableId =
    typeof input["TransitGatewayPolicyTableId"] === "string"
      ? input["TransitGatewayPolicyTableId"]
      : hexId("tgw-policy-table");
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  return {
    Association: {
      TransitGatewayPolicyTableId: tableId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      State: "associated",
    },
  };
};

const AssociateTransitGatewayRouteTable: OperationHandler = (input, _ctx) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : hexId("tgw-rtb");
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  return {
    Association: {
      TransitGatewayRouteTableId: routeTableId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      State: "associated",
    },
  };
};

const AssociateTrunkInterface: OperationHandler = (input, _ctx) => {
  const branchInterfaceId =
    typeof input["BranchInterfaceId"] === "string"
      ? input["BranchInterfaceId"]
      : hexId("eni");
  const trunkInterfaceId =
    typeof input["TrunkInterfaceId"] === "string"
      ? input["TrunkInterfaceId"]
      : hexId("eni");
  const interfaceProtocol =
    typeof input["InterfaceProtocol"] === "string"
      ? input["InterfaceProtocol"]
      : "VLAN";
  const vlanId = integerOf(input["VlanId"]);
  const greKey = integerOf(input["GreKey"]);
  const assocId = hexId("trunk-assoc");
  return {
    InterfaceAssociation: {
      AssociationId: assocId,
      BranchInterfaceId: branchInterfaceId,
      TrunkInterfaceId: trunkInterfaceId,
      InterfaceProtocol: interfaceProtocol,
      VlanId: vlanId,
      GreKey: greKey,
      Tags: [],
    },
    ClientToken: hexId("token"),
  };
};

const AssociateVpcCidrBlock: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  const cidrBlock =
    typeof input["CidrBlock"] === "string" ? input["CidrBlock"] : undefined;
  const ipv6CidrBlock =
    typeof input["Ipv6CidrBlock"] === "string"
      ? input["Ipv6CidrBlock"]
      : undefined;
  const assocId = hexId("vpc-cidr-assoc");
  const result: Record<string, unknown> = { VpcId: vpcId };
  if (cidrBlock !== undefined) {
    (vpc.CidrBlockAssociations ??= []).push({
      AssociationId: assocId,
      CidrBlock: cidrBlock,
    });
    ctx.store.set(vpcKey(vpcId), vpc);
    result["CidrBlockAssociation"] = {
      AssociationId: assocId,
      CidrBlock: cidrBlock,
      CidrBlockState: { State: "associated", StatusMessage: "" },
    };
  } else {
    const ipv6 = ipv6CidrBlock ?? "::/0";
    (vpc.Ipv6CidrBlockAssociations ??= []).push({
      AssociationId: assocId,
      Ipv6CidrBlock: ipv6,
    });
    ctx.store.set(vpcKey(vpcId), vpc);
    result["Ipv6CidrBlockAssociation"] = {
      AssociationId: assocId,
      Ipv6CidrBlock: ipv6,
      Ipv6CidrBlockState: { State: "associated", StatusMessage: "" },
      NetworkBorderGroup: ctx.region,
    };
  }
  return result;
};

const AuthorizeClientVpnIngress: OperationHandler = (_input, _ctx) => {
  return { Status: { Code: "active", Message: "" } };
};

const AuthorizeSecurityGroupEgress: OperationHandler = (input, ctx) => {
  const group = findSecurityGroup(ctx, input);
  const permissions = ipPermissionList(input["IpPermissions"]);
  const created: StoredSecurityGroupRule[] = [];
  const addRule = (
    ipProtocol: string,
    fromPort: number | undefined,
    toPort: number | undefined,
    cidr: string | undefined,
  ): void => {
    const rule: StoredSecurityGroupRule = {
      SecurityGroupRuleId: hexId("sgr"),
      IsEgress: true,
      IpProtocol: ipProtocol,
      FromPort: fromPort,
      ToPort: toPort,
      CidrIpv4: cidr,
    };
    group.EgressRules.push(rule);
    created.push(rule);
  };
  if (permissions.length === 0) {
    const cidrIp =
      typeof input["CidrIp"] === "string" ? input["CidrIp"] : "0.0.0.0/0";
    const ipProtocol =
      typeof input["IpProtocol"] === "string" ? input["IpProtocol"] : "-1";
    addRule(
      ipProtocol,
      integerOf(input["FromPort"]),
      integerOf(input["ToPort"]),
      cidrIp,
    );
  } else {
    for (const permission of permissions) {
      const ipProtocol =
        typeof permission["IpProtocol"] === "string"
          ? permission["IpProtocol"]
          : "-1";
      const fromPort = integerOf(permission["FromPort"]);
      const toPort = integerOf(permission["ToPort"]);
      const cidrs = cidrsOfPermission(permission);
      if (cidrs.length === 0) addRule(ipProtocol, fromPort, toPort, undefined);
      else
        for (const cidr of cidrs) addRule(ipProtocol, fromPort, toPort, cidr);
    }
  }
  ctx.store.set(sgKey(group.GroupId), group);
  return {
    Return: true,
    SecurityGroupRules: created.map((rule) =>
      securityGroupRuleView(rule, group, ctx.account),
    ),
  };
};

const BundleInstance: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const bundleId = hexId("bun");
  const now = new Date().toISOString();
  const task: StoredBundleTask = {
    BundleId: bundleId,
    InstanceId: instanceId,
    State: "bundling",
    StartTime: now,
    UpdateTime: now,
    Progress: "0%",
  };
  ctx.store.set(bundleTaskKey(bundleId), task);
  return {
    BundleTask: {
      InstanceId: task.InstanceId,
      BundleId: task.BundleId,
      State: task.State,
      StartTime: task.StartTime,
      UpdateTime: task.UpdateTime,
      Progress: task.Progress,
      Storage: input["Storage"] ?? {},
    },
  };
};

const CancelBundleTask: OperationHandler = (input, ctx) => {
  const bundleId =
    typeof input["BundleId"] === "string" ? input["BundleId"] : "";
  const task = ctx.store.get<StoredBundleTask>(bundleTaskKey(bundleId));
  if (task === undefined) {
    throw awsError(
      "InvalidBundleTaskId.NotFound",
      `The bundle task '${bundleId}' does not exist`,
      400,
    );
  }
  task.State = "cancelling";
  task.UpdateTime = new Date().toISOString();
  ctx.store.set(bundleTaskKey(bundleId), task);
  return {
    BundleTask: {
      InstanceId: task.InstanceId,
      BundleId: task.BundleId,
      State: task.State,
      StartTime: task.StartTime,
      UpdateTime: task.UpdateTime,
      Progress: task.Progress,
      Storage: {},
    },
  };
};

const CancelCapacityReservation: OperationHandler = (input, ctx) => {
  const reservationId =
    typeof input["CapacityReservationId"] === "string"
      ? input["CapacityReservationId"]
      : "";
  const reservation = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(reservationId),
  );
  if (reservation === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation '${reservationId}' does not exist`,
      400,
    );
  }
  reservation.State = "cancelled";
  ctx.store.set(capacityReservationKey(reservationId), reservation);
  return { Return: true };
};

const CancelCapacityReservationFleets: OperationHandler = (input, _ctx) => {
  const fleetIds = stringList(input["CapacityReservationFleetIds"]);
  return {
    SuccessfulFleetCancellations: fleetIds.map((id) => ({
      CurrentFleetState: "cancelled_running",
      PreviousFleetState: "active",
      CapacityReservationFleetId: id,
    })),
    FailedFleetCancellations: [],
  };
};

const CancelConversionTask: OperationHandler = (_input, _ctx) => {
  return {};
};

const CancelDeclarativePoliciesReport: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const CancelExportTask: OperationHandler = (_input, _ctx) => {
  return {};
};

const CancelImageLaunchPermission: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const CancelImportTask: OperationHandler = (input, _ctx) => {
  const id =
    typeof input["ImportTaskId"] === "string"
      ? input["ImportTaskId"]
      : hexId("import");
  return {
    ImportTaskId: id,
    PreviousState: "active",
    State: "cancelled",
  };
};

const CancelReservedInstancesListing: OperationHandler = (input, _ctx) => {
  const listingId =
    typeof input["ReservedInstancesListingId"] === "string"
      ? input["ReservedInstancesListingId"]
      : "";
  return {
    ReservedInstancesListings: [
      {
        ReservedInstancesListingId: listingId,
        Status: "cancelled",
        StatusMessage: "The listing was cancelled.",
        CreateDate: new Date().toISOString(),
        UpdateDate: new Date().toISOString(),
        PriceSchedules: [],
        InstanceCounts: [],
        Tags: [],
      },
    ],
  };
};

const CancelSpotFleetRequests: OperationHandler = (input, _ctx) => {
  const ids = stringList(input["SpotFleetRequestIds"]);
  return {
    SuccessfulFleetRequests: ids.map((id) => ({
      SpotFleetRequestId: id,
      CurrentSpotFleetRequestState: "cancelled_running",
      PreviousSpotFleetRequestState: "active",
    })),
    UnsuccessfulFleetRequests: [],
  };
};

const CancelSpotInstanceRequests: OperationHandler = (input, _ctx) => {
  const ids = stringList(input["SpotInstanceRequestIds"]);
  return {
    CancelledSpotInstanceRequests: ids.map((id) => ({
      SpotInstanceRequestId: id,
      State: "cancelled",
    })),
  };
};

const ConfirmProductInstance: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return { Return: true, OwnerId: ctx.account };
};

const CopyFpgaImage: OperationHandler = (_input, _ctx) => {
  return { FpgaImageId: hexId("afi") };
};

const CopyImage: OperationHandler = (_input, _ctx) => {
  return { ImageId: hexId("ami") };
};

const CopySnapshot: OperationHandler = (input, ctx) => {
  const sourceId =
    typeof input["SourceSnapshotId"] === "string"
      ? input["SourceSnapshotId"]
      : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const source = ctx.store.get<StoredSnapshot>(snapshotKey(sourceId));
  const id = hexId("snap");
  const snapshot: StoredSnapshot = {
    SnapshotId: id,
    VolumeId: source?.VolumeId ?? "vol-unknown",
    VolumeSize: source?.VolumeSize ?? 8,
    State: "completed",
    Progress: "100%",
    StartTime: new Date().toISOString(),
    Description: description || source?.Description || "",
    Encrypted: source?.Encrypted ?? false,
    OwnerId: ctx.account,
    Tags: [],
  };
  ctx.store.set(snapshotKey(id), snapshot);
  return { SnapshotId: id, Tags: [] };
};

const CopyVolumes: OperationHandler = (input, ctx) => {
  const sourceVolumeId =
    typeof input["SourceVolumeId"] === "string" ? input["SourceVolumeId"] : "";
  const source = ctx.store.get<StoredVolume>(volumeKey(sourceVolumeId));
  const id = hexId("vol");
  const volume: StoredVolume = {
    VolumeId: id,
    Size: source?.Size ?? 8,
    VolumeType: source?.VolumeType ?? "gp3",
    AvailabilityZone: source?.AvailabilityZone ?? `${ctx.region}a`,
    State: "available",
    SnapshotId: source?.SnapshotId ?? "",
    Iops: source?.Iops ?? 3000,
    Encrypted: source?.Encrypted ?? false,
    CreateTime: new Date().toISOString(),
    Tags: [],
    Attachments: [],
  };
  ctx.store.set(volumeKey(id), volume);
  return { Volumes: [volumeView(volume)] };
};

const CreateDelegateMacVolumeOwnershipTask: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const id = hexId("mac-task");
  const task: StoredMacModificationTask = {
    InstanceId: instanceId,
    MacModificationTaskId: id,
    TaskState: "successful",
    TaskType: "volume-ownership-delegation",
    StartTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(macTaskKey(id), task);
  return {
    MacModificationTask: {
      InstanceId: task.InstanceId,
      MacModificationTaskId: task.MacModificationTaskId,
      TaskState: task.TaskState,
      TaskType: task.TaskType,
      StartTime: task.StartTime,
      Tags: task.Tags,
    },
  };
};

const CreateDhcpOptions: OperationHandler = (input, ctx) => {
  const rawConfigs = Array.isArray(input["DhcpConfigurations"])
    ? (input["DhcpConfigurations"] as Record<string, unknown>[])
    : [];
  const dhcpConfigurations = rawConfigs.map((c) => ({
    Key: typeof c["Key"] === "string" ? c["Key"] : "",
    Values: stringList(c["Values"]),
  }));
  const id = hexId("dopt");
  const dhcpOptions: StoredDhcpOptions = {
    DhcpOptionsId: id,
    OwnerId: ctx.account,
    DhcpConfigurations: dhcpConfigurations,
    Tags: [],
  };
  ctx.store.set(dhcpOptionsKey(id), dhcpOptions);
  return {
    DhcpOptions: {
      DhcpOptionsId: dhcpOptions.DhcpOptionsId,
      OwnerId: dhcpOptions.OwnerId,
      DhcpConfigurations: dhcpOptions.DhcpConfigurations.map((c) => ({
        Key: c.Key,
        Values: c.Values.map((v) => ({ Value: v })),
      })),
      Tags: dhcpOptions.Tags,
    },
  };
};

const CreateEgressOnlyInternetGateway: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : "";
  const id = hexId("eigw");
  const gateway: StoredEgressOnlyInternetGateway = {
    EgressOnlyInternetGatewayId: id,
    Attachments: vpcId ? [{ State: "attached", VpcId: vpcId }] : [],
    Tags: [],
  };
  ctx.store.set(egressOnlyIgwKey(id), gateway);
  return {
    ClientToken: clientToken,
    EgressOnlyInternetGateway: {
      EgressOnlyInternetGatewayId: gateway.EgressOnlyInternetGatewayId,
      Attachments: gateway.Attachments,
      Tags: gateway.Tags,
    },
  };
};

const CreateFleet: OperationHandler = (input, ctx) => {
  const id = hexId("fleet");
  const fleet: StoredFleet = {
    FleetId: id,
    FleetState: "active",
    CreateTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(fleetKey(id), fleet);
  return { FleetId: id, Errors: [], Instances: [] };
};

const CreateFlowLogs: OperationHandler = (input, ctx) => {
  const resourceIds = stringList(input["ResourceIds"]);
  const trafficType =
    typeof input["TrafficType"] === "string" ? input["TrafficType"] : "ALL";
  const logGroupName =
    typeof input["LogGroupName"] === "string" ? input["LogGroupName"] : "";
  const logDestination =
    typeof input["LogDestination"] === "string"
      ? input["LogDestination"]
      : logGroupName;
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : "";
  const flowLogIds: string[] = [];
  for (const resourceId of resourceIds.length > 0 ? resourceIds : [""]) {
    const id = hexId("fl");
    const flowLog: StoredFlowLog = {
      FlowLogId: id,
      ResourceId: resourceId,
      TrafficType: trafficType,
      LogGroupName: logGroupName,
      LogDestination: logDestination,
      FlowLogStatus: "ACTIVE",
      CreationTime: new Date().toISOString(),
      Tags: [],
    };
    ctx.store.set(flowLogKey(id), flowLog);
    flowLogIds.push(id);
  }
  return { ClientToken: clientToken, FlowLogIds: flowLogIds, Unsuccessful: [] };
};

const CreateFpgaImage: OperationHandler = (input, ctx) => {
  const name = typeof input["Name"] === "string" ? input["Name"] : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("afi");
  const globalId = hexId("agfi");
  const image: StoredFpgaImage = {
    FpgaImageId: id,
    FpgaImageGlobalId: globalId,
    Name: name,
    Description: description,
    State: "available",
    OwnerId: ctx.account,
    CreateTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(fpgaImageKey(id), image);
  return { FpgaImageId: id, FpgaImageGlobalId: globalId };
};

const CreateImage: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const name = typeof input["Name"] === "string" ? input["Name"] : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("ami");
  const image: StoredImage = {
    ImageId: id,
    Name: name,
    Description: description,
    InstanceId: instanceId,
    State: "available",
    OwnerId: ctx.account,
    CreationDate: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(imageKey(id), image);
  return { ImageId: id };
};

const CreateImageUsageReport: OperationHandler = (_input, _ctx) => {
  const reportId = hexId("iur");
  return { ReportId: reportId };
};

const CreateInstanceConnectEndpoint: OperationHandler = (input, ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(subnetId));
  const vpcId = subnet?.VpcId ?? "";
  const preserveClientIp = input["PreserveClientIp"] !== false;
  const securityGroupIds = stringList(input["SecurityGroupIds"]);
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : "";
  const id = hexId("eice");
  const endpoint: StoredInstanceConnectEndpoint = {
    InstanceConnectEndpointId: id,
    InstanceConnectEndpointArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:instance-connect-endpoint/${id}`,
    OwnerId: ctx.account,
    State: "create-complete",
    SubnetId: subnetId,
    VpcId: vpcId,
    PreserveClientIp: preserveClientIp,
    SecurityGroupIds: securityGroupIds,
    CreatedAt: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(instanceConnectEndpointKey(id), endpoint);
  return {
    InstanceConnectEndpoint: {
      OwnerId: endpoint.OwnerId,
      InstanceConnectEndpointId: endpoint.InstanceConnectEndpointId,
      InstanceConnectEndpointArn: endpoint.InstanceConnectEndpointArn,
      State: endpoint.State,
      SubnetId: endpoint.SubnetId,
      VpcId: endpoint.VpcId,
      PreserveClientIp: endpoint.PreserveClientIp,
      SecurityGroupIds: endpoint.SecurityGroupIds,
      CreatedAt: endpoint.CreatedAt,
      Tags: endpoint.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateInstanceEventWindow: OperationHandler = (input, ctx) => {
  const name = typeof input["Name"] === "string" ? input["Name"] : "";
  const cronExpression =
    typeof input["CronExpression"] === "string"
      ? input["CronExpression"]
      : undefined;
  const rawRanges = Array.isArray(input["TimeRanges"])
    ? (input["TimeRanges"] as Record<string, unknown>[])
    : [];
  const timeRanges = rawRanges.map((r) => ({
    StartWeekDay:
      typeof r["StartWeekDay"] === "string" ? r["StartWeekDay"] : "sunday",
    StartHour: typeof r["StartHour"] === "number" ? r["StartHour"] : 0,
    EndWeekDay:
      typeof r["EndWeekDay"] === "string" ? r["EndWeekDay"] : "sunday",
    EndHour: typeof r["EndHour"] === "number" ? r["EndHour"] : 0,
  }));
  const id = hexId("iew");
  const eventWindow: StoredInstanceEventWindow = {
    InstanceEventWindowId: id,
    Name: name,
    CronExpression: cronExpression,
    TimeRanges: timeRanges,
    State: "active",
    Tags: [],
  };
  ctx.store.set(instanceEventWindowKey(id), eventWindow);
  return {
    InstanceEventWindow: {
      InstanceEventWindowId: eventWindow.InstanceEventWindowId,
      Name: eventWindow.Name,
      CronExpression: eventWindow.CronExpression,
      TimeRanges: eventWindow.TimeRanges,
      State: eventWindow.State,
      Tags: eventWindow.Tags,
    },
  };
};

const CreateInstanceExportTask: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const targetEnvironment =
    typeof input["TargetEnvironment"] === "string"
      ? input["TargetEnvironment"]
      : "vmware";
  const exportToS3 =
    typeof input["ExportToS3Task"] === "object" &&
    input["ExportToS3Task"] !== null
      ? (input["ExportToS3Task"] as Record<string, unknown>)
      : {};
  const s3Bucket =
    typeof exportToS3["S3Bucket"] === "string" ? exportToS3["S3Bucket"] : "";
  const s3Key =
    typeof exportToS3["S3Key"] === "string" ? exportToS3["S3Key"] : "";
  const diskImageFormat =
    typeof exportToS3["DiskImageFormat"] === "string"
      ? exportToS3["DiskImageFormat"]
      : "VMDK";
  const id = hexId("export");
  const task: StoredExportTask = {
    ExportTaskId: id,
    Description: description,
    InstanceId: instanceId,
    TargetEnvironment: targetEnvironment,
    State: "active",
    StatusMessage: "",
    S3Bucket: s3Bucket,
    S3Key: s3Key,
    Tags: [],
  };
  ctx.store.set(exportTaskKey(id), task);
  return {
    ExportTask: {
      ExportTaskId: task.ExportTaskId,
      Description: task.Description,
      State: task.State,
      StatusMessage: task.StatusMessage,
      InstanceExportDetails: {
        InstanceId: task.InstanceId,
        TargetEnvironment: task.TargetEnvironment,
      },
      ExportToS3Task: {
        DiskImageFormat: diskImageFormat,
        S3Bucket: task.S3Bucket,
        S3Key: task.S3Key,
      },
      Tags: task.Tags,
    },
  };
};

const CreateInterruptibleCapacityReservationAllocation: OperationHandler = (
  input,
  ctx,
) => {
  const sourceId =
    typeof input["CapacityReservationId"] === "string"
      ? input["CapacityReservationId"]
      : "";
  const instanceCount =
    typeof input["InstanceCount"] === "number" ? input["InstanceCount"] : 1;
  const source = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(sourceId),
  );
  if (source === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation ID '${sourceId}' does not exist`,
      400,
    );
  }
  return {
    SourceCapacityReservationId: sourceId,
    TargetInstanceCount: instanceCount,
    Status: "active",
    InterruptionType: "none",
  };
};

const CreatePlacementGroup: OperationHandler = (input, ctx) => {
  const groupName =
    typeof input["GroupName"] === "string" ? input["GroupName"] : "";
  const strategy =
    typeof input["Strategy"] === "string" ? input["Strategy"] : "cluster";
  const partitionCount =
    typeof input["PartitionCount"] === "number"
      ? input["PartitionCount"]
      : undefined;
  const spreadLevel =
    typeof input["SpreadLevel"] === "string" ? input["SpreadLevel"] : undefined;
  const id = hexId("pg");
  const group: StoredPlacementGroup = {
    GroupId: id,
    GroupName: groupName,
    State: "available",
    Strategy: strategy,
    PartitionCount: partitionCount,
    SpreadLevel: spreadLevel,
    Tags: [],
  };
  ctx.store.set(placementGroupKey(id), group);
  return {
    PlacementGroup: {
      GroupId: group.GroupId,
      GroupName: group.GroupName,
      State: group.State,
      Strategy: group.Strategy,
      PartitionCount: group.PartitionCount,
      SpreadLevel: group.SpreadLevel,
      GroupArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:placement-group/${group.GroupName}`,
      Tags: group.Tags,
    },
  };
};

const CreatePublicIpv4Pool: OperationHandler = (input, ctx) => {
  const networkBorderGroup =
    typeof input["NetworkBorderGroup"] === "string"
      ? input["NetworkBorderGroup"]
      : undefined;
  const id = hexId("ipv4pool-ec2");
  const pool: StoredPublicIpv4Pool = {
    PoolId: id,
    NetworkBorderGroup: networkBorderGroup,
    Tags: [],
  };
  ctx.store.set(publicIpv4PoolKey(id), pool);
  return { PoolId: pool.PoolId };
};

const CreateReplaceRootVolumeTask: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const snapshotId =
    typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : undefined;
  const imageId =
    typeof input["ImageId"] === "string" ? input["ImageId"] : undefined;
  const deleteReplacedRootVolume = input["DeleteReplacedRootVolume"] === true;
  const id = hexId("replacevol");
  const task: StoredReplaceRootVolumeTask = {
    ReplaceRootVolumeTaskId: id,
    InstanceId: instanceId,
    TaskState: "pending",
    StartTime: new Date().toISOString(),
    Tags: [],
    ImageId: imageId,
    SnapshotId: snapshotId,
    DeleteReplacedRootVolume: deleteReplacedRootVolume,
  };
  ctx.store.set(replaceRootVolumeTaskKey(id), task);
  return {
    ReplaceRootVolumeTask: {
      ReplaceRootVolumeTaskId: task.ReplaceRootVolumeTaskId,
      InstanceId: task.InstanceId,
      TaskState: task.TaskState,
      StartTime: task.StartTime,
      Tags: task.Tags,
      ImageId: task.ImageId,
      SnapshotId: task.SnapshotId,
      DeleteReplacedRootVolume: task.DeleteReplacedRootVolume,
    },
  };
};

const CreateReservedInstancesListing: OperationHandler = (input, ctx) => {
  const reservedInstancesId =
    typeof input["ReservedInstancesId"] === "string"
      ? input["ReservedInstancesId"]
      : "";
  const clientToken =
    typeof input["ClientToken"] === "string"
      ? input["ClientToken"]
      : hexId("ct");
  const id = hexId("rsl");
  const now = new Date().toISOString();
  const listing: StoredReservedInstancesListing = {
    ReservedInstancesListingId: id,
    ReservedInstancesId: reservedInstancesId,
    ClientToken: clientToken,
    CreateDate: now,
    UpdateDate: now,
    Status: "active",
    StatusMessage: "",
    Tags: [],
  };
  ctx.store.set(reservedInstancesListingKey(id), listing);
  return {
    ReservedInstancesListings: [
      {
        ReservedInstancesListingId: listing.ReservedInstancesListingId,
        ReservedInstancesId: listing.ReservedInstancesId,
        ClientToken: listing.ClientToken,
        CreateDate: listing.CreateDate,
        UpdateDate: listing.UpdateDate,
        Status: listing.Status,
        StatusMessage: listing.StatusMessage,
        InstanceCounts: [],
        PriceSchedules: [],
        Tags: listing.Tags,
      },
    ],
  };
};

const CreateRestoreImageTask: OperationHandler = (input, _ctx) => {
  const bucket = typeof input["Bucket"] === "string" ? input["Bucket"] : "";
  const objectKey =
    typeof input["ObjectKey"] === "string" ? input["ObjectKey"] : "";
  void bucket;
  void objectKey;
  const id = hexId("ami");
  return { ImageId: id };
};

const CreateRoute: OperationHandler = (input, ctx) => {
  const routeTableId =
    typeof input["RouteTableId"] === "string" ? input["RouteTableId"] : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : undefined;
  const destinationIpv6CidrBlock =
    typeof input["DestinationIpv6CidrBlock"] === "string"
      ? input["DestinationIpv6CidrBlock"]
      : undefined;
  const gatewayId =
    typeof input["GatewayId"] === "string" ? input["GatewayId"] : "local";
  const table = ctx.store.get<StoredRouteTable>(routeTableKey(routeTableId));
  if (table === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The route table ID '${routeTableId}' does not exist`,
      400,
    );
  }
  const dest = destinationCidrBlock ?? destinationIpv6CidrBlock ?? "";
  table.Routes.push({
    DestinationCidrBlock: dest,
    GatewayId: gatewayId,
    Origin: "CreateRoute",
    State: "active",
  });
  ctx.store.set(routeTableKey(routeTableId), table);
  return { Return: true };
};

const CreateRouteServer: OperationHandler = (input, ctx) => {
  const amazonSideAsn =
    typeof input["AmazonSideAsn"] === "number" ? input["AmazonSideAsn"] : 64512;
  const persistRoutes =
    typeof input["PersistRoutes"] === "string"
      ? input["PersistRoutes"]
      : "disable";
  const persistRoutesDuration =
    typeof input["PersistRoutesDuration"] === "number"
      ? input["PersistRoutesDuration"]
      : undefined;
  const snsNotificationsEnabled = input["SnsNotificationsEnabled"] === true;
  const id = hexId("rs");
  const server: StoredRouteServer = {
    RouteServerId: id,
    AmazonSideAsn: amazonSideAsn,
    State: "pending",
    PersistRoutesState: persistRoutes === "enable" ? "enabled" : "disabled",
    PersistRoutesDuration: persistRoutesDuration,
    SnsNotificationsEnabled: snsNotificationsEnabled,
    Tags: [],
  };
  ctx.store.set(routeServerKey(id), server);
  return {
    RouteServer: {
      RouteServerId: server.RouteServerId,
      AmazonSideAsn: server.AmazonSideAsn,
      State: server.State,
      PersistRoutesState: server.PersistRoutesState,
      PersistRoutesDuration: server.PersistRoutesDuration,
      SnsNotificationsEnabled: server.SnsNotificationsEnabled,
      Tags: server.Tags,
    },
  };
};

const CreateRouteServerEndpoint: OperationHandler = (input, ctx) => {
  const routeServerId =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const server = ctx.store.get<StoredRouteServer>(
    routeServerKey(routeServerId),
  );
  if (server === undefined) {
    throw awsError(
      "InvalidRouteServerId.NotFound",
      `The route server ID '${routeServerId}' does not exist`,
      400,
    );
  }
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(subnetId));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSubnetID.NotFound",
      `The subnet ID '${subnetId}' does not exist`,
      400,
    );
  }
  const id = hexId("rse");
  const eniId = hexId("eni");
  const endpoint: StoredRouteServerEndpoint = {
    RouteServerEndpointId: id,
    RouteServerId: routeServerId,
    VpcId: subnet.VpcId,
    SubnetId: subnetId,
    EniId: eniId,
    EniAddress: randomIpv4(),
    State: "pending",
    Tags: [],
  };
  ctx.store.set(routeServerEndpointKey(id), endpoint);
  return {
    RouteServerEndpoint: {
      RouteServerEndpointId: endpoint.RouteServerEndpointId,
      RouteServerId: endpoint.RouteServerId,
      VpcId: endpoint.VpcId,
      SubnetId: endpoint.SubnetId,
      EniId: endpoint.EniId,
      EniAddress: endpoint.EniAddress,
      State: endpoint.State,
      Tags: endpoint.Tags,
    },
  };
};

const CreateRouteServerPeer: OperationHandler = (input, ctx) => {
  const routeServerEndpointId =
    typeof input["RouteServerEndpointId"] === "string"
      ? input["RouteServerEndpointId"]
      : "";
  const peerAddress =
    typeof input["PeerAddress"] === "string" ? input["PeerAddress"] : "";
  const bgpOptions =
    typeof input["BgpOptions"] === "object" && input["BgpOptions"] !== null
      ? (input["BgpOptions"] as Record<string, unknown>)
      : {};
  const peerAsn =
    typeof bgpOptions["PeerAsn"] === "number" ? bgpOptions["PeerAsn"] : 65000;
  const peerLivenessDetection =
    typeof bgpOptions["PeerLivenessDetection"] === "string"
      ? bgpOptions["PeerLivenessDetection"]
      : "bgp-keepalive";
  const endpoint = ctx.store.get<StoredRouteServerEndpoint>(
    routeServerEndpointKey(routeServerEndpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidRouteServerEndpointId.NotFound",
      `The route server endpoint ID '${routeServerEndpointId}' does not exist`,
      400,
    );
  }
  const id = hexId("rsp");
  const peer: StoredRouteServerPeer = {
    RouteServerPeerId: id,
    RouteServerEndpointId: routeServerEndpointId,
    RouteServerId: endpoint.RouteServerId,
    VpcId: endpoint.VpcId,
    SubnetId: endpoint.SubnetId,
    PeerAddress: peerAddress,
    PeerAsn: peerAsn,
    PeerLivenessDetection: peerLivenessDetection,
    State: "pending",
    EndpointEniId: endpoint.EniId,
    EndpointEniAddress: endpoint.EniAddress,
    Tags: [],
  };
  ctx.store.set(routeServerPeerKey(id), peer);
  return {
    RouteServerPeer: {
      RouteServerPeerId: peer.RouteServerPeerId,
      RouteServerEndpointId: peer.RouteServerEndpointId,
      RouteServerId: peer.RouteServerId,
      VpcId: peer.VpcId,
      SubnetId: peer.SubnetId,
      State: peer.State,
      PeerAddress: peer.PeerAddress,
      EndpointEniId: peer.EndpointEniId,
      EndpointEniAddress: peer.EndpointEniAddress,
      BgpOptions: {
        PeerAsn: peer.PeerAsn,
        PeerLivenessDetection: peer.PeerLivenessDetection,
      },
      Tags: peer.Tags,
    },
  };
};

const CreateSecondaryNetwork: OperationHandler = (input, ctx) => {
  const ipv4CidrBlock =
    typeof input["Ipv4CidrBlock"] === "string" ? input["Ipv4CidrBlock"] : "";
  const networkType =
    typeof input["NetworkType"] === "string" ? input["NetworkType"] : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const id = hexId("snet");
  const network: StoredSecondaryNetwork = {
    SecondaryNetworkId: id,
    Ipv4CidrBlock: ipv4CidrBlock,
    NetworkType: networkType,
    State: "available",
    Tags: [],
  };
  ctx.store.set(secondaryNetworkKey(id), network);
  return {
    SecondaryNetwork: {
      SecondaryNetworkId: network.SecondaryNetworkId,
      SecondaryNetworkArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:secondary-network/${network.SecondaryNetworkId}`,
      OwnerId: ctx.account,
      Type: network.NetworkType,
      State: network.State,
      Ipv4CidrBlockAssociations: [
        {
          AssociationId: hexId("secondary-network-cidr-assoc"),
          Ipv4CidrBlock: network.Ipv4CidrBlock,
          Ipv4CidrBlockState: { State: "associated" },
        },
      ],
      Tags: network.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateSecondarySubnet: OperationHandler = (input, ctx) => {
  const secondaryNetworkId =
    typeof input["SecondaryNetworkId"] === "string"
      ? input["SecondaryNetworkId"]
      : "";
  const ipv4CidrBlock =
    typeof input["Ipv4CidrBlock"] === "string" ? input["Ipv4CidrBlock"] : "";
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const network = ctx.store.get<StoredSecondaryNetwork>(
    secondaryNetworkKey(secondaryNetworkId),
  );
  if (network === undefined) {
    throw awsError(
      "InvalidSecondaryNetworkId.NotFound",
      `The secondary network ID '${secondaryNetworkId}' does not exist`,
      400,
    );
  }
  const id = hexId("ssub");
  const subnet: StoredSecondarySubnet = {
    SecondarySubnetId: id,
    SecondaryNetworkId: secondaryNetworkId,
    Ipv4CidrBlock: ipv4CidrBlock,
    AvailabilityZone: availabilityZone,
    State: "available",
    Tags: [],
  };
  ctx.store.set(secondarySubnetKey(id), subnet);
  return {
    SecondarySubnet: {
      SecondarySubnetId: subnet.SecondarySubnetId,
      SecondarySubnetArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:secondary-subnet/${subnet.SecondarySubnetId}`,
      SecondaryNetworkId: subnet.SecondaryNetworkId,
      SecondaryNetworkType: network.NetworkType,
      OwnerId: ctx.account,
      AvailabilityZone: subnet.AvailabilityZone,
      State: subnet.State,
      Ipv4CidrBlockAssociations: [
        {
          AssociationId: hexId("secondary-subnet-cidr-assoc"),
          Ipv4CidrBlock: subnet.Ipv4CidrBlock,
          Ipv4CidrBlockState: { State: "associated" },
        },
      ],
      Tags: subnet.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateSnapshots: OperationHandler = (input, ctx) => {
  const spec =
    typeof input["InstanceSpecification"] === "object" &&
    input["InstanceSpecification"] !== null
      ? (input["InstanceSpecification"] as Record<string, unknown>)
      : {};
  const instanceId =
    typeof spec["InstanceId"] === "string" ? spec["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist.`,
      400,
    );
  }
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const volumes = ctx.store
    .list<StoredVolume>()
    .filter((e) => e.key.startsWith("volume/"))
    .map((e) => e.value);
  const instanceVolumes = volumes.filter(
    (v) =>
      v.Attachments.length > 0 &&
      v.Attachments.some((a) => a.InstanceId === instanceId),
  );
  const excludeBootVolume =
    typeof spec["ExcludeBootVolume"] === "boolean"
      ? spec["ExcludeBootVolume"]
      : false;
  const excludeDataVolumeIds = Array.isArray(spec["ExcludeDataVolumeIds"])
    ? (spec["ExcludeDataVolumeIds"] as string[])
    : [];
  const snapshots = instanceVolumes
    .filter((v) => {
      if (excludeDataVolumeIds.includes(v.VolumeId)) return false;
      if (
        excludeBootVolume &&
        v.Attachments.some(
          (a) => a.Device === "/dev/xvda" || a.Device === "/dev/sda1",
        )
      )
        return false;
      return true;
    })
    .map((v) => {
      const id = hexId("snap");
      const snapshot: StoredSnapshot = {
        SnapshotId: id,
        VolumeId: v.VolumeId,
        VolumeSize: v.Size,
        State: "completed",
        Progress: "100%",
        StartTime: new Date().toISOString(),
        Description: description,
        Encrypted: v.Encrypted,
        OwnerId: ctx.account,
        Tags: [],
      };
      ctx.store.set(snapshotKey(id), snapshot);
      return snapshotView(snapshot);
    });
  return { Snapshots: snapshots };
};

const CreateSpotDatafeedSubscription: OperationHandler = (input, ctx) => {
  const bucket = typeof input["Bucket"] === "string" ? input["Bucket"] : "";
  const prefix = typeof input["Prefix"] === "string" ? input["Prefix"] : "";
  const subscription: StoredSpotDatafeedSubscription = {
    OwnerId: ctx.account,
    Bucket: bucket,
    Prefix: prefix,
    State: "Active",
  };
  ctx.store.set(spotDatafeedKey(), subscription);
  return {
    SpotDatafeedSubscription: {
      Bucket: subscription.Bucket,
      OwnerId: subscription.OwnerId,
      Prefix: subscription.Prefix,
      State: subscription.State,
    },
  };
};

const CreateStoreImageTask: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const bucket = typeof input["Bucket"] === "string" ? input["Bucket"] : "";
  const objectKey = `${imageId}/image.bin`;
  const task: StoredStoreImageTask = {
    ImageId: imageId,
    ObjectKey: objectKey,
    Bucket: bucket,
  };
  ctx.store.set(storeImageTaskKey(imageId), task);
  return { ObjectKey: objectKey };
};

const CreateSubnetCidrReservation: OperationHandler = (input, ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(subnetId));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSubnetID.NotFound",
      `The subnet ID '${subnetId}' does not exist`,
      400,
    );
  }
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  const reservationType =
    typeof input["ReservationType"] === "string"
      ? input["ReservationType"]
      : "prefix";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("scr");
  const reservation: StoredSubnetCidrReservation = {
    SubnetCidrReservationId: id,
    SubnetId: subnetId,
    Cidr: cidr,
    ReservationType: reservationType,
    OwnerId: ctx.account,
    Description: description,
    Tags: [],
  };
  ctx.store.set(subnetCidrReservationKey(id), reservation);
  return {
    SubnetCidrReservation: {
      SubnetCidrReservationId: reservation.SubnetCidrReservationId,
      SubnetId: reservation.SubnetId,
      Cidr: reservation.Cidr,
      ReservationType: reservation.ReservationType,
      OwnerId: reservation.OwnerId,
      Description: reservation.Description,
      Tags: reservation.Tags,
    },
  };
};

const CreateTrafficMirrorFilter: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const id = hexId("tmf");
  const filter: StoredTrafficMirrorFilter = {
    TrafficMirrorFilterId: id,
    IngressFilterRules: [],
    EgressFilterRules: [],
    NetworkServices: [],
    Description: description,
    Tags: [],
  };
  ctx.store.set(trafficMirrorFilterKey(id), filter);
  return {
    TrafficMirrorFilter: {
      TrafficMirrorFilterId: filter.TrafficMirrorFilterId,
      IngressFilterRules: filter.IngressFilterRules,
      EgressFilterRules: filter.EgressFilterRules,
      NetworkServices: filter.NetworkServices,
      Description: filter.Description,
      Tags: filter.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateTrafficMirrorFilterRule: OperationHandler = (input, ctx) => {
  const filterId =
    typeof input["TrafficMirrorFilterId"] === "string"
      ? input["TrafficMirrorFilterId"]
      : "";
  const filter = ctx.store.get<StoredTrafficMirrorFilter>(
    trafficMirrorFilterKey(filterId),
  );
  if (filter === undefined) {
    throw awsError(
      "InvalidTrafficMirrorFilterId.NotFound",
      `The Traffic Mirror filter ID '${filterId}' does not exist`,
      400,
    );
  }
  const trafficDirection =
    typeof input["TrafficDirection"] === "string"
      ? input["TrafficDirection"]
      : "ingress";
  const ruleNumber = integerOf(input["RuleNumber"]) ?? 100;
  const ruleAction =
    typeof input["RuleAction"] === "string" ? input["RuleAction"] : "accept";
  const protocol = integerOf(input["Protocol"]);
  const destCidr =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "0.0.0.0/0";
  const sourceCidr =
    typeof input["SourceCidrBlock"] === "string"
      ? input["SourceCidrBlock"]
      : "0.0.0.0/0";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const destPortRangeRaw =
    typeof input["DestinationPortRange"] === "object" &&
    input["DestinationPortRange"] !== null
      ? (input["DestinationPortRange"] as Record<string, unknown>)
      : null;
  const srcPortRangeRaw =
    typeof input["SourcePortRange"] === "object" &&
    input["SourcePortRange"] !== null
      ? (input["SourcePortRange"] as Record<string, unknown>)
      : null;
  const destPortRange = destPortRangeRaw
    ? {
        FromPort: integerOf(destPortRangeRaw["FromPort"]) ?? 0,
        ToPort: integerOf(destPortRangeRaw["ToPort"]) ?? 65535,
      }
    : undefined;
  const srcPortRange = srcPortRangeRaw
    ? {
        FromPort: integerOf(srcPortRangeRaw["FromPort"]) ?? 0,
        ToPort: integerOf(srcPortRangeRaw["ToPort"]) ?? 65535,
      }
    : undefined;
  const ruleId = hexId("tmfr");
  const rule: StoredTrafficMirrorFilterRule = {
    TrafficMirrorFilterRuleId: ruleId,
    TrafficMirrorFilterId: filterId,
    TrafficDirection: trafficDirection,
    RuleNumber: ruleNumber,
    RuleAction: ruleAction,
    Protocol: protocol,
    DestinationPortRange: destPortRange,
    SourcePortRange: srcPortRange,
    DestinationCidrBlock: destCidr,
    SourceCidrBlock: sourceCidr,
    Description: description,
    Tags: [],
  };
  ctx.store.set(trafficMirrorFilterRuleKey(ruleId), rule);
  if (trafficDirection === "egress") {
    filter.EgressFilterRules.push(rule);
  } else {
    filter.IngressFilterRules.push(rule);
  }
  ctx.store.set(trafficMirrorFilterKey(filterId), filter);
  return {
    TrafficMirrorFilterRule: {
      TrafficMirrorFilterRuleId: rule.TrafficMirrorFilterRuleId,
      TrafficMirrorFilterId: rule.TrafficMirrorFilterId,
      TrafficDirection: rule.TrafficDirection,
      RuleNumber: rule.RuleNumber,
      RuleAction: rule.RuleAction,
      Protocol: rule.Protocol,
      DestinationPortRange: rule.DestinationPortRange,
      SourcePortRange: rule.SourcePortRange,
      DestinationCidrBlock: rule.DestinationCidrBlock,
      SourceCidrBlock: rule.SourceCidrBlock,
      Description: rule.Description,
      Tags: rule.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateTrafficMirrorSession: OperationHandler = (input, ctx) => {
  const networkInterfaceId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const targetId =
    typeof input["TrafficMirrorTargetId"] === "string"
      ? input["TrafficMirrorTargetId"]
      : "";
  const filterId =
    typeof input["TrafficMirrorFilterId"] === "string"
      ? input["TrafficMirrorFilterId"]
      : "";
  const sessionNumber = integerOf(input["SessionNumber"]) ?? 1;
  const packetLength = integerOf(input["PacketLength"]);
  const virtualNetworkId = integerOf(input["VirtualNetworkId"]);
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const id = hexId("tms");
  const session: StoredTrafficMirrorSession = {
    TrafficMirrorSessionId: id,
    TrafficMirrorTargetId: targetId,
    TrafficMirrorFilterId: filterId,
    NetworkInterfaceId: networkInterfaceId,
    OwnerId: ctx.account,
    PacketLength: packetLength,
    SessionNumber: sessionNumber,
    VirtualNetworkId: virtualNetworkId,
    Description: description,
    Tags: [],
  };
  ctx.store.set(trafficMirrorSessionKey(id), session);
  return {
    TrafficMirrorSession: {
      TrafficMirrorSessionId: session.TrafficMirrorSessionId,
      TrafficMirrorTargetId: session.TrafficMirrorTargetId,
      TrafficMirrorFilterId: session.TrafficMirrorFilterId,
      NetworkInterfaceId: session.NetworkInterfaceId,
      OwnerId: session.OwnerId,
      PacketLength: session.PacketLength,
      SessionNumber: session.SessionNumber,
      VirtualNetworkId: session.VirtualNetworkId,
      Description: session.Description,
      Tags: session.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateTrafficMirrorTarget: OperationHandler = (input, ctx) => {
  const networkInterfaceId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : undefined;
  const networkLoadBalancerArn =
    typeof input["NetworkLoadBalancerArn"] === "string"
      ? input["NetworkLoadBalancerArn"]
      : undefined;
  const gatewayLoadBalancerEndpointId =
    typeof input["GatewayLoadBalancerEndpointId"] === "string"
      ? input["GatewayLoadBalancerEndpointId"]
      : undefined;
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const type = networkLoadBalancerArn
    ? "network-load-balancer"
    : gatewayLoadBalancerEndpointId
      ? "gateway-load-balancer-endpoint"
      : "network-interface";
  const id = hexId("tmt");
  const target: StoredTrafficMirrorTarget = {
    TrafficMirrorTargetId: id,
    NetworkInterfaceId: networkInterfaceId,
    NetworkLoadBalancerArn: networkLoadBalancerArn,
    Type: type,
    Description: description,
    OwnerId: ctx.account,
    GatewayLoadBalancerEndpointId: gatewayLoadBalancerEndpointId,
    Tags: [],
  };
  ctx.store.set(trafficMirrorTargetKey(id), target);
  return {
    TrafficMirrorTarget: {
      TrafficMirrorTargetId: target.TrafficMirrorTargetId,
      NetworkInterfaceId: target.NetworkInterfaceId,
      NetworkLoadBalancerArn: target.NetworkLoadBalancerArn,
      Type: target.Type,
      Description: target.Description,
      OwnerId: target.OwnerId,
      GatewayLoadBalancerEndpointId: target.GatewayLoadBalancerEndpointId,
      Tags: target.Tags,
    },
    ClientToken: clientToken,
  };
};

const CreateTransitGateway: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const options =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  const amazonSideAsn =
    typeof options["AmazonSideAsn"] === "number"
      ? options["AmazonSideAsn"]
      : 64512;
  const id = hexId("tgw");
  const rtbId = hexId("tgw-rtb");
  const gateway: StoredTransitGateway = {
    TransitGatewayId: id,
    TransitGatewayArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:transit-gateway/${id}`,
    State: "available",
    OwnerId: ctx.account,
    Description: description,
    CreationTime: new Date().toISOString(),
    Options: {
      AmazonSideAsn: amazonSideAsn,
      AutoAcceptSharedAttachments:
        typeof options["AutoAcceptSharedAttachments"] === "string"
          ? options["AutoAcceptSharedAttachments"]
          : "disable",
      DefaultRouteTableAssociation:
        typeof options["DefaultRouteTableAssociation"] === "string"
          ? options["DefaultRouteTableAssociation"]
          : "enable",
      AssociationDefaultRouteTableId: rtbId,
      DefaultRouteTablePropagation:
        typeof options["DefaultRouteTablePropagation"] === "string"
          ? options["DefaultRouteTablePropagation"]
          : "enable",
      PropagationDefaultRouteTableId: rtbId,
      VpnEcmpSupport:
        typeof options["VpnEcmpSupport"] === "string"
          ? options["VpnEcmpSupport"]
          : "enable",
      DnsSupport:
        typeof options["DnsSupport"] === "string"
          ? options["DnsSupport"]
          : "enable",
      MulticastSupport:
        typeof options["MulticastSupport"] === "string"
          ? options["MulticastSupport"]
          : "disable",
    },
    Tags: [],
  };
  ctx.store.set(transitGatewayKey(id), gateway);
  return {
    TransitGateway: {
      TransitGatewayId: gateway.TransitGatewayId,
      TransitGatewayArn: gateway.TransitGatewayArn,
      State: gateway.State,
      OwnerId: gateway.OwnerId,
      Description: gateway.Description,
      CreationTime: gateway.CreationTime,
      Options: gateway.Options,
      Tags: gateway.Tags,
    },
  };
};

const CreateTransitGatewayConnect: OperationHandler = (input, ctx) => {
  const transportAttachmentId =
    typeof input["TransportTransitGatewayAttachmentId"] === "string"
      ? input["TransportTransitGatewayAttachmentId"]
      : "";
  const opts =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  const protocol =
    typeof opts["Protocol"] === "string" ? opts["Protocol"] : "gre";
  const transportAttachment = ctx.store.get<StoredTgwAttachment>(
    tgwAttachmentKey(transportAttachmentId),
  );
  const transitGatewayId =
    transportAttachment?.TransitGatewayId ?? hexId("tgw");
  const id = hexId("tgw-attach");
  const connect: StoredTransitGatewayConnect = {
    TransitGatewayAttachmentId: id,
    TransportTransitGatewayAttachmentId: transportAttachmentId,
    TransitGatewayId: transitGatewayId,
    State: "available",
    CreationTime: new Date().toISOString(),
    Options: { Protocol: protocol },
    Tags: [],
  };
  ctx.store.set(transitGatewayConnectKey(id), connect);
  return {
    TransitGatewayConnect: {
      TransitGatewayAttachmentId: connect.TransitGatewayAttachmentId,
      TransportTransitGatewayAttachmentId:
        connect.TransportTransitGatewayAttachmentId,
      TransitGatewayId: connect.TransitGatewayId,
      State: connect.State,
      CreationTime: connect.CreationTime,
      Options: connect.Options,
      Tags: connect.Tags,
    },
  };
};

const CreateTransitGatewayConnectPeer: OperationHandler = (input, ctx) => {
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const transitGatewayAddress =
    typeof input["TransitGatewayAddress"] === "string"
      ? input["TransitGatewayAddress"]
      : "169.254.6.1";
  const peerAddress =
    typeof input["PeerAddress"] === "string" ? input["PeerAddress"] : "";
  const insideCidrBlocks = stringList(input["InsideCidrBlocks"]);
  const bgpOpts =
    typeof input["BgpOptions"] === "object" && input["BgpOptions"] !== null
      ? (input["BgpOptions"] as Record<string, unknown>)
      : {};
  const peerAsn =
    typeof bgpOpts["PeerAsn"] === "number" ? bgpOpts["PeerAsn"] : 65000;
  const id = hexId("tgw-connect-peer");
  const peer: StoredTransitGatewayConnectPeer = {
    TransitGatewayAttachmentId: attachmentId,
    TransitGatewayConnectPeerId: id,
    State: "available",
    CreationTime: new Date().toISOString(),
    ConnectPeerConfiguration: {
      TransitGatewayAddress: transitGatewayAddress,
      PeerAddress: peerAddress,
      InsideCidrBlocks: insideCidrBlocks,
      Protocol: "gre",
      BgpConfigurations: [
        {
          TransitGatewayAsn: 64512,
          PeerAsn: peerAsn as number,
          TransitGatewayAddress: transitGatewayAddress,
          PeerAddress: peerAddress,
          BgpStatus: "up",
        },
      ],
    },
    Tags: [],
  };
  ctx.store.set(transitGatewayConnectPeerKey(id), peer);
  return {
    TransitGatewayConnectPeer: {
      TransitGatewayAttachmentId: peer.TransitGatewayAttachmentId,
      TransitGatewayConnectPeerId: peer.TransitGatewayConnectPeerId,
      State: peer.State,
      CreationTime: peer.CreationTime,
      ConnectPeerConfiguration: peer.ConnectPeerConfiguration,
      Tags: peer.Tags,
    },
  };
};

const CreateTransitGatewayMeteringPolicy: OperationHandler = (input, ctx) => {
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredTransitGateway>(
    transitGatewayKey(transitGatewayId),
  );
  if (gateway === undefined) {
    throw awsError(
      "InvalidTransitGatewayID.NotFound",
      `The transit gateway ID '${transitGatewayId}' does not exist`,
      400,
    );
  }
  const middleboxAttachmentIds = stringList(input["MiddleboxAttachmentIds"]);
  const id = hexId("tgw-metering-policy");
  const policy: StoredTransitGatewayMeteringPolicy = {
    TransitGatewayMeteringPolicyId: id,
    TransitGatewayId: transitGatewayId,
    MiddleboxAttachmentIds: middleboxAttachmentIds,
    State: "available",
    UpdateEffectiveAt: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(transitGatewayMeteringPolicyKey(id), policy);
  return {
    TransitGatewayMeteringPolicy: {
      TransitGatewayMeteringPolicyId: policy.TransitGatewayMeteringPolicyId,
      TransitGatewayId: policy.TransitGatewayId,
      MiddleboxAttachmentIds: policy.MiddleboxAttachmentIds,
      State: policy.State,
      UpdateEffectiveAt: policy.UpdateEffectiveAt,
      Tags: policy.Tags,
    },
  };
};

const CreateTransitGatewayMeteringPolicyEntry: OperationHandler = (
  input,
  ctx,
) => {
  const policyId =
    typeof input["TransitGatewayMeteringPolicyId"] === "string"
      ? input["TransitGatewayMeteringPolicyId"]
      : "";
  const policy = ctx.store.get<StoredTransitGatewayMeteringPolicy>(
    transitGatewayMeteringPolicyKey(policyId),
  );
  if (policy === undefined) {
    throw awsError(
      "InvalidTransitGatewayMeteringPolicyID.NotFound",
      `The transit gateway metering policy ID '${policyId}' does not exist`,
      400,
    );
  }
  const ruleNumber =
    typeof input["PolicyRuleNumber"] === "number"
      ? String(input["PolicyRuleNumber"])
      : "1";
  const meteredAccount =
    typeof input["MeteredAccount"] === "string" ? input["MeteredAccount"] : "";
  const srcAttachId =
    typeof input["SourceTransitGatewayAttachmentId"] === "string"
      ? input["SourceTransitGatewayAttachmentId"]
      : "";
  const srcAttachType =
    typeof input["SourceTransitGatewayAttachmentType"] === "string"
      ? input["SourceTransitGatewayAttachmentType"]
      : "";
  const srcCidr =
    typeof input["SourceCidrBlock"] === "string"
      ? input["SourceCidrBlock"]
      : "";
  const srcPort =
    typeof input["SourcePortRange"] === "string"
      ? input["SourcePortRange"]
      : "";
  const dstAttachId =
    typeof input["DestinationTransitGatewayAttachmentId"] === "string"
      ? input["DestinationTransitGatewayAttachmentId"]
      : "";
  const dstAttachType =
    typeof input["DestinationTransitGatewayAttachmentType"] === "string"
      ? input["DestinationTransitGatewayAttachmentType"]
      : "";
  const dstCidr =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const dstPort =
    typeof input["DestinationPortRange"] === "string"
      ? input["DestinationPortRange"]
      : "";
  const protocol =
    typeof input["Protocol"] === "string" ? input["Protocol"] : "";
  const now = new Date().toISOString();
  const entry: StoredTransitGatewayMeteringPolicyEntry = {
    TransitGatewayMeteringPolicyId: policyId,
    PolicyRuleNumber: ruleNumber,
    MeteredAccount: meteredAccount,
    State: "available",
    UpdatedAt: now,
    UpdateEffectiveAt: now,
    MeteringPolicyRule: {
      SourceTransitGatewayAttachmentId: srcAttachId,
      SourceTransitGatewayAttachmentType: srcAttachType,
      SourceCidrBlock: srcCidr,
      SourcePortRange: srcPort,
      DestinationTransitGatewayAttachmentId: dstAttachId,
      DestinationTransitGatewayAttachmentType: dstAttachType,
      DestinationCidrBlock: dstCidr,
      DestinationPortRange: dstPort,
      Protocol: protocol,
    },
  };
  ctx.store.set(
    transitGatewayMeteringPolicyEntryKey(policyId, ruleNumber),
    entry,
  );
  return {
    TransitGatewayMeteringPolicyEntry: {
      PolicyRuleNumber: entry.PolicyRuleNumber,
      MeteredAccount: entry.MeteredAccount,
      State: entry.State,
      UpdatedAt: entry.UpdatedAt,
      UpdateEffectiveAt: entry.UpdateEffectiveAt,
      MeteringPolicyRule: entry.MeteringPolicyRule,
    },
  };
};

const CreateTransitGatewayMulticastDomain: OperationHandler = (input, ctx) => {
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const opts =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  const id = hexId("tgw-mcast");
  const domain: StoredTransitGatewayMulticastDomain = {
    TransitGatewayMulticastDomainId: id,
    TransitGatewayId: transitGatewayId,
    TransitGatewayMulticastDomainArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:transit-gateway-multicast-domain/${id}`,
    OwnerId: ctx.account,
    Options: {
      Igmpv2Support:
        typeof opts["Igmpv2Support"] === "string"
          ? opts["Igmpv2Support"]
          : "disable",
      StaticSourcesSupport:
        typeof opts["StaticSourcesSupport"] === "string"
          ? opts["StaticSourcesSupport"]
          : "disable",
      AutoAcceptSharedAssociations:
        typeof opts["AutoAcceptSharedAssociations"] === "string"
          ? opts["AutoAcceptSharedAssociations"]
          : "disable",
    },
    State: "available",
    CreationTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(transitGatewayMulticastDomainKey(id), domain);
  return {
    TransitGatewayMulticastDomain: {
      TransitGatewayMulticastDomainId: domain.TransitGatewayMulticastDomainId,
      TransitGatewayId: domain.TransitGatewayId,
      TransitGatewayMulticastDomainArn: domain.TransitGatewayMulticastDomainArn,
      OwnerId: domain.OwnerId,
      Options: domain.Options,
      State: domain.State,
      CreationTime: domain.CreationTime,
      Tags: domain.Tags,
    },
  };
};

const CreateTransitGatewayPeeringAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const peerTransitGatewayId =
    typeof input["PeerTransitGatewayId"] === "string"
      ? input["PeerTransitGatewayId"]
      : "";
  const peerAccountId =
    typeof input["PeerAccountId"] === "string" ? input["PeerAccountId"] : "";
  const peerRegion =
    typeof input["PeerRegion"] === "string" ? input["PeerRegion"] : "";
  const opts =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  const id = hexId("tgw-attach");
  const accepterId = hexId("tgw-attach");
  const attachment: StoredTransitGatewayPeeringAttachment = {
    TransitGatewayAttachmentId: id,
    AccepterTransitGatewayAttachmentId: accepterId,
    RequesterTgwInfo: {
      TransitGatewayId: transitGatewayId,
      OwnerId: ctx.account,
      Region: ctx.region,
    },
    AccepterTgwInfo: {
      TransitGatewayId: peerTransitGatewayId,
      OwnerId: peerAccountId,
      Region: peerRegion,
    },
    Options: {
      DynamicRouting:
        typeof opts["DynamicRouting"] === "string"
          ? opts["DynamicRouting"]
          : "disable",
    },
    Status: { Code: "initiating", Message: "" },
    State: "initiating",
    CreationTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(transitGatewayPeeringAttachmentKey(id), attachment);
  return {
    TransitGatewayPeeringAttachment: {
      TransitGatewayAttachmentId: attachment.TransitGatewayAttachmentId,
      AccepterTransitGatewayAttachmentId:
        attachment.AccepterTransitGatewayAttachmentId,
      RequesterTgwInfo: attachment.RequesterTgwInfo,
      AccepterTgwInfo: attachment.AccepterTgwInfo,
      Options: attachment.Options,
      Status: attachment.Status,
      State: attachment.State,
      CreationTime: attachment.CreationTime,
      Tags: attachment.Tags,
    },
  };
};

const CreateTransitGatewayPolicyTable: OperationHandler = (input, ctx) => {
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const id = hexId("tgw-pt");
  const table: StoredTransitGatewayPolicyTable = {
    TransitGatewayPolicyTableId: id,
    TransitGatewayId: transitGatewayId,
    State: "available",
    CreationTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(transitGatewayPolicyTableKey(id), table);
  return {
    TransitGatewayPolicyTable: {
      TransitGatewayPolicyTableId: table.TransitGatewayPolicyTableId,
      TransitGatewayId: table.TransitGatewayId,
      State: table.State,
      CreationTime: table.CreationTime,
      Tags: table.Tags,
    },
  };
};

const CreateTransitGatewayPrefixListReference: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const prefixListId =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const blackhole =
    typeof input["Blackhole"] === "boolean" ? input["Blackhole"] : false;
  const ref: StoredTransitGatewayPrefixListReference = {
    TransitGatewayRouteTableId: routeTableId,
    PrefixListId: prefixListId,
    PrefixListOwnerId: ctx.account,
    State: "available",
    Blackhole: blackhole,
    TransitGatewayAttachment: {
      TransitGatewayAttachmentId: attachmentId,
      ResourceType: "vpc",
      ResourceId: "",
    },
  };
  ctx.store.set(
    transitGatewayPrefixListReferenceKey(routeTableId, prefixListId),
    ref,
  );
  return {
    TransitGatewayPrefixListReference: {
      TransitGatewayRouteTableId: ref.TransitGatewayRouteTableId,
      PrefixListId: ref.PrefixListId,
      PrefixListOwnerId: ref.PrefixListOwnerId,
      State: ref.State,
      Blackhole: ref.Blackhole,
      TransitGatewayAttachment: ref.TransitGatewayAttachment,
    },
  };
};

const CreateTransitGatewayRoute: OperationHandler = (input, ctx) => {
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const blackhole =
    typeof input["Blackhole"] === "boolean" ? input["Blackhole"] : false;
  const route: StoredTransitGatewayRoute = {
    DestinationCidrBlock: destinationCidrBlock,
    TransitGatewayRouteTableId: routeTableId,
    TransitGatewayAttachmentId: attachmentId,
    Blackhole: blackhole,
    Type: blackhole ? "blackhole" : "static",
    State: "active",
  };
  ctx.store.set(
    transitGatewayRouteKey(routeTableId, destinationCidrBlock),
    route,
  );
  return {
    Route: {
      DestinationCidrBlock: route.DestinationCidrBlock,
      TransitGatewayAttachments: attachmentId
        ? [{ TransitGatewayAttachmentId: attachmentId, ResourceType: "vpc" }]
        : [],
      Type: route.Type,
      State: route.State,
    },
  };
};

const CreateTransitGatewayRouteTable: OperationHandler = (input, ctx) => {
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const id = hexId("tgw-rtb");
  const rtb: StoredTransitGatewayRouteTable = {
    TransitGatewayRouteTableId: id,
    TransitGatewayId: transitGatewayId,
    State: "available",
    DefaultAssociationRouteTable: false,
    DefaultPropagationRouteTable: false,
    CreationTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(transitGatewayRouteTableKey(id), rtb);
  return {
    TransitGatewayRouteTable: {
      TransitGatewayRouteTableId: rtb.TransitGatewayRouteTableId,
      TransitGatewayId: rtb.TransitGatewayId,
      State: rtb.State,
      DefaultAssociationRouteTable: rtb.DefaultAssociationRouteTable,
      DefaultPropagationRouteTable: rtb.DefaultPropagationRouteTable,
      CreationTime: rtb.CreationTime,
      Tags: rtb.Tags,
    },
  };
};

const CreateTransitGatewayRouteTableAnnouncement: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const peeringAttachmentId =
    typeof input["PeeringAttachmentId"] === "string"
      ? input["PeeringAttachmentId"]
      : "";
  const rtb = ctx.store.get<StoredTransitGatewayRouteTable>(
    transitGatewayRouteTableKey(routeTableId),
  );
  const transitGatewayId = rtb?.TransitGatewayId ?? hexId("tgw");
  const peeringAttachment =
    ctx.store.get<StoredTransitGatewayPeeringAttachment>(
      transitGatewayPeeringAttachmentKey(peeringAttachmentId),
    );
  const peerTransitGatewayId =
    peeringAttachment?.AccepterTgwInfo.TransitGatewayId ?? hexId("tgw");
  const id = hexId("tgw-rtb-ann");
  const announcement: StoredTransitGatewayRouteTableAnnouncement = {
    TransitGatewayRouteTableAnnouncementId: id,
    TransitGatewayId: transitGatewayId,
    PeerTransitGatewayId: peerTransitGatewayId,
    PeeringAttachmentId: peeringAttachmentId,
    AnnouncementDirection: "outgoing",
    TransitGatewayRouteTableId: routeTableId,
    State: "available",
    CreationTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(transitGatewayRouteTableAnnouncementKey(id), announcement);
  return {
    TransitGatewayRouteTableAnnouncement: {
      TransitGatewayRouteTableAnnouncementId:
        announcement.TransitGatewayRouteTableAnnouncementId,
      TransitGatewayId: announcement.TransitGatewayId,
      PeerTransitGatewayId: announcement.PeerTransitGatewayId,
      PeeringAttachmentId: announcement.PeeringAttachmentId,
      AnnouncementDirection: announcement.AnnouncementDirection,
      TransitGatewayRouteTableId: announcement.TransitGatewayRouteTableId,
      State: announcement.State,
      CreationTime: announcement.CreationTime,
      Tags: announcement.Tags,
    },
  };
};

const CreateTransitGatewayVpcAttachment: OperationHandler = (input, ctx) => {
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const subnetIds = stringList(input["SubnetIds"]);
  const opts =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  const id = hexId("tgw-attach");
  const attachment: StoredTransitGatewayVpcAttachment = {
    TransitGatewayAttachmentId: id,
    TransitGatewayId: transitGatewayId,
    VpcId: vpcId,
    VpcOwnerId: ctx.account,
    State: "available",
    SubnetIds: subnetIds,
    CreationTime: new Date().toISOString(),
    Options: {
      DnsSupport:
        typeof opts["DnsSupport"] === "string" ? opts["DnsSupport"] : "enable",
      SecurityGroupReferencingSupport:
        typeof opts["SecurityGroupReferencingSupport"] === "string"
          ? opts["SecurityGroupReferencingSupport"]
          : "disable",
      Ipv6Support:
        typeof opts["Ipv6Support"] === "string"
          ? opts["Ipv6Support"]
          : "disable",
      ApplianceModeSupport:
        typeof opts["ApplianceModeSupport"] === "string"
          ? opts["ApplianceModeSupport"]
          : "disable",
    },
    Tags: [],
  };
  ctx.store.set(transitGatewayVpcAttachmentKey(id), attachment);
  return {
    TransitGatewayVpcAttachment: {
      TransitGatewayAttachmentId: attachment.TransitGatewayAttachmentId,
      TransitGatewayId: attachment.TransitGatewayId,
      VpcId: attachment.VpcId,
      VpcOwnerId: attachment.VpcOwnerId,
      State: attachment.State,
      SubnetIds: attachment.SubnetIds,
      CreationTime: attachment.CreationTime,
      Options: attachment.Options,
      Tags: attachment.Tags,
    },
  };
};

const CreateVerifiedAccessEndpoint: OperationHandler = (input, ctx) => {
  const groupId =
    typeof input["VerifiedAccessGroupId"] === "string"
      ? input["VerifiedAccessGroupId"]
      : "";
  const group = ctx.store.get<StoredVerifiedAccessGroup>(
    verifiedAccessGroupKey(groupId),
  );
  const instanceId = group?.VerifiedAccessInstanceId ?? hexId("vai");
  const endpointType =
    typeof input["EndpointType"] === "string" ? input["EndpointType"] : "";
  const attachmentType =
    typeof input["AttachmentType"] === "string"
      ? input["AttachmentType"]
      : "vpc";
  const domainCertificateArn =
    typeof input["DomainCertificateArn"] === "string"
      ? input["DomainCertificateArn"]
      : "";
  const applicationDomain =
    typeof input["ApplicationDomain"] === "string"
      ? input["ApplicationDomain"]
      : "";
  const endpointDomainPrefix =
    typeof input["EndpointDomainPrefix"] === "string"
      ? input["EndpointDomainPrefix"]
      : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const securityGroupIds = stringList(input["SecurityGroupIds"]);
  const id = hexId("vae");
  const endpoint: StoredVerifiedAccessEndpoint = {
    VerifiedAccessEndpointId: id,
    VerifiedAccessInstanceId: instanceId,
    VerifiedAccessGroupId: groupId,
    ApplicationDomain: applicationDomain,
    EndpointType: endpointType,
    AttachmentType: attachmentType,
    DomainCertificateArn: domainCertificateArn,
    EndpointDomain: `${endpointDomainPrefix}.${applicationDomain}`,
    SecurityGroupIds: securityGroupIds,
    Description: description,
    CreationTime: new Date().toISOString(),
    LastUpdatedTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(verifiedAccessEndpointKey(id), endpoint);
  return {
    VerifiedAccessEndpoint: {
      VerifiedAccessInstanceId: endpoint.VerifiedAccessInstanceId,
      VerifiedAccessGroupId: endpoint.VerifiedAccessGroupId,
      VerifiedAccessEndpointId: endpoint.VerifiedAccessEndpointId,
      ApplicationDomain: endpoint.ApplicationDomain,
      EndpointType: endpoint.EndpointType,
      AttachmentType: endpoint.AttachmentType,
      DomainCertificateArn: endpoint.DomainCertificateArn,
      EndpointDomain: endpoint.EndpointDomain,
      SecurityGroupIds: endpoint.SecurityGroupIds,
      Status: { Code: "active", Message: "" },
      Description: endpoint.Description,
      CreationTime: endpoint.CreationTime,
      LastUpdatedTime: endpoint.LastUpdatedTime,
      Tags: endpoint.Tags,
    },
  };
};

const CreateVerifiedAccessGroup: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("vagr");
  const group: StoredVerifiedAccessGroup = {
    VerifiedAccessGroupId: id,
    VerifiedAccessInstanceId: instanceId,
    Description: description,
    Owner: ctx.account,
    VerifiedAccessGroupArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:verified-access-group/${id}`,
    CreationTime: new Date().toISOString(),
    LastUpdatedTime: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(verifiedAccessGroupKey(id), group);
  return {
    VerifiedAccessGroup: {
      VerifiedAccessGroupId: group.VerifiedAccessGroupId,
      VerifiedAccessInstanceId: group.VerifiedAccessInstanceId,
      Description: group.Description,
      Owner: group.Owner,
      VerifiedAccessGroupArn: group.VerifiedAccessGroupArn,
      CreationTime: group.CreationTime,
      LastUpdatedTime: group.LastUpdatedTime,
      Tags: group.Tags,
    },
  };
};

const CreateVerifiedAccessInstance: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const fipsEnabled =
    typeof input["FIPSEnabled"] === "boolean" ? input["FIPSEnabled"] : false;
  const id = hexId("vai");
  const instance: StoredVerifiedAccessInstance = {
    VerifiedAccessInstanceId: id,
    Description: description,
    TrustProviderIds: [],
    CreationTime: new Date().toISOString(),
    LastUpdatedTime: new Date().toISOString(),
    Tags: [],
    FipsEnabled: fipsEnabled,
  };
  ctx.store.set(vaInstanceKey(id), instance);
  return {
    VerifiedAccessInstance: {
      VerifiedAccessInstanceId: instance.VerifiedAccessInstanceId,
      Description: instance.Description,
      VerifiedAccessTrustProviders: [],
      CreationTime: instance.CreationTime,
      LastUpdatedTime: instance.LastUpdatedTime,
      Tags: instance.Tags,
      FipsEnabled: instance.FipsEnabled,
    },
  };
};

const CreateVerifiedAccessTrustProvider: OperationHandler = (input, ctx) => {
  const trustProviderType =
    typeof input["TrustProviderType"] === "string"
      ? input["TrustProviderType"]
      : "";
  const userTrustProviderType =
    typeof input["UserTrustProviderType"] === "string"
      ? input["UserTrustProviderType"]
      : undefined;
  const deviceTrustProviderType =
    typeof input["DeviceTrustProviderType"] === "string"
      ? input["DeviceTrustProviderType"]
      : undefined;
  const policyReferenceName =
    typeof input["PolicyReferenceName"] === "string"
      ? input["PolicyReferenceName"]
      : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("vatp");
  const stored: StoredVerifiedAccessTrustProvider = {
    VerifiedAccessTrustProviderId: id,
    TrustProviderType: trustProviderType,
    PolicyReferenceName: policyReferenceName,
    CreationTime: new Date().toISOString(),
    LastUpdatedTime: new Date().toISOString(),
  };
  ctx.store.set(vaTrustProviderKey(id), stored);
  return {
    VerifiedAccessTrustProvider: {
      VerifiedAccessTrustProviderId: stored.VerifiedAccessTrustProviderId,
      Description: description,
      TrustProviderType: stored.TrustProviderType,
      UserTrustProviderType: userTrustProviderType,
      DeviceTrustProviderType: deviceTrustProviderType,
      PolicyReferenceName: stored.PolicyReferenceName,
      CreationTime: stored.CreationTime,
      LastUpdatedTime: stored.LastUpdatedTime,
      Tags: [],
    },
  };
};

const CreateVpcBlockPublicAccessExclusion: OperationHandler = (input, ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : undefined;
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : undefined;
  const mode =
    typeof input["InternetGatewayExclusionMode"] === "string"
      ? input["InternetGatewayExclusionMode"]
      : "";
  const resourceId = subnetId ?? vpcId ?? hexId("subnet");
  const resourceArn = subnetId
    ? `arn:aws:ec2:${ctx.region}:${ctx.account}:subnet/${resourceId}`
    : `arn:aws:ec2:${ctx.region}:${ctx.account}:vpc/${resourceId}`;
  const id = hexId("bpa-excl");
  const now = new Date().toISOString();
  const stored: StoredVpcBlockPublicAccessExclusion = {
    ExclusionId: id,
    InternetGatewayExclusionMode: mode,
    ResourceArn: resourceArn,
    State: "create-complete",
    CreationTimestamp: now,
    LastUpdateTimestamp: now,
    Tags: [],
  };
  ctx.store.set(vpcBlockPublicAccessExclusionKey(id), stored);
  return {
    VpcBlockPublicAccessExclusion: {
      ExclusionId: stored.ExclusionId,
      InternetGatewayExclusionMode: stored.InternetGatewayExclusionMode,
      ResourceArn: stored.ResourceArn,
      State: stored.State,
      CreationTimestamp: stored.CreationTimestamp,
      LastUpdateTimestamp: stored.LastUpdateTimestamp,
      Tags: stored.Tags,
    },
  };
};

const CreateVpcEncryptionControl: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const id = hexId("vpc-enc");
  const stored: StoredVpcEncryptionControl = {
    VpcEncryptionControlId: id,
    VpcId: vpcId,
    Mode: "enforce",
    State: "enforce-in-progress",
    Tags: [],
  };
  ctx.store.set(vpcEncryptionControlKey(id), stored);
  return {
    VpcEncryptionControl: {
      VpcEncryptionControlId: stored.VpcEncryptionControlId,
      VpcId: stored.VpcId,
      Mode: stored.Mode,
      State: stored.State,
      Tags: stored.Tags,
    },
  };
};

const CreateVpcEndpoint: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const serviceName =
    typeof input["ServiceName"] === "string" ? input["ServiceName"] : "";
  const endpointType =
    typeof input["VpcEndpointType"] === "string"
      ? input["VpcEndpointType"]
      : "Interface";
  const routeTableIds = stringList(input["RouteTableIds"]);
  const subnetIds = stringList(input["SubnetIds"]);
  const securityGroupIds = stringList(input["SecurityGroupIds"]);
  const ipAddressType =
    typeof input["IpAddressType"] === "string" ? input["IpAddressType"] : "";
  const privateDnsEnabled =
    typeof input["PrivateDnsEnabled"] === "boolean"
      ? input["PrivateDnsEnabled"]
      : false;
  const id = hexId("vpce");
  const stored: StoredVpcEndpoint = {
    VpcEndpointId: id,
    VpcEndpointType: endpointType,
    VpcId: vpcId,
    ServiceName: serviceName,
    State: "available",
    RouteTableIds: routeTableIds,
    SubnetIds: subnetIds,
    Groups: securityGroupIds.map((gid) => ({ GroupId: gid, GroupName: "" })),
    IpAddressType: ipAddressType,
    PrivateDnsEnabled: privateDnsEnabled,
    OwnerId: ctx.account,
    CreationTimestamp: new Date().toISOString(),
    Tags: [],
  };
  ctx.store.set(vpcEndpointKey(id), stored);
  return {
    VpcEndpoint: {
      VpcEndpointId: stored.VpcEndpointId,
      VpcEndpointType: stored.VpcEndpointType,
      VpcId: stored.VpcId,
      ServiceName: stored.ServiceName,
      State: stored.State,
      RouteTableIds: stored.RouteTableIds,
      SubnetIds: stored.SubnetIds,
      Groups: stored.Groups,
      IpAddressType: stored.IpAddressType,
      PrivateDnsEnabled: stored.PrivateDnsEnabled,
      OwnerId: stored.OwnerId,
      CreationTimestamp: stored.CreationTimestamp,
      Tags: stored.Tags,
    },
  };
};

const CreateVpcEndpointConnectionNotification: OperationHandler = (
  input,
  ctx,
) => {
  const serviceId =
    typeof input["ServiceId"] === "string" ? input["ServiceId"] : undefined;
  const vpcEndpointId =
    typeof input["VpcEndpointId"] === "string"
      ? input["VpcEndpointId"]
      : undefined;
  const connectionNotificationArn =
    typeof input["ConnectionNotificationArn"] === "string"
      ? input["ConnectionNotificationArn"]
      : "";
  const connectionEvents = stringList(input["ConnectionEvents"]);
  const id = hexId("vpce-cn");
  const stored: StoredVpcEndpointConnectionNotification = {
    ConnectionNotificationId: id,
    ServiceId: serviceId,
    VpcEndpointId: vpcEndpointId,
    ConnectionNotificationType: "Topic",
    ConnectionNotificationArn: connectionNotificationArn,
    ConnectionEvents: connectionEvents,
    ConnectionNotificationState: "Enabled",
  };
  ctx.store.set(vpcEndpointConnectionNotificationKey(id), stored);
  return {
    ConnectionNotification: {
      ConnectionNotificationId: stored.ConnectionNotificationId,
      ServiceId: stored.ServiceId,
      VpcEndpointId: stored.VpcEndpointId,
      ConnectionNotificationType: stored.ConnectionNotificationType,
      ConnectionNotificationArn: stored.ConnectionNotificationArn,
      ConnectionEvents: stored.ConnectionEvents,
      ConnectionNotificationState: stored.ConnectionNotificationState,
    },
    ClientToken:
      typeof input["ClientToken"] === "string"
        ? input["ClientToken"]
        : undefined,
  };
};

const CreateVpcEndpointServiceConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const acceptanceRequired =
    typeof input["AcceptanceRequired"] === "boolean"
      ? input["AcceptanceRequired"]
      : false;
  const privateDnsName =
    typeof input["PrivateDnsName"] === "string"
      ? input["PrivateDnsName"]
      : undefined;
  const networkLoadBalancerArns = stringList(input["NetworkLoadBalancerArns"]);
  const gatewayLoadBalancerArns = stringList(input["GatewayLoadBalancerArns"]);
  const id = hexId("vpce-svc");
  const serviceName = `com.amazonaws.vpce.${ctx.region}.${id}`;
  const stored: StoredVpcEndpointServiceConfiguration = {
    ServiceId: id,
    ServiceName: serviceName,
    ServiceState: "Available",
    AcceptanceRequired: acceptanceRequired,
    NetworkLoadBalancerArns: networkLoadBalancerArns,
    GatewayLoadBalancerArns: gatewayLoadBalancerArns,
    PrivateDnsName: privateDnsName,
    Tags: [],
  };
  ctx.store.set(vpcEndpointServiceConfigKey(id), stored);
  return {
    ServiceConfiguration: {
      ServiceId: stored.ServiceId,
      ServiceName: stored.ServiceName,
      ServiceState: stored.ServiceState,
      AcceptanceRequired: stored.AcceptanceRequired,
      NetworkLoadBalancerArns: stored.NetworkLoadBalancerArns,
      GatewayLoadBalancerArns: stored.GatewayLoadBalancerArns,
      PrivateDnsName: stored.PrivateDnsName,
      Tags: stored.Tags,
    },
    ClientToken:
      typeof input["ClientToken"] === "string"
        ? input["ClientToken"]
        : undefined,
  };
};

const CreateVpcPeeringConnection: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const peerVpcId =
    typeof input["PeerVpcId"] === "string" ? input["PeerVpcId"] : "";
  const peerOwnerId =
    typeof input["PeerOwnerId"] === "string"
      ? input["PeerOwnerId"]
      : ctx.account;
  const id = hexId("pcx");
  const stored: StoredVpcPeeringConnection = {
    VpcPeeringConnectionId: id,
    AccepterVpcId: peerVpcId,
    RequesterVpcId: vpcId,
    Status: { Code: "pending-acceptance", Message: "Pending Acceptance" },
    Tags: [],
  };
  ctx.store.set(vpcPeeringKey(id), stored);
  return {
    VpcPeeringConnection: {
      VpcPeeringConnectionId: stored.VpcPeeringConnectionId,
      AccepterVpcInfo: { VpcId: stored.AccepterVpcId, OwnerId: peerOwnerId },
      RequesterVpcInfo: { VpcId: stored.RequesterVpcId, OwnerId: ctx.account },
      Status: stored.Status,
      Tags: stored.Tags,
    },
  };
};

const CreateVpnConcentrator: OperationHandler = (input, ctx) => {
  const type = typeof input["Type"] === "string" ? input["Type"] : "ipsec.1";
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : undefined;
  const id = hexId("vpn-conc");
  const stored: StoredVpnConcentrator = {
    VpnConcentratorId: id,
    State: "available",
    TransitGatewayId: transitGatewayId,
    Type: type,
    Tags: [],
  };
  ctx.store.set(vpnConcentratorKey(id), stored);
  return {
    VpnConcentrator: {
      VpnConcentratorId: stored.VpnConcentratorId,
      State: stored.State,
      TransitGatewayId: stored.TransitGatewayId,
      Type: stored.Type,
      Tags: stored.Tags,
    },
  };
};

const CreateVpnConnection: OperationHandler = (input, ctx) => {
  const customerGatewayId =
    typeof input["CustomerGatewayId"] === "string"
      ? input["CustomerGatewayId"]
      : "";
  const type = typeof input["Type"] === "string" ? input["Type"] : "ipsec.1";
  const vpnGatewayId =
    typeof input["VpnGatewayId"] === "string"
      ? input["VpnGatewayId"]
      : undefined;
  const transitGatewayId =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : undefined;
  const id = hexId("vpn");
  const stored: StoredVpnConnection = {
    VpnConnectionId: id,
    State: "available",
    CustomerGatewayId: customerGatewayId,
    VpnGatewayId: vpnGatewayId,
    TransitGatewayId: transitGatewayId,
    Type: type,
    Tags: [],
  };
  ctx.store.set(vpnConnectionKey(id), stored);
  return {
    VpnConnection: {
      VpnConnectionId: stored.VpnConnectionId,
      State: stored.State,
      CustomerGatewayId: stored.CustomerGatewayId,
      VpnGatewayId: stored.VpnGatewayId,
      TransitGatewayId: stored.TransitGatewayId,
      Type: stored.Type,
      Tags: stored.Tags,
      Routes: [],
      VgwTelemetry: [],
    },
  };
};

const CreateVpnConnectionRoute: OperationHandler = (input, ctx) => {
  const vpnConnectionId =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const stored: StoredVpnConnectionRoute = {
    VpnConnectionId: vpnConnectionId,
    DestinationCidrBlock: destinationCidrBlock,
    State: "available",
  };
  ctx.store.set(
    vpnConnectionRouteKey(vpnConnectionId, destinationCidrBlock),
    stored,
  );
  return {};
};

const CreateVpnGateway: OperationHandler = (input, ctx) => {
  const type = typeof input["Type"] === "string" ? input["Type"] : "ipsec.1";
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : undefined;
  const amazonSideAsn =
    typeof input["AmazonSideAsn"] === "number" ? input["AmazonSideAsn"] : 64512;
  const id = hexId("vgw");
  const stored: StoredVpnGateway = {
    VpnGatewayId: id,
    State: "available",
    VpcAttachments: [],
  };
  ctx.store.set(vpnGwKey(id), stored);
  return {
    VpnGateway: {
      VpnGatewayId: stored.VpnGatewayId,
      State: stored.State,
      Type: type,
      AvailabilityZone: availabilityZone,
      AmazonSideAsn: amazonSideAsn,
      VpcAttachments: stored.VpcAttachments,
      Tags: [],
    },
  };
};

const DeleteCapacityManagerDataExport: OperationHandler = (input, ctx) => {
  const id =
    typeof input["CapacityManagerDataExportId"] === "string"
      ? input["CapacityManagerDataExportId"]
      : "";
  ctx.store.delete(capacityManagerDataExportKey(id));
  return { CapacityManagerDataExportId: id };
};

const DeleteCarrierGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["CarrierGatewayId"] === "string"
      ? input["CarrierGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredCarrierGateway>(carrierGatewayKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidCarrierGatewayID.NotFound",
      `The carrier gateway ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(carrierGatewayKey(id));
  return {
    CarrierGateway: {
      CarrierGatewayId: gateway.CarrierGatewayId,
      VpcId: gateway.VpcId,
      State: "deleted",
      OwnerId: gateway.OwnerId,
      Tags: gateway.Tags,
    },
  };
};

const DeleteClientVpnEndpoint: OperationHandler = (input, ctx) => {
  const id =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredClientVpnEndpoint>(
    clientVpnEndpointKey(id),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidClientVpnEndpointId.NotFound",
      `The Client VPN endpoint ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(clientVpnEndpointKey(id));
  return { Status: { Code: "deleting", Message: "" } };
};

const DeleteClientVpnRoute: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const cidr =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const route = ctx.store.get<StoredClientVpnRoute>(
    clientVpnRouteKey(endpointId, cidr),
  );
  if (route === undefined) {
    throw awsError(
      "InvalidClientVpnRouteNotFound",
      `The route '${cidr}' does not exist for endpoint '${endpointId}'`,
      400,
    );
  }
  ctx.store.delete(clientVpnRouteKey(endpointId, cidr));
  return { Status: { Code: "deleting", Message: "" } };
};

const DeleteCoipCidr: OperationHandler = (input, ctx) => {
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  const poolId =
    typeof input["CoipPoolId"] === "string" ? input["CoipPoolId"] : "";
  const coipCidr = ctx.store.get<StoredCoipCidr>(coipCidrKey(poolId, cidr));
  if (coipCidr === undefined) {
    throw awsError(
      "InvalidCoipCidr.NotFound",
      `The COIP CIDR '${cidr}' does not exist in pool '${poolId}'`,
      400,
    );
  }
  ctx.store.delete(coipCidrKey(poolId, cidr));
  const pool = ctx.store.get<StoredCoipPool>(coipPoolKey(poolId));
  if (pool !== undefined) {
    pool.PoolCidrs = pool.PoolCidrs.filter((c) => c !== cidr);
    ctx.store.set(coipPoolKey(poolId), pool);
  }
  return {
    CoipCidr: {
      Cidr: coipCidr.Cidr,
      CoipPoolId: coipCidr.CoipPoolId,
      LocalGatewayRouteTableId: coipCidr.LocalGatewayRouteTableId,
    },
  };
};

const DeleteCoipPool: OperationHandler = (input, ctx) => {
  const poolId =
    typeof input["CoipPoolId"] === "string" ? input["CoipPoolId"] : "";
  const pool = ctx.store.get<StoredCoipPool>(coipPoolKey(poolId));
  if (pool === undefined) {
    throw awsError(
      "InvalidCoipPoolId.NotFound",
      `The COIP pool ID '${poolId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(coipPoolKey(poolId));
  return {
    CoipPool: {
      PoolId: pool.PoolId,
      PoolCidrs: pool.PoolCidrs,
      LocalGatewayRouteTableId: pool.LocalGatewayRouteTableId,
      Tags: pool.Tags,
      PoolArn: pool.PoolArn,
    },
  };
};

const DeleteCustomerGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["CustomerGatewayId"] === "string"
      ? input["CustomerGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredCustomerGateway>(customerGatewayKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidCustomerGatewayID.NotFound",
      `The customer gateway ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(customerGatewayKey(id));
  return {};
};

const DeleteDhcpOptions: OperationHandler = (input, ctx) => {
  const id =
    typeof input["DhcpOptionsId"] === "string" ? input["DhcpOptionsId"] : "";
  const dhcpOptions = ctx.store.get<StoredDhcpOptions>(dhcpOptionsKey(id));
  if (dhcpOptions === undefined) {
    throw awsError(
      "InvalidDhcpOptionID.NotFound",
      `The dhcp option ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(dhcpOptionsKey(id));
  return {};
};

const DeleteEgressOnlyInternetGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["EgressOnlyInternetGatewayId"] === "string"
      ? input["EgressOnlyInternetGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredEgressOnlyInternetGateway>(
    egressOnlyIgwKey(id),
  );
  if (gateway === undefined) {
    return { ReturnCode: false };
  }
  ctx.store.delete(egressOnlyIgwKey(id));
  return { ReturnCode: true };
};

const DeleteFleets: OperationHandler = (input, ctx) => {
  const fleetIds = stringList(input["FleetIds"]);
  const successful: {
    CurrentFleetState: string;
    PreviousFleetState: string;
    FleetId: string;
  }[] = [];
  const unsuccessful: {
    Error: { Code: string; Message: string };
    FleetId: string;
  }[] = [];
  for (const fleetId of fleetIds) {
    const fleet = ctx.store.get<StoredFleet>(fleetKey(fleetId));
    if (fleet === undefined) {
      unsuccessful.push({
        Error: {
          Code: "fleetIdDoesNotExist",
          Message: `The fleet ID '${fleetId}' does not exist`,
        },
        FleetId: fleetId,
      });
    } else {
      const previousState = fleet.FleetState;
      fleet.FleetState = "deleted";
      ctx.store.set(fleetKey(fleetId), fleet);
      successful.push({
        CurrentFleetState: "deleted",
        PreviousFleetState: previousState,
        FleetId: fleetId,
      });
    }
  }
  return {
    SuccessfulFleetDeletions: successful,
    UnsuccessfulFleetDeletions: unsuccessful,
  };
};

const DeleteFlowLogs: OperationHandler = (input, ctx) => {
  const flowLogIds = stringList(input["FlowLogIds"]);
  for (const id of flowLogIds) {
    ctx.store.delete(flowLogKey(id));
  }
  return { Unsuccessful: [] };
};

const DeleteFpgaImage: OperationHandler = (input, ctx) => {
  const id =
    typeof input["FpgaImageId"] === "string" ? input["FpgaImageId"] : "";
  const image = ctx.store.get<StoredFpgaImage>(fpgaImageKey(id));
  if (image === undefined) {
    throw awsError(
      "InvalidFpgaImageID.NotFound",
      `The FPGA image ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(fpgaImageKey(id));
  return { Return: true };
};

const DeleteImageUsageReport: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const DeleteInstanceConnectEndpoint: OperationHandler = (input, ctx) => {
  const id =
    typeof input["InstanceConnectEndpointId"] === "string"
      ? input["InstanceConnectEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredInstanceConnectEndpoint>(
    instanceConnectEndpointKey(id),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidInstanceConnectEndpointId.NotFound",
      `The instance connect endpoint ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(instanceConnectEndpointKey(id));
  return {
    InstanceConnectEndpoint: {
      OwnerId: endpoint.OwnerId,
      InstanceConnectEndpointId: endpoint.InstanceConnectEndpointId,
      InstanceConnectEndpointArn: endpoint.InstanceConnectEndpointArn,
      State: "delete-complete",
      SubnetId: endpoint.SubnetId,
      VpcId: endpoint.VpcId,
      PreserveClientIp: endpoint.PreserveClientIp,
      SecurityGroupIds: endpoint.SecurityGroupIds,
      CreatedAt: endpoint.CreatedAt,
      Tags: endpoint.Tags,
    },
  };
};

const DeleteInstanceEventWindow: OperationHandler = (input, ctx) => {
  const id =
    typeof input["InstanceEventWindowId"] === "string"
      ? input["InstanceEventWindowId"]
      : "";
  const eventWindow = ctx.store.get<StoredInstanceEventWindow>(
    instanceEventWindowKey(id),
  );
  if (eventWindow === undefined) {
    throw awsError(
      "InvalidInstanceEventWindowId.NotFound",
      `The instance event window ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(instanceEventWindowKey(id));
  return {
    InstanceEventWindowState: {
      InstanceEventWindowId: eventWindow.InstanceEventWindowId,
      State: "deleting",
    },
  };
};

const DeleteInternetGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["InternetGatewayId"] === "string"
      ? input["InternetGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredInternetGateway>(igwKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidInternetGatewayID.NotFound",
      `The internet gateway ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(igwKey(id));
  return {};
};

const DeleteIpam: OperationHandler = (input, ctx) => {
  const id = typeof input["IpamId"] === "string" ? input["IpamId"] : "";
  const ipam = ctx.store.get<StoredIpam>(ipamKey(id));
  if (ipam === undefined) {
    throw awsError(
      "InvalidIpamId.NotFound",
      `The IPAM ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamKey(id));
  return {
    Ipam: {
      IpamId: ipam.IpamId,
      OwnerId: ipam.OwnerId,
      IpamArn: ipam.IpamArn,
      State: "delete-complete",
      Description: ipam.Description,
      PublicDefaultScopeId: ipam.PublicDefaultScopeId,
      PrivateDefaultScopeId: ipam.PrivateDefaultScopeId,
      ScopeCount: ipam.ScopeCount,
      Tags: ipam.Tags,
    },
  };
};

const DeleteIpamExternalResourceVerificationToken: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["IpamExternalResourceVerificationTokenId"] === "string"
      ? input["IpamExternalResourceVerificationTokenId"]
      : "";
  const token = ctx.store.get<StoredIpamExternalResourceVerificationToken>(
    ipamExternalTokenKey(id),
  );
  if (token === undefined) {
    throw awsError(
      "InvalidIpamExternalResourceVerificationTokenId.NotFound",
      `The IPAM external resource verification token ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamExternalTokenKey(id));
  return {
    IpamExternalResourceVerificationToken: {
      IpamExternalResourceVerificationTokenId:
        token.IpamExternalResourceVerificationTokenId,
      IpamArn: token.IpamArn,
      IpamId: token.IpamId,
      TokenValue: token.TokenValue,
      TokenName: token.TokenName,
      NotAfter: token.NotAfter,
      Status: token.Status,
      State: "delete-complete",
      Tags: token.Tags,
    },
  };
};

const DeleteIpamPolicy: OperationHandler = (input, ctx) => {
  const id =
    typeof input["IpamPolicyId"] === "string" ? input["IpamPolicyId"] : "";
  const policy = ctx.store.get<StoredIpamPolicy>(ipamPolicyKey(id));
  if (policy === undefined) {
    throw awsError(
      "InvalidIpamPolicyId.NotFound",
      `The IPAM policy ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamPolicyKey(id));
  return {
    IpamPolicy: {
      IpamPolicyId: policy.IpamPolicyId,
      IpamArn: policy.IpamArn,
      Description: policy.Description,
      Policy: policy.Policy,
      Tags: policy.Tags,
    },
  };
};

const DeleteIpamPool: OperationHandler = (input, ctx) => {
  const id = typeof input["IpamPoolId"] === "string" ? input["IpamPoolId"] : "";
  const pool = ctx.store.get<StoredIpamPool>(ipamPoolKey(id));
  if (pool === undefined) {
    throw awsError(
      "InvalidIpamPoolId.NotFound",
      `The IPAM pool ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamPoolKey(id));
  return {
    IpamPool: {
      IpamPoolId: pool.IpamPoolId,
      IpamScopeId: pool.IpamScopeId,
      IpamId: pool.IpamId,
      IpamArn: pool.IpamArn,
      IpamScopeArn: pool.IpamScopeArn,
      IpamPoolArn: pool.IpamPoolArn,
      Locale: pool.Locale,
      AddressFamily: pool.AddressFamily,
      State: "delete-complete",
      Description: pool.Description,
      Tags: pool.Tags,
    },
  };
};

const DeleteIpamPrefixListResolver: OperationHandler = (input, ctx) => {
  const id =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : "";
  const resolver = ctx.store.get<StoredIpamPrefixListResolver>(
    ipamPrefixListResolverKey(id),
  );
  if (resolver === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverId.NotFound",
      `The IPAM prefix list resolver ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamPrefixListResolverKey(id));
  return {
    IpamPrefixListResolver: {
      IpamPrefixListResolverId: resolver.IpamPrefixListResolverId,
      IpamId: resolver.IpamId,
      IpamArn: resolver.IpamArn,
      OwnerId: resolver.OwnerId,
      Tags: resolver.Tags,
    },
  };
};

const DeleteIpamPrefixListResolverTarget: OperationHandler = (input, ctx) => {
  const resolverId =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : "";
  const targetId =
    typeof input["IpamPrefixListResolverTargetId"] === "string"
      ? input["IpamPrefixListResolverTargetId"]
      : "";
  const target = ctx.store.get<StoredIpamPrefixListResolverTarget>(
    ipamPrefixListResolverTargetKey(resolverId, targetId),
  );
  if (target === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverTargetId.NotFound",
      `The IPAM prefix list resolver target ID '${targetId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamPrefixListResolverTargetKey(resolverId, targetId));
  return {
    IpamPrefixListResolverTarget: {
      IpamPrefixListResolverId: target.IpamPrefixListResolverId,
      IpamPrefixListResolverTargetId: target.IpamPrefixListResolverTargetId,
      PrefixListId: target.PrefixListId,
      OwnerId: target.OwnerId,
      Tags: target.Tags,
    },
  };
};

const DeleteIpamResourceDiscovery: OperationHandler = (input, ctx) => {
  const id =
    typeof input["IpamResourceDiscoveryId"] === "string"
      ? input["IpamResourceDiscoveryId"]
      : "";
  const resourceDiscovery = ctx.store.get<StoredIpamResourceDiscovery>(
    ipamResourceDiscoveryKey(id),
  );
  if (resourceDiscovery === undefined) {
    throw awsError(
      "InvalidIpamResourceDiscoveryId.NotFound",
      `The IPAM resource discovery ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamResourceDiscoveryKey(id));
  return {
    IpamResourceDiscovery: {
      IpamResourceDiscoveryId: resourceDiscovery.IpamResourceDiscoveryId,
      OwnerId: resourceDiscovery.OwnerId,
      IpamResourceDiscoveryArn: resourceDiscovery.IpamResourceDiscoveryArn,
      State: "delete-complete",
      Description: resourceDiscovery.Description,
      IsDefault: resourceDiscovery.IsDefault,
      Tags: resourceDiscovery.Tags,
    },
  };
};

const DeleteIpamScope: OperationHandler = (input, ctx) => {
  const id =
    typeof input["IpamScopeId"] === "string" ? input["IpamScopeId"] : "";
  const scope = ctx.store.get<StoredIpamScope>(ipamScopeKey(id));
  if (scope === undefined) {
    throw awsError(
      "InvalidIpamScopeId.NotFound",
      `The IPAM scope ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(ipamScopeKey(id));
  return {
    IpamScope: {
      IpamScopeId: scope.IpamScopeId,
      IpamId: scope.IpamId,
      IpamScopeArn: scope.IpamScopeArn,
      IpamArn: scope.IpamArn,
      IpamScopeType: scope.IpamScopeType,
      IsDefault: scope.IsDefault,
      Description: scope.Description,
      PoolCount: scope.PoolCount,
      State: "delete-complete",
      Tags: scope.Tags,
    },
  };
};

const DeleteLaunchTemplate: OperationHandler = (input, ctx) => {
  const launchTemplateId =
    typeof input["LaunchTemplateId"] === "string"
      ? input["LaunchTemplateId"]
      : undefined;
  const launchTemplateName =
    typeof input["LaunchTemplateName"] === "string"
      ? input["LaunchTemplateName"]
      : undefined;
  let lt: StoredLaunchTemplate | undefined;
  if (launchTemplateId !== undefined) {
    lt = ctx.store.get<StoredLaunchTemplate>(
      launchTemplateKey(launchTemplateId),
    );
  } else if (launchTemplateName !== undefined) {
    lt = ctx.store
      .list<StoredLaunchTemplate>()
      .filter((entry) => entry.key.startsWith("lt/"))
      .map((entry) => entry.value)
      .find((t) => t.LaunchTemplateName === launchTemplateName);
  }
  if (lt === undefined) {
    throw awsError(
      "InvalidLaunchTemplateId.NotFound",
      `The launch template ID or name does not exist`,
      400,
    );
  }
  for (let v = 1; v <= lt.LatestVersionNumber; v++) {
    ctx.store.delete(launchTemplateVersionKey(lt.LaunchTemplateId, v));
  }
  ctx.store.delete(launchTemplateKey(lt.LaunchTemplateId));
  return {
    LaunchTemplate: {
      LaunchTemplateId: lt.LaunchTemplateId,
      LaunchTemplateName: lt.LaunchTemplateName,
      DefaultVersionNumber: lt.DefaultVersionNumber,
      LatestVersionNumber: lt.LatestVersionNumber,
      CreateTime: lt.CreateTime,
      CreatedBy: lt.CreatedBy,
      Tags: lt.Tags,
    },
  };
};

const DeleteLaunchTemplateVersions: OperationHandler = (input, ctx) => {
  const launchTemplateId =
    typeof input["LaunchTemplateId"] === "string"
      ? input["LaunchTemplateId"]
      : undefined;
  const launchTemplateName =
    typeof input["LaunchTemplateName"] === "string"
      ? input["LaunchTemplateName"]
      : undefined;
  const versions = Array.isArray(input["Versions"])
    ? (input["Versions"] as unknown[]).map(String)
    : [];
  let lt: StoredLaunchTemplate | undefined;
  if (launchTemplateId !== undefined) {
    lt = ctx.store.get<StoredLaunchTemplate>(
      launchTemplateKey(launchTemplateId),
    );
  } else if (launchTemplateName !== undefined) {
    lt = ctx.store
      .list<StoredLaunchTemplate>()
      .filter((entry) => entry.key.startsWith("lt/"))
      .map((entry) => entry.value)
      .find((t) => t.LaunchTemplateName === launchTemplateName);
  }
  if (lt === undefined) {
    throw awsError(
      "InvalidLaunchTemplateId.NotFound",
      `The launch template ID or name does not exist`,
      400,
    );
  }
  const successfullyDeleted: Array<{
    LaunchTemplateId: string;
    LaunchTemplateName: string;
    VersionNumber: number;
  }> = [];
  const unsuccessfullyDeleted: Array<{
    LaunchTemplateId: string;
    LaunchTemplateName: string;
    VersionNumber: number;
    ResponseError: { Code: string; Message: string };
  }> = [];
  for (const versionStr of versions) {
    const versionNum = parseInt(versionStr, 10);
    if (isNaN(versionNum)) {
      unsuccessfullyDeleted.push({
        LaunchTemplateId: lt.LaunchTemplateId,
        LaunchTemplateName: lt.LaunchTemplateName,
        VersionNumber: 0,
        ResponseError: {
          Code: "InvalidLaunchTemplateId.VersionNotFound",
          Message: `Launch template version '${versionStr}' does not exist`,
        },
      });
      continue;
    }
    const vKey = launchTemplateVersionKey(lt.LaunchTemplateId, versionNum);
    const version = ctx.store.get<StoredLaunchTemplateVersion>(vKey);
    if (version === undefined) {
      unsuccessfullyDeleted.push({
        LaunchTemplateId: lt.LaunchTemplateId,
        LaunchTemplateName: lt.LaunchTemplateName,
        VersionNumber: versionNum,
        ResponseError: {
          Code: "InvalidLaunchTemplateId.VersionNotFound",
          Message: `Launch template version '${versionStr}' does not exist`,
        },
      });
      continue;
    }
    ctx.store.delete(vKey);
    successfullyDeleted.push({
      LaunchTemplateId: lt.LaunchTemplateId,
      LaunchTemplateName: lt.LaunchTemplateName,
      VersionNumber: versionNum,
    });
  }
  return {
    SuccessfullyDeletedLaunchTemplateVersions: successfullyDeleted,
    UnsuccessfullyDeletedLaunchTemplateVersions: unsuccessfullyDeleted,
  };
};

const DeleteLocalGatewayRoute: OperationHandler = (input, ctx) => {
  const localGatewayRouteTableId =
    typeof input["LocalGatewayRouteTableId"] === "string"
      ? input["LocalGatewayRouteTableId"]
      : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const routeKey = localGatewayRouteKey(
    localGatewayRouteTableId,
    destinationCidrBlock,
  );
  const route = ctx.store.get<StoredLocalGatewayRoute>(routeKey);
  if (route === undefined) {
    throw awsError(
      "InvalidRoute.NotFound",
      `No route with destination-cidr-block '${destinationCidrBlock}' in route table '${localGatewayRouteTableId}'`,
      400,
    );
  }
  ctx.store.delete(routeKey);
  return {
    Route: {
      DestinationCidrBlock: route.DestinationCidrBlock,
      LocalGatewayVirtualInterfaceGroupId:
        route.LocalGatewayVirtualInterfaceGroupId,
      Type: route.Type,
      State: route.State,
      LocalGatewayRouteTableId: route.LocalGatewayRouteTableId,
    },
  };
};

const DeleteLocalGatewayRouteTable: OperationHandler = (input, ctx) => {
  const id =
    typeof input["LocalGatewayRouteTableId"] === "string"
      ? input["LocalGatewayRouteTableId"]
      : "";
  const rtb = ctx.store.get<StoredLocalGatewayRouteTable>(
    localGatewayRouteTableKey(id),
  );
  if (rtb === undefined) {
    throw awsError(
      "InvalidLocalGatewayRouteTableID.NotFound",
      `The local gateway route table '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(localGatewayRouteTableKey(id));
  return {
    LocalGatewayRouteTable: {
      LocalGatewayRouteTableId: rtb.LocalGatewayRouteTableId,
      LocalGatewayRouteTableArn: rtb.LocalGatewayRouteTableArn,
      LocalGatewayId: rtb.LocalGatewayId,
      State: rtb.State,
      OwnerId: rtb.OwnerId,
      Tags: rtb.Tags,
    },
  };
};

const DeleteLocalGatewayRouteTableVirtualInterfaceGroupAssociation: OperationHandler =
  (input, ctx) => {
    const id =
      typeof input[
        "LocalGatewayRouteTableVirtualInterfaceGroupAssociationId"
      ] === "string"
        ? input["LocalGatewayRouteTableVirtualInterfaceGroupAssociationId"]
        : "";
    const assoc =
      ctx.store.get<StoredLocalGatewayRouteTableVirtualInterfaceGroupAssociation>(
        lgwVifGroupAssocKey(id),
      );
    if (assoc === undefined) {
      throw awsError(
        "InvalidLocalGatewayRouteTableVirtualInterfaceGroupAssociationId.NotFound",
        `The association '${id}' does not exist`,
        400,
      );
    }
    ctx.store.delete(lgwVifGroupAssocKey(id));
    return {
      LocalGatewayRouteTableVirtualInterfaceGroupAssociation: {
        LocalGatewayRouteTableVirtualInterfaceGroupAssociationId:
          assoc.LocalGatewayRouteTableVirtualInterfaceGroupAssociationId,
        LocalGatewayVirtualInterfaceGroupId:
          assoc.LocalGatewayVirtualInterfaceGroupId,
        LocalGatewayId: assoc.LocalGatewayId,
        LocalGatewayRouteTableId: assoc.LocalGatewayRouteTableId,
        LocalGatewayRouteTableArn: assoc.LocalGatewayRouteTableArn,
        OwnerId: assoc.OwnerId,
        State: assoc.State,
        Tags: assoc.Tags,
      },
    };
  };

const DeleteLocalGatewayRouteTableVpcAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["LocalGatewayRouteTableVpcAssociationId"] === "string"
      ? input["LocalGatewayRouteTableVpcAssociationId"]
      : "";
  const assoc = ctx.store.get<StoredLocalGatewayRouteTableVpcAssociation>(
    lgwVpcAssocKey(id),
  );
  if (assoc === undefined) {
    throw awsError(
      "InvalidLocalGatewayRouteTableVpcAssociationID.NotFound",
      `The association '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(lgwVpcAssocKey(id));
  return {
    LocalGatewayRouteTableVpcAssociation: {
      LocalGatewayRouteTableVpcAssociationId:
        assoc.LocalGatewayRouteTableVpcAssociationId,
      LocalGatewayRouteTableId: assoc.LocalGatewayRouteTableId,
      LocalGatewayRouteTableArn: assoc.LocalGatewayRouteTableArn,
      LocalGatewayId: assoc.LocalGatewayId,
      VpcId: assoc.VpcId,
      OwnerId: assoc.OwnerId,
      State: assoc.State,
      Tags: assoc.Tags,
    },
  };
};

const DeleteLocalGatewayVirtualInterface: OperationHandler = (input, ctx) => {
  const id =
    typeof input["LocalGatewayVirtualInterfaceId"] === "string"
      ? input["LocalGatewayVirtualInterfaceId"]
      : "";
  const vif = ctx.store.get<StoredLocalGatewayVirtualInterface>(lgwVifKey(id));
  if (vif === undefined) {
    throw awsError(
      "InvalidLocalGatewayVirtualInterfaceId.NotFound",
      `The local gateway virtual interface '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(lgwVifKey(id));
  return {
    LocalGatewayVirtualInterface: {
      LocalGatewayVirtualInterfaceId: vif.LocalGatewayVirtualInterfaceId,
      LocalGatewayId: vif.LocalGatewayId,
      LocalGatewayVirtualInterfaceGroupId:
        vif.LocalGatewayVirtualInterfaceGroupId,
      LocalGatewayVirtualInterfaceArn: vif.LocalGatewayVirtualInterfaceArn,
      OutpostLagId: vif.OutpostLagId,
      Vlan: vif.Vlan,
      LocalAddress: vif.LocalAddress,
      PeerAddress: vif.PeerAddress,
      LocalBgpAsn: vif.LocalBgpAsn,
      PeerBgpAsn: vif.PeerBgpAsn,
      OwnerId: vif.OwnerId,
      Tags: vif.Tags,
    },
  };
};

const DeleteLocalGatewayVirtualInterfaceGroup: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["LocalGatewayVirtualInterfaceGroupId"] === "string"
      ? input["LocalGatewayVirtualInterfaceGroupId"]
      : "";
  const group = ctx.store.get<StoredLocalGatewayVirtualInterfaceGroup>(
    lgwVifGroupKey(id),
  );
  if (group === undefined) {
    throw awsError(
      "InvalidLocalGatewayVirtualInterfaceGroupId.NotFound",
      `The local gateway virtual interface group '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(lgwVifGroupKey(id));
  return {
    LocalGatewayVirtualInterfaceGroup: {
      LocalGatewayVirtualInterfaceGroupId:
        group.LocalGatewayVirtualInterfaceGroupId,
      LocalGatewayVirtualInterfaceIds: group.LocalGatewayVirtualInterfaceIds,
      LocalGatewayId: group.LocalGatewayId,
      OwnerId: group.OwnerId,
      LocalBgpAsn: group.LocalBgpAsn,
      LocalGatewayVirtualInterfaceGroupArn:
        group.LocalGatewayVirtualInterfaceGroupArn,
      Tags: group.Tags,
    },
  };
};

const DeleteManagedPrefixList: OperationHandler = (input, ctx) => {
  const id =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const pl = ctx.store.get<StoredManagedPrefixList>(managedPrefixListKey(id));
  if (pl === undefined) {
    throw awsError(
      "InvalidPrefixListID.NotFound",
      `The prefix list '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(managedPrefixListKey(id));
  return {
    PrefixList: {
      PrefixListId: pl.PrefixListId,
      AddressFamily: pl.AddressFamily,
      State: "delete-complete",
      PrefixListArn: pl.PrefixListArn,
      PrefixListName: pl.PrefixListName,
      MaxEntries: pl.MaxEntries,
      Version: pl.Version,
      Tags: pl.Tags,
      OwnerId: pl.OwnerId,
    },
  };
};

const DeleteNetworkAcl: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkAclId"] === "string" ? input["NetworkAclId"] : "";
  const acl = ctx.store.get<StoredNetworkAcl>(networkAclKey(id));
  if (acl === undefined) {
    throw awsError(
      "InvalidNetworkAclID.NotFound",
      `The network ACL '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(networkAclKey(id));
  return {};
};

const DeleteNetworkAclEntry: OperationHandler = (input, ctx) => {
  const networkAclId =
    typeof input["NetworkAclId"] === "string" ? input["NetworkAclId"] : "";
  const ruleNumber =
    typeof input["RuleNumber"] === "number" ? input["RuleNumber"] : 0;
  const egress = typeof input["Egress"] === "boolean" ? input["Egress"] : false;
  const acl = ctx.store.get<StoredNetworkAcl>(networkAclKey(networkAclId));
  if (acl === undefined) {
    throw awsError(
      "InvalidNetworkAclID.NotFound",
      `The network ACL '${networkAclId}' does not exist`,
      400,
    );
  }
  acl.Entries = acl.Entries.filter(
    (e) => !(e.RuleNumber === ruleNumber && e.Egress === egress),
  );
  ctx.store.set(networkAclKey(networkAclId), acl);
  return {};
};

const DeleteNetworkInsightsAccessScope: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInsightsAccessScopeId"] === "string"
      ? input["NetworkInsightsAccessScopeId"]
      : "";
  const scope = ctx.store.get<StoredNetworkInsightsAccessScope>(
    niAccessScopeKey(id),
  );
  if (scope === undefined) {
    throw awsError(
      "InvalidNetworkInsightsAccessScopeId.NotFound",
      `The network insights access scope '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(niAccessScopeKey(id));
  return {
    NetworkInsightsAccessScopeId: id,
  };
};

const DeleteKeyPair: OperationHandler = (input, ctx) => {
  const keyPairId =
    typeof input["KeyPairId"] === "string" ? input["KeyPairId"] : undefined;
  const keyName =
    typeof input["KeyName"] === "string" ? input["KeyName"] : undefined;
  if (keyPairId !== undefined) {
    const found = allKeyPairs(ctx).find((kp) => kp.KeyPairId === keyPairId);
    if (found !== undefined) {
      ctx.store.delete(keyPairKey(found.KeyName));
    }
  } else if (keyName !== undefined) {
    ctx.store.delete(keyPairKey(keyName));
  }
  return {};
};

const DeleteNetworkInsightsAccessScopeAnalysis: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["NetworkInsightsAccessScopeAnalysisId"] === "string"
      ? input["NetworkInsightsAccessScopeAnalysisId"]
      : "";
  const analysis = ctx.store.get<StoredNetworkInsightsAccessScopeAnalysis>(
    niScopeAnalysisKey(id),
  );
  if (analysis === undefined) {
    throw awsError(
      "InvalidNetworkInsightsAccessScopeAnalysisId.NotFound",
      `The network insights access scope analysis '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(niScopeAnalysisKey(id));
  return { NetworkInsightsAccessScopeAnalysisId: id };
};

const DeleteNetworkInsightsAnalysis: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInsightsAnalysisId"] === "string"
      ? input["NetworkInsightsAnalysisId"]
      : "";
  const analysis = ctx.store.get<StoredNetworkInsightsAnalysis>(
    niAnalysisKey(id),
  );
  if (analysis === undefined) {
    throw awsError(
      "InvalidNetworkInsightsAnalysisId.NotFound",
      `The network insights analysis '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(niAnalysisKey(id));
  return { NetworkInsightsAnalysisId: id };
};

const DeleteNetworkInsightsPath: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInsightsPathId"] === "string"
      ? input["NetworkInsightsPathId"]
      : "";
  const path = ctx.store.get<StoredNetworkInsightsPath>(niPathKey(id));
  if (path === undefined) {
    throw awsError(
      "InvalidNetworkInsightsPathId.NotFound",
      `The network insights path '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(niPathKey(id));
  return { NetworkInsightsPathId: id };
};

const DeleteNetworkInterface: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const ni = ctx.store.get<StoredNetworkInterface>(networkInterfaceKey(id));
  if (ni === undefined) {
    throw awsError(
      "InvalidNetworkInterfaceID.NotFound",
      `The network interface '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(networkInterfaceKey(id));
  return {};
};

const DeleteNetworkInterfacePermission: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInterfacePermissionId"] === "string"
      ? input["NetworkInterfacePermissionId"]
      : "";
  const perm = ctx.store.get<StoredNetworkInterfacePermission>(
    niPermissionKey(id),
  );
  if (perm === undefined) {
    throw awsError(
      "InvalidNetworkInterfacePermissionID.NotFound",
      `The network interface permission '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(niPermissionKey(id));
  return { Return: true };
};

const DeletePlacementGroup: OperationHandler = (input, ctx) => {
  const groupName =
    typeof input["GroupName"] === "string" ? input["GroupName"] : "";
  const entry = ctx.store
    .list<StoredPlacementGroup>()
    .find((e) => e.key.startsWith("pg/") && e.value.GroupName === groupName);
  if (entry === undefined) {
    throw awsError(
      "InvalidPlacementGroup.Unknown",
      `The placement group '${groupName}' is unknown`,
      400,
    );
  }
  ctx.store.delete(entry.key);
  return {};
};

const DeletePublicIpv4Pool: OperationHandler = (input, ctx) => {
  const poolId = typeof input["PoolId"] === "string" ? input["PoolId"] : "";
  const pool = ctx.store.get<StoredPublicIpv4Pool>(publicIpv4PoolKey(poolId));
  if (pool === undefined) {
    throw awsError(
      "InvalidPublicIpv4PoolID.NotFound",
      `The public IPv4 pool '${poolId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(publicIpv4PoolKey(poolId));
  return { ReturnValue: true };
};

const DeleteQueuedReservedInstances: OperationHandler = (input, _ctx) => {
  const ids = Array.isArray(input["ReservedInstancesIds"])
    ? (input["ReservedInstancesIds"] as string[])
    : [];
  return {
    SuccessfulQueuedPurchaseDeletions: ids.map((id) => ({
      ReservedInstancesId: id,
    })),
    FailedQueuedPurchaseDeletions: [],
  };
};

const DeleteRoute: OperationHandler = (input, ctx) => {
  const routeTableId =
    typeof input["RouteTableId"] === "string" ? input["RouteTableId"] : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : undefined;
  const destinationIpv6CidrBlock =
    typeof input["DestinationIpv6CidrBlock"] === "string"
      ? input["DestinationIpv6CidrBlock"]
      : undefined;
  const destinationPrefixListId =
    typeof input["DestinationPrefixListId"] === "string"
      ? input["DestinationPrefixListId"]
      : undefined;
  const table = ctx.store.get<StoredRouteTable>(routeTableKey(routeTableId));
  if (table === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The route table '${routeTableId}' does not exist`,
      400,
    );
  }
  const dest =
    destinationCidrBlock ??
    destinationIpv6CidrBlock ??
    destinationPrefixListId ??
    "";
  table.Routes = table.Routes.filter((r) => r.DestinationCidrBlock !== dest);
  ctx.store.set(routeTableKey(routeTableId), table);
  return {};
};

const DeleteRouteServer: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const server = ctx.store.get<StoredRouteServer>(routeServerKey(id));
  if (server === undefined) {
    throw awsError(
      "InvalidRouteServerId.NotFound",
      `The route server '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(routeServerKey(id));
  return {
    RouteServer: {
      RouteServerId: server.RouteServerId,
      AmazonSideAsn: server.AmazonSideAsn,
      State: server.State,
      PersistRoutesState: server.PersistRoutesState,
      PersistRoutesDuration: server.PersistRoutesDuration,
      SnsNotificationsEnabled: server.SnsNotificationsEnabled,
      Tags: server.Tags,
    },
  };
};

const DeleteRouteServerEndpoint: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerEndpointId"] === "string"
      ? input["RouteServerEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredRouteServerEndpoint>(
    routeServerEndpointKey(id),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidRouteServerEndpointId.NotFound",
      `The route server endpoint '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(routeServerEndpointKey(id));
  return {
    RouteServerEndpoint: {
      RouteServerEndpointId: endpoint.RouteServerEndpointId,
      RouteServerId: endpoint.RouteServerId,
      VpcId: endpoint.VpcId,
      SubnetId: endpoint.SubnetId,
      EniId: endpoint.EniId,
      EniAddress: endpoint.EniAddress,
      State: endpoint.State,
      Tags: endpoint.Tags,
    },
  };
};

const DeleteRouteServerPeer: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerPeerId"] === "string"
      ? input["RouteServerPeerId"]
      : "";
  const peer = ctx.store.get<StoredRouteServerPeer>(routeServerPeerKey(id));
  if (peer === undefined) {
    throw awsError(
      "InvalidRouteServerPeerId.NotFound",
      `The route server peer '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(routeServerPeerKey(id));
  return {
    RouteServerPeer: {
      RouteServerPeerId: peer.RouteServerPeerId,
      RouteServerEndpointId: peer.RouteServerEndpointId,
      RouteServerId: peer.RouteServerId,
      VpcId: peer.VpcId,
      SubnetId: peer.SubnetId,
      State: peer.State,
      PeerAddress: peer.PeerAddress,
      EndpointEniId: peer.EndpointEniId,
      EndpointEniAddress: peer.EndpointEniAddress,
      Tags: peer.Tags,
    },
  };
};

const DeleteRouteTable: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteTableId"] === "string" ? input["RouteTableId"] : "";
  const table = ctx.store.get<StoredRouteTable>(routeTableKey(id));
  if (table === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The route table '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(routeTableKey(id));
  return {};
};

const DeleteSecondaryNetwork: OperationHandler = (input, ctx) => {
  const id =
    typeof input["SecondaryNetworkId"] === "string"
      ? input["SecondaryNetworkId"]
      : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const network = ctx.store.get<StoredSecondaryNetwork>(
    secondaryNetworkKey(id),
  );
  if (network === undefined) {
    throw awsError(
      "InvalidSecondaryNetworkId.NotFound",
      `The secondary network ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(secondaryNetworkKey(id));
  return {
    SecondaryNetwork: {
      SecondaryNetworkId: network.SecondaryNetworkId,
      SecondaryNetworkArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:secondary-network/${network.SecondaryNetworkId}`,
      OwnerId: ctx.account,
      Type: network.NetworkType,
      State: network.State,
      Ipv4CidrBlockAssociations: [
        {
          Ipv4CidrBlock: network.Ipv4CidrBlock,
          Ipv4CidrBlockState: { State: "associated" },
        },
      ],
      Tags: network.Tags,
    },
    ClientToken: clientToken,
  };
};

const DeleteSecondarySubnet: OperationHandler = (input, ctx) => {
  const id =
    typeof input["SecondarySubnetId"] === "string"
      ? input["SecondarySubnetId"]
      : "";
  const clientToken =
    typeof input["ClientToken"] === "string" ? input["ClientToken"] : undefined;
  const subnet = ctx.store.get<StoredSecondarySubnet>(secondarySubnetKey(id));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSecondarySubnetId.NotFound",
      `The secondary subnet ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(secondarySubnetKey(id));
  return {
    SecondarySubnet: {
      SecondarySubnetId: subnet.SecondarySubnetId,
      SecondarySubnetArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:secondary-subnet/${subnet.SecondarySubnetId}`,
      SecondaryNetworkId: subnet.SecondaryNetworkId,
      OwnerId: ctx.account,
      AvailabilityZone: subnet.AvailabilityZone,
      State: subnet.State,
      Ipv4CidrBlockAssociations: [
        {
          Ipv4CidrBlock: subnet.Ipv4CidrBlock,
          Ipv4CidrBlockState: { State: "associated" },
        },
      ],
      Tags: subnet.Tags,
    },
    ClientToken: clientToken,
  };
};

const DeleteSecurityGroup: OperationHandler = (input, ctx) => {
  const groupId =
    typeof input["GroupId"] === "string" ? input["GroupId"] : undefined;
  const groupName =
    typeof input["GroupName"] === "string" ? input["GroupName"] : undefined;
  let group: StoredSecurityGroup | undefined;
  if (groupId !== undefined) {
    group = ctx.store.get<StoredSecurityGroup>(sgKey(groupId));
    if (group === undefined) {
      throw awsError(
        "InvalidGroup.NotFound",
        `The security group '${groupId}' does not exist`,
        400,
      );
    }
    ctx.store.delete(sgKey(groupId));
  } else if (groupName !== undefined) {
    group = allSecurityGroups(ctx).find((g) => g.GroupName === groupName);
    if (group === undefined) {
      throw awsError(
        "InvalidGroup.NotFound",
        `The security group '${groupName}' does not exist`,
        400,
      );
    }
    ctx.store.delete(sgKey(group.GroupId));
  } else {
    throw awsError(
      "MissingParameter",
      "The request must contain either GroupId or GroupName",
      400,
    );
  }
  return {
    Return: true,
    GroupId: group.GroupId,
  };
};

const DeleteSpotDatafeedSubscription: OperationHandler = (_input, ctx) => {
  ctx.store.delete(spotDatafeedKey());
  return {};
};

const DeleteSubnetCidrReservation: OperationHandler = (input, ctx) => {
  const id =
    typeof input["SubnetCidrReservationId"] === "string"
      ? input["SubnetCidrReservationId"]
      : "";
  const reservation = ctx.store.get<StoredSubnetCidrReservation>(
    subnetCidrReservationKey(id),
  );
  if (reservation === undefined) {
    throw awsError(
      "InvalidSubnetCidrReservationID.NotFound",
      `The subnet CIDR reservation '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(subnetCidrReservationKey(id));
  return {
    DeletedSubnetCidrReservation: {
      SubnetCidrReservationId: reservation.SubnetCidrReservationId,
      SubnetId: reservation.SubnetId,
      Cidr: reservation.Cidr,
      ReservationType: reservation.ReservationType,
      OwnerId: reservation.OwnerId,
      Description: reservation.Description,
      Tags: reservation.Tags,
    },
  };
};

const DeleteTags: OperationHandler = (input, ctx) => {
  const resources = stringList(input["Resources"]);
  const tags = tagList(input["Tags"]);
  for (const resourceId of resources) {
    const resource = resourceTagTarget(ctx, resourceId);
    if (resource === undefined) continue;
    if (tags.length === 0) {
      resource.Tags = [];
    } else {
      resource.Tags = resource.Tags.filter(
        (existing) =>
          !tags.some(
            (t) =>
              t.Key === existing.Key &&
              (t.Value === "" || t.Value === existing.Value),
          ),
      );
    }
    persistResource(ctx, resourceId, resource);
  }
  return {};
};

const DeleteTrafficMirrorFilter: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TrafficMirrorFilterId"] === "string"
      ? input["TrafficMirrorFilterId"]
      : "";
  const filter = ctx.store.get<StoredTrafficMirrorFilter>(
    trafficMirrorFilterKey(id),
  );
  if (filter === undefined) {
    throw awsError(
      "InvalidTrafficMirrorFilterId.NotFound",
      `The Traffic Mirror filter '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(trafficMirrorFilterKey(id));
  return { TrafficMirrorFilterId: id };
};

const DeleteTrafficMirrorFilterRule: OperationHandler = (input, ctx) => {
  const ruleId =
    typeof input["TrafficMirrorFilterRuleId"] === "string"
      ? input["TrafficMirrorFilterRuleId"]
      : "";
  const rule = ctx.store.get<StoredTrafficMirrorFilterRule>(
    trafficMirrorFilterRuleKey(ruleId),
  );
  if (rule === undefined) {
    throw awsError(
      "InvalidTrafficMirrorFilterRuleId.NotFound",
      `The Traffic Mirror filter rule '${ruleId}' does not exist`,
      400,
    );
  }
  const filterId = rule.TrafficMirrorFilterId;
  const filter = ctx.store.get<StoredTrafficMirrorFilter>(
    trafficMirrorFilterKey(filterId),
  );
  if (filter !== undefined) {
    filter.IngressFilterRules = filter.IngressFilterRules.filter(
      (r) => r.TrafficMirrorFilterRuleId !== ruleId,
    );
    filter.EgressFilterRules = filter.EgressFilterRules.filter(
      (r) => r.TrafficMirrorFilterRuleId !== ruleId,
    );
    ctx.store.set(trafficMirrorFilterKey(filterId), filter);
  }
  ctx.store.delete(trafficMirrorFilterRuleKey(ruleId));
  return { TrafficMirrorFilterRuleId: ruleId };
};

const DeleteTrafficMirrorSession: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TrafficMirrorSessionId"] === "string"
      ? input["TrafficMirrorSessionId"]
      : "";
  const session = ctx.store.get<StoredTrafficMirrorSession>(
    trafficMirrorSessionKey(id),
  );
  if (session === undefined) {
    throw awsError(
      "InvalidTrafficMirrorSessionId.NotFound",
      `The Traffic Mirror session '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(trafficMirrorSessionKey(id));
  return { TrafficMirrorSessionId: id };
};

const DeleteTrafficMirrorTarget: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TrafficMirrorTargetId"] === "string"
      ? input["TrafficMirrorTargetId"]
      : "";
  const target = ctx.store.get<StoredTrafficMirrorTarget>(
    trafficMirrorTargetKey(id),
  );
  if (target === undefined) {
    throw awsError(
      "InvalidTrafficMirrorTargetId.NotFound",
      `The Traffic Mirror target '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(trafficMirrorTargetKey(id));
  return { TrafficMirrorTargetId: id };
};

const DeleteTransitGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredTransitGateway>(transitGatewayKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidTransitGatewayID.NotFound",
      `The transit gateway '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayKey(id));
  return {
    TransitGateway: {
      TransitGatewayId: gateway.TransitGatewayId,
      TransitGatewayArn: gateway.TransitGatewayArn,
      State: "deleted",
      OwnerId: gateway.OwnerId,
      Description: gateway.Description,
      CreationTime: gateway.CreationTime,
      Options: gateway.Options,
      Tags: gateway.Tags,
    },
  };
};

const DeleteTransitGatewayClientVpnAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const stored = ctx.store.get<StoredTgwAttachment>(tgwAttachmentKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidTransitGatewayAttachmentID.NotFound",
      `The transit gateway attachment '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(tgwAttachmentKey(id));
  return {
    TransitGatewayClientVpnAttachment: {
      TransitGatewayAttachmentId: stored.TransitGatewayAttachmentId,
      TransitGatewayId: stored.TransitGatewayId,
      ClientVpnEndpointId: stored.ResourceId,
      Region: ctx.region,
      Status: { Code: "deleted", Message: "" },
      State: "deleted",
      Tags: stored.Tags,
    },
  };
};

const DeleteTransitGatewayConnect: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const connect = ctx.store.get<StoredTransitGatewayConnect>(
    transitGatewayConnectKey(id),
  );
  if (connect === undefined) {
    throw awsError(
      "InvalidTransitGatewayAttachmentID.NotFound",
      `The transit gateway attachment '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayConnectKey(id));
  return {
    TransitGatewayConnect: {
      TransitGatewayAttachmentId: connect.TransitGatewayAttachmentId,
      TransportTransitGatewayAttachmentId:
        connect.TransportTransitGatewayAttachmentId,
      TransitGatewayId: connect.TransitGatewayId,
      State: "deleted",
      CreationTime: connect.CreationTime,
      Options: connect.Options,
      Tags: connect.Tags,
    },
  };
};

const DeleteTransitGatewayConnectPeer: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayConnectPeerId"] === "string"
      ? input["TransitGatewayConnectPeerId"]
      : "";
  const peer = ctx.store.get<StoredTransitGatewayConnectPeer>(
    transitGatewayConnectPeerKey(id),
  );
  if (peer === undefined) {
    throw awsError(
      "InvalidTransitGatewayConnectPeerID.NotFound",
      `The transit gateway connect peer '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayConnectPeerKey(id));
  return {
    TransitGatewayConnectPeer: {
      TransitGatewayAttachmentId: peer.TransitGatewayAttachmentId,
      TransitGatewayConnectPeerId: peer.TransitGatewayConnectPeerId,
      State: "deleted",
      CreationTime: peer.CreationTime,
      ConnectPeerConfiguration: peer.ConnectPeerConfiguration,
      Tags: peer.Tags,
    },
  };
};

const DeleteTransitGatewayMeteringPolicy: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayMeteringPolicyId"] === "string"
      ? input["TransitGatewayMeteringPolicyId"]
      : "";
  const policy = ctx.store.get<StoredTransitGatewayMeteringPolicy>(
    transitGatewayMeteringPolicyKey(id),
  );
  if (policy === undefined) {
    throw awsError(
      "InvalidTransitGatewayMeteringPolicyID.NotFound",
      `The transit gateway metering policy '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayMeteringPolicyKey(id));
  return {
    TransitGatewayMeteringPolicy: {
      TransitGatewayMeteringPolicyId: policy.TransitGatewayMeteringPolicyId,
      TransitGatewayId: policy.TransitGatewayId,
      MiddleboxAttachmentIds: policy.MiddleboxAttachmentIds,
      State: "deleted",
      UpdateEffectiveAt: policy.UpdateEffectiveAt,
      Tags: policy.Tags,
    },
  };
};

const DeleteTransitGatewayMeteringPolicyEntry: OperationHandler = (
  input,
  ctx,
) => {
  const policyId =
    typeof input["TransitGatewayMeteringPolicyId"] === "string"
      ? input["TransitGatewayMeteringPolicyId"]
      : "";
  const ruleNumber =
    typeof input["PolicyRuleNumber"] === "number"
      ? String(input["PolicyRuleNumber"])
      : "";
  const entry = ctx.store.get<StoredTransitGatewayMeteringPolicyEntry>(
    transitGatewayMeteringPolicyEntryKey(policyId, ruleNumber),
  );
  if (entry === undefined) {
    throw awsError(
      "InvalidTransitGatewayMeteringPolicyEntryID.NotFound",
      `The transit gateway metering policy entry '${policyId}/${ruleNumber}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayMeteringPolicyEntryKey(policyId, ruleNumber));
  return {
    TransitGatewayMeteringPolicyEntry: {
      PolicyRuleNumber: entry.PolicyRuleNumber,
      MeteredAccount: entry.MeteredAccount,
      State: "deleted",
      UpdatedAt: entry.UpdatedAt,
      UpdateEffectiveAt: entry.UpdateEffectiveAt,
      MeteringPolicyRule: entry.MeteringPolicyRule,
    },
  };
};

const DeleteTransitGatewayMulticastDomain: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : "";
  const domain = ctx.store.get<StoredTransitGatewayMulticastDomain>(
    transitGatewayMulticastDomainKey(id),
  );
  if (domain === undefined) {
    throw awsError(
      "InvalidTransitGatewayMulticastDomainId.NotFound",
      `The transit gateway multicast domain '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayMulticastDomainKey(id));
  return {
    TransitGatewayMulticastDomain: {
      TransitGatewayMulticastDomainId: domain.TransitGatewayMulticastDomainId,
      TransitGatewayId: domain.TransitGatewayId,
      TransitGatewayMulticastDomainArn: domain.TransitGatewayMulticastDomainArn,
      OwnerId: domain.OwnerId,
      Options: domain.Options,
      State: "deleted",
      CreationTime: domain.CreationTime,
      Tags: domain.Tags,
    },
  };
};

const DeleteTransitGatewayPeeringAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const attachment = ctx.store.get<StoredTransitGatewayPeeringAttachment>(
    transitGatewayPeeringAttachmentKey(id),
  );
  if (attachment === undefined) {
    throw awsError(
      "InvalidTransitGatewayAttachmentID.NotFound",
      `The transit gateway attachment '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayPeeringAttachmentKey(id));
  return {
    TransitGatewayPeeringAttachment: {
      TransitGatewayAttachmentId: attachment.TransitGatewayAttachmentId,
      AccepterTransitGatewayAttachmentId:
        attachment.AccepterTransitGatewayAttachmentId,
      RequesterTgwInfo: attachment.RequesterTgwInfo,
      AccepterTgwInfo: attachment.AccepterTgwInfo,
      Options: attachment.Options,
      Status: attachment.Status,
      State: "deleted",
      CreationTime: attachment.CreationTime,
      Tags: attachment.Tags,
    },
  };
};

const DeleteTransitGatewayPolicyTable: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayPolicyTableId"] === "string"
      ? input["TransitGatewayPolicyTableId"]
      : "";
  const table = ctx.store.get<StoredTransitGatewayPolicyTable>(
    transitGatewayPolicyTableKey(id),
  );
  if (table === undefined) {
    throw awsError(
      "InvalidTransitGatewayPolicyTableID.NotFound",
      `The transit gateway policy table '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayPolicyTableKey(id));
  return {
    TransitGatewayPolicyTable: {
      TransitGatewayPolicyTableId: table.TransitGatewayPolicyTableId,
      TransitGatewayId: table.TransitGatewayId,
      State: "deleted",
      CreationTime: table.CreationTime,
      Tags: table.Tags,
    },
  };
};

const DeleteTransitGatewayPrefixListReference: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const prefixListId =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const ref = ctx.store.get<StoredTransitGatewayPrefixListReference>(
    transitGatewayPrefixListReferenceKey(routeTableId, prefixListId),
  );
  if (ref === undefined) {
    throw awsError(
      "InvalidTransitGatewayPrefixListReferenceID.NotFound",
      `The transit gateway prefix list reference '${prefixListId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(
    transitGatewayPrefixListReferenceKey(routeTableId, prefixListId),
  );
  return {
    TransitGatewayPrefixListReference: {
      TransitGatewayRouteTableId: ref.TransitGatewayRouteTableId,
      PrefixListId: ref.PrefixListId,
      PrefixListOwnerId: ref.PrefixListOwnerId,
      State: "deleted",
      Blackhole: ref.Blackhole,
      TransitGatewayAttachment: ref.TransitGatewayAttachment,
    },
  };
};

const DeleteTransitGatewayRoute: OperationHandler = (input, ctx) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const route = ctx.store.get<StoredTransitGatewayRoute>(
    transitGatewayRouteKey(routeTableId, destinationCidrBlock),
  );
  if (route === undefined) {
    throw awsError(
      "InvalidRoute.NotFound",
      `The route '${destinationCidrBlock}' does not exist in route table '${routeTableId}'`,
      400,
    );
  }
  ctx.store.delete(transitGatewayRouteKey(routeTableId, destinationCidrBlock));
  return {
    Route: {
      DestinationCidrBlock: route.DestinationCidrBlock,
      TransitGatewayAttachments: route.TransitGatewayAttachmentId
        ? [
            {
              TransitGatewayAttachmentId: route.TransitGatewayAttachmentId,
              ResourceType: "vpc",
            },
          ]
        : [],
      Type: route.Type,
      State: "deleted",
    },
  };
};

const DeleteTransitGatewayRouteTable: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const rtb = ctx.store.get<StoredTransitGatewayRouteTable>(
    transitGatewayRouteTableKey(id),
  );
  if (rtb === undefined) {
    throw awsError(
      "InvalidTransitGatewayRouteTableID.NotFound",
      `The transit gateway route table '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayRouteTableKey(id));
  return {
    TransitGatewayRouteTable: {
      TransitGatewayRouteTableId: rtb.TransitGatewayRouteTableId,
      TransitGatewayId: rtb.TransitGatewayId,
      State: "deleted",
      DefaultAssociationRouteTable: rtb.DefaultAssociationRouteTable,
      DefaultPropagationRouteTable: rtb.DefaultPropagationRouteTable,
      CreationTime: rtb.CreationTime,
      Tags: rtb.Tags,
    },
  };
};

const DeleteTransitGatewayRouteTableAnnouncement: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["TransitGatewayRouteTableAnnouncementId"] === "string"
      ? input["TransitGatewayRouteTableAnnouncementId"]
      : "";
  const announcement =
    ctx.store.get<StoredTransitGatewayRouteTableAnnouncement>(
      transitGatewayRouteTableAnnouncementKey(id),
    );
  if (announcement === undefined) {
    throw awsError(
      "InvalidTransitGatewayRouteTableAnnouncementId.NotFound",
      `The transit gateway route table announcement '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayRouteTableAnnouncementKey(id));
  return {
    TransitGatewayRouteTableAnnouncement: {
      TransitGatewayRouteTableAnnouncementId:
        announcement.TransitGatewayRouteTableAnnouncementId,
      TransitGatewayId: announcement.TransitGatewayId,
      PeerTransitGatewayId: announcement.PeerTransitGatewayId,
      PeeringAttachmentId: announcement.PeeringAttachmentId,
      AnnouncementDirection: announcement.AnnouncementDirection,
      TransitGatewayRouteTableId: announcement.TransitGatewayRouteTableId,
      State: "deleted",
      CreationTime: announcement.CreationTime,
      Tags: announcement.Tags,
    },
  };
};

const DeleteTransitGatewayVpcAttachment: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const stored = ctx.store.get<StoredTransitGatewayVpcAttachment>(
    transitGatewayVpcAttachmentKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidTransitGatewayAttachmentID.NotFound",
      `The transit gateway attachment '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(transitGatewayVpcAttachmentKey(id));
  return {
    TransitGatewayVpcAttachment: {
      TransitGatewayAttachmentId: stored.TransitGatewayAttachmentId,
      TransitGatewayId: stored.TransitGatewayId,
      VpcId: stored.VpcId,
      VpcOwnerId: stored.VpcOwnerId,
      State: "deleted",
      SubnetIds: stored.SubnetIds,
      CreationTime: stored.CreationTime,
      Options: stored.Options,
      Tags: stored.Tags,
    },
  };
};

const DeleteVerifiedAccessEndpoint: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessEndpointId"] === "string"
      ? input["VerifiedAccessEndpointId"]
      : "";
  const stored = ctx.store.get<StoredVerifiedAccessEndpoint>(
    verifiedAccessEndpointKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVerifiedAccessEndpointId.NotFound",
      `The verified access endpoint '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(verifiedAccessEndpointKey(id));
  return {
    VerifiedAccessEndpoint: {
      VerifiedAccessInstanceId: stored.VerifiedAccessInstanceId,
      VerifiedAccessGroupId: stored.VerifiedAccessGroupId,
      VerifiedAccessEndpointId: stored.VerifiedAccessEndpointId,
      ApplicationDomain: stored.ApplicationDomain,
      EndpointType: stored.EndpointType,
      AttachmentType: stored.AttachmentType,
      DomainCertificateArn: stored.DomainCertificateArn,
      EndpointDomain: stored.EndpointDomain,
      SecurityGroupIds: stored.SecurityGroupIds,
      Status: { Code: "deleted", Message: "" },
      Description: stored.Description,
      CreationTime: stored.CreationTime,
      LastUpdatedTime: stored.LastUpdatedTime,
      Tags: stored.Tags,
    },
  };
};

const DeleteVerifiedAccessGroup: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessGroupId"] === "string"
      ? input["VerifiedAccessGroupId"]
      : "";
  const stored = ctx.store.get<StoredVerifiedAccessGroup>(
    verifiedAccessGroupKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVerifiedAccessGroupId.NotFound",
      `The verified access group '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(verifiedAccessGroupKey(id));
  return {
    VerifiedAccessGroup: {
      VerifiedAccessGroupId: stored.VerifiedAccessGroupId,
      VerifiedAccessInstanceId: stored.VerifiedAccessInstanceId,
      Description: stored.Description,
      Owner: stored.Owner,
      VerifiedAccessGroupArn: stored.VerifiedAccessGroupArn,
      CreationTime: stored.CreationTime,
      LastUpdatedTime: stored.LastUpdatedTime,
      Tags: stored.Tags,
    },
  };
};

const DeleteVerifiedAccessInstance: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const stored = ctx.store.get<StoredVerifiedAccessInstance>(vaInstanceKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVerifiedAccessInstanceId.NotFound",
      `The verified access instance '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vaInstanceKey(id));
  return {
    VerifiedAccessInstance: {
      VerifiedAccessInstanceId: stored.VerifiedAccessInstanceId,
      Description: stored.Description,
      VerifiedAccessTrustProviders: stored.TrustProviderIds.map((pid) => ({
        VerifiedAccessTrustProviderId: pid,
      })),
      CreationTime: stored.CreationTime,
      LastUpdatedTime: stored.LastUpdatedTime,
      Tags: stored.Tags,
      FipsEnabled: stored.FipsEnabled,
    },
  };
};

const DeleteVerifiedAccessTrustProvider: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessTrustProviderId"] === "string"
      ? input["VerifiedAccessTrustProviderId"]
      : "";
  const stored = ctx.store.get<StoredVerifiedAccessTrustProvider>(
    vaTrustProviderKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVerifiedAccessTrustProviderId.NotFound",
      `The verified access trust provider '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vaTrustProviderKey(id));
  return {
    VerifiedAccessTrustProvider: {
      VerifiedAccessTrustProviderId: stored.VerifiedAccessTrustProviderId,
      TrustProviderType: stored.TrustProviderType,
      PolicyReferenceName: stored.PolicyReferenceName,
      CreationTime: stored.CreationTime,
      LastUpdatedTime: stored.LastUpdatedTime,
      Tags: [],
    },
  };
};

const DeleteVpcBlockPublicAccessExclusion: OperationHandler = (input, ctx) => {
  const id =
    typeof input["ExclusionId"] === "string" ? input["ExclusionId"] : "";
  const stored = ctx.store.get<StoredVpcBlockPublicAccessExclusion>(
    vpcBlockPublicAccessExclusionKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcBlockPublicAccessExclusionId.NotFound",
      `The VPC block public access exclusion '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpcBlockPublicAccessExclusionKey(id));
  return {
    VpcBlockPublicAccessExclusion: {
      ExclusionId: stored.ExclusionId,
      InternetGatewayExclusionMode: stored.InternetGatewayExclusionMode,
      ResourceArn: stored.ResourceArn,
      State: "delete-complete",
      CreationTimestamp: stored.CreationTimestamp,
      LastUpdateTimestamp: stored.LastUpdateTimestamp,
      Tags: stored.Tags,
    },
  };
};

const DeleteVpcEncryptionControl: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpcEncryptionControlId"] === "string"
      ? input["VpcEncryptionControlId"]
      : "";
  const stored = ctx.store.get<StoredVpcEncryptionControl>(
    vpcEncryptionControlKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcEncryptionControlId.NotFound",
      `The VPC encryption control '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpcEncryptionControlKey(id));
  return {
    VpcEncryptionControl: {
      VpcEncryptionControlId: stored.VpcEncryptionControlId,
      VpcId: stored.VpcId,
      Mode: stored.Mode,
      State: "deleting",
      Tags: stored.Tags,
    },
  };
};

const DeleteVpcEndpointConnectionNotifications: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["ConnectionNotificationIds"]);
  const unsuccessful: {
    Error: { Code: string; Message: string };
    ResourceId: string;
  }[] = [];
  for (const id of ids) {
    const stored = ctx.store.get<StoredVpcEndpointConnectionNotification>(
      vpcEndpointConnectionNotificationKey(id),
    );
    if (stored === undefined) {
      unsuccessful.push({
        Error: {
          Code: "InvalidConnectionNotification.NotFound",
          Message: `The connection notification '${id}' does not exist`,
        },
        ResourceId: id,
      });
    } else {
      ctx.store.delete(vpcEndpointConnectionNotificationKey(id));
    }
  }
  return { Unsuccessful: unsuccessful };
};

const DeleteVpcEndpointServiceConfigurations: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["ServiceIds"]);
  const unsuccessful: {
    Error: { Code: string; Message: string };
    ResourceId: string;
  }[] = [];
  for (const id of ids) {
    const stored = ctx.store.get<StoredVpcEndpointServiceConfiguration>(
      vpcEndpointServiceConfigKey(id),
    );
    if (stored === undefined) {
      unsuccessful.push({
        Error: {
          Code: "InvalidVpcEndpointService.NotFound",
          Message: `The VPC endpoint service '${id}' does not exist`,
        },
        ResourceId: id,
      });
    } else {
      ctx.store.delete(vpcEndpointServiceConfigKey(id));
    }
  }
  return { Unsuccessful: unsuccessful };
};

const DeleteVpcEndpoints: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpcEndpointIds"]);
  const unsuccessful: {
    Error: { Code: string; Message: string };
    ResourceId: string;
  }[] = [];
  for (const id of ids) {
    const stored = ctx.store.get<StoredVpcEndpoint>(vpcEndpointKey(id));
    if (stored === undefined) {
      unsuccessful.push({
        Error: {
          Code: "InvalidVpcEndpointId.NotFound",
          Message: `The VPC endpoint '${id}' does not exist`,
        },
        ResourceId: id,
      });
    } else {
      ctx.store.delete(vpcEndpointKey(id));
    }
  }
  return { Unsuccessful: unsuccessful };
};

const DeleteVpcPeeringConnection: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpcPeeringConnectionId"] === "string"
      ? input["VpcPeeringConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpcPeeringConnection>(vpcPeeringKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcPeeringConnectionID.NotFound",
      `The VPC peering connection '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpcPeeringKey(id));
  return { Return: true };
};

const DeleteVpnConcentrator: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnConcentratorId"] === "string"
      ? input["VpnConcentratorId"]
      : "";
  const stored = ctx.store.get<StoredVpnConcentrator>(vpnConcentratorKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnConcentratorId.NotFound",
      `The VPN concentrator '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpnConcentratorKey(id));
  return { Return: true };
};

const DeleteVpnConnection: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpnConnection>(vpnConnectionKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpnConnectionKey(id));
  return {};
};

const DeleteVpnConnectionRoute: OperationHandler = (input, ctx) => {
  const vpnConnectionId =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const conn = ctx.store.get<StoredVpnConnection>(
    vpnConnectionKey(vpnConnectionId),
  );
  if (conn === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${vpnConnectionId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(
    vpnConnectionRouteKey(vpnConnectionId, destinationCidrBlock),
  );
  return {};
};

const DeleteVpnGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnGatewayId"] === "string" ? input["VpnGatewayId"] : "";
  const stored = ctx.store.get<StoredVpnGateway>(vpnGwKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnGatewayID.NotFound",
      `The virtual private gateway ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(vpnGwKey(id));
  return {};
};

const DeprovisionByoipCidr: OperationHandler = (input, ctx) => {
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  ctx.store.delete(byoipCidrKey(cidr));
  return {
    ByoipCidr: {
      Cidr: cidr,
      State: "deprovisioned",
      StatusMessage: "Deprovisioned",
      AsnAssociations: [],
    },
  };
};

const DeprovisionIpamByoasn: OperationHandler = (input, ctx) => {
  const ipamId = typeof input["IpamId"] === "string" ? input["IpamId"] : "";
  const asn = typeof input["Asn"] === "string" ? input["Asn"] : "";
  const stored = ctx.store.get<StoredIpamByoasnAssociation>(
    ipamByoasnKey(ipamId, asn),
  );
  ctx.store.delete(ipamByoasnKey(ipamId, asn));
  return {
    Byoasn: {
      Asn: stored?.Asn ?? asn,
      IpamId: stored?.IpamId ?? ipamId,
      IpamArn:
        stored?.IpamArn ??
        `arn:aws:ec2:${ctx.region}:${ctx.account}:ipam/${ipamId}`,
      StatusMessage: "BYOASN deprovisioned",
      State: "deprovision-complete",
    },
  };
};

const DeprovisionIpamPoolCidr: OperationHandler = (input, ctx) => {
  const poolId =
    typeof input["IpamPoolId"] === "string" ? input["IpamPoolId"] : "";
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  ctx.store.delete(ipamPoolCidrKey(poolId, cidr));
  return {
    IpamPoolCidr: {
      Cidr: cidr,
      State: "deprovisioned",
    },
  };
};

const DeprovisionPublicIpv4PoolCidr: OperationHandler = (input, ctx) => {
  const poolId = typeof input["PoolId"] === "string" ? input["PoolId"] : "";
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  ctx.store.delete(publicIpv4PoolCidrKey(poolId, cidr));
  return {
    PoolId: poolId,
    DeprovisionedAddresses: [],
  };
};

const DeregisterImage: OperationHandler = (input, ctx) => {
  const id = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(id));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image ID '${id}' does not exist`,
      400,
    );
  }
  ctx.store.delete(imageKey(id));
  ctx.store.set(imageBinKey(id), image);
  return { Return: true, DeleteSnapshotResults: [] };
};

const DeregisterInstanceEventNotificationAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const attr =
    typeof input["InstanceTagAttribute"] === "object" &&
    input["InstanceTagAttribute"] !== null
      ? (input["InstanceTagAttribute"] as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const includeAll = attr["IncludeAllTagsOfInstance"] === true;
  const keysToRemove = Array.isArray(attr["InstanceTagKeys"])
    ? (attr["InstanceTagKeys"] as string[])
    : [];
  type StoredIen = {
    InstanceTagKeys: string[];
    IncludeAllTagsOfInstance: boolean;
  };
  const existing = ctx.store.get<StoredIen>(instanceEventNotificationKey()) ?? {
    InstanceTagKeys: [],
    IncludeAllTagsOfInstance: false,
  };
  const remaining = includeAll
    ? []
    : existing.InstanceTagKeys.filter((k) => !keysToRemove.includes(k));
  ctx.store.set(instanceEventNotificationKey(), {
    InstanceTagKeys: remaining,
    IncludeAllTagsOfInstance: false,
  });
  return {
    InstanceTagAttribute: {
      InstanceTagKeys: remaining,
      IncludeAllTagsOfInstance: false,
    },
  };
};

const DeregisterTransitGatewayMulticastGroupMembers: OperationHandler = (
  input,
  ctx,
) => {
  const domainId =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : "";
  const groupIp =
    typeof input["GroupIpAddress"] === "string" ? input["GroupIpAddress"] : "";
  const niIds = Array.isArray(input["NetworkInterfaceIds"])
    ? (input["NetworkInterfaceIds"] as string[])
    : [];
  for (const niId of niIds) {
    ctx.store.delete(tgwMcastMemberKey(domainId, groupIp, niId));
  }
  return {
    DeregisteredMulticastGroupMembers: {
      TransitGatewayMulticastDomainId: domainId,
      DeregisteredNetworkInterfaceIds: niIds,
      GroupIpAddress: groupIp,
    },
  };
};

const DeregisterTransitGatewayMulticastGroupSources: OperationHandler = (
  input,
  ctx,
) => {
  const domainId =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : "";
  const groupIp =
    typeof input["GroupIpAddress"] === "string" ? input["GroupIpAddress"] : "";
  const niIds = Array.isArray(input["NetworkInterfaceIds"])
    ? (input["NetworkInterfaceIds"] as string[])
    : [];
  for (const niId of niIds) {
    ctx.store.delete(tgwMcastSourceKey(domainId, groupIp, niId));
  }
  return {
    DeregisteredMulticastGroupSources: {
      TransitGatewayMulticastDomainId: domainId,
      DeregisteredNetworkInterfaceIds: niIds,
      GroupIpAddress: groupIp,
    },
  };
};

const allBundleTasks = (ctx: ServiceContext): StoredBundleTask[] =>
  ctx.store
    .list<StoredBundleTask>()
    .filter((entry) => entry.key.startsWith("bundle/"))
    .map((entry) => entry.value);

const allCapacityManagerDataExports = (
  ctx: ServiceContext,
): StoredCapacityManagerDataExport[] =>
  ctx.store
    .list<StoredCapacityManagerDataExport>()
    .filter((entry) => entry.key.startsWith("cmde/"))
    .map((entry) => entry.value);

const DescribeAddressTransfers: OperationHandler = (_input, _ctx) => {
  return { AddressTransfers: [] };
};

const DescribeAddressesAttribute: OperationHandler = (input, ctx) => {
  const allocationIds = stringList(input["AllocationIds"]);
  const addresses = allAddresses(ctx).filter(
    (a) => allocationIds.length === 0 || allocationIds.includes(a.AllocationId),
  );
  return {
    Addresses: addresses.map((a) => ({
      AllocationId: a.AllocationId,
      PublicIp: a.PublicIp,
      PtrRecord: `ec2-${a.PublicIp.replace(/\./g, "-")}.compute-1.amazonaws.com`,
    })),
  };
};

const DescribeAggregateIdFormat: OperationHandler = (_input, _ctx) => {
  return { UseLongIdsAggregated: true, Statuses: [] };
};

const DescribeAwsNetworkPerformanceMetricSubscriptions: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Subscriptions: [] };
};

const DescribeBundleTasks: OperationHandler = (input, ctx) => {
  const bundleIds = stringList(input["BundleIds"]);
  const tasks = allBundleTasks(ctx).filter(
    (t) => bundleIds.length === 0 || bundleIds.includes(t.BundleId),
  );
  return {
    BundleTasks: tasks.map((t) => ({
      BundleId: t.BundleId,
      InstanceId: t.InstanceId,
      State: t.State,
      StartTime: t.StartTime,
      UpdateTime: t.UpdateTime,
      Progress: t.Progress,
      Storage: {},
    })),
  };
};

const DescribeByoipCidrs: OperationHandler = (_input, ctx) => {
  const cidrs = ctx.store
    .list<{ Cidr: string; State: string }>()
    .filter((entry) => entry.key.startsWith("byoip-cidr/"))
    .map((entry) => entry.value);
  return {
    ByoipCidrs: cidrs.map((c) => ({
      Cidr: c.Cidr,
      State: c.State,
      StatusMessage: "",
      AsnAssociations: [],
    })),
  };
};

const DescribeCapacityBlockExtensionHistory: OperationHandler = (
  _input,
  _ctx,
) => {
  return { CapacityBlockExtensions: [] };
};

const DescribeCapacityBlockExtensionOfferings: OperationHandler = (
  input,
  _ctx,
) => {
  const reservationId =
    typeof input["CapacityReservationId"] === "string"
      ? input["CapacityReservationId"]
      : "cr-placeholder";
  const durationHours =
    typeof input["CapacityBlockExtensionDurationHours"] === "number"
      ? input["CapacityBlockExtensionDurationHours"]
      : 24;
  return {
    CapacityBlockExtensionOfferings: [
      {
        CapacityBlockExtensionOfferingId: `cbo-ext-${reservationId.slice(-8)}`,
        InstanceType: "p4d.24xlarge",
        InstanceCount: 1,
        AvailabilityZone: "us-east-1a",
        AvailabilityZoneId: "use1-az1",
        StartDate: new Date().toISOString(),
        CapacityBlockExtensionStartDate: new Date().toISOString(),
        CapacityBlockExtensionEndDate: new Date(
          Date.now() + durationHours * 3600 * 1000,
        ).toISOString(),
        CapacityBlockExtensionDurationHours: durationHours,
        UpfrontFee: { Amount: "0.00", CurrencyCode: "USD" },
        Tenancy: "default",
      },
    ],
  };
};

const DescribeCapacityBlockOfferings: OperationHandler = (input, _ctx) => {
  const instanceType =
    typeof input["InstanceType"] === "string"
      ? input["InstanceType"]
      : "p4d.24xlarge";
  const durationHours =
    typeof input["CapacityDurationHours"] === "number"
      ? input["CapacityDurationHours"]
      : 24;
  return {
    CapacityBlockOfferings: [
      {
        CapacityBlockOfferingId: "cbo-0a1b2c3d4e5f6a7b8",
        InstanceType: instanceType,
        AvailabilityZone: "us-east-1a",
        InstanceCount: 1,
        StartDate: new Date().toISOString(),
        EndDate: new Date(
          Date.now() + durationHours * 3600 * 1000,
        ).toISOString(),
        CapacityBlockDurationHours: durationHours,
        UpfrontFee: { Amount: "0.00", CurrencyCode: "USD" },
        Tenancy: "default",
        UltraserverType: null,
        UltraserverCount: null,
        AvailabilityZoneId: "use1-az1",
      },
    ],
  };
};

const DescribeCapacityBlockStatus: OperationHandler = (_input, _ctx) => {
  return { CapacityBlockStatuses: [] };
};

const DescribeCapacityBlocks: OperationHandler = (_input, _ctx) => {
  return { CapacityBlocks: [] };
};

const DescribeCapacityManagerDataExports: OperationHandler = (input, ctx) => {
  const ids = stringList(input["CapacityManagerDataExportIds"]);
  const exports = allCapacityManagerDataExports(ctx).filter(
    (e) => ids.length === 0 || ids.includes(e.CapacityManagerDataExportId),
  );
  return {
    CapacityManagerDataExports: exports.map((e) => ({
      CapacityManagerDataExportId: e.CapacityManagerDataExportId,
      S3Bucket: "",
      S3Prefix: "",
      DataExportStatus: "active",
    })),
  };
};

const DescribeAccountAttributes: OperationHandler = (input, _ctx) => {
  const requestedNames = Array.isArray(input["AttributeNames"])
    ? (input["AttributeNames"] as string[])
    : [];
  const allAttributes = [
    {
      AttributeName: "supported-platforms",
      AttributeValues: [{ AttributeValue: "VPC" }],
    },
    {
      AttributeName: "default-vpc",
      AttributeValues: [{ AttributeValue: "vpc-00000000" }],
    },
    {
      AttributeName: "max-instances",
      AttributeValues: [{ AttributeValue: "20" }],
    },
    {
      AttributeName: "vpc-max-security-groups-per-interface",
      AttributeValues: [{ AttributeValue: "5" }],
    },
    {
      AttributeName: "max-elastic-ips",
      AttributeValues: [{ AttributeValue: "5" }],
    },
    {
      AttributeName: "vpc-max-elastic-ips",
      AttributeValues: [{ AttributeValue: "5" }],
    },
  ] as const;
  const filtered =
    requestedNames.length === 0
      ? allAttributes
      : allAttributes.filter((a) => requestedNames.includes(a.AttributeName));
  return { AccountAttributes: filtered };
};

const DescribeCapacityReservationBillingRequests: OperationHandler = (
  _input,
  _ctx,
) => {
  return { CapacityReservationBillingRequests: [] };
};

const DescribeCapacityReservationFleets: OperationHandler = (_input, _ctx) => {
  return { CapacityReservationFleets: [] };
};

const DescribeCapacityReservationTopology: OperationHandler = (input, ctx) => {
  const ids = stringList(input["CapacityReservationIds"]);
  const reservations = allCapacityReservations(ctx).filter(
    (r) => ids.length === 0 || ids.includes(r.CapacityReservationId),
  );
  return {
    CapacityReservations: reservations.map((r) => ({
      CapacityReservationId: r.CapacityReservationId,
      State: r.State,
      InstanceType: r.InstanceType,
      GroupName: "",
      NetworkNodes: [],
    })),
  };
};

const DescribeCapacityReservations: OperationHandler = (input, ctx) => {
  const ids = stringList(input["CapacityReservationIds"]);
  const reservations = allCapacityReservations(ctx).filter(
    (r) => ids.length === 0 || ids.includes(r.CapacityReservationId),
  );
  return {
    CapacityReservations: reservations.map((r) => ({
      CapacityReservationId: r.CapacityReservationId,
      OwnerId: ctx.account,
      CapacityReservationArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:capacity-reservation/${r.CapacityReservationId}`,
      InstanceType: r.InstanceType,
      InstancePlatform: r.InstancePlatform,
      AvailabilityZone: r.AvailabilityZone,
      Tenancy: r.Tenancy,
      TotalInstanceCount: r.TotalInstanceCount,
      AvailableInstanceCount: r.AvailableInstanceCount,
      EbsOptimized: r.EbsOptimized,
      EphemeralStorage: r.EphemeralStorage,
      State: r.State,
      EndDateType: r.EndDateType,
      InstanceMatchCriteria: r.InstanceMatchCriteria,
      CreateDate: r.CreateDate,
      Tags: r.Tags,
    })),
  };
};

const DescribeCarrierGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["CarrierGatewayIds"]);
  const gateways = allCarrierGateways(ctx).filter(
    (g) => ids.length === 0 || ids.includes(g.CarrierGatewayId),
  );
  return {
    CarrierGateways: gateways.map((g) => ({
      CarrierGatewayId: g.CarrierGatewayId,
      VpcId: g.VpcId,
      State: g.State,
      OwnerId: g.OwnerId,
      Tags: g.Tags,
    })),
  };
};

const DescribeClassicLinkInstances: OperationHandler = (_input, _ctx) => {
  return { Instances: [] };
};

const DescribeClientVpnAuthorizationRules: OperationHandler = (
  _input,
  _ctx,
) => {
  return { AuthorizationRules: [] };
};

const DescribeClientVpnConnections: OperationHandler = (_input, _ctx) => {
  return { Connections: [] };
};

const DescribeClientVpnEndpoints: OperationHandler = (input, ctx) => {
  const ids = stringList(input["ClientVpnEndpointIds"]);
  const endpoints = ctx.store
    .list<StoredClientVpnEndpoint>()
    .filter((entry) => entry.key.startsWith("cvpn/"))
    .map((entry) => entry.value)
    .filter((e) => ids.length === 0 || ids.includes(e.ClientVpnEndpointId));
  return {
    ClientVpnEndpoints: endpoints.map((e) => ({
      ClientVpnEndpointId: e.ClientVpnEndpointId,
      ServerCertificateArn: e.ServerCertificateArn,
      DnsName: e.DnsName,
      Status: { Code: e.State, Message: "" },
      Tags: e.Tags,
    })),
  };
};

const DescribeClientVpnRoutes: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const routes = ctx.store
    .list<StoredClientVpnRoute>()
    .filter((entry) => entry.key.startsWith(`cvpn-route/${endpointId}/`))
    .map((entry) => entry.value);
  return {
    Routes: routes.map((r) => ({
      ClientVpnEndpointId: r.ClientVpnEndpointId,
      DestinationCidr: r.DestinationCidrBlock,
      TargetSubnet: r.TargetSubnet,
      Type: "add-route",
      Origin: "add-route",
      Status: { Code: r.Status, Message: "" },
      Description: r.Description,
    })),
  };
};

const DescribeClientVpnTargetNetworks: OperationHandler = (_input, _ctx) => {
  return { ClientVpnTargetNetworks: [] };
};

const DescribeCoipPools: OperationHandler = (input, ctx) => {
  const ids = stringList(input["PoolIds"]);
  const pools = allCoipPools(ctx).filter(
    (p) => ids.length === 0 || ids.includes(p.PoolId),
  );
  return {
    CoipPools: pools.map((p) => ({
      PoolId: p.PoolId,
      PoolCidrs: p.PoolCidrs,
      LocalGatewayRouteTableId: p.LocalGatewayRouteTableId,
      Tags: p.Tags,
      PoolArn: p.PoolArn,
    })),
  };
};

const DescribeConversionTasks: OperationHandler = (input, _ctx) => {
  const ids = stringList(input["ConversionTaskIds"]);
  void ids;
  return { ConversionTasks: [] };
};

const DescribeCustomerGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["CustomerGatewayIds"]);
  const gateways = allCustomerGateways(ctx).filter(
    (g) => ids.length === 0 || ids.includes(g.CustomerGatewayId),
  );
  return {
    CustomerGateways: gateways.map((g) => ({
      CustomerGatewayId: g.CustomerGatewayId,
      State: g.State,
      Type: g.Type,
      IpAddress: g.IpAddress,
      BgpAsn: g.BgpAsn,
      CertificateArn: g.CertificateArn,
      DeviceName: g.DeviceName,
      Tags: g.Tags,
    })),
  };
};

const DescribeDeclarativePoliciesReports: OperationHandler = (_input, _ctx) => {
  return { Reports: [] };
};

const DescribeDhcpOptions: OperationHandler = (input, ctx) => {
  const ids = stringList(input["DhcpOptionsIds"]);
  const options = allDhcpOptions(ctx).filter(
    (o) => ids.length === 0 || ids.includes(o.DhcpOptionsId),
  );
  return {
    DhcpOptions: options.map((o) => ({
      DhcpOptionsId: o.DhcpOptionsId,
      OwnerId: o.OwnerId,
      DhcpConfigurations: o.DhcpConfigurations.map((c) => ({
        Key: c.Key,
        Values: c.Values.map((v) => ({ Value: v })),
      })),
      Tags: o.Tags,
    })),
  };
};

const DescribeEgressOnlyInternetGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["EgressOnlyInternetGatewayIds"]);
  const gateways = allEgressOnlyInternetGateways(ctx).filter(
    (g) => ids.length === 0 || ids.includes(g.EgressOnlyInternetGatewayId),
  );
  return {
    EgressOnlyInternetGateways: gateways.map((g) => ({
      EgressOnlyInternetGatewayId: g.EgressOnlyInternetGatewayId,
      Attachments: g.Attachments,
      Tags: g.Tags,
    })),
  };
};

const DescribeElasticGpus: OperationHandler = (_input, _ctx) => {
  return { ElasticGpuSet: [] };
};

const DescribeExportImageTasks: OperationHandler = (_input, _ctx) => {
  return { ExportImageTasks: [] };
};

const DescribeExportTasks: OperationHandler = (_input, _ctx) => {
  return { ExportTasks: [] };
};

const DescribeFastLaunchImages: OperationHandler = (_input, _ctx) => {
  return { FastLaunchImages: [] };
};

const DescribeFastSnapshotRestores: OperationHandler = (_input, _ctx) => {
  return { FastSnapshotRestores: [] };
};

const DescribeFleetHistory: OperationHandler = (input, ctx) => {
  const fleetId = typeof input["FleetId"] === "string" ? input["FleetId"] : "";
  const rawStartTime = input["StartTime"];
  const startTime =
    typeof rawStartTime === "number"
      ? new Date(rawStartTime * 1000).toISOString()
      : typeof rawStartTime === "string" && rawStartTime !== ""
        ? rawStartTime
        : new Date(0).toISOString();
  const fleet = ctx.store.get<StoredFleet>(fleetKey(fleetId));
  if (fleet === undefined) {
    throw awsError(
      "InvalidFleetId.NotFound",
      `Fleet '${fleetId}' not found`,
      400,
    );
  }
  return {
    HistoryRecords: [],
    FleetId: fleet.FleetId,
    StartTime: startTime,
    LastEvaluatedTime: fleet.CreateTime,
  };
};

const DescribeFleetInstances: OperationHandler = (input, ctx) => {
  const fleetId = typeof input["FleetId"] === "string" ? input["FleetId"] : "";
  const fleet = ctx.store.get<StoredFleet>(fleetKey(fleetId));
  if (fleet === undefined) {
    throw awsError(
      "InvalidFleetId.NotFound",
      `Fleet '${fleetId}' not found`,
      400,
    );
  }
  return {
    ActiveInstances: [],
    FleetId: fleet.FleetId,
  };
};

const DescribeFleets: OperationHandler = (input, ctx) => {
  const ids = stringList(input["FleetIds"]);
  const fleets = allFleets(ctx).filter(
    (f) => ids.length === 0 || ids.includes(f.FleetId),
  );
  return {
    Fleets: fleets.map((f) => ({
      FleetId: f.FleetId,
      FleetState: f.FleetState,
      CreateTime: f.CreateTime,
      Tags: f.Tags,
    })),
  };
};

const DescribeFlowLogs: OperationHandler = (input, ctx) => {
  const ids = stringList(input["FlowLogIds"]);
  const logs = allFlowLogs(ctx).filter(
    (l) => ids.length === 0 || ids.includes(l.FlowLogId),
  );
  return {
    FlowLogs: logs.map((l) => ({
      FlowLogId: l.FlowLogId,
      ResourceId: l.ResourceId,
      TrafficType: l.TrafficType,
      LogGroupName: l.LogGroupName,
      LogDestination: l.LogDestination,
      FlowLogStatus: l.FlowLogStatus,
      CreationTime: l.CreationTime,
      Tags: l.Tags,
    })),
  };
};

const DescribeFpgaImageAttribute: OperationHandler = (input, ctx) => {
  const id =
    typeof input["FpgaImageId"] === "string" ? input["FpgaImageId"] : "";
  const attribute =
    typeof input["Attribute"] === "string" ? input["Attribute"] : "description";
  const image = ctx.store.get<StoredFpgaImage>(fpgaImageKey(id));
  if (image === undefined) {
    throw awsError(
      "InvalidFpgaImageID.NotFound",
      `The fpgaImageId '${id}' does not exist`,
      400,
    );
  }
  return {
    FpgaImageAttribute: {
      FpgaImageId: image.FpgaImageId,
      Name: attribute,
      Description: attribute === "description" ? image.Description : undefined,
      LoadPermissions: [],
      ProductCodes: [],
    },
  };
};

const DescribeFpgaImages: OperationHandler = (input, ctx) => {
  const ids = stringList(input["FpgaImageIds"]);
  const images = allFpgaImages(ctx).filter(
    (img) => ids.length === 0 || ids.includes(img.FpgaImageId),
  );
  return {
    FpgaImages: images.map((img) => ({
      FpgaImageId: img.FpgaImageId,
      FpgaImageGlobalId: img.FpgaImageGlobalId,
      Name: img.Name,
      Description: img.Description,
      State: { Code: img.State },
      OwnerId: img.OwnerId,
      CreateTime: img.CreateTime,
      Tags: img.Tags,
    })),
  };
};

const DescribeHostReservationOfferings: OperationHandler = (_input, _ctx) => {
  return {
    OfferingSet: [
      {
        OfferingId: "hro-00000001",
        InstanceFamily: "m5",
        PaymentOption: "NoUpfront",
        UpfrontPrice: "0.000",
        HourlyPrice: "1.500",
        CurrencyCode: "USD",
        Duration: 31536000,
      },
      {
        OfferingId: "hro-00000002",
        InstanceFamily: "m5",
        PaymentOption: "AllUpfront",
        UpfrontPrice: "10000.000",
        HourlyPrice: "0.000",
        CurrencyCode: "USD",
        Duration: 94608000,
      },
    ],
  };
};

const DescribeHostReservations: OperationHandler = (_input, _ctx) => {
  return { HostReservationSet: [] };
};

const DescribeHosts: OperationHandler = (input, ctx) => {
  const ids = stringList(input["HostIds"]);
  const hosts = allHosts(ctx).filter(
    (h) => ids.length === 0 || ids.includes(h.HostId),
  );
  return {
    Hosts: hosts.map((h) => ({
      HostId: h.HostId,
      AutoPlacement: h.AutoPlacement,
      HostRecovery: h.HostRecovery,
      AvailabilityZone: h.AvailabilityZone,
      State: h.State,
      HostProperties: {
        InstanceType: h.InstanceType,
        InstanceFamily: h.InstanceFamily,
      },
      Tags: h.Tags,
    })),
  };
};

const DescribeIamInstanceProfileAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["AssociationIds"]);
  const associations = allIamProfileAssociations(ctx).filter(
    (a) => ids.length === 0 || ids.includes(a.AssociationId),
  );
  return {
    IamInstanceProfileAssociations: associations.map((a) => ({
      AssociationId: a.AssociationId,
      InstanceId: a.InstanceId,
      IamInstanceProfile: a.IamInstanceProfile,
      State: a.State,
      Timestamp: a.Timestamp,
    })),
  };
};

const DescribeIdFormat: OperationHandler = (_input, _ctx) => {
  return { Statuses: [] };
};

const DescribeIdentityIdFormat: OperationHandler = (_input, _ctx) => {
  return { Statuses: [] };
};

const DescribeImageAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const attribute =
    typeof input["Attribute"] === "string" ? input["Attribute"] : "description";
  const image = ctx.store.get<StoredImage>(imageKey(id));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${id}]' does not exist`,
      400,
    );
  }
  return {
    ImageId: image.ImageId,
    Description:
      attribute === "description" ? { Value: image.Description } : undefined,
    LaunchPermissions: attribute === "launchPermission" ? [] : undefined,
    ProductCodes: attribute === "productCodes" ? [] : undefined,
    BlockDeviceMappings: attribute === "blockDeviceMapping" ? [] : undefined,
  };
};

const DescribeImageReferences: OperationHandler = (_input, _ctx) => {
  return { ImageReferences: [] };
};

const DescribeImageUsageReportEntries: OperationHandler = (_input, _ctx) => {
  return { ImageUsageReportEntries: [] };
};

const DescribeImageUsageReports: OperationHandler = (_input, _ctx) => {
  return { ImageUsageReports: [] };
};

const DescribeImages: OperationHandler = (input, ctx) => {
  const ids = stringList(input["ImageIds"]);
  const images = allImages(ctx).filter((image) =>
    ids.length === 0 ? true : ids.includes(image.ImageId),
  );
  return {
    Images: images.map((image) => ({
      ImageId: image.ImageId,
      Name: image.Name,
      Description: image.Description,
      State: image.State,
      OwnerId: image.OwnerId,
      CreationDate: image.CreationDate,
      Tags: image.Tags,
    })),
  };
};

const DescribeImportImageTasks: OperationHandler = (_input, _ctx) => {
  return { ImportImageTasks: [] };
};

const DescribeImportSnapshotTasks: OperationHandler = (_input, _ctx) => {
  return { ImportSnapshotTasks: [] };
};

const DescribeInstanceAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const attribute =
    typeof input["Attribute"] === "string" ? input["Attribute"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: instance.InstanceId,
    InstanceType:
      attribute === "instanceType"
        ? { Value: instance.InstanceType }
        : undefined,
    UserData: attribute === "userData" ? { Value: "" } : undefined,
    DisableApiTermination:
      attribute === "disableApiTermination" ? { Value: false } : undefined,
    InstanceInitiatedShutdownBehavior:
      attribute === "instanceInitiatedShutdownBehavior"
        ? { Value: "stop" }
        : undefined,
    EbsOptimized: attribute === "ebsOptimized" ? { Value: false } : undefined,
    EnaSupport: attribute === "enaSupport" ? { Value: true } : undefined,
    SriovNetSupport:
      attribute === "sriovNetSupport" ? { Value: "simple" } : undefined,
    SourceDestCheck:
      attribute === "sourceDestCheck" ? { Value: true } : undefined,
    BlockDeviceMappings: attribute === "blockDeviceMapping" ? [] : undefined,
    ProductCodes: attribute === "productCodes" ? [] : undefined,
    Groups: attribute === "groupSet" ? [] : undefined,
  };
};

const DescribeInstanceConnectEndpoints: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceConnectEndpointIds"]);
  const endpoints = allInstanceConnectEndpoints(ctx).filter((ep) =>
    ids.length === 0 ? true : ids.includes(ep.InstanceConnectEndpointId),
  );
  return {
    InstanceConnectEndpoints: endpoints.map((ep) => ({
      InstanceConnectEndpointId: ep.InstanceConnectEndpointId,
      InstanceConnectEndpointArn: ep.InstanceConnectEndpointArn,
      OwnerId: ep.OwnerId,
      State: ep.State,
      SubnetId: ep.SubnetId,
      VpcId: ep.VpcId,
      PreserveClientIp: ep.PreserveClientIp,
      SecurityGroupIds: ep.SecurityGroupIds,
      CreatedAt: ep.CreatedAt,
      Tags: ep.Tags,
    })),
  };
};

const DescribeInstanceCreditSpecifications: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const instances = allInstances(ctx).filter((instance) =>
    ids.length === 0 ? true : ids.includes(instance.InstanceId),
  );
  return {
    InstanceCreditSpecifications: instances.map((instance) => ({
      InstanceId: instance.InstanceId,
      CpuCredits: instance.CpuCredits ?? "standard",
    })),
  };
};

const DescribeInstanceEventNotificationAttributes: OperationHandler = (
  _input,
  _ctx,
) => {
  return { InstanceTagAttribute: undefined };
};

const DescribeInstanceEventWindows: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceEventWindowIds"]);
  const windows = allInstanceEventWindows(ctx).filter((w) =>
    ids.length === 0 ? true : ids.includes(w.InstanceEventWindowId),
  );
  return {
    InstanceEventWindows: windows.map((w) => ({
      InstanceEventWindowId: w.InstanceEventWindowId,
      Name: w.Name,
      CronExpression: w.CronExpression,
      TimeRanges: w.TimeRanges,
      State: w.State,
      Tags: w.Tags,
    })),
  };
};

const DescribeInstanceImageMetadata: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const instances = allInstances(ctx).filter((instance) =>
    ids.length === 0 ? true : ids.includes(instance.InstanceId),
  );
  return {
    InstanceImageMetadata: instances.map((instance) => ({
      InstanceId: instance.InstanceId,
      InstanceType: instance.InstanceType,
      LaunchTime: undefined,
      AvailabilityZone: "us-east-1a",
      State: instance.State,
      ImageMetadata: { ImageId: instance.ImageId },
      Tags: instance.Tags,
    })),
  };
};

const DescribeInstanceSqlHaHistoryStates: OperationHandler = (_input, _ctx) => {
  return { Instances: [] };
};

const DescribeInstanceSqlHaStates: OperationHandler = (_input, _ctx) => {
  return { Instances: [] };
};

const DescribeInstanceStatus: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const instances = allInstances(ctx).filter((instance) =>
    ids.length === 0 ? true : ids.includes(instance.InstanceId),
  );
  return {
    InstanceStatuses: instances.map((instance) => ({
      InstanceId: instance.InstanceId,
      AvailabilityZone: `${ctx.region}a`,
      InstanceState: instance.State,
      InstanceStatus: {
        Status: "ok",
        Details: [{ Name: "reachability", Status: "passed" }],
      },
      SystemStatus: {
        Status: "ok",
        Details: [{ Name: "reachability", Status: "passed" }],
      },
    })),
  };
};

const DescribeInstanceTopology: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const instances = allInstances(ctx).filter((instance) =>
    ids.length === 0 ? true : ids.includes(instance.InstanceId),
  );
  return {
    Instances: instances.map((instance) => ({
      InstanceId: instance.InstanceId,
      InstanceType: instance.InstanceType,
      GroupName: undefined,
      NetworkNodes: [],
      AvailabilityZone: `${ctx.region}a`,
      ZoneId: `${ctx.region.replace(/-/g, "")}1`,
    })),
  };
};

const STATIC_INSTANCE_TYPES = [
  "t2.micro",
  "t2.small",
  "t2.medium",
  "t3.micro",
  "t3.small",
  "t3.medium",
  "t3.large",
  "m5.large",
  "m5.xlarge",
  "c5.large",
  "c5.xlarge",
  "r5.large",
] as const;

const DescribeInstanceTypeOfferings: OperationHandler = (_input, ctx) => {
  return {
    InstanceTypeOfferings: STATIC_INSTANCE_TYPES.map((instanceType) => ({
      InstanceType: instanceType,
      LocationType: "region",
      Location: ctx.region,
    })),
  };
};

const DescribeInstanceTypes: OperationHandler = (_input, _ctx) => {
  return {
    InstanceTypes: [
      {
        InstanceType: "t2.micro",
        CurrentGeneration: false,
        FreeTierEligible: true,
        SupportedUsageClasses: ["on-demand", "spot"],
        SupportedRootDeviceTypes: ["ebs"],
        SupportedVirtualizationTypes: ["hvm"],
        BareMetal: false,
        Hypervisor: "xen",
        ProcessorInfo: {
          SupportedArchitectures: ["x86_64"],
          SustainedClockSpeedInGhz: 2.5,
        },
        VCpuInfo: {
          DefaultVCpus: 1,
          DefaultCores: 1,
          DefaultThreadsPerCore: 1,
        },
        MemoryInfo: { SizeInMiB: 1024 },
        InstanceStorageSupported: false,
        EbsInfo: {
          EbsOptimizedSupport: "unsupported",
          EncryptionSupport: "supported",
        },
        NetworkInfo: {
          NetworkPerformance: "Low to Moderate",
          MaximumNetworkInterfaces: 2,
          Ipv4AddressesPerInterface: 2,
          Ipv6AddressesPerInterface: 0,
          Ipv6Supported: false,
          EnaSupport: "unsupported",
        },
      },
      {
        InstanceType: "t3.micro",
        CurrentGeneration: true,
        FreeTierEligible: true,
        SupportedUsageClasses: ["on-demand", "spot"],
        SupportedRootDeviceTypes: ["ebs"],
        SupportedVirtualizationTypes: ["hvm"],
        BareMetal: false,
        Hypervisor: "nitro",
        ProcessorInfo: {
          SupportedArchitectures: ["x86_64"],
          SustainedClockSpeedInGhz: 3.1,
        },
        VCpuInfo: {
          DefaultVCpus: 2,
          DefaultCores: 1,
          DefaultThreadsPerCore: 2,
        },
        MemoryInfo: { SizeInMiB: 1024 },
        InstanceStorageSupported: false,
        EbsInfo: {
          EbsOptimizedSupport: "default",
          EncryptionSupport: "supported",
        },
        NetworkInfo: {
          NetworkPerformance: "Up to 5 Gigabit",
          MaximumNetworkInterfaces: 2,
          Ipv4AddressesPerInterface: 2,
          Ipv6AddressesPerInterface: 2,
          Ipv6Supported: true,
          EnaSupport: "required",
        },
      },
      {
        InstanceType: "m5.large",
        CurrentGeneration: true,
        FreeTierEligible: false,
        SupportedUsageClasses: ["on-demand", "spot"],
        SupportedRootDeviceTypes: ["ebs"],
        SupportedVirtualizationTypes: ["hvm"],
        BareMetal: false,
        Hypervisor: "nitro",
        ProcessorInfo: {
          SupportedArchitectures: ["x86_64"],
          SustainedClockSpeedInGhz: 3.1,
        },
        VCpuInfo: {
          DefaultVCpus: 2,
          DefaultCores: 1,
          DefaultThreadsPerCore: 2,
        },
        MemoryInfo: { SizeInMiB: 8192 },
        InstanceStorageSupported: false,
        EbsInfo: {
          EbsOptimizedSupport: "default",
          EncryptionSupport: "supported",
        },
        NetworkInfo: {
          NetworkPerformance: "Up to 10 Gigabit",
          MaximumNetworkInterfaces: 3,
          Ipv4AddressesPerInterface: 10,
          Ipv6AddressesPerInterface: 10,
          Ipv6Supported: true,
          EnaSupport: "required",
        },
      },
    ],
  };
};

const allIpamByoasnAssociations = (
  ctx: ServiceContext,
): StoredIpamByoasnAssociation[] =>
  ctx.store
    .list<StoredIpamByoasnAssociation>()
    .filter((entry) => entry.key.startsWith("ipam-byoasn/"))
    .map((entry) => entry.value);

const DescribeIpamByoasn: OperationHandler = (_input, ctx) => {
  const associations = allIpamByoasnAssociations(ctx);
  return {
    Byoasns: associations.map((a) => ({
      Asn: a.Asn,
      IpamId: a.IpamId,
      IpamArn: a.IpamArn,
      StatusMessage: a.StatusMessage,
      State: a.State,
    })),
  };
};

const allIpamExternalTokens = (
  ctx: ServiceContext,
): StoredIpamExternalResourceVerificationToken[] =>
  ctx.store
    .list<StoredIpamExternalResourceVerificationToken>()
    .filter((entry) => entry.key.startsWith("ipam-token/"))
    .map((entry) => entry.value);

const DescribeIpamExternalResourceVerificationTokens: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["IpamExternalResourceVerificationTokenIds"]);
  const tokens = allIpamExternalTokens(ctx).filter((t) =>
    ids.length === 0
      ? true
      : ids.includes(t.IpamExternalResourceVerificationTokenId),
  );
  return {
    IpamExternalResourceVerificationTokens: tokens.map((t) => ({
      IpamExternalResourceVerificationTokenId:
        t.IpamExternalResourceVerificationTokenId,
      IpamArn: t.IpamArn,
      IpamId: t.IpamId,
      TokenValue: t.TokenValue,
      TokenName: t.TokenName,
      NotAfter: t.NotAfter,
      Status: t.Status,
      State: t.State,
      Tags: t.Tags,
    })),
  };
};

const allIpamPolicies = (ctx: ServiceContext): StoredIpamPolicy[] =>
  ctx.store
    .list<StoredIpamPolicy>()
    .filter((entry) => entry.key.startsWith("ipam-policy/"))
    .map((entry) => entry.value);

const DescribeIpamPolicies: OperationHandler = (input, ctx) => {
  const ids = stringList(input["IpamPolicyIds"]);
  const policies = allIpamPolicies(ctx).filter((p) =>
    ids.length === 0 ? true : ids.includes(p.IpamPolicyId),
  );
  return {
    IpamPolicies: policies.map((p) => ({
      IpamPolicyId: p.IpamPolicyId,
      IpamArn: p.IpamArn,
      Description: p.Description,
      Policy: p.Policy,
      Tags: p.Tags,
    })),
  };
};

const DescribeIpamPoolAllocations: OperationHandler = (_input, _ctx) => {
  return { IpamPoolAllocations: [] };
};

const allIpamPools = (ctx: ServiceContext): StoredIpamPool[] =>
  ctx.store
    .list<StoredIpamPool>()
    .filter((entry) => entry.key.startsWith("ipam-pool/"))
    .map((entry) => entry.value);

const DescribeIpamPools: OperationHandler = (input, ctx) => {
  const ids = stringList(input["IpamPoolIds"]);
  const pools = allIpamPools(ctx).filter((p) =>
    ids.length === 0 ? true : ids.includes(p.IpamPoolId),
  );
  return {
    IpamPools: pools.map((p) => ({
      IpamPoolId: p.IpamPoolId,
      IpamScopeId: p.IpamScopeId,
      IpamId: p.IpamId,
      IpamArn: p.IpamArn,
      IpamScopeArn: p.IpamScopeArn,
      IpamPoolArn: p.IpamPoolArn,
      Locale: p.Locale,
      AddressFamily: p.AddressFamily,
      State: p.State,
      Description: p.Description,
      Tags: p.Tags,
    })),
  };
};

const allIpamPrefixListResolverTargets = (
  ctx: ServiceContext,
): StoredIpamPrefixListResolverTarget[] =>
  ctx.store
    .list<StoredIpamPrefixListResolverTarget>()
    .filter((entry) => entry.key.startsWith("ipam-plrt/"))
    .map((entry) => entry.value);

const DescribeIpamPrefixListResolverTargets: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["IpamPrefixListResolverTargetIds"]);
  const resolverId =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : undefined;
  const targets = allIpamPrefixListResolverTargets(ctx).filter((t) => {
    if (resolverId !== undefined && t.IpamPrefixListResolverId !== resolverId)
      return false;
    return ids.length === 0
      ? true
      : ids.includes(t.IpamPrefixListResolverTargetId);
  });
  return {
    IpamPrefixListResolverTargets: targets.map((t) => ({
      IpamPrefixListResolverId: t.IpamPrefixListResolverId,
      IpamPrefixListResolverTargetId: t.IpamPrefixListResolverTargetId,
      PrefixListId: t.PrefixListId,
      OwnerId: t.OwnerId,
      Tags: t.Tags,
    })),
  };
};

const allIpamPrefixListResolvers = (
  ctx: ServiceContext,
): StoredIpamPrefixListResolver[] =>
  ctx.store
    .list<StoredIpamPrefixListResolver>()
    .filter((entry) => entry.key.startsWith("ipam-plr/"))
    .map((entry) => entry.value);

const DescribeIpamPrefixListResolvers: OperationHandler = (input, ctx) => {
  const ids = stringList(input["IpamPrefixListResolverIds"]);
  const resolvers = allIpamPrefixListResolvers(ctx).filter((r) =>
    ids.length === 0 ? true : ids.includes(r.IpamPrefixListResolverId),
  );
  return {
    IpamPrefixListResolvers: resolvers.map((r) => ({
      IpamPrefixListResolverId: r.IpamPrefixListResolverId,
      IpamId: r.IpamId,
      IpamArn: r.IpamArn,
      OwnerId: r.OwnerId,
      Tags: r.Tags,
    })),
  };
};

const allIpamResourceDiscoveries = (
  ctx: ServiceContext,
): StoredIpamResourceDiscovery[] =>
  ctx.store
    .list<StoredIpamResourceDiscovery>()
    .filter((entry) => entry.key.startsWith("ipam-rd/"))
    .map((entry) => entry.value);

const DescribeIpamResourceDiscoveries: OperationHandler = (input, ctx) => {
  const ids = stringList(input["IpamResourceDiscoveryIds"]);
  const discoveries = allIpamResourceDiscoveries(ctx).filter((d) =>
    ids.length === 0 ? true : ids.includes(d.IpamResourceDiscoveryId),
  );
  return {
    IpamResourceDiscoveries: discoveries.map((d) => ({
      IpamResourceDiscoveryId: d.IpamResourceDiscoveryId,
      OwnerId: d.OwnerId,
      IpamResourceDiscoveryArn: d.IpamResourceDiscoveryArn,
      State: d.State,
      Description: d.Description,
      IsDefault: d.IsDefault,
      Tags: d.Tags,
    })),
  };
};

const allIpamResourceDiscoveryAssociations = (
  ctx: ServiceContext,
): StoredIpamResourceDiscoveryAssociation[] =>
  ctx.store
    .list<StoredIpamResourceDiscoveryAssociation>()
    .filter((entry) => entry.key.startsWith("ipam-rd-assoc/"))
    .map((entry) => entry.value);

const DescribeIpamResourceDiscoveryAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["IpamResourceDiscoveryAssociationIds"]);
  const associations = allIpamResourceDiscoveryAssociations(ctx).filter((a) =>
    ids.length === 0
      ? true
      : ids.includes(a.IpamResourceDiscoveryAssociationId),
  );
  return {
    IpamResourceDiscoveryAssociations: associations.map((a) => ({
      IpamResourceDiscoveryAssociationId: a.IpamResourceDiscoveryAssociationId,
      IpamResourceDiscoveryAssociationArn:
        a.IpamResourceDiscoveryAssociationArn,
      IpamResourceDiscoveryId: a.IpamResourceDiscoveryId,
      IpamId: a.IpamId,
      IpamArn: a.IpamArn,
      OwnerId: a.OwnerId,
      IsDefault: a.IsDefault,
      ResourceDiscoveryStatus: a.ResourceDiscoveryStatus,
      State: a.State,
      Tags: a.Tags,
    })),
  };
};

const allIpamScopes = (ctx: ServiceContext): StoredIpamScope[] =>
  ctx.store
    .list<StoredIpamScope>()
    .filter((entry) => entry.key.startsWith("ipam-scope/"))
    .map((entry) => entry.value);

const DescribeIpamScopes: OperationHandler = (input, ctx) => {
  const ids = stringList(input["IpamScopeIds"]);
  const scopes = allIpamScopes(ctx).filter((s) =>
    ids.length === 0 ? true : ids.includes(s.IpamScopeId),
  );
  return {
    IpamScopes: scopes.map((s) => ({
      IpamScopeId: s.IpamScopeId,
      IpamId: s.IpamId,
      IpamScopeArn: s.IpamScopeArn,
      IpamArn: s.IpamArn,
      IpamScopeType: s.IpamScopeType,
      IsDefault: s.IsDefault,
      Description: s.Description,
      PoolCount: s.PoolCount,
      State: s.State,
      Tags: s.Tags,
    })),
  };
};

const allIpams = (ctx: ServiceContext): StoredIpam[] =>
  ctx.store
    .list<StoredIpam>()
    .filter((entry) => entry.key.startsWith("ipam/"))
    .map((entry) => entry.value);

const DescribeIpams: OperationHandler = (input, ctx) => {
  const ids = stringList(input["IpamIds"]);
  const ipams = allIpams(ctx).filter((i) =>
    ids.length === 0 ? true : ids.includes(i.IpamId),
  );
  return {
    Ipams: ipams.map((i) => ({
      IpamId: i.IpamId,
      OwnerId: i.OwnerId,
      IpamArn: i.IpamArn,
      State: i.State,
      Description: i.Description,
      PublicDefaultScopeId: i.PublicDefaultScopeId,
      PrivateDefaultScopeId: i.PrivateDefaultScopeId,
      ScopeCount: i.ScopeCount,
      Tags: i.Tags,
    })),
  };
};

const DescribeIpv6Pools: OperationHandler = (_input, _ctx) => {
  return { Ipv6Pools: [] };
};

const allLaunchTemplates = (ctx: ServiceContext): StoredLaunchTemplate[] =>
  ctx.store
    .list<StoredLaunchTemplate>()
    .filter((entry) => entry.key.startsWith("lt/"))
    .map((entry) => entry.value);

const DescribeLaunchTemplates: OperationHandler = (input, ctx) => {
  const ids = stringList(input["LaunchTemplateIds"]);
  const names = stringList(input["LaunchTemplateNames"]);
  const templates = allLaunchTemplates(ctx).filter((t) => {
    if (ids.length > 0 && !ids.includes(t.LaunchTemplateId)) return false;
    if (names.length > 0 && !names.includes(t.LaunchTemplateName)) return false;
    return true;
  });
  return {
    LaunchTemplates: templates.map((t) => ({
      LaunchTemplateId: t.LaunchTemplateId,
      LaunchTemplateName: t.LaunchTemplateName,
      DefaultVersionNumber: t.DefaultVersionNumber,
      LatestVersionNumber: t.LatestVersionNumber,
      CreateTime: t.CreateTime,
      CreatedBy: t.CreatedBy,
      Tags: t.Tags,
    })),
  };
};

const DescribeLaunchTemplateVersions: OperationHandler = (input, ctx) => {
  const ltId =
    typeof input["LaunchTemplateId"] === "string"
      ? input["LaunchTemplateId"]
      : undefined;
  const ltName =
    typeof input["LaunchTemplateName"] === "string"
      ? input["LaunchTemplateName"]
      : undefined;
  const versions = stringList(input["Versions"]);
  const minVersion =
    typeof input["MinVersion"] === "string"
      ? parseInt(input["MinVersion"], 10)
      : undefined;
  const maxVersion =
    typeof input["MaxVersion"] === "string"
      ? parseInt(input["MaxVersion"], 10)
      : undefined;

  let lt: StoredLaunchTemplate | undefined;
  if (ltId !== undefined) {
    lt = ctx.store.get<StoredLaunchTemplate>(launchTemplateKey(ltId));
  } else if (ltName !== undefined) {
    lt = allLaunchTemplates(ctx).find((t) => t.LaunchTemplateName === ltName);
  }

  let allVersions: StoredLaunchTemplateVersion[];
  if (lt !== undefined) {
    allVersions = ctx.store
      .list<StoredLaunchTemplateVersion>()
      .filter((entry) =>
        entry.key.startsWith(`lt-version/${lt!.LaunchTemplateId}/`),
      )
      .map((entry) => entry.value);
  } else {
    allVersions = ctx.store
      .list<StoredLaunchTemplateVersion>()
      .filter((entry) => entry.key.startsWith("lt-version/"))
      .map((entry) => entry.value);
  }

  const filtered = allVersions.filter((v) => {
    if (versions.length > 0) {
      const matchesVersion = versions.some((ver) => {
        if (ver === "$Latest" && lt !== undefined) {
          return v.VersionNumber === lt.LatestVersionNumber;
        }
        if (ver === "$Default" && lt !== undefined) {
          return v.VersionNumber === lt.DefaultVersionNumber;
        }
        return v.VersionNumber === parseInt(ver, 10);
      });
      if (!matchesVersion) return false;
    }
    if (minVersion !== undefined && v.VersionNumber < minVersion) return false;
    if (maxVersion !== undefined && v.VersionNumber > maxVersion) return false;
    return true;
  });

  return {
    LaunchTemplateVersions: filtered.map((v) => ({
      LaunchTemplateId: v.LaunchTemplateId,
      LaunchTemplateName: v.LaunchTemplateName,
      VersionNumber: v.VersionNumber,
      VersionDescription: v.VersionDescription,
      CreateTime: v.CreateTime,
      CreatedBy: v.CreatedBy,
      DefaultVersion: v.DefaultVersion,
      LaunchTemplateData: v.LaunchTemplateData,
    })),
  };
};

const allLocalGatewayRouteTableVifgAssociations = (
  ctx: ServiceContext,
): StoredLocalGatewayRouteTableVirtualInterfaceGroupAssociation[] =>
  ctx.store
    .list<StoredLocalGatewayRouteTableVirtualInterfaceGroupAssociation>()
    .filter((entry) => entry.key.startsWith("lgw-vif-grp-assoc/"))
    .map((entry) => entry.value);

const DescribeLocalGatewayRouteTableVirtualInterfaceGroupAssociations: OperationHandler =
  (input, ctx) => {
    const ids = stringList(
      input["LocalGatewayRouteTableVirtualInterfaceGroupAssociationIds"],
    );
    const associations = allLocalGatewayRouteTableVifgAssociations(ctx).filter(
      (a) =>
        ids.length === 0
          ? true
          : ids.includes(
              a.LocalGatewayRouteTableVirtualInterfaceGroupAssociationId,
            ),
    );
    return {
      LocalGatewayRouteTableVirtualInterfaceGroupAssociations: associations.map(
        (a) => ({
          LocalGatewayRouteTableVirtualInterfaceGroupAssociationId:
            a.LocalGatewayRouteTableVirtualInterfaceGroupAssociationId,
          LocalGatewayVirtualInterfaceGroupId:
            a.LocalGatewayVirtualInterfaceGroupId,
          LocalGatewayId: a.LocalGatewayId,
          LocalGatewayRouteTableId: a.LocalGatewayRouteTableId,
          LocalGatewayRouteTableArn: a.LocalGatewayRouteTableArn,
          OwnerId: a.OwnerId,
          State: a.State,
          Tags: a.Tags,
        }),
      ),
    };
  };

const allLocalGatewayRouteTableVpcAssociations = (
  ctx: ServiceContext,
): StoredLocalGatewayRouteTableVpcAssociation[] =>
  ctx.store
    .list<StoredLocalGatewayRouteTableVpcAssociation>()
    .filter((entry) => entry.key.startsWith("lgw-vpc-assoc/"))
    .map((entry) => entry.value);

const DescribeLocalGatewayRouteTableVpcAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["LocalGatewayRouteTableVpcAssociationIds"]);
  const associations = allLocalGatewayRouteTableVpcAssociations(ctx).filter(
    (a) =>
      ids.length === 0
        ? true
        : ids.includes(a.LocalGatewayRouteTableVpcAssociationId),
  );
  return {
    LocalGatewayRouteTableVpcAssociations: associations.map((a) => ({
      LocalGatewayRouteTableVpcAssociationId:
        a.LocalGatewayRouteTableVpcAssociationId,
      LocalGatewayRouteTableId: a.LocalGatewayRouteTableId,
      LocalGatewayRouteTableArn: a.LocalGatewayRouteTableArn,
      LocalGatewayId: a.LocalGatewayId,
      VpcId: a.VpcId,
      OwnerId: a.OwnerId,
      State: a.State,
      Tags: a.Tags,
    })),
  };
};

const allLocalGatewayRouteTables = (
  ctx: ServiceContext,
): StoredLocalGatewayRouteTable[] =>
  ctx.store
    .list<StoredLocalGatewayRouteTable>()
    .filter((entry) => entry.key.startsWith("lgw-rtb/"))
    .map((entry) => entry.value);

const DescribeLocalGatewayRouteTables: OperationHandler = (input, ctx) => {
  const ids = stringList(input["LocalGatewayRouteTableIds"]);
  const tables = allLocalGatewayRouteTables(ctx).filter((t) =>
    ids.length === 0 ? true : ids.includes(t.LocalGatewayRouteTableId),
  );
  return {
    LocalGatewayRouteTables: tables.map((t) => ({
      LocalGatewayRouteTableId: t.LocalGatewayRouteTableId,
      LocalGatewayRouteTableArn: t.LocalGatewayRouteTableArn,
      LocalGatewayId: t.LocalGatewayId,
      State: t.State,
      OwnerId: t.OwnerId,
      Tags: t.Tags,
    })),
  };
};

const allLocalGatewayVirtualInterfaceGroups = (
  ctx: ServiceContext,
): StoredLocalGatewayVirtualInterfaceGroup[] =>
  ctx.store
    .list<StoredLocalGatewayVirtualInterfaceGroup>()
    .filter((entry) => entry.key.startsWith("lgw-vif-grp/"))
    .map((entry) => entry.value);

const DescribeLocalGatewayVirtualInterfaceGroups: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["LocalGatewayVirtualInterfaceGroupIds"]);
  const groups = allLocalGatewayVirtualInterfaceGroups(ctx).filter((g) =>
    ids.length === 0
      ? true
      : ids.includes(g.LocalGatewayVirtualInterfaceGroupId),
  );
  return {
    LocalGatewayVirtualInterfaceGroups: groups.map((g) => ({
      LocalGatewayVirtualInterfaceGroupId:
        g.LocalGatewayVirtualInterfaceGroupId,
      LocalGatewayVirtualInterfaceIds: g.LocalGatewayVirtualInterfaceIds,
      LocalGatewayId: g.LocalGatewayId,
      OwnerId: g.OwnerId,
      LocalBgpAsn: g.LocalBgpAsn,
      LocalGatewayVirtualInterfaceGroupArn:
        g.LocalGatewayVirtualInterfaceGroupArn,
      Tags: g.Tags,
    })),
  };
};

const allLocalGatewayVirtualInterfaces = (
  ctx: ServiceContext,
): StoredLocalGatewayVirtualInterface[] =>
  ctx.store
    .list<StoredLocalGatewayVirtualInterface>()
    .filter((entry) => entry.key.startsWith("lgw-vif/"))
    .map((entry) => entry.value);

const DescribeLocalGatewayVirtualInterfaces: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["LocalGatewayVirtualInterfaceIds"]);
  const interfaces = allLocalGatewayVirtualInterfaces(ctx).filter((i) =>
    ids.length === 0 ? true : ids.includes(i.LocalGatewayVirtualInterfaceId),
  );
  return {
    LocalGatewayVirtualInterfaces: interfaces.map((i) => ({
      LocalGatewayVirtualInterfaceId: i.LocalGatewayVirtualInterfaceId,
      LocalGatewayId: i.LocalGatewayId,
      LocalGatewayVirtualInterfaceGroupId:
        i.LocalGatewayVirtualInterfaceGroupId,
      LocalGatewayVirtualInterfaceArn: i.LocalGatewayVirtualInterfaceArn,
      OutpostLagId: i.OutpostLagId,
      Vlan: i.Vlan,
      LocalAddress: i.LocalAddress,
      PeerAddress: i.PeerAddress,
      LocalBgpAsn: i.LocalBgpAsn,
      PeerBgpAsn: i.PeerBgpAsn,
      OwnerId: i.OwnerId,
      Tags: i.Tags,
    })),
  };
};

const DescribeLocalGateways: OperationHandler = (_input, _ctx) => {
  return { LocalGateways: [] };
};

const DescribeLockedSnapshots: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SnapshotIds"]);
  const locks = ctx.store
    .list<{
      SnapshotId: string;
      LockState: string;
      LockMode: string;
      LockDuration: number | undefined;
      LockCreatedOn: string;
      LockExpiresOn: string | undefined;
    }>()
    .filter((entry) => entry.key.startsWith("snapshot-lock/"))
    .map((entry) => entry.value)
    .filter((l) => ids.length === 0 || ids.includes(l.SnapshotId));
  return {
    Snapshots: locks.map((l) => ({
      SnapshotId: l.SnapshotId,
      LockState: l.LockState,
      LockMode: l.LockMode,
      LockDuration: l.LockDuration,
      LockCreatedOn: l.LockCreatedOn,
      LockExpiresOn: l.LockExpiresOn,
    })),
  };
};

const DescribeMacHosts: OperationHandler = (_input, _ctx) => {
  return { MacHosts: [] };
};

const DescribeMacModificationTasks: OperationHandler = (_input, _ctx) => {
  return { MacModificationTasks: [] };
};

const allManagedPrefixLists = (
  ctx: ServiceContext,
): StoredManagedPrefixList[] =>
  ctx.store
    .list<StoredManagedPrefixList>()
    .filter((entry) => entry.key.startsWith("pl/"))
    .map((entry) => entry.value);

const DescribeManagedPrefixLists: OperationHandler = (input, ctx) => {
  const ids = stringList(input["PrefixListIds"]);
  const lists = allManagedPrefixLists(ctx).filter((pl) =>
    ids.length === 0 ? true : ids.includes(pl.PrefixListId),
  );
  return {
    PrefixLists: lists.map((pl) => ({
      PrefixListId: pl.PrefixListId,
      AddressFamily: pl.AddressFamily,
      State: pl.State,
      PrefixListArn: pl.PrefixListArn,
      PrefixListName: pl.PrefixListName,
      MaxEntries: pl.MaxEntries,
      Version: pl.Version,
      Tags: pl.Tags,
      OwnerId: pl.OwnerId,
    })),
  };
};

const DescribeMovingAddresses: OperationHandler = (_input, _ctx) => {
  return { MovingAddressStatuses: [] };
};

const allNetworkAcls = (ctx: ServiceContext): StoredNetworkAcl[] =>
  ctx.store
    .list<StoredNetworkAcl>()
    .filter((entry) => entry.key.startsWith("acl/"))
    .map((entry) => entry.value);

const DescribeNetworkAcls: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NetworkAclIds"]);
  const acls = allNetworkAcls(ctx).filter((acl) =>
    ids.length === 0 ? true : ids.includes(acl.NetworkAclId),
  );
  return {
    NetworkAcls: acls.map((acl) => ({
      NetworkAclId: acl.NetworkAclId,
      VpcId: acl.VpcId,
      IsDefault: acl.IsDefault,
      OwnerId: acl.OwnerId,
      Entries: acl.Entries.map((e) => ({
        RuleNumber: e.RuleNumber,
        Protocol: e.Protocol,
        RuleAction: e.RuleAction,
        Egress: e.Egress,
        CidrBlock: e.CidrBlock,
        Ipv6CidrBlock: e.Ipv6CidrBlock,
      })),
      Associations: [],
      Tags: acl.Tags,
    })),
  };
};

const allNiScopeAnalyses = (
  ctx: ServiceContext,
): StoredNetworkInsightsAccessScopeAnalysis[] =>
  ctx.store
    .list<StoredNetworkInsightsAccessScopeAnalysis>()
    .filter((entry) => entry.key.startsWith("ni-scope-analysis/"))
    .map((entry) => entry.value);

const DescribeNetworkInsightsAccessScopeAnalyses: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["NetworkInsightsAccessScopeAnalysisIds"]);
  const analyses = allNiScopeAnalyses(ctx).filter((a) =>
    ids.length === 0
      ? true
      : ids.includes(a.NetworkInsightsAccessScopeAnalysisId),
  );
  return {
    NetworkInsightsAccessScopeAnalyses: analyses.map((a) => ({
      NetworkInsightsAccessScopeAnalysisId:
        a.NetworkInsightsAccessScopeAnalysisId,
      NetworkInsightsAccessScopeId: a.NetworkInsightsAccessScopeId,
    })),
  };
};

const allNiAccessScopes = (
  ctx: ServiceContext,
): StoredNetworkInsightsAccessScope[] =>
  ctx.store
    .list<StoredNetworkInsightsAccessScope>()
    .filter((entry) => entry.key.startsWith("ni-scope/"))
    .map((entry) => entry.value);

const DescribeNetworkInsightsAccessScopes: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NetworkInsightsAccessScopeIds"]);
  const scopes = allNiAccessScopes(ctx).filter((s) =>
    ids.length === 0 ? true : ids.includes(s.NetworkInsightsAccessScopeId),
  );
  return {
    NetworkInsightsAccessScopes: scopes.map((s) => ({
      NetworkInsightsAccessScopeId: s.NetworkInsightsAccessScopeId,
      NetworkInsightsAccessScopeArn: s.NetworkInsightsAccessScopeArn,
      CreatedDate: s.CreatedDate,
      UpdatedDate: s.UpdatedDate,
      Tags: s.Tags,
    })),
  };
};

const allNiAnalyses = (ctx: ServiceContext): StoredNetworkInsightsAnalysis[] =>
  ctx.store
    .list<StoredNetworkInsightsAnalysis>()
    .filter((entry) => entry.key.startsWith("ni-analysis/"))
    .map((entry) => entry.value);

const DescribeNetworkInsightsAnalyses: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NetworkInsightsAnalysisIds"]);
  const analyses = allNiAnalyses(ctx).filter((a) =>
    ids.length === 0 ? true : ids.includes(a.NetworkInsightsAnalysisId),
  );
  return {
    NetworkInsightsAnalyses: analyses.map((a) => ({
      NetworkInsightsAnalysisId: a.NetworkInsightsAnalysisId,
      NetworkInsightsPathId: a.NetworkInsightsPathId,
    })),
  };
};

const allNiPaths = (ctx: ServiceContext): StoredNetworkInsightsPath[] =>
  ctx.store
    .list<StoredNetworkInsightsPath>()
    .filter((entry) => entry.key.startsWith("ni-path/"))
    .map((entry) => entry.value);

const DescribeNetworkInsightsPaths: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NetworkInsightsPathIds"]);
  const paths = allNiPaths(ctx).filter((p) =>
    ids.length === 0 ? true : ids.includes(p.NetworkInsightsPathId),
  );
  return {
    NetworkInsightsPaths: paths.map((p) => ({
      NetworkInsightsPathId: p.NetworkInsightsPathId,
      NetworkInsightsPathArn: p.NetworkInsightsPathArn,
      CreatedDate: p.CreatedDate,
      Source: p.Source,
      Destination: p.Destination,
      Protocol: p.Protocol,
      DestinationPort: p.DestinationPort,
      Tags: p.Tags,
    })),
  };
};

const allNetworkInterfacePermissions = (
  ctx: ServiceContext,
): StoredNetworkInterfacePermission[] =>
  ctx.store
    .list<StoredNetworkInterfacePermission>()
    .filter((entry) => entry.key.startsWith("ni-perm/"))
    .map((entry) => entry.value);

const DescribeNetworkInterfacePermissions: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NetworkInterfacePermissionIds"]);
  const perms = allNetworkInterfacePermissions(ctx).filter((p) =>
    ids.length === 0 ? true : ids.includes(p.NetworkInterfacePermissionId),
  );
  return {
    NetworkInterfacePermissions: perms.map((p) => ({
      NetworkInterfacePermissionId: p.NetworkInterfacePermissionId,
      NetworkInterfaceId: p.NetworkInterfaceId,
      AwsAccountId: p.AwsAccountId,
      AwsService: p.AwsService,
      Permission: p.Permission,
      PermissionState: { State: p.PermissionState },
    })),
  };
};

const allNetworkInterfaces = (ctx: ServiceContext): StoredNetworkInterface[] =>
  ctx.store
    .list<StoredNetworkInterface>()
    .filter((entry) => entry.key.startsWith("eni/"))
    .map((entry) => entry.value);

const DescribeNetworkInterfaces: OperationHandler = (input, ctx) => {
  const ids = stringList(input["NetworkInterfaceIds"]);
  const nis = allNetworkInterfaces(ctx).filter((ni) =>
    ids.length === 0 ? true : ids.includes(ni.NetworkInterfaceId),
  );
  return {
    NetworkInterfaces: nis.map((ni) => ({
      NetworkInterfaceId: ni.NetworkInterfaceId,
      SubnetId: ni.SubnetId,
      VpcId: ni.VpcId,
      AvailabilityZone: ni.AvailabilityZone,
      Description: ni.Description,
      OwnerId: ni.OwnerId,
      PrivateIpAddress: ni.PrivateIpAddress,
      PrivateDnsName: ni.PrivateDnsName,
      MacAddress: ni.MacAddress,
      Status: ni.Status,
      InterfaceType: ni.InterfaceType,
      SourceDestCheck: ni.SourceDestCheck,
      TagSet: ni.Tags,
      Groups: ni.Groups,
    })),
  };
};

const DescribeOutpostLags: OperationHandler = (_input, _ctx) => {
  return { OutpostLags: [] };
};

const allPlacementGroups = (ctx: ServiceContext): StoredPlacementGroup[] =>
  ctx.store
    .list<StoredPlacementGroup>()
    .filter((entry) => entry.key.startsWith("pg/"))
    .map((entry) => entry.value);

const DescribePlacementGroups: OperationHandler = (input, ctx) => {
  const ids = stringList(input["GroupIds"]);
  const names = stringList(input["GroupNames"]);
  const groups = allPlacementGroups(ctx).filter((g) => {
    if (ids.length === 0 && names.length === 0) return true;
    return ids.includes(g.GroupId) || names.includes(g.GroupName);
  });
  return {
    PlacementGroups: groups.map((g) => ({
      GroupId: g.GroupId,
      GroupName: g.GroupName,
      State: g.State,
      Strategy: g.Strategy,
      PartitionCount: g.PartitionCount,
      SpreadLevel: g.SpreadLevel,
      GroupArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:placement-group/${g.GroupName}`,
      Tags: g.Tags,
    })),
  };
};

const DescribePrefixLists: OperationHandler = (input, ctx) => {
  const ids = stringList(input["PrefixListIds"]);
  const lists = allManagedPrefixLists(ctx).filter((pl) =>
    ids.length === 0 ? true : ids.includes(pl.PrefixListId),
  );
  return {
    PrefixLists: lists.map((pl) => ({
      PrefixListId: pl.PrefixListId,
      PrefixListName: pl.PrefixListName,
      Cidrs: [],
    })),
  };
};

const DescribePrincipalIdFormat: OperationHandler = (_input, _ctx) => {
  return { Principals: [] };
};

const allPublicIpv4Pools = (ctx: ServiceContext): StoredPublicIpv4Pool[] =>
  ctx.store
    .list<StoredPublicIpv4Pool>()
    .filter((entry) => entry.key.startsWith("ipv4-pool/"))
    .map((entry) => entry.value);

const DescribePublicIpv4Pools: OperationHandler = (input, ctx) => {
  const ids = stringList(input["PoolIds"]);
  const pools = allPublicIpv4Pools(ctx).filter((p) =>
    ids.length === 0 ? true : ids.includes(p.PoolId),
  );
  return {
    PublicIpv4Pools: pools.map((p) => ({
      PoolId: p.PoolId,
      NetworkBorderGroup: p.NetworkBorderGroup,
      Tags: p.Tags,
      PoolAddressRanges: [],
      TotalAddressCount: 0,
      TotalAvailableAddressCount: 0,
    })),
  };
};

const AWS_REGIONS = [
  "af-south-1",
  "ap-east-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-southeast-5",
  "ca-central-1",
  "ca-west-1",
  "eu-central-1",
  "eu-central-2",
  "eu-north-1",
  "eu-south-1",
  "eu-south-2",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "il-central-1",
  "me-central-1",
  "me-south-1",
  "mx-central-1",
  "sa-east-1",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
] as const;

const DescribeRegions: OperationHandler = (_input, _ctx) => {
  return {
    Regions: AWS_REGIONS.map((name) => ({
      RegionName: name,
      Endpoint: `ec2.${name}.amazonaws.com`,
      OptInStatus: "opt-in-not-required",
    })),
  };
};

const allReplaceRootVolumeTasks = (
  ctx: ServiceContext,
): StoredReplaceRootVolumeTask[] =>
  ctx.store
    .list<StoredReplaceRootVolumeTask>()
    .filter((entry) => entry.key.startsWith("rrvt/"))
    .map((entry) => entry.value);

const DescribeReplaceRootVolumeTasks: OperationHandler = (input, ctx) => {
  const ids = stringList(input["ReplaceRootVolumeTaskIds"]);
  const tasks = allReplaceRootVolumeTasks(ctx).filter((t) =>
    ids.length === 0 ? true : ids.includes(t.ReplaceRootVolumeTaskId),
  );
  return {
    ReplaceRootVolumeTasks: tasks.map((t) => ({
      ReplaceRootVolumeTaskId: t.ReplaceRootVolumeTaskId,
      InstanceId: t.InstanceId,
      TaskState: t.TaskState,
      StartTime: t.StartTime,
      Tags: t.Tags,
      ImageId: t.ImageId,
      SnapshotId: t.SnapshotId,
      DeleteReplacedRootVolume: t.DeleteReplacedRootVolume,
    })),
  };
};

const DescribeReservedInstances: OperationHandler = (_input, _ctx) => {
  return { ReservedInstances: [] };
};

const allReservedInstancesListings = (
  ctx: ServiceContext,
): StoredReservedInstancesListing[] =>
  ctx.store
    .list<StoredReservedInstancesListing>()
    .filter((entry) => entry.key.startsWith("ril/"))
    .map((entry) => entry.value);

const DescribeReservedInstancesListings: OperationHandler = (input, ctx) => {
  const listingId =
    typeof input["ReservedInstancesListingId"] === "string"
      ? input["ReservedInstancesListingId"]
      : undefined;
  const reservedInstancesId =
    typeof input["ReservedInstancesId"] === "string"
      ? input["ReservedInstancesId"]
      : undefined;
  const listings = allReservedInstancesListings(ctx).filter((l) => {
    if (listingId !== undefined && l.ReservedInstancesListingId !== listingId)
      return false;
    if (
      reservedInstancesId !== undefined &&
      l.ReservedInstancesId !== reservedInstancesId
    )
      return false;
    return true;
  });
  return {
    ReservedInstancesListings: listings.map((l) => ({
      ReservedInstancesListingId: l.ReservedInstancesListingId,
      ReservedInstancesId: l.ReservedInstancesId,
      ClientToken: l.ClientToken,
      CreateDate: l.CreateDate,
      UpdateDate: l.UpdateDate,
      Status: l.Status,
      StatusMessage: l.StatusMessage,
      InstanceCounts: [],
      PriceSchedules: [],
      Tags: l.Tags,
    })),
  };
};

const DescribeReservedInstancesModifications: OperationHandler = (
  _input,
  _ctx,
) => {
  return { ReservedInstancesModifications: [] };
};

const allRouteServers = (ctx: ServiceContext): StoredRouteServer[] =>
  ctx.store
    .list<StoredRouteServer>()
    .filter((entry) => entry.key.startsWith("rs/"))
    .map((entry) => entry.value);

const allRouteServerEndpoints = (
  ctx: ServiceContext,
): StoredRouteServerEndpoint[] =>
  ctx.store
    .list<StoredRouteServerEndpoint>()
    .filter((entry) => entry.key.startsWith("rse/"))
    .map((entry) => entry.value);

const allRouteServerPeers = (ctx: ServiceContext): StoredRouteServerPeer[] =>
  ctx.store
    .list<StoredRouteServerPeer>()
    .filter((entry) => entry.key.startsWith("rsp/"))
    .map((entry) => entry.value);

const allSecondaryNetworks = (ctx: ServiceContext): StoredSecondaryNetwork[] =>
  ctx.store
    .list<StoredSecondaryNetwork>()
    .filter((entry) => entry.key.startsWith("snet/"))
    .map((entry) => entry.value);

const allSecondarySubnets = (ctx: ServiceContext): StoredSecondarySubnet[] =>
  ctx.store
    .list<StoredSecondarySubnet>()
    .filter((entry) => entry.key.startsWith("ssub/"))
    .map((entry) => entry.value);

const allSpotInstanceRequests = (
  ctx: ServiceContext,
): StoredSpotInstanceRequest[] =>
  ctx.store
    .list<StoredSpotInstanceRequest>()
    .filter((entry) => entry.key.startsWith("sir/"))
    .map((entry) => entry.value);

const allSpotFleetRequests = (ctx: ServiceContext): StoredSpotFleetRequest[] =>
  ctx.store
    .list<StoredSpotFleetRequest>()
    .filter((entry) => entry.key.startsWith("sfr/"))
    .map((entry) => entry.value);

const allStoreImageTasks = (ctx: ServiceContext): StoredStoreImageTask[] =>
  ctx.store
    .list<StoredStoreImageTask>()
    .filter((entry) => entry.key.startsWith("store-image-task/"))
    .map((entry) => entry.value);

const allTrafficMirrorFilterRules = (
  ctx: ServiceContext,
): StoredTrafficMirrorFilterRule[] =>
  ctx.store
    .list<StoredTrafficMirrorFilterRule>()
    .filter((entry) => entry.key.startsWith("tmfr/"))
    .map((entry) => entry.value);

const allTrafficMirrorFilters = (
  ctx: ServiceContext,
): StoredTrafficMirrorFilter[] =>
  ctx.store
    .list<StoredTrafficMirrorFilter>()
    .filter((entry) => entry.key.startsWith("tmf/"))
    .map((entry) => entry.value);

const allTrafficMirrorSessions = (
  ctx: ServiceContext,
): StoredTrafficMirrorSession[] =>
  ctx.store
    .list<StoredTrafficMirrorSession>()
    .filter((entry) => entry.key.startsWith("tms/"))
    .map((entry) => entry.value);

const allTrafficMirrorTargets = (
  ctx: ServiceContext,
): StoredTrafficMirrorTarget[] =>
  ctx.store
    .list<StoredTrafficMirrorTarget>()
    .filter((entry) => entry.key.startsWith("tmt/"))
    .map((entry) => entry.value);

const allTransitGatewayConnects = (
  ctx: ServiceContext,
): StoredTransitGatewayConnect[] =>
  ctx.store
    .list<StoredTransitGatewayConnect>()
    .filter((entry) => entry.key.startsWith("tgw-connect/"))
    .map((entry) => entry.value);

const allTransitGatewayConnectPeers = (
  ctx: ServiceContext,
): StoredTransitGatewayConnectPeer[] =>
  ctx.store
    .list<StoredTransitGatewayConnectPeer>()
    .filter((entry) => entry.key.startsWith("tgw-connect-peer/"))
    .map((entry) => entry.value);

const allTransitGatewayMeteringPolicies = (
  ctx: ServiceContext,
): StoredTransitGatewayMeteringPolicy[] =>
  ctx.store
    .list<StoredTransitGatewayMeteringPolicy>()
    .filter((entry) => entry.key.startsWith("tgw-metering-policy/"))
    .map((entry) => entry.value);

const allTransitGatewayMulticastDomains = (
  ctx: ServiceContext,
): StoredTransitGatewayMulticastDomain[] =>
  ctx.store
    .list<StoredTransitGatewayMulticastDomain>()
    .filter((entry) => entry.key.startsWith("tgw-mcast/"))
    .map((entry) => entry.value);

const allTransitGatewayPeeringAttachments = (
  ctx: ServiceContext,
): StoredTransitGatewayPeeringAttachment[] =>
  ctx.store
    .list<StoredTransitGatewayPeeringAttachment>()
    .filter((entry) => entry.key.startsWith("tgw-peering/"))
    .map((entry) => entry.value);

const allTransitGatewayPolicyTables = (
  ctx: ServiceContext,
): StoredTransitGatewayPolicyTable[] =>
  ctx.store
    .list<StoredTransitGatewayPolicyTable>()
    .filter((entry) => entry.key.startsWith("tgw-pt/"))
    .map((entry) => entry.value);

const allTransitGatewayRouteTableAnnouncements = (
  ctx: ServiceContext,
): StoredTransitGatewayRouteTableAnnouncement[] =>
  ctx.store
    .list<StoredTransitGatewayRouteTableAnnouncement>()
    .filter((entry) => entry.key.startsWith("tgw-rtb-ann/"))
    .map((entry) => entry.value);

const allTransitGatewayRouteTables = (
  ctx: ServiceContext,
): StoredTransitGatewayRouteTable[] =>
  ctx.store
    .list<StoredTransitGatewayRouteTable>()
    .filter((entry) => entry.key.startsWith("tgw-rtb/"))
    .map((entry) => entry.value);

const allTransitGatewayVpcAttachments = (
  ctx: ServiceContext,
): StoredTransitGatewayVpcAttachment[] =>
  ctx.store
    .list<StoredTransitGatewayVpcAttachment>()
    .filter((entry) => entry.key.startsWith("tgw-vpc-attach/"))
    .map((entry) => entry.value);

const allTransitGateways = (ctx: ServiceContext): StoredTransitGateway[] =>
  ctx.store
    .list<StoredTransitGateway>()
    .filter((entry) => entry.key.startsWith("tgw/"))
    .map((entry) => entry.value);

const allVerifiedAccessInstances = (
  ctx: ServiceContext,
): StoredVerifiedAccessInstance[] =>
  ctx.store
    .list<StoredVerifiedAccessInstance>()
    .filter((entry) => entry.key.startsWith("vai/"))
    .map((entry) => entry.value);

const allVerifiedAccessTrustProviders = (
  ctx: ServiceContext,
): StoredVerifiedAccessTrustProvider[] =>
  ctx.store
    .list<StoredVerifiedAccessTrustProvider>()
    .filter((entry) => entry.key.startsWith("vatp/"))
    .map((entry) => entry.value);

const allVerifiedAccessGroups = (
  ctx: ServiceContext,
): StoredVerifiedAccessGroup[] =>
  ctx.store
    .list<StoredVerifiedAccessGroup>()
    .filter((entry) => entry.key.startsWith("vag/"))
    .map((entry) => entry.value);

const allVerifiedAccessEndpoints = (
  ctx: ServiceContext,
): StoredVerifiedAccessEndpoint[] =>
  ctx.store
    .list<StoredVerifiedAccessEndpoint>()
    .filter((entry) => entry.key.startsWith("vae/"))
    .map((entry) => entry.value);

const DescribeReservedInstancesOfferings: OperationHandler = (_input, _ctx) => {
  return {
    ReservedInstancesOfferings: [
      {
        ReservedInstancesOfferingId: "a2d7c9e0-1234-5678-abcd-111111111111",
        InstanceType: "t3.medium",
        AvailabilityZone: "us-east-1a",
        Duration: 31536000,
        FixedPrice: 0,
        UsagePrice: 0,
        ProductDescription: "Linux/UNIX",
        InstanceTenancy: "default",
        Marketplace: false,
        OfferingClass: "standard",
        OfferingType: "No Upfront",
        RecurringCharges: [{ Amount: 0.0278, Frequency: "Hourly" }],
        Scope: "Region",
      },
    ],
  };
};

const DescribeRouteServers: OperationHandler = (input, ctx) => {
  const ids = stringList(input["RouteServerIds"]);
  const servers = allRouteServers(ctx).filter((s) => {
    if (ids.length > 0 && !ids.includes(s.RouteServerId)) return false;
    return true;
  });
  return {
    RouteServers: servers.map((s) => ({
      RouteServerId: s.RouteServerId,
      AmazonSideAsn: s.AmazonSideAsn,
      State: s.State,
      PersistRoutesState: s.PersistRoutesState,
      PersistRoutesDuration: s.PersistRoutesDuration,
      SnsNotificationsEnabled: s.SnsNotificationsEnabled,
      Tags: s.Tags,
    })),
  };
};

const DescribeRouteServerEndpoints: OperationHandler = (input, ctx) => {
  const ids = stringList(input["RouteServerEndpointIds"]);
  const endpoints = allRouteServerEndpoints(ctx).filter((e) => {
    if (ids.length > 0 && !ids.includes(e.RouteServerEndpointId)) return false;
    return true;
  });
  return {
    RouteServerEndpoints: endpoints.map((e) => ({
      RouteServerEndpointId: e.RouteServerEndpointId,
      RouteServerId: e.RouteServerId,
      VpcId: e.VpcId,
      SubnetId: e.SubnetId,
      EniId: e.EniId,
      EniAddress: e.EniAddress,
      State: e.State,
      Tags: e.Tags,
    })),
  };
};

const DescribeRouteServerPeers: OperationHandler = (input, ctx) => {
  const ids = stringList(input["RouteServerPeerIds"]);
  const peers = allRouteServerPeers(ctx).filter((p) => {
    if (ids.length > 0 && !ids.includes(p.RouteServerPeerId)) return false;
    return true;
  });
  return {
    RouteServerPeers: peers.map((p) => ({
      RouteServerPeerId: p.RouteServerPeerId,
      RouteServerEndpointId: p.RouteServerEndpointId,
      RouteServerId: p.RouteServerId,
      VpcId: p.VpcId,
      SubnetId: p.SubnetId,
      State: p.State,
      PeerAddress: p.PeerAddress,
      EndpointEniId: p.EndpointEniId,
      EndpointEniAddress: p.EndpointEniAddress,
      BgpOptions: {
        PeerAsn: p.PeerAsn,
        PeerLivenessDetection: p.PeerLivenessDetection,
      },
      Tags: p.Tags,
    })),
  };
};

const DescribeScheduledInstanceAvailability: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    ScheduledInstanceAvailabilitySet: [
      {
        InstanceType: "c4.large",
        Platform: "Linux/UNIX",
        NetworkPlatform: "EC2-VPC",
        AvailabilityZone: "us-east-1a",
        PurchaseToken: "synthetic-purchase-token-1",
        SlotDurationInHours: 6,
        TotalScheduledInstanceHours: 1200,
        AvailableInstanceCount: 5,
        MinTermDurationInDays: 365,
        MaxTermDurationInDays: 365,
        Recurrence: {
          Frequency: "Daily",
          Interval: 1,
          OccurrenceDayOfWeek: [],
          OccurrenceRelativeToEnd: false,
          OccurrenceUnit: "",
        },
        FirstSlotStartTime: "2026-01-01T08:00:00Z",
        HourlyPrice: "0.095",
      },
    ],
  };
};

const DescribeScheduledInstances: OperationHandler = (_input, _ctx) => {
  return { ScheduledInstanceSet: [] };
};

const DescribeSecondaryInterfaces: OperationHandler = (_input, _ctx) => {
  return { SecondaryInterfaces: [] };
};

const DescribeSecondaryNetworks: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SecondaryNetworkIds"]);
  const networks = allSecondaryNetworks(ctx).filter((n) => {
    if (ids.length > 0 && !ids.includes(n.SecondaryNetworkId)) return false;
    return true;
  });
  return {
    SecondaryNetworks: networks.map((n) => ({
      SecondaryNetworkId: n.SecondaryNetworkId,
      SecondaryNetworkArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:secondary-network/${n.SecondaryNetworkId}`,
      OwnerId: ctx.account,
      Type: n.NetworkType,
      State: n.State,
      Ipv4CidrBlockAssociations: [
        {
          AssociationId: `secondary-network-cidr-assoc-${n.SecondaryNetworkId}`,
          Ipv4CidrBlock: n.Ipv4CidrBlock,
          Ipv4CidrBlockState: { State: "associated" },
        },
      ],
      Tags: n.Tags,
    })),
  };
};

const DescribeSecondarySubnets: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SecondarySubnetIds"]);
  const subnets = allSecondarySubnets(ctx).filter((s) => {
    if (ids.length > 0 && !ids.includes(s.SecondarySubnetId)) return false;
    return true;
  });
  const networkMap = new Map<string, StoredSecondaryNetwork>();
  for (const n of allSecondaryNetworks(ctx)) {
    networkMap.set(n.SecondaryNetworkId, n);
  }
  return {
    SecondarySubnets: subnets.map((s) => ({
      SecondarySubnetId: s.SecondarySubnetId,
      SecondarySubnetArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:secondary-subnet/${s.SecondarySubnetId}`,
      SecondaryNetworkId: s.SecondaryNetworkId,
      SecondaryNetworkType: networkMap.get(s.SecondaryNetworkId)?.NetworkType,
      OwnerId: ctx.account,
      AvailabilityZone: s.AvailabilityZone,
      State: s.State,
      Ipv4CidrBlockAssociations: [
        {
          AssociationId: `secondary-subnet-cidr-assoc-${s.SecondarySubnetId}`,
          Ipv4CidrBlock: s.Ipv4CidrBlock,
          Ipv4CidrBlockState: { State: "associated" },
        },
      ],
      Tags: s.Tags,
    })),
  };
};

const DescribeSecurityGroupReferences: OperationHandler = (input, _ctx) => {
  const groupIds = stringList(input["GroupId"]);
  return {
    SecurityGroupReferenceSet: groupIds.map((id) => ({
      GroupId: id,
      ReferencingVpcId: "",
      VpcPeeringConnectionId: "",
    })),
  };
};

const DescribeSecurityGroupRules: OperationHandler = (input, ctx) => {
  const ruleIds = stringList(input["SecurityGroupRuleIds"]);
  const filters = Array.isArray(input["Filters"])
    ? (input["Filters"] as unknown[])
    : [];
  const groupIdFilter = filters
    .filter(
      (f): f is Record<string, unknown> => typeof f === "object" && f !== null,
    )
    .filter(
      (f) =>
        (typeof f["Name"] === "string" && f["Name"] === "group-id") ||
        (typeof f["name"] === "string" && f["name"] === "group-id"),
    )
    .flatMap((f) => {
      const vals = f["Values"] ?? f["values"];
      return Array.isArray(vals) ? (vals as string[]) : [];
    });
  const allRules: {
    rule: StoredSecurityGroupRule;
    group: StoredSecurityGroup;
  }[] = [];
  for (const group of allSecurityGroups(ctx)) {
    for (const rule of group.IngressRules) {
      allRules.push({ rule, group });
    }
    for (const rule of group.EgressRules) {
      allRules.push({ rule, group });
    }
  }
  const filtered = allRules.filter(({ rule, group }) => {
    if (ruleIds.length > 0 && !ruleIds.includes(rule.SecurityGroupRuleId))
      return false;
    if (groupIdFilter.length > 0 && !groupIdFilter.includes(group.GroupId))
      return false;
    return true;
  });
  return {
    SecurityGroupRules: filtered.map(({ rule, group }) =>
      securityGroupRuleView(rule, group, ctx.account),
    ),
  };
};

const DescribeSecurityGroupVpcAssociations: OperationHandler = (
  _input,
  _ctx,
) => {
  return { SecurityGroupVpcAssociations: [] };
};

const RequestSpotInstances: OperationHandler = (input, ctx) => {
  const count = integerOf(input["InstanceCount"]) ?? 1;
  const spotPrice =
    typeof input["SpotPrice"] === "string" ? input["SpotPrice"] : "0.05";
  const type = typeof input["Type"] === "string" ? input["Type"] : "one-time";
  const requests: StoredSpotInstanceRequest[] = [];
  for (let i = 0; i < count; i++) {
    const id = hexId("sir");
    const request: StoredSpotInstanceRequest = {
      SpotInstanceRequestId: id,
      State: "open",
      SpotPrice: spotPrice,
      Type: type,
      CreateTime: new Date().toISOString(),
      Tags: [],
    };
    ctx.store.set(spotInstanceRequestKey(id), request);
    requests.push(request);
  }
  return {
    SpotInstanceRequests: requests.map((r) => ({
      SpotInstanceRequestId: r.SpotInstanceRequestId,
      State: r.State,
      SpotPrice: r.SpotPrice,
      Type: r.Type,
      CreateTime: r.CreateTime,
      Tags: r.Tags,
    })),
  };
};

const RequestSpotFleet: OperationHandler = (input, ctx) => {
  const configRaw =
    typeof input["SpotFleetRequestConfig"] === "object" &&
    input["SpotFleetRequestConfig"] !== null
      ? (input["SpotFleetRequestConfig"] as Record<string, unknown>)
      : {};
  const iamFleetRole =
    typeof configRaw["IamFleetRole"] === "string"
      ? configRaw["IamFleetRole"]
      : "";
  const targetCapacity = integerOf(configRaw["TargetCapacity"]) ?? 1;
  const allocationStrategy =
    typeof configRaw["AllocationStrategy"] === "string"
      ? configRaw["AllocationStrategy"]
      : "lowestPrice";
  const id = hexId("sfr");
  const fleet: StoredSpotFleetRequest = {
    SpotFleetRequestId: id,
    SpotFleetRequestState: "active",
    CreateTime: new Date().toISOString(),
    SpotFleetRequestConfig: {
      IamFleetRole: iamFleetRole,
      TargetCapacity: targetCapacity,
      AllocationStrategy: allocationStrategy,
    },
    Tags: [],
  };
  ctx.store.set(spotFleetRequestKey(id), fleet);
  return { SpotFleetRequestId: id };
};

const DescribeServiceLinkVirtualInterfaces: OperationHandler = (
  _input,
  _ctx,
) => {
  return { ServiceLinkVirtualInterfaces: [] };
};

const DescribeSnapshotAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : "";
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
  if (snapshot === undefined) {
    throw awsError(
      "InvalidSnapshot.NotFound",
      `The snapshot '${id}' does not exist.`,
      400,
    );
  }
  return {
    SnapshotId: id,
    CreateVolumePermissions: (snapshot.CreateVolumePermissions ?? []).map(
      (p) => ({ UserId: p.UserId }),
    ),
    ProductCodes: [],
  };
};

const DescribeSnapshotTierStatus: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SnapshotIds"]);
  const snapshots = allSnapshots(ctx).filter((s) =>
    ids.length === 0 ? true : ids.includes(s.SnapshotId),
  );
  return {
    SnapshotTierStatuses: snapshots.map((s) => ({
      SnapshotId: s.SnapshotId,
      VolumeId: s.VolumeId,
      Status: s.State,
      OwnerId: s.OwnerId,
      Tags: s.Tags,
    })),
  };
};

const DescribeSpotDatafeedSubscription: OperationHandler = (_input, ctx) => {
  const sub = ctx.store.get<StoredSpotDatafeedSubscription>(spotDatafeedKey());
  if (sub === undefined) {
    throw awsError(
      "InvalidSpotDatafeed.NotFound",
      "There is no Spot Instance data feed subscription for account.",
      400,
    );
  }
  return {
    SpotDatafeedSubscription: {
      Bucket: sub.Bucket,
      OwnerId: sub.OwnerId,
      Prefix: sub.Prefix,
      State: sub.State,
    },
  };
};

const DescribeSpotFleetInstances: OperationHandler = (input, _ctx) => {
  const id =
    typeof input["SpotFleetRequestId"] === "string"
      ? input["SpotFleetRequestId"]
      : "";
  return {
    SpotFleetRequestId: id,
    ActiveInstances: [],
  };
};

const DescribeSpotFleetRequestHistory: OperationHandler = (input, _ctx) => {
  const id =
    typeof input["SpotFleetRequestId"] === "string"
      ? input["SpotFleetRequestId"]
      : "";
  return {
    SpotFleetRequestId: id,
    HistoryRecords: [],
    LastEvaluatedTime: new Date().toISOString(),
  };
};

const DescribeSpotFleetRequests: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SpotFleetRequestIds"]);
  const fleets = allSpotFleetRequests(ctx).filter((f) =>
    ids.length === 0 ? true : ids.includes(f.SpotFleetRequestId),
  );
  return {
    SpotFleetRequestConfigs: fleets.map((f) => ({
      SpotFleetRequestId: f.SpotFleetRequestId,
      SpotFleetRequestState: f.SpotFleetRequestState,
      CreateTime: f.CreateTime,
      SpotFleetRequestConfig: f.SpotFleetRequestConfig,
      Tags: f.Tags,
    })),
  };
};

const DescribeSpotInstanceRequests: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SpotInstanceRequestIds"]);
  const requests = allSpotInstanceRequests(ctx).filter((r) =>
    ids.length === 0 ? true : ids.includes(r.SpotInstanceRequestId),
  );
  return {
    SpotInstanceRequests: requests.map((r) => ({
      SpotInstanceRequestId: r.SpotInstanceRequestId,
      State: r.State,
      SpotPrice: r.SpotPrice,
      Type: r.Type,
      CreateTime: r.CreateTime,
      Tags: r.Tags,
    })),
  };
};

const DescribeSpotPriceHistory: OperationHandler = (_input, _ctx) => {
  return {
    SpotPriceHistory: [
      {
        InstanceType: "t3.medium",
        ProductDescription: "Linux/UNIX",
        SpotPrice: "0.0139",
        Timestamp: "2026-01-01T00:00:00Z",
        AvailabilityZone: "us-east-1a",
      },
      {
        InstanceType: "t3.large",
        ProductDescription: "Linux/UNIX",
        SpotPrice: "0.0278",
        Timestamp: "2026-01-01T00:00:00Z",
        AvailabilityZone: "us-east-1b",
      },
    ],
  };
};

const DescribeStaleSecurityGroups: OperationHandler = (_input, _ctx) => {
  return { StaleSecurityGroupSet: [] };
};

const DescribeStoreImageTasks: OperationHandler = (input, ctx) => {
  const ids = stringList(input["ImageIds"]);
  const tasks = allStoreImageTasks(ctx).filter((t) =>
    ids.length === 0 ? true : ids.includes(t.ImageId),
  );
  return {
    StoreImageTaskResults: tasks.map((t) => ({
      AmiId: t.ImageId,
      S3objectKey: t.ObjectKey,
      Bucket: t.Bucket,
      TaskState: "Completed",
      StoreTaskState: "Completed",
    })),
  };
};

const DescribeTrafficMirrorFilterRules: OperationHandler = (input, ctx) => {
  const ruleIds = stringList(input["TrafficMirrorFilterRuleIds"]);
  const filterId =
    typeof input["TrafficMirrorFilterId"] === "string"
      ? input["TrafficMirrorFilterId"]
      : "";
  const rules = allTrafficMirrorFilterRules(ctx).filter((r) => {
    if (ruleIds.length > 0 && !ruleIds.includes(r.TrafficMirrorFilterRuleId))
      return false;
    if (filterId !== "" && r.TrafficMirrorFilterId !== filterId) return false;
    return true;
  });
  return {
    TrafficMirrorFilterRules: rules.map((r) => ({
      TrafficMirrorFilterRuleId: r.TrafficMirrorFilterRuleId,
      TrafficMirrorFilterId: r.TrafficMirrorFilterId,
      TrafficDirection: r.TrafficDirection,
      RuleNumber: r.RuleNumber,
      RuleAction: r.RuleAction,
      Protocol: r.Protocol,
      DestinationPortRange: r.DestinationPortRange,
      SourcePortRange: r.SourcePortRange,
      DestinationCidrBlock: r.DestinationCidrBlock,
      SourceCidrBlock: r.SourceCidrBlock,
      Description: r.Description,
      Tags: r.Tags,
    })),
  };
};

const DescribeTrafficMirrorFilters: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TrafficMirrorFilterIds"]);
  const filters = allTrafficMirrorFilters(ctx).filter((f) => {
    if (ids.length > 0 && !ids.includes(f.TrafficMirrorFilterId)) return false;
    return true;
  });
  return {
    TrafficMirrorFilters: filters.map((f) => ({
      TrafficMirrorFilterId: f.TrafficMirrorFilterId,
      IngressFilterRules: f.IngressFilterRules,
      EgressFilterRules: f.EgressFilterRules,
      NetworkServices: f.NetworkServices,
      Description: f.Description,
      Tags: f.Tags,
    })),
  };
};

const DescribeTrafficMirrorSessions: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TrafficMirrorSessionIds"]);
  const sessions = allTrafficMirrorSessions(ctx).filter((s) => {
    if (ids.length > 0 && !ids.includes(s.TrafficMirrorSessionId)) return false;
    return true;
  });
  return {
    TrafficMirrorSessions: sessions.map((s) => ({
      TrafficMirrorSessionId: s.TrafficMirrorSessionId,
      TrafficMirrorTargetId: s.TrafficMirrorTargetId,
      TrafficMirrorFilterId: s.TrafficMirrorFilterId,
      NetworkInterfaceId: s.NetworkInterfaceId,
      OwnerId: s.OwnerId,
      PacketLength: s.PacketLength,
      SessionNumber: s.SessionNumber,
      VirtualNetworkId: s.VirtualNetworkId,
      Description: s.Description,
      Tags: s.Tags,
    })),
  };
};

const DescribeTrafficMirrorTargets: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TrafficMirrorTargetIds"]);
  const targets = allTrafficMirrorTargets(ctx).filter((t) => {
    if (ids.length > 0 && !ids.includes(t.TrafficMirrorTargetId)) return false;
    return true;
  });
  return {
    TrafficMirrorTargets: targets.map((t) => ({
      TrafficMirrorTargetId: t.TrafficMirrorTargetId,
      NetworkInterfaceId: t.NetworkInterfaceId,
      NetworkLoadBalancerArn: t.NetworkLoadBalancerArn,
      Type: t.Type,
      Description: t.Description,
      OwnerId: t.OwnerId,
      GatewayLoadBalancerEndpointId: t.GatewayLoadBalancerEndpointId,
      Tags: t.Tags,
    })),
  };
};

const DescribeTransitGatewayAttachments: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayAttachmentIds"]);
  type AttachmentItem = {
    TransitGatewayAttachmentId: string;
    TransitGatewayId: string;
    TransitGatewayOwnerId: string;
    ResourceOwnerId: string;
    ResourceType: string;
    ResourceId: string;
    State: string;
    Tags: Tag[];
  };
  const items: AttachmentItem[] = [];
  for (const a of allTransitGatewayVpcAttachments(ctx)) {
    items.push({
      TransitGatewayAttachmentId: a.TransitGatewayAttachmentId,
      TransitGatewayId: a.TransitGatewayId,
      TransitGatewayOwnerId: ctx.account,
      ResourceOwnerId: a.VpcOwnerId,
      ResourceType: "vpc",
      ResourceId: a.VpcId,
      State: a.State,
      Tags: a.Tags,
    });
  }
  for (const c of allTransitGatewayConnects(ctx)) {
    items.push({
      TransitGatewayAttachmentId: c.TransitGatewayAttachmentId,
      TransitGatewayId: c.TransitGatewayId,
      TransitGatewayOwnerId: ctx.account,
      ResourceOwnerId: ctx.account,
      ResourceType: "connect",
      ResourceId: c.TransportTransitGatewayAttachmentId,
      State: c.State,
      Tags: c.Tags,
    });
  }
  for (const p of allTransitGatewayPeeringAttachments(ctx)) {
    items.push({
      TransitGatewayAttachmentId: p.TransitGatewayAttachmentId,
      TransitGatewayId: p.RequesterTgwInfo.TransitGatewayId,
      TransitGatewayOwnerId: p.RequesterTgwInfo.OwnerId,
      ResourceOwnerId: p.AccepterTgwInfo.OwnerId,
      ResourceType: "peering",
      ResourceId: p.AccepterTgwInfo.TransitGatewayId,
      State: p.State,
      Tags: p.Tags,
    });
  }
  const filtered = items.filter((a) => {
    if (ids.length > 0 && !ids.includes(a.TransitGatewayAttachmentId))
      return false;
    return true;
  });
  return { TransitGatewayAttachments: filtered };
};

const DescribeTransitGatewayConnectPeers: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayConnectPeerIds"]);
  const peers = allTransitGatewayConnectPeers(ctx).filter((p) => {
    if (ids.length > 0 && !ids.includes(p.TransitGatewayConnectPeerId))
      return false;
    return true;
  });
  return {
    TransitGatewayConnectPeers: peers.map((p) => ({
      TransitGatewayAttachmentId: p.TransitGatewayAttachmentId,
      TransitGatewayConnectPeerId: p.TransitGatewayConnectPeerId,
      State: p.State,
      CreationTime: p.CreationTime,
      ConnectPeerConfiguration: p.ConnectPeerConfiguration,
      Tags: p.Tags,
    })),
  };
};

const DescribeTransitGatewayConnects: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayConnectIds"]);
  const connects = allTransitGatewayConnects(ctx).filter((c) => {
    if (ids.length > 0 && !ids.includes(c.TransitGatewayAttachmentId))
      return false;
    return true;
  });
  return {
    TransitGatewayConnects: connects.map((c) => ({
      TransitGatewayAttachmentId: c.TransitGatewayAttachmentId,
      TransportTransitGatewayAttachmentId:
        c.TransportTransitGatewayAttachmentId,
      TransitGatewayId: c.TransitGatewayId,
      State: c.State,
      CreationTime: c.CreationTime,
      Options: c.Options,
      Tags: c.Tags,
    })),
  };
};

const DescribeTransitGatewayMeteringPolicies: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["TransitGatewayMeteringPolicyIds"]);
  const policies = allTransitGatewayMeteringPolicies(ctx).filter((p) => {
    if (ids.length > 0 && !ids.includes(p.TransitGatewayMeteringPolicyId))
      return false;
    return true;
  });
  return {
    TransitGatewayMeteringPolicies: policies.map((p) => ({
      TransitGatewayMeteringPolicyId: p.TransitGatewayMeteringPolicyId,
      TransitGatewayId: p.TransitGatewayId,
      MiddleboxAttachmentIds: p.MiddleboxAttachmentIds,
      State: p.State,
      UpdateEffectiveAt: p.UpdateEffectiveAt,
      Tags: p.Tags,
    })),
  };
};

const DescribeTransitGatewayMulticastDomains: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["TransitGatewayMulticastDomainIds"]);
  const domains = allTransitGatewayMulticastDomains(ctx).filter((d) => {
    if (ids.length > 0 && !ids.includes(d.TransitGatewayMulticastDomainId))
      return false;
    return true;
  });
  return {
    TransitGatewayMulticastDomains: domains.map((d) => ({
      TransitGatewayMulticastDomainId: d.TransitGatewayMulticastDomainId,
      TransitGatewayId: d.TransitGatewayId,
      TransitGatewayMulticastDomainArn: d.TransitGatewayMulticastDomainArn,
      OwnerId: d.OwnerId,
      Options: d.Options,
      State: d.State,
      CreationTime: d.CreationTime,
      Tags: d.Tags,
    })),
  };
};

const DescribeTransitGatewayPeeringAttachments: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["TransitGatewayAttachmentIds"]);
  const attachments = allTransitGatewayPeeringAttachments(ctx).filter((a) => {
    if (ids.length > 0 && !ids.includes(a.TransitGatewayAttachmentId))
      return false;
    return true;
  });
  return {
    TransitGatewayPeeringAttachments: attachments.map((a) => ({
      TransitGatewayAttachmentId: a.TransitGatewayAttachmentId,
      AccepterTransitGatewayAttachmentId: a.AccepterTransitGatewayAttachmentId,
      RequesterTgwInfo: a.RequesterTgwInfo,
      AccepterTgwInfo: a.AccepterTgwInfo,
      Options: a.Options,
      Status: a.Status,
      State: a.State,
      CreationTime: a.CreationTime,
      Tags: a.Tags,
    })),
  };
};

const DescribeTransitGatewayPolicyTables: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayPolicyTableIds"]);
  const tables = allTransitGatewayPolicyTables(ctx).filter((t) => {
    if (ids.length > 0 && !ids.includes(t.TransitGatewayPolicyTableId))
      return false;
    return true;
  });
  return {
    TransitGatewayPolicyTables: tables.map((t) => ({
      TransitGatewayPolicyTableId: t.TransitGatewayPolicyTableId,
      TransitGatewayId: t.TransitGatewayId,
      State: t.State,
      CreationTime: t.CreationTime,
      Tags: t.Tags,
    })),
  };
};

const DescribeTransitGatewayRouteTableAnnouncements: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["TransitGatewayRouteTableAnnouncementIds"]);
  const announcements = allTransitGatewayRouteTableAnnouncements(ctx).filter(
    (a) => {
      if (
        ids.length > 0 &&
        !ids.includes(a.TransitGatewayRouteTableAnnouncementId)
      )
        return false;
      return true;
    },
  );
  return {
    TransitGatewayRouteTableAnnouncements: announcements.map((a) => ({
      TransitGatewayRouteTableAnnouncementId:
        a.TransitGatewayRouteTableAnnouncementId,
      TransitGatewayId: a.TransitGatewayId,
      PeerTransitGatewayId: a.PeerTransitGatewayId,
      PeeringAttachmentId: a.PeeringAttachmentId,
      AnnouncementDirection: a.AnnouncementDirection,
      TransitGatewayRouteTableId: a.TransitGatewayRouteTableId,
      State: a.State,
      CreationTime: a.CreationTime,
      Tags: a.Tags,
    })),
  };
};

const DescribeTransitGatewayRouteTables: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayRouteTableIds"]);
  const tables = allTransitGatewayRouteTables(ctx).filter((t) => {
    if (ids.length > 0 && !ids.includes(t.TransitGatewayRouteTableId))
      return false;
    return true;
  });
  return {
    TransitGatewayRouteTables: tables.map((t) => ({
      TransitGatewayRouteTableId: t.TransitGatewayRouteTableId,
      TransitGatewayId: t.TransitGatewayId,
      State: t.State,
      DefaultAssociationRouteTable: t.DefaultAssociationRouteTable,
      DefaultPropagationRouteTable: t.DefaultPropagationRouteTable,
      CreationTime: t.CreationTime,
      Tags: t.Tags,
    })),
  };
};

const DescribeTransitGatewayVpcAttachments: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayAttachmentIds"]);
  const attachments = allTransitGatewayVpcAttachments(ctx).filter((a) => {
    if (ids.length > 0 && !ids.includes(a.TransitGatewayAttachmentId))
      return false;
    return true;
  });
  return {
    TransitGatewayVpcAttachments: attachments.map((a) => ({
      TransitGatewayAttachmentId: a.TransitGatewayAttachmentId,
      TransitGatewayId: a.TransitGatewayId,
      VpcId: a.VpcId,
      VpcOwnerId: a.VpcOwnerId,
      State: a.State,
      SubnetIds: a.SubnetIds,
      CreationTime: a.CreationTime,
      Options: a.Options,
      Tags: a.Tags,
    })),
  };
};

const DescribeTransitGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["TransitGatewayIds"]);
  const gateways = allTransitGateways(ctx).filter((g) => {
    if (ids.length > 0 && !ids.includes(g.TransitGatewayId)) return false;
    return true;
  });
  return {
    TransitGateways: gateways.map((g) => ({
      TransitGatewayId: g.TransitGatewayId,
      TransitGatewayArn: g.TransitGatewayArn,
      State: g.State,
      OwnerId: g.OwnerId,
      Description: g.Description,
      CreationTime: g.CreationTime,
      Options: g.Options,
      Tags: g.Tags,
    })),
  };
};

const DescribeTrunkInterfaceAssociations: OperationHandler = (_input, _ctx) => {
  return { InterfaceAssociations: [] };
};

const DescribeVerifiedAccessEndpoints: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VerifiedAccessEndpointIds"]);
  const instanceId =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : undefined;
  const groupId =
    typeof input["VerifiedAccessGroupId"] === "string"
      ? input["VerifiedAccessGroupId"]
      : undefined;
  const endpoints = allVerifiedAccessEndpoints(ctx).filter((e) => {
    if (ids.length > 0 && !ids.includes(e.VerifiedAccessEndpointId))
      return false;
    if (instanceId && e.VerifiedAccessInstanceId !== instanceId) return false;
    if (groupId && e.VerifiedAccessGroupId !== groupId) return false;
    return true;
  });
  return {
    VerifiedAccessEndpoints: endpoints.map((e) => ({
      VerifiedAccessInstanceId: e.VerifiedAccessInstanceId,
      VerifiedAccessGroupId: e.VerifiedAccessGroupId,
      VerifiedAccessEndpointId: e.VerifiedAccessEndpointId,
      ApplicationDomain: e.ApplicationDomain,
      EndpointType: e.EndpointType,
      AttachmentType: e.AttachmentType,
      DomainCertificateArn: e.DomainCertificateArn,
      EndpointDomain: e.EndpointDomain,
      SecurityGroupIds: e.SecurityGroupIds,
      Status: { Code: "active", Message: "" },
      Description: e.Description,
      CreationTime: e.CreationTime,
      LastUpdatedTime: e.LastUpdatedTime,
      Tags: e.Tags,
    })),
  };
};

const DescribeVerifiedAccessGroups: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VerifiedAccessGroupIds"]);
  const instanceId =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : undefined;
  const groups = allVerifiedAccessGroups(ctx).filter((g) => {
    if (ids.length > 0 && !ids.includes(g.VerifiedAccessGroupId)) return false;
    if (instanceId && g.VerifiedAccessInstanceId !== instanceId) return false;
    return true;
  });
  return {
    VerifiedAccessGroups: groups.map((g) => ({
      VerifiedAccessGroupId: g.VerifiedAccessGroupId,
      VerifiedAccessInstanceId: g.VerifiedAccessInstanceId,
      Description: g.Description,
      Owner: g.Owner,
      VerifiedAccessGroupArn: g.VerifiedAccessGroupArn,
      CreationTime: g.CreationTime,
      LastUpdatedTime: g.LastUpdatedTime,
      Tags: g.Tags,
    })),
  };
};

const DescribeVerifiedAccessInstanceLoggingConfigurations: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["VerifiedAccessInstanceIds"]);
  const instances = allVerifiedAccessInstances(ctx).filter((i) => {
    if (ids.length > 0 && !ids.includes(i.VerifiedAccessInstanceId))
      return false;
    return true;
  });
  return {
    LoggingConfigurations: instances.map((i) => ({
      VerifiedAccessInstanceId: i.VerifiedAccessInstanceId,
      AccessLogs: i.AccessLogs ?? {
        S3: { Enabled: false },
        CloudWatchLogs: { Enabled: false },
        KinesisDataFirehose: { Enabled: false },
        LogVersion: "ocsf-0.1",
        IncludeTrustContext: false,
      },
    })),
  };
};

const DescribeVerifiedAccessInstances: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VerifiedAccessInstanceIds"]);
  const instances = allVerifiedAccessInstances(ctx).filter((i) => {
    if (ids.length > 0 && !ids.includes(i.VerifiedAccessInstanceId))
      return false;
    return true;
  });
  return {
    VerifiedAccessInstances: instances.map((i) => ({
      VerifiedAccessInstanceId: i.VerifiedAccessInstanceId,
      Description: i.Description,
      VerifiedAccessTrustProviders: i.TrustProviderIds.map((id) => ({
        VerifiedAccessTrustProviderId: id,
        TrustProviderType: "user",
      })),
      CreationTime: i.CreationTime,
      LastUpdatedTime: i.LastUpdatedTime,
      Tags: i.Tags,
      FipsEnabled: i.FipsEnabled,
    })),
  };
};

const DescribeVerifiedAccessTrustProviders: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VerifiedAccessTrustProviderIds"]);
  const providers = allVerifiedAccessTrustProviders(ctx).filter((p) => {
    if (ids.length > 0 && !ids.includes(p.VerifiedAccessTrustProviderId))
      return false;
    return true;
  });
  return {
    VerifiedAccessTrustProviders: providers.map((p) => ({
      VerifiedAccessTrustProviderId: p.VerifiedAccessTrustProviderId,
      TrustProviderType: p.TrustProviderType,
      PolicyReferenceName: p.PolicyReferenceName,
      CreationTime: p.CreationTime,
      LastUpdatedTime: p.LastUpdatedTime,
      Tags: [],
    })),
  };
};

const DescribeVolumeAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const attribute =
    typeof input["Attribute"] === "string" ? input["Attribute"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(id));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${id}' does not exist.`,
      400,
    );
  }
  const result: Record<string, unknown> = { VolumeId: id };
  if (attribute === "autoEnableIO") {
    result["AutoEnableIO"] = { Value: false };
  } else if (attribute === "productCodes") {
    result["ProductCodes"] = [];
  }
  return result;
};

const DescribeVolumeStatus: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VolumeIds"]);
  const volumes = allVolumes(ctx).filter((v) =>
    ids.length === 0 ? true : ids.includes(v.VolumeId),
  );
  return {
    VolumeStatuses: volumes.map((v) => ({
      VolumeId: v.VolumeId,
      AvailabilityZone: v.AvailabilityZone,
      VolumeStatus: {
        Status: "ok",
        Details: [
          { Name: "io-enabled", Status: "passed" },
          { Name: "io-performance", Status: "not-applicable" },
        ],
      },
      Events: [],
      Actions: [],
    })),
  };
};

const DescribeVolumesModifications: OperationHandler = (_input, _ctx) => {
  return { VolumesModifications: [] };
};

const DescribeVpcAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const attribute =
    typeof input["Attribute"] === "string" ? input["Attribute"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(id));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${id}' does not exist`,
      400,
    );
  }
  const result: Record<string, unknown> = { VpcId: id };
  if (attribute === "enableDnsHostnames") {
    result["EnableDnsHostnames"] = { Value: vpc.EnableDnsHostnames ?? true };
  } else if (attribute === "enableDnsSupport") {
    result["EnableDnsSupport"] = { Value: vpc.EnableDnsSupport ?? true };
  } else if (attribute === "enableNetworkAddressUsageMetrics") {
    result["EnableNetworkAddressUsageMetrics"] = {
      Value: vpc.EnableNetworkAddressUsageMetrics ?? false,
    };
  }
  return result;
};

const DescribeNetworkInterfaceAttribute: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const ni = ctx.store.get<StoredNetworkInterface>(networkInterfaceKey(id));
  if (ni === undefined) {
    throw awsError(
      "InvalidNetworkInterfaceID.NotFound",
      `The network interface '${id}' does not exist`,
      400,
    );
  }
  return {
    NetworkInterfaceId: ni.NetworkInterfaceId,
    Description: { Value: ni.Description },
    Groups: ni.Groups.map((g) => ({
      GroupId: g.GroupId,
      GroupName: g.GroupName,
    })),
    SourceDestCheck: { Value: ni.SourceDestCheck },
  };
};

const allVpcEndpoints = (ctx: ServiceContext): StoredVpcEndpoint[] =>
  ctx.store
    .list<StoredVpcEndpoint>()
    .filter((entry) => entry.key.startsWith("vpce/"))
    .map((entry) => entry.value);

const allVpcEndpointConnectionNotifications = (
  ctx: ServiceContext,
): StoredVpcEndpointConnectionNotification[] =>
  ctx.store
    .list<StoredVpcEndpointConnectionNotification>()
    .filter((entry) => entry.key.startsWith("vpce-cn/"))
    .map((entry) => entry.value);

const allVpcEndpointServiceConfigurations = (
  ctx: ServiceContext,
): StoredVpcEndpointServiceConfiguration[] =>
  ctx.store
    .list<StoredVpcEndpointServiceConfiguration>()
    .filter((entry) => entry.key.startsWith("vpce-svc/"))
    .map((entry) => entry.value);

const allVpcBlockPublicAccessExclusions = (
  ctx: ServiceContext,
): StoredVpcBlockPublicAccessExclusion[] =>
  ctx.store
    .list<StoredVpcBlockPublicAccessExclusion>()
    .filter((entry) => entry.key.startsWith("vpce-bpa/"))
    .map((entry) => entry.value);

const allVpcEncryptionControls = (
  ctx: ServiceContext,
): StoredVpcEncryptionControl[] =>
  ctx.store
    .list<StoredVpcEncryptionControl>()
    .filter((entry) => entry.key.startsWith("vpce-enc/"))
    .map((entry) => entry.value);

const DescribeVpcBlockPublicAccessExclusions: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["ExclusionIds"]);
  const exclusions = allVpcBlockPublicAccessExclusions(ctx).filter((e) =>
    ids.length === 0 ? true : ids.includes(e.ExclusionId),
  );
  return {
    VpcBlockPublicAccessExclusions: exclusions.map((e) => ({
      ExclusionId: e.ExclusionId,
      InternetGatewayExclusionMode: e.InternetGatewayExclusionMode,
      ResourceArn: e.ResourceArn,
      State: e.State,
      CreationTimestamp: e.CreationTimestamp,
      LastUpdateTimestamp: e.LastUpdateTimestamp,
      Tags: e.Tags,
    })),
  };
};

const DescribeVpcBlockPublicAccessOptions: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    VpcBlockPublicAccessOptions: {
      AwsAccountId: _ctx.account,
      AwsRegion: _ctx.region,
      State: "default-enabled",
      InternetGatewayBlockMode: "off",
      LastUpdateTimestamp: new Date().toISOString(),
    },
  };
};

const DescribeVpcClassicLink: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpcIds"]);
  const vpcs = allVpcs(ctx).filter(
    (v) => ids.length === 0 || ids.includes(v.VpcId),
  );
  return {
    Vpcs: vpcs.map((v) => {
      const cl = ctx.store.get<{ enabled: boolean }>(
        vpcClassicLinkKey(v.VpcId),
      );
      return {
        VpcId: v.VpcId,
        ClassicLinkEnabled: cl?.enabled ?? false,
        Tags: v.Tags,
      };
    }),
  };
};

const DescribeVpcClassicLinkDnsSupport: OperationHandler = (_input, _ctx) => {
  return { Vpcs: [] };
};

const DescribeVpcEncryptionControls: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpcEncryptionControlIds"]);
  const vpcIds = stringList(input["VpcIds"]);
  const controls = allVpcEncryptionControls(ctx).filter((c) => {
    if (ids.length > 0 && !ids.includes(c.VpcEncryptionControlId)) return false;
    if (vpcIds.length > 0 && !vpcIds.includes(c.VpcId)) return false;
    return true;
  });
  return {
    VpcEncryptionControls: controls.map((c) => ({
      VpcEncryptionControlId: c.VpcEncryptionControlId,
      VpcId: c.VpcId,
      Mode: c.Mode,
      State: c.State,
      Tags: c.Tags,
    })),
  };
};

const DescribeVpcEndpointAssociations: OperationHandler = (_input, _ctx) => {
  return { VpcEndpointAssociations: [] };
};

const DescribeVpcEndpointConnectionNotifications: OperationHandler = (
  input,
  ctx,
) => {
  const filterId =
    typeof input["ConnectionNotificationId"] === "string"
      ? input["ConnectionNotificationId"]
      : undefined;
  const notifications = allVpcEndpointConnectionNotifications(ctx).filter(
    (n) =>
      filterId === undefined ? true : n.ConnectionNotificationId === filterId,
  );
  return {
    ConnectionNotificationSet: notifications.map((n) => ({
      ConnectionNotificationId: n.ConnectionNotificationId,
      ServiceId: n.ServiceId,
      VpcEndpointId: n.VpcEndpointId,
      ConnectionNotificationType: n.ConnectionNotificationType,
      ConnectionNotificationArn: n.ConnectionNotificationArn,
      ConnectionEvents: n.ConnectionEvents,
      ConnectionNotificationState: n.ConnectionNotificationState,
    })),
  };
};

const DescribeVpcEndpointConnections: OperationHandler = (_input, _ctx) => {
  return { VpcEndpointConnections: [] };
};

const DescribeVpcEndpointServiceConfigurations: OperationHandler = (
  input,
  ctx,
) => {
  const ids = stringList(input["ServiceIds"]);
  const configs = allVpcEndpointServiceConfigurations(ctx).filter((c) =>
    ids.length === 0 ? true : ids.includes(c.ServiceId),
  );
  return {
    ServiceConfigurations: configs.map((c) => ({
      ServiceId: c.ServiceId,
      ServiceName: c.ServiceName,
      ServiceState: c.ServiceState,
      AcceptanceRequired: c.AcceptanceRequired,
      NetworkLoadBalancerArns: c.NetworkLoadBalancerArns,
      GatewayLoadBalancerArns: c.GatewayLoadBalancerArns,
      PrivateDnsName: c.PrivateDnsName,
      Tags: c.Tags,
    })),
  };
};

const DescribeVpcEndpointServicePermissions: OperationHandler = (
  _input,
  _ctx,
) => {
  return { AllowedPrincipals: [] };
};

const awsManagedEndpointServices = (region: string) => {
  const svcs = [
    "s3",
    "ec2",
    "sts",
    "elasticloadbalancing",
    "rds",
    "dynamodb",
    "sns",
    "sqs",
    "ssm",
    "secretsmanager",
  ];
  return svcs.map((svc) => ({
    ServiceName: `com.amazonaws.${region}.${svc}`,
    ServiceType: [
      {
        ServiceType:
          svc === "s3" || svc === "dynamodb" ? "Gateway" : "Interface",
      },
    ],
    ServiceId: `vpce-svc-managed-${svc}`,
    Owner: "amazon",
    BaseEndpointDnsNames: [`${svc}.${region}.vpce.amazonaws.com`],
    PrivateDnsName: `${svc}.${region}.amazonaws.com`,
    VpcEndpointPolicySupported: true,
    AcceptanceRequired: false,
    ManagesVpcEndpoints: false,
    Tags: [],
  }));
};

const DescribeVpcEndpointServices: OperationHandler = (input, ctx) => {
  const filterNames = stringList(input["ServiceNames"]);
  const managed = awsManagedEndpointServices(ctx.region);
  const userConfigs = allVpcEndpointServiceConfigurations(ctx).map((c) => ({
    ServiceName: c.ServiceName,
    ServiceType: [{ ServiceType: "Interface" as const }],
    ServiceId: c.ServiceId,
    Owner: ctx.account,
    BaseEndpointDnsNames: [],
    VpcEndpointPolicySupported: false,
    AcceptanceRequired: c.AcceptanceRequired,
    ManagesVpcEndpoints: false,
    Tags: c.Tags,
  }));
  const allServices = [...managed, ...userConfigs];
  const filtered =
    filterNames.length === 0
      ? allServices
      : allServices.filter((s) => filterNames.includes(s.ServiceName));
  return {
    ServiceNames: filtered.map((s) => s.ServiceName),
    ServiceDetails: filtered,
  };
};

const DescribeVpcEndpoints: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpcEndpointIds"]);
  const endpoints = allVpcEndpoints(ctx).filter((e) =>
    ids.length === 0 ? true : ids.includes(e.VpcEndpointId),
  );
  return {
    VpcEndpoints: endpoints.map((e) => ({
      VpcEndpointId: e.VpcEndpointId,
      VpcEndpointType: e.VpcEndpointType,
      VpcId: e.VpcId,
      ServiceName: e.ServiceName,
      State: e.State,
      RouteTableIds: e.RouteTableIds,
      SubnetIds: e.SubnetIds,
      Groups: e.Groups,
      IpAddressType: e.IpAddressType,
      PrivateDnsEnabled: e.PrivateDnsEnabled,
      OwnerId: e.OwnerId,
      CreationTimestamp: e.CreationTimestamp,
      Tags: e.Tags,
    })),
  };
};

const DescribeVpcPeeringConnections: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpcPeeringConnectionIds"]);
  const connections = allVpcPeeringConnections(ctx).filter((c) =>
    ids.length === 0 ? true : ids.includes(c.VpcPeeringConnectionId),
  );
  return {
    VpcPeeringConnections: connections.map((c) => ({
      VpcPeeringConnectionId: c.VpcPeeringConnectionId,
      AccepterVpcInfo: { VpcId: c.AccepterVpcId, OwnerId: ctx.account },
      RequesterVpcInfo: { VpcId: c.RequesterVpcId, OwnerId: ctx.account },
      Status: c.Status,
      Tags: c.Tags,
    })),
  };
};

const DescribeVpnConcentrators: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpnConcentratorIds"]);
  const concentrators = allVpnConcentrators(ctx).filter((c) =>
    ids.length === 0 ? true : ids.includes(c.VpnConcentratorId),
  );
  return {
    VpnConcentrators: concentrators.map((c) => ({
      VpnConcentratorId: c.VpnConcentratorId,
      State: c.State,
      TransitGatewayId: c.TransitGatewayId,
      Type: c.Type,
      Tags: c.Tags,
    })),
  };
};

const DescribeVpnConnections: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpnConnectionIds"]);
  const connections = allVpnConnections(ctx).filter((c) =>
    ids.length === 0 ? true : ids.includes(c.VpnConnectionId),
  );
  return {
    VpnConnections: connections.map((c) => ({
      VpnConnectionId: c.VpnConnectionId,
      State: c.State,
      CustomerGatewayId: c.CustomerGatewayId,
      VpnGatewayId: c.VpnGatewayId,
      TransitGatewayId: c.TransitGatewayId,
      Type: c.Type,
      Tags: c.Tags,
      Routes: [],
      VgwTelemetry: [],
    })),
  };
};

const DescribeVpnGateways: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VpnGatewayIds"]);
  const gateways = allVpnGateways(ctx).filter((g) =>
    ids.length === 0 ? true : ids.includes(g.VpnGatewayId),
  );
  return {
    VpnGateways: gateways.map((g) => ({
      VpnGatewayId: g.VpnGatewayId,
      State: g.State,
      VpcAttachments: g.VpcAttachments,
    })),
  };
};

const DisableAddressTransfer: OperationHandler = (input, ctx) => {
  const allocationId =
    typeof input["AllocationId"] === "string" ? input["AllocationId"] : "";
  const address = ctx.store.get<StoredAddress>(addressKey(allocationId));
  if (address === undefined) {
    throw awsError(
      "InvalidAllocationID.NotFound",
      `The allocation ID '${allocationId}' does not exist`,
      400,
    );
  }
  return {
    AddressTransfer: {
      AllocationId: address.AllocationId,
      PublicIp: address.PublicIp,
      AddressTransferStatus: "disabled",
    },
  };
};

const DisableAllowedImagesSettings: OperationHandler = (_input, ctx) => {
  ctx.store.set(allowedImagesSettingsKey(), { state: "disabled" });
  return { AllowedImagesSettingsState: "disabled" };
};

const DisableAwsNetworkPerformanceMetricSubscription: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Output: true };
};

const DisableCapacityManager: OperationHandler = (_input, _ctx) => {
  return {
    CapacityManagerStatus: "disabled",
    OrganizationsAccess: false,
  };
};

const DisableEbsEncryptionByDefault: OperationHandler = (_input, ctx) => {
  ctx.store.set(ebsEncryptionByDefaultKey(), { enabled: false });
  return { EbsEncryptionByDefault: false };
};

const DisableFastLaunch: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  return {
    ImageId: imageId,
    OwnerId: image.OwnerId,
    State: "disabling",
    StateTransitionReason: "Client.UserInitiated",
  };
};

const DisableFastSnapshotRestores: OperationHandler = (input, ctx) => {
  const snapshotIds = stringList(input["SourceSnapshotIds"]);
  const azs = stringList(input["AvailabilityZones"]);
  const effectiveAzs = azs.length > 0 ? azs : [`${ctx.region}a`];
  const successful = snapshotIds.flatMap((snapId) =>
    effectiveAzs.map((az) => ({
      SnapshotId: snapId,
      AvailabilityZone: az,
      State: "disabling",
      StateTransitionReason: "Client.UserInitiated",
      OwnerId: ctx.account,
    })),
  );
  return { Successful: successful, Unsuccessful: [] };
};

const DisableImage: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  ctx.store.set(imageKey(imageId), { ...image, State: "disabled" });
  return { Return: true };
};

const DisableImageBlockPublicAccess: OperationHandler = (_input, ctx) => {
  ctx.store.set(imageBlockPublicAccessKey(), { state: "unblocked" });
  return { ImageBlockPublicAccessState: "unblocked" };
};

const DisableImageDeprecation: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  ctx.store.set(imageKey(imageId), { ...image, DeprecationTime: undefined });
  return { Return: true };
};

const DisableImageDeregistrationProtection: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  return { Return: "successful" };
};

const DisableInstanceSqlHaStandbyDetections: OperationHandler = (
  input,
  _ctx,
) => {
  const instanceIds = stringList(input["InstanceIds"]);
  return {
    Instances: instanceIds.map((id) => ({ InstanceId: id })),
  };
};

const DisableIpamOrganizationAdminAccount: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Success: true };
};

const DisableIpamPolicy: OperationHandler = (input, ctx) => {
  const policyId =
    typeof input["IpamPolicyId"] === "string" ? input["IpamPolicyId"] : "";
  const policy = ctx.store.get<StoredIpamPolicy>(ipamPolicyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "InvalidIpamPolicyId.NotFound",
      `The IPAM policy ID '${policyId}' does not exist`,
      400,
    );
  }
  return { Return: true };
};

const DisableRouteServerPropagation: OperationHandler = (input, _ctx) => {
  const routeServerId =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const routeTableId =
    typeof input["RouteTableId"] === "string" ? input["RouteTableId"] : "";
  return {
    RouteServerPropagation: {
      RouteServerId: routeServerId,
      RouteTableId: routeTableId,
      State: "deleting",
    },
  };
};

const DisableSerialConsoleAccess: OperationHandler = (_input, ctx) => {
  ctx.store.set(serialConsoleAccessKey(), { enabled: false });
  return { SerialConsoleAccessEnabled: false };
};

const DisableSnapshotBlockPublicAccess: OperationHandler = (_input, ctx) => {
  ctx.store.set(snapshotBlockPublicAccessKey(), { state: "unblocked" });
  return { State: "unblocked" };
};

const DisableTransitGatewayRouteTablePropagation: OperationHandler = (
  input,
  _ctx,
) => {
  const rtbId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : undefined;
  return {
    Propagation: {
      TransitGatewayRouteTableId: rtbId,
      TransitGatewayAttachmentId: attachmentId,
      State: "disabled",
    },
  };
};

const DisableVgwRoutePropagation: OperationHandler = (_input, _ctx) => {
  return {};
};

const DisableVpcClassicLink: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  ctx.store.set(vpcClassicLinkKey(vpcId), { enabled: false });
  return { Return: true };
};

const DisableVpcClassicLinkDnsSupport: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const DisassociateAddress: OperationHandler = (input, ctx) => {
  const associationId =
    typeof input["AssociationId"] === "string"
      ? input["AssociationId"]
      : undefined;
  if (associationId !== undefined) {
    const address = allAddresses(ctx).find(
      (a) => a.AssociationId === associationId,
    );
    if (address !== undefined) {
      address.AssociationId = undefined;
      address.InstanceId = undefined;
      ctx.store.set(addressKey(address.AllocationId), address);
    }
  }
  return {};
};

const DisassociateCapacityReservationBillingOwner: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Return: true };
};

const DisassociateClientVpnTargetNetwork: OperationHandler = (input, _ctx) => {
  const associationId =
    typeof input["AssociationId"] === "string" ? input["AssociationId"] : "";
  return {
    AssociationId: associationId,
    Status: { Code: "disassociating", Message: "" },
  };
};

const DisassociateEnclaveCertificateIamRole: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Return: true };
};

const DisassociateIamInstanceProfile: OperationHandler = (input, ctx) => {
  const associationId =
    typeof input["AssociationId"] === "string" ? input["AssociationId"] : "";
  const association = ctx.store.get<StoredIamInstanceProfileAssociation>(
    iamProfileAssocKey(associationId),
  );
  if (association === undefined) {
    throw awsError(
      "InvalidAssociationID.NotFound",
      `The association ID '${associationId}' does not exist`,
      400,
    );
  }
  ctx.store.delete(iamProfileAssocKey(associationId));
  return {
    IamInstanceProfileAssociation: {
      AssociationId: association.AssociationId,
      InstanceId: association.InstanceId,
      IamInstanceProfile: association.IamInstanceProfile,
      State: "disassociated",
      Timestamp: association.Timestamp,
    },
  };
};

const DisassociateInstanceEventWindow: OperationHandler = (input, _ctx) => {
  const eventWindowId =
    typeof input["InstanceEventWindowId"] === "string"
      ? input["InstanceEventWindowId"]
      : hexId("iew");
  return {
    InstanceEventWindow: {
      InstanceEventWindowId: eventWindowId,
      AssociationTarget: {
        InstanceIds: [],
        Tags: [],
        DedicatedHostIds: [],
      },
      State: "active",
    },
  };
};

const DisassociateIpamByoasn: OperationHandler = (input, ctx) => {
  const asn = typeof input["Asn"] === "string" ? input["Asn"] : "";
  const association = allIpamByoasnAssociations(ctx).find((a) => a.Asn === asn);
  if (association !== undefined) {
    ctx.store.delete(ipamByoasnKey(association.IpamId, association.Asn));
  }
  return {
    AsnAssociation: {
      Asn: association?.Asn ?? asn,
      IpamId: association?.IpamId ?? "",
      IpamArn: association?.IpamArn ?? "",
      StatusMessage: "BYOASN disassociated",
      State: "disassociate-complete",
    },
  };
};

const DisassociateIpamResourceDiscovery: OperationHandler = (input, ctx) => {
  const assocId =
    typeof input["IpamResourceDiscoveryAssociationId"] === "string"
      ? input["IpamResourceDiscoveryAssociationId"]
      : "";
  const association = ctx.store.get<StoredIpamResourceDiscoveryAssociation>(
    ipamRdAssocKey(assocId),
  );
  if (association !== undefined) {
    ctx.store.delete(ipamRdAssocKey(assocId));
  }
  return {
    IpamResourceDiscoveryAssociation:
      association !== undefined
        ? { ...association, State: "disassociate-complete" }
        : {
            IpamResourceDiscoveryAssociationId: assocId,
            IpamResourceDiscoveryAssociationArn: "",
            IpamResourceDiscoveryId: "",
            IpamId: "",
            IpamArn: "",
            OwnerId: ctx.account,
            IsDefault: false,
            ResourceDiscoveryStatus: "active",
            State: "disassociate-complete",
            Tags: [],
          },
  };
};

const DisassociateNatGatewayAddress: OperationHandler = (input, ctx) => {
  const natGatewayId =
    typeof input["NatGatewayId"] === "string" ? input["NatGatewayId"] : "";
  const associationIds = stringList(input["AssociationIds"]);
  const gateway = ctx.store.get<StoredNatGateway>(natGatewayKey(natGatewayId));
  if (gateway === undefined) {
    throw awsError(
      "NatGatewayNotFound",
      `The Nat Gateway '${natGatewayId}' does not exist`,
      400,
    );
  }
  const removed = gateway.NatGatewayAddresses.filter((a) =>
    associationIds.includes(a.AssociationId ?? ""),
  );
  gateway.NatGatewayAddresses = gateway.NatGatewayAddresses.filter(
    (a) => !associationIds.includes(a.AssociationId ?? ""),
  );
  ctx.store.set(natGatewayKey(natGatewayId), gateway);
  return { NatGatewayId: natGatewayId, NatGatewayAddresses: removed };
};

const DisassociateRouteServer: OperationHandler = (input, _ctx) => {
  const routeServerId =
    typeof input["RouteServerId"] === "string"
      ? input["RouteServerId"]
      : hexId("rs");
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  return {
    RouteServerAssociation: {
      RouteServerId: routeServerId,
      VpcId: vpcId,
      State: "disassociating",
    },
  };
};

const DisassociateRouteTable: OperationHandler = (input, ctx) => {
  const associationId =
    typeof input["AssociationId"] === "string" ? input["AssociationId"] : "";
  const tables = allRouteTables(ctx);
  for (const table of tables) {
    const idx = table.Associations.findIndex(
      (a) => a.RouteTableAssociationId === associationId,
    );
    if (idx !== -1) {
      table.Associations.splice(idx, 1);
      ctx.store.set(routeTableKey(table.RouteTableId), table);
      return {};
    }
  }
  throw awsError(
    "InvalidAssociationID.NotFound",
    `The association ID '${associationId}' does not exist`,
    400,
  );
};

const DisassociateSecurityGroupVpc: OperationHandler = (_input, _ctx) => {
  return { State: "disassociating" };
};

const DisassociateSubnetCidrBlock: OperationHandler = (input, _ctx) => {
  const assocId =
    typeof input["AssociationId"] === "string" ? input["AssociationId"] : "";
  return {
    SubnetId: hexId("subnet"),
    Ipv6CidrBlockAssociation: {
      AssociationId: assocId,
      Ipv6CidrBlock: "::/0",
      Ipv6CidrBlockState: { State: "disassociated", StatusMessage: "" },
    },
  };
};

const DisassociateTransitGatewayMulticastDomain: OperationHandler = (
  input,
  _ctx,
) => {
  const domainId =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : hexId("tgw-mcast");
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  const subnetIds = stringList(input["SubnetIds"]);
  return {
    Associations: {
      TransitGatewayMulticastDomainId: domainId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      Subnets: subnetIds.map((id) => ({
        SubnetId: id,
        State: "disassociated",
      })),
    },
  };
};

const DisassociateTransitGatewayPolicyTable: OperationHandler = (
  input,
  _ctx,
) => {
  const tableId =
    typeof input["TransitGatewayPolicyTableId"] === "string"
      ? input["TransitGatewayPolicyTableId"]
      : hexId("tgw-policy-table");
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  return {
    Association: {
      TransitGatewayPolicyTableId: tableId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      State: "disassociated",
    },
  };
};

const DisassociateTransitGatewayRouteTable: OperationHandler = (
  input,
  _ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : hexId("tgw-rtb");
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : hexId("tgw-attach");
  return {
    Association: {
      TransitGatewayRouteTableId: routeTableId,
      TransitGatewayAttachmentId: attachmentId,
      ResourceId: hexId("vpc"),
      ResourceType: "vpc",
      State: "disassociated",
    },
  };
};

const DisassociateTrunkInterface: OperationHandler = (_input, _ctx) => {
  return { Return: true, ClientToken: hexId("token") };
};

const DisassociateVpcCidrBlock: OperationHandler = (input, ctx) => {
  const assocId =
    typeof input["AssociationId"] === "string" ? input["AssociationId"] : "";
  const vpcs = allVpcs(ctx);
  for (const vpc of vpcs) {
    const cidrIdx = (vpc.CidrBlockAssociations ?? []).findIndex(
      (a) => a.AssociationId === assocId,
    );
    if (cidrIdx !== -1) {
      const assoc = vpc.CidrBlockAssociations[cidrIdx];
      vpc.CidrBlockAssociations.splice(cidrIdx, 1);
      ctx.store.set(vpcKey(vpc.VpcId), vpc);
      return {
        VpcId: vpc.VpcId,
        CidrBlockAssociation: {
          AssociationId: assocId,
          CidrBlock: assoc.CidrBlock,
          CidrBlockState: { State: "disassociated", StatusMessage: "" },
        },
      };
    }
    const ipv6Idx = (vpc.Ipv6CidrBlockAssociations ?? []).findIndex(
      (a) => a.AssociationId === assocId,
    );
    if (ipv6Idx !== -1) {
      const assoc = vpc.Ipv6CidrBlockAssociations[ipv6Idx];
      vpc.Ipv6CidrBlockAssociations.splice(ipv6Idx, 1);
      ctx.store.set(vpcKey(vpc.VpcId), vpc);
      return {
        VpcId: vpc.VpcId,
        Ipv6CidrBlockAssociation: {
          AssociationId: assocId,
          Ipv6CidrBlock: assoc.Ipv6CidrBlock,
          Ipv6CidrBlockState: { State: "disassociated", StatusMessage: "" },
        },
      };
    }
  }
  throw awsError(
    "InvalidVpcID.NotFound",
    `The association '${assocId}' does not exist`,
    400,
  );
};

const EnableAddressTransfer: OperationHandler = (input, ctx) => {
  const allocationId =
    typeof input["AllocationId"] === "string" ? input["AllocationId"] : "";
  const transferAccountId =
    typeof input["TransferAccountId"] === "string"
      ? input["TransferAccountId"]
      : "";
  const address = ctx.store.get<StoredAddress>(addressKey(allocationId));
  if (address === undefined) {
    throw awsError(
      "InvalidAllocationID.NotFound",
      `The allocation ID '${allocationId}' does not exist`,
      400,
    );
  }
  return {
    AddressTransfer: {
      AllocationId: address.AllocationId,
      PublicIp: address.PublicIp,
      TransferAccountId: transferAccountId,
      AddressTransferStatus: "pending",
    },
  };
};

const EnableAllowedImagesSettings: OperationHandler = (input, ctx) => {
  const state =
    typeof input["AllowedImagesSettingsState"] === "string"
      ? input["AllowedImagesSettingsState"]
      : "enabled";
  ctx.store.set(allowedImagesSettingsKey(), { state });
  return { AllowedImagesSettingsState: state };
};

const EnableAwsNetworkPerformanceMetricSubscription: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Output: true };
};

const EnableCapacityManager: OperationHandler = (input, _ctx) => {
  const orgsAccess =
    typeof input["OrganizationsAccess"] === "boolean"
      ? input["OrganizationsAccess"]
      : false;
  return {
    CapacityManagerStatus: "enabled",
    OrganizationsAccess: orgsAccess,
  };
};

const EnableEbsEncryptionByDefault: OperationHandler = (_input, ctx) => {
  ctx.store.set(ebsEncryptionByDefaultKey(), { enabled: true });
  return { EbsEncryptionByDefault: true };
};

const GetEbsEncryptionByDefault: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ enabled: boolean }>(
    ebsEncryptionByDefaultKey(),
  );
  return { EbsEncryptionByDefault: stored?.enabled ?? false };
};

const EnableSerialConsoleAccess: OperationHandler = (_input, ctx) => {
  ctx.store.set(serialConsoleAccessKey(), { enabled: true });
  return { SerialConsoleAccessEnabled: true };
};

const GetSerialConsoleAccessStatus: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ enabled: boolean }>(serialConsoleAccessKey());
  return { SerialConsoleAccessEnabled: stored?.enabled ?? true };
};

const EnableFastLaunch: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  return {
    ImageId: imageId,
    OwnerId: image.OwnerId,
    State: "enabling",
    StateTransitionReason: "Client.UserInitiated",
  };
};

const EnableFastSnapshotRestores: OperationHandler = (input, ctx) => {
  const snapshotIds = stringList(input["SourceSnapshotIds"]);
  const azs = stringList(input["AvailabilityZones"]);
  const effectiveAzs = azs.length > 0 ? azs : [`${ctx.region}a`];
  const successful = snapshotIds.flatMap((snapId) =>
    effectiveAzs.map((az) => ({
      SnapshotId: snapId,
      AvailabilityZone: az,
      State: "enabling",
      StateTransitionReason: "Client.UserInitiated",
      OwnerId: ctx.account,
    })),
  );
  return { Successful: successful, Unsuccessful: [] };
};

const EnableImage: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  ctx.store.set(imageKey(imageId), { ...image, State: "available" });
  return { Return: true };
};

const EnableImageBlockPublicAccess: OperationHandler = (input, ctx) => {
  const state =
    typeof input["ImageBlockPublicAccessState"] === "string"
      ? input["ImageBlockPublicAccessState"]
      : "block-new-sharing";
  ctx.store.set(imageBlockPublicAccessKey(), { state });
  return { ImageBlockPublicAccessState: state };
};

const GetImageBlockPublicAccessState: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ state: string }>(imageBlockPublicAccessKey());
  return { ImageBlockPublicAccessState: stored?.state ?? "unblocked" };
};

const EnableImageDeprecation: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const deprecateAt =
    typeof input["DeprecateAt"] === "string" ? input["DeprecateAt"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  ctx.store.set(imageKey(imageId), { ...image, DeprecationTime: deprecateAt });
  return { Return: true };
};

const EnableImageDeregistrationProtection: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  return { Return: "successful" };
};

const EnableInstanceSqlHaStandbyDetections: OperationHandler = (
  input,
  _ctx,
) => {
  const instanceIds = stringList(input["InstanceIds"]);
  return {
    Instances: instanceIds.map((id) => ({ InstanceId: id })),
  };
};

const EnableIpamOrganizationAdminAccount: OperationHandler = (_input, _ctx) => {
  return { Success: true };
};

const EnableIpamPolicy: OperationHandler = (input, ctx) => {
  const policyId =
    typeof input["IpamPolicyId"] === "string" ? input["IpamPolicyId"] : "";
  const policy = ctx.store.get<StoredIpamPolicy>(ipamPolicyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "InvalidIpamPolicyId.NotFound",
      `The IPAM policy ID '${policyId}' does not exist`,
      400,
    );
  }
  return { IpamPolicyId: policyId };
};

const EnableReachabilityAnalyzerOrganizationSharing: OperationHandler = (
  _input,
  _ctx,
) => {
  return { ReturnValue: true };
};

const EnableRouteServerPropagation: OperationHandler = (input, _ctx) => {
  const routeServerId =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const routeTableId =
    typeof input["RouteTableId"] === "string" ? input["RouteTableId"] : "";
  return {
    RouteServerPropagation: {
      RouteServerId: routeServerId,
      RouteTableId: routeTableId,
      State: "pending",
    },
  };
};

const EnableSnapshotBlockPublicAccess: OperationHandler = (input, ctx) => {
  const state =
    typeof input["State"] === "string" ? input["State"] : "block-new-sharing";
  ctx.store.set(snapshotBlockPublicAccessKey(), { state });
  return { State: state };
};

const GetSnapshotBlockPublicAccessState: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ state: string }>(
    snapshotBlockPublicAccessKey(),
  );
  return { State: stored?.state ?? "unblocked" };
};

const EnableTransitGatewayRouteTablePropagation: OperationHandler = (
  input,
  _ctx,
) => {
  const rtbId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const attachmentId =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : undefined;
  return {
    Propagation: {
      TransitGatewayRouteTableId: rtbId,
      TransitGatewayAttachmentId: attachmentId,
      State: "enabled",
    },
  };
};

const EnableVgwRoutePropagation: OperationHandler = (_input, _ctx) => {
  return {};
};

const EnableVolumeIO: OperationHandler = (input, ctx) => {
  const volumeId =
    typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(volumeId));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${volumeId}' does not exist.`,
      400,
    );
  }
  return {};
};

const EnableVpcClassicLink: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  ctx.store.set(vpcClassicLinkKey(vpcId), { enabled: true });
  return { Return: true };
};

const EnableVpcClassicLinkDnsSupport: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const ExportClientVpnClientCertificateRevocationList: OperationHandler = (
  input,
  ctx,
) => {
  const endpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredClientVpnEndpoint>(
    clientVpnEndpointKey(endpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidClientVpnEndpointId.NotFound",
      `The Client VPN endpoint '${endpointId}' does not exist.`,
      400,
    );
  }
  return {
    CertificateRevocationList: "",
    Status: { Code: "active", Message: "" },
  };
};

const ExportClientVpnClientConfiguration: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredClientVpnEndpoint>(
    clientVpnEndpointKey(endpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidClientVpnEndpointId.NotFound",
      `The Client VPN endpoint '${endpointId}' does not exist.`,
      400,
    );
  }
  return { ClientConfiguration: `client-config-${endpointId}` };
};

const ExportImage: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${imageId}]' does not exist`,
      400,
    );
  }
  const diskImageFormat =
    typeof input["DiskImageFormat"] === "string"
      ? input["DiskImageFormat"]
      : "VMDK";
  const taskId = `export-ami-${imageId.replace("ami-", "")}`;
  return {
    ExportImageTaskId: taskId,
    ImageId: imageId,
    DiskImageFormat: diskImageFormat,
    Status: "active",
    Progress: "0",
    S3ExportLocation: {
      S3Bucket:
        typeof input["S3ExportLocation"] === "object" &&
        input["S3ExportLocation"] !== null &&
        typeof (input["S3ExportLocation"] as { S3Bucket?: unknown })
          .S3Bucket === "string"
          ? (input["S3ExportLocation"] as { S3Bucket: string }).S3Bucket
          : "export-bucket",
    },
  };
};

const ExportTransitGatewayRoutes: OperationHandler = (input, _ctx) => {
  const rtbId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const s3Bucket =
    typeof input["S3Bucket"] === "string" ? input["S3Bucket"] : "export-bucket";
  return {
    S3Location: `s3://${s3Bucket}/VPCTransitGateway/TransitGatewayRouteTables/${rtbId}.json`,
  };
};

const ExportVerifiedAccessInstanceClientConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const instanceId =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const instance = ctx.store.get<StoredVerifiedAccessInstance>(
    vaInstanceKey(instanceId),
  );
  if (instance === undefined) {
    throw awsError(
      "InvalidVerifiedAccessInstanceId.NotFound",
      `The Verified Access instance '${instanceId}' does not exist.`,
      400,
    );
  }
  return {
    Version: "1.0",
    VerifiedAccessInstanceId: instanceId,
    Region: "us-east-1",
    DeviceTrustProviders: [],
    OpenVpnConfigurations: [],
  };
};

const GetActiveVpnTunnelStatus: OperationHandler = (input, ctx) => {
  const vpnConnectionId =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const connection = ctx.store.get<StoredVpnConnection>(
    vpnConnectionKey(vpnConnectionId),
  );
  if (connection === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpnConnection ID '${vpnConnectionId}' does not exist`,
      400,
    );
  }
  return {
    ActiveVpnTunnelStatus: {
      Phase1EncryptionAlgorithm: "AES-256-GCM-16",
      Phase2EncryptionAlgorithm: "AES-256-GCM-16",
      Phase1IntegrityAlgorithm: "SHA2-256",
      Phase2IntegrityAlgorithm: "SHA2-256",
      Phase1DHGroup: 14,
      Phase2DHGroup: 14,
      IkeVersion: "ikev2",
      ProvisioningStatus: "available",
    },
  };
};

const GetAllowedImagesSettings: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ state: string }>(allowedImagesSettingsKey());
  return {
    State: stored?.state ?? "disabled",
    ImageCriteria: [],
    ManagedBy: "account",
  };
};

const GetAssociatedEnclaveCertificateIamRoles: OperationHandler = (
  _input,
  _ctx,
) => {
  return { AssociatedRoles: [] };
};

const GetAssociatedIpv6PoolCidrs: OperationHandler = (_input, _ctx) => {
  return { Ipv6CidrAssociations: [] };
};

const GetAwsNetworkPerformanceData: OperationHandler = (_input, _ctx) => {
  return { DataResponses: [] };
};

const GetCapacityManagerAttributes: OperationHandler = (_input, _ctx) => {
  return {
    CapacityManagerStatus: "enabled",
    OrganizationsAccess: false,
    DataExportCount: 0,
    IngestionStatus: "active",
    IngestionStatusMessage: "Data ingestion is active",
  };
};

const GetCapacityManagerMetricData: OperationHandler = (_input, _ctx) => {
  return { MetricDataResults: [] };
};

const GetCapacityManagerMetricDimensions: OperationHandler = (_input, _ctx) => {
  return { MetricDimensionResults: [] };
};

const GetCapacityManagerMonitoredTagKeys: OperationHandler = (_input, _ctx) => {
  return { CapacityManagerTagKeys: [] };
};

const GetCapacityReservationUsage: OperationHandler = (input, ctx) => {
  const reservationId =
    typeof input["CapacityReservationId"] === "string"
      ? input["CapacityReservationId"]
      : "";
  const reservation = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(reservationId),
  );
  if (reservation === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation '${reservationId}' does not exist`,
      400,
    );
  }
  return {
    CapacityReservationId: reservation.CapacityReservationId,
    InstanceType: reservation.InstanceType,
    TotalInstanceCount: reservation.TotalInstanceCount,
    AvailableInstanceCount: reservation.AvailableInstanceCount,
    State: reservation.State,
    InstanceUsages: [],
  };
};

const GetCoipPoolUsage: OperationHandler = (input, ctx) => {
  const poolId = typeof input["PoolId"] === "string" ? input["PoolId"] : "";
  const pool = ctx.store.get<StoredCoipPool>(coipPoolKey(poolId));
  if (pool === undefined) {
    throw awsError(
      "InvalidCoipPoolId.NotFound",
      `The COIP pool ID '${poolId}' does not exist`,
      400,
    );
  }
  return {
    CoipPoolId: pool.PoolId,
    CoipAddressUsages: [],
    LocalGatewayRouteTableId: pool.LocalGatewayRouteTableId,
  };
};

const GetConsoleOutput: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: instanceId,
    Timestamp: new Date().toISOString(),
    Output: btoa(
      `Linux version 5.10.0-aws ${instanceId}\n[ OK ] Started Amazon EC2 Instance.\n`,
    ),
  };
};

const GetConsoleScreenshot: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: instanceId,
    ImageData:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  };
};

const GetDeclarativePoliciesReportSummary: OperationHandler = (input, _ctx) => {
  const reportId =
    typeof input["ReportId"] === "string" ? input["ReportId"] : "";
  throw awsError(
    "InvalidDeclarativePoliciesReportId.NotFound",
    `The declarative policies report '${reportId}' does not exist`,
    400,
  );
};

const ModifyDefaultCreditSpecification: OperationHandler = (input, ctx) => {
  const instanceFamily =
    typeof input["InstanceFamily"] === "string" ? input["InstanceFamily"] : "";
  const cpuCredits =
    typeof input["CpuCredits"] === "string" ? input["CpuCredits"] : "standard";
  ctx.store.set(defaultCreditSpecKey(instanceFamily), {
    InstanceFamily: instanceFamily,
    CpuCredits: cpuCredits,
  });
  return {
    InstanceFamilyCreditSpecification: {
      InstanceFamily: instanceFamily,
      CpuCredits: cpuCredits,
    },
  };
};

const GetDefaultCreditSpecification: OperationHandler = (input, ctx) => {
  const instanceFamily =
    typeof input["InstanceFamily"] === "string" ? input["InstanceFamily"] : "";
  const stored = ctx.store.get<{ InstanceFamily: string; CpuCredits: string }>(
    defaultCreditSpecKey(instanceFamily),
  );
  return {
    InstanceFamilyCreditSpecification: {
      InstanceFamily: instanceFamily,
      CpuCredits: stored?.CpuCredits ?? "standard",
    },
  };
};

const ModifyEbsDefaultKmsKeyId: OperationHandler = (input, ctx) => {
  const kmsKeyId =
    typeof input["KmsKeyId"] === "string" ? input["KmsKeyId"] : "";
  ctx.store.set(ebsDefaultKmsKeyIdKey(), { KmsKeyId: kmsKeyId });
  return { KmsKeyId: kmsKeyId };
};

const ResetEbsDefaultKmsKeyId: OperationHandler = (_input, ctx) => {
  ctx.store.delete(ebsDefaultKmsKeyIdKey());
  return { KmsKeyId: "alias/aws/ebs" };
};

const GetEbsDefaultKmsKeyId: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ KmsKeyId: string }>(ebsDefaultKmsKeyIdKey());
  return { KmsKeyId: stored?.KmsKeyId ?? "alias/aws/ebs" };
};

const GetEnabledIpamPolicy: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<{ IpamPolicyId: string }>(
    enabledIpamPolicyKey(),
  );
  if (stored === undefined) {
    return { IpamPolicyEnabled: false };
  }
  return {
    IpamPolicyEnabled: true,
    IpamPolicyId: stored.IpamPolicyId,
    ManagedBy: "account",
  };
};

const GetFlowLogsIntegrationTemplate: OperationHandler = (input, ctx) => {
  const flowLogId =
    typeof input["FlowLogId"] === "string" ? input["FlowLogId"] : "";
  const flowLog = ctx.store.get<StoredFlowLog>(flowLogKey(flowLogId));
  if (flowLog === undefined) {
    throw awsError(
      "InvalidFlowLogId.NotFound",
      `The flow log '${flowLogId}' does not exist`,
      400,
    );
  }
  return {
    Result: `AWSTemplateFormatVersion: '2010-09-09'\nDescription: Flow Logs Integration Template for ${flowLogId}\n`,
  };
};

const GetGroupsForCapacityReservation: OperationHandler = (input, ctx) => {
  const reservationId =
    typeof input["CapacityReservationId"] === "string"
      ? input["CapacityReservationId"]
      : "";
  const reservation = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(reservationId),
  );
  if (reservation === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation '${reservationId}' does not exist`,
      400,
    );
  }
  return { CapacityReservationGroups: [] };
};

const GetHostReservationPurchasePreview: OperationHandler = (_input, _ctx) => {
  return {
    CurrencyCode: "USD",
    Purchase: [],
    TotalHourlyPrice: "0.000",
    TotalUpfrontPrice: "0.00",
  };
};

const GetImageAncestry: OperationHandler = (input, ctx) => {
  const imageId = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(imageId));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The AMI '${imageId}' does not exist`,
      400,
    );
  }
  return { ImageAncestryEntries: [] };
};

const ModifyInstanceMetadataDefaults: OperationHandler = (input, ctx) => {
  const existing =
    ctx.store.get<Record<string, unknown>>(instanceMetadataDefaultsKey()) ?? {};
  if (typeof input["HttpTokens"] === "string") {
    existing["HttpTokens"] = input["HttpTokens"];
  }
  if (typeof input["HttpPutResponseHopLimit"] === "number") {
    existing["HttpPutResponseHopLimit"] = input["HttpPutResponseHopLimit"];
  }
  if (typeof input["HttpEndpoint"] === "string") {
    existing["HttpEndpoint"] = input["HttpEndpoint"];
  }
  if (typeof input["InstanceMetadataTags"] === "string") {
    existing["InstanceMetadataTags"] = input["InstanceMetadataTags"];
  }
  ctx.store.set(instanceMetadataDefaultsKey(), existing);
  return { Return: true };
};

const GetInstanceMetadataDefaults: OperationHandler = (_input, ctx) => {
  const stored = ctx.store.get<Record<string, unknown>>(
    instanceMetadataDefaultsKey(),
  );
  return {
    AccountLevel: {
      HttpTokens: stored?.["HttpTokens"] ?? "optional",
      HttpPutResponseHopLimit: stored?.["HttpPutResponseHopLimit"] ?? 1,
      HttpEndpoint: stored?.["HttpEndpoint"] ?? "enabled",
      InstanceMetadataTags: stored?.["InstanceMetadataTags"] ?? "disabled",
    },
  };
};

const GetInstanceTpmEkPub: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  const keyType =
    typeof input["KeyType"] === "string" ? input["KeyType"] : "rsa-2048";
  const keyFormat =
    typeof input["KeyFormat"] === "string" ? input["KeyFormat"] : "der";
  return {
    InstanceId: instanceId,
    KeyType: keyType,
    KeyFormat: keyFormat,
    KeyValue: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA",
  };
};

const GetInstanceTypesFromInstanceRequirements: OperationHandler = (
  _input,
  _ctx,
) => {
  return {
    InstanceTypes: [
      { InstanceType: "t3.micro" },
      { InstanceType: "t3.small" },
      { InstanceType: "t3.medium" },
      { InstanceType: "m5.large" },
      { InstanceType: "m5.xlarge" },
    ],
  };
};

const GetInstanceUefiData: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: instanceId,
    UefiData: "AAAA",
  };
};

const GetIpamAddressHistory: OperationHandler = (input, ctx) => {
  const scopeId =
    typeof input["IpamScopeId"] === "string" ? input["IpamScopeId"] : "";
  const scope = ctx.store.get<StoredIpamScope>(ipamScopeKey(scopeId));
  if (scope === undefined) {
    throw awsError(
      "InvalidIpamScopeId.NotFound",
      `The IPAM scope '${scopeId}' does not exist`,
      400,
    );
  }
  return { HistoryRecords: [] };
};

const GetIpamDiscoveredAccounts: OperationHandler = (_input, _ctx) => {
  return { IpamDiscoveredAccounts: [] };
};

const GetIpamDiscoveredPublicAddresses: OperationHandler = (_input, _ctx) => {
  return {
    IpamDiscoveredPublicAddresses: [],
    OldestSampleTime: new Date().toISOString(),
  };
};

const GetIpamDiscoveredResourceCidrs: OperationHandler = (_input, _ctx) => {
  return { IpamDiscoveredResourceCidrs: [] };
};

const GetIpamPolicyAllocationRules: OperationHandler = (input, ctx) => {
  const policyId =
    typeof input["IpamPolicyId"] === "string" ? input["IpamPolicyId"] : "";
  const policy = ctx.store.get<StoredIpamPolicy>(ipamPolicyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "InvalidIpamPolicyId.NotFound",
      `The IPAM policy '${policyId}' does not exist`,
      400,
    );
  }
  return { IpamPolicyDocuments: [] };
};

const GetIpamPolicyOrganizationTargets: OperationHandler = (input, ctx) => {
  const policyId =
    typeof input["IpamPolicyId"] === "string" ? input["IpamPolicyId"] : "";
  const policy = ctx.store.get<StoredIpamPolicy>(ipamPolicyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "InvalidIpamPolicyId.NotFound",
      `The IPAM policy '${policyId}' does not exist`,
      400,
    );
  }
  return { OrganizationTargets: [] };
};

const GetIpamPoolAllocations: OperationHandler = (_input, _ctx) => {
  return { IpamPoolAllocations: [] };
};

const GetIpamPoolCidrs: OperationHandler = (input, ctx) => {
  const poolId =
    typeof input["IpamPoolId"] === "string" ? input["IpamPoolId"] : "";
  const cidrs = ctx.store
    .list<StoredIpamPoolCidr>()
    .filter((entry) => entry.key.startsWith(`ipam-pool-cidr/${poolId}/`))
    .map((entry) => ({
      Cidr: entry.value.Cidr,
      State: entry.value.State,
    }));
  return { IpamPoolCidrs: cidrs };
};

const GetIpamPrefixListResolverRules: OperationHandler = (input, ctx) => {
  const resolverId =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : "";
  const resolver = ctx.store.get<StoredIpamPrefixListResolver>(
    ipamPrefixListResolverKey(resolverId),
  );
  if (resolver === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverId.NotFound",
      `The IPAM prefix list resolver ID '${resolverId}' does not exist`,
      400,
    );
  }
  return { Rules: [] };
};

const GetIpamPrefixListResolverVersionEntries: OperationHandler = (
  _input,
  _ctx,
) => {
  return { Entries: [] };
};

const GetIpamPrefixListResolverVersions: OperationHandler = (input, ctx) => {
  const resolverId =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : "";
  const resolver = ctx.store.get<StoredIpamPrefixListResolver>(
    ipamPrefixListResolverKey(resolverId),
  );
  if (resolver === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverId.NotFound",
      `The IPAM prefix list resolver ID '${resolverId}' does not exist`,
      400,
    );
  }
  return {
    IpamPrefixListResolverVersions: [
      {
        IpamPrefixListResolverId: resolverId,
        Version: 1,
        Status: "current",
      },
    ],
  };
};

const GetIpamResourceCidrs: OperationHandler = (input, ctx) => {
  const scopeId =
    typeof input["IpamScopeId"] === "string" ? input["IpamScopeId"] : "";
  const scope = ctx.store.get<StoredIpamScope>(ipamScopeKey(scopeId));
  if (scope === undefined) {
    throw awsError(
      "InvalidIpamScopeId.NotFound",
      `The IPAM scope '${scopeId}' does not exist`,
      400,
    );
  }
  return { IpamResourceCidrs: [] };
};

const GetLaunchTemplateData: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return {
    LaunchTemplateData: {
      ImageId: instance.ImageId,
      InstanceType: instance.InstanceType,
    },
  };
};

const GetManagedPrefixListAssociations: OperationHandler = (input, ctx) => {
  const id =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const pl = ctx.store.get<StoredManagedPrefixList>(managedPrefixListKey(id));
  if (pl === undefined) {
    throw awsError(
      "InvalidPrefixListID.NotFound",
      `The prefix list '${id}' does not exist`,
      400,
    );
  }
  return { PrefixListAssociations: [] };
};

const GetManagedPrefixListEntries: OperationHandler = (input, ctx) => {
  const id =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const pl = ctx.store.get<StoredManagedPrefixList>(managedPrefixListKey(id));
  if (pl === undefined) {
    throw awsError(
      "InvalidPrefixListID.NotFound",
      `The prefix list '${id}' does not exist`,
      400,
    );
  }
  return { Entries: pl.Entries };
};

const GetManagedResourceVisibility: OperationHandler = (_input, _ctx) => {
  return { Visibility: { DefaultVisibility: "visible" } };
};

const GetNetworkInsightsAccessScopeAnalysisFindings: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["NetworkInsightsAccessScopeAnalysisId"] === "string"
      ? input["NetworkInsightsAccessScopeAnalysisId"]
      : "";
  const analysis = ctx.store.get<StoredNetworkInsightsAccessScopeAnalysis>(
    niScopeAnalysisKey(id),
  );
  if (analysis === undefined) {
    throw awsError(
      "InvalidNetworkInsightsAccessScopeAnalysisId.NotFound",
      `The network insights access scope analysis '${id}' does not exist`,
      400,
    );
  }
  return {
    NetworkInsightsAccessScopeAnalysisId:
      analysis.NetworkInsightsAccessScopeAnalysisId,
    AnalysisStatus: "running",
    AnalysisFindings: [],
  };
};

const GetNetworkInsightsAccessScopeContent: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInsightsAccessScopeId"] === "string"
      ? input["NetworkInsightsAccessScopeId"]
      : "";
  const scope = ctx.store.get<StoredNetworkInsightsAccessScope>(
    niAccessScopeKey(id),
  );
  if (scope === undefined) {
    throw awsError(
      "InvalidNetworkInsightsAccessScopeId.NotFound",
      `The network insights access scope '${id}' does not exist`,
      400,
    );
  }
  return {
    NetworkInsightsAccessScopeContent: {
      NetworkInsightsAccessScopeId: scope.NetworkInsightsAccessScopeId,
      MatchPaths: [],
      ExcludePaths: [],
    },
  };
};

const GetPasswordData: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: instanceId,
    Timestamp: new Date().toISOString(),
    PasswordData: btoa(`EncryptedPassword:${instanceId}:synthetic`),
  };
};

const GetReservedInstancesExchangeQuote: OperationHandler = (_input, _ctx) => {
  return {
    CurrencyCode: "USD",
    IsValidExchange: true,
    PaymentDue: "0.00",
    ReservedInstanceValueRollup: {
      HourlyPrice: "0.00",
      RemainingTotalValue: "0.00",
    },
    TargetConfigurationValueRollup: {
      HourlyPrice: "0.00",
      RemainingTotalValue: "0.00",
    },
    ReservedInstanceValueSet: [],
    TargetConfigurationValueSet: [],
  };
};

const GetRouteServerAssociations: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const server = ctx.store.get<StoredRouteServer>(routeServerKey(id));
  if (server === undefined) {
    throw awsError(
      "InvalidRouteServerId.NotFound",
      `The route server ID '${id}' does not exist`,
      400,
    );
  }
  return { RouteServerAssociations: [] };
};

const GetRouteServerPropagations: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const server = ctx.store.get<StoredRouteServer>(routeServerKey(id));
  if (server === undefined) {
    throw awsError(
      "InvalidRouteServerId.NotFound",
      `The route server ID '${id}' does not exist`,
      400,
    );
  }
  return { RouteServerPropagations: [] };
};

const GetRouteServerRoutingDatabase: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const server = ctx.store.get<StoredRouteServer>(routeServerKey(id));
  if (server === undefined) {
    throw awsError(
      "InvalidRouteServerId.NotFound",
      `The route server ID '${id}' does not exist`,
      400,
    );
  }
  return { AreRoutesPersisted: false, Routes: [] };
};

const GetSecurityGroupsForVpc: OperationHandler = (input, ctx) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const groups = allSecurityGroups(ctx).filter((g) => g.VpcId === vpcId);
  return {
    SecurityGroupForVpcs: groups.map((g) => ({
      Description: g.Description,
      GroupName: g.GroupName,
      OwnerId: ctx.account,
      GroupId: g.GroupId,
      Tags: g.Tags,
      PrimaryVpcId: g.VpcId,
    })),
  };
};

const GetSpotPlacementScores: OperationHandler = (_input, _ctx) => {
  return {
    SpotPlacementScores: [
      { Region: "us-east-1", Score: 8 },
      { Region: "us-west-2", Score: 7 },
    ],
  };
};

const GetSubnetCidrReservations: OperationHandler = (input, ctx) => {
  const subnetId =
    typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(subnetId));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSubnetID.NotFound",
      `The subnet ID '${subnetId}' does not exist`,
      400,
    );
  }
  const reservations = ctx.store
    .list<StoredSubnetCidrReservation>()
    .filter((e) => e.key.startsWith("scr/") && e.value.SubnetId === subnetId)
    .map((e) => e.value);
  const toItem = (r: StoredSubnetCidrReservation) => ({
    SubnetCidrReservationId: r.SubnetCidrReservationId,
    SubnetId: r.SubnetId,
    Cidr: r.Cidr,
    ReservationType: r.ReservationType,
    OwnerId: r.OwnerId,
    Description: r.Description,
    Tags: r.Tags,
  });
  return {
    SubnetIpv4CidrReservations: reservations
      .filter((r) => !r.Cidr.includes(":"))
      .map(toItem),
    SubnetIpv6CidrReservations: reservations
      .filter((r) => r.Cidr.includes(":"))
      .map(toItem),
  };
};

const GetTransitGatewayAttachmentPropagations: OperationHandler = (
  _input,
  _ctx,
) => {
  return { TransitGatewayAttachmentPropagations: [] };
};

const GetTransitGatewayMeteringPolicyEntries: OperationHandler = (
  input,
  ctx,
) => {
  const policyId =
    typeof input["TransitGatewayMeteringPolicyId"] === "string"
      ? input["TransitGatewayMeteringPolicyId"]
      : "";
  const policy = ctx.store.get<StoredTransitGatewayMeteringPolicy>(
    transitGatewayMeteringPolicyKey(policyId),
  );
  if (policy === undefined) {
    throw awsError(
      "InvalidTransitGatewayMeteringPolicyID.NotFound",
      `The transit gateway metering policy ID '${policyId}' does not exist`,
      400,
    );
  }
  const entries = ctx.store
    .list<StoredTransitGatewayMeteringPolicyEntry>()
    .filter((e) => e.key.startsWith(`tgw-mpe/${policyId}/`))
    .map((e) => ({
      PolicyRuleNumber: e.value.PolicyRuleNumber,
      MeteredAccount: e.value.MeteredAccount,
      State: e.value.State,
      UpdatedAt: e.value.UpdatedAt,
      UpdateEffectiveAt: e.value.UpdateEffectiveAt,
      MeteringPolicyRule: e.value.MeteringPolicyRule,
    }));
  return { TransitGatewayMeteringPolicyEntries: entries };
};

const GetTransitGatewayMulticastDomainAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const domainId =
    typeof input["TransitGatewayMulticastDomainId"] === "string"
      ? input["TransitGatewayMulticastDomainId"]
      : "";
  const domain = ctx.store.get<StoredTransitGatewayMulticastDomain>(
    transitGatewayMulticastDomainKey(domainId),
  );
  if (domain === undefined) {
    throw awsError(
      "InvalidTransitGatewayMulticastDomainId.NotFound",
      `The transit gateway multicast domain '${domainId}' does not exist`,
      400,
    );
  }
  return { MulticastDomainAssociations: [] };
};

const GetTransitGatewayPolicyTableAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const tableId =
    typeof input["TransitGatewayPolicyTableId"] === "string"
      ? input["TransitGatewayPolicyTableId"]
      : "";
  const table = ctx.store.get<StoredTransitGatewayPolicyTable>(
    transitGatewayPolicyTableKey(tableId),
  );
  if (table === undefined) {
    throw awsError(
      "InvalidTransitGatewayPolicyTableID.NotFound",
      `The transit gateway policy table '${tableId}' does not exist`,
      400,
    );
  }
  return { Associations: [] };
};

const GetTransitGatewayPolicyTableEntries: OperationHandler = (input, ctx) => {
  const tableId =
    typeof input["TransitGatewayPolicyTableId"] === "string"
      ? input["TransitGatewayPolicyTableId"]
      : "";
  const table = ctx.store.get<StoredTransitGatewayPolicyTable>(
    transitGatewayPolicyTableKey(tableId),
  );
  if (table === undefined) {
    throw awsError(
      "InvalidTransitGatewayPolicyTableID.NotFound",
      `The transit gateway policy table '${tableId}' does not exist`,
      400,
    );
  }
  return { TransitGatewayPolicyTableEntries: [] };
};

const GetTransitGatewayPrefixListReferences: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const rtb = ctx.store.get<StoredTransitGatewayRouteTable>(
    transitGatewayRouteTableKey(routeTableId),
  );
  if (rtb === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The transit gateway route table '${routeTableId}' does not exist`,
      400,
    );
  }
  const refs = ctx.store
    .list<StoredTransitGatewayPrefixListReference>()
    .filter((e) => e.key.startsWith(`tgw-plr/${routeTableId}/`))
    .map((e) => ({
      TransitGatewayRouteTableId: e.value.TransitGatewayRouteTableId,
      PrefixListId: e.value.PrefixListId,
      PrefixListOwnerId: e.value.PrefixListOwnerId,
      State: e.value.State,
      Blackhole: e.value.Blackhole,
      TransitGatewayAttachment: e.value.TransitGatewayAttachment,
    }));
  return { TransitGatewayPrefixListReferences: refs };
};

const GetTransitGatewayRouteTableAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const rtb = ctx.store.get<StoredTransitGatewayRouteTable>(
    transitGatewayRouteTableKey(routeTableId),
  );
  if (rtb === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The transit gateway route table '${routeTableId}' does not exist`,
      400,
    );
  }
  return { Associations: [] };
};

const GetTransitGatewayRouteTablePropagations: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const rtb = ctx.store.get<StoredTransitGatewayRouteTable>(
    transitGatewayRouteTableKey(routeTableId),
  );
  if (rtb === undefined) {
    throw awsError(
      "InvalidRouteTableID.NotFound",
      `The transit gateway route table '${routeTableId}' does not exist`,
      400,
    );
  }
  return { TransitGatewayRouteTablePropagations: [] };
};

const GetVerifiedAccessEndpointPolicy: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["VerifiedAccessEndpointId"] === "string"
      ? input["VerifiedAccessEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredVerifiedAccessEndpoint>(
    verifiedAccessEndpointKey(endpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidVerifiedAccessEndpointId.NotFound",
      `The verified access endpoint '${endpointId}' does not exist`,
      400,
    );
  }
  return {
    PolicyEnabled: endpoint.PolicyEnabled ?? false,
    PolicyDocument: endpoint.PolicyDocument ?? "",
  };
};

const GetVerifiedAccessEndpointTargets: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["VerifiedAccessEndpointId"] === "string"
      ? input["VerifiedAccessEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredVerifiedAccessEndpoint>(
    verifiedAccessEndpointKey(endpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidVerifiedAccessEndpointId.NotFound",
      `The verified access endpoint '${endpointId}' does not exist`,
      400,
    );
  }
  return { VerifiedAccessEndpointTargets: [] };
};

const GetVerifiedAccessGroupPolicy: OperationHandler = (input, ctx) => {
  const groupId =
    typeof input["VerifiedAccessGroupId"] === "string"
      ? input["VerifiedAccessGroupId"]
      : "";
  const group = ctx.store.get<StoredVerifiedAccessGroup>(
    verifiedAccessGroupKey(groupId),
  );
  if (group === undefined) {
    throw awsError(
      "InvalidVerifiedAccessGroupId.NotFound",
      `The verified access group '${groupId}' does not exist`,
      400,
    );
  }
  return {
    PolicyEnabled: group.PolicyEnabled ?? false,
    PolicyDocument: group.PolicyDocument ?? "",
  };
};

const ModifyVpcPeeringConnectionOptions: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpcPeeringConnectionId"] === "string"
      ? input["VpcPeeringConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpcPeeringConnection>(vpcPeeringKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcPeeringConnectionID.NotFound",
      `The VPC peering connection '${id}' does not exist`,
      400,
    );
  }
  return {
    AccepterPeeringConnectionOptions: {
      AllowDnsResolutionFromRemoteVpc: false,
      AllowEgressFromLocalClassicLinkToRemoteVpc: false,
      AllowEgressFromLocalVpcToRemoteClassicLink: false,
    },
    RequesterPeeringConnectionOptions: {
      AllowDnsResolutionFromRemoteVpc: false,
      AllowEgressFromLocalClassicLinkToRemoteVpc: false,
      AllowEgressFromLocalVpcToRemoteClassicLink: false,
    },
  };
};

const ModifyVpcTenancy: OperationHandler = (input, ctx) => {
  const id = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(id));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["InstanceTenancy"] === "string")
    vpc.InstanceTenancy = input["InstanceTenancy"];
  ctx.store.set(vpcKey(id), vpc);
  return { ReturnValue: true };
};

const vpnConnectionView = (c: StoredVpnConnection): unknown => ({
  VpnConnectionId: c.VpnConnectionId,
  State: c.State,
  CustomerGatewayId: c.CustomerGatewayId,
  VpnGatewayId: c.VpnGatewayId,
  TransitGatewayId: c.TransitGatewayId,
  Type: c.Type,
  Tags: c.Tags,
  Routes: [],
  VgwTelemetry: [],
});

const ModifyVpnConnection: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpnConnection>(vpnConnectionKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["CustomerGatewayId"] === "string")
    stored.CustomerGatewayId = input["CustomerGatewayId"];
  if (typeof input["VpnGatewayId"] === "string")
    stored.VpnGatewayId = input["VpnGatewayId"];
  if (typeof input["TransitGatewayId"] === "string")
    stored.TransitGatewayId = input["TransitGatewayId"];
  ctx.store.set(vpnConnectionKey(id), stored);
  return { VpnConnection: vpnConnectionView(stored) };
};

const ModifyVpnConnectionOptions: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpnConnection>(vpnConnectionKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${id}' does not exist`,
      400,
    );
  }
  return { VpnConnection: vpnConnectionView(stored) };
};

const ModifyVpnTunnelCertificate: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpnConnection>(vpnConnectionKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${id}' does not exist`,
      400,
    );
  }
  return { VpnConnection: vpnConnectionView(stored) };
};

const ModifyVpnTunnelOptions: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const stored = ctx.store.get<StoredVpnConnection>(vpnConnectionKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${id}' does not exist`,
      400,
    );
  }
  return { VpnConnection: vpnConnectionView(stored) };
};

const MonitorInstances: OperationHandler = (input, ctx) => {
  const ids = stringList(input["InstanceIds"]);
  const result: { InstanceId: string; Monitoring: { State: string } }[] = [];
  for (const id of ids) {
    const instance = ctx.store.get<StoredInstance>(instanceKey(id));
    if (instance === undefined) {
      throw awsError(
        "InvalidInstanceID.NotFound",
        `The instance ID '${id}' does not exist`,
        400,
      );
    }
    instance.Monitoring = { State: "enabled" };
    ctx.store.set(instanceKey(id), instance);
    result.push({ InstanceId: id, Monitoring: { State: "enabled" } });
  }
  return { InstanceMonitorings: result };
};

const MoveAddressToVpc: OperationHandler = (input, ctx) => {
  const publicIp =
    typeof input["PublicIp"] === "string" ? input["PublicIp"] : "";
  const address = allAddresses(ctx).find((a) => a.PublicIp === publicIp);
  if (address === undefined) {
    throw awsError(
      "InvalidIPAddress.InUse",
      `The address '${publicIp}' does not exist`,
      400,
    );
  }
  address.Domain = "vpc";
  ctx.store.set(addressKey(address.AllocationId), address);
  return { AllocationId: address.AllocationId, Status: "MoveInProgress" };
};

const MoveByoipCidrToIpam: OperationHandler = (input, ctx) => {
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  const stored = ctx.store.get<{ Cidr: string; State: string }>(
    byoipCidrKey(cidr),
  );
  if (stored === undefined) {
    throw awsError("InvalidInput", `The CIDR '${cidr}' does not exist`, 400);
  }
  stored.State = "pending-provision";
  ctx.store.set(byoipCidrKey(cidr), stored);
  return {
    ByoipCidr: {
      Cidr: stored.Cidr,
      State: stored.State,
      StatusMessage: "",
      AsnAssociations: [],
    },
  };
};

const MoveCapacityReservationInstances: OperationHandler = (input, ctx) => {
  const sourceId =
    typeof input["SourceCapacityReservationId"] === "string"
      ? input["SourceCapacityReservationId"]
      : "";
  const destId =
    typeof input["DestinationCapacityReservationId"] === "string"
      ? input["DestinationCapacityReservationId"]
      : "";
  const count =
    typeof input["InstanceCount"] === "number" ? input["InstanceCount"] : 1;
  const source = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(sourceId),
  );
  if (source === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation ID '${sourceId}' does not exist`,
      400,
    );
  }
  const dest = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(destId),
  );
  if (dest === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation ID '${destId}' does not exist`,
      400,
    );
  }
  source.TotalInstanceCount -= count;
  source.AvailableInstanceCount -= count;
  dest.TotalInstanceCount += count;
  dest.AvailableInstanceCount += count;
  ctx.store.set(capacityReservationKey(sourceId), source);
  ctx.store.set(capacityReservationKey(destId), dest);
  const toView = (r: StoredCapacityReservation) => ({
    CapacityReservationId: r.CapacityReservationId,
    OwnerId: ctx.account,
    CapacityReservationArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:capacity-reservation/${r.CapacityReservationId}`,
    InstanceType: r.InstanceType,
    InstancePlatform: r.InstancePlatform,
    AvailabilityZone: r.AvailabilityZone,
    Tenancy: r.Tenancy,
    TotalInstanceCount: r.TotalInstanceCount,
    AvailableInstanceCount: r.AvailableInstanceCount,
    State: r.State,
    EndDateType: r.EndDateType,
    InstanceMatchCriteria: r.InstanceMatchCriteria,
    CreateDate: r.CreateDate,
    Tags: r.Tags,
  });
  return {
    SourceCapacityReservation: toView(source),
    DestinationCapacityReservation: toView(dest),
    InstanceCount: count,
  };
};

const ProvisionByoipCidr: OperationHandler = (input, ctx) => {
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "";
  const stored = { Cidr: cidr, State: "pending-provision" };
  ctx.store.set(byoipCidrKey(cidr), stored);
  return {
    ByoipCidr: {
      Cidr: stored.Cidr,
      State: stored.State,
      StatusMessage: "",
      AsnAssociations: [],
    },
  };
};

const ProvisionIpamByoasn: OperationHandler = (input, ctx) => {
  const ipamId =
    typeof input["IpamId"] === "string" ? input["IpamId"] : hexId("ipam");
  const asn = typeof input["Asn"] === "string" ? input["Asn"] : "65000";
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  const ipamArn =
    ipam?.IpamArn ?? `arn:aws:ec2:${ctx.region}:${ctx.account}:ipam/${ipamId}`;
  const association: StoredIpamByoasnAssociation = {
    Asn: asn,
    IpamId: ipamId,
    IpamArn: ipamArn,
    StatusMessage: "BYOASN provisioned",
    State: "provisioned",
  };
  ctx.store.set(ipamByoasnKey(ipamId, asn), association);
  return {
    Byoasn: {
      Asn: association.Asn,
      IpamId: association.IpamId,
      IpamArn: association.IpamArn,
      StatusMessage: association.StatusMessage,
      State: association.State,
    },
  };
};

const ProvisionIpamPoolCidr: OperationHandler = (input, ctx) => {
  const poolId =
    typeof input["IpamPoolId"] === "string" ? input["IpamPoolId"] : "";
  const cidr = typeof input["Cidr"] === "string" ? input["Cidr"] : "10.0.0.0/8";
  const stored: StoredIpamPoolCidr = { Cidr: cidr, State: "provisioned" };
  ctx.store.set(ipamPoolCidrKey(poolId, cidr), stored);
  return { IpamPoolCidr: { Cidr: cidr, State: "provisioned" } };
};

const GetVpcResourcesBlockingEncryptionEnforcement: OperationHandler = (
  input,
  ctx,
) => {
  const vpcId = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(vpcId));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${vpcId}' does not exist`,
      400,
    );
  }
  return { NonCompliantResources: [] };
};

const GetVpnConnectionDeviceTypes: OperationHandler = (_input, _ctx) => {
  return {
    VpnConnectionDeviceTypes: [
      {
        VpnConnectionDeviceTypeId: "5fb390ba",
        Vendor: "Cisco",
        Platform: "ASA 5500 Series",
        Software: "8.2+",
      },
      {
        VpnConnectionDeviceTypeId: "9005b6b1",
        Vendor: "Juniper",
        Platform: "SRX Series Routers",
        Software: "11.0+",
      },
      {
        VpnConnectionDeviceTypeId: "a5e26e72",
        Vendor: "Palo Alto Networks",
        Platform: "PA Series",
        Software: "PANOS 4.1.2+",
      },
    ],
  };
};

const GetVpnConnectionDeviceSampleConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const vpnConnectionId =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const conn = ctx.store.get<StoredVpnConnection>(
    vpnConnectionKey(vpnConnectionId),
  );
  if (conn === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${vpnConnectionId}' does not exist`,
      400,
    );
  }
  return {
    VpnConnectionDeviceSampleConfiguration:
      "! Sample VPN configuration\n! Generated by BUNSAI\n",
  };
};

const GetVpnTunnelReplacementStatus: OperationHandler = (input, ctx) => {
  const vpnConnectionId =
    typeof input["VpnConnectionId"] === "string"
      ? input["VpnConnectionId"]
      : "";
  const conn = ctx.store.get<StoredVpnConnection>(
    vpnConnectionKey(vpnConnectionId),
  );
  if (conn === undefined) {
    throw awsError(
      "InvalidVpnConnectionID.NotFound",
      `The vpn connection ID '${vpnConnectionId}' does not exist`,
      400,
    );
  }
  const outsideIp =
    typeof input["VpnTunnelOutsideIpAddress"] === "string"
      ? input["VpnTunnelOutsideIpAddress"]
      : "";
  return {
    VpnConnectionId: conn.VpnConnectionId,
    TransitGatewayId: conn.TransitGatewayId,
    CustomerGatewayId: conn.CustomerGatewayId,
    VpnGatewayId: conn.VpnGatewayId,
    VpnTunnelOutsideIpAddress: outsideIp,
  };
};

const ImportClientVpnClientCertificateRevocationList: OperationHandler = (
  input,
  ctx,
) => {
  const endpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const ep = ctx.store.get<StoredClientVpnEndpoint>(
    clientVpnEndpointKey(endpointId),
  );
  if (ep === undefined) {
    throw awsError(
      "InvalidClientVpnEndpointId.NotFound",
      `The Client VPN endpoint '${endpointId}' does not exist`,
      400,
    );
  }
  return { Return: true };
};

const ImportImage: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const architecture =
    typeof input["Architecture"] === "string"
      ? input["Architecture"]
      : "x86_64";
  const platform =
    typeof input["Platform"] === "string" ? input["Platform"] : "Linux";
  const id = hexId("ami");
  const importTaskId = hexId("import-ami");
  const image: StoredImage = {
    ImageId: id,
    Name: importTaskId,
    Description: description,
    InstanceId: "",
    State: "available",
    OwnerId: ctx.account,
    CreationDate: new Date().toISOString(),
    Tags: tagList(input["TagSpecifications"]),
  };
  ctx.store.set(imageKey(id), image);
  return {
    ImageId: id,
    ImportTaskId: importTaskId,
    Architecture: architecture,
    Platform: platform,
    Description: description,
    Status: "completed",
    Progress: "100",
  };
};

const ImportInstance: OperationHandler = (input, _ctx) => {
  const taskId = hexId("import-i");
  const platform =
    typeof input["Platform"] === "string" ? input["Platform"] : "windows";
  return {
    ConversionTask: {
      ConversionTaskId: taskId,
      State: "active",
      ImportInstance: {
        Platform: platform,
        Volumes: [],
      },
    },
  };
};

const ImportKeyPair: OperationHandler = (input, ctx) => {
  const keyName = typeof input["KeyName"] === "string" ? input["KeyName"] : "";
  if (keyName === "") {
    throw awsError(
      "MissingParameter",
      "The request must contain the parameter KeyName",
      400,
    );
  }
  if (ctx.store.get<StoredKeyPair>(keyPairKey(keyName)) !== undefined) {
    throw awsError(
      "InvalidKeyPair.Duplicate",
      `The keypair '${keyName}' already exists.`,
      400,
    );
  }
  const keyPair: StoredKeyPair = {
    KeyPairId: hexId("key"),
    KeyName: keyName,
    KeyType: "rsa",
    KeyFingerprint: fingerprint(),
    KeyMaterial: "",
    Tags: tagList(input["TagSpecifications"]),
  };
  ctx.store.set(keyPairKey(keyName), keyPair);
  return {
    KeyPairId: keyPair.KeyPairId,
    KeyName: keyPair.KeyName,
    KeyFingerprint: keyPair.KeyFingerprint,
    Tags: keyPair.Tags,
  };
};

const ImportSnapshot: OperationHandler = (input, ctx) => {
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const id = hexId("snap");
  const importTaskId = hexId("import-snap");
  const snapshot: StoredSnapshot = {
    SnapshotId: id,
    VolumeId: "",
    VolumeSize: 8,
    State: "completed",
    Progress: "100%",
    StartTime: new Date().toISOString(),
    Description: description,
    Encrypted: input["Encrypted"] === true,
    OwnerId: ctx.account,
    Tags: tagList(input["TagSpecifications"]),
  };
  ctx.store.set(snapshotKey(id), snapshot);
  return {
    ImportTaskId: importTaskId,
    Description: description,
    SnapshotTaskDetail: {
      SnapshotId: id,
      Status: "completed",
      Progress: "100%",
      Description: description,
    },
  };
};

const ImportVolume: OperationHandler = (input, ctx) => {
  const availabilityZone =
    typeof input["AvailabilityZone"] === "string"
      ? input["AvailabilityZone"]
      : `${ctx.region}a`;
  const description =
    typeof input["Description"] === "string" ? input["Description"] : "";
  const taskId = hexId("import-vol");
  const volumeSize =
    typeof input["Volume"] === "object" &&
    input["Volume"] !== null &&
    typeof (input["Volume"] as Record<string, unknown>)["Size"] === "number"
      ? ((input["Volume"] as Record<string, unknown>)["Size"] as number)
      : 8;
  const id = hexId("vol");
  const volume: StoredVolume = {
    VolumeId: id,
    Size: volumeSize,
    VolumeType: "standard",
    AvailabilityZone: availabilityZone,
    State: "available",
    SnapshotId: "",
    Iops: 0,
    Encrypted: false,
    CreateTime: new Date().toISOString(),
    Tags: [],
    Attachments: [],
  };
  ctx.store.set(volumeKey(id), volume);
  return {
    ConversionTask: {
      ConversionTaskId: taskId,
      State: "active",
      ImportVolume: {
        AvailabilityZone: availabilityZone,
        Description: description,
        Volume: { Id: id, Size: volumeSize },
      },
    },
  };
};

const ListImagesInRecycleBin: OperationHandler = (input, ctx) => {
  const ids = stringList(input["ImageIds"]);
  const images = allImagesInBin(ctx).filter((image) =>
    ids.length === 0 ? true : ids.includes(image.ImageId),
  );
  return {
    Images: images.map((image) => ({
      ImageId: image.ImageId,
      Name: image.Name,
      Description: image.Description,
      RecycleBinEnterTime: image.CreationDate,
      RecycleBinExitTime: image.CreationDate,
    })),
  };
};

const ListSnapshotsInRecycleBin: OperationHandler = (input, ctx) => {
  const ids = stringList(input["SnapshotIds"]);
  const snapshots = allSnapshotsInBin(ctx).filter((snapshot) =>
    ids.length === 0 ? true : ids.includes(snapshot.SnapshotId),
  );
  return {
    Snapshots: snapshots.map((snapshot) => ({
      SnapshotId: snapshot.SnapshotId,
      VolumeId: snapshot.VolumeId,
      Description: snapshot.Description,
      RecycleBinEnterTime: snapshot.StartTime,
      RecycleBinExitTime: snapshot.StartTime,
    })),
  };
};

const ListVolumesInRecycleBin: OperationHandler = (input, ctx) => {
  const ids = stringList(input["VolumeIds"]);
  const volumes = ctx.store
    .list<StoredVolume>()
    .filter((entry) => entry.key.startsWith("volume-bin/"))
    .map((entry) => entry.value)
    .filter((v) => ids.length === 0 || ids.includes(v.VolumeId));
  return {
    Volumes: volumes.map((v) => ({
      VolumeId: v.VolumeId,
      VolumeType: v.VolumeType,
      State: v.State,
      Size: v.Size,
      Iops: v.Iops,
      AvailabilityZone: v.AvailabilityZone,
      RecycleBinEnterTime: v.CreateTime,
      RecycleBinExitTime: v.CreateTime,
    })),
  };
};

const LockSnapshot: OperationHandler = (input, ctx) => {
  const snapshotId =
    typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : "";
  const lockMode =
    typeof input["LockMode"] === "string" ? input["LockMode"] : "governance";
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(snapshotId));
  if (snapshot === undefined) {
    throw awsError(
      "InvalidSnapshot.NotFound",
      `The snapshot '${snapshotId}' does not exist`,
      400,
    );
  }
  const lockDuration =
    typeof input["LockDuration"] === "number"
      ? input["LockDuration"]
      : undefined;
  const now = new Date().toISOString();
  const lockExpiresOn = lockDuration
    ? new Date(Date.now() + lockDuration * 86400000).toISOString()
    : undefined;
  const lockState = lockMode === "compliance" ? "compliance-cooloff" : lockMode;
  ctx.store.set(snapshotLockKey(snapshotId), {
    SnapshotId: snapshotId,
    LockState: lockState,
    LockMode: lockMode,
    LockDuration: lockDuration,
    LockCreatedOn: now,
    LockExpiresOn: lockExpiresOn,
  });
  return {
    SnapshotId: snapshotId,
    LockState: lockState,
    LockDuration: lockDuration,
    LockCreatedOn: now,
    LockExpiresOn: lockExpiresOn,
  };
};

const ModifyAddressAttribute: OperationHandler = (input, ctx) => {
  const allocationId =
    typeof input["AllocationId"] === "string" ? input["AllocationId"] : "";
  const address = ctx.store.get<StoredAddress>(addressKey(allocationId));
  if (address === undefined) {
    throw awsError(
      "InvalidAllocationID.NotFound",
      `The allocation ID '${allocationId}' does not exist`,
      400,
    );
  }
  if (typeof input["DomainName"] === "string") {
    address.DomainName = input["DomainName"];
  }
  ctx.store.set(addressKey(allocationId), address);
  return {
    Address: {
      AllocationId: address.AllocationId,
      PublicIp: address.PublicIp,
      PtrRecord: address.DomainName,
    },
  };
};

const ModifyAvailabilityZoneGroup: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const ModifyCapacityReservation: OperationHandler = (input, ctx) => {
  const reservationId =
    typeof input["CapacityReservationId"] === "string"
      ? input["CapacityReservationId"]
      : "";
  const reservation = ctx.store.get<StoredCapacityReservation>(
    capacityReservationKey(reservationId),
  );
  if (reservation === undefined) {
    throw awsError(
      "InvalidCapacityReservationId.NotFound",
      `The capacity reservation '${reservationId}' does not exist`,
      400,
    );
  }
  if (typeof input["InstanceCount"] === "number") {
    reservation.TotalInstanceCount = input["InstanceCount"];
    reservation.AvailableInstanceCount = input["InstanceCount"];
  }
  if (typeof input["EndDateType"] === "string") {
    reservation.EndDateType = input["EndDateType"];
  }
  if (typeof input["InstanceMatchCriteria"] === "string") {
    reservation.InstanceMatchCriteria = input["InstanceMatchCriteria"];
  }
  ctx.store.set(capacityReservationKey(reservationId), reservation);
  return { Return: true };
};

const ModifyCapacityReservationFleet: OperationHandler = (_input, _ctx) => {
  return { Return: true };
};

const ModifyClientVpnEndpoint: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["ClientVpnEndpointId"] === "string"
      ? input["ClientVpnEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredClientVpnEndpoint>(
    clientVpnEndpointKey(endpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidClientVpnEndpointId.NotFound",
      `The Client VPN endpoint ID '${endpointId}' does not exist`,
      400,
    );
  }
  if (typeof input["ServerCertificateArn"] === "string") {
    endpoint.ServerCertificateArn = input["ServerCertificateArn"];
  }
  if (typeof input["Description"] === "string") {
    endpoint.Description = input["Description"];
  }
  if (typeof input["VpnPort"] === "number") {
    endpoint.VpnPort = input["VpnPort"];
  }
  ctx.store.set(clientVpnEndpointKey(endpointId), endpoint);
  return { Return: true };
};

const ModifyFleet: OperationHandler = (input, ctx) => {
  const fleetId = typeof input["FleetId"] === "string" ? input["FleetId"] : "";
  const fleet = ctx.store.get<StoredFleet>(fleetKey(fleetId));
  if (fleet === undefined) {
    throw awsError(
      "InvalidFleetId.NotFound",
      `The fleet '${fleetId}' does not exist`,
      400,
    );
  }
  if (typeof input["ExcessCapacityTerminationPolicy"] === "string") {
    (
      fleet as StoredFleet & { ExcessCapacityTerminationPolicy?: string }
    ).ExcessCapacityTerminationPolicy =
      input["ExcessCapacityTerminationPolicy"];
  }
  ctx.store.set(fleetKey(fleetId), fleet);
  return { Return: true };
};

const ModifyFpgaImageAttribute: OperationHandler = (input, ctx) => {
  const fpgaImageId =
    typeof input["FpgaImageId"] === "string" ? input["FpgaImageId"] : "";
  const image = ctx.store.get<StoredFpgaImage>(fpgaImageKey(fpgaImageId));
  if (image === undefined) {
    throw awsError(
      "InvalidFpgaImageID.NotFound",
      `The FPGA image ID '${fpgaImageId}' does not exist`,
      400,
    );
  }
  if (typeof input["Name"] === "string") {
    image.Name = input["Name"];
  }
  if (typeof input["Description"] === "string") {
    image.Description = input["Description"];
  }
  ctx.store.set(fpgaImageKey(fpgaImageId), image);
  return {
    FpgaImageAttribute: {
      FpgaImageId: image.FpgaImageId,
      Name: image.Name,
      Description: image.Description,
    },
  };
};

const ModifyHosts: OperationHandler = (input, ctx) => {
  const hostIds = stringList(input["HostIds"]);
  const successful: string[] = [];
  const unsuccessful: unknown[] = [];
  for (const hostId of hostIds) {
    const host = ctx.store.get<StoredHost>(hostKey(hostId));
    if (host === undefined) {
      unsuccessful.push({
        ResourceId: hostId,
        Error: {
          Code: "InvalidHostID.NotFound",
          Message: `The host '${hostId}' does not exist`,
        },
      });
      continue;
    }
    if (typeof input["AutoPlacement"] === "string") {
      host.AutoPlacement = input["AutoPlacement"];
    }
    if (typeof input["HostRecovery"] === "string") {
      host.HostRecovery = input["HostRecovery"];
    }
    if (typeof input["HostMaintenance"] === "string") {
      host.HostMaintenance = input["HostMaintenance"];
    }
    if (typeof input["InstanceType"] === "string") {
      host.InstanceType = input["InstanceType"];
    }
    if (typeof input["InstanceFamily"] === "string") {
      host.InstanceFamily = input["InstanceFamily"];
    }
    ctx.store.set(hostKey(hostId), host);
    successful.push(hostId);
  }
  return { Successful: successful, Unsuccessful: unsuccessful };
};

const ModifyIdFormat: OperationHandler = (_input, _ctx) => {
  return {};
};

const ModifyIdentityIdFormat: OperationHandler = (_input, _ctx) => {
  return {};
};

const ModifyImageAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["ImageId"] === "string" ? input["ImageId"] : "";
  const image = ctx.store.get<StoredImage>(imageKey(id));
  if (image === undefined) {
    throw awsError(
      "InvalidAMIID.NotFound",
      `The image id '[${id}]' does not exist`,
      400,
    );
  }
  const desc = input["Description"] as { Value?: string } | undefined;
  if (desc !== undefined && typeof desc["Value"] === "string") {
    image.Description = desc["Value"];
  }
  ctx.store.set(imageKey(id), image);
  return {};
};

const ModifyInstanceAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  const instanceType = input["InstanceType"] as { Value?: string } | undefined;
  if (instanceType !== undefined && typeof instanceType["Value"] === "string") {
    instance.InstanceType = instanceType["Value"];
  }
  ctx.store.set(instanceKey(id), instance);
  return {};
};

const ModifyInstanceCapacityReservationAttributes: OperationHandler = (
  input,
  ctx,
) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return { Return: true };
};

const ModifyInstanceConnectEndpoint: OperationHandler = (input, ctx) => {
  const endpointId =
    typeof input["InstanceConnectEndpointId"] === "string"
      ? input["InstanceConnectEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredInstanceConnectEndpoint>(
    instanceConnectEndpointKey(endpointId),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidInstanceConnectEndpointId.NotFound",
      `The EC2 Instance Connect Endpoint '${endpointId}' does not exist`,
      400,
    );
  }
  const sgs = input["SecurityGroupIds"];
  if (Array.isArray(sgs)) {
    endpoint.SecurityGroupIds = sgs.map((g) => String(g));
  }
  if (typeof input["PreserveClientIp"] === "boolean") {
    endpoint.PreserveClientIp = input["PreserveClientIp"];
  }
  ctx.store.set(instanceConnectEndpointKey(endpointId), endpoint);
  return { Return: true };
};

const ModifyInstanceCpuOptions: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: id,
    CoreCount:
      typeof input["CoreCount"] === "number" ? input["CoreCount"] : undefined,
    ThreadsPerCore:
      typeof input["ThreadsPerCore"] === "number"
        ? input["ThreadsPerCore"]
        : undefined,
    NestedVirtualization:
      typeof input["NestedVirtualization"] === "string"
        ? input["NestedVirtualization"]
        : undefined,
  };
};

const ModifyInstanceCreditSpecification: OperationHandler = (input, ctx) => {
  const specs = input["InstanceCreditSpecifications"];
  const items = Array.isArray(specs) ? specs : [];
  const successful: { InstanceId: string }[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec["InstanceId"] === "string" ? rec["InstanceId"] : "";
    const instance = ctx.store.get<StoredInstance>(instanceKey(id));
    if (instance === undefined) continue;
    if (typeof rec["CpuCredits"] === "string") {
      instance.CpuCredits = rec["CpuCredits"];
      ctx.store.set(instanceKey(id), instance);
    }
    successful.push({ InstanceId: id });
  }
  return {
    SuccessfulInstanceCreditSpecifications: successful,
    UnsuccessfulInstanceCreditSpecifications: [],
  };
};

const ModifyInstanceEventStartTime: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return { Event: undefined };
};

const ModifyInstanceEventWindow: OperationHandler = (input, ctx) => {
  const windowId =
    typeof input["InstanceEventWindowId"] === "string"
      ? input["InstanceEventWindowId"]
      : "";
  const eventWindow = ctx.store.get<StoredInstanceEventWindow>(
    instanceEventWindowKey(windowId),
  );
  if (eventWindow === undefined) {
    throw awsError(
      "InvalidInstanceEventWindowId.NotFound",
      `The event window '${windowId}' does not exist`,
      400,
    );
  }
  if (typeof input["Name"] === "string") {
    eventWindow.Name = input["Name"];
  }
  if (typeof input["CronExpression"] === "string") {
    eventWindow.CronExpression = input["CronExpression"];
    eventWindow.TimeRanges = [];
  }
  const timeRanges = input["TimeRanges"];
  if (Array.isArray(timeRanges)) {
    eventWindow.CronExpression = undefined;
    eventWindow.TimeRanges = timeRanges.map((r) => {
      const rec = (r as Record<string, unknown>) ?? {};
      return {
        StartWeekDay:
          typeof rec["StartWeekDay"] === "string" ? rec["StartWeekDay"] : "",
        StartHour: typeof rec["StartHour"] === "number" ? rec["StartHour"] : 0,
        EndWeekDay:
          typeof rec["EndWeekDay"] === "string" ? rec["EndWeekDay"] : "",
        EndHour: typeof rec["EndHour"] === "number" ? rec["EndHour"] : 0,
      };
    });
  }
  ctx.store.set(instanceEventWindowKey(windowId), eventWindow);
  return {
    InstanceEventWindow: {
      InstanceEventWindowId: eventWindow.InstanceEventWindowId,
      Name: eventWindow.Name,
      CronExpression: eventWindow.CronExpression,
      TimeRanges: eventWindow.TimeRanges,
      State: eventWindow.State,
      Tags: eventWindow.Tags,
    },
  };
};

const ModifyInstanceMaintenanceOptions: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: id,
    AutoRecovery:
      typeof input["AutoRecovery"] === "string"
        ? input["AutoRecovery"]
        : "default",
    RebootMigration:
      typeof input["RebootMigration"] === "string"
        ? input["RebootMigration"]
        : "default",
  };
};

const ModifyInstanceMetadataOptions: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  const current = instance.MetadataOptions ?? {};
  if (typeof input["HttpTokens"] === "string") {
    current.HttpTokens = input["HttpTokens"];
  }
  if (typeof input["HttpPutResponseHopLimit"] === "number") {
    current.HttpPutResponseHopLimit = input["HttpPutResponseHopLimit"];
  }
  if (typeof input["HttpEndpoint"] === "string") {
    current.HttpEndpoint = input["HttpEndpoint"];
  }
  if (typeof input["HttpProtocolIpv6"] === "string") {
    current.HttpProtocolIpv6 = input["HttpProtocolIpv6"];
  }
  if (typeof input["InstanceMetadataTags"] === "string") {
    current.InstanceMetadataTags = input["InstanceMetadataTags"];
  }
  instance.MetadataOptions = current;
  ctx.store.set(instanceKey(id), instance);
  return {
    InstanceId: id,
    InstanceMetadataOptions: {
      HttpTokens: current.HttpTokens,
      HttpPutResponseHopLimit: current.HttpPutResponseHopLimit,
      HttpEndpoint: current.HttpEndpoint,
      HttpProtocolIpv6: current.HttpProtocolIpv6,
      InstanceMetadataTags: current.InstanceMetadataTags,
      State: "applied",
    },
  };
};

const ModifyInstanceNetworkPerformanceOptions: OperationHandler = (
  input,
  ctx,
) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return {
    InstanceId: id,
    BandwidthWeighting:
      typeof input["BandwidthWeighting"] === "string"
        ? input["BandwidthWeighting"]
        : "default",
  };
};

const ModifyInstancePlacement: OperationHandler = (input, ctx) => {
  const id = typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(id));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${id}' does not exist`,
      400,
    );
  }
  return { Return: true };
};

const ModifyIpam: OperationHandler = (input, ctx) => {
  const ipamId = typeof input["IpamId"] === "string" ? input["IpamId"] : "";
  const ipam = ctx.store.get<StoredIpam>(ipamKey(ipamId));
  if (ipam === undefined) {
    throw awsError(
      "InvalidIpamId.NotFound",
      `The IPAM ID '${ipamId}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string") {
    ipam.Description = input["Description"];
  }
  ctx.store.set(ipamKey(ipamId), ipam);
  return {
    Ipam: {
      IpamId: ipam.IpamId,
      OwnerId: ipam.OwnerId,
      IpamArn: ipam.IpamArn,
      State: ipam.State,
      Description: ipam.Description,
      PublicDefaultScopeId: ipam.PublicDefaultScopeId,
      PrivateDefaultScopeId: ipam.PrivateDefaultScopeId,
      ScopeCount: ipam.ScopeCount,
      Tags: ipam.Tags,
    },
  };
};

const ModifyIpamPolicyAllocationRules: OperationHandler = (input, ctx) => {
  const policyId =
    typeof input["IpamPolicyId"] === "string" ? input["IpamPolicyId"] : "";
  const policy = ctx.store.get<StoredIpamPolicy>(ipamPolicyKey(policyId));
  if (policy === undefined) {
    throw awsError(
      "InvalidIpamPolicyId.NotFound",
      `The IPAM policy ID '${policyId}' does not exist`,
      400,
    );
  }
  return {
    IpamPolicyDocument: {
      IpamPolicyId: policyId,
    },
  };
};

const ModifyIpamPool: OperationHandler = (input, ctx) => {
  const poolId =
    typeof input["IpamPoolId"] === "string" ? input["IpamPoolId"] : "";
  const pool = ctx.store.get<StoredIpamPool>(ipamPoolKey(poolId));
  if (pool === undefined) {
    throw awsError(
      "InvalidIpamPoolId.NotFound",
      `The IPAM pool ID '${poolId}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string") {
    pool.Description = input["Description"];
  }
  ctx.store.set(ipamPoolKey(poolId), pool);
  return {
    IpamPool: {
      IpamPoolId: pool.IpamPoolId,
      IpamScopeId: pool.IpamScopeId,
      IpamId: pool.IpamId,
      IpamArn: pool.IpamArn,
      IpamScopeArn: pool.IpamScopeArn,
      IpamPoolArn: pool.IpamPoolArn,
      Locale: pool.Locale,
      AddressFamily: pool.AddressFamily,
      State: pool.State,
      Description: pool.Description,
      Tags: pool.Tags,
    },
  };
};

const ModifyIpamPoolAllocation: OperationHandler = (input, _ctx) => {
  const allocationId =
    typeof input["IpamPoolAllocationId"] === "string"
      ? input["IpamPoolAllocationId"]
      : "";
  const description =
    typeof input["Description"] === "string" ? input["Description"] : undefined;
  return {
    IpamPoolAllocation: {
      IpamPoolAllocationId: allocationId,
      Description: description,
    },
  };
};

const ModifyIpamPrefixListResolver: OperationHandler = (input, ctx) => {
  const resolverId =
    typeof input["IpamPrefixListResolverId"] === "string"
      ? input["IpamPrefixListResolverId"]
      : "";
  const resolver = ctx.store.get<StoredIpamPrefixListResolver>(
    ipamPrefixListResolverKey(resolverId),
  );
  if (resolver === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverId.NotFound",
      `The IPAM prefix list resolver ID '${resolverId}' does not exist`,
      400,
    );
  }
  return {
    IpamPrefixListResolver: {
      IpamPrefixListResolverId: resolver.IpamPrefixListResolverId,
      IpamId: resolver.IpamId,
      IpamArn: resolver.IpamArn,
      OwnerId: resolver.OwnerId,
      Tags: resolver.Tags,
    },
  };
};

const ModifyIpamPrefixListResolverTarget: OperationHandler = (input, ctx) => {
  const targetId =
    typeof input["IpamPrefixListResolverTargetId"] === "string"
      ? input["IpamPrefixListResolverTargetId"]
      : "";
  const target = ctx.store
    .list<StoredIpamPrefixListResolverTarget>()
    .map((entry) => entry.value)
    .find((t) => t.IpamPrefixListResolverTargetId === targetId);
  if (target === undefined) {
    throw awsError(
      "InvalidIpamPrefixListResolverTargetId.NotFound",
      `The IPAM prefix list resolver target ID '${targetId}' does not exist`,
      400,
    );
  }
  return {
    IpamPrefixListResolverTarget: {
      IpamPrefixListResolverId: target.IpamPrefixListResolverId,
      IpamPrefixListResolverTargetId: target.IpamPrefixListResolverTargetId,
      PrefixListId: target.PrefixListId,
      OwnerId: target.OwnerId,
      Tags: target.Tags,
    },
  };
};

const ModifyIpamResourceCidr: OperationHandler = (input, _ctx) => {
  const resourceId =
    typeof input["ResourceId"] === "string" ? input["ResourceId"] : "";
  const resourceCidr =
    typeof input["ResourceCidr"] === "string" ? input["ResourceCidr"] : "";
  const resourceRegion =
    typeof input["ResourceRegion"] === "string"
      ? input["ResourceRegion"]
      : "us-east-1";
  const monitored =
    typeof input["Monitored"] === "boolean" ? input["Monitored"] : false;
  return {
    IpamResourceCidr: {
      ResourceId: resourceId,
      ResourceCidr: resourceCidr,
      ResourceRegion: resourceRegion,
      IpUsage: 0,
      ComplianceStatus: "noncompliant",
      ManagementState: monitored ? "managed" : "unmanaged",
    },
  };
};

const ModifyIpamResourceDiscovery: OperationHandler = (input, ctx) => {
  const id =
    typeof input["IpamResourceDiscoveryId"] === "string"
      ? input["IpamResourceDiscoveryId"]
      : "";
  const rd = ctx.store.get<StoredIpamResourceDiscovery>(
    ipamResourceDiscoveryKey(id),
  );
  if (rd === undefined) {
    throw awsError(
      "InvalidIpamResourceDiscoveryId.NotFound",
      `The IPAM resource discovery ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string") {
    rd.Description = input["Description"];
  }
  ctx.store.set(ipamResourceDiscoveryKey(id), rd);
  return {
    IpamResourceDiscovery: {
      IpamResourceDiscoveryId: rd.IpamResourceDiscoveryId,
      OwnerId: rd.OwnerId,
      IpamResourceDiscoveryArn: rd.IpamResourceDiscoveryArn,
      State: rd.State,
      Description: rd.Description,
      IsDefault: rd.IsDefault,
      Tags: rd.Tags,
    },
  };
};

const ModifyIpamScope: OperationHandler = (input, ctx) => {
  const scopeId =
    typeof input["IpamScopeId"] === "string" ? input["IpamScopeId"] : "";
  const scope = ctx.store.get<StoredIpamScope>(ipamScopeKey(scopeId));
  if (scope === undefined) {
    throw awsError(
      "InvalidIpamScopeId.NotFound",
      `The IPAM scope ID '${scopeId}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string") {
    scope.Description = input["Description"];
  }
  ctx.store.set(ipamScopeKey(scopeId), scope);
  return {
    IpamScope: {
      IpamScopeId: scope.IpamScopeId,
      IpamId: scope.IpamId,
      IpamScopeArn: scope.IpamScopeArn,
      IpamArn: scope.IpamArn,
      IpamScopeType: scope.IpamScopeType,
      IsDefault: scope.IsDefault,
      Description: scope.Description,
      PoolCount: scope.PoolCount,
      State: scope.State,
      Tags: scope.Tags,
    },
  };
};

const ModifyLaunchTemplate: OperationHandler = (input, ctx) => {
  const launchTemplateId =
    typeof input["LaunchTemplateId"] === "string"
      ? input["LaunchTemplateId"]
      : typeof input["LaunchTemplateName"] === "string"
        ? undefined
        : "";
  const launchTemplateName =
    typeof input["LaunchTemplateName"] === "string"
      ? input["LaunchTemplateName"]
      : undefined;
  let lt: StoredLaunchTemplate | undefined;
  if (launchTemplateId !== undefined && launchTemplateId !== "") {
    lt = ctx.store.get<StoredLaunchTemplate>(
      launchTemplateKey(launchTemplateId),
    );
  } else if (launchTemplateName !== undefined) {
    lt = ctx.store
      .list<StoredLaunchTemplate>()
      .map((entry) => entry.value)
      .find((t) => t.LaunchTemplateName === launchTemplateName);
  }
  if (lt === undefined) {
    throw awsError(
      "InvalidLaunchTemplateId.NotFound",
      `The launch template ID does not exist`,
      400,
    );
  }
  const defaultVersion =
    typeof input["DefaultVersion"] === "string"
      ? parseInt(input["DefaultVersion"], 10)
      : undefined;
  if (defaultVersion !== undefined && !isNaN(defaultVersion)) {
    lt.DefaultVersionNumber = defaultVersion;
  }
  ctx.store.set(launchTemplateKey(lt.LaunchTemplateId), lt);
  return {
    LaunchTemplate: {
      LaunchTemplateId: lt.LaunchTemplateId,
      LaunchTemplateName: lt.LaunchTemplateName,
      DefaultVersionNumber: lt.DefaultVersionNumber,
      LatestVersionNumber: lt.LatestVersionNumber,
      CreateTime: lt.CreateTime,
      CreatedBy: lt.CreatedBy,
      Tags: lt.Tags,
    },
  };
};

const ModifyLocalGatewayRoute: OperationHandler = (input, ctx) => {
  const rtbId =
    typeof input["LocalGatewayRouteTableId"] === "string"
      ? input["LocalGatewayRouteTableId"]
      : "";
  const destinationCidrBlock =
    typeof input["DestinationCidrBlock"] === "string"
      ? input["DestinationCidrBlock"]
      : "";
  const route = ctx.store.get<StoredLocalGatewayRoute>(
    localGatewayRouteKey(rtbId, destinationCidrBlock),
  );
  if (route === undefined) {
    throw awsError(
      "InvalidRoute.NotFound",
      `The route '${destinationCidrBlock}' in route table '${rtbId}' does not exist`,
      400,
    );
  }
  const vifGroupId =
    typeof input["LocalGatewayVirtualInterfaceGroupId"] === "string"
      ? input["LocalGatewayVirtualInterfaceGroupId"]
      : undefined;
  if (vifGroupId !== undefined) {
    route.LocalGatewayVirtualInterfaceGroupId = vifGroupId;
  }
  ctx.store.set(localGatewayRouteKey(rtbId, destinationCidrBlock), route);
  return {
    Route: {
      DestinationCidrBlock: route.DestinationCidrBlock,
      LocalGatewayVirtualInterfaceGroupId:
        route.LocalGatewayVirtualInterfaceGroupId,
      Type: route.Type,
      State: route.State,
      LocalGatewayRouteTableId: route.LocalGatewayRouteTableId,
    },
  };
};

const ModifyManagedPrefixList: OperationHandler = (input, ctx) => {
  const plId =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const pl = ctx.store.get<StoredManagedPrefixList>(managedPrefixListKey(plId));
  if (pl === undefined) {
    throw awsError(
      "InvalidPrefixListID.NotFound",
      `The prefix list ID '${plId}' does not exist`,
      400,
    );
  }
  if (typeof input["PrefixListName"] === "string") {
    pl.PrefixListName = input["PrefixListName"];
  }
  if (typeof input["MaxEntries"] === "number") {
    pl.MaxEntries = input["MaxEntries"];
  }
  const addEntries = input["AddEntries"];
  if (Array.isArray(addEntries)) {
    for (const e of addEntries) {
      if (typeof e !== "object" || e === null) continue;
      const entry = e as Record<string, unknown>;
      const cidr = typeof entry["Cidr"] === "string" ? entry["Cidr"] : "";
      if (cidr === "") continue;
      const existing = pl.Entries.findIndex((x) => x.Cidr === cidr);
      if (existing === -1) {
        pl.Entries.push({
          Cidr: cidr,
          ...(typeof entry["Description"] === "string"
            ? { Description: entry["Description"] }
            : {}),
        });
      } else {
        if (typeof entry["Description"] === "string") {
          pl.Entries[existing].Description = entry["Description"];
        }
      }
    }
  }
  const removeEntries = input["RemoveEntries"];
  if (Array.isArray(removeEntries)) {
    for (const e of removeEntries) {
      if (typeof e !== "object" || e === null) continue;
      const entry = e as Record<string, unknown>;
      const cidr = typeof entry["Cidr"] === "string" ? entry["Cidr"] : "";
      if (cidr === "") continue;
      pl.Entries = pl.Entries.filter((x) => x.Cidr !== cidr);
    }
  }
  pl.Version += 1;
  pl.State = "modify-complete";
  ctx.store.set(managedPrefixListKey(plId), pl);
  return {
    PrefixList: {
      PrefixListId: pl.PrefixListId,
      AddressFamily: pl.AddressFamily,
      State: pl.State,
      PrefixListArn: pl.PrefixListArn,
      PrefixListName: pl.PrefixListName,
      MaxEntries: pl.MaxEntries,
      Version: pl.Version,
      Tags: pl.Tags,
      OwnerId: pl.OwnerId,
    },
  };
};

const ModifyManagedResourceVisibility: OperationHandler = (input, _ctx) => {
  const defaultVisibility =
    typeof input["DefaultVisibility"] === "string"
      ? input["DefaultVisibility"]
      : "visible";
  return {
    Visibility: {
      DefaultVisibility: defaultVisibility,
    },
  };
};

const ModifyNetworkInterfaceAttribute: OperationHandler = (input, ctx) => {
  const id =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const ni = ctx.store.get<StoredNetworkInterface>(networkInterfaceKey(id));
  if (ni === undefined) {
    throw awsError(
      "InvalidNetworkInterfaceID.NotFound",
      `The network interface '${id}' does not exist`,
      400,
    );
  }
  const descAttr = input["Description"];
  if (
    typeof descAttr === "object" &&
    descAttr !== null &&
    typeof (descAttr as Record<string, unknown>)["Value"] === "string"
  ) {
    ni.Description = (descAttr as Record<string, unknown>)["Value"] as string;
  }
  const sdcAttr = input["SourceDestCheck"];
  if (
    typeof sdcAttr === "object" &&
    sdcAttr !== null &&
    typeof (sdcAttr as Record<string, unknown>)["Value"] === "boolean"
  ) {
    ni.SourceDestCheck = (sdcAttr as Record<string, unknown>)[
      "Value"
    ] as boolean;
  }
  const groups = input["Groups"];
  if (Array.isArray(groups)) {
    ni.Groups = groups
      .filter((g): g is string => typeof g === "string")
      .map((gId) => ({ GroupId: gId, GroupName: "" }));
  }
  ctx.store.set(networkInterfaceKey(id), ni);
  return {};
};

const ModifyPrivateDnsNameOptions: OperationHandler = (input, ctx) => {
  const instanceId =
    typeof input["InstanceId"] === "string" ? input["InstanceId"] : "";
  const instance = ctx.store.get<StoredInstance>(instanceKey(instanceId));
  if (instance === undefined) {
    throw awsError(
      "InvalidInstanceID.NotFound",
      `The instance ID '${instanceId}' does not exist`,
      400,
    );
  }
  return { Return: true };
};

const ModifyPublicIpDnsNameOptions: OperationHandler = (input, ctx) => {
  const niId =
    typeof input["NetworkInterfaceId"] === "string"
      ? input["NetworkInterfaceId"]
      : "";
  const ni = ctx.store.get<StoredNetworkInterface>(networkInterfaceKey(niId));
  if (ni === undefined) {
    throw awsError(
      "InvalidNetworkInterfaceID.NotFound",
      `The network interface '${niId}' does not exist`,
      400,
    );
  }
  return { Successful: true };
};

const ModifyReservedInstances: OperationHandler = (_input, _ctx) => {
  const modificationId = hexId("rimod");
  return { ReservedInstancesModificationId: modificationId };
};

const ModifyRouteServer: OperationHandler = (input, ctx) => {
  const id =
    typeof input["RouteServerId"] === "string" ? input["RouteServerId"] : "";
  const server = ctx.store.get<StoredRouteServer>(routeServerKey(id));
  if (server === undefined) {
    throw awsError(
      "InvalidRouteServerId.NotFound",
      `The route server '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["PersistRoutes"] === "string") {
    server.PersistRoutesState = input["PersistRoutes"];
  }
  if (typeof input["PersistRoutesDuration"] === "number") {
    server.PersistRoutesDuration = input["PersistRoutesDuration"];
  }
  if (typeof input["SnsNotificationsEnabled"] === "boolean") {
    server.SnsNotificationsEnabled = input["SnsNotificationsEnabled"];
  }
  ctx.store.set(routeServerKey(id), server);
  return {
    RouteServer: {
      RouteServerId: server.RouteServerId,
      AmazonSideAsn: server.AmazonSideAsn,
      State: server.State,
      PersistRoutesState: server.PersistRoutesState,
      PersistRoutesDuration: server.PersistRoutesDuration,
      SnsNotificationsEnabled: server.SnsNotificationsEnabled,
      Tags: server.Tags,
    },
  };
};

const ModifySecurityGroupRules: OperationHandler = (input, ctx) => {
  const groupId = typeof input["GroupId"] === "string" ? input["GroupId"] : "";
  const group = ctx.store.get<StoredSecurityGroup>(sgKey(groupId));
  if (group === undefined) {
    throw awsError(
      "InvalidGroup.NotFound",
      `The security group '${groupId}' does not exist`,
      400,
    );
  }
  const updates = Array.isArray(input["SecurityGroupRules"])
    ? (input["SecurityGroupRules"] as unknown[])
    : [];
  for (const u of updates) {
    if (typeof u !== "object" || u === null) continue;
    const update = u as Record<string, unknown>;
    const ruleId =
      typeof update["SecurityGroupRuleId"] === "string"
        ? update["SecurityGroupRuleId"]
        : "";
    const ruleReq =
      typeof update["SecurityGroupRule"] === "object" &&
      update["SecurityGroupRule"] !== null
        ? (update["SecurityGroupRule"] as Record<string, unknown>)
        : null;
    if (ruleId === "" || ruleReq === null) continue;
    const allRules = [...group.IngressRules, ...group.EgressRules];
    const rule = allRules.find((r) => r.SecurityGroupRuleId === ruleId);
    if (rule === undefined) continue;
    if (typeof ruleReq["IpProtocol"] === "string") {
      rule.IpProtocol = ruleReq["IpProtocol"];
    }
    if (typeof ruleReq["FromPort"] === "number") {
      rule.FromPort = ruleReq["FromPort"];
    }
    if (typeof ruleReq["ToPort"] === "number") {
      rule.ToPort = ruleReq["ToPort"];
    }
    if (typeof ruleReq["CidrIpv4"] === "string") {
      rule.CidrIpv4 = ruleReq["CidrIpv4"];
    }
    if (typeof ruleReq["Description"] === "string") {
      rule.Description = ruleReq["Description"];
    }
  }
  ctx.store.set(sgKey(groupId), group);
  return { Return: true };
};

const ModifySnapshotAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : "";
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
  if (snapshot === undefined) {
    throw awsError(
      "InvalidSnapshot.NotFound",
      `The snapshot '${id}' does not exist.`,
      400,
    );
  }
  const operationType =
    typeof input["OperationType"] === "string" ? input["OperationType"] : "";
  const userIds = Array.isArray(input["UserIds"])
    ? (input["UserIds"] as unknown[]).filter(
        (u): u is string => typeof u === "string",
      )
    : [];
  if (!snapshot.CreateVolumePermissions) {
    snapshot.CreateVolumePermissions = [];
  }
  if (operationType === "add") {
    for (const userId of userIds) {
      if (!snapshot.CreateVolumePermissions.some((p) => p.UserId === userId)) {
        snapshot.CreateVolumePermissions.push({ UserId: userId });
      }
    }
  } else if (operationType === "remove") {
    snapshot.CreateVolumePermissions = snapshot.CreateVolumePermissions.filter(
      (p) => !userIds.includes(p.UserId),
    );
  }
  ctx.store.set(snapshotKey(id), snapshot);
  return {};
};

const ModifySnapshotTier: OperationHandler = (input, ctx) => {
  const id = typeof input["SnapshotId"] === "string" ? input["SnapshotId"] : "";
  const snapshot = ctx.store.get<StoredSnapshot>(snapshotKey(id));
  if (snapshot === undefined) {
    throw awsError(
      "InvalidSnapshot.NotFound",
      `The snapshot '${id}' does not exist.`,
      400,
    );
  }
  return {
    SnapshotId: id,
    TieringStartTime: new Date().toISOString(),
  };
};

const ModifySpotFleetRequest: OperationHandler = (input, ctx) => {
  const id =
    typeof input["SpotFleetRequestId"] === "string"
      ? input["SpotFleetRequestId"]
      : "";
  const fleet = ctx.store.get<StoredSpotFleetRequest>(spotFleetRequestKey(id));
  if (fleet === undefined) {
    throw awsError(
      "InvalidSpotFleetRequestId.NotFound",
      `The spot fleet request ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["TargetCapacity"] === "number") {
    fleet.SpotFleetRequestConfig.TargetCapacity = input["TargetCapacity"];
  }
  if (typeof input["OnDemandTargetCapacity"] === "number") {
    fleet.SpotFleetRequestConfig.TargetCapacity =
      input["OnDemandTargetCapacity"];
  }
  ctx.store.set(spotFleetRequestKey(id), fleet);
  return { Return: true };
};

const ModifySubnetAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["SubnetId"] === "string" ? input["SubnetId"] : "";
  const subnet = ctx.store.get<StoredSubnet>(subnetKey(id));
  if (subnet === undefined) {
    throw awsError(
      "InvalidSubnetID.NotFound",
      `The subnet ID '${id}' does not exist`,
      400,
    );
  }
  const mapPublicAttr = input["MapPublicIpOnLaunch"];
  if (
    typeof mapPublicAttr === "object" &&
    mapPublicAttr !== null &&
    typeof (mapPublicAttr as Record<string, unknown>)["Value"] === "boolean"
  ) {
    subnet.MapPublicIpOnLaunch = (mapPublicAttr as Record<string, unknown>)[
      "Value"
    ] as boolean;
  }
  ctx.store.set(subnetKey(id), subnet);
  return {};
};

const ModifyTrafficMirrorFilterRule: OperationHandler = (input, ctx) => {
  const ruleId =
    typeof input["TrafficMirrorFilterRuleId"] === "string"
      ? input["TrafficMirrorFilterRuleId"]
      : "";
  const rule = ctx.store.get<StoredTrafficMirrorFilterRule>(
    trafficMirrorFilterRuleKey(ruleId),
  );
  if (rule === undefined) {
    throw awsError(
      "InvalidTrafficMirrorFilterRuleId.NotFound",
      `The Traffic Mirror filter rule '${ruleId}' does not exist`,
      400,
    );
  }
  const removeFields = stringList(input["RemoveFields"]);
  if (typeof input["TrafficDirection"] === "string")
    rule.TrafficDirection = input["TrafficDirection"];
  if (integerOf(input["RuleNumber"]) !== undefined)
    rule.RuleNumber = integerOf(input["RuleNumber"])!;
  if (typeof input["RuleAction"] === "string")
    rule.RuleAction = input["RuleAction"];
  if (typeof input["DestinationCidrBlock"] === "string")
    rule.DestinationCidrBlock = input["DestinationCidrBlock"];
  if (typeof input["SourceCidrBlock"] === "string")
    rule.SourceCidrBlock = input["SourceCidrBlock"];
  if (typeof input["Description"] === "string")
    rule.Description = input["Description"];
  if (
    typeof input["Protocol"] === "number" ||
    typeof input["Protocol"] === "string"
  )
    rule.Protocol = integerOf(input["Protocol"]);
  const destPortRangeRaw =
    typeof input["DestinationPortRange"] === "object" &&
    input["DestinationPortRange"] !== null
      ? (input["DestinationPortRange"] as Record<string, unknown>)
      : undefined;
  if (destPortRangeRaw !== undefined) {
    rule.DestinationPortRange = {
      FromPort: integerOf(destPortRangeRaw["FromPort"]) ?? 0,
      ToPort: integerOf(destPortRangeRaw["ToPort"]) ?? 65535,
    };
  }
  const srcPortRangeRaw =
    typeof input["SourcePortRange"] === "object" &&
    input["SourcePortRange"] !== null
      ? (input["SourcePortRange"] as Record<string, unknown>)
      : undefined;
  if (srcPortRangeRaw !== undefined) {
    rule.SourcePortRange = {
      FromPort: integerOf(srcPortRangeRaw["FromPort"]) ?? 0,
      ToPort: integerOf(srcPortRangeRaw["ToPort"]) ?? 65535,
    };
  }
  if (removeFields.includes("destination-port-range"))
    rule.DestinationPortRange = undefined;
  if (removeFields.includes("source-port-range"))
    rule.SourcePortRange = undefined;
  if (removeFields.includes("protocol")) rule.Protocol = undefined;
  if (removeFields.includes("description")) rule.Description = "";
  ctx.store.set(trafficMirrorFilterRuleKey(ruleId), rule);
  const filter = ctx.store.get<StoredTrafficMirrorFilter>(
    trafficMirrorFilterKey(rule.TrafficMirrorFilterId),
  );
  if (filter !== undefined) {
    const updateRule = (rules: StoredTrafficMirrorFilterRule[]) => {
      const idx = rules.findIndex(
        (r) => r.TrafficMirrorFilterRuleId === ruleId,
      );
      if (idx >= 0) rules[idx] = rule;
    };
    updateRule(filter.IngressFilterRules);
    updateRule(filter.EgressFilterRules);
    ctx.store.set(trafficMirrorFilterKey(rule.TrafficMirrorFilterId), filter);
  }
  return {
    TrafficMirrorFilterRule: {
      TrafficMirrorFilterRuleId: rule.TrafficMirrorFilterRuleId,
      TrafficMirrorFilterId: rule.TrafficMirrorFilterId,
      TrafficDirection: rule.TrafficDirection,
      RuleNumber: rule.RuleNumber,
      RuleAction: rule.RuleAction,
      Protocol: rule.Protocol,
      DestinationPortRange: rule.DestinationPortRange,
      SourcePortRange: rule.SourcePortRange,
      DestinationCidrBlock: rule.DestinationCidrBlock,
      SourceCidrBlock: rule.SourceCidrBlock,
      Description: rule.Description,
      Tags: rule.Tags,
    },
  };
};

const ModifyTrafficMirrorSession: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TrafficMirrorSessionId"] === "string"
      ? input["TrafficMirrorSessionId"]
      : "";
  const session = ctx.store.get<StoredTrafficMirrorSession>(
    trafficMirrorSessionKey(id),
  );
  if (session === undefined) {
    throw awsError(
      "InvalidTrafficMirrorSessionId.NotFound",
      `The Traffic Mirror session '${id}' does not exist`,
      400,
    );
  }
  const removeFields = stringList(input["RemoveFields"]);
  if (typeof input["TrafficMirrorTargetId"] === "string")
    session.TrafficMirrorTargetId = input["TrafficMirrorTargetId"];
  if (typeof input["TrafficMirrorFilterId"] === "string")
    session.TrafficMirrorFilterId = input["TrafficMirrorFilterId"];
  if (integerOf(input["SessionNumber"]) !== undefined)
    session.SessionNumber = integerOf(input["SessionNumber"])!;
  if (typeof input["Description"] === "string")
    session.Description = input["Description"];
  if (
    typeof input["PacketLength"] === "number" ||
    typeof input["PacketLength"] === "string"
  )
    session.PacketLength = integerOf(input["PacketLength"]);
  if (
    typeof input["VirtualNetworkId"] === "number" ||
    typeof input["VirtualNetworkId"] === "string"
  )
    session.VirtualNetworkId = integerOf(input["VirtualNetworkId"]);
  if (removeFields.includes("packet-length")) session.PacketLength = undefined;
  if (removeFields.includes("virtual-network-id"))
    session.VirtualNetworkId = undefined;
  if (removeFields.includes("description")) session.Description = "";
  ctx.store.set(trafficMirrorSessionKey(id), session);
  return {
    TrafficMirrorSession: {
      TrafficMirrorSessionId: session.TrafficMirrorSessionId,
      TrafficMirrorTargetId: session.TrafficMirrorTargetId,
      TrafficMirrorFilterId: session.TrafficMirrorFilterId,
      NetworkInterfaceId: session.NetworkInterfaceId,
      OwnerId: session.OwnerId,
      PacketLength: session.PacketLength,
      SessionNumber: session.SessionNumber,
      VirtualNetworkId: session.VirtualNetworkId,
      Description: session.Description,
      Tags: session.Tags,
    },
  };
};

const ModifyTransitGateway: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayId"] === "string"
      ? input["TransitGatewayId"]
      : "";
  const gateway = ctx.store.get<StoredTransitGateway>(transitGatewayKey(id));
  if (gateway === undefined) {
    throw awsError(
      "InvalidTransitGatewayID.NotFound",
      `The transit gateway '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string")
    gateway.Description = input["Description"];
  const opts =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  if (typeof opts["AutoAcceptSharedAttachments"] === "string")
    gateway.Options.AutoAcceptSharedAttachments =
      opts["AutoAcceptSharedAttachments"];
  if (typeof opts["DefaultRouteTableAssociation"] === "string")
    gateway.Options.DefaultRouteTableAssociation =
      opts["DefaultRouteTableAssociation"];
  if (typeof opts["DefaultRouteTablePropagation"] === "string")
    gateway.Options.DefaultRouteTablePropagation =
      opts["DefaultRouteTablePropagation"];
  if (typeof opts["VpnEcmpSupport"] === "string")
    gateway.Options.VpnEcmpSupport = opts["VpnEcmpSupport"];
  if (typeof opts["DnsSupport"] === "string")
    gateway.Options.DnsSupport = opts["DnsSupport"];
  ctx.store.set(transitGatewayKey(id), gateway);
  return {
    TransitGateway: {
      TransitGatewayId: gateway.TransitGatewayId,
      TransitGatewayArn: gateway.TransitGatewayArn,
      State: gateway.State,
      OwnerId: gateway.OwnerId,
      Description: gateway.Description,
      CreationTime: gateway.CreationTime,
      Options: gateway.Options,
      Tags: gateway.Tags,
    },
  };
};

const ModifyTransitGatewayMeteringPolicy: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayMeteringPolicyId"] === "string"
      ? input["TransitGatewayMeteringPolicyId"]
      : "";
  const policy = ctx.store.get<StoredTransitGatewayMeteringPolicy>(
    transitGatewayMeteringPolicyKey(id),
  );
  if (policy === undefined) {
    throw awsError(
      "InvalidTransitGatewayMeteringPolicyID.NotFound",
      `The transit gateway metering policy '${id}' does not exist`,
      400,
    );
  }
  const addIds = stringList(input["AddMiddleboxAttachmentIds"]);
  const removeIds = stringList(input["RemoveMiddleboxAttachmentIds"]);
  for (const aid of addIds) {
    if (!policy.MiddleboxAttachmentIds.includes(aid))
      policy.MiddleboxAttachmentIds.push(aid);
  }
  policy.MiddleboxAttachmentIds = policy.MiddleboxAttachmentIds.filter(
    (x) => !removeIds.includes(x),
  );
  ctx.store.set(transitGatewayMeteringPolicyKey(id), policy);
  return {
    TransitGatewayMeteringPolicy: {
      TransitGatewayMeteringPolicyId: policy.TransitGatewayMeteringPolicyId,
      TransitGatewayId: policy.TransitGatewayId,
      MiddleboxAttachmentIds: policy.MiddleboxAttachmentIds,
      State: policy.State,
      UpdateEffectiveAt: policy.UpdateEffectiveAt,
      Tags: policy.Tags,
    },
  };
};

const ModifyTransitGatewayPrefixListReference: OperationHandler = (
  input,
  ctx,
) => {
  const routeTableId =
    typeof input["TransitGatewayRouteTableId"] === "string"
      ? input["TransitGatewayRouteTableId"]
      : "";
  const prefixListId =
    typeof input["PrefixListId"] === "string" ? input["PrefixListId"] : "";
  const ref = ctx.store.get<StoredTransitGatewayPrefixListReference>(
    transitGatewayPrefixListReferenceKey(routeTableId, prefixListId),
  );
  if (ref === undefined) {
    throw awsError(
      "InvalidTransitGatewayPrefixListReferenceID.NotFound",
      `The transit gateway prefix list reference '${prefixListId}' does not exist`,
      400,
    );
  }
  if (typeof input["TransitGatewayAttachmentId"] === "string")
    ref.TransitGatewayAttachment.TransitGatewayAttachmentId =
      input["TransitGatewayAttachmentId"];
  if (typeof input["Blackhole"] === "boolean")
    ref.Blackhole = input["Blackhole"];
  ref.State = "available";
  ctx.store.set(
    transitGatewayPrefixListReferenceKey(routeTableId, prefixListId),
    ref,
  );
  return {
    TransitGatewayPrefixListReference: {
      TransitGatewayRouteTableId: ref.TransitGatewayRouteTableId,
      PrefixListId: ref.PrefixListId,
      PrefixListOwnerId: ref.PrefixListOwnerId,
      State: ref.State,
      Blackhole: ref.Blackhole,
      TransitGatewayAttachment: ref.TransitGatewayAttachment,
    },
  };
};

const ModifyTransitGatewayVpcAttachment: OperationHandler = (input, ctx) => {
  const id =
    typeof input["TransitGatewayAttachmentId"] === "string"
      ? input["TransitGatewayAttachmentId"]
      : "";
  const attachment = ctx.store.get<StoredTransitGatewayVpcAttachment>(
    transitGatewayVpcAttachmentKey(id),
  );
  if (attachment === undefined) {
    throw awsError(
      "InvalidTransitGatewayAttachmentID.NotFound",
      `The transit gateway attachment '${id}' does not exist`,
      400,
    );
  }
  const addSubnets = stringList(input["AddSubnetIds"]);
  const removeSubnets = stringList(input["RemoveSubnetIds"]);
  for (const s of addSubnets) {
    if (!attachment.SubnetIds.includes(s)) attachment.SubnetIds.push(s);
  }
  attachment.SubnetIds = attachment.SubnetIds.filter(
    (s) => !removeSubnets.includes(s),
  );
  const opts =
    typeof input["Options"] === "object" && input["Options"] !== null
      ? (input["Options"] as Record<string, unknown>)
      : {};
  if (typeof opts["DnsSupport"] === "string")
    attachment.Options.DnsSupport = opts["DnsSupport"];
  if (typeof opts["SecurityGroupReferencingSupport"] === "string")
    attachment.Options.SecurityGroupReferencingSupport =
      opts["SecurityGroupReferencingSupport"];
  if (typeof opts["Ipv6Support"] === "string")
    attachment.Options.Ipv6Support = opts["Ipv6Support"];
  if (typeof opts["ApplianceModeSupport"] === "string")
    attachment.Options.ApplianceModeSupport = opts["ApplianceModeSupport"];
  ctx.store.set(transitGatewayVpcAttachmentKey(id), attachment);
  return {
    TransitGatewayVpcAttachment: {
      TransitGatewayAttachmentId: attachment.TransitGatewayAttachmentId,
      TransitGatewayId: attachment.TransitGatewayId,
      VpcId: attachment.VpcId,
      VpcOwnerId: attachment.VpcOwnerId,
      State: attachment.State,
      SubnetIds: attachment.SubnetIds,
      CreationTime: attachment.CreationTime,
      Options: attachment.Options,
      Tags: attachment.Tags,
    },
  };
};

const ModifyVerifiedAccessEndpoint: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessEndpointId"] === "string"
      ? input["VerifiedAccessEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredVerifiedAccessEndpoint>(
    verifiedAccessEndpointKey(id),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidVerifiedAccessEndpointId.NotFound",
      `The verified access endpoint '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string")
    endpoint.Description = input["Description"];
  if (typeof input["VerifiedAccessGroupId"] === "string")
    endpoint.VerifiedAccessGroupId = input["VerifiedAccessGroupId"];
  endpoint.LastUpdatedTime = new Date().toISOString();
  ctx.store.set(verifiedAccessEndpointKey(id), endpoint);
  return {
    VerifiedAccessEndpoint: {
      VerifiedAccessInstanceId: endpoint.VerifiedAccessInstanceId,
      VerifiedAccessGroupId: endpoint.VerifiedAccessGroupId,
      VerifiedAccessEndpointId: endpoint.VerifiedAccessEndpointId,
      ApplicationDomain: endpoint.ApplicationDomain,
      EndpointType: endpoint.EndpointType,
      AttachmentType: endpoint.AttachmentType,
      DomainCertificateArn: endpoint.DomainCertificateArn,
      EndpointDomain: endpoint.EndpointDomain,
      SecurityGroupIds: endpoint.SecurityGroupIds,
      Status: { Code: "active", Message: "" },
      Description: endpoint.Description,
      CreationTime: endpoint.CreationTime,
      LastUpdatedTime: endpoint.LastUpdatedTime,
      Tags: endpoint.Tags,
    },
  };
};

const ModifyVerifiedAccessEndpointPolicy: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessEndpointId"] === "string"
      ? input["VerifiedAccessEndpointId"]
      : "";
  const endpoint = ctx.store.get<StoredVerifiedAccessEndpoint>(
    verifiedAccessEndpointKey(id),
  );
  if (endpoint === undefined) {
    throw awsError(
      "InvalidVerifiedAccessEndpointId.NotFound",
      `The verified access endpoint '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["PolicyEnabled"] === "boolean")
    endpoint.PolicyEnabled = input["PolicyEnabled"];
  if (typeof input["PolicyDocument"] === "string")
    endpoint.PolicyDocument = input["PolicyDocument"];
  ctx.store.set(verifiedAccessEndpointKey(id), endpoint);
  return {
    PolicyEnabled: endpoint.PolicyEnabled ?? false,
    PolicyDocument: endpoint.PolicyDocument ?? "",
  };
};

const ModifyVerifiedAccessGroup: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessGroupId"] === "string"
      ? input["VerifiedAccessGroupId"]
      : "";
  const group = ctx.store.get<StoredVerifiedAccessGroup>(
    verifiedAccessGroupKey(id),
  );
  if (group === undefined) {
    throw awsError(
      "InvalidVerifiedAccessGroupId.NotFound",
      `The verified access group '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string")
    group.Description = input["Description"];
  if (typeof input["VerifiedAccessInstanceId"] === "string")
    group.VerifiedAccessInstanceId = input["VerifiedAccessInstanceId"];
  group.LastUpdatedTime = new Date().toISOString();
  ctx.store.set(verifiedAccessGroupKey(id), group);
  return {
    VerifiedAccessGroup: {
      VerifiedAccessGroupId: group.VerifiedAccessGroupId,
      VerifiedAccessInstanceId: group.VerifiedAccessInstanceId,
      Description: group.Description,
      Owner: group.Owner,
      VerifiedAccessGroupArn: group.VerifiedAccessGroupArn,
      CreationTime: group.CreationTime,
      LastUpdatedTime: group.LastUpdatedTime,
      Tags: group.Tags,
    },
  };
};

const ModifyVerifiedAccessGroupPolicy: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessGroupId"] === "string"
      ? input["VerifiedAccessGroupId"]
      : "";
  const group = ctx.store.get<StoredVerifiedAccessGroup>(
    verifiedAccessGroupKey(id),
  );
  if (group === undefined) {
    throw awsError(
      "InvalidVerifiedAccessGroupId.NotFound",
      `The verified access group '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["PolicyEnabled"] === "boolean")
    group.PolicyEnabled = input["PolicyEnabled"];
  if (typeof input["PolicyDocument"] === "string")
    group.PolicyDocument = input["PolicyDocument"];
  ctx.store.set(verifiedAccessGroupKey(id), group);
  return {
    PolicyEnabled: group.PolicyEnabled ?? false,
    PolicyDocument: group.PolicyDocument ?? "",
  };
};

const ModifyVerifiedAccessInstance: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const instance = ctx.store.get<StoredVerifiedAccessInstance>(
    vaInstanceKey(id),
  );
  if (instance === undefined) {
    throw awsError(
      "InvalidVerifiedAccessInstanceId.NotFound",
      `The verified access instance '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string")
    instance.Description = input["Description"];
  instance.LastUpdatedTime = new Date().toISOString();
  ctx.store.set(vaInstanceKey(id), instance);
  return {
    VerifiedAccessInstance: {
      VerifiedAccessInstanceId: instance.VerifiedAccessInstanceId,
      Description: instance.Description,
      VerifiedAccessTrustProviders: instance.TrustProviderIds.map((tid) => ({
        VerifiedAccessTrustProviderId: tid,
        TrustProviderType: "user",
      })),
      CreationTime: instance.CreationTime,
      LastUpdatedTime: instance.LastUpdatedTime,
      Tags: instance.Tags,
      FipsEnabled: instance.FipsEnabled,
    },
  };
};

const ModifyVerifiedAccessInstanceLoggingConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["VerifiedAccessInstanceId"] === "string"
      ? input["VerifiedAccessInstanceId"]
      : "";
  const instance = ctx.store.get<StoredVerifiedAccessInstance>(
    vaInstanceKey(id),
  );
  if (instance === undefined) {
    throw awsError(
      "InvalidVerifiedAccessInstanceId.NotFound",
      `The verified access instance '${id}' does not exist`,
      400,
    );
  }
  const accessLogsRaw =
    typeof input["AccessLogs"] === "object" && input["AccessLogs"] !== null
      ? (input["AccessLogs"] as Record<string, unknown>)
      : {};
  const s3Raw =
    typeof accessLogsRaw["S3"] === "object" && accessLogsRaw["S3"] !== null
      ? (accessLogsRaw["S3"] as Record<string, unknown>)
      : {};
  const cwRaw =
    typeof accessLogsRaw["CloudWatchLogs"] === "object" &&
    accessLogsRaw["CloudWatchLogs"] !== null
      ? (accessLogsRaw["CloudWatchLogs"] as Record<string, unknown>)
      : {};
  const kdfRaw =
    typeof accessLogsRaw["KinesisDataFirehose"] === "object" &&
    accessLogsRaw["KinesisDataFirehose"] !== null
      ? (accessLogsRaw["KinesisDataFirehose"] as Record<string, unknown>)
      : {};
  const existing = instance.AccessLogs ?? {
    S3: { Enabled: false },
    CloudWatchLogs: { Enabled: false },
    KinesisDataFirehose: { Enabled: false },
    LogVersion: "ocsf-0.1",
    IncludeTrustContext: false,
  };
  instance.AccessLogs = {
    S3: {
      Enabled:
        typeof s3Raw["Enabled"] === "boolean"
          ? s3Raw["Enabled"]
          : existing.S3.Enabled,
    },
    CloudWatchLogs: {
      Enabled:
        typeof cwRaw["Enabled"] === "boolean"
          ? cwRaw["Enabled"]
          : existing.CloudWatchLogs.Enabled,
    },
    KinesisDataFirehose: {
      Enabled:
        typeof kdfRaw["Enabled"] === "boolean"
          ? kdfRaw["Enabled"]
          : existing.KinesisDataFirehose.Enabled,
    },
    LogVersion:
      typeof accessLogsRaw["LogVersion"] === "string"
        ? accessLogsRaw["LogVersion"]
        : existing.LogVersion,
    IncludeTrustContext:
      typeof accessLogsRaw["IncludeTrustContext"] === "boolean"
        ? accessLogsRaw["IncludeTrustContext"]
        : existing.IncludeTrustContext,
  };
  ctx.store.set(vaInstanceKey(id), instance);
  return {
    LoggingConfiguration: {
      VerifiedAccessInstanceId: instance.VerifiedAccessInstanceId,
      AccessLogs: instance.AccessLogs,
    },
  };
};

const ModifyTrafficMirrorFilterNetworkServices: OperationHandler = (
  input,
  ctx,
) => {
  const filterId =
    typeof input["TrafficMirrorFilterId"] === "string"
      ? input["TrafficMirrorFilterId"]
      : "";
  const filter = ctx.store.get<StoredTrafficMirrorFilter>(
    trafficMirrorFilterKey(filterId),
  );
  if (filter === undefined) {
    throw awsError(
      "InvalidTrafficMirrorFilterId.NotFound",
      `The Traffic Mirror filter ID '${filterId}' does not exist`,
      400,
    );
  }
  const addServices = Array.isArray(input["AddNetworkServices"])
    ? (input["AddNetworkServices"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const removeServices = Array.isArray(input["RemoveNetworkServices"])
    ? (input["RemoveNetworkServices"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  for (const svc of addServices) {
    if (!filter.NetworkServices.includes(svc)) {
      filter.NetworkServices.push(svc);
    }
  }
  filter.NetworkServices = filter.NetworkServices.filter(
    (s) => !removeServices.includes(s),
  );
  ctx.store.set(trafficMirrorFilterKey(filterId), filter);
  return {
    TrafficMirrorFilter: {
      TrafficMirrorFilterId: filter.TrafficMirrorFilterId,
      IngressFilterRules: filter.IngressFilterRules,
      EgressFilterRules: filter.EgressFilterRules,
      NetworkServices: filter.NetworkServices,
      Description: filter.Description,
      Tags: filter.Tags,
    },
  };
};

const ModifyVerifiedAccessTrustProvider: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VerifiedAccessTrustProviderId"] === "string"
      ? input["VerifiedAccessTrustProviderId"]
      : "";
  const stored = ctx.store.get<StoredVerifiedAccessTrustProvider>(
    vaTrustProviderKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVerifiedAccessTrustProviderId.NotFound",
      `The verified access trust provider '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Description"] === "string")
    stored.Description = input["Description"];
  stored.LastUpdatedTime = new Date().toISOString();
  ctx.store.set(vaTrustProviderKey(id), stored);
  return {
    VerifiedAccessTrustProvider: {
      VerifiedAccessTrustProviderId: stored.VerifiedAccessTrustProviderId,
      TrustProviderType: stored.TrustProviderType,
      PolicyReferenceName: stored.PolicyReferenceName,
      Description: stored.Description,
      CreationTime: stored.CreationTime,
      LastUpdatedTime: stored.LastUpdatedTime,
      Tags: [],
    },
  };
};

const ModifyVolume: OperationHandler = (input, ctx) => {
  const id = typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(id));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${id}' does not exist.`,
      400,
    );
  }
  const origSize = volume.Size;
  const origType = volume.VolumeType;
  const origIops = volume.Iops;
  if (typeof input["Size"] === "number") volume.Size = input["Size"];
  if (typeof input["VolumeType"] === "string")
    volume.VolumeType = input["VolumeType"];
  if (typeof input["Iops"] === "number") volume.Iops = input["Iops"];
  ctx.store.set(volumeKey(id), volume);
  return {
    VolumeModification: {
      VolumeId: volume.VolumeId,
      ModificationState: "completed",
      TargetSize: volume.Size,
      TargetVolumeType: volume.VolumeType,
      TargetIops: volume.Iops,
      OriginalSize: origSize,
      OriginalVolumeType: origType,
      OriginalIops: origIops,
      Progress: 100,
      StartTime: new Date().toISOString(),
      EndTime: new Date().toISOString(),
    },
  };
};

const ModifyVolumeAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["VolumeId"] === "string" ? input["VolumeId"] : "";
  const volume = ctx.store.get<StoredVolume>(volumeKey(id));
  if (volume === undefined) {
    throw awsError(
      "InvalidVolume.NotFound",
      `The volume '${id}' does not exist.`,
      400,
    );
  }
  return {};
};

const ModifyVpcAttribute: OperationHandler = (input, ctx) => {
  const id = typeof input["VpcId"] === "string" ? input["VpcId"] : "";
  const vpc = ctx.store.get<StoredVpc>(vpcKey(id));
  if (vpc === undefined) {
    throw awsError(
      "InvalidVpcID.NotFound",
      `The vpc ID '${id}' does not exist`,
      400,
    );
  }
  const enableDnsHostnames =
    typeof input["EnableDnsHostnames"] === "object" &&
    input["EnableDnsHostnames"] !== null
      ? (input["EnableDnsHostnames"] as Record<string, unknown>)
      : undefined;
  const enableDnsSupport =
    typeof input["EnableDnsSupport"] === "object" &&
    input["EnableDnsSupport"] !== null
      ? (input["EnableDnsSupport"] as Record<string, unknown>)
      : undefined;
  const enableNaum =
    typeof input["EnableNetworkAddressUsageMetrics"] === "object" &&
    input["EnableNetworkAddressUsageMetrics"] !== null
      ? (input["EnableNetworkAddressUsageMetrics"] as Record<string, unknown>)
      : undefined;
  if (enableDnsHostnames !== undefined)
    vpc.EnableDnsHostnames = enableDnsHostnames["Value"] === true;
  if (enableDnsSupport !== undefined)
    vpc.EnableDnsSupport = enableDnsSupport["Value"] === true;
  if (enableNaum !== undefined)
    vpc.EnableNetworkAddressUsageMetrics = enableNaum["Value"] === true;
  ctx.store.set(vpcKey(id), vpc);
  return {};
};

const ModifyVpcBlockPublicAccessExclusion: OperationHandler = (input, ctx) => {
  const id =
    typeof input["ExclusionId"] === "string" ? input["ExclusionId"] : "";
  const stored = ctx.store.get<StoredVpcBlockPublicAccessExclusion>(
    vpcBlockPublicAccessExclusionKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcBlockPublicAccessExclusionId.NotFound",
      `The VPC block public access exclusion '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["InternetGatewayExclusionMode"] === "string")
    stored.InternetGatewayExclusionMode = input["InternetGatewayExclusionMode"];
  stored.LastUpdateTimestamp = new Date().toISOString();
  ctx.store.set(vpcBlockPublicAccessExclusionKey(id), stored);
  return {
    VpcBlockPublicAccessExclusion: {
      ExclusionId: stored.ExclusionId,
      InternetGatewayExclusionMode: stored.InternetGatewayExclusionMode,
      ResourceArn: stored.ResourceArn,
      State: stored.State,
      CreationTimestamp: stored.CreationTimestamp,
      LastUpdateTimestamp: stored.LastUpdateTimestamp,
      Tags: stored.Tags,
    },
  };
};

const vpcBpaOptionsKey = () => `vpc-bpa-options/global`;

const ModifyVpcBlockPublicAccessOptions: OperationHandler = (input, ctx) => {
  const mode =
    typeof input["InternetGatewayBlockMode"] === "string"
      ? input["InternetGatewayBlockMode"]
      : "off";
  const existing = ctx.store.get<{ mode: string }>(vpcBpaOptionsKey()) ?? {
    mode: "off",
  };
  existing.mode = mode;
  ctx.store.set(vpcBpaOptionsKey(), existing);
  return {
    VpcBlockPublicAccessOptions: {
      AwsAccountId: ctx.account,
      AwsRegion: ctx.region,
      State: "update-complete",
      InternetGatewayBlockMode: existing.mode,
      LastUpdateTimestamp: new Date().toISOString(),
    },
  };
};

const ModifyVpcEncryptionControl: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpcEncryptionControlId"] === "string"
      ? input["VpcEncryptionControlId"]
      : "";
  const stored = ctx.store.get<StoredVpcEncryptionControl>(
    vpcEncryptionControlKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcEncryptionControlId.NotFound",
      `The VPC encryption control '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["Mode"] === "string") stored.Mode = input["Mode"];
  ctx.store.set(vpcEncryptionControlKey(id), stored);
  return {
    VpcEncryptionControl: {
      VpcEncryptionControlId: stored.VpcEncryptionControlId,
      VpcId: stored.VpcId,
      Mode: stored.Mode,
      State: stored.State,
      Tags: stored.Tags,
    },
  };
};

const ModifyVpcEndpoint: OperationHandler = (input, ctx) => {
  const id =
    typeof input["VpcEndpointId"] === "string" ? input["VpcEndpointId"] : "";
  const stored = ctx.store.get<StoredVpcEndpoint>(vpcEndpointKey(id));
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcEndpointId.NotFound",
      `The vpc endpoint ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["PrivateDnsEnabled"] === "boolean")
    stored.PrivateDnsEnabled = input["PrivateDnsEnabled"];
  const addRouteTableIds = Array.isArray(input["AddRouteTableIds"])
    ? (input["AddRouteTableIds"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const removeRouteTableIds = Array.isArray(input["RemoveRouteTableIds"])
    ? (input["RemoveRouteTableIds"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const addSubnetIds = Array.isArray(input["AddSubnetIds"])
    ? (input["AddSubnetIds"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const removeSubnetIds = Array.isArray(input["RemoveSubnetIds"])
    ? (input["RemoveSubnetIds"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  for (const rtId of addRouteTableIds) {
    if (!stored.RouteTableIds.includes(rtId)) stored.RouteTableIds.push(rtId);
  }
  stored.RouteTableIds = stored.RouteTableIds.filter(
    (rtId) => !removeRouteTableIds.includes(rtId),
  );
  for (const sId of addSubnetIds) {
    if (!stored.SubnetIds.includes(sId)) stored.SubnetIds.push(sId);
  }
  stored.SubnetIds = stored.SubnetIds.filter(
    (sId) => !removeSubnetIds.includes(sId),
  );
  ctx.store.set(vpcEndpointKey(id), stored);
  return { Return: true };
};

const ModifyVpcEndpointConnectionNotification: OperationHandler = (
  input,
  ctx,
) => {
  const id =
    typeof input["ConnectionNotificationId"] === "string"
      ? input["ConnectionNotificationId"]
      : "";
  const stored = ctx.store.get<StoredVpcEndpointConnectionNotification>(
    vpcEndpointConnectionNotificationKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidConnectionNotification.NotFound",
      `The connection notification '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["ConnectionNotificationArn"] === "string")
    stored.ConnectionNotificationArn = input["ConnectionNotificationArn"];
  if (Array.isArray(input["ConnectionEvents"])) {
    stored.ConnectionEvents = (input["ConnectionEvents"] as unknown[]).filter(
      (e): e is string => typeof e === "string",
    );
  }
  ctx.store.set(vpcEndpointConnectionNotificationKey(id), stored);
  return { ReturnValue: true };
};

const ModifyVpcEndpointServiceConfiguration: OperationHandler = (
  input,
  ctx,
) => {
  const id = typeof input["ServiceId"] === "string" ? input["ServiceId"] : "";
  const stored = ctx.store.get<StoredVpcEndpointServiceConfiguration>(
    vpcEndpointServiceConfigKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcEndpointServiceId.NotFound",
      `The vpc endpoint service ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["AcceptanceRequired"] === "boolean")
    stored.AcceptanceRequired = input["AcceptanceRequired"];
  if (typeof input["PrivateDnsName"] === "string")
    stored.PrivateDnsName = input["PrivateDnsName"];
  if (input["RemovePrivateDnsName"] === true) stored.PrivateDnsName = undefined;
  const addNlbArns = Array.isArray(input["AddNetworkLoadBalancerArns"])
    ? (input["AddNetworkLoadBalancerArns"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const removeNlbArns = Array.isArray(input["RemoveNetworkLoadBalancerArns"])
    ? (input["RemoveNetworkLoadBalancerArns"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  for (const arn of addNlbArns) {
    if (!stored.NetworkLoadBalancerArns.includes(arn))
      stored.NetworkLoadBalancerArns.push(arn);
  }
  stored.NetworkLoadBalancerArns = stored.NetworkLoadBalancerArns.filter(
    (a) => !removeNlbArns.includes(a),
  );
  ctx.store.set(vpcEndpointServiceConfigKey(id), stored);
  return { Return: true };
};

const ModifyVpcEndpointServicePayerResponsibility: OperationHandler = (
  input,
  ctx,
) => {
  const id = typeof input["ServiceId"] === "string" ? input["ServiceId"] : "";
  const stored = ctx.store.get<StoredVpcEndpointServiceConfiguration>(
    vpcEndpointServiceConfigKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcEndpointServiceId.NotFound",
      `The vpc endpoint service ID '${id}' does not exist`,
      400,
    );
  }
  if (typeof input["PayerResponsibility"] === "string")
    stored.PayerResponsibility = input["PayerResponsibility"];
  ctx.store.set(vpcEndpointServiceConfigKey(id), stored);
  return { ReturnValue: true };
};

const ModifyVpcEndpointServicePermissions: OperationHandler = (input, ctx) => {
  const id = typeof input["ServiceId"] === "string" ? input["ServiceId"] : "";
  const stored = ctx.store.get<StoredVpcEndpointServiceConfiguration>(
    vpcEndpointServiceConfigKey(id),
  );
  if (stored === undefined) {
    throw awsError(
      "InvalidVpcEndpointServiceId.NotFound",
      `The vpc endpoint service ID '${id}' does not exist`,
      400,
    );
  }
  const addPrincipals = Array.isArray(input["AddAllowedPrincipals"])
    ? (input["AddAllowedPrincipals"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  const removePrincipals = Array.isArray(input["RemoveAllowedPrincipals"])
    ? (input["RemoveAllowedPrincipals"] as unknown[]).filter(
        (s): s is string => typeof s === "string",
      )
    : [];
  stored.AllowedPrincipals = stored.AllowedPrincipals ?? [];
  for (const p of addPrincipals) {
    if (!stored.AllowedPrincipals.includes(p)) stored.AllowedPrincipals.push(p);
  }
  stored.AllowedPrincipals = stored.AllowedPrincipals.filter(
    (p) => !removePrincipals.includes(p),
  );
  ctx.store.set(vpcEndpointServiceConfigKey(id), stored);
  return {
    AddedPrincipals: addPrincipals.map((p) => ({ Principal: p })),
    ReturnValue: true,
  };
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
    CreateSubnet,
    DescribeSubnets,
    DeleteSubnet,
    CreateRouteTable,
    DescribeRouteTables,
    CreateInternetGateway,
    AttachInternetGateway,
    DescribeInternetGateways,
    AllocateAddress,
    DescribeAddresses,
    ReleaseAddress,
    CreateKeyPair,
    DescribeKeyPairs,
    DescribeAvailabilityZones,
    AuthorizeSecurityGroupIngress,
    RevokeSecurityGroupIngress,
    CreateVolume,
    DescribeVolumes,
    DeleteVolume,
    CreateSnapshot,
    DescribeSnapshots,
    DeleteSnapshot,
    CreateNatGateway,
    DescribeNatGateways,
    DeleteNatGateway,
    AcceptAddressTransfer,
    AcceptCapacityReservationBillingOwnership,
    AcceptReservedInstancesExchangeQuote,
    AcceptTransitGatewayMulticastDomainAssociations,
    AcceptTransitGatewayPeeringAttachment,
    AcceptTransitGatewayVpcAttachment,
    AcceptVpcEndpointConnections,
    AcceptVpcPeeringConnection,
    AdvertiseByoipCidr,
    AllocateHosts,
    AllocateIpamPoolCidr,
    AssignIpv6Addresses,
    AssignPrivateIpAddresses,
    AssignPrivateNatGatewayAddress,
    AssociateAddress,
    AssociateCapacityReservationBillingOwner,
    AssociateClientVpnTargetNetwork,
    AcceptTransitGatewayClientVpnAttachment,
    ApplySecurityGroupsToClientVpnTargetNetwork,
    AssociateDhcpOptions,
    AssociateEnclaveCertificateIamRole,
    AssociateIamInstanceProfile,
    AssociateInstanceEventWindow,
    AssociateIpamByoasn,
    AssociateIpamResourceDiscovery,
    AssociateNatGatewayAddress,
    AssociateRouteServer,
    AssociateRouteTable,
    AssociateSecurityGroupVpc,
    AssociateSubnetCidrBlock,
    AssociateTransitGatewayMulticastDomain,
    AssociateTransitGatewayPolicyTable,
    AssociateTransitGatewayRouteTable,
    AssociateTrunkInterface,
    AssociateVpcCidrBlock,
    AuthorizeClientVpnIngress,
    AuthorizeSecurityGroupEgress,
    BundleInstance,
    CancelBundleTask,
    CancelCapacityReservation,
    CancelCapacityReservationFleets,
    AttachVolume,
    DetachVolume,
    AttachNetworkInterface,
    DetachNetworkInterface,
    AttachVpnGateway,
    DetachVpnGateway,
    AttachClassicLinkVpc,
    DetachClassicLinkVpc,
    AttachVerifiedAccessTrustProvider,
    DetachVerifiedAccessTrustProvider,
    DetachInternetGateway,
    CreateCapacityReservation,
    CreateCapacityReservationBySplitting,
    CreateCapacityReservationFleet,
    CreateCapacityManagerDataExport,
    CreateCarrierGateway,
    CreateClientVpnEndpoint,
    CreateClientVpnRoute,
    CreateCoipPool,
    CreateCoipCidr,
    CreateCustomerGateway,
    CreateDefaultSubnet,
    CreateDefaultVpc,
    CreateIpam,
    CreateIpamExternalResourceVerificationToken,
    CreateIpamPolicy,
    CreateIpamPool,
    CreateIpamPrefixListResolver,
    CreateIpamPrefixListResolverTarget,
    CreateIpamResourceDiscovery,
    CreateIpamScope,
    CreateLaunchTemplate,
    CreateLaunchTemplateVersion,
    CreateLocalGatewayRoute,
    CreateLocalGatewayRouteTable,
    CreateLocalGatewayRouteTableVirtualInterfaceGroupAssociation,
    CreateLocalGatewayRouteTableVpcAssociation,
    CreateLocalGatewayVirtualInterface,
    CreateLocalGatewayVirtualInterfaceGroup,
    CreateMacSystemIntegrityProtectionModificationTask,
    CreateManagedPrefixList,
    CreateNetworkAcl,
    CreateNetworkAclEntry,
    CreateNetworkInsightsAccessScope,
    CreateNetworkInsightsPath,
    CreateNetworkInterface,
    CreateNetworkInterfacePermission,
    CancelConversionTask,
    CancelDeclarativePoliciesReport,
    CancelExportTask,
    CancelImageLaunchPermission,
    CancelImportTask,
    CancelReservedInstancesListing,
    CancelSpotFleetRequests,
    CancelSpotInstanceRequests,
    ConfirmProductInstance,
    CopyFpgaImage,
    CopyImage,
    CopySnapshot,
    CopyVolumes,
    CreateDelegateMacVolumeOwnershipTask,
    CreateDhcpOptions,
    CreateEgressOnlyInternetGateway,
    CreateFleet,
    CreateFlowLogs,
    CreateFpgaImage,
    CreateImage,
    CreateImageUsageReport,
    CreateInstanceConnectEndpoint,
    CreateInstanceEventWindow,
    CreateInstanceExportTask,
    CreateInterruptibleCapacityReservationAllocation,
    CreatePlacementGroup,
    CreatePublicIpv4Pool,
    CreateReplaceRootVolumeTask,
    CreateReservedInstancesListing,
    CreateRestoreImageTask,
    CreateRoute,
    CreateRouteServer,
    CreateRouteServerEndpoint,
    CreateRouteServerPeer,
    CreateSecondaryNetwork,
    CreateSecondarySubnet,
    CreateSnapshots,
    CreateSpotDatafeedSubscription,
    CreateStoreImageTask,
    CreateSubnetCidrReservation,
    CreateTrafficMirrorFilter,
    CreateTrafficMirrorFilterRule,
    CreateTrafficMirrorSession,
    CreateTrafficMirrorTarget,
    CreateTransitGateway,
    CreateTransitGatewayConnect,
    CreateTransitGatewayConnectPeer,
    CreateTransitGatewayMeteringPolicy,
    CreateTransitGatewayMeteringPolicyEntry,
    CreateTransitGatewayMulticastDomain,
    CreateTransitGatewayPeeringAttachment,
    CreateTransitGatewayPolicyTable,
    CreateTransitGatewayPrefixListReference,
    CreateTransitGatewayRoute,
    CreateTransitGatewayRouteTable,
    CreateTransitGatewayRouteTableAnnouncement,
    CreateTransitGatewayVpcAttachment,
    CreateVerifiedAccessEndpoint,
    CreateVerifiedAccessGroup,
    CreateVerifiedAccessInstance,
    CreateVerifiedAccessTrustProvider,
    CreateVpcBlockPublicAccessExclusion,
    CreateVpcEncryptionControl,
    CreateVpcEndpoint,
    CreateVpcEndpointConnectionNotification,
    CreateVpcEndpointServiceConfiguration,
    CreateVpcPeeringConnection,
    CreateVpnConcentrator,
    CreateVpnConnection,
    CreateVpnConnectionRoute,
    CreateVpnGateway,
    DeleteCapacityManagerDataExport,
    DeleteCarrierGateway,
    DeleteClientVpnEndpoint,
    DeleteClientVpnRoute,
    DeleteCoipCidr,
    DeleteCoipPool,
    DeleteCustomerGateway,
    DeleteDhcpOptions,
    DeleteEgressOnlyInternetGateway,
    DeleteFleets,
    DeleteFlowLogs,
    DeleteFpgaImage,
    DeleteImageUsageReport,
    DeleteInstanceConnectEndpoint,
    DeleteInstanceEventWindow,
    DeleteInternetGateway,
    DeleteIpam,
    DeleteIpamExternalResourceVerificationToken,
    DeleteIpamPolicy,
    DeleteIpamPool,
    DeleteIpamPrefixListResolver,
    DeleteIpamPrefixListResolverTarget,
    DeleteIpamResourceDiscovery,
    DeleteIpamScope,
    DeleteKeyPair,
    DeleteLaunchTemplate,
    DeleteLaunchTemplateVersions,
    DeleteLocalGatewayRoute,
    DeleteLocalGatewayRouteTable,
    DeleteLocalGatewayRouteTableVirtualInterfaceGroupAssociation,
    DeleteLocalGatewayRouteTableVpcAssociation,
    DeleteLocalGatewayVirtualInterface,
    DeleteLocalGatewayVirtualInterfaceGroup,
    DeleteManagedPrefixList,
    DeleteNetworkAcl,
    DeleteNetworkAclEntry,
    DeleteNetworkInsightsAccessScope,
    DeleteNetworkInsightsAccessScopeAnalysis,
    DeleteNetworkInsightsAnalysis,
    DeleteNetworkInsightsPath,
    DeleteNetworkInterface,
    DeleteNetworkInterfacePermission,
    DeletePlacementGroup,
    DeletePublicIpv4Pool,
    DeleteQueuedReservedInstances,
    DeleteRoute,
    DeleteRouteServer,
    DeleteRouteServerEndpoint,
    DeleteRouteServerPeer,
    DeleteRouteTable,
    DeleteSecondaryNetwork,
    DeleteSecondarySubnet,
    DeleteSecurityGroup,
    DeleteSpotDatafeedSubscription,
    DeleteSubnetCidrReservation,
    DeleteTags,
    DeleteTrafficMirrorFilter,
    DeleteTrafficMirrorFilterRule,
    DeleteTrafficMirrorSession,
    DeleteTrafficMirrorTarget,
    DeleteTransitGateway,
    DeleteTransitGatewayClientVpnAttachment,
    DeleteTransitGatewayConnect,
    DeleteTransitGatewayConnectPeer,
    DeleteTransitGatewayMeteringPolicy,
    DeleteTransitGatewayMeteringPolicyEntry,
    DeleteTransitGatewayMulticastDomain,
    DeleteTransitGatewayPeeringAttachment,
    DeleteTransitGatewayPolicyTable,
    DeleteTransitGatewayPrefixListReference,
    DeleteTransitGatewayRoute,
    DeleteTransitGatewayRouteTable,
    DeleteTransitGatewayRouteTableAnnouncement,
    DeleteTransitGatewayVpcAttachment,
    DeleteVerifiedAccessEndpoint,
    DeleteVerifiedAccessGroup,
    DeleteVerifiedAccessInstance,
    DeleteVerifiedAccessTrustProvider,
    DeleteVpcBlockPublicAccessExclusion,
    DeleteVpcEncryptionControl,
    DeleteVpcEndpointConnectionNotifications,
    DeleteVpcEndpointServiceConfigurations,
    DeleteVpcEndpoints,
    DeleteVpcPeeringConnection,
    DeleteVpnConcentrator,
    DeleteVpnConnection,
    DeleteVpnConnectionRoute,
    DeleteVpnGateway,
    DeprovisionByoipCidr,
    DeprovisionIpamByoasn,
    DeprovisionIpamPoolCidr,
    DeprovisionPublicIpv4PoolCidr,
    DeregisterImage,
    DeregisterInstanceEventNotificationAttributes,
    DeregisterTransitGatewayMulticastGroupMembers,
    DeregisterTransitGatewayMulticastGroupSources,
    DescribeAddressTransfers,
    DescribeAddressesAttribute,
    DescribeAggregateIdFormat,
    DescribeAwsNetworkPerformanceMetricSubscriptions,
    DescribeBundleTasks,
    DescribeByoipCidrs,
    DescribeCapacityBlockExtensionHistory,
    DescribeCapacityBlockExtensionOfferings,
    DescribeCapacityBlockOfferings,
    DescribeCapacityBlockStatus,
    DescribeCapacityBlocks,
    DescribeCapacityManagerDataExports,
    DescribeAccountAttributes,
    DescribeCapacityReservationBillingRequests,
    DescribeCapacityReservationFleets,
    DescribeCapacityReservationTopology,
    DescribeCapacityReservations,
    DescribeCarrierGateways,
    DescribeClassicLinkInstances,
    DescribeClientVpnAuthorizationRules,
    DescribeClientVpnConnections,
    DescribeClientVpnEndpoints,
    DescribeClientVpnRoutes,
    DescribeClientVpnTargetNetworks,
    DescribeCoipPools,
    DescribeConversionTasks,
    DescribeCustomerGateways,
    DescribeDeclarativePoliciesReports,
    DescribeDhcpOptions,
    DescribeEgressOnlyInternetGateways,
    DescribeElasticGpus,
    DescribeExportImageTasks,
    DescribeExportTasks,
    DescribeFastLaunchImages,
    DescribeFastSnapshotRestores,
    DescribeFleetHistory,
    DescribeFleetInstances,
    DescribeFleets,
    DescribeFlowLogs,
    DescribeFpgaImageAttribute,
    DescribeFpgaImages,
    DescribeHostReservationOfferings,
    DescribeHostReservations,
    DescribeHosts,
    DescribeIamInstanceProfileAssociations,
    DescribeIdFormat,
    DescribeIdentityIdFormat,
    DescribeImageAttribute,
    DescribeImageReferences,
    DescribeImageUsageReportEntries,
    DescribeImageUsageReports,
    DescribeImages,
    DescribeImportImageTasks,
    DescribeImportSnapshotTasks,
    DescribeInstanceAttribute,
    DescribeInstanceConnectEndpoints,
    DescribeInstanceCreditSpecifications,
    DescribeInstanceEventNotificationAttributes,
    DescribeInstanceEventWindows,
    DescribeInstanceImageMetadata,
    DescribeInstanceSqlHaHistoryStates,
    DescribeInstanceSqlHaStates,
    DescribeInstanceStatus,
    DescribeInstanceTopology,
    DescribeInstanceTypeOfferings,
    DescribeInstanceTypes,
    DescribeIpamByoasn,
    DescribeIpamExternalResourceVerificationTokens,
    DescribeIpamPolicies,
    DescribeIpamPoolAllocations,
    DescribeIpamPools,
    DescribeIpamPrefixListResolverTargets,
    DescribeIpamPrefixListResolvers,
    DescribeIpamResourceDiscoveries,
    DescribeIpamResourceDiscoveryAssociations,
    DescribeIpamScopes,
    DescribeIpams,
    DescribeIpv6Pools,
    DescribeLaunchTemplates,
    DescribeLaunchTemplateVersions,
    DescribeLocalGatewayRouteTableVirtualInterfaceGroupAssociations,
    DescribeLocalGatewayRouteTableVpcAssociations,
    DescribeLocalGatewayRouteTables,
    DescribeLocalGatewayVirtualInterfaceGroups,
    DescribeLocalGatewayVirtualInterfaces,
    DescribeLocalGateways,
    DescribeLockedSnapshots,
    DescribeMacHosts,
    DescribeMacModificationTasks,
    DescribeManagedPrefixLists,
    DescribeMovingAddresses,
    DescribeNetworkAcls,
    DescribeNetworkInsightsAccessScopeAnalyses,
    DescribeNetworkInsightsAccessScopes,
    DescribeNetworkInsightsAnalyses,
    DescribeNetworkInsightsPaths,
    DescribeNetworkInterfaceAttribute,
    DescribeNetworkInterfacePermissions,
    DescribeNetworkInterfaces,
    DescribeOutpostLags,
    DescribePlacementGroups,
    DescribePrefixLists,
    DescribePrincipalIdFormat,
    DescribePublicIpv4Pools,
    DescribeRegions,
    DescribeReplaceRootVolumeTasks,
    DescribeReservedInstances,
    DescribeReservedInstancesListings,
    DescribeReservedInstancesModifications,
    DescribeReservedInstancesOfferings,
    DescribeRouteServerEndpoints,
    DescribeRouteServerPeers,
    DescribeRouteServers,
    DescribeScheduledInstanceAvailability,
    DescribeScheduledInstances,
    DescribeSecondaryInterfaces,
    DescribeSecondaryNetworks,
    DescribeSecondarySubnets,
    DescribeSecurityGroupReferences,
    DescribeSecurityGroupRules,
    DescribeSecurityGroupVpcAssociations,
    RequestSpotInstances,
    RequestSpotFleet,
    DescribeServiceLinkVirtualInterfaces,
    DescribeSnapshotAttribute,
    DescribeSnapshotTierStatus,
    DescribeSpotDatafeedSubscription,
    DescribeSpotFleetInstances,
    DescribeSpotFleetRequestHistory,
    DescribeSpotFleetRequests,
    DescribeSpotInstanceRequests,
    DescribeSpotPriceHistory,
    DescribeStaleSecurityGroups,
    DescribeStoreImageTasks,
    DescribeTrafficMirrorFilterRules,
    DescribeTrafficMirrorFilters,
    DescribeTrafficMirrorSessions,
    DescribeTrafficMirrorTargets,
    DescribeTransitGatewayAttachments,
    DescribeTransitGatewayConnectPeers,
    DescribeTransitGatewayConnects,
    DescribeTransitGatewayMeteringPolicies,
    DescribeTransitGatewayMulticastDomains,
    DescribeTransitGatewayPeeringAttachments,
    DescribeTransitGatewayPolicyTables,
    DescribeTransitGatewayRouteTableAnnouncements,
    DescribeTransitGatewayRouteTables,
    DescribeTransitGatewayVpcAttachments,
    DescribeTransitGateways,
    DescribeTrunkInterfaceAssociations,
    DescribeVerifiedAccessEndpoints,
    DescribeVerifiedAccessGroups,
    DescribeVerifiedAccessInstanceLoggingConfigurations,
    DescribeVerifiedAccessInstances,
    DescribeVerifiedAccessTrustProviders,
    DescribeVolumeAttribute,
    DescribeVolumeStatus,
    DescribeVolumesModifications,
    DescribeVpcAttribute,
    DescribeVpcBlockPublicAccessExclusions,
    DescribeVpcBlockPublicAccessOptions,
    DescribeVpcClassicLink,
    DescribeVpcClassicLinkDnsSupport,
    DescribeVpcEncryptionControls,
    DescribeVpcEndpointAssociations,
    DescribeVpcEndpointConnectionNotifications,
    DescribeVpcEndpointConnections,
    DescribeVpcEndpointServiceConfigurations,
    DescribeVpcEndpointServicePermissions,
    DescribeVpcEndpointServices,
    DescribeVpcEndpoints,
    DescribeVpcPeeringConnections,
    DescribeVpnConcentrators,
    DescribeVpnConnections,
    DescribeVpnGateways,
    DisableAddressTransfer,
    DisableAllowedImagesSettings,
    DisableAwsNetworkPerformanceMetricSubscription,
    DisableCapacityManager,
    DisableEbsEncryptionByDefault,
    DisableFastLaunch,
    DisableFastSnapshotRestores,
    DisableImage,
    DisableImageBlockPublicAccess,
    DisableImageDeprecation,
    DisableImageDeregistrationProtection,
    DisableInstanceSqlHaStandbyDetections,
    DisableIpamOrganizationAdminAccount,
    DisableIpamPolicy,
    DisableRouteServerPropagation,
    DisableSerialConsoleAccess,
    DisableSnapshotBlockPublicAccess,
    DisableTransitGatewayRouteTablePropagation,
    DisableVgwRoutePropagation,
    DisableVpcClassicLink,
    DisableVpcClassicLinkDnsSupport,
    DisassociateAddress,
    DisassociateCapacityReservationBillingOwner,
    DisassociateClientVpnTargetNetwork,
    DisassociateEnclaveCertificateIamRole,
    DisassociateIamInstanceProfile,
    DisassociateInstanceEventWindow,
    DisassociateIpamByoasn,
    DisassociateIpamResourceDiscovery,
    DisassociateNatGatewayAddress,
    DisassociateRouteServer,
    DisassociateRouteTable,
    DisassociateSecurityGroupVpc,
    DisassociateSubnetCidrBlock,
    DisassociateTransitGatewayMulticastDomain,
    DisassociateTransitGatewayPolicyTable,
    DisassociateTransitGatewayRouteTable,
    DisassociateTrunkInterface,
    DisassociateVpcCidrBlock,
    EnableAddressTransfer,
    EnableAllowedImagesSettings,
    GetAllowedImagesSettings,
    EnableAwsNetworkPerformanceMetricSubscription,
    EnableCapacityManager,
    EnableEbsEncryptionByDefault,
    GetEbsEncryptionByDefault,
    EnableFastLaunch,
    EnableFastSnapshotRestores,
    EnableImage,
    EnableImageBlockPublicAccess,
    GetImageBlockPublicAccessState,
    EnableImageDeprecation,
    EnableImageDeregistrationProtection,
    EnableInstanceSqlHaStandbyDetections,
    EnableIpamOrganizationAdminAccount,
    EnableIpamPolicy,
    EnableReachabilityAnalyzerOrganizationSharing,
    EnableRouteServerPropagation,
    EnableSerialConsoleAccess,
    GetSerialConsoleAccessStatus,
    EnableSnapshotBlockPublicAccess,
    GetSnapshotBlockPublicAccessState,
    EnableTransitGatewayRouteTablePropagation,
    EnableVgwRoutePropagation,
    EnableVolumeIO,
    EnableVpcClassicLink,
    EnableVpcClassicLinkDnsSupport,
    ExportClientVpnClientCertificateRevocationList,
    ExportClientVpnClientConfiguration,
    ExportImage,
    ExportTransitGatewayRoutes,
    ExportVerifiedAccessInstanceClientConfiguration,
    GetActiveVpnTunnelStatus,
    GetAssociatedEnclaveCertificateIamRoles,
    GetAssociatedIpv6PoolCidrs,
    GetAwsNetworkPerformanceData,
    GetCapacityManagerAttributes,
    GetCapacityManagerMetricData,
    GetCapacityManagerMetricDimensions,
    GetCapacityManagerMonitoredTagKeys,
    GetCapacityReservationUsage,
    GetCoipPoolUsage,
    GetConsoleOutput,
    GetConsoleScreenshot,
    GetDeclarativePoliciesReportSummary,
    ModifyDefaultCreditSpecification,
    GetDefaultCreditSpecification,
    ModifyEbsDefaultKmsKeyId,
    ResetEbsDefaultKmsKeyId,
    GetEbsDefaultKmsKeyId,
    GetEnabledIpamPolicy,
    GetFlowLogsIntegrationTemplate,
    GetGroupsForCapacityReservation,
    GetHostReservationPurchasePreview,
    GetImageAncestry,
    ModifyInstanceMetadataDefaults,
    GetInstanceMetadataDefaults,
    GetInstanceTpmEkPub,
    GetInstanceTypesFromInstanceRequirements,
    GetInstanceUefiData,
    GetIpamAddressHistory,
    GetIpamDiscoveredAccounts,
    GetIpamDiscoveredPublicAddresses,
    GetIpamDiscoveredResourceCidrs,
    GetIpamPolicyAllocationRules,
    GetIpamPolicyOrganizationTargets,
    GetIpamPoolAllocations,
    GetIpamPoolCidrs,
    GetIpamPrefixListResolverRules,
    GetIpamPrefixListResolverVersionEntries,
    GetIpamPrefixListResolverVersions,
    GetIpamResourceCidrs,
    GetLaunchTemplateData,
    GetManagedPrefixListAssociations,
    GetManagedPrefixListEntries,
    GetManagedResourceVisibility,
    GetNetworkInsightsAccessScopeAnalysisFindings,
    GetNetworkInsightsAccessScopeContent,
    GetPasswordData,
    GetReservedInstancesExchangeQuote,
    GetRouteServerAssociations,
    GetRouteServerPropagations,
    GetRouteServerRoutingDatabase,
    GetSecurityGroupsForVpc,
    GetSpotPlacementScores,
    GetSubnetCidrReservations,
    GetTransitGatewayAttachmentPropagations,
    GetTransitGatewayMeteringPolicyEntries,
    GetTransitGatewayMulticastDomainAssociations,
    GetTransitGatewayPolicyTableAssociations,
    GetTransitGatewayPolicyTableEntries,
    GetTransitGatewayPrefixListReferences,
    GetTransitGatewayRouteTableAssociations,
    GetTransitGatewayRouteTablePropagations,
    GetVerifiedAccessEndpointPolicy,
    GetVerifiedAccessEndpointTargets,
    GetVerifiedAccessGroupPolicy,
    GetVpcResourcesBlockingEncryptionEnforcement,
    GetVpnConnectionDeviceSampleConfiguration,
    GetVpnConnectionDeviceTypes,
    GetVpnTunnelReplacementStatus,
    ImportClientVpnClientCertificateRevocationList,
    ImportImage,
    ImportInstance,
    ImportKeyPair,
    ImportSnapshot,
    ImportVolume,
    ListImagesInRecycleBin,
    ListSnapshotsInRecycleBin,
    ListVolumesInRecycleBin,
    LockSnapshot,
    ModifyAddressAttribute,
    ModifyAvailabilityZoneGroup,
    ModifyCapacityReservation,
    ModifyCapacityReservationFleet,
    ModifyClientVpnEndpoint,
    ModifyFleet,
    ModifyFpgaImageAttribute,
    ModifyHosts,
    ModifyIdFormat,
    ModifyIdentityIdFormat,
    ModifyImageAttribute,
    ModifyInstanceAttribute,
    ModifyInstanceCapacityReservationAttributes,
    ModifyInstanceConnectEndpoint,
    ModifyInstanceCpuOptions,
    ModifyInstanceCreditSpecification,
    ModifyInstanceEventStartTime,
    ModifyInstanceEventWindow,
    ModifyInstanceMaintenanceOptions,
    ModifyInstanceMetadataOptions,
    ModifyInstanceNetworkPerformanceOptions,
    ModifyInstancePlacement,
    ModifyIpam,
    ModifyIpamPolicyAllocationRules,
    ModifyIpamPool,
    ModifyIpamPoolAllocation,
    ModifyIpamPrefixListResolver,
    ModifyIpamPrefixListResolverTarget,
    ModifyIpamResourceCidr,
    ModifyIpamResourceDiscovery,
    ModifyIpamScope,
    ModifyLaunchTemplate,
    ModifyLocalGatewayRoute,
    ModifyManagedPrefixList,
    ModifyManagedResourceVisibility,
    ModifyNetworkInterfaceAttribute,
    ModifyPrivateDnsNameOptions,
    ModifyPublicIpDnsNameOptions,
    ModifyReservedInstances,
    ModifyRouteServer,
    ModifySecurityGroupRules,
    ModifySnapshotAttribute,
    ModifySnapshotTier,
    ModifySpotFleetRequest,
    ModifySubnetAttribute,
    ModifyTrafficMirrorFilterNetworkServices,
    ModifyTrafficMirrorFilterRule,
    ModifyTrafficMirrorSession,
    ModifyTransitGateway,
    ModifyTransitGatewayMeteringPolicy,
    ModifyTransitGatewayPrefixListReference,
    ModifyTransitGatewayVpcAttachment,
    ModifyVerifiedAccessEndpoint,
    ModifyVerifiedAccessEndpointPolicy,
    ModifyVerifiedAccessGroup,
    ModifyVerifiedAccessGroupPolicy,
    ModifyVerifiedAccessInstance,
    ModifyVerifiedAccessInstanceLoggingConfiguration,
    ModifyVerifiedAccessTrustProvider,
    ModifyVolume,
    ModifyVolumeAttribute,
    ModifyVpcAttribute,
    ModifyVpcBlockPublicAccessExclusion,
    ModifyVpcBlockPublicAccessOptions,
    ModifyVpcEncryptionControl,
    ModifyVpcEndpoint,
    ModifyVpcEndpointConnectionNotification,
    ModifyVpcEndpointServiceConfiguration,
    ModifyVpcEndpointServicePayerResponsibility,
    ModifyVpcEndpointServicePermissions,
    ModifyVpcPeeringConnectionOptions,
    ModifyVpcTenancy,
    ModifyVpnConnection,
    ModifyVpnConnectionOptions,
    ModifyVpnTunnelCertificate,
    ModifyVpnTunnelOptions,
    MonitorInstances,
    MoveAddressToVpc,
    MoveByoipCidrToIpam,
    MoveCapacityReservationInstances,
    ProvisionByoipCidr,
    ProvisionIpamByoasn,
    ProvisionIpamPoolCidr,
  },
  model,
} as const;

export default ec2;
