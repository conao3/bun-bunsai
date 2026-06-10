export type Selection = { service: string; key: string };

type ScopedResource = { service: string; key: string };

export function decideAutoSelect(
  sel: Selection | null,
  scoped: ScopedResource[],
  svcHint: string | null,
): Selection | null {
  if (sel !== null && scoped.length === 0) return null;
  if (
    sel !== null &&
    scoped.some((e) => e.service === sel.service && e.key === sel.key)
  )
    return null;
  if (svcHint !== null && scoped.length === 0) return null;
  if (svcHint !== null) {
    const svcResources = scoped.filter((e) => e.service === svcHint);
    if (svcResources.length > 0)
      return { service: svcResources[0].service, key: svcResources[0].key };
  }
  const first = scoped[0];
  return first ? { service: first.service, key: first.key } : null;
}
