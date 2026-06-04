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
  TrustProviderIds: string[];
  CreationTime: string;
  LastUpdatedTime: string;
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
  Associations: [],
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
      TrustProviderIds: [],
      CreationTime: new Date().toISOString(),
      LastUpdatedTime: new Date().toISOString(),
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

const CreateCapacityManagerDataExport: OperationHandler = (_input, _ctx) => {
  return { CapacityManagerDataExportId: hexId("cmde") };
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
  },
  model,
} as const;

export default ec2;
