import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AcceptResourceShareInvitationCommand,
  AssociateResourceShareCommand,
  AssociateResourceSharePermissionCommand,
  CreatePermissionCommand,
  CreatePermissionVersionCommand,
  CreateResourceShareCommand,
  DeletePermissionCommand,
  DeletePermissionVersionCommand,
  DeleteResourceShareCommand,
  DisassociateResourceShareCommand,
  DisassociateResourceSharePermissionCommand,
  EnableSharingWithAwsOrganizationCommand,
  GetPermissionCommand,
  GetResourcePoliciesCommand,
  GetResourceShareAssociationsCommand,
  GetResourceShareInvitationsCommand,
  GetResourceSharesCommand,
  ListPermissionAssociationsCommand,
  ListPermissionVersionsCommand,
  ListPermissionsCommand,
  ListPrincipalsCommand,
  ListReplacePermissionAssociationsWorkCommand,
  ListResourceSharePermissionsCommand,
  ListResourceTypesCommand,
  ListResourcesCommand,
  ListSourceAssociationsCommand,
  PromotePermissionCreatedFromPolicyCommand,
  PromoteResourceShareCreatedFromPolicyCommand,
  RAMClient,
  RejectResourceShareInvitationCommand,
  ReplacePermissionAssociationsCommand,
  SetDefaultPermissionVersionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateResourceShareCommand,
} from "@aws-sdk/client-ram";

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

const ram = () => new RAMClient({ endpoint, region, credentials });

test("RAM resource share roundtrip", async () => {
  const client = ram();
  const name = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(new CreateResourceShareCommand({ name }));
  const arn = created.resourceShare?.resourceShareArn;
  expect(arn).toContain("resource-share/");
  expect(created.resourceShare?.name).toBe(name);
  expect(created.resourceShare?.status).toBe("ACTIVE");

  const got = await client.send(
    new GetResourceSharesCommand({ resourceOwner: "SELF" }),
  );
  const found = (got.resourceShares ?? []).find(
    (share) => share.resourceShareArn === arn,
  );
  expect(found?.name).toBe(name);
  expect(found?.status).toBe("ACTIVE");

  const renamed = `${name}_v2`;
  const updated = await client.send(
    new UpdateResourceShareCommand({
      resourceShareArn: arn,
      name: renamed,
    }),
  );
  expect(updated.resourceShare?.name).toBe(renamed);
  expect(updated.resourceShare?.status).toBe("ACTIVE");

  const deleted = await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: arn }),
  );
  expect(deleted.returnValue).toBe(true);

  const afterDelete = await client.send(
    new GetResourceSharesCommand({ resourceOwner: "SELF" }),
  );
  expect(
    (afterDelete.resourceShares ?? []).map((share) => share.resourceShareArn),
  ).not.toContain(arn);
});

test("RAM AssociateResourceShare and GetResourceShareAssociations", async () => {
  const client = ram();
  const name = `bunsai_assoc_${Date.now()}`;
  const resourceArn = "arn:aws:s3:::my-test-bucket";
  const principal = "123456789012";

  const created = await client.send(new CreateResourceShareCommand({ name }));
  const shareArn = created.resourceShare?.resourceShareArn!;

  const assocResult = await client.send(
    new AssociateResourceShareCommand({
      resourceShareArn: shareArn,
      resourceArns: [resourceArn],
      principals: [principal],
    }),
  );
  expect(assocResult.resourceShareAssociations).toBeDefined();
  expect(assocResult.resourceShareAssociations!.length).toBe(2);

  const resourceAssocs = await client.send(
    new GetResourceShareAssociationsCommand({
      associationType: "RESOURCE",
      resourceShareArns: [shareArn],
    }),
  );
  expect(resourceAssocs.resourceShareAssociations!.length).toBeGreaterThan(0);
  expect(
    resourceAssocs.resourceShareAssociations!.map((a) => a.associatedEntity),
  ).toContain(resourceArn);

  const principalAssocs = await client.send(
    new GetResourceShareAssociationsCommand({
      associationType: "PRINCIPAL",
      resourceShareArns: [shareArn],
    }),
  );
  expect(
    principalAssocs.resourceShareAssociations!.map((a) => a.associatedEntity),
  ).toContain(principal);

  const disassocResult = await client.send(
    new DisassociateResourceShareCommand({
      resourceShareArn: shareArn,
      resourceArns: [resourceArn],
    }),
  );
  expect(disassocResult.resourceShareAssociations).toBeDefined();

  await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: shareArn }),
  );
});

test("RAM ListResources and ListPrincipals", async () => {
  const client = ram();
  const name = `bunsai_list_${Date.now()}`;
  const resourceArn = "arn:aws:s3:::my-list-bucket";
  const principal = "234567890123";

  const created = await client.send(new CreateResourceShareCommand({ name }));
  const shareArn = created.resourceShare?.resourceShareArn!;

  await client.send(
    new AssociateResourceShareCommand({
      resourceShareArn: shareArn,
      resourceArns: [resourceArn],
      principals: [principal],
    }),
  );

  const resources = await client.send(
    new ListResourcesCommand({
      resourceOwner: "SELF",
      resourceShareArns: [shareArn],
    }),
  );
  expect(resources.resources).toBeDefined();
  expect(resources.resources!.map((r) => r.arn)).toContain(resourceArn);

  const principals = await client.send(
    new ListPrincipalsCommand({
      resourceOwner: "SELF",
      resourceShareArns: [shareArn],
    }),
  );
  expect(principals.principals).toBeDefined();
  expect(principals.principals!.map((p) => p.id)).toContain(principal);

  await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: shareArn }),
  );
});

test("RAM ListResourceTypes", async () => {
  const client = ram();
  const result = await client.send(new ListResourceTypesCommand({}));
  expect(result.resourceTypes).toBeDefined();
  expect(Array.isArray(result.resourceTypes)).toBe(true);
});

test("RAM ListSourceAssociations", async () => {
  const client = ram();
  const result = await client.send(new ListSourceAssociationsCommand({}));
  expect(result.sourceAssociations).toBeDefined();
});

test("RAM PromoteResourceShareCreatedFromPolicy", async () => {
  const client = ram();
  const name = `bunsai_promote_${Date.now()}`;
  const created = await client.send(new CreateResourceShareCommand({ name }));
  const shareArn = created.resourceShare?.resourceShareArn!;

  const result = await client.send(
    new PromoteResourceShareCreatedFromPolicyCommand({
      resourceShareArn: shareArn,
    }),
  );
  expect(result.returnValue).toBe(true);

  await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: shareArn }),
  );
});

test("RAM GetResourceShareInvitations", async () => {
  const client = ram();
  const invitationsResult = await client.send(
    new GetResourceShareInvitationsCommand({}),
  );
  expect(invitationsResult.resourceShareInvitations).toBeDefined();
  expect(Array.isArray(invitationsResult.resourceShareInvitations)).toBe(true);
});

test("RAM AcceptResourceShareInvitation and RejectResourceShareInvitation errors", async () => {
  const client = ram();
  const fakeArn =
    "arn:aws:ram:us-east-1:123456789012:resource-share-invitation/nonexistent";
  try {
    await client.send(
      new AcceptResourceShareInvitationCommand({
        resourceShareInvitationArn: fakeArn,
      }),
    );
    expect(false).toBe(true);
  } catch (e: unknown) {
    expect(
      (e as { name: string }).name ===
        "ResourceShareInvitationArnNotFoundException" ||
        (e as { message: string }).message.includes("not found"),
    ).toBe(true);
  }

  try {
    await client.send(
      new RejectResourceShareInvitationCommand({
        resourceShareInvitationArn: fakeArn,
      }),
    );
    expect(false).toBe(true);
  } catch (e: unknown) {
    expect(
      (e as { name: string }).name ===
        "ResourceShareInvitationArnNotFoundException" ||
        (e as { message: string }).message.includes("not found"),
    ).toBe(true);
  }
});

test("RAM Permissions CRUD", async () => {
  const client = ram();
  const permName = `bunsai_perm_${Date.now()}`;

  const created = await client.send(
    new CreatePermissionCommand({
      name: permName,
      resourceType: "ec2:Instance",
      policyTemplate: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );
  expect(created.permission?.name).toBe(permName);
  expect(created.permission?.version).toBe("1");
  const pArn = created.permission?.arn!;

  const fetched = await client.send(
    new GetPermissionCommand({ permissionArn: pArn }),
  );
  expect(fetched.permission?.name).toBe(permName);
  expect(fetched.permission?.arn).toBe(pArn);

  const listed = await client.send(new ListPermissionsCommand({}));
  expect(listed.permissions).toBeDefined();
  const found = listed.permissions!.find((p) => p.arn === pArn);
  expect(found).toBeDefined();

  const v2 = await client.send(
    new CreatePermissionVersionCommand({
      permissionArn: pArn,
      policyTemplate: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow" }],
      }),
    }),
  );
  expect(v2.permission?.version).toBe("2");

  const versions = await client.send(
    new ListPermissionVersionsCommand({ permissionArn: pArn }),
  );
  expect(versions.permissions).toBeDefined();
  expect(versions.permissions!.length).toBe(2);

  const setDefault = await client.send(
    new SetDefaultPermissionVersionCommand({
      permissionArn: pArn,
      permissionVersion: "2",
    }),
  );
  expect(setDefault.returnValue).toBe(true);

  const deleteV2 = await client.send(
    new DeletePermissionVersionCommand({
      permissionArn: pArn,
      permissionVersion: "2",
    }),
  );
  expect(deleteV2.returnValue).toBe(true);

  const deleted = await client.send(
    new DeletePermissionCommand({ permissionArn: pArn }),
  );
  expect(deleted.returnValue).toBe(true);
});

test("RAM AssociateResourceSharePermission and related operations", async () => {
  const client = ram();
  const shareName = `bunsai_shareperm_${Date.now()}`;
  const permName = `bunsai_perm2_${Date.now()}`;

  const share = await client.send(
    new CreateResourceShareCommand({ name: shareName }),
  );
  const shareArn = share.resourceShare?.resourceShareArn!;

  const perm = await client.send(
    new CreatePermissionCommand({
      name: permName,
      resourceType: "s3:Bucket",
      policyTemplate: "{}",
    }),
  );
  const pArn = perm.permission?.arn!;

  const assoc = await client.send(
    new AssociateResourceSharePermissionCommand({
      resourceShareArn: shareArn,
      permissionArn: pArn,
    }),
  );
  expect(assoc.returnValue).toBe(true);

  const sharePerms = await client.send(
    new ListResourceSharePermissionsCommand({ resourceShareArn: shareArn }),
  );
  expect(sharePerms.permissions).toBeDefined();
  expect(sharePerms.permissions!.map((p) => p.arn)).toContain(pArn);

  const permAssocs = await client.send(
    new ListPermissionAssociationsCommand({ permissionArn: pArn }),
  );
  expect(permAssocs.permissions).toBeDefined();

  const disassoc = await client.send(
    new DisassociateResourceSharePermissionCommand({
      resourceShareArn: shareArn,
      permissionArn: pArn,
    }),
  );
  expect(disassoc.returnValue).toBe(true);

  await client.send(new DeletePermissionCommand({ permissionArn: pArn }));
  await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: shareArn }),
  );
});

test("RAM ReplacePermissionAssociations and ListReplacePermissionAssociationsWork", async () => {
  const client = ram();
  const shareName = `bunsai_replace_${Date.now()}`;
  const permName1 = `bunsai_from_${Date.now()}`;
  const permName2 = `bunsai_to_${Date.now()}`;

  const share = await client.send(
    new CreateResourceShareCommand({ name: shareName }),
  );
  const shareArn = share.resourceShare?.resourceShareArn!;

  const p1 = await client.send(
    new CreatePermissionCommand({
      name: permName1,
      resourceType: "ec2:Instance",
      policyTemplate: "{}",
    }),
  );
  const p2 = await client.send(
    new CreatePermissionCommand({
      name: permName2,
      resourceType: "ec2:Instance",
      policyTemplate: "{}",
    }),
  );
  const fromArn = p1.permission?.arn!;
  const toArn = p2.permission?.arn!;

  await client.send(
    new AssociateResourceSharePermissionCommand({
      resourceShareArn: shareArn,
      permissionArn: fromArn,
    }),
  );

  const replaceResult = await client.send(
    new ReplacePermissionAssociationsCommand({
      fromPermissionArn: fromArn,
      toPermissionArn: toArn,
    }),
  );
  expect(replaceResult.replacePermissionAssociationsWork).toBeDefined();
  const workId = replaceResult.replacePermissionAssociationsWork?.id!;

  const works = await client.send(
    new ListReplacePermissionAssociationsWorkCommand({ workIds: [workId] }),
  );
  expect(works.replacePermissionAssociationsWorks).toBeDefined();
  expect(works.replacePermissionAssociationsWorks!.map((w) => w.id)).toContain(
    workId,
  );

  await client.send(new DeletePermissionCommand({ permissionArn: fromArn }));
  await client.send(new DeletePermissionCommand({ permissionArn: toArn }));
  await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: shareArn }),
  );
});

test("RAM PromotePermissionCreatedFromPolicy", async () => {
  const client = ram();
  const permName = `bunsai_promote_perm_${Date.now()}`;

  const perm = await client.send(
    new CreatePermissionCommand({
      name: permName,
      resourceType: "ec2:Instance",
      policyTemplate: "{}",
    }),
  );
  const pArn = perm.permission?.arn!;

  const result = await client.send(
    new PromotePermissionCreatedFromPolicyCommand({
      permissionArn: pArn,
      name: `${permName}_promoted`,
    }),
  );
  expect(result.permission).toBeDefined();

  await client.send(new DeletePermissionCommand({ permissionArn: pArn }));
});

test("RAM GetResourcePolicies", async () => {
  const client = ram();
  const result = await client.send(
    new GetResourcePoliciesCommand({
      resourceArns: ["arn:aws:s3:::nonexistent-bucket"],
    }),
  );
  expect(result.policies).toBeDefined();
  expect(Array.isArray(result.policies)).toBe(true);
});

test("RAM EnableSharingWithAwsOrganization", async () => {
  const client = ram();
  const result = await client.send(
    new EnableSharingWithAwsOrganizationCommand({}),
  );
  expect(result.returnValue).toBe(true);
});

test("RAM TagResource and UntagResource", async () => {
  const client = ram();
  const name = `bunsai_tag_${Date.now()}`;

  const created = await client.send(new CreateResourceShareCommand({ name }));
  const shareArn = created.resourceShare?.resourceShareArn!;

  await client.send(
    new TagResourceCommand({
      resourceShareArn: shareArn,
      tags: [
        { key: "env", value: "test" },
        { key: "team", value: "platform" },
      ],
    }),
  );

  const got = await client.send(
    new GetResourceSharesCommand({ resourceOwner: "SELF" }),
  );
  const found = (got.resourceShares ?? []).find(
    (s) => s.resourceShareArn === shareArn,
  );
  const tagKeys = (found?.tags ?? []).map((t) => t.key);
  expect(tagKeys).toContain("env");
  expect(tagKeys).toContain("team");

  await client.send(
    new UntagResourceCommand({
      resourceShareArn: shareArn,
      tagKeys: ["env"],
    }),
  );

  const got2 = await client.send(
    new GetResourceSharesCommand({ resourceOwner: "SELF" }),
  );
  const found2 = (got2.resourceShares ?? []).find(
    (s) => s.resourceShareArn === shareArn,
  );
  const tagKeys2 = (found2?.tags ?? []).map((t) => t.key);
  expect(tagKeys2).not.toContain("env");
  expect(tagKeys2).toContain("team");

  await client.send(
    new DeleteResourceShareCommand({ resourceShareArn: shareArn }),
  );
});
