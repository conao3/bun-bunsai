import type { DistributionConfig } from "@aws-sdk/client-cloudfront";
import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudFrontClient,
  CreateDistributionCommand,
  CreateInvalidationCommand,
  DeleteDistributionCommand,
  GetDistributionCommand,
  GetDistributionConfigCommand,
  GetInvalidationCommand,
  ListInvalidationsCommand,
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
      DistributionConfig: {
        ...cfg.DistributionConfig,
        Enabled: false,
      } as DistributionConfig,
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

test("UpdateDistribution config round-trip + ETag advance", async () => {
  const client = cloudfront();
  const callerRef = `update-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(callerRef, "initial"),
    }),
  );
  const id = created.Distribution?.Id;
  expect(id).toBeDefined();
  const createETag = created.ETag;
  expect(createETag).toBeDefined();

  const gotConfig = await client.send(
    new GetDistributionConfigCommand({ Id: id }),
  );
  expect(gotConfig.DistributionConfig?.Comment).toBe("initial");
  const configETag = gotConfig.ETag;
  expect(configETag).toBe(createETag);

  const updated = await client.send(
    new UpdateDistributionCommand({
      Id: id,
      IfMatch: configETag,
      DistributionConfig: distributionConfig(callerRef, "updated"),
    }),
  );
  expect(updated.Distribution?.Id).toBe(id);
  expect(updated.Distribution?.DistributionConfig?.Comment).toBe("updated");
  const updatedETag = updated.ETag;
  expect(updatedETag).toBeDefined();
  expect(updatedETag).not.toBe(createETag);

  const gotConfigAfter = await client.send(
    new GetDistributionConfigCommand({ Id: id }),
  );
  expect(gotConfigAfter.DistributionConfig?.Comment).toBe("updated");
  expect(gotConfigAfter.ETag).toBe(updatedETag);

  const gotDist = await client.send(new GetDistributionCommand({ Id: id }));
  expect(gotDist.Distribution?.DistributionConfig?.Comment).toBe("updated");
  expect(gotDist.ETag).toBe(updatedETag);

  await disableAndDelete(client, id!);
});

test("UpdateDistribution stale IfMatch → PreconditionFailed", async () => {
  const client = cloudfront();
  const callerRef = `stale-etag-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(callerRef, "initial"),
    }),
  );
  const id = created.Distribution?.Id;
  expect(id).toBeDefined();

  await expect(
    client.send(
      new UpdateDistributionCommand({
        Id: id,
        IfMatch: "ETAG-STALE-INVALID",
        DistributionConfig: distributionConfig(callerRef, "should-fail"),
      }),
    ),
  ).rejects.toThrow();

  await disableAndDelete(client, id!);
});

test("CreateInvalidation lifecycle: InProgress at create → Completed on read", async () => {
  const client = cloudfront();

  const dist = await client.send(
    new CreateDistributionCommand({
      DistributionConfig: distributionConfig(
        `inval-lifecycle-${Date.now()}`,
        "inval lifecycle test",
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
        Paths: { Quantity: 2, Items: ["/*", "/img/*"] },
      },
    }),
  );
  const invId = inv.Invalidation?.Id;
  expect(invId).toBeDefined();
  expect(inv.Invalidation?.Status).toBe("InProgress");

  const got = await client.send(
    new GetInvalidationCommand({ DistributionId: distId, Id: invId }),
  );
  expect(got.Invalidation?.Id).toBe(invId);
  expect(got.Invalidation?.Status).toBe("Completed");

  const listed = await client.send(
    new ListInvalidationsCommand({ DistributionId: distId }),
  );
  const items = listed.InvalidationList?.Items ?? [];
  const found = items.find((i) => i.Id === invId);
  expect(found).toBeDefined();
  expect(found?.Status).toBe("Completed");

  await disableAndDelete(client, distId!);
});
