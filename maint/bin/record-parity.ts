import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const USAGE = `
record-parity — record real AWS responses into parity fixture files

Usage:
  bun maint/bin/record-parity.ts <service> <fixture-path> --yes [--out <path>]

Arguments:
  <service>       AWS service name (e.g. s3, sqs, iam)
  <fixture-path>  Path to a parity fixture JSON file with steps defined
  --yes           Required. Confirms real AWS API calls using your credentials.
                  Resources created during recording are cleaned up by the
                  fixture's delete steps; verify the steps before running.
  --out <path>    Write output fixture to this file (default: stdout)

WARNING: This script calls real AWS endpoints and may incur charges.
Ensure AWS credentials and region are configured before running.
`.trim();

type Step = {
  command: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  ignorePaths: string[];
  saveAs: string | null;
  refs: Record<string, string>;
};

type Fixture = {
  clientPackage: string;
  clientName: string;
  steps: Step[];
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_ID_RE = /^[0-9a-f]{16,}$/i;
const ACCOUNT_ID_RE = /^\d{12}$/;

function autoAny(value: unknown): unknown {
  if (typeof value === "string") {
    if (ISO_DATE_RE.test(value)) return "<ANY>";
    if (UUID_RE.test(value)) return "<ANY>";
    if (HEX_ID_RE.test(value)) return "<ANY>";
    if (ACCOUNT_ID_RE.test(value)) return "<ANY>";
    if (value.startsWith("arn:")) {
      return value.replace(
        /^(arn:[^:]+:[^:]+:[^:]*:)\d{12}(:.*)$/,
        "$1<ANY>$2",
      );
    }
  }
  if (value instanceof Date) return "<ANY>";
  if (Array.isArray(value)) return value.map(autoAny);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        autoAny(v),
      ]),
    );
  }
  return value;
}

function resolveRefs(
  input: Record<string, unknown>,
  saved: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const substitute = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.replace(/\$\{(\w+)\.(\w+)\}/g, (_m, name, field) => {
        const obj = saved[name];
        return obj !== undefined ? String(obj[field] ?? "") : "";
      });
    }
    if (Array.isArray(value)) return value.map(substitute);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          substitute(v),
        ]),
      );
    }
    return value;
  };
  return substitute(input) as Record<string, unknown>;
}

const args = process.argv.slice(2);
const hasYes = args.includes("--yes");
const outIdx = args.indexOf("--out");
const outPath = outIdx !== -1 ? (args[outIdx + 1] ?? null) : null;

const positionals = args.filter(
  (a, i) => !a.startsWith("-") && (outIdx === -1 || i !== outIdx + 1),
);

const service = positionals[0];
const fixturePath = positionals[1];

if (!hasYes || !service || !fixturePath) {
  console.log(USAGE);
  process.exit(1);
}

const absPath = resolve(fixturePath);
const fixture = JSON.parse(readFileSync(absPath, "utf8")) as Fixture;

console.error(`Recording [${service}]: ${absPath}`);

const pkg = (await import(fixture.clientPackage)) as Record<
  string,
  new (opts: unknown) => unknown
>;

const ClientClass = pkg[fixture.clientName];
if (!ClientClass) {
  console.error(
    `ERROR: ${fixture.clientName} not found in ${fixture.clientPackage}`,
  );
  process.exit(1);
}

const client = new ClientClass({
  region: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
});
const send = (client as { send(cmd: unknown): Promise<unknown> }).send.bind(
  client,
);

const saved: Record<string, Record<string, unknown>> = {};

for (let i = 0; i < fixture.steps.length; i++) {
  const step = fixture.steps[i];
  const CommandClass = pkg[step.command];
  if (!CommandClass) {
    console.error(
      `ERROR: ${step.command} not found in ${fixture.clientPackage}`,
    );
    process.exit(1);
  }

  const resolvedInput = resolveRefs(step.input, saved);
  console.error(`  step ${i + 1}/${fixture.steps.length}: ${step.command}`);

  const result = (await send(new CommandClass(resolvedInput))) as Record<
    string,
    unknown
  >;

  if (step.saveAs) {
    saved[step.saveAs] = result;
  }

  const normalized = autoAny(result) as Record<string, unknown>;
  for (const path of step.ignorePaths) {
    delete normalized[path];
  }

  fixture.steps[i] = { ...step, expected: normalized };
}

const outJson = JSON.stringify(fixture, null, 2) + "\n";

if (outPath) {
  writeFileSync(outPath, outJson, "utf8");
  console.error(`wrote: ${outPath}`);
} else {
  process.stdout.write(outJson);
}

console.error("\nDone.");
