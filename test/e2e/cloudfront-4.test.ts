import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFrontClient,
  CreateDistributionCommand,
  CreateOriginAccessControlCommand,
  DeleteDistributionCommand,
  DeleteOriginAccessControlCommand,
  GetDistributionConfigCommand,
  GetOriginAccessControlCommand,
  ListDistributionsCommand,
  ListOriginAccessControlsCommand,
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
  const cfg = await client.send(new GetDistributionConfigCommand({ Id: id }));
  await client.send(
    new UpdateDistributionCommand({
      Id: id,
      IfMatch: cfg.ETag,
      DistributionConfig: { ...cfg.DistributionConfig, Enabled: false },
    }),
  );
  await client.send(new DeleteDistributionCommand({ Id: id }));
};

test("CloudFront distribution fidelity: 2 origins + CacheBehavior round-trip", async () => {
  const client = cloudfront();
  const callerRef = `fidelity-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: callerRef,
        Comment: "fidelity test",
        Enabled: true,
        DefaultRootObject: "index.html",
        PriceClass: "PriceClass_100",
        Origins: {
          Quantity: 2,
          Items: [
            {
              Id: "origin-s3",
              DomainName: "mybucket.s3.amazonaws.com",
              OriginPath: "/prefix",
              S3OriginConfig: { OriginAccessIdentity: "" },
            },
            {
              Id: "origin-custom",
              DomainName: "api.example.com",
              OriginPath: "/v1",
              CustomOriginConfig: {
                HTTPPort: 80,
                HTTPSPort: 443,
                OriginProtocolPolicy: "https-only" as const,
              },
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: "origin-s3",
          ViewerProtocolPolicy: "redirect-to-https" as const,
          AllowedMethods: {
            Quantity: 2,
            Items: ["GET", "HEAD"],
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: "none" as const },
          },
          MinTTL: 0,
        },
        CacheBehaviors: {
          Quantity: 1,
          Items: [
            {
              PathPattern: "/api/*",
              TargetOriginId: "origin-custom",
              ViewerProtocolPolicy: "https-only" as const,
              AllowedMethods: {
                Quantity: 7,
                Items: [
                  "GET",
                  "HEAD",
                  "OPTIONS",
                  "PUT",
                  "POST",
                  "PATCH",
                  "DELETE",
                ],
              },
              ForwardedValues: {
                QueryString: true,
                Cookies: { Forward: "all" as const },
              },
              MinTTL: 0,
            },
          ],
        },
      },
    }),
  );
  const id = created.Distribution?.Id;
  expect(id).toBeDefined();
  expect(created.ETag).toBeDefined();

  const config = await client.send(
    new GetDistributionConfigCommand({ Id: id }),
  );
  const dc = config.DistributionConfig;
  expect(dc?.Comment).toBe("fidelity test");
  expect(dc?.DefaultRootObject).toBe("index.html");
  expect(dc?.PriceClass).toBe("PriceClass_100");
  expect(dc?.Enabled).toBe(true);

  expect(dc?.Origins?.Quantity).toBe(2);
  const origins = dc?.Origins?.Items ?? [];
  const s3Origin = origins.find((o) => o.Id === "origin-s3");
  expect(s3Origin?.DomainName).toBe("mybucket.s3.amazonaws.com");
  expect(s3Origin?.OriginPath).toBe("/prefix");

  const customOrigin = origins.find((o) => o.Id === "origin-custom");
  expect(customOrigin?.DomainName).toBe("api.example.com");
  expect(customOrigin?.CustomOriginConfig?.OriginProtocolPolicy).toBe(
    "https-only",
  );

  expect(dc?.DefaultCacheBehavior?.TargetOriginId).toBe("origin-s3");
  expect(dc?.DefaultCacheBehavior?.ViewerProtocolPolicy).toBe(
    "redirect-to-https",
  );

  expect(dc?.CacheBehaviors?.Quantity).toBe(1);
  const behavior = (dc?.CacheBehaviors?.Items ?? [])[0];
  expect(behavior?.PathPattern).toBe("/api/*");
  expect(behavior?.TargetOriginId).toBe("origin-custom");
  expect(behavior?.ViewerProtocolPolicy).toBe("https-only");

  const etag = config.ETag;
  expect(etag).toBeDefined();

  const updated = await client.send(
    new UpdateDistributionCommand({
      Id: id,
      IfMatch: etag,
      DistributionConfig: {
        CallerReference: callerRef,
        Comment: "fidelity test updated",
        Enabled: true,
        DefaultRootObject: "index.html",
        PriceClass: "PriceClass_100",
        Origins: {
          Quantity: 2,
          Items: [
            {
              Id: "origin-s3",
              DomainName: "mybucket.s3.amazonaws.com",
              OriginPath: "/prefix",
              S3OriginConfig: { OriginAccessIdentity: "" },
            },
            {
              Id: "origin-custom",
              DomainName: "api.example.com",
              OriginPath: "/v1",
              CustomOriginConfig: {
                HTTPPort: 80,
                HTTPSPort: 443,
                OriginProtocolPolicy: "https-only" as const,
              },
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: "origin-s3",
          ViewerProtocolPolicy: "redirect-to-https" as const,
          AllowedMethods: {
            Quantity: 2,
            Items: ["GET", "HEAD"],
          },
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: "none" as const },
          },
          MinTTL: 0,
        },
        CacheBehaviors: {
          Quantity: 1,
          Items: [
            {
              PathPattern: "/api/v2/*",
              TargetOriginId: "origin-custom",
              ViewerProtocolPolicy: "https-only" as const,
              AllowedMethods: {
                Quantity: 2,
                Items: ["GET", "HEAD"],
              },
              ForwardedValues: {
                QueryString: false,
                Cookies: { Forward: "none" as const },
              },
              MinTTL: 300,
            },
          ],
        },
      },
    }),
  );
  expect(updated.Distribution?.Id).toBe(id);
  expect(updated.Distribution?.DistributionConfig?.Comment).toBe(
    "fidelity test updated",
  );

  const afterUpdate = await client.send(
    new GetDistributionConfigCommand({ Id: id }),
  );
  const updatedBehavior = (afterUpdate.DistributionConfig?.CacheBehaviors
    ?.Items ?? [])[0];
  expect(updatedBehavior?.PathPattern).toBe("/api/v2/*");
  expect(updatedBehavior?.MinTTL).toBe(300);

  const listed = await client.send(new ListDistributionsCommand({}));
  const dist = (listed.DistributionList?.Items ?? []).find((d) => d.Id === id);
  expect(dist).toBeDefined();
  expect(dist?.CacheBehaviors?.Quantity).toBe(1);

  await disableAndDelete(client, id!);
});

test("CloudFront missing distribution → NoSuchDistribution", async () => {
  const client = cloudfront();

  await expect(
    client.send(new GetDistributionConfigCommand({ Id: "NONEXISTENT-ID" })),
  ).rejects.toThrow();
});

test("CloudFront OAC full lifecycle: Create → Get → List → Delete", async () => {
  const client = cloudfront();
  const name = `oac-full-${Date.now()}`;

  const created = await client.send(
    new CreateOriginAccessControlCommand({
      OriginAccessControlConfig: {
        Name: name,
        SigningProtocol: "sigv4",
        SigningBehavior: "always",
        OriginAccessControlOriginType: "s3",
        Description: "e2e test OAC",
      },
    }),
  );
  const oacId = created.OriginAccessControl?.Id;
  expect(oacId).toBeDefined();
  expect(created.ETag).toBeDefined();
  expect(created.OriginAccessControl?.OriginAccessControlConfig?.Name).toBe(
    name,
  );

  const got = await client.send(
    new GetOriginAccessControlCommand({ Id: oacId }),
  );
  expect(got.OriginAccessControl?.Id).toBe(oacId);
  expect(
    got.OriginAccessControl?.OriginAccessControlConfig?.SigningProtocol,
  ).toBe("sigv4");
  expect(
    got.OriginAccessControl?.OriginAccessControlConfig?.SigningBehavior,
  ).toBe("always");
  expect(
    got.OriginAccessControl?.OriginAccessControlConfig
      ?.OriginAccessControlOriginType,
  ).toBe("s3");

  const listed = await client.send(new ListOriginAccessControlsCommand({}));
  const ids = (listed.OriginAccessControlList?.Items ?? []).map((o) => o.Id);
  expect(ids).toContain(oacId);

  await client.send(
    new DeleteOriginAccessControlCommand({ Id: oacId, IfMatch: got.ETag }),
  );

  const afterDelete = await client.send(
    new ListOriginAccessControlsCommand({}),
  );
  const idsAfter = (afterDelete.OriginAccessControlList?.Items ?? []).map(
    (o) => o.Id,
  );
  expect(idsAfter).not.toContain(oacId);
});
