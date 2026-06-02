import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import acmModel from "../../../../test/vendor/aws-models/acm.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(acmModel);

type StoredCertificate = {
  CertificateArn: string;
  DomainName: string;
  SubjectAlternativeNames: string[];
  Status: string;
  Type: string;
  KeyAlgorithm: string;
  CreatedAt: number;
  IssuedAt: number;
  ValidationMethod: string;
  pem: string;
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

const pemOf = (id: string): string =>
  `-----BEGIN CERTIFICATE-----\n${Buffer.from(id, "utf8").toString("base64")}\n-----END CERTIFICATE-----`;

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
  const certificate: StoredCertificate = {
    CertificateArn: arn,
    DomainName: domainName,
    SubjectAlternativeNames: subjectAlternativeNames,
    Status: "ISSUED",
    Type: "AMAZON_ISSUED",
    KeyAlgorithm:
      typeof input["KeyAlgorithm"] === "string"
        ? (input["KeyAlgorithm"] as string)
        : "RSA_2048",
    CreatedAt: now,
    IssuedAt: now,
    ValidationMethod: validationMethod,
    pem: pemOf(id),
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
  DomainValidationOptions: certificate.SubjectAlternativeNames.map((name) => ({
    DomainName: name,
    ValidationDomain: name,
    ValidationStatus: "SUCCESS",
    ValidationMethod: certificate.ValidationMethod,
  })),
  Status: certificate.Status,
  Type: certificate.Type,
  KeyAlgorithm: certificate.KeyAlgorithm,
  CreatedAt: certificate.CreatedAt,
  IssuedAt: certificate.IssuedAt,
  Subject: `CN=${certificate.DomainName}`,
  Issuer: "Amazon",
  RenewalEligibility: "INELIGIBLE",
  InUseBy: [],
  KeyUsages: [],
  ExtendedKeyUsages: [],
});

const DescribeCertificate: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "CertificateArn");
  const certificate = requireCertificate(ctx, arn);
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

const acm = {
  name: "acm",
  protocol: "json",
  operations: {
    RequestCertificate,
    DescribeCertificate,
    ListCertificates,
    DeleteCertificate,
    GetCertificate,
  },
  model,
} as const satisfies ServiceDefinition;

export default acm;
