import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AddClientIDToOpenIDConnectProviderCommand,
  AddRoleToInstanceProfileCommand,
  CreateInstanceProfileCommand,
  CreateOpenIDConnectProviderCommand,
  CreatePolicyCommand,
  CreatePolicyVersionCommand,
  CreateRoleCommand,
  DeleteInstanceProfileCommand,
  DeleteOpenIDConnectProviderCommand,
  DeletePolicyCommand,
  DeletePolicyVersionCommand,
  DetachRolePolicyCommand,
  GetOpenIDConnectProviderCommand,
  IAMClient,
  ListInstanceProfilesCommand,
  ListInstanceProfilesForRoleCommand,
  ListOpenIDConnectProvidersCommand,
  ListOpenIDConnectProviderTagsCommand,
  ListPolicyTagsCommand,
  RemoveClientIDFromOpenIDConnectProviderCommand,
  RemoveRoleFromInstanceProfileCommand,
  SetDefaultPolicyVersionCommand,
  TagOpenIDConnectProviderCommand,
  TagPolicyCommand,
  UntagPolicyCommand,
} from "@aws-sdk/client-iam";

const awsPort = 4901;
const uiPort = 5901;
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

const policyDocument = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:ListBucket", Resource: "*" }],
});

const policyDocumentV2 = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{ Effect: "Allow", Action: "s3:GetObject", Resource: "*" }],
});

test("IAM managed-policy lifecycle: create, version, tag, delete", async () => {
  const client = iam();

  const created = await client.send(
    new CreatePolicyCommand({
      PolicyName: "e2e-policy-part2a",
      PolicyDocument: policyDocument,
    }),
  );
  const policyArn = created.Policy?.Arn;
  expect(policyArn).toContain(":policy/e2e-policy-part2a");

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

  await client.send(
    new TagPolicyCommand({
      PolicyArn: policyArn,
      Tags: [{ Key: "Env", Value: "test" }],
    }),
  );

  const listed = await client.send(
    new ListPolicyTagsCommand({ PolicyArn: policyArn }),
  );
  expect((listed.Tags ?? []).map((t) => t.Key)).toContain("Env");

  await client.send(
    new UntagPolicyCommand({ PolicyArn: policyArn, TagKeys: ["Env"] }),
  );

  const afterUntag = await client.send(
    new ListPolicyTagsCommand({ PolicyArn: policyArn }),
  );
  expect((afterUntag.Tags ?? []).map((t) => t.Key)).not.toContain("Env");

  await client.send(
    new DeletePolicyVersionCommand({ PolicyArn: policyArn, VersionId: "v1" }),
  );

  await client.send(new DeletePolicyCommand({ PolicyArn: policyArn }));
});

test("IAM instance-profile lifecycle: create, attach-role, list, detach, delete", async () => {
  const client = iam();

  await client.send(
    new CreateRoleCommand({
      RoleName: "e2e-role-part2a",
      AssumeRolePolicyDocument: policyDocument,
    }),
  );

  const createdProfile = await client.send(
    new CreateInstanceProfileCommand({
      InstanceProfileName: "e2e-instance-profile-part2a",
    }),
  );
  expect(createdProfile.InstanceProfile?.InstanceProfileName).toBe(
    "e2e-instance-profile-part2a",
  );

  await client.send(
    new AddRoleToInstanceProfileCommand({
      InstanceProfileName: "e2e-instance-profile-part2a",
      RoleName: "e2e-role-part2a",
    }),
  );

  const listedAll = await client.send(new ListInstanceProfilesCommand({}));
  const names = (listedAll.InstanceProfiles ?? []).map(
    (p) => p.InstanceProfileName,
  );
  expect(names).toContain("e2e-instance-profile-part2a");

  const listedForRole = await client.send(
    new ListInstanceProfilesForRoleCommand({ RoleName: "e2e-role-part2a" }),
  );
  const profileNamesForRole = (listedForRole.InstanceProfiles ?? []).map(
    (p) => p.InstanceProfileName,
  );
  expect(profileNamesForRole).toContain("e2e-instance-profile-part2a");

  await client.send(
    new RemoveRoleFromInstanceProfileCommand({
      InstanceProfileName: "e2e-instance-profile-part2a",
      RoleName: "e2e-role-part2a",
    }),
  );

  await client.send(
    new DeleteInstanceProfileCommand({
      InstanceProfileName: "e2e-instance-profile-part2a",
    }),
  );

  const listedAfter = await client.send(new ListInstanceProfilesCommand({}));
  const namesAfter = (listedAfter.InstanceProfiles ?? []).map(
    (p) => p.InstanceProfileName,
  );
  expect(namesAfter).not.toContain("e2e-instance-profile-part2a");
});

test("IAM OIDC provider lifecycle: create, update, tag, list, delete", async () => {
  const client = iam();

  const created = await client.send(
    new CreateOpenIDConnectProviderCommand({
      Url: "https://token.actions.githubusercontent.com",
      ThumbprintList: ["aabbccdd1122"],
      ClientIDList: ["sts.amazonaws.com"],
    }),
  );
  const arn = created.OpenIDConnectProviderArn;
  expect(arn).toContain(":oidc-provider/token.actions.githubusercontent.com");

  await client.send(
    new AddClientIDToOpenIDConnectProviderCommand({
      OpenIDConnectProviderArn: arn,
      ClientID: "extra-client",
    }),
  );

  const got = await client.send(
    new GetOpenIDConnectProviderCommand({ OpenIDConnectProviderArn: arn }),
  );
  expect(got.ClientIDList).toContain("extra-client");
  expect(got.ClientIDList).toContain("sts.amazonaws.com");

  await client.send(
    new RemoveClientIDFromOpenIDConnectProviderCommand({
      OpenIDConnectProviderArn: arn,
      ClientID: "extra-client",
    }),
  );

  const gotAfter = await client.send(
    new GetOpenIDConnectProviderCommand({ OpenIDConnectProviderArn: arn }),
  );
  expect(gotAfter.ClientIDList).not.toContain("extra-client");

  await client.send(
    new TagOpenIDConnectProviderCommand({
      OpenIDConnectProviderArn: arn,
      Tags: [{ Key: "Purpose", Value: "CI" }],
    }),
  );

  const tags = await client.send(
    new ListOpenIDConnectProviderTagsCommand({ OpenIDConnectProviderArn: arn }),
  );
  expect((tags.Tags ?? []).map((t) => t.Key)).toContain("Purpose");

  const listedProviders = await client.send(
    new ListOpenIDConnectProvidersCommand({}),
  );
  const arns = (listedProviders.OpenIDConnectProviderList ?? []).map(
    (p) => p.Arn,
  );
  expect(arns).toContain(arn);

  await client.send(
    new DeleteOpenIDConnectProviderCommand({ OpenIDConnectProviderArn: arn }),
  );

  const listedAfter = await client.send(
    new ListOpenIDConnectProvidersCommand({}),
  );
  const arnsAfter = (listedAfter.OpenIDConnectProviderList ?? []).map(
    (p) => p.Arn,
  );
  expect(arnsAfter).not.toContain(arn);
});
