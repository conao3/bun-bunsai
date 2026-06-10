import { beforeAll, describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
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

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const sfn = () =>
  new SFNClient({ endpoint, region, credentials, requestHandler });

describe("Step Functions orchestration: Choice + Lambda Task + Retry/Catch", () => {
  let machineArn: string;
  let branchAArn: string;
  let branchBArn: string;

  beforeAll(async () => {
    const lc = lambda();
    const sc = sfn();

    const echoRes = await lc.send(
      new CreateFunctionCommand({
        FunctionName: "orch-echo",
        Runtime: "nodejs20.x",
        Role: `arn:aws:iam::${account}:role/bunsai-e2e`,
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js":
              "exports.handler = async (event) => ({ echo: true, received: event });",
          }),
        },
      }),
    );
    const echoFnArn = echoRes.FunctionArn ?? "";

    const failRes = await lc.send(
      new CreateFunctionCommand({
        FunctionName: "orch-fail",
        Runtime: "nodejs20.x",
        Role: `arn:aws:iam::${account}:role/bunsai-e2e`,
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.js":
              "exports.handler = async () => { throw new Error('intentional failure'); };",
          }),
        },
      }),
    );
    const failFnArn = failRes.FunctionArn ?? "";

    const definition = {
      StartAt: "Prepare",
      States: {
        Prepare: {
          Type: "Pass",
          Next: "Route",
        },
        Route: {
          Type: "Choice",
          Choices: [
            { Variable: "$.branch", StringEquals: "A", Next: "EchoTask" },
          ],
          Default: "FailTask",
        },
        EchoTask: {
          Type: "Task",
          Resource: echoFnArn,
          End: true,
        },
        FailTask: {
          Type: "Task",
          Resource: failFnArn,
          Retry: [{ ErrorEquals: ["States.ALL"], MaxAttempts: 1 }],
          Catch: [{ ErrorEquals: ["States.ALL"], Next: "Fallback" }],
          End: true,
        },
        Fallback: {
          Type: "Pass",
          Result: { caught: true },
          End: true,
        },
      },
    };

    const machineRes = await sc.send(
      new CreateStateMachineCommand({
        name: "orch-scenario-machine",
        definition: JSON.stringify(definition),
        roleArn: `arn:aws:iam::${account}:role/bunsai-e2e`,
      }),
    );
    machineArn = machineRes.stateMachineArn ?? "";

    const startA = await sc.send(
      new StartExecutionCommand({
        stateMachineArn: machineArn,
        input: JSON.stringify({ branch: "A", value: 10 }),
      }),
    );
    branchAArn = startA.executionArn ?? "";

    const startB = await sc.send(
      new StartExecutionCommand({
        stateMachineArn: machineArn,
        input: JSON.stringify({ branch: "B", value: 1 }),
      }),
    );
    branchBArn = startB.executionArn ?? "";
  });

  test("branch A (echo path): SUCCEEDED with lambda output", async () => {
    const sc = sfn();
    const desc = await sc.send(
      new DescribeExecutionCommand({ executionArn: branchAArn }),
    );
    expect(desc.status).toBe("SUCCEEDED");
    const output = JSON.parse(desc.output ?? "{}") as Record<string, unknown>;
    expect(output.echo).toBe(true);
    expect(output.received).toMatchObject({ branch: "A", value: 10 });
  });

  test("branch B (fail + Retry/Catch): SUCCEEDED via fallback", async () => {
    const sc = sfn();
    const desc = await sc.send(
      new DescribeExecutionCommand({ executionArn: branchBArn }),
    );
    expect(desc.status).toBe("SUCCEEDED");
    const output = JSON.parse(desc.output ?? "{}");
    expect(output).toEqual({ caught: true });
  });

  test("GetExecutionHistory: branch A has enter/exit event sequence", async () => {
    const sc = sfn();
    const { events } = await sc.send(
      new GetExecutionHistoryCommand({ executionArn: branchAArn }),
    );
    expect(events).toBeDefined();
    const types = events!.map((e) => e.type);
    expect(types[0]).toBe("ExecutionStarted");
    expect(types).toContain("ChoiceStateEntered");
    expect(types).toContain("ChoiceStateExited");
    expect(types).toContain("TaskStateEntered");
    expect(types).toContain("TaskStateExited");
    expect(types[types.length - 1]).toBe("ExecutionSucceeded");
  });

  test("GetExecutionHistory: branch B has TaskFailed and Catch transition", async () => {
    const sc = sfn();
    const { events } = await sc.send(
      new GetExecutionHistoryCommand({ executionArn: branchBArn }),
    );
    expect(events).toBeDefined();
    const types = events!.map((e) => e.type);
    expect(types).toContain("TaskFailed");
    expect(types).toContain("TaskStateExited");
    expect(types[types.length - 1]).toBe("ExecutionSucceeded");
    const failEvent = events!.find((e) => e.type === "TaskFailed");
    expect(failEvent?.taskFailedEventDetails?.error).toBe(
      "Lambda.AWSLambdaException",
    );
  });
});
