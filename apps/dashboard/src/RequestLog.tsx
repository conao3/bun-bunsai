import { useEffect, useMemo, useRef, useState } from "react";
import type { RequestLogEntry } from "./api";
import {
  CodeBlock,
  EmptyState,
  Ico,
  MultiFilter,
  ProtoBadge,
  ServiceTag,
  StatusChip,
  StatusDot,
  fmtLatency,
  fmtTime,
  prettyMaybeJson,
  svcInfo,
} from "./shared";

const detailTabs = [
  { id: "interpreted", label: "解釈後パラメータ" },
  { id: "raw", label: "生ボディ" },
  { id: "response", label: "レスポンス" },
] as const;
type DetailTab = (typeof detailTabs)[number]["id"];

export const statusFilters = ["all", "2xx", "4xx", "5xx"] as const;
export type StatusFilter = (typeof statusFilters)[number];

function statusClass(code: number): StatusFilter {
  return code < 400 ? "2xx" : code < 500 ? "4xx" : "5xx";
}

function parsedError(text: string): { code: string; message: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const j = JSON.parse(trimmed) as Record<string, unknown>;
    const code = (j.__type as string) ?? (j.code as string);
    const message = (j.message as string) ?? (j.Message as string);
    if (code || message)
      return { code: code ?? "Error", message: message ?? "" };
  } catch {
    const code = /<Code>([^<]+)<\/Code>/.exec(trimmed)?.[1];
    const message = /<Message>([^<]+)<\/Message>/.exec(trimmed)?.[1];
    if (code || message)
      return { code: code ?? "Error", message: message ?? "" };
  }
  return null;
}

function RequestDetail({
  req,
  onClose,
}: {
  req: RequestLogEntry;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>("interpreted");
  useEffect(() => {
    setTab("interpreted");
  }, [req.id]);
  const isErr = req.statusCode >= 400;
  const err = isErr ? parsedError(req.responseBodyText) : null;
  const respIsJson =
    req.responseBodyText.trim().startsWith("{") ||
    req.responseBodyText.trim().startsWith("[");
  return (
    <div className="detail drawer">
      <div className="detail-head">
        <div className="flex aic gap8" style={{ minWidth: 0 }}>
          <ServiceTag svc={req.service} />
          <span
            className="mono"
            style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}
          >
            {req.operation}
          </span>
          <StatusChip status={req.statusCode} />
          <ProtoBadge protocol={req.protocol} />
        </div>
        <button className="icon-btn" onClick={onClose}>
          <Ico.close width="17" height="17" />
        </button>
      </div>

      <div className="detail-meta">
        <div className="kv-row">
          <span className="k">Service</span>
          <span className="v">{svcInfo(req.service).name}</span>
        </div>
        <div className="kv-row">
          <span className="k">Request ID</span>
          <span className="v">{req.id}</span>
        </div>
        <div className="kv-row">
          <span className="k">Timestamp</span>
          <span className="v">{req.time}</span>
        </div>
        <div className="kv-row">
          <span className="k">Latency</span>
          <span className="v">{fmtLatency(req.latencyMs)} ms</span>
        </div>
        <div className="kv-row">
          <span className="k">Scope</span>
          <span className="v">
            {req.account} · {req.region}
          </span>
        </div>
      </div>

      {err && (
        <div className="err-callout">
          <Ico.warn
            width="17"
            height="17"
            style={{ color: "var(--error)", flex: "0 0 auto", marginTop: 1 }}
          />
          <div>
            <div
              className="mono"
              style={{ color: "var(--error)", fontWeight: 600, fontSize: 12.5 }}
            >
              {err.code}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--body)", marginTop: 2 }}>
              {err.message}
            </div>
          </div>
        </div>
      )}

      <div className="detail-tabs" role="tablist">
        {detailTabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            className={tab === t.id ? "on" : ""}
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="detail-body scroll-y">
        {tab === "interpreted" && (
          <>
            <div className="flex aic jcsb" style={{ marginBottom: 8 }}>
              <span className="uppercase-label">parsed request parameters</span>
              <ProtoBadge protocol={req.protocol} />
            </div>
            <CodeBlock text={prettyMaybeJson(req.requestBodyText)} highlight />
          </>
        )}
        {tab === "raw" && (
          <>
            <div className="uppercase-label" style={{ marginBottom: 8 }}>
              raw request body
            </div>
            <CodeBlock text={req.requestBodyText} />
          </>
        )}
        {tab === "response" && (
          <>
            <div className="flex aic jcsb" style={{ marginBottom: 8 }}>
              <span className="uppercase-label">response body</span>
              <span
                className={`status-chip status-${statusClass(req.statusCode)}`}
              >
                {req.statusCode}
              </span>
            </div>
            <CodeBlock
              text={
                respIsJson
                  ? prettyMaybeJson(req.responseBodyText)
                  : req.responseBodyText
              }
              highlight={respIsJson}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function RequestLog({
  requests,
  live,
  setLive,
  clearRequests,
  connected,
  selId,
  onSelect,
  svcFilter,
  onSvcFilter,
  statusFilter,
  onStatusFilter,
  q,
  onQ,
}: {
  requests: RequestLogEntry[];
  live: boolean;
  setLive: (v: boolean) => void;
  clearRequests: () => void;
  connected: boolean;
  selId: string | null;
  onSelect: (id: string | null) => void;
  svcFilter: string[];
  onSvcFilter: (v: string[]) => void;
  statusFilter: string;
  onStatusFilter: (v: StatusFilter) => void;
  q: string;
  onQ: (v: string) => void;
}) {
  const [qInput, setQInput] = useState(q);
  const [stick, setStick] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQInput(q);
  }, [q]);
  useEffect(() => {
    if (qInput === q) return;
    const timer = setTimeout(() => onQ(qInput), 300);
    return () => clearTimeout(timer);
  }, [qInput, q, onQ]);

  const serviceOptions = useMemo(
    () => [...new Set(requests.map((r) => r.service))].sort(),
    [requests],
  );

  const filtered = useMemo(() => {
    const needle = qInput.toLowerCase();
    return requests.filter((r) => {
      if (svcFilter.length && !svcFilter.includes(r.service)) return false;
      if (statusFilter !== "all" && statusClass(r.statusCode) !== statusFilter)
        return false;
      if (
        needle &&
        !`${r.operation} ${r.service} ${r.id} ${r.region} ${r.account}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
  }, [requests, svcFilter, statusFilter, qInput]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (stick) {
      el.scrollTop = el.scrollHeight;
      setNewCount(0);
    } else {
      setNewCount((c) => c + 1);
    }
  }, [requests.length, stick]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStick(atBottom);
    if (atBottom) setNewCount(0);
  };
  const jumpDown = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStick(true);
    setNewCount(0);
  };

  const sel = requests.find((r) => r.id === selId) ?? null;
  const errCount = filtered.filter((r) => r.statusCode >= 400).length;

  return (
    <div className="log-screen">
      <div className="log-toolbar">
        <button
          className={`btn btn-sm ${live ? "btn-secondary" : "btn-primary"}`}
          onClick={() => setLive(!live)}
        >
          {live ? (
            <Ico.pause width="14" height="14" />
          ) : (
            <Ico.play width="14" height="14" />
          )}
          {live ? "一時停止" : "ライブ再開"}
        </button>
        <div className={`live-ind ${live && connected ? "on" : ""}`}>
          <StatusDot
            state={!live ? "idle" : connected ? "running" : "error"}
            pulse={live && connected}
          />
          <span>{!live ? "PAUSED" : connected ? "LIVE" : "OFFLINE"}</span>
        </div>

        <div className="tb-sep" />

        <MultiFilter
          label="Service"
          options={serviceOptions}
          selected={svcFilter}
          onChange={onSvcFilter}
          render={(o) => svcInfo(o).name}
        />
        <div className="segmented">
          {statusFilters.map((s) => (
            <button
              key={s}
              className={statusFilter === s ? "on" : ""}
              onClick={() => onStatusFilter(s)}
              aria-pressed={statusFilter === s}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        <div className="tb-search">
          <Ico.search
            width="15"
            height="15"
            style={{ color: "var(--muted-soft)" }}
          />
          <input
            className="input"
            type="search"
            aria-label="operation, service, request id を検索"
            placeholder="operation, service, request id を検索…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>

        <div className="gb-spacer" />
        <span className="count-badge mono">
          {filtered.length}
          <span className="cb-lbl">件</span>
        </span>
        {errCount > 0 && (
          <span className="count-badge mono err">
            {errCount}
            <span className="cb-lbl">err</span>
          </span>
        )}
        <button
          className="btn btn-sm btn-ghost"
          onClick={clearRequests}
          disabled={requests.length === 0}
        >
          <Ico.trash width="14" height="14" />
          クリア
        </button>
      </div>

      <div className="log-main">
        <div className="log-table-wrap">
          {requests.length === 0 ? (
            <EmptyState
              glyph={<Ico.log width="26" height="26" />}
              title="リクエストを待っています"
              sub={
                <>
                  スタックは <span className="mono">http://localhost:4566</span>{" "}
                  で待ち受け中です。
                  {connected
                    ? " AWS SDK や CLI からコールが届くと、ここにライブで流れます。"
                    : " management API への接続を待っています。"}
                </>
              }
              action={
                <button
                  className={`btn ${live ? "btn-secondary" : "btn-primary"}`}
                  onClick={() => setLive(!live)}
                >
                  {live ? (
                    <>
                      <Ico.pause width="15" height="15" />
                      ライブ受信中
                    </>
                  ) : (
                    <>
                      <Ico.play width="15" height="15" />
                      ライブ受信を開始
                    </>
                  )}
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              glyph={<Ico.search width="24" height="24" />}
              title="一致するコールがありません"
              sub="フィルタや検索条件を変更してください。"
            />
          ) : (
            <>
              <div className="log-thead">
                <span className="c-time">時刻</span>
                <span className="c-svc">サービス</span>
                <span className="c-op">オペレーション</span>
                <span className="c-status">ステータス</span>
                <span className="c-lat">レイテンシ</span>
                <span className="c-scope">region</span>
              </div>
              <div
                className="log-rows scroll-y"
                ref={listRef}
                onScroll={onScroll}
              >
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    className={`log-row${r.id === selId ? " sel" : ""}${r.statusCode >= 500 ? " r5xx" : r.statusCode >= 400 ? " r4xx" : ""}`}
                    onClick={() => onSelect(r.id)}
                    aria-selected={r.id === selId}
                  >
                    <span className="c-time mono">{fmtTime(r.time)}</span>
                    <span className="c-svc">
                      <ServiceTag svc={r.service} />
                    </span>
                    <span className="c-op mono">{r.operation}</span>
                    <span className="c-status">
                      <StatusChip status={r.statusCode} />
                    </span>
                    <span className="c-lat mono">
                      {fmtLatency(r.latencyMs)}
                      <span className="lat-u">ms</span>
                    </span>
                    <span className="c-scope mono">{r.region}</span>
                  </button>
                ))}
              </div>
              {!stick && newCount > 0 && (
                <button className="jump-pill" onClick={jumpDown}>
                  <Ico.caret width="14" height="14" />
                  {newCount} 件の新着
                </button>
              )}
            </>
          )}
        </div>

        {sel && <RequestDetail req={sel} onClose={() => onSelect(null)} />}
      </div>
    </div>
  );
}
