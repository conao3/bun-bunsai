import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreatePolicyCommand,
  CreateRoleCommand,
  CreateUserCommand,
  GetAccountAuthorizationDetailsCommand,
  GetRoleCommand,
  IAMClient,
  UpdateAssumeRolePolicyCommand,
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

const updatedTrustPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "lambda.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
});

test("IAM role trust policy round-trip", async () => {
  const client = iam();

  await client.send(
    new CreateRoleCommand({
      RoleName: "trust-role-9",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );

  const got = await client.send(
    new GetRoleCommand({ RoleName: "trust-role-9" }),
  );
  expect(got.Role?.RoleName).toBe("trust-role-9");
  expect(got.Role?.AssumeRolePolicyDocument).toBe(trustPolicy);

  await client.send(
    new UpdateAssumeRolePolicyCommand({
      RoleName: "trust-role-9",
      PolicyDocument: updatedTrustPolicy,
    }),
  );

  const updated = await client.send(
    new GetRoleCommand({ RoleName: "trust-role-9" }),
  );
  expect(updated.Role?.AssumeRolePolicyDocument).toBe(updatedTrustPolicy);
});

test("IAM GetAccountAuthorizationDetails snapshot", async () => {
  const client = iam();

  await client.send(
    new CreateRoleCommand({
      RoleName: "auth-detail-role-9",
      AssumeRolePolicyDocument: trustPolicy,
    }),
  );

  await client.send(new CreateUserCommand({ UserName: "auth-detail-user-9" }));

  const policyDoc = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
  });
  const createdPolicy = await client.send(
    new CreatePolicyCommand({
      PolicyName: "auth-detail-policy-9",
      PolicyDocument: policyDoc,
    }),
  );
  const policyArn = createdPolicy.Policy?.Arn;
  expect(policyArn).toBeDefined();

  const details = await client.send(
    new GetAccountAuthorizationDetailsCommand({}),
  );

  const roleNames = (details.RoleDetailList ?? []).map((r) => r.RoleName);
  expect(roleNames).toContain("auth-detail-role-9");

  const roleDetail = (details.RoleDetailList ?? []).find(
    (r) => r.RoleName === "auth-detail-role-9",
  );
  expect(roleDetail?.AssumeRolePolicyDocument).toBe(trustPolicy);

  const userNames = (details.UserDetailList ?? []).map((u) => u.UserName);
  expect(userNames).toContain("auth-detail-user-9");

  const policyNames = (details.Policies ?? []).map((p) => p.PolicyName);
  expect(policyNames).toContain("auth-detail-policy-9");
});
