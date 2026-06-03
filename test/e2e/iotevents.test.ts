import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateInputCommand,
  DeleteInputCommand,
  DescribeInputCommand,
  IoTEventsClient,
  ListInputsCommand,
} from "@aws-sdk/client-iot-events";
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

const iotevents = () =>
  new IoTEventsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("IoT Events input roundtrip", async () => {
  const client = iotevents();
  const inputName = `bunsai_e2e_${Date.now()}`;

  const created = await client.send(
    new CreateInputCommand({
      inputName,
      inputDescription: "created by bunsai",
      inputDefinition: {
        attributes: [{ jsonPath: "temperature" }, { jsonPath: "humidity" }],
      },
    }),
  );
  expect(created.inputConfiguration?.inputName).toBe(inputName);
  expect(created.inputConfiguration?.inputArn).toContain(`input/${inputName}`);
  expect(created.inputConfiguration?.status).toBe("ACTIVE");

  const described = await client.send(new DescribeInputCommand({ inputName }));
  expect(described.input?.inputConfiguration?.inputName).toBe(inputName);
  expect(described.input?.inputConfiguration?.status).toBe("ACTIVE");

  const listed = await client.send(new ListInputsCommand({}));
  expect(
    (listed.inputSummaries ?? []).map((summary) => summary.inputName),
  ).toContain(inputName);

  await client.send(new DeleteInputCommand({ inputName }));

  await expect(
    client.send(new DescribeInputCommand({ inputName })),
  ).rejects.toThrow();
});
