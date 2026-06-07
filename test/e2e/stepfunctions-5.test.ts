import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateStateMachineCommand,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const definition = JSON.stringify({
  StartAt: "PassStep",
  States: {
    PassStep: { Type: "Pass", Next: "ChoiceStep" },
    ChoiceStep: {
      Type: "Choice",
      Choices: [{ Variable: "$.ok", BooleanEquals: true, Next: "SucceedStep" }],
      Default: "FailStep",
    },
    SucceedStep: { Type: "Succeed" },
    FailStep: { Type: "Fail", Error: "TestError", Cause: "TestCause" },
  },
});

test("GetExecutionHistory returns real per-state events for succeeded execution", async () => {
  const client = sfn();
  const machineArn = (
    await client.send(
      new CreateStateMachineCommand({
        name: "bunsai-history-succeed",
        definition,
        roleArn: "arn:aws:iam::000000000000:role/bunsai-e2e-role",
      }),
    )
  ).stateMachineArn!;

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ ok: true }),
    }),
  );

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );

  expect(events).toBeDefined();
  expect(events!.length).toBe(7);

  const types = events!.map((e) => e.type);
  expect(types).toEqual([
    "ExecutionStarted",
    "PassStateEntered",
    "PassStateExited",
    "ChoiceStateEntered",
    "ChoiceStateExited",
    "SucceedStateEntered",
    "ExecutionSucceeded",
  ]);

  expect(events![0].id).toBe(1);
  expect(events![0].previousEventId).toBe(0);
  expect(events![0].executionStartedEventDetails?.input).toBe(
    JSON.stringify({ ok: true }),
  );

  expect(events![1].stateEnteredEventDetails?.name).toBe("PassStep");
  expect(events![2].stateExitedEventDetails?.name).toBe("PassStep");
  expect(events![3].stateEnteredEventDetails?.name).toBe("ChoiceStep");
  expect(events![4].stateExitedEventDetails?.name).toBe("ChoiceStep");
  expect(events![5].stateEnteredEventDetails?.name).toBe("SucceedStep");

  expect(events![6].executionSucceededEventDetails?.output).toBeDefined();

  for (let i = 0; i < events!.length; i++) {
    expect(events![i].id).toBe(i + 1);
    expect(events![i].previousEventId).toBe(i);
  }
});

test("GetExecutionHistory returns ExecutionFailed at end for failed execution", async () => {
  const client = sfn();
  const machineArn = (
    await client.send(
      new CreateStateMachineCommand({
        name: "bunsai-history-fail",
        definition,
        roleArn: "arn:aws:iam::000000000000:role/bunsai-e2e-role",
      }),
    )
  ).stateMachineArn!;

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ ok: false }),
    }),
  );

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );

  expect(events).toBeDefined();
  const types = events!.map((e) => e.type);
  expect(types[types.length - 1]).toBe("ExecutionFailed");
  expect(types).toContain("FailStateEntered");
  expect(events![events!.length - 1].executionFailedEventDetails?.error).toBe(
    "TestError",
  );
});

test("GetExecutionHistory respects reverseOrder", async () => {
  const client = sfn();
  const machineArn = (
    await client.send(
      new CreateStateMachineCommand({
        name: "bunsai-history-reverse",
        definition,
        roleArn: "arn:aws:iam::000000000000:role/bunsai-e2e-role",
      }),
    )
  ).stateMachineArn!;

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ ok: true }),
    }),
  );

  const { events: forward } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  const { events: reversed } = await client.send(
    new GetExecutionHistoryCommand({ executionArn, reverseOrder: true }),
  );

  expect(forward![0].type).toBe("ExecutionStarted");
  expect(reversed![0].type).toBe("ExecutionSucceeded");
  expect(reversed!.map((e) => e.type)).toEqual(
    [...forward!.map((e) => e.type)].reverse(),
  );
});
