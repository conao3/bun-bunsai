import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import ssoAdminModel from "../../../../test/vendor/aws-models/sso-admin.json" with { type: "json" };
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

const nowIso = (): string => new Date().toISOString();

const permissionSetArn = (name: string): string =>
  `arn:aws:sso:::permissionSet/ssoins-bunsai0000000001/ps-${name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16)
    .padEnd(16, "0")}${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;

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

const ssoAdmin: ServiceDefinition = {
  name: "sso",
  protocol: "json",
  model,
  operations: {
    ListInstances: (_input, _ctx) => ({
      Instances: [
        {
          InstanceArn: instanceArn,
          IdentityStoreId: identityStoreId,
          OwnerAccountId: "000000000000",
          Name: "bunsai-sso",
          Status: "ACTIVE",
          CreatedDate: instanceCreatedDate,
        },
      ],
      NextToken: undefined,
    }),

    DescribeInstance: (input, _ctx) => {
      const arn = input["InstanceArn"] as string;
      if (arn !== instanceArn) {
        throw awsError(
          "ResourceNotFoundException",
          `Instance ${arn} not found`,
          400,
        );
      }
      return {
        InstanceArn: instanceArn,
        IdentityStoreId: identityStoreId,
        OwnerAccountId: "000000000000",
        Name: "bunsai-sso",
        Status: "ACTIVE",
        CreatedDate: instanceCreatedDate,
      };
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
      ctx.store.delete(psKey(arn));
      ctx.store.delete(inlineKey(arn));
      ctx.store.delete(managedKey(arn));
      ctx.store.delete(custManagedKey(arn));
      ctx.store.delete(boundaryKey(arn));
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
      const all = ctx.store
        .list<StoredOperationStatus>()
        .filter((e) => e.key.startsWith("status:provision:"))
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
      return { PermissionSetProvisioningStatus: page, NextToken: nextToken };
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
      const all = ctx.store
        .list<StoredAssignment>()
        .filter(
          (e) =>
            e.key.startsWith("assign:") &&
            e.value.PrincipalId === principalId &&
            e.value.PrincipalType === principalType,
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
      const all = ctx.store
        .list<StoredOperationStatus>()
        .filter((e) => e.key.startsWith("status:create:"))
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
      const all = ctx.store
        .list<StoredOperationStatus>()
        .filter((e) => e.key.startsWith("status:delete:"))
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
      const tags = input["Tags"] as Array<{ Key: string; Value: string }>;
      const existing =
        ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
      for (const t of tags) existing[t.Key] = t.Value;
      ctx.store.set(tagsKey(resourceArn), existing);
      return {};
    },

    UntagResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
      const tagKeys = input["TagKeys"] as string[];
      const existing =
        ctx.store.get<Record<string, string>>(tagsKey(resourceArn)) ?? {};
      for (const k of tagKeys) delete existing[k];
      ctx.store.set(tagsKey(resourceArn), existing);
      return {};
    },

    ListTagsForResource: (input, ctx) => {
      const resourceArn = input["ResourceArn"] as string;
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

    CreateInstance: (_input, _ctx) => ({ InstanceArn: instanceArn }),
    DeleteInstance: (_input, _ctx) => ({}),
    UpdateInstance: (_input, _ctx) => ({}),
    DescribeInstanceAccessControlAttributeConfiguration: (_input, _ctx) => ({
      Status: "ENABLED",
      InstanceAccessControlAttributeConfiguration: {
        AccessControlAttributes: [],
      },
    }),
    CreateInstanceAccessControlAttributeConfiguration: (_input, _ctx) => ({}),
    DeleteInstanceAccessControlAttributeConfiguration: (_input, _ctx) => ({}),
    UpdateInstanceAccessControlAttributeConfiguration: (_input, _ctx) => ({}),

    CreateApplication: (_input, _ctx) => ({
      ApplicationArn: `arn:aws:sso::000000000000:application/ssoins-bunsai0000000001/apl-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    }),
    DeleteApplication: (_input, _ctx) => ({}),
    DescribeApplication: (_input, _ctx) => ({ Application: {} }),
    ListApplications: (_input, _ctx) => ({
      Applications: [],
      NextToken: undefined,
    }),
    UpdateApplication: (_input, _ctx) => ({}),

    CreateApplicationAssignment: (_input, _ctx) => ({}),
    DeleteApplicationAssignment: (_input, _ctx) => ({}),
    DescribeApplicationAssignment: (_input, _ctx) => ({
      ApplicationAssignment: {},
    }),
    ListApplicationAssignments: (_input, _ctx) => ({
      ApplicationAssignments: [],
      NextToken: undefined,
    }),
    ListApplicationAssignmentsForPrincipal: (_input, _ctx) => ({
      ApplicationAssignments: [],
      NextToken: undefined,
    }),
    GetApplicationAssignmentConfiguration: (_input, _ctx) => ({
      AssignmentRequired: false,
    }),
    PutApplicationAssignmentConfiguration: (_input, _ctx) => ({}),

    GetApplicationAccessScope: (_input, _ctx) => ({
      Scope: "",
      AuthorizedTargets: [],
    }),
    ListApplicationAccessScopes: (_input, _ctx) => ({
      Scopes: [],
      NextToken: undefined,
    }),
    PutApplicationAccessScope: (_input, _ctx) => ({}),
    DeleteApplicationAccessScope: (_input, _ctx) => ({}),

    GetApplicationAuthenticationMethod: (_input, _ctx) => ({
      AuthenticationMethod: {},
    }),
    ListApplicationAuthenticationMethods: (_input, _ctx) => ({
      AuthenticationMethods: [],
      NextToken: undefined,
    }),
    PutApplicationAuthenticationMethod: (_input, _ctx) => ({}),
    DeleteApplicationAuthenticationMethod: (_input, _ctx) => ({}),

    GetApplicationGrant: (_input, _ctx) => ({ Grant: {} }),
    ListApplicationGrants: (_input, _ctx) => ({
      Grants: [],
      NextToken: undefined,
    }),
    PutApplicationGrant: (_input, _ctx) => ({}),
    DeleteApplicationGrant: (_input, _ctx) => ({}),

    GetApplicationSessionConfiguration: (_input, _ctx) => ({
      SessionConfiguration: {},
    }),
    PutApplicationSessionConfiguration: (_input, _ctx) => ({}),

    DescribeApplicationProvider: (_input, _ctx) => ({
      ApplicationProvider: {},
    }),
    ListApplicationProviders: (_input, _ctx) => ({
      ApplicationProviders: [],
      NextToken: undefined,
    }),

    CreateTrustedTokenIssuer: (_input, _ctx) => ({
      TrustedTokenIssuerArn: `arn:aws:sso::000000000000:trustedTokenIssuer/ssoins-bunsai0000000001/tti-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    }),
    DeleteTrustedTokenIssuer: (_input, _ctx) => ({}),
    DescribeTrustedTokenIssuer: (_input, _ctx) => ({ TrustedTokenIssuer: {} }),
    ListTrustedTokenIssuers: (_input, _ctx) => ({
      TrustedTokenIssuers: [],
      NextToken: undefined,
    }),
    UpdateTrustedTokenIssuer: (_input, _ctx) => ({}),
  },
};

export default ssoAdmin;
