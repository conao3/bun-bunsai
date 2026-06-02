import type { RequestLogEntry } from "./types.ts";

export type LogListener = (entry: RequestLogEntry) => void;

export type RequestLog = {
  entries: RequestLogEntry[];
  capacity: number;
  listeners: Set<LogListener>;
};

export const createRequestLog = (capacity = 500): RequestLog => ({
  entries: [],
  capacity,
  listeners: new Set(),
});

export const recordLog = (
  log: RequestLog,
  entry: Omit<RequestLogEntry, "id" | "time">,
): RequestLogEntry => {
  const full: RequestLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
  };
  log.entries.push(full);
  if (log.entries.length > log.capacity) {
    log.entries.splice(0, log.entries.length - log.capacity);
  }
  for (const listener of log.listeners) listener(full);
  return full;
};

export const listLogs = (log: RequestLog): RequestLogEntry[] => [
  ...log.entries,
];

export const countCallsByService = (log: RequestLog, service: string): number =>
  log.entries.filter((e) => e.service === service).length;

export const subscribeLog = (
  log: RequestLog,
  listener: LogListener,
): (() => void) => {
  log.listeners.add(listener);
  return () => {
    log.listeners.delete(listener);
  };
};
