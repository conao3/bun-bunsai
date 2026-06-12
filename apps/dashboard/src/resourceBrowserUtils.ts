export const SIZE_WARN_THRESHOLD = 1048576;

export function isSizeWarn(size: number): boolean {
  return size >= SIZE_WARN_THRESHOLD;
}
