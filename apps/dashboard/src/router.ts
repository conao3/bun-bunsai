import { useMemo, useSyncExternalStore } from "react";

export type Loc = { path: string; query: URLSearchParams };

export type Route =
  | { screen: "overview" }
  | { screen: "log"; requestId: string | null }
  | { screen: "resources"; sel: { service: string; key: string } | null }
  | { screen: "snapshots" }
  | { screen: "settings" };

const listeners = new Set<() => void>();
let bound = false;

function emit(): void {
  for (const cb of listeners) cb();
}

function stateDepth(): number {
  return typeof history.state === "object" &&
    history.state !== null &&
    typeof (history.state as { d?: number }).d === "number"
    ? (history.state as { d: number }).d
    : 0;
}

export const router = {
  push(url: string): void {
    history.pushState({ d: stateDepth() + 1 }, "", url);
    emit();
  },
  replace(url: string): void {
    history.replaceState({ d: stateDepth() }, "", url);
    emit();
  },
  closeDrawer(listUrl: string): void {
    if (stateDepth() > 0) {
      history.back();
      return;
    }
    history.replaceState({ d: stateDepth() }, "", listUrl);
    emit();
  },
  subscribe(cb: () => void): () => void {
    if (!bound) {
      bound = true;
      window.addEventListener("popstate", emit);
    }
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  getSnapshot(): string {
    return `${location.pathname}${location.search}`;
  },
};

export function useLocation(): Loc {
  const snapshot = useSyncExternalStore(router.subscribe, router.getSnapshot);
  return useMemo(() => {
    const at = snapshot.indexOf("?");
    return at === -1
      ? { path: snapshot, query: new URLSearchParams() }
      : {
          path: snapshot.slice(0, at),
          query: new URLSearchParams(snapshot.slice(at + 1)),
        };
  }, [snapshot]);
}

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

export function parseRoute(path: string): Route | null {
  const seg = path.split("/").filter(Boolean);
  if (seg.length === 1 && seg[0] === "overview") return { screen: "overview" };
  if (seg.length === 1 && seg[0] === "log")
    return { screen: "log", requestId: null };
  if (seg.length === 2 && seg[0] === "log") {
    const requestId = safeDecode(seg[1]);
    return requestId === null ? null : { screen: "log", requestId };
  }
  if (seg.length === 1 && seg[0] === "resources")
    return { screen: "resources", sel: null };
  if (seg.length === 3 && seg[0] === "resources") {
    const service = safeDecode(seg[1]);
    const key = safeDecode(seg[2]);
    return service === null || key === null
      ? null
      : { screen: "resources", sel: { service, key } };
  }
  if (seg.length === 1 && seg[0] === "snapshots")
    return { screen: "snapshots" };
  if (seg.length === 1 && seg[0] === "settings") return { screen: "settings" };
  return null;
}

export function buildLogPath(requestId: string | null): string {
  return requestId ? `/log/${encodeURIComponent(requestId)}` : "/log";
}

export function buildResourcePath(
  sel: { service: string; key: string } | null,
): string {
  return sel
    ? `/resources/${encodeURIComponent(sel.service)}/${encodeURIComponent(sel.key)}`
    : "/resources";
}

export function buildSnapshotPath(): string {
  return "/snapshots";
}

export function buildSettingsPath(): string {
  return "/settings";
}

export function withQuery(path: string, query: URLSearchParams): string {
  return query.size ? `${path}?${query}` : path;
}
