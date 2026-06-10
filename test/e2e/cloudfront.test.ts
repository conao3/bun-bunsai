import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateDistributionWebACLCommand,
  CloudFrontClient,
  CopyDistributionCommand,
  CreateCloudFrontOriginAccessIdentityCommand,
  CreateDistributionCommand,
  CreateDistributionWithTagsCommand,
  CreateInvalidationCommand,
  CreateMonitoringSubscriptionCommand,
  CreateOriginAccessControlCommand,
  DeleteCloudFrontOriginAccessIdentityCommand,
  DeleteDistributionCommand,
  DeleteMonitoringSubscriptionCommand,
  DeleteOriginAccessControlCommand,
  DisassociateDistributionWebACLCommand,
  GetCloudFrontOriginAccessIdentityCommand,
  GetCloudFrontOriginAccessIdentityConfigCommand,
  GetDistributionCommand,
  GetDistributionConfigCommand,
  GetInvalidationCommand,
  GetMonitoringSubscriptionCommand,
  GetOriginAccessControlCommand,
  ListDistributionsCommand,
  ListInvalidationsCommand,
  UpdateCloudFrontOriginAccessIdentityCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudfront = () =>
  new CloudFrontClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const disableAndDelete = async (
  client: CloudFrontClient,
  id: string,
): Promise<void> => {
  const cfg = await client.send(
    new GetDistributionConfigCommand({ Id: id }),
  );
  await client.send(
    new UpdateDistributionCommand({
      Id: id,
      IfMatch: cfg.ETag,
      DistributionConfig: { ...cfg.DistributionConfig, Enabled: false },
    }),
  );
  await client.send(new DeleteDistributionCommand({ Id: id }));
};

const distributionConfig = (callerReference: string, comment: string) => ({
  CallerReference: callerReference,
  Comment: comment,
  Enabled: true,
  Origins: {
    Quantity: 1,
    Items: [
      {
        Id: "origin-1",
        DomainName: "example.com",
        CustomOriginConfig: {
          HTTPPort: 80,
          HTTPSPort: 443,
          OriginProtocolPolicy: "https-only" as const,
        },
      },
    ],
  },
  DefaultCacheBehavior: {
    TargetOriginId: "origin-1",
    ViewerProtocolPolicy: "allow-all" as const,
    ForwardedValues: {
      QueryString: false,
      Cookies: { Forward: "none" as const },
    },
    MinTTL: 0,
  },
});

test("CloudFront distribution lifecycle and invalidation", async () => {
  const client = cloudfront();
  const callerReference = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(callerReference, "initial"),
    }),
  );
  const id = created.Distribution?.Id;
  expect(id).toBeDefined();
  expect(created.Distribution?.ARN).toContain("distribution/");
  expect(created.Distribution?.DomainName).toContain(".cloudfront.net");
  expect(created.ETag).toBeDefined();

  const got = await client.send(new GetDistributionCommand({ Id: id }));
  expect(got.Distribution?.Id).toBe(id);
  expect(got.Distribution?.DistributionConfig?.Comment).toBe("initial");

  const listed = await client.send(new ListDistributionsCommand({}));
  const ids = (listed.DistributionList?.Items ?? []).map((d) => d.Id);
  expect(ids).toContain(id);

  const updated = await client.send(
    new UpdateDistributionCommand({
      Id: id,
      IfMatch: got.ETag,
      DistributionConfig: distributionConfig(callerReference, "updated"),
    }),
  );
  expect(updated.Distribution?.Id).toBe(id);
  expect(updated.Distribution?.DistributionConfig?.Comment).toBe("updated");

  const invalidation = await client.send(
    new CreateInvalidationCommand({
      DistributionId: id,
      InvalidationBatch: {
        CallerReference: `inval-${Date.now()}`,
        Paths: { Quantity: 1, Items: ["/*"] },
      },
    }),
  );
  expect(invalidation.Invalidation?.Id).toBeDefined();
  expect(invalidation.Invalidation?.Status).toBe("InProgress");

  await disableAndDelete(client, id!);
  const afterDelete = await client.send(new ListDistributionsCommand({}));
  const idsAfter = (afterDelete.DistributionList?.Items ?? []).map((d) => d.Id);
  expect(idsAfter).not.toContain(id);
});

test("CloudFront OAI lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateCloudFrontOriginAccessIdentityCommand({
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: `oai-e2e-${Date.now()}`,
        Comment: "test oai",
      },
    }),
  );
  const oaiId = created.CloudFrontOriginAccessIdentity?.Id;
  expect(oaiId).toBeDefined();
  expect(created.ETag).toBeDefined();

  const got = await client.send(
    new GetCloudFrontOriginAccessIdentityCommand({ Id: oaiId }),
  );
  expect(got.CloudFrontOriginAccessIdentity?.Id).toBe(oaiId);

  const gotConfig = await client.send(
    new GetCloudFrontOriginAccessIdentityConfigCommand({ Id: oaiId }),
  );
  expect(gotConfig.CloudFrontOriginAccessIdentityConfig?.Comment).toBe(
    "test oai",
  );

  const upd = await client.send(
    new UpdateCloudFrontOriginAccessIdentityCommand({
      Id: oaiId,
      IfMatch: got.ETag,
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: `oai-e2e-${Date.now()}`,
        Comment: "updated oai",
      },
    }),
  );
  expect(upd.CloudFrontOriginAccessIdentity?.Id).toBe(oaiId);
  expect(upd.ETag).not.toBe(got.ETag);

  await client.send(
    new DeleteCloudFrontOriginAccessIdentityCommand({
      Id: oaiId,
      IfMatch: upd.ETag,
    }),
  );
});

test("CloudFront OAC lifecycle", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: `oac-e2e-${Date.now()}`,
        SigningProtocol: "sigv4",
        SigningBehavior: "always",
        OriginAccessControlOriginType: "s3",
      },
    }),
  );
  const oacId = created.OriginAccessControl?.Id;
  expect(oacId).toBeDefined();
  expect(created.ETag).toBeDefined();

  const got = await client.send(
    new GetOriginAccessControlCommand({ Id: oacId }),
  );
  expect(got.OriginAccessControl?.Id).toBe(oacId);
  expect(
    got.OriginAccessControl?.OriginAccessControlConfig?.SigningProtocol,
  ).toBe("sigv4");

  await client.send(
    new DeleteOriginAccessControlCommand({ Id: oacId, IfMatch: got.ETag }),
  );
});

test("CloudFront distribution copy and get-config", async () => {
  const client = cloudfront();
  const callerReference = `copy-e2e-${Date.now()}`;

  const primary = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(callerReference, "primary"),
    }),
  );
  const primaryId = primary.Distribution?.Id;
  expect(primaryId).toBeDefined();

  const config = await client.send(
    new GetDistributionConfigCommand({ Id: primaryId }),
  );
  expect(config.DistributionConfig?.Comment).toBe("primary");
  expect(config.ETag).toBeDefined();

  const copied = await client.send(
    new CopyDistributionCommand({
      PrimaryDistributionId: primaryId,
      CallerReference: `copy-${Date.now()}`,
      Staging: false,
    }),
  );
  const copiedId = copied.Distribution?.Id;
  expect(copiedId).toBeDefined();
  expect(copiedId).not.toBe(primaryId);

  await disableAndDelete(client, primaryId!);
  await disableAndDelete(client, copiedId!);
});

test("CloudFront invalidation get and list", async () => {
  const client = cloudfront();

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(
        `inval-e2e-${Date.now()}`,
        "inval test",
      ),
    }),
  );
  const distId = dist.Distribution?.Id;
  expect(distId).toBeDefined();

  const inv = await client.send(
    new CreateInvalidationCommand({
      DistributionId: distId,
      InvalidationBatch: {
        CallerReference: `inv-${Date.now()}`,
        Paths: { Quantity: 1, Items: ["/img/*"] },
      },
    }),
  );
  const invId = inv.Invalidation?.Id;
  expect(invId).toBeDefined();

  const got = await client.send(
    new GetInvalidationCommand({ DistributionId: distId, Id: invId }),
  );
  expect(got.Invalidation?.Id).toBe(invId);
  expect(got.Invalidation?.Status).toBe("Completed");

  const listed = await client.send(
    new ListInvalidationsCommand({ DistributionId: distId }),
  );
  const invIds = (listed.InvalidationList?.Items ?? []).map((i) => i.Id);
  expect(invIds).toContain(invId);

  await disableAndDelete(client, distId!);
});

test("CloudFront monitoring subscription lifecycle", async () => {
  const client = cloudfront();

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(
        `monsub-e2e-${Date.now()}`,
        "monsub test",
      ),
    }),
  );
  const distId = dist.Distribution?.Id;
  expect(distId).toBeDefined();

  await client.send(
    new CreateMonitoringSubscriptionCommand({
      DistributionId: distId,
      MonitoringSubscription: {
        RealtimeMetricsSubscriptionConfig: {
          RealtimeMetricsSubscriptionStatus: "Enabled",
        },
      },
    }),
  );

  const got = await client.send(
    new GetMonitoringSubscriptionCommand({ DistributionId: distId }),
  );
  expect(
    got.MonitoringSubscription?.RealtimeMetricsSubscriptionConfig
      ?.RealtimeMetricsSubscriptionStatus,
  ).toBe("Enabled");

  await client.send(
    new DeleteMonitoringSubscriptionCommand({ DistributionId: distId }),
  );

  await disableAndDelete(client, distId!);
});

test("CloudFront WebACL associate and disassociate", async () => {
  const client = cloudfront();

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(
        `webacl-e2e-${Date.now()}`,
        "webacl test",
      ),
    }),
  );
  const distId = dist.Distribution?.Id;
  expect(distId).toBeDefined();
  const etag = dist.ETag;

  const webAclArn =
    "arn:aws:wafv2:us-east-1:123456789012:global/webacl/test/abc";

  const assoc = await client.send(
    new AssociateDistributionWebACLCommand({
      Id: distId,
      WebACLArn: webAclArn,
      IfMatch: etag,
    }),
  );
  expect(assoc.Id).toBe(distId);
  expect(assoc.WebACLArn).toBe(webAclArn);
  expect(assoc.ETag).toBeDefined();

  const disassoc = await client.send(
    new DisassociateDistributionWebACLCommand({
      Id: distId,
      IfMatch: assoc.ETag,
    }),
  );
  expect(disassoc.Id).toBe(distId);
  expect(disassoc.ETag).toBeDefined();

  await disableAndDelete(client, distId!);
});

test("CloudFront CreateDistributionWithTags", async () => {
  const client = cloudfront();

  const created = await client.send(
    new CreateDistributionWithTagsCommand({
      DistributionConfigWithTags: {
        DistributionConfig: distributionConfig(
          `tags-e2e-${Date.now()}`,
          "with-tags",
        ),
        Tags: { Items: [{ Key: "env", Value: "test" }] },
      },
    }),
  );
  const id = created.Distribution?.Id;
  expect(id).toBeDefined();
  expect(created.Distribution?.DistributionConfig?.Comment).toBe("with-tags");

  await disableAndDelete(client, id!);
});
