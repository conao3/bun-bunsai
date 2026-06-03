import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreatePortfolioCommand,
  DeletePortfolioCommand,
  DescribePortfolioCommand,
  ListPortfoliosCommand,
  ServiceCatalogClient,
  UpdatePortfolioCommand,
} from "@aws-sdk/client-service-catalog";
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

const catalog = () =>
  new ServiceCatalogClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("ServiceCatalog portfolio lifecycle", async () => {
  const client = catalog();

  const created = await client.send(
    new CreatePortfolioCommand({
      DisplayName: "bunsai-e2e-portfolio",
      ProviderName: "bunsai",
      IdempotencyToken: "bunsai-e2e-token-1",
    }),
  );
  const portfolioId = created.PortfolioDetail?.Id;
  expect(portfolioId).toMatch(/^port-/);
  expect(created.PortfolioDetail?.DisplayName).toBe("bunsai-e2e-portfolio");
  expect(created.PortfolioDetail?.ARN).toContain("portfolio/");

  const listed = await client.send(new ListPortfoliosCommand({}));
  expect(
    (listed.PortfolioDetails ?? []).some((p) => p.Id === portfolioId),
  ).toBe(true);

  const described = await client.send(
    new DescribePortfolioCommand({ Id: portfolioId }),
  );
  expect(described.PortfolioDetail?.Id).toBe(portfolioId);
  expect(described.PortfolioDetail?.ProviderName).toBe("bunsai");

  const updated = await client.send(
    new UpdatePortfolioCommand({
      Id: portfolioId,
      DisplayName: "bunsai-e2e-portfolio-renamed",
    }),
  );
  expect(updated.PortfolioDetail?.DisplayName).toBe(
    "bunsai-e2e-portfolio-renamed",
  );

  await client.send(new DeletePortfolioCommand({ Id: portfolioId }));

  const afterDelete = await client.send(new ListPortfoliosCommand({}));
  expect(
    (afterDelete.PortfolioDetails ?? []).some((p) => p.Id === portfolioId),
  ).toBe(false);
});
