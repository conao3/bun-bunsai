import { dispatch } from "./core/framework.ts";
import { serializeError } from "./core/protocol.ts";
import { createRequestLog, recordLog } from "./core/log.ts";
import { buildParsedRequest, routeRequest } from "./core/router.ts";
import { createStateStore } from "./core/state.ts";
import type { Protocol } from "./core/types.ts";
import { handleManagement } from "./management/api.ts";
import { findService } from "./services/index.ts";

export function createBunsaiServers(options: {
  awsPort: number;
  uiPort: number;
  dashboard?: unknown;
  hmr?: boolean;
}) {
  const store = createStateStore();
  const log = createRequestLog();

  const awsServer = Bun.serve({
    port: options.awsPort,
    async fetch(req) {
      const start = performance.now();
      const url = new URL(req.url);
      const bodyText = await req.text();
      const route = routeRequest(req, url);
      const service =
        route.service === undefined ? undefined : findService(route.service);

      if (route.service === undefined || service === undefined) {
        const protocol: Protocol = "json";
        const error = {
          __awsError: true as const,
          code: "UnknownService",
          message: `Service '${route.service ?? "?"}' is not emulated by bunsai`,
          statusCode: 400,
        };
        const serialized = serializeError(protocol, error);
        recordLog(log, {
          service: route.service ?? "unknown",
          operation: route.target ?? "unknown",
          statusCode: error.statusCode,
          latencyMs: performance.now() - start,
          account: route.account,
          region: route.region,
          protocol: "unknown",
          requestBodyText: bodyText,
          responseBodyText: serialized.body,
        });
        return new Response(serialized.body, {
          status: error.statusCode,
          headers: { "content-type": serialized.contentType },
        });
      }

      const parsed = buildParsedRequest(
        req,
        url,
        bodyText,
        route,
        service.protocol,
      );
      const result = await dispatch(service, parsed, store);
      recordLog(log, {
        service: result.service,
        operation: result.operation,
        statusCode: result.statusCode,
        latencyMs: performance.now() - start,
        account: route.account,
        region: route.region,
        protocol: service.protocol,
        requestBodyText: bodyText,
        responseBodyText: result.body,
      });
      return new Response(result.body, {
        status: result.statusCode,
        headers: { "content-type": result.contentType, ...result.headers },
      });
    },
  });

  const management = (req: Request) => {
    const url = new URL(req.url);
    const managed = handleManagement(req, url, { store, log });
    return managed ?? new Response("not found", { status: 404 });
  };

  const uiServer = Bun.serve({
    port: options.uiPort,
    development: { hmr: options.hmr ?? false },
    routes:
      options.dashboard === undefined
        ? { "/__bunsai/*": management }
        : { "/__bunsai/*": management, "/*": options.dashboard },
  });

  return { awsServer, uiServer, store, log };
}
