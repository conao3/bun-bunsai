import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, SVGProps } from "react";
import type { Protocol } from "./api";

export type IconProps = SVGProps<SVGSVGElement>;

export const Ico = {
  overview: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="3"
        width="7"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="14"
        y="12"
        width="7"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="3"
        y="16"
        width="7"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  log: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="19" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  browser: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 5.5h6l1.5 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m20 20-3.4-3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
  play: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M7 5.5v13l11-6.5z" />
    </svg>
  ),
  pause: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="6.5" y="5.5" width="3.6" height="13" rx="1" />
      <rect x="13.9" y="5.5" width="3.6" height="13" rx="1" />
    </svg>
  ),
  trash: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M5 7h14M10 7V5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V7M6.5 7l.8 11a1 1 0 0 0 1 .95h7.4a1 1 0 0 0 1-.95L18 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  caret: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  chevR: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  sun: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  moon: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M20 13.5A8 8 0 0 1 10.5 4a7 7 0 1 0 9.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warn: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M12 4.5 21 19.5H3L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" />
    </svg>
  ),
  filter: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 6h16l-6 7v5l-4 2v-7L4 6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
} as const;

const serviceMeta: Record<
  string,
  {
    name: string;
    tag: string;
    kind: string;
    color: string;
    resourceLabel: string;
  }
> = {
  s3: {
    name: "S3",
    tag: "S3",
    kind: "Object storage",
    color: "#5db872",
    resourceLabel: "Buckets",
  },
  sqs: {
    name: "SQS",
    tag: "SQS",
    kind: "Message queue",
    color: "#cc785c",
    resourceLabel: "Queues",
  },
  dynamodb: {
    name: "DynamoDB",
    tag: "DynamoDB",
    kind: "NoSQL table",
    color: "#5db8a6",
    resourceLabel: "Tables",
  },
  secretsmanager: {
    name: "Secrets Manager",
    tag: "Secrets",
    kind: "Secrets store",
    color: "#e8a55a",
    resourceLabel: "Secrets",
  },
} as const;

export function svcInfo(svc: string) {
  return (
    serviceMeta[svc] ?? {
      name: svc,
      tag: svc,
      kind: "Service",
      color: "#a09d96",
      resourceLabel: "Resources",
    }
  );
}

const dotLabel: Record<"running" | "error" | "idle", string> = {
  running: "稼働中",
  error: "エラー",
  idle: "停止",
};

export function StatusDot({
  state,
  pulse,
  lg,
}: {
  state: "running" | "error" | "idle";
  pulse?: boolean;
  lg?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={dotLabel[state]}
      className={`dot ${state}${pulse ? " pulse" : ""}${lg ? " lg" : ""}`}
    />
  );
}

export function ServiceTag({ svc }: { svc: string }) {
  const s = svcInfo(svc);
  return (
    <span
      className="svc-tag"
      style={{
        color: s.color,
        background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
      }}
    >
      {s.tag}
    </span>
  );
}

export function StatusChip({ status }: { status: number }) {
  const cls = status < 400 ? "2xx" : status < 500 ? "4xx" : "5xx";
  return <span className={`status-chip status-${cls}`}>{status}</span>;
}

export function ProtoBadge({ protocol }: { protocol: Protocol | string }) {
  return <span className="proto-badge">{protocol}</span>;
}

const tokenRe =
  /("(\\.|[^"\\])*"\s*:)|("(\\.|[^"\\])*")|(\b-?\d+\.?\d*\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}\[\],])/g;

function highlightJson(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  tokenRe.lastIndex = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last)
      tokens.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    let cls = "p";
    if (m[1]) cls = "k";
    else if (m[3]) cls = "s";
    else if (m[5]) cls = "n";
    else if (m[6]) cls = "n";
    tokens.push(
      <span key={i++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length)
    tokens.push(<span key={i++}>{text.slice(last)}</span>);
  return tokens;
}

export function prettyMaybeJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function CodeBlock({
  text,
  highlight,
}: {
  text: string;
  highlight?: boolean;
}) {
  if (!text) return <pre className="codeblock muted">{"(empty)"}</pre>;
  return (
    <pre className="codeblock">{highlight ? highlightJson(text) : text}</pre>
  );
}

export function Popover({
  anchor,
  children,
  onClose,
  align = "left",
}: {
  anchor: HTMLElement | null;
  children: ReactNode;
  onClose: () => void;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(t) &&
        anchor &&
        !anchor.contains(t)
      )
        onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", esc);
    };
  }, [anchor, onClose]);
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const style =
    align === "right"
      ? { top: r.bottom + 6, right: window.innerWidth - r.right }
      : { top: r.bottom + 6, left: r.left };
  return createPortal(
    <div className="popover fadein" ref={ref} style={style}>
      {children}
    </div>,
    document.body,
  );
}

export function EmptyState({
  glyph,
  title,
  sub,
  action,
}: {
  glyph: ReactNode;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="glyph">{glyph}</div>
      <div className="et">{title}</div>
      {sub && <div className="es">{sub}</div>}
      {action}
    </div>
  );
}

export function MultiFilter({
  label,
  options,
  selected,
  onChange,
  render,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  render?: (o: string) => ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const all = selected.length === 0;
  const toggle = (o: string) => {
    if (selected.includes(o)) onChange(selected.filter((x) => x !== o));
    else onChange([...selected, o]);
  };
  return (
    <>
      <button
        className={`select-pill${all ? "" : " on"}`}
        ref={ref}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Ico.filter width="13" height="13" />
        <span>
          {label}
          {all ? "" : ` · ${selected.length}`}
        </span>
        <Ico.caret
          width="12"
          height="12"
          style={{ color: "var(--muted-soft)" }}
        />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)}>
          <button className="opt" onClick={() => onChange([])}>
            <span style={{ fontWeight: 500 }}>All {label.toLowerCase()}</span>
            {all && <Ico.check className="chk" width="15" height="15" />}
          </button>
          <div className="sep" />
          {options.map((o) => (
            <button key={o} className="opt" onClick={() => toggle(o)}>
              <span>{render ? render(o) : o}</span>
              {selected.includes(o) && (
                <Ico.check className="chk" width="15" height="15" />
              )}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function fmtLatency(ms: number): string {
  return ms < 10 ? ms.toFixed(2) : ms.toFixed(0);
}
