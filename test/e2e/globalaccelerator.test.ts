import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateAcceleratorCommand,
  DeleteAcceleratorCommand,
  DescribeAcceleratorCommand,
  GlobalAcceleratorClient,
  ListAcceleratorsCommand,
  UpdateAcceleratorCommand,
} from "@aws-sdk/client-global-accelerator";
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

const globalaccelerator = () =>
  new GlobalAcceleratorClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("GlobalAccelerator accelerator lifecycle", async () => {
  const client = globalaccelerator();
  const name = "bunsai-e2e-accelerator";

  const created = await client.send(
    new CreateAcceleratorCommand({
      Name: name,
      IdempotencyToken: crypto.randomUUID(),
      Enabled: true,
    }),
  );
  expect(created.Accelerator?.Name).toBe(name);
  expect(created.Accelerator?.Status).toBe("DEPLOYED");
  expect(created.Accelerator?.DnsName).toBeDefined();
  const arn = created.Accelerator?.AcceleratorArn ?? "";
  expect(arn).toContain("accelerator/");

  const described = await client.send(
    new DescribeAcceleratorCommand({ AcceleratorArn: arn }),
  );
  expect(described.Accelerator?.Name).toBe(name);

  const listed = await client.send(new ListAcceleratorsCommand({}));
  expect(
    (listed.Accelerators ?? []).some((a) => a.AcceleratorArn === arn),
  ).toBe(true);

  const updated = await client.send(
    new UpdateAcceleratorCommand({
      AcceleratorArn: arn,
      Name: "bunsai-e2e-accelerator-2",
    }),
  );
  expect(updated.Accelerator?.Name).toBe("bunsai-e2e-accelerator-2");

  await client.send(new DeleteAcceleratorCommand({ AcceleratorArn: arn }));
});
