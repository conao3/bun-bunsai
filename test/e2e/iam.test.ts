import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  AttachGroupPolicyCommand,
  AttachRolePolicyCommand,
  CreateAccessKeyCommand,
  CreateGroupCommand,
  CreateLoginProfileCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  CreateUserCommand,
  CreateVirtualMFADeviceCommand,
  DeactivateMFADeviceCommand,
  DeleteGroupCommand,
  DeleteGroupPolicyCommand,
  DeleteLoginProfileCommand,
  DeleteRoleCommand,
  DeleteServerCertificateCommand,
  DeleteUserCommand,
  DeleteVirtualMFADeviceCommand,
  DetachGroupPolicyCommand,
  EnableMFADeviceCommand,
  GetGroupPolicyCommand,
  GetLoginProfileCommand,
  GetPolicyCommand,
  GetRoleCommand,
  GetServerCertificateCommand,
  GetUserCommand,
  IAMClient,
  ListAccessKeysCommand,
  ListAttachedGroupPoliciesCommand,
  ListAttachedRolePoliciesCommand,
  ListGroupPoliciesCommand,
  ListMFADevicesCommand,
  ListRolesCommand,
  ListServerCertificatesCommand,
  ListUsersCommand,
  ListVirtualMFADevicesCommand,
  PutGroupPolicyCommand,
  UpdateLoginProfileCommand,
  UploadServerCertificateCommand,
} from "@aws-sdk/client-iam";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () => new IAMClient({ endpoint, region, credentials });

const assumeRolePolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "ec2.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
});

const managedPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:ListBucket", Resource: "*" }],
});

test("IAM role, user, policy and access key lifecycle", async () => {
  const client = iam();

  const createdRole = await client.send(
    new CreateRoleCommand({
      RoleName: "bunsai-e2e-role",
      AssumeRolePolicyDocument: assumeRolePolicy,
      Description: "bunsai e2e role",
    }),
  );
  const roleArn = createdRole.Role?.Arn;
  expect(roleArn).toBeDefined();
  expect(roleArn).toContain(":role/bunsai-e2e-role");
  expect(createdRole.Role?.AssumeRolePolicyDocument).toBe(assumeRolePolicy);

  const gotRole = await client.send(
    new GetRoleCommand({ RoleName: "bunsai-e2e-role" }),
  );
  expect(gotRole.Role?.RoleName).toBe("bunsai-e2e-role");
  expect(gotRole.Role?.Arn).toBe(roleArn);

  const listedRoles = await client.send(new ListRolesCommand({}));
  const roleNames = (listedRoles.Roles ?? []).map((r) => r.RoleName);
  expect(roleNames).toContain("bunsai-e2e-role");

  const createdUser = await client.send(
    new CreateUserCommand({ UserName: "bunsai-e2e-user" }),
  );
  const userArn = createdUser.User?.Arn;
  expect(userArn).toContain(":user/bunsai-e2e-user");

  const gotUser = await client.send(
    new GetUserCommand({ UserName: "bunsai-e2e-user" }),
  );
  expect(gotUser.User?.UserName).toBe("bunsai-e2e-user");

  const listedUsers = await client.send(new ListUsersCommand({}));
  const userNames = (listedUsers.Users ?? []).map((u) => u.UserName);
  expect(userNames).toContain("bunsai-e2e-user");

  const createdPolicy = await client.send(
    new CreatePolicyCommand({
      PolicyName: "bunsai-e2e-policy",
      PolicyDocument: managedPolicy,
    }),
  );
  const policyArn = createdPolicy.Policy?.Arn;
  expect(policyArn).toContain(":policy/bunsai-e2e-policy");

  const gotPolicy = await client.send(
    new GetPolicyCommand({ PolicyArn: policyArn }),
  );
  expect(gotPolicy.Policy?.PolicyName).toBe("bunsai-e2e-policy");

  await client.send(
    new AttachRolePolicyCommand({
      RoleName: "bunsai-e2e-role",
      PolicyArn: policyArn,
    }),
  );

  const attached = await client.send(
    new ListAttachedRolePoliciesCommand({ RoleName: "bunsai-e2e-role" }),
  );
  const attachedArns = (attached.AttachedPolicies ?? []).map(
    (p) => p.PolicyArn,
  );
  expect(attachedArns).toContain(policyArn);

  const createdKey = await client.send(
    new CreateAccessKeyCommand({ UserName: "bunsai-e2e-user" }),
  );
  const accessKeyId = createdKey.AccessKey?.AccessKeyId;
  expect(accessKeyId).toBeDefined();
  expect(createdKey.AccessKey?.SecretAccessKey).toBeDefined();
  expect(createdKey.AccessKey?.Status).toBe("Active");

  const listedKeys = await client.send(
    new ListAccessKeysCommand({ UserName: "bunsai-e2e-user" }),
  );
  const keyIds = (listedKeys.AccessKeyMetadata ?? []).map((k) => k.AccessKeyId);
  expect(keyIds).toContain(accessKeyId);

  await client.send(new DeleteUserCommand({ UserName: "bunsai-e2e-user" }));
  const usersAfter = await client.send(new ListUsersCommand({}));
  const usersAfterNames = (usersAfter.Users ?? []).map((u) => u.UserName);
  expect(usersAfterNames).not.toContain("bunsai-e2e-user");

  await client.send(new DeleteRoleCommand({ RoleName: "bunsai-e2e-role" }));
  const rolesAfter = await client.send(new ListRolesCommand({}));
  const rolesAfterNames = (rolesAfter.Roles ?? []).map((r) => r.RoleName);
  expect(rolesAfterNames).not.toContain("bunsai-e2e-role");
});

const inlinePolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

test("IAM login profile lifecycle", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "e2e-lp-user" }));

  const created = await client.send(
    new CreateLoginProfileCommand({
      UserName: "e2e-lp-user",
      Password: "TempPass123!",
      PasswordResetRequired: true,
    }),
  );
  expect(created.LoginProfile?.UserName).toBe("e2e-lp-user");
  expect(created.LoginProfile?.PasswordResetRequired).toBe(true);

  const got = await client.send(
    new GetLoginProfileCommand({ UserName: "e2e-lp-user" }),
  );
  expect(got.LoginProfile?.UserName).toBe("e2e-lp-user");

  await client.send(
    new UpdateLoginProfileCommand({
      UserName: "e2e-lp-user",
      PasswordResetRequired: false,
    }),
  );

  await client.send(new DeleteLoginProfileCommand({ UserName: "e2e-lp-user" }));

  await client.send(new DeleteUserCommand({ UserName: "e2e-lp-user" }));
});

test("IAM group inline and attached policy lifecycle", async () => {
  const client = iam();

  await client.send(new CreateGroupCommand({ GroupName: "e2e-gp-group" }));

  await client.send(
    new PutGroupPolicyCommand({
      GroupName: "e2e-gp-group",
      PolicyName: "gp-inline",
      PolicyDocument: inlinePolicy,
    }),
  );

  const gotPolicy = await client.send(
    new GetGroupPolicyCommand({
      GroupName: "e2e-gp-group",
      PolicyName: "gp-inline",
    }),
  );
  expect(gotPolicy.PolicyName).toBe("gp-inline");

  const listedInline = await client.send(
    new ListGroupPoliciesCommand({ GroupName: "e2e-gp-group" }),
  );
  expect(listedInline.PolicyNames ?? []).toContain("gp-inline");

  await client.send(
    new DeleteGroupPolicyCommand({
      GroupName: "e2e-gp-group",
      PolicyName: "gp-inline",
    }),
  );

  const createdPolicy = await client.send(
    new CreatePolicyCommand({
      PolicyName: "e2e-gp-managed",
      PolicyDocument: managedPolicy,
    }),
  );
  const policyArn = createdPolicy.Policy?.Arn;

  await client.send(
    new AttachGroupPolicyCommand({
      GroupName: "e2e-gp-group",
      PolicyArn: policyArn,
    }),
  );

  const attachedPolicies = await client.send(
    new ListAttachedGroupPoliciesCommand({ GroupName: "e2e-gp-group" }),
  );
  const arns = (attachedPolicies.AttachedPolicies ?? []).map(
    (p) => p.PolicyArn,
  );
  expect(arns).toContain(policyArn);

  await client.send(
    new DetachGroupPolicyCommand({
      GroupName: "e2e-gp-group",
      PolicyArn: policyArn,
    }),
  );

  await client.send(new DeleteGroupCommand({ GroupName: "e2e-gp-group" }));
});

test("IAM server certificate lifecycle", async () => {
  const client = iam();

  const certBody =
    "-----BEGIN CERTIFICATE-----\nfakecertbody\n-----END CERTIFICATE-----";
  const privateKey =
    "-----BEGIN RSA PRIVATE KEY-----\nfakekey\n-----END RSA PRIVATE KEY-----";

  const uploaded = await client.send(
    new UploadServerCertificateCommand({
      ServerCertificateName: "e2e-server-cert",
      CertificateBody: certBody,
      PrivateKey: privateKey,
    }),
  );
  expect(uploaded.ServerCertificateMetadata?.ServerCertificateName).toBe(
    "e2e-server-cert",
  );
  expect(uploaded.ServerCertificateMetadata?.Arn).toContain(
    ":server-certificate/e2e-server-cert",
  );

  const got = await client.send(
    new GetServerCertificateCommand({
      ServerCertificateName: "e2e-server-cert",
    }),
  );
  expect(
    got.ServerCertificate?.ServerCertificateMetadata?.ServerCertificateName,
  ).toBe("e2e-server-cert");
  expect(got.ServerCertificate?.CertificateBody).toBe(certBody);

  const listed = await client.send(new ListServerCertificatesCommand({}));
  const certNames = (listed.ServerCertificateMetadataList ?? []).map(
    (c) => c.ServerCertificateName,
  );
  expect(certNames).toContain("e2e-server-cert");

  await client.send(
    new DeleteServerCertificateCommand({
      ServerCertificateName: "e2e-server-cert",
    }),
  );

  const listedAfter = await client.send(new ListServerCertificatesCommand({}));
  const certNamesAfter = (listedAfter.ServerCertificateMetadataList ?? []).map(
    (c) => c.ServerCertificateName,
  );
  expect(certNamesAfter).not.toContain("e2e-server-cert");
});

test("IAM virtual MFA device lifecycle", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "e2e-mfa-user" }));

  const created = await client.send(
    new CreateVirtualMFADeviceCommand({
      VirtualMFADeviceName: "e2e-mfa-device",
    }),
  );
  const serialNumber = created.VirtualMFADevice?.SerialNumber;
  expect(serialNumber).toContain(":mfa/e2e-mfa-device");
  expect(created.VirtualMFADevice?.Base32StringSeed).toBeDefined();

  const unassigned = await client.send(
    new ListVirtualMFADevicesCommand({ AssignmentStatus: "Unassigned" }),
  );
  const unassignedSerials = (unassigned.VirtualMFADevices ?? []).map(
    (d) => d.SerialNumber,
  );
  expect(unassignedSerials).toContain(serialNumber);

  await client.send(
    new EnableMFADeviceCommand({
      UserName: "e2e-mfa-user",
      SerialNumber: serialNumber,
      AuthenticationCode1: "123456",
      AuthenticationCode2: "234567",
    }),
  );

  const listed = await client.send(
    new ListMFADevicesCommand({ UserName: "e2e-mfa-user" }),
  );
  const enabledSerials = (listed.MFADevices ?? []).map((d) => d.SerialNumber);
  expect(enabledSerials).toContain(serialNumber);

  await client.send(
    new DeactivateMFADeviceCommand({
      UserName: "e2e-mfa-user",
      SerialNumber: serialNumber,
    }),
  );

  await client.send(
    new DeleteVirtualMFADeviceCommand({ SerialNumber: serialNumber }),
  );

  await client.send(new DeleteUserCommand({ UserName: "e2e-mfa-user" }));
});
