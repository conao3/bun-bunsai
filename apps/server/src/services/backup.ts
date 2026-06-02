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

const vaultKey = (name: string): string => `${vaultPrefix}${name}`;

const planKey = (id: string): string => `${planPrefix}${id}`;

const vaultArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:backup-vault:${name}`;

const planArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:backup:${ctx.region}:${ctx.account}:backup-plan:${id}`;

const nowSeconds = (): number => Date.now() / 1000;

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
  return {
    BackupPlanId: stored.BackupPlanId,
    BackupPlanArn: stored.BackupPlanArn,
    CreationDate: stored.CreationDate,
    VersionId: stored.VersionId,
    AdvancedBackupSettings: stored.AdvancedBackupSettings,
  };
};

const ruleView = (rule: unknown): unknown => {
  const record = recordOrUndefined(rule);
  if (record === undefined) return rule;
  const ruleId = stringOrUndefined(record["RuleId"]);
  if (ruleId !== undefined) return record;
  return { ...record, RuleId: crypto.randomUUID() };
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

const planListMember = (plan: StoredPlan): Record<string, unknown> => ({
  BackupPlanArn: plan.BackupPlanArn,
  BackupPlanId: plan.BackupPlanId,
  CreationDate: plan.CreationDate,
  VersionId: plan.VersionId,
  BackupPlanName: plan.BackupPlanName,
  CreatorRequestId: plan.CreatorRequestId,
  AdvancedBackupSettings: plan.AdvancedBackupSettings,
});

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

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const backup = {
  name: "backup",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "backup-vaults") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListBackupVaults";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "CreateBackupVault";
        if (req.method === "GET") return "DescribeBackupVault";
        if (req.method === "DELETE") return "DeleteBackupVault";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "backup" && parts[1] === "plans") {
      if (parts.length === 2) {
        if (req.method === "PUT") return "CreateBackupPlan";
        if (req.method === "GET") return "ListBackupPlans";
        return undefined;
      }
      if (parts.length === 3) {
        if (req.method === "GET") return "GetBackupPlan";
        if (req.method === "DELETE") return "DeleteBackupPlan";
        return undefined;
      }
      return undefined;
    }
    return undefined;
  },
  operations: {
    CreateBackupVault,
    DescribeBackupVault,
    ListBackupVaults,
    DeleteBackupVault,
    CreateBackupPlan,
    GetBackupPlan,
    ListBackupPlans,
    DeleteBackupPlan,
  },
  model,
} as const satisfies ServiceDefinition;

export default backup;
