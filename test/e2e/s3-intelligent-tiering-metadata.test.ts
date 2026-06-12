import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateBucketCommand,
  CreateBucketMetadataConfigurationCommand,
  CreateBucketMetadataTableConfigurationCommand,
  DeleteBucketIntelligentTieringConfigurationCommand,
  DeleteBucketMetadataConfigurationCommand,
  DeleteBucketMetadataTableConfigurationCommand,
  GetBucketIntelligentTieringConfigurationCommand,
  GetBucketMetadataConfigurationCommand,
  GetBucketMetadataTableConfigurationCommand,
  ListBucketIntelligentTieringConfigurationsCommand,
  PutBucketIntelligentTieringConfigurationCommand,
  S3Client,
  UpdateBucketMetadataInventoryTableConfigurationCommand,
  UpdateBucketMetadataJournalTableConfigurationCommand,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("S3 intelligent-tiering and metadata config ops e2e", () => {
  const s3 = () =>
    new S3Client({
      endpoint,
      region,
      credentials,
      requestHandler,
      forcePathStyle: true,
    });
  const bucket = "bunsai-e2e-s3-it-meta-config";

  test("intelligent-tiering: put, get, list, delete", async () => {
    const client = s3();
    await client.send(new CreateBucketCommand({ Bucket: bucket }));

    await client.send(
      new PutBucketIntelligentTieringConfigurationCommand({
        Bucket: bucket,
        Id: "tier1",
        IntelligentTieringConfiguration: {
          Id: "tier1",
          Status: "Enabled",
          Tierings: [{ AccessTier: "ARCHIVE_ACCESS", Days: 90 }],
        },
      }),
    );

    await client.send(
      new PutBucketIntelligentTieringConfigurationCommand({
        Bucket: bucket,
        Id: "tier2",
        IntelligentTieringConfiguration: {
          Id: "tier2",
          Status: "Disabled",
          Tierings: [{ AccessTier: "DEEP_ARCHIVE_ACCESS", Days: 180 }],
        },
      }),
    );

    const got = await client.send(
      new GetBucketIntelligentTieringConfigurationCommand({
        Bucket: bucket,
        Id: "tier1",
      }),
    );
    expect(got.IntelligentTieringConfiguration?.Id).toBe("tier1");
    expect(got.IntelligentTieringConfiguration?.Status).toBe("Enabled");

    const listed = await client.send(
      new ListBucketIntelligentTieringConfigurationsCommand({ Bucket: bucket }),
    );
    expect(
      (listed.IntelligentTieringConfigurationList ?? []).length,
    ).toBe(2);
    expect(listed.IsTruncated).toBe(false);

    await client.send(
      new DeleteBucketIntelligentTieringConfigurationCommand({
        Bucket: bucket,
        Id: "tier1",
      }),
    );

    const listedAfter = await client.send(
      new ListBucketIntelligentTieringConfigurationsCommand({ Bucket: bucket }),
    );
    expect(
      (listedAfter.IntelligentTieringConfigurationList ?? []).length,
    ).toBe(1);
    expect(listedAfter.IntelligentTieringConfigurationList?.[0]?.Id).toBe(
      "tier2",
    );
  });

  test("metadataConfiguration: create, get, delete", async () => {
    const client = s3();

    await client.send(
      new CreateBucketMetadataConfigurationCommand({
        Bucket: bucket,
        MetadataConfiguration: {
          JournalTableConfiguration: {
            RecordExpiration: {
              Expiration: "ENABLED",
              Days: 30,
            },
          },
        },
      }),
    );

    const got = await client.send(
      new GetBucketMetadataConfigurationCommand({ Bucket: bucket }),
    );
    expect(got.GetBucketMetadataConfigurationResult).toBeDefined();

    await client.send(
      new DeleteBucketMetadataConfigurationCommand({ Bucket: bucket }),
    );

    await expect(
      client.send(new GetBucketMetadataConfigurationCommand({ Bucket: bucket })),
    ).rejects.toThrow();
  });

  test("metadataTable: create, get, delete", async () => {
    const client = s3();

    await client.send(
      new CreateBucketMetadataTableConfigurationCommand({
        Bucket: bucket,
        MetadataTableConfiguration: {
          S3TablesDestination: {
            TableBucketArn: "arn:aws:s3tables:us-east-1:123456789012:bucket/test",
            TableName: "metadata",
          },
        },
      }),
    );

    const got = await client.send(
      new GetBucketMetadataTableConfigurationCommand({ Bucket: bucket }),
    );
    expect(got.GetBucketMetadataTableConfigurationResult).toBeDefined();

    await client.send(
      new DeleteBucketMetadataTableConfigurationCommand({ Bucket: bucket }),
    );

    await expect(
      client.send(
        new GetBucketMetadataTableConfigurationCommand({ Bucket: bucket }),
      ),
    ).rejects.toThrow();
  });

  test("metadataInventoryTable: update", async () => {
    const client = s3();

    await client.send(
      new UpdateBucketMetadataInventoryTableConfigurationCommand({
        Bucket: bucket,
        InventoryTableConfiguration: {
          ConfigurationState: "ENABLED",
        },
      }),
    );
  });

  test("metadataJournalTable: update", async () => {
    const client = s3();

    await client.send(
      new UpdateBucketMetadataJournalTableConfigurationCommand({
        Bucket: bucket,
        JournalTableConfiguration: {
          RecordExpiration: {
            Expiration: "ENABLED",
            Days: 30,
          },
        },
      }),
    );
  });
});
