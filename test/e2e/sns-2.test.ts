import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreatePlatformApplicationCommand,
  CreatePlatformEndpointCommand,
  DeleteEndpointCommand,
  GetEndpointAttributesCommand,
  ListEndpointsByPlatformApplicationCommand,
  SetEndpointAttributesCommand,
  SNSClient,
} from "@aws-sdk/client-sns";

const awsPort = 4631;
const uiPort = 5731;
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

const sns = () => new SNSClient({ endpoint, region, credentials });

test("SNS platform endpoint lifecycle", async () => {
  const client = sns();

  const app = await client.send(
    new CreatePlatformApplicationCommand({
      Name: "bunsai-e2e-app",
      Platform: "GCM",
      Attributes: { PlatformCredential: "secret" },
    }),
  );
  const platformApplicationArn = app.PlatformApplicationArn;
  expect(platformApplicationArn).toBeDefined();

  const created = await client.send(
    new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformApplicationArn,
      Token: "device-token-1",
      CustomUserData: "user-1",
    }),
  );
  const endpointArn = created.EndpointArn;
  expect(endpointArn).toBeDefined();

  const idempotent = await client.send(
    new CreatePlatformEndpointCommand({
      PlatformApplicationArn: platformApplicationArn,
      Token: "device-token-1",
    }),
  );
  expect(idempotent.EndpointArn).toBe(endpointArn);

  const initial = await client.send(
    new GetEndpointAttributesCommand({ EndpointArn: endpointArn }),
  );
  expect(initial.Attributes?.Token).toBe("device-token-1");
  expect(initial.Attributes?.Enabled).toBe("true");
  expect(initial.Attributes?.CustomUserData).toBe("user-1");

  await client.send(
    new SetEndpointAttributesCommand({
      EndpointArn: endpointArn,
      Attributes: { Enabled: "false" },
    }),
  );

  const afterSet = await client.send(
    new GetEndpointAttributesCommand({ EndpointArn: endpointArn }),
  );
  expect(afterSet.Attributes?.Enabled).toBe("false");
  expect(afterSet.Attributes?.Token).toBe("device-token-1");

  const listed = await client.send(
    new ListEndpointsByPlatformApplicationCommand({
      PlatformApplicationArn: platformApplicationArn,
    }),
  );
  const arns = (listed.Endpoints ?? []).map((e) => e.EndpointArn);
  expect(arns).toContain(endpointArn);

  await client.send(new DeleteEndpointCommand({ EndpointArn: endpointArn }));

  const afterDelete = await client.send(
    new ListEndpointsByPlatformApplicationCommand({
      PlatformApplicationArn: platformApplicationArn,
    }),
  );
  const remaining = (afterDelete.Endpoints ?? []).map((e) => e.EndpointArn);
  expect(remaining).not.toContain(endpointArn);
});
