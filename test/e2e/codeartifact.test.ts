import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CodeartifactClient,
  CreateDomainCommand,
  DeleteDomainCommand,
  DescribeDomainCommand,
  ListDomainsCommand,
} from "@aws-sdk/client-codeartifact";

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

const codeartifact = () =>
  new CodeartifactClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("CodeArtifact domain roundtrip", async () => {
  const client = codeartifact();
  const domainName = `bunsai-e2e-${Date.now()}`;

  const created = await client.send(
    new CreateDomainCommand({ domain: domainName }),
  );
  expect(created.domain?.name).toBe(domainName);
  expect(created.domain?.arn).toBeDefined();
  expect(created.domain?.status).toBe("Active");

  const described = await client.send(
    new DescribeDomainCommand({ domain: domainName }),
  );
  expect(described.domain?.name).toBe(domainName);
  expect(described.domain?.status).toBe("Active");

  const listed = await client.send(new ListDomainsCommand({}));
  expect((listed.domains ?? []).map((d) => d.name)).toContain(domainName);

  await client.send(new DeleteDomainCommand({ domain: domainName }));

  await expect(
    client.send(new DescribeDomainCommand({ domain: domainName })),
  ).rejects.toThrow();
});
