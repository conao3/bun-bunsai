import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BackupClient,
  CreateBackupPlanCommand,
  CreateBackupSelectionCommand,
  CreateBackupVaultCommand,
  DeleteBackupPlanCommand,
  DeleteBackupSelectionCommand,
  DeleteBackupVaultCommand,
  DeleteRecoveryPointCommand,
  DescribeBackupJobCommand,
  DescribeRestoreJobCommand,
  GetBackupPlanCommand,
  GetBackupSelectionCommand,
  ListRecoveryPointsByBackupVaultCommand,
  StartBackupJobCommand,
  StartRestoreJobCommand,
} from "@aws-sdk/client-backup";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("backup scenario e2e", () => {
  const backup = () =>
    new BackupClient({ endpoint, region, credentials, requestHandler });

  test("vault/plan/selection lifecycle with backup job, recovery point, restore, and guarded teardown", async () => {
    const client = backup();
    const ts = Date.now();
    const vaultName = `scenario-vault-${ts}`;

    const vault = await client.send(
      new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
    );
    expect(vault.BackupVaultArn).toContain(vaultName);

    const plan = await client.send(
      new CreateBackupPlanCommand({
        BackupPlan: {
          BackupPlanName: `scenario-plan-${ts}`,
          Rules: [
            {
              RuleName: "daily-rule",
              TargetBackupVaultName: vaultName,
              ScheduleExpression: "cron(0 5 ? * * *)",
            },
          ],
        },
      }),
    );
    expect(plan.BackupPlanId).toBeDefined();
    expect(plan.VersionId).toBeDefined();
    const planId = plan.BackupPlanId!;

    const sel = await client.send(
      new CreateBackupSelectionCommand({
        BackupPlanId: planId,
        BackupSelection: {
          SelectionName: `scenario-sel-${ts}`,
          IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
          Resources: ["arn:aws:ec2:us-east-1:123456789012:instance/i-scenario"],
        },
      }),
    );
    expect(sel.SelectionId).toBeDefined();
    const selId = sel.SelectionId!;

    const gotSel = await client.send(
      new GetBackupSelectionCommand({
        BackupPlanId: planId,
        SelectionId: selId,
      }),
    );
    expect(gotSel.BackupSelection?.IamRoleArn).toBe(
      "arn:aws:iam::123456789012:role/BackupRole",
    );
    expect(gotSel.BackupSelection?.Resources).toContain(
      "arn:aws:ec2:us-east-1:123456789012:instance/i-scenario",
    );

    const job = await client.send(
      new StartBackupJobCommand({
        BackupVaultName: vaultName,
        ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-scenario",
        IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
      }),
    );
    expect(job.BackupJobId).toBeDefined();
    expect(job.RecoveryPointArn).toBeDefined();
    const rpArn = job.RecoveryPointArn!;

    const described = await client.send(
      new DescribeBackupJobCommand({ BackupJobId: job.BackupJobId! }),
    );
    expect(described.State).toBe("COMPLETED");
    expect(described.CompletionDate).toBeDefined();

    const listed = await client.send(
      new ListRecoveryPointsByBackupVaultCommand({
        BackupVaultName: vaultName,
      }),
    );
    const rp = (listed.RecoveryPoints ?? []).find(
      (r) => r.RecoveryPointArn === rpArn,
    );
    expect(rp).toBeDefined();
    expect(rp?.Status).toBe("COMPLETED");

    const restoreJob = await client.send(
      new StartRestoreJobCommand({
        RecoveryPointArn: rpArn,
        Metadata: {},
        IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
      }),
    );
    expect(restoreJob.RestoreJobId).toBeDefined();

    const describedRestore = await client.send(
      new DescribeRestoreJobCommand({ RestoreJobId: restoreJob.RestoreJobId! }),
    );
    expect(describedRestore.Status).toBe("COMPLETED");
    expect(describedRestore.CreatedResourceArn).toBeDefined();

    await client.send(
      new DeleteBackupSelectionCommand({
        BackupPlanId: planId,
        SelectionId: selId,
      }),
    );
    await client.send(new DeleteBackupPlanCommand({ BackupPlanId: planId }));
    await expect(
      client.send(new GetBackupPlanCommand({ BackupPlanId: planId })),
    ).rejects.toThrow();

    await expect(
      client.send(new DeleteBackupVaultCommand({ BackupVaultName: vaultName })),
    ).rejects.toThrow();

    await client.send(
      new DeleteRecoveryPointCommand({
        BackupVaultName: vaultName,
        RecoveryPointArn: rpArn,
      }),
    );
    await client.send(
      new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
    );
  });
});
