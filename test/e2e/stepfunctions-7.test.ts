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

test("Choice routing: NumericGreaterThan branches to high-value path", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-asl-choice-numeric",
          definition: JSON.stringify({
            StartAt: "Route",
            States: {
              Route: {
                Type: "Choice",
                Choices: [
                  {
                    Variable: "$.value",
                    NumericGreaterThan: 100,
                    Next: "HighValue",
                  },
                ],
                Default: "LowValue",
              },
              HighValue: {
                Type: "Pass",
                Result: { tier: "high" },
                End: true,
              },
              LowValue: {
                Type: "Pass",
                Result: { tier: "low" },
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn: highArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ value: 200 }),
    }),
  );
  const { executionArn: lowArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ value: 50 }),
    }),
  );

  const highDesc = await client.send(
    new DescribeExecutionCommand({ executionArn: highArn }),
  );
  expect(highDesc.status).toBe("SUCCEEDED");
  expect(JSON.parse(highDesc.output ?? "{}")).toEqual({ tier: "high" });

  const lowDesc = await client.send(
    new DescribeExecutionCommand({ executionArn: lowArn }),
  );
  expect(lowDesc.status).toBe("SUCCEEDED");
  expect(JSON.parse(lowDesc.output ?? "{}")).toEqual({ tier: "low" });
});

test("Choice routing: StringEquals branches to correct path", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-asl-choice-string",
          definition: JSON.stringify({
            StartAt: "Route",
            States: {
              Route: {
                Type: "Choice",
                Choices: [
                  { Variable: "$.env", StringEquals: "prod", Next: "ProdPath" },
                ],
                Default: "DevPath",
              },
              ProdPath: {
                Type: "Pass",
                Result: { path: "production" },
                End: true,
              },
              DevPath: {
                Type: "Pass",
                Result: { path: "development" },
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn: prodArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ env: "prod" }),
    }),
  );
  const { executionArn: devArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ env: "staging" }),
    }),
  );

  const prodDesc = await client.send(
    new DescribeExecutionCommand({ executionArn: prodArn }),
  );
  expect(prodDesc.status).toBe("SUCCEEDED");
  expect(JSON.parse(prodDesc.output ?? "{}")).toEqual({ path: "production" });

  const devDesc = await client.send(
    new DescribeExecutionCommand({ executionArn: devArn }),
  );
  expect(devDesc.status).toBe("SUCCEEDED");
  expect(JSON.parse(devDesc.output ?? "{}")).toEqual({ path: "development" });
});

test("Pass state: Result replaces input and ResultPath merges into input", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-asl-pass-transform",
          definition: JSON.stringify({
            StartAt: "SetResult",
            States: {
              SetResult: {
                Type: "Pass",
                Result: { computed: 42 },
                ResultPath: "$.extra",
                Next: "Done",
              },
              Done: { Type: "Succeed" },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const input = { name: "test" };
  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify(input),
    }),
  );

  const described = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(described.status).toBe("SUCCEEDED");
  expect(JSON.parse(described.output ?? "{}")).toEqual({
    name: "test",
    extra: { computed: 42 },
  });
});

test("Fail state: DescribeExecution shows FAILED with Error and Cause", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-asl-fail-state",
          definition: JSON.stringify({
            StartAt: "ErrorOut",
            States: {
              ErrorOut: {
                Type: "Fail",
                Error: "CustomError",
                Cause: "test-cause-detail",
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

  const described = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(described.status).toBe("FAILED");

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  expect(events).toBeDefined();
  const types = events!.map((e) => e.type);
  expect(types).toContain("FailStateEntered");
  expect(types[types.length - 1]).toBe("ExecutionFailed");
  const failEvent = events!.find((e) => e.type === "ExecutionFailed");
  expect(failEvent?.executionFailedEventDetails?.error).toBe("CustomError");
  expect(failEvent?.executionFailedEventDetails?.cause).toBe(
    "test-cause-detail",
  );
});

test("Wait state: advances deterministically without blocking", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-asl-wait-state",
          definition: JSON.stringify({
            StartAt: "Pause",
            States: {
              Pause: { Type: "Wait", Seconds: 10, Next: "Done" },
              Done: { Type: "Succeed" },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const input = { msg: "wait-test" };
  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify(input),
    }),
  );

  const described = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(described.status).toBe("SUCCEEDED");
  expect(JSON.parse(described.output ?? "{}")).toEqual(input);

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  const types = events!.map((e) => e.type);
  expect(types).toContain("WaitStateEntered");
  expect(types).toContain("WaitStateExited");
});
