import { useCallback, useEffect, useRef, useState } from "react";
import type { ServiceSummary, SnapshotMeta } from "./api";
import { createSnapshot } from "./api";
import { Ico, ProtoBadge, ServiceTag, svcInfo } from "./shared";
import type { Density, LogLayout, Theme } from "./types";
import { buildSnapshotPath, router } from "./router";

type Scope = { account: string; region: string };

type Tab = "general" | "services" | "scope" | "persistence";

export const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "services", label: "Services" },
  { id: "scope", label: "Scope" },
  { id: "persistence", label: "Persistence" },
];

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      next = (idx - 1 + tabs.length) % tabs.length;
    else return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next].id);
  };

  return (
    <div role="tablist" className="settings-tablist">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`settings-tab${active === t.id ? " on" : ""}`}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          tabIndex={active === t.id ? 0 : -1}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function GeneralTab({
  theme,
  setTheme,
  density,
  setDensity,
  logLayout,
  setLogLayout,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  logLayout: LogLayout;
  setLogLayout: (l: LogLayout) => void;
}) {
  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">Listening Port</div>
          <div className="settings-label-sub">
            Set via <span className="mono">BUNSAI_PORT</span> at startup
          </div>
        </div>
        <span className="mono settings-value-ro">4566</span>
      </div>
      <div className="settings-sep" />
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">Theme</div>
        </div>
        <div className="segmented">
          <button
            className={theme === "dark" ? "on" : ""}
            onClick={() => setTheme("dark")}
            aria-pressed={theme === "dark"}
          >
            <Ico.moon width="13" height="13" />
            Dark
          </button>
          <button
            className={theme === "light" ? "on" : ""}
            onClick={() => setTheme("light")}
            aria-pressed={theme === "light"}
          >
            <Ico.sun width="13" height="13" />
            Light
          </button>
        </div>
      </div>
      <div className="settings-sep" />
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">情報密度</div>
        </div>
        <div className="segmented">
          <button
            className={density === "compact" ? "on" : ""}
            onClick={() => setDensity("compact")}
            aria-pressed={density === "compact"}
          >
            コンパクト
          </button>
          <button
            className={density === "spacious" ? "on" : ""}
            onClick={() => setDensity("spacious")}
            aria-pressed={density === "spacious"}
          >
            ゆったり
          </button>
        </div>
      </div>
      <div className="settings-sep" />
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">Request Log 詳細の表示位置</div>
        </div>
        <div className="segmented">
          <button
            className={logLayout === "drawer" ? "on" : ""}
            onClick={() => setLogLayout("drawer")}
            aria-pressed={logLayout === "drawer"}
          >
            右ドロワー
          </button>
          <button
            className={logLayout === "bottom" ? "on" : ""}
            onClick={() => setLogLayout("bottom")}
            aria-pressed={logLayout === "bottom"}
          >
            下部パネル
          </button>
        </div>
      </div>
    </div>
  );
}

function ScopeTab({
  scope,
  setScope,
  accounts,
  regions,
}: {
  scope: Scope;
  setScope: (s: Scope) => void;
  accounts: string[];
  regions: string[];
}) {
  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">Default Account</div>
        </div>
        <select
          className="settings-select mono"
          value={scope.account}
          onChange={(e) => setScope({ ...scope, account: e.target.value })}
        >
          {accounts.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="settings-sep" />
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">Default Region</div>
        </div>
        <select
          className="settings-select mono"
          value={scope.region}
          onChange={(e) => setScope({ ...scope, region: e.target.value })}
        >
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function snapshotCountText(count: number): string {
  return count === 0
    ? "保存済みスナップショットはありません"
    : `${count} 件のスナップショット`;
}

function snapshotName(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `snapshot-${hh}${mm}${ss}`;
}

function PersistenceTab({
  snapshots,
  onRefresh,
}: {
  snapshots: SnapshotMeta[];
  onRefresh: () => void;
}) {
  const [dumping, setDumping] = useState(false);

  const handleDump = () => {
    setDumping(true);
    createSnapshot(snapshotName())
      .then(() => onRefresh())
      .catch(() => {})
      .finally(() => setDumping(false));
  };

  return (
    <div className="settings-section">
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">Dump Destination</div>
        </div>
        <span className="settings-value-ro">ブラウザダウンロード</span>
      </div>
      <div className="settings-sep" />
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">スナップショット作成</div>
          <div className="settings-label-sub">現在の状態を保存します</div>
        </div>
        <button
          className="btn btn-secondary"
          onClick={handleDump}
          disabled={dumping}
        >
          {dumping ? "ダンプ中…" : "今すぐダンプ"}
        </button>
      </div>
      <div className="settings-sep" />
      <div className="settings-row">
        <div className="settings-label">
          <div className="settings-label-title">スナップショット管理</div>
          <div className="settings-label-sub">
            {snapshotCountText(snapshots.length)}
          </div>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => router.push(buildSnapshotPath())}
        >
          管理ページへ
        </button>
      </div>
    </div>
  );
}

function ServicesTab({ services }: { services: ServiceSummary[] }) {
  if (services.length === 0) {
    return (
      <div className="settings-empty">
        <span className="muted">No services available</span>
      </div>
    );
  }
  return (
    <div className="settings-svc-table-wrap">
      <table className="settings-svc-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Name</th>
            <th>Protocol</th>
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.name}>
              <td>
                <ServiceTag svc={svc.name} />
              </td>
              <td className="mono">{svcInfo(svc.name).name}</td>
              <td>
                <ProtoBadge protocol={svc.protocol} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Settings({
  theme,
  setTheme,
  density,
  setDensity,
  logLayout,
  setLogLayout,
  scope,
  setScope,
  accounts,
  regions,
  services,
  snapshots,
  onRefresh,
}: {
  theme: Theme;
  setTheme: (t: Theme) => void;
  density: Density;
  setDensity: (d: Density) => void;
  logLayout: LogLayout;
  setLogLayout: (l: LogLayout) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
  accounts: string[];
  regions: string[];
  services: ServiceSummary[];
  snapshots: SnapshotMeta[];
  onRefresh: () => void;
}) {
  const getTabFromQuery = useCallback((): Tab => {
    const q = new URLSearchParams(location.search).get("tab");
    if (q === "scope" || q === "services" || q === "persistence") return q;
    return "general";
  }, []);

  const [activeTab, setActiveTab] = useState<Tab>(getTabFromQuery);

  useEffect(() => {
    const handler = () => setActiveTab(getTabFromQuery());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [getTabFromQuery]);

  const handleTabChange = (t: Tab) => {
    setActiveTab(t);
    const next = new URLSearchParams(location.search);
    if (t === "general") next.delete("tab");
    else next.set("tab", t);
    const url = next.size ? `${location.pathname}?${next}` : location.pathname;
    history.replaceState(history.state, "", url);
  };

  return (
    <div className="settings-screen">
      <TabBar active={activeTab} onChange={handleTabChange} />
      <div className="settings-body">
        {activeTab === "general" && (
          <GeneralTab
            theme={theme}
            setTheme={setTheme}
            density={density}
            setDensity={setDensity}
            logLayout={logLayout}
            setLogLayout={setLogLayout}
          />
        )}
        {activeTab === "scope" && (
          <ScopeTab
            scope={scope}
            setScope={setScope}
            accounts={accounts}
            regions={regions}
          />
        )}
        {activeTab === "services" && <ServicesTab services={services} />}
        {activeTab === "persistence" && (
          <PersistenceTab snapshots={snapshots} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
}
