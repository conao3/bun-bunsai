export function matchesOpFilter(
  operation: string,
  opFilter: string[],
): boolean {
  return opFilter.length === 0 || opFilter.includes(operation);
}
