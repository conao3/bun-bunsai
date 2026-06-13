import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "../types.ts";

const HARNESS = `require "json"
require "ostruct"

deadline = ENV["__BUNSAI_DEADLINE"].to_i
ctx_data = JSON.parse(ENV["__BUNSAI_CONTEXT"])
context = OpenStruct.new(
  function_name: ctx_data["functionName"],
  function_version: ctx_data["functionVersion"],
  invoked_function_arn: ctx_data["invokedFunctionArn"],
  memory_limit_in_mb: ctx_data["memoryLimitInMB"],
  aws_request_id: ctx_data["awsRequestId"],
  log_group_name: ctx_data["logGroupName"],
  log_stream_name: ctx_data["logStreamName"],
)
context.define_singleton_method(:get_remaining_time_in_millis) do
  [0, deadline - (Time.now.to_f * 1000).to_i].max
end

write = lambda do |obj|
  File.write(ENV["__BUNSAI_RESULT"], JSON.generate(obj))
end

begin
  event = JSON.parse(File.read(ENV["__BUNSAI_EVENT"]))
  handler_file = ENV["__BUNSAI_HANDLER_FILE"]
  handler_name = ENV["__BUNSAI_HANDLER_NAME"]
  load handler_file
  unless respond_to?(handler_name)
    write.call({ "ok" => false, "errorType" => "Runtime.HandlerNotFound", "errorMessage" => "#{handler_name} is not defined", "trace" => [] })
  else
    result = method(handler_name).call(event: event, context: context)
    write.call({ "ok" => true, "result" => result.nil? ? nil : result })
  end
rescue => err
  write.call({
    "ok" => false,
    "errorType" => err.class.name,
    "errorMessage" => err.message,
    "trace" => (err.backtrace || []),
  })
end
`;

const resolveHandlerFile = (
  files: Record<string, Uint8Array>,
  handler: string,
): { file: string; name: string } | undefined => {
  const lastDot = handler.lastIndexOf(".");
  if (lastDot <= 0) return undefined;
  const base = handler.slice(0, lastDot);
  const name = handler.slice(lastDot + 1);
  const candidate = base + ".rb";
  if (files[candidate] !== undefined) return { file: candidate, name };
  return undefined;
};

type ResultFile =
  | { ok: true; result: unknown }
  | { ok: false; errorType: string; errorMessage: string; trace: string[] };

const findRuby = async (): Promise<string | undefined> => {
  const override = process.env.BUNSAI_LAMBDA_RUBY;
  if (override !== undefined && override.length > 0) return override;
  const which = Bun.spawn(["which", "ruby"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(which.stdout).text();
  await which.exited;
  const trimmed = out.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed;
};

export const rubyAdapter: RuntimeAdapter = {
  id: "ruby",
  matches: (runtime) => runtime !== undefined && runtime.startsWith("ruby"),
  probeHost: async (): Promise<ProbeResult> => {
    const interpreter = await findRuby();
    if (interpreter === undefined)
      return {
        ok: false,
        reason: "ruby not found in PATH (set BUNSAI_LAMBDA_RUBY to override)",
      };
    const proc = Bun.spawn([interpreter, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    if (proc.exitCode !== 0)
      return { ok: false, reason: `ruby --version exited ${proc.exitCode}` };
    return { ok: true, interpreterPath: interpreter, version: out.trim() };
  },
  execute: async (args: ExecuteArgs): Promise<LambdaExecution> => {
    const resolved = resolveHandlerFile(args.files, args.handler);
    if (resolved === undefined) return { kind: "unsupported" };
    const interpreter = await findRuby();
    if (interpreter === undefined)
      return {
        kind: "host_runtime_missing",
        runtime: args.runtime ?? "ruby",
        reason: "ruby not found in PATH",
      };

    const dir = await mkdtemp(join(tmpdir(), "bunsai-lambda-ruby-"));
    try {
      for (const [name, content] of Object.entries(args.files)) {
        const target = join(dir, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const eventPath = join(dir, "__bunsai_event.json");
      const resultPath = join(dir, "__bunsai_result.json");
      const harnessPath = join(dir, "__bunsai_harness.rb");
      await writeFile(eventPath, JSON.stringify(args.event ?? null));
      await writeFile(harnessPath, HARNESS);

      const layerLib = join(dir, "opt/ruby/lib");
      const layerGems = join(dir, "opt/ruby/gems");

      const start = Date.now();
      const proc = Bun.spawn([interpreter, harnessPath], {
        cwd: dir,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          ...args.env,
          RUBYLIB: layerLib,
          GEM_PATH: layerGems,
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
