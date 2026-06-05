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
  Tags: Tag[];
};

type StoredHost = {
  HostId: string;
  AvailabilityZone: string;
  InstanceType: string | undefined;
  InstanceFamily: string | undefined;
  AutoPlacement: string;
  HostRecovery: string;
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
};

type StoredVerifiedAccessTrustProvider = {
  VerifiedAccessTrustProviderId: string;
  TrustProviderType: string;
  PolicyReferenceName: string;
  CreationTime: string;
  LastUpdatedTime: string;
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
  const createdBy = `arn:aws:iam::${ctx.account}:root`;
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
  const createdBy = `arn:aws:iam::${ctx.account}:root`;
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
    result["CidrBlockAssociation"] = {
      AssociationId: assocId,
      CidrBlock: cidrBlock,
      CidrBlockState: { State: "associated", StatusMessage: "" },
    };
  } else {
    result["Ipv6CidrBlockAssociation"] = {
      AssociationId: assocId,
      Ipv6CidrBlock: ipv6CidrBlock ?? "::/0",
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
  },
  model,
} as const;

export default ec2;
