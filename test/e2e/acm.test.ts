import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  ACMClient,
  DeleteCertificateCommand,
  DescribeCertificateCommand,
  GetCertificateCommand,
  ListCertificatesCommand,
  RequestCertificateCommand,
} from "@aws-sdk/client-acm";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const acm = () =>
  new ACMClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
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

  const described = await client.send(
    new DescribeCertificateCommand({ CertificateArn: certificateArn }),
  );
  expect(described.Certificate?.DomainName).toBe(domainName);
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
