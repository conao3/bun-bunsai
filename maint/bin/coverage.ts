import { readdirSync } from "fs";
import { loadOps } from "./ops.ts";

const dir = "apps/server/src/services";
const files = readdirSync(dir).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts",
);

type Row = { file: string; impl: number; total: number; pct: number };
const rows: Row[] = [];
for (const f of files) {
  const name = f.replace(".ts", "");
  const { all, impl } = loadOps(name);
  const total = all.length;
  const implCount = impl.size;
  const pct = total ? Math.round((implCount / total) * 100) : 0;
  rows.push({ file: name, impl: implCount, total, pct });
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
