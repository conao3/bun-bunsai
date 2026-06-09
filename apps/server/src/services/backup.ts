import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import backupModel from "../../../../test/vendor/aws-models/backup.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(backupModel);

const vaultPrefix = "vault:" as const;
const planPrefix = "plan:" as const;
const selPrefix = "sel:" as const;
const fwPrefix = "fw:" as const;
const lhPrefix = "lh:" as const;
const rplnPrefix = "rpln:" as const;
const rtpPrefix = "rtp:" as const;
const rtsPrefix = "rts:" as const;
const tierPrefix = "tier:" as const;
const recvptPrefix = "recvpt:" as const;
const vpolPrefix = "vpol:" as const;
const vntfPrefix = "vntf:" as const;
const vlckPrefix = "vlck:" as const;
const bjPrefix = "bj:" as const;
const cjPrefix = "cj:" as const;
const rjPrefix = "rj:" as const;
const sjPrefix = "sj:" as const;
const rtjPrefix = "rtj:" as const;
const tagPrefix = "tag:" as const;
const gsKey = "gs" as const;
const rsKey = "rs" as const;
const lagvPrefix = "lagv:" as const;
const ravPrefix = "rav:" as const;
const planvPrefix = "planv:" as const;

type StoredVault = {
  BackupVaultName: string;
  BackupVaultArn: string;
  EncryptionKeyArn: string | undefined;
  CreatorRequestId: string | undefined;
  CreationDate: number;
  NumberOfRecoveryPoints: number;
  Locked: boolean;
  VaultType: string;
  VaultState: string;
};

type StoredPlan = {
  BackupPlanId: string;
  BackupPlanArn: string;
  VersionId: string;
  BackupPlanName: string;
  Rules: unknown[];
  AdvancedBackupSettings: unknown[];
  CreatorRequestId: string | undefined;
  CreationDate: number;
};

type StoredSelection = {
  SelectionId: string;
  BackupPlanId: string;
  SelectionName: string;
  IamRoleArn: string;
  ListOfTags: unknown[];
  Resources: unknown[];
  NotResources: unknown[];
  Conditions: unknown;
  CreationDate: number;
  CreatorRequestId: string | undefined;
};

type StoredFramework = {
  FrameworkName: string;
  FrameworkArn: string;
  FrameworkDescription: string | undefined;
  FrameworkControls: unknown[];
  CreationTime: number;
  DeploymentStatus: string;
  FrameworkStatus: string;
  IdempotencyToken: string | undefined;
};

type StoredLegalHold = {
  LegalHoldId: string;
  LegalHoldArn: string;
  Title: string;
  Description: string | undefined;
  Status: string;
  CreationDate: number;
  CancellationDate: number | undefined;
  RetainRecordUntil: number | undefined;
  RecoveryPointSelection: unknown;
};

type StoredReportPlan = {
  ReportPlanName: string;
  ReportPlanArn: string;
  ReportPlanDescription: string | undefined;
  ReportDeliveryChannel: unknown;
  ReportSetting: unknown;
  DeploymentStatus: string;
  CreationTime: number;
};

type StoredRestoreTestingPlan = {
  RestoreTestingPlanName: string;
  RestoreTestingPlanArn: string;
  RecoveryPointSelection: unknown;
  ScheduleExpression: string | undefined;
  ScheduleExpressionTimezone: string | undefined;
  StartWindowHours: number | undefined;
  CreatorRequestId: string | undefined;
  CreationTime: number;
};

type StoredRestoreTestingSelection = {
  RestoreTestingPlanName: string;
  RestoreTestingSelectionName: string;
  ProtectedResourceType: string;
  IamRoleArn: string;
  ValidationWindowHours: number | undefined;
  ProtectedResourceConditions: unknown;
  RestoreMetadataOverrides: unknown;
  ProtectedResourceArns: unknown[];
  CreatorRequestId: string | undefined;
  CreationTime: number;
};

type StoredTieringConfiguration = {
  BackupVaultName: string;
  TieringConfigurationName: string;
  TieringConfigurationArn: string;
  Tierings: unknown[];
  CreationTime: number;
};

type StoredRecoveryPoint = {
  RecoveryPointArn: string;
  BackupVaultName: string;
  BackupVaultArn: string;
  ResourceArn: string | undefined;
  ResourceType: string | undefined;
  Status: string;
  CreationDate: number;
  CompletionDate: number | undefined;
  BackupSizeInBytes: number;
  Lifecycle: unknown;
  EncryptionKeyArn: string | undefined;
  IsEncrypted: boolean;
  StorageClass: string;
  IsParent: boolean;
  IamRoleArn: string | undefined;
};

type StoredBackupJob = {
  BackupJobId: string;
  BackupVaultName: string;
  BackupVaultArn: string;
  RecoveryPointArn: string;
  ResourceArn: string | undefined;
  ResourceType: string | undefined;
  State: string;
  PercentDone: string;
  BackupSizeInBytes: number;
  IamRoleArn: string | undefined;
  CreationDate: number;
  CompletionDate: number | undefined;
};

type StoredCopyJob = {
  CopyJobId: string;
  SourceBackupVaultArn: string;
  SourceRecoveryPointArn: string;
  DestinationBackupVaultArn: string;
  DestinationRecoveryPointArn: string;
  ResourceArn: string | undefined;
  ResourceType: string | undefined;
  State: string;
  CreationDate: number;
  CompletionDate: number | undefined;
  BackupSizeInBytes: number;
  IamRoleArn: string | undefined;
};

type StoredRestoreJob = {
  RestoreJobId: string;
  RecoveryPointArn: string | undefined;
  CreationDate: number;
  CompletionDate: number | undefined;
  Status: string;
  PercentDone: string;
  BackupSizeInBytes: number;
  IamRoleArn: string | undefined;
  ExpectedCompletionTimeMinutes: number;
  CreatedResourceArn: string | undefined;
  ResourceType: string | undefined;
};

type StoredScanJob = {
  ScanJobId: string;
  BackupVaultName: string | undefined;
  RecoveryPointArn: string | undefined;
  ResourceArn: string | undefined;
  State: string;
  CreationDate: number;
  CompletionDate: number | undefined;
};

type StoredReportJob = {
  ReportJobId: string;
  ReportPlanArn: string;
  ReportTemplate: string;
  CreationTime: number;
  CompletionTime: number | undefined;
  Status: string;
};

type StoredGlobalSettings = {
  GlobalSettings: Record<string, string>;
  LastUpdateTime: number;
};

type StoredRegionSettings = {
  ResourceTypeOptInPreference: Record<string, boolean>;
  ResourceTypeManagementPreference: Record<string, boolean>;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const arrayOrEmpty = (value: unknown): unknown[] =>
  Array.isArray(value) ? (value as unknown[]) : [];

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      `${field} is required.`,
      400,
    );
  }
  return value;
};

const nowSeconds = (): number => Date.now() / 1000;

const vaultNameFromArn = (arnOrName: string): string => {
  if (!arnOrName.startsWith("arn:")) return arnOrName;
  return arnOrName.split(":").pop() ?? arnOrName;
};

const paginate = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: string | undefined,
): { items: T[]; nextToken: string | undefined } => {
  const start = nextToken !== undefined ? parseInt(atob(nextToken), 10) : 0;
  const limit =
    maxResults !== undefined && maxResults > 0 ? maxResults : items.length;
  const sliced = items.slice(start, start + limit);
  const newNextToken =
    start + limit < items.length ? btoa(String(start + limit)) : undefined;
  return { items: sliced, nextToken: newNextToken };
};

const restoreMetadataFor = (
  rp: StoredRecoveryPoint,
): Record<string, string> => {
  const resourceArn = rp.ResourceArn ?? "";
  switch (rp.ResourceType) {
    case "EC2":
      return {
        imageId: "ami-00000000",
        instanceType: "t3.medium",
        subnetId: "subnet-00000000",
        securityGroupIds: "sg-00000000",
      };
    case "EBS":
      return {
        volumeId: resourceArn.split("/").pop() ?? "",
        availabilityZone: "us-east-1a",
        volumeType: "gp3",
      };
    case "RDS":
      return {
        DBInstanceIdentifier: resourceArn.split(":").pop() ?? "",
        DBInstanceClass: "db.t3.medium",
        Engine: "mysql",
      };
    case "S3":
      return {
        DestinationBucketName: resourceArn.split(":::").pop() ?? "",
        S3DataTransfer: "false",
      };
    default:
      return {};
  }
};

const vaultKey = (name: string): string => `${vaultPrefix}${name}`;
const planKey = (id: string): string => `${planPrefix}${id}`;
const planvKey = (id: string): string => `${planvPrefix}${id}`;
const selKey = (planId: string, selId: string): string =>
  `${selPrefix}${planId}:${selId}`;
const selKeyPrefix = (planId: string): string => `${selPrefix}${planId}:`;
const fwKey = (name: string): string => `${fwPrefix}${name}`;
const lhKey = (id: string): string => `${lhPrefix}${id}`;
const rplnKey = (name: string): string => `${rplnPrefix}${name}`;
const rtpKey = (name: string): string => `${rtpPrefix}${name}`;
const rtsKey = (planName: string, selName: string): string =>
  `${rtsPrefix}${planName}:${selName}`;
const rtsKeyPrefix = (planName: string): string => `${rtsPrefix}${planName}:`;
const tierKey = (name: string): string => `${tierPrefix}${name}`;
const recvptKey = (vaultName: string, arn: string): string =>
  `${recvptPrefix}${vaultName}:${arn}`;
const recvptKeyPrefix = (vaultName: string): string =>
  `${recvptPrefix}${vaultName}:`;
const vpolKey = (vaultName: string): string => `${vpolPrefix}${vaultName}`;
const vntfKey = (vaultName: string): string => `${vntfPrefix}${vaultName}`;
const vlckKey = (vaultName: string): string => `${vlckPrefix}${vaultName}`;
const bjKey = (id: string): string => `${bjPrefix}${id}`;
const cjKey = (id: string): string => `${cjPrefix}${id}`;
const rjKey = (id: string): string => `${rjPrefix}${id}`;
const sjKey = (id: string): string => `${sjPrefix}${id}`;
const rtjKey = (id: string): string => `${rtjPrefix}${id}`;
const tagKey = (arn: string): string => `${tagPrefix}${arn}`;
const lagvKey = (name: string): string => `${lagvPrefix}${name}`;
const ravKey = (lagName: string, arn: string): string =>
  `${ravPrefix}${lagName}:${arn}`;
const ravKeyPrefix = (lagName: string): string => `${ravPrefix}${lagName}:`;

const vaultArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:backup-vault:${name}`;

const planArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:backup-plan:${id}`;

const fwArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:framework:${name}`;

const lhArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:legal-hold:${id}`;

const rplnArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:report-plan:${name}`;

const rtpArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:restore-testing/plan:${name}`;

const tierArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:tiering-configuration:${name}`;

const recvptArnFor = (
  ctx: ServiceContext,
  vaultName: string,
  id: string,
): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:recovery-point:${vaultName}:${id}`;

const requireVault = (ctx: ServiceContext, name: string): StoredVault => {
  const vault = ctx.store.get<StoredVault>(vaultKey(name));
  if (vault === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Backup vault ${name} not found.`,
      404,
    );
  }
  return vault;
};

const requirePlan = (ctx: ServiceContext, id: string): StoredPlan => {
  const plan = ctx.store.get<StoredPlan>(planKey(id));
  if (plan === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Backup plan ${id} not found.`,
      404,
    );
  }
  return plan;
};

const requireSelection = (
  ctx: ServiceContext,
  planId: string,
  selId: string,
): StoredSelection => {
  const sel = ctx.store.get<StoredSelection>(selKey(planId, selId));
  if (sel === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Backup selection ${selId} not found.`,
      404,
    );
  }
  return sel;
};

const requireFramework = (
  ctx: ServiceContext,
  name: string,
): StoredFramework => {
  const fw = ctx.store.get<StoredFramework>(fwKey(name));
  if (fw === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Framework ${name} not found.`,
      404,
    );
  }
  return fw;
};

const requireLegalHold = (ctx: ServiceContext, id: string): StoredLegalHold => {
  const lh = ctx.store.get<StoredLegalHold>(lhKey(id));
  if (lh === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Legal hold ${id} not found.`,
      404,
    );
  }
  return lh;
};

const requireReportPlan = (
  ctx: ServiceContext,
  name: string,
): StoredReportPlan => {
  const rp = ctx.store.get<StoredReportPlan>(rplnKey(name));
  if (rp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report plan ${name} not found.`,
      404,
    );
  }
  return rp;
};

const requireRtp = (
  ctx: ServiceContext,
  name: string,
): StoredRestoreTestingPlan => {
  const rtp = ctx.store.get<StoredRestoreTestingPlan>(rtpKey(name));
  if (rtp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Restore testing plan ${name} not found.`,
      404,
    );
  }
  return rtp;
};

const requireRts = (
  ctx: ServiceContext,
  planName: string,
  selName: string,
): StoredRestoreTestingSelection => {
  const rts = ctx.store.get<StoredRestoreTestingSelection>(
    rtsKey(planName, selName),
  );
  if (rts === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Restore testing selection ${selName} not found.`,
      404,
    );
  }
  return rts;
};

const requireTier = (
  ctx: ServiceContext,
  name: string,
): StoredTieringConfiguration => {
  const tier = ctx.store.get<StoredTieringConfiguration>(tierKey(name));
  if (tier === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Tiering configuration ${name} not found.`,
      404,
    );
  }
  return tier;
};

const requireRecoveryPoint = (
  ctx: ServiceContext,
  vaultName: string,
  arn: string,
): StoredRecoveryPoint => {
  const rp = ctx.store.get<StoredRecoveryPoint>(recvptKey(vaultName, arn));
  if (rp === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Recovery point ${arn} not found.`,
      404,
    );
  }
  return rp;
};

const requireBackupJob = (ctx: ServiceContext, id: string): StoredBackupJob => {
  const job = ctx.store.get<StoredBackupJob>(bjKey(id));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Backup job ${id} not found.`,
      404,
    );
  }
  return job;
};

const requireCopyJob = (ctx: ServiceContext, id: string): StoredCopyJob => {
  const job = ctx.store.get<StoredCopyJob>(cjKey(id));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Copy job ${id} not found.`,
      404,
    );
  }
  return job;
};

const requireRestoreJob = (
  ctx: ServiceContext,
  id: string,
): StoredRestoreJob => {
  const job = ctx.store.get<StoredRestoreJob>(rjKey(id));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Restore job ${id} not found.`,
      404,
    );
  }
  return job;
};

const requireScanJob = (ctx: ServiceContext, id: string): StoredScanJob => {
  const job = ctx.store.get<StoredScanJob>(sjKey(id));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Scan job ${id} not found.`,
      404,
    );
  }
  return job;
};

const requireReportJob = (ctx: ServiceContext, id: string): StoredReportJob => {
  const job = ctx.store.get<StoredReportJob>(rtjKey(id));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Report job ${id} not found.`,
      404,
    );
  }
  return job;
};

const vaultView = (vault: StoredVault): Record<string, unknown> => ({
  BackupVaultName: vault.BackupVaultName,
  BackupVaultArn: vault.BackupVaultArn,
  VaultType: vault.VaultType,
  VaultState: vault.VaultState,
  CreationDate: vault.CreationDate,
  EncryptionKeyArn: vault.EncryptionKeyArn,
  CreatorRequestId: vault.CreatorRequestId,
  NumberOfRecoveryPoints: vault.NumberOfRecoveryPoints,
  Locked: vault.Locked,
});

const recvptView = (rp: StoredRecoveryPoint): Record<string, unknown> => ({
  RecoveryPointArn: rp.RecoveryPointArn,
  BackupVaultName: rp.BackupVaultName,
  BackupVaultArn: rp.BackupVaultArn,
  ResourceArn: rp.ResourceArn,
  ResourceType: rp.ResourceType,
  Status: rp.Status,
  CreationDate: rp.CreationDate,
  CompletionDate: rp.CompletionDate,
  BackupSizeInBytes: rp.BackupSizeInBytes,
  Lifecycle: rp.Lifecycle,
  EncryptionKeyArn: rp.EncryptionKeyArn,
  IsEncrypted: rp.IsEncrypted,
  StorageClass: rp.StorageClass,
  IsParent: rp.IsParent,
  IamRoleArn: rp.IamRoleArn,
});

const bjView = (job: StoredBackupJob): Record<string, unknown> => ({
  BackupJobId: job.BackupJobId,
  BackupVaultName: job.BackupVaultName,
  BackupVaultArn: job.BackupVaultArn,
  RecoveryPointArn: job.RecoveryPointArn,
  ResourceArn: job.ResourceArn,
  ResourceType: job.ResourceType,
  State: job.State,
  PercentDone: job.PercentDone,
  BackupSizeInBytes: job.BackupSizeInBytes,
  IamRoleArn: job.IamRoleArn,
  CreationDate: job.CreationDate,
  CompletionDate: job.CompletionDate,
});

const rjView = (job: StoredRestoreJob): Record<string, unknown> => ({
  RestoreJobId: job.RestoreJobId,
  RecoveryPointArn: job.RecoveryPointArn,
  CreationDate: job.CreationDate,
  CompletionDate: job.CompletionDate,
  Status: job.Status,
  PercentDone: job.PercentDone,
  BackupSizeInBytes: job.BackupSizeInBytes,
  IamRoleArn: job.IamRoleArn,
  ExpectedCompletionTimeMinutes: job.ExpectedCompletionTimeMinutes,
  CreatedResourceArn: job.CreatedResourceArn,
  ResourceType: job.ResourceType,
});

const cjView = (job: StoredCopyJob): Record<string, unknown> => ({
  CopyJobId: job.CopyJobId,
  SourceBackupVaultArn: job.SourceBackupVaultArn,
  SourceRecoveryPointArn: job.SourceRecoveryPointArn,
  DestinationBackupVaultArn: job.DestinationBackupVaultArn,
  DestinationRecoveryPointArn: job.DestinationRecoveryPointArn,
  ResourceArn: job.ResourceArn,
  ResourceType: job.ResourceType,
  State: job.State,
  CreationDate: job.CreationDate,
  CompletionDate: job.CompletionDate,
  BackupSizeInBytes: job.BackupSizeInBytes,
  IamRoleArn: job.IamRoleArn,
});

const ruleView = (rule: unknown): unknown => {
  const record = recordOrUndefined(rule);
  if (record === undefined) return rule;
  const ruleId = stringOrUndefined(record["RuleId"]);
  if (ruleId !== undefined) return record;
  return { ...record, RuleId: crypto.randomUUID() };
};

const planListMember = (plan: StoredPlan): Record<string, unknown> => ({
  BackupPlanArn: plan.BackupPlanArn,
  BackupPlanId: plan.BackupPlanId,
  CreationDate: plan.CreationDate,
  VersionId: plan.VersionId,
  BackupPlanName: plan.BackupPlanName,
  CreatorRequestId: plan.CreatorRequestId,
  AdvancedBackupSettings: plan.AdvancedBackupSettings,
});

const CreateBackupVault: OperationHandler = (input, ctx) => {
  const name = requireString(input, "BackupVaultName");
  const existing = ctx.store.get<StoredVault>(vaultKey(name));
  if (existing !== undefined) {
    return {
      BackupVaultName: existing.BackupVaultName,
      BackupVaultArn: existing.BackupVaultArn,
      CreationDate: existing.CreationDate,
    };
  }
  const vault: StoredVault = {
    BackupVaultName: name,
    BackupVaultArn: vaultArn(ctx, name),
    EncryptionKeyArn: stringOrUndefined(input["EncryptionKeyArn"]),
    CreatorRequestId: stringOrUndefined(input["CreatorRequestId"]),
    CreationDate: nowSeconds(),
    NumberOfRecoveryPoints: 0,
    Locked: false,
    VaultType: "BACKUP_VAULT",
    VaultState: "AVAILABLE",
  };
  ctx.store.set(vaultKey(name), vault);
  return {
    BackupVaultName: vault.BackupVaultName,
    BackupVaultArn: vault.BackupVaultArn,
    CreationDate: vault.CreationDate,
  };
};

const DescribeBackupVault: OperationHandler = (input, ctx) => {
  const name = requireString(input, "BackupVaultName");
  const vault = requireVault(ctx, name);
  return {
    BackupVaultName: vault.BackupVaultName,
    BackupVaultArn: vault.BackupVaultArn,
    VaultType: vault.VaultType,
    VaultState: vault.VaultState,
    EncryptionKeyArn: vault.EncryptionKeyArn,
    CreationDate: vault.CreationDate,
    CreatorRequestId: vault.CreatorRequestId,
    NumberOfRecoveryPoints: vault.NumberOfRecoveryPoints,
    Locked: vault.Locked,
  };
};

const ListBackupVaults: OperationHandler = (_input, ctx) => {
  const vaults = ctx.store
    .list<StoredVault>()
    .filter((entry) => entry.key.startsWith(vaultPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.BackupVaultName < b.BackupVaultName
        ? -1
        : a.BackupVaultName > b.BackupVaultName
          ? 1
          : 0,
    );
  return { BackupVaultList: vaults.map(vaultView) };
};

const DeleteBackupVault: OperationHandler = (input, ctx) => {
  const name = requireString(input, "BackupVaultName");
  requireVault(ctx, name);
  ctx.store.delete(vaultKey(name));
  return {};
};

const AssociateBackupVaultMpaApprovalTeam: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  const teamArn = requireString(input, "MpaApprovalTeamArn");
  ctx.store.set(`mpa:${vaultName}`, { MpaApprovalTeamArn: teamArn });
  return {};
};

const DisassociateBackupVaultMpaApprovalTeam: OperationHandler = (
  input,
  ctx,
) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  ctx.store.delete(`mpa:${vaultName}`);
  return {};
};

const PutBackupVaultAccessPolicy: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  const policy = stringOrUndefined(input["Policy"]) ?? "";
  ctx.store.set(vpolKey(vaultName), { Policy: policy });
  return {};
};

const GetBackupVaultAccessPolicy: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const vault = requireVault(ctx, vaultName);
  const stored = ctx.store.get<{ Policy: string }>(vpolKey(vaultName));
  return {
    BackupVaultName: vault.BackupVaultName,
    BackupVaultArn: vault.BackupVaultArn,
    Policy: stored?.Policy,
  };
};

const DeleteBackupVaultAccessPolicy: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  ctx.store.delete(vpolKey(vaultName));
  return {};
};

const PutBackupVaultNotifications: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  ctx.store.set(vntfKey(vaultName), {
    SNSTopicArn: stringOrUndefined(input["SNSTopicArn"]) ?? "",
    BackupVaultEvents: arrayOrEmpty(input["BackupVaultEvents"]),
  });
  return {};
};

const GetBackupVaultNotifications: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const vault = requireVault(ctx, vaultName);
  const stored = ctx.store.get<{
    SNSTopicArn: string;
    BackupVaultEvents: unknown[];
  }>(vntfKey(vaultName));
  return {
    BackupVaultName: vault.BackupVaultName,
    BackupVaultArn: vault.BackupVaultArn,
    SNSTopicArn: stored?.SNSTopicArn,
    BackupVaultEvents: stored?.BackupVaultEvents ?? [],
  };
};

const DeleteBackupVaultNotifications: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  ctx.store.delete(vntfKey(vaultName));
  return {};
};

const PutBackupVaultLockConfiguration: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  ctx.store.set(vlckKey(vaultName), {
    MinRetentionDays: numberOrUndefined(input["MinRetentionDays"]),
    MaxRetentionDays: numberOrUndefined(input["MaxRetentionDays"]),
    ChangeableForDays: numberOrUndefined(input["ChangeableForDays"]),
  });
  const vault = ctx.store.get<StoredVault>(vaultKey(vaultName))!;
  ctx.store.set(vaultKey(vaultName), { ...vault, Locked: true });
  return {};
};

const DeleteBackupVaultLockConfiguration: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  ctx.store.delete(vlckKey(vaultName));
  const vault = ctx.store.get<StoredVault>(vaultKey(vaultName))!;
  ctx.store.set(vaultKey(vaultName), { ...vault, Locked: false });
  return {};
};

const ListProtectedResourcesByBackupVault: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  const arns = new Set<string>();
  ctx.store
    .list<StoredRecoveryPoint>()
    .filter((e) => e.key.startsWith(recvptKeyPrefix(vaultName)))
    .map((e) => e.value)
    .forEach((rp) => {
      if (rp.ResourceArn !== undefined) arns.add(rp.ResourceArn);
    });
  return {
    Results: Array.from(arns).map((arn) => ({
      ResourceArn: arn,
      ResourceType: "EC2",
    })),
  };
};

const ListRecoveryPointsByBackupVault: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  requireVault(ctx, vaultName);
  const rps = ctx.store
    .list<StoredRecoveryPoint>()
    .filter((e) => e.key.startsWith(recvptKeyPrefix(vaultName)))
    .map((e) => e.value);
  return { RecoveryPoints: rps.map(recvptView) };
};

const DescribeRecoveryPoint: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  const rp = requireRecoveryPoint(ctx, vaultName, rpArn);
  return {
    RecoveryPointArn: rp.RecoveryPointArn,
    BackupVaultName: rp.BackupVaultName,
    BackupVaultArn: rp.BackupVaultArn,
    ResourceArn: rp.ResourceArn,
    ResourceType: rp.ResourceType,
    Status: rp.Status,
    CreationDate: rp.CreationDate,
    CompletionDate: rp.CompletionDate,
    BackupSizeInBytes: rp.BackupSizeInBytes,
    Lifecycle: rp.Lifecycle,
    EncryptionKeyArn: rp.EncryptionKeyArn,
    IsEncrypted: rp.IsEncrypted,
    StorageClass: rp.StorageClass,
    IsParent: rp.IsParent,
    IamRoleArn: rp.IamRoleArn,
  };
};

const DeleteRecoveryPoint: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  requireRecoveryPoint(ctx, vaultName, rpArn);
  ctx.store.delete(recvptKey(vaultName, rpArn));
  const vault = ctx.store.get<StoredVault>(vaultKey(vaultName));
  if (vault !== undefined && vault.NumberOfRecoveryPoints > 0) {
    ctx.store.set(vaultKey(vaultName), {
      ...vault,
      NumberOfRecoveryPoints: vault.NumberOfRecoveryPoints - 1,
    });
  }
  return {};
};

const UpdateRecoveryPointLifecycle: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  const rp = requireRecoveryPoint(ctx, vaultName, rpArn);
  const lifecycle = recordOrUndefined(input["Lifecycle"]);
  ctx.store.set(recvptKey(vaultName, rpArn), {
    ...rp,
    Lifecycle: lifecycle ?? rp.Lifecycle,
  });
  return {
    BackupVaultArn: rp.BackupVaultArn,
    RecoveryPointArn: rp.RecoveryPointArn,
    Lifecycle: lifecycle ?? rp.Lifecycle,
    CalculatedLifecycle: { DeleteAt: null, MoveToColdStorageAt: null },
  };
};

const GetRecoveryPointRestoreMetadata: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  const rp = requireRecoveryPoint(ctx, vaultName, rpArn);
  return {
    BackupVaultArn: rp.BackupVaultArn,
    RecoveryPointArn: rp.RecoveryPointArn,
    RestoreMetadata: restoreMetadataFor(rp),
    ResourceType: rp.ResourceType,
  };
};

const GetRecoveryPointIndexDetails: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  const rp = requireRecoveryPoint(ctx, vaultName, rpArn);
  return {
    RecoveryPointArn: rp.RecoveryPointArn,
    BackupVaultArn: rp.BackupVaultArn,
    SourceResourceArn: rp.ResourceArn,
    IndexStatus: "ACTIVE",
    TotalItemsIndexed: 0,
  };
};

const UpdateRecoveryPointIndexSettings: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  requireRecoveryPoint(ctx, vaultName, rpArn);
  return {
    BackupVaultName: vaultName,
    RecoveryPointArn: rpArn,
    IndexStatus: "ACTIVE",
  };
};

const DisassociateRecoveryPoint: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  requireRecoveryPoint(ctx, vaultName, rpArn);
  return {};
};

const DisassociateRecoveryPointFromParent: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const rpArn = requireString(input, "RecoveryPointArn");
  const rp = requireRecoveryPoint(ctx, vaultName, rpArn);
  ctx.store.set(recvptKey(vaultName, rpArn), {
    ...rp,
    IsParent: false,
    ParentRecoveryPointArn: undefined,
  });
  return {};
};

const CreateBackupPlan: OperationHandler = (input, ctx) => {
  const plan = recordOrUndefined(input["BackupPlan"]);
  if (plan === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "BackupPlan is required.",
      400,
    );
  }
  const planName = requireString(plan, "BackupPlanName");
  const id = crypto.randomUUID();
  const stored: StoredPlan = {
    BackupPlanId: id,
    BackupPlanArn: planArn(ctx, id),
    VersionId: crypto.randomUUID().replace(/-/g, ""),
    BackupPlanName: planName,
    Rules: arrayOrEmpty(plan["Rules"]),
    AdvancedBackupSettings: arrayOrEmpty(plan["AdvancedBackupSettings"]),
    CreatorRequestId: stringOrUndefined(input["CreatorRequestId"]),
    CreationDate: nowSeconds(),
  };
  ctx.store.set(planKey(id), stored);
  ctx.store.set(planvKey(id), [stored]);
  return {
    BackupPlanId: stored.BackupPlanId,
    BackupPlanArn: stored.BackupPlanArn,
    CreationDate: stored.CreationDate,
    VersionId: stored.VersionId,
    AdvancedBackupSettings: stored.AdvancedBackupSettings,
  };
};

const GetBackupPlan: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BackupPlanId");
  const plan = requirePlan(ctx, id);
  return {
    BackupPlan: {
      BackupPlanName: plan.BackupPlanName,
      Rules: plan.Rules.map(ruleView),
      AdvancedBackupSettings: plan.AdvancedBackupSettings,
    },
    BackupPlanId: plan.BackupPlanId,
    BackupPlanArn: plan.BackupPlanArn,
    VersionId: plan.VersionId,
    CreatorRequestId: plan.CreatorRequestId,
    CreationDate: plan.CreationDate,
    AdvancedBackupSettings: plan.AdvancedBackupSettings,
  };
};

const ListBackupPlans: OperationHandler = (_input, ctx) => {
  const plans = ctx.store
    .list<StoredPlan>()
    .filter((entry) => entry.key.startsWith(planPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.BackupPlanId < b.BackupPlanId
        ? -1
        : a.BackupPlanId > b.BackupPlanId
          ? 1
          : 0,
    );
  return { BackupPlansList: plans.map(planListMember) };
};

const DeleteBackupPlan: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BackupPlanId");
  const plan = requirePlan(ctx, id);
  ctx.store.delete(planKey(id));
  return {
    BackupPlanId: plan.BackupPlanId,
    BackupPlanArn: plan.BackupPlanArn,
    DeletionDate: nowSeconds(),
    VersionId: plan.VersionId,
  };
};

const UpdateBackupPlan: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BackupPlanId");
  const plan = requirePlan(ctx, id);
  const planData = recordOrUndefined(input["BackupPlan"]);
  const newVersionId = crypto.randomUUID().replace(/-/g, "");
  const updated: StoredPlan = {
    ...plan,
    VersionId: newVersionId,
    BackupPlanName: planData
      ? (stringOrUndefined(planData["BackupPlanName"]) ?? plan.BackupPlanName)
      : plan.BackupPlanName,
    Rules: planData ? arrayOrEmpty(planData["Rules"]) : plan.Rules,
    AdvancedBackupSettings: planData
      ? arrayOrEmpty(planData["AdvancedBackupSettings"])
      : plan.AdvancedBackupSettings,
  };
  ctx.store.set(planKey(id), updated);
  const versions = ctx.store.get<StoredPlan[]>(planvKey(id)) ?? [plan];
  ctx.store.set(planvKey(id), [updated, ...versions]);
  return {
    BackupPlanId: updated.BackupPlanId,
    BackupPlanArn: updated.BackupPlanArn,
    CreationDate: updated.CreationDate,
    VersionId: updated.VersionId,
    AdvancedBackupSettings: updated.AdvancedBackupSettings,
  };
};

const ExportBackupPlanTemplate: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BackupPlanId");
  requirePlan(ctx, id);
  return {
    BackupPlanTemplateJson: JSON.stringify({
      BackupPlanName: "ExportedPlan",
      Rules: [],
    }),
  };
};

const ListBackupPlanVersions: OperationHandler = (input, ctx) => {
  const id = requireString(input, "BackupPlanId");
  requirePlan(ctx, id);
  const versions = ctx.store.get<StoredPlan[]>(planvKey(id)) ?? [];
  return { BackupPlanVersionsList: versions.map(planListMember) };
};

const CreateBackupSelection: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "BackupPlanId");
  requirePlan(ctx, planId);
  const selData = recordOrUndefined(input["BackupSelection"]);
  if (selData === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "BackupSelection is required.",
      400,
    );
  }
  const selId = crypto.randomUUID();
  const sel: StoredSelection = {
    SelectionId: selId,
    BackupPlanId: planId,
    SelectionName: requireString(selData, "SelectionName"),
    IamRoleArn: stringOrUndefined(selData["IamRoleArn"]) ?? "",
    ListOfTags: arrayOrEmpty(selData["ListOfTags"]),
    Resources: arrayOrEmpty(selData["Resources"]),
    NotResources: arrayOrEmpty(selData["NotResources"]),
    Conditions: recordOrUndefined(selData["Conditions"]) ?? {},
    CreationDate: nowSeconds(),
    CreatorRequestId: stringOrUndefined(input["CreatorRequestId"]),
  };
  ctx.store.set(selKey(planId, selId), sel);
  return {
    SelectionId: sel.SelectionId,
    BackupPlanId: sel.BackupPlanId,
    CreationDate: sel.CreationDate,
  };
};

const GetBackupSelection: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "BackupPlanId");
  const selId = requireString(input, "SelectionId");
  const sel = requireSelection(ctx, planId, selId);
  return {
    BackupSelection: {
      SelectionName: sel.SelectionName,
      IamRoleArn: sel.IamRoleArn,
      Resources: sel.Resources,
      ListOfTags: sel.ListOfTags,
      NotResources: sel.NotResources,
      Conditions: sel.Conditions,
    },
    SelectionId: sel.SelectionId,
    BackupPlanId: sel.BackupPlanId,
    CreationDate: sel.CreationDate,
    CreatorRequestId: sel.CreatorRequestId,
  };
};

const ListBackupSelections: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "BackupPlanId");
  requirePlan(ctx, planId);
  const sels = ctx.store
    .list<StoredSelection>()
    .filter((e) => e.key.startsWith(selKeyPrefix(planId)))
    .map((e) => e.value);
  return {
    BackupSelectionsList: sels.map((s) => ({
      SelectionId: s.SelectionId,
      SelectionName: s.SelectionName,
      BackupPlanId: s.BackupPlanId,
      CreationDate: s.CreationDate,
      IamRoleArn: s.IamRoleArn,
      CreatorRequestId: s.CreatorRequestId,
    })),
  };
};

const DeleteBackupSelection: OperationHandler = (input, ctx) => {
  const planId = requireString(input, "BackupPlanId");
  const selId = requireString(input, "SelectionId");
  requireSelection(ctx, planId, selId);
  ctx.store.delete(selKey(planId, selId));
  return {};
};

const GetBackupPlanFromJSON: OperationHandler = (input, _ctx) => {
  const jsonStr = stringOrUndefined(input["BackupPlanTemplateJson"]) ?? "{}";
  let planData: Record<string, unknown> = {};
  try {
    planData = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw awsError(
      "InvalidParameterValueException",
      "BackupPlanTemplateJson is not valid JSON.",
      400,
    );
  }
  return {
    BackupPlan: {
      BackupPlanName:
        stringOrUndefined(planData["BackupPlanName"]) ?? "ParsedPlan",
      Rules: arrayOrEmpty(planData["Rules"]),
      AdvancedBackupSettings: arrayOrEmpty(planData["AdvancedBackupSettings"]),
    },
  };
};

const GetBackupPlanFromTemplate: OperationHandler = (input, _ctx) => {
  const templateId = requireString(input, "BackupPlanTemplateId");
  return {
    BackupPlanDocument: {
      BackupPlanName: `Plan-from-${templateId}`,
      Rules: [
        {
          RuleName: "DefaultRule",
          TargetBackupVaultName: "Default",
          ScheduleExpression: "cron(0 5 ? * * *)",
        },
      ],
      AdvancedBackupSettings: [],
    },
  };
};

const ListBackupPlanTemplates: OperationHandler = (_input, _ctx) => {
  return {
    BackupPlanTemplatesList: [
      {
        BackupPlanTemplateId: "daily-35day-retention",
        BackupPlanTemplateName: "Daily-35day-Retention",
      },
      {
        BackupPlanTemplateId: "daily-monthly-1yr-retention",
        BackupPlanTemplateName: "Daily-Monthly-1yr-Retention",
      },
    ],
  };
};

const CreateFramework: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FrameworkName");
  const fw: StoredFramework = {
    FrameworkName: name,
    FrameworkArn: fwArn(ctx, name),
    FrameworkDescription: stringOrUndefined(input["FrameworkDescription"]),
    FrameworkControls: arrayOrEmpty(input["FrameworkControls"]),
    CreationTime: nowSeconds(),
    DeploymentStatus: "COMPLETED",
    FrameworkStatus: "ACTIVE",
    IdempotencyToken: stringOrUndefined(input["IdempotencyToken"]),
  };
  ctx.store.set(fwKey(name), fw);
  return { FrameworkName: fw.FrameworkName, FrameworkArn: fw.FrameworkArn };
};

const DescribeFramework: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FrameworkName");
  const fw = requireFramework(ctx, name);
  return {
    FrameworkName: fw.FrameworkName,
    FrameworkArn: fw.FrameworkArn,
    FrameworkDescription: fw.FrameworkDescription,
    FrameworkControls: fw.FrameworkControls,
    CreationTime: fw.CreationTime,
    DeploymentStatus: fw.DeploymentStatus,
    FrameworkStatus: fw.FrameworkStatus,
    IdempotencyToken: fw.IdempotencyToken,
  };
};

const ListFrameworks: OperationHandler = (_input, ctx) => {
  const fws = ctx.store
    .list<StoredFramework>()
    .filter((e) => e.key.startsWith(fwPrefix))
    .map((e) => e.value);
  return {
    Frameworks: fws.map((fw) => ({
      FrameworkName: fw.FrameworkName,
      FrameworkArn: fw.FrameworkArn,
      FrameworkDescription: fw.FrameworkDescription,
      CreationTime: fw.CreationTime,
      DeploymentStatus: fw.DeploymentStatus,
      FrameworkStatus: fw.FrameworkStatus,
    })),
  };
};

const UpdateFramework: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FrameworkName");
  const fw = requireFramework(ctx, name);
  ctx.store.set(fwKey(name), {
    ...fw,
    FrameworkDescription:
      stringOrUndefined(input["FrameworkDescription"]) ??
      fw.FrameworkDescription,
    FrameworkControls:
      input["FrameworkControls"] !== undefined
        ? arrayOrEmpty(input["FrameworkControls"])
        : fw.FrameworkControls,
  });
  return { FrameworkName: fw.FrameworkName, FrameworkArn: fw.FrameworkArn };
};

const DeleteFramework: OperationHandler = (input, ctx) => {
  const name = requireString(input, "FrameworkName");
  requireFramework(ctx, name);
  ctx.store.delete(fwKey(name));
  return {};
};

const CreateLegalHold: OperationHandler = (input, ctx) => {
  const title = requireString(input, "Title");
  const id = crypto.randomUUID();
  const lh: StoredLegalHold = {
    LegalHoldId: id,
    LegalHoldArn: lhArn(ctx, id),
    Title: title,
    Description: stringOrUndefined(input["Description"]),
    Status: "ACTIVE",
    CreationDate: nowSeconds(),
    CancellationDate: undefined,
    RetainRecordUntil: numberOrUndefined(input["RetainRecordUntil"]),
    RecoveryPointSelection:
      recordOrUndefined(input["RecoveryPointSelection"]) ?? {},
  };
  ctx.store.set(lhKey(id), lh);
  return {
    Title: lh.Title,
    Status: lh.Status,
    Description: lh.Description,
    LegalHoldId: lh.LegalHoldId,
    LegalHoldArn: lh.LegalHoldArn,
    CreationDate: lh.CreationDate,
    RecoveryPointSelection: lh.RecoveryPointSelection,
  };
};

const GetLegalHold: OperationHandler = (input, ctx) => {
  const id = requireString(input, "LegalHoldId");
  const lh = requireLegalHold(ctx, id);
  return {
    Title: lh.Title,
    Status: lh.Status,
    Description: lh.Description,
    LegalHoldId: lh.LegalHoldId,
    LegalHoldArn: lh.LegalHoldArn,
    CreationDate: lh.CreationDate,
    CancellationDate: lh.CancellationDate,
    RetainRecordUntil: lh.RetainRecordUntil,
    RecoveryPointSelection: lh.RecoveryPointSelection,
  };
};

const ListLegalHolds: OperationHandler = (_input, ctx) => {
  const holds = ctx.store
    .list<StoredLegalHold>()
    .filter((e) => e.key.startsWith(lhPrefix))
    .map((e) => e.value);
  return {
    LegalHolds: holds.map((lh) => ({
      LegalHoldId: lh.LegalHoldId,
      LegalHoldArn: lh.LegalHoldArn,
      Title: lh.Title,
      Status: lh.Status,
      Description: lh.Description,
      CreationDate: lh.CreationDate,
      CancellationDate: lh.CancellationDate,
    })),
  };
};

const CancelLegalHold: OperationHandler = (input, ctx) => {
  const id = requireString(input, "LegalHoldId");
  const lh = requireLegalHold(ctx, id);
  ctx.store.set(lhKey(id), {
    ...lh,
    Status: "CANCELLED",
    CancellationDate: nowSeconds(),
  });
  return {};
};

const ListRecoveryPointsByLegalHold: OperationHandler = (input, ctx) => {
  const id = requireString(input, "LegalHoldId");
  requireLegalHold(ctx, id);
  return { RecoveryPoints: [] };
};

const CreateReportPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReportPlanName");
  const rp: StoredReportPlan = {
    ReportPlanName: name,
    ReportPlanArn: rplnArn(ctx, name),
    ReportPlanDescription: stringOrUndefined(input["ReportPlanDescription"]),
    ReportDeliveryChannel:
      recordOrUndefined(input["ReportDeliveryChannel"]) ?? {},
    ReportSetting: recordOrUndefined(input["ReportSetting"]) ?? {},
    DeploymentStatus: "COMPLETED",
    CreationTime: nowSeconds(),
  };
  ctx.store.set(rplnKey(name), rp);
  return {
    ReportPlanName: rp.ReportPlanName,
    ReportPlanArn: rp.ReportPlanArn,
    CreationTime: rp.CreationTime,
  };
};

const DescribeReportPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReportPlanName");
  const rp = requireReportPlan(ctx, name);
  return {
    ReportPlan: {
      ReportPlanArn: rp.ReportPlanArn,
      ReportPlanName: rp.ReportPlanName,
      ReportPlanDescription: rp.ReportPlanDescription,
      ReportSetting: rp.ReportSetting,
      ReportDeliveryChannel: rp.ReportDeliveryChannel,
      DeploymentStatus: rp.DeploymentStatus,
      CreationTime: rp.CreationTime,
    },
  };
};

const ListReportPlans: OperationHandler = (_input, ctx) => {
  const plans = ctx.store
    .list<StoredReportPlan>()
    .filter((e) => e.key.startsWith(rplnPrefix))
    .map((e) => e.value);
  return {
    ReportPlans: plans.map((rp) => ({
      ReportPlanArn: rp.ReportPlanArn,
      ReportPlanName: rp.ReportPlanName,
      ReportPlanDescription: rp.ReportPlanDescription,
      DeploymentStatus: rp.DeploymentStatus,
      CreationTime: rp.CreationTime,
    })),
  };
};

const UpdateReportPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReportPlanName");
  const rp = requireReportPlan(ctx, name);
  ctx.store.set(rplnKey(name), {
    ...rp,
    ReportPlanDescription:
      stringOrUndefined(input["ReportPlanDescription"]) ??
      rp.ReportPlanDescription,
    ReportDeliveryChannel:
      recordOrUndefined(input["ReportDeliveryChannel"]) ??
      rp.ReportDeliveryChannel,
    ReportSetting:
      recordOrUndefined(input["ReportSetting"]) ?? rp.ReportSetting,
  });
  return { ReportPlanName: rp.ReportPlanName, ReportPlanArn: rp.ReportPlanArn };
};

const DeleteReportPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "ReportPlanName");
  requireReportPlan(ctx, name);
  ctx.store.delete(rplnKey(name));
  return {};
};

const StartReportJob: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "ReportPlanName");
  const rp = requireReportPlan(ctx, planName);
  const jobId = crypto.randomUUID();
  const job: StoredReportJob = {
    ReportJobId: jobId,
    ReportPlanArn: rp.ReportPlanArn,
    ReportTemplate: "REPORT_TEMPLATE",
    CreationTime: nowSeconds(),
    CompletionTime: nowSeconds(),
    Status: "COMPLETED",
  };
  ctx.store.set(rtjKey(jobId), job);
  return { ReportJobId: jobId };
};

const DescribeReportJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "ReportJobId");
  const job = requireReportJob(ctx, jobId);
  return {
    ReportJob: {
      ReportJobId: job.ReportJobId,
      ReportPlanArn: job.ReportPlanArn,
      ReportTemplate: job.ReportTemplate,
      CreationTime: job.CreationTime,
      CompletionTime: job.CompletionTime,
      Status: job.Status,
      ReportDestination: { S3BucketName: "backup-reports", S3Keys: [] },
    },
  };
};

const ListReportJobs: OperationHandler = (_input, ctx) => {
  const jobs = ctx.store
    .list<StoredReportJob>()
    .filter((e) => e.key.startsWith(rtjPrefix))
    .map((e) => e.value);
  return {
    ReportJobs: jobs.map((job) => ({
      ReportJobId: job.ReportJobId,
      ReportPlanArn: job.ReportPlanArn,
      ReportTemplate: job.ReportTemplate,
      CreationTime: job.CreationTime,
      CompletionTime: job.CompletionTime,
      Status: job.Status,
    })),
  };
};

const CreateRestoreTestingPlan: OperationHandler = (input, ctx) => {
  const planData = recordOrUndefined(input["RestoreTestingPlan"]);
  if (planData === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "RestoreTestingPlan is required.",
      400,
    );
  }
  const name = requireString(planData, "RestoreTestingPlanName");
  const plan: StoredRestoreTestingPlan = {
    RestoreTestingPlanName: name,
    RestoreTestingPlanArn: rtpArn(ctx, name),
    RecoveryPointSelection:
      recordOrUndefined(planData["RecoveryPointSelection"]) ?? {},
    ScheduleExpression: stringOrUndefined(planData["ScheduleExpression"]),
    ScheduleExpressionTimezone: stringOrUndefined(
      planData["ScheduleExpressionTimezone"],
    ),
    StartWindowHours: numberOrUndefined(planData["StartWindowHours"]),
    CreatorRequestId: stringOrUndefined(input["CreatorRequestId"]),
    CreationTime: nowSeconds(),
  };
  ctx.store.set(rtpKey(name), plan);
  return {
    CreationTime: plan.CreationTime,
    RestoreTestingPlanArn: plan.RestoreTestingPlanArn,
    RestoreTestingPlanName: plan.RestoreTestingPlanName,
  };
};

const GetRestoreTestingPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RestoreTestingPlanName");
  const plan = requireRtp(ctx, name);
  return {
    RestoreTestingPlan: {
      CreationTime: plan.CreationTime,
      CreatorRequestId: plan.CreatorRequestId,
      RecoveryPointSelection: plan.RecoveryPointSelection,
      RestoreTestingPlanArn: plan.RestoreTestingPlanArn,
      RestoreTestingPlanName: plan.RestoreTestingPlanName,
      ScheduleExpression: plan.ScheduleExpression,
      ScheduleExpressionTimezone: plan.ScheduleExpressionTimezone,
      StartWindowHours: plan.StartWindowHours,
    },
  };
};

const ListRestoreTestingPlans: OperationHandler = (_input, ctx) => {
  const plans = ctx.store
    .list<StoredRestoreTestingPlan>()
    .filter((e) => e.key.startsWith(rtpPrefix))
    .map((e) => e.value);
  return {
    RestoreTestingPlans: plans.map((p) => ({
      CreationTime: p.CreationTime,
      RestoreTestingPlanArn: p.RestoreTestingPlanArn,
      RestoreTestingPlanName: p.RestoreTestingPlanName,
      ScheduleExpression: p.ScheduleExpression,
    })),
  };
};

const UpdateRestoreTestingPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RestoreTestingPlanName");
  const plan = requireRtp(ctx, name);
  const planData = recordOrUndefined(input["RestoreTestingPlan"]) ?? {};
  ctx.store.set(rtpKey(name), {
    ...plan,
    ScheduleExpression:
      stringOrUndefined(planData["ScheduleExpression"]) ??
      plan.ScheduleExpression,
    StartWindowHours:
      numberOrUndefined(planData["StartWindowHours"]) ?? plan.StartWindowHours,
    RecoveryPointSelection:
      recordOrUndefined(planData["RecoveryPointSelection"]) ??
      plan.RecoveryPointSelection,
  });
  return {
    CreationTime: plan.CreationTime,
    RestoreTestingPlanArn: plan.RestoreTestingPlanArn,
    RestoreTestingPlanName: plan.RestoreTestingPlanName,
    UpdateTime: nowSeconds(),
  };
};

const DeleteRestoreTestingPlan: OperationHandler = (input, ctx) => {
  const name = requireString(input, "RestoreTestingPlanName");
  requireRtp(ctx, name);
  ctx.store.delete(rtpKey(name));
  return {};
};

const CreateRestoreTestingSelection: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "RestoreTestingPlanName");
  requireRtp(ctx, planName);
  const selData = recordOrUndefined(input["RestoreTestingSelection"]);
  if (selData === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "RestoreTestingSelection is required.",
      400,
    );
  }
  const selName = requireString(selData, "RestoreTestingSelectionName");
  const plan = requireRtp(ctx, planName);
  const sel: StoredRestoreTestingSelection = {
    RestoreTestingPlanName: planName,
    RestoreTestingSelectionName: selName,
    ProtectedResourceType:
      stringOrUndefined(selData["ProtectedResourceType"]) ?? "EC2",
    IamRoleArn: stringOrUndefined(selData["IamRoleArn"]) ?? "",
    ValidationWindowHours: numberOrUndefined(selData["ValidationWindowHours"]),
    ProtectedResourceConditions:
      recordOrUndefined(selData["ProtectedResourceConditions"]) ?? {},
    RestoreMetadataOverrides:
      recordOrUndefined(selData["RestoreMetadataOverrides"]) ?? {},
    ProtectedResourceArns: arrayOrEmpty(selData["ProtectedResourceArns"]),
    CreatorRequestId: stringOrUndefined(input["CreatorRequestId"]),
    CreationTime: nowSeconds(),
  };
  ctx.store.set(rtsKey(planName, selName), sel);
  return {
    CreationTime: sel.CreationTime,
    RestoreTestingPlanArn: plan.RestoreTestingPlanArn,
    RestoreTestingPlanName: planName,
    RestoreTestingSelectionName: selName,
  };
};

const GetRestoreTestingSelection: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "RestoreTestingPlanName");
  const selName = requireString(input, "RestoreTestingSelectionName");
  const sel = requireRts(ctx, planName, selName);
  return {
    RestoreTestingSelection: {
      CreationTime: sel.CreationTime,
      CreatorRequestId: sel.CreatorRequestId,
      IamRoleArn: sel.IamRoleArn,
      ProtectedResourceArns: sel.ProtectedResourceArns,
      ProtectedResourceConditions: sel.ProtectedResourceConditions,
      ProtectedResourceType: sel.ProtectedResourceType,
      RestoreMetadataOverrides: sel.RestoreMetadataOverrides,
      RestoreTestingPlanName: sel.RestoreTestingPlanName,
      RestoreTestingSelectionName: sel.RestoreTestingSelectionName,
      ValidationWindowHours: sel.ValidationWindowHours,
    },
  };
};

const ListRestoreTestingSelections: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "RestoreTestingPlanName");
  requireRtp(ctx, planName);
  const sels = ctx.store
    .list<StoredRestoreTestingSelection>()
    .filter((e) => e.key.startsWith(rtsKeyPrefix(planName)))
    .map((e) => e.value);
  return {
    RestoreTestingSelections: sels.map((s) => ({
      CreationTime: s.CreationTime,
      IamRoleArn: s.IamRoleArn,
      ProtectedResourceType: s.ProtectedResourceType,
      RestoreTestingPlanName: s.RestoreTestingPlanName,
      RestoreTestingSelectionName: s.RestoreTestingSelectionName,
      ValidationWindowHours: s.ValidationWindowHours,
    })),
  };
};

const UpdateRestoreTestingSelection: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "RestoreTestingPlanName");
  const selName = requireString(input, "RestoreTestingSelectionName");
  const sel = requireRts(ctx, planName, selName);
  const selData = recordOrUndefined(input["RestoreTestingSelection"]) ?? {};
  ctx.store.set(rtsKey(planName, selName), {
    ...sel,
    IamRoleArn: stringOrUndefined(selData["IamRoleArn"]) ?? sel.IamRoleArn,
    ValidationWindowHours:
      numberOrUndefined(selData["ValidationWindowHours"]) ??
      sel.ValidationWindowHours,
    ProtectedResourceArns:
      selData["ProtectedResourceArns"] !== undefined
        ? arrayOrEmpty(selData["ProtectedResourceArns"])
        : sel.ProtectedResourceArns,
  });
  return {
    CreationTime: sel.CreationTime,
    RestoreTestingPlanArn: rtpArn(ctx, planName),
    RestoreTestingPlanName: planName,
    RestoreTestingSelectionName: selName,
    UpdateTime: nowSeconds(),
  };
};

const DeleteRestoreTestingSelection: OperationHandler = (input, ctx) => {
  const planName = requireString(input, "RestoreTestingPlanName");
  const selName = requireString(input, "RestoreTestingSelectionName");
  requireRts(ctx, planName, selName);
  ctx.store.delete(rtsKey(planName, selName));
  return {};
};

const GetRestoreTestingInferredMetadata: OperationHandler = (_input, _ctx) => {
  return { InferredMetadata: {} };
};

const CreateTieringConfiguration: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const configName = requireString(input, "TieringConfigurationName");
  const tier: StoredTieringConfiguration = {
    BackupVaultName: vaultName,
    TieringConfigurationName: configName,
    TieringConfigurationArn: tierArn(ctx, configName),
    Tierings: arrayOrEmpty(input["Tierings"]),
    CreationTime: nowSeconds(),
  };
  ctx.store.set(tierKey(configName), tier);
  return {
    TieringConfigurationArn: tier.TieringConfigurationArn,
    TieringConfigurationName: tier.TieringConfigurationName,
    CreationTime: tier.CreationTime,
  };
};

const GetTieringConfiguration: OperationHandler = (input, ctx) => {
  const configName = requireString(input, "TieringConfigurationName");
  const tier = requireTier(ctx, configName);
  return {
    TieringConfiguration: {
      BackupVaultName: tier.BackupVaultName,
      TieringConfigurationName: tier.TieringConfigurationName,
      TieringConfigurationArn: tier.TieringConfigurationArn,
      Tierings: tier.Tierings,
      CreationTime: tier.CreationTime,
    },
  };
};

const ListTieringConfigurations: OperationHandler = (_input, ctx) => {
  const tiers = ctx.store
    .list<StoredTieringConfiguration>()
    .filter((e) => e.key.startsWith(tierPrefix))
    .map((e) => e.value);
  return {
    TieringConfigurations: tiers.map((t) => ({
      BackupVaultName: t.BackupVaultName,
      TieringConfigurationName: t.TieringConfigurationName,
      TieringConfigurationArn: t.TieringConfigurationArn,
      Tierings: t.Tierings,
    })),
  };
};

const UpdateTieringConfiguration: OperationHandler = (input, ctx) => {
  const configName = requireString(input, "TieringConfigurationName");
  const tier = requireTier(ctx, configName);
  ctx.store.set(tierKey(configName), {
    ...tier,
    Tierings:
      input["Tierings"] !== undefined
        ? arrayOrEmpty(input["Tierings"])
        : tier.Tierings,
  });
  return {};
};

const DeleteTieringConfiguration: OperationHandler = (input, ctx) => {
  const configName = requireString(input, "TieringConfigurationName");
  requireTier(ctx, configName);
  ctx.store.delete(tierKey(configName));
  return {};
};

const StartBackupJob: OperationHandler = (input, ctx) => {
  const vaultName = requireString(input, "BackupVaultName");
  const vault = requireVault(ctx, vaultName);
  const resourceArn = stringOrUndefined(input["ResourceArn"]);
  const iamRoleArn = stringOrUndefined(input["IamRoleArn"]);
  const jobId = crypto.randomUUID();
  const rpArn = recvptArnFor(ctx, vaultName, jobId);
  const now = nowSeconds();
  const rp: StoredRecoveryPoint = {
    RecoveryPointArn: rpArn,
    BackupVaultName: vaultName,
    BackupVaultArn: vault.BackupVaultArn,
    ResourceArn: resourceArn,
    ResourceType: stringOrUndefined(input["ResourceType"]) ?? "EC2",
    Status: "CREATING",
    CreationDate: now,
    CompletionDate: undefined,
    BackupSizeInBytes: 1024,
    Lifecycle: recordOrUndefined(input["Lifecycle"]) ?? {},
    EncryptionKeyArn: vault.EncryptionKeyArn,
    IsEncrypted: vault.EncryptionKeyArn !== undefined,
    StorageClass: "WARM",
    IsParent: false,
    IamRoleArn: iamRoleArn,
  };
  ctx.store.set(recvptKey(vaultName, rpArn), rp);
  ctx.store.set(vaultKey(vaultName), {
    ...vault,
    NumberOfRecoveryPoints: vault.NumberOfRecoveryPoints + 1,
  });
  const job: StoredBackupJob = {
    BackupJobId: jobId,
    BackupVaultName: vaultName,
    BackupVaultArn: vault.BackupVaultArn,
    RecoveryPointArn: rpArn,
    ResourceArn: resourceArn,
    ResourceType: stringOrUndefined(input["ResourceType"]) ?? "EC2",
    State: "CREATED",
    PercentDone: "0.0",
    BackupSizeInBytes: 1024,
    IamRoleArn: iamRoleArn,
    CreationDate: now,
    CompletionDate: undefined,
  };
  ctx.store.set(bjKey(jobId), job);
  return {
    BackupJobId: jobId,
    RecoveryPointArn: rpArn,
    CreationDate: now,
    IsParent: false,
  };
};

const DescribeBackupJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "BackupJobId");
  let job = requireBackupJob(ctx, jobId);
  if (job.State === "CREATED" || job.State === "RUNNING") {
    const completedAt = nowSeconds();
    job = {
      ...job,
      State: "COMPLETED",
      PercentDone: "100.0",
      CompletionDate: completedAt,
    };
    ctx.store.set(bjKey(jobId), job);
    const rp = ctx.store.get<StoredRecoveryPoint>(
      recvptKey(job.BackupVaultName, job.RecoveryPointArn),
    );
    if (rp !== undefined && rp.Status === "CREATING") {
      ctx.store.set(recvptKey(job.BackupVaultName, job.RecoveryPointArn), {
        ...rp,
        Status: "COMPLETED",
        CompletionDate: completedAt,
      });
    }
  }
  return {
    ...bjView(job),
    AccountId: ctx.account,
    IsEncrypted: false,
    BytesTransferred: job.BackupSizeInBytes,
    IsParent: false,
  };
};

const ListBackupJobs: OperationHandler = (input, ctx) => {
  const byState = stringOrUndefined(input["ByState"]);
  const byCreatedBefore =
    typeof input["ByCreatedBefore"] === "number"
      ? (input["ByCreatedBefore"] as number)
      : undefined;
  const byCreatedAfter =
    typeof input["ByCreatedAfter"] === "number"
      ? (input["ByCreatedAfter"] as number)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  let jobs = ctx.store
    .list<StoredBackupJob>()
    .filter((e) => e.key.startsWith(bjPrefix))
    .map((e) => e.value);
  if (byState !== undefined) jobs = jobs.filter((j) => j.State === byState);
  if (byCreatedBefore !== undefined)
    jobs = jobs.filter((j) => j.CreationDate < byCreatedBefore);
  if (byCreatedAfter !== undefined)
    jobs = jobs.filter((j) => j.CreationDate > byCreatedAfter);
  const paged = paginate(jobs, maxResults, nextToken);
  return { BackupJobs: paged.items.map(bjView), NextToken: paged.nextToken };
};

const StopBackupJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "BackupJobId");
  const job = requireBackupJob(ctx, jobId);
  ctx.store.set(bjKey(jobId), { ...job, State: "ABORTED" });
  return {};
};

const StartCopyJob: OperationHandler = (input, ctx) => {
  const iamRoleArn = stringOrUndefined(input["IamRoleArn"]);
  if (iamRoleArn === undefined) {
    throw awsError(
      "InvalidParameterValueException",
      "IamRoleArn is required.",
      400,
    );
  }
  const srcArn = requireString(input, "RecoveryPointArn");
  const srcVaultArn = requireString(input, "SourceBackupVaultName");
  const dstVaultArn = requireString(input, "DestinationBackupVaultArn");
  const dstVaultName = vaultNameFromArn(dstVaultArn);
  requireVault(ctx, dstVaultName);
  const jobId = crypto.randomUUID();
  const dstRpArn = recvptArnFor(ctx, dstVaultName, jobId);
  const now = nowSeconds();
  const job: StoredCopyJob = {
    CopyJobId: jobId,
    SourceBackupVaultArn: srcVaultArn,
    SourceRecoveryPointArn: srcArn,
    DestinationBackupVaultArn: dstVaultArn,
    DestinationRecoveryPointArn: dstRpArn,
    ResourceArn: stringOrUndefined(input["ResourceArn"]),
    ResourceType: "EC2",
    State: "CREATED",
    CreationDate: now,
    CompletionDate: undefined,
    BackupSizeInBytes: 1024,
    IamRoleArn: iamRoleArn,
  };
  ctx.store.set(cjKey(jobId), job);
  return { CopyJobId: jobId, CreationDate: now, IsParent: false };
};

const DescribeCopyJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "CopyJobId");
  let job = requireCopyJob(ctx, jobId);
  if (job.State === "CREATED" || job.State === "RUNNING") {
    job = { ...job, State: "COMPLETED", CompletionDate: nowSeconds() };
    ctx.store.set(cjKey(jobId), job);
  }
  return { CopyJob: cjView(job) };
};

const ListCopyJobs: OperationHandler = (input, ctx) => {
  const byState = stringOrUndefined(input["ByState"]);
  const byCreatedBefore =
    typeof input["ByCreatedBefore"] === "number"
      ? (input["ByCreatedBefore"] as number)
      : undefined;
  const byCreatedAfter =
    typeof input["ByCreatedAfter"] === "number"
      ? (input["ByCreatedAfter"] as number)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  let jobs = ctx.store
    .list<StoredCopyJob>()
    .filter((e) => e.key.startsWith(cjPrefix))
    .map((e) => e.value);
  if (byState !== undefined) jobs = jobs.filter((j) => j.State === byState);
  if (byCreatedBefore !== undefined)
    jobs = jobs.filter((j) => j.CreationDate < byCreatedBefore);
  if (byCreatedAfter !== undefined)
    jobs = jobs.filter((j) => j.CreationDate > byCreatedAfter);
  const paged = paginate(jobs, maxResults, nextToken);
  return { CopyJobs: paged.items.map(cjView), NextToken: paged.nextToken };
};

const StartRestoreJob: OperationHandler = (input, ctx) => {
  const rpArn = requireString(input, "RecoveryPointArn");
  const iamRoleArn = stringOrUndefined(input["IamRoleArn"]);
  const jobId = crypto.randomUUID();
  const now = nowSeconds();
  const job: StoredRestoreJob = {
    RestoreJobId: jobId,
    RecoveryPointArn: rpArn,
    CreationDate: now,
    CompletionDate: undefined,
    Status: "PENDING",
    PercentDone: "0.0",
    BackupSizeInBytes: 1024,
    IamRoleArn: iamRoleArn,
    ExpectedCompletionTimeMinutes: 0,
    CreatedResourceArn: `arn:aws:ec2:${ctx.region}:${ctx.account}:instance/i-${jobId.slice(0, 8)}`,
    ResourceType: stringOrUndefined(input["ResourceType"]) ?? "EC2",
  };
  ctx.store.set(rjKey(jobId), job);
  return { RestoreJobId: jobId };
};

const DescribeRestoreJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "RestoreJobId");
  let job = requireRestoreJob(ctx, jobId);
  if (job.Status === "PENDING" || job.Status === "RUNNING") {
    job = {
      ...job,
      Status: "COMPLETED",
      PercentDone: "100.0",
      CompletionDate: nowSeconds(),
    };
    ctx.store.set(rjKey(jobId), job);
  }
  return {
    AccountId: ctx.account,
    RestoreJobId: job.RestoreJobId,
    RecoveryPointArn: job.RecoveryPointArn,
    CreationDate: job.CreationDate,
    CompletionDate: job.CompletionDate,
    Status: job.Status,
    PercentDone: job.PercentDone,
    BackupSizeInBytes: job.BackupSizeInBytes,
    IamRoleArn: job.IamRoleArn,
    ExpectedCompletionTimeMinutes: job.ExpectedCompletionTimeMinutes,
    CreatedResourceArn: job.CreatedResourceArn,
    ResourceType: job.ResourceType,
  };
};

const ListRestoreJobs: OperationHandler = (input, ctx) => {
  const byStatus = stringOrUndefined(input["ByStatus"]);
  const byCreatedBefore =
    typeof input["ByCreatedBefore"] === "number"
      ? (input["ByCreatedBefore"] as number)
      : undefined;
  const byCreatedAfter =
    typeof input["ByCreatedAfter"] === "number"
      ? (input["ByCreatedAfter"] as number)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  let jobs = ctx.store
    .list<StoredRestoreJob>()
    .filter((e) => e.key.startsWith(rjPrefix))
    .map((e) => e.value);
  if (byStatus !== undefined) jobs = jobs.filter((j) => j.Status === byStatus);
  if (byCreatedBefore !== undefined)
    jobs = jobs.filter((j) => j.CreationDate < byCreatedBefore);
  if (byCreatedAfter !== undefined)
    jobs = jobs.filter((j) => j.CreationDate > byCreatedAfter);
  const paged = paginate(jobs, maxResults, nextToken);
  return { RestoreJobs: paged.items.map(rjView), NextToken: paged.nextToken };
};

const GetRestoreJobMetadata: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "RestoreJobId");
  requireRestoreJob(ctx, jobId);
  return { RestoreJobId: jobId, Metadata: {} };
};

const PutRestoreValidationResult: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "RestoreJobId");
  requireRestoreJob(ctx, jobId);
  return {};
};

const ListRestoreJobsByProtectedResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const jobs = ctx.store
    .list<StoredRestoreJob>()
    .filter((e) => e.key.startsWith(rjPrefix))
    .map((e) => e.value)
    .filter((j) => j.RecoveryPointArn?.includes(resourceArn));
  return { RestoreJobs: jobs.map(rjView) };
};

const StartScanJob: OperationHandler = (input, ctx) => {
  const jobId = crypto.randomUUID();
  const now = nowSeconds();
  const job: StoredScanJob = {
    ScanJobId: jobId,
    BackupVaultName: stringOrUndefined(input["BackupVaultName"]),
    RecoveryPointArn: stringOrUndefined(input["RecoveryPointArn"]),
    ResourceArn: stringOrUndefined(input["ResourceArn"]),
    State: "CREATED",
    CreationDate: now,
    CompletionDate: undefined,
  };
  ctx.store.set(sjKey(jobId), job);
  return { CreationDate: now, ScanJobId: jobId };
};

const DescribeScanJob: OperationHandler = (input, ctx) => {
  const jobId = requireString(input, "ScanJobId");
  let job = requireScanJob(ctx, jobId);
  if (job.State === "CREATED" || job.State === "RUNNING") {
    job = { ...job, State: "COMPLETED", CompletionDate: nowSeconds() };
    ctx.store.set(sjKey(jobId), job);
  }
  return {
    ScanJobId: job.ScanJobId,
    BackupVaultName: job.BackupVaultName,
    RecoveryPointArn: job.RecoveryPointArn,
    ResourceArn: job.ResourceArn,
    State: job.State,
    CreationDate: job.CreationDate,
    CompletionDate: job.CompletionDate,
    AccountId: ctx.account,
  };
};

const ListScanJobs: OperationHandler = (input, ctx) => {
  const byState = stringOrUndefined(input["ByState"]);
  const byCreatedBefore =
    typeof input["ByCreatedBefore"] === "number"
      ? (input["ByCreatedBefore"] as number)
      : undefined;
  const byCreatedAfter =
    typeof input["ByCreatedAfter"] === "number"
      ? (input["ByCreatedAfter"] as number)
      : undefined;
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : undefined;
  const nextToken = stringOrUndefined(input["NextToken"]);
  let jobs = ctx.store
    .list<StoredScanJob>()
    .filter((e) => e.key.startsWith(sjPrefix))
    .map((e) => e.value);
  if (byState !== undefined) jobs = jobs.filter((j) => j.State === byState);
  if (byCreatedBefore !== undefined)
    jobs = jobs.filter((j) => j.CreationDate < byCreatedBefore);
  if (byCreatedAfter !== undefined)
    jobs = jobs.filter((j) => j.CreationDate > byCreatedAfter);
  const paged = paginate(jobs, maxResults, nextToken);
  return {
    ScanJobs: paged.items.map((j) => ({
      ScanJobId: j.ScanJobId,
      State: j.State,
      CreationDate: j.CreationDate,
      CompletionDate: j.CompletionDate,
    })),
    NextToken: paged.nextToken,
  };
};

const ListBackupJobSummaries: OperationHandler = (_input, _ctx) => {
  return { BackupJobSummaries: [], AggregationPeriod: "ONE_DAY" };
};

const ListCopyJobSummaries: OperationHandler = (_input, _ctx) => {
  return { CopyJobSummaries: [], AggregationPeriod: "ONE_DAY" };
};

const ListRestoreJobSummaries: OperationHandler = (_input, _ctx) => {
  return { RestoreJobSummaries: [], AggregationPeriod: "ONE_DAY" };
};

const ListScanJobSummaries: OperationHandler = (_input, _ctx) => {
  return { ScanJobSummaries: [] };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = recordOrUndefined(input["Tags"]) ?? {};
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  ctx.store.set(tagKey(arn), {
    ...existing,
    ...(tags as Record<string, string>),
  });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const keysToRemove = arrayOrEmpty(input["TagKeyList"]) as string[];
  const existing = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  for (const k of keysToRemove) {
    delete existing[k];
  }
  ctx.store.set(tagKey(arn), existing);
  return {};
};

const ListTags: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagKey(arn)) ?? {};
  return { Tags: tags };
};

const DescribeProtectedResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const rps = ctx.store
    .list<StoredRecoveryPoint>()
    .filter((e) => e.key.startsWith(recvptPrefix))
    .map((e) => e.value)
    .filter((rp) => rp.ResourceArn === resourceArn);
  if (rps.length === 0) {
    throw awsError(
      "ResourceNotFoundException",
      `Protected resource ${resourceArn} not found.`,
      404,
    );
  }
  const latest = rps.sort((a, b) => b.CreationDate - a.CreationDate)[0]!;
  return {
    ResourceArn: resourceArn,
    ResourceType: latest.ResourceType ?? "EC2",
    LastBackupTime: latest.CreationDate,
  };
};

const ListProtectedResources: OperationHandler = (_input, ctx) => {
  const arns = new Map<string, StoredRecoveryPoint>();
  ctx.store
    .list<StoredRecoveryPoint>()
    .filter((e) => e.key.startsWith(recvptPrefix))
    .map((e) => e.value)
    .forEach((rp) => {
      if (rp.ResourceArn !== undefined && !arns.has(rp.ResourceArn)) {
        arns.set(rp.ResourceArn, rp);
      }
    });
  return {
    Results: Array.from(arns.entries()).map(([arn, rp]) => ({
      ResourceArn: arn,
      ResourceType: rp.ResourceType ?? "EC2",
      LastBackupTime: rp.CreationDate,
    })),
  };
};

const ListRecoveryPointsByResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "ResourceArn");
  const rps = ctx.store
    .list<StoredRecoveryPoint>()
    .filter((e) => e.key.startsWith(recvptPrefix))
    .map((e) => e.value)
    .filter((rp) => rp.ResourceArn === resourceArn);
  return { RecoveryPoints: rps.map(recvptView) };
};

const DescribeGlobalSettings: OperationHandler = (_input, ctx) => {
  const settings = ctx.store.get<StoredGlobalSettings>(gsKey) ?? {
    GlobalSettings: {},
    LastUpdateTime: nowSeconds(),
  };
  return {
    GlobalSettings: settings.GlobalSettings,
    LastUpdateTime: settings.LastUpdateTime,
  };
};

const UpdateGlobalSettings: OperationHandler = (input, ctx) => {
  const existing = ctx.store.get<StoredGlobalSettings>(gsKey) ?? {
    GlobalSettings: {},
    LastUpdateTime: nowSeconds(),
  };
  const newSettings = recordOrUndefined(input["GlobalSettings"]) ?? {};
  ctx.store.set(gsKey, {
    GlobalSettings: {
      ...existing.GlobalSettings,
      ...(newSettings as Record<string, string>),
    },
    LastUpdateTime: nowSeconds(),
  });
  return {};
};

const DescribeRegionSettings: OperationHandler = (_input, ctx) => {
  const settings = ctx.store.get<StoredRegionSettings>(rsKey) ?? {
    ResourceTypeOptInPreference: {},
    ResourceTypeManagementPreference: {},
  };
  return {
    ResourceTypeOptInPreference: settings.ResourceTypeOptInPreference,
    ResourceTypeManagementPreference: settings.ResourceTypeManagementPreference,
  };
};

const UpdateRegionSettings: OperationHandler = (input, ctx) => {
  const existing = ctx.store.get<StoredRegionSettings>(rsKey) ?? {
    ResourceTypeOptInPreference: {},
    ResourceTypeManagementPreference: {},
  };
  const optIn = recordOrUndefined(input["ResourceTypeOptInPreference"]) ?? {};
  const mgmt =
    recordOrUndefined(input["ResourceTypeManagementPreference"]) ?? {};
  ctx.store.set(rsKey, {
    ResourceTypeOptInPreference: {
      ...existing.ResourceTypeOptInPreference,
      ...(optIn as Record<string, boolean>),
    },
    ResourceTypeManagementPreference: {
      ...existing.ResourceTypeManagementPreference,
      ...(mgmt as Record<string, boolean>),
    },
  });
  return {};
};

const GetSupportedResourceTypes: OperationHandler = (_input, _ctx) => {
  return {
    ResourceTypes: [
      "Aurora",
      "CloudFormation",
      "DocumentDB",
      "DynamoDB",
      "EBS",
      "EC2",
      "EFS",
      "FSX",
      "Neptune",
      "RDS",
      "Redshift",
      "S3",
      "SAP HANA on Amazon EC2",
      "Storage Gateway",
      "Timestream",
      "VirtualMachine",
    ],
  };
};

const ListIndexedRecoveryPoints: OperationHandler = (_input, _ctx) => {
  return { IndexedRecoveryPoints: [] };
};

const GetPITRMalwareScanResults: OperationHandler = (_input, _ctx) => {
  return {
    PITRMalwareScanResults: [],
  };
};

const CreateLogicallyAirGappedBackupVault: OperationHandler = (input, ctx) => {
  const name = requireString(input, "BackupVaultName");
  const vault: StoredVault = {
    BackupVaultName: name,
    BackupVaultArn: vaultArn(ctx, name),
    EncryptionKeyArn: undefined,
    CreatorRequestId: undefined,
    CreationDate: nowSeconds(),
    NumberOfRecoveryPoints: 0,
    Locked: false,
    VaultType: "LOGICALLY_AIR_GAPPED_BACKUP_VAULT",
    VaultState: "AVAILABLE",
  };
  ctx.store.set(lagvKey(name), vault);
  return {
    BackupVaultName: vault.BackupVaultName,
    BackupVaultArn: vault.BackupVaultArn,
    CreationDate: vault.CreationDate,
    VaultState: vault.VaultState,
  };
};

const CreateRestoreAccessBackupVault: OperationHandler = (input, ctx) => {
  const lagVaultArn = requireString(input, "LogicallyAirGappedBackupVaultArn");
  const name = `restore-access-${crypto.randomUUID().slice(0, 8)}`;
  const arn = vaultArn(ctx, name);
  const vault: StoredVault = {
    BackupVaultName: name,
    BackupVaultArn: arn,
    EncryptionKeyArn: undefined,
    CreatorRequestId: undefined,
    CreationDate: nowSeconds(),
    NumberOfRecoveryPoints: 0,
    Locked: false,
    VaultType: "RESTORE_ACCESS_BACKUP_VAULT",
    VaultState: "AVAILABLE",
  };
  ctx.store.set(ravKey(lagVaultArn, arn), vault);
  return {
    BackupVaultName: vault.BackupVaultName,
    BackupVaultArn: vault.BackupVaultArn,
    CreationDate: vault.CreationDate,
    VaultState: vault.VaultState,
  };
};

const ListRestoreAccessBackupVaults: OperationHandler = (input, ctx) => {
  const lagName = requireString(input, "BackupVaultName");
  const lagArn = vaultArn(ctx, lagName);
  const vaults = ctx.store
    .list<StoredVault>()
    .filter((e) => e.key.startsWith(ravKeyPrefix(lagArn)))
    .map((e) => e.value);
  return { RestoreAccessBackupVaults: vaults.map(vaultView) };
};

const RevokeRestoreAccessBackupVault: OperationHandler = (input, ctx) => {
  const lagName = requireString(input, "BackupVaultName");
  const ravArn = requireString(input, "RestoreAccessBackupVaultArn");
  const lagArn = vaultArn(ctx, lagName);
  ctx.store.delete(ravKey(lagArn, ravArn));
  return {};
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const routeBackupVaults = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  const len = parts.length;
  if (len === 1) {
    if (req.method === "GET") return "ListBackupVaults";
    return undefined;
  }
  if (len === 2) {
    if (req.method === "PUT") return "CreateBackupVault";
    if (req.method === "GET") return "DescribeBackupVault";
    if (req.method === "DELETE") return "DeleteBackupVault";
    return undefined;
  }
  if (len === 3) {
    const sub = parts[2];
    if (sub === "access-policy") {
      if (req.method === "PUT") return "PutBackupVaultAccessPolicy";
      if (req.method === "GET") return "GetBackupVaultAccessPolicy";
      if (req.method === "DELETE") return "DeleteBackupVaultAccessPolicy";
    }
    if (sub === "notification-configuration") {
      if (req.method === "PUT") return "PutBackupVaultNotifications";
      if (req.method === "GET") return "GetBackupVaultNotifications";
      if (req.method === "DELETE") return "DeleteBackupVaultNotifications";
    }
    if (sub === "vault-lock") {
      if (req.method === "PUT") return "PutBackupVaultLockConfiguration";
      if (req.method === "DELETE") return "DeleteBackupVaultLockConfiguration";
    }
    if (sub === "mpaApprovalTeam") {
      if (req.method === "PUT") return "AssociateBackupVaultMpaApprovalTeam";
      if (req.method === "POST")
        return "DisassociateBackupVaultMpaApprovalTeam";
    }
    if (sub === "recovery-points") {
      if (req.method === "GET") return "ListRecoveryPointsByBackupVault";
    }
    if (sub === "resources") {
      if (req.method === "GET") return "ListProtectedResourcesByBackupVault";
    }
    return undefined;
  }
  if (len === 4 && parts[2] === "recovery-points") {
    if (req.method === "GET") return "DescribeRecoveryPoint";
    if (req.method === "DELETE") return "DeleteRecoveryPoint";
    if (req.method === "POST") return "UpdateRecoveryPointLifecycle";
    return undefined;
  }
  if (len === 5 && parts[2] === "recovery-points") {
    const sub = parts[4];
    if (sub === "restore-metadata" && req.method === "GET")
      return "GetRecoveryPointRestoreMetadata";
    if (sub === "index") {
      if (req.method === "GET") return "GetRecoveryPointIndexDetails";
      if (req.method === "POST") return "UpdateRecoveryPointIndexSettings";
    }
    if (sub === "disassociate" && req.method === "POST")
      return "DisassociateRecoveryPoint";
    if (sub === "parentAssociation" && req.method === "DELETE")
      return "DisassociateRecoveryPointFromParent";
    return undefined;
  }
  return undefined;
};

const routeBackup = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts[1] === "template") {
    if (parts[2] === "json" && parts[3] === "toPlan") {
      if (req.method === "POST") return "GetBackupPlanFromJSON";
    }
    if (parts[2] === "plans") {
      if (parts.length === 3 && req.method === "GET")
        return "ListBackupPlanTemplates";
      if (parts.length === 5 && parts[4] === "toPlan" && req.method === "GET")
        return "GetBackupPlanFromTemplate";
    }
    return undefined;
  }
  if (parts[1] === "plans") {
    const len = parts.length;
    if (len === 2) {
      if (req.method === "PUT") return "CreateBackupPlan";
      if (req.method === "GET") return "ListBackupPlans";
      return undefined;
    }
    if (len === 3) {
      if (req.method === "GET") return "GetBackupPlan";
      if (req.method === "DELETE") return "DeleteBackupPlan";
      if (req.method === "POST") return "UpdateBackupPlan";
      return undefined;
    }
    if (len === 4) {
      const sub = parts[3];
      if (sub === "toTemplate" && req.method === "GET")
        return "ExportBackupPlanTemplate";
      if (sub === "versions" && req.method === "GET")
        return "ListBackupPlanVersions";
      if (sub === "selections") {
        if (req.method === "PUT") return "CreateBackupSelection";
        if (req.method === "GET") return "ListBackupSelections";
      }
      return undefined;
    }
    if (len === 5 && parts[3] === "selections") {
      if (req.method === "GET") return "GetBackupSelection";
      if (req.method === "DELETE") return "DeleteBackupSelection";
      return undefined;
    }
    return undefined;
  }
  return undefined;
};

const routeAudit = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  const sub = parts[1];
  if (sub === "frameworks") {
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateFramework";
      if (req.method === "GET") return "ListFrameworks";
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "DescribeFramework";
      if (req.method === "PUT") return "UpdateFramework";
      if (req.method === "DELETE") return "DeleteFramework";
    }
    return undefined;
  }
  if (sub === "report-plans") {
    if (parts.length === 2) {
      if (req.method === "POST") return "CreateReportPlan";
      if (req.method === "GET") return "ListReportPlans";
    }
    if (parts.length === 3) {
      if (req.method === "GET") return "DescribeReportPlan";
      if (req.method === "PUT") return "UpdateReportPlan";
      if (req.method === "DELETE") return "DeleteReportPlan";
    }
    return undefined;
  }
  if (sub === "report-jobs") {
    if (parts.length === 2 && req.method === "GET") return "ListReportJobs";
    if (parts.length === 3) {
      if (req.method === "GET") return "DescribeReportJob";
      if (req.method === "POST") return "StartReportJob";
    }
    return undefined;
  }
  if (sub === "backup-job-summaries" && req.method === "GET")
    return "ListBackupJobSummaries";
  if (sub === "copy-job-summaries" && req.method === "GET")
    return "ListCopyJobSummaries";
  if (sub === "restore-job-summaries" && req.method === "GET")
    return "ListRestoreJobSummaries";
  if (sub === "scan-job-summaries" && req.method === "GET")
    return "ListScanJobSummaries";
  return undefined;
};

const routeLegalHolds = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (req.method === "POST") return "CreateLegalHold";
    if (req.method === "GET") return "ListLegalHolds";
    return undefined;
  }
  if (parts.length === 2) {
    if (req.method === "GET") return "GetLegalHold";
    if (req.method === "DELETE") return "CancelLegalHold";
    return undefined;
  }
  if (parts.length === 3 && parts[2] === "recovery-points") {
    if (req.method === "GET") return "ListRecoveryPointsByLegalHold";
  }
  return undefined;
};

const routeRestoreTesting = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts[1] === "inferred-metadata" && req.method === "GET")
    return "GetRestoreTestingInferredMetadata";
  if (parts[1] === "plans") {
    const len = parts.length;
    if (len === 2) {
      if (req.method === "PUT") return "CreateRestoreTestingPlan";
      if (req.method === "GET") return "ListRestoreTestingPlans";
      return undefined;
    }
    if (len === 3) {
      if (req.method === "GET") return "GetRestoreTestingPlan";
      if (req.method === "PUT") return "UpdateRestoreTestingPlan";
      if (req.method === "DELETE") return "DeleteRestoreTestingPlan";
      return undefined;
    }
    if (len === 4 && parts[3] === "selections") {
      if (req.method === "PUT") return "CreateRestoreTestingSelection";
      if (req.method === "GET") return "ListRestoreTestingSelections";
      return undefined;
    }
    if (len === 5 && parts[3] === "selections") {
      if (req.method === "GET") return "GetRestoreTestingSelection";
      if (req.method === "PUT") return "UpdateRestoreTestingSelection";
      if (req.method === "DELETE") return "DeleteRestoreTestingSelection";
      return undefined;
    }
    return undefined;
  }
  return undefined;
};

const routeTiering = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (req.method === "PUT") return "CreateTieringConfiguration";
    if (req.method === "GET") return "ListTieringConfigurations";
    return undefined;
  }
  if (parts.length === 2) {
    if (req.method === "GET") return "GetTieringConfiguration";
    if (req.method === "PUT") return "UpdateTieringConfiguration";
    if (req.method === "DELETE") return "DeleteTieringConfiguration";
    return undefined;
  }
  return undefined;
};

const routeBackupJobs = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (req.method === "PUT") return "StartBackupJob";
    if (req.method === "GET") return "ListBackupJobs";
    return undefined;
  }
  if (parts.length === 2) {
    if (req.method === "GET") return "DescribeBackupJob";
    if (req.method === "POST") return "StopBackupJob";
    return undefined;
  }
  return undefined;
};

const routeCopyJobs = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (req.method === "PUT") return "StartCopyJob";
    if (req.method === "GET") return "ListCopyJobs";
    return undefined;
  }
  if (parts.length === 2) {
    if (req.method === "GET") return "DescribeCopyJob";
    return undefined;
  }
  return undefined;
};

const routeRestoreJobs = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (req.method === "PUT") return "StartRestoreJob";
    if (req.method === "GET") return "ListRestoreJobs";
    return undefined;
  }
  if (parts.length === 2) {
    if (req.method === "GET") return "DescribeRestoreJob";
    return undefined;
  }
  if (parts.length === 3) {
    if (parts[2] === "metadata" && req.method === "GET")
      return "GetRestoreJobMetadata";
    if (parts[2] === "validations" && req.method === "PUT")
      return "PutRestoreValidationResult";
    return undefined;
  }
  return undefined;
};

const routeScan = (req: ParsedRequest, parts: string[]): string | undefined => {
  if (parts[1] === "job" && req.method === "PUT") return "StartScanJob";
  if (parts[1] === "jobs") {
    if (parts.length === 2 && req.method === "GET") return "ListScanJobs";
    if (parts.length === 3 && req.method === "GET") return "DescribeScanJob";
    return undefined;
  }
  if (parts[1] === "pitr-malware-scan-results" && req.method === "GET")
    return "GetPITRMalwareScanResults";
  return undefined;
};

const routeResources = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 1) {
    if (req.method === "GET") return "ListProtectedResources";
    return undefined;
  }
  const last = parts[parts.length - 1];
  if (last === "recovery-points" && req.method === "GET")
    return "ListRecoveryPointsByResource";
  if (last === "restore-jobs" && req.method === "GET")
    return "ListRestoreJobsByProtectedResource";
  if (req.method === "GET") return "DescribeProtectedResource";
  return undefined;
};

const routeLagVaults = (
  req: ParsedRequest,
  parts: string[],
): string | undefined => {
  if (parts.length === 2 && req.method === "PUT")
    return "CreateLogicallyAirGappedBackupVault";
  if (parts.length === 3 && parts[2] === "restore-access-backup-vaults") {
    if (req.method === "GET") return "ListRestoreAccessBackupVaults";
    return undefined;
  }
  if (parts.length === 4 && parts[2] === "restore-access-backup-vaults") {
    if (req.method === "DELETE") return "RevokeRestoreAccessBackupVault";
    return undefined;
  }
  return undefined;
};

const backup = {
  name: "backup",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts.length === 0) return undefined;
    switch (parts[0]) {
      case "backup-vaults":
        return routeBackupVaults(req, parts);
      case "backup":
        return routeBackup(req, parts);
      case "audit":
        return routeAudit(req, parts);
      case "legal-holds":
        return routeLegalHolds(req, parts);
      case "restore-testing":
        return routeRestoreTesting(req, parts);
      case "tiering-configurations":
        return routeTiering(req, parts);
      case "backup-jobs":
        return routeBackupJobs(req, parts);
      case "copy-jobs":
        return routeCopyJobs(req, parts);
      case "restore-jobs":
        return routeRestoreJobs(req, parts);
      case "scan":
        return routeScan(req, parts);
      case "resources":
        return routeResources(req, parts);
      case "tags":
        if (req.method === "GET") return "ListTags";
        if (req.method === "POST") return "TagResource";
        return undefined;
      case "untag":
        if (req.method === "POST") return "UntagResource";
        return undefined;
      case "global-settings":
        if (req.method === "GET") return "DescribeGlobalSettings";
        if (req.method === "PUT") return "UpdateGlobalSettings";
        return undefined;
      case "account-settings":
        if (req.method === "GET") return "DescribeRegionSettings";
        if (req.method === "PUT") return "UpdateRegionSettings";
        return undefined;
      case "supported-resource-types":
        if (req.method === "GET") return "GetSupportedResourceTypes";
        return undefined;
      case "indexes":
        if (req.method === "GET") return "ListIndexedRecoveryPoints";
        return undefined;
      case "logically-air-gapped-backup-vaults":
        return routeLagVaults(req, parts);
      case "restore-access-backup-vaults":
        if (req.method === "PUT") return "CreateRestoreAccessBackupVault";
        return undefined;
      default:
        return undefined;
    }
  },
  operations: {
    AssociateBackupVaultMpaApprovalTeam,
    CancelLegalHold,
    CreateBackupPlan,
    CreateBackupSelection,
    CreateBackupVault,
    CreateFramework,
    CreateLegalHold,
    CreateLogicallyAirGappedBackupVault,
    CreateReportPlan,
    CreateRestoreAccessBackupVault,
    CreateRestoreTestingPlan,
    CreateRestoreTestingSelection,
    CreateTieringConfiguration,
    DeleteBackupPlan,
    DeleteBackupSelection,
    DeleteBackupVault,
    DeleteBackupVaultAccessPolicy,
    DeleteBackupVaultLockConfiguration,
    DeleteBackupVaultNotifications,
    DeleteFramework,
    DeleteRecoveryPoint,
    DeleteReportPlan,
    DeleteRestoreTestingPlan,
    DeleteRestoreTestingSelection,
    DeleteTieringConfiguration,
    DescribeBackupJob,
    DescribeBackupVault,
    DescribeCopyJob,
    DescribeFramework,
    DescribeGlobalSettings,
    DescribeProtectedResource,
    DescribeRecoveryPoint,
    DescribeRegionSettings,
    DescribeReportJob,
    DescribeReportPlan,
    DescribeRestoreJob,
    DescribeScanJob,
    DisassociateBackupVaultMpaApprovalTeam,
    DisassociateRecoveryPoint,
    DisassociateRecoveryPointFromParent,
    ExportBackupPlanTemplate,
    GetBackupPlan,
    GetBackupPlanFromJSON,
    GetBackupPlanFromTemplate,
    GetBackupSelection,
    GetBackupVaultAccessPolicy,
    GetBackupVaultNotifications,
    GetLegalHold,
    GetPITRMalwareScanResults,
    GetRecoveryPointIndexDetails,
    GetRecoveryPointRestoreMetadata,
    GetRestoreJobMetadata,
    GetRestoreTestingInferredMetadata,
    GetRestoreTestingPlan,
    GetRestoreTestingSelection,
    GetSupportedResourceTypes,
    GetTieringConfiguration,
    ListBackupJobSummaries,
    ListBackupJobs,
    ListBackupPlanTemplates,
    ListBackupPlanVersions,
    ListBackupPlans,
    ListBackupSelections,
    ListBackupVaults,
    ListCopyJobSummaries,
    ListCopyJobs,
    ListFrameworks,
    ListIndexedRecoveryPoints,
    ListLegalHolds,
    ListProtectedResources,
    ListProtectedResourcesByBackupVault,
    ListRecoveryPointsByBackupVault,
    ListRecoveryPointsByLegalHold,
    ListRecoveryPointsByResource,
    ListReportJobs,
    ListReportPlans,
    ListRestoreAccessBackupVaults,
    ListRestoreJobSummaries,
    ListRestoreJobs,
    ListRestoreJobsByProtectedResource,
    ListRestoreTestingPlans,
    ListRestoreTestingSelections,
    ListScanJobSummaries,
    ListScanJobs,
    ListTags,
    ListTieringConfigurations,
    PutBackupVaultAccessPolicy,
    PutBackupVaultLockConfiguration,
    PutBackupVaultNotifications,
    PutRestoreValidationResult,
    RevokeRestoreAccessBackupVault,
    StartBackupJob,
    StartCopyJob,
    StartReportJob,
    StartRestoreJob,
    StartScanJob,
    StopBackupJob,
    TagResource,
    UntagResource,
    UpdateBackupPlan,
    UpdateFramework,
    UpdateGlobalSettings,
    UpdateRecoveryPointIndexSettings,
    UpdateRecoveryPointLifecycle,
    UpdateRegionSettings,
    UpdateReportPlan,
    UpdateRestoreTestingPlan,
    UpdateRestoreTestingSelection,
    UpdateTieringConfiguration,
  },
  model,
} as const satisfies ServiceDefinition;

export default backup;
