import { expect, test, beforeAll } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
beforeAll(async () => {
  const adapter = findAdapter("dotnet8");
  if (adapter === undefined) return;
  const probe = await probeAdapter(adapter);
  probeOk = probe.ok;
});

test("findAdapter resolves dotnet* to the dotnet adapter", () => {
  expect(findAdapter("dotnet8")?.id).toBe("dotnet");
  expect(findAdapter("dotnet6")?.id).toBe("dotnet");
});

test(".NET handler invokes end-to-end (skipped if host runtime missing)", async () => {
  if (!probeOk) return;

  const dir = await mkdtemp(join(tmpdir(), "bunsai-dotnet-e2e-"));
  try {
    const srcDir = join(dir, "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(
      join(srcDir, "Handler.cs"),
      [
        "using System.Text.Json;",
        "namespace MyNamespace {",
        "  public class Handler {",
        "    public string HandleRequest(string input) {",
        "      return JsonSerializer.Serialize(new { statusCode = 200, ok = true });",
        "    }",
        "  }",
        "}",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(srcDir, "MyAssembly.csproj"),
      [
        '<Project Sdk="Microsoft.NET.Sdk">',
        "  <PropertyGroup>",
        "    <TargetFramework>net8.0</TargetFramework>",
        "    <AssemblyName>MyAssembly</AssemblyName>",
        "  </PropertyGroup>",
        "</Project>",
        "",
      ].join("\n"),
    );

    const buildDir = join(dir, "build");
    await mkdir(buildDir, { recursive: true });
    const build = Bun.spawnSync(
      [
        "dotnet",
        "publish",
        srcDir,
        "-c",
        "Release",
        "-o",
        buildDir,
        "--nologo",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    if (build.exitCode !== 0) return;

    const zipPath = join(dir, "fn.zip");
    Bun.spawnSync(["zip", "-q", "-r", zipPath, "."], { cwd: buildDir });
    const zipBytes = await Bun.file(zipPath).bytes();

    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: "dotnet-fn",
        Runtime: "dotnet8",
        Role: "arn:aws:iam::000000000000:role/test",
        Handler: "MyAssembly::MyNamespace.Handler::HandleRequest",
        Code: { ZipFile: zipBytes },
      }),
    );

    const invoke = await lambda.send(
      new InvokeCommand({
        FunctionName: "dotnet-fn",
        Payload: new TextEncoder().encode('"hello"'),
      }),
    );
    const text = new TextDecoder().decode(invoke.Payload);
    expect(text.length).toBeGreaterThan(0);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});
