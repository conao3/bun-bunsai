import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import type { DistributionConfig } from "@aws-sdk/client-cloudfront";
import {
  CloudFrontClient,
  CreateDistributionCommand,
  CreateInvalidationCommand,
  DeleteDistributionCommand,
  GetDistributionCommand,
  GetDistributionConfigCommand,
  GetInvalidationCommand,
  ListDistributionsCommand,
  ListInvalidationsCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudfront = () =>
  new CloudFrontClient({ endpoint, region, credentials, requestHandler });

describe("CloudFront CDN delivery config scenario e2e", () => {
  test("S3-origin distribution: create → update (ETag guard) → invalidation → disable → delete", async () => {
    const client = cloudfront();
    const callerRef = `cf-scenario-${Date.now()}`;
    const bucket = "bunsai-e2e-cf-scenario";

    const baseConfig: DistributionConfig = {
      CallerReference: callerRef,
      Comment: "cdn-scenario-initial",
      Enabled: true,
      Origins: {
        Quantity: 1,
        Items: [
          {
            Id: "s3-origin",
            DomainName: `${bucket}.s3.amazonaws.com`,
            S3OriginConfig: { OriginAccessIdentity: "" },
          },
        ],
      },
      DefaultCacheBehavior: {
        TargetOriginId: "s3-origin",
        ViewerProtocolPolicy: "redirect-to-https",
        ForwardedValues: {
          QueryString: false,
          Cookies: { Forward: "none" },
        },
        MinTTL: 0,
      },
    };

    const created = await client.send(
      new CreateDistributionCommand({ DistributionConfig: baseConfig }),
    );
    const distId = created.Distribution?.Id;
    expect(distId).toBeDefined();
    expect(created.Distribution?.ARN).toContain(`distribution/${distId}`);
    expect(created.Distribution?.DomainName).toMatch(/\.cloudfront\.net$/);
    const createETag = created.ETag;
    expect(createETag).toBeDefined();

    const got = await client.send(new GetDistributionCommand({ Id: distId }));
    expect(got.Distribution?.Status).toBe("Deployed");
    expect(got.Distribution?.DistributionConfig?.Comment).toBe(
      "cdn-scenario-initial",
    );
    expect(
      got.Distribution?.DistributionConfig?.Origins?.Items?.[0]?.DomainName,
    ).toBe(`${bucket}.s3.amazonaws.com`);
    expect(got.ETag).toBe(createETag);

    await expect(
      client.send(
        new UpdateDistributionCommand({
          Id: distId,
          IfMatch: "ETAGSTALE000000",
          DistributionConfig: { ...baseConfig, Comment: "should-fail" },
        }),
      ),
    ).rejects.toThrow();

    const configResp = await client.send(
      new GetDistributionConfigCommand({ Id: distId }),
    );
    const currentETag = configResp.ETag;
    expect(currentETag).toBe(createETag);

    const updated = await client.send(
      new UpdateDistributionCommand({
        Id: distId,
        IfMatch: currentETag,
        DistributionConfig: {
          ...baseConfig,
          Comment: "cdn-scenario-updated",
        },
      }),
    );
    expect(updated.Distribution?.DistributionConfig?.Comment).toBe(
      "cdn-scenario-updated",
    );
    const updatedETag = updated.ETag;
    expect(updatedETag).toBeDefined();
    expect(updatedETag).not.toBe(createETag);

    const invalRef = `inval-scenario-${Date.now()}`;
    const inval = await client.send(
      new CreateInvalidationCommand({
        DistributionId: distId,
        InvalidationBatch: {
          CallerReference: invalRef,
          Paths: { Quantity: 1, Items: ["/*"] },
        },
      }),
    );
    const invalId = inval.Invalidation?.Id;
    expect(invalId).toBeDefined();
    expect(inval.Invalidation?.Status).toBe("InProgress");

    const gotInval = await client.send(
      new GetInvalidationCommand({ DistributionId: distId, Id: invalId }),
    );
    expect(gotInval.Invalidation?.Status).toBe("Completed");
    expect(gotInval.Invalidation?.InvalidationBatch?.Paths?.Items).toEqual([
      "/*",
    ]);

    const listedInval = await client.send(
      new ListInvalidationsCommand({ DistributionId: distId }),
    );
    const invalItems = listedInval.InvalidationList?.Items ?? [];
    expect(invalItems.some((i) => i.Id === invalId)).toBe(true);
    expect(invalItems.find((i) => i.Id === invalId)?.Status).toBe("Completed");

    const listed = await client.send(new ListDistributionsCommand({}));
    const summary = (listed.DistributionList?.Items ?? []).find(
      (d) => d.Id === distId,
    );
    expect(summary).toBeDefined();
    expect(summary?.Enabled).toBe(true);

    await expect(
      client.send(new DeleteDistributionCommand({ Id: distId })),
    ).rejects.toThrow();

    const afterGuard = await client.send(
      new GetDistributionConfigCommand({ Id: distId }),
    );
    const disableETag = afterGuard.ETag;
    await client.send(
      new UpdateDistributionCommand({
        Id: distId,
        IfMatch: disableETag,
        DistributionConfig: {
          ...(afterGuard.DistributionConfig as DistributionConfig),
          Enabled: false,
        },
      }),
    );

    const finalCfg = await client.send(
      new GetDistributionConfigCommand({ Id: distId }),
    );
    await client.send(
      new DeleteDistributionCommand({ Id: distId, IfMatch: finalCfg.ETag }),
    );

    await expect(
      client.send(new GetDistributionCommand({ Id: distId })),
    ).rejects.toThrow();
  }, 20_000);
});
