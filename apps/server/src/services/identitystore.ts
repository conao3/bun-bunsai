import { awsError } from "../core/framework.ts";
import { lazyServiceModel } from "../core/shapes.ts";
import type { ServiceDefinition } from "../core/types.ts";

const model = lazyServiceModel(
  () => import("../../models/identitystore.json", { with: { type: "json" } }),
  { targetPrefix: "AWSIdentityStore" },
);

const validIdentityStoreId = "d-bunsai0001" as const;

const userKey = (storeId: string, userId: string): string =>
  `is:user:${storeId}:${userId}`;
const groupKey = (storeId: string, groupId: string): string =>
  `is:group:${storeId}:${groupId}`;
const membershipKey = (membershipId: string): string =>
  `is:membership:${membershipId}`;
const usernameIdx = (storeId: string, username: string): string =>
  `is:uname:${storeId}:${username}`;
const groupnameIdx = (storeId: string, displayName: string): string =>
  `is:gname:${storeId}:${displayName}`;
const externalIdIdx = (storeId: string, issuer: string, id: string): string =>
  `is:extid:${storeId}:${issuer}:${id}`;

type Name = {
  Formatted?: string;
  FamilyName?: string;
  GivenName?: string;
  MiddleName?: string;
  HonorificPrefix?: string;
  HonorificSuffix?: string;
};

type Email = {
  Value?: string;
  Type?: string;
  Primary?: boolean;
};

type Address = {
  StreetAddress?: string;
  Locality?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
  Formatted?: string;
  Type?: string;
  Primary?: boolean;
};

type PhoneNumber = {
  Value?: string;
  Type?: string;
  Primary?: boolean;
};

type Photo = {
  Url?: string;
  Type?: string;
  Primary?: boolean;
};

type Role = {
  Value: string;
  Type?: string;
};

type ExternalId = {
  Issuer: string;
  Id: string;
};

type StoredUser = {
  UserId: string;
  IdentityStoreId: string;
  UserName?: string;
  DisplayName?: string;
  NickName?: string;
  ProfileUrl?: string;
  Emails?: Email[];
  Addresses?: Address[];
  PhoneNumbers?: PhoneNumber[];
  Name?: Name;
  UserType?: string;
  Title?: string;
  PreferredLanguage?: string;
  Locale?: string;
  Timezone?: string;
  Photos?: Photo[];
  Website?: string;
  Birthdate?: string;
  Roles?: Role[];
  Extensions?: Record<string, unknown>;
  ExternalIds?: ExternalId[];
  CreatedAt?: string;
  UpdatedAt?: string;
};

type StoredGroup = {
  GroupId: string;
  IdentityStoreId: string;
  DisplayName?: string;
  Description?: string;
  ExternalIds?: ExternalId[];
  CreatedAt?: string;
  UpdatedAt?: string;
};

type StoredMembership = {
  MembershipId: string;
  IdentityStoreId: string;
  GroupId: string;
  MemberId: { UserId: string };
};

const requireValidStore = (storeId: string): void => {
  if (storeId !== validIdentityStoreId) {
    throw awsError(
      "ResourceNotFoundException",
      `Identity store ${storeId} not found`,
      400,
    );
  }
};

const requireUser = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  storeId: string,
  userId: string,
): StoredUser => {
  const user = ctx.store.get<StoredUser>(userKey(storeId, userId));
  if (!user) {
    throw awsError(
      "ResourceNotFoundException",
      `User ${userId} not found`,
      400,
    );
  }
  return user;
};

const requireGroup = (
  ctx: { store: { get: <T>(key: string) => T | undefined } },
  storeId: string,
  groupId: string,
): StoredGroup => {
  const group = ctx.store.get<StoredGroup>(groupKey(storeId, groupId));
  if (!group) {
    throw awsError(
      "ResourceNotFoundException",
      `Group ${groupId} not found`,
      400,
    );
  }
  return group;
};

const toPascal = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const encodeToken = (offset: number): string =>
  Buffer.from(String(offset)).toString("base64");

const decodeToken = (token: unknown): number => {
  if (typeof token !== "string" || token === "") return 0;
  const n = Number.parseInt(Buffer.from(token, "base64").toString(), 10);
  if (!Number.isFinite(n) || n < 0) {
    throw awsError("ValidationException", "Invalid NextToken", 400);
  }
  return n;
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

const identitystore: ServiceDefinition = {
  name: "identitystore",
  protocol: "json",
  model,
  operations: {
    CreateUser: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const username = input["UserName"] as string | undefined;
      if (username) {
        const existing = ctx.store.get<string>(usernameIdx(storeId, username));
        if (existing) {
          throw awsError(
            "ConflictException",
            `User with username ${username} already exists`,
            400,
          );
        }
      }
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const user: StoredUser = {
        UserId: userId,
        IdentityStoreId: storeId,
        UserName: username,
        DisplayName: input["DisplayName"] as string | undefined,
        NickName: input["NickName"] as string | undefined,
        ProfileUrl: input["ProfileUrl"] as string | undefined,
        Emails: input["Emails"] as Email[] | undefined,
        Addresses: input["Addresses"] as Address[] | undefined,
        PhoneNumbers: input["PhoneNumbers"] as PhoneNumber[] | undefined,
        Name: input["Name"] as Name | undefined,
        UserType: input["UserType"] as string | undefined,
        Title: input["Title"] as string | undefined,
        PreferredLanguage: input["PreferredLanguage"] as string | undefined,
        Locale: input["Locale"] as string | undefined,
        Timezone: input["Timezone"] as string | undefined,
        Photos: input["Photos"] as Photo[] | undefined,
        Website: input["Website"] as string | undefined,
        Birthdate: input["Birthdate"] as string | undefined,
        Roles: input["Roles"] as Role[] | undefined,
        Extensions: input["Extensions"] as Record<string, unknown> | undefined,
        ExternalIds: input["ExternalIds"] as ExternalId[] | undefined,
        CreatedAt: now,
        UpdatedAt: now,
      };
      ctx.store.set(userKey(storeId, userId), user);
      if (username) {
        ctx.store.set(usernameIdx(storeId, username), userId);
      }
      for (const ext of user.ExternalIds ?? []) {
        ctx.store.set(externalIdIdx(storeId, ext.Issuer, ext.Id), userId);
      }
      return { UserId: userId, IdentityStoreId: storeId };
    },

    DescribeUser: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const userId = input["UserId"] as string;
      const user = requireUser(ctx, storeId, userId);
      return { ...user };
    },

    DeleteUser: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const userId = input["UserId"] as string;
      const user = requireUser(ctx, storeId, userId);
      ctx.store.delete(userKey(storeId, userId));
      if (user.UserName) {
        ctx.store.delete(usernameIdx(storeId, user.UserName));
      }
      for (const ext of user.ExternalIds ?? []) {
        ctx.store.delete(externalIdIdx(storeId, ext.Issuer, ext.Id));
      }
      const danglingMemberships = ctx.store
        .list<StoredMembership>()
        .filter(
          (e) =>
            e.key.startsWith("is:membership:") &&
            e.value.IdentityStoreId === storeId &&
            e.value.MemberId.UserId === userId,
        )
        .map((e) => e.key);
      for (const key of danglingMemberships) {
        ctx.store.delete(key);
      }
      return {};
    },

    UpdateUser: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const userId = input["UserId"] as string;
      const user = requireUser(ctx, storeId, userId);
      const ops = input["Operations"] as Array<{
        AttributePath: string;
        AttributeValue?: unknown;
      }>;
      for (const op of ops ?? []) {
        const segments = op.AttributePath.split(".");
        const topKey = toPascal(segments[0]);
        if (segments.length >= 2) {
          const subKey = toPascal(segments[1]);
          const parent = (user as Record<string, unknown>)[topKey] as
            | Record<string, unknown>
            | undefined;
          if (op.AttributeValue === null || op.AttributeValue === undefined) {
            if (parent) delete parent[subKey];
          } else {
            if (!parent) {
              (user as Record<string, unknown>)[topKey] = {};
            }
            (
              (user as Record<string, unknown>)[topKey] as Record<
                string,
                unknown
              >
            )[subKey] = op.AttributeValue;
          }
        } else if (topKey === "UserName") {
          const newUsername = op.AttributeValue as string | null | undefined;
          if (newUsername === null || newUsername === undefined) {
            if (user.UserName)
              ctx.store.delete(usernameIdx(storeId, user.UserName));
            delete user.UserName;
          } else {
            const existing = ctx.store.get<string>(
              usernameIdx(storeId, newUsername),
            );
            if (existing && existing !== userId) {
              throw awsError(
                "ConflictException",
                `Username ${newUsername} already taken`,
                400,
              );
            }
            if (user.UserName)
              ctx.store.delete(usernameIdx(storeId, user.UserName));
            ctx.store.set(usernameIdx(storeId, newUsername), userId);
            user.UserName = newUsername;
          }
        } else {
          if (op.AttributeValue === null || op.AttributeValue === undefined) {
            delete (user as Record<string, unknown>)[topKey];
          } else {
            (user as Record<string, unknown>)[topKey] = op.AttributeValue;
          }
        }
      }
      user.UpdatedAt = new Date().toISOString();
      ctx.store.set(userKey(storeId, userId), user);
      return {};
    },

    ListUsers: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const filters = input["Filters"] as
        | Array<{ AttributePath: string; AttributeValue: string }>
        | undefined;
      let all = ctx.store
        .list<StoredUser>()
        .filter((e) => e.key.startsWith(`is:user:${storeId}:`))
        .map((e) => e.value);
      if (filters && filters.length > 0) {
        all = all.filter((u) =>
          filters.every((f) => {
            const key = toPascal(f.AttributePath) as keyof StoredUser;
            return u[key] === f.AttributeValue;
          }),
        );
      }
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { Users: page, NextToken: nextToken };
    },

    GetUserId: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const altId = input["AlternateIdentifier"] as {
        ExternalId?: ExternalId;
        UniqueAttribute?: { AttributePath: string; AttributeValue: unknown };
      };
      let userId: string | undefined;
      if (altId.ExternalId) {
        userId = ctx.store.get<string>(
          externalIdIdx(storeId, altId.ExternalId.Issuer, altId.ExternalId.Id),
        );
      } else if (altId.UniqueAttribute) {
        const path = altId.UniqueAttribute.AttributePath;
        const val = altId.UniqueAttribute.AttributeValue;
        if (path === "userName" || path === "UserName") {
          userId = ctx.store.get<string>(usernameIdx(storeId, String(val)));
        } else {
          const match = ctx.store
            .list<StoredUser>()
            .filter((e) => e.key.startsWith(`is:user:${storeId}:`))
            .find((e) => {
              const user = e.value as Record<string, unknown>;
              if (path === "emails.value") {
                const emails = user.Emails as Email[] | undefined;
                return emails?.some((em) => em.Value === val);
              }
              return user[path] === val;
            });
          userId = match?.value.UserId;
        }
      }
      if (!userId) {
        throw awsError(
          "ResourceNotFoundException",
          "User not found for the given alternate identifier",
          400,
        );
      }
      return { UserId: userId, IdentityStoreId: storeId };
    },

    CreateGroup: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const displayName = input["DisplayName"] as string | undefined;
      if (displayName) {
        const existing = ctx.store.get<string>(
          groupnameIdx(storeId, displayName),
        );
        if (existing) {
          throw awsError(
            "ConflictException",
            `Group with name ${displayName} already exists`,
            400,
          );
        }
      }
      const groupId = crypto.randomUUID();
      const now = new Date().toISOString();
      const group: StoredGroup = {
        GroupId: groupId,
        IdentityStoreId: storeId,
        DisplayName: displayName,
        Description: input["Description"] as string | undefined,
        ExternalIds: input["ExternalIds"] as ExternalId[] | undefined,
        CreatedAt: now,
        UpdatedAt: now,
      };
      ctx.store.set(groupKey(storeId, groupId), group);
      if (displayName) {
        ctx.store.set(groupnameIdx(storeId, displayName), groupId);
      }
      for (const ext of group.ExternalIds ?? []) {
        ctx.store.set(
          externalIdIdx(storeId, `group:${ext.Issuer}`, ext.Id),
          groupId,
        );
      }
      return { GroupId: groupId, IdentityStoreId: storeId };
    },

    DescribeGroup: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const groupId = input["GroupId"] as string;
      const group = requireGroup(ctx, storeId, groupId);
      return { ...group };
    },

    DeleteGroup: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const groupId = input["GroupId"] as string;
      const group = requireGroup(ctx, storeId, groupId);
      ctx.store.delete(groupKey(storeId, groupId));
      if (group.DisplayName) {
        ctx.store.delete(groupnameIdx(storeId, group.DisplayName));
      }
      for (const ext of group.ExternalIds ?? []) {
        ctx.store.delete(externalIdIdx(storeId, `group:${ext.Issuer}`, ext.Id));
      }
      const danglingMemberships = ctx.store
        .list<StoredMembership>()
        .filter(
          (e) =>
            e.key.startsWith("is:membership:") &&
            e.value.IdentityStoreId === storeId &&
            e.value.GroupId === groupId,
        )
        .map((e) => e.key);
      for (const key of danglingMemberships) {
        ctx.store.delete(key);
      }
      return {};
    },

    UpdateGroup: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const groupId = input["GroupId"] as string;
      const group = requireGroup(ctx, storeId, groupId);
      const ops = input["Operations"] as Array<{
        AttributePath: string;
        AttributeValue?: unknown;
      }>;
      for (const op of ops ?? []) {
        const topKey = toPascal(op.AttributePath);
        if (topKey === "DisplayName") {
          const newName = op.AttributeValue as string | null | undefined;
          if (newName === null || newName === undefined) {
            if (group.DisplayName)
              ctx.store.delete(groupnameIdx(storeId, group.DisplayName));
            delete group.DisplayName;
          } else {
            const existing = ctx.store.get<string>(
              groupnameIdx(storeId, newName),
            );
            if (existing && existing !== groupId) {
              throw awsError(
                "ConflictException",
                `Group name ${newName} already taken`,
                400,
              );
            }
            if (group.DisplayName)
              ctx.store.delete(groupnameIdx(storeId, group.DisplayName));
            ctx.store.set(groupnameIdx(storeId, newName), groupId);
            group.DisplayName = newName;
          }
        } else {
          if (op.AttributeValue === null || op.AttributeValue === undefined) {
            delete (group as Record<string, unknown>)[topKey];
          } else {
            (group as Record<string, unknown>)[topKey] = op.AttributeValue;
          }
        }
      }
      group.UpdatedAt = new Date().toISOString();
      ctx.store.set(groupKey(storeId, groupId), group);
      return {};
    },

    ListGroups: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const filters = input["Filters"] as
        | Array<{ AttributePath: string; AttributeValue: string }>
        | undefined;
      let all = ctx.store
        .list<StoredGroup>()
        .filter((e) => e.key.startsWith(`is:group:${storeId}:`))
        .map((e) => e.value);
      if (filters && filters.length > 0) {
        all = all.filter((g) =>
          filters.every((f) => {
            const key = toPascal(f.AttributePath) as keyof StoredGroup;
            return g[key] === f.AttributeValue;
          }),
        );
      }
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { Groups: page, NextToken: nextToken };
    },

    GetGroupId: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const altId = input["AlternateIdentifier"] as {
        ExternalId?: ExternalId;
        UniqueAttribute?: { AttributePath: string; AttributeValue: unknown };
      };
      let groupId: string | undefined;
      if (altId.ExternalId) {
        groupId = ctx.store.get<string>(
          externalIdIdx(
            storeId,
            `group:${altId.ExternalId.Issuer}`,
            altId.ExternalId.Id,
          ),
        );
      } else if (altId.UniqueAttribute) {
        const path = altId.UniqueAttribute.AttributePath;
        const val = altId.UniqueAttribute.AttributeValue;
        if (path === "displayName" || path === "DisplayName") {
          groupId = ctx.store.get<string>(groupnameIdx(storeId, String(val)));
        } else {
          const match = ctx.store
            .list<StoredGroup>()
            .filter((e) => e.key.startsWith(`is:group:${storeId}:`))
            .find((e) => {
              const g = e.value as Record<string, unknown>;
              return g[path] === val;
            });
          groupId = match?.value.GroupId;
        }
      }
      if (!groupId) {
        throw awsError(
          "ResourceNotFoundException",
          "Group not found for the given alternate identifier",
          400,
        );
      }
      return { GroupId: groupId, IdentityStoreId: storeId };
    },

    CreateGroupMembership: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const groupId = input["GroupId"] as string;
      const memberId = input["MemberId"] as { UserId: string };
      requireGroup(ctx, storeId, groupId);
      requireUser(ctx, storeId, memberId.UserId);
      const existing = ctx.store
        .list<StoredMembership>()
        .find(
          (e) =>
            e.key.startsWith("is:membership:") &&
            e.value.IdentityStoreId === storeId &&
            e.value.GroupId === groupId &&
            e.value.MemberId.UserId === memberId.UserId,
        );
      if (existing) {
        throw awsError(
          "ConflictException",
          `User ${memberId.UserId} is already a member of group ${groupId}`,
          400,
        );
      }
      const membershipId = crypto.randomUUID();
      const membership: StoredMembership = {
        MembershipId: membershipId,
        IdentityStoreId: storeId,
        GroupId: groupId,
        MemberId: memberId,
      };
      ctx.store.set(membershipKey(membershipId), membership);
      return { MembershipId: membershipId, IdentityStoreId: storeId };
    },

    DescribeGroupMembership: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const membershipId = input["MembershipId"] as string;
      const membership = ctx.store.get<StoredMembership>(
        membershipKey(membershipId),
      );
      if (!membership || membership.IdentityStoreId !== storeId) {
        throw awsError(
          "ResourceNotFoundException",
          `Membership ${membershipId} not found`,
          400,
        );
      }
      return { ...membership };
    },

    DeleteGroupMembership: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const membershipId = input["MembershipId"] as string;
      const membership = ctx.store.get<StoredMembership>(
        membershipKey(membershipId),
      );
      if (!membership || membership.IdentityStoreId !== storeId) {
        throw awsError(
          "ResourceNotFoundException",
          `Membership ${membershipId} not found`,
          400,
        );
      }
      ctx.store.delete(membershipKey(membershipId));
      return {};
    },

    ListGroupMemberships: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const groupId = input["GroupId"] as string;
      requireGroup(ctx, storeId, groupId);
      const all = ctx.store
        .list<StoredMembership>()
        .filter(
          (e) =>
            e.key.startsWith("is:membership:") &&
            e.value.IdentityStoreId === storeId &&
            e.value.GroupId === groupId,
        )
        .map((e) => e.value);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { GroupMemberships: page, NextToken: nextToken };
    },

    ListGroupMembershipsForMember: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const memberId = input["MemberId"] as { UserId: string };
      requireUser(ctx, storeId, memberId.UserId);
      const all = ctx.store
        .list<StoredMembership>()
        .filter(
          (e) =>
            e.key.startsWith("is:membership:") &&
            e.value.IdentityStoreId === storeId &&
            e.value.MemberId.UserId === memberId.UserId,
        )
        .map((e) => e.value);
      const { page, nextToken } = paginate(
        all,
        input["MaxResults"] as number | undefined,
        input["NextToken"],
      );
      return { GroupMemberships: page, NextToken: nextToken };
    },

    GetGroupMembershipId: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const groupId = input["GroupId"] as string;
      const memberId = input["MemberId"] as { UserId: string };
      const membership = ctx.store
        .list<StoredMembership>()
        .find(
          (e) =>
            e.key.startsWith("is:membership:") &&
            e.value.IdentityStoreId === storeId &&
            e.value.GroupId === groupId &&
            e.value.MemberId.UserId === memberId.UserId,
        );
      if (!membership) {
        throw awsError(
          "ResourceNotFoundException",
          "Membership not found",
          400,
        );
      }
      return {
        MembershipId: membership.value.MembershipId,
        IdentityStoreId: storeId,
      };
    },

    IsMemberInGroups: (input, ctx) => {
      const storeId = input["IdentityStoreId"] as string;
      requireValidStore(storeId);
      const memberId = input["MemberId"] as { UserId: string };
      requireUser(ctx, storeId, memberId.UserId);
      const groupIds = input["GroupIds"] as string[];
      const membershipSet = new Set(
        ctx.store
          .list<StoredMembership>()
          .filter(
            (e) =>
              e.key.startsWith("is:membership:") &&
              e.value.IdentityStoreId === storeId &&
              e.value.MemberId.UserId === memberId.UserId,
          )
          .map((e) => e.value.GroupId),
      );
      const results = groupIds.map((gid) => ({
        GroupId: gid,
        MemberId: memberId,
        MembershipExists: membershipSet.has(gid),
      }));
      return { Results: results };
    },
  },
};

export default identitystore;
