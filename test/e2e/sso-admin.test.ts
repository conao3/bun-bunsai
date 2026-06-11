import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  SSOAdminClient,
  CreateApplicationCommand,
  DescribeApplicationCommand,
  ListApplicationsCommand,
  UpdateApplicationCommand,
  DeleteApplicationCommand,
  PutApplicationAccessScopeCommand,
  GetApplicationAccessScopeCommand,
  CreateInstanceAccessControlAttributeConfigurationCommand,
  DescribeInstanceAccessControlAttributeConfigurationCommand,
  DeleteInstanceAccessControlAttributeConfigurationCommand,
  UpdateInstanceCommand,
  DescribeInstanceCommand,
  CreatePermissionSetCommand,
  DeletePermissionSetCommand,
  CreateAccountAssignmentCommand,
  DeleteAccountAssignmentCommand,
  ListAccountAssignmentsForPrincipalCommand,
  ListTagsForResourceCommand,
  TagResourceCommand,
  ProvisionPermissionSetCommand,
  DescribePermissionSetProvisioningStatusCommand,
  ListPermissionSetProvisioningStatusCommand,
  CreateTrustedTokenIssuerCommand,
  DescribeTrustedTokenIssuerCommand,
  ListTrustedTokenIssuersCommand,
  DeleteTrustedTokenIssuerCommand,
} from "@aws-sdk/client-sso-admin";
import {
  IdentitystoreClient,
  CreateUserCommand,
  DeleteUserCommand,
} from "@aws-sdk/client-identitystore";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sso = () =>
  new SSOAdminClient({ endpoint, region, credentials, requestHandler });
const ids = () =>
  new IdentitystoreClient({ endpoint, region, credentials, requestHandler });

const INSTANCE_ARN = "arn:aws:sso:::instance/ssoins-bunsai0000000001";
const IDENTITY_STORE_ID = "d-bunsai0001";
const APP_PROVIDER_ARN = "arn:aws:sso::aws:applicationProvider/custom";

test("sso-admin SSOADMIN-001: Application CRUD and access scope round-trip", async () => {
  const createRes = await sso().send(
    new CreateApplicationCommand({
      InstanceArn: INSTANCE_ARN,
      ApplicationProviderArn: APP_PROVIDER_ARN,
      Name: "test-app-1",
    }),
  );
  const appArn = createRes.ApplicationArn!;
  expect(appArn).toMatch(/^arn:aws:sso::.*:application\//);

  const describeRes = await sso().send(
    new DescribeApplicationCommand({ ApplicationArn: appArn }),
  );
  expect(describeRes.Name).toBe("test-app-1");
  expect(describeRes.ApplicationArn).toBe(appArn);
  expect(describeRes.Status).toBe("ENABLED");

  const listRes = await sso().send(
    new ListApplicationsCommand({ InstanceArn: INSTANCE_ARN }),
  );
  expect(listRes.Applications!.some((a) => a.ApplicationArn === appArn)).toBe(
    true,
  );

  await sso().send(
    new UpdateApplicationCommand({
      ApplicationArn: appArn,
      Name: "app-renamed",
    }),
  );
  const afterUpdate = await sso().send(
    new DescribeApplicationCommand({ ApplicationArn: appArn }),
  );
  expect(afterUpdate.Name).toBe("app-renamed");

  await sso().send(
    new PutApplicationAccessScopeCommand({
      ApplicationArn: appArn,
      Scope: "openid",
      AuthorizedTargets: ["target-a"],
    }),
  );
  const scopeRes = await sso().send(
    new GetApplicationAccessScopeCommand({
      ApplicationArn: appArn,
      Scope: "openid",
    }),
  );
  expect(scopeRes.Scope).toBe("openid");
  expect(scopeRes.AuthorizedTargets).toContain("target-a");

  await sso().send(new DeleteApplicationCommand({ ApplicationArn: appArn }));

  await expect(
    sso().send(new DescribeApplicationCommand({ ApplicationArn: appArn })),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("sso-admin SSOADMIN-001: DescribeApplication on unknown ARN throws ResourceNotFoundException", async () => {
  await expect(
    sso().send(
      new DescribeApplicationCommand({
        ApplicationArn:
          "arn:aws:sso::000000000000:application/ssoins-bogus/apl-bogusarnxxx",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("sso-admin SSOADMIN-002: TrustedTokenIssuer CRUD with correct response shape", async () => {
  const createRes = await sso().send(
    new CreateTrustedTokenIssuerCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "tti-test",
      TrustedTokenIssuerType: "OIDC_JWT",
      TrustedTokenIssuerConfiguration: {
        OidcJwtConfiguration: {
          IssuerUrl: "https://example.com",
          ClaimAttributePath: "sub",
          IdentityStoreAttributePath: "emails[primary eq true].value",
          JwksRetrievalOption: "OPEN_ID_DISCOVERY",
        },
      },
    }),
  );
  const ttiArn = createRes.TrustedTokenIssuerArn!;
  expect(ttiArn).toMatch(/^arn:aws:sso::.*:trustedTokenIssuer\//);

  const describeRes = await sso().send(
    new DescribeTrustedTokenIssuerCommand({ TrustedTokenIssuerArn: ttiArn }),
  );
  expect(describeRes.Name).toBe("tti-test");
  expect(describeRes.TrustedTokenIssuerType).toBe("OIDC_JWT");
  expect(describeRes.TrustedTokenIssuerArn).toBe(ttiArn);

  const listRes = await sso().send(
    new ListTrustedTokenIssuersCommand({ InstanceArn: INSTANCE_ARN }),
  );
  expect(
    listRes.TrustedTokenIssuers!.some(
      (t) => t.TrustedTokenIssuerArn === ttiArn,
    ),
  ).toBe(true);

  await sso().send(
    new DeleteTrustedTokenIssuerCommand({ TrustedTokenIssuerArn: ttiArn }),
  );
  await expect(
    sso().send(
      new DescribeTrustedTokenIssuerCommand({ TrustedTokenIssuerArn: ttiArn }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("sso-admin SSOADMIN-003: ABAC config lifecycle", async () => {
  await expect(
    sso().send(
      new DescribeInstanceAccessControlAttributeConfigurationCommand({
        InstanceArn: INSTANCE_ARN,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  await sso().send(
    new CreateInstanceAccessControlAttributeConfigurationCommand({
      InstanceArn: INSTANCE_ARN,
      InstanceAccessControlAttributeConfiguration: {
        AccessControlAttributes: [
          {
            Key: "dept",
            Value: { Source: ["${path:enterprise.department}"] },
          },
        ],
      },
    }),
  );

  const afterCreate = await sso().send(
    new DescribeInstanceAccessControlAttributeConfigurationCommand({
      InstanceArn: INSTANCE_ARN,
    }),
  );
  expect(afterCreate.Status).toBe("ENABLED");
  expect(
    afterCreate.InstanceAccessControlAttributeConfiguration!
      .AccessControlAttributes,
  ).toHaveLength(1);
  expect(
    afterCreate.InstanceAccessControlAttributeConfiguration!
      .AccessControlAttributes![0].Key,
  ).toBe("dept");

  await sso().send(
    new DeleteInstanceAccessControlAttributeConfigurationCommand({
      InstanceArn: INSTANCE_ARN,
    }),
  );
  await expect(
    sso().send(
      new DescribeInstanceAccessControlAttributeConfigurationCommand({
        InstanceArn: INSTANCE_ARN,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("sso-admin SSOADMIN-003: UpdateInstance persists name", async () => {
  await sso().send(
    new UpdateInstanceCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "renamed-instance",
    }),
  );
  const res = await sso().send(
    new DescribeInstanceCommand({ InstanceArn: INSTANCE_ARN }),
  );
  expect(res.Name).toBe("renamed-instance");
});

test("sso-admin SSOADMIN-004: DeletePermissionSet ConflictException + tag cleanup", async () => {
  const psRes = await sso().send(
    new CreatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "ps-conflict-test",
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const psArn = psRes.PermissionSet!.PermissionSetArn!;

  const userRes = await ids().send(
    new CreateUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserName: "conflict-user",
      DisplayName: "Conflict User",
      Name: { GivenName: "Conflict", FamilyName: "User" },
    }),
  );
  const userId = userRes.UserId!;

  await sso().send(
    new CreateAccountAssignmentCommand({
      InstanceArn: INSTANCE_ARN,
      TargetId: "123456789012",
      TargetType: "AWS_ACCOUNT",
      PermissionSetArn: psArn,
      PrincipalType: "USER",
      PrincipalId: userId,
    }),
  );

  await expect(
    sso().send(
      new DeletePermissionSetCommand({
        InstanceArn: INSTANCE_ARN,
        PermissionSetArn: psArn,
      }),
    ),
  ).rejects.toMatchObject({ name: "ConflictException" });

  await sso().send(
    new DeleteAccountAssignmentCommand({
      InstanceArn: INSTANCE_ARN,
      TargetId: "123456789012",
      TargetType: "AWS_ACCOUNT",
      PermissionSetArn: psArn,
      PrincipalType: "USER",
      PrincipalId: userId,
    }),
  );

  await sso().send(
    new DeletePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );

  const principalAssignments = await sso().send(
    new ListAccountAssignmentsForPrincipalCommand({
      InstanceArn: INSTANCE_ARN,
      PrincipalId: userId,
      PrincipalType: "USER",
    }),
  );
  expect(principalAssignments.AccountAssignments).toHaveLength(0);

  await expect(
    sso().send(
      new ListTagsForResourceCommand({
        InstanceArn: INSTANCE_ARN,
        ResourceArn: psArn,
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  await ids().send(
    new DeleteUserCommand({
      IdentityStoreId: IDENTITY_STORE_ID,
      UserId: userId,
    }),
  );
});

test("sso-admin SSOADMIN-005: TagResource on unknown ARN throws ResourceNotFoundException", async () => {
  await expect(
    sso().send(
      new TagResourceCommand({
        InstanceArn: INSTANCE_ARN,
        ResourceArn: "arn:aws:sso:::permissionSet/ssoins-bogus/ps-bogusxxx",
        Tags: [{ Key: "k", Value: "v" }],
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("sso-admin SSOADMIN-006: OperationStatusFilter on ListPermissionSetProvisioningStatus", async () => {
  const psRes = await sso().send(
    new CreatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "ps-filter-test",
    }),
  );
  const psArn = psRes.PermissionSet!.PermissionSetArn!;

  await sso().send(
    new ProvisionPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
      TargetType: "ALL_PROVISIONED_ACCOUNTS",
    }),
  );

  const filteredRes = await sso().send(
    new ListPermissionSetProvisioningStatusCommand({
      InstanceArn: INSTANCE_ARN,
      Filter: { Status: "SUCCEEDED" },
    }),
  );
  expect(
    filteredRes.PermissionSetsProvisioningStatus!.every(
      (s) => s.Status === "SUCCEEDED",
    ),
  ).toBe(true);

  const emptyRes = await sso().send(
    new ListPermissionSetProvisioningStatusCommand({
      InstanceArn: INSTANCE_ARN,
      Filter: { Status: "FAILED" },
    }),
  );
  expect(emptyRes.PermissionSetsProvisioningStatus).toHaveLength(0);

  await sso().send(
    new DeletePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
});

test("sso-admin SSOADMIN-007: CreateAccountAssignment validates PrincipalId", async () => {
  const psRes = await sso().send(
    new CreatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "ps-principal-validation",
    }),
  );
  const psArn = psRes.PermissionSet!.PermissionSetArn!;

  await expect(
    sso().send(
      new CreateAccountAssignmentCommand({
        InstanceArn: INSTANCE_ARN,
        TargetId: "123456789012",
        TargetType: "AWS_ACCOUNT",
        PermissionSetArn: psArn,
        PrincipalType: "USER",
        PrincipalId: "nonexistent-user-id-00000000",
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  await sso().send(
    new DeletePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
});

test("sso-admin SSOADMIN-008: DescribePermissionSetProvisioningStatus includes AccountId", async () => {
  const psRes = await sso().send(
    new CreatePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      Name: "ps-account-id-test",
    }),
  );
  const psArn = psRes.PermissionSet!.PermissionSetArn!;

  const provisionRes = await sso().send(
    new ProvisionPermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
      TargetType: "AWS_ACCOUNT",
      TargetId: "123456789012",
    }),
  );
  const requestId = provisionRes.PermissionSetProvisioningStatus!.RequestId!;

  const describeRes = await sso().send(
    new DescribePermissionSetProvisioningStatusCommand({
      InstanceArn: INSTANCE_ARN,
      ProvisionPermissionSetRequestId: requestId,
    }),
  );
  expect(describeRes.PermissionSetProvisioningStatus!.AccountId).toBe(
    "123456789012",
  );

  await sso().send(
    new DeletePermissionSetCommand({
      InstanceArn: INSTANCE_ARN,
      PermissionSetArn: psArn,
    }),
  );
});
