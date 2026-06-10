import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ACMClient,
  ListCertificatesCommand,
  ListTagsForCertificateCommand,
  RequestCertificateCommand,
  SearchCertificatesCommand,
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

test("ACM IdempotencyToken: same token returns same ARN", async () => {
  const client = acm();
  const token = `idem-${crypto.randomUUID()}`;

  const first = await client.send(
    new RequestCertificateCommand({
      DomainName: "bunsai-acm4-idem.example.com",
      ValidationMethod: "DNS",
      IdempotencyToken: token,
    }),
  );
  const second = await client.send(
    new RequestCertificateCommand({
      DomainName: "bunsai-acm4-idem.example.com",
      ValidationMethod: "DNS",
      IdempotencyToken: token,
    }),
  );

  expect(first.CertificateArn).toBeDefined();
  expect(second.CertificateArn).toBe(first.CertificateArn);
});

test("ACM IdempotencyToken: different tokens create distinct certificates", async () => {
  const client = acm();

  const first = await client.send(
    new RequestCertificateCommand({
      DomainName: "bunsai-acm4-difftoken.example.com",
      ValidationMethod: "DNS",
      IdempotencyToken: `tok-a-${crypto.randomUUID()}`,
    }),
  );
  const second = await client.send(
    new RequestCertificateCommand({
      DomainName: "bunsai-acm4-difftoken.example.com",
      ValidationMethod: "DNS",
      IdempotencyToken: `tok-b-${crypto.randomUUID()}`,
    }),
  );

  expect(first.CertificateArn).not.toBe(second.CertificateArn);
});

test("ACM RequestCertificate Tags are persisted", async () => {
  const client = acm();

  const requested = await client.send(
    new RequestCertificateCommand({
      DomainName: "bunsai-acm4-tags.example.com",
      ValidationMethod: "DNS",
      Tags: [
        { Key: "env", Value: "test" },
        { Key: "project", Value: "bunsai" },
      ],
    }),
  );
  const arn = requested.CertificateArn as string;
  expect(arn).toBeDefined();

  const listed = await client.send(
    new ListTagsForCertificateCommand({ CertificateArn: arn }),
  );
  const tags = listed.Tags ?? [];
  expect(tags.find((t) => t.Key === "env")?.Value).toBe("test");
  expect(tags.find((t) => t.Key === "project")?.Value).toBe("bunsai");
});

test("ACM SearchCertificates NextToken pagination round-trip", async () => {
  const client = acm();

  for (let i = 0; i < 5; i++) {
    await client.send(
      new RequestCertificateCommand({
        DomainName: `bunsai-acm4-srchpag${i}.example.com`,
        ValidationMethod: "DNS",
      }),
    );
  }

  const page1 = await client.send(
    new SearchCertificatesCommand({ MaxResults: 2 }),
  );
  expect((page1.Results ?? []).length).toBeLessThanOrEqual(2);

  if (page1.NextToken !== undefined) {
    const page2 = await client.send(
      new SearchCertificatesCommand({
        MaxResults: 2,
        NextToken: page1.NextToken,
      }),
    );
    const arns1 = new Set((page1.Results ?? []).map((r) => r.CertificateArn));
    const arns2 = (page2.Results ?? []).map((r) => r.CertificateArn);
    expect(arns2.every((arn) => !arns1.has(arn))).toBe(true);
  }
});

test("ACM ListCertificates pagination with MaxItems", async () => {
  const client = acm();

  for (let i = 0; i < 3; i++) {
    await client.send(
      new RequestCertificateCommand({
        DomainName: `bunsai-acm4-lstpag${i}.example.com`,
        ValidationMethod: "DNS",
      }),
    );
  }

  const page1 = await client.send(new ListCertificatesCommand({ MaxItems: 2 }));
  expect((page1.CertificateSummaryList ?? []).length).toBeLessThanOrEqual(2);

  if (page1.NextToken !== undefined) {
    const page2 = await client.send(
      new ListCertificatesCommand({ MaxItems: 2, NextToken: page1.NextToken }),
    );
    const arns1 = new Set(
      (page1.CertificateSummaryList ?? []).map((c) => c.CertificateArn),
    );
    const arns2 = (page2.CertificateSummaryList ?? []).map(
      (c) => c.CertificateArn,
    );
    expect(arns2.every((arn) => !arns1.has(arn))).toBe(true);
  }
});

test("ACM ListCertificates keyTypes filter returns matching algorithm only", async () => {
  const client = acm();

  await client.send(
    new RequestCertificateCommand({
      DomainName: "bunsai-acm4-rsa.example.com",
      ValidationMethod: "DNS",
      KeyAlgorithm: "RSA_2048",
    }),
  );

  const rsaOnly = await client.send(
    new ListCertificatesCommand({
      Includes: { keyTypes: ["RSA_2048"] },
    }),
  );
  const algos = (rsaOnly.CertificateSummaryList ?? []).map(
    (c) => c.KeyAlgorithm,
  );
  expect(algos.every((a) => a === "RSA_2048")).toBe(true);

  const ecOnly = await client.send(
    new ListCertificatesCommand({
      Includes: { keyTypes: ["EC_prime256v1"] },
    }),
  );
  const ecAlgos = (ecOnly.CertificateSummaryList ?? []).map(
    (c) => c.KeyAlgorithm,
  );
  expect(ecAlgos.every((a) => a === "EC_prime256v1")).toBe(true);
});

test("ACM ListCertificates SortBy CREATED_AT DESCENDING", async () => {
  const client = acm();

  for (let i = 0; i < 3; i++) {
    await client.send(
      new RequestCertificateCommand({
        DomainName: `bunsai-acm4-sort${i}.example.com`,
        ValidationMethod: "DNS",
      }),
    );
  }

  const result = await client.send(
    new ListCertificatesCommand({
      SortBy: "CREATED_AT",
      SortOrder: "DESCENDING",
    }),
  );
  const certs = result.CertificateSummaryList ?? [];
  for (let i = 1; i < certs.length; i++) {
    const prev = certs[i - 1]?.CreatedAt?.getTime() ?? 0;
    const curr = certs[i]?.CreatedAt?.getTime() ?? 0;
    expect(prev).toBeGreaterThanOrEqual(curr);
  }
});
