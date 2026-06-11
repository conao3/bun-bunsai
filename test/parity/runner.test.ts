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

function materialize(value: unknown): unknown {
  if (value instanceof Uint8Array) return value;
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "$base64" in (value as Record<string, unknown>)
  ) {
    const b64 = (value as Record<string, unknown>)["$base64"] as string;
    return Buffer.from(b64, "base64");
  }
  if (Array.isArray(value)) return value.map(materialize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        materialize(v),
      ]),
    );
  }
  return value;
}

function resolveRefs(
  input: Record<string, unknown>,
  saved: Record<string, Record<string, unknown>>,
): Record<string, unknown> {
  const resolvePath = (name: string, rest: string): unknown => {
    const obj = saved[name];
    if (obj === undefined) return undefined;
    const path = rest.slice(1).split(".");
    let current: unknown = obj;
    for (const key of path) {
      if (
        current !== null &&
        typeof current === "object" &&
        !(current instanceof Uint8Array)
      ) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  };

  const substitute = (value: unknown): unknown => {
    if (typeof value === "string") {
      const exactMatch = /^\$\{(\w+)((?:\.\w+)+)\}$/.exec(value);
      if (exactMatch) {
        const resolved = resolvePath(exactMatch[1], exactMatch[2]);
        return resolved ?? "";
      }
      return value.replace(/\$\{(\w+)((?:\.\w+)+)\}/g, (_m, name, rest) =>
        String(resolvePath(name, rest) ?? ""),
      );
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
  const substituted = substitute(input) as Record<string, unknown>;
  return materialize(substituted) as Record<string, unknown>;
}

function deepNormalize(actual: unknown, expected: unknown): [unknown, unknown] {
  if (expected === "<ANY>") return [undefined, undefined];
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const aOut: unknown[] = [];
    const eOut: unknown[] = [];
    for (let i = 0; i < expected.length; i++) {
      const [na, ne] = deepNormalize(actual[i], expected[i]);
      aOut.push(na);
      eOut.push(ne);
    }
    return [aOut, eOut];
  }
  if (
    actual !== null &&
    typeof actual === "object" &&
    !Array.isArray(actual) &&
    expected !== null &&
    typeof expected === "object" &&
    !Array.isArray(expected)
  ) {
    const aObj = actual as Record<string, unknown>;
    const eObj = expected as Record<string, unknown>;
    const aOut: Record<string, unknown> = {};
    const eOut: Record<string, unknown> = {};
    for (const [k, ev] of Object.entries(eObj)) {
      const [na, ne] = deepNormalize(aObj[k], ev);
      if (na !== undefined || ne !== undefined) {
        aOut[k] = na;
        eOut[k] = ne;
      }
    }
    return [aOut, eOut];
  }
  return [actual, expected];
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

  const [na, ne] = deepNormalize(a, e);
  return [na as Record<string, unknown>, ne as Record<string, unknown>];
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
