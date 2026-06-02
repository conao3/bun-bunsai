import { listLogs, subscribeLog } from "../core/log.ts";
import type { RequestLog } from "../core/log.ts";
import { countCallsByService } from "../core/log.ts";
import { countResources, enumerateResources } from "../core/state.ts";
import type { StateStore } from "../core/state.ts";
import { services } from "../services/index.ts";

export type ManagementDeps = {
  store: StateStore;
  log: RequestLog;
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

export const handleManagement = (
  req: Request,
  url: URL,
  deps: ManagementDeps,
): Response | undefined => {
  if (!url.pathname.startsWith("/__bunsai/")) return undefined;

  if (url.pathname === "/__bunsai/services" && req.method === "GET") {
    return json(
      services.map((service) => ({
        name: service.name,
        protocol: service.protocol,
        status: "available" as const,
        resourceCount: countResources(deps.store, service.name),
        callCount: countCallsByService(deps.log, service.name),
      })),
    );
  }

  if (url.pathname === "/__bunsai/resources" && req.method === "GET") {
    const filter = url.searchParams.get("service") ?? undefined;
    return json(enumerateResources(deps.store, filter));
  }

  if (url.pathname === "/__bunsai/logs" && req.method === "GET") {
    return json(listLogs(deps.log));
  }

  if (url.pathname === "/__bunsai/logs/stream" && req.method === "GET") {
    const encoder = new TextEncoder();
    let unsubscribe = () => {};
    const stream = new ReadableStream({
      start(controller) {
        for (const entry of listLogs(deps.log)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(entry)}\n\n`),
          );
        }
        unsubscribe = subscribeLog(deps.log, (entry) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(entry)}\n\n`),
          );
        });
      },
      cancel() {
        unsubscribe();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  }

  return json(
    { code: "NotFound", message: `Unknown management route ${url.pathname}` },
    404,
  );
};
