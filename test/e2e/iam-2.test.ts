import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddUserToGroupCommand,
  CreateGroupCommand,
  CreatePolicyCommand,
  CreatePolicyVersionCommand,
  CreateServiceLinkedRoleCommand,
  CreateUserCommand,
  DeleteGroupCommand,
  GetGroupCommand,
  GetPolicyVersionCommand,
  IAMClient,
  ListGroupsCommand,
  ListPolicyVersionsCommand,
  RemoveUserFromGroupCommand,
} from "@aws-sdk/client-iam";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const iam = () =>
  new IAMClient({ endpoint, region, credentials, requestHandler });

const managedPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:ListBucket", Resource: "*" }],
});

const updatedPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

test("IAM group membership lifecycle", async () => {
  const client = iam();

  const createdGroup = await client.send(
    new CreateGroupCommand({ GroupName: "bunsai-e2e-group" }),
  );
  const groupArn = createdGroup.Group?.Arn;
  expect(groupArn).toContain(":group/bunsai-e2e-group");
  expect(createdGroup.Group?.GroupId).toBeDefined();

  const listedGroups = await client.send(new ListGroupsCommand({}));
  const groupNames = (listedGroups.Groups ?? []).map((g) => g.GroupName);
  expect(groupNames).toContain("bunsai-e2e-group");

  await client.send(new CreateUserCommand({ UserName: "bunsai-e2e-member" }));

  await client.send(
    new AddUserToGroupCommand({
      GroupName: "bunsai-e2e-group",
      UserName: "bunsai-e2e-member",
    }),
  );

  const gotGroup = await client.send(
    new GetGroupCommand({ GroupName: "bunsai-e2e-group" }),
  );
  expect(gotGroup.Group?.GroupName).toBe("bunsai-e2e-group");
  const memberNames = (gotGroup.Users ?? []).map((u) => u.UserName);
  expect(memberNames).toContain("bunsai-e2e-member");

  await client.send(
    new RemoveUserFromGroupCommand({
      GroupName: "bunsai-e2e-group",
      UserName: "bunsai-e2e-member",
    }),
  );

  const afterRemove = await client.send(
    new GetGroupCommand({ GroupName: "bunsai-e2e-group" }),
  );
  const afterNames = (afterRemove.Users ?? []).map((u) => u.UserName);
  expect(afterNames).not.toContain("bunsai-e2e-member");

  await client.send(new DeleteGroupCommand({ GroupName: "bunsai-e2e-group" }));
  const groupsAfter = await client.send(new ListGroupsCommand({}));
  const groupsAfterNames = (groupsAfter.Groups ?? []).map((g) => g.GroupName);
  expect(groupsAfterNames).not.toContain("bunsai-e2e-group");
});

test("IAM policy version lifecycle", async () => {
  const client = iam();

  const createdPolicy = await client.send(
    new CreatePolicyCommand({
      PolicyName: "bunsai-e2e-policy-versioned",
      PolicyDocument: managedPolicy,
    }),
  );
  const policyArn = createdPolicy.Policy?.Arn;
  expect(policyArn).toBeDefined();

  const createdVersion = await client.send(
    new CreatePolicyVersionCommand({
      PolicyArn: policyArn,
      PolicyDocument: updatedPolicy,
      SetAsDefault: true,
    }),
  );
  const versionId = createdVersion.PolicyVersion?.VersionId;
  expect(versionId).toBe("v2");
  expect(createdVersion.PolicyVersion?.IsDefaultVersion).toBe(true);

  const listed = await client.send(
    new ListPolicyVersionsCommand({ PolicyArn: policyArn }),
  );
  const versionIds = (listed.Versions ?? []).map((v) => v.VersionId);
  expect(versionIds).toContain("v1");
  expect(versionIds).toContain("v2");

  const gotVersion = await client.send(
    new GetPolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v2" }),
  );
  expect(gotVersion.PolicyVersion?.VersionId).toBe("v2");
  expect(gotVersion.PolicyVersion?.Document).toBe(updatedPolicy);
  expect(gotVersion.PolicyVersion?.IsDefaultVersion).toBe(true);
});

test("IAM service-linked role creation", async () => {
  const client = iam();

  const created = await client.send(
    new CreateServiceLinkedRoleCommand({
      AWSServiceName: "elasticbeanstalk.amazonaws.com",
    }),
  );
  expect(created.Role?.RoleName).toBe("AWSServiceRoleForelasticbeanstalk");
  expect(created.Role?.Arn).toContain(
    ":role/aws-service-role/elasticbeanstalk.amazonaws.com/",
  );
  expect(created.Role?.Path).toBe(
    "/aws-service-role/elasticbeanstalk.amazonaws.com/",
  );
});
