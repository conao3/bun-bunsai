import type { ServiceSummary } from "./api";

export function aggregateServices(
  services: ServiceSummary[],
): ServiceSummary[] {
  const map = new Map<string, ServiceSummary>();
  for (const svc of services) {
    const existing = map.get(svc.name);
    if (!existing) {
      map.set(svc.name, { ...svc });
    } else {
      map.set(svc.name, {
        ...existing,
        callCount: existing.callCount + svc.callCount,
        resourceCount: Math.max(existing.resourceCount, svc.resourceCount),
      });
    }
  }
  return Array.from(map.values());
}
