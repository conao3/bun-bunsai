import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssoAdminModel from "../../models/sso-admin.json" with { type: "json" };
import type { ServiceDefinition } from "../core/types.ts";

const model = loadServiceModel(ssoAdminModel);

const instanceArn = "arn:aws:sso:::instance/ssoins-bunsai0000000001" as const;
const identityStoreId = "d-bunsai0001" as const;
const instanceCreatedDate = "2024-01-01T00:00:00Z" as const;

const psKey = (arn: string): string => `ps:${arn}`;
const assignKey = (
  accountId: string,
  psArn: string,
  principalType: string,
  principalId: string,
): string => `assign:${accountId}:${psArn}:${principalType}:${principalId}`;
const managedKey = (psArn: string): string => `managed:${psArn}`;
const custManagedKey = (psArn: string): string => `custmanaged:${psArn}`;
const inlineKey = (psArn: string): string => `inline:${psArn}`;
const boundaryKey = (psArn: string): string => `boundary:${psArn}`;
const tagsKey = (resourceArn: string): string => `tags:${resourceArn}`;
const statusKey = (requestId: string): string => `status:${requestId}`;
const appKey = (arn: string): string => `app:${arn}`;
const appAssignKey = (
  appArn: string,
  principalType: string,
  principalId: string,
): string => `appassign:${appArn}:${principalType}:${principalId}`;
const appAssignConfigKey = (appArn: string): string =>
  `appassignconfig:${appArn}`;
const appScopeKey = (appArn: string, scope: string): string =>
  `appscope:${appArn}:${scope}`;
const appAuthKey = (appArn: string, methodType: string): string =>
  `appauth:${appArn}:${methodType}`;
const appGrantKey = (appArn: string, grantType: string): string =>
  `appgrant:${appArn}:${grantType}`;
const appSessionKey = (appArn: string): string => `appsession:${appArn}`;
const ttiKey = (arn: string): string => `tti:${arn}`;
const instKey = (arn: string): string => `inst:${arn}`;
const abacKey = (arn: string): string => `abac:${arn}`;

type StoredPermissionSet = {
  PermissionSetArn: string;
  Name: string;
  Description?: string;
  SessionDuration?: string;
  RelayState?: string;
  CreatedDate: string;
};

type StoredAssignment = {
  AccountId: string;
  PermissionSetArn: string;
  PrincipalType: string;
  PrincipalId: string;
};

type StoredManagedPolicy = {
  Arn: string;
  Name: string;
};

type StoredCustomerManagedPolicy = {
  Name: string;
  Path?: string;
};

type StoredPermissionsBoundary = {
  ManagedPolicyArn?: string;
  CustomerManagedPolicyReference?: { Name: string; Path?: string };
};

type StoredOperationStatus = {
  RequestId: string;
  Status: string;
  TargetId?: string;
  TargetType?: string;
  PermissionSetArn?: string;
  PrincipalType?: string;
  PrincipalId?: string;
  CreatedDate: string;
  FailureReason?: string;
};

type StoredApplication = {
  ApplicationArn: string;
  Name: string;
  ApplicationProviderArn: string;
  InstanceArn: string;
  ApplicationAccount: string;
  Status: string;
  PortalOptions?: unknown;
  Description?: string;
  CreatedDate: string;
};

type StoredAppAssignment = {
  ApplicationArn: string;
  PrincipalType: string;
  PrincipalId: string;
};

type StoredTrustedTokenIssuer = {
  TrustedTokenIssuerArn: string;
  Name: string;
  TrustedTokenIssuerType: string;
  TrustedTokenIssuerConfiguration?: unknown;
  InstanceArn: string;
};

type StoredInstance = {
  InstanceArn: string;
  IdentityStoreId: string;
  OwnerAccountId: string;
  Name: string;
  Status: string;
  CreatedDate: string;
};

type StoredABACConfig = {
  AccessControlAttributes: unknown[];
};

const nowIso = (): string => new Date().toISOString();

const permissionSetArn = (name: string): string =>
  `arn:aws:sso:::permissionSet/ssoins-bunsai0000000001/ps-${name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16)
    .padEnd(16, "0")}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

const applicationArn = (): string =>
  `arn:aws:sso::000000000000:application/ssoins-bunsai0000000001/apl-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

const ttiArn = (): string =>
  `arn:aws:sso::000000000000:trustedTokenIssuer/ssoins-bunsai0000000001/tti-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

const requirePermissionSet = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  arn: string,
): StoredPermissionSet => {
  const ps = ctx.store.get<StoredPermissionSet>(psKey(arn));
  if (!ps) {
    throw awsError(
      "ResourceNotFoundException",
      `PermissionSet ${arn} not found`,
      400,
    );
  }
  return ps;
};

const requireApplication = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  arn: string,
): StoredApplication => {
  const app = ctx.store.get<StoredApplication>(appKey(arn));
  if (!app) {
    throw awsError(
      "ResourceNotFoundException",
      `Application ${arn} not found`,
      400,
    );
  }
  return app;
};

const requireTrustedTokenIssuer = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  arn: string,
): StoredTrustedTokenIssuer => {
  const tti = ctx.store.get<StoredTrustedTokenIssuer>(ttiKey(arn));
  if (!tti) {
    throw awsError(
      "ResourceNotFoundException",
      `TrustedTokenIssuer ${arn} not found`,
      400,
    );
  }
  return tti;
};

const resolveTaggableResource = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  arn: string,
): void => {
  const exists =
    ctx.store.get(psKey(arn)) !== undefined ||
    ctx.store.get(appKey(arn)) !== undefined ||
    ctx.store.get(ttiKey(arn)) !== undefined ||
    ctx.store.get(instKey(arn)) !== undefined ||
    arn === instanceArn;
  if (!exists) {
    throw awsError(
      "ResourceNotFoundException",
      `Resource ${arn} not found`,
      400,
    );
  }
};

const encodeToken = (offset: number): string =>
  Buffer.from(String(offset)).toString("base64");

const decodeToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const n = Number.parseInt(Buffer.from(token, "base64").toString(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const paginate = <T>(
  items: T[],
  maxResults: number | undefined,
  nextToken: unknown,
): { page: T[]; nextToken: string | undefined } => {
  const max =
    typeof maxResults === "number" && maxResults > 0 ? maxResults : 20;
  const offset = decodeToken(nextToken);
  const page = items.slice(offset, offset + max);
  const next =
    offset + max < items.length ? encodeToken(offset + max) : undefined;
  return { page, nextToken: next };
};

const defaultInstanceRecord = (): StoredInstance => ({
  InstanceArn: instanceArn,
  IdentityStoreId: identityStoreId,
  OwnerAccountId: "000000000000",
  Name: "bunsai-sso",
  Status: "ACTIVE",
  CreatedDate: instanceCreatedDate,
});

const getInstanceRecord = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  arn: string,
): StoredInstance | undefined => {
  const stored = ctx.store.get<StoredInstance>(instKey(arn));
  if (stored) return stored;
  if (arn === instanceArn) return defaultInstanceRecord();
  return undefined;
};

const ssoAdmin: ServiceDefinition = {
  name: "sso",
  protocol: "json",
  model,
  operations: {
    ListInstances: (_input, ctx) => {
      const stored = ctx.store
        .list<StoredInstance>()
        .filter((e) => e.key.startsWith("inst:"))
        .map((e) => e.value);
      const instances =
        stored.length === 0 ? [defaultInstanceRecord()] : stored;
      return { Instances: instances, NextToken: undefined };
    },

    DescribeInstance: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      const inst = getInstanceRecord(ctx, arn);
      if (!inst) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${arn} not found`,
          400,
        );
      }
      return inst;
    },

    CreateInstance: (input, ctx) => {
      const existing = ctx.store.get<StoredInstance>(instKey(instanceArn));
      if (!existing) {
        const inst: StoredInstance = {
          InstanceArn: instanceArn,
          IdentityStoreId: identityStoreId,
          OwnerAccountId: "000000000000",
          Name: (input["Name"] as string | undefined) ?? "bunsai-sso",
          Status: "ACTIVE",
          CreatedDate: nowIso(),
        };
        ctx.store.set(instKey(instanceArn), inst);
        const tags = input["Tags"] as
          | Array<{ Key: string; Value: string }>
          | undefined;
        if (tags && tags.length > 0) {
          const existingTags =
            ctx.store.get<Record<string, string>>(tagsKey(instanceArn)) ?? {};
          for (const t of tags) existingTags[t.Key] = t.Value;
          ctx.store.set(tagsKey(instanceArn), existingTags);
        }
      }
      return { InstanceArn: instanceArn };
    },

    DeleteInstance: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      ctx.store.delete(instKey(arn));
      ctx.store.delete(tagsKey(arn));
      ctx.store.delete(abacKey(arn));
      return {};
    },

    UpdateInstance: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      const existing =
        ctx.store.get<StoredInstance>(instKey(arn)) ??
        (arn === instanceArn ? defaultInstanceRecord() : undefined);
      if (!existing) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${arn} not found`,
          400,
        );
      }
      if (input["Name"] !== undefined) existing.Name = input["Name"] as string;
      ctx.store.set(instKey(arn), existing);
      return {};
    },

    DescribeInstanceAccessControlAttributeConfiguration: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      const config = ctx.store.get<StoredABACConfig>(abacKey(arn));
      if (!config) {
        throw awsError(
          "ResourceNotFoundException",
          `ABAC configuration for instance ${arn} not found`,
          400,
        );
      }
      return {
        Status: "ENABLED",
        InstanceAccessControlAttributeConfiguration: config,
      };
    },

    CreateInstanceAccessControlAttributeConfiguration: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      const config = input[
        "InstanceAccessControlAttributeConfiguration"
      ] as StoredABACConfig;
      ctx.store.set(abacKey(arn), config);
      return {};
    },

    DeleteInstanceAccessControlAttributeConfiguration: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      ctx.store.delete(abacKey(arn));
      return {};
    },

    UpdateInstanceAccessControlAttributeConfiguration: (input, ctx) => {
      const arn = input["InstanceArn"] as string;
      const existing = ctx.store.get<StoredABACConfig>(abacKey(arn));
      if (!existing) {
        throw awsError(
          "ResourceNotFoundException",
          `ABAC configuration for instance ${arn} not found`,
          400,
        );
      }
      const config = input[
        "InstanceAccessControlAttributeConfiguration"
      ] as StoredABACConfig;
      ctx.store.set(abacKey(arn), config);
      return {};
    },

    CreatePermissionSet: (input, ctx) => {
      const name = input["Name"] as string;
      const instanceArnIn = input["InstanceArn"] as string;
      if (instanceArnIn !== instanceArn) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${instanceArnIn} not found`,
          400,
        );
      }
      const allPs = ctx.store
        .list<StoredPermissionSet>()
        .filter((e) => e.key.startsWith("ps:"));
      const existing = allPs.find((e) => e.value.Name === name);
      if (existing) {
        throw awsError(
          "ConflictException",
          `PermissionSet ${name} already exists`,
          400,
        );
      }
      const arn = permissionSetArn(name);
      const ps: StoredPermissionSet = {
        PermissionSetArn: arn,
        Name: name,
        Description: input["Description"] as string | undefined,
        SessionDuration: input["SessionDuration"] as string | undefined,
        RelayState: input["RelayState"] as string | undefined,
        CreatedDate: nowIso(),
      };
      ctx.store.set(psKey(arn), ps);
      const tags = input["Tags"] as
        | Array<{ Key: string; Value: string }>
        | undefined;
      if (tags && tags.length > 0) {
        const existing_tags =
          ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
        for (const t of tags) existing_tags[t.Key] = t.Value;
        ctx.store.set(tagsKey(arn), existing_tags);
      }
      return { PermissionSet: ps };
    },

    DescribePermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      const ps = requirePermissionSet(ctx, arn);
      return { PermissionSet: ps };
    },

    ListPermissionSets: (input, ctx) => {
      const instanceArnIn = input["InstanceArn"] as string;
      if (instanceArnIn !== instanceArn) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${instanceArnIn} not found`,
          400,
        );
      }
      const all = ctx.store
        .list<StoredPermissionSet>()
        .filter((e) => e.key.startsWith("ps:"))
        .map((e) => e.value.PermissionSetArn);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { PermissionSets: page, NextToken: nextToken };
    },

    UpdatePermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      const ps = requirePermissionSet(ctx, arn);
      if (input["Description"] !== undefined)
        ps.Description = input["Description"] as string;
      if (input["SessionDuration"] !== undefined)
        ps.SessionDuration = input["SessionDuration"] as string;
      if (input["RelayState"] !== undefined)
        ps.RelayState = input["RelayState"] as string;
      ctx.store.set(psKey(arn), ps);
      return {};
    },

    DeletePermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const hasAssignments = ctx.store
        .list<StoredAssignment>()
        .some(
          (e) =>
            e.key.startsWith("assign:") && e.value.PermissionSetArn === arn,
        );
      if (hasAssignments) {
        throw awsError(
          "ConflictException",
          `PermissionSet ${arn} has account assignments`,
          400,
        );
      }
      ctx.store.delete(psKey(arn));
      ctx.store.delete(inlineKey(arn));
      ctx.store.delete(managedKey(arn));
      ctx.store.delete(custManagedKey(arn));
      ctx.store.delete(boundaryKey(arn));
      ctx.store.delete(tagsKey(arn));
      return {};
    },

    ProvisionPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const requestId = crypto.randomUUID();
      const status: StoredOperationStatus = {
        RequestId: requestId,
        Status: "SUCCEEDED",
        PermissionSetArn: arn,
        TargetId: input["TargetId"] as string | undefined,
        TargetType: input["TargetType"] as string | undefined,
        CreatedDate: nowIso(),
      };
      ctx.store.set(statusKey(`provision:${requestId}`), status);
      return {
        PermissionSetProvisioningStatus: {
          Status: "SUCCEEDED",
          RequestId: requestId,
          PermissionSetArn: arn,
          AccountId: input["TargetId"] as string | undefined,
          CreatedDate: status.CreatedDate,
        },
      };
    },

    DescribePermissionSetProvisioningStatus: (input, ctx) => {
      const requestId = input["ProvisionPermissionSetRequestId"] as string;
      const status = ctx.store.get<StoredOperationStatus>(
        statusKey(`provision:${requestId}`),
      );
      if (!status) {
        throw awsError(
          "ResourceNotFoundException",
          `Provisioning status ${requestId} not found`,
          400,
        );
      }
      return {
        PermissionSetProvisioningStatus: {
          Status: status.Status,
          RequestId: status.RequestId,
          PermissionSetArn: status.PermissionSetArn,
          AccountId:
            status.TargetType === "AWS_ACCOUNT" ? status.TargetId : undefined,
          CreatedDate: status.CreatedDate,
        },
      };
    },

    ListPermissionSetProvisioningStatus: (input, ctx) => {
      const instanceArnIn = input["InstanceArn"] as string;
      if (instanceArnIn !== instanceArn) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${instanceArnIn} not found`,
          400,
        );
      }
      const filter = input["Filter"] as { Status?: string } | undefined;
      const all = ctx.store
        .list<StoredOperationStatus>()
        .filter((e) => e.key.startsWith("status:provision:"))
        .filter((e) => !filter?.Status || e.value.Status === filter.Status)
        .map((e) => ({
          RequestId: e.value.RequestId,
          Status: e.value.Status,
          CreatedDate: e.value.CreatedDate,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { PermissionSetsProvisioningStatus: page, NextToken: nextToken };
    },

    ListPermissionSetsProvisionedToAccount: (input, ctx) => {
      const accountId = input["AccountId"] as string;
      const assignedPsArns = ctx.store
        .list<StoredAssignment>()
        .filter(
          (e) => e.key.startsWith("assign:") && e.value.AccountId === accountId,
        )
        .map((e) => e.value.PermissionSetArn);
      const unique = [...new Set(assignedPsArns)];
      const { page, nextToken } = paginate(
        unique,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { PermissionSets: page, NextToken: nextToken };
    },

    ListAccountsForProvisionedPermissionSet: (input, ctx) => {
      const psArn = input["PermissionSetArn"] as string;
      const accountIds = ctx.store
        .list<StoredAssignment>()
        .filter(
          (e) =>
            e.key.startsWith("assign:") && e.value.PermissionSetArn === psArn,
        )
        .map((e) => e.value.AccountId);
      const unique = [...new Set(accountIds)];
      const { page, nextToken } = paginate(
        unique,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AccountIds: page, NextToken: nextToken };
    },

    GetInlinePolicyForPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const policy = ctx.store.get<string>(inlineKey(arn)) ?? "";
      return { InlinePolicy: policy };
    },

    PutInlinePolicyToPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      ctx.store.set(inlineKey(arn), input["InlinePolicy"] as string);
      return {};
    },

    DeleteInlinePolicyFromPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      ctx.store.delete(inlineKey(arn));
      return {};
    },

    AttachManagedPolicyToPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const policyArn = input["ManagedPolicyArn"] as string;
      const policyName = policyArn.split("/").pop() ?? policyArn;
      const policies =
        ctx.store.get<StoredManagedPolicy[]>(managedKey(arn)) ?? [];
      if (!policies.find((p) => p.Arn === policyArn)) {
        policies.push({ Arn: policyArn, Name: policyName });
        ctx.store.set(managedKey(arn), policies);
      }
      return {};
    },

    DetachManagedPolicyFromPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const policyArn = input["ManagedPolicyArn"] as string;
      const policies =
        ctx.store.get<StoredManagedPolicy[]>(managedKey(arn)) ?? [];
      const updated = policies.filter((p) => p.Arn !== policyArn);
      if (updated.length === policies.length) {
        throw awsError(
          "ResourceNotFoundException",
          `Policy ${policyArn} not attached`,
          400,
        );
      }
      ctx.store.set(managedKey(arn), updated);
      return {};
    },

    ListManagedPoliciesInPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const policies =
        ctx.store.get<StoredManagedPolicy[]>(managedKey(arn)) ?? [];
      const { page, nextToken } = paginate(
        policies,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AttachedManagedPolicies: page, NextToken: nextToken };
    },

    AttachCustomerManagedPolicyReferenceToPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const ref = input[
        "CustomerManagedPolicyReference"
      ] as StoredCustomerManagedPolicy;
      const policies =
        ctx.store.get<StoredCustomerManagedPolicy[]>(custManagedKey(arn)) ?? [];
      const path = ref.Path ?? "/";
      if (
        !policies.find((p) => p.Name === ref.Name && (p.Path ?? "/") === path)
      ) {
        policies.push({ Name: ref.Name, Path: ref.Path });
        ctx.store.set(custManagedKey(arn), policies);
      }
      return {};
    },

    DetachCustomerManagedPolicyReferenceFromPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const ref = input[
        "CustomerManagedPolicyReference"
      ] as StoredCustomerManagedPolicy;
      const path = ref.Path ?? "/";
      const policies =
        ctx.store.get<StoredCustomerManagedPolicy[]>(custManagedKey(arn)) ?? [];
      const updated = policies.filter(
        (p) => !(p.Name === ref.Name && (p.Path ?? "/") === path),
      );
      if (updated.length === policies.length) {
        throw awsError(
          "ResourceNotFoundException",
          `CustomerManagedPolicy ${ref.Name} not attached`,
          400,
        );
      }
      ctx.store.set(custManagedKey(arn), updated);
      return {};
    },

    ListCustomerManagedPolicyReferencesInPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const policies =
        ctx.store.get<StoredCustomerManagedPolicy[]>(custManagedKey(arn)) ?? [];
      const { page, nextToken } = paginate(
        policies,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { CustomerManagedPolicyReferences: page, NextToken: nextToken };
    },

    GetPermissionsBoundaryForPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const boundary = ctx.store.get<StoredPermissionsBoundary>(
        boundaryKey(arn),
      );
      if (!boundary) {
        throw awsError(
          "ResourceNotFoundException",
          `No permissions boundary for ${arn}`,
          400,
        );
      }
      return { PermissionsBoundary: boundary };
    },

    PutPermissionsBoundaryToPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      const boundary = input[
        "PermissionsBoundary"
      ] as StoredPermissionsBoundary;
      ctx.store.set(boundaryKey(arn), boundary);
      return {};
    },

    DeletePermissionsBoundaryFromPermissionSet: (input, ctx) => {
      const arn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, arn);
      ctx.store.delete(boundaryKey(arn));
      return {};
    },

    CreateAccountAssignment: (input, ctx) => {
      const psArn = input["PermissionSetArn"] as string;
      requirePermissionSet(ctx, psArn);
      const accountId = input["TargetId"] as string;
      const targetType = input["TargetType"] as string;
      const principalType = input["PrincipalType"] as string;
      const principalId = input["PrincipalId"] as string;
      const isStore = ctx.storeFor("identitystore");
      if (principalType === "USER") {
        const user = isStore.get<unknown>(
          `is:user:${identityStoreId}:${principalId}`,
        );
        if (!user) {
          throw awsError(
            "ResourceNotFoundException",
            `User ${principalId} not found`,
            400,
          );
        }
      } else if (principalType === "GROUP") {
        const group = isStore.get<unknown>(
          `is:group:${identityStoreId}:${principalId}`,
        );
        if (!group) {
          throw awsError(
            "ResourceNotFoundException",
            `Group ${principalId} not found`,
            400,
          );
        }
      }
      const key = assignKey(accountId, psArn, principalType, principalId);
      const existing = ctx.store.get<StoredAssignment>(key);
      if (!existing) {
        ctx.store.set(key, {
          AccountId: accountId,
          PermissionSetArn: psArn,
          PrincipalType: principalType,
          PrincipalId: principalId,
        });
      }
      const requestId = crypto.randomUUID();
      const status: StoredOperationStatus = {
        RequestId: requestId,
        Status: "SUCCEEDED",
        TargetId: accountId,
        TargetType: targetType,
        PermissionSetArn: psArn,
        PrincipalType: principalType,
        PrincipalId: principalId,
        CreatedDate: nowIso(),
      };
      ctx.store.set(statusKey(`create:${requestId}`), status);
      return {
        AccountAssignmentCreationStatus: {
          Status: "SUCCEEDED",
          RequestId: requestId,
          TargetId: accountId,
          TargetType: targetType,
          PermissionSetArn: psArn,
          PrincipalType: principalType,
          PrincipalId: principalId,
          CreatedDate: status.CreatedDate,
        },
      };
    },

    DeleteAccountAssignment: (input, ctx) => {
      const psArn = input["PermissionSetArn"] as string;
      const accountId = input["TargetId"] as string;
      const targetType = input["TargetType"] as string;
      const principalType = input["PrincipalType"] as string;
      const principalId = input["PrincipalId"] as string;
      const key = assignKey(accountId, psArn, principalType, principalId);
      const existing = ctx.store.get<StoredAssignment>(key);
      if (!existing) {
        throw awsError(
          "ResourceNotFoundException",
          `Assignment not found`,
          400,
        );
      }
      ctx.store.delete(key);
      const requestId = crypto.randomUUID();
      const status: StoredOperationStatus = {
        RequestId: requestId,
        Status: "SUCCEEDED",
        TargetId: accountId,
        TargetType: targetType,
        PermissionSetArn: psArn,
        PrincipalType: principalType,
        PrincipalId: principalId,
        CreatedDate: nowIso(),
      };
      ctx.store.set(statusKey(`delete:${requestId}`), status);
      return {
        AccountAssignmentDeletionStatus: {
          Status: "SUCCEEDED",
          RequestId: requestId,
          TargetId: accountId,
          TargetType: targetType,
          PermissionSetArn: psArn,
          PrincipalType: principalType,
          PrincipalId: principalId,
          CreatedDate: status.CreatedDate,
        },
      };
    },

    ListAccountAssignments: (input, ctx) => {
      const psArn = input["PermissionSetArn"] as string;
      const accountId = input["AccountId"] as string;
      requirePermissionSet(ctx, psArn);
      const all = ctx.store
        .list<StoredAssignment>()
        .filter(
          (e) =>
            e.key.startsWith("assign:") &&
            e.value.AccountId === accountId &&
            e.value.PermissionSetArn === psArn,
        )
        .map((e) => ({
          AccountId: e.value.AccountId,
          PermissionSetArn: e.value.PermissionSetArn,
          PrincipalType: e.value.PrincipalType,
          PrincipalId: e.value.PrincipalId,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AccountAssignments: page, NextToken: nextToken };
    },

    ListAccountAssignmentsForPrincipal: (input, ctx) => {
      const principalId = input["PrincipalId"] as string;
      const principalType = input["PrincipalType"] as string;
      const filter = input["Filter"] as { AccountId?: string } | undefined;
      const all = ctx.store
        .list<StoredAssignment>()
        .filter(
          (e) =>
            e.key.startsWith("assign:") &&
            e.value.PrincipalId === principalId &&
            e.value.PrincipalType === principalType &&
            (!filter?.AccountId || e.value.AccountId === filter.AccountId),
        )
        .map((e) => ({
          AccountId: e.value.AccountId,
          PermissionSetArn: e.value.PermissionSetArn,
          PrincipalType: e.value.PrincipalType,
          PrincipalId: e.value.PrincipalId,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AccountAssignments: page, NextToken: nextToken };
    },

    DescribeAccountAssignmentCreationStatus: (input, ctx) => {
      const requestId = input["AccountAssignmentCreationRequestId"] as string;
      const status = ctx.store.get<StoredOperationStatus>(
        statusKey(`create:${requestId}`),
      );
      if (!status) {
        throw awsError(
          "ResourceNotFoundException",
          `Creation status ${requestId} not found`,
          400,
        );
      }
      return {
        AccountAssignmentCreationStatus: {
          Status: status.Status,
          RequestId: status.RequestId,
          TargetId: status.TargetId,
          TargetType: status.TargetType,
          PermissionSetArn: status.PermissionSetArn,
          PrincipalType: status.PrincipalType,
          PrincipalId: status.PrincipalId,
          CreatedDate: status.CreatedDate,
        },
      };
    },

    DescribeAccountAssignmentDeletionStatus: (input, ctx) => {
      const requestId = input["AccountAssignmentDeletionRequestId"] as string;
      const status = ctx.store.get<StoredOperationStatus>(
        statusKey(`delete:${requestId}`),
      );
      if (!status) {
        throw awsError(
          "ResourceNotFoundException",
          `Deletion status ${requestId} not found`,
          400,
        );
      }
      return {
        AccountAssignmentDeletionStatus: {
          Status: status.Status,
          RequestId: status.RequestId,
          TargetId: status.TargetId,
          TargetType: status.TargetType,
          PermissionSetArn: status.PermissionSetArn,
          PrincipalType: status.PrincipalType,
          PrincipalId: status.PrincipalId,
          CreatedDate: status.CreatedDate,
        },
      };
    },

    ListAccountAssignmentCreationStatus: (input, ctx) => {
      const instanceArnIn = input["InstanceArn"] as string;
      if (instanceArnIn !== instanceArn) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${instanceArnIn} not found`,
          400,
        );
      }
      const filter = input["Filter"] as { Status?: string } | undefined;
      const all = ctx.store
        .list<StoredOperationStatus>()
        .filter((e) => e.key.startsWith("status:create:"))
        .filter((e) => !filter?.Status || e.value.Status === filter.Status)
        .map((e) => ({
          RequestId: e.value.RequestId,
          Status: e.value.Status,
          CreatedDate: e.value.CreatedDate,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AccountAssignmentsCreationStatus: page, NextToken: nextToken };
    },

    ListAccountAssignmentDeletionStatus: (input, ctx) => {
      const instanceArnIn = input["InstanceArn"] as string;
      if (instanceArnIn !== instanceArn) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${instanceArnIn} not found`,
          400,
        );
      }
      const filter = input["Filter"] as { Status?: string } | undefined;
      const all = ctx.store
        .list<StoredOperationStatus>()
        .filter((e) => e.key.startsWith("status:delete:"))
        .filter((e) => !filter?.Status || e.value.Status === filter.Status)
        .map((e) => ({
          RequestId: e.value.RequestId,
          Status: e.value.Status,
          CreatedDate: e.value.CreatedDate,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AccountAssignmentsDeletionStatus: page, NextToken: nextToken };
    },

    TagResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      resolveTaggableResource(ctx, resourceArn);
      const tags = input["Tags"] as Array<{ Key: string; Value: string }>;
      const existing =
        ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
      for (const t of tags) existing[t.Key] = t.Value;
      ctx.store.set(tagsKey(resourceArn), existing);
      return {};
    },

    UntagResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      resolveTaggableResource(ctx, resourceArn);
      const tagKeys = input["TagKeys"] as string[];
      const existing =
        ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
      for (const k of tagKeys) delete existing[k];
      ctx.store.set(tagsKey(resourceArn), existing);
      return {};
    },

    ListTagsForResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      resolveTaggableResource(ctx, resourceArn);
      const tagMap =
        ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
      const tags = Object.entries(tagMap).map(([Key, Value]) => ({
        Key,
        Value,
      }));
      const { page, nextToken } = paginate(tags, undefined, input["NextToken"]);
      return { Tags: page, NextToken: nextToken };
    },

    AddRegion: (_input, _ctx) => ({}),
    RemoveRegion: (_input, _ctx) => ({}),
    DescribeRegion: (_input, _ctx) => ({ Region: {} }),
    ListRegions: (_input, _ctx) => ({ Regions: [], NextToken: undefined }),

    CreateApplication: (input, ctx) => {
      const arn = applicationArn();
      const app: StoredApplication = {
        ApplicationArn: arn,
        Name: input["Name"] as string,
        ApplicationProviderArn: input["ApplicationProviderArn"] as string,
        InstanceArn: input["InstanceArn"] as string,
        ApplicationAccount: ctx.account,
        Status: (input["Status"] as string | undefined) ?? "ENABLED",
        PortalOptions: input["PortalOptions"],
        Description: input["Description"] as string | undefined,
        CreatedDate: nowIso(),
      };
      ctx.store.set(appKey(arn), app);
      const tags = input["Tags"] as
        | Array<{ Key: string; Value: string }>
        | undefined;
      if (tags && tags.length > 0) {
        const existingTags =
          ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
        for (const t of tags) existingTags[t.Key] = t.Value;
        ctx.store.set(tagsKey(arn), existingTags);
      }
      return { ApplicationArn: arn };
    },

    DeleteApplication: (input, ctx) => {
      const arn = input["ApplicationArn"] as string;
      requireApplication(ctx, arn);
      ctx.store.delete(appKey(arn));
      ctx.store.delete(tagsKey(arn));
      ctx.store.delete(appAssignConfigKey(arn));
      ctx.store.delete(appSessionKey(arn));
      for (const e of ctx.store.list<unknown>()) {
        if (
          e.key.startsWith(`appassign:${arn}:`) ||
          e.key.startsWith(`appscope:${arn}:`) ||
          e.key.startsWith(`appauth:${arn}:`) ||
          e.key.startsWith(`appgrant:${arn}:`)
        ) {
          ctx.store.delete(e.key);
        }
      }
      return {};
    },

    DescribeApplication: (input, ctx) => {
      const arn = input["ApplicationArn"] as string;
      const app = requireApplication(ctx, arn);
      return { ...app };
    },

    ListApplications: (input, ctx) => {
      const all = ctx.store
        .list<StoredApplication>()
        .filter((e) => e.key.startsWith("app:"))
        .map((e) => e.value);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { Applications: page, NextToken: nextToken };
    },

    UpdateApplication: (input, ctx) => {
      const arn = input["ApplicationArn"] as string;
      const app = requireApplication(ctx, arn);
      if (input["Name"] !== undefined) app.Name = input["Name"] as string;
      if (input["Description"] !== undefined)
        app.Description = input["Description"] as string;
      if (input["Status"] !== undefined) app.Status = input["Status"] as string;
      if (input["PortalOptions"] !== undefined)
        app.PortalOptions = input["PortalOptions"];
      ctx.store.set(appKey(arn), app);
      return {};
    },

    CreateApplicationAssignment: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const principalType = input["PrincipalType"] as string;
      const principalId = input["PrincipalId"] as string;
      const key = appAssignKey(appArn, principalType, principalId);
      ctx.store.set(key, {
        ApplicationArn: appArn,
        PrincipalType: principalType,
        PrincipalId: principalId,
      });
      return {};
    },

    DeleteApplicationAssignment: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      const principalType = input["PrincipalType"] as string;
      const principalId = input["PrincipalId"] as string;
      const key = appAssignKey(appArn, principalType, principalId);
      const existing = ctx.store.get<StoredAppAssignment>(key);
      if (!existing) {
        throw awsError(
          "ResourceNotFoundException",
          `ApplicationAssignment not found`,
          400,
        );
      }
      ctx.store.delete(key);
      return {};
    },

    DescribeApplicationAssignment: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      const principalType = input["PrincipalType"] as string;
      const principalId = input["PrincipalId"] as string;
      const key = appAssignKey(appArn, principalType, principalId);
      const assignment = ctx.store.get<StoredAppAssignment>(key);
      if (!assignment) {
        throw awsError(
          "ResourceNotFoundException",
          `ApplicationAssignment not found`,
          400,
        );
      }
      return {
        ApplicationArn: assignment.ApplicationArn,
        PrincipalType: assignment.PrincipalType,
        PrincipalId: assignment.PrincipalId,
      };
    },

    ListApplicationAssignments: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const prefix = `appassign:${appArn}:`;
      const all = ctx.store
        .list<StoredAppAssignment>()
        .filter((e) => e.key.startsWith(prefix))
        .map((e) => e.value);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { ApplicationAssignments: page, NextToken: nextToken };
    },

    ListApplicationAssignmentsForPrincipal: (input, ctx) => {
      const principalId = input["PrincipalId"] as string;
      const principalType = input["PrincipalType"] as string;
      const all = ctx.store
        .list<StoredAppAssignment>()
        .filter(
          (e) =>
            e.key.startsWith("appassign:") &&
            e.value.PrincipalId === principalId &&
            e.value.PrincipalType === principalType,
        )
        .map((e) => e.value);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { ApplicationAssignments: page, NextToken: nextToken };
    },

    GetApplicationAssignmentConfiguration: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const config = ctx.store.get<{ AssignmentRequired: boolean }>(
        appAssignConfigKey(appArn),
      );
      return { AssignmentRequired: config?.AssignmentRequired ?? false };
    },

    PutApplicationAssignmentConfiguration: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      ctx.store.set(appAssignConfigKey(appArn), {
        AssignmentRequired: input["AssignmentRequired"] as boolean,
      });
      return {};
    },

    GetApplicationAccessScope: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      const scope = input["Scope"] as string;
      const key = appScopeKey(appArn, scope);
      const stored = ctx.store.get<{
        Scope: string;
        AuthorizedTargets?: string[];
      }>(key);
      if (!stored) {
        throw awsError(
          "ResourceNotFoundException",
          `Scope ${scope} not found`,
          400,
        );
      }
      return stored;
    },

    ListApplicationAccessScopes: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const prefix = `appscope:${appArn}:`;
      const all = ctx.store
        .list<{ Scope: string; AuthorizedTargets?: string[] }>()
        .filter((e) => e.key.startsWith(prefix))
        .map((e) => e.value);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { Scopes: page, NextToken: nextToken };
    },

    PutApplicationAccessScope: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const scope = input["Scope"] as string;
      ctx.store.set(appScopeKey(appArn, scope), {
        Scope: scope,
        AuthorizedTargets: input["AuthorizedTargets"] as string[] | undefined,
      });
      return {};
    },

    DeleteApplicationAccessScope: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const scope = input["Scope"] as string;
      const key = appScopeKey(appArn, scope);
      if (!ctx.store.get<unknown>(key)) {
        throw awsError(
          "ResourceNotFoundException",
          `Scope ${scope} not found`,
          400,
        );
      }
      ctx.store.delete(key);
      return {};
    },

    GetApplicationAuthenticationMethod: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      const methodType = input["AuthenticationMethodType"] as string;
      const key = appAuthKey(appArn, methodType);
      const stored = ctx.store.get<{
        AuthenticationMethodType: string;
        AuthenticationMethod: unknown;
      }>(key);
      if (!stored) {
        throw awsError(
          "ResourceNotFoundException",
          `AuthenticationMethod ${methodType} not found`,
          400,
        );
      }
      return { AuthenticationMethod: stored.AuthenticationMethod };
    },

    ListApplicationAuthenticationMethods: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const prefix = `appauth:${appArn}:`;
      const all = ctx.store
        .list<{
          AuthenticationMethodType: string;
          AuthenticationMethod: unknown;
        }>()
        .filter((e) => e.key.startsWith(prefix))
        .map((e) => ({
          AuthenticationMethodType: e.value.AuthenticationMethodType,
          AuthenticationMethod: e.value.AuthenticationMethod,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { AuthenticationMethods: page, NextToken: nextToken };
    },

    PutApplicationAuthenticationMethod: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const methodType = input["AuthenticationMethodType"] as string;
      ctx.store.set(appAuthKey(appArn, methodType), {
        AuthenticationMethodType: methodType,
        AuthenticationMethod: input["AuthenticationMethod"],
      });
      return {};
    },

    DeleteApplicationAuthenticationMethod: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const methodType = input["AuthenticationMethodType"] as string;
      const key = appAuthKey(appArn, methodType);
      if (!ctx.store.get<unknown>(key)) {
        throw awsError(
          "ResourceNotFoundException",
          `AuthenticationMethod ${methodType} not found`,
          400,
        );
      }
      ctx.store.delete(key);
      return {};
    },

    GetApplicationGrant: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      const grantType = input["GrantType"] as string;
      const key = appGrantKey(appArn, grantType);
      const stored = ctx.store.get<{ GrantType: string; Grant: unknown }>(key);
      if (!stored) {
        throw awsError(
          "ResourceNotFoundException",
          `Grant ${grantType} not found`,
          400,
        );
      }
      return { Grant: stored.Grant };
    },

    ListApplicationGrants: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const prefix = `appgrant:${appArn}:`;
      const all = ctx.store
        .list<{ GrantType: string; Grant: unknown }>()
        .filter((e) => e.key.startsWith(prefix))
        .map((e) => ({
          GrantType: e.value.GrantType,
          Grant: e.value.Grant,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { Grants: page, NextToken: nextToken };
    },

    PutApplicationGrant: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const grantType = input["GrantType"] as string;
      ctx.store.set(appGrantKey(appArn, grantType), {
        GrantType: grantType,
        Grant: input["Grant"],
      });
      return {};
    },

    DeleteApplicationGrant: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const grantType = input["GrantType"] as string;
      const key = appGrantKey(appArn, grantType);
      if (!ctx.store.get<unknown>(key)) {
        throw awsError(
          "ResourceNotFoundException",
          `Grant ${grantType} not found`,
          400,
        );
      }
      ctx.store.delete(key);
      return {};
    },

    GetApplicationSessionConfiguration: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      const config = ctx.store.get<unknown>(appSessionKey(appArn));
      if (config === undefined) {
        throw awsError(
          "ResourceNotFoundException",
          `Session configuration for ${appArn} not found`,
          400,
        );
      }
      return { SessionConfiguration: config };
    },

    PutApplicationSessionConfiguration: (input, ctx) => {
      const appArn = input["ApplicationArn"] as string;
      requireApplication(ctx, appArn);
      ctx.store.set(appSessionKey(appArn), input["SessionConfiguration"]);
      return {};
    },

    DescribeApplicationProvider: (_input, _ctx) => ({
      ApplicationProvider: {},
    }),
    ListApplicationProviders: (_input, _ctx) => ({
      ApplicationProviders: [],
      NextToken: undefined,
    }),

    CreateTrustedTokenIssuer: (input, ctx) => {
      const arn = ttiArn();
      const tti: StoredTrustedTokenIssuer = {
        TrustedTokenIssuerArn: arn,
        Name: input["Name"] as string,
        TrustedTokenIssuerType: input["TrustedTokenIssuerType"] as string,
        TrustedTokenIssuerConfiguration:
          input["TrustedTokenIssuerConfiguration"],
        InstanceArn: input["InstanceArn"] as string,
      };
      ctx.store.set(ttiKey(arn), tti);
      const tags = input["Tags"] as
        | Array<{ Key: string; Value: string }>
        | undefined;
      if (tags && tags.length > 0) {
        const existingTags =
          ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
        for (const t of tags) existingTags[t.Key] = t.Value;
        ctx.store.set(tagsKey(arn), existingTags);
      }
      return { TrustedTokenIssuerArn: arn };
    },

    DeleteTrustedTokenIssuer: (input, ctx) => {
      const arn = input["TrustedTokenIssuerArn"] as string;
      requireTrustedTokenIssuer(ctx, arn);
      ctx.store.delete(ttiKey(arn));
      ctx.store.delete(tagsKey(arn));
      return {};
    },

    DescribeTrustedTokenIssuer: (input, ctx) => {
      const arn = input["TrustedTokenIssuerArn"] as string;
      const tti = requireTrustedTokenIssuer(ctx, arn);
      return {
        TrustedTokenIssuerArn: tti.TrustedTokenIssuerArn,
        Name: tti.Name,
        TrustedTokenIssuerType: tti.TrustedTokenIssuerType,
        TrustedTokenIssuerConfiguration: tti.TrustedTokenIssuerConfiguration,
      };
    },

    ListTrustedTokenIssuers: (input, ctx) => {
      const instanceArnIn = input["InstanceArn"] as string;
      const all = ctx.store
        .list<StoredTrustedTokenIssuer>()
        .filter(
          (e) =>
            e.key.startsWith("tti:") && e.value.InstanceArn === instanceArnIn,
        )
        .map((e) => ({
          TrustedTokenIssuerArn: e.value.TrustedTokenIssuerArn,
          Name: e.value.Name,
          TrustedTokenIssuerType: e.value.TrustedTokenIssuerType,
        }));
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { TrustedTokenIssuers: page, NextToken: nextToken };
    },

    UpdateTrustedTokenIssuer: (input, ctx) => {
      const arn = input["TrustedTokenIssuerArn"] as string;
      const tti = requireTrustedTokenIssuer(ctx, arn);
      if (input["Name"] !== undefined) tti.Name = input["Name"] as string;
      if (input["TrustedTokenIssuerConfiguration"] !== undefined) {
        tti.TrustedTokenIssuerConfiguration =
          input["TrustedTokenIssuerConfiguration"];
      }
      ctx.store.set(ttiKey(arn), tti);
      return {};
    },
  },
};

export default ssoAdmin;
