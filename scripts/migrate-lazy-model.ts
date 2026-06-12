#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const servicesDir = join(import.meta.dir, "../apps/server/src/services");
const modelsDir = join(import.meta.dir, "../apps/server/models");

const files = (await readdir(servicesDir)).filter((f) => f.endsWith(".ts"));

let migrated = 0;
let skipped = 0;

for (const file of files) {
  const path = join(servicesDir, file);
  const src = await readFile(path, "utf-8");

  const jsonImportMatch = src.match(
    /^import (\w+) from "(\.\.\/\.\.\/models\/([^"]+)\.json)" with \{ type: "json" \};$/m,
  );

  if (jsonImportMatch === null) {
    skipped++;
    continue;
  }

  const [jsonImportLine, modelVar, jsonPath, modelName] = jsonImportMatch;

  const loadCallRegex = new RegExp(
    `^const model = loadServiceModel\\(${modelVar}\\);$`,
    "m",
  );
  if (!loadCallRegex.test(src)) {
    console.error(
      `WARN: ${file}: found JSON import but no matching loadServiceModel call`,
    );
    skipped++;
    continue;
  }

  let targetPrefix: string | undefined;
  try {
    const modelJson = JSON.parse(
      await readFile(join(modelsDir, `${modelName}.json`), "utf-8"),
    ) as { metadata?: { targetPrefix?: string } };
    targetPrefix = modelJson.metadata?.targetPrefix;
  } catch {
    // model file not found, no targetPrefix
  }

  const metaArg =
    targetPrefix !== undefined
      ? `,\n  { targetPrefix: "${targetPrefix}" }`
      : "";

  let out = src;

  out = out.replace(jsonImportLine + "\n", "");

  out = out.replace(
    `import { lazyServiceModel } from "../core/shapes.ts";`,
    `import { lazyServiceModel } from "../core/shapes.ts";`,
  );
  out = out.replace(
    `import { loadServiceModel } from "../core/shapes.ts";`,
    `import { lazyServiceModel } from "../core/shapes.ts";`,
  );

  out = out.replace(
    loadCallRegex,
    `const model = lazyServiceModel(\n  () => import("${jsonPath}", { with: { type: "json" } })${metaArg}\n);`,
  );

  await writeFile(path, out, "utf-8");
  migrated++;
}

console.log(`migrated: ${migrated}, skipped: ${skipped}`);
