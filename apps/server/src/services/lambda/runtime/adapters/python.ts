import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "../types.ts";

const HARNESS = `import json
import os
import sys
import traceback
import importlib

deadline = int(os.environ["__BUNSAI_DEADLINE"])
raw_ctx = json.loads(os.environ["__BUNSAI_CONTEXT"])

def _now_ms():
    import time
    return int(time.time() * 1000)

class _Context:
    def __init__(self, data):
        self.function_name = data.get("functionName", "")
        self.function_version = data.get("functionVersion", "$LATEST")
        self.invoked_function_arn = data.get("invokedFunctionArn", "")
        self.memory_limit_in_mb = data.get("memoryLimitInMB", "128")
        self.aws_request_id = data.get("awsRequestId", "")
        self.log_group_name = data.get("logGroupName", "")
        self.log_stream_name = data.get("logStreamName", "")
        self.identity = None
        self.client_context = None
    def get_remaining_time_in_millis(self):
        return max(0, deadline - _now_ms())

def _write(obj):
    with open(os.environ["__BUNSAI_RESULT"], "w") as fh:
        json.dump(obj, fh)

try:
    with open(os.environ["__BUNSAI_EVENT"], "r") as fh:
        event = json.load(fh)
    handler_spec = os.environ["__BUNSAI_HANDLER"]
    module_name, _, fn_name = handler_spec.rpartition(".")
    if module_name == "" or fn_name == "":
        _write({"ok": False, "errorType": "Runtime.MalformedHandlerName", "errorMessage": "Bad handler: " + handler_spec, "trace": []})
        sys.exit(0)
    sys.path.insert(0, os.environ["__BUNSAI_DIR"])
    mod = importlib.import_module(module_name)
    fn = getattr(mod, fn_name, None)
    if not callable(fn):
        _write({"ok": False, "errorType": "Runtime.HandlerNotFound", "errorMessage": fn_name + " is not callable", "trace": []})
        sys.exit(0)
    result = fn(event, _Context(raw_ctx))
    _write({"ok": True, "result": result})
except Exception as err:
    _write({
        "ok": False,
        "errorType": type(err).__name__,
        "errorMessage": str(err),
        "trace": traceback.format_exc().split("\\n"),
    })
`;

const resolveHandlerFile = (
  files: Record<string, Uint8Array>,
  handler: string,
): { module: string; name: string } | undefined => {
  const lastDot = handler.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  const moduleName = handler.slice(0, lastDot);
  const name = handler.slice(lastDot + 1);
  const candidate = moduleName.replace(/\./g, "/") + ".py";
  if (files[candidate] === undefined) return undefined;
  return { module: moduleName, name };
};

type ResultFile =
  | { ok: true; result: unknown }
  | { ok: false; errorType: string; errorMessage: string; trace: string[] };

const probeCandidate = async (
  cmd: string,
): Promise<ProbeResult | undefined> => {
  try {
    const proc = Bun.spawn([cmd, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    if (exitCode !== 0) return undefined;
    const version = (stdout + stderr).trim();
    if (version.length === 0) return undefined;
    return { ok: true, interpreterPath: cmd, version };
  } catch {
    return undefined;
  }
};

const resolveInterpreter = async (): Promise<ProbeResult> => {
  const override = process.env.BUNSAI_LAMBDA_PYTHON;
  if (override !== undefined && override.length > 0) {
    const result = await probeCandidate(override);
    if (result !== undefined) return result;
    return {
      ok: false,
      reason: `BUNSAI_LAMBDA_PYTHON=${override} is not executable`,
    };
  }
  for (const candidate of ["python3", "python"]) {
    const result = await probeCandidate(candidate);
    if (result !== undefined) return result;
  }
  return {
    ok: false,
    reason: "No python interpreter found on host (tried python3, python)",
  };
};

const buildPythonPath = (
  dir: string,
  files: Record<string, Uint8Array>,
): string | undefined => {
  const extras = new Set<string>();
  extras.add(dir);
  for (const path of Object.keys(files)) {
    const m = path.match(
      /^opt\/python\/lib\/(python3\.[0-9]+)\/site-packages\//,
    );
    if (m !== null) {
      extras.add(join(dir, "opt/python/lib", m[1] ?? "", "site-packages"));
    }
    if (path.startsWith("opt/python/")) {
      extras.add(join(dir, "opt/python"));
    }
  }
  const list = [...extras];
  if (list.length === 0) return undefined;
  return list.join(":");
};

export const pythonAdapter: RuntimeAdapter = {
  id: "python",
  matches: (runtime) => runtime !== undefined && runtime.startsWith("python"),
  probeHost: async (): Promise<ProbeResult> => resolveInterpreter(),
  execute: async (args: ExecuteArgs): Promise<LambdaExecution> => {
    const resolved = resolveHandlerFile(args.files, args.handler);
    if (resolved === undefined) return { kind: "unsupported" };
    const probe = await resolveInterpreter();
    if (!probe.ok)
      return {
        kind: "host_runtime_missing",
        runtime: args.runtime ?? "python",
        reason: probe.reason,
      };

    const dir = await mkdtemp(join(tmpdir(), "bunsai-lambda-py-"));
    try {
      for (const [name, content] of Object.entries(args.files)) {
        const target = join(dir, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const eventPath = join(dir, "__bunsai_event.json");
      const resultPath = join(dir, "__bunsai_result.json");
      const harnessPath = join(dir, "__bunsai_harness.py");
      await writeFile(eventPath, JSON.stringify(args.event ?? null));
      await writeFile(harnessPath, HARNESS);

      const pythonPath = buildPythonPath(dir, args.files);

      const start = Date.now();
      const proc = Bun.spawn([probe.interpreterPath, harnessPath], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          ...args.env,
          ...(pythonPath !== undefined ? { PYTHONPATH: pythonPath } : {}),
          __BUNSAI_EVENT: eventPath,
          __BUNSAI_RESULT: resultPath,
          __BUNSAI_HANDLER: `${resolved.module}.${resolved.name}`,
          __BUNSAI_DIR: dir,
          __BUNSAI_CONTEXT: JSON.stringify(args.context),
          __BUNSAI_DEADLINE: String(start + args.timeoutMs),
        },
        stdout: "pipe",
        stderr: "pipe",
        timeout: args.timeoutMs,
        killSignal: "SIGKILL",
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      await proc.exited;
      const logs = stdout + stderr;
      const elapsed = Date.now() - start;

      const resultText = await Bun.file(resultPath)
        .text()
        .catch(() => undefined);
      if (resultText === undefined) {
        if (elapsed >= args.timeoutMs) return { kind: "timeout", logs };
        return {
          kind: "error",
          errorType: "Runtime.ExitError",
          errorMessage:
            stderr.trim().split("\n").slice(-1)[0] ??
            "Process exited before completing the request",
          trace: [],
          logs,
        };
      }
      const parsed = JSON.parse(resultText) as ResultFile;
      if (parsed.ok) return { kind: "result", payload: parsed.result, logs };
      return {
        kind: "error",
        errorType: parsed.errorType,
        errorMessage: parsed.errorMessage,
        trace: parsed.trace,
        logs,
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
