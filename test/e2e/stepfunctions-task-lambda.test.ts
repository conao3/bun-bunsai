import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import { CreateFunctionCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  CreateStateMachineCommand,
  DescribeExecutionCommand,
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

const createFn = async (
  client: LambdaClient,
  name: string,
  files: Record<string, string>,
): Promise<string> => {
  const res = await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: `arn:aws:iam::${account}:role/bunsai-e2e`,
      Handler: "index.handler",
      Code: { ZipFile: makeZip(files) },
    }),
  );
  return res.FunctionArn ?? "";
};

const createMachine = async (
  client: SFNClient,
  name: string,
  definition: unknown,
): Promise<string> => {
  const res = await client.send(
    new CreateStateMachineCommand({
      name,
      definition: JSON.stringify(definition),
      roleArn: `arn:aws:iam::${account}:role/bunsai-e2e`,
    }),
  );
  return res.stateMachineArn ?? "";
};

const startAndDescribe = async (
  client: SFNClient,
  machineArn: string,
  input: unknown,
): Promise<{
  status: string;
  output: unknown;
  error?: string;
  cause?: string;
}> => {
  const started = await client.send(
    new StartExecutionCommand({
      stateMachineArn: machineArn,
      input: JSON.stringify(input),
    }),
  );
  const described = await client.send(
    new DescribeExecutionCommand({ executionArn: started.executionArn }),
  );
  return {
    status: described.status ?? "",
    output:
      described.output !== undefined ? JSON.parse(described.output) : undefined,
    error: described.error,
    cause: described.cause,
  };
};

describe("Step Functions Task state — Lambda invocation", () => {
  test("direct Lambda ARN: invokes function and returns result", async () => {
    const lc = lambda();
    const fnArn = await createFn(lc, "sfn-task-direct", {
      "index.js":
        "exports.handler = async (event) => ({ doubled: event.value * 2 });",
    });

    const sc = sfn();
    const machineArn = await createMachine(sc, "sfn-task-direct-machine", {
      StartAt: "Invoke",
      States: {
        Invoke: {
          Type: "Task",
          Resource: fnArn,
          End: true,
        },
      },
    });

    const result = await startAndDescribe(sc, machineArn, { value: 7 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.output).toEqual({ doubled: 14 });
  });

  test("direct Lambda ARN: applies ResultPath to merge result into input", async () => {
    const lc = lambda();
    await createFn(lc, "sfn-task-resultpath", {
      "index.js":
        "exports.handler = async (event) => ({ sum: event.a + event.b });",
    });
    const fnArn = `arn:aws:lambda:${region}:${account}:function:sfn-task-resultpath`;

    const sc = sfn();
    const machineArn = await createMachine(sc, "sfn-task-resultpath-machine", {
      StartAt: "Invoke",
      States: {
        Invoke: {
          Type: "Task",
          Resource: fnArn,
          ResultPath: "$.result",
          End: true,
        },
      },
    });

    const result = await startAndDescribe(sc, machineArn, { a: 3, b: 4 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.output).toEqual({ a: 3, b: 4, result: { sum: 7 } });
  });

  test("direct Lambda ARN: missing function → FAILED with ResourceNotFoundException", async () => {
    const sc = sfn();
    const fnArn = `arn:aws:lambda:${region}:${account}:function:sfn-no-such-fn`;
    const machineArn = await createMachine(sc, "sfn-task-missing-machine", {
      StartAt: "Invoke",
      States: {
        Invoke: {
          Type: "Task",
          Resource: fnArn,
          End: true,
        },
      },
    });

    const result = await startAndDescribe(sc, machineArn, {});
    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("Lambda.ResourceNotFoundException");
    expect(result.cause).toContain("sfn-no-such-fn");
  });

  test("optimistic integration: invokes via FunctionName in Parameters", async () => {
    const lc = lambda();
    await createFn(lc, "sfn-task-optimistic", {
      "index.js":
        "exports.handler = async (event) => ({ result: event.x + 1 });",
    });

    const sc = sfn();
    const machineArn = await createMachine(sc, "sfn-task-optimistic-machine", {
      StartAt: "Invoke",
      States: {
        Invoke: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: `arn:aws:lambda:${region}:${account}:function:sfn-task-optimistic`,
            "Payload.$": "$",
          },
          End: true,
        },
      },
    });

    const result = await startAndDescribe(sc, machineArn, { x: 5 });
    expect(result.status).toBe("SUCCEEDED");
    const output = result.output as Record<string, unknown>;
    expect(output.StatusCode).toBe(200);
    expect(output.Payload).toEqual({ result: 6 });
  });

  test("optimistic integration: ResultSelector extracts Payload", async () => {
    const lc = lambda();
    await createFn(lc, "sfn-task-selector", {
      "index.js":
        "exports.handler = async (event) => ({ ok: true, n: event.n });",
    });

    const sc = sfn();
    const machineArn = await createMachine(sc, "sfn-task-selector-machine", {
      StartAt: "Invoke",
      States: {
        Invoke: {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: `arn:aws:lambda:${region}:${account}:function:sfn-task-selector`,
            "Payload.$": "$",
          },
          ResultSelector: {
            "body.$": "$.Payload",
          },
          End: true,
        },
      },
    });

    const result = await startAndDescribe(sc, machineArn, { n: 42 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.output).toEqual({ body: { ok: true, n: 42 } });
  });

  test("Task state chained with Pass state", async () => {
    const lc = lambda();
    await createFn(lc, "sfn-task-chain", {
      "index.js":
        "exports.handler = async (event) => ({ computed: event.val * 3 });",
    });
    const fnArn = `arn:aws:lambda:${region}:${account}:function:sfn-task-chain`;

    const sc = sfn();
    const machineArn = await createMachine(sc, "sfn-task-chain-machine", {
      StartAt: "Invoke",
      States: {
        Invoke: {
          Type: "Task",
          Resource: fnArn,
          ResultPath: "$.taskOut",
          Next: "Finish",
        },
        Finish: {
          Type: "Pass",
          End: true,
        },
      },
    });

    const result = await startAndDescribe(sc, machineArn, { val: 4 });
    expect(result.status).toBe("SUCCEEDED");
    expect(result.output).toEqual({ val: 4, taskOut: { computed: 12 } });
  });
});
