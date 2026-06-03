import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ConfirmConnectionCommand,
  CreateBGPPeerCommand,
  CreateConnectionCommand,
  CreateDirectConnectGatewayAssociationCommand,
  CreateDirectConnectGatewayAssociationProposalCommand,
  CreateDirectConnectGatewayCommand,
  CreateInterconnectCommand,
  CreateLagCommand,
  CreatePrivateVirtualInterfaceCommand,
  CreatePublicVirtualInterfaceCommand,
  CreateTransitVirtualInterfaceCommand,
  DeleteBGPPeerCommand,
  DeleteConnectionCommand,
  DeleteDirectConnectGatewayAssociationCommand,
  DeleteDirectConnectGatewayAssociationProposalCommand,
  DeleteDirectConnectGatewayCommand,
  DeleteInterconnectCommand,
  DeleteLagCommand,
  DeleteVirtualInterfaceCommand,
  DescribeConnectionLoaCommand,
  DescribeConnectionsCommand,
  DescribeConnectionsOnInterconnectCommand,
  DescribeCustomerMetadataCommand,
  DescribeDirectConnectGatewayAssociationProposalsCommand,
  DescribeDirectConnectGatewayAssociationsCommand,
  DescribeDirectConnectGatewayAttachmentsCommand,
  DescribeDirectConnectGatewaysCommand,
  DescribeHostedConnectionsCommand,
  DescribeInterconnectLoaCommand,
  DescribeInterconnectsCommand,
  DescribeLagsCommand,
  DescribeLoaCommand,
  DescribeLocationsCommand,
  DescribeRouterConfigurationCommand,
  DescribeTagsCommand,
  DescribeVirtualGatewaysCommand,
  DescribeVirtualInterfacesCommand,
  DirectConnectClient,
  ListVirtualInterfaceTestHistoryCommand,
  StartBgpFailoverTestCommand,
  StopBgpFailoverTestCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateConnectionCommand,
  UpdateDirectConnectGatewayAssociationCommand,
  UpdateDirectConnectGatewayCommand,
  UpdateLagCommand,
  UpdateVirtualInterfaceAttributesCommand,
} from "@aws-sdk/client-direct-connect";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const directconnect = () =>
  new DirectConnectClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("DirectConnect connection lifecycle", async () => {
  const client = directconnect();

  const created = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "bunsai-e2e-connection",
    }),
  );
  expect(created.connectionId).toMatch(/^dxcon-/);
  expect(created.connectionName).toBe("bunsai-e2e-connection");
  expect(created.connectionState).toBe("available");
  expect(created.location).toBe("EqDC2");
  expect(created.bandwidth).toBe("1Gbps");
  const connectionId = created.connectionId;
  expect(connectionId).toBeDefined();

  const described = await client.send(
    new DescribeConnectionsCommand({ connectionId }),
  );
  const ids = (described.connections ?? []).map((entry) => entry.connectionId);
  expect(ids).toContain(connectionId);

  const deleted = await client.send(
    new DeleteConnectionCommand({ connectionId: connectionId! }),
  );
  expect(deleted.connectionId).toBe(connectionId);
  expect(deleted.connectionState).toBe("deleted");

  const afterDelete = await client.send(new DescribeConnectionsCommand({}));
  const remaining = (afterDelete.connections ?? []).map(
    (entry) => entry.connectionId,
  );
  expect(remaining).not.toContain(connectionId);
});

test("DirectConnect connection update and confirm", async () => {
  const client = directconnect();

  const created = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "e2e-update-connection",
    }),
  );
  const connectionId = created.connectionId!;

  const updated = await client.send(
    new UpdateConnectionCommand({
      connectionId,
      connectionName: "e2e-updated-name",
    }),
  );
  expect(updated.connectionName).toBe("e2e-updated-name");

  const confirmed = await client.send(
    new ConfirmConnectionCommand({ connectionId }),
  );
  expect(confirmed.connectionState).toBe("available");

  await client.send(new DeleteConnectionCommand({ connectionId }));
});

test("DirectConnect interconnect lifecycle", async () => {
  const client = directconnect();

  const created = await client.send(
    new CreateInterconnectCommand({
      interconnectName: "e2e-interconnect",
      bandwidth: "1Gbps",
      location: "EqDC2",
    }),
  );
  expect(created.interconnectId).toMatch(/^dxcon-/);
  expect(created.interconnectName).toBe("e2e-interconnect");
  const interconnectId = created.interconnectId!;

  const described = await client.send(
    new DescribeInterconnectsCommand({ interconnectId }),
  );
  expect(described.interconnects).toHaveLength(1);
  expect(described.interconnects![0].interconnectId).toBe(interconnectId);

  const loa = await client.send(
    new DescribeInterconnectLoaCommand({ interconnectId }),
  );
  expect(loa.loa?.loaContent).toBeDefined();

  const onInterconnect = await client.send(
    new DescribeConnectionsOnInterconnectCommand({ interconnectId }),
  );
  expect(Array.isArray(onInterconnect.connections)).toBe(true);

  const deleted = await client.send(
    new DeleteInterconnectCommand({ interconnectId }),
  );
  expect(deleted.interconnectState).toBe("deleted");
});

test("DirectConnect LAG lifecycle", async () => {
  const client = directconnect();

  const created = await client.send(
    new CreateLagCommand({
      numberOfConnections: 1,
      location: "EqDC2",
      connectionsBandwidth: "1Gbps",
      lagName: "e2e-lag",
    }),
  );
  expect(created.lagId).toMatch(/^dxlag-/);
  expect(created.lagName).toBe("e2e-lag");
  const lagId = created.lagId!;

  const described = await client.send(new DescribeLagsCommand({ lagId }));
  expect(described.lags).toHaveLength(1);
  expect(described.lags![0].lagId).toBe(lagId);

  const updated = await client.send(
    new UpdateLagCommand({ lagId, lagName: "e2e-lag-updated" }),
  );
  expect(updated.lagName).toBe("e2e-lag-updated");

  const deleted = await client.send(new DeleteLagCommand({ lagId }));
  expect(deleted.lagId).toBe(lagId);
  expect(deleted.lagState).toBe("deleted");
});

test("DirectConnect virtual interface lifecycle", async () => {
  const client = directconnect();

  const conn = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "e2e-vi-conn",
    }),
  );
  const connectionId = conn.connectionId!;

  const privateVi = await client.send(
    new CreatePrivateVirtualInterfaceCommand({
      connectionId,
      newPrivateVirtualInterface: {
        virtualInterfaceName: "e2e-private-vi",
        vlan: 100,
        asn: 65000,
      },
    }),
  );
  expect(privateVi.virtualInterfaceId).toMatch(/^dxvif-/);
  expect(privateVi.virtualInterfaceType).toBe("private");
  const privateViId = privateVi.virtualInterfaceId!;

  const publicVi = await client.send(
    new CreatePublicVirtualInterfaceCommand({
      connectionId,
      newPublicVirtualInterface: {
        virtualInterfaceName: "e2e-public-vi",
        vlan: 200,
        asn: 65001,
      },
    }),
  );
  expect(publicVi.virtualInterfaceType).toBe("public");

  const transitVi = await client.send(
    new CreateTransitVirtualInterfaceCommand({
      connectionId,
      newTransitVirtualInterface: {
        virtualInterfaceName: "e2e-transit-vi",
        vlan: 300,
        asn: 65002,
      },
    }),
  );
  expect(transitVi.virtualInterface?.virtualInterfaceType).toBe("transit");

  const described = await client.send(
    new DescribeVirtualInterfacesCommand({ connectionId }),
  );
  const viIds = (described.virtualInterfaces ?? []).map(
    (v) => v.virtualInterfaceId,
  );
  expect(viIds).toContain(privateViId);

  const updated = await client.send(
    new UpdateVirtualInterfaceAttributesCommand({
      virtualInterfaceId: privateViId,
      mtu: 9001,
    }),
  );
  expect(updated.mtu).toBe(9001);

  const routerConfig = await client.send(
    new DescribeRouterConfigurationCommand({
      virtualInterfaceId: privateViId,
    }),
  );
  expect(routerConfig.virtualInterfaceId).toBe(privateViId);

  const deleted = await client.send(
    new DeleteVirtualInterfaceCommand({ virtualInterfaceId: privateViId }),
  );
  expect(deleted.virtualInterfaceState).toBeDefined();

  await client.send(new DeleteConnectionCommand({ connectionId }));
});

test("DirectConnect BGP peer lifecycle", async () => {
  const client = directconnect();

  const conn = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "e2e-bgp-conn",
    }),
  );
  const connectionId = conn.connectionId!;

  const vi = await client.send(
    new CreatePrivateVirtualInterfaceCommand({
      connectionId,
      newPrivateVirtualInterface: {
        virtualInterfaceName: "e2e-bgp-vi",
        vlan: 400,
        asn: 65100,
      },
    }),
  );
  const virtualInterfaceId = vi.virtualInterfaceId!;

  const created = await client.send(
    new CreateBGPPeerCommand({
      virtualInterfaceId,
      newBGPPeer: { asn: 65200, addressFamily: "ipv4" },
    }),
  );
  const bgpPeers = created.virtualInterface?.bgpPeers ?? [];
  expect(bgpPeers.length).toBeGreaterThan(1);
  const bgpPeerId = bgpPeers[bgpPeers.length - 1].bgpPeerId!;

  const deleted = await client.send(
    new DeleteBGPPeerCommand({ virtualInterfaceId, bgpPeerId }),
  );
  expect(deleted.virtualInterface?.virtualInterfaceId).toBe(virtualInterfaceId);

  await client.send(new DeleteConnectionCommand({ connectionId }));
});

test("DirectConnect gateway lifecycle", async () => {
  const client = directconnect();

  const created = await client.send(
    new CreateDirectConnectGatewayCommand({
      directConnectGatewayName: "e2e-gateway",
      amazonSideAsn: 64512,
    }),
  );
  expect(created.directConnectGateway?.directConnectGatewayId).toBeDefined();
  const directConnectGatewayId =
    created.directConnectGateway!.directConnectGatewayId!;

  const described = await client.send(
    new DescribeDirectConnectGatewaysCommand({ directConnectGatewayId }),
  );
  expect(described.directConnectGateways).toHaveLength(1);

  const updated = await client.send(
    new UpdateDirectConnectGatewayCommand({
      directConnectGatewayId,
      newDirectConnectGatewayName: "e2e-gateway-updated",
    }),
  );
  expect(updated.directConnectGateway?.directConnectGatewayName).toBe(
    "e2e-gateway-updated",
  );

  const deleted = await client.send(
    new DeleteDirectConnectGatewayCommand({ directConnectGatewayId }),
  );
  expect(deleted.directConnectGateway?.directConnectGatewayState).toBe(
    "deleted",
  );
});

test("DirectConnect gateway association lifecycle", async () => {
  const client = directconnect();

  const gw = await client.send(
    new CreateDirectConnectGatewayCommand({
      directConnectGatewayName: "e2e-assoc-gateway",
    }),
  );
  const directConnectGatewayId =
    gw.directConnectGateway!.directConnectGatewayId!;

  const assoc = await client.send(
    new CreateDirectConnectGatewayAssociationCommand({
      directConnectGatewayId,
      gatewayId: "tgw-12345678",
      addAllowedPrefixesToDirectConnectGateway: [{ cidr: "10.0.0.0/8" }],
    }),
  );
  const associationId = assoc.directConnectGatewayAssociation!.associationId!;
  expect(assoc.directConnectGatewayAssociation?.associationState).toBe(
    "associated",
  );

  const described = await client.send(
    new DescribeDirectConnectGatewayAssociationsCommand({
      directConnectGatewayId,
    }),
  );
  expect(described.directConnectGatewayAssociations).toHaveLength(1);

  const attachments = await client.send(
    new DescribeDirectConnectGatewayAttachmentsCommand({
      directConnectGatewayId,
    }),
  );
  expect(Array.isArray(attachments.directConnectGatewayAttachments)).toBe(true);

  const updated = await client.send(
    new UpdateDirectConnectGatewayAssociationCommand({
      associationId,
      addAllowedPrefixesToDirectConnectGateway: [{ cidr: "192.168.0.0/16" }],
    }),
  );
  expect(
    updated.directConnectGatewayAssociation
      ?.allowedPrefixesToDirectConnectGateway?.length,
  ).toBeGreaterThan(0);

  const deleted = await client.send(
    new DeleteDirectConnectGatewayAssociationCommand({ associationId }),
  );
  expect(deleted.directConnectGatewayAssociation?.associationState).toBe(
    "disassociated",
  );

  await client.send(
    new DeleteDirectConnectGatewayCommand({ directConnectGatewayId }),
  );
});

test("DirectConnect gateway association proposal lifecycle", async () => {
  const client = directconnect();

  const gw = await client.send(
    new CreateDirectConnectGatewayCommand({
      directConnectGatewayName: "e2e-proposal-gateway",
    }),
  );
  const directConnectGatewayId =
    gw.directConnectGateway!.directConnectGatewayId!;

  const proposal = await client.send(
    new CreateDirectConnectGatewayAssociationProposalCommand({
      directConnectGatewayId,
      directConnectGatewayOwnerAccount: "123456789012",
      gatewayId: "tgw-abcdef01",
      addAllowedPrefixesToDirectConnectGateway: [{ cidr: "172.16.0.0/12" }],
    }),
  );
  const proposalId =
    proposal.directConnectGatewayAssociationProposal!.proposalId!;
  expect(proposal.directConnectGatewayAssociationProposal?.proposalState).toBe(
    "requested",
  );

  const described = await client.send(
    new DescribeDirectConnectGatewayAssociationProposalsCommand({
      directConnectGatewayId,
    }),
  );
  expect(described.directConnectGatewayAssociationProposals).toHaveLength(1);

  const deleted = await client.send(
    new DeleteDirectConnectGatewayAssociationProposalCommand({ proposalId }),
  );
  expect(deleted.directConnectGatewayAssociationProposal?.proposalState).toBe(
    "deleted",
  );

  await client.send(
    new DeleteDirectConnectGatewayCommand({ directConnectGatewayId }),
  );
});

test("DirectConnect LOA and locations", async () => {
  const client = directconnect();

  const conn = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "e2e-loa-conn",
    }),
  );
  const connectionId = conn.connectionId!;

  const loa = await client.send(new DescribeLoaCommand({ connectionId }));
  expect(loa.loaContent).toBeDefined();
  expect(loa.loaContentType).toBe("application/pdf");

  const connLoa = await client.send(
    new DescribeConnectionLoaCommand({ connectionId }),
  );
  expect(connLoa.loa?.loaContent).toBeDefined();

  const locations = await client.send(new DescribeLocationsCommand({}));
  expect(locations.locations?.length).toBeGreaterThan(0);
  expect(locations.locations![0].locationCode).toBeDefined();

  await client.send(new DeleteConnectionCommand({ connectionId }));
});

test("DirectConnect tags", async () => {
  const client = directconnect();

  const arn =
    "arn:aws:directconnect:us-east-1:123456789012:dxcon/dxcon-e2etest01";

  await client.send(
    new TagResourceCommand({
      resourceArn: arn,
      tags: [{ key: "env", value: "test" }],
    }),
  );

  const described = await client.send(
    new DescribeTagsCommand({ resourceArns: [arn] }),
  );
  expect(described.resourceTags).toHaveLength(1);
  expect(described.resourceTags![0].tags?.length).toBeGreaterThan(0);

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new DescribeTagsCommand({ resourceArns: [arn] }),
  );
  const remaining = (afterUntag.resourceTags?.[0].tags ?? []).filter(
    (t) => t.key === "env",
  );
  expect(remaining).toHaveLength(0);
});

test("DirectConnect hosted connections", async () => {
  const client = directconnect();

  const conn = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "e2e-hosted-parent",
    }),
  );
  const connectionId = conn.connectionId!;

  const hosted = await client.send(
    new DescribeHostedConnectionsCommand({ connectionId }),
  );
  expect(Array.isArray(hosted.connections)).toBe(true);

  await client.send(new DeleteConnectionCommand({ connectionId }));
});

test("DirectConnect virtual gateways and customer metadata", async () => {
  const client = directconnect();

  const vgws = await client.send(new DescribeVirtualGatewaysCommand({}));
  expect(Array.isArray(vgws.virtualGateways)).toBe(true);

  const meta = await client.send(new DescribeCustomerMetadataCommand({}));
  expect(Array.isArray(meta.agreements)).toBe(true);
});

test("DirectConnect BGP failover test", async () => {
  const client = directconnect();

  const conn = await client.send(
    new CreateConnectionCommand({
      location: "EqDC2",
      bandwidth: "1Gbps",
      connectionName: "e2e-failover-conn",
    }),
  );
  const connectionId = conn.connectionId!;

  const vi = await client.send(
    new CreatePrivateVirtualInterfaceCommand({
      connectionId,
      newPrivateVirtualInterface: {
        virtualInterfaceName: "e2e-failover-vi",
        vlan: 500,
        asn: 65300,
      },
    }),
  );
  const virtualInterfaceId = vi.virtualInterfaceId!;

  const started = await client.send(
    new StartBgpFailoverTestCommand({ virtualInterfaceId }),
  );
  expect(started.virtualInterfaceTest?.status).toBe("IN_PROGRESS");

  const stopped = await client.send(
    new StopBgpFailoverTestCommand({ virtualInterfaceId }),
  );
  expect(stopped.virtualInterfaceTest?.status).toBe("COMPLETED");

  const history = await client.send(
    new ListVirtualInterfaceTestHistoryCommand({ virtualInterfaceId }),
  );
  expect(Array.isArray(history.virtualInterfaceTestHistory)).toBe(true);

  await client.send(new DeleteConnectionCommand({ connectionId }));
});
