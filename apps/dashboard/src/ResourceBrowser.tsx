import { useEffect, useMemo, useState } from "react";
import type { ResourceEntry } from "./api";
import { fetchResources } from "./api";
import {
  CodeBlock,
  EmptyState,
  Ico,
  ServiceTag,
  prettyMaybeJson,
  svcInfo,
} from "./shared";

type Scope = { account: string; region: string };
type Selection = { service: string; key: string };

function ResourceTree({
  scope,
  grouped,
  sel,
  setSel,
}: {
  scope: Scope;
  grouped: Map<string, ResourceEntry[]>;
  sel: Selection | null;
  setSel: (s: Selection) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const services = [...grouped.keys()].sort();
  return (
    <div className="tree">
      <div className="tree-scope">
        <span className="uppercase-label" style={{ fontSize: 9.5 }}>
          scope
        </span>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--body)" }}>
          {scope.account} · {scope.region}
        </span>
      </div>
      {services.map((svc) => {
        const items = grouped.get(svc) ?? [];
        const s = svcInfo(svc);
        const isOpen = open[svc] ?? true;
        return (
          <div key={svc} className="tree-svc">
            <div
              className="tree-node svc"
              onClick={() => setOpen({ ...open, [svc]: !isOpen })}
            >
              <Ico.chevR
                className="tw"
                width="13"
                height="13"
                style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
              />
              <ServiceTag svc={svc} />
              <span className="tree-svc-label">{s.resourceLabel}</span>
              <span className="tree-count mono">{items.length}</span>
            </div>
            {isOpen && (
              <div className="tree-children">
                {items.length === 0 ? (
                  <div className="tree-empty">なし</div>
                ) : (
                  items.map((it) => (
                    <div
                      key={`${svc}/${it.key}`}
                      className={`tree-node leaf${sel && sel.service === svc && sel.key === it.key ? " sel" : ""}`}
                      onClick={() => setSel({ service: svc, key: it.key })}
                    >
                      <span
                        className="leaf-glyph"
                        style={{ background: s.color }}
                      />
                      <span className="leaf-name mono">{it.key}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResourceDetail({
  scope,
  entry,
}: {
  scope: Scope;
  entry: ResourceEntry;
}) {
  const valueText = useMemo(
    () => prettyMaybeJson(JSON.stringify(entry.value)),
    [entry],
  );
  const obj =
    entry.value && typeof entry.value === "object"
      ? (entry.value as Record<string, unknown>)
      : null;
  const s = svcInfo(entry.service);
  return (
    <div className="res-detail">
      <div className="res-detail-head">
        <div className="flex aic gap10">
          <ServiceTag svc={entry.service} />
          <span className="serif" style={{ fontSize: 22, color: "var(--ink)" }}>
            {entry.key}
          </span>
        </div>
        <div
          className="mono"
          style={{ fontSize: 11, color: "var(--muted-soft)", marginTop: 6 }}
        >
          {s.name} · {entry.account} · {entry.region}
        </div>
      </div>

      {obj && (
        <div className="attr-grid" style={{ marginBottom: 16 }}>
          {Object.entries(obj)
            .filter(([, v]) => typeof v !== "object" || v === null)
            .map(([k, v]) => (
              <div className="kv-row" key={k}>
                <span className="k">{k}</span>
                <span className="v">{String(v)}</span>
              </div>
            ))}
        </div>
      )}

      <div className="uppercase-label" style={{ margin: "6px 0 8px" }}>
        stored value
      </div>
      <CodeBlock text={valueText} highlight />
    </div>
  );
}

export function ResourceBrowser({
  scope,
  connected,
  refreshToken,
}: {
  scope: Scope;
  connected: boolean;
  refreshToken: number;
}) {
  const [entries, setEntries] = useState<ResourceEntry[]>([]);
  const [sel, setSel] = useState<Selection | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchResources().then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const scoped = useMemo(
    () =>
      entries.filter(
        (e) => e.account === scope.account && e.region === scope.region,
      ),
    [entries, scope],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, ResourceEntry[]>();
    for (const e of scoped) {
      const arr = m.get(e.service) ?? [];
      arr.push(e);
      m.set(e.service, arr);
    }
    return m;
  }, [scoped]);

  useEffect(() => {
    if (
      sel &&
      scoped.some((e) => e.service === sel.service && e.key === sel.key)
    )
      return;
    const first = scoped[0];
    setSel(first ? { service: first.service, key: first.key } : null);
  }, [scoped, sel]);

  const selEntry = sel
    ? (scoped.find((e) => e.service === sel.service && e.key === sel.key) ??
      null)
    : null;

  return (
    <div className="res-browser">
      <div className="res-tree-pane scroll-y">
        <ResourceTree
          scope={scope}
          grouped={grouped}
          sel={sel}
          setSel={setSel}
        />
      </div>
      <div className="res-main scroll-y">
        {scoped.length === 0 ? (
          <EmptyState
            glyph={<Ico.browser width="26" height="26" />}
            title={
              loaded
                ? "このスコープにリソースはありません"
                : "リソースを読み込み中…"
            }
            sub={
              <>
                スコープ <span className="mono">{scope.region}</span>{" "}
                にはまだリソースがありません。
                {connected
                  ? " SDK / CLI で作成すると表示されます。"
                  : " management API への接続を待っています。"}
              </>
            }
          />
        ) : selEntry ? (
          <ResourceDetail scope={scope} entry={selEntry} />
        ) : (
          <EmptyState
            glyph={<Ico.browser width="26" height="26" />}
            title="リソースを選択"
            sub="左のツリーからリソースを選ぶと、保存された状態がここに表示されます。"
          />
        )}
      </div>
    </div>
  );
}
