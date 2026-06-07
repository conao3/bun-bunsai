import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateActivityCommand,
  CreateStateMachineCommand,
  DescribeExecutionCommand,
  GetActivityTaskCommand,
  SFNClient,
  SendTaskFailureCommand,
  SendTaskHeartbeatCommand,
  SendTaskSuccessCommand,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const account = "000000000000";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

const roleArn = `arn:aws:iam::${account}:role/bunsai-e2e`;

test("waitForTaskToken via Activity ARN: success path", async () => {
  const client = sfn();

  const activity = await client.send(
    new CreateActivityCommand({ name: "bunsai-activity-success" }),
  );
  const activityArn = activity.activityArn ?? "";
  expect(activityArn).toContain("activity:bunsai-activity-success");

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-wtt-success-machine",
          definition: JSON.stringify({
            StartAt: "WaitForWorker",
            States: {
              WaitForWorker: {
                Type: "Task",
                Resource: activityArn,
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const execInput = JSON.stringify({ payload: "hello" });
  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: execInput,
    }),
  );
  const executionArn = started.executionArn ?? "";
  expect(executionArn).toContain("execution:");

  const running = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(running.status).toBe("RUNNING");

  const polled = await client.send(new GetActivityTaskCommand({ activityArn }));
  expect(polled.taskToken).toBeTruthy();
  expect(polled.input).toBe(execInput);
  const taskToken = polled.taskToken ?? "";

  await client.send(new SendTaskHeartbeatCommand({ taskToken }));

  const successOutput = JSON.stringify({ result: "done" });
  await client.send(
    new SendTaskSuccessCommand({ taskToken, output: successOutput }),
  );

  const completed = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(completed.status).toBe("SUCCEEDED");
  expect(completed.output).toBe(successOutput);
  expect(completed.stopDate).toBeInstanceOf(Date);
});

test("waitForTaskToken via Activity ARN: failure path", async () => {
  const client = sfn();

  const activity = await client.send(
    new CreateActivityCommand({ name: "bunsai-activity-failure" }),
  );
  const activityArn = activity.activityArn ?? "";

  const machineArn =
    (
      await client.send(
        new CreateStateMachineCommand({
          name: "bunsai-wtt-failure-machine",
          definition: JSON.stringify({
            StartAt: "WaitForWorker",
            States: {
              WaitForWorker: {
                Type: "Task",
                Resource: activityArn,
                End: true,
              },
            },
          }),
          roleArn,
        }),
      )
    ).stateMachineArn ?? "";

  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: "{}",
    }),
  );
  const executionArn = started.executionArn ?? "";

  const polled = await client.send(new GetActivityTaskCommand({ activityArn }));
  const taskToken = polled.taskToken ?? "";

  await client.send(
    new SendTaskFailureCommand({
      taskToken,
      error: "WorkerError",
      cause: "worker encountered an error",
    }),
  );

  const completed = await client.send(
    new DescribeExecutionCommand({ executionArn }),
  );
  expect(completed.status).toBe("FAILED");
  expect(completed.error).toBe("WorkerError");
  expect(completed.cause).toBe("worker encountered an error");
});

test("GetActivityTask returns empty when no pending task", async () => {
  const client = sfn();

  const activity = await client.send(
    new CreateActivityCommand({ name: "bunsai-activity-empty" }),
  );
  const activityArn = activity.activityArn ?? "";

  const polled = await client.send(new GetActivityTaskCommand({ activityArn }));
  expect(polled.taskToken).toBeUndefined();
  expect(polled.input).toBeUndefined();
});

test("SendTaskSuccess with unknown token throws TaskDoesNotExist", async () => {
  const client = sfn();
  await expect(
    client.send(
      new SendTaskSuccessCommand({
        taskToken: "invalid-token-that-does-not-exist",
        output: "{}",
      }),
    ),
  ).rejects.toThrow();
});

test("SendTaskHeartbeat with unknown token throws TaskDoesNotExist", async () => {
  const client = sfn();
  await expect(
    client.send(
      new SendTaskHeartbeatCommand({
        taskToken: "invalid-token-that-does-not-exist",
      }),
    ),
  ).rejects.toThrow();
});
