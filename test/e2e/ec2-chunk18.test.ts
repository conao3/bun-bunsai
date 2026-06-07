import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateRouteTableCommand,
  CreateSecurityGroupCommand,
  CreateSpotDatafeedSubscriptionCommand,
  CreateSubnetCidrReservationCommand,
  CreateSubnetCommand,
  CreateTrafficMirrorFilterCommand,
  CreateTrafficMirrorFilterRuleCommand,
  CreateTrafficMirrorSessionCommand,
  CreateTrafficMirrorTargetCommand,
  CreateTransitGatewayCommand,
  CreateVpcCommand,
  DeleteRouteTableCommand,
  DeleteSecurityGroupCommand,
  DeleteSpotDatafeedSubscriptionCommand,
  DeleteSubnetCidrReservationCommand,
  DeleteTrafficMirrorFilterCommand,
  DeleteTrafficMirrorFilterRuleCommand,
  DeleteTrafficMirrorSessionCommand,
  DeleteTrafficMirrorTargetCommand,
  DeleteTransitGatewayCommand,
  DescribeRouteTablesCommand,
  DescribeSecurityGroupsCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk18 delete (route-table, security-group, traffic-mirror, transit-gateway) e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("security-group: create → delete → describe shows gone; delete non-existent → InvalidGroup.NotFound", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const createRes = await client.send(
      new CreateSecurityGroupCommand({
        GroupName: "test-sg-chunk18",
        Description: "chunk18 test",
        VpcId: vpcId,
      }),
    );
    const groupId = createRes.GroupId ?? "";
    expect(groupId.startsWith("sg-")).toBe(true);

    const beforeDelete = await client.send(
      new DescribeSecurityGroupsCommand({ GroupIds: [groupId] }),
    );
    expect(beforeDelete.SecurityGroups).toHaveLength(1);

    const deleteRes = await client.send(
      new DeleteSecurityGroupCommand({ GroupId: groupId }),
    );
    expect(deleteRes.Return).toBe(true);
    expect(deleteRes.GroupId).toBe(groupId);

    const afterDelete = await client.send(
      new DescribeSecurityGroupsCommand({ GroupIds: [] }),
    );
    const found = (afterDelete.SecurityGroups ?? []).find(
      (g) => g.GroupId === groupId,
    );
    expect(found).toBeUndefined();

    const err = await client
      .send(new DeleteSecurityGroupCommand({ GroupId: groupId }))
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("InvalidGroup.NotFound");
  });

  test("route-table: create → delete → describe shows gone; delete non-existent → InvalidRouteTableID.NotFound", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.1.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const createRes = await client.send(
      new CreateRouteTableCommand({ VpcId: vpcId }),
    );
    const rtbId = createRes.RouteTable?.RouteTableId ?? "";
    expect(rtbId.startsWith("rtb-")).toBe(true);

    await client.send(new DeleteRouteTableCommand({ RouteTableId: rtbId }));

    const afterDelete = await client.send(
      new DescribeRouteTablesCommand({ RouteTableIds: [] }),
    );
    const found = (afterDelete.RouteTables ?? []).find(
      (t) => t.RouteTableId === rtbId,
    );
    expect(found).toBeUndefined();

    const err = await client
      .send(new DeleteRouteTableCommand({ RouteTableId: rtbId }))
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe("InvalidRouteTableID.NotFound");
  });

  test("transit-gateway: create → delete → re-delete throws", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateTransitGatewayCommand({ Description: "chunk18-tgw" }),
    );
    const tgwId = createRes.TransitGateway?.TransitGatewayId ?? "";
    expect(tgwId.startsWith("tgw-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteTransitGatewayCommand({ TransitGatewayId: tgwId }),
    );
    expect(deleteRes.TransitGateway?.State).toBe("deleted");

    const err = await client
      .send(new DeleteTransitGatewayCommand({ TransitGatewayId: tgwId }))
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTransitGatewayID.NotFound",
    );
  });

  test("traffic-mirror: filter → rule → session → target lifecycle", async () => {
    const client = ec2();

    const filterRes = await client.send(
      new CreateTrafficMirrorFilterCommand({ Description: "chunk18-filter" }),
    );
    const filterId = filterRes.TrafficMirrorFilter?.TrafficMirrorFilterId ?? "";
    expect(filterId.startsWith("tmf-")).toBe(true);

    const ruleRes = await client.send(
      new CreateTrafficMirrorFilterRuleCommand({
        TrafficMirrorFilterId: filterId,
        TrafficDirection: "ingress",
        RuleNumber: 100,
        RuleAction: "accept",
        DestinationCidrBlock: "0.0.0.0/0",
        SourceCidrBlock: "0.0.0.0/0",
      }),
    );
    const ruleId =
      ruleRes.TrafficMirrorFilterRule?.TrafficMirrorFilterRuleId ?? "";
    expect(ruleId.startsWith("tmfr-")).toBe(true);

    const targetRes = await client.send(
      new CreateTrafficMirrorTargetCommand({
        NetworkInterfaceId: "eni-target",
        Description: "chunk18-target",
      }),
    );
    const targetId = targetRes.TrafficMirrorTarget?.TrafficMirrorTargetId ?? "";
    expect(targetId.startsWith("tmt-")).toBe(true);

    const sessionRes = await client.send(
      new CreateTrafficMirrorSessionCommand({
        NetworkInterfaceId: "eni-src",
        TrafficMirrorTargetId: targetId,
        TrafficMirrorFilterId: filterId,
        SessionNumber: 1,
      }),
    );
    const sessionId =
      sessionRes.TrafficMirrorSession?.TrafficMirrorSessionId ?? "";
    expect(sessionId.startsWith("tms-")).toBe(true);

    const delRuleRes = await client.send(
      new DeleteTrafficMirrorFilterRuleCommand({
        TrafficMirrorFilterRuleId: ruleId,
      }),
    );
    expect(delRuleRes.TrafficMirrorFilterRuleId).toBe(ruleId);

    const delSessionRes = await client.send(
      new DeleteTrafficMirrorSessionCommand({
        TrafficMirrorSessionId: sessionId,
      }),
    );
    expect(delSessionRes.TrafficMirrorSessionId).toBe(sessionId);

    const delTargetRes = await client.send(
      new DeleteTrafficMirrorTargetCommand({
        TrafficMirrorTargetId: targetId,
      }),
    );
    expect(delTargetRes.TrafficMirrorTargetId).toBe(targetId);

    const delFilterRes = await client.send(
      new DeleteTrafficMirrorFilterCommand({
        TrafficMirrorFilterId: filterId,
      }),
    );
    expect(delFilterRes.TrafficMirrorFilterId).toBe(filterId);

    const err = await client
      .send(
        new DeleteTrafficMirrorFilterCommand({
          TrafficMirrorFilterId: filterId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidTrafficMirrorFilterId.NotFound",
    );
  });

  test("spot-datafeed-subscription: create → delete succeeds", async () => {
    const client = ec2();

    await client.send(
      new CreateSpotDatafeedSubscriptionCommand({ Bucket: "my-bucket" }),
    );

    const deleteRes = await client.send(
      new DeleteSpotDatafeedSubscriptionCommand({}),
    );
    expect(deleteRes.$metadata.httpStatusCode).toBe(200);
  });

  test("subnet-cidr-reservation: create → delete returns deleted reservation", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.2.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const subnetRes = await client.send(
      new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: "10.2.0.0/24" }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";

    const reservRes = await client.send(
      new CreateSubnetCidrReservationCommand({
        SubnetId: subnetId,
        Cidr: "10.2.0.0/28",
        ReservationType: "prefix",
      }),
    );
    const reservId =
      reservRes.SubnetCidrReservation?.SubnetCidrReservationId ?? "";
    expect(reservId.startsWith("scr-")).toBe(true);

    const deleteRes = await client.send(
      new DeleteSubnetCidrReservationCommand({
        SubnetCidrReservationId: reservId,
      }),
    );
    expect(
      deleteRes.DeletedSubnetCidrReservation?.SubnetCidrReservationId,
    ).toBe(reservId);

    const err = await client
      .send(
        new DeleteSubnetCidrReservationCommand({
          SubnetCidrReservationId: reservId,
        }),
      )
      .catch((e: unknown) => e);
    expect((err as { name: string }).name).toBe(
      "InvalidSubnetCidrReservationID.NotFound",
    );
  });
});
