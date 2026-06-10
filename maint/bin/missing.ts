import { readFileSync } from "fs";
const targets = process.argv.slice(2);
for (const name of targets) {
  const src = readFileSync(`apps/server/src/services/${name}.ts`, "utf8");
  const importMatch = src.match(
    /import\s+\w+\s+from\s+["']([^"']*aws-models[^"']*)["']/,
  );
  const modelPath = importMatch![1].replace(
    /^.*aws-models\//,
    "test/vendor/aws-models/",
  );
  const model = JSON.parse(readFileSync(modelPath, "utf8"));
  const all = Object.keys(model.operations || {}).map((k) =>
    k.replace(/^.*#/, ""),
  );
  const idx = src.lastIndexOf("operations:");
  const after = src.slice(idx);
  const open = after.indexOf("{");
  let depth = 0,
    end = -1;
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
  const impl = new Set(
    (block.match(/^\s*([A-Z]\w+)\s*[,:]/gm) || []).map((s) =>
      s.trim().replace(/[,:]$/, ""),
    ),
  );
  const missing = all.filter((o) => !impl.has(o));
  console.log(`\n### ${name} — missing ${missing.length}/${all.length}`);
  console.log(missing.join(", "));
}
