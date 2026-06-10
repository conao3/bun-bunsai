import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CognitoIdentityClient,
  CreateIdentityPoolCommand,
  DeleteIdentityPoolCommand,
  DescribeIdentityPoolCommand,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
  ListIdentityPoolsCommand,
  ListIdentitiesCommand,
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
