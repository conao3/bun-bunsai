import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CloudFrontClient,
  CreateCachePolicyCommand,
  CreatePublicKeyCommand,
  DeleteCachePolicyCommand,
  DeletePublicKeyCommand,
  GetCachePolicyCommand,
  GetPublicKeyCommand,
  ListCachePoliciesCommand,
  ListPublicKeysCommand,
} from "@aws-sdk/client-cloudfront";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4576;
const uiPort = 5676;
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

test("CloudFront cache policy lifecycle", async () => {
  const client = cloudfront();
  const name = `bunsai-cp-${Date.now()}`;

  const created = await client.send(
    new CreateCachePolicyCommand({
      CachePolicyConfig: {
        Name: name,
        Comment: "initial",
        DefaultTTL: 86400,
        MaxTTL: 31536000,
        MinTTL: 1,
        ParametersInCacheKeyAndForwardedToOrigin: {
          EnableAcceptEncodingGzip: false,
          HeadersConfig: { HeaderBehavior: "none" },
          CookiesConfig: { CookieBehavior: "none" },
          QueryStringsConfig: { QueryStringBehavior: "none" },
        },
      },
    }),
  );
  const id = created.CachePolicy?.Id;
  expect(id).toBeDefined();
  expect(created.CachePolicy?.CachePolicyConfig?.Name).toBe(name);
  expect(created.ETag).toBeDefined();

  const got = await client.send(new GetCachePolicyCommand({ Id: id }));
  expect(got.CachePolicy?.Id).toBe(id);
  expect(got.CachePolicy?.CachePolicyConfig?.Comment).toBe("initial");
  expect(got.ETag).toBeDefined();

  const listed = await client.send(
    new ListCachePoliciesCommand({ Type: "custom" }),
  );
  const ids = (listed.CachePolicyList?.Items ?? []).map(
    (item) => item.CachePolicy?.Id,
  );
  expect(ids).toContain(id);

  await client.send(
    new DeleteCachePolicyCommand({ Id: id, IfMatch: got.ETag }),
  );
  const afterDelete = await client.send(
    new ListCachePoliciesCommand({ Type: "custom" }),
  );
  const idsAfter = (afterDelete.CachePolicyList?.Items ?? []).map(
    (item) => item.CachePolicy?.Id,
  );
  expect(idsAfter).not.toContain(id);
});

test("CloudFront public key lifecycle", async () => {
  const client = cloudfront();
  const name = `bunsai-pk-${Date.now()}`;
  const encodedKey =
    "-----BEGIN PUBLIC KEY----- MIIBIjANBgkqhkiG9w0BAQEFAAOC -----END PUBLIC KEY-----";

  const created = await client.send(
    new CreatePublicKeyCommand({
      PublicKeyConfig: {
        CallerReference: `pk-${Date.now()}`,
        Name: name,
        EncodedKey: encodedKey,
        Comment: "initial",
      },
    }),
  );
  const id = created.PublicKey?.Id;
  expect(id).toBeDefined();
  expect(created.PublicKey?.PublicKeyConfig?.Name).toBe(name);
  expect(created.ETag).toBeDefined();

  const got = await client.send(new GetPublicKeyCommand({ Id: id }));
  expect(got.PublicKey?.Id).toBe(id);
  expect(got.PublicKey?.PublicKeyConfig?.EncodedKey).toBe(encodedKey);
  expect(got.ETag).toBeDefined();

  const listed = await client.send(new ListPublicKeysCommand({}));
  const ids = (listed.PublicKeyList?.Items ?? []).map((item) => item.Id);
  expect(ids).toContain(id);

  await client.send(new DeletePublicKeyCommand({ Id: id, IfMatch: got.ETag }));
  const afterDelete = await client.send(new ListPublicKeysCommand({}));
  const idsAfter = (afterDelete.PublicKeyList?.Items ?? []).map(
    (item) => item.Id,
  );
  expect(idsAfter).not.toContain(id);
});
