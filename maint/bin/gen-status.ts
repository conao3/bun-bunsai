import { readdirSync, readFileSync, writeFileSync } from "fs";

const SERVICES_DIR = "apps/server/src/services";
const E2E_DIR = "test/e2e";
const STATUS_FILE = "STATUS.md";

type Row = {
  name: string;
  protocol: string;
  impl: number;
  total: number;
  e2eFiles: number;
};

const serviceFiles = readdirSync(SERVICES_DIR).filter(
  (f) => f.endsWith(".ts") && f !== "index.ts" && !f.startsWith("_"),
);

const rows: Row[] = [];

for (const f of serviceFiles) {
  const name = f.replace(".ts", "");
  const src = readFileSync(`${SERVICES_DIR}/${f}`, "utf8");

  const importMatch = src.match(
    /import\s+\w+\s+from\s+["']([^"']*aws-models[^"']*)["']/,
  );
  let total = 0;
  let protocol = "-";
  if (importMatch) {
    try {
      const modelPath = importMatch[1].replace(
        /^.*aws-models\//,
        "test/vendor/aws-models/",
      );
      const model = JSON.parse(readFileSync(modelPath, "utf8"));
      total = Object.keys(model.operations || {}).length;
      protocol = (model.metadata?.protocol as string) || "-";
    } catch {}
  }

  const idx = src.lastIndexOf("operations:");
  let impl = 0;
  if (idx >= 0) {
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
    const matches = block.match(/^\s*([A-Z]\w+)\s*[,:]/gm);
    impl = matches ? matches.length : 0;
  }

  rows.push({ name, protocol, impl, total, e2eFiles: 0 });
}

const validRows = rows.filter((r) => r.total > 0);
const serviceNames = validRows.map((r) => r.name);

const e2eAll = readdirSync(E2E_DIR).filter((f) => f.endsWith(".test.ts"));
const scenarioFiles = e2eAll.filter((f) => f.endsWith("-scenario.test.ts"));

for (const ef of e2eAll) {
  const base = ef.replace(".test.ts", "");
  let best: string | null = null;
  for (const svc of serviceNames) {
    if (base === svc || base.startsWith(`${svc}-`)) {
      if (!best || svc.length > best.length) best = svc;
    }
  }
  if (best) {
    const row = validRows.find((r) => r.name === best)!;
    row.e2eFiles++;
  }
}

validRows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

const servicesAt100 = validRows.filter((r) => r.impl >= r.total).length;
const totalGap = validRows.reduce(
  (acc, r) => acc + Math.max(0, r.total - r.impl),
  0,
);
const uniqueProtocols = [
  ...new Set(validRows.map((r) => r.protocol).filter((p) => p !== "-")),
].sort();

function formatTable(headers: string[], data: string[][]): string {
  const allRows = [headers, ...data];
  const widths = headers.map((_, i) =>
    Math.max(3, ...allRows.map((r) => (r[i] || "").length)),
  );
  const pad = (s: string, n: number) => s + " ".repeat(n - s.length);
  const row2str = (r: string[]) =>
    "| " + r.map((c, i) => pad(c, widths[i])).join(" | ") + " |";
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  return [row2str(headers), sep, ...data.map(row2str)].join("\n");
}

const glanceData: string[][] = [
  ["Services registered", `**${validRows.length}**`],
  [
    "Wire protocols",
    `**${uniqueProtocols.length}** (${uniqueProtocols.join(", ")})`,
  ],
  ["Services at 100%", `**${servicesAt100} / ${validRows.length}**`],
  ["Unimplemented operations", `**${totalGap}**`],
  ["E2E test files", `**${e2eAll.length}**`],
  ["Scenario test files", `**${scenarioFiles.length}**`],
];

const serviceData = validRows.map((r) => [
  r.name,
  r.protocol,
  `${r.impl}/${r.total}`,
  String(r.e2eFiles),
]);

const content = `# bunsai — project status dashboard

> Generated snapshot — run \`bun maint/bin/gen-status.ts\` to regenerate.

## At a glance

${formatTable(["Metric", "Value"], glanceData)}

## Features

- **Management dashboard** — 5-screen web UI: Overview, Request Log, Resource Browser, Snapshots, Settings
- **State snapshots API** — capture and restore full server state via REST; available in tests and the dashboard
- **Parity harness** — replay recorded real-AWS responses against the mock to verify behavioral fidelity
- **Inter-service event routing** — cross-service event delivery (S3 → SNS, SNS → SQS, SQS/SNS → Lambda, EventBridge rules)

## Per-service coverage

Sorted by total modeled operations (descending). \`impl/total\` counts handler entries vs. modeled operations.

${formatTable(["Service", "Protocol", "Ops", "E2E files"], serviceData)}

---

_Models vendored verbatim from botocore 1.43.19 (Apache-2.0). Coverage figures count registered service handlers against the botocore operation set._
`;

writeFileSync(STATUS_FILE, content);
console.log(`Wrote ${STATUS_FILE}`);
