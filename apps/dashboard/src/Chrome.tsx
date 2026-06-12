import { useRef, useState } from "react";
import type { ServiceSummary } from "./api";
import { Ico, Popover, StatusDot } from "./shared";
import type { Screen, Theme } from "./types";

type Scope = { account: string; region: string };

const fmtUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const monitorNavItems = [
  { id: "overview", label: "Overview", ico: Ico.overview },
  { id: "log", label: "Request Log", ico: Ico.log },
  { id: "resources", label: "Resource Browser", ico: Ico.browser },
  { id: "snapshots", label: "Snapshots", ico: Ico.snapshot },
] as const;

const configureNavItems = [
  { id: "settings", label: "Settings", ico: Ico.settings },
] as const;

const screenTitles: Record<Screen, string> = {
  overview: "Overview",
  log: "Request Log",
  resources: "Resource Browser",
  snapshots: "State Snapshots",
  settings: "Settings",
} as const;

export function Sidebar({
  screen,
  setScreen,
  services,
  logCount,
  resourceCount,
  snapshotCount,
  connected,
  endpoint,
  uptimeSeconds,
  version,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
  services: ServiceSummary[];
  logCount: number;
  resourceCount: number;
  snapshotCount: number;
  connected: boolean;
  endpoint: string;
  uptimeSeconds?: number;
  version?: string;
}) {
  const stackState = !connected
    ? "idle"
    : services.some((s) => s.callCount > 0)
      ? "running"
      : "idle";
  const stackLabel = !connected ? "停止" : "稼働中";
  const stackSub = !connected ? "Stack not reachable" : "All services healthy";
  const counts: Record<Screen, number | null> = {
    overview: null,
    log: logCount || null,
    resources: resourceCount || null,
    snapshots: snapshotCount || null,
    settings: null,
  };
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="bunsai"
          >
            <rect
              x="3.6"
              y="3.6"
              width="11"
              height="11"
              rx="2.6"
              fill="currentColor"
              opacity="0.5"
            />
            <rect
              x="9.4"
              y="9.4"
              width="11"
              height="11"
              rx="2.6"
              fill="currentColor"
            />
            <rect
              x="12.7"
              y="12.7"
              width="4.4"
              height="4.4"
              rx="1.1"
              fill="var(--primary)"
            />
          </svg>
        </div>
        <div>
          <div className="brand-name">bunsai</div>
          <div className="brand-tag">local AWS emulator</div>
        </div>
      </div>

      <div className="stack-status">
        <div className="row1">
          <StatusDot state={stackState} pulse={stackState === "running"} lg />
          <span className="stack-state-label">{stackLabel}</span>
          <span style={{ flex: 1 }} />
          <span className="uppercase-label" style={{ fontSize: 9.5 }}>
            STACK
          </span>
        </div>
        <div className="stack-endpoint">
          <span className="lbl">listening</span>
          <span style={{ color: "var(--ink)" }}>{endpoint}</span>
        </div>
        <div className="stack-meta">
          <div>
            <div className="k">Status</div>
            <div className="v">{stackSub}</div>
          </div>
          <div>
            <div className="k">Services</div>
            <div className="v">{services.length}</div>
          </div>
          {uptimeSeconds !== undefined && (
            <div>
              <div className="k">Uptime</div>
              <div className="v">{fmtUptime(uptimeSeconds)}</div>
            </div>
          )}
        </div>
      </div>

      <nav className="nav">
        <div className="nav-group-label uppercase-label">Monitor</div>
        {monitorNavItems.map((n) => (
          <button
            key={n.id}
            className={`nav-item${screen === n.id ? " active" : ""}`}
            onClick={() => setScreen(n.id)}
            aria-current={screen === n.id ? "page" : undefined}
          >
            <n.ico className="ico" />
            <span className="label">{n.label}</span>
            {counts[n.id] != null && (
              <span className="count mono">{counts[n.id]}</span>
            )}
          </button>
        ))}
        <div
          className="nav-group-label uppercase-label"
          style={{ marginTop: 8 }}
        >
          Configure
        </div>
        {configureNavItems.map((n) => (
          <button
            key={n.id}
            className={`nav-item${screen === n.id ? " active" : ""}`}
            onClick={() => setScreen(n.id)}
            aria-current={screen === n.id ? "page" : undefined}
          >
            <n.ico className="ico" />
            <span className="label">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="mono">bunsai{version ? ` v${version}` : ""}</span>
        <span
          className="mono"
          style={{ color: connected ? "var(--teal)" : "var(--muted-soft)" }}
        >
          ● {connected ? "connected" : "offline"}
        </span>
      </div>
    </aside>
  );
}

function ScopeSeg({
  k,
  v,
  options,
  onPick,
}: {
  k: string;
  v: string;
  options: string[];
  onPick: (o: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="scope-seg"
        ref={ref}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <div className="k">{k}</div>
          <div className="v">{v}</div>
        </div>
        <Ico.caret className="caret" width="13" height="13" />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)}>
          <div className="grp uppercase-label">{k}</div>
          {options.length === 0 && <div className="opt muted">該当なし</div>}
          {options.map((o) => (
            <button
              key={o}
              className={`opt${o === v ? " sel" : ""}`}
              onClick={() => {
                onPick(o);
                setOpen(false);
              }}
            >
              <span className="mono" style={{ fontSize: 12 }}>
                {o}
              </span>
              {o === v && <Ico.check className="chk" width="15" height="15" />}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}

export function GlobalBar({
  screen,
  scope,
  setScope,
  theme,
  setTheme,
  accounts,
  regions,
}: {
  screen: Screen;
  scope: Scope;
  setScope: (s: Scope) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  accounts: string[];
  regions: string[];
}) {
  return (
    <header className="globalbar">
      <div className="gb-title">
        <span className="h">{screenTitles[screen]}</span>
      </div>
      <div className="gb-spacer" />

      <div className="scope-selector">
        <ScopeSeg
          k="account"
          v={scope.account}
          options={accounts}
          onPick={(v) => setScope({ ...scope, account: v })}
        />
        <ScopeSeg
          k="region"
          v={scope.region}
          options={regions}
          onPick={(v) => setScope({ ...scope, region: v })}
        />
      </div>

      <button
        className="icon-btn"
        aria-label={
          theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
        }
        aria-pressed={theme === "dark"}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? (
          <Ico.sun width="18" height="18" />
        ) : (
          <Ico.moon width="18" height="18" />
        )}
      </button>
    </header>
  );
}
