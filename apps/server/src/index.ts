import { createBunsaiServers } from "./server.ts";
import dashboard from "./dashboard/index.html";

const { server } = createBunsaiServers({
  port: Number(Bun.env.BUNSAI_PORT ?? 4566),
  dashboard,
  hmr: Bun.env.NODE_ENV !== "production",
});

console.log(`bunsai listening on ${server.url}`);
console.log(
  `  AWS gateway:    POST/GET ${server.url} (any signed AWS request)`,
);
console.log(`  Management API: ${server.url}__bunsai/*`);
console.log(`  Dashboard:      ${server.url}__dashboard/`);
