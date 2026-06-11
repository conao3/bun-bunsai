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
        <div className="svc-empty">まだ操作がありません</div>
      ) : (
        <div className="svc-stats">
          <div>
            <div className="n mono">{resCount}</div>
            <div className="l">{s.resourceLabel}</div>
          </div>
          <div>
            <div className="n mono">{callCount}</div>
            <div className="l">直近のコール</div>
          </div>
          <div>
            <div className={`n mono${errCount ? " err" : ""}`}>{errCount}</div>
            <div className="l">エラー</div>
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
        <span className="t">直近の API コール</span>
        <span style={{ flex: 1 }} />
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => setScreen("log")}
        >
          Request Log を開く
          <Ico.chevR width="13" height="13" />
        </button>
      </div>
      {recent.length === 0 ? (
        <div style={{ padding: "10px 16px 20px" }}>
          <div className="ms-empty">
            <StatusDot state="running" pulse />
            <span>コール待ち受け中 — まだリクエストがありません</span>
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

export function Overview({
  services,
  requests,
  scope,
  setScreen,
  connected,
}: {
  services: ServiceSummary[];
  requests: RequestLogEntry[];
  scope: { account: string; region: string };
  setScreen: (s: Screen) => void;
  connected: boolean;
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
          title="スタックに接続できません"
          sub={
            <>
              management API (<span className="mono">/__bunsai</span>)
              からの応答がありません。 bunsai
              スタックを起動すると、稼働サービスとコールがここに表示されます。
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
          label="稼働サービス"
          value={aggregated.length}
          sub={connected ? "registered" : "接続待ち"}
        />
        <StatCard
          label="累計リクエスト"
          value={total.toLocaleString()}
          sub={total ? "累計受信" : "受信待ち"}
        />
        <StatCard
          label="エラー率"
          value={errRate}
          unit="%"
          tone={totErr > 0 ? "error" : undefined}
          sub={total ? `${totErr} 件 / ${total} 件` : "—"}
        />
        <StatCard
          label="平均レイテンシ"
          value={avgLat}
          unit={total ? "ms" : ""}
          sub="ローカル処理"
        />
      </div>

      {totErr > 0 && (
        <div className="ov-alert">
          <Ico.warn
            width="18"
            height="18"
            style={{ color: "var(--error)", flex: "0 0 auto" }}
          />
          <div>
            <strong style={{ color: "var(--ink)" }}>
              エラーを返したコールがあります。
            </strong>
            <span style={{ color: "var(--body)" }}>
              {" "}
              直近で {totErr} 件の 4xx/5xx を検出しました。
            </span>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            style={{ marginLeft: "auto" }}
            onClick={() => setScreen("log")}
          >
            エラーを調査
          </button>
        </div>
      )}

      <div>
        <div className="flex aic" style={{ marginBottom: 12 }}>
          <span className="uppercase-label">起動中のサービス</span>
          <span className="badge pill mono" style={{ marginLeft: 10 }}>
            {aggregated.length} 稼働
          </span>
        </div>
        {aggregated.length === 0 ? (
          <div className="card">
            <div className="svc-empty">登録済みサービスがありません</div>
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
