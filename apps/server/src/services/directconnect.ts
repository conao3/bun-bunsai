import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import directconnectModel from "../../../../test/vendor/aws-models/directconnect.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(directconnectModel);

type StoredConnection = {
  ownerAccount: string;
  connectionId: string;
  connectionName: string;
  connectionState: string;
  region: string;
  location: string;
  bandwidth: string;
  vlan?: number;
  partnerName?: string;
  lagId?: string;
  providerName?: string;
  jumboFrameCapable: boolean;
  hasLogicalRedundancy: string;
  macSecCapable: boolean;
  encryptionMode?: string;
  macSecKeys?: unknown[];
};

type StoredBGPPeer = {
  bgpPeerId: string;
  asn?: number;
  authKey?: string;
  addressFamily?: string;
  amazonAddress?: string;
  customerAddress?: string;
  bgpPeerState: string;
  bgpStatus: string;
};

type StoredVirtualInterface = {
  ownerAccount: string;
  virtualInterfaceId: string;
  location: string;
  connectionId: string;
  virtualInterfaceType: string;
  virtualInterfaceName: string;
  vlan: number;
  asn?: number;
  authKey?: string;
  amazonAddress?: string;
  customerAddress?: string;
  addressFamily?: string;
  virtualInterfaceState: string;
  mtu?: number;
  jumboFrameCapable: boolean;
  virtualGatewayId?: string;
  directConnectGatewayId?: string;
  routeFilterPrefixes?: unknown[];
  bgpPeers: StoredBGPPeer[];
  region: string;
  siteLinkEnabled?: boolean;
  tags?: unknown[];
};

type StoredInterconnect = {
  interconnectId: string;
  interconnectName: string;
  interconnectState: string;
  region: string;
  location: string;
  bandwidth: string;
  lagId?: string;
  jumboFrameCapable: boolean;
  hasLogicalRedundancy: string;
  providerName?: string;
  macSecCapable: boolean;
  encryptionMode?: string;
  macSecKeys?: unknown[];
  tags?: unknown[];
};

type StoredLag = {
  lagId: string;
  ownerAccount: string;
  lagName: string;
  lagState: string;
  location: string;
  region: string;
  connectionsBandwidth: string;
  numberOfConnections: number;
  minimumLinks: number;
  allowsHostedConnections: boolean;
  jumboFrameCapable: boolean;
  hasLogicalRedundancy: string;
  providerName?: string;
  macSecCapable: boolean;
  encryptionMode?: string;
  macSecKeys?: unknown[];
  tags?: unknown[];
};

type StoredDirectConnectGateway = {
  directConnectGatewayId: string;
  directConnectGatewayName: string;
  amazonSideAsn?: number;
  ownerAccount: string;
  directConnectGatewayState: string;
  tags?: unknown[];
};

type StoredGatewayAssociation = {
  associationId: string;
  directConnectGatewayId: string;
  directConnectGatewayOwnerAccount: string;
  associationState: string;
  associatedGateway?: {
    id: string;
    type: string;
    ownerAccount: string;
    region: string;
  };
  allowedPrefixesToDirectConnectGateway?: unknown[];
  virtualGatewayId?: string;
};

type StoredGatewayAssociationProposal = {
  proposalId: string;
  directConnectGatewayId: string;
  directConnectGatewayOwnerAccount: string;
  proposalState: string;
  associatedGateway?: {
    id: string;
    type: string;
    ownerAccount: string;
    region: string;
  };
  requestedAllowedPrefixesToDirectConnectGateway?: unknown[];
};

const connectionKey = (id: string): string => `connection/${id}`;
const virtualInterfaceKey = (id: string): string => `virtualInterface/${id}`;
const interconnectKey = (id: string): string => `interconnect/${id}`;
const lagKey = (id: string): string => `lag/${id}`;
const gatewayKey = (id: string): string => `gateway/${id}`;
const gatewayAssociationKey = (id: string): string =>
  `gatewayAssociation/${id}`;
const gatewayAssociationProposalKey = (id: string): string =>
  `gatewayAssociationProposal/${id}`;
const tagsKey = (arn: string): string => `tags/${arn}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError(
      "DirectConnectClientException",
      `The value for ${key} is not valid.`,
      400,
    );
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

const optionalNumber = (
  input: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = input[key];
  return typeof value === "number" ? value : undefined;
};

const randomHex = (length: number): string => {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const newUuid = (): string =>
  `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`;

const paginateList = <T>(
  items: T[],
  nextToken: unknown,
  maxResults: unknown,
): { items: T[]; nextToken: string | undefined } => {
  const pageSize =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 100;
  const startIndex =
    typeof nextToken === "string" && nextToken !== ""
      ? parseInt(nextToken, 10)
      : 0;
  const page = items.slice(startIndex, startIndex + pageSize);
  const newNextToken =
    startIndex + pageSize < items.length
      ? String(startIndex + pageSize)
      : undefined;
  return { items: page, nextToken: newNextToken };
};

const syntheticLoa = (): { loaContent: string; loaContentType: string } => ({
  loaContent: Buffer.from("LOA-CFA").toString("base64"),
  loaContentType: "application/pdf",
});

const requireConnection = (
  ctx: ServiceContext,
  connectionId: string,
): StoredConnection => {
  const connection = ctx.store.get<StoredConnection>(
    connectionKey(connectionId),
  );
  if (connection === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Connection with ID ${connectionId} not found.`,
      400,
    );
  }
  return connection;
};

const requireVirtualInterface = (
  ctx: ServiceContext,
  virtualInterfaceId: string,
): StoredVirtualInterface => {
  const vi = ctx.store.get<StoredVirtualInterface>(
    virtualInterfaceKey(virtualInterfaceId),
  );
  if (vi === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Virtual interface ${virtualInterfaceId} not found.`,
      400,
    );
  }
  return vi;
};

const requireInterconnect = (
  ctx: ServiceContext,
  interconnectId: string,
): StoredInterconnect => {
  const ic = ctx.store.get<StoredInterconnect>(interconnectKey(interconnectId));
  if (ic === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Interconnect ${interconnectId} not found.`,
      400,
    );
  }
  return ic;
};

const requireLag = (ctx: ServiceContext, lagId: string): StoredLag => {
  const lag = ctx.store.get<StoredLag>(lagKey(lagId));
  if (lag === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `LAG ${lagId} not found.`,
      400,
    );
  }
  return lag;
};

const requireGateway = (
  ctx: ServiceContext,
  directConnectGatewayId: string,
): StoredDirectConnectGateway => {
  const gw = ctx.store.get<StoredDirectConnectGateway>(
    gatewayKey(directConnectGatewayId),
  );
  if (gw === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Direct Connect Gateway ${directConnectGatewayId} not found.`,
      400,
    );
  }
  return gw;
};

const requireGatewayAssociation = (
  ctx: ServiceContext,
  associationId: string,
): StoredGatewayAssociation => {
  const assoc = ctx.store.get<StoredGatewayAssociation>(
    gatewayAssociationKey(associationId),
  );
  if (assoc === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Association ${associationId} not found.`,
      400,
    );
  }
  return assoc;
};

const requireGatewayAssociationProposal = (
  ctx: ServiceContext,
  proposalId: string,
): StoredGatewayAssociationProposal => {
  const proposal = ctx.store.get<StoredGatewayAssociationProposal>(
    gatewayAssociationProposalKey(proposalId),
  );
  if (proposal === undefined) {
    throw awsError(
      "DirectConnectClientException",
      `Proposal ${proposalId} not found.`,
      400,
    );
  }
  return proposal;
};

const buildVirtualInterface = (
  ctx: ServiceContext,
  connectionId: string,
  viType: string,
  spec: Record<string, unknown>,
  state = "pending",
): StoredVirtualInterface => {
  const virtualInterfaceId = `dxvif-${randomHex(8)}`;
  const bgpPeer: StoredBGPPeer = {
    bgpPeerId: `dxpeer-${randomHex(8)}`,
    asn: optionalNumber(spec, "asn"),
    authKey: optionalString(spec, "authKey"),
    addressFamily: optionalString(spec, "addressFamily"),
    amazonAddress: optionalString(spec, "amazonAddress"),
    customerAddress: optionalString(spec, "customerAddress"),
    bgpPeerState: "available",
    bgpStatus: "up",
  };
  const vi: StoredVirtualInterface = {
    ownerAccount: ctx.account,
    virtualInterfaceId,
    location: "",
    connectionId,
    virtualInterfaceType: viType,
    virtualInterfaceName:
      (spec["virtualInterfaceName"] as string | undefined) ?? "",
    vlan: (spec["vlan"] as number | undefined) ?? 0,
    asn: optionalNumber(spec, "asn"),
    authKey: optionalString(spec, "authKey"),
    amazonAddress: optionalString(spec, "amazonAddress"),
    customerAddress: optionalString(spec, "customerAddress"),
    addressFamily: optionalString(spec, "addressFamily"),
    virtualInterfaceState: state,
    mtu: optionalNumber(spec, "mtu") ?? 1500,
    jumboFrameCapable: false,
    virtualGatewayId: optionalString(spec, "virtualGatewayId"),
    directConnectGatewayId: optionalString(spec, "directConnectGatewayId"),
    routeFilterPrefixes: Array.isArray(spec["routeFilterPrefixes"])
      ? (spec["routeFilterPrefixes"] as unknown[])
      : [],
    bgpPeers: [bgpPeer],
    region: ctx.region,
    siteLinkEnabled: false,
    tags: Array.isArray(spec["tags"]) ? (spec["tags"] as unknown[]) : [],
  };
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), vi);
  return vi;
};

const CreateConnection: OperationHandler = (input, ctx) => {
  const location = requireString(input, "location");
  const bandwidth = requireString(input, "bandwidth");
  const connectionName = requireString(input, "connectionName");
  const connectionId = `dxcon-${randomHex(8)}`;
  const connection: StoredConnection = {
    ownerAccount: ctx.account,
    connectionId,
    connectionName,
    connectionState: "requested",
    region: ctx.region,
    location,
    bandwidth,
    providerName: optionalString(input, "providerName"),
    jumboFrameCapable: false,
    hasLogicalRedundancy: "unknown",
    macSecCapable: false,
  };
  ctx.store.set(connectionKey(connectionId), connection);
  return connection;
};

const DescribeConnections: OperationHandler = (input, ctx) => {
  const connectionId = optionalString(input, "connectionId");
  if (connectionId !== undefined) {
    const connection = requireConnection(ctx, connectionId);
    return { connections: [connection] };
  }
  const all = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith("connection/"))
    .map((entry) => entry.value);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { connections: items, nextToken };
};

const DeleteConnection: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const connection = requireConnection(ctx, connectionId);
  const deleted: StoredConnection = {
    ...connection,
    connectionState: "deleted",
  };
  ctx.store.delete(connectionKey(connectionId));
  return deleted;
};

const UpdateConnection: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const connection = requireConnection(ctx, connectionId);
  const updated: StoredConnection = {
    ...connection,
    connectionName:
      optionalString(input, "connectionName") ?? connection.connectionName,
    encryptionMode:
      optionalString(input, "encryptionMode") ?? connection.encryptionMode,
  };
  ctx.store.set(connectionKey(connectionId), updated);
  return updated;
};

const ConfirmConnection: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const connection = requireConnection(ctx, connectionId);
  const updated = { ...connection, connectionState: "available" };
  ctx.store.set(connectionKey(connectionId), updated);
  return { connectionState: "available" };
};

const AssociateConnectionWithLag: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const lagId = requireString(input, "lagId");
  requireLag(ctx, lagId);
  const connection = requireConnection(ctx, connectionId);
  const updated = { ...connection, lagId };
  ctx.store.set(connectionKey(connectionId), updated);
  return updated;
};

const DisassociateConnectionFromLag: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const connection = requireConnection(ctx, connectionId);
  const updated = { ...connection, lagId: undefined };
  ctx.store.set(connectionKey(connectionId), updated);
  return updated;
};

const AssociateHostedConnection: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const parentConnectionId = requireString(input, "parentConnectionId");
  requireConnection(ctx, parentConnectionId);
  return requireConnection(ctx, connectionId);
};

const AssociateMacSecKey: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  return { connectionId, macSecKeys: [] };
};

const DisassociateMacSecKey: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  return { connectionId, macSecKeys: [] };
};

const AllocateConnectionOnInterconnect: OperationHandler = (input, ctx) => {
  const bandwidth = requireString(input, "bandwidth");
  const connectionName = requireString(input, "connectionName");
  const ownerAccount = requireString(input, "ownerAccount");
  const interconnectId = requireString(input, "interconnectId");
  requireInterconnect(ctx, interconnectId);
  const vlan = optionalNumber(input, "vlan");
  const connectionId = `dxcon-${randomHex(8)}`;
  const connection: StoredConnection = {
    ownerAccount,
    connectionId,
    connectionName,
    connectionState: "ordering",
    region: ctx.region,
    location: "",
    bandwidth,
    vlan,
    jumboFrameCapable: false,
    hasLogicalRedundancy: "unknown",
    macSecCapable: false,
  };
  ctx.store.set(connectionKey(connectionId), connection);
  return connection;
};

const AllocateHostedConnection: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  const ownerAccount = requireString(input, "ownerAccount");
  const bandwidth = requireString(input, "bandwidth");
  const connectionName = requireString(input, "connectionName");
  const vlan = optionalNumber(input, "vlan");
  requireConnection(ctx, connectionId);
  const hostedConnectionId = `dxcon-${randomHex(8)}`;
  const hostedConnection: StoredConnection = {
    ownerAccount,
    connectionId: hostedConnectionId,
    connectionName,
    connectionState: "ordering",
    region: ctx.region,
    location: "",
    bandwidth,
    vlan,
    jumboFrameCapable: false,
    hasLogicalRedundancy: "unknown",
    macSecCapable: false,
  };
  ctx.store.set(connectionKey(hostedConnectionId), hostedConnection);
  return hostedConnection;
};

const DescribeConnectionsOnInterconnect: OperationHandler = (input, ctx) => {
  const interconnectId = requireString(input, "interconnectId");
  requireInterconnect(ctx, interconnectId);
  const connections = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith("connection/"))
    .map((entry) => entry.value);
  return { connections };
};

const DescribeHostedConnections: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const connections = ctx.store
    .list<StoredConnection>()
    .filter((entry) => entry.key.startsWith("connection/"))
    .map((entry) => entry.value);
  return { connections };
};

const DescribeConnectionLoa: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  return { loa: syntheticLoa() };
};

const DescribeLoa: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  return syntheticLoa();
};

const CreatePrivateVirtualInterface: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const spec =
    (input["newPrivateVirtualInterface"] as Record<string, unknown>) ?? {};
  return buildVirtualInterface(ctx, connectionId, "private", spec);
};

const CreatePublicVirtualInterface: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const spec =
    (input["newPublicVirtualInterface"] as Record<string, unknown>) ?? {};
  return buildVirtualInterface(ctx, connectionId, "public", spec);
};

const CreateTransitVirtualInterface: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const spec =
    (input["newTransitVirtualInterface"] as Record<string, unknown>) ?? {};
  const vi = buildVirtualInterface(ctx, connectionId, "transit", spec);
  return { virtualInterface: vi };
};

const AllocatePrivateVirtualInterface: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const spec =
    (input["newPrivateVirtualInterfaceAllocation"] as Record<
      string,
      unknown
    >) ?? {};
  return buildVirtualInterface(
    ctx,
    connectionId,
    "private",
    spec,
    "confirming",
  );
};

const AllocatePublicVirtualInterface: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const spec =
    (input["newPublicVirtualInterfaceAllocation"] as Record<string, unknown>) ??
    {};
  return buildVirtualInterface(ctx, connectionId, "public", spec, "confirming");
};

const AllocateTransitVirtualInterface: OperationHandler = (input, ctx) => {
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const spec =
    (input["newTransitVirtualInterfaceAllocation"] as Record<
      string,
      unknown
    >) ?? {};
  const vi = buildVirtualInterface(
    ctx,
    connectionId,
    "transit",
    spec,
    "confirming",
  );
  return { virtualInterface: vi };
};

const DeleteVirtualInterface: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  const deleted = { ...vi, virtualInterfaceState: "deleted" };
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), deleted);
  return { virtualInterfaceState: "deleted" };
};

const DescribeVirtualInterfaces: OperationHandler = (input, ctx) => {
  const connectionId = optionalString(input, "connectionId");
  const virtualInterfaceId = optionalString(input, "virtualInterfaceId");
  let virtualInterfaces = ctx.store
    .list<StoredVirtualInterface>()
    .filter((entry) => entry.key.startsWith("virtualInterface/"))
    .map((entry) => entry.value);
  if (connectionId !== undefined) {
    virtualInterfaces = virtualInterfaces.filter(
      (vi) => vi.connectionId === connectionId,
    );
  }
  if (virtualInterfaceId !== undefined) {
    virtualInterfaces = virtualInterfaces.filter(
      (vi) => vi.virtualInterfaceId === virtualInterfaceId,
    );
  }
  const { items, nextToken } = paginateList(
    virtualInterfaces,
    input["nextToken"],
    input["maxResults"],
  );
  return { virtualInterfaces: items, nextToken };
};

const ConfirmPrivateVirtualInterface: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), {
    ...vi,
    virtualInterfaceState: "available",
  });
  return { virtualInterfaceState: "available" };
};

const ConfirmPublicVirtualInterface: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), {
    ...vi,
    virtualInterfaceState: "available",
  });
  return { virtualInterfaceState: "available" };
};

const ConfirmTransitVirtualInterface: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), {
    ...vi,
    virtualInterfaceState: "available",
  });
  return { virtualInterfaceState: "available" };
};

const AssociateVirtualInterface: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const connectionId = requireString(input, "connectionId");
  requireConnection(ctx, connectionId);
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  const updated = { ...vi, connectionId };
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), updated);
  return updated;
};

const UpdateVirtualInterfaceAttributes: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  const updated: StoredVirtualInterface = {
    ...vi,
    mtu: optionalNumber(input, "mtu") ?? vi.mtu,
    siteLinkEnabled:
      typeof input["enableSiteLink"] === "boolean"
        ? (input["enableSiteLink"] as boolean)
        : vi.siteLinkEnabled,
    virtualInterfaceName:
      optionalString(input, "virtualInterfaceName") ?? vi.virtualInterfaceName,
  };
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), updated);
  return updated;
};

const DescribeRouterConfiguration: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  return {
    customerRouterConfig: "router bgp 65000",
    virtualInterfaceId,
    virtualInterfaceName: vi.virtualInterfaceName,
  };
};

const ListVirtualInterfaceTestHistory: OperationHandler = (_input, _ctx) => ({
  virtualInterfaceTestHistory: [],
});

const StartBgpFailoverTest: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  requireVirtualInterface(ctx, virtualInterfaceId);
  return {
    virtualInterfaceTest: {
      testId: `dxtest-${randomHex(8)}`,
      virtualInterfaceId,
      bgpPeers: [],
      status: "IN_PROGRESS",
    },
  };
};

const StopBgpFailoverTest: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = requireString(input, "virtualInterfaceId");
  requireVirtualInterface(ctx, virtualInterfaceId);
  return {
    virtualInterfaceTest: {
      testId: `dxtest-${randomHex(8)}`,
      virtualInterfaceId,
      bgpPeers: [],
      status: "COMPLETED",
    },
  };
};

const CreateBGPPeer: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = optionalString(input, "virtualInterfaceId");
  if (virtualInterfaceId === undefined) {
    throw awsError(
      "DirectConnectClientException",
      "virtualInterfaceId is required.",
      400,
    );
  }
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  const spec =
    (input["newBGPPeer"] as Record<string, unknown> | undefined) ?? {};
  const bgpPeer: StoredBGPPeer = {
    bgpPeerId: `dxpeer-${randomHex(8)}`,
    asn: optionalNumber(spec, "asn"),
    authKey: optionalString(spec, "authKey"),
    addressFamily: optionalString(spec, "addressFamily"),
    amazonAddress: optionalString(spec, "amazonAddress"),
    customerAddress: optionalString(spec, "customerAddress"),
    bgpPeerState: "available",
    bgpStatus: "up",
  };
  const updated = { ...vi, bgpPeers: [...vi.bgpPeers, bgpPeer] };
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), updated);
  return { virtualInterface: updated };
};

const DeleteBGPPeer: OperationHandler = (input, ctx) => {
  const virtualInterfaceId = optionalString(input, "virtualInterfaceId");
  if (virtualInterfaceId === undefined) {
    throw awsError(
      "DirectConnectClientException",
      "virtualInterfaceId is required.",
      400,
    );
  }
  const vi = requireVirtualInterface(ctx, virtualInterfaceId);
  const bgpPeerId = optionalString(input, "bgpPeerId");
  const updated = {
    ...vi,
    bgpPeers: vi.bgpPeers.filter(
      (p) => bgpPeerId === undefined || p.bgpPeerId !== bgpPeerId,
    ),
  };
  ctx.store.set(virtualInterfaceKey(virtualInterfaceId), updated);
  return { virtualInterface: updated };
};

const DescribeVirtualGateways: OperationHandler = (_input, _ctx) => ({
  virtualGateways: [],
});

const CreateInterconnect: OperationHandler = (input, ctx) => {
  const interconnectName = requireString(input, "interconnectName");
  const bandwidth = requireString(input, "bandwidth");
  const location = requireString(input, "location");
  const interconnectId = `dxcon-${randomHex(8)}`;
  const interconnect: StoredInterconnect = {
    interconnectId,
    interconnectName,
    interconnectState: "available",
    region: ctx.region,
    location,
    bandwidth,
    lagId: optionalString(input, "lagId"),
    jumboFrameCapable: false,
    hasLogicalRedundancy: "unknown",
    providerName: optionalString(input, "providerName"),
    macSecCapable: false,
    tags: Array.isArray(input["tags"]) ? (input["tags"] as unknown[]) : [],
  };
  ctx.store.set(interconnectKey(interconnectId), interconnect);
  return interconnect;
};

const DeleteInterconnect: OperationHandler = (input, ctx) => {
  const interconnectId = requireString(input, "interconnectId");
  const interconnect = requireInterconnect(ctx, interconnectId);
  const deleted = { ...interconnect, interconnectState: "deleted" };
  ctx.store.set(interconnectKey(interconnectId), deleted);
  return { interconnectState: "deleted" };
};

const DescribeInterconnects: OperationHandler = (input, ctx) => {
  const interconnectId = optionalString(input, "interconnectId");
  if (interconnectId !== undefined) {
    const interconnect = requireInterconnect(ctx, interconnectId);
    return { interconnects: [interconnect] };
  }
  const all = ctx.store
    .list<StoredInterconnect>()
    .filter((entry) => entry.key.startsWith("interconnect/"))
    .map((entry) => entry.value);
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { interconnects: items, nextToken };
};

const DescribeInterconnectLoa: OperationHandler = (input, ctx) => {
  const interconnectId = requireString(input, "interconnectId");
  requireInterconnect(ctx, interconnectId);
  return { loa: syntheticLoa() };
};

const CreateLag: OperationHandler = (input, ctx) => {
  const numberOfConnections = input["numberOfConnections"] as
    | number
    | undefined;
  const location = requireString(input, "location");
  const connectionsBandwidth = requireString(input, "connectionsBandwidth");
  const lagName = requireString(input, "lagName");
  const lagId = `dxlag-${randomHex(8)}`;
  const lag: StoredLag = {
    lagId,
    ownerAccount: ctx.account,
    lagName,
    lagState: "available",
    location,
    region: ctx.region,
    connectionsBandwidth,
    numberOfConnections: numberOfConnections ?? 0,
    minimumLinks: 0,
    allowsHostedConnections: false,
    jumboFrameCapable: false,
    hasLogicalRedundancy: "unknown",
    providerName: optionalString(input, "providerName"),
    macSecCapable: false,
    tags: Array.isArray(input["tags"]) ? (input["tags"] as unknown[]) : [],
  };
  ctx.store.set(lagKey(lagId), lag);
  return { ...lag, connections: [] };
};

const DeleteLag: OperationHandler = (input, ctx) => {
  const lagId = requireString(input, "lagId");
  const lag = requireLag(ctx, lagId);
  const deleted = { ...lag, lagState: "deleted" };
  ctx.store.set(lagKey(lagId), deleted);
  return { ...deleted, connections: [] };
};

const DescribeLags: OperationHandler = (input, ctx) => {
  const lagId = optionalString(input, "lagId");
  if (lagId !== undefined) {
    const lag = requireLag(ctx, lagId);
    return { lags: [{ ...lag, connections: [] }] };
  }
  const all = ctx.store
    .list<StoredLag>()
    .filter((entry) => entry.key.startsWith("lag/"))
    .map((entry) => ({ ...entry.value, connections: [] }));
  const { items, nextToken } = paginateList(
    all,
    input["nextToken"],
    input["maxResults"],
  );
  return { lags: items, nextToken };
};

const UpdateLag: OperationHandler = (input, ctx) => {
  const lagId = requireString(input, "lagId");
  const lag = requireLag(ctx, lagId);
  const updated: StoredLag = {
    ...lag,
    lagName: optionalString(input, "lagName") ?? lag.lagName,
    minimumLinks:
      (input["minimumLinks"] as number | undefined) ?? lag.minimumLinks,
    encryptionMode:
      optionalString(input, "encryptionMode") ?? lag.encryptionMode,
  };
  ctx.store.set(lagKey(lagId), updated);
  return { ...updated, connections: [] };
};

const CreateDirectConnectGateway: OperationHandler = (input, ctx) => {
  const directConnectGatewayName = requireString(
    input,
    "directConnectGatewayName",
  );
  const directConnectGatewayId = newUuid();
  const gw: StoredDirectConnectGateway = {
    directConnectGatewayId,
    directConnectGatewayName,
    amazonSideAsn: optionalNumber(input, "amazonSideAsn"),
    ownerAccount: ctx.account,
    directConnectGatewayState: "available",
    tags: Array.isArray(input["tags"]) ? (input["tags"] as unknown[]) : [],
  };
  ctx.store.set(gatewayKey(directConnectGatewayId), gw);
  return { directConnectGateway: gw };
};

const DeleteDirectConnectGateway: OperationHandler = (input, ctx) => {
  const directConnectGatewayId = requireString(input, "directConnectGatewayId");
  const gw = requireGateway(ctx, directConnectGatewayId);
  const deleted = { ...gw, directConnectGatewayState: "deleted" };
  ctx.store.set(gatewayKey(directConnectGatewayId), deleted);
  return { directConnectGateway: deleted };
};

const DescribeDirectConnectGateways: OperationHandler = (input, ctx) => {
  const directConnectGatewayId = optionalString(
    input,
    "directConnectGatewayId",
  );
  if (directConnectGatewayId !== undefined) {
    const gw = requireGateway(ctx, directConnectGatewayId);
    return { directConnectGateways: [gw] };
  }
  const directConnectGateways = ctx.store
    .list<StoredDirectConnectGateway>()
    .filter((entry) => entry.key.startsWith("gateway/"))
    .map((entry) => entry.value);
  return { directConnectGateways };
};

const UpdateDirectConnectGateway: OperationHandler = (input, ctx) => {
  const directConnectGatewayId = requireString(input, "directConnectGatewayId");
  const newDirectConnectGatewayName = requireString(
    input,
    "newDirectConnectGatewayName",
  );
  const gw = requireGateway(ctx, directConnectGatewayId);
  const updated = {
    ...gw,
    directConnectGatewayName: newDirectConnectGatewayName,
  };
  ctx.store.set(gatewayKey(directConnectGatewayId), updated);
  return { directConnectGateway: updated };
};

const CreateDirectConnectGatewayAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const directConnectGatewayId = requireString(input, "directConnectGatewayId");
  requireGateway(ctx, directConnectGatewayId);
  const associationId = newUuid();
  const gatewayId = optionalString(input, "gatewayId");
  const virtualGatewayId = optionalString(input, "virtualGatewayId");
  const assoc: StoredGatewayAssociation = {
    associationId,
    directConnectGatewayId,
    directConnectGatewayOwnerAccount: ctx.account,
    associationState: "associated",
    associatedGateway:
      gatewayId !== undefined
        ? {
            id: gatewayId,
            type: "transitGateway",
            ownerAccount: ctx.account,
            region: ctx.region,
          }
        : undefined,
    allowedPrefixesToDirectConnectGateway: Array.isArray(
      input["addAllowedPrefixesToDirectConnectGateway"],
    )
      ? (input["addAllowedPrefixesToDirectConnectGateway"] as unknown[])
      : [],
    virtualGatewayId,
  };
  ctx.store.set(gatewayAssociationKey(associationId), assoc);
  return { directConnectGatewayAssociation: assoc };
};

const DeleteDirectConnectGatewayAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const associationId = optionalString(input, "associationId");
  if (associationId !== undefined) {
    const assoc = requireGatewayAssociation(ctx, associationId);
    ctx.store.delete(gatewayAssociationKey(associationId));
    return {
      directConnectGatewayAssociation: {
        ...assoc,
        associationState: "disassociated",
      },
    };
  }
  const directConnectGatewayId = optionalString(
    input,
    "directConnectGatewayId",
  );
  const virtualGatewayId = optionalString(input, "virtualGatewayId");
  const assocs = ctx.store
    .list<StoredGatewayAssociation>()
    .filter((entry) => entry.key.startsWith("gatewayAssociation/"))
    .map((entry) => entry.value)
    .filter(
      (a) =>
        (directConnectGatewayId === undefined ||
          a.directConnectGatewayId === directConnectGatewayId) &&
        (virtualGatewayId === undefined ||
          a.virtualGatewayId === virtualGatewayId),
    );
  if (assocs.length === 0) {
    throw awsError(
      "DirectConnectClientException",
      "Association not found.",
      400,
    );
  }
  const assoc = assocs[0];
  ctx.store.delete(gatewayAssociationKey(assoc.associationId));
  return {
    directConnectGatewayAssociation: {
      ...assoc,
      associationState: "disassociated",
    },
  };
};

const DescribeDirectConnectGatewayAssociations: OperationHandler = (
  input,
  ctx,
) => {
  const directConnectGatewayId = optionalString(
    input,
    "directConnectGatewayId",
  );
  let assocs = ctx.store
    .list<StoredGatewayAssociation>()
    .filter((entry) => entry.key.startsWith("gatewayAssociation/"))
    .map((entry) => entry.value);
  if (directConnectGatewayId !== undefined) {
    assocs = assocs.filter(
      (a) => a.directConnectGatewayId === directConnectGatewayId,
    );
  }
  return { directConnectGatewayAssociations: assocs };
};

const UpdateDirectConnectGatewayAssociation: OperationHandler = (
  input,
  ctx,
) => {
  const associationId = optionalString(input, "associationId");
  if (associationId === undefined) {
    throw awsError(
      "DirectConnectClientException",
      "associationId is required.",
      400,
    );
  }
  const assoc = requireGatewayAssociation(ctx, associationId);
  const add = Array.isArray(input["addAllowedPrefixesToDirectConnectGateway"])
    ? (input["addAllowedPrefixesToDirectConnectGateway"] as unknown[])
    : [];
  const remove = Array.isArray(
    input["removeAllowedPrefixesToDirectConnectGateway"],
  )
    ? (input["removeAllowedPrefixesToDirectConnectGateway"] as unknown[])
    : [];
  const existing = assoc.allowedPrefixesToDirectConnectGateway ?? [];
  const removeCidrs = new Set(
    remove.map((r) => (r as Record<string, unknown>)["cidr"] as string),
  );
  const updated: StoredGatewayAssociation = {
    ...assoc,
    allowedPrefixesToDirectConnectGateway: [
      ...existing.filter(
        (p) =>
          !removeCidrs.has((p as Record<string, unknown>)["cidr"] as string),
      ),
      ...add,
    ],
  };
  ctx.store.set(gatewayAssociationKey(associationId), updated);
  return { directConnectGatewayAssociation: updated };
};

const AcceptDirectConnectGatewayAssociationProposal: OperationHandler = (
  input,
  ctx,
) => {
  const directConnectGatewayId = requireString(input, "directConnectGatewayId");
  const proposalId = requireString(input, "proposalId");
  requireGateway(ctx, directConnectGatewayId);
  const proposal = requireGatewayAssociationProposal(ctx, proposalId);
  const associationId = newUuid();
  const overridePrefixes = Array.isArray(
    input["overrideAllowedPrefixesToDirectConnectGateway"],
  )
    ? (input["overrideAllowedPrefixesToDirectConnectGateway"] as unknown[])
    : (proposal.requestedAllowedPrefixesToDirectConnectGateway ?? []);
  const assoc: StoredGatewayAssociation = {
    associationId,
    directConnectGatewayId,
    directConnectGatewayOwnerAccount: ctx.account,
    associationState: "associated",
    associatedGateway: proposal.associatedGateway,
    allowedPrefixesToDirectConnectGateway: overridePrefixes,
  };
  ctx.store.set(gatewayAssociationKey(associationId), assoc);
  ctx.store.set(gatewayAssociationProposalKey(proposalId), {
    ...proposal,
    proposalState: "accepted",
  });
  return { directConnectGatewayAssociation: assoc };
};

const CreateDirectConnectGatewayAssociationProposal: OperationHandler = (
  input,
  ctx,
) => {
  const directConnectGatewayId = requireString(input, "directConnectGatewayId");
  const directConnectGatewayOwnerAccount = requireString(
    input,
    "directConnectGatewayOwnerAccount",
  );
  const gatewayId = requireString(input, "gatewayId");
  const proposalId = newUuid();
  const proposal: StoredGatewayAssociationProposal = {
    proposalId,
    directConnectGatewayId,
    directConnectGatewayOwnerAccount,
    proposalState: "requested",
    associatedGateway: {
      id: gatewayId,
      type: "transitGateway",
      ownerAccount: ctx.account,
      region: ctx.region,
    },
    requestedAllowedPrefixesToDirectConnectGateway: Array.isArray(
      input["addAllowedPrefixesToDirectConnectGateway"],
    )
      ? (input["addAllowedPrefixesToDirectConnectGateway"] as unknown[])
      : [],
  };
  ctx.store.set(gatewayAssociationProposalKey(proposalId), proposal);
  return { directConnectGatewayAssociationProposal: proposal };
};

const DeleteDirectConnectGatewayAssociationProposal: OperationHandler = (
  input,
  ctx,
) => {
  const proposalId = requireString(input, "proposalId");
  const proposal = requireGatewayAssociationProposal(ctx, proposalId);
  ctx.store.delete(gatewayAssociationProposalKey(proposalId));
  return {
    directConnectGatewayAssociationProposal: {
      ...proposal,
      proposalState: "deleted",
    },
  };
};

const DescribeDirectConnectGatewayAssociationProposals: OperationHandler = (
  input,
  ctx,
) => {
  const directConnectGatewayId = optionalString(
    input,
    "directConnectGatewayId",
  );
  let proposals = ctx.store
    .list<StoredGatewayAssociationProposal>()
    .filter((entry) => entry.key.startsWith("gatewayAssociationProposal/"))
    .map((entry) => entry.value);
  if (directConnectGatewayId !== undefined) {
    proposals = proposals.filter(
      (p) => p.directConnectGatewayId === directConnectGatewayId,
    );
  }
  return { directConnectGatewayAssociationProposals: proposals };
};

const DescribeDirectConnectGatewayAttachments: OperationHandler = (
  input,
  ctx,
) => {
  const directConnectGatewayId = optionalString(
    input,
    "directConnectGatewayId",
  );
  const virtualInterfaceId = optionalString(input, "virtualInterfaceId");
  let attachments = ctx.store
    .list<StoredVirtualInterface>()
    .filter((entry) => entry.key.startsWith("virtualInterface/"))
    .map((entry) => entry.value)
    .filter((vi) => vi.directConnectGatewayId !== undefined)
    .map((vi) => ({
      directConnectGatewayId: vi.directConnectGatewayId,
      virtualInterfaceId: vi.virtualInterfaceId,
      virtualInterfaceRegion: vi.region,
      virtualInterfaceOwnerAccount: vi.ownerAccount,
      attachmentState: "attached",
      attachmentType: vi.virtualInterfaceType,
    }));
  if (directConnectGatewayId !== undefined) {
    attachments = attachments.filter(
      (a) => a.directConnectGatewayId === directConnectGatewayId,
    );
  }
  if (virtualInterfaceId !== undefined) {
    attachments = attachments.filter(
      (a) => a.virtualInterfaceId === virtualInterfaceId,
    );
  }
  return { directConnectGatewayAttachments: attachments };
};

const DescribeLocations: OperationHandler = (_input, _ctx) => ({
  locations: [
    {
      locationCode: "EqDC2",
      locationName: "Equinix DC2, Ashburn, VA",
      region: "us-east-1",
      availablePortSpeeds: ["1Gbps", "10Gbps"],
      availableProviders: [],
      availableMacSecPortSpeeds: [],
    },
    {
      locationCode: "EqSY2",
      locationName: "Equinix SY2, Sydney",
      region: "ap-southeast-2",
      availablePortSpeeds: ["1Gbps", "10Gbps"],
      availableProviders: [],
      availableMacSecPortSpeeds: [],
    },
  ],
});

const DescribeCustomerMetadata: OperationHandler = (_input, _ctx) => ({
  agreements: [],
  nniPartnerType: "nonPartner",
});

const ConfirmCustomerAgreement: OperationHandler = (_input, _ctx) => ({
  status: "APPROVED",
});

const DescribeTags: OperationHandler = (input, ctx) => {
  const resourceArns = input["resourceArns"];
  if (!Array.isArray(resourceArns)) {
    throw awsError(
      "DirectConnectClientException",
      "resourceArns is required.",
      400,
    );
  }
  const resourceTags = (resourceArns as string[]).map((arn) => {
    const tags = ctx.store.get<unknown[]>(tagsKey(arn)) ?? [];
    return { resourceArn: arn, tags };
  });
  return { resourceTags };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const newTags = Array.isArray(input["tags"])
    ? (input["tags"] as unknown[])
    : [];
  const existing = ctx.store.get<unknown[]>(tagsKey(arn)) ?? [];
  ctx.store.set(tagsKey(arn), [...existing, ...newTags]);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing = ctx.store.get<unknown[]>(tagsKey(arn)) ?? [];
  const updated = existing.filter(
    (t) => !tagKeys.includes((t as Record<string, unknown>)["key"] as string),
  );
  ctx.store.set(tagsKey(arn), updated);
  return {};
};

const directconnect = {
  name: "directconnect",
  protocol: "json",
  operations: {
    AcceptDirectConnectGatewayAssociationProposal,
    AllocateConnectionOnInterconnect,
    AllocateHostedConnection,
    AllocatePrivateVirtualInterface,
    AllocatePublicVirtualInterface,
    AllocateTransitVirtualInterface,
    AssociateConnectionWithLag,
    AssociateHostedConnection,
    AssociateMacSecKey,
    AssociateVirtualInterface,
    ConfirmConnection,
    ConfirmCustomerAgreement,
    ConfirmPrivateVirtualInterface,
    ConfirmPublicVirtualInterface,
    ConfirmTransitVirtualInterface,
    CreateBGPPeer,
    CreateConnection,
    CreateDirectConnectGateway,
    CreateDirectConnectGatewayAssociation,
    CreateDirectConnectGatewayAssociationProposal,
    CreateInterconnect,
    CreateLag,
    CreatePrivateVirtualInterface,
    CreatePublicVirtualInterface,
    CreateTransitVirtualInterface,
    DeleteBGPPeer,
    DeleteConnection,
    DeleteDirectConnectGateway,
    DeleteDirectConnectGatewayAssociation,
    DeleteDirectConnectGatewayAssociationProposal,
    DeleteInterconnect,
    DeleteLag,
    DeleteVirtualInterface,
    DescribeConnectionLoa,
    DescribeConnections,
    DescribeConnectionsOnInterconnect,
    DescribeCustomerMetadata,
    DescribeDirectConnectGatewayAssociationProposals,
    DescribeDirectConnectGatewayAssociations,
    DescribeDirectConnectGatewayAttachments,
    DescribeDirectConnectGateways,
    DescribeHostedConnections,
    DescribeInterconnectLoa,
    DescribeInterconnects,
    DescribeLags,
    DescribeLoa,
    DescribeLocations,
    DescribeRouterConfiguration,
    DescribeTags,
    DescribeVirtualGateways,
    DescribeVirtualInterfaces,
    DisassociateConnectionFromLag,
    DisassociateMacSecKey,
    ListVirtualInterfaceTestHistory,
    StartBgpFailoverTest,
    StopBgpFailoverTest,
    TagResource,
    UntagResource,
    UpdateConnection,
    UpdateDirectConnectGateway,
    UpdateDirectConnectGatewayAssociation,
    UpdateLag,
    UpdateVirtualInterfaceAttributes,
  },
  model,
} as const satisfies ServiceDefinition;

export default directconnect;
