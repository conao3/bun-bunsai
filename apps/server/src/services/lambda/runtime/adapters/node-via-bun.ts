import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "../types.ts";

const HARNESS = `import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const deadline = Number(process.env.__BUNSAI_DEADLINE);
const context = JSON.parse(process.env.__BUNSAI_CONTEXT);
context.getRemainingTimeInMillis = () => Math.max(0, deadline - Date.now());
context.done = () => {};
context.succeed = () => {};
context.fail = () => {};
const write = (obj) => writeFileSync(process.env.__BUNSAI_RESULT, JSON.stringify(obj));
try {
  const event = JSON.parse(readFileSync(process.env.__BUNSAI_EVENT, "utf8"));
  const mod = await import(pathToFileURL(process.env.__BUNSAI_HANDLER_FILE).href);
  const name = process.env.__BUNSAI_HANDLER_NAME;
  const fn = mod[name] ?? (mod.default && mod.default[name]) ?? mod.default;
  if (typeof fn !== "function") {
    write({ ok: false, errorType: "Runtime.HandlerNotFound", errorMessage: name + " is not a function", trace: [] });
  } else {
    const result = await fn(event, context);
    write({ ok: true, result: result === undefined ? null : result });
  }
} catch (err) {
  write({
    ok: false,
    errorType: (err && err.name) || "Error",
    errorMessage: (err && err.message) || String(err),
    trace: ((err && err.stack) || "").split("\\n"),
  });
}
`;

const resolveHandlerFile = (
  files: Record<string, Uint8Array>,
  handler: string,
): { file: string; name: string } | undefined => {
  const lastDot = handler.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  const base = handler.slice(0, lastDot);
  const name = handler.slice(lastDot + 1);
  for (const ext of [".js", ".mjs", ".cjs"]) {
    if (files[base + ext] !== undefined) return { file: base + ext, name };
  }
  return undefined;
};

type ResultFile =
  | { ok: true; result: unknown }
  | { ok: false; errorType: string; errorMessage: string; trace: string[] };

export const nodeViaBunAdapter: RuntimeAdapter = {
  id: "nodejs",
  matches: (runtime) => runtime !== undefined && runtime.startsWith("nodejs"),
  probeHost: async (): Promise<ProbeResult> => ({
    ok: true,
    interpreterPath: "bun",
    version: Bun.version,
  }),
  execute: async (args: ExecuteArgs): Promise<LambdaExecution> => {
    const resolved = resolveHandlerFile(args.files, args.handler);
    if (resolved === undefined) return { kind: "unsupported" };

    const dir = await mkdtemp(join(tmpdir(), "bunsai-lambda-"));
    try {
      for (const [name, content] of Object.entries(args.files)) {
        const target = join(dir, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const eventPath = join(dir, "__bunsai_event.json");
      const resultPath = join(dir, "__bunsai_result.json");
      const harnessPath = join(dir, "__bunsai_harness.mjs");
      await writeFile(eventPath, JSON.stringify(args.event ?? null));
      await writeFile(harnessPath, HARNESS);

      const nodePath =
        args.nodePaths !== undefined && args.nodePaths.length > 0
          ? args.nodePaths.map((p) => join(dir, p)).join(":")
          : undefined;

      const start = Date.now();
      const proc = Bun.spawn(["bun", harnessPath], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          ...args.env,
          ...(nodePath !== undefined ? { NODE_PATH: nodePath } : {}),
          __BUNSAI_EVENT: eventPath,
          __BUNSAI_RESULT: resultPath,
          __BUNSAI_HANDLER_FILE: join(dir, resolved.file),
          __BUNSAI_HANDLER_NAME: resolved.name,
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
