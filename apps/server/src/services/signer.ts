import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import signerModel from "../../../../test/vendor/aws-models/signer.json" with { type: "json" };
import type {
  OperationHandler,
  ParsedRequest,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(signerModel);

const profilePrefix = "profile:" as const;
const jobPrefix = "job:" as const;
const permPrefix = "perm:" as const;
const permRevPrefix = "permrev:" as const;
const tagsPrefix = "tags:" as const;

type StoredProfile = {
  profileName: string;
  profileVersion: string;
  profileVersionArn: string;
  arn: string;
  platformId: string;
  platformDisplayName: string | undefined;
  signingMaterial: Record<string, unknown> | undefined;
  signatureValidityPeriod: Record<string, unknown> | undefined;
  overrides: Record<string, unknown> | undefined;
  signingParameters: Record<string, unknown> | undefined;
  status: string;
  tags: Record<string, unknown> | undefined;
  revocationRecord: Record<string, unknown> | undefined;
};

type StoredJob = {
  jobId: string;
  source: Record<string, unknown> | undefined;
  destination: Record<string, unknown> | undefined;
  profileName: string;
  profileVersion: string;
  platformId: string;
  platformDisplayName: string | undefined;
  status: string;
  statusReason: string | undefined;
  createdAt: number;
  completedAt: number | undefined;
  signingMaterial: Record<string, unknown> | undefined;
  signingParameters: Record<string, unknown> | undefined;
  overrides: Record<string, unknown> | undefined;
  requestedBy: string;
  jobOwner: string;
  jobInvoker: string;
  revocationRecord: Record<string, unknown> | undefined;
  signedObject: Record<string, unknown> | undefined;
  signatureExpiresAt: number | undefined;
  isPayload: boolean;
};

type StoredPermission = {
  statementId: string;
  action: string;
  principal: string;
  profileVersion: string | undefined;
};

type StoredPermissions = Record<string, StoredPermission>;

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

const profileKey = (name: string): string => `${profilePrefix}${name}`;
const jobKey = (id: string): string => `${jobPrefix}${id}`;
const permKey = (profileName: string): string => `${permPrefix}${profileName}`;
const permRevKey = (profileName: string): string =>
  `${permRevPrefix}${profileName}`;
const tagsKey = (arn: string): string => `${tagsPrefix}${arn}`;

const profileArn = (ctx: ServiceContext, name: string): string =>
  `arn:aws:signer:${ctx.region}:${ctx.account}:/signing-profiles/${name}`;

const jobArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:signer:${ctx.region}:${ctx.account}:/signing-jobs/${id}`;

const newId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

const encodeToken = (offset: number): string => btoa(String(offset));

const decodeToken = (token: string): number => {
  try {
    const n = Number(atob(token));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
};

const profileView = (profile: StoredProfile): Record<string, unknown> => ({
  profileName: profile.profileName,
  profileVersion: profile.profileVersion,
  profileVersionArn: profile.profileVersionArn,
  arn: profile.arn,
  platformId: profile.platformId,
  platformDisplayName: profile.platformDisplayName,
  signingMaterial: profile.signingMaterial,
  signatureValidityPeriod: profile.signatureValidityPeriod,
  overrides: profile.overrides,
  signingParameters: profile.signingParameters,
  status: profile.status,
  tags: profile.tags,
  revocationRecord: profile.revocationRecord,
});

const profileSummary = (profile: StoredProfile): Record<string, unknown> => ({
  profileName: profile.profileName,
  profileVersion: profile.profileVersion,
  profileVersionArn: profile.profileVersionArn,
  arn: profile.arn,
  platformId: profile.platformId,
  platformDisplayName: profile.platformDisplayName,
  signingMaterial: profile.signingMaterial,
  signatureValidityPeriod: profile.signatureValidityPeriod,
  signingParameters: profile.signingParameters,
  status: profile.status,
  tags: profile.tags,
  revocationRecord: profile.revocationRecord,
});

const requireProfile = (ctx: ServiceContext, name: string): StoredProfile => {
  const profile = ctx.store.get<StoredProfile>(profileKey(name));
  if (profile === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Signing profile ${name} not found.`,
      404,
    );
  }
  return profile;
};

const requireJob = (ctx: ServiceContext, id: string): StoredJob => {
  const job = ctx.store.get<StoredJob>(jobKey(id));
  if (job === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Signing job ${id} not found.`,
      404,
    );
  }
  return job;
};

const PLATFORMS = [
  {
    platformId: "AWSLambda-SHA384-ECDSA",
    displayName: "AWS Lambda",
    partner: "AWS",
    target: "AWSLambda",
    category: "AWS",
    signingConfiguration: {
      encryptionAlgorithmOptions: {
        allowedValues: ["ECDSA"],
        defaultValue: "ECDSA",
      },
      hashAlgorithmOptions: {
        allowedValues: ["SHA384"],
        defaultValue: "SHA384",
      },
    },
    signingImageFormat: {
      supportedFormats: ["JSONEmbedded"],
      defaultFormat: "JSONEmbedded",
    },
    maxSizeInMB: 250,
    revocationSupported: false,
  },
  {
    platformId: "AmazonFreeRTOS-TI-CC3220SF",
    displayName: "Amazon FreeRTOS SHA1-RSA CC3220SF-Format",
    partner: "AmazonFreeRTOS",
    target: "AmazonFreeRTOS-TI-CC3220SF",
    category: "IoT",
    signingConfiguration: {
      encryptionAlgorithmOptions: {
        allowedValues: ["RSA"],
        defaultValue: "RSA",
      },
      hashAlgorithmOptions: {
        allowedValues: ["SHA1"],
        defaultValue: "SHA1",
      },
    },
    signingImageFormat: {
      supportedFormats: ["JSON"],
      defaultFormat: "JSON",
    },
    maxSizeInMB: 16,
    revocationSupported: false,
  },
] as const;

const PutSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  const platformId = requireString(input, "platformId");
  const version = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const arn = profileArn(ctx, name);
  const profileVersionArn = `${arn}/${version}`;
  const profile: StoredProfile = {
    profileName: name,
    profileVersion: version,
    profileVersionArn,
    arn,
    platformId,
    platformDisplayName: stringOrUndefined(input["platformDisplayName"]),
    signingMaterial: recordOrUndefined(input["signingMaterial"]),
    signatureValidityPeriod: recordOrUndefined(
      input["signatureValidityPeriod"],
    ),
    overrides: recordOrUndefined(input["overrides"]),
    signingParameters: recordOrUndefined(input["signingParameters"]),
    status: "Active",
    tags: recordOrUndefined(input["tags"]),
    revocationRecord: undefined,
  };
  ctx.store.set(profileKey(name), profile);
  return {
    arn,
    profileVersion: version,
    profileVersionArn,
  };
};

const GetSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  return profileView(requireProfile(ctx, name));
};

const ListSigningProfiles: OperationHandler = (input, ctx) => {
  const includeCanceled = input["includeCanceled"] === true;
  const platformId = stringOrUndefined(input["platformId"]);
  const statuses = Array.isArray(input["statuses"])
    ? (input["statuses"] as string[])
    : undefined;
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : undefined;
  const nextTokenInput = stringOrUndefined(input["nextToken"]);
  const profiles = ctx.store
    .list<StoredProfile>()
    .filter((entry) => entry.key.startsWith(profilePrefix))
    .map((entry) => entry.value)
    .filter((profile) => includeCanceled || profile.status !== "Canceled")
    .filter(
      (profile) =>
        platformId === undefined || profile.platformId === platformId,
    )
    .filter(
      (profile) => statuses === undefined || statuses.includes(profile.status),
    )
    .sort((a, b) =>
      a.profileName < b.profileName
        ? -1
        : a.profileName > b.profileName
          ? 1
          : 0,
    );
  const offset = nextTokenInput !== undefined ? decodeToken(nextTokenInput) : 0;
  const page =
    maxResults !== undefined
      ? profiles.slice(offset, offset + maxResults)
      : profiles.slice(offset);
  const hasMore =
    maxResults !== undefined && offset + maxResults < profiles.length;
  return {
    profiles: page.map(profileSummary),
    nextToken: hasMore ? encodeToken(offset + maxResults) : undefined,
  };
};

const CancelSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  const profile = requireProfile(ctx, name);
  ctx.store.set(profileKey(name), { ...profile, status: "Canceled" });
  return {};
};

const StartSigningJob: OperationHandler = (input, ctx) => {
  const profileName = requireString(input, "profileName");
  const profile = requireProfile(ctx, profileName);
  const id = newId();
  const owner = stringOrUndefined(input["profileOwner"]) ?? ctx.account;
  const job: StoredJob = {
    jobId: id,
    source: recordOrUndefined(input["source"]),
    destination: recordOrUndefined(input["destination"]),
    profileName,
    profileVersion: profile.profileVersion,
    platformId: profile.platformId,
    platformDisplayName: profile.platformDisplayName,
    status: "Succeeded",
    statusReason: undefined,
    createdAt: Date.now(),
    completedAt: Date.now(),
    signingMaterial: profile.signingMaterial,
    signingParameters: profile.signingParameters,
    overrides: profile.overrides,
    requestedBy: ctx.account,
    jobOwner: owner,
    jobInvoker: ctx.account,
    revocationRecord: undefined,
    signedObject: undefined,
    signatureExpiresAt: undefined,
    isPayload: false,
  };
  ctx.store.set(jobKey(id), job);
  return { jobId: id, jobOwner: owner };
};

const DescribeSigningJob: OperationHandler = (input, ctx) => {
  const id = requireString(input, "jobId");
  const job = requireJob(ctx, id);
  return {
    jobId: job.jobId,
    source: job.source,
    signingMaterial: job.signingMaterial,
    platformId: job.platformId,
    platformDisplayName: job.platformDisplayName,
    profileName: job.profileName,
    profileVersion: job.profileVersion,
    overrides: job.overrides,
    signingParameters: job.signingParameters,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    signatureExpiresAt: job.signatureExpiresAt,
    requestedBy: job.requestedBy,
    status: job.status,
    statusReason: job.statusReason,
    revocationRecord: job.revocationRecord,
    signedObject: job.signedObject,
    jobOwner: job.jobOwner,
    jobInvoker: job.jobInvoker,
  };
};

const ListSigningJobs: OperationHandler = (input, ctx) => {
  const statusFilter = stringOrUndefined(input["status"]);
  const platformFilter = stringOrUndefined(input["platformId"]);
  const requestedByFilter = stringOrUndefined(input["requestedBy"]);
  const jobInvokerFilter = stringOrUndefined(input["jobInvoker"]);
  const isRevokedFilter =
    input["isRevoked"] === true || input["isRevoked"] === "true";
  const hasIsRevokedFilter = input["isRevoked"] !== undefined;
  const signatureExpiresAfter =
    typeof input["signatureExpiresAfter"] === "number"
      ? input["signatureExpiresAfter"]
      : undefined;
  const signatureExpiresBefore =
    typeof input["signatureExpiresBefore"] === "number"
      ? input["signatureExpiresBefore"]
      : undefined;
  const maxResults =
    typeof input["maxResults"] === "number" ? input["maxResults"] : undefined;
  const nextTokenInput = stringOrUndefined(input["nextToken"]);

  const jobs = ctx.store
    .list<StoredJob>()
    .filter((entry) => entry.key.startsWith(jobPrefix))
    .map((entry) => entry.value)
    .filter((job) => statusFilter === undefined || job.status === statusFilter)
    .filter(
      (job) =>
        platformFilter === undefined || job.platformId === platformFilter,
    )
    .filter(
      (job) =>
        requestedByFilter === undefined ||
        job.requestedBy === requestedByFilter,
    )
    .filter(
      (job) =>
        jobInvokerFilter === undefined || job.jobInvoker === jobInvokerFilter,
    )
    .filter((job) => {
      if (!hasIsRevokedFilter) return true;
      const revoked = job.revocationRecord !== undefined;
      return isRevokedFilter ? revoked : !revoked;
    })
    .filter((job) => {
      if (signatureExpiresAfter === undefined) return true;
      return (
        job.signatureExpiresAt !== undefined &&
        job.signatureExpiresAt > signatureExpiresAfter
      );
    })
    .filter((job) => {
      if (signatureExpiresBefore === undefined) return true;
      return (
        job.signatureExpiresAt !== undefined &&
        job.signatureExpiresAt < signatureExpiresBefore
      );
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((job) => ({
      jobId: job.jobId,
      source: job.source,
      signedObject: job.signedObject,
      signingMaterial: job.signingMaterial,
      createdAt: job.createdAt,
      status: job.status,
      isRevoked: job.revocationRecord !== undefined,
      profileName: job.profileName,
      profileVersion: job.profileVersion,
      platformId: job.platformId,
      platformDisplayName: job.platformDisplayName,
      signatureExpiresAt: job.signatureExpiresAt,
      jobOwner: job.jobOwner,
      jobInvoker: job.jobInvoker,
    }));

  const offset = nextTokenInput !== undefined ? decodeToken(nextTokenInput) : 0;
  const page =
    maxResults !== undefined
      ? jobs.slice(offset, offset + maxResults)
      : jobs.slice(offset);
  const hasMore = maxResults !== undefined && offset + maxResults < jobs.length;

  return {
    jobs: page,
    nextToken: hasMore ? encodeToken(offset + maxResults) : undefined,
  };
};

const SignPayload: OperationHandler = (input, ctx) => {
  const profileName = requireString(input, "profileName");
  const profile = requireProfile(ctx, profileName);
  const id = newId();
  const owner = stringOrUndefined(input["profileOwner"]) ?? ctx.account;
  const job: StoredJob = {
    jobId: id,
    source: undefined,
    destination: undefined,
    profileName,
    profileVersion: profile.profileVersion,
    platformId: profile.platformId,
    platformDisplayName: profile.platformDisplayName,
    status: "Succeeded",
    statusReason: undefined,
    createdAt: Date.now(),
    completedAt: Date.now(),
    signingMaterial: profile.signingMaterial,
    signingParameters: profile.signingParameters,
    overrides: profile.overrides,
    requestedBy: ctx.account,
    jobOwner: owner,
    jobInvoker: ctx.account,
    revocationRecord: undefined,
    signedObject: undefined,
    signatureExpiresAt: undefined,
    isPayload: true,
  };
  ctx.store.set(jobKey(id), job);
  return {
    jobId: id,
    jobOwner: owner,
    metadata: {
      jobId: id,
      jobOwner: owner,
    },
    signature: Buffer.from(`mock-signature-${id}`).toString("base64"),
  };
};

const RevokeSignature: OperationHandler = (input, ctx) => {
  const id = requireString(input, "jobId");
  const job = requireJob(ctx, id);
  const reason = stringOrUndefined(input["reason"]) ?? "Signature revoked";
  ctx.store.set(jobKey(id), {
    ...job,
    status: "Revoked",
    revocationRecord: {
      reason,
      revokedAt: Date.now(),
      revokedBy: ctx.account,
    },
  });
  return {};
};

const RevokeSigningProfile: OperationHandler = (input, ctx) => {
  const name = requireString(input, "profileName");
  const profile = requireProfile(ctx, name);
  const reason = stringOrUndefined(input["reason"]) ?? "Profile revoked";
  const effectiveTime = input["effectiveTime"];
  const revocationEffectiveFrom =
    typeof effectiveTime === "number"
      ? effectiveTime
      : typeof effectiveTime === "string"
        ? Number(effectiveTime)
        : Date.now() / 1000;
  ctx.store.set(profileKey(name), {
    ...profile,
    status: "Revoked",
    revocationRecord: {
      reason,
      revocationEffectiveFrom,
      revokedAt: Date.now() / 1000,
      revokedBy: ctx.account,
    },
  });
  return {};
};

const GetSigningPlatform: OperationHandler = (input) => {
  const id = requireString(input, "platformId");
  const platform = PLATFORMS.find((p) => p.platformId === id);
  if (platform === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Signing platform ${id} not found.`,
      404,
    );
  }
  return {
    platformId: platform.platformId,
    displayName: platform.displayName,
    partner: platform.partner,
    target: platform.target,
    category: platform.category,
    signingConfiguration: platform.signingConfiguration,
    signingImageFormat: platform.signingImageFormat,
    maxSizeInMB: platform.maxSizeInMB,
    revocationSupported: platform.revocationSupported,
  };
};

const ListSigningPlatforms: OperationHandler = (input) => {
  const categoryFilter = stringOrUndefined(input["category"]);
  const partnerFilter = stringOrUndefined(input["partner"]);
  const targetFilter = stringOrUndefined(input["target"]);
  const platforms = PLATFORMS.filter(
    (p) => categoryFilter === undefined || p.category === categoryFilter,
  )
    .filter((p) => partnerFilter === undefined || p.partner === partnerFilter)
    .filter((p) => targetFilter === undefined || p.target === targetFilter)
    .map((p) => ({
      platformId: p.platformId,
      displayName: p.displayName,
      partner: p.partner,
      target: p.target,
      category: p.category,
      signingConfiguration: p.signingConfiguration,
      signingImageFormat: p.signingImageFormat,
      maxSizeInMB: p.maxSizeInMB,
      revocationSupported: p.revocationSupported,
    }));
  return { platforms };
};

const GetRevocationStatus: OperationHandler = (_input, _ctx) => {
  return { revokedEntities: [] };
};

const AddProfilePermission: OperationHandler = (input, ctx) => {
  const profileName = requireString(input, "profileName");
  requireProfile(ctx, profileName);
  const statementId = requireString(input, "statementId");
  const action = requireString(input, "action");
  const principal = requireString(input, "principal");
  const perms = ctx.store.get<StoredPermissions>(permKey(profileName)) ?? {};
  const rev = newId();
  perms[statementId] = {
    statementId,
    action,
    principal,
    profileVersion: stringOrUndefined(input["profileVersion"]),
  };
  ctx.store.set(permKey(profileName), perms);
  ctx.store.set(permRevKey(profileName), rev);
  return { revisionId: rev };
};

const RemoveProfilePermission: OperationHandler = (input, ctx) => {
  const profileName = requireString(input, "profileName");
  requireProfile(ctx, profileName);
  const statementId = requireString(input, "statementId");
  const perms = ctx.store.get<StoredPermissions>(permKey(profileName)) ?? {};
  delete perms[statementId];
  ctx.store.set(permKey(profileName), perms);
  const rev = newId();
  ctx.store.set(permRevKey(profileName), rev);
  return { revisionId: rev };
};

const ListProfilePermissions: OperationHandler = (input, ctx) => {
  const profileName = requireString(input, "profileName");
  requireProfile(ctx, profileName);
  const perms = ctx.store.get<StoredPermissions>(permKey(profileName)) ?? {};
  const rev = ctx.store.get<string>(permRevKey(profileName)) ?? "";
  const permissions = Object.values(perms).map((p) => ({
    action: p.action,
    principal: p.principal,
    statementId: p.statementId,
    profileVersion: p.profileVersion,
  }));
  return {
    revisionId: rev,
    policySizeBytes: JSON.stringify(perms).length,
    permissions,
  };
};

const TagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const newTags = recordOrUndefined(input["tags"]) ?? {};
  const existing = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  ctx.store.set(tagsKey(arn), { ...existing, ...newTags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tagKeys = Array.isArray(input["tagKeys"])
    ? (input["tagKeys"] as string[])
    : [];
  const existing = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  for (const key of tagKeys) {
    delete existing[key];
  }
  ctx.store.set(tagsKey(arn), existing);
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "resourceArn");
  const tags = ctx.store.get<Record<string, unknown>>(tagsKey(arn)) ?? {};
  return { tags };
};

const pathSegments = (path: string): string[] =>
  path.split("/").filter((part) => part !== "");

const signer = {
  name: "signer",
  protocol: "rest-json",
  resolveOperation: (req: ParsedRequest): string | undefined => {
    const parts = pathSegments(req.path);
    if (parts[0] === "signing-profiles") {
      if (parts.length === 1) {
        if (req.method === "GET") return "ListSigningProfiles";
        return undefined;
      }
      if (parts.length === 2) {
        if (req.method === "PUT") return "PutSigningProfile";
        if (req.method === "GET") return "GetSigningProfile";
        if (req.method === "DELETE") return "CancelSigningProfile";
        return undefined;
      }
      if (parts.length === 3) {
        if (parts[2] === "revoke" && req.method === "PUT")
          return "RevokeSigningProfile";
        if (parts[2] === "permissions") {
          if (req.method === "GET") return "ListProfilePermissions";
          if (req.method === "POST") return "AddProfilePermission";
        }
        return undefined;
      }
      if (parts.length === 4 && parts[2] === "permissions") {
        if (req.method === "DELETE") return "RemoveProfilePermission";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "signing-jobs") {
      if (parts.length === 1) {
        if (req.method === "POST") return "StartSigningJob";
        if (req.method === "GET") return "ListSigningJobs";
        return undefined;
      }
      if (parts.length === 2) {
        if (parts[1] === "with-payload" && req.method === "POST")
          return "SignPayload";
        if (req.method === "GET") return "DescribeSigningJob";
        return undefined;
      }
      if (parts.length === 3 && parts[2] === "revoke") {
        if (req.method === "PUT") return "RevokeSignature";
        return undefined;
      }
      return undefined;
    }
    if (parts[0] === "signing-platforms") {
      if (parts.length === 1 && req.method === "GET")
        return "ListSigningPlatforms";
      if (parts.length === 2 && req.method === "GET")
        return "GetSigningPlatform";
      return undefined;
    }
    if (parts[0] === "revocations" && req.method === "GET")
      return "GetRevocationStatus";
    if (parts[0] === "tags") {
      if (req.method === "GET") return "ListTagsForResource";
      if (req.method === "POST") return "TagResource";
      if (req.method === "DELETE") return "UntagResource";
      return undefined;
    }
    return undefined;
  },
  operations: {
    PutSigningProfile,
    GetSigningProfile,
    ListSigningProfiles,
    CancelSigningProfile,
    StartSigningJob,
    DescribeSigningJob,
    ListSigningJobs,
    SignPayload,
    RevokeSignature,
    RevokeSigningProfile,
    GetSigningPlatform,
    ListSigningPlatforms,
    GetRevocationStatus,
    AddProfilePermission,
    RemoveProfilePermission,
    ListProfilePermissions,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const satisfies ServiceDefinition;

export default signer;
