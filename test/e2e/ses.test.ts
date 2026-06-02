import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  DeleteIdentityCommand,
  GetIdentityVerificationAttributesCommand,
  GetSendQuotaCommand,
  ListIdentitiesCommand,
  SendEmailCommand,
  SendRawEmailCommand,
  SESClient,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";

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

const ses = () => new SESClient({ endpoint, region, credentials });

test("SES identity verification and send lifecycle", async () => {
  const client = ses();
  const address = "sender@bunsai-e2e.example.com";

  await client.send(new VerifyEmailIdentityCommand({ EmailAddress: address }));

  const listed = await client.send(new ListIdentitiesCommand({}));
  expect(listed.Identities ?? []).toContain(address);

  const attrs = await client.send(
    new GetIdentityVerificationAttributesCommand({ Identities: [address] }),
  );
  expect(attrs.VerificationAttributes?.[address]?.VerificationStatus).toBe(
    "Success",
  );

  const sent = await client.send(
    new SendEmailCommand({
      Source: address,
      Destination: { ToAddresses: ["recipient@example.com"] },
      Message: {
        Subject: { Data: "hello bunsai ses" },
        Body: { Text: { Data: "body text" } },
      },
    }),
  );
  expect(sent.MessageId).toBeDefined();
  expect((sent.MessageId ?? "").length).toBeGreaterThan(0);

  const rawData = new TextEncoder().encode(
    `From: ${address}\r\nTo: recipient@example.com\r\nSubject: raw\r\n\r\nraw body\r\n`,
  );
  const rawSent = await client.send(
    new SendRawEmailCommand({
      Source: address,
      Destinations: ["recipient@example.com"],
      RawMessage: { Data: rawData },
    }),
  );
  expect(rawSent.MessageId).toBeDefined();
  expect((rawSent.MessageId ?? "").length).toBeGreaterThan(0);

  const quota = await client.send(new GetSendQuotaCommand({}));
  expect(quota.Max24HourSend).toBe(200);
  expect(quota.MaxSendRate).toBe(1);

  await client.send(new DeleteIdentityCommand({ Identity: address }));
  const afterDelete = await client.send(new ListIdentitiesCommand({}));
  expect(afterDelete.Identities ?? []).not.toContain(address);
});

test("SES rejects sending from unverified identity", async () => {
  const client = ses();
  await expect(
    client.send(
      new SendEmailCommand({
        Source: "unverified@bunsai-e2e.example.com",
        Destination: { ToAddresses: ["recipient@example.com"] },
        Message: {
          Subject: { Data: "x" },
          Body: { Text: { Data: "y" } },
        },
      }),
    ),
  ).rejects.toThrow();
});
