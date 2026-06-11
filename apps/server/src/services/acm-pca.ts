import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import acmPcaModel from "../../../../test/vendor/aws-models/acm-pca.json" with {
  type: "json",
};
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(acmPcaModel);

type StoredCA = {
  Arn: string;
  Status: string;
  Type: string;
  CertificateAuthorityConfiguration: Record<string, unknown>;
  RevocationConfiguration?: Record<string, unknown>;
  CreatedAt: number;
  LastStateChangeAt: number;
  NotBefore?: number;
  NotAfter?: number;
  Serial?: string;
  csrPem: string;
  certPem?: string;
  certChainPem?: string;
  tags: { Key: string; Value?: string }[];
};

type StoredCert = {
  Arn: string;
  Serial: string;
  IssuedAt: number;
  CertificatePem: string;
  CertificateChainPem: string;
  RevocationReason?: string;
  RevokedAt?: number;
};

type StoredPermission = {
  CertificateAuthorityArn: string;
  CreatedAt: number;
  Principal: string;
  SourceAccount?: string;
  Actions: string[];
};

type IdempotencyRecord = {
  result: unknown;
  expiresAt: number;
};

const caKey = (id: string): string => `ca/${id}`;
const certKey = (caId: string, serial: string): string =>
  `cert/${caId}/${serial}`;
const permKey = (caId: string, principal: string): string =>
  `perm/${caId}/${principal}`;
const policyKey = (caId: string): string => `policy/${caId}`;
const idempotencyKey = (scope: string, token: string): string =>
  `idempotency/${scope}/${token}`;

const caArnOf = (region: string, account: string, id: string): string =>
  `arn:aws:acm-pca:${region}:${account}:certificate-authority/${id}`;

const certArnOf = (
  region: string,
  account: string,
  caId: string,
  serial: string,
): string =>
  `arn:aws:acm-pca:${region}:${account}:certificate-authority/${caId}/certificate/${serial}`;

const caIdFromArn = (arn: string): string => {
  const parts = arn.split("certificate-authority/");
  if (parts.length < 2) return "";
  const rest = parts[1] ?? "";
  return rest.split("/")[0] ?? "";
};

const serialFromCertArn = (arn: string): string => {
  const parts = arn.split("/certificate/");
  if (parts.length < 2) return "";
  return parts[1] ?? "";
};

const pemOf = (id: string): string =>
  `-----BEGIN CERTIFICATE-----\n${Buffer.from(id, "utf8").toString("base64")}\n-----END CERTIFICATE-----`;

const csrPemOf = (id: string): string =>
  `-----BEGIN CERTIFICATE REQUEST-----\n${Buffer.from(`csr-${id}`, "utf8").toString("base64")}\n-----END CERTIFICATE REQUEST-----`;

const checkIdempotency = (
  ctx: ServiceContext,
  scope: string,
  token: string | undefined,
): unknown | undefined => {
  if (token === undefined || token === "") return undefined;
  const record = ctx.store.get<IdempotencyRecord>(
    idempotencyKey(scope, token),
  );
  if (record === undefined) return undefined;
  const now = Math.floor(Date.now() / 1000);
  if (now >= record.expiresAt) return undefined;
  return record.result;
};

const storeIdempotency = (
  ctx: ServiceContext,
  scope: string,
  token: string | undefined,
  result: unknown,
): void => {
  if (token === undefined || token === "") return;
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  ctx.store.set(idempotencyKey(scope, token), { result, expiresAt });
};

const requireCA = (ctx: ServiceContext, arn: string): StoredCA => {
  const id = caIdFromArn(arn);
  const ca = ctx.store.get<StoredCA>(caKey(id));
  if (ca === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `A CA with the ARN ${arn} does not exist.`,
      400,
    );
  }
  return ca;
};

const requireActiveCA = (ctx: ServiceContext, arn: string): StoredCA => {
  const ca = requireCA(ctx, arn);
  if (ca.Status !== "ACTIVE") {
    throw awsError(
      "InvalidStateException",
      `The certificate authority ${arn} is not in the ACTIVE state.`,
      400,
    );
  }
  return ca;
};

const buildCAResponse = (ca: StoredCA) => ({
  Arn: ca.Arn,
  CreatedAt: ca.CreatedAt,
  LastStateChangeAt: ca.LastStateChangeAt,
  Type: ca.Type,
  Status: ca.Status,
  CertificateAuthorityConfiguration: ca.CertificateAuthorityConfiguration,
  RevocationConfiguration: ca.RevocationConfiguration,
  NotBefore: ca.NotBefore,
  NotAfter: ca.NotAfter,
  Serial: ca.Serial,
});

const CreateCertificateAuthority: OperationHandler = (input, ctx) => {
  const token =
    typeof input.IdempotencyToken === "string"
      ? input.IdempotencyToken
      : undefined;
  const cached = checkIdempotency(ctx, "create-ca", token);
  if (cached !== undefined) return cached as Record<string, unknown>;

  const id = crypto.randomUUID();
  const arn = caArnOf(ctx.region, ctx.account, id);
  const now = Math.floor(Date.now() / 1000);

  const ca: StoredCA = {
    Arn: arn,
    Status: "PENDING_CERTIFICATE",
    Type: (input.CertificateAuthorityType as string) ?? "ROOT",
    CertificateAuthorityConfiguration:
      (input.CertificateAuthorityConfiguration as Record<string, unknown>) ??
      {},
    RevocationConfiguration:
      input.RevocationConfiguration !== undefined
        ? (input.RevocationConfiguration as Record<string, unknown>)
        : undefined,
    CreatedAt: now,
    LastStateChangeAt: now,
    csrPem: csrPemOf(id),
    tags: Array.isArray(input.Tags)
      ? (input.Tags as { Key: string; Value?: string }[])
      : [],
  };

  ctx.store.set(caKey(id), ca);
  const result = { CertificateAuthorityArn: arn };
  storeIdempotency(ctx, "create-ca", token, result);
  return result;
};

const DescribeCertificateAuthority: OperationHandler = (input, ctx) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  return { CertificateAuthority: buildCAResponse(ca) };
};

const ListCertificateAuthorities: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input.MaxResults === "number" ? input.MaxResults : 100;
  const nextToken =
    typeof input.NextToken === "string" ? input.NextToken : undefined;

  const allCAs = ctx.store
    .list<StoredCA>()
    .filter((e) => e.key.startsWith("ca/"))
    .map((e) => e.value)
    .sort((a, b) => a.CreatedAt - b.CreatedAt);

  const startIdx = nextToken ? parseInt(nextToken, 10) : 0;
  const slice = allCAs.slice(startIdx, startIdx + maxResults);
  const hasMore = startIdx + maxResults < allCAs.length;

  return {
    CertificateAuthorities: slice.map(buildCAResponse),
    NextToken: hasMore ? String(startIdx + maxResults) : undefined,
  };
};

const DeleteCertificateAuthority: OperationHandler = (input, ctx) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  if (ca.Status !== "DISABLED" && ca.Status !== "PENDING_CERTIFICATE") {
    throw awsError(
      "InvalidStateException",
      `The CA must be in DISABLED or PENDING_CERTIFICATE status before deletion.`,
      400,
    );
  }
  const id = caIdFromArn(arn);
  ca.Status = "DELETED";
  ca.LastStateChangeAt = Math.floor(Date.now() / 1000);
  ctx.store.set(caKey(id), ca);
  return {};
};

const RestoreCertificateAuthority: OperationHandler = (input, ctx) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  if (ca.Status !== "DELETED") {
    throw awsError(
      "InvalidStateException",
      `The CA must be in DELETED status before it can be restored.`,
      400,
    );
  }
  const id = caIdFromArn(arn);
  ca.Status = "DISABLED";
  ca.LastStateChangeAt = Math.floor(Date.now() / 1000);
  ctx.store.set(caKey(id), ca);
  return {};
};

const UpdateCertificateAuthority: OperationHandler = (input, ctx) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  if (ca.Status === "DELETED") {
    throw awsError(
      "InvalidStateException",
      `The CA ${arn} is in a DELETED state.`,
      400,
    );
  }
  const id = caIdFromArn(arn);
  if (typeof input.Status === "string") {
    ca.Status = input.Status;
    ca.LastStateChangeAt = Math.floor(Date.now() / 1000);
  }
  if (input.RevocationConfiguration !== undefined) {
    ca.RevocationConfiguration = input.RevocationConfiguration as Record<
      string,
      unknown
    >;
  }
  ctx.store.set(caKey(id), ca);
  return {};
};

const GetCertificateAuthorityCsr: OperationHandler = (input, ctx) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  return { Csr: ca.csrPem };
};

const ImportCertificateAuthorityCertificate: OperationHandler = (
  input,
  ctx,
) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  if (ca.Status !== "PENDING_CERTIFICATE") {
    throw awsError(
      "InvalidStateException",
      `The CA ${arn} is not in the PENDING_CERTIFICATE state.`,
      400,
    );
  }
  const id = caIdFromArn(arn);
  const now = Math.floor(Date.now() / 1000);
  ca.Status = "ACTIVE";
  ca.LastStateChangeAt = now;
  ca.NotBefore = now - 60;
  ca.NotAfter = now + 365 * 24 * 3600;
  ca.Serial = Buffer.from(id, "utf8").toString("hex").substring(0, 32).toUpperCase();
  ca.certPem = pemOf(id);
  ca.certChainPem =
    typeof input.CertificateChain === "string" && input.CertificateChain !== ""
      ? input.CertificateChain
      : pemOf(`chain-${id}`);
  ctx.store.set(caKey(id), ca);
  return {};
};

const GetCertificateAuthorityCertificate: OperationHandler = (input, ctx) => {
  const arn = (input.CertificateAuthorityArn as string) ?? "";
  const ca = requireCA(ctx, arn);
  if (ca.Status !== "ACTIVE") {
    throw awsError(
      "InvalidStateException",
      `The CA ${arn} is not in the ACTIVE state.`,
      400,
    );
  }
  return { Certificate: ca.certPem, CertificateChain: ca.certChainPem };
};

const IssueCertificate: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const token =
    typeof input.IdempotencyToken === "string"
      ? input.IdempotencyToken
      : undefined;
  const cached = checkIdempotency(ctx, `issue-cert-${caArn}`, token);
  if (cached !== undefined) return cached as Record<string, unknown>;

  requireActiveCA(ctx, caArn);
  const caId = caIdFromArn(caArn);
  const serial = crypto.randomUUID().replace(/-/g, "");
  const certArn = certArnOf(ctx.region, ctx.account, caId, serial);
  const now = Math.floor(Date.now() / 1000);

  const cert: StoredCert = {
    Arn: certArn,
    Serial: serial,
    IssuedAt: now,
    CertificatePem: pemOf(serial),
    CertificateChainPem: pemOf(`chain-${caId}`),
  };
  ctx.store.set(certKey(caId, serial), cert);

  const result = { CertificateArn: certArn };
  storeIdempotency(ctx, `issue-cert-${caArn}`, token, result);
  return result;
};

const GetCertificate: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const certArn = (input.CertificateArn as string) ?? "";
  requireCA(ctx, caArn);

  const caId = caIdFromArn(caArn);
  const serial = serialFromCertArn(certArn);
  const cert = ctx.store.get<StoredCert>(certKey(caId, serial));
  if (cert === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Certificate ${certArn} does not exist.`,
      400,
    );
  }
  return {
    Certificate: cert.CertificatePem,
    CertificateChain: cert.CertificateChainPem,
  };
};

const RevokeCertificate: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const serial = (input.CertificateSerial as string) ?? "";
  const revocationReason = (input.RevocationReason as string) ?? "";

  requireActiveCA(ctx, caArn);
  const caId = caIdFromArn(caArn);
  const cert = ctx.store.get<StoredCert>(certKey(caId, serial));
  if (cert === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Certificate with serial ${serial} does not exist.`,
      400,
    );
  }
  if (cert.RevocationReason !== undefined) {
    throw awsError(
      "RequestAlreadyProcessedException",
      `Certificate with serial ${serial} has already been revoked.`,
      400,
    );
  }
  cert.RevocationReason = revocationReason;
  cert.RevokedAt = Math.floor(Date.now() / 1000);
  ctx.store.set(certKey(caId, serial), cert);
  return {};
};

const CreatePermission: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const principal = (input.Principal as string) ?? "";
  const actions = Array.isArray(input.Actions)
    ? (input.Actions as string[])
    : [];

  requireCA(ctx, caArn);
  const caId = caIdFromArn(caArn);
  const key = permKey(caId, principal);

  if (ctx.store.get<StoredPermission>(key) !== undefined) {
    throw awsError(
      "PermissionAlreadyExistsException",
      `A permission for ${principal} already exists on CA ${caArn}.`,
      400,
    );
  }
  const perm: StoredPermission = {
    CertificateAuthorityArn: caArn,
    CreatedAt: Math.floor(Date.now() / 1000),
    Principal: principal,
    SourceAccount:
      typeof input.SourceAccount === "string" ? input.SourceAccount : undefined,
    Actions: actions,
  };
  ctx.store.set(key, perm);
  return {};
};

const DeletePermission: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const principal = (input.Principal as string) ?? "";

  requireCA(ctx, caArn);
  const caId = caIdFromArn(caArn);
  const key = permKey(caId, principal);

  if (ctx.store.get<StoredPermission>(key) === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Permission for ${principal} not found on CA ${caArn}.`,
      400,
    );
  }
  ctx.store.delete(key);
  return {};
};

const ListPermissions: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const maxResults =
    typeof input.MaxResults === "number" ? input.MaxResults : 100;
  const nextToken =
    typeof input.NextToken === "string" ? input.NextToken : undefined;

  requireCA(ctx, caArn);
  const caId = caIdFromArn(caArn);
  const prefix = `perm/${caId}/`;

  const allPerms = ctx.store
    .list<StoredPermission>()
    .filter((e) => e.key.startsWith(prefix))
    .map((e) => e.value);

  const startIdx = nextToken ? parseInt(nextToken, 10) : 0;
  const slice = allPerms.slice(startIdx, startIdx + maxResults);
  const hasMore = startIdx + maxResults < allPerms.length;

  return {
    Permissions: slice.map((p) => ({
      CertificateAuthorityArn: p.CertificateAuthorityArn,
      CreatedAt: p.CreatedAt,
      Principal: p.Principal,
      SourceAccount: p.SourceAccount,
      Actions: p.Actions,
    })),
    NextToken: hasMore ? String(startIdx + maxResults) : undefined,
  };
};

const PutPolicy: OperationHandler = (input, ctx) => {
  const caArn = (input.ResourceArn as string) ?? "";
  const policy = (input.Policy as string) ?? "";
  requireCA(ctx, caArn);
  ctx.store.set(policyKey(caIdFromArn(caArn)), policy);
  return {};
};

const GetPolicy: OperationHandler = (input, ctx) => {
  const caArn = (input.ResourceArn as string) ?? "";
  requireCA(ctx, caArn);
  const policy = ctx.store.get<string>(policyKey(caIdFromArn(caArn)));
  if (policy === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `No policy found for CA ${caArn}.`,
      400,
    );
  }
  return { Policy: policy };
};

const DeletePolicy: OperationHandler = (input, ctx) => {
  const caArn = (input.ResourceArn as string) ?? "";
  requireCA(ctx, caArn);
  ctx.store.delete(policyKey(caIdFromArn(caArn)));
  return {};
};

const TagCertificateAuthority: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const tags = Array.isArray(input.Tags)
    ? (input.Tags as { Key: string; Value?: string }[])
    : [];
  const ca = requireCA(ctx, caArn);
  for (const tag of tags) {
    const idx = ca.tags.findIndex((t) => t.Key === tag.Key);
    if (idx >= 0) {
      ca.tags[idx] = tag;
    } else {
      ca.tags.push(tag);
    }
  }
  ctx.store.set(caKey(caIdFromArn(caArn)), ca);
  return {};
};

const UntagCertificateAuthority: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const tags = Array.isArray(input.Tags)
    ? (input.Tags as { Key: string; Value?: string }[])
    : [];
  const ca = requireCA(ctx, caArn);
  const keysToRemove = new Set(tags.map((t) => t.Key));
  ca.tags = ca.tags.filter((t) => !keysToRemove.has(t.Key));
  ctx.store.set(caKey(caIdFromArn(caArn)), ca);
  return {};
};

const ListTags: OperationHandler = (input, ctx) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  const maxResults =
    typeof input.MaxResults === "number" ? input.MaxResults : 100;
  const nextToken =
    typeof input.NextToken === "string" ? input.NextToken : undefined;
  const ca = requireCA(ctx, caArn);

  const startIdx = nextToken ? parseInt(nextToken, 10) : 0;
  const slice = ca.tags.slice(startIdx, startIdx + maxResults);
  const hasMore = startIdx + maxResults < ca.tags.length;

  return {
    Tags: slice,
    NextToken: hasMore ? String(startIdx + maxResults) : undefined,
  };
};

const CreateCertificateAuthorityAuditReport: OperationHandler = (
  input,
  ctx,
) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  requireActiveCA(ctx, caArn);
  const auditReportId = crypto.randomUUID();
  const caId = caIdFromArn(caArn);
  return {
    AuditReportId: auditReportId,
    S3Key: `audit-report/${caId}/${auditReportId}.json`,
  };
};

const DescribeCertificateAuthorityAuditReport: OperationHandler = (
  input,
  ctx,
) => {
  const caArn = (input.CertificateAuthorityArn as string) ?? "";
  requireCA(ctx, caArn);
  const auditReportId = (input.AuditReportId as string) ?? "";
  return {
    AuditReportStatus: "SUCCESS",
    S3BucketName: "audit-bucket",
    S3Key: `audit-report/${caIdFromArn(caArn)}/${auditReportId}.json`,
    CreatedAt: Math.floor(Date.now() / 1000),
  };
};

const acmPca = {
  name: "acm-pca",
  protocol: "json",
  operations: {
    CreateCertificateAuthority,
    CreateCertificateAuthorityAuditReport,
    CreatePermission,
    DeleteCertificateAuthority,
    DeletePermission,
    DeletePolicy,
    DescribeCertificateAuthority,
    DescribeCertificateAuthorityAuditReport,
    GetCertificate,
    GetCertificateAuthorityCertificate,
    GetCertificateAuthorityCsr,
    GetPolicy,
    ImportCertificateAuthorityCertificate,
    IssueCertificate,
    ListCertificateAuthorities,
    ListPermissions,
    ListTags,
    PutPolicy,
    RestoreCertificateAuthority,
    RevokeCertificate,
    TagCertificateAuthority,
    UntagCertificateAuthority,
    UpdateCertificateAuthority,
  },
  model,
} as const satisfies ServiceDefinition;

export default acmPca;
