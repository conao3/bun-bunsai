import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  InvokeCommand,
  LambdaClient,
  ListFunctionsCommand,
  UpdateFunctionCodeCommand,
} from "@aws-sdk/client-lambda";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const lambda = () =>
  new LambdaClient({ endpoint, region, credentials, requestHandler });

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
