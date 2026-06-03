import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
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

const awsPort = 4791;
const uiPort = 5791;
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
