import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateDomainCommand,
  DeleteDomainCommand,
  DescribeDomainCommand,
  ListDomainsCommand,
  VoiceIDClient,
} from "@aws-sdk/client-voice-id";
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

const voiceid = () =>
  new VoiceIDClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("VoiceID domain lifecycle", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";

  const created = await client.send(
    new CreateDomainCommand({
      Name: "bunsai-e2e-domain",
      Description: "bunsai e2e voiceid domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const domainId = created.Domain?.DomainId;
  expect(domainId).toBeDefined();
  expect(created.Domain?.Name).toBe("bunsai-e2e-domain");
  expect(created.Domain?.Arn).toContain("domain/");
  expect(created.Domain?.ServerSideEncryptionConfiguration?.KmsKeyId).toBe(
    kmsKeyId,
  );

  const described = await client.send(
    new DescribeDomainCommand({ DomainId: domainId }),
  );
  expect(described.Domain?.DomainId).toBe(domainId);
  expect(described.Domain?.Name).toBe("bunsai-e2e-domain");

  const listed = await client.send(new ListDomainsCommand({}));
  expect(
    (listed.DomainSummaries ?? []).some((d) => d.DomainId === domainId),
  ).toBe(true);

  await client.send(new DeleteDomainCommand({ DomainId: domainId }));

  const afterDelete = await client.send(new ListDomainsCommand({}));
  expect(
    (afterDelete.DomainSummaries ?? []).some((d) => d.DomainId === domainId),
  ).toBe(false);
});
