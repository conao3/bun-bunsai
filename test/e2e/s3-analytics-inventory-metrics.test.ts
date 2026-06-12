import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  DeleteBucketAnalyticsConfigurationCommand,
  DeleteBucketInventoryConfigurationCommand,
  DeleteBucketMetricsConfigurationCommand,
  GetBucketAnalyticsConfigurationCommand,
  GetBucketInventoryConfigurationCommand,
  GetBucketMetricsConfigurationCommand,
  ListBucketAnalyticsConfigurationsCommand,
  ListBucketInventoryConfigurationsCommand,
  ListBucketMetricsConfigurationsCommand,
  PutBucketAnalyticsConfigurationCommand,
  PutBucketInventoryConfigurationCommand,
  PutBucketMetricsConfigurationCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 analytics/inventory/metrics config ops e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-aim-config";

  test("analytics: put, get, list, delete", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutBucketAnalyticsConfigurationCommand({
        Bucket: bucket,
        Id: "config1",
        AnalyticsConfiguration: {
          Id: "config1",
          StorageClassAnalysis: {},
        },
      }),
    );

    await client.send(
      new PutBucketAnalyticsConfigurationCommand({
        Bucket: bucket,
        Id: "config2",
        AnalyticsConfiguration: {
          Id: "config2",
          StorageClassAnalysis: {},
        },
      }),
    );

    const got = await client.send(
      new GetBucketAnalyticsConfigurationCommand({
        Bucket: bucket,
        Id: "config1",
      }),
    );
    expect(got.AnalyticsConfiguration?.Id).toBe("config1");

    const listed = await client.send(
      new ListBucketAnalyticsConfigurationsCommand({ Bucket: bucket }),
    );
    expect((listed.AnalyticsConfigurationList ?? []).length).toBe(2);
    expect(listed.IsTruncated).toBe(false);

    await client.send(
      new DeleteBucketAnalyticsConfigurationCommand({
        Bucket: bucket,
        Id: "config1",
      }),
    );

    const listedAfter = await client.send(
      new ListBucketAnalyticsConfigurationsCommand({ Bucket: bucket }),
    );
    expect((listedAfter.AnalyticsConfigurationList ?? []).length).toBe(1);
    expect(listedAfter.AnalyticsConfigurationList?.[0]?.Id).toBe("config2");
  });

  test("inventory: put, get, list, delete", async () => {
    const client = s3();

    await client.send(
      new PutBucketInventoryConfigurationCommand({
        Bucket: bucket,
        Id: "inv1",
        InventoryConfiguration: {
          Id: "inv1",
          IsEnabled: true,
          Destination: {
            S3BucketDestination: {
              Bucket: `arn:aws:s3:::${bucket}`,
              Format: "CSV",
            },
          },
          IncludedObjectVersions: "All",
          Schedule: { Frequency: "Daily" },
        },
      }),
    );

    const got = await client.send(
      new GetBucketInventoryConfigurationCommand({
        Bucket: bucket,
        Id: "inv1",
      }),
    );
    expect(got.InventoryConfiguration?.Id).toBe("inv1");
    expect(got.InventoryConfiguration?.IsEnabled).toBe(true);

    const listed = await client.send(
      new ListBucketInventoryConfigurationsCommand({ Bucket: bucket }),
    );
    expect(
      (listed.InventoryConfigurationList ?? []).length,
    ).toBeGreaterThanOrEqual(1);

    await client.send(
      new DeleteBucketInventoryConfigurationCommand({
        Bucket: bucket,
        Id: "inv1",
      }),
    );

    const listedAfter = await client.send(
      new ListBucketInventoryConfigurationsCommand({ Bucket: bucket }),
    );
    const remaining = (listedAfter.InventoryConfigurationList ?? []).filter(
      (c) => c.Id === "inv1",
    );
    expect(remaining.length).toBe(0);
  });

  test("metrics: put, get, list, delete", async () => {
    const client = s3();

    await client.send(
      new PutBucketMetricsConfigurationCommand({
        Bucket: bucket,
        Id: "metrics1",
        MetricsConfiguration: {
          Id: "metrics1",
        },
      }),
    );

    const got = await client.send(
      new GetBucketMetricsConfigurationCommand({
        Bucket: bucket,
        Id: "metrics1",
      }),
    );
    expect(got.MetricsConfiguration?.Id).toBe("metrics1");

    const listed = await client.send(
      new ListBucketMetricsConfigurationsCommand({ Bucket: bucket }),
    );
    expect(
      (listed.MetricsConfigurationList ?? []).length,
    ).toBeGreaterThanOrEqual(1);

    await client.send(
      new DeleteBucketMetricsConfigurationCommand({
        Bucket: bucket,
        Id: "metrics1",
      }),
    );

    const listedAfter = await client.send(
      new ListBucketMetricsConfigurationsCommand({ Bucket: bucket }),
    );
    const remaining = (listedAfter.MetricsConfigurationList ?? []).filter(
      (c) => c.Id === "metrics1",
    );
    expect(remaining.length).toBe(0);
  });
});
