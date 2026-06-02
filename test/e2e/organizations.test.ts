import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateAccountCommand,
  CreateOrganizationCommand,
  CreateOrganizationalUnitCommand,
  DescribeAccountCommand,
  DescribeOrganizationCommand,
  ListAccountsCommand,
  ListOrganizationalUnitsForParentCommand,
  ListRootsCommand,
  OrganizationsClient,
} from "@aws-sdk/client-organizations";

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

const org = () => new OrganizationsClient({ endpoint, region, credentials });

test("Organizations org / account / ou lifecycle", async () => {
  const client = org();

  const created = await client.send(
    new CreateOrganizationCommand({ FeatureSet: "ALL" }),
  );
  expect(created.Organization?.Id).toMatch(/^o-/);
  expect(created.Organization?.FeatureSet).toBe("ALL");

  const described = await client.send(new DescribeOrganizationCommand({}));
  expect(described.Organization?.Id).toBe(created.Organization?.Id);

  const roots = await client.send(new ListRootsCommand({}));
  const rootId = (roots.Roots ?? [])[0]?.Id;
  expect(rootId).toMatch(/^r-/);

  const account = await client.send(
    new CreateAccountCommand({
      AccountName: "bunsai-e2e-account",
      Email: "bunsai-e2e@example.com",
    }),
  );
  expect(account.CreateAccountStatus?.State).toBe("SUCCEEDED");
  const accountId = account.CreateAccountStatus?.AccountId;
  expect(accountId).toBeDefined();

  const describedAccount = await client.send(
    new DescribeAccountCommand({ AccountId: accountId }),
  );
  expect(describedAccount.Account?.Name).toBe("bunsai-e2e-account");
  expect(describedAccount.Account?.Email).toBe("bunsai-e2e@example.com");

  const listed = await client.send(new ListAccountsCommand({}));
  const ids = (listed.Accounts ?? []).map((entry) => entry.Id);
  expect(ids).toContain(accountId);

  const ou = await client.send(
    new CreateOrganizationalUnitCommand({
      ParentId: rootId,
      Name: "bunsai-e2e-ou",
    }),
  );
  expect(ou.OrganizationalUnit?.Id).toMatch(/^ou-/);
  expect(ou.OrganizationalUnit?.Name).toBe("bunsai-e2e-ou");

  const ous = await client.send(
    new ListOrganizationalUnitsForParentCommand({ ParentId: rootId }),
  );
  const ouNames = (ous.OrganizationalUnits ?? []).map((entry) => entry.Name);
  expect(ouNames).toContain("bunsai-e2e-ou");
});
