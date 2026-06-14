import type { ReactNode } from "react";
import type { RequestLogEntry, ServiceSummary } from "./api";
import { aggregateServices } from "./aggregateServices";
import { buildResourceSvcPath, router } from "./router";
import {
  EmptyState,
  Ico,
  ServiceTag,
  StatusChip,
  StatusDot,
  fmtLatency,
  fmtTime,
  svcInfo,
} from "./shared";
import type { Screen } from "./types";

function StatCard({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: string;
}) {
  return (
    <div className="stat-card">
      <div className="uppercase-label">{label}</div>
      <div
        className="stat-value serif"
        style={tone ? { color: `var(--${tone})` } : undefined}
      >
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function ServiceCard({
  svc,
  resCount,
  callCount,
  errCount,
  onOpen,
}: {
  svc: ServiceSummary;
  resCount: number;
  callCount: number;
  errCount: number;
  onOpen: () => void;
}) {
  const s = svcInfo(svc.name);
  const state = errCount > 0 ? "error" : "running";
  return (
    <button
      className={`svc-card${errCount > 0 ? " has-error" : ""}`}
      onClick={onOpen}
    >
      <div className="flex aic jcsb">
        <div className="flex aic gap10">
          <span
            className="svc-dot"
            style={{
              background: `color-mix(in srgb, ${s.color} 16%, transparent)`,
              color: s.color,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                display: "block",
              }}
            />
          </span>
          <div>
            <div className="svc-name">{s.name}</div>
            <div className="svc-kind">{s.kind}</div>
          </div>
        </div>
        <StatusDot state={state} pulse={state === "running"} lg />
      </div>

      {resCount === 0 && callCount === 0 ? (
        <div className="svc-empty">No activity yet</div>
      ) : (
        <div className="svc-stats">
          <div>
            <div className="n mono">{resCount}</div>
            <div className="l">{s.resourceLabel}</div>
          </div>
          <div>
            <div className="n mono">{callCount}</div>
            <div className="l">Recent calls</div>
          </div>
          <div>
            <div className={`n mono${errCount ? " err" : ""}`}>{errCount}</div>
            <div className="l">Errors</div>
          </div>
        </div>
      )}
      <div className="svc-foot">
        <span className="proto-badge">{svc.protocol}</span>
        {errCount > 0 && (
          <span
            className="mono"
            style={{ color: "var(--error)", fontSize: 11 }}
          >
            ● degraded
          </span>
        )}
      </div>
    </button>
  );
}

function MiniStream({
  requests,
  setScreen,
}: {
  requests: RequestLogEntry[];
  setScreen: (s: Screen) => void;
}) {
  const recent = requests.slice(-7).reverse();
  return (
    <div className="card flush">
      <div className="card-head" style={{ padding: "14px 16px 0", margin: 0 }}>
        <span className="t">Recent API calls</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setScreen("log")}
        >
          Open Request Log
          <Ico.chevR width="13" height="13" />
        </button>
      </div>
      {recent.length === 0 ? (
        <div style={{ padding: "10px 16px 20px" }}>
          <div className="ms-empty">
            <StatusDot state="running" pulse />
            <span>Waiting for calls — no requests yet</span>
          </div>
        </div>
      ) : (
        <div className="ms-list">
          {recent.map((r) => (
            <button
              key={r.id}
              className="ms-row"
              onClick={() => setScreen("log")}
            >
              <span className="ms-time mono">
                {fmtTime(r.time).slice(0, 8)}
              </span>
              <ServiceTag svc={r.service} />
              <span className="ms-op mono">{r.operation}</span>
              <span style={{ flex: 1 }} />
              <span className="ms-lat mono">{fmtLatency(r.latencyMs)}ms</span>
              <StatusChip status={r.statusCode} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const fmtUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export function Overview({
  services,
  requests,
  scope,
  setScreen,
  connected,
  uptimeSeconds,
}: {
  services: ServiceSummary[];
  requests: RequestLogEntry[];
  scope: { account: string; region: string };
  setScreen: (s: Screen) => void;
  connected: boolean;
  uptimeSeconds?: number;
}) {
  const scopedRequests = requests.filter(
    (r) => r.account === scope.account && r.region === scope.region,
  );
  const total = scopedRequests.length;
  const totErr = scopedRequests.filter((r) => r.statusCode >= 400).length;
  const errRate = total ? ((totErr / total) * 100).toFixed(1) : "0.0";
  const avgLat = total
    ? (scopedRequests.reduce((a, r) => a + r.latencyMs, 0) / total).toFixed(1)
    : "—";

  const aggregated = aggregateServices(services);

  const perSvc = new Map<string, { calls: number; errs: number }>();
  for (const r of scopedRequests) {
    const cur = perSvc.get(r.service) ?? { calls: 0, errs: 0 };
    cur.calls += 1;
    if (r.statusCode >= 400) cur.errs += 1;
    perSvc.set(r.service, cur);
  }

  if (!connected) {
    return (
      <div className="content">
        <EmptyState
          glyph={<Ico.overview width="26" height="26" />}
          title="Cannot connect to the stack"
          sub={
            <>
              No response from the management API (
              <span className="mono">/__bunsai</span>). Start the bunsai stack
              and active services and calls will appear here.
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="content ov-grid">
      <div className="ov-stats">
        <StatCard
          label="Uptime"
          value={uptimeSeconds !== undefined ? fmtUptime(uptimeSeconds) : "—"}
          sub={connected ? "Running" : "Awaiting connection"}
        />
        <StatCard
          label="Total requests"
          value={total.toLocaleString()}
          sub={total ? "Received" : "Awaiting traffic"}
        />
        <StatCard
          label="Error rate"
          value={errRate}
          unit="%"
          tone={totErr > 0 ? "error" : undefined}
          sub={total ? `${totErr} / ${total}` : "—"}
        />
        <StatCard
          label="Avg latency"
          value={avgLat}
          unit={total ? "ms" : ""}
          sub="Local processing"
        />
      </div>

      {totErr >= 3 && total > 0 && totErr / total >= 0.1 && (
        <div className="ov-alert">
          <Ico.warn
            width="18"
            height="18"
            style={{ color: "var(--error)", flex: "0 0 auto" }}
          />
          <div>
            <strong style={{ color: "var(--ink)" }}>
              Some calls returned errors.
            </strong>
            <span style={{ color: "var(--body)" }}>
              {" "}
              Detected {totErr} 4xx/5xx call{totErr === 1 ? "" : "s"} in the
              recent window.
            </span>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            style={{ marginLeft: "auto" }}
            onClick={() => setScreen("log")}
          >
            Investigate
          </button>
        </div>
      )}

      <div>
        <div className="flex aic" style={{ marginBottom: 12 }}>
          <span className="uppercase-label">Active services</span>
          <span className="badge pill mono" style={{ marginLeft: 10 }}>
            {aggregated.length} running
          </span>
        </div>
        {aggregated.length === 0 ? (
          <div className="card">
            <div className="svc-empty">No services registered</div>
          </div>
        ) : (
          <div className="svc-grid">
            {aggregated.map((svc) => {
              const p = perSvc.get(svc.name) ?? { calls: 0, errs: 0 };
              return (
                <ServiceCard
                  key={svc.name}
                  svc={svc}
                  resCount={svc.resourceCount}
                  callCount={svc.callCount}
                  errCount={p.errs}
                  onOpen={() => router.push(buildResourceSvcPath(svc.name))}
                />
              );
            })}
          </div>
        )}
      </div>

      <MiniStream requests={scopedRequests} setScreen={setScreen} />
    </div>
  );
}
