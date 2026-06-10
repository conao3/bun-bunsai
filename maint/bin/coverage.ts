import { readdirSync, readFileSync } from "fs";
const dir = "apps/server/src/services";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts",
);
type Row = { file: string; impl: number; total: number; pct: number };
const rows: Row[] = [];
for (const f of files) {
  const src = readFileSync(`${dir}/${f}`, "utf8");
  const importMatch = src.match(
    /import\s+\w+\s+from\s+["']([^"']*aws-models[^"']*)["']/,
  );
  let total = 0;
  if (importMatch) {
    try {
      const modelPath = importMatch[1].replace(
        /^.*aws-models\//,
        "test/vendor/aws-models/",
      );
      const model = JSON.parse(readFileSync(modelPath, "utf8"));
      total = Object.keys(model.operations || {}).length;
    } catch {}
  }
  // operations block is the LAST "operations: {" ... matching close
  const idx = src.lastIndexOf("operations:");
  let impl = 0;
  if (idx >= 0) {
    const after = src.slice(idx);
    const open = after.indexOf("{");
    // find matching brace
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
    const matches = block.match(/^\s*([A-Z]\w+)\s*[,:]/gm);
    impl = matches ? matches.length : 0;
  }
  const pct = total ? Math.round((impl / total) * 100) : 0;
  rows.push({ file: f.replace(".ts", ""), impl, total, pct });
}
rows.sort((a, b) => b.total - b.impl - (a.total - a.impl));
let totImpl = 0,
  totTotal = 0;
for (const r of rows) {
  totImpl += r.impl;
  totTotal += r.total;
}
console.log("service                 impl/total  pct   gap");
for (const r of rows)
  console.log(
    `${r.file.padEnd(24)} ${String(r.impl).padStart(3)}/${String(r.total).padStart(3)}   ${String(r.pct).padStart(3)}%  ${r.total - r.impl}`,
  );
console.log(
  `\nTOTAL ${totImpl}/${totTotal} = ${((totImpl / totTotal) * 100).toFixed(1)}%`,
);
