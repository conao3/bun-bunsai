#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const usage = `Usage: bun scripts/aws-model-op.ts <service> [operation]

Extract operation shape from apps/server/models/<service>.json without
loading the whole file into the agent context.

Examples:
  bun scripts/aws-model-op.ts cognito-idp                 # list every operation name
  bun scripts/aws-model-op.ts cognito-idp InitiateAuth    # input / output / errors for one op
  bun scripts/aws-model-op.ts cognito-idp InitiateAuth --with-shapes
                                                          # also expand referenced input/output/error shapes one level
`;

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
  process.stdout.write(usage);
  process.exit(args.length === 0 ? 1 : 0);
}

const service = args[0];
const operation = args[1] && !args[1].startsWith("--") ? args[1] : null;
const withShapes = args.includes("--with-shapes");

const modelPath = resolve(
  process.cwd(),
  "apps/server/models",
  `${service}.json`,
);

let model: {
  metadata?: Record<string, unknown>;
  operations?: Record<string, AwsOp>;
  shapes?: Record<string, unknown>;
};
try {
  model = JSON.parse(readFileSync(modelPath, "utf8"));
} catch (err) {
  process.stderr.write(
    `aws-model-op: failed to read ${modelPath}: ${(err as Error).message}\n`,
  );
  process.exit(2);
}

type AwsOp = {
  name: string;
  http?: { method: string; requestUri: string; responseCode?: number };
  input?: { shape: string };
  output?: { shape: string };
  errors?: { shape: string }[];
  documentation?: string;
  idempotent?: boolean;
};

const ops = model.operations ?? {};
const opNames = Object.keys(ops).sort();

if (!operation) {
  const protocol =
    (model.metadata as { protocol?: string } | undefined)?.protocol ?? "?";
  const apiVersion =
    (model.metadata as { apiVersion?: string } | undefined)?.apiVersion ?? "?";
  process.stdout.write(
    `${service} (protocol=${protocol}, apiVersion=${apiVersion}, operations=${opNames.length})\n`,
  );
  for (const name of opNames) process.stdout.write(`${name}\n`);
  process.exit(0);
}

const op = ops[operation];
if (!op) {
  process.stderr.write(
    `aws-model-op: operation "${operation}" not found in ${service}\n`,
  );
  const hint = opNames.find((n) => n.toLowerCase() === operation.toLowerCase());
  if (hint) process.stderr.write(`did you mean: ${hint}\n`);
  process.exit(3);
}

const summary = {
  name: op.name,
  http: op.http ?? null,
  input: op.input?.shape ?? null,
  output: op.output?.shape ?? null,
  errors: (op.errors ?? []).map((e) => e.shape),
  idempotent: op.idempotent ?? false,
};

process.stdout.write(JSON.stringify(summary, null, 2));
process.stdout.write("\n");

if (withShapes && model.shapes) {
  const wanted = new Set<string>();
  if (summary.input) wanted.add(summary.input);
  if (summary.output) wanted.add(summary.output);
  for (const e of summary.errors) wanted.add(e);

  process.stdout.write("\n--- shapes ---\n");
  for (const shape of wanted) {
    const s = model.shapes[shape];
    if (s) {
      process.stdout.write(`\n${shape}:\n`);
      process.stdout.write(JSON.stringify(s, null, 2));
      process.stdout.write("\n");
    }
  }
}
