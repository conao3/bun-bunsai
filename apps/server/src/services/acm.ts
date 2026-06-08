import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import acmModel from "../../../../test/vendor/aws-models/acm.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(acmModel);

type StoredDomainValidationOption = {
  DomainName: string;
  ValidationMethod: string;
  ValidationStatus: string;
  ResourceRecord?: { Name: string; Type: string; Value: string };
};

type StoredCertificate = {
  CertificateArn: string;
  DomainName: string;
  SubjectAlternativeNames: string[];
  Status: string;
  Type: string;
  KeyAlgorithm: string;
  CreatedAt: number;
  IssuedAt?: number;
  ValidationMethod: string;
  DomainValidationOptions: StoredDomainValidationOption[];
  describeCount: number;
  pem: string;
  tags: { Key: string; Value?: string }[];
  renewalSummary?: { RenewalStatus: string; UpdatedAt: number };
  ImportedAt?: number;
  RevocationReason?: string;
  RevokedAt?: number;
  options?: {
    CertificateTransparencyLoggingPreference?: string;
    Export?: string;
  };
};

type AccountConfig = {
  ExpiryEvents?: { DaysBeforeExpiry?: number };
};

const certificateKey = (id: string): string => `certificate/${id}`;

const certificateArnOf = (
  region: string,
  account: string,
  id: string,
): string => `arn:aws:acm:${region}:${account}:certificate/${id}`;

const idFromArn = (arn: string): string => {
  const segments = arn.split("/");
  return segments[segments.length - 1] ?? "";
};

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("ValidationException", `${key} is required.`, 400);
  }
  return value;
};

const requireCertificate = (
  ctx: ServiceContext,
  arn: string,
): StoredCertificate => {
  const certificate = ctx.store.get<StoredCertificate>(
    certificateKey(idFromArn(arn)),
  );
  if (certificate === undefined) {
    throw awsError(
      "ResourceNotFoundException",
      `Could not find certificate ${arn} in account ${ctx.account}.`,
      400,
    );
  }
  return certificate;
};

const dnsResourceRecordOf = (domainName: string) =>
  ({
    Name: `_acm-challenge.${domainName}.`,
    Type: "CNAME",
    Value: `_acm-challenge.${domainName}.acm-validations.aws.`,
  }) as const;

const pemOf = (id: string): string =>
  `-----BEGIN CERTIFICATE-----\n${Buffer.from(id, "utf8").toString("base64")}\n-----END CERTIFICATE-----`;

const privateKeyPemOf = (id: string): string =>
  `-----BEGIN ENCRYPTED PRIVATE KEY-----\n${Buffer.from(`key:${id}`, "utf8").toString("base64")}\n-----END ENCRYPTED PRIVATE KEY-----`;

const accountConfigKey = "account-config";

const RequestCertificate: OperationHandler = (input, ctx) => {
  const domainName = requireString(input, "DomainName");
  const subjectAlternativeNames = Array.isArray(
    input["SubjectAlternativeNames"],
  )
    ? (input["SubjectAlternativeNames"] as string[])
    : [domainName];
  const validationMethod =
    typeof input["ValidationMethod"] === "string"
      ? (input["ValidationMethod"] as string)
      : "DNS";
  const id = crypto.randomUUID();
  const arn = certificateArnOf(ctx.region, ctx.account, id);
  const now = Math.floor(Date.now() / 1000);
  const domainValidationOptions: StoredDomainValidationOption[] =
    subjectAlternativeNames.map((name) => ({
      DomainName: name,
      ValidationMethod: validationMethod,
      ValidationStatus: "PENDING_VALIDATION",
      ...(validationMethod === "DNS"
        ? { ResourceRecord: dnsResourceRecordOf(name) }
        : {}),
    }));
  const certificate: StoredCertificate = {
    CertificateArn: arn,
    DomainName: domainName,
    SubjectAlternativeNames: subjectAlternativeNames,
    Status: "PENDING_VALIDATION",
    Type: "AMAZON_ISSUED",
    KeyAlgorithm:
      typeof input["KeyAlgorithm"] === "string"
        ? (input["KeyAlgorithm"] as string)
        : "RSA_2048",
    CreatedAt: now,
    ValidationMethod: validationMethod,
    DomainValidationOptions: domainValidationOptions,
    describeCount: 0,
    pem: pemOf(id),
    tags: [],
  };
  ctx.store.set(certificateKey(id), certificate);
  return { CertificateArn: arn };
};

const certificateDetail = (
  certificate: StoredCertificate,
): Record<string, unknown> => ({
  CertificateArn: certificate.CertificateArn,
  DomainName: certificate.DomainName,
  SubjectAlternativeNames: certificate.SubjectAlternativeNames,
  DomainValidationOptions: certificate.DomainValidationOptions.map((opt) => {
    const entry: Record<string, unknown> = {
      DomainName: opt.DomainName,
      ValidationDomain: opt.DomainName,
      ValidationStatus: opt.ValidationStatus,
      ValidationMethod: opt.ValidationMethod,
    };
    if (opt.ResourceRecord !== undefined) {
      entry["ResourceRecord"] = opt.ResourceRecord;
    }
    return entry;
  }),
  Status: certificate.Status,
  Type: certificate.Type,
  KeyAlgorithm: certificate.KeyAlgorithm,
  CreatedAt: certificate.CreatedAt,
  IssuedAt: certificate.IssuedAt,
  RenewalSummary:
    certificate.renewalSummary === undefined
      ? undefined
      : {
          RenewalStatus: certificate.renewalSummary.RenewalStatus,
          UpdatedAt: certificate.renewalSummary.UpdatedAt,
          DomainValidationOptions: certificate.SubjectAlternativeNames.map(
            (name) => ({
              DomainName: name,
              ValidationDomain: name,
              ValidationStatus: "SUCCESS",
              ValidationMethod: certificate.ValidationMethod,
            }),
          ),
        },
  Subject: `CN=${certificate.DomainName}`,
  Issuer: "Amazon",
  RenewalEligibility: "INELIGIBLE",
  InUseBy: [],
  KeyUsages: [],
  ExtendedKeyUsages: [],
});

const DescribeCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  let certificate = requireCertificate(ctx, arn);
  if (certificate.Status === "PENDING_VALIDATION") {
    if (certificate.describeCount >= 1) {
      const now = Math.floor(Date.now() / 1000);
      certificate = {
        ...certificate,
        Status: "ISSUED",
        IssuedAt: now,
        DomainValidationOptions: certificate.DomainValidationOptions.map(
          (opt) => ({ ...opt, ValidationStatus: "SUCCESS" }),
        ),
      };
    } else {
      certificate = {
        ...certificate,
        describeCount: certificate.describeCount + 1,
      };
    }
    ctx.store.set(certificateKey(idFromArn(arn)), certificate);
  }
  return { Certificate: certificateDetail(certificate) };
};

const ListCertificates: OperationHandler = (input, ctx) => {
  const statuses = Array.isArray(input["CertificateStatuses"])
    ? (input["CertificateStatuses"] as string[])
    : [];
  const certificates = ctx.store
    .list<StoredCertificate>()
    .filter((entry) => entry.key.startsWith("certificate/"))
    .map((entry) => entry.value)
    .filter(
      (certificate) =>
        statuses.length === 0 || statuses.includes(certificate.Status),
    )
    .sort((a, b) => a.CertificateArn.localeCompare(b.CertificateArn));
  return {
    CertificateSummaryList: certificates.map((certificate) => ({
      CertificateArn: certificate.CertificateArn,
      DomainName: certificate.DomainName,
      SubjectAlternativeNameSummaries: certificate.SubjectAlternativeNames,
      Status: certificate.Status,
      Type: certificate.Type,
      KeyAlgorithm: certificate.KeyAlgorithm,
      RenewalEligibility: "INELIGIBLE",
      InUse: false,
      Exported: false,
      CreatedAt: certificate.CreatedAt,
      IssuedAt: certificate.IssuedAt,
    })),
  };
};

const DeleteCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  requireCertificate(ctx, arn);
  ctx.store.delete(certificateKey(idFromArn(arn)));
  return {};
};

const GetCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  return {
    Certificate: certificate.pem,
    CertificateChain: certificate.pem,
  };
};

const normalizeTags = (value: unknown): { Key: string; Value?: string }[] => {
  if (!Array.isArray(value)) {
    throw awsError("ValidationException", "Tags is required.", 400);
  }
  return value.map((entry) => {
    const tag = entry as Record<string, unknown>;
    const key = tag["Key"];
    if (typeof key !== "string" || key === "") {
      throw awsError("ValidationException", "Tag Key is required.", 400);
    }
    return typeof tag["Value"] === "string"
      ? { Key: key, Value: tag["Value"] }
      : { Key: key };
  });
};

const AddTagsToCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  const tags = normalizeTags(input["Tags"]);
  const merged = certificate.tags.filter(
    (existing) => !tags.some((tag) => tag.Key === existing.Key),
  );
  const updated: StoredCertificate = {
    ...certificate,
    tags: [...merged, ...tags],
  };
  ctx.store.set(certificateKey(idFromArn(arn)), updated);
  return {};
};

const ListTagsForCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  return { Tags: certificate.tags };
};

const RemoveTagsFromCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  const tags = normalizeTags(input["Tags"]);
  const remaining = certificate.tags.filter(
    (existing) =>
      !tags.some(
        (tag) =>
          tag.Key === existing.Key &&
          (tag.Value === undefined || tag.Value === existing.Value),
      ),
  );
  const updated: StoredCertificate = { ...certificate, tags: remaining };
  ctx.store.set(certificateKey(idFromArn(arn)), updated);
  return {};
};

const RenewCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  const updated: StoredCertificate = {
    ...certificate,
    renewalSummary: {
      RenewalStatus: "SUCCESS",
      UpdatedAt: Math.floor(Date.now() / 1000),
    },
  };
  ctx.store.set(certificateKey(idFromArn(arn)), updated);
  return {};
};

const ResendValidationEmail: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  requireString(input, "Domain");
  requireString(input, "ValidationDomain");
  requireCertificate(ctx, arn);
  return {};
};

const ImportCertificate: OperationHandler = (input, ctx) => {
  const existingArn =
    typeof input["CertificateArn"] === "string"
      ? (input["CertificateArn"] as string)
      : undefined;
  const now = Math.floor(Date.now() / 1000);
  if (existingArn !== undefined) {
    const existing = requireCertificate(ctx, existingArn);
    const updated: StoredCertificate = {
      ...existing,
      Type: "IMPORTED",
      ImportedAt: now,
      Status: "ISSUED",
      IssuedAt: now,
      DomainValidationOptions: existing.DomainValidationOptions.map((opt) => ({
        ...opt,
        ValidationStatus: "SUCCESS",
      })),
    };
    ctx.store.set(certificateKey(idFromArn(existingArn)), updated);
    return { CertificateArn: existingArn };
  }
  const id = crypto.randomUUID();
  const arn = certificateArnOf(ctx.region, ctx.account, id);
  const tags = Array.isArray(input["Tags"]) ? normalizeTags(input["Tags"]) : [];
  const certificate: StoredCertificate = {
    CertificateArn: arn,
    DomainName: "imported.example.com",
    SubjectAlternativeNames: ["imported.example.com"],
    Status: "ISSUED",
    Type: "IMPORTED",
    KeyAlgorithm: "RSA_2048",
    CreatedAt: now,
    IssuedAt: now,
    ImportedAt: now,
    ValidationMethod: "NONE",
    DomainValidationOptions: [
      {
        DomainName: "imported.example.com",
        ValidationMethod: "NONE",
        ValidationStatus: "SUCCESS",
      },
    ],
    describeCount: 0,
    pem: pemOf(id),
    tags,
  };
  ctx.store.set(certificateKey(id), certificate);
  return { CertificateArn: arn };
};

const ExportCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  return {
    Certificate: certificate.pem,
    CertificateChain: certificate.pem,
    PrivateKey: privateKeyPemOf(idFromArn(arn)),
  };
};

const RevokeCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const revocationReason = requireString(input, "RevocationReason");
  const certificate = requireCertificate(ctx, arn);
  const now = Math.floor(Date.now() / 1000);
  const updated: StoredCertificate = {
    ...certificate,
    Status: "REVOKED",
    RevocationReason: revocationReason,
    RevokedAt: now,
  };
  ctx.store.set(certificateKey(idFromArn(arn)), updated);
  return { CertificateArn: arn };
};

const UpdateCertificateOptions: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
  const optionsInput = input["Options"] as Record<string, unknown> | undefined;
  const options = {
    CertificateTransparencyLoggingPreference:
      typeof optionsInput?.["CertificateTransparencyLoggingPreference"] ===
      "string"
        ? (optionsInput["CertificateTransparencyLoggingPreference"] as string)
        : certificate.options?.CertificateTransparencyLoggingPreference,
    Export:
      typeof optionsInput?.["Export"] === "string"
        ? (optionsInput["Export"] as string)
        : certificate.options?.Export,
  };
  const updated: StoredCertificate = { ...certificate, options };
  ctx.store.set(certificateKey(idFromArn(arn)), updated);
  return {};
};

const GetAccountConfiguration: OperationHandler = (_input, ctx) => {
  const config = ctx.store.get<AccountConfig>(accountConfigKey) ?? {};
  return { ExpiryEvents: config.ExpiryEvents };
};

const PutAccountConfiguration: OperationHandler = (input, ctx) => {
  const expiryEvents = input["ExpiryEvents"] as
    | { DaysBeforeExpiry?: number }
    | undefined;
  const config: AccountConfig = { ExpiryEvents: expiryEvents };
  ctx.store.set(accountConfigKey, config);
  return {};
};

const matchesCertificateFilter = (
  cert: StoredCertificate,
  filter: Record<string, unknown>,
): boolean => {
  if (filter["CertificateArn"] !== undefined) {
    return cert.CertificateArn === filter["CertificateArn"];
  }
  if (filter["AcmCertificateMetadataFilter"] !== undefined) {
    const metaFilter = filter["AcmCertificateMetadataFilter"] as Record<
      string,
      unknown
    >;
    if (
      metaFilter["Status"] !== undefined &&
      cert.Status !== metaFilter["Status"]
    ) {
      return false;
    }
    if (metaFilter["Type"] !== undefined && cert.Type !== metaFilter["Type"]) {
      return false;
    }
    return true;
  }
  if (filter["X509AttributeFilter"] !== undefined) {
    const x509Filter = filter["X509AttributeFilter"] as Record<string, unknown>;
    if (
      x509Filter["KeyAlgorithm"] !== undefined &&
      cert.KeyAlgorithm !== x509Filter["KeyAlgorithm"]
    ) {
      return false;
    }
    return true;
  }
  return true;
};

const matchesFilterStatement = (
  cert: StoredCertificate,
  statement: Record<string, unknown>,
): boolean => {
  if (statement["Filter"] !== undefined) {
    return matchesCertificateFilter(
      cert,
      statement["Filter"] as Record<string, unknown>,
    );
  }
  if (statement["And"] !== undefined) {
    const ands = statement["And"] as Record<string, unknown>[];
    return ands.every((s) => matchesFilterStatement(cert, s));
  }
  if (statement["Or"] !== undefined) {
    const ors = statement["Or"] as Record<string, unknown>[];
    return ors.some((s) => matchesFilterStatement(cert, s));
  }
  if (statement["Not"] !== undefined) {
    return !matchesFilterStatement(
      cert,
      statement["Not"] as Record<string, unknown>,
    );
  }
  return true;
};

const certToSearchResult = (
  cert: StoredCertificate,
): Record<string, unknown> => ({
  CertificateArn: cert.CertificateArn,
  X509Attributes: {
    Subject: `CN=${cert.DomainName}`,
    Issuer: "Amazon",
    SubjectAlternativeNames: cert.SubjectAlternativeNames,
    KeyAlgorithm: cert.KeyAlgorithm,
  },
  CertificateMetadata: {
    AcmCertificateMetadata: {
      CreatedAt: cert.CreatedAt,
      IssuedAt: cert.IssuedAt,
      Status: cert.Status,
      Type: cert.Type,
      RenewalEligibility: "INELIGIBLE",
      InUse: false,
      Exported: false,
    },
  },
});

const SearchCertificates: OperationHandler = (input, ctx) => {
  const maxResults =
    typeof input["MaxResults"] === "number"
      ? (input["MaxResults"] as number)
      : 100;
  const filterStatement = input["FilterStatement"] as
    | Record<string, unknown>
    | undefined;
  const sortBy =
    typeof input["SortBy"] === "string"
      ? (input["SortBy"] as string)
      : "CERTIFICATE_ARN";
  const sortOrder =
    typeof input["SortOrder"] === "string"
      ? (input["SortOrder"] as string)
      : "ASCENDING";

  let certificates = ctx.store
    .list<StoredCertificate>()
    .filter((entry) => entry.key.startsWith("certificate/"))
    .map((entry) => entry.value);

  if (filterStatement !== undefined) {
    certificates = certificates.filter((cert) =>
      matchesFilterStatement(cert, filterStatement),
    );
  }

  const multiplier = sortOrder === "DESCENDING" ? -1 : 1;
  certificates = [...certificates].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "CREATED_AT":
        cmp = a.CreatedAt - b.CreatedAt;
        break;
      case "STATUS":
        cmp = a.Status.localeCompare(b.Status);
        break;
      case "TYPE":
        cmp = a.Type.localeCompare(b.Type);
        break;
      case "COMMON_NAME":
        cmp = a.DomainName.localeCompare(b.DomainName);
        break;
      default:
        cmp = a.CertificateArn.localeCompare(b.CertificateArn);
    }
    return cmp * multiplier;
  });

  const results = certificates.slice(0, maxResults).map(certToSearchResult);
  return { Results: results };
};

const acm = {
  name: "acm",
  protocol: "json",
  operations: {
    RequestCertificate,
    DescribeCertificate,
    ListCertificates,
    DeleteCertificate,
    GetCertificate,
    AddTagsToCertificate,
    ListTagsForCertificate,
    RemoveTagsFromCertificate,
    RenewCertificate,
    ResendValidationEmail,
    ImportCertificate,
    ExportCertificate,
    RevokeCertificate,
    UpdateCertificateOptions,
    GetAccountConfiguration,
    PutAccountConfiguration,
    SearchCertificates,
  },
  model,
} as const satisfies ServiceDefinition;

export default acm;
