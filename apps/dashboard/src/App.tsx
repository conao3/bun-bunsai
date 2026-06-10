import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type { RequestLogEntry, ResourceEntry, ServiceSummary } from "./api";
import { fetchLogs, fetchResources, fetchServices, openLogStream } from "./api";
import { GlobalBar, Sidebar } from "./Chrome";
import { Overview } from "./Overview";
import { RequestLog, statusFilters } from "./RequestLog";
import type { StatusFilter } from "./RequestLog";
import { ResourceBrowser } from "./ResourceBrowser";
import {
  buildLogPath,
  buildResourcePath,
  parseRoute,
  router,
  useLocation,
  withQuery,
} from "./router";
import type { Screen, Theme } from "./types";

type Scope = { account: string; region: string };

const endpoint = "http://localhost:4566" as const;
const defaultScope: Scope = { account: "000000000000", region: "us-east-1" };
const maxLogs = 600 as const;

const ls = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(`bunsai.${key}`);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`bunsai.${key}`, JSON.stringify(value));
    } catch {
      return;
    }
  },
} as const;

export function App() {
  const loc = useLocation();
  const route = parseRoute(loc.path);

  const [theme, setThemeState] = useState<Theme>(() =>
    ls.get<Theme>("theme", "dark"),
  );
  const [live, setLive] = useState(true);

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [resourceToken, setResourceToken] = useState(0);

  const liveRef = useRef(live);
  liveRef.current = live;

  const screen: Screen = route ? route.screen : "log";
  const selId = route && route.screen === "log" ? route.requestId : null;
  const sel = route && route.screen === "resources" ? route.sel : null;

  const scope: Scope = useMemo(() => {
    const stored = ls.get<Scope>("scope", { ...defaultScope });
    return {
      account: loc.query.get("account") ?? stored.account,
      region: loc.query.get("region") ?? stored.region,
    };
  }, [loc.query]);

  const setTheme = useCallback((v: Theme) => {
    setThemeState(v);
    ls.set("theme", v);
  }, []);

  const setScreen = useCallback(
    (v: Screen) => {
      const path =
        v === "overview"
          ? "/overview"
          : v === "resources"
            ? buildResourcePath(null)
            : buildLogPath(null);
      const url = withQuery(path, loc.query);
      if (url === router.getSnapshot()) return;
      router.push(url);
    },
    [loc.query],
  );

  const setScope = useCallback(
    (v: Scope) => {
      ls.set("scope", v);
      const next = new URLSearchParams(loc.query);
      next.set("account", v.account);
      next.set("region", v.region);
      router.replace(withQuery(loc.path, next));
    },
    [loc.query, loc.path],
  );

  const setSelId = useCallback(
    (id: string | null) => {
      if (id === null)
        router.closeDrawer(withQuery(buildLogPath(null), loc.query));
      else if (selId !== null)
        router.replace(withQuery(buildLogPath(id), loc.query));
      else router.push(withQuery(buildLogPath(id), loc.query));
    },
    [loc.query, selId],
  );

  const setSel = useCallback(
    (next: { service: string; key: string } | null, replace?: boolean) => {
      const url = withQuery(buildResourcePath(next), loc.query);
      if (replace) router.replace(url);
      else router.push(url);
    },
    [loc.query],
  );

  const setQuery = useCallback(
    (key: string, value: string | null, replace?: boolean) => {
      const next = new URLSearchParams(loc.query);
      if (value) next.set(key, value);
      else next.delete(key);
      const url = withQuery(loc.path, next);
      if (replace) router.replace(url);
      else router.push(url);
    },
    [loc.query, loc.path],
  );

  useEffect(() => {
    const path = route === null || loc.path === "/" ? "/log" : loc.path;
    const next = new URLSearchParams(loc.query);
    if (!next.has("account")) next.set("account", scope.account);
    if (!next.has("region")) next.set("region", scope.region);
    const url = withQuery(path, next);
    if (url !== router.getSnapshot()) router.replace(url);
  }, [route, loc.path, loc.query, scope.account, scope.region]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.setAttribute("data-density", "compact");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchServices().then((s) => {
        if (!cancelled) {
          setServices(s);
          setConnected(true);
        }
      });
      void fetchResources().then((r) => {
        if (!cancelled) setResources(r);
      });
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLogs().then((rows) => {
      if (!cancelled && rows.length) setRequests(rows.slice(-maxLogs));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const close = openLogStream(
      (entry) => {
        if (!liveRef.current) return;
        setConnected(true);
        setRequests((prev) => {
          if (prev.some((r) => r.id === entry.id)) return prev;
          const next = [...prev, entry];
          return next.length > maxLogs
            ? next.slice(next.length - maxLogs)
            : next;
        });
      },
      () => {},
    );
    return close;
  }, []);

  const clearRequests = useCallback(() => setRequests([]), []);

  useEffect(() => {
    setResourceToken((t) => t + 1);
  }, [resources.length]);

  const accounts = useMemo(() => {
    const set = new Set<string>([scope.account, defaultScope.account]);
    for (const r of resources) set.add(r.account);
    for (const r of requests) set.add(r.account);
    return [...set].sort();
  }, [resources, requests, scope.account]);

  const regions = useMemo(() => {
    const set = new Set<string>([scope.region, defaultScope.region]);
    for (const r of resources) set.add(r.region);
    for (const r of requests) set.add(r.region);
    return [...set].sort();
  }, [resources, requests, scope.region]);

  const scopedResourceCount = useMemo(
    () =>
      resources.filter(
        (r) => r.account === scope.account && r.region === scope.region,
      ).length,
    [resources, scope],
  );

  const svcFilter = useMemo(() => {
    const raw = loc.query.get("svc");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [loc.query]);
  const statusFilter = statusFilters.includes(
    loc.query.get("status") as StatusFilter,
  )
    ? (loc.query.get("status") as StatusFilter)
    : "all";
  const q = loc.query.get("q") ?? "";

  const onSvcFilter = useCallback(
    (next: string[]) =>
      setQuery("svc", next.length ? next.join(",") : null, true),
    [setQuery],
  );
  const onStatusFilter = useCallback(
    (next: string) => setQuery("status", next === "all" ? null : next, true),
    [setQuery],
  );
  const onQ = useCallback(
    (next: string) => setQuery("q", next || null, true),
    [setQuery],
  );

  return (
    <div className="app">
      <Sidebar
        screen={screen}
        setScreen={setScreen}
        services={services}
        logCount={requests.length}
        resourceCount={scopedResourceCount}
        connected={connected}
        endpoint={endpoint}
      />
      <div className="main">
        <GlobalBar
          screen={screen}
          scope={scope}
          setScope={setScope}
          theme={theme}
          setTheme={setTheme}
          accounts={accounts}
          regions={regions}
        />

        {screen === "overview" && (
          <Overview
            services={services}
            requests={requests}
            setScreen={setScreen}
            connected={connected}
          />
        )}
        {screen === "log" && (
          <RequestLog
            requests={requests}
            live={live}
            setLive={setLive}
            clearRequests={clearRequests}
            connected={connected}
            selId={selId}
            onSelect={setSelId}
            svcFilter={svcFilter}
            onSvcFilter={onSvcFilter}
            statusFilter={statusFilter}
            onStatusFilter={onStatusFilter}
            q={q}
            onQ={onQ}
          />
        )}
        {screen === "resources" && (
          <ResourceBrowser
            scope={scope}
            connected={connected}
            refreshToken={resourceToken}
            sel={sel}
            onSelect={setSel}
          />
        )}
      </div>
    </div>
  );
}
