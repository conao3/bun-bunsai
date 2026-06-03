import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import voiceidModel from "../../../../test/vendor/aws-models/voiceid.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(voiceidModel);

const domainPrefix = "domain:" as const;
const speakerPrefix = "speaker:" as const;
const fraudsterPrefix = "fraudster:" as const;
const watchlistPrefix = "watchlist:" as const;
const enrollJobPrefix = "enrollJob:" as const;
const fraudJobPrefix = "fraudJob:" as const;
const tagsPrefix = "tags:" as const;

type StoredDomain = {
  DomainId: string;
  Arn: string;
  Name: string;
  Description: string | undefined;
  DomainStatus: string;
  ServerSideEncryptionConfiguration: Record<string, unknown>;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredSpeaker = {
  GeneratedSpeakerId: string;
  CustomerSpeakerId: string | undefined;
  DomainId: string;
  Status: string;
  CreatedAt: number;
  UpdatedAt: number;
  LastAccessedAt: number | undefined;
};

type StoredFraudster = {
  GeneratedFraudsterId: string;
  DomainId: string;
  WatchlistIds: string[];
  CreatedAt: number;
};

type StoredWatchlist = {
  WatchlistId: string;
  DomainId: string;
  Name: string;
  Description: string | undefined;
  DefaultWatchlist: boolean;
  CreatedAt: number;
  UpdatedAt: number;
};

type StoredSpeakerEnrollmentJob = {
  JobId: string;
  JobName: string | undefined;
  DomainId: string;
  DataAccessRoleArn: string;
  InputDataConfig: Record<string, unknown>;
  OutputDataConfig: Record<string, unknown>;
  EnrollmentConfig: Record<string, unknown> | undefined;
  JobStatus: string;
  JobProgress: { PercentComplete: number };
  FailureDetails: undefined;
  CreatedAt: number;
  EndedAt: number;
};

type StoredFraudsterRegistrationJob = {
  JobId: string;
  JobName: string | undefined;
  DomainId: string;
  DataAccessRoleArn: string;
  InputDataConfig: Record<string, unknown>;
  OutputDataConfig: Record<string, unknown>;
  RegistrationConfig: Record<string, unknown> | undefined;
  JobStatus: string;
  JobProgress: { PercentComplete: number };
  FailureDetails: undefined;
  CreatedAt: number;
  EndedAt: number;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const recordOrUndefined = (
  value: unknown,
): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = stringOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const requireRecord = (
  input: Record<string, unknown>,
  field: string,
): Record<string, unknown> => {
  const value = recordOrUndefined(input[field]);
  if (value === undefined) {
    throw awsError("ValidationException", `${field} is required.`, 400);
  }
  return value;
};

const genId = (): string => crypto.randomUUID().replace(/-/g, "").slice(0, 22);

const nowSeconds = (): number => Date.now() / 1000;

const domainArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:voiceid:${ctx.region}:${ctx.account}:domain/${id}`;

const domainKey = (id: string): string => `${domainPrefix}${id}`;

const speakerKey = (domainId: string, speakerId: string): string =>
  `${speakerPrefix}${domainId}:${speakerId}`;

const fraudsterKey = (domainId: string, fraudsterId: string): string =>
  `${fraudsterPrefix}${domainId}:${fraudsterId}`;

const watchlistKey = (domainId: string, watchlistId: string): string =>
  `${watchlistPrefix}${domainId}:${watchlistId}`;

const enrollJobKey = (domainId: string, jobId: string): string =>
  `${enrollJobPrefix}${domainId}:${jobId}`;

const fraudJobKey = (domainId: string, jobId: string): string =>
  `${fraudJobPrefix}${domainId}:${jobId}`;

const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const requireDomain = (ctx: ServiceContext, id: string): StoredDomain => {
  const domain = ctx.store.get<StoredDomain>(domainKey(id));
  if (domain === undefined) {
    throw awsError("ResourceNotFoundException", `Domain ${id} not found.`, 400);
  }
  return domain;
};

const requireWatchlist = (
  ctx: ServiceContext,
  domainId: string,
  watchlistId: string,
): StoredWatchlist => {
  const watchlist = ctx.store.get<StoredWatchlist>(
    watchlistKey(domainId, watchlistId),
  );
  if (watchlist === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Watchlist ${watchlistId} not found.`,
      400,
    );
  }
  return watchlist;
};

const requireFraudster = (
  ctx: ServiceContext,
  domainId: string,
  fraudsterId: string,
): StoredFraudster => {
  const fraudster = ctx.store.get<StoredFraudster>(
    fraudsterKey(domainId, fraudsterId),
  );
  if (fraudster === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Fraudster ${fraudsterId} not found.`,
      400,
    );
  }
  return fraudster;
};

const findSpeaker = (
  ctx: ServiceContext,
  domainId: string,
  speakerId: string,
): StoredSpeaker | undefined => {
  const byGenerated = ctx.store.get<StoredSpeaker>(
    speakerKey(domainId, speakerId),
  );
  if (byGenerated !== undefined) return byGenerated;
  return ctx.store
    .list<StoredSpeaker>()
    .filter((e) => e.key.startsWith(`${speakerPrefix}${domainId}:`))
    .map((e) => e.value)
    .find((s) => s.CustomerSpeakerId === speakerId);
};

const requireSpeaker = (
  ctx: ServiceContext,
  domainId: string,
  speakerId: string,
): StoredSpeaker => {
  const speaker = findSpeaker(ctx, domainId, speakerId);
  if (speaker === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Speaker ${speakerId} not found.`,
      400,
    );
  }
  return speaker;
};

const domainView = (domain: StoredDomain): Record<string, unknown> => ({
  DomainId: domain.DomainId,
  Arn: domain.Arn,
  Name: domain.Name,
  Description: domain.Description,
  DomainStatus: domain.DomainStatus,
  ServerSideEncryptionConfiguration: domain.ServerSideEncryptionConfiguration,
  CreatedAt: domain.CreatedAt,
  UpdatedAt: domain.UpdatedAt,
});

const speakerView = (speaker: StoredSpeaker): Record<string, unknown> => ({
  GeneratedSpeakerId: speaker.GeneratedSpeakerId,
  CustomerSpeakerId: speaker.CustomerSpeakerId,
  DomainId: speaker.DomainId,
  Status: speaker.Status,
  CreatedAt: speaker.CreatedAt,
  UpdatedAt: speaker.UpdatedAt,
  LastAccessedAt: speaker.LastAccessedAt,
});

const fraudsterView = (
  fraudster: StoredFraudster,
): Record<string, unknown> => ({
  GeneratedFraudsterId: fraudster.GeneratedFraudsterId,
  DomainId: fraudster.DomainId,
  WatchlistIds: fraudster.WatchlistIds,
  CreatedAt: fraudster.CreatedAt,
});

const watchlistView = (
  watchlist: StoredWatchlist,
): Record<string, unknown> => ({
  WatchlistId: watchlist.WatchlistId,
  DomainId: watchlist.DomainId,
  Name: watchlist.Name,
  Description: watchlist.Description,
  DefaultWatchlist: watchlist.DefaultWatchlist,
  CreatedAt: watchlist.CreatedAt,
  UpdatedAt: watchlist.UpdatedAt,
});

const enrollJobView = (
  job: StoredSpeakerEnrollmentJob,
): Record<string, unknown> => ({
  JobId: job.JobId,
  JobName: job.JobName,
  DomainId: job.DomainId,
  DataAccessRoleArn: job.DataAccessRoleArn,
  InputDataConfig: job.InputDataConfig,
  OutputDataConfig: job.OutputDataConfig,
  EnrollmentConfig: job.EnrollmentConfig,
  JobStatus: job.JobStatus,
  JobProgress: job.JobProgress,
  FailureDetails: job.FailureDetails,
  CreatedAt: job.CreatedAt,
  EndedAt: job.EndedAt,
});

const enrollJobSummaryView = (
  job: StoredSpeakerEnrollmentJob,
): Record<string, unknown> => ({
  JobId: job.JobId,
  JobName: job.JobName,
  DomainId: job.DomainId,
  JobStatus: job.JobStatus,
  JobProgress: job.JobProgress,
  FailureDetails: job.FailureDetails,
  CreatedAt: job.CreatedAt,
  EndedAt: job.EndedAt,
});

const fraudJobView = (
  job: StoredFraudsterRegistrationJob,
): Record<string, unknown> => ({
  JobId: job.JobId,
  JobName: job.JobName,
  DomainId: job.DomainId,
  DataAccessRoleArn: job.DataAccessRoleArn,
  InputDataConfig: job.InputDataConfig,
  OutputDataConfig: job.OutputDataConfig,
  RegistrationConfig: job.RegistrationConfig,
  JobStatus: job.JobStatus,
  JobProgress: job.JobProgress,
  FailureDetails: job.FailureDetails,
  CreatedAt: job.CreatedAt,
  EndedAt: job.EndedAt,
});

const fraudJobSummaryView = (
  job: StoredFraudsterRegistrationJob,
): Record<string, unknown> => ({
  JobId: job.JobId,
  JobName: job.JobName,
  DomainId: job.DomainId,
  JobStatus: job.JobStatus,
  JobProgress: job.JobProgress,
  FailureDetails: job.FailureDetails,
  CreatedAt: job.CreatedAt,
  EndedAt: job.EndedAt,
});

const CreateDomain: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  const sse = requireRecord(input, "ServerSideEncryptionConfiguration");
  requireString(sse, "KmsKeyId");
  const id = genId();
  const now = nowSeconds();
  const domain: StoredDomain = {
    DomainId: id,
    Arn: domainArn(ctx, id),
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DomainStatus: "ACTIVE",
    ServerSideEncryptionConfiguration: sse,
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(domainKey(id), domain);
  return { Domain: domainView(domain) };
};

const DescribeDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  const domain = requireDomain(ctx, id);
  return { Domain: domainView(domain) };
};

const ListDomains: OperationHandler = (_input, ctx) => {
  const domains = ctx.store
    .list<StoredDomain>()
    .filter((entry) => entry.key.startsWith(domainPrefix))
    .map((entry) => entry.value)
    .sort((a, b) =>
      a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
    );
  return { DomainSummaries: domains.map(domainView) };
};

const DeleteDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  requireDomain(ctx, id);
  ctx.store.delete(domainKey(id));
  return {};
};

const UpdateDomain: OperationHandler = (input, ctx) => {
  const id = requireString(input, "DomainId");
  const name = requireString(input, "Name");
  const sse = requireRecord(input, "ServerSideEncryptionConfiguration");
  requireString(sse, "KmsKeyId");
  const domain = requireDomain(ctx, id);
  const updated: StoredDomain = {
    ...domain,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    ServerSideEncryptionConfiguration: sse,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(domainKey(id), updated);
  return { Domain: domainView(updated) };
};

const DescribeSpeaker: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const speakerId = requireString(input, "SpeakerId");
  const speaker = requireSpeaker(ctx, domainId, speakerId);
  return { Speaker: speakerView(speaker) };
};

const ListSpeakers: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const speakers = ctx.store
    .list<StoredSpeaker>()
    .filter((e) => e.key.startsWith(`${speakerPrefix}${domainId}:`))
    .map((e) => e.value)
    .sort((a, b) =>
      a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
    );
  return { SpeakerSummaries: speakers.map(speakerView) };
};

const DeleteSpeaker: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const speakerId = requireString(input, "SpeakerId");
  const speaker = requireSpeaker(ctx, domainId, speakerId);
  ctx.store.delete(speakerKey(domainId, speaker.GeneratedSpeakerId));
  return {};
};

const OptOutSpeaker: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const speakerId = requireString(input, "SpeakerId");
  const speaker = requireSpeaker(ctx, domainId, speakerId);
  const updated: StoredSpeaker = {
    ...speaker,
    Status: "OPTED_OUT",
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(speakerKey(domainId, speaker.GeneratedSpeakerId), updated);
  return { Speaker: speakerView(updated) };
};

const CreateWatchlist: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const name = requireString(input, "Name");
  const id = genId();
  const now = nowSeconds();
  const watchlist: StoredWatchlist = {
    WatchlistId: id,
    DomainId: domainId,
    Name: name,
    Description: stringOrUndefined(input["Description"]),
    DefaultWatchlist: false,
    CreatedAt: now,
    UpdatedAt: now,
  };
  ctx.store.set(watchlistKey(domainId, id), watchlist);
  return { Watchlist: watchlistView(watchlist) };
};

const DescribeWatchlist: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const watchlistId = requireString(input, "WatchlistId");
  const watchlist = requireWatchlist(ctx, domainId, watchlistId);
  return { Watchlist: watchlistView(watchlist) };
};

const UpdateWatchlist: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const watchlistId = requireString(input, "WatchlistId");
  const watchlist = requireWatchlist(ctx, domainId, watchlistId);
  const updated: StoredWatchlist = {
    ...watchlist,
    Name: stringOrUndefined(input["Name"]) ?? watchlist.Name,
    Description:
      input["Description"] !== undefined
        ? stringOrUndefined(input["Description"])
        : watchlist.Description,
    UpdatedAt: nowSeconds(),
  };
  ctx.store.set(watchlistKey(domainId, watchlistId), updated);
  return { Watchlist: watchlistView(updated) };
};

const DeleteWatchlist: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const watchlistId = requireString(input, "WatchlistId");
  requireWatchlist(ctx, domainId, watchlistId);
  ctx.store.delete(watchlistKey(domainId, watchlistId));
  return {};
};

const ListWatchlists: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const watchlists = ctx.store
    .list<StoredWatchlist>()
    .filter((e) => e.key.startsWith(`${watchlistPrefix}${domainId}:`))
    .map((e) => e.value)
    .sort((a, b) =>
      a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
    );
  return { WatchlistSummaries: watchlists.map(watchlistView) };
};

const DescribeFraudster: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const fraudsterId = requireString(input, "FraudsterId");
  const fraudster = requireFraudster(ctx, domainId, fraudsterId);
  return { Fraudster: fraudsterView(fraudster) };
};

const ListFraudsters: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const watchlistId = stringOrUndefined(input["WatchlistId"]);
  let fraudsters = ctx.store
    .list<StoredFraudster>()
    .filter((e) => e.key.startsWith(`${fraudsterPrefix}${domainId}:`))
    .map((e) => e.value);
  if (watchlistId !== undefined) {
    fraudsters = fraudsters.filter((f) => f.WatchlistIds.includes(watchlistId));
  }
  fraudsters.sort((a, b) =>
    a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
  );
  return { FraudsterSummaries: fraudsters.map(fraudsterView) };
};

const DeleteFraudster: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const fraudsterId = requireString(input, "FraudsterId");
  requireFraudster(ctx, domainId, fraudsterId);
  ctx.store.delete(fraudsterKey(domainId, fraudsterId));
  return {};
};

const AssociateFraudster: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const fraudsterId = requireString(input, "FraudsterId");
  const watchlistId = requireString(input, "WatchlistId");
  requireWatchlist(ctx, domainId, watchlistId);
  const fraudster = requireFraudster(ctx, domainId, fraudsterId);
  if (fraudster.WatchlistIds.includes(watchlistId)) {
    return { Fraudster: fraudsterView(fraudster) };
  }
  const updated: StoredFraudster = {
    ...fraudster,
    WatchlistIds: [...fraudster.WatchlistIds, watchlistId],
  };
  ctx.store.set(fraudsterKey(domainId, fraudsterId), updated);
  return { Fraudster: fraudsterView(updated) };
};

const DisassociateFraudster: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const fraudsterId = requireString(input, "FraudsterId");
  const watchlistId = requireString(input, "WatchlistId");
  const fraudster = requireFraudster(ctx, domainId, fraudsterId);
  const updated: StoredFraudster = {
    ...fraudster,
    WatchlistIds: fraudster.WatchlistIds.filter((id) => id !== watchlistId),
  };
  ctx.store.set(fraudsterKey(domainId, fraudsterId), updated);
  return { Fraudster: fraudsterView(updated) };
};

const StartSpeakerEnrollmentJob: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const dataAccessRoleArn = requireString(input, "DataAccessRoleArn");
  const inputDataConfig = requireRecord(input, "InputDataConfig");
  const outputDataConfig = requireRecord(input, "OutputDataConfig");
  const jobId = genId();
  const now = nowSeconds();
  const job: StoredSpeakerEnrollmentJob = {
    JobId: jobId,
    JobName: stringOrUndefined(input["JobName"]),
    DomainId: domainId,
    DataAccessRoleArn: dataAccessRoleArn,
    InputDataConfig: inputDataConfig,
    OutputDataConfig: outputDataConfig,
    EnrollmentConfig: recordOrUndefined(input["EnrollmentConfig"]),
    JobStatus: "COMPLETED",
    JobProgress: { PercentComplete: 100 },
    FailureDetails: undefined,
    CreatedAt: now,
    EndedAt: now,
  };
  ctx.store.set(enrollJobKey(domainId, jobId), job);
  return { Job: enrollJobView(job) };
};

const DescribeSpeakerEnrollmentJob: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const jobId = requireString(input, "JobId");
  const job = ctx.store.get<StoredSpeakerEnrollmentJob>(
    enrollJobKey(domainId, jobId),
  );
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `SpeakerEnrollmentJob ${jobId} not found.`,
      400,
    );
  }
  return { Job: enrollJobView(job) };
};

const ListSpeakerEnrollmentJobs: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const statusFilter = stringOrUndefined(input["JobStatus"]);
  let jobs = ctx.store
    .list<StoredSpeakerEnrollmentJob>()
    .filter((e) => e.key.startsWith(`${enrollJobPrefix}${domainId}:`))
    .map((e) => e.value);
  if (statusFilter !== undefined) {
    jobs = jobs.filter((j) => j.JobStatus === statusFilter);
  }
  jobs.sort((a, b) =>
    a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
  );
  return { JobSummaries: jobs.map(enrollJobSummaryView) };
};

const StartFraudsterRegistrationJob: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const dataAccessRoleArn = requireString(input, "DataAccessRoleArn");
  const inputDataConfig = requireRecord(input, "InputDataConfig");
  const outputDataConfig = requireRecord(input, "OutputDataConfig");
  const registrationConfig = recordOrUndefined(input["RegistrationConfig"]);
  const jobId = genId();
  const now = nowSeconds();
  const job: StoredFraudsterRegistrationJob = {
    JobId: jobId,
    JobName: stringOrUndefined(input["JobName"]),
    DomainId: domainId,
    DataAccessRoleArn: dataAccessRoleArn,
    InputDataConfig: inputDataConfig,
    OutputDataConfig: outputDataConfig,
    RegistrationConfig: registrationConfig,
    JobStatus: "COMPLETED",
    JobProgress: { PercentComplete: 100 },
    FailureDetails: undefined,
    CreatedAt: now,
    EndedAt: now,
  };
  ctx.store.set(fraudJobKey(domainId, jobId), job);
  const fraudsterId = genId();
  const watchlistIds = Array.isArray(registrationConfig?.["WatchlistIds"])
    ? (registrationConfig["WatchlistIds"] as string[])
    : [];
  const fraudster: StoredFraudster = {
    GeneratedFraudsterId: fraudsterId,
    DomainId: domainId,
    WatchlistIds: watchlistIds,
    CreatedAt: now,
  };
  ctx.store.set(fraudsterKey(domainId, fraudsterId), fraudster);
  return { Job: fraudJobView(job) };
};

const DescribeFraudsterRegistrationJob: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const jobId = requireString(input, "JobId");
  const job = ctx.store.get<StoredFraudsterRegistrationJob>(
    fraudJobKey(domainId, jobId),
  );
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `FraudsterRegistrationJob ${jobId} not found.`,
      400,
    );
  }
  return { Job: fraudJobView(job) };
};

const ListFraudsterRegistrationJobs: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const statusFilter = stringOrUndefined(input["JobStatus"]);
  let jobs = ctx.store
    .list<StoredFraudsterRegistrationJob>()
    .filter((e) => e.key.startsWith(`${fraudJobPrefix}${domainId}:`))
    .map((e) => e.value);
  if (statusFilter !== undefined) {
    jobs = jobs.filter((j) => j.JobStatus === statusFilter);
  }
  jobs.sort((a, b) =>
    a.CreatedAt < b.CreatedAt ? -1 : a.CreatedAt > b.CreatedAt ? 1 : 0,
  );
  return { JobSummaries: jobs.map(fraudJobSummaryView) };
};

const EvaluateSession: OperationHandler = (input, ctx) => {
  const domainId = requireString(input, "DomainId");
  requireDomain(ctx, domainId);
  const sessionNameOrId = requireString(input, "SessionNameOrId");
  const now = nowSeconds();
  const existing = ctx.store
    .list<StoredSpeaker>()
    .filter((e) => e.key.startsWith(`${speakerPrefix}${domainId}:`))
    .map((e) => e.value)
    .find((s) => s.CustomerSpeakerId === sessionNameOrId);
  const speaker: StoredSpeaker = existing ?? {
    GeneratedSpeakerId: genId(),
    CustomerSpeakerId: sessionNameOrId,
    DomainId: domainId,
    Status: "ENROLLED",
    CreatedAt: now,
    UpdatedAt: now,
    LastAccessedAt: now,
  };
  if (existing === undefined) {
    ctx.store.set(speakerKey(domainId, speaker.GeneratedSpeakerId), speaker);
  } else {
    ctx.store.set(speakerKey(domainId, speaker.GeneratedSpeakerId), {
      ...speaker,
      LastAccessedAt: now,
    });
  }
  return {
    DomainId: domainId,
    SessionId: genId(),
    SessionName: sessionNameOrId,
    StreamingStatus: "ENDED",
    AuthenticationResult: {
      AuthenticationResultId: genId(),
      Decision: "ACCEPT",
      Score: 90,
      GeneratedSpeakerId: speaker.GeneratedSpeakerId,
      CustomerSpeakerId: sessionNameOrId,
      Configuration: { AcceptanceThreshold: 90 },
    },
    FraudDetectionResult: {
      FraudDetectionResultId: genId(),
      Decision: "NOT_FRAUD",
      Reasons: [],
      RiskDetails: {
        KnownFraudsterRisk: { RiskScore: 5 },
        VoiceSpoofingRisk: { RiskScore: 3 },
      },
    },
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = input["Tags"];
  if (!Array.isArray(tags)) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const tag of tags as Array<Record<string, string>>) {
    existing[tag["Key"]] = tag["Value"];
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tagKeys = input["TagKeys"];
  if (!Array.isArray(tagKeys)) {
    throw awsError("ValidationException", "TagKeys is required.", 400);
  }
  const existing = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  for (const key of tagKeys as string[]) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "ResourceArn");
  const tags = ctx.store.get<Record<string, string>>(tagsKey(arn)) ?? {};
  return {
    Tags: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })),
  };
};

const voiceid = {
  name: "voiceid",
  protocol: "json",
  operations: {
    CreateDomain,
    DescribeDomain,
    ListDomains,
    DeleteDomain,
    UpdateDomain,
    DescribeSpeaker,
    ListSpeakers,
    DeleteSpeaker,
    OptOutSpeaker,
    CreateWatchlist,
    DescribeWatchlist,
    UpdateWatchlist,
    DeleteWatchlist,
    ListWatchlists,
    DescribeFraudster,
    ListFraudsters,
    DeleteFraudster,
    AssociateFraudster,
    DisassociateFraudster,
    StartSpeakerEnrollmentJob,
    DescribeSpeakerEnrollmentJob,
    ListSpeakerEnrollmentJobs,
    StartFraudsterRegistrationJob,
    DescribeFraudsterRegistrationJob,
    ListFraudsterRegistrationJobs,
    EvaluateSession,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default voiceid;
