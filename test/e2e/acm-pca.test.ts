import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ACMPCAClient,
  AuditReportResponseFormat,
  CertificateAuthorityType,
  CertificateAuthorityStatus,
  CreateCertificateAuthorityAuditReportCommand,
  CreateCertificateAuthorityCommand,
  DeleteCertificateAuthorityCommand,
  DeletePolicyCommand,
  DescribeCertificateAuthorityAuditReportCommand,
  DescribeCertificateAuthorityCommand,
  GetCertificateAuthorityCertificateCommand,
  GetCertificateAuthorityCsrCommand,
  GetCertificateCommand,
  GetPolicyCommand,
  ImportCertificateAuthorityCertificateCommand,
  IssueCertificateCommand,
  KeyAlgorithm,
  ListCertificateAuthoritiesCommand,
  ListTagsCommand,
  PutPolicyCommand,
  RestoreCertificateAuthorityCommand,
  RevocationReason,
  RevokeCertificateCommand,
  SigningAlgorithm,
  TagCertificateAuthorityCommand,
  UntagCertificateAuthorityCommand,
  UpdateCertificateAuthorityCommand,
  ValidityPeriodType,
} from "@aws-sdk/client-acm-pca";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const acmPca = () =>
  new ACMPCAClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

const caConfig = {
  KeyAlgorithm: KeyAlgorithm.RSA_2048,
  SigningAlgorithm: SigningAlgorithm.SHA256WITHRSA,
  Subject: { CommonName: "bunsai-e2e-ca.example.com" },
};

test("ACM PCA CA lifecycle: PENDING_CERTIFICATE → import → ACTIVE → issue → revoke", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn;
  expect(caArn).toBeDefined();
  expect(caArn).toContain("certificate-authority");

  const pending = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(pending.CertificateAuthority?.Status).toBe("PENDING_CERTIFICATE");
  expect(pending.CertificateAuthority?.Type).toBe("ROOT");

  const csrResult = await client.send(
    new GetCertificateAuthorityCsrCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(csrResult.Csr).toContain("BEGIN CERTIFICATE REQUEST");

  const fakeCert = "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t";
  await client.send(
    new ImportCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
      Certificate: Buffer.from(fakeCert),
    }),
  );

  const active = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(active.CertificateAuthority?.Status).toBe("ACTIVE");
  expect(active.CertificateAuthority?.NotBefore).toBeDefined();
  expect(active.CertificateAuthority?.NotAfter).toBeDefined();

  const caCertResult = await client.send(
    new GetCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
    }),
  );
  expect(caCertResult.Certificate).toContain("BEGIN CERTIFICATE");

  const listed = await client.send(new ListCertificateAuthoritiesCommand({}));
  const arns = (listed.CertificateAuthorities ?? []).map((ca) => ca.Arn);
  expect(arns).toContain(caArn);

  const issued = await client.send(
    new IssueCertificateCommand({
      CertificateAuthorityArn: caArn,
      Csr: Buffer.from(csrResult.Csr ?? ""),
      SigningAlgorithm: SigningAlgorithm.SHA256WITHRSA,
      Validity: { Type: ValidityPeriodType.DAYS, Value: 365 },
    }),
  );
  const certArn = issued.CertificateArn;
  expect(certArn).toBeDefined();
  expect(certArn).toContain("/certificate/");

  const idempotentIssued = await client.send(
    new IssueCertificateCommand({
      CertificateAuthorityArn: caArn,
      Csr: Buffer.from(csrResult.Csr ?? ""),
      SigningAlgorithm: SigningAlgorithm.SHA256WITHRSA,
      Validity: { Type: ValidityPeriodType.DAYS, Value: 365 },
      IdempotencyToken: "token-abc",
    }),
  );
  const certArn2 = idempotentIssued.CertificateArn;
  const idempotentIssued2 = await client.send(
    new IssueCertificateCommand({
      CertificateAuthorityArn: caArn,
      Csr: Buffer.from(csrResult.Csr ?? ""),
      SigningAlgorithm: SigningAlgorithm.SHA256WITHRSA,
      Validity: { Type: ValidityPeriodType.DAYS, Value: 365 },
      IdempotencyToken: "token-abc",
    }),
  );
  expect(idempotentIssued2.CertificateArn).toBe(certArn2);

  const certResult = await client.send(
    new GetCertificateCommand({
      CertificateAuthorityArn: caArn,
      CertificateArn: certArn,
    }),
  );
  expect(certResult.Certificate).toContain("BEGIN CERTIFICATE");
  expect(certResult.CertificateChain).toContain("BEGIN CERTIFICATE");

  const serial = certArn?.split("/certificate/")[1] ?? "";
  await client.send(
    new RevokeCertificateCommand({
      CertificateAuthorityArn: caArn,
      CertificateSerial: serial,
      RevocationReason: RevocationReason.KEY_COMPROMISE,
    }),
  );

  await expect(
    client.send(
      new RevokeCertificateCommand({
        CertificateAuthorityArn: caArn,
        CertificateSerial: serial,
        RevocationReason: RevocationReason.KEY_COMPROMISE,
      }),
    ),
  ).rejects.toMatchObject({ name: "RequestAlreadyProcessedException" });
});

test("ACM PCA tags round-trip", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  const listed = await client.send(
    new ListTagsCommand({ CertificateAuthorityArn: caArn }),
  );
  expect((listed.Tags ?? []).find((t) => t.Key === "env")?.Value).toBe("test");

  await client.send(
    new TagCertificateAuthorityCommand({
      CertificateAuthorityArn: caArn,
      Tags: [{ Key: "owner", Value: "bunsai" }],
    }),
  );

  const listed2 = await client.send(
    new ListTagsCommand({ CertificateAuthorityArn: caArn }),
  );
  expect((listed2.Tags ?? []).length).toBe(2);

  await client.send(
    new UntagCertificateAuthorityCommand({
      CertificateAuthorityArn: caArn,
      Tags: [{ Key: "env" }],
    }),
  );

  const listed3 = await client.send(
    new ListTagsCommand({ CertificateAuthorityArn: caArn }),
  );
  expect((listed3.Tags ?? []).find((t) => t.Key === "env")).toBeUndefined();
  expect((listed3.Tags ?? []).find((t) => t.Key === "owner")?.Value).toBe(
    "bunsai",
  );
});

test("ACM PCA delete/restore lifecycle", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await client.send(
    new DeleteCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  const deleted = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(deleted.CertificateAuthority?.Status).toBe("DELETED");

  await expect(
    client.send(
      new IssueCertificateCommand({
        CertificateAuthorityArn: caArn,
        Csr: Buffer.from("dummy"),
        SigningAlgorithm: SigningAlgorithm.SHA256WITHRSA,
        Validity: { Type: ValidityPeriodType.DAYS, Value: 1 },
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidStateException" });
});

test("ACM PCA update CA status", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await client.send(
    new ImportCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
      Certificate: Buffer.from("fakecert"),
    }),
  );

  await client.send(
    new UpdateCertificateAuthorityCommand({
      CertificateAuthorityArn: caArn,
      Status: CertificateAuthorityStatus.DISABLED,
    }),
  );

  const described = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(described.CertificateAuthority?.Status).toBe("DISABLED");
});

test("acmpca-01: audit report persistence", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;
  await client.send(
    new ImportCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
      Certificate: Buffer.from("fakecert"),
    }),
  );

  await expect(
    client.send(
      new DescribeCertificateAuthorityAuditReportCommand({
        CertificateAuthorityArn: caArn,
        AuditReportId: crypto.randomUUID(),
      }),
    ),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  const auditCreated = await client.send(
    new CreateCertificateAuthorityAuditReportCommand({
      CertificateAuthorityArn: caArn,
      S3BucketName: "my-bucket",
      AuditReportResponseFormat: AuditReportResponseFormat.JSON,
    }),
  );
  const auditReportId = auditCreated.AuditReportId!;

  const described = await client.send(
    new DescribeCertificateAuthorityAuditReportCommand({
      CertificateAuthorityArn: caArn,
      AuditReportId: auditReportId,
    }),
  );
  expect(described.S3BucketName).toBe("my-bucket");
  expect(described.AuditReportStatus).toBe("SUCCESS");
  expect(described.CreatedAt).toBeDefined();
});

test("acmpca-02: UpdateCertificateAuthority status transition validation", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await expect(
    client.send(
      new UpdateCertificateAuthorityCommand({
        CertificateAuthorityArn: caArn,
        Status: CertificateAuthorityStatus.ACTIVE,
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidStateException" });

  await client.send(
    new ImportCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
      Certificate: Buffer.from("fakecert"),
    }),
  );

  await expect(
    client.send(
      new UpdateCertificateAuthorityCommand({
        CertificateAuthorityArn: caArn,
        Status: "DELETED" as CertificateAuthorityStatus,
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidArgsException" });
});

test("acmpca-03: RestoreCertificateAuthority preserves pre-delete status", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await client.send(
    new DeleteCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );

  await client.send(
    new RestoreCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );

  const restored = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(restored.CertificateAuthority?.Status).toBe("PENDING_CERTIFICATE");

  await client.send(
    new ImportCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
      Certificate: Buffer.from("fakecert"),
    }),
  );

  const active = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(active.CertificateAuthority?.Status).toBe("ACTIVE");
});

test("acmpca-04: DeleteCertificateAuthority sets RestorableUntil", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await client.send(
    new DeleteCertificateAuthorityCommand({
      CertificateAuthorityArn: caArn,
      PermanentDeletionTimeInDays: 7,
    }),
  );

  const described = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(described.CertificateAuthority?.RestorableUntil).toBeDefined();
});

test("acmpca-05: CA responses include OwnerAccount/KeyStorageSecurityStandard/UsageMode", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  const described = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(described.CertificateAuthority?.OwnerAccount).toBeDefined();
  expect(
    described.CertificateAuthority?.KeyStorageSecurityStandard,
  ).toBeDefined();
  expect(described.CertificateAuthority?.UsageMode).toBeDefined();
});

test("acmpca-06: ListCertificateAuthorities with ResourceOwner OTHER_ACCOUNTS returns empty", async () => {
  const client = acmPca();

  const listed = await client.send(
    new ListCertificateAuthoritiesCommand({ ResourceOwner: "OTHER_ACCOUNTS" }),
  );
  expect(listed.CertificateAuthorities).toHaveLength(0);
});

test("acmpca-07: DeletePolicy throws ResourceNotFoundException when no policy exists", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await expect(
    client.send(new DeletePolicyCommand({ ResourceArn: caArn })),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });

  await client.send(
    new PutPolicyCommand({
      ResourceArn: caArn,
      Policy: JSON.stringify({ Version: "2012-10-17", Statement: [] }),
    }),
  );

  await client.send(new DeletePolicyCommand({ ResourceArn: caArn }));

  await expect(
    client.send(new GetPolicyCommand({ ResourceArn: caArn })),
  ).rejects.toMatchObject({ name: "ResourceNotFoundException" });
});

test("acmpca-08: GetCertificateAuthorityCertificate works for DISABLED CA", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: CertificateAuthorityType.ROOT,
    }),
  );
  const caArn = created.CertificateAuthorityArn!;

  await client.send(
    new ImportCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
      Certificate: Buffer.from("fakecert"),
    }),
  );

  await client.send(
    new UpdateCertificateAuthorityCommand({
      CertificateAuthorityArn: caArn,
      Status: CertificateAuthorityStatus.DISABLED,
    }),
  );

  const caCert = await client.send(
    new GetCertificateAuthorityCertificateCommand({
      CertificateAuthorityArn: caArn,
    }),
  );
  expect(caCert.Certificate).toContain("BEGIN CERTIFICATE");
});
