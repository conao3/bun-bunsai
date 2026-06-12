#!/usr/bin/env bun
const args = Bun.argv.slice(2);

const usage = `bunsai - local AWS emulator

Usage: bunsai [options]

Options:
  --port <n>     AWS gateway port (default 4566, env BUNSAI_PORT)
  --ui-port <n>  management + dashboard port (default 5666, env BUNSAI_UI_PORT)
  --version      print version and exit
  --help         show this help
`;

const readFlag = (name: string): string | undefined => {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
};

if (args.includes("--help") || args.includes("-h")) {
  console.log(usage);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = (await import("../package.json")) as { version?: string };
  console.log(pkg.version ?? "unknown");
  process.exit(0);
}

const port = readFlag("--port");
if (port !== undefined) Bun.env.BUNSAI_PORT = port;
const uiPort = readFlag("--ui-port");
if (uiPort !== undefined) Bun.env.BUNSAI_UI_PORT = uiPort;
if (Bun.env.NODE_ENV === undefined) Bun.env.NODE_ENV = "production";

await import("./index.ts");
export {};
