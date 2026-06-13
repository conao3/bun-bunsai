import { expect, test, beforeAll } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  LambdaClient,
  CreateFunctionCommand,
  InvokeCommand,
} from "@aws-sdk/client-lambda";
import {
  findAdapter,
  probeAdapter,
} from "../../apps/server/src/services/lambda/runtime/registry.ts";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const lambda = new LambdaClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

let probeOk = false;
beforeAll(async () => {
  const adapter = findAdapter("ruby3.3");
  if (adapter === undefined) return;
  const probe = await probeAdapter(adapter);
  probeOk = probe.ok;
});

const SAMPLE_HANDLER = `def handler(event:, context:)
  { statusCode: 200, body: "hello #{event["name"] || "world"}" }
end
`;

test("Ruby handler invokes end-to-end (skipped if host runtime missing)", async () => {
  if (!probeOk) return;
  const zip = makeZip({ "lambda_function.rb": SAMPLE_HANDLER });
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: "fn-ruby",
      Runtime: "ruby3.3",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "lambda_function.handler",
      Code: { ZipFile: zip },
    }),
  );
  const res = await lambda.send(
    new InvokeCommand({
      FunctionName: "fn-ruby",
      Payload: new TextEncoder().encode(JSON.stringify({ name: "bunsai" })),
    }),
  );
  expect(res.StatusCode).toBe(200);
  expect(res.FunctionError).toBeUndefined();
  const payload = JSON.parse(new TextDecoder().decode(res.Payload)) as Record<
    string,
    unknown
  >;
  expect(payload.statusCode).toBe(200);
  expect(payload.body).toBe("hello bunsai");
});
