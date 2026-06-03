import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ActivateGatewayCommand,
  DeleteGatewayCommand,
  DescribeGatewayInformationCommand,
  ListGatewaysCommand,
  StorageGatewayClient,
} from "@aws-sdk/client-storage-gateway";

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

const client = () =>
  new StorageGatewayClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("storagegateway gateway round-trip", async () => {
  const sgw = client();

  const activated = await sgw.send(
    new ActivateGatewayCommand({
      ActivationKey: "ABCDE-12345-FGHIJ-67890-KLMNO",
      GatewayName: "bunsai-e2e-gateway",
      GatewayTimezone: "GMT-5:00",
      GatewayRegion: region,
    }),
  );
  const arn = activated.GatewayARN;
  expect(arn).toContain(":gateway/sgw-");

  const described = await sgw.send(
    new DescribeGatewayInformationCommand({ GatewayARN: arn }),
  );
  expect(described.GatewayARN).toBe(arn);
  expect(described.GatewayName).toBe("bunsai-e2e-gateway");
  expect(described.GatewayTimezone).toBe("GMT-5:00");
  expect(described.GatewayState).toBe("RUNNING");

  const listed = await sgw.send(new ListGatewaysCommand({}));
  const arns = (listed.Gateways ?? []).map((entry) => entry.GatewayARN);
  expect(arns).toContain(arn);

  const deleted = await sgw.send(new DeleteGatewayCommand({ GatewayARN: arn }));
  expect(deleted.GatewayARN).toBe(arn);

  await expect(
    sgw.send(new DescribeGatewayInformationCommand({ GatewayARN: arn })),
  ).rejects.toThrow();
});
