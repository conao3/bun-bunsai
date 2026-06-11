export type PrefixGroup<T> = {
  prefix: string;
  label: string;
  items: T[];
};

export function getKeyPrefix(key: string): string {
  const slashIdx = key.indexOf("/");
  const colonIdx = key.indexOf(":");
  if (slashIdx === -1 && colonIdx === -1) return "";
  const delimIdx =
    slashIdx === -1
      ? colonIdx
      : colonIdx === -1
        ? slashIdx
        : Math.min(slashIdx, colonIdx);
  return key.slice(0, delimIdx);
}

export function groupResourcesByPrefix<T extends { key: string }>(
  items: T[],
  defaultLabel: string,
): PrefixGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const prefix = getKeyPrefix(item.key);
    const existing = map.get(prefix);
    if (existing) {
      existing.push(item);
    } else {
      map.set(prefix, [item]);
    }
  }
  return Array.from(map.entries()).map(([prefix, groupItems]) => ({
    prefix,
    label: prefix
      ? prefix.charAt(0).toUpperCase() + prefix.slice(1)
      : defaultLabel,
    items: groupItems,
  }));
}
