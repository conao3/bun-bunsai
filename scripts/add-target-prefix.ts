#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const servicesDir = join(import.meta.dir, "../apps/server/src/services");
const modelsDir = join(import.meta.dir, "../apps/server/models");

const files = (await readdir(servicesDir)).filter((f) => f.endsWith(".ts"));

let updated = 0;
let skipped = 0;

for (const file of files) {
  const path = join(servicesDir, file);
  const src = await readFile(path, "utf-8");

  const importMatch = src.match(
    /const model = lazyServiceModel\(\s*\(\) => import\("(\.\.\/\.\.\/models\/([^"]+)\.json)"[^)]*\)\s*\);/m,
  );

  if (importMatch === null) {
    skipped++;
    continue;
  }

  const [fullMatch, _jsonPath, modelName] = importMatch;

  let targetPrefix: string | undefined;
  try {
    const modelJson = JSON.parse(
      await readFile(join(modelsDir, `${modelName}.json`), "utf-8"),
    ) as { metadata?: { targetPrefix?: string } };
    targetPrefix = modelJson.metadata?.targetPrefix;
  } catch {
    // no file
  }

  if (targetPrefix === undefined) {
    skipped++;
    continue;
  }

  const newMatch = fullMatch.replace(
    /\)\s*\);$/m,
    `,\n  { targetPrefix: "${targetPrefix}" }\n);`,
  );

  const out = src.replace(fullMatch, newMatch);
  await writeFile(path, out, "utf-8");
  updated++;
}

console.log(`updated: ${updated}, skipped: ${skipped}`);
