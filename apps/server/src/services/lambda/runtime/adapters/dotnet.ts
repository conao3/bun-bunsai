import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  ExecuteArgs,
  LambdaExecution,
  ProbeResult,
  RuntimeAdapter,
} from "../types.ts";

const HARNESS_CSPROJ = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>disable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>BunsaiHarness</RootNamespace>
    <AssemblyName>bunsai_harness</AssemblyName>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="Program.cs" />
  </ItemGroup>
</Project>
`;

const HARNESS_PROGRAM = `using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;

static class Bunsai
{
    static async Task<int> Main()
    {
        string eventPath = Environment.GetEnvironmentVariable("__BUNSAI_EVENT");
        string resultPath = Environment.GetEnvironmentVariable("__BUNSAI_RESULT");
        string asmPath = Environment.GetEnvironmentVariable("__BUNSAI_HANDLER_ASSEMBLY");
        string typeName = Environment.GetEnvironmentVariable("__BUNSAI_HANDLER_TYPE");
        string methodName = Environment.GetEnvironmentVariable("__BUNSAI_HANDLER_METHOD");
        string contextJson = Environment.GetEnvironmentVariable("__BUNSAI_CONTEXT");
        long deadline = long.Parse(Environment.GetEnvironmentVariable("__BUNSAI_DEADLINE"));
        try
        {
            string eventJson = File.ReadAllText(eventPath);
            Assembly asm = Assembly.LoadFrom(asmPath);
            Type t = asm.GetType(typeName);
            if (t == null) { Write(resultPath, new { ok = false, errorType = "Runtime.HandlerNotFound", errorMessage = "type " + typeName + " not found", trace = new string[0] }); return 0; }
            MethodInfo m = t.GetMethods().FirstOrDefault(x => x.Name == methodName);
            if (m == null) { Write(resultPath, new { ok = false, errorType = "Runtime.HandlerNotFound", errorMessage = "method " + methodName + " not found", trace = new string[0] }); return 0; }
            object instance = m.IsStatic ? null : Activator.CreateInstance(t);
            var ctxDict = JsonSerializer.Deserialize<JsonElement>(contextJson);
            var parameters = m.GetParameters();
            object[] args = parameters.Length switch
            {
                0 => Array.Empty<object>(),
                1 => new object[] { eventJson },
                _ => new object[] { eventJson, ctxDict },
            };
            object result = m.Invoke(instance, args);
            if (result is Task task)
            {
                await task.ConfigureAwait(false);
                var resultProp = task.GetType().GetProperty("Result");
                result = resultProp != null ? resultProp.GetValue(task) : null;
            }
            Write(resultPath, new { ok = true, result = result });
        }
        catch (Exception err)
        {
            var inner = err is TargetInvocationException tie && tie.InnerException != null ? tie.InnerException : err;
            Write(resultPath, new { ok = false, errorType = inner.GetType().FullName, errorMessage = inner.Message ?? "", trace = (inner.StackTrace ?? "").Split('\\n') });
        }
        return 0;
    }
    static void Write(string path, object obj)
    {
        File.WriteAllText(path, JsonSerializer.Serialize(obj));
    }
}
`;

const resolveHostCommand = async (): Promise<string | undefined> => {
  const override = process.env.BUNSAI_LAMBDA_DOTNET;
  if (override !== undefined && override.length > 0) return override;
  const which = Bun.spawnSync(["sh", "-c", "command -v dotnet"]);
  if (which.exitCode === 0) {
    const path = new TextDecoder().decode(which.stdout).trim();
    if (path.length > 0) return path;
  }
  return undefined;
};

const parseHandler = (
  handler: string,
): { assembly: string; type: string; method: string } | undefined => {
  const parts = handler.split("::");
  if (parts.length !== 3) return undefined;
  const [assembly, type, method] = parts;
  if (assembly.length === 0 || type.length === 0 || method.length === 0)
    return undefined;
  return { assembly, type, method };
};

const resolveAssemblyFile = (
  files: Record<string, Uint8Array>,
  assembly: string,
): string | undefined => {
  const target = assembly + ".dll";
  if (files[target] !== undefined) return target;
  for (const name of Object.keys(files)) {
    if (name === target || name.endsWith("/" + target)) return name;
  }
  return undefined;
};

type ResultFile =
  | { ok: true; result: unknown }
  | { ok: false; errorType: string; errorMessage: string; trace: string[] };

export const dotnetAdapter: RuntimeAdapter = {
  id: "dotnet",
  matches: (runtime) => runtime !== undefined && runtime.startsWith("dotnet"),
  probeHost: async (): Promise<ProbeResult> => {
    const cmd = await resolveHostCommand();
    if (cmd === undefined)
      return {
        ok: false,
        reason:
          "dotnet not found in PATH; set BUNSAI_LAMBDA_DOTNET to override",
      };
    const proc = Bun.spawn([cmd, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    if (proc.exitCode !== 0)
      return { ok: false, reason: "dotnet --version exited non-zero" };
    const version = new TextDecoder()
      .decode(await new Response(proc.stdout).arrayBuffer())
      .trim();
    return { ok: true, interpreterPath: cmd, version };
  },
  execute: async (args: ExecuteArgs): Promise<LambdaExecution> => {
    const parsed = parseHandler(args.handler);
    if (parsed === undefined) return { kind: "unsupported" };
    const assemblyFile = resolveAssemblyFile(args.files, parsed.assembly);
    if (assemblyFile === undefined) return { kind: "unsupported" };
    const cmd = await resolveHostCommand();
    if (cmd === undefined)
      return {
        kind: "host_runtime_missing",
        runtime: args.runtime ?? "dotnet",
        reason: "dotnet not found in PATH",
      };

    const dir = await mkdtemp(join(tmpdir(), "bunsai-lambda-dotnet-"));
    try {
      for (const [name, content] of Object.entries(args.files)) {
        const target = join(dir, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content);
      }
      const harnessDir = join(dir, "__bunsai_harness");
      await mkdir(harnessDir, { recursive: true });
      await writeFile(join(harnessDir, "Program.cs"), HARNESS_PROGRAM);
      await writeFile(
        join(harnessDir, "bunsai_harness.csproj"),
        HARNESS_CSPROJ,
      );

      const eventPath = join(dir, "__bunsai_event.json");
      const resultPath = join(dir, "__bunsai_result.json");
      await writeFile(eventPath, JSON.stringify(args.event ?? null));

      const layerPath = [join(dir, "opt", "dotnet"), dir].join(":");
      const start = Date.now();
      const proc = Bun.spawn(
        [cmd, "run", "--project", harnessDir, "--configuration", "Release"],
        {
          cwd: dir,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            DOTNET_CLI_HOME: dir,
            DOTNET_NOLOGO: "1",
            DOTNET_CLI_TELEMETRY_OPTOUT: "1",
            ...args.env,
            DOTNET_ADDITIONAL_DEPS: layerPath,
            __BUNSAI_EVENT: eventPath,
            __BUNSAI_RESULT: resultPath,
            __BUNSAI_HANDLER_ASSEMBLY: join(dir, assemblyFile),
            __BUNSAI_HANDLER_TYPE: parsed.type,
            __BUNSAI_HANDLER_METHOD: parsed.method,
            __BUNSAI_CONTEXT: JSON.stringify(args.context),
            __BUNSAI_DEADLINE: String(start + args.timeoutMs),
          },
          stdout: "pipe",
          stderr: "pipe",
          timeout: args.timeoutMs,
          killSignal: "SIGKILL",
        },
      );
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
      const result = JSON.parse(resultText) as ResultFile;
      if (result.ok) return { kind: "result", payload: result.result, logs };
      return {
        kind: "error",
        errorType: result.errorType,
        errorMessage: result.errorMessage,
        trace: result.trace,
        logs,
      };
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};
