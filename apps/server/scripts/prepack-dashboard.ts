import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const here = new URL("./", import.meta.url).pathname;
const serverRoot = resolve(here, "..");
const dashboardSrc = resolve(serverRoot, "../dashboard/src");
const frontendDest = resolve(serverRoot, "src/dashboard-frontend");
const html = resolve(serverRoot, "src/dashboard/index.html");

if (!existsSync(dashboardSrc)) {
  throw new Error(`dashboard source not found: ${dashboardSrc}`);
}

cpSync(dashboardSrc, frontendDest, { recursive: true, force: true });

const original = await Bun.file(html).text();
const devSrc =
  '<script type="module" src="../../../dashboard/src/frontend.tsx"></script>';
const packedSrc =
  '<script type="module" src="../dashboard-frontend/frontend.tsx"></script>';

if (!original.includes(devSrc) && !original.includes(packedSrc)) {
  throw new Error(`expected dashboard <script> tag not found in ${html}`);
}

const rewritten = original.includes(devSrc)
  ? original.replace(devSrc, packedSrc)
  : original;

if (rewritten !== original) await Bun.write(html, rewritten);

console.log(`prepack: dashboard bundled into ${frontendDest}`);
