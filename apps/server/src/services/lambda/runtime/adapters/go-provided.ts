import { mkdtemp, mkdir, rm, writeFile, chmod, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "../types.ts";

const probeBootstrap = async (zipDir: string): Promise<ProbeResult> => {
  const override = process.env.BUNSAI_LAMBDA_BOOTSTRAP_FALLBACK;
  if (override !== undefined && override.length > 0) {
    return { ok: true, interpreterPath: override, version: "fallback" };
  }
  const candidate = join(zipDir, "bootstrap");
  try {
    const st = await stat(candidate);
    if (st.isFile())
      return { ok: true, interpreterPath: candidate, version: "zip" };
  } catch {}
  return {
    ok: false,
    reason:
      "bootstrap executable not found in zip root and BUNSAI_LAMBDA_BOOTSTRAP_FALLBACK is unset",
  };
};

type RuntimeApiState =
  | { phase: "pending"; requestId: string; deadlineMs: number; event: unknown }
  | { phase: "done"; response: unknown }
  | {
      phase: "error";
      errorType: string;
      errorMessage: string;
      trace: string[];
    };

const startRuntimeApi = (
  requestId: string,
  deadlineMs: number,
  event: unknown,
  invokedArn: string,
): Promise<{
  host: string;
  port: number;
  close: () => Promise<void>;
  done: Promise<RuntimeApiState>;
}> => {
  return new Promise((resolveServer) => {
    let state: RuntimeApiState = {
      phase: "pending",
      requestId,
      deadlineMs,
      event,
    };
    let resolveDone: (s: RuntimeApiState) => void = () => {};
    const done = new Promise<RuntimeApiState>((r) => {
      resolveDone = r;
    });

    const server = createServer((req, res) => {
      const url = req.url ?? "";
      if (
        req.method === "GET" &&
        url === "/2018-06-01/runtime/invocation/next"
      ) {
        if (state.phase !== "pending") {
          res.statusCode = 204;
          res.end();
          return;
        }
        res.setHeader("Lambda-Runtime-Aws-Request-Id", state.requestId);
        res.setHeader("Lambda-Runtime-Deadline-Ms", String(state.deadlineMs));
        res.setHeader("Lambda-Runtime-Invoked-Function-Arn", invokedArn);
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify(state.event ?? null));
        return;
      }
      const responseMatch = url.match(
        /^\/2018-06-01\/runtime\/invocation\/([^/]+)\/response$/,
      );
      if (req.method === "POST" && responseMatch !== null) {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = null;
          try {
            parsed = text.length > 0 ? JSON.parse(text) : null;
          } catch {
            parsed = text;
          }
          state = { phase: "done", response: parsed };
          res.statusCode = 202;
          res.end();
          resolveDone(state);
        });
        return;
      }
      const errorMatch = url.match(
        /^\/2018-06-01\/runtime\/invocation\/([^/]+)\/error$/,
      );
      if (req.method === "POST" && errorMatch !== null) {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let errorType = "Runtime.Unknown";
          let errorMessage = text;
          let trace: string[] = [];
          try {
            const parsed = JSON.parse(text) as {
              errorType?: string;
              errorMessage?: string;
              stackTrace?: string[];
            };
            if (parsed.errorType !== undefined) errorType = parsed.errorType;
            if (parsed.errorMessage !== undefined)
              errorMessage = parsed.errorMessage;
            if (Array.isArray(parsed.stackTrace)) trace = parsed.stackTrace;
          } catch {}
          state = { phase: "error", errorType, errorMessage, trace };
          res.statusCode = 202;
          res.end();
          resolveDone(state);
        });
        return;
      }
      const initErrorMatch = url === "/2018-06-01/runtime/init/error";
      if (req.method === "POST" && initErrorMatch) {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          state = {
            phase: "error",
            errorType: "Runtime.InitError",
            errorMessage: text,
            trace: [],
          };
          res.statusCode = 202;
          res.end();
          resolveDone(state);
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolveServer({
        host: "127.0.0.1",
        port: addr.port,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
        done,
      });
    });
  });
};

export const goProvidedAdapter: RuntimeAdapter = {
  id: "go-provided",
  matches: (runtime) =>
    runtime !== undefined &&
    (runtime.startsWith("provided") || runtime === "go1.x"),
  probeHost: async (): Promise<ProbeResult> => {
    const override = process.env.BUNSAI_LAMBDA_BOOTSTRAP_FALLBACK;
    if (override !== undefined && override.length > 0) {
      return { ok: true, interpreterPath: override, version: "fallback" };
    }
    return { ok: true, interpreterPath: "<zipDir>/bootstrap", version: "zip" };
  },
  execute: async (args: ExecuteArgs): Promise<LambdaExecution> => {
    const dir = await mkdtemp(join(tmpdir(), "bunsai-lambda-go-"));
    try {
      for (const [name, content] of Object.entries(args.files)) {
        const target = join(dir, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const probe = await probeBootstrap(dir);
      if (!probe.ok) {
        return {
          kind: "host_runtime_missing",
          runtime: args.runtime ?? "provided",
          reason: probe.reason,
        };
      }
      const bootstrap = probe.interpreterPath;
      try {
        await chmod(bootstrap, 0o755);
      } catch {}

      const ctx = args.context as {
        awsRequestId?: string;
        invokedFunctionArn?: string;
        functionName?: string;
        functionVersion?: string;
      };
      const requestId = ctx.awsRequestId ?? globalThis.crypto.randomUUID();
      const invokedArn =
        ctx.invokedFunctionArn ??
        "arn:aws:lambda:us-east-1:000000000000:function:bunsai";
      const functionName = ctx.functionName ?? "bunsai";
      const functionVersion = ctx.functionVersion ?? "$LATEST";

      const start = Date.now();
      const deadlineMs = start + args.timeoutMs;

      const api = await startRuntimeApi(
        requestId,
        deadlineMs,
        args.event,
        invokedArn,
      );

      const ldLibraryPath = join(dir, "opt", "lib");
      const optBin = join(dir, "opt", "bin");
      const pathPrefix = `${optBin}:${process.env.PATH ?? ""}`;

      try {
        const proc = Bun.spawn([bootstrap], {
          cwd: dir,
          env: {
            HOME: process.env.HOME ?? "",
            PATH: pathPrefix,
            LD_LIBRARY_PATH: ldLibraryPath,
            ...args.env,
            AWS_LAMBDA_RUNTIME_API: `${api.host}:${api.port}`,
            AWS_LAMBDA_FUNCTION_NAME: functionName,
            AWS_LAMBDA_FUNCTION_VERSION: functionVersion,
            AWS_LAMBDA_FUNCTION_INVOKED_ARN: invokedArn,
            _HANDLER: args.handler,
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: args.timeoutMs,
          killSignal: "SIGKILL",
        });

        const [stdout, stderr, finalState] = await Promise.all([
          new Response(proc.stdout).text(),
          new Response(proc.stderr).text(),
          Promise.race([
            api.done,
            proc.exited.then((): RuntimeApiState | undefined => undefined),
          ]),
        ]);
        await proc.exited;
        const logs = stdout + stderr;
        const elapsed = Date.now() - start;

        if (finalState === undefined) {
          if (elapsed >= args.timeoutMs) return { kind: "timeout", logs };
          return {
            kind: "error",
            errorType: "Runtime.ExitError",
            errorMessage:
              stderr.trim().split("\n").slice(-1)[0] ??
              "bootstrap exited before responding",
            trace: [],
            logs,
          };
        }
        if (finalState.phase === "done") {
          return { kind: "result", payload: finalState.response, logs };
        }
        if (finalState.phase === "error") {
          return {
            kind: "error",
            errorType: finalState.errorType,
            errorMessage: finalState.errorMessage,
            trace: finalState.trace,
            logs,
          };
        }
        return {
          kind: "error",
          errorType: "Runtime.Unknown",
          errorMessage: "runtime API did not receive a response",
          trace: [],
          logs,
        };
      } finally {
        await api.close();
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
