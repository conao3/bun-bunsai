export const protocols = [
  "query",
  "json",
  "rest-json",
  "rest-xml",
  "unknown",
] as const;
export type Protocol = (typeof protocols)[number];

export type ServiceSummary = {
  name: string;
  protocol: Protocol;
  status: "available";
  resourceCount: number;
  callCount: number;
};

export type ResourceEntry = {
  account: string;
  region: string;
  service: string;
  key: string;
  value: unknown;
};

export type RequestLogEntry = {
  id: string;
  time: string;
  service: string;
  operation: string;
  statusCode: number;
  latencyMs: number;
  account: string;
  region: string;
  protocol: string;
  requestBodyText: string;
  responseBodyText: string;
};

const base = "/__bunsai" as const;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchServices(): Promise<ServiceSummary[]> {
  return (await getJson<ServiceSummary[]>("/services")) ?? [];
}

export async function fetchResources(
  service?: string,
): Promise<ResourceEntry[]> {
  const q = service ? `?service=${encodeURIComponent(service)}` : "";
  return (await getJson<ResourceEntry[]>(`/resources${q}`)) ?? [];
}

export async function fetchLogs(): Promise<RequestLogEntry[]> {
  return (await getJson<RequestLogEntry[]>("/logs")) ?? [];
}

export function openLogStream(
  onEntry: (entry: RequestLogEntry) => void,
  onError: () => void,
): () => void {
  let source: EventSource | null = null;
  try {
    source = new EventSource(`${base}/logs/stream`);
  } catch {
    onError();
    return () => {};
  }
  const handle = (e: MessageEvent) => {
    try {
      onEntry(JSON.parse(e.data) as RequestLogEntry);
    } catch {
      return;
    }
  };
  source.onmessage = handle;
  source.onerror = () => onError();
  return () => {
    if (source) source.close();
  };
}
