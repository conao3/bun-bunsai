import { expect, test } from "bun:test";
import { startServer } from "./harness.ts";
import {
  CreateCallAnalyticsCategoryCommand,
  CreateLanguageModelCommand,
  CreateMedicalVocabularyCommand,
  CreateVocabularyCommand,
  CreateVocabularyFilterCommand,
  DeleteCallAnalyticsCategoryCommand,
  DeleteCallAnalyticsJobCommand,
  DeleteMedicalScribeJobCommand,
  DeleteMedicalTranscriptionJobCommand,
  DeleteMedicalVocabularyCommand,
  DeleteTranscriptionJobCommand,
  DeleteVocabularyCommand,
  DeleteVocabularyFilterCommand,
  DescribeLanguageModelCommand,
  GetCallAnalyticsCategoryCommand,
  GetCallAnalyticsJobCommand,
  GetMedicalScribeJobCommand,
  GetMedicalTranscriptionJobCommand,
  GetMedicalVocabularyCommand,
  GetTranscriptionJobCommand,
  GetVocabularyCommand,
  GetVocabularyFilterCommand,
  ListCallAnalyticsCategoriesCommand,
  ListCallAnalyticsJobsCommand,
  ListLanguageModelsCommand,
  ListMedicalScribeJobsCommand,
  ListMedicalTranscriptionJobsCommand,
  ListMedicalVocabulariesCommand,
  ListTagsForResourceCommand,
  ListTranscriptionJobsCommand,
  ListVocabulariesCommand,
  ListVocabularyFiltersCommand,
  StartCallAnalyticsJobCommand,
  StartMedicalScribeJobCommand,
  StartMedicalTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TagResourceCommand,
  TranscribeClient,
  UntagResourceCommand,
  UpdateCallAnalyticsCategoryCommand,
  UpdateMedicalVocabularyCommand,
  UpdateVocabularyCommand,
  UpdateVocabularyFilterCommand,
} from "@aws-sdk/client-transcribe";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const { endpoint } = startServer();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const transcribe = () =>
  new TranscribeClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Transcribe transcription job lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-job";

  const started = await client.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: name,
      Media: { MediaFileUri: "s3://bunsai-e2e/sample.flac" },
    }),
  );
  expect(started.TranscriptionJob?.TranscriptionJobName).toBe(name);
  expect(started.TranscriptionJob?.TranscriptionJobStatus).toBe("COMPLETED");

  const got = await client.send(
    new GetTranscriptionJobCommand({ TranscriptionJobName: name }),
  );
  expect(got.TranscriptionJob?.TranscriptionJobName).toBe(name);
  expect(got.TranscriptionJob?.Transcript?.TranscriptFileUri).toContain(name);

  const listed = await client.send(new ListTranscriptionJobsCommand({}));
  expect(
    (listed.TranscriptionJobSummaries ?? []).some(
      (summary) => summary.TranscriptionJobName === name,
    ),
  ).toBe(true);

  await client.send(
    new DeleteTranscriptionJobCommand({ TranscriptionJobName: name }),
  );
});

test("Transcribe vocabulary lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-vocab";

  const created = await client.send(
    new CreateVocabularyCommand({
      VocabularyName: name,
      LanguageCode: "en-US",
      VocabularyFileUri: "s3://bunsai-e2e/vocab.txt",
    }),
  );
  expect(created.VocabularyName).toBe(name);
  expect(created.VocabularyState).toBe("READY");

  const got = await client.send(
    new GetVocabularyCommand({ VocabularyName: name }),
  );
  expect(got.VocabularyName).toBe(name);
  expect(got.LanguageCode).toBe("en-US");

  const listed = await client.send(new ListVocabulariesCommand({}));
  expect(
    (listed.Vocabularies ?? []).some((v) => v.VocabularyName === name),
  ).toBe(true);

  const updated = await client.send(
    new UpdateVocabularyCommand({
      VocabularyName: name,
      LanguageCode: "en-US",
      VocabularyFileUri: "s3://bunsai-e2e/vocab-v2.txt",
    }),
  );
  expect(updated.VocabularyState).toBe("READY");

  await client.send(new DeleteVocabularyCommand({ VocabularyName: name }));
});

test("Transcribe vocabulary filter lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-filter";

  const created = await client.send(
    new CreateVocabularyFilterCommand({
      VocabularyFilterName: name,
      LanguageCode: "en-US",
      Words: ["badword"],
    }),
  );
  expect(created.VocabularyFilterName).toBe(name);
  expect(created.LanguageCode).toBe("en-US");

  const got = await client.send(
    new GetVocabularyFilterCommand({ VocabularyFilterName: name }),
  );
  expect(got.VocabularyFilterName).toBe(name);

  const listed = await client.send(new ListVocabularyFiltersCommand({}));
  expect(
    (listed.VocabularyFilters ?? []).some(
      (f) => f.VocabularyFilterName === name,
    ),
  ).toBe(true);

  const updated = await client.send(
    new UpdateVocabularyFilterCommand({
      VocabularyFilterName: name,
      Words: ["badword", "otherword"],
    }),
  );
  expect(updated.VocabularyFilterName).toBe(name);

  await client.send(
    new DeleteVocabularyFilterCommand({ VocabularyFilterName: name }),
  );
});

test("Transcribe language model lifecycle", async () => {
  const client = transcribe();
  const modelName = "bunsai-e2e-model";

  const created = await client.send(
    new CreateLanguageModelCommand({
      LanguageCode: "en-US",
      BaseModelName: "NarrowBand",
      ModelName: modelName,
      InputDataConfig: {
        S3Uri: "s3://bunsai-e2e/lm/",
        DataAccessRoleArn: "arn:aws:iam::000000000000:role/test",
      },
    }),
  );
  expect(created.ModelName).toBe(modelName);
  expect(created.ModelStatus).toBe("COMPLETED");

  const described = await client.send(
    new DescribeLanguageModelCommand({ ModelName: modelName }),
  );
  expect(described.LanguageModel?.ModelName).toBe(modelName);
  expect(described.LanguageModel?.LanguageCode).toBe("en-US");

  const listed = await client.send(new ListLanguageModelsCommand({}));
  expect((listed.Models ?? []).some((m) => m.ModelName === modelName)).toBe(
    true,
  );
});

test("Transcribe call analytics category + job lifecycle", async () => {
  const client = transcribe();
  const categoryName = "bunsai-e2e-cat";
  const jobName = "bunsai-e2e-ca-job";

  const created = await client.send(
    new CreateCallAnalyticsCategoryCommand({
      CategoryName: categoryName,
      Rules: [],
    }),
  );
  expect(created.CategoryProperties?.CategoryName).toBe(categoryName);

  const got = await client.send(
    new GetCallAnalyticsCategoryCommand({ CategoryName: categoryName }),
  );
  expect(got.CategoryProperties?.CategoryName).toBe(categoryName);

  const listed = await client.send(new ListCallAnalyticsCategoriesCommand({}));
  expect(
    (listed.Categories ?? []).some((c) => c.CategoryName === categoryName),
  ).toBe(true);

  const updated = await client.send(
    new UpdateCallAnalyticsCategoryCommand({
      CategoryName: categoryName,
      Rules: [],
    }),
  );
  expect(updated.CategoryProperties?.CategoryName).toBe(categoryName);

  const startedJob = await client.send(
    new StartCallAnalyticsJobCommand({
      CallAnalyticsJobName: jobName,
      Media: { MediaFileUri: "s3://bunsai-e2e/call.wav" },
      DataAccessRoleArn: "arn:aws:iam::000000000000:role/test",
    }),
  );
  expect(startedJob.CallAnalyticsJob?.CallAnalyticsJobName).toBe(jobName);
  expect(startedJob.CallAnalyticsJob?.CallAnalyticsJobStatus).toBe("COMPLETED");

  const gotJob = await client.send(
    new GetCallAnalyticsJobCommand({ CallAnalyticsJobName: jobName }),
  );
  expect(gotJob.CallAnalyticsJob?.CallAnalyticsJobName).toBe(jobName);

  const listedJobs = await client.send(new ListCallAnalyticsJobsCommand({}));
  expect(
    (listedJobs.CallAnalyticsJobSummaries ?? []).some(
      (j) => j.CallAnalyticsJobName === jobName,
    ),
  ).toBe(true);

  await client.send(
    new DeleteCallAnalyticsJobCommand({ CallAnalyticsJobName: jobName }),
  );
  await client.send(
    new DeleteCallAnalyticsCategoryCommand({ CategoryName: categoryName }),
  );
});

test("Transcribe medical vocabulary lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-med-vocab";

  const created = await client.send(
    new CreateMedicalVocabularyCommand({
      VocabularyName: name,
      LanguageCode: "en-US",
      VocabularyFileUri: "s3://bunsai-e2e/med-vocab.txt",
    }),
  );
  expect(created.VocabularyName).toBe(name);
  expect(created.VocabularyState).toBe("READY");

  const got = await client.send(
    new GetMedicalVocabularyCommand({ VocabularyName: name }),
  );
  expect(got.VocabularyName).toBe(name);

  const listed = await client.send(new ListMedicalVocabulariesCommand({}));
  expect(
    (listed.Vocabularies ?? []).some((v) => v.VocabularyName === name),
  ).toBe(true);

  const updated = await client.send(
    new UpdateMedicalVocabularyCommand({
      VocabularyName: name,
      LanguageCode: "en-US",
      VocabularyFileUri: "s3://bunsai-e2e/med-vocab-v2.txt",
    }),
  );
  expect(updated.VocabularyState).toBe("READY");

  await client.send(
    new DeleteMedicalVocabularyCommand({ VocabularyName: name }),
  );
});

test("Transcribe medical transcription job lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-med-job";

  const started = await client.send(
    new StartMedicalTranscriptionJobCommand({
      MedicalTranscriptionJobName: name,
      LanguageCode: "en-US",
      Media: { MediaFileUri: "s3://bunsai-e2e/med.flac" },
      OutputBucketName: "bunsai-med-output",
      Specialty: "PRIMARYCARE",
      Type: "DICTATION",
    }),
  );
  expect(started.MedicalTranscriptionJob?.MedicalTranscriptionJobName).toBe(
    name,
  );
  expect(started.MedicalTranscriptionJob?.TranscriptionJobStatus).toBe(
    "COMPLETED",
  );

  const got = await client.send(
    new GetMedicalTranscriptionJobCommand({
      MedicalTranscriptionJobName: name,
    }),
  );
  expect(got.MedicalTranscriptionJob?.MedicalTranscriptionJobName).toBe(name);

  const listed = await client.send(new ListMedicalTranscriptionJobsCommand({}));
  expect(
    (listed.MedicalTranscriptionJobSummaries ?? []).some(
      (j) => j.MedicalTranscriptionJobName === name,
    ),
  ).toBe(true);

  await client.send(
    new DeleteMedicalTranscriptionJobCommand({
      MedicalTranscriptionJobName: name,
    }),
  );
});

test("Transcribe medical scribe job lifecycle", async () => {
  const client = transcribe();
  const name = "bunsai-e2e-scribe-job";

  const started = await client.send(
    new StartMedicalScribeJobCommand({
      MedicalScribeJobName: name,
      Media: { MediaFileUri: "s3://bunsai-e2e/scribe.wav" },
      OutputBucketName: "bunsai-scribe-output",
      DataAccessRoleArn: "arn:aws:iam::000000000000:role/test",
      Settings: { ShowSpeakerLabels: false, MaxSpeakerLabels: 2 },
    }),
  );
  expect(started.MedicalScribeJob?.MedicalScribeJobName).toBe(name);
  expect(started.MedicalScribeJob?.MedicalScribeJobStatus).toBe("COMPLETED");

  const got = await client.send(
    new GetMedicalScribeJobCommand({ MedicalScribeJobName: name }),
  );
  expect(got.MedicalScribeJob?.MedicalScribeJobName).toBe(name);
  expect(
    got.MedicalScribeJob?.MedicalScribeOutput?.TranscriptFileUri,
  ).toBeTruthy();

  const listed = await client.send(new ListMedicalScribeJobsCommand({}));
  expect(
    (listed.MedicalScribeJobSummaries ?? []).some(
      (j) => j.MedicalScribeJobName === name,
    ),
  ).toBe(true);

  await client.send(
    new DeleteMedicalScribeJobCommand({ MedicalScribeJobName: name }),
  );
});

test("Transcribe tag resource lifecycle", async () => {
  const client = transcribe();
  const arn =
    "arn:aws:transcribe:us-east-1:000000000000:vocabulary/bunsai-tag-test";

  await client.send(
    new TagResourceCommand({
      ResourceArn: arn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const listed = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect(listed.ResourceArn).toBe(arn);
  expect(
    (listed.Tags ?? []).some((t) => t.Key === "env" && t.Value === "test"),
  ).toBe(true);

  await client.send(
    new UntagResourceCommand({ ResourceArn: arn, TagKeys: ["env"] }),
  );

  const after = await client.send(
    new ListTagsForResourceCommand({ ResourceArn: arn }),
  );
  expect((after.Tags ?? []).length).toBe(0);
});
