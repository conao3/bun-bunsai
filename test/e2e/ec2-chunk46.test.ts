import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateManagedPrefixListCommand,
  CreateSubnetCidrReservationCommand,
  CreateSubnetCommand,
  CreateTransitGatewayCommand,
  CreateTransitGatewayMeteringPolicyCommand,
  CreateTransitGatewayMeteringPolicyEntryCommand,
  CreateTransitGatewayMulticastDomainCommand,
  CreateTransitGatewayPolicyTableCommand,
  CreateTransitGatewayPrefixListReferenceCommand,
  CreateTransitGatewayRouteTableCommand,
  CreateVerifiedAccessGroupCommand,
  CreateVerifiedAccessInstanceCommand,
  CreateVpcCommand,
  EC2Client,
  GetSubnetCidrReservationsCommand,
  GetTransitGatewayAttachmentPropagationsCommand,
  GetTransitGatewayMeteringPolicyEntriesCommand,
  GetTransitGatewayMulticastDomainAssociationsCommand,
  GetTransitGatewayPolicyTableAssociationsCommand,
  GetTransitGatewayPolicyTableEntriesCommand,
  GetTransitGatewayPrefixListReferencesCommand,
  GetTransitGatewayRouteTableAssociationsCommand,
  GetTransitGatewayRouteTablePropagationsCommand,
  GetVerifiedAccessEndpointPolicyCommand,
  GetVerifiedAccessGroupPolicyCommand,
} from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new EC2Client({ endpoint, region, credentials, requestHandler });

test("CreateSubnetCidrReservation → GetSubnetCidrReservations returns it", async () => {
  const vpc = await client.send(
    new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
  );
  const vpcId = vpc.Vpc?.VpcId!;
  const subnet = await client.send(
    new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.0.1.0/24" }),
  );
  const subnetId = subnet.Subnet?.SubnetId!;
  expect(subnetId).toBeDefined();

  await client.send(
    new CreateSubnetCidrReservationCommand({
      SubnetId: subnetId,
      Cidr: "10.0.1.0/28",
      ReservationType: "prefix",
      Description: "test",
    }),
  );

  const result = await client.send(
    new GetSubnetCidrReservationsCommand({ SubnetId: subnetId }),
  );
  expect(Array.isArray(result.SubnetIpv4CidrReservations)).toBe(true);
  expect(result.SubnetIpv4CidrReservations!.length).toBe(1);
  expect(result.SubnetIpv4CidrReservations![0].Cidr).toBe("10.0.1.0/28");
  expect(result.SubnetIpv4CidrReservations![0].ReservationType).toBe("prefix");
  expect(Array.isArray(result.SubnetIpv6CidrReservations)).toBe(true);
  expect(result.SubnetIpv6CidrReservations!.length).toBe(0);
});

test("CreateTransitGatewayRouteTable → GetTransitGatewayRouteTableAssociations empty, GetTransitGatewayRouteTablePropagations empty, CreateTransitGatewayPrefixListReference → GetTransitGatewayPrefixListReferences returns it", async () => {
  const tgw = await client.send(new CreateTransitGatewayCommand({}));
  const tgwId = tgw.TransitGateway?.TransitGatewayId!;

  const rtbResp = await client.send(
    new CreateTransitGatewayRouteTableCommand({ TransitGatewayId: tgwId }),
  );
  const rtbId = rtbResp.TransitGatewayRouteTable?.TransitGatewayRouteTableId!;
  expect(rtbId).toBeDefined();

  const assocs = await client.send(
    new GetTransitGatewayRouteTableAssociationsCommand({
      TransitGatewayRouteTableId: rtbId,
    }),
  );
  expect(Array.isArray(assocs.Associations)).toBe(true);
  expect(assocs.Associations!.length).toBe(0);

  const props = await client.send(
    new GetTransitGatewayRouteTablePropagationsCommand({
      TransitGatewayRouteTableId: rtbId,
    }),
  );
  expect(Array.isArray(props.TransitGatewayRouteTablePropagations)).toBe(true);
  expect(props.TransitGatewayRouteTablePropagations!.length).toBe(0);

  const pl = await client.send(
    new CreateManagedPrefixListCommand({
      PrefixListName: "test-pl",
      MaxEntries: 10,
      AddressFamily: "IPv4",
    }),
  );
  const plId = pl.PrefixList?.PrefixListId!;

  await client.send(
    new CreateTransitGatewayPrefixListReferenceCommand({
      TransitGatewayRouteTableId: rtbId,
      PrefixListId: plId,
    }),
  );

  const refs = await client.send(
    new GetTransitGatewayPrefixListReferencesCommand({
      TransitGatewayRouteTableId: rtbId,
    }),
  );
  expect(Array.isArray(refs.TransitGatewayPrefixListReferences)).toBe(true);
  expect(refs.TransitGatewayPrefixListReferences!.length).toBe(1);
  expect(refs.TransitGatewayPrefixListReferences![0].PrefixListId).toBe(plId);
});

test("CreateTransitGatewayMeteringPolicy + Entry → GetTransitGatewayMeteringPolicyEntries returns it", async () => {
  const tgw = await client.send(new CreateTransitGatewayCommand({}));
  const tgwId = tgw.TransitGateway?.TransitGatewayId!;

  const policy = await client.send(
    new CreateTransitGatewayMeteringPolicyCommand({
      TransitGatewayId: tgwId,
    }),
  );
  const policyId =
    policy.TransitGatewayMeteringPolicy?.TransitGatewayMeteringPolicyId!;
  expect(policyId).toBeDefined();

  await client.send(
    new CreateTransitGatewayMeteringPolicyEntryCommand({
      TransitGatewayMeteringPolicyId: policyId,
      PolicyRuleNumber: 100,
      MeteredAccount: "transit-gateway-owner",
    }),
  );

  const entries = await client.send(
    new GetTransitGatewayMeteringPolicyEntriesCommand({
      TransitGatewayMeteringPolicyId: policyId,
    }),
  );
  expect(Array.isArray(entries.TransitGatewayMeteringPolicyEntries)).toBe(true);
  expect(entries.TransitGatewayMeteringPolicyEntries!.length).toBe(1);
});

test("empty-list: GetTransitGatewayAttachmentPropagations, GetTransitGatewayMulticastDomainAssociations, GetTransitGatewayPolicyTableAssociations, GetTransitGatewayPolicyTableEntries, GetVerifiedAccessGroupPolicy", async () => {
  const attachProps = await client.send(
    new GetTransitGatewayAttachmentPropagationsCommand({
      TransitGatewayAttachmentId: "tgw-attach-dummy",
    }),
  );
  expect(Array.isArray(attachProps.TransitGatewayAttachmentPropagations)).toBe(
    true,
  );
  expect(attachProps.TransitGatewayAttachmentPropagations!.length).toBe(0);

  const tgw = await client.send(new CreateTransitGatewayCommand({}));
  const tgwId = tgw.TransitGateway?.TransitGatewayId!;

  const mcastDomain = await client.send(
    new CreateTransitGatewayMulticastDomainCommand({
      TransitGatewayId: tgwId,
    }),
  );
  const domainId =
    mcastDomain.TransitGatewayMulticastDomain?.TransitGatewayMulticastDomainId!;
  const domainAssocs = await client.send(
    new GetTransitGatewayMulticastDomainAssociationsCommand({
      TransitGatewayMulticastDomainId: domainId,
    }),
  );
  expect(Array.isArray(domainAssocs.MulticastDomainAssociations)).toBe(true);
  expect(domainAssocs.MulticastDomainAssociations!.length).toBe(0);

  const policyTable = await client.send(
    new CreateTransitGatewayPolicyTableCommand({ TransitGatewayId: tgwId }),
  );
  const tableId =
    policyTable.TransitGatewayPolicyTable?.TransitGatewayPolicyTableId!;

  const tableAssocs = await client.send(
    new GetTransitGatewayPolicyTableAssociationsCommand({
      TransitGatewayPolicyTableId: tableId,
    }),
  );
  expect(Array.isArray(tableAssocs.Associations)).toBe(true);
  expect(tableAssocs.Associations!.length).toBe(0);

  const tableEntries = await client.send(
    new GetTransitGatewayPolicyTableEntriesCommand({
      TransitGatewayPolicyTableId: tableId,
    }),
  );
  expect(Array.isArray(tableEntries.TransitGatewayPolicyTableEntries)).toBe(
    true,
  );
  expect(tableEntries.TransitGatewayPolicyTableEntries!.length).toBe(0);

  const vai = await client.send(
    new CreateVerifiedAccessInstanceCommand({ Description: "test" }),
  );
  const vaiId = vai.VerifiedAccessInstance?.VerifiedAccessInstanceId!;
  const vag = await client.send(
    new CreateVerifiedAccessGroupCommand({
      VerifiedAccessInstanceId: vaiId,
    }),
  );
  const vagId = vag.VerifiedAccessGroup?.VerifiedAccessGroupId!;

  const groupPolicy = await client.send(
    new GetVerifiedAccessGroupPolicyCommand({ VerifiedAccessGroupId: vagId }),
  );
  expect(groupPolicy.PolicyEnabled).toBe(false);

  const endpointPolicy = await client
    .send(
      new GetVerifiedAccessEndpointPolicyCommand({
        VerifiedAccessEndpointId: "vae-notexist",
      }),
    )
    .catch((e) => e);
  expect(endpointPolicy).toBeInstanceOf(Error);
});
