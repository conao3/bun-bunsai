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

test("RevokeSigningProfile", async () => {
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
