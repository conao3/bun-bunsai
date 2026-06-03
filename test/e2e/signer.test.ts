import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CancelSigningProfileCommand,
  GetSigningProfileCommand,
  ListSigningProfilesCommand,
  PutSigningProfileCommand,
  SignerClient,
} from "@aws-sdk/client-signer";

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

const signer = () => new SignerClient({ endpoint, region, credentials });

test("Signer signing profile roundtrip", async () => {
  const client = signer();
  const name = `bunsai_e2e_${Date.now()}`;
  const platformId = "AWSLambda-SHA384-ECDSA";

  const put = await client.send(
    new PutSigningProfileCommand({
      profileName: name,
      platformId,
    }),
  );
  expect(put.arn).toContain(`signing-profiles/${name}`);
  expect(put.profileVersion).toBeDefined();
  expect(put.profileVersionArn).toContain(name);

  const got = await client.send(
    new GetSigningProfileCommand({ profileName: name }),
  );
  expect(got.profileName).toBe(name);
  expect(got.platformId).toBe(platformId);
  expect(got.status).toBe("Active");
  expect(got.arn).toBe(put.arn);

  const listed = await client.send(new ListSigningProfilesCommand({}));
  expect((listed.profiles ?? []).map((p) => p.profileName)).toContain(name);

  await client.send(new CancelSigningProfileCommand({ profileName: name }));

  const afterCancel = await client.send(
    new GetSigningProfileCommand({ profileName: name }),
  );
  expect(afterCancel.status).toBe("Canceled");
});
