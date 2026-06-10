import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const USAGE = `
record-parity — record real AWS responses into parity fixture files

Usage:
  bun maint/bin/record-parity.ts <fixture-path> --yes

Arguments:
  <fixture-path>  Path to a parity fixture JSON file with steps that have
                  "input" defined but "expected" empty or missing.
  --yes           Required flag. Confirms you accept that this script will make
                  REAL AWS API calls using your environment credentials, may
                  create/modify/delete AWS resources, and may incur charges.

WARNING: This script calls real AWS endpoints. Ensure your credentials and
region are configured correctly. Resources created during recording are NOT
automatically cleaned up.
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

function autoAny(value: unknown): unknown {
  if (typeof value === "string") {
    if (ISO_DATE_RE.test(value)) return "<ANY>";
    if (UUID_RE.test(value)) return "<ANY>";
    if (HEX_ID_RE.test(value)) return "<ANY>";
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
const fixturePaths = args.filter((a) => !a.startsWith("-"));

if (!hasYes || fixturePaths.length === 0) {
  console.log(USAGE);
  process.exit(hasYes && fixturePaths.length === 0 ? 1 : 0);
}

for (const fixturePath of fixturePaths) {
  const absPath = resolve(fixturePath);
  const fixture = JSON.parse(readFileSync(absPath, "utf8")) as Fixture;

  console.log(`\nRecording: ${absPath}`);

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
    console.log(`  step ${i + 1}/${fixture.steps.length}: ${step.command}`);

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
  writeFileSync(absPath, outJson, "utf8");
  console.log(`  wrote: ${join(fixturePath)}`);
}

console.log("\nDone.");
