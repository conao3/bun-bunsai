import { expect, test, beforeAll } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startApp } from "./harness.ts";
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

const SAMPLE_HANDLER = `def lambda_handler(event, context):
    return {"statusCode": 200, "body": "hello " + event.get("name", "world")}
`;

const buildZip = (): Uint8Array => {
  const dir = mkdtempSync(join(tmpdir(), "bunsai-py-zip-"));
  try {
    writeFileSync(join(dir, "lambda_function.py"), SAMPLE_HANDLER);
    const zipPath = join(dir, "fn.zip");
    const r = Bun.spawnSync(
      ["zip", "-q", "-r", zipPath, "lambda_function.py"],
      {
        cwd: dir,
      },
    );
    if (r.exitCode !== 0) {
      throw new Error("zip failed: " + new TextDecoder().decode(r.stderr));
    }
    return new Uint8Array(readFileSync(zipPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

let probeOk = false;
beforeAll(async () => {
  const adapter = findAdapter("python3.13");
  if (adapter === undefined) return;
  const probe = await probeAdapter(adapter);
  probeOk = probe.ok;
});

test("Python handler invokes end-to-end (skipped if host runtime missing)", async () => {
  if (!probeOk) return;
  const zip = buildZip();
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: "fn-python-e2e",
      Runtime: "python3.13",
      Role: "arn:aws:iam::000000000000:role/bunsai-e2e",
      Handler: "lambda_function.lambda_handler",
      Code: { ZipFile: zip },
    }),
  );
  const res = await lambda.send(
    new InvokeCommand({
      FunctionName: "fn-python-e2e",
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
