import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateActivityCommand,
  CreateStateMachineCommand,
  DescribeExecutionCommand,
  GetActivityTaskCommand,
  GetExecutionHistoryCommand,
  SFNClient,
  StartExecutionCommand,
  StopExecutionCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const roleArn = `arn:aws:iam::${account}:role/bunsai-e2e`;

test("execution lifecycle: StartExecution → DescribeExecution SUCCEEDED with output → GetExecutionHistory", async () => {
  const client = sfn();

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-lifecycle-succeed",
          definition: JSON.stringify({
            StartAt: "Echo",
            States: { Echo: { Type: "Pass", End: true } },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const input = JSON.stringify({ msg: "hello" });
  const { executionArn, startDate } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      name: "bunsai-lifecycle-exec",
      input,
    }),
  );
  expect(executionArn).toContain("execution:");
  expect(startDate).toBeInstanceOf(Date);

  const described = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(described.status).toBe("SUCCEEDED");
  expect(described.input).toBe(input);
  expect(described.output).toBe(input);

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  expect(events).toBeDefined();
  const types = events!.map((e) => e.type);
  expect(types[0]).toBe("ExecutionStarted");
  expect(types[types.length - 1]).toBe("ExecutionSucceeded");
  expect(events![0].executionStartedEventDetails?.input).toBe(input);
  expect(
    events![events!.length - 1].executionSucceededEventDetails?.output,
  ).toBe(input);
});

test("execution lifecycle: StopExecution → ABORTED with ExecutionAborted event", async () => {
  const client = sfn();

  const activityArn =
    (
      await client.send(
        new CreateActivityCommand({ name: "bunsai-lifecycle-activity" }),
      )
    ).activityArn ?? "";

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-lifecycle-aborted",
          definition: JSON.stringify({
            StartAt: "Wait",
            States: {
              Wait: { Type: "Task", Resource: activityArn, End: true },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const { executionArn } = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify({ msg: "stop-me" }),
    }),
  );

  const running = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(running.status).toBe("RUNNING");

  await client.send(new GetActivityTaskCommand({ activityArn }));

  const { stopDate } = await client.send(
    new StopExecutionCommand({
      executionArn,
      error: "TestAbort",
      cause: "e2e-test",
    }),
  );
  expect(stopDate).toBeInstanceOf(Date);

  const aborted = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(aborted.status).toBe("ABORTED");

  const { events } = await client.send(
    new GetExecutionHistoryCommand({ executionArn }),
  );
  const types = events!.map((e) => e.type);
  expect(types[0]).toBe("ExecutionStarted");
  expect(types[types.length - 1]).toBe("ExecutionAborted");
});

test("ExecutionDoesNotExist for missing execution ARN", async () => {
  const client = sfn();
  const fakeArn = `arn:aws:states:${region}:${account}:execution:nonexistent:nonexistent`;
  await expect(
    client.send(new DescribeExecutionCommand({ executionArn: fakeArn })),
  ).rejects.toThrow();
  await expect(
    client.send(new GetExecutionHistoryCommand({ executionArn: fakeArn })),
  ).rejects.toThrow();
});
