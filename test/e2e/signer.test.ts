import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AddProfilePermissionCommand,
  CancelSigningProfileCommand,
  DescribeSigningJobCommand,
  GetRevocationStatusCommand,
  GetSigningPlatformCommand,
  GetSigningProfileCommand,
  ListProfilePermissionsCommand,
  ListSigningJobsCommand,
  ListSigningPlatformsCommand,
  ListSigningProfilesCommand,
  ListTagsForResourceCommand,
  PutSigningProfileCommand,
  RemoveProfilePermissionCommand,
  RevokeSignatureCommand,
  RevokeSigningProfileCommand,
  SignPayloadCommand,
  SignerClient,
  StartSigningJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
} from "@aws-sdk/client-signer";
import type { SigningStatus } from "@aws-sdk/client-signer";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const signer = () =>
  new SignerClient({
    endpoint,
    region,
    credentials,
    requestHandler,
    disableHostPrefix: true,
  });

test("Signer signing profile roundtrip", async () => {
  const client = signer();
  const name = `bunsai_e2e_${Date.now()}`;
  const platformId = "AWSLambda-SHA384-ECDSA";

  const put = await client.send(
    new PutSigningProfileCommand({
      profileName: name,
      platformId,
    }),
  );
  expect(put.arn).toContain(`signing-profiles/${name}`);
  expect(put.profileVersion).toBeDefined();
  expect(put.profileVersionArn).toContain(name);

  const got = await client.send(
    new GetSigningProfileCommand({ profileName: name }),
  );
  expect(got.profileName).toBe(name);
  expect(got.platformId).toBe(platformId);
  expect(got.status).toBe("Active");
  expect(got.arn).toBe(put.arn);

  const listed = await client.send(new ListSigningProfilesCommand({}));
  expect((listed.profiles ?? []).map((p) => p.profileName)).toContain(name);

  await client.send(new CancelSigningProfileCommand({ profileName: name }));

  const afterCancel = await client.send(
    new GetSigningProfileCommand({ profileName: name }),
  );
  expect(afterCancel.status).toBe("Canceled");
});

test("StartSigningJob and DescribeSigningJob", async () => {
  const client = signer();
  const profileName = `bunsai_job_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const start = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: {
        s3: { bucketName: "src-bucket", key: "src-key", version: "1" },
      },
      destination: { s3: { bucketName: "dst-bucket", prefix: "signed/" } },
      clientRequestToken: `token-${Date.now()}`,
    }),
  );
  expect(start.jobId).toBeDefined();
  expect(start.jobOwner).toBeDefined();

  const desc = await client.send(
    new DescribeSigningJobCommand({ jobId: start.jobId! }),
  );
  expect(desc.jobId).toBe(start.jobId);
  expect(desc.profileName).toBe(profileName);
  expect(desc.status).toBe("Succeeded");
  expect(desc.platformId).toBe("AWSLambda-SHA384-ECDSA");
});

test("ListSigningJobs", async () => {
  const client = signer();
  const profileName = `bunsai_listjob_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const start = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src-bucket", key: "key", version: "1" } },
      destination: { s3: { bucketName: "dst-bucket", prefix: "" } },
      clientRequestToken: `token-${Date.now()}`,
    }),
  );

  const list = await client.send(new ListSigningJobsCommand({}));
  const ids = (list.jobs ?? []).map((j) => j.jobId);
  expect(ids).toContain(start.jobId);
});

test("SignPayload", async () => {
  const client = signer();
  const profileName = `bunsai_payload_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const result = await client.send(
    new SignPayloadCommand({
      profileName,
      payload: new TextEncoder().encode("hello-world"),
      payloadFormat: "application/vnd.cncf.notary.payload.v1+json",
    }),
  );
  expect(result.jobId).toBeDefined();
  expect(result.jobOwner).toBeDefined();
  expect(result.signature).toBeDefined();
  expect(result.metadata).toBeDefined();
});

test("RevokeSignature", async () => {
  const client = signer();
  const profileName = `bunsai_revokesig_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const start = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src-bucket", key: "key", version: "1" } },
      destination: { s3: { bucketName: "dst-bucket", prefix: "" } },
      clientRequestToken: `token-${Date.now()}`,
    }),
  );

  await client.send(
    new RevokeSignatureCommand({
      jobId: start.jobId!,
      reason: "test revocation",
    }),
  );

  const desc = await client.send(
    new DescribeSigningJobCommand({ jobId: start.jobId! }),
  );
  expect(desc.status).toBe("Revoked" as SigningStatus);
  expect(desc.revocationRecord).toBeDefined();
});

test("RevokeSigningProfile stores revocationRecord", async () => {
  const client = signer();
  const profileName = `bunsai_revokeprofile_${Date.now()}`;
  const put = await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  await client.send(
    new RevokeSigningProfileCommand({
      profileName,
      profileVersion: put.profileVersion!,
      reason: "test profile revocation",
      effectiveTime: new Date(),
    }),
  );

  const got = await client.send(new GetSigningProfileCommand({ profileName }));
  expect(got.status).toBe("Revoked");
  expect(got.revocationRecord).toBeDefined();
  expect(got.revocationRecord?.revocationEffectiveFrom).toBeDefined();
  expect(got.revocationRecord?.revokedAt).toBeDefined();
  expect(got.revocationRecord?.revokedBy).toBeDefined();
});

test("ListSigningProfiles statuses filter and pagination", async () => {
  const client = signer();
  const suffix = Date.now();
  const activeName = `bunsai_listfilt_active_${suffix}`;
  const revokedName = `bunsai_listfilt_revoked_${suffix}`;

  const putActive = await client.send(
    new PutSigningProfileCommand({
      profileName: activeName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );
  const putRevoked = await client.send(
    new PutSigningProfileCommand({
      profileName: revokedName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  await client.send(
    new RevokeSigningProfileCommand({
      profileName: revokedName,
      profileVersion: putRevoked.profileVersion!,
      reason: "pagination test revocation",
      effectiveTime: new Date(),
    }),
  );

  const revokedOnly = await client.send(
    new ListSigningProfilesCommand({ statuses: ["Revoked"] }),
  );
  const revokedNames = (revokedOnly.profiles ?? []).map((p) => p.profileName);
  expect(revokedNames).toContain(revokedName);
  expect(revokedNames).not.toContain(activeName);
  for (const p of revokedOnly.profiles ?? []) {
    expect(p.status).toBe("Revoked");
  }

  const all = await client.send(new ListSigningProfilesCommand({}));
  const total = (all.profiles ?? []).length;

  if (total >= 2) {
    const page1 = await client.send(
      new ListSigningProfilesCommand({ maxResults: 1 }),
    );
    expect((page1.profiles ?? []).length).toBe(1);
    expect(page1.nextToken).toBeDefined();

    const page2 = await client.send(
      new ListSigningProfilesCommand({
        maxResults: 1,
        nextToken: page1.nextToken,
      }),
    );
    expect((page2.profiles ?? []).length).toBeGreaterThanOrEqual(1);
    expect(page1.profiles![0].profileName).not.toBe(
      page2.profiles![0].profileName,
    );
  }

  void putActive;
});

test("ListSigningJobs jobInvoker filter and pagination", async () => {
  const client = signer();
  const profileName = `bunsai_jobfilt_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const job1 = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src", key: "k1", version: "1" } },
      destination: { s3: { bucketName: "dst", prefix: "" } },
      clientRequestToken: `token-${Date.now()}-1`,
    }),
  );
  const job2 = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src", key: "k2", version: "1" } },
      destination: { s3: { bucketName: "dst", prefix: "" } },
      clientRequestToken: `token-${Date.now()}-2`,
    }),
  );

  const allJobs = await client.send(new ListSigningJobsCommand({}));
  const allIds = (allJobs.jobs ?? []).map((j) => j.jobId);
  expect(allIds).toContain(job1.jobId);
  expect(allIds).toContain(job2.jobId);

  const invokerFiltered = await client.send(
    new ListSigningJobsCommand({ jobInvoker: "000000000000" }),
  );
  expect((invokerFiltered.jobs ?? []).map((j) => j.jobId)).toContain(
    job1.jobId,
  );

  const total = (allJobs.jobs ?? []).length;
  if (total >= 2) {
    const page1 = await client.send(
      new ListSigningJobsCommand({ maxResults: 1 }),
    );
    expect((page1.jobs ?? []).length).toBe(1);
    expect(page1.nextToken).toBeDefined();

    const page2 = await client.send(
      new ListSigningJobsCommand({ maxResults: 1, nextToken: page1.nextToken }),
    );
    expect((page2.jobs ?? []).length).toBeGreaterThanOrEqual(1);
    expect(page1.jobs![0].jobId).not.toBe(page2.jobs![0].jobId);
  }
});

test("GetSigningPlatform and ListSigningPlatforms", async () => {
  const client = signer();

  const platforms = await client.send(new ListSigningPlatformsCommand({}));
  expect((platforms.platforms ?? []).length).toBeGreaterThan(0);
  const ids = (platforms.platforms ?? []).map((p) => p.platformId);
  expect(ids).toContain("AWSLambda-SHA384-ECDSA");

  const platform = await client.send(
    new GetSigningPlatformCommand({ platformId: "AWSLambda-SHA384-ECDSA" }),
  );
  expect(platform.platformId).toBe("AWSLambda-SHA384-ECDSA");
  expect(platform.partner).toBe("AWS");
  expect(platform.signingConfiguration).toBeDefined();
  expect(platform.signingImageFormat).toBeDefined();
});

test("GetRevocationStatus", async () => {
  const client = signer();
  const result = await client.send(
    new GetRevocationStatusCommand({
      signatureTimestamp: new Date(),
      platformId: "AWSLambda-SHA384-ECDSA",
      profileVersionArn:
        "arn:aws:signer:us-east-1:000000000000:/signing-profiles/test/version1",
      jobArn: "arn:aws:signer:us-east-1:000000000000:/signing-jobs/testjob",
      certificateHashes: ["0".repeat(96)],
    }),
  );
  expect(result.revokedEntities).toBeDefined();
});

test("AddProfilePermission, ListProfilePermissions, RemoveProfilePermission", async () => {
  const client = signer();
  const profileName = `bunsai_perm_${Date.now()}`;
  const put = await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );
  const statementId = `stmt-${Date.now()}`;

  const added = await client.send(
    new AddProfilePermissionCommand({
      profileName,
      statementId,
      action: "signer:StartSigningJob",
      principal: "123456789012",
      profileVersion: put.profileVersion,
    }),
  );
  expect(added.revisionId).toBeDefined();

  const listed = await client.send(
    new ListProfilePermissionsCommand({ profileName }),
  );
  const stmtIds = (listed.permissions ?? []).map((p) => p.statementId);
  expect(stmtIds).toContain(statementId);

  const removed = await client.send(
    new RemoveProfilePermissionCommand({
      profileName,
      statementId,
      revisionId: listed.revisionId!,
    }),
  );
  expect(removed.revisionId).toBeDefined();

  const afterRemove = await client.send(
    new ListProfilePermissionsCommand({ profileName }),
  );
  expect(
    (afterRemove.permissions ?? []).map((p) => p.statementId),
  ).not.toContain(statementId);
});

test("HIGH-1: clientRequestToken idempotency", async () => {
  const client = signer();
  const profileName = `bunsai_idem_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const token = `idem-token-${Date.now()}`;
  const first = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src", key: "k1", version: "1" } },
      destination: { s3: { bucketName: "dst", prefix: "" } },
      clientRequestToken: token,
    }),
  );
  const second = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src", key: "k2", version: "1" } },
      destination: { s3: { bucketName: "dst2", prefix: "" } },
      clientRequestToken: token,
    }),
  );
  expect(second.jobId).toBe(first.jobId);

  const list = await client.send(new ListSigningJobsCommand({}));
  const matchingJobs = (list.jobs ?? []).filter((j) => j.jobId === first.jobId);
  expect(matchingJobs.length).toBe(1);
});

test("HIGH-2: PutSigningProfile tags visible via ListTagsForResource and TagResource visible in GetSigningProfile", async () => {
  const client = signer();
  const profileName = `bunsai_tagsunify_${Date.now()}`;
  const put = await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
      tags: { env: "test" },
    }),
  );
  const arn = put.arn!;

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(listed.tags?.["env"]).toBe("test");

  await client.send(
    new TagResourceCommand({ resourceArn: arn, tags: { team: "a" } }),
  );

  const got = await client.send(new GetSigningProfileCommand({ profileName }));
  expect(got.tags?.["env"]).toBe("test");
  expect(got.tags?.["team"]).toBe("a");
});

test("HIGH-3: ListTagsForResource on nonexistent profile ARN throws NotFoundException", async () => {
  const client = signer();
  const fakeArn =
    "arn:aws:signer:us-east-1:000000000000:/signing-profiles/doesNotExist";
  try {
    await client.send(new ListTagsForResourceCommand({ resourceArn: fakeArn }));
    expect(true).toBe(false);
  } catch (e: unknown) {
    const err = e as { name: string; $metadata: { httpStatusCode: number } };
    expect(err.name).toBe("NotFoundException");
    expect(err.$metadata.httpStatusCode).toBe(404);
  }
});

test("MEDIUM-1: PutSigningProfile rejects unknown platformId with ValidationException", async () => {
  const client = signer();
  try {
    await client.send(
      new PutSigningProfileCommand({
        profileName: `bunsai_badplat_${Date.now()}`,
        platformId: "NoSuchPlatform-SHA999",
      }),
    );
    expect(true).toBe(false);
  } catch (e: unknown) {
    const err = e as { name: string };
    expect(err.name).toBe("ValidationException");
  }
});

test("MEDIUM-2: RevokeSigningProfile rejects wrong profileVersion with ValidationException", async () => {
  const client = signer();
  const profileName = `bunsai_revver_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  try {
    await client.send(
      new RevokeSigningProfileCommand({
        profileName,
        profileVersion: "WRONGVERSION00",
        reason: "test",
        effectiveTime: new Date(),
      }),
    );
    expect(true).toBe(false);
  } catch (e: unknown) {
    const err = e as { name: string };
    expect(err.name).toBe("ValidationException");
  }

  const got = await client.send(new GetSigningProfileCommand({ profileName }));
  expect(got.status).toBe("Active");
});

test("MEDIUM-3: AddProfilePermission rejects duplicate statementId with ConflictException", async () => {
  const client = signer();
  const profileName = `bunsai_dupstmt_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const statementId = `stmt-dup-${Date.now()}`;
  await client.send(
    new AddProfilePermissionCommand({
      profileName,
      statementId,
      action: "signer:StartSigningJob",
      principal: "123456789012",
    }),
  );

  try {
    await client.send(
      new AddProfilePermissionCommand({
        profileName,
        statementId,
        action: "signer:StartSigningJob",
        principal: "123456789012",
      }),
    );
    expect(true).toBe(false);
  } catch (e: unknown) {
    const err = e as { name: string };
    expect(err.name).toBe("ConflictException");
  }
});

test("MEDIUM-4: DescribeSigningJob returns signedObject and signatureExpiresAt", async () => {
  const client = signer();
  const profileName = `bunsai_sigobj_${Date.now()}`;
  await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );

  const start = await client.send(
    new StartSigningJobCommand({
      profileName,
      source: { s3: { bucketName: "src", key: "k", version: "1" } },
      destination: { s3: { bucketName: "dst-bucket", prefix: "signed/" } },
      clientRequestToken: `token-sigobj-${Date.now()}`,
    }),
  );

  const desc = await client.send(
    new DescribeSigningJobCommand({ jobId: start.jobId! }),
  );
  expect(desc.signedObject?.s3?.bucketName).toBe("dst-bucket");
  expect(typeof desc.signedObject?.s3?.key).toBe("string");
  expect(desc.signatureExpiresAt).toBeDefined();
});

test("LOW-1: GetRevocationStatus includes profileVersionArn after RevokeSigningProfile", async () => {
  const client = signer();
  const profileName = `bunsai_revstatus_${Date.now()}`;
  const put = await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );
  const pvArn = put.profileVersionArn!;

  await client.send(
    new RevokeSigningProfileCommand({
      profileName,
      profileVersion: put.profileVersion!,
      reason: "low-1 test",
      effectiveTime: new Date(Date.now() - 2000),
    }),
  );

  const status = await client.send(
    new GetRevocationStatusCommand({
      signatureTimestamp: new Date(),
      platformId: "AWSLambda-SHA384-ECDSA",
      profileVersionArn: pvArn,
      jobArn: `arn:aws:signer:us-east-1:000000000000:/signing-jobs/nojob`,
      certificateHashes: ["0".repeat(96)],
    }),
  );
  expect(status.revokedEntities).toContain(pvArn);
});

test("TagResource, ListTagsForResource, UntagResource", async () => {
  const client = signer();
  const profileName = `bunsai_tag_${Date.now()}`;
  const put = await client.send(
    new PutSigningProfileCommand({
      profileName,
      platformId: "AWSLambda-SHA384-ECDSA",
    }),
  );
  const resourceArn = put.arn!;

  await client.send(
    new TagResourceCommand({
      resourceArn,
      tags: { env: "test", team: "bunsai" },
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(listed.tags).toMatchObject({ env: "test", team: "bunsai" });

  await client.send(
    new UntagResourceCommand({
      resourceArn,
      tagKeys: ["env"],
    }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ resourceArn }),
  );
  expect(afterUntag.tags?.["env"]).toBeUndefined();
  expect(afterUntag.tags?.["team"]).toBe("bunsai");
});
