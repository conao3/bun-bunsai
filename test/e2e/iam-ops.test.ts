import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddRoleToInstanceProfileCommand,
  AttachRolePolicyCommand,
  CreateInstanceProfileCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  DeleteRolePolicyCommand,
  GetInstanceProfileCommand,
  GetRolePolicyCommand,
  IAMClient,
  ListEntitiesForPolicyCommand,
  ListRolePoliciesCommand,
  ListRoleTagsCommand,
  PutRolePolicyCommand,
  TagRoleCommand,
} from "@aws-sdk/client-iam";

const awsPort = 4571;
const uiPort = 5671;
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

const inlinePolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

const managedPolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:ListBucket", Resource: "*" }],
});

test("IAM inline role policy lifecycle", async () => {
  const client = iam();

  await client.send(new CreateRoleCommand({ RoleName: "ops-inline-role" }));

  await client.send(
    new PutRolePolicyCommand({
      RoleName: "ops-inline-role",
      PolicyName: "inline-one",
      PolicyDocument: inlinePolicy,
    }),
  );

  const got = await client.send(
    new GetRolePolicyCommand({
      RoleName: "ops-inline-role",
      PolicyName: "inline-one",
    }),
  );
  expect(got.RoleName).toBe("ops-inline-role");
  expect(got.PolicyName).toBe("inline-one");
  expect(got.PolicyDocument).toBe(inlinePolicy);

  const listed = await client.send(
    new ListRolePoliciesCommand({ RoleName: "ops-inline-role" }),
  );
  expect(listed.PolicyNames ?? []).toContain("inline-one");

  await client.send(
    new DeleteRolePolicyCommand({
      RoleName: "ops-inline-role",
      PolicyName: "inline-one",
    }),
  );

  const listedAfter = await client.send(
    new ListRolePoliciesCommand({ RoleName: "ops-inline-role" }),
  );
  expect(listedAfter.PolicyNames ?? []).not.toContain("inline-one");
});

test("IAM instance profile lifecycle", async () => {
  const client = iam();

  await client.send(new CreateRoleCommand({ RoleName: "ops-profile-role" }));

  const created = await client.send(
    new CreateInstanceProfileCommand({
      InstanceProfileName: "ops-profile",
    }),
  );
  expect(created.InstanceProfile?.InstanceProfileName).toBe("ops-profile");
  expect(created.InstanceProfile?.Arn).toContain(
    ":instance-profile/ops-profile",
  );

  await client.send(
    new AddRoleToInstanceProfileCommand({
      InstanceProfileName: "ops-profile",
      RoleName: "ops-profile-role",
    }),
  );

  const got = await client.send(
    new GetInstanceProfileCommand({ InstanceProfileName: "ops-profile" }),
  );
  const roleNames = (got.InstanceProfile?.Roles ?? []).map((r) => r.RoleName);
  expect(roleNames).toContain("ops-profile-role");
});

test("IAM ListEntitiesForPolicy reports attached roles", async () => {
  const client = iam();

  await client.send(new CreateRoleCommand({ RoleName: "ops-entity-role" }));

  const createdPolicy = await client.send(
    new CreatePolicyCommand({
      PolicyName: "ops-entity-policy",
      PolicyDocument: managedPolicy,
    }),
  );
  const policyArn = createdPolicy.Policy?.Arn;
  expect(policyArn).toBeDefined();

  await client.send(
    new AttachRolePolicyCommand({
      RoleName: "ops-entity-role",
      PolicyArn: policyArn,
    }),
  );

  const entities = await client.send(
    new ListEntitiesForPolicyCommand({ PolicyArn: policyArn }),
  );
  const policyRoleNames = (entities.PolicyRoles ?? []).map((r) => r.RoleName);
  expect(policyRoleNames).toContain("ops-entity-role");
});

test("IAM role tagging", async () => {
  const client = iam();

  await client.send(new CreateRoleCommand({ RoleName: "ops-tag-role" }));

  await client.send(
    new TagRoleCommand({
      RoleName: "ops-tag-role",
      Tags: [
        { Key: "env", Value: "dev" },
        { Key: "team", Value: "platform" },
      ],
    }),
  );

  const listed = await client.send(
    new ListRoleTagsCommand({ RoleName: "ops-tag-role" }),
  );
  const tags = listed.Tags ?? [];
  const env = tags.find((t) => t.Key === "env");
  expect(env?.Value).toBe("dev");
  const team = tags.find((t) => t.Key === "team");
  expect(team?.Value).toBe("platform");
});
