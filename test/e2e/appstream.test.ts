import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  AppStreamClient,
  CreateFleetCommand,
  CreateStackCommand,
  DeleteFleetCommand,
  DeleteStackCommand,
  DescribeFleetsCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-appstream";
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

const appstream = () =>
  new AppStreamClient({
    endpoint,
    region,
    credentials,
    requestHandler: new NodeHttpHandler(),
  });

test("AppStream fleet and stack lifecycle", async () => {
  const client = appstream();
  const fleetName = "bunsai-e2e-fleet";
  const stackName = "bunsai-e2e-stack";

  const createdFleet = await client.send(
    new CreateFleetCommand({
      Name: fleetName,
      InstanceType: "stream.standard.medium",
      ComputeCapacity: { DesiredInstances: 2 },
    }),
  );
  expect(createdFleet.Fleet?.Name).toBe(fleetName);
  expect(createdFleet.Fleet?.State).toBe("RUNNING");
  expect(createdFleet.Fleet?.Arn).toContain(fleetName);

  const describedFleets = await client.send(
    new DescribeFleetsCommand({ Names: [fleetName] }),
  );
  expect((describedFleets.Fleets ?? []).some((f) => f.Name === fleetName)).toBe(
    true,
  );

  const createdStack = await client.send(
    new CreateStackCommand({ Name: stackName }),
  );
  expect(createdStack.Stack?.Name).toBe(stackName);
  expect(createdStack.Stack?.Arn).toContain(stackName);

  const describedStacks = await client.send(
    new DescribeStacksCommand({ Names: [stackName] }),
  );
  expect((describedStacks.Stacks ?? []).some((s) => s.Name === stackName)).toBe(
    true,
  );

  await client.send(new DeleteFleetCommand({ Name: fleetName }));
  await client.send(new DeleteStackCommand({ Name: stackName }));

  const afterDelete = await client.send(new DescribeFleetsCommand({}));
  expect((afterDelete.Fleets ?? []).some((f) => f.Name === fleetName)).toBe(
    false,
  );
});
