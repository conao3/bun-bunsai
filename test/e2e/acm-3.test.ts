import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ACMClient,
  DescribeCertificateCommand,
  ImportCertificateCommand,
  ListCertificatesCommand,
  RequestCertificateCommand,
} from "@aws-sdk/client-acm";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const acm = () =>
  new ACMClient({
    endpoint,
    region,
    credentials,
    requestHandler,
  });

test("ACM RequestCertificate lifecycle: PENDING_VALIDATION → ISSUED with DomainValidationOptions", async () => {
  const client = acm();
  const domainName = "bunsai-lifecycle.example.com";
  const san = `*.${domainName}`;

  const requested = await client.send(
    new RequestCertificateCommand({
      DomainName: domainName,
      ValidationMethod: "DNS",
      SubjectAlternativeNames: [domainName, san],
    }),
  );
  expect(requested.CertificateArn).toBeDefined();
  const arn = requested.CertificateArn as string;

  const pending = await client.send(
    new DescribeCertificateCommand({ CertificateArn: arn }),
  );
  expect(pending.Certificate?.Status).toBe("PENDING_VALIDATION");
  const dvo = pending.Certificate?.DomainValidationOptions ?? [];
  expect(dvo.length).toBe(2);
  const dnsEntry = dvo[0];
  expect(dnsEntry?.ResourceRecord).toBeDefined();
  expect(dnsEntry?.ResourceRecord?.Type).toBe("CNAME");
  expect(dnsEntry?.ResourceRecord?.Name).toContain("_acm-challenge.");
  expect(dnsEntry?.ResourceRecord?.Value).toContain("acm-validations.aws");

  const pendingList = await client.send(
    new ListCertificatesCommand({
      CertificateStatuses: ["PENDING_VALIDATION"],
    }),
  );
  const pendingArns = (pendingList.CertificateSummaryList ?? []).map(
    (c) => c.CertificateArn,
  );
  expect(pendingArns).toContain(arn);

  const issued = await client.send(
    new DescribeCertificateCommand({ CertificateArn: arn }),
  );
  expect(issued.Certificate?.Status).toBe("ISSUED");
  expect(issued.Certificate?.IssuedAt).toBeDefined();

  const issuedList = await client.send(
    new ListCertificatesCommand({ CertificateStatuses: ["ISSUED"] }),
  );
  const issuedArns = (issuedList.CertificateSummaryList ?? []).map(
    (c) => c.CertificateArn,
  );
  expect(issuedArns).toContain(arn);

  const imported = await client.send(
    new ImportCertificateCommand({
      Certificate: Buffer.from("fake-cert"),
      PrivateKey: Buffer.from("fake-key"),
    }),
  );
  const importedArn = imported.CertificateArn as string;
  const importedDesc = await client.send(
    new DescribeCertificateCommand({ CertificateArn: importedArn }),
  );
  expect(importedDesc.Certificate?.Status).toBe("ISSUED");
});
