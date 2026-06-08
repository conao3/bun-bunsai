import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  CreatePolicyVersionCommand,
  CreateUserCommand,
  DeleteAccessKeyCommand,
  DeletePolicyCommand,
  DeletePolicyVersionCommand,
  DeleteUserCommand,
  GetPolicyVersionCommand,
  IAMClient,
  ListAccessKeysCommand,
  SetDefaultPolicyVersionCommand,
  UpdateAccessKeyCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });

const policyDocument = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:ListBucket", Resource: "*" }],
});

const policyDocumentV2 = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

test("IAM access key lifecycle: create, list, update status, delete", async () => {
  const client = iam();

  await client.send(new CreateUserCommand({ UserName: "e2e-ak-user" }));

  const created = await client.send(
    new CreateAccessKeyCommand({ UserName: "e2e-ak-user" }),
  );
  const accessKeyId = created.AccessKey?.AccessKeyId;
  expect(accessKeyId).toBeDefined();
  expect(created.AccessKey?.SecretAccessKey).toBeDefined();
  expect(created.AccessKey?.Status).toBe("Active");

  const listed = await client.send(
    new ListAccessKeysCommand({ UserName: "e2e-ak-user" }),
  );
  const keyIds = (listed.AccessKeyMetadata ?? []).map((k) => k.AccessKeyId);
  expect(keyIds).toContain(accessKeyId);

  await client.send(
    new UpdateAccessKeyCommand({
      AccessKeyId: accessKeyId,
      Status: "Inactive",
    }),
  );

  const listedInactive = await client.send(
    new ListAccessKeysCommand({ UserName: "e2e-ak-user" }),
  );
  const inactiveKey = (listedInactive.AccessKeyMetadata ?? []).find(
    (k) => k.AccessKeyId === accessKeyId,
  );
  expect(inactiveKey?.Status).toBe("Inactive");

  await client.send(new DeleteAccessKeyCommand({ AccessKeyId: accessKeyId }));

  const listedAfter = await client.send(
    new ListAccessKeysCommand({ UserName: "e2e-ak-user" }),
  );
  const remainingIds = (listedAfter.AccessKeyMetadata ?? []).map(
    (k) => k.AccessKeyId,
  );
  expect(remainingIds).not.toContain(accessKeyId);

  await client.send(new DeleteUserCommand({ UserName: "e2e-ak-user" }));
});

test("IAM CreateAccessKey for missing user → NoSuchEntityException", async () => {
  const client = iam();

  await expect(
    client.send(
      new CreateAccessKeyCommand({ UserName: "e2e-nonexistent-ak-user" }),
    ),
  ).rejects.toMatchObject({ name: "NoSuchEntityException" });
});

test("IAM policy version: SetDefault + GetPolicyVersion returns new doc; deleting default → DeleteConflictException", async () => {
  const client = iam();

  const created = await client.send(
    new CreatePolicyCommand({
      PolicyName: "e2e-pv-deldefault",
      PolicyDocument: policyDocument,
    }),
  );
  const policyArn = created.Policy?.Arn;
  expect(policyArn).toContain(":policy/e2e-pv-deldefault");

  const v2 = await client.send(
    new CreatePolicyVersionCommand({
      PolicyArn: policyArn,
      PolicyDocument: policyDocumentV2,
      SetAsDefault: false,
    }),
  );
  expect(v2.PolicyVersion?.VersionId).toBe("v2");

  await client.send(
    new SetDefaultPolicyVersionCommand({
      PolicyArn: policyArn,
      VersionId: "v2",
    }),
  );

  const gotDefault = await client.send(
    new GetPolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v2" }),
  );
  expect(gotDefault.PolicyVersion?.IsDefaultVersion).toBe(true);
  expect(gotDefault.PolicyVersion?.Document).toContain("s3:GetObject");

  await expect(
    client.send(
      new DeletePolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v2" }),
    ),
  ).rejects.toMatchObject({ name: "DeleteConflictException" });

  await client.send(
    new DeletePolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v1" }),
  );

  await client.send(new DeletePolicyCommand({ PolicyArn: policyArn }));
});
