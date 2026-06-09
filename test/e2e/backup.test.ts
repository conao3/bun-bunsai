import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BackupClient,
  CancelLegalHoldCommand,
  CreateBackupPlanCommand,
  CreateBackupSelectionCommand,
  CreateBackupVaultCommand,
  CreateFrameworkCommand,
  CreateLegalHoldCommand,
  CreateReportPlanCommand,
  CreateRestoreTestingPlanCommand,
  CreateRestoreTestingSelectionCommand,
  DeleteBackupPlanCommand,
  DeleteBackupSelectionCommand,
  DeleteBackupVaultCommand,
  DeleteFrameworkCommand,
  DeleteRecoveryPointCommand,
  DeleteReportPlanCommand,
  DeleteRestoreTestingPlanCommand,
  DeleteRestoreTestingSelectionCommand,
  DescribeBackupJobCommand,
  DescribeBackupVaultCommand,
  DescribeCopyJobCommand,
  DescribeFrameworkCommand,
  DescribeGlobalSettingsCommand,
  DescribeRecoveryPointCommand,
  DescribeRegionSettingsCommand,
  DescribeReportPlanCommand,
  DescribeRestoreJobCommand,
  DescribeScanJobCommand,
  GetBackupPlanCommand,
  GetBackupSelectionCommand,
  GetBackupVaultAccessPolicyCommand,
  GetBackupVaultNotificationsCommand,
  GetLegalHoldCommand,
  GetRecoveryPointRestoreMetadataCommand,
  GetRestoreTestingPlanCommand,
  GetRestoreTestingSelectionCommand,
  GetSupportedResourceTypesCommand,
  ListBackupJobsCommand,
  ListBackupPlanVersionsCommand,
  ListBackupPlansCommand,
  ListBackupSelectionsCommand,
  ListBackupVaultsCommand,
  ListCopyJobsCommand,
  ListFrameworksCommand,
  ListLegalHoldsCommand,
  ListRecoveryPointsByBackupVaultCommand,
  ListReportPlansCommand,
  ListRestoreJobsCommand,
  ListRestoreTestingPlansCommand,
  ListRestoreTestingSelectionsCommand,
  ListScanJobsCommand,
  ListTagsCommand,
  PutBackupVaultAccessPolicyCommand,
  PutBackupVaultNotificationsCommand,
  StartBackupJobCommand,
  StartCopyJobCommand,
  StartRestoreJobCommand,
  StartScanJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateBackupPlanCommand,
  UpdateGlobalSettingsCommand,
  UpdateRegionSettingsCommand,
} from "@aws-sdk/client-backup";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const backup = () =>
  new BackupClient({ endpoint, region, credentials, requestHandler });

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

test("Backup selection lifecycle", async () => {
  const client = backup();
  const planName = `bunsai-e2e-sel-plan-${Date.now()}`;
  const created = await client.send(
    new CreateBackupPlanCommand({
      BackupPlan: {
        BackupPlanName: planName,
        Rules: [
          {
            RuleName: "r1",
            TargetBackupVaultName: "default",
          },
        ],
      },
    }),
  );
  const planId = created.BackupPlanId!;

  const sel = await client.send(
    new CreateBackupSelectionCommand({
      BackupPlanId: planId,
      BackupSelection: {
        SelectionName: "sel1",
        IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
        Resources: ["arn:aws:ec2:us-east-1:123456789012:instance/i-abc"],
      },
    }),
  );
  const selId = sel.SelectionId!;
  expect(selId).toBeDefined();

  const got = await client.send(
    new GetBackupSelectionCommand({ BackupPlanId: planId, SelectionId: selId }),
  );
  expect(got.BackupSelection?.SelectionName).toBe("sel1");

  const listed = await client.send(
    new ListBackupSelectionsCommand({ BackupPlanId: planId }),
  );
  expect(
    (listed.BackupSelectionsList ?? []).map((s) => s.SelectionId),
  ).toContain(selId);

  await client.send(
    new DeleteBackupSelectionCommand({
      BackupPlanId: planId,
      SelectionId: selId,
    }),
  );
  await client.send(new DeleteBackupPlanCommand({ BackupPlanId: planId }));
});

test("Framework lifecycle", async () => {
  const client = backup();
  const name = `fw-${Date.now()}`;

  const created = await client.send(
    new CreateFrameworkCommand({
      FrameworkName: name,
      FrameworkControls: [],
    }),
  );
  expect(created.FrameworkName).toBe(name);
  expect(created.FrameworkArn).toContain("framework:");

  const described = await client.send(
    new DescribeFrameworkCommand({ FrameworkName: name }),
  );
  expect(described.FrameworkName).toBe(name);
  expect(described.FrameworkStatus).toBe("ACTIVE");

  const listed = await client.send(new ListFrameworksCommand({}));
  expect((listed.Frameworks ?? []).map((f) => f.FrameworkName)).toContain(name);

  await client.send(new DeleteFrameworkCommand({ FrameworkName: name }));
});

test("Legal hold create/get/cancel", async () => {
  const client = backup();

  const created = await client.send(
    new CreateLegalHoldCommand({
      Title: "e2e-hold",
      Description: "test hold",
    }),
  );
  const holdId = created.LegalHoldId!;
  expect(holdId).toBeDefined();
  expect(created.Status).toBe("ACTIVE");

  const got = await client.send(
    new GetLegalHoldCommand({ LegalHoldId: holdId }),
  );
  expect(got.Title).toBe("e2e-hold");
  expect(got.Status).toBe("ACTIVE");

  const listed = await client.send(new ListLegalHoldsCommand({}));
  expect((listed.LegalHolds ?? []).map((h) => h.LegalHoldId)).toContain(holdId);

  await client.send(
    new CancelLegalHoldCommand({
      LegalHoldId: holdId,
      CancelDescription: "no longer needed",
    }),
  );

  const afterCancel = await client.send(
    new GetLegalHoldCommand({ LegalHoldId: holdId }),
  );
  expect(String(afterCancel.Status)).toBe("CANCELLED");
});

test("Report plan lifecycle", async () => {
  const client = backup();
  const name = `rp-${Date.now()}`;

  const created = await client.send(
    new CreateReportPlanCommand({
      ReportPlanName: name,
      ReportDeliveryChannel: { S3BucketName: "my-bucket" },
      ReportSetting: { ReportTemplate: "RESOURCE_COMPLIANCE_REPORT" },
    }),
  );
  expect(created.ReportPlanName).toBe(name);

  const described = await client.send(
    new DescribeReportPlanCommand({ ReportPlanName: name }),
  );
  expect(described.ReportPlan?.ReportPlanName).toBe(name);

  const listed = await client.send(new ListReportPlansCommand({}));
  expect((listed.ReportPlans ?? []).map((p) => p.ReportPlanName)).toContain(
    name,
  );

  await client.send(new DeleteReportPlanCommand({ ReportPlanName: name }));
});

test("Restore testing plan and selection", async () => {
  const client = backup();
  const planName = `rtp-${Date.now()}`;

  const created = await client.send(
    new CreateRestoreTestingPlanCommand({
      RestoreTestingPlan: {
        RestoreTestingPlanName: planName,
        RecoveryPointSelection: {
          Algorithm: "LATEST_WITHIN_WINDOW",
          IncludeVaults: ["*"],
        },
        ScheduleExpression: "cron(0 1 ? * * *)",
        StartWindowHours: 1,
      },
    }),
  );
  expect(created.RestoreTestingPlanName).toBe(planName);

  const got = await client.send(
    new GetRestoreTestingPlanCommand({ RestoreTestingPlanName: planName }),
  );
  expect(got.RestoreTestingPlan?.RestoreTestingPlanName).toBe(planName);

  const listed = await client.send(new ListRestoreTestingPlansCommand({}));
  expect(
    (listed.RestoreTestingPlans ?? []).map((p) => p.RestoreTestingPlanName),
  ).toContain(planName);

  const selName = `rts-${Date.now()}`;
  const selCreated = await client.send(
    new CreateRestoreTestingSelectionCommand({
      RestoreTestingPlanName: planName,
      RestoreTestingSelection: {
        RestoreTestingSelectionName: selName,
        ProtectedResourceType: "EC2",
        IamRoleArn: "arn:aws:iam::123456789012:role/RestoreRole",
      },
    }),
  );
  expect(selCreated.RestoreTestingSelectionName).toBe(selName);

  const selGot = await client.send(
    new GetRestoreTestingSelectionCommand({
      RestoreTestingPlanName: planName,
      RestoreTestingSelectionName: selName,
    }),
  );
  expect(selGot.RestoreTestingSelection?.RestoreTestingSelectionName).toBe(
    selName,
  );

  const selListed = await client.send(
    new ListRestoreTestingSelectionsCommand({
      RestoreTestingPlanName: planName,
    }),
  );
  expect(
    (selListed.RestoreTestingSelections ?? []).map(
      (s) => s.RestoreTestingSelectionName,
    ),
  ).toContain(selName);

  await client.send(
    new DeleteRestoreTestingSelectionCommand({
      RestoreTestingPlanName: planName,
      RestoreTestingSelectionName: selName,
    }),
  );
  await client.send(
    new DeleteRestoreTestingPlanCommand({ RestoreTestingPlanName: planName }),
  );
});

test("Recovery point describe/delete", async () => {
  const client = backup();
  const vaultName = `vault-rp-${Date.now()}`;

  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );

  const job = await client.send(
    new StartBackupJobCommand({
      BackupVaultName: vaultName,
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-abc123",
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  const rpArn = job.RecoveryPointArn!;
  expect(rpArn).toBeDefined();

  const descJob = await client.send(
    new DescribeBackupJobCommand({ BackupJobId: job.BackupJobId! }),
  );
  expect(descJob.State).toBe("COMPLETED");

  const listed = await client.send(new ListBackupJobsCommand({}));
  expect((listed.BackupJobs ?? []).map((j) => j.BackupJobId)).toContain(
    job.BackupJobId,
  );

  const rps = await client.send(
    new ListRecoveryPointsByBackupVaultCommand({ BackupVaultName: vaultName }),
  );
  expect((rps.RecoveryPoints ?? []).map((r) => r.RecoveryPointArn)).toContain(
    rpArn,
  );

  const described = await client.send(
    new DescribeRecoveryPointCommand({
      BackupVaultName: vaultName,
      RecoveryPointArn: rpArn,
    }),
  );
  expect(described.RecoveryPointArn).toBe(rpArn);
  expect(described.Status).toBe("COMPLETED");

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

test("Vault access policy put/get", async () => {
  const client = backup();
  const vaultName = `vault-pol-${Date.now()}`;

  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );

  const policy = JSON.stringify({ Version: "2012-10-17", Statement: [] });
  await client.send(
    new PutBackupVaultAccessPolicyCommand({
      BackupVaultName: vaultName,
      Policy: policy,
    }),
  );

  const got = await client.send(
    new GetBackupVaultAccessPolicyCommand({ BackupVaultName: vaultName }),
  );
  expect(got.Policy).toBe(policy);

  await client.send(
    new PutBackupVaultNotificationsCommand({
      BackupVaultName: vaultName,
      SNSTopicArn: "arn:aws:sns:us-east-1:123456789012:BackupTopic",
      BackupVaultEvents: ["BACKUP_JOB_COMPLETED"],
    }),
  );

  const notif = await client.send(
    new GetBackupVaultNotificationsCommand({ BackupVaultName: vaultName }),
  );
  expect(notif.SNSTopicArn).toContain("BackupTopic");

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
  );
});

test("Tags lifecycle", async () => {
  const client = backup();
  const vaultName = `vault-tags-${Date.now()}`;

  const vault = await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );
  const arn = vault.BackupVaultArn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: { env: "test", app: "bunsai" },
    }),
  );

  const listed = await client.send(new ListTagsCommand({ ResourceArn: arn }));
  expect(listed.Tags?.["env"]).toBe("test");
  expect(listed.Tags?.["app"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeyList: ["app"] }),
  );

  const after = await client.send(new ListTagsCommand({ ResourceArn: arn }));
  expect(after.Tags?.["env"]).toBe("test");
  expect(after.Tags?.["app"]).toBeUndefined();

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
  );
});

test("Global and region settings", async () => {
  const client = backup();

  const global = await client.send(new DescribeGlobalSettingsCommand({}));
  expect(global.GlobalSettings).toBeDefined();

  await client.send(
    new UpdateGlobalSettingsCommand({
      GlobalSettings: { isCrossAccountBackupEnabled: "true" },
    }),
  );

  const updated = await client.send(new DescribeGlobalSettingsCommand({}));
  expect(updated.GlobalSettings?.["isCrossAccountBackupEnabled"]).toBe("true");

  const region = await client.send(new DescribeRegionSettingsCommand({}));
  expect(region.ResourceTypeOptInPreference).toBeDefined();

  await client.send(
    new UpdateRegionSettingsCommand({
      ResourceTypeOptInPreference: { EBS: true },
    }),
  );
});

test("GetSupportedResourceTypes returns list", async () => {
  const client = backup();
  const result = await client.send(new GetSupportedResourceTypesCommand({}));
  expect((result.ResourceTypes ?? []).length).toBeGreaterThan(0);
});

test("BackupJob lifecycle: CREATED → complete on describe", async () => {
  const client = backup();
  const vaultName = `vault-jlc-${Date.now()}`;

  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );

  const started = await client.send(
    new StartBackupJobCommand({
      BackupVaultName: vaultName,
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-lifecycle",
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  const jobId = started.BackupJobId!;
  const rpArn = started.RecoveryPointArn!;
  expect(jobId).toBeDefined();

  const listed = await client.send(new ListBackupJobsCommand({}));
  const found = (listed.BackupJobs ?? []).find((j) => j.BackupJobId === jobId);
  expect(found?.State).toBe("CREATED");

  const described = await client.send(
    new DescribeBackupJobCommand({ BackupJobId: jobId }),
  );
  expect(described.State).toBe("COMPLETED");
  expect(described.CompletionDate).toBeDefined();

  const rp = await client.send(
    new DescribeRecoveryPointCommand({
      BackupVaultName: vaultName,
      RecoveryPointArn: rpArn,
    }),
  );
  expect(rp.Status).toBe("COMPLETED");

  const meta = await client.send(
    new GetRecoveryPointRestoreMetadataCommand({
      BackupVaultName: vaultName,
      RecoveryPointArn: rpArn,
    }),
  );
  expect(meta.RestoreMetadata).toBeDefined();
  expect(Object.keys(meta.RestoreMetadata ?? {}).length).toBeGreaterThan(0);

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
  );
});

test("StartCopyJob: IamRoleArn required", async () => {
  const client = backup();
  const srcVault = `vault-cj-src-${Date.now()}`;
  const dstVault = `vault-cj-dst-${Date.now()}`;

  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: srcVault }),
  );
  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: dstVault }),
  );

  const started = await client.send(
    new StartBackupJobCommand({
      BackupVaultName: srcVault,
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-copysrc",
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  await client.send(
    new DescribeBackupJobCommand({ BackupJobId: started.BackupJobId! }),
  );

  await expect(
    client.send(
      new StartCopyJobCommand({
        RecoveryPointArn: started.RecoveryPointArn!,
        SourceBackupVaultName: srcVault,
        DestinationBackupVaultArn: `arn:aws:backup:us-east-1:123456789012:backup-vault:${dstVault}`,
        IamRoleArn: undefined as unknown as string,
      }),
    ),
  ).rejects.toThrow();

  const copyJob = await client.send(
    new StartCopyJobCommand({
      RecoveryPointArn: started.RecoveryPointArn!,
      SourceBackupVaultName: srcVault,
      DestinationBackupVaultArn: `arn:aws:backup:us-east-1:123456789012:backup-vault:${dstVault}`,
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  expect(copyJob.CopyJobId).toBeDefined();

  const describedCopy = await client.send(
    new DescribeCopyJobCommand({ CopyJobId: copyJob.CopyJobId! }),
  );
  expect(describedCopy.CopyJob?.State).toBe("COMPLETED");

  const listedCopy = await client.send(new ListCopyJobsCommand({}));
  expect((listedCopy.CopyJobs ?? []).map((j) => j.CopyJobId)).toContain(
    copyJob.CopyJobId,
  );

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: srcVault }),
  );
  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: dstVault }),
  );
});

test("ListBackupJobs filters and pagination", async () => {
  const client = backup();
  const vaultName = `vault-ljf-${Date.now()}`;

  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );

  const j1 = await client.send(
    new StartBackupJobCommand({
      BackupVaultName: vaultName,
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-f1",
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  const j2 = await client.send(
    new StartBackupJobCommand({
      BackupVaultName: vaultName,
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-f2",
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );

  await client.send(
    new DescribeBackupJobCommand({ BackupJobId: j1.BackupJobId! }),
  );

  const createdOnly = await client.send(
    new ListBackupJobsCommand({ ByState: "CREATED" }),
  );
  const completedOnly = await client.send(
    new ListBackupJobsCommand({ ByState: "COMPLETED" }),
  );
  expect((createdOnly.BackupJobs ?? []).map((j) => j.BackupJobId)).toContain(
    j2.BackupJobId,
  );
  expect((completedOnly.BackupJobs ?? []).map((j) => j.BackupJobId)).toContain(
    j1.BackupJobId,
  );

  const page1 = await client.send(new ListBackupJobsCommand({ MaxResults: 1 }));
  expect((page1.BackupJobs ?? []).length).toBe(1);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListBackupJobsCommand({ MaxResults: 1, NextToken: page1.NextToken }),
  );
  expect((page2.BackupJobs ?? []).length).toBe(1);
  expect(page1.BackupJobs![0].BackupJobId).not.toBe(
    page2.BackupJobs![0].BackupJobId,
  );

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
  );
});

test("RestoreJob lifecycle: PENDING → complete on describe", async () => {
  const client = backup();
  const vaultName = `vault-rjlc-${Date.now()}`;

  await client.send(
    new CreateBackupVaultCommand({ BackupVaultName: vaultName }),
  );
  const bj = await client.send(
    new StartBackupJobCommand({
      BackupVaultName: vaultName,
      ResourceArn: "arn:aws:ec2:us-east-1:123456789012:instance/i-rjsrc",
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  await client.send(
    new DescribeBackupJobCommand({ BackupJobId: bj.BackupJobId! }),
  );

  const rj = await client.send(
    new StartRestoreJobCommand({
      RecoveryPointArn: bj.RecoveryPointArn!,
      Metadata: {},
      IamRoleArn: "arn:aws:iam::123456789012:role/BackupRole",
    }),
  );
  expect(rj.RestoreJobId).toBeDefined();

  const listedPending = await client.send(
    new ListRestoreJobsCommand({ ByStatus: "PENDING" }),
  );
  expect(
    (listedPending.RestoreJobs ?? []).map((j) => j.RestoreJobId),
  ).toContain(rj.RestoreJobId);

  const described = await client.send(
    new DescribeRestoreJobCommand({ RestoreJobId: rj.RestoreJobId! }),
  );
  expect(described.Status).toBe("COMPLETED");
  expect(described.CompletionDate).toBeDefined();

  await client.send(
    new DeleteBackupVaultCommand({ BackupVaultName: vaultName }),
  );
});

test("ListBackupPlanVersions returns history after updates", async () => {
  const client = backup();
  const planName = `plan-ver-${Date.now()}`;

  const created = await client.send(
    new CreateBackupPlanCommand({
      BackupPlan: {
        BackupPlanName: planName,
        Rules: [
          {
            RuleName: "daily",
            TargetBackupVaultName: "Default",
            ScheduleExpression: "cron(0 12 * * ? *)",
          },
        ],
      },
    }),
  );
  const planId = created.BackupPlanId!;

  const v1 = await client.send(
    new ListBackupPlanVersionsCommand({ BackupPlanId: planId }),
  );
  expect((v1.BackupPlanVersionsList ?? []).length).toBe(1);

  await client.send(
    new UpdateBackupPlanCommand({
      BackupPlanId: planId,
      BackupPlan: {
        BackupPlanName: `${planName}-v2`,
        Rules: [
          {
            RuleName: "weekly",
            TargetBackupVaultName: "Default",
            ScheduleExpression: "cron(0 12 ? * SUN *)",
          },
        ],
      },
    }),
  );

  const v2 = await client.send(
    new ListBackupPlanVersionsCommand({ BackupPlanId: planId }),
  );
  expect((v2.BackupPlanVersionsList ?? []).length).toBe(2);
  const versionIds = (v2.BackupPlanVersionsList ?? []).map((v) => v.VersionId);
  expect(new Set(versionIds).size).toBe(2);

  await client.send(new DeleteBackupPlanCommand({ BackupPlanId: planId }));
});
