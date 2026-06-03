import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  BudgetsClient,
  CreateBudgetCommand,
  DeleteBudgetCommand,
  DescribeBudgetCommand,
  DescribeBudgetsCommand,
} from "@aws-sdk/client-budgets";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const accountId = "000000000000";

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

const budgets = () =>
  new BudgetsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Budgets budget roundtrip", async () => {
  const client = budgets();
  const budgetName = `bunsai-e2e-${Date.now()}`;

  await client.send(
    new CreateBudgetCommand({
      AccountId: accountId,
      Budget: {
        BudgetName: budgetName,
        TimeUnit: "MONTHLY",
        BudgetType: "COST",
        BudgetLimit: { Amount: "100.0", Unit: "USD" },
      },
    }),
  );

  const got = await client.send(
    new DescribeBudgetCommand({
      AccountId: accountId,
      BudgetName: budgetName,
    }),
  );
  expect(got.Budget?.BudgetName).toBe(budgetName);
  expect(got.Budget?.TimeUnit).toBe("MONTHLY");
  expect(got.Budget?.BudgetType).toBe("COST");

  const listed = await client.send(
    new DescribeBudgetsCommand({ AccountId: accountId }),
  );
  expect((listed.Budgets ?? []).map((b) => b.BudgetName)).toContain(budgetName);

  await client.send(
    new DeleteBudgetCommand({ AccountId: accountId, BudgetName: budgetName }),
  );

  await expect(
    client.send(
      new DescribeBudgetCommand({
        AccountId: accountId,
        BudgetName: budgetName,
      }),
    ),
  ).rejects.toThrow();
});
