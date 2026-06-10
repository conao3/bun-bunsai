import { useEffect, useMemo, useRef, useState } from "react";
import type { ResourceEntry } from "./api";
import { decideAutoSelect } from "./autoSelect";
import type { Selection } from "./autoSelect";
import { useLocation } from "./router";
import {
  CodeBlock,
  EmptyState,
  Ico,
  ServiceTag,
  prettyMaybeJson,
  svcInfo,
} from "./shared";

type S3ObjectShape = {
  key: string;
  size: number;
  lastModified: number;
  isDeleteMarker?: boolean;
};

type S3BucketShape = {
  objects: Record<string, S3ObjectShape[]>;
};

type SQSMessageShape = {
  MessageId: string;
  Body: string;
  invisibleUntil: number;
};

type SQSQueueShape = {
  QueueUrl: string;
  Attributes: Record<string, string>;
  messages: SQSMessageShape[];
};

type KeySchemaElementShape = {
  AttributeName: string;
  KeyType: string;
};

type DynamoTableShape = {
  KeySchema: KeySchemaElementShape[];
  items: Record<string, unknown>;
};

type SecretVersionShape = {
  VersionId: string;
  VersionStages: string[];
};

type SecretShape = {
  Name: string;
  currentVersionId: string;
  versions: Record<string, SecretVersionShape>;
};

function isPlainObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function buildArn(
  service: string,
  account: string,
  region: string,
  key: string,
): string | null {
  switch (service) {
    case "s3":
      return `arn:aws:s3:::${key}`;
    case "sqs":
      return `arn:aws:sqs:${region}:${account}:${key}`;
    case "dynamodb":
      return `arn:aws:dynamodb:${region}:${account}:table/${key}`;
    case "secretsmanager":
      return `arn:aws:secretsmanager:${region}:${account}:secret:${key}`;
    case "lambda":
      return `arn:aws:lambda:${region}:${account}:function:${key}`;
    case "sns":
      return `arn:aws:sns:${region}:${account}:${key}`;
    case "kinesis":
      return `arn:aws:kinesis:${region}:${account}:stream/${key}`;
    default:
      return null;
  }
}

function extractArnFromValue(value: unknown): string | null {
  if (!isPlainObj(value)) return null;
  if (typeof value["Arn"] === "string") return value["Arn"];
  if (typeof value["arn"] === "string") return value["arn"];
  if (typeof value["ResourceArn"] === "string") return value["ResourceArn"];
  if (isPlainObj(value["Attributes"])) {
    const attrs = value["Attributes"] as Record<string, unknown>;
    if (typeof attrs["QueueArn"] === "string") return attrs["QueueArn"];
  }
  return null;
}

function isS3Bucket(v: Record<string, unknown>): v is S3BucketShape {
  return isPlainObj(v.objects);
}

function isSQSQueue(v: Record<string, unknown>): v is SQSQueueShape {
  return typeof v.QueueUrl === "string" && Array.isArray(v.messages);
}

function isDynamoTable(v: Record<string, unknown>): v is DynamoTableShape {
  return Array.isArray(v.KeySchema) && isPlainObj(v.items);
}

function isStoredSecret(v: Record<string, unknown>): v is SecretShape {
  return (
    typeof v.Name === "string" &&
    typeof v.currentVersionId === "string" &&
    isPlainObj(v.versions)
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function S3BucketDetail({ value }: { value: S3BucketShape }) {
  const [prefix, setPrefix] = useState("");

  const allObjects = useMemo(() => {
    const list: S3ObjectShape[] = [];
    for (const versions of Object.values(value.objects)) {
      for (let i = versions.length - 1; i >= 0; i--) {
        const v = versions[i];
        if (!v.isDeleteMarker) {
          list.push(v);
          break;
        }
      }
    }
    return list;
  }, [value]);

  const filtered = prefix
    ? allObjects.filter((o) => o.key.startsWith(prefix))
    : allObjects;

  const cols = "minmax(0,3fr) minmax(0,1fr) minmax(0,2fr)";

  return (
    <>
      <div className="res-toolbar">
        <input
          className="input"
          placeholder="prefix フィルタ"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          style={{ width: 220 }}
        />
        <span className="badge pill mono">{filtered.length} objects</span>
      </div>
      <div className="res-table">
        <div className="res-thead" style={{ gridTemplateColumns: cols }}>
          <span>Key</span>
          <span>Size</span>
          <span>Last modified</span>
        </div>
        {filtered.length === 0 ? (
          <div className="res-row" style={{ gridTemplateColumns: "1fr" }}>
            <span style={{ color: "var(--muted-soft)" }}>
              {prefix ? "一致するオブジェクトなし" : "オブジェクトなし"}
            </span>
          </div>
        ) : (
          filtered.map((o) => (
            <div
              key={o.key}
              className="res-row"
              style={{ gridTemplateColumns: cols }}
            >
              <span className="r-key mono">{o.key}</span>
              <span className="mono">{fmtBytes(o.size)}</span>
              <span className="mono">
                {new Date(o.lastModified).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function SQSQueueDetail({ value }: { value: SQSQueueShape }) {
  const now = Date.now();
  const pending = value.messages.filter((m) => m.invisibleUntil <= now).length;
  const inFlight = value.messages.filter((m) => m.invisibleUntil > now).length;
  const firstMessage = value.messages.find((m) => m.invisibleUntil <= now);

  const attrRows: [string, string][] = [
    ["QueueUrl", value.QueueUrl],
    ...Object.entries(value.Attributes),
  ];

  return (
    <>
      <div className="attr-grid res-attrs" style={{ marginBottom: 16 }}>
        {attrRows.map(([k, v]) => (
          <div className="kv-row" key={k}>
            <span className="k">{k}</span>
            <span className="v mono">{v}</span>
          </div>
        ))}
      </div>
      <div className="attr-grid res-attrs" style={{ marginBottom: 16 }}>
        <div className="kv-row">
          <span className="k">Approximate Messages Available</span>
          <span className="v mono">{pending}</span>
        </div>
        <div className="kv-row">
          <span className="k">Approximate Messages Not Visible</span>
          <span className="v mono">{inFlight}</span>
        </div>
      </div>
      {firstMessage && (
        <>
          <div className="uppercase-label" style={{ margin: "6px 0 8px" }}>
            先頭メッセージ
          </div>
          <CodeBlock text={prettyMaybeJson(firstMessage.Body)} highlight />
        </>
      )}
    </>
  );
}

function DynamoDBDetail({ value }: { value: DynamoTableShape }) {
  const pk = value.KeySchema.find((k) => k.KeyType === "HASH");
  const sk = value.KeySchema.find((k) => k.KeyType === "RANGE");
  const itemCount = Object.keys(value.items).length;
  const sampleItems = Object.values(value.items).slice(0, 5);

  return (
    <>
      <div className="attr-grid res-attrs" style={{ marginBottom: 16 }}>
        {pk && (
          <div className="kv-row">
            <span className="k">Partition Key (PK)</span>
            <span className="v mono">{pk.AttributeName}</span>
          </div>
        )}
        {sk && (
          <div className="kv-row">
            <span className="k">Sort Key (SK)</span>
            <span className="v mono">{sk.AttributeName}</span>
          </div>
        )}
        <div className="kv-row">
          <span className="k">Item Count</span>
          <span className="v mono">{itemCount}</span>
        </div>
      </div>
      {sampleItems.length > 0 && (
        <>
          <div className="uppercase-label" style={{ margin: "6px 0 8px" }}>
            items (先頭 {sampleItems.length} 件)
          </div>
          <CodeBlock text={JSON.stringify(sampleItems, null, 2)} highlight />
        </>
      )}
    </>
  );
}

function SecretsManagerDetail({ value }: { value: SecretShape }) {
  const currentVersion = value.versions[value.currentVersionId];

  return (
    <>
      <div className="attr-grid res-attrs" style={{ marginBottom: 16 }}>
        <div className="kv-row">
          <span className="k">Name</span>
          <span className="v mono">{value.Name}</span>
        </div>
        {currentVersion && (
          <>
            <div className="kv-row">
              <span className="k">VersionId</span>
              <span className="v mono">{currentVersion.VersionId}</span>
            </div>
            <div className="kv-row">
              <span className="k">VersionStages</span>
              <span className="v mono">
                {currentVersion.VersionStages.join(", ")}
              </span>
            </div>
          </>
        )}
      </div>
      <div
        style={{
          background: "color-mix(in srgb, var(--warning) 10%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
          borderRadius: "var(--r-md)",
          padding: "10px 14px",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: "var(--body)",
        }}
      >
        <Ico.warn
          width="16"
          height="16"
          style={{ color: "var(--warning)", flexShrink: 0 }}
        />
        SecretString はマスクされています
      </div>
    </>
  );
}

type Scope = { account: string; region: string };

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
            <button
              className="tree-node svc"
              onClick={() => setOpen({ ...open, [svc]: !isOpen })}
              aria-expanded={isOpen}
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
            </button>
            {isOpen && (
              <div className="tree-children">
                {items.length === 0 ? (
                  <div className="tree-empty">なし</div>
                ) : (
                  items.map((it) => (
                    <button
                      key={`${svc}/${it.key}`}
                      className={`tree-node leaf${sel && sel.service === svc && sel.key === it.key ? " sel" : ""}`}
                      onClick={() => setSel({ service: svc, key: it.key })}
                      aria-selected={
                        sel?.service === svc && sel?.key === it.key
                      }
                    >
                      <span
                        className="leaf-glyph"
                        style={{ background: s.color }}
                      />
                      <span className="leaf-name mono">{it.key}</span>
                    </button>
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
  const arn =
    extractArnFromValue(entry.value) ??
    buildArn(entry.service, entry.account, entry.region, entry.key);
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
        {arn && (
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--muted-soft)", marginTop: 2 }}
          >
            {arn}
          </div>
        )}
      </div>

      {obj && entry.service === "s3" && isS3Bucket(obj) ? (
        <S3BucketDetail value={obj} />
      ) : obj && entry.service === "sqs" && isSQSQueue(obj) ? (
        <SQSQueueDetail value={obj} />
      ) : obj && entry.service === "dynamodb" && isDynamoTable(obj) ? (
        <DynamoDBDetail value={obj} />
      ) : obj && entry.service === "secretsmanager" && isStoredSecret(obj) ? (
        <SecretsManagerDetail value={obj} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

export function ResourceBrowser({
  scope,
  connected,
  resources,
  loaded,
  sel,
  onSelect,
}: {
  scope: Scope;
  connected: boolean;
  resources: ResourceEntry[];
  loaded: boolean;
  sel: Selection | null;
  onSelect: (s: Selection | null, replace?: boolean) => void;
}) {
  const loc = useLocation();
  const svcHint = loc.query.get("svc");

  const scoped = useMemo(
    () =>
      resources.filter(
        (e) => e.account === scope.account && e.region === scope.region,
      ),
    [resources, scope],
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

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!loaded) return;
    const next = decideAutoSelect(sel, scoped, svcHint);
    if (next === null) return;
    onSelectRef.current(next, true);
  }, [scoped, sel, loaded, svcHint]);

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
          setSel={(s) => onSelect(s)}
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
