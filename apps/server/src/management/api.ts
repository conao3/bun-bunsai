import { listLogs, subscribeLog } from "../core/log.ts";
import type { RequestLog } from "../core/log.ts";
import { countCallsByService } from "../core/log.ts";
import {
  countResources,
  dumpState,
  enumerateResources,
  restoreState,
} from "../core/state.ts";
import type { StateSnapshot, StateStore } from "../core/state.ts";
import { services } from "../services/index.ts";

export type SnapshotMeta = {
  id: string;
  name: string;
  createdAt: string;
  services: string[];
  entryCount: number;
  sizeBytes: number;
};

type SnapshotEntry = {
  meta: SnapshotMeta;
  data: StateSnapshot;
};

export type SnapshotRegistry = SnapshotEntry[];

export const createSnapshotRegistry = (): SnapshotRegistry => [];

export type ManagementDeps = {
  store: StateStore;
  log: RequestLog;
  snapshots: SnapshotRegistry;
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const snapshotMeta = (
  data: StateSnapshot,
  id: string,
  name: string,
): SnapshotMeta => {
  const serviceSet = new Set<string>();
  let entryCount = 0;
  const plain: Record<string, Record<string, unknown>> = {};
  for (const [key, bucket] of data.entries()) {
    const parts = key.split("/");
    if (parts[2]) serviceSet.add(parts[2]);
    entryCount += bucket.size;
    plain[key] = Object.fromEntries(bucket.entries());
  }
  const sizeBytes = new TextEncoder().encode(JSON.stringify(plain)).length;
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    services: [...serviceSet].sort(),
    entryCount,
    sizeBytes,
  };
};

const defaultName = (): string => {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  return `snapshot-${hh}${mm}${ss}`;
};

const snapshotsPath = "/__bunsai/snapshots";

export const handleManagement = async (
  req: Request,
  url: URL,
  deps: ManagementDeps,
): Promise<Response | undefined> => {
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

  if (url.pathname === snapshotsPath && req.method === "POST") {
    const body = (await req.json().catch(() => ({}))) as { name?: string };
    const id = crypto.randomUUID();
    const name = body.name ?? defaultName();
    const data = dumpState(deps.store);
    const meta = snapshotMeta(data, id, name);
    deps.snapshots.push({ meta, data });
    return json(meta, 201);
  }

  if (url.pathname === snapshotsPath && req.method === "GET") {
    return json(deps.snapshots.map((e) => e.meta));
  }

  if (url.pathname.startsWith(snapshotsPath + "/")) {
    const rest = url.pathname.slice(snapshotsPath.length + 1);
    const [id, ...parts] = rest.split("/");

    if (parts.length === 0 && req.method === "DELETE") {
      const idx = deps.snapshots.findIndex((e) => e.meta.id === id);
      if (idx === -1)
        return json(
          { code: "NotFound", message: `Snapshot ${id} not found` },
          404,
        );
      deps.snapshots.splice(idx, 1);
      return new Response(null, { status: 204 });
    }

    if (parts[0] === "restore" && req.method === "POST") {
      const entry = deps.snapshots.find((e) => e.meta.id === id);
      if (entry === undefined)
        return json(
          { code: "NotFound", message: `Snapshot ${id} not found` },
          404,
        );
      restoreState(deps.store, entry.data);
      return json(entry.meta);
    }
  }

  return json(
    { code: "NotFound", message: `Unknown management route ${url.pathname}` },
    404,
  );
};
