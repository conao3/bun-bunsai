import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFrontClient,
  CreateCachePolicyCommand,
  CreateCloudFrontOriginAccessIdentityCommand,
  CreateDistributionCommand,
  DeleteCachePolicyCommand,
  DeleteCloudFrontOriginAccessIdentityCommand,
  DeleteDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const cloudfront = () =>
  new CloudFrontClient({ endpoint, region, credentials, requestHandler });

const baseConfig = (callerRef: string) => ({
  CallerReference: callerRef,
  Comment: "test",
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

const disableAndDelete = async (client: CloudFrontClient, id: string) => {
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

test("HIGH-9: DeleteDistribution with Enabled=true → DistributionNotDisabled 409", async () => {
  const client = cloudfront();
  const callerRef = `del-enabled-${Date.now()}`;

  const created = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: baseConfig(callerRef),
    }),
  );
  const id = created.Distribution?.Id!;

  await expect(
    client.send(new DeleteDistributionCommand({ Id: id })),
  ).rejects.toThrow();

  await disableAndDelete(client, id);
});

test("HIGH-1: CreateDistribution same CallerReference + same config → idempotent", async () => {
  const client = cloudfront();
  const callerRef = `idem-same-${Date.now()}`;
  const config = baseConfig(callerRef);

  const first = await client.send(
    new CreateDistributionCommand({ DistributionConfig: config }),
  );
  const firstId = first.Distribution?.Id!;

  const second = await client.send(
    new CreateDistributionCommand({ DistributionConfig: config }),
  );
  expect(second.Distribution?.Id).toBe(firstId);

  await disableAndDelete(client, firstId);
});

test("HIGH-1: CreateDistribution same CallerReference + different config → DistributionAlreadyExists 409", async () => {
  const client = cloudfront();
  const callerRef = `idem-diff-${Date.now()}`;

  const first = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: { ...baseConfig(callerRef), Comment: "first" },
    }),
  );
  const id = first.Distribution?.Id!;

  await expect(
    client.send(
      new CreateDistributionCommand({
        DistributionConfig: { ...baseConfig(callerRef), Comment: "different" },
      }),
    ),
  ).rejects.toThrow();

  await disableAndDelete(client, id);
});

test("HIGH-2: CreateCloudFrontOriginAccessIdentity same CallerReference → AlreadyExists 409", async () => {
  const client = cloudfront();
  const callerRef = `oai-idem-${Date.now()}`;

  const created = await client.send(
    new CreateCloudFrontOriginAccessIdentityCommand({
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: callerRef,
        Comment: "test oai",
      },
    }),
  );
  const oaiId = created.CloudFrontOriginAccessIdentity?.Id!;

  await expect(
    client.send(
      new CreateCloudFrontOriginAccessIdentityCommand({
        CloudFrontOriginAccessIdentityConfig: {
          CallerReference: callerRef,
          Comment: "duplicate",
        },
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteCloudFrontOriginAccessIdentityCommand({
      Id: oaiId,
      IfMatch: created.ETag,
    }),
  );
});

test("HIGH-6: DeleteCachePolicy in-use guard → CachePolicyInUse 409", async () => {
  const client = cloudfront();

  const policy = await client.send(
    new CreateCachePolicyCommand({
      CachePolicyConfig: {
        Name: `policy-inuse-${Date.now()}`,
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        MinTTL: 0,
        ParametersInCacheKeyAndForwardedToOrigin: {
          EnableAcceptEncodingGzip: false,
          HeadersConfig: { HeaderBehavior: "none" },
          CookiesConfig: { CookieBehavior: "none" },
          QueryStringsConfig: { QueryStringBehavior: "none" },
        },
      },
    }),
  );
  const policyId = policy.CachePolicy?.Id!;

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        ...baseConfig(`dist-policy-${Date.now()}`),
        DefaultCacheBehavior: {
          TargetOriginId: "origin-1",
          ViewerProtocolPolicy: "allow-all" as const,
          CachePolicyId: policyId,
        },
      },
    }),
  );
  const distId = dist.Distribution?.Id!;

  await expect(
    client.send(new DeleteCachePolicyCommand({ Id: policyId })),
  ).rejects.toThrow();

  await disableAndDelete(client, distId);
  await client.send(new DeleteCachePolicyCommand({ Id: policyId }));
});

test("HIGH-8: DeleteCloudFrontOriginAccessIdentity in-use → CloudFrontOriginAccessIdentityInUse 409", async () => {
  const client = cloudfront();
  const callerRefOai = `oai-guard-${Date.now()}`;

  const oai = await client.send(
    new CreateCloudFrontOriginAccessIdentityCommand({
      CloudFrontOriginAccessIdentityConfig: {
        CallerReference: callerRefOai,
        Comment: "guard test",
      },
    }),
  );
  const oaiId = oai.CloudFrontOriginAccessIdentity?.Id!;
  const oaiETag = oai.ETag!;

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        ...baseConfig(`dist-oai-${Date.now()}`),
        Origins: {
          Quantity: 1,
          Items: [
            {
              Id: "origin-s3",
              DomainName: "mybucket.s3.amazonaws.com",
              S3OriginConfig: {
                OriginAccessIdentity: `origin-access-identity/cloudfront/${oaiId}`,
              },
            },
          ],
        },
        DefaultCacheBehavior: {
          TargetOriginId: "origin-s3",
          ViewerProtocolPolicy: "allow-all" as const,
          ForwardedValues: {
            QueryString: false,
            Cookies: { Forward: "none" as const },
          },
          MinTTL: 0,
        },
      },
    }),
  );
  const distId = dist.Distribution?.Id!;

  await expect(
    client.send(
      new DeleteCloudFrontOriginAccessIdentityCommand({
        Id: oaiId,
        IfMatch: oaiETag,
      }),
    ),
  ).rejects.toThrow();

  await disableAndDelete(client, distId);
  await client.send(
    new DeleteCloudFrontOriginAccessIdentityCommand({
      Id: oaiId,
      IfMatch: oaiETag,
    }),
  );
});
