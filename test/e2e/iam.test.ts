import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AttachRolePolicyCommand,
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  CreateUserCommand,
  DeleteRoleCommand,
  DeleteUserCommand,
  GetPolicyCommand,
  GetRoleCommand,
  GetUserCommand,
  IAMClient,
  ListAccessKeysCommand,
  ListAttachedRolePoliciesCommand,
  ListRolesCommand,
  ListUsersCommand,
} from "@aws-sdk/client-iam";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

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
