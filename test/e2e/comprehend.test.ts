import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  ComprehendClient,
  CreateEndpointCommand,
  DeleteEndpointCommand,
  DescribeEndpointCommand,
  ListEndpointsCommand,
} from "@aws-sdk/client-comprehend";

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

const comprehend = () =>
  new ComprehendClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("Comprehend endpoint roundtrip", async () => {
  const client = comprehend();
  const endpointName = `bunsai-e2e-${Date.now()}`;
  const modelArn = `arn:aws:comprehend:${region}:000000000000:document-classifier/bunsai-model`;

  const created = await client.send(
    new CreateEndpointCommand({
      EndpointName: endpointName,
      ModelArn: modelArn,
      DesiredInferenceUnits: 1,
    }),
  );
  expect(created.EndpointArn).toBeDefined();
  const endpointArn = created.EndpointArn ?? "";

  const described = await client.send(
    new DescribeEndpointCommand({ EndpointArn: endpointArn }),
  );
  expect(described.EndpointProperties?.EndpointArn).toBe(endpointArn);
  expect(described.EndpointProperties?.Status).toBe("IN_SERVICE");
  expect(described.EndpointProperties?.DesiredInferenceUnits).toBe(1);

  const listed = await client.send(new ListEndpointsCommand({}));
  expect(
    (listed.EndpointPropertiesList ?? []).map((e) => e.EndpointArn),
  ).toContain(endpointArn);

  await client.send(new DeleteEndpointCommand({ EndpointArn: endpointArn }));
  await expect(
    client.send(new DescribeEndpointCommand({ EndpointArn: endpointArn })),
  ).rejects.toThrow();
});
