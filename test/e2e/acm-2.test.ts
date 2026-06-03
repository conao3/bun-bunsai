import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  ACMClient,
  AddTagsToCertificateCommand,
  DescribeCertificateCommand,
  ListTagsForCertificateCommand,
  RemoveTagsFromCertificateCommand,
  RenewCertificateCommand,
  RequestCertificateCommand,
  ResendValidationEmailCommand,
} from "@aws-sdk/client-acm";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const awsPort = 4576;
const uiPort = 5676;
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
