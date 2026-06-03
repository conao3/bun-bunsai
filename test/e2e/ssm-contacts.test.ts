import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateContactCommand,
  DeleteContactCommand,
  GetContactCommand,
  ListContactsCommand,
  SSMContactsClient,
} from "@aws-sdk/client-ssm-contacts";
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

const ssmContacts = () =>
  new SSMContactsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("SSMContacts contact roundtrip", async () => {
  const client = ssmContacts();
  const alias = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(
    new CreateContactCommand({
      Alias: alias,
      Type: "PERSONAL",
      Plan: { Stages: [] },
    }),
  );
  expect(created.ContactArn).toContain(`contact/${alias}`);

  const got = await client.send(
    new GetContactCommand({ ContactId: created.ContactArn }),
  );
  expect(got.ContactArn).toBe(created.ContactArn);
  expect(got.Alias).toBe(alias);
  expect(got.Type).toBe("PERSONAL");
  expect(got.Plan?.Stages).toEqual([]);

  const listed = await client.send(new ListContactsCommand({}));
  expect((listed.Contacts ?? []).map((c) => c.Alias)).toContain(alias);

  await client.send(
    new DeleteContactCommand({ ContactId: created.ContactArn }),
  );
  await expect(
    client.send(new GetContactCommand({ ContactId: created.ContactArn })),
  ).rejects.toThrow();
});
