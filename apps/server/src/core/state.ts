import type { ScopedStore, StateScope } from "./types.ts";

export type StateStore = {
  data: Map<string, Map<string, unknown>>;
};

export const createStateStore = (): StateStore => ({ data: new Map() });

const scopeKey = (scope: StateScope): string =>
  `${scope.account}/${scope.region}/${scope.service}`;

const bucketFor = (
  store: StateStore,
  scope: StateScope,
): Map<string, unknown> => {
  const key = scopeKey(scope);
  const existing = store.data.get(key);
  if (existing !== undefined) return existing;
  const created = new Map<string, unknown>();
  store.data.set(key, created);
  return created;
};

export const scopedStore = (
  store: StateStore,
  scope: StateScope,
): ScopedStore => ({
  scope,
  get: <T = unknown>(key: string): T | undefined =>
    bucketFor(store, scope).get(key) as T | undefined,
  set: <T = unknown>(key: string, value: T): void => {
    bucketFor(store, scope).set(key, value);
  },
  delete: (key: string): boolean => bucketFor(store, scope).delete(key),
  list: <T = unknown>(): { key: string; value: T }[] =>
    [...bucketFor(store, scope).entries()].map(([key, value]) => ({
      key,
      value: value as T,
    })),
});

export type EnumeratedResource = {
  account: string;
  region: string;
  service: string;
  key: string;
  value: unknown;
};

export const enumerateResources = (
  store: StateStore,
  filterService?: string,
): EnumeratedResource[] => {
  const result: EnumeratedResource[] = [];
  for (const [scope, bucket] of store.data.entries()) {
    const [account, region, service] = scope.split("/");
    if (filterService !== undefined && service !== filterService) continue;
    for (const [key, value] of bucket.entries()) {
      if (key.startsWith("_")) continue;
      result.push({ account, region, service, key, value });
    }
  }
  return result;
};

export const countResources = (store: StateStore, service: string): number =>
  enumerateResources(store, service).length;

const DISPLAY_THRESHOLD = 4096;
const DISPLAY_PREVIEW = 256;

const isBinaryString = (s: string): boolean => {
  const sample = s.slice(0, 256);
  let count = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c >= 0x7f) {
      count++;
    }
  }
  return sample.length > 0 && count / sample.length > 0.3;
};

export const truncateValueForDisplay = (value: unknown): unknown => {
  if (typeof value === "string") {
    if (value.length <= DISPLAY_THRESHOLD) return value;
    const byteLen = new TextEncoder().encode(value).length;
    if (isBinaryString(value)) return `<binary, ${byteLen} bytes>`;
    return `${value.slice(0, DISPLAY_PREVIEW)}…(${byteLen} bytes truncated)`;
  }
  if (ArrayBuffer.isView(value)) {
    return `<binary, ${(value as ArrayBufferView).byteLength} bytes>`;
  }
  if (Array.isArray(value)) {
    return value.map(truncateValueForDisplay);
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncateValueForDisplay(v);
    }
    return out;
  }
  return value;
};

export type StateSnapshot = Map<string, Map<string, unknown>>;

export const dumpState = (store: StateStore): StateSnapshot => {
  const snapshot: StateSnapshot = new Map();
  for (const [key, bucket] of store.data.entries()) {
    const cloned = new Map<string, unknown>();
    for (const [k, v] of bucket.entries()) {
      cloned.set(k, structuredClone(v));
    }
    snapshot.set(key, cloned);
  }
  return snapshot;
};

export const restoreState = (
  store: StateStore,
  snapshot: StateSnapshot,
): void => {
  store.data.clear();
  for (const [key, bucket] of snapshot.entries()) {
    const cloned = new Map<string, unknown>();
    for (const [k, v] of bucket.entries()) {
      cloned.set(k, structuredClone(v));
    }
    store.data.set(key, cloned);
  }
};
