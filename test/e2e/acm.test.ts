import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ACMClient,
  DeleteCertificateCommand,
  DescribeCertificateCommand,
  GetCertificateCommand,
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

test("ACM certificate request, describe and delete lifecycle", async () => {
  const client = acm();
  const domainName = "bunsai-e2e.example.com";

  const requested = await client.send(
    new RequestCertificateCommand({
      DomainName: domainName,
      ValidationMethod: "DNS",
    }),
  );
  const certificateArn = requested.CertificateArn;
  expect(certificateArn).toBeDefined();

  const pending = await client.send(
    new DescribeCertificateCommand({ CertificateArn: certificateArn }),
  );
  expect(pending.Certificate?.DomainName).toBe(domainName);
  expect(pending.Certificate?.Status).toBe("PENDING_VALIDATION");

  const described = await client.send(
    new DescribeCertificateCommand({ CertificateArn: certificateArn }),
  );
  expect(described.Certificate?.Status).toBe("ISSUED");

  const listed = await client.send(new ListCertificatesCommand({}));
  const arns = (listed.CertificateSummaryList ?? []).map(
    (summary) => summary.CertificateArn,
  );
  expect(arns).toContain(certificateArn);

  const fetched = await client.send(
    new GetCertificateCommand({ CertificateArn: certificateArn }),
  );
  expect(fetched.Certificate).toContain("BEGIN CERTIFICATE");

  await client.send(
    new DeleteCertificateCommand({ CertificateArn: certificateArn }),
  );
  const afterDelete = await client.send(new ListCertificatesCommand({}));
  const afterArns = (afterDelete.CertificateSummaryList ?? []).map(
    (summary) => summary.CertificateArn,
  );
  expect(afterArns).not.toContain(certificateArn);
});
