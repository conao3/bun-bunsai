import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateTrafficMirrorFilterCommand,
  CreateTrafficMirrorFilterRuleCommand,
  CreateTransitGatewayCommand,
  CreateTransitGatewayMeteringPolicyCommand,
  CreateSubnetCidrReservationCommand,
  CreateTrafficMirrorTargetCommand,
  CreateTrafficMirrorSessionCommand,
  CreateSpotDatafeedSubscriptionCommand,
  CreateStoreImageTaskCommand,
  CreateVpcCommand,
  CreateSubnetCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";
import { EC2Client } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk11 create-transit-gateway and create-traffic-mirror-filter e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("create-transit-gateway: returns a valid transit gateway", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateTransitGatewayCommand({
        Description: "test-tgw",
      }),
    );

    const tgw = res.TransitGateway;
    expect(tgw).toBeDefined();
    expect(tgw?.TransitGatewayId?.startsWith("tgw-")).toBe(true);
    expect(tgw?.TransitGatewayArn).toContain("transit-gateway/tgw-");
    expect(tgw?.State).toBe("available");
    expect(tgw?.Description).toBe("test-tgw");
    expect(tgw?.OwnerId).toBe("000000000000");
  });

  test("create-transit-gateway: two gateways get distinct IDs", async () => {
    const client = ec2();

    const res1 = await client.send(new CreateTransitGatewayCommand({}));
    const res2 = await client.send(new CreateTransitGatewayCommand({}));

    expect(res1.TransitGateway?.TransitGatewayId).not.toBe(
      res2.TransitGateway?.TransitGatewayId,
    );
  });

  test("create-transit-gateway-metering-policy: returns a valid policy", async () => {
    const client = ec2();

    const tgwRes = await client.send(new CreateTransitGatewayCommand({}));
    const tgwId = tgwRes.TransitGateway?.TransitGatewayId ?? "";

    const res = await client.send(
      new CreateTransitGatewayMeteringPolicyCommand({
        TransitGatewayId: tgwId,
        MiddleboxAttachmentIds: [],
      }),
    );

    const policy = res.TransitGatewayMeteringPolicy;
    expect(policy).toBeDefined();
    expect(policy?.TransitGatewayMeteringPolicyId).toBeDefined();
    expect(policy?.TransitGatewayId).toBe(tgwId);
    expect(policy?.State).toBe("available");
  });

  test("create-traffic-mirror-filter: returns a valid filter", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateTrafficMirrorFilterCommand({
        Description: "test-filter",
      }),
    );

    const filter = res.TrafficMirrorFilter;
    expect(filter).toBeDefined();
    expect(filter?.TrafficMirrorFilterId?.startsWith("tmf-")).toBe(true);
    expect(filter?.Description).toBe("test-filter");
    expect(filter?.IngressFilterRules).toEqual([]);
    expect(filter?.EgressFilterRules).toEqual([]);
  });

  test("create-traffic-mirror-filter-rule: adds rule to filter", async () => {
    const client = ec2();

    const filterRes = await client.send(
      new CreateTrafficMirrorFilterCommand({ Description: "filter-for-rule" }),
    );
    const filterId = filterRes.TrafficMirrorFilter?.TrafficMirrorFilterId ?? "";

    const ruleRes = await client.send(
      new CreateTrafficMirrorFilterRuleCommand({
        TrafficMirrorFilterId: filterId,
        TrafficDirection: "ingress",
        RuleNumber: 100,
        RuleAction: "accept",
        DestinationCidrBlock: "10.0.0.0/8",
        SourceCidrBlock: "0.0.0.0/0",
        Description: "allow-all-ingress",
      }),
    );

    const rule = ruleRes.TrafficMirrorFilterRule;
    expect(rule).toBeDefined();
    expect(rule?.TrafficMirrorFilterRuleId?.startsWith("tmfr-")).toBe(true);
    expect(rule?.TrafficMirrorFilterId).toBe(filterId);
    expect(rule?.TrafficDirection).toBe("ingress");
    expect(rule?.RuleNumber).toBe(100);
    expect(rule?.RuleAction).toBe("accept");
    expect(rule?.DestinationCidrBlock).toBe("10.0.0.0/8");
    expect(rule?.SourceCidrBlock).toBe("0.0.0.0/0");
  });

  test("create-traffic-mirror-target: returns a valid target", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateTrafficMirrorTargetCommand({
        NetworkInterfaceId: "eni-12345678",
        Description: "test-target",
      }),
    );

    const target = res.TrafficMirrorTarget;
    expect(target).toBeDefined();
    expect(target?.TrafficMirrorTargetId?.startsWith("tmt-")).toBe(true);
    expect(target?.Type).toBe("network-interface");
    expect(target?.NetworkInterfaceId).toBe("eni-12345678");
    expect(target?.Description).toBe("test-target");
  });

  test("create-traffic-mirror-session: returns a valid session", async () => {
    const client = ec2();

    const filterRes = await client.send(
      new CreateTrafficMirrorFilterCommand({}),
    );
    const filterId = filterRes.TrafficMirrorFilter?.TrafficMirrorFilterId ?? "";
    const targetRes = await client.send(
      new CreateTrafficMirrorTargetCommand({
        NetworkInterfaceId: "eni-99887766",
      }),
    );
    const targetId = targetRes.TrafficMirrorTarget?.TrafficMirrorTargetId ?? "";

    const res = await client.send(
      new CreateTrafficMirrorSessionCommand({
        NetworkInterfaceId: "eni-aabbccdd",
        TrafficMirrorTargetId: targetId,
        TrafficMirrorFilterId: filterId,
        SessionNumber: 1,
        Description: "test-session",
      }),
    );

    const session = res.TrafficMirrorSession;
    expect(session).toBeDefined();
    expect(session?.TrafficMirrorSessionId?.startsWith("tms-")).toBe(true);
    expect(session?.TrafficMirrorTargetId).toBe(targetId);
    expect(session?.TrafficMirrorFilterId).toBe(filterId);
    expect(session?.SessionNumber).toBe(1);
  });

  test("create-subnet-cidr-reservation: returns a valid reservation", async () => {
    const client = ec2();

    const vpcRes = await client.send(
      new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }),
    );
    const vpcId = vpcRes.Vpc?.VpcId ?? "";

    const subnetRes = await client.send(
      new CreateSubnetCommand({
        VpcId: vpcId,
        CidrBlock: "10.0.1.0/24",
      }),
    );
    const subnetId = subnetRes.Subnet?.SubnetId ?? "";

    const res = await client.send(
      new CreateSubnetCidrReservationCommand({
        SubnetId: subnetId,
        Cidr: "10.0.1.0/28",
        ReservationType: "prefix",
        Description: "test-reservation",
      }),
    );

    const reservation = res.SubnetCidrReservation;
    expect(reservation).toBeDefined();
    expect(reservation?.SubnetCidrReservationId?.startsWith("scr-")).toBe(true);
    expect(reservation?.SubnetId).toBe(subnetId);
    expect(reservation?.Cidr).toBe("10.0.1.0/28");
    expect(reservation?.ReservationType).toBe("prefix");
  });

  test("create-spot-datafeed-subscription: returns a valid subscription", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateSpotDatafeedSubscriptionCommand({
        Bucket: "my-spot-datafeed-bucket",
        Prefix: "spot-logs/",
      }),
    );

    const sub = res.SpotDatafeedSubscription;
    expect(sub).toBeDefined();
    expect(sub?.Bucket).toBe("my-spot-datafeed-bucket");
    expect(sub?.Prefix).toBe("spot-logs/");
    expect(sub?.State).toBeDefined();
  });

  test("create-store-image-task: returns an object key", async () => {
    const client = ec2();

    const res = await client.send(
      new CreateStoreImageTaskCommand({
        ImageId: "ami-12345678",
        Bucket: "my-ami-bucket",
      }),
    );

    expect(res.ObjectKey).toBeDefined();
    expect(res.ObjectKey).toContain("ami-12345678");
  });
});
