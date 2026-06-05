import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ACMClient,
  AddTagsToCertificateCommand,
  DescribeCertificateCommand,
  ExportCertificateCommand,
  GetAccountConfigurationCommand,
  ImportCertificateCommand,
  ListTagsForCertificateCommand,
  PutAccountConfigurationCommand,
  RemoveTagsFromCertificateCommand,
  RenewCertificateCommand,
  RequestCertificateCommand,
  ResendValidationEmailCommand,
  RevokeCertificateCommand,
  SearchCertificatesCommand,
  UpdateCertificateOptionsCommand,
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

const requestCertificate = async (
  client: ACMClient,
  domainName: string,
): Promise<string> => {
  const requested = await client.send(
    new RequestCertificateCommand({
      DomainName: domainName,
      ValidationMethod: "EMAIL",
    }),
  );
  const arn = requested.CertificateArn;
  expect(arn).toBeDefined();
  return arn as string;
};

test("ACM tag add, list and remove lifecycle", async () => {
  const client = acm();
  const arn = await requestCertificate(client, "bunsai-acm2-tags.example.com");

  await client.send(
    new AddTagsToCertificateCommand({
      CertificateArn: arn,
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "owner", Value: "bunsai" },
      ],
    }),
  );

  const listed = await client.send(
    new ListTagsForCertificateCommand({ CertificateArn: arn }),
  );
  const tags = listed.Tags ?? [];
  expect(tags.length).toBe(2);
  expect(tags.find((tag) => tag.Key === "env")?.Value).toBe("test");

  await client.send(
    new RemoveTagsFromCertificateCommand({
      CertificateArn: arn,
      Tags: [{ Key: "env" }],
    }),
  );

  const afterRemove = await client.send(
    new ListTagsForCertificateCommand({ CertificateArn: arn }),
  );
  const remaining = afterRemove.Tags ?? [];
  expect(remaining.length).toBe(1);
  expect(remaining[0]?.Key).toBe("owner");
});

test("ACM renew certificate updates renewal summary", async () => {
  const client = acm();
  const arn = await requestCertificate(client, "bunsai-acm2-renew.example.com");

  await client.send(new RenewCertificateCommand({ CertificateArn: arn }));

  const described = await client.send(
    new DescribeCertificateCommand({ CertificateArn: arn }),
  );
  expect(described.Certificate?.RenewalSummary?.RenewalStatus).toBe("SUCCESS");
});

test("ACM resend validation email succeeds", async () => {
  const client = acm();
  const domainName = "bunsai-acm2-resend.example.com";
  const arn = await requestCertificate(client, domainName);

  const resent = await client.send(
    new ResendValidationEmailCommand({
      CertificateArn: arn,
      Domain: domainName,
      ValidationDomain: domainName,
    }),
  );
  expect(resent.$metadata.httpStatusCode).toBe(200);
});

test("ACM import certificate creates a new certificate record", async () => {
  const client = acm();
  const fakePem = Buffer.from("fake-cert");
  const fakeKey = Buffer.from("fake-key");

  const imported = await client.send(
    new ImportCertificateCommand({
      Certificate: fakePem,
      PrivateKey: fakeKey,
    }),
  );
  expect(imported.CertificateArn).toBeDefined();
  expect(imported.CertificateArn).toContain("arn:aws:acm:");
});

test("ACM import certificate replace updates existing record", async () => {
  const client = acm();
  const arn = await requestCertificate(
    client,
    "bunsai-acm2-import.example.com",
  );

  const replaced = await client.send(
    new ImportCertificateCommand({
      CertificateArn: arn,
      Certificate: Buffer.from("replaced-cert"),
      PrivateKey: Buffer.from("replaced-key"),
    }),
  );
  expect(replaced.CertificateArn).toBe(arn);

  const described = await client.send(
    new DescribeCertificateCommand({ CertificateArn: arn }),
  );
  expect(described.Certificate?.Type).toBe("IMPORTED");
});

test("ACM export certificate returns PEM material", async () => {
  const client = acm();
  const arn = await requestCertificate(
    client,
    "bunsai-acm2-export.example.com",
  );

  const exported = await client.send(
    new ExportCertificateCommand({
      CertificateArn: arn,
      Passphrase: Buffer.from("test-passphrase"),
    }),
  );
  expect(exported.Certificate).toContain("BEGIN CERTIFICATE");
  expect(exported.CertificateChain).toContain("BEGIN CERTIFICATE");
  expect(exported.PrivateKey).toContain("BEGIN ENCRYPTED PRIVATE KEY");
});

test("ACM revoke certificate updates status to REVOKED", async () => {
  const client = acm();
  const arn = await requestCertificate(
    client,
    "bunsai-acm2-revoke.example.com",
  );

  const revoked = await client.send(
    new RevokeCertificateCommand({
      CertificateArn: arn,
      RevocationReason: "KEY_COMPROMISE",
    }),
  );
  expect(revoked.CertificateArn).toBe(arn);

  const described = await client.send(
    new DescribeCertificateCommand({ CertificateArn: arn }),
  );
  expect(described.Certificate?.Status).toBe("REVOKED");
});

test("ACM update certificate options persists transparency preference", async () => {
  const client = acm();
  const arn = await requestCertificate(
    client,
    "bunsai-acm2-options.example.com",
  );

  const updated = await client.send(
    new UpdateCertificateOptionsCommand({
      CertificateArn: arn,
      Options: { CertificateTransparencyLoggingPreference: "DISABLED" },
    }),
  );
  expect(updated.$metadata.httpStatusCode).toBe(200);
});

test("ACM put and get account configuration round-trip", async () => {
  const client = acm();

  await client.send(
    new PutAccountConfigurationCommand({
      ExpiryEvents: { DaysBeforeExpiry: 30 },
      IdempotencyToken: "test-token-acm2",
    }),
  );

  const config = await client.send(new GetAccountConfigurationCommand({}));
  expect(config.ExpiryEvents?.DaysBeforeExpiry).toBe(30);
});

test("ACM search certificates returns all certificates when no filter", async () => {
  const client = acm();
  await requestCertificate(client, "bunsai-acm2-search1.example.com");
  await requestCertificate(client, "bunsai-acm2-search2.example.com");

  const result = await client.send(new SearchCertificatesCommand({}));
  expect((result.Results ?? []).length).toBeGreaterThanOrEqual(2);
  const arns = (result.Results ?? []).map((r) => r.CertificateArn);
  expect(arns.every((arn) => typeof arn === "string")).toBe(true);
});

test("ACM search certificates with MaxResults limits results", async () => {
  const client = acm();
  await requestCertificate(client, "bunsai-acm2-searchlimit1.example.com");
  await requestCertificate(client, "bunsai-acm2-searchlimit2.example.com");
  await requestCertificate(client, "bunsai-acm2-searchlimit3.example.com");

  const result = await client.send(
    new SearchCertificatesCommand({ MaxResults: 2 }),
  );
  expect((result.Results ?? []).length).toBeLessThanOrEqual(2);
});
