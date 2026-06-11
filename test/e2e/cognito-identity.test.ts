import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CognitoIdentityClient,
  CreateIdentityPoolCommand,
  DeleteIdentityPoolCommand,
  DeleteIdentitiesCommand,
  DescribeIdentityPoolCommand,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
  GetIdentityPoolRolesCommand,
  GetOpenIdTokenForDeveloperIdentityCommand,
  GetPrincipalTagAttributeMapCommand,
  ListIdentityPoolsCommand,
  ListIdentitiesCommand,
  LookupDeveloperIdentityCommand,
  MergeDeveloperIdentitiesCommand,
  SetIdentityPoolRolesCommand,
  SetPrincipalTagAttributeMapCommand,
  UnlinkDeveloperIdentityCommand,
  UnlinkIdentityCommand,
  UpdateIdentityPoolCommand,
  TagResourceCommand,
  UntagResourceCommand,
  ListTagsForResourceCommand,
} from "@aws-sdk/client-cognito-identity";
import {
  CreateBucketCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const ci = () =>
  new CognitoIdentityClient({ endpoint, region, credentials, requestHandler });

test("Identity Pool CRUD lifecycle", async () => {
  const client = ci();
  const poolName = "e2e-test-pool";

  const created = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: poolName,
      AllowUnauthenticatedIdentities: true,
    }),
  );
  expect(created.IdentityPoolId).toBeDefined();
  expect(created.IdentityPoolId).toMatch(/^us-east-1:/);
  expect(created.IdentityPoolName).toBe(poolName);
  expect(created.AllowUnauthenticatedIdentities).toBe(true);

  const poolId = created.IdentityPoolId!;

  const described = await client.send(
    new DescribeIdentityPoolCommand({ IdentityPoolId: poolId }),
  );
  expect(described.IdentityPoolId).toBe(poolId);
  expect(described.IdentityPoolName).toBe(poolName);

  const updated = await client.send(
    new UpdateIdentityPoolCommand({
      IdentityPoolId: poolId,
      IdentityPoolName: poolName,
      AllowUnauthenticatedIdentities: false,
    }),
  );
  expect(updated.AllowUnauthenticatedIdentities).toBe(false);

  const listed = await client.send(
    new ListIdentityPoolsCommand({ MaxResults: 60 }),
  );
  expect(listed.IdentityPools?.some((p) => p.IdentityPoolId === poolId)).toBe(
    true,
  );

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));

  const listedAfter = await client.send(
    new ListIdentityPoolsCommand({ MaxResults: 60 }),
  );
  expect(
    listedAfter.IdentityPools?.some((p) => p.IdentityPoolId === poolId),
  ).toBe(false);
});

test("ListIdentityPools pagination", async () => {
  const client = ci();
  const poolIds: string[] = [];

  for (let i = 0; i < 3; i++) {
    const r = await client.send(
      new CreateIdentityPoolCommand({
        IdentityPoolName: `pagination-pool-${i}`,
        AllowUnauthenticatedIdentities: true,
      }),
    );
    poolIds.push(r.IdentityPoolId!);
  }

  const page1 = await client.send(
    new ListIdentityPoolsCommand({ MaxResults: 2 }),
  );
  expect(page1.IdentityPools?.length).toBeGreaterThanOrEqual(2);
  expect(page1.NextToken).toBeDefined();

  const page2 = await client.send(
    new ListIdentityPoolsCommand({ MaxResults: 2, NextToken: page1.NextToken }),
  );
  expect(page2.IdentityPools).toBeDefined();

  for (const id of poolIds) {
    await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: id }));
  }
});

test("duplicate CreateIdentityPool throws ResourceConflictException", async () => {
  const client = ci();
  const poolName = "duplicate-pool-e2e";

  const created = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: poolName,
      AllowUnauthenticatedIdentities: true,
    }),
  );

  await expect(
    client.send(
      new CreateIdentityPoolCommand({
        IdentityPoolName: poolName,
        AllowUnauthenticatedIdentities: true,
      }),
    ),
  ).rejects.toThrow();

  await client.send(
    new DeleteIdentityPoolCommand({ IdentityPoolId: created.IdentityPoolId! }),
  );
});

test("DescribeIdentityPool not found throws ResourceNotFoundException", async () => {
  const client = ci();
  await expect(
    client.send(
      new DescribeIdentityPoolCommand({
        IdentityPoolId: "us-east-1:nonexistent-id",
      }),
    ),
  ).rejects.toThrow();
});

test("GetId creates identity and GetCredentialsForIdentity issues temp creds", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "creds-test-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const idResult = await client.send(
    new GetIdCommand({ IdentityPoolId: poolId }),
  );
  expect(idResult.IdentityId).toBeDefined();
  expect(idResult.IdentityId).toMatch(/^us-east-1:/);

  const identityId = idResult.IdentityId!;

  const idResult2 = await client.send(
    new GetIdCommand({ IdentityPoolId: poolId }),
  );
  expect(idResult2.IdentityId).toBeDefined();

  const credsResult = await client.send(
    new GetCredentialsForIdentityCommand({ IdentityId: identityId }),
  );
  expect(credsResult.IdentityId).toBe(identityId);
  expect(credsResult.Credentials?.AccessKeyId).toMatch(/^ASIA/);
  expect(credsResult.Credentials?.SecretKey).toBeDefined();
  expect(credsResult.Credentials?.SessionToken).toBeDefined();
  expect(credsResult.Credentials?.Expiration).toBeDefined();
  expect(Number(credsResult.Credentials?.Expiration)).toBeGreaterThan(
    Date.now() / 1000,
  );

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("GetId with Logins reuses same IdentityId", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "logins-reuse-pool",
      AllowUnauthenticatedIdentities: false,
      CognitoIdentityProviders: [
        {
          ProviderName: "cognito-idp.us-east-1.amazonaws.com/us-east-1_test",
          ClientId: "testclient",
        },
      ],
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const loginKey = "cognito-idp.us-east-1.amazonaws.com/us-east-1_test";
  const loginToken = "test-id-token";

  const r1 = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId,
      Logins: { [loginKey]: loginToken },
    }),
  );
  const r2 = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId,
      Logins: { [loginKey]: loginToken },
    }),
  );
  expect(r1.IdentityId).toBe(r2.IdentityId);

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("GetCredentialsForIdentity → S3 bucket lifecycle with temp creds", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "s3-integration-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const idResult = await client.send(
    new GetIdCommand({ IdentityPoolId: poolId }),
  );
  const identityId = idResult.IdentityId!;

  const credsResult = await client.send(
    new GetCredentialsForIdentityCommand({ IdentityId: identityId }),
  );
  const tempCreds = {
    accessKeyId: credsResult.Credentials?.AccessKeyId ?? "",
    secretAccessKey: credsResult.Credentials?.SecretKey ?? "",
    sessionToken: credsResult.Credentials?.SessionToken ?? "",
  };

  expect(tempCreds.accessKeyId).toMatch(/^ASIA/);

  const s3Temp = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials: tempCreds,
  });
  const s3Orig = new S3Client({
    endpoint,
    region,
    requestHandler,
    credentials,
  });

  await s3Temp.send(
    new CreateBucketCommand({ Bucket: "cognito-identity-e2e-bucket" }),
  );

  const listedByTemp = await s3Temp.send(new ListBucketsCommand({}));
  expect(
    listedByTemp.Buckets?.some((b) => b.Name === "cognito-identity-e2e-bucket"),
  ).toBe(true);

  const listedByOrig = await s3Orig.send(new ListBucketsCommand({}));
  expect(
    listedByOrig.Buckets?.some((b) => b.Name === "cognito-identity-e2e-bucket"),
  ).toBe(true);

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("ListIdentities in pool", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "list-identities-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const id1 = await client.send(new GetIdCommand({ IdentityPoolId: poolId }));
  const id2 = await client.send(new GetIdCommand({ IdentityPoolId: poolId }));

  const listed = await client.send(
    new ListIdentitiesCommand({ IdentityPoolId: poolId, MaxResults: 60 }),
  );
  expect(listed.IdentityPoolId).toBe(poolId);
  expect(listed.Identities?.length).toBeGreaterThanOrEqual(2);
  expect(listed.Identities?.some((i) => i.IdentityId === id1.IdentityId)).toBe(
    true,
  );
  expect(listed.Identities?.some((i) => i.IdentityId === id2.IdentityId)).toBe(
    true,
  );

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("tags round-trip via TagResource / ListTagsForResource / UntagResource", async () => {
  const client = ci();
  const account = "000000000000";

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "tags-test-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;
  const poolArn = `arn:aws:cognito-identity:${region}:${account}:identitypool/${poolId}`;

  await client.send(
    new TagResourceCommand({
      ResourceArn: poolArn,
      Tags: { env: "test", owner: "e2e" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: poolArn }),
  );
  expect(listed.Tags?.env).toBe("test");
  expect(listed.Tags?.owner).toBe("e2e");

  await client.send(
    new UntagResourceCommand({ ResourceArn: poolArn, TagKeys: ["owner"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: poolArn }),
  );
  expect(after.Tags?.env).toBe("test");
  expect(after.Tags?.owner).toBeUndefined();

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("COGID-01: SetIdentityPoolRoles / GetIdentityPoolRoles round-trip", async () => {
  const client = ci();
  const account = "000000000000";

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "roles-roundtrip-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const fresh = await client.send(
    new GetIdentityPoolRolesCommand({ IdentityPoolId: poolId }),
  );
  expect(fresh.IdentityPoolId).toBe(poolId);
  expect(fresh.Roles).toBeUndefined();

  const authRole = `arn:aws:iam::${account}:role/MyAuthRole`;
  const unauthRole = `arn:aws:iam::${account}:role/MyUnauthRole`;

  await client.send(
    new SetIdentityPoolRolesCommand({
      IdentityPoolId: poolId,
      Roles: { authenticated: authRole, unauthenticated: unauthRole },
    }),
  );

  const got = await client.send(
    new GetIdentityPoolRolesCommand({ IdentityPoolId: poolId }),
  );
  expect(got.IdentityPoolId).toBe(poolId);
  expect(got.Roles?.authenticated).toBe(authRole);
  expect(got.Roles?.unauthenticated).toBe(unauthRole);

  await expect(
    client.send(
      new GetIdentityPoolRolesCommand({
        IdentityPoolId: "us-east-1:nonexistent-pool",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("COGID-02: GetCredentialsForIdentity auth guards", async () => {
  const client = ci();
  const account = "000000000000";

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "auth-guard-pool",
      AllowUnauthenticatedIdentities: false,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const idResult = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId,
      Logins: { "accounts.google.com": "some-google-token" },
    }),
  );
  const identityId = idResult.IdentityId!;

  const unauthPool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "unauth-no-role-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const unauthPoolId = unauthPool.IdentityPoolId!;
  const unauthRoleArn = `arn:aws:iam::${account}:role/AuthOnly`;

  await client.send(
    new SetIdentityPoolRolesCommand({
      IdentityPoolId: unauthPoolId,
      Roles: { authenticated: unauthRoleArn },
    }),
  );

  const unauthIdResult = await client.send(
    new GetIdCommand({ IdentityPoolId: unauthPoolId }),
  );
  const unauthIdentityId = unauthIdResult.IdentityId!;

  await expect(
    client.send(
      new GetCredentialsForIdentityCommand({ IdentityId: unauthIdentityId }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
  await client.send(
    new DeleteIdentityPoolCommand({ IdentityPoolId: unauthPoolId }),
  );
  void identityId;
});

test("COGID-03: developer identity lookup round-trip", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "dev-identity-pool",
      AllowUnauthenticatedIdentities: true,
      DeveloperProviderName: "login.myapp.example",
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const devResult = await client.send(
    new GetOpenIdTokenForDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      Logins: { "login.myapp.example": "user-alice" },
    }),
  );
  expect(devResult.IdentityId).toMatch(/^us-east-1:/);
  expect(devResult.Token).toBeDefined();
  const aliceIdentityId = devResult.IdentityId!;

  const lookup = await client.send(
    new LookupDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      DeveloperUserIdentifier: "user-alice",
    }),
  );
  expect(lookup.IdentityId).toBe(aliceIdentityId);
  expect(lookup.DeveloperUserIdentifierList).toContain("user-alice");

  const lookupById = await client.send(
    new LookupDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      IdentityId: aliceIdentityId,
    }),
  );
  expect(lookupById.DeveloperUserIdentifierList).toContain("user-alice");

  await expect(
    client.send(
      new LookupDeveloperIdentityCommand({
        IdentityPoolId: poolId,
        DeveloperUserIdentifier: "nonexistent-user",
      }),
    ),
  ).rejects.toThrow();

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("COGID-04: MergeDeveloperIdentities merges source into destination", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "merge-dev-pool",
      AllowUnauthenticatedIdentities: true,
      DeveloperProviderName: "login.mergeapp.example",
    }),
  );
  const poolId = pool.IdentityPoolId!;
  const provider = "login.mergeapp.example";

  const srcResult = await client.send(
    new GetOpenIdTokenForDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      Logins: { [provider]: "user-src" },
    }),
  );
  const srcIdentityId = srcResult.IdentityId!;

  const dstResult = await client.send(
    new GetOpenIdTokenForDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      Logins: { [provider]: "user-dst" },
    }),
  );
  const dstIdentityId = dstResult.IdentityId!;

  expect(srcIdentityId).not.toBe(dstIdentityId);

  const merged = await client.send(
    new MergeDeveloperIdentitiesCommand({
      IdentityPoolId: poolId,
      DeveloperProviderName: provider,
      SourceUserIdentifier: "user-src",
      DestinationUserIdentifier: "user-dst",
    }),
  );
  expect(merged.IdentityId).toBe(dstIdentityId);
  expect(merged.IdentityId).toMatch(/^us-east-1:/);

  const srcLookup = await client.send(
    new LookupDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      DeveloperUserIdentifier: "user-src",
    }),
  );
  expect(srcLookup.IdentityId).toBe(dstIdentityId);

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("COGID-05: DeleteIdentities cleans login mappings; GetId does not resurrect", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "delete-cleanup-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  const loginKey = "accounts.google.com";
  const loginToken = "resurrection-test-token";

  const r1 = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId,
      Logins: { [loginKey]: loginToken },
    }),
  );
  const originalId = r1.IdentityId!;

  await client.send(
    new DeleteIdentitiesCommand({
      IdentityIdsToDelete: [originalId],
    }),
  );

  const r2 = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId,
      Logins: { [loginKey]: loginToken },
    }),
  );
  expect(r2.IdentityId).not.toBe(originalId);

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});

test("COGID-05: DeleteIdentityPool sweeps identities and mappings", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "sweep-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;

  await client.send(new GetIdCommand({ IdentityPoolId: poolId }));
  await client.send(new GetIdCommand({ IdentityPoolId: poolId }));

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));

  await expect(
    client.send(
      new ListIdentitiesCommand({ IdentityPoolId: poolId, MaxResults: 60 }),
    ),
  ).rejects.toThrow();
});

test("COGID-07: UnlinkIdentity and UnlinkDeveloperIdentity remove logins", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "unlink-pool",
      AllowUnauthenticatedIdentities: true,
      DeveloperProviderName: "login.unlinkapp.example",
    }),
  );
  const poolId = pool.IdentityPoolId!;
  const provider = "login.unlinkapp.example";

  const devResult = await client.send(
    new GetOpenIdTokenForDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      Logins: { [provider]: "user-to-unlink" },
    }),
  );
  const identityId = devResult.IdentityId!;

  await client.send(
    new UnlinkDeveloperIdentityCommand({
      IdentityPoolId: poolId,
      IdentityId: identityId,
      DeveloperProviderName: provider,
      DeveloperUserIdentifier: "user-to-unlink",
    }),
  );

  await expect(
    client.send(
      new LookupDeveloperIdentityCommand({
        IdentityPoolId: poolId,
        DeveloperUserIdentifier: "user-to-unlink",
      }),
    ),
  ).rejects.toThrow();

  const pool2 = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "unlink-identity-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId2 = pool2.IdentityPoolId!;
  const loginProvider = "accounts.google.com";
  const loginToken = "google-token-to-unlink";

  const r = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId2,
      Logins: { [loginProvider]: loginToken },
    }),
  );
  const identityId2 = r.IdentityId!;

  await client.send(
    new UnlinkIdentityCommand({
      IdentityId: identityId2,
      Logins: { [loginProvider]: loginToken },
      LoginsToRemove: [loginProvider],
    }),
  );

  const r2 = await client.send(
    new GetIdCommand({
      IdentityPoolId: poolId2,
      Logins: { [loginProvider]: loginToken },
    }),
  );
  expect(r2.IdentityId).not.toBe(identityId2);

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId2 }));
});

test("COGID-08: SetPrincipalTagAttributeMap / GetPrincipalTagAttributeMap persist", async () => {
  const client = ci();

  const pool = await client.send(
    new CreateIdentityPoolCommand({
      IdentityPoolName: "principal-tags-pool",
      AllowUnauthenticatedIdentities: true,
    }),
  );
  const poolId = pool.IdentityPoolId!;
  const providerName = "cognito-idp.us-east-1.amazonaws.com/us-east-1_test";

  const defaults = await client.send(
    new GetPrincipalTagAttributeMapCommand({
      IdentityPoolId: poolId,
      IdentityProviderName: providerName,
    }),
  );
  expect(defaults.UseDefaults).toBe(true);
  expect(defaults.PrincipalTags).toEqual({});

  await client.send(
    new SetPrincipalTagAttributeMapCommand({
      IdentityPoolId: poolId,
      IdentityProviderName: providerName,
      UseDefaults: false,
      PrincipalTags: { sub: "sub", email: "email" },
    }),
  );

  const got = await client.send(
    new GetPrincipalTagAttributeMapCommand({
      IdentityPoolId: poolId,
      IdentityProviderName: providerName,
    }),
  );
  expect(got.UseDefaults).toBe(false);
  expect(got.PrincipalTags?.sub).toBe("sub");
  expect(got.PrincipalTags?.email).toBe("email");

  await client.send(new DeleteIdentityPoolCommand({ IdentityPoolId: poolId }));
});
