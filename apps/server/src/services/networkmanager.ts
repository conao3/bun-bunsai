import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import networkmanagerModel from "../../../../test/vendor/aws-models/networkmanager.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(networkmanagerModel);

type TagEntry = { Key: string | undefined; Value: string | undefined };

type StoredGlobalNetwork = {
  GlobalNetworkId: string;
  GlobalNetworkArn: string;
  Description: string | undefined;
  CreatedAt: number;
  State: string;
  Tags: TagEntry[];
};

type StoredSite = {
  SiteId: string;
  SiteArn: string;
  GlobalNetworkId: string;
  Description: string | undefined;
  Location: Record<string, unknown> | undefined;
  CreatedAt: number;
  State: string;
  Tags: TagEntry[];
};

type StoredDevice = {
  DeviceId: string;
  DeviceArn: string;
  GlobalNetworkId: string;
  AWSLocation: Record<string, unknown> | undefined;
  Description: string | undefined;
  Type: string | undefined;
  Vendor: string | undefined;
  Model: string | undefined;
  SerialNumber: string | undefined;
  Location: Record<string, unknown> | undefined;
  SiteId: string | undefined;
  CreatedAt: number;
  State: string;
  Tags: TagEntry[];
};

type StoredLink = {
  LinkId: string;
  LinkArn: string;
  GlobalNetworkId: string;
  SiteId: string;
  Description: string | undefined;
  Type: string | undefined;
  Bandwidth: Record<string, unknown> | undefined;
  Provider: string | undefined;
  CreatedAt: number;
  State: string;
  Tags: TagEntry[];
};

type StoredConnection = {
  ConnectionId: string;
  ConnectionArn: string;
  GlobalNetworkId: string;
  DeviceId: string;
  ConnectedDeviceId: string;
  LinkId: string | undefined;
  ConnectedLinkId: string | undefined;
  Description: string | undefined;
  CreatedAt: number;
  State: string;
  Tags: TagEntry[];
};

type StoredCoreNetwork = {
  GlobalNetworkId: string;
  CoreNetworkId: string;
  CoreNetworkArn: string;
  Description: string | undefined;
  CreatedAt: number;
  State: string;
  Segments: unknown[];
  NetworkFunctionGroups: unknown[];
  Edges: unknown[];
  Tags: TagEntry[];
  OwnerAccountId: string;
  PolicyVersionCounter: number;
};

type StoredCoreNetworkPolicy = {
  CoreNetworkId: string;
  PolicyVersionId: number;
  Alias: string;
  Description: string | undefined;
  CreatedAt: number;
  ChangeSetState: string;
  PolicyErrors: unknown[];
  PolicyDocument: string | undefined;
};

type StoredCoreNetworkPrefixListAssociation = {
  CoreNetworkId: string;
  PrefixListArn: string;
  PrefixListAlias: string | undefined;
};

type AttachmentBase = {
  CoreNetworkId: string | undefined;
  CoreNetworkArn: string | undefined;
  AttachmentId: string;
  OwnerAccountId: string;
  AttachmentType: string;
  State: string;
  EdgeLocation: string | undefined;
  EdgeLocations: string[];
  ResourceArn: string | undefined;
  AttachmentPolicyRuleNumber: number | undefined;
  SegmentName: string | undefined;
  NetworkFunctionGroupName: string | undefined;
  Tags: TagEntry[];
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredVpcAttachment = AttachmentBase & {
  SubnetArns: string[];
  Options: Record<string, unknown> | undefined;
};

type StoredConnectAttachment = AttachmentBase & {
  TransportAttachmentId: string | undefined;
  Options: Record<string, unknown> | undefined;
};

type StoredSiteToSiteVpnAttachment = AttachmentBase & {
  VpnConnectionArn: string | undefined;
};

type StoredTransitGatewayRouteTableAttachment = AttachmentBase & {
  PeeringId: string | undefined;
  TransitGatewayRouteTableArn: string | undefined;
};

type StoredDirectConnectGatewayAttachment = AttachmentBase & {
  DirectConnectGatewayArn: string | undefined;
};

type StoredConnectPeer = {
  CoreNetworkId: string | undefined;
  ConnectAttachmentId: string | undefined;
  ConnectPeerId: string;
  EdgeLocation: string | undefined;
  State: string;
  CreatedAt: number;
  Configuration: Record<string, unknown> | undefined;
  Tags: TagEntry[];
  SubnetArn: string | undefined;
};

type StoredPeering = {
  CoreNetworkId: string | undefined;
  CoreNetworkArn: string | undefined;
  PeeringId: string;
  OwnerAccountId: string;
  PeeringType: string;
  State: string;
  EdgeLocation: string | undefined;
  ResourceArn: string | undefined;
  Tags: TagEntry[];
  CreatedAt: number;
  TransitGatewayArn: string | undefined;
  TransitGatewayPeeringAttachmentId: string | undefined;
};

type StoredTransitGatewayRegistration = {
  GlobalNetworkId: string;
  TransitGatewayArn: string;
  State: { Code: string; Message: string | undefined };
};

type StoredCustomerGatewayAssociation = {
  CustomerGatewayArn: string;
  GlobalNetworkId: string;
  DeviceId: string;
  LinkId: string | undefined;
  State: string;
};

type StoredLinkAssociation = {
  GlobalNetworkId: string;
  DeviceId: string;
  LinkId: string;
  LinkAssociationState: string;
};

type StoredConnectPeerAssociation = {
  ConnectPeerId: string;
  GlobalNetworkId: string;
  DeviceId: string;
  LinkId: string | undefined;
  State: string;
};

type StoredTransitGatewayConnectPeerAssociation = {
  TransitGatewayConnectPeerArn: string;
  GlobalNetworkId: string;
  DeviceId: string;
  LinkId: string | undefined;
  State: string;
};

type StoredRouteAnalysis = {
  GlobalNetworkId: string;
  OwnerAccountId: string;
  RouteAnalysisId: string;
  StartTimestamp: number;
  Status: string;
  Source: Record<string, unknown> | undefined;
  Destination: Record<string, unknown> | undefined;
  IncludeReturnPath: boolean;
  UseMiddleboxes: boolean;
};

type StoredRoutingPolicyLabel = {
  CoreNetworkId: string;
  AttachmentId: string;
  RoutingPolicyLabel: string | undefined;
};

const globalNetworkKey = (id: string): string => `global-network/${id}`;
const siteKey = (gid: string, sid: string): string => `site/${gid}/${sid}`;
const deviceKey = (gid: string, did: string): string => `device/${gid}/${did}`;
const linkKey = (gid: string, lid: string): string => `link/${gid}/${lid}`;
const connectionKey = (gid: string, cid: string): string =>
  `connection/${gid}/${cid}`;
const coreNetworkKey = (id: string): string => `core-network/${id}`;
const coreNetworkPolicyKey = (cnId: string, ver: number): string =>
  `cnpolicy/${cnId}/${ver}`;
const coreNetworkPolicyCurrentKey = (cnId: string): string =>
  `cnpolicy-current/${cnId}`;
const coreNetworkPrefixListKey = (cnId: string, plArn: string): string =>
  `prefix-list/${cnId}/${plArn}`;
const attachmentKey = (id: string): string => `attachment/${id}`;
const connectPeerKey = (id: string): string => `connect-peer/${id}`;
const peeringKey = (id: string): string => `peering/${id}`;
const tgwRegistrationKey = (gid: string, arn: string): string =>
  `tgw-reg/${gid}/${arn}`;
const customerGwAssocKey = (gid: string, arn: string): string =>
  `cgw-assoc/${gid}/${arn}`;
const linkAssocKey = (gid: string, devId: string, lid: string): string =>
  `link-assoc/${gid}/${devId}/${lid}`;
const connectPeerAssocKey = (gid: string, cpId: string): string =>
  `cp-assoc/${gid}/${cpId}`;
const tgwConnectPeerAssocKey = (gid: string, arn: string): string =>
  `tgwcp-assoc/${gid}/${arn}`;
const routeAnalysisKey = (gid: string, raId: string): string =>
  `ra/${gid}/${raId}`;
const resourcePolicyKey = (arn: string): string => `resource-policy/${arn}`;
const tagsKey = (arn: string): string => `tags/${arn}`;
const routingPolicyLabelKey = (cnId: string, attId: string): string =>
  `routing-label/${cnId}/${attId}`;

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const tagListFrom = (value: unknown): TagEntry[] => {
  if (!Array.isArray(value)) return [];
  const out: TagEntry[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (record === undefined) continue;
    out.push({
      Key: stringOrUndefined(record["Key"]),
      Value: stringOrUndefined(record["Value"]),
    });
  }
  return out;
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const v = input[key];
  if (typeof v !== "string" || v === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return v;
};

const nowSec = (): number => Math.floor(Date.now() / 1000);

const shortId = (): string =>
  crypto.randomUUID().replace(/-/g, "").slice(0, 17);

const globalNetworkArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:networkmanager::${ctx.account}:global-network/${id}`;

const coreNetworkArnOf = (ctx: ServiceContext, id: string): string =>
  `arn:aws:networkmanager::${ctx.account}:core-network/${id}`;

const globalNetworkView = (
  network: StoredGlobalNetwork,
): Record<string, unknown> => ({
  GlobalNetworkId: network.GlobalNetworkId,
  GlobalNetworkArn: network.GlobalNetworkArn,
  Description: network.Description,
  CreatedAt: network.CreatedAt,
  State: network.State,
  Tags: network.Tags,
});

const requireGlobalNetwork = (
  ctx: ServiceContext,
  id: string,
): StoredGlobalNetwork => {
  const stored = ctx.store.get<StoredGlobalNetwork>(globalNetworkKey(id));
  if (stored === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Global network not found: ${id}.`,
      404,
    );
  }
  return stored;
};

const siteArnOf = (ctx: ServiceContext, gid: string, sid: string): string =>
  `arn:aws:networkmanager::${ctx.account}:site/${gid}/${sid}`;

const siteView = (s: StoredSite): Record<string, unknown> => ({
  SiteId: s.SiteId,
  SiteArn: s.SiteArn,
  GlobalNetworkId: s.GlobalNetworkId,
  Description: s.Description,
  Location: s.Location,
  CreatedAt: s.CreatedAt,
  State: s.State,
  Tags: s.Tags,
});

const requireSite = (
  ctx: ServiceContext,
  gid: string,
  sid: string,
): StoredSite => {
  const s = ctx.store.get<StoredSite>(siteKey(gid, sid));
  if (s === undefined) {
    throw awsError("ResourceNotFoundException", `Site not found: ${sid}.`, 404);
  }
  return s;
};

const deviceArnOf = (ctx: ServiceContext, gid: string, did: string): string =>
  `arn:aws:networkmanager::${ctx.account}:device/${gid}/${did}`;

const deviceView = (d: StoredDevice): Record<string, unknown> => ({
  DeviceId: d.DeviceId,
  DeviceArn: d.DeviceArn,
  GlobalNetworkId: d.GlobalNetworkId,
  AWSLocation: d.AWSLocation,
  Description: d.Description,
  Type: d.Type,
  Vendor: d.Vendor,
  Model: d.Model,
  SerialNumber: d.SerialNumber,
  Location: d.Location,
  SiteId: d.SiteId,
  CreatedAt: d.CreatedAt,
  State: d.State,
  Tags: d.Tags,
});

const requireDevice = (
  ctx: ServiceContext,
  gid: string,
  did: string,
): StoredDevice => {
  const d = ctx.store.get<StoredDevice>(deviceKey(gid, did));
  if (d === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Device not found: ${did}.`,
      404,
    );
  }
  return d;
};

const linkArnOf = (ctx: ServiceContext, gid: string, lid: string): string =>
  `arn:aws:networkmanager::${ctx.account}:link/${gid}/${lid}`;

const linkView = (l: StoredLink): Record<string, unknown> => ({
  LinkId: l.LinkId,
  LinkArn: l.LinkArn,
  GlobalNetworkId: l.GlobalNetworkId,
  SiteId: l.SiteId,
  Description: l.Description,
  Type: l.Type,
  Bandwidth: l.Bandwidth,
  Provider: l.Provider,
  CreatedAt: l.CreatedAt,
  State: l.State,
  Tags: l.Tags,
});

const requireLink = (
  ctx: ServiceContext,
  gid: string,
  lid: string,
): StoredLink => {
  const l = ctx.store.get<StoredLink>(linkKey(gid, lid));
  if (l === undefined) {
    throw awsError("ResourceNotFoundException", `Link not found: ${lid}.`, 404);
  }
  return l;
};

const connectionArnOf = (
  ctx: ServiceContext,
  gid: string,
  cid: string,
): string => `arn:aws:networkmanager::${ctx.account}:connection/${gid}/${cid}`;

const connectionView = (c: StoredConnection): Record<string, unknown> => ({
  ConnectionId: c.ConnectionId,
  ConnectionArn: c.ConnectionArn,
  GlobalNetworkId: c.GlobalNetworkId,
  DeviceId: c.DeviceId,
  ConnectedDeviceId: c.ConnectedDeviceId,
  LinkId: c.LinkId,
  ConnectedLinkId: c.ConnectedLinkId,
  Description: c.Description,
  CreatedAt: c.CreatedAt,
  State: c.State,
  Tags: c.Tags,
});

const requireConnection = (
  ctx: ServiceContext,
  gid: string,
  cid: string,
): StoredConnection => {
  const c = ctx.store.get<StoredConnection>(connectionKey(gid, cid));
  if (c === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Connection not found: ${cid}.`,
      404,
    );
  }
  return c;
};

const coreNetworkView = (cn: StoredCoreNetwork): Record<string, unknown> => ({
  GlobalNetworkId: cn.GlobalNetworkId,
  CoreNetworkId: cn.CoreNetworkId,
  CoreNetworkArn: cn.CoreNetworkArn,
  Description: cn.Description,
  CreatedAt: cn.CreatedAt,
  State: cn.State,
  Segments: cn.Segments,
  NetworkFunctionGroups: cn.NetworkFunctionGroups,
  Edges: cn.Edges,
  Tags: cn.Tags,
});

const coreNetworkSummaryView = (
  cn: StoredCoreNetwork,
): Record<string, unknown> => ({
  CoreNetworkId: cn.CoreNetworkId,
  CoreNetworkArn: cn.CoreNetworkArn,
  GlobalNetworkId: cn.GlobalNetworkId,
  OwnerAccountId: cn.OwnerAccountId,
  State: cn.State,
  Description: cn.Description,
  Tags: cn.Tags,
});

const requireCoreNetwork = (
  ctx: ServiceContext,
  id: string,
): StoredCoreNetwork => {
  const cn = ctx.store.get<StoredCoreNetwork>(coreNetworkKey(id));
  if (cn === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Core network not found: ${id}.`,
      404,
    );
  }
  return cn;
};

const coreNetworkPolicyView = (
  p: StoredCoreNetworkPolicy,
): Record<string, unknown> => ({
  CoreNetworkId: p.CoreNetworkId,
  PolicyVersionId: p.PolicyVersionId,
  Alias: p.Alias,
  Description: p.Description,
  CreatedAt: p.CreatedAt,
  ChangeSetState: p.ChangeSetState,
  PolicyErrors: p.PolicyErrors,
  PolicyDocument: p.PolicyDocument,
});

const attachmentBaseView = (a: AttachmentBase): Record<string, unknown> => ({
  CoreNetworkId: a.CoreNetworkId,
  CoreNetworkArn: a.CoreNetworkArn,
  AttachmentId: a.AttachmentId,
  OwnerAccountId: a.OwnerAccountId,
  AttachmentType: a.AttachmentType,
  State: a.State,
  EdgeLocation: a.EdgeLocation,
  EdgeLocations: a.EdgeLocations,
  ResourceArn: a.ResourceArn,
  AttachmentPolicyRuleNumber: a.AttachmentPolicyRuleNumber,
  SegmentName: a.SegmentName,
  NetworkFunctionGroupName: a.NetworkFunctionGroupName,
  Tags: a.Tags,
  CreatedAt: a.CreatedAt,
  UpdatedAt: a.UpdatedAt,
  LastModificationErrors: [],
});

const requireAttachment = (ctx: ServiceContext, id: string): AttachmentBase => {
  const a = ctx.store.get<AttachmentBase>(attachmentKey(id));
  if (a === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Attachment not found: ${id}.`,
      404,
    );
  }
  return a;
};

const connectPeerView = (cp: StoredConnectPeer): Record<string, unknown> => ({
  CoreNetworkId: cp.CoreNetworkId,
  ConnectAttachmentId: cp.ConnectAttachmentId,
  ConnectPeerId: cp.ConnectPeerId,
  EdgeLocation: cp.EdgeLocation,
  State: cp.State,
  CreatedAt: cp.CreatedAt,
  Configuration: cp.Configuration,
  Tags: cp.Tags,
  SubnetArn: cp.SubnetArn,
  LastModificationErrors: [],
});

const connectPeerSummaryView = (
  cp: StoredConnectPeer,
): Record<string, unknown> => ({
  CoreNetworkId: cp.CoreNetworkId,
  ConnectAttachmentId: cp.ConnectAttachmentId,
  ConnectPeerId: cp.ConnectPeerId,
  EdgeLocation: cp.EdgeLocation,
  ConnectPeerState: cp.State,
  CreatedAt: cp.CreatedAt,
  Tags: cp.Tags,
  SubnetArn: cp.SubnetArn,
});

const requireConnectPeer = (
  ctx: ServiceContext,
  id: string,
): StoredConnectPeer => {
  const cp = ctx.store.get<StoredConnectPeer>(connectPeerKey(id));
  if (cp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Connect peer not found: ${id}.`,
      404,
    );
  }
  return cp;
};

const peeringView = (p: StoredPeering): Record<string, unknown> => ({
  CoreNetworkId: p.CoreNetworkId,
  CoreNetworkArn: p.CoreNetworkArn,
  PeeringId: p.PeeringId,
  OwnerAccountId: p.OwnerAccountId,
  PeeringType: p.PeeringType,
  State: p.State,
  EdgeLocation: p.EdgeLocation,
  ResourceArn: p.ResourceArn,
  Tags: p.Tags,
  CreatedAt: p.CreatedAt,
  LastModificationErrors: [],
});

const requirePeering = (ctx: ServiceContext, id: string): StoredPeering => {
  const p = ctx.store.get<StoredPeering>(peeringKey(id));
  if (p === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Peering not found: ${id}.`,
      404,
    );
  }
  return p;
};

const CreateGlobalNetwork: OperationHandler = (input, ctx) => {
  const id = `global-network-${shortId()}`;
  const network: StoredGlobalNetwork = {
    GlobalNetworkId: id,
    GlobalNetworkArn: globalNetworkArnOf(ctx, id),
    Description: stringOrUndefined(input["Description"]),
    CreatedAt: nowSec(),
    State: "AVAILABLE",
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(globalNetworkKey(id), network);
  return { GlobalNetwork: globalNetworkView(network) };
};

const DescribeGlobalNetworks: OperationHandler = (input, ctx) => {
  const requested = Array.isArray(input["GlobalNetworkIds"])
    ? input["GlobalNetworkIds"].filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const networks = ctx.store
    .list<StoredGlobalNetwork>()
    .filter((entry) => entry.key.startsWith("global-network/"))
    .map((entry) => entry.value)
    .filter(
      (network) =>
        requested.length === 0 || requested.includes(network.GlobalNetworkId),
    )
    .sort((a, b) => a.GlobalNetworkId.localeCompare(b.GlobalNetworkId));
  return { GlobalNetworks: networks.map(globalNetworkView) };
};

const DeleteGlobalNetwork: OperationHandler = (input, ctx) => {
  const id = stringOrUndefined(input["GlobalNetworkId"]);
  if (id === undefined) {
    throw awsError("ValidationException", "GlobalNetworkId is required.", 400);
  }
  const network = requireGlobalNetwork(ctx, id);
  ctx.store.delete(globalNetworkKey(id));
  return {
    GlobalNetwork: globalNetworkView({ ...network, State: "DELETING" }),
  };
};

const UpdateGlobalNetwork: OperationHandler = (input, ctx) => {
  const id = requireString(input, "GlobalNetworkId");
  const network = requireGlobalNetwork(ctx, id);
  const updated: StoredGlobalNetwork = {
    ...network,
    Description: stringOrUndefined(input["Description"]) ?? network.Description,
  };
  ctx.store.set(globalNetworkKey(id), updated);
  return { GlobalNetwork: globalNetworkView(updated) };
};

const CreateSite: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const sid = `site-${shortId()}`;
  const site: StoredSite = {
    SiteId: sid,
    SiteArn: siteArnOf(ctx, gid, sid),
    GlobalNetworkId: gid,
    Description: stringOrUndefined(input["Description"]),
    Location: asRecord(input["Location"]),
    CreatedAt: nowSec(),
    State: "AVAILABLE",
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(siteKey(gid, sid), site);
  return { Site: siteView(site) };
};

const GetSites: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const prefix = `site/${gid}/`;
  const sites = ctx.store
    .list<StoredSite>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.SiteId.localeCompare(b.SiteId));
  return { Sites: sites.map(siteView) };
};

const UpdateSite: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const sid = requireString(input, "SiteId");
  const site = requireSite(ctx, gid, sid);
  const updated: StoredSite = {
    ...site,
    Description: stringOrUndefined(input["Description"]) ?? site.Description,
    Location: asRecord(input["Location"]) ?? site.Location,
  };
  ctx.store.set(siteKey(gid, sid), updated);
  return { Site: siteView(updated) };
};

const DeleteSite: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const sid = requireString(input, "SiteId");
  const site = requireSite(ctx, gid, sid);
  ctx.store.delete(siteKey(gid, sid));
  return { Site: siteView({ ...site, State: "DELETING" }) };
};

const CreateDevice: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const did = `device-${shortId()}`;
  const device: StoredDevice = {
    DeviceId: did,
    DeviceArn: deviceArnOf(ctx, gid, did),
    GlobalNetworkId: gid,
    AWSLocation: asRecord(input["AWSLocation"]),
    Description: stringOrUndefined(input["Description"]),
    Type: stringOrUndefined(input["Type"]),
    Vendor: stringOrUndefined(input["Vendor"]),
    Model: stringOrUndefined(input["Model"]),
    SerialNumber: stringOrUndefined(input["SerialNumber"]),
    Location: asRecord(input["Location"]),
    SiteId: stringOrUndefined(input["SiteId"]),
    CreatedAt: nowSec(),
    State: "AVAILABLE",
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(deviceKey(gid, did), device);
  return { Device: deviceView(device) };
};

const GetDevices: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const prefix = `device/${gid}/`;
  const devices = ctx.store
    .list<StoredDevice>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.DeviceId.localeCompare(b.DeviceId));
  return { Devices: devices.map(deviceView) };
};

const UpdateDevice: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const did = requireString(input, "DeviceId");
  const device = requireDevice(ctx, gid, did);
  const updated: StoredDevice = {
    ...device,
    AWSLocation: asRecord(input["AWSLocation"]) ?? device.AWSLocation,
    Description: stringOrUndefined(input["Description"]) ?? device.Description,
    Type: stringOrUndefined(input["Type"]) ?? device.Type,
    Vendor: stringOrUndefined(input["Vendor"]) ?? device.Vendor,
    Model: stringOrUndefined(input["Model"]) ?? device.Model,
    SerialNumber:
      stringOrUndefined(input["SerialNumber"]) ?? device.SerialNumber,
    Location: asRecord(input["Location"]) ?? device.Location,
    SiteId: stringOrUndefined(input["SiteId"]) ?? device.SiteId,
  };
  ctx.store.set(deviceKey(gid, did), updated);
  return { Device: deviceView(updated) };
};

const DeleteDevice: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const did = requireString(input, "DeviceId");
  const device = requireDevice(ctx, gid, did);
  ctx.store.delete(deviceKey(gid, did));
  return { Device: deviceView({ ...device, State: "DELETING" }) };
};

const CreateLink: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const lid = `link-${shortId()}`;
  const link: StoredLink = {
    LinkId: lid,
    LinkArn: linkArnOf(ctx, gid, lid),
    GlobalNetworkId: gid,
    SiteId: requireString(input, "SiteId"),
    Description: stringOrUndefined(input["Description"]),
    Type: stringOrUndefined(input["Type"]),
    Bandwidth: asRecord(input["Bandwidth"]),
    Provider: stringOrUndefined(input["Provider"]),
    CreatedAt: nowSec(),
    State: "AVAILABLE",
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(linkKey(gid, lid), link);
  return { Link: linkView(link) };
};

const GetLinks: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const prefix = `link/${gid}/`;
  const links = ctx.store
    .list<StoredLink>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.LinkId.localeCompare(b.LinkId));
  return { Links: links.map(linkView) };
};

const UpdateLink: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const lid = requireString(input, "LinkId");
  const link = requireLink(ctx, gid, lid);
  const updated: StoredLink = {
    ...link,
    Description: stringOrUndefined(input["Description"]) ?? link.Description,
    Type: stringOrUndefined(input["Type"]) ?? link.Type,
    Bandwidth: asRecord(input["Bandwidth"]) ?? link.Bandwidth,
    Provider: stringOrUndefined(input["Provider"]) ?? link.Provider,
  };
  ctx.store.set(linkKey(gid, lid), updated);
  return { Link: linkView(updated) };
};

const DeleteLink: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const lid = requireString(input, "LinkId");
  const link = requireLink(ctx, gid, lid);
  ctx.store.delete(linkKey(gid, lid));
  return { Link: linkView({ ...link, State: "DELETING" }) };
};

const AssociateLink: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const devId = requireString(input, "DeviceId");
  const lid = requireString(input, "LinkId");
  const assoc: StoredLinkAssociation = {
    GlobalNetworkId: gid,
    DeviceId: devId,
    LinkId: lid,
    LinkAssociationState: "AVAILABLE",
  };
  ctx.store.set(linkAssocKey(gid, devId, lid), assoc);
  return { LinkAssociation: assoc };
};

const GetLinkAssociations: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const prefix = `link-assoc/${gid}/`;
  const assocs = ctx.store
    .list<StoredLinkAssociation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return { LinkAssociations: assocs };
};

const DisassociateLink: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const devId = requireString(input, "DeviceId");
  const lid = requireString(input, "LinkId");
  const key = linkAssocKey(gid, devId, lid);
  const assoc = ctx.store.get<StoredLinkAssociation>(key);
  if (assoc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Link association not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return {
    LinkAssociation: { ...assoc, LinkAssociationState: "DELETED" },
  };
};

const CreateConnection: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const cid = `connection-${shortId()}`;
  const conn: StoredConnection = {
    ConnectionId: cid,
    ConnectionArn: connectionArnOf(ctx, gid, cid),
    GlobalNetworkId: gid,
    DeviceId: requireString(input, "DeviceId"),
    ConnectedDeviceId: requireString(input, "ConnectedDeviceId"),
    LinkId: stringOrUndefined(input["LinkId"]),
    ConnectedLinkId: stringOrUndefined(input["ConnectedLinkId"]),
    Description: stringOrUndefined(input["Description"]),
    CreatedAt: nowSec(),
    State: "AVAILABLE",
    Tags: tagListFrom(input["Tags"]),
  };
  ctx.store.set(connectionKey(gid, cid), conn);
  return { Connection: connectionView(conn) };
};

const GetConnections: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const prefix = `connection/${gid}/`;
  const connections = ctx.store
    .list<StoredConnection>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.ConnectionId.localeCompare(b.ConnectionId));
  return { Connections: connections.map(connectionView) };
};

const UpdateConnection: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const cid = requireString(input, "ConnectionId");
  const conn = requireConnection(ctx, gid, cid);
  const updated: StoredConnection = {
    ...conn,
    LinkId: stringOrUndefined(input["LinkId"]) ?? conn.LinkId,
    ConnectedLinkId:
      stringOrUndefined(input["ConnectedLinkId"]) ?? conn.ConnectedLinkId,
    Description: stringOrUndefined(input["Description"]) ?? conn.Description,
  };
  ctx.store.set(connectionKey(gid, cid), updated);
  return { Connection: connectionView(updated) };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const cid = requireString(input, "ConnectionId");
  const conn = requireConnection(ctx, gid, cid);
  ctx.store.delete(connectionKey(gid, cid));
  return { Connection: connectionView({ ...conn, State: "DELETING" }) };
};

const AssociateCustomerGateway: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const cgArn = requireString(input, "CustomerGatewayArn");
  const assoc: StoredCustomerGatewayAssociation = {
    CustomerGatewayArn: cgArn,
    GlobalNetworkId: gid,
    DeviceId: requireString(input, "DeviceId"),
    LinkId: stringOrUndefined(input["LinkId"]),
    State: "AVAILABLE",
  };
  ctx.store.set(customerGwAssocKey(gid, cgArn), assoc);
  return { CustomerGatewayAssociation: assoc };
};

const GetCustomerGatewayAssociations: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const prefix = `cgw-assoc/${gid}/`;
  const assocs = ctx.store
    .list<StoredCustomerGatewayAssociation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return { CustomerGatewayAssociations: assocs };
};

const DisassociateCustomerGateway: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const cgArn = requireString(input, "CustomerGatewayArn");
  const key = customerGwAssocKey(gid, cgArn);
  const assoc = ctx.store.get<StoredCustomerGatewayAssociation>(key);
  if (assoc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Customer gateway association not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return {
    CustomerGatewayAssociation: { ...assoc, State: "DELETED" },
  };
};

const RegisterTransitGateway: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const tgArn = requireString(input, "TransitGatewayArn");
  const reg: StoredTransitGatewayRegistration = {
    GlobalNetworkId: gid,
    TransitGatewayArn: tgArn,
    State: { Code: "AVAILABLE", Message: undefined },
  };
  ctx.store.set(tgwRegistrationKey(gid, tgArn), reg);
  return { TransitGatewayRegistration: reg };
};

const GetTransitGatewayRegistrations: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const prefix = `tgw-reg/${gid}/`;
  const regs = ctx.store
    .list<StoredTransitGatewayRegistration>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return { TransitGatewayRegistrations: regs };
};

const DeregisterTransitGateway: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const tgArn = requireString(input, "TransitGatewayArn");
  const key = tgwRegistrationKey(gid, tgArn);
  const reg = ctx.store.get<StoredTransitGatewayRegistration>(key);
  if (reg === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Transit gateway registration not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return {
    TransitGatewayRegistration: {
      ...reg,
      State: { Code: "DELETING", Message: undefined },
    },
  };
};

const AssociateTransitGatewayConnectPeer: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const tgcpArn = requireString(input, "TransitGatewayConnectPeerArn");
  const assoc: StoredTransitGatewayConnectPeerAssociation = {
    TransitGatewayConnectPeerArn: tgcpArn,
    GlobalNetworkId: gid,
    DeviceId: requireString(input, "DeviceId"),
    LinkId: stringOrUndefined(input["LinkId"]),
    State: "AVAILABLE",
  };
  ctx.store.set(tgwConnectPeerAssocKey(gid, tgcpArn), assoc);
  return { TransitGatewayConnectPeerAssociation: assoc };
};

const GetTransitGatewayConnectPeerAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const gid = requireString(input, "GlobalNetworkId");
  const prefix = `tgwcp-assoc/${gid}/`;
  const assocs = ctx.store
    .list<StoredTransitGatewayConnectPeerAssociation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return { TransitGatewayConnectPeerAssociations: assocs };
};

const DisassociateTransitGatewayConnectPeer: OperationHandler = (
  input,
  ctx,
) => {
  const gid = requireString(input, "GlobalNetworkId");
  const tgcpArn = requireString(input, "TransitGatewayConnectPeerArn");
  const key = tgwConnectPeerAssocKey(gid, tgcpArn);
  const assoc = ctx.store.get<StoredTransitGatewayConnectPeerAssociation>(key);
  if (assoc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Transit gateway connect peer association not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return {
    TransitGatewayConnectPeerAssociation: { ...assoc, State: "DELETED" },
  };
};

const AssociateConnectPeer: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const cpId = requireString(input, "ConnectPeerId");
  const assoc: StoredConnectPeerAssociation = {
    ConnectPeerId: cpId,
    GlobalNetworkId: gid,
    DeviceId: requireString(input, "DeviceId"),
    LinkId: stringOrUndefined(input["LinkId"]),
    State: "AVAILABLE",
  };
  ctx.store.set(connectPeerAssocKey(gid, cpId), assoc);
  return { ConnectPeerAssociation: assoc };
};

const GetConnectPeerAssociations: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const prefix = `cp-assoc/${gid}/`;
  const assocs = ctx.store
    .list<StoredConnectPeerAssociation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return { ConnectPeerAssociations: assocs };
};

const DisassociateConnectPeer: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const cpId = requireString(input, "ConnectPeerId");
  const key = connectPeerAssocKey(gid, cpId);
  const assoc = ctx.store.get<StoredConnectPeerAssociation>(key);
  if (assoc === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Connect peer association not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return { ConnectPeerAssociation: { ...assoc, State: "DELETED" } };
};

const GetNetworkResourceCounts: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  return { NetworkResourceCounts: [] };
};

const GetNetworkResourceRelationships: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  return { Relationships: [] };
};

const GetNetworkResources: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  return { NetworkResources: [] };
};

const GetNetworkRoutes: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  return {
    RouteTableArn: undefined,
    CoreNetworkSegmentEdge: undefined,
    RouteTableType: undefined,
    RouteTableTimestamp: undefined,
    NetworkRoutes: [],
  };
};

const GetNetworkTelemetry: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  return { NetworkTelemetry: [] };
};

const UpdateNetworkResourceMetadata: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const resourceArn = requireString(input, "ResourceArn");
  const metadata =
    asRecord(input["Metadata"]) ?? ({} as Record<string, unknown>);
  return { ResourceArn: resourceArn, Metadata: metadata };
};

const StartRouteAnalysis: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const raId = `ra-${shortId()}`;
  const ra: StoredRouteAnalysis = {
    GlobalNetworkId: gid,
    OwnerAccountId: ctx.account,
    RouteAnalysisId: raId,
    StartTimestamp: nowSec(),
    Status: "RUNNING",
    Source: asRecord(input["Source"]),
    Destination: asRecord(input["Destination"]),
    IncludeReturnPath: input["IncludeReturnPath"] === true,
    UseMiddleboxes: input["UseMiddleboxes"] === true,
  };
  ctx.store.set(routeAnalysisKey(gid, raId), ra);
  return {
    RouteAnalysis: {
      ...ra,
      ForwardPath: undefined,
      ReturnPath: undefined,
    },
  };
};

const GetRouteAnalysis: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  const raId = requireString(input, "RouteAnalysisId");
  const ra = ctx.store.get<StoredRouteAnalysis>(routeAnalysisKey(gid, raId));
  if (ra === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Route analysis not found: ${raId}.`,
      404,
    );
  }
  return {
    RouteAnalysis: {
      ...ra,
      ForwardPath: undefined,
      ReturnPath: undefined,
    },
  };
};

const CreateCoreNetwork: OperationHandler = (input, ctx) => {
  const gid = requireString(input, "GlobalNetworkId");
  requireGlobalNetwork(ctx, gid);
  const cnId = `core-network-${shortId().slice(0, 10)}`;
  const cn: StoredCoreNetwork = {
    GlobalNetworkId: gid,
    CoreNetworkId: cnId,
    CoreNetworkArn: coreNetworkArnOf(ctx, cnId),
    Description: stringOrUndefined(input["Description"]),
    CreatedAt: nowSec(),
    State: "AVAILABLE",
    Segments: [],
    NetworkFunctionGroups: [],
    Edges: [],
    Tags: tagListFrom(input["Tags"]),
    OwnerAccountId: ctx.account,
    PolicyVersionCounter: 0,
  };
  ctx.store.set(coreNetworkKey(cnId), cn);
  return { CoreNetwork: coreNetworkView(cn) };
};

const ListCoreNetworks: OperationHandler = (_input, ctx) => {
  const cns = ctx.store
    .list<StoredCoreNetwork>()
    .filter((e) => e.key.startsWith("core-network/"))
    .map((e) => e.value)
    .sort((a, b) => a.CoreNetworkId.localeCompare(b.CoreNetworkId));
  return { CoreNetworks: cns.map(coreNetworkSummaryView) };
};

const GetCoreNetwork: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const cn = requireCoreNetwork(ctx, cnId);
  return { CoreNetwork: coreNetworkView(cn) };
};

const UpdateCoreNetwork: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const cn = requireCoreNetwork(ctx, cnId);
  const updated: StoredCoreNetwork = {
    ...cn,
    Description: stringOrUndefined(input["Description"]) ?? cn.Description,
  };
  ctx.store.set(coreNetworkKey(cnId), updated);
  return { CoreNetwork: coreNetworkView(updated) };
};

const DeleteCoreNetwork: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const cn = requireCoreNetwork(ctx, cnId);
  ctx.store.delete(coreNetworkKey(cnId));
  return { CoreNetwork: coreNetworkView({ ...cn, State: "DELETING" }) };
};

const PutCoreNetworkPolicy: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const cn = requireCoreNetwork(ctx, cnId);
  const newVersion = cn.PolicyVersionCounter + 1;
  const policy: StoredCoreNetworkPolicy = {
    CoreNetworkId: cnId,
    PolicyVersionId: newVersion,
    Alias: "LATEST",
    Description: stringOrUndefined(input["Description"]),
    CreatedAt: nowSec(),
    ChangeSetState: "PENDING_GENERATION",
    PolicyErrors: [],
    PolicyDocument:
      typeof input["PolicyDocument"] === "string"
        ? input["PolicyDocument"]
        : undefined,
  };
  ctx.store.set(coreNetworkPolicyKey(cnId, newVersion), policy);
  ctx.store.set(coreNetworkPolicyCurrentKey(cnId), policy);
  ctx.store.set(coreNetworkKey(cnId), {
    ...cn,
    PolicyVersionCounter: newVersion,
  });
  return { CoreNetworkPolicy: coreNetworkPolicyView(policy) };
};

const GetCoreNetworkPolicy: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const policy = ctx.store.get<StoredCoreNetworkPolicy>(
    coreNetworkPolicyCurrentKey(cnId),
  );
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Core network policy not found for: ${cnId}.`,
      404,
    );
  }
  return { CoreNetworkPolicy: coreNetworkPolicyView(policy) };
};

const ListCoreNetworkPolicyVersions: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const prefix = `cnpolicy/${cnId}/`;
  const versions = ctx.store
    .list<StoredCoreNetworkPolicy>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value)
    .sort((a, b) => a.PolicyVersionId - b.PolicyVersionId);
  return {
    CoreNetworkPolicyVersions: versions.map((p) => ({
      CoreNetworkId: p.CoreNetworkId,
      PolicyVersionId: p.PolicyVersionId,
      Alias: p.Alias,
      Description: p.Description,
      CreatedAt: p.CreatedAt,
      ChangeSetState: p.ChangeSetState,
    })),
  };
};

const DeleteCoreNetworkPolicyVersion: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const ver = Number(input["PolicyVersionId"]);
  const key = coreNetworkPolicyKey(cnId, ver);
  const policy = ctx.store.get<StoredCoreNetworkPolicy>(key);
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Policy version not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return { CoreNetworkPolicy: coreNetworkPolicyView(policy) };
};

const RestoreCoreNetworkPolicyVersion: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const cn = requireCoreNetwork(ctx, cnId);
  const ver = Number(input["PolicyVersionId"]);
  const key = coreNetworkPolicyKey(cnId, ver);
  const policy = ctx.store.get<StoredCoreNetworkPolicy>(key);
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Policy version not found.",
      404,
    );
  }
  const newVersion = cn.PolicyVersionCounter + 1;
  const restored: StoredCoreNetworkPolicy = {
    ...policy,
    PolicyVersionId: newVersion,
    Alias: "LATEST",
    CreatedAt: nowSec(),
    ChangeSetState: "PENDING_GENERATION",
  };
  ctx.store.set(coreNetworkPolicyKey(cnId, newVersion), restored);
  ctx.store.set(coreNetworkPolicyCurrentKey(cnId), restored);
  ctx.store.set(coreNetworkKey(cnId), {
    ...cn,
    PolicyVersionCounter: newVersion,
  });
  return { CoreNetworkPolicy: coreNetworkPolicyView(restored) };
};

const GetCoreNetworkChangeSet: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  return { CoreNetworkChanges: [] };
};

const GetCoreNetworkChangeEvents: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  return { CoreNetworkChangeEvents: [] };
};

const ExecuteCoreNetworkChangeSet: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  return {};
};

const ListCoreNetworkRoutingInformation: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  return { CoreNetworkRoutingInformation: [] };
};

const CreateCoreNetworkPrefixListAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const plArn = requireString(input, "PrefixListArn");
  const assoc: StoredCoreNetworkPrefixListAssociation = {
    CoreNetworkId: cnId,
    PrefixListArn: plArn,
    PrefixListAlias: stringOrUndefined(input["PrefixListAlias"]),
  };
  ctx.store.set(coreNetworkPrefixListKey(cnId, plArn), assoc);
  return {
    CoreNetworkId: cnId,
    PrefixListArn: plArn,
    PrefixListAlias: assoc.PrefixListAlias,
  };
};

const ListCoreNetworkPrefixListAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const prefix = `prefix-list/${cnId}/`;
  const assocs = ctx.store
    .list<StoredCoreNetworkPrefixListAssociation>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    PrefixListAssociations: assocs.map((a) => ({
      CoreNetworkId: a.CoreNetworkId,
      PrefixListArn: a.PrefixListArn,
      PrefixListAlias: a.PrefixListAlias,
    })),
  };
};

const DeleteCoreNetworkPrefixListAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const plArn = requireString(input, "PrefixListArn");
  const key = coreNetworkPrefixListKey(cnId, plArn);
  if (!ctx.store.get(key)) {
    throw awsError(
      "ResourceNotFoundException",
      "Prefix list association not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return { CoreNetworkId: cnId, PrefixListArn: plArn };
};

const makeAttachmentBase = (
  ctx: ServiceContext,
  type: string,
  cnId: string | undefined,
  resourceArn: string | undefined,
  edgeLocation: string | undefined,
  tags: TagEntry[],
): AttachmentBase => {
  const id = `attachment-${shortId()}`;
  const now = nowSec();
  const cnArn = cnId !== undefined ? coreNetworkArnOf(ctx, cnId) : undefined;
  return {
    CoreNetworkId: cnId,
    CoreNetworkArn: cnArn,
    AttachmentId: id,
    OwnerAccountId: ctx.account,
    AttachmentType: type,
    State: "CREATING",
    EdgeLocation: edgeLocation,
    EdgeLocations: edgeLocation !== undefined ? [edgeLocation] : [],
    ResourceArn: resourceArn,
    AttachmentPolicyRuleNumber: undefined,
    SegmentName: undefined,
    NetworkFunctionGroupName: undefined,
    Tags: tags,
    CreatedAt: now,
    UpdatedAt: now,
  };
};

const CreateVpcAttachment: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const vpcArn = requireString(input, "VpcArn");
  const base = makeAttachmentBase(
    ctx,
    "VPC",
    cnId,
    vpcArn,
    stringOrUndefined(input["EdgeLocation"]),
    tagListFrom(input["Tags"]),
  );
  const att: StoredVpcAttachment = {
    ...base,
    SubnetArns: Array.isArray(input["SubnetArns"])
      ? (input["SubnetArns"] as string[])
      : [],
    Options: asRecord(input["Options"]),
  };
  ctx.store.set(attachmentKey(att.AttachmentId), att);
  return {
    VpcAttachment: {
      Attachment: attachmentBaseView(att),
      SubnetArns: att.SubnetArns,
      Options: att.Options,
    },
  };
};

const GetVpcAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredVpcAttachment>(attachmentKey(id));
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `VPC attachment not found: ${id}.`,
      404,
    );
  }
  return {
    VpcAttachment: {
      Attachment: attachmentBaseView(att),
      SubnetArns: att.SubnetArns,
      Options: att.Options,
    },
  };
};

const UpdateVpcAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredVpcAttachment>(attachmentKey(id));
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `VPC attachment not found: ${id}.`,
      404,
    );
  }
  const updated: StoredVpcAttachment = {
    ...att,
    SubnetArns: Array.isArray(input["AddSubnetArns"])
      ? [...att.SubnetArns, ...(input["AddSubnetArns"] as string[])]
      : att.SubnetArns,
    Options: asRecord(input["Options"]) ?? att.Options,
    UpdatedAt: nowSec(),
  };
  ctx.store.set(attachmentKey(id), updated);
  return {
    VpcAttachment: {
      Attachment: attachmentBaseView(updated),
      SubnetArns: updated.SubnetArns,
      Options: updated.Options,
    },
  };
};

const CreateConnectAttachment: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const base = makeAttachmentBase(
    ctx,
    "CONNECT",
    cnId,
    undefined,
    stringOrUndefined(input["EdgeLocation"]),
    tagListFrom(input["Tags"]),
  );
  const att: StoredConnectAttachment = {
    ...base,
    TransportAttachmentId: stringOrUndefined(input["TransportAttachmentId"]),
    Options: asRecord(input["Options"]),
  };
  ctx.store.set(attachmentKey(att.AttachmentId), att);
  return {
    ConnectAttachment: {
      Attachment: attachmentBaseView(att),
      TransportAttachmentId: att.TransportAttachmentId,
      Options: att.Options,
    },
  };
};

const GetConnectAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredConnectAttachment>(attachmentKey(id));
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Connect attachment not found: ${id}.`,
      404,
    );
  }
  return {
    ConnectAttachment: {
      Attachment: attachmentBaseView(att),
      TransportAttachmentId: att.TransportAttachmentId,
      Options: att.Options,
    },
  };
};

const CreateSiteToSiteVpnAttachment: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const vpnArn = requireString(input, "VpnConnectionArn");
  const base = makeAttachmentBase(
    ctx,
    "SITE_TO_SITE_VPN",
    cnId,
    vpnArn,
    undefined,
    tagListFrom(input["Tags"]),
  );
  const att: StoredSiteToSiteVpnAttachment = {
    ...base,
    VpnConnectionArn: vpnArn,
  };
  ctx.store.set(attachmentKey(att.AttachmentId), att);
  return {
    SiteToSiteVpnAttachment: {
      Attachment: attachmentBaseView(att),
      VpnConnectionArn: att.VpnConnectionArn,
    },
  };
};

const GetSiteToSiteVpnAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredSiteToSiteVpnAttachment>(attachmentKey(id));
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Site-to-site VPN attachment not found: ${id}.`,
      404,
    );
  }
  return {
    SiteToSiteVpnAttachment: {
      Attachment: attachmentBaseView(att),
      VpnConnectionArn: att.VpnConnectionArn,
    },
  };
};

const CreateTransitGatewayRouteTableAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const pid = requireString(input, "PeeringId");
  const tgwRtArn = requireString(input, "TransitGatewayRouteTableArn");
  const base = makeAttachmentBase(
    ctx,
    "TRANSIT_GATEWAY_ROUTE_TABLE",
    undefined,
    tgwRtArn,
    undefined,
    tagListFrom(input["Tags"]),
  );
  const att: StoredTransitGatewayRouteTableAttachment = {
    ...base,
    PeeringId: pid,
    TransitGatewayRouteTableArn: tgwRtArn,
  };
  ctx.store.set(attachmentKey(att.AttachmentId), att);
  return {
    TransitGatewayRouteTableAttachment: {
      Attachment: attachmentBaseView(att),
      PeeringId: att.PeeringId,
      TransitGatewayRouteTableArn: att.TransitGatewayRouteTableArn,
    },
  };
};

const GetTransitGatewayRouteTableAttachment: OperationHandler = (
  input,
  ctx,
) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredTransitGatewayRouteTableAttachment>(
    attachmentKey(id),
  );
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Transit gateway route table attachment not found: ${id}.`,
      404,
    );
  }
  return {
    TransitGatewayRouteTableAttachment: {
      Attachment: attachmentBaseView(att),
      PeeringId: att.PeeringId,
      TransitGatewayRouteTableArn: att.TransitGatewayRouteTableArn,
    },
  };
};

const CreateDirectConnectGatewayAttachment: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const dcgwArn = requireString(input, "DirectConnectGatewayArn");
  const edgeLocs = Array.isArray(input["EdgeLocations"])
    ? (input["EdgeLocations"] as string[])
    : [];
  const base = makeAttachmentBase(
    ctx,
    "DIRECT_CONNECT_GATEWAY",
    cnId,
    dcgwArn,
    edgeLocs[0],
    tagListFrom(input["Tags"]),
  );
  const att: StoredDirectConnectGatewayAttachment = {
    ...base,
    EdgeLocations: edgeLocs,
    DirectConnectGatewayArn: dcgwArn,
  };
  ctx.store.set(attachmentKey(att.AttachmentId), att);
  return {
    DirectConnectGatewayAttachment: {
      Attachment: attachmentBaseView(att),
      DirectConnectGatewayArn: att.DirectConnectGatewayArn,
    },
  };
};

const GetDirectConnectGatewayAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredDirectConnectGatewayAttachment>(
    attachmentKey(id),
  );
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Direct Connect gateway attachment not found: ${id}.`,
      404,
    );
  }
  return {
    DirectConnectGatewayAttachment: {
      Attachment: attachmentBaseView(att),
      DirectConnectGatewayArn: att.DirectConnectGatewayArn,
    },
  };
};

const UpdateDirectConnectGatewayAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = ctx.store.get<StoredDirectConnectGatewayAttachment>(
    attachmentKey(id),
  );
  if (att === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Direct Connect gateway attachment not found: ${id}.`,
      404,
    );
  }
  const edgeLocs = Array.isArray(input["EdgeLocations"])
    ? (input["EdgeLocations"] as string[])
    : att.EdgeLocations;
  const updated: StoredDirectConnectGatewayAttachment = {
    ...att,
    EdgeLocations: edgeLocs,
    UpdatedAt: nowSec(),
  };
  ctx.store.set(attachmentKey(id), updated);
  return {
    DirectConnectGatewayAttachment: {
      Attachment: attachmentBaseView(updated),
      DirectConnectGatewayArn: updated.DirectConnectGatewayArn,
    },
  };
};

const ListAttachments: OperationHandler = (_input, ctx) => {
  const atts = ctx.store
    .list<AttachmentBase>()
    .filter((e) => e.key.startsWith("attachment/"))
    .map((e) => e.value)
    .sort((a, b) => a.AttachmentId.localeCompare(b.AttachmentId));
  return { Attachments: atts.map(attachmentBaseView) };
};

const DeleteAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = requireAttachment(ctx, id);
  ctx.store.delete(attachmentKey(id));
  return { Attachment: attachmentBaseView({ ...att, State: "DELETING" }) };
};

const AcceptAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = requireAttachment(ctx, id);
  const updated = { ...att, State: "AVAILABLE", UpdatedAt: nowSec() };
  ctx.store.set(attachmentKey(id), updated);
  return { Attachment: attachmentBaseView(updated) };
};

const RejectAttachment: OperationHandler = (input, ctx) => {
  const id = requireString(input, "AttachmentId");
  const att = requireAttachment(ctx, id);
  const updated = { ...att, State: "REJECTED", UpdatedAt: nowSec() };
  ctx.store.set(attachmentKey(id), updated);
  return { Attachment: attachmentBaseView(updated) };
};

const CreateConnectPeer: OperationHandler = (input, ctx) => {
  const cpId = `connect-peer-${shortId().slice(0, 10)}`;
  const cp: StoredConnectPeer = {
    CoreNetworkId: stringOrUndefined(input["CoreNetworkId"]),
    ConnectAttachmentId: stringOrUndefined(input["ConnectAttachmentId"]),
    ConnectPeerId: cpId,
    EdgeLocation: stringOrUndefined(input["EdgeLocation"]),
    State: "CREATING",
    CreatedAt: nowSec(),
    Configuration: {
      CoreNetworkAddress: stringOrUndefined(input["CoreNetworkAddress"]),
      PeerAddress: stringOrUndefined(input["PeerAddress"]),
      InsideCidrBlocks: Array.isArray(input["InsideCidrBlocks"])
        ? input["InsideCidrBlocks"]
        : [],
      Protocol: "GRE",
      BgpConfigurations: [],
    },
    Tags: tagListFrom(input["Tags"]),
    SubnetArn: stringOrUndefined(input["SubnetArn"]),
  };
  ctx.store.set(connectPeerKey(cpId), cp);
  return { ConnectPeer: connectPeerView(cp) };
};

const ListConnectPeers: OperationHandler = (_input, ctx) => {
  const cps = ctx.store
    .list<StoredConnectPeer>()
    .filter((e) => e.key.startsWith("connect-peer/"))
    .map((e) => e.value)
    .sort((a, b) => a.ConnectPeerId.localeCompare(b.ConnectPeerId));
  return { ConnectPeers: cps.map(connectPeerSummaryView) };
};

const GetConnectPeer: OperationHandler = (input, ctx) => {
  const cpId = requireString(input, "ConnectPeerId");
  const cp = requireConnectPeer(ctx, cpId);
  return { ConnectPeer: connectPeerView(cp) };
};

const DeleteConnectPeer: OperationHandler = (input, ctx) => {
  const cpId = requireString(input, "ConnectPeerId");
  const cp = requireConnectPeer(ctx, cpId);
  ctx.store.delete(connectPeerKey(cpId));
  return { ConnectPeer: connectPeerView({ ...cp, State: "DELETING" }) };
};

const CreateTransitGatewayPeering: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  requireCoreNetwork(ctx, cnId);
  const tgwArn = requireString(input, "TransitGatewayArn");
  const pid = `peering-${shortId()}`;
  const attId = `attachment-${shortId()}`;
  const now = nowSec();
  const peering: StoredPeering = {
    CoreNetworkId: cnId,
    CoreNetworkArn: coreNetworkArnOf(ctx, cnId),
    PeeringId: pid,
    OwnerAccountId: ctx.account,
    PeeringType: "TRANSIT_GATEWAY",
    State: "CREATING",
    EdgeLocation: stringOrUndefined(input["EdgeLocation"]),
    ResourceArn: tgwArn,
    Tags: tagListFrom(input["Tags"]),
    CreatedAt: now,
    TransitGatewayArn: tgwArn,
    TransitGatewayPeeringAttachmentId: attId,
  };
  ctx.store.set(peeringKey(pid), peering);
  return {
    TransitGatewayPeering: {
      Peering: peeringView(peering),
      TransitGatewayArn: tgwArn,
      TransitGatewayPeeringAttachmentId: attId,
    },
  };
};

const GetTransitGatewayPeering: OperationHandler = (input, ctx) => {
  const pid = requireString(input, "PeeringId");
  const peering = requirePeering(ctx, pid);
  return {
    TransitGatewayPeering: {
      Peering: peeringView(peering),
      TransitGatewayArn: peering.TransitGatewayArn,
      TransitGatewayPeeringAttachmentId:
        peering.TransitGatewayPeeringAttachmentId,
    },
  };
};

const ListPeerings: OperationHandler = (_input, ctx) => {
  const peerings = ctx.store
    .list<StoredPeering>()
    .filter((e) => e.key.startsWith("peering/"))
    .map((e) => e.value)
    .sort((a, b) => a.PeeringId.localeCompare(b.PeeringId));
  return { Peerings: peerings.map(peeringView) };
};

const DeletePeering: OperationHandler = (input, ctx) => {
  const pid = requireString(input, "PeeringId");
  const peering = requirePeering(ctx, pid);
  ctx.store.delete(peeringKey(pid));
  return { Peering: peeringView({ ...peering, State: "DELETING" }) };
};

const PutResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const doc = input["PolicyDocument"];
  ctx.store.set(resourcePolicyKey(arn), doc);
  return {};
};

const GetResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const doc = ctx.store.get(resourcePolicyKey(arn));
  return { PolicyDocument: doc };
};

const DeleteResourcePolicy: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  ctx.store.delete(resourcePolicyKey(arn));
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<TagEntry[]>(tagsKey(arn)) ?? [];
  return { TagList: tags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const existing = ctx.store.get<TagEntry[]>(tagsKey(arn)) ?? [];
  const newTags = tagListFrom(input["Tags"]);
  const merged = [...existing];
  for (const t of newTags) {
    const idx = merged.findIndex((e) => e.Key === t.Key);
    if (idx >= 0) {
      merged[idx] = t;
    } else {
      merged.push(t);
    }
  }
  ctx.store.set(tagsKey(arn), merged);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const keysToRemove = Array.isArray(input["TagKeys"])
    ? (input["TagKeys"] as string[])
    : [];
  const existing = ctx.store.get<TagEntry[]>(tagsKey(arn)) ?? [];
  const filtered = existing.filter(
    (t) => t.Key === undefined || !keysToRemove.includes(t.Key),
  );
  ctx.store.set(tagsKey(arn), filtered);
  return {};
};

const ListOrganizationServiceAccessStatus: OperationHandler = () => ({
  OrganizationStatus: {
    OrganizationId: undefined,
    OrganizationAwsServiceAccessStatus: "DISABLED",
    SLRDeploymentStatus: undefined,
    AccountStatusList: [],
  },
});

const StartOrganizationServiceAccessUpdate: OperationHandler = () => ({
  OrganizationStatus: {
    OrganizationId: undefined,
    OrganizationAwsServiceAccessStatus: "ENABLED",
    SLRDeploymentStatus: undefined,
    AccountStatusList: [],
  },
});

const PutAttachmentRoutingPolicyLabel: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const attId = requireString(input, "AttachmentId");
  const label = stringOrUndefined(input["RoutingPolicyLabel"]);
  const rec: StoredRoutingPolicyLabel = {
    CoreNetworkId: cnId,
    AttachmentId: attId,
    RoutingPolicyLabel: label,
  };
  ctx.store.set(routingPolicyLabelKey(cnId, attId), rec);
  return {
    CoreNetworkId: cnId,
    AttachmentId: attId,
    RoutingPolicyLabel: label,
  };
};

const ListAttachmentRoutingPolicyAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const cnId = requireString(input, "CoreNetworkId");
  const prefix = `routing-label/${cnId}/`;
  const assocs = ctx.store
    .list<StoredRoutingPolicyLabel>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);
  return {
    AttachmentRoutingPolicyAssociations: assocs.map((a) => ({
      CoreNetworkId: a.CoreNetworkId,
      AttachmentId: a.AttachmentId,
      RoutingPolicyLabel: a.RoutingPolicyLabel,
    })),
  };
};

const RemoveAttachmentRoutingPolicyLabel: OperationHandler = (input, ctx) => {
  const cnId = requireString(input, "CoreNetworkId");
  const attId = requireString(input, "AttachmentId");
  const key = routingPolicyLabelKey(cnId, attId);
  const rec = ctx.store.get<StoredRoutingPolicyLabel>(key);
  if (rec === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      "Routing policy label association not found.",
      404,
    );
  }
  ctx.store.delete(key);
  return {
    CoreNetworkId: cnId,
    AttachmentId: attId,
    RoutingPolicyLabel: rec.RoutingPolicyLabel,
  };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const resolveGlobalNetworks = (
  m: string,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (m === "POST") return "CreateGlobalNetwork";
    if (m === "GET") return "DescribeGlobalNetworks";
    return undefined;
  }
  if (parts.length === 2) {
    if (m === "DELETE") return "DeleteGlobalNetwork";
    if (m === "PATCH") return "UpdateGlobalNetwork";
    return undefined;
  }
  const sub = parts[2];
  switch (sub) {
    case "sites":
      if (parts.length === 3) {
        if (m === "GET") return "GetSites";
        if (m === "POST") return "CreateSite";
      }
      if (parts.length === 4) {
        if (m === "DELETE") return "DeleteSite";
        if (m === "PATCH") return "UpdateSite";
      }
      return undefined;
    case "devices":
      if (parts.length === 3) {
        if (m === "GET") return "GetDevices";
        if (m === "POST") return "CreateDevice";
      }
      if (parts.length === 4) {
        if (m === "DELETE") return "DeleteDevice";
        if (m === "PATCH") return "UpdateDevice";
      }
      return undefined;
    case "links":
      if (parts.length === 3) {
        if (m === "GET") return "GetLinks";
        if (m === "POST") return "CreateLink";
      }
      if (parts.length === 4) {
        if (m === "DELETE") return "DeleteLink";
        if (m === "PATCH") return "UpdateLink";
      }
      return undefined;
    case "link-associations":
      if (parts.length === 3) {
        if (m === "GET") return "GetLinkAssociations";
        if (m === "POST") return "AssociateLink";
        if (m === "DELETE") return "DisassociateLink";
      }
      return undefined;
    case "connections":
      if (parts.length === 3) {
        if (m === "GET") return "GetConnections";
        if (m === "POST") return "CreateConnection";
      }
      if (parts.length === 4) {
        if (m === "DELETE") return "DeleteConnection";
        if (m === "PATCH") return "UpdateConnection";
      }
      return undefined;
    case "customer-gateway-associations":
      if (parts.length === 3) {
        if (m === "GET") return "GetCustomerGatewayAssociations";
        if (m === "POST") return "AssociateCustomerGateway";
      }
      if (parts.length >= 4) {
        if (m === "DELETE") return "DisassociateCustomerGateway";
      }
      return undefined;
    case "transit-gateway-registrations":
      if (parts.length === 3) {
        if (m === "GET") return "GetTransitGatewayRegistrations";
        if (m === "POST") return "RegisterTransitGateway";
      }
      if (parts.length >= 4) {
        if (m === "DELETE") return "DeregisterTransitGateway";
      }
      return undefined;
    case "transit-gateway-connect-peer-associations":
      if (parts.length === 3) {
        if (m === "GET") return "GetTransitGatewayConnectPeerAssociations";
        if (m === "POST") return "AssociateTransitGatewayConnectPeer";
      }
      if (parts.length >= 4) {
        if (m === "DELETE") return "DisassociateTransitGatewayConnectPeer";
      }
      return undefined;
    case "connect-peer-associations":
      if (parts.length === 3) {
        if (m === "GET") return "GetConnectPeerAssociations";
        if (m === "POST") return "AssociateConnectPeer";
      }
      if (parts.length === 4) {
        if (m === "DELETE") return "DisassociateConnectPeer";
      }
      return undefined;
    case "network-resource-count":
      if (m === "GET") return "GetNetworkResourceCounts";
      return undefined;
    case "network-resource-relationships":
      if (m === "GET") return "GetNetworkResourceRelationships";
      return undefined;
    case "network-resources":
      if (parts.length === 3 && m === "GET") return "GetNetworkResources";
      if (
        parts.length >= 5 &&
        parts[parts.length - 1] === "metadata" &&
        m === "PATCH"
      )
        return "UpdateNetworkResourceMetadata";
      return undefined;
    case "network-routes":
      if (m === "POST") return "GetNetworkRoutes";
      return undefined;
    case "network-telemetry":
      if (m === "GET") return "GetNetworkTelemetry";
      return undefined;
    case "route-analyses":
      if (parts.length === 3 && m === "POST") return "StartRouteAnalysis";
      if (parts.length === 4 && m === "GET") return "GetRouteAnalysis";
      return undefined;
    default:
      return undefined;
  }
};

const resolveCoreNetworks = (
  m: string,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (m === "GET") return "ListCoreNetworks";
    if (m === "POST") return "CreateCoreNetwork";
    return undefined;
  }
  if (parts.length === 2) {
    if (m === "GET") return "GetCoreNetwork";
    if (m === "DELETE") return "DeleteCoreNetwork";
    if (m === "PATCH") return "UpdateCoreNetwork";
    return undefined;
  }
  const sub = parts[2];
  switch (sub) {
    case "core-network-change-events":
      if (m === "GET") return "GetCoreNetworkChangeEvents";
      return undefined;
    case "core-network-change-sets":
      if (parts.length === 4 && m === "GET") return "GetCoreNetworkChangeSet";
      if (parts.length === 5 && parts[4] === "execute" && m === "POST")
        return "ExecuteCoreNetworkChangeSet";
      return undefined;
    case "core-network-policy":
      if (m === "GET") return "GetCoreNetworkPolicy";
      if (m === "POST") return "PutCoreNetworkPolicy";
      return undefined;
    case "core-network-policy-versions":
      if (parts.length === 3 && m === "GET")
        return "ListCoreNetworkPolicyVersions";
      if (parts.length === 4 && m === "DELETE")
        return "DeleteCoreNetworkPolicyVersion";
      if (parts.length === 5 && parts[4] === "restore" && m === "POST")
        return "RestoreCoreNetworkPolicyVersion";
      return undefined;
    case "core-network-routing-information":
      if (m === "POST") return "ListCoreNetworkRoutingInformation";
      return undefined;
    default:
      return undefined;
  }
};

const networkmanager = {
  name: "networkmanager",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    const m = req.method;

    if (parts.length === 0) return undefined;

    switch (parts[0]) {
      case "global-networks":
        return resolveGlobalNetworks(m, parts);
      case "core-networks":
        return resolveCoreNetworks(m, parts);
      case "attachments":
        if (parts.length === 1 && m === "GET") return "ListAttachments";
        if (parts.length === 2 && m === "DELETE") return "DeleteAttachment";
        if (parts.length === 3 && m === "POST") {
          if (parts[2] === "accept") return "AcceptAttachment";
          if (parts[2] === "reject") return "RejectAttachment";
        }
        return undefined;
      case "connect-attachments":
        if (parts.length === 1 && m === "POST")
          return "CreateConnectAttachment";
        if (parts.length === 2 && m === "GET") return "GetConnectAttachment";
        return undefined;
      case "connect-peers":
        if (parts.length === 1) {
          if (m === "GET") return "ListConnectPeers";
          if (m === "POST") return "CreateConnectPeer";
        }
        if (parts.length === 2) {
          if (m === "GET") return "GetConnectPeer";
          if (m === "DELETE") return "DeleteConnectPeer";
        }
        return undefined;
      case "vpc-attachments":
        if (parts.length === 1 && m === "POST") return "CreateVpcAttachment";
        if (parts.length === 2) {
          if (m === "GET") return "GetVpcAttachment";
          if (m === "PATCH") return "UpdateVpcAttachment";
        }
        return undefined;
      case "site-to-site-vpn-attachments":
        if (parts.length === 1 && m === "POST")
          return "CreateSiteToSiteVpnAttachment";
        if (parts.length === 2 && m === "GET")
          return "GetSiteToSiteVpnAttachment";
        return undefined;
      case "transit-gateway-peerings":
        if (parts.length === 1 && m === "POST")
          return "CreateTransitGatewayPeering";
        if (parts.length === 2 && m === "GET")
          return "GetTransitGatewayPeering";
        return undefined;
      case "transit-gateway-route-table-attachments":
        if (parts.length === 1 && m === "POST")
          return "CreateTransitGatewayRouteTableAttachment";
        if (parts.length === 2 && m === "GET")
          return "GetTransitGatewayRouteTableAttachment";
        return undefined;
      case "direct-connect-gateway-attachments":
        if (parts.length === 1 && m === "POST")
          return "CreateDirectConnectGatewayAttachment";
        if (parts.length === 2) {
          if (m === "GET") return "GetDirectConnectGatewayAttachment";
          if (m === "PATCH") return "UpdateDirectConnectGatewayAttachment";
        }
        return undefined;
      case "peerings":
        if (parts.length === 1 && m === "GET") return "ListPeerings";
        if (parts.length === 2 && m === "DELETE") return "DeletePeering";
        return undefined;
      case "prefix-list":
        if (parts.length === 1 && m === "POST")
          return "CreateCoreNetworkPrefixListAssociation";
        if (parts[1] === "core-network" && m === "GET")
          return "ListCoreNetworkPrefixListAssociations";
        if (
          parts[parts.length - 2] === "core-network" &&
          parts[1] !== "core-network" &&
          m === "DELETE"
        )
          return "DeleteCoreNetworkPrefixListAssociation";
        return undefined;
      case "resource-policy":
        if (parts.length >= 2) {
          if (m === "GET") return "GetResourcePolicy";
          if (m === "POST") return "PutResourcePolicy";
          if (m === "DELETE") return "DeleteResourcePolicy";
        }
        return undefined;
      case "routing-policy-label":
        if (parts.length === 1 && m === "POST")
          return "PutAttachmentRoutingPolicyLabel";
        if (parts.length === 3 && parts[1] === "core-network" && m === "GET")
          return "ListAttachmentRoutingPolicyAssociations";
        if (
          parts.length === 5 &&
          parts[1] === "core-network" &&
          parts[3] === "attachment" &&
          m === "DELETE"
        )
          return "RemoveAttachmentRoutingPolicyLabel";
        return undefined;
      case "tags":
        if (parts.length >= 2) {
          if (m === "GET") return "ListTagsForResource";
          if (m === "POST") return "TagResource";
          if (m === "DELETE") return "UntagResource";
        }
        return undefined;
      case "organizations":
        if (parts[1] === "service-access") {
          if (m === "GET") return "ListOrganizationServiceAccessStatus";
          if (m === "POST") return "StartOrganizationServiceAccessUpdate";
        }
        return undefined;
      default:
        return undefined;
    }
  },
  operations: {
    CreateGlobalNetwork,
    DescribeGlobalNetworks,
    DeleteGlobalNetwork,
    UpdateGlobalNetwork,
    CreateSite,
    GetSites,
    UpdateSite,
    DeleteSite,
    CreateDevice,
    GetDevices,
    UpdateDevice,
    DeleteDevice,
    CreateLink,
    GetLinks,
    UpdateLink,
    DeleteLink,
    AssociateLink,
    GetLinkAssociations,
    DisassociateLink,
    CreateConnection,
    GetConnections,
    UpdateConnection,
    DeleteConnection,
    AssociateCustomerGateway,
    GetCustomerGatewayAssociations,
    DisassociateCustomerGateway,
    RegisterTransitGateway,
    GetTransitGatewayRegistrations,
    DeregisterTransitGateway,
    AssociateTransitGatewayConnectPeer,
    GetTransitGatewayConnectPeerAssociations,
    DisassociateTransitGatewayConnectPeer,
    AssociateConnectPeer,
    GetConnectPeerAssociations,
    DisassociateConnectPeer,
    GetNetworkResourceCounts,
    GetNetworkResourceRelationships,
    GetNetworkResources,
    GetNetworkRoutes,
    GetNetworkTelemetry,
    UpdateNetworkResourceMetadata,
    StartRouteAnalysis,
    GetRouteAnalysis,
    CreateCoreNetwork,
    ListCoreNetworks,
    GetCoreNetwork,
    UpdateCoreNetwork,
    DeleteCoreNetwork,
    PutCoreNetworkPolicy,
    GetCoreNetworkPolicy,
    ListCoreNetworkPolicyVersions,
    DeleteCoreNetworkPolicyVersion,
    RestoreCoreNetworkPolicyVersion,
    GetCoreNetworkChangeSet,
    GetCoreNetworkChangeEvents,
    ExecuteCoreNetworkChangeSet,
    ListCoreNetworkRoutingInformation,
    CreateCoreNetworkPrefixListAssociation,
    ListCoreNetworkPrefixListAssociations,
    DeleteCoreNetworkPrefixListAssociation,
    CreateVpcAttachment,
    GetVpcAttachment,
    UpdateVpcAttachment,
    CreateConnectAttachment,
    GetConnectAttachment,
    CreateSiteToSiteVpnAttachment,
    GetSiteToSiteVpnAttachment,
    CreateTransitGatewayRouteTableAttachment,
    GetTransitGatewayRouteTableAttachment,
    CreateDirectConnectGatewayAttachment,
    GetDirectConnectGatewayAttachment,
    UpdateDirectConnectGatewayAttachment,
    ListAttachments,
    DeleteAttachment,
    AcceptAttachment,
    RejectAttachment,
    CreateConnectPeer,
    ListConnectPeers,
    GetConnectPeer,
    DeleteConnectPeer,
    CreateTransitGatewayPeering,
    GetTransitGatewayPeering,
    ListPeerings,
    DeletePeering,
    PutResourcePolicy,
    GetResourcePolicy,
    DeleteResourcePolicy,
    ListTagsForResource,
    TagResource,
    UntagResource,
    ListOrganizationServiceAccessStatus,
    StartOrganizationServiceAccessUpdate,
    PutAttachmentRoutingPolicyLabel,
    ListAttachmentRoutingPolicyAssociations,
    RemoveAttachmentRoutingPolicyLabel,
  },
  model,
} as const satisfies ServiceDefinition;

export default networkmanager;
