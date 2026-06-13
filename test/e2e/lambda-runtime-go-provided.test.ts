import { beforeAll, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import { makeZip } from "./event-helpers.ts";
import {
  CreateFunctionCommand,
  InvokeCommand,
  LambdaClient,
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
  const adapter = findAdapter("provided.al2023");
  if (adapter === undefined) return;
  const probe = await probeAdapter(adapter);
  probeOk = probe.ok;
});

const bootstrapScript = `#!/usr/bin/env bash
set -eu
API="http://$AWS_LAMBDA_RUNTIME_API"
HEADERS_FILE="$(mktemp)"
EVENT="$(curl -sS -D "$HEADERS_FILE" "$API/2018-06-01/runtime/invocation/next")"
REQUEST_ID=$(grep -i '^Lambda-Runtime-Aws-Request-Id:' "$HEADERS_FILE" | awk '{print $2}' | tr -d '\\r')
curl -sS -X POST -d '{"statusCode":200,"ok":true}' "$API/2018-06-01/runtime/invocation/$REQUEST_ID/response" >/dev/null
`;

test("Go (provided.al) handler invokes end-to-end (skipped if host runtime missing)", async () => {
  if (!probeOk) return;
  const zip = makeZip({ bootstrap: bootstrapScript });
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: "go-provided-fn",
      Runtime: "provided.al2023",
      Role: "arn:aws:iam::000000000000:role/r",
      Handler: "bootstrap",
      Code: { ZipFile: zip },
    }),
  );

  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: "go-provided-fn",
      Payload: new TextEncoder().encode(JSON.stringify({ hello: "world" })),
    }),
  );

  const payloadText = new TextDecoder().decode(result.Payload);
  const payload = JSON.parse(payloadText) as {
    statusCode: number;
    ok: boolean;
  };
  expect(payload.statusCode).toBe(200);
  expect(payload.ok).toBe(true);
});
