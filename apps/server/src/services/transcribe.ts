import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import transcribeModel from "../../../../test/vendor/aws-models/transcribe.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(transcribeModel);

type StoredJob = {
  TranscriptionJobName: string;
  TranscriptionJobStatus: string;
  LanguageCode: string | undefined;
  MediaSampleRateHertz: number | undefined;
  MediaFormat: string | undefined;
  Media: Record<string, unknown>;
  Transcript: { TranscriptFileUri: string };
  StartTime: Date;
  CreationTime: Date;
  CompletionTime: Date;
};

const jobKey = (name: string): string => `job/${name}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("BadRequestException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const numberOrUndefined = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const requireJob = (ctx: ServiceContext, name: string): StoredJob => {
  const job = ctx.store.get<StoredJob>(jobKey(name));
  if (job === undefined) {
    throw awsError(
      "NotFoundException",
      `The requested job couldn't be found: ${name}`,
      400,
    );
  }
  return job;
};

const StartTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TranscriptionJobName");
  const media = input["Media"];
  if (media === null || typeof media !== "object") {
    throw awsError("BadRequestException", "Media is required.", 400);
  }
  if (ctx.store.get<StoredJob>(jobKey(name)) !== undefined) {
    throw awsError(
      "ConflictException",
      `A job with the name ${name} already exists.`,
      400,
    );
  }
  const now = new Date();
  const job: StoredJob = {
    TranscriptionJobName: name,
    TranscriptionJobStatus: "COMPLETED",
    LanguageCode: stringOrUndefined(input["LanguageCode"]),
    MediaSampleRateHertz: numberOrUndefined(input["MediaSampleRateHertz"]),
    MediaFormat: stringOrUndefined(input["MediaFormat"]),
    Media: media as Record<string, unknown>,
    Transcript: {
      TranscriptFileUri: `https://s3.${ctx.region}.amazonaws.com/bunsai-transcribe/${name}.json`,
    },
    StartTime: now,
    CreationTime: now,
    CompletionTime: now,
  };
  ctx.store.set(jobKey(name), job);
  return { TranscriptionJob: job };
};

const GetTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TranscriptionJobName");
  const job = requireJob(ctx, name);
  return { TranscriptionJob: job };
};

const ListTranscriptionJobs: OperationHandler = (input, ctx) => {
  const status = stringOrUndefined(input["Status"]);
  const summaries = ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith("job/"))
    .map((entry) => entry.value)
    .map((job) => ({
      TranscriptionJobName: job.TranscriptionJobName,
      CreationTime: job.CreationTime,
      StartTime: job.StartTime,
      CompletionTime: job.CompletionTime,
      LanguageCode: job.LanguageCode,
      TranscriptionJobStatus: job.TranscriptionJobStatus,
      OutputLocationType: "SERVICE_BUCKET",
    }));
  return { TranscriptionJobSummaries: summaries };
};

const DeleteTranscriptionJob: OperationHandler = (input, ctx) => {
  const name = requireString(input, "TranscriptionJobName");
  ctx.store.delete(jobKey(name));
  return {};
};

const transcribe = {
  name: "transcribe",
  protocol: "json",
  operations: {
    StartTranscriptionJob,
    GetTranscriptionJob,
    ListTranscriptionJobs,
    DeleteTranscriptionJob,
  },
  model,
} as const satisfies ServiceDefinition;

export default transcribe;
