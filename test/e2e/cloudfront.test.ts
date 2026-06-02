import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudFrontClient,
  CreateDistributionCommand,
  CreateInvalidationCommand,
  DeleteDistributionCommand,
  GetDistributionCommand,
  ListDistributionsCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const cloudfront = () =>
  new CloudFrontClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

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
          OriginProtocolPolicy: "https-only",
        },
      },
    ],
  },
  DefaultCacheBehavior: {
    TargetOriginId: "origin-1",
    ViewerProtocolPolicy: "allow-all",
    ForwardedValues: {
      QueryString: false,
      Cookies: { Forward: "none" },
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
  expect(invalidation.Invalidation?.Status).toBe("Completed");

  await client.send(new DeleteDistributionCommand({ Id: id }));
  const afterDelete = await client.send(new ListDistributionsCommand({}));
  const idsAfter = (afterDelete.DistributionList?.Items ?? []).map((d) => d.Id);
  expect(idsAfter).not.toContain(id);
});
