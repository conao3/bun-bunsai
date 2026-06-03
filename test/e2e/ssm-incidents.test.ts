import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  CreateResponsePlanCommand,
  DeleteResponsePlanCommand,
  GetResponsePlanCommand,
  ListResponsePlansCommand,
  SSMIncidentsClient,
} from "@aws-sdk/client-ssm-incidents";

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

const incidents = () =>
  new SSMIncidentsClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("SSMIncidents response plan roundtrip", async () => {
  const client = incidents();
  const planName = `bunsaie2e${Date.now()}`;

  const created = await client.send(
    new CreateResponsePlanCommand({
      name: planName,
      displayName: "bunsai e2e response plan",
      incidentTemplate: {
        title: "bunsai incident",
        impact: 3,
      },
    }),
  );
  expect(created.arn).toBeDefined();
  const arn = created.arn ?? "";

  const got = await client.send(new GetResponsePlanCommand({ arn }));
  expect(got.arn).toBe(arn);
  expect(got.name).toBe(planName);
  expect(got.displayName).toBe("bunsai e2e response plan");
  expect(got.incidentTemplate?.title).toBe("bunsai incident");
  expect(got.incidentTemplate?.impact).toBe(3);

  const listed = await client.send(new ListResponsePlansCommand({}));
  expect((listed.responsePlanSummaries ?? []).map((s) => s.arn)).toContain(arn);

  await client.send(new DeleteResponsePlanCommand({ arn }));

  await expect(
    client.send(new GetResponsePlanCommand({ arn })),
  ).rejects.toThrow();
});
