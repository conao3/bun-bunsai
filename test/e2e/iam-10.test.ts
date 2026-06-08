import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddRoleToInstanceProfileCommand,
  AttachRolePolicyCommand,
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreateInstanceProfileCommand,
  CreatePolicyCommand,
  CreatePolicyVersionCommand,
  CreateRoleCommand,
  CreateSAMLProviderCommand,
  CreateUserCommand,
  GetAccountAuthorizationDetailsCommand,
  GetAccountSummaryCommand,
  GetInstanceProfileCommand,
  GetPolicyVersionCommand,
  GetUserCommand,
  IAMClient,
  ListAccessKeysCommand,
  PutRolePolicyCommand,
  PutUserPolicyCommand,
  RemoveRoleFromInstanceProfileCommand,
  SetDefaultPolicyVersionCommand,
  UpdateAccessKeyCommand,
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

const s3ReadPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

const s3WritePolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:PutObject", Resource: "*" }],
});

test("IAM gap1: CreateUser→GetUser stateful read-after-write", async () => {
  const client = iam();

  const created = await client.send(
    new CreateUserCommand({ UserName: "gap1-user-10" }),
  );
  expect(created.User?.UserName).toBe("gap1-user-10");
  expect(created.User?.UserId).toBeDefined();

  const got = await client.send(
    new GetUserCommand({ UserName: "gap1-user-10" }),
  );
  expect(got.User?.UserName).toBe("gap1-user-10");
  expect(got.User?.UserId).toBe(created.User?.UserId);
  expect(got.User?.Arn).toBe(created.User?.Arn);
});

test("IAM gap1: CreateAccessKey→ListAccessKeys read-after-write", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "gap1-ak-user-10" }));
  const created = await client.send(
    new CreateAccessKeyCommand({ UserName: "gap1-ak-user-10" }),
  );
  const accessKeyId = created.AccessKey?.AccessKeyId;
  expect(accessKeyId).toBeDefined();

  const listed = await client.send(
    new ListAccessKeysCommand({ UserName: "gap1-ak-user-10" }),
  );
  const ids = (listed.AccessKeyMetadata ?? []).map((k) => k.AccessKeyId);
  expect(ids).toContain(accessKeyId);
});

test("IAM gap3: UpdateAccessKey status Active/Inactive round-trip", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "gap3-user-10" }));
  const key = await client.send(
    new CreateAccessKeyCommand({ UserName: "gap3-user-10" }),
  );
  const keyId = key.AccessKey?.AccessKeyId;
  expect(key.AccessKey?.Status).toBe("Active");

  await client.send(
    new UpdateAccessKeyCommand({ AccessKeyId: keyId, Status: "Inactive" }),
  );
  const inactive = await client.send(
    new ListAccessKeysCommand({ UserName: "gap3-user-10" }),
  );
  expect(
    (inactive.AccessKeyMetadata ?? []).find((k) => k.AccessKeyId === keyId)
      ?.Status,
  ).toBe("Inactive");

  await client.send(
    new UpdateAccessKeyCommand({ AccessKeyId: keyId, Status: "Active" }),
  );
  const active = await client.send(
    new ListAccessKeysCommand({ UserName: "gap3-user-10" }),
  );
  expect(
    (active.AccessKeyMetadata ?? []).find((k) => k.AccessKeyId === keyId)
      ?.Status,
  ).toBe("Active");
});

test("IAM gap4: GetAccountSummary PolicyVersionsInUse and Providers dynamic", async () => {
  const client = iam();

  const policy = await client.send(
    new CreatePolicyCommand({
      PolicyName: "gap4-sum-policy-10",
      PolicyDocument: s3ReadPolicy,
    }),
  );
  const policyArn = policy.Policy?.Arn!;

  await client.send(
    new CreatePolicyVersionCommand({
      PolicyArn: policyArn,
      PolicyDocument: s3WritePolicy,
      SetAsDefault: false,
    }),
  );

  await client.send(
    new CreateSAMLProviderCommand({
      Name: "gap4-saml-10",
      SAMLMetadataDocument: "<saml>metadata</saml>",
    }),
  );

  const summary = await client.send(new GetAccountSummaryCommand({}));
  const map = summary.SummaryMap ?? {};

  expect(map["PolicyVersionsInUse"]).toBeGreaterThanOrEqual(2);
  expect(map["Providers"]).toBeGreaterThanOrEqual(1);
});

test("IAM gap4: GetAccountAuthorizationDetails reflects inline policies, attachments, and policy versions", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "gap4-auth-user-10" }));
  await client.send(
    new CreateRoleCommand({
      RoleName: "gap4-auth-role-10",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );
  const managed = await client.send(
    new CreatePolicyCommand({
      PolicyName: "gap4-auth-policy-10",
      PolicyDocument: s3ReadPolicy,
    }),
  );
  const policyArn = managed.Policy?.Arn!;

  await client.send(
    new PutUserPolicyCommand({
      UserName: "gap4-auth-user-10",
      PolicyName: "InlineUser10",
      PolicyDocument: s3ReadPolicy,
    }),
  );
  await client.send(
    new AttachUserPolicyCommand({
      UserName: "gap4-auth-user-10",
      PolicyArn: policyArn,
    }),
  );

  await client.send(
    new PutRolePolicyCommand({
      RoleName: "gap4-auth-role-10",
      PolicyName: "InlineRole10",
      PolicyDocument: s3ReadPolicy,
    }),
  );
  await client.send(
    new AttachRolePolicyCommand({
      RoleName: "gap4-auth-role-10",
      PolicyArn: policyArn,
    }),
  );

  await client.send(
    new CreatePolicyVersionCommand({
      PolicyArn: policyArn,
      PolicyDocument: s3WritePolicy,
      SetAsDefault: false,
    }),
  );

  const details = await client.send(
    new GetAccountAuthorizationDetailsCommand({}),
  );

  const userDetail = (details.UserDetailList ?? []).find(
    (u) => u.UserName === "gap4-auth-user-10",
  );
  expect(userDetail).toBeDefined();
  expect((userDetail?.UserPolicyList ?? []).map((p) => p.PolicyName)).toContain(
    "InlineUser10",
  );
  expect(
    (userDetail?.AttachedManagedPolicies ?? []).map((p) => p.PolicyArn),
  ).toContain(policyArn);

  const roleDetail = (details.RoleDetailList ?? []).find(
    (r) => r.RoleName === "gap4-auth-role-10",
  );
  expect(roleDetail).toBeDefined();
  expect((roleDetail?.RolePolicyList ?? []).map((p) => p.PolicyName)).toContain(
    "InlineRole10",
  );
  expect(
    (roleDetail?.AttachedManagedPolicies ?? []).map((p) => p.PolicyArn),
  ).toContain(policyArn);

  const policyDetail = (details.Policies ?? []).find(
    (p) => p.Arn === policyArn,
  );
  expect(policyDetail).toBeDefined();
  const versionIds = (policyDetail?.PolicyVersionList ?? []).map(
    (v) => v.VersionId,
  );
  expect(versionIds).toContain("v1");
  expect(versionIds).toContain("v2");
});

test("IAM gap5: InstanceProfile add/remove role round-trip", async () => {
  const client = iam();

  await client.send(
    new CreateRoleCommand({
      RoleName: "gap5-role-10",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );
  await client.send(
    new CreateInstanceProfileCommand({
      InstanceProfileName: "gap5-profile-10",
    }),
  );

  await client.send(
    new AddRoleToInstanceProfileCommand({
      InstanceProfileName: "gap5-profile-10",
      RoleName: "gap5-role-10",
    }),
  );

  const withRole = await client.send(
    new GetInstanceProfileCommand({ InstanceProfileName: "gap5-profile-10" }),
  );
  expect(
    (withRole.InstanceProfile?.Roles ?? []).map((r) => r.RoleName),
  ).toContain("gap5-role-10");

  await client.send(
    new RemoveRoleFromInstanceProfileCommand({
      InstanceProfileName: "gap5-profile-10",
      RoleName: "gap5-role-10",
    }),
  );

  const withoutRole = await client.send(
    new GetInstanceProfileCommand({ InstanceProfileName: "gap5-profile-10" }),
  );
  expect(withoutRole.InstanceProfile?.Roles ?? []).toHaveLength(0);
});

test("IAM gap6: SetDefaultPolicyVersion reflected in GetPolicyVersion", async () => {
  const client = iam();

  const created = await client.send(
    new CreatePolicyCommand({
      PolicyName: "gap6-policy-10",
      PolicyDocument: s3ReadPolicy,
    }),
  );
  const policyArn = created.Policy?.Arn!;

  await client.send(
    new CreatePolicyVersionCommand({
      PolicyArn: policyArn,
      PolicyDocument: s3WritePolicy,
      SetAsDefault: false,
    }),
  );

  await client.send(
    new SetDefaultPolicyVersionCommand({
      PolicyArn: policyArn,
      VersionId: "v2",
    }),
  );

  const v1 = await client.send(
    new GetPolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v1" }),
  );
  expect(v1.PolicyVersion?.IsDefaultVersion).toBe(false);

  const v2 = await client.send(
    new GetPolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v2" }),
  );
  expect(v2.PolicyVersion?.IsDefaultVersion).toBe(true);
  expect(v2.PolicyVersion?.Document).toContain("s3:PutObject");
});
