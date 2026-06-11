import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  SSOAdminClient,
  ListInstancesCommand,
  CreatePermissionSetCommand,
  DescribePermissionSetCommand,
  ListPermissionSetsCommand,
  UpdatePermissionSetCommand,
  DeletePermissionSetCommand,
  AttachManagedPolicyToPermissionSetCommand,
  ListManagedPoliciesInPermissionSetCommand,
  DetachManagedPolicyFromPermissionSetCommand,
  PutInlinePolicyToPermissionSetCommand,
  GetInlinePolicyForPermissionSetCommand,
  DeleteInlinePolicyFromPermissionSetCommand,
  CreateAccountAssignmentCommand,
  ListAccountAssignmentsCommand,
  DescribeAccountAssignmentCreationStatusCommand,
  DeleteAccountAssignmentCommand,
  TagResourceCommand,
  ListTagsForResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-sso-admin";
import {
  IdentitystoreClient,
  CreateUserCommand,
  DescribeUserCommand,
  ListUsersCommand,
  UpdateUserCommand,
  DeleteUserCommand,
  CreateGroupCommand,
  DescribeGroupCommand,
  ListGroupsCommand,
  UpdateGroupCommand,
  DeleteGroupCommand,
  CreateGroupMembershipCommand,
  DescribeGroupMembershipCommand,
  ListGroupMembershipsCommand,
  ListGroupMembershipsForMemberCommand,
  IsMemberInGroupsCommand,
  GetGroupMembershipIdCommand,
  DeleteGroupMembershipCommand,
  GetUserIdCommand,
  GetGroupIdCommand,
} from "@aws-sdk/client-identitystore";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sso = () =>
  new SSOAdminClient({ endpoint, region, credentials, requestHandler });

const ids = () =>
  new IdentitystoreClient({ endpoint, region, credentials, requestHandler });

const INSTANCE_ARN = "arn:aws:sso:::instance/ssoins-bunsai0000000001";
const IDENTITY_STORE_ID = "d-bunsai0001";

test("sso-admin: ListInstances returns seeded instance", async () => {
  const res = await sso().send(new ListInstancesCommand({}));
  expect(res.Instances).toHaveLength(1);
  expect(res.Instances![0].InstanceArn).toBe(INSTANCE_ARN);
  expect(res.Instances![0].IdentityStoreId).toBe(IDENTITY_STORE_ID);
});

test("identitystore: User CRUD lifecycle", async () => {
  const client = ids();

  const created = await client.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "e2e-user@example.com",
      DisplayName: "E2E User",
      Name: { GivenName: "E2E", FamilyName: "User" },
    }),
  );
  expect(created.UserId).toBeDefined();
  const userId = created.UserId!;

  const described = await client.send(
    new DescribeUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
  expect(described.UserName).toBe("e2e-user@example.com");
  expect(described.DisplayName).toBe("E2E User");

  const listed = await client.send(
    new ListUsersCommand({ IdentityStoreId: IDENTITY_STORE_ID }),
  );
  expect(listed.Users!.some((u) => u.UserId === userId)).toBe(true);

  const byUsername = await client.send(
    new GetUserIdCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      AlternateIdentifier: {
        UniqueAttribute: {
          AttributePath: "userName",
          AttributeValue: "e2e-user@example.com",
        },
      },
    }),
  );
  expect(byUsername.UserId).toBe(userId);

  await client.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );

  const listedAfter = await client.send(
    new ListUsersCommand({ IdentityStoreId: IDENTITY_STORE_ID }),
  );
  expect(listedAfter.Users!.some((u) => u.UserId === userId)).toBe(false);
});

test("identitystore: Group CRUD lifecycle", async () => {
  const client = ids();

  const created = await client.send(
    new CreateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      DisplayName: "e2e-group",
      Description: "E2E test group",
    }),
  );
  expect(created.GroupId).toBeDefined();
  const groupId = created.GroupId!;

  const described = await client.send(
    new DescribeGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
  expect(described.DisplayName).toBe("e2e-group");

  const listed = await client.send(
    new ListGroupsCommand({ IdentityStoreId: IDENTITY_STORE_ID }),
  );
  expect(listed.Groups!.some((g) => g.GroupId === groupId)).toBe(true);

  const byName = await client.send(
    new GetGroupIdCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      AlternateIdentifier: {
        UniqueAttribute: {
          AttributePath: "displayName",
          AttributeValue: "e2e-group",
        },
      },
    }),
  );
  expect(byName.GroupId).toBe(groupId);

  await client.send(
    new DeleteGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
});

test("identitystore: GroupMembership lifecycle", async () => {
  const idsClient = ids();

  const user = await idsClient.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "member-user@example.com",
      DisplayName: "Member User",
    }),
  );
  const userId = user.UserId!;

  const group = await idsClient.send(
    new CreateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      DisplayName: "member-group",
    }),
  );
  const groupId = group.GroupId!;

  const membership = await idsClient.send(
    new CreateGroupMembershipCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
      MemberId: { UserId: userId },
    }),
  );
  expect(membership.MembershipId).toBeDefined();
  const membershipId = membership.MembershipId!;

  const memberships = await idsClient.send(
    new ListGroupMembershipsCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
  expect(
    memberships.GroupMemberships!.some((m) => m.MembershipId === membershipId),
  ).toBe(true);

  const isMember = await idsClient.send(
    new IsMemberInGroupsCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      MemberId: { UserId: userId },
      GroupIds: [groupId],
    }),
  );
  expect(isMember.Results![0].MembershipExists).toBe(true);

  const getMembershipId = await idsClient.send(
    new GetGroupMembershipIdCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
      MemberId: { UserId: userId },
    }),
  );
  expect(getMembershipId.MembershipId).toBe(membershipId);

  await idsClient.send(
    new DeleteGroupMembershipCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      MembershipId: membershipId,
    }),
  );

  const isMemberAfter = await idsClient.send(
    new IsMemberInGroupsCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      MemberId: { UserId: userId },
      GroupIds: [groupId],
    }),
  );
  expect(isMemberAfter.Results![0].MembershipExists).toBe(false);

  await idsClient.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
  await idsClient.send(
    new DeleteGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
});

test("sso-admin: PermissionSet CRUD + policies", async () => {
  const client = sso();

  const created = await client.send(
    new CreatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "E2EPermissionSet",
      Description: "E2E test permission set",
      SessionDuration: "PT8H",
    }),
  );
  expect(created.PermissionSet?.PermissionSetArn).toBeDefined();
  const psArn = created.PermissionSet!.PermissionSetArn!;

  const described = await client.send(
    new DescribePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
  expect(described.PermissionSet?.Name).toBe("E2EPermissionSet");

  await client.send(
    new UpdatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
      Description: "Updated description",
    }),
  );

  const listed = await client.send(
    new ListPermissionSetsCommand({ InstanceArn: INSTANCE_ARN }),
  );
  expect(listed.PermissionSets!.includes(psArn)).toBe(true);

  const managedPolicyArn = "arn:aws:iam::aws:policy/ReadOnlyAccess";
  await client.send(
    new AttachManagedPolicyToPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
      ManagedPolicyArn: managedPolicyArn,
    }),
  );
  const policies = await client.send(
    new ListManagedPoliciesInPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
  expect(
    policies.AttachedManagedPolicies!.some((p) => p.Arn === managedPolicyArn),
  ).toBe(true);

  await client.send(
    new DetachManagedPolicyFromPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
      ManagedPolicyArn: managedPolicyArn,
    }),
  );

  const inlinePolicy = JSON.stringify({ Version: "2012-10-17", Statement: [] });
  await client.send(
    new PutInlinePolicyToPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
      InlinePolicy: inlinePolicy,
    }),
  );
  const gotInline = await client.send(
    new GetInlinePolicyForPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
  expect(gotInline.InlinePolicy).toBe(inlinePolicy);

  await client.send(
    new DeleteInlinePolicyFromPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );

  await client.send(
    new DeletePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
});

test("identitystore: IDS-01 UpdateUser camelCase AttributePath mapping", async () => {
  const client = ids();

  const created = await client.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "ids01-user@example.com",
      DisplayName: "Original Name",
      Name: { GivenName: "Original", FamilyName: "User" },
    }),
  );
  const userId = created.UserId!;

  await client.send(
    new UpdateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
      Operations: [
        { AttributePath: "displayName", AttributeValue: "New Name" },
      ],
    }),
  );

  const described = await client.send(
    new DescribeUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
  expect(described.DisplayName).toBe("New Name");

  await client.send(
    new UpdateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
      Operations: [
        { AttributePath: "name.familyName", AttributeValue: "Updated" },
      ],
    }),
  );

  const described2 = await client.send(
    new DescribeUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
  expect(described2.Name?.FamilyName).toBe("Updated");
  expect(described2.Name?.GivenName).toBe("Original");

  await client.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
});

test("identitystore: IDS-01 UpdateGroup camelCase AttributePath mapping", async () => {
  const client = ids();

  const created = await client.send(
    new CreateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      DisplayName: "ids01-group-original",
      Description: "Original description",
    }),
  );
  const groupId = created.GroupId!;

  await client.send(
    new UpdateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
      Operations: [
        { AttributePath: "description", AttributeValue: "Updated description" },
      ],
    }),
  );

  const described = await client.send(
    new DescribeGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
  expect(described.Description).toBe("Updated description");

  await client.send(
    new UpdateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
      Operations: [
        { AttributePath: "displayName", AttributeValue: "ids01-group-updated" },
      ],
    }),
  );

  const byNewName = await client.send(
    new GetGroupIdCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      AlternateIdentifier: {
        UniqueAttribute: {
          AttributePath: "displayName",
          AttributeValue: "ids01-group-updated",
        },
      },
    }),
  );
  expect(byNewName.GroupId).toBe(groupId);

  await client.send(
    new DeleteGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
});

test("identitystore: IDS-02 DeleteGroup removes dangling memberships", async () => {
  const client = ids();

  const user = await client.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "ids02-user@example.com",
      DisplayName: "IDS02 User",
    }),
  );
  const userId = user.UserId!;

  const group = await client.send(
    new CreateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      DisplayName: "ids02-group",
    }),
  );
  const groupId = group.GroupId!;

  const membership = await client.send(
    new CreateGroupMembershipCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
      MemberId: { UserId: userId },
    }),
  );
  const membershipId = membership.MembershipId!;

  await client.send(
    new DeleteGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );

  const isMember = await client.send(
    new IsMemberInGroupsCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      MemberId: { UserId: userId },
      GroupIds: [groupId],
    }),
  );
  expect(isMember.Results![0].MembershipExists).toBe(false);

  await expect(
    client.send(
      new DescribeGroupMembershipCommand({
        IdentityStoreId: IDENTITY_STORE_ID,
        MembershipId: membershipId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
});

test("identitystore: IDS-02 DeleteUser removes dangling memberships", async () => {
  const client = ids();

  const user = await client.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "ids02b-user@example.com",
      DisplayName: "IDS02B User",
    }),
  );
  const userId = user.UserId!;

  const group = await client.send(
    new CreateGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      DisplayName: "ids02b-group",
    }),
  );
  const groupId = group.GroupId!;

  const membership = await client.send(
    new CreateGroupMembershipCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
      MemberId: { UserId: userId },
    }),
  );
  const membershipId = membership.MembershipId!;

  await client.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );

  await expect(
    client.send(
      new DescribeGroupMembershipCommand({
        IdentityStoreId: IDENTITY_STORE_ID,
        MembershipId: membershipId,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteGroupCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      GroupId: groupId,
    }),
  );
});

test("identitystore: IDS-03 CreateUser persists Addresses and PhoneNumbers", async () => {
  const client = ids();

  const created = await client.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "ids03-user@example.com",
      DisplayName: "IDS03 User",
      PhoneNumbers: [{ Value: "+81-3-0000-0000", Type: "work", Primary: true }],
      Addresses: [
        {
          StreetAddress: "1-1 Marunouchi",
          Locality: "Chiyoda",
          Country: "JP",
          Primary: true,
        },
      ],
    }),
  );
  const userId = created.UserId!;

  const described = await client.send(
    new DescribeUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
  expect(described.PhoneNumbers).toHaveLength(1);
  expect(described.PhoneNumbers![0].Value).toBe("+81-3-0000-0000");
  expect(described.PhoneNumbers![0].Type).toBe("work");
  expect(described.Addresses).toHaveLength(1);
  expect(described.Addresses![0].StreetAddress).toBe("1-1 Marunouchi");
  expect(described.Addresses![0].Country).toBe("JP");

  await client.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
});

test("sso-admin: AccountAssignment lifecycle + Tags", async () => {
  const ssoClient = sso();
  const idsClient = ids();

  const user = await idsClient.send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "assign-user@example.com",
      DisplayName: "Assign User",
    }),
  );
  const userId = user.UserId!;

  const ps = await ssoClient.send(
    new CreatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "AssignTestPS",
    }),
  );
  const psArn = ps.PermissionSet!.PermissionSetArn!;

  const accountId = "123456789012";

  await ssoClient.send(
    new TagResourceCommand({
      InstanceArn: INSTANCE_ARN,
      ResourceArn: psArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const tags = await ssoClient.send(
    new ListTagsForResourceCommand({
      InstanceArn: INSTANCE_ARN,
      ResourceArn: psArn,
    }),
  );
  expect(tags.Tags!.some((t) => t.Key === "env" && t.Value === "test")).toBe(
    true,
  );

  await ssoClient.send(
    new UntagResourceCommand({
      InstanceArn: INSTANCE_ARN,
      ResourceArn: psArn,
      TagKeys: ["env"],
    }),
  );

  const created = await ssoClient.send(
    new CreateAccountAssignmentCommand({
      InstanceArn: INSTANCE_ARN,
      TargetId: accountId,
      TargetType: "AWS_ACCOUNT",
      PermissionSetArn: psArn,
      PrincipalType: "USER",
      PrincipalId: userId,
    }),
  );
  expect(created.AccountAssignmentCreationStatus?.Status).toBe("SUCCEEDED");
  const requestId = created.AccountAssignmentCreationStatus!.RequestId!;

  const status = await ssoClient.send(
    new DescribeAccountAssignmentCreationStatusCommand({
      InstanceArn: INSTANCE_ARN,
      AccountAssignmentCreationRequestId: requestId,
    }),
  );
  expect(status.AccountAssignmentCreationStatus?.Status).toBe("SUCCEEDED");

  const assignments = await ssoClient.send(
    new ListAccountAssignmentsCommand({
      InstanceArn: INSTANCE_ARN,
      AccountId: accountId,
      PermissionSetArn: psArn,
    }),
  );
  expect(
    assignments.AccountAssignments!.some(
      (a) => a.PrincipalId === userId && a.PrincipalType === "USER",
    ),
  ).toBe(true);

  await ssoClient.send(
    new DeleteAccountAssignmentCommand({
      InstanceArn: INSTANCE_ARN,
      TargetId: accountId,
      TargetType: "AWS_ACCOUNT",
      PermissionSetArn: psArn,
      PrincipalType: "USER",
      PrincipalId: userId,
    }),
  );

  const afterDelete = await ssoClient.send(
    new ListAccountAssignmentsCommand({
      InstanceArn: INSTANCE_ARN,
      AccountId: accountId,
      PermissionSetArn: psArn,
    }),
  );
  expect(afterDelete.AccountAssignments).toHaveLength(0);

  await ssoClient.send(
    new DeletePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
  await idsClient.send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
});
