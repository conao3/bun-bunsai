import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { RequestLogEntry } from "./api";
import { matchesOpFilter } from "./requestLogFilters";
import type { LogLayout } from "./types";
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
  { id: "interpreted", label: "Parsed params" },
  { id: "raw", label: "Raw body" },
  { id: "headers", label: "Headers" },
  { id: "response", label: "Response" },
] as const;
type DetailTab = (typeof detailTabs)[number]["id"];

const LogRow = memo(function LogRow({
  r,
  isSelected,
  onSelect,
}: {
  r: RequestLogEntry;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      className={`log-row${isSelected ? " sel" : ""}${r.statusCode >= 500 ? " r5xx" : r.statusCode >= 400 ? " r4xx" : ""}`}
      onClick={() => onSelect(r.id)}
      aria-selected={isSelected}
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
  );
});

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
  logLayout,
}: {
  req: RequestLogEntry;
  onClose: () => void;
  logLayout: LogLayout;
}) {
  const [tab, setTab] = useState<DetailTab>("interpreted");
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<Element | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setTab("interpreted");
  }, [req.id]);

  useEffect(() => {
    prevFocusRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      (prevFocusRef.current as HTMLElement | null)?.focus();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const isErr = req.statusCode >= 400;
  const err = isErr ? parsedError(req.responseBodyText) : null;
  const respIsJson =
    req.responseBodyText.trim().startsWith("{") ||
    req.responseBodyText.trim().startsWith("[");
  return (
    <div
      className={`detail ${logLayout === "bottom" ? "bottom-panel" : "drawer"}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${req.operation} (${req.service})`}
      ref={dialogRef}
      tabIndex={-1}
    >
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
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Ico.close width="17" height="17" />
        </button>
      </div>

      <div className="detail-meta">
        <div className="kv-row">
          <span className="k">Service</span>
          <span className="v">{svcInfo(req.service).name}</span>
        </div>
        {req.method && req.path && (
          <div className="kv-row">
            <span className="k">Method · Path</span>
            <span className="v mono">
              {req.method} {req.path}
            </span>
          </div>
        )}
        {req.resourceArn && (
          <div className="kv-row">
            <span className="k">Resource ARN</span>
            <span className="v mono">{req.resourceArn}</span>
          </div>
        )}
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
            <div className="flex aic jcsb" style={{ marginBottom: 8 }}>
              <span className="uppercase-label">raw request body</span>
              {req.contentType && (
                <span className="proto-badge">{req.contentType}</span>
              )}
            </div>
            <CodeBlock text={req.requestBodyText} />
          </>
        )}
        {tab === "headers" && (
          <>
            <div className="uppercase-label" style={{ marginBottom: 8 }}>
              request headers
            </div>
            {req.requestHeaders &&
            Object.keys(req.requestHeaders).length > 0 ? (
              <div className="headers-kv">
                {Object.entries(req.requestHeaders).map(([k, v]) => (
                  <div key={k} className="hkv-row">
                    <span className="hkv-k mono">{k}</span>
                    <span className="hkv-v mono">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>—</span>
            )}
            <div
              className="uppercase-label"
              style={{ marginTop: 16, marginBottom: 8 }}
            >
              response headers
            </div>
            {req.responseHeaders &&
            Object.keys(req.responseHeaders).length > 0 ? (
              <div className="headers-kv">
                {Object.entries(req.responseHeaders).map(([k, v]) => (
                  <div key={k} className="hkv-row">
                    <span className="hkv-k mono">{k}</span>
                    <span className="hkv-v mono">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: 12.5 }}>—</span>
            )}
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

function RequestNotFound({
  id,
  onClose,
  logLayout,
}: {
  id: string;
  onClose: () => void;
  logLayout: LogLayout;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className={`detail ${logLayout === "bottom" ? "bottom-panel" : "drawer"}`}
      role="dialog"
      aria-modal="true"
      aria-label="Request not found"
    >
      <div className="detail-head">
        <div />
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          <Ico.close width="17" height="17" />
        </button>
      </div>
      <EmptyState
        glyph={<Ico.search width="26" height="26" />}
        title="Request not found"
        sub={
          <>
            <span className="mono">{id}</span>
            <br />
            Only the last 600 entries are kept
          </>
        }
        action={
          <button className="btn btn-sm btn-secondary" onClick={onClose}>
            Close
          </button>
        }
      />
    </div>
  );
}

export function RequestLog({
  requests,
  scope,
  live,
  setLive,
  clearRequests,
  connected,
  selId,
  onSelect,
  svcFilter,
  onSvcFilter,
  opFilter,
  onOpFilter,
  statusFilter,
  onStatusFilter,
  q,
  onQ,
  logLayout,
}: {
  requests: RequestLogEntry[];
  scope: { account: string; region: string };
  live: boolean;
  setLive: (v: boolean) => void;
  clearRequests: () => void;
  connected: boolean;
  selId: string | null;
  onSelect: (id: string | null) => void;
  svcFilter: string[];
  onSvcFilter: (v: string[]) => void;
  opFilter: string[];
  onOpFilter: (v: string[]) => void;
  statusFilter: string;
  onStatusFilter: (v: StatusFilter) => void;
  q: string;
  onQ: (v: string) => void;
  logLayout: LogLayout;
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

  const operationOptions = useMemo(
    () => [...new Set(requests.map((r) => r.operation))].sort(),
    [requests],
  );

  const filtered = useMemo(() => {
    const needle = qInput.toLowerCase();
    return requests.filter((r) => {
      if (r.account !== scope.account || r.region !== scope.region)
        return false;
      if (svcFilter.length && !svcFilter.includes(r.service)) return false;
      if (!matchesOpFilter(r.operation, opFilter)) return false;
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
  }, [requests, scope, svcFilter, opFilter, statusFilter, qInput]);

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
          {live ? "Pause" : "Resume"}
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
        <MultiFilter
          label="Operation"
          options={operationOptions}
          selected={opFilter}
          onChange={onOpFilter}
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
            aria-label="Search operation, service, or request id"
            placeholder="Search operation, service, request id…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </div>

        <div className="gb-spacer" />
        <span className="count-badge mono">
          {filtered.length}
          <span className="cb-lbl">calls</span>
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
          Clear
        </button>
      </div>

      <div
        className={`log-main${logLayout === "bottom" ? " log-main-bottom" : ""}`}
      >
        <div className="log-table-wrap">
          {requests.length === 0 ? (
            <EmptyState
              glyph={<Ico.log width="26" height="26" />}
              title="Waiting for requests"
              sub={
                <>
                  The stack is listening on{" "}
                  <span className="mono">http://localhost:4566</span>.
                  {connected
                    ? " Calls from AWS SDKs and CLIs will stream here live."
                    : " Waiting for management API connection."}
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
                      Live
                    </>
                  ) : (
                    <>
                      <Ico.play width="15" height="15" />
                      Start live
                    </>
                  )}
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              glyph={<Ico.search width="24" height="24" />}
              title="No matching calls"
              sub="Adjust the filters or search query."
            />
          ) : (
            <>
              <div className="log-thead">
                <span className="c-time">Time</span>
                <span className="c-svc">Service</span>
                <span className="c-op">Operation</span>
                <span className="c-status">Status</span>
                <span className="c-lat">Latency</span>
                <span className="c-scope">region</span>
              </div>
              <div
                className="log-rows scroll-y"
                ref={listRef}
                onScroll={onScroll}
              >
                {filtered.map((r) => (
                  <LogRow
                    key={r.id}
                    r={r}
                    isSelected={r.id === selId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
              {!stick && newCount > 0 && (
                <button className="jump-pill" onClick={jumpDown}>
                  <Ico.caret width="14" height="14" />
                  {newCount} new
                </button>
              )}
            </>
          )}
        </div>

        {sel ? (
          <RequestDetail
            req={sel}
            onClose={() => onSelect(null)}
            logLayout={logLayout}
          />
        ) : selId ? (
          <RequestNotFound
            id={selId}
            onClose={() => onSelect(null)}
            logLayout={logLayout}
          />
        ) : null}
      </div>
    </div>
  );
}
