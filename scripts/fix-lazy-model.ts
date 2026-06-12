#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const servicesDir = join(import.meta.dir, "../apps/server/src/services");
const modelsDir = join(import.meta.dir, "../apps/server/models");

const files = (await readdir(servicesDir)).filter((f) => f.endsWith(".ts"));

let fixed = 0;
let already = 0;
let skipped = 0;

for (const file of files) {
  const path = join(servicesDir, file);
  const src = await readFile(path, "utf-8");

  if (!src.includes("lazyServiceModel")) {
    skipped++;
    continue;
  }

  const modelNameMatch = src.match(
    /import\("(\.\.\/\.\.\/models\/([^"]+)\.json)"/,
  );
  if (modelNameMatch === null) {
    skipped++;
    continue;
  }
  const [, jsonPath, modelName] = modelNameMatch;

  let targetPrefix: string | undefined;
  try {
    const modelJson = JSON.parse(
      await readFile(join(modelsDir, `${modelName}.json`), "utf-8"),
    ) as { metadata?: { targetPrefix?: string } };
    targetPrefix = modelJson.metadata?.targetPrefix;
  } catch {
    // no file
  }

  const wrongPattern = new RegExp(
    `const model = lazyServiceModel\\(\\(\\) => import\\("${jsonPath.replace(/\//g, "\\/").replace(/\./g, "\\.")}", \\{ with: \\{ type: "json" \\} \\},\\n  \\{ targetPrefix: "[^"]*" \\}\\n\\);`,
    "m",
  );

  const hasWrong = wrongPattern.test(src);

  const correctPattern = new RegExp(
    `const model = lazyServiceModel\\(\\n  \\(\\) => import\\("${jsonPath.replace(/\//g, "\\/").replace(/\./g, "\\.")}", \\{ with: \\{ type: "json" \\} \\}\\),\\n  \\{ targetPrefix: "[^"]*" \\}\\n\\);`,
    "m",
  );

  const noMetaPattern = new RegExp(
    `const model = lazyServiceModel\\(\\(\\) => import\\("${jsonPath.replace(/\//g, "\\/").replace(/\./g, "\\.")}", \\{ with: \\{ type: "json" \\} \\}\\)\\);`,
    "m",
  );

  if (correctPattern.test(src)) {
    already++;
    continue;
  }

  let out = src;

  if (hasWrong) {
    out = out.replace(
      wrongPattern,
      targetPrefix !== undefined
        ? `const model = lazyServiceModel(\n  () => import("${jsonPath}", { with: { type: "json" } }),\n  { targetPrefix: "${targetPrefix}" }\n);`
        : `const model = lazyServiceModel(() => import("${jsonPath}", { with: { type: "json" } }));`,
    );
    await writeFile(path, out, "utf-8");
    fixed++;
  } else if (noMetaPattern.test(src) && targetPrefix !== undefined) {
    out = out.replace(
      noMetaPattern,
      `const model = lazyServiceModel(\n  () => import("${jsonPath}", { with: { type: "json" } }),\n  { targetPrefix: "${targetPrefix}" }\n);`,
    );
    await writeFile(path, out, "utf-8");
    fixed++;
  } else {
    already++;
  }
}

console.log(
  `fixed: ${fixed}, already correct: ${already}, skipped: ${skipped}`,
);
