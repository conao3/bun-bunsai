import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  AssociateFraudsterCommand,
  CreateDomainCommand,
  CreateWatchlistCommand,
  DeleteDomainCommand,
  DeleteFraudsterCommand,
  DeleteSpeakerCommand,
  DeleteWatchlistCommand,
  DescribeDomainCommand,
  DescribeFraudsterCommand,
  DescribeFraudsterRegistrationJobCommand,
  DescribeSpeakerCommand,
  DescribeSpeakerEnrollmentJobCommand,
  DescribeWatchlistCommand,
  DisassociateFraudsterCommand,
  EvaluateSessionCommand,
  ListDomainsCommand,
  ListFraudsterRegistrationJobsCommand,
  ListFraudsterRegistrationJobsCommandInput,
  ListFraudstersCommand,
  ListSpeakerEnrollmentJobsCommand,
  ListSpeakersCommand,
  ListTagsForResourceCommand,
  ListWatchlistsCommand,
  OptOutSpeakerCommand,
  StartFraudsterRegistrationJobCommand,
  StartSpeakerEnrollmentJobCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateDomainCommand,
  UpdateWatchlistCommand,
  VoiceIDClient,
} from "@aws-sdk/client-voice-id";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const voiceid = () =>
  new VoiceIDClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("VoiceID domain lifecycle", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";

  const created = await client.send(
    new CreateDomainCommand({
      Name: "bunsai-e2e-domain",
      Description: "bunsai e2e voiceid domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const domainId = created.Domain?.DomainId;
  expect(domainId).toBeDefined();
  expect(created.Domain?.Name).toBe("bunsai-e2e-domain");
  expect(created.Domain?.Arn).toContain("domain/");
  expect(created.Domain?.ServerSideEncryptionConfiguration?.KmsKeyId).toBe(
    kmsKeyId,
  );

  const described = await client.send(
    new DescribeDomainCommand({ DomainId: domainId }),
  );
  expect(described.Domain?.DomainId).toBe(domainId);
  expect(described.Domain?.Name).toBe("bunsai-e2e-domain");

  const listed = await client.send(new ListDomainsCommand({}));
  expect(
    (listed.DomainSummaries ?? []).some((d) => d.DomainId === domainId),
  ).toBe(true);

  await client.send(new DeleteDomainCommand({ DomainId: domainId }));

  const afterDelete = await client.send(new ListDomainsCommand({}));
  expect(
    (afterDelete.DomainSummaries ?? []).some((d) => d.DomainId === domainId),
  ).toBe(false);
});

test("VoiceID UpdateDomain", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";

  const created = await client.send(
    new CreateDomainCommand({
      Name: "update-test-domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const domainId = created.Domain?.DomainId!;

  const updated = await client.send(
    new UpdateDomainCommand({
      DomainId: domainId,
      Name: "updated-domain-name",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  expect(updated.Domain?.Name).toBe("updated-domain-name");
  expect(updated.Domain?.DomainId).toBe(domainId);

  await client.send(new DeleteDomainCommand({ DomainId: domainId }));
});

test("VoiceID watchlist lifecycle", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";

  const domain = await client.send(
    new CreateDomainCommand({
      Name: "watchlist-test-domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const domainId = domain.Domain?.DomainId!;

  const created = await client.send(
    new CreateWatchlistCommand({
      DomainId: domainId,
      Name: "test-watchlist",
      Description: "e2e watchlist",
    }),
  );
  const watchlistId = created.Watchlist?.WatchlistId;
  expect(watchlistId).toBeDefined();
  expect(created.Watchlist?.Name).toBe("test-watchlist");
  expect(created.Watchlist?.DomainId).toBe(domainId);
  expect(created.Watchlist?.DefaultWatchlist).toBe(false);

  const described = await client.send(
    new DescribeWatchlistCommand({
      DomainId: domainId,
      WatchlistId: watchlistId,
    }),
  );
  expect(described.Watchlist?.WatchlistId).toBe(watchlistId);

  const updated = await client.send(
    new UpdateWatchlistCommand({
      DomainId: domainId,
      WatchlistId: watchlistId,
      Name: "updated-watchlist",
    }),
  );
  expect(updated.Watchlist?.Name).toBe("updated-watchlist");

  const listed = await client.send(
    new ListWatchlistsCommand({ DomainId: domainId }),
  );
  expect(
    (listed.WatchlistSummaries ?? []).some(
      (w) => w.WatchlistId === watchlistId,
    ),
  ).toBe(true);

  await client.send(
    new DeleteWatchlistCommand({
      DomainId: domainId,
      WatchlistId: watchlistId,
    }),
  );

  const afterDelete = await client.send(
    new ListWatchlistsCommand({ DomainId: domainId }),
  );
  expect(
    (afterDelete.WatchlistSummaries ?? []).some(
      (w) => w.WatchlistId === watchlistId,
    ),
  ).toBe(false);

  await client.send(new DeleteDomainCommand({ DomainId: domainId }));
});

test("VoiceID fraudster registration job and fraudster lifecycle", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";
  const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-voiceid-role";

  const domain = await client.send(
    new CreateDomainCommand({
      Name: "fraudster-test-domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const domainId = domain.Domain?.DomainId!;

  const watchlistRes = await client.send(
    new CreateWatchlistCommand({
      DomainId: domainId,
      Name: "fraud-watchlist",
    }),
  );
  const watchlistId = watchlistRes.Watchlist?.WatchlistId!;

  const jobRes = await client.send(
    new StartFraudsterRegistrationJobCommand({
      DomainId: domainId,
      DataAccessRoleArn: roleArn,
      InputDataConfig: { S3Uri: "s3://bunsai-e2e/input/" },
      OutputDataConfig: { S3Uri: "s3://bunsai-e2e/output/" },
      JobName: "e2e-reg-job",
    }),
  );
  const jobId = jobRes.Job?.JobId;
  expect(jobId).toBeDefined();
  expect(jobRes.Job?.JobStatus).toBe("COMPLETED");

  const describedJob = await client.send(
    new DescribeFraudsterRegistrationJobCommand({
      DomainId: domainId,
      JobId: jobId,
    }),
  );
  expect(describedJob.Job?.JobId).toBe(jobId);
  expect(describedJob.Job?.JobStatus).toBe("COMPLETED");

  const listedJobs = await client.send(
    new ListFraudsterRegistrationJobsCommand({ DomainId: domainId }),
  );
  expect((listedJobs.JobSummaries ?? []).some((j) => j.JobId === jobId)).toBe(
    true,
  );

  const fraudsters = await client.send(
    new ListFraudstersCommand({ DomainId: domainId }),
  );
  const fraudsterId = fraudsters.FraudsterSummaries?.[0]?.GeneratedFraudsterId;
  expect(fraudsterId).toBeDefined();

  const described = await client.send(
    new DescribeFraudsterCommand({
      DomainId: domainId,
      FraudsterId: fraudsterId,
    }),
  );
  expect(described.Fraudster?.GeneratedFraudsterId).toBe(fraudsterId);

  const assoc = await client.send(
    new AssociateFraudsterCommand({
      DomainId: domainId,
      FraudsterId: fraudsterId!,
      WatchlistId: watchlistId,
    }),
  );
  expect(assoc.Fraudster?.WatchlistIds).toContain(watchlistId);

  const byWatchlist = await client.send(
    new ListFraudstersCommand({ DomainId: domainId, WatchlistId: watchlistId }),
  );
  expect(
    (byWatchlist.FraudsterSummaries ?? []).some(
      (f) => f.GeneratedFraudsterId === fraudsterId,
    ),
  ).toBe(true);

  const disassoc = await client.send(
    new DisassociateFraudsterCommand({
      DomainId: domainId,
      FraudsterId: fraudsterId!,
      WatchlistId: watchlistId,
    }),
  );
  expect(disassoc.Fraudster?.WatchlistIds ?? []).not.toContain(watchlistId);

  await client.send(
    new DeleteFraudsterCommand({
      DomainId: domainId,
      FraudsterId: fraudsterId!,
    }),
  );

  const afterDelete = await client.send(
    new ListFraudstersCommand({ DomainId: domainId }),
  );
  expect(
    (afterDelete.FraudsterSummaries ?? []).some(
      (f) => f.GeneratedFraudsterId === fraudsterId,
    ),
  ).toBe(false);

  await client.send(new DeleteDomainCommand({ DomainId: domainId }));
});

test("VoiceID speaker operations via EvaluateSession", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";
  const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-voiceid-role";

  const domain = await client.send(
    new CreateDomainCommand({
      Name: "speaker-test-domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const domainId = domain.Domain?.DomainId!;

  const sessionResult = await client.send(
    new EvaluateSessionCommand({
      DomainId: domainId,
      SessionNameOrId: "e2e-speaker-session",
    }),
  );
  expect(sessionResult.DomainId).toBe(domainId);
  expect(sessionResult.StreamingStatus).toBe("ENDED");
  expect(sessionResult.AuthenticationResult?.Decision).toBe("ACCEPT");
  expect(sessionResult.FraudDetectionResult?.Decision).toBe("NOT_FRAUD");
  const speakerId = sessionResult.AuthenticationResult?.GeneratedSpeakerId;
  expect(speakerId).toBeDefined();

  const described = await client.send(
    new DescribeSpeakerCommand({ DomainId: domainId, SpeakerId: speakerId }),
  );
  expect(described.Speaker?.GeneratedSpeakerId).toBe(speakerId);
  expect(described.Speaker?.Status).toBe("ENROLLED");

  const listed = await client.send(
    new ListSpeakersCommand({ DomainId: domainId }),
  );
  expect(
    (listed.SpeakerSummaries ?? []).some(
      (s) => s.GeneratedSpeakerId === speakerId,
    ),
  ).toBe(true);

  const optedOut = await client.send(
    new OptOutSpeakerCommand({ DomainId: domainId, SpeakerId: speakerId! }),
  );
  expect(optedOut.Speaker?.Status).toBe("OPTED_OUT");

  await client.send(
    new DeleteSpeakerCommand({ DomainId: domainId, SpeakerId: speakerId! }),
  );

  const afterDelete = await client.send(
    new ListSpeakersCommand({ DomainId: domainId }),
  );
  expect(
    (afterDelete.SpeakerSummaries ?? []).some(
      (s) => s.GeneratedSpeakerId === speakerId,
    ),
  ).toBe(false);

  const enrollJob = await client.send(
    new StartSpeakerEnrollmentJobCommand({
      DomainId: domainId,
      DataAccessRoleArn: roleArn,
      InputDataConfig: { S3Uri: "s3://bunsai-e2e/input/" },
      OutputDataConfig: { S3Uri: "s3://bunsai-e2e/output/" },
      JobName: "e2e-enroll-job",
    }),
  );
  const enrollJobId = enrollJob.Job?.JobId;
  expect(enrollJobId).toBeDefined();
  expect(enrollJob.Job?.JobStatus).toBe("COMPLETED");

  const describedEnrollJob = await client.send(
    new DescribeSpeakerEnrollmentJobCommand({
      DomainId: domainId,
      JobId: enrollJobId,
    }),
  );
  expect(describedEnrollJob.Job?.JobId).toBe(enrollJobId);

  const listedEnrollJobs = await client.send(
    new ListSpeakerEnrollmentJobsCommand({ DomainId: domainId }),
  );
  expect(
    (listedEnrollJobs.JobSummaries ?? []).some((j) => j.JobId === enrollJobId),
  ).toBe(true);

  await client.send(new DeleteDomainCommand({ DomainId: domainId }));
});

test("VoiceID tags", async () => {
  const client = voiceid();
  const kmsKeyId =
    "arn:aws:kms:us-east-1:000000000000:key/bunsai-e2e-voiceid-key";

  const domain = await client.send(
    new CreateDomainCommand({
      Name: "tags-test-domain",
      ServerSideEncryptionConfiguration: { KmsKeyId: kmsKeyId },
    }),
  );
  const arn = domain.Domain?.Arn!;

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "team", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  const tags = Object.fromEntries(
    (listed.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tags["env"]).toBe("test");
  expect(tags["team"]).toBe("bunsai");

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );

  const afterUntag = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  const tagsAfter = Object.fromEntries(
    (afterUntag.Tags ?? []).map((t) => [t.Key, t.Value]),
  );
  expect(tagsAfter["env"]).toBeUndefined();
  expect(tagsAfter["team"]).toBe("bunsai");

  await client.send(
    new DeleteDomainCommand({ DomainId: domain.Domain?.DomainId }),
  );
});
