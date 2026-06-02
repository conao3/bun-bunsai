import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type { RequestLogEntry, ResourceEntry, ServiceSummary } from "./api";
import { fetchLogs, fetchResources, fetchServices, openLogStream } from "./api";
import { GlobalBar, Sidebar } from "./Chrome";
import { Overview } from "./Overview";
import { RequestLog } from "./RequestLog";
import { ResourceBrowser } from "./ResourceBrowser";
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
  const [theme, setThemeState] = useState<Theme>(() =>
    ls.get<Theme>("theme", "dark"),
  );
  const [screen, setScreenState] = useState<Screen>(() =>
    ls.get<Screen>("screen", "log"),
  );
  const [scope, setScopeState] = useState<Scope>(() =>
    ls.get<Scope>("scope", { ...defaultScope }),
  );
  const [live, setLive] = useState(true);

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [requests, setRequests] = useState<RequestLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [resourceToken, setResourceToken] = useState(0);

  const liveRef = useRef(live);
  liveRef.current = live;

  const setTheme = useCallback((v: Theme) => {
    setThemeState(v);
    ls.set("theme", v);
  }, []);
  const setScreen = useCallback((v: Screen) => {
    setScreenState(v);
    ls.set("screen", v);
  }, []);
  const setScope = useCallback((v: Scope) => {
    setScopeState(v);
    ls.set("scope", v);
  }, []);

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
          />
        )}
        {screen === "resources" && (
          <ResourceBrowser
            scope={scope}
            connected={connected}
            refreshToken={resourceToken}
          />
        )}
      </div>
    </div>
  );
}
