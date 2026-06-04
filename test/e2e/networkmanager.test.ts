import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  AcceptAttachmentCommand,
  AssociateLinkCommand,
  CreateConnectAttachmentCommand,
  CreateConnectPeerCommand,
  CreateConnectionCommand,
  CreateCoreNetworkCommand,
  CreateDeviceCommand,
  CreateGlobalNetworkCommand,
  CreateLinkCommand,
  CreateSiteCommand,
  CreateVpcAttachmentCommand,
  DeleteGlobalNetworkCommand,
  DescribeGlobalNetworksCommand,
  DisassociateLinkCommand,
  GetConnectPeerCommand,
  GetConnectionsCommand,
  GetCoreNetworkCommand,
  GetDevicesCommand,
  GetLinkAssociationsCommand,
  GetLinksCommand,
  GetSitesCommand,
  GetVpcAttachmentCommand,
  ListAttachmentsCommand,
  ListCoreNetworksCommand,
  ListTagsForResourceCommand,
  NetworkManagerClient,
  PutCoreNetworkPolicyCommand,
  TagResourceCommand,
} from "@aws-sdk/client-networkmanager";

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

const networkmanager = () =>
  new NetworkManagerClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("NetworkManager global network roundtrip", async () => {
  const client = networkmanager();

  const created = await client.send(
    new CreateGlobalNetworkCommand({
      Description: "bunsai-e2e",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const id = created.GlobalNetwork?.GlobalNetworkId;
  expect(id).toBeDefined();
  expect(created.GlobalNetwork?.GlobalNetworkArn).toContain("global-network/");
  expect(created.GlobalNetwork?.State).toBe("AVAILABLE");

  const described = await client.send(
    new DescribeGlobalNetworksCommand({ GlobalNetworkIds: [id ?? ""] }),
  );
  expect(
    described.GlobalNetworks?.some((network) => network.GlobalNetworkId === id),
  ).toBe(true);

  const deleted = await client.send(
    new DeleteGlobalNetworkCommand({ GlobalNetworkId: id ?? "" }),
  );
  expect(deleted.GlobalNetwork?.GlobalNetworkId).toBe(id);
  expect(deleted.GlobalNetwork?.State).toBe("DELETING");

  const after = await client.send(new DescribeGlobalNetworksCommand({}));
  expect(
    after.GlobalNetworks?.some((network) => network.GlobalNetworkId === id),
  ).toBe(false);
});

test("NetworkManager site lifecycle", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "site-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const site = await client.send(
    new CreateSiteCommand({
      GlobalNetworkId: gid,
      Description: "HQ",
      Tags: [{ Key: "role", Value: "hq" }],
    }),
  );
  const sid = site.Site?.SiteId;
  expect(sid).toBeDefined();
  expect(site.Site?.State).toBe("AVAILABLE");

  const listed = await client.send(
    new GetSitesCommand({ GlobalNetworkId: gid }),
  );
  expect(listed.Sites?.some((s) => s.SiteId === sid)).toBe(true);

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager device lifecycle", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "device-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const site = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site" }),
  );
  const sid = site.Site?.SiteId ?? "";

  const device = await client.send(
    new CreateDeviceCommand({
      GlobalNetworkId: gid,
      Description: "router-1",
      SiteId: sid,
      Type: "router",
    }),
  );
  const did = device.Device?.DeviceId;
  expect(did).toBeDefined();
  expect(device.Device?.State).toBe("AVAILABLE");

  const listed = await client.send(
    new GetDevicesCommand({ GlobalNetworkId: gid }),
  );
  expect(listed.Devices?.some((d) => d.DeviceId === did)).toBe(true);

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager link and association lifecycle", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "link-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const site = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site" }),
  );
  const sid = site.Site?.SiteId ?? "";

  const device = await client.send(
    new CreateDeviceCommand({ GlobalNetworkId: gid, SiteId: sid }),
  );
  const did = device.Device?.DeviceId ?? "";

  const link = await client.send(
    new CreateLinkCommand({
      GlobalNetworkId: gid,
      SiteId: sid,
      Type: "broadband",
      Bandwidth: { UploadSpeed: 100, DownloadSpeed: 100 },
    }),
  );
  const lid = link.Link?.LinkId;
  expect(lid).toBeDefined();
  expect(link.Link?.State).toBe("AVAILABLE");

  const links = await client.send(
    new GetLinksCommand({ GlobalNetworkId: gid }),
  );
  expect(links.Links?.some((l) => l.LinkId === lid)).toBe(true);

  await client.send(
    new AssociateLinkCommand({
      GlobalNetworkId: gid,
      DeviceId: did,
      LinkId: lid ?? "",
    }),
  );
  const assocs = await client.send(
    new GetLinkAssociationsCommand({ GlobalNetworkId: gid }),
  );
  expect(
    assocs.LinkAssociations?.some(
      (a) => a.DeviceId === did && a.LinkId === lid,
    ),
  ).toBe(true);

  await client.send(
    new DisassociateLinkCommand({
      GlobalNetworkId: gid,
      DeviceId: did,
      LinkId: lid ?? "",
    }),
  );

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager connection lifecycle", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "conn-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const d1 = await client.send(
    new CreateDeviceCommand({ GlobalNetworkId: gid }),
  );
  const d2 = await client.send(
    new CreateDeviceCommand({ GlobalNetworkId: gid }),
  );

  const conn = await client.send(
    new CreateConnectionCommand({
      GlobalNetworkId: gid,
      DeviceId: d1.Device?.DeviceId ?? "",
      ConnectedDeviceId: d2.Device?.DeviceId ?? "",
      Description: "peering",
    }),
  );
  const cid = conn.Connection?.ConnectionId;
  expect(cid).toBeDefined();
  expect(conn.Connection?.State).toBe("AVAILABLE");

  const listed = await client.send(
    new GetConnectionsCommand({ GlobalNetworkId: gid }),
  );
  expect(listed.Connections?.some((c) => c.ConnectionId === cid)).toBe(true);

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager core network create/get/policy", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "cn-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const cn = await client.send(
    new CreateCoreNetworkCommand({
      GlobalNetworkId: gid,
      Description: "core",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const cnId = cn.CoreNetwork?.CoreNetworkId;
  expect(cnId).toBeDefined();
  expect(cn.CoreNetwork?.State).toBe("AVAILABLE");

  const fetched = await client.send(
    new GetCoreNetworkCommand({ CoreNetworkId: cnId ?? "" }),
  );
  expect(fetched.CoreNetwork?.CoreNetworkId).toBe(cnId);

  const listed = await client.send(new ListCoreNetworksCommand({}));
  expect(listed.CoreNetworks?.some((c) => c.CoreNetworkId === cnId)).toBe(true);

  const policy = await client.send(
    new PutCoreNetworkPolicyCommand({
      CoreNetworkId: cnId ?? "",
      PolicyDocument: JSON.stringify({ version: "2021.12" }),
    }),
  );
  expect(policy.CoreNetworkPolicy?.PolicyVersionId).toBeDefined();

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager VPC attachment create/accept/get", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "att-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const cn = await client.send(
    new CreateCoreNetworkCommand({ GlobalNetworkId: gid }),
  );
  const cnId = cn.CoreNetwork?.CoreNetworkId ?? "";

  const att = await client.send(
    new CreateVpcAttachmentCommand({
      CoreNetworkId: cnId,
      VpcArn: "arn:aws:ec2:us-east-1:123:vpc/vpc-test",
      SubnetArns: ["arn:aws:ec2:us-east-1:123:subnet/subnet-a"],
    }),
  );
  const attId = att.VpcAttachment?.Attachment?.AttachmentId;
  expect(attId).toBeDefined();
  expect(att.VpcAttachment?.Attachment?.State).toBe("CREATING");

  const accepted = await client.send(
    new AcceptAttachmentCommand({ AttachmentId: attId ?? "" }),
  );
  expect(accepted.Attachment?.State).toBe("AVAILABLE");

  const fetched = await client.send(
    new GetVpcAttachmentCommand({ AttachmentId: attId ?? "" }),
  );
  expect(fetched.VpcAttachment?.Attachment?.AttachmentId).toBe(attId);

  const allAtts = await client.send(new ListAttachmentsCommand({}));
  expect(allAtts.Attachments?.some((a) => a.AttachmentId === attId)).toBe(true);

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager connect peer lifecycle", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "cp-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const cn = await client.send(
    new CreateCoreNetworkCommand({ GlobalNetworkId: gid }),
  );
  const cnId = cn.CoreNetwork?.CoreNetworkId ?? "";

  const vpcAtt = await client.send(
    new CreateVpcAttachmentCommand({
      CoreNetworkId: cnId,
      VpcArn: "arn:aws:ec2:us-east-1:123:vpc/vpc-cp-test",
      SubnetArns: ["arn:aws:ec2:us-east-1:123:subnet/subnet-cp"],
    }),
  );
  const transportAttId = vpcAtt.VpcAttachment?.Attachment?.AttachmentId ?? "";

  const connectAtt = await client.send(
    new CreateConnectAttachmentCommand({
      CoreNetworkId: cnId,
      EdgeLocation: "us-east-1",
      TransportAttachmentId: transportAttId,
      Options: { Protocol: "GRE" },
    }),
  );
  const connectAttId =
    connectAtt.ConnectAttachment?.Attachment?.AttachmentId ?? "";

  const cp = await client.send(
    new CreateConnectPeerCommand({
      ConnectAttachmentId: connectAttId,
      PeerAddress: "10.0.0.1",
      InsideCidrBlocks: ["169.254.6.0/29"],
    }),
  );
  const cpId = cp.ConnectPeer?.ConnectPeerId;
  expect(cpId).toBeDefined();
  expect(cp.ConnectPeer?.State).toBe("CREATING");

  const fetched = await client.send(
    new GetConnectPeerCommand({ ConnectPeerId: cpId ?? "" }),
  );
  expect(fetched.ConnectPeer?.ConnectPeerId).toBe(cpId);

  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager tags roundtrip", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "tags-test" }),
  );
  const arn = gn.GlobalNetwork?.GlobalNetworkArn ?? "";

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [{ Key: "owner", Value: "alice" }],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(
    listed.TagList?.some((t) => t.Key === "owner" && t.Value === "alice"),
  ).toBe(true);

  await client.send(
    new DeleteGlobalNetworkCommand({
      GlobalNetworkId: gn.GlobalNetwork?.GlobalNetworkId ?? "",
    }),
  );
});
