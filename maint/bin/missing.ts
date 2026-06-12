import { loadOps } from "./ops.ts";

const targets = process.argv.slice(2);
for (const name of targets) {
  const { all, missing } = loadOps(name);
  console.log(`\n### ${name} — missing ${missing.length}/${all.length}`);
  console.log(missing.join(", "));
}
