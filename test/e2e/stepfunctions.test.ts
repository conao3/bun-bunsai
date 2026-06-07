import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
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

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

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

  await expect(
    client.send(new StopExecutionCommand({ executionArn })),
  ).rejects.toThrow();

  await client.send(
    new DeleteStateMachineCommand({ stateMachineArn: machineArn }),
  );

  await expect(
    client.send(
      new DescribeStateMachineCommand({ stateMachineArn: machineArn }),
    ),
  ).rejects.toThrow();
});
