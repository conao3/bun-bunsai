import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CreateFunctionCommand,
  InvokeCommand,
  LambdaClient,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

const createFn = async (
  client: LambdaClient,
  name: string,
  files: Record<string, string>,
  extra: Record<string, unknown> = {},
): Promise<void> => {
  await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: { ZipFile: makeZip(files) },
      ...extra,
    }),
  );
};

const invokeJson = async (
  client: LambdaClient,
  name: string,
  payload: unknown,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> => {
  const res = await client.send(
    new InvokeCommand({
      FunctionName: name,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
      ...extra,
    }),
  );
  return {
    StatusCode: res.StatusCode,
    FunctionError: res.FunctionError,
    LogResult: res.LogResult,
    payload: JSON.parse(new TextDecoder().decode(res.Payload)),
  };
};

describe("Lambda real Node.js execution", () => {
  test("returns the handler result", async () => {
    const client = lambda();
    await createFn(client, "fn-result", {
      "index.js":
        "exports.handler = async (event) => ({ sum: event.a + event.b });",
    });
    const r = await invokeJson(client, "fn-result", { a: 2, b: 3 });
    expect(r.StatusCode).toBe(200);
    expect(r.FunctionError).toBeUndefined();
    expect(r.payload).toEqual({ sum: 5 });
  });

  test("passes context and injects environment variables", async () => {
    const client = lambda();
    await createFn(
      client,
      "fn-context",
      {
        "index.js":
          "exports.handler = async (event, context) => ({ name: context.functionName, remaining: context.getRemainingTimeInMillis() > 0, stage: process.env.STAGE });",
      },
      { Environment: { Variables: { STAGE: "prod" } } },
    );
    const r = await invokeJson(client, "fn-context", {});
    expect(r.payload).toEqual({
      name: "fn-context",
      remaining: true,
      stage: "prod",
    });
  });

  test("resolves a required sibling module", async () => {
    const client = lambda();
    await createFn(client, "fn-require", {
      "index.js":
        "const { add } = require('./lib'); exports.handler = async (e) => ({ total: add(e.a, e.b) });",
      "lib.js": "exports.add = (a, b) => a + b;",
    });
    const r = await invokeJson(client, "fn-require", { a: 4, b: 5 });
    expect(r.payload).toEqual({ total: 9 });
  });

  test("reports handler exceptions as Unhandled function errors", async () => {
    const client = lambda();
    await createFn(client, "fn-throw", {
      "index.js": "exports.handler = async () => { throw new Error('boom'); };",
    });
    const r = await invokeJson(client, "fn-throw", {});
    expect(r.StatusCode).toBe(200);
    expect(r.FunctionError).toBe("Unhandled");
    expect((r.payload as Record<string, unknown>).errorMessage).toBe("boom");
    expect((r.payload as Record<string, unknown>).errorType).toBe("Error");
  });

  test("captures logs when LogType is Tail", async () => {
    const client = lambda();
    await createFn(client, "fn-logs", {
      "index.js":
        "exports.handler = async () => { console.log('hello-from-handler'); return { ok: true }; };",
    });
    const r = await invokeJson(client, "fn-logs", {}, { LogType: "Tail" });
    expect(r.payload).toEqual({ ok: true });
    const log = Buffer.from(r.LogResult as string, "base64").toString("utf8");
    expect(log).toContain("hello-from-handler");
  });

  test("times out a slow handler", async () => {
    const client = lambda();
    await createFn(
      client,
      "fn-timeout",
      {
        "index.js":
          "exports.handler = async () => { await new Promise((r) => setTimeout(r, 5000)); return {}; };",
      },
      { Timeout: 1 },
    );
    const r = await invokeJson(client, "fn-timeout", {});
    expect(r.FunctionError).toBe("Unhandled");
    expect((r.payload as Record<string, unknown>).errorType).toBe(
      "Sandbox.Timedout",
    );
  });

  test("DryRun validates without executing", async () => {
    const client = lambda();
    await createFn(client, "fn-dryrun", {
      "index.js": "exports.handler = async () => ({ ran: true });",
    });
    const res = await client.send(
      new InvokeCommand({
        FunctionName: "fn-dryrun",
        InvocationType: "DryRun",
      }),
    );
    expect(res.StatusCode).toBe(204);
  });
});

describe("Lambda unsupported runtime", () => {
  test("python3.x runtime returns Runtime.Unsupported error, not echoed input", async () => {
    const client = lambda();
    await client.send(
      new CreateFunctionCommand({
        FunctionName: "fn-python",
        Runtime: "python3.12",
        Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
        Handler: "index.handler",
        Code: {
          ZipFile: makeZip({
            "index.py": "def handler(event, context): return event",
          }),
        },
      }),
    );
    const sentPayload = { key: "should-not-be-echoed" };
    const r = await invokeJson(client, "fn-python", sentPayload);
    expect(r.StatusCode).toBe(200);
    expect(r.FunctionError).toBe("Unhandled");
    expect((r.payload as Record<string, unknown>).errorType).toBe(
      "Runtime.Unsupported",
    );
    expect(typeof (r.payload as Record<string, unknown>).errorMessage).toBe(
      "string",
    );
    expect(
      (r.payload as Record<string, unknown>).errorMessage as string,
    ).toContain("python3.12");
    expect(r.payload).not.toEqual(sentPayload);
  });

  test("nodejs runtime still executes normally after unsupported-runtime fix", async () => {
    const client = lambda();
    await createFn(client, "fn-node-after-fix", {
      "index.js": "exports.handler = async (e) => ({ result: e.x * 2 });",
    });
    const r = await invokeJson(client, "fn-node-after-fix", { x: 7 });
    expect(r.StatusCode).toBe(200);
    expect(r.FunctionError).toBeUndefined();
    expect(r.payload).toEqual({ result: 14 });
  });
});
