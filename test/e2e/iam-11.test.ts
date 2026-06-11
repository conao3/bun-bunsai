import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AttachRolePolicyCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  CreateUserCommand,
  DeleteGroupCommand,
  DeleteRoleCommand,
  DeleteRolePolicyCommand,
  DeleteUserCommand,
  DetachRolePolicyCommand,
  IAMClient,
  AttachGroupPolicyCommand,
  CreateGroupCommand,
  ListGroupPoliciesCommand,
  ListAttachedGroupPoliciesCommand,
  ListPoliciesCommand,
  ListRolesCommand,
  ListRoleTagsCommand,
  ListUserTagsCommand,
  ListUsersCommand,
  PutGroupPolicyCommand,
  PutRolePolicyCommand,
  TagRoleCommand,
  TagUserCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });

const trustPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "ec2.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
});

test("HIGH-1: DeleteRole cleans up roletag/* and rolepolicy/* entries", async () => {
  const client = iam();
  await client.send(
    new CreateRoleCommand({
      RoleName: "del-role-1",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );
  await client.send(
    new TagRoleCommand({
      RoleName: "del-role-1",
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "infra" },
      ],
    }),
  );
  await client.send(
    new PutRolePolicyCommand({
      RoleName: "del-role-1",
      PolicyName: "inline1",
      PolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );

  const tagsBefore = await client.send(
    new ListRoleTagsCommand({ RoleName: "del-role-1" }),
  );
  expect(tagsBefore.Tags).toHaveLength(2);

  await client.send(
    new DeleteRolePolicyCommand({
      RoleName: "del-role-1",
      PolicyName: "inline1",
    }),
  );
  await client.send(new DeleteRoleCommand({ RoleName: "del-role-1" }));

  await client.send(
    new CreateRoleCommand({
      RoleName: "del-role-1",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );
  const tagsAfter = await client.send(
    new ListRoleTagsCommand({ RoleName: "del-role-1" }),
  );
  expect(tagsAfter.Tags).toHaveLength(0);

  await client.send(new DeleteRoleCommand({ RoleName: "del-role-1" }));
});

test("HIGH-2: DeleteUser cleans up usertag/* entries", async () => {
  const client = iam();
  await client.send(new CreateUserCommand({ UserName: "del-user-1" }));
  await client.send(
    new TagUserCommand({
      UserName: "del-user-1",
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "x" },
      ],
    }),
  );

  const tagsBefore = await client.send(
    new ListUserTagsCommand({ UserName: "del-user-1" }),
  );
  expect(tagsBefore.Tags).toHaveLength(2);

  await client.send(new DeleteUserCommand({ UserName: "del-user-1" }));

  await client.send(new CreateUserCommand({ UserName: "del-user-1" }));
  const tagsAfter = await client.send(
    new ListUserTagsCommand({ UserName: "del-user-1" }),
  );
  expect(tagsAfter.Tags).toHaveLength(0);

  await client.send(new DeleteUserCommand({ UserName: "del-user-1" }));
});

test("HIGH-3: DeleteGroup cleans up grouppolicy/* and groupattachment/* entries", async () => {
  const client = iam();
  const policyRes = await client.send(
    new CreatePolicyCommand({
      PolicyName: "del-grp-policy",
      PolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  const policyArn = policyRes.Policy!.Arn!;

  await client.send(new CreateGroupCommand({ GroupName: "del-group-1" }));
  await client.send(
    new PutGroupPolicyCommand({
      GroupName: "del-group-1",
      PolicyName: "inline1",
      PolicyDocument: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  await client.send(
    new AttachGroupPolicyCommand({
      GroupName: "del-group-1",
      PolicyArn: policyArn,
    }),
  );

  const inlineBefore = await client.send(
    new ListGroupPoliciesCommand({ GroupName: "del-group-1" }),
  );
  expect(inlineBefore.PolicyNames).toHaveLength(1);
  const attachedBefore = await client.send(
    new ListAttachedGroupPoliciesCommand({ GroupName: "del-group-1" }),
  );
  expect(attachedBefore.AttachedPolicies).toHaveLength(1);

  await client.send(new DeleteGroupCommand({ GroupName: "del-group-1" }));

  await client.send(new CreateGroupCommand({ GroupName: "del-group-1" }));
  const inlineAfter = await client.send(
    new ListGroupPoliciesCommand({ GroupName: "del-group-1" }),
  );
  expect(inlineAfter.PolicyNames).toHaveLength(0);
  const attachedAfter = await client.send(
    new ListAttachedGroupPoliciesCommand({ GroupName: "del-group-1" }),
  );
  expect(attachedAfter.AttachedPolicies).toHaveLength(0);

  await client.send(new DeleteGroupCommand({ GroupName: "del-group-1" }));
});

test("HIGH-4: ListRoles paginates correctly with MaxItems and Marker", async () => {
  const client = iam();
  const prefix = "/pagination-test/";
  const roleCount = 7;
  for (let i = 0; i < roleCount; i++) {
    await client.send(
      new CreateRoleCommand({
        RoleName: `pagtest-role-${i}`,
        Path: prefix,
        AssumeRolePolicyDocument: trustPolicy,
      }),
    );
  }

  const page1 = await client.send(
    new ListRolesCommand({ PathPrefix: prefix, MaxItems: 3 }),
  );
  expect(page1.Roles).toHaveLength(3);
  expect(page1.IsTruncated).toBe(true);
  expect(page1.Marker).toBeDefined();

  const page2 = await client.send(
    new ListRolesCommand({
      PathPrefix: prefix,
      MaxItems: 3,
      Marker: page1.Marker,
    }),
  );
  expect(page2.Roles).toHaveLength(3);
  expect(page2.IsTruncated).toBe(true);

  const page3 = await client.send(
    new ListRolesCommand({
      PathPrefix: prefix,
      MaxItems: 3,
      Marker: page2.Marker,
    }),
  );
  expect(page3.Roles).toHaveLength(1);
  expect(page3.IsTruncated).toBe(false);
  expect(page3.Marker).toBeUndefined();

  const allRoles = [...page1.Roles!, ...page2.Roles!, ...page3.Roles!].map(
    (r) => r.RoleName,
  );
  expect(new Set(allRoles).size).toBe(roleCount);

  for (let i = 0; i < roleCount; i++) {
    await client.send(new DeleteRoleCommand({ RoleName: `pagtest-role-${i}` }));
  }
});

test("HIGH-4: ListUsers paginates correctly with MaxItems and Marker", async () => {
  const client = iam();
  const prefix = "/pagination-user-test/";
  const userCount = 5;
  for (let i = 0; i < userCount; i++) {
    await client.send(
      new CreateUserCommand({ UserName: `pagtest-user-${i}`, Path: prefix }),
    );
  }

  const page1 = await client.send(
    new ListUsersCommand({ PathPrefix: prefix, MaxItems: 2 }),
  );
  expect(page1.Users).toHaveLength(2);
  expect(page1.IsTruncated).toBe(true);

  const page2 = await client.send(
    new ListUsersCommand({
      PathPrefix: prefix,
      MaxItems: 2,
      Marker: page1.Marker,
    }),
  );
  expect(page2.Users).toHaveLength(2);

  const page3 = await client.send(
    new ListUsersCommand({
      PathPrefix: prefix,
      MaxItems: 2,
      Marker: page2.Marker,
    }),
  );
  expect(page3.Users).toHaveLength(1);
  expect(page3.IsTruncated).toBe(false);

  for (let i = 0; i < userCount; i++) {
    await client.send(new DeleteUserCommand({ UserName: `pagtest-user-${i}` }));
  }
});

test("HIGH-4+HIGH-5: ListPolicies paginates and filters OnlyAttached", async () => {
  const client = iam();
  const prefix = "/pagination-policy-test/";

  const policyArns: string[] = [];
  for (let i = 0; i < 4; i++) {
    const res = await client.send(
      new CreatePolicyCommand({
        PolicyName: `pagtest-policy-${i}`,
        Path: prefix,
        PolicyDocument: JSON.stringify({
          Version: "2012-10-17",
          Statement: [],
        }),
      }),
    );
    policyArns.push(res.Policy!.Arn!);
  }

  await client.send(
    new CreateRoleCommand({
      RoleName: "pagtest-attach-role",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );
  await client.send(
    new AttachRolePolicyCommand({
      RoleName: "pagtest-attach-role",
      PolicyArn: policyArns[0],
    }),
  );

  const page1 = await client.send(
    new ListPoliciesCommand({
      Scope: "Local",
      PathPrefix: prefix,
      MaxItems: 2,
    }),
  );
  expect(page1.Policies).toHaveLength(2);
  expect(page1.IsTruncated).toBe(true);

  const page2 = await client.send(
    new ListPoliciesCommand({
      Scope: "Local",
      PathPrefix: prefix,
      MaxItems: 2,
      Marker: page1.Marker,
    }),
  );
  expect(page2.Policies).toHaveLength(2);
  expect(page2.IsTruncated).toBe(false);

  const attached = await client.send(
    new ListPoliciesCommand({
      Scope: "Local",
      PathPrefix: prefix,
      OnlyAttached: true,
    }),
  );
  expect(attached.Policies).toHaveLength(1);
  expect(attached.Policies![0].Arn).toBe(policyArns[0]);

  const unattached = await client.send(
    new ListPoliciesCommand({
      Scope: "Local",
      PathPrefix: prefix,
      OnlyAttached: false,
    }),
  );
  expect(unattached.Policies).toHaveLength(4);

  await client.send(
    new DetachRolePolicyCommand({
      RoleName: "pagtest-attach-role",
      PolicyArn: policyArns[0],
    }),
  );
  await client.send(new DeleteRoleCommand({ RoleName: "pagtest-attach-role" }));
});
