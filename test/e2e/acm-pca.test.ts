import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ACMPCAClient,
  CreateCertificateAuthorityCommand,
  DeleteCertificateAuthorityCommand,
  DescribeCertificateAuthorityCommand,
  GetCertificateAuthorityCertificateCommand,
  GetCertificateAuthorityCsrCommand,
  GetCertificateCommand,
  ImportCertificateAuthorityCertificateCommand,
  IssueCertificateCommand,
  ListCertificateAuthoritiesCommand,
  ListTagsCommand,
  RevokeCertificateCommand,
  TagCertificateAuthorityCommand,
  UntagCertificateAuthorityCommand,
  UpdateCertificateAuthorityCommand,
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
  KeyAlgorithm: "RSA_2048",
  SigningAlgorithm: "SHA256WITHRSA",
  Subject: { CommonName: "bunsai-e2e-ca.example.com" },
};

test("ACM PCA CA lifecycle: PENDING_CERTIFICATE → import → ACTIVE → issue → revoke", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: "ROOT",
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
      SigningAlgorithm: "SHA256WITHRSA",
      Validity: { Type: "DAYS", Value: 365 },
    }),
  );
  const certArn = issued.CertificateArn;
  expect(certArn).toBeDefined();
  expect(certArn).toContain("/certificate/");

  const idempotentIssued = await client.send(
    new IssueCertificateCommand({
      CertificateAuthorityArn: caArn,
      Csr: Buffer.from(csrResult.Csr ?? ""),
      SigningAlgorithm: "SHA256WITHRSA",
      Validity: { Type: "DAYS", Value: 365 },
      IdempotencyToken: "token-abc",
    }),
  );
  const certArn2 = idempotentIssued.CertificateArn;
  const idempotentIssued2 = await client.send(
    new IssueCertificateCommand({
      CertificateAuthorityArn: caArn,
      Csr: Buffer.from(csrResult.Csr ?? ""),
      SigningAlgorithm: "SHA256WITHRSA",
      Validity: { Type: "DAYS", Value: 365 },
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
      RevocationReason: "KEY_COMPROMISE",
    }),
  );

  await expect(
    client.send(
      new RevokeCertificateCommand({
        CertificateAuthorityArn: caArn,
        CertificateSerial: serial,
        RevocationReason: "KEY_COMPROMISE",
      }),
    ),
  ).rejects.toMatchObject({ name: "RequestAlreadyProcessedException" });
});

test("ACM PCA tags round-trip", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: "ROOT",
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
      CertificateAuthorityType: "ROOT",
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
        SigningAlgorithm: "SHA256WITHRSA",
        Validity: { Type: "DAYS", Value: 1 },
      }),
    ),
  ).rejects.toMatchObject({ name: "InvalidStateException" });
});

test("ACM PCA update CA status", async () => {
  const client = acmPca();

  const created = await client.send(
    new CreateCertificateAuthorityCommand({
      CertificateAuthorityConfiguration: caConfig,
      CertificateAuthorityType: "ROOT",
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
      Status: "DISABLED",
    }),
  );

  const described = await client.send(
    new DescribeCertificateAuthorityCommand({ CertificateAuthorityArn: caArn }),
  );
  expect(described.CertificateAuthority?.Status).toBe("DISABLED");
});
