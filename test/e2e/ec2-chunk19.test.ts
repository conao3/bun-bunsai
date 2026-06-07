import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTransitGatewayCommand,
  CreateTransitGatewayRouteTableCommand,
  CreateTransitGatewayRouteCommand,
  DeleteTransitGatewayRouteTableCommand,
  DeleteTransitGatewayRouteCommand,
  DeleteTransitGatewayConnectCommand,
  DeleteTransitGatewayConnectPeerCommand,
  DeleteTransitGatewayMeteringPolicyCommand,
  DeleteTransitGatewayMulticastDomainCommand,
  DeleteTransitGatewayPeeringAttachmentCommand,
  DeleteTransitGatewayPolicyTableCommand,
  CreateTransitGatewayConnectCommand,
  CreateTransitGatewayConnectPeerCommand,
  CreateTransitGatewayMeteringPolicyCommand,
  CreateTransitGatewayMulticastDomainCommand,
  CreateTransitGatewayPeeringAttachmentCommand,
  CreateTransitGatewayPolicyTableCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk19 delete transit-gateway family e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("route-table: create → delete → state deleted; delete non-existent → InvalidTransitGatewayRouteTableID.NotFound", async () => {
    const client = ec2();

    const tgwRes = await client.send(
      new CreateTransitGatewayCommand({ Description: "chunk19-tgw" }),
    );
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";
    expect(tgwId.startsWith("tgw-")).toBe(true);

    const rtbRes = await client.send(
      new CreateTransitGatewayRouteTableCommand({
        TransitGatewayId: tgwId,
      }),
    );
    const rtbId =
      rtbRes.TransitGatewayRouteTable?.TransitGatewayRouteTableId ?? "";
    expect(rtbId.startsWith("tgw-rtb-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteTransitGatewayRouteTableCommand({
        TransitGatewayRouteTableId: rtbId,
      }),
    );
    expect(deleteRes.TransitGatewayRouteTable?.State).toBe("deleted");
    expect(deleteRes.TransitGatewayRouteTable?.TransitGatewayRouteTableId).toBe(
      rtbId,
    );

    const err = await client
      .send(
        new DeleteTransitGatewayRouteTableCommand({
          TransitGatewayRouteTableId: rtbId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayRouteTableID.NotFound",
    );
  });

  test("route: create → delete → state deleted; delete non-existent → InvalidRoute.NotFound", async () => {
    const client = ec2();

    const tgwRes = await client.send(
      new CreateTransitGatewayCommand({ Description: "chunk19-route-tgw" }),
    );
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const rtbRes = await client.send(
      new CreateTransitGatewayRouteTableCommand({ TransitGatewayId: tgwId }),
    );
    const rtbId =
      rtbRes.TransitGatewayRouteTable?.TransitGatewayRouteTableId ?? "";

    const routeRes = await client.send(
      new CreateTransitGatewayRouteCommand({
        TransitGatewayRouteTableId: rtbId,
        DestinationCidrBlock: "10.99.0.0/16",
      }),
    );
    expect(routeRes.Route?.DestinationCidrBlock).toBe("10.99.0.0/16");

    const delRouteRes = await client.send(
      new DeleteTransitGatewayRouteCommand({
        TransitGatewayRouteTableId: rtbId,
        DestinationCidrBlock: "10.99.0.0/16",
      }),
    );
    expect(delRouteRes.Route?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayRouteCommand({
          TransitGatewayRouteTableId: rtbId,
          DestinationCidrBlock: "10.99.0.0/16",
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("InvalidRoute.NotFound");
  });

  test("connect: create → delete → state deleted; delete non-existent → InvalidTransitGatewayAttachmentID.NotFound", async () => {
    const client = ec2();

    const connectRes = await client.send(
      new CreateTransitGatewayConnectCommand({
        TransportTransitGatewayAttachmentId: "tgw-attach-00000001",
        Options: { Protocol: "gre" },
      }),
    );
    const connectId =
      connectRes.TransitGatewayConnect?.TransitGatewayAttachmentId ?? "";
    expect(connectId.startsWith("tgw-attach-")).toBe(true);

    const delRes = await client.send(
      new DeleteTransitGatewayConnectCommand({
        TransitGatewayAttachmentId: connectId,
      }),
    );
    expect(delRes.TransitGatewayConnect?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayConnectCommand({
          TransitGatewayAttachmentId: connectId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayAttachmentID.NotFound",
    );
  });

  test("connect-peer: create → delete → state deleted; delete non-existent → InvalidTransitGatewayConnectPeerID.NotFound", async () => {
    const client = ec2();

    const peerRes = await client.send(
      new CreateTransitGatewayConnectPeerCommand({
        TransitGatewayAttachmentId: "tgw-attach-00000002",
        PeerAddress: "169.254.6.2",
        InsideCidrBlocks: ["169.254.6.0/29"],
      }),
    );
    const peerId =
      peerRes.TransitGatewayConnectPeer?.TransitGatewayConnectPeerId ?? "";
    expect(peerId.startsWith("tgw-connect-peer-")).toBe(true);

    const delRes = await client.send(
      new DeleteTransitGatewayConnectPeerCommand({
        TransitGatewayConnectPeerId: peerId,
      }),
    );
    expect(delRes.TransitGatewayConnectPeer?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayConnectPeerCommand({
          TransitGatewayConnectPeerId: peerId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayConnectPeerID.NotFound",
    );
  });

  test("metering-policy: create → delete → state deleted; delete non-existent → InvalidTransitGatewayMeteringPolicyID.NotFound", async () => {
    const client = ec2();

    const tgwRes = await client.send(
      new CreateTransitGatewayCommand({ Description: "chunk19-metering-tgw" }),
    );
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const policyRes = await client.send(
      new CreateTransitGatewayMeteringPolicyCommand({
        TransitGatewayId: tgwId,
      }),
    );
    const policyId =
      policyRes.TransitGatewayMeteringPolicy?.TransitGatewayMeteringPolicyId ??
      "";
    expect(policyId.startsWith("tgw-metering-policy-")).toBe(true);

    const delRes = await client.send(
      new DeleteTransitGatewayMeteringPolicyCommand({
        TransitGatewayMeteringPolicyId: policyId,
      }),
    );
    expect(delRes.TransitGatewayMeteringPolicy?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayMeteringPolicyCommand({
          TransitGatewayMeteringPolicyId: policyId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayMeteringPolicyID.NotFound",
    );
  });

  test("multicast-domain: create → delete → state deleted; delete non-existent → InvalidTransitGatewayMulticastDomainId.NotFound", async () => {
    const client = ec2();

    const domainRes = await client.send(
      new CreateTransitGatewayMulticastDomainCommand({
        TransitGatewayId: "tgw-00000001",
      }),
    );
    const domainId =
      domainRes.TransitGatewayMulticastDomain
        ?.TransitGatewayMulticastDomainId ?? "";
    expect(domainId.startsWith("tgw-mcast-")).toBe(true);

    const delRes = await client.send(
      new DeleteTransitGatewayMulticastDomainCommand({
        TransitGatewayMulticastDomainId: domainId,
      }),
    );
    expect(delRes.TransitGatewayMulticastDomain?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayMulticastDomainCommand({
          TransitGatewayMulticastDomainId: domainId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayMulticastDomainId.NotFound",
    );
  });

  test("peering-attachment: create → delete → state deleted; delete non-existent → InvalidTransitGatewayAttachmentID.NotFound", async () => {
    const client = ec2();

    const peeringRes = await client.send(
      new CreateTransitGatewayPeeringAttachmentCommand({
        TransitGatewayId: "tgw-00000002",
        PeerTransitGatewayId: "tgw-00000003",
        PeerAccountId: "123456789012",
        PeerRegion: "us-west-2",
      }),
    );
    const peeringId =
      peeringRes.TransitGatewayPeeringAttachment?.TransitGatewayAttachmentId ??
      "";
    expect(peeringId.startsWith("tgw-attach-")).toBe(true);

    const delRes = await client.send(
      new DeleteTransitGatewayPeeringAttachmentCommand({
        TransitGatewayAttachmentId: peeringId,
      }),
    );
    expect(delRes.TransitGatewayPeeringAttachment?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayPeeringAttachmentCommand({
          TransitGatewayAttachmentId: peeringId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayAttachmentID.NotFound",
    );
  });

  test("policy-table: create → delete → state deleted; delete non-existent → InvalidTransitGatewayPolicyTableID.NotFound", async () => {
    const client = ec2();

    const tableRes = await client.send(
      new CreateTransitGatewayPolicyTableCommand({
        TransitGatewayId: "tgw-00000004",
      }),
    );
    const tableId =
      tableRes.TransitGatewayPolicyTable?.TransitGatewayPolicyTableId ?? "";
    expect(tableId.startsWith("tgw-pt-")).toBe(true);

    const delRes = await client.send(
      new DeleteTransitGatewayPolicyTableCommand({
        TransitGatewayPolicyTableId: tableId,
      }),
    );
    expect(delRes.TransitGatewayPolicyTable?.State).toBe("deleted");

    const err = await client
      .send(
        new DeleteTransitGatewayPolicyTableCommand({
          TransitGatewayPolicyTableId: tableId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayPolicyTableID.NotFound",
    );
  });
});
