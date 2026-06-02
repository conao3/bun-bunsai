import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  BackupClient,
  CreateBackupPlanCommand,
  CreateBackupVaultCommand,
  DeleteBackupPlanCommand,
  DeleteBackupVaultCommand,
  DescribeBackupVaultCommand,
  GetBackupPlanCommand,
  ListBackupPlansCommand,
  ListBackupVaultsCommand,
} from "@aws-sdk/client-backup";

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

const backup = () => new BackupClient({ endpoint, region, credentials });

test("Backup vault roundtrip", async () => {
  const client = backup();
  const vaultName = `bunsai-e2e-vault-${Date.now()}`;

  const created = await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );
  expect(created.BackupVaultName).toBe(vaultName);
  expect(created.BackupVaultArn).toContain(`backup-vault:${vaultName}`);

  const described = await client.send(
    new DescribeBackupVaultCommand({ BackupVaultName: vaultName }),
  );
  expect(described.BackupVaultName).toBe(vaultName);
  expect(described.NumberOfRecoveryPoints).toBe(0);

  const listed = await client.send(new ListBackupVaultsCommand({}));
  expect(
    (listed.BackupVaultList ?? []).map((v) => v.BackupVaultName),
  ).toContain(vaultName);

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
  );
  await expect(
    client.send(new DescribeBackupVaultCommand({ BackupVaultName: vaultName })),
  ).rejects.toThrow();
});

test("Backup plan roundtrip", async () => {
  const client = backup();
  const planName = `bunsai-e2e-plan-${Date.now()}`;

  const created = await client.send(
    new CreateBackupPlanCommand({
      BackupPlan: {
        BackupPlanName: planName,
        Rules: [
          {
            RuleName: "daily",
            TargetBackupVaultName: "default",
            ScheduleExpression: "cron(0 5 ? * * *)",
          },
        ],
      },
    }),
  );
  const planId = created.BackupPlanId;
  expect(planId).toBeDefined();
  expect(created.BackupPlanArn).toContain("backup-plan:");

  const got = await client.send(
    new GetBackupPlanCommand({ BackupPlanId: planId }),
  );
  expect(got.BackupPlan?.BackupPlanName).toBe(planName);
  expect(got.BackupPlan?.Rules?.[0]?.RuleName).toBe("daily");

  const listed = await client.send(new ListBackupPlansCommand({}));
  expect((listed.BackupPlansList ?? []).map((p) => p.BackupPlanId)).toContain(
    planId,
  );

  const deleted = await client.send(
    new DeleteBackupPlanCommand({ BackupPlanId: planId }),
  );
  expect(deleted.BackupPlanId).toBe(planId);
  await expect(
    client.send(new GetBackupPlanCommand({ BackupPlanId: planId })),
  ).rejects.toThrow();
});
