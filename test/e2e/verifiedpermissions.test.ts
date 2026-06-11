import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  BatchIsAuthorizedCommand,
  BatchIsAuthorizedWithTokenCommand,
  CreateIdentitySourceCommand,
  CreatePolicyCommand,
  CreatePolicyStoreAliasCommand,
  CreatePolicyStoreCommand,
  CreatePolicyTemplateCommand,
  DeleteIdentitySourceCommand,
  DeletePolicyCommand,
  DeletePolicyStoreAliasCommand,
  DeletePolicyStoreCommand,
  DeletePolicyTemplateCommand,
  GetIdentitySourceCommand,
  GetPolicyCommand,
  GetPolicyStoreAliasCommand,
  GetPolicyStoreCommand,
  GetPolicyTemplateCommand,
  IsAuthorizedCommand,
  IsAuthorizedWithTokenCommand,
  ListIdentitySourcesCommand,
  ListPoliciesCommand,
  ListPolicyStoreAliasesCommand,
  ListPolicyStoresCommand,
  ListPolicyTemplatesCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdatePolicyStoreCommand,
  VerifiedPermissionsClient,
} from "@aws-sdk/client-verifiedpermissions";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const vp = () =>
  new VerifiedPermissionsClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("VerifiedPermissions PolicyStore CRUD", async () => {
  const client = vp();

  const created = await client.send(
    new CreatePolicyStoreCommand({
      validationSettings: { mode: "OFF" },
      description: "test store",
    }),
  );
  expect(created.policyStoreId).toBeDefined();
  expect(created.arn).toContain("policy-store/");

  const storeId = created.policyStoreId!;

  const got = await client.send(
    new GetPolicyStoreCommand({ policyStoreId: storeId }),
  );
  expect(got.policyStoreId).toBe(storeId);
  expect(got.validationSettings?.mode).toBe("OFF");
  expect(got.description).toBe("test store");

  const updated = await client.send(
    new UpdatePolicyStoreCommand({
      policyStoreId: storeId,
      validationSettings: { mode: "STRICT" },
    }),
  );
  expect(updated.policyStoreId).toBe(storeId);

  const listed = await client.send(new ListPolicyStoresCommand({}));
  expect(listed.policyStores?.some((s) => s.policyStoreId === storeId)).toBe(
    true,
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));

  const listed2 = await client.send(new ListPolicyStoresCommand({}));
  expect(listed2.policyStores?.some((s) => s.policyStoreId === storeId)).toBe(
    false,
  );
});

test("VerifiedPermissions Policy CRUD + IsAuthorized ALLOW/DENY", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  const permitPolicy = await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'permit(principal == User::"alice", action == Action::"view", resource == Document::"doc1");',
          description: "allow alice to view doc1",
        },
      },
    }),
  );
  expect(permitPolicy.policyId).toBeDefined();
  expect(permitPolicy.policyType).toBe("STATIC");

  const got = await client.send(
    new GetPolicyCommand({
      policyStoreId: storeId,
      policyId: permitPolicy.policyId!,
    }),
  );
  expect(got.policyId).toBe(permitPolicy.policyId);

  const listed = await client.send(
    new ListPoliciesCommand({ policyStoreId: storeId }),
  );
  expect(listed.policies?.length).toBe(1);

  const allowResult = await client.send(
    new IsAuthorizedCommand({
      policyStoreId: storeId,
      principal: { entityType: "User", entityId: "alice" },
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Document", entityId: "doc1" },
    }),
  );
  expect(allowResult.decision).toBe("ALLOW");
  expect(allowResult.determiningPolicies?.length).toBe(1);
  expect(allowResult.determiningPolicies![0].policyId).toBe(
    permitPolicy.policyId,
  );

  const denyResult = await client.send(
    new IsAuthorizedCommand({
      policyStoreId: storeId,
      principal: { entityType: "User", entityId: "bob" },
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Document", entityId: "doc1" },
    }),
  );
  expect(denyResult.decision).toBe("DENY");
  expect(denyResult.determiningPolicies?.length).toBe(0);

  await client.send(
    new DeletePolicyCommand({
      policyStoreId: storeId,
      policyId: permitPolicy.policyId!,
    }),
  );

  const listed2 = await client.send(
    new ListPoliciesCommand({ policyStoreId: storeId }),
  );
  expect(listed2.policies?.length).toBe(0);

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VerifiedPermissions forbid takes priority over permit", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  const permitPolicy = await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'permit(principal == User::"alice", action == Action::"view", resource == Document::"doc1");',
        },
      },
    }),
  );

  const forbidPolicy = await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'forbid(principal == User::"alice", action == Action::"view", resource == Document::"doc1");',
        },
      },
    }),
  );

  const result = await client.send(
    new IsAuthorizedCommand({
      policyStoreId: storeId,
      principal: { entityType: "User", entityId: "alice" },
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Document", entityId: "doc1" },
    }),
  );
  expect(result.decision).toBe("DENY");
  expect(result.determiningPolicies![0].policyId).toBe(forbidPolicy.policyId);
  expect(result.determiningPolicies!.map((p) => p.policyId)).not.toContain(
    permitPolicy.policyId,
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VerifiedPermissions BatchIsAuthorized", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'permit(principal == User::"alice", action == Action::"read", resource == Resource::"r1");',
        },
      },
    }),
  );

  const batch = await client.send(
    new BatchIsAuthorizedCommand({
      policyStoreId: storeId,
      requests: [
        {
          principal: { entityType: "User", entityId: "alice" },
          action: { actionType: "Action", actionId: "read" },
          resource: { entityType: "Resource", entityId: "r1" },
        },
        {
          principal: { entityType: "User", entityId: "bob" },
          action: { actionType: "Action", actionId: "read" },
          resource: { entityType: "Resource", entityId: "r1" },
        },
      ],
    }),
  );

  expect(batch.results?.length).toBe(2);
  expect(batch.results![0].decision).toBe("ALLOW");
  expect(batch.results![1].decision).toBe("DENY");

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VerifiedPermissions PolicyTemplate CRUD", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  const tmpl = await client.send(
    new CreatePolicyTemplateCommand({
      policyStoreId: storeId,
      statement:
        'permit(principal == ?principal, action == Action::"view", resource == ?resource);',
      description: "template1",
    }),
  );
  expect(tmpl.policyTemplateId).toBeDefined();

  const got = await client.send(
    new GetPolicyTemplateCommand({
      policyStoreId: storeId,
      policyTemplateId: tmpl.policyTemplateId!,
    }),
  );
  expect(got.description).toBe("template1");

  const listed = await client.send(
    new ListPolicyTemplatesCommand({ policyStoreId: storeId }),
  );
  expect(listed.policyTemplates?.length).toBe(1);

  await client.send(
    new DeletePolicyTemplateCommand({
      policyStoreId: storeId,
      policyTemplateId: tmpl.policyTemplateId!,
    }),
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VerifiedPermissions IdentitySource CRUD", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  const src = await client.send(
    new CreateIdentitySourceCommand({
      policyStoreId: storeId,
      configuration: {
        cognitoUserPoolConfiguration: {
          userPoolArn:
            "arn:aws:cognito-idp:us-east-1:000000000000:userpool/us-east-1_test",
          clientIds: [],
        },
      },
      principalEntityType: "User",
    }),
  );
  expect(src.identitySourceId).toBeDefined();

  const got = await client.send(
    new GetIdentitySourceCommand({
      policyStoreId: storeId,
      identitySourceId: src.identitySourceId!,
    }),
  );
  expect(got.principalEntityType).toBe("User");

  const listed = await client.send(
    new ListIdentitySourcesCommand({ policyStoreId: storeId }),
  );
  expect(listed.identitySources?.length).toBe(1);

  await client.send(
    new DeleteIdentitySourceCommand({
      policyStoreId: storeId,
      identitySourceId: src.identitySourceId!,
    }),
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VerifiedPermissions PolicyStoreAlias CRUD", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  const alias = await client.send(
    new CreatePolicyStoreAliasCommand({
      aliasName: `policy-store-alias/e2e-test-alias-${storeId}`,
      policyStoreId: storeId,
    }),
  );
  expect(alias.aliasArn).toContain("policy-store-alias/");

  const got = await client.send(
    new GetPolicyStoreAliasCommand({
      aliasName: `policy-store-alias/e2e-test-alias-${storeId}`,
    }),
  );
  expect(got.policyStoreId).toBe(storeId);

  const listed = await client.send(
    new ListPolicyStoreAliasesCommand({ filter: { policyStoreId: storeId } }),
  );
  expect(listed.policyStoreAliases?.length).toBe(1);

  await client.send(
    new DeletePolicyStoreAliasCommand({
      aliasName: `policy-store-alias/e2e-test-alias-${storeId}`,
    }),
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VerifiedPermissions tags", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({
      validationSettings: { mode: "OFF" },
      tags: { env: "test" },
    }),
  );
  const arn = store.arn!;

  const tags = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(tags.tags?.env).toBe("test");

  await client.send(
    new TagResourceCommand({ resourceArn: arn, tags: { project: "bunsai" } }),
  );

  const tags2 = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(tags2.tags?.project).toBe("bunsai");
  expect(tags2.tags?.env).toBe("test");

  await client.send(
    new UntagResourceCommand({ resourceArn: arn, tagKeys: ["env"] }),
  );

  const tags3 = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(tags3.tags?.env).toBeUndefined();
  expect(tags3.tags?.project).toBe("bunsai");

  await client.send(
    new DeletePolicyStoreCommand({ policyStoreId: store.policyStoreId! }),
  );
});

test("VP-1: DeletePolicyStore deletionProtection", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({
      validationSettings: { mode: "OFF" },
      deletionProtection: "ENABLED",
    }),
  );
  const storeId = store.policyStoreId!;

  await expect(
    client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId })),
  ).rejects.toThrow();

  let rejected = false;
  try {
    await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
  } catch (e: unknown) {
    const err = e as { name?: string };
    expect(err.name).toBe("InvalidStateException");
    rejected = true;
  }
  expect(rejected).toBe(true);

  await client.send(
    new UpdatePolicyStoreCommand({
      policyStoreId: storeId,
      validationSettings: { mode: "OFF" },
      deletionProtection: "DISABLED",
    }),
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));

  const listed = await client.send(new ListPolicyStoresCommand({}));
  expect(listed.policyStores?.some((s) => s.policyStoreId === storeId)).toBe(
    false,
  );
});

test("VP-1: DeletePolicyStore cleans up child resources", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'permit(principal == User::"alice", action == Action::"view", resource == Document::"doc1");',
        },
      },
    }),
  );

  await client.send(
    new CreatePolicyTemplateCommand({
      policyStoreId: storeId,
      statement:
        'permit(principal == ?principal, action == Action::"view", resource == ?resource);',
    }),
  );

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));

  const listed = await client.send(new ListPolicyStoresCommand({}));
  expect(listed.policyStores?.some((s) => s.policyStoreId === storeId)).toBe(
    false,
  );
});

test("VP-2: template-linked policy authorization", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  const tmpl = await client.send(
    new CreatePolicyTemplateCommand({
      policyStoreId: storeId,
      statement:
        'permit(principal == ?principal, action == Action::"view", resource == ?resource);',
    }),
  );
  const templateId = tmpl.policyTemplateId!;

  const tlinked = await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        templateLinked: {
          policyTemplateId: templateId,
          principal: { entityType: "User", entityId: "alice" },
          resource: { entityType: "Document", entityId: "doc1" },
        },
      },
    }),
  );
  expect(tlinked.policyType).toBe("TEMPLATE_LINKED");

  const allow = await client.send(
    new IsAuthorizedCommand({
      policyStoreId: storeId,
      principal: { entityType: "User", entityId: "alice" },
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Document", entityId: "doc1" },
    }),
  );
  expect(allow.decision).toBe("ALLOW");
  expect(
    allow.determiningPolicies?.some((p) => p.policyId === tlinked.policyId),
  ).toBe(true);

  const deny = await client.send(
    new IsAuthorizedCommand({
      policyStoreId: storeId,
      principal: { entityType: "User", entityId: "bob" },
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Document", entityId: "doc1" },
    }),
  );
  expect(deny.decision).toBe("DENY");

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VP-2: wildcard permit(principal, action, resource) grants ALLOW", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement: "permit(principal, action, resource);",
        },
      },
    }),
  );

  const result = await client.send(
    new IsAuthorizedCommand({
      policyStoreId: storeId,
      principal: { entityType: "AnyUser", entityId: "anyone" },
      action: { actionType: "AnyAction", actionId: "anything" },
      resource: { entityType: "AnyResource", entityId: "anything" },
    }),
  );
  expect(result.decision).toBe("ALLOW");

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VP-3: IsAuthorizedWithToken JWT decode + policy evaluation", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  await client.send(
    new CreateIdentitySourceCommand({
      policyStoreId: storeId,
      configuration: {
        cognitoUserPoolConfiguration: {
          userPoolArn:
            "arn:aws:cognito-idp:us-east-1:000000000000:userpool/us-east-1_test",
          clientIds: [],
        },
      },
      principalEntityType: "MyApp::User",
    }),
  );

  await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'permit(principal == MyApp::User::"sub-123", action == Action::"view", resource == Doc::"d1");',
        },
      },
    }),
  );

  const jwtPayload = btoa(JSON.stringify({ sub: "sub-123" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const jwtHeader = btoa(JSON.stringify({ alg: "none" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const token = `${jwtHeader}.${jwtPayload}.`;

  const allowResult = await client.send(
    new IsAuthorizedWithTokenCommand({
      policyStoreId: storeId,
      identityToken: token,
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Doc", entityId: "d1" },
    }),
  );
  expect(allowResult.decision).toBe("ALLOW");
  expect(allowResult.principal?.entityId).toBe("sub-123");
  expect(allowResult.determiningPolicies?.length).toBeGreaterThan(0);

  const denyPayload = btoa(JSON.stringify({ sub: "other-sub" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const denyToken = `${jwtHeader}.${denyPayload}.`;

  const denyResult = await client.send(
    new IsAuthorizedWithTokenCommand({
      policyStoreId: storeId,
      identityToken: denyToken,
      action: { actionType: "Action", actionId: "view" },
      resource: { entityType: "Doc", entityId: "d1" },
    }),
  );
  expect(denyResult.decision).toBe("DENY");

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});

test("VP-3: BatchIsAuthorizedWithToken per-request evaluation", async () => {
  const client = vp();

  const store = await client.send(
    new CreatePolicyStoreCommand({ validationSettings: { mode: "OFF" } }),
  );
  const storeId = store.policyStoreId!;

  await client.send(
    new CreateIdentitySourceCommand({
      policyStoreId: storeId,
      configuration: {
        cognitoUserPoolConfiguration: {
          userPoolArn:
            "arn:aws:cognito-idp:us-east-1:000000000000:userpool/us-east-1_test",
          clientIds: [],
        },
      },
      principalEntityType: "MyApp::User",
    }),
  );

  await client.send(
    new CreatePolicyCommand({
      policyStoreId: storeId,
      definition: {
        static: {
          statement:
            'permit(principal == MyApp::User::"sub-abc", action == Action::"read", resource == Doc::"file1");',
        },
      },
    }),
  );

  const jwtPayload = btoa(JSON.stringify({ sub: "sub-abc" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const jwtHeader = btoa(JSON.stringify({ alg: "none" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const token = `${jwtHeader}.${jwtPayload}.`;

  const batch = await client.send(
    new BatchIsAuthorizedWithTokenCommand({
      policyStoreId: storeId,
      identityToken: token,
      requests: [
        {
          action: { actionType: "Action", actionId: "read" },
          resource: { entityType: "Doc", entityId: "file1" },
        },
        {
          action: { actionType: "Action", actionId: "write" },
          resource: { entityType: "Doc", entityId: "file1" },
        },
      ],
    }),
  );
  expect(batch.results?.length).toBe(2);
  expect(batch.results![0].decision).toBe("ALLOW");
  expect(batch.results![1].decision).toBe("DENY");

  await client.send(new DeletePolicyStoreCommand({ policyStoreId: storeId }));
});
