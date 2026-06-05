import { createBunsaiServers } from "./server.ts";
import dashboard from "./dashboard/index.html";

const { awsServer, uiServer } = createBunsaiServers({
  awsPort: Number(Bun.env.BUNSAI_PORT ?? 4566),
  uiPort: Number(Bun.env.BUNSAI_UI_PORT ?? 5666),
  dashboard,
  hmr: Bun.env.NODE_ENV !== "production",
});

console.log(`bunsai aws gateway listening on ${awsServer.url}`);
console.log(`bunsai management+dashboard listening on ${uiServer.url}`);
