import { afterAll } from "bun:test";
import { createBunsaiServers } from "../../apps/server/src/server.ts";

export type TestServer = {
  endpoint: string;
  uiEndpoint: string;
};

export function startServer(): TestServer {
  const { awsServer, uiServer } = createBunsaiServers({
    awsPort: 0,
    uiPort: 0,
  });
  afterAll(() => {
    awsServer.stop(true);
    uiServer.stop(true);
  });
  return {
    endpoint: `http://localhost:${awsServer.port}`,
    uiEndpoint: `http://localhost:${uiServer.port}`,
  };
}
