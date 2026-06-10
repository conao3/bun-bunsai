import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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
  DeleteAttachmentCommand,
  DeleteConnectPeerCommand,
  DeleteConnectionCommand,
  DeleteCoreNetworkCommand,
  DeleteDeviceCommand,
  DeleteGlobalNetworkCommand,
  DeleteLinkCommand,
  DeleteSiteCommand,
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
  ListPeeringsCommand,
  ListTagsForResourceCommand,
  NetworkManagerClient,
  PutCoreNetworkPolicyCommand,
  TagResourceCommand,
} from "@aws-sdk/client-networkmanager";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const networkmanager = () =>
  new NetworkManagerClient({
    endpoint,
    region,
    credentials,
    requestHandler,
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
  expect(created.GlobalNetwork?.State).toBe("PENDING");

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
  expect(site.Site?.State).toBe("PENDING");

  const listed = await client.send(
    new GetSitesCommand({ GlobalNetworkId: gid }),
  );
  expect(listed.Sites?.some((s) => s.SiteId === sid)).toBe(true);

  await client.send(
    new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: sid ?? "" }),
  );
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
  expect(device.Device?.State).toBe("PENDING");

  const listed = await client.send(
    new GetDevicesCommand({ GlobalNetworkId: gid }),
  );
  expect(listed.Devices?.some((d) => d.DeviceId === did)).toBe(true);

  await client.send(
    new DeleteDeviceCommand({ GlobalNetworkId: gid, DeviceId: did ?? "" }),
  );
  await client.send(
    new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: sid }),
  );
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
  expect(link.Link?.State).toBe("PENDING");

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

  await client.send(
    new DeleteLinkCommand({ GlobalNetworkId: gid, LinkId: lid ?? "" }),
  );
  await client.send(
    new DeleteDeviceCommand({ GlobalNetworkId: gid, DeviceId: did }),
  );
  await client.send(
    new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: sid }),
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
  expect(conn.Connection?.State).toBe("PENDING");

  const listed = await client.send(
    new GetConnectionsCommand({ GlobalNetworkId: gid }),
  );
  expect(listed.Connections?.some((c) => c.ConnectionId === cid)).toBe(true);

  await client.send(
    new DeleteConnectionCommand({
      GlobalNetworkId: gid,
      ConnectionId: cid ?? "",
    }),
  );
  await client.send(
    new DeleteDeviceCommand({
      GlobalNetworkId: gid,
      DeviceId: d1.Device?.DeviceId ?? "",
    }),
  );
  await client.send(
    new DeleteDeviceCommand({
      GlobalNetworkId: gid,
      DeviceId: d2.Device?.DeviceId ?? "",
    }),
  );
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
  expect(cn.CoreNetwork?.State).toBe("CREATING");

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

  await client.send(new DeleteCoreNetworkCommand({ CoreNetworkId: cnId ?? "" }));
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

  await client.send(
    new DeleteAttachmentCommand({ AttachmentId: attId ?? "" }),
  );
  await client.send(new DeleteCoreNetworkCommand({ CoreNetworkId: cnId }));
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

  await client.send(
    new DeleteConnectPeerCommand({ ConnectPeerId: cpId ?? "" }),
  );
  await client.send(
    new DeleteAttachmentCommand({ AttachmentId: connectAttId }),
  );
  await client.send(
    new DeleteAttachmentCommand({ AttachmentId: transportAttId }),
  );
  await client.send(new DeleteCoreNetworkCommand({ CoreNetworkId: cnId }));
  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager GetSites SiteIds filter and pagination", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "sites-filter-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const s1 = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site-a" }),
  );
  const s2 = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site-b" }),
  );
  const s3 = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site-c" }),
  );
  const sid1 = s1.Site?.SiteId ?? "";
  const sid2 = s2.Site?.SiteId ?? "";
  const sid3 = s3.Site?.SiteId ?? "";

  const filtered = await client.send(
    new GetSitesCommand({ GlobalNetworkId: gid, SiteIds: [sid1, sid3] }),
  );
  expect(filtered.Sites?.length).toBe(2);
  expect(filtered.Sites?.some((s) => s.SiteId === sid1)).toBe(true);
  expect(filtered.Sites?.some((s) => s.SiteId === sid2)).toBe(false);
  expect(filtered.Sites?.some((s) => s.SiteId === sid3)).toBe(true);

  const page1 = await client.send(
    new GetSitesCommand({ GlobalNetworkId: gid, MaxResults: 2 }),
  );
  expect(page1.Sites?.length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new GetSitesCommand({
      GlobalNetworkId: gid,
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.Sites?.length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  for (const sid of [sid1, sid2, sid3]) {
    await client.send(new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: sid }));
  }
  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager GetDevices SiteId filter and pagination", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "devices-filter-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const sA = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site-a" }),
  );
  const sB = await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "site-b" }),
  );
  const siteA = sA.Site?.SiteId ?? "";
  const siteB = sB.Site?.SiteId ?? "";

  const dA1 = await client.send(
    new CreateDeviceCommand({ GlobalNetworkId: gid, SiteId: siteA }),
  );
  const dA2 = await client.send(
    new CreateDeviceCommand({ GlobalNetworkId: gid, SiteId: siteA }),
  );
  const dB = await client.send(
    new CreateDeviceCommand({ GlobalNetworkId: gid, SiteId: siteB }),
  );
  const didB = dB.Device?.DeviceId ?? "";

  const bySite = await client.send(
    new GetDevicesCommand({ GlobalNetworkId: gid, SiteId: siteA }),
  );
  expect(bySite.Devices?.length).toBe(2);
  expect(bySite.Devices?.some((d) => d.DeviceId === didB)).toBe(false);

  const page1 = await client.send(
    new GetDevicesCommand({ GlobalNetworkId: gid, MaxResults: 2 }),
  );
  expect(page1.Devices?.length).toBe(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new GetDevicesCommand({
      GlobalNetworkId: gid,
      MaxResults: 2,
      NextToken: page1.NextToken,
    }),
  );
  expect(page2.Devices?.length).toBe(1);
  expect(page2.NextToken).toBeUndefined();

  for (const did of [
    dA1.Device?.DeviceId ?? "",
    dA2.Device?.DeviceId ?? "",
    didB,
  ]) {
    await client.send(
      new DeleteDeviceCommand({ GlobalNetworkId: gid, DeviceId: did }),
    );
  }
  await client.send(
    new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: siteA }),
  );
  await client.send(
    new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: siteB }),
  );
  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager ListPeerings CoreNetworkId filter", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "peerings-filter-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const cn = await client.send(
    new CreateCoreNetworkCommand({ GlobalNetworkId: gid }),
  );
  const cnId = cn.CoreNetwork?.CoreNetworkId ?? "";

  const listed = await client.send(
    new ListPeeringsCommand({ CoreNetworkId: cnId }),
  );
  expect(listed.Peerings).toBeDefined();
  expect(Array.isArray(listed.Peerings)).toBe(true);

  await client.send(new DeleteCoreNetworkCommand({ CoreNetworkId: cnId }));
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

test("NetworkManager CreateVpcAttachment ClientToken idempotency", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "idem-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const cn = await client.send(
    new CreateCoreNetworkCommand({ GlobalNetworkId: gid }),
  );
  const cnId = cn.CoreNetwork?.CoreNetworkId ?? "";

  const token = "test-idempotency-token-001";
  const first = await client.send(
    new CreateVpcAttachmentCommand({
      CoreNetworkId: cnId,
      VpcArn: "arn:aws:ec2:us-east-1:123:vpc/vpc-idem",
      SubnetArns: ["arn:aws:ec2:us-east-1:123:subnet/subnet-idem"],
      ClientToken: token,
    }),
  );
  const firstId = first.VpcAttachment?.Attachment?.AttachmentId;
  expect(firstId).toBeDefined();

  const second = await client.send(
    new CreateVpcAttachmentCommand({
      CoreNetworkId: cnId,
      VpcArn: "arn:aws:ec2:us-east-1:123:vpc/vpc-idem",
      SubnetArns: ["arn:aws:ec2:us-east-1:123:subnet/subnet-idem"],
      ClientToken: token,
    }),
  );
  expect(second.VpcAttachment?.Attachment?.AttachmentId).toBe(firstId);

  await client.send(
    new DeleteAttachmentCommand({ AttachmentId: firstId ?? "" }),
  );
  await client.send(new DeleteCoreNetworkCommand({ CoreNetworkId: cnId }));
  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager CreateVpcAttachment tags round-trip via ListTagsForResource", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "att-tags-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  const cn = await client.send(
    new CreateCoreNetworkCommand({ GlobalNetworkId: gid }),
  );
  const cnId = cn.CoreNetwork?.CoreNetworkId ?? "";

  const att = await client.send(
    new CreateVpcAttachmentCommand({
      CoreNetworkId: cnId,
      VpcArn: "arn:aws:ec2:us-east-1:123:vpc/vpc-tag-test",
      SubnetArns: ["arn:aws:ec2:us-east-1:123:subnet/subnet-tag"],
      Tags: [{ Key: "purpose", Value: "tag-roundtrip" }],
    }),
  );
  const attId = att.VpcAttachment?.Attachment?.AttachmentId ?? "";
  const cnArn = cn.CoreNetwork?.CoreNetworkArn ?? "";
  const accountId = cnArn.split(":")[4] ?? "test";
  const attArn = `arn:aws:networkmanager::${accountId}:attachment/${attId}`;

  const tagList = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: attArn }),
  );
  expect(
    tagList.TagList?.some(
      (t) => t.Key === "purpose" && t.Value === "tag-roundtrip",
    ),
  ).toBe(true);

  await client.send(
    new DeleteAttachmentCommand({
      AttachmentId: att.VpcAttachment?.Attachment?.AttachmentId ?? "",
    }),
  );
  await client.send(new DeleteCoreNetworkCommand({ CoreNetworkId: cnId }));
  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});

test("NetworkManager DeleteGlobalNetwork rejects when child resources exist", async () => {
  const client = networkmanager();

  const gn = await client.send(
    new CreateGlobalNetworkCommand({ Description: "in-use-delete-test" }),
  );
  const gid = gn.GlobalNetwork?.GlobalNetworkId ?? "";

  await client.send(
    new CreateSiteCommand({ GlobalNetworkId: gid, Description: "blocker" }),
  );

  await expect(
    client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid })),
  ).rejects.toThrow();

  const sites = await client.send(new GetSitesCommand({ GlobalNetworkId: gid }));
  const sid = sites.Sites?.[0]?.SiteId ?? "";
  await client.send(new DeleteSiteCommand({ GlobalNetworkId: gid, SiteId: sid }));
  await client.send(new DeleteGlobalNetworkCommand({ GlobalNetworkId: gid }));
});
