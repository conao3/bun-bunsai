import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateSnapshotCommand,
  CreateSpotDatafeedSubscriptionCommand,
  CreateTrafficMirrorFilterCommand,
  CreateTrafficMirrorFilterRuleCommand,
  CreateVolumeCommand,
  DescribeSnapshotAttributeCommand,
  DescribeSpotDatafeedSubscriptionCommand,
  DescribeSpotFleetRequestsCommand,
  DescribeSpotInstanceRequestsCommand,
  DescribeSpotPriceHistoryCommand,
  DescribeStoreImageTasksCommand,
  DescribeTrafficMirrorFilterRulesCommand,
  EC2Client,
  RequestSpotFleetCommand,
  RequestSpotInstancesCommand,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk32 describe snapshots/spot-fleet/spot-instances/stale-sg/traffic-mirror e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("RequestSpotInstances then DescribeSpotInstanceRequests includes it", async () => {
    const client = ec2();

    const req = await client.send(
      new RequestSpotInstancesCommand({ InstanceCount: 1, SpotPrice: "0.05" }),
    );
    expect(req.$metadata.httpStatusCode).toBe(200);
    const sirId = req.SpotInstanceRequests![0].SpotInstanceRequestId!;
    expect(sirId.startsWith("sir-")).toBe(true);

    const all = await client.send(new DescribeSpotInstanceRequestsCommand({}));
    expect(all.$metadata.httpStatusCode).toBe(200);
    const found = all.SpotInstanceRequests!.find(
      (r) => r.SpotInstanceRequestId === sirId,
    );
    expect(found).toBeDefined();
    expect(found!.State).toBe("open");

    const byId = await client.send(
      new DescribeSpotInstanceRequestsCommand({
        SpotInstanceRequestIds: [sirId],
      }),
    );
    expect(byId.SpotInstanceRequests).toHaveLength(1);
    expect(byId.SpotInstanceRequests![0].SpotInstanceRequestId).toBe(sirId);
  });

  test("RequestSpotFleet then DescribeSpotFleetRequests includes it", async () => {
    const client = ec2();

    const req = await client.send(
      new RequestSpotFleetCommand({
        SpotFleetRequestConfig: {
          IamFleetRole: "arn:aws:iam::123456789012:role/AmazonEC2SpotFleetRole",
          TargetCapacity: 2,
          AllocationStrategy: "lowestPrice",
          LaunchSpecifications: [],
        },
      }),
    );
    expect(req.$metadata.httpStatusCode).toBe(200);
    const sfrId = req.SpotFleetRequestId!;
    expect(sfrId.startsWith("sfr-")).toBe(true);

    const byId = await client.send(
      new DescribeSpotFleetRequestsCommand({ SpotFleetRequestIds: [sfrId] }),
    );
    expect(byId.$metadata.httpStatusCode).toBe(200);
    expect(byId.SpotFleetRequestConfigs).toHaveLength(1);
    expect(byId.SpotFleetRequestConfigs![0].SpotFleetRequestId).toBe(sfrId);
  });

  test("CreateSnapshot then DescribeSnapshotAttribute returns it", async () => {
    const client = ec2();

    const vol = await client.send(
      new CreateVolumeCommand({
        AvailabilityZone: "us-east-1a",
        Size: 10,
        VolumeType: "gp2",
      }),
    );
    const volumeId = vol.VolumeId!;

    const snap = await client.send(
      new CreateSnapshotCommand({
        VolumeId: volumeId,
        Description: "chunk32-test",
      }),
    );
    const snapId = snap.SnapshotId!;
    expect(snapId.startsWith("snap-")).toBe(true);

    const attr = await client.send(
      new DescribeSnapshotAttributeCommand({
        SnapshotId: snapId,
        Attribute: "createVolumePermission",
      }),
    );
    expect(attr.$metadata.httpStatusCode).toBe(200);
    expect(attr.SnapshotId).toBe(snapId);
    expect(Array.isArray(attr.CreateVolumePermissions)).toBe(true);
  });

  test("DescribeSpotPriceHistory returns synthetic entries", async () => {
    const client = ec2();
    const res = await client.send(new DescribeSpotPriceHistoryCommand({}));
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(res.SpotPriceHistory)).toBe(true);
    expect(res.SpotPriceHistory!.length).toBeGreaterThan(0);
    expect(res.SpotPriceHistory![0].InstanceType).toBeDefined();
    expect(res.SpotPriceHistory![0].SpotPrice).toBeDefined();
  });

  test("CreateSpotDatafeedSubscription then DescribeSpotDatafeedSubscription returns it", async () => {
    const client = ec2();

    await client.send(
      new CreateSpotDatafeedSubscriptionCommand({
        Bucket: "my-spot-bucket",
        Prefix: "spot-logs/",
      }),
    );

    const res = await client.send(
      new DescribeSpotDatafeedSubscriptionCommand({}),
    );
    expect(res.$metadata.httpStatusCode).toBe(200);
    expect(res.SpotDatafeedSubscription!.Bucket).toBe("my-spot-bucket");
    expect(res.SpotDatafeedSubscription!.Prefix).toBe("spot-logs/");
  });

  test("DescribeStoreImageTasks returns tasks from store", async () => {
    const client = ec2();

    const empty = await client.send(new DescribeStoreImageTasksCommand({}));
    expect(empty.$metadata.httpStatusCode).toBe(200);
    expect(Array.isArray(empty.StoreImageTaskResults)).toBe(true);
  });

  test("CreateTrafficMirrorFilter + Rule then DescribeTrafficMirrorFilterRules", async () => {
    const client = ec2();

    const filter = await client.send(
      new CreateTrafficMirrorFilterCommand({ Description: "chunk32-filter" }),
    );
    const filterId = filter.TrafficMirrorFilter!.TrafficMirrorFilterId!;
    expect(filterId.startsWith("tmf-")).toBe(true);

    const rule = await client.send(
      new CreateTrafficMirrorFilterRuleCommand({
        TrafficMirrorFilterId: filterId,
        TrafficDirection: "ingress",
        RuleNumber: 100,
        RuleAction: "accept",
        DestinationCidrBlock: "0.0.0.0/0",
        SourceCidrBlock: "0.0.0.0/0",
      }),
    );
    const ruleId = rule.TrafficMirrorFilterRule!.TrafficMirrorFilterRuleId!;
    expect(ruleId.startsWith("tmfr-")).toBe(true);

    const byFilter = await client.send(
      new DescribeTrafficMirrorFilterRulesCommand({
        TrafficMirrorFilterId: filterId,
      }),
    );
    expect(byFilter.$metadata.httpStatusCode).toBe(200);
    const found = byFilter.TrafficMirrorFilterRules!.find(
      (r) => r.TrafficMirrorFilterRuleId === ruleId,
    );
    expect(found).toBeDefined();
    expect(found!.TrafficMirrorFilterId).toBe(filterId);

    const byId = await client.send(
      new DescribeTrafficMirrorFilterRulesCommand({
        TrafficMirrorFilterRuleIds: [ruleId],
      }),
    );
    expect(byId.TrafficMirrorFilterRules).toHaveLength(1);
  });
});
