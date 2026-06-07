import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStateMachineCommand,
  DescribeExecutionCommand,
  SFNClient,
  StartExecutionCommand,
  StartSyncExecutionCommand,
  StopExecutionCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });
const sfnSync = () =>
  new SFNClient({
    endpoint,
    region,
    credentials,
    requestHandler,
    disableHostPrefix: true,
  });
const roleArn = "arn:aws:iam::000000000000:role/bunsai-e2e-role";

test("ASL: Pass with Result transforms output", async () => {
  const client = sfn();
  const definition = JSON.stringify({
    StartAt: "Transform",
    States: {
      Transform: {
        Type: "Pass",
        Result: { transformed: true, value: 42 },
        End: true,
      },
    },
  });
  const created = await client.send(
    new CreateStateMachineCommand({
      name: "asl-pass-result",
      definition,
      roleArn,
    }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "asl-pass-result-exec",
      input: JSON.stringify({ original: "data" }),
    }),
  );
  const described = await client.send(
    new DescribeExecutionCommand({ executionArn: started.executionArn ?? "" }),
  );
  expect(described.status).toBe("SUCCEEDED");
  const output = JSON.parse(described.output ?? "{}");
  expect(output.transformed).toBe(true);
  expect(output.value).toBe(42);
  expect(output.original).toBeUndefined();
});

test("ASL: Pass with ResultPath merges result into input", async () => {
  const client = sfn();
  const definition = JSON.stringify({
    StartAt: "Merge",
    States: {
      Merge: {
        Type: "Pass",
        Result: { status: "ok" },
        ResultPath: "$.result",
        End: true,
      },
    },
  });
  const created = await client.send(
    new CreateStateMachineCommand({
      name: "asl-pass-resultpath",
      definition,
      roleArn,
    }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "asl-pass-resultpath-exec",
      input: JSON.stringify({ id: 1 }),
    }),
  );
  const described = await client.send(
    new DescribeExecutionCommand({ executionArn: started.executionArn ?? "" }),
  );
  expect(described.status).toBe("SUCCEEDED");
  const output = JSON.parse(described.output ?? "{}");
  expect(output.id).toBe(1);
  expect(output.result).toEqual({ status: "ok" });
});

test("ASL: Choice branches on input value", async () => {
  const client = sfn();
  const definition = JSON.stringify({
    StartAt: "Route",
    States: {
      Route: {
        Type: "Choice",
        Choices: [
          { Variable: "$.route", StringEquals: "A", Next: "RouteA" },
          { Variable: "$.route", StringEquals: "B", Next: "RouteB" },
        ],
        Default: "RouteDefault",
      },
      RouteA: { Type: "Pass", Result: { branch: "A" }, End: true },
      RouteB: { Type: "Pass", Result: { branch: "B" }, End: true },
      RouteDefault: { Type: "Pass", Result: { branch: "default" }, End: true },
    },
  });
  const created = await client.send(
    new CreateStateMachineCommand({ name: "asl-choice", definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const startedA = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "asl-choice-exec-a",
      input: JSON.stringify({ route: "A" }),
    }),
  );
  const describedA = await client.send(
    new DescribeExecutionCommand({ executionArn: startedA.executionArn ?? "" }),
  );
  expect(describedA.status).toBe("SUCCEEDED");
  expect(JSON.parse(describedA.output ?? "{}").branch).toBe("A");

  const startedB = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "asl-choice-exec-b",
      input: JSON.stringify({ route: "B" }),
    }),
  );
  const describedB = await client.send(
    new DescribeExecutionCommand({ executionArn: startedB.executionArn ?? "" }),
  );
  expect(describedB.status).toBe("SUCCEEDED");
  expect(JSON.parse(describedB.output ?? "{}").branch).toBe("B");
});

test("ASL: Fail state produces FAILED status with error/cause", async () => {
  const client = sfn();
  const definition = JSON.stringify({
    StartAt: "FailState",
    States: {
      FailState: {
        Type: "Fail",
        Error: "CustomError",
        Cause: "Test failure cause",
      },
    },
  });
  const created = await client.send(
    new CreateStateMachineCommand({ name: "asl-fail", definition, roleArn }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "asl-fail-exec",
      input: "{}",
    }),
  );
  const described = await client.send(
    new DescribeExecutionCommand({ executionArn: started.executionArn ?? "" }),
  );
  expect(described.status).toBe("FAILED");
});

test("ASL: StopExecution rejected on terminated execution", async () => {
  const client = sfn();
  const definition = JSON.stringify({
    StartAt: "Pass",
    States: { Pass: { Type: "Pass", End: true } },
  });
  const created = await client.send(
    new CreateStateMachineCommand({
      name: "asl-stop-terminated",
      definition,
      roleArn,
    }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "asl-stop-exec",
    }),
  );
  const executionArn = started.executionArn ?? "";

  const described = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(described.status).toBe("SUCCEEDED");

  await expect(
    client.send(new StopExecutionCommand({ executionArn })),
  ).rejects.toThrow();
});

test("ASL: StartSyncExecution returns interpreted output", async () => {
  const clientSync = sfnSync();
  const clientStd = sfn();
  const definition = JSON.stringify({
    StartAt: "Transform",
    States: {
      Transform: { Type: "Pass", Result: { synced: true }, End: true },
    },
  });
  const created = await clientStd.send(
    new CreateStateMachineCommand({
      name: "asl-sync-transform",
      definition,
      roleArn,
      type: "EXPRESS",
    }),
  );
  const machineArn = created.stateMachineArn ?? "";

  const result = await clientSync.send(
    new StartSyncExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ original: true }),
    }),
  );
  expect(result.status).toBe("SUCCEEDED");
  const output = JSON.parse(result.output ?? "{}");
  expect(output.synced).toBe(true);
  expect(output.original).toBeUndefined();
});
