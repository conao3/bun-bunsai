import { existsSync, readFileSync } from "fs";

export type OpsResult = {
  modelPath: string | null;
  all: string[];
  impl: Set<string>;
  missing: string[];
};

export function loadOps(name: string): OpsResult {
  const src = readFileSync(`apps/server/src/services/${name}.ts`, "utf8");

  const importMatch = src.match(/from\s+["'][^"']*models\/([^"']+\.json)["']/);
  if (!importMatch) {
    return { modelPath: null, all: [], impl: new Set(), missing: [] };
  }

  const modelPath = `apps/server/models/${importMatch[1]}`;
  if (!existsSync(modelPath)) {
    return { modelPath, all: [], impl: new Set(), missing: [] };
  }

  const model = JSON.parse(readFileSync(modelPath, "utf8"));
  const all: string[] = Object.keys(model.operations || {}).map((k) =>
    k.replace(/^.*#/, ""),
  );

  const idx = src.lastIndexOf("operations:");
  if (idx < 0) {
    return { modelPath, all, impl: new Set(), missing: all };
  }

  const after = src.slice(idx);
  const open = after.indexOf("{");
  let depth = 0;
  let end = -1;
  for (let i = open; i < after.length; i++) {
    const c = after[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = after.slice(open + 1, end);
  const implRaw = new Set<string>(
    (block.match(/^\s*([A-Z]\w+)\s*[,:]/gm) || []).map((s) =>
      s.trim().replace(/[,:]$/, ""),
    ),
  );

  const impl = new Set<string>(all.filter((o) => implRaw.has(o)));
  const missing = all.filter((o) => !implRaw.has(o));

  return { modelPath, all, impl, missing };
}
