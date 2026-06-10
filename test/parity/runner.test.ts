import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { startApp } from "../e2e/harness.ts";

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

function collectFixtures(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectFixtures(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(fullPath);
      }
    }
  } catch {
    // fixtures dir absent
  }
  return files;
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

function normalizeForComparison(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  ignorePaths: string[],
): [Record<string, unknown>, Record<string, unknown>] {
  const a = { ...actual };
  const e = { ...expected };

  for (const path of ignorePaths) {
    delete a[path];
    delete e[path];
  }

  for (const [key, val] of Object.entries(e)) {
    if (val === "<ANY>") {
      delete a[key];
      delete e[key];
    }
  }

  return [a, e];
}

const fixturesDir = join(import.meta.dir, "fixtures");
const fixturePaths = collectFixtures(fixturesDir);

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

for (const fixturePath of fixturePaths) {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
  const label = fixturePath.slice(fixturesDir.length + 1);

  test(`parity: ${label}`, async () => {
    const pkg = (await import(fixture.clientPackage)) as Record<
      string,
      new (opts: unknown) => unknown
    >;

    const ClientClass = pkg[fixture.clientName];
    if (!ClientClass)
      throw new Error(
        `${fixture.clientName} not found in ${fixture.clientPackage}`,
      );

    const client = new ClientClass({
      endpoint,
      region,
      credentials,
      requestHandler,
    });
    const send = (client as { send(cmd: unknown): Promise<unknown> }).send.bind(
      client,
    );

    const saved: Record<string, Record<string, unknown>> = {};

    for (const step of fixture.steps) {
      const CommandClass = pkg[step.command];
      if (!CommandClass)
        throw new Error(
          `${step.command} not found in ${fixture.clientPackage}`,
        );

      const resolvedInput = resolveRefs(step.input, saved);
      const result = (await send(new CommandClass(resolvedInput))) as Record<
        string,
        unknown
      >;

      if (step.saveAs) {
        saved[step.saveAs] = result;
      }

      const [actualNorm, expectedNorm] = normalizeForComparison(
        result,
        step.expected,
        step.ignorePaths,
      );
      expect(actualNorm).toEqual(expectedNorm);
    }
  });
}
