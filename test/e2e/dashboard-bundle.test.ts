import { afterAll, expect, test } from "bun:test";
import { createBunsaiServers } from "../../apps/server/src/server.ts";
import dashboard from "../../apps/server/src/dashboard/index.html";

const devServers = createBunsaiServers({
  awsPort: 0,
  uiPort: 0,
  dashboard,
  hmr: true,
});

afterAll(() => {
  devServers.awsServer.stop(true);
  devServers.uiServer.stop(true);
});

async function fetchChunks(serverUrl: URL): Promise<string> {
  const res = await fetch(`${serverUrl}/`);
  expect(res.status).toBe(200);
  const html = await res.text();
  const srcs = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  expect(srcs.length).toBeGreaterThan(0);
  const texts = await Promise.all(
    srcs.map(async (src) => {
      const url = new URL(src, serverUrl).href;
      const r = await fetch(url);
      return r.ok ? r.text() : "";
    }),
  );
  return texts.join("\n");
}

test("dev bundle (hmr:true) contains jsxDEV", async () => {
  const js = await fetchChunks(devServers.uiServer.url);
  expect(js).toContain("jsxDEV");
});

test("production build (NODE_ENV=production) does not contain jsxDEV", async () => {
  const result = await Bun.build({
    entrypoints: ["apps/dashboard/src/frontend.tsx"],
    target: "browser",
    external: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    define: { "process.env.NODE_ENV": '"production"' },
  });
  expect(result.success).toBe(true);
  const jsOutputs = result.outputs.filter((o) => o.path.endsWith(".js"));
  expect(jsOutputs.length).toBeGreaterThan(0);
  for (const output of jsOutputs) {
    const text = await output.text();
    expect(text).not.toContain("jsxDEV");
  }
});
