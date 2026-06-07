import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BundleInstanceCommand,
  CreateCapacityManagerDataExportCommand,
  DescribeAddressTransfersCommand,
  DescribeAddressesAttributeCommand,
  DescribeAggregateIdFormatCommand,
  DescribeAwsNetworkPerformanceMetricSubscriptionsCommand,
  DescribeBundleTasksCommand,
  DescribeByoipCidrsCommand,
  DescribeCapacityBlockExtensionHistoryCommand,
  DescribeCapacityBlockExtensionOfferingsCommand,
  DescribeCapacityBlockOfferingsCommand,
  DescribeCapacityBlockStatusCommand,
  DescribeCapacityBlocksCommand,
  DescribeCapacityManagerDataExportsCommand,
  EC2Client,
} from "@aws-sdk/client-ec2";
import type { EC2Client as EC2ClientType } from "@aws-sdk/client-ec2";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("ec2 chunk22 describe addresses/bundle/byoip/capacity e2e", () => {
  const ec2 = (): EC2ClientType =>
    new EC2Client({ endpoint, region, credentials, requestHandler });

  test("DescribeAddressTransfers: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeAddressTransfersCommand({}));
    expect(res.AddressTransfers).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeAddressesAttribute: returns empty list when no EIPs", async () => {
    const client = ec2();
    const res = await client.send(new DescribeAddressesAttributeCommand({}));
    expect(Array.isArray(res.Addresses)).toBe(true);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeAggregateIdFormat: returns UseLongIdsAggregated true", async () => {
    const client = ec2();
    const res = await client.send(new DescribeAggregateIdFormatCommand({}));
    expect(res.UseLongIdsAggregated).toBe(true);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeAwsNetworkPerformanceMetricSubscriptions: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeAwsNetworkPerformanceMetricSubscriptionsCommand({}),
    );
    expect(res.Subscriptions).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("BundleInstance then DescribeBundleTasks: round-trip", async () => {
    const client = ec2();

    const bundleRes = await client.send(
      new BundleInstanceCommand({
        InstanceId: "i-chunk22test",
        Storage: { S3: { Bucket: "my-bucket", Prefix: "my-prefix" } },
      }),
    );
    const bundleId = bundleRes.BundleTask?.BundleId ?? "";
    expect(bundleId.startsWith("bun-")).toBe(true);

    const descRes = await client.send(new DescribeBundleTasksCommand({}));
    const ids = (descRes.BundleTasks ?? []).map((t) => t.BundleId);
    expect(ids).toContain(bundleId);

    const filteredRes = await client.send(
      new DescribeBundleTasksCommand({ BundleIds: [bundleId] }),
    );
    expect(filteredRes.BundleTasks).toHaveLength(1);
    expect(filteredRes.BundleTasks![0]!.BundleId).toBe(bundleId);
    expect(filteredRes.BundleTasks![0]!.InstanceId).toBe("i-chunk22test");
  });

  test("DescribeByoipCidrs: returns empty list when none provisioned", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeByoipCidrsCommand({ MaxResults: 10 }),
    );
    expect(Array.isArray(res.ByoipCidrs)).toBe(true);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeCapacityBlockExtensionHistory: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeCapacityBlockExtensionHistoryCommand({}),
    );
    expect(res.CapacityBlockExtensions).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeCapacityBlockExtensionOfferings: returns synthetic offering", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeCapacityBlockExtensionOfferingsCommand({
        CapacityReservationId: "cr-abc123",
        CapacityBlockExtensionDurationHours: 24,
      }),
    );
    const offerings = res.CapacityBlockExtensionOfferings ?? [];
    expect(offerings.length).toBeGreaterThan(0);
    expect(offerings[0]?.CapacityBlockExtensionDurationHours).toBe(24);
  });

  test("DescribeCapacityBlockOfferings: returns synthetic offering", async () => {
    const client = ec2();
    const res = await client.send(
      new DescribeCapacityBlockOfferingsCommand({
        CapacityDurationHours: 24,
        InstanceType: "p4d.24xlarge",
      }),
    );
    const offerings = res.CapacityBlockOfferings ?? [];
    expect(offerings.length).toBeGreaterThan(0);
    expect(offerings[0]?.CapacityBlockDurationHours).toBe(24);
    expect(offerings[0]?.InstanceType).toBe("p4d.24xlarge");
  });

  test("DescribeCapacityBlockStatus: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeCapacityBlockStatusCommand({}));
    expect(res.CapacityBlockStatuses).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("DescribeCapacityBlocks: returns empty list", async () => {
    const client = ec2();
    const res = await client.send(new DescribeCapacityBlocksCommand({}));
    expect(res.CapacityBlocks).toEqual([]);
    expect(res.$metadata.httpStatusCode).toBe(200);
  });

  test("CreateCapacityManagerDataExport then DescribeCapacityManagerDataExports: round-trip", async () => {
    const client = ec2();

    const createRes = await client.send(
      new CreateCapacityManagerDataExportCommand({
        S3BucketName: "test-bucket",
        Schedule: "hourly",
        OutputFormat: "parquet",
      }),
    );
    const exportId = createRes.CapacityManagerDataExportId ?? "";
    expect(exportId.startsWith("cmde-")).toBe(true);

    const descRes = await client.send(
      new DescribeCapacityManagerDataExportsCommand({}),
    );
    const ids = (descRes.CapacityManagerDataExports ?? []).map(
      (e) => e.CapacityManagerDataExportId,
    );
    expect(ids).toContain(exportId);

    const filteredRes = await client.send(
      new DescribeCapacityManagerDataExportsCommand({
        CapacityManagerDataExportIds: [exportId],
      }),
    );
    expect(filteredRes.CapacityManagerDataExports).toHaveLength(1);
    expect(
      filteredRes.CapacityManagerDataExports![0]!.CapacityManagerDataExportId,
    ).toBe(exportId);
  });
});
