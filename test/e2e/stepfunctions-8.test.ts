import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStateMachineCommand,
  DescribeExecutionCommand,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const roleArn = `arn:aws:iam::${account}:role/bunsai-e2e`;

test("Map state: iterates [1,2,3] and produces 3-element transformed output", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-map-basic",
          definition: JSON.stringify({
            StartAt: "Transform",
            States: {
              Transform: {
                Type: "Map",
                ItemsPath: "$.items",
                Iterator: {
                  StartAt: "Double",
                  States: {
                    Double: {
                      Type: "Pass",
                      Parameters: { "value.$": "$" },
                      End: true,
                    },
                  },
                },
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ items: [1, 2, 3] }),
    }),
  );

  const desc = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(desc.status).toBe("SUCCEEDED");
  const output = JSON.parse(desc.output ?? "[]");
  expect(Array.isArray(output)).toBe(true);
  expect(output).toHaveLength(3);
  expect(output[0]).toEqual({ value: 1 });
  expect(output[1]).toEqual({ value: 2 });
  expect(output[2]).toEqual({ value: 3 });

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  const types = events!.map((e) => e.type);
  expect(types).toContain("MapStateEntered");
  expect(types).toContain("MapIterationStarted");
  expect(types).toContain("MapIterationSucceeded");
  expect(types).toContain("MapStateExited");
  expect(types[types.length - 1]).toBe("ExecutionSucceeded");
});

test("Map state: ItemProcessor is accepted as alias for Iterator", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-map-item-processor",
          definition: JSON.stringify({
            StartAt: "Process",
            States: {
              Process: {
                Type: "Map",
                ItemsPath: "$",
                ItemProcessor: {
                  StartAt: "Wrap",
                  States: {
                    Wrap: {
                      Type: "Pass",
                      Parameters: { "n.$": "$" },
                      End: true,
                    },
                  },
                },
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify([10, 20]),
    }),
  );

  const desc = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(desc.status).toBe("SUCCEEDED");
  const output = JSON.parse(desc.output ?? "[]");
  expect(output).toHaveLength(2);
  expect(output[0]).toEqual({ n: 10 });
  expect(output[1]).toEqual({ n: 20 });
});

test("Parallel state: 2 branches produce 2-element array", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-parallel-basic",
          definition: JSON.stringify({
            StartAt: "Fork",
            States: {
              Fork: {
                Type: "Parallel",
                Branches: [
                  {
                    StartAt: "BranchA",
                    States: {
                      BranchA: {
                        Type: "Pass",
                        Result: { branch: "a" },
                        End: true,
                      },
                    },
                  },
                  {
                    StartAt: "BranchB",
                    States: {
                      BranchB: {
                        Type: "Pass",
                        Result: { branch: "b" },
                        End: true,
                      },
                    },
                  },
                ],
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({}),
    }),
  );

  const desc = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(desc.status).toBe("SUCCEEDED");
  const output = JSON.parse(desc.output ?? "[]");
  expect(Array.isArray(output)).toBe(true);
  expect(output).toHaveLength(2);
  expect(output[0]).toEqual({ branch: "a" });
  expect(output[1]).toEqual({ branch: "b" });

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  const types = events!.map((e) => e.type);
  expect(types).toContain("ParallelStateEntered");
  expect(types).toContain("ParallelStateExited");
  expect(types[types.length - 1]).toBe("ExecutionSucceeded");
});

test("Catch on Task: caught error routes to handler and execution SUCCEEDS", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-catch-task",
          definition: JSON.stringify({
            StartAt: "TryTask",
            States: {
              TryTask: {
                Type: "Task",
                Resource:
                  "arn:aws:lambda:us-east-1:000000000000:function:nonexistent",
                Catch: [
                  {
                    ErrorEquals: ["States.ALL"],
                    Next: "HandleError",
                    ResultPath: "$.error",
                  },
                ],
                End: true,
              },
              HandleError: {
                Type: "Pass",
                Result: { handled: true },
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ input: "data" }),
    }),
  );

  const desc = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(desc.status).toBe("SUCCEEDED");
  expect(JSON.parse(desc.output ?? "{}")).toEqual({ handled: true });
});

test("Retry on Task: retries before Catch is applied", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-retry-catch-task",
          definition: JSON.stringify({
            StartAt: "Flaky",
            States: {
              Flaky: {
                Type: "Task",
                Resource:
                  "arn:aws:lambda:us-east-1:000000000000:function:nonexistent",
                Retry: [
                  {
                    ErrorEquals: ["States.ALL"],
                    MaxAttempts: 2,
                  },
                ],
                Catch: [
                  {
                    ErrorEquals: ["States.ALL"],
                    Next: "Recovered",
                  },
                ],
                End: true,
              },
              Recovered: {
                Type: "Pass",
                Result: { recovered: true },
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({}),
    }),
  );

  const desc = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(desc.status).toBe("SUCCEEDED");
  expect(JSON.parse(desc.output ?? "{}")).toEqual({ recovered: true });
});
