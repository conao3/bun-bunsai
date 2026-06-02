import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateStateMachineCommand,
  DeleteStateMachineCommand,
  DescribeExecutionCommand,
  DescribeStateMachineCommand,
  ListExecutionsCommand,
  ListStateMachinesCommand,
  SFNClient,
  StartExecutionCommand,
  StopExecutionCommand,
} from "@aws-sdk/client-sfn";

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

const sfn = () => new SFNClient({ endpoint, region, credentials });

test("Step Functions state machine and execution lifecycle", async () => {
  const client = sfn();
  const machineName = "bunsai-e2e-machine";
  const definition = JSON.stringify({
    StartAt: "Pass",
    States: { Pass: { Type: "Pass", End: true } },
  });
  const roleArn = `arn:aws:iam::000000000000:role/bunsai-e2e-role`;

  const created = await client.send(
    new CreateStateMachineCommand({
      name: machineName,
      definition,
      roleArn,
    }),
  );
  expect(created.stateMachineArn).toContain(`stateMachine:${machineName}`);
  expect(created.creationDate).toBeInstanceOf(Date);
  const machineArn = created.stateMachineArn ?? "";

  const described = await client.send(
    new DescribeStateMachineCommand({ stateMachineArn: machineArn }),
  );
  expect(described.name).toBe(machineName);
  expect(described.stateMachineArn).toBe(machineArn);
  expect(described.definition).toBe(definition);
  expect(described.roleArn).toBe(roleArn);
  expect(described.status).toBe("ACTIVE");
  expect(described.type).toBe("STANDARD");

  const listedMachines = await client.send(new ListStateMachinesCommand({}));
  const machineArns = (listedMachines.stateMachines ?? []).map(
    (m) => m.stateMachineArn,
  );
  expect(machineArns).toContain(machineArn);

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "bunsai-e2e-exec",
      input: JSON.stringify({ value: 1 }),
    }),
  );
  expect(started.executionArn).toContain("execution:");
  expect(started.startDate).toBeInstanceOf(Date);
  const executionArn = started.executionArn ?? "";

  const describedExec = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(describedExec.executionArn).toBe(executionArn);
  expect(describedExec.stateMachineArn).toBe(machineArn);
  expect(describedExec.name).toBe("bunsai-e2e-exec");
  expect(describedExec.status).toBe("SUCCEEDED");
  expect(describedExec.input).toBe(JSON.stringify({ value: 1 }));

  const listedExecs = await client.send(
    new ListExecutionsCommand({ stateMachineArn: machineArn }),
  );
  const execArns = (listedExecs.executions ?? []).map((e) => e.executionArn);
  expect(execArns).toContain(executionArn);

  const stopped = await client.send(new StopExecutionCommand({ executionArn }));
  expect(stopped.stopDate).toBeInstanceOf(Date);

  const afterStop = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(afterStop.status).toBe("ABORTED");

  await client.send(
    new DeleteStateMachineCommand({ stateMachineArn: machineArn }),
  );

  await expect(
    client.send(
      new DescribeStateMachineCommand({ stateMachineArn: machineArn }),
    ),
  ).rejects.toThrow();
});
