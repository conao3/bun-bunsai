import { afterAll, beforeAll, expect, test } from "bun:test";
import { spawn } from "bun";
import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  InvokeCommand,
  LambdaClient,
  ListFunctionsCommand,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";

const awsPort = 4566;
const uiPort = 5666;
const endpoint = `http://localhost:${awsPort}`;
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const serverEntry = new URL("../../apps/server/src/index.ts", import.meta.url)
  .pathname;

let proc: ReturnType<typeof spawn> | undefined;

const waitForServer = async (): Promise<void> => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`http://localhost:${uiPort}/__bunsai/logs`);
      if (res.ok) {
        await res.body?.cancel();
        return;
      }
    } catch {
      void 0;
    }
    await Bun.sleep(100);
  }
  throw new Error("server did not become ready");
};

beforeAll(async () => {
  proc = spawn({
    cmd: ["bun", serverEntry],
    env: {
      ...process.env,
      BUNSAI_PORT: String(awsPort),
      BUNSAI_UI_PORT: String(uiPort),
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  await waitForServer();
});

afterAll(() => {
  proc?.kill();
});

const lambda = () => new LambdaClient({ endpoint, region, credentials });

test("Lambda function lifecycle and invoke echo", async () => {
  const client = lambda();
  const name = "bunsai-e2e-fn";
  const zip = new TextEncoder().encode("PK fake zip");

  const created = await client.send(
    new CreateFunctionCommand({
      FunctionName: name,
      Runtime: "nodejs20.x",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "index.handler",
      Code: { ZipFile: zip },
    }),
  );
  expect(created.FunctionName).toBe(name);
  expect(created.FunctionArn).toContain(`:function:${name}`);
  expect(created.Runtime).toBe("nodejs20.x");

  const got = await client.send(new GetFunctionCommand({ FunctionName: name }));
  expect(got.Configuration?.FunctionName).toBe(name);
  expect(got.Configuration?.FunctionArn).toBe(created.FunctionArn);
  expect(got.Code?.Location).toBeDefined();

  const listed = await client.send(new ListFunctionsCommand({}));
  const names = (listed.Functions ?? []).map((fn) => fn.FunctionName);
  expect(names).toContain(name);

  const updated = await client.send(
    new UpdateFunctionCodeCommand({
      FunctionName: name,
      ZipFile: new TextEncoder().encode("PK updated zip body"),
    }),
  );
  expect(updated.FunctionArn).toBe(created.FunctionArn);
  expect(updated.RevisionId).not.toBe(created.RevisionId);

  const payload = { hello: "bunsai", n: 42 };
  const invoked = await client.send(
    new InvokeCommand({
      FunctionName: name,
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    }),
  );
  expect(invoked.StatusCode).toBe(200);
  const echoed = JSON.parse(new TextDecoder().decode(invoked.Payload));
  expect(echoed).toEqual(payload);

  const deleted = await client.send(
    new DeleteFunctionCommand({ FunctionName: name }),
  );
  expect(deleted.$metadata.httpStatusCode).toBe(200);

  await expect(
    client.send(new GetFunctionCommand({ FunctionName: name })),
  ).rejects.toThrow();
});
