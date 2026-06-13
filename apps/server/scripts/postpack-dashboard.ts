import { rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const here = new URL("./", import.meta.url).pathname;
const serverRoot = resolve(here, "..");
const frontendDest = resolve(serverRoot, "src/dashboard-frontend");
const html = resolve(serverRoot, "src/dashboard/index.html");

if (existsSync(frontendDest)) {
  rmSync(frontendDest, { recursive: true, force: true });
}

const original = await Bun.file(html).text();
const devSrc =
  '<script type="module" src="../../../dashboard/src/frontend.tsx"></script>';
const packedSrc =
  '<script type="module" src="../dashboard-frontend/frontend.tsx"></script>';

const restored = original.includes(packedSrc)
  ? original.replace(packedSrc, devSrc)
  : original;

if (restored !== original) await Bun.write(html, restored);

console.log("postpack: dashboard staging cleaned up");
