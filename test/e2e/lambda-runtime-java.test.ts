import { expect, test, beforeAll } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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

let probeOk = false;
let zipBytes: Uint8Array | undefined;

const HANDLER_SOURCE = `package example;
import java.util.LinkedHashMap;
import java.util.Map;
public class Handler {
  public Object handleRequest(Object event, Object context) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("statusCode", 200);
    out.put("ok", true);
    return out;
  }
}
`;

beforeAll(async () => {
  const adapter = findAdapter("java21");
  if (adapter === undefined) return;
  const probe = await probeAdapter(adapter);
  probeOk = probe.ok;
  if (!probeOk) return;
  const dir = mkdtempSync(join(tmpdir(), "bunsai-java-build-"));
  const srcDir = join(dir, "src/example");
  Bun.spawnSync(["mkdir", "-p", srcDir]);
  writeFileSync(join(srcDir, "Handler.java"), HANDLER_SOURCE);
  const stage = join(dir, "stage");
  Bun.spawnSync(["mkdir", "-p", stage]);
  const javac = Bun.spawnSync([
    "javac",
    "-d",
    stage,
    join(srcDir, "Handler.java"),
  ]);
  if (javac.exitCode !== 0) {
    probeOk = false;
    return;
  }
  if (!existsSync(join(stage, "example/Handler.class"))) {
    probeOk = false;
    return;
  }
  const zipResult = Bun.spawnSync(["zip", "-q", "-r", "../fn.zip", "."], {
    cwd: stage,
  });
  if (zipResult.exitCode !== 0) {
    probeOk = false;
    return;
  }
  zipBytes = new Uint8Array(readFileSync(join(dir, "fn.zip")));
});

test("Java handler invokes end-to-end (skipped if host runtime missing)", async () => {
  if (!probeOk || zipBytes === undefined) return;
  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: "java-fn",
      Runtime: "java21",
      Role: "arn:aws:iam::000000000000:role/r",
      Handler: "example.Handler::handleRequest",
      Code: { ZipFile: zipBytes },
    }),
  );

  const inv = await lambda.send(
    new InvokeCommand({
      FunctionName: "java-fn",
      Payload: new TextEncoder().encode(JSON.stringify({})),
    }),
  );
  const payloadText = new TextDecoder().decode(inv.Payload);
  const payload = JSON.parse(payloadText);
  expect(payload.statusCode).toBe(200);
  expect(payload.ok).toBe(true);
});
