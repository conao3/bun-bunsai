type AggregableService = {
  name: string;
  callCount: number;
  resourceCount: number;
};

export function aggregateServices<T extends AggregableService>(
  services: T[],
): T[] {
  const map = new Map<string, T>();
  for (const svc of services) {
    const existing = map.get(svc.name);
    if (!existing) {
      map.set(svc.name, { ...svc });
    } else {
      map.set(svc.name, {
        ...existing,
        callCount: existing.callCount + svc.callCount,
        resourceCount: Math.max(existing.resourceCount, svc.resourceCount),
      } as T);
    }
  }
  return Array.from(map.values());
}
