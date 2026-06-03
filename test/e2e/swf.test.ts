import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeprecateDomainCommand,
  DescribeDomainCommand,
  ListDomainsCommand,
  RegisterDomainCommand,
  SWFClient,
} from "@aws-sdk/client-swf";
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

const swf = () =>
  new SWFClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("SWF domain lifecycle", async () => {
  const client = swf();
  const name = "bunsai-e2e-domain";

  await client.send(
    new RegisterDomainCommand({
      name,
      description: "bunsai e2e domain",
      workflowExecutionRetentionPeriodInDays: "7",
    }),
  );

  const described = await client.send(new DescribeDomainCommand({ name }));
  expect(described.domainInfo?.name).toBe(name);
  expect(described.domainInfo?.status).toBe("REGISTERED");
  expect(described.domainInfo?.description).toBe("bunsai e2e domain");
  expect(described.configuration?.workflowExecutionRetentionPeriodInDays).toBe(
    "7",
  );

  const listed = await client.send(
    new ListDomainsCommand({ registrationStatus: "REGISTERED" }),
  );
  const names = (listed.domainInfos ?? []).map((d) => d.name);
  expect(names).toContain(name);

  await client.send(new DeprecateDomainCommand({ name }));

  const afterDeprecate = await client.send(new DescribeDomainCommand({ name }));
  expect(afterDeprecate.domainInfo?.status).toBe("DEPRECATED");

  const deprecatedList = await client.send(
    new ListDomainsCommand({ registrationStatus: "DEPRECATED" }),
  );
  const deprecatedNames = (deprecatedList.domainInfos ?? []).map((d) => d.name);
  expect(deprecatedNames).toContain(name);
});
